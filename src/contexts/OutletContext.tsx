"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";

export interface OutletItem {
  id: string;
  name: string;
  code: string;
  address: string;
  status: "ACTIVE" | "COMING_SOON" | "INACTIVE";
  badgeLabel?: string;
  isComingSoon?: boolean;
}

export const DEMO_OUTLETS: OutletItem[] = [
  {
    id: "outlet-sgr",
    name: "Singaraja (Pusat)",
    code: "KS-SGR",
    address: "Jl. Ngurah Rai No. 45, Singaraja",
    status: "ACTIVE",
    badgeLabel: "● Beroperasi Aktif",
    isComingSoon: false,
  },
  {
    id: "outlet-dps",
    name: "Denpasar",
    code: "KS-DPS",
    address: "Jl. Teuku Umar No. 88, Denpasar",
    status: "COMING_SOON",
    badgeLabel: "⏳ Segera Hadir (Ekspansi)",
    isComingSoon: true,
  },
  {
    id: "outlet-ubd",
    name: "Ubud",
    code: "KS-UBD",
    address: "Jl. Raya Ubud No. 12, Ubud",
    status: "COMING_SOON",
    badgeLabel: "⏳ Segera Hadir (Ekspansi)",
    isComingSoon: true,
  },
];

interface OutletContextType {
  activeOutletId: string; // 'ALL' or specific outlet id
  activeOutlet: OutletItem | null;
  outlets: OutletItem[];
  isAllOutlets: boolean;
  setOutlet: (outletId: string) => void;
}

const OutletContext = createContext<OutletContextType | undefined>(undefined);

export function OutletProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // Operational default is Singaraja (the only active branch)
  const [activeOutletId, setActiveOutletId] = useState<string>("outlet-sgr");

  useEffect(() => {
    // If user has specific assigned outlet, lock to it; otherwise default to Singaraja
    if (user?.outlet?.id) {
      setActiveOutletId(user.outlet.id);
    } else {
      setActiveOutletId("outlet-sgr");
    }
  }, [user]);

  const activeOutlet = DEMO_OUTLETS.find((o) => o.id === activeOutletId) || DEMO_OUTLETS[0];
  const isAllOutlets = false;

  const setOutlet = (outletId: string) => {
    // Single active outlet operational scope (Singaraja)
    if (outletId === "ALL") {
      setActiveOutletId("outlet-sgr");
      return;
    }
    setActiveOutletId(outletId);
  };

  return (
    <OutletContext.Provider
      value={{
        activeOutletId,
        activeOutlet,
        outlets: DEMO_OUTLETS,
        isAllOutlets,
        setOutlet,
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
