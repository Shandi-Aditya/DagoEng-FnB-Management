import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PATCH as patchOrdersRoute, POST as postOrdersRoute } from "@/app/api/orders/route";
import { GET as syncGet, POST as syncPost } from "@/app/api/sync/[domain]/route";
import { buildReportData } from "@/features/reports/reports-domain";
import { getPersistentOrders } from "@/lib/persistent-storage";
import { buildTransactionTemplateWorkbook } from "@/lib/transaction-export-template";
import type { OrderRecord, OrderStatus } from "@/types/order";

const CASHIER_COOKIE = "dagoeng_active_persona=CASHIER_SGR";
const KITCHEN_COOKIE = "dagoeng_active_persona=KITCHEN_SGR";
const OWNER_COOKIE = "dagoeng_active_persona=DAGO_OWNER";
const TENANT_OWNER_COOKIE = "dagoeng_active_persona=TENANT_OWNER_KS";

function makeMixedOtsOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: "ord-v33-int-1",
    orderNumber: "INV-DAGO-20261123-0101",
    organizationId: "org-dago",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    tableNumber: "HD-01",
    customerName: "Budi Santoso",
    orderType: "DINE_IN",
    status: "CONFIRMED",
    paymentStatus: "PAID",
    paymentMethod: "CASH",
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
    items: [
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
        category: "Minuman",
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
        category: "Minuman",
      },
    ],
    ...overrides,
  };
}

function makeOrderRequest(
  method: "POST" | "PATCH",
  body: unknown,
  cookie: string
): NextRequest {
  return new NextRequest("http://localhost:3000/api/orders", {
    method,
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify(body),
  });
}

function makeSyncRequest(
  domain: string,
  options: { method?: "GET" | "POST"; body?: unknown; cookie?: string } = {}
): [NextRequest, { params: Promise<{ domain: string }> }] {
  const headers: Record<string, string> = {};
  if (options.cookie) headers.cookie = options.cookie;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const req = new NextRequest(`http://localhost:3000/api/sync/${domain}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  return [req, { params: Promise.resolve({ domain }) }];
}

function readWorkspaceFile(relPath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), "utf-8");
}

describe("V-33 Wave 2B: Settings Struk Gabung/Pisah, Receipt, Reports, Excel & API Integration", () => {
  let tempDir = "";
  let prevDataDirOverride: string | undefined;
  let prevDisableDemoLogin: string | undefined;

  beforeEach(() => {
    prevDataDirOverride = process.env.DATA_DIR_OVERRIDE;
    prevDisableDemoLogin = process.env.DISABLE_DEMO_LOGIN;
    delete process.env.DISABLE_DEMO_LOGIN;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "v33-wave2b-"));
    process.env.DATA_DIR_OVERRIDE = tempDir;
  });

  afterEach(() => {
    if (prevDataDirOverride === undefined) delete process.env.DATA_DIR_OVERRIDE;
    else process.env.DATA_DIR_OVERRIDE = prevDataDirOverride;

    if (prevDisableDemoLogin === undefined) delete process.env.DISABLE_DEMO_LOGIN;
    else process.env.DISABLE_DEMO_LOGIN = prevDisableDemoLogin;

    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("1. /api/orders mixed OTS order & KDS PATCH progression", () => {
    it("stores mixed coworking + F&B order cleanly and advances F&B tenant KDS stages without DAGO_HUB blocking aggregate status", async () => {
      const mixedOrder = makeMixedOtsOrder();
      const postRes = await postOrdersRoute(
        makeOrderRequest("POST", { order: mixedOrder }, CASHIER_COOKIE)
      );
      expect(postRes.status).toBe(200);
      const postJson = await postRes.json();
      expect(postJson.success).toBe(true);
      expect(postJson.order.items).toHaveLength(3);
      expect(postJson.order.tax).toBe(5000);
      expect(postJson.order.serviceCharge).toBe(2500);
      expect(postJson.order.total).toBe(132500);

      const stored = (await getPersistentOrders()).find((o) => o.id === mixedOrder.id);
      expect(stored?.items.some((i) => i.itemType === "COWORKING" && i.tenantId === "DAGO_HUB")).toBe(true);
      expect(stored?.items.filter((i) => i.tenantId === "tenant-ks")).toHaveLength(2);

      const stages: OrderStatus[] = [
        "KITCHEN_RECEIVED",
        "COOKING",
        "READY",
        "SERVED",
        "COMPLETED",
      ];
      for (const stage of stages) {
        const patchRes = await patchOrdersRoute(
          makeOrderRequest(
            "PATCH",
            {
              order: {
                id: mixedOrder.id,
                status: stage,
                tenantStatuses: { "tenant-ks": stage },
              },
            },
            KITCHEN_COOKIE
          )
        );
        expect(patchRes.status).toBe(200);
        const patchJson = await patchRes.json();
        expect(patchJson.order.tenantStatuses?.["tenant-ks"]).toBe(stage);
        expect(patchJson.order.status).toBe(stage);
      }
    });
  });

  describe("2. /api/sync/platform-settings receiptCombineMode persistence & RBAC", () => {
    it("round-trips SEPARATE -> COMBINED for OWNER and rejects non-owner PATCH_SETTINGS with 403", async () => {
      const [deniedCashierReq, deniedCashierCtx] = makeSyncRequest("platform-settings", {
        method: "POST",
        cookie: CASHIER_COOKIE,
        body: { command: { op: "PATCH_SETTINGS", patch: { receiptCombineMode: "SEPARATE" } } },
      });
      const deniedCashierRes = await syncPost(deniedCashierReq, deniedCashierCtx);
      expect(deniedCashierRes.status).toBe(403);

      const [deniedTenantReq, deniedTenantCtx] = makeSyncRequest("platform-settings", {
        method: "POST",
        cookie: TENANT_OWNER_COOKIE,
        body: { command: { op: "PATCH_SETTINGS", patch: { receiptCombineMode: "SEPARATE" } } },
      });
      const deniedTenantRes = await syncPost(deniedTenantReq, deniedTenantCtx);
      expect(deniedTenantRes.status).toBe(403);

      const [sepReq, sepCtx] = makeSyncRequest("platform-settings", {
        method: "POST",
        cookie: OWNER_COOKIE,
        body: { command: { op: "PATCH_SETTINGS", patch: { receiptCombineMode: "SEPARATE" } } },
      });
      const sepRes = await syncPost(sepReq, sepCtx);
      expect(sepRes.status).toBe(200);
      const sepJson = await sepRes.json();
      expect(sepJson.state.receiptCombineMode).toBe("SEPARATE");

      const [getSepReq, getSepCtx] = makeSyncRequest("platform-settings", { cookie: CASHIER_COOKIE });
      const getSepRes = await syncGet(getSepReq, getSepCtx);
      expect(getSepRes.status).toBe(200);
      expect((await getSepRes.json()).state.receiptCombineMode).toBe("SEPARATE");

      const [combReq, combCtx] = makeSyncRequest("platform-settings", {
        method: "POST",
        cookie: OWNER_COOKIE,
        body: { command: { op: "PATCH_SETTINGS", patch: { receiptCombineMode: "COMBINED" } } },
      });
      const combRes = await syncPost(combReq, combCtx);
      expect(combRes.status).toBe(200);
      expect((await combRes.json()).state.receiptCombineMode).toBe("COMBINED");
    });
  });

  describe("3. Reports & Excel Export on mixed order (1 Hot Desk + 2 F&B)", () => {
    it("produces accurate SALES and SETTLEMENT reports with DAGO_HUB 100% and F&B 85/15 split", () => {
      const mixedOrder = makeMixedOtsOrder();

      const salesAll = buildReportData({
        type: "SALES",
        scopeName: "Outlet Singaraja",
        orders: [mixedOrder],
      });
      expect(salesAll.summaryCards[0].value).toBe("Rp 132.500");
      expect(salesAll.summaryCards[4].value).toBe("Rp 5.000");
      expect(salesAll.summaryCards[5].value).toBe("Rp 2.500");
      expect(String(salesAll.tableRows[0][2])).toContain("Dago Creative Hub (Co-Working)");
      expect(String(salesAll.tableRows[0][2])).toContain("Kopi Senja");
      expect(salesAll.reconciliationInfo?.find((r) => r.label === "Co-working POS (0% PB1)")?.value).toBe(
        "Rp 75.000"
      );

      const salesKs = buildReportData({
        type: "SALES",
        scopeName: "Kopi Senja",
        orders: [mixedOrder],
        tenantId: "tenant-ks",
      });
      expect(salesKs.summaryCards[0].value).toBe("Rp 57.500");
      expect(salesKs.summaryCards[4].value).toBe("Rp 5.000");
      expect(salesKs.summaryCards[5].value).toBe("Rp 2.500");

      const settlement = buildReportData({
        type: "SETTLEMENT",
        scopeName: "Outlet Singaraja",
        orders: [mixedOrder],
      });
      expect(settlement.tableRows).toHaveLength(2);

      const dagoRow = settlement.tableRows.find((r) => r[0] === "DAGO_HUB");
      const ksRow = settlement.tableRows.find((r) => r[0] === "tenant-ks");
      expect(dagoRow).toBeDefined();
      expect(dagoRow?.[2]).toBe("Rekening pusat DAGO");
      expect(dagoRow?.[3]).toBe("100% DAGO");
      expect(dagoRow?.[5]).toBe("Rp 75.000");
      expect(dagoRow?.[6]).toBe("Rp 0");
      expect(dagoRow?.[7]).toBe("Rp 75.000");
      expect(dagoRow?.[8]).toBe("Rp 75.000");

      expect(ksRow).toBeDefined();
      expect(ksRow?.[3]).toBe("85% Mitra / 15% DAGO");
      expect(ksRow?.[5]).toBe("Rp 50.000");
      expect(ksRow?.[6]).toBe("Rp 42.500");
      expect(ksRow?.[7]).toBe("Rp 7.500");
      expect(ksRow?.[8]).toBe("Rp 50.000");
    });

    it("allocates 0 PB1 and 0 service charge to Hot Desk and 5000 PB1 + 2500 service only to F&B in Excel export", async () => {
      const mixedOrder = makeMixedOtsOrder({ paymentMethod: "CASH" });
      const wb = await buildTransactionTemplateWorkbook({
        orders: [mixedOrder],
        startDate: "2026-11-23",
        endDate: "2026-11-23",
      });

      const detailWs = wb.getWorksheet("transactionDetail");
      expect(detailWs).toBeDefined();

      // Rows 5, 6, 7 correspond to Hot Desk (75k), Kopi Senja Aren (24k), Matcha Oat Latte (26k)
      const hotDeskRow = detailWs?.getRow(5);
      const ksRow1 = detailWs?.getRow(6);
      const ksRow2 = detailWs?.getRow(7);

      expect(hotDeskRow?.getCell(2).value).toBe("Dago Creative Hub");
      expect(hotDeskRow?.getCell(3).value).toBe("Co-Working");
      expect(hotDeskRow?.getCell(4).value).toBe("Hot Desk Flex (3 Jam)");
      expect(hotDeskRow?.getCell(7).value).toBe(""); // 0 tax
      expect(hotDeskRow?.getCell(9).value).toBe(75000);
      expect(hotDeskRow?.getCell(10).value).toBe(75000);
      expect(hotDeskRow?.getCell(14).value).toBe(0); // Share Tenant = 0
      expect(hotDeskRow?.getCell(15).value).toBe(75000); // Share Dago = 75000

      expect(ksRow1?.getCell(2).value).toBe("Kopi Senja");
      expect(ksRow1?.getCell(7).value).toBe(2400);
      expect(ksRow1?.getCell(10).value).toBe(27600); // 24000 + 2400 PB1 + 1200 service
      expect(ksRow2?.getCell(2).value).toBe("Kopi Senja");
      expect(ksRow2?.getCell(7).value).toBe(2600);
      expect(ksRow2?.getCell(10).value).toBe(29900); // 26000 + 2600 PB1 + 1300 service

      const sharesWs = wb.getWorksheet("tenantShares");
      expect(sharesWs).toBeDefined();

      const shareRows: Array<Array<unknown>> = [];
      sharesWs?.eachRow((row, rowNum) => {
        if (rowNum >= 5) {
          shareRows.push([
            row.getCell(1).value,
            row.getCell(2).value,
            row.getCell(4).value,
            row.getCell(5).value,
            row.getCell(8).value,
            row.getCell(9).value,
          ]);
        }
      });

      const dagoShare = shareRows.find((r) => r[0] === "Dago Creative Hub");
      const ksShare = shareRows.find((r) => r[0] === "Kopi Senja");
      const grandtotalRow = shareRows.find((r) => r[0] === "Grandtotal");

      expect(dagoShare).toEqual(["Dago Creative Hub", 0, 75000, 75000, 0, 75000]);
      expect(ksShare).toEqual(["Kopi Senja", 5000, 50000, 57500, 42500, 7500]);
      expect(grandtotalRow).toEqual(["Grandtotal", 5000, 125000, 132500, 42500, 82500]);
    });
  });

  describe("4. UI & Context contracts for Struk Gabung / Pisah", () => {
    it("wires receiptCombineMode across settings page, PlatformConfigTab, PrinterSettingsTab, PrinterContext, and ReceiptModal", () => {
      const settingsPageSrc = readWorkspaceFile("src/app/(dashboard)/settings/page.tsx");
      expect(settingsPageSrc).toContain("receiptCombineMode");
      expect(settingsPageSrc).toContain("updatePrinterSettings({ receiptCombineMode })");

      const platformTabSrc = readWorkspaceFile("src/features/settings/PlatformConfigTab.tsx");
      expect(platformTabSrc).toContain("Mode struk co-working dan F&B (gabung / pisah)");
      expect(platformTabSrc).toContain("Gabung (1 struk: Dago & mitra)");
      expect(platformTabSrc).toContain("Pisah (struk co-working & F&B terpisah)");

      const printerTabSrc = readWorkspaceFile("src/features/settings/PrinterSettingsTab.tsx");
      expect(printerTabSrc).toContain("Mode struk co-working dan F&B (gabung / pisah)");
      expect(printerTabSrc).toContain("Gabung (1 struk: Dago & mitra)");
      expect(printerTabSrc).toContain("Pisah (struk co-working & F&B terpisah)");

      const printerCtxSrc = readWorkspaceFile("src/contexts/PrinterContext.tsx");
      expect(printerCtxSrc).toContain("splitCustomerReceiptByMode");
      expect(printerCtxSrc).toContain("receiptCombineMode?: OutletReceiptCombineMode");

      const receiptModalSrc = readWorkspaceFile("src/features/pos/ReceiptModal.tsx");
      expect(receiptModalSrc).toContain("splitCustomerReceiptByMode");
      expect(receiptModalSrc).toContain("effectiveCombineMode");
      expect(receiptModalSrc).toContain("Cetak (${splitReceipts.length} struk)");
      expect(receiptModalSrc).toContain("receiptCombineMode: effectiveCombineMode");
    });
  });
});
