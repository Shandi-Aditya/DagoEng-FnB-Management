import type { CoworkingBooking, CoworkingMember, CoworkingSpace } from "@/types/coworking";
import type { StatusTone } from "@/components/app/status-badge";

export interface CoworkingReportPdfMetrics {
  totalRevenue: number;
  activeBookingsCount: number;
  occupiedSpacesCount: number;
  occupancyPercent: number;
  totalSpaces: number;
  totalMembers: number;
}

export interface CoworkingReportSignatory {
  role: string;
  name: string;
  outlet: string;
}

export interface CoworkingReportSignatories {
  staff: CoworkingReportSignatory;
  supervisor: CoworkingReportSignatory;
  approver: CoworkingReportSignatory;
}

/**
 * Menghitung metrik ringkasan eksekutif okupansi & pendapatan co-working secara murni tanpa mutasi.
 */
export function computeCoworkingReportPdfMetrics(
  spaces: readonly CoworkingSpace[],
  bookings: readonly CoworkingBooking[],
  members: readonly CoworkingMember[]
): CoworkingReportPdfMetrics {
  let totalRevenue = 0;
  let activeBookingsCount = 0;

  for (const b of bookings) {
    totalRevenue += b.totalAmount || 0;
    if (b.checkInStatus === "CHECKED_IN" || b.checkInStatus === "RESERVED") {
      activeBookingsCount++;
    }
  }

  let occupiedSpacesCount = 0;
  for (const s of spaces) {
    if (s.status === "OCCUPIED") {
      occupiedSpacesCount++;
    }
  }

  const occupancyPercent =
    spaces.length > 0 ? Math.round((occupiedSpacesCount / spaces.length) * 100) : 0;

  return {
    totalRevenue,
    activeBookingsCount,
    occupiedSpacesCount,
    occupancyPercent,
    totalSpaces: spaces.length,
    totalMembers: members.length,
  };
}

/**
 * Menghasilkan nomor dokumen laporan co-working yang deterministik dan dapat diaudit.
 */
export function buildCoworkingReportDocNumber(date: Date, totalCount: number): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `REP-CWK-${year}${month}${day}-${totalCount}`;
}

/**
 * Membangun struktur 3 pihak penandatangan otorisasi akuntabilitas operasional co-working.
 */
export function buildCoworkingReportSignatories(
  outletName?: string
): CoworkingReportSignatories {
  const outlet = outletName || "Singaraja (Pusat)";

  return {
    staff: {
      role: "Front Office & Kasir Co-working",
      name: "Staf Layanan Tamu",
      outlet,
    },
    supervisor: {
      role: "Supervisor Ruang & Fasilitas",
      name: `Supervisor Gerai ${outlet}`,
      outlet,
    },
    approver: {
      role: "Pimpinan / Owner Gerai",
      name: `Pimpinan / Owner ${outlet}`,
      outlet,
    },
  };
}

/**
 * Memformat tanggal cetak dokumen sesuai konvensi resmi Indonesia (WITA).
 */
export function formatCoworkingReportPrintDate(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Makassar",
  }).format(date);
}

/**
 * Memformat durasi sewa ke bahasa Indonesia.
 */
export function formatCoworkingDurationLabel(duration: number, bookingType: string): string {
  switch (bookingType) {
    case "HOURLY":
      return `${duration} jam`;
    case "DAILY":
      return `${duration} hari`;
    case "MONTHLY":
      return duration === 30 ? "1 bulan" : `${duration} bulan`;
    default:
      return `${duration} sesi`;
  }
}

/**
 * Menerjemahkan status check-in / reservasi ke bahasa Indonesia baku.
 */
export function formatCoworkingCheckInStatusLabel(status: string): string {
  switch (status) {
    case "CHECKED_IN":
      return "Sedang digunakan";
    case "RESERVED":
      return "Dipesan";
    case "COMPLETED":
      return "Selesai";
    case "CANCELLED":
      return "Dibatalkan";
    default:
      return status;
  }
}

/**
 * Memetakan status reservasi ke status tone semantik.
 */
export function formatCoworkingCheckInStatusTone(status: string): StatusTone {
  switch (status) {
    case "CHECKED_IN":
      return "success";
    case "RESERVED":
      return "info";
    case "COMPLETED":
      return "neutral";
    case "CANCELLED":
      return "destructive";
    default:
      return "neutral";
  }
}
