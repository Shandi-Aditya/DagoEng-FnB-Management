import { NextRequest, NextResponse } from "next/server";
import {
  getBookingById,
  getAdminEventById,
  validateTicketRefundEligibility,
  requestTicketRefund,
} from "@/lib/events";
import { RequestRefundPayload } from "@/types/event";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/bookings/[id]/refund
 * Checks if a specific ticket booking is eligible for refund under event policy.
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
 */
export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const body = await req.json();

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
      booking: updatedBooking,
    });
  } catch (error: any) {
    console.error("[api/events/bookings/refund] POST error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengajukan refund tiket." },
      { status: 400 }
    );
  }
}
