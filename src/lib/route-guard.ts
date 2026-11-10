import { RoleSlug } from "@/types/auth";

export interface RouteAccessEvaluation {
  allowed: boolean;
  redirectTo?: string;
  reason?: string;
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
    allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER"],
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
    pathname.startsWith("/customer") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/api/system/health") ||
    pathname === "/favicon.ico"
  ) {
    return true;
  }
  return false;
}

/**
 * Evaluates route access for a requested pathname and role.
 */
export function evaluateRouteAccess(
  pathname: string,
  role: RoleSlug | null,
  isSessionExpired: boolean = false
): RouteAccessEvaluation {
  if (isPublicRoute(pathname)) {
    return { allowed: true };
  }

  // Handle expired sessions
  if (isSessionExpired) {
    return {
      allowed: false,
      redirectTo: `/login?reason=expired&returnTo=${encodeURIComponent(pathname)}`,
      reason: "SESSION_EXPIRED",
    };
  }

  // Handle unauthenticated requests
  if (!role) {
    return {
      allowed: false,
      redirectTo: `/login?returnTo=${encodeURIComponent(pathname)}`,
      reason: "UNAUTHENTICATED",
    };
  }

  // SUPER_ADMIN has platform-wide unrestricted access
  if (role === "SUPER_ADMIN") {
    return { allowed: true };
  }

  // Check matching route configuration
  const matchingRule = ROUTE_PERMISSIONS.find((rule) => {
    return pathname === rule.prefix || pathname.startsWith(rule.prefix + "/");
  });

  if (!matchingRule) {
    // Unmatched routes inside dashboard layout default to authenticated access
    return { allowed: true };
  }

  if (matchingRule.allowedRoles.includes(role)) {
    return { allowed: true };
  }

  // Role is not permitted for this route: redirect to their default home
  const fallback = getDefaultRouteForRole(role);
  return {
    allowed: false,
    redirectTo: fallback,
    reason: `FORBIDDEN: Role [${role}] is not authorized to access ${pathname}`,
  };
}
