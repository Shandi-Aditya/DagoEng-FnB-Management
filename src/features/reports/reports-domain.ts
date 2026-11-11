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
      label: "Settlement Mitra",
      count: `${params.tenantsCount} Tenant`,
    },
  ];

  if (params.canAccessEvents) {
    categories.push({
      id: "EVENTS",
      label: "Event & Tiket",
      count: `${params.paidEventsCount || 0} Peserta`,
    });
  }

  categories.push(
    {
      id: "CLOSING",
      label: "Closing Kasir",
      count: `${params.shiftsCount} Shift`,
    },
    {
      id: "PRODUCTS",
      label: "Sales & Margin",
      count: `${params.productsCount} Menu`,
    },
    {
      id: "INVENTORY",
      label: "Mutasi Gudang",
      count: `${params.materialsCount} Bahan`,
    },
    {
      id: "FINANCE_AUDIT",
      label: "Finance Audit",
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
          o.customerName || "Walk-in Guest",
          o.tableNumber ? `Meja ${o.tableNumber}` : o.orderType || "DINE_IN",
          o.createdAt.split("T")[0],
          promoName,
          disc > 0 ? `-Rp ${disc.toLocaleString("id-ID")}` : "-",
          o.status,
          o.paymentMethod || "QRIS",
          `Rp ${o.total.toLocaleString("id-ID")}`,
        ];
      });

      return {
        title: "Laporan Penjualan & Revenue POS",
        subtitle: `Rincian seluruh transaksi kasir dan pesanan terselesaikan di ${scopeName}`,
        summaryCards: [
          { label: "Total Omset (Revenue)", value: `Rp ${totalRevenue.toLocaleString("id-ID")}` },
          { label: "Jumlah Transaksi", value: `${totalOrdersCount} Order` },
          { label: "Total Diskon Promo", value: `Rp ${totalDiscounts.toLocaleString("id-ID")}` },
          { label: "Item Terjual", value: `${totalItemsSold} Pcs` },
        ],
        tableHeaders: [
          "ID Order",
          "Customer",
          "Meja/Tipe",
          "Waktu",
          "Promo",
          "Diskon",
          "Status",
          "Metode Bayar",
          "Total (Rp)",
        ],
        tableRows,
        reconciliationInfo: [
          { label: "Total Pajak PB1", value: `Rp ${aggregatedTax.totalTaxPB1.toLocaleString("id-ID")}` },
          {
            label: "Total Service Charge",
            value: `Rp ${aggregatedTax.totalServiceCharge.toLocaleString("id-ID")}`,
          },
          { label: "Total Diskon Promo", value: `Rp ${totalDiscounts.toLocaleString("id-ID")}` },
          {
            label: "Metode Non-Tunai / QRIS",
            value: `Rp ${totalNonCashRevenue.toLocaleString("id-ID")}`,
          },
          { label: "Metode Kas Tunai", value: `Rp ${totalCashRevenue.toLocaleString("id-ID")}` },
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
        title: "Laporan Rekonsiliasi Kasir & Shift Closing",
        subtitle: `Pencocokan modal awal, penjualan kas, dan fisik drawer di ${scopeName}`,
        summaryCards: [
          { label: "Total Shift Selesai", value: `${closedShifts.length} Shift` },
          { label: "Akumulasi Kas Drawer", value: `Rp ${totalActualCash.toLocaleString("id-ID")}` },
          { label: "Total Selisih Kas", value: `Rp ${totalVariance.toLocaleString("id-ID")}` },
        ],
        tableHeaders: [
          "Shift ID",
          "Nama Shift",
          "Kasir",
          "Modal Awal",
          "Penjualan Tunai",
          "Target Fisik",
          "Kas Nyata",
          "Selisih",
        ],
        tableRows,
        reconciliationInfo: [
          { label: "Status Rekonsiliasi", value: "Tervalidasi Cashier Closing" },
          { label: "Petugas Pelapor", value: operatorName || "Staf Operasional" },
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
        title: "Laporan Penjualan Produk & COGS / Gross Margin",
        subtitle: `Kinerja profitabilitas menu F&B dan margin kotor di ${scopeName}`,
        summaryCards: [
          { label: "Total SKU Terdaftar", value: `${products.length} Produk` },
          { label: "Rata-rata Gross Margin", value: `${avgMarginPct}%` },
          { label: "Top Product Terlaris", value: topProduct },
        ],
        tableHeaders: [
          "Kode SKU",
          "Nama Produk",
          "Kategori",
          "Harga Jual",
          "Estimasi HPP",
          "Margin Kotor (Rp)",
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
        title: "Laporan Mutasi Inventory & Stok Bahan Baku",
        subtitle: `Posisi stok aktual, konsumsi resep (BOM), dan nilai gudang di ${scopeName}`,
        summaryCards: [
          { label: "Total Bahan Baku", value: `${ingredients.length} Item` },
          { label: "Item Kritis / Habis", value: `${criticalItems.length} Item` },
          {
            label: "Total Nilai Inventori",
            value: `Rp ${totalInventoryValuation.toLocaleString("id-ID")}`,
          },
        ],
        tableHeaders: [
          "Nama Bahan",
          "Kategori",
          "Stok Sistem",
          "Min. Buffer",
          "Satuan",
          "Harga Satuan",
          "Total Valuasi",
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
        title: "Laporan Audit Trail Finansial & Void/Refund",
        subtitle: `Rekam jejak seluruh mutasi dana, penyesuaian kas, dan transaksi di ${scopeName}`,
        summaryCards: [
          { label: "Total Aktivitas Keuangan", value: `${logs.length} Entri` },
          { label: "Status Audit", value: "Terverifikasi Sistem" },
          { label: "Keamanan Log", value: "Immutable (Kekal)" },
        ],
        tableHeaders: [
          "Timestamp",
          "Aktor",
          "Modul",
          "Aksi",
          "Perubahan Data / Nominal",
          "Alasan / Notes",
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
            ? "Rekening Pusat DAGO"
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
        title: "Laporan Settlement & Bagi Hasil Mitra",
        subtitle: `Rincian alokasi pendapatan, rekening tujuan pencairan, dan bagi hasil untuk Dago Hub dan Mitra di ${scopeName}`,
        summaryCards: [
          { label: "Total Net Settlement", value: `Rp ${totalNetSettlement.toLocaleString("id-ID")}` },
          { label: "Total Bagian Mitra", value: `Rp ${totalTenantShare.toLocaleString("id-ID")}` },
          { label: "Total Bagian DAGO", value: `Rp ${totalDagoShare.toLocaleString("id-ID")}` },
          { label: "Total Diskon (Prorata)", value: `Rp ${totalDiscount.toLocaleString("id-ID")}` },
        ],
        tableHeaders: [
          "Tenant ID",
          "Tenant Name",
          "Rekening Pencairan",
          "Skema Bagi Hasil",
          "Trx",
          "Gross (Rp)",
          "Bagian Mitra (Rp)",
          "Bagian DAGO (Rp)",
          "Net Settlement",
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
        title: "Laporan Pendapatan & Tiket Event Komunitas",
        subtitle: `Rekapitulasi penjualan tiket dan skema bagi hasil 20% Dago Creative Hub di ${scopeName}`,
        summaryCards: [
          { label: "Total Omset Tiket", value: `Rp ${totalEventGross.toLocaleString("id-ID")}` },
          { label: "Total Tiket Terjual", value: `${totalTicketsCount} Tiket` },
          {
            label: "Fee Platform Dago (20%)",
            value: `Rp ${totalEventPlatformFee.toLocaleString("id-ID")}`,
          },
          {
            label: "Payout Komunitas (80%)",
            value: `Rp ${totalEventOrganizerPayout.toLocaleString("id-ID")}`,
          },
        ],
        tableHeaders: [
          "Kode Tiket",
          "Nama Event",
          "Nama Peserta",
          "No WhatsApp",
          "Qty Tiket",
          "Metode Bayar",
          "Status Bayar",
          "Check-In",
          "Total Omset (Rp)",
          "Fee Dago 20% (Rp)",
          "Payout Komunitas 80% (Rp)",
        ],
        tableRows,
        reconciliationInfo: [
          { label: "Model Bagi Hasil", value: "20% Dago Creative Hub / 80% Komunitas" },
          { label: "Gateway Tiket", value: "Sistem Terintegrasi DAGO (Simulasi QRIS / Tunai)" },
        ],
      };
    }
  }
}
