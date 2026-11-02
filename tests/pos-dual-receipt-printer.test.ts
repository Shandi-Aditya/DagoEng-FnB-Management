import { describe, it, expect } from "vitest";
import {
  generateKitchenTicketText,
  generateCustomerReceiptText,
  buildIdempotencyKey,
  isJobIdempotentDuplicate,
  recoverStalePrintingJobs,
  dispatchPrintJob,
  trimQueuePreservingActionableJobs,
} from "@/lib/printer";
import {
  KitchenTicketData,
  PrintJob,
  PrinterDeviceConfig,
  DEFAULT_PRINTING_SETTINGS,
} from "@/types/printer";
import { POSReceiptData } from "@/features/pos/types";

describe("POS Dual Receipt & Kitchen Printing System", () => {
  const sampleKitchenTicket: KitchenTicketData = {
    orderId: "ord-test-101",
    orderNumber: "ORD-POS-1025",
    outletId: "outlet-sgr",
    outletName: "Dago Creative Hub Singaraja",
    tableNumber: "A-03",
    customerName: "Dimas Pratama",
    orderType: "DINE_IN",
    purpose: "NEW_ORDER",
    items: [
      {
        id: "item-1",
        productName: "Nasi Goreng Spesial",
        quantity: 2,
        modifiers: ["Telur Mata Sapi", "Pedas Sedang"],
        notes: "Tidak pakai daun bawang",
      },
      {
        id: "item-2",
        productName: "Es Kopi Susu Aren",
        quantity: 1,
        variantName: "Large",
        modifiers: ["Less Sugar (50%)", "Oat Milk"],
        notes: "Es batu dipisah",
      },
    ],
    cashierName: "Budi Santoso",
    timestamp: "10:25 WITA",
  };

  const sampleCustomerReceipt: POSReceiptData = {
    orderNumber: "INV-20261102-1025",
    date: "2 Nov 2026, 10:25",
    cashierName: "Budi Santoso",
    outletName: "Kopi Senja — Outlet Singaraja",
    tableNumber: "A-03",
    customerName: "Dimas Pratama",
    orderType: "DINE_IN",
    items: [
      {
        name: "Nasi Goreng Spesial",
        quantity: 2,
        unitPrice: 35000,
        subtotal: 70000,
        modifiers: ["Telur Mata Sapi", "Pedas Sedang"],
        notes: "Tidak pakai daun bawang",
      },
      {
        name: "Es Kopi Susu Aren",
        quantity: 1,
        unitPrice: 24000,
        subtotal: 24000,
        variantName: "Large",
        modifiers: ["Less Sugar (50%)", "Oat Milk"],
      },
    ],
    subtotal: 94000,
    tax: 9400,
    serviceCharge: 4700,
    discount: 10000,
    promoName: "PROMO HEMAT 10K",
    grandTotal: 98100,
    paymentMethod: "QRIS",
    amountPaid: 98100,
    changeDue: 0,
    receiptFooter: "Terima Kasih Atas Kunjungan Anda!",
  };

  describe("1. Kitchen Order Receipt Sanitization (Strict Operational Boundaries)", () => {
    it("harus memuat informasi operasional dapur yang lengkap dan jelas", () => {
      const output = generateKitchenTicketText(sampleKitchenTicket, {
        paperWidth: "80mm",
        settings: DEFAULT_PRINTING_SETTINGS,
      });

      expect(output).toContain("NOTA PESANAN DAPUR");
      expect(output).toContain("ORD-POS-1025");
      expect(output).toContain("A-03");
      expect(output).toContain("DINE IN");
      expect(output).toContain("Dimas Pratama");
      expect(output).toContain("Budi Santoso");
      expect(output).toContain("2x NASI GORENG SPESIAL");
      expect(output).toContain("*CATATAN: Tidak pakai daun bawang");
      expect(output).toContain("1x ES KOPI SUSU AREN");
      expect(output).toContain("Varian : Large");
      expect(output).toContain("Tambahan: Less Sugar (50%), Oat Milk");
      expect(output).toContain("MOHON DIPROSES");
    });

    it("MUTLAK: Tidak boleh membocorkan harga satuan, subtotal, pajak, diskon, atau metode pembayaran", () => {
      const output = generateKitchenTicketText(sampleKitchenTicket, {
        paperWidth: "80mm",
        settings: DEFAULT_PRINTING_SETTINGS,
      });

      // Price / Financial leak assertions
      expect(output).not.toContain("Rp");
      expect(output).not.toContain("35.000");
      expect(output).not.toContain("70.000");
      expect(output).not.toContain("24.000");
      expect(output).not.toContain("94.000");
      expect(output).not.toContain("98.100");
      expect(output).not.toContain("Subtotal");
      expect(output).not.toContain("Pajak");
      expect(output).not.toContain("PB1");
      expect(output).not.toContain("Service Charge");
      expect(output).not.toContain("Diskon");
      expect(output).not.toContain("TOTAL TAGIHAN");
      expect(output).not.toContain("QRIS");
      expect(output).not.toContain("CASH");
    });

    it("harus menampilkan header 'PESANAN TAMBAHAN' pada tiket penambahan menu", () => {
      const additionalTicket: KitchenTicketData = {
        ...sampleKitchenTicket,
        purpose: "ADDITIONAL_ORDER",
        sequenceNumber: 2,
      };

      const output = generateKitchenTicketText(additionalTicket);
      expect(output).toContain("PESANAN TAMBAHAN #2");
      expect(output).not.toContain("NOTA PESANAN DAPUR");
    });

    it("harus menampilkan stempel '** SALINAN / REPRINT **' saat dicetak ulang", () => {
      const reprintTicket: KitchenTicketData = {
        ...sampleKitchenTicket,
        purpose: "REPRINT",
        reprintedBy: "Supervisor Hendra",
      };

      const output = generateKitchenTicketText(reprintTicket);
      expect(output).toContain("** SALINAN / REPRINT **");
      expect(output).toContain("Supervisor Hendra");
    });

    it("harus menampilkan '!! PEMBATALAN PESANAN !!' saat tiket pembatalan dicetak", () => {
      const cancelTicket: KitchenTicketData = {
        ...sampleKitchenTicket,
        purpose: "CANCELLATION",
      };

      const output = generateKitchenTicketText(cancelTicket);
      expect(output).toContain("!! PEMBATALAN PESANAN !!");
    });
  });

  describe("2. Customer Receipt Generation (Financial Audit Trail)", () => {
    it("harus memuat seluruh rincian pembayaran, pajak, dan metode bayar", () => {
      const output = generateCustomerReceiptText(sampleCustomerReceipt, { paperWidth: "80mm" });

      expect(output).toContain("STRUK PEMBAYARAN KASIR");
      expect(output).toContain("INV-20261102-1025");
      expect(output).toContain("Nasi Goreng Spesial");
      expect(output).toContain("Subtotal");
      expect(output).toContain("Pajak PB1");
      expect(output).toContain("Service Charge");
      expect(output).toContain("Diskon");
      expect(output).toContain("TOTAL TAGIHAN");
      expect(output).toContain("Metode: QRIS");
    });
  });

  describe("3. Idempotency & Deduplication Engine", () => {
    it("harus menghasilkan idempotency key yang stabil berbasis orderId dan purpose", () => {
      const key1 = buildIdempotencyKey("ord-123", "NEW_ORDER", 1);
      const key2 = buildIdempotencyKey("ord-123", "NEW_ORDER", 1);
      const key3 = buildIdempotencyKey("ord-123", "ADDITIONAL_ORDER", 1);

      expect(key1).toBe("ord-123_NEW_ORDER_1");
      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
    });

    it("harus mendeteksi duplikasi job otomatis dari reload/double-click", () => {
      const existingQueue: PrintJob[] = [
        {
          id: "job-1",
          idempotencyKey: "ord-123_NEW_ORDER_1",
          outletId: "outlet-sgr",
          printerId: "prn-kitchen-1",
          printerName: "Printer Dapur",
          receiptType: "KITCHEN_ORDER",
          purpose: "NEW_ORDER",
          payloadText: "Sample",
          status: "SENT_TO_SPOOLER",
          attempts: 1,
          createdAt: new Date().toISOString(),
        },
      ];

      const isDup = isJobIdempotentDuplicate(existingQueue, "ord-123_NEW_ORDER_1", "NEW_ORDER");
      expect(isDup).toBe(true);
    });

    it("MUTLAK: Manual REPRINT tidak boleh terblokir oleh deduplikasi", () => {
      const existingQueue: PrintJob[] = [
        {
          id: "job-1",
          idempotencyKey: "ord-123_REPRINT_1",
          outletId: "outlet-sgr",
          printerId: "prn-kitchen-1",
          printerName: "Printer Dapur",
          receiptType: "KITCHEN_ORDER",
          purpose: "REPRINT",
          payloadText: "Sample",
          status: "SENT_TO_SPOOLER",
          attempts: 1,
          createdAt: new Date().toISOString(),
        },
      ];

      const isDup = isJobIdempotentDuplicate(existingQueue, "ord-123_REPRINT_1", "REPRINT");
      expect(isDup).toBe(false);
    });

    it("harus mengizinkan pengiriman ulang jika job sebelumnya FAILED", () => {
      const existingQueue: PrintJob[] = [
        {
          id: "job-1",
          idempotencyKey: "ord-123_NEW_ORDER_1",
          outletId: "outlet-sgr",
          printerId: "prn-kitchen-1",
          printerName: "Printer Dapur",
          receiptType: "KITCHEN_ORDER",
          purpose: "NEW_ORDER",
          payloadText: "Sample",
          status: "FAILED",
          attempts: 1,
          createdAt: new Date().toISOString(),
        },
      ];

      const isDup = isJobIdempotentDuplicate(existingQueue, "ord-123_NEW_ORDER_1", "NEW_ORDER");
      expect(isDup).toBe(false);
    });
  });

  describe("4. Persistent Queue Recovery (Stale Job Handling)", () => {
    it("harus memulihkan job yang macet dalam status 'PRINTING' saat browser crash/ditutup menjadi 'FAILED'", () => {
      const unrecoveredQueue: PrintJob[] = [
        {
          id: "job-stuck",
          outletId: "outlet-sgr",
          printerId: "prn-kitchen-1",
          printerName: "Printer Dapur",
          receiptType: "KITCHEN_ORDER",
          purpose: "NEW_ORDER",
          payloadText: "Sample",
          status: "PRINTING",
          attempts: 1,
          createdAt: new Date().toISOString(),
        },
        {
          id: "job-done",
          outletId: "outlet-sgr",
          printerId: "prn-cashier-1",
          printerName: "Printer Kasir",
          receiptType: "CUSTOMER_RECEIPT",
          purpose: "NEW_ORDER",
          payloadText: "Sample",
          status: "SENT_TO_SPOOLER",
          attempts: 1,
          createdAt: new Date().toISOString(),
        },
      ];

      const { recoveredQueue, hasChanges } = recoverStalePrintingJobs(unrecoveredQueue);

      expect(hasChanges).toBe(true);
      expect(recoveredQueue[0].status).toBe("FAILED");
      expect(recoveredQueue[0].errorInfo).toContain("Browser ditutup atau reload");
      expect(recoveredQueue[1].status).toBe("SENT_TO_SPOOLER");
    });
  });

  describe("5. Tiered Dispatch Validation & Device Status Handling", () => {
    it("harus menolak pengiriman ke printer yang berstatus NON-AKTIF", async () => {
      const inactiveDevice: PrinterDeviceConfig = {
        id: "prn-off",
        name: "Printer Rusak",
        outletId: "outlet-sgr",
        role: "KITCHEN_ORDER",
        connectionType: "LOCAL_BRIDGE",
        paperWidth: "80mm",
        isActive: false,
        isDefaultKitchen: false,
        isDefaultCustomer: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const testJob: PrintJob = {
        id: "job-test",
        outletId: "outlet-sgr",
        printerId: "prn-off",
        printerName: "Printer Rusak",
        receiptType: "KITCHEN_ORDER",
        purpose: "TEST_PRINT",
        payloadText: "Test",
        status: "PRINTING",
        attempts: 1,
        createdAt: new Date().toISOString(),
      };

      const res = await dispatchPrintJob(testJob, inactiveDevice);
      expect(res.status).toBe("FAILED");
      expect(res.errorInfo).toContain("NON-AKTIF");
    });

    it("harus menolak pengiriman jika Printer LAN belum dikonfigurasi alamat IP", async () => {
      const misconfiguredLanDevice: PrinterDeviceConfig = {
        id: "prn-lan-no-ip",
        name: "Printer LAN Belum Diatur",
        outletId: "outlet-sgr",
        role: "KITCHEN_ORDER",
        connectionType: "NETWORK_LAN_VIA_BRIDGE",
        paperWidth: "80mm",
        isActive: true,
        isDefaultKitchen: false,
        isDefaultCustomer: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const testJob: PrintJob = {
        id: "job-test-lan",
        outletId: "outlet-sgr",
        printerId: "prn-lan-no-ip",
        printerName: "Printer LAN Belum Diatur",
        receiptType: "KITCHEN_ORDER",
        purpose: "TEST_PRINT",
        payloadText: "Test",
        status: "PRINTING",
        attempts: 1,
        createdAt: new Date().toISOString(),
      };

      const res = await dispatchPrintJob(testJob, misconfiguredLanDevice);
      expect(res.status).toBe("FAILED");
      expect(res.errorInfo).toContain("Alamat IP");
    });
  });

  describe("5. Queue Preservation & Capacity Hardening", () => {
    it("tidak boleh menghapus job yang masih FAILED, OFFLINE, QUEUED, atau PRINTING saat queue dipotong", () => {
      // Buat 55 terminal jobs
      const terminalJobs: PrintJob[] = Array.from({ length: 55 }, (_, i) => ({
        id: `job-term-${i}`,
        outletId: "outlet-sgr",
        printerId: "prn-1",
        printerName: "Printer Kasir",
        receiptType: "CUSTOMER_RECEIPT",
        purpose: "NEW_ORDER",
        payloadText: "Struk",
        status: "BRIDGE_ACKNOWLEDGED",
        attempts: 1,
        createdAt: new Date().toISOString(),
      }));

      // Tambahkan 3 actionable / failed / offline jobs di tengah/akhir antrean
      const failedJob: PrintJob = {
        id: "job-failed-critical",
        outletId: "outlet-sgr",
        printerId: "prn-2",
        printerName: "Printer Dapur",
        receiptType: "KITCHEN_ORDER",
        purpose: "NEW_ORDER",
        payloadText: "Nota Dapur Butuh Tindakan",
        status: "FAILED",
        attempts: 1,
        createdAt: new Date().toISOString(),
      };

      const offlineJob: PrintJob = {
        id: "job-offline-critical",
        outletId: "outlet-sgr",
        printerId: "prn-2",
        printerName: "Printer Dapur",
        receiptType: "KITCHEN_ORDER",
        purpose: "NEW_ORDER",
        payloadText: "Nota Dapur Printer Mati",
        status: "OFFLINE",
        attempts: 1,
        createdAt: new Date().toISOString(),
      };

      const fullQueue = [...terminalJobs.slice(0, 30), failedJob, ...terminalJobs.slice(30), offlineJob];

      const trimmed = trimQueuePreservingActionableJobs(fullQueue, 50);

      // Pastikan failedJob dan offlineJob TIDAK PERNAH terhapus
      expect(trimmed.some((j) => j.id === "job-failed-critical")).toBe(true);
      expect(trimmed.some((j) => j.id === "job-offline-critical")).toBe(true);

      // Pastikan hanya terminal jobs yang dipotong ke maksimal 50
      const remainingTerminal = trimmed.filter((j) => j.status === "BRIDGE_ACKNOWLEDGED");
      expect(remainingTerminal.length).toBe(50);
      expect(trimmed.length).toBe(52); // 50 terminal + 2 actionable
    });
  });
});

