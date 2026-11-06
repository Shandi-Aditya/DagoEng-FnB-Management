export type StockStatus = "CRITICAL" | "LOW" | "SAFE";

export interface IngredientItem {
  id: string;
  name: string;
  category: "Dairy" | "Coffee Beans" | "Syrup & Sweetener" | "Meat & Protein" | "Dry Goods" | "Packaging";
  stockNumber: number;
  unit: string; // e.g. "kg", "liter", "Kotak", "Botol", "Pcs"
  min: number; // Reorder point threshold
  costPerUnit: number; // IDR per unit
  supplier: string;
  status: StockStatus;
  lastUpdated: string;
}

export interface RecipeIngredient {
  ingredientId: string;
  ingredientName: string;
  quantityRequired: number; // e.g. 0.018 for 18g (if unit is kg), or 0.12 for 120ml (if unit is liter)
  unit: string;
  costEstimate: number; // calculated IDR cost per portion
}

export interface RecipeBOM {
  menuId: string;
  menuName: string;
  category: string;
  sellingPrice: number;
  ingredients: RecipeIngredient[];
  totalCOGS: number;
  grossMarginPercent: number; // (sellingPrice - totalCOGS) / sellingPrice * 100
}

export interface PurchaseOrderItem {
  ingredientId: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplier: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: "DRAFT" | "SENT" | "RECEIVED" | "CANCELLED";
  orderDate: string;
  expectedDelivery: string;
  notes?: string;
}

export interface StockAdjustmentLog {
  id: string;
  ingredientId: string;
  ingredientName: string;
  delta: number;
  previousStock: number;
  currentStock: number;
  reason: "PENJUALAN_RESEP" | "PO_MASUK" | "OPNAME_HILANG_RUSAK" | "MANUAL_ADJUSTMENT";
  timestamp: string;
  user: string;
}

export type StockOpnameReason =
  | "WASTE"
  | "LOSS"
  | "DAMAGED"
  | "RECORDING_ERROR"
  | "EXPIRATION"
  | "SAMPLE_PROMO"
  | "OTHER";

export interface StockOpnameRecord {
  id: string;
  opnameNumber: string;
  date: string;
  ingredientId: string;
  ingredientName: string;
  category: string;
  unit: string;
  systemStock: number;
  physicalStock: number;
  variance: number; // physicalStock - systemStock
  varianceValue?: number; // monetary estimation of variance
  varianceType: "SURPLUS" | "DEFICIT" | "MATCH";
  reason: StockOpnameReason;
  reasonNotes?: string;
  performedBy: string;
  tenantId?: string;
  outletId?: string;
  status: "APPLIED";
  createdAt: string;
}

