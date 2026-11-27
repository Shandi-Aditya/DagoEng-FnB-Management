import { RoleSlug } from "@/types/auth";
import {
  AccessEvaluationContext,
  AccessLevel,
  RoleAccessValidationResult,
  RoleMatrixCapabilityDefinition,
  RoleMatrixCapabilityKey,
  RoleMatrixRoleSlug,
  RoleMatrixSectionId,
} from "@/types/rbac";

/**
 * Capability definitions of the POS F&B Multi-Mitra Role Matrix.
 */
export const ROLE_MATRIX_CAPABILITIES: RoleMatrixCapabilityDefinition[] = [
  // 1. PLATFORM
  {
    key: "platform:manage_partners_revenue_split",
    section: "PLATFORM",
    name: "Kelola mitra & skema bagi hasil",
    notes: "Termasuk pengaturan persentase bagi hasil untuk pembayaran Tunai dan QRIS.",
  },
  {
    key: "platform:outlet_receipt_settings",
    section: "PLATFORM",
    name: "Pengaturan outlet & struk (terpisah/gabung)",
    notes: "Owner hanya dapat mengatur outlet miliknya sendiri.",
  },
  {
    key: "platform:manage_users_roles",
    section: "PLATFORM",
    name: "Kelola user & role",
    notes: "Owner hanya dapat mengelola staf outletnya sendiri.",
  },

  // 2. MASTER DATA
  {
    key: "master:menu_prices",
    section: "MASTER_DATA",
    name: "Master menu & harga",
  },
  {
    key: "master:promos_discounts",
    section: "MASTER_DATA",
    name: "Atur promo / diskon terjadwal",
  },

  // 3. OPERASIONAL KASIR
  {
    key: "pos:shifts",
    section: "OPERASIONAL_KASIR",
    name: "Buka/tutup shift & kas awal",
    notes: "Kasir hanya dapat mengelola shift miliknya sendiri.",
  },
  {
    key: "pos:orders_input",
    section: "OPERASIONAL_KASIR",
    name: "Input pesanan (Dine-in / Takeaway / Delivery)",
  },
  {
    key: "pos:tables_management",
    section: "OPERASIONAL_KASIR",
    name: "Kelola meja (Pindah / Gabung / Split Bill)",
  },
  {
    key: "pos:accept_payments",
    section: "OPERASIONAL_KASIR",
    name: "Terima pembayaran (Tunai / Non-Tunai)",
  },
  {
    key: "pos:reprint_receipt",
    section: "OPERASIONAL_KASIR",
    name: "Cetak ulang struk",
    notes: "Setiap cetak ulang tercatat di audit log.",
  },

  // 4. KONTROL KRITIS
  {
    key: "critical:refund",
    section: "KONTROL_KRITIS",
    name: "Refund",
    notes: "Wajib menggunakan PIN dan menyertakan alasan. Seluruh aktivitas tercatat di audit log.",
    requiresPin: true,
  },

  // 5. DAPUR
  {
    key: "kitchen:kds_order_status",
    section: "DAPUR",
    name: "Layar Dapur (KDS): Ubah status pesanan",
  },
  {
    key: "kitchen:mark_out_of_stock",
    section: "DAPUR",
    name: "Tandai menu habis",
    notes: "Opsional, bergantung pada validitas perhitungan stok.",
  },

  // 6. INVENTORI
  {
    key: "inventory:stock_waste_opname",
    section: "INVENTORI",
    name: "Stok masuk, waste, dan stock opname",
    notes: "Dapur hanya memiliki akses untuk mencatat waste.",
  },

  // 7. LAPORAN
  {
    key: "reports:sales",
    section: "LAPORAN",
    name: "Laporan penjualan",
    notes: "Dago melihat seluruh mitra. Owner melihat outlet miliknya. Manager fokus laporan harian. Kasir melihat rekap shift.",
  },
  {
    key: "reports:stock_cogs",
    section: "LAPORAN",
    name: "Laporan stok & HPP",
  },
  {
    key: "reports:settlement",
    section: "LAPORAN",
    name: "Settlement bagi hasil (Tunai vs Non-Tunai)",
  },
  {
    key: "reports:audit_log",
    section: "LAPORAN",
    name: "Audit log",
  },
];

/**
 * Authoritative 2D Role Matrix mapping each capability to role access levels.
 */
export const ROLE_MATRIX: Record<RoleMatrixCapabilityKey, Record<RoleMatrixRoleSlug, AccessLevel>> = {
  // 1. PLATFORM
  "platform:manage_partners_revenue_split": {
    SUPER_ADMIN: "PENUH",
    FINANCE: "LIHAT",
    OWNER: "KOSONG",
    MANAGER: "KOSONG",
    CASHIER: "KOSONG",
    WAITER: "KOSONG",
    KITCHEN_STAFF: "KOSONG",
    INVENTORY_STAFF: "KOSONG",
  },
  "platform:outlet_receipt_settings": {
    SUPER_ADMIN: "PENUH",
    FINANCE: "KOSONG",
    OWNER: "TERBATAS",
    MANAGER: "KOSONG",
    CASHIER: "KOSONG",
    WAITER: "KOSONG",
    KITCHEN_STAFF: "KOSONG",
    INVENTORY_STAFF: "KOSONG",
  },
  "platform:manage_users_roles": {
    SUPER_ADMIN: "PENUH",
    FINANCE: "KOSONG",
    OWNER: "TERBATAS",
    MANAGER: "KOSONG",
    CASHIER: "KOSONG",
    WAITER: "KOSONG",
    KITCHEN_STAFF: "KOSONG",
    INVENTORY_STAFF: "KOSONG",
  },

  // 2. MASTER DATA
  "master:menu_prices": {
    SUPER_ADMIN: "LIHAT",
    FINANCE: "TERBATAS",
    OWNER: "TERBATAS",
    MANAGER: "LIHAT",
    CASHIER: "KOSONG",
    WAITER: "KOSONG",
    KITCHEN_STAFF: "KOSONG",
    INVENTORY_STAFF: "KOSONG",
  },
  "master:promos_discounts": {
    SUPER_ADMIN: "LIHAT",
    FINANCE: "TERBATAS",
    OWNER: "TERBATAS",
    MANAGER: "LIHAT",
    CASHIER: "KOSONG",
    WAITER: "KOSONG",
    KITCHEN_STAFF: "KOSONG",
    INVENTORY_STAFF: "KOSONG",
  },

  // 3. OPERASIONAL KASIR
  "pos:shifts": {
    SUPER_ADMIN: "KOSONG",
    FINANCE: "KOSONG",
    OWNER: "LIHAT",
    MANAGER: "PENUH",
    CASHIER: "TERBATAS",
    WAITER: "KOSONG",
    KITCHEN_STAFF: "KOSONG",
    INVENTORY_STAFF: "KOSONG",
  },
  "pos:orders_input": {
    SUPER_ADMIN: "KOSONG",
    FINANCE: "KOSONG",
    OWNER: "PENUH",
    MANAGER: "PENUH",
    CASHIER: "PENUH",
    WAITER: "PENUH",
    KITCHEN_STAFF: "KOSONG",
    INVENTORY_STAFF: "KOSONG",
  },
  "pos:tables_management": {
    SUPER_ADMIN: "KOSONG",
    FINANCE: "KOSONG",
    OWNER: "PENUH",
    MANAGER: "PENUH",
    CASHIER: "PENUH",
    WAITER: "PENUH",
    KITCHEN_STAFF: "KOSONG",
    INVENTORY_STAFF: "KOSONG",
  },
  "pos:accept_payments": {
    SUPER_ADMIN: "KOSONG",
    FINANCE: "KOSONG",
    OWNER: "PENUH",
    MANAGER: "PENUH",
    CASHIER: "PENUH",
    WAITER: "KOSONG",
    KITCHEN_STAFF: "KOSONG",
    INVENTORY_STAFF: "KOSONG",
  },
  "pos:reprint_receipt": {
    SUPER_ADMIN: "KOSONG",
    FINANCE: "KOSONG",
    OWNER: "PENUH",
    MANAGER: "PENUH",
    CASHIER: "PENUH",
    WAITER: "KOSONG",
    KITCHEN_STAFF: "KOSONG",
    INVENTORY_STAFF: "KOSONG",
  },

  // 4. KONTROL KRITIS
  "critical:refund": {
    SUPER_ADMIN: "KOSONG",
    FINANCE: "LIHAT",
    OWNER: "PENUH",
    MANAGER: "PENUH",
    CASHIER: "APPROVAL",
    WAITER: "KOSONG",
    KITCHEN_STAFF: "KOSONG",
    INVENTORY_STAFF: "KOSONG",
  },

  // 5. DAPUR
  "kitchen:kds_order_status": {
    SUPER_ADMIN: "KOSONG",
    FINANCE: "KOSONG",
    OWNER: "LIHAT",
    MANAGER: "LIHAT",
    CASHIER: "KOSONG",
    WAITER: "LIHAT",
    KITCHEN_STAFF: "PENUH",
    INVENTORY_STAFF: "KOSONG",
  },
  "kitchen:mark_out_of_stock": {
    SUPER_ADMIN: "KOSONG",
    FINANCE: "KOSONG",
    OWNER: "PENUH",
    MANAGER: "PENUH",
    CASHIER: "TERBATAS",
    WAITER: "KOSONG",
    KITCHEN_STAFF: "PENUH",
    INVENTORY_STAFF: "KOSONG",
  },

  // 6. INVENTORI
  "inventory:stock_waste_opname": {
    SUPER_ADMIN: "KOSONG",
    FINANCE: "KOSONG",
    OWNER: "PENUH",
    MANAGER: "PENUH",
    CASHIER: "KOSONG",
    WAITER: "KOSONG",
    KITCHEN_STAFF: "TERBATAS",
    INVENTORY_STAFF: "PENUH",
  },

  // 7. LAPORAN
  "reports:sales": {
    SUPER_ADMIN: "PENUH",
    FINANCE: "PENUH",
    OWNER: "TERBATAS",
    MANAGER: "TERBATAS",
    CASHIER: "TERBATAS",
    WAITER: "KOSONG",
    KITCHEN_STAFF: "KOSONG",
    INVENTORY_STAFF: "KOSONG",
  },
  "reports:stock_cogs": {
    SUPER_ADMIN: "LIHAT",
    FINANCE: "LIHAT",
    OWNER: "PENUH",
    MANAGER: "LIHAT",
    CASHIER: "KOSONG",
    WAITER: "KOSONG",
    KITCHEN_STAFF: "KOSONG",
    INVENTORY_STAFF: "LIHAT",
  },
  "reports:settlement": {
    SUPER_ADMIN: "PENUH",
    FINANCE: "PENUH",
    OWNER: "LIHAT",
    MANAGER: "KOSONG",
    CASHIER: "KOSONG",
    WAITER: "KOSONG",
    KITCHEN_STAFF: "KOSONG",
    INVENTORY_STAFF: "KOSONG",
  },
  "reports:audit_log": {
    SUPER_ADMIN: "PENUH",
    FINANCE: "LIHAT",
    OWNER: "TERBATAS",
    MANAGER: "LIHAT",
    CASHIER: "KOSONG",
    WAITER: "KOSONG",
    KITCHEN_STAFF: "KOSONG",
    INVENTORY_STAFF: "KOSONG",
  },
};

const VALID_ROLE_MATRIX_ROLES: ReadonlySet<RoleSlug> = new Set<RoleSlug>([
  "SUPER_ADMIN",
  "FINANCE",
  "OWNER",
  "MANAGER",
  "CASHIER",
  "WAITER",
  "KITCHEN_STAFF",
  "INVENTORY_STAFF",
]);

/**
 * Type guard verifying if a given RoleSlug participates in the POS F&B Role Matrix.
 */
export function isRoleMatrixRole(role: RoleSlug): role is RoleMatrixRoleSlug {
  return VALID_ROLE_MATRIX_ROLES.has(role);
}

/**
 * Gets access level for a role and capability.
 */
export function getRoleMatrixAccess(
  role: RoleSlug,
  capability: RoleMatrixCapabilityKey
): AccessLevel {
  if (!isRoleMatrixRole(role)) return "KOSONG";
  const capabilityMap = ROLE_MATRIX[capability];
  if (!capabilityMap) return "KOSONG";
  return capabilityMap[role] ?? "KOSONG";
}

/**
 * Checks if a role has any access (PENUH, TERBATAS, APPROVAL, or LIHAT) to a capability.
 */
export function canAccessCapability(
  role: RoleSlug,
  capability: RoleMatrixCapabilityKey
): boolean {
  return getRoleMatrixAccess(role, capability) !== "KOSONG";
}

/**
 * Checks if a role requires supervisor/manager approval to execute a capability.
 */
export function requiresSupervisorApproval(
  role: RoleSlug,
  capability: RoleMatrixCapabilityKey
): boolean {
  return getRoleMatrixAccess(role, capability) === "APPROVAL";
}

/**
 * Checks if a role has scoped access (restricted to own tenant, outlet, shift, or waste-only).
 */
export function isScopedAccess(
  role: RoleSlug,
  capability: RoleMatrixCapabilityKey
): boolean {
  return getRoleMatrixAccess(role, capability) === "TERBATAS";
}

/**
 * Checks if a role can mutate data (PENUH or TERBATAS, excluding read-only reports).
 */
export function canMutateData(
  role: RoleSlug,
  capability: RoleMatrixCapabilityKey
): boolean {
  if (capability.startsWith("reports:")) return false;
  const level = getRoleMatrixAccess(role, capability);
  return level === "PENUH" || level === "TERBATAS";
}

/**
 * Evaluates contextual access for a user action based on the role matrix rules.
 */
export function evaluateRoleMatrixAccess(
  context: AccessEvaluationContext
): RoleAccessValidationResult {
  const {
    role,
    capability,
    userTenantId,
    targetTenantId,
    userOutletId,
    targetOutletId,
    userShiftId,
    targetShiftId,
    supervisorPin,
    verifiedSupervisorApproval,
    actionType = "READ",
  } = context;

  const accessLevel = getRoleMatrixAccess(role, capability);

  // 1. KOSONG: No access
  if (accessLevel === "KOSONG") {
    return {
      allowed: false,
      accessLevel: "KOSONG",
      requiresApproval: false,
      isScoped: false,
      reason: `FORBIDDEN: Peran [${role}] tidak memiliki akses ke fitur [${capability}].`,
    };
  }

  // 2. LIHAT: Read-only access
  if (accessLevel === "LIHAT") {
    if (actionType === "WRITE") {
      return {
        allowed: false,
        accessLevel: "LIHAT",
        requiresApproval: false,
        isScoped: false,
        reason: `FORBIDDEN: Peran [${role}] hanya memiliki hak LIHAT pada fitur [${capability}] dan tidak dapat mengubah data.`,
      };
    }
    return {
      allowed: true,
      accessLevel: "LIHAT",
      requiresApproval: false,
      isScoped: false,
    };
  }

  // 3. APPROVAL: Critical control requiring verified supervisor PIN or approval
  if (accessLevel === "APPROVAL") {
    if (actionType === "WRITE") {
      const pinProvided =
        verifiedSupervisorApproval === true ||
        (typeof supervisorPin === "string" && supervisorPin.trim().length > 0);
      if (!pinProvided) {
        return {
          allowed: false,
          accessLevel: "APPROVAL",
          requiresApproval: true,
          isScoped: false,
          reason: `APPROVAL_REQUIRED: Tindakan [${capability}] membutuhkan persetujuan PIN supervisor/manager.`,
        };
      }
    }
    return {
      allowed: true,
      accessLevel: "APPROVAL",
      requiresApproval: true,
      isScoped: false,
    };
  }

  // 4. TERBATAS: Scoped boundary checks
  if (accessLevel === "TERBATAS") {
    // Reporting capabilities are inherently read-only
    if (capability.startsWith("reports:") && actionType === "WRITE") {
      return {
        allowed: false,
        accessLevel: "TERBATAS",
        requiresApproval: false,
        isScoped: true,
        reason: `FORBIDDEN: Fitur laporan [${capability}] hanya bersifat baca dan tidak dapat dimutasi langsung.`,
      };
    }

    // Tenant isolation check (fails closed if targetTenantId is specified)
    if (targetTenantId) {
      if (!userTenantId || userTenantId !== targetTenantId) {
        return {
          allowed: false,
          accessLevel: "TERBATAS",
          requiresApproval: false,
          isScoped: true,
          reason: `TENANT_ISOLATION_VIOLATION: Peran [${role}] hanya berwenang mengakses data tenant miliknya sendiri [${userTenantId || "TIDAK_TERDEFINISI"}], bukan [${targetTenantId}].`,
        };
      }
    }

    // Outlet isolation check (fails closed if targetOutletId is specified)
    if (targetOutletId) {
      if (!userOutletId || userOutletId !== targetOutletId) {
        return {
          allowed: false,
          accessLevel: "TERBATAS",
          requiresApproval: false,
          isScoped: true,
          reason: `OUTLET_ISOLATION_VIOLATION: Peran [${role}] hanya berwenang mengakses data outlet miliknya sendiri [${userOutletId || "TIDAK_TERDEFINISI"}], bukan [${targetOutletId}].`,
        };
      }
    }

    // Shift isolation check (fails closed if targetShiftId is specified)
    if (targetShiftId) {
      if (!userShiftId || userShiftId !== targetShiftId) {
        return {
          allowed: false,
          accessLevel: "TERBATAS",
          requiresApproval: false,
          isScoped: true,
          reason: `SHIFT_ISOLATION_VIOLATION: Kasir hanya berwenang mengelola sesi shift miliknya sendiri [${userShiftId || "TIDAK_TERDEFINISI"}], bukan [${targetShiftId}].`,
        };
      }
    }

    // Kitchen staff inventory boundary: waste recording only
    if (capability === "inventory:stock_waste_opname" && role === "KITCHEN_STAFF") {
      if (actionType === "WRITE") {
        return {
          allowed: false,
          accessLevel: "TERBATAS",
          requiresApproval: false,
          isScoped: true,
          reason: "FORBIDDEN: Staf Dapur hanya memiliki wewenang untuk mencatat waste, bukan mutasi inventori umum atau stock opname.",
        };
      }
      if (actionType === "WASTE_ONLY" || actionType === "READ") {
        return {
          allowed: true,
          accessLevel: "TERBATAS",
          requiresApproval: false,
          isScoped: true,
        };
      }
    }

    return {
      allowed: true,
      accessLevel: "TERBATAS",
      requiresApproval: false,
      isScoped: true,
    };
  }

  // 5. PENUH: Full operational permissions
  return {
    allowed: true,
    accessLevel: "PENUH",
    requiresApproval: false,
    isScoped: false,
  };
}

/**
 * Asserts role matrix access and throws Error if forbidden or invalid.
 */
export function assertRoleMatrixAccess(context: AccessEvaluationContext): void {
  const result = evaluateRoleMatrixAccess(context);
  if (!result.allowed) {
    throw new Error(result.reason || `FORBIDDEN: Akses ke [${context.capability}] ditolak.`);
  }
}
