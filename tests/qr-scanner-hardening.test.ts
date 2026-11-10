import { describe, it, expect, beforeEach } from "vitest";
import {
  createEventSubmission,
  updateEventStatus,
  createEventBooking,
  updateBookingPaymentStatus,
  updateBookingCheckIn,
  getEventBookings,
} from "@/lib/events";

describe("QR Code Scanner Hardening & Event Check-in Suite", () => {
  const orgEmail = "organizer-fest@dagocreative.id";
  let eventId: string;
  let anotherEventId: string;

  beforeEach(async () => {
    // Event: Dec 21, 2026 at 10:00 WITA (+08:00)
    const ev = await createEventSubmission({
      organizerName: "DagoEng Organizer",
      organizerEmail: orgEmail,
      organizerPhone: "081234567890",
      title: "Sing Sing So Fest 2026",
      category: "COMMUNITY",
      description: "Music & Cultural Festival in Makassar",
      startDate: "2026-12-21T10:00:00+08:00",
      endDate: "2026-12-21T23:00:00+08:00",
      location: "Pantai Losari Makassar",
      isPaid: true,
      price: 150000,
      posterUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",
    });
    await updateEventStatus(ev.id, "APPROVED");
    eventId = ev.id;

    const ev2 = await createEventSubmission({
      organizerName: "Komunitas Lain",
      organizerEmail: "other@dagocreative.id",
      organizerPhone: "081234567891",
      title: "Workshop Desain 2026",
      category: "WORKSHOP",
      description: "Workshop Desain Kreatif",
      startDate: "2026-12-21T10:00:00+08:00",
      endDate: "2026-12-21T17:00:00+08:00",
      location: "Dago Hub Singaraja",
      isPaid: true,
      price: 50000,
      posterUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",
    });
    await updateEventStatus(ev2.id, "APPROVED");
    anotherEventId = ev2.id;
  });

  // Simulated QR payload parser matching the hardened scanner parser
  const parseQR = (raw: string): string => {
    const trimmed = raw.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const obj = JSON.parse(trimmed);
        if (obj.ticketCode) return String(obj.ticketCode).trim();
      } catch {}
    }
    if (trimmed.includes('"ticketCode"')) {
      try {
        const match = trimmed.match(/"ticketCode"\s*:\s*"([^"]+)"/);
        if (match && match[1]) return match[1].trim();
      } catch {}
    }
    if (trimmed.startsWith("DAGO-CHECKIN:")) {
      const parts = trimmed.split(":");
      if (parts[1]) return parts[1].trim();
    }
    const match = trimmed.match(/DAGO-EVT-[A-Z0-9-]+/i);
    if (match) return match[0];

    return trimmed;
  };

  describe("1. QR Payload Parsing & Decoding Robustness", () => {
    it("mengekstrak kode tiket dari JSON QR payload resmi e-tiket", () => {
      const payload = JSON.stringify({
        ticketCode: "DAGO-EVT-96354-01",
        eventId: "evt-sample-123",
        seat: 1,
      });
      expect(parseQR(payload).toUpperCase()).toBe("DAGO-EVT-96354-01");
    });

    it("mengekstrak kode tiket dari JSON QR dengan whitespace dan linebreaks", () => {
      const payload = `\n  {\n    "ticketCode": "DAGO-EVT-72676-02",\n    "eventId": "evt-456",\n    "seat": 2\n  }\n`;
      expect(parseQR(payload).toUpperCase()).toBe("DAGO-EVT-72676-02");
    });

    it("mengekstrak kode tiket dari URL tautan tiket", () => {
      const url = "http://localhost:3000/events/tickets/DAGO-EVT-55443-01";
      expect(parseQR(url).toUpperCase()).toBe("DAGO-EVT-55443-01");
    });

    it("mengekstrak kode tiket dari format DAGO-CHECKIN prefix", () => {
      const prefixed = "DAGO-CHECKIN:DAGO-EVT-33221-03:evt-789";
      expect(parseQR(prefixed).toUpperCase()).toBe("DAGO-EVT-33221-03");
    });

    it("menjaga kode tiket raw yang diketik manual", () => {
      const raw = "DAGO-EVT-11223";
      expect(parseQR(raw).toUpperCase()).toBe("DAGO-EVT-11223");
    });
  });

  describe("2. End-to-End QR Scan & Check-In Validation", () => {
    it("memproses check-in otomatis ketika scanner membaca JSON payload sub-tiket -01", async () => {
      const booking = await createEventBooking({
        eventId,
        guestName: "Rudi Hartono",
        guestEmail: "rudi@example.com",
        guestPhone: "08123456789",
        ticketCount: 2,
        paymentMethod: "MANUAL_TRANSFER",
      });
      await updateBookingPaymentStatus(booking.id, "PAID");

      // Scanned QR payload from ticket page:
      const scannedPayload = JSON.stringify({
        ticketCode: `${booking.ticketCode}-01`,
        eventId: booking.eventId,
        seat: 1,
      });

      const parsedCode = parseQR(scannedPayload).toUpperCase();
      expect(parsedCode).toBe(`${booking.ticketCode}-01`);

      // Check-in sub-ticket 1
      const res = await updateBookingCheckIn(booking.id, "PARTIALLY_CHECKED_IN", {
        ticketCode: parsedCode,
        seatNumber: 1,
        bypassWindow: true,
      });

      expect(res.checkedInQty).toBe(1);
      expect(res.checkedInSeats).toContain(1);
      expect(res.checkInStatus).toBe("PARTIALLY_CHECKED_IN");
    });

    it("menolak pemindaian ulang QR code sub-tiket yang sama (-01)", async () => {
      const booking = await createEventBooking({
        eventId,
        guestName: "Dewi Lestari",
        guestEmail: "dewi@example.com",
        guestPhone: "08123456788",
        ticketCount: 2,
        paymentMethod: "MANUAL_TRANSFER",
      });
      await updateBookingPaymentStatus(booking.id, "PAID");

      const payload01 = JSON.stringify({
        ticketCode: `${booking.ticketCode}-01`,
        eventId: booking.eventId,
        seat: 1,
      });

      // Scan 1: Berhasil
      const res1 = await updateBookingCheckIn(booking.id, "PARTIALLY_CHECKED_IN", {
        ticketCode: parseQR(payload01),
        seatNumber: 1,
        bypassWindow: true,
      });
      expect(res1.checkedInQty).toBe(1);

      // Scan 2 (pemindaian ulang QR yang sama): Ditolak
      await expect(
        updateBookingCheckIn(booking.id, "PARTIALLY_CHECKED_IN", {
          ticketCode: parseQR(payload01),
          seatNumber: 1,
          bypassWindow: true,
        })
      ).rejects.toThrow(/sudah digunakan untuk check-in sebelumnya/i);

      // Pastikan kuota tidak bertambah
      const bookings = await getEventBookings(eventId);
      const b = bookings.find((item) => item.id === booking.id);
      expect(b?.checkedInQty).toBe(1);
    });

    it("memproses pemindaian sub-tiket -02 setelah -01 selesai", async () => {
      const booking = await createEventBooking({
        eventId,
        guestName: "Bambang Pamungkas",
        guestEmail: "bambang@example.com",
        guestPhone: "08123456787",
        ticketCount: 2,
        paymentMethod: "MANUAL_TRANSFER",
      });
      await updateBookingPaymentStatus(booking.id, "PAID");

      const payload01 = JSON.stringify({
        ticketCode: `${booking.ticketCode}-01`,
        eventId: booking.eventId,
        seat: 1,
      });
      const payload02 = JSON.stringify({
        ticketCode: `${booking.ticketCode}-02`,
        eventId: booking.eventId,
        seat: 2,
      });

      await updateBookingCheckIn(booking.id, "PARTIALLY_CHECKED_IN", {
        ticketCode: parseQR(payload01),
        seatNumber: 1,
        bypassWindow: true,
      });

      const res2 = await updateBookingCheckIn(booking.id, "CHECKED_IN", {
        ticketCode: parseQR(payload02),
        seatNumber: 2,
        bypassWindow: true,
      });

      expect(res2.checkedInQty).toBe(2);
      expect(res2.checkedInSeats).toEqual(expect.arrayContaining([1, 2]));
      expect(res2.checkInStatus).toBe("CHECKED_IN");
    });

    it("menolak check-in jika tiket belum berstatus PAID (masih PENDING)", async () => {
      const booking = await createEventBooking({
        eventId,
        guestName: "Unpaid Attendee",
        guestEmail: "unpaid@example.com",
        guestPhone: "08123456786",
        ticketCount: 1,
        paymentMethod: "MANUAL_TRANSFER",
      });
      // Payment status is still PENDING

      const payload = JSON.stringify({
        ticketCode: booking.ticketCode,
        eventId: booking.eventId,
      });

      await expect(
        updateBookingCheckIn(booking.id, "CHECKED_IN", {
          ticketCode: parseQR(payload),
          bypassWindow: true,
        })
      ).rejects.toThrow(/belum diverifikasi lunas/i);
    });

    it("menolak check-in jika nomor sub-tiket melebihi kapasitas booking", async () => {
      const booking = await createEventBooking({
        eventId,
        guestName: "Overflow Pax",
        guestEmail: "overflow@example.com",
        guestPhone: "08123456785",
        ticketCount: 2,
        paymentMethod: "MANUAL_TRANSFER",
      });
      await updateBookingPaymentStatus(booking.id, "PAID");

      const payloadInvalidSeat = JSON.stringify({
        ticketCode: `${booking.ticketCode}-03`,
        eventId: booking.eventId,
        seat: 3,
      });

      await expect(
        updateBookingCheckIn(booking.id, "PARTIALLY_CHECKED_IN", {
          ticketCode: parseQR(payloadInvalidSeat),
          seatNumber: 3,
          bypassWindow: true,
        })
      ).rejects.toThrow(/tidak valid untuk pemesanan ini/i);
    });
  });
});

