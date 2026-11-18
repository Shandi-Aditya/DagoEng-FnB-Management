"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { DomainStateMap, SyncDomainName } from "@/lib/domain-sync-types";
import type { SyncedDomainClient } from "@/lib/domain-sync";
import { flushOutbox } from "@/lib/sync-outbox";

export function useSyncedDomain<D extends SyncDomainName>(
  client: SyncedDomainClient<D>,
  options?: { pollMs?: number; rehydrateKey?: string | null }
): [
  DomainStateMap[D],
  SyncedDomainClient<D>["mutate"],
  { refresh: () => Promise<void> }
] {
  const state = useSyncExternalStore(
    client.subscribe,
    client.getSnapshot,
    client.getServerSnapshot
  );

  const pollMs = options?.pollMs;
  const rehydrateKey = options?.rehydrateKey ?? "";

  const refresh = useCallback(async () => {
    await flushOutbox().catch(() => {});
    await client.hydrate();
  }, [client]);

  useEffect(() => {
    if (process.env.NODE_ENV === "test") return;
    void refresh();
  }, [refresh, rehydrateKey]);

  useEffect(() => {
    if (!pollMs || pollMs <= 0 || process.env.NODE_ENV === "test") return;
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      void client.hydrate();
    }, pollMs);
    return () => window.clearInterval(id);
  }, [client, pollMs]);

  return [state, client.mutate, { refresh }];
}
