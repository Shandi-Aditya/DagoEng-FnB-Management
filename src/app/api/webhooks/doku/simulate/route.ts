import { NextRequest, NextResponse } from "next/server";
import { getDokuConfig, generateDokuSignature } from "@/lib/doku";
import { loadBookingsFromDisk, saveBookingsToDisk } from "@/lib/events";
import { EventTicketOrder } from "@/types/event";

export const dynamic = "force-dynamic";

/**
 * GET /api/webhooks/doku/simulate?invoice=...&token=...
 * Looks up booking details for DOKU Simulator UI presentation.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const invoice = searchParams.get("invoice") || "";
    const token = searchParams.get("token") || "";

    const allBookings = loadBookingsFromDisk();
    const booking = allBookings.find((b) => {
      if (invoice && b.dokuInvoiceNumber?.toUpperCase() === invoice.trim().toUpperCase()) return true;
      if (invoice && b.ticketCode?.toUpperCase() === invoice.trim().toUpperCase()) return true;
      if (token && b.dokuPaymentUrl?.includes(token.trim())) return true;
      return false;
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Data transaksi pemesanan tidak ditemukan." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: booking.id,
        ticketCode: booking.ticketCode,
        eventId: booking.eventId,
        eventTitle: booking.eventTitle,
        guestName: booking.guestName,
        guestEmail: booking.guestEmail,
        ticketCount: booking.ticketCount,
        unitPrice: booking.unitPrice,
        totalPrice: booking.totalPrice,
        paymentStatus: booking.paymentStatus,
        dokuInvoiceNumber: booking.dokuInvoiceNumber,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Gagal mengambil data transaksi." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/webhooks/doku/simulate
 * Developer / QA endpoint to simulate a DOKU webhook notification with valid HMAC signature.
 * Enables full end-to-end payment testing in development without external webhooks.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { invoiceNumber, status = "SUCCESS" } = body;

    if (!invoiceNumber) {
      return NextResponse.json(
        { success: false, error: "Nomor invoice wajib disertakan." },
        { status: 400 }
      );
    }

    const allBookings = loadBookingsFromDisk();
    const booking = allBookings.find(
      (b) =>
        b.dokuInvoiceNumber?.toUpperCase() === invoiceNumber.trim().toUpperCase() ||
        b.ticketCode?.toUpperCase() === invoiceNumber.trim().toUpperCase()
    );

    if (!booking) {
      return NextResponse.json(
        {
          success: false,
          error: `Pemesanan tiket dengan invoice "${invoiceNumber}" tidak ditemukan.`,
        },
        { status: 404 }
      );
    }

    const config = getDokuConfig();
    const requestId = `sim-${Date.now()}`;
    const requestTimestamp = new Date().toISOString();
    const targetStatus = status === "FAILED" ? "FAILED" : "SUCCESS";

    const webhookPayload = {
      order: {
        invoice_number: booking.dokuInvoiceNumber || `INV-${booking.ticketCode}`,
        amount: Math.round(booking.totalPrice),
      },
      transaction: {
        status: targetStatus,
        date: requestTimestamp,
        original_request_id: requestId,
      },
      payment: {
        type: "DOKU_CHECKOUT_SIMULATION",
      },
    };

    const signature = generateDokuSignature({
      clientId: config.clientId,
      requestId,
      requestTimestamp,
      requestTarget: "/api/webhooks/doku",
      body: webhookPayload,
      secretKey: config.secretKey,
    });

    // Update internal booking state directly & safely
    const updatedBookings = allBookings.map((b) => {
      if (b.id === booking.id) {
        return {
          ...b,
          paymentStatus: targetStatus === "SUCCESS" ? "PAID" : "CANCELLED",
          paidAt: targetStatus === "SUCCESS" ? requestTimestamp : b.paidAt,
          updatedAt: requestTimestamp,
        } as EventTicketOrder;
      }
      return b;
    });

    saveBookingsToDisk(updatedBookings);

    return NextResponse.json({
      success: true,
      message:
        targetStatus === "SUCCESS"
          ? `Simulasi pembayaran berhasil! Tiket ${booking.ticketCode} resmi berstatus PAID.`
          : `Simulasi pembatalan berhasil. Tiket ${booking.ticketCode} berstatus CANCELLED.`,
      data: {
        ticketCode: booking.ticketCode,
        invoiceNumber: booking.dokuInvoiceNumber,
        paymentStatus: targetStatus === "SUCCESS" ? "PAID" : "CANCELLED",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Gagal memproses simulasi webhook." },
      { status: 500 }
    );
  }
}
