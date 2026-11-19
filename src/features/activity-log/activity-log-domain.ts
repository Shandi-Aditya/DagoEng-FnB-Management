/**
 * Domain murni pelacakan aktivitas dan audit trail.
 * Mengelola pemfilteran, kalkulasi KPI, aggregasi aktor/role, label terjemahan, dan pembuat data ekspor.
 *
 * Importer:
 * - src/app/(dashboard)/activity-log/page.tsx
 * - src/features/activity-log/ActivityLogTableView.tsx
 * - src/features/activity-log/ActivityLogTimelineView.tsx
 * - src/features/activity-log/ActivityLogFilterBar.tsx
 * - src/features/activity-log/ActivityLogDetailModal.tsx
 * - tests/activity-log-domain.test.ts
 */

import type { StatusTone } from "@/components/app/status-badge";
import {
  formatWitaDateTime,
  getTodayWitaDateString,
  normalizeDateRange,
  toWitaDateKey,
} from "@/contexts/DateFilterContext";
import type {
  ActivityLogEntry,
  ActivitySeverity,
  AuditStatus,
} from "@/types/audit";

export type ViewMode = "TABLE" | "TIMELINE";
export type DateFilterType = "ALL" | "TODAY" | "LAST_7_DAYS" | "LAST_30_DAYS" | "CUSTOM";

export interface ActivityLogFilterOptions {
  activeOutletId?: string;
  isTenantOwner?: boolean;
  tenantId?: string;
  selectedModule?: string;
  selectedStatus?: string;
  selectedSeverity?: string;
  selectedRole?: string;
  selectedActor?: string;
  dateFilter?: DateFilterType;
  customStartDate?: string;
  customEndDate?: string;
  searchTerm?: string;
}

export interface ActivityLogStats {
  totalCount: number;
  successCount: number;
  warningCount: number;
  failedCount: number;
  highSeverityCount: number;
  integrityPercent: number;
}

export interface ModuleOption {
  key: string;
  label: string;
}

export const MODULE_OPTIONS: ModuleOption[] = [
  { key: "ALL", label: "Semua modul" },
  { key: "POS", label: "POS dan kasir" },
  { key: "TABLES", label: "Meja" },
  { key: "INVENTORY", label: "Inventori" },
  { key: "MENU", label: "Menu" },
  { key: "LOYALTY", label: "Pelanggan" },
  { key: "COWORKING", label: "Co-working" },
  { key: "COMMERCIAL", label: "Komersial" },
  { key: "EMPLOYEES_SHIFT", label: "Karyawan dan shift" },
  { key: "FINANCE", label: "Keuangan" },
  { key: "USER_RBAC", label: "Hak akses" },
  { key: "SETTINGS", label: "Pengaturan" },
  { key: "AUTH", label: "Autentikasi" },
  { key: "SECURITY", label: "Keamanan" },
  { key: "SYSTEM", label: "Sistem" },
  { key: "AI_INSIGHT", label: "Asisten analisis" },
];

const AUDIT_STATUS_LABEL: Record<AuditStatus, string> = {
  SUCCESS: "Berhasil",
  WARNING: "Peringatan",
  FAILED: "Gagal",
};

export function auditStatusLabel(status?: AuditStatus): string {
  return status ? (AUDIT_STATUS_LABEL[status] ?? status) : "Berhasil";
}

const AUDIT_SEVERITY_LABEL: Record<ActivitySeverity, string> = {
  INFO: "Info",
  LOW: "Rendah",
  MEDIUM: "Sedang",
  HIGH: "Tinggi",
  CRITICAL: "Kritis",
};

export function auditSeverityLabel(severity?: ActivitySeverity): string {
  return severity ? (AUDIT_SEVERITY_LABEL[severity] ?? severity) : "Info";
}

const AUDIT_MODULE_LABEL: Record<string, string> = {
  POS: "POS",
  TABLES: "Meja",
  INVENTORY: "Inventori",
  MENU: "Menu",
  LOYALTY: "Pelanggan",
  COWORKING: "Co-working",
  COMMERCIAL: "Komersial",
  EMPLOYEES_SHIFT: "Karyawan & shift",
  FINANCE: "Keuangan",
  USER_RBAC: "Hak akses",
  SETTINGS: "Pengaturan",
  AI_INSIGHT: "Asisten analisis",
  AUTH: "Keamanan",
  SECURITY: "Keamanan",
  SYSTEM: "Sistem",
};

export function auditModuleLabel(module: string): string {
  if (!module) return "—";
  return AUDIT_MODULE_LABEL[module] ?? module;
}

const AUDIT_ACTION_LABEL: Record<string, string> = {
  VOID_ITEM: "Void item",
  VOID_ORDER: "Pembatalan pesanan",
  REFUND_ORDER: "Pengembalian dana",
  PAID_ORDER_CHANGED_BY_SUPERVISOR: "Perubahan pesanan lunas",
  ORDER_VOIDED: "Pembatalan pesanan",
  ORDER_CREATED: "Pesanan dibuat",
  ORDER_CANCELLED: "Pesanan dibatalkan",
  ORDER_PAYMENT_AND_COMPLETED: "Pembayaran pesanan",
  PAYMENT_CONFIRMED: "Pembayaran dikonfirmasi",
  QRIS_WEBHOOK_SETTLED: "Pembayaran QRIS webhook",
  QRIS_SUPERVISOR_MANUAL_OVERRIDE: "Verifikasi QRIS supervisor",
  STOCK_ADJUSTMENT: "Penyesuaian stok",
  STOCK_WASTE_RECORDED: "Pencatatan limbah dapur",
  STOCK_OPNAME: "Opname stok",
  CREATE_PRODUCT: "Tambah produk",
  UPDATE_PRODUCT: "Ubah produk",
  DELETE_PRODUCT: "Hapus produk",
  OPEN_SHIFT: "Buka shift",
  CLOSE_SHIFT: "Tutup shift",
  UPDATE_CONFIG: "Ubah konfigurasi",
  UPDATE_TAX_CONFIGURATION: "Ubah pengaturan pajak",
  OCCUPY_TABLE: "Meja ditempati",
  RELEASE_TABLE: "Meja dibersihkan",
  LEASE_CREATED: "Kontrak dibuat",
  LEASE_PAYMENT: "Pembayaran sewa",
  LEASE_STATUS_CHANGED: "Ubah status kontrak",
};

export function resolveLogActorName(log: ActivityLogEntry): string {
  return log.actorName || log.userName || "";
}

export function resolveLogActorRole(log: ActivityLogEntry): string {
  return log.actorRole || log.role || log.userRole || "";
}

export function resolveLogRecordId(log: ActivityLogEntry): string {
  return log.recordId || log.referenceId || "";
}

export function resolveLogStatus(log: ActivityLogEntry): AuditStatus {
  return log.status ?? "SUCCESS";
}

export function auditActionLabel(action: string): string {
  if (!action) return "—";
  if (AUDIT_ACTION_LABEL[action]) return AUDIT_ACTION_LABEL[action];
  const normalized = action.toLowerCase().replace(/_/g, " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function emptyActivityLogMessage(hasFilter: boolean): { title: string; description: string } {
  if (hasFilter) {
    return {
      title: "Aktivitas tidak ditemukan",
      description: "Ubah kata kunci pencarian, waktu, atau filter modul.",
    };
  }
  return {
    title: "Belum ada aktivitas",
    description: "Perubahan transaksi, stok, dan pengaturan akan tercatat di sini.",
  };
}

/**
 * Mendapatkan tone visual semantik untuk status audit.
 */
export function getStatusTone(status?: AuditStatus): StatusTone {
  if (status === "SUCCESS") return "success";
  if (status === "WARNING") return "warning";
  if (status === "FAILED") return "destructive";
  return "neutral";
}

/**
 * Mendapatkan tone visual semantik untuk severity audit.
 */
export function getSeverityTone(severity?: ActivitySeverity): StatusTone {
  if (severity === "CRITICAL") return "destructive";
  if (severity === "HIGH") return "warning";
  if (severity === "MEDIUM") return "info";
  return "neutral";
}

/**
 * Membangun label periode berdasarkan filter tanggal.
 */
export function getPeriodLabel(
  dateFilter: DateFilterType,
  customStartDate?: string,
  customEndDate?: string
): string {
  if (dateFilter === "TODAY") {
    return `Hari Ini (${new Date().toLocaleDateString("id-ID", { timeZone: "Asia/Makassar" })})`;
  }
  if (dateFilter === "LAST_7_DAYS") return "7 Hari Terakhir";
  if (dateFilter === "LAST_30_DAYS") return "30 Hari Terakhir";
  if (dateFilter === "CUSTOM" && (customStartDate || customEndDate)) {
    const normalized = normalizeDateRange(customStartDate || "", customEndDate || "");
    if (normalized.startDate === normalized.endDate) {
      return formatWitaDateTime(normalized.startDate, "dd MMM yyyy");
    }
    return `${formatWitaDateTime(normalized.startDate, "dd MMM yyyy")} s/d ${formatWitaDateTime(normalized.endDate, "dd MMM yyyy")}`;
  }
  return "Semua Rekam Audit";
}

/**
 * Mengekstrak daftar unik role aktor yang tercatat dalam log.
 */
export function getUniqueRoles(logs: ActivityLogEntry[]): string[] {
  const rolesSet = new Set<string>();
  for (const log of logs) {
    const resolved = resolveLogActorRole(log);
    if (resolved) rolesSet.add(resolved);
    if (log.role) rolesSet.add(log.role);
  }
  return Array.from(rolesSet).filter(Boolean).sort();
}

/**
 * Mengekstrak daftar unik nama aktor yang tercatat dalam log.
 */
export function getUniqueActors(logs: ActivityLogEntry[]): string[] {
  const actorsSet = new Set<string>();
  for (const log of logs) {
    const resolved = resolveLogActorName(log);
    if (resolved) actorsSet.add(resolved);
  }
  return Array.from(actorsSet).filter(Boolean).sort();
}

/**
 * Melakukan pemfilteran log aktivitas sesuai kriteria scoping dan pencarian.
 */
export function filterActivityLogs(
  logs: ActivityLogEntry[],
  options: ActivityLogFilterOptions
): ActivityLogEntry[] {
  const {
    activeOutletId = "ALL",
    isTenantOwner = false,
    tenantId,
    selectedModule = "ALL",
    selectedStatus = "ALL",
    selectedSeverity = "ALL",
    selectedRole = "ALL",
    selectedActor = "ALL",
    dateFilter = "ALL",
    customStartDate = "",
    customEndDate = "",
    searchTerm = "",
  } = options;

  const now = Date.now();
  const todayWitaKey = getTodayWitaDateString();
  const search = searchTerm.trim().toLowerCase();
  const normalizedCustom =
    dateFilter === "CUSTOM" && (customStartDate || customEndDate)
      ? normalizeDateRange(customStartDate, customEndDate, todayWitaKey)
      : null;

  return logs.filter((log) => {
    const actorName = resolveLogActorName(log);
    const actorRole = resolveLogActorRole(log);
    const recordId = resolveLogRecordId(log);
    const status = resolveLogStatus(log);

    if (isTenantOwner && tenantId) {
      if (log.tenantId && log.tenantId !== tenantId) {
        return false;
      }
    }

    if (
      activeOutletId !== "ALL" &&
      log.outletId &&
      log.outletId !== "ALL" &&
      log.outletId !== activeOutletId
    ) {
      return false;
    }

    if (selectedModule !== "ALL" && log.module !== selectedModule) {
      return false;
    }

    if (selectedStatus !== "ALL" && status !== selectedStatus) {
      return false;
    }

    if (selectedSeverity !== "ALL" && (log.severity ?? "INFO") !== selectedSeverity) {
      return false;
    }

    if (selectedRole !== "ALL") {
      const targetRole = selectedRole.toLowerCase().replace(/[\s_-]+/g, "");
      const candA = actorRole.toLowerCase().replace(/[\s_-]+/g, "");
      const candB = (log.role || "").toLowerCase().replace(/[\s_-]+/g, "");
      if (candA !== targetRole && candB !== targetRole) {
        return false;
      }
    }

    if (selectedActor !== "ALL" && actorName !== selectedActor) {
      return false;
    }

    if (dateFilter !== "ALL") {
      const logKey = toWitaDateKey(log.timestamp);
      const logTime = new Date(log.timestamp).getTime();
      if (dateFilter === "TODAY") {
        if (!logKey || logKey !== todayWitaKey) return false;
      } else if (dateFilter === "LAST_7_DAYS") {
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        if (Number.isNaN(logTime)) {
          const minKey = new Date(Date.UTC(
            Number(todayWitaKey.slice(0, 4)),
            Number(todayWitaKey.slice(5, 7)) - 1,
            Number(todayWitaKey.slice(8, 10)) - 6
          )).toISOString().slice(0, 10);
          if (!logKey || logKey < minKey || logKey > todayWitaKey) return false;
        } else if (logTime < sevenDaysAgo) {
          return false;
        }
      } else if (dateFilter === "LAST_30_DAYS") {
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
        if (Number.isNaN(logTime)) {
          const minKey = new Date(Date.UTC(
            Number(todayWitaKey.slice(0, 4)),
            Number(todayWitaKey.slice(5, 7)) - 1,
            Number(todayWitaKey.slice(8, 10)) - 29
          )).toISOString().slice(0, 10);
          if (!logKey || logKey < minKey || logKey > todayWitaKey) return false;
        } else if (logTime < thirtyDaysAgo) {
          return false;
        }
      } else if (dateFilter === "CUSTOM" && normalizedCustom) {
        if (
          !logKey ||
          logKey < normalizedCustom.startDate ||
          logKey > normalizedCustom.endDate
        ) {
          return false;
        }
      }
    }

    if (search) {
      const matchActor = actorName.toLowerCase().includes(search);
      const matchRole = actorRole.toLowerCase().includes(search);
      const matchAction =
        log.action?.toLowerCase().includes(search) ||
        auditActionLabel(log.action).toLowerCase().includes(search);
      const matchModule =
        log.module?.toLowerCase().includes(search) ||
        auditModuleLabel(log.module).toLowerCase().includes(search);
      const matchDesc = log.description?.toLowerCase().includes(search);
      const matchReason = log.reason?.toLowerCase().includes(search);
      const matchRecord = recordId.toLowerCase().includes(search);
      const matchPrev = log.previousValue?.toLowerCase().includes(search);
      const matchNext = log.newValue?.toLowerCase().includes(search);

      if (
        !matchActor &&
        !matchRole &&
        !matchAction &&
        !matchModule &&
        !matchDesc &&
        !matchReason &&
        !matchRecord &&
        !matchPrev &&
        !matchNext
      ) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Menghitung KPI overview jejak audit.
 */
export function computeActivityLogStats(logs: ActivityLogEntry[]): ActivityLogStats {
  const totalCount = logs.length;
  const successCount = logs.filter((l) => resolveLogStatus(l) === "SUCCESS").length;
  const warningCount = logs.filter((l) => resolveLogStatus(l) === "WARNING").length;
  const failedCount = logs.filter((l) => resolveLogStatus(l) === "FAILED").length;
  const highSeverityCount = logs.filter(
    (l) => l.severity === "HIGH" || l.severity === "CRITICAL"
  ).length;

  const integrityPercent = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100;

  return {
    totalCount,
    successCount,
    warningCount,
    failedCount,
    highSeverityCount,
    integrityPercent,
  };
}

/**
 * Membangun data tabel untuk ekspor CSV dan Excel.
 */
export function buildActivityLogExportRows(logs: ActivityLogEntry[]): {
  headers: string[];
  rows: (string | number)[][];
} {
  const headers = [
    "Timestamp",
    "Aktor",
    "Role",
    "Gerai",
    "Modul",
    "Aksi",
    "Record ID",
    "Status",
    "Severity",
    "Nilai Sebelumnya",
    "Nilai Baru",
    "Deskripsi",
    "Alasan Bisnis",
  ];

  const rows = logs.map((l) => [
    new Date(l.timestamp).toLocaleString("id-ID", { timeZone: "Asia/Makassar" }),
    resolveLogActorName(l) || "-",
    resolveLogActorRole(l) || "-",
    l.outletName || "-",
    l.module,
    l.action,
    resolveLogRecordId(l) || "-",
    resolveLogStatus(l),
    l.severity || "INFO",
    l.previousValue || "-",
    l.newValue || "-",
    l.description,
    l.reason || "-",
  ]);

  return { headers, rows };
}
