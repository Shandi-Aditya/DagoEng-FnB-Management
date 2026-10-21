import { NextRequest, NextResponse } from "next/server";
import { updateBookingCheckIn, updateBookingPaymentStatus, getBookingById } from "@/lib/events";
import { assertEventAdmin } from "@/lib/server-auth";
import { AttendeeCheckInStatus, TicketPaymentStatus } from "@/types/event";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/events/bookings/[id]
 * Admin endpoint to update ticket check-in status or payment status.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await assertEventAdmin(req);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 403 }
      );
    }

    const { id } = params;
    const existing = await getBookingById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: `Pemesanan tiket dengan ID ${id} tidak ditemukan.` },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { checkInStatus, paymentStatus } = body;

    let updated = existing;

    if (checkInStatus) {
      if (checkInStatus !== "CHECKED_IN" && checkInStatus !== "REGISTERED") {
        return NextResponse.json(
          { success: false, error: "Status kehadiran tidak valid (harus CHECKED_IN atau REGISTERED)." },
          { status: 400 }
        );
      }
      updated = await updateBookingCheckIn(id, checkInStatus as AttendeeCheckInStatus);
    }

    if (paymentStatus) {
      if (paymentStatus !== "PAID" && paymentStatus !== "CANCELLED" && paymentStatus !== "PENDING") {
        return NextResponse.json(
          { success: false, error: "Status pembayaran tiket tidak valid." },
          { status: 400 }
        );
      }
      updated = await updateBookingPaymentStatus(id, paymentStatus as TicketPaymentStatus);
    }

    return NextResponse.json({
      success: true,
      message: "Data tiket peserta berhasil diperbarui.",
      data: updated,
    });
  } catch (error: any) {
    console.error(`PATCH /api/events/bookings/${params.id} error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memperbarui tiket peserta." },
      { status: 500 }
    );
  }
}
