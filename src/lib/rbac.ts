import { AuthenticatedUser, RoleSlug, BusinessModuleCode, ScopeLevel } from "@/types/auth";
import { PermissionCode } from "@/types/rbac";

/**
 * Checks if a user has access to a specific business module.
 */
export function hasModuleAccess(
  user: AuthenticatedUser | null,
  moduleCode: BusinessModuleCode,
  activeOrgModules: BusinessModuleCode[] = ["CORE", "FNB", "CO_WORKING"]
): boolean {
  if (!user) return false;
  if (user.role.slug === "SUPER_ADMIN") return true;

  // 1. Check if module is globally active in the organization
  if (moduleCode !== "CORE" && !activeOrgModules.includes(moduleCode)) {
    return false;
  }

  // 2. Check if user's scope permits this module
  if (user.scopeLevel === "ORGANIZATION") return true;
  return user.allowedModules.includes(moduleCode);
}

/**
 * Checks if the user has a specific permission code, with optional tenant scoping.
 */
export function hasPermission(
  user: AuthenticatedUser | null,
  permissionCode: PermissionCode,
  targetTenantId?: string
): boolean {
  if (!user) return false;
  if (user.role.slug === "SUPER_ADMIN" || user.scopeLevel === "PLATFORM") return true;

  const hasCode = user.permissions.includes(permissionCode);
  if (!hasCode) return false;

  // Tenant scoping check
  if (user.scopeLevel === "TENANT" && targetTenantId) {
    return user.tenant?.id === targetTenantId;
  }

  return true;
}

/**
 * Checks if the user belongs to any of the allowed roles.
 */
export function hasRole(user: AuthenticatedUser | null, allowedRoles: RoleSlug[]): boolean {
  if (!user) return false;
  if (user.role.slug === "SUPER_ADMIN") return true;
  return allowedRoles.includes(user.role.slug);
}

/**
 * Server-side guard: asserts permission.
 */
export function assertPermission(user: AuthenticatedUser | null, permissionCode: PermissionCode): void {
  if (!hasPermission(user, permissionCode)) {
    throw new Error(`FORBIDDEN: Missing required permission [${permissionCode}]`);
  }
}

/**
 * Server-side guard: asserts role.
 */
export function assertRole(user: AuthenticatedUser | null, allowedRoles: RoleSlug[]): void {
  if (!hasRole(user, allowedRoles)) {
    throw new Error(`FORBIDDEN: User role [${user?.role.slug}] is not authorized for this action.`);
  }
}

export interface NavigationItem {
  name: string;
  href: string;
  icon: string;
  module: BusinessModuleCode;
  allowedRoles: RoleSlug[];
  minScope?: ScopeLevel;
  badge?: string;
}

export const ALL_NAV_ITEMS: NavigationItem[] = [
  // 1. Core & Executive Dashboards
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: "LayoutDashboard",
    module: "CORE",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER"],
  },

  // 2. Modul Prioritas 1: Co-working Business Module
  {
    name: "Co-working Space",
    href: "/coworking",
    icon: "Laptop",
    module: "CO_WORKING",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER"],
  },
  {
    name: "Commercial & Tenancy",
    href: "/commercial",
    icon: "Building2",
    module: "COMMERCIAL",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER"],
    minScope: "ORGANIZATION",
  },

  // 3. Modul Prioritas 2: F&B Domain Module
  {
    name: "POS Kasir",
    href: "/pos",
    icon: "Calculator",
    module: "FNB",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER"],
  },
  {
    name: "Pesanan",
    href: "/orders",
    icon: "ClipboardList",
    module: "FNB",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER", "WAITER", "KITCHEN_STAFF"],
  },
  {
    name: "Meja & Area",
    href: "/tables",
    icon: "Grid",
    module: "FNB",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER", "WAITER"],
  },
  {
    name: "Kitchen KDS",
    href: "/kitchen",
    icon: "UtensilsCrossed",
    module: "FNB",
    allowedRoles: ["SUPER_ADMIN", "MANAGER", "KITCHEN_STAFF"],
  },
  {
    name: "Smart Inventory",
    href: "/inventory",
    icon: "Package",
    module: "FNB",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER", "INVENTORY_STAFF"],
  },
  {
    name: "Self-Order & Menu QR",
    href: "/customer",
    icon: "UtensilsCrossed",
    module: "FNB",
    allowedRoles: ["CUSTOMER"],
  },
  {
    name: "Pelanggan & CRM",
    href: "/customers",
    icon: "Users",
    module: "FNB",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER"],
  },

  // 4. Modul Prioritas 3: Event Marketplace Module
  {
    name: "Event Komunitas",
    href: "/events-admin",
    icon: "Calendar",
    module: "CORE",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER"],
    minScope: "ORGANIZATION",
  },
  {
    name: "Check-in Event",
    href: "/events/checkin",
    icon: "UserCheck",
    module: "CORE",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER", "WAITER", "CASHIER"],
  },

  // 5. Governance, Reports & Master Data
  {
    name: "Laporan & Finance",
    href: "/reports",
    icon: "BarChart3",
    module: "CORE",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER"],
  },
  {
    name: "Karyawan & Shift",
    href: "/employees",
    icon: "UserCheck",
    module: "CORE",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER"],
  },
  {
    name: "Audit Trail & Log",
    href: "/activity-log",
    icon: "ShieldCheck",
    module: "CORE",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER"],
    minScope: "ORGANIZATION",
  },
  {
    name: "Master Data & Pengaturan",
    href: "/settings",
    icon: "Settings",
    module: "CORE",
    allowedRoles: ["SUPER_ADMIN", "OWNER"],
    minScope: "TENANT",
  },
];

const SCOPE_HIERARCHY: Record<ScopeLevel, number> = {
  PLATFORM: 5,
  ORGANIZATION: 4,
  BUSINESS_UNIT: 3,
  TENANT: 2,
  OUTLET: 1,
};

/**
 * Evaluates whether a user is authorized to access the Event Check-In dashboard.
 * - Platform Super Admin has universal access.
 * - Hub Management (OWNER, MANAGER) with ORGANIZATION or PLATFORM scope has oversight.
 * - Users with explicit check-in or event management permissions (events:checkin, events:manage_own, *).
 * - Field staff (WAITER, CASHIER) MUST have an explicit "events:checkin" permission; role/scope alone is insufficient.
 * - Mitra F&B / Tenant accounts (scopeLevel === "TENANT" or user.tenant !== null) are STRICTLY excluded.
 * - Customer role without explicit event check-in permission is STRICTLY excluded.
 */
export function canAccessEventCheckIn(user: AuthenticatedUser | null): boolean {
  if (!user) return false;
  if (user.role.slug === "SUPER_ADMIN") return true;

  // Strict exclusion: F&B Tenant Owners and Tenant Staff must NEVER see Check-in Event
  if (user.scopeLevel === "TENANT" || (user.tenant && user.tenant.businessModule === "FNB")) {
    return false;
  }

  // Customer role has no access unless explicitly granted check-in or organizer permission
  if (
    user.role.slug === "CUSTOMER" &&
    !user.permissions.includes("events:checkin") &&
    !user.permissions.includes("events:manage_own")
  ) {
    return false;
  }

  // Hub Management oversight (SUPER_ADMIN or Hub OWNER/MANAGER with ORGANIZATION/PLATFORM scope)
  if (
    (user.role.slug === "OWNER" || user.role.slug === "MANAGER") &&
    (user.scopeLevel === "ORGANIZATION" || user.scopeLevel === "PLATFORM")
  ) {
    return true;
  }

  // Explicit permission codes (Event Staff with "events:checkin", Organizer with "events:manage_own", or "*")
  if (
    user.permissions.includes("events:checkin") ||
    user.permissions.includes("events:manage_own") ||
    user.permissions.includes("*")
  ) {
    return true;
  }

  // F&B Field staff (WAITER, CASHIER) without explicit "events:checkin" permission are STRICTLY REJECTED!
  return false;
}

/**
 * Filters dynamic navigation items based on Role + Access Scope + Active Org Modules.
 */
export function getAuthorizedNavItems(
  user: AuthenticatedUser | null,
  activeOrgModules: BusinessModuleCode[] = ["CORE", "FNB", "CO_WORKING"]
): NavigationItem[] {
  if (!user) return [];
  if (user.role.slug === "SUPER_ADMIN") return ALL_NAV_ITEMS;

  return ALL_NAV_ITEMS.filter((item) => {
    // 1. Role must match
    if (!item.allowedRoles.includes(user.role.slug)) return false;

    // 2. Minimum Scope Level check
    if (item.minScope && SCOPE_HIERARCHY[user.scopeLevel] < SCOPE_HIERARCHY[item.minScope]) {
      return false;
    }

    // 3. Dynamic role & permission rule for Check-in Event
    if (item.href === "/events/checkin" && !canAccessEventCheckIn(user)) {
      return false;
    }

    // 4. Module must be active in the organization
    if (item.module !== "CORE" && !activeOrgModules.includes(item.module)) return false;

    // 5. User's scope must permit this module
    if (
      item.module !== "CORE" &&
      user.scopeLevel !== "ORGANIZATION" &&
      user.allowedModules &&
      !user.allowedModules.includes(item.module)
    ) {
      return false;
    }

    return true;
  }).map((item) => {
    if (item.href === "/settings" && user.scopeLevel === "TENANT") {
      return { ...item, name: "Master Data Mitra" };
    }
    return item;
  });
}
