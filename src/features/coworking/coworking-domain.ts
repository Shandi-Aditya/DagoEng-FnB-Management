import type {
  CoworkingSpaceItem,
  CoworkingBooking,
  CoworkingMember,
  SpaceStatus,
} from "@/types/coworking";
import type { StatusTone } from "@/components/app/status-badge";

export interface CoworkingKPIs {
  totalSpaces: number;
  availableSpaces: number;
  occupiedSpaces: number;
  activeMembers: number;
}

export type DailyPreset = "1_DAY" | "3_DAYS" | "7_DAYS" | "14_DAYS" | "CUSTOM_RANGE";

/**
 * Returns a date string (YYYY-MM-DD) formatted in WITA timezone (Asia/Makassar, UTC+8).
 */
export function getTodayWitaDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function calculateCoworkingKPIs(
  spaces: CoworkingSpaceItem[],
  members: CoworkingMember[]
): CoworkingKPIs {
  const totalSpaces = spaces.length;
  let availableSpaces = 0;
  let occupiedSpaces = 0;

  for (const s of spaces) {
    if (s.status === "AVAILABLE") {
      availableSpaces += 1;
    } else if (s.status === "OCCUPIED") {
      occupiedSpaces += 1;
    }
  }

  const activeMembers = members.filter((m) => m.status === "ACTIVE").length;

  return {
    totalSpaces,
    availableSpaces,
    occupiedSpaces,
    activeMembers,
  };
}

export function calculateDaysCount(start: string, end: string): number {
  if (!start || !end) return 1;
  const s = new Date(start);
  const e = new Date(end);
  const diffTime = e.getTime() - s.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, isNaN(diffDays) ? 1 : diffDays);
}

export function calculateHourlyEndTime(startTime: string, hours: number): string {
  const [h, m] = (startTime || "09:00").split(":").map(Number);
  const endH = Math.min(23, (h || 9) + (hours || 2));
  return `${endH.toString().padStart(2, "0")}:${(m || 0).toString().padStart(2, "0")}`;
}

export function computeBookingPricing(params: {
  space: CoworkingSpaceItem;
  bookType: "HOURLY" | "DAILY" | "MONTHLY";
  durationHours: number;
  dailyPreset: DailyPreset;
  startDate: string;
  endDate: string;
  startTime: string;
}): {
  computedDuration: number;
  computedTotal: number;
  computedEndDate?: string;
  computedEndTime: string;
} {
  const { space, bookType, durationHours, dailyPreset, startDate, endDate, startTime } = params;

  if (bookType === "HOURLY") {
    const computedDuration = Math.max(2, Number(durationHours) || 2);
    const computedTotal = (space.hourlyRate || 0) * computedDuration;
    const computedEndTime = `${calculateHourlyEndTime(startTime, computedDuration)} WITA`;
    return {
      computedDuration,
      computedTotal,
      computedEndDate: startDate,
      computedEndTime,
    };
  }

  if (bookType === "DAILY") {
    let computedDuration = 1;
    let computedEndDate = startDate;

    if (dailyPreset === "1_DAY") {
      computedDuration = 1;
      computedEndDate = startDate;
    } else if (dailyPreset === "3_DAYS") {
      computedDuration = 3;
      const d = new Date(startDate);
      d.setDate(d.getDate() + 2);
      computedEndDate = d.toISOString().split("T")[0];
    } else if (dailyPreset === "7_DAYS") {
      computedDuration = 7;
      const d = new Date(startDate);
      d.setDate(d.getDate() + 6);
      computedEndDate = d.toISOString().split("T")[0];
    } else if (dailyPreset === "14_DAYS") {
      computedDuration = 14;
      const d = new Date(startDate);
      d.setDate(d.getDate() + 13);
      computedEndDate = d.toISOString().split("T")[0];
    } else {
      computedDuration = calculateDaysCount(startDate, endDate);
      computedEndDate = endDate;
    }

    const computedTotal = (space.dailyRate || 0) * computedDuration;
    return {
      computedDuration,
      computedTotal,
      computedEndDate,
      computedEndTime: "18:00 WITA",
    };
  }

  // MONTHLY
  const computedDuration = 30;
  const d = new Date(startDate);
  d.setDate(d.getDate() + 29);
  const computedEndDate = d.toISOString().split("T")[0];
  const computedTotal = space.monthlyRate || (space.dailyRate || 0) * 20;

  return {
    computedDuration,
    computedTotal,
    computedEndDate,
    computedEndTime: "Akses Penuh 30 Hari",
  };
}

export function filterCoworkingMembers(
  members: CoworkingMember[],
  statusFilter: "ALL" | "ACTIVE" | "EXPIRED",
  query: string
): CoworkingMember[] {
  const q = query.trim().toLowerCase();

  return members.filter((m) => {
    const matchStatus = statusFilter === "ALL" || m.status === statusFilter;
    const matchQuery =
      !q ||
      m.name.toLowerCase().includes(q) ||
      m.contact.includes(q) ||
      m.memberId.toLowerCase().includes(q) ||
      m.packageName.toLowerCase().includes(q);
    return matchStatus && matchQuery;
  });
}

export function filterCoworkingBookings(
  bookings: readonly CoworkingBooking[],
  statusFilter: string,
  query: string
): CoworkingBooking[] {
  const q = query.trim().toLowerCase();

  return bookings.filter((b) => {
    const matchStatus = statusFilter === "ALL" || b.checkInStatus === statusFilter;
    const matchQuery =
      !q ||
      b.guestName.toLowerCase().includes(q) ||
      Boolean(b.bookingCode && b.bookingCode.toLowerCase().includes(q)) ||
      Boolean(b.guestPhone && b.guestPhone.includes(q)) ||
      Boolean(b.spaceName && b.spaceName.toLowerCase().includes(q));
    return matchStatus && matchQuery;
  });
}

export function getSpaceStatusTone(status: SpaceStatus): StatusTone {
  switch (status) {
    case "AVAILABLE":
      return "success";
    case "OCCUPIED":
      return "info";
    case "RESERVED":
      return "warning";
    case "MAINTENANCE":
    default:
      return "destructive";
  }
}

export function getBookingCheckInTone(checkInStatus: string): StatusTone {
  switch (checkInStatus) {
    case "CHECKED_IN":
      return "info";
    case "RESERVED":
      return "warning";
    case "COMPLETED":
      return "neutral";
    case "CANCELLED":
    default:
      return "destructive";
  }
}

export function getMemberStatusTone(status: "ACTIVE" | "EXPIRED"): StatusTone {
  return status === "ACTIVE" ? "success" : "destructive";
}

export function buildCoworkingExportData(
  activeTab: "SPACES" | "BOOKINGS" | "MEMBERS" | "LOGS",
  bookings: CoworkingBooking[],
  members: CoworkingMember[],
  outletName: string
) {
  if (activeTab === "MEMBERS") {
    const headers = [
      "Member ID",
      "Nama Member",
      "No. WhatsApp / HP",
      "Email",
      "Paket Membership",
      "Tanggal Mulai",
      "Tanggal Berakhir",
      "Total Transaksi (Rp)",
      "Status",
    ];
    const rows = members.map((m) => [
      m.memberId,
      m.name,
      m.contact,
      m.email,
      m.packageName,
      m.startDate,
      m.expiryDate,
      `Rp ${(m.totalSpent || 0).toLocaleString("id-ID")}`,
      m.status,
    ]);
    return {
      filename: `Member_Coworking_${outletName}`,
      sheet: "Member Coworking",
      headers,
      rows,
    };
  }

  const headers = [
    "ID Booking",
    "Nama Tamu",
    "No. WhatsApp",
    "Ruang / Meja",
    "Tipe Sewa",
    "Durasi",
    "Total Tagihan (Rp)",
    "Metode Pembayaran",
    "Status Sesi",
    "Waktu Check-In",
  ];
  const rows = bookings.map((b) => [
    b.bookingCode || b.id,
    b.guestName,
    b.guestPhone,
    b.spaceName,
    b.bookingType,
    `${b.duration} ${b.bookingType === "HOURLY" ? "Jam" : b.bookingType === "DAILY" ? "Hari" : "Bulan"}`,
    `Rp ${(b.totalAmount || 0).toLocaleString("id-ID")}`,
    b.paymentStatus || "PAID",
    b.checkInStatus,
    `${b.date} ${b.startTime}`,
  ]);
  return {
    filename: `Booking_Coworking_${outletName}`,
    sheet: "Booking & Okupansi",
    headers,
    rows,
  };
}

const SPACE_TYPE_LABELS: Record<string, string> = {
  HOT_DESK: "Hot desk",
  PRIVATE_POD: "Pod privat",
  MEETING_ROOM: "Ruang rapat",
  DEDICATED_DESK: "Meja khusus",
  EVENT_SPACE: "Ruang acara",
};

export function spaceTypeLabel(type: string): string {
  return SPACE_TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}

const CHECK_IN_STATUS_LABELS: Record<string, string> = {
  CHECKED_IN: "Sedang aktif",
  RESERVED: "Menunggu",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

export function bookingCheckInStatusLabel(status: string): string {
  return CHECK_IN_STATUS_LABELS[status] ?? status;
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PAID: "Lunas",
  UNPAID: "Menunggu bayar",
  PARTIAL: "Sebagian",
  REFUNDED: "Dikembalikan",
};

export function bookingPaymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABELS[status] ?? status;
}

const EMPTY_COWORKING_COPY: Record<string, { empty: { title: string; description: string }; filtered: { title: string; description: string } }> = {
  SPACES: {
    empty: {
      title: "Belum ada ruang",
      description: "Tambahkan ruang kerja baru melalui menu Pengaturan.",
    },
    filtered: {
      title: "Tidak ada ruang yang cocok",
      description: "Ubah kata kunci pencarian atau pilih filter status lain.",
    },
  },
  BOOKINGS: {
    empty: {
      title: "Belum ada booking",
      description: "Pemesanan ruang baru yang dibuat akan tercatat di sini.",
    },
    filtered: {
      title: "Tidak ada booking yang cocok",
      description: "Ubah kata kunci pencarian atau pilih filter status lain.",
    },
  },
  MEMBERS: {
    empty: {
      title: "Belum ada member",
      description: "Daftarkan pelanggan tetap sebagai member co-working.",
    },
    filtered: {
      title: "Tidak ada member yang cocok",
      description: "Ubah kata kunci pencarian atau pilih status member lain.",
    },
  },
  LOGS: {
    empty: {
      title: "Belum ada aktivitas",
      description: "Aktivitas check-in dan check-out tamu akan tercatat di sini.",
    },
    filtered: {
      title: "Tidak ada aktivitas yang cocok",
      description: "Ubah kata kunci pencarian atau rentang tanggal.",
    },
  },
};

export function emptyCoworkingMessage(
  tab: string,
  hasFilter: boolean
): { title: string; description: string } {
  const item = EMPTY_COWORKING_COPY[tab] ?? EMPTY_COWORKING_COPY.SPACES;
  return hasFilter ? item.filtered : item.empty;
}

/**
 * Validates whether a coworking space/desk is currently available for new walk-in or booking.
 * Returns true only if status is AVAILABLE and no active session is attached.
 */
export function isSpaceAvailableNow(space: CoworkingSpaceItem): boolean {
  return space.status === "AVAILABLE" && !space.currentSession;
}

