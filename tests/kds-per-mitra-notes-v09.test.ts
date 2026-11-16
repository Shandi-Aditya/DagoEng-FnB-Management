import { describe, it, expect } from "vitest";
import { OrderRecord, OrderItemRecord } from "@/types/order";
import {
  filterKitchenOrders,
  ticketItems,
  buildReprintTicket,
  KitchenFilters,
} from "@/features/kitchen/kitchen-board";

describe("Task V-09: KDS per Mitra + Catatan Pesanan Tampil di Dapur", () => {
  const DEFAULT_FILTERS: Omit<KitchenFilters, "tenantId"> = {
    type: "ALL",
    station: "ALL",
    multiStation: false,
  };

  it("V-09.1: Pesanan 2 mitra hanya menampilkan item miliknya di masing-masing KDS", () => {
    // Pesanan gabungan (Multi-tenant): 1x Kopi Senja (tenant-ks) + 1x Nasi Goreng (tenant-kitchen)
    const multiTenantOrder: OrderRecord = {
      id: "ord-multi-1",
      orderNumber: "ORD-KDS-001",
      organizationId: "org-1",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "T-03",
      customerName: "Rudi Hartono",
      orderType: "DINE_IN",
      status: "CONFIRMED",
      paymentStatus: "PAID",
      paymentMethod: "QRIS",
      subtotal: 65000,
      tax: 6500,
      serviceCharge: 3250,
      total: 74750,
      targetServiceMinutes: 10,
      createdAt: "2026-11-16T11:00:00.000Z",
      statusHistory: [],
      notes: "TES QA - abaikan",
      items: [
        {
          id: "it-ks-1",
          productId: "prod-ks-1",
          productName: "Kopi Senja Gula Aren",
          quantity: 2,
          unitPrice: 20000,
          tenantId: "tenant-ks",
          notes: "Sedikit es",
        },
        {
          id: "it-kitchen-1",
          productId: "prod-kit-1",
          productName: "Nasi Goreng Spesial Dapur Mama",
          quantity: 1,
          unitPrice: 25000,
          tenantId: "tenant-kitchen",
          notes: "Pedas sedang",
        },
      ],
    };

    // Pesanan khusus tenant-ks saja
    const ksOnlyOrder: OrderRecord = {
      id: "ord-ks-only",
      orderNumber: "ORD-KDS-002",
      organizationId: "org-1",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "T-05",
      customerName: "Dewi",
      orderType: "DINE_IN",
      status: "CONFIRMED",
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      subtotal: 40000,
      tax: 4000,
      serviceCharge: 2000,
      total: 46000,
      targetServiceMinutes: 10,
      createdAt: "2026-11-16T11:05:00.000Z",
      statusHistory: [],
      notes: "Meja dekat jendela",
      items: [
        {
          id: "it-ks-2",
          productId: "prod-ks-2",
          productName: "Matcha Latte Senja",
          quantity: 2,
          unitPrice: 20000,
          tenantId: "tenant-ks",
        },
      ],
    };

    // Pesanan khusus tenant-kitchen saja
    const kitchenOnlyOrder: OrderRecord = {
      id: "ord-kit-only",
      orderNumber: "ORD-KDS-003",
      organizationId: "org-1",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "-",
      customerName: "Pak Wayan",
      orderType: "TAKEAWAY",
      status: "CONFIRMED",
      paymentStatus: "PAID",
      paymentMethod: "QRIS",
      subtotal: 50000,
      tax: 5000,
      serviceCharge: 0,
      total: 55000,
      targetServiceMinutes: 15,
      createdAt: "2026-11-16T11:10:00.000Z",
      statusHistory: [],
      items: [
        {
          id: "it-kit-2",
          productId: "prod-kit-2",
          productName: "Ayam Bakar Madu Dapur Mama",
          quantity: 2,
          unitPrice: 25000,
          tenantId: "tenant-kitchen",
        },
      ],
    };

    const allOrders = [multiTenantOrder, ksOnlyOrder, kitchenOnlyOrder];

    // 1. Uji KDS Kopi Senja (tenant-ks)
    const ksOrders = filterKitchenOrders(allOrders, {
      ...DEFAULT_FILTERS,
      tenantId: "tenant-ks",
    });

    // Harus memuat pesanan multiTenantOrder dan ksOnlyOrder, TETAPI TIDAK MEMUAT kitchenOnlyOrder
    expect(ksOrders.map((o) => o.id)).toEqual(["ord-multi-1", "ord-ks-only"]);

    // Pada pesanan multiTenantOrder, tiket dapur Kopi Senja HANYA berisi item milik tenant-ks
    const ksItemsOnMulti = ticketItems(multiTenantOrder, "tenant-ks");
    expect(ksItemsOnMulti).toHaveLength(1);
    expect(ksItemsOnMulti[0].productName).toBe("Kopi Senja Gula Aren");
    expect(ksItemsOnMulti[0].tenantId).toBe("tenant-ks");

    // 2. Uji KDS Dapur Mama (tenant-kitchen)
    const kitchenOrders = filterKitchenOrders(allOrders, {
      ...DEFAULT_FILTERS,
      tenantId: "tenant-kitchen",
    });

    // Harus memuat pesanan multiTenantOrder dan kitchenOnlyOrder, TETAPI TIDAK MEMUAT ksOnlyOrder
    expect(kitchenOrders.map((o) => o.id)).toEqual(["ord-multi-1", "ord-kit-only"]);

    // Pada pesanan multiTenantOrder, tiket dapur Dapur Mama HANYA berisi item milik tenant-kitchen
    const kitchenItemsOnMulti = ticketItems(multiTenantOrder, "tenant-kitchen");
    expect(kitchenItemsOnMulti).toHaveLength(1);
    expect(kitchenItemsOnMulti[0].productName).toBe("Nasi Goreng Spesial Dapur Mama");
    expect(kitchenItemsOnMulti[0].tenantId).toBe("tenant-kitchen");
  });

  it("V-09.2: Catatan pesanan dari kasir (contoh 'TES QA - abaikan') tampil pada tiket KDS kedua mitra", () => {
    const orderWithNotes: OrderRecord = {
      id: "ord-qa-test",
      orderNumber: "ORD-KDS-999",
      organizationId: "org-1",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "T-01",
      customerName: "Auditor QA",
      orderType: "DINE_IN",
      status: "NEW",
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      subtotal: 45000,
      tax: 4500,
      serviceCharge: 2250,
      total: 51750,
      targetServiceMinutes: 10,
      createdAt: "2026-11-16T12:00:00.000Z",
      statusHistory: [],
      notes: "TES QA - abaikan",
      items: [
        {
          id: "it-1",
          productId: "p1",
          productName: "Espresso Kopi Senja",
          quantity: 1,
          unitPrice: 20000,
          tenantId: "tenant-ks",
          notes: "Single shot",
        },
        {
          id: "it-2",
          productId: "p2",
          productName: "Pisang Goreng Dapur Mama",
          quantity: 1,
          unitPrice: 25000,
          tenantId: "tenant-kitchen",
        },
      ],
    };

    // Kedua dapur melihat tiket dengan catatan order yang sama dari kasir
    expect(orderWithNotes.notes).toBe("TES QA - abaikan");

    // Reprint ticket untuk dapur Kopi Senja
    const ksItems = ticketItems(orderWithNotes, "tenant-ks");
    const ksReprint = buildReprintTicket(orderWithNotes, ksItems, 1, "12:00:00 WITA");
    expect(ksReprint.kitchenNotes).toBe("TES QA - abaikan");
    expect(ksReprint.items).toHaveLength(1);
    expect(ksReprint.items[0].productName).toBe("Espresso Kopi Senja");
    expect(ksReprint.items[0].notes).toBe("Single shot");

    // Reprint ticket untuk dapur Dapur Mama
    const kitchenItems = ticketItems(orderWithNotes, "tenant-kitchen");
    const kitchenReprint = buildReprintTicket(orderWithNotes, kitchenItems, 1, "12:00:00 WITA");
    expect(kitchenReprint.kitchenNotes).toBe("TES QA - abaikan");
    expect(kitchenReprint.items).toHaveLength(1);
    expect(kitchenReprint.items[0].productName).toBe("Pisang Goreng Dapur Mama");
  });

  it("V-09.3: Fallback tenantId otomatis memetakan item yang belum memiliki tenantId eksplisit", () => {
    // Order dengan item tanpa field tenantId eksplisit
    const legacyOrder: OrderRecord = {
      id: "ord-legacy-item",
      orderNumber: "ORD-KDS-LEGACY",
      organizationId: "org-1",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "T-08",
      customerName: "Customer Legacy",
      orderType: "DINE_IN",
      status: "CONFIRMED",
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      subtotal: 50000,
      tax: 5000,
      serviceCharge: 2500,
      total: 57500,
      targetServiceMinutes: 10,
      createdAt: "2026-11-16T12:30:00.000Z",
      statusHistory: [],
      notes: "Pesanan item legacy",
      items: [
        {
          id: "it-legacy-1",
          productName: "Kopi Senja Signature",
          quantity: 1,
          unitPrice: 25000,
        } as OrderItemRecord,
        {
          id: "it-legacy-2",
          productName: "Nasi Goreng Dapur Mama Spesial",
          quantity: 1,
          unitPrice: 25000,
        } as OrderItemRecord,
      ],
    };

    // ticketItems dengan fallback resolver berhasil memetakan item ke tenant-ks
    const ksItems = ticketItems(legacyOrder, "tenant-ks");
    expect(ksItems).toHaveLength(1);
    expect(ksItems[0].productName).toBe("Kopi Senja Signature");

    // ticketItems dengan fallback resolver berhasil memetakan item ke tenant-kitchen
    const kitchenItems = ticketItems(legacyOrder, "tenant-kitchen");
    expect(kitchenItems).toHaveLength(1);
    expect(kitchenItems[0].productName).toBe("Nasi Goreng Dapur Mama Spesial");
  });
});
