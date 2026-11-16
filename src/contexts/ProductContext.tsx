"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { MasterProduct } from "@/types/product";
import { useOutlet } from "./OutletContext";
import { useActivityLog } from "./ActivityLogContext";
import { syncWithOutbox } from "@/lib/sync-outbox";
import { INITIAL_PRODUCTS } from "@/lib/master-data-defaults";
export { INITIAL_PRODUCTS } from "@/lib/master-data-defaults";

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

    // Hydrate authoritative products from server storage (V-06)
    if (typeof window !== "undefined") {
      fetch("/api/products")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && Array.isArray(data.products) && data.products.length > 0) {
            setProducts((prev) => {
              const serverMap = new Map(data.products.map((p: MasterProduct) => [p.id, p]));
              const localCustom = prev.filter((p) => !serverMap.has(p.id));
              return [...data.products, ...localCustom];
            });
          }
          if (data && Array.isArray(data.customCategories) && data.customCategories.length > 0) {
            setCustomCategories((prev) => {
              const merged = new Set([...prev, ...data.customCategories]);
              return Array.from(merged);
            });
          }
        })
        .catch(() => {});
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
      syncWithOutbox({
        id: `cat-${trimmed}`,
        endpoint: "/api/products",
        method: "POST",
        payload: { action: "ADD_CATEGORY", categoryName: trimmed },
      }).catch(() => {});
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

    syncWithOutbox({
      id: newProduct.id,
      endpoint: "/api/products",
      method: "POST",
      payload: { product: newProduct },
    }).catch(() => {});

    return newProduct;
  };

  const updateProduct = (id: string, updates: Partial<MasterProduct>, reason?: string) => {
    const existing = products.find((p) => p.id === id);
    if (!existing) return;

    const prevStr = `Harga: Rp ${existing.basePrice.toLocaleString()}, Status: ${existing.status}`;
    const newPrice = updates.basePrice !== undefined ? updates.basePrice : existing.basePrice;
    const newCogs = updates.cogsEstimate !== undefined ? updates.cogsEstimate : existing.cogsEstimate;
    const margin = (((newPrice - newCogs) / (newPrice || 1)) * 100).toFixed(1) + "%";

    const mergedProduct: MasterProduct = {
      ...existing,
      ...updates,
      grossMarginPercent: margin,
      updatedAt: new Date().toISOString(),
    };

    setProducts((prev) =>
      prev.map((p) => (p.id === id ? mergedProduct : p))
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

    syncWithOutbox({
      id,
      endpoint: "/api/products",
      method: "PUT",
      payload: { id, updates },
    }).catch(() => {});
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

    syncWithOutbox({
      id,
      endpoint: "/api/products",
      method: "DELETE",
      payload: { id },
    }).catch(() => {});
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
