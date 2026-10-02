"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  CoworkingSpaceItem,
  CoworkingBooking,
  CoworkingMembershipPlan,
  VirtualOfficeApplication,
} from "@/types/coworking";
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
    status: "OCCUPIED",
    amenities: ["Ergonomic Chair", "Locker", "Free Coffee 1 Cup/Day"],
    currentSession: {
      guestName: "Sarah Jenkins",
      company: "Remote Nomad Tech",
      checkInTime: "10:02 WITA",
      endTime: "18:00 WITA",
      bookingCode: "BK-CWK-00192",
    },
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
    totalSpent: 1850000,
    paymentHistory: [
      {
        id: "cwp-1",
        date: "01 Sep 2026",
        amount: 1850000,
        plan: "Dedicated Nomad Monthly",
        paymentMethod: "Credit Card (Stripe)",
        status: "PAID",
      },
    ],
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
    status: "EXPIRED",
    totalSpent: 550000,
    paymentHistory: [
      {
        id: "cwp-2",
        date: "10 Agu 2026",
        amount: 550000,
        plan: "Flex 10 Days Pass",
        paymentMethod: "QRIS DagoPay",
        status: "PAID",
      },
    ],
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
    totalSpent: 3500000,
    paymentHistory: [
      {
        id: "cwp-3",
        date: "15 Agu 2026",
        amount: 3500000,
        plan: "Executive Team Pass",
        paymentMethod: "Bank Mandiri",
        status: "PAID",
      },
    ],
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
})[] = [
  {
    id: "bk-101",
    bookingCode: "BK-CWK-00192",
    guestName: "Sarah Jenkins",
    guestPhone: "+62 819-5566-7788",
    guestEmail: "sarah.j@nomadtech.io",
    company: "Remote Nomad Tech",
    spaceId: "sp-ded-2",
    spaceName: "Dedicated Desk D-02",
    spaceType: "DEDICATED_DESK",
    bookingType: "DAILY",
    date: "17 Sep 2026",
    startTime: "10:02 WITA",
    duration: 1,
    price: 120000,
    discount: 0,
    totalAmount: 120000,
    paidAmount: 120000,
    remainingAmount: 0,
    paymentStatus: "PAID",
    paymentMethod: "QRIS DagoPay",
    paymentRef: "QRIS-DAGO-99120",
    paymentTimestamp: "17 Sep 2026 10:02 WITA",
    checkInStatus: "CHECKED_IN",
    checkedInAt: "17 Sep 2026 10:02 WITA",
    checkedInBy: "Rian Hidayat (Manager Coworking)",
  },
  {
    id: "bk-102",
    bookingCode: "BK-CWK-00188",
    guestName: "Bpk. Hendra Wijaya",
    guestPhone: "+62 811-2233-4455",
    guestEmail: "hendra.w@dagoeng.com",
    company: "Dago Creative Hub",
    spaceId: "sp-meet-1",
    spaceName: "Executive Glass Meeting Room",
    spaceType: "MEETING_ROOM",
    bookingType: "HOURLY",
    date: "16 Sep 2026",
    startTime: "14:00 WITA",
    duration: 3,
    price: 450000,
    discount: 0,
    totalAmount: 450000,
    paidAmount: 450000,
    remainingAmount: 0,
    paymentStatus: "PAID",
    paymentMethod: "CASH",
    paymentRef: "CASH-REC-4410",
    paymentTimestamp: "16 Sep 2026 14:00 WITA",
    checkInStatus: "COMPLETED",
    checkedInAt: "16 Sep 2026 14:00 WITA",
    checkedOutAt: "16 Sep 2026 17:00 WITA",
    checkedInBy: "Rian Hidayat",
    checkedOutBy: "Rian Hidayat",
  },
];

export const INITIAL_CHECK_LOGS: CheckInOutLog[] = [
  {
    id: "chk-1",
    bookingCode: "BK-CWK-00192",
    guestName: "Sarah Jenkins",
    spaceName: "Dedicated Desk D-02",
    checkInDate: "17 Sep 2026",
    checkInTime: "10:02 WITA",
    checkInBy: "Rian Hidayat (Manager Coworking)",
    durationFormatted: "Sedang Aktif (3j 45m)",
    status: "ACTIVE_IN",
  },
  {
    id: "chk-2",
    bookingCode: "BK-CWK-00188",
    guestName: "Bpk. Hendra Wijaya",
    spaceName: "Executive Glass Meeting Room",
    checkInDate: "16 Sep 2026",
    checkInTime: "14:00 WITA",
    checkInBy: "Rian Hidayat",
    checkoutDate: "16 Sep 2026",
    checkoutTime: "17:00 WITA",
    checkoutBy: "Rian Hidayat",
    durationFormatted: "3 Jam 00 Menit",
    status: "COMPLETED",
  },
];

export const INITIAL_VIRTUAL_OFFICES: VirtualOfficeApplication[] = [
  {
    id: "vo-1",
    registrationNumber: "VO-DAGO-2026-001",
    companyName: "PT Nusantara Inovasi Digital",
    applicantName: "Bpk. Rahmat Santoso",
    applicantPhone: "+62 812-8899-0011",
    applicantEmail: "rahmat@nusantaradigital.id",
    planName: "VO Enterprise (Lengkap + Domisili)",
    businessType: "Teknologi & Software Development",
    startDate: "01 Jan 2026",
    expiryDate: "01 Jan 2027",
    legalDocumentName: "Akta_Pendirian_NIB_PT_Nusantara.pdf",
    status: "ACTIVE",
    annualFee: 6500000,
    paymentStatus: "PAID",
    domicileLetterIssued: true,
    notes: "Surat Domisili Gedung Dago Working Space sudah diterbitkan dan disahkan kelurahan.",
  },
  {
    id: "vo-2",
    registrationNumber: "VO-DAGO-2026-002",
    companyName: "CV Bali Media Kreasi",
    applicantName: "Ibu Desak Ketut Putri",
    applicantPhone: "+62 819-3344-5566",
    applicantEmail: "desak.putri@balimediakreasi.com",
    planName: "VO Professional (Alamat + Kuota Meeting)",
    businessType: "Creative Agency & Branding",
    startDate: "15 Feb 2026",
    expiryDate: "15 Feb 2027",
    legalDocumentName: "NIB_KTP_Direktur_BaliMedia.pdf",
    status: "PENDING_APPROVAL",
    annualFee: 4200000,
    paymentStatus: "PAID",
    domicileLetterIssued: false,
    notes: "Menunggu verifikasi keabsahan NIB dan persetujuan Admin Dago.",
  },
  {
    id: "vo-3",
    registrationNumber: "VO-DAGO-2026-003",
    companyName: "PT Global Maritim Logistik",
    applicantName: "Bpk. Kevin Tanuwidjaja",
    applicantPhone: "+62 821-7788-9900",
    applicantEmail: "kevin@globalmaritim.co.id",
    planName: "VO Starter (Alamat Bisnis)",
    businessType: "Forwarding & Freight Logistics",
    startDate: "01 Mar 2026",
    expiryDate: "01 Mar 2027",
    legalDocumentName: "Akta_Perubahan_SK_Menkumham.pdf",
    status: "APPROVED",
    annualFee: 2900000,
    paymentStatus: "PAID",
    domicileLetterIssued: true,
    notes: "Disetujui. Mail handling service aktif.",
  },
];

interface CoworkingContextType {
  spaces: CoworkingSpaceItem[];
  bookings: typeof INITIAL_BOOKINGS;
  members: CoworkingMemberProfile[];
  checkLogs: CheckInOutLog[];
  virtualOffices: VirtualOfficeApplication[];
  bookSpace: (
    booking: Omit<typeof INITIAL_BOOKINGS[0], "id" | "bookingCode" | "checkInStatus" | "checkedInAt" | "checkedInBy">
  ) => typeof INITIAL_BOOKINGS[0];
  confirmBookingPayment: (bookingId: string, paymentMethod?: string) => void;
  cancelBooking: (bookingId: string) => void;
  checkInBooking: (bookingId: string) => void;
  checkoutSpace: (spaceIdOrBookingId: string) => void;
  addMember: (member: Omit<CoworkingMemberProfile, "id" | "memberId" | "paymentHistory">, payment: { amount: number; paymentMethod: string }) => void;
  createVirtualOffice: (data: Omit<VirtualOfficeApplication, "id" | "registrationNumber" | "status" | "domicileLetterIssued">) => void;
  approveVirtualOffice: (id: string) => void;
  rejectVirtualOffice: (id: string, reason?: string) => void;
  resetCoworkingData: () => void;
}

const CoworkingContext = createContext<CoworkingContextType | undefined>(undefined);

const STORAGE_KEY_SPACES = "dagoeng_cwk_spaces_v2";
const STORAGE_KEY_BOOKINGS = "dagoeng_cwk_bookings_v2";
const STORAGE_KEY_MEMBERS = "dagoeng_cwk_members_v2";
const STORAGE_KEY_LOGS = "dagoeng_cwk_logs_v2";

export function CoworkingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeOutletId, activeOutlet } = useOutlet();
  const { logActivity } = useActivityLog();
  const { addNotification } = useNotifications();

  const [spaces, setSpaces] = useState<CoworkingSpaceItem[]>(INITIAL_SPACES);
  const [bookings, setBookings] = useState<typeof INITIAL_BOOKINGS>(INITIAL_BOOKINGS);
  const [members, setMembers] = useState<CoworkingMemberProfile[]>(INITIAL_MEMBERSHIPS);
  const [checkLogs, setCheckLogs] = useState<CheckInOutLog[]>(INITIAL_CHECK_LOGS);
  const [virtualOffices, setVirtualOffices] = useState<VirtualOfficeApplication[]>(INITIAL_VIRTUAL_OFFICES);
  const [isInitialized, setIsInitialized] = useState(false);

  const STORAGE_KEY_VO = "dagoeng_cwk_vo_v2";

  useEffect(() => {
    try {
      const sSpaces = localStorage.getItem(STORAGE_KEY_SPACES);
      const sBookings = localStorage.getItem(STORAGE_KEY_BOOKINGS);
      const sMembers = localStorage.getItem(STORAGE_KEY_MEMBERS);
      const sLogs = localStorage.getItem(STORAGE_KEY_LOGS);
      const sVO = localStorage.getItem(STORAGE_KEY_VO);

      if (sSpaces) setSpaces(JSON.parse(sSpaces));
      if (sBookings) setBookings(JSON.parse(sBookings));
      if (sMembers) setMembers(JSON.parse(sMembers));
      if (sLogs) setCheckLogs(JSON.parse(sLogs));
      if (sVO) setVirtualOffices(JSON.parse(sVO));
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
      localStorage.setItem(STORAGE_KEY_VO, JSON.stringify(virtualOffices));
    } catch (e) {
      console.error("Failed to save coworking state", e);
    }
  }, [spaces, bookings, members, checkLogs, virtualOffices, isInitialized]);

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

  const createVirtualOffice = (
    data: Omit<VirtualOfficeApplication, "id" | "registrationNumber" | "status" | "domicileLetterIssued">
  ) => {
    const regNumber = `VO-DAGO-${new Date().getFullYear()}-${String(virtualOffices.length + 1).padStart(3, "0")}`;
    const newVO: VirtualOfficeApplication = {
      ...data,
      id: `vo-${Date.now()}`,
      registrationNumber: regNumber,
      status: "PENDING_APPROVAL",
      domicileLetterIssued: false,
    };

    setVirtualOffices((prev) => [newVO, ...prev]);

    addNotification({
      type: "PAYMENT_RECEIVED",
      title: "Pendaftaran Virtual Office Baru",
      detail: `Pendaftaran VO ${newVO.companyName} (${newVO.planName}) menunggu persetujuan Admin Gedung.`,
      relatedModule: "COWORKING",
      actionUrl: "/coworking",
      outletId: activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr",
      outletName: activeOutlet?.name || "Singaraja",
    });

    logActivity({
      module: "COWORKING",
      action: "CREATE_VIRTUAL_OFFICE",
      recordId: regNumber,
      newValue: `${newVO.companyName} (${newVO.planName})`,
      description: `Pendaftaran Virtual Office: ${newVO.companyName} (${regNumber})`,
      reason: "Pendaftaran online VO / Pengajuan legalitas",
      status: "SUCCESS",
    });
  };

  const approveVirtualOffice = (id: string) => {
    const vo = virtualOffices.find((v) => v.id === id);
    if (!vo) return;

    setVirtualOffices((prev) =>
      prev.map((v) =>
        v.id === id
          ? {
              ...v,
              status: "ACTIVE",
              domicileLetterIssued: true,
            }
          : v
      )
    );

    addNotification({
      type: "PAYMENT_RECEIVED",
      title: "Virtual Office Disetujui & Aktif",
      detail: `Aplikasi VO ${vo.companyName} (${vo.registrationNumber}) telah diverifikasi & Surat Domisili diterbitkan.`,
      relatedModule: "COWORKING",
      actionUrl: "/coworking",
      outletId: activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr",
      outletName: activeOutlet?.name || "Singaraja",
    });

    logActivity({
      module: "COWORKING",
      action: "APPROVE_VIRTUAL_OFFICE",
      recordId: vo.registrationNumber,
      previousValue: `Status: ${vo.status}`,
      newValue: "Status: ACTIVE (Domisili Terbit)",
      description: `Approval Virtual Office ${vo.companyName} oleh Admin Gedung Dago`,
      reason: "Verifikasi dokumen legalitas & Akta/NIB valid",
      status: "SUCCESS",
    });
  };

  const rejectVirtualOffice = (id: string, reason?: string) => {
    const vo = virtualOffices.find((v) => v.id === id);
    if (!vo) return;

    setVirtualOffices((prev) =>
      prev.map((v) =>
        v.id === id
          ? {
              ...v,
              status: "REJECTED",
              notes: reason || "Dokumen legalitas tidak memenuhi syarat.",
            }
          : v
      )
    );

    logActivity({
      module: "COWORKING",
      action: "REJECT_VIRTUAL_OFFICE",
      recordId: vo.registrationNumber,
      previousValue: `Status: ${vo.status}`,
      newValue: "Status: REJECTED",
      description: `Penolakan Virtual Office ${vo.companyName}`,
      reason: reason || "Dokumen tidak lengkap / tidak valid",
      status: "WARNING",
    });
  };

  const resetCoworkingData = () => {
    setSpaces(INITIAL_SPACES);
    setBookings(INITIAL_BOOKINGS);
    setMembers(INITIAL_MEMBERSHIPS);
    setCheckLogs(INITIAL_CHECK_LOGS);
    setVirtualOffices(INITIAL_VIRTUAL_OFFICES);
    try {
      localStorage.removeItem(STORAGE_KEY_SPACES);
      localStorage.removeItem(STORAGE_KEY_BOOKINGS);
      localStorage.removeItem(STORAGE_KEY_MEMBERS);
      localStorage.removeItem(STORAGE_KEY_LOGS);
      localStorage.removeItem(STORAGE_KEY_VO);
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
        virtualOffices,
        bookSpace,
        confirmBookingPayment,
        cancelBooking,
        checkInBooking,
        checkoutSpace,
        addMember,
        createVirtualOffice,
        approveVirtualOffice,
        rejectVirtualOffice,
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
