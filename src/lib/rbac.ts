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
 * Checks if the user has a specific permission code.
 */
export function hasPermission(user: AuthenticatedUser | null, permissionCode: PermissionCode): boolean {
  if (!user) return false;
  if (user.role.slug === "SUPER_ADMIN") return true;
  return user.permissions.includes(permissionCode);
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

  // 2. F&B Domain Module
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
    name: "Menu & Produk (COGS)",
    href: "/menu",
    icon: "BookOpen",
    module: "FNB",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER"],
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

  // 3. Co-working Business Module
  {
    name: "Co-working Space",
    href: "/coworking",
    icon: "Laptop",
    module: "CO_WORKING",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER"],
  },

  // 4. Commercial Business Module
  {
    name: "Commercial Leases",
    href: "/commercial",
    icon: "Building2",
    module: "COMMERCIAL",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER"],
  },

  // 5. Reports, Staff & Intelligence
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
    name: "AI Business Insight",
    href: "/ai-insight",
    icon: "Sparkles",
    module: "CORE",
    allowedRoles: ["SUPER_ADMIN", "OWNER"],
  },
  {
    name: "Audit Trail & Log",
    href: "/activity-log",
    icon: "ShieldCheck",
    module: "CORE",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER"],
  },
  {
    name: "Pengaturan Platform",
    href: "/settings",
    icon: "Settings",
    module: "CORE",
    allowedRoles: ["SUPER_ADMIN", "OWNER"],
  },
];

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

    // 2. Module must be active in the organization
    if (item.module !== "CORE" && !activeOrgModules.includes(item.module)) return false;

    // 3. User's scope must permit this module
    if (
      item.module !== "CORE" &&
      user.scopeLevel !== "ORGANIZATION" &&
      user.allowedModules &&
      !user.allowedModules.includes(item.module)
    ) {
      return false;
    }

    return true;
  });
}
