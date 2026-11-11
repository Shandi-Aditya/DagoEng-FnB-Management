import { describe, expect, it } from "vitest";
import {
  calculateEmployeeKPIs,
  filterEmployees,
  filterShifts,
  getDepartmentBadgeTone,
  getEmployeeStatusLabel,
  getEmployeeStatusTone,
  getShiftStatusTone,
  getShiftStatusLabel,
  emptyShiftMessage,
  emptyEmployeeMessage,
  buildEmployeeExportData,
  ROLE_DEFAULT_PERMISSIONS,
} from "@/features/employees/employees-domain";
import type { EmployeeProfile, ShiftRecord } from "@/types/shift";

const mockEmployees: EmployeeProfile[] = [
  {
    id: "emp-1",
    employeeNumber: "EMP-001",
    name: "Wayan Darmawan",
    role: "Store Manager",
    department: "Management",
    outletId: "outlet-1",
    outletName: "Singaraja Hub",
    contact: "0812345678",
    email: "wayan@dagoeng.com",
    status: "AKTIF",
    assignedShift: "Shift Pagi (08:00 - 16:00)",
    joinedDate: "2024-01-01",
    permissions: ROLE_DEFAULT_PERMISSIONS["Store Manager"],
  },
  {
    id: "emp-2",
    employeeNumber: "EMP-002",
    name: "Ketut Suda",
    role: "Cashier",
    department: "Cashier",
    outletId: "outlet-1",
    outletName: "Singaraja Hub",
    contact: "0823456789",
    email: "ketut@dagoeng.com",
    status: "CUTI",
    assignedShift: "Shift Sore (16:00 - 24:00)",
    joinedDate: "2024-02-01",
    permissions: ROLE_DEFAULT_PERMISSIONS["Cashier"],
  },
];

const mockShifts: ShiftRecord[] = [
  {
    id: "shf-1",
    shiftName: "Shift Pagi (08:00 - 16:00)",
    outletId: "outlet-1",
    outletName: "Singaraja Hub",
    assignedCashierId: "emp-1",
    assignedCashierName: "Wayan Darmawan",
    startTime: "2026-10-01 08:00",
    status: "ACTIVE",
    openingCash: 500000,
    cashSales: 1500000,
    nonCashSales: 2500000,
    refundAmount: 0,
    expectedCash: 2000000,
    actualCash: 0,
    cashVariance: 0,
  },
  {
    id: "shf-2",
    shiftName: "Shift Kemarin",
    outletId: "outlet-1",
    outletName: "Singaraja Hub",
    assignedCashierId: "emp-2",
    assignedCashierName: "Ketut Suda",
    startTime: "2026-09-30 16:00",
    endTime: "2026-09-30 24:00",
    status: "CLOSED",
    openingCash: 500000,
    cashSales: 1200000,
    nonCashSales: 1800000,
    refundAmount: 0,
    expectedCash: 1700000,
    actualCash: 1700000,
    cashVariance: 0,
    closedAt: "2026-09-30 24:00",
  },
];

describe("employees-domain", () => {
  it("calculates employee and shift KPIs correctly", () => {
    const kpis = calculateEmployeeKPIs(mockShifts, mockEmployees);
    expect(kpis.totalEmployeesCount).toBe(2);
    expect(kpis.activeEmployeesCount).toBe(1);
    expect(kpis.totalShiftsCount).toBe(2);
    expect(kpis.activeShiftsCount).toBe(1);
  });

  it("filters employees by query, department, and status", () => {
    expect(filterEmployees(mockEmployees, "ALL", "ALL", "")).toHaveLength(2);
    expect(filterEmployees(mockEmployees, "Management", "ALL", "")).toHaveLength(1);
    expect(filterEmployees(mockEmployees, "ALL", "CUTI", "")).toHaveLength(1);
    expect(filterEmployees(mockEmployees, "ALL", "ALL", "wayan")).toHaveLength(1);
    expect(filterEmployees(mockEmployees, "ALL", "ALL", "nonexistent")).toHaveLength(0);
  });

  it("filters shifts by query and status", () => {
    expect(filterShifts(mockShifts, "")).toHaveLength(2);
    expect(filterShifts(mockShifts, "pagi")).toHaveLength(1);
    expect(filterShifts(mockShifts, "ketut")).toHaveLength(1);
    expect(filterShifts(mockShifts, "", "ACTIVE")).toHaveLength(1);
    expect(filterShifts(mockShifts, "", "CLOSED")).toHaveLength(1);
    expect(filterShifts(mockShifts, "", "NEEDS_RECONCILIATION")).toHaveLength(0);
  });

  it("returns proper status tones for department, employee status, and shift status", () => {
    expect(getDepartmentBadgeTone("Management")).toBe("info");
    expect(getDepartmentBadgeTone("Kitchen")).toBe("warning");

    expect(getEmployeeStatusTone("AKTIF")).toBe("success");
    expect(getEmployeeStatusTone("CUTI")).toBe("warning");
    expect(getEmployeeStatusTone("NON-AKTIF")).toBe("neutral");

    expect(getShiftStatusTone("ACTIVE")).toBe("info");
    expect(getShiftStatusTone("CLOSED")).toBe("success");
    expect(getShiftStatusTone("NEEDS_RECONCILIATION")).toBe("destructive");
  });

  it("builds export datasets for shifts and employees", () => {
    const shiftExport = buildEmployeeExportData("SHIFTS", mockShifts, [], "Singaraja");
    expect(shiftExport.headers).toHaveLength(12);
    expect(shiftExport.rows).toHaveLength(2);

    const empExport = buildEmployeeExportData("EMPLOYEES", [], mockEmployees, "Singaraja");
    expect(empExport.headers).toHaveLength(10);
    expect(empExport.rows).toHaveLength(2);
  });
});

describe("getEmployeeStatusLabel", () => {
  it("shows employment status in sentence case instead of the stored enum", () => {
    expect(getEmployeeStatusLabel("AKTIF")).toBe("Aktif");
    expect(getEmployeeStatusLabel("CUTI")).toBe("Cuti");
    expect(getEmployeeStatusLabel("NON-AKTIF")).toBe("Nonaktif");
  });
});

describe("getShiftStatusLabel", () => {
  it("maps shift statuses to human readable sentence case labels", () => {
    expect(getShiftStatusLabel("ACTIVE")).toBe("Sedang berjalan");
    expect(getShiftStatusLabel("CLOSED")).toBe("Ditutup");
    expect(getShiftStatusLabel("NEEDS_RECONCILIATION")).toBe("Selisih kas");
  });
});

describe("emptyShiftMessage and emptyEmployeeMessage", () => {
  it("provides distinct empty-state copy for shifts when filtered vs empty data", () => {
    const emptyShifts = emptyShiftMessage(false);
    expect(emptyShifts.title).toBe("Belum ada shift");

    const filteredShifts = emptyShiftMessage(true);
    expect(filteredShifts.title).toBe("Tidak ada shift yang cocok");
    expect(filteredShifts.description).toContain("Ubah kata kunci");
  });

  it("provides distinct empty-state copy for employees when filtered vs empty data", () => {
    const emptyEmp = emptyEmployeeMessage(false);
    expect(emptyEmp.title).toBe("Belum ada staf");

    const filteredEmp = emptyEmployeeMessage(true);
    expect(filteredEmp.title).toBe("Tidak ada staf yang cocok");
    expect(filteredEmp.description).toContain("Ubah kata kunci");
  });
});

