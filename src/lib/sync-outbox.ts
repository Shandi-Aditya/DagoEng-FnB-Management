export type OutboxHttpMethod = "POST" | "PUT" | "PATCH" | "DELETE";

export interface OutboxMutationItem {
  id: string;
  endpoint: string;
  method: OutboxHttpMethod;
  payload: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
  lastError?: string;
  seq?: number;
  isCreate?: boolean;
}

export const OUTBOX_STORAGE_KEY = "dagoeng_sync_outbox_v1";
export const OUTBOX_FLUSHED_EVENT = "dagoeng:outbox-flushed";

type OutboxFlushSummary = {
  flushedCount: number;
  remainingCount: number;
  errors: string[];
  rejected: Array<{ item: OutboxMutationItem; error: string }>;
};

let inMemoryOutboxFallback: OutboxMutationItem[] = [];
let monotonicOutboxSeq = 1;
const activeFlushPromises = new Map<typeof fetch, Promise<OutboxFlushSummary>>();
let globalListenersInstalled = false;

function nextOutboxSeq(items: readonly OutboxMutationItem[]): number {
  let maxSeq = monotonicOutboxSeq;
  for (const item of items) {
    if (typeof item.seq === "number" && item.seq >= maxSeq) {
      maxSeq = item.seq + 1;
    }
  }
  monotonicOutboxSeq = maxSeq + 1;
  return maxSeq;
}

function readOutboxStorage(): OutboxMutationItem[] {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(OUTBOX_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [...inMemoryOutboxFallback];
    }
  }
  return [...inMemoryOutboxFallback];
}

function writeOutboxStorage(items: OutboxMutationItem[]): void {
  inMemoryOutboxFallback = [...items];
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }
}

function isPlainRecord(val: unknown): val is Record<string, unknown> {
  return Boolean(val) && typeof val === "object" && !Array.isArray(val);
}

function inferIsCreate(
  method: OutboxHttpMethod,
  payload: Record<string, unknown>,
  explicit?: boolean
): boolean {
  if (typeof explicit === "boolean") return explicit;
  if (method !== "POST") return false;
  if ("command" in payload || "action" in payload) return false;
  return true;
}

function mergeCreateWithUpdatePayload(
  createPayload: Record<string, unknown>,
  updatePayload: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...createPayload };
  const entityKeys = ["employee", "product", "member", "order", "booking", "lease", "space", "plan"];
  const updatesObj = isPlainRecord(updatePayload.updates) ? updatePayload.updates : null;

  let matchedWrapperKey: string | null = null;
  for (const key of entityKeys) {
    if (isPlainRecord(merged[key])) {
      matchedWrapperKey = key;
      break;
    }
  }

  if (matchedWrapperKey) {
    const incomingEntity = isPlainRecord(updatePayload[matchedWrapperKey])
      ? (updatePayload[matchedWrapperKey] as Record<string, unknown>)
      : updatesObj ||
        Object.fromEntries(
          Object.entries(updatePayload).filter(([k]) => k !== "id" && k !== "updates")
        );
    merged[matchedWrapperKey] = {
      ...(merged[matchedWrapperKey] as Record<string, unknown>),
      ...incomingEntity,
    };
    return merged;
  }

  if (updatesObj) {
    return { ...merged, ...updatesObj };
  }

  return { ...merged, ...updatePayload };
}

function mergePatchPayloads(
  prevPayload: Record<string, unknown>,
  nextPayload: Record<string, unknown>
): Record<string, unknown> {
  if (isPlainRecord(prevPayload.updates) && isPlainRecord(nextPayload.updates)) {
    return {
      ...prevPayload,
      ...nextPayload,
      updates: {
        ...prevPayload.updates,
        ...nextPayload.updates,
      },
    };
  }
  return { ...prevPayload, ...nextPayload };
}

export function coalesceOutboxMutation(
  existing: OutboxMutationItem,
  incoming: {
    id: string;
    endpoint: string;
    method: OutboxHttpMethod;
    payload: Record<string, unknown>;
    lastError?: string;
    isCreate?: boolean;
  },
  seq: number
): OutboxMutationItem | null {
  const existingIsCreate = inferIsCreate(
    existing.method,
    existing.payload,
    existing.isCreate
  );
  const incomingIsCreate = inferIsCreate(
    incoming.method,
    incoming.payload,
    incoming.isCreate
  );

  if (existingIsCreate && incoming.method === "DELETE") {
    return null;
  }

  if (existingIsCreate && (incoming.method === "PUT" || incoming.method === "PATCH")) {
    return {
      ...existing,
      method: "POST",
      isCreate: true,
      payload: mergeCreateWithUpdatePayload(existing.payload, incoming.payload),
      retryCount: existing.retryCount + 1,
      lastError: incoming.lastError ?? existing.lastError,
      seq,
    };
  }

  if (
    (existing.method === "PUT" || existing.method === "PATCH") &&
    (incoming.method === "PUT" || incoming.method === "PATCH")
  ) {
    return {
      ...existing,
      method: incoming.method,
      isCreate: false,
      payload: mergePatchPayloads(existing.payload, incoming.payload),
      retryCount: existing.retryCount + 1,
      lastError: incoming.lastError ?? existing.lastError,
      seq,
    };
  }

  return {
    id: incoming.id,
    endpoint: incoming.endpoint,
    method: incoming.method,
    payload: incoming.payload,
    createdAt: existing.createdAt,
    retryCount: existing.retryCount + 1,
    lastError: incoming.lastError,
    isCreate: incomingIsCreate,
    seq,
  };
}

export function getOutboxItems(): OutboxMutationItem[] {
  return readOutboxStorage();
}

export function clearOutboxForTests(): void {
  activeFlushPromises.clear();
  writeOutboxStorage([]);
}

export function enqueueOutboxItem(params: {
  id: string;
  endpoint: string;
  method?: OutboxHttpMethod;
  payload: Record<string, unknown>;
  lastError?: string;
  isCreate?: boolean;
}): OutboxMutationItem[] {
  const current = readOutboxStorage();
  const method = params.method || "POST";
  const seq = nextOutboxSeq(current);
  const existingIdx = current.findIndex(
    (item) => item.id === params.id && item.endpoint === params.endpoint
  );

  if (existingIdx >= 0) {
    const coalesced = coalesceOutboxMutation(
      current[existingIdx],
      {
        id: params.id,
        endpoint: params.endpoint,
        method,
        payload: params.payload,
        lastError: params.lastError,
        isCreate: params.isCreate,
      },
      seq
    );
    if (coalesced === null) {
      current.splice(existingIdx, 1);
    } else {
      current[existingIdx] = coalesced;
    }
    writeOutboxStorage(current);
    return current;
  }

  const nextItem: OutboxMutationItem = {
    id: params.id,
    endpoint: params.endpoint,
    method,
    payload: params.payload,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    lastError: params.lastError,
    isCreate: inferIsCreate(method, params.payload, params.isCreate),
    seq,
  };

  current.push(nextItem);
  writeOutboxStorage(current);
  return current;
}

export function removeOutboxItem(
  id: string,
  endpoint?: string,
  maxSeq?: number
): OutboxMutationItem[] {
  const current = readOutboxStorage();
  const filtered = current.filter((item) => {
    const matches = item.id === id && (!endpoint || item.endpoint === endpoint);
    if (!matches) return true;
    if (
      typeof maxSeq === "number" &&
      typeof item.seq === "number" &&
      item.seq > maxSeq
    ) {
      return true;
    }
    return false;
  });
  writeOutboxStorage(filtered);
  return filtered;
}

function buildRequestUrl(
  endpoint: string,
  method: OutboxHttpMethod,
  payload: Record<string, unknown>,
  fallbackId?: string
): string {
  const targetId =
    typeof payload.id === "string" && payload.id
      ? payload.id
      : fallbackId;
  if (method === "DELETE" && !endpoint.includes("?") && targetId) {
    return `${endpoint}?id=${encodeURIComponent(targetId)}`;
  }
  return endpoint;
}

export async function syncWithOutbox<T = any>(
  params: {
    id: string;
    endpoint: string;
    method?: OutboxHttpMethod;
    payload: Record<string, unknown>;
    headers?: Record<string, string>;
    isCreate?: boolean;
    maxFlushSeq?: number;
  },
  fetchImpl: typeof fetch = fetch
): Promise<{
  synced: boolean;
  status: number;
  data: T | null;
  error?: string;
  rejected: boolean;
  pendingCount: number;
}> {
  const method = params.method || "POST";

  if (method === "DELETE") {
    const existing = readOutboxStorage().find(
      (item) => item.id === params.id && item.endpoint === params.endpoint
    );
    if (existing && inferIsCreate(existing.method, existing.payload, existing.isCreate)) {
      const remainingLocal = removeOutboxItem(params.id, params.endpoint);
      return {
        synced: true,
        status: 200,
        data: null,
        rejected: false,
        pendingCount: remainingLocal.length,
      };
    }
  }

  const seqBoundary =
    typeof params.maxFlushSeq === "number"
      ? params.maxFlushSeq
      : (() => {
          const existing = readOutboxStorage().find(
            (item) => item.id === params.id && item.endpoint === params.endpoint
          );
          return existing?.seq;
        })();

  try {
    const url = buildRequestUrl(
      params.endpoint,
      method,
      params.payload,
      params.id
    );
    const res = await fetchImpl(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(params.headers || {}),
      },
      body: JSON.stringify(params.payload),
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      const errMsg =
        data?.error || `HTTP_${res.status}: Sinkronisasi ke ${params.endpoint} gagal.`;
      if (res.status >= 500 || res.status === 401 || res.status === 408 || res.status === 429) {
        const queued = enqueueOutboxItem({
          id: params.id,
          endpoint: params.endpoint,
          method,
          payload: params.payload,
          lastError: errMsg,
          isCreate: params.isCreate,
        });
        return {
          synced: false,
          status: res.status,
          data,
          error: errMsg,
          rejected: false,
          pendingCount: queued.length,
        };
      }
      const remainingAfterReject = removeOutboxItem(
        params.id,
        params.endpoint,
        seqBoundary
      );
      return {
        synced: false,
        status: res.status,
        data,
        error: errMsg,
        rejected: true,
        pendingCount: remainingAfterReject.length,
      };
    }

    const remaining = removeOutboxItem(params.id, params.endpoint, seqBoundary);
    return {
      synced: true,
      status: res.status,
      data,
      rejected: false,
      pendingCount: remaining.length,
    };
  } catch (err: any) {
    const errMsg = err?.message || "NETWORK_ERROR: Gagal menghubungi server.";
    const queued = enqueueOutboxItem({
      id: params.id,
      endpoint: params.endpoint,
      method,
      payload: params.payload,
      lastError: errMsg,
      isCreate: params.isCreate,
    });
    return {
      synced: false,
      status: 0,
      data: null,
      error: errMsg,
      rejected: false,
      pendingCount: queued.length,
    };
  }
}

async function runFlushOutbox(fetchImpl: typeof fetch): Promise<{
  flushedCount: number;
  remainingCount: number;
  errors: string[];
  rejected: Array<{ item: OutboxMutationItem; error: string }>;
}> {
  const items = readOutboxStorage();
  if (items.length === 0) {
    return { flushedCount: 0, remainingCount: 0, errors: [], rejected: [] };
  }

  let flushedCount = 0;
  const errors: string[] = [];
  const rejected: Array<{ item: OutboxMutationItem; error: string }> = [];

  for (const item of items) {
    const result = await syncWithOutbox(
      {
        id: item.id,
        endpoint: item.endpoint,
        method: item.method,
        payload: item.payload,
        isCreate: item.isCreate,
        maxFlushSeq: item.seq,
      },
      fetchImpl
    );
    if (result.synced) {
      flushedCount += 1;
    } else if (result.error) {
      errors.push(result.error);
      if (result.rejected) {
        rejected.push({ item, error: result.error });
      }
    }
  }

  const summary = {
    flushedCount,
    remainingCount: readOutboxStorage().length,
    errors,
    rejected,
  };

  if (
    typeof window !== "undefined" &&
    (flushedCount > 0 || rejected.length > 0)
  ) {
    try {
      window.dispatchEvent(
        new CustomEvent(OUTBOX_FLUSHED_EVENT, { detail: summary })
      );
    } catch {}
  }

  return summary;
}

export async function flushOutbox(
  fetchImpl: typeof fetch = fetch
): Promise<OutboxFlushSummary> {
  const existing = activeFlushPromises.get(fetchImpl);
  if (existing) {
    return existing;
  }

  const running = runFlushOutbox(fetchImpl).finally(() => {
    activeFlushPromises.delete(fetchImpl);
  });
  activeFlushPromises.set(fetchImpl, running);
  return running;
}

export function ensureGlobalOutboxAutoFlush(): void {
  if (typeof window === "undefined" || globalListenersInstalled) return;
  if (process.env.NODE_ENV === "test") return;

  globalListenersInstalled = true;

  const triggerFlush = () => {
    if (readOutboxStorage().length > 0) {
      void flushOutbox().catch(() => {});
    }
  };

  window.addEventListener("online", triggerFlush);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        triggerFlush();
      }
    });
  }
}

export function reconcileCollectionWithOutbox<T>(params: {
  serverItems: readonly T[];
  localItems: readonly T[];
  endpoint: string;
  getId?: (item: T) => string;
}): T[] {
  const resolveId =
    params.getId || ((item: T) => String((item as Record<string, unknown>).id ?? ""));
  const pendingForEndpoint = readOutboxStorage().filter(
    (entry) => entry.endpoint === params.endpoint
  );

  const pendingDeletes = new Set<string>();
  const pendingCreates = new Set<string>();
  const pendingUpdates = new Set<string>();

  for (const entry of pendingForEndpoint) {
    const payloadEntityId =
      typeof entry.payload.id === "string"
        ? entry.payload.id
        : entry.id;
    const candidateIds = [entry.id, payloadEntityId];

    if (entry.method === "DELETE") {
      for (const cid of candidateIds) pendingDeletes.add(cid);
    } else if (inferIsCreate(entry.method, entry.payload, entry.isCreate)) {
      for (const cid of candidateIds) pendingCreates.add(cid);
    } else if (entry.method === "PUT" || entry.method === "PATCH") {
      for (const cid of candidateIds) pendingUpdates.add(cid);
    }
  }

  const localMap = new Map<string, T>();
  for (const item of params.localItems) {
    const id = resolveId(item);
    if (id) localMap.set(id, item);
  }

  const merged: T[] = [];
  const seenIds = new Set<string>();

  for (const serverItem of params.serverItems) {
    const id = resolveId(serverItem);
    if (!id || pendingDeletes.has(id)) continue;
    seenIds.add(id);
    if (pendingUpdates.has(id) && localMap.has(id)) {
      merged.push(localMap.get(id)!);
    } else {
      merged.push(serverItem);
    }
  }

  for (const localItem of params.localItems) {
    const id = resolveId(localItem);
    if (!id || seenIds.has(id) || pendingDeletes.has(id)) continue;
    if (pendingCreates.has(id)) {
      seenIds.add(id);
      merged.push(localItem);
    }
  }

  return merged;
}
