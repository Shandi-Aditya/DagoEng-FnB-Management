import type { ReportType } from "./reports-domain";

export interface SignatoryEntry {
  roleTitle: string;
  name?: string;
  designation: string;
}

export function formatReportPrintDate(date: Date = new Date()): string {
  const formatted = date.toLocaleString("id-ID", {
    timeZone: "Asia/Makassar",
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `${formatted} WITA`;
}

export function buildReportSignatories(
  generatedBy: string,
  _outletName?: string
): SignatoryEntry[] {
  return [
    {
      roleTitle: "Disiapkan oleh",
      name: generatedBy || "Staf Operasional",
      designation: "Staf / Kasir",
    },
    {
      roleTitle: "Diperiksa oleh",
      designation: "Supervisor / Manager Gerai",
    },
    {
      roleTitle: "Disetujui oleh",
      designation: "Pimpinan / Owner",
    },
  ];
}

export function isNumericOrCurrencyCell(cell: string | number): boolean {
  if (typeof cell === "number") return true;
  if (!cell || typeof cell !== "string") return false;
  const trimmed = cell.trim();
  if (trimmed.startsWith("Rp") || trimmed.endsWith("%")) return true;
  return /^-?\d+(\.\d+)?$/.test(trimmed);
}

export function formatReportHeaderBadge(type: ReportType): string {
  switch (type) {
    case "SALES":
      return "Laporan Penjualan";
    case "CLOSING":
      return "Laporan Closing";
    case "PRODUCTS":
      return "Laporan Produk";
    case "INVENTORY":
      return "Laporan Stok & HPP";
    case "FINANCE_AUDIT":
      return "Laporan Audit Finansial";
    case "SETTLEMENT":
      return "Laporan Settlement";
    case "EVENTS":
      return "Laporan Acara";
    case "RECONCILIATION":
      return "Laporan Rekonsiliasi";
    case "VOID_REFUND_DISCOUNT":
      return "Laporan void & refund";
    default:
      return "Laporan Sistem";
  }
}
