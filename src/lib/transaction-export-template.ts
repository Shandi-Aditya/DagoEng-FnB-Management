import ExcelJS from "exceljs";
import {
  formatWitaDateTime,
  getTodayWitaDateString,
  toWitaDateKey,
} from "@/contexts/DateFilterContext";
import type { OrderRecord } from "@/types/order";
import type { MasterProduct } from "@/types/product";
import type { CoworkingBooking } from "@/types/coworking";
import {
  resolveItemTenantId,
  getAllTenantRevenueSplits,
  getTenantRevenueSplit,
} from "@/lib/settlement";
import {
  allocateCategoryDiscounts,
  allocateCategoryTaxAndService,
  isCoworkingOrderItem,
  normalizeTenantId,
} from "@/lib/tax-breakdown";
import { filterOrdersByTenant } from "@/features/orders/orders-domain";
import { getAllFnbTenants, getTenantName } from "@/lib/tenant";
import { INITIAL_PRODUCTS } from "@/lib/master-data-defaults";

export interface TransactionExportParams {
  orders: OrderRecord[];
  products?: MasterProduct[];
  startDate?: Date | string;
  endDate?: Date | string;
  outletName?: string;
  tenantId?: string;
  tenantSplits?: Record<string, { tenantSharePercent: number; dagoSharePercent: number }>;
  coworkingBookings?: CoworkingBooking[];
}

export interface DetailedTransactionRow {
  datetime: string;
  merchant: string;
  category: string;
  product: string;
  quantity: number;
  price: number;
  tax: number;
  discount: number;
  subTotal: number;
  total: number;
  qrisPercent: string;
  qrisTotal: number;
  grandTotal: number;
  shareTenant: number;
  shareDago: number;
  note: string;
  payment: string;
}

export interface TenantShareSummaryRow {
  merchant: string;
  taxTotal: number;
  discountTotal: number;
  subtotal: number;
  total: number;
  qrisTotal: number;
  grandtotal: number;
  shareTenant: number;
  shareDago: number;
}

const KOP_TITLE = "DAGO CREATIVE HUB & COFFE LAB";
const KOP_SUBTITLE = "Transaction Report";
const COLOR_HEADER_ORANGE = "FFF79646";
const COLOR_COL_PEACH = "FFFABF8F";

export function resolveProductCategory(
  productId?: string,
  productName?: string,
  customProducts?: MasterProduct[]
): string {
  const allProducts = customProducts && customProducts.length > 0 ? customProducts : INITIAL_PRODUCTS;
  if (productId) {
    const match = allProducts.find((p) => p.id === productId);
    if (match?.category) return match.category;
  }
  if (productName) {
    const clean = productName.trim().toLowerCase();
    const match = allProducts.find((p) => p.name.trim().toLowerCase() === clean);
    if (match?.category) return match.category;
    const partial = allProducts.find(
      (p) => p.name.toLowerCase().includes(clean) || clean.includes(p.name.toLowerCase())
    );
    if (partial?.category) return partial.category;

    if (/kopi|coffee|espresso|tea|teh|latte|air|mineral|juice|jus|squash|beverage|drink|mojito/i.test(clean)) {
      return "Minuman";
    }
    if (/nasi|mie|ayam|beef|burger|rice|bowl|goreng|bakso|soto|makanan/i.test(clean)) {
      return "Makanan";
    }
    if (/snack|kentang|fries|roti|toast|croissant|camilan|pastry/i.test(clean)) {
      return "Camilan";
    }
  }
  return "Menu";
}

export function formatPeriodRange(
  orders: OrderRecord[],
  startDate?: Date | string,
  endDate?: Date | string
): string {
  if (startDate && endDate) {
    const startFormatted = formatWitaDateTime(startDate, "dd/MM/yyyy");
    const endFormatted = formatWitaDateTime(endDate, "dd/MM/yyyy");
    if (startFormatted && endFormatted) {
      return `${startFormatted} s/d ${endFormatted}`;
    }
  }

  if (orders.length > 0) {
    const dateKeys = orders
      .map((o) => toWitaDateKey(o.createdAt))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    if (dateKeys.length > 0) {
      const first = formatWitaDateTime(dateKeys[0], "dd/MM/yyyy");
      const last = formatWitaDateTime(dateKeys[dateKeys.length - 1], "dd/MM/yyyy");
      if (first && last) {
        return `${first} s/d ${last}`;
      }
    }
  }

  const today = formatWitaDateTime(getTodayWitaDateString(), "dd/MM/yyyy");
  return `${today} s/d ${today}`;
}

export async function buildTransactionTemplateWorkbook(
  params: TransactionExportParams
): Promise<ExcelJS.Workbook> {
  const { orders, products = [], startDate, endDate, tenantSplits } = params;
  const normalizedTargetTenant = params.tenantId
    ? normalizeTenantId(params.tenantId) ?? params.tenantId
    : undefined;
  const paidOrders = orders.filter((o) => o.paymentStatus === "PAID" && o.status !== "CANCELLED");
  const sheet1Orders = normalizedTargetTenant
    ? filterOrdersByTenant(paidOrders, normalizedTargetTenant, true)
    : paidOrders;
  const activeSplits = tenantSplits || getAllTenantRevenueSplits();
  const periodLabel = formatPeriodRange(sheet1Orders, startDate, endDate);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Dago POS";
  workbook.created = new Date();

  // ----------------------------------------------------
  // Sheet 1: transaction
  // ----------------------------------------------------
  const ws1 = workbook.addWorksheet("transaction");

  // Columns & Widths
  ws1.columns = [
    { key: "datetime", width: 20 },
    { key: "tax", width: 8 },
    { key: "discount", width: 12 },
    { key: "tax_total", width: 14 },
    { key: "discount_total", width: 16 },
    { key: "sub_total", width: 16 },
    { key: "total", width: 16 },
    { key: "cust_name", width: 24 },
    { key: "table_number", width: 14 },
    { key: "note", width: 18 },
    { key: "order_type", width: 14 },
    { key: "payment_status", width: 16 },
    { key: "qris", width: 10 },
    { key: "qris_total", width: 14 },
    { key: "grand_total", width: 16 },
  ];

  // Kop Rows 1-3
  ws1.mergeCells("A1:O1");
  const a1 = ws1.getCell("A1");
  a1.value = KOP_TITLE;

  ws1.mergeCells("A2:O2");
  const a2 = ws1.getCell("A2");
  a2.value = KOP_SUBTITLE;

  ws1.mergeCells("A3:O3");
  const a3 = ws1.getCell("A3");
  a3.value = periodLabel;

  [1, 2, 3].forEach((rNum) => {
    const row = ws1.getRow(rNum);
    row.height = 26;
    for (let c = 1; c <= 15; c++) {
      const cell = row.getCell(c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_HEADER_ORANGE } };
      cell.font = { name: "Calibri", size: 20, bold: false };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    }
  });

  // Row 4: Column Headers
  const s1Headers = [
    "datetime",
    "tax",
    "discount",
    "tax total",
    "discount total",
    "sub total",
    "total",
    "cust name",
    "table number",
    "note",
    "order type",
    "payment status",
    "qris",
    "qris total",
    "Grand Total",
  ];
  ws1.addRow(s1Headers);
  const s1HeaderRow = ws1.getRow(4);
  s1HeaderRow.height = 22;
  for (let c = 1; c <= 15; c++) {
    const cell = s1HeaderRow.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_COL_PEACH } };
    cell.font = { name: "Calibri", size: 13, bold: true };
    cell.alignment = { vertical: "middle" };
  }

  // Data rows
  sheet1Orders.forEach((o) => {
    const isQris = o.paymentMethod === "QRIS";
    const subTotal = o.subtotal || 0;
    const taxTotal = o.tax || 0;
    const serviceTotal = o.serviceCharge || 0;
    const discountTotal = o.discount || 0;
    const total = o.total || Math.max(0, subTotal - discountTotal) + taxTotal + serviceTotal;

    const taxPercent =
      o.taxRatePercent !== undefined
        ? o.taxRatePercent
        : subTotal > 0
        ? Math.round((taxTotal / subTotal) * 1000) / 10
        : 0.0;
    const discountPercent =
      subTotal > 0 && discountTotal > 0
        ? Math.round((discountTotal / subTotal) * 1000) / 10
        : 0.0;

    const qrisRate = isQris ? "0.7%" : "";
    const qrisTotal = isQris ? Math.round(total * 0.007 * 100) / 100 : 0;
    const grandTotal = total - qrisTotal;

    const orderType =
      o.orderType === "DINE_IN"
        ? "dineIn"
        : o.orderType === "TAKEAWAY"
        ? "takeAway"
        : o.orderType === "DELIVERY"
        ? "delivery"
        : o.orderType || "dineIn";

    const paymentStatus = (o.paymentMethod || o.paymentStatus || "cash").toLowerCase();
    const dt = formatWitaDateTime(o.createdAt, "dd/MM/yyyy HH:mm");

    ws1.addRow([
      dt,
      taxPercent,
      discountPercent,
      taxTotal,
      discountTotal,
      subTotal,
      total,
      o.customerName || "-",
      o.tableNumber || "-",
      o.notes || "",
      orderType,
      paymentStatus,
      qrisRate,
      qrisTotal,
      grandTotal,
    ]);
  });

  // ----------------------------------------------------
  // Sheet 2: transactionDetail
  // ----------------------------------------------------
  const ws2 = workbook.addWorksheet("transactionDetail");

  ws2.columns = [
    { key: "Datetime", width: 20 },
    { key: "Merchant", width: 22 },
    { key: "Category", width: 24 },
    { key: "Product", width: 30 },
    { key: "Quantity", width: 10 },
    { key: "Price", width: 14 },
    { key: "Tax", width: 10 },
    { key: "Discount", width: 12 },
    { key: "SubTotal", width: 14 },
    { key: "Total", width: 14 },
    { key: "qris", width: 10 },
    { key: "qris_total", width: 12 },
    { key: "GrandTotal", width: 14 },
    { key: "ShareTenant", width: 14 },
    { key: "ShareDago", width: 14 },
    { key: "Note", width: 16 },
    { key: "Payment", width: 12 },
  ];

  // Kop Rows 1-3
  ws2.mergeCells("A1:Q1");
  const ws2A1 = ws2.getCell("A1");
  ws2A1.value = KOP_TITLE;

  ws2.mergeCells("A2:Q2");
  const ws2A2 = ws2.getCell("A2");
  ws2A2.value = KOP_SUBTITLE;

  ws2.mergeCells("A3:Q3");
  const ws2A3 = ws2.getCell("A3");
  ws2A3.value = periodLabel;

  [1, 2, 3].forEach((rNum) => {
    const row = ws2.getRow(rNum);
    row.height = 26;
    for (let c = 1; c <= 17; c++) {
      const cell = row.getCell(c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_HEADER_ORANGE } };
      cell.font = { name: "Calibri", size: 20, bold: false };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    }
  });

  // Row 4 Headers
  const s2Headers = [
    "Datetime",
    "Merchant",
    "Category Product",
    "Product",
    "Quantity",
    "Price",
    "Tax",
    "Discount",
    "Sub Total",
    "Total",
    "qris",
    "qris total",
    "Grand Total",
    "Share Tenant",
    "Share Dago",
    "Note",
    "Payment",
  ];
  ws2.addRow(s2Headers);
  const s2HeaderRow = ws2.getRow(4);
  s2HeaderRow.height = 22;
  for (let c = 1; c <= 17; c++) {
    const cell = s2HeaderRow.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_COL_PEACH } };
    cell.font = { name: "Calibri", size: 13, bold: true };
    cell.alignment = { vertical: "middle" };
  }

  // Pre-calculate items and merchant totals
  const tenantMapTotals = new Map<string, TenantShareSummaryRow>();

  const allTenants = normalizedTargetTenant
    ? getAllFnbTenants().filter((t) => t.id === normalizedTargetTenant)
    : getAllFnbTenants();
  allTenants.forEach((t) => {
    const name = t.name || t.id;
    if (!tenantMapTotals.has(name)) {
      tenantMapTotals.set(name, {
        merchant: name,
        taxTotal: 0,
        discountTotal: 0,
        subtotal: 0,
        total: 0,
        qrisTotal: 0,
        grandtotal: 0,
        shareTenant: 0,
        shareDago: 0,
      });
    }
  });

  paidOrders.forEach((o) => {
    const isQris = o.paymentMethod === "QRIS";
    const payment = (o.paymentMethod || o.paymentStatus || "cash").toLowerCase();
    const dt = formatWitaDateTime(o.createdAt, "dd/MM/yyyy HH:mm");

    const orderItems = o.items || [];
    const itemGrosses = orderItems.map((item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      return Math.round(qty * price);
    });
    const categoryItems = orderItems.map((item, idx) => ({
      isCoworking: isCoworkingOrderItem(item),
      subtotal: itemGrosses[idx] ?? 0,
    }));
    const itemDiscounts = allocateCategoryDiscounts(
      categoryItems,
      o.discount || 0,
      o.fnbDiscount !== undefined || o.coworkingDiscount !== undefined
        ? { fnbDiscount: o.fnbDiscount, coworkingDiscount: o.coworkingDiscount }
        : undefined
    );
    const categoryTaxAllocs = allocateCategoryTaxAndService(
      categoryItems,
      o.tax || 0,
      o.serviceCharge || 0,
      o.fnbTax !== undefined || o.coworkingTax !== undefined
        ? { fnbTax: o.fnbTax, coworkingTax: o.coworkingTax }
        : undefined
    );

    orderItems.forEach((item, idx) => {
      const tenantId = resolveItemTenantId(item, (o as { tenantId?: string }).tenantId);
      if (normalizedTargetTenant && tenantId !== normalizedTargetTenant) {
        return;
      }
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      const itemSubtotal = itemGrosses[idx] ?? 0;
      const itemDiscount = Math.min(itemSubtotal, itemDiscounts[idx] ?? 0);
      const itemTax = categoryTaxAllocs[idx]?.tax ?? 0;
      const itemServiceCharge = categoryTaxAllocs[idx]?.serviceCharge ?? 0;
      const itemTotal =
        Math.max(0, itemSubtotal - itemDiscount) + itemTax + itemServiceCharge;

      const qrisRate = isQris ? "0.7%" : "";
      const qrisTotal = isQris ? Math.round(itemTotal * 0.007 * 100) / 100 : 0;
      const itemGrandTotal = itemTotal - qrisTotal;

      const tenantName =
        tenantId === "DAGO_HUB"
          ? "Dago Creative Hub"
          : getTenantName(tenantId) || tenantId;

      const splitConfig = activeSplits[tenantId] || getTenantRevenueSplit(tenantId);
      const tenantSharePct =
        tenantId === "DAGO_HUB"
          ? 0
          : splitConfig.tenantSharePercent ?? 85;
      const dagoSharePct = 100 - tenantSharePct;

      const shareBase = Math.max(0, itemSubtotal - itemDiscount - qrisTotal);
      const shareTenant = Math.round(shareBase * (tenantSharePct / 100) * 1000) / 1000;
      const shareDago = Math.round(shareBase * (dagoSharePct / 100) * 1000) / 1000;

      const category = isCoworkingOrderItem(item)
        ? item.category || "Co-Working"
        : resolveProductCategory(item.productId, item.productName, products);
      const itemNote = item.notes || o.notes || "";

      ws2.addRow([
        dt,
        tenantName,
        category,
        item.productName,
        qty,
        price,
        itemTax || "",
        itemDiscount || 0,
        itemSubtotal,
        itemTotal,
        qrisRate,
        qrisTotal,
        itemGrandTotal,
        shareTenant,
        shareDago,
        itemNote,
        payment,
      ]);

      // Accumulate into tenantShares
      const existing = tenantMapTotals.get(tenantName) || {
        merchant: tenantName,
        taxTotal: 0,
        discountTotal: 0,
        subtotal: 0,
        total: 0,
        qrisTotal: 0,
        grandtotal: 0,
        shareTenant: 0,
        shareDago: 0,
      };

      existing.taxTotal += itemTax;
      existing.discountTotal += itemDiscount;
      existing.subtotal += itemSubtotal;
      existing.total += itemTotal;
      existing.qrisTotal += qrisTotal;
      existing.grandtotal += itemGrandTotal;
      existing.shareTenant += shareTenant;
      existing.shareDago += shareDago;

      tenantMapTotals.set(tenantName, existing);
    });
  });

  // ----------------------------------------------------
  // Sheet 3: tenantShares
  // ----------------------------------------------------
  const ws3 = workbook.addWorksheet("tenantShares");

  ws3.columns = [
    { key: "merchant", width: 24 },
    { key: "tax_total", width: 14 },
    { key: "discount_total", width: 16 },
    { key: "subtotal", width: 16 },
    { key: "total", width: 16 },
    { key: "qris_total", width: 14 },
    { key: "grandtotal", width: 16 },
    { key: "share_tenant", width: 16 },
    { key: "share_dago", width: 16 },
  ];

  // Kop Rows 1-3
  ws3.mergeCells("A1:I1");
  const ws3A1 = ws3.getCell("A1");
  ws3A1.value = "";

  ws3.mergeCells("A2:I2");
  const ws3A2 = ws3.getCell("A2");
  ws3A2.value = "Tenant Shares";

  ws3.mergeCells("A3:I3");
  const ws3A3 = ws3.getCell("A3");
  ws3A3.value = periodLabel;

  [1, 2, 3].forEach((rNum) => {
    const row = ws3.getRow(rNum);
    row.height = 26;
    for (let c = 1; c <= 9; c++) {
      const cell = row.getCell(c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_HEADER_ORANGE } };
      cell.font = { name: "Calibri", size: 20, bold: false };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    }
  });

  // Row 4 Headers
  const s3Headers = [
    "merchant",
    "tax total",
    "discount total",
    "subtotal",
    "total",
    "qris total",
    "grandtotal",
    "share tenant",
    "share dago",
  ];
  ws3.addRow(s3Headers);
  const s3HeaderRow = ws3.getRow(4);
  s3HeaderRow.height = 22;
  for (let c = 1; c <= 9; c++) {
    const cell = s3HeaderRow.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_COL_PEACH } };
    cell.font = { name: "Calibri", size: 13, bold: true };
    cell.alignment = { vertical: "middle" };
  }

  // Summary Rows per Merchant
  const summaryRows = Array.from(tenantMapTotals.values()).sort((a, b) =>
    a.merchant.localeCompare(b.merchant)
  );

  let grandTax = 0;
  let grandDiscount = 0;
  let grandSubtotal = 0;
  let grandTotalVal = 0;
  let grandQrisTotal = 0;
  let grandGrandTotal = 0;
  let grandShareTenant = 0;
  let grandShareDago = 0;

  summaryRows.forEach((row) => {
    grandTax += row.taxTotal;
    grandDiscount += row.discountTotal;
    grandSubtotal += row.subtotal;
    grandTotalVal += row.total;
    grandQrisTotal += row.qrisTotal;
    grandGrandTotal += row.grandtotal;
    grandShareTenant += row.shareTenant;
    grandShareDago += row.shareDago;

    ws3.addRow([
      row.merchant,
      row.taxTotal,
      row.discountTotal,
      row.subtotal,
      row.total,
      row.qrisTotal,
      row.grandtotal,
      row.shareTenant,
      row.shareDago,
    ]);
  });

  // Last Row: Grandtotal
  ws3.addRow([
    "Grandtotal",
    grandTax,
    grandDiscount,
    grandSubtotal,
    grandTotalVal,
    grandQrisTotal,
    grandGrandTotal,
    grandShareTenant,
    grandShareDago,
  ]);
  const lastRow = ws3.lastRow;
  if (lastRow) {
    lastRow.font = { name: "Calibri", size: 11, bold: true };
  }

  return workbook;
}

export async function exportTransactionReportExcel(
  params: TransactionExportParams,
  customFilename?: string
): Promise<void> {
  const workbook = await buildTransactionTemplateWorkbook(params);
  const buffer = await workbook.xlsx.writeBuffer();

  const periodSlug = formatPeriodRange(params.orders, params.startDate, params.endDate)
    .replace(/\s+/g, "_")
    .replace(/\//g, "-");
  const filename = customFilename || `laporan-transaksi-${periodSlug}.xlsx`;

  if (typeof window !== "undefined") {
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
