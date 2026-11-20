"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import {
  PrinterDeviceConfig,
  POSPrintingSettings,
  PrintJob,
  KitchenTicketData,
  PrintPurpose,
  DEFAULT_PRINTER_DEVICES,
} from "@/types/printer";
import { POSReceiptData } from "@/features/pos/types";
import type { RoleSlug } from "@/types/auth";
import { OrderRecord } from "@/types/order";
import { useAuth } from "./AuthContext";
import { useOutlet } from "./OutletContext";
import { useActivityLog } from "./ActivityLogContext";
import {
  canRoleReceiveCashierReceipt,
  canRoleReceiveKitchenReceipt,
  DEFAULT_RECEIPT_ROLE_POLICY,
  getStoredSettlementReceiptPolicy,
  saveStoredSettlementReceiptPolicy,
  SETTLEMENT_POLICY_LOCAL_KEY,
  type ReceiptRoleDistributionPolicy,
} from "@/lib/settlement-receipt-policy";
import {
  STORAGE_KEY_PRINT_QUEUE,
  buildIdempotencyKey,
  isJobIdempotentDuplicate,
  generateKitchenTicketText,
  generateCustomerReceiptText,
  getStoredPrintQueue,
  saveStoredPrintQueue,
  recoverStalePrintingJobs,
  dispatchPrintJob,
  splitKitchenTicketByTenant,
  splitCustomerReceiptByTenant,
} from "@/lib/printer";
import { getTenantName } from "@/lib/tenant";
import { useSyncedDomain } from "@/lib/use-synced-domain";
import { syncWithOutbox } from "@/lib/sync-outbox";
import {
  applyPrinterConfigCommand,
  printerConfigSyncClient,
} from "@/lib/sync-domains/config-spec";

interface PrinterContextType {
  devices: PrinterDeviceConfig[];
  settings: POSPrintingSettings;
  queue: PrintJob[];
  activeKitchenPrinter: PrinterDeviceConfig | undefined;
  activeCustomerPrinter: PrinterDeviceConfig | undefined;
  addDevice: (device: Omit<PrinterDeviceConfig, "id" | "createdAt" | "updatedAt">) => void;
  updateDevice: (id: string, updates: Partial<PrinterDeviceConfig>) => void;
  deleteDevice: (id: string) => void;
  updateSettings: (updates: Partial<POSPrintingSettings>) => void;
  printKitchenOrder: (
    ticket: KitchenTicketData,
    purpose?: PrintPurpose,
    options?: { isManualReprint?: boolean; reprintedBy?: string; isSilent?: boolean }
  ) => Promise<{ success: boolean; job: PrintJob; jobs?: PrintJob[]; message: string }>;
  printCustomerReceipt: (
    receipt: POSReceiptData,
    options?: { isManualReprint?: boolean }
  ) => Promise<{ success: boolean; job: PrintJob; jobs?: PrintJob[]; message: string }>;
  printFromOrderRecord: (
    order: OrderRecord,
    purpose: PrintPurpose,
    options?: { cashierName?: string; reprintedBy?: string; sequenceNumber?: number }
  ) => Promise<{ success: boolean; job: PrintJob; message: string }>;
  retryPrintJob: (jobId: string) => Promise<{ success: boolean; job: PrintJob; message: string }>;
  testPrintDevice: (deviceId: string) => Promise<{ success: boolean; message: string }>;
  clearQueueHistory: () => void;
  canReceiveCashierReceipt: (role?: RoleSlug | string | null) => boolean;
  canReceiveKitchenReceipt: (role?: RoleSlug | string | null) => boolean;
}

const PrinterContext = createContext<PrinterContextType | undefined>(undefined);

let printerSettingsPatchSeq = 1;

function sameRoleSet(a: readonly RoleSlug[] | undefined, b: readonly RoleSlug[] | undefined): boolean {
  const normA = Array.from(new Set(a || [])).sort();
  const normB = Array.from(new Set(b || [])).sort();
  return normA.length === normB.length && normA.every((val, idx) => val === normB[idx]);
}

function withSuperAdminRole(roles: readonly RoleSlug[]): RoleSlug[] {
  return Array.from(new Set<RoleSlug>(["SUPER_ADMIN", ...roles]));
}

export function PrinterProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeOutletId, activeOutlet } = useOutlet();
  const { logActivity } = useActivityLog();

  const [printerConfig, mutatePrinterConfig] = useSyncedDomain(printerConfigSyncClient, {
    rehydrateKey: user?.id ?? null,
  });
  const devices = printerConfig.devices;
  const settings = printerConfig.settings;
  const [queue, setQueue] = useState<PrintJob[]>([]);

  useEffect(() => {
    try {
      const hasStoredPolicy = Boolean(localStorage.getItem(SETTLEMENT_POLICY_LOCAL_KEY));
      if (hasStoredPolicy) {
        const storedPolicy = getStoredSettlementReceiptPolicy();
        mutatePrinterConfig(
          (prev) => {
            if (
              sameRoleSet(
                prev.settings.cashierReceiptRoles,
                storedPolicy.receiptRoles.cashierReceiptRoles
              ) &&
              sameRoleSet(
                prev.settings.kitchenReceiptRoles,
                storedPolicy.receiptRoles.kitchenReceiptRoles
              )
            ) {
              return prev;
            }
            return {
              ...prev,
              settings: {
                ...prev.settings,
                cashierReceiptRoles: storedPolicy.receiptRoles.cashierReceiptRoles,
                kitchenReceiptRoles: storedPolicy.receiptRoles.kitchenReceiptRoles,
              },
            };
          },
          null
        );
      }

      const storedQueue = getStoredPrintQueue();
      const { recoveredQueue, hasChanges } = recoverStalePrintingJobs(storedQueue);
      setQueue(recoveredQueue);
      if (hasChanges) {
        saveStoredPrintQueue(recoveredQueue);
      }
    } catch (e) {
      console.error("Gagal inisialisasi printer storage:", e);
    }
  }, [mutatePrinterConfig]);

  useEffect(() => {
    if (process.env.NODE_ENV === "test") return;
    let active = true;
    fetch("/api/settings/settlement-receipt")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.success || !data?.policy?.receiptRoles) return;
        const nextCashier = withSuperAdminRole(
          data.policy.receiptRoles.cashierReceiptRoles || DEFAULT_RECEIPT_ROLE_POLICY.cashierReceiptRoles
        );
        const nextKitchen = withSuperAdminRole(
          data.policy.receiptRoles.kitchenReceiptRoles || DEFAULT_RECEIPT_ROLE_POLICY.kitchenReceiptRoles
        );
        saveStoredSettlementReceiptPolicy(data.policy);
        mutatePrinterConfig(
          (prev) => {
            if (
              sameRoleSet(prev.settings.cashierReceiptRoles, nextCashier) &&
              sameRoleSet(prev.settings.kitchenReceiptRoles, nextKitchen)
            ) {
              return prev;
            }
            return {
              ...prev,
              settings: {
                ...prev.settings,
                cashierReceiptRoles: nextCashier,
                kitchenReceiptRoles: nextKitchen,
              },
            };
          },
          null
        );
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [user?.id, mutatePrinterConfig]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncRolesFromStoredPolicy = () => {
      const updatedPolicy = getStoredSettlementReceiptPolicy();
      mutatePrinterConfig(
        (prev) => {
          if (
            sameRoleSet(
              prev.settings.cashierReceiptRoles,
              updatedPolicy.receiptRoles.cashierReceiptRoles
            ) &&
            sameRoleSet(
              prev.settings.kitchenReceiptRoles,
              updatedPolicy.receiptRoles.kitchenReceiptRoles
            )
          ) {
            return prev;
          }
          return {
            ...prev,
            settings: {
              ...prev.settings,
              cashierReceiptRoles: updatedPolicy.receiptRoles.cashierReceiptRoles,
              kitchenReceiptRoles: updatedPolicy.receiptRoles.kitchenReceiptRoles,
            },
          };
        },
        null
      );
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (!e.newValue) return;
      try {
        if (e.key === STORAGE_KEY_PRINT_QUEUE) {
          const updatedQueue = JSON.parse(e.newValue);
          if (Array.isArray(updatedQueue)) {
            setQueue(updatedQueue);
          }
        } else if (e.key === SETTLEMENT_POLICY_LOCAL_KEY) {
          syncRolesFromStoredPolicy();
        }
      } catch {}
    };

    window.addEventListener("storage", handleStorageEvent);
    window.addEventListener("settlement_receipt_policy_updated", syncRolesFromStoredPolicy);
    return () => {
      window.removeEventListener("storage", handleStorageEvent);
      window.removeEventListener("settlement_receipt_policy_updated", syncRolesFromStoredPolicy);
    };
  }, [mutatePrinterConfig]);

  const activeKitchenPrinter = useMemo(() => {
    const outletSpecific = devices.find(
      (d) =>
        d.isActive &&
        d.outletId === activeOutletId &&
        (d.role === "KITCHEN_ORDER" || d.role === "ALL") &&
        d.isDefaultKitchen
    );
    if (outletSpecific) return outletSpecific;

    const globalDefault = devices.find(
      (d) =>
        d.isActive &&
        d.outletId === "ALL" &&
        (d.role === "KITCHEN_ORDER" || d.role === "ALL") &&
        d.isDefaultKitchen
    );
    if (globalDefault) return globalDefault;

    return devices.find((d) => d.isActive && (d.role === "KITCHEN_ORDER" || d.role === "ALL"));
  }, [devices, activeOutletId]);

  const activeCustomerPrinter = useMemo(() => {
    const outletSpecific = devices.find(
      (d) =>
        d.isActive &&
        d.outletId === activeOutletId &&
        (d.role === "CUSTOMER_RECEIPT" || d.role === "ALL") &&
        d.isDefaultCustomer
    );
    if (outletSpecific) return outletSpecific;

    const globalDefault = devices.find(
      (d) =>
        d.isActive &&
        d.outletId === "ALL" &&
        (d.role === "CUSTOMER_RECEIPT" || d.role === "ALL") &&
        d.isDefaultCustomer
    );
    if (globalDefault) return globalDefault;

    return devices.find((d) => d.isActive && (d.role === "CUSTOMER_RECEIPT" || d.role === "ALL"));
  }, [devices, activeOutletId]);

  const addDevice = (newDev: Omit<PrinterDeviceConfig, "id" | "createdAt" | "updatedAt">) => {
    const nowIso = new Date().toISOString();
    const created: PrinterDeviceConfig = {
      ...newDev,
      id: `prn-${Date.now()}`,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const command = {
      op: "UPSERT_DEVICE" as const,
      device: created,
    };

    mutatePrinterConfig(
      (prev) => applyPrinterConfigCommand(prev, command),
      {
        id: `printer-device-${created.id}`,
        isCreate: true,
        command,
      }
    );

    logActivity({
      module: "POS",
      action: "CREATE_PRINTER",
      recordId: created.id,
      newValue: `Printer '${created.name}' (${created.connectionType})`,
      description: `Menambahkan konfigurasi printer baru: ${created.name}`,
      status: "SUCCESS",
    });
  };

  const updateDevice = (id: string, updates: Partial<PrinterDeviceConfig>) => {
    const existing = devices.find((d) => d.id === id);
    if (!existing) return;
    const nowIso = new Date().toISOString();
    const updatedDevice: PrinterDeviceConfig = {
      ...existing,
      ...updates,
      id,
      updatedAt: nowIso,
    };
    const command = {
      op: "UPSERT_DEVICE" as const,
      device: updatedDevice,
    };
    mutatePrinterConfig(
      (prev) => applyPrinterConfigCommand(prev, command),
      {
        id: `printer-device-${id}`,
        command,
      }
    );
  };

  const deleteDevice = (id: string) => {
    const target = devices.find((d) => d.id === id);
    const command = {
      op: "DELETE_DEVICE" as const,
      deviceId: id,
    };
    mutatePrinterConfig(
      (prev) => applyPrinterConfigCommand(prev, command),
      {
        id: `printer-device-${id}`,
        command,
      }
    );
    if (target) {
      logActivity({
        module: "POS",
        action: "DELETE_PRINTER",
        recordId: target.id,
        previousValue: target.name,
        description: `Menghapus printer: ${target.name}`,
        status: "SUCCESS",
      });
    }
  };

  const updateSettings = (updates: Partial<POSPrintingSettings>) => {
    const hasRoleUpdates =
      updates.cashierReceiptRoles !== undefined || updates.kitchenReceiptRoles !== undefined;

    const nextCashierRoles = withSuperAdminRole(
      updates.cashierReceiptRoles ??
        settings.cashierReceiptRoles ??
        DEFAULT_RECEIPT_ROLE_POLICY.cashierReceiptRoles
    );
    const nextKitchenRoles = withSuperAdminRole(
      updates.kitchenReceiptRoles ??
        settings.kitchenReceiptRoles ??
        DEFAULT_RECEIPT_ROLE_POLICY.kitchenReceiptRoles
    );

    const normalizedUpdates: Partial<POSPrintingSettings> = hasRoleUpdates
      ? {
          ...updates,
          cashierReceiptRoles: nextCashierRoles,
          kitchenReceiptRoles: nextKitchenRoles,
        }
      : updates;

    const seq = printerSettingsPatchSeq++;
    const command = {
      op: "PATCH_SETTINGS" as const,
      updates: normalizedUpdates,
    };

    mutatePrinterConfig(
      (prev) => applyPrinterConfigCommand(prev, command),
      {
        id: `printer-settings-patch-${Date.now()}-${seq}`,
        command,
      }
    );

    if (hasRoleUpdates) {
      const receiptRoles: ReceiptRoleDistributionPolicy = {
        cashierReceiptRoles: nextCashierRoles,
        kitchenReceiptRoles: nextKitchenRoles,
      };
      const rolesChanged =
        !sameRoleSet(settings.cashierReceiptRoles, nextCashierRoles) ||
        !sameRoleSet(settings.kitchenReceiptRoles, nextKitchenRoles);
      saveStoredSettlementReceiptPolicy({ receiptRoles });
      if (rolesChanged && typeof window !== "undefined" && process.env.NODE_ENV !== "test") {
        void syncWithOutbox({
          id: "settlement-receipt-roles",
          endpoint: "/api/settings/settlement-receipt",
          method: "PUT",
          payload: { receiptRoles },
        });
      }
    }

    logActivity({
      module: "POS",
      action: "UPDATE_PRINT_SETTINGS",
      recordId: "settings-printer",
      description: "Memperbarui preferensi pencetakan nota POS & Dapur",
      status: "SUCCESS",
    });
  };

  const printKitchenOrder = useCallback(
    async (
      ticket: KitchenTicketData,
      purpose: PrintPurpose = "NEW_ORDER",
      options?: { isManualReprint?: boolean; reprintedBy?: string; isSilent?: boolean }
    ): Promise<{ success: boolean; job: PrintJob; jobs?: PrintJob[]; message: string }> => {
      const targetPrinter = activeKitchenPrinter || DEFAULT_PRINTER_DEVICES[1];
      const seqNo = ticket.sequenceNumber || 1;
      const isSilent = options?.isSilent !== undefined ? options.isSilent : settings.silentKitchenPrint;

      const shouldSplit = settings.splitKitchenTicketPerTenant !== false;
      const ticketsToPrint = shouldSplit ? splitKitchenTicketByTenant(ticket) : [ticket];

      const createdJobs: PrintJob[] = [];
      let allSuccess = true;
      let lastResultStatus = "";

      for (let i = 0; i < ticketsToPrint.length; i++) {
        const subTicket = ticketsToPrint[i];
        const tenantSuffix = subTicket.tenantId ? `_${subTicket.tenantId}` : "";
        const idempotencyKey = `${buildIdempotencyKey(subTicket.orderId, purpose, seqNo)}${tenantSuffix}`;

        if (!options?.isManualReprint && isJobIdempotentDuplicate(queue, idempotencyKey, purpose)) {
          const existing = queue.find((j) => j.idempotencyKey === idempotencyKey);
          if (existing) {
            createdJobs.push(existing);
            continue;
          }
        }

        const payloadText = generateKitchenTicketText(
          {
            ...subTicket,
            purpose,
            reprintedBy: options?.reprintedBy,
            reprintedAt: options?.reprintedBy ? new Date().toLocaleTimeString("id-ID") : undefined,
          },
          {
            paperWidth: targetPrinter.paperWidth,
            settings,
          }
        );

        const nowIso = new Date().toISOString();
        const jobId = `job-prn-${Date.now()}-${i}-${Math.floor(100 + Math.random() * 900)}`;

        const newJob: PrintJob = {
          id: jobId,
          idempotencyKey,
          orderId: subTicket.orderId,
          orderNumber: subTicket.orderNumber,
          outletId: subTicket.outletId || activeOutletId || "outlet-sgr",
          printerId: targetPrinter.id,
          printerName: targetPrinter.name,
          receiptType: "KITCHEN_ORDER",
          purpose,
          sequenceNumber: seqNo,
          payloadText,
          status: "PRINTING",
          attempts: 1,
          lastAttemptAt: nowIso,
          createdAt: nowIso,
          reprintedBy: options?.reprintedBy,
        };

        setQueue((prev) => {
          const updated = [newJob, ...prev];
          saveStoredPrintQueue(updated);
          return updated;
        });

        const result = await dispatchPrintJob(newJob, targetPrinter, { isSilent });
        lastResultStatus = result.status;

        const finalizedJob: PrintJob = {
          ...newJob,
          status: result.status,
          errorInfo: result.errorInfo,
          completedAt:
            result.status !== "FAILED" && result.status !== "OFFLINE" ? new Date().toISOString() : undefined,
        };

        setQueue((prev) => {
          const updated = prev.map((j) => (j.id === jobId ? finalizedJob : j));
          saveStoredPrintQueue(updated);
          return updated;
        });

        createdJobs.push(finalizedJob);

        const isSuccessfulStatus =
          result.status === "BRIDGE_ACKNOWLEDGED" || result.status === "SENT_TO_SPOOLER";
        if (!isSuccessfulStatus) {
          allSuccess = false;
        }
      }

      const primaryJob = createdJobs[0] || {
        id: `job-prn-empty`,
        outletId: activeOutletId || "outlet-sgr",
        printerId: targetPrinter.id,
        printerName: targetPrinter.name,
        receiptType: "KITCHEN_ORDER" as const,
        purpose,
        payloadText: "",
        status: "FAILED" as const,
        attempts: 1,
        createdAt: new Date().toISOString(),
      };

      const countMsg = ticketsToPrint.length > 1 ? ` (${ticketsToPrint.length} nota mitra)` : "";

      return {
        success: allSuccess,
        job: primaryJob,
        jobs: createdJobs,
        message: allSuccess
          ? lastResultStatus === "BRIDGE_ACKNOWLEDGED"
            ? `Nota dapur berhasil diteruskan ke Print Bridge (${targetPrinter.name})${countMsg}.`
            : `Nota dapur dikirim ke spooler sistem (${targetPrinter.name})${countMsg}.`
          : primaryJob.errorInfo || "Gagal mencetak nota dapur.",
      };
    },
    [activeKitchenPrinter, queue, settings, activeOutletId]
  );

  const printCustomerReceipt = useCallback(
    async (
      receipt: POSReceiptData,
      options?: { isManualReprint?: boolean }
    ): Promise<{ success: boolean; job: PrintJob; jobs?: PrintJob[]; message: string }> => {
      const targetPrinter = activeCustomerPrinter || DEFAULT_PRINTER_DEVICES[0];
      const shouldSplit = Boolean(settings.splitCustomerReceiptPerTenant);
      const receiptsToPrint = shouldSplit ? splitCustomerReceiptByTenant(receipt) : [receipt];

      const createdJobs: PrintJob[] = [];
      let allSuccess = true;
      let lastErrorInfo: string | undefined;

      for (let i = 0; i < receiptsToPrint.length; i++) {
        const subReceipt = receiptsToPrint[i];
        const payloadText = generateCustomerReceiptText(subReceipt, {
          paperWidth: targetPrinter.paperWidth,
        });

        const nowIso = new Date().toISOString();
        const jobId = `job-cust-${Date.now()}-${i}-${Math.floor(100 + Math.random() * 900)}`;

        const newJob: PrintJob = {
          id: jobId,
          orderNumber: subReceipt.orderNumber,
          outletId: activeOutletId || "outlet-sgr",
          printerId: targetPrinter.id,
          printerName: targetPrinter.name,
          receiptType: "CUSTOMER_RECEIPT",
          purpose: options?.isManualReprint ? "REPRINT" : "NEW_ORDER",
          payloadText,
          status: "PRINTING",
          attempts: 1,
          lastAttemptAt: nowIso,
          createdAt: nowIso,
        };

        setQueue((prev) => {
          const updated = [newJob, ...prev];
          saveStoredPrintQueue(updated);
          return updated;
        });

        const result = await dispatchPrintJob(newJob, targetPrinter);

        const finalizedJob: PrintJob = {
          ...newJob,
          status: result.status,
          errorInfo: result.errorInfo,
          completedAt:
            result.status !== "FAILED" && result.status !== "OFFLINE" ? new Date().toISOString() : undefined,
        };

        setQueue((prev) => {
          const updated = prev.map((j) => (j.id === jobId ? finalizedJob : j));
          saveStoredPrintQueue(updated);
          return updated;
        });

        createdJobs.push(finalizedJob);

        const isSuccessfulStatus =
          result.status === "BRIDGE_ACKNOWLEDGED" || result.status === "SENT_TO_SPOOLER";
        if (!isSuccessfulStatus) {
          allSuccess = false;
          lastErrorInfo = result.errorInfo;
        }
      }

      const primaryJob = createdJobs[0] || {
        id: "job-cust-empty",
        outletId: activeOutletId || "outlet-sgr",
        printerId: targetPrinter.id,
        printerName: targetPrinter.name,
        receiptType: "CUSTOMER_RECEIPT" as const,
        purpose: options?.isManualReprint ? ("REPRINT" as const) : ("NEW_ORDER" as const),
        payloadText: "",
        status: "FAILED" as const,
        attempts: 1,
        createdAt: new Date().toISOString(),
      };

      const countMsg = receiptsToPrint.length > 1 ? ` (${receiptsToPrint.length} mitra)` : "";

      return {
        success: allSuccess,
        job: primaryJob,
        jobs: createdJobs,
        message: allSuccess
          ? `Struk pelanggan${countMsg} diteruskan ke printer kasir.`
          : lastErrorInfo || "Gagal mencetak struk kasir.",
      };
    },
    [activeCustomerPrinter, activeOutletId, settings.splitCustomerReceiptPerTenant]
  );

  const printFromOrderRecord = useCallback(
    async (
      order: OrderRecord,
      purpose: PrintPurpose,
      options?: { cashierName?: string; reprintedBy?: string; sequenceNumber?: number }
    ) => {
      const ticketData: KitchenTicketData = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        outletId: order.outletId,
        outletName: order.outletName || "",
        tableNumber: order.tableNumber,
        customerName: order.customerName,
        orderType: order.orderType,
        purpose,
        sequenceNumber: options?.sequenceNumber,
        kitchenNotes: order.notes,
        items: (order.items || []).map((i) => ({
          id: i.id,
          productName: i.productName,
          quantity: i.quantity,
          modifiers: i.modifiers,
          notes: i.notes,
          tenantId: i.tenantId,
          tenantName: getTenantName(i.tenantId),
        })),
        cashierName: options?.cashierName || order.cashierName || "Kasir / Staff",
        timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WITA",
        reprintedBy: options?.reprintedBy,
      };

      return printKitchenOrder(ticketData, purpose, {
        isManualReprint: purpose === "REPRINT",
        reprintedBy: options?.reprintedBy,
      });
    },
    [printKitchenOrder]
  );

  const retryPrintJob = async (jobId: string): Promise<{ success: boolean; job: PrintJob; message: string }> => {
    const targetJob = queue.find((j) => j.id === jobId);
    if (!targetJob) {
      throw new Error("Job antrean cetak tidak ditemukan.");
    }

    const targetPrinter =
      devices.find((d) => d.id === targetJob.printerId) ||
      activeKitchenPrinter ||
      DEFAULT_PRINTER_DEVICES[0];

    const updatedAttemptJob: PrintJob = {
      ...targetJob,
      status: "PRINTING",
      attempts: targetJob.attempts + 1,
      lastAttemptAt: new Date().toISOString(),
    };

    setQueue((prev) => {
      const updated = prev.map((j) => (j.id === jobId ? updatedAttemptJob : j));
      saveStoredPrintQueue(updated);
      return updated;
    });

    const result = await dispatchPrintJob(updatedAttemptJob, targetPrinter);

    const finalizedJob: PrintJob = {
      ...updatedAttemptJob,
      status: result.status,
      errorInfo: result.errorInfo,
      completedAt:
        result.status !== "FAILED" && result.status !== "OFFLINE" ? new Date().toISOString() : undefined,
    };

    setQueue((prev) => {
      const updated = prev.map((j) => (j.id === jobId ? finalizedJob : j));
      saveStoredPrintQueue(updated);
      return updated;
    });

    const isSuccessfulStatus =
      result.status === "BRIDGE_ACKNOWLEDGED" || result.status === "SENT_TO_SPOOLER";

    return {
      success: isSuccessfulStatus,
      job: finalizedJob,
      message: isSuccessfulStatus
        ? `Cetak ulang berhasil dikirim (${targetPrinter.name}).`
        : result.errorInfo || "Cetak ulang gagal.",
    };
  };

  const testPrintDevice = async (deviceId: string): Promise<{ success: boolean; message: string }> => {
    const target = devices.find((d) => d.id === deviceId);
    if (!target) return { success: false, message: "Printer tidak ditemukan." };

    const testTicket: KitchenTicketData = {
      orderId: `test-${Date.now()}`,
      orderNumber: "TEST-PRINT-01",
      outletId: target.outletId,
      outletName: activeOutlet?.name || "Singaraja",
      tableNumber: "TEST",
      customerName: "Uji Coba Hardware",
      orderType: "DINE_IN",
      purpose: "TEST_PRINT",
      items: [
        {
          id: "t-1",
          productName: "Test Printer Hardware Thermal",
          quantity: 1,
          variantName: target.paperWidth,
          notes: `Koneksi: ${target.connectionType}`,
        },
      ],
      cashierName: "Admin System",
      timestamp: new Date().toLocaleTimeString("id-ID") + " WITA",
    };

    const payloadText = generateKitchenTicketText(testTicket, {
      paperWidth: target.paperWidth,
      settings,
    });

    const testJob: PrintJob = {
      id: `job-test-${Date.now()}`,
      orderNumber: "TEST-01",
      outletId: target.outletId,
      printerId: target.id,
      printerName: target.name,
      receiptType: target.role === "CUSTOMER_RECEIPT" ? "CUSTOMER_RECEIPT" : "KITCHEN_ORDER",
      purpose: "TEST_PRINT",
      payloadText,
      status: "PRINTING",
      attempts: 1,
      lastAttemptAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    const result = await dispatchPrintJob(testJob, target);

    return {
      success: result.status === "BRIDGE_ACKNOWLEDGED" || result.status === "SENT_TO_SPOOLER",
      message:
        result.status === "BRIDGE_ACKNOWLEDGED"
          ? `Koneksi berhasil: Bridge lokal merespons ACK untuk printer '${target.name}'.`
          : result.status === "SENT_TO_SPOOLER"
            ? `Uji coba cetak diteruskan ke spooler sistem (${target.name}).`
            : result.errorInfo || "Koneksi printer gagal.",
    };
  };

  const clearQueueHistory = () => {
    setQueue([]);
    saveStoredPrintQueue([]);
  };

  const activeRolePolicy = useMemo<ReceiptRoleDistributionPolicy>(
    () => ({
      cashierReceiptRoles:
        settings.cashierReceiptRoles ?? DEFAULT_RECEIPT_ROLE_POLICY.cashierReceiptRoles,
      kitchenReceiptRoles:
        settings.kitchenReceiptRoles ?? DEFAULT_RECEIPT_ROLE_POLICY.kitchenReceiptRoles,
    }),
    [settings.cashierReceiptRoles, settings.kitchenReceiptRoles]
  );

  const canReceiveCashierReceipt = useCallback(
    (role?: RoleSlug | string | null) => {
      const targetRole = role !== undefined ? role : user?.role?.slug;
      return canRoleReceiveCashierReceipt(targetRole, activeRolePolicy);
    },
    [activeRolePolicy, user?.role?.slug]
  );

  const canReceiveKitchenReceipt = useCallback(
    (role?: RoleSlug | string | null) => {
      const targetRole = role !== undefined ? role : user?.role?.slug;
      return canRoleReceiveKitchenReceipt(targetRole, activeRolePolicy);
    },
    [activeRolePolicy, user?.role?.slug]
  );

  return (
    <PrinterContext.Provider
      value={{
        devices,
        settings,
        queue,
        activeKitchenPrinter,
        activeCustomerPrinter,
        addDevice,
        updateDevice,
        deleteDevice,
        updateSettings,
        printKitchenOrder,
        printCustomerReceipt,
        printFromOrderRecord,
        retryPrintJob,
        testPrintDevice,
        clearQueueHistory,
        canReceiveCashierReceipt,
        canReceiveKitchenReceipt,
      }}
    >
      {children}
    </PrinterContext.Provider>
  );
}

export function usePrinter() {
  const context = useContext(PrinterContext);
  if (!context) {
    throw new Error("usePrinter must be used within a PrinterProvider");
  }
  return context;
}
