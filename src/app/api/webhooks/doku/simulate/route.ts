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
    // Production Security Guard: Reject simulation lookup in production without simulation mode
    if (process.env.NODE_ENV === "production" && process.env.DOKU_SIMULATION_MODE !== "true") {
      return NextResponse.json(
        {
          success: false,
          error: "FORBIDDEN: Simulator pembayaran dinonaktifkan di environment production.",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const invoice = searchParams.get("invoice") || "";
    const token = searchParams.get("token") || "";

    const allBookings = loadBookingsFromDisk();
    const booking = allBookings.find((b) => {
      if (token && b.dokuPaymentUrl?.includes(token.trim())) return true;
      if (invoice && (b.dokuInvoiceNumber?.toUpperCase() === invoice.trim().toUpperCase() || b.ticketCode?.toUpperCase() === invoice.trim().toUpperCase())) return true;
      return false;
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Data transaksi pemesanan tidak ditemukan." },
        { status: 404 }
      );
    }

    // Layer 2: Private checkout token protection (prevents PII scraping by invoice guessing)
    if (booking.dokuPaymentUrl && booking.dokuPaymentUrl.includes("/checkout-link-v2/")) {
      const expectedToken = booking.dokuPaymentUrl.split("/checkout-link-v2/")[1]?.split("?")[0];
      if (expectedToken && (!token || token.trim() !== expectedToken.trim())) {
        return NextResponse.json(
          { success: false, error: "UNAUTHORIZED: Akses simulator membutuhkan token checkout privat yang valid." },
          { status: 401 }
        );
      }
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
    // Layer 1: Production Security Isolation Guard
    const isProd = process.env.NODE_ENV === "production";
    const simAllowed = process.env.DOKU_SIMULATION_MODE === "true";
    const config = getDokuConfig();
    const isLiveGateway = !config.apiUrl.includes("sandbox") && !config.clientId.includes("TEST");

    if (isProd && (!simAllowed || isLiveGateway)) {
      return NextResponse.json(
        {
          success: false,
          error: "FORBIDDEN: Endpoint simulasi pembayaran dinonaktifkan di environment production.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { invoiceNumber, status = "SUCCESS", token } = body;

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

    // Layer 2: Payment method validation
    if (booking.paymentMethod !== "DOKU_CHECKOUT") {
      return NextResponse.json(
        {
          success: false,
          error: "FORBIDDEN: Pemesanan ini tidak menggunakan metode pembayaran DOKU Checkout.",
        },
        { status: 400 }
      );
    }

    // Layer 3: State machine validation (cannot settle expired or cancelled bookings)
    if (booking.paymentStatus === "CANCELLED" || booking.paymentStatus === "EXPIRED") {
      return NextResponse.json(
        {
          success: false,
          error: "CONFLICT: Pesanan telah dibatalkan atau kedaluwarsa sehingga tidak dapat diselesaikan via simulasi.",
        },
        { status: 409 }
      );
    }

    // Layer 4: Private Checkout Session Token verification (prevents unauthorized callers from forging settlement)
    if (booking.dokuPaymentUrl && booking.dokuPaymentUrl.includes("/checkout-link-v2/")) {
      const expectedToken = booking.dokuPaymentUrl.split("/checkout-link-v2/")[1]?.split("?")[0];
      if (expectedToken && (!token || token.trim() !== expectedToken.trim())) {
        return NextResponse.json(
          {
            success: false,
            error: "UNAUTHORIZED: Token checkout privat tidak valid atau tidak disertakan.",
          },
          { status: 401 }
        );
      }
    }

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
