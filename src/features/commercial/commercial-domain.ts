import type { CommercialLease, LeaseStatus } from "@/types/commercial";
import type { StatusTone } from "@/components/app/status-badge";

export interface CommercialKPIs {
  activeUnitsCount: number;
  totalMonthlyBilling: number;
  totalSecurityDeposit: number;
}

export function calculateCommercialKPIs(leases: CommercialLease[]): CommercialKPIs {
  let activeUnitsCount = 0;
  let totalMonthlyBilling = 0;
  let totalSecurityDeposit = 0;

  for (const l of leases) {
    if (l.status === "ACTIVE") {
      activeUnitsCount += 1;
      totalMonthlyBilling += l.monthlyRent || 0;
      totalSecurityDeposit += l.depositAmount || 0;
    }
  }

  return {
    activeUnitsCount,
    totalMonthlyBilling,
    totalSecurityDeposit,
  };
}

export function filterLeases(
  leases: CommercialLease[],
  statusFilter: string,
  rawSearchTerm: string
): CommercialLease[] {
  const query = rawSearchTerm.trim().toLowerCase();

  return leases.filter((l) => {
    const matchSearch =
      !query ||
      l.tenantName.toLowerCase().includes(query) ||
      l.unitCode.toLowerCase().includes(query) ||
      l.leaseNumber.toLowerCase().includes(query);
    const matchStatus = statusFilter === "ALL" || l.status === statusFilter;
    return matchSearch && matchStatus;
  });
}

export function getLeaseStatusTone(status: LeaseStatus): StatusTone {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "EXPIRING_SOON":
      return "warning";
    case "TERMINATED":
      return "destructive";
    case "EXPIRED":
    case "DRAFT":
    default:
      return "neutral";
  }
}

export function getLeaseStatusLabel(status: LeaseStatus): string {
  switch (status) {
    case "ACTIVE":
      return "Aktif";
    case "EXPIRING_SOON":
      return "Segera Berakhir";
    case "EXPIRED":
      return "Berakhir";
    case "TERMINATED":
      return "Dibatalkan";
    case "DRAFT":
      return "Draft";
    default:
      return status;
  }
}

export function buildCommercialExportData(leases: CommercialLease[]) {
  const headers = [
    "No. Kontrak",
    "Tenant / Brand",
    "Kontak Tenant",
    "Email Tenant",
    "Unit Lot",
    "Luas (m²)",
    "Biaya Sewa Bulanan (Rp)",
    "Nilai Kontrak Tahunan (Rp)",
    "Deposit Jaminan (Rp)",
    "Jadwal Pembayaran",
    "Periode Mulai",
    "Periode Berakhir",
    "Status",
  ];

  const rows = leases.map((l) => [
    l.leaseNumber,
    l.tenantName,
    l.tenantContact,
    l.tenantEmail || "-",
    l.unitCode,
    l.areaSquareMeters || 0,
    `Rp ${(l.monthlyRent || 0).toLocaleString("id-ID")}`,
    `Rp ${((l.monthlyRent || 0) * 12).toLocaleString("id-ID")}`,
    `Rp ${(l.depositAmount || 0).toLocaleString("id-ID")}`,
    l.paymentSchedule,
    l.startDate,
    l.endDate,
    l.status,
  ]);

  return { headers, rows };
}
