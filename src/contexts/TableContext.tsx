"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useOutlet } from "./OutletContext";
import { useActivityLog } from "./ActivityLogContext";

export type TableStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "BILLING" | "CLEANING";

export interface TableItem {
  id: string;
  number: string;
  cap: number;
  status: TableStatus;
  outletId: string;
  outletName: string;
  customer?: string;
  total?: string;
  time?: string;
  itemsCount?: number;
  activeOrderId?: string;
  paymentStatus?: "UNPAID" | "PAID";
}

export interface AreaItem {
  id: string;
  name: string;
  outletId: string;
  outletName: string;
  tables: TableItem[];
}

export interface ScheduledReservation {
  id: string;
  customerName: string;
  phone: string;
  tableId: string;
  areaName: string;
  outletId: string;
  outletName: string;
  dateTime: string;
  pax: number;
  downPayment: number;
  notes?: string;
  status: "CONFIRMED" | "SEATED" | "CANCELLED" | "COMPLETED";
}

export const INITIAL_AREAS: AreaItem[] = [
  // 1. Outlet Singaraja (KS-SGR)
  {
    id: "area-sgr-1",
    name: "Indoor AC Main Hall",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    tables: [
      { id: "T-01", number: "T-01", cap: 2, status: "OCCUPIED", outletId: "outlet-sgr", outletName: "Singaraja", customer: "Budi Santoso", total: "Rp 165.000", time: "25 mnt", itemsCount: 3, paymentStatus: "PAID" },
      { id: "T-02", number: "T-02", cap: 4, status: "AVAILABLE", outletId: "outlet-sgr", outletName: "Singaraja" },
      { id: "T-03", number: "T-03", cap: 4, status: "OCCUPIED", outletId: "outlet-sgr", outletName: "Singaraja", customer: "Ketut Dian", total: "Rp 83.600", time: "10 mnt", itemsCount: 3, paymentStatus: "PAID" },
      { id: "T-04", number: "T-04", cap: 6, status: "AVAILABLE", outletId: "outlet-sgr", outletName: "Singaraja" },
      { id: "VIP-01", number: "VIP-01", cap: 8, status: "RESERVED", outletId: "outlet-sgr", outletName: "Singaraja", customer: "Bpk. Hendra (Meeting)", time: "18:30 WITA" },
    ],
  },
  {
    id: "area-sgr-2",
    name: "Outdoor Tropical Garden",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    tables: [
      { id: "OUT-01", number: "OUT-01", cap: 4, status: "AVAILABLE", outletId: "outlet-sgr", outletName: "Singaraja" },
      { id: "OUT-02", number: "OUT-02", cap: 6, status: "OCCUPIED", outletId: "outlet-sgr", outletName: "Singaraja", customer: "Siti Rahma", total: "Rp 61.600", time: "14 mnt", itemsCount: 2, paymentStatus: "PAID" },
      { id: "OUT-03", number: "OUT-03", cap: 2, status: "CLEANING", outletId: "outlet-sgr", outletName: "Singaraja" },
    ],
  },

  // 2. Outlet Denpasar (KS-DPS) - STRICTLY ISOLATED
  {
    id: "area-dps-1",
    name: "VIP Lounge Denpasar",
    outletId: "outlet-dps",
    outletName: "Denpasar",
    tables: [
      { id: "DPS-01", number: "DPS-01", cap: 4, status: "AVAILABLE", outletId: "outlet-dps", outletName: "Denpasar" },
      { id: "DPS-02", number: "DPS-02", cap: 6, status: "OCCUPIED", outletId: "outlet-dps", outletName: "Denpasar", customer: "Dewi Lestari", total: "Rp 214.500", time: "30 mnt", itemsCount: 3, paymentStatus: "PAID" },
    ],
  },

  // 3. Outlet Ubud (KS-UBD) - STRICTLY ISOLATED
  {
    id: "area-ubd-1",
    name: "Jungle Terrace Ubud",
    outletId: "outlet-ubd",
    outletName: "Ubud",
    tables: [
      { id: "UBD-01", number: "UBD-01", cap: 2, status: "AVAILABLE", outletId: "outlet-ubd", outletName: "Ubud" },
      { id: "UBD-02", number: "UBD-02", cap: 4, status: "AVAILABLE", outletId: "outlet-ubd", outletName: "Ubud" },
    ],
  },
];

export const INITIAL_RESERVATIONS: ScheduledReservation[] = [
  {
    id: "res-101",
    customerName: "Bpk. Hendra Wijaya",
    phone: "+62 811-2233-4455",
    tableId: "VIP-01",
    areaName: "Indoor AC Main Hall",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    dateTime: "Hari Ini, 18:30 WITA",
    pax: 8,
    downPayment: 200000,
    notes: "Family Dinner & Business Meeting. Siapkan baby high chair.",
    status: "CONFIRMED",
  },
  {
    id: "res-102",
    customerName: "Ibu Maya Santika",
    phone: "+62 815-6677-8899",
    tableId: "OUT-01",
    areaName: "Outdoor Tropical Garden",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    dateTime: "Hari Ini, 19:15 WITA",
    pax: 4,
    downPayment: 100000,
    notes: "Ulang Tahun. Meja dihias bunga meja.",
    status: "CONFIRMED",
  },
  {
    id: "res-103",
    customerName: "Gede Arya",
    phone: "+62 819-3344-5566",
    tableId: "T-04",
    areaName: "Indoor AC Main Hall",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    dateTime: "Besok, 12:30 WITA",
    pax: 6,
    downPayment: 150000,
    notes: "Lunch meeting kantor arsitektur.",
    status: "CONFIRMED",
  },
];

interface TableContextType {
  areas: AreaItem[];
  filteredAreas: AreaItem[];
  reservations: ScheduledReservation[];
  filteredReservations: ScheduledReservation[];
  getAvailableTables: (outletId?: string) => TableItem[];
  occupyTableWithOrder: (tableId: string, orderDetails: { customerName: string; totalFormatted: string; itemsCount: number; orderId: string }) => void;
  releaseTableToAvailable: (tableId: string) => void;
  updateTableStatus: (tableId: string, status: TableStatus, customer?: string, total?: string) => void;
  seatReservation: (reservationId: string) => void;
  cancelReservation: (reservationId: string) => void;
  addReservation: (reservation: Omit<ScheduledReservation, "id">) => void;
  addArea: (name: string, outletId?: string) => void;
  addTable: (areaId: string, number: string, cap: number) => void;
  resetTableData: () => void;
}

const TableContext = createContext<TableContextType | undefined>(undefined);
const STORAGE_KEY_AREAS = "dagoeng_tables_areas_v2";
const STORAGE_KEY_RESERVATIONS = "dagoeng_tables_reservations_v2";

export function TableProvider({ children }: { children: React.ReactNode }) {
  const { activeOutletId, activeOutlet, isAllOutlets } = useOutlet();
  const { logActivity } = useActivityLog();

  const [areas, setAreas] = useState<AreaItem[]>(INITIAL_AREAS);
  const [reservations, setReservations] = useState<ScheduledReservation[]>(INITIAL_RESERVATIONS);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const savedAreas = localStorage.getItem(STORAGE_KEY_AREAS);
      const savedReservations = localStorage.getItem(STORAGE_KEY_RESERVATIONS);

      if (savedAreas) setAreas(JSON.parse(savedAreas));
      if (savedReservations) setReservations(JSON.parse(savedReservations));
    } catch (e) {
      console.error("Failed to load table state", e);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEY_AREAS, JSON.stringify(areas));
      localStorage.setItem(STORAGE_KEY_RESERVATIONS, JSON.stringify(reservations));
    } catch (e) {
      console.error("Failed to save table state", e);
    }
  }, [areas, reservations, isInitialized]);

  // Scoped areas and tables based strictly on activeOutletId
  const filteredAreas = areas.filter((area) => {
    if (isAllOutlets) return true;
    return area.outletId === activeOutletId;
  });

  const filteredReservations = reservations.filter((r) => {
    if (isAllOutlets) return true;
    return r.outletId === activeOutletId;
  });

  // Returns only tables that are AVAILABLE for new orders
  const getAvailableTables = (outletId?: string): TableItem[] => {
    const targetOutlet = outletId !== undefined ? outletId : activeOutletId;
    return areas
      .filter((a) => targetOutlet === "ALL" || isAllOutlets || a.outletId === targetOutlet)
      .flatMap((a) => a.tables)
      .filter((t) => t.status === "AVAILABLE");
  };

  // OCCUPY TABLE ON POS TRANSACTION
  const occupyTableWithOrder = (
    tableId: string,
    orderDetails: { customerName: string; totalFormatted: string; itemsCount: number; orderId: string }
  ) => {
    let targetArea: AreaItem | undefined;
    let targetTable: TableItem | undefined;

    for (const a of areas) {
      const t = a.tables.find((item) => item.id === tableId || item.number === tableId);
      if (t) {
        targetArea = a;
        targetTable = t;
        break;
      }
    }

    if (!targetTable || !targetArea) return;

    setAreas((prev) =>
      prev.map((area) => ({
        ...area,
        tables: area.tables.map((table) =>
          table.id === targetTable!.id
            ? {
                ...table,
                status: "OCCUPIED",
                customer: orderDetails.customerName,
                total: orderDetails.totalFormatted,
                time: "Baru saja",
                itemsCount: orderDetails.itemsCount,
                activeOrderId: orderDetails.orderId,
                paymentStatus: "PAID",
              }
            : table
        ),
      }))
    );

    logActivity({
      module: "TABLES",
      action: "OCCUPY_TABLE",
      recordId: targetTable.id,
      previousValue: `Status: ${targetTable.status}`,
      newValue: `Status: OCCUPIED (${orderDetails.customerName} - ${orderDetails.totalFormatted})`,
      description: `Meja ${targetTable.number} terisi oleh transaksi ${orderDetails.customerName}`,
      reason: "Order POS Dine-in dibuat",
      status: "SUCCESS",
      outletId: targetArea.outletId,
      outletName: targetArea.outletName,
    });
  };

  // RELEASE TABLE BACK TO AVAILABLE
  const releaseTableToAvailable = (tableId: string) => {
    let targetArea: AreaItem | undefined;
    let targetTable: TableItem | undefined;

    for (const a of areas) {
      const t = a.tables.find((item) => item.id === tableId || item.number === tableId);
      if (t) {
        targetArea = a;
        targetTable = t;
        break;
      }
    }

    if (!targetTable || !targetArea) return;

    setAreas((prev) =>
      prev.map((area) => ({
        ...area,
        tables: area.tables.map((table) =>
          table.id === targetTable!.id
            ? {
                ...table,
                status: "AVAILABLE",
                customer: undefined,
                total: undefined,
                time: undefined,
                itemsCount: undefined,
                activeOrderId: undefined,
                paymentStatus: undefined,
              }
            : table
        ),
      }))
    );

    logActivity({
      module: "TABLES",
      action: "RELEASE_TABLE",
      recordId: targetTable.id,
      previousValue: `Status: ${targetTable.status} (${targetTable.customer || "-"})`,
      newValue: "Status: AVAILABLE",
      description: `Meja ${targetTable.number} dikosongkan dan siap digunakan kembali`,
      reason: "Sesi makan tamu selesai / meja dibersihkan",
      status: "SUCCESS",
      outletId: targetArea.outletId,
      outletName: targetArea.outletName,
    });
  };

  const updateTableStatus = (tableId: string, status: TableStatus, customer?: string, total?: string) => {
    let targetArea: AreaItem | undefined;
    let targetTable: TableItem | undefined;

    for (const a of areas) {
      const t = a.tables.find((item) => item.id === tableId || item.number === tableId);
      if (t) {
        targetArea = a;
        targetTable = t;
        break;
      }
    }

    if (!targetTable || !targetArea) return;

    const isReset = status === "AVAILABLE";

    setAreas((prev) =>
      prev.map((area) => ({
        ...area,
        tables: area.tables.map((table) =>
          table.id === targetTable!.id
            ? {
                ...table,
                status,
                customer: isReset ? undefined : (customer !== undefined ? customer : table.customer),
                total: isReset ? undefined : (total !== undefined ? total : table.total),
                time: isReset ? undefined : (status === "OCCUPIED" ? "Baru saja" : table.time),
                itemsCount: isReset ? undefined : table.itemsCount,
                activeOrderId: isReset ? undefined : table.activeOrderId,
                paymentStatus: isReset ? undefined : table.paymentStatus,
              }
            : table
        ),
      }))
    );

    logActivity({
      module: "TABLES",
      action: "CHANGE_TABLE_STATUS",
      recordId: targetTable.id,
      previousValue: `Status: ${targetTable.status}`,
      newValue: `Status: ${status}${customer ? ` (${customer})` : ""}`,
      description: `Perubahan status Meja ${targetTable.number} menjadi ${status}`,
      reason: "Manual status update via Floor Plan",
      status: "SUCCESS",
      outletId: targetArea.outletId,
      outletName: targetArea.outletName,
    });
  };

  const seatReservation = (reservationId: string) => {
    const target = reservations.find((r) => r.id === reservationId);
    if (!target) return;

    setReservations((prev) =>
      prev.map((r) => (r.id === reservationId ? { ...r, status: "SEATED" } : r))
    );

    updateTableStatus(target.tableId, "OCCUPIED", target.customerName, `DP Masuk: Rp ${target.downPayment.toLocaleString()}`);

    logActivity({
      module: "TABLES",
      action: "SEAT_RESERVATION",
      recordId: target.id,
      previousValue: "Status: CONFIRMED (Menunggu)",
      newValue: `Status: SEATED di Meja ${target.tableId}`,
      description: `Tamu reservasi ${target.customerName} telah didudukkan di Meja ${target.tableId}`,
      reason: "Kedatangan tamu reservasi terverifikasi",
      status: "SUCCESS",
      outletId: target.outletId,
      outletName: target.outletName,
    });
  };

  const cancelReservation = (reservationId: string) => {
    const target = reservations.find((r) => r.id === reservationId);
    if (!target) return;

    setReservations((prev) =>
      prev.map((r) => (r.id === reservationId ? { ...r, status: "CANCELLED" } : r))
    );

    releaseTableToAvailable(target.tableId);

    logActivity({
      module: "TABLES",
      action: "CANCEL_RESERVATION",
      recordId: target.id,
      previousValue: "Status: CONFIRMED",
      newValue: "Status: CANCELLED",
      description: `Pembatalan reservasi tamu ${target.customerName} (Meja ${target.tableId})`,
      reason: "Pembatalan oleh pelanggan",
      status: "SUCCESS",
      outletId: target.outletId,
      outletName: target.outletName,
    });
  };

  const addReservation = (reservationData: Omit<ScheduledReservation, "id">) => {
    const newRes: ScheduledReservation = {
      ...reservationData,
      id: `res-${Date.now()}`,
    };

    setReservations((prev) => [newRes, ...prev]);
    updateTableStatus(newRes.tableId, "RESERVED", `${newRes.customerName} (${newRes.dateTime})`);

    logActivity({
      module: "TABLES",
      action: "CREATE_RESERVATION",
      recordId: newRes.id,
      newValue: `${newRes.customerName} - Meja ${newRes.tableId} (${newRes.dateTime})`,
      description: `Pembuatan reservasi baru untuk ${newRes.customerName} di Meja ${newRes.tableId}`,
      reason: "Buku reservasi terjadwal",
      status: "SUCCESS",
      outletId: newRes.outletId,
      outletName: newRes.outletName,
    });
  };

  const addArea = (name: string, outletId?: string) => {
    const targetOutletId = outletId || (activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr");
    const targetOutletName = activeOutlet?.name || "Singaraja";

    const newArea: AreaItem = {
      id: `area-${Date.now()}`,
      name: name.trim(),
      outletId: targetOutletId,
      outletName: targetOutletName,
      tables: [],
    };

    setAreas((prev) => [...prev, newArea]);

    logActivity({
      module: "TABLES",
      action: "CREATE_AREA",
      recordId: newArea.id,
      newValue: newArea.name,
      description: `Penambahan area meja baru: ${newArea.name} (${targetOutletName})`,
      reason: "Penambahan denah tata letak gerai",
      status: "SUCCESS",
      outletId: targetOutletId,
      outletName: targetOutletName,
    });
  };

  const addTable = (areaId: string, number: string, cap: number) => {
    const area = areas.find((a) => a.id === areaId);
    if (!area) return;

    const newTable: TableItem = {
      id: number.trim(),
      number: number.trim(),
      cap,
      status: "AVAILABLE",
      outletId: area.outletId,
      outletName: area.outletName,
    };

    setAreas((prev) =>
      prev.map((a) => (a.id === areaId ? { ...a, tables: [...a.tables, newTable] } : a))
    );

    logActivity({
      module: "TABLES",
      action: "CREATE_TABLE",
      recordId: newTable.id,
      newValue: `Meja ${newTable.number} (Kapasitas ${cap} orang)`,
      description: `Penambahan Meja ${newTable.number} di area ${area.name}`,
      reason: "Penambahan kapasitas kursi gerai",
      status: "SUCCESS",
      outletId: area.outletId,
      outletName: area.outletName,
    });
  };

  const resetTableData = () => {
    setAreas(INITIAL_AREAS);
    setReservations(INITIAL_RESERVATIONS);
    try {
      localStorage.removeItem(STORAGE_KEY_AREAS);
      localStorage.removeItem(STORAGE_KEY_RESERVATIONS);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <TableContext.Provider
      value={{
        areas,
        filteredAreas,
        reservations,
        filteredReservations,
        getAvailableTables,
        occupyTableWithOrder,
        releaseTableToAvailable,
        updateTableStatus,
        seatReservation,
        cancelReservation,
        addReservation,
        addArea,
        addTable,
        resetTableData,
      }}
    >
      {children}
    </TableContext.Provider>
  );
}

export function useTables() {
  const context = useContext(TableContext);
  if (!context) {
    throw new Error("useTables must be used within a TableProvider");
  }
  return context;
}
