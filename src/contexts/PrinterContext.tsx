"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import {
  PrinterDeviceConfig,
  POSPrintingSettings,
  PrintJob,
  KitchenTicketData,
  PrintPurpose,
  DEFAULT_PRINTER_DEVICES,
  DEFAULT_PRINTING_SETTINGS,
} from "@/types/printer";
import { POSReceiptData } from "@/features/pos/types";
import { OrderRecord } from "@/types/order";
import { useOutlet } from "./OutletContext";
import { useActivityLog } from "./ActivityLogContext";
import {
  STORAGE_KEY_PRINT_QUEUE,
  STORAGE_KEY_PRINTER_DEVICES,
  STORAGE_KEY_PRINTER_SETTINGS,
  buildIdempotencyKey,
  isJobIdempotentDuplicate,
  generateKitchenTicketText,
  generateCustomerReceiptText,
  getStoredPrintQueue,
  saveStoredPrintQueue,
  recoverStalePrintingJobs,
  dispatchPrintJob,
} from "@/lib/printer";

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
    options?: { isManualReprint?: boolean; reprintedBy?: string }
  ) => Promise<{ success: boolean; job: PrintJob; message: string }>;
  printCustomerReceipt: (
    receipt: POSReceiptData,
    options?: { isManualReprint?: boolean }
  ) => Promise<{ success: boolean; job: PrintJob; message: string }>;
  printFromOrderRecord: (
    order: OrderRecord,
    purpose: PrintPurpose,
    options?: { cashierName?: string; reprintedBy?: string; sequenceNumber?: number }
  ) => Promise<{ success: boolean; job: PrintJob; message: string }>;
  retryPrintJob: (jobId: string) => Promise<{ success: boolean; job: PrintJob; message: string }>;
  testPrintDevice: (deviceId: string) => Promise<{ success: boolean; message: string }>;
  clearQueueHistory: () => void;
}

const PrinterContext = createContext<PrinterContextType | undefined>(undefined);

export function PrinterProvider({ children }: { children: React.ReactNode }) {
  const { activeOutletId, activeOutlet } = useOutlet();
  const { logActivity } = useActivityLog();

  const [devices, setDevices] = useState<PrinterDeviceConfig[]>(DEFAULT_PRINTER_DEVICES);
  const [settings, setSettings] = useState<POSPrintingSettings>(DEFAULT_PRINTING_SETTINGS);
  const [queue, setQueue] = useState<PrintJob[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // 1. Initial Load & Recovery on Mount
  useEffect(() => {
    try {
      // Load Devices
      const savedDevices = localStorage.getItem(STORAGE_KEY_PRINTER_DEVICES);
      if (savedDevices) {
        const parsed = JSON.parse(savedDevices);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDevices(parsed);
        }
      }

      // Load Settings
      const savedSettings = localStorage.getItem(STORAGE_KEY_PRINTER_SETTINGS);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...DEFAULT_PRINTING_SETTINGS, ...parsed });
      }

      // Load & Recover Queue
      const storedQueue = getStoredPrintQueue();
      const { recoveredQueue, hasChanges } = recoverStalePrintingJobs(storedQueue);
      setQueue(recoveredQueue);
      if (hasChanges) {
        saveStoredPrintQueue(recoveredQueue);
      }
    } catch (e) {
      console.error("Gagal inisialisasi printer storage:", e);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // 1.1 Cross-Tab Storage Event Synchronization
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorageEvent = (e: StorageEvent) => {
      if (!e.newValue) return;
      try {
        if (e.key === STORAGE_KEY_PRINT_QUEUE) {
          const updatedQueue = JSON.parse(e.newValue);
          if (Array.isArray(updatedQueue)) {
            setQueue(updatedQueue);
          }
        } else if (e.key === STORAGE_KEY_PRINTER_DEVICES) {
          const updatedDevices = JSON.parse(e.newValue);
          if (Array.isArray(updatedDevices)) {
            setDevices(updatedDevices);
          }
        } else if (e.key === STORAGE_KEY_PRINTER_SETTINGS) {
          const updatedSettings = JSON.parse(e.newValue);
          if (updatedSettings && typeof updatedSettings === "object") {
            setSettings({ ...DEFAULT_PRINTING_SETTINGS, ...updatedSettings });
          }
        }
      } catch (err) {
        // Silently ignore corrupted storage messages
      }
    };

    window.addEventListener("storage", handleStorageEvent);
    return () => window.removeEventListener("storage", handleStorageEvent);
  }, []);

  // 2. Persist Devices on Change
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEY_PRINTER_DEVICES, JSON.stringify(devices));
    } catch (e) {
      console.error("Gagal menyimpan devices ke storage:", e);
    }
  }, [devices, isInitialized]);

  // 3. Persist Settings on Change
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEY_PRINTER_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error("Gagal menyimpan printer settings ke storage:", e);
    }
  }, [settings, isInitialized]);

  // 4. Resolve Active Printers for Current Active Outlet
  const activeKitchenPrinter = useMemo(() => {
    // 1st: Exact match outlet + isDefaultKitchen
    const outletSpecific = devices.find(
      (d) => d.isActive && d.outletId === activeOutletId && (d.role === "KITCHEN_ORDER" || d.role === "ALL") && d.isDefaultKitchen
    );
    if (outletSpecific) return outletSpecific;

    // 2nd: Global "ALL" + isDefaultKitchen
    const globalDefault = devices.find(
      (d) => d.isActive && d.outletId === "ALL" && (d.role === "KITCHEN_ORDER" || d.role === "ALL") && d.isDefaultKitchen
    );
    if (globalDefault) return globalDefault;

    // 3rd: Any active kitchen printer
    return devices.find((d) => d.isActive && (d.role === "KITCHEN_ORDER" || d.role === "ALL"));
  }, [devices, activeOutletId]);

  const activeCustomerPrinter = useMemo(() => {
    const outletSpecific = devices.find(
      (d) => d.isActive && d.outletId === activeOutletId && (d.role === "CUSTOMER_RECEIPT" || d.role === "ALL") && d.isDefaultCustomer
    );
    if (outletSpecific) return outletSpecific;

    const globalDefault = devices.find(
      (d) => d.isActive && d.outletId === "ALL" && (d.role === "CUSTOMER_RECEIPT" || d.role === "ALL") && d.isDefaultCustomer
    );
    if (globalDefault) return globalDefault;

    return devices.find((d) => d.isActive && (d.role === "CUSTOMER_RECEIPT" || d.role === "ALL"));
  }, [devices, activeOutletId]);

  // 5. Device Management Actions
  const addDevice = (newDev: Omit<PrinterDeviceConfig, "id" | "createdAt" | "updatedAt">) => {
    const nowIso = new Date().toISOString();
    const created: PrinterDeviceConfig = {
      ...newDev,
      id: `prn-${Date.now()}`,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setDevices((prev) => {
      // If set as default, adjust previous defaults
      let updated = [...prev];
      if (created.isDefaultKitchen) {
        updated = updated.map((d) => (d.outletId === created.outletId ? { ...d, isDefaultKitchen: false } : d));
      }
      if (created.isDefaultCustomer) {
        updated = updated.map((d) => (d.outletId === created.outletId ? { ...d, isDefaultCustomer: false } : d));
      }
      return [...updated, created];
    });

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
    const nowIso = new Date().toISOString();
    setDevices((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        return {
          ...d,
          ...updates,
          updatedAt: nowIso,
        };
      })
    );
  };

  const deleteDevice = (id: string) => {
    const target = devices.find((d) => d.id === id);
    setDevices((prev) => prev.filter((d) => d.id !== id));
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
    setSettings((prev) => ({ ...prev, ...updates }));
    logActivity({
      module: "POS",
      action: "UPDATE_PRINT_SETTINGS",
      recordId: "settings-printer",
      description: "Memperbarui preferensi pencetakan nota POS & Dapur",
      status: "SUCCESS",
    });
  };

  // 6. Kitchen Ticket Printing Engine (Non-blocking & Idempotent)
  const printKitchenOrder = useCallback(
    async (
      ticket: KitchenTicketData,
      purpose: PrintPurpose = "NEW_ORDER",
      options?: { isManualReprint?: boolean; reprintedBy?: string }
    ): Promise<{ success: boolean; job: PrintJob; message: string }> => {
      const targetPrinter = activeKitchenPrinter || DEFAULT_PRINTER_DEVICES[1];
      const seqNo = ticket.sequenceNumber || 1;
      const idempotencyKey = buildIdempotencyKey(ticket.orderId, purpose, seqNo);

      // Check Idempotency for automatic prints
      if (!options?.isManualReprint && isJobIdempotentDuplicate(queue, idempotencyKey, purpose)) {
        const existing = queue.find((j) => j.idempotencyKey === idempotencyKey);
        return {
          success: true,
          job: existing!,
          message: "Tiket pesanan sudah pernah dikirim ke printer (Deduplicated).",
        };
      }

      // Generate Ticket Text (Strictly no financial data)
      const payloadText = generateKitchenTicketText(
        {
          ...ticket,
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
      const jobId = `job-prn-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

      const newJob: PrintJob = {
        id: jobId,
        idempotencyKey,
        orderId: ticket.orderId,
        orderNumber: ticket.orderNumber,
        outletId: ticket.outletId || activeOutletId || "outlet-sgr",
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

      // Add to persistent queue
      setQueue((prev) => {
        const updated = [newJob, ...prev];
        saveStoredPrintQueue(updated);
        return updated;
      });

      // Dispatch asynchronously to prevent blocking POS transaction
      const result = await dispatchPrintJob(newJob, targetPrinter);

      // Update Job status with verifiable result
      const finalizedJob: PrintJob = {
        ...newJob,
        status: result.status,
        errorInfo: result.errorInfo,
        completedAt: result.status !== "FAILED" && result.status !== "OFFLINE" ? new Date().toISOString() : undefined,
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
          ? result.status === "BRIDGE_ACKNOWLEDGED"
            ? `Nota dapur berhasil diteruskan ke Print Bridge (${targetPrinter.name}).`
            : `Nota dapur dikirim ke spooler sistem (${targetPrinter.name}).`
          : result.errorInfo || "Gagal mencetak nota dapur.",
      };
    },
    [activeKitchenPrinter, queue, settings, activeOutletId]
  );

  // 7. Customer Receipt Printing Engine
  const printCustomerReceipt = useCallback(
    async (
      receipt: POSReceiptData,
      options?: { isManualReprint?: boolean }
    ): Promise<{ success: boolean; job: PrintJob; message: string }> => {
      const targetPrinter = activeCustomerPrinter || DEFAULT_PRINTER_DEVICES[0];
      const payloadText = generateCustomerReceiptText(receipt, {
        paperWidth: targetPrinter.paperWidth,
      });

      const nowIso = new Date().toISOString();
      const jobId = `job-cust-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

      const newJob: PrintJob = {
        id: jobId,
        orderNumber: receipt.orderNumber,
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
        completedAt: result.status !== "FAILED" && result.status !== "OFFLINE" ? new Date().toISOString() : undefined,
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
          ? "Struk pelanggan berhasil diteruskan ke printer kasir."
          : result.errorInfo || "Gagal mencetak struk kasir.",
      };
    },
    [activeCustomerPrinter, activeOutletId]
  );

  // 8. Helper to print from an OrderRecord (used by Orders page & KDS)
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
        outletName: order.outletName,
        tableNumber: order.tableNumber,
        customerName: order.customerName,
        orderType: order.orderType,
        purpose,
        sequenceNumber: options?.sequenceNumber,
        items: (order.items || []).map((i) => ({
          id: i.id,
          productName: i.productName,
          quantity: i.quantity,
          modifiers: i.modifiers,
          notes: i.notes,
        })),
        cashierName: options?.cashierName || "Kasir / Staff",
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

  // 9. Manual Retry Handler for Failed/Offline Jobs
  const retryPrintJob = async (jobId: string): Promise<{ success: boolean; job: PrintJob; message: string }> => {
    const targetJob = queue.find((j) => j.id === jobId);
    if (!targetJob) {
      throw new Error("Job antrean cetak tidak ditemukan.");
    }

    const targetPrinter = devices.find((d) => d.id === targetJob.printerId) || activeKitchenPrinter || DEFAULT_PRINTER_DEVICES[0];

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
      completedAt: result.status !== "FAILED" && result.status !== "OFFLINE" ? new Date().toISOString() : undefined,
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

  // 10. Actual Test Print against the Device Configuration
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

