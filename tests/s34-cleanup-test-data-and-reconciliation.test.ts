import { describe, it, expect } from "vitest";
import {
  transformShifts,
  transformOrders,
  transformEvents,
  transformBookings,
  S34_TARGETS,
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

  it("3. Event uji dan usulan bagi hasil pending dibersihkan dengan status legal REJECTED", () => {
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
      },
    ];

    const { items, count } = transformEvents(mockEvents);
    expect(count).toBe(1);

    const testEvt = items.find((e) => e.id === "evt-pilates-gift-voucher");
    expect(testEvt?.status).toBe("ARCHIVED");
    // Status usulan adalah REJECTED (legal enum)
    expect(testEvt?.proposedRevenueSplit?.status).toBe("REJECTED");

    // Event riil tidak diarsipkan
    const realEvt = items.find((e) => e.id === "evt-real-community");
    expect(realEvt?.status).toBe("APPROVED");
  });

  it("4. Tiket uji target dibatalkan dengan tepat", () => {
    const mockBookings: EventTicketOrder[] = [
      {
        id: "bkg-1",
        ticketCode: "DAGO-EVT-14704",
        paymentStatus: "PAID",
      } as EventTicketOrder,
      {
        id: "bkg-2",
        ticketCode: "DAGO-EVT-VALID-999",
        paymentStatus: "PAID",
      } as EventTicketOrder,
    ];

    const { items, count } = transformBookings(mockBookings);
    expect(count).toBe(1);
    expect(items.find((b) => b.ticketCode === "DAGO-EVT-14704")?.paymentStatus).toBe("CANCELLED");
    expect(items.find((b) => b.ticketCode === "DAGO-EVT-VALID-999")?.paymentStatus).toBe("PAID");
  });

  it("5. Target daftar shift dan tiket S-34 terkonfigurasi lengkap", () => {
    expect(S34_TARGETS.testTicketCodes.has("DAGO-EVT-14704")).toBe(true);
    expect(S34_TARGETS.testTicketCodes.has("DAGO-EVT-91979")).toBe(true);
    expect(S34_TARGETS.testTicketCodes.has("DAGO-EVT-13394")).toBe(true);
    expect(S34_TARGETS.shiftIds.has("shf-1795155251970-qdso")).toBe(true);
  });
});
