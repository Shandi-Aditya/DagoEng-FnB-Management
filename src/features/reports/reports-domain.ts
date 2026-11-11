/**
 * Domain murni pelaporan manajemen dan ekspor terstruktur.
 * Mengelola agregasi finansial, penjualan, mutasi stok, rekonsiliasi, dan settlement.
 *
 * Importer:
 * - src/app/(dashboard)/reports/page.tsx
 * - src/features/reports/ReportsToolbar.tsx
 * - src/features/reports/ReportsCategorySelector.tsx
 * - src/features/reports/ReportsPreviewTable.tsx
 * - tests/reports-domain.test.ts
 */

import { OrderRecord, OrderItemRecord } from "@/types/order";
import { MasterProduct } from "@/types/product";
import { ShiftRecord } from "@/types/shift";
import { IngredientItem } from "@/types/inventory";
import { ActivityLogEntry } from "@/types/audit";
import { EventTicketOrder } from "@/types/event";
import { calculateSettlement, getTenantPayoutAccount, maskAccountNumber } from "@/lib/settlement";
import { getOrderTaxBreakdown, aggregateOrdersTaxAndRevenue } from "@/lib/tax-breakdown";
import { orderStatusLabel, paymentMethodLabel } from "@/features/orders/orders-domain";

export type ReportType =
  | "SALES"
  | "CLOSING"
  | "PRODUCTS"
  | "INVENTORY"
  | "FINANCE_AUDIT"
  | "SETTLEMENT"
  | "EVENTS";

export interface ReportSummaryCard {
  label: string;
  value: string;
  sub?: string;
}

export interface ReportReconciliationItem {
  label: string;
  value: string;
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
}

export interface ReportCategoryMeta {
  id: ReportType;
  label: string;
  count: string;
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
}): ReportCategoryMeta[] {
  const categories: ReportCategoryMeta[] = [
    {
      id: "SALES",
      label: "Penjualan POS",
      count: `${params.ordersCount} Trx`,
    },
    {
      id: "SETTLEMENT",
      label: "Settlement mitra",
      count: `${params.tenantsCount} Tenant`,
    },
  ];

  if (params.canAccessEvents) {
    categories.push({
      id: "EVENTS",
      label: "Tiket event",
      count: `${params.paidEventsCount || 0} Peserta`,
    });
  }

  categories.push(
    {
      id: "CLOSING",
      label: "Closing kasir",
      count: `${params.shiftsCount} Shift`,
    },
    {
      id: "PRODUCTS",
      label: "Produk dan margin",
      count: `${params.productsCount} Menu`,
    },
    {
      id: "INVENTORY",
      label: "Stok bahan",
      count: `${params.materialsCount} Bahan`,
    },
    {
      id: "FINANCE_AUDIT",
      label: "Audit keuangan",
      count: `${params.logsCount} Log`,
    }
  );

  return categories;
}

/**
 * Mencari produk terlaris berdasarkan kuantitas pesanan.
 */
function findTopProduct(orders: OrderRecord[]): string {
  const quantities: Record<string, number> = {};
  for (const order of orders) {
    if (order.status === "CANCELLED") continue;
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
        .filter((o) => o.status !== "CANCELLED" && o.paymentMethod !== "CASH")
        .reduce((sum, o) => sum + o.total, 0);

      const totalCashRevenue = orders
        .filter((o) => o.status !== "CANCELLED" && o.paymentMethod === "CASH")
        .reduce((sum, o) => sum + o.total, 0);

      const tableRows = orders.map((o) => {
        const promoName = promos.find((p) => p.id === o.promoId)?.name || o.promoId || "-";
        const disc = getOrderTaxBreakdown(o).discount;
        return [
          o.orderNumber || o.id,
          o.customerName || "Tamu",
          o.tableNumber ? `Meja ${o.tableNumber}` : o.orderType === "DELIVERY" ? "Delivery" : "Takeaway",
          o.createdAt.split("T")[0],
          promoName,
          disc > 0 ? `-Rp ${disc.toLocaleString("id-ID")}` : "-",
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
        ],
        tableHeaders: [
          "Pesanan",
          "Tamu",
          "Meja atau tipe",
          "Tanggal",
          "Promo",
          "Diskon",
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
      ]);

      return {
        title: "Laporan closing kasir",
        subtitle: `Modal awal, penjualan tunai, dan kas fisik per shift di ${scopeName}`,
        summaryCards: [
          { label: "Shift ditutup", value: `${closedShifts.length} shift` },
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
        ],
        tableRows,
        reconciliationInfo: [
          { label: "Status kas", value: totalVariance === 0 ? "Seimbang" : "Ada selisih" },
          { label: "Dibuat oleh", value: operatorName || "Staf" },
        ],
      };
    }

    case "PRODUCTS": {
      let totalMarginPctSum = 0;
      const tableRows = products.map((p) => {
        const hpp = Math.round(p.basePrice * 0.28);
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
        m.category,
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
        l.timestamp.split("T")[0],
        l.actorName || l.userName || "-",
        l.module,
        l.action,
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
      const settlementData = calculateSettlement(orders);
      const totalNetSettlement = settlementData.reduce((sum, s) => sum + s.netRevenue, 0);
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

        return [
          s.tenantId,
          s.tenantName,
          payoutDisplay,
          splitDisplay,
          s.transactionCount,
          `Rp ${s.grossRevenue.toLocaleString("id-ID")}`,
          `Rp ${(s.tenantShareAmount ?? 0).toLocaleString("id-ID")}`,
          `Rp ${(s.dagoShareAmount ?? 0).toLocaleString("id-ID")}`,
          `Rp ${s.netRevenue.toLocaleString("id-ID")}`,
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
      };
    }

    case "EVENTS": {
      const paidEvents = eventBookings.filter((b) => b.paymentStatus === "PAID");
      const totalEventGross = paidEvents.reduce((s, b) => s + b.totalPrice, 0);
      const totalEventPlatformFee = paidEvents.reduce((s, b) => s + b.platformFeeAmount, 0);
      const totalEventOrganizerPayout = paidEvents.reduce((s, b) => s + b.organizerRevenueAmount, 0);
      const totalTicketsCount = paidEvents.reduce((s, b) => s + b.ticketCount, 0);

      const tableRows = eventBookings.map((b) => [
        b.ticketCode,
        b.eventTitle,
        b.guestName,
        b.guestPhone,
        b.ticketCount,
        b.paymentMethod,
        b.paymentStatus,
        b.checkInStatus === "CHECKED_IN" ? "HADIR" : "BELUM HADIR",
        `Rp ${b.totalPrice.toLocaleString("id-ID")}`,
        `Rp ${b.platformFeeAmount.toLocaleString("id-ID")}`,
        `Rp ${b.organizerRevenueAmount.toLocaleString("id-ID")}`,
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
  }
}
