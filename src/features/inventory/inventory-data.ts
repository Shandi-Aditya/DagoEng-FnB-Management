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
  {
    id: "ing-10",
    name: "Bubuk Matcha Premium Uji (500g)",
    category: "Dry Goods",
    stockNumber: 5.0,
    unit: "kg",
    min: 1.0,
    costPerUnit: 280000,
    supplier: "Kyoto Tea Import",
    status: "SAFE",
    lastUpdated: "Stok Awal",
  },
  {
    id: "ing-11",
    name: "Kentang Goreng Shoestring Cut (2.5kg)",
    category: "Dry Goods",
    stockNumber: 20.0,
    unit: "kg",
    min: 5.0,
    costPerUnit: 30000,
    supplier: "Bali Frozen Food",
    status: "SAFE",
    lastUpdated: "Stok Awal",
  },
  {
    id: "ing-12",
    name: "Daging Ayam Fillet Segar (1kg)",
    category: "Meat & Protein",
    stockNumber: 15.0,
    unit: "kg",
    min: 4.0,
    costPerUnit: 55000,
    supplier: "Unggas Jaya Bali",
    status: "SAFE",
    lastUpdated: "Stok Awal",
  },
  {
    id: "ing-13",
    name: "Mie Telur Basah Spesial (1kg)",
    category: "Dry Goods",
    stockNumber: 12.0,
    unit: "kg",
    min: 3.0,
    costPerUnit: 25000,
    supplier: "Pabrik Mie Sejahtera",
    status: "SAFE",
    lastUpdated: "Stok Awal",
  },
  {
    id: "ing-14",
    name: "Jeruk Peras Segar Lokal (1kg)",
    category: "Dry Goods",
    stockNumber: 15.0,
    unit: "kg",
    min: 4.0,
    costPerUnit: 20000,
    supplier: "Kebun Jeruk Kintamani",
    status: "SAFE",
    lastUpdated: "Stok Awal",
  },
  {
    id: "ing-15",
    name: "Minyak Truffle & Keju Parmesan (250g)",
    category: "Dairy",
    stockNumber: 4.0,
    unit: "kg",
    min: 1.0,
    costPerUnit: 250000,
    supplier: "Gourmet Import Bali",
    status: "SAFE",
    lastUpdated: "Stok Awal",
  },
  {
    id: "ing-16",
    name: "Pasta Cokelat Belgia (1kg)",
    category: "Dry Goods",
    stockNumber: 8.0,
    unit: "kg",
    min: 2.0,
    costPerUnit: 90000,
    supplier: "PT Pastry Prima",
    status: "SAFE",
    lastUpdated: "Stok Awal",
  },
  {
    id: "ing-17",
    name: "Premix Banana Cake Artisan (1kg)",
    category: "Dry Goods",
    stockNumber: 10.0,
    unit: "kg",
    min: 2.0,
    costPerUnit: 65000,
    supplier: "PT Pastry Prima",
    status: "SAFE",
    lastUpdated: "Stok Awal",
  },
  {
    id: "ing-18",
    name: "Tempe Kedelai Segar (Isi 10)",
    category: "Meat & Protein",
    stockNumber: 20.0,
    unit: "Pack (10 pcs)",
    min: 5.0,
    costPerUnit: 12000,
    supplier: "Pengrajin Tempe Singaraja",
    status: "SAFE",
    lastUpdated: "Stok Awal",
  },
  {
    id: "ing-19",
    name: "Daun Teh Melati Premium (500g)",
    category: "Dry Goods",
    stockNumber: 6.0,
    unit: "kg",
    min: 1.5,
    costPerUnit: 60000,
    supplier: "Kebun Teh Bedugul",
    status: "SAFE",
    lastUpdated: "Stok Awal",
  },
];

export const INITIAL_RECIPES: RecipeBOM[] = [
  // 1. KOPI SENJA AREN (prod-101)
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
  // 2. ES TEH PEACH / ARTISAN PEACH WHITE TEA (prod-102)
  {
    menuId: "m-2",
    menuName: "Artisan Peach White Tea",
    category: "Artisan Tea & Refreshers",
    sellingPrice: 18000,
    ingredients: [
      { ingredientId: "ing-4", ingredientName: "Sirup Peach Artisan", quantityRequired: 0.04, unit: "Botol (30ml)", costEstimate: 3400 },
      { ingredientId: "ing-8", ingredientName: "Cup Biodegradable & Straw", quantityRequired: 1, unit: "Pcs", costEstimate: 1200 },
    ],
    totalCOGS: 4600,
    grossMarginPercent: 74.4,
  },
  // 3. NASI BEEF BOWL / SIGNATURE WAGYU BEEF BOWL (prod-103)
  {
    menuId: "m-3",
    menuName: "Signature Wagyu Beef Bowl",
    category: "Main Course",
    sellingPrice: 45000,
    ingredients: [
      { ingredientId: "ing-5", ingredientName: "Daging Sapi Wagyu Slice", quantityRequired: 0.12, unit: "kg (120g)", costEstimate: 25200 },
      { ingredientId: "ing-6", ingredientName: "Beras Jepang Koshihikari", quantityRequired: 0.03, unit: "Karung (150g)", costEstimate: 3750 },
    ],
    totalCOGS: 28950,
    grossMarginPercent: 35.7,
  },
  // 4. BUTTER CROISSANT / FLAKY FRENCH BUTTER CROISSANT (prod-104)
  {
    menuId: "m-4",
    menuName: "Butter Croissant",
    category: "Pastry & Snacks",
    sellingPrice: 20000,
    ingredients: [
      { ingredientId: "ing-7", ingredientName: "Dough French Butter Croissant", quantityRequired: 0.1, unit: "Pack (1 pcs)", costEstimate: 7500 },
    ],
    totalCOGS: 7500,
    grossMarginPercent: 62.5,
  },
  // 5. CLASSIC AMERICANO (prod-105)
  {
    menuId: "m-5",
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
  // 6. TRUFFLE PARMESAN FRIES (prod-106)
  {
    menuId: "m-6",
    menuName: "Truffle Parmesan Fries",
    category: "Pastry & Snacks",
    sellingPrice: 32000,
    ingredients: [
      { ingredientId: "ing-11", ingredientName: "Kentang Goreng Shoestring Cut", quantityRequired: 0.15, unit: "kg", costEstimate: 4500 },
      { ingredientId: "ing-15", ingredientName: "Minyak Truffle & Keju Parmesan", quantityRequired: 0.02, unit: "kg", costEstimate: 5000 },
    ],
    totalCOGS: 9500,
    grossMarginPercent: 70.3,
  },
  // 7. MATCHA LATTE (prod-107)
  {
    menuId: "m-7",
    menuName: "Matcha Latte",
    category: "Beverage",
    sellingPrice: 26000,
    ingredients: [
      { ingredientId: "ing-10", ingredientName: "Bubuk Matcha Premium Uji", quantityRequired: 0.015, unit: "kg", costEstimate: 4200 },
      { ingredientId: "ing-1", ingredientName: "Susu Fresh Milk Greenfield", quantityRequired: 0.12, unit: "Liter (120ml)", costEstimate: 2640 },
      { ingredientId: "ing-8", ingredientName: "Cup Biodegradable & Straw", quantityRequired: 1, unit: "Pcs", costEstimate: 1200 },
    ],
    totalCOGS: 8040,
    grossMarginPercent: 69.1,
  },
  // 8. FRENCH FRIES GURIH (prod-108)
  {
    menuId: "m-8",
    menuName: "French Fries Gurih",
    category: "Pastry & Snacks",
    sellingPrice: 20000,
    ingredients: [
      { ingredientId: "ing-11", ingredientName: "Kentang Goreng Shoestring Cut", quantityRequired: 0.15, unit: "kg", costEstimate: 4500 },
    ],
    totalCOGS: 4500,
    grossMarginPercent: 77.5,
  },
  // 9. NASI AYAM SAMBAL MATAH (prod-109)
  {
    menuId: "m-9",
    menuName: "Nasi Ayam Sambal Matah",
    category: "Main Course",
    sellingPrice: 32000,
    ingredients: [
      { ingredientId: "ing-12", ingredientName: "Daging Ayam Fillet Segar", quantityRequired: 0.12, unit: "kg", costEstimate: 6600 },
      { ingredientId: "ing-6", ingredientName: "Beras Jepang Koshihikari", quantityRequired: 0.03, unit: "Karung (150g)", costEstimate: 3750 },
    ],
    totalCOGS: 10350,
    grossMarginPercent: 67.7,
  },
  // 10. MIE GORENG JAWA (prod-110)
  {
    menuId: "m-10",
    menuName: "Mie Goreng Jawa",
    category: "Main Course",
    sellingPrice: 28000,
    ingredients: [
      { ingredientId: "ing-13", ingredientName: "Mie Telur Basah Spesial", quantityRequired: 0.15, unit: "kg", costEstimate: 3750 },
      { ingredientId: "ing-12", ingredientName: "Daging Ayam Fillet Segar", quantityRequired: 0.06, unit: "kg", costEstimate: 3300 },
    ],
    totalCOGS: 7050,
    grossMarginPercent: 74.8,
  },
  // 11. ES JERUK PERAS (prod-111)
  {
    menuId: "m-11",
    menuName: "Es Jeruk Peras",
    category: "Beverage",
    sellingPrice: 12000,
    ingredients: [
      { ingredientId: "ing-14", ingredientName: "Jeruk Peras Segar Lokal", quantityRequired: 0.2, unit: "kg", costEstimate: 4000 },
      { ingredientId: "ing-3", ingredientName: "Gula Aren Organik Cair", quantityRequired: 0.015, unit: "Liter", costEstimate: 270 },
      { ingredientId: "ing-8", ingredientName: "Cup Biodegradable & Straw", quantityRequired: 1, unit: "Pcs", costEstimate: 1200 },
    ],
    totalCOGS: 5470,
    grossMarginPercent: 54.4,
  },
  // 12. CHOCOLATE CROISSANT (prod-112)
  {
    menuId: "m-12",
    menuName: "Chocolate Croissant",
    category: "Pastry & Snacks",
    sellingPrice: 24000,
    ingredients: [
      { ingredientId: "ing-7", ingredientName: "Dough French Butter Croissant", quantityRequired: 0.1, unit: "Pack (1 pcs)", costEstimate: 7500 },
      { ingredientId: "ing-16", ingredientName: "Pasta Cokelat Belgia", quantityRequired: 0.025, unit: "kg", costEstimate: 2250 },
    ],
    totalCOGS: 9750,
    grossMarginPercent: 59.4,
  },
  // 13. BANANA BREAD SLICE (prod-113)
  {
    menuId: "m-13",
    menuName: "Banana Bread Slice",
    category: "Pastry & Snacks",
    sellingPrice: 18000,
    ingredients: [
      { ingredientId: "ing-17", ingredientName: "Premix Banana Cake Artisan", quantityRequired: 0.08, unit: "kg", costEstimate: 5200 },
    ],
    totalCOGS: 5200,
    grossMarginPercent: 71.1,
  },
  // 14. NASI AYAM KREMES (prod-114)
  {
    menuId: "m-14",
    menuName: "Nasi Ayam Kremes",
    category: "Main Course",
    sellingPrice: 28000,
    ingredients: [
      { ingredientId: "ing-12", ingredientName: "Daging Ayam Fillet Segar", quantityRequired: 0.12, unit: "kg", costEstimate: 6600 },
      { ingredientId: "ing-6", ingredientName: "Beras Jepang Koshihikari", quantityRequired: 0.03, unit: "Karung (150g)", costEstimate: 3750 },
    ],
    totalCOGS: 10350,
    grossMarginPercent: 63.0,
  },
  // 15. TEMPE MENDOAN (3 PCS) (prod-115)
  {
    menuId: "m-15",
    menuName: "Tempe Mendoan (3 pcs)",
    category: "Pastry & Snacks",
    sellingPrice: 12000,
    ingredients: [
      { ingredientId: "ing-18", ingredientName: "Tempe Kedelai Segar", quantityRequired: 0.3, unit: "Pack (3 pcs)", costEstimate: 3600 },
    ],
    totalCOGS: 3600,
    grossMarginPercent: 70.0,
  },
  // 16. ES TEH MANIS MELATI (prod-116)
  {
    menuId: "m-16",
    menuName: "Es Teh Manis Melati",
    category: "Beverage",
    sellingPrice: 6000,
    ingredients: [
      { ingredientId: "ing-19", ingredientName: "Daun Teh Melati Premium", quantityRequired: 0.008, unit: "kg", costEstimate: 480 },
      { ingredientId: "ing-3", ingredientName: "Gula Aren Organik Cair", quantityRequired: 0.015, unit: "Liter", costEstimate: 270 },
      { ingredientId: "ing-8", ingredientName: "Cup Biodegradable & Straw", quantityRequired: 1, unit: "Pcs", costEstimate: 1200 },
    ],
    totalCOGS: 1950,
    grossMarginPercent: 67.5,
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
 * Supports modifier substitutions such as Oat Milk replacing fresh milk (TC-G02), extra espresso shots,
 * beverage sizing (Large, 1 Liter), and meal portions (Double Meat).
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
  const isLarge = normalizedMods.some((m) => m.includes("large") || m.includes("400ml"));
  const isOneLiter = normalizedMods.some((m) => m.includes("1 liter") || m.includes("1l") || m.includes("bottle"));
  const isDoubleMeat = normalizedMods.some((m) => m.includes("double") && (m.includes("beef") || m.includes("meat") || m.includes("wagyu") || m.includes("ayam")));
  const isChocolate = normalizedMods.some((m) => m.includes("chocolate") || m.includes("cokelat"));

  // Build effective ingredient requirements for this item
  // 1. Substitute Oat Milk if selected (TC-G02)
  let effectiveIngredients = recipe.ingredients.map((ing) => {
    if (isOatMilk && (ing.ingredientId === "ing-1" || ing.ingredientName.toLowerCase().includes("fresh milk") || ing.ingredientName.toLowerCase().includes("susu"))) {
      return {
        ...ing,
        ingredientId: "ing-9",
        ingredientName: "Susu Oat Milk Barista Edition (1L)",
      };
    }
    return { ...ing };
  });

  // 2. Extra Shot: add 0.018 kg of House Blend (ing-2)
  if (hasExtraShot) {
    const coffeeIndex = effectiveIngredients.findIndex((ing) => ing.ingredientId === "ing-2");
    if (coffeeIndex > -1) {
      effectiveIngredients[coffeeIndex] = {
        ...effectiveIngredients[coffeeIndex],
        quantityRequired: Number((effectiveIngredients[coffeeIndex].quantityRequired + 0.018).toFixed(3)),
      };
    } else {
      effectiveIngredients.push({
        ingredientId: "ing-2",
        ingredientName: "Biji Kopi House Blend",
        quantityRequired: 0.018,
        unit: "kg (18g)",
        costEstimate: 2520,
      });
    }
  }

  // 3. Large variant: scale liquid/powder/coffee ingredients by 1.5x (packaging cup stays 1 pcs)
  if (isLarge) {
    effectiveIngredients = effectiveIngredients.map((ing) => {
      if (ing.ingredientId === "ing-8") return ing;
      return {
        ...ing,
        quantityRequired: Number((ing.quantityRequired * 1.5).toFixed(3)),
      };
    });
  }

  // 4. 1 Liter Bottle variant: scale ingredients by 4x
  if (isOneLiter) {
    effectiveIngredients = effectiveIngredients.map((ing) => {
      return {
        ...ing,
        quantityRequired: Number((ing.quantityRequired * 4).toFixed(3)),
      };
    });
  }

  // 5. Double Meat variant: double meat ingredient (ing-5 or ing-12)
  if (isDoubleMeat) {
    effectiveIngredients = effectiveIngredients.map((ing) => {
      if (ing.ingredientId === "ing-5" || ing.ingredientId === "ing-12" || ing.ingredientName.toLowerCase().includes("daging") || ing.ingredientName.toLowerCase().includes("ayam")) {
        return {
          ...ing,
          quantityRequired: Number((ing.quantityRequired * 2).toFixed(3)),
        };
      }
      return ing;
    });
  }

  // 6. Chocolate modifier on pastry: add chocolate paste if not already present
  if (isChocolate && !effectiveIngredients.some((ing) => ing.ingredientId === "ing-16")) {
    effectiveIngredients.push({
      ingredientId: "ing-16",
      ingredientName: "Pasta Cokelat Belgia",
      quantityRequired: 0.025,
      unit: "kg",
      costEstimate: 2250,
    });
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
 * Supports matching via productId, exact product name, alias product names, and keyword substrings.
 */
export function deductOrderItemsBOM(
  currentStock: IngredientItem[],
  recipes: RecipeBOM[],
  items: OrderItemBOMInput[]
): { updatedStock: IngredientItem[]; logs: StockAdjustmentLog[]; deductedCount: number } {
  let runningStock = [...currentStock];
  const allLogs: StockAdjustmentLog[] = [];
  let deductedCount = 0;

  const aliasMap: Record<string, string[]> = {
    "m-1": ["kopi senja aren", "kopi senja", "senja aren", "prod-101", "prod-1"],
    "m-2": ["es teh peach", "artisan peach white tea", "peach tea", "teh peach", "prod-102", "prod-2"],
    "m-3": ["nasi beef bowl sambal matah", "signature wagyu beef bowl", "beef bowl", "wagyu beef bowl", "prod-103", "prod-5"],
    "m-4": ["butter croissant", "flaky french butter croissant", "plain butter", "croissant", "prod-104", "prod-6", "m-5"],
    "m-5": ["classic americano", "americano", "prod-105", "prod-3", "m-6"],
    "m-6": ["truffle parmesan fries", "truffle fries", "prod-106", "prod-7"],
    "m-7": ["matcha latte", "matcha", "prod-107"],
    "m-8": ["french fries gurih", "french fries", "fries gurih", "prod-108"],
    "m-9": ["nasi ayam sambal matah", "ayam sambal matah", "prod-109"],
    "m-10": ["mie goreng jawa", "mie goreng", "prod-110"],
    "m-11": ["es jeruk peras", "jeruk peras", "es jeruk", "prod-111"],
    "m-12": ["chocolate croissant", "pain au chocolat", "choco croissant", "prod-112"],
    "m-13": ["banana bread slice", "banana bread", "bolu pisang", "prod-113"],
    "m-14": ["nasi ayam kremes", "ayam kremes", "prod-114"],
    "m-15": ["tempe mendoan (3 pcs)", "tempe mendoan", "mendoan", "prod-115"],
    "m-16": ["es teh manis melati", "es teh manis", "teh melati", "prod-116"],
  };

  for (const item of items) {
    const term = item.productName.toLowerCase().trim();
    const productId = (item.productId || "").toLowerCase().trim();

    // 1. First attempt: match by productId or menuId
    let recipe = recipes.find(
      (r) =>
        (productId && (r.menuId.toLowerCase() === productId || (r as any).productId === productId)) ||
        r.menuId.toLowerCase() === term
    );

    // 2. Second attempt: exact name match
    if (!recipe) {
      recipe = recipes.find((r) => r.menuName.toLowerCase() === term);
    }

    // 3. Third attempt: semantic alias mapping
    if (!recipe) {
      for (const [recipeId, aliases] of Object.entries(aliasMap)) {
        if (
          aliases.some(
            (al) =>
              al === term ||
              term.includes(al) ||
              al.includes(term) ||
              (productId && al === productId)
          )
        ) {
          recipe = recipes.find((r) => r.menuId === recipeId);
          if (recipe) break;
        }
      }
    }

    // 4. Fourth attempt: generic keyword substring match
    if (!recipe) {
      recipe = recipes.find(
        (r) =>
          r.menuName.toLowerCase().includes(term) ||
          term.includes(r.menuName.toLowerCase()) ||
          (term.includes("croissant") && r.menuName.toLowerCase().includes("croissant")) ||
          (term.includes("senja") && r.menuName.toLowerCase().includes("senja")) ||
          (term.includes("americano") && r.menuName.toLowerCase().includes("americano")) ||
          (term.includes("tea") && r.menuName.toLowerCase().includes("tea")) ||
          (term.includes("wagyu") && r.menuName.toLowerCase().includes("wagyu"))
      );
    }

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
