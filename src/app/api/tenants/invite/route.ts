import { NextRequest, NextResponse } from "next/server";
import { getRequestAuthUser, isSuperAdminOrOrgOwner } from "@/lib/server-auth";
import { generateTenantOwnerInviteToken } from "@/lib/tenant-activation";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role) {
      return NextResponse.json(
        { success: false, error: auth.error || "UNAUTHORIZED: Autentikasi sesi diperlukan." },
        { status: 401 }
      );
    }

    if (!isSuperAdminOrOrgOwner(auth)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "FORBIDDEN: Hanya Super Admin atau Hub Owner yang berwenang membuat undangan Owner mitra.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const tenantId = typeof body?.tenantId === "string" ? body.tenantId.trim() : "";
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "tenantId wajib disertakan." },
        { status: 400 }
      );
    }

    const result = await generateTenantOwnerInviteToken(
      tenantId,
      auth.name || auth.email || "Administrator Platform"
    );

    const origin = req.nextUrl?.origin || "";
    const fullActivationUrl = origin ? `${origin}${result.activationUrl}` : result.activationUrl;

    return NextResponse.json({
      success: true,
      message: `Tautan undangan akun Owner untuk ${result.tenantName} berhasil diterbitkan.`,
      data: {
        tenantId: result.tenantId,
        tenantName: result.tenantName,
        contactEmail: result.contactEmail,
        activationUrl: fullActivationUrl,
        relativeUrl: result.activationUrl,
        expiresAt: result.expiresAt,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menerbitkan undangan Owner mitra.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
