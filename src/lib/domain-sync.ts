import type {
  DomainCommandMap,
  DomainStateMap,
  SyncDomainName,
} from "@/lib/domain-sync-types";
import {
  ensureGlobalOutboxAutoFlush,
  getOutboxItems,
  OUTBOX_FLUSHED_EVENT,
  syncWithOutbox,
} from "@/lib/sync-outbox";

export interface OutboxCommandDescriptor<D extends SyncDomainName> {
  id: string;
  isCreate?: boolean;
  command: DomainCommandMap[D];
}

export interface LocalStorageMirrorAdapter<S> {
  readonly keys: readonly string[];
  readFromStorage(fallback: S): S;
  writeToStorage(state: S): void;
  readonly legacyWindowEvents?: readonly string[];
}

export interface SyncedDomainClient<D extends SyncDomainName> {
  readonly domain: D;
  readonly endpoint: `/api/sync/${D}`;
  getSnapshot(): DomainStateMap[D];
  getServerSnapshot(): DomainStateMap[D];
  subscribe(listener: () => void): () => void;
  mutate(
    optimisticUpdater: (prev: DomainStateMap[D]) => DomainStateMap[D],
    descriptorOrFactory:
      | OutboxCommandDescriptor<D>
      | null
      | (() => OutboxCommandDescriptor<D> | null)
  ): void;
  hydrate(): Promise<void>;
  reloadFromStorage(): void;
  resetForTests(): void;
}

function isTestNetworkDisabled(): boolean {
  return (
    process.env.NODE_ENV === "test" &&
    !(globalThis as Record<string, unknown>).__ENABLE_DOMAIN_SYNC_IN_TESTS__
  );
}

export function createSyncedDomainClient<D extends SyncDomainName>(config: {
  domain: D;
  defaultState: () => DomainStateMap[D];
  storageMirror: LocalStorageMirrorAdapter<DomainStateMap[D]>;
  reconcileServerState?: (
    serverState: DomainStateMap[D],
    localState: DomainStateMap[D],
    pendingCommands: Array<DomainCommandMap[D]>
  ) => DomainStateMap[D];
  applyCommandLocally?: (
    state: DomainStateMap[D],
    command: DomainCommandMap[D]
  ) => DomainStateMap[D];
}): SyncedDomainClient<D> {
  const endpoint = `/api/sync/${config.domain}` as const;
  const serverDefaultSnapshot = config.defaultState();
  let currentState: DomainStateMap[D] | null = null;
  let listenersAttached = false;
  let activeHydratePromise: Promise<void> | null = null;
  let isWritingMirror = false;
  const subscribers = new Set<() => void>();

  const emitChange = (dispatchLegacyEvents = true) => {
    for (const listener of subscribers) {
      listener();
    }
    if (
      dispatchLegacyEvents &&
      typeof window !== "undefined" &&
      config.storageMirror.legacyWindowEvents
    ) {
      for (const evtName of config.storageMirror.legacyWindowEvents) {
        try {
          window.dispatchEvent(new Event(evtName));
        } catch {}
      }
    }
  };

  const ensureInitialized = (): DomainStateMap[D] => {
    if (currentState !== null) return currentState;
    const base = config.defaultState();
    if (typeof window !== "undefined") {
      ensureGlobalOutboxAutoFlush();
      attachBrowserListeners();
      currentState = config.storageMirror.readFromStorage(base);
    } else {
      currentState = base;
    }
    return currentState;
  };

  const readPendingDomainCommands = (): Array<DomainCommandMap[D]> => {
    const pending = getOutboxItems().filter((item) => item.endpoint === endpoint);
    const commands: Array<DomainCommandMap[D]> = [];
    for (const item of pending) {
      const cmd = item.payload?.command as DomainCommandMap[D] | undefined;
      if (cmd && typeof cmd === "object" && "op" in cmd) {
        commands.push(cmd);
      }
    }
    return commands;
  };

  const reconcile = (
    serverState: DomainStateMap[D],
    localState: DomainStateMap[D]
  ): DomainStateMap[D] => {
    const pendingCommands = readPendingDomainCommands();
    if (config.reconcileServerState) {
      return config.reconcileServerState(serverState, localState, pendingCommands);
    }
    if (pendingCommands.length === 0 || !config.applyCommandLocally) {
      return serverState;
    }
    let replayed = serverState;
    for (const cmd of pendingCommands) {
      replayed = config.applyCommandLocally(replayed, cmd);
    }
    return replayed;
  };

  const commitState = (
    nextState: DomainStateMap[D],
    options?: { writeStorage?: boolean; legacyEvents?: boolean }
  ) => {
    currentState = nextState;
    if (options?.writeStorage !== false && typeof window !== "undefined") {
      isWritingMirror = true;
      try {
        config.storageMirror.writeToStorage(nextState);
      } finally {
        isWritingMirror = false;
      }
    }
    emitChange(options?.legacyEvents !== false);
  };

  const reloadFromStorage = () => {
    if (typeof window === "undefined") return;
    const reloaded = config.storageMirror.readFromStorage(config.defaultState());
    currentState = reloaded;
    emitChange(false);
  };

  const hydrate = async (): Promise<void> => {
    if (typeof window === "undefined" || typeof fetch === "undefined") return;
    if (isTestNetworkDisabled()) return;
    if (activeHydratePromise) return activeHydratePromise;

    activeHydratePromise = (async () => {
      try {
        const res = await fetch(endpoint, {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data?.success || !data.state) return;
        const prev = ensureInitialized();
        const next = reconcile(data.state as DomainStateMap[D], prev);
        commitState(next, { writeStorage: true, legacyEvents: true });
      } catch {}
    })().finally(() => {
      activeHydratePromise = null;
    });

    return activeHydratePromise;
  };

  const attachBrowserListeners = () => {
    if (typeof window === "undefined" || listenersAttached) return;
    listenersAttached = true;

    window.addEventListener("storage", (event: StorageEvent) => {
      if (isWritingMirror) return;
      if (!event.key || config.storageMirror.keys.includes(event.key)) {
        reloadFromStorage();
      }
    });

    window.addEventListener(OUTBOX_FLUSHED_EVENT, () => {
      void hydrate();
    });
  };

  const mutate: SyncedDomainClient<D>["mutate"] = (
    optimisticUpdater,
    descriptorOrFactory
  ) => {
    const prev = ensureInitialized();
    const descriptor =
      typeof descriptorOrFactory === "function"
        ? descriptorOrFactory()
        : descriptorOrFactory;
    const next = optimisticUpdater(prev);

    if (next !== prev) {
      commitState(next, { writeStorage: true, legacyEvents: true });
    }

    if (!descriptor) return;
    if (typeof window === "undefined" || isTestNetworkDisabled()) return;

    void syncWithOutbox<{ success: boolean; state?: DomainStateMap[D] }>({
      id: descriptor.id,
      endpoint,
      method: "POST",
      isCreate: descriptor.isCreate ?? false,
      payload: { command: descriptor.command } as Record<string, unknown>,
    }).then((res) => {
      if (res.synced && res.data?.state) {
        const latestLocal = ensureInitialized();
        const merged = reconcile(res.data.state, latestLocal);
        commitState(merged, { writeStorage: true, legacyEvents: true });
      } else if (res.rejected) {
        void hydrate();
      }
    });
  };

  return {
    domain: config.domain,
    endpoint,
    getSnapshot() {
      if (
        typeof window !== "undefined" &&
        process.env.NODE_ENV === "test"
      ) {
        return config.storageMirror.readFromStorage(config.defaultState());
      }
      return ensureInitialized();
    },
    getServerSnapshot() {
      return serverDefaultSnapshot;
    },
    subscribe(listener: () => void) {
      subscribers.add(listener);
      return () => {
        subscribers.delete(listener);
      };
    },
    mutate,
    hydrate,
    reloadFromStorage,
    resetForTests() {
      currentState = null;
      activeHydratePromise = null;
    },
  };
}
