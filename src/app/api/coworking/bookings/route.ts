import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_COWORKING_HOLIDAY_CONFIG,
  normalizeDateToYMD,
  validateCoworkingBookingSchedule,
  type CoworkingHolidayConfig,
} from "@/lib/operating-hours";
import {
  getCoworkingBookings,
  readPersistentData,
  saveCoworkingBooking,
  writePersistentData,
} from "@/lib/persistent-storage";
import { getRequestAuthUser, type ServerAuthResult } from "@/lib/server-auth";
import type { RoleSlug } from "@/types/auth";

const FILE_COWORKING_BOOKINGS = "coworking_bookings.json";

const COWORKING_READ_ROLES: RoleSlug[] = [
  "SUPER_ADMIN",
  "OWNER",
  "MANAGER",
  "CASHIER",
  "CUSTOMER",
];

const COWORKING_WRITE_ROLES: RoleSlug[] = [
  "SUPER_ADMIN",
  "OWNER",
  "MANAGER",
  "CASHIER",
  "CUSTOMER",
];

function isNonTenantOwner(auth: ServerAuthResult): boolean {
  return (
    auth.isAuthenticated &&
    auth.role === "OWNER" &&
    !auth.tenantId &&
    auth.scopeLevel !== "TENANT"
  );
}

function isCallerOwnedBooking(
  booking: Record<string, unknown>,
  auth: ServerAuthResult
): boolean {
  if (auth.userId && booking.userId === auth.userId) {
    return true;
  }
  if (
    auth.email &&
    typeof booking.guestEmail === "string" &&
    booking.guestEmail.toLowerCase() === auth.email.toLowerCase()
  ) {
    return true;
  }
  return false;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role) {
      return NextResponse.json(
        {
          error:
            auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan.",
        },
        { status: 401 }
      );
    }

    if (!COWORKING_READ_ROLES.includes(auth.role)) {
      return NextResponse.json(
        {
          error: `FORBIDDEN: Role [${auth.role}] tidak memiliki akses data booking coworking.`,
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const status = searchParams.get("status");

    let bookings = await getCoworkingBookings();

    if (date) {
      const targetYmd = normalizeDateToYMD(date);
      bookings = bookings.filter((b: Record<string, unknown>) => {
        const rawStart = typeof b.date === "string" ? b.date : "";
        const rawEnd = typeof b.endDate === "string" ? b.endDate : rawStart;
        const startYmd = normalizeDateToYMD(rawStart);
        const endYmd = normalizeDateToYMD(rawEnd) || startYmd;
        if (!targetYmd) return rawStart === date;
        return Boolean(startYmd) && targetYmd >= startYmd && targetYmd <= endYmd;
      });
    }
    if (status) {
      bookings = bookings.filter(
        (b: Record<string, unknown>) =>
          b.checkInStatus === status ||
          b.paymentStatus === status ||
          b.status === status
      );
    }

    if (auth.role === "CUSTOMER") {
      bookings = bookings.flatMap((b: Record<string, unknown>) => {
        if (isCallerOwnedBooking(b, auth)) {
          return [b];
        }
        if (
          b.checkInStatus === "CANCELLED" ||
          b.checkInStatus === "COMPLETED"
        ) {
          return [];
        }
        return [
          {
            ...b,
            guestName: "Terisi",
            guestPhone: "",
            guestEmail: "",
            company: undefined,
            notes: undefined,
            userId: undefined,
            paymentRef: undefined,
            qrisVerification: undefined,
            fnbVoucherApplied: undefined,
          },
        ];
      });
    }

    return NextResponse.json({ bookings });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role || !auth.userId) {
      return NextResponse.json(
        {
          error:
            auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan.",
        },
        { status: 401 }
      );
    }

    if (!COWORKING_WRITE_ROLES.includes(auth.role)) {
      return NextResponse.json(
        {
          error: `FORBIDDEN: Role [${auth.role}] tidak memiliki izin membuat atau mengubah booking coworking.`,
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const booking = { ...(body.booking || body) };

    if (!booking.spaceId || !booking.guestName) {
      return NextResponse.json(
        { error: "Booking requires spaceId and guestName." },
        { status: 400 }
      );
    }

    const existingBookings = await getCoworkingBookings();
    const matchedExisting = existingBookings.find(
      (b: Record<string, unknown>) =>
        (booking.id && b.id === booking.id) ||
        (booking.bookingCode && b.bookingCode === booking.bookingCode)
    );

    if (
      !matchedExisting &&
      booking.date &&
      booking.checkInStatus !== "CANCELLED" &&
      booking.checkInStatus !== "COMPLETED"
    ) {
      const storedSettings = await readPersistentData<{
        coworkingHolidays?: CoworkingHolidayConfig;
      } | null>("platform_settings.json", null);
      const scheduleCheck = validateCoworkingBookingSchedule(
        {
          bookingType:
            typeof booking.bookingType === "string" ? booking.bookingType : "HOURLY",
          date: String(booking.date),
          endDate: typeof booking.endDate === "string" ? booking.endDate : undefined,
          startTime:
            typeof booking.startTime === "string" ? booking.startTime : undefined,
          endTime: typeof booking.endTime === "string" ? booking.endTime : undefined,
          duration:
            typeof booking.duration === "number" ? booking.duration : undefined,
        },
        storedSettings?.coworkingHolidays ?? DEFAULT_COWORKING_HOLIDAY_CONFIG
      );
      if (!scheduleCheck.isValid) {
        return NextResponse.json(
          { error: scheduleCheck.reason || "Jadwal co-working tutup." },
          { status: 400 }
        );
      }
    }

    if (auth.role === "CUSTOMER") {
      if (matchedExisting) {
        const isSameUser =
          (matchedExisting.userId && matchedExisting.userId === auth.userId) ||
          (!matchedExisting.userId &&
            matchedExisting.guestEmail &&
            auth.email &&
            String(matchedExisting.guestEmail).toLowerCase() ===
              auth.email.toLowerCase());

        if (!isSameUser) {
          return NextResponse.json(
            {
              error:
                "FORBIDDEN: Pelanggan tidak diizinkan mengubah atau menimpa booking coworking milik pengguna lain.",
            },
            { status: 403 }
          );
        }
      }

      booking.userId = auth.userId;
      if (auth.email && !booking.guestEmail) {
        booking.guestEmail = auth.email;
      }
    } else if (!booking.userId) {
      booking.userId = auth.userId;
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role) {
      return NextResponse.json(
        {
          error:
            auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan.",
        },
        { status: 401 }
      );
    }

    if (auth.role !== "SUPER_ADMIN" && !isNonTenantOwner(auth)) {
      return NextResponse.json(
        {
          error:
            "FORBIDDEN: Hanya Super Admin atau Hub Owner yang dapat mereset seluruh data booking co-working.",
        },
        { status: 403 }
      );
    }

    await writePersistentData(FILE_COWORKING_BOOKINGS, []);
    return NextResponse.json({ success: true, bookings: [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
