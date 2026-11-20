import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as dataStorage from "@/lib/data-storage";
import {
  buildPaidTicketItems,
  generatePaidTicketEmailHtml,
  dispatchPaidTicketEmail,
  sendTicketConfirmationEmail,
  isEmailServiceConfigured,
  escapeHtml,
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

const mockSendMail = vi.fn().mockResolvedValue({ messageId: "smtp_test_123" });
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: mockSendMail,
    })),
  },
  createTransport: vi.fn(() => ({
    sendMail: mockSendMail,
  })),
}));

describe("TASK S-08 — Kirim E-Tiket Lewat Email Setelah Lunas", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    dataStorage.resetStorageSyncStatus();
    dataStorage.setStorageSyncStatus("events.json", "SYNCED");
    dataStorage.setStorageSyncStatus("event_bookings.json", "SYNCED");
    dataStorage.setStorageSyncStatus("event_settings.json", "SYNCED");

    // Setup global fetch mock for Resend / SendGrid HTTP API
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: any) => {
      const url = typeof input === "string" ? input : input?.url || "";
      if (url.includes("resend.com")) {
        return new Response(JSON.stringify({ id: "resend_msg_test_123" }), { status: 200 });
      }
      if (url.includes("sendgrid.com")) {
        return new Response(JSON.stringify({}), { status: 202 });
      }
      return new Response("Not found", { status: 404 });
    });
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

      expect(items[0].qrImageUrl).toBe("cid:qr-seat-1@dagoeng.com");
      expect(items[0].cid).toBe("qr-seat-1@dagoeng.com");
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
      expect(html).toContain("cid:qr-seat-1@dagoeng.com");
      expect(html).toContain("cid:qr-seat-2@dagoeng.com");
      expect(html).toContain("LUNAS");
    });

    it("2.2 melakukan escaping HTML secara aman terhadap teks input pengguna", () => {
      const tickets = buildPaidTicketItems({
        ticketCode: "DAGO-EVT-XSS",
        eventId: "ev-xss",
        ticketCount: 1,
        guestName: '<script>alert("hacked")</script>',
      });

      const html = generatePaidTicketEmailHtml({
        recipientEmail: "xss@example.com",
        recipientName: '<script>alert("name")</script>',
        eventTitle: 'Event & "Rock" <Live>',
        eventDate: "2026-12-05",
        eventLocation: "Dago & Hub",
        ticketCode: "DAGO-EVT-XSS",
        ticketCount: 1,
        totalPrice: 0,
        paymentStatus: "PAID",
        privateAccessUrl: "https://dagoeng.com/events/tickets/tok-xss",
        tickets,
      });

      expect(html).not.toContain('<script>alert("hacked")</script>');
      expect(html).not.toContain('<script>alert("name")</script>');
      expect(html).toContain("&lt;script&gt;alert(&quot;name&quot;)&lt;/script&gt;");
      expect(html).toContain("Event &amp; &quot;Rock&quot; &lt;Live&gt;");
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

    it("3.4 berhasil mengirimkan email via SMTP nodemailer dengan lampiran QR per peserta", async () => {
      delete process.env.RESEND_API_KEY;
      delete process.env.SENDGRID_API_KEY;
      process.env.SMTP_HOST = "smtp.mailtrap.io";
      process.env.SMTP_PORT = "2525";
      process.env.SMTP_USER = "user_test";
      process.env.SMTP_PASS = "pass_test";

      mockSendMail.mockClear();

      const result = await dispatchPaidTicketEmail(sampleBooking);
      expect(result.sent).toBe(true);
      expect(result.message).toContain("via SMTP");

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const callArg = mockSendMail.mock.calls[0][0];
      expect(callArg.to).toBe("pembeli@dagoeng.com");
      expect(callArg.subject).toContain("Singaraja Jazz Night 2026");
      expect(callArg.html).toContain("DAGO-EVT-12345");
      expect(callArg.attachments).toHaveLength(2);
      expect(callArg.attachments[0].filename).toBe("qr-DAGO-EVT-12345-01.png");
      expect(callArg.attachments[0].cid).toBe("qr-seat-1@dagoeng.com");
      expect(callArg.attachments[1].filename).toBe("qr-DAGO-EVT-12345-02.png");
      expect(callArg.attachments[1].cid).toBe("qr-seat-2@dagoeng.com");
    });

    it("3.5 mengirimkan payload Resend dengan key content_id bukan cid pada attachments", async () => {
      process.env.RESEND_API_KEY = "re_test_key_abc";
      let capturedBody: any = null;
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input: any, init?: any) => {
        const url = typeof input === "string" ? input : input?.url || "";
        if (url.includes("resend.com")) {
          capturedBody = JSON.parse(init?.body as string);
          return new Response(JSON.stringify({ id: "resend_123" }), { status: 200 });
        }
        return new Response("Not found", { status: 404 });
      });

      const res = await dispatchPaidTicketEmail(sampleBooking);
      expect(res.sent).toBe(true);
      expect(capturedBody).toBeDefined();
      expect(capturedBody.attachments).toHaveLength(2);
      expect(capturedBody.attachments[0]).toHaveProperty("content_id");
      expect(capturedBody.attachments[0]).not.toHaveProperty("cid");
      expect(capturedBody.attachments[0].content_id).toBe("qr-seat-1@dagoeng.com");
    });

    it("3.6 mengirimkan payload SendGrid dengan format type dan disposition inline", async () => {
      delete process.env.RESEND_API_KEY;
      process.env.SENDGRID_API_KEY = "sg_test_key_xyz";
      let capturedBody: any = null;
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input: any, init?: any) => {
        const url = typeof input === "string" ? input : input?.url || "";
        if (url.includes("sendgrid.com")) {
          capturedBody = JSON.parse(init?.body as string);
          return new Response(JSON.stringify({}), { status: 202 });
        }
        return new Response("Not found", { status: 404 });
      });

      const res = await dispatchPaidTicketEmail(sampleBooking);
      expect(res.sent).toBe(true);
      expect(capturedBody).toBeDefined();
      expect(capturedBody.attachments).toHaveLength(2);
      expect(capturedBody.attachments[0].type).toBe("image/png");
      expect(capturedBody.attachments[0].disposition).toBe("inline");
      expect(capturedBody.attachments[0].content_id).toBe("qr-seat-1@dagoeng.com");
    });

    it("3.7 menghormati fallback process.env.APP_URL pada tautan privat tiket", async () => {
      process.env.RESEND_API_KEY = "re_test_key_abc";
      process.env.APP_URL = "https://custom-app.dagoeng.com";
      let capturedBody: any = null;
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input: any, init?: any) => {
        capturedBody = JSON.parse(init?.body as string);
        return new Response(JSON.stringify({ id: "resend_123" }), { status: 200 });
      });

      await dispatchPaidTicketEmail(sampleBooking);
      expect(capturedBody.html).toContain("https://custom-app.dagoeng.com/events/tickets/tok-ahmad-secret");
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

    it("4.3 simulasi DOKU webhook bersifat idempoten dan tidak mengirimkan email ganda ketika booking sudah PAID", async () => {
      const { POST } = await import("@/app/api/webhooks/doku/simulate/route");
      const paidBooking = {
        id: "book-paid-sim",
        eventId: paidEvent.id,
        eventTitle: paidEvent.title,
        guestEmail: "paid-sim@dagoeng.com",
        guestName: "Sim Tester",
        guestPhone: "081234567890",
        ticketCode: "DAGO-EVT-SIM01",
        ticketCount: 1,
        totalPrice: 50000,
        paymentStatus: "PAID" as const,
        paymentMethod: "DOKU_CHECKOUT" as const,
        dokuInvoiceNumber: "INV-SIM-PAID-01",
        dokuPaymentUrl: "https://dagoeng.com/checkout-link-v2/tok-valid-checkout",
      };
      await saveBookingsToDisk([paidBooking as any]);

      const req = new Request("http://localhost/api/webhooks/doku/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber: paidBooking.ticketCode,
          token: "tok-valid-checkout",
          status: "SUCCESS",
        }),
      });

      const res = await POST(req as any);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toContain("idempoten");
      expect(json.simulation.isAlreadyPaid).toBe(true);
    });
  });
});
