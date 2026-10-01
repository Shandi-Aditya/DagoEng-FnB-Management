"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { MasterProduct } from "@/types/product";
import { useOutlet } from "./OutletContext";
import { useActivityLog } from "./ActivityLogContext";

export const INITIAL_PRODUCTS: MasterProduct[] = [
  {
    id: "prod-101",
    name: "Kopi Senja Aren",
    category: "Signature Coffee",
    basePrice: 24000,
    cogsEstimate: 8640,
    grossMarginPercent: "64.0%",
    status: "ACTIVE",
    outletId: "ALL",
    outletName: "Semua Outlet",
    isAvailable: true,
    variants: [
      { name: "Regular", priceAdjustment: 0 },
      { name: "Large (+5k)", priceAdjustment: 5000 },
      { name: "1 Liter Bottle (+45k)", priceAdjustment: 45000 },
    ],
    modifierGroupNames: ["Sugar Level", "Milk Alternative"],
    recipeMenuId: "m-1",
    description: "Espresso robusta & arabica blend dengan susu segar dan gula aren organik Bali.",
    tenantId: "tenant-ks",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-17T00:00:00Z",
  },
  {
    id: "prod-102",
    name: "Artisan Peach White Tea",
    category: "Artisan Tea & Refreshers",
    basePrice: 28000,
    cogsEstimate: 7840,
    grossMarginPercent: "72.0%",
    status: "ACTIVE",
    outletId: "ALL",
    outletName: "Semua Outlet",
    isAvailable: true,
    variants: [
      { name: "Iced Cold Brew", priceAdjustment: 0 },
      { name: "Hot Teapot (+4k)", priceAdjustment: 4000 },
    ],
    recipeMenuId: "m-2",
    description: "Teh putih artisan dengan sirup buah persik segar dan potongan buah peach.",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-17T00:00:00Z",
  },
  {
    id: "prod-103",
    name: "Signature Wagyu Beef Bowl",
    category: "Main Course",
    basePrice: 65000,
    cogsEstimate: 36400,
    grossMarginPercent: "44.0%",
    status: "ACTIVE",
    outletId: "ALL",
    outletName: "Semua Outlet",
    isAvailable: true,
    variants: [
      { name: "Standard (120g)", priceAdjustment: 0 },
      { name: "Double Meat (200g +25k)", priceAdjustment: 25000 },
    ],
    modifierGroupNames: ["Egg Doneness", "Spiciness Level"],
    recipeMenuId: "m-3",
    description: "Irisan daging wagyu meltique lezat disajikan di atas nasi hangat dengan onsen egg.",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-17T00:00:00Z",
  },
  {
    id: "prod-104",
    name: "Flaky French Butter Croissant",
    category: "Pastry & Snacks",
    basePrice: 20000,
    cogsEstimate: 8400,
    grossMarginPercent: "58.0%",
    status: "ACTIVE",
    outletId: "ALL",
    outletName: "Semua Outlet",
    isAvailable: true,
    variants: [
      { name: "Plain Butter", priceAdjustment: 0 },
      { name: "Almond Cream (+8k)", priceAdjustment: 8000 },
      { name: "Chocolate Hazelnut (+6k)", priceAdjustment: 6000 },
    ],
    recipeMenuId: "m-4",
    description: "Croissant panggang mentega Prancis berlayer renyah dan lembut di dalam.",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-17T00:00:00Z",
  },
  {
    id: "prod-105",
    name: "Classic Americano",
    category: "Signature Coffee",
    basePrice: 22000,
    cogsEstimate: 5500,
    grossMarginPercent: "75.0%",
    status: "ACTIVE",
    outletId: "ALL",
    outletName: "Semua Outlet",
    isAvailable: true,
    variants: [
      { name: "Hot (Double Shot)", priceAdjustment: 0 },
      { name: "Iced (Double Shot)", priceAdjustment: 0 },
    ],
    recipeMenuId: "m-5",
    description: "Double shot espresso blend diekstraksi segar dengan air mineral pegunungan.",
    tenantId: "tenant-ks",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-17T00:00:00Z",
  },
  {
    id: "prod-106",
    name: "Truffle Parmesan Fries",
    category: "Pastry & Snacks",
    basePrice: 32000,
    cogsEstimate: 11200,
    grossMarginPercent: "65.0%",
    status: "ACTIVE",
    outletId: "ALL",
    outletName: "Semua Outlet",
    isAvailable: true,
    description: "Kentang goreng renyah dengan minyak truffle putih dan parutan keju parmesan asli.",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-17T00:00:00Z",
  },
];

interface ProductContextType {
  products: MasterProduct[];
  filteredProducts: MasterProduct[];
  categories: string[];
  addProduct: (product: Omit<MasterProduct, "id" | "createdAt" | "updatedAt" | "grossMarginPercent">) => MasterProduct;
  addCategory: (categoryName: string) => void;
  updateProduct: (id: string, updates: Partial<MasterProduct>, reason?: string) => void;
  toggleProductStatus: (id: string) => void;
  deleteProduct: (id: string) => void;
  resetProductData: () => void;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);
const STORAGE_KEY_PRODUCTS = "dagoeng_master_products_v1";
const STORAGE_KEY_CATEGORIES = "dagoeng_master_categories_v1";

export function ProductProvider({ children }: { children: React.ReactNode }) {
  const { activeOutletId, isAllOutlets } = useOutlet();
  const { logActivity } = useActivityLog();
  const [products, setProducts] = useState<MasterProduct[]>(INITIAL_PRODUCTS);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PRODUCTS);
      const savedCats = localStorage.getItem(STORAGE_KEY_CATEGORIES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProducts(parsed);
        }
      }
      if (savedCats) {
        const parsedCats = JSON.parse(savedCats);
        if (Array.isArray(parsedCats)) {
          setCustomCategories(parsedCats);
        }
      }
    } catch (e) {
      console.error("Failed to load products", e);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products));
      localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(customCategories));
    } catch (e) {
      console.error("Failed to save products", e);
    }
  }, [products, customCategories, isInitialized]);

  const addCategory = (categoryName: string) => {
    const trimmed = categoryName.trim();
    if (!trimmed) return;
    if (!customCategories.includes(trimmed)) {
      setCustomCategories((prev) => [...prev, trimmed]);
    }
  };

  const categories = Array.from(
    new Set([...products.map((p) => p.category), ...customCategories])
  );

  // Outlet-scoped products (either ALL or matching activeOutletId)
  const filteredProducts = products.filter((p) => {
    if (isAllOutlets) return true;
    return p.outletId === "ALL" || p.outletId === activeOutletId;
  });

  const addProduct = (
    productData: Omit<MasterProduct, "id" | "createdAt" | "updatedAt" | "grossMarginPercent">
  ): MasterProduct => {
    const nowIso = new Date().toISOString();
    const margin = (((productData.basePrice - productData.cogsEstimate) / (productData.basePrice || 1)) * 100).toFixed(1) + "%";

    const newProduct: MasterProduct = {
      ...productData,
      id: `prod-${Date.now()}`,
      grossMarginPercent: margin,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setProducts((prev) => [newProduct, ...prev]);

    logActivity({
      module: "MENU",
      action: "CREATE_PRODUCT",
      recordId: newProduct.id,
      newValue: `${newProduct.name} (${newProduct.category} - Rp ${newProduct.basePrice.toLocaleString()})`,
      description: `Penambahan master menu produk baru: "${newProduct.name}"`,
      reason: "Menu baru aktif di POS dan QR Ordering",
      status: "SUCCESS",
    });

    return newProduct;
  };

  const updateProduct = (id: string, updates: Partial<MasterProduct>, reason?: string) => {
    const existing = products.find((p) => p.id === id);
    if (!existing) return;

    const prevStr = `Harga: Rp ${existing.basePrice.toLocaleString()}, Status: ${existing.status}`;
    const newPrice = updates.basePrice !== undefined ? updates.basePrice : existing.basePrice;
    const newCogs = updates.cogsEstimate !== undefined ? updates.cogsEstimate : existing.cogsEstimate;
    const margin = (((newPrice - newCogs) / (newPrice || 1)) * 100).toFixed(1) + "%";

    setProducts((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              ...updates,
              grossMarginPercent: margin,
              updatedAt: new Date().toISOString(),
            }
          : p
      )
    );

    logActivity({
      module: "MENU",
      action: "UPDATE_PRODUCT",
      recordId: id,
      previousValue: prevStr,
      newValue: `Harga: Rp ${newPrice.toLocaleString()}, Status: ${updates.status || existing.status}`,
      description: `Perubahan data produk "${existing.name}"`,
      reason: reason || "Pembaruan master harga/kategori menu",
      status: "SUCCESS",
    });
  };

  const toggleProductStatus = (id: string) => {
    const existing = products.find((p) => p.id === id);
    if (!existing) return;
    const nextStatus = existing.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    updateProduct(id, { status: nextStatus }, `Ubah status produk menjadi ${nextStatus}`);
  };

  const deleteProduct = (id: string) => {
    const existing = products.find((p) => p.id === id);
    if (!existing) return;

    setProducts((prev) => prev.filter((p) => p.id !== id));

    logActivity({
      module: "MENU",
      action: "DELETE_PRODUCT",
      recordId: id,
      previousValue: existing.name,
      newValue: "DELETED",
      description: `Penghapusan produk "${existing.name}" dari master katalog`,
      reason: "Menu diarsipkan oleh Owner",
      status: "SUCCESS",
    });
  };

  const resetProductData = () => {
    setProducts(INITIAL_PRODUCTS);
    try {
      localStorage.removeItem(STORAGE_KEY_PRODUCTS);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <ProductContext.Provider
      value={{
        products,
        filteredProducts,
        categories,
        addProduct,
        addCategory,
        updateProduct,
        toggleProductStatus,
        deleteProduct,
        resetProductData,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
}

export function useProducts() {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error("useProducts must be used within a ProductProvider");
  }
  return context;
}
