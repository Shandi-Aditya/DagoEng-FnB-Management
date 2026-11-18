import { describe, it, expect, beforeEach, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dagoeng-v19-test-"));
process.env.DATA_DIR_OVERRIDE = tmpRoot;
process.env.SUPERVISOR_OVERRIDE_PIN = "123456";
delete process.env.DISABLE_DEMO_LOGIN;

import {
  GET as getOrdersRoute,
  POST as postOrdersRoute,
} from "@/app/api/orders/route";
import { POST as postShiftsRoute } from "@/app/api/shifts/route";
import {
  GET as getProductsRoute,
  POST as postProductsRoute,
  PUT as putProductsRoute,
} from "@/app/api/products/route";
import {
  GET as getAuditLogsRoute,
  POST as postAuditLogsRoute,
} from "@/app/api/audit-logs/route";
import { PUT as putEmployeesRoute } from "@/app/api/employees/route";
import { POST as postRegisterRoute } from "@/app/api/auth/register/route";
import {
  GET as getAuthSessionRoute,
  POST as postAuthSessionRoute,
} from "@/app/api/auth/session/route";
import { buildCashDrawerShiftSummary } from "@/features/pos/CashDrawerShiftModal";
import {
  effectiveKitchenStatus,
  filterKitchenOrders,
  stationFor,
  ticketItems,
} from "@/features/kitchen/kitchen-board";
import {
  filterOrdersByTenant,
  buildReprintKitchenTicket,
  buildOrderReceiptData,
} from "@/features/orders/orders-domain";
import {
  buildReportData,
  projectOrdersForTenant,
} from "@/features/reports/reports-domain";
import {
  bucketLastSevenDays,
  computeDashboardFnbRevenue,
  scopeDashboardOrders,
} from "@/features/dashboard/dashboard-metrics";
import {
  deductOrderItemsBOM,
  INITIAL_INGREDIENTS,
  INITIAL_RECIPES,
  recordOrderWasteItemsBOM,
  restoreOrderItemsBOM,
} from "@/features/inventory/inventory-data";
import {
  generateCustomerReceiptText,
  generateKitchenTicketText,
  splitCustomerReceiptByTenant,
} from "@/lib/printer";
import {
  generateSequentialReceiptNumber,
  resolveCoworkingReceiptPublisher,
  resolvePosReceiptPublisher,
  resolvePublisherCode,
} from "@/lib/receipt-publisher";
import {
  aggregateOrdersTaxAndRevenue,
  calculateCartTaxAndService,
  getOrderTaxBreakdown,
} from "@/lib/tax-breakdown";
import { calculateSettlement } from "@/lib/settlement";
import {
  formatWitaDateTime,
  getTodayWitaDateString,
  toWitaDateKey,
} from "@/contexts/DateFilterContext";
import {
  getAuditLogs,
  getPersistentLoyaltyMembers,
  getPersistentOrders,
  savePersistentEmployee,
  savePersistentLoyaltyMember,
  savePersistentOrder,
  savePersistentShift,
  writePersistentData,
} from "@/lib/persistent-storage";
import { TRUSTED_PERSONAS } from "@/lib/server-auth";
import { evaluateRouteAccess, getDefaultRouteForRole } from "@/lib/route-guard";
import { middleware, config as middlewareConfig } from "@/middleware";
import {
  isStaffIdleExpired,
  STAFF_IDLE_TIMEOUT_MS,
} from "@/contexts/AuthContext";
import { isTableSelectableForPos } from "@/contexts/TableContext";
import { reconcileOverdueShifts } from "@/lib/shift-management";
import { computeSupervisorPinHmac } from "@/lib/qris-verification";
import type { OrderRecord } from "@/types/order";
import type { CoworkingBooking } from "@/types/coworking";
import type { ShiftRecord } from "@/types/shift";
import type { LoyaltyMember } from "@/types/loyalty";

function resetTempStorage() {
  for (const file of [
    "pos_orders.json",
    "shifts.json",
    "audit_logs.json",
    "qris_sessions.json",
    "loyalty_points.json",
    "loyalty_members.json",
    "unified_users.json",
    "session_revocations.json",
    "employees.json",
    "products.json",
  ]) {
    const p = path.join(tmpRoot, file);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

function makeOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: `ord-${Math.random().toString(36).slice(2, 8)}`,
    orderNumber: "INV-KS-20261118-0001",
    organizationId: "org-dago-hub",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    tableNumber: "T-01",
    customerName: "Tamu Regresi",
    orderType: "DINE_IN",
    status: "CONFIRMED",
    items: [
      {
        id: "item-1",
        productId: "prod-101",
        productName: "Kopi Senja Aren",
        quantity: 2,
        unitPrice: 24500,
        tenantId: "tenant-ks",
      },
    ],
    subtotal: 49000,
    discount: 0,
    tax: 4900,
    serviceCharge: 2450,
    taxRatePercent: 10,
    serviceChargePercent: 5,
    total: 56350,
    paymentStatus: "PAID",
    paymentMethod: "CASH",
    targetServiceMinutes: 10,
    createdAt: "2026-11-18T10:00:00.000Z",
    statusHistory: [],
    ...overrides,
  };
}

describe("Task V-19: Full POS Regression Verification (All 37 P1 + Coupled P2 Cases)", () => {
  beforeEach(async () => {
    resetTempStorage();
    await writePersistentData("pos_orders.json", []);
    await writePersistentData("shifts.json", []);
    await writePersistentData("audit_logs.json", []);
    await writePersistentData("session_revocations.json", {});
  });

  afterAll(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    delete process.env.DATA_DIR_OVERRIDE;
  });

  describe("Section A: Shift & Cash Drawers (TC-A01..A04)", () => {
    it("TC-A01 & TC-A02: requires active shift in /orders and enforces cashier-bound shift recording", async () => {
      const ordersPageSrc = fs.readFileSync(
        path.resolve(process.cwd(), "src/app/(dashboard)/orders/page.tsx"),
        "utf-8"
      );
      expect(ordersPageSrc).toContain("if (!activeShift)");
      expect(ordersPageSrc).toContain("setIsOpenShiftModalOpen(true)");

      const openRes = await postShiftsRoute(
        new NextRequest("http://localhost:3000/api/shifts", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=CASHIER_SGR",
          },
          body: JSON.stringify({
            action: "OPEN",
            shiftName: "Shift Pagi",
            openingCash: 250000,
            outletId: "outlet-sgr",
          }),
        })
      );
      expect(openRes.status).toBe(200);
      const { shift } = await openRes.json();

      await savePersistentShift({
        ...shift,
        id: "shf-other-cashier",
        assignedCashierId: "usr-other-cashier",
        assignedCashierName: "Kasir Lain",
      });

      const stealRes = await postShiftsRoute(
        new NextRequest("http://localhost:3000/api/shifts", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=CASHIER_SGR",
          },
          body: JSON.stringify({
            action: "RECORD_SALE",
            shiftId: "shf-other-cashier",
            cashAmount: 50000,
            nonCashAmount: 0,
          }),
        })
      );
      expect(stealRes.status).toBe(403);
    });

    it("TC-A03 & TC-A04 & TC-K05: overdue shift alerts/reconciles, CloseShiftModal accepts expired rows, CashDrawer enforces variance reason and stored tax", async () => {
      const oldStart = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
      const activeShift: ShiftRecord = {
        id: "shf-old-1",
        shiftName: "Shift Kemarin",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        assignedCashierId: "user-cashier-sgr",
        assignedCashierName: "Ni Kadek Sri",
        startTime: oldStart,
        status: "ACTIVE",
        openingCash: 200000,
        cashSales: 49000,
        nonCashSales: 7350,
        refundAmount: 0,
        expectedCash: 249000,
        actualCash: 0,
        cashVariance: 0,
      };
      const reconciled = reconcileOverdueShifts([activeShift]);
      expect(reconciled.changed).toBe(true);
      expect(reconciled.updatedShifts).toHaveLength(1);
      expect(reconciled.shifts[0].status).toBe("NEEDS_RECONCILIATION");

      await savePersistentShift(reconciled.shifts[0]);
      const saleBlocked = await postShiftsRoute(
        new NextRequest("http://localhost:3000/api/shifts", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=CASHIER_SGR",
          },
          body: JSON.stringify({
            action: "RECORD_SALE",
            shiftId: "shf-old-1",
            cashAmount: 10000,
            nonCashAmount: 0,
          }),
        })
      );
      expect(saleBlocked.status).toBe(409);

      const shiftOrder = makeOrder({
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        paymentMethod: "CASH",
        subtotal: 49000,
        tax: 4900,
        serviceCharge: 2450,
        total: 56350,
      });
      const currentShift: ShiftRecord = {
        id: "shf-cur-1",
        shiftName: "Shift Aktif",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        assignedCashierId: "user-cashier-sgr",
        assignedCashierName: "Ni Kadek Sri",
        startTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        status: "ACTIVE",
        openingCash: 200000,
        cashSales: 56350,
        nonCashSales: 0,
        refundAmount: 0,
        expectedCash: 256350,
        actualCash: 0,
        cashVariance: 0,
      };

      const summary = buildCashDrawerShiftSummary([shiftOrder], currentShift);
      expect(summary.storedTax).toBe(4900);
      expect(summary.storedServiceCharge).toBe(2450);
      expect(summary.cashSales).toBe(56350);

      const drawerSrc = fs.readFileSync(
        path.resolve(process.cwd(), "src/features/pos/CashDrawerShiftModal.tsx"),
        "utf-8"
      );
      const employeesPageSrc = fs.readFileSync(
        path.resolve(process.cwd(), "src/app/(dashboard)/employees/page.tsx"),
        "utf-8"
      );
      const navUserSrc = fs.readFileSync(
        path.resolve(process.cwd(), "src/features/layout/NavUser.tsx"),
        "utf-8"
      );
      expect(drawerSrc).toContain("Alasan selisih kas");
      expect(drawerSrc).toContain("isVarianceReasonMissing");
      expect(employeesPageSrc).toContain("closingShiftTarget");
      expect(navUserSrc).toContain("shiftId={activeShift.id}");
      expect(navUserSrc).toContain("onConfirmClose=");
    });
  });

  describe("Section B: Transactions, Receipts, Sequential Nota & Tax (TC-B01, B04, B06, B08, B09)", () => {
    it("TC-B01: supports per-mitra headers/subtotals in combined receipt and cleanly splits multi-mitra customer receipts", () => {
      const receiptData = buildOrderReceiptData(
        makeOrder({
          orderNumber: "INV-DAGO-20261118-0001",
          items: [
            {
              id: "i1",
              productId: "prod-101",
              productName: "Kopi Senja Aren",
              quantity: 1,
              unitPrice: 25000,
              tenantId: "tenant-ks",
            },
            {
              id: "i2",
              productId: "prod-105",
              productName: "Wagyu Beef Bowl",
              quantity: 1,
              unitPrice: 45000,
              tenantId: "tenant-kitchen",
            },
          ],
          subtotal: 70000,
          discount: 0,
          tax: 7000,
          serviceCharge: 3500,
          total: 80500,
        })
      );

      const combinedText = generateCustomerReceiptText(receiptData, { paperWidth: "80mm" });
      expect(combinedText).toMatch(/Dago Creative Hub/i);
      expect(combinedText).toContain("Kopi Senja");
      expect(combinedText).toContain("Dapur Mama");

      const splitReceipts = splitCustomerReceiptByTenant(receiptData);
      expect(splitReceipts).toHaveLength(2);
      expect(splitReceipts[0].grandTotal + splitReceipts[1].grandTotal).toBe(80500);
      expect(splitReceipts[0].orderNumber).toBe("INV-DAGO-20261118-0001-1");
      expect(splitReceipts[1].orderNumber).toBe("INV-DAGO-20261118-0001-2");
    });

    it("TC-B08: generates strictly gapless sequential daily receipt numbers per publisher without randomness", () => {
      const date = new Date("2026-11-18T10:00:00.000Z");
      expect(resolvePublisherCode("tenant-ks")).toBe("KS");
      expect(resolvePublisherCode("tenant-kitchen")).toBe("DM");
      expect(resolvePublisherCode("tenant-bakery")).toBe("MB");

      const n1 = generateSequentialReceiptNumber({
        publisherCode: "KS",
        existingNumbers: [],
        date,
      });
      const n2 = generateSequentialReceiptNumber({
        publisherCode: "KS",
        existingNumbers: [n1],
        date,
      });
      const n3 = generateSequentialReceiptNumber({
        publisherCode: "KS",
        existingNumbers: [n1, n2],
        date,
      });
      const d1 = generateSequentialReceiptNumber({
        publisherCode: "DAGO",
        existingNumbers: [n1, n2, n3],
        date,
      });

      expect(n1).toBe("INV-KS-20261118-0001");
      expect(n2).toBe("INV-KS-20261118-0002");
      expect(n3).toBe("INV-KS-20261118-0003");
      expect(d1).toBe("INV-DAGO-20261118-0001");
    });

    it("TC-B04, TC-B06, TC-B09, TC-K05, TC-K06: matches cart/receipt/report/settlement tax identically and excludes PENDING unpaid orders", () => {
      const cartCalc = calculateCartTaxAndService({
        subtotal: 49000,
        discount: 0,
        taxRatePercent: 10,
        serviceChargePercent: 5,
        isTaxEnabled: true,
        orderType: "DINE_IN",
      });
      expect(cartCalc.pb1).toBe(4900);
      expect(cartCalc.serviceCharge).toBe(2450);
      expect(cartCalc.total).toBe(56350);

      const paidOrder = makeOrder();
      const unpaidPending = makeOrder({
        id: "ord-pending-unpaid",
        orderNumber: "ORD-UNPAID-1",
        paymentStatus: "PENDING",
        status: "NEW",
        subtotal: 100000,
        tax: 10000,
        serviceCharge: 5000,
        total: 115000,
      });

      const breakdown = getOrderTaxBreakdown(paidOrder);
      expect(breakdown.pb1).toBe(4900);
      expect(breakdown.serviceCharge).toBe(2450);

      const taxAgg = aggregateOrdersTaxAndRevenue([paidOrder, unpaidPending]);
      expect(taxAgg.orderCount).toBe(1);
      expect(taxAgg.totalRevenue).toBe(56350);
      expect(taxAgg.totalTaxPB1).toBe(4900);
      expect(taxAgg.totalServiceCharge).toBe(2450);

      const salesReport = buildReportData({
        type: "SALES",
        scopeName: "Singaraja",
        orders: [paidOrder, unpaidPending],
      });
      expect(salesReport.summaryCards[0].value).toBe("Rp 56.350");
      expect(salesReport.summaryCards[1].value).toBe("1 pesanan");

      const settlement = calculateSettlement([paidOrder, unpaidPending]);
      const ks = settlement.find((s) => s.tenantId === "tenant-ks")!;
      expect(ks.grossRevenue).toBe(49000);
      expect(ks.tenantShareAmount).toBe(41650);
      expect(ks.dagoShareAmount).toBe(7350);

      const paymentModalSrc = fs.readFileSync(
        path.resolve(process.cwd(), "src/features/pos/PaymentModal.tsx"),
        "utf-8"
      );
      expect(paymentModalSrc).toContain("isSubmittingRef.current");
    });
  });

  describe("Section C, G, K: Void/Refund PIN & BOM, Product RBAC, Audit Preservation", () => {
    it("TC-C01, TC-G03, TC-K02: enforces supervisor PIN on cashier refund/void and separates pre-cook restore vs post-cook waste", async () => {
      const paidOrder = makeOrder({ id: "ord-c01-paid", paymentStatus: "PAID", status: "CONFIRMED" });
      await savePersistentOrder(paidOrder);

      const secondPayAttempt = await postOrdersRoute(
        new NextRequest("http://localhost:3000/api/orders", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=CASHIER_SGR",
          },
          body: JSON.stringify({
            order: { ...paidOrder, paymentStatus: "PAID", paymentMethod: "QRIS" },
          }),
        })
      );
      expect(secondPayAttempt.status).toBe(403);

      const noPinRefund = await postOrdersRoute(
        new NextRequest("http://localhost:3000/api/orders", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=CASHIER_SGR",
          },
          body: JSON.stringify({
            order: { ...paidOrder, status: "CANCELLED", paymentStatus: "REFUNDED", refundReason: "Salah menu" },
          }),
        })
      );
      expect(noPinRefund.status).toBe(403);

      const validPinRefund = await postOrdersRoute(
        new NextRequest("http://localhost:3000/api/orders", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=CASHIER_SGR",
          },
          body: JSON.stringify({
            supervisorPin: "123456",
            order: {
              ...paidOrder,
              status: "CANCELLED",
              paymentStatus: "REFUNDED",
              refundReason: "Pelanggan batal sebelum dimasak",
              refundApprovedBy: "Manager Commercial",
              refundMethod: "CASH",
            },
          }),
        })
      );
      expect(validPinRefund.status).toBe(200);
      const refundData = await validPinRefund.json();
      expect(refundData.order.paymentStatus).toBe("REFUNDED");
      expect(refundData.order.supervisorPinVerified).toBe(true);

      const initialMilk = INITIAL_INGREDIENTS.find((i) => i.id === "ing-1")!.stockNumber;
      const afterDeduct = deductOrderItemsBOM(
        INITIAL_INGREDIENTS.map((i) => ({ ...i })),
        INITIAL_RECIPES,
        [{ productId: "prod-101", productName: "Kopi Senja Aren", quantity: 1 }]
      );
      expect(afterDeduct.updatedStock.find((i) => i.id === "ing-1")!.stockNumber).toBeLessThan(initialMilk);

      const restored = restoreOrderItemsBOM(
        afterDeduct.updatedStock,
        INITIAL_RECIPES,
        [{ productId: "prod-101", productName: "Kopi Senja Aren", quantity: 1 }]
      );
      expect(restored.updatedStock.find((i) => i.id === "ing-1")!.stockNumber).toBeCloseTo(initialMilk, 5);

      const wasted = recordOrderWasteItemsBOM(
        afterDeduct.updatedStock,
        INITIAL_RECIPES,
        [{ productId: "prod-101", productName: "Kopi Senja Aren", quantity: 1 }],
        false,
        "ORD-WASTE-1"
      );
      expect(wasted.wasteCount).toBeGreaterThan(0);
      expect(wasted.updatedStock.find((i) => i.id === "ing-1")!.stockNumber).toBe(
        afterDeduct.updatedStock.find((i) => i.id === "ing-1")!.stockNumber
      );
    });

    it("TC-C03 & TC-C04: protects /api/products mutations with RBAC + before/after audit log and preserves all structured audit fields", async () => {
      const unauthProd = await postProductsRoute(
        new NextRequest("http://localhost:3000/api/products", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Hack Menu", basePrice: 1 }),
        })
      );
      expect(unauthProd.status).toBe(401);

      const cashierProd = await putProductsRoute(
        new NextRequest("http://localhost:3000/api/products", {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=CASHIER_SGR",
          },
          body: JSON.stringify({ id: "prod-101", basePrice: 100 }),
        })
      );
      expect(cashierProd.status).toBe(403);

      const ownerProdRes = await postProductsRoute(
        new NextRequest("http://localhost:3000/api/products", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=DAGO_OWNER",
          },
          body: JSON.stringify({
            id: "prod-v19-test",
            name: "Kopi Regresi V19",
            category: "Minuman",
            basePrice: 28000,
            tenantId: "tenant-ks",
          }),
        })
      );
      expect(ownerProdRes.status).toBe(200);

      const auditId = `audit-v19-${Date.now()}`;
      const auditPost = await postAuditLogsRoute(
        new NextRequest("http://localhost:3000/api/audit-logs", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=DAGO_OWNER",
          },
          body: JSON.stringify({
            id: auditId,
            action: "APPLY_DISCOUNT",
            description: "Diskon manual diterapkan",
            module: "POS",
            recordId: "INV-KS-20261118-0001",
            previousValue: "Rp 50.000",
            newValue: "Rp 45.000",
            reason: "Diskon member VIP",
            status: "SUCCESS",
            severity: "MEDIUM",
            category: "FINANCIAL",
          }),
        })
      );
      expect(auditPost.status).toBe(200);

      const logsRes = await getAuditLogsRoute(
        new NextRequest("http://localhost:3000/api/audit-logs", {
          headers: { cookie: "dagoeng_active_persona=DAGO_OWNER" },
        })
      );
      const logsJson = await logsRes.json();
      const recorded = logsJson.logs.find((l: { id: string }) => l.id === auditId);
      expect(recorded.actorName).toBeDefined();
      expect(recorded.previousValue).toBe("Rp 50.000");
      expect(recorded.newValue).toBe("Rp 45.000");
      expect(recorded.reason).toBe("Diskon member VIP");
      expect(recorded.status).toBe("SUCCESS");

      const replayAudit = await postAuditLogsRoute(
        new NextRequest("http://localhost:3000/api/audit-logs", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=DAGO_OWNER",
          },
          body: JSON.stringify({
            id: auditId,
            action: "APPLY_DISCOUNT",
            description: "Diskon manual diterapkan",
            module: "POS",
          }),
        })
      );
      expect(replayAudit.status).toBe(409);

      const prodGet = await getProductsRoute(new NextRequest("http://localhost:3000/api/products"));
      expect(prodGet.status).toBe(200);
      const storedLogs = await getAuditLogs();
      expect(storedLogs.some((l) => l.action === "CREATE_PRODUCT")).toBe(true);
    });
  });

  describe("Section D, E, G: Loyalty Registration Sync, Coworking Tax/Reports, All-Menu BOM", () => {
    it("TC-D03, TC-D04, TC-K11: synchronizes registered customer with loyalty_members via normalized phone and blocks duplicate phone", async () => {
      const existingMember: LoyaltyMember = {
        id: "mem-existing-1",
        name: "Tamu Walk-in V19",
        phone: "081277889900",
        tier: "Bronze",
        points: 55,
        totalSpend: 550000,
        totalVisits: 5,
        favoriteItem: "Kopi Senja Aren",
        registeredOutletId: "outlet-sgr",
        registeredOutletName: "Singaraja",
        status: "ACTIVE",
        joinedDate: "2026-09-01",
        lastVisit: "2026-11-06",
        pointHistory: [],
        tierHistory: [],
      };
      await savePersistentLoyaltyMember(existingMember);

      const regRes = await postRegisterRoute(
        new NextRequest("http://localhost:3000/api/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "Tamu Walk-in Portal",
            phone: "+62 812-7788-9900",
            email: "walkin.portal.v19@example.com",
            password: "Password123!",
          }),
        })
      );
      expect(regRes.status).toBe(201);
      const membersAfter = await getPersistentLoyaltyMembers();
      const matched = membersAfter.filter((m) => m.id === "mem-existing-1");
      expect(matched).toHaveLength(1);
      expect(matched[0].points).toBe(55);
      expect(matched[0].email).toBe("walkin.portal.v19@example.com");

      const dupPhoneRes = await postRegisterRoute(
        new NextRequest("http://localhost:3000/api/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "Akun Duplikat",
            phone: "0812-7788-9900",
            email: "other.email.v19@example.com",
            password: "Password123!",
          }),
        })
      );
      expect(dupPhoneRes.status).toBe(409);
    });

    it("TC-E01, TC-E02, TC-E03: publishes Co-working QRIS receipt with Dago identity, category tax, and includes paid booking in /reports", () => {
      const publisher = resolveCoworkingReceiptPublisher({
        name: "Singaraja (Pusat)",
        address: "Jl. Teleng No. 1, Banyuasri, Kec. Buleleng, Kabupaten Buleleng, Bali 81116",
        phone: "+62 821-1550-1995",
      });
      expect(publisher.brandName).toBe("DAGO CREATIVE HUB");
      expect(publisher.outletAddress).toContain("Jl. Teleng No. 1");

      const booking: CoworkingBooking = {
        id: "bk-e02",
        bookingCode: "CWK-DAGO-20261118-0001",
        guestName: "Raka Pradipta",
        guestPhone: "081234567890",
        guestEmail: "raka@example.com",
        spaceId: "sp-dedicated-1",
        spaceName: "Dedicated Desk #01",
        spaceType: "DEDICATED_DESK",
        bookingType: "HOURLY",
        date: "2026-11-18",
        startTime: "10:00",
        duration: 2,
        price: 50000,
        tax: 5500,
        taxType: "PPN",
        taxRatePercent: 11,
        totalAmount: 55500,
        paymentStatus: "PAID",
        paymentMethod: "QRIS",
        checkInStatus: "CHECKED_IN",
        createdAt: "2026-11-18T02:00:00.000Z",
      };

      const salesWithCowork = buildReportData({
        type: "SALES",
        scopeName: "Singaraja",
        orders: [makeOrder()],
        coworkingBookings: [booking],
      });
      expect(salesWithCowork.summaryCards[0].value).toBe("Rp 111.850");
      expect(salesWithCowork.tableRows.some((row) => row[0] === "CWK-DAGO-20261118-0001")).toBe(
        true
      );
    });

    it("TC-G01 & TC-K07: verifies BOM stock deduction succeeds for active POS items", () => {
      const result = deductOrderItemsBOM(
        INITIAL_INGREDIENTS.map((i) => ({ ...i })),
        INITIAL_RECIPES,
        [
          { productId: "prod-101", productName: "Kopi Senja Aren", quantity: 1 },
          { productId: "prod-102", productName: "Matcha Latte Signature", quantity: 1 },
        ]
      );
      expect(result.deductedCount).toBe(2);
    });
  });

  describe("Section F, H, I, K: KDS Partner Isolation, WITA Reporting, Dashboard & RBAC Security", () => {
    it("TC-F01, TC-F03, TC-K09, TC-K10: isolates multi-partner KDS status/items, routes stations cleanly, includes kitchen notes, and accepts Waiter-seated tables", () => {
      const multiOrder = makeOrder({
        id: "ord-multi-kds",
        orderNumber: "INV-DAGO-20261118-0005",
        notes: "TES QA - abaikan",
        status: "CONFIRMED",
        tenantStatuses: {
          "tenant-ks": "SERVED",
          "tenant-kitchen": "CONFIRMED",
        },
        items: [
          {
            id: "i-ks",
            productId: "prod-101",
            productName: "Classic Americano Iced",
            quantity: 1,
            unitPrice: 25000,
            tenantId: "tenant-ks",
            notes: "Less ice",
          },
          {
            id: "i-dm",
            productId: "prod-105",
            productName: "Wagyu Beef Bowl",
            quantity: 1,
            unitPrice: 45000,
            tenantId: "tenant-kitchen",
          },
        ],
      });

      expect(effectiveKitchenStatus(multiOrder, "tenant-ks")).toBe("SERVED");
      expect(effectiveKitchenStatus(multiOrder, "tenant-kitchen")).toBe("CONFIRMED");
      expect(stationFor("Classic Americano Iced")).toBe("BARISTA");
      expect(stationFor("Es Teh Manis Melati")).toBe("BARISTA");
      expect(stationFor("Banana Bread Slice")).toBe("PASTRY");

      const dmTickets = filterKitchenOrders([multiOrder], {
        tenantId: "tenant-kitchen",
        type: "ALL",
        station: "ALL",
        multiStation: false,
      });
      expect(dmTickets).toHaveLength(1);
      const dmItems = ticketItems(dmTickets[0], "tenant-kitchen");
      expect(dmItems).toHaveLength(1);
      expect(dmItems[0].productName).toBe("Wagyu Beef Bowl");

      const ksTickets = filterKitchenOrders([multiOrder], {
        tenantId: "tenant-ks",
        type: "ALL",
        station: "ALL",
        multiStation: false,
      });
      expect(ksTickets).toHaveLength(0);

      const reprintKs = buildReprintKitchenTicket(multiOrder, "REPRINT", "Gede Agus", "tenant-ks");
      expect(reprintKs.items).toHaveLength(1);
      expect(reprintKs.kitchenNotes).toBe("TES QA - abaikan");
      expect(generateKitchenTicketText(reprintKs, { paperWidth: "80mm" })).toContain(
        "TES QA - abaikan"
      );

      expect(isTableSelectableForPos({ status: "OCCUPIED", total: "Rp 0" })).toBe(true);
      expect(
        isTableSelectableForPos({ status: "OCCUPIED", activeOrderId: "ord-1", currentBillTotal: 50000 })
      ).toBe(false);
    });

    it("TC-H01, TC-H02, TC-H04, TC-H05: keeps WITA date range default, 23:30 WITA / 00:30 WITA bucketing, and tenant settlement metrics aligned", async () => {
      const dateFilterSrc = fs.readFileSync(
        path.resolve(process.cwd(), "src/contexts/DateFilterContext.tsx"),
        "utf-8"
      );
      expect(dateFilterSrc).not.toContain('"2026-09-01"');

      const witaDay = getTodayWitaDateString(new Date("2026-11-18T00:15:00.000Z"));
      expect(witaDay).toBe("2026-11-18");

      const lateNightWita = "2026-11-18T15:30:00.000Z";
      expect(toWitaDateKey(lateNightWita)).toBe("2026-11-18");
      expect(formatWitaDateTime(lateNightWita)).toBe("18/11/2026 23:30");

      const earlyMorningWita = "2026-11-18T16:30:00.000Z";
      expect(toWitaDateKey(earlyMorningWita)).toBe("2026-11-19");
      expect(formatWitaDateTime(earlyMorningWita)).toBe("19/11/2026 00:30");

      const orders: OrderRecord[] = [
        makeOrder({
          id: "ord-wita-1",
          createdAt: "2026-11-18T16:30:00.000Z",
          total: 56350,
          subtotal: 49000,
          tax: 4900,
          serviceCharge: 2450,
        }),
      ];
      const buckets = bucketLastSevenDays(
        orders.map((o) => ({ total: o.total, createdAt: o.createdAt })),
        new Date("2026-11-19T02:00:00.000Z")
      );
      expect(buckets[buckets.length - 1].revenue).toBe(56350);

      const scopedOrders = scopeDashboardOrders(orders, {
        tenantId: "tenant-ks",
        isTenantOwner: true,
        requirePaid: true,
      });
      const tenantRev = computeDashboardFnbRevenue(scopedOrders, {
        isTenantOwner: true,
        tenantId: "tenant-ks",
      });
      expect(tenantRev).toBe(41650);
    });

    it("TC-I01, TC-I02, TC-I03, TC-I04, TC-I05, TC-I06, TC-K01: enforces RBAC routes, tenant API isolation, session revocation, and QRIS pin hash parity", async () => {
      expect(TRUSTED_PERSONAS.TENANT_OWNER_KS.tenantId).toBe("tenant-ks");
      expect(TRUSTED_PERSONAS.KITCHEN_SGR.tenantId).toBe("tenant-ks");
      expect(getDefaultRouteForRole("WAITER")).toBe("/tables");
      expect(getDefaultRouteForRole("CHECKIN_STAFF")).toBe("/events/checkin");

      expect(middlewareConfig.matcher).toContain("/customers/:path*");
      expect(middlewareConfig.matcher).toContain("/activity-log/:path*");
      expect(middlewareConfig.matcher).toContain("/ai-insight/:path*");
      expect(middlewareConfig.matcher).toContain("/menu/:path*");

      expect(evaluateRouteAccess("/customers", "CHECKIN_STAFF").allowed).toBe(false);
      expect(evaluateRouteAccess("/customers", "KITCHEN_STAFF").allowed).toBe(false);
      expect(evaluateRouteAccess("/ai-insight", "CHECKIN_STAFF").allowed).toBe(false);
      expect(evaluateRouteAccess("/coworking", "OWNER", "TENANT").allowed).toBe(false);
      expect(evaluateRouteAccess("/reports", "OWNER", "TENANT").allowed).toBe(true);

      const customerAccessReq = new NextRequest("http://localhost:3000/customers", {
        headers: { cookie: "dagoeng_active_persona=EVENT_STAFF" },
      });
      expect(middleware(customerAccessReq).status).toBe(307);

      const tenantCoworkReq = new NextRequest("http://localhost:3000/coworking", {
        headers: { cookie: "dagoeng_active_persona=TENANT_OWNER_KS" },
      });
      expect(middleware(tenantCoworkReq).status).toBe(307);

      const multiOrder = makeOrder({
        id: "ord-iso-1",
        items: [
          {
            id: "i1",
            productId: "prod-101",
            productName: "Kopi Senja Aren",
            quantity: 1,
            unitPrice: 25000,
            tenantId: "tenant-ks",
          },
          {
            id: "i2",
            productId: "prod-105",
            productName: "Wagyu Beef Bowl",
            quantity: 1,
            unitPrice: 45000,
            tenantId: "tenant-kitchen",
          },
        ],
        subtotal: 70000,
        tax: 7000,
        serviceCharge: 3500,
        total: 80500,
      });
      await savePersistentOrder(multiOrder);

      const tenantOrdersRes = await getOrdersRoute(
        new NextRequest("http://localhost:3000/api/orders", {
          headers: { cookie: "dagoeng_active_persona=TENANT_OWNER_KS" },
        })
      );
      expect(tenantOrdersRes.status).toBe(200);
      const tenantOrdersJson = await tenantOrdersRes.json();
      expect(tenantOrdersJson.orders).toHaveLength(1);
      expect(tenantOrdersJson.orders[0].items).toHaveLength(1);
      expect(tenantOrdersJson.orders[0].items[0].tenantId).toBe("tenant-ks");

      const projectedReportOrders = projectOrdersForTenant([multiOrder], "tenant-ks");
      expect(projectedReportOrders[0].subtotal).toBe(25000);
      expect(filterOrdersByTenant([multiOrder], "tenant-ks", true)[0].subtotal).toBe(25000);

      const savedOrders = await getPersistentOrders();
      expect(savedOrders[0].items).toHaveLength(2);

      await savePersistentEmployee({
        id: "emp-rev-1",
        employeeNumber: "EMP-SGR-901",
        name: "Ni Kadek Sri",
        role: "Cashier",
        department: "Cashier",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        contact: "0812",
        email: "cashier.sgr@kopisenja.com",
        status: "AKTIF",
        assignedShift: "Shift Pagi",
        joinedDate: "2026-01-01",
        permissions: ["pos_access"],
      });

      const empChangeRes = await putEmployeesRoute(
        new NextRequest("http://localhost:3000/api/employees", {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=SUPER_ADMIN",
          },
          body: JSON.stringify({ id: "emp-rev-1", status: "NON-AKTIF" }),
        })
      );
      expect(empChangeRes.status).toBe(200);

      const revokedCheck = await getAuthSessionRoute(
        new NextRequest("http://localhost:3000/api/auth/session", {
          headers: { cookie: "dagoeng_active_persona=CASHIER_SGR" },
        })
      );
      expect(revokedCheck.status).toBe(401);

      const postSessionForbidden = await postAuthSessionRoute(
        new NextRequest("http://localhost:3000/api/auth/session", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=EVENT_STAFF",
          },
          body: JSON.stringify({ email: "cashier.sgr@kopisenja.com", newRole: "ADMIN" }),
        })
      );
      expect(postSessionForbidden.status).toBe(403);

      expect(isStaffIdleExpired(Date.now() - STAFF_IDLE_TIMEOUT_MS - 1000, Date.now())).toBe(true);
      expect(isStaffIdleExpired(Date.now() - 1000, Date.now())).toBe(false);
      expect(computeSupervisorPinHmac("123456")).toHaveLength(64);
    });
  });
});
