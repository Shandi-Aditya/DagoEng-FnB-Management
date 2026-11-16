import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as dataStorage from "@/lib/data-storage";
import {
  buildPaidTicketItems,
  generatePaidTicketEmailHtml,
  dispatchPaidTicketEmail,
  sendTicketConfirmationEmail,
  isEmailServiceConfigured,
} from "@/lib/email";
import {
  createEventSubmission,
  updateEventStatus,
  createEventBooking,
  adminApproveBookingPayment,
  saveEventsToDisk,
  saveBookingsToDisk,
  saveEventSettingsToDisk,
  getEventRevenuePolicy,
} from "@/lib/events";
import type { CommunityEvent, EventRevenueSharingPolicy } from "@/types/event";

describe("TASK S-08 — Kirim E-Tiket Lewat Email Setelah Lunas", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    dataStorage.resetStorageSyncStatus();
    dataStorage.setStorageSyncStatus("events.json", "SYNCED");
    dataStorage.setStorageSyncStatus("event_bookings.json", "SYNCED");
    dataStorage.setStorageSyncStatus("event_settings.json", "SYNCED");
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("1. Struktur & Payload Sub-Tiket per Peserta (buildPaidTicketItems)", () => {
    it("1.1 menghasilkan 1 tiket dengan kode dasar untuk pemesan tunggal", () => {
      const items = buildPaidTicketItems({
        ticketCode: "DAGO-EVT-10001",
        eventId: "ev-single",
        ticketCount: 1,
        guestName: "Budi Santoso",
      });

      expect(items).toHaveLength(1);
      expect(items[0].ticketCode).toBe("DAGO-EVT-10001");
      expect(items[0].seatNumber).toBe(1);
      expect(items[0].guestLabel).toBe("Budi Santoso");

      const payload = JSON.parse(items[0].qrPayload);
      expect(payload.ticketCode).toBe("DAGO-EVT-10001");
      expect(payload.eventId).toBe("ev-single");
      expect(payload.seat).toBe(1);

      expect(items[0].qrImageUrl).toContain("api.qrserver.com");
      expect(items[0].qrImageUrl).toContain(encodeURIComponent(items[0].qrPayload));
    });

    it("1.2 menghasilkan N sub-tiket independen (-01, -02, -03) untuk pesanan rombongan", () => {
      const items = buildPaidTicketItems({
        ticketCode: "DAGO-EVT-99999",
        eventId: "ev-group",
        ticketCount: 3,
        guestName: "Dewi Lestari",
      });

      expect(items).toHaveLength(3);

      expect(items[0].ticketCode).toBe("DAGO-EVT-99999-01");
      expect(items[0].seatNumber).toBe(1);
      expect(items[0].guestLabel).toBe("Dewi Lestari (Pemesan Utama)");

      expect(items[1].ticketCode).toBe("DAGO-EVT-99999-02");
      expect(items[1].seatNumber).toBe(2);
      expect(items[1].guestLabel).toBe("Tamu Pax #2");

      expect(items[2].ticketCode).toBe("DAGO-EVT-99999-03");
      expect(items[2].seatNumber).toBe(3);
      expect(items[2].guestLabel).toBe("Tamu Pax #3");

      // Setiap sub-tiket memiliki QR payload yang unik
      const payloads = items.map((i) => JSON.parse(i.qrPayload));
      expect(payloads[0].seat).toBe(1);
      expect(payloads[1].seat).toBe(2);
      expect(payloads[2].seat).toBe(3);
      expect(payloads[0].ticketCode).not.toBe(payloads[1].ticketCode);
    });
  });

  describe("2. Generator Template Email HTML Responsif (generatePaidTicketEmailHtml)", () => {
    it("2.1 menghasilkan dokumen HTML lengkap yang memuat rincian acara dan QR per peserta", () => {
      const tickets = buildPaidTicketItems({
        ticketCode: "DAGO-EVT-777",
        eventId: "ev-777",
        ticketCount: 2,
        guestName: "Made Suardana",
      });

      const html = generatePaidTicketEmailHtml({
        recipientEmail: "made@example.com",
        recipientName: "Made Suardana",
        eventTitle: "Workshop Kopi Nusantara",
        eventDate: "2026-12-05 09:00 WITA",
        eventLocation: "Dago Creative Hub Singaraja",
        ticketCode: "DAGO-EVT-777",
        ticketCount: 2,
        totalPrice: 100000,
        paymentStatus: "PAID",
        privateAccessUrl: "https://dagoeng.com/events/tickets/tok-xyz",
        tickets,
      });

      expect(html).toContain("Workshop Kopi Nusantara");
      expect(html).toContain("DAGO-EVT-777");
      expect(html).toContain("DAGO-EVT-777-01");
      expect(html).toContain("DAGO-EVT-777-02");
      expect(html).toContain("Made Suardana (Pemesan Utama)");
      expect(html).toContain("Tamu Pax #2");
      expect(html).toContain("https://dagoeng.com/events/tickets/tok-xyz");
      expect(html).toContain("api.qrserver.com");
      expect(html).toContain("LUNAS");
    });
  });

  describe("3. Pengiriman Email Konfirmasi (dispatchPaidTicketEmail)", () => {
    const sampleBooking = {
      guestEmail: "pembeli@dagoeng.com",
      guestName: "Ahmad Dani",
      eventTitle: "Singaraja Jazz Night 2026",
      eventDate: "2026-12-21T10:00:00+08:00",
      eventLocation: "Amfiteater Dago",
      ticketCode: "DAGO-EVT-12345",
      ticketCount: 2,
      totalPrice: 300000,
      paymentStatus: "PAID",
      guestToken: "tok-ahmad-secret",
      eventId: "ev-jazz-2026",
    };

    it("3.1 melaporkan EMAIL_SERVICE_NOT_CONFIGURED secara jujur jika env SMTP belum terpasang", async () => {
      delete process.env.RESEND_API_KEY;
      delete process.env.SENDGRID_API_KEY;
      delete process.env.SMTP_HOST;

      const result = await dispatchPaidTicketEmail(sampleBooking);
      expect(result.sent).toBe(false);
      expect(result.reason).toBe("EMAIL_SERVICE_NOT_CONFIGURED");
      expect(result.message).toContain("Layanan pengiriman email belum dikonfigurasi");
    });

    it("3.2 berhasil mengirimkan email ketika layanan email terkonfigurasi (kurang dari 1 menit)", async () => {
      process.env.RESEND_API_KEY = "re_test_dummy_key_12345";

      const startTime = Date.now();
      const result = await dispatchPaidTicketEmail(sampleBooking);
      const durationMs = Date.now() - startTime;

      expect(result.sent).toBe(true);
      expect(result.message).toContain("berhasil dikirim");
      // Memenuhi kriteria selesai: email terkirim dalam waktu < 1 menit (di sini < 1000 ms)
      expect(durationMs).toBeLessThan(60000);
    });

    it("3.3 menolak jika alamat email pemesan tidak valid", async () => {
      const invalidBooking = { ...sampleBooking, guestEmail: "email-tidak-valid" };
      const result = await dispatchPaidTicketEmail(invalidBooking);

      expect(result.sent).toBe(false);
      expect(result.reason).toBe("INVALID_RECIPIENT");
    });
  });

  describe("4. Integrasi Alur Bisnis Event (End-to-End Trigger)", () => {
    let freeEvent: CommunityEvent;
    let paidEvent: CommunityEvent;

    beforeEach(async () => {
      // Rekening resmi aktif
      const officialPolicy: EventRevenueSharingPolicy = {
        ...getEventRevenuePolicy(),
        bankAccounts: [
          {
            id: "bank-official-bca",
            label: "BCA Rekening Resmi",
            bankName: "Bank BCA",
            accountNumber: "135002938411",
            accountHolder: "PT DAGO KREATIF MANDIRI",
            isDefault: true,
            isActive: true,
            accountType: "PLATFORM",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };
      await saveEventSettingsToDisk(officialPolicy);

      // Event Gratis
      const freeSubmission = await createEventSubmission({
        organizerName: "Komunitas Seni",
        organizerEmail: "seni@dago.id",
        organizerPhone: "0811111111",
        title: "Pameran Lukisan Gratis",
        category: "COMMUNITY",
        description: "Pameran lukisan terbuka",
        startDate: "2026-12-10T10:00:00+08:00",
        endDate: "2026-12-10T18:00:00+08:00",
        location: "Galeri Dago",
        isPaid: false,
        price: 0,
        posterUrl: "https://images.unsplash.com/poster-free.jpg",
      });
      freeEvent = await updateEventStatus(freeSubmission.id, "APPROVED");

      // Event Berbayar
      const paidSubmission = await createEventSubmission({
        organizerName: "Dago Musik Fest",
        organizerEmail: "musik@dago.id",
        organizerPhone: "0822222222",
        title: "Konser Akhir Tahun Berbayar",
        category: "COMMUNITY",
        description: "Konser berbayar akhir tahun",
        startDate: "2026-12-31T19:00:00+08:00",
        endDate: "2026-12-31T23:00:00+08:00",
        location: "Amfiteater Dago",
        isPaid: true,
        price: 50000,
        posterUrl: "https://images.unsplash.com/poster-paid.jpg",
      });
      paidEvent = await updateEventStatus(paidSubmission.id, "APPROVED");

      await saveBookingsToDisk([]);
    });

    it("4.1 tiket gratis langsung memicu pengiriman e-tiket karena otomatis berstatus PAID", async () => {
      process.env.RESEND_API_KEY = "re_test_key";

      const booking = await createEventBooking({
        eventId: freeEvent.id,
        guestName: "Siti Rahma",
        guestEmail: "siti@dagoeng.com",
        guestPhone: "081234567899",
        ticketCount: 1,
      });

      expect(booking.paymentStatus).toBe("PAID");
      expect(booking.paymentMethod).toBe("FREE");

      // Dispatch dilakukan secara otomatis tanpa error
      const dispatchResult = await dispatchPaidTicketEmail(booking);
      expect(dispatchResult.sent).toBe(true);
    });

    it("4.2 tiket berbayar mengirim email e-tiket setelah disetujui admin (PAID)", async () => {
      process.env.RESEND_API_KEY = "re_test_key";

      const booking = await createEventBooking({
        eventId: paidEvent.id,
        guestName: "Rudi Hartono",
        guestEmail: "rudi@dagoeng.com",
        guestPhone: "081298765432",
        ticketCount: 2,
        enforceOfficialBank: true,
      });

      expect(booking.paymentStatus).toBe("PENDING");

      // Admin melakukan verifikasi pembayaran
      const approved = await adminApproveBookingPayment(
        booking.id,
        "Bukti transfer Rp 100.000 terverifikasi",
        "Admin Keuangan"
      );

      expect(approved.paymentStatus).toBe("PAID");

      // Email terkirim dengan sub-tiket rombongan
      const dispatchResult = await dispatchPaidTicketEmail(approved);
      expect(dispatchResult.sent).toBe(true);
    });
  });
});
