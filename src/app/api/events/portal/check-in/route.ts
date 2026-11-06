import { NextRequest, NextResponse } from "next/server";
import { organizerCheckInAttendee } from "@/lib/events";
import { assertOrganizerAuth, maskEmail, maskPhoneNumber } from "@/lib/server-auth";
import { AttendeeCheckInStatus } from "@/types/event";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/events/portal/check-in
 * Secure check-in endpoint for event organizers.
 * Strictly verifies server session ownership before allowing attendee check-in.
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      email,
      bookingId,
      ticketCode,
      checkInStatus,
      incrementQty,
      targetQty,
      reset,
      eventId,
      bypassDateWindow,
    } = body;
    const identifier = (bookingId || ticketCode || "").trim();

    const auth = await assertOrganizerAuth(req, email);
    if (!auth.authorized || !auth.email) {
      const status = auth.error?.startsWith("UNAUTHORIZED") ? 401 : 403;
      return NextResponse.json(
        {
          success: false,
          error: auth.error || "Akses check-in peserta ditolak.",
        },
        { status }
      );
    }

    if (!identifier || !checkInStatus) {
      return NextResponse.json(
        {
          success: false,
          error: "ID pemesanan atau kode tiket dan status check-in wajib disertakan.",
        },
        { status: 400 }
      );
    }

    if (
      checkInStatus !== "CHECKED_IN" &&
      checkInStatus !== "PARTIALLY_CHECKED_IN" &&
      checkInStatus !== "REGISTERED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Status check-in tidak valid (harus CHECKED_IN, PARTIALLY_CHECKED_IN, atau REGISTERED).",
        },
        { status: 400 }
      );
    }

    const enforceDateWindow =
      process.env.NODE_ENV === "test"
        ? Boolean(body.enforceDateWindow)
        : !reset && !bypassDateWindow;

    const updated = await organizerCheckInAttendee(
      auth.email,
      identifier,
      checkInStatus as AttendeeCheckInStatus,
      {
        incrementQty,
        targetQty,
        reset,
        expectedEventId: typeof eventId === "string" && eventId.trim() ? eventId.trim() : undefined,
        enforceDateWindow,
      }
    );

    const message =
      updated.checkInStatus === "CHECKED_IN"
        ? `Check-in selesai! Seluruh tiket (${updated.checkedInQty}/${updated.ticketCount}) telah hadir di venue.`
        : updated.checkInStatus === "PARTIALLY_CHECKED_IN"
        ? `Kehadiran parsial tercatat: ${updated.checkedInQty} dari ${updated.ticketCount} tiket telah hadir.`
        : "Status kehadiran peserta berhasil dibatalkan.";

    const { guestToken: _token, ...sanitized } = updated;
    const maskedUpdated = {
      ...sanitized,
      guestEmail: maskEmail(updated.guestEmail),
      guestPhone: maskPhoneNumber(updated.guestPhone),
    };

    return NextResponse.json({
      success: true,
      message,
      data: maskedUpdated,
    });
  } catch (err: any) {
    if (err?.name === "DatabasePersistenceError") {
      return NextResponse.json(
        {
          success: false,
          error: "Layanan database check-in sedang mengalami gangguan. Status kehadiran belum dapat dikonfirmasi demi mencegah double check-in. Silakan ulangi scan.",
        },
        { status: 503 }
      );
    }
    const status = err.message?.includes("FORBIDDEN") ? 403 : 400;
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Gagal memperbarui check-in peserta.",
      },
      { status }
    );
  }
}
