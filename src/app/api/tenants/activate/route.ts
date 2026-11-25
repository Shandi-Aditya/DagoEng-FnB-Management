import { NextRequest, NextResponse } from "next/server";
import {
  consumeTenantOwnerInviteToken,
  validateTenantOwnerInviteToken,
} from "@/lib/tenant-activation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token") || "";
    if (!token.trim()) {
      return NextResponse.json(
        { success: false, error: "Parameter token undangan wajib disertakan." },
        { status: 400 }
      );
    }

    const check = await validateTenantOwnerInviteToken(token);
    if (!check.valid) {
      return NextResponse.json({ success: false, error: check.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        tenantId: check.tenantId,
        tenantName: check.tenantName,
        contactEmail: check.contactEmail,
        expiresAt: check.expiresAt,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Gagal memvalidasi token undangan mitra." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = typeof body?.token === "string" ? body.token : "";
    const email = typeof body?.email === "string" ? body.email : undefined;
    const name = typeof body?.name === "string" ? body.name : undefined;
    const password = typeof body?.password === "string" ? body.password : "";

    if (!token.trim()) {
      return NextResponse.json(
        { success: false, error: "Token undangan wajib disertakan." },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password minimal 8 karakter." },
        { status: 400 }
      );
    }

    const result = await consumeTenantOwnerInviteToken({
      token,
      email,
      name,
      password,
    });

    return NextResponse.json({
      success: true,
      message: `Akun Owner untuk ${result.tenantName} berhasil diaktifkan. Silakan masuk menggunakan email ${result.email}.`,
      data: result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mengaktifkan akun Owner mitra.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
