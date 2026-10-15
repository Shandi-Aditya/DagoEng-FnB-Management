import { NextRequest } from "next/server";
import { RoleSlug, ScopeLevel } from "@/types/auth";

export interface ServerAuthResult {
  isAuthenticated: boolean;
  role: RoleSlug | null;
  userId: string | null;
  scopeLevel: ScopeLevel | null;
  error?: string;
}

const AUTHORIZED_ADMIN_ROLES: RoleSlug[] = ["SUPER_ADMIN", "OWNER", "MANAGER"];
const AUTHORIZED_MODERATION_SCOPES: ScopeLevel[] = ["PLATFORM", "ORGANIZATION"];

/**
 * Extracts and validates user identity, role, and access scope from server request.
 * Checks request headers (`x-user-role`, `x-user-id`, `x-user-scope`) and cookies.
 */
export function getRequestAuthUser(req: NextRequest): ServerAuthResult {
  // 1. Check custom headers passed from dashboard client
  const headerRole = req.headers.get("x-user-role") as RoleSlug | null;
  const headerUserId = req.headers.get("x-user-id");
  const headerScope = req.headers.get("x-user-scope") as ScopeLevel | null;

  if (headerRole) {
    // If scope is not explicitly provided in headers, infer safely:
    // SUPER_ADMIN defaults to PLATFORM; otherwise defaults to TENANT unless specified
    const inferredScope: ScopeLevel =
      headerScope || (headerRole === "SUPER_ADMIN" ? "PLATFORM" : "TENANT");

    return {
      isAuthenticated: true,
      role: headerRole,
      userId: headerUserId || "header-user",
      scopeLevel: inferredScope,
    };
  }

  // 2. Check cookies
  const cookieRole = req.cookies.get("dagoeng_role")?.value as RoleSlug | undefined;
  const cookiePersona = req.cookies.get("dagoeng_active_persona")?.value;
  const cookieScope = req.cookies.get("dagoeng_scope")?.value as ScopeLevel | undefined;

  if (cookieRole) {
    const inferredScope: ScopeLevel =
      cookieScope || (cookieRole === "SUPER_ADMIN" ? "PLATFORM" : "TENANT");

    return {
      isAuthenticated: true,
      role: cookieRole,
      userId: req.cookies.get("dagoeng_user_id")?.value || "cookie-user",
      scopeLevel: inferredScope,
    };
  }

  // Fallback for persona mapping
  if (cookiePersona) {
    if (cookiePersona === "DAGO_OWNER") {
      return { isAuthenticated: true, role: "OWNER", scopeLevel: "ORGANIZATION", userId: "cookie-dago-owner" };
    }
    if (cookiePersona.startsWith("TENANT_OWNER")) {
      // Tenant stall owners only have TENANT scope
      return { isAuthenticated: true, role: "OWNER", scopeLevel: "TENANT", userId: "cookie-tenant-owner" };
    }
    if (cookiePersona === "SUPER_ADMIN") {
      return { isAuthenticated: true, role: "SUPER_ADMIN", scopeLevel: "PLATFORM", userId: "cookie-admin" };
    }
    if (cookiePersona.includes("MANAGER")) {
      return { isAuthenticated: true, role: "MANAGER", scopeLevel: "ORGANIZATION", userId: "cookie-manager" };
    }
    if (cookiePersona.includes("CASHIER")) {
      return { isAuthenticated: true, role: "CASHIER", scopeLevel: "OUTLET", userId: "cookie-cashier" };
    }
    if (cookiePersona.includes("KITCHEN")) {
      return { isAuthenticated: true, role: "KITCHEN_STAFF", scopeLevel: "OUTLET", userId: "cookie-kitchen" };
    }
    if (cookiePersona.includes("CUSTOMER")) {
      return { isAuthenticated: true, role: "CUSTOMER", scopeLevel: "OUTLET", userId: "cookie-customer" };
    }
  }

  return {
    isAuthenticated: false,
    role: null,
    userId: null,
    scopeLevel: null,
    error: "Autentikasi diperlukan. Sesi tidak ditemukan.",
  };
}

/**
 * Validates that the request has an admin role and scope authorized to moderate events.
 * Crucial: Only Hub Management (PLATFORM and ORGANIZATION) can moderate events.
 * Tenant Owners (TENANT scope) and Outlet staff (OUTLET scope) are strictly forbidden.
 */
export function assertEventAdmin(req: NextRequest): {
  authorized: boolean;
  error?: string;
  role?: RoleSlug;
  scopeLevel?: ScopeLevel;
  userId?: string;
} {
  const auth = getRequestAuthUser(req);

  if (!auth.isAuthenticated || !auth.role) {
    return {
      authorized: false,
      error: "UNAUTHORIZED: Anda harus login untuk mengakses panel moderasi event.",
    };
  }

  // 1. Check Role
  if (!AUTHORIZED_ADMIN_ROLES.includes(auth.role)) {
    return {
      authorized: false,
      error: `FORBIDDEN: Role [${auth.role}] tidak memiliki izin untuk mengelola atau memoderasi event.`,
    };
  }

  // 2. Check Scope: Community events are shared hub amenities
  // Tenant owners only govern their individual F&B stall, not the creative hub's public events!
  const userScope: ScopeLevel =
    auth.scopeLevel || (auth.role === "SUPER_ADMIN" ? "PLATFORM" : "TENANT");

  if (!AUTHORIZED_MODERATION_SCOPES.includes(userScope)) {
    return {
      authorized: false,
      error: `FORBIDDEN: Pengguna dengan cakupan [${userScope}] tidak berhak memoderasi event publik Dago Creative Hub. Hak moderasi terbatas pada pengelola tingkat ORGANIZATION atau PLATFORM.`,
    };
  }

  return {
    authorized: true,
    role: auth.role,
    scopeLevel: userScope,
    userId: auth.userId || undefined,
  };
}
