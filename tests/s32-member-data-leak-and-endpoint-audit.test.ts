import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as serverAuth from "@/lib/server-auth";
import { GET as getLoyaltyMembers } from "@/app/api/loyalty/members/route";
import { GET as getEmployees } from "@/app/api/employees/route";
import { GET as getClosingPdf } from "@/app/api/reports/closing/pdf/route";
import { POST as postTenantOperations } from "@/app/api/tenant/operations/route";
import { GET as getProducts } from "@/app/api/products/route";
import { GET as getSettlementReceipt } from "@/app/api/settings/settlement-receipt/route";
import { writePersistentData } from "@/lib/persistent-storage";
import { INITIAL_MEMBERS, INITIAL_EMPLOYEES, INITIAL_PRODUCTS } from "@/lib/master-data-defaults";
import type { RoleSlug } from "@/types/auth";

describe("S-32: Tutup kebocoran data member dan audit endpoint publik", () => {
  beforeEach(async () => {
    await writePersistentData("loyalty_members.json", INITIAL_MEMBERS);
    await writePersistentData("employees.json", INITIAL_EMPLOYEES);
    vi.restoreAllMocks();
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
  });
});
