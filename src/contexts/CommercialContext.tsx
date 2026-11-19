"use client";

import React, { createContext, useContext } from "react";
import type {
  CommercialLease,
  LeasePaymentRecord,
  LeaseStatus,
} from "@/types/commercial";
import type { CommercialCommand } from "@/lib/domain-sync-types";
import {
  applyCommercialCommand,
  commercialSyncClient,
  INITIAL_LEASES,
} from "@/lib/sync-domains/spaces-spec";
import { useSyncedDomain } from "@/lib/use-synced-domain";
import { useOutlet } from "./OutletContext";
import { useActivityLog } from "./ActivityLogContext";

export { INITIAL_LEASES };

interface CommercialContextType {
  leases: CommercialLease[];
  filteredLeases: CommercialLease[];
  createLease: (
    leaseData: Omit<
      CommercialLease,
      "id" | "leaseNumber" | "createdAt" | "updatedAt" | "paymentHistory"
    >
  ) => CommercialLease;
  updateLeaseStatus: (id: string, status: LeaseStatus, reason?: string) => void;
  recordPayment: (
    leaseId: string,
    payment: Omit<LeasePaymentRecord, "id" | "leaseId">
  ) => void;
  resetCommercialData: () => void;
}

const CommercialContext = createContext<CommercialContextType | undefined>(
  undefined
);

export function CommercialProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { activeOutletId, isAllOutlets } = useOutlet();
  const { logActivity } = useActivityLog();
  const [domainState, mutateCommercial] = useSyncedDomain(
    commercialSyncClient,
    { pollMs: 10000 }
  );
  const { leases } = domainState;

  const filteredLeases = leases.filter((l) => {
    if (isAllOutlets) return true;
    return l.outletId === activeOutletId || !l.outletId;
  });

  const createLease = (
    leaseData: Omit<
      CommercialLease,
      "id" | "leaseNumber" | "createdAt" | "updatedAt" | "paymentHistory"
    >
  ): CommercialLease => {
    const currentLeases = commercialSyncClient.getSnapshot().leases;
    const nowIso = new Date().toISOString();
    const year = new Date().getFullYear();
    const existingSeqs = currentLeases.map((l) => {
      const match = l.leaseNumber.match(/(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const nextSeq = Math.max(currentLeases.length, ...existingSeqs, 0) + 1;
    const leaseNumber = `LSE-DAGO-${year}-${String(nextSeq).padStart(3, "0")}`;

    const newLease: CommercialLease = {
      ...leaseData,
      id: `lse-${Date.now()}`,
      leaseNumber,
      createdAt: nowIso,
      updatedAt: nowIso,
      paymentHistory: [],
    };

    const cmd: CommercialCommand = {
      op: "UPSERT_LEASE",
      lease: newLease,
    };

    mutateCommercial(
      (prev) => applyCommercialCommand(prev, cmd),
      { id: `lease-${newLease.id}`, isCreate: true, command: cmd }
    );

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

  const updateLeaseStatus = (
    id: string,
    status: LeaseStatus,
    reason?: string
  ) => {
    const existing = commercialSyncClient
      .getSnapshot()
      .leases.find((l) => l.id === id);
    if (!existing) return;

    const updatedAt = new Date().toISOString();
    const cmd: CommercialCommand = {
      op: "PATCH_LEASE_STATUS",
      leaseId: id,
      status,
      updatedAt,
    };

    mutateCommercial(
      (prev) => applyCommercialCommand(prev, cmd),
      { id: `lease-status-${id}`, isCreate: false, command: cmd }
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

  const recordPayment = (
    leaseId: string,
    paymentData: Omit<LeasePaymentRecord, "id" | "leaseId">
  ) => {
    const lease = commercialSyncClient
      .getSnapshot()
      .leases.find((l) => l.id === leaseId);
    if (!lease) return;

    const newPayment: LeasePaymentRecord = {
      id: `lp-${Date.now()}`,
      leaseId,
      ...paymentData,
    };

    const updatedAt = new Date().toISOString();
    const cmd: CommercialCommand = {
      op: "RECORD_LEASE_PAYMENT",
      leaseId,
      payment: newPayment,
      updatedAt,
    };

    mutateCommercial(
      (prev) => applyCommercialCommand(prev, cmd),
      { id: `lease-pay-${newPayment.id}`, isCreate: true, command: cmd }
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
    const cmd: CommercialCommand = { op: "RESET_COMMERCIAL" };
    mutateCommercial(
      (prev) => applyCommercialCommand(prev, cmd),
      { id: "commercial-reset", isCreate: false, command: cmd }
    );
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
