export type ShiftStatus = "SCHEDULED" | "OPEN" | "ACTIVE" | "CLOSING" | "CLOSED";

export interface EmployeeProfile {
  id: string;
  employeeNumber: string;
  name: string;
  role: string;
  department: "Management" | "Service" | "Kitchen" | "Barista" | "Cashier" | "Inventory";
  outletId: string;
  outletName: string;
  contact: string;
  email: string;
  status: "AKTIF" | "CUTI" | "NON-AKTIF";
  assignedShift: string;
  joinedDate: string;
}

export type Employee = EmployeeProfile;

export interface ShiftRecord {
  id: string;
  shiftName: string; // e.g. "Shift Pagi (08:00 - 16:00)"
  outletId: string;
  outletName: string;
  assignedCashierId: string;
  assignedCashierName: string;
  startTime: string;
  endTime?: string;
  status: ShiftStatus;
  openingCash: number;
  cashSales: number;
  nonCashSales: number;
  refundAmount: number;
  expectedCash: number; // openingCash + cashSales - refundAmount
  actualCash: number;
  cashVariance: number; // actualCash - expectedCash
  closingNotes?: string;
  closedAt?: string;
  closedBy?: string;
}
