import type { RoleSlug } from "@/types/auth";
import type {
  IngredientItem,
  PurchaseOrder,
  RecipeBOM,
  StockAdjustmentLog,
  StockOpnameRecord,
} from "@/types/inventory";
import {
  INITIAL_INGREDIENTS,
  INITIAL_RECIPES,
} from "@/features/inventory/inventory-data";
import {
  MAX_APPLIED_OP_IDS,
  MAX_INVENTORY_LOGS,
  type DomainWriteAuthDecision,
  type InventoryCommand,
  type InventoryDomainState,
  type ServerDomainSpec,
} from "@/lib/domain-sync-types";
import {
  createSyncedDomainClient,
  type LocalStorageMirrorAdapter,
} from "@/lib/domain-sync";

export const STORAGE_KEY_INGREDIENTS = "dagoeng_inventory_ingredients_v3";
export const STORAGE_KEY_RECIPES = "dagoeng_inventory_recipes_v3";
export const STORAGE_KEY_POS = "dagoeng_inventory_pos_v3";
export const STORAGE_KEY_LOGS = "dagoeng_inventory_logs_v3";
export const STORAGE_KEY_OPNAMES = "dagoeng_inventory_opnames_v1";

const BOM_WRITE_ROLES: readonly RoleSlug[] = [
  "SUPER_ADMIN",
  "OWNER",
  "MANAGER",
  "INVENTORY_STAFF",
  "CASHIER",
  "CUSTOMER",
];

const INVENTORY_MANAGE_ROLES: readonly RoleSlug[] = [
  "SUPER_ADMIN",
  "OWNER",
  "MANAGER",
  "INVENTORY_STAFF",
];

export function computeStockStatus(
  stockNumber: number,
  min: number
): "SAFE" | "LOW" | "CRITICAL" {
  if (stockNumber <= min * 0.4) return "CRITICAL";
  if (stockNumber <= min) return "LOW";
  return "SAFE";
}

function createDefaultInventoryState(): InventoryDomainState {
  return {
    ingredients: INITIAL_INGREDIENTS.map((item) => ({ ...item })),
    recipes: INITIAL_RECIPES.map((recipe) => ({
      ...recipe,
      ingredients: recipe.ingredients.map((ing) => ({ ...ing })),
    })),
    purchaseOrders: [],
    logs: [],
    stockOpnames: [],
    appliedOpIds: [],
  };
}

export function applyInventoryCommand(
  current: InventoryDomainState,
  command: InventoryCommand
): InventoryDomainState {
  switch (command.op) {
    case "APPLY_BOM_DELTAS": {
      const applied = current.appliedOpIds || [];
      if (applied.includes(command.opId)) return current;

      let nextIngredients = current.ingredients;
      for (const { ingredientId, delta } of command.deltas) {
        nextIngredients = nextIngredients.map((ing) => {
          if (ing.id !== ingredientId) return ing;
          const newStock = Math.max(
            0,
            +(ing.stockNumber + Number(delta)).toFixed(3)
          );
          return {
            ...ing,
            stockNumber: newStock,
            status: computeStockStatus(newStock, ing.min),
            lastUpdated: "Baru saja",
          };
        });
      }

      return {
        ...current,
        ingredients: nextIngredients,
        logs: [...command.logs, ...(current.logs || [])].slice(
          0,
          MAX_INVENTORY_LOGS
        ),
        appliedOpIds: [command.opId, ...applied].slice(0, MAX_APPLIED_OP_IDS),
      };
    }

    case "ADJUST_STOCK": {
      const applied = current.appliedOpIds || [];
      if (applied.includes(command.opId)) return current;

      const nextIngredients = current.ingredients.map((ing) => {
        if (ing.id !== command.ingredientId) return ing;
        const newStock = Math.max(
          0,
          +(ing.stockNumber + Number(command.delta)).toFixed(3)
        );
        return {
          ...ing,
          stockNumber: newStock,
          status: computeStockStatus(newStock, ing.min),
          lastUpdated: "Baru saja",
        };
      });

      return {
        ...current,
        ingredients: nextIngredients,
        logs: [command.log, ...(current.logs || [])].slice(
          0,
          MAX_INVENTORY_LOGS
        ),
        appliedOpIds: [command.opId, ...applied].slice(0, MAX_APPLIED_OP_IDS),
      };
    }

    case "RECORD_OPNAME": {
      const existingOpnames = current.stockOpnames || [];
      if (existingOpnames.some((o) => o.id === command.opname.id)) {
        return current;
      }

      const nextStock = Math.max(0, Number(command.opname.physicalStock));
      const nextIngredients = current.ingredients.map((ing) => {
        if (ing.id !== command.opname.ingredientId) return ing;
        return {
          ...ing,
          stockNumber: nextStock,
          status: computeStockStatus(nextStock, ing.min),
          lastUpdated: "Hari ini (Stock Opname)",
        };
      });

      return {
        ...current,
        ingredients: nextIngredients,
        stockOpnames: [command.opname, ...existingOpnames],
        logs: [command.log, ...(current.logs || [])].slice(
          0,
          MAX_INVENTORY_LOGS
        ),
      };
    }

    case "UPSERT_RECIPE": {
      const existingRecipes = current.recipes || [];
      const idx = existingRecipes.findIndex(
        (r) => r.menuId === command.recipe.menuId
      );
      const nextRecipes =
        idx >= 0
          ? existingRecipes.map((r, i) => (i === idx ? command.recipe : r))
          : [command.recipe, ...existingRecipes];
      return {
        ...current,
        recipes: nextRecipes,
      };
    }

    case "DELETE_RECIPE": {
      return {
        ...current,
        recipes: (current.recipes || []).filter(
          (r) => r.menuId !== command.menuId
        ),
      };
    }

    case "CREATE_PO": {
      const existingPOs = current.purchaseOrders || [];
      const idx = existingPOs.findIndex((p) => p.id === command.po.id);
      const nextPOs =
        idx >= 0
          ? existingPOs.map((p, i) => (i === idx ? command.po : p))
          : [command.po, ...existingPOs];
      return {
        ...current,
        purchaseOrders: nextPOs,
      };
    }

    case "RECEIVE_PO": {
      const existingPOs = current.purchaseOrders || [];
      const po = existingPOs.find((p) => p.id === command.poId);
      if (!po || po.status === "RECEIVED") return current;

      const nextIngredients = [...current.ingredients];
      for (const poItem of po.items) {
        let matchIdx = nextIngredients.findIndex(
          (ing) => ing.id === poItem.ingredientId
        );
        if (matchIdx < 0 && poItem.name) {
          const normalizedName = poItem.name.trim().toLowerCase();
          matchIdx = nextIngredients.findIndex(
            (ing) => ing.name.trim().toLowerCase() === normalizedName
          );
        }
        if (matchIdx >= 0) {
          const ing = nextIngredients[matchIdx];
          const newStock = Math.max(
            0,
            +(ing.stockNumber + Number(poItem.quantity)).toFixed(3)
          );
          nextIngredients[matchIdx] = {
            ...ing,
            stockNumber: newStock,
            status: computeStockStatus(newStock, ing.min),
            lastUpdated: "Baru saja",
          };
        }
      }

      const nextPOs = existingPOs.map((p) =>
        p.id === command.poId ? { ...p, status: "RECEIVED" as const } : p
      );

      return {
        ...current,
        ingredients: nextIngredients,
        purchaseOrders: nextPOs,
      };
    }

    case "RESET_INVENTORY": {
      return createDefaultInventoryState();
    }
  }
}

export const inventoryDomainSpec: ServerDomainSpec<"inventory"> = {
  domain: "inventory",
  filename: "inventory_state.json",
  defaultState: createDefaultInventoryState,
  authorizeRead() {
    return { allowed: true };
  },
  authorizeWrite(auth, command): DomainWriteAuthDecision {
    if (!auth.isAuthenticated || !auth.role) {
      if (
        command.op === "APPLY_BOM_DELTAS" &&
        Array.isArray(command.deltas) &&
        command.deltas.every(
          (d) => typeof d.delta === "number" && d.delta <= 0
        )
      ) {
        return { allowed: true };
      }
      return {
        allowed: false,
        status: 401,
        error: "Autentikasi diperlukan.",
      };
    }

    if (command.op === "APPLY_BOM_DELTAS") {
      if (BOM_WRITE_ROLES.includes(auth.role)) {
        return { allowed: true };
      }
      return {
        allowed: false,
        status: 403,
        error: "Peran tidak diizinkan untuk memperbarui stok BOM.",
      };
    }

    if (command.op === "RESET_INVENTORY") {
      if (
        auth.role === "SUPER_ADMIN" ||
        (auth.role === "OWNER" && auth.scopeLevel !== "TENANT")
      ) {
        return { allowed: true };
      }
      return {
        allowed: false,
        status: 403,
        error: "Hanya Super Admin atau Owner Hub yang dapat mereset inventori.",
      };
    }

    if (INVENTORY_MANAGE_ROLES.includes(auth.role)) {
      return { allowed: true };
    }

    return {
      allowed: false,
      status: 403,
      error: "Peran tidak memiliki akses tulis inventori.",
    };
  },
  applyCommand(current, command) {
    return applyInventoryCommand(current, command);
  },
};

function parseStoredArray<T>(raw: string | null, fallback: T[]): T[] {
  if (raw === null) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

interface MirrorSnapshotCache {
  rawIng: string | null;
  rawRec: string | null;
  rawPOs: string | null;
  rawLogs: string | null;
  rawOpnames: string | null;
  state: InventoryDomainState;
}

let mirrorCache: MirrorSnapshotCache | null = null;

const inventoryStorageMirror: LocalStorageMirrorAdapter<InventoryDomainState> = {
  keys: [
    STORAGE_KEY_INGREDIENTS,
    STORAGE_KEY_RECIPES,
    STORAGE_KEY_POS,
    STORAGE_KEY_LOGS,
    STORAGE_KEY_OPNAMES,
  ],
  readFromStorage(fallback: InventoryDomainState): InventoryDomainState {
    if (typeof window === "undefined") return fallback;
    try {
      const rawIng = window.localStorage.getItem(STORAGE_KEY_INGREDIENTS);
      const rawRec = window.localStorage.getItem(STORAGE_KEY_RECIPES);
      const rawPOs = window.localStorage.getItem(STORAGE_KEY_POS);
      const rawLogs = window.localStorage.getItem(STORAGE_KEY_LOGS);
      const rawOpnames = window.localStorage.getItem(STORAGE_KEY_OPNAMES);

      if (
        mirrorCache !== null &&
        mirrorCache.rawIng === rawIng &&
        mirrorCache.rawRec === rawRec &&
        mirrorCache.rawPOs === rawPOs &&
        mirrorCache.rawLogs === rawLogs &&
        mirrorCache.rawOpnames === rawOpnames
      ) {
        return mirrorCache.state;
      }

      const state: InventoryDomainState = {
        ingredients: parseStoredArray<IngredientItem>(
          rawIng,
          fallback.ingredients
        ),
        recipes: parseStoredArray<RecipeBOM>(rawRec, fallback.recipes),
        purchaseOrders: parseStoredArray<PurchaseOrder>(
          rawPOs,
          fallback.purchaseOrders
        ),
        logs: parseStoredArray<StockAdjustmentLog>(rawLogs, fallback.logs).slice(
          0,
          MAX_INVENTORY_LOGS
        ),
        stockOpnames: parseStoredArray<StockOpnameRecord>(
          rawOpnames,
          fallback.stockOpnames
        ),
        appliedOpIds: fallback.appliedOpIds ?? [],
      };

      mirrorCache = {
        rawIng,
        rawRec,
        rawPOs,
        rawLogs,
        rawOpnames,
        state,
      };

      return state;
    } catch {
      return fallback;
    }
  },
  writeToStorage(state: InventoryDomainState): void {
    if (typeof window === "undefined") return;
    try {
      const rawIng = JSON.stringify(state.ingredients);
      const rawRec = JSON.stringify(state.recipes);
      const rawPOs = JSON.stringify(state.purchaseOrders);
      const rawLogs = JSON.stringify(
        (state.logs || []).slice(0, MAX_INVENTORY_LOGS)
      );
      const rawOpnames = JSON.stringify(state.stockOpnames);

      window.localStorage.setItem(STORAGE_KEY_INGREDIENTS, rawIng);
      window.localStorage.setItem(STORAGE_KEY_RECIPES, rawRec);
      window.localStorage.setItem(STORAGE_KEY_POS, rawPOs);
      window.localStorage.setItem(STORAGE_KEY_LOGS, rawLogs);
      window.localStorage.setItem(STORAGE_KEY_OPNAMES, rawOpnames);

      mirrorCache = {
        rawIng,
        rawRec,
        rawPOs,
        rawLogs,
        rawOpnames,
        state,
      };
    } catch {}
  },
};

export const inventorySyncClient = createSyncedDomainClient<"inventory">({
  domain: "inventory",
  defaultState: createDefaultInventoryState,
  storageMirror: inventoryStorageMirror,
  applyCommandLocally: applyInventoryCommand,
});
