import {
  PrinterDeviceConfig,
  POSPrintingSettings,
  KitchenTicketData,
  KitchenTicketItem,
  PrintJob,
  PrintPurpose,
  PrintJobStatus,
  DEFAULT_PRINTING_SETTINGS,
  PrinterPaperWidth,
} from "@/types/printer";
import type { OutletReceiptCombineMode } from "@/types/settings";
import { POSReceiptData, type ReceiptLineItem } from "@/features/pos/types";
import { calculateTenantReceiptGroups } from "@/features/pos/pos-receipt";
import {
  resolveCoworkingReceiptPublisher,
  resolvePosReceiptPublisher,
} from "@/lib/receipt-publisher";
import {
  allocateCategoryDiscounts,
  allocateCategoryTaxAndService,
  isCoworkingOrderItem,
} from "@/lib/tax-breakdown";
import { getTenantProfile } from "@/lib/tenant";
import { formatCurrencyIDR } from "@/lib/utils";

export const STORAGE_KEY_PRINT_QUEUE = "dagoeng_print_queue_v1";
export const STORAGE_KEY_PRINTER_DEVICES = "dagoeng_printer_devices_v1";
export const STORAGE_KEY_PRINTER_SETTINGS = "dagoeng_printer_settings_v1";

const MAX_QUEUE_HISTORY = 50;

/**
 * Membangun Idempotency Key untuk mencegah duplikasi print job otomatis.
 * Format: [orderId]_[purpose]_[sequenceNumber]
 */
export function buildIdempotencyKey(
  orderId: string,
  purpose: PrintPurpose,
  sequenceNumber: number = 1
): string {
  return `${orderId}_${purpose}_${sequenceNumber}`;
}

/**
 * Mengecek apakah job dengan idempotency key ini sudah pernah diproses.
 * Catatan penting: Manual REPRINT tidak pernah dianggap duplikat.
 */
export function isJobIdempotentDuplicate(
  queue: PrintJob[],
  key: string,
  purpose: PrintPurpose
): boolean {
  if (purpose === "REPRINT" || purpose === "TEST_PRINT") return false;

  return queue.some(
    (job) =>
      job.idempotencyKey === key &&
      job.status !== "FAILED"
  );
}

/**
 * Memecah tiket pesanan dapur menjadi beberapa tiket per mitra kuliner (Multi-Tenant Isolation).
 * Sesuai kriteria Task V-15:
 * Struk kitchen: no. pesanan, meja/takeaway, nama tamu, menu, varian, jumlah, catatan, jam, TANPA harga, per mitra.
 */
export function splitKitchenTicketByTenant(ticket: KitchenTicketData): KitchenTicketData[] {
  const fnbItems = (ticket.items || []).filter((item) => !isCoworkingOrderItem(item));
  if (fnbItems.length === 0) {
    return [];
  }

  const tenantGroups = new Map<
    string,
    { tenantId?: string; tenantName?: string; items: KitchenTicketItem[] }
  >();

  for (const item of fnbItems) {
    const key = item.tenantId || item.tenantName || "default";
    if (!tenantGroups.has(key)) {
      tenantGroups.set(key, {
        tenantId: item.tenantId,
        tenantName: item.tenantName,
        items: [],
      });
    }
    tenantGroups.get(key)!.items.push(item);
  }

  if (tenantGroups.size <= 1) {
    const firstGroup = tenantGroups.values().next().value;
    return [
      {
        ...ticket,
        items: fnbItems,
        tenantId: ticket.tenantId || firstGroup?.tenantId,
        tenantName: ticket.tenantName || firstGroup?.tenantName,
      },
    ];
  }

  const result: KitchenTicketData[] = [];
  for (const group of tenantGroups.values()) {
    result.push({
      ...ticket,
      tenantId: group.tenantId,
      tenantName: group.tenantName,
      items: group.items,
    });
  }

  return result;
}

/**
 * Generator Nota Pesanan Dapur (Kitchen Order Ticket)
 * PRINSIP MUTLAK:
 * - Tidak boleh menampilkan harga menu
 * - Tidak boleh menampilkan subtotal
 * - Tidak boleh menampilkan pajak / service charge
 * - Tidak boleh menampilkan diskon
 * - Tidak boleh menampilkan total pembayaran
 * - Tidak boleh menampilkan metode pembayaran
 */
export function generateKitchenTicketText(
  ticket: KitchenTicketData,
  options?: {
    paperWidth?: PrinterPaperWidth;
    settings?: POSPrintingSettings;
  }
): string {
  const width = options?.paperWidth === "58mm" ? 32 : 42;
  const line = "-".repeat(width);
  const doubleLine = "=".repeat(width);

  let headerBadge = "NOTA PESANAN DAPUR";
  if (ticket.purpose === "ADDITIONAL_ORDER") {
    headerBadge = `PESANAN TAMBAHAN #${ticket.sequenceNumber || 1}`;
  } else if (ticket.purpose === "REPRINT") {
    headerBadge = "** SALINAN / REPRINT **";
  } else if (ticket.purpose === "CANCELLATION") {
    headerBadge = "!! PEMBATALAN PESANAN !!";
  }

  const lines: string[] = [
    doubleLine,
    centerText("DAGOENG CREATIVE HUB", width),
    centerText(ticket.outletName ? ticket.outletName.toUpperCase() : "OUTLET SINGARAJA", width),
    ...(ticket.tenantName ? [centerText(`[ MITRA: ${ticket.tenantName.toUpperCase()} ]`, width)] : []),
    doubleLine,
    centerText(`[ ${headerBadge} ]`, width),
    doubleLine,
    `No. Pesanan : ${ticket.orderNumber}`,
    ...(ticket.tenantName ? [`Mitra       : ${ticket.tenantName}`] : []),
    `Waktu       : ${ticket.timestamp}`,
    `Meja        : ${ticket.tableNumber || "-"}`,
    `Tipe        : ${ticket.orderType.replace("_", " ")}`,
    `Pelanggan   : ${ticket.customerName}`,
    `Petugas     : ${ticket.cashierName}`,
  ];

  if (ticket.reprintedBy) {
    lines.push(`Dicetak Ulg : ${ticket.reprintedBy} (${ticket.reprintedAt || "Baru saja"})`);
  }

  lines.push(line);
  lines.push("DAFTAR MENU PESANAN:");
  lines.push(line);

  if (!ticket.items || ticket.items.length === 0) {
    lines.push("  (Tidak ada item pesanan)");
  } else {
    ticket.items.forEach((item, idx) => {
      const qtyPrefix = `${item.quantity}x `;
      const name = item.productName.toUpperCase();
      lines.push(`${qtyPrefix}${name}`);

      if (item.variantName) {
        lines.push(`   Varian : ${item.variantName}`);
      }

      if (item.modifiers && item.modifiers.length > 0) {
        lines.push(`   Tambahan: ${item.modifiers.join(", ")}`);
      }

      if (item.notes && item.notes.trim()) {
        lines.push(`   *CATATAN: ${item.notes.trim()}`);
      }

      if (idx < ticket.items.length - 1) {
        lines.push("");
      }
    });
  }

  lines.push(line);

  if (ticket.kitchenNotes) {
    lines.push(`Instruksi : ${ticket.kitchenNotes}`);
    lines.push(line);
  }

  const footer = options?.settings?.kitchenFooterNote || "MOHON DIPROSES";
  lines.push(centerText(footer, width));
  lines.push(doubleLine);

  return lines.join("\n");
}

export type { ReceiptLineItem };

function groupReceiptItemsByTenant(items: readonly ReceiptLineItem[] = []) {
  return calculateTenantReceiptGroups(items, {
    defaultTenantId: "default",
    defaultTenantName: "Mitra F&B",
  });
}

function appendReceiptItemLines(lines: string[], item: ReceiptLineItem, width: number): void {
  const itemSub = formatCurrencyIDR(item.subtotal);
  lines.push(`${item.quantity}x ${item.name}`);
  lines.push(padBetween(`   @ ${formatCurrencyIDR(item.unitPrice)}`, itemSub, width));
  if (item.variantName) {
    lines.push(`   Varian: ${item.variantName}`);
  }
  if (item.modifiers && item.modifiers.length > 0) {
    lines.push(`   Opsi: ${item.modifiers.join(", ")}`);
  }
  if (item.notes) {
    lines.push(`   *Catatan: ${item.notes}`);
  }
}

function extractBranchName(outletName?: string): string | undefined {
  if (!outletName) return undefined;
  const parts = outletName.split(" — ");
  return parts.length > 1 ? parts[parts.length - 1].trim() : outletName;
}

function allocateReceiptPayments(
  parentReceipt: POSReceiptData,
  subReceipts: POSReceiptData[]
): POSReceiptData[] {
  if (subReceipts.length <= 1) return subReceipts;

  const totalItemsSubtotal = subReceipts.reduce((sum, r) => sum + r.subtotal, 0);
  const totalPaid = parentReceipt.amountPaid || 0;
  const totalChange = parentReceipt.changeDue || 0;
  let paidAllocated = 0;
  let changeAllocated = 0;

  return subReceipts.map((sub, idx) => {
    const isLast = idx === subReceipts.length - 1;
    let groupAmountPaid: number;
    let groupChangeDue: number;

    if (totalPaid >= (parentReceipt.grandTotal || 0)) {
      groupAmountPaid = isLast
        ? Math.max(sub.grandTotal, totalPaid - paidAllocated)
        : sub.grandTotal;
      groupChangeDue = isLast ? Math.max(0, totalChange - changeAllocated) : 0;
    } else {
      groupAmountPaid = isLast
        ? Math.max(0, totalPaid - paidAllocated)
        : Math.round((totalPaid * sub.subtotal) / (totalItemsSubtotal || 1));
      groupChangeDue = 0;
    }
    paidAllocated += groupAmountPaid;
    changeAllocated += groupChangeDue;

    return {
      ...sub,
      amountPaid: groupAmountPaid,
      changeDue: groupChangeDue,
    };
  });
}

function assembleSplitSubReceipt(params: {
  baseReceipt: POSReceiptData;
  orderNumber: string;
  isCoworking: boolean;
  items: ReceiptLineItem[];
  subtotal: number;
  discount: number;
  tax: number;
  serviceCharge: number;
  outletFallback: { name?: string; address?: string; phone?: string };
  preferredTenantId?: string;
  preferredTenantName?: string;
}): POSReceiptData {
  const {
    baseReceipt,
    orderNumber,
    isCoworking,
    items,
    subtotal,
    discount,
    tax,
    serviceCharge,
    outletFallback,
    preferredTenantId,
    preferredTenantName,
  } = params;
  const grandTotal = Math.max(0, subtotal - discount) + tax + serviceCharge;

  if (isCoworking) {
    const cwPublisher = resolveCoworkingReceiptPublisher(outletFallback);
    return {
      ...baseReceipt,
      orderNumber,
      tenantId: "DAGO_HUB",
      tenantName: cwPublisher.brandName,
      brandName: cwPublisher.brandName,
      tagline: cwPublisher.tagline,
      receiptHeader: `${cwPublisher.brandName} — ${cwPublisher.tagline}`,
      receiptFooter: baseReceipt.receiptFooter,
      outletName: cwPublisher.outletName,
      outletAddress: cwPublisher.outletAddress,
      outletPhone: cwPublisher.outletPhone,
      items,
      subtotal,
      discount,
      fnbDiscount: 0,
      coworkingDiscount: discount,
      tax,
      fnbTax: 0,
      coworkingTax: tax,
      serviceCharge,
      grandTotal,
    };
  }

  const resolvedTenantId = preferredTenantId === "default" ? undefined : preferredTenantId;
  const publisher = resolvePosReceiptPublisher(
    items.map((item) => ({
      tenantId: item.tenantId || resolvedTenantId,
      tenantName: item.tenantName || preferredTenantName,
    })),
    outletFallback,
    resolvedTenantId
  );
  const profileId = publisher.tenantId || resolvedTenantId;
  const tenantProfile = profileId ? getTenantProfile(profileId) : null;

  return {
    ...baseReceipt,
    orderNumber,
    tenantId: profileId,
    tenantName: publisher.brandName,
    brandName: publisher.brandName,
    tagline: publisher.tagline,
    receiptHeader: tenantProfile?.receiptHeader || publisher.brandName,
    receiptFooter: tenantProfile?.receiptFooter || baseReceipt.receiptFooter,
    outletName: publisher.outletName,
    outletAddress: publisher.outletAddress,
    outletPhone: tenantProfile?.contactPhone || publisher.outletPhone,
    items,
    subtotal,
    discount,
    fnbDiscount: discount,
    coworkingDiscount: 0,
    tax,
    fnbTax: tax,
    coworkingTax: 0,
    serviceCharge,
    grandTotal,
  };
}

function resolveReceiptCategorySplitHints(receipt: POSReceiptData) {
  const discountSplit =
    receipt.fnbDiscount !== undefined || receipt.coworkingDiscount !== undefined
      ? { fnbDiscount: receipt.fnbDiscount, coworkingDiscount: receipt.coworkingDiscount }
      : undefined;
  const taxSplit =
    receipt.fnbTax !== undefined || receipt.coworkingTax !== undefined
      ? { fnbTax: receipt.fnbTax, coworkingTax: receipt.coworkingTax }
      : undefined;
  return { discountSplit, taxSplit };
}

export function splitCustomerReceiptByTenant(receipt: POSReceiptData): POSReceiptData[] {
  if (!receipt.items || receipt.items.length === 0) {
    return [receipt];
  }

  const groups = groupReceiptItemsByTenant(receipt.items);
  if (groups.length <= 1) {
    return [receipt];
  }

  const { discountSplit, taxSplit } = resolveReceiptCategorySplitHints(receipt);
  const categoryGroups = groups.map((g) => ({ isCoworking: g.isCoworking, subtotal: g.subtotal }));
  const discounts = allocateCategoryDiscounts(categoryGroups, receipt.discount || 0, discountSplit);
  const categoryTaxAllocations = allocateCategoryTaxAndService(
    categoryGroups,
    receipt.tax || 0,
    receipt.serviceCharge || 0,
    taxSplit
  );

  const outletFallback = {
    name: extractBranchName(receipt.outletName),
    address: receipt.outletAddress,
    phone: receipt.outletPhone,
  };

  const subReceipts = groups.map((group, idx) =>
    assembleSplitSubReceipt({
      baseReceipt: receipt,
      orderNumber: `${receipt.orderNumber}-${idx + 1}`,
      isCoworking: group.isCoworking || group.tenantId === "DAGO_HUB",
      items: group.items,
      subtotal: group.subtotal,
      discount: Math.min(group.subtotal, discounts[idx] ?? 0),
      tax: categoryTaxAllocations[idx]?.tax ?? 0,
      serviceCharge: categoryTaxAllocations[idx]?.serviceCharge ?? 0,
      outletFallback,
      preferredTenantId: group.tenantId,
      preferredTenantName: group.tenantName,
    })
  );

  return allocateReceiptPayments(receipt, subReceipts);
}

export function splitCustomerReceiptByMode(
  receipt: POSReceiptData,
  options?: {
    receiptCombineMode?: OutletReceiptCombineMode;
    splitCustomerReceiptPerTenant?: boolean;
  }
): POSReceiptData[] {
  if (!receipt.items || receipt.items.length === 0) {
    return [receipt];
  }

  const mode: OutletReceiptCombineMode = options?.receiptCombineMode ?? "COMBINED";
  const splitPerTenant = Boolean(options?.splitCustomerReceiptPerTenant);

  if (mode === "COMBINED") {
    return splitPerTenant ? splitCustomerReceiptByTenant(receipt) : [receipt];
  }

  const cwItems = receipt.items.filter((item) => isCoworkingOrderItem(item));
  const fnbItems = receipt.items.filter((item) => !isCoworkingOrderItem(item));

  if (cwItems.length === 0) {
    return splitPerTenant ? splitCustomerReceiptByTenant(receipt) : [receipt];
  }

  if (fnbItems.length === 0) {
    return [receipt];
  }

  const cwSubtotal = cwItems.reduce((sum, item) => sum + item.subtotal, 0);
  const fnbSubtotal = fnbItems.reduce((sum, item) => sum + item.subtotal, 0);
  const { discountSplit, taxSplit } = resolveReceiptCategorySplitHints(receipt);
  const categoryGroups = [
    { isCoworking: true, subtotal: cwSubtotal },
    { isCoworking: false, subtotal: fnbSubtotal },
  ];
  const [cwDiscountRaw, fnbDiscountRaw] = allocateCategoryDiscounts(
    categoryGroups,
    receipt.discount || 0,
    discountSplit
  );
  const cwDiscount = Math.min(cwSubtotal, cwDiscountRaw);
  const fnbDiscount = Math.min(fnbSubtotal, fnbDiscountRaw);

  const [cwTaxAlloc, fnbTaxAlloc] = allocateCategoryTaxAndService(
    categoryGroups,
    receipt.tax || 0,
    receipt.serviceCharge || 0,
    taxSplit
  );

  const outletFallback = {
    name: extractBranchName(receipt.outletName),
    address: receipt.outletAddress,
    phone: receipt.outletPhone,
  };

  const cwReceipt = assembleSplitSubReceipt({
    baseReceipt: receipt,
    orderNumber: `${receipt.orderNumber}-CW`,
    isCoworking: true,
    items: cwItems,
    subtotal: cwSubtotal,
    discount: cwDiscount,
    tax: cwTaxAlloc.tax,
    serviceCharge: cwTaxAlloc.serviceCharge,
    outletFallback,
  });

  const fnbReceiptBase = assembleSplitSubReceipt({
    baseReceipt: receipt,
    orderNumber: `${receipt.orderNumber}-FNB`,
    isCoworking: false,
    items: fnbItems,
    subtotal: fnbSubtotal,
    discount: fnbDiscount,
    tax: fnbTaxAlloc.tax,
    serviceCharge: fnbTaxAlloc.serviceCharge,
    outletFallback,
  });

  const fnbReceipts = splitPerTenant
    ? splitCustomerReceiptByTenant(fnbReceiptBase)
    : [fnbReceiptBase];

  return allocateReceiptPayments(receipt, [cwReceipt, ...fnbReceipts]);
}

/**
 * Generator Struk Pelanggan (Customer Receipt)
 * Memuat informasi finansial lengkap.
 */
export function generateCustomerReceiptText(
  receipt: POSReceiptData,
  options?: { paperWidth?: PrinterPaperWidth }
): string {
  const width = options?.paperWidth === "58mm" ? 32 : 42;
  const line = "-".repeat(width);
  const doubleLine = "=".repeat(width);

  const lines: string[] = [
    doubleLine,
    centerText(receipt.outletName || "DAGO CREATIVE HUB", width),
    centerText("STRUK PEMBAYARAN KASIR", width),
    doubleLine,
    `No. Transaksi : ${receipt.orderNumber}`,
    `Tanggal       : ${receipt.date}`,
    `Kasir         : ${receipt.cashierName}`,
    `Tipe / Meja   : ${receipt.orderType} (Meja ${receipt.tableNumber || "-"})`,
    `Pelanggan     : ${receipt.customerName || "Tamu"}`,
    line,
  ];

  const tenantGroups = groupReceiptItemsByTenant(receipt.items || []);
  if (tenantGroups.length > 1) {
    tenantGroups.forEach((group, groupIdx) => {
      if (groupIdx > 0) {
        lines.push("");
      }
      lines.push(centerText(`--- ${group.tenantName} ---`, width));
      group.items.forEach((item) => appendReceiptItemLines(lines, item, width));
      lines.push(padBetween(`Subtotal (${group.tenantName})`, formatCurrencyIDR(group.subtotal), width));
    });
  } else {
    (receipt.items || []).forEach((item) => appendReceiptItemLines(lines, item, width));
  }

  lines.push(line);
  lines.push(padBetween("Subtotal", formatCurrencyIDR(receipt.subtotal), width));

  if (receipt.discount > 0) {
    lines.push(padBetween(`Diskon (${receipt.promoName || "Promo"})`, `-${formatCurrencyIDR(receipt.discount)}`, width));
  }

  lines.push(padBetween("Pajak PB1", formatCurrencyIDR(receipt.tax), width));

  if (receipt.serviceCharge > 0) {
    lines.push(padBetween("Service Charge", formatCurrencyIDR(receipt.serviceCharge), width));
  }

  lines.push(doubleLine);
  lines.push(padBetween("TOTAL TAGIHAN", formatCurrencyIDR(receipt.grandTotal), width));
  lines.push(padBetween(`Metode: ${receipt.paymentMethod}`, formatCurrencyIDR(receipt.amountPaid), width));
  lines.push(padBetween("Kembalian", formatCurrencyIDR(receipt.changeDue), width));
  lines.push(doubleLine);
  lines.push(centerText(receipt.receiptFooter || "Terima Kasih Atas Kunjungan Anda!", width));
  lines.push(doubleLine);

  return lines.join("\n");
}

/**
 * Helper untuk meratakan teks tengah
 */
function centerText(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  const left = Math.floor((width - text.length) / 2);
  const right = width - text.length - left;
  return " ".repeat(left) + text + " ".repeat(right);
}

/**
 * Helper untuk perataan kiri-kanan
 */
function padBetween(left: string, right: string, width: number): string {
  const total = left.length + right.length;
  if (total >= width) {
    return `${left} ${right}`;
  }
  return left + " ".repeat(width - total) + right;
}

/**
 * Ambil Antrean Cetak dari LocalStorage
 */
export function getStoredPrintQueue(): PrintJob[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRINT_QUEUE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Gagal membaca antrean cetak dari localStorage", err);
    return [];
  }
}

/**
 * Trim antrean cetak dengan proteksi:
 * Job berstatus QUEUED, PRINTING, FAILED, atau OFFLINE TIDAK BOLEH terhapus hanya karena limit riwayat.
 * Hanya riwayat job terminal (BRIDGE_ACKNOWLEDGED / SENT_TO_SPOOLER) yang dibatasi maksimal 50 item.
 */
export function trimQueuePreservingActionableJobs(
  queue: PrintJob[],
  maxTerminal: number = MAX_QUEUE_HISTORY
): PrintJob[] {
  const actionable = queue.filter(
    (j) =>
      j.status === "QUEUED" ||
      j.status === "PRINTING" ||
      j.status === "FAILED" ||
      j.status === "OFFLINE"
  );
  const terminal = queue.filter(
    (j) => j.status === "BRIDGE_ACKNOWLEDGED" || j.status === "SENT_TO_SPOOLER"
  );
  const trimmedTerminal = terminal.slice(0, maxTerminal);

  return queue.filter((j) => actionable.includes(j) || trimmedTerminal.includes(j));
}

/**
 * Simpan Antrean Cetak ke LocalStorage dengan Batas Kapasitas Riwayat Terminal (Maks 50 Job)
 * Menjamin job yang belum selesai atau membutuhkan tindakan kasir tidak hilang.
 */
export function saveStoredPrintQueue(queue: PrintJob[]): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = trimQueuePreservingActionableJobs(queue, MAX_QUEUE_HISTORY);
    localStorage.setItem(STORAGE_KEY_PRINT_QUEUE, JSON.stringify(trimmed));
  } catch (err) {
    console.error("Gagal menyimpan antrean cetak ke localStorage", err);
  }
}

/**
 * Pemulihan Job Menggantung (Stale Recovery):
 * Setiap job yang tertinggal dalam status 'PRINTING' saat browser ditutup / di-reload
 * dialihkan menjadi 'FAILED' dengan informasi kesalahan transparan.
 */
export function recoverStalePrintingJobs(queue: PrintJob[]): {
  recoveredQueue: PrintJob[];
  hasChanges: boolean;
} {
  let hasChanges = false;
  const recoveredQueue = queue.map((job) => {
    if (job.status === "PRINTING") {
      hasChanges = true;
      return {
        ...job,
        status: "FAILED" as PrintJobStatus,
        errorInfo: "Browser ditutup atau reload saat proses cetak berjalan. Silakan klik 'Coba Lagi'.",
      };
    }
    return job;
  });

  return { recoveredQueue, hasChanges };
}

/**
 * Dispatcher Pengiriman Cetak Bertingkat:
 * - Tier 1: Local Print Bridge (menguji koneksi nyata ke bridge lokal endpoint HTTP)
 * - Tier 2: Network LAN via Bridge (meneruskan relai IP port 9100 melalui local agent)
 * - Tier 3: Browser / System Print Spooler (fallback universal)
 */
export async function dispatchPrintJob(
  job: PrintJob,
  device: PrinterDeviceConfig,
  options?: { isSilent?: boolean }
): Promise<{ status: PrintJobStatus; errorInfo?: string }> {
  // Jika perangkat nonaktif
  if (!device.isActive) {
    return {
      status: "FAILED",
      errorInfo: `Printer '${device.name}' sedang dalam status NON-AKTIF di pengaturan Admin.`,
    };
  }

  // 1. Jalur Local Print Bridge
  if (device.connectionType === "LOCAL_BRIDGE") {
    const endpoint = device.bridgeEndpoint || "http://localhost:8080/print";
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          orderNumber: job.orderNumber,
          purpose: job.purpose,
          receiptType: job.receiptType,
          paperWidth: device.paperWidth,
          printerName: device.name,
          content: job.payloadText,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        return {
          status: "BRIDGE_ACKNOWLEDGED",
        };
      } else {
        return {
          status: "FAILED",
          errorInfo: `Print Bridge merespons HTTP ${res.status}: ${res.statusText}`,
        };
      }
    } catch (err: any) {
      const isTimeout = err?.name === "AbortError";
      return {
        status: "OFFLINE",
        errorInfo: isTimeout
          ? `Koneksi ke Print Bridge timeout (${endpoint}). Pastikan agen lokal aktif.`
          : `Gagal menghubungi Print Bridge di ${endpoint}. Periksa kabel/driver printer lokal.`,
      };
    }
  }

  // 2. Jalur Network LAN via Local Bridge Relay
  if (device.connectionType === "NETWORK_LAN_VIA_BRIDGE") {
    if (!device.lanIpAddress) {
      return {
        status: "FAILED",
        errorInfo: "Alamat IP Printer LAN belum dikonfigurasi di pengaturan Admin.",
      };
    }

    const bridgeUrl = device.bridgeEndpoint || "http://localhost:8080/lan-print";
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(bridgeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetIp: device.lanIpAddress,
          targetPort: device.lanPort || 9100,
          paperWidth: device.paperWidth,
          content: job.payloadText,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        return { status: "BRIDGE_ACKNOWLEDGED" };
      } else {
        return {
          status: "FAILED",
          errorInfo: `Relai LAN merespons error HTTP ${res.status}`,
        };
      }
    } catch (err: any) {
      return {
        status: "OFFLINE",
        errorInfo: `Tidak dapat menjangkau printer LAN (${device.lanIpAddress}:${device.lanPort || 9100}) via relai bridge lokal.`,
      };
    }
  }

  // 3. Jalur QZ Tray Print Agent (Silent WebSocket / HTTP REST Agent)
  if (device.connectionType === "QZ_TRAY") {
    const endpoint = device.bridgeEndpoint || "http://localhost:8182/qz/print";
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printer: device.name,
          flavor: "plain",
          data: [job.payloadText],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        return { status: "BRIDGE_ACKNOWLEDGED" };
      } else {
        return {
          status: "FAILED",
          errorInfo: `QZ Tray merespons HTTP ${res.status}: ${res.statusText}`,
        };
      }
    } catch (err: any) {
      const isTimeout = err?.name === "AbortError";
      return {
        status: "OFFLINE",
        errorInfo: isTimeout
          ? `Koneksi ke QZ Tray timeout (${endpoint}). Pastikan agen QZ Tray aktif di perangkat dapur.`
          : `Gagal menghubungi agen QZ Tray di ${endpoint}. Periksa status QZ Tray.`,
      };
    }
  }

  // 4. Jalur PrintNode Cloud / Local Print Agent
  if (device.connectionType === "PRINTNODE") {
    const endpoint = device.bridgeEndpoint || "http://localhost:8080/printnode";
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printerId: device.id,
          printerName: device.name,
          title: `${job.receiptType} - ${job.orderNumber || "Kitchen Ticket"}`,
          contentType: "raw_uri",
          content: job.payloadText,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        return { status: "BRIDGE_ACKNOWLEDGED" };
      } else {
        return {
          status: "FAILED",
          errorInfo: `PrintNode merespons HTTP ${res.status}: ${res.statusText}`,
        };
      }
    } catch (err: any) {
      const isTimeout = err?.name === "AbortError";
      return {
        status: "OFFLINE",
        errorInfo: isTimeout
          ? `Koneksi ke PrintNode agent timeout (${endpoint}).`
          : `Gagal menghubungi PrintNode agent di ${endpoint}.`,
      };
    }
  }

  // 5. Jalur Browser / System Print Spooler (Universal Fallback)
  // Menyiapkan isolated invisible iframe untuk mencetak payload thermal tanpa mengganggu UI kasir
  return new Promise<{ status: PrintJobStatus; errorInfo?: string }>((resolve) => {
    try {
      if (typeof window === "undefined") {
        resolve({ status: "SENT_TO_SPOOLER" });
        return;
      }

      // Buat elemen iframe tersembunyi
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.style.visibility = "hidden";

      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        document.body.removeChild(iframe);
        resolve({
          status: "FAILED",
          errorInfo: "Gagal menginisialisasi dokumen cetak browser.",
        });
        return;
      }

      const paperMm = device.paperWidth === "58mm" ? "58mm" : "80mm";
      const fontSize = device.paperWidth === "58mm" ? "10px" : "12px";

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${job.receiptType} - ${job.orderNumber || "Print Job"}</title>
          <style>
            @page {
              size: ${paperMm} auto;
              margin: 0;
            }
            body {
              font-family: 'Courier New', Courier, monospace, monospace;
              font-size: ${fontSize};
              line-height: 1.25;
              white-space: pre-wrap;
              word-wrap: break-word;
              padding: 6px;
              color: #000;
              background: #fff;
              margin: 0;
            }
          </style>
        </head>
        <body>${job.payloadText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          // Catat sebagai SENT_TO_SPOOLER (jujur, tidak mengklaim fisik sudah keluar)
          resolve({ status: "SENT_TO_SPOOLER" });
        } catch (printErr: any) {
          resolve({
            status: "FAILED",
            errorInfo: printErr?.message || "Dialog cetak dibatalkan atau diblokir browser.",
          });
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 1500);
        }
      }, 250);
    } catch (fatalErr: any) {
      resolve({
        status: "FAILED",
        errorInfo: fatalErr?.message || "Kesalahan fatal saat memproses spooler cetak browser.",
      });
    }
  });
}

