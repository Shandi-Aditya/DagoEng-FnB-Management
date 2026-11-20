import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import * as dataStorage from "@/lib/data-storage";
import {
  createEventSubmission,
  updateEventStatus,
  createEventBooking,
  updateBookingPaymentProof,
  adminApproveBookingPayment,
  updateBookingCheckIn,
  getBookingById,
  saveEventsToDisk,
  saveBookingsToDisk,
  saveEventSettingsToDisk,
  getEventRevenuePolicy,
} from "@/lib/events";
import {
  parseTicketScanCode,
  validateTicketCheckIn,
  calculateCheckInStats,
} from "@/features/events-checkin";
import { GET as getTicketRoute } from "@/app/api/events/tickets/[token]/route";
import type { CommunityEvent, EventRevenueSharingPolicy, EventTicketOrder } from "@/types/event";

describe("TASK S-07 — End-to-End Paid Event Lifecycle Test Suite", () => {
  const originalEnv = process.env;
  let paidEvent: CommunityEvent;

  // Event schedule: 21 Dec 2026, 10:00 - 23:00 WITA (+08:00)
  // Check-in desk opens 2 hours before start: 21 Dec 2026, 08:00 WITA
  const eventStartDate = "2026-12-21T10:00:00+08:00";
  const eventEndDate = "2026-12-21T23:00:00+08:00";

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    dataStorage.resetStorageSyncStatus();
    dataStorage.setStorageSyncStatus("events.json", "SYNCED");
    dataStorage.setStorageSyncStatus("event_bookings.json", "SYNCED");
    dataStorage.setStorageSyncStatus("event_settings.json", "SYNCED");

    // 1. Configure Official Platform Bank Account (Task S-01 dependency)
    const officialPolicy: EventRevenueSharingPolicy = {
      ...getEventRevenuePolicy(),
      bankAccounts: [
        {
          id: "bank-official-dago-bca",
          label: "BCA Rekening Resmi Operasional",
          bankName: "Bank BCA",
          accountNumber: "135002938411",
          accountHolder: "PT DAGO KREATIF MANDIRI",
          branch: "KCU Dago Singaraja",
          isDefault: true,
          isActive: true,
          accountType: "PLATFORM",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };
    await saveEventSettingsToDisk(officialPolicy);

    // 2. Create Approved Paid Community Event
    const created = await createEventSubmission({
      organizerName: "Dago Creative Fest",
      organizerEmail: "fest@dagocreative.id",
      organizerPhone: "081234567890",
      title: "Singaraja Jazz Night 2026",
      category: "COMMUNITY",
      description: "Festival musik jazz tahunan di Singaraja Bali",
      startDate: eventStartDate,
      endDate: eventEndDate,
      location: "Amfiteater Dago Creative Hub",
      isPaid: true,
      price: 150000,
      posterUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",
    });

    paidEvent = await updateEventStatus(created.id, "APPROVED");
    await saveBookingsToDisk([]);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Tahap 1: Validasi Rekening Resmi (Official Bank Guard)", () => {
    it("1.1 menolak pemesanan tiket berbayar jika rekening platform menggunakan nomor demo/placeholder", async () => {
      // Set bank to demo placeholder
      const placeholderPolicy: EventRevenueSharingPolicy = {
        ...getEventRevenuePolicy(),
        bankAccounts: [
          {
            id: "bank-demo",
            label: "Akun Demo",
            bankName: "BCA Demo",
            accountNumber: "000011223344",
            accountHolder: "PT DAGO DEMO",
            isDefault: true,
            isActive: true,
            accountType: "PLATFORM",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };
      await saveEventSettingsToDisk(placeholderPolicy);

      await expect(
        createEventBooking({
          eventId: paidEvent.id,
          guestName: "Budi Santoso",
          guestEmail: "budi@example.com",
          guestPhone: "081234567890",
          ticketCount: 2,
          enforceOfficialBank: true,
        })
      ).rejects.toThrow(/PEMBAYARAN_TERKENDALA: Rekening bank penampung resmi Dago Creative Hub/);
    });

    it("1.2 mengizinkan pemesanan tiket berbayar saat rekening resmi valid terkonfigurasi", async () => {
      const booking = await createEventBooking({
        eventId: paidEvent.id,
        guestName: "Budi Santoso",
        guestEmail: "budi@example.com",
        guestPhone: "081234567890",
        ticketCount: 2,
        enforceOfficialBank: true,
      });

      expect(booking).toBeDefined();
      expect(booking.destinationBankSnapshot).toBeDefined();
      expect(booking.destinationBankSnapshot?.accountNumber).toBe("135002938411");
      expect(booking.destinationBankSnapshot?.accountHolder).toBe("PT DAGO KREATIF MANDIRI");
    });
  });

  describe("Tahap 2: Pemesanan Tiket Berbayar (Order Creation)", () => {
    it("2.1 membuat pesanan tiket dengan status PENDING, harga akurat, dan snapshot rekening", async () => {
      const booking = await createEventBooking({
        eventId: paidEvent.id,
        guestName: "Budi Santoso",
        guestEmail: "budi@example.com",
        guestPhone: "081234567890",
        ticketCount: 2,
        enforceOfficialBank: true,
      });

      expect(booking.paymentStatus).toBe("PENDING");
      expect(booking.paymentMethod).toBe("MANUAL_TRANSFER");
      expect(booking.unitPrice).toBe(150000);
      expect(booking.totalPrice).toBe(300000);
      expect(booking.ticketCount).toBe(2);
      expect(booking.checkInStatus).toBe("REGISTERED");
      expect(booking.checkedInQty).toBe(0);
      expect(booking.ticketCode).toMatch(/^DAGO-EVT-/);
      expect(booking.guestToken).toBeTruthy();
    });
  });

  describe("Tahap 3: Unggah Bukti Pembayaran (Payment Proof Upload)", () => {
    it("3.1 peserta berhasil mengunggah bukti transfer sah", async () => {
      const booking = await createEventBooking({
        eventId: paidEvent.id,
        guestName: "Budi Santoso",
        guestEmail: "budi@example.com",
        guestPhone: "081234567890",
        ticketCount: 2,
        enforceOfficialBank: true,
      });

      const updated = await updateBookingPaymentProof(booking.id, {
        paymentProofUrl: "https://images.unsplash.com/photo-proof-transfer-sample.jpg",
        paymentProofNote: "Transfer dari rekening BCA an Budi Santoso nominal Rp 300.000",
      });

      expect(updated.paymentProofUrl).toBe("https://images.unsplash.com/photo-proof-transfer-sample.jpg");
      expect(updated.paymentProofNote).toContain("Budi Santoso");
      expect(updated.paymentProofUploadedAt).toBeDefined();
      expect(updated.paymentStatus).toBe("PENDING"); // Masih menunggu verifikasi admin
    });

    it("3.2 menolak unggah bukti pembayaran dengan URL kosong", async () => {
      const booking = await createEventBooking({
        eventId: paidEvent.id,
        guestName: "Siti Rahma",
        guestEmail: "siti@example.com",
        guestPhone: "081234567891",
        ticketCount: 1,
        enforceOfficialBank: true,
      });

      await expect(
        updateBookingPaymentProof(booking.id, {
          paymentProofUrl: "   ",
        })
      ).rejects.toThrow(/URL atau data bukti transfer tidak valid/);
    });
  });

  describe("Tahap 4: Verifikasi & Persetujuan Admin (Admin Approval)", () => {
    it("4.1 admin menyetujui pembayaran dan mengaktifkan status PAID", async () => {
      const booking = await createEventBooking({
        eventId: paidEvent.id,
        guestName: "Budi Santoso",
        guestEmail: "budi@example.com",
        guestPhone: "081234567890",
        ticketCount: 2,
        enforceOfficialBank: true,
      });

      await updateBookingPaymentProof(booking.id, {
        paymentProofUrl: "https://images.unsplash.com/photo-proof.jpg",
        paymentProofNote: "Transfer BCA Rp 300.000",
      });

      const approved = await adminApproveBookingPayment(
        booking.id,
        "Dana Rp 300.000 terverifikasi masuk ke rekening resmi BCA PT Dago Kreatif Mandiri",
        "Admin Keuangan Dago"
      );

      expect(approved.paymentStatus).toBe("PAID");
      expect(approved.paymentVerificationNote).toContain("terverifikasi masuk");
      expect(approved.paymentVerifiedBy).toBe("Admin Keuangan Dago");
      expect(approved.paymentVerifiedAt).toBeDefined();
    });

    it("4.2 idempotent: persetujuan ulang oleh admin tidak menimbulkan error atau status korup", async () => {
      const booking = await createEventBooking({
        eventId: paidEvent.id,
        guestName: "Budi Santoso",
        guestEmail: "budi@example.com",
        guestPhone: "081234567890",
        ticketCount: 1,
        enforceOfficialBank: true,
      });

      await adminApproveBookingPayment(booking.id, "Verifikasi 1", "Admin");
      const secondApproval = await adminApproveBookingPayment(booking.id, "Verifikasi 2", "Admin");

      expect(secondApproval.paymentStatus).toBe("PAID");
    });
  });

  describe("Tahap 5: Aktivasi E-Tiket & Struktur Sub-Tiket Rombongan", () => {
    it("5.1 e-tiket terverifikasi dapat diuraikan kodenya dan terbagi menjadi sub-tiket independen (-01 dan -02)", async () => {
      const booking = await createEventBooking({
        eventId: paidEvent.id,
        guestName: "Budi Santoso",
        guestEmail: "budi@example.com",
        guestPhone: "081234567890",
        ticketCount: 2,
        enforceOfficialBank: true,
      });

      const approvedBooking = await adminApproveBookingPayment(booking.id, "Approved", "Admin");

      const code01 = `${booking.ticketCode}-01`;
      const code02 = `${booking.ticketCode}-02`;

      const parsed01 = parseTicketScanCode(code01);
      const parsed02 = parseTicketScanCode(code02);

      expect(parsed01.baseCode).toBe(booking.ticketCode);
      expect(parsed01.seatNumber).toBe(1);

      expect(parsed02.baseCode).toBe(booking.ticketCode);
      expect(parsed02.seatNumber).toBe(2);

      // Validasi awal tiket PAID siap digunakan
      const validation = validateTicketCheckIn(approvedBooking, paidEvent.id, 1);
      expect(validation.valid).toBe(true);
      expect(validation.targetStatus).toBe("PARTIALLY_CHECKED_IN");
    });

    it("5.2 tiket yang belum lunas (PENDING) ditolak untuk check-in", async () => {
      const unpaidBooking = await createEventBooking({
        eventId: paidEvent.id,
        guestName: "Unpaid Guest",
        guestEmail: "unpaid@example.com",
        guestPhone: "081234567892",
        ticketCount: 1,
        enforceOfficialBank: true,
      });

      const validation = validateTicketCheckIn(unpaidBooking, paidEvent.id, 1);
      expect(validation.valid).toBe(false);
      expect(validation.code).toBe("UNPAID");
    });
  });

  describe("Tahap 6: Check-in di Hari Acara (WITA Window Enforcement)", () => {
    it("6.1 menolak check-in jika dilakukan sebelum jendela 2 jam buka (mis. 20 Des 2026)", async () => {
      const booking = await createEventBooking({
        eventId: paidEvent.id,
        guestName: "Budi Santoso",
        guestEmail: "budi@example.com",
        guestPhone: "081234567890",
        ticketCount: 2,
        enforceOfficialBank: true,
      });
      await adminApproveBookingPayment(booking.id, "Approved", "Admin");

      // Timestamp simulasi: 20 Des 2026 10:00 WITA (sehari sebelum acara)
      const earlyTimestamp = "2026-12-20T02:00:00.000Z";

      await expect(
        updateBookingCheckIn(booking.id, "CHECKED_IN", {
          ticketCode: `${booking.ticketCode}-01`,
          seatNumber: 1,
          currentTimestamp: earlyTimestamp,
          enforceDateWindow: true,
        })
      ).rejects.toThrow(/Meja check-in belum dibuka/);
    });

    it("6.2 mengizinkan check-in sub-tiket -01 pada jam operasional hari acara (21 Des 2026 09:30 WITA)", async () => {
      const booking = await createEventBooking({
        eventId: paidEvent.id,
        guestName: "Budi Santoso",
        guestEmail: "budi@example.com",
        guestPhone: "081234567890",
        ticketCount: 2,
        enforceOfficialBank: true,
      });
      await adminApproveBookingPayment(booking.id, "Approved", "Admin");

      // Timestamp simulasi: 21 Des 2026 09:30 WITA (+08:00) -> 01:30 UTC
      const operationalTimestamp = "2026-12-21T01:30:00.000Z";

      const checkInRes = await updateBookingCheckIn(booking.id, "PARTIALLY_CHECKED_IN", {
        ticketCode: `${booking.ticketCode}-01`,
        seatNumber: 1,
        incrementQty: 1,
        currentTimestamp: operationalTimestamp,
        enforceDateWindow: true,
      });

      expect(checkInRes.checkedInQty).toBe(1);
      expect(checkInRes.checkedInSeats).toEqual([1]);
      expect(checkInRes.checkInStatus).toBe("PARTIALLY_CHECKED_IN");

      // Verifikasi pembacaan ulang data
      const reloaded = await getBookingById(booking.id);
      expect(reloaded?.checkedInQty).toBe(1);
      expect(reloaded?.checkedInSeats).toContain(1);
    });
  });

  describe("Tahap 7: Pencegahan Pemindaian Duplikat (Duplicate Scan Guard)", () => {
    it("7.1 menolak scan ulang sub-tiket -01 yang sudah hadir dan menjaga total kehadiran tetap 1", async () => {
      const booking = await createEventBooking({
        eventId: paidEvent.id,
        guestName: "Budi Santoso",
        guestEmail: "budi@example.com",
        guestPhone: "081234567890",
        ticketCount: 2,
        enforceOfficialBank: true,
      });
      await adminApproveBookingPayment(booking.id, "Approved", "Admin");

      const operationalTimestamp = "2026-12-21T01:30:00.000Z";
      const code01 = `${booking.ticketCode}-01`;

      // Scan -01 pertama: BERHASIL
      await updateBookingCheckIn(booking.id, "PARTIALLY_CHECKED_IN", {
        ticketCode: code01,
        seatNumber: 1,
        incrementQty: 1,
        currentTimestamp: operationalTimestamp,
        enforceDateWindow: true,
      });

      // Scan -01 kedua: HARUS DITOLAK
      await expect(
        updateBookingCheckIn(booking.id, "PARTIALLY_CHECKED_IN", {
          ticketCode: code01,
          seatNumber: 1,
          incrementQty: 1,
          currentTimestamp: operationalTimestamp,
          enforceDateWindow: true,
        })
      ).rejects.toThrow(/sudah digunakan untuk check-in sebelumnya/);

      // Verifikasi kehadiran tidak bertambah
      const verified = await getBookingById(booking.id);
      expect(verified?.checkedInQty).toBe(1);
      expect(verified?.checkedInSeats).toEqual([1]);
    });

    it("7.2 scan sub-tiket -02 berhasil dan melengkapi kehadiran rombongan menjadi 2/2 (CHECKED_IN)", async () => {
      const booking = await createEventBooking({
        eventId: paidEvent.id,
        guestName: "Budi Santoso",
        guestEmail: "budi@example.com",
        guestPhone: "081234567890",
        ticketCount: 2,
        enforceOfficialBank: true,
      });
      await adminApproveBookingPayment(booking.id, "Approved", "Admin");

      const operationalTimestamp = "2026-12-21T01:30:00.000Z";
      const code01 = `${booking.ticketCode}-01`;
      const code02 = `${booking.ticketCode}-02`;

      // Scan -01
      await updateBookingCheckIn(booking.id, "PARTIALLY_CHECKED_IN", {
        ticketCode: code01,
        seatNumber: 1,
        incrementQty: 1,
        currentTimestamp: operationalTimestamp,
        enforceDateWindow: true,
      });

      // Scan -02
      const finalRes = await updateBookingCheckIn(booking.id, "CHECKED_IN", {
        ticketCode: code02,
        seatNumber: 2,
        incrementQty: 1,
        currentTimestamp: operationalTimestamp,
        enforceDateWindow: true,
      });

      expect(finalRes.checkedInQty).toBe(2);
      expect(finalRes.ticketCount).toBe(2);
      expect(finalRes.checkedInSeats).toEqual(expect.arrayContaining([1, 2]));
      expect(finalRes.checkInStatus).toBe("CHECKED_IN");

      // Verifikasi kalkulasi statistik check-in
      const stats = calculateCheckInStats([finalRes]);
      expect(stats.totalTickets).toBe(2);
      expect(stats.checkedInCount).toBe(2);
      expect(stats.remainingCount).toBe(0);
      expect(stats.percentage).toBe(100);
      expect(stats.checkedOrders).toBe(1);

      // Scan -02 sekali lagi: DITOLAK
      await expect(
        updateBookingCheckIn(booking.id, "CHECKED_IN", {
          ticketCode: code02,
          seatNumber: 2,
          incrementQty: 1,
          currentTimestamp: operationalTimestamp,
          enforceDateWindow: true,
        })
      ).rejects.toThrow(/sudah digunakan untuk check-in sebelumnya/);
    });
  });

  describe("Tahap 8: Pengujian Lapisan Route Tiket & Regresi Error Scanner", () => {
    it("8.1 route GET /api/events/tickets/[token] mengembalikan seatCheckInTimes, paymentRejectionReason, tier, dan snapshot bank resmi", async () => {
      const booking = await createEventBooking({
        eventId: paidEvent.id,
        guestName: "Dewi Lestari",
        guestEmail: "dewi@example.com",
        guestPhone: "081298765432",
        ticketCount: 2,
        enforceOfficialBank: true,
      });

      // Simulasikan persetujuan pembayaran dan check-in parsial kursi 1
      await adminApproveBookingPayment(booking.id, "Disetujui admin", "Admin");
      const operationalTimestamp = "2026-12-21T01:30:00.000Z";
      await updateBookingCheckIn(booking.id, "PARTIALLY_CHECKED_IN", {
        ticketCode: `${booking.ticketCode}-01`,
        seatNumber: 1,
        incrementQty: 1,
        currentTimestamp: operationalTimestamp,
        enforceDateWindow: true,
      });

      const req = new NextRequest(`http://localhost:3000/api/events/tickets/${booking.guestToken}`);
      const res = await getTicketRoute(req, {
        params: Promise.resolve({ token: booking.guestToken }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(booking.id);
      expect(json.data.ticketCode).toBe(booking.ticketCode);
      expect(json.data.guestName).toBe("Dewi Lestari");
      expect(json.data.checkInStatus).toBe("PARTIALLY_CHECKED_IN");
      expect(json.data.checkedInSeats).toEqual([1]);
      expect(json.data.seatCheckInTimes).toBeDefined();
      expect(typeof json.data.seatCheckInTimes["1"]).toBe("string");
      expect(json.data.destinationBankSnapshot).toBeDefined();
      expect(json.data.destinationBankSnapshot?.bankName).toContain("BCA");
      expect(json.data.destinationBankSnapshot?.accountNumber).toBe("135002938411");
    });

    it("8.2 route GET /api/events/tickets/[token] menolak token < 16 karakter dengan 400 dan token fiktif dengan 404", async () => {
      // Token terlalu pendek
      const shortReq = new NextRequest("http://localhost:3000/api/events/tickets/short-token");
      const shortRes = await getTicketRoute(shortReq, {
        params: Promise.resolve({ token: "short-token" }),
      });
      expect(shortRes.status).toBe(400);
      const shortJson = await shortRes.json();
      expect(shortJson.success).toBe(false);
      expect(shortJson.error).toContain("Format token akses tiket tidak valid");

      // Token fiktif 32 karakter
      const notFoundReq = new NextRequest(
        "http://localhost:3000/api/events/tickets/fictionaltoken1234567890abcdef"
      );
      const notFoundRes = await getTicketRoute(notFoundReq, {
        params: Promise.resolve({ token: "fictionaltoken1234567890abcdef" }),
      });
      expect(notFoundRes.status).toBe(404);
      const notFoundJson = await notFoundRes.json();
      expect(notFoundJson.success).toBe(false);
      expect(notFoundJson.error).toContain("Tiket tidak ditemukan");
    });

    it("8.3 scanner check-in melempar error penolakan saat tiket duplikat dan melindungi state kehadiran rombongan", async () => {
      const booking = await createEventBooking({
        eventId: paidEvent.id,
        guestName: "Rudi Hartono",
        guestEmail: "rudi@example.com",
        guestPhone: "081234567891",
        ticketCount: 2,
        enforceOfficialBank: true,
      });
      await adminApproveBookingPayment(booking.id, "Approved", "Admin");

      const operationalTimestamp = "2026-12-21T01:30:00.000Z";
      const code01 = `${booking.ticketCode}-01`;

      // Scan pertama berhasil
      const firstScan = await updateBookingCheckIn(booking.id, "PARTIALLY_CHECKED_IN", {
        ticketCode: code01,
        seatNumber: 1,
        incrementQty: 1,
        currentTimestamp: operationalTimestamp,
        enforceDateWindow: true,
      });
      expect(firstScan.checkedInQty).toBe(1);

      // Scan kedua pada sub-tiket yang sama harus melempar error penolakan (re-thrown exception)
      let thrownError: Error | null = null;
      try {
        await updateBookingCheckIn(booking.id, "PARTIALLY_CHECKED_IN", {
          ticketCode: code01,
          seatNumber: 1,
          incrementQty: 1,
          currentTimestamp: operationalTimestamp,
          enforceDateWindow: true,
        });
      } catch (err) {
        thrownError = err as Error;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError?.message).toMatch(/sudah digunakan untuk check-in sebelumnya/);

      // Verifikasi state booking di database tidak terkorupsi setelah penolakan
      const freshBooking = await getBookingById(booking.id);
      expect(freshBooking?.checkedInQty).toBe(1);
      expect(freshBooking?.checkedInSeats).toEqual([1]);
      expect(freshBooking?.checkInStatus).toBe("PARTIALLY_CHECKED_IN");
    });

    it("8.4 validator scanner membedakan tiket salah event dan tiket yang dibatalkan", async () => {
      const booking = await createEventBooking({
        eventId: paidEvent.id,
        guestName: "Siti Rahma",
        guestEmail: "siti@example.com",
        guestPhone: "081234567892",
        ticketCount: 1,
        enforceOfficialBank: true,
      });

      // Validasi untuk event lain (ID berbeda)
      const wrongEventValidation = validateTicketCheckIn(booking, "other-event-id-999");
      expect(wrongEventValidation.valid).toBe(false);
      expect(wrongEventValidation.message).toMatch(/bukan event ini/);

      // Simulasikan tiket berstatus CANCELLED
      const cancelledBooking: EventTicketOrder = {
        ...booking,
        paymentStatus: "CANCELLED",
      };
      const cancelledValidation = validateTicketCheckIn(cancelledBooking, paidEvent.id);
      expect(cancelledValidation.valid).toBe(false);
      expect(cancelledValidation.message).toMatch(/CANCELLED/);
    });
  });
});
