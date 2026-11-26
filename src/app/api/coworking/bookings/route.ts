import { NextRequest, NextResponse } from "next/server";
import {
  checkCoworkingBookingConflict,
  DEFAULT_COWORKING_HOLIDAY_CONFIG,
  normalizeDateToYMD,
  validateCoworkingBookingSchedule,
} from "@/lib/operating-hours";
import {
  addDaysToYmd,
  calculateCoworkingPrice,
  getTodayWitaDateString,
  resolveSpaceCapacity,
} from "@/features/coworking/coworking-domain";
import {
  applyPersistentDomainCommand,
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
import { platformSettingsDomainSpec } from "@/lib/sync-domains/config-spec";
import {
  coworkingMasterDomainSpec,
  INITIAL_SPACES,
  reconcileCoworkingMasterDefaults,
} from "@/lib/sync-domains/spaces-spec";
import type { CoworkingMasterState } from "@/lib/domain-sync-types";
import { isCoworkingOrderItem } from "@/lib/tax-breakdown";
import type { RoleSlug } from "@/types/auth";
import type { CoworkingBooking, CoworkingSpaceItem } from "@/types/coworking";
import { calculateEndTime, isSlotPast } from "@/features/pos/pos-coworking";
import {
  calculateCoworkingPricing,
  checkPromoValidity,
  validateVoucherCode,
  type CoworkingTaxType,
  type PromoConfig,
} from "@/lib/promo";
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

type ResolvedBookingType = "HOURLY" | "DAILY" | "MONTHLY";

function resolveBookingTypeOrError(
  raw: unknown
): { ok: true; bookingType: ResolvedBookingType } | { ok: false; response: NextResponse } {
  if (raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "")) {
    return { ok: true, bookingType: "HOURLY" };
  }
  if (typeof raw === "string") {
    const normalized = raw.trim().toUpperCase();
    if (normalized === "HOURLY" || normalized === "DAILY" || normalized === "MONTHLY") {
      return { ok: true, bookingType: normalized };
    }
  }
  return {
    ok: false,
    response: NextResponse.json(
      { error: "INVALID_BOOKING_TYPE: Tipe booking coworking harus HOURLY, DAILY, atau MONTHLY." },
      { status: 400 }
    ),
  };
}

function resolveDurationOrError(
  raw: unknown,
  bookingType: ResolvedBookingType
): { ok: true; duration: number } | { ok: false; response: NextResponse } {
  const defaultDuration = bookingType === "MONTHLY" ? 30 : 1;
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, duration: defaultDuration };
  }
  const parsed = Number(raw);
  if (bookingType === "MONTHLY") {
    if (
      !Number.isFinite(parsed) ||
      !Number.isInteger(parsed) ||
      parsed < 30 ||
      parsed > 360 ||
      parsed % 30 !== 0
    ) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error:
              "INVALID_DURATION: Durasi booking MONTHLY wajib berupa kelipatan 30 hari (30 hingga 360 hari).",
          },
          { status: 400 }
        ),
      };
    }
    return { ok: true, duration: parsed };
  }

  const maxDuration = bookingType === "HOURLY" ? 9 : 365;
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1 || parsed > maxDuration) {
    const unitLabel = bookingType === "HOURLY" ? "jam" : "hari";
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: `INVALID_DURATION: Durasi booking ${bookingType} wajib berupa bilangan bulat antara 1 hingga ${maxDuration} ${unitLabel}.`,
        },
        { status: 400 }
      ),
    };
  }
  return { ok: true, duration: parsed };
}

function resolveAuthoritativeEndDate(
  bookingDate: string,
  bookingType: ResolvedBookingType,
  duration: number
): string {
  const startYmd = normalizeDateToYMD(bookingDate) || bookingDate;
  if (bookingType === "HOURLY") {
    return startYmd;
  }
  return addDaysToYmd(startYmd, Math.max(1, duration) - 1);
}

function resolveBookingCustomerId(
  booking: Record<string, unknown>,
  fallbackUserId?: string
): string | undefined {
  const phone = typeof booking.guestPhone === "string" ? booking.guestPhone.trim() : "";
  if (phone && phone !== "-") {
    return phone;
  }
  const email =
    typeof booking.guestEmail === "string" ? booking.guestEmail.trim().toLowerCase() : "";
  if (email && email !== "-") {
    return email;
  }
  return fallbackUserId;
}

async function redeemCoworkingPromoIfApplied(params: {
  promoId?: string;
  bookingId: string;
  customerId?: string;
  auth: ServerAuthResult;
}): Promise<void> {
  if (!params.promoId) return;
  try {
    await applyPersistentDomainCommand(
      platformSettingsDomainSpec,
      {
        op: "REDEEM_PROMO",
        opId: `cwk-booking-${params.bookingId}`,
        promoIdOrCode: params.promoId,
        customerId: params.customerId,
      },
      params.auth
    );
  } catch (err) {
    console.error("[coworking/bookings] Non-fatal promo redemption failure:", err);
  }
}

function resolveAuthoritativeBookingPricing(params: {
  space: CoworkingSpaceItem;
  bookingType: ResolvedBookingType;
  duration: number;
  booking: Record<string, unknown>;
  platformSettings: PlatformSettings;
  customerId?: string;
  allowBundledPosDiscount?: boolean;
  maxBundledPosDiscount?: number;
}):
  | {
      ok: true;
      price: number;
      discount: number;
      promoId?: string;
      promoTitle?: string;
      tax: number;
      taxRatePercent: number;
      taxType: CoworkingTaxType;
      totalAmount: number;
    }
  | { ok: false; response: NextResponse } {
  const {
    space,
    bookingType,
    duration,
    booking,
    platformSettings,
    customerId,
    allowBundledPosDiscount = false,
    maxBundledPosDiscount,
  } = params;

  const quote = calculateCoworkingPrice(space, { bookingType, duration });
  const authoritativePrice = Math.max(0, Math.round(quote.basePrice));
  const promos = (platformSettings.promos || []) as PromoConfig[];

  const rawPromoId = typeof booking.promoId === "string" ? booking.promoId.trim() : "";
  const rawPromoCode = typeof booking.promoCode === "string" ? booking.promoCode.trim() : "";
  const rawPromoTitle = typeof booking.promoTitle === "string" ? booking.promoTitle.trim() : "";
  const promoQuery = rawPromoCode || rawPromoId || rawPromoTitle;

  let matchedPromo: PromoConfig | undefined;
  if (promoQuery) {
    const byId = rawPromoId ? promos.find((p) => p.id === rawPromoId) : undefined;
    if (byId) {
      const validity = checkPromoValidity(byId, authoritativePrice, {
        scope: "COWORKING",
        customerId,
      });
      if (!validity.isValid) {
        return {
          ok: false,
          response: NextResponse.json(
            { error: validity.reason || "Kode promo tidak valid.", code: "INVALID_PROMO" },
            { status: 400 }
          ),
        };
      }
      matchedPromo = byId;
    } else {
      const validation = validateVoucherCode(promoQuery, promos, authoritativePrice, {
        scope: "COWORKING",
        customerId,
      });
      if (!validation.isValid || !validation.promo) {
        if (!allowBundledPosDiscount || rawPromoCode || rawPromoId) {
          return {
            ok: false,
            response: NextResponse.json(
              { error: validation.reason || "Kode promo tidak valid.", code: "INVALID_PROMO" },
              { status: 400 }
            ),
          };
        }
      } else {
        matchedPromo = validation.promo;
      }
    }
  }

  const cwTax = platformSettings.categoryTax?.coworking;
  const taxEnabled = Boolean(cwTax?.isEnabled && Number(cwTax.taxRatePercent) > 0);
  const taxRatePercent = taxEnabled ? Number(cwTax!.taxRatePercent) : 0;
  const taxRate = taxRatePercent / 100;
  const taxType: CoworkingTaxType = taxEnabled ? cwTax!.taxType : "NON_TAX";

  if (matchedPromo) {
    const pricing = calculateCoworkingPricing(authoritativePrice, matchedPromo, taxRate, taxType);
    return {
      ok: true,
      price: pricing.originalSubtotal,
      discount: pricing.discountAmount,
      promoId: matchedPromo.id,
      promoTitle: matchedPromo.code || matchedPromo.name,
      tax: pricing.tax,
      taxRatePercent: pricing.taxRatePercent,
      taxType: pricing.taxType,
      totalAmount: pricing.total,
    };
  }

  if (
    allowBundledPosDiscount &&
    typeof booking.discount === "number" &&
    Number.isFinite(booking.discount) &&
    booking.discount > 0
  ) {
    const maxAllowedDiscount =
      maxBundledPosDiscount !== undefined
        ? Math.min(authoritativePrice, Math.max(0, Math.round(maxBundledPosDiscount)))
        : authoritativePrice;
    const clampedDiscount = Math.min(maxAllowedDiscount, Math.round(booking.discount));
    const subtotalAfterDiscount = Math.max(0, authoritativePrice - clampedDiscount);
    const taxAmount = taxEnabled ? Math.round(subtotalAfterDiscount * taxRate) : 0;
    return {
      ok: true,
      price: authoritativePrice,
      discount: clampedDiscount,
      ...(rawPromoTitle && clampedDiscount > 0 ? { promoTitle: rawPromoTitle } : {}),
      tax: taxAmount,
      taxRatePercent,
      taxType,
      totalAmount: subtotalAfterDiscount + taxAmount,
    };
  }

  const pricing = calculateCoworkingPricing(authoritativePrice, undefined, taxRate, taxType);
  return {
    ok: true,
    price: pricing.originalSubtotal,
    discount: pricing.discountAmount,
    tax: pricing.tax,
    taxRatePercent: pricing.taxRatePercent,
    taxType: pricing.taxType,
    totalAmount: pricing.total,
  };
}

async function syncSpaceAfterCancellation(params: {
  spaceId: string;
  cancelledBookingId: string;
  cancelledBookingCode?: string;
  allBookings: CoworkingBooking[];
  auth: ServerAuthResult;
}): Promise<void> {
  const { spaceId, cancelledBookingId, cancelledBookingCode, allBookings, auth } = params;
  const masterState = reconcileCoworkingMasterDefaults(
    await readPersistentDomainState(coworkingMasterDomainSpec)
  );
  const targetSpace = masterState.spaces.find((s) => s.id === spaceId);
  if (!targetSpace || targetSpace.status === "MAINTENANCE") return;

  const maxCap = resolveSpaceCapacity(targetSpace);
  const remainingCheckedIn = allBookings.filter(
    (b) =>
      b.spaceId === spaceId &&
      b.id !== cancelledBookingId &&
      b.bookingCode !== cancelledBookingCode &&
      b.checkInStatus === "CHECKED_IN" &&
      (b as { paymentStatus?: string }).paymentStatus !== "CANCELLED"
  );

  const shouldUpdate =
    targetSpace.currentSession?.bookingCode === cancelledBookingCode ||
    targetSpace.status === "RESERVED" ||
    (targetSpace.status === "OCCUPIED" && remainingCheckedIn.length < maxCap);
  if (!shouldUpdate) return;

  const nextStatus =
    remainingCheckedIn.length >= maxCap && remainingCheckedIn.length > 0
      ? "OCCUPIED"
      : "AVAILABLE";
  const nextSession =
    remainingCheckedIn.length > 0
      ? {
          guestName: remainingCheckedIn[0].guestName,
          company: remainingCheckedIn[0].company || "Personal",
          checkInTime: remainingCheckedIn[0].startTime || "Aktif",
          endTime: remainingCheckedIn[0].endTime || "Selesai",
          bookingCode: remainingCheckedIn[0].bookingCode,
        }
      : undefined;

  await applyPersistentDomainCommand(
    coworkingMasterDomainSpec,
    {
      op: "PATCH_SPACE_SESSION",
      spaceId,
      status: nextStatus,
      currentSession: nextSession,
      completedBookingCode: cancelledBookingCode,
    },
    auth
  );
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

    const rawMasterData = await readPersistentData<Partial<CoworkingMasterState>>(
      "coworking_master.json",
      { spaces: INITIAL_SPACES }
    );
    const reconciledMaster = reconcileCoworkingMasterDefaults({
      spaces: Array.isArray(rawMasterData?.spaces) ? rawMasterData.spaces : INITIAL_SPACES,
      members: Array.isArray(rawMasterData?.members) ? rawMasterData.members : [],
      checkLogs: Array.isArray(rawMasterData?.checkLogs) ? rawMasterData.checkLogs : [],
      plans: Array.isArray(rawMasterData?.plans) ? rawMasterData.plans : [],
    });
    const spaces = reconciledMaster.spaces;
    let space = spaces.find((s) => s.id === booking.spaceId);
    if (!space) {
      space = INITIAL_SPACES.find((s) => s.id === booking.spaceId);
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

    const [existingBookings, platformSettings] = await Promise.all([
      getCoworkingBookings(),
      readSeededPersistentData<PlatformSettings>(
        "platform_settings.json",
        () => DEFAULT_PLATFORM_SETTINGS
      ),
    ]);
    const normalizedBookingId =
      typeof booking.id === "string" ? booking.id.trim() : "";
    const matchedExisting = existingBookings.find((b: CoworkingBooking) =>
      normalizedBookingId
        ? b.id === normalizedBookingId
        : Boolean(booking.bookingCode && b.bookingCode === booking.bookingCode)
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
            checkInStatus: "CANCELLED" as const,
          };
          await saveCoworkingBooking(cancelledBooking);
          await syncSpaceAfterCancellation({
            spaceId: matchedExisting.spaceId,
            cancelledBookingId: matchedExisting.id,
            cancelledBookingCode: matchedExisting.bookingCode,
            allBookings: existingBookings,
            auth,
          });
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

      const bookingTypeRes = resolveBookingTypeOrError(booking.bookingType);
      if (!bookingTypeRes.ok) return bookingTypeRes.response;
      const resolvedBookingType = bookingTypeRes.bookingType;

      const durationRes = resolveDurationOrError(booking.duration, resolvedBookingType);
      if (!durationRes.ok) return durationRes.response;
      const duration = durationRes.duration;
      const authoritativeEndDate = resolveAuthoritativeEndDate(
        bookingDate,
        resolvedBookingType,
        duration
      );

      const resolvedEndTime =
        typeof booking.endTime === "string" && booking.endTime.trim()
          ? booking.endTime.trim()
          : resolvedBookingType === "HOURLY" &&
              typeof booking.startTime === "string" &&
              booking.startTime.trim()
            ? calculateEndTime(booking.startTime, duration)
            : undefined;

      const scheduleError = validateBookingScheduleOrError(
        {
          ...booking,
          bookingType: resolvedBookingType,
          date: bookingDate,
          endDate: authoritativeEndDate,
          duration,
          ...(resolvedEndTime ? { endTime: resolvedEndTime } : {}),
        },
        platformSettings,
        !matchedExisting
      );
      if (scheduleError) return scheduleError;

      const coworkingState = reconcileCoworkingMasterDefaults(
        await readPersistentDomainState(coworkingMasterDomainSpec)
      );
      const matchedSpace =
        coworkingState.spaces.find((s) => s.id === booking.spaceId) ||
        INITIAL_SPACES.find((s) => s.id === booking.spaceId);
      if (!matchedSpace) {
        return NextResponse.json(
          { error: "INVALID_SPACE: Ruang co-working tidak ditemukan di daftar resmi outlet." },
          { status: 400 }
        );
      }

      const customerId = resolveBookingCustomerId(booking, auth.userId);
      const pricingRes = resolveAuthoritativeBookingPricing({
        space: matchedSpace,
        bookingType: resolvedBookingType,
        duration,
        booking,
        platformSettings,
        customerId,
      });
      if (!pricingRes.ok) return pricingRes.response;

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
        endDate: authoritativeEndDate,
        startTime: typeof booking.startTime === "string" ? booking.startTime : "",
        ...(resolvedEndTime ? { endTime: resolvedEndTime } : {}),
        duration,
        price: pricingRes.price,
        discount: pricingRes.discount,
        ...(pricingRes.promoTitle ? { promoTitle: pricingRes.promoTitle } : {}),
        tax: pricingRes.tax,
        taxRatePercent: pricingRes.taxRatePercent,
        taxType: pricingRes.taxType,
        ...(typeof booking.outletId === "string" && booking.outletId.trim()
          ? { outletId: booking.outletId.trim() }
          : {}),
        totalAmount: pricingRes.totalAmount,
        paidAmount: 0,
        remainingAmount: pricingRes.totalAmount,
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

      if (pricingRes.promoId) {
        await redeemCoworkingPromoIfApplied({
          promoId: pricingRes.promoId,
          bookingId: identity.id,
          customerId,
          auth,
        });
      }

      if (customerBooking.paymentMethod === "QRIS" && pricingRes.totalAmount > 0) {
        const existingSession = await getPersistentQrisSession(identity.bookingCode);
        if (!existingSession || !isVerifiedQrisStatus(existingSession.status)) {
          await savePersistentQrisSession({
            orderId: identity.id,
            invoiceNumber: identity.bookingCode,
            expectedAmount: pricingRes.totalAmount,
            status: "PENDING",
            updatedAt: new Date().toISOString(),
          });
        }
      }

      return NextResponse.json({ success: true, booking: customerBooking });
    }

    if (auth.role === "OWNER" && !isNonTenantOwner(auth)) {
      return NextResponse.json(
        {
          error:
            "FORBIDDEN: Pemilik tenant F&B tidak memiliki izin membuat atau mengubah booking co-working hub.",
        },
        { status: 403 }
      );
    }

    if (matchedExisting) {
      if (
        matchedExisting.checkInStatus === "CANCELLED" ||
        matchedExisting.checkInStatus === "COMPLETED"
      ) {
        return NextResponse.json(
          {
            error:
              "FORBIDDEN: Booking yang sudah dibatalkan atau selesai tidak dapat diubah.",
          },
          { status: 403 }
        );
      }

      if (
        matchedExisting.paymentStatus === "PAID" &&
        booking.paymentStatus !== undefined &&
        booking.paymentStatus !== "PAID"
      ) {
        return NextResponse.json(
          {
            error:
              "FORBIDDEN: Status pembayaran booking yang sudah lunas tidak dapat diturunkan ke PENDING.",
          },
          { status: 403 }
        );
      }

      // Lock immutable fields on existing booking updates
      booking.id = matchedExisting.id;
      booking.bookingCode = matchedExisting.bookingCode;
      booking.spaceId = matchedExisting.spaceId;
      booking.spaceName = matchedExisting.spaceName;
      booking.spaceType = matchedExisting.spaceType;
      booking.date = matchedExisting.date;
      if (matchedExisting.endDate !== undefined) {
        booking.endDate = matchedExisting.endDate;
      } else {
        delete booking.endDate;
      }
      booking.bookingType = matchedExisting.bookingType;
      booking.duration = matchedExisting.duration;
      booking.price = matchedExisting.price;
      booking.discount = matchedExisting.discount;
      if (matchedExisting.promoTitle !== undefined) {
        booking.promoTitle = matchedExisting.promoTitle;
      } else {
        delete booking.promoTitle;
      }
      booking.tax = matchedExisting.tax;
      booking.taxRatePercent = matchedExisting.taxRatePercent;
      booking.taxType = matchedExisting.taxType;
      booking.totalAmount = matchedExisting.totalAmount;
      booking.userId = matchedExisting.userId ?? auth.userId;
      booking.createdAt = matchedExisting.createdAt;
      if (matchedExisting.paymentStatus === "PAID") {
        booking.paymentStatus = "PAID";
        booking.paidAmount = matchedExisting.paidAmount ?? matchedExisting.totalAmount;
        booking.remainingAmount = 0;
      } else if (booking.paymentStatus === "PAID") {
        booking.paidAmount = matchedExisting.totalAmount;
        booking.remainingAmount = 0;
      }
    }

    const staffTypeRes = resolveBookingTypeOrError(
      matchedExisting ? matchedExisting.bookingType : booking.bookingType
    );
    if (!staffTypeRes.ok) return staffTypeRes.response;
    const staffBookingType = staffTypeRes.bookingType;

    const staffDurationRes = resolveDurationOrError(
      matchedExisting ? matchedExisting.duration : booking.duration,
      staffBookingType
    );
    if (!staffDurationRes.ok) return staffDurationRes.response;
    const staffDuration = staffDurationRes.duration;

    if (
      (!booking.endTime || typeof booking.endTime !== "string" || !booking.endTime.trim()) &&
      staffBookingType === "HOURLY" &&
      typeof booking.startTime === "string" &&
      booking.startTime.trim()
    ) {
      booking.endTime = calculateEndTime(booking.startTime, staffDuration);
    }

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
      booking.endDate = resolveAuthoritativeEndDate(
        staffDate,
        staffBookingType,
        staffDuration
      );
    }

    if (
      booking.date &&
      booking.checkInStatus !== "CANCELLED" &&
      booking.checkInStatus !== "COMPLETED"
    ) {
      const scheduleError = validateBookingScheduleOrError(
        { ...booking, bookingType: staffBookingType, duration: staffDuration },
        platformSettings,
        !matchedExisting
      );
      if (scheduleError) return scheduleError;
    }

    const isBundledPosOrder = booking.billedViaPosOrder === true;
    let linkedPosOrderMaxDiscount: number | undefined;
    let linkedPosOrderRecord:
      | Awaited<ReturnType<typeof getPersistentOrders>>[number]
      | undefined;

    if (!matchedExisting && isBundledPosOrder) {
      const linkedOrderId =
        typeof booking.linkedOrderId === "string" ? booking.linkedOrderId.trim() : "";
      if (!linkedOrderId) {
        return NextResponse.json(
          {
            error:
              "INVALID_LINKED_ORDER: Booking POS tertaut wajib menyertakan linkedOrderId yang valid.",
            code: "INVALID_LINKED_ORDER",
          },
          { status: 400 }
        );
      }
      const persistentOrders = await getPersistentOrders();
      linkedPosOrderRecord = persistentOrders.find(
        (o) =>
          (o.id === linkedOrderId || o.orderNumber === linkedOrderId) &&
          o.status !== "CANCELLED"
      );
      if (!linkedPosOrderRecord) {
        return NextResponse.json(
          {
            error:
              "INVALID_LINKED_ORDER: Order POS tertaut tidak ditemukan atau sudah dibatalkan.",
            code: "INVALID_LINKED_ORDER",
          },
          { status: 409 }
        );
      }
      const hasCoworkingOrCorporate =
        Boolean(linkedPosOrderRecord.corporateInfo) ||
        linkedPosOrderRecord.items.length === 0 ||
        linkedPosOrderRecord.items.some((item) => isCoworkingOrderItem(item));
      if (!hasCoworkingOrCorporate) {
        return NextResponse.json(
          {
            error:
              "INVALID_LINKED_ORDER: Order POS tertaut tidak memiliki item co-working atau pesanan korporat.",
            code: "INVALID_LINKED_ORDER",
          },
          { status: 400 }
        );
      }
      linkedPosOrderMaxDiscount = Math.max(
        0,
        Math.round(
          Number(
            linkedPosOrderRecord.coworkingDiscount ??
              linkedPosOrderRecord.discount ??
              0
          ) || 0
        )
      );
    }

    let staffAppliedPromoId: string | undefined;
    const staffCustomerId = resolveBookingCustomerId(booking);

    if (!matchedExisting) {
      const staffPricingRes = resolveAuthoritativeBookingPricing({
        space,
        bookingType: staffBookingType,
        duration: staffDuration,
        booking,
        platformSettings,
        customerId: staffCustomerId,
        allowBundledPosDiscount: isBundledPosOrder,
        maxBundledPosDiscount: linkedPosOrderMaxDiscount,
      });
      if (!staffPricingRes.ok) return staffPricingRes.response;

      staffAppliedPromoId = staffPricingRes.promoId;
      booking.spaceName = space.name;
      booking.spaceType = space.type;
      booking.bookingType = staffBookingType;
      booking.duration = staffDuration;
      booking.price = staffPricingRes.price;
      booking.discount = staffPricingRes.discount;
      if (staffPricingRes.promoTitle) {
        booking.promoTitle = staffPricingRes.promoTitle;
      } else {
        delete booking.promoTitle;
      }
      booking.tax = staffPricingRes.tax;
      booking.taxRatePercent = staffPricingRes.taxRatePercent;
      booking.taxType = staffPricingRes.taxType;
      booking.totalAmount = staffPricingRes.totalAmount;

      const isPaid = booking.paymentStatus === "PAID";
      booking.paidAmount = isPaid ? staffPricingRes.totalAmount : 0;
      booking.remainingAmount = isPaid ? 0 : staffPricingRes.totalAmount;
    }

    if (!booking.userId) {
      booking.userId = auth.userId;
    }

    const staffIdentity = await resolveBookingIdentityDefaults({
      booking,
      existingBookings,
      enforceUniqueCode: !matchedExisting,
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
      if (isBundledPosOrder) {
        const linkedOrderId =
          typeof booking.linkedOrderId === "string" ? booking.linkedOrderId.trim() : "";
        const persistentOrders = linkedPosOrderRecord
          ? [linkedPosOrderRecord]
          : await getPersistentOrders();
        const linkedPaidOrder = persistentOrders.find(
          (o) =>
            (o.id === linkedOrderId || o.orderNumber === linkedOrderId) &&
            o.paymentStatus === "PAID" &&
            o.status !== "CANCELLED"
        );
        if (!linkedPaidOrder) {
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

    if (!matchedExisting && staffAppliedPromoId && !isNonActiveStatus) {
      await redeemCoworkingPromoIfApplied({
        promoId: staffAppliedPromoId,
        bookingId: staffIdentity.id,
        customerId: staffCustomerId,
        auth,
      });
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
