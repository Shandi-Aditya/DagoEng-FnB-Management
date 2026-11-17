import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateKitchenTicketText,
  splitKitchenTicketByTenant,
  dispatchPrintJob,
  buildIdempotencyKey,
  isJobIdempotentDuplicate,
} from "@/lib/printer";
import {
  KitchenTicketData,
  KitchenTicketItem,
  PrinterDeviceConfig,
  PrintJob,
  DEFAULT_PRINTING_SETTINGS,
} from "@/types/printer";
import { POSReceiptData } from "@/features/pos/types";

describe("Task V-15: Auto-Cetak Struk Kitchen Saat Kasir Mencetak Struk", () => {
  const multiTenantTicket: KitchenTicketData = {
    orderId: "ord-multi-99",
    orderNumber: "ORD-20261117-0099",
    outletId: "outlet-sgr",
    outletName: "Dago Creative Hub Singaraja",
    tableNumber: "T-05",
    customerName: "Budi Santoso",
    orderType: "DINE_IN",
    purpose: "NEW_ORDER",
    items: [
      {
        id: "item-ks-1",
        productName: "Espresso Double Shot",
        quantity: 2,
        variantName: "Hot",
        modifiers: ["Extra Shot"],
        notes: "Gelas tebal",
        tenantId: "tenant-ks",
        tenantName: "Kopi Senja",
      },
      {
        id: "item-dm-1",
        productName: "Nasi Rawon Daging",
        quantity: 1,
        variantName: "Porsi Jumbo",
        notes: "Sambal dipisah",
        tenantId: "tenant-dm",
        tenantName: "Dapur Mama",
      },
      {
        id: "item-mb-1",
        productName: "Roti Sisir Mentega",
        quantity: 3,
        tenantId: "tenant-mb",
        tenantName: "Manis Bakery",
      },
    ],
    cashierName: "Siti Rahma",
    timestamp: "14:30 WITA",
    kitchenNotes: "Tamu rombongan meja 5",
  };

  describe("Skenario 1: Pemisahan Tiket Dapur Per-Mitra (Multi-Tenant Isolation)", () => {
    it("harus memecah tiket pesanan multi-mitra menjadi tiket terpisah per masing-masing mitra", () => {
      const splitTickets = splitKitchenTicketByTenant(multiTenantTicket);

      expect(splitTickets).toHaveLength(3);

      const kopiSenjaTicket = splitTickets.find((t) => t.tenantId === "tenant-ks");
      expect(kopiSenjaTicket).toBeDefined();
      expect(kopiSenjaTicket?.tenantName).toBe("Kopi Senja");
      expect(kopiSenjaTicket?.items).toHaveLength(1);
      expect(kopiSenjaTicket?.items[0].productName).toBe("Espresso Double Shot");

      const dapurMamaTicket = splitTickets.find((t) => t.tenantId === "tenant-dm");
      expect(dapurMamaTicket).toBeDefined();
      expect(dapurMamaTicket?.tenantName).toBe("Dapur Mama");
      expect(dapurMamaTicket?.items).toHaveLength(1);
      expect(dapurMamaTicket?.items[0].productName).toBe("Nasi Rawon Daging");

      const manisBakeryTicket = splitTickets.find((t) => t.tenantId === "tenant-mb");
      expect(manisBakeryTicket).toBeDefined();
      expect(manisBakeryTicket?.tenantName).toBe("Manis Bakery");
      expect(manisBakeryTicket?.items).toHaveLength(1);
      expect(manisBakeryTicket?.items[0].productName).toBe("Roti Sisir Mentega");
    });

    it("harus mempertahankan informasi operasional (orderNumber, meja, customer, waktu) pada setiap tiket mitra", () => {
      const splitTickets = splitKitchenTicketByTenant(multiTenantTicket);

      splitTickets.forEach((ticket) => {
        expect(ticket.orderNumber).toBe("ORD-20261117-0099");
        expect(ticket.tableNumber).toBe("T-05");
        expect(ticket.customerName).toBe("Budi Santoso");
        expect(ticket.cashierName).toBe("Siti Rahma");
        expect(ticket.timestamp).toBe("14:30 WITA");
        expect(ticket.kitchenNotes).toBe("Tamu rombongan meja 5");
      });
    });

    it("harus tetap menghasilkan 1 tiket jika semua menu berasal dari 1 mitra yang sama", () => {
      const singleTenantTicket: KitchenTicketData = {
        ...multiTenantTicket,
        items: [
          {
            id: "ks-1",
            productName: "Kopi Latte",
            quantity: 1,
            tenantId: "tenant-ks",
            tenantName: "Kopi Senja",
          },
          {
            id: "ks-2",
            productName: "Americano",
            quantity: 2,
            tenantId: "tenant-ks",
            tenantName: "Kopi Senja",
          },
        ],
      };

      const splitTickets = splitKitchenTicketByTenant(singleTenantTicket);
      expect(splitTickets).toHaveLength(1);
      expect(splitTickets[0].tenantName).toBe("Kopi Senja");
      expect(splitTickets[0].items).toHaveLength(2);
    });
  });

  describe("Skenario 2: Format Struk Kitchen (Lengkap Operasional & TANPA Harga)", () => {
    it("harus memuat nama mitra, nomor pesanan, meja/takeaway, nama tamu, menu, varian, jumlah, catatan, jam", () => {
      const splitTickets = splitKitchenTicketByTenant(multiTenantTicket);
      const ksTicket = splitTickets.find((t) => t.tenantId === "tenant-ks")!;

      const ticketText = generateKitchenTicketText(ksTicket, {
        paperWidth: "80mm",
        settings: DEFAULT_PRINTING_SETTINGS,
      });

      // Elemen yang diwajibkan kriteria V-15:
      expect(ticketText).toContain("MITRA: KOPI SENJA");
      expect(ticketText).toContain("ORD-20261117-0099");
      expect(ticketText).toContain("T-05");
      expect(ticketText).toContain("Budi Santoso");
      expect(ticketText).toContain("14:30 WITA");
      expect(ticketText).toContain("2x ESPRESSO DOUBLE SHOT");
      expect(ticketText).toContain("Varian : Hot");
      expect(ticketText).toContain("Tambahan: Extra Shot");
      expect(ticketText).toContain("*CATATAN: Gelas tebal");
      expect(ticketText).toContain("Instruksi : Tamu rombongan meja 5");
    });

    it("MUTLAK: Tidak boleh membocorkan data finansial (harga, subtotal, diskon, pajak, grand total)", () => {
      const splitTickets = splitKitchenTicketByTenant(multiTenantTicket);
      const dmTicket = splitTickets.find((t) => t.tenantId === "tenant-dm")!;

      const ticketText = generateKitchenTicketText(dmTicket, {
        paperWidth: "80mm",
      });

      // Assert ketiadaan harga atau angka finansial
      expect(ticketText).not.toContain("Rp");
      expect(ticketText).not.toContain("Total");
      expect(ticketText).not.toContain("Subtotal");
      expect(ticketText).not.toContain("Pajak");
      expect(ticketText).not.toContain("PB1");
      expect(ticketText).not.toContain("Diskon");
      expect(ticketText).not.toContain("Grand Total");
      expect(ticketText).not.toContain("Metode");
      expect(ticketText).not.toContain("Kembalian");
    });
  });

  describe("Skenario 3: Cetak Senyap Tanpa Dialog Browser (Silent Print Agent & Kiosk Mode)", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("harus menyalurkan cetak ke QZ Tray agent secara senyap jika printer bertipe QZ_TRAY", async () => {
      const qzPrinter: PrinterDeviceConfig = {
        id: "prn-qz-kitchen",
        name: "Kitchen Thermal QZ Tray",
        outletId: "outlet-sgr",
        role: "KITCHEN_ORDER",
        connectionType: "QZ_TRAY",
        bridgeEndpoint: "http://localhost:8182/qz/print",
        paperWidth: "80mm",
        isActive: true,
        isDefaultKitchen: true,
        isDefaultCustomer: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockJob: PrintJob = {
        id: "job-qz-1",
        outletId: "outlet-sgr",
        printerId: qzPrinter.id,
        printerName: qzPrinter.name,
        receiptType: "KITCHEN_ORDER",
        purpose: "NEW_ORDER",
        payloadText: "TEST NOTA DAPUR QZ TRAY",
        status: "PRINTING",
        attempts: 1,
        createdAt: new Date().toISOString(),
      };

      // Mock fetch respons sukses dari agen lokal QZ Tray
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ acknowledged: true }),
      } as any);

      const result = await dispatchPrintJob(mockJob, qzPrinter, { isSilent: true });

      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost:8182/qz/print",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
      expect(result.status).toBe("BRIDGE_ACKNOWLEDGED");
    });

    it("harus menyalurkan cetak ke PrintNode cloud agent tanpa dialog peramban jika bertipe PRINTNODE", async () => {
      const pnPrinter: PrinterDeviceConfig = {
        id: "prn-pn-kitchen",
        name: "Kitchen Thermal PrintNode",
        outletId: "outlet-sgr",
        role: "KITCHEN_ORDER",
        connectionType: "PRINTNODE",
        bridgeEndpoint: "http://localhost:8080/printnode",
        paperWidth: "80mm",
        isActive: true,
        isDefaultKitchen: true,
        isDefaultCustomer: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockJob: PrintJob = {
        id: "job-pn-1",
        outletId: "outlet-sgr",
        printerId: pnPrinter.id,
        printerName: pnPrinter.name,
        receiptType: "KITCHEN_ORDER",
        purpose: "NEW_ORDER",
        payloadText: "TEST NOTA DAPUR PRINTNODE",
        status: "PRINTING",
        attempts: 1,
        createdAt: new Date().toISOString(),
      };

      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ success: true }),
      } as any);

      const result = await dispatchPrintJob(mockJob, pnPrinter, { isSilent: true });

      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost:8080/printnode",
        expect.objectContaining({
          method: "POST",
        })
      );
      expect(result.status).toBe("BRIDGE_ACKNOWLEDGED");
    });

    it("harus menyalurkan ke spooler sistem saat BROWSER_SYSTEM dijalankan", async () => {
      const browserPrinter: PrinterDeviceConfig = {
        id: "prn-browser-kiosk",
        name: "Kitchen Kiosk Browser",
        outletId: "outlet-sgr",
        role: "KITCHEN_ORDER",
        connectionType: "BROWSER_SYSTEM",
        paperWidth: "80mm",
        isActive: true,
        isDefaultKitchen: true,
        isDefaultCustomer: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockJob: PrintJob = {
        id: "job-browser-1",
        outletId: "outlet-sgr",
        printerId: browserPrinter.id,
        printerName: browserPrinter.name,
        receiptType: "KITCHEN_ORDER",
        purpose: "NEW_ORDER",
        payloadText: "TEST NOTA DAPUR KIOSK",
        status: "PRINTING",
        attempts: 1,
        createdAt: new Date().toISOString(),
      };

      const result = await dispatchPrintJob(mockJob, browserPrinter, { isSilent: true });
      expect(result.status).toBe("SENT_TO_SPOOLER");
    });
  });

  describe("Skenario 4: Auto-Cetak Kitchen Saat Kasir Cetak Struk (Simulasi Alur Kasir)", () => {
    it("harus menghasilkan print job untuk setiap mitra saat transaksi kasir dicetak", () => {
      // Simulasi receipt kasir yang memuat item dari 2 mitra
      const posReceipt: POSReceiptData = {
        orderNumber: "INV-20261117-0050",
        date: "17 Nov 2026, 14:45",
        cashierName: "Siti Rahma",
        outletName: "Dago Creative Hub Singaraja",
        tableNumber: "T-02",
        customerName: "Irene Kusuma",
        orderType: "DINE_IN",
        items: [
          {
            name: "Iced Caramel Macchiato",
            quantity: 2,
            unitPrice: 32000,
            subtotal: 64000,
            tenantId: "tenant-ks",
            tenantName: "Kopi Senja",
          },
          {
            name: "Pisang Goreng Keju",
            quantity: 1,
            unitPrice: 20000,
            subtotal: 20000,
            tenantId: "tenant-dm",
            tenantName: "Dapur Mama",
          },
        ],
        subtotal: 84000,
        tax: 8400,
        grandTotal: 92400,
        paymentMethod: "QRIS",
        amountPaid: 92400,
        changeDue: 0,
      };

      // Konversi ke KitchenTicketData seperti di ReceiptModal.tsx
      const kitchenTicket: KitchenTicketData = {
        orderId: posReceipt.orderNumber,
        orderNumber: posReceipt.orderNumber,
        outletId: "outlet-sgr",
        outletName: posReceipt.outletName || "Outlet Singaraja",
        tableNumber: posReceipt.tableNumber || "-",
        customerName: posReceipt.customerName || "Tamu",
        orderType: "DINE_IN",
        purpose: "NEW_ORDER",
        items: (posReceipt.items || []).map((item, idx) => ({
          id: `item-${idx}-${Date.now()}`,
          productName: item.name,
          quantity: item.quantity,
          tenantId: item.tenantId,
          tenantName: item.tenantName,
        })),
        cashierName: posReceipt.cashierName || "Kasir",
        timestamp: posReceipt.date || "14:45 WITA",
        isSilent: true,
      };

      const tickets = splitKitchenTicketByTenant(kitchenTicket);
      expect(tickets).toHaveLength(2);

      const ks = tickets.find((t) => t.tenantId === "tenant-ks")!;
      const dm = tickets.find((t) => t.tenantId === "tenant-dm")!;

      expect(ks.items).toHaveLength(1);
      expect(ks.items[0].productName).toBe("Iced Caramel Macchiato");

      expect(dm.items).toHaveLength(1);
      expect(dm.items[0].productName).toBe("Pisang Goreng Keju");

      // Idempotency keys harus unik per mitra agar tidak saling menimpa
      const keyKS = `${buildIdempotencyKey(ks.orderId, ks.purpose, 1)}_${ks.tenantId}`;
      const keyDM = `${buildIdempotencyKey(dm.orderId, dm.purpose, 1)}_${dm.tenantId}`;

      expect(keyKS).not.toBe(keyDM);
      expect(keyKS).toBe("INV-20261117-0050_NEW_ORDER_1_tenant-ks");
      expect(keyDM).toBe("INV-20261117-0050_NEW_ORDER_1_tenant-dm");
    });
  });
});
