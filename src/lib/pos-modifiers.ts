import { POSModifierGroup } from "@/features/pos/types";
import { POS_PRODUCTS } from "@/features/pos/mock-data";

export const STANDARD_SUGAR_MODIFIER: POSModifierGroup = {
  id: "mod-sugar",
  name: "Level Gula",
  isRequired: false,
  minSelect: 0,
  maxSelect: 1,
  options: [
    { name: "Normal Sugar (100%)", price: 0 },
    { name: "Less Sugar (50%)", price: 0 },
    { name: "No Sugar (0%)", price: 0 },
  ],
};

export const STANDARD_MILK_MODIFIER: POSModifierGroup = {
  id: "mod-milk",
  name: "Pilihan Susu",
  isRequired: false,
  minSelect: 0,
  maxSelect: 1,
  options: [
    { name: "Fresh Milk Standard", price: 0 },
    { name: "Oat Milk (+Rp 8.000)", price: 8000 },
  ],
};

export const STANDARD_PASTRY_SERVE_MODIFIER: POSModifierGroup = {
  id: "mod-pastry-serve",
  name: "Penyajian",
  isRequired: false,
  minSelect: 0,
  maxSelect: 1,
  options: [
    { name: "Hangatkan (Warm/Toasted)", price: 0 },
    { name: "Suhu Ruang (Normal)", price: 0 },
  ],
};

export const STANDARD_DIPPING_MODIFIER: POSModifierGroup = {
  id: "mod-pastry-dip",
  name: "Extra Dipping",
  isRequired: false,
  minSelect: 0,
  maxSelect: 2,
  options: [
    { name: "Nutella Dip", price: 5000 },
    { name: "Strawberry Jam", price: 4000 },
  ],
};

export const STANDARD_SPICE_MODIFIER: POSModifierGroup = {
  id: "mod-spiciness",
  name: "Level Pedas",
  isRequired: false,
  minSelect: 0,
  maxSelect: 1,
  options: [
    { name: "Tidak Pedas (Mild)", price: 0 },
    { name: "Pedas Sedang", price: 0 },
    { name: "Ekstra Pedas", price: 0 },
  ],
};

export const STANDARD_SAUCE_MODIFIER: POSModifierGroup = {
  id: "mod-sauce",
  name: "Pilihan Saus",
  isRequired: false,
  minSelect: 0,
  maxSelect: 2,
  options: [
    { name: "Saus Sambal & Tomat", price: 0 },
    { name: "Truffle Mayo (+5k)", price: 5000 },
  ],
};

/**
 * POS-13 / TC-B03:
 * Resolves context-aware modifier groups per product category.
 * Prevents irrelevant modifiers (e.g. sugar levels on croissants or milk choices on Americano).
 */
export function resolveProductModifierGroups(product: {
  id?: string;
  name: string;
  category?: string;
  modifierGroups?: POSModifierGroup[];
}): POSModifierGroup[] {
  // 1. If product explicitly has custom modifierGroups defined, preserve them
  if (product.modifierGroups && product.modifierGroups.length > 0) {
    return product.modifierGroups;
  }

  // 2. Check if product exists in POS_PRODUCTS with predefined modifiers
  const matchedMock = POS_PRODUCTS.find(
    (p) =>
      (product.id && p.id === product.id) ||
      p.name.toLowerCase() === product.name.toLowerCase()
  );
  if (matchedMock?.modifierGroups && matchedMock.modifierGroups.length > 0) {
    return matchedMock.modifierGroups;
  }

  const nameLower = product.name.toLowerCase();
  const categoryLower = (product.category || "").toLowerCase();

  // 3. Pastry & Bakery (Croissant, Danish, Toast, Cake, Roti)
  if (
    categoryLower.includes("pastry") ||
    categoryLower.includes("bakery") ||
    nameLower.includes("croissant") ||
    nameLower.includes("danish") ||
    nameLower.includes("toast") ||
    nameLower.includes("roti") ||
    nameLower.includes("pancake")
  ) {
    return [STANDARD_PASTRY_SERVE_MODIFIER, STANDARD_DIPPING_MODIFIER];
  }

  // 4. Fries & Savory Snacks
  if (nameLower.includes("fries") || nameLower.includes("kentang")) {
    return [STANDARD_SAUCE_MODIFIER];
  }

  // 5. Main Course & Savory Food (Nasi, Mie, Rice Bowl, Ayam, Daging)
  if (
    categoryLower.includes("makanan") ||
    categoryLower.includes("main course") ||
    nameLower.includes("nasi") ||
    nameLower.includes("mie") ||
    nameLower.includes("bowl") ||
    nameLower.includes("ayam") ||
    nameLower.includes("beef")
  ) {
    return [STANDARD_SPICE_MODIFIER];
  }

  // 6. Non-food categories (Co-working, Merchandise, Event)
  if (
    categoryLower.includes("co-working") ||
    categoryLower.includes("coworking") ||
    categoryLower.includes("service")
  ) {
    return [];
  }

  // 7. Beverages (Coffee, Tea, Juice)
  const isBlackCoffee =
    nameLower.includes("americano") ||
    nameLower.includes("espresso") ||
    nameLower.includes("long black") ||
    nameLower.includes("tubruk") ||
    nameLower.includes("v60") ||
    nameLower.includes("manual brew");

  const isTeaOrJuice =
    categoryLower.includes("tea") ||
    nameLower.includes("tea") ||
    nameLower.includes("teh") ||
    nameLower.includes("jeruk") ||
    nameLower.includes("squash") ||
    nameLower.includes("juice") ||
    nameLower.includes("jus");

  // Pure black coffee and fruit tea get sugar options but strictly NO milk options (POS-13 / TC-B03)
  if (isBlackCoffee || isTeaOrJuice) {
    return [STANDARD_SUGAR_MODIFIER];
  }

  // Default beverage (milk-based coffee, latte, matcha, chocolate) gets both sugar & milk options
  if (categoryLower.includes("minuman") || categoryLower.includes("coffee") || categoryLower.includes("beverage")) {
    return [STANDARD_SUGAR_MODIFIER, STANDARD_MILK_MODIFIER];
  }

  return [];
}
