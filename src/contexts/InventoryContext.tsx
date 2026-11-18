"use client";

import React, { createContext, useContext, useEffect, useRef } from "react";
import type {
  IngredientItem,
  PurchaseOrder,
  RecipeBOM,
  StockAdjustmentLog,
  StockOpnameRecord,
  StockStatus,
} from "@/types/inventory";
import {
  deductOrderItemsBOM,
  recordOrderWasteItemsBOM,
  restoreOrderItemsBOM,
  type OrderItemBOMInput,
} from "@/features/inventory/inventory-data";
import type { InventoryCommand } from "@/lib/domain-sync-types";
import { useSyncedDomain } from "@/lib/use-synced-domain";
import {
  applyInventoryCommand,
  computeStockStatus,
  inventoryDomainSpec,
  inventorySyncClient,
  STORAGE_KEY_INGREDIENTS,
  STORAGE_KEY_LOGS,
  STORAGE_KEY_OPNAMES,
  STORAGE_KEY_POS,
  STORAGE_KEY_RECIPES,
} from "@/lib/sync-domains/inventory-spec";
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
  filteredLogs: StockAdjustmentLog[];
  stockOpnames: StockOpnameRecord[];
  filteredStockOpnames: StockOpnameRecord[];
  adjustStock: (
    ingredientId: string,
    delta: number,
    reason: StockAdjustmentLog["reason"],
    user?: string
  ) => void;
  recordStockOpname: (
    record: Omit<
      StockOpnameRecord,
      "id" | "opnameNumber" | "variance" | "varianceType" | "createdAt" | "status"
    >
  ) => StockOpnameRecord;
  checkProductStockStatus: (
    productNameOrId: string
  ) => { status: "SAFE" | "CRITICAL" | "OUT_OF_STOCK"; label?: string };
  simulateBOMDeduction: (
    menuId: string,
    quantity: number,
    modifiers?: string[]
  ) => { success: boolean; message: string };
  deductOrderBOM: (
    items: OrderItemBOMInput[]
  ) => { success: boolean; deductedCount: number };
  restoreOrderBOM: (
    items: OrderItemBOMInput[],
    orderNumber?: string
  ) => { success: boolean; restoredCount: number };
  recordOrderWasteBOM: (
    items: OrderItemBOMInput[],
    needsDeduction: boolean,
    orderNumber?: string
  ) => { success: boolean; wasteCount: number };
  upsertRecipe: (recipe: RecipeBOM) => void;
  deleteRecipe: (menuId: string) => void;
  createPurchaseOrder: (po: Omit<PurchaseOrder, "id" | "poNumber">) => void;
  receivePurchaseOrder: (poId: string) => void;
  resetInventoryData: () => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

let inventoryOpSeq = 0;
function nextInventoryOpId(prefix: string): string {
  inventoryOpSeq += 1;
  return `${prefix}-${Date.now()}-${inventoryOpSeq}-${Math.random().toString(36).slice(2, 6)}`;
}

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const { activeOutletId, activeOutlet, isAllOutlets } = useOutlet();
  const { logActivity } = useActivityLog();
  const { addNotification } = useNotifications();

  const [invState, mutateInventory] = useSyncedDomain(inventorySyncClient, {
    pollMs: 5000,
  });

  const { ingredients, recipes, purchaseOrders, logs, stockOpnames } = invState;

  const ingredientsRef = useRef<IngredientItem[]>(ingredients);
  const recipesRef = useRef<RecipeBOM[]>(recipes);
  ingredientsRef.current = ingredients;
  recipesRef.current = recipes;

  useEffect(() => {
    if (process.env.NODE_ENV === "test") {
      inventorySyncClient.reloadFromStorage();
    }
  }, []);

  const filteredIngredients = ingredients.filter((ing) => {
    if (isAllOutlets) return true;
    const ingOutletId = (ing as { outletId?: string }).outletId;
    return ingOutletId === activeOutletId || !ingOutletId;
  });

  const filteredPurchaseOrders = purchaseOrders.filter((po) => {
    if (isAllOutlets) return true;
    const poOutletId = (po as { outletId?: string }).outletId;
    return poOutletId === activeOutletId || !poOutletId;
  });

  const filteredStockOpnames = stockOpnames.filter((opn) => {
    if (isAllOutlets) return true;
    return opn.outletId === activeOutletId || !opn.outletId;
  });

  const filteredIngIds = new Set(filteredIngredients.map((i) => i.id));
  const filteredLogs = logs.filter((log) => {
    if (isAllOutlets) return true;
    const logOutletId = (log as { outletId?: string }).outletId;
    if (logOutletId) return logOutletId === activeOutletId;
    return filteredIngIds.has(log.ingredientId);
  });

  const checkProductStockStatus = (
    productNameOrId: string
  ): { status: "SAFE" | "CRITICAL" | "OUT_OF_STOCK"; label?: string } => {
    const term = productNameOrId.toLowerCase().trim();
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

    const currentRecipes = recipesRef.current;
    const currentIngredients = ingredientsRef.current;

    let recipe = currentRecipes.find(
      (r) =>
        r.menuId.toLowerCase() === term ||
        r.menuName.toLowerCase() === term
    );

    if (!recipe) {
      for (const [recipeId, aliases] of Object.entries(aliasMap)) {
        if (aliases.some((al) => al === term || term.includes(al) || al.includes(term))) {
          recipe = currentRecipes.find((r) => r.menuId === recipeId);
          if (recipe) break;
        }
      }
    }

    if (!recipe) {
      recipe = currentRecipes.find(
        (r) =>
          r.menuName.toLowerCase().includes(term) ||
          term.includes(r.menuName.toLowerCase())
      );
    }

    if (!recipe) return { status: "SAFE" };

    let hasCritical = false;
    for (const rIng of recipe.ingredients) {
      const actual = currentIngredients.find(
        (i) =>
          i.id === rIng.ingredientId ||
          i.name.toLowerCase() === rIng.ingredientName.toLowerCase()
      );
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
    const target = ingredientsRef.current.find((i) => i.id === ingredientId);
    if (!target) return;

    const numericDelta = Number(delta);
    const prevStock = target.stockNumber;
    const newStock = Math.max(0, +(prevStock + numericDelta).toFixed(3));
    const nextStatus: StockStatus = computeStockStatus(newStock, target.min);
    const opId = nextInventoryOpId("inv-adj");

    const newLog: StockAdjustmentLog = {
      id: `log-${Date.now()}-${inventoryOpSeq}-${ingredientId}`,
      ingredientId: target.id,
      ingredientName: target.name,
      delta: numericDelta,
      previousStock: prevStock,
      currentStock: newStock,
      reason,
      timestamp: new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      user: userName,
    };

    const command: InventoryCommand = {
      op: "ADJUST_STOCK",
      opId,
      ingredientId,
      delta: numericDelta,
      log: newLog,
    };

    ingredientsRef.current = ingredientsRef.current.map((i) =>
      i.id === ingredientId
        ? {
            ...i,
            stockNumber: newStock,
            status: nextStatus,
            lastUpdated: "Baru saja",
          }
        : i
    );

    mutateInventory((prev) => applyInventoryCommand(prev, command), {
      id: opId,
      isCreate: true,
      command,
    });

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

    logActivity({
      module: "INVENTORY",
      action: "STOCK_ADJUSTMENT",
      recordId: target.id,
      previousValue: `Stok: ${prevStock} ${target.unit}`,
      newValue: `Stok: ${newStock} ${target.unit} (${numericDelta >= 0 ? "+" : ""}${numericDelta} ${target.unit})`,
      description: `Penyesuaian stok bahan "${target.name}" (${prevStock} ➔ ${newStock})`,
      reason: reason || "Penyesuaian stok opname / masuk",
      status: nextStatus === "CRITICAL" ? "WARNING" : "SUCCESS",
    });
  };

  const deductOrderBOM = (items: OrderItemBOMInput[]) => {
    const { updatedStock, logs: deductionLogs, deductedCount } = deductOrderItemsBOM(
      ingredientsRef.current,
      recipesRef.current,
      items
    );
    if (deductedCount > 0) {
      ingredientsRef.current = updatedStock;
      const deltas = deductionLogs
        .filter((l) => l.delta !== 0)
        .map((l) => ({ ingredientId: l.ingredientId, delta: l.delta }));
      const opId = nextInventoryOpId("inv-bom-deduct");
      const command: InventoryCommand = {
        op: "APPLY_BOM_DELTAS",
        opId,
        deltas,
        logs: deductionLogs,
      };
      mutateInventory((prev) => applyInventoryCommand(prev, command), {
        id: opId,
        isCreate: true,
        command,
      });
    }
    return { success: deductedCount > 0, deductedCount };
  };

  const restoreOrderBOM = (items: OrderItemBOMInput[], orderNumber?: string) => {
    const { updatedStock, logs: restoreLogs, restoredCount } = restoreOrderItemsBOM(
      ingredientsRef.current,
      recipesRef.current,
      items,
      orderNumber
    );
    if (restoredCount > 0) {
      ingredientsRef.current = updatedStock;
      const deltas = restoreLogs
        .filter((l) => l.delta !== 0)
        .map((l) => ({ ingredientId: l.ingredientId, delta: l.delta }));
      const opId = nextInventoryOpId("inv-bom-restore");
      const command: InventoryCommand = {
        op: "APPLY_BOM_DELTAS",
        opId,
        deltas,
        logs: restoreLogs,
      };
      mutateInventory((prev) => applyInventoryCommand(prev, command), {
        id: opId,
        isCreate: true,
        command,
      });
      if (restoreLogs.length > 0) {
        logActivity({
          module: "INVENTORY",
          action: "STOCK_ADJUSTMENT",
          recordId: orderNumber || "POS-RESTORE",
          previousValue: `${restoreLogs.length} bahan terpakai`,
          newValue: restoreLogs
            .map((l) => `${l.ingredientName} (+${l.delta})`)
            .join(", "),
          description: `Pengembalian stok bahan pesanan ${orderNumber || ""} yang dibatalkan sebelum dimasak`,
          reason: "RETURN_TO_SUPPLIER",
          status: "SUCCESS",
        });
      }
    }
    return { success: restoredCount > 0, restoredCount };
  };

  const recordOrderWasteBOM = (
    items: OrderItemBOMInput[],
    needsDeduction: boolean,
    orderNumber?: string
  ) => {
    const { updatedStock, logs: wasteLogs, wasteCount } = recordOrderWasteItemsBOM(
      ingredientsRef.current,
      recipesRef.current,
      items,
      needsDeduction,
      orderNumber
    );
    if (wasteCount > 0) {
      if (needsDeduction) {
        ingredientsRef.current = updatedStock;
      }
      const deltas = needsDeduction
        ? wasteLogs
            .filter((l) => l.delta !== 0)
            .map((l) => ({ ingredientId: l.ingredientId, delta: l.delta }))
        : [];
      if (deltas.length > 0 || wasteLogs.length > 0) {
        const opId = nextInventoryOpId("inv-bom-waste");
        const command: InventoryCommand = {
          op: "APPLY_BOM_DELTAS",
          opId,
          deltas,
          logs: wasteLogs,
        };
        mutateInventory((prev) => applyInventoryCommand(prev, command), {
          id: opId,
          isCreate: true,
          command,
        });
      }
      if (wasteLogs.length > 0) {
        logActivity({
          module: "INVENTORY",
          action: "STOCK_WASTE_RECORDED",
          recordId: orderNumber || "POS-WASTE",
          newValue: wasteLogs.map((l) => `${l.ingredientName}: ${l.user}`).join(", "),
          description: `Pencatatan limbah dapur pesanan ${orderNumber || ""} yang dibatalkan setelah dimasak`,
          reason: "WASTE",
          status: "WARNING",
        });
      }
    }
    return { success: wasteCount > 0, wasteCount };
  };

  const simulateBOMDeduction = (
    menuIdOrName: string,
    quantity: number,
    modifiers?: string[]
  ) => {
    const { updatedStock, logs: deductionLogs, deductedCount } = deductOrderItemsBOM(
      ingredientsRef.current,
      recipesRef.current,
      [{ productName: menuIdOrName, quantity, modifiers }]
    );
    if (deductedCount > 0) {
      ingredientsRef.current = updatedStock;
      const deltas = deductionLogs
        .filter((l) => l.delta !== 0)
        .map((l) => ({ ingredientId: l.ingredientId, delta: l.delta }));
      const opId = nextInventoryOpId("inv-bom-sim");
      const command: InventoryCommand = {
        op: "APPLY_BOM_DELTAS",
        opId,
        deltas,
        logs: deductionLogs,
      };
      mutateInventory((prev) => applyInventoryCommand(prev, command), {
        id: opId,
        isCreate: true,
        command,
      });
      return {
        success: true,
        message: `${quantity}x "${menuIdOrName}" memotong ${deductionLogs.length} bahan`,
      };
    }
    return { success: false, message: "Menu tidak ditemukan dalam database resep BOM" };
  };

  const createPurchaseOrder = (poData: Omit<PurchaseOrder, "id" | "poNumber">) => {
    inventoryOpSeq += 1;
    const newPO: PurchaseOrder = {
      ...poData,
      id: `po-${Date.now()}-${inventoryOpSeq}`,
      poNumber: `PO-DAGO-2026-${String(purchaseOrders.length + 1).padStart(3, "0")}`,
    };
    const command: InventoryCommand = { op: "CREATE_PO", po: newPO };
    mutateInventory((prev) => applyInventoryCommand(prev, command), {
      id: `inv-po-create-${newPO.id}`,
      isCreate: true,
      command,
    });

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
    if (!po || po.status === "RECEIVED") return;

    const command: InventoryCommand = { op: "RECEIVE_PO", poId };
    const nextLocal = applyInventoryCommand(
      {
        ...invState,
        ingredients: ingredientsRef.current,
        recipes: recipesRef.current,
      },
      command
    );
    ingredientsRef.current = nextLocal.ingredients;

    mutateInventory((prev) => applyInventoryCommand(prev, command), {
      id: `inv-po-receive-${poId}`,
      command,
    });

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
    const idx = recipesRef.current.findIndex((r) => r.menuId === newRecipe.menuId);
    recipesRef.current =
      idx >= 0
        ? recipesRef.current.map((r, i) => (i === idx ? newRecipe : r))
        : [newRecipe, ...recipesRef.current];

    const command: InventoryCommand = { op: "UPSERT_RECIPE", recipe: newRecipe };
    mutateInventory((prev) => applyInventoryCommand(prev, command), {
      id: `inv-recipe-upsert-${newRecipe.menuId}`,
      command,
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
    recipesRef.current = recipesRef.current.filter((r) => r.menuId !== menuId);
    const command: InventoryCommand = { op: "DELETE_RECIPE", menuId };
    mutateInventory((prev) => applyInventoryCommand(prev, command), {
      id: `inv-recipe-delete-${menuId}`,
      command,
    });
  };

  const recordStockOpname = (
    record: Omit<
      StockOpnameRecord,
      "id" | "opnameNumber" | "variance" | "varianceType" | "createdAt" | "status"
    >
  ): StockOpnameRecord => {
    inventoryOpSeq += 1;
    const sysStock = Number(record.systemStock);
    const physStock = Math.max(0, Number(record.physicalStock));
    const targetIng = ingredientsRef.current.find((ing) => ing.id === record.ingredientId);
    const variance = +(physStock - sysStock).toFixed(3);
    const varianceValue = Math.round(variance * (targetIng?.costPerUnit ?? 0));
    const varianceType: "SURPLUS" | "DEFICIT" | "MATCH" =
      variance > 0 ? "SURPLUS" : variance < 0 ? "DEFICIT" : "MATCH";

    const newRecord: StockOpnameRecord = {
      ...record,
      systemStock: sysStock,
      physicalStock: physStock,
      id: `opn-${Date.now()}-${inventoryOpSeq}`,
      opnameNumber: `SOP-${new Date().toISOString().slice(0, 7).replace("-", "")}-${Date.now().toString().slice(-4)}`,
      variance,
      varianceValue,
      varianceType,
      status: "APPLIED",
      createdAt: new Date().toISOString(),
    };

    const auditLog: StockAdjustmentLog = {
      id: `log-opn-${Date.now()}-${inventoryOpSeq}`,
      ingredientId: record.ingredientId,
      ingredientName: record.ingredientName,
      delta: variance,
      previousStock: sysStock,
      currentStock: physStock,
      reason: "OPNAME_HILANG_RUSAK",
      timestamp: new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      user: record.performedBy || "Staff Inventory",
    };

    ingredientsRef.current = ingredientsRef.current.map((ing) => {
      if (ing.id !== record.ingredientId) return ing;
      return {
        ...ing,
        stockNumber: physStock,
        status: computeStockStatus(physStock, ing.min),
        lastUpdated: "Hari ini (Stock Opname)",
      };
    });

    const command: InventoryCommand = {
      op: "RECORD_OPNAME",
      opname: newRecord,
      log: auditLog,
    };

    mutateInventory((prev) => applyInventoryCommand(prev, command), {
      id: `inv-opname-${newRecord.id}`,
      isCreate: true,
      command,
    });

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
    const freshState = inventoryDomainSpec.defaultState();
    ingredientsRef.current = freshState.ingredients;
    recipesRef.current = freshState.recipes;
    mutateInventory(() => inventoryDomainSpec.defaultState(), {
      id: "inventory-reset",
      command: { op: "RESET_INVENTORY" },
    });
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
        filteredLogs,
        stockOpnames,
        filteredStockOpnames,
        adjustStock,
        recordStockOpname,
        checkProductStockStatus,
        simulateBOMDeduction,
        deductOrderBOM,
        restoreOrderBOM,
        recordOrderWasteBOM,
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
