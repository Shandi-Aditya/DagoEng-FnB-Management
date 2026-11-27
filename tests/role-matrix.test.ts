import { describe, it, expect } from "vitest";
import {
  ROLE_MATRIX,
  ROLE_MATRIX_CAPABILITIES,
  getRoleMatrixAccess,
  canAccessCapability,
  requiresSupervisorApproval,
  isScopedAccess,
  canMutateData,
  evaluateRoleMatrixAccess,
  assertRoleMatrixAccess,
} from "../src/lib/role-matrix";
import { RoleMatrixCapabilityKey, RoleMatrixRoleSlug } from "../src/types/rbac";

const ALL_ROLES: RoleMatrixRoleSlug[] = [
  "SUPER_ADMIN",
  "FINANCE",
  "OWNER",
  "MANAGER",
  "CASHIER",
  "WAITER",
  "KITCHEN_STAFF",
  "INVENTORY_STAFF",
];

describe("Role Matrix POS F&B Multi-Mitra Specification & Boundary Hardening", () => {
  describe("1. Matrix Completeness and Structural Integrity", () => {
    it("defines all 18 capabilities across 7 active sections", () => {
      expect(ROLE_MATRIX_CAPABILITIES).toHaveLength(18);

      const keys = ROLE_MATRIX_CAPABILITIES.map((c) => c.key);
      expect(keys).toContain("platform:manage_partners_revenue_split");
      expect(keys).toContain("platform:outlet_receipt_settings");
      expect(keys).toContain("platform:manage_users_roles");
      expect(keys).toContain("master:menu_prices");
      expect(keys).toContain("master:promos_discounts");
      expect(keys).toContain("pos:shifts");
      expect(keys).toContain("pos:orders_input");
      expect(keys).toContain("pos:tables_management");
      expect(keys).toContain("pos:accept_payments");
      expect(keys).toContain("pos:reprint_receipt");
      expect(keys).toContain("critical:refund");
      expect(keys).toContain("kitchen:kds_order_status");
      expect(keys).toContain("kitchen:mark_out_of_stock");
      expect(keys).toContain("inventory:stock_waste_opname");
      expect(keys).toContain("reports:sales");
      expect(keys).toContain("reports:stock_cogs");
      expect(keys).toContain("reports:settlement");
      expect(keys).toContain("reports:audit_log");
    });

    it("maps every capability to all 8 roles without missing or undefined access levels", () => {
      for (const cap of ROLE_MATRIX_CAPABILITIES) {
        const roleMap = ROLE_MATRIX[cap.key];
        expect(roleMap, `Matrix entry missing for capability [${cap.key}]`).toBeDefined();
        for (const role of ALL_ROLES) {
          const level = roleMap[role];
          expect(
            ["PENUH", "TERBATAS", "APPROVAL", "LIHAT", "KOSONG"],
            `Invalid level [${level}] for role [${role}] on capability [${cap.key}]`
          ).toContain(level);
        }
      }
    });
  });

  describe("2. Section 1 — PLATFORM", () => {
    it("enforces 'Kelola mitra & skema bagi hasil' rules (Super Admin: PENUH, Finance: LIHAT, Others: KOSONG)", () => {
      const cap: RoleMatrixCapabilityKey = "platform:manage_partners_revenue_split";
      expect(getRoleMatrixAccess("SUPER_ADMIN", cap)).toBe("PENUH");
      expect(getRoleMatrixAccess("FINANCE", cap)).toBe("LIHAT");
      expect(getRoleMatrixAccess("OWNER", cap)).toBe("KOSONG");
      expect(getRoleMatrixAccess("MANAGER", cap)).toBe("KOSONG");
      expect(getRoleMatrixAccess("CASHIER", cap)).toBe("KOSONG");

      // Super Admin can read and write
      expect(evaluateRoleMatrixAccess({ role: "SUPER_ADMIN", capability: cap, actionType: "WRITE" }).allowed).toBe(true);

      // Finance can view but cannot modify
      expect(evaluateRoleMatrixAccess({ role: "FINANCE", capability: cap, actionType: "READ" }).allowed).toBe(true);
      expect(evaluateRoleMatrixAccess({ role: "FINANCE", capability: cap, actionType: "WRITE" }).allowed).toBe(false);

      // Owner has no access
      expect(evaluateRoleMatrixAccess({ role: "OWNER", capability: cap }).allowed).toBe(false);
    });

    it("enforces 'Pengaturan outlet & struk' rules (Super Admin: PENUH, Owner: TERBATAS, Others: KOSONG)", () => {
      const cap: RoleMatrixCapabilityKey = "platform:outlet_receipt_settings";
      expect(getRoleMatrixAccess("SUPER_ADMIN", cap)).toBe("PENUH");
      expect(getRoleMatrixAccess("OWNER", cap)).toBe("TERBATAS");
      expect(getRoleMatrixAccess("FINANCE", cap)).toBe("KOSONG");

      // Owner can access own tenant/outlet
      const validOwner = evaluateRoleMatrixAccess({
        role: "OWNER",
        capability: cap,
        userTenantId: "tenant-ks",
        targetTenantId: "tenant-ks",
      });
      expect(validOwner.allowed).toBe(true);
      expect(validOwner.isScoped).toBe(true);

      // Owner cannot modify other tenant's outlet
      const invalidOwner = evaluateRoleMatrixAccess({
        role: "OWNER",
        capability: cap,
        userTenantId: "tenant-ks",
        targetTenantId: "tenant-other",
      });
      expect(invalidOwner.allowed).toBe(false);
      expect(invalidOwner.reason).toContain("TENANT_ISOLATION_VIOLATION");
    });

    it("enforces 'Kelola user & role' rules (Super Admin: PENUH, Owner: TERBATAS, Others: KOSONG)", () => {
      const cap: RoleMatrixCapabilityKey = "platform:manage_users_roles";
      expect(getRoleMatrixAccess("SUPER_ADMIN", cap)).toBe("PENUH");
      expect(getRoleMatrixAccess("OWNER", cap)).toBe("TERBATAS");
      expect(getRoleMatrixAccess("MANAGER", cap)).toBe("KOSONG");
      expect(getRoleMatrixAccess("CASHIER", cap)).toBe("KOSONG");

      // Owner managing own staff
      expect(
        evaluateRoleMatrixAccess({
          role: "OWNER",
          capability: cap,
          userTenantId: "tenant-ks",
          targetTenantId: "tenant-ks",
        }).allowed
      ).toBe(true);

      // Owner attempting to manage outside staff
      expect(
        evaluateRoleMatrixAccess({
          role: "OWNER",
          capability: cap,
          userTenantId: "tenant-ks",
          targetTenantId: "tenant-bakery",
        }).allowed
      ).toBe(false);
    });
  });

  describe("3. Section 2 — MASTER DATA", () => {
    it("enforces 'Master menu & harga' (Super Admin: LIHAT, Finance: TERBATAS, Owner: TERBATAS, Manager: LIHAT, Staff: KOSONG)", () => {
      const cap: RoleMatrixCapabilityKey = "master:menu_prices";
      expect(getRoleMatrixAccess("SUPER_ADMIN", cap)).toBe("LIHAT");
      expect(getRoleMatrixAccess("FINANCE", cap)).toBe("TERBATAS");
      expect(getRoleMatrixAccess("OWNER", cap)).toBe("TERBATAS");
      expect(getRoleMatrixAccess("MANAGER", cap)).toBe("LIHAT");
      expect(getRoleMatrixAccess("CASHIER", cap)).toBe("KOSONG");
      expect(getRoleMatrixAccess("WAITER", cap)).toBe("KOSONG");

      // Super admin can read but cannot write
      expect(evaluateRoleMatrixAccess({ role: "SUPER_ADMIN", capability: cap, actionType: "READ" }).allowed).toBe(true);
      expect(evaluateRoleMatrixAccess({ role: "SUPER_ADMIN", capability: cap, actionType: "WRITE" }).allowed).toBe(false);

      // Manager can read but cannot write
      expect(evaluateRoleMatrixAccess({ role: "MANAGER", capability: cap, actionType: "READ" }).allowed).toBe(true);
      expect(evaluateRoleMatrixAccess({ role: "MANAGER", capability: cap, actionType: "WRITE" }).allowed).toBe(false);

      // Owner can write within own tenant
      expect(
        evaluateRoleMatrixAccess({
          role: "OWNER",
          capability: cap,
          actionType: "WRITE",
          userTenantId: "tenant-ks",
          targetTenantId: "tenant-ks",
        }).allowed
      ).toBe(true);
    });

    it("enforces 'Atur promo / diskon terjadwal' (Super Admin: LIHAT, Finance: TERBATAS, Owner: TERBATAS, Manager: LIHAT)", () => {
      const cap: RoleMatrixCapabilityKey = "master:promos_discounts";
      expect(getRoleMatrixAccess("SUPER_ADMIN", cap)).toBe("LIHAT");
      expect(getRoleMatrixAccess("FINANCE", cap)).toBe("TERBATAS");
      expect(getRoleMatrixAccess("OWNER", cap)).toBe("TERBATAS");
      expect(getRoleMatrixAccess("MANAGER", cap)).toBe("LIHAT");
      expect(getRoleMatrixAccess("CASHIER", cap)).toBe("KOSONG");
    });
  });

  describe("4. Section 3 — OPERASIONAL KASIR", () => {
    it("enforces 'Buka/tutup shift & kas awal' (Owner: LIHAT, Manager: PENUH, Kasir: TERBATAS)", () => {
      const cap: RoleMatrixCapabilityKey = "pos:shifts";
      expect(getRoleMatrixAccess("OWNER", cap)).toBe("LIHAT");
      expect(getRoleMatrixAccess("MANAGER", cap)).toBe("PENUH");
      expect(getRoleMatrixAccess("CASHIER", cap)).toBe("TERBATAS");
      expect(getRoleMatrixAccess("WAITER", cap)).toBe("KOSONG");
      expect(getRoleMatrixAccess("KITCHEN_STAFF", cap)).toBe("KOSONG");

      // Cashier only manages own shift
      expect(
        evaluateRoleMatrixAccess({
          role: "CASHIER",
          capability: cap,
          userShiftId: "shift-123",
          targetShiftId: "shift-123",
        }).allowed
      ).toBe(true);

      // Cashier cannot close another cashier's shift
      const shiftViolation = evaluateRoleMatrixAccess({
        role: "CASHIER",
        capability: cap,
        userShiftId: "shift-123",
        targetShiftId: "shift-456",
      });
      expect(shiftViolation.allowed).toBe(false);
      expect(shiftViolation.reason).toContain("SHIFT_ISOLATION_VIOLATION");
    });

    it("enforces 'Input pesanan' and 'Kelola meja' (Owner, Manager, Kasir, Waitress: PENUH)", () => {
      const orderCap: RoleMatrixCapabilityKey = "pos:orders_input";
      const tableCap: RoleMatrixCapabilityKey = "pos:tables_management";

      for (const cap of [orderCap, tableCap]) {
        expect(getRoleMatrixAccess("OWNER", cap)).toBe("PENUH");
        expect(getRoleMatrixAccess("MANAGER", cap)).toBe("PENUH");
        expect(getRoleMatrixAccess("CASHIER", cap)).toBe("PENUH");
        expect(getRoleMatrixAccess("WAITER", cap)).toBe("PENUH");
        expect(getRoleMatrixAccess("KITCHEN_STAFF", cap)).toBe("KOSONG");
        expect(getRoleMatrixAccess("INVENTORY_STAFF", cap)).toBe("KOSONG");
      }
    });

    it("enforces 'Terima pembayaran' and 'Cetak ulang struk' (Owner, Manager, Kasir: PENUH, Waitress: KOSONG)", () => {
      const payCap: RoleMatrixCapabilityKey = "pos:accept_payments";
      const reprintCap: RoleMatrixCapabilityKey = "pos:reprint_receipt";

      for (const cap of [payCap, reprintCap]) {
        expect(getRoleMatrixAccess("OWNER", cap)).toBe("PENUH");
        expect(getRoleMatrixAccess("MANAGER", cap)).toBe("PENUH");
        expect(getRoleMatrixAccess("CASHIER", cap)).toBe("PENUH");
        expect(getRoleMatrixAccess("WAITER", cap)).toBe("KOSONG");
        expect(getRoleMatrixAccess("KITCHEN_STAFF", cap)).toBe("KOSONG");
      }
    });
  });

  describe("5. Section 4 — KONTROL KRITIS (Refund)", () => {
    it("enforces Refund rules (Finance: LIHAT, Owner: PENUH, Manager: PENUH, Kasir: APPROVAL)", () => {
      const cap: RoleMatrixCapabilityKey = "critical:refund";
      expect(getRoleMatrixAccess("FINANCE", cap)).toBe("LIHAT");
      expect(getRoleMatrixAccess("OWNER", cap)).toBe("PENUH");
      expect(getRoleMatrixAccess("MANAGER", cap)).toBe("PENUH");
      expect(getRoleMatrixAccess("CASHIER", cap)).toBe("APPROVAL");
      expect(getRoleMatrixAccess("WAITER", cap)).toBe("KOSONG");

      // Cashier refund without PIN is rejected
      const cashierNoPin = evaluateRoleMatrixAccess({
        role: "CASHIER",
        capability: cap,
        actionType: "WRITE",
      });
      expect(cashierNoPin.allowed).toBe(false);
      expect(cashierNoPin.requiresApproval).toBe(true);
      expect(cashierNoPin.reason).toContain("APPROVAL_REQUIRED");

      // Cashier refund with supervisor PIN is approved
      const cashierWithPin = evaluateRoleMatrixAccess({
        role: "CASHIER",
        capability: cap,
        actionType: "WRITE",
        supervisorPin: "123456",
      });
      expect(cashierWithPin.allowed).toBe(true);
      expect(cashierWithPin.requiresApproval).toBe(true);

      // Manager / Owner can refund without supervisor PIN
      expect(evaluateRoleMatrixAccess({ role: "MANAGER", capability: cap, actionType: "WRITE" }).allowed).toBe(true);
      expect(evaluateRoleMatrixAccess({ role: "OWNER", capability: cap, actionType: "WRITE" }).allowed).toBe(true);
    });
  });

  describe("6. Section 5 — DAPUR", () => {
    it("enforces 'Layar Dapur (KDS): Ubah status pesanan' (Owner/Manager/Waitress: LIHAT, Dapur/Bar: PENUH)", () => {
      const cap: RoleMatrixCapabilityKey = "kitchen:kds_order_status";
      expect(getRoleMatrixAccess("KITCHEN_STAFF", cap)).toBe("PENUH");
      expect(getRoleMatrixAccess("OWNER", cap)).toBe("LIHAT");
      expect(getRoleMatrixAccess("MANAGER", cap)).toBe("LIHAT");
      expect(getRoleMatrixAccess("WAITER", cap)).toBe("LIHAT");
      expect(getRoleMatrixAccess("CASHIER", cap)).toBe("KOSONG");

      expect(evaluateRoleMatrixAccess({ role: "KITCHEN_STAFF", capability: cap, actionType: "WRITE" }).allowed).toBe(true);
      expect(evaluateRoleMatrixAccess({ role: "WAITER", capability: cap, actionType: "WRITE" }).allowed).toBe(false);
    });

    it("enforces 'Tandai menu habis' (Owner/Manager/Dapur: PENUH, Kasir: TERBATAS)", () => {
      const cap: RoleMatrixCapabilityKey = "kitchen:mark_out_of_stock";
      expect(getRoleMatrixAccess("OWNER", cap)).toBe("PENUH");
      expect(getRoleMatrixAccess("MANAGER", cap)).toBe("PENUH");
      expect(getRoleMatrixAccess("KITCHEN_STAFF", cap)).toBe("PENUH");
      expect(getRoleMatrixAccess("CASHIER", cap)).toBe("TERBATAS");
      expect(getRoleMatrixAccess("WAITER", cap)).toBe("KOSONG");
    });
  });

  describe("7. Section 6 — INVENTORI", () => {
    it("enforces 'Stok masuk, waste, dan stock opname' (Owner/Manager/Gudang: PENUH, Dapur: TERBATAS waste-only)", () => {
      const cap: RoleMatrixCapabilityKey = "inventory:stock_waste_opname";
      expect(getRoleMatrixAccess("OWNER", cap)).toBe("PENUH");
      expect(getRoleMatrixAccess("MANAGER", cap)).toBe("PENUH");
      expect(getRoleMatrixAccess("INVENTORY_STAFF", cap)).toBe("PENUH");
      expect(getRoleMatrixAccess("KITCHEN_STAFF", cap)).toBe("TERBATAS");
      expect(getRoleMatrixAccess("CASHIER", cap)).toBe("KOSONG");
      expect(getRoleMatrixAccess("WAITER", cap)).toBe("KOSONG");

      // Dapur cannot perform generic inventory writes (stock opname / PO intake)
      const kitchenGeneralWrite = evaluateRoleMatrixAccess({
        role: "KITCHEN_STAFF",
        capability: cap,
        actionType: "WRITE",
      });
      expect(kitchenGeneralWrite.allowed).toBe(false);
      expect(kitchenGeneralWrite.reason).toContain("FORBIDDEN");

      // Dapur is strictly allowed to record waste
      const kitchenWasteOnly = evaluateRoleMatrixAccess({
        role: "KITCHEN_STAFF",
        capability: cap,
        actionType: "WASTE_ONLY",
      });
      expect(kitchenWasteOnly.allowed).toBe(true);
      expect(kitchenWasteOnly.isScoped).toBe(true);
    });
  });

  describe("8. Section 7 — LAPORAN", () => {
    it("enforces 'Laporan penjualan' (Super Admin/Finance: PENUH, Owner/Manager/Kasir: TERBATAS)", () => {
      const cap: RoleMatrixCapabilityKey = "reports:sales";
      expect(getRoleMatrixAccess("SUPER_ADMIN", cap)).toBe("PENUH");
      expect(getRoleMatrixAccess("FINANCE", cap)).toBe("PENUH");
      expect(getRoleMatrixAccess("OWNER", cap)).toBe("TERBATAS");
      expect(getRoleMatrixAccess("MANAGER", cap)).toBe("TERBATAS");
      expect(getRoleMatrixAccess("CASHIER", cap)).toBe("TERBATAS");
      expect(getRoleMatrixAccess("WAITER", cap)).toBe("KOSONG");
      expect(getRoleMatrixAccess("KITCHEN_STAFF", cap)).toBe("KOSONG");
    });

    it("enforces 'Laporan stok & HPP' (Super Admin/Finance/Manager/Gudang: LIHAT, Owner: PENUH)", () => {
      const cap: RoleMatrixCapabilityKey = "reports:stock_cogs";
      expect(getRoleMatrixAccess("SUPER_ADMIN", cap)).toBe("LIHAT");
      expect(getRoleMatrixAccess("FINANCE", cap)).toBe("LIHAT");
      expect(getRoleMatrixAccess("MANAGER", cap)).toBe("LIHAT");
      expect(getRoleMatrixAccess("INVENTORY_STAFF", cap)).toBe("LIHAT");
      expect(getRoleMatrixAccess("OWNER", cap)).toBe("PENUH");
      expect(getRoleMatrixAccess("CASHIER", cap)).toBe("KOSONG");
    });

    it("enforces 'Settlement bagi hasil' (Super Admin/Finance: PENUH, Owner: LIHAT, Others: KOSONG)", () => {
      const cap: RoleMatrixCapabilityKey = "reports:settlement";
      expect(getRoleMatrixAccess("SUPER_ADMIN", cap)).toBe("PENUH");
      expect(getRoleMatrixAccess("FINANCE", cap)).toBe("PENUH");
      expect(getRoleMatrixAccess("OWNER", cap)).toBe("LIHAT");
      expect(getRoleMatrixAccess("MANAGER", cap)).toBe("KOSONG");
      expect(getRoleMatrixAccess("CASHIER", cap)).toBe("KOSONG");
    });

    it("enforces 'Audit log' (Super Admin: PENUH, Finance/Manager: LIHAT, Owner: TERBATAS, Others: KOSONG)", () => {
      const cap: RoleMatrixCapabilityKey = "reports:audit_log";
      expect(getRoleMatrixAccess("SUPER_ADMIN", cap)).toBe("PENUH");
      expect(getRoleMatrixAccess("FINANCE", cap)).toBe("LIHAT");
      expect(getRoleMatrixAccess("MANAGER", cap)).toBe("LIHAT");
      expect(getRoleMatrixAccess("OWNER", cap)).toBe("TERBATAS");
      expect(getRoleMatrixAccess("CASHIER", cap)).toBe("KOSONG");
    });

    it("strictly blocks write operations on reporting capabilities even for scoped roles", () => {
      // Cashier attempting to write to sales report
      const cashierSalesWrite = evaluateRoleMatrixAccess({
        role: "CASHIER",
        capability: "reports:sales",
        actionType: "WRITE",
      });
      expect(cashierSalesWrite.allowed).toBe(false);
      expect(cashierSalesWrite.reason).toContain("FORBIDDEN");

      // Owner attempting to mutate audit logs
      const ownerAuditWrite = evaluateRoleMatrixAccess({
        role: "OWNER",
        capability: "reports:audit_log",
        actionType: "WRITE",
      });
      expect(ownerAuditWrite.allowed).toBe(false);
      expect(ownerAuditWrite.reason).toContain("FORBIDDEN");

      // canMutateData returns false for all reports
      expect(canMutateData("CASHIER", "reports:sales")).toBe(false);
      expect(canMutateData("OWNER", "reports:audit_log")).toBe(false);
      expect(canMutateData("SUPER_ADMIN", "reports:sales")).toBe(false);
    });
  });

  describe("9. Pure Helper Functions, Fail-Closed Boundaries & Assertions", () => {
    it("assertRoleMatrixAccess allows valid actions and throws on forbidden actions", () => {
      expect(() =>
        assertRoleMatrixAccess({
          role: "SUPER_ADMIN",
          capability: "platform:manage_partners_revenue_split",
          actionType: "WRITE",
        })
      ).not.toThrow();

      expect(() =>
        assertRoleMatrixAccess({
          role: "CASHIER",
          capability: "platform:manage_partners_revenue_split",
        })
      ).toThrowError(/FORBIDDEN/);

      expect(() =>
        assertRoleMatrixAccess({
          role: "CASHIER",
          capability: "critical:refund",
          actionType: "WRITE",
        })
      ).toThrowError(/APPROVAL_REQUIRED/);
    });

    it("evaluates capability predicates (canAccessCapability, requiresSupervisorApproval, isScopedAccess, canMutateData)", () => {
      expect(canAccessCapability("SUPER_ADMIN", "platform:manage_partners_revenue_split")).toBe(true);
      expect(canAccessCapability("CASHIER", "platform:manage_partners_revenue_split")).toBe(false);

      expect(requiresSupervisorApproval("CASHIER", "critical:refund")).toBe(true);
      expect(requiresSupervisorApproval("MANAGER", "critical:refund")).toBe(false);

      expect(isScopedAccess("OWNER", "platform:outlet_receipt_settings")).toBe(true);
      expect(isScopedAccess("SUPER_ADMIN", "platform:outlet_receipt_settings")).toBe(false);

      expect(canMutateData("SUPER_ADMIN", "platform:manage_partners_revenue_split")).toBe(true);
      expect(canMutateData("FINANCE", "platform:manage_partners_revenue_split")).toBe(false);
    });

    it("verifies isRoleMatrixRole type guard and safely denies non-matrix roles", () => {
      // Non-matrix roles
      expect(getRoleMatrixAccess("CUSTOMER", "pos:orders_input")).toBe("KOSONG");
      expect(getRoleMatrixAccess("CHECKIN_STAFF", "pos:orders_input")).toBe("KOSONG");
      expect(
        evaluateRoleMatrixAccess({ role: "CUSTOMER", capability: "pos:orders_input" }).allowed
      ).toBe(false);
    });

    it("fails closed on scoped checks when user scope ID is missing or mismatched", () => {
      // Missing userTenantId when targetTenantId is specified
      const missingTenant = evaluateRoleMatrixAccess({
        role: "OWNER",
        capability: "platform:outlet_receipt_settings",
        targetTenantId: "tenant-ks",
      });
      expect(missingTenant.allowed).toBe(false);
      expect(missingTenant.reason).toContain("TENANT_ISOLATION_VIOLATION");

      // Mismatched outlet ID
      const mismatchedOutlet = evaluateRoleMatrixAccess({
        role: "OWNER",
        capability: "platform:outlet_receipt_settings",
        userOutletId: "outlet-sgr",
        targetOutletId: "outlet-bdg",
      });
      expect(mismatchedOutlet.allowed).toBe(false);
      expect(mismatchedOutlet.reason).toContain("OUTLET_ISOLATION_VIOLATION");
    });

    it("approves critical:refund when verifiedSupervisorApproval is true", () => {
      const verifiedApproval = evaluateRoleMatrixAccess({
        role: "CASHIER",
        capability: "critical:refund",
        actionType: "WRITE",
        verifiedSupervisorApproval: true,
      });
      expect(verifiedApproval.allowed).toBe(true);
      expect(verifiedApproval.requiresApproval).toBe(true);
    });
  });
});
