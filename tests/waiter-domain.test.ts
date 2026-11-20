import { describe, it, expect } from "vitest";
import {
  getTableStatusDisplay,
  getTableLifecycleAction,
  filterTablesByArea,
  calculateWaiterFloorSummary,
  formatKitchenPrepStatus,
  findActiveOrderForTable,
} from "@/features/waiter/waiter-domain";
import type { TableItem, TableStatus } from "@/contexts/TableContext";
import type { OrderRecord } from "@/types/order";

describe("waiter-domain", () => {
  const sampleTables: TableItem[] = [
    { id: "tbl-1", number: "Meja 1", cap: 2, status: "AVAILABLE", outletId: "outlet-sgr", outletName: "Singaraja" },
    { id: "tbl-2", number: "Meja 2", cap: 4, status: "OCCUPIED", outletId: "outlet-sgr", outletName: "Singaraja", customer: "Budi", total: "Rp 120.000" },
    { id: "tbl-3", number: "Meja 3", cap: 4, status: "BILLING", outletId: "outlet-sgr", outletName: "Singaraja", customer: "Siti", total: "Rp 85.000" },
    { id: "tbl-4", number: "Meja 4", cap: 6, status: "CLEANING", outletId: "outlet-sgr", outletName: "Singaraja" },
    { id: "tbl-5", number: "Meja 5", cap: 2, status: "RESERVED", outletId: "outlet-sgr", outletName: "Singaraja", customer: "Pak Made" },
  ];

  it("returns humanized table status label and tone", () => {
    expect(getTableStatusDisplay("AVAILABLE")).toEqual({ label: "Tersedia", tone: "neutral" });
    expect(getTableStatusDisplay("OCCUPIED")).toEqual({ label: "Terisi", tone: "destructive" });
    expect(getTableStatusDisplay("BILLING")).toEqual({ label: "Menunggu tagihan", tone: "warning" });
    expect(getTableStatusDisplay("CLEANING")).toEqual({ label: "Dibersihkan", tone: "info" });
    expect(getTableStatusDisplay("RESERVED")).toEqual({ label: "Reservasi", tone: "warning" });
  });

  it("determines deterministic next lifecycle step for waiter table flow", () => {
    expect(getTableLifecycleAction("AVAILABLE")).toEqual({
      nextStatus: "OCCUPIED",
      label: "Dudukkan tamu",
      variant: "default",
    });

    expect(getTableLifecycleAction("RESERVED")).toEqual({
      nextStatus: "OCCUPIED",
      label: "Dudukkan tamu reservasi",
      variant: "default",
    });

    expect(getTableLifecycleAction("OCCUPIED")).toEqual({
      nextStatus: "BILLING",
      label: "Minta tagihan",
      variant: "outline",
    });

    expect(getTableLifecycleAction("BILLING")).toEqual({
      nextStatus: "CLEANING",
      label: "Tandai meja dibersihkan",
      variant: "outline",
    });

    expect(getTableLifecycleAction("CLEANING")).toEqual({
      nextStatus: "AVAILABLE",
      label: "Selesai dibersihkan",
      variant: "default",
    });
  });

  it("calculates floor summary metrics correctly", () => {
    const summary = calculateWaiterFloorSummary(sampleTables);
    expect(summary).toEqual({
      total: 5,
      available: 1,
      occupied: 1,
      billing: 1,
      cleaning: 1,
      reserved: 1,
    });
  });

  it("filters tables strictly for specified area", () => {
    const areaIndoorTables: TableItem[] = [sampleTables[0], sampleTables[1]];
    const areaOutdoorTables: TableItem[] = [sampleTables[2], sampleTables[3], sampleTables[4]];

    const areas = [
      { id: "area-indoor", name: "Indoor", tables: areaIndoorTables },
      { id: "area-outdoor", name: "Outdoor", tables: areaOutdoorTables },
    ];

    expect(filterTablesByArea(areas, "ALL")).toHaveLength(5);
    expect(filterTablesByArea(areas, "area-indoor")).toHaveLength(2);
    expect(filterTablesByArea(areas, "area-outdoor")).toHaveLength(3);
    expect(filterTablesByArea(areas, "unknown")).toHaveLength(0);
  });

  it("formats kitchen preparation status nicely", () => {
    expect(formatKitchenPrepStatus("COOKING")).toEqual({ label: "Dimasak", tone: "warning" });
    expect(formatKitchenPrepStatus("READY")).toEqual({ label: "Siap saji", tone: "success" });
    expect(formatKitchenPrepStatus("CONFIRMED")).toEqual({ label: "Antre", tone: "info" });
    expect(formatKitchenPrepStatus("COMPLETED")).toEqual({ label: "Selesai", tone: "neutral" });
    expect(formatKitchenPrepStatus(undefined)).toEqual({ label: "Diproses", tone: "neutral" });
  });

  it("finds active non-completed order for given table", () => {
    const orders: OrderRecord[] = [
      {
        id: "ord-1",
        orderNumber: "ORD-1",
        organizationId: "org-dago-hub",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        tableNumber: "Meja 2",
        customerName: "Budi",
        orderType: "DINE_IN",
        status: "COOKING",
        items: [{ id: "it-1", productName: "Kopi Dago", quantity: 2, unitPrice: 25000, tenantId: "t-1" }],
        subtotal: 50000,
        tax: 0,
        total: 50000,
        paymentStatus: "PAID",
        paymentMethod: "CASH",
        targetServiceMinutes: 15,
        statusHistory: [],
        createdAt: "2026-11-15T00:00:00Z",
      },
      {
        id: "ord-2",
        orderNumber: "ORD-2",
        organizationId: "org-dago-hub",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        tableNumber: "Meja 1",
        customerName: "Siti",
        orderType: "DINE_IN",
        status: "COMPLETED",
        items: [],
        subtotal: 0,
        tax: 0,
        total: 0,
        paymentStatus: "PAID",
        paymentMethod: "CASH",
        targetServiceMinutes: 15,
        statusHistory: [],
        createdAt: "2026-11-15T00:00:00Z",
      },
    ];

    expect(findActiveOrderForTable(orders, "Meja 2", "tbl-2", "outlet-sgr")?.id).toBe("ord-1");
    // Completed order is ignored
    expect(findActiveOrderForTable(orders, "Meja 1", "tbl-1", "outlet-sgr")).toBeUndefined();
    // Non-existent table
    expect(findActiveOrderForTable(orders, "Meja 99", "tbl-99", "outlet-sgr")).toBeUndefined();
  });
});
