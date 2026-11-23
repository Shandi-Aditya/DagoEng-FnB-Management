import fs from "fs";
import path from "path";
import {
  getDataFilePath,
  getStorageSyncStatus,
  persistStorageToDb,
  syncStorageFromDb,
} from "@/lib/data-storage";
import { ActivityLogEntry } from "@/types/audit";
import { ShiftRecord, EmployeeProfile } from "@/types/shift";
import { OrderRecord } from "@/types/order";
import { MasterProduct } from "@/types/product";
import { LoyaltyMember } from "@/types/loyalty";
import { resolveAuthoritativeMemberTier } from "@/lib/loyalty-policy";
import { DEFAULT_PLATFORM_SETTINGS, type PlatformSettings } from "@/types/settings";
import {
  INITIAL_EMPLOYEES,
  INITIAL_PRODUCTS,
  INITIAL_MEMBERS,
  normalizeLoyaltyPhone,
} from "@/lib/master-data-defaults";
import type {
  DomainCommandMap,
  DomainStateMap,
  InventoryDomainState,
  ServerDomainSpec,
  SyncDomainName,
} from "@/lib/domain-sync-types";
import type { ServerAuthResult } from "@/lib/server-auth";
import {
  ensureUniqueSequentialOrderNumber,
  resolvePublisherCode,
} from "@/lib/receipt-publisher";
import {
  deductOrderItemsBOM,
  INITIAL_INGREDIENTS,
  INITIAL_RECIPES,
  restoreOrderItemsBOM,
  type OrderItemBOMInput,
} from "@/features/inventory/inventory-data";
import { inventoryDomainSpec } from "@/lib/sync-domains/inventory-spec";
import type { RecipeBOM } from "@/types/inventory";

const FILE_AUDIT_LOGS = "audit_logs.json";
const FILE_SHIFTS = "shifts.json";
const FILE_COWORKING_BOOKINGS = "coworking_bookings.json";
const FILE_POS_ORDERS = "pos_orders.json";
const FILE_LOYALTY_POINTS = "loyalty_points.json";
const FILE_QRIS_SESSIONS = "qris_sessions.json";
const FILE_EMPLOYEES = "employees.json";
const FILE_MASTER_PRODUCTS = "master_products.json";
const FILE_LOYALTY_MEMBERS = "loyalty_members.json";

export interface MasterProductsStoragePayload {
  products: MasterProduct[];
  customCategories: string[];
}

export interface LoyaltyPointsRecord {
  customerKey: string; // phone or customerId
  customerName?: string;
  points: number;
  creditedOrderIds?: string[];
  updatedAt: string;
}

export interface QrisVerificationSessionRecord {
  orderId: string;
  invoiceNumber: string;
  expectedAmount: number;
  status: "PENDING" | "VERIFIED_WEBHOOK" | "VERIFIED_SUPERVISOR" | "FAILED";
  verificationMethod?: "GATEWAY_WEBHOOK" | "SUPERVISOR_OVERRIDE" | "SHARED_SUPERVISOR_PIN";
  consumedByOrderId?: string;
  transactionId?: string;
  rrn?: string;
  verifiedByUserId?: string;
  verifiedByName?: string;
  verifiedByRole?: string;
  verifiedAt?: string;
  updatedAt: string;
}

let mockStorageWriteFailure: Error | null = null;

/**
 * R9: Test hook to simulate disk or database write failures and verify API routes fail closed (500).
 */
export function __setMockStorageWriteFailure(err: Error | null): void {
  mockStorageWriteFailure = err;
}

// Mutex queues per file to serialize read-modify-write operations atomically
const fileLocks = new Map<string, Promise<any>>();

export function withFileLock<T>(filename: string, fn: () => Promise<T> | T): Promise<T> {
  const currentLock = fileLocks.get(filename) || Promise.resolve();
  const nextLock = currentLock.then(fn, fn);
  fileLocks.set(filename, nextLock.catch(() => {}));
  return nextLock;
}

async function readUnlocked<T>(filename: string, defaultValue: T): Promise<T> {
  try {
    if (process.env.NODE_ENV !== "test") {
      await syncStorageFromDb(filename).catch(() => {});
    }

    const filePath = getDataFilePath(filename);
    if (!fs.existsSync(filePath)) {
      return defaultValue;
    }

    const content = fs.readFileSync(filePath, "utf-8").trim();
    if (!content) return defaultValue;

    return JSON.parse(content) as T;
  } catch (err) {
    console.warn(`[persistent-storage] Read error on ${filename}:`, err);
    return defaultValue;
  }
}

async function writeUnlocked<T>(filename: string, data: T): Promise<boolean> {
  if (mockStorageWriteFailure) {
    throw mockStorageWriteFailure;
  }

  try {
    if (
      process.env.NODE_ENV !== "test" &&
      getStorageSyncStatus(filename) === "UNAVAILABLE"
    ) {
      await syncStorageFromDb(filename).catch(() => {});
    }

    const filePath = getDataFilePath(filename);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, content, "utf-8");

    if (process.env.NODE_ENV !== "test") {
      try {
        await persistStorageToDb(filename, content);
      } catch (dbErr) {
        if (process.env.REQUIRE_DB_SYNC === "true" || process.env.NODE_ENV === "production") {
          throw dbErr;
        }
        console.warn(`[persistent-storage] DB sync warning for ${filename}:`, dbErr);
      }
    }

    return true;
  } catch (err: any) {
    console.error(`[persistent-storage] Write failed for ${filename}:`, err);
    throw new Error(
      `STORAGE_WRITE_FAILED [${filename}]: ${err?.message || "Gagal menyimpan data ke media penyimpanan."}`
    );
  }
}

/**
 * Reads a JSON persistent storage file from disk replica, syncing from PostgreSQL when needed.
 */
export async function readPersistentData<T>(filename: string, defaultValue: T): Promise<T> {
  return withFileLock(filename, () => readUnlocked(filename, defaultValue));
}

/**
 * Writes data safely to the disk replica and awaits PostgreSQL SystemSetting sync.
 */
export async function writePersistentData<T>(filename: string, data: T): Promise<boolean> {
  return withFileLock(filename, () => writeUnlocked(filename, data));
}

/**
 * Performs an atomic read-modify-write inside the per-file mutex lock so concurrent updates never overwrite each other.
 */
export async function mutatePersistentData<T>(
  filename: string,
  defaultValue: T,
  mutator: (current: T) => Promise<T> | T
): Promise<T> {
  return withFileLock(filename, async () => {
    const current = await readUnlocked(filename, defaultValue);
    const updated = await mutator(current);
    await writeUnlocked(filename, updated);
    return updated;
  });
}

async function readUnlockedOrSeed<T>(
  filename: string,
  seedValue: () => T
): Promise<T> {
  try {
    if (process.env.NODE_ENV !== "test") {
      await syncStorageFromDb(filename).catch(() => {});
    }

    const filePath = getDataFilePath(filename);
    if (!fs.existsSync(filePath)) {
      return seedValue();
    }

    const content = fs.readFileSync(filePath, "utf-8").trim();
    if (!content) {
      return seedValue();
    }

    return JSON.parse(content) as T;
  } catch (err) {
    console.warn(`[persistent-storage] Seeded read error on ${filename}:`, err);
    return seedValue();
  }
}

export async function readSeededPersistentData<T>(
  filename: string,
  seedValue: () => T
): Promise<T> {
  return withFileLock(filename, () => readUnlockedOrSeed(filename, seedValue));
}

export async function mutateSeededPersistentData<T>(
  filename: string,
  seedValue: () => T,
  mutator: (current: T) => Promise<T> | T
): Promise<T> {
  return withFileLock(filename, async () => {
    const current = await readUnlockedOrSeed(filename, seedValue);
    const updated = await mutator(current);
    await writeUnlocked(filename, updated);
    return updated;
  });
}

export async function readPersistentDomainState<D extends SyncDomainName>(
  spec: ServerDomainSpec<D>
): Promise<DomainStateMap[D]> {
  return readSeededPersistentData<DomainStateMap[D]>(
    spec.filename,
    spec.defaultState
  );
}

export async function applyPersistentDomainCommand<D extends SyncDomainName>(
  spec: ServerDomainSpec<D>,
  command: DomainCommandMap[D],
  auth: ServerAuthResult
): Promise<DomainStateMap[D]> {
  return mutateSeededPersistentData<DomainStateMap[D]>(
    spec.filename,
    spec.defaultState,
    (current) => spec.applyCommand(current, command, auth)
  );
}

export async function getAuditLogs(): Promise<ActivityLogEntry[]> {
  return readPersistentData<ActivityLogEntry[]>(FILE_AUDIT_LOGS, []);
}

/**
 * Appends an audit log entry permanently inside an atomic file lock.
 * Enforces append-only semantics: existing logs cannot be erased, truncated, or overwritten.
 */
export async function appendAuditLog(entry: ActivityLogEntry): Promise<ActivityLogEntry> {
  return withFileLock(FILE_AUDIT_LOGS, async () => {
    const existing = await readUnlocked<ActivityLogEntry[]>(FILE_AUDIT_LOGS, []);

    if (entry.id && existing.some((l) => l.id === entry.id)) {
      throw new Error(
        `AUDIT_INTEGRITY_VIOLATION: Audit log entry with ID [${entry.id}] already exists and cannot be overwritten.`
      );
    }

    const finalEntry: ActivityLogEntry = {
      ...entry,
      id: entry.id || `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: entry.timestamp || new Date().toISOString(),
    };

    const updated = [finalEntry, ...existing];
    await writeUnlocked(FILE_AUDIT_LOGS, updated);
    return finalEntry;
  });
}

// ==========================================
// 2. SHIFTS PERSISTENCE
// ==========================================

export async function getPersistentShifts(): Promise<ShiftRecord[]> {
  return readPersistentData<ShiftRecord[]>(FILE_SHIFTS, []);
}

export async function savePersistentShift(shift: ShiftRecord): Promise<boolean> {
  await mutatePersistentData<ShiftRecord[]>(FILE_SHIFTS, [], (existing) => {
    const index = existing.findIndex((s) => s.id === shift.id);
    if (index >= 0) {
      const updated = [...existing];
      updated[index] = shift;
      return updated;
    }
    return [shift, ...existing];
  });
  return true;
}

// ==========================================
// 3. COWORKING BOOKINGS PERSISTENCE
// ==========================================

export async function getCoworkingBookings(): Promise<any[]> {
  return readPersistentData<any[]>(FILE_COWORKING_BOOKINGS, []);
}

export async function saveCoworkingBooking(booking: any): Promise<boolean> {
  await mutatePersistentData<any[]>(FILE_COWORKING_BOOKINGS, [], (existing) => {
    const index = existing.findIndex(
      (b) => b.id === booking.id || (booking.bookingCode && b.bookingCode === booking.bookingCode)
    );
    if (index >= 0) {
      const updated = [...existing];
      updated[index] = booking;
      return updated;
    }
    return [booking, ...existing];
  });
  return true;
}

const SEQUENTIAL_ORDER_RE = /^[A-Z]+-[A-Z0-9]+-\d{8}-\d+$/i;
const PRE_COOK_DISALLOWED_STATUSES = new Set(["COOKING", "READY", "SERVED", "COMPLETED"]);

const SYSTEM_INVENTORY_AUTH: ServerAuthResult = {
  isAuthenticated: true,
  role: "SUPER_ADMIN",
  userId: "system-bom",
  scopeLevel: "ORGANIZATION",
};

function inferOrderPublisherCode(
  order: Pick<OrderRecord, "orderNumber" | "tenantId" | "items">
): string | undefined {
  const raw = typeof order.orderNumber === "string" ? order.orderNumber.trim() : "";
  if (SEQUENTIAL_ORDER_RE.test(raw)) {
    return undefined;
  }
  const itemTenants = Array.from(
    new Set(
      (order.items || [])
        .map((item) => item.tenantId?.trim())
        .filter((id): id is string => Boolean(id))
    )
  );
  if (itemTenants.length > 1) return "DAGO";
  if (itemTenants.length === 1) return resolvePublisherCode(itemTenants[0]);
  if (order.tenantId?.trim()) return resolvePublisherCode(order.tenantId);
  return "DAGO";
}

export async function getPersistentOrders(): Promise<OrderRecord[]> {
  return readSeededPersistentData<OrderRecord[]>(FILE_POS_ORDERS, () => []);
}

export async function resetPersistentOrders(): Promise<boolean> {
  return writePersistentData<OrderRecord[]>(FILE_POS_ORDERS, []);
}

export async function mutatePersistentOrders<R = OrderRecord[]>(
  mutator: (
    current: OrderRecord[]
  ) => Promise<{ nextOrders: OrderRecord[]; result: R }> | { nextOrders: OrderRecord[]; result: R }
): Promise<R> {
  let outcome!: R;
  await mutateSeededPersistentData<OrderRecord[]>(
    FILE_POS_ORDERS,
    () => [],
    async (existing) => {
      const current = Array.isArray(existing) ? existing : [];
      const { nextOrders, result } = await mutator(current);
      outcome = result;
      return nextOrders;
    }
  );
  return outcome;
}

export async function updatePersistentOrderIf(
  orderId: string,
  predicate: (current: OrderRecord) => boolean,
  updater: (current: OrderRecord) => OrderRecord
): Promise<{
  updated: boolean;
  order: OrderRecord | null;
  reason?: "NOT_FOUND" | "PREDICATE_FAILED";
}> {
  return mutatePersistentOrders<{
    updated: boolean;
    order: OrderRecord | null;
    reason?: "NOT_FOUND" | "PREDICATE_FAILED";
  }>((orders) => {
    const idx = orders.findIndex((o) => o.id === orderId);
    if (idx < 0) {
      return { nextOrders: orders, result: { updated: false, order: null, reason: "NOT_FOUND" } };
    }
    const current = orders[idx];
    if (!predicate(current)) {
      return {
        nextOrders: orders,
        result: { updated: false, order: current, reason: "PREDICATE_FAILED" },
      };
    }
    const nextOrder = updater(current);
    const nextOrders = [...orders];
    nextOrders[idx] = nextOrder;
    return { nextOrders, result: { updated: true, order: nextOrder } };
  });
}

export async function savePersistentOrder(order: OrderRecord): Promise<OrderRecord> {
  return mutatePersistentOrders((existing) => {
    const index = existing.findIndex((o) => o.id === order.id);
    const otherNumbers = existing
      .filter((o) => o.id !== order.id)
      .map((o) => o.orderNumber);

    if (index >= 0) {
      const prev = existing[index];
      const candidateNumber =
        typeof order.orderNumber === "string" && order.orderNumber.trim()
          ? order.orderNumber
          : prev.orderNumber;
      const resolvedOrderNumber = ensureUniqueSequentialOrderNumber({
        orderNumber: candidateNumber,
        publisherCode: inferOrderPublisherCode({
          ...order,
          orderNumber: candidateNumber,
        }),
        existingNumbers: otherNumbers,
        date: order.createdAt || prev.createdAt,
        allowCustomFormat: true,
      });

      const savedOrder: OrderRecord = {
        ...order,
        orderNumber: resolvedOrderNumber,
        ...(prev.loyaltyPointsCredited ? { loyaltyPointsCredited: true } : {}),
        ...(prev.bomDeducted ? { bomDeducted: true } : {}),
        ...(prev.bomRestored ? { bomRestored: true } : {}),
      };
      const updated = [...existing];
      updated[index] = savedOrder;
      return { nextOrders: updated, result: savedOrder };
    }

    const resolvedOrderNumber = ensureUniqueSequentialOrderNumber({
      orderNumber: order.orderNumber,
      publisherCode: inferOrderPublisherCode(order),
      existingNumbers: otherNumbers,
      date: order.createdAt,
      allowCustomFormat: true,
    });
    const savedOrder: OrderRecord = {
      ...order,
      orderNumber: resolvedOrderNumber,
    };
    return { nextOrders: [savedOrder, ...existing], result: savedOrder };
  });
}

export function isOrderBeforeCooking(
  order: Pick<OrderRecord, "status" | "cookingStartedAt">
): boolean {
  return !order.cookingStartedAt && !PRE_COOK_DISALLOWED_STATUSES.has(order.status);
}

function mergeRecipesWithInitial(recipes: RecipeBOM[] | undefined): RecipeBOM[] {
  const stored = Array.isArray(recipes) ? recipes : [];
  const existingIds = new Set(stored.map((r) => r.menuId));
  return [
    ...stored,
    ...INITIAL_RECIPES.filter((r) => !existingIds.has(r.menuId)).map((r) => ({
      ...r,
      ingredients: r.ingredients.map((ing) => ({ ...ing })),
    })),
  ];
}

function normalizeInventoryState(current: InventoryDomainState): InventoryDomainState {
  return {
    ...current,
    ingredients:
      Array.isArray(current.ingredients) && current.ingredients.length > 0
        ? current.ingredients
        : INITIAL_INGREDIENTS.map((item) => ({ ...item })),
    recipes: mergeRecipesWithInitial(current.recipes),
    purchaseOrders: Array.isArray(current.purchaseOrders) ? current.purchaseOrders : [],
    logs: Array.isArray(current.logs) ? current.logs : [],
    stockOpnames: Array.isArray(current.stockOpnames) ? current.stockOpnames : [],
    appliedOpIds: Array.isArray(current.appliedOpIds) ? current.appliedOpIds : [],
  };
}

function toOrderBomItems(items: OrderRecord["items"]): OrderItemBOMInput[] {
  return (items || []).map((item) => ({
    productId: item.productId || item.id,
    productName: item.productName,
    quantity: item.quantity,
    modifiers: item.modifiers,
  }));
}

async function markOrderBomFlag(
  orderId: string,
  flag: "bomDeducted" | "bomRestored"
): Promise<void> {
  await updatePersistentOrderIf(
    orderId,
    (current) => !current[flag],
    (current) => ({ ...current, [flag]: true })
  );
}

export async function deductPersistentOrderBOM(
  order: OrderRecord,
  options?: { tenantId?: string; outletId?: string; reason?: string }
): Promise<{ applied: boolean; deductedItems: number }> {
  if (
    order.bomDeducted === true ||
    order.status === "CANCELLED" ||
    order.paymentStatus === "REFUNDED" ||
    !Array.isArray(order.items) ||
    order.items.length === 0
  ) {
    return { applied: false, deductedItems: 0 };
  }

  const storedOrders = await getPersistentOrders();
  const storedOrder = storedOrders.find((o) => o.id === order.id);
  if (storedOrder?.bomDeducted === true) {
    return { applied: false, deductedItems: 0 };
  }

  const opId = `bom-deduct-${order.id}`;
  let applied = false;
  let alreadyDeducted = false;
  let deductedItems = 0;

  await mutateSeededPersistentData<InventoryDomainState>(
    inventoryDomainSpec.filename,
    inventoryDomainSpec.defaultState,
    (rawCurrent) => {
      const current = normalizeInventoryState(rawCurrent);
      if ((current.appliedOpIds || []).includes(opId)) {
        alreadyDeducted = true;
        return current;
      }

      const { logs, deductedCount } = deductOrderItemsBOM(
        current.ingredients,
        current.recipes,
        toOrderBomItems(order.items)
      );
      const deltas = logs
        .filter((l) => l.delta !== 0)
        .map((l) => ({ ingredientId: l.ingredientId, delta: l.delta }));

      if (deductedCount === 0 || deltas.length === 0) {
        return current;
      }

      const reasonSuffix = options?.reason ? ` - ${options.reason}` : "";
      const annotatedLogs = reasonSuffix
        ? logs.map((log) => ({ ...log, user: `${log.user}${reasonSuffix}` }))
        : logs;

      applied = true;
      deductedItems = deductedCount;
      return inventoryDomainSpec.applyCommand(
        current,
        { op: "APPLY_BOM_DELTAS", opId, deltas, logs: annotatedLogs },
        SYSTEM_INVENTORY_AUTH
      );
    }
  );

  if (applied || alreadyDeducted) {
    await markOrderBomFlag(order.id, "bomDeducted");
  }

  return { applied, deductedItems };
}

export async function restorePersistentOrderBOMIfBeforeCooking(
  order: OrderRecord,
  options?: { reason?: string }
): Promise<{ restored: boolean; reason: string; restoredItems: number }> {
  if (!isOrderBeforeCooking(order)) {
    return { restored: false, reason: "already-cooking-or-beyond", restoredItems: 0 };
  }

  const storedOrders = await getPersistentOrders();
  const storedOrder = storedOrders.find((o) => o.id === order.id);

  if (storedOrder && !isOrderBeforeCooking(storedOrder)) {
    return { restored: false, reason: "already-cooking-or-beyond", restoredItems: 0 };
  }
  if (order.bomRestored === true || storedOrder?.bomRestored === true) {
    return { restored: false, reason: "already-restored", restoredItems: 0 };
  }

  const deductOpId = `bom-deduct-${order.id}`;
  const restoreOpId = `bom-restore-${order.id}`;
  let restored = false;
  let reason = "bom-not-deducted";
  let restoredItems = 0;

  await mutateSeededPersistentData<InventoryDomainState>(
    inventoryDomainSpec.filename,
    inventoryDomainSpec.defaultState,
    (rawCurrent) => {
      const current = normalizeInventoryState(rawCurrent);
      const appliedOpIds = current.appliedOpIds || [];

      if (appliedOpIds.includes(restoreOpId)) {
        reason = "already-restored";
        return current;
      }

      const wasDeducted =
        order.bomDeducted === true ||
        storedOrder?.bomDeducted === true ||
        appliedOpIds.includes(deductOpId);
      if (!wasDeducted) {
        reason = "bom-not-deducted";
        return current;
      }

      if (!Array.isArray(order.items) || order.items.length === 0) {
        reason = "no-items";
        return current;
      }

      const { logs, restoredCount } = restoreOrderItemsBOM(
        current.ingredients,
        current.recipes,
        toOrderBomItems(order.items),
        order.orderNumber
      );
      const deltas = logs
        .filter((l) => l.delta !== 0)
        .map((l) => ({ ingredientId: l.ingredientId, delta: l.delta }));

      if (restoredCount === 0 || deltas.length === 0) {
        reason = "no-matching-recipes";
        return current;
      }

      const reasonSuffix = options?.reason ? ` - ${options.reason}` : "";
      const annotatedLogs = reasonSuffix
        ? logs.map((log) => ({ ...log, user: `${log.user}${reasonSuffix}` }))
        : logs;

      restored = true;
      reason = "restored";
      restoredItems = restoredCount;
      return inventoryDomainSpec.applyCommand(
        current,
        { op: "APPLY_BOM_DELTAS", opId: restoreOpId, deltas, logs: annotatedLogs },
        SYSTEM_INVENTORY_AUTH
      );
    }
  );

  if (restored || reason === "already-restored") {
    await markOrderBomFlag(order.id, "bomRestored");
  }

  return { restored, reason, restoredItems };
}

export async function getPersistentLoyaltyPoints(): Promise<LoyaltyPointsRecord[]> {
  return readPersistentData<LoyaltyPointsRecord[]>(FILE_LOYALTY_POINTS, []);
}

export async function updatePersistentLoyaltyPoints(
  customerKey: string,
  pointsDelta: number,
  customerName?: string,
  orderId?: string
): Promise<LoyaltyPointsRecord> {
  const normalizedKey = customerKey.trim().toLowerCase();
  let resultRecord: LoyaltyPointsRecord | null = null;

  await mutatePersistentData<LoyaltyPointsRecord[]>(FILE_LOYALTY_POINTS, [], (existing) => {
    const index = existing.findIndex((r) => r.customerKey.toLowerCase() === normalizedKey);
    const now = new Date().toISOString();
    if (index >= 0) {
      const prev = existing[index];
      const creditedIds = Array.isArray(prev.creditedOrderIds) ? prev.creditedOrderIds : [];
      // R8: Idempotency check per orderId so the same order never awards points twice
      if (orderId && creditedIds.includes(orderId)) {
        resultRecord = prev;
        return existing;
      }
      const updated = [...existing];
      const currentPoints = Number(prev.points) || 0;
      resultRecord = {
        ...prev,
        customerName: customerName || prev.customerName,
        points: Math.max(0, currentPoints + pointsDelta),
        creditedOrderIds: orderId ? [...creditedIds, orderId] : creditedIds,
        updatedAt: now,
      };
      updated[index] = resultRecord;
      return updated;
    } else {
      resultRecord = {
        customerKey: normalizedKey,
        customerName,
        points: Math.max(0, pointsDelta),
        creditedOrderIds: orderId ? [orderId] : [],
        updatedAt: now,
      };
      return [resultRecord, ...existing];
    }
  });

  return resultRecord!;
}

// ==========================================
// 5. QRIS SERVER VERIFICATION SESSIONS (POS-25)
// ==========================================

export async function getPersistentQrisSessions(): Promise<QrisVerificationSessionRecord[]> {
  return readPersistentData<QrisVerificationSessionRecord[]>(FILE_QRIS_SESSIONS, []);
}

export async function getPersistentQrisSession(
  orderIdOrInvoice: string
): Promise<QrisVerificationSessionRecord | null> {
  const target = (orderIdOrInvoice || "").trim();
  if (!target) return null;
  const all = await getPersistentQrisSessions();
  return all.find((s) => s.orderId === target || s.invoiceNumber === target) || null;
}

export function isVerifiedQrisStatus(status: QrisVerificationSessionRecord["status"]): boolean {
  return status === "VERIFIED_WEBHOOK" || status === "VERIFIED_SUPERVISOR";
}

export async function savePersistentQrisSession(
  session: QrisVerificationSessionRecord
): Promise<QrisVerificationSessionRecord> {
  let saved: QrisVerificationSessionRecord = session;
  await mutatePersistentData<QrisVerificationSessionRecord[]>(FILE_QRIS_SESSIONS, [], (existing) => {
    const index = existing.findIndex(
      (s) => s.orderId === session.orderId || s.invoiceNumber === session.invoiceNumber
    );
    if (index === -1) {
      saved = session;
      return [session, ...existing];
    }
    const previous = existing[index];
    if (previous.orderId && previous.orderId !== session.orderId) {
      saved = previous;
      return existing;
    }
    // Proof of payment is never downgraded, and the order a payment settled stays bound to it.
    saved =
      isVerifiedQrisStatus(previous.status) && !isVerifiedQrisStatus(session.status)
        ? previous
        : { ...session, consumedByOrderId: previous.consumedByOrderId ?? session.consumedByOrderId };
    const updated = [...existing];
    updated[index] = saved;
    return updated;
  });
  return saved;
}

export type QrisSessionClaimResult =
  | { ok: true; session: QrisVerificationSessionRecord }
  | { ok: false; reason: "NOT_FOUND" | "UNVERIFIED" | "AMOUNT_MISMATCH" | "ALREADY_CONSUMED"; session?: QrisVerificationSessionRecord };

/**
 * Binds one verified QRIS session to exactly one order. Re-claiming by the same order is a no-op,
 * so a retried save stays idempotent, while a second order using the same payment is rejected.
 */
export async function claimQrisSessionForOrder(params: {
  invoiceNumber: string;
  orderId: string;
  amount: number;
}): Promise<QrisSessionClaimResult> {
  let result: QrisSessionClaimResult = { ok: false, reason: "NOT_FOUND" };
  await mutatePersistentData<QrisVerificationSessionRecord[]>(FILE_QRIS_SESSIONS, [], (existing) => {
    const index = existing.findIndex((s) => s.invoiceNumber === params.invoiceNumber);
    if (index === -1) return existing;
    const session = existing[index];
    if (session.status !== "VERIFIED_WEBHOOK" && session.status !== "VERIFIED_SUPERVISOR") {
      result = { ok: false, reason: "UNVERIFIED", session };
      return existing;
    }
    if (Math.round(session.expectedAmount) !== Math.round(params.amount)) {
      result = { ok: false, reason: "AMOUNT_MISMATCH", session };
      return existing;
    }
    if (session.consumedByOrderId && session.consumedByOrderId !== params.orderId) {
      result = { ok: false, reason: "ALREADY_CONSUMED", session };
      return existing;
    }
    const claimed: QrisVerificationSessionRecord = {
      ...session,
      consumedByOrderId: params.orderId,
      updatedAt: new Date().toISOString(),
    };
    result = { ok: true, session: claimed };
    const updated = [...existing];
    updated[index] = claimed;
    return updated;
  });
  return result;
}

export async function getPersistentEmployees(): Promise<EmployeeProfile[]> {
  return readSeededPersistentData<EmployeeProfile[]>(
    FILE_EMPLOYEES,
    () => [...INITIAL_EMPLOYEES]
  );
}

export async function savePersistentEmployee(employee: EmployeeProfile): Promise<EmployeeProfile> {
  let saved: EmployeeProfile = employee;
  await mutateSeededPersistentData<EmployeeProfile[]>(
    FILE_EMPLOYEES,
    () => [...INITIAL_EMPLOYEES],
    (existing) => {
      const list = Array.isArray(existing) ? existing : [...INITIAL_EMPLOYEES];
      const index = list.findIndex((e) => e.id === employee.id);
      if (index >= 0) {
        const updated = [...list];
        updated[index] = employee;
        saved = employee;
        return updated;
      }
      saved = employee;
      return [employee, ...list];
    }
  );
  return saved;
}

export async function deletePersistentEmployee(id: string): Promise<boolean> {
  await mutateSeededPersistentData<EmployeeProfile[]>(
    FILE_EMPLOYEES,
    () => [...INITIAL_EMPLOYEES],
    (existing) => {
      const list = Array.isArray(existing) ? existing : [...INITIAL_EMPLOYEES];
      return list.filter((e) => e.id !== id);
    }
  );
  return true;
}

export async function getPersistentProductsData(): Promise<MasterProductsStoragePayload> {
  const seedPayload = (): MasterProductsStoragePayload => ({
    products: [...INITIAL_PRODUCTS],
    customCategories: [],
  });
  const data = await readSeededPersistentData<MasterProductsStoragePayload>(
    FILE_MASTER_PRODUCTS,
    seedPayload
  );
  return {
    products: Array.isArray(data?.products) ? data.products : [...INITIAL_PRODUCTS],
    customCategories: Array.isArray(data?.customCategories)
      ? data.customCategories
      : [],
  };
}

export async function savePersistentProduct(product: MasterProduct): Promise<MasterProduct> {
  let saved: MasterProduct = product;
  await mutateSeededPersistentData<MasterProductsStoragePayload>(
    FILE_MASTER_PRODUCTS,
    () => ({ products: [...INITIAL_PRODUCTS], customCategories: [] }),
    (existing) => {
      const products = Array.isArray(existing?.products)
        ? existing.products
        : [...INITIAL_PRODUCTS];
      const categories = Array.isArray(existing?.customCategories)
        ? existing.customCategories
        : [];
      const index = products.findIndex((p) => p.id === product.id);
      let nextProducts: MasterProduct[];
      if (index >= 0) {
        nextProducts = [...products];
        nextProducts[index] = product;
      } else {
        nextProducts = [product, ...products];
      }
      saved = product;
      return {
        products: nextProducts,
        customCategories: categories,
      };
    }
  );
  return saved;
}

export async function deletePersistentProduct(id: string): Promise<boolean> {
  await mutateSeededPersistentData<MasterProductsStoragePayload>(
    FILE_MASTER_PRODUCTS,
    () => ({ products: [...INITIAL_PRODUCTS], customCategories: [] }),
    (existing) => {
      const products = Array.isArray(existing?.products)
        ? existing.products
        : [...INITIAL_PRODUCTS];
      return {
        products: products.filter((p) => p.id !== id),
        customCategories: Array.isArray(existing?.customCategories)
          ? existing.customCategories
          : [],
      };
    }
  );
  return true;
}

export async function savePersistentCustomCategory(category: string): Promise<string[]> {
  const trimmed = category.trim();
  if (!trimmed) return [];
  let updatedCats: string[] = [];
  await mutateSeededPersistentData<MasterProductsStoragePayload>(
    FILE_MASTER_PRODUCTS,
    () => ({ products: [...INITIAL_PRODUCTS], customCategories: [] }),
    (existing) => {
      const products = Array.isArray(existing?.products)
        ? existing.products
        : [...INITIAL_PRODUCTS];
      const categories = Array.isArray(existing?.customCategories)
        ? existing.customCategories
        : [];
      if (!categories.includes(trimmed)) {
        updatedCats = [...categories, trimmed];
      } else {
        updatedCats = categories;
      }
      return {
        products,
        customCategories: updatedCats,
      };
    }
  );
  return updatedCats;
}

export async function getPersistentLoyaltyMembers(
  tierConfig?: PlatformSettings["loyaltyTiers"]
): Promise<LoyaltyMember[]> {
  const effectiveTierConfig = tierConfig ?? DEFAULT_PLATFORM_SETTINGS.loyaltyTiers;
  const members = await readSeededPersistentData<LoyaltyMember[]>(
    FILE_LOYALTY_MEMBERS,
    () => [...INITIAL_MEMBERS]
  );
  return (Array.isArray(members) ? members : []).map((m) => ({
    ...m,
    tier: resolveAuthoritativeMemberTier(m, effectiveTierConfig),
  }));
}

export async function savePersistentLoyaltyMember(
  member: LoyaltyMember,
  tierConfig?: PlatformSettings["loyaltyTiers"]
): Promise<LoyaltyMember> {
  const effectiveTierConfig = tierConfig ?? DEFAULT_PLATFORM_SETTINGS.loyaltyTiers;
  const normalizedMember: LoyaltyMember = {
    ...member,
    tier: resolveAuthoritativeMemberTier(member, effectiveTierConfig),
  };
  let saved: LoyaltyMember = normalizedMember;
  await mutateSeededPersistentData<LoyaltyMember[]>(
    FILE_LOYALTY_MEMBERS,
    () => [...INITIAL_MEMBERS],
    (existing) => {
      const list = Array.isArray(existing) ? existing : [...INITIAL_MEMBERS];
      const normPhone = normalizeLoyaltyPhone(normalizedMember.phone);
      const index = list.findIndex(
        (m) => m.id === normalizedMember.id || (normPhone && normalizeLoyaltyPhone(m.phone) === normPhone)
      );
      if (index >= 0) {
        const updated = [...list];
        updated[index] = normalizedMember;
        saved = normalizedMember;
        return updated;
      }
      saved = normalizedMember;
      return [normalizedMember, ...list];
    }
  );
  return saved;
}

export async function deletePersistentLoyaltyMember(id: string): Promise<boolean> {
  await mutateSeededPersistentData<LoyaltyMember[]>(
    FILE_LOYALTY_MEMBERS,
    () => [...INITIAL_MEMBERS],
    (existing) => {
      const list = Array.isArray(existing) ? existing : [...INITIAL_MEMBERS];
      return list.filter((m) => m.id !== id);
    }
  );
  return true;
}

