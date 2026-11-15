import type { StockOpnameRecord } from "@/types/inventory";
import type { StatusTone } from "@/components/app/status-badge";

export interface StockOpnamePdfMetrics {
  totalItems: number;
  surplusCount: number;
  deficitCount: number;
  matchCount: number;
  totalVarianceValue: number;
}

export interface StockOpnameSignatory {
  role: string;
  name: string;
  outlet: string;
}

export interface StockOpnameSignatories {
  auditor: StockOpnameSignatory;
  supervisor: StockOpnameSignatory;
  approver: StockOpnameSignatory;
}

/**
 * Menghitung metrik ringkasan eksekutif audit stock opname secara murni tanpa mutasi.
 */
export function computeStockOpnamePdfMetrics(
  opnames: readonly StockOpnameRecord[]
): StockOpnamePdfMetrics {
  let surplusCount = 0;
  let deficitCount = 0;
  let matchCount = 0;
  let totalVarianceValue = 0;

  for (const item of opnames) {
    if (item.varianceType === "SURPLUS") {
      surplusCount++;
    } else if (item.varianceType === "DEFICIT") {
      deficitCount++;
    } else {
      matchCount++;
    }

    if (item.varianceValue) {
      totalVarianceValue += Math.abs(item.varianceValue);
    }
  }

  return {
    totalItems: opnames.length,
    surplusCount,
    deficitCount,
    matchCount,
    totalVarianceValue,
  };
}

/**
 * Menghasilkan nomor dokumen berita acara opname yang deterministik dan dapat diaudit.
 */
export function buildStockOpnameDocNumber(date: Date, totalCount: number): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `BA-OPN-${year}${month}${day}-${totalCount}`;
}

/**
 * Membangun struktur 3 pihak penandatangan otorisasi akuntabilitas audit fisik gerai.
 */
export function buildStockOpnameSignatories(
  performedBy?: string,
  outletName?: string
): StockOpnameSignatories {
  const outlet = outletName || "Singaraja (Pusat)";
  const auditorName = performedBy?.trim() || "Petugas Gudang";

  return {
    auditor: {
      role: "Petugas Opname Fisik",
      name: auditorName,
      outlet,
    },
    supervisor: {
      role: "Supervisor Gudang / Dapur",
      name: `Supervisor Gerai ${outlet}`,
      outlet,
    },
    approver: {
      role: "Pimpinan / Owner Gerai",
      name: `Pimpinan / Owner ${outlet}`,
      outlet,
    },
  };
}

/**
 * Memformat tanggal cetak berita acara resmi sesuai konvensi resmi Indonesia (WITA).
 */
export function formatStockOpnamePrintDate(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Makassar",
  }).format(date);
}

/**
 * Menerjemahkan enum alasan opname ke label bahasa Indonesia baku.
 */
export function formatOpnameReasonLabel(reason: string): string {
  switch (reason) {
    case "RECORDING_ERROR":
      return "Selisih hitung / catat";
    case "WASTE":
      return "Waste operasional";
    case "LOSS":
      return "Kehilangan (loss)";
    case "DAMAGED":
      return "Kerusakan fisik";
    case "EXPIRATION":
      return "Kedaluwarsa";
    case "SAMPLE_PROMO":
      return "Sampel promo";
    case "OTHER":
    default:
      return "Lainnya";
  }
}

/**
 * Memetakan nilai selisih stok ke tone status semantik yang tepat.
 */
export function formatOpnameVarianceTone(variance: number): StatusTone {
  if (variance > 0) return "success";
  if (variance < 0) return "destructive";
  return "neutral";
}
