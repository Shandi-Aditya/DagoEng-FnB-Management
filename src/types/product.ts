export interface MasterProduct {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  sku?: string;
  price?: number;
  costPrice?: number;
  trackStock?: boolean;
  cogsEstimate: number;
  grossMarginPercent: string;
  status: "ACTIVE" | "INACTIVE";
  outletId: string; // 'ALL' or specific outlet id like 'outlet-sgr'
  outletName: string;
  isAvailable: boolean; // Computed or manually flagged availability
  variants?: { name: string; priceAdjustment: number }[];
  modifierGroupNames?: string[];
  recipeMenuId?: string; // Links to Inventory Recipe BOM
  description?: string;
  imageUrl?: string;
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
}
