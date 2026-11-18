import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { RoleSlug, ScopeLevel } from "@/types/auth";
import { evaluateRouteAccess } from "@/lib/route-guard";
import {
  EDGE_SESSION_COOKIE_NAME,
  verifyEdgeSessionToken,
  isPersonaCookieAllowedInEnv,
} from "@/lib/edge-session";

const PERSONA_ROLE_MAP: Record<string, { role: RoleSlug; scopeLevel: ScopeLevel }> = {
  DAGO_OWNER: { role: "OWNER", scopeLevel: "ORGANIZATION" },
  HUB_OWNER: { role: "OWNER", scopeLevel: "ORGANIZATION" },
  HUB_MANAGER: { role: "MANAGER", scopeLevel: "ORGANIZATION" },
  TENANT_OWNER: { role: "OWNER", scopeLevel: "TENANT" },
  TENANT_OWNER_KS: { role: "OWNER", scopeLevel: "TENANT" },
  TENANT_OWNER_KITCHEN: { role: "OWNER", scopeLevel: "TENANT" },
  TENANT_OWNER_BAKERY: { role: "OWNER", scopeLevel: "TENANT" },
  TENANT_OWNER_TEA: { role: "OWNER", scopeLevel: "TENANT" },
  COWORK_MANAGER: { role: "MANAGER", scopeLevel: "ORGANIZATION" },
  COMMERCIAL_MANAGER: { role: "MANAGER", scopeLevel: "ORGANIZATION" },
  CASHIER_SGR: { role: "CASHIER", scopeLevel: "OUTLET" },
  CASHIER: { role: "CASHIER", scopeLevel: "OUTLET" },
  KITCHEN_SGR: { role: "KITCHEN_STAFF", scopeLevel: "OUTLET" },
  WAITER_SGR: { role: "WAITER", scopeLevel: "OUTLET" },
  CUSTOMER_DEMO: { role: "CUSTOMER", scopeLevel: "OUTLET" },
  CUSTOMER: { role: "CUSTOMER", scopeLevel: "OUTLET" },
  SUPER_ADMIN: { role: "SUPER_ADMIN", scopeLevel: "PLATFORM" },
  COMMUNITY_BARISTA: { role: "CUSTOMER", scopeLevel: "OUTLET" },
  COMMUNITY_BANDUNGDEV: { role: "CUSTOMER", scopeLevel: "OUTLET" },
  COMMUNITY_AKSARAPRIANGAN: { role: "CUSTOMER", scopeLevel: "OUTLET" },
  EVENT_STAFF: { role: "CHECKIN_STAFF", scopeLevel: "ORGANIZATION" },
};

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  let userRole: RoleSlug | null = null;
  let userScope: ScopeLevel | null = null;
  let isSessionExpired = false;

  const edgeToken = request.cookies.get(EDGE_SESSION_COOKIE_NAME)?.value;
  if (edgeToken) {
    const verification = verifyEdgeSessionToken(edgeToken);
    if (verification.valid && verification.payload) {
      userRole = verification.payload.role;
      userScope = verification.payload.scopeLevel || null;
    } else if (verification.expired) {
      isSessionExpired = true;
    }
  }

  if (!userRole && !isSessionExpired) {
    const personaCookie = request.cookies.get("dagoeng_active_persona")?.value;
    const personaEntry = personaCookie ? PERSONA_ROLE_MAP[personaCookie] : undefined;
    if (personaEntry && isPersonaCookieAllowedInEnv(personaEntry.role, personaEntry.scopeLevel)) {
      const personaExpCookie = request.cookies.get("dagoeng_persona_exp")?.value;
      if (personaExpCookie !== undefined) {
        const expMs = Number(personaExpCookie);
        if (!Number.isFinite(expMs) || expMs <= Date.now()) {
          isSessionExpired = true;
        } else {
          userRole = personaEntry.role;
          userScope = personaEntry.scopeLevel;
        }
      } else {
        userRole = personaEntry.role;
        userScope = personaEntry.scopeLevel;
      }
    }
  }

  const evaluation = evaluateRouteAccess(pathname, userRole, userScope, isSessionExpired);

  if (!evaluation.allowed) {
    const redirectUrl = new URL(evaluation.redirectTo || "/login", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/pos/:path*",
    "/kitchen/:path*",
    "/tables/:path*",
    "/waiter/:path*",
    "/orders/:path*",
    "/events/checkin/:path*",
    "/events-admin/:path*",
    "/dashboard/:path*",
    "/reports/:path*",
    "/commercial/:path*",
    "/coworking/:path*",
    "/employees/:path*",
    "/settings/:path*",
    "/inventory/:path*",
    "/customers/:path*",
    "/activity-log/:path*",
    "/ai-insight/:path*",
    "/menu/:path*",
  ],
};
