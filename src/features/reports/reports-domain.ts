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
import { toWitaDateKey } from "@/contexts/DateFilterContext";
import { bookingCheckInStatusLabel } from "@/features/coworking/coworking-domain";
import { ingredientCategoryLabel } from "@/features/inventory/inventory-reorder";
import { filterOrdersByTenant, orderStatusLabel, paymentMethodLabel } from "@/features/orders/orders-domain";
import {
  calculateSettlement,
  getTenantPayoutAccount,
  maskAccountNumber,
  resolveItemTenantId,
} from "@/lib/settlement";
import {
  getStoredSettlementReceiptPolicy,
  settlementBasisLabel,
  type SettlementBasisMode,
} from "@/lib/settlement-receipt-policy";
import {
  aggregateOrdersTaxAndRevenue,
  getOrderTaxBreakdown,
  isCoworkingOrderItem,
} from "@/lib/tax-breakdown";
import { getTenantName } from "@/lib/tenant";
import type { ActivityLogEntry } from "@/types/audit";
import type { CoworkingBooking } from "@/types/coworking";
import type { EventTicketOrder } from "@/types/event";
import type { IngredientItem } from "@/types/inventory";
import type { OrderItemRecord, OrderRecord } from "@/types/order";
import type { MasterProduct } from "@/types/product";
import type { ShiftRecord } from "@/types/shift";
import { analyzeTransactionDiscrepancies } from "./reconciliation-domain";
import {
  buildVoidRefundDiscountReport,
  countVoidRefundDiscountEntries,
} from "./void-refund-discount-domain";

export { buildVoidRefundDiscountReport, countVoidRefundDiscountEntries };

export type ReportType =
  | "SALES"
  | "CLOSING"
  | "PRODUCTS"
  | "INVENTORY"
  | "FINANCE_AUDIT"
  | "SETTLEMENT"
  | "EVENTS"
  | "RECONCILIATION"
  | "VOID_REFUND_DISCOUNT";

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
    case "VOID_REFUND_DISCOUNT":
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
  REFUND_ORDER: "Refund pesanan",
  APPLY_DISCOUNT: "Diskon manual",
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
  const dateKey = toWitaDateKey(iso);
  if (dateKey) {
    const normalized = new Date(`${dateKey}T12:00:00Z`);
    if (!Number.isNaN(normalized.getTime())) {
      return normalized.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Makassar",
      });
    }
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso.split("T")[0] ?? iso;
  return parsed.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Makassar",
  });
}

export function projectOrdersForTenant(
  orders: readonly OrderRecord[],
  tenantId: string
): OrderRecord[] {
  return filterOrdersByTenant([...orders], tenantId, true);
}

function formatOrderUnitContext(order: OrderRecord): string {
  const baseLabel = order.tableNumber
    ? `Meja ${order.tableNumber}`
    : order.orderType === "DELIVERY"
    ? "Delivery"
    : "Takeaway";
  const items = order.items || [];
  if (items.length === 0) return baseLabel;

  const orderFallback = (order as { tenantId?: string }).tenantId;
  const partnerCounts = new Map<string, { label: string; qty: number }>();
  let hasCoworking = false;

  for (const item of items) {
    const isCw = isCoworkingOrderItem(item);
    if (isCw) hasCoworking = true;
    const resolvedTenant = isCw
      ? "DAGO_HUB"
      : resolveItemTenantId(item, orderFallback);
    const label =
      resolvedTenant === "DAGO_HUB"
        ? "Dago Creative Hub (Co-Working)"
        : getTenantName(resolvedTenant) || item.tenantName || resolvedTenant;
    const prev = partnerCounts.get(resolvedTenant) || { label, qty: 0 };
    partnerCounts.set(resolvedTenant, {
      label: prev.label,
      qty: prev.qty + (Number(item.quantity) || 0),
    });
  }

  if (!hasCoworking && partnerCounts.size <= 1) {
    return baseLabel;
  }

  const summary = Array.from(partnerCounts.values())
    .map((entry) => `${entry.label} (${entry.qty}x)`)
    .join(" + ");
  return `${baseLabel} · ${summary}`;
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
  products?: MasterProduct[];
  shifts?: ShiftRecord[];
  ingredients?: IngredientItem[];
  logs?: ActivityLogEntry[];
  promos?: PromoReference[];
  eventBookings?: EventTicketOrder[];
  coworkingBookings?: CoworkingBooking[];
  tenantId?: string;
  operatorName?: string;
  settlementBasis?: SettlementBasisMode;
  customSplits?: Record<string, { tenantSharePercent: number; dagoSharePercent: number }>;
  isTimestampInRange?: (isoTimestamp: string) => boolean;
  companyName?: string;
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
  voidRefundDiscountCount?: number;
  isTenantScope?: boolean;
}): ReportCategoryMeta[] {
  const adjustmentCount = params.voidRefundDiscountCount ?? 0;

  if (params.isTenantScope) {
    return [
      {
        id: "SALES",
        label: "Penjualan POS",
        count: `${params.ordersCount} Trx`,
        rawCount: params.ordersCount,
      },
      {
        id: "SETTLEMENT",
        label: "Settlement mitra",
        count: `${params.tenantsCount} Tenant`,
        rawCount: params.tenantsCount,
      },
      {
        id: "PRODUCTS",
        label: "Produk dan margin",
        count: `${params.productsCount} Menu`,
        rawCount: params.productsCount,
      },
      {
        id: "VOID_REFUND_DISCOUNT",
        label: "Void, refund & diskon",
        count: `${adjustmentCount} Kejadian`,
        rawCount: adjustmentCount,
      },
    ];
  }

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
      id: "VOID_REFUND_DISCOUNT",
      label: "Void, refund & diskon",
      count: `${adjustmentCount} Kejadian`,
      rawCount: adjustmentCount,
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
 * Memeriksa apakah pesanan berstatus lunas dan tidak dibatalkan / refund / ditolak sync.
 */
export function isSettledPaidOrder(order: OrderRecord): boolean {
  return (
    order.paymentStatus === "PAID" &&
    order.status !== "CANCELLED" &&
    !order.refundedAt &&
    order.syncStatus !== "REJECTED"
  );
}

/**
 * Mencari produk terlaris berdasarkan kuantitas pesanan yang berstatus lunas (PAID).
 */
export function findTopProduct(
  orders: OrderRecord[],
  allowedProducts?: MasterProduct[]
): string {
  if (allowedProducts !== undefined && allowedProducts.length === 0) {
    return "-";
  }

  const allowedProductNames = allowedProducts
    ? new Set(allowedProducts.map((p) => p.name.trim().toLowerCase()))
    : null;
  const allowedProductIds = allowedProducts
    ? new Set(allowedProducts.map((p) => p.id.trim().toLowerCase()))
    : null;

  const quantities: Record<string, number> = {};
  for (const order of orders) {
    if (!isSettledPaidOrder(order)) continue;
    for (const item of order.items) {
      if (allowedProductNames || allowedProductIds) {
        const matchesName = allowedProductNames?.has(item.productName.trim().toLowerCase());
        const matchesId =
          item.productId && allowedProductIds?.has(item.productId.trim().toLowerCase());
        if (!matchesName && !matchesId) continue;
      }
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
    orders: rawOrders,
    products: rawProducts = [],
    shifts = [],
    ingredients = [],
    logs = [],
    promos = [],
    eventBookings = [],
    coworkingBookings = [],
    tenantId,
    operatorName,
    settlementBasis,
    customSplits,
    isTimestampInRange,
    companyName,
  } = params;

  const tenantOrders = tenantId ? projectOrdersForTenant(rawOrders, tenantId) : rawOrders;
  const orders =
    companyName && companyName !== "ALL"
      ? tenantOrders.filter(
          (o) => o.corporateInfo?.companyName?.trim().toLowerCase() === companyName.trim().toLowerCase()
        )
      : tenantOrders;

  const products = tenantId ? rawProducts.filter((p) => p.tenantId === tenantId) : rawProducts;
  const tenantCoworking = tenantId ? [] : coworkingBookings;
  const effectiveCoworking =
    companyName && companyName !== "ALL"
      ? tenantCoworking.filter(
          (b) => b.company?.trim().toLowerCase() === companyName.trim().toLowerCase()
        )
      : tenantCoworking;

  switch (type) {
    case "SALES": {
      const paidOrders = orders.filter(isSettledPaidOrder);
      const paidCoworking = effectiveCoworking.filter(
        (b) =>
          b.paymentStatus === "PAID" &&
          b.checkInStatus !== "CANCELLED" &&
          !b.linkedOrderId &&
          !b.billedViaPosOrder
      );

      const aggregatedTax = aggregateOrdersTaxAndRevenue(paidOrders);
      const coworkingRevenue = paidCoworking.reduce(
        (sum, b) => sum + ((b as { paidAmount?: number }).paidAmount ?? b.totalAmount ?? 0),
        0
      );
      const coworkingDiscount = paidCoworking.reduce((sum, b) => sum + (b.discount || 0), 0);
      const coworkingTax = paidCoworking.reduce((sum, b) => sum + (b.tax || 0), 0);

      const totalRevenue = aggregatedTax.totalRevenue + coworkingRevenue;
      const totalDiscounts = aggregatedTax.totalDiscounts + coworkingDiscount;
      const totalTaxPB1 = aggregatedTax.totalTaxPB1 + coworkingTax;
      const totalOrdersCount = paidOrders.length + paidCoworking.length;
      const totalItemsSold =
        paidOrders.reduce(
          (sum: number, o: OrderRecord) =>
            sum + o.items.reduce((iSum: number, it: OrderItemRecord) => iSum + it.quantity, 0),
          0
        ) + paidCoworking.length;

      const totalNonCashRevenue =
        paidOrders
          .filter((o) => o.paymentMethod !== "CASH")
          .reduce((sum, o) => sum + o.total, 0) +
        paidCoworking
          .filter((b) => (b.paymentMethod || "QRIS").toUpperCase() !== "CASH")
          .reduce(
            (sum, b) => sum + ((b as { paidAmount?: number }).paidAmount ?? b.totalAmount ?? 0),
            0
          );

      const totalCashRevenue =
        paidOrders
          .filter((o) => o.paymentMethod === "CASH")
          .reduce((sum, o) => sum + o.total, 0) +
        paidCoworking
          .filter((b) => (b.paymentMethod || "QRIS").toUpperCase() === "CASH")
          .reduce(
            (sum, b) => sum + ((b as { paidAmount?: number }).paidAmount ?? b.totalAmount ?? 0),
            0
          );

      let coworkingInPosGross = 0;
      let fnbInPosGross = 0;
      for (const order of paidOrders) {
        for (const item of order.items || []) {
          const lineGross = (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0);
          if (isCoworkingOrderItem(item)) {
            coworkingInPosGross += lineGross;
          } else {
            fnbInPosGross += lineGross;
          }
        }
      }

      const orderRows = paidOrders.map((o) => {
        const promoName = promos.find((p) => p.id === o.promoId)?.name || o.promoId || "-";
        const breakdown = getOrderTaxBreakdown(o);
        const disc = breakdown.discount;
        const pb1 = breakdown.pb1;
        const service = breakdown.serviceCharge;
        const customerDisplayName = o.corporateInfo?.companyName
          ? o.customerName && o.customerName.includes(`[${o.corporateInfo.companyName}]`)
            ? o.customerName
            : `${o.customerName || "Tamu"} [${o.corporateInfo.companyName}]`
          : o.customerName || "Tamu";
        return [
          o.orderNumber || o.id,
          customerDisplayName,
          formatOrderUnitContext(o),
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

      const coworkingRows = paidCoworking.map((b) => {
        const disc = b.discount || 0;
        const tax = b.tax || 0;
        const amount = (b as { paidAmount?: number }).paidAmount ?? b.totalAmount ?? 0;
        const guestDisplayName = b.company
          ? `${b.guestName || "Tamu"} [${b.company}]`
          : b.guestName || "Tamu";
        return [
          b.bookingCode || b.id,
          guestDisplayName,
          `Co-working · ${b.spaceName}`,
          formatMakassarDate(b.createdAt || b.date),
          b.promoTitle || "-",
          disc > 0 ? `-Rp ${disc.toLocaleString("id-ID")}` : "-",
          tax > 0 ? `Rp ${tax.toLocaleString("id-ID")}` : "Rp 0",
          "Rp 0",
          bookingCheckInStatusLabel(b.checkInStatus),
          paymentMethodLabel((b.paymentMethod || "QRIS") as OrderRecord["paymentMethod"]),
          `Rp ${amount.toLocaleString("id-ID")}`,
        ];
      });

      const tableRows = [...orderRows, ...coworkingRows];

      return {
        title: "Laporan penjualan POS",
        subtitle:
          companyName && companyName !== "ALL"
            ? `Filter perusahaan: ${companyName} di ${scopeName}`
            : paidCoworking.length > 0
            ? `Semua transaksi kasir dan co-working di ${scopeName}`
            : `Semua transaksi kasir di ${scopeName}`,
        summaryCards: [
          { label: "Omzet", value: `Rp ${totalRevenue.toLocaleString("id-ID")}` },
          {
            label: "Transaksi",
            value:
              paidCoworking.length > 0
                ? `${totalOrdersCount} transaksi`
                : `${paidOrders.length} pesanan`,
          },
          { label: "Diskon promo", value: `Rp ${totalDiscounts.toLocaleString("id-ID")}` },
          { label: "Item terjual", value: `${totalItemsSold} item` },
          { label: "Total PB1", value: `Rp ${totalTaxPB1.toLocaleString("id-ID")}` },
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
          { label: "PB1", value: `Rp ${totalTaxPB1.toLocaleString("id-ID")}` },
          {
            label: "Service charge",
            value: `Rp ${aggregatedTax.totalServiceCharge.toLocaleString("id-ID")}`,
          },
          { label: "Diskon promo", value: `Rp ${totalDiscounts.toLocaleString("id-ID")}` },
          {
            label: "Nontunai",
            value: `Rp ${totalNonCashRevenue.toLocaleString("id-ID")}`,
          },
          {
            label: "Tunai",
            value: `Rp ${totalCashRevenue.toLocaleString("id-ID")}`,
          },
          ...(coworkingInPosGross > 0
            ? [
                {
                  label: "Co-working POS (0% PB1)",
                  value: `Rp ${Math.round(coworkingInPosGross).toLocaleString("id-ID")}`,
                },
                {
                  label: "F&B POS",
                  value: `Rp ${Math.round(fnbInPosGross).toLocaleString("id-ID")}`,
                },
              ]
            : []),
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
          : s.status === "ACTIVE" || s.status === "OPEN"
          ? "Aktif"
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
      let totalSoldAll = 0;

      // Index catalog products by normalized ID and normalized name
      const productById = new Map<string, (typeof products)[number]>();
      const productByName = new Map<string, (typeof products)[number]>();
      const salesByProductId = new Map<string, { qty: number; revenue: number }>();

      for (const p of products) {
        if (p.id) {
          productById.set(p.id.trim().toLowerCase(), p);
        }
        if (p.name) {
          productByName.set(p.name.trim().toLowerCase(), p);
        }
        salesByProductId.set(p.id, { qty: 0, revenue: 0 });
      }

      // Pre-aggregate product sales from settled paid orders matching the catalog
      for (const order of orders) {
        if (!isSettledPaidOrder(order)) continue;
        for (const item of order.items) {
          const normItemId = item.productId ? item.productId.trim().toLowerCase() : "";
          const normItemName = item.productName ? item.productName.trim().toLowerCase() : "";

          const matchedProduct =
            (normItemId ? productById.get(normItemId) : undefined) ||
            (normItemName ? productByName.get(normItemName) : undefined);

          if (!matchedProduct) continue;

          const itemQty = item.quantity || 0;
          const itemRev = (item.unitPrice || 0) * itemQty;
          totalSoldAll += itemQty;

          const current = salesByProductId.get(matchedProduct.id) || { qty: 0, revenue: 0 };
          salesByProductId.set(matchedProduct.id, {
            qty: current.qty + itemQty,
            revenue: current.revenue + itemRev,
          });
        }
      }

      const tableRows = products
        .filter((p) => {
          if (companyName && companyName !== "ALL") {
            const pSales = salesByProductId.get(p.id);
            return Boolean(pSales && pSales.qty > 0);
          }
          return true;
        })
        .map((p) => {
          const hpp =
            p.cogsEstimate !== undefined && p.cogsEstimate > 0
              ? p.cogsEstimate
              : Math.round(p.basePrice * 0.28);
          const marginRp = p.basePrice - hpp;
          const marginPct = p.basePrice > 0 ? (marginRp / p.basePrice) * 100 : 0;
          totalMarginPctSum += marginPct;

          const pSales = salesByProductId.get(p.id) || {
            qty: 0,
            revenue: 0,
          };

          return [
            p.id,
            p.name,
            p.category,
            `Rp ${p.basePrice.toLocaleString("id-ID")}`,
            `Rp ${hpp.toLocaleString("id-ID")}`,
            `Rp ${marginRp.toLocaleString("id-ID")}`,
            `${marginPct.toFixed(1)}%`,
            `${pSales.qty} pcs`,
            `Rp ${pSales.revenue.toLocaleString("id-ID")}`,
          ];
        });

      const avgMarginPct =
        products.length > 0 ? (totalMarginPctSum / products.length).toFixed(1) : "0.0";
      const topProduct = findTopProduct(orders, products);

      return {
        title: "Laporan produk dan margin",
        subtitle:
          companyName && companyName !== "ALL"
            ? `Filter perusahaan: ${companyName} di ${scopeName}`
            : `Harga jual, estimasi HPP, dan margin kotor menu di ${scopeName}`,
        summaryCards: [
          { label: "Menu terdaftar", value: `${products.length} menu` },
          { label: "Rata-rata margin kotor", value: `${avgMarginPct}%` },
          { label: "Paling laris", value: topProduct },
          { label: "Total terjual", value: `${totalSoldAll} pcs` },
        ],
        tableHeaders: [
          "SKU",
          "Menu",
          "Kategori",
          "Harga jual",
          "Estimasi HPP",
          "Margin kotor (Rp)",
          "Margin (%)",
          "Terjual",
          "Omzet lunas",
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
      const rawSettlementData = calculateSettlement(orders, undefined, customSplits, {
        settlementBasis: effectiveBasis,
      });
      const settlementData = tenantId
        ? rawSettlementData.filter((s) => s.tenantId === tenantId)
        : rawSettlementData;
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

      const paidCoworking = effectiveCoworking.filter(
        (b) =>
          b.paymentStatus === "PAID" &&
          b.checkInStatus !== "CANCELLED" &&
          !b.linkedOrderId &&
          !b.billedViaPosOrder
      );
      const pendingCoworkingQris = effectiveCoworking.filter(
        (b) =>
          b.paymentMethod === "QRIS" &&
          b.paymentStatus === "PENDING" &&
          b.checkInStatus !== "CANCELLED" &&
          !b.linkedOrderId &&
          !b.billedViaPosOrder
      );
      const discountedCoworking = paidCoworking.filter((b) => (b.discount || 0) > 0);

      const coworkingPaidTotal = paidCoworking.reduce(
        (sum, b) => sum + ((b as { paidAmount?: number }).paidAmount ?? b.totalAmount ?? 0),
        0
      );
      const coworkingGrossTotal =
        paidCoworking.reduce((sum, b) => sum + (b.price ?? b.totalAmount ?? 0), 0) +
        pendingCoworkingQris.reduce((sum, b) => sum + (b.totalAmount ?? 0), 0);
      const coworkingPendingTotal = pendingCoworkingQris.reduce(
        (sum, b) => sum + (b.totalAmount ?? 0),
        0
      );
      const coworkingDiscountTotal = discountedCoworking.reduce(
        (sum, b) => sum + (b.discount || 0),
        0
      );

      const orderReconRows = discrepancies.map((d) => [
        d.referenceNo,
        formatMakassarDate(d.timestamp),
        d.cashierOrStaff,
        d.typeLabel,
        d.financialImpact,
        d.reason,
        d.formattedAmount,
      ]);

      const coworkingPendingRows = pendingCoworkingQris.map((b) => [
        b.bookingCode || b.id,
        formatMakassarDate(b.createdAt || b.date),
        "Sistem Gateway",
        "QRIS Belum Konfirmasi (Co-working)",
        "Dana belum masuk rekening settlement DAGO",
        "Pembayaran QRIS co-working belum diverifikasi supervisor",
        `Rp ${(b.totalAmount || 0).toLocaleString("id-ID")}`,
      ]);

      const coworkingDiscountRows = discountedCoworking.map((b) => [
        b.bookingCode || b.id,
        formatMakassarDate(b.createdAt || b.date),
        "Staf Co-working",
        "Diskon Promo (Co-working)",
        "Mengurangi kas bersih dibanding tarif ruang kotor",
        b.promoTitle ? `Promo: ${b.promoTitle}` : "Potongan tarif sewa ruang",
        `-Rp ${(b.discount || 0).toLocaleString("id-ID")}`,
      ]);

      const tableRows = [...orderReconRows, ...coworkingPendingRows, ...coworkingDiscountRows];

      const totalReceiptsNet = summary.totalReceiptsNet + coworkingPaidTotal;
      const totalReceiptsGross = summary.totalReceiptsGross + coworkingGrossTotal;
      const totalSettlementNet = summary.totalSettlementNet + coworkingPaidTotal;
      const totalPendingAmount = summary.totalPendingAmount + coworkingPendingTotal;
      const totalDiscountAmount = summary.totalDiscountAmount + coworkingDiscountTotal;
      const discrepanciesCount =
        summary.discrepanciesCount + coworkingPendingRows.length + coworkingDiscountRows.length;
      const auditBalanced = discrepanciesCount === 0 && summary.status === "BALANCED";

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
            value: `Rp ${totalReceiptsNet.toLocaleString("id-ID")}`,
            sub: `Kotor Rp ${totalReceiptsGross.toLocaleString("id-ID")}`,
            subTone: "muted",
          },
          {
            label: "Total settlement",
            value: `Rp ${totalSettlementNet.toLocaleString("id-ID")}`,
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
              auditBalanced && !hasCashVariance
                ? "Kasir seimbang"
                : summary.totalCashVariance < 0
                ? "Ada selisih kas fisik"
                : summary.totalCashVariance > 0
                ? "Ada kelebihan kas fisik"
                : "Kasir seimbang",
            subTone: !hasCashVariance
              ? "success"
              : summary.totalCashVariance < 0
              ? "destructive"
              : "warning",
          },
          {
            label: "Transaksi bermasalah",
            value: `${discrepanciesCount} transaksi`,
            valueTone:
              discrepanciesCount === 0
                ? "success"
                : summary.totalRefundAmount > 0
                ? "destructive"
                : "warning",
            sub:
              discrepanciesCount === 0
                ? "Semua klop"
                : summary.totalRefundAmount > 0
                ? "Terdapat refund"
                : `${discrepanciesCount} anomali tercatat`,
            subTone:
              discrepanciesCount === 0
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
            value: auditBalanced ? "Seimbang" : "Perlu verifikasi",
            tone: auditBalanced ? "success" : "destructive",
          },
          {
            label: "Pending QRIS",
            value: `Rp ${totalPendingAmount.toLocaleString("id-ID")}`,
            tone: totalPendingAmount > 0 ? "warning" : "muted",
          },
          {
            label: "Total refund",
            value: `Rp ${summary.totalRefundAmount.toLocaleString("id-ID")}`,
            tone: summary.totalRefundAmount > 0 ? "destructive" : "muted",
          },
          {
            label: "Total diskon",
            value: `Rp ${totalDiscountAmount.toLocaleString("id-ID")}`,
            tone: totalDiscountAmount > 0 ? "info" : "muted",
          },
        ],
      };
    }

    case "VOID_REFUND_DISCOUNT": {
      return buildVoidRefundDiscountReport({
        orders,
        logs,
        scopeName,
        tenantId,
        isTimestampInRange,
      });
    }
  }
}

export function extractAvailableReportCompanies(
  orders: OrderRecord[],
  coworkingBookings: Array<{ company?: string }>
): string[] {
  const set = new Set<string>();
  orders.forEach((o) => {
    if (o.corporateInfo?.companyName?.trim()) {
      set.add(o.corporateInfo.companyName.trim());
    }
  });
  coworkingBookings.forEach((b) => {
    if (b.company?.trim()) {
      set.add(b.company.trim());
    }
  });
  return Array.from(set).sort();
}

