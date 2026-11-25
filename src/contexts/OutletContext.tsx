"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { DEMO_OUTLETS, ACTIVE_OUTLETS, OutletItem } from "@/lib/receipt-publisher";

export { DEMO_OUTLETS, ACTIVE_OUTLETS };
export type { OutletItem };

interface CreateOutletInput {
  name: string;
  code: string;
  address: string;
  phone?: string;
  status?: OutletItem["status"];
}

const DEFAULT_ACTIVE_OUTLETS_SNAPSHOT = {
  outlets: ACTIVE_OUTLETS,
};

interface OutletContextType {
  activeOutletId: string; // 'ALL' or specific outlet id
  activeOutlet: OutletItem | null;
  outlets: OutletItem[];
  allOutlets: OutletItem[];
  outletsError: string | null;
  isAllOutlets: boolean;
  setOutlet: (outletId: string) => void;
  addOutlet: (input: CreateOutletInput) => Promise<{ ok: boolean; error?: string }>;
  updateOutlet: (id: string, patch: Partial<OutletItem>) => Promise<{ ok: boolean; error?: string }>;
  deleteOutlet: (id: string) => Promise<{ ok: boolean; error?: string }>;
}

const OutletContext = createContext<OutletContextType | undefined>(undefined);

export function OutletProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [allOutlets, setAllOutlets] = useState<OutletItem[]>(DEMO_OUTLETS);
  const [activeOutletId, setActiveOutletId] = useState<string>("outlet-sgr");
  const [outletsError, setOutletsError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.outlet?.id) {
      setActiveOutletId(user.outlet.id);
    } else {
      setActiveOutletId("outlet-sgr");
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/outlets")
      .then(async (res) => {
        if (!res.ok) {
          const message = `Gagal memuat daftar outlet (HTTP ${res.status}).`;
          console.warn("[OutletContext]", message);
          if (!cancelled) setOutletsError(message);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled || !data) return;
        if (data.success && Array.isArray(data.outlets) && data.outlets.length > 0) {
          setAllOutlets(data.outlets);
          setOutletsError(null);
        } else if (!data.success) {
          const message = data.error || "Gagal memuat daftar outlet.";
          console.warn("[OutletContext]", message);
          setOutletsError(message);
        }
      })
      .catch((err) => {
        console.warn("[OutletContext] Gagal menghubungi server saat memuat outlet:", err);
        if (!cancelled) {
          setOutletsError("Gagal menghubungi server saat memuat daftar outlet.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeOutlets = allOutlets.filter((o) => o.status === "ACTIVE");
  const effectiveOutlets =
    activeOutlets.length > 0 ? activeOutlets : DEFAULT_ACTIVE_OUTLETS_SNAPSHOT.outlets;
  const activeOutlet =
    allOutlets.find((o) => o.id === activeOutletId) || effectiveOutlets[0] || DEMO_OUTLETS[0];
  const isAllOutlets = false;

  const setOutlet = (outletId: string) => {
    if (outletId === "ALL") {
      setActiveOutletId(effectiveOutlets[0]?.id || "outlet-sgr");
      return;
    }
    setActiveOutletId(outletId);
  };

  const addOutlet = useCallback(async (input: CreateOutletInput) => {
    try {
      const res = await fetch("/api/outlets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { ok: false, error: data.error || "Gagal menambah outlet." };
      }
      if (Array.isArray(data.outlets)) {
        setAllOutlets(data.outlets);
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "Gagal menghubungi server saat menambah outlet." };
    }
  }, []);

  const updateOutlet = useCallback(async (id: string, patch: Partial<OutletItem>) => {
    try {
      const res = await fetch("/api/outlets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { ok: false, error: data.error || "Gagal memperbarui outlet." };
      }
      if (Array.isArray(data.outlets)) {
        setAllOutlets(data.outlets);
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "Gagal menghubungi server saat memperbarui outlet." };
    }
  }, []);

  const deleteOutlet = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/outlets?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { ok: false, error: data.error || "Gagal menghapus outlet." };
      }
      if (Array.isArray(data.outlets)) {
        setAllOutlets(data.outlets);
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "Gagal menghubungi server saat menghapus outlet." };
    }
  }, []);

  return (
    <OutletContext.Provider
      value={{
        activeOutletId,
        activeOutlet,
        outlets: effectiveOutlets,
        allOutlets,
        outletsError,
        isAllOutlets,
        setOutlet,
        addOutlet,
        updateOutlet,
        deleteOutlet,
      }}
    >
      {children}
    </OutletContext.Provider>
  );
}

export function useOutlet() {
  const context = useContext(OutletContext);
  if (!context) throw new Error("useOutlet must be used within an OutletProvider");
  return context;
}
