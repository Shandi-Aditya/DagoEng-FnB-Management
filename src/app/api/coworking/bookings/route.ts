import { NextRequest, NextResponse } from "next/server";
import {
  checkCoworkingBookingConflict,
  DEFAULT_COWORKING_HOLIDAY_CONFIG,
  normalizeDateToYMD,
  validateCoworkingBookingSchedule,
} from "@/lib/operating-hours";
import {
  calculateCoworkingPrice,
  resolveSpaceCapacity,
} from "@/features/coworking/coworking-domain";
import {
  claimQrisSessionForOrder,
  getCoworkingBookings,
  getPersistentOrders,
  getPersistentQrisSession,
  getPersistentQrisSessions,
  isVerifiedQrisStatus,
  readPersistentData,
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
import { INITIAL_SPACES, LEGACY_SPACES } from "@/lib/sync-domains/spaces-spec";
import type { CoworkingBooking, CoworkingSpaceItem } from "@/types/coworking";
import { calculateEndTime, isSlotPast } from "@/features/pos/pos-coworking";
import { getTodayWitaDateString } from "@/features/coworking/coworking-domain";
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
  booking: CoworkingBooking | Record<string, unknown>,
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
  platformSettings: PlatformSettings,
  isNewBooking: boolean = false
): NextResponse | null {
  const bookingType =
    typeof booking.bookingType === "string" ? booking.bookingType : "HOURLY";
  const bookingDate = String(booking.date);
  const startTime =
    typeof booking.startTime === "string" ? booking.startTime : undefined;

  const scheduleCheck = validateCoworkingBookingSchedule(
    {
      bookingType,
      date: bookingDate,
      endDate: typeof booking.endDate === "string" ? booking.endDate : undefined,
      startTime,
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

  // S-35: Tolak slot jam yang sudah lewat pada hari ini WITA untuk pemesanan baru
  if (isNewBooking && bookingType === "HOURLY" && startTime) {
    const todayWita = getTodayWitaDateString();
    const targetYmd = normalizeDateToYMD(bookingDate);
    if (targetYmd === todayWita && isSlotPast(bookingDate, startTime)) {
      return NextResponse.json(
        { error: "Slot jam yang dipilih sudah lewat." },
        { status: 400 }
      );
    }
  }

  return null;
}

async function generateUniqueBookingCode(
  existingBookings: (CoworkingBooking | Record<string, unknown>)[]
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
  existingBookings: (CoworkingBooking | Record<string, unknown>)[];
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

type AnonymizedBookingView = Pick<
  CoworkingBooking,
  | "id"
  | "spaceId"
  | "spaceName"
  | "spaceType"
  | "bookingType"
  | "date"
  | "endDate"
  | "startTime"
  | "endTime"
  | "duration"
  | "checkInStatus"
  | "paymentStatus"
  | "guestName"
  | "guestPhone"
  | "guestEmail"
>;

function isBookingActiveForSlotView(b: CoworkingBooking): boolean {
  const paymentStatus: string = b.paymentStatus;
  return (
    b.checkInStatus !== "CANCELLED" &&
    b.checkInStatus !== "COMPLETED" &&
    paymentStatus !== "CANCELLED"
  );
}

function toAnonymizedBookingView(b: CoworkingBooking): AnonymizedBookingView {
  return {
    id: b.id,
    spaceId: b.spaceId,
    spaceName: b.spaceName,
    spaceType: b.spaceType,
    bookingType: b.bookingType,
    date: b.date,
    endDate: b.endDate,
    startTime: b.startTime,
    endTime: b.endTime,
    duration: b.duration,
    checkInStatus: b.checkInStatus,
    paymentStatus: b.paymentStatus,
    guestName: "Terisi",
    guestPhone: "",
    guestEmail: "",
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    const isAnonymous = !auth.isAuthenticated || !auth.role;

    if (!isAnonymous && auth.role && !COWORKING_READ_ROLES.includes(auth.role)) {
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

    let bookings: CoworkingBooking[] = await getCoworkingBookings();

    if (date) {
      const targetYmd = normalizeDateToYMD(date);
      bookings = bookings.filter((b: CoworkingBooking) => {
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
        (b: CoworkingBooking) =>
          b.checkInStatus === status ||
          b.paymentStatus === status
      );
    }

    if (isAnonymous) {
      const sanitized = bookings
        .filter(isBookingActiveForSlotView)
        .map(toAnonymizedBookingView);
      return NextResponse.json({ bookings: sanitized });
    }

    if (auth.role === "CUSTOMER") {
      const customerVisible = bookings.flatMap(
        (b: CoworkingBooking): Array<CoworkingBooking | AnonymizedBookingView> => {
          if (isCallerOwnedBooking(b, auth)) {
            return [b];
          }
          if (!isBookingActiveForSlotView(b)) {
            return [];
          }
          return [toAnonymizedBookingView(b)];
        }
      );
      return NextResponse.json({ bookings: customerVisible });
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

    const masterData = await readPersistentData<{ spaces?: CoworkingSpaceItem[] }>(
      "coworking_master.json",
      { spaces: INITIAL_SPACES }
    );
    const spaces = masterData?.spaces || INITIAL_SPACES;
    let space = spaces.find((s) => s.id === booking.spaceId);
    if (!space) {
      space = LEGACY_SPACES.find((s) => s.id === booking.spaceId);
    }

    if (!space) {
      return NextResponse.json(
        { error: "Ruang kerja tidak ditemukan." },
        { status: 400 }
      );
    }

    if (space.status === "MAINTENANCE") {
      return NextResponse.json(
        { error: "Ruang kerja sedang dalam pemeliharaan." },
        { status: 400 }
      );
    }

    const maxCapacity: number = resolveSpaceCapacity(space);
    booking.maxCapacity = maxCapacity;

    if (
      !booking.endTime &&
      typeof booking.startTime === "string" &&
      booking.startTime.trim()
    ) {
      booking.endTime = calculateEndTime(
        booking.startTime,
        typeof booking.duration === "number" ? booking.duration : 1
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
      (b: CoworkingBooking) =>
        (booking.id && b.id === booking.id) ||
        (booking.bookingCode && b.bookingCode === booking.bookingCode)
    );

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

      const scheduleError = validateBookingScheduleOrError(
        { ...booking, date: bookingDate },
        platformSettings,
        !matchedExisting
      );
      if (scheduleError) return scheduleError;

      const coworkingState = await readPersistentDomainState(coworkingMasterDomainSpec);
      const matchedSpace =
        coworkingState.spaces.find((s) => s.id === booking.spaceId) ||
        LEGACY_SPACES.find((s) => s.id === booking.spaceId);
      if (!matchedSpace) {
        return NextResponse.json(
          { error: "INVALID_SPACE: Ruang co-working tidak ditemukan di daftar resmi outlet." },
          { status: 400 }
        );
      }

      let duration = 1;
      if (booking.duration !== undefined && booking.duration !== null) {
        const parsedDuration = Number(booking.duration);
        if (!Number.isFinite(parsedDuration) || !Number.isInteger(parsedDuration) || parsedDuration < 1 || parsedDuration > 9) {
          return NextResponse.json(
            { error: "INVALID_DURATION: Durasi booking coworking wajib berupa bilangan bulat positif antara 1 hingga 9 jam." },
            { status: 400 }
          );
        }
        duration = parsedDuration;
      }

      const rawBookingType =
        typeof booking.bookingType === "string"
          ? booking.bookingType.trim().toUpperCase()
          : "HOURLY";
      const resolvedBookingType =
        rawBookingType === "DAILY" || rawBookingType === "MONTHLY" ? rawBookingType : "HOURLY";

      const quote = calculateCoworkingPrice(matchedSpace, {
        bookingType: resolvedBookingType,
        duration,
      });
      const authoritativePrice = Math.max(0, quote.basePrice);

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
        bookingType: resolvedBookingType,
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

      try {
        await saveCoworkingBooking(customerBooking as unknown as CoworkingBooking, {
          maxCapacity,
          spaceName: matchedSpace.name,
        });
      } catch (saveErr: unknown) {
        const isConflict =
          (saveErr as { code?: string })?.code === "OVERBOOKING_CONFLICT" ||
          (saveErr as { status?: number })?.status === 409;
        if (isConflict) {
          const message =
            saveErr instanceof Error
              ? saveErr.message
              : "Kapasitas slot tidak mencukupi atau sudah penuh. Pemesanan ditolak untuk mencegah overbooking.";
          return NextResponse.json(
            { error: message, code: "OVERBOOKING_CONFLICT" },
            { status: 409 }
          );
        }
        throw saveErr;
      }

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

    const staffBookingType =
      typeof booking.bookingType === "string" && booking.bookingType.trim()
        ? booking.bookingType.trim().toUpperCase()
        : "HOURLY";

    if (!matchedExisting) {
      const staffDate = typeof booking.date === "string" ? booking.date.trim() : "";
      if (!staffDate) {
        return NextResponse.json(
          { error: "INVALID_DATE: Tanggal booking coworking wajib diisi." },
          { status: 400 }
        );
      }
      const staffStartTime =
        typeof booking.startTime === "string" ? booking.startTime.trim() : "";
      if (staffBookingType === "HOURLY" && !staffStartTime) {
        return NextResponse.json(
          { error: "INVALID_TIME: Jam mulai booking coworking per jam wajib diisi." },
          { status: 400 }
        );
      }
    }

    if (
      booking.date &&
      booking.checkInStatus !== "CANCELLED" &&
      booking.checkInStatus !== "COMPLETED"
    ) {
      const scheduleError = validateBookingScheduleOrError(booking, platformSettings, !matchedExisting);
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

    const isNonActiveStatus =
      booking.checkInStatus === "CANCELLED" ||
      booking.checkInStatus === "COMPLETED" ||
      booking.paymentStatus === "CANCELLED";
    if (!isNonActiveStatus && booking.date && booking.spaceId) {
      const preConflict = checkCoworkingBookingConflict(existingBookings, {
        id: typeof booking.id === "string" ? booking.id : undefined,
        spaceId: String(booking.spaceId),
        spaceName: space.name,
        bookingType:
          staffBookingType === "DAILY" || staffBookingType === "MONTHLY"
            ? staffBookingType
            : "HOURLY",
        date: String(booking.date),
        endDate: typeof booking.endDate === "string" ? booking.endDate : undefined,
        startTime: String(booking.startTime || "09:00"),
        endTime: typeof booking.endTime === "string" ? booking.endTime : undefined,
        maxCapacity,
      });
      if (preConflict.hasConflict) {
        return NextResponse.json(
          {
            error:
              preConflict.message ||
              "Kapasitas slot tidak mencukupi atau sudah penuh. Pemesanan ditolak untuk mencegah overbooking.",
            code: "OVERBOOKING_CONFLICT",
          },
          { status: 409 }
        );
      }
    }

    if (
      booking.paymentMethod === "QRIS" &&
      booking.paymentStatus === "PAID" &&
      (!matchedExisting || matchedExisting.paymentStatus !== "PAID")
    ) {
      const isBundledPosPaidBooking =
        booking.billedViaPosOrder === true &&
        typeof booking.linkedOrderId === "string" &&
        booking.linkedOrderId.trim().length > 0;

      if (isBundledPosPaidBooking) {
        const linkedOrderId = String(booking.linkedOrderId).trim();
        const persistentOrders = await getPersistentOrders();
        const linkedOrder = persistentOrders.find(
          (o) =>
            (o.id === linkedOrderId || o.orderNumber === linkedOrderId) &&
            o.paymentStatus === "PAID" &&
            o.status !== "CANCELLED"
        );
        if (!linkedOrder) {
          return NextResponse.json(
            {
              error:
                "QRIS_PAYMENT_UNVERIFIED [NOT_FOUND]: Order POS tertaut tidak ditemukan atau belum berstatus lunas.",
              code: "QRIS_PAYMENT_UNVERIFIED",
            },
            { status: 409 }
          );
        }
      } else {
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
    }

    try {
      await saveCoworkingBooking(booking, {
        maxCapacity,
        spaceName: space.name,
      });
    } catch (saveErr: unknown) {
      const isConflict =
        (saveErr as { code?: string })?.code === "OVERBOOKING_CONFLICT" ||
        (saveErr as { status?: number })?.status === 409;
      if (isConflict) {
        const message =
          saveErr instanceof Error
            ? saveErr.message
            : "Kapasitas slot tidak mencukupi atau sudah penuh. Pemesanan ditolak untuk mencegah overbooking.";
        return NextResponse.json(
          { error: message, code: "OVERBOOKING_CONFLICT" },
          { status: 409 }
        );
      }
      throw saveErr;
    }

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
