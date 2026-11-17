import { describe, it, expect } from "vitest";
import {
  ticketItems,
  getNewIncomingKitchenOrders,
  filterKitchenOrders,
  type KitchenFilters,
} from "@/features/kitchen/kitchen-board";
import { getReadyWaiterOrders } from "@/features/waiter/waiter-domain";
import type { OrderRecord } from "@/types/order";

describe("Task V-14: Pop-up Notifikasi Pesanan Baru di Kitchen & Waiter", () => {
  const multiTenantOrder: OrderRecord = {
    id: "ord-v14-001",
    orderNumber: "ORD-V14-001",
    customerName: "Budi Pratama",
    orderType: "DINE_IN",
    tableNumber: "05",
    status: "CONFIRMED",
    paymentStatus: "PAID",
    paymentMethod: "QRIS",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    subtotal: 80000,
    tax: 8000,
    total: 88000,
    createdAt: "2026-11-17T11:00:00Z",
    items: [
      {
        id: "item-coffee-1",
        menuItemId: "menu-coffee",
        productName: "Kopi Senja Gula Aren",
        quantity: 2,
        unitPrice: 25000,
        tenantId: "tenant-ks",
        modifiers: ["Less Sugar", "Oat Milk"],
        notes: "Dingin",
      },
      {
        id: "item-bakery-1",
        menuItemId: "menu-bakery",
        productName: "Croissant Cokelat",
        quantity: 1,
        unitPrice: 30000,
        tenantId: "tenant-bakery",
        notes: "Hangatkan sebentar",
      },
    ],
  };

  const singleBakeryOrder: OrderRecord = {
    id: "ord-v14-002",
    orderNumber: "ORD-V14-002",
    customerName: "Siti Rahma",
    orderType: "TAKEAWAY",
    tableNumber: "TAKEAWAY",
    status: "CONFIRMED",
    paymentStatus: "PAID",
    paymentMethod: "CASH",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    subtotal: 50000,
    tax: 5000,
    total: 55000,
    createdAt: "2026-11-17T11:02:00Z",
    items: [
      {
        id: "item-bakery-2",
        menuItemId: "menu-bakery-2",
        productName: "Almond Croissant",
        quantity: 2,
        unitPrice: 25000,
        tenantId: "tenant-bakery",
      },
    ],
  };

  describe("Skenario 1: Kitchen Pop-up Notifikasi & Isolasi Item Mitra", () => {
    it("Kitchen mitra hanya menerima item milik mitranya sendiri", () => {
      // Kitchen Kopi Senja (tenant-ks)
      const ksItems = ticketItems(multiTenantOrder, "tenant-ks");
      expect(ksItems).toHaveLength(1);
      expect(ksItems[0].productName).toBe("Kopi Senja Gula Aren");
      expect(ksItems[0].tenantId).toBe("tenant-ks");

      // Kitchen Manis Bakery (tenant-bakery)
      const bakeryItems = ticketItems(multiTenantOrder, "tenant-bakery");
      expect(bakeryItems).toHaveLength(1);
      expect(bakeryItems[0].productName).toBe("Croissant Cokelat");
      expect(bakeryItems[0].tenantId).toBe("tenant-bakery");

      // Kitchen Utama / Staff Umum (ALL)
      const allItems = ticketItems(multiTenantOrder, "ALL");
      expect(allItems).toHaveLength(2);
    });

    it("getNewIncomingKitchenOrders mendeteksi pesanan baru secara real-time untuk mitra terkait", () => {
      const allOrders = [multiTenantOrder, singleBakeryOrder];

      // Kopi Senja: hanya ada 1 pesanan baru yang memuat item kopi
      const ksNewOrders = getNewIncomingKitchenOrders(allOrders, "tenant-ks");
      expect(ksNewOrders).toHaveLength(1);
      expect(ksNewOrders[0].id).toBe("ord-v14-001");

      // Manis Bakery: ada 2 pesanan baru yang memuat item bakery
      const bakeryNewOrders = getNewIncomingKitchenOrders(allOrders, "tenant-bakery");
      expect(bakeryNewOrders).toHaveLength(2);
      expect(bakeryNewOrders.map((o) => o.id)).toEqual(["ord-v14-001", "ord-v14-002"]);

      // Mitra lain yang tidak ada item di pesanan (misal Dapur Mama)
      const kitchenMamaNewOrders = getNewIncomingKitchenOrders(allOrders, "tenant-kitchen");
      expect(kitchenMamaNewOrders).toHaveLength(0);
    });

    it("tombol Terima memajukan status pesanan menjadi KITCHEN_RECEIVED dan menghilangkannya dari pop-up", () => {
      // Status awal pesanan baru: CONFIRMED
      expect(multiTenantOrder.status).toBe("CONFIRMED");

      // Simulasi aksi 'Terima' oleh kitchen
      const acceptedOrder: OrderRecord = {
        ...multiTenantOrder,
        status: "KITCHEN_RECEIVED",
        kitchenReceivedAt: "2026-11-17T11:01:00Z",
      };

      // Pesanan yang sudah KITCHEN_RECEIVED tidak lagi muncul di pop-up pesanan baru
      const newOrdersAfterAccept = getNewIncomingKitchenOrders([acceptedOrder], "tenant-ks");
      expect(newOrdersAfterAccept).toHaveLength(0);

      // Namun pesanan tetap tampil di kolom Antre pada board KDS
      const filters: KitchenFilters = {
        tenantId: "tenant-ks",
        type: "ALL",
        station: "ALL",
        multiStation: false,
      };
      const boardOrders = filterKitchenOrders([acceptedOrder], filters);
      expect(boardOrders).toHaveLength(1);
      expect(boardOrders[0].status).toBe("KITCHEN_RECEIVED");
    });

    it("dismissing modal tidak memunculkan kembali pesanan yang sama", () => {
      const dismissedIds = new Set<string>(["ord-v14-001"]);
      const remainingNewOrders = getNewIncomingKitchenOrders(
        [multiTenantOrder, singleBakeryOrder],
        "tenant-bakery",
        dismissedIds
      );

      expect(remainingNewOrders).toHaveLength(1);
      expect(remainingNewOrders[0].id).toBe("ord-v14-002");
    });
  });

  describe("Skenario 2: Waiter Pop-up Notifikasi saat Pesanan Siap Saji (READY)", () => {
    const readyOrder: OrderRecord = {
      id: "ord-v14-003",
      orderNumber: "ORD-V14-003",
      customerName: "I Wayan Dharma",
      orderType: "DINE_IN",
      tableNumber: "12",
      status: "READY",
      paymentStatus: "PAID",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      subtotal: 65000,
      total: 71500,
      createdAt: "2026-11-17T11:10:00Z",
      items: [
        {
          id: "item-ready-1",
          productName: "Nasi Goreng Spesial Dago",
          quantity: 1,
          unitPrice: 45000,
          tenantId: "tenant-kitchen",
        },
        {
          id: "item-ready-2",
          productName: "Es Teh Manis",
          quantity: 2,
          unitPrice: 10000,
          tenantId: "tenant-ks",
        },
      ],
    };

    it("getReadyWaiterOrders mendeteksi pesanan dengan status READY untuk outlet aktif", () => {
      const readyOrders = getReadyWaiterOrders([readyOrder, multiTenantOrder], "outlet-sgr");
      expect(readyOrders).toHaveLength(1);
      expect(readyOrders[0].id).toBe("ord-v14-003");
      expect(readyOrders[0].tableNumber).toBe("12");
      expect(readyOrders[0].customerName).toBe("I Wayan Dharma");
    });

    it("mengabaikan pesanan yang berada di outlet berbeda", () => {
      const otherOutletReadyOrder: OrderRecord = {
        ...readyOrder,
        id: "ord-other-outlet",
        outletId: "outlet-dps",
      };

      const readyOrders = getReadyWaiterOrders([otherOutletReadyOrder], "outlet-sgr");
      expect(readyOrders).toHaveLength(0);
    });

    it("tombol 'Tandai Disajikan' memajukan status pesanan ke SERVED dan menghilangkannya dari alert", () => {
      // Waiter mengantar ke meja dan menandai disajikan
      const servedOrder: OrderRecord = {
        ...readyOrder,
        status: "SERVED",
        servedAt: "2026-11-17T11:25:00Z",
      };

      const readyOrdersAfterServed = getReadyWaiterOrders([servedOrder], "outlet-sgr");
      expect(readyOrdersAfterServed).toHaveLength(0);
    });

    it("dismissing alert tidak memunculkan kembali pesanan siap saji yang sama", () => {
      const dismissedIds = new Set<string>(["ord-v14-003"]);
      const readyOrders = getReadyWaiterOrders([readyOrder], "outlet-sgr", dismissedIds);
      expect(readyOrders).toHaveLength(0);
    });
  });

  describe("Skenario 3: Kriteria Selesai (Kasir Bayar -> dalam 5 Detik Masuk Kitchen)", () => {
    it("simulasi pesanan baru dibayar kasir dan diterima kitchen dalam siklus polling", () => {
      // 1. Kasir menyelesaikan transaksi di POS
      const pendingPosOrder: OrderRecord = {
        id: "ord-pos-flow-1",
        orderNumber: "ORD-POS-9999",
        customerName: "Tamu Kasir",
        tableNumber: "02",
        orderType: "DINE_IN",
        status: "CONFIRMED",
        paymentStatus: "PAID",
        paymentMethod: "CASH",
        outletId: "outlet-sgr",
        subtotal: 50000,
        total: 55000,
        createdAt: new Date().toISOString(),
        items: [
          {
            id: "it-pos-1",
            productName: "Kopi Latte",
            quantity: 2,
            unitPrice: 25000,
            tenantId: "tenant-ks",
          },
        ],
      };

      // 2. Kitchen Kopi Senja menerima update melalui polling / storage
      const kitchenNewOrders = getNewIncomingKitchenOrders([pendingPosOrder], "tenant-ks");
      expect(kitchenNewOrders).toHaveLength(1);
      expect(kitchenNewOrders[0].orderNumber).toBe("ORD-POS-9999");
      expect(kitchenNewOrders[0].items[0].productName).toBe("Kopi Latte");

      // 3. Kitchen menekan Terima
      const acceptedByKitchen: OrderRecord = {
        ...pendingPosOrder,
        status: "KITCHEN_RECEIVED",
      };
      const afterAccepted = getNewIncomingKitchenOrders([acceptedByKitchen], "tenant-ks");
      expect(afterAccepted).toHaveLength(0);
    });
  });
});
