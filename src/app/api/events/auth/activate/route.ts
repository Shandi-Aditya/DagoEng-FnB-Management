import { NextRequest, NextResponse } from "next/server";
import {
  validateActivationToken,
  consumeActivationTokenAndSetPassword,
} from "@/lib/organizer-activation";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/auth/activate?token=...
 * Validates the activation token before rendering the set-password form.
 * Does NOT consume the token. Safe and idempotent.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Parameter token aktivasi wajib disertakan." },
        { status: 400 }
      );
    }

    const check = await validateActivationToken(token);
    if (!check.valid) {
      return NextResponse.json(
        { success: false, error: check.error || "Tautan aktivasi tidak valid atau telah kedaluwarsa." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        organizer: check.organizer,
        expiresAt: check.expiresAt,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan sistem saat memvalidasi token." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events/auth/activate
 * Consumes the activation token and establishes the organizer's password.
 * Atomically marks token as consumed and prevents replay attacks.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, password } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { success: false, error: "Token aktivasi wajib disertakan." },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password minimal 8 karakter demi keamanan akun Anda." },
        { status: 400 }
      );
    }

    const result = await consumeActivationTokenAndSetPassword(token, password);

    return NextResponse.json({
      success: true,
      message: result.message,
      data: {
        email: result.email,
        organizerName: result.organizerName,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Gagal mengaktifkan akun penyelenggara." },
      { status: 400 }
    );
  }
}
