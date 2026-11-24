import { describe, expect, it } from "vitest";
import {
  allocateCategoryTaxAndService,
  calculateMixedCartTaxAndService,
} from "@/lib/tax-breakdown";
import {
  calculateSettlement,
  calculateTenantProfitSharing,
  resolveItemTenantId,
} from "@/lib/settlement";
import {
  buildOrderReceiptData,
  buildReprintKitchenTicket,
  isCoworkingOrderItem,
  normalizeTenantId,
  projectOrderForTenant,
  resolveNormalizedItemTenantId,
} from "@/features/orders/orders-domain";
import {
  filterKitchenOrders,
  getNewIncomingKitchenOrders,
  ticketItems,
} from "@/features/kitchen/kitchen-board";
import {
  generateCustomerReceiptText,
  splitCustomerReceiptByMode,
  splitKitchenTicketByTenant,
} from "@/lib/printer";
import {
  applyPlatformSettingsCommand,
  defaultPlatformSettingsState,
  defaultPrinterConfigState,
} from "@/lib/sync-domains/config-spec";
import {
  computeDashboardFnbRevenue,
  partitionOrderRevenueByUnit,
} from "@/features/dashboard/dashboard-metrics";
import { buildClosingReportData } from "@/features/employees/employees-domain";
import { toOrderBomItems } from "@/features/orders/orders-domain";
import type { OrderItemRecord, OrderRecord } from "@/types/order";

function makeMixedOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  const items: OrderItemRecord[] = [
    {
      id: "cw-hotdesk-1",
      productId: "sp-hot-1",
      productName: "Hot Desk Flex (3 Jam)",
      quantity: 1,
      unitPrice: 75000,
      tenantId: "DAGO_HUB",
      tenantName: "Dago Creative Hub (Co-Working)",
      itemType: "COWORKING",
      category: "Co-Working",
      coworkingMeta: {
        spaceId: "sp-hot-1",
        spaceName: "Hot Desk Flex",
        spaceType: "HOT_DESK",
        durationHours: 3,
        startTime: "10:00",
        endTime: "13:00",
        bookingDate: "2026-11-23",
      },
    },
    {
      id: "fnb-ks-1",
      productId: "prod-101",
      productName: "Kopi Senja Aren",
      quantity: 1,
      unitPrice: 24000,
      tenantId: "tenant-ks",
      tenantName: "Kopi Senja",
      itemType: "FNB",
      category: "Beverage",
    },
    {
      id: "fnb-ks-2",
      productId: "prod-102",
      productName: "Matcha Oat Latte",
      quantity: 1,
      unitPrice: 26000,
      tenantId: "tenant-ks",
      tenantName: "Kopi Senja",
      itemType: "FNB",
      category: "Beverage",
    },
  ];

  return {
    id: "ord-v33-mixed-1",
    orderNumber: "INV-DAGO-20261123-0001",
    organizationId: "org-dago",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    tableNumber: "HD-01",
    customerName: "Rama Wijaya",
    orderType: "DINE_IN",
    status: "CONFIRMED",
    paymentStatus: "PAID",
    paymentMethod: "QRIS",
    items,
    subtotal: 125000,
    discount: 0,
    tax: 5000,
    serviceCharge: 2500,
    taxRatePercent: 10,
    serviceChargePercent: 5,
    total: 132500,
    targetServiceMinutes: 15,
    createdAt: "2026-11-23T10:00:00.000Z",
    statusHistory: [],
    ...overrides,
  };
}

describe("V-33 Wave 1: Mixed Cart Tax, Receipt Split, Settlement, KDS Exclusion & Config", () => {
  describe("1. Mixed Category Tax & Service Charge", () => {
    it("calculates 0 PB1 & 0 service for coworking while charging 10% PB1 & 5% service only on F&B (DINE_IN)", () => {
      const calc = calculateMixedCartTaxAndService(
        [
          {
            id: "cw-1",
            productId: "sp-hot-1",
            itemType: "COWORKING",
            tenantId: "DAGO_HUB",
            price: 75000,
            quantity: 1,
          },
          {
            id: "fnb-1",
            productId: "prod-101",
            itemType: "FNB",
            tenantId: "tenant-ks",
            price: 24000,
            quantity: 1,
          },
          {
            id: "fnb-2",
            productId: "prod-102",
            itemType: "FNB",
            tenantId: "tenant-ks",
            price: 26000,
            quantity: 1,
          },
        ],
        {
          orderType: "DINE_IN",
          fnbTaxRatePercent: 10,
          isFnbTaxEnabled: true,
          fnbServiceChargePercent: 5,
          isCoworkingTaxEnabled: false,
          coworkingTaxRatePercent: 0,
        }
      );

      expect(calc.coworkingSubtotal).toBe(75000);
      expect(calc.fnbSubtotal).toBe(50000);
      expect(calc.subtotal).toBe(125000);
      expect(calc.coworkingTax).toBe(0);
      expect(calc.coworkingServiceCharge).toBe(0);
      expect(calc.fnbPb1).toBe(5000);
      expect(calc.fnbServiceCharge).toBe(2500);
      expect(calc.pb1).toBe(5000);
      expect(calc.serviceCharge).toBe(2500);
      expect(calc.total).toBe(132500);
    });

    it("applies pro-rata discount across F&B and coworking and sets serviceCharge to 0 on TAKEAWAY", () => {
      const calc = calculateMixedCartTaxAndService(
        [
          { id: "sp-hot-1", itemType: "COWORKING", price: 60000, quantity: 1 },
          { id: "prod-101", itemType: "FNB", price: 40000, quantity: 1 },
        ],
        {
          discount: 10000,
          orderType: "TAKEAWAY",
          fnbTaxRatePercent: 10,
          isFnbTaxEnabled: true,
          fnbServiceChargePercent: 5,
        }
      );

      expect(calc.coworkingDiscount).toBe(6000);
      expect(calc.fnbDiscount).toBe(4000);
      expect(calc.coworkingDpp).toBe(54000);
      expect(calc.fnbDpp).toBe(36000);
      expect(calc.fnbPb1).toBe(3600);
      expect(calc.fnbServiceCharge).toBe(0);
      expect(calc.coworkingTax).toBe(0);
      expect(calc.total).toBe(93600);
    });

    it("allocates category tax and service using largest-remainder integer rounding without leaking to coworking", () => {
      const alloc = allocateCategoryTaxAndService(
        [
          { isCoworking: true, subtotal: 75000 },
          { isCoworking: false, subtotal: 33333 },
          { isCoworking: false, subtotal: 33333 },
          { isCoworking: false, subtotal: 33334 },
        ],
        10000,
        5000
      );

      expect(alloc[0]).toEqual({ tax: 0, serviceCharge: 0 });
      expect(alloc[1].tax + alloc[2].tax + alloc[3].tax).toBe(10000);
      expect(alloc[1].serviceCharge + alloc[2].serviceCharge + alloc[3].serviceCharge).toBe(5000);
      expect(alloc[3].tax).toBe(3334);
    });
  });

  describe("2. Outlet Receipt Combine Mode (COMBINED vs SEPARATE)", () => {
    it("COMBINED returns 1 receipt with both Dago Co-Working and Mitra F&B sections", () => {
      const receipt = buildOrderReceiptData(makeMixedOrder());
      const receipts = splitCustomerReceiptByMode(receipt, {
        receiptCombineMode: "COMBINED",
        splitCustomerReceiptPerTenant: false,
      });

      expect(receipts).toHaveLength(1);
      expect(receipts[0].grandTotal).toBe(132500);

      const text = generateCustomerReceiptText(receipts[0], { paperWidth: "80mm" });
      expect(text).toContain("Dago Creative Hub (Co-Working)");
      expect(text).toContain("Kopi Senja");
      expect(text).toContain("Hot Desk Flex (3 Jam)");
      expect(text).toContain("Kopi Senja Aren");
      expect(text).toContain("132.500");
    });

    it("SEPARATE returns 2 receipts ([CW, FNB]) with exact totals and 0 tax/service on CW", () => {
      const receipt = buildOrderReceiptData(makeMixedOrder());
      const receipts = splitCustomerReceiptByMode(receipt, {
        receiptCombineMode: "SEPARATE",
        splitCustomerReceiptPerTenant: false,
      });

      expect(receipts).toHaveLength(2);
      const [cwReceipt, fnbReceipt] = receipts;

      expect(cwReceipt.orderNumber).toBe("INV-DAGO-20261123-0001-CW");
      expect(cwReceipt.brandName).toBe("DAGO CREATIVE HUB");
      expect(cwReceipt.tagline).toBe("Co-Working & Meeting Spaces");
      expect(cwReceipt.items).toHaveLength(1);
      expect(cwReceipt.subtotal).toBe(75000);
      expect(cwReceipt.tax).toBe(0);
      expect(cwReceipt.serviceCharge).toBe(0);
      expect(cwReceipt.grandTotal).toBe(75000);

      expect(fnbReceipt.orderNumber).toBe("INV-DAGO-20261123-0001-FNB");
      expect(fnbReceipt.items).toHaveLength(2);
      expect(fnbReceipt.subtotal).toBe(50000);
      expect(fnbReceipt.tax).toBe(5000);
      expect(fnbReceipt.serviceCharge).toBe(2500);
      expect(fnbReceipt.grandTotal).toBe(57500);

      expect(cwReceipt.grandTotal + fnbReceipt.grandTotal).toBe(132500);
    });

    it("SEPARATE + splitCustomerReceiptPerTenant splits multi-mitra F&B into separate receipts while preserving exact grandTotal", () => {
      const twoMitraMixed = makeMixedOrder({
        items: [
          {
            id: "cw-1",
            productId: "sp-hot-1",
            productName: "Hot Desk Flex",
            quantity: 1,
            unitPrice: 75000,
            itemType: "COWORKING",
          },
          {
            id: "fnb-ks",
            productId: "prod-101",
            productName: "Kopi Senja Aren",
            quantity: 1,
            unitPrice: 24000,
            tenantId: "tenant-ks",
          },
          {
            id: "fnb-dm",
            productId: "prod-105",
            productName: "Beef Bowl",
            quantity: 1,
            unitPrice: 26000,
            tenantId: "tenant-kitchen",
          },
        ],
      });

      const receipt = buildOrderReceiptData(twoMitraMixed);
      const receipts = splitCustomerReceiptByMode(receipt, {
        receiptCombineMode: "SEPARATE",
        splitCustomerReceiptPerTenant: true,
      });

      expect(receipts).toHaveLength(3);
      expect(receipts[0].orderNumber).toBe("INV-DAGO-20261123-0001-CW");
      expect(receipts[0].tax).toBe(0);
      expect(receipts[0].serviceCharge).toBe(0);
      expect(receipts[0].grandTotal).toBe(75000);

      expect(receipts[1].orderNumber).toBe("INV-DAGO-20261123-0001-FNB-1");
      expect(receipts[2].orderNumber).toBe("INV-DAGO-20261123-0001-FNB-2");
      expect(receipts[1].tax + receipts[2].tax).toBe(5000);
      expect(receipts[1].serviceCharge + receipts[2].serviceCharge).toBe(2500);
      expect(
        receipts.reduce((sum, r) => sum + r.grandTotal, 0)
      ).toBe(132500);
    });
  });

  describe("3. Settlement, Profit Sharing & Tenant Ownership Isolation", () => {
    it("attributes 100% Dago Co-Working with 0 PB1/service and 85/15 F&B Mitra with full F&B PB1/service", () => {
      const mixedOrder = makeMixedOrder();
      const settlements = calculateSettlement([mixedOrder]);

      const dago = settlements.find((s) => s.tenantId === "DAGO_HUB");
      const ks = settlements.find((s) => s.tenantId === "tenant-ks");

      expect(dago).toBeDefined();
      expect(dago?.grossRevenue).toBe(75000);
      expect(dago?.tax).toBe(0);
      expect(dago?.serviceCharge).toBe(0);
      expect(dago?.dagoShareAmount).toBe(75000);
      expect(dago?.tenantShareAmount).toBe(0);

      expect(ks).toBeDefined();
      expect(ks?.grossRevenue).toBe(50000);
      expect(ks?.tax).toBe(5000);
      expect(ks?.serviceCharge).toBe(2500);
      expect(ks?.tenantShareAmount).toBe(42500);
      expect(ks?.dagoShareAmount).toBe(7500);
    });

    it("never attributes a coworking item with missing tenantId to an F&B fallback order tenantId", () => {
      expect(normalizeTenantId("tenant-cowork")).toBe("DAGO_HUB");
      expect(normalizeTenantId("dago_hub")).toBe("DAGO_HUB");
      expect(normalizeTenantId("dago")).toBe("DAGO_HUB");
      expect(isCoworkingOrderItem({ id: "cw-99", productName: "Meeting Room" })).toBe(true);
      expect(isCoworkingOrderItem({ productName: "Kopi Senja Aren" })).toBe(false);

      const resolved = resolveItemTenantId(
        { id: "cw-99", productId: "sp-meet-1", productName: "Meeting Room", itemType: "COWORKING" },
        "tenant-ks"
      );
      expect(resolved).toBe("DAGO_HUB");
      expect(
        resolveNormalizedItemTenantId(
          { category: "Co-Working", productName: "Pod" },
          "tenant-ks"
        )
      ).toBe("DAGO_HUB");

      const projectedDago = projectOrderForTenant(makeMixedOrder(), "DAGO_HUB");
      expect(projectedDago?.tax).toBe(0);
      expect(projectedDago?.serviceCharge).toBe(0);
      expect(projectedDago?.subtotal).toBe(75000);

      const projectedKs = projectOrderForTenant(makeMixedOrder(), "tenant-ks");
      expect(projectedKs?.tax).toBe(5000);
      expect(projectedKs?.serviceCharge).toBe(2500);
      expect(projectedKs?.subtotal).toBe(50000);
    });

    it("calculateTenantProfitSharing charges 0.7% MDR only on QRIS orders and uses DPP after pro-rata discount", () => {
      const qrisOrder = makeMixedOrder({
        id: "ord-ps-qris",
        paymentMethod: "QRIS",
        discount: 25000, // 20% of 125.000 -> KS 50.000 gets 10.000 discount -> DPP 40.000
      });
      const cashOrder = makeMixedOrder({
        id: "ord-ps-cash",
        paymentMethod: "CASH",
        discount: 0, // KS 50.000 -> DPP 50.000, 0 MDR
      });

      const qrisPs = calculateTenantProfitSharing([qrisOrder], "tenant-ks", "Kopi Senja", 15);
      expect(qrisPs.grossSales).toBe(50000);
      expect(qrisPs.dpp).toBe(40000);
      expect(qrisPs.platformFee).toBe(6000); // 15% of 40.000
      expect(qrisPs.qrisMdr).toBe(280); // 0.7% of 40.000
      expect(qrisPs.netPayout).toBe(40000 - 6000 - 280);

      const cashPs = calculateTenantProfitSharing([cashOrder], "tenant-ks", "Kopi Senja", 15);
      expect(cashPs.grossSales).toBe(50000);
      expect(cashPs.platformFee).toBe(7500);
      expect(cashPs.qrisMdr).toBe(0);
      expect(cashPs.netPayout).toBe(42500);
    });
  });

  describe("4. Kitchen Board & Reprint Ticket Exclusion", () => {
    it("excludes co-working items from ticketItems, filterKitchenOrders, and reprint tickets in mixed and coworking-only orders", () => {
      const mixedOrder = makeMixedOrder({ status: "CONFIRMED", paymentStatus: "PAID" });
      const coworkingOnlyOrder = makeMixedOrder({
        id: "ord-cw-only",
        orderNumber: "INV-DAGO-20261123-0002",
        items: [mixedOrder.items[0]],
        subtotal: 75000,
        tax: 0,
        serviceCharge: 0,
        total: 75000,
      });

      const allTicketItems = ticketItems(mixedOrder, "ALL");
      expect(allTicketItems).toHaveLength(2);
      expect(allTicketItems.map((it) => it.productName)).toEqual([
        "Kopi Senja Aren",
        "Matcha Oat Latte",
      ]);

      expect(ticketItems(coworkingOnlyOrder, "ALL")).toHaveLength(0);
      expect(ticketItems(coworkingOnlyOrder, "DAGO_HUB")).toHaveLength(0);

      const boardOrders = filterKitchenOrders([mixedOrder, coworkingOnlyOrder], {
        tenantId: "ALL",
        type: "ALL",
        station: "ALL",
        multiStation: false,
      });
      expect(boardOrders.map((o) => o.id)).toEqual(["ord-v33-mixed-1"]);

      const incoming = getNewIncomingKitchenOrders([mixedOrder, coworkingOnlyOrder], "ALL");
      expect(incoming.map((o) => o.id)).toEqual(["ord-v33-mixed-1"]);

      const reprint = buildReprintKitchenTicket(mixedOrder, "REPRINT", "Kasir");
      expect(reprint.items).toHaveLength(2);
      expect(reprint.items.some((i) => i.productName.includes("Hot Desk"))).toBe(false);
    });
  });

  describe("5. Config Sync Spec (receiptCombineMode)", () => {
    it("defaults receiptCombineMode to COMBINED on platform-settings and persists valid SEPARATE updates without storing a duplicate on printer-config", () => {
      const psDefault = defaultPlatformSettingsState();
      expect(psDefault.receiptCombineMode).toBe("COMBINED");

      const psSeparate = applyPlatformSettingsCommand(psDefault, {
        op: "PATCH_SETTINGS",
        patch: { receiptCombineMode: "SEPARATE" },
      });
      expect(psSeparate.receiptCombineMode).toBe("SEPARATE");

      const psInvalid = applyPlatformSettingsCommand(psSeparate, {
        op: "PATCH_SETTINGS",
        patch: { receiptCombineMode: "INVALID" as never },
      });
      expect(psInvalid.receiptCombineMode).toBe("SEPARATE");

      const prDefault = defaultPrinterConfigState();
      expect("receiptCombineMode" in prDefault.settings).toBe(false);
    });
  });

  describe("6. Wave 3 Regression Fixes (Discounts, Co-Working PPN, Kitchen/BOM Exclusion & Dashboard/Closing Attribution)", () => {
    it("allocates scoped FNB promo + manual discount without losing rupiah and matches (subtotal - discount) + pb1 + serviceCharge === total", () => {
      // FNB 30.000 + CW 100.000 = 130.000; FNB promo = 25.000 + manual = 50.000 -> totalDiscount = 75.000
      const calc = calculateMixedCartTaxAndService(
        [
          { id: "cw-1", productId: "sp-hot-1", itemType: "COWORKING", tenantId: "DAGO_HUB", price: 100000, quantity: 1 },
          { id: "fnb-1", productId: "prod-101", itemType: "FNB", tenantId: "tenant-ks", price: 30000, quantity: 1 },
        ],
        {
          fnbDiscount: 25000,
          coworkingDiscount: 0,
          otherDiscount: 50000,
          discount: 75000,
          orderType: "DINE_IN",
          fnbTaxRatePercent: 10,
          isFnbTaxEnabled: true,
          fnbServiceChargePercent: 5,
          isCoworkingTaxEnabled: false,
          coworkingTaxRatePercent: 0,
        }
      );

      expect(calc.discount).toBe(75000);
      expect(calc.fnbDiscount + calc.coworkingDiscount).toBe(75000);
      expect(calc.fnbDiscount).toBeLessThanOrEqual(30000);
      expect(calc.coworkingDiscount).toBeLessThanOrEqual(100000);
      expect((calc.subtotal - calc.discount) + calc.pb1 + calc.serviceCharge).toBe(calc.total);
    });

    it("honors explicit fnbDiscount/coworkingDiscount & coworkingTax (PPN 11%) on SEPARATE receipts and settlement", () => {
      const mixedPpnOrder = makeMixedOrder({
        discount: 10000,
        fnbDiscount: 10000,
        coworkingDiscount: 0,
        fnbTax: 4000,
        coworkingTax: 8250,
        tax: 12250, // 4000 (10% of 40k FNB) + 8250 (11% of 75k CW)
        serviceCharge: 2000, // 5% of 40k FNB
        total: 129250, // (125000 - 10000) + 12250 + 2000
      });

      const receipt = buildOrderReceiptData(mixedPpnOrder);
      const receipts = splitCustomerReceiptByMode(receipt, {
        receiptCombineMode: "SEPARATE",
        splitCustomerReceiptPerTenant: false,
      });

      expect(receipts).toHaveLength(2);
      const [cwReceipt, fnbReceipt] = receipts;
      expect(cwReceipt.discount).toBe(0);
      expect(cwReceipt.tax).toBe(8250);
      expect(cwReceipt.serviceCharge).toBe(0);
      expect(cwReceipt.grandTotal).toBe(83250);

      expect(fnbReceipt.discount).toBe(10000);
      expect(fnbReceipt.tax).toBe(4000);
      expect(fnbReceipt.serviceCharge).toBe(2000);
      expect(fnbReceipt.grandTotal).toBe(46000);

      const settlements = calculateSettlement([mixedPpnOrder]);
      const dago = settlements.find((s) => s.tenantId === "DAGO_HUB");
      const ks = settlements.find((s) => s.tenantId === "tenant-ks");
      expect(dago?.discount).toBe(0);
      expect(dago?.tax).toBe(8250);
      expect(ks?.discount).toBe(10000);
      expect(ks?.tax).toBe(4000);
      expect(ks?.serviceCharge).toBe(2000);
    });

    it("forces DAGO_HUB profit sharing to 0% tenant / 100% Dago and does not misclassify F&B items with sp-/cw- IDs", () => {
      expect(
        isCoworkingOrderItem({
          id: "sp-special-coffee",
          productId: "sp-latte",
          itemType: "FNB",
          tenantId: "tenant-ks",
          productName: "Special Latte",
        })
      ).toBe(false);
      expect(
        isCoworkingOrderItem({
          id: "cw-123",
          tenantId: "tenant-ks",
          productName: "Cold Brew",
        })
      ).toBe(false);

      const mixedOrder = makeMixedOrder();
      const dagoPs = calculateTenantProfitSharing([mixedOrder], "DAGO_HUB", "Dago Hub");
      expect(dagoPs.tenantSharePercent).toBe(0);
      expect(dagoPs.commissionPercent).toBe(100);
      expect(dagoPs.netPayout).toBe(0);
    });

    it("excludes co-working items from splitKitchenTicketByTenant and toOrderBomItems", () => {
      const mixedOrder = makeMixedOrder();
      const bomItems = toOrderBomItems(mixedOrder.items);
      expect(bomItems).toHaveLength(2);
      expect(bomItems.some((it) => it.productName.includes("Hot Desk"))).toBe(false);

      const cwOnlyTickets = splitKitchenTicketByTenant({
        orderId: "ord-cw",
        orderNumber: "INV-CW-1",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        tableNumber: "HD-01",
        customerName: "Tamu",
        orderType: "DINE_IN",
        purpose: "NEW_ORDER",
        cashierName: "Kasir",
        timestamp: "10:00 WITA",
        items: [
          {
            id: "cw-1",
            productName: "Hot Desk Flex",
            quantity: 1,
            tenantId: "DAGO_HUB",
            itemType: "COWORKING",
          },
        ],
      });
      expect(cwOnlyTickets).toHaveLength(0);

      const mixedTickets = splitKitchenTicketByTenant({
        orderId: "ord-mix",
        orderNumber: "INV-MIX-1",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        tableNumber: "HD-01",
        customerName: "Tamu",
        orderType: "DINE_IN",
        purpose: "NEW_ORDER",
        cashierName: "Kasir",
        timestamp: "10:00 WITA",
        items: [
          {
            id: "cw-1",
            productName: "Hot Desk Flex",
            quantity: 1,
            tenantId: "DAGO_HUB",
            itemType: "COWORKING",
          },
          {
            id: "fnb-1",
            productName: "Kopi Senja Aren",
            quantity: 1,
            tenantId: "tenant-ks",
            tenantName: "Kopi Senja",
            itemType: "FNB",
          },
        ],
      });
      expect(mixedTickets).toHaveLength(1);
      expect(mixedTickets[0].items.map((i) => i.productName)).toEqual(["Kopi Senja Aren"]);
    });

    it("attributes DAGO_HUB co-working order revenue to coworking unit on dashboard and 100% Dago on shift closing report", () => {
      const mixedOrder = makeMixedOrder();
      const cwOnlyOrder = makeMixedOrder({
        id: "ord-cw-only-2",
        items: [mixedOrder.items[0]],
        subtotal: 75000,
        tax: 0,
        serviceCharge: 0,
        total: 75000,
      });

      const partitioned = partitionOrderRevenueByUnit([mixedOrder, cwOnlyOrder]);
      expect(partitioned.fnbRevenue).toBe(57500);
      expect(partitioned.coworkingRevenue).toBe(150000);
      expect(computeDashboardFnbRevenue([mixedOrder, cwOnlyOrder], { isTenantOwner: false })).toBe(
        57500
      );

      const closingCwOnly = buildClosingReportData(
        {
          id: "shf-cw-only",
          shiftName: "Shift Co-Working",
          outletId: "outlet-sgr",
          outletName: "Singaraja",
          assignedCashierId: "emp-1",
          assignedCashierName: "Kasir",
          startTime: "2026-11-23T08:00:00.000Z",
          status: "ACTIVE",
          openingCash: 100000,
          cashSales: 75000,
          nonCashSales: 0,
          refundAmount: 0,
          expectedCash: 175000,
          actualCash: 175000,
          cashVariance: 0,
        },
        [cwOnlyOrder],
        "Singaraja",
        "Kasir"
      );

      expect(closingCwOnly.tenantTotalShare).toBe(0);
      expect(closingCwOnly.dagoTotalShare).toBe(75000);
      expect(closingCwOnly.tenantCashShare).toBe(0);
      expect(closingCwOnly.dagoCashShare).toBe(75000);
      expect(closingCwOnly.tenantSharePercent).toBe(0);
      expect(closingCwOnly.dagoSharePercent).toBe(100);
    });
  });
});
