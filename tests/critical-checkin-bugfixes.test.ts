import { describe, it, expect, beforeEach } from "vitest";
import {
  createEventSubmission,
  updateEventStatus,
  createEventBooking,
  updateBookingPaymentStatus,
  updateBookingCheckIn,
  getEventBookings,
} from "@/lib/events";

describe("Critical Check-in Bugfixes Suite", () => {
  const orgEmail = "organizer-fest@dagocreative.id";
  let eventId: string;

  beforeEach(async () => {
    // Event: Dec 21, 2026 at 10:00 WITA (+08:00)
    // 2 hours before start window: Dec 21, 2026 08:00 WITA
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
  });

  describe("Bug 1: Check-in Ganda per Sub-Tiket", () => {
    it("memastikan scan booking 3 tiket: -01, -02, -03 independen dan duplikat -01 ditolak tanpa menambah kehadiran", async () => {
      const booking = await createEventBooking({
        eventId,
        guestName: "Budi Santoso",
        guestEmail: "budi@example.com",
        guestPhone: "08123456789",
        ticketCount: 3,
        paymentMethod: "MANUAL_TRANSFER",
      });

      await updateBookingPaymentStatus(booking.id, "PAID");

      const code01 = `${booking.ticketCode}-01`;
      const code02 = `${booking.ticketCode}-02`;
      const code03 = `${booking.ticketCode}-03`;

      // 1. Scan -01 pertama: BERHASIL
      const res1 = await updateBookingCheckIn(booking.id, "CHECKED_IN", {
        ticketCode: code01,
        bypassWindow: true,
      });
      expect(res1.checkedInQty).toBe(1);
      expect(res1.checkedInSeats).toContain(1);
      expect(res1.checkInStatus).toBe("PARTIALLY_CHECKED_IN");

      // 2. Scan -01 kedua: DITOLAK dengan pesan sudah check-in dan timestamp
      await expect(
        updateBookingCheckIn(booking.id, "CHECKED_IN", {
          ticketCode: code01,
          bypassWindow: true,
        })
      ).rejects.toThrow(/sudah digunakan untuk check-in sebelumnya/i);

      // Verifikasi count tetap 1
      const currentBookings1 = await getEventBookings(eventId);
      const current1 = currentBookings1.find((b) => b.id === booking.id);
      expect(current1?.checkedInQty).toBe(1);
      expect(current1?.checkedInSeats).toEqual([1]);

      // 3. Scan -01 ketiga: DITOLAK
      await expect(
        updateBookingCheckIn(booking.id, "CHECKED_IN", {
          ticketCode: code01,
          bypassWindow: true,
        })
      ).rejects.toThrow(/sudah digunakan untuk check-in sebelumnya/i);

      const currentBookings2 = await getEventBookings(eventId);
      expect(currentBookings2.find((b) => b.id === booking.id)?.checkedInQty).toBe(1);

      // 4. Scan -02 pertama: BERHASIL
      const res2 = await updateBookingCheckIn(booking.id, "CHECKED_IN", {
        ticketCode: code02,
        bypassWindow: true,
      });
      expect(res2.checkedInQty).toBe(2);
      expect(res2.checkedInSeats).toEqual(expect.arrayContaining([1, 2]));
      expect(res2.checkInStatus).toBe("PARTIALLY_CHECKED_IN");

      // 5. Scan -03 pertama: BERHASIL
      const res3 = await updateBookingCheckIn(booking.id, "CHECKED_IN", {
        ticketCode: code03,
        bypassWindow: true,
      });
      expect(res3.checkedInQty).toBe(3);
      expect(res3.checkedInSeats).toEqual(expect.arrayContaining([1, 2, 3]));
      expect(res3.checkInStatus).toBe("CHECKED_IN");

      // Verifikasi total kehadiran 3/3 dan tidak ada tiket dihitung dua kali
      const finalBookings = await getEventBookings(eventId);
      const finalBooking = finalBookings.find((b) => b.id === booking.id);
      expect(finalBooking?.checkedInQty).toBe(3);
      expect(finalBooking?.ticketCount).toBe(3);
      expect(finalBooking?.checkedInSeats?.length).toBe(3);
    });

    it("memastikan scan booking 2 tiket: -01 sukses, -01 ulang ditolak, -02 sukses (total 2/2)", async () => {
      const booking = await createEventBooking({
        eventId,
        guestName: "Siti Rahma",
        guestEmail: "siti@example.com",
        guestPhone: "08129876543",
        ticketCount: 2,
        paymentMethod: "MANUAL_TRANSFER",
      });

      await updateBookingPaymentStatus(booking.id, "PAID");

      const code01 = `${booking.ticketCode}-01`;
      const code02 = `${booking.ticketCode}-02`;

      // Scan -01: BERHASIL
      const res1 = await updateBookingCheckIn(booking.id, "CHECKED_IN", {
        ticketCode: code01,
        bypassWindow: true,
      });
      expect(res1.checkedInQty).toBe(1);
      expect(res1.checkedInSeats).toEqual([1]);
      expect(res1.checkInStatus).toBe("PARTIALLY_CHECKED_IN");

      // Scan -01 ulang: DITOLAK
      await expect(
        updateBookingCheckIn(booking.id, "CHECKED_IN", {
          ticketCode: code01,
          bypassWindow: true,
        })
      ).rejects.toThrow(/sudah digunakan untuk check-in sebelumnya/i);

      // Scan -02: BERHASIL
      const res2 = await updateBookingCheckIn(booking.id, "CHECKED_IN", {
        ticketCode: code02,
        bypassWindow: true,
      });
      expect(res2.checkedInQty).toBe(2);
      expect(res2.checkInStatus).toBe("CHECKED_IN");

      const finalBookings = await getEventBookings(eventId);
      const finalBooking = finalBookings.find((b) => b.id === booking.id);
      expect(finalBooking?.checkedInQty).toBe(2);
      expect(finalBooking?.ticketCount).toBe(2);
    });

    it("menolak nomor tiket / seat yang melebihi jumlah tiket dalam booking", async () => {
      const booking = await createEventBooking({
        eventId,
        guestName: "Ahmad Dani",
        guestEmail: "ahmad@example.com",
        guestPhone: "08111222333",
        ticketCount: 2,
        paymentMethod: "MANUAL_TRANSFER",
      });

      await updateBookingPaymentStatus(booking.id, "PAID");

      const codeInvalid = `${booking.ticketCode}-05`;

      await expect(
        updateBookingCheckIn(booking.id, "CHECKED_IN", {
          ticketCode: codeInvalid,
          bypassWindow: true,
        })
      ).rejects.toThrow(/Nomor tiket #5 tidak valid/i);
    });

    it("mencegah race condition ketika dua petugas melakukan scan kode yang sama secara bersamaan", async () => {
      const booking = await createEventBooking({
        eventId,
        guestName: "Concurrency Test",
        guestEmail: "concurrent@example.com",
        guestPhone: "08999999999",
        ticketCount: 2,
        paymentMethod: "MANUAL_TRANSFER",
      });

      await updateBookingPaymentStatus(booking.id, "PAID");

      const code01 = `${booking.ticketCode}-01`;

      const p1 = updateBookingCheckIn(booking.id, "CHECKED_IN", {
        ticketCode: code01,
        bypassWindow: true,
      });

      const p2 = updateBookingCheckIn(booking.id, "CHECKED_IN", {
        ticketCode: code01,
        bypassWindow: true,
      });

      const results = await Promise.allSettled([p1, p2]);
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      const finalBookings = await getEventBookings(eventId);
      const finalBooking = finalBookings.find((b) => b.id === booking.id);
      expect(finalBooking?.checkedInQty).toBe(1);
      expect(finalBooking?.checkedInSeats).toEqual([1]);
    });
  });

  describe("Bug 3: Pembatasan Waktu Check-In (Time Window WITA & Event Status)", () => {
    // Event: 2026-12-21 10:00 WITA (+08:00) -> 02:00 UTC
    // Meja check-in buka 2 jam sebelum: 2026-12-21 08:00 WITA -> 00:00 UTC
    it("menolak check-in jika dilakukan jauh sebelum event (e.g. 20 Des 2026)", async () => {
      const booking = await createEventBooking({
        eventId,
        guestName: "Early Bird",
        guestEmail: "early@example.com",
        guestPhone: "08123456780",
        ticketCount: 1,
        paymentMethod: "MANUAL_TRANSFER",
      });
      await updateBookingPaymentStatus(booking.id, "PAID");

      // 2026-12-20 12:00:00 WITA -> 2026-12-20T04:00:00Z
      const testTimestamp = "2026-12-20T04:00:00Z";

      await expect(
        updateBookingCheckIn(booking.id, "CHECKED_IN", {
          ticketCode: `${booking.ticketCode}-01`,
          currentTimestamp: testTimestamp,
        })
      ).rejects.toThrow(/Meja check-in belum dibuka/i);
    });

    it("menolak check-in pada hari H pukul 07:59 WITA (1 menit sebelum jendela 2 jam buka)", async () => {
      const booking = await createEventBooking({
        eventId,
        guestName: "Early Morning",
        guestEmail: "earlymorning@example.com",
        guestPhone: "08123456781",
        ticketCount: 1,
        paymentMethod: "MANUAL_TRANSFER",
      });
      await updateBookingPaymentStatus(booking.id, "PAID");

      // 2026-12-21 07:59:00 WITA (+08:00) -> 2026-12-20T23:59:00Z
      const testTimestamp = "2026-12-20T23:59:00Z";

      await expect(
        updateBookingCheckIn(booking.id, "CHECKED_IN", {
          ticketCode: `${booking.ticketCode}-01`,
          currentTimestamp: testTimestamp,
        })
      ).rejects.toThrow(/Meja check-in belum dibuka/i);
    });

    it("mengizinkan check-in tepat pada pukul 08:00 WITA (2 jam sebelum mulai event)", async () => {
      const booking = await createEventBooking({
        eventId,
        guestName: "Punctual Attendee",
        guestEmail: "punctual@example.com",
        guestPhone: "08123456782",
        ticketCount: 1,
        paymentMethod: "MANUAL_TRANSFER",
      });
      await updateBookingPaymentStatus(booking.id, "PAID");

      // 2026-12-21 08:00:00 WITA (+08:00) -> 2026-12-21T00:00:00Z
      const testTimestamp = "2026-12-21T00:00:00Z";

      const res = await updateBookingCheckIn(booking.id, "CHECKED_IN", {
        ticketCode: `${booking.ticketCode}-01`,
        currentTimestamp: testTimestamp,
      });

      expect(res.checkedInQty).toBe(1);
      expect(res.checkInStatus).toBe("CHECKED_IN");
    });

    it("mengizinkan check-in pada pukul 09:30 WITA dan 10:00 WITA saat event berlangsung", async () => {
      const booking = await createEventBooking({
        eventId,
        guestName: "Live Attendee",
        guestEmail: "live@example.com",
        guestPhone: "08123456783",
        ticketCount: 2,
        paymentMethod: "MANUAL_TRANSFER",
      });
      await updateBookingPaymentStatus(booking.id, "PAID");

      // 2026-12-21 09:30:00 WITA -> 2026-12-21T01:30:00Z
      const res1 = await updateBookingCheckIn(booking.id, "CHECKED_IN", {
        ticketCode: `${booking.ticketCode}-01`,
        currentTimestamp: "2026-12-21T01:30:00Z",
      });
      expect(res1.checkedInQty).toBe(1);
      expect(res1.checkInStatus).toBe("PARTIALLY_CHECKED_IN");

      // 2026-12-21 10:00:00 WITA -> 2026-12-21T02:00:00Z
      const res2 = await updateBookingCheckIn(booking.id, "CHECKED_IN", {
        ticketCode: `${booking.ticketCode}-02`,
        currentTimestamp: "2026-12-21T02:00:00Z",
      });
      expect(res2.checkedInQty).toBe(2);
      expect(res2.checkInStatus).toBe("CHECKED_IN");
    });

    it("menolak check-in jika event berstatus REJECTED/CANCELLED", async () => {
      const booking = await createEventBooking({
        eventId,
        guestName: "Cancelled Event Attendee",
        guestEmail: "cancel@example.com",
        guestPhone: "08123456784",
        ticketCount: 1,
        paymentMethod: "MANUAL_TRANSFER",
      });
      await updateBookingPaymentStatus(booking.id, "PAID");

      // Update event status to REJECTED (simulates cancelled/archived)
      await updateEventStatus(eventId, "REJECTED");

      await expect(
        updateBookingCheckIn(booking.id, "CHECKED_IN", {
          ticketCode: `${booking.ticketCode}-01`,
          bypassWindow: true,
        })
      ).rejects.toThrow(/telah dibatalkan/i);
    });
  });
});
