"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { CommercialLease, LeaseStatus, LeasePaymentRecord } from "@/types/commercial";
import { useOutlet } from "./OutletContext";
import { useActivityLog } from "./ActivityLogContext";

export const INITIAL_LEASES: CommercialLease[] = [
  {
    id: "lse-001",
    leaseNumber: "LSE-DAGO-2026-001",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    tenantName: "Artisan Leather Goods & Studio",
    tenantContact: "+62 812-3344-5566",
    tenantEmail: "contact@artisanleather.id",
    unitCode: "Lot A-01 (Ground Floor Main)",
    areaSquareMeters: 45,
    monthlyRent: 8500000,
    totalContractValue: 102000000,
    depositAmount: 17000000,
    startDate: "01 Jan 2026",
    endDate: "31 Des 2026",
    paymentSchedule: "MONTHLY",
    status: "ACTIVE",
    notes: "Tenant retail kerajinan kulit lokal. Tagihan sewa diterbitkan setiap tanggal 1.",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    paymentHistory: [],
  },
  {
    id: "lse-002",
    leaseNumber: "LSE-DAGO-2026-002",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    tenantName: "Bali Organic Skincare Lab",
    tenantContact: "+62 818-7788-9900",
    tenantEmail: "info@baliorganic.co.id",
    unitCode: "Lot A-02 (Ground Floor)",
    areaSquareMeters: 35,
    monthlyRent: 6800000,
    totalContractValue: 81600000,
    depositAmount: 13600000,
    startDate: "01 Feb 2026",
    endDate: "31 Jan 2027",
    paymentSchedule: "MONTHLY",
    status: "ACTIVE",
    notes: "Tenant perawatan kulit organik. Wajib mematuhi standar kebersihan komersial.",
    createdAt: "2026-02-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    paymentHistory: [],
  },
  {
    id: "lse-003",
    leaseNumber: "LSE-DAGO-2026-003",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    tenantName: "Creative Sound & Podcast Studio",
    tenantContact: "+62 819-2233-1100",
    tenantEmail: "podcast@creativestudio.com",
    unitCode: "Lot B-04 (Lantai 2 Mezzanine)",
    areaSquareMeters: 28,
    monthlyRent: 4200000,
    totalContractValue: 50400000,
    depositAmount: 8400000,
    startDate: "01 Jul 2026",
    endDate: "30 Jun 2027",
    paymentSchedule: "MONTHLY",
    status: "ACTIVE",
    notes: "Ruang podcast kedap suara untuk konten kreator.",
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    paymentHistory: [],
  },
];

interface CommercialContextType {
  leases: CommercialLease[];
  filteredLeases: CommercialLease[];
  createLease: (leaseData: Omit<CommercialLease, "id" | "leaseNumber" | "createdAt" | "updatedAt" | "paymentHistory">) => CommercialLease;
  updateLeaseStatus: (id: string, status: LeaseStatus, reason?: string) => void;
  recordPayment: (leaseId: string, payment: Omit<LeasePaymentRecord, "id" | "leaseId">) => void;
  resetCommercialData: () => void;
}

const CommercialContext = createContext<CommercialContextType | undefined>(undefined);
const STORAGE_KEY_COMMERCIAL = "dagoeng_commercial_leases_v3";

export function CommercialProvider({ children }: { children: React.ReactNode }) {
  const { activeOutletId, isAllOutlets, activeOutlet } = useOutlet();
  const { logActivity } = useActivityLog();
  const [leases, setLeases] = useState<CommercialLease[]>(INITIAL_LEASES);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COMMERCIAL);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLeases(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load commercial leases", e);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEY_COMMERCIAL, JSON.stringify(leases));
    } catch (e) {
      console.error("Failed to save commercial leases", e);
    }
  }, [leases, isInitialized]);

  const filteredLeases = leases.filter((l) => {
    if (isAllOutlets) return true;
    return l.outletId === activeOutletId || !l.outletId;
  });

  const createLease = (
    leaseData: Omit<CommercialLease, "id" | "leaseNumber" | "createdAt" | "updatedAt" | "paymentHistory">
  ): CommercialLease => {
    const nowIso = new Date().toISOString();
    const leaseNumber = `LSE-DAGO-${new Date().getFullYear()}-${String(leases.length + 1).padStart(3, "0")}`;

    const newLease: CommercialLease = {
      ...leaseData,
      id: `lse-${Date.now()}`,
      leaseNumber,
      createdAt: nowIso,
      updatedAt: nowIso,
      paymentHistory: [],
    };

    setLeases((prev) => [newLease, ...prev]);

    logActivity({
      module: "COMMERCIAL",
      action: "CREATE_LEASE",
      recordId: newLease.id,
      newValue: `${newLease.tenantName} (${newLease.unitCode} - Rp ${newLease.monthlyRent.toLocaleString()}/bln)`,
      description: `Pembuatan kontrak sewa komersial baru: ${newLease.tenantName} (${newLease.leaseNumber})`,
      reason: "Kontrak tenant baru disetujui",
      status: "SUCCESS",
      outletId: newLease.outletId,
      outletName: newLease.outletName,
    });

    return newLease;
  };

  const updateLeaseStatus = (id: string, status: LeaseStatus, reason?: string) => {
    const existing = leases.find((l) => l.id === id);
    if (!existing) return;

    setLeases((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, status, updatedAt: new Date().toISOString() } : l
      )
    );

    logActivity({
      module: "COMMERCIAL",
      action: "UPDATE_LEASE_STATUS",
      recordId: id,
      previousValue: `Status: ${existing.status}`,
      newValue: `Status: ${status}`,
      description: `Perubahan status kontrak sewa ${existing.tenantName} (${existing.leaseNumber})`,
      reason: reason || "Pembaruan status masa berlaku kontrak",
      status: "SUCCESS",
      outletId: existing.outletId,
      outletName: existing.outletName,
    });
  };

  const recordPayment = (leaseId: string, paymentData: Omit<LeasePaymentRecord, "id" | "leaseId">) => {
    const lease = leases.find((l) => l.id === leaseId);
    if (!lease) return;

    const newPayment: LeasePaymentRecord = {
      id: `lp-${Date.now()}`,
      leaseId,
      ...paymentData,
    };

    setLeases((prev) =>
      prev.map((l) =>
        l.id === leaseId
          ? {
              ...l,
              paymentHistory: [newPayment, ...l.paymentHistory],
              updatedAt: new Date().toISOString(),
            }
          : l
      )
    );

    logActivity({
      module: "COMMERCIAL",
      action: "LEASE_PAYMENT",
      recordId: leaseId,
      newValue: `Periode: ${paymentData.periodLabel}, Nominal: Rp ${paymentData.amount.toLocaleString()} (${paymentData.paymentMethod})`,
      description: `Penerimaan pembayaran sewa tenant ${lease.tenantName} - ${paymentData.periodLabel}`,
      reason: "Pembayaran terverifikasi lunas",
      status: "SUCCESS",
      outletId: lease.outletId,
      outletName: lease.outletName,
    });
  };

  const resetCommercialData = () => {
    setLeases(INITIAL_LEASES);
    try {
      localStorage.removeItem(STORAGE_KEY_COMMERCIAL);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <CommercialContext.Provider
      value={{
        leases,
        filteredLeases,
        createLease,
        updateLeaseStatus,
        recordPayment,
        resetCommercialData,
      }}
    >
      {children}
    </CommercialContext.Provider>
  );
}

export function useCommercial() {
  const context = useContext(CommercialContext);
  if (!context) {
    throw new Error("useCommercial must be used within a CommercialProvider");
  }
  return context;
}
