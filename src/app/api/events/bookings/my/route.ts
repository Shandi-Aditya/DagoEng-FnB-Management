import { NextRequest, NextResponse } from "next/server";
import { getEventBookings } from "@/lib/events";
import { getRequestAuthUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/bookings/my
 * Returns community event tickets booked by the currently authenticated user.
 * Strictly enforces user email ownership - users cannot see bookings of other users.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);

    // Support query param fallback for client storage or guest verification
    const { searchParams } = new URL(req.url);
    const queryEmail = searchParams.get("email")?.toLowerCase().trim();

    let targetEmail: string | null = null;

    if (auth.isAuthenticated && auth.email) {
      targetEmail = auth.email.toLowerCase().trim();
    } else if (queryEmail) {
      targetEmail = queryEmail;
    }

    if (!targetEmail) {
      return NextResponse.json({
        success: true,
        count: 0,
        data: [],
      });
    }

    const allBookings = await getEventBookings();
    const userBookings = allBookings.filter(
      (b) => b.guestEmail.toLowerCase().trim() === targetEmail
    );

    return NextResponse.json({
      success: true,
      count: userBookings.length,
      data: userBookings,
    });
  } catch (error: any) {
    console.error("GET /api/events/bookings/my error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memuat riwayat tiket event Anda." },
      { status: 500 }
    );
  }
}
