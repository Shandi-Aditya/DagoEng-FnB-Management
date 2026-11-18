"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { EmployeeProfile, ShiftRecord } from "@/types/shift";
import { useAuth } from "./AuthContext";
import { useOutlet } from "./OutletContext";
import { useActivityLog } from "./ActivityLogContext";
import { useNotifications } from "./NotificationContext";
import {
  reconcileOverdueShifts,
  getActiveShiftForCashier,
  validateManualShiftOpen,
  recordShiftSaleTransaction,
  recordShiftRefundTransaction,
  reconcileClientShiftAfterServerOpen,
  hydrateShiftsFromServer,
} from "@/lib/shift-management";
import {
  ensureGlobalOutboxAutoFlush,
  flushOutbox,
  getOutboxItems,
  OUTBOX_FLUSHED_EVENT,
  reconcileCollectionWithOutbox,
  syncWithOutbox,
} from "@/lib/sync-outbox";
import { INITIAL_EMPLOYEES } from "@/lib/master-data-defaults";
export { INITIAL_EMPLOYEES } from "@/lib/master-data-defaults";

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
  recordShiftTransaction: (cashAmount: number, nonCashAmount: number, outletId?: string, saleId?: string) => void;
  recordShiftRefund: (refundAmount: number, orderId?: string, outletId?: string) => void;
  closeShift: (
    shiftId: string,
    actualCash: number,
    closingNotes?: string,
    metrics?: { cashSales?: number; nonCashSales?: number }
  ) => void;
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
      if (savedEmp !== null) {
        const parsedEmp = JSON.parse(savedEmp);
        setEmployees(Array.isArray(parsedEmp) ? parsedEmp : INITIAL_EMPLOYEES);
      } else {
        setEmployees(INITIAL_EMPLOYEES);
      }
      if (savedShf !== null) {
        const parsedShf = JSON.parse(savedShf);
        setShifts(Array.isArray(parsedShf) ? parsedShf : []);
      } else {
        setShifts([]);
      }
    } catch (e) {
      console.error("Failed to load employee & shift data", e);
    } finally {
      setIsInitialized(true);
    }
    ensureGlobalOutboxAutoFlush();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const hydrateFromServer = () => {
      fetch("/api/shifts")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled || !data || !Array.isArray(data.shifts)) return;
          const pendingShiftIds = getOutboxItems()
            .filter((item) => item.endpoint === "/api/shifts")
            .map((item) => String(item.payload.shiftId || item.id));
          setShifts((prev) =>
            hydrateShiftsFromServer(prev, data.shifts, pendingShiftIds)
          );
        })
        .catch(() => {});

      fetch("/api/employees")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled || !data || !Array.isArray(data.employees)) return;
          setEmployees((prev) =>
            reconcileCollectionWithOutbox({
              serverItems: data.employees,
              localItems: prev,
              endpoint: "/api/employees",
              getId: (e) => e.id,
            })
          );
        })
        .catch(() => {});
    };

    flushOutbox()
      .then(({ rejected }) => {
        if (cancelled) return;
        for (const { item, error } of rejected) {
          if (item.endpoint === "/api/shifts") {
            addNotification({
              type: "SYSTEM_ALERT",
              title: `Sinkronisasi shift (${String(item.payload.action || "-")}) ditolak server`,
              detail: error,
              relatedModule: "EMPLOYEES_SHIFT",
              actionUrl: "/employees",
              outletId: String(item.payload.outletId || "outlet-sgr"),
              outletName: String(item.payload.outletName || ""),
            });
          } else if (item.endpoint === "/api/employees") {
            const empPayload = (item.payload.employee || item.payload) as Partial<EmployeeProfile>;
            addNotification({
              type: "SYSTEM_ALERT",
              title: `Sinkronisasi data karyawan (${empPayload.name || item.id}) ditolak server`,
              detail: error,
              relatedModule: "EMPLOYEES_SHIFT",
              actionUrl: "/employees",
              outletId: String(empPayload.outletId || "outlet-sgr"),
              outletName: String(empPayload.outletName || ""),
            });
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          hydrateFromServer();
        }
      });

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY_EMPLOYEES) {
        if (event.newValue === null) {
          setEmployees(INITIAL_EMPLOYEES);
          return;
        }
        try {
          const parsed = JSON.parse(event.newValue);
          if (Array.isArray(parsed)) setEmployees(parsed);
        } catch {}
      } else if (event.key === STORAGE_KEY_SHIFTS) {
        if (event.newValue === null) {
          setShifts([]);
          return;
        }
        try {
          const parsed = JSON.parse(event.newValue);
          if (Array.isArray(parsed)) setShifts(parsed);
        } catch {}
      }
    };

    const handleOutboxFlushed = () => {
      hydrateFromServer();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(OUTBOX_FLUSHED_EVENT, handleOutboxFlushed);

    return () => {
      cancelled = true;
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(OUTBOX_FLUSHED_EVENT, handleOutboxFlushed);
    };
  }, [user?.id]);

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

  // POS-02 / TC-A02: Active shift is strictly bound to the logged-in cashier (user.id).
  const activeShift = getActiveShiftForCashier(
    filteredShifts,
    user?.id || null,
    isAllOutlets ? "ALL" : activeOutletId
  );

  // QA Handover A1: Shift kasir wajib dibuka manual dengan modal awal.
  // Otomatis tandai shift aktif gantung yang melebihi 16 jam sebagai NEEDS_RECONCILIATION.
  useEffect(() => {
    if (!isInitialized) return;
    setShifts((prev) => {
      const { shifts: next, changed } = reconcileOverdueShifts(prev, Date.now());
      return changed ? next : prev;
    });
  }, [isInitialized]);

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

    syncWithOutbox({
      id: newEmp.id,
      endpoint: "/api/employees",
      method: "POST",
      isCreate: true,
      payload: { id: newEmp.id, employee: newEmp },
    }).catch(() => {});

    return newEmp;
  };

  const toggleEmployeeStatus = (id: string) => {
    const target = employees.find((e) => e.id === id);
    if (!target) return;
    const nextStatus: EmployeeProfile["status"] =
      target.status === "AKTIF" ? "CUTI" : target.status === "CUTI" ? "NON-AKTIF" : "AKTIF";
    const updatedEmployee: EmployeeProfile = { ...target, status: nextStatus };

    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? updatedEmployee : e))
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

    syncWithOutbox({
      id: updatedEmployee.id,
      endpoint: "/api/employees",
      method: "PUT",
      payload: { id: updatedEmployee.id, employee: updatedEmployee },
    }).catch(() => {});
  };

  const updateEmployee = (id: string, updates: Partial<EmployeeProfile>) => {
    const target = employees.find((e) => e.id === id);
    const updatedEmployee = target ? { ...target, ...updates } : updates;

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

    syncWithOutbox({
      id,
      endpoint: "/api/employees",
      method: "PUT",
      payload: { id, employee: updatedEmployee, updates },
    }).catch(() => {});
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

    syncWithOutbox({
      id,
      endpoint: "/api/employees",
      method: "DELETE",
      payload: { id },
    }).catch(() => {});
  };

  const openShift = (shiftName: string, openingCash: number, cashierName?: string): ShiftRecord => {
    const targetOutletId = activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr";
    const targetOutletName = activeOutlet?.name || "Singaraja";
    const assignedId = user?.id || "emp-002";
    const assignedName = cashierName || user?.name || "Kasir Bertugas";

    const validation = validateManualShiftOpen({
      openingCash,
      shiftName,
      cashierId: assignedId,
      cashierName: assignedName,
      outletId: targetOutletId,
      outletName: targetOutletName,
      existingShifts: shifts,
    });

    if (!validation.success) {
      if (validation.isAlreadyOpen && validation.shift) {
        return validation.shift;
      }
      throw new Error(validation.error || "Gagal membuka shift kasir.");
    }

    const newShift = validation.shift!;

    if (typeof window !== "undefined" && user) {
      sessionStorage.removeItem(`dagoeng_shift_closed_${user.id}_${targetOutletId}`);
    }

    setShifts((prev) => [newShift, ...prev]);

    logActivity({
      module: "EMPLOYEES_SHIFT",
      action: "OPEN_SHIFT",
      recordId: newShift.id,
      newValue: `Modal Awal: Rp ${newShift.openingCash.toLocaleString()} (Kasir: ${newShift.assignedCashierName})`,
      description: `Pembukaan kasir baru: ${shiftName} di ${targetOutletName}`,
      reason: "Shift kasir resmi dibuka",
      status: "SUCCESS",
      outletId: targetOutletId,
      outletName: targetOutletName,
    });

    if (typeof window !== "undefined") {
      syncWithOutbox({
        id: `shift-open-${newShift.id}`,
        endpoint: "/api/shifts",
        method: "POST",
        payload: {
          action: "OPEN",
          shiftId: newShift.id,
          shiftName,
          openingCash: newShift.openingCash,
          cashierId: assignedId,
          cashierName: assignedName,
          outletId: targetOutletId,
          outletName: targetOutletName,
        },
      }).then((result) => {
        if (result.data?.shift) {
          setShifts((prev) =>
            reconcileClientShiftAfterServerOpen(prev, newShift.id, result.data.shift)
          );
        } else if (!result.synced && result.error) {
          addNotification({
            type: "SHIFT_CLOSED",
            title: "Sinkronisasi Pembukaan Shift Tertunda",
            detail: result.error,
            relatedModule: "EMPLOYEES_SHIFT",
            actionUrl: "/employees",
            outletId: targetOutletId,
            outletName: targetOutletName,
          });
        }
      });
    }

    return newShift;
  };

  const recordShiftTransaction = (
    cashAmount: number,
    nonCashAmount: number,
    _outletId?: string,
    saleId: string = `sale-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  ) => {
    const assignedId = user?.id || "emp-002";
    const targetShiftId = activeShift?.id;

    setShifts((prev) => {
      const res = recordShiftSaleTransaction({
        shifts: prev,
        cashierId: assignedId,
        shiftId: targetShiftId,
        cashAmount,
        nonCashAmount,
        saleId,
      });
      return res.updatedShifts;
    });

    if (typeof window !== "undefined") {
      syncWithOutbox({
        id: `shift-sale-${saleId}`,
        endpoint: "/api/shifts",
        method: "POST",
        payload: {
          action: "RECORD_SALE",
          shiftId: targetShiftId,
          cashierId: assignedId,
          cashAmount,
          nonCashAmount,
          saleId,
        },
      }).then((result) => {
        if (result.data?.shift) {
          const serverShift: ShiftRecord = result.data.shift;
          setShifts((prev) =>
            prev.map((s) => (s.id === serverShift.id ? serverShift : s))
          );
        } else if (result.rejected) {
          addNotification({
            type: "SYSTEM_ALERT",
            title: "Penjualan shift ditolak server",
            detail: result.error || "Penjualan tidak tercatat pada shift di server.",
            relatedModule: "EMPLOYEES_SHIFT",
            actionUrl: "/employees",
            outletId: activeShift?.outletId || "outlet-sgr",
            outletName: activeShift?.outletName || "",
          });
        }
      });
    }
  };

  const recordShiftRefund = (
    refundAmount: number,
    orderId: string = `refund-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    _outletId?: string
  ) => {
    const assignedId = user?.id || "emp-002";
    const targetShiftId = activeShift?.id;

    setShifts((prev) => {
      const res = recordShiftRefundTransaction({
        shifts: prev,
        cashierId: assignedId,
        shiftId: targetShiftId,
        refundAmount,
        orderId,
      });
      return res.updatedShifts;
    });

    if (typeof window !== "undefined") {
      syncWithOutbox({
        id: `shift-refund-${orderId}`,
        endpoint: "/api/shifts",
        method: "POST",
        payload: {
          action: "RECORD_REFUND",
          shiftId: targetShiftId,
          cashierId: assignedId,
          refundAmount,
          orderId,
        },
      }).then((result) => {
        if (result.data?.shift) {
          const serverShift: ShiftRecord = result.data.shift;
          setShifts((prev) =>
            prev.map((s) => (s.id === serverShift.id ? serverShift : s))
          );
        }
      });
    }
  };

  const closeShift = (
    shiftId: string,
    actualCash: number,
    closingNotes?: string,
    _metrics?: { cashSales?: number; nonCashSales?: number }
  ) => {
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) return;

    // R2: Compute expected and variance strictly from recorded shift.cashSales and shift.nonCashSales
    const nowIso = new Date().toISOString();
    const finalCashSales = shift.cashSales || 0;
    const finalNonCashSales = shift.nonCashSales || 0;
    const expected = shift.openingCash + finalCashSales - (shift.refundAmount || 0);
    const variance = actualCash - expected;

    setShifts((prev) =>
      prev.map((s) =>
        s.id === shiftId
          ? {
              ...s,
              status: "CLOSED",
              cashSales: finalCashSales,
              nonCashSales: finalNonCashSales,
              expectedCash: expected,
              endTime: nowIso,
              actualCash,
              cashVariance: variance,
              closingNotes,
              closedAt: nowIso,
              closedBy: user?.name || s.assignedCashierName || "Ni Kadek Sri",
            }
          : s
      )
    );

    if (typeof window !== "undefined") {
      syncWithOutbox({
        id: `shift-close-${shiftId}`,
        endpoint: "/api/shifts",
        method: "POST",
        payload: {
          action: "CLOSE",
          shiftId,
          actualCash,
          closingNotes,
        },
      }).then((result) => {
        if (result.data?.shift) {
          const serverShift: ShiftRecord = result.data.shift;
          setShifts((prev) =>
            prev.map((s) => (s.id === serverShift.id ? serverShift : s))
          );
        } else if (!result.synced && result.error) {
          addNotification({
            type: "SHIFT_CLOSED",
            title: "Sinkronisasi Penutupan Shift Gagal",
            detail: result.error,
            relatedModule: "EMPLOYEES_SHIFT",
            actionUrl: "/employees",
            outletId: shift.outletId,
            outletName: shift.outletName,
          });
        }
      });
    }

    if (typeof window !== "undefined" && user) {
      sessionStorage.setItem(`dagoeng_shift_closed_${user.id}_${shift.outletId}`, "true");
    }

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
        recordShiftTransaction,
        recordShiftRefund,
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
