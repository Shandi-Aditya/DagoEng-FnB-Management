import { NextRequest, NextResponse } from "next/server";
import { TRUSTED_PERSONAS } from "@/lib/server-auth";
import { isOrganizerActive, getAllOrganizers } from "@/lib/organizers";
import { PersonaKey } from "@/types/auth";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import {
  verifyOrganizerCredentials,
  createOrganizerSession,
} from "@/lib/organizer-activation";

export const dynamic = "force-dynamic";

/**
 * Strict Mapping of Verified Demo Accounts to Authorized Server Personas.
 * Explicit whitelist: No substring matching or arbitrary privilege escalation.
 */
const DEMO_CREDENTIALS: Record<string, { personaKey: PersonaKey; defaultRedirect: string }> = {
  "owner.dago@dagoeng.com": { personaKey: "DAGO_OWNER", defaultRedirect: "/dashboard" },
  "admin@dagoeng.com": { personaKey: "SUPER_ADMIN", defaultRedirect: "/dashboard" },
  "manager.commercial@dagoeng.com": { personaKey: "COMMERCIAL_MANAGER", defaultRedirect: "/commercial" },
  "manager.cowork@dagoeng.com": { personaKey: "COWORK_MANAGER", defaultRedirect: "/coworking" },
  "owner.kopisenja@dagoeng.com": { personaKey: "TENANT_OWNER_KS", defaultRedirect: "/dashboard" },
  "owner.dapurmama@dagoeng.com": { personaKey: "TENANT_OWNER_KITCHEN", defaultRedirect: "/dashboard" },
  "owner.manisbakery@dagoeng.com": { personaKey: "TENANT_OWNER_BAKERY", defaultRedirect: "/dashboard" },
  "owner.warungbunarti@dagoeng.com": { personaKey: "TENANT_OWNER_TEA", defaultRedirect: "/dashboard" },
  "cashier.sgr@kopisenja.com": { personaKey: "CASHIER_SGR", defaultRedirect: "/pos" },
  "kitchen.sgr@kopisenja.com": { personaKey: "KITCHEN_SGR", defaultRedirect: "/kitchen" },
  "waiter.sgr@kopisenja.com": { personaKey: "WAITER_SGR", defaultRedirect: "/waiter" },
  "customer@gmail.com": { personaKey: "CUSTOMER_DEMO", defaultRedirect: "/customer" },
  "baristaguild@dagocreative.id": { personaKey: "COMMUNITY_BARISTA", defaultRedirect: "/events/portal" },
  "halo@bandungdev.org": { personaKey: "COMMUNITY_BANDUNGDEV", defaultRedirect: "/events/portal" },
  "info@aksarapriangan.id": { personaKey: "COMMUNITY_AKSARAPRIANGAN", defaultRedirect: "/events/portal" },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json(
        { success: false, error: "Alamat email wajib diisi." },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || !password.trim()) {
      return NextResponse.json(
        { success: false, error: "Password wajib diisi." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check verified demo accounts
    if (normalizedEmail in DEMO_CREDENTIALS) {
      const match = DEMO_CREDENTIALS[normalizedEmail];

      // If this is a community organizer, enforce active status from disk
      if (
        match.personaKey === "COMMUNITY_BARISTA" ||
        match.personaKey === "COMMUNITY_BANDUNGDEV" ||
        match.personaKey === "COMMUNITY_AKSARAPRIANGAN"
      ) {
        if (!isOrganizerActive(normalizedEmail)) {
          return NextResponse.json(
            {
              success: false,
              error: `FORBIDDEN: Akun penyelenggara [${normalizedEmail}] saat ini dinonaktifkan oleh Administrator Platform. Silakan hubungi manajemen DAGO Creative Hub.`,
            },
            { status: 403 }
          );
        }
      }

      const user = TRUSTED_PERSONAS[match.personaKey];
      const res = NextResponse.json({
        success: true,
        personaKey: match.personaKey,
        redirectUrl: match.defaultRedirect,
        user,
      });

      // Synchronize session persona cookie securely
      res.cookies.set({
        name: "dagoeng_active_persona",
        value: match.personaKey,
        path: "/",
        maxAge: 604800,
        sameSite: "lax",
      });

      return res;
    }

    // 2. Check if email belongs to a registered organizer in organizers.json
    let allOrganizers: any[] = [];
    try {
      allOrganizers = getAllOrganizers();
    } catch (infraErr) {
      console.error("Infrastructure error: Failed to access organizer data source:", infraErr);
      return NextResponse.json(
        {
          success: false,
          error: "Terjadi gangguan pada layanan verifikasi platform. Silakan hubungi Administrator DAGO.",
        },
        { status: 500 }
      );
    }

    const registeredOrganizer = allOrganizers.find(
      (o) => o.email.toLowerCase().trim() === normalizedEmail
    );

    if (registeredOrganizer) {
      if (registeredOrganizer.status === "INACTIVE") {
        return NextResponse.json(
          {
            success: false,
            error: `FORBIDDEN: Akun penyelenggara [${registeredOrganizer.name}] saat ini dinonaktifkan oleh Administrator Platform.`,
          },
          { status: 403 }
        );
      }

      // Check if organizer has completed account activation and set a password
      let credResult;
      try {
        credResult = await verifyOrganizerCredentials(normalizedEmail, password);
      } catch (infraErr) {
        console.error("Infrastructure error verifying credentials:", infraErr);
        return NextResponse.json(
          {
            success: false,
            error: "Terjadi gangguan pada layanan autentikasi platform. Silakan coba beberapa saat lagi.",
          },
          { status: 500 }
        );
      }

      // Handle internal infrastructure errors
      if (credResult.error && credResult.error.startsWith("INFRASTRUCTURE_ERROR")) {
        console.error("Internal infrastructure failure during login:", credResult.error);
        return NextResponse.json(
          {
            success: false,
            error: "Layanan autentikasi database sedang mengalami gangguan. Silakan coba beberapa saat lagi.",
          },
          { status: 500 }
        );
      }

      if (credResult.success && credResult.user) {
        // Create authenticated database/organizer session
        try {
          const session = await createOrganizerSession(
            normalizedEmail,
            req.headers.get("user-agent") || undefined,
            req.headers.get("x-forwarded-for") || undefined
          );

          const res = NextResponse.json({
            success: true,
            redirectUrl: "/events/portal",
            user: {
              ...credResult.user,
              role: credResult.user.role.slug,
              redirectTo: "/events/portal",
            },
          });

          // Set secure session cookie (dagoeng_session)
          res.cookies.set({
            name: SESSION_COOKIE_NAME,
            value: session.rawToken,
            path: "/",
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60,
            sameSite: "lax",
          });

          // Clear persona cookie so server strictly relies on the verified session
          res.cookies.delete("dagoeng_active_persona");

          return res;
        } catch (sessErr) {
          console.error("Failed to establish organizer session:", sessErr);
          return NextResponse.json(
            {
              success: false,
              error: "Gagal membuat sesi login. Silakan hubungi Administrator DAGO.",
            },
            { status: 500 }
          );
        }
      }

      // If credentials failed due to wrong password, return 401
      if (credResult.error && credResult.error.includes("Password yang Anda masukkan salah")) {
        return NextResponse.json(
          {
            success: false,
            error: credResult.error,
          },
          { status: 401 }
        );
      }

      // If not activated yet or inactive in DB, return 403 boundary notice
      return NextResponse.json(
        {
          success: false,
          error: `Profil penyelenggara [${registeredOrganizer.name}] terdaftar di sistem, namun kredensial login mandiri belum diaktivasi. Silakan gunakan tautan aktivasi yang diberikan Administrator Platform.`,
        },
        { status: 403 }
      );
    }

    // 3. Email is completely unknown - STRICT REJECTION (NO FALLBACK TO DAGO_OWNER!)
    return NextResponse.json(
      {
        success: false,
        error: "Email atau kredensial tidak terdaftar dalam sistem DAGO Creative Hub. Silakan periksa kembali email Anda.",
      },
      { status: 401 }
    );
  } catch (error: any) {
    console.error("POST /api/auth/login error:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan pada server saat memproses login." },
      { status: 500 }
    );
  }
}
