import { NextRequest, NextResponse } from "next/server";
import { getEventBookings, getEventOperationalStats } from "@/lib/events";
import { assertEventAdmin, assertCheckInAuth, maskEmail, maskPhoneNumber } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/bookings
 * Endpoint to list event ticket bookings and aggregate statistics.
 * Accessible to Hub Event Admins and Authorized Event Check-in Officers.
 * Query params:
 * - eventId: filter bookings by event
 * - includeStats: "true" to include high-level operational statistics
 * - unmasked: "true" to return unmasked PII (requires SUPER_ADMIN or OWNER role)
 */
export async function GET(req: NextRequest) {
  try {
    const adminAuth = await assertEventAdmin(req);
    let isAuthorized = adminAuth.authorized;
    let authRole = adminAuth.role;

    if (!isAuthorized) {
      const checkInAuth = await assertCheckInAuth(req);
      if (checkInAuth.authorized) {
        isAuthorized = true;
        authRole = checkInAuth.role;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: adminAuth.error || "Akses pemesanan tiket ditolak." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId") || undefined;
    const includeStats = searchParams.get("includeStats") === "true";
    const allowUnmasked = searchParams.get("unmasked") === "true";

    const canViewUnmasked =
      allowUnmasked && (authRole === "SUPER_ADMIN" || authRole === "OWNER");

    const rawBookings = await getEventBookings(eventId);

    const safeBookings = rawBookings.map((b) => {
      const { guestToken: _token, ...rest } = b;
      if (canViewUnmasked) return rest;
      return {
        ...rest,
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
