"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  IngredientItem,
  RecipeBOM,
  PurchaseOrder,
  StockAdjustmentLog,
  StockStatus,
  StockOpnameRecord,
  StockOpnameReason,
} from "@/types/inventory";
import {
  INITIAL_INGREDIENTS,
  INITIAL_RECIPES,
  INITIAL_PURCHASE_ORDERS,
  deductRecipeIngredients,
} from "@/features/inventory/inventory-data";
import { useOutlet } from "./OutletContext";
import { useActivityLog } from "./ActivityLogContext";
import { useNotifications } from "./NotificationContext";

interface InventoryContextType {
  ingredients: IngredientItem[];
  filteredIngredients: IngredientItem[];
  recipes: RecipeBOM[];
  purchaseOrders: PurchaseOrder[];
  filteredPurchaseOrders: PurchaseOrder[];
  logs: StockAdjustmentLog[];
  stockOpnames: StockOpnameRecord[];
  adjustStock: (
    ingredientId: string,
    delta: number,
    reason: StockAdjustmentLog["reason"],
    user?: string
  ) => void;
  recordStockOpname: (
    record: Omit<StockOpnameRecord, "id" | "opnameNumber" | "variance" | "varianceType" | "createdAt" | "status">
  ) => StockOpnameRecord;
  checkProductStockStatus: (productNameOrId: string) => { status: "SAFE" | "CRITICAL" | "OUT_OF_STOCK"; label?: string };
  simulateBOMDeduction: (menuId: string, quantity: number) => { success: boolean; message: string };
  upsertRecipe: (recipe: RecipeBOM) => void;
  deleteRecipe: (menuId: string) => void;
  createPurchaseOrder: (po: Omit<PurchaseOrder, "id" | "poNumber">) => void;
  receivePurchaseOrder: (poId: string) => void;
  resetInventoryData: () => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

const STORAGE_KEY_INGREDIENTS = "dagoeng_inventory_ingredients_v3";
const STORAGE_KEY_RECIPES = "dagoeng_inventory_recipes_v3";
const STORAGE_KEY_POS = "dagoeng_inventory_pos_v3";
const STORAGE_KEY_LOGS = "dagoeng_inventory_logs_v3";
const STORAGE_KEY_OPNAMES = "dagoeng_inventory_opnames_v1";

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const { activeOutletId, activeOutlet, isAllOutlets } = useOutlet();
  const { logActivity } = useActivityLog();
  const { addNotification } = useNotifications();

  const [ingredients, setIngredients] = useState<IngredientItem[]>(INITIAL_INGREDIENTS);
  const [recipes, setRecipes] = useState<RecipeBOM[]>(INITIAL_RECIPES);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(INITIAL_PURCHASE_ORDERS);
  const [logs, setLogs] = useState<StockAdjustmentLog[]>([]);
  const [stockOpnames, setStockOpnames] = useState<StockOpnameRecord[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const savedIng = localStorage.getItem(STORAGE_KEY_INGREDIENTS);
      const savedRec = localStorage.getItem(STORAGE_KEY_RECIPES);
      const savedPOs = localStorage.getItem(STORAGE_KEY_POS);
      const savedLogs = localStorage.getItem(STORAGE_KEY_LOGS);
      const savedOpnames = localStorage.getItem(STORAGE_KEY_OPNAMES);

      if (savedIng) setIngredients(JSON.parse(savedIng));
      if (savedRec) setRecipes(JSON.parse(savedRec));
      if (savedPOs) setPurchaseOrders(JSON.parse(savedPOs));
      if (savedLogs) setLogs(JSON.parse(savedLogs));
      if (savedOpnames) setStockOpnames(JSON.parse(savedOpnames));
    } catch (e) {
      console.error("Failed to load inventory state", e);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEY_INGREDIENTS, JSON.stringify(ingredients));
      localStorage.setItem(STORAGE_KEY_RECIPES, JSON.stringify(recipes));
      localStorage.setItem(STORAGE_KEY_POS, JSON.stringify(purchaseOrders));
      localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));
      localStorage.setItem(STORAGE_KEY_OPNAMES, JSON.stringify(stockOpnames));
    } catch (e) {
      console.error("Failed to save inventory state", e);
    }
  }, [ingredients, recipes, purchaseOrders, logs, stockOpnames, isInitialized]);

  // Scoped ingredients
  const filteredIngredients = ingredients.filter((ing) => {
    if (isAllOutlets) return true;
    return (ing as any).outletId === activeOutletId || !(ing as any).outletId;
  });

  const filteredPurchaseOrders = purchaseOrders.filter((po) => {
    if (isAllOutlets) return true;
    return (po as any).outletId === activeOutletId || !(po as any).outletId;
  });

  // Check product stock status based on recipe ingredients
  const checkProductStockStatus = (
    productNameOrId: string
  ): { status: "SAFE" | "CRITICAL" | "OUT_OF_STOCK"; label?: string } => {
    const term = productNameOrId.toLowerCase().trim();
    const recipe = recipes.find(
      (r) =>
        r.menuId.toLowerCase() === term ||
        r.menuName.toLowerCase() === term ||
        r.menuName.toLowerCase().includes(term) ||
        term.includes(r.menuName.toLowerCase())
    );

    if (!recipe) return { status: "SAFE" };

    let hasCritical = false;
    for (const rIng of recipe.ingredients) {
      const actual = ingredients.find((i) => i.id === rIng.ingredientId || i.name.toLowerCase() === rIng.ingredientName.toLowerCase());
      if (actual) {
        if (actual.stockNumber <= 0) {
          return { status: "OUT_OF_STOCK", label: "Habis" };
        }
        if (actual.status === "CRITICAL" || actual.stockNumber <= actual.min * 0.4) {
          hasCritical = true;
        }
      }
    }

    if (hasCritical) {
      return { status: "CRITICAL", label: "Stok Menipis" };
    }

    return { status: "SAFE" };
  };

  const adjustStock = (
    ingredientId: string,
    delta: number,
    reason: StockAdjustmentLog["reason"],
    userName: string = "Staff Inventory"
  ) => {
    const target = ingredients.find((i) => i.id === ingredientId);
    if (!target) return;

    const prevStock = target.stockNumber;
    const newStock = Math.max(0, Number((target.stockNumber + Number(delta)).toFixed(3)));
    const nextStatus: StockStatus =
      newStock <= 0 ? "CRITICAL" : newStock <= target.min * 0.4 ? "CRITICAL" : newStock <= target.min ? "LOW" : "SAFE";

    setIngredients((prev) =>
      prev.map((i) =>
        i.id === ingredientId
          ? {
              ...i,
              stockNumber: newStock,
              status: nextStatus,
              lastUpdated: "Baru saja",
            }
          : i
      )
    );

    const newLog: StockAdjustmentLog = {
      id: `log-${Date.now()}-${ingredientId}`,
      ingredientId: target.id,
      ingredientName: target.name,
      delta: Number(delta),
      previousStock: prevStock,
      currentStock: newStock,
      reason,
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      user: userName,
    };
    setLogs((prev) => [newLog, ...prev]);

    // Send Alert Notification if stock becomes critical
    if (nextStatus === "CRITICAL") {
      addNotification({
        type: "CRITICAL_STOCK",
        title: "Peringatan Stok Kritis!",
        detail: `${target.name} tersisa ${newStock} ${target.unit} (di bawah batas minimum ${target.min} ${target.unit}).`,
        relatedModule: "INVENTORY",
        actionUrl: "/inventory",
        outletId: activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr",
        outletName: activeOutlet?.name || "Singaraja",
      });
    }

    // Comprehensive Activity Log
    logActivity({
      module: "INVENTORY",
      action: "STOCK_ADJUSTMENT",
      recordId: target.id,
      previousValue: `Stok: ${prevStock} ${target.unit}`,
      newValue: `Stok: ${newStock} ${target.unit} (${delta >= 0 ? "+" : ""}${delta} ${target.unit})`,
      description: `Penyesuaian stok bahan "${target.name}" (${prevStock} ➔ ${newStock})`,
      reason: reason || "Penyesuaian stok opname / masuk",
      status: nextStatus === "CRITICAL" ? "WARNING" : "SUCCESS",
    });
  };

  const simulateBOMDeduction = (menuIdOrName: string, quantity: number) => {
    const term = menuIdOrName.toLowerCase().trim();
    const recipe = recipes.find(
      (r) =>
        r.menuId.toLowerCase() === term ||
        r.menuName.toLowerCase() === term ||
        r.menuName.toLowerCase().includes(term) ||
        term.includes(r.menuName.toLowerCase())
    );
    if (!recipe) return { success: false, message: "Menu tidak ditemukan dalam database resep BOM" };

    const { updatedStock, logs: deductionLogs } = deductRecipeIngredients(ingredients, recipe, quantity);
    setIngredients(updatedStock);
    setLogs((prev) => [...deductionLogs, ...prev]);

    return {
      success: true,
      message: `Simulasi Berhasil: ${quantity}x "${recipe.menuName}" otomatis memotong ${recipe.ingredients.length} bahan baku!`,
    };
  };

  const createPurchaseOrder = (poData: Omit<PurchaseOrder, "id" | "poNumber">) => {
    const newPO: PurchaseOrder = {
      ...poData,
      id: `po-${Date.now()}`,
      poNumber: `PO-DAGO-2026-${String(purchaseOrders.length + 1).padStart(3, "0")}`,
    };
    setPurchaseOrders((prev) => [newPO, ...prev]);

    logActivity({
      module: "INVENTORY",
      action: "CREATE_PURCHASE_ORDER",
      recordId: newPO.poNumber,
      newValue: `Supplier: ${newPO.supplier}, Total: Rp ${newPO.total.toLocaleString()}`,
      description: `Penerbitan PO ${newPO.poNumber} ke ${newPO.supplier}`,
      reason: newPO.notes || "Restock bahan baku mingguan",
      status: "SUCCESS",
    });
  };

  const receivePurchaseOrder = (poId: string) => {
    const po = purchaseOrders.find((p) => p.id === poId);
    if (!po) return;

    setIngredients((prev) =>
      prev.map((ing) => {
        const poItem = po.items.find((i) => i.ingredientId === ing.id);
        if (!poItem) return ing;
        const newStock = ing.stockNumber + poItem.quantity;
        return {
          ...ing,
          stockNumber: newStock,
          status: newStock <= ing.min * 0.4 ? "CRITICAL" : newStock <= ing.min ? "LOW" : "SAFE",
          lastUpdated: "Baru saja",
        };
      })
    );

    setPurchaseOrders((prev) =>
      prev.map((p) => (p.id === poId ? { ...p, status: "RECEIVED" } : p))
    );

    logActivity({
      module: "INVENTORY",
      action: "RECEIVE_PURCHASE_ORDER",
      recordId: po.poNumber,
      previousValue: "Status: SENT",
      newValue: "Status: RECEIVED (Stok Gudang Bertambah)",
      description: `Penerimaan barang fisik untuk PO ${po.poNumber} dari ${po.supplier}`,
      reason: "Barang tiba dan terverifikasi di gudang",
      status: "SUCCESS",
    });
  };

  const upsertRecipe = (newRecipe: RecipeBOM) => {
    setRecipes((prev) => {
      const idx = prev.findIndex((r) => r.menuId === newRecipe.menuId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = newRecipe;
        return next;
      }
      return [newRecipe, ...prev];
    });

    logActivity({
      module: "INVENTORY",
      action: "RECIPE_UPSERT",
      recordId: newRecipe.menuId,
      newValue: `${newRecipe.menuName}`,
      description: `Formula BOM resep "${newRecipe.menuName}" berhasil disimpan / diperbarui`,
      status: "SUCCESS",
    });
  };

  const deleteRecipe = (menuId: string) => {
    setRecipes((prev) => prev.filter((r) => r.menuId !== menuId));
  };

  const recordStockOpname = (
    record: Omit<StockOpnameRecord, "id" | "opnameNumber" | "variance" | "varianceType" | "createdAt" | "status">
  ): StockOpnameRecord => {
    const sysStock = Number(record.systemStock);
    const physStock = Number(record.physicalStock);
    const variance = physStock - sysStock;
    const varianceType: "SURPLUS" | "DEFICIT" | "MATCH" =
      variance > 0 ? "SURPLUS" : variance < 0 ? "DEFICIT" : "MATCH";

    const newRecord: StockOpnameRecord = {
      ...record,
      systemStock: sysStock,
      physicalStock: physStock,
      id: `opn-${Date.now()}`,
      opnameNumber: `SOP-${new Date().toISOString().slice(0, 7).replace("-", "")}-${Date.now().toString().slice(-4)}`,
      variance,
      varianceType,
      status: "APPLIED",
      createdAt: new Date().toISOString(),
    };

    setStockOpnames((prev) => [newRecord, ...prev]);

    // Update ingredient actual physical stock
    setIngredients((prev) =>
      prev.map((ing) => {
        if (ing.id === record.ingredientId) {
          const newStatus: "CRITICAL" | "LOW" | "SAFE" =
            physStock <= ing.min ? "CRITICAL" : physStock <= ing.min * 1.5 ? "LOW" : "SAFE";
          return {
            ...ing,
            stockNumber: physStock,
            status: newStatus,
            lastUpdated: "Hari ini (Stock Opname)",
          };
        }
        return ing;
      })
    );

    // Record adjustment audit log
    const auditLog: StockAdjustmentLog = {
      id: `log-opn-${Date.now()}`,
      ingredientId: record.ingredientId,
      ingredientName: record.ingredientName,
      delta: variance,
      previousStock: sysStock,
      currentStock: physStock,
      reason: "OPNAME_HILANG_RUSAK",
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      user: record.performedBy || "Staff Inventory",
    };
    setLogs((prev) => [auditLog, ...prev]);

    logActivity({
      module: "INVENTORY",
      action: "STOCK_ADJUSTMENT",
      recordId: newRecord.opnameNumber,
      previousValue: `${record.ingredientName}: ${sysStock} ${record.unit}`,
      newValue: `${record.ingredientName}: ${physStock} ${record.unit} (Selisih: ${variance > 0 ? `+${variance}` : variance})`,
      description: `Pencatatan Stock Opname ${record.ingredientName}: Fisik=${physStock}, Sistem=${sysStock}, Alasan=${record.reason}`,
      reason: `Stock Opname: ${record.reason} ${record.reasonNotes ? `(${record.reasonNotes})` : ""}`,
      status: "SUCCESS",
    });

    addNotification({
      type: "SYSTEM_ALERT",
      title: "Penyesuaian Stock Opname Selesai",
      detail: `Stock Opname #${newRecord.opnameNumber} untuk ${record.ingredientName} (${variance >= 0 ? `+${variance}` : variance} ${record.unit}) berhasil dicatat.`,
      relatedModule: "INVENTORY",
      actionUrl: "/inventory",
      outletId: activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr",
      outletName: activeOutlet?.name || "Singaraja",
    });

    return newRecord;
  };

  const resetInventoryData = () => {
    setIngredients(INITIAL_INGREDIENTS);
    setRecipes(INITIAL_RECIPES);
    setPurchaseOrders(INITIAL_PURCHASE_ORDERS);
    setLogs([]);
    setStockOpnames([]);
    try {
      localStorage.removeItem(STORAGE_KEY_INGREDIENTS);
      localStorage.removeItem(STORAGE_KEY_RECIPES);
      localStorage.removeItem(STORAGE_KEY_POS);
      localStorage.removeItem(STORAGE_KEY_LOGS);
      localStorage.removeItem(STORAGE_KEY_OPNAMES);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <InventoryContext.Provider
      value={{
        ingredients,
        filteredIngredients,
        recipes,
        purchaseOrders,
        filteredPurchaseOrders,
        logs,
        stockOpnames,
        adjustStock,
        recordStockOpname,
        checkProductStockStatus,
        simulateBOMDeduction,
        upsertRecipe,
        deleteRecipe,
        createPurchaseOrder,
        receivePurchaseOrder,
        resetInventoryData,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error("useInventory must be used within an InventoryProvider");
  }
  return context;
}
