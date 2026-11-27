import { RoleSlug, ScopeLevel } from "@/types/auth";

export interface RouteAccessEvaluation {
  allowed: boolean;
  redirectTo?: string;
  reason?: string;
}

export const TENANT_OWNER_BLOCKED_PREFIXES: readonly string[] = [
  "/coworking",
  "/commercial",
  "/employees",
  "/events-admin",
  "/activity-log",
  "/customers",
  "/events/checkin",
];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

/**
 * Authoritative route permission matrix for server-side Next.js middleware and route guards.
 */
export const ROUTE_PERMISSIONS: { prefix: string; allowedRoles: RoleSlug[] }[] = [
  {
    prefix: "/pos",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER"],
  },
  {
    prefix: "/kitchen",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER", "KITCHEN_STAFF"],
  },
  {
    prefix: "/tables",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER", "WAITER", "CASHIER"],
  },
  {
    prefix: "/waiter",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER", "WAITER"],
  },
  {
    prefix: "/events/checkin",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER", "CHECKIN_STAFF"],
  },
  {
    prefix: "/events-admin",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER"],
  },
  {
    prefix: "/dashboard",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER"],
  },
  {
    prefix: "/reports",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER", "FINANCE"],
  },
  {
    prefix: "/commercial",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER"],
  },
  {
    prefix: "/coworking",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER"],
  },
  {
    prefix: "/employees",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER"],
  },
  {
    prefix: "/settings",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER"],
  },
  {
    prefix: "/inventory",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER", "INVENTORY_STAFF"],
  },
  {
    prefix: "/orders",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER", "WAITER", "KITCHEN_STAFF"],
  },
  {
    prefix: "/customers",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER"],
  },
  {
    prefix: "/activity-log",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER"],
  },
  {
    prefix: "/ai-insight",
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER"],
  },
  {
    prefix: "/menu",
    allowedRoles: ["SUPER_ADMIN", "OWNER"],
  },
];

/**
 * Default fallback destination when a role tries to navigate to an unauthorized route.
 */
export function getDefaultRouteForRole(role: RoleSlug | null): string {
  switch (role) {
    case "CASHIER":
      return "/pos";
    case "KITCHEN_STAFF":
      return "/kitchen";
    case "WAITER":
      return "/tables";
    case "CHECKIN_STAFF":
      return "/events/checkin";
    case "INVENTORY_STAFF":
      return "/inventory";
    case "FINANCE":
      return "/reports";
    case "CUSTOMER":
      return "/customer";
    case "SUPER_ADMIN":
    case "OWNER":
    case "MANAGER":
    default:
      return "/dashboard";
  }
}

/**
 * Checks whether a given path is an inherently public route.
 */
export function isPublicRoute(pathname: string): boolean {
  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/customer" ||
    pathname.startsWith("/customer/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images") ||
    pathname === "/api/system/health" ||
    pathname.startsWith("/api/system/health/") ||
    pathname === "/favicon.ico"
  ) {
    return true;
  }
  return false;
}

export function evaluateRouteAccess(
  pathname: string,
  role: RoleSlug | null,
  scopeLevel?: ScopeLevel | null,
  isSessionExpired?: boolean
): RouteAccessEvaluation;
export function evaluateRouteAccess(
  pathname: string,
  role: RoleSlug | null,
  isSessionExpired?: boolean,
  scopeLevel?: ScopeLevel | null
): RouteAccessEvaluation;
export function evaluateRouteAccess(
  pathname: string,
  role: RoleSlug | null,
  scopeOrExpired?: ScopeLevel | boolean | null,
  expiredOrScope?: boolean | ScopeLevel | null
): RouteAccessEvaluation {
  const isSessionExpired =
    typeof scopeOrExpired === "boolean"
      ? scopeOrExpired
      : typeof expiredOrScope === "boolean"
        ? expiredOrScope
        : false;
  const scopeLevel: ScopeLevel | null =
    typeof scopeOrExpired === "string"
      ? scopeOrExpired
      : typeof expiredOrScope === "string"
        ? expiredOrScope
        : null;

  if (isPublicRoute(pathname)) {
    return { allowed: true };
  }

  if (isSessionExpired) {
    return {
      allowed: false,
      redirectTo: `/login?reason=expired&returnTo=${encodeURIComponent(pathname)}`,
      reason: "SESSION_EXPIRED",
    };
  }

  if (!role) {
    return {
      allowed: false,
      redirectTo: `/login?returnTo=${encodeURIComponent(pathname)}`,
      reason: "UNAUTHENTICATED",
    };
  }

  if (role === "SUPER_ADMIN") {
    return { allowed: true };
  }

  if (
    role === "OWNER" &&
    scopeLevel === "TENANT" &&
    TENANT_OWNER_BLOCKED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))
  ) {
    return {
      allowed: false,
      redirectTo: "/dashboard",
      reason: `FORBIDDEN: Tenant OWNER is not authorized to access ${pathname}`,
    };
  }

  const matchingRule = ROUTE_PERMISSIONS.find((rule) => matchesPrefix(pathname, rule.prefix));

  if (!matchingRule) {
    return { allowed: true };
  }

  if (matchingRule.allowedRoles.includes(role)) {
    return { allowed: true };
  }

  const fallback = getDefaultRouteForRole(role);
  return {
    allowed: false,
    redirectTo: fallback,
    reason: `FORBIDDEN: Role [${role}] is not authorized to access ${pathname}`,
  };
}
