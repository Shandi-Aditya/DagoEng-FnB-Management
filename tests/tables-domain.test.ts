import { describe, expect, it } from "vitest";

import {
  calculateTableSummary,
  countReservationsByStatus,
  emptyReservationsMessage,
  filterReservations,
  formatReservationDateTime,
  isTableAvailableForPax,
  reservationStatusLabel,
  reservationStatusTone,
  tableStatusLabel,
  tableStatusTone,
} from "@/features/tables/tables-domain";
import type { AreaItem, ScheduledReservation, TableItem } from "@/contexts/TableContext";

function makeTable(id: string, status: TableItem["status"] = "AVAILABLE", cap = 4): TableItem {
  return {
    id,
    number: `T-${id}`,
    cap,
    status,
  };
}

function makeArea(id: string, name: string, tables: TableItem[]): AreaItem {
  return {
    id,
    name,
    tables,
  };
}

function makeReservation(id: string, overrides: Partial<ScheduledReservation> = {}): ScheduledReservation {
  return {
    id,
    customerName: "Ibu Maya",
    phone: "08123456789",
    tableId: "T-01",
    areaName: "Indoor AC",
    outletId: "outlet-sgr",
    dateTime: "Hari ini, 19:00 WITA",
    pax: 4,
    downPayment: 100000,
    status: "CONFIRMED",
    ...overrides,
  };
}

describe("calculateTableSummary", () => {
  it("computes counts across multiple areas", () => {
    const areas = [
      makeArea("area-1", "Indoor", [
        makeTable("1", "AVAILABLE"),
        makeTable("2", "OCCUPIED"),
      ]),
      makeArea("area-2", "Outdoor", [
        makeTable("3", "RESERVED"),
        makeTable("4", "CLEANING"),
        makeTable("5", "AVAILABLE"),
      ]),
    ];

    const summary = calculateTableSummary(areas);
    expect(summary.totalTables).toBe(5);
    expect(summary.availableCount).toBe(2);
    expect(summary.occupiedCount).toBe(1);
    expect(summary.reservedCount).toBe(1);
    expect(summary.cleaningCount).toBe(1);
  });
});

describe("filterReservations", () => {
  it("filters by status and search query across customer, phone, and table", () => {
    const reservations = [
      makeReservation("1", { customerName: "Budi Santoso", status: "CONFIRMED" }),
      makeReservation("2", { customerName: "Siti Rahma", status: "SEATED", phone: "08991122" }),
      makeReservation("3", { customerName: "Andi Wijaya", status: "CANCELLED", tableId: "T-09" }),
    ];

    expect(filterReservations(reservations, "ALL", "")).toHaveLength(3);
    expect(filterReservations(reservations, "CONFIRMED", "")).toHaveLength(1);
    expect(filterReservations(reservations, "ALL", "siti")).toHaveLength(1);
    expect(filterReservations(reservations, "ALL", "08991122")).toHaveLength(1);
    expect(filterReservations(reservations, "ALL", "T-09")).toHaveLength(1);
  });
});

describe("tableStatusTone and tableStatusLabel", () => {
  it("maps table statuses to semantic tones and human labels", () => {
    expect(tableStatusTone("AVAILABLE")).toBe("success");
    expect(tableStatusTone("OCCUPIED")).toBe("info");
    expect(tableStatusTone("RESERVED")).toBe("warning");
    expect(tableStatusTone("CLEANING")).toBe("neutral");

    expect(tableStatusLabel("AVAILABLE")).toBe("Tersedia");
    expect(tableStatusLabel("OCCUPIED")).toBe("Terisi");
    expect(tableStatusLabel("RESERVED")).toBe("Reservasi");
    expect(tableStatusLabel("BILLING")).toBe("Menunggu bayar");
    expect(tableStatusLabel("CLEANING")).toBe("Dibersihkan");
  });
});

describe("reservationStatusTone and reservationStatusLabel", () => {
  it("maps reservation statuses to semantic tones and labels", () => {
    expect(reservationStatusTone("CONFIRMED")).toBe("warning");
    expect(reservationStatusTone("SEATED")).toBe("success");
    expect(reservationStatusTone("CANCELLED")).toBe("destructive");

    expect(reservationStatusLabel("CONFIRMED")).toBe("Menunggu");
    expect(reservationStatusLabel("SEATED")).toBe("Sudah duduk");
    expect(reservationStatusLabel("CANCELLED")).toBe("Dibatalkan");
  });
});

describe("formatReservationDateTime", () => {
  it("formats today, tomorrow and explicit dates with WITA time", () => {
    const today = new Date().toISOString().split("T")[0];
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = tomorrowDate.toISOString().split("T")[0];

    expect(formatReservationDateTime(today, "19:00")).toBe("Hari ini, 19:00 WITA");
    expect(formatReservationDateTime(tomorrow, "20:00")).toBe("Besok, 20:00 WITA");
  });
});

describe("countReservationsByStatus", () => {
  it("counts reservations by status including total ALL count", () => {
    const reservations = [
      makeReservation("1", { status: "CONFIRMED" }),
      makeReservation("2", { status: "CONFIRMED" }),
      makeReservation("3", { status: "SEATED" }),
      makeReservation("4", { status: "CANCELLED" }),
    ];

    const counts = countReservationsByStatus(reservations);
    expect(counts.ALL).toBe(4);
    expect(counts.CONFIRMED).toBe(2);
    expect(counts.SEATED).toBe(1);
    expect(counts.CANCELLED).toBe(1);
  });

  it("returns zero counts for empty array", () => {
    const counts = countReservationsByStatus([]);
    expect(counts.ALL).toBe(0);
    expect(counts.CONFIRMED).toBe(0);
    expect(counts.SEATED).toBe(0);
    expect(counts.CANCELLED).toBe(0);
  });
});

describe("emptyReservationsMessage", () => {
  it("returns search-specific copy when query is active", () => {
    const msg = emptyReservationsMessage("CONFIRMED", true);
    expect(msg.title).toBe("Tidak ada reservasi yang cocok");
    expect(msg.description).toContain("Ubah kata kunci");
  });

  it("returns specific copy when a status queue is empty without search", () => {
    const confirmedMsg = emptyReservationsMessage("CONFIRMED", false);
    expect(confirmedMsg.title).toBe("Tidak ada reservasi menunggu");

    const allMsg = emptyReservationsMessage("ALL", false);
    expect(allMsg.title).toBe("Belum ada reservasi");
  });
});

describe("isTableAvailableForPax", () => {
  it("validates that a table is in AVAILABLE status and has sufficient capacity", () => {
    const tableAvailable4 = makeTable("1", "AVAILABLE", 4);
    const tableOccupied4 = makeTable("2", "OCCUPIED", 4);
    const tableReserved2 = makeTable("3", "RESERVED", 2);

    expect(isTableAvailableForPax(tableAvailable4, 2)).toBe(true);
    expect(isTableAvailableForPax(tableAvailable4, 4)).toBe(true);
    expect(isTableAvailableForPax(tableAvailable4, 5)).toBe(false);
    expect(isTableAvailableForPax(tableOccupied4, 2)).toBe(false);
    expect(isTableAvailableForPax(tableReserved2, 2)).toBe(false);
  });
});
