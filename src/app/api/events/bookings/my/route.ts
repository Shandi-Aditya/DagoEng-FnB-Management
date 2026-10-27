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
    const { searchParams } = new URL(req.url);
    const queryEmail = searchParams.get("email")?.toLowerCase().trim();
    const guestToken = searchParams.get("guestToken") || searchParams.get("token");
    const guestTokensParam = searchParams.get("tokens");
    const ticketCode = searchParams.get("ticketCode")?.trim();

    const allBookings = await getEventBookings();

    // 1. Authenticated User Flow: strictly bound to session identity
    if (auth.isAuthenticated && auth.email) {
      const sessionEmail = auth.email.toLowerCase().trim();

      // Prevent authenticated user from querying someone else's email
      if (queryEmail && queryEmail !== sessionEmail) {
        return NextResponse.json(
          {
            success: false,
            error: "FORBIDDEN: Anda hanya dapat mengakses riwayat tiket milik akun Anda sendiri.",
          },
          { status: 403 }
        );
      }

      const userBookings = allBookings.filter(
        (b) => b.guestEmail.toLowerCase().trim() === sessionEmail
      );

      return NextResponse.json({
        success: true,
        count: userBookings.length,
        data: userBookings,
      });
    }

    // 2. High-entropy Guest Token Flow: single or multiple tokens from local receipt
    const tokenSet = new Set<string>();
    if (guestToken) tokenSet.add(guestToken);
    if (guestTokensParam) {
      guestTokensParam
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .forEach((t) => tokenSet.add(t));
    }

    if (tokenSet.size > 0) {
      const guestBookings = allBookings.filter(
        (b) => b.guestToken && tokenSet.has(b.guestToken)
      );

      return NextResponse.json({
        success: true,
        count: guestBookings.length,
        data: guestBookings,
      });
    }

    // 3. Specific Guest Ticket Lookup: require BOTH ticketCode AND matching email
    if (ticketCode && queryEmail) {
      const match = allBookings.find(
        (b) =>
          b.ticketCode.toUpperCase() === ticketCode.toUpperCase() &&
          b.guestEmail.toLowerCase().trim() === queryEmail
      );

      return NextResponse.json({
        success: true,
        count: match ? 1 : 0,
        data: match ? [match] : [],
      });
    }

    // 4. Deny unauthenticated generic email harvest / enumeration
    if (queryEmail) {
      return NextResponse.json(
        {
          success: false,
          error: "Akses riwayat tiket untuk tamu memerlukan login akun atau token verifikasi tiket yang sah.",
        },
        { status: 401 }
      );
    }

    // No credentials or tokens provided
    return NextResponse.json(
      {
        success: false,
        error: "Akses tidak diizinkan. Silakan login atau sertakan token tiket Anda.",
      },
      { status: 401 }
    );
  } catch (error: any) {
    console.error("GET /api/events/bookings/my error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memuat riwayat tiket event Anda." },
      { status: 500 }
    );
  }
}
