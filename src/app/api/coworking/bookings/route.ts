import { NextRequest, NextResponse } from "next/server";
import { getCoworkingBookings, saveCoworkingBooking } from "@/lib/persistent-storage";
import { getRequestAuthUser } from "@/lib/server-auth";
import { RoleSlug } from "@/types/auth";

const COWORKING_READ_ROLES: RoleSlug[] = ["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER"];
const COWORKING_WRITE_ROLES: RoleSlug[] = ["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER", "CUSTOMER"];

export async function GET(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role) {
      return NextResponse.json(
        { error: auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan." },
        { status: 401 }
      );
    }

    if (!COWORKING_READ_ROLES.includes(auth.role)) {
      return NextResponse.json(
        { error: `FORBIDDEN: Role [${auth.role}] tidak memiliki akses data booking coworking.` },
        { status: 403 }
      );
    }

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
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role) {
      return NextResponse.json(
        { error: auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan." },
        { status: 401 }
      );
    }

    if (!COWORKING_WRITE_ROLES.includes(auth.role)) {
      return NextResponse.json(
        { error: `FORBIDDEN: Role [${auth.role}] tidak memiliki izin membuat atau mengubah booking coworking.` },
        { status: 403 }
      );
    }

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
