import { describe, expect, it } from "vitest";

import {
  calculateTableSummary,
  filterReservations,
  formatReservationDateTime,
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
    dateTime: "Hari Ini, 19:00 WITA",
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
    expect(tableStatusLabel("CLEANING")).toBe("Pembersihan");
  });
});

describe("reservationStatusTone and reservationStatusLabel", () => {
  it("maps reservation statuses to semantic tones and labels", () => {
    expect(reservationStatusTone("CONFIRMED")).toBe("warning");
    expect(reservationStatusTone("SEATED")).toBe("success");
    expect(reservationStatusTone("CANCELLED")).toBe("destructive");

    expect(reservationStatusLabel("CONFIRMED")).toBe("Menunggu");
    expect(reservationStatusLabel("SEATED")).toBe("Sudah Duduk");
    expect(reservationStatusLabel("CANCELLED")).toBe("Dibatalkan");
  });
});

describe("formatReservationDateTime", () => {
  it("formats today, tomorrow and explicit dates with WITA time", () => {
    const today = new Date().toISOString().split("T")[0];
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = tomorrowDate.toISOString().split("T")[0];

    expect(formatReservationDateTime(today, "19:00")).toBe("Hari Ini, 19:00 WITA");
    expect(formatReservationDateTime(tomorrow, "20:00")).toBe("Besok, 20:00 WITA");
  });
});
