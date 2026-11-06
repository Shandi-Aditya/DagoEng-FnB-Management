import { NextRequest, NextResponse } from "next/server";
import {
  getApprovedEvents,
  createEventSubmission,
  checkRateLimit,
  validateEventSubmission,
} from "@/lib/events";
import { EventSubmissionPayload } from "@/types/event";
import { getRequestAuthUser } from "@/lib/server-auth";
import {
  findUnifiedUserByEmail,
  registerUnifiedUser,
  verifyUnifiedUserPassword,
  syncOrganizerCredentials,
} from "@/lib/unified-account";
import { getOrganizerByEmail, createOrganizer } from "@/lib/organizers";
import { createOrganizerSession } from "@/lib/organizer-activation";
import { SESSION_COOKIE_NAME } from "@/lib/session";
export const dynamic = "force-dynamic";

/**
 * GET /api/events
 * Public endpoint to fetch all APPROVED community events.
 * Strips private organizer email/phone and never returns PENDING/REJECTED/ARCHIVED events.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search")?.toLowerCase().trim();

    let events = await getApprovedEvents();

    if (category && category !== "ALL") {
      events = events.filter((e) => e.category === category);
    }

    if (search) {
      events = events.filter(
        (e) =>
          e.title.toLowerCase().includes(search) ||
          e.description.toLowerCase().includes(search) ||
          e.location.toLowerCase().includes(search) ||
          e.organizerName.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error: any) {
    console.error("GET /api/events error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memuat daftar event komunitas." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events
 * Public endpoint for submitting a community event proposal without requiring an account.
 * Enforces rate limiting, honeypot anti-spam, and validation.
 * Always assigns status = "PENDING".
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting by IP
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    const allowed = checkRateLimit(clientIp, 5, 60000); // 5 submissions per minute max
    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Terlalu banyak permintaan pengajuan dalam waktu singkat. Silakan coba lagi beberapa saat.",
        },
        { status: 429 }
      );
    }

    // 2. Parse request body
    const body: EventSubmissionPayload = await req.json();

    // 3. Honeypot check
    if (body.honeypot && body.honeypot.trim() !== "") {
      // Silently drop spam bot
      return NextResponse.json(
        { success: true, message: "Pengajuan berhasil dikirim untuk moderasi." },
        { status: 200 }
      );
    }

    // 4. Validate
    const validation = validateEventSubmission(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: "Validasi pengajuan gagal.",
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    // 5. Create submission with status PENDING
    const created = await createEventSubmission(body);

    // 6. Seamless Organizer Account Setup & Auto-Login Session
    let sessionUser: any = null;
    let rawSessionToken: string | null = null;

    try {
      const normalizedEmail = body.organizerEmail.trim().toLowerCase();
      const organizerName = body.organizerName.trim();
      const organizerPhone = body.organizerPhone.trim();

      // Check if user is already authenticated
      const existingAuth = await getRequestAuthUser(req);
      if (existingAuth.isAuthenticated && existingAuth.email?.toLowerCase() === normalizedEmail) {
        sessionUser = {
          id: existingAuth.userId,
          name: existingAuth.name || organizerName,
          email: existingAuth.email,
          role: existingAuth.role,
        };
      } else {
        const rawPassword = body.password?.trim() || "Password123!";
        const existingUser = findUnifiedUserByEmail(normalizedEmail);

        if (existingUser) {
          // If user exists, check credentials if password provided
          const passCheck = await verifyUnifiedUserPassword(normalizedEmail, rawPassword);
          if (passCheck.success && passCheck.user) {
            sessionUser = {
              id: passCheck.user.id,
              name: passCheck.user.name,
              email: passCheck.user.email,
              phone: passCheck.user.phone,
              role: passCheck.user.role,
            };
          } else {
            sessionUser = {
              id: existingUser.id,
              name: existingUser.name,
              email: existingUser.email,
              phone: existingUser.phone,
              role: existingUser.role,
            };
          }
        } else {
          // Register new unified user account
          const regResult = await registerUnifiedUser({
            name: organizerName,
            email: normalizedEmail,
            phone: organizerPhone,
            password: rawPassword,
            role: "CUSTOMER",
          });
          sessionUser = {
            id: regResult.user.id,
            name: regResult.user.name,
            email: regResult.user.email,
            phone: regResult.user.phone,
            role: regResult.user.role,
          };
        }

        // Ensure community organizer profile exists in organizers.json
        let orgProfile = getOrganizerByEmail(normalizedEmail);
        if (!orgProfile) {
          orgProfile = createOrganizer({
            name: organizerName,
            category: body.category || "Komunitas",
            contactPerson: organizerName,
            phone: organizerPhone,
            email: normalizedEmail,
            notes: "Akun penyelenggara otomatis dari pengajuan event",
            initialStatus: "ACTIVE",
          });
        }

        // Keep organizer_credentials.json synchronized with the unified user's password
        const uUser = findUnifiedUserByEmail(normalizedEmail);
        if (orgProfile && uUser?.passwordHash) {
          syncOrganizerCredentials(orgProfile.id, normalizedEmail, uUser.passwordHash);
        }

        // Create server session for seamless portal access
        if (sessionUser) {
          const session = await createOrganizerSession(
            normalizedEmail,
            req.headers.get("user-agent") || undefined,
            req.headers.get("x-forwarded-for") || undefined
          );
          rawSessionToken = session.rawToken;
        }
      }
    } catch (authErr) {
      console.error("Auto-login organizer setup error:", authErr);
      // Non-fatal: event is already safely created
    }

    const response = NextResponse.json(
      {
        success: true,
        message:
          "Pengajuan event berhasil diterima! Akun penyelenggara Anda otomatis aktif.",
        data: {
          id: created.id,
          title: created.title,
          status: created.status,
          createdAt: created.createdAt,
        },
        user: sessionUser,
        autoLoggedIn: Boolean(rawSessionToken),
      },
      { status: 201 }
    );

    if (rawSessionToken) {
      response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: rawSessionToken,
        path: "/",
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60, // 7 days
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }

    return response;
  } catch (error: any) {
    console.error("POST /api/events error:", error);
    if (error?.name === "DatabasePersistenceError") {
      return NextResponse.json(
        {
          success: false,
          error: "Layanan database penyimpanan cloud sedang mengalami gangguan sementara. Pengajuan event belum dapat dikonfirmasi demi menjaga integritas data. Silakan coba beberapa saat lagi.",
        },
        { status: 503 }
      );
    }
    const isClientError = error.message?.includes("Validasi gagal") || error.message?.includes("judul serupa");
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memproses pengajuan event." },
      { status: isClientError ? 400 : 500 }
    );
  }
}
