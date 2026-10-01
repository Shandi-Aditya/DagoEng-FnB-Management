export type LeaseStatus =
  | "DRAFT"
  | "ACTIVE"
  | "EXPIRING_SOON"
  | "EXPIRED"
  | "TERMINATED";

export interface LeasePaymentRecord {
  id: string;
  leaseId: string;
  periodLabel: string; // e.g. "September 2026"
  amount: number;
  dueDate: string;
  paidDate?: string;
  paymentMethod?: string;
  status: "PAID" | "UNPAID" | "OVERDUE";
  referenceNo?: string;
}

export interface CommercialLease {
  id: string;
  leaseNumber: string; // e.g. "LSE-DAGO-2026-001"
  outletId: string;
  outletName: string;
  tenantName: string;
  tenantContact: string;
  tenantEmail: string;
  unitCode: string; // e.g. "Lot A-01 (Ground Floor)"
  areaSquareMeters: number; // e.g. 45
  monthlyRent: number;
  totalContractValue: number;
  depositAmount: number;
  startDate: string;
  endDate: string;
  paymentSchedule: "MONTHLY" | "QUARTERLY" | "ANNUALLY";
  status: LeaseStatus;
  documentUrl?: string;
  notes?: string;
  paymentHistory: LeasePaymentRecord[];
  createdAt: string;
  updatedAt: string;
}
