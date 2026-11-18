"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  CoworkingBooking,
  CoworkingMembershipPlan,
  CoworkingSpaceItem,
} from "@/types/coworking";
import type { CoworkingMasterCommand } from "@/lib/domain-sync-types";
import type { QRISVerificationDetail } from "@/lib/qris-verification";
import {
  applyCoworkingMasterCommand,
  coworkingMasterSyncClient,
  INITIAL_CHECK_LOGS,
  INITIAL_MEMBERSHIPS,
  INITIAL_SPACES,
} from "@/lib/sync-domains/spaces-spec";
import { useSyncedDomain } from "@/lib/use-synced-domain";
import {
  flushOutbox,
  getOutboxItems,
  reconcileCollectionWithOutbox,
  removeOutboxItem,
  syncWithOutbox,
} from "@/lib/sync-outbox";
import { generateSequentialReceiptNumber } from "@/lib/receipt-publisher";
import {
  checkCoworkingBookingConflict,
  validateCoworkingDateRange,
} from "@/lib/operating-hours";
import { useAuth } from "./AuthContext";
import { useOutlet } from "./OutletContext";
import { useSettings } from "./SettingsContext";
import { useActivityLog } from "./ActivityLogContext";
import { useNotifications } from "./NotificationContext";

export { INITIAL_SPACES, INITIAL_MEMBERSHIPS, INITIAL_CHECK_LOGS };

export interface CoworkingMemberProfile {
  id: string;
  memberId: string;
  name: string;
  contact: string;
  email: string;
  packageName: string;
  startDate: string;
  expiryDate: string;
  status: "ACTIVE" | "EXPIRED";
  totalSpent: number;
  paymentHistory: {
    id: string;
    date: string;
    amount: number;
    plan: string;
    paymentMethod: string;
    status: "PAID";
  }[];
}

export interface CheckInOutLog {
  id: string;
  bookingCode: string;
  guestName: string;
  spaceName: string;
  checkInDate: string;
  checkInTime: string;
  checkInBy: string;
  checkoutDate?: string;
  checkoutTime?: string;
  checkoutBy?: string;
  durationFormatted: string;
  status: "ACTIVE_IN" | "COMPLETED";
}

export type CoworkingBookingRecord = CoworkingBooking & {
  price: number;
  discount: number;
  paymentMethod: string;
  paidAmount: number;
  remainingAmount: number;
  paymentRef?: string;
  paymentTimestamp?: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  checkedInBy?: string;
  checkedOutBy?: string;
};

export const INITIAL_BOOKINGS: CoworkingBookingRecord[] = [];

export type NewBookingInput = Omit<
  CoworkingBookingRecord,
  "id" | "bookingCode" | "checkInStatus" | "checkedInAt" | "checkedInBy"
> & {
  checkInStatus?: "RESERVED" | "CHECKED_IN" | "COMPLETED" | "CANCELLED";
};

interface CoworkingContextType {
  spaces: CoworkingSpaceItem[];
  bookings: typeof INITIAL_BOOKINGS;
  members: CoworkingMemberProfile[];
  checkLogs: CheckInOutLog[];
  plans: CoworkingMembershipPlan[];
  addSpace: (space: Omit<CoworkingSpaceItem, "id">) => CoworkingSpaceItem;
  updateSpace: (id: string, updates: Partial<CoworkingSpaceItem>) => void;
  deleteSpace: (id: string) => void;
  addPlan: (plan: CoworkingMembershipPlan) => void;
  updatePlan: (id: string, updates: Partial<CoworkingMembershipPlan>) => void;
  deletePlan: (id: string) => void;
  bookSpace: (booking: NewBookingInput) => (typeof INITIAL_BOOKINGS)[0];
  confirmBookingPayment: (
    bookingId: string,
    paymentMethod?: string,
    qrisVerification?: QRISVerificationDetail
  ) => void;
  cancelBooking: (bookingId: string) => void;
  checkInBooking: (bookingId: string) => void;
  checkoutSpace: (spaceIdOrBookingId: string) => void;
  addMember: (
    member: Omit<CoworkingMemberProfile, "id" | "memberId" | "paymentHistory">,
    payment: { amount: number; paymentMethod: string }
  ) => void;
  resetCoworkingData: () => void;
}

const CoworkingContext = createContext<CoworkingContextType | undefined>(
  undefined
);

const STORAGE_KEY_BOOKINGS = "dagoeng_cwk_bookings_v3";
const BOOKINGS_ENDPOINT = "/api/coworking/bookings";

function syncBookingToServer(
  booking: CoworkingBookingRecord,
  isCreate: boolean
): void {
  if (typeof window === "undefined") return;
  void syncWithOutbox({
    id: booking.id,
    endpoint: BOOKINGS_ENDPOINT,
    method: "POST",
    isCreate,
    payload: { booking },
  }).catch(() => {});
}

function formatWitaPartsNow() {
  const now = new Date();
  const time =
    now.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Makassar",
    }) + " WITA";
  const date = now.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Makassar",
  });
  return { now, time, date };
}

function deriveEffectiveSpaces(
  rawSpaces: readonly CoworkingSpaceItem[],
  bookings: readonly CoworkingBookingRecord[]
): CoworkingSpaceItem[] {
  return rawSpaces.map((space) => {
    if (space.status === "MAINTENANCE") {
      return space;
    }

    const activeCheckedIn = bookings.find(
      (b) => b.spaceId === space.id && b.checkInStatus === "CHECKED_IN"
    );
    if (activeCheckedIn) {
      const sessionMatches =
        space.currentSession?.bookingCode === activeCheckedIn.bookingCode;
      return {
        ...space,
        status: "OCCUPIED",
        currentSession: sessionMatches
          ? space.currentSession
          : {
              guestName: activeCheckedIn.guestName,
              company: activeCheckedIn.company || "Personal",
              checkInTime: activeCheckedIn.startTime || "Aktif",
              endTime: activeCheckedIn.endTime || "Selesai",
              bookingCode: activeCheckedIn.bookingCode,
            },
      };
    }

    if (space.currentSession?.bookingCode) {
      const matchedSessionBooking = bookings.find(
        (b) => b.bookingCode === space.currentSession?.bookingCode
      );
      if (
        matchedSessionBooking &&
        (matchedSessionBooking.checkInStatus === "COMPLETED" ||
          matchedSessionBooking.checkInStatus === "CANCELLED")
      ) {
        return {
          ...space,
          status: "AVAILABLE",
          currentSession: undefined,
        };
      }
    }

    return space;
  });
}

export function CoworkingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeOutletId, activeOutlet } = useOutlet();
  const { settings } = useSettings();
  const { logActivity } = useActivityLog();
  const { addNotification } = useNotifications();

  const rehydrateKey = `${user?.id ?? "anon"}:${user?.role?.slug ?? "anon"}`;
  const [masterState, mutateCoworkingMaster] = useSyncedDomain(
    coworkingMasterSyncClient,
    { pollMs: 5000, rehydrateKey }
  );
  const { spaces: rawSpaces, members, checkLogs, plans } = masterState;

  const [bookings, setBookings] = useState<CoworkingBookingRecord[]>(
    INITIAL_BOOKINGS
  );
  const bookingsRef = useRef<CoworkingBookingRecord[]>(INITIAL_BOOKINGS);
  const [isBookingsInitialized, setIsBookingsInitialized] = useState(false);

  const commitBookings = useCallback(
    (
      updater: (prev: CoworkingBookingRecord[]) => CoworkingBookingRecord[]
    ): CoworkingBookingRecord[] => {
      const next = updater(bookingsRef.current);
      bookingsRef.current = next;
      setBookings(next);
      return next;
    },
    []
  );

  const hydrateFromServer = useCallback(async () => {
    if (typeof window === "undefined" || typeof fetch === "undefined") return;

    await flushOutbox().catch(() => {});
    try {
      const res = await fetch(BOOKINGS_ENDPOINT, {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (!data || !Array.isArray(data.bookings)) return;

      commitBookings((prev) => {
        const reconciled = reconcileCollectionWithOutbox({
          serverItems: data.bookings as CoworkingBookingRecord[],
          localItems: prev,
          endpoint: BOOKINGS_ENDPOINT,
          getId: (item) => item.id,
        });
        const pendingPostUpdates = getOutboxItems().filter(
          (entry) =>
            entry.endpoint === BOOKINGS_ENDPOINT &&
            entry.method === "POST" &&
            entry.isCreate === false
        );
        if (pendingPostUpdates.length === 0) {
          return reconciled;
        }
        const patchById = new Map<string, CoworkingBookingRecord>();
        for (const entry of pendingPostUpdates) {
          const queued = entry.payload.booking as
            | CoworkingBookingRecord
            | undefined;
          if (queued?.id) {
            patchById.set(queued.id, queued);
          }
        }
        return reconciled.map((item) => patchById.get(item.id) ?? item);
      });
    } catch {}
  }, [commitBookings]);

  useEffect(() => {
    try {
      const sBookings = localStorage.getItem(STORAGE_KEY_BOOKINGS);
      if (sBookings !== null) {
        const parsed: unknown = JSON.parse(sBookings);
        if (Array.isArray(parsed)) {
          bookingsRef.current = parsed as CoworkingBookingRecord[];
          setBookings(parsed as CoworkingBookingRecord[]);
        }
      }
    } catch {}
    setIsBookingsInitialized(true);

    if (typeof window !== "undefined") {
      const handleStorage = (event: StorageEvent) => {
        if (event.key !== STORAGE_KEY_BOOKINGS) return;
        if (event.newValue === null) {
          bookingsRef.current = INITIAL_BOOKINGS;
          setBookings(INITIAL_BOOKINGS);
          return;
        }
        try {
          const parsed: unknown = JSON.parse(event.newValue);
          if (Array.isArray(parsed)) {
            bookingsRef.current = parsed as CoworkingBookingRecord[];
            setBookings(parsed as CoworkingBookingRecord[]);
          }
        } catch {}
      };

      window.addEventListener("storage", handleStorage);
      return () => {
        window.removeEventListener("storage", handleStorage);
      };
    }
  }, []);

  useEffect(() => {
    void hydrateFromServer();
  }, [hydrateFromServer, rehydrateKey]);

  useEffect(() => {
    if (typeof window === "undefined" || process.env.NODE_ENV === "test") {
      return;
    }
    const pollInterval = window.setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      void hydrateFromServer();
    }, 5000);
    return () => window.clearInterval(pollInterval);
  }, [hydrateFromServer]);

  useEffect(() => {
    if (!isBookingsInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEY_BOOKINGS, JSON.stringify(bookings));
    } catch {}
  }, [bookings, isBookingsInitialized]);

  const spaces = useMemo(
    () => deriveEffectiveSpaces(rawSpaces, bookings),
    [rawSpaces, bookings]
  );

  const addSpace = (
    spaceData: Omit<CoworkingSpaceItem, "id">
  ): CoworkingSpaceItem => {
    const newSpace: CoworkingSpaceItem = {
      ...spaceData,
      id: `sp-custom-${Date.now()}`,
      status: spaceData.status || "AVAILABLE",
    };

    const cmd: CoworkingMasterCommand = {
      op: "UPSERT_SPACE",
      space: newSpace,
    };

    mutateCoworkingMaster(
      (prev) => applyCoworkingMasterCommand(prev, cmd),
      { id: `cwk-space-${newSpace.id}`, isCreate: true, command: cmd }
    );

    logActivity({
      module: "COWORKING",
      action: "CREATE_SPACE",
      recordId: newSpace.id,
      newValue: `${newSpace.name} (${newSpace.type} - Kapasitas: ${newSpace.capacity} orang)`,
      description: `Penambahan master workspace baru: "${newSpace.name}"`,
      reason: "Master workspace baru siap digunakan",
      status: "SUCCESS",
    });

    return newSpace;
  };

  const updateSpace = (id: string, updates: Partial<CoworkingSpaceItem>) => {
    const existing = coworkingMasterSyncClient
      .getSnapshot()
      .spaces.find((s) => s.id === id);
    if (!existing) return;

    const updatedSpace: CoworkingSpaceItem = {
      ...existing,
      ...updates,
      id,
    };

    const cmd: CoworkingMasterCommand = {
      op: "UPSERT_SPACE",
      space: updatedSpace,
    };

    mutateCoworkingMaster(
      (prev) => applyCoworkingMasterCommand(prev, cmd),
      { id: `cwk-space-${id}`, isCreate: false, command: cmd }
    );

    logActivity({
      module: "COWORKING",
      action: "UPDATE_SPACE",
      recordId: id,
      previousValue: `Nama: ${existing.name}, Rate: Rp ${existing.hourlyRate.toLocaleString()}`,
      newValue: `Nama: ${updatedSpace.name}, Rate: Rp ${updatedSpace.hourlyRate.toLocaleString()}`,
      description: `Perubahan master workspace: "${updatedSpace.name}"`,
      reason: "Update data workspace oleh Owner/Admin",
      status: "SUCCESS",
    });
  };

  const deleteSpace = (id: string) => {
    const existing = coworkingMasterSyncClient
      .getSnapshot()
      .spaces.find((s) => s.id === id);
    if (!existing) return;

    const cmd: CoworkingMasterCommand = {
      op: "DELETE_SPACE",
      spaceId: id,
    };

    mutateCoworkingMaster(
      (prev) => applyCoworkingMasterCommand(prev, cmd),
      { id: `cwk-space-del-${id}`, isCreate: false, command: cmd }
    );

    logActivity({
      module: "COWORKING",
      action: "DELETE_SPACE",
      recordId: id,
      previousValue: existing.name,
      description: `Penghapusan master workspace: "${existing.name}"`,
      reason: "Workspace diarsipkan dari sistem",
      status: "SUCCESS",
    });
  };

  const addPlan = (plan: CoworkingMembershipPlan) => {
    const normalizedPlan: CoworkingMembershipPlan = {
      ...plan,
      id: plan.id || `plan-${Date.now()}`,
      color: plan.color || "border-primary/40 bg-primary/5",
      meetingCredits: plan.meetingCredits || "-",
      fnbPerk: plan.fnbPerk || "-",
      fnbVoucherCode: plan.fnbVoucherCode || "",
      amenities: Array.isArray(plan.amenities) ? plan.amenities : [],
      priceFormatted:
        plan.priceFormatted ||
        `Rp ${(Number(plan.priceNumber) || 0).toLocaleString("id-ID")}`,
    };

    const cmd: CoworkingMasterCommand = {
      op: "UPSERT_PLAN",
      plan: normalizedPlan,
    };

    mutateCoworkingMaster(
      (prev) => applyCoworkingMasterCommand(prev, cmd),
      { id: `cwk-plan-${normalizedPlan.id}`, isCreate: true, command: cmd }
    );

    logActivity({
      module: "COWORKING",
      action: "CREATE_PLAN",
      recordId: normalizedPlan.id,
      newValue: `${normalizedPlan.name} (${normalizedPlan.billingCycle} - ${normalizedPlan.priceFormatted})`,
      description: `Penambahan paket membership co-working: "${normalizedPlan.name}"`,
      reason: "Penambahan katalog paket membership",
      status: "SUCCESS",
    });
  };

  const updatePlan = (
    id: string,
    updates: Partial<CoworkingMembershipPlan>
  ) => {
    const existing = coworkingMasterSyncClient
      .getSnapshot()
      .plans.find((p) => p.id === id);
    if (!existing) return;

    const nextPriceNumber = updates.priceNumber ?? existing.priceNumber;
    const nextPriceFormatted =
      updates.priceFormatted !== undefined
        ? updates.priceFormatted
        : updates.priceNumber !== undefined
          ? `Rp ${nextPriceNumber.toLocaleString("id-ID")}`
          : existing.priceFormatted;

    const updatedPlan: CoworkingMembershipPlan = {
      ...existing,
      ...updates,
      id,
      priceNumber: nextPriceNumber,
      priceFormatted: nextPriceFormatted,
    };

    const cmd: CoworkingMasterCommand = {
      op: "UPSERT_PLAN",
      plan: updatedPlan,
    };

    mutateCoworkingMaster(
      (prev) => applyCoworkingMasterCommand(prev, cmd),
      { id: `cwk-plan-${id}`, isCreate: false, command: cmd }
    );

    logActivity({
      module: "COWORKING",
      action: "UPDATE_PLAN",
      recordId: id,
      previousValue: `${existing.name} (${existing.priceFormatted})`,
      newValue: `${updatedPlan.name} (${updatedPlan.priceFormatted})`,
      description: `Pembaruan paket membership co-working: "${updatedPlan.name}"`,
      reason: "Pembaruan harga atau benefit paket membership",
      status: "SUCCESS",
    });
  };

  const deletePlan = (id: string) => {
    const existing = coworkingMasterSyncClient
      .getSnapshot()
      .plans.find((p) => p.id === id);
    if (!existing) return;

    const cmd: CoworkingMasterCommand = {
      op: "DELETE_PLAN",
      planId: id,
    };

    mutateCoworkingMaster(
      (prev) => applyCoworkingMasterCommand(prev, cmd),
      { id: `cwk-plan-del-${id}`, isCreate: false, command: cmd }
    );

    logActivity({
      module: "COWORKING",
      action: "DELETE_PLAN",
      recordId: id,
      previousValue: existing.name,
      description: `Penghapusan paket membership co-working: "${existing.name}"`,
      reason: "Penghapusan paket membership dari katalog",
      status: "SUCCESS",
    });
  };

  const bookSpace = (
    bookingData: NewBookingInput
  ): (typeof INITIAL_BOOKINGS)[0] => {
    const holidayCheck = validateCoworkingDateRange(
      bookingData.date,
      bookingData.endDate,
      settings?.coworkingHolidays
    );
    if (!holidayCheck.isValid) {
      const firstClosed = holidayCheck.closedDates[0];
      throw new Error(
        `COWORKING_DATE_CLOSED: Tanggal ${firstClosed.date} tidak dapat dibooking (${firstClosed.reason}).`
      );
    }

    const latestBookings = bookingsRef.current;
    const conflict = checkCoworkingBookingConflict(latestBookings, bookingData);
    if (conflict.hasConflict) {
      throw new Error(`DOUBLE_BOOKING_CONFLICT: ${conflict.message}`);
    }

    const bookingCode = generateSequentialReceiptNumber({
      prefix: "CWK",
      publisherCode: "DAGO",
      existingNumbers: latestBookings.map((b) => b.bookingCode),
    });
    const { now, time: nowFormatted, date: dateFormatted } = formatWitaPartsNow();
    const actorName = user?.name || "Rian Hidayat (Manager Coworking)";

    const isQris = bookingData.paymentMethod === "QRIS";
    const effectivePaymentStatus: "PAID" | "PENDING" = isQris ? "PENDING" : (bookingData.paymentStatus ?? "PAID");
    const isPaid = effectivePaymentStatus === "PAID";
    const paidAmount = isPaid
      ? (bookingData.paidAmount ?? bookingData.totalAmount)
      : 0;
    const remainingAmount = isPaid ? 0 : bookingData.totalAmount;
    const initialCheckInStatus =
      bookingData.checkInStatus ?? (isPaid ? "CHECKED_IN" : "RESERVED");
    const isCheckedInNow = initialCheckInStatus === "CHECKED_IN";

    const newBooking: CoworkingBookingRecord = {
      ...bookingData,
      id: `bk-${now.getTime()}`,
      bookingCode,
      outletId:
        bookingData.outletId ||
        (activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr"),
      createdAt: bookingData.createdAt || now.toISOString(),
      paymentStatus: effectivePaymentStatus,
      paidAmount,
      remainingAmount,
      checkInStatus: initialCheckInStatus,
      checkedInAt: isCheckedInNow ? `${dateFormatted} ${nowFormatted}` : undefined,
      checkedInBy: isCheckedInNow ? actorName : undefined,
    };

    const newLog: CheckInOutLog | undefined = isCheckedInNow
      ? {
          id: `chk-${now.getTime()}`,
          bookingCode,
          guestName: bookingData.guestName,
          spaceName: bookingData.spaceName,
          checkInDate: dateFormatted,
          checkInTime: nowFormatted,
          checkInBy: actorName,
          durationFormatted: "Sedang Aktif",
          status: "ACTIVE_IN",
        }
      : undefined;

    const sessionCmd: CoworkingMasterCommand = {
      op: "PATCH_SPACE_SESSION",
      spaceId: bookingData.spaceId,
      status: isCheckedInNow ? "OCCUPIED" : "RESERVED",
      currentSession: isCheckedInNow
        ? {
            guestName: bookingData.guestName,
            company: bookingData.company || "Personal",
            checkInTime: nowFormatted,
            endTime: bookingData.endTime || "Selesai",
            bookingCode,
          }
        : undefined,
      checkLog: newLog,
    };

    mutateCoworkingMaster(
      (prev) => applyCoworkingMasterCommand(prev, sessionCmd),
      {
        id: `cwk-session-${newBooking.id}`,
        isCreate: false,
        command: sessionCmd,
      }
    );

    commitBookings((prev) => [newBooking, ...prev]);
    syncBookingToServer(newBooking, true);

    addNotification({
      type: "PAYMENT_RECEIVED",
      title: isPaid
        ? "Pembayaran Booking Co-working"
        : "Booking Co-working Baru (Menunggu Pembayaran)",
      detail: `Booking ${newBooking.spaceName} (${newBooking.guestName}) sebesar Rp ${newBooking.totalAmount.toLocaleString()} ${isPaid ? "berhasil" : "didaftarkan"}.`,
      relatedModule: "COWORKING",
      actionUrl: "/coworking",
      outletId: activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr",
      outletName: activeOutlet?.name || "Singaraja",
    });

    logActivity({
      module: "COWORKING",
      action: "CREATE_BOOKING",
      recordId: bookingCode,
      newValue: `${bookingData.guestName} - ${bookingData.spaceName} (Rp ${bookingData.totalAmount.toLocaleString()} - ${effectivePaymentStatus})`,
      description: `Pembuatan booking Co-working: ${bookingCode} (${bookingData.spaceName})`,
      reason: isPaid
        ? "Booking & Check-in lunas"
        : "Booking mandiri menunggu pembayaran",
      status: "SUCCESS",
    });

    return newBooking;
  };

  const confirmBookingPayment = (
    bookingId: string,
    paymentMethod?: string,
    qrisVerification?: QRISVerificationDetail
  ) => {
    const booking = bookingsRef.current.find(
      (b) => b.id === bookingId || b.bookingCode === bookingId
    );
    if (!booking) return;

    const { now, time: nowFormatted, date: dateFormatted } = formatWitaPartsNow();
    const method = paymentMethod || booking.paymentMethod || "QRIS";
    const supervisorName =
      qrisVerification?.supervisorName || user?.name || "Supervisor Coworking";
    const updatedBooking: CoworkingBookingRecord = {
      ...booking,
      paymentStatus: "PAID",
      paymentMethod: method,
      checkInStatus: "CHECKED_IN",
      paidAmount: booking.totalAmount,
      remainingAmount: 0,
      paymentRef:
        qrisVerification?.referenceNumber ||
        booking.paymentRef ||
        `PAY-${booking.bookingCode}`,
      paymentTimestamp: `${dateFormatted} ${nowFormatted}`,
      checkedInAt: booking.checkedInAt || `${dateFormatted} ${nowFormatted}`,
      checkedInBy: booking.checkedInBy || supervisorName,
      qrisVerification: qrisVerification || booking.qrisVerification,
    };

    commitBookings((prev) =>
      prev.map((b) => (b.id === booking.id ? updatedBooking : b))
    );

    const newLog: CheckInOutLog = {
      id: `chk-${now.getTime()}`,
      bookingCode: booking.bookingCode,
      guestName: booking.guestName,
      spaceName: booking.spaceName,
      checkInDate: dateFormatted,
      checkInTime: nowFormatted,
      checkInBy: supervisorName,
      durationFormatted: "Sedang Aktif",
      status: "ACTIVE_IN",
    };

    const sessionCmd: CoworkingMasterCommand = {
      op: "PATCH_SPACE_SESSION",
      spaceId: booking.spaceId,
      status: "OCCUPIED",
      currentSession: {
        guestName: booking.guestName,
        company: booking.company || "Personal",
        checkInTime: nowFormatted,
        endTime: booking.endTime || "Selesai",
        bookingCode: booking.bookingCode,
      },
      checkLog: newLog,
    };

    mutateCoworkingMaster(
      (prev) => applyCoworkingMasterCommand(prev, sessionCmd),
      {
        id: `cwk-session-confirm-${booking.id}`,
        isCreate: false,
        command: sessionCmd,
      }
    );

    syncBookingToServer(updatedBooking, false);

    addNotification({
      type: "PAYMENT_RECEIVED",
      title: "Pembayaran Booking Co-working Berhasil",
      detail: `Pembayaran booking ${booking.spaceName} (${booking.guestName}) sebesar Rp ${booking.totalAmount.toLocaleString()} disetujui supervisor (${method}).`,
      relatedModule: "COWORKING",
      actionUrl: "/coworking",
      outletId: activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr",
      outletName: activeOutlet?.name || "Singaraja",
    });

    logActivity({
      module: "COWORKING",
      action: qrisVerification
        ? "QRIS_SUPERVISOR_MANUAL_OVERRIDE"
        : "CONFIRM_BOOKING_PAYMENT",
      recordId: booking.bookingCode,
      previousValue: `Payment: ${booking.paymentStatus}`,
      newValue: `Payment: PAID (${method})`,
      description: qrisVerification
        ? `Otorisasi pembayaran QRIS Co-working ${booking.bookingCode} (${booking.spaceName}) lunas oleh supervisor ${supervisorName}. Ref RRN: ${qrisVerification.referenceNumber}`
        : `Pembayaran booking Co-working ${booking.bookingCode} lunas via ${method}`,
      reason:
        qrisVerification?.note || "Otorisasi QRIS Statis oleh Supervisor",
      status: "SUCCESS",
      metadata: qrisVerification
        ? {
            supervisorId: qrisVerification.supervisorId,
            supervisorName: qrisVerification.supervisorName,
            supervisorRole: qrisVerification.supervisorRole,
            referenceNumber: qrisVerification.referenceNumber,
            verifiedAt: qrisVerification.verifiedAt,
          }
        : undefined,
    });
  };

  const cancelBooking = (bookingId: string) => {
    const booking = bookingsRef.current.find(
      (b) => b.id === bookingId || b.bookingCode === bookingId
    );
    if (!booking) return;

    const { time: nowFormatted, date: dateFormatted } = formatWitaPartsNow();
    const actorName = user?.name || "Pelanggan";

    const cancelledBooking: CoworkingBookingRecord = {
      ...booking,
      checkInStatus: "CANCELLED",
    };

    commitBookings((prev) =>
      prev.map((b) => (b.id === booking.id ? cancelledBooking : b))
    );

    const targetSpace = spaces.find((s) => s.id === booking.spaceId);
    const otherActiveCheckedIn = bookingsRef.current.some(
      (b) =>
        b.id !== booking.id &&
        b.spaceId === booking.spaceId &&
        b.checkInStatus === "CHECKED_IN"
    );

    if (
      !otherActiveCheckedIn &&
      targetSpace &&
      (targetSpace.currentSession?.bookingCode === booking.bookingCode ||
        targetSpace.status === "RESERVED")
    ) {
      const sessionCmd: CoworkingMasterCommand = {
        op: "PATCH_SPACE_SESSION",
        spaceId: booking.spaceId,
        status: "AVAILABLE",
        currentSession: undefined,
        completedBookingCode: booking.bookingCode,
        checkoutDate: dateFormatted,
        checkoutTime: nowFormatted,
        checkoutBy: actorName,
      };
      mutateCoworkingMaster(
        (prev) => applyCoworkingMasterCommand(prev, sessionCmd),
        {
          id: `cwk-session-cancel-${booking.id}`,
          isCreate: false,
          command: sessionCmd,
        }
      );
    }

    syncBookingToServer(cancelledBooking, false);

    logActivity({
      module: "COWORKING",
      action: "CANCEL_BOOKING",
      recordId: booking.bookingCode,
      newValue: "CANCELLED",
      description: `Pembatalan booking Co-working ${booking.bookingCode}`,
      reason: "Dibatalkan oleh Pelanggan / Expired",
      status: "SUCCESS",
    });
  };

  const checkInBooking = (bookingId: string) => {
    const booking = bookingsRef.current.find(
      (b) => b.id === bookingId || b.bookingCode === bookingId
    );
    if (!booking) return;

    const { now, time: nowFormatted, date: dateFormatted } = formatWitaPartsNow();
    const actorName = user?.name || "Rian Hidayat";
    const checkedInBooking: CoworkingBookingRecord = {
      ...booking,
      checkInStatus: "CHECKED_IN",
      checkedInAt: `${dateFormatted} ${nowFormatted}`,
      checkedInBy: actorName,
    };

    commitBookings((prev) =>
      prev.map((b) => (b.id === booking.id ? checkedInBooking : b))
    );

    const hasActiveLog = coworkingMasterSyncClient
      .getSnapshot()
      .checkLogs.some(
        (l) => l.bookingCode === booking.bookingCode && l.status === "ACTIVE_IN"
      );

    const newLog: CheckInOutLog | undefined =
      booking.checkInStatus === "RESERVED" || !hasActiveLog
        ? {
            id: `chk-${now.getTime()}`,
            bookingCode: booking.bookingCode,
            guestName: booking.guestName,
            spaceName: booking.spaceName,
            checkInDate: dateFormatted,
            checkInTime: nowFormatted,
            checkInBy: actorName,
            durationFormatted: "Sedang Aktif",
            status: "ACTIVE_IN",
          }
        : undefined;

    const sessionCmd: CoworkingMasterCommand = {
      op: "PATCH_SPACE_SESSION",
      spaceId: booking.spaceId,
      status: "OCCUPIED",
      currentSession: {
        guestName: booking.guestName,
        company: booking.company || "Personal",
        checkInTime: nowFormatted,
        endTime: booking.endTime || "Selesai",
        bookingCode: booking.bookingCode,
      },
      checkLog: newLog,
    };

    mutateCoworkingMaster(
      (prev) => applyCoworkingMasterCommand(prev, sessionCmd),
      {
        id: `cwk-session-checkin-${booking.id}`,
        isCreate: false,
        command: sessionCmd,
      }
    );

    syncBookingToServer(checkedInBooking, false);

    logActivity({
      module: "COWORKING",
      action: "CHECKIN_SPACE",
      recordId: booking.bookingCode,
      previousValue: `Status: ${booking.checkInStatus}`,
      newValue: `Status: CHECKED_IN (${nowFormatted})`,
      description: `Check-in tamu Co-working ${booking.guestName} pada ${booking.spaceName}`,
      reason: "Kedatangan tamu di co-working space",
      status: "SUCCESS",
    });
  };

  const checkoutSpace = (spaceIdOrBookingId: string) => {
    const space = spaces.find(
      (s) =>
        s.id === spaceIdOrBookingId ||
        s.currentSession?.bookingCode === spaceIdOrBookingId
    );
    const candidateBookingCode =
      space?.currentSession?.bookingCode || spaceIdOrBookingId;
    const booking = bookingsRef.current.find(
      (b) =>
        b.bookingCode === candidateBookingCode ||
        b.id === spaceIdOrBookingId ||
        (b.spaceId === spaceIdOrBookingId &&
          (b.checkInStatus === "CHECKED_IN" || b.checkInStatus === "RESERVED"))
    );

    const { time: nowFormatted, date: dateFormatted } = formatWitaPartsNow();
    const actorName = user?.name || "Rian Hidayat (Manager Coworking)";
    const resolvedSpaceId = space?.id || booking?.spaceId;
    const resolvedBookingCode = booking?.bookingCode || candidateBookingCode;

    if (resolvedSpaceId) {
      const sessionCmd: CoworkingMasterCommand = {
        op: "PATCH_SPACE_SESSION",
        spaceId: resolvedSpaceId,
        status: "AVAILABLE",
        currentSession: undefined,
        completedBookingCode: resolvedBookingCode,
        checkoutDate: dateFormatted,
        checkoutTime: nowFormatted,
        checkoutBy: actorName,
      };
      mutateCoworkingMaster(
        (prev) => applyCoworkingMasterCommand(prev, sessionCmd),
        {
          id: `cwk-session-checkout-${resolvedBookingCode}`,
          isCreate: false,
          command: sessionCmd,
        }
      );
    }

    if (booking) {
      const completedBooking: CoworkingBookingRecord = {
        ...booking,
        checkInStatus: "COMPLETED",
        checkedOutAt: `${dateFormatted} ${nowFormatted}`,
        checkedOutBy: actorName,
      };
      commitBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? completedBooking : b))
      );
      syncBookingToServer(completedBooking, false);
    }

    logActivity({
      module: "COWORKING",
      action: "CHECKOUT_SPACE",
      recordId: resolvedBookingCode,
      previousValue: "Status: CHECKED_IN",
      newValue: `Status: CHECKED_OUT / COMPLETED (${nowFormatted})`,
      description: `Check-out tamu ${booking?.guestName || "Tamu"} dari ${space?.name || "Ruang"}`,
      reason: "Durasi sewa co-working selesai",
      status: "SUCCESS",
    });
  };

  const addMember = (
    memberData: Omit<CoworkingMemberProfile, "id" | "memberId" | "paymentHistory">,
    payment: { amount: number; paymentMethod: string }
  ) => {
    const currentMembers = coworkingMasterSyncClient.getSnapshot().members;
    const newMemberId = `CWM-2026-${String(currentMembers.length + 1).padStart(3, "0")}`;
    const dateFormatted = new Date().toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const newMember: CoworkingMemberProfile = {
      ...memberData,
      id: `cwm-${Date.now()}`,
      memberId: newMemberId,
      totalSpent: payment.amount,
      paymentHistory: [
        {
          id: `cwp-${Date.now()}`,
          date: dateFormatted,
          amount: payment.amount,
          plan: memberData.packageName,
          paymentMethod: payment.paymentMethod,
          status: "PAID",
        },
      ],
    };

    const cmd: CoworkingMasterCommand = {
      op: "UPSERT_MEMBER",
      member: newMember,
    };

    mutateCoworkingMaster(
      (prev) => applyCoworkingMasterCommand(prev, cmd),
      { id: `cwk-member-${newMember.id}`, isCreate: true, command: cmd }
    );

    logActivity({
      module: "COWORKING",
      action: "CREATE_MEMBER",
      recordId: newMember.memberId,
      newValue: `${newMember.name} (${newMember.packageName} - Rp ${payment.amount.toLocaleString()})`,
      description: `Pendaftaran member Co-working baru: ${newMember.name} (${newMember.memberId})`,
      reason: "Pembelian paket keanggotaan co-working",
      status: "SUCCESS",
    });
  };

  const resetCoworkingData = () => {
    const resetCmd: CoworkingMasterCommand = { op: "RESET_COWORKING_MASTER" };
    mutateCoworkingMaster(
      (prev) => applyCoworkingMasterCommand(prev, resetCmd),
      { id: "coworking-master-reset", isCreate: false, command: resetCmd }
    );

    bookingsRef.current = INITIAL_BOOKINGS;
    setBookings(INITIAL_BOOKINGS);
    try {
      localStorage.setItem(
        STORAGE_KEY_BOOKINGS,
        JSON.stringify(INITIAL_BOOKINGS)
      );
    } catch {}

    const staleOutbox = getOutboxItems().filter(
      (item) => item.endpoint === BOOKINGS_ENDPOINT
    );
    for (const entry of staleOutbox) {
      removeOutboxItem(entry.id, BOOKINGS_ENDPOINT);
    }

    if (typeof window !== "undefined") {
      void syncWithOutbox({
        id: "coworking-bookings-reset",
        endpoint: BOOKINGS_ENDPOINT,
        method: "DELETE",
        isCreate: false,
        payload: {},
      }).catch(() => {});
    }
  };

  return (
    <CoworkingContext.Provider
      value={{
        spaces,
        bookings,
        members,
        checkLogs,
        plans,
        addSpace,
        updateSpace,
        deleteSpace,
        addPlan,
        updatePlan,
        deletePlan,
        bookSpace,
        confirmBookingPayment,
        cancelBooking,
        checkInBooking,
        checkoutSpace,
        addMember,
        resetCoworkingData,
      }}
    >
      {children}
    </CoworkingContext.Provider>
  );
}

export function useCoworking() {
  const context = useContext(CoworkingContext);
  if (!context) {
    throw new Error("useCoworking must be used within a CoworkingProvider");
  }
  return context;
}
