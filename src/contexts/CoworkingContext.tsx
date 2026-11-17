"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { CoworkingSpaceItem, CoworkingBooking, CoworkingMembershipPlan } from "@/types/coworking";
import type { QRISVerificationDetail } from "@/lib/qris-verification";
import { useAuth } from "./AuthContext";
import { useOutlet } from "./OutletContext";
import { useSettings } from "./SettingsContext";
import { useActivityLog } from "./ActivityLogContext";
import { useNotifications } from "./NotificationContext";
import { getTodayWitaDateString } from "./DateFilterContext";
import { generateSequentialReceiptNumber } from "@/lib/receipt-publisher";
import {
  checkCoworkingBookingConflict,
  validateCoworkingDateRange,
} from "@/lib/operating-hours";

export interface CoworkingMemberProfile {
  id: string;
  memberId: string; // e.g. "CWM-2026-042"
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

export const INITIAL_SPACES: CoworkingSpaceItem[] = [
  {
    id: "sp-hot-1",
    name: "Hot Desk Flex #01 - #08",
    type: "HOT_DESK",
    area: "Ground Floor Main",
    capacity: 8,
    hourlyRate: 15000,
    dailyRate: 65000,
    status: "AVAILABLE",
    amenities: ["High-speed Fiber WiFi", "Power Outlet", "Free Flow Infused Water"],
    description: "Meja kerja komunal yang nyaman dengan akses power outlet individual, koneksi fiber internet 100 Mbps, dan free-flow infused water.",
    imageUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=600&auto=format&fit=crop",
  },
  {
    id: "sp-ded-1",
    name: "Dedicated Desk D-01",
    type: "DEDICATED_DESK",
    area: "Mezzanine Quiet Zone",
    capacity: 1,
    hourlyRate: 25000,
    dailyRate: 120000,
    monthlyRate: 1850000,
    status: "AVAILABLE",
    amenities: ["Ergonomic Herman Miller Chair", "Dual Monitor 27-inch", "Locker Pribadi", "Free 2 Jam Meeting Room"],
    description: "Meja kerja pribadi khusus dengan kursi ergonomis Herman Miller, dual-monitor 27 inch 4K, dan locker penyimpanan personal.",
    imageUrl: "https://images.unsplash.com/photo-1527192491265-7e15c55b1ed2?q=80&w=600&auto=format&fit=crop",
  },
  {
    id: "sp-ded-2",
    name: "Dedicated Desk D-02",
    type: "DEDICATED_DESK",
    area: "Mezzanine Quiet Zone",
    capacity: 1,
    hourlyRate: 25000,
    dailyRate: 120000,
    monthlyRate: 1850000,
    status: "AVAILABLE",
    amenities: ["Ergonomic Chair", "Locker", "Free Coffee 1 Cup/Day"],
    description: "Meja kerja tetap di Mezzanine Quiet Zone untuk kenyamanan konsentrasi penuh dengan free coffee 1 cup/hari.",
    imageUrl: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=600&auto=format&fit=crop",
  },
  {
    id: "sp-meet-1",
    name: "Executive Glass Meeting Room (Room Alpha)",
    type: "MEETING_ROOM",
    area: "VIP Meeting Wing",
    capacity: 10,
    hourlyRate: 150000,
    dailyRate: 900000,
    status: "AVAILABLE",
    amenities: ["4K Smart TV Screen Share", "Whiteboard", "Jabra Conference Mic", "Soundproof Acoustic Walls"],
    description: "Ruang meeting premium berkapasitas 10 orang dengan Smart TV 4K, conference mic Jabra, dan dinding peredam suara akustik.",
    imageUrl: "https://images.unsplash.com/photo-1517502884422-41eaead166d4?q=80&w=600&auto=format&fit=crop",
  },
  {
    id: "sp-pod-1",
    name: "Focus Audio Pod #01",
    type: "PRIVATE_POD",
    area: "Mezzanine Quiet Zone",
    capacity: 1,
    hourlyRate: 35000,
    dailyRate: 180000,
    status: "AVAILABLE",
    amenities: ["Soundproof 35dB", "Ring Light Zoom Video", "Ventilation Fan"],
    description: "Pod kedap suara individual untuk panggilan video, podcast, dan interview online tanpa gangguan kebisingan.",
    imageUrl: "https://images.unsplash.com/photo-1573164713988-8665fc963095?q=80&w=600&auto=format&fit=crop",
  },
];

export const INITIAL_MEMBERSHIPS: CoworkingMemberProfile[] = [
  {
    id: "cwm-1",
    memberId: "CWM-2026-001",
    name: "Sarah Jenkins",
    contact: "+62 819-5566-7788",
    email: "sarah.j@nomadtech.io",
    packageName: "Dedicated Nomad Monthly",
    startDate: "01 Sep 2026",
    expiryDate: "30 Sep 2026",
    status: "ACTIVE",
    totalSpent: 0,
    paymentHistory: [],
  },
  {
    id: "cwm-2",
    memberId: "CWM-2026-002",
    name: "Gede Arya Wijaya",
    contact: "+62 812-4455-6677",
    email: "gede.arya@architect.co",
    packageName: "Flex 10 Days Pass",
    startDate: "10 Agu 2026",
    expiryDate: "10 Sep 2026",
    status: "ACTIVE",
    totalSpent: 0,
    paymentHistory: [],
  },
  {
    id: "cwm-3",
    memberId: "CWM-2026-003",
    name: "Ibu Maya Santika",
    contact: "+62 815-6677-8899",
    email: "maya.santika@corp.id",
    packageName: "Executive Team Pass",
    startDate: "15 Agu 2026",
    expiryDate: "15 Okt 2026",
    status: "ACTIVE",
    totalSpent: 0,
    paymentHistory: [],
  },
];

export const INITIAL_BOOKINGS: (CoworkingBooking & {
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
})[] = [];

export const INITIAL_CHECK_LOGS: CheckInOutLog[] = [];

export type NewBookingInput = Omit<
  typeof INITIAL_BOOKINGS[0],
  "id" | "bookingCode" | "checkInStatus" | "checkedInAt" | "checkedInBy"
> & {
  checkInStatus?: "RESERVED" | "CHECKED_IN" | "COMPLETED" | "CANCELLED";
};

interface CoworkingContextType {
  spaces: CoworkingSpaceItem[];
  bookings: typeof INITIAL_BOOKINGS;
  members: CoworkingMemberProfile[];
  checkLogs: CheckInOutLog[];
  addSpace: (space: Omit<CoworkingSpaceItem, "id">) => CoworkingSpaceItem;
  updateSpace: (id: string, updates: Partial<CoworkingSpaceItem>) => void;
  deleteSpace: (id: string) => void;
  bookSpace: (booking: NewBookingInput) => typeof INITIAL_BOOKINGS[0];
  confirmBookingPayment: (bookingId: string, paymentMethod?: string, qrisVerification?: QRISVerificationDetail) => void;
  cancelBooking: (bookingId: string) => void;
  checkInBooking: (bookingId: string) => void;
  checkoutSpace: (spaceIdOrBookingId: string) => void;
  addMember: (member: Omit<CoworkingMemberProfile, "id" | "memberId" | "paymentHistory">, payment: { amount: number; paymentMethod: string }) => void;
  resetCoworkingData: () => void;
}

const CoworkingContext = createContext<CoworkingContextType | undefined>(undefined);

const STORAGE_KEY_SPACES = "dagoeng_cwk_spaces_v3";
const STORAGE_KEY_BOOKINGS = "dagoeng_cwk_bookings_v3";
const STORAGE_KEY_MEMBERS = "dagoeng_cwk_members_v3";
const STORAGE_KEY_LOGS = "dagoeng_cwk_logs_v3";

function syncBookingToServer(booking: typeof INITIAL_BOOKINGS[number], contextLabel: string): void {
  if (typeof window === "undefined") return;
  fetch("/api/coworking/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ booking }),
  }).catch((err) => {
    console.warn(`[coworking] Persistent sync warning (${contextLabel}):`, err);
  });
}

function mergeBookingsFromSource(
  prev: typeof INITIAL_BOOKINGS,
  incoming: typeof INITIAL_BOOKINGS
): { next: typeof INITIAL_BOOKINGS; changed: boolean } {
  const prevMap = new Map(prev.map((b) => [b.id, b]));
  let changed = false;
  for (const incomingBooking of incoming) {
    const existing = prevMap.get(incomingBooking.id);
    if (!existing) {
      prevMap.set(incomingBooking.id, incomingBooking);
      changed = true;
    } else if (
      existing.paymentStatus !== incomingBooking.paymentStatus ||
      existing.checkInStatus !== incomingBooking.checkInStatus ||
      existing.paymentMethod !== incomingBooking.paymentMethod ||
      existing.paymentRef !== incomingBooking.paymentRef ||
      existing.checkedOutAt !== incomingBooking.checkedOutAt ||
      existing.checkedInAt !== incomingBooking.checkedInAt ||
      existing.totalAmount !== incomingBooking.totalAmount
    ) {
      prevMap.set(incomingBooking.id, { ...existing, ...incomingBooking });
      changed = true;
    }
  }
  return { next: changed ? Array.from(prevMap.values()) : prev, changed };
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

export function CoworkingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeOutletId, activeOutlet } = useOutlet();
  const { settings } = useSettings();
  const { logActivity } = useActivityLog();
  const { addNotification } = useNotifications();

  const [spaces, setSpaces] = useState<CoworkingSpaceItem[]>(INITIAL_SPACES);
  const [bookings, setBookings] = useState<typeof INITIAL_BOOKINGS>(INITIAL_BOOKINGS);
  const [members, setMembers] = useState<CoworkingMemberProfile[]>(INITIAL_MEMBERSHIPS);
  const [checkLogs, setCheckLogs] = useState<CheckInOutLog[]>(INITIAL_CHECK_LOGS);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const sSpaces = localStorage.getItem(STORAGE_KEY_SPACES);
      const sBookings = localStorage.getItem(STORAGE_KEY_BOOKINGS);
      const sMembers = localStorage.getItem(STORAGE_KEY_MEMBERS);
      const sLogs = localStorage.getItem(STORAGE_KEY_LOGS);

      if (sSpaces) {
        const parsedSpaces = JSON.parse(sSpaces);
        if (Array.isArray(parsedSpaces) && parsedSpaces.length > 0) {
          const initialMap = new Map(INITIAL_SPACES.map((s) => [s.id, s]));
          const customSpaces = parsedSpaces.filter((s: CoworkingSpaceItem) => !initialMap.has(s.id));
          const updatedInitialSpaces = INITIAL_SPACES.map((initSpace) => {
            const userVersion = parsedSpaces.find((s: CoworkingSpaceItem) => s.id === initSpace.id);
            if (userVersion) {
              return {
                ...initSpace,
                ...userVersion,
              };
            }
            return initSpace;
          });
          setSpaces([...updatedInitialSpaces, ...customSpaces]);
        }
      }
      if (sBookings) setBookings(JSON.parse(sBookings));
      if (sMembers) setMembers(JSON.parse(sMembers));
      if (sLogs) setCheckLogs(JSON.parse(sLogs));
    } catch (e) {
      console.error("Failed to load coworking state", e);
    } finally {
      setIsInitialized(true);
    }

    if (typeof window !== "undefined") {
      const hydrateFromServer = () => {
        fetch("/api/coworking/bookings")
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data && Array.isArray(data.bookings) && data.bookings.length > 0) {
              setBookings((prev) => mergeBookingsFromSource(prev, data.bookings).next);
            }
          })
          .catch(() => {});
      };

      hydrateFromServer();

      const handleStorage = (event: StorageEvent) => {
        if (!event.newValue) return;
        try {
          if (event.key === STORAGE_KEY_BOOKINGS) {
            const parsed = JSON.parse(event.newValue);
            if (Array.isArray(parsed)) {
              setBookings((prev) => mergeBookingsFromSource(prev, parsed).next);
            }
          } else if (event.key === STORAGE_KEY_SPACES) {
            const parsed = JSON.parse(event.newValue);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setSpaces(parsed);
            }
          } else if (event.key === STORAGE_KEY_LOGS) {
            const parsed = JSON.parse(event.newValue);
            if (Array.isArray(parsed)) {
              setCheckLogs(parsed);
            }
          }
        } catch (err) {
          console.error("Failed to sync coworking storage update", err);
        }
      };

      window.addEventListener("storage", handleStorage);
      const pollInterval = setInterval(hydrateFromServer, 5000);

      return () => {
        window.removeEventListener("storage", handleStorage);
        clearInterval(pollInterval);
      };
    }
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEY_SPACES, JSON.stringify(spaces));
      localStorage.setItem(STORAGE_KEY_BOOKINGS, JSON.stringify(bookings));
      localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(members));
      localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(checkLogs));
    } catch (e) {
      console.error("Failed to save coworking state", e);
    }
  }, [spaces, bookings, members, checkLogs, isInitialized]);

  const addSpace = (
    spaceData: Omit<CoworkingSpaceItem, "id">
  ): CoworkingSpaceItem => {
    const newSpace: CoworkingSpaceItem = {
      ...spaceData,
      id: `sp-custom-${Date.now()}`,
      status: spaceData.status || "AVAILABLE",
    };

    setSpaces((prev) => [newSpace, ...prev]);

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
    const existing = spaces.find((s) => s.id === id);
    if (!existing) return;

    setSpaces((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              ...updates,
            }
          : s
      )
    );

    logActivity({
      module: "COWORKING",
      action: "UPDATE_SPACE",
      recordId: id,
      previousValue: `Nama: ${existing.name}, Rate: Rp ${existing.hourlyRate.toLocaleString()}`,
      newValue: `Nama: ${updates.name || existing.name}, Rate: Rp ${(updates.hourlyRate ?? existing.hourlyRate).toLocaleString()}`,
      description: `Perubahan master workspace: "${updates.name || existing.name}"`,
      reason: "Update data workspace oleh Owner/Admin",
      status: "SUCCESS",
    });
  };

  const deleteSpace = (id: string) => {
    const existing = spaces.find((s) => s.id === id);
    if (!existing) return;

    setSpaces((prev) => prev.filter((s) => s.id !== id));

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

  const bookSpace = (bookingData: NewBookingInput): typeof INITIAL_BOOKINGS[0] => {
    // 1. Holiday & Weekend Validation Guard
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

    // 2. Anti Double-Booking Collision Guard
    const conflict = checkCoworkingBookingConflict(bookings, bookingData);
    if (conflict.hasConflict) {
      throw new Error(`DOUBLE_BOOKING_CONFLICT: ${conflict.message}`);
    }

    const bookingCode = generateSequentialReceiptNumber({
      prefix: "CWK",
      publisherCode: "DAGO",
      existingNumbers: bookings.map((b) => b.bookingCode),
    });
    const { now, time: nowFormatted, date: dateFormatted } = formatWitaPartsNow();
    const actorName = user?.name || "Rian Hidayat (Manager Coworking)";

    // QRIS cannot be marked PAID immediately without supervisor confirmation (Task V-05)
    const isQris = bookingData.paymentMethod === "QRIS";
    const effectivePaymentStatus: "PAID" | "PENDING" = isQris ? "PENDING" : (bookingData.paymentStatus ?? "PAID");
    const isPaid = effectivePaymentStatus === "PAID";
    const paidAmount = isPaid ? (bookingData.paidAmount ?? bookingData.totalAmount) : 0;
    const remainingAmount = isPaid ? 0 : bookingData.totalAmount;

    const newBooking: typeof INITIAL_BOOKINGS[0] = {
      ...bookingData,
      id: `bk-${now.getTime()}`,
      bookingCode,
      outletId: bookingData.outletId || (activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr"),
      createdAt: bookingData.createdAt || now.toISOString(),
      paymentStatus: effectivePaymentStatus,
      paidAmount,
      remainingAmount,
      checkInStatus: bookingData.checkInStatus ?? (isPaid ? "CHECKED_IN" : "RESERVED"),
      checkedInAt: isPaid || bookingData.checkInStatus === "CHECKED_IN" ? `${dateFormatted} ${nowFormatted}` : undefined,
      checkedInBy: isPaid || bookingData.checkInStatus === "CHECKED_IN" ? actorName : undefined,
    };

    // Update space status to OCCUPIED if paid, or RESERVED if pending
    setSpaces((prev) =>
      prev.map((s) =>
        s.id === bookingData.spaceId
          ? {
              ...s,
              status: isPaid ? "OCCUPIED" : "RESERVED",
              currentSession: isPaid
                ? {
                    guestName: bookingData.guestName,
                    company: bookingData.company || "Personal",
                    checkInTime: nowFormatted,
                    endTime: "Selesai",
                    bookingCode,
                  }
                : undefined,
            }
          : s
      )
    );

    setBookings((prev) => [newBooking, ...prev]);

    syncBookingToServer(newBooking, "create");

    if (isPaid) {
      // Record check-in log
      const newLog: CheckInOutLog = {
        id: `chk-${Date.now()}`,
        bookingCode,
        guestName: bookingData.guestName,
        spaceName: bookingData.spaceName,
        checkInDate: dateFormatted,
        checkInTime: nowFormatted,
        checkInBy: actorName,
        durationFormatted: "Sedang Aktif",
        status: "ACTIVE_IN",
      };
      setCheckLogs((prev) => [newLog, ...prev]);
    }

    // Send notification
    addNotification({
      type: "PAYMENT_RECEIVED",
      title: isPaid ? "Pembayaran Booking Co-working" : "Booking Co-working Baru (Menunggu Pembayaran)",
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
      reason: isPaid ? "Booking & Check-in lunas" : "Booking mandiri menunggu pembayaran",
      status: "SUCCESS",
    });

    return newBooking;
  };

  const confirmBookingPayment = (
    bookingId: string,
    paymentMethod?: string,
    qrisVerification?: QRISVerificationDetail
  ) => {
    const booking = bookings.find((b) => b.id === bookingId || b.bookingCode === bookingId);
    if (!booking) return;

    const { time: nowFormatted, date: dateFormatted } = formatWitaPartsNow();
    const method = paymentMethod || booking.paymentMethod || "QRIS";
    const supervisorName = qrisVerification?.supervisorName || user?.name || "Supervisor Coworking";
    const updatedBooking: typeof INITIAL_BOOKINGS[number] = {
      ...booking,
      paymentStatus: "PAID",
      paymentMethod: method,
      checkInStatus: "CHECKED_IN",
      paidAmount: booking.totalAmount,
      remainingAmount: 0,
      paymentRef: qrisVerification?.referenceNumber || booking.paymentRef || `PAY-${booking.bookingCode}`,
      paymentTimestamp: `${dateFormatted} ${nowFormatted}`,
      qrisVerification: qrisVerification || booking.qrisVerification,
    };

    setBookings((prev) =>
      prev.map((b) => (b.id === booking.id ? updatedBooking : b))
    );

    // Update space status to OCCUPIED
    setSpaces((prev) =>
      prev.map((s) =>
        s.id === booking.spaceId
          ? {
              ...s,
              status: "OCCUPIED",
              currentSession: {
                guestName: booking.guestName,
                company: booking.company || "Personal",
                checkInTime: nowFormatted,
                endTime: "Selesai",
                bookingCode: booking.bookingCode,
              },
            }
          : s
      )
    );

    // Record check-in log
    const newLog: CheckInOutLog = {
      id: `chk-${Date.now()}`,
      bookingCode: booking.bookingCode,
      guestName: booking.guestName,
      spaceName: booking.spaceName,
      checkInDate: dateFormatted,
      checkInTime: nowFormatted,
      checkInBy: supervisorName,
      durationFormatted: "Sedang Aktif",
      status: "ACTIVE_IN",
    };
    setCheckLogs((prev) => [newLog, ...prev]);

    syncBookingToServer(updatedBooking, "confirm");

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
      action: qrisVerification ? "QRIS_SUPERVISOR_MANUAL_OVERRIDE" : "CONFIRM_BOOKING_PAYMENT",
      recordId: booking.bookingCode,
      previousValue: `Payment: ${booking.paymentStatus}`,
      newValue: `Payment: PAID (${method})`,
      description: qrisVerification
        ? `Otorisasi pembayaran QRIS Co-working ${booking.bookingCode} (${booking.spaceName}) lunas oleh supervisor ${supervisorName}. Ref RRN: ${qrisVerification.referenceNumber}`
        : `Pembayaran booking Co-working ${booking.bookingCode} lunas via ${method}`,
      reason: qrisVerification?.note || "Otorisasi QRIS Statis oleh Supervisor",
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
    const booking = bookings.find((b) => b.id === bookingId || b.bookingCode === bookingId);
    if (!booking) return;

    const cancelledBooking: typeof INITIAL_BOOKINGS[number] = {
      ...booking,
      checkInStatus: "CANCELLED",
    };

    setBookings((prev) =>
      prev.map((b) => (b.id === booking.id ? cancelledBooking : b))
    );

    setSpaces((prev) =>
      prev.map((s) =>
        s.id === booking.spaceId && (s.currentSession?.bookingCode === booking.bookingCode || s.status === "RESERVED")
          ? {
              ...s,
              status: "AVAILABLE",
              currentSession: undefined,
            }
          : s
      )
    );

    syncBookingToServer(cancelledBooking, "cancel");

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
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    const { time: nowFormatted, date: dateFormatted } = formatWitaPartsNow();
    const actorName = user?.name || "Rian Hidayat";
    const checkedInBooking: typeof INITIAL_BOOKINGS[number] = {
      ...booking,
      checkInStatus: "CHECKED_IN",
      checkedInAt: `${dateFormatted} ${nowFormatted}`,
      checkedInBy: actorName,
    };

    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? checkedInBooking : b))
    );

    setSpaces((prev) =>
      prev.map((s) =>
        s.id === booking.spaceId
          ? {
              ...s,
              status: "OCCUPIED",
              currentSession: {
                guestName: booking.guestName,
                company: booking.company || "Personal",
                checkInTime: nowFormatted,
                endTime: "Selesai",
                bookingCode: booking.bookingCode,
              },
            }
          : s
      )
    );

    syncBookingToServer(checkedInBooking, "checkin");

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
    const space = spaces.find((s) => s.id === spaceIdOrBookingId || s.currentSession?.bookingCode === spaceIdOrBookingId);
    const bookingCode = space?.currentSession?.bookingCode || spaceIdOrBookingId;
    const booking = bookings.find(
      (b) =>
        b.bookingCode === bookingCode ||
        b.id === spaceIdOrBookingId ||
        (b.spaceId === spaceIdOrBookingId &&
          (b.checkInStatus === "CHECKED_IN" || b.checkInStatus === "RESERVED"))
    );

    const { time: nowFormatted, date: dateFormatted } = formatWitaPartsNow();
    const actorName = user?.name || "Rian Hidayat (Manager Coworking)";

    if (space) {
      setSpaces((prev) =>
        prev.map((s) =>
          s.id === space.id
            ? {
                ...s,
                status: "AVAILABLE",
                currentSession: undefined,
              }
            : s
        )
      );
    }

    if (booking) {
      const completedBooking: typeof INITIAL_BOOKINGS[number] = {
        ...booking,
        checkInStatus: "COMPLETED",
        checkedOutAt: `${dateFormatted} ${nowFormatted}`,
        checkedOutBy: actorName,
      };
      setBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? completedBooking : b))
      );
      syncBookingToServer(completedBooking, "checkout");
    }

    setCheckLogs((prev) =>
      prev.map((l) =>
        l.bookingCode === bookingCode
          ? {
              ...l,
              checkoutDate: dateFormatted,
              checkoutTime: nowFormatted,
              checkoutBy: actorName,
              durationFormatted: "Selesai (Check-out Berhasil)",
              status: "COMPLETED",
            }
          : l
      )
    );

    logActivity({
      module: "COWORKING",
      action: "CHECKOUT_SPACE",
      recordId: bookingCode,
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
    const newMemberId = `CWM-2026-${String(members.length + 1).padStart(3, "0")}`;
    const dateFormatted = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

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

    setMembers((prev) => [newMember, ...prev]);

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
    setSpaces(INITIAL_SPACES);
    setBookings(INITIAL_BOOKINGS);
    setMembers(INITIAL_MEMBERSHIPS);
    setCheckLogs(INITIAL_CHECK_LOGS);
    try {
      localStorage.removeItem(STORAGE_KEY_SPACES);
      localStorage.removeItem(STORAGE_KEY_BOOKINGS);
      localStorage.removeItem(STORAGE_KEY_MEMBERS);
      localStorage.removeItem(STORAGE_KEY_LOGS);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <CoworkingContext.Provider
      value={{
        spaces,
        bookings,
        members,
        checkLogs,
        addSpace,
        updateSpace,
        deleteSpace,
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
