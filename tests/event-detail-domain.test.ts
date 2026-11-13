import { describe, it, expect } from "vitest";
import {
  validateBookingInput,
  calculateBookingTotal,
  formatDetailSchedule,
  getQuotaBadgeTone,
  buildShareText,
} from "@/features/event-detail/event-detail-domain";

describe("event-detail-domain", () => {
  it("validates booking form inputs correctly", () => {
    // Empty name
    const res1 = validateBookingInput({
      guestName: "  ",
      guestEmail: "rian@example.com",
      guestPhone: "08123456789",
      ticketCount: 1,
      maxTickets: 5,
    });
    expect(res1.isValid).toBe(false);
    expect(res1.error).toContain("Nama lengkap");

    // Invalid email
    const res2 = validateBookingInput({
      guestName: "Rian Pratama",
      guestEmail: "invalid-email",
      guestPhone: "08123456789",
      ticketCount: 1,
      maxTickets: 5,
    });
    expect(res2.isValid).toBe(false);
    expect(res2.error).toContain("email");

    // Empty phone
    const res3 = validateBookingInput({
      guestName: "Rian Pratama",
      guestEmail: "rian@example.com",
      guestPhone: "",
      ticketCount: 1,
      maxTickets: 5,
    });
    expect(res3.isValid).toBe(false);
    expect(res3.error).toContain("WhatsApp");

    // Ticket count exceeds max
    const res4 = validateBookingInput({
      guestName: "Rian Pratama",
      guestEmail: "rian@example.com",
      guestPhone: "08123456789",
      ticketCount: 6,
      maxTickets: 5,
    });
    expect(res4.isValid).toBe(false);
    expect(res4.error).toContain("maksimal 5");

    // Valid form
    const resValid = validateBookingInput({
      guestName: "Rian Pratama",
      guestEmail: "rian@example.com",
      guestPhone: "08123456789",
      ticketCount: 2,
      maxTickets: 5,
    });
    expect(resValid.isValid).toBe(true);
    expect(resValid.error).toBeNull();
  });

  it("calculates booking total accurately", () => {
    // Free event
    expect(calculateBookingTotal(0, false, 3)).toBe(0);
    expect(calculateBookingTotal(50000, false, 2)).toBe(0);

    // Paid event
    expect(calculateBookingTotal(50000, true, 2)).toBe(100000);
    expect(calculateBookingTotal(75000, true, 1)).toBe(75000);
  });

  it("determines quota status badge tone accurately", () => {
    expect(getQuotaBadgeTone(50, false)).toEqual({
      label: "Tersedia",
      tone: "success",
    });

    expect(getQuotaBadgeTone(85, false)).toEqual({
      label: "Sisa sedikit",
      tone: "warning",
    });

    expect(getQuotaBadgeTone(100, true)).toEqual({
      label: "Tiket habis",
      tone: "destructive",
    });
  });

  it("formats detail schedule in full WITA format", () => {
    const formatted = formatDetailSchedule(
      "2026-11-25T10:00:00Z",
      "2026-11-25T13:00:00Z"
    );
    expect(formatted).toContain("WITA");
    expect(formatted).toContain("Nov");
    expect(formatted).toContain("2026");
  });

  it("builds share text and encoded URLs correctly", () => {
    const share = buildShareText("Latte Art Workshop", "https://dago.id/events/evt-1");
    expect(share.text).toContain("Latte Art Workshop");
    expect(share.whatsAppUrl).toContain("https://api.whatsapp.com/send?text=");
    expect(share.twitterUrl).toContain("https://twitter.com/intent/tweet");
  });
});
