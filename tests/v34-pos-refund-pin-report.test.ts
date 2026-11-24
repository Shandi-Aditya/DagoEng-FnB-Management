import fs from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GET as getLoyaltyMembers } from "@/app/api/loyalty/members/route";
import * as ordersRoute from "@/app/api/orders/route";
import { POST as postQrisVerify } from "@/app/api/pos/qris/verify/route";
import { GET as getClosingPdf } from "@/app/api/reports/closing/pdf/route";
import { toWitaDateKey } from "@/contexts/DateFilterContext";
import { INITIAL_INGREDIENTS } from "@/features/inventory/inventory-data";
import type { ClosingReportData } from "@/features/pos/DailyClosingPDFModal";
import { buildClosingReportPdfUrl } from "@/features/pos/pos-closing-report";
import {
  buildReportData,
  countVoidRefundDiscountEntries,
  getReportCategories,
} from "@/features/reports/reports-domain";
import { INITIAL_PRODUCTS } from "@/lib/master-data-defaults";
import {
  getAuditLogs,
  getPersistentLoyaltyMembers,
  getPersistentOrders,
  getPersistentShifts,
  readPersistentDomainState,
  savePersistentLoyaltyMember,
  savePersistentShift,
} from "@/lib/persistent-storage";
import {
  resetSupervisorPinRateLimitForTests,
  signQrisWebhookPayload,
} from "@/lib/qris-verification";
import { calculateSettlement } from "@/lib/settlement";
import { recordShiftRefundTransaction } from "@/lib/shift-management";
import { inventoryDomainSpec } from "@/lib/sync-domains/inventory-spec";
import type { LoyaltyMember } from "@/types/loyalty";
import type { OrderRecord } from "@/types/order";
import type { ShiftRecord } from "@/types/shift";

const VALID_PIN = "246810";
const WRONG_PIN = "999999";

const CASHIER_COOKIE = "dagoeng_active_persona=CASHIER_SGR";
const MANAGER_COOKIE = "dagoeng_active_persona=COWORK_MANAGER";
const OWNER_COOKIE = "dagoeng_active_persona=DAGO_OWNER";
const SUPER_ADMIN_COOKIE = "dagoeng_active_persona=SUPER_ADMIN";
const TENANT_KS_COOKIE = "dagoeng_active_persona=TENANT_OWNER_KS";
const KITCHEN_COOKIE = "dagoeng_active_persona=KITCHEN_SGR";

const KS_PRODUCT = INITIAL_PRODUCTS.find((p) => p.id === "prod-101") ?? INITIAL_PRODUCTS[0];
const BAKERY_PRODUCT =
  INITIAL_PRODUCTS.find((p) => p.tenantId === "tenant-bakery") ?? INITIAL_PRODUCTS[1];

function makeReq(
  url: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body?: unknown,
  cookie?: string,
  headers: Record<string, string> = {}
): NextRequest {
  const reqHeaders: Record<string, string> = {
    "content-type": "application/json",
    ...headers,
  };
  if (cookie) reqHeaders.cookie = cookie;
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers: reqHeaders,
    ...(body !== undefined && method !== "GET" ? { body: JSON.stringify(body) } : {}),
  });
}

describe("Task V-34: POS Refund with Mandatory Reason + Supervisor PIN, Cash Return for QRIS & Void/Refund/Discount Report", () => {
  let tempDir = "";
  let prevDataDirOverride: string | undefined;
  let prevDisableDemoLogin: string | undefined;
  let prevWebhookSecret: string | undefined;
  let prevSupervisorPin: string | undefined;

  beforeEach(() => {
    prevDataDirOverride = process.env.DATA_DIR_OVERRIDE;
    prevDisableDemoLogin = process.env.DISABLE_DEMO_LOGIN;
    prevWebhookSecret = process.env.QRIS_WEBHOOK_SECRET;
    prevSupervisorPin = process.env.SUPERVISOR_OVERRIDE_PIN;

    delete process.env.DISABLE_DEMO_LOGIN;
    process.env.QRIS_WEBHOOK_SECRET = "test-webhook-secret-v34-secure";
    process.env.SUPERVISOR_OVERRIDE_PIN = VALID_PIN;
    resetSupervisorPinRateLimitForTests();

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "v34-refund-test-"));
    process.env.DATA_DIR_OVERRIDE = tempDir;
  });

  afterEach(() => {
    resetSupervisorPinRateLimitForTests();
    if (prevDataDirOverride === undefined) {
      delete process.env.DATA_DIR_OVERRIDE;
    } else {
      process.env.DATA_DIR_OVERRIDE = prevDataDirOverride;
    }
    if (prevDisableDemoLogin === undefined) {
      delete process.env.DISABLE_DEMO_LOGIN;
    } else {
      process.env.DISABLE_DEMO_LOGIN = prevDisableDemoLogin;
    }
    if (prevWebhookSecret === undefined) {
      delete process.env.QRIS_WEBHOOK_SECRET;
    } else {
      process.env.QRIS_WEBHOOK_SECRET = prevWebhookSecret;
    }
    if (prevSupervisorPin === undefined) {
      delete process.env.SUPERVISOR_OVERRIDE_PIN;
    } else {
      process.env.SUPERVISOR_OVERRIDE_PIN = prevSupervisorPin;
    }
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("1. Rejects refund without PIN (403) across roles, rejects wrong PIN (403), and rejects whitespace-only reason (400)", async () => {
    const subtotal = KS_PRODUCT.basePrice;
    const tax = Math.round(subtotal * 0.1);
    const serviceCharge = Math.round(subtotal * 0.05);
    const total = subtotal + tax + serviceCharge;

    const createRes = await ordersRoute.POST(
      makeReq(
        "/api/orders",
        "POST",
        {
          order: {
            id: "ord-v34-guard-1",
            orderNumber: "ORD-KS-20261124-0001",
            outletId: "outlet-sgr",
            outletName: "Singaraja",
            tableNumber: "T-02",
            customerName: "Kadek Satria",
            orderType: "DINE_IN",
            status: "CONFIRMED",
            paymentStatus: "PAID",
            paymentMethod: "CASH",
            subtotal,
            tax,
            serviceCharge,
            total,
            targetServiceMinutes: 15,
            createdAt: "2026-11-24T09:00:00.000Z",
            items: [
              {
                id: "it-guard-1",
                productId: KS_PRODUCT.id,
                tenantId: KS_PRODUCT.tenantId,
                productName: KS_PRODUCT.name,
                quantity: 1,
                unitPrice: KS_PRODUCT.basePrice,
              },
            ],
            statusHistory: [],
          },
        },
        CASHIER_COOKIE
      )
    );
    expect(createRes.status).toBe(200);

    for (const roleCookie of [CASHIER_COOKIE, TENANT_KS_COOKIE, MANAGER_COOKIE]) {
      const noPinRes = await ordersRoute.PATCH(
        makeReq(
          "/api/orders",
          "PATCH",
          {
            id: "ord-v34-guard-1",
            status: "CANCELLED",
            paymentStatus: "REFUNDED",
            refundReason: "Tamu berubah pikiran",
            refundApprovedBy: "Supervisor Test",
          },
          roleCookie,
          { "x-require-supervisor-pin": "1" }
        )
      );
      expect(noPinRes.status).toBe(403);
    }

    for (const roleCookie of [
      CASHIER_COOKIE,
      TENANT_KS_COOKIE,
      MANAGER_COOKIE,
      OWNER_COOKIE,
      SUPER_ADMIN_COOKIE,
    ]) {
      resetSupervisorPinRateLimitForTests();
      const wrongPinRes = await ordersRoute.PATCH(
        makeReq(
          "/api/orders",
          "PATCH",
          {
            id: "ord-v34-guard-1",
            status: "CANCELLED",
            paymentStatus: "REFUNDED",
            refundReason: "Tamu berubah pikiran",
            refundApprovedBy: "Supervisor Test",
            supervisorPin: WRONG_PIN,
          },
          roleCookie,
          { "x-require-supervisor-pin": "1" }
        )
      );
      expect(wrongPinRes.status).toBe(403);
      const wrongBody = await wrongPinRes.json();
      expect(wrongBody.error).toContain("INVALID_SUPERVISOR_PIN");
    }

    resetSupervisorPinRateLimitForTests();
    const blankReasonRes = await ordersRoute.PATCH(
      makeReq(
        "/api/orders",
        "PATCH",
        {
          id: "ord-v34-guard-1",
          status: "CANCELLED",
          paymentStatus: "REFUNDED",
          refundReason: "    ",
          supervisorPin: VALID_PIN,
        },
        MANAGER_COOKIE,
        { "x-require-supervisor-pin": "1" }
      )
    );
    expect(blankReasonRes.status).toBe(400);
    const blankBody = await blankReasonRes.json();
    expect(blankBody.error).toContain("Alasan refund wajib diisi");

    const storedAfterRejections = (await getPersistentOrders()).find(
      (o) => o.id === "ord-v34-guard-1"
    );
    expect(storedAfterRejections?.paymentStatus).toBe("PAID");
    expect(storedAfterRejections?.status).toBe("CONFIRMED");
  });

  it("2. E2E Cash Order Refund (pre-cook): restores BOM stock once, deducts shift cash once, reverses member points & Gold->Silver tier, updates sales/settlement/audit", async () => {
    const initialMilk = INITIAL_INGREDIENTS.find((i) => i.id === "ing-1")!.stockNumber;
    const subtotal = KS_PRODUCT.basePrice * 2;
    const tax = Math.round(subtotal * 0.1);
    const serviceCharge = Math.round(subtotal * 0.05);
    const total = subtotal + tax + serviceCharge;
    const earnedPoints = Math.floor(total / 1000);

    const activeShift: ShiftRecord = {
      id: "shf-1764000000000-cash",
      shiftName: "Shift Pagi",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      assignedCashierId: "usr-cashier-sgr",
      assignedCashierName: "Ayu Kasir",
      startTime: new Date().toISOString(),
      status: "ACTIVE",
      openingCash: 500000,
      cashSales: total,
      nonCashSales: 0,
      refundAmount: 0,
      expectedCash: 500000 + total,
      actualCash: 0,
      cashVariance: 0,
      recordedSaleIds: ["ord-v34-cash-1"],
      recordedRefundIds: [],
    };
    await savePersistentShift(activeShift);

    const seededMember: LoyaltyMember = {
      id: "mem-v34-gold",
      name: "Ni Luh Putu",
      phone: "081234567899",
      email: "niluh@example.com",
      tier: "Gold",
      points: 1510,
      totalSpend: 1510000,
      totalVisits: 6,
      favoriteItem: KS_PRODUCT.name,
      registeredOutletId: "outlet-sgr",
      registeredOutletName: "Singaraja",
      status: "ACTIVE",
      joinedDate: "2026-01-10",
      lastVisit: "2026-11-24",
      pointHistory: [
        {
          id: "ptx-earn-cash-1",
          memberId: "mem-v34-gold",
          type: "EARN",
          points: earnedPoints,
          spendAmount: total,
          balanceAfter: 1510,
          reason: "Transaksi POS #ORD-KS-20261124-0002",
          relatedTransactionId: "ord-v34-cash-1",
          timestamp: "2026-11-24T09:15:00.000Z",
          actorName: "Ayu Kasir",
          outletId: "outlet-sgr",
        },
      ],
      tierHistory: [],
    };
    await savePersistentLoyaltyMember(seededMember);

    const createRes = await ordersRoute.POST(
      makeReq(
        "/api/orders",
        "POST",
        {
          order: {
            id: "ord-v34-cash-1",
            orderNumber: "ORD-KS-20261124-0002",
            outletId: "outlet-sgr",
            outletName: "Singaraja",
            tableNumber: "T-05",
            customerName: "Ni Luh Putu",
            customerPhone: "0812****7899",
            loyaltyMemberId: "mem-v34-gold",
            orderType: "DINE_IN",
            status: "CONFIRMED",
            paymentStatus: "PAID",
            paymentMethod: "CASH",
            subtotal,
            tax,
            serviceCharge,
            total,
            targetServiceMinutes: 15,
            createdAt: "2026-11-24T09:15:00.000Z",
            items: [
              {
                id: "it-cash-1",
                productId: KS_PRODUCT.id,
                tenantId: KS_PRODUCT.tenantId,
                productName: KS_PRODUCT.name,
                quantity: 2,
                unitPrice: KS_PRODUCT.basePrice,
              },
            ],
            statusHistory: [],
          },
        },
        CASHIER_COOKIE
      )
    );
    expect(createRes.status).toBe(200);

    const invAfterPaid = await readPersistentDomainState(inventoryDomainSpec);
    expect(invAfterPaid.ingredients.find((i) => i.id === "ing-1")!.stockNumber).toBeCloseTo(
      initialMilk - 0.24,
      3
    );

    const refundRes = await ordersRoute.PATCH(
      makeReq(
        "/api/orders",
        "PATCH",
        {
          id: "ord-v34-cash-1",
          status: "CANCELLED",
          paymentStatus: "REFUNDED",
          refundReason: "Salah input varian susu oleh kasir",
          refundApprovedBy: "Made Manager",
          supervisorPin: VALID_PIN,
        },
        CASHIER_COOKIE,
        { "x-require-supervisor-pin": "1" }
      )
    );
    expect(refundRes.status).toBe(200);
    const refundBody = await refundRes.json();
    const refundedOrder: OrderRecord = refundBody.order;

    expect(refundedOrder.paymentStatus).toBe("REFUNDED");
    expect(refundedOrder.status).toBe("CANCELLED");
    expect(refundedOrder.refundMethod).toBe("CASH");
    expect(refundedOrder.supervisorPinVerified).toBe(true);
    expect(refundedOrder.bomRestored).toBe(true);
    expect(refundedOrder.loyaltyPointsReversed).toBe(true);
    expect(refundBody.refundEffects.pointsDeducted).toBe(earnedPoints);

    const invAfterRefund = await readPersistentDomainState(inventoryDomainSpec);
    expect(invAfterRefund.ingredients.find((i) => i.id === "ing-1")!.stockNumber).toBeCloseTo(
      initialMilk,
      3
    );

    const repeatRefundRes = await ordersRoute.PATCH(
      makeReq(
        "/api/orders",
        "PATCH",
        {
          id: "ord-v34-cash-1",
          status: "CANCELLED",
          paymentStatus: "REFUNDED",
          refundReason: "Salah input varian susu oleh kasir",
          refundApprovedBy: "Made Manager",
          supervisorPin: VALID_PIN,
        },
        CASHIER_COOKIE,
        { "x-require-supervisor-pin": "1" }
      )
    );
    expect(repeatRefundRes.status).toBe(200);

    const invAfterRepeat = await readPersistentDomainState(inventoryDomainSpec);
    expect(invAfterRepeat.ingredients.find((i) => i.id === "ing-1")!.stockNumber).toBeCloseTo(
      initialMilk,
      3
    );

    const storedShifts = await getPersistentShifts();
    const updatedShift = storedShifts.find((s) => s.id === activeShift.id)!;
    expect(updatedShift.refundAmount).toBe(total);
    expect(updatedShift.expectedCash).toBe(500000);
    expect(updatedShift.recordedRefundIds).toContain("ord-v34-cash-1");

    const clientReplayShift = recordShiftRefundTransaction({
      shifts: storedShifts,
      cashierId: activeShift.assignedCashierId,
      shiftId: activeShift.id,
      refundAmount: total,
      orderId: "ord-v34-cash-1",
    });
    expect(clientReplayShift.shift?.refundAmount).toBe(total);
    expect(clientReplayShift.shift?.expectedCash).toBe(500000);

    const storedMembers = await getPersistentLoyaltyMembers();
    const updatedMember = storedMembers.find((m) => m.id === "mem-v34-gold")!;
    expect(updatedMember.points).toBe(1510 - earnedPoints);
    expect(updatedMember.totalSpend).toBe(1510000 - total);
    expect(updatedMember.totalVisits).toBe(5);
    expect(updatedMember.tier).toBe("Silver");

    const membersGetRes = await getLoyaltyMembers(
      makeReq("/api/loyalty/members", "GET", undefined, CASHIER_COOKIE)
    );
    expect(membersGetRes.status).toBe(200);
    const membersGetBody: { members: LoyaltyMember[] } = await membersGetRes.json();
    const refreshedForCashier = membersGetBody.members.find(
      (m) => m.id === "mem-v34-gold"
    )!;
    expect(refreshedForCashier.points).toBe(1510 - earnedPoints);
    expect(refreshedForCashier.tier).toBe("Silver");

    const salesReport = buildReportData({
      type: "SALES",
      scopeName: "Singaraja",
      orders: [refundedOrder],
      products: [KS_PRODUCT],
    });
    expect(salesReport.summaryCards[0].value).toBe("Rp 0");
    expect(salesReport.tableRows).toHaveLength(0);

    const productsReport = buildReportData({
      type: "PRODUCTS",
      scopeName: "Singaraja",
      orders: [refundedOrder],
      products: [KS_PRODUCT],
    });
    expect(productsReport.summaryCards[3].value).toBe("0 pcs");

    expect(calculateSettlement([refundedOrder])).toHaveLength(0);

    const logs = await getAuditLogs();
    const refundAudit = logs.find(
      (l) => l.action === "REFUND_ORDER" && l.referenceId === "ord-v34-cash-1"
    );
    expect(refundAudit).toBeDefined();
    expect(refundAudit?.reason).toBe("Salah input varian susu oleh kasir");
    expect(refundAudit?.description).toContain("Made Manager");
    expect(refundAudit?.metadata?.refundMethod).toBe("CASH");
    expect(refundAudit?.metadata?.originalPaymentMethod).toBe("CASH");
  });

  it("3. E2E QRIS Order Refund (post-cook, mixed cart F&B + Coworking): forces CASH refund, keeps post-cook BOM deducted, deducts drawer cash, drops both settlement shares, and updates closing report math", async () => {
    const initialMilk = INITIAL_INGREDIENTS.find((i) => i.id === "ing-1")!.stockNumber;
    const fnbSubtotal = KS_PRODUCT.basePrice * 2;
    const coworkingSubtotal = 45000;
    const subtotal = fnbSubtotal + coworkingSubtotal;
    const fnbTax = Math.round(fnbSubtotal * 0.1);
    const serviceCharge = Math.round(fnbSubtotal * 0.05);
    const total = subtotal + fnbTax + serviceCharge;

    const invoiceNumber = "INV-QRIS-V34-MIXED-01";
    const initRes = await postQrisVerify(
      makeReq(
        "/api/pos/qris/verify",
        "POST",
        { mode: "INIT", invoiceNumber, expectedAmount: total },
        CASHIER_COOKIE
      )
    );
    expect(initRes.status).toBe(200);

    const webhookSig = signQrisWebhookPayload({
      invoiceNumber,
      amount: total,
      transactionStatus: "SUCCESS",
    });
    const verifyRes = await postQrisVerify(
      makeReq(
        "/api/pos/qris/verify",
        "POST",
        { invoiceNumber, amount: total, transactionStatus: "SUCCESS" },
        undefined,
        { "x-dago-signature": webhookSig }
      )
    );
    expect(verifyRes.status).toBe(200);
    const { verification } = await verifyRes.json();

    const activeShift: ShiftRecord = {
      id: "shf-1764000000000-qris",
      shiftName: "Shift Siang",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      assignedCashierId: "usr-cashier-sgr",
      assignedCashierName: "Ayu Kasir",
      startTime: new Date().toISOString(),
      status: "ACTIVE",
      openingCash: 600000,
      cashSales: 50000,
      nonCashSales: total,
      refundAmount: 0,
      expectedCash: 650000,
      actualCash: 0,
      cashVariance: 0,
      recordedSaleIds: ["ord-v34-qris-1"],
      recordedRefundIds: [],
    };
    await savePersistentShift(activeShift);

    const createRes = await ordersRoute.POST(
      makeReq(
        "/api/orders",
        "POST",
        {
          order: {
            id: "ord-v34-qris-1",
            orderNumber: "ORD-DAGO-20261124-0003",
            outletId: "outlet-sgr",
            outletName: "Singaraja",
            tableNumber: "CW-03",
            customerName: "Gede Wirawan",
            orderType: "DINE_IN",
            status: "CONFIRMED",
            paymentStatus: "PAID",
            paymentMethod: "QRIS",
            paymentReference: verification.referenceNumber,
            qrisVerification: verification,
            subtotal,
            tax: fnbTax,
            fnbTax,
            coworkingTax: 0,
            serviceCharge,
            total,
            targetServiceMinutes: 15,
            createdAt: "2026-11-24T13:00:00.000Z",
            items: [
              {
                id: "it-qris-fnb",
                productId: KS_PRODUCT.id,
                tenantId: KS_PRODUCT.tenantId,
                itemType: "FNB",
                productName: KS_PRODUCT.name,
                quantity: 2,
                unitPrice: KS_PRODUCT.basePrice,
              },
              {
                id: "it-qris-cw",
                tenantId: "DAGO_HUB",
                itemType: "COWORKING",
                category: "COWORKING",
                productName: "Focus Desk Pass 3 Jam",
                quantity: 1,
                unitPrice: coworkingSubtotal,
                coworkingMeta: {
                  spaceId: "cw-desk-1",
                  spaceName: "Focus Desk 01",
                  durationHours: 3,
                },
              },
            ],
            statusHistory: [],
          },
        },
        CASHIER_COOKIE
      )
    );
    expect(createRes.status).toBe(200);
    const createdOrder: OrderRecord = (await createRes.json()).order;

    const settlementBefore = calculateSettlement([createdOrder]);
    expect(settlementBefore.find((s) => s.tenantId === "tenant-ks")).toBeDefined();
    expect(settlementBefore.find((s) => s.tenantId === "DAGO_HUB")).toBeDefined();

    const cookRes = await ordersRoute.PATCH(
      makeReq(
        "/api/orders",
        "PATCH",
        { id: "ord-v34-qris-1", status: "COOKING" },
        KITCHEN_COOKIE
      )
    );
    expect(cookRes.status).toBe(200);

    const refundRes = await ordersRoute.PATCH(
      makeReq(
        "/api/orders",
        "PATCH",
        {
          id: "ord-v34-qris-1",
          status: "CANCELLED",
          paymentStatus: "REFUNDED",
          refundMethod: "QRIS",
          refundReason: "Tamu batal rapat mendadak setelah kopi dibuat",
          refundApprovedBy: "Hendra Owner",
          supervisorPin: VALID_PIN,
        },
        MANAGER_COOKIE,
        { "x-require-supervisor-pin": "1" }
      )
    );
    expect(refundRes.status).toBe(200);
    const refundJson = await refundRes.json();
    const refundedQris: OrderRecord = refundJson.order;

    expect(refundedQris.paymentStatus).toBe("REFUNDED");
    expect(refundedQris.status).toBe("CANCELLED");
    expect(refundedQris.refundMethod).toBe("CASH");
    expect(refundedQris.bomRestored).toBeFalsy();
    expect(refundJson.bomRestoration.restored).toBe(false);

    const invState = await readPersistentDomainState(inventoryDomainSpec);
    expect(invState.ingredients.find((i) => i.id === "ing-1")!.stockNumber).toBeCloseTo(
      initialMilk - 0.24,
      3
    );

    const updatedShift = (await getPersistentShifts()).find((s) => s.id === activeShift.id)!;
    expect(updatedShift.refundAmount).toBe(total);
    expect(updatedShift.expectedCash).toBe(650000 - total);
    expect(updatedShift.nonCashSales).toBe(total);

    expect(calculateSettlement([refundedQris])).toHaveLength(0);

    const sampleClosingReport: ClosingReportData = {
      reportNumber: "RPT-V34-01",
      outletName: "Singaraja",
      outletAddress: "Jl. Ngurah Rai",
      outletPhone: "0812",
      cashierName: "Ayu Kasir",
      closingDateTime: "24 Nov 2026 16:00 WITA",
      shiftName: "Shift Siang",
      initialCash: 600000,
      totalCashSales: 50000,
      qrisSales: 0,
      edcSales: 0,
      totalTransactionsCount: 1,
      totalGrossSales: 50000,
      totalDiscounts: 0,
      isTaxEnabled: true,
      taxRatePercent: 10,
      totalTax: 4545,
      totalNetSales: 45455,
      tenantSharePercent: 85,
      dagoSharePercent: 15,
      tenantTotalShare: 38637,
      dagoTotalShare: 6818,
      tenantQrisShare: 0,
      dagoQrisShare: 0,
      tenantCashShare: 38637,
      dagoCashShare: 6818,
      refundAmount: total,
      actualCashEnding: 650000 - total,
      cashDifference: 0,
      verificationHash: "V34HASH1234",
    };

    const pdfUrl = buildClosingReportPdfUrl(sampleClosingReport);
    const parsedUrl = new URL(`http://localhost:3000${pdfUrl}`);
    expect(Number(parsedUrl.searchParams.get("expectedCash"))).toBe(650000 - total);
    expect(Number(parsedUrl.searchParams.get("refundAmount"))).toBe(total);

    parsedUrl.searchParams.delete("expectedCash");
    const pdfRes = await getClosingPdf(new NextRequest(parsedUrl.toString()));
    expect(pdfRes.status).toBe(200);
    const pdfHtml = await pdfRes.text();
    expect(pdfHtml).toContain("Refund tunai");
    expect(pdfHtml).toContain((650000 - total).toLocaleString("id-ID"));

    const logs = await getAuditLogs();
    const qrisRefundLog = logs.find(
      (l) => l.action === "REFUND_ORDER" && l.referenceId === "ord-v34-qris-1"
    );
    expect(qrisRefundLog).toBeDefined();
    expect(qrisRefundLog?.metadata?.originalPaymentMethod).toBe("QRIS");
    expect(qrisRefundLog?.metadata?.refundMethod).toBe("CASH");
  });

  it("4. Report #6 (VOID_REFUND_DISCOUNT): aggregates Cash Refund, QRIS Refund, Void, and Manual Discount while excluding Promo/Voucher and pro-rating Tenant scope", async () => {
    const manualSubtotal = 60000;
    const manualDiscount = 10000;
    const manualTax = 5000;
    const manualTotal = manualSubtotal - manualDiscount + manualTax;

    const manualCreateRes = await ordersRoute.POST(
      makeReq(
        "/api/orders",
        "POST",
        {
          order: {
            id: "ord-v34-manual-disc",
            orderNumber: "ORD-DAGO-20261124-0010",
            outletId: "outlet-sgr",
            outletName: "Singaraja",
            tableNumber: "T-08",
            customerName: "Komang Adi",
            cashierName: "Ayu Kasir",
            orderType: "DINE_IN",
            status: "COMPLETED",
            paymentStatus: "PAID",
            paymentMethod: "CASH",
            subtotal: manualSubtotal,
            discount: manualDiscount,
            discountSource: "MANUAL",
            manualDiscountReason: "Kompensasi tunggu makanan",
            manualDiscountApprovedBy: "Supervisor Putu",
            tax: manualTax,
            serviceCharge: 0,
            total: manualTotal,
            targetServiceMinutes: 15,
            createdAt: "2026-11-24T14:00:00.000Z",
            items: [
              {
                id: "it-man-ks",
                productId: KS_PRODUCT.id,
                tenantId: "tenant-ks",
                productName: KS_PRODUCT.name,
                quantity: 1,
                unitPrice: 30000,
              },
              {
                id: "it-man-bk",
                productId: BAKERY_PRODUCT.id,
                tenantId: "tenant-bakery",
                productName: BAKERY_PRODUCT.name,
                quantity: 1,
                unitPrice: 30000,
              },
            ],
            statusHistory: [],
          },
        },
        CASHIER_COOKIE
      )
    );
    expect(manualCreateRes.status).toBe(200);
    const manualOrder: OrderRecord = (await manualCreateRes.json()).order;

    const serverLogs = await getAuditLogs();
    const applyDiscountAudit = serverLogs.find(
      (l) => l.action === "APPLY_DISCOUNT" && l.referenceId === "ord-v34-manual-disc"
    );
    expect(applyDiscountAudit).toBeDefined();
    expect(applyDiscountAudit?.reason).toBe("Kompensasi tunggu makanan");

    const cashRefundOrder: OrderRecord = {
      id: "ord-v34-rep-cash",
      orderNumber: "ORD-KS-20261124-0011",
      organizationId: "org-dago-hub",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "T-01",
      customerName: "Wayan",
      orderType: "DINE_IN",
      status: "CANCELLED",
      paymentStatus: "REFUNDED",
      paymentMethod: "CASH",
      refundMethod: "CASH",
      refundReason: "Menu habis",
      refundApprovedBy: "Manager Bli",
      refundedAt: "2026-11-24T14:10:00.000Z",
      bomRestored: true,
      loyaltyPointsReversed: true,
      subtotal: 30000,
      tax: 3000,
      serviceCharge: 0,
      total: 33000,
      targetServiceMinutes: 15,
      createdAt: "2026-11-24T14:05:00.000Z",
      items: [
        {
          id: "it-rc-1",
          productId: KS_PRODUCT.id,
          tenantId: "tenant-ks",
          productName: KS_PRODUCT.name,
          quantity: 1,
          unitPrice: 30000,
        },
      ],
      statusHistory: [],
    };

    const qrisRefundOrder: OrderRecord = {
      id: "ord-v34-rep-qris",
      orderNumber: "ORD-BK-20261124-0012",
      organizationId: "org-dago-hub",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "T-02",
      customerName: "Ketut",
      orderType: "DINE_IN",
      status: "CANCELLED",
      paymentStatus: "REFUNDED",
      paymentMethod: "QRIS",
      refundMethod: "CASH",
      refundReason: "Roti dingin",
      refundApprovedBy: "Owner Dago",
      refundedAt: "2026-11-24T14:20:00.000Z",
      bomRestored: false,
      subtotal: 40000,
      tax: 4000,
      serviceCharge: 0,
      total: 44000,
      targetServiceMinutes: 15,
      createdAt: "2026-11-24T14:12:00.000Z",
      items: [
        {
          id: "it-rq-1",
          productId: BAKERY_PRODUCT.id,
          tenantId: "tenant-bakery",
          productName: BAKERY_PRODUCT.name,
          quantity: 1,
          unitPrice: 40000,
        },
      ],
      statusHistory: [],
    };

    const voidUnpaidOrder: OrderRecord = {
      id: "ord-v34-rep-void",
      orderNumber: "ORD-KS-20261124-0013",
      organizationId: "org-dago-hub",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "T-03",
      customerName: "Putu",
      orderType: "DINE_IN",
      status: "CANCELLED",
      paymentStatus: "PENDING",
      voidReason: "Tamu pindah meja",
      voidApprovedBy: "Manager Bli",
      voidedAt: "2026-11-24T14:25:00.000Z",
      subtotal: 25000,
      tax: 2500,
      serviceCharge: 0,
      total: 27500,
      targetServiceMinutes: 15,
      createdAt: "2026-11-24T14:22:00.000Z",
      items: [
        {
          id: "it-rv-1",
          productId: KS_PRODUCT.id,
          tenantId: "tenant-ks",
          productName: KS_PRODUCT.name,
          quantity: 1,
          unitPrice: 25000,
        },
      ],
      statusHistory: [],
    };

    const promoOrder: OrderRecord = {
      ...manualOrder,
      id: "ord-v34-promo-excluded",
      orderNumber: "ORD-KS-20261124-0014",
      promoId: "PROMO-10",
      discountSource: "PROMO",
      discount: 6000,
    };

    const voucherOrder: OrderRecord = {
      ...manualOrder,
      id: "ord-v34-voucher-excluded",
      orderNumber: "ORD-KS-20261124-0015",
      discountSource: "VOUCHER",
      voucherTitle: "Voucher Member 15K",
      discount: 15000,
    };

    const allDatasetOrders: OrderRecord[] = [
      manualOrder,
      cashRefundOrder,
      qrisRefundOrder,
      voidUnpaidOrder,
      promoOrder,
      voucherOrder,
    ];

    const hubCategories = getReportCategories({
      ordersCount: 3,
      tenantsCount: 2,
      shiftsCount: 1,
      productsCount: 10,
      materialsCount: 5,
      logsCount: serverLogs.length,
      voidRefundDiscountCount: countVoidRefundDiscountEntries({
        orders: allDatasetOrders,
        logs: serverLogs,
      }),
      isTenantScope: false,
    });
    const hubCategory = hubCategories.find((c) => c.id === "VOID_REFUND_DISCOUNT");
    expect(hubCategory).toBeDefined();
    expect(hubCategory?.label).toBe("Void, refund & diskon");
    expect(hubCategory?.rawCount).toBe(4);

    const tenantCategories = getReportCategories({
      ordersCount: 2,
      tenantsCount: 1,
      shiftsCount: 0,
      productsCount: 5,
      materialsCount: 0,
      logsCount: 0,
      voidRefundDiscountCount: countVoidRefundDiscountEntries({
        orders: allDatasetOrders,
        logs: serverLogs,
        tenantId: "tenant-ks",
      }),
      isTenantScope: true,
    });
    const tenantCategory = tenantCategories.find((c) => c.id === "VOID_REFUND_DISCOUNT");
    expect(tenantCategory).toBeDefined();
    expect(tenantCategory?.label).toBe("Void, refund & diskon");
    expect(tenantCategory?.rawCount).toBe(3);

    const hubReport = buildReportData({
      type: "VOID_REFUND_DISCOUNT",
      scopeName: "Singaraja",
      orders: allDatasetOrders,
      logs: serverLogs,
    });
    expect(hubReport.title).toBe("Laporan void, refund & diskon manual");
    expect(hubReport.tableRows).toHaveLength(4);
    expect(hubReport.summaryCards[0].value).toBe("Rp 77.000");
    expect(hubReport.summaryCards[0].sub).toContain("1 asal QRIS");
    expect(hubReport.summaryCards[1].value).toBe("Rp 27.500");
    expect(hubReport.summaryCards[2].value).toBe("Rp 10.000");
    expect(hubReport.summaryCards[3].value).toBe("Rp 114.500");

    const rowMethods = hubReport.tableRows.map((r) => r[3]);
    expect(rowMethods).toContain("QRIS ke tunai");
    expect(rowMethods).toContain("Tunai ke tunai");
    expect(rowMethods).toContain("Belum bayar");

    const cashRow = hubReport.tableRows.find((r) => r[0] === "ORD-KS-20261124-0011")!;
    expect(cashRow[2]).toBe("Refund");
    expect(cashRow[5]).toBe("Stok kembali · Poin ditarik");

    const qrisRow = hubReport.tableRows.find((r) => r[0] === "ORD-BK-20261124-0012")!;
    expect(qrisRow[2]).toBe("Refund");
    expect(qrisRow[3]).toBe("QRIS ke tunai");
    expect(qrisRow[5]).toBe("Limbah dapur");

    const tenantKsReport = buildReportData({
      type: "VOID_REFUND_DISCOUNT",
      scopeName: "Kopi Senja · Singaraja",
      orders: allDatasetOrders,
      logs: serverLogs,
      tenantId: "tenant-ks",
    });
    expect(tenantKsReport.tableRows).toHaveLength(3);
    expect(tenantKsReport.tableRows.some((r) => r[0] === "ORD-BK-20261124-0012")).toBe(false);
    expect(tenantKsReport.summaryCards[0].value).toBe("Rp 33.000");
    expect(tenantKsReport.summaryCards[1].value).toBe("Rp 27.500");
    expect(tenantKsReport.summaryCards[2].value).toBe("Rp 5.000");
  });

  it("5. Blocks fabricated REFUNDED or CANCELLED order creation on POST (400) and leaves 0 rows in VOID_REFUND_DISCOUNT", async () => {
    const subtotal = KS_PRODUCT.basePrice;
    const tax = Math.round(subtotal * 0.1);
    const total = subtotal + tax;

    const fabricatedRefundRes = await ordersRoute.POST(
      makeReq(
        "/api/orders",
        "POST",
        {
          order: {
            id: "ord-v34-fab-refund",
            orderNumber: "ORD-KS-20261124-0091",
            outletId: "outlet-sgr",
            outletName: "Singaraja",
            tableNumber: "T-01",
            customerName: "Fabricated Guest",
            orderType: "DINE_IN",
            status: "CANCELLED",
            paymentStatus: "REFUNDED",
            paymentMethod: "CASH",
            refundReason: "Refund palsu langsung saat insert",
            subtotal,
            tax,
            serviceCharge: 0,
            total,
            targetServiceMinutes: 15,
            createdAt: "2026-11-24T10:00:00.000Z",
            items: [
              {
                id: "it-fab-1",
                productId: KS_PRODUCT.id,
                tenantId: KS_PRODUCT.tenantId,
                productName: KS_PRODUCT.name,
                quantity: 1,
                unitPrice: subtotal,
              },
            ],
            statusHistory: [],
          },
        },
        CASHIER_COOKIE
      )
    );
    expect(fabricatedRefundRes.status).toBe(400);
    const fabRefundBody = await fabricatedRefundRes.json();
    expect(fabRefundBody.error).toContain("INVALID_ORDER_PAYLOAD");

    const fabricatedCancelRes = await ordersRoute.POST(
      makeReq(
        "/api/orders",
        "POST",
        {
          order: {
            id: "ord-v34-fab-cancel",
            orderNumber: "ORD-KS-20261124-0092",
            outletId: "outlet-sgr",
            outletName: "Singaraja",
            tableNumber: "T-02",
            customerName: "Fabricated Void",
            orderType: "DINE_IN",
            status: "CANCELLED",
            paymentStatus: "PENDING",
            voidReason: "Void palsu saat insert",
            subtotal,
            tax,
            serviceCharge: 0,
            total,
            targetServiceMinutes: 15,
            createdAt: "2026-11-24T10:05:00.000Z",
            items: [
              {
                id: "it-fab-2",
                productId: KS_PRODUCT.id,
                tenantId: KS_PRODUCT.tenantId,
                productName: KS_PRODUCT.name,
                quantity: 1,
                unitPrice: subtotal,
              },
            ],
            statusHistory: [],
          },
        },
        CASHIER_COOKIE
      )
    );
    expect(fabricatedCancelRes.status).toBe(400);
    const fabCancelBody = await fabricatedCancelRes.json();
    expect(fabCancelBody.error).toContain("INVALID_ORDER_PAYLOAD");

    const storedOrders = await getPersistentOrders();
    expect(storedOrders).toHaveLength(0);

    const report = buildReportData({
      type: "VOID_REFUND_DISCOUNT",
      scopeName: "Singaraja",
      orders: storedOrders,
    });
    expect(report.tableRows).toHaveLength(0);
    expect(countVoidRefundDiscountEntries({ orders: storedOrders })).toBe(0);
  });

  it("6. Rejects unpaid PENDING -> REFUNDED transition (400) and strips client-spoofed supervisorPinVerified on creation", async () => {
    const subtotal = KS_PRODUCT.basePrice;
    const tax = Math.round(subtotal * 0.1);
    const total = subtotal + tax;

    const createRes = await ordersRoute.POST(
      makeReq(
        "/api/orders",
        "POST",
        {
          order: {
            id: "ord-v34-unpaid-spoof",
            orderNumber: "ORD-KS-20261124-0093",
            outletId: "outlet-sgr",
            outletName: "Singaraja",
            tableNumber: "T-04",
            customerName: "Tamu Belum Bayar",
            orderType: "DINE_IN",
            status: "NEW",
            paymentStatus: "PENDING",
            supervisorPinVerified: true,
            subtotal,
            tax,
            serviceCharge: 0,
            total,
            targetServiceMinutes: 15,
            createdAt: "2026-11-24T10:10:00.000Z",
            items: [
              {
                id: "it-unpaid-1",
                productId: KS_PRODUCT.id,
                tenantId: KS_PRODUCT.tenantId,
                productName: KS_PRODUCT.name,
                quantity: 1,
                unitPrice: subtotal,
              },
            ],
            statusHistory: [],
          },
        },
        CASHIER_COOKIE
      )
    );
    expect(createRes.status).toBe(200);
    const createdBody = await createRes.json();
    expect(createdBody.order.supervisorPinVerified).toBeUndefined();

    const storedCreated = (await getPersistentOrders()).find(
      (o) => o.id === "ord-v34-unpaid-spoof"
    );
    expect(storedCreated?.supervisorPinVerified).toBeUndefined();

    const unpaidRefundRes = await ordersRoute.PATCH(
      makeReq(
        "/api/orders",
        "PATCH",
        {
          id: "ord-v34-unpaid-spoof",
          status: "CANCELLED",
          paymentStatus: "REFUNDED",
          refundReason: "Coba ambil uang tunai dari pesanan belum bayar",
          supervisorPin: VALID_PIN,
        },
        CASHIER_COOKIE,
        { "x-require-supervisor-pin": "1" }
      )
    );
    expect(unpaidRefundRes.status).toBe(400);
    const unpaidRefundBody = await unpaidRefundRes.json();
    expect(unpaidRefundBody.error).toContain("INVALID_REFUND_STATE");

    const storedAfter = (await getPersistentOrders()).find(
      (o) => o.id === "ord-v34-unpaid-spoof"
    );
    expect(storedAfter?.paymentStatus).toBe("PENDING");
    expect(storedAfter?.status).toBe("NEW");
  });

  it("7. True concurrent refunds (Promise.all) serialize mutations on shifts.json and loyalty_members.json with zero lost updates", async () => {
    const openingCash = 500000;
    const cashSales = 55000;
    const nonCashSales = 66000;

    const activeShift: ShiftRecord = {
      id: "shf-v34-conc-1",
      shiftName: "Shift Pagi",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      assignedCashierId: "usr-cashier-sgr",
      assignedCashierName: "Ayu Kasir",
      startTime: new Date().toISOString(),
      status: "ACTIVE",
      openingCash,
      cashSales,
      nonCashSales,
      refundAmount: 0,
      expectedCash: openingCash + cashSales,
      actualCash: 0,
      cashVariance: 0,
      recordedSaleIds: ["ord-conc-1", "ord-conc-2"],
      recordedRefundIds: [],
    };
    await savePersistentShift(activeShift);

    const invoiceNumber = "INV-QRIS-CONC-2";
    const initQrisRes = await postQrisVerify(
      makeReq(
        "/api/pos/qris/verify",
        "POST",
        { mode: "INIT", invoiceNumber, expectedAmount: 66000 },
        CASHIER_COOKIE
      )
    );
    expect(initQrisRes.status).toBe(200);
    const webhookSig = signQrisWebhookPayload({
      invoiceNumber,
      amount: 66000,
      transactionStatus: "SUCCESS",
    });
    const verifyQrisRes = await postQrisVerify(
      makeReq(
        "/api/pos/qris/verify",
        "POST",
        { invoiceNumber, amount: 66000, transactionStatus: "SUCCESS" },
        undefined,
        { "x-dago-signature": webhookSig }
      )
    );
    expect(verifyQrisRes.status).toBe(200);
    const { verification } = await verifyQrisRes.json();

    const seededMember: LoyaltyMember = {
      id: "mem-v34-conc",
      name: "Made Concurrent",
      phone: "081355667788",
      tier: "Bronze",
      points: 300,
      totalSpend: 300000,
      totalVisits: 4,
      favoriteItem: KS_PRODUCT.name,
      registeredOutletId: "outlet-sgr",
      registeredOutletName: "Singaraja",
      status: "ACTIVE",
      joinedDate: "2026-02-01",
      lastVisit: "2026-11-24",
      pointHistory: [
        {
          id: "ptx-earn-conc-2",
          memberId: "mem-v34-conc",
          type: "EARN",
          points: 66,
          spendAmount: 66000,
          balanceAfter: 300,
          reason: "Transaksi POS #ORD-KS-20261124-0102",
          relatedTransactionId: "ord-conc-2",
          timestamp: "2026-11-24T11:05:00.000Z",
          actorName: "Ayu Kasir",
          outletId: "outlet-sgr",
        },
        {
          id: "ptx-earn-conc-1",
          memberId: "mem-v34-conc",
          type: "EARN",
          points: 55,
          spendAmount: 55000,
          balanceAfter: 234,
          reason: "Transaksi POS #ORD-KS-20261124-0101",
          relatedTransactionId: "ord-conc-1",
          timestamp: "2026-11-24T11:00:00.000Z",
          actorName: "Ayu Kasir",
          outletId: "outlet-sgr",
        },
      ],
      tierHistory: [],
    };
    await savePersistentLoyaltyMember(seededMember);

    const create1 = await ordersRoute.POST(
      makeReq(
        "/api/orders",
        "POST",
        {
          order: {
            id: "ord-conc-1",
            orderNumber: "ORD-KS-20261124-0101",
            outletId: "outlet-sgr",
            outletName: "Singaraja",
            tableNumber: "T-06",
            customerName: "Made Concurrent",
            loyaltyMemberId: "mem-v34-conc",
            orderType: "DINE_IN",
            status: "CONFIRMED",
            paymentStatus: "PAID",
            paymentMethod: "CASH",
            subtotal: 50000,
            tax: 5000,
            serviceCharge: 0,
            total: 55000,
            targetServiceMinutes: 15,
            createdAt: "2026-11-24T11:00:00.000Z",
            items: [
              {
                id: "it-conc-1",
                productId: BAKERY_PRODUCT.id,
                tenantId: BAKERY_PRODUCT.tenantId,
                productName: BAKERY_PRODUCT.name,
                quantity: 2,
                unitPrice: 25000,
              },
            ],
            statusHistory: [],
          },
        },
        CASHIER_COOKIE
      )
    );
    expect(create1.status).toBe(200);

    const create2 = await ordersRoute.POST(
      makeReq(
        "/api/orders",
        "POST",
        {
          order: {
            id: "ord-conc-2",
            orderNumber: "ORD-KS-20261124-0102",
            outletId: "outlet-sgr",
            outletName: "Singaraja",
            tableNumber: "T-07",
            customerName: "Made Concurrent",
            loyaltyMemberId: "mem-v34-conc",
            orderType: "DINE_IN",
            status: "CONFIRMED",
            paymentStatus: "PAID",
            paymentMethod: "QRIS",
            paymentReference: verification.referenceNumber,
            qrisVerification: verification,
            subtotal: 60000,
            tax: 6000,
            serviceCharge: 0,
            total: 66000,
            targetServiceMinutes: 15,
            createdAt: "2026-11-24T11:05:00.000Z",
            items: [
              {
                id: "it-conc-2",
                productId: KS_PRODUCT.id,
                tenantId: KS_PRODUCT.tenantId,
                productName: KS_PRODUCT.name,
                quantity: 2,
                unitPrice: 30000,
              },
            ],
            statusHistory: [],
          },
        },
        CASHIER_COOKIE
      )
    );
    expect(create2.status).toBe(200);

    const patchRefund1 = ordersRoute.PATCH(
      makeReq(
        "/api/orders",
        "PATCH",
        {
          id: "ord-conc-1",
          status: "CANCELLED",
          paymentStatus: "REFUNDED",
          refundReason: "Refund paralel tunai",
          refundApprovedBy: "Supervisor Satu",
          supervisorPin: VALID_PIN,
        },
        CASHIER_COOKIE,
        { "x-require-supervisor-pin": "1" }
      )
    );
    const patchRefund2 = ordersRoute.PATCH(
      makeReq(
        "/api/orders",
        "PATCH",
        {
          id: "ord-conc-2",
          status: "CANCELLED",
          paymentStatus: "REFUNDED",
          refundReason: "Refund paralel QRIS",
          refundApprovedBy: "Supervisor Dua",
          supervisorPin: VALID_PIN,
        },
        MANAGER_COOKIE,
        { "x-require-supervisor-pin": "1" }
      )
    );

    const [res1, res2] = await Promise.all([patchRefund1, patchRefund2]);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const updatedShift = (await getPersistentShifts()).find((s) => s.id === activeShift.id)!;
    expect(updatedShift.refundAmount).toBe(121000);
    expect(updatedShift.expectedCash).toBe(openingCash + cashSales - 121000);
    expect(updatedShift.recordedRefundIds).toContain("ord-conc-1");
    expect(updatedShift.recordedRefundIds).toContain("ord-conc-2");

    const updatedMember = (await getPersistentLoyaltyMembers()).find(
      (m) => m.id === "mem-v34-conc"
    )!;
    expect(updatedMember.points).toBe(179);
    expect(updatedMember.totalSpend).toBe(179000);
    expect(updatedMember.totalVisits).toBe(2);
    expect(
      updatedMember.pointHistory.some((ptx) => ptx.relatedTransactionId === "rev-ord-conc-1")
    ).toBe(true);
    expect(
      updatedMember.pointHistory.some((ptx) => ptx.relatedTransactionId === "rev-ord-conc-2")
    ).toBe(true);
  });

  it("8. Reverses combined voucher REDEEM (+100) and EARN (-50) to exact 500 balance, and never deducts speculative points without an EARN entry", async () => {
    const comboMember: LoyaltyMember = {
      id: "mem-v34-combo",
      name: "Kadek Voucher",
      phone: "081998877665",
      tier: "Silver",
      points: 450,
      totalSpend: 550000,
      totalVisits: 5,
      favoriteItem: KS_PRODUCT.name,
      registeredOutletId: "outlet-sgr",
      registeredOutletName: "Singaraja",
      status: "ACTIVE",
      joinedDate: "2026-03-01",
      lastVisit: "2026-11-24",
      pointHistory: [
        {
          id: "ptx-combo-earn",
          memberId: "mem-v34-combo",
          type: "EARN",
          points: 50,
          spendAmount: 50000,
          balanceAfter: 450,
          reason: "Transaksi POS #ORD-KS-20261124-0201",
          relatedTransactionId: "ord-combo-1",
          timestamp: "2026-11-24T12:00:05.000Z",
          actorName: "Ayu Kasir",
          outletId: "outlet-sgr",
        },
        {
          id: "ptx-combo-redeem",
          memberId: "mem-v34-combo",
          type: "REDEEM",
          points: -100,
          balanceAfter: 400,
          reason: 'Voucher "Potongan 10K" pada ORD-KS-20261124-0201',
          relatedTransactionId: "ord-combo-1",
          timestamp: "2026-11-24T12:00:00.000Z",
          actorName: "Ayu Kasir",
          outletId: "outlet-sgr",
        },
      ],
      tierHistory: [],
    };
    await savePersistentLoyaltyMember(comboMember);

    const noEarnMember: LoyaltyMember = {
      id: "mem-v34-no-earn",
      name: "Putu Tanpa Earn",
      phone: "081776655443",
      tier: "Bronze",
      points: 200,
      totalSpend: 200000,
      totalVisits: 2,
      favoriteItem: KS_PRODUCT.name,
      registeredOutletId: "outlet-sgr",
      registeredOutletName: "Singaraja",
      status: "ACTIVE",
      joinedDate: "2026-03-05",
      lastVisit: "2026-11-20",
      pointHistory: [],
      tierHistory: [],
    };
    await savePersistentLoyaltyMember(noEarnMember);

    const createComboRes = await ordersRoute.POST(
      makeReq(
        "/api/orders",
        "POST",
        {
          order: {
            id: "ord-combo-1",
            orderNumber: "ORD-KS-20261124-0201",
            outletId: "outlet-sgr",
            outletName: "Singaraja",
            tableNumber: "T-09",
            customerName: "Kadek Voucher",
            loyaltyMemberId: "mem-v34-combo",
            orderType: "DINE_IN",
            status: "CONFIRMED",
            paymentStatus: "PAID",
            paymentMethod: "CASH",
            subtotal: 55000,
            discount: 10000,
            discountSource: "VOUCHER",
            voucherTitle: "Potongan 10K",
            tax: 5000,
            serviceCharge: 0,
            total: 50000,
            targetServiceMinutes: 15,
            createdAt: "2026-11-24T12:00:00.000Z",
            items: [
              {
                id: "it-combo-1",
                productId: KS_PRODUCT.id,
                tenantId: KS_PRODUCT.tenantId,
                productName: KS_PRODUCT.name,
                quantity: 1,
                unitPrice: 55000,
              },
            ],
            statusHistory: [],
          },
        },
        CASHIER_COOKIE
      )
    );
    expect(createComboRes.status).toBe(200);

    const refundComboRes = await ordersRoute.PATCH(
      makeReq(
        "/api/orders",
        "PATCH",
        {
          id: "ord-combo-1",
          status: "CANCELLED",
          paymentStatus: "REFUNDED",
          refundReason: "Pesanan dibatalkan sebelum masak",
          refundApprovedBy: "Manager Bli",
          supervisorPin: VALID_PIN,
        },
        CASHIER_COOKIE,
        { "x-require-supervisor-pin": "1" }
      )
    );
    expect(refundComboRes.status).toBe(200);
    const refundComboBody = await refundComboRes.json();
    expect(refundComboBody.refundEffects.voucherPointsRestored).toBe(100);
    expect(refundComboBody.refundEffects.pointsDeducted).toBe(50);

    const createNoEarnRes = await ordersRoute.POST(
      makeReq(
        "/api/orders",
        "POST",
        {
          order: {
            id: "ord-no-earn-1",
            orderNumber: "ORD-KS-20261124-0202",
            outletId: "outlet-sgr",
            outletName: "Singaraja",
            tableNumber: "T-10",
            customerName: "Putu Tanpa Earn",
            loyaltyMemberId: "mem-v34-no-earn",
            orderType: "DINE_IN",
            status: "CONFIRMED",
            paymentStatus: "PAID",
            paymentMethod: "CASH",
            subtotal: 30000,
            tax: 3000,
            serviceCharge: 0,
            total: 33000,
            targetServiceMinutes: 15,
            createdAt: "2026-11-24T12:10:00.000Z",
            items: [
              {
                id: "it-noearn-1",
                productId: KS_PRODUCT.id,
                tenantId: KS_PRODUCT.tenantId,
                productName: KS_PRODUCT.name,
                quantity: 1,
                unitPrice: 30000,
              },
            ],
            statusHistory: [],
          },
        },
        CASHIER_COOKIE
      )
    );
    expect(createNoEarnRes.status).toBe(200);

    const refundNoEarnRes = await ordersRoute.PATCH(
      makeReq(
        "/api/orders",
        "PATCH",
        {
          id: "ord-no-earn-1",
          status: "CANCELLED",
          paymentStatus: "REFUNDED",
          refundReason: "Batal cepat",
          supervisorPin: VALID_PIN,
        },
        CASHIER_COOKIE,
        { "x-require-supervisor-pin": "1" }
      )
    );
    expect(refundNoEarnRes.status).toBe(200);

    const membersAfter = await getPersistentLoyaltyMembers();
    const updatedCombo = membersAfter.find((m) => m.id === "mem-v34-combo")!;
    expect(updatedCombo.points).toBe(500);
    const revRedeemTx = updatedCombo.pointHistory.find((ptx) => ptx.id === "rev-redeem-ord-combo-1");
    const revEarnTx = updatedCombo.pointHistory.find((ptx) => ptx.id === "rev-ord-combo-1");
    expect(revRedeemTx?.points).toBe(100);
    expect(revEarnTx?.points).toBe(-50);

    const updatedNoEarn = membersAfter.find((m) => m.id === "mem-v34-no-earn")!;
    expect(updatedNoEarn.points).toBe(200);
  });

  it("9. Enforces API VOID PIN gate (403 -> 200 + VOID_ORDER audit) and filters cross-day refunds by event WITA timestamp", async () => {
    const subtotal = KS_PRODUCT.basePrice;
    const tax = Math.round(subtotal * 0.1);
    const total = subtotal + tax;

    const createUnpaidRes = await ordersRoute.POST(
      makeReq(
        "/api/orders",
        "POST",
        {
          order: {
            id: "ord-void-gate-1",
            orderNumber: "ORD-KS-20261124-0301",
            outletId: "outlet-sgr",
            outletName: "Singaraja",
            tableNumber: "T-11",
            customerName: "Nyoman Void",
            orderType: "DINE_IN",
            status: "NEW",
            paymentStatus: "PENDING",
            subtotal,
            tax,
            serviceCharge: 0,
            total,
            targetServiceMinutes: 15,
            createdAt: "2026-11-24T13:00:00.000Z",
            items: [
              {
                id: "it-vg-1",
                productId: KS_PRODUCT.id,
                tenantId: KS_PRODUCT.tenantId,
                productName: KS_PRODUCT.name,
                quantity: 1,
                unitPrice: subtotal,
              },
            ],
            statusHistory: [],
          },
        },
        CASHIER_COOKIE
      )
    );
    expect(createUnpaidRes.status).toBe(200);

    const voidWithoutPinRes = await ordersRoute.PATCH(
      makeReq(
        "/api/orders",
        "PATCH",
        {
          id: "ord-void-gate-1",
          status: "CANCELLED",
          voidReason: "Tamu pindah ke outlet lain",
        },
        CASHIER_COOKIE
      )
    );
    expect(voidWithoutPinRes.status).toBe(403);
    const noPinBody = await voidWithoutPinRes.json();
    expect(noPinBody.error).toContain("SUPERVISOR_PIN_REQUIRED");

    const voidWithPinRes = await ordersRoute.PATCH(
      makeReq(
        "/api/orders",
        "PATCH",
        {
          id: "ord-void-gate-1",
          status: "CANCELLED",
          voidReason: "Tamu pindah ke outlet lain",
          supervisorPin: VALID_PIN,
        },
        CASHIER_COOKIE
      )
    );
    expect(voidWithPinRes.status).toBe(200);
    const voidedBody = await voidWithPinRes.json();
    expect(voidedBody.order.status).toBe("CANCELLED");
    expect(voidedBody.order.paymentStatus).toBe("PENDING");
    expect(voidedBody.order.supervisorPinVerified).toBe(true);

    const auditLogs = await getAuditLogs();
    const voidAudit = auditLogs.find(
      (l) => l.action === "VOID_ORDER" && l.referenceId === "ord-void-gate-1"
    );
    expect(voidAudit).toBeDefined();
    expect(voidAudit?.reason).toBe("Tamu pindah ke outlet lain");

    const crossDayRefundedOrder: OrderRecord = {
      id: "ord-cross-day-1",
      orderNumber: "ORD-KS-20261120-0042",
      organizationId: "org-dago-hub",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "T-03",
      customerName: "Tamu Lintas Hari",
      orderType: "DINE_IN",
      status: "CANCELLED",
      paymentStatus: "REFUNDED",
      paymentMethod: "CASH",
      refundMethod: "CASH",
      refundReason: "Pengembalian klaim kualitas hari ke-4",
      refundApprovedBy: "Manager Bli",
      refundedAt: "2026-11-24T03:30:00.000Z",
      discount: 5000,
      discountSource: "MANUAL",
      manualDiscountReason: "Diskon awal",
      subtotal: 45000,
      tax: 4000,
      serviceCharge: 0,
      total: 44000,
      targetServiceMinutes: 15,
      createdAt: "2026-11-20T04:00:00.000Z",
      confirmedAt: "2026-11-20T04:01:00.000Z",
      items: [
        {
          id: "it-cd-1",
          productId: KS_PRODUCT.id,
          tenantId: KS_PRODUCT.tenantId,
          productName: KS_PRODUCT.name,
          quantity: 1,
          unitPrice: 45000,
        },
      ],
      statusHistory: [],
    };

    const isNov20 = (iso: string) => toWitaDateKey(iso) === "2026-11-20";
    const isNov24 = (iso: string) => toWitaDateKey(iso) === "2026-11-24";

    expect(
      countVoidRefundDiscountEntries({
        orders: [crossDayRefundedOrder],
        isTimestampInRange: isNov20,
      })
    ).toBe(0);
    const nov20Report = buildReportData({
      type: "VOID_REFUND_DISCOUNT",
      scopeName: "Singaraja",
      orders: [crossDayRefundedOrder],
      isTimestampInRange: isNov20,
    });
    expect(nov20Report.tableRows).toHaveLength(0);
    expect(nov20Report.summaryCards[0].value).toBe("Rp 0");

    expect(
      countVoidRefundDiscountEntries({
        orders: [crossDayRefundedOrder],
        isTimestampInRange: isNov24,
      })
    ).toBe(1);
    const nov24Report = buildReportData({
      type: "VOID_REFUND_DISCOUNT",
      scopeName: "Singaraja",
      orders: [crossDayRefundedOrder],
      isTimestampInRange: isNov24,
    });
    expect(nov24Report.tableRows).toHaveLength(1);
    expect(nov24Report.tableRows[0][0]).toBe("ORD-KS-20261120-0042");
    expect(nov24Report.tableRows[0][2]).toBe("Refund");
    expect(nov24Report.summaryCards[0].value).toBe("Rp 44.000");
  });
});
