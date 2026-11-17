import { formatCurrencyIDR } from "@/lib/utils";
import type { ClosingReportData } from "@/features/pos/DailyClosingPDFModal";

export interface ClosingWhatsAppPayload {
  text: string;
  url: string;
}

/**
 * Build formal closing WhatsApp report message and direct WhatsApp URL.
 */
export function buildClosingWhatsAppMessage(
  report: ClosingReportData,
  managerPhone: string
): ClosingWhatsAppPayload {
  const taxSummary = report.isTaxEnabled
    ? `${formatCurrencyIDR(report.totalTax)} (${report.taxRatePercent}%)`
    : "Bebas pajak (0%)";

  const text = `*LAPORAN CLOSING RESMI - DAGOENG F&B*
----------------------------------------
No. dokumen: *${report.reportNumber}*
Outlet: *${report.outletName}*
Waktu: ${report.closingDateTime} (Shift: ${report.shiftName})
Kasir: ${report.cashierName}

*RINGKASAN KEUANGAN:*
• Volume transaksi: ${report.totalTransactionsCount} transaksi
• Omzet kotor: ${formatCurrencyIDR(report.totalGrossSales)}
• Pajak PB1: ${taxSummary}
• *Omzet bersih:* *${formatCurrencyIDR(report.totalNetSales)}*

*METODE PEMBAYARAN:*
• QRIS: ${formatCurrencyIDR(report.qrisSales)}
• Kas tunai: ${formatCurrencyIDR(report.totalCashSales)}
• Kartu EDC: ${formatCurrencyIDR(report.edcSales)}

*BAGI HASIL:*
• Hak tenant (${report.tenantSharePercent}%): *${formatCurrencyIDR(report.tenantTotalShare)}*
• Hak Dago Hub (${report.dagoSharePercent}%): *${formatCurrencyIDR(report.dagoTotalShare)}*

*VALIDASI DIGITAL:*
• Sertifikasi digital: ${formatClosingVerificationShortHash(report.verificationHash)}
• Sah tanpa tanda tangan fisik basah.
----------------------------------------
_DagoEng Creative Hub - Financial Automated System_`;

  const cleanPhone = managerPhone.replace(/\D/g, "");
  const encoded = encodeURIComponent(text);
  const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`;

  return { text, url };
}

/**
 * Format tax status badge or label into sentence case Indonesian.
 */
export function formatClosingTaxStatus(
  isTaxEnabled: boolean,
  taxRatePercent: number
): string {
  if (!isTaxEnabled || taxRatePercent <= 0) {
    return "Nonaktif (0%)";
  }
  const taxName = taxRatePercent >= 11 ? "PPN" : "PB1";
  return `${taxName} ${taxRatePercent}% (aktif)`;
}

/**
 * Format audit verification hash for compact human display.
 */
export function formatClosingVerificationShortHash(hash?: string): string {
  if (!hash) return "-";
  if (hash.length <= 10) return hash;
  return `${hash.slice(0, 10)}...`;
}

/**
 * Build server endpoint URL for PDF rendering and direct download.
 */
export function buildClosingReportPdfUrl(report: ClosingReportData): string {
  const initialCash = report.initialCash ?? 0;
  const cashSales = report.totalCashSales ?? 0;
  const expectedCash = report.expectedCash ?? (initialCash + cashSales);
  const actualCash = report.actualCashEnding ?? 0;
  const variance = report.cashDifference ?? (actualCash - expectedCash);

  const params = new URLSearchParams({
    docNo: report.reportNumber,
    outlet: report.outletName,
    cashier: report.cashierName,
    date: report.closingDateTime,
    transactions: String(report.totalTransactionsCount),
    gross: String(report.totalGrossSales),
    tax: String(report.totalTax),
    service: String(report.totalServiceCharge || 0),
    net: String(report.totalNetSales),
    qris: String(report.qrisSales),
    cash: String(cashSales),
    edc: String(report.edcSales),
    mitra: String(report.tenantTotalShare),
    dago: String(report.dagoTotalShare),
    initialCash: String(initialCash),
    expectedCash: String(expectedCash),
    actualCash: String(actualCash),
    variance: String(variance),
    notes: report.shiftNotes || "",
  });

  return `/api/reports/closing/pdf?${params.toString()}`;
}
