import { NextRequest, NextResponse } from "next/server";
import {
  getApprovedEvents,
  createEventSubmission,
  checkRateLimit,
  validateEventSubmission,
} from "@/lib/events";
import { EventSubmissionPayload } from "@/types/event";
import { getRequestAuthUser, isCheckInStaffEmail } from "@/lib/server-auth";
import {
  findUnifiedUserByEmail,
  registerUnifiedUser,
  verifyUnifiedUserPassword,
  syncOrganizerCredentials,
} from "@/lib/unified-account";
import {
  isCheckInStaffRole,
  CHECKIN_STAFF_SUBMISSION_BLOCKED_MESSAGE,
} from "@/lib/event-validation";
import {
  getOrganizerByEmail,
  createOrganizer,
  isTenantOwnerEmailAsync,
} from "@/lib/organizers";
import { createOrganizerSession } from "@/lib/organizer-activation";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { decideSubmitterAccount } from "@/lib/event-submitter-account";
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
          (e.title || "").toLowerCase().includes(search) ||
          (e.description || "").toLowerCase().includes(search) ||
          (e.location || "").toLowerCase().includes(search) ||
          (e.organizerName || "").toLowerCase().includes(search)
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

    // 3b. Role Restriction Check: CHECKIN_STAFF is strictly forbidden from creating/submitting events
    const normalizedEmail = (body.organizerEmail || "").trim().toLowerCase();
    const existingUser = findUnifiedUserByEmail(normalizedEmail);
    const existingAuth = await getRequestAuthUser(req);
    if (
      (existingAuth.isAuthenticated && (isCheckInStaffRole(existingAuth.role) || isCheckInStaffEmail(existingAuth.email || ""))) ||
      isCheckInStaffEmail(normalizedEmail)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: CHECKIN_STAFF_SUBMISSION_BLOCKED_MESSAGE,
        },
        { status: 403 }
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

    // 5. Decide whose account this submission belongs to before anything is stored.
    const organizerName = body.organizerName.trim();
    const organizerPhone = body.organizerPhone.trim();
    const submittedPassword = body.password?.trim() || "";

    const passwordMatches =
      Boolean(existingUser && submittedPassword) &&
      (await verifyUnifiedUserPassword(normalizedEmail, submittedPassword)).success;

    const decision = decideSubmitterAccount({
      sessionEmail: existingAuth.isAuthenticated ? existingAuth.email ?? null : null,
      email: normalizedEmail,
      accountExists: Boolean(existingUser),
      password: submittedPassword,
      passwordMatches,
    });
    if (decision.kind === "reject") {
      return NextResponse.json({ success: false, error: decision.error }, { status: decision.status });
    }

    if (await isTenantOwnerEmailAsync(normalizedEmail)) {
      return NextResponse.json(
        {
          success: false,
          error: "Email tersebut sudah terdaftar sebagai akun pemilik mitra. Gunakan email lain.",
        },
        { status: 409 }
      );
    }

    // 6. Create submission with status PENDING
    const created = await createEventSubmission(body);

    // 7. Organizer account and portal session
    let sessionUser: any = null;
    let rawSessionToken: string | null = null;

    try {
      if (decision.kind === "session") {
        sessionUser = {
          id: existingAuth.userId,
          name: existingAuth.name || organizerName,
          email: existingAuth.email,
          role: existingAuth.role,
        };
      } else if (decision.kind === "existing" && existingUser) {
        sessionUser = {
          id: existingUser.id,
          name: existingUser.name,
          email: existingUser.email,
          phone: existingUser.phone,
          role: existingUser.role,
        };
      } else {
        const regResult = await registerUnifiedUser({
          name: organizerName,
          email: normalizedEmail,
          phone: organizerPhone,
          password: submittedPassword,
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

      // Every submitter becomes an organizer, including a member who was already signed in.
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

      if (decision.kind !== "session") {
        const session = await createOrganizerSession(
          normalizedEmail,
          req.headers.get("user-agent") || undefined,
          req.headers.get("x-forwarded-for") || undefined
        );
        rawSessionToken = session.rawToken;
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
      response.cookies.set({
        name: "dagoeng_active_persona",
        value: "",
        path: "/",
        maxAge: 0,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
      response.cookies.delete("dagoeng_active_persona");
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
