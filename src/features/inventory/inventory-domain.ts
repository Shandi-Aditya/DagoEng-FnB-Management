import type { StatusTone } from "@/components/app/status-badge";
import type {
  IngredientItem,
  PurchaseOrder,
  StockOpnameReason,
  StockOpnameRecord,
} from "@/types/inventory";

export interface InventoryKPIs {
  totalStockValue: number;
  safeCount: number;
  lowCount: number;
  criticalCount: number;
  outOfStockCount: number;
  criticalItems: IngredientItem[];
}

export interface OpnameSummary {
  totalSessions: number;
  totalVarianceUnits: number;
  totalVarianceValue: number;
}

export function calculateInventoryKPIs(ingredients: IngredientItem[]): InventoryKPIs {
  let totalStockValue = 0;
  let safeCount = 0;
  let lowCount = 0;
  let criticalCount = 0;
  let outOfStockCount = 0;
  const criticalItems: IngredientItem[] = [];

  for (const item of ingredients) {
    totalStockValue += item.stockNumber * item.costPerUnit;

    const isOutOfStock = item.stockNumber <= 0;
    const isCritical = item.status === "CRITICAL" || item.stockNumber <= item.min * 0.4;
    const isLow = item.status === "LOW" && item.stockNumber > 0 && !isCritical;

    if (isOutOfStock) {
      outOfStockCount += 1;
    }
    if (isCritical) {
      criticalCount += 1;
      criticalItems.push(item);
    } else if (isLow) {
      lowCount += 1;
    } else {
      safeCount += 1;
    }
  }

  return {
    totalStockValue,
    safeCount,
    lowCount,
    criticalCount,
    outOfStockCount,
    criticalItems,
  };
}

export function calculateOpnameSummary(
  opnames: StockOpnameRecord[],
  ingredients: IngredientItem[]
): OpnameSummary {
  const costMap = new Map<string, number>();
  for (const ing of ingredients) {
    costMap.set(ing.id, ing.costPerUnit);
  }

  let totalVarianceUnits = 0;
  let totalVarianceValue = 0;

  for (const opn of opnames) {
    totalVarianceUnits += opn.variance;
    const cost = costMap.get(opn.ingredientId) || 0;
    totalVarianceValue += opn.variance * cost;
  }

  return {
    totalSessions: opnames.length,
    totalVarianceUnits,
    totalVarianceValue,
  };
}

export function filterStockIngredients(
  ingredients: IngredientItem[],
  statusFilter: string,
  categoryFilter: string,
  searchQuery: string
): IngredientItem[] {
  const query = searchQuery.toLowerCase().trim();

  return ingredients.filter((item) => {
    const isOutOfStock = item.stockNumber <= 0;
    const isCritical = !isOutOfStock && (item.status === "CRITICAL" || item.stockNumber <= item.min * 0.4);
    const isLow = !isOutOfStock && !isCritical && item.status === "LOW";
    const matchStatus =
      statusFilter === "ALL" ||
      (statusFilter === "OUT_OF_STOCK" && isOutOfStock) ||
      (statusFilter === "CRITICAL" && (isCritical || isOutOfStock)) ||
      (statusFilter === "LOW" && isLow) ||
      (statusFilter === "SAFE" && item.status === "SAFE" && !isOutOfStock) ||
      item.status === statusFilter;

    const matchCategory = categoryFilter === "ALL" || item.category === categoryFilter;

    if (!matchStatus || !matchCategory) return false;
    if (!query) return true;

    return (
      item.name.toLowerCase().includes(query) ||
      item.supplier.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
    );
  });
}

export function filterStockOpnames(
  opnames: StockOpnameRecord[],
  reasonFilter: string,
  searchQuery: string
): StockOpnameRecord[] {
  const query = searchQuery.toLowerCase().trim();

  return opnames.filter((o) => {
    const matchReason = reasonFilter === "ALL" || o.reason === reasonFilter;
    if (!matchReason) return false;
    if (!query) return true;

    return (
      o.ingredientName.toLowerCase().includes(query) ||
      o.opnameNumber.toLowerCase().includes(query) ||
      (o.performedBy || "").toLowerCase().includes(query)
    );
  });
}

export function stockStatusTone(status: IngredientItem["status"]): StatusTone {
  switch (status) {
    case "SAFE":
      return "success";
    case "LOW":
      return "warning";
    case "CRITICAL":
      return "destructive";
    default:
      return "neutral";
  }
}

export function stockStatusLabel(status: IngredientItem["status"]): string {
  switch (status) {
    case "SAFE":
      return "Aman";
    case "LOW":
      return "Menipis";
    case "CRITICAL":
      return "Kritis";
    default:
      return status;
  }
}

export function poStatusTone(status: PurchaseOrder["status"]): StatusTone {
  switch (status) {
    case "RECEIVED":
      return "success";
    case "SENT":
      return "warning";
    case "CANCELLED":
      return "destructive";
    case "DRAFT":
    default:
      return "neutral";
  }
}

export function poStatusLabel(status: PurchaseOrder["status"]): string {
  switch (status) {
    case "DRAFT":
      return "Draf";
    case "SENT":
      return "Terkirim";
    case "RECEIVED":
      return "Diterima";
    case "CANCELLED":
      return "Dibatalkan";
    default:
      return status;
  }
}

const OPNAME_REASON_LABEL: Record<StockOpnameReason, string> = {
  RECORDING_ERROR: "Salah catat",
  WASTE: "Limbah",
  LOSS: "Hilang",
  DAMAGED: "Rusak",
  EXPIRATION: "Kedaluwarsa",
  SAMPLE_PROMO: "Sampel promo",
  OTHER: "Lainnya",
};

/** Opname variance reasons in display order; the single source for filters and forms. */
export const OPNAME_REASONS = Object.keys(OPNAME_REASON_LABEL) as StockOpnameReason[];

export function opnameReasonLabel(reason: StockOpnameReason): string {
  return OPNAME_REASON_LABEL[reason] ?? OPNAME_REASON_LABEL.OTHER;
}

export function buildStockExportData(
  ingredients: IngredientItem[]
): { headers: string[]; rows: (string | number)[][] } {
  const headers = [
    "ID Bahan",
    "Nama Bahan Baku",
    "Kategori",
    "Sisa Stok",
    "Satuan",
    "Stok Minimum",
    "Harga Satuan (Rp)",
    "Nilai Total Aset (Rp)",
    "Status Stok",
    "Supplier Utama",
    "Terakhir Diperbarui",
  ];

  const rows = ingredients.map((item) => [
    item.id,
    item.name,
    item.category,
    item.stockNumber,
    item.unit,
    item.min,
    item.costPerUnit,
    item.stockNumber * item.costPerUnit,
    item.status,
    item.supplier,
    item.lastUpdated,
  ]);

  return { headers, rows };
}

export function buildOpnameExportData(
  opnames: StockOpnameRecord[]
): { headers: string[]; rows: (string | number)[][] } {
  const headers = [
    "No. Opname",
    "Tanggal Audit",
    "Bahan Baku",
    "Kategori",
    "Satuan",
    "Stok Sistem",
    "Stok Fisik",
    "Selisih (Variance)",
    "Status Selisih",
    "Alasan Selisih",
    "Catatan",
    "Auditor / Pelaksana",
  ];

  const rows = opnames.map((o) => [
    o.opnameNumber,
    o.date,
    o.ingredientName,
    o.category,
    o.unit,
    o.systemStock,
    o.physicalStock,
    o.variance,
    o.varianceType,
    o.reason,
    o.reasonNotes || "-",
    o.performedBy,
  ]);

  return { headers, rows };
}
