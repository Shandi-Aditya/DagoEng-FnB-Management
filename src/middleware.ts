import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { RoleSlug } from "@/types/auth";
import { evaluateRouteAccess } from "@/lib/route-guard";

const PERSONA_ROLE_MAP: Record<string, RoleSlug> = {
  DAGO_OWNER: "OWNER",
  HUB_OWNER: "OWNER",
  HUB_MANAGER: "MANAGER",
  TENANT_OWNER: "OWNER",
  TENANT_OWNER_KS: "OWNER",
  TENANT_OWNER_KITCHEN: "OWNER",
  TENANT_OWNER_BAKERY: "OWNER",
  TENANT_OWNER_TEA: "OWNER",
  COWORK_MANAGER: "MANAGER",
  COMMERCIAL_MANAGER: "MANAGER",
  CASHIER_SGR: "CASHIER",
  CASHIER: "CASHIER",
  KITCHEN_SGR: "KITCHEN_STAFF",
  WAITER_SGR: "WAITER",
  CUSTOMER_DEMO: "CUSTOMER",
  CUSTOMER: "CUSTOMER",
  SUPER_ADMIN: "SUPER_ADMIN",
  COMMUNITY_BARISTA: "CUSTOMER",
  COMMUNITY_BANDUNGDEV: "CUSTOMER",
  COMMUNITY_AKSARAPRIANGAN: "CUSTOMER",
  EVENT_STAFF: "CHECKIN_STAFF",
};

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Resolve user role from cookies
  let userRole: RoleSlug | null = null;
  const personaCookie = request.cookies.get("dagoeng_active_persona")?.value;
  const sessionRoleCookie = request.cookies.get("dagoeng_session_role")?.value;

  if (personaCookie && PERSONA_ROLE_MAP[personaCookie]) {
    userRole = PERSONA_ROLE_MAP[personaCookie];
  } else if (sessionRoleCookie) {
    userRole = sessionRoleCookie as RoleSlug;
  }

  // Check route permissions
  const evaluation = evaluateRouteAccess(pathname, userRole);

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
    "/events/checkin/:path*",
    "/events-admin/:path*",
    "/dashboard/:path*",
    "/reports/:path*",
    "/commercial/:path*",
    "/coworking/:path*",
    "/employees/:path*",
    "/settings/:path*",
    "/inventory/:path*",
  ],
};
