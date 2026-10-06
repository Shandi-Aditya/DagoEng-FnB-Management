"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  ActivityLogEntry,
  ActivityModule,
  AuditStatus,
  ActivitySeverity,
  ActivityCategory,
} from "@/types/audit";
import { useAuth } from "./AuthContext";
import { useOutlet } from "./OutletContext";

export const INITIAL_AUDIT_LOGS: ActivityLogEntry[] = [];

export interface LogActivityPayload {
  module: ActivityModule;
  action: string;
  recordId?: string;
  previousValue?: string;
  newValue?: string;
  description: string;
  reason?: string;
  status?: AuditStatus;
  severity?: ActivitySeverity;
  category?: ActivityCategory;
  metadata?: Record<string, any>;
  outletId?: string;
  outletName?: string;
}

interface ActivityLogContextType {
  logs: ActivityLogEntry[];
  filteredLogs: ActivityLogEntry[];
  logActivity: (payload: LogActivityPayload) => void;
  clearLogs: () => void;
  simulateActivity: (scenarioType: "VOID" | "DISCOUNT" | "STOCK_DIFF" | "CONFIG_CHANGE" | "RESERVATION") => void;
}

const ActivityLogContext = createContext<ActivityLogContextType | undefined>(undefined);
const STORAGE_KEY_AUDIT = "dagoeng_audit_trail_persistent_v3";

export function ActivityLogProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeOutletId, activeOutlet, isAllOutlets } = useOutlet();
  const [logs, setLogs] = useState<ActivityLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_AUDIT);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setLogs(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load persistent audit log", e);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEY_AUDIT, JSON.stringify(logs));
    } catch (e) {
      console.error("Failed to persist audit log", e);
    }
  }, [logs, isInitialized]);

  const filteredLogs = logs.filter((l) => {
    if (isAllOutlets) return true;
    return l.outletId === activeOutletId || !l.outletId;
  });

  const logActivity = (payload: LogActivityPayload) => {
    const now = new Date();
    const targetOutletId = payload.outletId || (activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr");
    const targetOutletName = payload.outletName || activeOutlet?.name || "Singaraja";

    const roleStr =
      typeof user?.role === "object" && user.role
        ? user.role.name
        : typeof user?.role === "string"
        ? user.role
        : "Owner";

    const entry: ActivityLogEntry = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      actorId: user?.id || "usr-current",
      actorName: user?.name || "Hendra Wijaya",
      actorRole: roleStr,
      role: roleStr,
      organization: "org-dago-hub",
      organizationName: "Dago Creative Hub",
      outletId: targetOutletId,
      outletName: targetOutletName,
      module: payload.module,
      action: payload.action,
      recordId: payload.recordId,
      timestamp: now.toISOString(),
      formattedTime:
        now.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) + " WITA",
      previousValue: payload.previousValue,
      newValue: payload.newValue,
      description: payload.description,
      reason: payload.reason,
      status: payload.status || "SUCCESS",
      severity: payload.severity || (payload.status === "FAILED" ? "HIGH" : payload.status === "WARNING" ? "MEDIUM" : "INFO"),
      category: payload.category || "OPERATIONAL",
      metadata: payload.metadata,
    };

    setLogs((prev) => [entry, ...prev]);
  };

  const simulateActivity = (scenarioType: "VOID" | "DISCOUNT" | "STOCK_DIFF" | "CONFIG_CHANGE" | "RESERVATION") => {
    if (scenarioType === "VOID") {
      const orderNum = Math.floor(1000 + Math.random() * 9000);
      logActivity({
        module: "POS",
        action: "ORDER_VOID_REQUESTED",
        recordId: `ord-${orderNum}`,
        previousValue: `Order Total: Rp 95.000 (Table T-03)`,
        newValue: `Status: VOIDED / DIBATALKAN`,
        description: `Kasir membatalkan pesanan #ord-${orderNum} karena kesalahan input menu oleh waiter.`,
        reason: "Kesalahan input menu pelanggan & pergantian meja",
        status: "WARNING",
        severity: "HIGH",
        category: "TRANSACTION",
        metadata: { orderId: `ord-${orderNum}`, voidAmount: 95000, table: "T-03" },
      });
    } else if (scenarioType === "DISCOUNT") {
      logActivity({
        module: "LOYALTY",
        action: "VOUCHER_POINTS_REDEEMED",
        recordId: "loy-tx-77",
        previousValue: "Poin Member: 450 Pts",
        newValue: "Poin Sisa: 350 Pts (-100 Pts, Diskon Rp 25.000)",
        description: "Member 'Ketut Dian' menukarkan 100 poin loyalty menjadi diskon transaksi POS.",
        reason: "Penebusan reward loyalty tier Gold",
        status: "SUCCESS",
        severity: "INFO",
        category: "MEMBERSHIP",
        metadata: { member: "Ketut Dian", points: 100, discount: 25000 },
      });
    } else if (scenarioType === "STOCK_DIFF") {
      logActivity({
        module: "INVENTORY",
        action: "STOCK_OPNAME_DISCREPANCY",
        recordId: "ing-susu-fresh",
        previousValue: "Stok Sistem: 18.0 Liter",
        newValue: "Stok Fisik: 15.5 Liter (Selisih -2.5 Liter)",
        description: "Ditemukan selisih fisik saat Stock Opname bahan 'Fresh Milk Pasteurisasi'.",
        reason: "Penyusutan operasional & tumpahan pada mesin espresso",
        status: "WARNING",
        severity: "MEDIUM",
        category: "INVENTORY",
        metadata: { item: "Fresh Milk Pasteurisasi", discrepancy: -2.5, unit: "Liter" },
      });
    } else if (scenarioType === "CONFIG_CHANGE") {
      logActivity({
        module: "SETTINGS",
        action: "UPDATE_LOYALTY_TIER_CONFIG",
        recordId: "cfg-loyalty-tier",
        previousValue: "Min. Silver: 100 Pts, Gold: 300 Pts, Platinum: 600 Pts",
        newValue: "Min. Silver: 100 Pts, Gold: 300 Pts, Platinum: 750 Pts",
        description: "Owner memperbarui ambang batas poin untuk kualifikasi loyalty tier Platinum.",
        reason: "Program peningkatan retensi pelanggan setia",
        status: "SUCCESS",
        severity: "LOW",
        category: "CONFIGURATION",
        metadata: { silverMin: 100, goldMin: 300, platinumMin: 750 },
      });
    } else if (scenarioType === "RESERVATION") {
      const tableNum = `T-0${Math.floor(1 + Math.random() * 8)}`;
      logActivity({
        module: "TABLES",
        action: "TABLE_RESERVATION_CONFIRMED",
        recordId: `resv-${Date.now().toString().slice(-4)}`,
        previousValue: `Meja ${tableNum}: TERSEDIA`,
        newValue: `Meja ${tableNum}: RESERVED (Gusti Arya - 6 Pax)`,
        description: `Reservasi meja ${tableNum} untuk jam makan malam berhasil diverifikasi.`,
        reason: "Booking meja rapat santai via Reservasi Dago Hub",
        status: "SUCCESS",
        severity: "INFO",
        category: "OPERATIONAL",
        metadata: { tableNumber: tableNum, guest: "Gusti Arya", pax: 6 },
      });
    }
  };

  const clearLogs = () => {
    setLogs(INITIAL_AUDIT_LOGS);
    try {
      localStorage.removeItem(STORAGE_KEY_AUDIT);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <ActivityLogContext.Provider
      value={{
        logs,
        filteredLogs,
        logActivity,
        clearLogs,
        simulateActivity,
      }}
    >
      {children}
    </ActivityLogContext.Provider>
  );
}

export function useActivityLog() {
  const context = useContext(ActivityLogContext);
  if (!context) {
    throw new Error("useActivityLog must be used within an ActivityLogProvider");
  }
  return context;
}
