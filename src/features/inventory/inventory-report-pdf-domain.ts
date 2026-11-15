import type { IngredientItem } from "@/types/inventory";

export interface InventoryReportPdfMetrics {
  totalValuation: number;
  safeCount: number;
  lowCount: number;
  criticalCount: number;
}

export interface InventoryReportSignatory {
  role: string;
  name: string;
  outlet: string;
}

export interface InventoryReportSignatories {
  preparer: InventoryReportSignatory;
  reviewer: InventoryReportSignatory;
  approver: InventoryReportSignatory;
}

/**
 * Menghitung metrik ringkasan eksekutif valuasi inventori secara murni tanpa mutasi.
 */
export function computeInventoryReportPdfMetrics(
  ingredients: readonly IngredientItem[]
): InventoryReportPdfMetrics {
  let totalValuation = 0;
  let safeCount = 0;
  let lowCount = 0;
  let criticalCount = 0;

  for (const item of ingredients) {
    totalValuation += (item.stockNumber || 0) * (item.costPerUnit || 0);

    const isCritical =
      item.status === "CRITICAL" || (item.stockNumber || 0) <= (item.min || 0) * 0.4;
    const isLow =
      item.status === "LOW" && (item.stockNumber || 0) > 0 && !isCritical;

    if (isCritical) {
      criticalCount++;
    } else if (isLow) {
      lowCount++;
    } else {
      safeCount++;
    }
  }

  return {
    totalValuation,
    safeCount,
    lowCount,
    criticalCount,
  };
}

/**
 * Menghasilkan nomor dokumen laporan valuasi inventori yang deterministik dan dapat diaudit.
 */
export function buildInventoryReportDocNumber(date: Date, totalCount: number): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `REP-INV-${year}${month}${day}-${totalCount}`;
}

/**
 * Membangun struktur 3 pihak penandatangan otorisasi akuntabilitas operasional gerai.
 */
export function buildInventoryReportSignatories(
  generatedBy?: string,
  outletName?: string
): InventoryReportSignatories {
  const outlet = outletName || "Singaraja (Pusat)";
  const preparerName = generatedBy?.trim() || "Staf Gudang / Barista";

  return {
    preparer: {
      role: "Staf Gudang / Barista",
      name: preparerName,
      outlet,
    },
    reviewer: {
      role: "Supervisor Gerai",
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
 * Memformat tanggal cetak dokumen sesuai konvensi resmi Indonesia (WITA).
 */
export function formatInventoryReportDate(date: Date): string {
  const d = new Date(date);

  const formattedDate = d.toLocaleDateString("id-ID", {
    timeZone: "Asia/Makassar",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const formattedTime = d.toLocaleTimeString("id-ID", {
    timeZone: "Asia/Makassar",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${formattedDate}, ${formattedTime} WITA`;
}
