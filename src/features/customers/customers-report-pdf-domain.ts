import type { LoyaltyMember } from "@/types/loyalty";

export interface CustomersReportPdfMetrics {
  totalMembers: number;
  platinumCount: number;
  goldCount: number;
  silverCount: number;
  vipCount: number;
  totalPoints: number;
  totalSpend: number;
  averageSpendPerMember: number;
}

export interface ReportSignatory {
  role: string;
  department: string;
  outlet: string;
}

export type StatusBadgeTone = "success" | "warning" | "info" | "destructive" | "neutral";

/**
 * Pure calculation of aggregated CRM and loyalty metrics.
 * Does not mutate input array.
 */
export function computeCustomersReportPdfMetrics(
  members: readonly LoyaltyMember[]
): CustomersReportPdfMetrics {
  const totalMembers = members.length;
  if (totalMembers === 0) {
    return {
      totalMembers: 0,
      platinumCount: 0,
      goldCount: 0,
      silverCount: 0,
      vipCount: 0,
      totalPoints: 0,
      totalSpend: 0,
      averageSpendPerMember: 0,
    };
  }

  let platinumCount = 0;
  let goldCount = 0;
  let silverCount = 0;
  let totalPoints = 0;
  let totalSpend = 0;

  for (const m of members) {
    if (m.tier === "Platinum") platinumCount++;
    else if (m.tier === "Gold") goldCount++;
    else if (m.tier === "Silver") silverCount++;

    totalPoints += m.points || 0;
    totalSpend += m.totalSpend || 0;
  }

  const vipCount = platinumCount + goldCount;
  const averageSpendPerMember = Math.round(totalSpend / totalMembers);

  return {
    totalMembers,
    platinumCount,
    goldCount,
    silverCount,
    vipCount,
    totalPoints,
    totalSpend,
    averageSpendPerMember,
  };
}

/**
 * Generates a deterministic document number without Math.random.
 */
export function buildCustomersReportDocNumber(date: Date, memberCount: number): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const countStr = String(memberCount).padStart(3, "0");
  return `CRM-REP-${year}${month}${day}-${countStr}`;
}

/**
 * Generates 3 accountable factual signatories for the CRM audit.
 */
export function buildCustomersReportSignatories(outletName: string): ReportSignatory[] {
  const cleanOutlet = outletName?.trim() || "Semua Outlet";
  return [
    {
      role: "Staf Front Office & CRM",
      department: "Customer Service & Loyalty",
      outlet: cleanOutlet,
    },
    {
      role: "Supervisor Loyalty & Program",
      department: "Retention & CRM Marketing",
      outlet: cleanOutlet,
    },
    {
      role: "Manajer Operasional Gerai",
      department: "Branch Operations Management",
      outlet: cleanOutlet,
    },
  ];
}

/**
 * Formats report generation date in standard Indonesian format.
 */
export function formatCustomersReportPrintDate(date: Date): string {
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Makassar",
  });
}

/**
 * Label for member loyalty tier.
 */
export function formatCustomerTierLabel(tier?: string): string {
  if (!tier) return "Standard";
  return tier;
}

/**
 * Semantic tone for customer loyalty tier.
 */
export function formatCustomerTierTone(tier?: string): StatusBadgeTone {
  switch (tier?.toLowerCase()) {
    case "platinum":
      return "success";
    case "gold":
      return "warning";
    case "silver":
      return "info";
    default:
      return "neutral";
  }
}
