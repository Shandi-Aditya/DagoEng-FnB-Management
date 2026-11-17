/**
 * Domain murni pelaporan manajemen dan ekspor terstruktur.
 * Mengelola agregasi finansial, penjualan, mutasi stok, rekonsiliasi, dan settlement.
 *
 * Importer:
 * - src/app/(dashboard)/reports/page.tsx
 * - src/features/reports/ReportsToolbar.tsx
 * - src/features/reports/ReportsPreviewTable.tsx
 * - tests/reports-domain.test.ts
 */

import type { StatTone } from "@/components/app/stat-card";
import type { StatusTone } from "@/components/app/status-badge";
import { ingredientCategoryLabel } from "@/features/inventory/inventory-reorder";
import { orderStatusLabel, paymentMethodLabel } from "@/features/orders/orders-domain";
import { calculateSettlement, getTenantPayoutAccount, maskAccountNumber } from "@/lib/settlement";
import {
  getStoredSettlementReceiptPolicy,
  settlementBasisLabel,
  type SettlementBasisMode,
} from "@/lib/settlement-receipt-policy";
import { aggregateOrdersTaxAndRevenue, getOrderTaxBreakdown } from "@/lib/tax-breakdown";
import type { ActivityLogEntry } from "@/types/audit";
import type { EventTicketOrder } from "@/types/event";
import type { IngredientItem } from "@/types/inventory";
import type { OrderItemRecord, OrderRecord } from "@/types/order";
import type { MasterProduct } from "@/types/product";
import type { ShiftRecord } from "@/types/shift";
import { analyzeTransactionDiscrepancies } from "./reconciliation-domain";

export type ReportType =
  | "SALES"
  | "CLOSING"
  | "PRODUCTS"
  | "INVENTORY"
  | "FINANCE_AUDIT"
  | "SETTLEMENT"
  | "EVENTS"
  | "RECONCILIATION";

export function getReportTypeBadgeTone(type: ReportType): StatusTone {
  switch (type) {
    case "SALES":
      return "success";
    case "SETTLEMENT":
    case "PRODUCTS":
      return "info";
    case "EVENTS":
    case "INVENTORY":
    case "RECONCILIATION":
      return "warning";
    case "CLOSING":
    case "FINANCE_AUDIT":
    default:
      return "neutral";
  }
}

export function emptyReportMessage(
  scopeName: string,
  periodLabel: string,
  hasSearch = false
): { title: string; description: string } {
  if (hasSearch) {
    return {
      title: "Tidak ada data yang cocok",
      description: "Ubah kata kunci pencarian atau pilih jenis laporan lain.",
    };
  }
  return {
    title: "Tidak ada data pada periode ini",
    description: `Belum ada catatan untuk ${scopeName} pada ${periodLabel}. Coba ubah rentang tanggal.`,
  };
}

const EVENT_PAYMENT_METHOD_LABELS: Record<string, string> = {
  FREE: "Gratis",
  MANUAL_TRANSFER: "Transfer manual",
  DOKU_CHECKOUT: "Pembayaran online",
  TRANSFER: "Transfer",
  QRIS: "QRIS",
  CASH: "Tunai",
};

export function eventPaymentMethodLabel(method: string): string {
  if (!method) return "—";
  if (EVENT_PAYMENT_METHOD_LABELS[method]) return EVENT_PAYMENT_METHOD_LABELS[method];
  return paymentMethodLabel(method as OrderRecord["paymentMethod"]) || method;
}

const EVENT_PAYMENT_STATUS_LABELS: Record<string, string> = {
  PAID: "Lunas",
  PENDING: "Menunggu",
  CANCELLED: "Dibatalkan",
  EXPIRED: "Kedaluwarsa",
};

export function eventPaymentStatusLabel(status: string): string {
  return EVENT_PAYMENT_STATUS_LABELS[status] ?? (status || "—");
}

export function eventCheckInLabel(status: string): string {
  if (status === "CHECKED_IN") return "Hadir";
  if (status === "PARTIALLY_CHECKED_IN") return "Sebagian hadir";
  return "Belum hadir";
}

const AUDIT_MODULE_LABELS: Record<string, string> = {
  POS: "POS",
  FINANCE: "Keuangan",
  COMMERCIAL: "Komersial",
  INVENTORY: "Inventori",
  TABLES: "Meja",
  COWORKING: "Co-working",
  EMPLOYEES_SHIFT: "Karyawan & shift",
  LOYALTY: "Pelanggan",
  MENU: "Menu",
  SETTINGS: "Pengaturan",
};

export function auditModuleLabel(module: string): string {
  return AUDIT_MODULE_LABELS[module] ?? (module || "—");
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  OPEN_SHIFT: "Buka shift",
  CLOSE_SHIFT: "Tutup shift",
  ORDER_PAYMENT_AND_COMPLETED: "Pembayaran pesanan",
  ORDER_CREATED: "Pesanan dibuat",
  ORDER_CANCELLED: "Pesanan dibatalkan",
  VOID_ORDER: "Pembatalan pesanan",
  REFUND_ORDER: "Pengembalian dana",
  LEASE_CREATED: "Kontrak dibuat",
  LEASE_PAYMENT: "Pembayaran sewa",
  LEASE_STATUS_CHANGED: "Ubah status kontrak",
};

export function auditActionLabel(action: string): string {
  if (!action) return "—";
  if (AUDIT_ACTION_LABELS[action]) return AUDIT_ACTION_LABELS[action];
  const normalized = action.toLowerCase().replace(/_/g, " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

/** Filters report rows case-insensitively across all cells without mutating input. */
export function filterReportRows(
  rows: readonly (readonly (string | number)[])[],
  query: string
): (string | number)[][] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows.map((row) => [...row]);
  return rows
    .filter((row) => row.some((cell) => String(cell).toLowerCase().includes(needle)))
    .map((row) => [...row]);
}

/** Identifies numeric, currency, or percentage cells for right-aligned monospace formatting. */
export function isNumericReportCell(cell: string | number): boolean {
  if (typeof cell === "number") return true;
  const text = String(cell).trim();
  return (
    text.startsWith("Rp ") ||
    text.startsWith("+Rp ") ||
    text.startsWith("-Rp ") ||
    /^-?\d+(?:[.,]\d+)?%$/.test(text)
  );
}

/**
 * Calculates summary metrics aggregating row count and parsed monetary/numeric amounts
 * for a specific column in a tabular report dataset.
 */
export function calculateReportSummaryMetrics(
  rows: readonly (string | number)[][],
  amountColumnIndex: number
): { count: number; totalAmount: number; formattedTotal: string } {
  let totalAmount = 0;

  for (const row of rows) {
    const rawVal = row[amountColumnIndex];
    if (typeof rawVal === "number") {
      totalAmount += rawVal;
    } else if (typeof rawVal === "string") {
      const cleaned = rawVal.replace(/[^\d-]/g, "");
      const parsed = parseInt(cleaned, 10);
      if (!Number.isNaN(parsed)) {
        totalAmount += parsed;
      }
    }
  }

  return {
    count: rows.length,
    totalAmount,
    formattedTotal: `Rp ${totalAmount.toLocaleString("id-ID")}`,
  };
}

function formatMakassarDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso.split("T")[0] ?? iso;
  return parsed.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Makassar",
  });
}

export interface ReportSummaryCard {
  label: string;
  value: string;
  valueTone?: StatTone;
  sub?: string;
  subTone?: StatTone;
}

export interface ReportReconciliationItem {
  label: string;
  value: string;
  tone?: StatTone;
}

export interface ReportDataset {
  title: string;
  subtitle: string;
  summaryCards: ReportSummaryCard[];
  tableHeaders: string[];
  tableRows: (string | number)[][];
  reconciliationInfo?: ReportReconciliationItem[];
}

export interface PromoReference {
  id: string;
  name: string;
}

export interface BuildReportParams {
  type: ReportType;
  scopeName: string;
  orders: OrderRecord[];
  products: MasterProduct[];
  shifts: ShiftRecord[];
  ingredients: IngredientItem[];
  logs: ActivityLogEntry[];
  promos?: PromoReference[];
  eventBookings?: EventTicketOrder[];
  operatorName?: string;
  settlementBasis?: SettlementBasisMode;
  customSplits?: Record<string, { tenantSharePercent: number; dagoSharePercent: number }>;
}

export interface ReportCategoryMeta {
  id: ReportType;
  label: string;
  count: string;
  rawCount: number;
}

/**
 * Membangun kategori laporan yang tersedia beserta hitungan data aktif.
 */
export function getReportCategories(params: {
  ordersCount: number;
  tenantsCount: number;
  shiftsCount: number;
  productsCount: number;
  materialsCount: number;
  logsCount: number;
  paidEventsCount?: number;
  canAccessEvents?: boolean;
  discrepanciesCount?: number;
}): ReportCategoryMeta[] {
  const categories: ReportCategoryMeta[] = [
    {
      id: "SALES",
      label: "Penjualan POS",
      count: `${params.ordersCount} Trx`,
      rawCount: params.ordersCount,
    },
    {
      id: "RECONCILIATION",
      label: "Rekonsiliasi & selisih",
      count: `${params.discrepanciesCount ?? 0} Selisih`,
      rawCount: params.discrepanciesCount ?? 0,
    },
    {
      id: "SETTLEMENT",
      label: "Settlement mitra",
      count: `${params.tenantsCount} Tenant`,
      rawCount: params.tenantsCount,
    },
  ];

  if (params.canAccessEvents) {
    const eventsCount = params.paidEventsCount || 0;
    categories.push({
      id: "EVENTS",
      label: "Tiket event",
      count: `${eventsCount} Peserta`,
      rawCount: eventsCount,
    });
  }

  categories.push(
    {
      id: "CLOSING",
      label: "Closing kasir",
      count: `${params.shiftsCount} Shift`,
      rawCount: params.shiftsCount,
    },
    {
      id: "PRODUCTS",
      label: "Produk dan margin",
      count: `${params.productsCount} Menu`,
      rawCount: params.productsCount,
    },
    {
      id: "INVENTORY",
      label: "Stok bahan",
      count: `${params.materialsCount} Bahan`,
      rawCount: params.materialsCount,
    },
    {
      id: "FINANCE_AUDIT",
      label: "Audit keuangan",
      count: `${params.logsCount} Log`,
      rawCount: params.logsCount,
    }
  );

  return categories;
}

/**
 * Mencari produk terlaris berdasarkan kuantitas pesanan yang berstatus lunas (PAID).
 */
export function findTopProduct(orders: OrderRecord[]): string {
  const quantities: Record<string, number> = {};
  for (const order of orders) {
    if (order.status === "CANCELLED" || order.paymentStatus !== "PAID") continue;
    for (const item of order.items) {
      quantities[item.productName] = (quantities[item.productName] || 0) + item.quantity;
    }
  }

  let topProduct = "-";
  let maxQty = 0;
  for (const [name, qty] of Object.entries(quantities)) {
    if (qty > maxQty) {
      maxQty = qty;
      topProduct = `${name} (${qty} pcs)`;
    }
  }

  return topProduct;
}

/**
 * Membangun dataset terstruktur untuk laporan PDF, CSV, Excel, dan pratinjau tabel.
 */
export function buildReportData(params: BuildReportParams): ReportDataset {
  const {
    type,
    scopeName,
    orders,
    products,
    shifts,
    ingredients,
    logs,
    promos = [],
    eventBookings = [],
    operatorName,
    settlementBasis,
    customSplits,
  } = params;

  switch (type) {
    case "SALES": {
      const aggregatedTax = aggregateOrdersTaxAndRevenue(orders);
      const totalRevenue = aggregatedTax.totalRevenue;
      const totalDiscounts = aggregatedTax.totalDiscounts;
      const totalOrdersCount = orders.length;
      const totalItemsSold = orders.reduce(
        (sum: number, o: OrderRecord) =>
          sum + o.items.reduce((iSum: number, it: OrderItemRecord) => iSum + it.quantity, 0),
        0
      );

      const totalNonCashRevenue = orders
        .filter((o) => o.status !== "CANCELLED" && o.paymentStatus !== "REFUNDED" && o.paymentMethod !== "CASH")
        .reduce((sum, o) => sum + o.total, 0);

      const totalCashRevenue = orders
        .filter((o) => o.status !== "CANCELLED" && o.paymentStatus !== "REFUNDED" && o.paymentMethod === "CASH")
        .reduce((sum, o) => sum + o.total, 0);

      const tableRows = orders.map((o) => {
        const promoName = promos.find((p) => p.id === o.promoId)?.name || o.promoId || "-";
        const breakdown = getOrderTaxBreakdown(o);
        const disc = breakdown.discount;
        const pb1 = breakdown.pb1;
        const service = breakdown.serviceCharge;
        return [
          o.orderNumber || o.id,
          o.customerName || "Tamu",
          o.tableNumber ? `Meja ${o.tableNumber}` : o.orderType === "DELIVERY" ? "Delivery" : "Takeaway",
          formatMakassarDate(o.createdAt),
          promoName,
          disc > 0 ? `-Rp ${disc.toLocaleString("id-ID")}` : "-",
          pb1 > 0 ? `Rp ${pb1.toLocaleString("id-ID")}` : "Rp 0",
          service > 0 ? `Rp ${service.toLocaleString("id-ID")}` : "Rp 0",
          orderStatusLabel(o.status),
          paymentMethodLabel(o.paymentMethod),
          `Rp ${o.total.toLocaleString("id-ID")}`,
        ];
      });

      return {
        title: "Laporan penjualan POS",
        subtitle: `Semua transaksi kasir di ${scopeName}`,
        summaryCards: [
          { label: "Omzet", value: `Rp ${totalRevenue.toLocaleString("id-ID")}` },
          { label: "Transaksi", value: `${totalOrdersCount} pesanan` },
          { label: "Diskon promo", value: `Rp ${totalDiscounts.toLocaleString("id-ID")}` },
          { label: "Item terjual", value: `${totalItemsSold} item` },
          { label: "Total PB1", value: `Rp ${aggregatedTax.totalTaxPB1.toLocaleString("id-ID")}` },
          {
            label: "Total service",
            value: `Rp ${aggregatedTax.totalServiceCharge.toLocaleString("id-ID")}`,
          },
        ],
        tableHeaders: [
          "Pesanan",
          "Tamu",
          "Meja atau tipe",
          "Tanggal",
          "Promo",
          "Diskon",
          "PB1 (Rp)",
          "Service (Rp)",
          "Status",
          "Metode bayar",
          "Total (Rp)",
        ],
        tableRows,
        reconciliationInfo: [
          { label: "PB1", value: `Rp ${aggregatedTax.totalTaxPB1.toLocaleString("id-ID")}` },
          {
            label: "Service charge",
            value: `Rp ${aggregatedTax.totalServiceCharge.toLocaleString("id-ID")}`,
          },
          { label: "Diskon promo", value: `Rp ${totalDiscounts.toLocaleString("id-ID")}` },
          {
            label: "Nontunai",
            value: `Rp ${totalNonCashRevenue.toLocaleString("id-ID")}`,
          },
          { label: "Tunai", value: `Rp ${totalCashRevenue.toLocaleString("id-ID")}` },
        ],
      };
    }

    case "CLOSING": {
      const closedShifts = shifts.filter((s) => s.status === "CLOSED");
      const needsReconShifts = shifts.filter((s) => s.status === "NEEDS_RECONCILIATION");
      const completedShiftsCount = closedShifts.length + needsReconShifts.length;
      const totalActualCash = shifts.reduce((s, sh) => s + (sh.actualCash || 0), 0);
      const totalVariance = shifts.reduce((s, sh) => s + (sh.cashVariance || 0), 0);

      const tableRows = shifts.map((s) => [
        s.id,
        s.shiftName,
        s.assignedCashierName,
        `Rp ${s.openingCash.toLocaleString("id-ID")}`,
        `Rp ${s.cashSales.toLocaleString("id-ID")}`,
        `Rp ${s.expectedCash.toLocaleString("id-ID")}`,
        `Rp ${(s.actualCash || 0).toLocaleString("id-ID")}`,
        `${(s.cashVariance || 0) >= 0 ? "+" : ""}Rp ${(s.cashVariance || 0).toLocaleString("id-ID")}`,
        s.status === "NEEDS_RECONCILIATION"
          ? "Perlu rekonsiliasi"
          : s.status === "CLOSED"
          ? "Ditutup"
          : s.status,
      ]);

      const shiftSummaryValue =
        needsReconShifts.length > 0
          ? `${completedShiftsCount} shift (${needsReconShifts.length} perlu rekonsiliasi)`
          : `${closedShifts.length} shift`;

      const cashStatusValue =
        needsReconShifts.length > 0
          ? "Perlu rekonsiliasi"
          : totalVariance === 0
          ? "Seimbang"
          : "Ada selisih";

      return {
        title: "Laporan closing kasir",
        subtitle: `Modal awal, penjualan tunai, dan kas fisik per shift di ${scopeName}`,
        summaryCards: [
          { label: "Shift ditutup", value: shiftSummaryValue },
          { label: "Kas fisik", value: `Rp ${totalActualCash.toLocaleString("id-ID")}` },
          { label: "Selisih kas", value: `Rp ${totalVariance.toLocaleString("id-ID")}` },
        ],
        tableHeaders: [
          "ID shift",
          "Shift",
          "Kasir",
          "Modal awal",
          "Penjualan tunai",
          "Kas seharusnya",
          "Kas fisik",
          "Selisih",
          "Status",
        ],
        tableRows,
        reconciliationInfo: [
          { label: "Status kas", value: cashStatusValue },
          { label: "Dibuat oleh", value: operatorName || "Staf" },
        ],
      };
    }

    case "PRODUCTS": {
      let totalMarginPctSum = 0;
      const tableRows = products.map((p) => {
        const hpp = p.cogsEstimate !== undefined && p.cogsEstimate > 0 ? p.cogsEstimate : Math.round(p.basePrice * 0.28);
        const marginRp = p.basePrice - hpp;
        const marginPct = p.basePrice > 0 ? (marginRp / p.basePrice) * 100 : 0;
        totalMarginPctSum += marginPct;

        return [
          p.id,
          p.name,
          p.category,
          `Rp ${p.basePrice.toLocaleString("id-ID")}`,
          `Rp ${hpp.toLocaleString("id-ID")}`,
          `Rp ${marginRp.toLocaleString("id-ID")}`,
          `${marginPct.toFixed(1)}%`,
        ];
      });

      const avgMarginPct = products.length > 0 ? (totalMarginPctSum / products.length).toFixed(1) : "0.0";
      const topProduct = findTopProduct(orders);

      return {
        title: "Laporan produk dan margin",
        subtitle: `Harga jual, estimasi HPP, dan margin kotor menu di ${scopeName}`,
        summaryCards: [
          { label: "Menu terdaftar", value: `${products.length} menu` },
          { label: "Rata-rata margin kotor", value: `${avgMarginPct}%` },
          { label: "Paling laris", value: topProduct },
        ],
        tableHeaders: [
          "SKU",
          "Menu",
          "Kategori",
          "Harga jual",
          "Estimasi HPP",
          "Margin kotor (Rp)",
          "Margin (%)",
        ],
        tableRows,
      };
    }

    case "INVENTORY": {
      const criticalItems = ingredients.filter((m) => m.stockNumber <= m.min);
      const totalInventoryValuation = ingredients.reduce(
        (sum, m) => sum + m.stockNumber * m.costPerUnit,
        0
      );

      const tableRows = ingredients.map((m) => [
        m.name,
        ingredientCategoryLabel(m.category),
        m.stockNumber,
        m.min,
        m.unit,
        `Rp ${m.costPerUnit.toLocaleString("id-ID")}`,
        `Rp ${(m.stockNumber * m.costPerUnit).toLocaleString("id-ID")}`,
      ]);

      return {
        title: "Laporan stok bahan",
        subtitle: `Posisi stok, batas minimum, dan nilai stok di ${scopeName}`,
        summaryCards: [
          { label: "Bahan terdaftar", value: `${ingredients.length} bahan` },
          { label: "Kritis atau habis", value: `${criticalItems.length} bahan` },
          {
            label: "Nilai stok",
            value: `Rp ${totalInventoryValuation.toLocaleString("id-ID")}`,
          },
        ],
        tableHeaders: [
          "Bahan",
          "Kategori",
          "Stok",
          "Minimum",
          "Satuan",
          "Harga satuan",
          "Nilai stok",
        ],
        tableRows,
      };
    }

    case "FINANCE_AUDIT": {
      const tableRows = logs.map((l) => [
        formatMakassarDate(l.timestamp),
        l.actorName || l.userName || "-",
        auditModuleLabel(l.module),
        auditActionLabel(l.action),
        l.newValue || l.description,
        l.reason || "-",
      ]);

      return {
        title: "Laporan audit keuangan",
        subtitle: `Void, refund, penyesuaian kas, dan perubahan transaksi di ${scopeName}`,
        summaryCards: [
          { label: "Aktivitas tercatat", value: `${logs.length} entri` },
          {
            label: "Pelaku",
            value: `${new Set(logs.map((l) => l.actorName || l.userName || "-")).size} orang`,
          },
        ],
        tableHeaders: [
          "Tanggal",
          "Pelaku",
          "Modul",
          "Aksi",
          "Perubahan",
          "Alasan",
        ],
        tableRows,
      };
    }

    case "SETTLEMENT": {
      const effectiveBasis = settlementBasis ?? getStoredSettlementReceiptPolicy().settlementBasis;
      const settlementData = calculateSettlement(orders, undefined, customSplits, {
        settlementBasis: effectiveBasis,
      });
      const totalNetSettlement = settlementData.reduce(
        (sum, s) => sum + (s.dpp ?? (s.grossRevenue - s.discount)),
        0
      );
      const totalTenantShare = settlementData.reduce((sum, s) => sum + (s.tenantShareAmount || 0), 0);
      const totalDagoShare = settlementData.reduce((sum, s) => sum + (s.dagoShareAmount || 0), 0);
      const totalDiscount = settlementData.reduce((sum, s) => sum + s.discount, 0);

      const tableRows = settlementData.map((s) => {
        const payout = getTenantPayoutAccount(s.tenantId);
        const payoutDisplay =
          s.tenantId === "DAGO_HUB"
            ? "Rekening pusat DAGO"
            : `${payout.bankName} ${maskAccountNumber(payout.accountNumber)}`;
        const splitDisplay =
          s.tenantId === "DAGO_HUB"
            ? "100% DAGO"
            : `${s.tenantSharePercent ?? 85}% Mitra / ${s.dagoSharePercent ?? 15}% DAGO`;
        const netDpp = s.dpp ?? (s.grossRevenue - s.discount);

        return [
          s.tenantId,
          s.tenantName,
          payoutDisplay,
          splitDisplay,
          s.transactionCount,
          `Rp ${s.grossRevenue.toLocaleString("id-ID")}`,
          `Rp ${(s.tenantShareAmount ?? 0).toLocaleString("id-ID")}`,
          `Rp ${(s.dagoShareAmount ?? 0).toLocaleString("id-ID")}`,
          `Rp ${netDpp.toLocaleString("id-ID")}`,
        ];
      });

      return {
        title: "Laporan settlement mitra",
        subtitle: `Bagi hasil dan rekening pencairan tiap mitra di ${scopeName}`,
        summaryCards: [
          { label: "Settlement bersih", value: `Rp ${totalNetSettlement.toLocaleString("id-ID")}` },
          { label: "Bagian mitra", value: `Rp ${totalTenantShare.toLocaleString("id-ID")}` },
          { label: "Bagian DAGO", value: `Rp ${totalDagoShare.toLocaleString("id-ID")}` },
          { label: "Diskon (prorata)", value: `Rp ${totalDiscount.toLocaleString("id-ID")}` },
        ],
        tableHeaders: [
          "ID mitra",
          "Mitra",
          "Rekening pencairan",
          "Bagi hasil",
          "Transaksi",
          "Kotor (Rp)",
          "Bagian mitra (Rp)",
          "Bagian DAGO (Rp)",
          "Bersih (Rp)",
        ],
        tableRows,
        reconciliationInfo: [
          { label: "Dasar bagi hasil", value: settlementBasisLabel(effectiveBasis) },
        ],
      };
    }

    case "EVENTS": {
      const paidEvents = eventBookings.filter((b) => b.paymentStatus === "PAID");
      const totalEventGross = Math.round(paidEvents.reduce((s, b) => s + b.totalPrice, 0));
      const totalEventPlatformFee = Math.round(paidEvents.reduce((s, b) => s + b.platformFeeAmount, 0));
      const totalEventOrganizerPayout = Math.round(
        paidEvents.reduce((s, b) => s + b.organizerRevenueAmount, 0)
      );
      const totalTicketsCount = paidEvents.reduce((s, b) => s + b.ticketCount, 0);

      const tableRows = eventBookings.map((b) => [
        b.ticketCode,
        b.eventTitle,
        b.guestName,
        b.guestPhone,
        b.ticketCount,
        eventPaymentMethodLabel(b.paymentMethod),
        eventPaymentStatusLabel(b.paymentStatus),
        eventCheckInLabel(b.checkInStatus),
        `Rp ${Math.round(b.totalPrice).toLocaleString("id-ID")}`,
        `Rp ${Math.round(b.platformFeeAmount).toLocaleString("id-ID")}`,
        `Rp ${Math.round(b.organizerRevenueAmount).toLocaleString("id-ID")}`,
      ]);

      return {
        title: "Laporan tiket event",
        subtitle: `Penjualan tiket dan bagi hasil event komunitas di ${scopeName}`,
        summaryCards: [
          { label: "Omzet tiket", value: `Rp ${totalEventGross.toLocaleString("id-ID")}` },
          { label: "Tiket terjual", value: `${totalTicketsCount} tiket` },
          {
            label: "Fee DAGO (20%)",
            value: `Rp ${totalEventPlatformFee.toLocaleString("id-ID")}`,
          },
          {
            label: "Bagian komunitas (80%)",
            value: `Rp ${totalEventOrganizerPayout.toLocaleString("id-ID")}`,
          },
        ],
        tableHeaders: [
          "Kode tiket",
          "Event",
          "Peserta",
          "WhatsApp",
          "Jumlah tiket",
          "Metode bayar",
          "Status bayar",
          "Check-in",
          "Omzet (Rp)",
          "Fee DAGO 20% (Rp)",
          "Bagian komunitas 80% (Rp)",
        ],
        tableRows,
        reconciliationInfo: [
          { label: "Bagi hasil", value: "20% DAGO, 80% komunitas" },
        ],
      };
    }

    case "RECONCILIATION": {
      const reconResult = analyzeTransactionDiscrepancies({
        orders,
        shifts,
      });
      const { summary, discrepancies } = reconResult;

      const tableRows = discrepancies.map((d) => [
        d.referenceNo,
        formatMakassarDate(d.timestamp),
        d.cashierOrStaff,
        d.typeLabel,
        d.financialImpact,
        d.reason,
        d.formattedAmount,
      ]);

      const formattedVariance =
        summary.totalCashVariance < 0
          ? `-Rp ${Math.abs(summary.totalCashVariance).toLocaleString("id-ID")}`
          : summary.totalCashVariance > 0
          ? `+Rp ${summary.totalCashVariance.toLocaleString("id-ID")}`
          : "Rp 0";
      const isCashShortage = summary.totalCashierActual < summary.totalCashierExpected;
      const isCashSurplus = summary.totalCashierActual > summary.totalCashierExpected;
      const hasCashVariance = summary.totalCashVariance !== 0;

      return {
        title: "Laporan rekonsiliasi & pelacakan selisih",
        subtitle: `Perbandingan tripartit kasir, struk, dan settlement beserta rincian transaksi penyebab di ${scopeName}`,
        summaryCards: [
          {
            label: "Total kasir fisik",
            value: `Rp ${summary.totalCashierActual.toLocaleString("id-ID")}`,
            valueTone: isCashShortage ? "destructive" : isCashSurplus ? "warning" : undefined,
            sub: `Seharusnya Rp ${summary.totalCashierExpected.toLocaleString("id-ID")}`,
            subTone: isCashShortage ? "destructive" : isCashSurplus ? "warning" : "success",
          },
          {
            label: "Total struk bersih",
            value: `Rp ${summary.totalReceiptsNet.toLocaleString("id-ID")}`,
            sub: `Kotor Rp ${summary.totalReceiptsGross.toLocaleString("id-ID")}`,
            subTone: "muted",
          },
          {
            label: "Total settlement",
            value: `Rp ${summary.totalSettlementNet.toLocaleString("id-ID")}`,
            sub: `Mitra Rp ${summary.totalTenantShare.toLocaleString("id-ID")}`,
            subTone: "info",
          },
          {
            label: "Selisih kas shift",
            value: formattedVariance,
            valueTone: !hasCashVariance
              ? "success"
              : summary.totalCashVariance < 0
              ? "destructive"
              : "warning",
            sub:
              summary.status === "BALANCED"
                ? "Kasir seimbang"
                : summary.totalCashVariance < 0
                ? "Ada selisih kas fisik"
                : "Ada kelebihan kas fisik",
            subTone: !hasCashVariance
              ? "success"
              : summary.totalCashVariance < 0
              ? "destructive"
              : "warning",
          },
          {
            label: "Transaksi bermasalah",
            value: `${summary.discrepanciesCount} transaksi`,
            valueTone:
              summary.discrepanciesCount === 0
                ? "success"
                : summary.totalRefundAmount > 0
                ? "destructive"
                : "warning",
            sub:
              summary.discrepanciesCount === 0
                ? "Semua klop"
                : summary.totalRefundAmount > 0
                ? "Terdapat refund"
                : `${summary.discrepanciesCount} anomali tercatat`,
            subTone:
              summary.discrepanciesCount === 0
                ? "success"
                : summary.totalRefundAmount > 0
                ? "destructive"
                : "warning",
          },
        ],
        tableHeaders: [
          "Referensi",
          "Waktu",
          "Petugas / Kasir",
          "Kategori selisih",
          "Dampak finansial",
          "Keterangan / alasan",
          "Nilai selisih (Rp)",
        ],
        tableRows,
        reconciliationInfo: [
          {
            label: "Status audit",
            value: summary.status === "BALANCED" ? "Seimbang" : "Perlu verifikasi",
            tone: summary.status === "BALANCED" ? "success" : "destructive",
          },
          {
            label: "Pending QRIS",
            value: `Rp ${summary.totalPendingAmount.toLocaleString("id-ID")}`,
            tone: summary.totalPendingAmount > 0 ? "warning" : "muted",
          },
          {
            label: "Total refund",
            value: `Rp ${summary.totalRefundAmount.toLocaleString("id-ID")}`,
            tone: summary.totalRefundAmount > 0 ? "destructive" : "muted",
          },
          {
            label: "Total diskon",
            value: `Rp ${summary.totalDiscountAmount.toLocaleString("id-ID")}`,
            tone: summary.totalDiscountAmount > 0 ? "info" : "muted",
          },
        ],
      };
    }
  }
}
