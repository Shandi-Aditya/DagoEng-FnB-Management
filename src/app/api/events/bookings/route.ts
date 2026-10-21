import { NextRequest, NextResponse } from "next/server";
import { getEventBookings, getEventOperationalStats } from "@/lib/events";
import { assertEventAdmin, maskEmail, maskPhoneNumber } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/bookings
 * Admin-only endpoint to list event ticket bookings and aggregate statistics.
 * Query params:
 * - eventId: filter bookings by event
 * - includeStats: "true" to include high-level operational statistics
 * - unmasked: "true" to return unmasked PII (requires SUPER_ADMIN or OWNER role)
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await assertEventAdmin(req);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId") || undefined;
    const includeStats = searchParams.get("includeStats") === "true";
    const allowUnmasked = searchParams.get("unmasked") === "true";

    const canViewUnmasked =
      allowUnmasked && (auth.role === "SUPER_ADMIN" || auth.role === "OWNER");

    const rawBookings = await getEventBookings(eventId);

    const safeBookings = rawBookings.map((b) => {
      if (canViewUnmasked) return b;
      return {
        ...b,
        guestEmail: maskEmail(b.guestEmail),
        guestPhone: maskPhoneNumber(b.guestPhone),
      };
    });

    let stats = null;
    if (includeStats) {
      stats = await getEventOperationalStats();
    }

    return NextResponse.json({
      success: true,
      count: safeBookings.length,
      data: safeBookings,
      stats,
    });
  } catch (error: any) {
    console.error("GET /api/events/bookings error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memuat data pemesanan tiket event." },
      { status: 500 }
    );
  }
}
