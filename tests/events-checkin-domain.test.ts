import { describe, it, expect } from "vitest";
import {
  parseTicketScanCode,
  validateTicketCheckIn,
  calculateCheckInStats,
  filterCheckInTickets,
  formatCheckInTime,
  getPaymentStatusTone,
  getCheckInStatusTone,
  getWitaDateString,
  getEventDateStatusWita,
  isEventTodayWita,
  filterTodayEventsWita,
} from "@/features/events-checkin/events-checkin-domain";
import type { EventTicketOrder } from "@/types/event";

describe("events-checkin-domain", () => {
  describe("parseTicketScanCode", () => {
    it("parses raw ticket code", () => {
      const result = parseTicketScanCode("DAGO-EVT-96354");
      expect(result.cleanCode).toBe("DAGO-EVT-96354");
      expect(result.baseCode).toBe("DAGO-EVT-96354");
      expect(result.seatNumber).toBeUndefined();
    });

    it("parses sub-seat ticket code", () => {
      const result = parseTicketScanCode("DAGO-EVT-96354-02");
      expect(result.cleanCode).toBe("DAGO-EVT-96354-02");
      expect(result.baseCode).toBe("DAGO-EVT-96354");
      expect(result.seatNumber).toBe(2);
    });

    it("parses JSON payload containing ticketCode", () => {
      const result = parseTicketScanCode('{"ticketCode":"DAGO-EVT-ABC12"}');
      expect(result.cleanCode).toBe("DAGO-EVT-ABC12");
      expect(result.baseCode).toBe("DAGO-EVT-ABC12");
    });

    it("parses prefix DAGO-CHECKIN:", () => {
      const result = parseTicketScanCode("DAGO-CHECKIN:DAGO-EVT-XYZ99");
      expect(result.cleanCode).toBe("DAGO-EVT-XYZ99");
    });

    it("extracts ticket code from URL", () => {
      const result = parseTicketScanCode("https://dagoeng.com/events/tickets/DAGO-EVT-URL88");
      expect(result.cleanCode).toBe("DAGO-EVT-URL88");
    });
  });

  describe("validateTicketCheckIn", () => {
    const baseTicket: EventTicketOrder = {
      id: "ord-1",
      ticketCode: "DAGO-EVT-100",
      eventId: "ev-1",
      eventTitle: "Workshop Kopi",
      guestName: "Budi Santoso",
      guestEmail: "budi@example.com",
      guestPhone: "081234567890",
      ticketCount: 1,
      paymentStatus: "PAID",
      checkInStatus: "REGISTERED",
      unitPrice: 50000,
      totalAmount: 50000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it("returns error if ticket is null", () => {
      const result = validateTicketCheckIn(null, "ev-1");
      expect(result.valid).toBe(false);
      expect(result.code).toBe("NOT_FOUND");
    });

    it("returns error if event does not match", () => {
      const result = validateTicketCheckIn(baseTicket, "ev-different");
      expect(result.valid).toBe(false);
      expect(result.code).toBe("WRONG_EVENT");
    });

    it("returns error if payment status is not PAID", () => {
      const unpaidTicket: EventTicketOrder = { ...baseTicket, paymentStatus: "PENDING" };
      const result = validateTicketCheckIn(unpaidTicket, "ev-1");
      expect(result.valid).toBe(false);
      expect(result.code).toBe("UNPAID");
    });

    it("returns error if single ticket already checked in", () => {
      const checkedTicket: EventTicketOrder = {
        ...baseTicket,
        checkInStatus: "CHECKED_IN",
        checkedInQty: 1,
        checkInTime: "2026-11-15T09:00:00+08:00",
      };
      const result = validateTicketCheckIn(checkedTicket, "ev-1");
      expect(result.valid).toBe(false);
      expect(result.code).toBe("ALREADY_USED");
    });

    it("validates successful single ticket", () => {
      const result = validateTicketCheckIn(baseTicket, "ev-1");
      expect(result.valid).toBe(true);
      expect(result.isComplete).toBe(true);
      expect(result.targetStatus).toBe("CHECKED_IN");
    });

    it("validates group ticket partial and specific seat", () => {
      const groupTicket: EventTicketOrder = {
        ...baseTicket,
        ticketCount: 3,
        checkedInQty: 1,
        checkedInSeats: [1],
      };
      // Seat 1 already used
      const resSeat1 = validateTicketCheckIn(groupTicket, "ev-1", 1);
      expect(resSeat1.valid).toBe(false);
      expect(resSeat1.code).toBe("SEAT_ALREADY_USED");

      // Seat 2 available
      const resSeat2 = validateTicketCheckIn(groupTicket, "ev-1", 2);
      expect(resSeat2.valid).toBe(true);
      expect(resSeat2.targetStatus).toBe("PARTIALLY_CHECKED_IN");

      // Seat 4 invalid (out of bounds)
      const resSeat4 = validateTicketCheckIn(groupTicket, "ev-1", 4);
      expect(resSeat4.valid).toBe(false);
      expect(resSeat4.code).toBe("INVALID_SEAT");
    });
  });

  describe("calculateCheckInStats", () => {
    it("computes stats accurately", () => {
      const tickets: EventTicketOrder[] = [
        {
          id: "1",
          ticketCode: "T-1",
          eventId: "ev-1",
          eventTitle: "Event",
          guestName: "A",
          guestEmail: "a@mail.com",
          guestPhone: "081",
          ticketCount: 2,
          checkedInQty: 2,
          checkInStatus: "CHECKED_IN",
          paymentStatus: "PAID",
          unitPrice: 10000,
          totalAmount: 20000,
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "2",
          ticketCode: "T-2",
          eventId: "ev-1",
          eventTitle: "Event",
          guestName: "B",
          guestEmail: "b@mail.com",
          guestPhone: "082",
          ticketCount: 3,
          checkedInQty: 1,
          checkInStatus: "PARTIALLY_CHECKED_IN",
          paymentStatus: "PAID",
          unitPrice: 10000,
          totalAmount: 30000,
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "3",
          ticketCode: "T-3",
          eventId: "ev-1",
          eventTitle: "Event",
          guestName: "C",
          guestEmail: "c@mail.com",
          guestPhone: "083",
          ticketCount: 1,
          checkedInQty: 0,
          checkInStatus: "REGISTERED",
          paymentStatus: "PAID",
          unitPrice: 10000,
          totalAmount: 10000,
          createdAt: "",
          updatedAt: "",
        },
      ];

      const stats = calculateCheckInStats(tickets);
      expect(stats.totalTickets).toBe(6);
      expect(stats.checkedInCount).toBe(3); // 2 + 1
      expect(stats.remainingCount).toBe(3);
      expect(stats.percentage).toBe(50);
      expect(stats.checkedOrders).toBe(1); // fully checked in order
      expect(stats.uncheckedOrders).toBe(2); // partially or not checked in
      expect(stats.totalOrders).toBe(3);
    });
  });

  describe("filterCheckInTickets", () => {
    const list: EventTicketOrder[] = [
      {
        id: "1",
        ticketCode: "DAGO-01",
        eventId: "ev-1",
        eventTitle: "E",
        guestName: "Wayan Koster",
        guestEmail: "wayan@bali.go.id",
        guestPhone: "0812345678",
        ticketCount: 1,
        checkInStatus: "CHECKED_IN",
        paymentStatus: "PAID",
        unitPrice: 10000,
        totalAmount: 10000,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "2",
        ticketCode: "DAGO-02",
        eventId: "ev-1",
        eventTitle: "E",
        guestName: "Made Suardana",
        guestEmail: "made@senja.id",
        guestPhone: "0898765432",
        institution: "Kopi Senja",
        ticketCount: 2,
        checkInStatus: "REGISTERED",
        paymentStatus: "PAID",
        unitPrice: 10000,
        totalAmount: 20000,
        createdAt: "",
        updatedAt: "",
      },
    ];

    it("filters by UNCHECKED tab", () => {
      const res = filterCheckInTickets(list, "UNCHECKED", "");
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe("2");
    });

    it("filters by CHECKED tab", () => {
      const res = filterCheckInTickets(list, "CHECKED", "");
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe("1");
    });

    it("searches by query (name or institution)", () => {
      const res1 = filterCheckInTickets(list, "ALL", "Senja");
      expect(res1).toHaveLength(1);
      expect(res1[0].guestName).toBe("Made Suardana");

      const res2 = filterCheckInTickets(list, "ALL", "0812");
      expect(res2).toHaveLength(1);
      expect(res2[0].guestName).toBe("Wayan Koster");
    });
  });

  describe("formatCheckInTime", () => {
    it("formats ISO string to WITA time", () => {
      const formatted = formatCheckInTime("2026-11-15T09:30:00+08:00");
      expect(formatted).toContain("09.30");
      expect(formatted).toContain("WITA");
    });

    it("returns dash for empty time", () => {
      expect(formatCheckInTime(null)).toBe("—");
      expect(formatCheckInTime(undefined)).toBe("—");
    });
  });

  describe("status tones", () => {
    it("maps payment status to tone", () => {
      expect(getPaymentStatusTone("PAID")).toBe("success");
      expect(getPaymentStatusTone("PENDING")).toBe("warning");
      expect(getPaymentStatusTone("CANCELLED")).toBe("destructive");
    });

    it("maps check-in status to tone and label", () => {
      const order: EventTicketOrder = {
        id: "1",
        ticketCode: "T-1",
        eventId: "ev-1",
        eventTitle: "E",
        guestName: "G",
        guestEmail: "g@mail.com",
        guestPhone: "08",
        ticketCount: 3,
        checkedInQty: 1,
        checkInStatus: "PARTIALLY_CHECKED_IN",
        paymentStatus: "PAID",
        unitPrice: 10000,
        totalAmount: 30000,
        createdAt: "",
        updatedAt: "",
      };

      const res = getCheckInStatusTone(order);
      expect(res.tone).toBe("info");
      expect(res.label).toBe("Hadir 1/3");
    });
  });

  describe("WITA date filtering for check-in desk (Task S-06)", () => {
    // Reference date: Monday, 16 Nov 2026, 10:00 WITA (02:00 UTC)
    const refDate = new Date("2026-11-16T02:00:00.000Z");

    describe("getWitaDateString", () => {
      it("formats ISO timestamps to YYYY-MM-DD in WITA (UTC+8)", () => {
        // 2026-11-15 23:30 UTC is 2026-11-16 07:30 WITA
        expect(getWitaDateString(new Date("2026-11-15T23:30:00.000Z"))).toBe("2026-11-16");
        // 2026-11-16 15:59 UTC is 2026-11-16 23:59 WITA
        expect(getWitaDateString(new Date("2026-11-16T15:59:00.000Z"))).toBe("2026-11-16");
        // 2026-11-16 16:01 UTC is 2026-11-17 00:01 WITA
        expect(getWitaDateString(new Date("2026-11-16T16:01:00.000Z"))).toBe("2026-11-17");
      });

      it("handles string and number timestamps and invalid input gracefully", () => {
        expect(getWitaDateString("2026-11-09T08:00:00+08:00")).toBe("2026-11-09");
        expect(getWitaDateString("invalid-date")).toBe("");
      });
    });

    describe("getEventDateStatusWita & isEventTodayWita", () => {
      it("identifies past event (e.g. 9 Nov 2026) as PAST and not today", () => {
        const pastEvent = {
          startDate: "2026-11-09T00:30:00.000Z", // 9 Nov 08:30 WITA
          endDate: "2026-11-09T04:00:00.000Z",   // 9 Nov 12:00 WITA
        };
        expect(getEventDateStatusWita(pastEvent, refDate)).toBe("PAST");
        expect(isEventTodayWita(pastEvent, refDate)).toBe(false);
      });

      it("identifies past event with corrupted multi-year dummy end date (e.g. 2048) as PAST", () => {
        const corruptDummyEvent = {
          startDate: "2026-11-09T00:30:00.000Z",
          endDate: "2048-12-31T23:59:59.000Z", // abnormal duration > 7 days
        };
        expect(getEventDateStatusWita(corruptDummyEvent, refDate)).toBe("PAST");
        expect(isEventTodayWita(corruptDummyEvent, refDate)).toBe(false);
      });

      it("identifies upcoming event (e.g. 22 Nov 2026) as UPCOMING and not today", () => {
        const futureEvent = {
          startDate: "2026-11-22T23:00:00.000Z",
          endDate: "2026-11-23T04:00:00.000Z",
        };
        expect(getEventDateStatusWita(futureEvent, refDate)).toBe("UPCOMING");
        expect(isEventTodayWita(futureEvent, refDate)).toBe(false);
      });

      it("identifies event taking place today (16 Nov 2026) as TODAY", () => {
        const todayEvent = {
          startDate: "2026-11-16T01:00:00.000Z", // 16 Nov 09:00 WITA
          endDate: "2026-11-16T09:00:00.000Z",   // 16 Nov 17:00 WITA
        };
        expect(getEventDateStatusWita(todayEvent, refDate)).toBe("TODAY");
        expect(isEventTodayWita(todayEvent, refDate)).toBe(true);
      });

      it("identifies multi-day festival spanning today (15-17 Nov 2026) as TODAY", () => {
        const festival = {
          startDate: "2026-11-15T02:00:00.000Z",
          endDate: "2026-11-17T14:00:00.000Z",
        };
        expect(getEventDateStatusWita(festival, refDate)).toBe("TODAY");
        expect(isEventTodayWita(festival, refDate)).toBe(true);
      });

      it("handles single-day event without explicit endDate as TODAY on its date", () => {
        const eventNoEnd = {
          startDate: "2026-11-16T08:00:00+08:00",
        };
        expect(getEventDateStatusWita(eventNoEnd, refDate)).toBe("TODAY");
        expect(isEventTodayWita(eventNoEnd, refDate)).toBe(true);
      });
    });

    describe("filterTodayEventsWita", () => {
      const mockEvents = [
        { id: "ev-past-9nov", title: "Pengajian Akbar 9 Nov", startDate: "2026-11-09T00:30:00.000Z", endDate: "2026-11-09T04:00:00.000Z" },
        { id: "ev-past-corrupt", title: "Dummy Event Past", startDate: "2026-11-08T00:00:00.000Z", endDate: "2048-01-01T00:00:00.000Z" },
        { id: "ev-today", title: "Workshop Barista Hari Ini", startDate: "2026-11-16T01:00:00.000Z", endDate: "2026-11-16T09:00:00.000Z" },
        { id: "ev-future-22nov", title: "Konser Musik 22 Nov", startDate: "2026-11-22T23:00:00.000Z", endDate: "2026-11-23T04:00:00.000Z" },
      ];

      it("filters strictly to today's events, excluding past and upcoming events", () => {
        const result = filterTodayEventsWita(mockEvents, refDate);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("ev-today");
        expect(result.some((e) => e.id === "ev-past-9nov")).toBe(false);
        expect(result.some((e) => e.id === "ev-future-22nov")).toBe(false);
      });

      it("returns empty array when no events occur today", () => {
        const noTodayEvents = [
          mockEvents[0], // 9 Nov
          mockEvents[3], // 22 Nov
        ];
        const result = filterTodayEventsWita(noTodayEvents, refDate);
        expect(result).toEqual([]);
      });
    });
  });
});
