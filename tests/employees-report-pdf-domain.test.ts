import { describe, expect, it } from "vitest";

import {
  computeEmployeesReportPdfMetrics,
  buildEmployeesReportDocNumber,
  buildEmployeesReportSignatories,
  formatEmployeesReportPrintDate,
  formatEmployeeStatusLabel,
  formatEmployeeStatusTone,
} from "@/features/employees/employees-report-pdf-domain";
import type { Employee, ShiftRecord } from "@/types/shift";

const MOCK_EMPLOYEES: Employee[] = [
  {
    id: "emp-1",
    employeeNumber: "EMP-001",
    name: "Budi Santoso",
    role: "Kasir Senior",
    department: "Front Office",
    assignedShift: "Pagi (08:00–16:00)",
    status: "AKTIF",
    phone: "0812345678",
  },
  {
    id: "emp-2",
    employeeNumber: "EMP-002",
    name: "Dewi Lestari",
    role: "Barista",
    department: "F&B Bar",
    assignedShift: "Siang (12:00–20:00)",
    status: "AKTIF",
    phone: "0819876543",
  },
  {
    id: "emp-3",
    employeeNumber: "EMP-003",
    name: "Rudi Hartono",
    role: "Pramusaji",
    department: "Service Floor",
    assignedShift: "Sore (15:00–23:00)",
    status: "CUTI",
    phone: "0813334445",
  },
];

const MOCK_SHIFTS: ShiftRecord[] = [
  {
    id: "shift-1",
    cashierName: "Budi Santoso",
    cashierId: "emp-1",
    shiftName: "Shift Pagi",
    startTime: "2026-11-15T08:00:00Z",
    endTime: "2026-11-15T16:00:00Z",
    openingCash: 500000,
    closingCash: 2150000,
    expectedCash: 2150000,
    cashSales: 1650000,
    nonCashSales: 3200000,
    difference: 0,
    status: "CLOSED",
    notes: "Shift lancar",
  },
  {
    id: "shift-2",
    cashierName: "Dewi Lestari",
    cashierId: "emp-2",
    shiftName: "Shift Sore",
    startTime: "2026-11-15T16:00:00Z",
    openingCash: 500000,
    cashSales: 1200000,
    nonCashSales: 2100000,
    difference: 0,
    status: "OPEN",
    notes: "",
  },
];

describe("employees-report-pdf-domain", () => {
  it("computes executive summary metrics accurately without mutating input", () => {
    const originalEmployees = JSON.parse(JSON.stringify(MOCK_EMPLOYEES));
    const originalShifts = JSON.parse(JSON.stringify(MOCK_SHIFTS));

    const metrics = computeEmployeesReportPdfMetrics(MOCK_EMPLOYEES, MOCK_SHIFTS);

    expect(metrics.totalEmployees).toBe(3);
    expect(metrics.activeEmployees).toBe(2);
    expect(metrics.inactiveEmployees).toBe(1);
    expect(metrics.totalShifts).toBe(2);
    expect(metrics.completedShifts).toBe(1);
    expect(metrics.openShifts).toBe(1);
    expect(metrics.totalShiftSales).toBe((1650000 + 3200000) + (1200000 + 2100000)); // 4850000 + 3300000 = 8150000
    expect(metrics.averageSalesPerShift).toBe(Math.round(8150000 / 2));

    // Non-mutation check
    expect(MOCK_EMPLOYEES).toEqual(originalEmployees);
    expect(MOCK_SHIFTS).toEqual(originalShifts);
  });

  it("handles empty employees and shifts list gracefully with safe zero defaults", () => {
    const metrics = computeEmployeesReportPdfMetrics([], []);

    expect(metrics.totalEmployees).toBe(0);
    expect(metrics.activeEmployees).toBe(0);
    expect(metrics.inactiveEmployees).toBe(0);
    expect(metrics.totalShifts).toBe(0);
    expect(metrics.completedShifts).toBe(0);
    expect(metrics.openShifts).toBe(0);
    expect(metrics.totalShiftSales).toBe(0);
    expect(metrics.averageSalesPerShift).toBe(0);
  });

  it("builds a deterministic official document number without Math.random", () => {
    const date = new Date("2026-11-15T10:00:00Z");
    const docNum1 = buildEmployeesReportDocNumber(date, 9);
    const docNum2 = buildEmployeesReportDocNumber(date, 9);

    expect(docNum1).toBe("HR-SHIFT-20261115-009");
    expect(docNum1).toBe(docNum2);
  });

  it("builds 3 factual accountable signatories for HR and shift audit", () => {
    const signatories = buildEmployeesReportSignatories("Dago Creative Hub - Jimbaran");

    expect(signatories).toHaveLength(3);
    expect(signatories[0].role).toBe("Supervisor Shift Kasir");
    expect(signatories[1].role).toBe("Manajer SDM & Personalia");
    expect(signatories[2].role).toBe("Manajer Operasional Gerai");
    expect(signatories[0].outlet).toContain("Jimbaran");
  });

  it("formats employees report print date properly in Indonesian convention", () => {
    const date = new Date("2026-11-15T08:30:00Z");
    const formatted = formatEmployeesReportPrintDate(date);

    expect(formatted).toContain("15 November 2026");
  });

  it("translates employee statuses into standard Indonesian labels and semantic tones", () => {
    expect(formatEmployeeStatusLabel("AKTIF")).toBe("Aktif");
    expect(formatEmployeeStatusTone("AKTIF")).toBe("success");

    expect(formatEmployeeStatusLabel("CUTI")).toBe("Cuti");
    expect(formatEmployeeStatusTone("CUTI")).toBe("warning");

    expect(formatEmployeeStatusLabel("NONAKTIF")).toBe("Nonaktif");
    expect(formatEmployeeStatusTone("NONAKTIF")).toBe("neutral");
  });
});
