import { NextRequest, NextResponse } from "next/server";
import { getDokuConfig, verifyDokuNotificationSignature } from "@/lib/doku";
import { loadBookingsFromDisk, saveBookingsToDisk } from "@/lib/events";
import { EventTicketOrder } from "@/types/event";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/doku
 * Official DOKU HTTP Notification Webhook Handler.
 *
 * Verifies HMAC-SHA256 signature, validates invoice & amount against internal records,
 * ensures idempotency, and updates ticket order payment status to PAID upon verified SUCCESS.
 */
export async function POST(req: NextRequest) {
  try {
    const clientId = req.headers.get("client-id") || "";
    const requestId = req.headers.get("request-id") || "";
    const requestTimestamp = req.headers.get("request-timestamp") || "";
    const signature = req.headers.get("signature") || "";

    const rawBody = await req.text();
    const config = getDokuConfig();

    // Verify incoming signature
    const isValidSignature = verifyDokuNotificationSignature({
      clientId,
      requestId,
      requestTimestamp,
      requestTarget: "/api/webhooks/doku",
      rawBody,
      receivedSignature: signature,
      secretKey: config.secretKey,
    });

    if (!isValidSignature) {
      console.warn("[DOKU Webhook] Permintaan ditolak: Signature HMAC tidak valid.", {
        clientId,
        requestId,
      });
      return NextResponse.json(
        { error: "Invalid DOKU signature" },
        { status: 401 }
      );
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Malformed JSON payload" },
        { status: 400 }
      );
    }

    const invoiceNumber = body?.order?.invoice_number;
    const amount = Number(body?.order?.amount);
    const transactionStatus = body?.transaction?.status; // "SUCCESS" | "FAILED"

    if (!invoiceNumber) {
      return NextResponse.json(
        { error: "Missing invoice_number" },
        { status: 400 }
      );
    }

    const allBookings = loadBookingsFromDisk();
    // Match either by stored dokuInvoiceNumber or parsed ticketCode (e.g. INV-DAGO-EVT-XXXXX)
    const bookingIndex = allBookings.findIndex((b: EventTicketOrder) => {
      if (b.dokuInvoiceNumber && b.dokuInvoiceNumber === invoiceNumber) return true;
      if (`INV-${b.ticketCode}` === invoiceNumber) return true;
      return false;
    });

    if (bookingIndex === -1) {
      console.warn(`[DOKU Webhook] Pesanan dengan invoice ${invoiceNumber} tidak ditemukan.`);
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    const booking = allBookings[bookingIndex];

    // Verify amount match
    if (!isNaN(amount) && amount !== Math.round(booking.totalPrice)) {
      console.warn(
        `[DOKU Webhook] Ketidakcocokan nominal untuk invoice ${invoiceNumber}: DOKU=${amount}, Sistem=${booking.totalPrice}`
      );
      return NextResponse.json(
        { error: "Amount mismatch" },
        { status: 400 }
      );
    }

    // Idempotency: if already settled as PAID, acknowledge immediately without duplicate issuance
    if (booking.paymentStatus === "PAID") {
      return NextResponse.json(
        { message: "SUCCESS", status: "ALREADY_PROCESSED" },
        { status: 200 }
      );
    }

    // Process transaction status
    if (transactionStatus === "SUCCESS") {
      const wasCancelled = booking.paymentStatus === "CANCELLED";
      const now = new Date().toISOString();
      const updatedBooking: EventTicketOrder = {
        ...booking,
        paymentStatus: "PAID",
        paidAt: now,
        updatedAt: now,
      };

      allBookings[bookingIndex] = updatedBooking;
      saveBookingsToDisk(allBookings);

      if (wasCancelled) {
        console.warn(
          `[DOKU Webhook] Rekonsiliasi: Pesanan ${booking.ticketCode} (invoice ${invoiceNumber}) sebelumnya berstatus CANCELLED karena batas waktu, berhasil direkonsiliasi menjadi PAID.`
        );
      } else {
        console.info(
          `[DOKU Webhook] Pembayaran diverifikasi: Invoice ${invoiceNumber}, Tiket ${booking.ticketCode} resmi diterbitkan.`
        );
      }
    } else if (transactionStatus === "FAILED" || transactionStatus === "EXPIRED") {
      if (booking.paymentStatus === "CANCELLED") {
        return NextResponse.json(
          { message: "SUCCESS", status: "ALREADY_PROCESSED" },
          { status: 200 }
        );
      }

      const now = new Date().toISOString();
      allBookings[bookingIndex] = {
        ...booking,
        paymentStatus: "CANCELLED",
        updatedAt: now,
      };
      saveBookingsToDisk(allBookings);

      console.info(
        `[DOKU Webhook] Status pembayaran ${transactionStatus} diterima untuk invoice ${invoiceNumber}. Kuota tiket ${booking.ticketCode} resmi dibebaskan.`
      );
    } else {
      console.info(
        `[DOKU Webhook] Status non-sukses diterima (${transactionStatus}) untuk invoice ${invoiceNumber}.`
      );
    }

    return NextResponse.json(
      {
        message: "SUCCESS",
        invoice_number: invoiceNumber,
      },
      {
        status: 200,
        headers: {
          "Client-Id": config.clientId,
          "Request-Id": requestId,
          "Response-Timestamp": new Date().toISOString(),
        },
      }
    );
  } catch (err: any) {
    console.error("[DOKU Webhook] Terjadi kesalahan server:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
