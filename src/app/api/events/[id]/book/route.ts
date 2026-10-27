import { NextRequest, NextResponse } from "next/server";
import { createEventBooking, loadBookingsFromDisk, saveBookingsToDisk } from "@/lib/events";
import { createDokuCheckoutSession, DokuCheckoutError } from "@/lib/doku";
import { EventBookingPayload } from "@/types/event";

export const dynamic = "force-dynamic";

/**
 * POST /api/events/[id]/book
 * Public endpoint to book tickets for an event.
 * Enforces rate limiting, server-side price calculation, input sanitization,
 * and initiates DOKU Checkout session for paid events.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body: EventBookingPayload = await req.json();

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    const payload: EventBookingPayload = {
      ...body,
      eventId: id,
    };

    let booking = await createEventBooking(payload, clientIp);

    // If booking requires payment, initiate DOKU Checkout session
    let dokuPaymentUrl: string | null = null;
    if (booking.totalPrice > 0) {
      try {
        const dokuSession = await createDokuCheckoutSession(booking);
        dokuPaymentUrl = dokuSession.paymentUrl;

        // Persist DOKU invoice number and payment URL
        const allBookings = loadBookingsFromDisk();
        const idx = allBookings.findIndex((b) => b.id === booking.id);
        if (idx !== -1) {
          allBookings[idx] = {
            ...allBookings[idx],
            paymentMethod: "DOKU_CHECKOUT",
            dokuInvoiceNumber: dokuSession.invoiceNumber,
            dokuPaymentUrl: dokuSession.paymentUrl,
            updatedAt: new Date().toISOString(),
          };
          saveBookingsToDisk(allBookings);
          booking = allBookings[idx];
        }
      } catch (dokuErr: any) {
        console.error("DOKU Checkout initialization error:", dokuErr);

        const isDefinite =
          dokuErr instanceof DokuCheckoutError ? dokuErr.isDefiniteFailure : false;

        if (isDefinite) {
          // Definite pre-transaction failure: roll back booking to CANCELLED to immediately release held quota
          const allBookings = loadBookingsFromDisk();
          const idx = allBookings.findIndex((b) => b.id === booking.id);
          if (idx !== -1) {
            allBookings[idx] = {
              ...allBookings[idx],
              paymentStatus: "CANCELLED",
              updatedAt: new Date().toISOString(),
            };
            saveBookingsToDisk(allBookings);
          }
          return NextResponse.json(
            {
              success: false,
              error: `Gagal menginisiasi pembayaran: ${dokuErr.message}. Kuota tiket telah dilepaskan secara aman.`,
            },
            { status: 502 }
          );
        }

        // Indeterminate timeout / gateway 5xx: preserve PENDING status so webhook or retry is not blocked
        return NextResponse.json(
          {
            success: false,
            error:
              "Koneksi ke gateway pembayaran mengalami batas waktu. Pesanan Anda tersimpan dengan status PENDING. Silakan hubungi layanan pelanggan atau tunggu beberapa saat.",
            bookingId: booking.id,
          },
          { status: 504 }
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        message:
          booking.totalPrice > 0
            ? "Pemesanan berhasil dibuat. Silakan selesaikan pembayaran melalui DOKU Checkout."
            : "Pemesanan tiket berhasil diterbitkan!",
        data: {
          ...booking,
          paymentUrl: dokuPaymentUrl,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error(`POST /api/events/${params.id}/book error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memproses pemesanan tiket." },
      { status: 400 }
    );
  }
}
