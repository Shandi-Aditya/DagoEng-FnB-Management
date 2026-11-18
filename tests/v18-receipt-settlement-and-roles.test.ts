import fs from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GET, POST, PUT } from "@/app/api/settings/settlement-receipt/route";
import { buildReportData } from "@/features/reports/reports-domain";
import { getAuditLogs } from "@/lib/persistent-storage";
import { calculateSettlement } from "@/lib/settlement";
import {
  DEFAULT_RECEIPT_ROLE_POLICY,
  canManageSettlementAndReceiptPolicy,
  canRoleReceiveCashierReceipt,
  canRoleReceiveKitchenReceipt,
  getStoredSettlementReceiptPolicy,
  saveStoredSettlementReceiptPolicy,
  settlementBasisLabel,
  validateSettlementReceiptPolicyInput,
} from "@/lib/settlement-receipt-policy";
import type { OrderRecord } from "@/types/order";

function buildOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  const items = overrides.items ?? [
    {
      id: "it-1",
      productName: "Kopi Senja Aren",
      quantity: 2,
      unitPrice: 50000,
      tenantId: "tenant-ks",
    },
  ];
  const subtotal =
    overrides.subtotal ?? items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discount = overrides.discount ?? 0;
  const tax = overrides.tax ?? 0;
  const serviceCharge = overrides.serviceCharge ?? 0;

  return {
    id: overrides.id ?? "ord-v18-1",
    orderNumber: overrides.orderNumber ?? "ORD-V18-001",
    organizationId: "org-dago-hub",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    tableNumber: "T-01",
    customerName: "Tamu Uji",
    orderType: "DINE_IN",
    status: "COMPLETED",
    paymentStatus: "PAID",
    paymentMethod: "QRIS",
    subtotal,
    discount,
    tax,
    serviceCharge,
    total: overrides.total ?? subtotal - discount + tax + serviceCharge,
    targetServiceMinutes: 10,
    createdAt: "2026-11-17T10:00:00.000Z",
    statusHistory: [],
    ...overrides,
    items,
  };
}

describe("Task V-18: Bagi hasil berbasis struk dan distribusi role struk", () => {
  let tempDir = "";
  let prevDataDirOverride: string | undefined;
  let prevDisableDemoLogin: string | undefined;

  beforeEach(() => {
    prevDataDirOverride = process.env.DATA_DIR_OVERRIDE;
    prevDisableDemoLogin = process.env.DISABLE_DEMO_LOGIN;
    delete process.env.DISABLE_DEMO_LOGIN;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "v18-test-"));
    process.env.DATA_DIR_OVERRIDE = tempDir;
  });

  afterEach(() => {
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

  describe("1. Perhitungan bagi hasil berbasis struk dan integrasi laporan", () => {
    const paidReceipt = buildOrder({
      id: "ord-paid",
      subtotal: 100000,
      discount: 10000,
      tax: 9000,
      serviceCharge: 4500,
      total: 103500,
      items: [
        {
          id: "it-ks",
          productName: "Kopi Senja Aren",
          quantity: 2,
          unitPrice: 50000,
          tenantId: "tenant-ks",
        },
      ],
    });

    const unpaidOrder = buildOrder({
      id: "ord-unpaid",
      paymentStatus: "PENDING",
      status: "CONFIRMED",
      items: [
        {
          id: "it-unpaid",
          productName: "Kopi Senja Aren",
          quantity: 1,
          unitPrice: 50000,
          tenantId: "tenant-ks",
        },
      ],
    });

    const cancelledOrder = buildOrder({
      id: "ord-cancelled",
      paymentStatus: "PAID",
      status: "CANCELLED",
      items: [
        {
          id: "it-cancel",
          productName: "Kopi Senja Aren",
          quantity: 1,
          unitPrice: 50000,
          tenantId: "tenant-ks",
        },
      ],
    });

    const refundedOrder = buildOrder({
      id: "ord-refunded",
      paymentStatus: "REFUNDED",
      status: "CANCELLED",
      items: [
        {
          id: "it-refund",
          productName: "Kopi Senja Aren",
          quantity: 1,
          unitPrice: 50000,
          tenantId: "tenant-ks",
        },
      ],
    });

    it("menggunakan struk lunas dengan dasar default RECEIPT_NET_BEFORE_TAX dan mengabaikan unpaid/cancelled/refunded", () => {
      const settlements = calculateSettlement([
        paidReceipt,
        unpaidOrder,
        cancelledOrder,
        refundedOrder,
      ]);

      expect(settlements).toHaveLength(1);
      const ks = settlements[0];
      expect(ks.transactionCount).toBe(1);
      expect(ks.settlementBasis).toBe("RECEIPT_NET_BEFORE_TAX");
      expect(ks.settlementBasisAmount).toBe(90000);
      expect(ks.dpp).toBe(90000);
      expect(ks.tenantShareAmount).toBe(76500);
      expect(ks.dagoShareAmount).toBe(13500);
    });

    it("mengubah nilai bagi hasil secara akurat saat basis diganti ke RECEIPT_GROSS_SUBTOTAL atau RECEIPT_TOTAL_WITH_TAX beserta custom splits", () => {
      const customSplits = {
        "tenant-ks": { tenantSharePercent: 80, dagoSharePercent: 20 },
      };

      const grossSettlement = calculateSettlement([paidReceipt], undefined, customSplits, {
        settlementBasis: "RECEIPT_GROSS_SUBTOTAL",
      });
      expect(grossSettlement[0].settlementBasis).toBe("RECEIPT_GROSS_SUBTOTAL");
      expect(grossSettlement[0].settlementBasisAmount).toBe(100000);
      expect(grossSettlement[0].tenantShareAmount).toBe(80000);
      expect(grossSettlement[0].dagoShareAmount).toBe(20000);

      const totalWithTaxSettlement = calculateSettlement([paidReceipt], undefined, customSplits, {
        settlementBasis: "RECEIPT_TOTAL_WITH_TAX",
      });
      expect(totalWithTaxSettlement[0].settlementBasis).toBe("RECEIPT_TOTAL_WITH_TAX");
      expect(totalWithTaxSettlement[0].settlementBasisAmount).toBe(103500);
      expect(totalWithTaxSettlement[0].tenantShareAmount).toBe(82800);
      expect(totalWithTaxSettlement[0].dagoShareAmount).toBe(20700);
      expect(
        (totalWithTaxSettlement[0].tenantShareAmount ?? 0) +
          (totalWithTaxSettlement[0].dagoShareAmount ?? 0)
      ).toBe(103500);

      const report = buildReportData({
        type: "SETTLEMENT",
        scopeName: "Singaraja",
        orders: [paidReceipt, unpaidOrder, cancelledOrder, refundedOrder],
        products: [],
        shifts: [],
        ingredients: [],
        logs: [],
        settlementBasis: "RECEIPT_TOTAL_WITH_TAX",
        customSplits,
      });

      expect(report.summaryCards[1]).toEqual({ label: "Bagian mitra", value: "Rp 82.800" });
      expect(report.summaryCards[2]).toEqual({ label: "Bagian DAGO", value: "Rp 20.700" });
      expect(report.tableRows[0][3]).toBe("80% Mitra / 20% DAGO");
      expect(report.tableRows[0][6]).toBe("Rp 82.800");
      expect(report.tableRows[0][7]).toBe("Rp 20.700");
      expect(report.reconciliationInfo).toEqual([
        { label: "Dasar bagi hasil", value: settlementBasisLabel("RECEIPT_TOTAL_WITH_TAX") },
      ]);
    });
  });

  describe("2. API /api/settings/settlement-receipt (RBAC, Validasi, Persistensi, Audit)", () => {
    it("menolak permintaan tanpa autentikasi dengan HTTP 401", async () => {
      const getRes = await GET(
        new NextRequest("http://localhost:3000/api/settings/settlement-receipt")
      );
      expect(getRes.status).toBe(401);

      const putRes = await PUT(
        new NextRequest("http://localhost:3000/api/settings/settlement-receipt", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ settlementBasis: "RECEIPT_GROSS_SUBTOTAL" }),
        })
      );
      expect(putRes.status).toBe(401);
    });

    it("mengizinkan Owner organisasi dan Super Admin menyimpan via PUT/POST, bertahan di GET, dan mencatat audit log", async () => {
      const putReq = new NextRequest("http://localhost:3000/api/settings/settlement-receipt", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          cookie: "dagoeng_active_persona=DAGO_OWNER",
        },
        body: JSON.stringify({
          settlementBasis: "RECEIPT_TOTAL_WITH_TAX",
          revenueSplits: {
            "tenant-ks": {
              tenantId: "tenant-ks",
              tenantName: "Kopi Senja",
              tenantSharePercent: 80,
              dagoSharePercent: 20,
              status: "ACTIVE",
            },
          },
          receiptRoles: {
            cashierReceiptRoles: ["OWNER", "CASHIER", "WAITER"],
            kitchenReceiptRoles: ["OWNER", "KITCHEN_STAFF"],
          },
        }),
      });

      const putRes = await PUT(putReq);
      expect(putRes.status).toBe(200);
      const putJson = await putRes.json();
      expect(putJson.success).toBe(true);
      expect(putJson.policy.settlementBasis).toBe("RECEIPT_TOTAL_WITH_TAX");
      expect(putJson.policy.revenueSplits["tenant-ks"].tenantSharePercent).toBe(80);
      expect(putJson.policy.receiptRoles.cashierReceiptRoles).toContain("SUPER_ADMIN");
      expect(putJson.policy.receiptRoles.cashierReceiptRoles).toContain("WAITER");
      expect(putJson.policy.receiptRoles.kitchenReceiptRoles).toContain("SUPER_ADMIN");
      expect(putJson.policy.receiptRoles.kitchenReceiptRoles).not.toContain("WAITER");

      const postReq = new NextRequest("http://localhost:3000/api/settings/settlement-receipt", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "dagoeng_active_persona=SUPER_ADMIN",
        },
        body: JSON.stringify({
          settlementBasis: "RECEIPT_GROSS_SUBTOTAL",
        }),
      });
      const postRes = await POST(postReq);
      expect(postRes.status).toBe(200);
      const postJson = await postRes.json();
      expect(postJson.policy.settlementBasis).toBe("RECEIPT_GROSS_SUBTOTAL");
      expect(postJson.policy.revenueSplits["tenant-ks"].tenantSharePercent).toBe(80);

      const getRes = await GET(
        new NextRequest("http://localhost:3000/api/settings/settlement-receipt", {
          headers: { cookie: "dagoeng_active_persona=CASHIER_SGR" },
        })
      );
      expect(getRes.status).toBe(200);
      const getJson = await getRes.json();
      expect(getJson.policy.settlementBasis).toBe("RECEIPT_GROSS_SUBTOTAL");
      expect(getJson.policy.receiptRoles.cashierReceiptRoles).toContain("WAITER");

      const logs = await getAuditLogs();
      const policyLogs = logs.filter(
        (l) => l.module === "SETTINGS" && l.action === "SETTLEMENT_RECEIPT_POLICY_UPDATED"
      );
      expect(policyLogs.length).toBeGreaterThanOrEqual(2);
      expect(policyLogs[0].recordId).toBe("cfg-settlement-receipt");
    });

    it("menolak CASHIER, KITCHEN_STAFF, WAITER, MANAGER, dan Owner tenant dengan HTTP 403", async () => {
      const disallowedPersonas = [
        "CASHIER_SGR",
        "KITCHEN_SGR",
        "WAITER_SGR",
        "TENANT_OWNER_KS",
        "COWORK_MANAGER",
      ];

      for (const persona of disallowedPersonas) {
        const res = await PUT(
          new NextRequest("http://localhost:3000/api/settings/settlement-receipt", {
            method: "PUT",
            headers: {
              "content-type": "application/json",
              cookie: `dagoeng_active_persona=${persona}`,
            },
            body: JSON.stringify({ settlementBasis: "RECEIPT_GROSS_SUBTOTAL" }),
          })
        );
        expect(res.status, `persona ${persona} harus ditolak 403`).toBe(403);
      }
    });

    it("menolak persentase tidak valid (>100 atau jumlah != 100) dengan HTTP 400 tanpa merusak kebijakan tersimpan", async () => {
      const over100Res = await PUT(
        new NextRequest("http://localhost:3000/api/settings/settlement-receipt", {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=DAGO_OWNER",
          },
          body: JSON.stringify({
            revenueSplits: {
              "tenant-ks": { tenantSharePercent: 110, dagoSharePercent: -10 },
            },
          }),
        })
      );
      expect(over100Res.status).toBe(400);

      const mismatchSumRes = await PUT(
        new NextRequest("http://localhost:3000/api/settings/settlement-receipt", {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=DAGO_OWNER",
          },
          body: JSON.stringify({
            revenueSplits: {
              "tenant-ks": { tenantSharePercent: 75, dagoSharePercent: 15 },
            },
          }),
        })
      );
      expect(mismatchSumRes.status).toBe(400);

      const getAfter = await GET(
        new NextRequest("http://localhost:3000/api/settings/settlement-receipt", {
          headers: { cookie: "dagoeng_active_persona=DAGO_OWNER" },
        })
      );
      const jsonAfter = await getAfter.json();
      expect(jsonAfter.policy.revenueSplits["tenant-ks"].tenantSharePercent).toBe(85);
    });
  });

  describe("3. Pengaturan dan distribusi role struk kasir dan nota dapur", () => {
    it("menjaga default akses struk kasir dan nota dapur per role", () => {
      expect(canRoleReceiveCashierReceipt("SUPER_ADMIN", DEFAULT_RECEIPT_ROLE_POLICY)).toBe(true);
      expect(canRoleReceiveCashierReceipt("OWNER", DEFAULT_RECEIPT_ROLE_POLICY)).toBe(true);
      expect(canRoleReceiveCashierReceipt("MANAGER", DEFAULT_RECEIPT_ROLE_POLICY)).toBe(true);
      expect(canRoleReceiveCashierReceipt("CASHIER", DEFAULT_RECEIPT_ROLE_POLICY)).toBe(true);
      expect(canRoleReceiveCashierReceipt("KITCHEN_STAFF", DEFAULT_RECEIPT_ROLE_POLICY)).toBe(false);
      expect(canRoleReceiveCashierReceipt("WAITER", DEFAULT_RECEIPT_ROLE_POLICY)).toBe(false);
      expect(canRoleReceiveCashierReceipt("CUSTOMER", DEFAULT_RECEIPT_ROLE_POLICY)).toBe(false);

      expect(canRoleReceiveKitchenReceipt("KITCHEN_STAFF", DEFAULT_RECEIPT_ROLE_POLICY)).toBe(true);
      expect(canRoleReceiveKitchenReceipt("WAITER", DEFAULT_RECEIPT_ROLE_POLICY)).toBe(true);
      expect(canRoleReceiveKitchenReceipt("CASHIER", DEFAULT_RECEIPT_ROLE_POLICY)).toBe(true);
      expect(canRoleReceiveKitchenReceipt("CUSTOMER", DEFAULT_RECEIPT_ROLE_POLICY)).toBe(false);
    });

    it("mengizinkan Owner mengubah akses role secara dinamis sambil selalu mempertahankan SUPER_ADMIN", () => {
      const validation = validateSettlementReceiptPolicyInput({
        receiptRoles: {
          cashierReceiptRoles: ["OWNER", "CASHIER", "WAITER"],
          kitchenReceiptRoles: ["KITCHEN_STAFF", "WAITER"],
        },
      });
      expect(validation.valid).toBe(true);
      if (!validation.valid) return;

      const updatedRoles = validation.policy.receiptRoles;
      expect(canRoleReceiveCashierReceipt("SUPER_ADMIN", updatedRoles)).toBe(true);
      expect(canRoleReceiveCashierReceipt("WAITER", updatedRoles)).toBe(true);
      expect(canRoleReceiveCashierReceipt("MANAGER", updatedRoles)).toBe(false);
      expect(canRoleReceiveKitchenReceipt("SUPER_ADMIN", updatedRoles)).toBe(true);
      expect(canRoleReceiveKitchenReceipt("MANAGER", updatedRoles)).toBe(false);
      expect(canRoleReceiveKitchenReceipt("KITCHEN_STAFF", updatedRoles)).toBe(true);

      expect(canManageSettlementAndReceiptPolicy({ role: "SUPER_ADMIN", scopeLevel: "PLATFORM" })).toBe(true);
      expect(canManageSettlementAndReceiptPolicy({ role: "OWNER", scopeLevel: "ORGANIZATION" })).toBe(true);
      expect(canManageSettlementAndReceiptPolicy({ role: "OWNER", scopeLevel: "TENANT" })).toBe(false);
      expect(canManageSettlementAndReceiptPolicy({ role: "MANAGER", scopeLevel: "ORGANIZATION" })).toBe(false);
      expect(canManageSettlementAndReceiptPolicy({ role: "CASHIER", scopeLevel: "OUTLET" })).toBe(false);
    });

    it("menyinkronkan kebijakan ke penyimpanan lokal browser ketika localStorage tersedia", () => {
      const store = new Map<string, string>();
      const listeners = new Map<string, number>();
      const prevWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

      try {
        Object.defineProperty(globalThis, "window", {
          configurable: true,
          value: {
            localStorage: {
              getItem: (k: string) => store.get(k) ?? null,
              setItem: (k: string, v: string) => {
                store.set(k, v);
              },
              removeItem: (k: string) => {
                store.delete(k);
              },
            },
            dispatchEvent: (ev: Event) => {
              listeners.set(ev.type, (listeners.get(ev.type) ?? 0) + 1);
              return true;
            },
          },
        });

        saveStoredSettlementReceiptPolicy({
          settlementBasis: "RECEIPT_GROSS_SUBTOTAL",
          receiptRoles: {
            cashierReceiptRoles: ["OWNER", "CASHIER", "WAITER"],
            kitchenReceiptRoles: ["OWNER", "KITCHEN_STAFF"],
          },
        });

        const stored = getStoredSettlementReceiptPolicy();
        expect(stored.settlementBasis).toBe("RECEIPT_GROSS_SUBTOTAL");
        expect(canRoleReceiveCashierReceipt("WAITER", stored.receiptRoles)).toBe(true);
        expect(canRoleReceiveKitchenReceipt("WAITER", stored.receiptRoles)).toBe(false);
        expect(listeners.get("settlement_receipt_policy_updated")).toBe(1);
      } finally {
        if (!prevWindowDescriptor) {
          delete (globalThis as { window?: unknown }).window;
        } else {
          Object.defineProperty(globalThis, "window", prevWindowDescriptor);
        }
      }
    });
  });
});
