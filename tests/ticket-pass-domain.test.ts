import { describe, it, expect } from "vitest";
import {
  calculatePaymentDeadline,
  formatTicketEventDate,
  getSubTicketDetails,
  getTicketPaymentStatusTone,
  getTicketCheckInStatusTone,
  formatPaymentMethodLabel,
} from "@/features/events-tickets/ticket-pass-domain";

describe("ticket-pass-domain", () => {
  describe("calculatePaymentDeadline", () => {
    it("calculates remaining minutes and seconds accurately", () => {
      const created = new Date("2026-11-15T10:00:00Z").toISOString();
      // 15 minutes elapsed (45 minutes remaining out of 60)
      const now = new Date("2026-11-15T10:15:30Z").getTime();

      const result = calculatePaymentDeadline(created, now, 60);
      expect(result.isExpired).toBe(false);
      expect(result.minutes).toBe(44);
      expect(result.seconds).toBe(30);
    });

    it("marks as expired when 60 minutes have passed", () => {
      const created = new Date("2026-11-15T10:00:00Z").toISOString();
      const now = new Date("2026-11-15T11:05:00Z").getTime();

      const result = calculatePaymentDeadline(created, now, 60);
      expect(result.isExpired).toBe(true);
      expect(result.minutes).toBe(0);
      expect(result.seconds).toBe(0);
    });
  });

  describe("formatTicketEventDate", () => {
    it("formats ISO string to Indonesian date with WITA time", () => {
      const formatted = formatTicketEventDate("2026-12-25T19:30:00+08:00");
      expect(formatted).toContain("25");
      expect(formatted).toContain("Desember");
      expect(formatted).toContain("2026");
      expect(formatted).toContain("19.30");
      expect(formatted).toContain("WITA");
    });

    it("handles invalid or empty date gracefully", () => {
      expect(formatTicketEventDate("")).toBe("—");
      expect(formatTicketEventDate("invalid-date")).toBe("—");
    });
  });

  describe("getSubTicketDetails", () => {
    const mockTicket = {
      ticketCode: "DAGO-EVT-96354",
      guestName: "Budi Santoso",
      ticketCount: 3,
      eventId: "ev-100",
      checkedInSeats: [1],
      checkedInQty: 1,
      checkInStatus: "PARTIALLY_CHECKED_IN",
    };

    it("generates seat 1 details for primary guest", () => {
      const details = getSubTicketDetails(mockTicket, 1);
      expect(details.subTicketCode).toBe("DAGO-EVT-96354-01");
      expect(details.guestLabel).toBe("Budi Santoso (Pemesan Utama)");
      expect(details.isCheckedIn).toBe(true);

      const parsedPayload = JSON.parse(details.subPayload);
      expect(parsedPayload.ticketCode).toBe("DAGO-EVT-96354-01");
      expect(parsedPayload.seat).toBe(1);
    });

    it("generates seat 2 details for companion guest", () => {
      const details = getSubTicketDetails(mockTicket, 2);
      expect(details.subTicketCode).toBe("DAGO-EVT-96354-02");
      expect(details.guestLabel).toBe("Tamu Pax #2");
      expect(details.isCheckedIn).toBe(false);
    });

    it("handles single ticket without seat suffix", () => {
      const singleTicket = {
        ticketCode: "DAGO-EVT-SINGLE",
        guestName: "Dewi Lestari",
        ticketCount: 1,
        eventId: "ev-200",
        checkInStatus: "REGISTERED",
      };
      const details = getSubTicketDetails(singleTicket, 1);
      expect(details.subTicketCode).toBe("DAGO-EVT-SINGLE");
      expect(details.guestLabel).toBe("Dewi Lestari");
      expect(details.isCheckedIn).toBe(false);
    });
  });

  describe("getTicketPaymentStatusTone", () => {
    it("maps PAID to success", () => {
      const result = getTicketPaymentStatusTone("PAID");
      expect(result.tone).toBe("success");
      expect(result.label).toBe("Terkonfirmasi (Lunas)");
    });

    it("maps PENDING to warning", () => {
      const result = getTicketPaymentStatusTone("PENDING");
      expect(result.tone).toBe("warning");
      expect(result.label).toBe("Menunggu pembayaran");
    });

    it("maps CANCELLED to destructive", () => {
      const result = getTicketPaymentStatusTone("CANCELLED");
      expect(result.tone).toBe("destructive");
      expect(result.label).toBe("Dibatalkan");
    });
  });

  describe("getTicketCheckInStatusTone", () => {
    it("returns success when fully checked in", () => {
      const result = getTicketCheckInStatusTone("CHECKED_IN", 2, 2);
      expect(result.tone).toBe("success");
      expect(result.label).toBe("Selesai check-in");
    });

    it("returns info when partially checked in", () => {
      const result = getTicketCheckInStatusTone("PARTIALLY_CHECKED_IN", 3, 1);
      expect(result.tone).toBe("info");
      expect(result.label).toBe("Sebagian hadir (1/3)");
    });

    it("returns neutral when not yet checked in", () => {
      const result = getTicketCheckInStatusTone("REGISTERED", 1, 0);
      expect(result.tone).toBe("neutral");
      expect(result.label).toBe("Belum check-in");
    });
  });

  describe("formatPaymentMethodLabel", () => {
    it("translates payment methods to readable labels", () => {
      expect(formatPaymentMethodLabel("BANK_TRANSFER")).toBe("Transfer Bank Manual");
      expect(formatPaymentMethodLabel("MANUAL_TRANSFER")).toBe("Transfer Bank Manual");
      expect(formatPaymentMethodLabel("QRIS")).toBe("QRIS");
      expect(formatPaymentMethodLabel("DOKU")).toBe("DOKU Payment Gateway");
    });
  });
});
