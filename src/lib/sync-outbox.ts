export interface OutboxMutationItem {
  id: string;
  endpoint: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  payload: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

export const OUTBOX_STORAGE_KEY = "dagoeng_sync_outbox_v1";

let inMemoryOutboxFallback: OutboxMutationItem[] = [];

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
    } catch {
      // Fallback remains in inMemoryOutboxFallback
    }
  }
}

export function getOutboxItems(): OutboxMutationItem[] {
  return readOutboxStorage();
}

export function clearOutboxForTests(): void {
  writeOutboxStorage([]);
}

export function enqueueOutboxItem(params: {
  id: string;
  endpoint: string;
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  payload: Record<string, unknown>;
  lastError?: string;
}): OutboxMutationItem[] {
  const current = readOutboxStorage();
  const existingIdx = current.findIndex(
    (item) => item.id === params.id && item.endpoint === params.endpoint
  );

  const nextItem: OutboxMutationItem = {
    id: params.id,
    endpoint: params.endpoint,
    method: params.method || "POST",
    payload: params.payload,
    createdAt:
      existingIdx >= 0 ? current[existingIdx].createdAt : new Date().toISOString(),
    retryCount: existingIdx >= 0 ? current[existingIdx].retryCount + 1 : 0,
    lastError: params.lastError,
  };

  if (existingIdx >= 0) {
    current[existingIdx] = nextItem;
  } else {
    current.push(nextItem);
  }

  writeOutboxStorage(current);
  return current;
}

export function removeOutboxItem(id: string, endpoint?: string): OutboxMutationItem[] {
  const current = readOutboxStorage();
  const filtered = current.filter(
    (item) => !(item.id === id && (!endpoint || item.endpoint === endpoint))
  );
  writeOutboxStorage(filtered);
  return filtered;
}

export async function syncWithOutbox<T = any>(
  params: {
    id: string;
    endpoint: string;
    method?: "POST" | "PUT" | "PATCH" | "DELETE";
    payload: Record<string, unknown>;
    headers?: Record<string, string>;
  },
  fetchImpl: typeof fetch = fetch
): Promise<{
  synced: boolean;
  status: number;
  data: T | null;
  error?: string;
  pendingCount: number;
}> {
  const method = params.method || "POST";
  try {
    const res = await fetchImpl(params.endpoint, {
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
      // Queue on 5xx / transient server failures or when explicitly retryable
      if (res.status >= 500 || res.status === 408 || res.status === 429) {
        const queued = enqueueOutboxItem({
          id: params.id,
          endpoint: params.endpoint,
          method,
          payload: params.payload,
          lastError: errMsg,
        });
        return {
          synced: false,
          status: res.status,
          data,
          error: errMsg,
          pendingCount: queued.length,
        };
      }
      return {
        synced: false,
        status: res.status,
        data,
        error: errMsg,
        pendingCount: readOutboxStorage().length,
      };
    }

    const remaining = removeOutboxItem(params.id, params.endpoint);
    return {
      synced: true,
      status: res.status,
      data,
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
    });
    return {
      synced: false,
      status: 0,
      data: null,
      error: errMsg,
      pendingCount: queued.length,
    };
  }
}

export async function flushOutbox(
  fetchImpl: typeof fetch = fetch
): Promise<{
  flushedCount: number;
  remainingCount: number;
  errors: string[];
}> {
  const items = readOutboxStorage();
  if (items.length === 0) {
    return { flushedCount: 0, remainingCount: 0, errors: [] };
  }

  let flushedCount = 0;
  const errors: string[] = [];

  for (const item of items) {
    const result = await syncWithOutbox(
      {
        id: item.id,
        endpoint: item.endpoint,
        method: item.method,
        payload: item.payload,
      },
      fetchImpl
    );
    if (result.synced) {
      flushedCount += 1;
    } else if (result.error) {
      errors.push(result.error);
    }
  }

  return {
    flushedCount,
    remainingCount: readOutboxStorage().length,
    errors,
  };
}
