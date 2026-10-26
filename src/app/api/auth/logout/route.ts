import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, hashSessionToken } from "@/lib/session";
import { revokeOrganizerSession } from "@/lib/organizer-activation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout
 * Security Hardening: Revokes server session and clears HttpOnly authentication cookies.
 */
export async function POST(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (sessionCookie) {
      const sessionTokenHash = hashSessionToken(sessionCookie);

      // 1. Revoke from in-memory fallback store
      revokeOrganizerSession(sessionTokenHash);

      // 2. Revoke from PostgreSQL database session table if connected
      try {
        await db.session.deleteMany({
          where: { sessionTokenHash },
        });
      } catch {
        // Database offline in local demo mode, in-memory revocation handles it
      }
    }

    const res = NextResponse.json({
      success: true,
      message: "Sesi server berhasil diakhiri.",
    });

    // Explicitly invalidate HttpOnly session cookie
    res.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: "",
      path: "/",
      httpOnly: true,
      maxAge: 0,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    // Invalidate persona cookie
    res.cookies.set({
      name: "dagoeng_active_persona",
      value: "",
      path: "/",
      maxAge: 0,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return res;
  } catch (error: any) {
    console.error("POST /api/auth/logout error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memproses logout pada server." },
      { status: 500 }
    );
  }
}
