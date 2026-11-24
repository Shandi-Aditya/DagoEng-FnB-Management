import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import * as serverAuth from "@/lib/server-auth";
import {
  GET as getLoyaltyMembers,
  POST as postLoyaltyMembers,
  PUT as putLoyaltyMembers,
} from "@/app/api/loyalty/members/route";
import { GET as getEmployees } from "@/app/api/employees/route";
import { GET as getClosingPdf } from "@/app/api/reports/closing/pdf/route";
import { POST as postTenantOperations } from "@/app/api/tenant/operations/route";
import { GET as getProducts } from "@/app/api/products/route";
import { GET as getSettlementReceipt } from "@/app/api/settings/settlement-receipt/route";
import { POST as postWhatsApp } from "@/app/api/notifications/whatsapp/route";
import { GET as getSyncDomain, POST as postSyncDomain } from "@/app/api/sync/[domain]/route";
import { GET as getQrisVerify } from "@/app/api/pos/qris/verify/route";
import { POST as postEventsUpload } from "@/app/api/events/upload/route";
import { PATCH as patchTenantProductToggle } from "@/app/api/tenant/products/[id]/toggle/route";
import { writePersistentData } from "@/lib/persistent-storage";
import { INITIAL_MEMBERS, INITIAL_EMPLOYEES, INITIAL_PRODUCTS } from "@/lib/master-data-defaults";
import type { RoleSlug } from "@/types/auth";

describe("S-32: Tutup kebocoran data member dan audit endpoint publik", () => {
  let tempDir = "";
  let prevDataDirOverride: string | undefined;

  beforeEach(async () => {
    prevDataDirOverride = process.env.DATA_DIR_OVERRIDE;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "s32-audit-"));
    process.env.DATA_DIR_OVERRIDE = tempDir;

    await writePersistentData("loyalty_members.json", INITIAL_MEMBERS);
    await writePersistentData("employees.json", INITIAL_EMPLOYEES);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (prevDataDirOverride === undefined) {
      delete process.env.DATA_DIR_OVERRIDE;
    } else {
      process.env.DATA_DIR_OVERRIDE = prevDataDirOverride;
    }
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("1. /api/loyalty/members Authentication and Role Security", () => {
    it("returns HTTP 401 when accessed without authentication", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: false,
        role: null,
        userId: null,
        scopeLevel: null,
        permissions: [],
      });

      const req = new NextRequest("http://localhost:3000/api/loyalty/members");
      const res = await getLoyaltyMembers(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Akses ditolak");
    });

    it("returns HTTP 403 when accessed by unauthorized staff role (WAITER, KITCHEN_STAFF)", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "user-waiter",
        name: "Waiter Test",
        role: "WAITER" as RoleSlug,
        scopeLevel: "OUTLET",
      });

      const req = new NextRequest("http://localhost:3000/api/loyalty/members");
      const res = await getLoyaltyMembers(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Akses ditolak: Role [WAITER]");
    });

    it("allows CUSTOMER to view ONLY their own member record and strips identityNo", async () => {
      // Ketut Dian has email ketut.dian@kopisenja.com or ketut.dian@gmail.com
      const ketut = INITIAL_MEMBERS.find((m) => m.name === "Ketut Dian");
      expect(ketut).toBeDefined();

      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "cust-ketut",
        email: ketut!.email,
        name: "Ketut Dian",
        role: "CUSTOMER" as RoleSlug,
        scopeLevel: "OUTLET",
      });

      const req = new NextRequest("http://localhost:3000/api/loyalty/members");
      const res = await getLoyaltyMembers(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.members)).toBe(true);
      expect(json.members).toHaveLength(1);
      expect(json.members[0].name).toBe("Ketut Dian");
      expect(json.members[0].identityNo).toBe("");
    });

    it("returns empty array for CUSTOMER whose email/userId does not match any member", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "cust-unknown",
        email: "unknown.stranger@example.com",
        name: "Unknown Stranger",
        role: "CUSTOMER" as RoleSlug,
        scopeLevel: "OUTLET",
      });

      const req = new NextRequest("http://localhost:3000/api/loyalty/members");
      const res = await getLoyaltyMembers(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.members).toHaveLength(0);
    });

    it("allows CASHIER to view members with masked contacts", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "user-cashier",
        name: "Kasir Test",
        role: "CASHIER" as RoleSlug,
        scopeLevel: "OUTLET",
      });

      const req = new NextRequest("http://localhost:3000/api/loyalty/members");
      const res = await getLoyaltyMembers(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.members.length).toBeGreaterThan(1);
      for (const m of json.members) {
        if (m.phone) {
          expect(m.phone).toContain("****");
        }
        expect(m.identityNo).toBe("");
      }
    });

    it("allows MANAGER to view full unmasked member contacts", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "user-manager",
        name: "Manager Test",
        role: "MANAGER" as RoleSlug,
        scopeLevel: "OUTLET",
      });

      const req = new NextRequest("http://localhost:3000/api/loyalty/members");
      const res = await getLoyaltyMembers(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      const ketut = json.members.find((m: any) => m.name === "Ketut Dian");
      expect(ketut).toBeDefined();
      expect(ketut.phone).not.toContain("****");
    });
  });

  describe("2. /api/employees Authentication and Privacy Guard", () => {
    it("returns HTTP 401 when accessed without login", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: false,
        role: null,
        userId: null,
        scopeLevel: null,
        permissions: [],
      });

      const req = new NextRequest("http://localhost:3000/api/employees");
      const res = await getEmployees(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Akses ditolak");
    });

    it("returns HTTP 403 when accessed by CUSTOMER", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "cust-1",
        role: "CUSTOMER" as RoleSlug,
        scopeLevel: "OUTLET",
      });

      const req = new NextRequest("http://localhost:3000/api/employees");
      const res = await getEmployees(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Akses ditolak: Role [CUSTOMER]");
    });

    it("masks contacts for non-managerial staff (CASHIER)", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "user-cashier",
        role: "CASHIER" as RoleSlug,
        scopeLevel: "OUTLET",
      });

      const req = new NextRequest("http://localhost:3000/api/employees");
      const res = await getEmployees(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.employees.length).toBeGreaterThan(0);
      for (const emp of json.employees) {
        if (emp.contact && emp.contact.length >= 8) {
          expect(emp.contact).toContain("****");
        }
      }
    });

    it("allows full unmasked view for MANAGER", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "user-mgr",
        role: "MANAGER" as RoleSlug,
        scopeLevel: "OUTLET",
      });

      const req = new NextRequest("http://localhost:3000/api/employees");
      const res = await getEmployees(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      const putu = json.employees.find((e: any) => e.name === "Putu Arya");
      expect(putu).toBeDefined();
      expect(putu.contact).not.toContain("****");
    });

    it("allows INVENTORY_STAFF to read employees list", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "user-inv",
        role: "INVENTORY_STAFF" as RoleSlug,
        scopeLevel: "OUTLET",
      });

      const req = new NextRequest("http://localhost:3000/api/employees");
      const res = await getEmployees(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  describe("3. Other Sensitive Endpoints Audit Verification", () => {
    it("protects /api/reports/closing/pdf with HTTP 401 when not logged in", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: false,
        role: null,
        userId: null,
        scopeLevel: null,
        permissions: [],
      });

      const req = new NextRequest("http://localhost:3000/api/reports/closing/pdf?gross=500000");
      const res = await getClosingPdf(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("protects /api/reports/closing/pdf against unauthorized roles (CUSTOMER) with HTTP 403", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "cust-1",
        role: "CUSTOMER" as RoleSlug,
        scopeLevel: "OUTLET",
      });

      const req = new NextRequest("http://localhost:3000/api/reports/closing/pdf?gross=500000");
      const res = await getClosingPdf(req);
      expect(res.status).toBe(403);
    });

    it("sanitizes HTML in /api/reports/closing/pdf against reflected XSS", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "user-mgr",
        role: "MANAGER" as RoleSlug,
        scopeLevel: "OUTLET",
      });

      const maliciousNote = "<script>alert('xss')</script>";
      const req = new NextRequest(`http://localhost:3000/api/reports/closing/pdf?gross=500000&notes=${encodeURIComponent(maliciousNote)}`);
      const res = await getClosingPdf(req);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).not.toContain("<script>alert('xss')</script>");
      expect(html).toContain("&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;");
    });

    it("protects POST /api/tenant/operations with HTTP 401 when not logged in", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: false,
        role: null,
        userId: null,
        scopeLevel: null,
        permissions: [],
      });

      const req = new NextRequest("http://localhost:3000/api/tenant/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: "tenant-ks", updates: { isOpenOrder: false } }),
      });
      const res = await postTenantOperations(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("protects POST /api/tenant/operations against cross-tenant modification with HTTP 403", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "owner-ks",
        role: "OWNER" as RoleSlug,
        scopeLevel: "TENANT",
        tenantId: "tenant-ks",
      });

      // Tenant KS attempts to modify Tenant Kitchen
      const req = new NextRequest("http://localhost:3000/api/tenant/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: "tenant-kitchen", updates: { isOpenOrder: false } }),
      });
      const res = await postTenantOperations(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Akses ditolak");
    });

    it("protects GET /api/settings/settlement-receipt with HTTP 401 unauthenticated and HTTP 403 for CUSTOMER", async () => {
      // 401 Unauthenticated
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: false,
        role: null,
        userId: null,
        scopeLevel: null,
        permissions: [],
      });
      const req1 = new NextRequest("http://localhost:3000/api/settings/settlement-receipt");
      const res1 = await getSettlementReceipt(req1);
      expect(res1.status).toBe(401);

      // 403 CUSTOMER
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "cust-1",
        role: "CUSTOMER" as RoleSlug,
        scopeLevel: "OUTLET",
      });
      const req2 = new NextRequest("http://localhost:3000/api/settings/settlement-receipt");
      const res2 = await getSettlementReceipt(req2);
      expect(res2.status).toBe(403);
    });

    it("masks cogsEstimate and grossMarginPercent on GET /api/products for unauthenticated callers and customers", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: false,
        role: null,
        userId: null,
        scopeLevel: null,
        permissions: [],
      });

      const req = new NextRequest("http://localhost:3000/api/products");
      const res = await getProducts(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.products.length).toBeGreaterThan(0);
      for (const prod of json.products) {
        expect(prod.cogsEstimate).toBe(0);
        expect(prod.grossMarginPercent).toBe("0%");
      }
    });

    it("allows Tenant Owner to view unmasked COGS for their own products", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "owner-ks",
        role: "OWNER" as RoleSlug,
        scopeLevel: "TENANT",
        tenantId: "tenant-ks",
      });

      const req = new NextRequest("http://localhost:3000/api/products");
      const res = await getProducts(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      const ownProduct = json.products.find((p: any) => p.tenantId === "tenant-ks");
      if (ownProduct && ownProduct.basePrice > 0) {
        expect(ownProduct.grossMarginPercent).not.toBe("0%");
      }
    });

    it("permits CASHIER to read settlement receipt policy with masked revenueSplits", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "cashier-1",
        role: "CASHIER" as RoleSlug,
        scopeLevel: "OUTLET",
      });

      const req = new NextRequest("http://localhost:3000/api/settings/settlement-receipt");
      const res = await getSettlementReceipt(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.policy).toBeDefined();
      expect(json.policy.revenueSplits).toEqual({});
    });
  });

  describe("6. Mutasi dan Endpoint Tambahan S-32 (WhatsApp, Sync Wifi, QRIS, Injeksi Poin)", () => {
    it("menolak POST /api/notifications/whatsapp tanpa autentikasi dengan HTTP 401 dan CUSTOMER dengan 403", async () => {
      // 401 unauth
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: false,
        role: null,
        userId: null,
        scopeLevel: null,
        permissions: [],
      });

      const req1 = new NextRequest("http://localhost:3000/api/notifications/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Halo test" }),
      });
      const res1 = await postWhatsApp(req1);
      expect(res1.status).toBe(401);

      // 403 CUSTOMER
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "cust-1",
        role: "CUSTOMER" as RoleSlug,
        scopeLevel: "OUTLET",
      });

      const req2 = new NextRequest("http://localhost:3000/api/notifications/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Halo test" }),
      });
      const res2 = await postWhatsApp(req2);
      expect(res2.status).toBe(403);
    });

    it("menolak GET /api/sync/wifi tanpa autentikasi dengan HTTP 401 dan CUSTOMER dengan 403", async () => {
      // 401 unauth
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: false,
        role: null,
        userId: null,
        scopeLevel: null,
        permissions: [],
      });

      const req1 = new NextRequest("http://localhost:3000/api/sync/wifi");
      const res1 = await getSyncDomain(req1, { params: Promise.resolve({ domain: "wifi" }) });
      expect(res1.status).toBe(401);

      // 403 CUSTOMER
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "cust-1",
        role: "CUSTOMER" as RoleSlug,
        scopeLevel: "OUTLET",
      });

      const req2 = new NextRequest("http://localhost:3000/api/sync/wifi");
      const res2 = await getSyncDomain(req2, { params: Promise.resolve({ domain: "wifi" }) });
      expect(res2.status).toBe(403);

      // 200 CASHIER
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "cashier-1",
        role: "CASHIER" as RoleSlug,
        scopeLevel: "OUTLET",
      });

      const req3 = new NextRequest("http://localhost:3000/api/sync/wifi");
      const res3 = await getSyncDomain(req3, { params: Promise.resolve({ domain: "wifi" }) });
      expect(res3.status).toBe(200);
    });

    it("menolak GET /api/pos/qris/verify untuk role CUSTOMER dengan HTTP 403", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "cust-1",
        role: "CUSTOMER" as RoleSlug,
        scopeLevel: "OUTLET",
      });

      const req = new NextRequest("http://localhost:3000/api/pos/qris/verify?invoiceNumber=INV-123");
      const res = await getQrisVerify(req);
      expect(res.status).toBe(403);
    });

    it("menolak injeksi poin sembarang oleh CASHIER pada PUT /api/loyalty/members dengan HTTP 403", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "cashier-1",
        name: "Kasir Test",
        role: "CASHIER" as RoleSlug,
        scopeLevel: "OUTLET",
      });

      const targetMember = INITIAL_MEMBERS[0];
      const req = new NextRequest("http://localhost:3000/api/loyalty/members", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: targetMember.id,
          updates: {
            points: 99999,
          },
        }),
      });

      const res = await putLoyaltyMembers(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Akses ditolak");
    });

    it("menolak injeksi poin ADJUSTMENT oleh CASHIER dan mengizinkan hanya rev- order CANCELLED/REFUNDED yang sah (HTTP 403)", async () => {
      await writePersistentData("pos_orders.json", [
        {
          id: "ord-paid-active",
          orderNumber: "ORD-ACTIVE-01",
          total: 50000,
          paymentStatus: "PAID",
          status: "COMPLETED",
          createdAt: new Date().toISOString(),
        },
        {
          id: "ord-refunded-01",
          orderNumber: "ORD-REFUND-01",
          total: 30000,
          paymentStatus: "REFUNDED",
          status: "CANCELLED",
          createdAt: new Date().toISOString(),
        },
      ]);

      const seededMembers = INITIAL_MEMBERS.map((m) =>
        m.id === "mem-001"
          ? {
              ...m,
              points: 85,
              pointHistory: [
                {
                  id: "ptx-earn-ref-1",
                  memberId: "mem-001",
                  type: "EARN" as const,
                  points: 30,
                  balanceAfter: 85,
                  reason: "Order Refundable",
                  relatedTransactionId: "ord-refunded-01",
                  timestamp: "2026-11-20T09:00:00.000Z",
                  actorName: "Kasir Test",
                  outletId: "outlet-sgr",
                },
                ...m.pointHistory,
              ],
            }
          : m
      );
      await writePersistentData("loyalty_members.json", seededMembers);
      const baseHistory = seededMembers.find((m) => m.id === "mem-001")!.pointHistory;

      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "cashier-1",
        name: "Kasir Test",
        role: "CASHIER" as RoleSlug,
        scopeLevel: "OUTLET",
      });

      // 1. Forged ADJUSTMENT without rev- prefix -> 403
      const forgedAdjRes = await putLoyaltyMembers(
        new NextRequest("http://localhost:3000/api/loyalty/members", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: "mem-001",
            updates: {
              points: 585,
              pointHistory: [
                {
                  id: "ptx-adj-forge",
                  memberId: "mem-001",
                  type: "ADJUSTMENT",
                  points: 500,
                  relatedTransactionId: "ord-paid-active",
                  timestamp: new Date().toISOString(),
                },
                ...baseHistory,
              ],
            },
          }),
        })
      );
      expect(forgedAdjRes.status).toBe(403);

      // 2. rev- ADJUSTMENT pointing to non-cancelled/non-refunded order -> 403
      const activeRevRes = await putLoyaltyMembers(
        new NextRequest("http://localhost:3000/api/loyalty/members", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: "mem-001",
            updates: {
              points: 35,
              pointHistory: [
                {
                  id: "ptx-adj-active",
                  memberId: "mem-001",
                  type: "ADJUSTMENT",
                  points: -50,
                  relatedTransactionId: "rev-ord-paid-active",
                  timestamp: new Date().toISOString(),
                },
                ...baseHistory,
              ],
            },
          }),
        })
      );
      expect(activeRevRes.status).toBe(403);

      // 3. Positive or mismatched ADJUSTMENT on refunded order -> 403
      const wrongDeltaRevRes = await putLoyaltyMembers(
        new NextRequest("http://localhost:3000/api/loyalty/members", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: "mem-001",
            updates: {
              points: 115,
              pointHistory: [
                {
                  id: "ptx-adj-wrong",
                  memberId: "mem-001",
                  type: "ADJUSTMENT",
                  points: 30,
                  relatedTransactionId: "rev-ord-refunded-01",
                  timestamp: new Date().toISOString(),
                },
                ...baseHistory,
              ],
            },
          }),
        })
      );
      expect(wrongDeltaRevRes.status).toBe(403);

      // 4. Legitimate rev- ADJUSTMENT matching CANCELLED/REFUNDED order & -priorEarn.points -> 200
      const validRevEntry = {
        id: "ptx-adj-valid",
        memberId: "mem-001",
        type: "ADJUSTMENT" as const,
        points: -30,
        relatedTransactionId: "rev-ord-refunded-01",
        timestamp: "2026-11-20T10:00:00.000Z",
      };
      const validRevRes = await putLoyaltyMembers(
        new NextRequest("http://localhost:3000/api/loyalty/members", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: "mem-001",
            updates: {
              points: 55,
              pointHistory: [validRevEntry, ...baseHistory],
            },
          }),
        })
      );
      expect(validRevRes.status).toBe(200);
      const validRevJson = await validRevRes.json();
      expect(validRevJson.member.points).toBe(55);

      // 5. Replaying the same rev- ADJUSTMENT a second time -> 403
      const replayRevRes = await putLoyaltyMembers(
        new NextRequest("http://localhost:3000/api/loyalty/members", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: "mem-001",
            updates: {
              points: 25,
              pointHistory: [
                { ...validRevEntry, id: "ptx-adj-replay" },
                validRevEntry,
                ...baseHistory,
              ],
            },
          }),
        })
      );
      expect(replayRevRes.status).toBe(403);
    });

    it("menolak replay relatedTransactionId serta manipulasi suffix pointHistory oleh CASHIER dengan HTTP 403", async () => {
      await writePersistentData("pos_orders.json", [
        {
          id: "ord-replay-01",
          orderNumber: "ORD-REPLAY-01",
          total: 100000,
          paymentStatus: "PAID",
          status: "COMPLETED",
          createdAt: new Date().toISOString(),
        },
      ]);
      await writePersistentData("coworking_bookings.json", [
        {
          id: "cwb-paid-01",
          bookingCode: "CW-SGR-9001",
          guestName: "Ketut Dian",
          guestPhone: "+62 819-1122-3344",
          guestEmail: "ketut.dian@gmail.com",
          spaceId: "sp-hot-1",
          spaceName: "Hot Desk",
          spaceType: "HOT_DESK",
          bookingType: "HOURLY",
          date: "2026-11-24",
          startTime: "10:00",
          duration: 2,
          totalAmount: 60000,
          paymentStatus: "PAID",
          checkInStatus: "CHECKED_IN",
        },
      ]);

      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "cashier-1",
        name: "Kasir Test",
        role: "CASHIER" as RoleSlug,
        scopeLevel: "OUTLET",
      });

      const baseHistory = INITIAL_MEMBERS.find((m) => m.id === "mem-001")!.pointHistory;
      const firstEarnEntry = {
        id: "ptx-earn-ord-1",
        memberId: "mem-001",
        type: "EARN" as const,
        points: 100,
        relatedTransactionId: "ord-replay-01",
        timestamp: "2026-11-24T10:00:00.000Z",
      };

      // First EARN from PAID order -> 200
      const firstRes = await putLoyaltyMembers(
        new NextRequest("http://localhost:3000/api/loyalty/members", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: "mem-001",
            updates: {
              points: 155,
              pointHistory: [firstEarnEntry, ...baseHistory],
            },
          }),
        })
      );
      expect(firstRes.status).toBe(200);

      // Replay same (EARN, ord-replay-01) -> 403
      const replayRes = await putLoyaltyMembers(
        new NextRequest("http://localhost:3000/api/loyalty/members", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: "mem-001",
            updates: {
              points: 255,
              pointHistory: [
                { ...firstEarnEntry, id: "ptx-earn-ord-2" },
                firstEarnEntry,
                ...baseHistory,
              ],
            },
          }),
        })
      );
      expect(replayRes.status).toBe(403);

      // Coworking PAID booking EARN -> 200, then replay -> 403
      const cwEarnEntry = {
        id: "ptx-earn-cwb-1",
        memberId: "mem-001",
        type: "EARN" as const,
        points: 60,
        relatedTransactionId: "cwb-paid-01",
        timestamp: "2026-11-24T10:05:00.000Z",
      };
      const cwRes = await putLoyaltyMembers(
        new NextRequest("http://localhost:3000/api/loyalty/members", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: "mem-001",
            updates: {
              points: 215,
              pointHistory: [cwEarnEntry, firstEarnEntry, ...baseHistory],
            },
          }),
        })
      );
      expect(cwRes.status).toBe(200);

      // Tampering existing suffix entry -> 403
      const tamperedSuffixRes = await putLoyaltyMembers(
        new NextRequest("http://localhost:3000/api/loyalty/members", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: "mem-001",
            updates: {
              points: 215,
              pointHistory: [
                cwEarnEntry,
                { ...firstEarnEntry, relatedTransactionId: "ord-tampered" },
                ...baseHistory,
              ],
            },
          }),
        })
      );
      expect(tamperedSuffixRes.status).toBe(403);
    });

    it("menyaring reservations dan field sensitif meja pada GET /api/sync/tables untuk anonim dan CUSTOMER", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "mgr-1",
        role: "MANAGER" as RoleSlug,
        scopeLevel: "OUTLET",
      });

      await postSyncDomain(
        new NextRequest("http://localhost:3000/api/sync/tables", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            command: {
              op: "PATCH_TABLE_STATUS",
              tableId: "T-01",
              status: "OCCUPIED",
              customer: "Pelanggan Rahasia",
              total: "Rp 225.000",
              currentBillTotal: 225000,
              activeOrderId: "ord-secret-tbl-1",
            },
          }),
        }),
        { params: Promise.resolve({ domain: "tables" }) }
      );

      await postSyncDomain(
        new NextRequest("http://localhost:3000/api/sync/tables", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            command: {
              op: "UPSERT_RESERVATION",
              reservation: {
                id: "res-secret-1",
                customerName: "Tamu Reservasi VIP",
                phone: "+62 812-0000-1111",
                tableId: "T-02",
                areaName: "Indoor AC Main Hall",
                outletId: "outlet-sgr",
                outletName: "Singaraja",
                dateTime: "2026-12-01T19:00:00.000Z",
                pax: 4,
                downPayment: 100000,
                status: "CONFIRMED",
              },
            },
          }),
        }),
        { params: Promise.resolve({ domain: "tables" }) }
      );

      // Anonymous GET
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: false,
        role: null,
        userId: null,
        scopeLevel: null,
        permissions: [],
      });
      const anonRes = await getSyncDomain(
        new NextRequest("http://localhost:3000/api/sync/tables"),
        { params: Promise.resolve({ domain: "tables" }) }
      );
      expect(anonRes.status).toBe(200);
      const anonJson = await anonRes.json();
      expect(anonJson.state.reservations).toEqual([]);
      const anonTable = anonJson.state.areas
        .flatMap((a: { tables: Array<Record<string, unknown>> }) => a.tables)
        .find((t: Record<string, unknown>) => t.id === "T-01");
      expect(anonTable?.status).toBe("OCCUPIED");
      expect(anonTable?.customer).toBeUndefined();
      expect(anonTable?.total).toBeUndefined();
      expect(anonTable?.currentBillTotal).toBeUndefined();
      expect(anonTable?.activeOrderId).toBeUndefined();

      // CUSTOMER GET
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "cust-1",
        role: "CUSTOMER" as RoleSlug,
        scopeLevel: "OUTLET",
      });
      const custRes = await getSyncDomain(
        new NextRequest("http://localhost:3000/api/sync/tables"),
        { params: Promise.resolve({ domain: "tables" }) }
      );
      expect(custRes.status).toBe(200);
      const custJson = await custRes.json();
      expect(custJson.state.reservations).toEqual([]);
      const custTable = custJson.state.areas
        .flatMap((a: { tables: Array<Record<string, unknown>> }) => a.tables)
        .find((t: Record<string, unknown>) => t.id === "T-01");
      expect(custTable?.customer).toBeUndefined();
      expect(custTable?.total).toBeUndefined();
      expect(custTable?.currentBillTotal).toBeUndefined();
      expect(custTable?.activeOrderId).toBeUndefined();
    });

    it("menyaring currentSession pada GET /api/sync/coworking-master untuk anonim dan CUSTOMER", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "mgr-1",
        role: "MANAGER" as RoleSlug,
        scopeLevel: "OUTLET",
      });

      await postSyncDomain(
        new NextRequest("http://localhost:3000/api/sync/coworking-master", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            command: {
              op: "PATCH_SPACE_SESSION",
              spaceId: "sp-ded-1",
              status: "OCCUPIED",
              currentSession: {
                guestName: "Pengguna Rahasia",
                company: "PT Rahasia Nusantara",
                checkInTime: "09:00",
                endTime: "17:00",
                bookingCode: "CW-SECRET-01",
              },
            },
          }),
        }),
        { params: Promise.resolve({ domain: "coworking-master" }) }
      );

      for (const caller of [
        {
          isAuthenticated: false,
          role: null,
          userId: null,
          scopeLevel: null,
          permissions: [],
        },
        {
          isAuthenticated: true,
          userId: "cust-1",
          role: "CUSTOMER" as RoleSlug,
          scopeLevel: "OUTLET" as const,
        },
      ]) {
        vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue(caller);
        const res = await getSyncDomain(
          new NextRequest("http://localhost:3000/api/sync/coworking-master"),
          { params: Promise.resolve({ domain: "coworking-master" }) }
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.state.members).toEqual([]);
        expect(json.state.checkLogs).toEqual([]);
        const space = json.state.spaces.find((s: { id: string }) => s.id === "sp-ded-1");
        expect(space?.status).toBe("OCCUPIED");
        expect(space?.currentSession).toBeUndefined();
      }
    });

    it("menolak POST /api/events/upload tanpa login dengan HTTP 401 dan CHECKIN_STAFF atau CASHIER dengan HTTP 403", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: false,
        role: null,
        userId: null,
        scopeLevel: null,
        permissions: [],
      });
      const unauthRes = await postEventsUpload(
        new NextRequest("http://localhost:3000/api/events/upload", { method: "POST" })
      );
      expect(unauthRes.status).toBe(401);

      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "checkin-1",
        email: "checkin@dagocreative.id",
        role: "CHECKIN_STAFF" as RoleSlug,
        scopeLevel: "OUTLET",
      });
      const checkinRes = await postEventsUpload(
        new NextRequest("http://localhost:3000/api/events/upload", { method: "POST" })
      );
      expect(checkinRes.status).toBe(403);

      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "cashier-1",
        role: "CASHIER" as RoleSlug,
        scopeLevel: "OUTLET",
      });
      const cashierRes = await postEventsUpload(
        new NextRequest("http://localhost:3000/api/events/upload", { method: "POST" })
      );
      expect(cashierRes.status).toBe(403);
    });

    it("menegakkan isolasi kepemilikan tenant pada PATCH /api/tenant/products/[id]/toggle dengan HTTP 403", async () => {
      await writePersistentData("master_products.json", {
        products: INITIAL_PRODUCTS,
        customCategories: [],
      });

      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "owner-ks",
        role: "OWNER" as RoleSlug,
        scopeLevel: "TENANT",
        tenantId: "tenant-ks",
      });

      // Missing tenantId -> 403
      const missingRes = await patchTenantProductToggle(
        new NextRequest("http://localhost:3000/api/tenant/products/prod-101/toggle", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isAvailable: false }),
        }),
        { params: Promise.resolve({ id: "prod-101" }) }
      );
      expect(missingRes.status).toBe(403);

      // Mismatched body.tenantId -> 403
      const crossBodyRes = await patchTenantProductToggle(
        new NextRequest("http://localhost:3000/api/tenant/products/prod-103/toggle", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId: "tenant-kitchen", isAvailable: false }),
        }),
        { params: Promise.resolve({ id: "prod-103" }) }
      );
      expect(crossBodyRes.status).toBe(403);

      // Spoofed body.tenantId targeting another tenant's product (prod-103 belongs to tenant-kitchen) -> 403
      const spoofedRes = await patchTenantProductToggle(
        new NextRequest("http://localhost:3000/api/tenant/products/prod-103/toggle", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId: "tenant-ks", isAvailable: false }),
        }),
        { params: Promise.resolve({ id: "prod-103" }) }
      );
      expect(spoofedRes.status).toBe(403);

      // Own product with matching tenantId -> 200
      const ownRes = await patchTenantProductToggle(
        new NextRequest("http://localhost:3000/api/tenant/products/prod-101/toggle", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId: "tenant-ks", isAvailable: false }),
        }),
        { params: Promise.resolve({ id: "prod-101" }) }
      );
      expect(ownRes.status).toBe(200);
    });

    it("menyamarkan PII untuk Tenant OWNER pada POST/PUT dan mencegah allowUpdate menimpa poin member", async () => {
      const targetMember = INITIAL_MEMBERS[0];

      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "owner-ks",
        role: "OWNER" as RoleSlug,
        scopeLevel: "TENANT",
        tenantId: "tenant-ks",
      });

      const postExistingRes = await postLoyaltyMembers(
        new NextRequest("http://localhost:3000/api/loyalty/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: targetMember.name,
            phone: targetMember.phone,
            allowUpdate: true,
            points: 0,
          }),
        })
      );
      expect(postExistingRes.status).toBe(200);
      const postExistingJson = await postExistingRes.json();
      expect(postExistingJson.isExisting).toBe(true);
      expect(postExistingJson.member.points).toBe(targetMember.points);
      expect(postExistingJson.member.phone).toContain("****");
      expect(postExistingJson.member.email).toContain("***");

      const putRes = await putLoyaltyMembers(
        new NextRequest("http://localhost:3000/api/loyalty/members", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: targetMember.id,
            updates: { favoriteItem: "Americano" },
          }),
        })
      );
      expect(putRes.status).toBe(200);
      const putJson = await putRes.json();
      expect(putJson.member.phone).toContain("****");
      expect(putJson.member.email).toContain("***");
    });

    it("mengizinkan kasir membalik poin voucher rev-redeem-* untuk order batal dan rev-* untuk booking coworking batal", async () => {
      const baseMember = INITIAL_MEMBERS[0];
      const memberWithHistory = {
        ...baseMember,
        points: 200,
        pointHistory: [
          {
            id: "ptx-redeem-ord-1",
            memberId: baseMember.id,
            type: "REDEEM" as const,
            points: -50,
            balanceAfter: 200,
            reason: "Tukar voucher",
            relatedTransactionId: "ord-rev-redeem-1",
            timestamp: new Date().toISOString(),
            actorName: "Kasir",
            outletId: "outlet-sgr",
          },
          {
            id: "ptx-earn-bk-1",
            memberId: baseMember.id,
            type: "EARN" as const,
            points: 40,
            balanceAfter: 250,
            reason: "Booking coworking",
            relatedTransactionId: "bk-rev-earn-1",
            timestamp: new Date().toISOString(),
            actorName: "Kasir",
            outletId: "outlet-sgr",
          },
        ],
      };
      await writePersistentData("loyalty_members.json", [memberWithHistory]);
      await writePersistentData("pos_orders.json", [
        {
          id: "ord-rev-redeem-1",
          orderNumber: "INV-REV-REDEEM-1",
          outletId: "outlet-sgr",
          outletName: "Singaraja",
          tableNumber: "TAKEAWAY",
          customerName: baseMember.name,
          orderType: "TAKEAWAY",
          status: "CANCELLED",
          items: [],
          subtotal: 50000,
          tax: 5000,
          total: 55000,
          paymentStatus: "REFUNDED",
          paymentMethod: "CASH",
          createdAt: new Date().toISOString(),
          statusHistory: [],
        },
      ]);
      await writePersistentData("coworking_bookings.json", [
        {
          id: "bk-rev-earn-1",
          bookingCode: "CWK-REV-1",
          guestName: baseMember.name,
          guestPhone: baseMember.phone,
          guestEmail: baseMember.email,
          spaceId: "sp-meet-1",
          spaceName: "Meeting Room",
          spaceType: "MEETING_ROOM",
          bookingType: "HOURLY",
          date: "2026-12-01",
          startTime: "10:00",
          endTime: "11:00",
          duration: 1,
          price: 40000,
          discount: 0,
          totalAmount: 40000,
          paidAmount: 40000,
          remainingAmount: 0,
          paymentMethod: "CASH",
          paymentStatus: "PAID",
          checkInStatus: "CANCELLED",
          outletId: "outlet-sgr",
          createdAt: new Date().toISOString(),
        },
      ]);

      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "cashier-1",
        role: "CASHIER" as RoleSlug,
        scopeLevel: "OUTLET",
      });

      const restoreVoucherRes = await putLoyaltyMembers(
        new NextRequest("http://localhost:3000/api/loyalty/members", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: baseMember.id,
            updates: {
              points: 250,
              pointHistory: [
                {
                  id: "ptx-rev-redeem-1",
                  memberId: baseMember.id,
                  type: "ADJUSTMENT",
                  points: 50,
                  balanceAfter: 250,
                  reason: "Pengembalian poin voucher",
                  relatedTransactionId: "rev-redeem-ord-rev-redeem-1",
                  timestamp: new Date().toISOString(),
                  actorName: "Kasir",
                  outletId: "outlet-sgr",
                },
                ...memberWithHistory.pointHistory,
              ],
            },
          }),
        })
      );
      expect(restoreVoucherRes.status).toBe(200);
      const restoredJson = await restoreVoucherRes.json();
      expect(restoredJson.member.points).toBe(250);

      const reverseBookingRes = await putLoyaltyMembers(
        new NextRequest("http://localhost:3000/api/loyalty/members", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: baseMember.id,
            updates: {
              points: 210,
              pointHistory: [
                {
                  id: "ptx-rev-bk-1",
                  memberId: baseMember.id,
                  type: "ADJUSTMENT",
                  points: -40,
                  balanceAfter: 210,
                  reason: "Pembatalan booking coworking",
                  relatedTransactionId: "rev-bk-rev-earn-1",
                  timestamp: new Date().toISOString(),
                  actorName: "Kasir",
                  outletId: "outlet-sgr",
                },
                ...restoredJson.member.pointHistory,
              ],
            },
          }),
        })
      );
      expect(reverseBookingRes.status).toBe(200);
      const reversedBookingJson = await reverseBookingRes.json();
      expect(reversedBookingJson.member.points).toBe(210);
    });
  });
});
