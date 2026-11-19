import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  getBookingById,
  getAdminEventById,
  validateTicketRefundEligibility,
  requestTicketRefund,
} from "@/lib/events";
import { EventTicketOrder, RequestRefundPayload } from "@/types/event";
import { getRequestAuthUser, assertEventAdmin } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

/**
 * Validates ticket ownership through token constant-time equality,
 * matching authenticated session email, or verified event admin.
 */
async function verifyTicketRefundOwnership(
  req: NextRequest,
  booking: EventTicketOrder,
  bodyGuestToken?: string | null
): Promise<{ authorized: boolean; error?: string }> {
  // 1. Check if caller is verified event admin
  try {
    const adminCheck = await assertEventAdmin(req);
    if (adminCheck.authorized) {
      return { authorized: true };
    }
  } catch {}

  // 2. Check if caller is authenticated user matching booking email
  try {
    const authUser = await getRequestAuthUser(req);
    if (
      authUser.isAuthenticated &&
      authUser.email &&
      booking.guestEmail &&
      authUser.email.trim().toLowerCase() === booking.guestEmail.trim().toLowerCase()
    ) {
      return { authorized: true };
    }
  } catch {}

  // 3. Check guestToken via query param, header, or body
  const url = new URL(req.url);
  const tokenQuery = url.searchParams.get("token") || url.searchParams.get("guestToken");
  const tokenHeader = req.headers.get("x-guest-token");
  const candidate = (tokenQuery || tokenHeader || bodyGuestToken || "").trim();

  if (candidate.length >= 32 && booking.guestToken && booking.guestToken.length >= 32) {
    const candidateBuf = Buffer.from(candidate);
    const bookingBuf = Buffer.from(booking.guestToken);
    if (candidateBuf.length === bookingBuf.length && crypto.timingSafeEqual(candidateBuf, bookingBuf)) {
      return { authorized: true };
    }
  }

  return {
    authorized: false,
    error: "FORBIDDEN: Bukti kepemilikan tiket tidak valid atau tidak disertakan.",
  };
}

/**
 * GET /api/events/bookings/[id]/refund
 * Checks if a specific ticket booking is eligible for refund under event policy.
 * Requires ownership verification (token >= 32 chars, matching account, or admin).
 */
export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const booking = await getBookingById(id);
    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Pemesanan tiket tidak ditemukan." },
        { status: 404 }
      );
    }

    const ownership = await verifyTicketRefundOwnership(req, booking);
    if (!ownership.authorized) {
      return NextResponse.json(
        { success: false, error: ownership.error || "Akses ditolak." },
        { status: 403 }
      );
    }

    const event = await getAdminEventById(booking.eventId);
    if (!event) {
      return NextResponse.json(
        { success: false, error: "Event terkait tidak ditemukan." },
        { status: 404 }
      );
    }

    const eligibility = validateTicketRefundEligibility(event, booking, new Date());

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
      eventTitle: event.title,
      refundPolicy: event.refundPolicy || { policyType: "NO_REFUND" },
      refundStatus: booking.refundStatus || "NONE",
      refundRequest: booking.refundRequest || null,
      ...eligibility,
    });
  } catch (error: any) {
    console.error("[api/events/bookings/refund] GET error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memeriksa kelayakan refund." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events/bookings/[id]/refund
 * Submits an attendee ticket refund request.
 * Requires ownership verification and returns sanitized summary without guestToken.
 */
export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const booking = await getBookingById(id);
    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Pemesanan tiket tidak ditemukan." },
        { status: 404 }
      );
    }

    const body = await req.json();
    const candidateToken = body.guestToken || body.token || null;

    const ownership = await verifyTicketRefundOwnership(req, booking, candidateToken);
    if (!ownership.authorized) {
      return NextResponse.json(
        { success: false, error: ownership.error || "Akses ditolak." },
        { status: 403 }
      );
    }

    const payload: RequestRefundPayload = {
      reason: body.reason,
      bankName: body.bankName,
      accountNumber: body.accountNumber,
      accountHolder: body.accountHolder,
    };

    const updatedBooking = await requestTicketRefund(id, payload);

    return NextResponse.json({
      success: true,
      message: "Pengajuan refund tiket berhasil diajukan dan sedang menunggu verifikasi admin.",
      data: {
        bookingId: updatedBooking.id,
        ticketCode: updatedBooking.ticketCode,
        paymentStatus: updatedBooking.paymentStatus,
        refundStatus: updatedBooking.refundStatus,
        refundRequest: updatedBooking.refundRequest,
      },
    });
  } catch (error: any) {
    console.error("[api/events/bookings/refund] POST error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengajukan refund tiket." },
      { status: 400 }
    );
  }
}
