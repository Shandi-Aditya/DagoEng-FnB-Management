import fs from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GET as syncGet, POST as syncPost } from "@/app/api/sync/[domain]/route";
import {
  GET as selfOrderGet,
  POST as selfOrderPost,
} from "@/app/api/orders/self-order/route";
import { POST as staffOrdersPost } from "@/app/api/orders/route";
import {
  GET as bookingsGet,
  POST as bookingsPost,
} from "@/app/api/coworking/bookings/route";
import {
  deletePersistentEmployee,
  deletePersistentLoyaltyMember,
  deletePersistentProduct,
  getPersistentEmployees,
  getPersistentLoyaltyMembers,
  getPersistentProductsData,
  readPersistentData,
} from "@/lib/persistent-storage";
import {
  INITIAL_EMPLOYEES,
  INITIAL_MEMBERS,
  INITIAL_PRODUCTS,
} from "@/lib/master-data-defaults";
import {
  clearOutboxForTests,
  enqueueOutboxItem,
  flushOutbox,
  getOutboxItems,
  reconcileCollectionWithOutbox,
} from "@/lib/sync-outbox";
import {
  platformSettingsSyncClient,
  tenantsSyncClient,
} from "@/lib/sync-domains/config-spec";
import { inventorySyncClient } from "@/lib/sync-domains/inventory-spec";
import {
  coworkingMasterSyncClient,
  tablesSyncClient,
} from "@/lib/sync-domains/spaces-spec";
import { getOrCreateSimulatedWifiVoucher } from "@/lib/wifi";

function buildMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

function makeSyncRequest(
  domain: string,
  options: {
    method?: "GET" | "POST";
    persona?: string;
    body?: unknown;
  } = {}
): [NextRequest, { params: Promise<{ domain: string }> }] {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {};
  if (options.persona) {
    headers.cookie = `dagoeng_active_persona=${options.persona}`;
  }
  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
  }
  const req = new NextRequest(`http://localhost:3000/api/sync/${domain}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  return [req, { params: Promise.resolve({ domain }) }];
}

describe("Task V-06: Full Multi-Domain Server Sync, Outbox Coalescing & Cache Wipe Resilience", () => {
  let tempDir = "";
  let prevDataDirOverride: string | undefined;
  let prevDisableDemoLogin: string | undefined;
  let prevWindow: unknown;
  let prevFetch: typeof globalThis.fetch;

  beforeEach(() => {
    prevDataDirOverride = process.env.DATA_DIR_OVERRIDE;
    prevDisableDemoLogin = process.env.DISABLE_DEMO_LOGIN;
    delete process.env.DISABLE_DEMO_LOGIN;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "v06-sync-"));
    process.env.DATA_DIR_OVERRIDE = tempDir;

    prevWindow = (globalThis as Record<string, unknown>).window;
    prevFetch = globalThis.fetch;

    const storage = buildMemoryStorage();
    const listeners = new Map<string, Set<(evt: Event) => void>>();
    (globalThis as Record<string, unknown>).window = {
      localStorage: storage,
      addEventListener(type: string, cb: (evt: Event) => void) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(cb);
      },
      removeEventListener(type: string, cb: (evt: Event) => void) {
        listeners.get(type)?.delete(cb);
      },
      dispatchEvent(evt: Event) {
        for (const cb of listeners.get(evt.type) ?? []) {
          cb(evt);
        }
        return true;
      },
    };

    clearOutboxForTests();
    platformSettingsSyncClient.resetForTests();
    tenantsSyncClient.resetForTests();
    inventorySyncClient.resetForTests();
    tablesSyncClient.resetForTests();
    coworkingMasterSyncClient.resetForTests();
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__ENABLE_DOMAIN_SYNC_IN_TESTS__;
    globalThis.fetch = prevFetch;
    if (prevWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      (globalThis as Record<string, unknown>).window = prevWindow;
    }
    if (prevDataDirOverride === undefined) {
      delete process.env.DATA_DIR_OVERRIDE;
    } else {
      process.env.DATA_DIR_OVERRIDE = prevDataDirOverride;
    }
    if (prevDisableDemoLogin === undefined) {
      delete process.env.DISABLE_DEMO_LOGIN;
    } else {
      process.env.DISABLE_DEMO_LOGIN = prevDisableDemoLogin;
    }
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("1. Outbox Coalescing, Single-Flight Flush & Collection Reconciliation", () => {
    it("coalesces POST+PUT into POST and cancels POST+DELETE locally before network flush", () => {
      enqueueOutboxItem({
        id: "prod-offline-1",
        endpoint: "/api/products",
        method: "POST",
        isCreate: true,
        payload: {
          product: { id: "prod-offline-1", name: "Latte Awal", basePrice: 24000 },
        },
      });
      enqueueOutboxItem({
        id: "prod-offline-1",
        endpoint: "/api/products",
        method: "PUT",
        payload: {
          product: { id: "prod-offline-1", basePrice: 29000 },
        },
      });

      const afterUpdate = getOutboxItems();
      expect(afterUpdate).toHaveLength(1);
      expect(afterUpdate[0].method).toBe("POST");
      expect(afterUpdate[0].isCreate).toBe(true);
      expect(afterUpdate[0].payload.product).toEqual({
        id: "prod-offline-1",
        name: "Latte Awal",
        basePrice: 29000,
      });

      enqueueOutboxItem({
        id: "prod-offline-1",
        endpoint: "/api/products",
        method: "DELETE",
        payload: { id: "prod-offline-1" },
      });

      expect(getOutboxItems()).toHaveLength(0);
    });

    it("appends ?id= query fallback on DELETE and deduplicates concurrent flushOutbox calls", async () => {
      enqueueOutboxItem({
        id: "emp-del-42",
        endpoint: "/api/employees",
        method: "DELETE",
        payload: {},
      });

      const seenUrls: string[] = [];
      const slowFetch = async (input: RequestInfo | URL) => {
        seenUrls.push(String(input));
        await new Promise((r) => setTimeout(r, 25));
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      };

      const [r1, r2] = await Promise.all([
        flushOutbox(slowFetch as typeof fetch),
        flushOutbox(slowFetch as typeof fetch),
      ]);

      expect(seenUrls).toEqual(["/api/employees?id=emp-del-42"]);
      expect(r1.flushedCount).toBe(1);
      expect(r2.flushedCount).toBe(1);
      expect(getOutboxItems()).toHaveLength(0);
    });

    it("reconciles server collections with pending outbox upserts and deletes", () => {
      enqueueOutboxItem({
        id: "emp-002",
        endpoint: "/api/employees",
        method: "DELETE",
        payload: { id: "emp-002" },
      });
      enqueueOutboxItem({
        id: "emp-offline-new",
        endpoint: "/api/employees",
        method: "POST",
        isCreate: true,
        payload: {
          employee: { id: "emp-offline-new", name: "Wayan Baru" },
        },
      });

      const serverList = [
        { id: "emp-001", name: "Putu Arya" },
        { id: "emp-002", name: "Ni Kadek Sri" },
      ];
      const localList = [
        { id: "emp-001", name: "Putu Arya" },
        { id: "emp-offline-new", name: "Wayan Baru" },
      ];

      const reconciled = reconcileCollectionWithOutbox({
        serverItems: serverList,
        localItems: localList,
        endpoint: "/api/employees",
      });

      expect(reconciled.map((e) => e.id).sort()).toEqual([
        "emp-001",
        "emp-offline-new",
      ]);
    });
  });

  describe("2. Zero Zombie Seed Resurrection When All Seeded Items Are Deleted", () => {
    it("preserves empty arrays [] after deleting all seeded employees, products, and loyalty members", async () => {
      for (const emp of INITIAL_EMPLOYEES) {
        await deletePersistentEmployee(emp.id);
      }
      expect(await getPersistentEmployees()).toEqual([]);

      for (const prod of INITIAL_PRODUCTS) {
        await deletePersistentProduct(prod.id);
      }
      expect((await getPersistentProductsData()).products).toEqual([]);

      for (const member of INITIAL_MEMBERS) {
        await deletePersistentLoyaltyMember(member.id);
      }
      expect(await getPersistentLoyaltyMembers()).toEqual([]);
    });
  });

  describe("3. /api/sync/[domain] RBAC, Idempotency & Business Invariants Across All 9 Domains", () => {
    it("platform-settings: enforces org module guard, tenant-scoped promo isolation, opId idempotency, and tenant_operations.json mirror", async () => {
      const [coreToggleReq, coreToggleCtx] = makeSyncRequest("platform-settings", {
        method: "POST",
        persona: "DAGO_OWNER",
        body: { command: { op: "TOGGLE_ORG_MODULE", moduleCode: "CORE" } },
      });
      const coreRes = await syncPost(coreToggleReq, coreToggleCtx);
      expect(coreRes.status).toBe(200);
      const coreJson = await coreRes.json();
      expect(coreJson.state.activeOrgModules).toContain("CORE");

      const [patchReq, patchCtx] = makeSyncRequest("platform-settings", {
        method: "POST",
        persona: "DAGO_OWNER",
        body: {
          command: {
            op: "PATCH_SETTINGS",
            patch: {
              taxRatePercent: 11,
              promos: [
                {
                  id: "promo-hub-1",
                  code: "HUB50",
                  name: "Diskon Hub",
                  discountType: "PERCENTAGE",
                  discountValue: 10,
                  targetType: "ALL",
                  scope: "ALL",
                  quota: 5,
                  usageCount: 0,
                  validFrom: "2026-01-01",
                  validUntil: "2026-12-31",
                  isActive: true,
                },
              ],
              tenantOperations: {
                "tenant-ks": {
                  tenantId: "tenant-ks",
                  tenantName: "Kopi Senja",
                  isAcceptingOrders: false,
                  openTime: "09:00",
                  closeTime: "20:00",
                },
              },
            },
          },
        },
      });
      const patchRes = await syncPost(patchReq, patchCtx);
      expect(patchRes.status).toBe(200);

      const mirroredOps = await readPersistentData<Record<string, { openTime: string }> | null>(
        "tenant_operations.json",
        null
      );
      expect(mirroredOps?.["tenant-ks"]?.openTime).toBe("09:00");

      const [crossTenantPromoReq, crossTenantPromoCtx] = makeSyncRequest(
        "platform-settings",
        {
          method: "POST",
          persona: "TENANT_OWNER_KS",
          body: {
            command: {
              op: "SAVE_PROMOS",
              tenantScopeId: "tenant-kitchen",
              promos: [],
            },
          },
        }
      );
      expect((await syncPost(crossTenantPromoReq, crossTenantPromoCtx)).status).toBe(403);

      const [ownPromoReq, ownPromoCtx] = makeSyncRequest("platform-settings", {
        method: "POST",
        persona: "TENANT_OWNER_KS",
        body: {
          command: {
            op: "SAVE_PROMOS",
            tenantScopeId: "tenant-ks",
            promos: [
              {
                id: "promo-ks-1",
                code: "KOPI15",
                name: "Kopi Hemat",
                discountType: "PERCENTAGE",
                discountValue: 15,
                targetType: "ALL",
                scope: "FNB",
                tenantId: "tenant-ks",
                quota: 10,
                usageCount: 0,
                validFrom: "2026-01-01",
                validUntil: "2026-12-31",
                isActive: true,
              },
            ],
          },
        },
      });
      const ownPromoRes = await syncPost(ownPromoReq, ownPromoCtx);
      expect(ownPromoRes.status).toBe(200);
      const ownPromoJson = await ownPromoRes.json();
      expect(
        ownPromoJson.state.promos.map((p: { id: string }) => p.id).sort()
      ).toEqual(["promo-hub-1", "promo-ks-1"]);

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const [redeemReq, redeemCtx] = makeSyncRequest("platform-settings", {
          method: "POST",
          persona: "CASHIER_SGR",
          body: {
            command: {
              op: "REDEEM_PROMO",
              opId: "redeem-order-901",
              promoIdOrCode: "HUB50",
              customerId: "cust-1",
            },
          },
        });
        expect((await syncPost(redeemReq, redeemCtx)).status).toBe(200);
      }

      const [getReq, getCtx] = makeSyncRequest("platform-settings");
      const getJson = await (await syncGet(getReq, getCtx)).json();
      const hubPromo = getJson.state.promos.find(
        (p: { id: string }) => p.id === "promo-hub-1"
      );
      expect(hubPromo.usageCount).toBe(1);
    });

    it("tenants: isolates profile writes per tenant and masks bank account numbers by caller scope", async () => {
      const [kitchenWriteReq, kitchenWriteCtx] = makeSyncRequest("tenants", {
        method: "POST",
        persona: "TENANT_OWNER_KITCHEN",
        body: {
          command: {
            op: "UPSERT_PROFILE",
            profile: {
              tenantId: "tenant-kitchen",
              brandName: "Dapur Mama",
              tagline: "Masakan Rumahan",
              description: "Nasi hangat",
              contactPhone: "081322334411",
              receiptHeader: "Dapur Mama",
              receiptFooter: "Terima kasih",
              lowStockThresholdPercent: 25,
              bankName: "BRI",
              bankAccountNumber: "998877665544",
              bankAccountHolder: "Siti Aminah",
              status: "ACTIVE",
            },
          },
        },
      });
      expect((await syncPost(kitchenWriteReq, kitchenWriteCtx)).status).toBe(200);

      const [ksCrossWriteReq, ksCrossWriteCtx] = makeSyncRequest("tenants", {
        method: "POST",
        persona: "TENANT_OWNER_KS",
        body: {
          command: {
            op: "UPSERT_PROFILE",
            profile: {
              tenantId: "tenant-kitchen",
              brandName: "Bajak",
              tagline: "",
              description: "",
              contactPhone: "",
              receiptHeader: "",
              receiptFooter: "",
              lowStockThresholdPercent: 10,
              bankName: "BCA",
              bankAccountNumber: "11112222",
              bankAccountHolder: "Peretas",
              status: "ACTIVE",
            },
          },
        },
      });
      expect((await syncPost(ksCrossWriteReq, ksCrossWriteCtx)).status).toBe(403);

      const [ksReadReq, ksReadCtx] = makeSyncRequest("tenants", {
        persona: "TENANT_OWNER_KS",
      });
      const ksReadJson = await (await syncGet(ksReadReq, ksReadCtx)).json();
      expect(ksReadJson.state.profiles["tenant-kitchen"].bankAccountNumber).toContain("•");
      expect(ksReadJson.state.profiles["tenant-kitchen"].bankAccountNumber).not.toBe(
        "998877665544"
      );

      const [anonReadReq, anonReadCtx] = makeSyncRequest("tenants");
      const anonReadJson = await (await syncGet(anonReadReq, anonReadCtx)).json();
      expect(anonReadJson.state.profiles["tenant-kitchen"].bankAccountNumber).toContain("•");
      expect(anonReadJson.state.profiles["tenant-kitchen"].bankAccountNumber).not.toBe(
        "998877665544"
      );
    });

    it("wifi, subscription & printer-config: generate deterministic voucher codes and enforce role boundaries", async () => {
      const v1 = getOrCreateSimulatedWifiVoucher("ORD-DET-777", "Tamu A", 85000);
      window.localStorage.clear();
      const v2 = getOrCreateSimulatedWifiVoucher("ORD-DET-777", "Tamu A", 85000);
      expect(v1?.voucherCode).toBeDefined();
      expect(v1?.voucherCode).toBe(v2?.voucherCode);

      const [issueReq, issueCtx] = makeSyncRequest("wifi", {
        method: "POST",
        persona: "CASHIER_SGR",
        body: { command: { op: "ISSUE_VOUCHER", voucher: v1 } },
      });
      expect((await syncPost(issueReq, issueCtx)).status).toBe(200);

      const [subForbiddenReq, subForbiddenCtx] = makeSyncRequest("subscription", {
        method: "POST",
        persona: "TENANT_OWNER_KS",
        body: { command: { op: "SET_ORG_PLAN", planTier: "ENTERPRISE" } },
      });
      expect((await syncPost(subForbiddenReq, subForbiddenCtx)).status).toBe(403);

      const [addonToggleReq, addonToggleCtx] = makeSyncRequest("subscription", {
        method: "POST",
        persona: "DAGO_OWNER",
        body: {
          command: {
            op: "TOGGLE_ADDON",
            scopeId: "default",
            addonIdOrCode: "LOYALTY_CRM_PRO",
          },
        },
      });
      const addonRes = await syncPost(addonToggleReq, addonToggleCtx);
      expect(addonRes.status).toBe(200);
      const addonJson = await addonRes.json();
      expect(addonJson.state.addonsByScope["org-dago-hub"]).toBeDefined();

      const [printerWaiterReq, printerWaiterCtx] = makeSyncRequest(
        "printer-config",
        {
          method: "POST",
          persona: "WAITER_SGR",
          body: {
            command: {
              op: "PATCH_SETTINGS",
              updates: { receiptFooterText: "Diubah Waiter" },
            },
          },
        }
      );
      expect((await syncPost(printerWaiterReq, printerWaiterCtx)).status).toBe(403);

      const [printerOwnerReq, printerOwnerCtx] = makeSyncRequest("printer-config", {
        method: "POST",
        persona: "DAGO_OWNER",
        body: {
          command: {
            op: "PATCH_SETTINGS",
            updates: { receiptFooterText: "Terima kasih dari Dago Hub!" },
          },
        },
      });
      const printerOwnerJson = await (
        await syncPost(printerOwnerReq, printerOwnerCtx)
      ).json();
      expect(printerOwnerJson.state.settings.receiptFooterText).toBe(
        "Terima kasih dari Dago Hub!"
      );
    });

    it("inventory, tables, coworking-master & commercial: deduplicate opId retries and strip PII for unauthenticated readers", async () => {
      const [invInitReq, invInitCtx] = makeSyncRequest("inventory", {
        persona: "DAGO_OWNER",
      });
      const invInit = await (await syncGet(invInitReq, invInitCtx)).json();
      const targetIng = invInit.state.ingredients[0];

      const bomCmd = {
        op: "APPLY_BOM_DELTAS" as const,
        opId: "bom-ord-555",
        deltas: [{ ingredientId: targetIng.id, delta: -2 }],
        logs: [
          {
            id: "log-bom-555",
            timestamp: "10:00",
            ingredientId: targetIng.id,
            ingredientName: targetIng.name,
            type: "AUTO_SALE" as const,
            qtyChange: -2,
            unit: targetIng.unit,
            actor: "POS",
            reason: "Order 555",
          },
        ],
      };

      for (let i = 0; i < 2; i += 1) {
        const [bomReq, bomCtx] = makeSyncRequest("inventory", {
          method: "POST",
          persona: "CASHIER_SGR",
          body: { command: bomCmd },
        });
        expect((await syncPost(bomReq, bomCtx)).status).toBe(200);
      }

      const [invAfterReq, invAfterCtx] = makeSyncRequest("inventory", {
        persona: "DAGO_OWNER",
      });
      const invAfter = await (await syncGet(invAfterReq, invAfterCtx)).json();
      const updatedIng = invAfter.state.ingredients.find(
        (item: { id: string }) => item.id === targetIng.id
      );
      expect(updatedIng.stockNumber).toBe(
        +(targetIng.stockNumber - 2).toFixed(3)
      );

      const [tblCustDelReq, tblCustDelCtx] = makeSyncRequest("tables", {
        method: "POST",
        persona: "CUSTOMER_DEMO",
        body: { command: { op: "DELETE_TABLE", tableId: "T-01" } },
      });
      expect((await syncPost(tblCustDelReq, tblCustDelCtx)).status).toBe(403);

      const [tblCustOccReq, tblCustOccCtx] = makeSyncRequest("tables", {
        method: "POST",
        persona: "CUSTOMER_DEMO",
        body: {
          command: {
            op: "PATCH_TABLE_STATUS",
            tableId: "T-01",
            status: "OCCUPIED",
            customer: "Tamu QR",
          },
        },
      });
      expect((await syncPost(tblCustOccReq, tblCustOccCtx)).status).toBe(200);

      const [cwkAnonReq, cwkAnonCtx] = makeSyncRequest("coworking-master");
      const cwkAnonJson = await (await syncGet(cwkAnonReq, cwkAnonCtx)).json();
      expect(cwkAnonJson.state.spaces.length).toBeGreaterThan(0);
      expect(cwkAnonJson.state.members).toEqual([]);
      expect(cwkAnonJson.state.checkLogs).toEqual([]);

      const [cwkStaffReq, cwkStaffCtx] = makeSyncRequest("coworking-master", {
        persona: "DAGO_OWNER",
      });
      const cwkStaffJson = await (await syncGet(cwkStaffReq, cwkStaffCtx)).json();
      expect(cwkStaffJson.state.members.length).toBeGreaterThan(0);

      const [commCashierReq, commCashierCtx] = makeSyncRequest("commercial", {
        persona: "CASHIER_SGR",
      });
      expect((await syncGet(commCashierReq, commCashierCtx)).status).toBe(403);

      const [commMgrReq, commMgrCtx] = makeSyncRequest("commercial", {
        method: "POST",
        persona: "COMMERCIAL_MANAGER",
        body: {
          command: {
            op: "RECORD_LEASE_PAYMENT",
            leaseId: "lease-001",
            updatedAt: "2026-11-18T08:00:00.000Z",
            payment: {
              id: "pay-v06-1",
              date: "2026-11-18",
              periodCovered: "Nov 2026",
              amount: 15000000,
              paymentMethod: "Transfer BCA",
              referenceNumber: "TRX-V06-1",
              status: "PAID",
              recordedBy: "Maya Santika",
            },
          },
        },
      });
      const commMgrRes = await syncPost(commMgrReq, commMgrCtx);
      expect(commMgrRes.status).toBe(200);
    });
  });

  describe("4. Two-Device Client Convergence & Browser Cache Clear Survival", () => {
    it("converges Device B identically to Device A after localStorage.clear()", async () => {
      (globalThis as Record<string, unknown>).__ENABLE_DOMAIN_SYNC_IN_TESTS__ = true;

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const urlStr = String(input);
        const match = urlStr.match(/\/api\/sync\/([^/?]+)/);
        if (!match) {
          return new Response(JSON.stringify({ success: false }), { status: 404 });
        }
        const domain = match[1];
        const method = (init?.method || "GET").toUpperCase();
        const headers: Record<string, string> = {
          cookie: "dagoeng_active_persona=DAGO_OWNER",
        };
        if (init?.body) {
          headers["content-type"] = "application/json";
        }
        const req = new NextRequest(`http://localhost:3000/api/sync/${domain}`, {
          method,
          headers,
          body: init?.body ? String(init.body) : undefined,
        });
        const ctx = { params: Promise.resolve({ domain }) };
        const nextRes =
          method === "POST"
            ? await syncPost(req, ctx)
            : await syncGet(req, ctx);
        const text = await nextRes.text();
        return new Response(text, {
          status: nextRes.status,
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch;

      platformSettingsSyncClient.mutate(
        (prev) => ({ ...prev, serviceChargePercent: 7 }),
        {
          id: "cfg-sc-7",
          command: { op: "PATCH_SETTINGS", patch: { serviceChargePercent: 7 } },
        }
      );

      tablesSyncClient.mutate(
        (prev) => prev,
        {
          id: "tbl-new-vip99",
          isCreate: true,
          command: {
            op: "UPSERT_TABLE",
            areaId: "area-sgr-1",
            table: {
              id: "VIP-99",
              number: "VIP-99",
              cap: 10,
              status: "AVAILABLE",
              outletId: "outlet-sgr",
              outletName: "Singaraja",
            },
          },
        }
      );

      coworkingMasterSyncClient.mutate(
        (prev) => prev,
        {
          id: "plan-v06-exec",
          isCreate: true,
          command: {
            op: "UPSERT_PLAN",
            plan: {
              id: "plan-v06-exec",
              name: "Executive Flex Pass",
              priceFormatted: "Rp 950.000",
              priceNumber: 950000,
              billingCycle: "Bulanan",
              color: "emerald",
              deskAccess: "Semua Meja",
              meetingCredits: "6 Jam",
              fnbPerk: "Diskon 15%",
              fnbVoucherCode: "EXEC15",
              amenities: ["WiFi 100Mbps"],
            },
          },
        }
      );

      await new Promise((r) => setTimeout(r, 40));
      expect(getOutboxItems()).toHaveLength(0);

      window.localStorage.clear();
      platformSettingsSyncClient.resetForTests();
      tablesSyncClient.resetForTests();
      coworkingMasterSyncClient.resetForTests();

      await Promise.all([
        platformSettingsSyncClient.hydrate(),
        tablesSyncClient.hydrate(),
        coworkingMasterSyncClient.hydrate(),
      ]);

      expect(platformSettingsSyncClient.getSnapshot().serviceChargePercent).toBe(7);
      const sgrArea = tablesSyncClient
        .getSnapshot()
        .areas.find((a) => a.id === "area-sgr-1");
      expect(sgrArea?.tables.some((t) => t.id === "VIP-99")).toBe(true);
      expect(
        coworkingMasterSyncClient
          .getSnapshot()
          .plans.some((p) => p.id === "plan-v06-exec")
      ).toBe(true);
    });
  });

  describe("5. QR Self-Order Authoritative Pricing & Customer Booking Anonymization", () => {
    it("recalculates tampered self-order prices from server catalog while keeping POST /api/orders locked for CUSTOMER", async () => {
      const forbiddenStaffOrderReq = new NextRequest(
        "http://localhost:3000/api/orders",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=CUSTOMER_DEMO",
          },
          body: JSON.stringify({ order: { id: "ord-forbidden-1", items: [] } }),
        }
      );
      expect((await staffOrdersPost(forbiddenStaffOrderReq)).status).toBe(403);

      const targetProd = INITIAL_PRODUCTS[0];
      const selfOrderReq = new NextRequest(
        "http://localhost:3000/api/orders/self-order",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            order: {
              id: "ord-qr-v06-1",
              orderNumber: "QR-V06-001",
              outletId: "outlet-sgr",
              outletName: "Singaraja",
              tableNumber: "T-02",
              customerName: "Tamu Meja 2",
              orderType: "DINE_IN",
              paymentMethod: "CASH_COUNTER",
              items: [
                {
                  id: "it-qr-1",
                  productId: targetProd.id,
                  productName: targetProd.name,
                  quantity: 2,
                  unitPrice: 1,
                },
              ],
            },
          }),
        }
      );

      const selfRes = await selfOrderPost(selfOrderReq);
      expect(selfRes.status).toBe(200);
      const selfJson = await selfRes.json();
      expect(selfJson.order.items[0].unitPrice).toBe(targetProd.basePrice);
      expect(selfJson.order.subtotal).toBe(targetProd.basePrice * 2);
      expect(selfJson.order.paymentStatus).toBe("PENDING");

      const pollReq = new NextRequest(
        "http://localhost:3000/api/orders/self-order?ids=ord-qr-v06-1"
      );
      const pollJson = await (await selfOrderGet(pollReq)).json();
      expect(pollJson.orders).toHaveLength(1);
      expect(pollJson.orders[0].id).toBe("ord-qr-v06-1");
    });

    it("returns full own coworking bookings to CUSTOMER while anonymizing other guests' PII", async () => {
      const saveOwnReq = new NextRequest(
        "http://localhost:3000/api/coworking/bookings",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=CUSTOMER_DEMO",
          },
          body: JSON.stringify({
            booking: {
              id: "cwb-own-1",
              bookingCode: "CWK-OWN-1",
              guestName: "Ketut Dian (Customer Member)",
              guestPhone: "+62 819-1122-3344",
              guestEmail: "customer@gmail.com",
              spaceId: "sp-hot-1",
              spaceName: "Hot Desk Flex #01 - #08",
              spaceType: "HOT_DESK",
              bookingType: "HOURLY",
              date: "2026-11-20",
              startTime: "10:00",
              endTime: "12:00",
              duration: 2,
              totalAmount: 30000,
              paymentStatus: "PENDING",
              checkInStatus: "RESERVED",
            },
          }),
        }
      );
      expect((await bookingsPost(saveOwnReq)).status).toBe(200);

      const saveOtherReq = new NextRequest(
        "http://localhost:3000/api/coworking/bookings",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=CASHIER_SGR",
          },
          body: JSON.stringify({
            booking: {
              id: "cwb-other-2",
              bookingCode: "CWK-OTH-2",
              guestName: "Tamu Rahasia VIP",
              guestPhone: "+62 811-9999-8888",
              guestEmail: "vip.secret@example.com",
              spaceId: "sp-ded-1",
              spaceName: "Dedicated Desk D-01",
              spaceType: "DEDICATED_DESK",
              bookingType: "DAILY",
              date: "2026-11-20",
              startTime: "09:00",
              endTime: "17:00",
              duration: 1,
              totalAmount: 120000,
              paymentStatus: "PAID",
              checkInStatus: "RESERVED",
            },
          }),
        }
      );
      expect((await bookingsPost(saveOtherReq)).status).toBe(200);

      const custGetReq = new NextRequest(
        "http://localhost:3000/api/coworking/bookings",
        {
          headers: {
            cookie: "dagoeng_active_persona=CUSTOMER_DEMO",
          },
        }
      );
      const custGetRes = await bookingsGet(custGetReq);
      expect(custGetRes.status).toBe(200);
      const custGetJson = await custGetRes.json();
      const ownBooking = custGetJson.bookings.find(
        (b: { id: string }) => b.id === "cwb-own-1"
      );
      const otherBooking = custGetJson.bookings.find(
        (b: { id: string }) => b.id === "cwb-other-2"
      );
      expect(ownBooking.guestEmail).toBe("customer@gmail.com");
      expect(otherBooking.guestName).not.toBe("Tamu Rahasia VIP");
      expect(otherBooking.guestPhone).toBe("");
      expect(otherBooking.guestEmail).toBe("");
    });
  });
});
