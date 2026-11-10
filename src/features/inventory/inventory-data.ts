import { IngredientItem, RecipeBOM, PurchaseOrder, StockAdjustmentLog, StockStatus } from "@/types/inventory";

export const INITIAL_INGREDIENTS: IngredientItem[] = [
  {
    id: "ing-1",
    name: "Susu Fresh Milk Greenfield (1L)",
    category: "Dairy",
    stockNumber: 20.0,
    unit: "Liter",
    min: 15,
    costPerUnit: 22000,
    supplier: "Bali Dairy Fresh",
    status: "SAFE",
    lastUpdated: "Stok Awal",
  },
  {
    id: "ing-2",
    name: "Biji Kopi House Blend Arabica-Robusta (1kg)",
    category: "Coffee Beans",
    stockNumber: 10.0,
    unit: "kg",
    min: 6,
    costPerUnit: 140000,
    supplier: "Kintamani Coffee Roaster",
    status: "SAFE",
    lastUpdated: "Stok Awal",
  },
  {
    id: "ing-3",
    name: "Gula Aren Organik Cair (1L)",
    category: "Syrup & Sweetener",
    stockNumber: 10.0,
    unit: "Liter",
    min: 4,
    costPerUnit: 18000,
    supplier: "Petani Aren Bali",
    status: "SAFE",
    lastUpdated: "Stok Awal",
  },
  {
    id: "ing-4",
    name: "Sirup Peach Artisan (750ml)",
    category: "Syrup & Sweetener",
    stockNumber: 8.0,
    unit: "Botol",
    min: 2,
    costPerUnit: 85000,
    supplier: "PT Beverage Nusantara",
    status: "SAFE",
    lastUpdated: "Stok Awal",
  },
  {
    id: "ing-5",
    name: "Daging Sapi Wagyu Slice (1kg)",
    category: "Meat & Protein",
    stockNumber: 15.0,
    unit: "kg",
    min: 4,
    costPerUnit: 210000,
    supplier: "Bali Meat Prime",
    status: "SAFE",
    lastUpdated: "Stok Awal",
  },
  {
    id: "ing-6",
    name: "Beras Jepang Koshihikari (5kg)",
    category: "Dry Goods",
    stockNumber: 10.0,
    unit: "Karung (5kg)",
    min: 2,
    costPerUnit: 125000,
    supplier: "Toko Sembako Berkah",
    status: "SAFE",
    lastUpdated: "Stok Awal",
  },
  {
    id: "ing-7",
    name: "Dough French Butter Croissant (Isi 10)",
    category: "Dry Goods",
    stockNumber: 10.0,
    unit: "Pack (10 pcs)",
    min: 3,
    costPerUnit: 75000,
    supplier: "PT Pastry Prima",
    status: "SAFE",
    lastUpdated: "Stok Awal",
  },
  {
    id: "ing-8",
    name: "Cup Biodegradable & Straw Senja",
    category: "Packaging",
    stockNumber: 300,
    unit: "Pcs",
    min: 100,
    costPerUnit: 1200,
    supplier: "EcoPack Solution Bali",
    status: "SAFE",
    lastUpdated: "Stok Awal",
  },
  {
    id: "ing-9",
    name: "Susu Oat Milk Barista Edition (1L)",
    category: "Dairy",
    stockNumber: 15.0,
    unit: "Liter",
    min: 5,
    costPerUnit: 35000,
    supplier: "Oatside Official Distributor",
    status: "SAFE",
    lastUpdated: "Stok Awal",
  },
];

export const INITIAL_RECIPES: RecipeBOM[] = [
  {
    menuId: "m-1",
    menuName: "Kopi Senja Aren",
    category: "Signature Coffee",
    sellingPrice: 24000,
    ingredients: [
      { ingredientId: "ing-2", ingredientName: "Biji Kopi House Blend", quantityRequired: 0.018, unit: "kg (18g)", costEstimate: 2520 },
      { ingredientId: "ing-1", ingredientName: "Susu Fresh Milk Greenfield", quantityRequired: 0.12, unit: "Liter (120ml)", costEstimate: 2640 },
      { ingredientId: "ing-3", ingredientName: "Gula Aren Organik Cair", quantityRequired: 0.02, unit: "Liter (20ml)", costEstimate: 360 },
      { ingredientId: "ing-8", ingredientName: "Cup Biodegradable & Straw", quantityRequired: 1, unit: "Pcs", costEstimate: 1200 },
    ],
    totalCOGS: 6720,
    grossMarginPercent: 72.0,
  },
  {
    menuId: "m-6",
    menuName: "Classic Americano",
    category: "Signature Coffee",
    sellingPrice: 22000,
    ingredients: [
      { ingredientId: "ing-2", ingredientName: "Biji Kopi House Blend", quantityRequired: 0.018, unit: "kg (18g)", costEstimate: 2520 },
      { ingredientId: "ing-8", ingredientName: "Cup Biodegradable & Straw", quantityRequired: 1, unit: "Pcs", costEstimate: 1200 },
    ],
    totalCOGS: 3720,
    grossMarginPercent: 83.1,
  },
  {
    menuId: "m-2",
    menuName: "Artisan Peach White Tea",
    category: "Artisan Tea & Refreshers",
    sellingPrice: 28000,
    ingredients: [
      { ingredientId: "ing-4", ingredientName: "Sirup Peach Artisan", quantityRequired: 0.04, unit: "Botol (30ml)", costEstimate: 3400 },
      { ingredientId: "ing-8", ingredientName: "Cup Biodegradable & Straw", quantityRequired: 1, unit: "Pcs", costEstimate: 1200 },
    ],
    totalCOGS: 4600,
    grossMarginPercent: 83.6,
  },
  {
    menuId: "m-3",
    menuName: "Signature Wagyu Beef Bowl",
    category: "Main Course",
    sellingPrice: 65000,
    ingredients: [
      { ingredientId: "ing-5", ingredientName: "Daging Sapi Wagyu Slice", quantityRequired: 0.12, unit: "kg (120g)", costEstimate: 25200 },
      { ingredientId: "ing-6", ingredientName: "Beras Jepang Koshihikari", quantityRequired: 0.03, unit: "Karung (150g)", costEstimate: 3750 },
    ],
    totalCOGS: 28950,
    grossMarginPercent: 55.5,
  },
  {
    menuId: "m-5",
    menuName: "Flaky French Butter Croissant",
    category: "Pastry & Snacks",
    sellingPrice: 20000,
    ingredients: [
      { ingredientId: "ing-7", ingredientName: "Dough French Butter Croissant", quantityRequired: 0.1, unit: "Pack (1 pcs)", costEstimate: 7500 },
    ],
    totalCOGS: 7500,
    grossMarginPercent: 62.5,
  },
];

export const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [];

export interface OrderItemBOMInput {
  productId?: string;
  productName: string;
  quantity: number;
  modifiers?: string[];
}

/**
 * Deducts ingredient stock when a menu item is ordered based on its Recipe BOM formula (POS-36 / B4).
 * Supports modifier substitutions such as Oat Milk replacing fresh milk (TC-G02) and extra shots.
 */
export function deductRecipeIngredients(
  currentStock: IngredientItem[],
  recipe: RecipeBOM,
  quantity: number = 1,
  modifiers?: string[]
): { updatedStock: IngredientItem[]; logs: StockAdjustmentLog[] } {
  const logs: StockAdjustmentLog[] = [];
  const normalizedMods = (modifiers || []).map((m) => m.toLowerCase());
  const isOatMilk = normalizedMods.some((m) => m.includes("oat"));
  const hasExtraShot = normalizedMods.some((m) => m.includes("extra") && m.includes("shot"));

  // Build effective ingredient requirements for this item
  // If Oat Milk modifier is selected (TC-G02), substitute Susu Fresh Milk (ing-1) with Susu Oat Milk (ing-9)
  const effectiveIngredients = recipe.ingredients.map((ing) => {
    if (isOatMilk && (ing.ingredientId === "ing-1" || ing.ingredientName.toLowerCase().includes("fresh milk"))) {
      return {
        ...ing,
        ingredientId: "ing-9",
        ingredientName: "Susu Oat Milk Barista Edition (1L)",
      };
    }
    return { ...ing };
  });

  // If Extra Espresso Shot is added, add 0.018 kg of House Blend (ing-2)
  if (hasExtraShot) {
    const coffeeIndex = effectiveIngredients.findIndex((ing) => ing.ingredientId === "ing-2");
    if (coffeeIndex > -1) {
      effectiveIngredients[coffeeIndex] = {
        ...effectiveIngredients[coffeeIndex],
        quantityRequired: effectiveIngredients[coffeeIndex].quantityRequired + 0.018,
      };
    }
  }

  const updatedStock = currentStock.map((item) => {
    const matchedIng = effectiveIngredients.find((ing) => ing.ingredientId === item.id);
    if (!matchedIng) return item;

    const totalReduction = Number((matchedIng.quantityRequired * quantity).toFixed(3));
    const nextStock = Math.max(0, Number((item.stockNumber - totalReduction).toFixed(3)));
    const nextStatus: StockStatus =
      nextStock <= item.min * 0.4 ? "CRITICAL" : nextStock <= item.min ? "LOW" : "SAFE";

    logs.push({
      id: `log-${Date.now()}-${item.id}-${Math.random().toString(36).slice(2, 6)}`,
      ingredientId: item.id,
      ingredientName: item.name,
      delta: -totalReduction,
      previousStock: item.stockNumber,
      currentStock: nextStock,
      reason: "PENJUALAN_RESEP",
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      user: "POS / Order System",
    });

    return {
      ...item,
      stockNumber: nextStock,
      status: nextStatus,
      lastUpdated: "Baru saja",
    };
  });

  return { updatedStock, logs };
}

/**
 * Atomically deducts inventory stock for an entire list of order items in a single pass (POS-36 / B4).
 * Eliminates race conditions and React state staleness when an order contains multiple items (e.g. Kopi Senja + Croissant).
 */
export function deductOrderItemsBOM(
  currentStock: IngredientItem[],
  recipes: RecipeBOM[],
  items: OrderItemBOMInput[]
): { updatedStock: IngredientItem[]; logs: StockAdjustmentLog[]; deductedCount: number } {
  let runningStock = [...currentStock];
  const allLogs: StockAdjustmentLog[] = [];
  let deductedCount = 0;

  for (const item of items) {
    const term = item.productName.toLowerCase().trim();
    const recipe = recipes.find(
      (r) =>
        r.menuId.toLowerCase() === term ||
        r.menuName.toLowerCase() === term ||
        r.menuName.toLowerCase().includes(term) ||
        term.includes(r.menuName.toLowerCase()) ||
        (term.includes("croissant") && r.menuName.toLowerCase().includes("croissant")) ||
        (term.includes("senja") && r.menuName.toLowerCase().includes("senja")) ||
        (term.includes("americano") && r.menuName.toLowerCase().includes("americano")) ||
        (term.includes("tea") && r.menuName.toLowerCase().includes("tea")) ||
        (term.includes("wagyu") && r.menuName.toLowerCase().includes("wagyu"))
    );

    if (recipe) {
      const { updatedStock, logs } = deductRecipeIngredients(
        runningStock,
        recipe,
        item.quantity,
        item.modifiers
      );
      runningStock = updatedStock;
      allLogs.push(...logs);
      deductedCount++;
    }
  }

  return { updatedStock: runningStock, logs: allLogs, deductedCount };
}
