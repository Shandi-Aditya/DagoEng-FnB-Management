"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { MasterProduct } from "@/types/product";
import { useOutlet } from "./OutletContext";
import { useActivityLog } from "./ActivityLogContext";

export const INITIAL_PRODUCTS: MasterProduct[] = [
  // 1. KOPI SENJA (tenant-ks) - Coffee & Beverage
  {
    id: "prod-101",
    name: "Kopi Senja Aren",
    category: "Minuman",
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
    description: "Perpaduan espresso, susu segar, dan manis gula aren organik.",
    imageUrl: "https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=600&auto=format&fit=crop",
    tenantId: "tenant-ks",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-17T00:00:00Z",
  },
  {
    id: "prod-105",
    name: "Classic Americano",
    category: "Minuman",
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
    imageUrl: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=600&auto=format&fit=crop",
    tenantId: "tenant-ks",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-17T00:00:00Z",
  },
  {
    id: "prod-107",
    name: "Matcha Latte",
    category: "Minuman",
    basePrice: 26000,
    cogsEstimate: 9000,
    grossMarginPercent: "65.4%",
    status: "ACTIVE",
    outletId: "ALL",
    outletName: "Semua Outlet",
    isAvailable: true,
    variants: [
      { name: "Iced", priceAdjustment: 0 },
      { name: "Hot (+2k)", priceAdjustment: 2000 },
    ],
    description: "Seduhan bubuk matcha murni berpadu dengan susu segar lembut.",
    imageUrl: "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?q=80&w=600&auto=format&fit=crop",
    tenantId: "tenant-ks",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-17T00:00:00Z",
  },
  {
    id: "prod-108",
    name: "French Fries Gurih",
    category: "Camilan",
    basePrice: 20000,
    cogsEstimate: 7000,
    grossMarginPercent: "65.0%",
    status: "ACTIVE",
    outletId: "ALL",
    outletName: "Semua Outlet",
    isAvailable: true,
    description: "Kentang goreng renyah bumbu rempah gurih untuk teman kopi.",
    imageUrl: "https://images.unsplash.com/photo-1576107232684-1279f3908594?q=80&w=600&auto=format&fit=crop",
    tenantId: "tenant-ks",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-17T00:00:00Z",
  },

  // 2. DAPUR MAMA (tenant-kitchen) - Indonesian Homemade Food
  {
    id: "prod-103",
    name: "Nasi Beef Bowl Sambal Matah",
    category: "Makanan",
    basePrice: 45000,
    cogsEstimate: 22000,
    grossMarginPercent: "51.1%",
    status: "ACTIVE",
    outletId: "ALL",
    outletName: "Semua Outlet",
    isAvailable: true,
    variants: [
      { name: "Standard", priceAdjustment: 0 },
      { name: "Double Beef (+15k)", priceAdjustment: 15000 },
    ],
    modifierGroupNames: ["Egg Doneness", "Spiciness Level"],
    recipeMenuId: "m-3",
    description: "Nasi hangat dengan irisan daging sapi empuk, sambal matah segar, dan telur onsen.",
    imageUrl: "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?q=80&w=600&auto=format&fit=crop",
    tenantId: "tenant-kitchen",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-17T00:00:00Z",
  },
  {
    id: "prod-109",
    name: "Nasi Ayam Sambal Matah",
    category: "Makanan",
    basePrice: 32000,
    cogsEstimate: 14000,
    grossMarginPercent: "56.3%",
    status: "ACTIVE",
    outletId: "ALL",
    outletName: "Semua Outlet",
    isAvailable: true,
    description: "Nasi hangat dengan ayam suwir berbumbu gurih dan sambal matah segar.",
    imageUrl: "https://images.unsplash.com/photo-1562967914-608f82629710?q=80&w=600&auto=format&fit=crop",
    tenantId: "tenant-kitchen",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-17T00:00:00Z",
  },
  {
    id: "prod-110",
    name: "Mie Goreng Jawa",
    category: "Makanan",
    basePrice: 28000,
    cogsEstimate: 11000,
    grossMarginPercent: "60.7%",
    status: "ACTIVE",
    outletId: "ALL",
    outletName: "Semua Outlet",
    isAvailable: true,
    description: "Mie telur tumis bumbu tradisional Jawa dengan suwiran ayam dan sayuran segar.",
    imageUrl: "https://images.unsplash.com/photo-1612927601601-6638404737ce?q=80&w=600&auto=format&fit=crop",
    tenantId: "tenant-kitchen",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-17T00:00:00Z",
  },
  {
    id: "prod-111",
    name: "Es Jeruk Peras",
    category: "Minuman",
    basePrice: 12000,
    cogsEstimate: 4000,
    grossMarginPercent: "66.7%",
    status: "ACTIVE",
    outletId: "ALL",
    outletName: "Semua Outlet",
    isAvailable: true,
    description: "Perasan jeruk segar asli dengan gula pasir cair dan es batu dingin.",
    imageUrl: "https://images.unsplash.com/photo-1613478223719-2ab802602423?q=80&w=600&auto=format&fit=crop",
    tenantId: "tenant-kitchen",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-17T00:00:00Z",
  },

  // 3. MANIS BAKERY (tenant-bakery) - Bakery & Dessert
  {
    id: "prod-104",
    name: "Butter Croissant",
    category: "Camilan",
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
    description: "Croissant renyah dengan aroma butter yang harum, cocok untuk teman ngopi.",
    imageUrl: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?q=80&w=600&auto=format&fit=crop",
    tenantId: "tenant-bakery",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-17T00:00:00Z",
  },
  {
    id: "prod-106",
    name: "Truffle Parmesan Fries",
    category: "Camilan",
    basePrice: 32000,
    cogsEstimate: 11200,
    grossMarginPercent: "65.0%",
    status: "ACTIVE",
    outletId: "ALL",
    outletName: "Semua Outlet",
    isAvailable: true,
    description: "Kentang goreng renyah dengan taburan keju parmesan asli dan minyak truffle.",
    imageUrl: "https://images.unsplash.com/photo-1585109649139-366815a0d713?q=80&w=600&auto=format&fit=crop",
    tenantId: "tenant-bakery",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-17T00:00:00Z",
  },
  {
    id: "prod-112",
    name: "Chocolate Croissant",
    category: "Camilan",
    basePrice: 24000,
    cogsEstimate: 9500,
    grossMarginPercent: "60.4%",
    status: "ACTIVE",
    outletId: "ALL",
    outletName: "Semua Outlet",
    isAvailable: true,
    description: "Pastry renyah berlapis dengan isian cokelat Belgia lumer di dalam.",
    imageUrl: "https://images.unsplash.com/photo-1608198093002-ad4e005484ec?q=80&w=600&auto=format&fit=crop",
    tenantId: "tenant-bakery",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-17T00:00:00Z",
  },
  {
    id: "prod-113",
    name: "Banana Bread Slice",
    category: "Hidangan Penutup",
    basePrice: 18000,
    cogsEstimate: 6500,
    grossMarginPercent: "63.9%",
    status: "ACTIVE",
    outletId: "ALL",
    outletName: "Semua Outlet",
    isAvailable: true,
    description: "Bolu pisang lembut panggang dengan aroma kayu manis dan kacang kenari.",
    imageUrl: "https://images.unsplash.com/photo-1596223575323-9ed5a4f664a7?q=80&w=600&auto=format&fit=crop",
    tenantId: "tenant-bakery",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-17T00:00:00Z",
  },

  // 4. WARUNG BU NARTI (tenant-tea) - Indonesian Food & Drinks
  {
    id: "prod-102",
    name: "Es Teh Peach",
    category: "Minuman",
    basePrice: 18000,
    cogsEstimate: 5000,
    grossMarginPercent: "72.2%",
    status: "ACTIVE",
    outletId: "ALL",
    outletName: "Semua Outlet",
    isAvailable: true,
    variants: [
      { name: "Regular", priceAdjustment: 0 },
      { name: "Large (+4k)", priceAdjustment: 4000 },
    ],
    recipeMenuId: "m-2",
    description: "Seduhan teh segar dingin dengan ekstrak buah peach manis alami.",
    imageUrl: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?q=80&w=600&auto=format&fit=crop",
    tenantId: "tenant-tea",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-17T00:00:00Z",
  },
  {
    id: "prod-114",
    name: "Nasi Ayam Kremes",
    category: "Makanan",
    basePrice: 28000,
    cogsEstimate: 12000,
    grossMarginPercent: "57.1%",
    status: "ACTIVE",
    outletId: "ALL",
    outletName: "Semua Outlet",
    isAvailable: true,
    description: "Nasi hangat dengan ayam goreng bumbu kuning dan kremesan renyah gurih.",
    imageUrl: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?q=80&w=600&auto=format&fit=crop",
    tenantId: "tenant-tea",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-17T00:00:00Z",
  },
  {
    id: "prod-115",
    name: "Tempe Mendoan (3 pcs)",
    category: "Camilan",
    basePrice: 12000,
    cogsEstimate: 4500,
    grossMarginPercent: "62.5%",
    status: "ACTIVE",
    outletId: "ALL",
    outletName: "Semua Outlet",
    isAvailable: true,
    description: "Tempe mendoan lembut hangat disajikan dengan sambal kecap rawit.",
    imageUrl: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?q=80&w=600&auto=format&fit=crop",
    tenantId: "tenant-tea",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-17T00:00:00Z",
  },
  {
    id: "prod-116",
    name: "Es Teh Manis Melati",
    category: "Minuman",
    basePrice: 6000,
    cogsEstimate: 1500,
    grossMarginPercent: "75.0%",
    status: "ACTIVE",
    outletId: "ALL",
    outletName: "Semua Outlet",
    isAvailable: true,
    description: "Seduhan teh wangi melati segar dengan gula pasir asli dan es batu.",
    imageUrl: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?q=80&w=600&auto=format&fit=crop",
    tenantId: "tenant-tea",
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
          const initialMap = new Map(INITIAL_PRODUCTS.map((p) => [p.id, p]));
          const customProducts = parsed.filter((p) => !initialMap.has(p.id));
          const updatedInitialProducts = INITIAL_PRODUCTS.map((initProd) => {
            const userVersion = parsed.find((p) => p.id === initProd.id);
            if (userVersion) {
              return {
                ...initProd,
                ...userVersion,
              };
            }
            return initProd;
          });
          setProducts([...updatedInitialProducts, ...customProducts]);
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
      tenantId: productData.tenantId || "tenant-ks",
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
