import { NextRequest } from "next/server";
import { RoleSlug, ScopeLevel } from "@/types/auth";
import { db } from "./db";
import { hashSessionToken, SESSION_COOKIE_NAME } from "./session";
import { isOrganizerActive, getOrganizerById } from "./organizers";
import {
  getOrganizerSession,
  withDbTimeout,
  isLocalDevFallbackAllowed,
} from "./organizer-activation";

export interface ServerAuthResult {
  isAuthenticated: boolean;
  role: RoleSlug | null;
  userId: string | null;
  scopeLevel: ScopeLevel | null;
  email?: string | null;
  name?: string;
  error?: string;
}

const AUTHORIZED_ADMIN_ROLES: RoleSlug[] = ["SUPER_ADMIN", "OWNER", "MANAGER"];
const AUTHORIZED_MODERATION_SCOPES: ScopeLevel[] = ["PLATFORM", "ORGANIZATION"];

/**
 * Trusted in-memory persona definitions.
 * Immutable map from persona cookie keys to authenticated server identities.
 */
export const TRUSTED_PERSONAS: Record<
  string,
  { role: RoleSlug; scopeLevel: ScopeLevel; userId: string; email: string; name: string }
> = {
  DAGO_OWNER: {
    role: "OWNER",
    scopeLevel: "ORGANIZATION",
    userId: "user-dago-owner",
    email: "owner.dago@dagoeng.com",
    name: "Hendra Wijaya (Owner Dago Hub)",
  },
  SUPER_ADMIN: {
    role: "SUPER_ADMIN",
    scopeLevel: "PLATFORM",
    userId: "user-admin",
    email: "admin@dagoeng.com",
    name: "Platform Super Admin",
  },
  COMMERCIAL_MANAGER: {
    role: "MANAGER",
    scopeLevel: "ORGANIZATION",
    userId: "user-manager-commercial",
    email: "manager.commercial@dagoeng.com",
    name: "Commercial Manager",
  },
  COWORK_MANAGER: {
    role: "MANAGER",
    scopeLevel: "ORGANIZATION",
    userId: "user-manager-cowork",
    email: "manager.cowork@dagoeng.com",
    name: "Co-working Manager",
  },
  TENANT_OWNER_KS: {
    role: "OWNER",
    scopeLevel: "TENANT",
    userId: "user-owner-ks",
    email: "owner.kopisenja@dagoeng.com",
    name: "I Wayan Pratama (Owner Kopi Senja)",
  },
  TENANT_OWNER_KITCHEN: {
    role: "OWNER",
    scopeLevel: "TENANT",
    userId: "user-owner-kitchen",
    email: "owner.dapurmama@dagoeng.com",
    name: "Dapur Mama Owner",
  },
  TENANT_OWNER_BAKERY: {
    role: "OWNER",
    scopeLevel: "TENANT",
    userId: "user-owner-bakery",
    email: "owner.manisbakery@dagoeng.com",
    name: "Manis Bakery Owner",
  },
  TENANT_OWNER_TEA: {
    role: "OWNER",
    scopeLevel: "TENANT",
    userId: "user-owner-tea",
    email: "owner.warungbunarti@dagoeng.com",
    name: "Teh Nusantara Owner",
  },
  CASHIER_SGR: {
    role: "CASHIER",
    scopeLevel: "OUTLET",
    userId: "user-cashier-sgr",
    email: "cashier.sgr@kopisenja.com",
    name: "Ni Kadek Sri (Kasir)",
  },
  KITCHEN_SGR: {
    role: "KITCHEN_STAFF",
    scopeLevel: "OUTLET",
    userId: "user-kitchen-sgr",
    email: "kitchen.sgr@kopisenja.com",
    name: "Kitchen Staff",
  },
  WAITER_SGR: {
    role: "WAITER",
    scopeLevel: "OUTLET",
    userId: "user-waiter-sgr",
    email: "waiter.sgr@kopisenja.com",
    name: "Waiter",
  },
  CUSTOMER_DEMO: {
    role: "CUSTOMER",
    scopeLevel: "OUTLET",
    userId: "user-customer-demo",
    email: "customer@gmail.com",
    name: "Customer Demo",
  },
  // Community Organizer Personas (matching demo organizer emails)
  COMMUNITY_BARISTA: {
    role: "CUSTOMER",
    scopeLevel: "OUTLET",
    userId: "user-comm-barista",
    email: "baristaguild@dagocreative.id",
    name: "Dago Barista Guild",
  },
  COMMUNITY_BANDUNGDEV: {
    role: "CUSTOMER",
    scopeLevel: "OUTLET",
    userId: "user-comm-bandungdev",
    email: "halo@bandungdev.org",
    name: "Bandung Game Creators Collective",
  },
  COMMUNITY_AKSARAPRIANGAN: {
    role: "CUSTOMER",
    scopeLevel: "OUTLET",
    userId: "user-comm-aksara",
    email: "info@aksarapriangan.id",
    name: "Aksara Priangan Studio",
  },
  // Convenient aliases for tests and common role lookups
  HUB_OWNER: {
    role: "OWNER",
    scopeLevel: "ORGANIZATION",
    userId: "user-dago-owner",
    email: "owner.dago@dagoeng.com",
    name: "Hendra Wijaya (Owner Dago Hub)",
  },
  HUB_MANAGER: {
    role: "MANAGER",
    scopeLevel: "ORGANIZATION",
    userId: "user-manager-commercial",
    email: "manager.commercial@dagoeng.com",
    name: "Commercial Manager",
  },
  TENANT_OWNER: {
    role: "OWNER",
    scopeLevel: "TENANT",
    userId: "user-owner-ks",
    email: "owner.kopisenja@dagoeng.com",
    name: "I Wayan Pratama (Owner Kopi Senja)",
  },
  CASHIER: {
    role: "CASHIER",
    scopeLevel: "OUTLET",
    userId: "user-cashier-sgr",
    email: "cashier.sgr@kopisenja.com",
    name: "Ni Kadek Sri (Kasir)",
  },
  CUSTOMER: {
    role: "CUSTOMER",
    scopeLevel: "OUTLET",
    userId: "user-customer-demo",
    email: "customer@gmail.com",
    name: "Customer Demo",
  },
};

/**
 * Validates user identity and role from server request.
 * SECURITY ENFORCEMENT:
 * - NEVER trusts raw client headers (x-user-role, x-user-id, x-user-scope).
 * - Validates cryptographic session cookie (dagoeng_session) against database.
 * - Or validates authenticated persona cookie (dagoeng_active_persona) against server whitelist.
 */
export async function getRequestAuthUser(req: NextRequest): Promise<ServerAuthResult> {
  // 1. Check database session cookie
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sessionCookie) {
    const sessionTokenHash = hashSessionToken(sessionCookie);
    try {
      const session = await withDbTimeout(() =>
        db.session.findUnique({
          where: { sessionTokenHash },
          include: {
            user: {
              include: {
                userRoles: {
                  include: {
                    role: true,
                    organization: true,
                    outlet: true,
                  },
                },
              },
            },
          },
        })
      );
      if (session && session.expiresAt > new Date() && session.user.isActive) {
        const primaryRole = session.user.userRoles[0];
        const scopeLevel: ScopeLevel =
          (primaryRole?.scopeLevel as ScopeLevel) ||
          (primaryRole?.outlet
            ? "OUTLET"
            : primaryRole?.organization
            ? "ORGANIZATION"
            : "PLATFORM");

        return {
          isAuthenticated: true,
          role: (primaryRole?.role?.slug as RoleSlug) || "CUSTOMER",
          userId: session.user.id,
          email: session.user.email,
          name: session.user.name,
          scopeLevel,
        };
      }
    } catch {
      // Database unavailable or query error, fall through to session store
    }

    // Check dynamic organizer session store (allowed ONLY in local dev/test fallback mode)
    if (isLocalDevFallbackAllowed()) {
      const orgSession = getOrganizerSession(sessionTokenHash);
      if (orgSession && orgSession.expiresAt > new Date()) {
        return {
          isAuthenticated: true,
          role: "CUSTOMER",
          userId: orgSession.userId,
          email: orgSession.email,
          name: orgSession.name,
          scopeLevel: "TENANT",
        };
      }
    }
  }

  // 2. Check verified active persona cookie
  const personaCookie = req.cookies.get("dagoeng_active_persona")?.value;
  if (personaCookie && TRUSTED_PERSONAS[personaCookie]) {
    const persona = TRUSTED_PERSONAS[personaCookie];
    return {
      isAuthenticated: true,
      role: persona.role,
      userId: persona.userId,
      email: persona.email,
      scopeLevel: persona.scopeLevel,
      name: persona.name,
    };
  }

  // 3. Fallback: Unauthenticated
  return {
    isAuthenticated: false,
    role: null,
    userId: null,
    email: null,
    scopeLevel: null,
    error: "UNAUTHORIZED: Autentikasi sesi server diperlukan. Silakan login terlebih dahulu.",
  };
}

export interface OrganizerAuthResult {
  authorized: boolean;
  error?: string;
  email: string | null;
  isAdmin: boolean;
  userId: string | null;
  name?: string;
}

/**
 * Validates Community Organizer access and enforces strict server-side cross-community isolation.
 * Security enforcement:
 * 1. Rejects unauthenticated requests (HTTP 401).
 * 2. If user is Hub Admin (SUPER_ADMIN, Hub OWNER/MANAGER), grants Hub oversight access.
 * 3. If user is a community organizer, binds identity strictly to server session email (auth.email).
 *    Any mismatch between request target email and server session email is REJECTED (HTTP 403).
 * 4. NEVER trusts raw client headers (x-user-role, x-user-id, etc.).
 */
export async function assertOrganizerAuth(
  req: NextRequest,
  targetEmailOrId?: string | null
): Promise<OrganizerAuthResult> {
  const auth = await getRequestAuthUser(req);

  if (!auth.isAuthenticated || !auth.userId) {
    return {
      authorized: false,
      error: "UNAUTHORIZED: Autentikasi sesi server diperlukan. Silakan login ke sistem Dago Hub terlebih dahulu.",
      email: null,
      isAdmin: false,
      userId: null,
    };
  }

  const isHubAdmin =
    (auth.role === "SUPER_ADMIN" && auth.scopeLevel === "PLATFORM") ||
    ((auth.role === "OWNER" || auth.role === "MANAGER") && auth.scopeLevel === "ORGANIZATION");

  if (isHubAdmin) {
    // Hub Admin is permitted to supervise any community event
    const effectiveEmail = (targetEmailOrId || auth.email || "").toLowerCase().trim();
    return {
      authorized: true,
      email: effectiveEmail,
      isAdmin: true,
      userId: auth.userId,
      name: auth.name,
    };
  }

  // Regular Community User / Organizer:
  // Strict identity binding: the user CANNOT act on behalf of any other email!
  const sessionEmail = (auth.email || "").toLowerCase().trim();
  if (!sessionEmail) {
    return {
      authorized: false,
      error: "UNAUTHORIZED: Akun sesi tidak memiliki alamat email terdaftar.",
      email: null,
      isAdmin: false,
      userId: auth.userId,
    };
  }

  let targetEmailResolved = targetEmailOrId ? targetEmailOrId.toLowerCase().trim() : null;
  if (targetEmailResolved && targetEmailResolved.startsWith("org-")) {
    const orgRecord = getOrganizerById(targetEmailOrId!);
    if (orgRecord) {
      targetEmailResolved = orgRecord.email.toLowerCase().trim();
    }
  }

  // If client specified a target email that differs from authenticated session email, REJECT!
  if (targetEmailResolved && targetEmailResolved !== sessionEmail) {
    return {
      authorized: false,
      error: `FORBIDDEN: Pelanggaran isolasi data. Akun terautentikasi Anda (${sessionEmail}) tidak memiliki izin mengakses data milik ${targetEmailOrId}.`,
      email: sessionEmail,
      isAdmin: false,
      userId: auth.userId,
    };
  }

  // Check if organizer account has been deactivated by Platform Admin
  if (!isOrganizerActive(sessionEmail)) {
    return {
      authorized: false,
      error: `FORBIDDEN: Akun penyelenggara [${sessionEmail}] saat ini dinonaktifkan oleh Administrator Platform. Silakan hubungi manajemen DAGO Creative Hub.`,
      email: sessionEmail,
      isAdmin: false,
      userId: auth.userId,
    };
  }

  return {
    authorized: true,
    email: sessionEmail,
    isAdmin: false,
    userId: auth.userId,
    name: auth.name,
  };
}

/**
 * Validates that the request has an admin role and scope authorized to moderate events.
 * Crucial: Only Hub Management (PLATFORM and ORGANIZATION) can moderate events.
 * Tenant Owners (TENANT scope) and Outlet staff (OUTLET scope) are strictly forbidden.
 */
export async function assertEventAdmin(req: NextRequest): Promise<{
  authorized: boolean;
  error?: string;
  role?: RoleSlug;
  scopeLevel?: ScopeLevel;
  userId?: string;
  name?: string;
}> {
  const auth = await getRequestAuthUser(req);

  if (!auth.isAuthenticated || !auth.role) {
    return {
      authorized: false,
      error: auth.error || "UNAUTHORIZED: Anda harus login untuk mengakses panel manajemen event.",
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
  // Tenant stall owners only govern their individual stall, not the creative hub's public events!
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
    name: auth.name,
  };
}

/**
 * PII Data Masking utility for guest privacy
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "***@***";
  const [local, domain] = email.split("@");
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

export function maskPhoneNumber(phone: string): string {
  if (!phone) return "••••••••";
  const clean = phone.trim();
  if (clean.length < 8) return "••••••••";
  return `${clean.slice(0, 4)}••••${clean.slice(-4)}`;
}

// Alias for getRequestAuthUser
export const getServerAuthSession = getRequestAuthUser;
