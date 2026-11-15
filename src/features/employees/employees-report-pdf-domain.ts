import type { Employee, ShiftRecord } from "@/types/shift";

export interface EmployeesReportPdfMetrics {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  totalShifts: number;
  completedShifts: number;
  openShifts: number;
  totalShiftSales: number;
  averageSalesPerShift: number;
}

export interface ReportSignatory {
  role: string;
  department: string;
  outlet: string;
}

export type StatusBadgeTone = "success" | "warning" | "info" | "destructive" | "neutral";

/**
 * Pure calculation of aggregated HR roster & shift reconciliation metrics.
 * Does not mutate input arrays.
 */
export function computeEmployeesReportPdfMetrics(
  employees: readonly Employee[],
  shifts: readonly ShiftRecord[]
): EmployeesReportPdfMetrics {
  const totalEmployees = employees.length;
  const totalShifts = shifts.length;

  let activeEmployees = 0;
  let inactiveEmployees = 0;

  for (const e of employees) {
    if (e.status === "AKTIF") activeEmployees++;
    else inactiveEmployees++;
  }

  let completedShifts = 0;
  let openShifts = 0;
  let totalShiftSales = 0;

  for (const s of shifts) {
    if (s.status === "CLOSED") completedShifts++;
    else if (s.status === "OPEN") openShifts++;

    const cash = s.cashSales || 0;
    const nonCash = s.nonCashSales || 0;
    totalShiftSales += cash + nonCash;
  }

  const averageSalesPerShift =
    totalShifts > 0 ? Math.round(totalShiftSales / totalShifts) : 0;

  return {
    totalEmployees,
    activeEmployees,
    inactiveEmployees,
    totalShifts,
    completedShifts,
    openShifts,
    totalShiftSales,
    averageSalesPerShift,
  };
}

/**
 * Generates a deterministic document number without Math.random.
 */
export function buildEmployeesReportDocNumber(date: Date, employeeCount: number): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const countStr = String(employeeCount).padStart(3, "0");
  return `HR-SHIFT-${year}${month}${day}-${countStr}`;
}

/**
 * Generates 3 accountable factual signatories for HR and shift audit.
 */
export function buildEmployeesReportSignatories(outletName: string): ReportSignatory[] {
  const cleanOutlet = outletName?.trim() || "Semua Outlet";
  return [
    {
      role: "Supervisor Shift Kasir",
      department: "Cashier & Roster Operations",
      outlet: cleanOutlet,
    },
    {
      role: "Manajer SDM & Personalia",
      department: "Human Resources & Talent",
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
export function formatEmployeesReportPrintDate(date: Date): string {
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Makassar",
  });
}

/**
 * Standard Indonesian label for employee status.
 */
export function formatEmployeeStatusLabel(status?: string): string {
  switch (status) {
    case "AKTIF":
      return "Aktif";
    case "CUTI":
      return "Cuti";
    case "NONAKTIF":
      return "Nonaktif";
    default:
      return status || "—";
  }
}

/**
 * Semantic tone for employee status.
 */
export function formatEmployeeStatusTone(status?: string): StatusBadgeTone {
  switch (status) {
    case "AKTIF":
      return "success";
    case "CUTI":
      return "warning";
    case "NONAKTIF":
      return "neutral";
    default:
      return "neutral";
  }
}
