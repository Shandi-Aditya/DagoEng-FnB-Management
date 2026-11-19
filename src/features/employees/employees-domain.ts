import type { EmployeeProfile, ShiftRecord, ShiftStatus } from "@/types/shift";
import { formatWitaDateTime, toWitaDateKey } from "@/contexts/DateFilterContext";
import type { StatusTone } from "@/components/app/status-badge";
import type { ClosingReportData, TenantBreakdownItem } from "@/features/pos/DailyClosingPDFModal";
import {
  aggregateShiftOrdersTaxAndRevenue,
  computeClosingVerificationHash,
} from "@/lib/tax-breakdown";
import { calculateSettlement } from "@/lib/settlement";
import { extractShiftStartTimeMs } from "@/lib/shift-management";
import { OFFICIAL_CS_DISPLAY_PHONE, OFFICIAL_HUB_ADDRESS } from "@/lib/contact-config";

export type EmployeeDepartment =
  | "Management"
  | "Service"
  | "Kitchen"
  | "Barista"
  | "Cashier"
  | "Inventory";

export interface PermissionItem {
  id: string;
  label: string;
  desc: string;
  category: string;
}

export const ALL_PERMISSIONS: PermissionItem[] = [
  {
    id: "pos_access",
    label: "Operasional Kasir (POS)",
    desc: "Buka kasir, proses pesanan, input bayar, & cetak struk",
    category: "POS Kasir",
  },
  {
    id: "pos_discount",
    label: "Otoritas Diskon & Promo",
    desc: "Terapkan kode kupon atau diskon manual transaksi",
    category: "POS Kasir",
  },
  {
    id: "pos_void",
    label: "Otoritas Void & Batal Order",
    desc: "Batalkan pesanan / void bill yang sudah diproses",
    category: "POS Kasir",
  },
  {
    id: "pos_shift_close",
    label: "Buka & Tutup Shift (Rekonsiliasi Kas)",
    desc: "Input kas awal dan pencocokan uang fisik di laci kas",
    category: "Kas & Shift",
  },
  {
    id: "inventory_access",
    label: "Manajemen Stok & Bahan Baku",
    desc: "Mutasi stok, input barang masuk, & opname gudang",
    category: "Inventori",
  },
  {
    id: "menu_master_edit",
    label: "Manajemen Master Menu & Harga",
    desc: "Tambah/edit produk menu F&B, harga, dan HPP",
    category: "Master Data",
  },
  {
    id: "financial_reports",
    label: "Laporan Omzet & Finansial",
    desc: "Melihat laporan omzet harian, bagi hasil, & export",
    category: "Keuangan",
  },
  {
    id: "coworking_manage",
    label: "Manajemen Co-Working Space",
    desc: "Check-in tamu, booking ruangan & event space",
    category: "Co-Working",
  },
  {
    id: "staff_management",
    label: "Kelola Karyawan & Hak Akses",
    desc: "Tambah staf baru dan kelola hak izin staf lain",
    category: "SDM & Akses",
  },
];

export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  "Store Manager": [
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
  "Outlet Supervisor": [
    "pos_access",
    "pos_discount",
    "pos_void",
    "pos_shift_close",
    "inventory_access",
    "financial_reports",
    "coworking_manage",
  ],
  "Head Cashier": ["pos_access", "pos_discount", "pos_shift_close"],
  Cashier: ["pos_access", "pos_discount", "pos_shift_close"],
  "Head Chef": ["pos_access", "inventory_access"],
  Kitchen: ["pos_access", "inventory_access"],
  Barista: ["pos_access", "inventory_access"],
  "Inventory Specialist": ["inventory_access"],
  "Floor Waiter": ["pos_access"],
};

export interface EmployeeKPIs {
  activeEmployeesCount: number;
  totalEmployeesCount: number;
  activeShiftsCount: number;
  totalShiftsCount: number;
}

export function calculateEmployeeKPIs(
  shifts: ShiftRecord[],
  employees: EmployeeProfile[]
): EmployeeKPIs {
  const totalEmployeesCount = employees.length;
  const activeEmployeesCount = employees.filter((e) => e.status === "AKTIF").length;
  const totalShiftsCount = shifts.length;
  const activeShiftsCount = shifts.filter(
    (s) => s.status === "OPEN" || s.status === "ACTIVE"
  ).length;

  return {
    activeEmployeesCount,
    totalEmployeesCount,
    activeShiftsCount,
    totalShiftsCount,
  };
}

export function formatShiftWitaTimestamp(raw?: string): string {
  if (!raw) return "Belum ditutup";
  const formatted = formatWitaDateTime(raw, "dd MMM yyyy HH:mm");
  return formatted ? `${formatted} WITA` : raw;
}

export function filterEmployees(
  employees: EmployeeProfile[],
  deptFilter: string,
  statusFilter: string,
  rawSearchQuery: string
): EmployeeProfile[] {
  const query = rawSearchQuery.trim().toLowerCase();
  const qDigits = query.replace(/\D+/g, "");

  return employees.filter((e) => {
    const pDigits = (e.contact || "").replace(/\D+/g, "");
    const matchPhone =
      qDigits.length >= 3 &&
      (pDigits.includes(qDigits) ||
        (qDigits.startsWith("0") && pDigits.includes(`62${qDigits.slice(1)}`)));

    const matchQuery =
      !query ||
      e.name.toLowerCase().includes(query) ||
      e.role.toLowerCase().includes(query) ||
      e.employeeNumber.toLowerCase().includes(query) ||
      e.department.toLowerCase().includes(query) ||
      Boolean(e.contact && e.contact.toLowerCase().includes(query)) ||
      matchPhone ||
      Boolean(e.email && e.email.toLowerCase().includes(query));
    const matchDept = deptFilter === "ALL" || e.department === deptFilter;
    const matchStatus = statusFilter === "ALL" || e.status === statusFilter;
    return matchQuery && matchDept && matchStatus;
  });
}

export function filterShifts(
  shifts: ShiftRecord[],
  rawSearchQuery: string,
  statusFilter = "ALL",
  dateFilter = ""
): ShiftRecord[] {
  const query = rawSearchQuery.trim().toLowerCase();
  const targetDateKey = dateFilter.trim() ? toWitaDateKey(dateFilter.trim()) : "";

  return shifts.filter((s) => {
    if (targetDateKey) {
      const startKey = toWitaDateKey(s.startTime || "");
      const closeKey = toWitaDateKey(s.closedAt || s.endTime || s.startTime || "");
      if (startKey !== targetDateKey && closeKey !== targetDateKey) {
        return false;
      }
    }

    const matchQuery =
      !query ||
      s.shiftName.toLowerCase().includes(query) ||
      s.assignedCashierName.toLowerCase().includes(query) ||
      s.id.toLowerCase().includes(query);

    const matchStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE"
        ? s.status === "ACTIVE" || s.status === "OPEN"
        : s.status === statusFilter);

    return matchQuery && matchStatus;
  });
}

export function getDepartmentBadgeTone(dept: string): StatusTone {
  switch (dept) {
    case "Management":
      return "info";
    case "Cashier":
    case "Barista":
      return "warning";
    case "Kitchen":
      return "warning";
    case "Service":
      return "info";
    case "Inventory":
      return "neutral";
    default:
      return "neutral";
  }
}

const EMPLOYEE_STATUS_LABEL: Record<string, string> = {
  AKTIF: "Aktif",
  CUTI: "Cuti",
  "NON-AKTIF": "Nonaktif",
};

/** Display label for the stored employment status enum. */
export function getEmployeeStatusLabel(status: string): string {
  return EMPLOYEE_STATUS_LABEL[status] ?? status;
}

export function getEmployeeStatusTone(status: string): StatusTone {
  switch (status) {
    case "AKTIF":
      return "success";
    case "CUTI":
      return "warning";
    case "NON-AKTIF":
    default:
      return "neutral";
  }
}

export function getShiftStatusTone(status: ShiftStatus): StatusTone {
  switch (status) {
    case "OPEN":
    case "ACTIVE":
      return "info";
    case "CLOSED":
      return "success";
    case "NEEDS_RECONCILIATION":
      return "destructive";
    case "CLOSING":
    case "SCHEDULED":
    default:
      return "warning";
  }
}

const SHIFT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Sedang berjalan",
  OPEN: "Sedang berjalan",
  CLOSED: "Ditutup",
  NEEDS_RECONCILIATION: "Selisih kas",
  CLOSING: "Proses closing",
  SCHEDULED: "Terjadwal",
};

export function getShiftStatusLabel(status: ShiftStatus | string): string {
  return SHIFT_STATUS_LABELS[status] ?? status;
}

export function emptyShiftMessage(hasFilter: boolean): { title: string; description: string } {
  if (hasFilter) {
    return {
      title: "Tidak ada shift yang cocok",
      description: "Ubah kata kunci pencarian atau pilih filter status lain.",
    };
  }

  return {
    title: "Belum ada shift",
    description: "Shift kasir yang telah dibuka atau ditutup akan tercatat di sini.",
  };
}

export function emptyEmployeeMessage(hasFilter: boolean): { title: string; description: string } {
  if (hasFilter) {
    return {
      title: "Tidak ada staf yang cocok",
      description: "Ubah kata kunci pencarian atau pilih filter departemen lain.",
    };
  }

  return {
    title: "Belum ada staf",
    description: "Daftarkan karyawan outlet baru untuk mulai mengelola shift dan hak akses.",
  };
}


export function buildEmployeeExportData(
  activeTab: "SHIFTS" | "EMPLOYEES",
  shifts: ShiftRecord[],
  employees: EmployeeProfile[],
  outletName: string
) {
  if (activeTab === "SHIFTS") {
    const headers = [
      "ID Shift",
      "Nama Shift",
      "Kasir Bertugas",
      "Waktu Buka",
      "Waktu Tutup",
      "Kas Awal (Rp)",
      "Penjualan Kas (Rp)",
      "Penjualan Non-Kas (Rp)",
      "Total Penjualan (Rp)",
      "Kas Fisik Aktual (Rp)",
      "Selisih Kas (Rp)",
      "Status",
    ];
    const rows = shifts.map((s) => [
      s.id,
      s.shiftName,
      s.assignedCashierName,
      formatShiftWitaTimestamp(s.startTime),
      s.closedAt || s.endTime ? formatShiftWitaTimestamp(s.closedAt || s.endTime) : "Belum ditutup",
      `Rp ${(s.openingCash || 0).toLocaleString("id-ID")}`,
      `Rp ${(s.cashSales || 0).toLocaleString("id-ID")}`,
      `Rp ${(s.nonCashSales || 0).toLocaleString("id-ID")}`,
      `Rp ${((s.cashSales || 0) + (s.nonCashSales || 0)).toLocaleString("id-ID")}`,
      s.actualCash !== undefined ? `Rp ${s.actualCash.toLocaleString("id-ID")}` : "-",
      s.cashVariance !== undefined ? `Rp ${s.cashVariance.toLocaleString("id-ID")}` : "-",
      s.status,
    ]);
    return {
      filename: `Rekonsiliasi_Shift_${outletName}`,
      sheet: "Shift Kasir",
      headers,
      rows,
    };
  }

  const headers = [
    "NIK / No. Pegawai",
    "Nama Karyawan",
    "Jabatan / Role",
    "Departemen",
    "No. Kontak / WA",
    "Email",
    "Shift Ditugaskan",
    "Status Kepegawaian",
    "Jumlah Hak Akses",
    "Tanggal Bergabung",
  ];
  const rows = employees.map((e) => [
    e.employeeNumber,
    e.name,
    e.role,
    e.department,
    e.contact,
    e.email,
    e.assignedShift,
    e.status,
    `${(e.permissions || ROLE_DEFAULT_PERMISSIONS[e.role] || ["pos_access"]).length} Izin`,
    e.joinedDate,
  ]);
  return {
    filename: `Daftar_Karyawan_${outletName}`,
    sheet: "Direktori Staf",
    headers,
    rows,
  };
}

export function buildClosingReportData(
  shift: ShiftRecord | null,
  orders: any[],
  outletName: string,
  cashierName: string
): ClosingReportData {
  const closingTaxAgg = aggregateShiftOrdersTaxAndRevenue(orders, shift);
  const shiftGrossSales =
    (shift?.cashSales || 0) + (shift?.nonCashSales || 0) ||
    closingTaxAgg.totalRevenue;
  const storedTaxTotal = closingTaxAgg.totalTaxPB1;
  const storedServiceTotal = closingTaxAgg.totalServiceCharge;
  const netSalesAfterTax = Math.max(0, shiftGrossSales - storedTaxTotal - storedServiceTotal);
  const verificationHash = computeClosingVerificationHash(shift, closingTaxAgg);

  // Scoped orders for shift
  const startMs = shift
    ? extractShiftStartTimeMs(shift) || (shift.startTime ? Date.parse(shift.startTime) : 0)
    : 0;
  const rawEnd = shift?.closedAt || shift?.endTime;
  const parsedEndMs = rawEnd ? Date.parse(rawEnd) : NaN;
  const endMs = !isNaN(parsedEndMs) && parsedEndMs > 0 ? parsedEndMs : Infinity;

  const shiftOrders = orders.filter((order) => {
    if (shift?.outletId && shift.outletId !== "ALL" && order.outletId && order.outletId !== shift.outletId) {
      return false;
    }
    if (startMs > 0 && order.createdAt) {
      const orderMs = Date.parse(order.createdAt);
      if (!isNaN(orderMs)) {
        return orderMs >= startMs && orderMs <= endMs;
      }
    }
    return true;
  });

  const settlements = calculateSettlement(shift ? shiftOrders : orders);
  const tenantBreakdowns: TenantBreakdownItem[] = settlements
    .filter((s) => s.tenantId !== "DAGO_HUB")
    .map((s) => ({
      tenantId: s.tenantId,
      tenantName: s.tenantName,
      grossRevenue: s.grossRevenue,
      netSales: s.netSales ?? s.dpp ?? 0,
      tenantShareAmount: s.tenantShareAmount ?? Math.round((s.netSales ?? s.dpp ?? 0) * 0.85),
      dagoShareAmount: s.dagoShareAmount ?? Math.round((s.netSales ?? s.dpp ?? 0) * 0.15),
      tenantSharePercent: s.tenantSharePercent ?? 85,
      dagoSharePercent: s.dagoSharePercent ?? 15,
    }));

  const initialCash = shift?.openingCash ?? 500000;
  const totalCashSales = shift?.cashSales ?? 0;
  const expectedCash =
    shift?.expectedCash !== undefined
      ? shift.expectedCash
      : initialCash + totalCashSales - (shift?.refundAmount ?? 0);
  const actualCashEnding = shift?.actualCash !== undefined ? shift.actualCash : expectedCash;
  const cashDifference =
    shift?.cashVariance !== undefined ? shift.cashVariance : actualCashEnding - expectedCash;
  const shiftNotes =
    shift?.closingNotes ||
    (cashDifference === 0
      ? "Kas fisik cocok sempurna dengan sistem POS."
      : `Selisih kas ${cashDifference >= 0 ? "+" : ""}Rp ${Math.abs(cashDifference).toLocaleString("id-ID")}`);

  // Aggregate tenant shares
  const totalTenantShare =
    tenantBreakdowns.length > 0
      ? tenantBreakdowns.reduce((acc, t) => acc + t.tenantShareAmount, 0)
      : Math.round(netSalesAfterTax * 0.85);
  const totalDagoShare = netSalesAfterTax - totalTenantShare;

  return {
    reportNumber: `RPT-CLS-${Date.now().toString().slice(-6)}`,
    outletName: outletName || "Singaraja",
    outletAddress: OFFICIAL_HUB_ADDRESS,
    outletPhone: OFFICIAL_CS_DISPLAY_PHONE,
    cashierName: shift?.assignedCashierName || cashierName || "Kasir",
    closingDateTime: new Date().toLocaleString("id-ID"),
    shiftName: shift?.shiftName || "Shift Pagi",
    initialCash,
    totalCashSales,
    qrisSales: shift?.nonCashSales || 0,
    edcSales: 0,
    totalTransactionsCount: closingTaxAgg.orderCount,
    totalGrossSales: shiftGrossSales,
    totalDiscounts: closingTaxAgg.totalDiscounts,
    isTaxEnabled: true,
    taxRatePercent: 10,
    totalTax: storedTaxTotal,
    totalServiceCharge: storedServiceTotal,
    totalNetSales: netSalesAfterTax,
    tenantSharePercent: 85,
    dagoSharePercent: 15,
    tenantTotalShare: totalTenantShare,
    dagoTotalShare: totalDagoShare,
    tenantQrisShare: Math.round((shift?.nonCashSales || 0) * 0.85),
    dagoQrisShare: Math.round((shift?.nonCashSales || 0) * 0.15),
    tenantCashShare: Math.round(totalCashSales * 0.85),
    dagoCashShare: Math.round(totalCashSales * 0.15),
    expectedCash,
    actualCashEnding,
    cashDifference,
    shiftNotes,
    verificationHash,
    tenantBreakdowns,
  };
}
