import { NextRequest, NextResponse } from "next/server";
import { getOrganizerPortalData, organizerResubmitEvent } from "@/lib/events";
import { assertOrganizerAuth, maskEmail, maskPhoneNumber } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/portal?email=...
 * Returns events, metrics, and masked attendees belonging exclusively to the authenticated organizer.
 * Enforces server session authentication and strict cross-community isolation.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedEmail = searchParams.get("email");

    const auth = await assertOrganizerAuth(req, requestedEmail);
    if (!auth.authorized || !auth.email) {
      const status = auth.error?.startsWith("UNAUTHORIZED") ? 401 : 403;
      return NextResponse.json(
        {
          success: false,
          error: auth.error || "Akses portal komunitas ditolak.",
        },
        { status }
      );
    }

    const portalData = await getOrganizerPortalData(auth.email);

    // Apply PII privacy masking to attendees
    const sanitizedBookings = portalData.bookings.map((b) => ({
      ...b,
      guestEmail: maskEmail(b.guestEmail),
      guestPhone: maskPhoneNumber(b.guestPhone),
    }));

    return NextResponse.json({
      success: true,
      data: {
        ...portalData,
        organizerEmail: auth.email,
        bookings: sanitizedBookings,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Gagal memuat portal komunitas.",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/events/portal
 * Allows authenticated community organizer or Hub Admin to edit and resubmit an event requested for revision.
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, eventId, updates } = body;

    const auth = await assertOrganizerAuth(req, email);
    if (!auth.authorized || !auth.email) {
      const status = auth.error?.startsWith("UNAUTHORIZED") ? 401 : 403;
      return NextResponse.json(
        {
          success: false,
          error: auth.error || "Akses pengajuan ulang event ditolak.",
        },
        { status }
      );
    }

    if (!eventId) {
      return NextResponse.json(
        {
          success: false,
          error: "ID event wajib disertakan.",
        },
        { status: 400 }
      );
    }

    const updated = await organizerResubmitEvent(auth.email, eventId, updates || {});

    return NextResponse.json({
      success: true,
      message: "Event berhasil diajukan ulang ke antrean review kurator.",
      data: updated,
    });
  } catch (err: any) {
    const status = err.message?.includes("FORBIDDEN") ? 403 : 400;
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Gagal mengajukan ulang event.",
      },
      { status }
    );
  }
}
