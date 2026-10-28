import { NextRequest, NextResponse } from "next/server";
import { createEventBooking, loadBookingsFromDisk, saveBookingsToDisk, getEventRevenuePolicy } from "@/lib/events";
import { createDokuCheckoutSession, DokuCheckoutError } from "@/lib/doku";
import { EventBookingPayload } from "@/types/event";

export const dynamic = "force-dynamic";

/**
 * POST /api/events/[id]/book
 * Public endpoint to book tickets for an event.
 * Enforces rate limiting, server-side price calculation, input sanitization,
 * manual bank transfer with destination bank snapshot, or DOKU Checkout session.
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

    // Determine payment routing: Manual Bank Transfer vs DOKU Checkout
    let paymentUrl: string | null = null;
    const policy = getEventRevenuePolicy();
    const isManualTransfer =
      payload.paymentMethod === "TRANSFER" ||
      payload.paymentMethod === "MANUAL_TRANSFER" ||
      (policy.activePaymentMethod === "MANUAL_TRANSFER" && !process.env.DOKU_SIMULATION_MODE && payload.paymentMethod !== "DOKU_CHECKOUT");

    if (booking.totalPrice > 0) {
      if (isManualTransfer) {
        // Direct attendee to payment & ticket page with destination bank snapshot
        paymentUrl = `/events/tickets/${booking.guestToken}`;
      } else {
        // Initiate DOKU Checkout session
        try {
          const dokuSession = await createDokuCheckoutSession(booking);
          paymentUrl = dokuSession.paymentUrl;

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
    }

    return NextResponse.json(
      {
        success: true,
        message:
          booking.totalPrice > 0
            ? (isManualTransfer
                ? "Pemesanan berhasil dibuat. Silakan lakukan transfer bank manual ke rekening resmi tujuan dan unggah bukti transfer."
                : "Pemesanan berhasil dibuat. Silakan selesaikan pembayaran melalui DOKU Checkout.")
            : "Pemesanan tiket berhasil diterbitkan!",
        data: {
          ...booking,
          paymentUrl,
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
