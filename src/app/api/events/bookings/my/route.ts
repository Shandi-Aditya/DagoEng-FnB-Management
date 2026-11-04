import { NextRequest, NextResponse } from "next/server";
import { getEventBookings, checkRateLimit } from "@/lib/events";
import { getRequestAuthUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/bookings/my
 * Returns community event tickets booked by the currently authenticated user.
 * Strictly enforces user email ownership - users cannot see bookings of other users.
 * Enforces rate limiting on unauthenticated ticketCode + email lookup to prevent brute force.
 */
export async function GET(req: NextRequest) {
  try {
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    const auth = await getRequestAuthUser(req);
    const { searchParams } = new URL(req.url);
    const queryEmail = searchParams.get("email")?.toLowerCase().trim();
    const queryPhone = searchParams.get("phone")?.trim();
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

    // 3. Specific Guest Ticket Lookup: require BOTH ticketCode AND matching email with rate limiting
    if (ticketCode && queryEmail) {
      const allowed = checkRateLimit(`my-lookup-${clientIp}`, 10, 60000);
      if (!allowed) {
        return NextResponse.json(
          {
            success: false,
            error: "Terlalu banyak percobaan pencarian tiket. Harap tunggu 1 menit sebelum mencoba kembali.",
          },
          { status: 429 }
        );
      }

      const match = allBookings.find(
        (b) =>
          b.ticketCode.toUpperCase() === ticketCode.toUpperCase() &&
          b.guestEmail.toLowerCase().trim() === queryEmail
      );

      const safeMatch = match
        ? {
            id: match.id,
            ticketCode: match.ticketCode,
            eventId: match.eventId,
            eventTitle: match.eventTitle,
            eventDate: match.eventDate,
            eventLocation: match.eventLocation,
            guestName: match.guestName,
            guestEmail: match.guestEmail,
            ticketCount: match.ticketCount,
            unitPrice: match.unitPrice,
            totalPrice: match.totalPrice,
            paymentStatus: match.paymentStatus,
            checkInStatus: match.checkInStatus,
            guestToken: match.guestToken,
            createdAt: match.createdAt,
          }
        : null;

      return NextResponse.json({
        success: true,
        count: safeMatch ? 1 : 0,
        data: safeMatch ? [safeMatch] : [],
      });
    }

    // 3.5. Guest Lookup by Registered Email + Phone Number (when Booking Code is forgotten)
    // Requires both factors matching the booking data and applies rate limiting to mitigate enumeration.
    if (queryEmail && queryPhone) {
      const allowed = checkRateLimit(`my-phone-lookup-${clientIp}`, 10, 60000);
      if (!allowed) {
        return NextResponse.json(
          {
            success: false,
            error: "Terlalu banyak percobaan pencarian tiket. Harap tunggu 1 menit sebelum mencoba kembali.",
          },
          { status: 429 }
        );
      }

      const normalizePhone = (p: string) => {
        const digits = p.replace(/\D/g, "");
        if (digits.startsWith("62")) return "0" + digits.slice(2);
        return digits;
      };

      const normalizedQueryPhone = normalizePhone(queryPhone);
      if (normalizedQueryPhone.length < 8) {
        return NextResponse.json(
          {
            success: false,
            error: "Nomor WhatsApp/telepon harus minimal 8 digit angka yang valid.",
          },
          { status: 400 }
        );
      }

      const matchingBookings = allBookings.filter(
        (b) =>
          b.guestEmail.toLowerCase().trim() === queryEmail &&
          normalizePhone(b.guestPhone || "") === normalizedQueryPhone
      );

      const safeMatches = matchingBookings.map((match) => ({
        id: match.id,
        ticketCode: match.ticketCode,
        eventId: match.eventId,
        eventTitle: match.eventTitle,
        eventDate: match.eventDate,
        eventLocation: match.eventLocation,
        guestName: match.guestName,
        guestEmail: match.guestEmail,
        ticketCount: match.ticketCount,
        unitPrice: match.unitPrice,
        totalPrice: match.totalPrice,
        paymentStatus: match.paymentStatus,
        checkInStatus: match.checkInStatus,
        guestToken: match.guestToken,
        createdAt: match.createdAt,
      }));

      return NextResponse.json({
        success: true,
        count: safeMatches.length,
        data: safeMatches,
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
