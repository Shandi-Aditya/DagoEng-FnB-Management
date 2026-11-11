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
    case "CLEANING":
      return "Pembersihan";
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
      return "Sudah Duduk";
    case "CANCELLED":
      return "Dibatalkan";
    default:
      return status;
  }
}

export function formatReservationDateTime(dateStr: string, timeStr: string): string {
  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  let formattedDateLabel = "";
  if (dateStr === todayStr) {
    formattedDateLabel = "Hari Ini";
  } else if (dateStr === tomorrowStr) {
    formattedDateLabel = "Besok";
  } else {
    const d = new Date(dateStr);
    formattedDateLabel = d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return `${formattedDateLabel}, ${timeStr} WITA`;
}
