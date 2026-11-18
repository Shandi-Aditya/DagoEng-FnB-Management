"use client";

import React, { createContext, useContext } from "react";
import type { TablesCommand } from "@/lib/domain-sync-types";
import {
  applyTablesCommand,
  INITIAL_AREAS,
  INITIAL_RESERVATIONS,
  tablesSyncClient,
} from "@/lib/sync-domains/spaces-spec";
import { useSyncedDomain } from "@/lib/use-synced-domain";
import { useOutlet } from "./OutletContext";
import { useActivityLog } from "./ActivityLogContext";

export { INITIAL_AREAS, INITIAL_RESERVATIONS };

export type TableStatus =
  | "AVAILABLE"
  | "OCCUPIED"
  | "RESERVED"
  | "BILLING"
  | "CLEANING";

export interface TableItem {
  id: string;
  number: string;
  cap: number;
  status: TableStatus;
  outletId: string;
  outletName: string;
  area?: string;
  customer?: string;
  total?: string;
  currentBillTotal?: number;
  time?: string;
  itemsCount?: number;
  activeOrderId?: string;
  paymentStatus?: "UNPAID" | "PAID";
}

export interface SelectableTableCandidate {
  status: string;
  paymentStatus?: string;
  activeOrderId?: string;
  currentBillTotal?: number;
  total?: string;
}

export function isTableSelectableForPos(
  table: SelectableTableCandidate
): boolean {
  if (table.status === "AVAILABLE") return true;
  if (table.status !== "OCCUPIED") return false;
  if (table.paymentStatus === "PAID" || table.activeOrderId) return false;
  if (table.currentBillTotal !== undefined && table.currentBillTotal > 0) {
    return false;
  }
  if (
    table.total &&
    table.total !== "Rp 0" &&
    !table.total.startsWith("DP Masuk")
  ) {
    const numericTotal = Number(table.total.replace(/\D/g, ""));
    if (numericTotal > 0) return false;
  }
  return true;
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

interface TableContextType {
  areas: AreaItem[];
  filteredAreas: AreaItem[];
  reservations: ScheduledReservation[];
  filteredReservations: ScheduledReservation[];
  getAvailableTables: (outletId?: string) => TableItem[];
  occupyTableWithOrder: (
    tableId: string,
    orderDetails: {
      customerName: string;
      totalFormatted: string;
      itemsCount: number;
      orderId: string;
    }
  ) => void;
  releaseTableToAvailable: (tableId: string) => void;
  updateTableStatus: (
    tableId: string,
    status: TableStatus,
    customer?: string,
    total?: string
  ) => void;
  seatReservation: (reservationId: string) => void;
  cancelReservation: (reservationId: string) => void;
  addReservation: (reservation: Omit<ScheduledReservation, "id">) => void;
  addArea: (name: string, outletId?: string) => void;
  addTable: (areaId: string, number: string, cap: number) => void;
  updateTable: (
    tableId: string,
    updates: {
      number?: string;
      areaName?: string;
      cap?: number;
      status?: TableStatus;
    }
  ) => void;
  deleteTable: (tableId: string) => void;
  resetTableData: () => void;
}

const TableContext = createContext<TableContextType | undefined>(undefined);

function findTableInAreas(
  areas: readonly AreaItem[],
  tableIdOrNumber: string
): { area: AreaItem; table: TableItem } | null {
  for (const area of areas) {
    const exact = area.tables.find((item) => item.id === tableIdOrNumber);
    if (exact) return { area, table: exact };
  }
  for (const area of areas) {
    const byNumber = area.tables.find(
      (item) => item.number === tableIdOrNumber
    );
    if (byNumber) return { area, table: byNumber };
  }
  return null;
}

export function TableProvider({ children }: { children: React.ReactNode }) {
  const { activeOutletId, activeOutlet, isAllOutlets } = useOutlet();
  const { logActivity } = useActivityLog();

  const [domainState, mutateTables] = useSyncedDomain(tablesSyncClient, {
    pollMs: 5000,
  });
  const { areas, reservations } = domainState;

  const filteredAreas = areas.filter((area) => {
    if (isAllOutlets) return true;
    return area.outletId === activeOutletId;
  });

  const filteredReservations = reservations.filter((r) => {
    if (isAllOutlets) return true;
    return r.outletId === activeOutletId;
  });

  const getAvailableTables = (outletId?: string): TableItem[] => {
    const targetOutlet = outletId !== undefined ? outletId : activeOutletId;
    return areas
      .filter(
        (a) =>
          targetOutlet === "ALL" || isAllOutlets || a.outletId === targetOutlet
      )
      .flatMap((a) => a.tables.map((t) => ({ ...t, area: t.area || a.name })))
      .filter((t) => isTableSelectableForPos(t));
  };

  const occupyTableWithOrder = (
    tableId: string,
    orderDetails: {
      customerName: string;
      totalFormatted: string;
      itemsCount: number;
      orderId: string;
    }
  ) => {
    const found = findTableInAreas(tablesSyncClient.getSnapshot().areas, tableId);
    if (!found) return;
    const { area: targetArea, table: targetTable } = found;

    const numericBillTotal =
      Number(orderDetails.totalFormatted.replace(/\D/g, "")) || 0;

    const cmd: TablesCommand = {
      op: "PATCH_TABLE_STATUS",
      tableId: targetTable.id,
      status: "OCCUPIED",
      customer: orderDetails.customerName,
      total: orderDetails.totalFormatted,
      currentBillTotal: numericBillTotal,
      time: "Baru saja",
      itemsCount: orderDetails.itemsCount,
      activeOrderId: orderDetails.orderId,
      paymentStatus: "PAID",
    };

    mutateTables(
      (prev) => applyTablesCommand(prev, cmd),
      { id: `tbl-status-${targetTable.id}`, isCreate: false, command: cmd }
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

  const releaseTableToAvailable = (tableId: string) => {
    const found = findTableInAreas(tablesSyncClient.getSnapshot().areas, tableId);
    if (!found) return;
    const { area: targetArea, table: targetTable } = found;

    const cmd: TablesCommand = {
      op: "PATCH_TABLE_STATUS",
      tableId: targetTable.id,
      status: "AVAILABLE",
    };

    mutateTables(
      (prev) => applyTablesCommand(prev, cmd),
      { id: `tbl-status-${targetTable.id}`, isCreate: false, command: cmd }
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

  const updateTableStatus = (
    tableId: string,
    status: TableStatus,
    customer?: string,
    total?: string
  ) => {
    const found = findTableInAreas(tablesSyncClient.getSnapshot().areas, tableId);
    if (!found) return;
    const { area: targetArea, table: targetTable } = found;

    const isReset = status === "AVAILABLE";
    const nextCurrentBillTotal = isReset
      ? undefined
      : total !== undefined
        ? total.startsWith("DP Masuk")
          ? 0
          : Number(total.replace(/\D/g, "")) || 0
        : targetTable.currentBillTotal;

    const cmd: TablesCommand = {
      op: "PATCH_TABLE_STATUS",
      tableId: targetTable.id,
      status,
      customer,
      total,
      currentBillTotal: nextCurrentBillTotal,
      time: isReset ? undefined : status === "OCCUPIED" ? "Baru saja" : targetTable.time,
    };

    mutateTables(
      (prev) => applyTablesCommand(prev, cmd),
      { id: `tbl-status-${targetTable.id}`, isCreate: false, command: cmd }
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
    const target = tablesSyncClient
      .getSnapshot()
      .reservations.find((r) => r.id === reservationId);
    if (!target) return;

    const resCmd: TablesCommand = {
      op: "PATCH_RESERVATION_STATUS",
      reservationId,
      status: "SEATED",
    };

    mutateTables(
      (prev) => applyTablesCommand(prev, resCmd),
      { id: `tbl-res-${reservationId}`, isCreate: false, command: resCmd }
    );

    updateTableStatus(
      target.tableId,
      "OCCUPIED",
      target.customerName,
      `DP Masuk: Rp ${target.downPayment.toLocaleString()}`
    );

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
    const target = tablesSyncClient
      .getSnapshot()
      .reservations.find((r) => r.id === reservationId);
    if (!target) return;

    const resCmd: TablesCommand = {
      op: "PATCH_RESERVATION_STATUS",
      reservationId,
      status: "CANCELLED",
    };

    mutateTables(
      (prev) => applyTablesCommand(prev, resCmd),
      { id: `tbl-res-${reservationId}`, isCreate: false, command: resCmd }
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

    const resCmd: TablesCommand = {
      op: "UPSERT_RESERVATION",
      reservation: newRes,
    };

    mutateTables(
      (prev) => applyTablesCommand(prev, resCmd),
      { id: `tbl-res-${newRes.id}`, isCreate: true, command: resCmd }
    );

    updateTableStatus(
      newRes.tableId,
      "RESERVED",
      `${newRes.customerName} (${newRes.dateTime})`
    );

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
    const targetOutletId =
      outletId || (activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr");
    const targetOutletName = activeOutlet?.name || "Singaraja";

    const newArea: AreaItem = {
      id: `area-${Date.now()}`,
      name: name.trim(),
      outletId: targetOutletId,
      outletName: targetOutletName,
      tables: [],
    };

    const cmd: TablesCommand = {
      op: "UPSERT_AREA",
      area: newArea,
    };

    mutateTables(
      (prev) => applyTablesCommand(prev, cmd),
      { id: `tbl-area-${newArea.id}`, isCreate: true, command: cmd }
    );

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
    const trimmedNumber = number.trim();
    if (!trimmedNumber) return;

    const currentAreas = tablesSyncClient.getSnapshot().areas;
    const targetOutletId =
      activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr";
    const targetOutletName = activeOutlet?.name || "Singaraja";
    const areaById = currentAreas.find((a) => a.id === areaId);
    const areaByName = !areaById
      ? currentAreas.find(
          (a) =>
            a.outletId === targetOutletId &&
            a.name.trim().toLowerCase() === areaId.trim().toLowerCase()
        )
      : undefined;
    const resolvedArea = areaById ?? areaByName;
    const effectiveOutletId = resolvedArea?.outletId || targetOutletId;
    const effectiveOutletName = resolvedArea?.outletName || targetOutletName;
    const effectiveAreaName = resolvedArea?.name || areaId.trim() || "Main Hall";

    const idExists = currentAreas.some((a) =>
      a.tables.some((t) => t.id === trimmedNumber)
    );
    const newTable: TableItem = {
      id: idExists ? `tbl-${Date.now()}` : trimmedNumber,
      number: trimmedNumber,
      cap,
      status: "AVAILABLE",
      outletId: effectiveOutletId,
      outletName: effectiveOutletName,
      area: effectiveAreaName,
    };

    const cmd: TablesCommand = resolvedArea
      ? { op: "UPSERT_TABLE", areaId: resolvedArea.id, table: newTable }
      : {
          op: "UPSERT_TABLE",
          areaName: effectiveAreaName,
          outletId: effectiveOutletId,
          outletName: effectiveOutletName,
          table: newTable,
        };

    mutateTables(
      (prev) => applyTablesCommand(prev, cmd),
      { id: `tbl-upsert-${newTable.id}`, isCreate: true, command: cmd }
    );

    logActivity({
      module: "TABLES",
      action: "CREATE_TABLE",
      recordId: newTable.id,
      newValue: `Meja ${newTable.number} (Kapasitas ${cap} orang)`,
      description: `Penambahan Meja ${newTable.number} di area ${effectiveAreaName}`,
      reason: "Penambahan kapasitas kursi gerai",
      status: "SUCCESS",
      outletId: effectiveOutletId,
      outletName: effectiveOutletName,
    });
  };

  const updateTable = (
    tableId: string,
    updates: {
      number?: string;
      areaName?: string;
      cap?: number;
      status?: TableStatus;
    }
  ) => {
    const found = findTableInAreas(tablesSyncClient.getSnapshot().areas, tableId);
    if (!found) return;
    const { area: existingArea, table: existingTable } = found;

    const nextNumber =
      updates.number !== undefined && String(updates.number).trim()
        ? String(updates.number).trim()
        : existingTable.number;
    const nextCap =
      updates.cap !== undefined
        ? Number(updates.cap) || existingTable.cap
        : existingTable.cap;
    const nextStatus = updates.status ?? existingTable.status;
    const nextAreaName = updates.areaName?.trim();
    const isReset = nextStatus === "AVAILABLE";

    const updatedTable: TableItem = {
      ...existingTable,
      number: nextNumber,
      cap: nextCap,
      status: nextStatus,
      area: nextAreaName || existingArea.name,
      customer: isReset ? undefined : existingTable.customer,
      total: isReset ? undefined : existingTable.total,
      currentBillTotal: isReset ? undefined : existingTable.currentBillTotal,
      time: isReset ? undefined : existingTable.time,
      itemsCount: isReset ? undefined : existingTable.itemsCount,
      activeOrderId: isReset ? undefined : existingTable.activeOrderId,
      paymentStatus: isReset ? undefined : existingTable.paymentStatus,
    };

    const cmd: TablesCommand = nextAreaName
      ? {
          op: "UPSERT_TABLE",
          areaName: nextAreaName,
          outletId: existingArea.outletId,
          outletName: existingArea.outletName,
          table: updatedTable,
          previousTableId: existingTable.id,
        }
      : {
          op: "UPSERT_TABLE",
          areaId: existingArea.id,
          table: updatedTable,
          previousTableId: existingTable.id,
        };

    mutateTables(
      (prev) => applyTablesCommand(prev, cmd),
      { id: `tbl-upsert-${existingTable.id}`, isCreate: false, command: cmd }
    );

    logActivity({
      module: "TABLES",
      action: "UPDATE_TABLE",
      recordId: existingTable.id,
      previousValue: `Meja ${existingTable.number} (${existingArea.name}, Kapasitas ${existingTable.cap})`,
      newValue: `Meja ${updatedTable.number} (${nextAreaName || existingArea.name}, Kapasitas ${updatedTable.cap})`,
      description: `Pembaruan data Meja ${updatedTable.number}`,
      reason: "Pembaruan konfigurasi meja gerai",
      status: "SUCCESS",
      outletId: existingArea.outletId,
      outletName: existingArea.outletName,
    });
  };

  const deleteTable = (tableId: string) => {
    const found = findTableInAreas(tablesSyncClient.getSnapshot().areas, tableId);
    if (!found) return;
    const { area: existingArea, table: existingTable } = found;

    const cmd: TablesCommand = {
      op: "DELETE_TABLE",
      tableId: existingTable.id,
    };

    mutateTables(
      (prev) => applyTablesCommand(prev, cmd),
      { id: `tbl-delete-${existingTable.id}`, isCreate: false, command: cmd }
    );

    logActivity({
      module: "TABLES",
      action: "DELETE_TABLE",
      recordId: existingTable.id,
      previousValue: `Meja ${existingTable.number} (${existingArea.name})`,
      description: `Penghapusan Meja ${existingTable.number} dari area ${existingArea.name}`,
      reason: "Penyesuaian kapasitas kursi gerai",
      status: "SUCCESS",
      outletId: existingArea.outletId,
      outletName: existingArea.outletName,
    });
  };

  const resetTableData = () => {
    const cmd: TablesCommand = { op: "RESET_TABLES" };
    mutateTables(
      (prev) => applyTablesCommand(prev, cmd),
      { id: "tables-reset", isCreate: false, command: cmd }
    );
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
        updateTable,
        deleteTable,
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
