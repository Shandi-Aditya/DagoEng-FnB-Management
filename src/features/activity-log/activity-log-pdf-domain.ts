import type { ActivityLogEntry, AuditStatus } from "@/types/audit";

export interface ActivityLogPdfMetrics {
  totalCount: number;
  successCount: number;
  warningCount: number;
  failedCount: number;
  highSeverityCount: number;
}

export interface AuditSignatory {
  role: string;
  name: string;
  isSigner?: boolean;
}

export interface AuditDiffResult {
  hasDiff: boolean;
  before?: string;
  after?: string;
}

/**
 * Computes audit log summary metrics deterministically.
 */
export function computeActivityLogPdfMetrics(
  logs: readonly ActivityLogEntry[]
): ActivityLogPdfMetrics {
  let successCount = 0;
  let warningCount = 0;
  let failedCount = 0;
  let highSeverityCount = 0;

  for (const log of logs) {
    const resolvedStatus = log.status ?? "SUCCESS";
    if (resolvedStatus === "SUCCESS") {
      successCount++;
    } else if (resolvedStatus === "WARNING") {
      warningCount++;
    } else if (resolvedStatus === "FAILED") {
      failedCount++;
    }

    if (log.severity === "HIGH" || log.severity === "CRITICAL") {
      highSeverityCount++;
    }
  }

  return {
    totalCount: logs.length,
    successCount,
    warningCount,
    failedCount,
    highSeverityCount,
  };
}

/**
 * Formats audit status enum into Indonesian sentence case label.
 */
export function formatAuditStatusLabel(status?: AuditStatus): string {
  switch (status) {
    case "SUCCESS":
      return "Sukses";
    case "WARNING":
      return "Peringatan";
    case "FAILED":
      return "Gagal";
    default:
      return status || "Sukses";
  }
}

/**
 * Formats audit log difference between previous and new values.
 */
export function formatAuditDiffValues(
  prev?: string,
  next?: string
): AuditDiffResult {
  const hasDiff = Boolean(prev || next);
  return {
    hasDiff,
    before: prev?.trim() || undefined,
    after: next?.trim() || undefined,
  };
}

/**
 * Formats print date in WITA standard Indonesian format.
 */
export function formatAuditPrintDate(date: Date): string {
  // Asia/Makassar is UTC+8 (WITA)
  const dtf = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Makassar",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${dtf.format(date)} WITA`;
}

/**
 * Builds realistic 3-party audit signatories.
 */
export function buildAuditSignatories(
  generatedBy: string,
  _outletName: string
): AuditSignatory[] {
  return [
    {
      role: "Pembuat Laporan / Operator",
      name: generatedBy || "Staf / Kasir",
      isSigner: true,
    },
    {
      role: "Supervisor / Auditor Gerai",
      name: "______________________",
      isSigner: false,
    },
    {
      role: "Pimpinan / Owner Gerai",
      name: "______________________",
      isSigner: false,
    },
  ];
}
