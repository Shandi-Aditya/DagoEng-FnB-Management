import fs from "fs";
import os from "os";
import path from "path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  transformShifts,
  transformOrders,
  transformEvents,
  transformBookings,
  runCleanup,
  S34_TARGETS,
  prisma as s34Prisma,
  type CleanupStore,
} from "../scripts/reconcile-and-cleanup-s34";
import type { ShiftRecord } from "@/types/shift";
import type { OrderRecord } from "@/types/order";
import type { CommunityEvent, EventTicketOrder } from "@/types/event";

describe("TASK S-34 — Clean Test Data and Shift Reconciliation (Behavioral Unit Tests)", () => {
  it("1. Rekonsiliasi menutup shift berstatus NEEDS_RECONCILIATION dan target ID lama secara akuntansi sah", () => {
    const mockShifts: ShiftRecord[] = [
      {
        id: "shf-1795155251970-qdso",
        shiftName: "Shift Pagi",
        outletId: "out-1",
        outletName: "Outlet 1",
        assignedCashierId: "usr-1",
        assignedCashierName: "Budi",
        startTime: "2026-03-01T08:00:00.000Z",
        status: "ACTIVE",
        openingCash: 100000,
        cashSales: 89700,
        nonCashSales: 50000,
        refundAmount: 0,
        expectedCash: 189700,
        actualCash: 100000,
        cashVariance: -89700,
      },
      {
        id: "shf-active-normal",
        shiftName: "Shift Normal",
        outletId: "out-1",
        outletName: "Outlet 1",
        assignedCashierId: "usr-2",
        assignedCashierName: "Siti",
        startTime: "2026-03-20T08:00:00.000Z",
        status: "ACTIVE",
        openingCash: 50000,
        cashSales: 0,
        nonCashSales: 0,
        refundAmount: 0,
        expectedCash: 50000,
        actualCash: 50000,
        cashVariance: 0,
      },
      {
        id: "shf-needs-reconcile-legacy",
        shiftName: "Shift Gantung",
        outletId: "out-1",
        outletName: "Outlet 1",
        assignedCashierId: "usr-3",
        assignedCashierName: "Asep",
        startTime: "2026-03-15T08:00:00.000Z",
        status: "NEEDS_RECONCILIATION",
        openingCash: 100000,
        cashSales: 26400,
        nonCashSales: 0,
        refundAmount: 0,
        expectedCash: 126400,
        actualCash: 100000,
        cashVariance: -26400,
      },
    ];

    const { items, count } = transformShifts(mockShifts);
    expect(count).toBe(2);

    const targetShift = items.find((s) => s.id === "shf-1795155251970-qdso");
    expect(targetShift?.status).toBe("CLOSED");
    expect(targetShift?.actualCash).toBe(189700);
    expect(targetShift?.cashVariance).toBe(0);
    expect(targetShift?.closedBy).toBe("SYSTEM_RECONCILIATION_S34");

    const needsReconcileShift = items.find((s) => s.id === "shf-needs-reconcile-legacy");
    expect(needsReconcileShift?.status).toBe("CLOSED");
    expect(needsReconcileShift?.actualCash).toBe(126400);
    expect(needsReconcileShift?.cashVariance).toBe(0);

    // Pastikan shift aktif normal TIDAK ikut tertutup
    const normalShift = items.find((s) => s.id === "shf-active-normal");
    expect(normalShift?.status).toBe("ACTIVE");
  });

  it("2. Pesanan uji aktif KDS diselesaikan tanpa menyentuh pesanan nyata pelanggan", () => {
    const mockOrders: OrderRecord[] = [
      {
        id: "ord-test-1",
        orderNumber: "ORD-TEST-001",
        organizationId: "org-1",
        outletId: "out-1",
        outletName: "Dago Kitchen",
        tableNumber: "T-01",
        customerName: "Customer Test QA",
        orderType: "DINE_IN",
        status: "COOKING",
        items: [],
        subtotal: 10000,
        tax: 1000,
        total: 11000,
        paymentStatus: "PAID",
        targetServiceMinutes: 15,
        statusHistory: [],
        createdAt: "2026-11-20T08:00:00.000Z",
      },
      {
        id: "ord-real-1",
        orderNumber: "ORD-REAL-001",
        organizationId: "org-1",
        outletId: "out-1",
        outletName: "Dago Kitchen",
        tableNumber: "T-02",
        customerName: "Ahmad Riil",
        orderType: "DINE_IN",
        status: "COOKING",
        items: [],
        subtotal: 25000,
        tax: 2500,
        total: 27500,
        paymentStatus: "PAID",
        targetServiceMinutes: 15,
        statusHistory: [],
        createdAt: "2026-11-20T08:00:00.000Z",
      },
    ];

    const { items, count } = transformOrders(mockOrders);
    expect(count).toBe(1);

    const testOrd = items.find((o) => o.id === "ord-test-1");
    expect(testOrd?.status).toBe("COMPLETED");
    expect(testOrd?.statusHistory?.length).toBe(1);
    expect(testOrd?.statusHistory?.[0].actorName).toBe("SYSTEM_RECONCILIATION_S34");

    // Lindungi pesanan pelanggan riil
    const realOrd = items.find((o) => o.id === "ord-real-1");
    expect(realOrd?.status).toBe("COOKING");
  });

  it("3. Event uji dan usulan bagi hasil pending dibersihkan dengan status legal REJECTED, sementara event riil tetap PENDING", () => {
    const mockEvents: CommunityEvent[] = [
      {
        id: "evt-pilates-gift-voucher",
        title: "Gift Voucher Tes 1",
        status: "APPROVED",
        category: "COMMUNITY",
        description: "Test description",
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        location: "Dago Hub",
        isPaid: false,
        price: 0,
        posterUrl: "",
        organizerName: "Tester",
        organizerEmail: "test@example.com",
        organizerPhone: "08123456789",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        proposedRevenueSplit: {
          organizerPercent: 80,
          platformPercent: 20,
          proposedBy: "ORGANIZER",
          status: "PENDING",
        },
      },
      {
        id: "evt-real-community",
        title: "Bandung Coffee Festival 2026",
        status: "APPROVED",
        category: "COMMUNITY",
        description: "Real event description",
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        location: "Dago Plaza",
        isPaid: true,
        price: 50000,
        posterUrl: "",
        organizerName: "Komunitas Kopi",
        organizerEmail: "kopi@example.com",
        organizerPhone: "08198765432",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        proposedRevenueSplit: {
          organizerPercent: 80,
          platformPercent: 20,
          proposedBy: "ORGANIZER",
          status: "PENDING",
        },
      },
    ];

    const { items, count, archivedEventIds } = transformEvents(mockEvents);
    expect(count).toBe(1);
    expect(archivedEventIds.has("evt-pilates-gift-voucher")).toBe(true);
    expect(archivedEventIds.has("evt-real-community")).toBe(false);

    const testEvt = items.find((e) => e.id === "evt-pilates-gift-voucher");
    expect(testEvt?.status).toBe("ARCHIVED");
    expect(testEvt?.isTestData).toBe(true);
    // Status usulan adalah REJECTED (legal enum)
    expect(testEvt?.proposedRevenueSplit?.status).toBe("REJECTED");

    // Event riil tidak diarsipkan dan usulan bagi hasilnya tetap PENDING
    const realEvt = items.find((e) => e.id === "evt-real-community");
    expect(realEvt?.status).toBe("APPROVED");
    expect(realEvt?.isTestData).toBeUndefined();
    expect(realEvt?.proposedRevenueSplit?.status).toBe("PENDING");
  });

  it("4. Tiket uji target dan tiket pada event yang diarsipkan dibatalkan dengan tepat", () => {
    const mockBookings: EventTicketOrder[] = [
      {
        id: "bkg-1",
        ticketCode: "DAGO-EVT-14704",
        paymentStatus: "PAID",
      } as unknown as EventTicketOrder,
      {
        id: "bkg-2",
        ticketCode: "DAGO-EVT-VALID-999",
        paymentStatus: "PAID",
      } as unknown as EventTicketOrder,
      {
        id: "bkg-3",
        ticketCode: "DAGO-EVT-96354",
        eventId: "evt-1793935470095-8vpsm",
        paymentStatus: "PAID",
      } as unknown as EventTicketOrder,
      {
        id: "bkg-4",
        ticketCode: "DAGO-EVT-85611",
        eventId: "evt-pilates-gift-voucher",
        paymentStatus: "PAID",
        checkInStatus: "CHECKED_IN",
      } as unknown as EventTicketOrder,
      {
        id: "bkg-5",
        ticketCode: "DAGO-EVT-REAL-123",
        eventId: "evt-real-community",
        paymentStatus: "PAID",
      } as unknown as EventTicketOrder,
    ];

    const archivedEventIds = new Set(["evt-1793935470095-8vpsm", "evt-pilates-gift-voucher"]);
    const { items, count } = transformBookings(mockBookings, archivedEventIds);
    expect(count).toBe(3);
    expect(items.find((b) => b.ticketCode === "DAGO-EVT-14704")?.paymentStatus).toBe("CANCELLED");
    expect(items.find((b) => b.ticketCode === "DAGO-EVT-96354")?.paymentStatus).toBe("CANCELLED");
    expect(items.find((b) => b.ticketCode === "DAGO-EVT-85611")?.paymentStatus).toBe("CANCELLED");
    expect(items.find((b) => b.ticketCode === "DAGO-EVT-VALID-999")?.paymentStatus).toBe("PAID");
    expect(items.find((b) => b.ticketCode === "DAGO-EVT-REAL-123")?.paymentStatus).toBe("PAID");
  });

  it("5. Target daftar shift dan tiket S-34 terkonfigurasi lengkap", () => {
    expect(S34_TARGETS.testTicketCodes.has("DAGO-EVT-14704")).toBe(true);
    expect(S34_TARGETS.testTicketCodes.has("DAGO-EVT-91979")).toBe(true);
    expect(S34_TARGETS.testTicketCodes.has("DAGO-EVT-13394")).toBe(true);
    expect(S34_TARGETS.testTicketCodes.has("DAGO-EVT-96354")).toBe(true);
    expect(S34_TARGETS.testEventIds.has("evt-1793810790340-73pia")).toBe(true);
    expect(S34_TARGETS.testEventIds.has("evt-1793073538004-rekb8")).toBe(true);
    expect(S34_TARGETS.testEventIds.has("evt-1793004679533-13yqp")).toBe(true);
    expect(S34_TARGETS.testEventIds.has("evt-1793073371363-zli0p")).toBe(true);
    expect(S34_TARGETS.testEventIds.has("evt-1793083665642-lv4kl")).toBe(true);
    expect(S34_TARGETS.shiftIds.has("shf-1795155251970-qdso")).toBe(true);
  });

  it("5b. Event uji tambahan dan tiket PAID-nya dibersihkan dan dibatalkan oleh transformEvents + transformBookings", () => {
    const extraEvents: CommunityEvent[] = [
      "evt-1793073538004-rekb8",
      "evt-1793004679533-13yqp",
      "evt-1793073371363-zli0p",
      "evt-1793083665642-lv4kl",
    ].map((id, idx) => ({
      id,
      title: `Event Uji Tambahan ${idx + 1}`,
      status: "APPROVED",
      category: "COMMUNITY",
      description: "Test event",
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      location: "Dago Hub",
      isPaid: true,
      price: 50000,
      posterUrl: "",
      organizerName: "Tester",
      organizerEmail: "test@example.com",
      organizerPhone: "08123456789",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const eventsResult = transformEvents(extraEvents);
    expect(eventsResult.count).toBe(4);
    for (const evt of eventsResult.items) {
      expect(evt.status).toBe("ARCHIVED");
      expect(evt.isTestData).toBe(true);
    }

    const extraTickets: EventTicketOrder[] = [
      {
        id: "tkt-1",
        ticketCode: "DAGO-EVT-90259",
        eventId: "evt-1793073538004-rekb8",
        paymentStatus: "PAID",
      } as unknown as EventTicketOrder,
      {
        id: "tkt-2",
        ticketCode: "DAGO-EVT-74893",
        eventId: "evt-1793004679533-13yqp",
        paymentStatus: "PAID",
      } as unknown as EventTicketOrder,
      {
        id: "tkt-3",
        ticketCode: "DAGO-EVT-73052",
        eventId: "evt-1793073371363-zli0p",
        paymentStatus: "PAID",
      } as unknown as EventTicketOrder,
    ];

    const bookingsResult = transformBookings(extraTickets, eventsResult.archivedEventIds);
    expect(bookingsResult.count).toBe(3);
    expect(bookingsResult.items.every((b) => b.paymentStatus === "CANCELLED")).toBe(true);
  });

  it("6. runCleanup mode simulasi default (dry-run) mengembalikan dryRun true tanpa penulisan", async () => {
    const res = await runCleanup({ apply: false });
    expect(res.dryRun).toBe(true);
    expect(typeof res.shiftsCount).toBe("number");
    expect(typeof res.ordersCount).toBe("number");
    expect(typeof res.eventsCount).toBe("number");
    expect(typeof res.bookingsCount).toBe("number");
  });

  describe("7. S-34 DB Failure & Apply Safety Guards", () => {
    let tempDir = "";
    let prevDataDirOverride: string | undefined;
    let prevDatabaseUrl: string | undefined;
    let prevExitCode: typeof process.exitCode;

    beforeEach(() => {
      prevDataDirOverride = process.env.DATA_DIR_OVERRIDE;
      prevDatabaseUrl = process.env.DATABASE_URL;
      prevExitCode = process.exitCode;
      process.exitCode = undefined;
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "s34-safety-"));
      process.env.DATA_DIR_OVERRIDE = tempDir;
    });

    afterEach(() => {
      process.exitCode = prevExitCode;
      if (prevDataDirOverride === undefined) delete process.env.DATA_DIR_OVERRIDE;
      else process.env.DATA_DIR_OVERRIDE = prevDataDirOverride;

      if (prevDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prevDatabaseUrl;

      vi.restoreAllMocks();
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("rejects with process.exitCode = 1 and writes nothing to disk when DB read fails", async () => {
      const eventsPath = path.join(tempDir, "events.json");
      const initialEventsPayload = JSON.stringify([
        {
          id: "evt-pilates-gift-voucher",
          title: "Gift Voucher Tes 1",
          status: "APPROVED",
        },
      ]);
      fs.writeFileSync(eventsPath, initialEventsPayload, "utf8");

      process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:59999/testdb";
      vi.spyOn(s34Prisma.systemSetting, "findUnique").mockRejectedValue(
        new Error("DB connection refused")
      );
      const txSpy = vi.spyOn(s34Prisma, "$transaction");

      await expect(runCleanup({ apply: true })).rejects.toThrow("DB connection refused");
      expect(process.exitCode).toBe(1);
      expect(txSpy).not.toHaveBeenCalled();

      expect(fs.existsSync(path.join(tempDir, "shifts.json"))).toBe(false);
      expect(fs.existsSync(path.join(tempDir, "pos_orders.json"))).toBe(false);
      expect(fs.existsSync(path.join(tempDir, "event_bookings.json"))).toBe(false);
      expect(fs.readFileSync(eventsPath, "utf8")).toBe(initialEventsPayload);
    });

    it("never upserts missing/unreadable/unchanged DB keys and never creates empty shifts/pos_orders files on disk", async () => {
      process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:59999/testdb";
      const upsertedKeys: string[] = [];
      const mockStore: CleanupStore = {
        findSetting: async (key) => {
          if (key === "STORAGE_shifts.json") return null;
          if (key === "STORAGE_pos_orders.json") {
            return { value: "{corrupt-json" };
          }
          if (key === "STORAGE_events.json") {
            return {
              value: JSON.stringify([
                {
                  id: "evt-1793073538004-rekb8",
                  title: "Test Event",
                  status: "APPROVED",
                  category: "COMMUNITY",
                  description: "",
                  startDate: "2026-12-01T00:00:00.000Z",
                  endDate: "2026-12-01T00:00:00.000Z",
                  location: "Dago",
                  isPaid: false,
                  price: 0,
                  posterUrl: "",
                  organizerName: "Tester",
                  organizerEmail: "t@example.com",
                  organizerPhone: "08123",
                  createdAt: "2026-11-01T00:00:00.000Z",
                  updatedAt: "2026-11-01T00:00:00.000Z",
                },
              ]),
            };
          }
          if (key === "STORAGE_event_bookings.json") {
            return {
              value: JSON.stringify([
                {
                  id: "bkg-real",
                  ticketCode: "DAGO-EVT-REAL-1",
                  eventId: "evt-real",
                  paymentStatus: "PAID",
                },
              ]),
            };
          }
          return null;
        },
        upsertSettings: async (entries) => {
          for (const entry of entries) {
            upsertedKeys.push(entry.key);
          }
        },
      };

      const res = await runCleanup({ apply: true, store: mockStore });
      expect(res.dryRun).toBe(false);
      expect(res.eventsCount).toBe(1);
      expect(res.bookingsCount).toBe(0);
      expect(upsertedKeys).toEqual(["STORAGE_events.json"]);
      expect(fs.existsSync(path.join(tempDir, "shifts.json"))).toBe(false);
      expect(fs.existsSync(path.join(tempDir, "pos_orders.json"))).toBe(false);
      expect(fs.existsSync(path.join(tempDir, "event_bookings.json"))).toBe(false);
      expect(fs.existsSync(path.join(tempDir, "events.json"))).toBe(true);
    });
  });
});
