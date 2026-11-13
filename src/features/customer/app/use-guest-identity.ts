"use client";

import { useCallback, useEffect, useState } from "react";

import type { GuestIdentity } from "@/features/customer/guest-session";

const STORAGE_KEY = "dagoeng_guest_identity_v1";

function readStored(): GuestIdentity {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const { name, phone } = parsed as Record<string, unknown>;
    return { name: typeof name === "string" ? name : undefined, phone: typeof phone === "string" ? phone : undefined };
  } catch {
    return {};
  }
}

/**
 * The name and WhatsApp a guest left at checkout, kept on this device so "Aktivitas" can find their
 * orders without an account. A signed-in member's own phone and name always win over it.
 */
export function useGuestIdentity(member: GuestIdentity | null) {
  const [stored, setStored] = useState<GuestIdentity>({});

  useEffect(() => setStored(readStored()), []);

  const remember = useCallback((identity: GuestIdentity) => {
    setStored(identity);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
    } catch {
      // Private mode or full storage: the order still goes through, only "Aktivitas" loses it on reload.
    }
  }, []);

  const identity: GuestIdentity = {
    name: member?.name || stored.name,
    phone: member?.phone || stored.phone,
  };

  return { identity, remember };
}
