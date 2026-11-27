import { RoleSlug } from "./auth";

export type PermissionCode =
  | "dashboard:view"
  | "dashboard:compare_outlets"
  | "pos:operate"
  | "orders:view"
  | "orders:manage"
  | "tables:view"
  | "tables:manage"
  | "kitchen:kds"
  | "inventory:view"
  | "inventory:manage"
  | "menu:view"
  | "menu:manage"
  | "customers:view"
  | "reports:view"
  | "employees:manage"
  | "settings:manage";

export interface NavigationItem {
  name: string;
  href: string;
  icon: string;
  requiredPermission?: PermissionCode;
  allowedRoles?: RoleSlug[];
  badge?: string;
}

/**
 * Access levels defined in the POS F&B Multi-Mitra Role Matrix.
 */
export type AccessLevel =
  | "PENUH"       // Bisa melihat, membuat, mengubah, dan menghapus data.
  | "TERBATAS"    // Hanya bisa mengakses data, outlet, atau shift miliknya sendiri.
  | "APPROVAL"    // Tindakan wajib persetujuan PIN Manager/Owner & tercatat di audit log.
  | "LIHAT"       // Hanya bisa melihat data tanpa mengubahnya.
  | "KOSONG";     // Tidak memiliki akses.

/**
 * All capabilities categorized into the 7 active sections of the POS F&B Multi-Mitra Role Matrix.
 */
export type RoleMatrixCapabilityKey =
  // 1. PLATFORM
  | "platform:manage_partners_revenue_split"
  | "platform:outlet_receipt_settings"
  | "platform:manage_users_roles"
  // 2. MASTER DATA
  | "master:menu_prices"
  | "master:promos_discounts"
  // 3. OPERASIONAL KASIR
  | "pos:shifts"
  | "pos:orders_input"
  | "pos:tables_management"
  | "pos:accept_payments"
  | "pos:reprint_receipt"
  // 4. KONTROL KRITIS
  | "critical:refund"
  // 5. DAPUR
  | "kitchen:kds_order_status"
  | "kitchen:mark_out_of_stock"
  // 6. INVENTORI
  | "inventory:stock_waste_opname"
  // 7. LAPORAN
  | "reports:sales"
  | "reports:stock_cogs"
  | "reports:settlement"
  | "reports:audit_log";

export type RoleMatrixSectionId =
  | "PLATFORM"
  | "MASTER_DATA"
  | "OPERASIONAL_KASIR"
  | "KONTROL_KRITIS"
  | "DAPUR"
  | "INVENTORI"
  | "LAPORAN";

export type RoleMatrixRoleSlug =
  | "SUPER_ADMIN"
  | "FINANCE"
  | "OWNER"
  | "MANAGER"
  | "CASHIER"
  | "WAITER"
  | "KITCHEN_STAFF"
  | "INVENTORY_STAFF";

export interface RoleMatrixCapabilityDefinition {
  key: RoleMatrixCapabilityKey;
  section: RoleMatrixSectionId;
  name: string;
  notes?: string;
  requiresPin?: boolean;
}

export interface AccessEvaluationContext {
  role: RoleSlug;
  capability: RoleMatrixCapabilityKey;
  userTenantId?: string | null;
  targetTenantId?: string | null;
  userOutletId?: string | null;
  targetOutletId?: string | null;
  userShiftId?: string | null;
  targetShiftId?: string | null;
  supervisorPin?: string | null;
  verifiedSupervisorApproval?: boolean;
  actionType?: "READ" | "WRITE" | "WASTE_ONLY";
}

export interface RoleAccessValidationResult {
  allowed: boolean;
  accessLevel: AccessLevel;
  requiresApproval: boolean;
  isScoped: boolean;
  reason?: string;
}
