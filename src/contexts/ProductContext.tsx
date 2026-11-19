"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { MasterProduct } from "@/types/product";
import { useAuth } from "./AuthContext";
import { useOutlet } from "./OutletContext";
import { useActivityLog } from "./ActivityLogContext";
import {
  ensureGlobalOutboxAutoFlush,
  flushOutbox,
  getOutboxItems,
  OUTBOX_FLUSHED_EVENT,
  reconcileCollectionWithOutbox,
  syncWithOutbox,
} from "@/lib/sync-outbox";
import { INITIAL_PRODUCTS } from "@/lib/master-data-defaults";
export { INITIAL_PRODUCTS } from "@/lib/master-data-defaults";

interface ProductContextType {
  products: MasterProduct[];
  filteredProducts: MasterProduct[];
  categories: string[];
  addProduct: (
    product: Omit<MasterProduct, "id" | "createdAt" | "updatedAt" | "grossMarginPercent">
  ) => MasterProduct;
  addCategory: (categoryName: string) => void;
  deleteCategory?: (category: string) => void;
  updateProduct: (id: string, updates: Partial<MasterProduct>, reason?: string) => void;
  toggleProductStatus: (id: string) => void;
  deleteProduct: (id: string) => void;
  resetProductData: () => void;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);
const STORAGE_KEY_PRODUCTS = "dagoeng_master_products_v1";
const STORAGE_KEY_CATEGORIES = "dagoeng_master_categories_v1";

function reconcileCategoriesWithOutbox(serverCategories: readonly string[]): string[] {
  const outbox = getOutboxItems().filter(
    (item) =>
      item.endpoint === "/api/products" ||
      item.endpoint === "/api/products?action=RESET_PRODUCTS"
  );

  let next = new Set<string>(serverCategories);
  for (const item of outbox) {
    const action = item.payload?.action;
    if (action === "RESET_PRODUCTS") {
      next = new Set<string>();
    } else if (action === "ADD_CATEGORY") {
      const cat = String(item.payload?.categoryName || "").trim();
      if (cat) next.add(cat);
    } else if (action === "DELETE_CATEGORY") {
      const cat = String(item.payload?.categoryName || item.payload?.category || "").trim();
      if (cat) next.delete(cat);
    }
  }

  return Array.from(next);
}

export function ProductProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeOutletId, isAllOutlets } = useOutlet();
  const { logActivity } = useActivityLog();
  const [products, setProducts] = useState<MasterProduct[]>(INITIAL_PRODUCTS);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PRODUCTS);
      const savedCats = localStorage.getItem(STORAGE_KEY_CATEGORIES);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        setProducts(Array.isArray(parsed) ? parsed : INITIAL_PRODUCTS);
      } else {
        setProducts(INITIAL_PRODUCTS);
      }
      if (savedCats !== null) {
        const parsedCats = JSON.parse(savedCats);
        setCustomCategories(Array.isArray(parsedCats) ? parsedCats : []);
      } else {
        setCustomCategories([]);
      }
    } catch (e) {
      console.error("Failed to load products", e);
    } finally {
      setIsInitialized(true);
    }
    ensureGlobalOutboxAutoFlush();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const hydrateProducts = async () => {
      await flushOutbox().catch(() => {});
      if (cancelled) return;
      try {
        const res = await fetch("/api/products");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled || !data) return;

        if (Array.isArray(data.products)) {
          const hasPendingReset = getOutboxItems().some(
            (item) =>
              item.payload?.action === "RESET_PRODUCTS" &&
              (item.endpoint === "/api/products" ||
                item.endpoint === "/api/products?action=RESET_PRODUCTS")
          );
          const baseServerProducts: MasterProduct[] = hasPendingReset
            ? INITIAL_PRODUCTS
            : data.products;
          setProducts((prev) =>
            reconcileCollectionWithOutbox<MasterProduct>({
              serverItems: baseServerProducts,
              localItems: prev,
              endpoint: "/api/products",
              getId: (p) => p.id,
            })
          );
        }

        if (Array.isArray(data.customCategories)) {
          setCustomCategories(reconcileCategoriesWithOutbox(data.customCategories));
        }
      } catch {}
    };

    void hydrateProducts();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY_PRODUCTS) {
        if (event.newValue === null) {
          setProducts(INITIAL_PRODUCTS);
          return;
        }
        try {
          const parsed = JSON.parse(event.newValue);
          if (Array.isArray(parsed)) setProducts(parsed);
        } catch {}
      } else if (event.key === STORAGE_KEY_CATEGORIES) {
        if (event.newValue === null) {
          setCustomCategories([]);
          return;
        }
        try {
          const parsed = JSON.parse(event.newValue);
          if (Array.isArray(parsed)) setCustomCategories(parsed);
        } catch {}
      }
    };

    const handleOutboxFlushed = () => {
      void hydrateProducts();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(OUTBOX_FLUSHED_EVENT, handleOutboxFlushed);

    return () => {
      cancelled = true;
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(OUTBOX_FLUSHED_EVENT, handleOutboxFlushed);
    };
  }, [user?.id]);

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

  const deleteCategory = (category: string) => {
    const trimmed = category.trim();
    if (!trimmed) return;
    setCustomCategories((prev) => prev.filter((c) => c !== trimmed));

    logActivity({
      module: "MENU",
      action: "DELETE_CATEGORY",
      recordId: `cat-${trimmed}`,
      previousValue: trimmed,
      newValue: "DELETED",
      description: `Penghapusan kategori menu kustom: "${trimmed}"`,
      reason: "Penyesuaian daftar kategori menu",
      status: "SUCCESS",
    });

    syncWithOutbox({
      id: `cat-${trimmed}`,
      endpoint: "/api/products",
      method: "DELETE",
      payload: { action: "DELETE_CATEGORY", categoryName: trimmed },
    }).catch(() => {});
  };

  const categories = Array.from(
    new Set([...products.map((p) => p.category), ...customCategories])
  );

  const filteredProducts = products.filter((p) => {
    if (isAllOutlets) return true;
    return p.outletId === "ALL" || p.outletId === activeOutletId || !p.outletId;
  });

  const addProduct = (
    productData: Omit<MasterProduct, "id" | "createdAt" | "updatedAt" | "grossMarginPercent">
  ): MasterProduct => {
    const nowIso = new Date().toISOString();
    const margin =
      (
        ((productData.basePrice - productData.cogsEstimate) / (productData.basePrice || 1)) *
        100
      ).toFixed(1) + "%";

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
      isCreate: true,
      payload: { id: newProduct.id, product: newProduct },
    }).catch(() => {});

    return newProduct;
  };

  const updateProduct = (id: string, updates: Partial<MasterProduct>, reason?: string) => {
    const existing = products.find((p) => p.id === id);
    if (!existing) return;

    const prevStr = `Harga: Rp ${existing.basePrice.toLocaleString()}, Status: ${existing.status}`;
    const newPrice = updates.basePrice !== undefined ? updates.basePrice : existing.basePrice;
    const newCogs =
      updates.cogsEstimate !== undefined ? updates.cogsEstimate : existing.cogsEstimate;
    const margin = (((newPrice - newCogs) / (newPrice || 1)) * 100).toFixed(1) + "%";

    const mergedProduct: MasterProduct = {
      ...existing,
      ...updates,
      grossMarginPercent: margin,
      updatedAt: new Date().toISOString(),
    };

    setProducts((prev) => prev.map((p) => (p.id === id ? mergedProduct : p)));

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
    setCustomCategories([]);
    try {
      localStorage.removeItem(STORAGE_KEY_PRODUCTS);
      localStorage.removeItem(STORAGE_KEY_CATEGORIES);
    } catch (e) {
      console.error(e);
    }
    if (typeof window !== "undefined") {
      syncWithOutbox({
        id: "products-reset",
        endpoint: "/api/products?action=RESET_PRODUCTS",
        method: "DELETE",
        payload: { action: "RESET_PRODUCTS" },
      }).catch(() => {});
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
        deleteCategory,
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
