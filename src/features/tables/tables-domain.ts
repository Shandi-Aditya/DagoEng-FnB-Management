import type { StatusTone } from "@/components/app/status-badge";
import type { AreaItem, ScheduledReservation, TableItem } from "@/contexts/TableContext";

export interface TableSummary {
  totalTables: number;
  availableCount: number;
  occupiedCount: number;
  reservedCount: number;
  cleaningCount: number;
}

export function calculateTableSummary(areas: AreaItem[]): TableSummary {
  let totalTables = 0;
  let availableCount = 0;
  let occupiedCount = 0;
  let reservedCount = 0;
  let cleaningCount = 0;

  for (const area of areas) {
    for (const table of area.tables) {
      totalTables += 1;
      switch (table.status) {
        case "AVAILABLE":
          availableCount += 1;
          break;
        case "OCCUPIED":
          occupiedCount += 1;
          break;
        case "RESERVED":
          reservedCount += 1;
          break;
        case "CLEANING":
          cleaningCount += 1;
          break;
      }
    }
  }

  return {
    totalTables,
    availableCount,
    occupiedCount,
    reservedCount,
    cleaningCount,
  };
}

export function filterReservations(
  reservations: ScheduledReservation[],
  statusFilter: string,
  searchQuery: string
): ScheduledReservation[] {
  const query = searchQuery.toLowerCase().trim();

  return reservations.filter((r) => {
    const matchStatus = statusFilter === "ALL" || r.status === statusFilter;
    if (!matchStatus) return false;
    if (!query) return true;

    return (
      r.customerName.toLowerCase().includes(query) ||
      r.phone.includes(query) ||
      r.tableId.toLowerCase().includes(query)
    );
  });
}

export function tableStatusTone(status: TableItem["status"]): StatusTone {
  switch (status) {
    case "AVAILABLE":
      return "success";
    case "OCCUPIED":
      return "info";
    case "RESERVED":
    case "BILLING":
      return "warning";
    case "CLEANING":
      return "neutral";
    default:
      return "neutral";
  }
}

export function tableStatusLabel(status: TableItem["status"]): string {
  switch (status) {
    case "AVAILABLE":
      return "Tersedia";
    case "OCCUPIED":
      return "Terisi";
    case "RESERVED":
      return "Reservasi";
    case "BILLING":
      return "Menunggu bayar";
    case "CLEANING":
      return "Dibersihkan";
    default:
      return status;
  }
}

export function reservationStatusTone(status: ScheduledReservation["status"]): StatusTone {
  switch (status) {
    case "CONFIRMED":
      return "warning";
    case "SEATED":
      return "success";
    case "CANCELLED":
      return "destructive";
    default:
      return "neutral";
  }
}

export function reservationStatusLabel(status: ScheduledReservation["status"]): string {
  switch (status) {
    case "CONFIRMED":
      return "Menunggu";
    case "SEATED":
      return "Sudah duduk";
    case "CANCELLED":
      return "Dibatalkan";
    default:
      return status;
  }
}

export function getWitaDatePlusDays(daysAhead: number = 0, now: Date = new Date()): string {
  const todayWita = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  if (daysAhead === 0) return todayWita;
  const [y, m, d] = todayWita.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + daysAhead)).toISOString().slice(0, 10);
}

export function formatReservationDateTime(dateStr: string, timeStr: string): string {
  const todayStr = getWitaDatePlusDays(0);
  const tomorrowStr = getWitaDatePlusDays(1);

  let formattedDateLabel = "";
  if (dateStr === todayStr) {
    formattedDateLabel = "Hari ini";
  } else if (dateStr === tomorrowStr) {
    formattedDateLabel = "Besok";
  } else {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
      ? new Date(`${dateStr}T00:00:00+08:00`)
      : new Date(dateStr);
    formattedDateLabel = d.toLocaleDateString("id-ID", {
      timeZone: "Asia/Makassar",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return `${formattedDateLabel}, ${timeStr} WITA`;
}

export type ReservationQueueId = "ALL" | "CONFIRMED" | "SEATED" | "CANCELLED";

export interface ReservationQueueItem {
  id: ReservationQueueId;
  label: string;
}

export const RESERVATION_QUEUES: readonly ReservationQueueItem[] = [
  { id: "ALL", label: "Semua" },
  { id: "CONFIRMED", label: "Menunggu" },
  { id: "SEATED", label: "Sudah duduk" },
  { id: "CANCELLED", label: "Dibatalkan" },
];

export function countReservationsByStatus(
  reservations: readonly ScheduledReservation[]
): Record<ReservationQueueId, number> {
  const counts: Record<ReservationQueueId, number> = {
    ALL: reservations.length,
    CONFIRMED: 0,
    SEATED: 0,
    CANCELLED: 0,
  };

  for (const r of reservations) {
    if (r.status === "CONFIRMED") counts.CONFIRMED += 1;
    else if (r.status === "SEATED") counts.SEATED += 1;
    else if (r.status === "CANCELLED") counts.CANCELLED += 1;
  }

  return counts;
}

const EMPTY_RESERVATION_COPY: Record<ReservationQueueId, { title: string; description: string }> = {
  ALL: {
    title: "Belum ada reservasi",
    description: "Reservasi tamu yang dibuat akan tercatat di sini.",
  },
  CONFIRMED: {
    title: "Tidak ada reservasi menunggu",
    description: "Semua tamu reservasi sudah duduk atau belum ada pesanan baru.",
  },
  SEATED: {
    title: "Belum ada tamu reservasi yang duduk",
    description: "Tamu yang sudah didudukkan akan tercatat di sini.",
  },
  CANCELLED: {
    title: "Tidak ada reservasi batal",
    description: "Daftar pembatalan reservasi akan tercatat di sini.",
  },
};

export function emptyReservationsMessage(
  statusFilter: string,
  hasSearch: boolean
): { title: string; description: string } {
  if (hasSearch) {
    return {
      title: "Tidak ada reservasi yang cocok",
      description: "Ubah kata kunci pencarian atau pilih filter status lain.",
    };
  }

  const queueKey = (statusFilter in EMPTY_RESERVATION_COPY ? statusFilter : "ALL") as ReservationQueueId;
  return EMPTY_RESERVATION_COPY[queueKey];
}

/**
 * Validates whether a table is ready to accept a reservation of a given party size.
 * A table must be in AVAILABLE status and its capacity must be >= requiredPax.
 */
export function isTableAvailableForPax(
  table: TableItem,
  requiredPax: number
): boolean {
  if (table.status !== "AVAILABLE") return false;
  return table.cap >= requiredPax;
}

