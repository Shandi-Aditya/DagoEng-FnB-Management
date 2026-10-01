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

export const INITIAL_AUDIT_LOGS: ActivityLogEntry[] = [
  {
    id: "log-init-01",
    actorId: "usr-owner-01",
    actorName: "Hendra Wijaya",
    actorRole: "Owner",
    role: "Owner",
    organization: "org-dago-hub",
    organizationName: "Dago Creative Hub",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    module: "POS",
    action: "PAYMENT_CONFIRMED",
    recordId: "ord-1042",
    timestamp: "2026-09-18T03:45:00.000Z",
    formattedTime: "18 Sep 2026 11:45 WITA",
    previousValue: "Status: ORDER_CREATED",
    newValue: "Status: PAID (Total: Rp 82.800 via QRIS)",
    description: "Pembayaran pesanan meja T-01 terkonfirmasi lunas.",
    reason: "Transaksi checkout berhasil melalui QRIS DagoPay",
    status: "SUCCESS",
    severity: "INFO",
    category: "TRANSACTION",
    metadata: { orderId: "ord-1042", table: "T-01", paymentMethod: "QRIS", amount: 82800 },
  },
  {
    id: "log-init-02",
    actorId: "usr-kadek-02",
    actorName: "Ni Kadek Sri",
    actorRole: "Head Cashier",
    role: "Head Cashier",
    organization: "org-dago-hub",
    organizationName: "Dago Creative Hub",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    module: "POS",
    action: "LOYALTY_DISCOUNT_APPLIED",
    recordId: "ord-1041",
    timestamp: "2026-09-18T02:30:00.000Z",
    formattedTime: "18 Sep 2026 10:30 WITA",
    previousValue: "Subtotal: Rp 120.000 (0 Poin)",
    newValue: "Diskon: -Rp 25.000 (Tukar 100 Poin Ketut Dian)",
    description: "Penebusan voucher loyalty member 'Ketut Dian' pada transaksi kasir.",
    reason: "Redeem 100 points untuk diskon Rp 25.000",
    status: "SUCCESS",
    severity: "INFO",
    category: "MEMBERSHIP",
    metadata: { member: "Ketut Dian", pointsRedeemed: 100, discount: 25000 },
  },
  {
    id: "log-init-03",
    actorId: "usr-kadek-02",
    actorName: "Ni Kadek Sri",
    actorRole: "Head Cashier",
    role: "Head Cashier",
    organization: "org-dago-hub",
    organizationName: "Dago Creative Hub",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    module: "EMPLOYEES_SHIFT",
    action: "OPEN_SHIFT",
    recordId: "shf-active-01",
    timestamp: "2026-09-18T00:00:00.000Z",
    formattedTime: "18 Sep 2026 08:00 WITA",
    previousValue: "Shift: CLOSED",
    newValue: "Modal Kas Awal: Rp 500.000",
    description: "Pembukaan laci kasir Shift Pagi oleh Ni Kadek Sri.",
    reason: "Operasional harian dimulai dengan verifikasi float kasir",
    status: "SUCCESS",
    severity: "LOW",
    category: "STAFF",
    metadata: { shiftName: "Shift Pagi", floatAmount: 500000 },
  },
  {
    id: "log-init-04",
    actorId: "usr-owner-01",
    actorName: "Hendra Wijaya",
    actorRole: "Owner",
    role: "Owner",
    organization: "org-dago-hub",
    organizationName: "Dago Creative Hub",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    module: "SETTINGS",
    action: "UPDATE_TAX_CONFIGURATION",
    recordId: "cfg-tax-01",
    timestamp: "2026-09-17T16:15:00.000Z",
    formattedTime: "18 Sep 2026 00:15 WITA",
    previousValue: "PB1: 10%, Service Charge: 5%",
    newValue: "PB1: 10%, Service Charge: 5% (Disinkronkan)",
    description: "Pembaruan parameter fiskal dan pajak restoran PB1 platform.",
    reason: "Penyesuaian kepatuhan regulasi daerah Singaraja Buleleng",
    status: "SUCCESS",
    severity: "MEDIUM",
    category: "CONFIGURATION",
    metadata: { taxRatePercent: 10, serviceChargePercent: 5 },
  },
  {
    id: "log-init-05",
    actorId: "usr-gede-03",
    actorName: "Gede Agus",
    actorRole: "Chef Singaraja",
    role: "Chef",
    organization: "org-dago-hub",
    organizationName: "Dago Creative Hub",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    module: "INVENTORY",
    action: "STOCK_ADJUSTMENT",
    recordId: "ing-1",
    timestamp: "2026-09-17T14:30:00.000Z",
    formattedTime: "17 Sep 2026 22:30 WITA",
    previousValue: "Stok: 12.0 kg",
    newValue: "Stok: 14.5 kg (+2.5 kg)",
    description: "Penyesuaian stok Biji Kopi House Blend setelah Stock Opname harian.",
    reason: "Rekonsiliasi fisik gudang malam dengan tim barista",
    status: "SUCCESS",
    severity: "LOW",
    category: "INVENTORY",
    metadata: { ingredientId: "ing-1", ingredientName: "Biji Kopi House Blend", diff: 2.5 },
  },
  {
    id: "log-init-06",
    actorId: "usr-waiter-04",
    actorName: "Made Surya",
    actorRole: "Waiter Floor",
    role: "Waiter",
    organization: "org-dago-hub",
    organizationName: "Dago Creative Hub",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    module: "TABLES",
    action: "RESERVATION_CREATED",
    recordId: "resv-2026-09-18",
    timestamp: "2026-09-17T09:00:00.000Z",
    formattedTime: "17 Sep 2026 17:00 WITA",
    previousValue: "Meja T-04: AVAILABLE",
    newValue: "Meja T-04: RESERVED (Tamu: Bapak Budi Santoso - 4 Orang)",
    description: "Pembuatan reservasi meja area Indoor untuk 4 orang tamu VIP.",
    reason: "Reservasi via WhatsApp hotline Dago Creative Hub",
    status: "SUCCESS",
    severity: "INFO",
    category: "OPERATIONAL",
    metadata: { tableNumber: "T-04", customerName: "Bapak Budi Santoso", pax: 4 },
  },
  {
    id: "log-init-07",
    actorId: "usr-mgr-cowork",
    actorName: "Rian Hidayat",
    actorRole: "Manager Coworking",
    role: "Manager",
    organization: "org-dago-hub",
    organizationName: "Dago Creative Hub",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    module: "COWORKING",
    action: "BOOKING_CREATED",
    recordId: "cw-bk-01",
    timestamp: "2026-09-17T06:10:00.000Z",
    formattedTime: "17 Sep 2026 14:10 WITA",
    previousValue: "Ruang Meeting Sakura: TERSEDIA",
    newValue: "Ruang Meeting Sakura: BOOKED (PT Bali Digital Agency - 2 Jam)",
    description: "Pemesanan ruang meeting coworking Sakura selama 2 jam.",
    reason: "Sesi presentasi client Dago Creative Hub",
    status: "SUCCESS",
    severity: "INFO",
    category: "OPERATIONAL",
    metadata: { room: "Sakura", durationHours: 2, client: "PT Bali Digital Agency" },
  },
  {
    id: "log-init-08",
    actorId: "usr-kadek-02",
    actorName: "Ni Kadek Sri",
    actorRole: "Head Cashier",
    role: "Head Cashier",
    organization: "org-dago-hub",
    organizationName: "Dago Creative Hub",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    module: "POS",
    action: "ORDER_VOIDED",
    recordId: "ord-1039",
    timestamp: "2026-09-16T11:20:00.000Z",
    formattedTime: "16 Sep 2026 19:20 WITA",
    previousValue: "Status: ORDER_CREATED (Rp 45.000)",
    newValue: "Status: CANCELLED / VOID",
    description: "Pembatalan item pesanan kasir karena salah ketik meja.",
    reason: "Pelanggan berpindah meja dan mengubah menu pesanan",
    status: "WARNING",
    severity: "HIGH",
    category: "TRANSACTION",
    metadata: { orderId: "ord-1039", voidAmount: 45000 },
  },
];

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
const STORAGE_KEY_AUDIT = "dagoeng_audit_trail_persistent_v2";

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
        if (Array.isArray(parsed) && parsed.length > 0) {
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

