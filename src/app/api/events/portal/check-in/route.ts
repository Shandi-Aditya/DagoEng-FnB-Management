import { NextRequest, NextResponse } from "next/server";
import { organizerCheckInAttendee } from "@/lib/events";
import { assertOrganizerAuth } from "@/lib/server-auth";
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
    const { email, bookingId, checkInStatus } = body;

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

    if (!bookingId || !checkInStatus) {
      return NextResponse.json(
        {
          success: false,
          error: "ID pemesanan dan status check-in wajib disertakan.",
        },
        { status: 400 }
      );
    }

    if (checkInStatus !== "CHECKED_IN" && checkInStatus !== "REGISTERED") {
      return NextResponse.json(
        {
          success: false,
          error: "Status check-in tidak valid (harus CHECKED_IN atau REGISTERED).",
        },
        { status: 400 }
      );
    }

    const updated = await organizerCheckInAttendee(
      auth.email,
      bookingId,
      checkInStatus as AttendeeCheckInStatus
    );

    return NextResponse.json({
      success: true,
      message:
        checkInStatus === "CHECKED_IN"
          ? "Peserta berhasil ditandai hadir di venue!"
          : "Status kehadiran peserta berhasil dibatalkan.",
      data: updated,
    });
  } catch (err: any) {
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
