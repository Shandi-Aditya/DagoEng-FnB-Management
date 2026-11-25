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
      name: generatedBy || "Staf operasional",
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
  if (/^[+-]?\s*Rp\b/i.test(trimmed) || trimmed.endsWith("%")) return true;
  return /^-?\d+(\.\d+)?$/.test(trimmed);
}

/**
 * Menghitung alokasi lebar kolom `<colgroup>` dalam persen (total tepat 100%)
 * agar tabel multi-kolom (10-17 kolom) pada modal/PDF tidak saling bertumpuk.
 */
export function computeReportColumnWidths(headers: readonly string[]): number[] {
  if (headers.length === 0) return [];
  const weights = headers.map((header) => {
    const lower = header.toLowerCase();
    if (
      lower.includes("aliran kas") ||
      lower.includes("keterangan") ||
      lower.includes("dampak") ||
      lower.includes("mitra & outlet")
    ) {
      return 1.65;
    }
    if (
      lower.includes("rekening") ||
      lower === "mitra" ||
      lower === "tamu" ||
      lower === "event" ||
      lower === "perubahan"
    ) {
      return 1.35;
    }
    if (lower === "status" || lower === "transaksi" || lower.startsWith("id ")) {
      return 0.85;
    }
    if (lower.includes("(rp)") || lower.includes("(%)")) {
      return 1.05;
    }
    return 1.0;
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const percents = weights.map((w) => Math.max(4, Math.floor((w / totalWeight) * 100)));
  let remainder = 100 - percents.reduce((sum, p) => sum + p, 0);

  // Distribusikan sisa pembulatan mulai dari kolom terlebar
  const sortedIndices = weights
    .map((w, idx) => ({ w, idx }))
    .sort((a, b) => b.w - a.w)
    .map((item) => item.idx);

  let cursor = 0;
  while (remainder > 0) {
    const idx = sortedIndices[cursor % sortedIndices.length];
    percents[idx] += 1;
    remainder -= 1;
    cursor += 1;
  }
  while (remainder < 0) {
    const idx = sortedIndices[cursor % sortedIndices.length];
    if (percents[idx] > 4) {
      percents[idx] -= 1;
      remainder += 1;
    }
    cursor += 1;
  }

  return percents;
}

export function formatReportHeaderBadge(type: ReportType): string {
  switch (type) {
    case "SALES":
      return "Laporan Penjualan";
    case "CLOSING":
      return "Laporan Closing";
    case "PRODUCTS":
      return "Laporan produk";
    case "INVENTORY":
      return "Laporan Stok & HPP";
    case "FINANCE_AUDIT":
      return "Laporan Audit Finansial";
    case "SETTLEMENT":
      return "Laporan Settlement";
    case "SETTLEMENT_CONSOLIDATED":
      return "Laporan konsolidasi mitra";
    case "EVENTS":
      return "Laporan Acara";
    case "RECONCILIATION":
      return "Laporan rekonsiliasi";
    case "VOID_REFUND_DISCOUNT":
      return "Laporan void & refund";
    default:
      return "Laporan sistem";
  }
}
