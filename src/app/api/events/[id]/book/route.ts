import { NextRequest, NextResponse } from "next/server";
import { createEventBooking } from "@/lib/events";
import { EventBookingPayload } from "@/types/event";

export const dynamic = "force-dynamic";

/**
 * POST /api/events/[id]/book
 * Public endpoint to book tickets for an event.
 * Enforces rate limiting, server-side price calculation, and input sanitization.
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

    const booking = await createEventBooking(payload, clientIp);

    return NextResponse.json(
      {
        success: true,
        message: "Pemesanan tiket berhasil diterbitkan!",
        data: booking,
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
