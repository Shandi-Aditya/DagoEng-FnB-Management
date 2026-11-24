import fs from "fs";
import path from "path";
import os from "os";
import { NextRequest } from "next/server";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  GET as coworkingBookingsGet,
  POST as coworkingBookingsPost,
} from "@/app/api/coworking/bookings/route";
import {
  checkSlotAvailability,
  isSlotPast,
} from "@/features/pos/pos-coworking";
import { slotAvailability } from "@/features/customer/space-slots";
import { checkCoworkingBookingConflict } from "@/lib/operating-hours";
import {
  CoworkingConflictError,
  getPersistentQrisSession,
  saveCoworkingBooking,
  savePersistentOrder,
  savePersistentQrisSession,
  writePersistentData,
} from "@/lib/persistent-storage";
import {
  clearOutboxForTests,
  enqueueOutboxItem,
  getOutboxItems,
  syncWithOutbox,
} from "@/lib/sync-outbox";
import type { CoworkingBooking, CoworkingSpaceItem } from "@/types/coworking";
import type { OrderRecord } from "@/types/order";

const hotDeskSpace: CoworkingSpaceItem = {
  id: "sp-hot-test",
  name: "Hot Desk Flex #01 - #08",
  type: "HOT_DESK",
  area: "Ground Floor Main",
  capacity: 8,
  hourlyRate: 15000,
  dailyRate: 65000,
  status: "AVAILABLE",
  amenities: ["WiFi", "Power Outlet"],
  description: "Hot desk komunal",
  imageUrl: "",
};

const dedicatedDeskSpace: CoworkingSpaceItem = {
  id: "sp-ded-test",
  name: "Dedicated Desk D-01",
  type: "DEDICATED_DESK",
  area: "Mezzanine Quiet Zone",
  capacity: 1,
  hourlyRate: 25000,
  dailyRate: 120000,
  status: "AVAILABLE",
  amenities: ["Ergonomic Chair", "Dual Monitor"],
  description: "Dedicated desk personal",
  imageUrl: "",
};

function createMockBooking(
  spaceId: string,
  start: string,
  end: string,
  extra: Partial<CoworkingBooking> = {}
): CoworkingBooking {
  return {
    id: `bk-${Math.random().toString(36).slice(2, 8)}`,
    bookingCode: `CWK-${Math.floor(1000 + Math.random() * 9000)}`,
    spaceId,
    spaceName: "Test Space",
    spaceType: "HOT_DESK",
    guestName: "Budi Santoso",
    guestPhone: "08123456789",
    guestEmail: extra.guestEmail ?? "budi.s35@example.com",
    date: "2026-12-01",
    bookingType: "HOURLY",
    startTime: start,
    endTime: end,
    duration: 1,
    price: 15000,
    totalAmount: 15000,
    paymentStatus: "PAID",
    checkInStatus: "CHECKED_IN",
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

describe("S-35: Coworking Quota Display and Overbooking Prevention", () => {
  let tempDir: string;
  let prevDataDirOverride: string | undefined;

  beforeEach(() => {
    prevDataDirOverride = process.env.DATA_DIR_OVERRIDE;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "s35-coworking-"));
    process.env.DATA_DIR_OVERRIDE = tempDir;
    clearOutboxForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    clearOutboxForTests();
    if (prevDataDirOverride === undefined) {
      delete process.env.DATA_DIR_OVERRIDE;
    } else {
      process.env.DATA_DIR_OVERRIDE = prevDataDirOverride;
    }
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });
  describe("1. Remaining Seats Calculation", () => {
    it("displays correct remaining seats for Hot Desk (e.g. 5/8 tersisa when 3 booked)", () => {
      const bookings: CoworkingBooking[] = [
        createMockBooking("sp-hot-test", "10:00", "11:00"),
        createMockBooking("sp-hot-test", "10:00", "11:00"),
        createMockBooking("sp-hot-test", "10:00", "11:00"),
      ];

      const result = checkSlotAvailability({
        spaceId: "sp-hot-test",
        spaces: [hotDeskSpace],
        bookings,
        targetDate: "2026-12-01",
        startHour: 10,
        durationHours: 1,
      });

      expect(result.isAvailable).toBe(true);
      expect(result.remainingSeats).toBe(5);
      expect(result.maxCapacity).toBe(8);
      expect(result.label).toBe("5/8 tersisa");
    });

    it("displays Dedicated Desk as 1/1 tersisa when free and Penuh when occupied", () => {
      const freeResult = checkSlotAvailability({
        spaceId: "sp-ded-test",
        spaces: [dedicatedDeskSpace],
        bookings: [],
        targetDate: "2026-12-01",
        startHour: 10,
        durationHours: 1,
      });

      expect(freeResult.isAvailable).toBe(true);
      expect(freeResult.remainingSeats).toBe(1);
      expect(freeResult.label).toBe("1/1 tersisa");

      const occupiedBookings = [createMockBooking("sp-ded-test", "10:00", "11:00")];
      const occupiedResult = checkSlotAvailability({
        spaceId: "sp-ded-test",
        spaces: [dedicatedDeskSpace],
        bookings: occupiedBookings,
        targetDate: "2026-12-01",
        startHour: 10,
        durationHours: 1,
      });

      expect(occupiedResult.isAvailable).toBe(false);
      expect(occupiedResult.remainingSeats).toBe(0);
      expect(occupiedResult.label).toBe("Penuh");
    });
  });

  describe("2. Past Slot Labeling ('Lewat' vs 'Terisi'/'Penuh')", () => {
    it("labels slots that have already passed as 'Lewat', not 'Terisi'", () => {
      const mockNow = new Date("2026-11-23T06:00:00.000Z"); // 14:00 WITA

      expect(isSlotPast("2026-11-23", "09:00", mockNow)).toBe(true);
      expect(isSlotPast("2026-11-23", "13:00", mockNow)).toBe(true);
      expect(isSlotPast("2026-11-23", "14:00", mockNow)).toBe(false);
      expect(isSlotPast("2026-11-23", "15:00", mockNow)).toBe(false);
      expect(isSlotPast("2026-11-22", "15:00", mockNow)).toBe(true); // yesterday
      expect(isSlotPast("2026-11-24", "09:00", mockNow)).toBe(false); // tomorrow
    });

    it("marks empty past slot as unavailable with label 'Lewat'", () => {
      const result = checkSlotAvailability({
        spaceId: "sp-hot-test",
        spaces: [hotDeskSpace],
        bookings: [],
        targetDate: "2026-11-20", // Past date
        startHour: 9,
        durationHours: 1,
        checkPast: true,
      });

      expect(result.isAvailable).toBe(false);
      expect(result.isPast).toBe(true);
      expect(result.label).toBe("Lewat");
      expect(result.reason).toBe("Slot sudah lewat");
    });
  });

  describe("3. Cashier and Customer Consistency", () => {
    it("ensures Cashier and Customer views show identical remaining quota and labels", () => {
      const bookings: CoworkingBooking[] = [
        createMockBooking("sp-hot-test", "11:00", "12:00", { date: "2026-12-05" }),
        createMockBooking("sp-hot-test", "11:00", "12:00", { date: "2026-12-05" }),
      ];

      // Cashier calculation
      const cashierResult = checkSlotAvailability({
        spaceId: "sp-hot-test",
        spaces: [hotDeskSpace],
        bookings,
        targetDate: "2026-12-05",
        startHour: 11,
        durationHours: 1,
      });

      // Customer calculation
      const customerSlots = slotAvailability(
        bookings,
        "sp-hot-test",
        "2026-12-05",
        ["11:00"],
        8,
        { checkPast: false }
      );

      expect(cashierResult.remainingSeats).toBe(6);
      expect(customerSlots[0].remainingSeats).toBe(6);
      expect(cashierResult.maxCapacity).toBe(8);
      expect(customerSlots[0].maxCapacity).toBe(8);
      expect(cashierResult.label).toBe("6/8 tersisa");
      expect(customerSlots[0].label).toBe("6/8 tersisa");
      expect(cashierResult.isAvailable).toBe(!customerSlots[0].isTaken);
    });
  });

  describe("4. Overbooking Prevention", () => {
    it("rejects booking when capacity is full in checkCoworkingBookingConflict", () => {
      const bookings: CoworkingBooking[] = Array.from({ length: 8 }, (_, i) =>
        createMockBooking("sp-hot-test", "10:00", "11:00", { id: `bk-${i}` })
      );

      const conflictCheck = checkCoworkingBookingConflict(bookings, {
        spaceId: "sp-hot-test",
        spaceName: "Hot Desk Flex #01 - #08",
        bookingType: "HOURLY",
        date: "2026-12-01",
        startTime: "10:00",
        endTime: "11:00",
        maxCapacity: 8,
      });

      expect(conflictCheck.hasConflict).toBe(true);
      expect(conflictCheck.message).toContain("Kapasitas slot tidak mencukupi");
      expect(conflictCheck.message).toContain("tersisa 0 kursi");
    });

    it("allows booking when capacity is still available (e.g. 7 of 8 booked)", () => {
      const bookings: CoworkingBooking[] = Array.from({ length: 7 }, (_, i) =>
        createMockBooking("sp-hot-test", "10:00", "11:00", { id: `bk-${i}` })
      );

      const conflictCheck = checkCoworkingBookingConflict(bookings, {
        spaceId: "sp-hot-test",
        spaceName: "Hot Desk Flex #01 - #08",
        bookingType: "HOURLY",
        date: "2026-12-01",
        startTime: "10:00",
        endTime: "11:00",
        maxCapacity: 8,
      });

      expect(conflictCheck.hasConflict).toBe(false);
    });

    it("rejects overbooking atomically in parallel saveCoworkingBooking", async () => {
      const uniqueSpaceId = `sp-test-atomic-${Date.now()}`;
      const targetDate = "2026-12-15";

      // Book capacity 1 space with two parallel bookings
      const booking1 = createMockBooking(uniqueSpaceId, "14:00", "15:00", {
        id: `bk-atomic-1-${Date.now()}`,
        date: targetDate,
      });

      const booking2 = createMockBooking(uniqueSpaceId, "14:00", "15:00", {
        id: `bk-atomic-2-${Date.now()}`,
        date: targetDate,
      });

      const results = await Promise.allSettled([
        saveCoworkingBooking(booking1, { maxCapacity: 1, spaceName: "Atomic Space" }),
        saveCoworkingBooking(booking2, { maxCapacity: 1, spaceName: "Atomic Space" }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      if (rejected[0].status === "rejected") {
        expect(rejected[0].reason).toBeInstanceOf(CoworkingConflictError);
        if (rejected[0].reason instanceof CoworkingConflictError) {
          expect(rejected[0].reason.code).toBe("OVERBOOKING_CONFLICT");
        }
      }
    });
  });

  describe("5. Route & Outbox Integration Security and Overbooking Guards", () => {
    const CUSTOMER_COOKIE = "dagoeng_active_persona=CUSTOMER_DEMO";
    const CASHIER_COOKIE = "dagoeng_active_persona=CASHIER_SGR";

    it("anonymizes GET /api/coworking/bookings for anonymous callers and filters CANCELLED paymentStatus", async () => {
      await writePersistentData<Array<Record<string, unknown>>>("coworking_bookings.json", [
        {
          ...createMockBooking("sp-hot-1", "10:00", "11:00", {
            id: "bk-anon-active",
            bookingCode: "CWK-SECRET-1",
            guestName: "Rahasia Aktif",
            guestPhone: "08111222333",
            guestEmail: "rahasia@example.com",
            price: 15000,
            totalAmount: 15000,
            paidAmount: 15000,
            linkedOrderId: "ORD-SECRET-1",
            checkInStatus: "RESERVED",
            paymentStatus: "PAID",
          }),
        },
        {
          ...createMockBooking("sp-hot-1", "11:00", "12:00", {
            id: "bk-anon-cancelled-pay",
            checkInStatus: "RESERVED",
          }),
          paymentStatus: "CANCELLED",
        },
        {
          ...createMockBooking("sp-hot-1", "12:00", "13:00", {
            id: "bk-anon-completed",
            checkInStatus: "COMPLETED",
          }),
        },
      ]);

      const res = await coworkingBookingsGet(
        new NextRequest("http://localhost:3000/api/coworking/bookings")
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.bookings).toHaveLength(1);

      const entry = data.bookings[0] as Record<string, unknown>;
      expect(entry.id).toBe("bk-anon-active");
      expect(entry.guestName).toBe("Terisi");
      expect(entry.guestPhone).toBe("");
      expect(entry.guestEmail).toBe("");
      expect("bookingCode" in entry).toBe(false);
      expect("totalAmount" in entry).toBe(false);
      expect("price" in entry).toBe(false);
      expect("paidAmount" in entry).toBe(false);
      expect("linkedOrderId" in entry).toBe(false);
    });

    it("returns full own booking to CUSTOMER while stripping bookingCode/totalAmount from non-owned bookings", async () => {
      await writePersistentData<Array<Record<string, unknown>>>("coworking_bookings.json", [
        {
          ...createMockBooking("sp-hot-1", "10:00", "11:00", {
            id: "bk-cust-own",
            bookingCode: "CWK-OWN-1",
            userId: "user-customer-demo",
            guestName: "Customer Demo",
            guestEmail: "customer@gmail.com",
            price: 15000,
            totalAmount: 15000,
            paidAmount: 0,
            checkInStatus: "RESERVED",
            paymentStatus: "PENDING",
          }),
        },
        {
          ...createMockBooking("sp-ded-1", "10:00", "12:00", {
            id: "bk-cust-other",
            bookingCode: "CWK-OTHER-99",
            userId: "user-other-vip",
            guestName: "VIP Guest",
            guestPhone: "0899999999",
            guestEmail: "vip@example.com",
            company: "PT Rahasia",
            notes: "VIP private note",
            price: 50000,
            totalAmount: 50000,
            paidAmount: 50000,
            linkedOrderId: "ORD-LINK-99",
            checkInStatus: "CHECKED_IN",
            paymentStatus: "PAID",
          }),
        },
        {
          ...createMockBooking("sp-pod-1", "13:00", "14:00", {
            id: "bk-cust-cancelled-pay",
            userId: "user-other-vip",
            guestEmail: "vip@example.com",
            checkInStatus: "RESERVED",
          }),
          paymentStatus: "CANCELLED",
        },
      ]);

      const res = await coworkingBookingsGet(
        new NextRequest("http://localhost:3000/api/coworking/bookings", {
          headers: { cookie: CUSTOMER_COOKIE },
        })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.bookings).toHaveLength(2);

      const own = data.bookings.find((b: { id: string }) => b.id === "bk-cust-own") as Record<
        string,
        unknown
      >;
      const other = data.bookings.find((b: { id: string }) => b.id === "bk-cust-other") as Record<
        string,
        unknown
      >;

      expect(own.bookingCode).toBe("CWK-OWN-1");
      expect(own.totalAmount).toBe(15000);

      expect(other.guestName).toBe("Terisi");
      expect(other.guestPhone).toBe("");
      expect(other.guestEmail).toBe("");
      expect("bookingCode" in other).toBe(false);
      expect("totalAmount" in other).toBe(false);
      expect("price" in other).toBe(false);
      expect("paidAmount" in other).toBe(false);
      expect("linkedOrderId" in other).toBe(false);
      expect("company" in other).toBe(false);
      expect("notes" in other).toBe(false);
      expect("userId" in other).toBe(false);
    });

    it("ignores tampered maxCapacity: 999 in POST /api/coworking/bookings and rejects overbooking with 409", async () => {
      await saveCoworkingBooking(
        createMockBooking("sp-ded-1", "10:00", "11:00", {
          id: "bk-ded-existing",
          bookingCode: "CWK-DED-1",
          date: "2026-12-01",
          spaceType: "DEDICATED_DESK",
        }),
        { maxCapacity: 1, spaceName: "Dedicated Desk D-01" }
      );

      const tamperedRes = await coworkingBookingsPost(
        new NextRequest("http://localhost:3000/api/coworking/bookings", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: CUSTOMER_COOKIE },
          body: JSON.stringify({
            booking: {
              id: "bk-ded-tampered",
              bookingCode: "CWK-DED-2",
              guestName: "Attacker",
              spaceId: "sp-ded-1",
              spaceName: "Dedicated Desk D-01",
              spaceType: "DEDICATED_DESK",
              bookingType: "HOURLY",
              date: "2026-12-01",
              startTime: "10:00",
              endTime: "11:00",
              duration: 1,
              maxCapacity: 999,
              paymentMethod: "QRIS",
            },
          }),
        })
      );

      expect(tamperedRes.status).toBe(409);
      const tamperedJson = await tamperedRes.json();
      expect(tamperedJson.code).toBe("OVERBOOKING_CONFLICT");
    });

    it("rejects past hourly slot on today WITA with 400 and validates staff missing date/startTime, corporate bundled QRIS, and QRIS claim ordering", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-11-24T06:00:00.000Z")); // Tuesday 14:00 WITA

      const pastSlotRes = await coworkingBookingsPost(
        new NextRequest("http://localhost:3000/api/coworking/bookings", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: CUSTOMER_COOKIE },
          body: JSON.stringify({
            booking: {
              id: "bk-past-slot",
              bookingCode: "CWK-PAST-1",
              guestName: "Late Guest",
              spaceId: "sp-hot-1",
              bookingType: "HOURLY",
              date: "2026-11-24",
              startTime: "09:00",
              duration: 2,
              paymentMethod: "QRIS",
            },
          }),
        })
      );
      expect(pastSlotRes.status).toBe(400);
      const pastSlotJson = await pastSlotRes.json();
      expect(pastSlotJson.error).toContain("Slot jam yang dipilih sudah lewat.");

      // Staff POST missing date -> 400
      const staffNoDateRes = await coworkingBookingsPost(
        new NextRequest("http://localhost:3000/api/coworking/bookings", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: CASHIER_COOKIE },
          body: JSON.stringify({
            booking: {
              guestName: "Staff No Date",
              spaceId: "sp-hot-1",
              bookingType: "HOURLY",
              startTime: "15:00",
              duration: 2,
              paymentMethod: "CASH",
              paymentStatus: "PAID",
            },
          }),
        })
      );
      expect(staffNoDateRes.status).toBe(400);

      // Staff POST HOURLY missing startTime -> 400
      const staffNoTimeRes = await coworkingBookingsPost(
        new NextRequest("http://localhost:3000/api/coworking/bookings", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: CASHIER_COOKIE },
          body: JSON.stringify({
            booking: {
              guestName: "Staff No Time",
              spaceId: "sp-hot-1",
              bookingType: "HOURLY",
              date: "2026-12-01",
              duration: 2,
              paymentMethod: "CASH",
              paymentStatus: "PAID",
            },
          }),
        })
      );
      expect(staffNoTimeRes.status).toBe(400);

      // Verified QRIS session is NOT consumed when booking fails OVERBOOKING_CONFLICT (409)
      await saveCoworkingBooking(
        createMockBooking("sp-ded-1", "15:00", "17:00", {
          id: "bk-ded-occupier",
          bookingCode: "CWK-OCC-1",
          date: "2026-11-24",
          spaceType: "DEDICATED_DESK",
        }),
        { maxCapacity: 1, spaceName: "Dedicated Desk D-01" }
      );
      await savePersistentQrisSession({
        orderId: "bk-qris-conflict-candidate",
        invoiceNumber: "CWK-CONFLICT-QRIS",
        expectedAmount: 50000,
        status: "VERIFIED_SUPERVISOR",
        updatedAt: new Date().toISOString(),
      });
      const conflictQrisRes = await coworkingBookingsPost(
        new NextRequest("http://localhost:3000/api/coworking/bookings", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: CASHIER_COOKIE },
          body: JSON.stringify({
            booking: {
              id: "bk-qris-conflict-candidate",
              bookingCode: "CWK-CONFLICT-QRIS",
              guestName: "Conflict QRIS",
              spaceId: "sp-ded-1",
              bookingType: "HOURLY",
              date: "2026-11-24",
              startTime: "15:00",
              duration: 2,
              totalAmount: 50000,
              paymentMethod: "QRIS",
              paymentStatus: "PAID",
            },
          }),
        })
      );
      expect(conflictQrisRes.status).toBe(409);
      const qrisAfterConflict = await getPersistentQrisSession("CWK-CONFLICT-QRIS");
      expect(qrisAfterConflict?.consumedByOrderId).toBeUndefined();

      // Corporate PREPAID QRIS bundled booking verifies linked PAID order without double-claiming QRIS
      const linkedPosOrder: OrderRecord = {
        id: "ord-corp-qris-1",
        orderNumber: "20261124-001",
        organizationId: "org-dago",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        tableNumber: "01",
        customerName: "PT Test (PIC: Budi)",
        orderType: "DINE_IN",
        status: "COMPLETED",
        paymentStatus: "PAID",
        paymentMethod: "QRIS",
        subtotal: 300000,
        tax: 0,
        total: 300000,
        targetServiceMinutes: 15,
        items: [],
        statusHistory: [],
        createdAt: new Date().toISOString(),
      };
      await savePersistentOrder(linkedPosOrder);

      const bundledOkRes = await coworkingBookingsPost(
        new NextRequest("http://localhost:3000/api/coworking/bookings", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: CASHIER_COOKIE },
          body: JSON.stringify({
            booking: {
              id: "bk-corp-bundled-1",
              bookingCode: "CWK-BUNDLED-1",
              guestName: "Budi PIC",
              spaceId: "sp-meet-1",
              bookingType: "HOURLY",
              date: "2026-12-02",
              startTime: "10:00",
              duration: 2,
              totalAmount: 300000,
              paymentMethod: "QRIS",
              paymentStatus: "PAID",
              billedViaPosOrder: true,
              linkedOrderId: "20261124-001",
            },
          }),
        })
      );
      expect(bundledOkRes.status).toBe(200);
    });

    it("marks 401 and 403 on /api/coworking/bookings as permanent rejection in syncWithOutbox and removes outbox entry", async () => {
      for (const status of [401, 403] as const) {
        const bookingId = `bk-reject-${status}`;
        enqueueOutboxItem({
          id: bookingId,
          endpoint: "/api/coworking/bookings",
          method: "POST",
          payload: { booking: { id: bookingId } },
          isCreate: true,
        });
        expect(getOutboxItems().some((i) => i.id === bookingId)).toBe(true);

        const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
          new Response(JSON.stringify({ error: `HTTP_${status}_DENIED` }), {
            status,
            headers: { "content-type": "application/json" },
          })
        );

        const res = await syncWithOutbox(
          {
            id: bookingId,
            endpoint: "/api/coworking/bookings",
            method: "POST",
            payload: { booking: { id: bookingId } },
            isCreate: true,
          },
          mockFetch
        );

        expect(res.synced).toBe(false);
        expect(res.rejected).toBe(true);
        expect(res.status).toBe(status);
        expect(res.error).toBe(`HTTP_${status}_DENIED`);
        expect(res.pendingCount).toBe(0);
        expect(getOutboxItems().some((i) => i.id === bookingId)).toBe(false);
      }
    });

    it("stores computed endTime in CoworkingContext.bookSpace and preserves COMPLETED status in confirmBookingPayment", () => {
      const cwContextSrc = fs.readFileSync(
        path.join(process.cwd(), "src/contexts/CoworkingContext.tsx"),
        "utf-8"
      );
      expect(cwContextSrc).toContain("computeHourlyEndTime");
      expect(cwContextSrc).toContain("endTime: resolvedEndTime");
      expect(cwContextSrc).toContain('booking.checkInStatus === "COMPLETED"');
    });
  });
});
