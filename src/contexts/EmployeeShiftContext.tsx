"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { EmployeeProfile, ShiftRecord, ShiftStatus } from "@/types/shift";
import { useAuth } from "./AuthContext";
import { useOutlet } from "./OutletContext";
import { useActivityLog } from "./ActivityLogContext";
import { useNotifications } from "./NotificationContext";

export const INITIAL_EMPLOYEES: EmployeeProfile[] = [
  {
    id: "emp-001",
    employeeNumber: "EMP-SGR-001",
    name: "Putu Arya",
    role: "Store Manager",
    department: "Management",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    contact: "+62 812-3456-7891",
    email: "putu.arya@kopisenja.com",
    status: "AKTIF",
    assignedShift: "Shift Pagi (08:00 - 16:00)",
    joinedDate: "10 Jan 2025",
    permissions: [
      "pos_access",
      "pos_discount",
      "pos_void",
      "pos_shift_close",
      "inventory_access",
      "menu_master_edit",
      "financial_reports",
      "coworking_manage",
      "staff_management",
    ],
  },
  {
    id: "emp-002",
    employeeNumber: "EMP-SGR-002",
    name: "Ni Kadek Sri",
    role: "Head Cashier",
    department: "Cashier",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    contact: "+62 812-3456-7892",
    email: "kadek.sri@kopisenja.com",
    status: "AKTIF",
    assignedShift: "Shift Pagi (08:00 - 16:00)",
    joinedDate: "15 Jan 2025",
    permissions: ["pos_access", "pos_discount", "pos_shift_close"],
  },
  {
    id: "emp-003",
    employeeNumber: "EMP-SGR-003",
    name: "Gede Agus",
    role: "Head Chef",
    department: "Kitchen",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    contact: "+62 812-3456-7893",
    email: "gede.agus@kopisenja.com",
    status: "AKTIF",
    assignedShift: "Shift Pagi (08:00 - 16:00)",
    joinedDate: "01 Feb 2025",
    permissions: ["pos_access", "inventory_access"],
  },
  {
    id: "emp-004",
    employeeNumber: "EMP-SGR-004",
    name: "Komang Bayu",
    role: "Inventory Specialist",
    department: "Inventory",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    contact: "+62 812-3456-7894",
    email: "komang.bayu@kopisenja.com",
    status: "AKTIF",
    assignedShift: "Reguler (09:00 - 17:00)",
    joinedDate: "01 Mar 2025",
    permissions: ["inventory_access"],
  },
  {
    id: "emp-005",
    employeeNumber: "EMP-SGR-005",
    name: "Made Surya",
    role: "Floor Waiter",
    department: "Service",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    contact: "+62 812-3456-7895",
    email: "made.surya@kopisenja.com",
    status: "AKTIF",
    assignedShift: "Shift Pagi (08:00 - 16:00)",
    joinedDate: "10 Apr 2025",
    permissions: ["pos_access"],
  },
  {
    id: "emp-006",
    employeeNumber: "EMP-DPS-001",
    name: "I Wayan Pratama",
    role: "Outlet Supervisor",
    department: "Management",
    outletId: "outlet-dps",
    outletName: "Denpasar",
    contact: "+62 813-9988-7766",
    email: "wayan.pratama@kopisenja.com",
    status: "AKTIF",
    assignedShift: "Shift Sore (14:00 - 22:00)",
    joinedDate: "01 Jun 2025",
    permissions: [
      "pos_access",
      "pos_discount",
      "pos_void",
      "pos_shift_close",
      "inventory_access",
      "financial_reports",
      "coworking_manage",
    ],
  },
];

export const INITIAL_SHIFTS: ShiftRecord[] = [];

interface EmployeeShiftContextType {
  employees: EmployeeProfile[];
  filteredEmployees: EmployeeProfile[];
  shifts: ShiftRecord[];
  filteredShifts: ShiftRecord[];
  activeShift: ShiftRecord | null;
  createEmployee: (emp: Omit<EmployeeProfile, "id" | "employeeNumber">) => EmployeeProfile;
  updateEmployee: (id: string, updates: Partial<EmployeeProfile>) => void;
  toggleEmployeeStatus: (id: string) => void;
  deleteEmployee: (id: string) => void;
  openShift: (shiftName: string, openingCash: number, cashierName?: string) => ShiftRecord;
  closeShift: (shiftId: string, actualCash: number, closingNotes?: string) => void;
  resetEmployeeShiftData: () => void;
}

const EmployeeShiftContext = createContext<EmployeeShiftContextType | undefined>(undefined);
const STORAGE_KEY_EMPLOYEES = "dagoeng_employees_v1";
const STORAGE_KEY_SHIFTS = "dagoeng_shifts_v3";

export function EmployeeShiftProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeOutletId, activeOutlet, isAllOutlets } = useOutlet();
  const { logActivity } = useActivityLog();
  const { addNotification } = useNotifications();

  const [employees, setEmployees] = useState<EmployeeProfile[]>(INITIAL_EMPLOYEES);
  const [shifts, setShifts] = useState<ShiftRecord[]>(INITIAL_SHIFTS);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const savedEmp = localStorage.getItem(STORAGE_KEY_EMPLOYEES);
      const savedShf = localStorage.getItem(STORAGE_KEY_SHIFTS);
      if (savedEmp) setEmployees(JSON.parse(savedEmp));
      if (savedShf) setShifts(JSON.parse(savedShf));
    } catch (e) {
      console.error("Failed to load employee & shift data", e);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEY_EMPLOYEES, JSON.stringify(employees));
      localStorage.setItem(STORAGE_KEY_SHIFTS, JSON.stringify(shifts));
    } catch (e) {
      console.error("Failed to save employee & shift data", e);
    }
  }, [employees, shifts, isInitialized]);

  const filteredEmployees = employees.filter((e) => {
    if (isAllOutlets) return true;
    return e.outletId === activeOutletId || !e.outletId;
  });

  const filteredShifts = shifts.filter((s) => {
    if (isAllOutlets) return true;
    return s.outletId === activeOutletId || !s.outletId;
  });

  const activeShift = filteredShifts.find((s) => s.status === "ACTIVE" || s.status === "OPEN") || null;

  const createEmployee = (empData: Omit<EmployeeProfile, "id" | "employeeNumber">): EmployeeProfile => {
    const code = empData.outletName.slice(0, 3).toUpperCase();
    const newEmp: EmployeeProfile = {
      ...empData,
      id: `emp-${Date.now()}`,
      employeeNumber: `EMP-${code}-${Math.floor(100 + Math.random() * 900)}`,
    };

    setEmployees((prev) => [newEmp, ...prev]);

    logActivity({
      module: "EMPLOYEES_SHIFT",
      action: "CREATE_EMPLOYEE",
      recordId: newEmp.id,
      newValue: `${newEmp.name} (${newEmp.role} - ${newEmp.outletName})`,
      description: `Penambahan data karyawan baru: ${newEmp.name} (${newEmp.employeeNumber})`,
      reason: "Rekrutmen staf baru gerai",
      status: "SUCCESS",
      outletId: newEmp.outletId,
      outletName: newEmp.outletName,
    });

    return newEmp;
  };

  const toggleEmployeeStatus = (id: string) => {
    const target = employees.find((e) => e.id === id);
    if (!target) return;
    const nextStatus = target.status === "AKTIF" ? "CUTI" : target.status === "CUTI" ? "NON-AKTIF" : "AKTIF";

    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: nextStatus } : e))
    );

    logActivity({
      module: "EMPLOYEES_SHIFT",
      action: "UPDATE_EMPLOYEE_STATUS",
      recordId: id,
      previousValue: `Status: ${target.status}`,
      newValue: `Status: ${nextStatus}`,
      description: `Perubahan status kerja karyawan ${target.name}`,
      reason: `Ubah status kerja menjadi ${nextStatus}`,
      status: "SUCCESS",
      outletId: target.outletId,
      outletName: target.outletName,
    });
  };

  const updateEmployee = (id: string, updates: Partial<EmployeeProfile>) => {
    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
    );

    logActivity({
      module: "EMPLOYEES_SHIFT",
      action: "UPDATE_EMPLOYEE",
      recordId: id,
      newValue: JSON.stringify(updates),
      description: `Pembaruan profil & hak akses karyawan (ID: ${id})`,
      reason: "Penyesuaian jabatan / hak akses staf",
      status: "SUCCESS",
    });
  };

  const deleteEmployee = (id: string) => {
    const target = employees.find((e) => e.id === id);
    if (!target) return;

    setEmployees((prev) => prev.filter((e) => e.id !== id));

    logActivity({
      module: "EMPLOYEES_SHIFT",
      action: "DELETE_EMPLOYEE",
      recordId: id,
      previousValue: target.name,
      newValue: "DELETED",
      description: `Penghapusan data karyawan ${target.name} (${target.employeeNumber})`,
      reason: "Karyawan non-aktif diarsipkan",
      status: "SUCCESS",
      outletId: target.outletId,
      outletName: target.outletName,
    });
  };

  const openShift = (shiftName: string, openingCash: number, cashierName?: string): ShiftRecord => {
    const nowFormatted = new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) + " WITA";
    const targetOutletId = activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr";
    const targetOutletName = activeOutlet?.name || "Singaraja";

    const newShift: ShiftRecord = {
      id: `shf-${Date.now()}`,
      shiftName,
      outletId: targetOutletId,
      outletName: targetOutletName,
      assignedCashierId: user?.id || "emp-002",
      assignedCashierName: cashierName || user?.name || "Ni Kadek Sri",
      startTime: nowFormatted,
      status: "ACTIVE",
      openingCash,
      cashSales: 0,
      nonCashSales: 0,
      refundAmount: 0,
      expectedCash: openingCash,
      actualCash: openingCash,
      cashVariance: 0,
    };

    setShifts((prev) => [newShift, ...prev]);

    logActivity({
      module: "EMPLOYEES_SHIFT",
      action: "OPEN_SHIFT",
      recordId: newShift.id,
      newValue: `Modal Awal: Rp ${openingCash.toLocaleString()} (Kasir: ${newShift.assignedCashierName})`,
      description: `Pembukaan kasir baru: ${shiftName} di ${targetOutletName}`,
      reason: "Shift kasir resmi dibuka",
      status: "SUCCESS",
      outletId: targetOutletId,
      outletName: targetOutletName,
    });

    return newShift;
  };

  const closeShift = (shiftId: string, actualCash: number, closingNotes?: string) => {
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) return;

    const nowFormatted = new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) + " WITA";
    const expected = shift.openingCash + shift.cashSales - shift.refundAmount;
    const variance = actualCash - expected;

    setShifts((prev) =>
      prev.map((s) =>
        s.id === shiftId
          ? {
              ...s,
              status: "CLOSED",
              endTime: nowFormatted,
              actualCash,
              cashVariance: variance,
              closingNotes,
              closedAt: nowFormatted,
              closedBy: user?.name || "Ni Kadek Sri",
            }
          : s
      )
    );

    addNotification({
      type: "SHIFT_CLOSED",
      title: "Rekonsiliasi Shift Kasir Ditutup",
      detail: `${shift.shiftName} (${shift.outletName}) ditutup. Selisih Kas: Rp ${variance.toLocaleString()}.`,
      relatedModule: "EMPLOYEES_SHIFT",
      actionUrl: "/employees",
      outletId: shift.outletId,
      outletName: shift.outletName,
    });

    logActivity({
      module: "EMPLOYEES_SHIFT",
      action: "CLOSE_SHIFT",
      recordId: shiftId,
      previousValue: `Expected Cash: Rp ${expected.toLocaleString()}`,
      newValue: `Actual Cash: Rp ${actualCash.toLocaleString()} (Variance: ${variance >= 0 ? "+" : ""}${variance.toLocaleString()})`,
      description: `Penutupan dan rekonsiliasi kasir shift ${shift.shiftName}`,
      reason: closingNotes || "Closing shift selesai",
      status: variance !== 0 ? "WARNING" : "SUCCESS",
      outletId: shift.outletId,
      outletName: shift.outletName,
    });
  };

  const resetEmployeeShiftData = () => {
    setEmployees(INITIAL_EMPLOYEES);
    setShifts(INITIAL_SHIFTS);
    try {
      localStorage.removeItem(STORAGE_KEY_EMPLOYEES);
      localStorage.removeItem(STORAGE_KEY_SHIFTS);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <EmployeeShiftContext.Provider
      value={{
        employees,
        filteredEmployees,
        shifts,
        filteredShifts,
        activeShift,
        createEmployee,
        updateEmployee,
        toggleEmployeeStatus,
        deleteEmployee,
        openShift,
        closeShift,
        resetEmployeeShiftData,
      }}
    >
      {children}
    </EmployeeShiftContext.Provider>
  );
}

export function useEmployeeShift() {
  const context = useContext(EmployeeShiftContext);
  if (!context) {
    throw new Error("useEmployeeShift must be used within an EmployeeShiftProvider");
  }
  return context;
}
