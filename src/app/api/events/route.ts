import { NextRequest, NextResponse } from "next/server";
import {
  getApprovedEvents,
  createEventSubmission,
  checkRateLimit,
  validateEventSubmission,
} from "@/lib/events";
import { EventSubmissionPayload } from "@/types/event";
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

    return NextResponse.json(
      {
        success: true,
        message:
          "Pengajuan event berhasil diterima! Tim Dago Creative Hub akan meninjau kelayakan acara Anda sebelum dipublikasikan.",
        data: {
          id: created.id,
          title: created.title,
          status: created.status,
          createdAt: created.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/events error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memproses pengajuan event." },
      { status: 500 }
    );
  }
}
