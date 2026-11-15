import type { CommercialLease } from "@/types/commercial";

export interface CommercialReportPdfMetrics {
  totalLeases: number;
  activeLeases: number;
  expiringSoonLeases: number;
  terminatedLeases: number;
  occupancyRatePercent: number;
  totalAnnualValue: number;
  totalDepositHeld: number;
  totalPaidRevenue: number;
  averageMonthlyRent: number;
}

export interface ReportSignatory {
  role: string;
  department: string;
  outlet: string;
}

export type StatusBadgeTone = "success" | "warning" | "info" | "destructive" | "neutral";

/**
 * Pure calculation of aggregated commercial property metrics.
 * Does not mutate input array.
 */
export function computeCommercialReportPdfMetrics(
  leases: readonly CommercialLease[]
): CommercialReportPdfMetrics {
  const totalLeases = leases.length;
  if (totalLeases === 0) {
    return {
      totalLeases: 0,
      activeLeases: 0,
      expiringSoonLeases: 0,
      terminatedLeases: 0,
      occupancyRatePercent: 0,
      totalAnnualValue: 0,
      totalDepositHeld: 0,
      totalPaidRevenue: 0,
      averageMonthlyRent: 0,
    };
  }

  let activeLeases = 0;
  let expiringSoonLeases = 0;
  let terminatedLeases = 0;
  let totalMonthlyRent = 0;
  let totalDepositHeld = 0;
  let totalPaidRevenue = 0;

  for (const l of leases) {
    if (l.status === "ACTIVE") activeLeases++;
    else if (l.status === "EXPIRING_SOON") expiringSoonLeases++;
    else if (l.status === "TERMINATED") terminatedLeases++;

    totalMonthlyRent += l.monthlyRent || 0;
    totalDepositHeld += l.depositAmount || 0;

    if (Array.isArray(l.paymentHistory)) {
      for (const p of l.paymentHistory) {
        totalPaidRevenue += p.amount || 0;
      }
    }
  }

  const occupiedCount = activeLeases + expiringSoonLeases;
  const occupancyRatePercent = Math.round((occupiedCount / totalLeases) * 100);
  const totalAnnualValue = totalMonthlyRent * 12;
  const averageMonthlyRent = Math.round(totalMonthlyRent / totalLeases);

  return {
    totalLeases,
    activeLeases,
    expiringSoonLeases,
    terminatedLeases,
    occupancyRatePercent,
    totalAnnualValue,
    totalDepositHeld,
    totalPaidRevenue,
    averageMonthlyRent,
  };
}

/**
 * Generates a deterministic document number without Math.random.
 */
export function buildCommercialReportDocNumber(date: Date, leaseCount: number): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const countStr = String(leaseCount).padStart(3, "0");
  return `COMM-REP-${year}${month}${day}-${countStr}`;
}

/**
 * Generates 3 accountable factual signatories for commercial property management.
 */
export function buildCommercialReportSignatories(outletName: string): ReportSignatory[] {
  const cleanOutlet = outletName?.trim() || "Semua Outlet";
  return [
    {
      role: "Staf Administrasi Properti",
      department: "Property & Lease Operations",
      outlet: cleanOutlet,
    },
    {
      role: "Supervisor Komersial & Tenant",
      department: "Tenant Relations & Asset Audit",
      outlet: cleanOutlet,
    },
    {
      role: "Direktur Komersial & Bisnis",
      department: "Commercial Property Directorate",
      outlet: cleanOutlet,
    },
  ];
}

/**
 * Formats report generation date in standard Indonesian format.
 */
export function formatCommercialReportPrintDate(date: Date): string {
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Makassar",
  });
}

/**
 * Standard Indonesian label for commercial lease status.
 */
export function formatCommercialLeaseStatusLabel(status?: string): string {
  switch (status) {
    case "ACTIVE":
      return "Aktif";
    case "EXPIRING_SOON":
      return "Segera berakhir";
    case "TERMINATED":
      return "Selesai";
    default:
      return status || "—";
  }
}

/**
 * Semantic tone for commercial lease status.
 */
export function formatCommercialLeaseStatusTone(status?: string): StatusBadgeTone {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "EXPIRING_SOON":
      return "warning";
    case "TERMINATED":
      return "neutral";
    default:
      return "neutral";
  }
}
