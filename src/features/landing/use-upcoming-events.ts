"use client";

import { useEffect, useState } from "react";

import { selectUpcomingEvents } from "@/features/landing/landing-logic";
import type { PublicCommunityEvent } from "@/types/event";

type UpcomingEventsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; events: PublicCommunityEvent[] };

/** Next approved community events for the landing page. */
export function useUpcomingEvents(): UpcomingEventsState {
  const [state, setState] = useState<UpcomingEventsState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const res = await fetch("/api/events", { signal: controller.signal });
        const json: unknown = await res.json();
        const data = (json as { success?: boolean; data?: unknown }).data;
        if (!res.ok || !Array.isArray(data)) {
          setState({ status: "error" });
          return;
        }
        setState({ status: "ready", events: selectUpcomingEvents(data as PublicCommunityEvent[], Date.now()) });
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        console.error("Failed to load landing events", error);
        setState({ status: "error" });
      }
    };

    load();
    return () => controller.abort();
  }, []);

  return state;
}
