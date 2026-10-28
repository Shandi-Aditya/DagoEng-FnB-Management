import { NextRequest, NextResponse } from "next/server";
import {
  updateBookingCheckIn,
  updateBookingPaymentStatus,
  getBookingById,
  updateBookingPaymentProof,
  adminApproveBookingPayment,
  adminRejectBookingPayment,
} from "@/lib/events";
import { assertEventAdmin, assertCheckInAuth } from "@/lib/server-auth";
import { AttendeeCheckInStatus, TicketPaymentStatus } from "@/types/event";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/events/bookings/[id]
 * Endpoint to update ticket check-in status (Field Officer, Organizer, or Admin)
 * or payment status (strictly Admin).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const existing = await getBookingById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: `Pemesanan tiket dengan ID ${id} tidak ditemukan.` },
        { status: 404 }
      );
    }

    const body = await req.json();
    const {
      action,
      checkInStatus,
      paymentStatus,
      paymentProofUrl,
      paymentProofNote,
      verificationNote,
      rejectionReason,
      cancelBooking,
      incrementQty,
      targetQty,
      reset,
    } = body;

    // Strict role and permission validation on server:
    // - Payment status modification is strictly restricted to authorized Hub Admins.
    // - Check-in operations allow Field Check-in Officers (WAITER, CASHIER), Hub Management, and assigned Organizer.
    let updated = existing;

    if (action === "APPROVE_PAYMENT") {
      const adminAuth = await assertEventAdmin(req);
      if (!adminAuth.authorized) {
        return NextResponse.json(
          { success: false, error: adminAuth.error },
          { status: 403 }
        );
      }
      updated = await adminApproveBookingPayment(id, verificationNote, adminAuth.name || "Admin Dago");
      return NextResponse.json({
        success: true,
        message: "Pembayaran tiket berhasil diverifikasi dan disetujui (PAID). Tiket dan QR code kini aktif.",
        data: updated,
      });
    }

    if (action === "REJECT_PAYMENT") {
      const adminAuth = await assertEventAdmin(req);
      if (!adminAuth.authorized) {
        return NextResponse.json(
          { success: false, error: adminAuth.error },
          { status: 403 }
        );
      }
      if (!rejectionReason || !rejectionReason.trim()) {
        return NextResponse.json(
          { success: false, error: "Alasan penolakan pembayaran wajib diisi." },
          { status: 400 }
        );
      }
      updated = await adminRejectBookingPayment(
        id,
        rejectionReason,
        { cancelBooking: Boolean(cancelBooking) },
        adminAuth.name || "Admin Dago"
      );
      return NextResponse.json({
        success: true,
        message: cancelBooking
          ? "Bukti pembayaran ditolak dan pemesanan tiket telah dibatalkan."
          : "Bukti pembayaran ditolak. Peserta dapat mengunggah bukti perbaikan sebelum batas waktu berakhir.",
        data: updated,
      });
    }

    if (paymentStatus) {
      const adminAuth = await assertEventAdmin(req);
      if (!adminAuth.authorized) {
        return NextResponse.json(
          { success: false, error: adminAuth.error },
          { status: 403 }
        );
      }
      if (paymentStatus !== "PAID" && paymentStatus !== "CANCELLED" && paymentStatus !== "PENDING" && paymentStatus !== "FAILED") {
        return NextResponse.json(
          { success: false, error: "Status pembayaran tiket tidak valid." },
          { status: 400 }
        );
      }
      updated = await updateBookingPaymentStatus(id, paymentStatus as TicketPaymentStatus, {
        rejectionReason,
        verificationNote,
        actorName: adminAuth.name || "Admin Dago",
      });
    } else if (checkInStatus) {
      const checkInAuth = await assertCheckInAuth(req, existing.eventId);
      if (!checkInAuth.authorized) {
        return NextResponse.json(
          { success: false, error: checkInAuth.error },
          { status: 403 }
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
            error:
              "Status kehadiran tidak valid (harus CHECKED_IN, PARTIALLY_CHECKED_IN, atau REGISTERED).",
          },
          { status: 400 }
        );
      }
      updated = await updateBookingCheckIn(id, checkInStatus as AttendeeCheckInStatus, {
        incrementQty,
        targetQty,
        reset,
      });
    }

    if (paymentProofUrl) {
      updated = await updateBookingPaymentProof(
        { bookingId: id },
        { paymentProofUrl, paymentProofNote }
      );
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
      { status: 400 }
    );
  }
}
