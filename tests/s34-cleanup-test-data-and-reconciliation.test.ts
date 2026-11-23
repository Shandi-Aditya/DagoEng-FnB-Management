import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import type { ShiftRecord } from "@/types/shift";
import type { POSOrder } from "@/types/pos";
import type { CommunityEvent, EventTicketOrder } from "@/types/event";

describe("TASK S-34 — Clean Test Data and Old Shift Reconciliation", () => {
  it("1. Seluruh 7 shift lama berstatus Perlu Rekonsiliasi telah ditutup dan direkonsiliasi", () => {
    const shiftsPath = path.join(process.cwd(), "data", "shifts.json");
    expect(fs.existsSync(shiftsPath)).toBe(true);

    const shifts: ShiftRecord[] = JSON.parse(fs.readFileSync(shiftsPath, "utf8"));
    const needsReconciliation = shifts.filter((s) => s.status === "NEEDS_RECONCILIATION");
    expect(needsReconciliation.length).toBe(0);

    const overdueTargetIds = [
      "shf-1795155251970-qdso",
      "shf-1795057481913-qr16",
      "shf-1794808682614-2a7c",
      "shf-1794528551394-f149",
      "shf-1794510324077-u0rg",
      "shf-1794447697747-a10v",
      "shf-1794284443827-jcgg",
    ];

    overdueTargetIds.forEach((id) => {
      const shift = shifts.find((s) => s.id === id);
      expect(shift).toBeDefined();
      expect(shift?.status).toBe("CLOSED");
      expect(shift?.cashVariance).toBe(0);
    });
  });

  it("2. Pesanan uji aktif di KDS telah dikosongkan (status COMPLETED)", () => {
    const ordersPath = path.join(process.cwd(), "data", "pos_orders.json");
    expect(fs.existsSync(ordersPath)).toBe(true);

    const orders: POSOrder[] = JSON.parse(fs.readFileSync(ordersPath, "utf8"));
    const activeKdsOrders = orders.filter(
      (o) =>
        o.status === "CONFIRMED" ||
        o.status === "IN_PROGRESS" ||
        o.status === "READY" ||
        o.status === "SERVED"
    );

    expect(activeKdsOrders.length).toBe(0);
  });

  it("3. Notifikasi uji dashboard dibersihkan (0 pengajuan pending dan 0 usulan bagi hasil pending)", () => {
    const eventsPath = path.join(process.cwd(), "data", "events.json");
    expect(fs.existsSync(eventsPath)).toBe(true);

    const events: CommunityEvent[] = JSON.parse(fs.readFileSync(eventsPath, "utf8"));
    const pendingModeration = events.filter((e) => e.status === "PENDING");
    const pendingSplits = events.filter((e) => e.proposedRevenueSplit?.status === "PENDING");

    expect(pendingModeration.length).toBe(0);
    expect(pendingSplits.length).toBe(0);
  });

  it("4. Tiket dan event uji (Gift Voucher Tes 1, [TEST QA 2], DAGO-EVT-14704, 91979, 13394) dibatalkan dan diarsipkan", () => {
    const eventsPath = path.join(process.cwd(), "data", "events.json");
    const bookingsPath = path.join(process.cwd(), "data", "event_bookings.json");

    const events: CommunityEvent[] = JSON.parse(fs.readFileSync(eventsPath, "utf8"));
    const bookings: EventTicketOrder[] = JSON.parse(fs.readFileSync(bookingsPath, "utf8"));

    // Event uji berstatus ARCHIVED
    const voucherEvent = events.find((e) => e.id === "evt-pilates-gift-voucher");
    const qaEvent = events.find((e) => e.id === "evt-1793935470095-8vpsm");
    expect(voucherEvent?.status).toBe("ARCHIVED");
    expect(qaEvent?.status).toBe("ARCHIVED");

    // Tiket uji berstatus CANCELLED
    const targetCodes = ["DAGO-EVT-14704", "DAGO-EVT-91979", "DAGO-EVT-13394"];
    targetCodes.forEach((code) => {
      const b = bookings.find((t) => t.ticketCode === code);
      expect(b).toBeDefined();
      expect(b?.paymentStatus).toBe("CANCELLED");
    });
  });
});
