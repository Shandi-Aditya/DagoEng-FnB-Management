"use client";

import { useEffect, useState } from "react";

import { KITCHENS, WORKSPACES } from "@/features/landing/home/home-content";
import {
  type LandingWorkspaceRow,
  selectLandingKitchens,
  selectLandingWorkspaces,
} from "@/features/landing/landing-logic";
import type { CoworkingSpaceItem } from "@/types/coworking";

interface SyncEnvelope<T> {
  success?: boolean;
  state?: T;
}

interface CoworkingSyncPayload {
  spaces?: CoworkingSpaceItem[];
}

interface TenantsSyncPayload {
  tenants?: { id?: string; name?: string; status?: string }[];
  profiles?: Record<string, { brandName?: string; status?: string } | undefined>;
}

const CACHE_TTL_MS = 30_000;

let cachedWorkspaces: { value: LandingWorkspaceRow[]; fetchedAt: number } | null = null;
let inflightWorkspaces: Promise<LandingWorkspaceRow[]> | null = null;

let cachedKitchens: { value: string[]; fetchedAt: number } | null = null;
let inflightKitchens: Promise<string[]> | null = null;

async function fetchLandingWorkspaces(): Promise<LandingWorkspaceRow[]> {
  if (cachedWorkspaces && Date.now() - cachedWorkspaces.fetchedAt < CACHE_TTL_MS) {
    return cachedWorkspaces.value;
  }
  if (!inflightWorkspaces) {
    inflightWorkspaces = fetch("/api/sync/coworking-master", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<SyncEnvelope<CoworkingSyncPayload>>) : null))
      .then((json) => {
        const next = selectLandingWorkspaces(json?.state?.spaces ?? [], WORKSPACES);
        cachedWorkspaces = { value: next, fetchedAt: Date.now() };
        return next;
      })
      .catch(() => [...WORKSPACES])
      .finally(() => {
        inflightWorkspaces = null;
      });
  }
  return inflightWorkspaces;
}

async function fetchLandingKitchens(): Promise<string[]> {
  if (cachedKitchens && Date.now() - cachedKitchens.fetchedAt < CACHE_TTL_MS) {
    return cachedKitchens.value;
  }
  if (!inflightKitchens) {
    inflightKitchens = fetch("/api/sync/tenants", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<SyncEnvelope<TenantsSyncPayload>>) : null))
      .then((json) => {
        const next = selectLandingKitchens(json?.state?.tenants ?? [], json?.state?.profiles, KITCHENS);
        cachedKitchens = { value: next, fetchedAt: Date.now() };
        return next;
      })
      .catch(() => [...KITCHENS])
      .finally(() => {
        inflightKitchens = null;
      });
  }
  return inflightKitchens;
}

/** Live Dago coworking hourly rates synced from server, initialized from actual seed defaults. */
export function useLandingWorkspaces(): readonly LandingWorkspaceRow[] {
  const [workspaces, setWorkspaces] = useState<readonly LandingWorkspaceRow[]>(
    () => cachedWorkspaces?.value ?? WORKSPACES,
  );

  useEffect(() => {
    let active = true;
    void fetchLandingWorkspaces().then((next) => {
      if (active) setWorkspaces(next);
    });
    return () => {
      active = false;
    };
  }, []);

  return workspaces;
}

/** Live active F&B partner kitchens synced from server, initialized from seed tenants. */
export function useLandingKitchens(): readonly string[] {
  const [kitchens, setKitchens] = useState<readonly string[]>(
    () => cachedKitchens?.value ?? KITCHENS,
  );

  useEffect(() => {
    let active = true;
    void fetchLandingKitchens().then((next) => {
      if (active) setKitchens(next);
    });
    return () => {
      active = false;
    };
  }, []);

  return kitchens;
}
