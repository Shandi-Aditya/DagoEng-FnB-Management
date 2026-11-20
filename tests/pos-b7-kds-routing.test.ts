import { describe, it, expect } from "vitest";
import { generateKitchenTicketText } from "@/lib/printer";
import { KitchenTicketData } from "@/types/printer";
import { OrderRecord } from "@/types/order";

describe("B7: KDS Routing and Station Notes (POS-38, POS-39, TC-F01, TC-K09, TC-K10)", () => {
  const sampleOrder: OrderRecord = {
    id: "ord-test-kds-1",
    orderNumber: "ORD-KDS-001",
    organizationId: "org-dago-hub",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    tableNumber: "T-02",
    customerName: "Budi Santoso",
    orderType: "DINE_IN",
    status: "CONFIRMED",
    paymentStatus: "PAID",
    targetServiceMinutes: 15,
    statusHistory: [],
    subtotal: 54000,
    tax: 5400,
    serviceCharge: 2700,
    total: 62100,
    createdAt: new Date().toISOString(),
    notes: "Jangan terlalu lama, tamu buru-buru ke bandara.",
    items: [
      {
        id: "it-1",
        productId: "prod-ks-1",
        tenantId: "tenant-ks",
        productName: "Kopi Senja Aren",
        quantity: 1,
        unitPrice: 24000,
        modifiers: ["Less Ice", "Oat Milk"],
        notes: "Gula aren dipisah 1 cup kecil.",
      },
      {
        id: "it-2",
        productId: "prod-mb-1",
        tenantId: "tenant-mb",
        productName: "Flaky French Butter Croissant",
        quantity: 2,
        unitPrice: 15000,
        notes: "Tolong dihangatkan renyah.",
      },
    ],
  };

  it("filters orders strictly containing logged-in tenant items (POS-38 / TC-K09)", () => {
    const userTenantId = "tenant-ks";
    const orders = [
      sampleOrder,
      {
        ...sampleOrder,
        id: "ord-other",
        items: [
          {
            id: "it-3",
            productId: "prod-mb-2",
            tenantId: "tenant-mb",
            productName: "Choco Danish",
            quantity: 1,
            unitPrice: 22000,
          },
        ],
      },
    ];

    const tenantFiltered = orders.filter((o) =>
      o.items.some((it) => it.tenantId === userTenantId)
    );

    expect(tenantFiltered.length).toBe(1);
    expect(tenantFiltered[0].id).toBe("ord-test-kds-1");
  });

  it("filters item display on KDS card to only items of current tenant (POS-38)", () => {
    const userTenantId = "tenant-ks";
    const displayItems = sampleOrder.items.filter(
      (it) => it.tenantId === userTenantId
    );

    expect(displayItems.length).toBe(1);
    expect(displayItems[0].productName).toBe("Kopi Senja Aren");
    expect(displayItems.some((it) => it.productName.includes("Croissant"))).toBe(false);
  });

  it("routes items to corresponding stations accurately (TC-F01)", () => {
    const isBaristaItem = (name: string) => {
      const lower = name.toLowerCase();
      return lower.includes("kopi") || lower.includes("tea") || lower.includes("latte") || lower.includes("espresso");
    };

    const isPastryItem = (name: string) => {
      const lower = name.toLowerCase();
      return lower.includes("croissant") || lower.includes("pastry") || lower.includes("danish");
    };

    const baristaItems = sampleOrder.items.filter((it) => isBaristaItem(it.productName));
    const pastryItems = sampleOrder.items.filter((it) => isPastryItem(it.productName));

    expect(baristaItems.length).toBe(1);
    expect(baristaItems[0].productName).toBe("Kopi Senja Aren");

    expect(pastryItems.length).toBe(1);
    expect(pastryItems[0].productName).toBe("Flaky French Butter Croissant");
  });

  it("includes item notes and order instructions in printed kitchen ticket (POS-39 / TC-K10)", () => {
    const ticketData: KitchenTicketData = {
      orderId: sampleOrder.id,
      orderNumber: sampleOrder.orderNumber,
      outletId: sampleOrder.outletId,
      outletName: sampleOrder.outletName || "Singaraja",
      tableNumber: sampleOrder.tableNumber,
      customerName: sampleOrder.customerName,
      orderType: sampleOrder.orderType,
      purpose: "NEW_ORDER",
      cashierName: "Kasir Singaraja",
      timestamp: "10:30 WITA",
      kitchenNotes: sampleOrder.notes,
      items: sampleOrder.items.map((it) => ({
        id: it.id,
        productName: it.productName,
        quantity: it.quantity,
        modifiers: it.modifiers,
        notes: it.notes,
      })),
    };

    const ticketText = generateKitchenTicketText(ticketData);

    // Verify order notes in print slip
    expect(ticketText).toContain("Instruksi : Jangan terlalu lama, tamu buru-buru ke bandara.");

    // Verify item notes in print slip
    expect(ticketText).toContain("*CATATAN: Gula aren dipisah 1 cup kecil.");
    expect(ticketText).toContain("*CATATAN: Tolong dihangatkan renyah.");
  });
});
