/**
 * Domain murni pelacakan aktivitas dan audit trail.
 * Mengelola pemfilteran, kalkulasi KPI, aggregasi aktor/role, dan pembuat data ekspor.
 *
 * Importer:
 * - src/app/(dashboard)/activity-log/page.tsx
 * - src/features/activity-log/ActivityLogTableView.tsx
 * - src/features/activity-log/ActivityLogTimelineView.tsx
 * - src/features/activity-log/ActivityLogFilterBar.tsx
 * - tests/activity-log-domain.test.ts
 */

import {
  ActivityLogEntry,
  ActivityModule,
  AuditStatus,
  ActivitySeverity,
} from "@/types/audit";
import { StatusTone } from "@/components/app/status-badge";

export type ViewMode = "TABLE" | "TIMELINE";
export type DateFilterType = "ALL" | "TODAY" | "LAST_7_DAYS" | "LAST_30_DAYS";

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
  { key: "ALL", label: "Semua Modul" },
  { key: "POS", label: "POS & Kasir" },
  { key: "TABLES", label: "Meja & Reservasi" },
  { key: "INVENTORY", label: "Smart Inventory" },
  { key: "MENU", label: "Katalog Menu" },
  { key: "LOYALTY", label: "Loyalty CRM" },
  { key: "COWORKING", label: "Co-working" },
  { key: "COMMERCIAL", label: "Commercial Leases" },
  { key: "EMPLOYEES_SHIFT", label: "Shift & Staf" },
  { key: "SETTINGS", label: "Pengaturan Platform" },
  { key: "AUTH", label: "Keamanan & Auth" },
  { key: "AI_INSIGHT", label: "AI Advisor" },
];

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
export function getPeriodLabel(dateFilter: DateFilterType): string {
  if (dateFilter === "TODAY") {
    return `Hari Ini (${new Date().toLocaleDateString("id-ID")})`;
  }
  if (dateFilter === "LAST_7_DAYS") return "7 Hari Terakhir";
  if (dateFilter === "LAST_30_DAYS") return "30 Hari Terakhir";
  return "Semua Rekam Audit";
}

/**
 * Mengekstrak daftar unik role aktor yang tercatat dalam log.
 */
export function getUniqueRoles(logs: ActivityLogEntry[]): string[] {
  const rolesSet = new Set<string>();
  for (const log of logs) {
    if (log.actorRole) rolesSet.add(log.actorRole);
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
    if (log.actorName) actorsSet.add(log.actorName);
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
    searchTerm = "",
  } = options;

  const now = Date.now();
  const search = searchTerm.trim().toLowerCase();

  return logs.filter((log) => {
    // Tenant isolation
    if (isTenantOwner && tenantId) {
      if (log.tenantId && log.tenantId !== tenantId) {
        return false;
      }
    }

    // Outlet filter
    if (activeOutletId !== "ALL" && log.outletId && log.outletId !== activeOutletId) {
      return false;
    }

    // Module filter
    if (selectedModule !== "ALL" && log.module !== selectedModule) {
      return false;
    }

    // Status filter
    if (selectedStatus !== "ALL" && log.status !== selectedStatus) {
      return false;
    }

    // Severity filter
    if (selectedSeverity !== "ALL" && log.severity !== selectedSeverity) {
      return false;
    }

    // Role filter
    if (
      selectedRole !== "ALL" &&
      log.actorRole !== selectedRole &&
      log.role !== selectedRole
    ) {
      return false;
    }

    // Actor filter
    if (selectedActor !== "ALL" && log.actorName !== selectedActor) {
      return false;
    }

    // Date range filter
    const logTime = new Date(log.timestamp).getTime();
    if (dateFilter === "TODAY") {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      if (logTime < startOfDay.getTime()) return false;
    } else if (dateFilter === "LAST_7_DAYS") {
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      if (logTime < sevenDaysAgo) return false;
    } else if (dateFilter === "LAST_30_DAYS") {
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
      if (logTime < thirtyDaysAgo) return false;
    }

    // Search query matching
    if (search) {
      const matchActor = log.actorName?.toLowerCase().includes(search);
      const matchRole = log.actorRole?.toLowerCase().includes(search);
      const matchAction = log.action?.toLowerCase().includes(search);
      const matchDesc = log.description?.toLowerCase().includes(search);
      const matchReason = log.reason?.toLowerCase().includes(search);
      const matchRecord = log.recordId?.toLowerCase().includes(search);
      const matchPrev = log.previousValue?.toLowerCase().includes(search);
      const matchNext = log.newValue?.toLowerCase().includes(search);

      if (
        !matchActor &&
        !matchRole &&
        !matchAction &&
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
  const successCount = logs.filter((l) => l.status === "SUCCESS").length;
  const warningCount = logs.filter((l) => l.status === "WARNING").length;
  const failedCount = logs.filter((l) => l.status === "FAILED").length;
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
    new Date(l.timestamp).toLocaleString("id-ID"),
    l.actorName || "-",
    l.actorRole || "-",
    l.outletName || "-",
    l.module,
    l.action,
    l.recordId || "-",
    l.status || "SUCCESS",
    l.severity || "INFO",
    l.previousValue || "-",
    l.newValue || "-",
    l.description,
    l.reason || "-",
  ]);

  return { headers, rows };
}
