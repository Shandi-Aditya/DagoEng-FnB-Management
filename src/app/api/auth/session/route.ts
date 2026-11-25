import { NextRequest, NextResponse } from "next/server";
import { EDGE_SESSION_COOKIE_NAME } from "@/lib/edge-session";
import { getRequestAuthUser, TRUSTED_PERSONAS } from "@/lib/server-auth";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { getLatestRevocation, revokeUserSessionsAfter } from "@/lib/session-revocation";
import { updateUnifiedUserCredentialsOrRole } from "@/lib/unified-account";
import { updateTenantOwnerPassword } from "@/lib/tenant-activation";

export const dynamic = "force-dynamic";

const HTTPONLY_COOKIE_OPTIONS = {
  value: "",
  path: "/",
  httpOnly: true,
  maxAge: 0,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

const CLIENT_COOKIE_OPTIONS = {
  value: "",
  path: "/",
  maxAge: 0,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

function clearAuthCookies(res: NextResponse): void {
  res.cookies.set({ name: SESSION_COOKIE_NAME, ...HTTPONLY_COOKIE_OPTIONS });
  res.cookies.set({ name: EDGE_SESSION_COOKIE_NAME, ...HTTPONLY_COOKIE_OPTIONS });
  res.cookies.set({ name: "dagoeng_session_role", ...HTTPONLY_COOKIE_OPTIONS });
  res.cookies.set({ name: "dagoeng_active_persona", ...CLIENT_COOKIE_OPTIONS });
  res.cookies.set({ name: "dagoeng_persona_exp", ...CLIENT_COOKIE_OPTIONS });
}

function mapToUnifiedRole(role?: string): "CUSTOMER" | "STAFF" | "ADMIN" | undefined {
  if (!role) return undefined;
  if (role === "ADMIN" || role === "SUPER_ADMIN" || role === "OWNER" || role === "MANAGER") {
    return "ADMIN";
  }
  if (role === "CUSTOMER") {
    return "CUSTOMER";
  }
  return "STAFF";
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    const hasEdgeToken = Boolean(req.cookies.get(EDGE_SESSION_COOKIE_NAME)?.value);
    const nonEdgeRevokedAt =
      auth.isAuthenticated && !hasEdgeToken
        ? await getLatestRevocation(auth.userId, auth.email)
        : 0;

    if (!auth.isAuthenticated || !auth.userId || nonEdgeRevokedAt > 0) {
      const code = auth.error === "SESSION_EXPIRED" ? "SESSION_EXPIRED" : "SESSION_REVOKED";
      const res = NextResponse.json(
        {
          authenticated: false,
          code,
          error: auth.error || "SESSION_REVOKED",
        },
        { status: 401 }
      );
      clearAuthCookies(res);
      return res;
    }

    return NextResponse.json({
      authenticated: true,
      user: auth,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        authenticated: false,
        code: "SESSION_ERROR",
        error: error?.message || "Gagal memverifikasi sesi server.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.userId) {
      return NextResponse.json(
        { success: false, error: auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const targetEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : undefined;
    const newRole = typeof body.newRole === "string" ? body.newRole.trim().toUpperCase() : undefined;
    const newScopeLevel =
      typeof body.newScopeLevel === "string" ? body.newScopeLevel.trim().toUpperCase() : undefined;
    const newTenantId = typeof body.newTenantId === "string" ? body.newTenantId.trim() : undefined;

    if (!targetEmail) {
      return NextResponse.json(
        { success: false, error: "Alamat email target wajib diisi." },
        { status: 400 }
      );
    }

    const callerEmail = (auth.email || "").trim().toLowerCase();
    const isSelf = Boolean(callerEmail && callerEmail === targetEmail);
    const isOrgAdmin =
      auth.role === "SUPER_ADMIN" ||
      (auth.role === "OWNER" && auth.scopeLevel !== "TENANT" && auth.scopeLevel !== "OUTLET");
    const hasPrivilegeMutation = Boolean(newRole || newScopeLevel || newTenantId !== undefined);

    if (!isOrgAdmin) {
      if (!isSelf || hasPrivilegeMutation || !newPassword) {
        return NextResponse.json(
          {
            success: false,
            error: "FORBIDDEN: Anda tidak memiliki izin untuk mengubah peran atau kredensial akun ini.",
          },
          { status: 403 }
        );
      }
    }

    if (newPassword !== undefined && newPassword.trim().length < 6) {
      return NextResponse.json(
        { success: false, error: "Password baru minimal 6 karakter." },
        { status: 400 }
      );
    }

    const mappedUnifiedRole = mapToUnifiedRole(newRole);
    const updateRes = await updateUnifiedUserCredentialsOrRole(targetEmail, {
      newPassword,
      newRole: mappedUnifiedRole,
    });

    const matchingPersonas = Object.values(TRUSTED_PERSONAS).filter(
      (p) => p.email.toLowerCase() === targetEmail
    );
    let revokedAt = updateRes.revokedAt || Date.now();
    for (const persona of matchingPersonas) {
      await revokeUserSessionsAfter(persona.userId, revokedAt);
    }

    let updatedTenantOwner:
      | { id: string; email: string; name: string; role: string }
      | undefined;

    if (!updateRes.success && newPassword && matchingPersonas.length === 0) {
      if (!hasPrivilegeMutation) {
        if (typeof body.currentPassword === "string" && !isOrgAdmin) {
          const { verifyTenantOwnerCredentials } = await import("@/lib/tenant-activation");
          const currentCheck = await verifyTenantOwnerCredentials(targetEmail, body.currentPassword);
          if (currentCheck.found && !currentCheck.authenticated) {
            return NextResponse.json(
              { success: false, error: currentCheck.error || "Kata sandi saat ini tidak sesuai." },
              { status: 401 }
            );
          }
        }
        const tenantOwnerUpdate = await updateTenantOwnerPassword(targetEmail, newPassword);
        if (tenantOwnerUpdate.success && tenantOwnerUpdate.account) {
          revokedAt = tenantOwnerUpdate.revokedAt;
          updatedTenantOwner = {
            id: tenantOwnerUpdate.account.id,
            email: tenantOwnerUpdate.account.email,
            name: tenantOwnerUpdate.account.name,
            role: "OWNER",
          };
        }
      }

      if (!updatedTenantOwner) {
        return NextResponse.json(
          { success: false, error: updateRes.error || "Pengguna tidak ditemukan." },
          { status: 404 }
        );
      }
    }

    const res = NextResponse.json({
      success: true,
      email: targetEmail,
      revokedAt,
      newRole: newRole || updateRes.user?.role || updatedTenantOwner?.role,
      newScopeLevel,
      newTenantId,
      user: updateRes.user
        ? {
            id: updateRes.user.id,
            email: updateRes.user.email,
            name: updateRes.user.name,
            phone: updateRes.user.phone,
            role: updateRes.user.role,
          }
        : updatedTenantOwner,
    });

    if (
      isSelf ||
      matchingPersonas.some((p) => p.userId === auth.userId) ||
      updatedTenantOwner?.id === auth.userId
    ) {
      clearAuthCookies(res);
    }

    return res;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Gagal memperbarui sesi pengguna." },
      { status: 500 }
    );
  }
}
