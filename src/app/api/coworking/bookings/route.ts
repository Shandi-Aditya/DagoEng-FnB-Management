import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_COWORKING_HOLIDAY_CONFIG,
  normalizeDateToYMD,
  validateCoworkingBookingSchedule,
} from "@/lib/operating-hours";
import {
  claimQrisSessionForOrder,
  getCoworkingBookings,
  getPersistentQrisSession,
  getPersistentQrisSessions,
  isVerifiedQrisStatus,
  readPersistentDomainState,
  readSeededPersistentData,
  saveCoworkingBooking,
  savePersistentQrisSession,
  writePersistentData,
} from "@/lib/persistent-storage";
import { resolveSelfOrderPaymentMethod } from "@/lib/self-order-policy";
import { getRequestAuthUser, type ServerAuthResult } from "@/lib/server-auth";
import { coworkingMasterDomainSpec } from "@/lib/sync-domains/spaces-spec";
import type { RoleSlug } from "@/types/auth";
import { DEFAULT_PLATFORM_SETTINGS, type PlatformSettings } from "@/types/settings";

const FILE_COWORKING_BOOKINGS = "coworking_bookings.json";

const QRIS_CLAIM_MESSAGES = {
  NOT_FOUND: "Sesi QRIS untuk invoice ini tidak ditemukan di server.",
  UNVERIFIED: "Pembayaran QRIS belum terverifikasi webhook atau supervisor.",
  AMOUNT_MISMATCH: "Nominal pembayaran QRIS tidak sama dengan total transaksi.",
  ALREADY_CONSUMED: "Pembayaran QRIS ini sudah dipakai untuk transaksi lain.",
} as const;

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

function validateBookingScheduleOrError(
  booking: Record<string, unknown>,
  platformSettings: PlatformSettings
): NextResponse | null {
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
    platformSettings.coworkingHolidays ?? DEFAULT_COWORKING_HOLIDAY_CONFIG
  );
  if (!scheduleCheck.isValid) {
    return NextResponse.json(
      { error: scheduleCheck.reason || "Jadwal co-working tutup." },
      { status: 400 }
    );
  }
  return null;
}

async function generateUniqueBookingCode(
  existingBookings: Record<string, unknown>[]
): Promise<string> {
  const qrisSessions = await getPersistentQrisSessions();
  const takenCodes = new Set(
    existingBookings
      .map((b) => (typeof b.bookingCode === "string" ? b.bookingCode : ""))
      .filter(Boolean)
  );
  const takenQrisKeys = new Set<string>();
  for (const s of qrisSessions) {
    if (s.invoiceNumber) takenQrisKeys.add(s.invoiceNumber);
    if (s.orderId) takenQrisKeys.add(s.orderId);
  }

  for (let attempt = 0; attempt < 25; attempt++) {
    const code = `CW-SGR-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!takenCodes.has(code) && !takenQrisKeys.has(code)) {
      return code;
    }
  }

  let fallbackCode = "";
  do {
    fallbackCode = `CW-SGR-${Date.now().toString().slice(-4)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  } while (takenCodes.has(fallbackCode) || takenQrisKeys.has(fallbackCode));
  return fallbackCode;
}

async function resolveBookingIdentityDefaults(params: {
  booking: Record<string, unknown>;
  existingBookings: Record<string, unknown>[];
  enforceUniqueCode?: boolean;
}): Promise<{ id: string; bookingCode: string; createdAt: string }> {
  const { booking, existingBookings, enforceUniqueCode = false } = params;
  const id =
    typeof booking.id === "string" && booking.id.trim()
      ? booking.id.trim()
      : `cwb-${Date.now()}`;
  const createdAt =
    typeof booking.createdAt === "string" && booking.createdAt.trim()
      ? booking.createdAt
      : new Date().toISOString();

  const candidateCode =
    typeof booking.bookingCode === "string" ? booking.bookingCode.trim() : "";
  if (!candidateCode) {
    return {
      id,
      bookingCode: await generateUniqueBookingCode(existingBookings),
      createdAt,
    };
  }

  if (enforceUniqueCode) {
    const existingQris = await getPersistentQrisSession(candidateCode);
    const isTaken =
      existingBookings.some((b) => b.bookingCode === candidateCode) ||
      Boolean(existingQris);
    if (isTaken) {
      return {
        id,
        bookingCode: await generateUniqueBookingCode(existingBookings),
        createdAt,
      };
    }
  }

  return { id, bookingCode: candidateCode, createdAt };
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
    const booking = { ...(body.booking || body) } as Record<string, unknown>;

    if (!booking.spaceId || !booking.guestName) {
      return NextResponse.json(
        { error: "Booking requires spaceId and guestName." },
        { status: 400 }
      );
    }

    const [existingBookings, platformSettings] = await Promise.all([
      getCoworkingBookings(),
      readSeededPersistentData<PlatformSettings>(
        "platform_settings.json",
        () => DEFAULT_PLATFORM_SETTINGS
      ),
    ]);

    const matchedExisting = existingBookings.find(
      (b: Record<string, unknown>) =>
        (booking.id && b.id === booking.id) ||
        (booking.bookingCode && b.bookingCode === booking.bookingCode)
    ) as Record<string, unknown> | undefined;

    if (auth.role === "CUSTOMER") {
      if (booking.paymentStatus !== undefined && booking.paymentStatus !== "PENDING") {
        return NextResponse.json(
          { error: "FORBIDDEN: Pelanggan tidak dapat mengubah status pembayaran menjadi lunas." },
          { status: 403 }
        );
      }
      if (typeof booking.paidAmount === "number" && booking.paidAmount > 0) {
        return NextResponse.json(
          { error: "FORBIDDEN: Pelanggan tidak dapat mengisi nominal pembayaran lunas." },
          { status: 403 }
        );
      }
      if (booking.qrisVerification !== undefined && booking.qrisVerification !== null) {
        return NextResponse.json(
          { error: "FORBIDDEN: Bukti verifikasi QRIS hanya dapat diproses oleh gateway atau staf." },
          { status: 403 }
        );
      }
      if (booking.checkInStatus === "CHECKED_IN" || booking.checkInStatus === "COMPLETED") {
        return NextResponse.json(
          { error: "FORBIDDEN: Check-in dan penyelesaian sesi ruang hanya dapat dilakukan oleh staf." },
          { status: 403 }
        );
      }

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

        if (
          matchedExisting.paymentStatus === "PAID" ||
          matchedExisting.checkInStatus === "CANCELLED" ||
          matchedExisting.checkInStatus === "COMPLETED"
        ) {
          return NextResponse.json(
            {
              error:
                "FORBIDDEN: Booking yang sudah lunas, dibatalkan, atau selesai tidak dapat diubah oleh pelanggan.",
            },
            { status: 403 }
          );
        }

        if (booking.checkInStatus === "CANCELLED") {
          const cancelledBooking = {
            ...matchedExisting,
            checkInStatus: "CANCELLED",
          };
          await saveCoworkingBooking(cancelledBooking);
          return NextResponse.json({ success: true, booking: cancelledBooking });
        }

        return NextResponse.json(
          {
            error:
              "FORBIDDEN: Booking coworking yang sudah dibuat tidak dapat diubah oleh pelanggan.",
          },
          { status: 403 }
        );
      }

      const bookingDate = typeof booking.date === "string" ? booking.date.trim() : "";
      if (!bookingDate) {
        return NextResponse.json(
          { error: "INVALID_DATE: Tanggal booking coworking wajib diisi." },
          { status: 400 }
        );
      }

      const scheduleError = validateBookingScheduleOrError(
        { ...booking, date: bookingDate },
        platformSettings
      );
      if (scheduleError) return scheduleError;

      const methodResolution = resolveSelfOrderPaymentMethod(
        booking.paymentMethod,
        platformSettings
      );
      if (!methodResolution.ok) {
        return NextResponse.json(
          { error: methodResolution.error, code: methodResolution.code },
          { status: methodResolution.status }
        );
      }

      const coworkingState = await readPersistentDomainState(coworkingMasterDomainSpec);
      const matchedSpace = coworkingState.spaces.find((s) => s.id === booking.spaceId);
      if (!matchedSpace) {
        return NextResponse.json(
          { error: "INVALID_SPACE: Ruang co-working tidak ditemukan di daftar resmi outlet." },
          { status: 400 }
        );
      }

      let duration = 1;
      if (booking.duration !== undefined && booking.duration !== null) {
        const parsedDuration = Number(booking.duration);
        if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
          return NextResponse.json(
            { error: "INVALID_DURATION: Durasi booking coworking wajib berupa angka positif." },
            { status: 400 }
          );
        }
        duration = parsedDuration;
      }

      const bookingType =
        typeof booking.bookingType === "string"
          ? booking.bookingType.trim().toUpperCase()
          : "HOURLY";
      const rate =
        bookingType === "DAILY"
          ? Number(matchedSpace.dailyRate || 0)
          : bookingType === "MONTHLY"
          ? Number(matchedSpace.monthlyRate ?? (matchedSpace.dailyRate || 0) * 20)
          : Number(matchedSpace.hourlyRate || 0);
      const authoritativePrice = Math.max(0, Math.round(rate * duration));

      const cwTax = platformSettings.categoryTax?.coworking;
      const taxEnabled = Boolean(cwTax?.isEnabled && Number(cwTax.taxRatePercent) > 0);
      const taxRatePercent = taxEnabled ? Number(cwTax!.taxRatePercent) : 0;
      const taxType = taxEnabled ? cwTax!.taxType : "NON_TAX";
      const taxAmount = taxEnabled
        ? Math.round(authoritativePrice * (taxRatePercent / 100))
        : 0;
      const authoritativeTotal = authoritativePrice + taxAmount;

      const identity = await resolveBookingIdentityDefaults({
        booking,
        existingBookings,
        enforceUniqueCode: true,
      });

      const customerBooking: Record<string, unknown> = {
        id: identity.id,
        bookingCode: identity.bookingCode,
        guestName: String(booking.guestName).trim(),
        guestPhone: typeof booking.guestPhone === "string" ? booking.guestPhone : "",
        guestEmail:
          typeof booking.guestEmail === "string" && booking.guestEmail.trim()
            ? booking.guestEmail.trim()
            : auth.email || "",
        ...(typeof booking.company === "string" && booking.company.trim()
          ? { company: booking.company.trim() }
          : {}),
        spaceId: matchedSpace.id,
        spaceName: matchedSpace.name,
        spaceType: matchedSpace.type,
        bookingType:
          bookingType === "DAILY" || bookingType === "MONTHLY" ? bookingType : "HOURLY",
        date: bookingDate,
        ...(typeof booking.endDate === "string" && booking.endDate.trim()
          ? { endDate: booking.endDate.trim() }
          : {}),
        startTime: typeof booking.startTime === "string" ? booking.startTime : "",
        ...(typeof booking.endTime === "string" && booking.endTime.trim()
          ? { endTime: booking.endTime.trim() }
          : {}),
        duration,
        price: authoritativePrice,
        discount: 0,
        tax: taxAmount,
        taxRatePercent,
        taxType,
        ...(typeof booking.outletId === "string" && booking.outletId.trim()
          ? { outletId: booking.outletId.trim() }
          : {}),
        totalAmount: authoritativeTotal,
        paidAmount: 0,
        remainingAmount: authoritativeTotal,
        paymentStatus: "PENDING",
        paymentMethod: methodResolution.paymentMethod,
        checkInStatus: "RESERVED",
        ...(typeof booking.notes === "string" && booking.notes.trim()
          ? { notes: booking.notes.trim() }
          : {}),
        userId: auth.userId,
        createdAt: identity.createdAt,
      };

      await saveCoworkingBooking(customerBooking);

      if (customerBooking.paymentMethod === "QRIS" && authoritativeTotal > 0) {
        const existingSession = await getPersistentQrisSession(identity.bookingCode);
        if (!existingSession || !isVerifiedQrisStatus(existingSession.status)) {
          await savePersistentQrisSession({
            orderId: identity.id,
            invoiceNumber: identity.bookingCode,
            expectedAmount: authoritativeTotal,
            status: "PENDING",
            updatedAt: new Date().toISOString(),
          });
        }
      }

      return NextResponse.json({ success: true, booking: customerBooking });
    }

    if (
      !matchedExisting &&
      booking.date &&
      booking.checkInStatus !== "CANCELLED" &&
      booking.checkInStatus !== "COMPLETED"
    ) {
      const scheduleError = validateBookingScheduleOrError(booking, platformSettings);
      if (scheduleError) return scheduleError;
    }

    if (!booking.userId) {
      booking.userId = auth.userId;
    }

    const staffIdentity = await resolveBookingIdentityDefaults({
      booking,
      existingBookings,
    });
    booking.id = staffIdentity.id;
    booking.bookingCode = staffIdentity.bookingCode;
    booking.createdAt = staffIdentity.createdAt;

    if (
      booking.paymentMethod === "QRIS" &&
      booking.paymentStatus === "PAID" &&
      (!matchedExisting || matchedExisting.paymentStatus !== "PAID")
    ) {
      const invoiceNumber = String(
        (booking.qrisVerification as Record<string, unknown> | undefined)?.invoiceNumber ||
          booking.bookingCode
      ).trim();
      const claim = invoiceNumber
        ? await claimQrisSessionForOrder({
            invoiceNumber,
            orderId: String(booking.id),
            amount: Math.round(Number(booking.totalAmount || 0)),
          })
        : ({ ok: false, reason: "NOT_FOUND" } as const);

      if (!claim.ok) {
        return NextResponse.json(
          {
            error: `QRIS_PAYMENT_UNVERIFIED [${claim.reason}]: ${QRIS_CLAIM_MESSAGES[claim.reason]}`,
            code: "QRIS_PAYMENT_UNVERIFIED",
          },
          { status: 409 }
        );
      }
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
