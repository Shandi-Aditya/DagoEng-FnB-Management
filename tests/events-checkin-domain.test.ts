import { describe, it, expect } from "vitest";
import {
  parseTicketScanCode,
  validateTicketCheckIn,
  calculateCheckInStats,
  filterCheckInTickets,
  formatCheckInTime,
  getPaymentStatusTone,
  getCheckInStatusTone,
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
});
