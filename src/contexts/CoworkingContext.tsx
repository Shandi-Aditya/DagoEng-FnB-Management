"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { CoworkingSpaceItem, CoworkingBooking, CoworkingMembershipPlan } from "@/types/coworking";
import { useAuth } from "./AuthContext";
import { useOutlet } from "./OutletContext";
import { useActivityLog } from "./ActivityLogContext";
import { useNotifications } from "./NotificationContext";

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

interface CoworkingContextType {
  spaces: CoworkingSpaceItem[];
  bookings: typeof INITIAL_BOOKINGS;
  members: CoworkingMemberProfile[];
  checkLogs: CheckInOutLog[];
  addSpace: (space: Omit<CoworkingSpaceItem, "id">) => CoworkingSpaceItem;
  updateSpace: (id: string, updates: Partial<CoworkingSpaceItem>) => void;
  deleteSpace: (id: string) => void;
  bookSpace: (
    booking: Omit<typeof INITIAL_BOOKINGS[0], "id" | "bookingCode" | "checkInStatus" | "checkedInAt" | "checkedInBy">
  ) => typeof INITIAL_BOOKINGS[0];
  confirmBookingPayment: (bookingId: string, paymentMethod?: string) => void;
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

export function CoworkingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeOutletId, activeOutlet } = useOutlet();
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

  const bookSpace = (
    bookingData: Omit<typeof INITIAL_BOOKINGS[0], "id" | "bookingCode" | "checkInStatus" | "checkedInAt" | "checkedInBy">
  ): typeof INITIAL_BOOKINGS[0] => {
    const bookingCode = `BK-CWK-${Date.now().toString().slice(-5)}`;
    const nowFormatted = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WITA";
    const dateFormatted = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    const actorName = user?.name || "Rian Hidayat (Manager Coworking)";
    const isPaid = bookingData.paymentStatus === "PAID";

    const newBooking: typeof INITIAL_BOOKINGS[0] = {
      ...bookingData,
      id: `bk-${Date.now()}`,
      bookingCode,
      checkInStatus: isPaid ? "CHECKED_IN" : "RESERVED",
      checkedInAt: isPaid ? `${dateFormatted} ${nowFormatted}` : undefined,
      checkedInBy: isPaid ? actorName : undefined,
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
      newValue: `${bookingData.guestName} - ${bookingData.spaceName} (Rp ${bookingData.totalAmount.toLocaleString()} - ${bookingData.paymentStatus})`,
      description: `Pembuatan booking Co-working: ${bookingCode} (${bookingData.spaceName})`,
      reason: isPaid ? "Booking & Check-in lunas" : "Booking mandiri menunggu pembayaran",
      status: "SUCCESS",
    });

    return newBooking;
  };

  const confirmBookingPayment = (bookingId: string, paymentMethod?: string) => {
    const booking = bookings.find((b) => b.id === bookingId || b.bookingCode === bookingId);
    if (!booking) return;

    const nowFormatted = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WITA";
    const dateFormatted = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    const method = paymentMethod || booking.paymentMethod || "QRIS";

    setBookings((prev) =>
      prev.map((b) =>
        b.id === booking.id
          ? {
              ...b,
              paymentStatus: "PAID",
              paymentMethod: method,
              checkInStatus: "RESERVED",
              paidAmount: b.totalAmount,
              remainingAmount: 0,
              paymentTimestamp: `${dateFormatted} ${nowFormatted}`,
            }
          : b
      )
    );

    addNotification({
      type: "PAYMENT_RECEIVED",
      title: "Pembayaran Booking Co-working Berhasil",
      detail: `Pembayaran booking ${booking.spaceName} atas nama ${booking.guestName} sebesar Rp ${booking.totalAmount.toLocaleString()} telah lunas (${method}).`,
      relatedModule: "COWORKING",
      actionUrl: "/coworking",
      outletId: activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr",
      outletName: activeOutlet?.name || "Singaraja",
    });

    logActivity({
      module: "COWORKING",
      action: "CONFIRM_BOOKING_PAYMENT",
      recordId: booking.bookingCode,
      previousValue: `Payment: ${booking.paymentStatus}`,
      newValue: `Payment: PAID (${method})`,
      description: `Pembayaran booking Co-working ${booking.bookingCode} lunas via ${method}`,
      reason: "Konfirmasi pembayaran tamu",
      status: "SUCCESS",
    });
  };

  const cancelBooking = (bookingId: string) => {
    const booking = bookings.find((b) => b.id === bookingId || b.bookingCode === bookingId);
    if (!booking) return;

    setBookings((prev) =>
      prev.map((b) =>
        b.id === booking.id
          ? {
              ...b,
              checkInStatus: "CANCELLED",
            }
          : b
      )
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

    const nowFormatted = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WITA";
    const dateFormatted = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    const actorName = user?.name || "Rian Hidayat";

    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              checkInStatus: "CHECKED_IN",
              checkedInAt: `${dateFormatted} ${nowFormatted}`,
              checkedInBy: actorName,
            }
          : b
      )
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
    const booking = bookings.find((b) => b.bookingCode === bookingCode || b.id === spaceIdOrBookingId || b.spaceId === spaceIdOrBookingId);

    const nowFormatted = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WITA";
    const dateFormatted = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    const actorName = user?.name || "Rian Hidayat (Manager Coworking)";

    // Update space
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

    // Update booking lifecycle strictly: CHECKED_IN ➔ CHECKED_OUT / COMPLETED
    if (booking) {
      setBookings((prev) =>
        prev.map((b) =>
          b.id === booking.id
            ? {
                ...b,
                checkInStatus: "COMPLETED",
                checkedOutAt: `${dateFormatted} ${nowFormatted}`,
                checkedOutBy: actorName,
              }
            : b
        )
      );
    }

    // Update Check-out log
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
