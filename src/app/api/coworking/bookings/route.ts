import { NextRequest, NextResponse } from "next/server";
import { getCoworkingBookings, saveCoworkingBooking } from "@/lib/persistent-storage";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const status = searchParams.get("status");

    let bookings = await getCoworkingBookings();

    if (date) {
      bookings = bookings.filter((b) => b.date === date);
    }
    if (status) {
      bookings = bookings.filter((b) => b.paymentStatus === status || b.status === status);
    }

    return NextResponse.json({ bookings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const booking = body.booking || body;

    if (!booking.spaceId || !booking.guestName) {
      return NextResponse.json({ error: "Booking requires spaceId and guestName." }, { status: 400 });
    }

    if (!booking.id) {
      booking.id = `cwb-${Date.now()}`;
    }
    if (!booking.bookingCode) {
      booking.bookingCode = `CW-SGR-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    if (!booking.createdAt) {
      booking.createdAt = new Date().toISOString();
    }

    await saveCoworkingBooking(booking);
    return NextResponse.json({ success: true, booking });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
