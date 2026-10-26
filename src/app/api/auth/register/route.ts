import { NextRequest, NextResponse } from "next/server";
import { registerUnifiedUser } from "@/lib/unified-account";
import { createOrganizerSession } from "@/lib/organizer-activation";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/register
 * Unified registration endpoint for DagoEng accounts.
 * Allows users to register once and access Customer Portal, F&B, Co-working, and Events.
 * Deduplicates by email: returns existing account without creating duplicate identities.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, password } = body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: "Nama lengkap minimal 2 karakter." },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Alamat email tidak valid." },
        { status: 400 }
      );
    }

    if (!phone || typeof phone !== "string" || phone.trim().length < 8) {
      return NextResponse.json(
        { success: false, error: "Nomor telepon/WhatsApp minimal 8 digit." },
        { status: 400 }
      );
    }

    const { user, isExisting } = await registerUnifiedUser({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password: password?.trim() || "Password123!",
      role: "CUSTOMER",
    });

    // Automatically establish a session for the registered user
    const session = await createOrganizerSession(
      user.email,
      req.headers.get("user-agent") || undefined,
      req.headers.get("x-forwarded-for") || undefined
    );

    const res = NextResponse.json(
      {
        success: true,
        isExisting,
        message: isExisting
          ? "Akun Anda sudah terdaftar. Berhasil masuk ke sesi DagoEng."
          : "Pendaftaran akun terpadu DagoEng berhasil!",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          organizerProfileId: user.organizerProfileId,
        },
      },
      { status: isExisting ? 200 : 201 }
    );

    res.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: session.rawToken,
      path: "/",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return res;
  } catch (err: any) {
    console.error("POST /api/auth/register error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal memproses pendaftaran akun." },
      { status: 500 }
    );
  }
}
