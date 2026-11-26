import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import {
  generateTierSeats,
  getEventOccupiedSeats,
  validateSeatSelection,
  formatSeatsList,
} from "@/lib/event-seating";
import { validateEventTicketTiers } from "@/lib/event-validation";
import {
  createEventSubmission,
  updateEventDetails,
  updateEventStatus,
  createEventBooking,
  createInvitationTicket,
  getPublicEventById,
  updateBookingPaymentStatus,
  requestTicketRefund,
  adminProcessTicketRefund,
  loadBookingsFromDisk,
  saveBookingsToDisk,
} from "@/lib/events";
import * as dokuModule from "@/lib/doku";
import { POST as handleBookPost } from "@/app/api/events/[id]/book/route";
import type { EventTicketOrder, EventTicketTier } from "@/types/event";

describe("Task S-43: Logika Denah Kursi Event (Event Seating)", () => {
  describe("generateTierSeats", () => {
    it("menghasilkan daftar nomor kursi terurut untuk single row (contoh VIP A1-A10)", () => {
      const tier: EventTicketTier = {
        id: "tier-vip",
        name: "VIP",
        price: 150000,
        quota: 10,
        rowPrefix: "A",
        totalRows: 1,
        seatsPerRow: 10,
      };

      const seats = generateTierSeats(tier);
      expect(seats).toEqual([
        "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10"
      ]);
      expect(seats).toHaveLength(10);
    });

    it("menghasilkan multi-baris bila totalRows > 1 (contoh Reguler B1-B5 dan C1-C5)", () => {
      const tier: EventTicketTier = {
        id: "tier-reguler",
        name: "Reguler",
        price: 50000,
        quota: 10,
        rowPrefix: "B",
        totalRows: 2,
        seatsPerRow: 5,
      };

      const seats = generateTierSeats(tier);
      expect(seats).toEqual([
        "B1", "B2", "B3", "B4", "B5",
        "C1", "C2", "C3", "C4", "C5"
      ]);
      expect(seats).toHaveLength(10);
    });

    it("menghasilkan fallback otomatis jika rowPrefix tidak diisi", () => {
      const tier: EventTicketTier = {
        id: "tier-general",
        name: "General",
        price: 0,
        quota: 4,
      };

      const seats = generateTierSeats(tier);
      expect(seats).toEqual(["K1", "K2", "K3", "K4"]);
    });

    it("menghasilkan kode kursi yang benar untuk multi-karakter rowPrefix (1 baris dan >1 baris)", () => {
      const singleRowVip = generateTierSeats({
        rowPrefix: "VIP",
        totalRows: 1,
        seatsPerRow: 5,
        quota: 5,
      });
      expect(singleRowVip).toEqual(["VIP1", "VIP2", "VIP3", "VIP4", "VIP5"]);

      const multiRowVip = generateTierSeats({
        rowPrefix: "VIP",
        totalRows: 2,
        seatsPerRow: 3,
        quota: 6,
      });
      expect(multiRowVip).toEqual([
        "VIP-A1", "VIP-A2", "VIP-A3",
        "VIP-B1", "VIP-B2", "VIP-B3",
      ]);
    });
  });

  describe("getEventOccupiedSeats", () => {
    const mockBookings: EventTicketOrder[] = [
      {
        id: "ord-1",
        ticketCode: "DAGO-EVT-001",
        eventId: "evt-101",
        eventTitle: "Konser Musik Dago",
        eventDate: "2026-12-20T18:00:00Z",
        eventLocation: "Amphitheater",
        guestName: "Budi Santoso",
        guestEmail: "budi@example.com",
        guestPhone: "08123456789",
        ticketCount: 2,
        selectedSeats: ["A1", "A2"],
        unitPrice: 100000,
        totalPrice: 200000,
        platformFeePercent: 20,
        platformFeeAmount: 40000,
        organizerRevenueAmount: 160000,
        paymentMethod: "QRIS",
        paymentStatus: "PAID",
        checkInStatus: "REGISTERED",
        createdAt: "2026-11-20T10:00:00Z",
        updatedAt: "2026-11-20T10:00:00Z",
      },
      {
        id: "ord-2",
        ticketCode: "DAGO-EVT-002",
        eventId: "evt-101",
        eventTitle: "Konser Musik Dago",
        eventDate: "2026-12-20T18:00:00Z",
        eventLocation: "Amphitheater",
        guestName: "Siti Rahma",
        guestEmail: "siti@example.com",
        guestPhone: "08123456780",
        ticketCount: 1,
        selectedSeats: ["A3"],
        unitPrice: 100000,
        totalPrice: 100000,
        platformFeePercent: 20,
        platformFeeAmount: 20000,
        organizerRevenueAmount: 80000,
        paymentMethod: "TRANSFER",
        paymentStatus: "PENDING",
        checkInStatus: "REGISTERED",
        createdAt: "2026-11-20T10:05:00Z",
        updatedAt: "2026-11-20T10:05:00Z",
      },
      {
        id: "ord-3",
        ticketCode: "DAGO-EVT-003",
        eventId: "evt-101",
        eventTitle: "Konser Musik Dago",
        eventDate: "2026-12-20T18:00:00Z",
        eventLocation: "Amphitheater",
        guestName: "Rian Pratama",
        guestEmail: "rian@example.com",
        guestPhone: "08123456781",
        ticketCount: 1,
        selectedSeats: ["A4"],
        unitPrice: 100000,
        totalPrice: 100000,
        platformFeePercent: 20,
        platformFeeAmount: 20000,
        organizerRevenueAmount: 80000,
        paymentMethod: "QRIS",
        paymentStatus: "CANCELLED", // BATAL: Kursi A4 harus dibebaskan
        checkInStatus: "REGISTERED",
        createdAt: "2026-11-20T09:00:00Z",
        updatedAt: "2026-11-20T09:30:00Z",
      },
      {
        id: "ord-4",
        ticketCode: "DAGO-EVT-004",
        eventId: "evt-101",
        eventTitle: "Konser Musik Dago",
        eventDate: "2026-12-20T18:00:00Z",
        eventLocation: "Amphitheater",
        guestName: "Dewi Lestari",
        guestEmail: "dewi@example.com",
        guestPhone: "08123456782",
        ticketCount: 1,
        selectedSeats: ["A5"],
        unitPrice: 100000,
        totalPrice: 100000,
        platformFeePercent: 20,
        platformFeeAmount: 20000,
        organizerRevenueAmount: 80000,
        paymentMethod: "QRIS",
        paymentStatus: "PAID",
        refundStatus: "APPROVED", // REFUND DISETUJUI: Kursi A5 harus dibebaskan
        checkInStatus: "REGISTERED",
        createdAt: "2026-11-20T08:00:00Z",
        updatedAt: "2026-11-20T08:45:00Z",
      },
      {
        id: "ord-5",
        ticketCode: "DAGO-EVT-005",
        eventId: "evt-102", // Event berbeda
        eventTitle: "Workshop Barista",
        eventDate: "2026-12-21T10:00:00Z",
        eventLocation: "Barista Lab",
        guestName: "Agus Santoso",
        guestEmail: "agus@example.com",
        guestPhone: "08123456783",
        ticketCount: 1,
        selectedSeats: ["A1"], // Kursi A1 di event berbeda tidak boleh bentrok
        unitPrice: 50000,
        totalPrice: 50000,
        platformFeePercent: 20,
        platformFeeAmount: 10000,
        organizerRevenueAmount: 40000,
        paymentMethod: "QRIS",
        paymentStatus: "PAID",
        checkInStatus: "REGISTERED",
        createdAt: "2026-11-20T11:00:00Z",
        updatedAt: "2026-11-20T11:00:00Z",
      },
    ];

    it("mengumpulkan kursi terisi hanya dari event yang sesuai dan mengecualikan CANCELLED / APPROVED refund", () => {
      const occupied = getEventOccupiedSeats("evt-101", mockBookings, Date.parse("2026-11-20T10:30:00Z"));
      expect(occupied.has("A1")).toBe(true);
      expect(occupied.has("A2")).toBe(true);
      expect(occupied.has("A3")).toBe(true);
      // Kursi A4 dari tiket CANCELLED harus tersedia kembali
      expect(occupied.has("A4")).toBe(false);
      // Kursi A5 dari tiket refund APPROVED harus tersedia kembali
      expect(occupied.has("A5")).toBe(false);
      expect(occupied.size).toBe(3);
    });

    it("mengabaikan booking PENDING yang sudah melewati expiresAt", () => {
      const nowMs = Date.parse("2026-11-20T12:00:00Z");
      const expiredPending: EventTicketOrder = {
        ...mockBookings[1],
        id: "ord-expired-pending",
        selectedSeats: ["A9"],
        expiresAt: "2026-11-20T11:30:00Z",
      };
      const activePending: EventTicketOrder = {
        ...mockBookings[1],
        id: "ord-active-pending",
        selectedSeats: ["A10"],
        expiresAt: "2026-11-20T12:30:00Z",
      };

      const occupied = getEventOccupiedSeats("evt-101", [expiredPending, activePending], nowMs);
      expect(occupied.has("A9")).toBe(false);
      expect(occupied.has("A10")).toBe(true);
    });
  });

  describe("validateSeatSelection", () => {
    const tierSeats = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10"];
    const occupiedSeats = new Set(["A1", "A2", "A3"]);

    it("berhasil jika event tidak memakai denah kursi (kompatibilitas mundur)", () => {
      const result = validateSeatSelection({
        hasSeatingChart: false,
        selectedSeats: undefined,
        ticketCount: 2,
        tierSeats,
        occupiedSeats,
      });

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("menolak jika pembeli belum memilih kursi pada event dengan nomor kursi", () => {
      const result = validateSeatSelection({
        hasSeatingChart: true,
        selectedSeats: [],
        ticketCount: 2,
        tierSeats,
        occupiedSeats,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Silakan pilih nomor kursi");
    });

    it("menolak jika jumlah kursi tidak sesuai dengan ticketCount", () => {
      const result = validateSeatSelection({
        hasSeatingChart: true,
        selectedSeats: ["A4"],
        ticketCount: 2,
        tierSeats,
        occupiedSeats,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("harus sama dengan jumlah tiket (2)");
    });

    it("menolak jika terdapat duplikasi kursi dalam pilihan pemesan", () => {
      const result = validateSeatSelection({
        hasSeatingChart: true,
        selectedSeats: ["A4", "A4"],
        ticketCount: 2,
        tierSeats,
        occupiedSeats,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("duplikasi");
    });

    it("menolak jika kursi yang dipilih sudah ditempati pembeli lain", () => {
      const result = validateSeatSelection({
        hasSeatingChart: true,
        selectedSeats: ["A3", "A4"],
        ticketCount: 2,
        tierSeats,
        occupiedSeats,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("sudah dipesan atau tidak tersedia");
      expect(result.error).toContain("A3");
    });

    it("menolak jika kursi yang dipilih di luar denah tier yang valid", () => {
      const result = validateSeatSelection({
        hasSeatingChart: true,
        selectedSeats: ["Z99"],
        ticketCount: 1,
        tierSeats,
        occupiedSeats,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("tidak valid");
    });

    it("berhasil jika seluruh kursi yang dipilih valid, tersedia, dan jumlahnya cocok", () => {
      const result = validateSeatSelection({
        hasSeatingChart: true,
        selectedSeats: ["A4", "A5"],
        ticketCount: 2,
        tierSeats,
        occupiedSeats,
      });

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("menolak nilai non-string atau string kosong tanpa crash TypeError", () => {
      const resNonString = validateSeatSelection({
        hasSeatingChart: true,
        selectedSeats: [123 as unknown as string],
        ticketCount: 1,
        tierSeats,
        occupiedSeats,
      });
      expect(resNonString.valid).toBe(false);
      expect(resNonString.error).toContain("tidak valid");

      const resEmpty = validateSeatSelection({
        hasSeatingChart: true,
        selectedSeats: ["   "],
        ticketCount: 1,
        tierSeats,
        occupiedSeats,
      });
      expect(resEmpty.valid).toBe(false);
    });
  });

  describe("formatSeatsList", () => {
    it("memformat array kursi menjadi string terpisah koma", () => {
      expect(formatSeatsList(["A1", "A2"])).toBe("A1, A2");
      expect(formatSeatsList(["VIP-01"])).toBe("VIP-01");
      expect(formatSeatsList([])).toBe("—");
      expect(formatSeatsList(undefined)).toBe("—");
    });
  });

  describe("Simulasi Perlindungan Race Condition di Database Lock", () => {
    it("dua pembeli memilih kursi yang sama: hanya satu berhasil dan pembeli kedua ditolak", () => {
      const activeBookings: EventTicketOrder[] = [];
      const eventId = "evt-race-1";
      const tierSeats = ["A1", "A2", "A3"];

      // Fungsi checkout yang mensimulasikan lock database
      function attemptBooking(buyerName: string, chosenSeats: string[]): { success: boolean; error?: string } {
        const occupied = getEventOccupiedSeats(eventId, activeBookings);
        const validation = validateSeatSelection({
          hasSeatingChart: true,
          selectedSeats: chosenSeats,
          ticketCount: chosenSeats.length,
          tierSeats,
          occupiedSeats: occupied,
        });

        if (!validation.valid) {
          return { success: false, error: validation.error };
        }

        // Simpan booking ke activeBookings di dalam lock
        activeBookings.push({
          id: `tkt-${Date.now()}-${buyerName}`,
          ticketCode: `DAGO-EVT-${buyerName.toUpperCase()}`,
          eventId,
          eventTitle: "Simulasi Race Condition",
          eventDate: "2026-12-25T10:00:00Z",
          eventLocation: "Main Hall",
          guestName: buyerName,
          guestEmail: `${buyerName.toLowerCase()}@example.com`,
          guestPhone: "08123456789",
          ticketCount: chosenSeats.length,
          selectedSeats: chosenSeats,
          unitPrice: 50000,
          totalPrice: 50000 * chosenSeats.length,
          platformFeePercent: 20,
          platformFeeAmount: 10000,
          organizerRevenueAmount: 40000,
          paymentMethod: "QRIS",
          paymentStatus: "PENDING",
          checkInStatus: "REGISTERED",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        return { success: true };
      }

      // Pembeli 1 mencoba memesan kursi A1
      const res1 = attemptBooking("PembeliSatu", ["A1"]);
      expect(res1.success).toBe(true);

      // Pembeli 2 mencoba memesan kursi A1 yang sama hampir bersamaan
      const res2 = attemptBooking("PembeliDua", ["A1"]);
      expect(res2.success).toBe(false);
      expect(res2.error).toContain("Kursi [A1] sudah dipesan atau tidak tersedia");

      // Pembeli 2 memilih kursi lain A2 -> Berhasil
      const res2Retry = attemptBooking("PembeliDua", ["A2"]);
      expect(res2Retry.success).toBe(true);
    });

    it("pembatalan tiket otomatis membebaskan kursi untuk pembeli lain", () => {
      const eventId = "evt-cancel-test";
      const tierSeats = ["B1", "B2"];
      const activeBookings: EventTicketOrder[] = [
        {
          id: "tkt-b1",
          ticketCode: "DAGO-EVT-B1",
          eventId,
          eventTitle: "Event Batal Test",
          eventDate: "2026-12-25T10:00:00Z",
          eventLocation: "Main Hall",
          guestName: "Pembeli Awal",
          guestEmail: "awal@example.com",
          guestPhone: "08123456789",
          ticketCount: 1,
          selectedSeats: ["B1"],
          unitPrice: 50000,
          totalPrice: 50000,
          platformFeePercent: 20,
          platformFeeAmount: 10000,
          organizerRevenueAmount: 40000,
          paymentMethod: "QRIS",
          paymentStatus: "PENDING",
          checkInStatus: "REGISTERED",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      // Kursi B1 terisi
      expect(getEventOccupiedSeats(eventId, activeBookings).has("B1")).toBe(true);

      // Tiket dibatalkan (misal kedaluwarsa atau user membatalkan)
      activeBookings[0].paymentStatus = "CANCELLED";

      // Kursi B1 harus langsung tersedia
      expect(getEventOccupiedSeats(eventId, activeBookings).has("B1")).toBe(false);

      // Pembeli baru dapat memesan B1 tanpa error
      const occupiedNow = getEventOccupiedSeats(eventId, activeBookings);
      const val = validateSeatSelection({
        hasSeatingChart: true,
        selectedSeats: ["B1"],
        ticketCount: 1,
        tierSeats,
        occupiedSeats: occupiedNow,
      });
      expect(val.valid).toBe(true);
    });

    it("tiket dengan status REFUNDED otomatis membebaskan kursi untuk pembeli lain", () => {
      const eventId = "evt-refund-test";
      const activeBookings: EventTicketOrder[] = [
        {
          id: "tkt-c1",
          ticketCode: "DAGO-EVT-C1",
          eventId,
          eventTitle: "Event Refund Test",
          eventDate: "2026-12-25T10:00:00Z",
          eventLocation: "Main Hall",
          guestName: "Pembeli Refund",
          guestEmail: "refund@example.com",
          guestPhone: "08123456789",
          ticketCount: 1,
          selectedSeats: ["C1"],
          unitPrice: 50000,
          totalPrice: 50000,
          platformFeePercent: 20,
          platformFeeAmount: 10000,
          organizerRevenueAmount: 40000,
          paymentMethod: "QRIS",
          paymentStatus: "REFUNDED",
          checkInStatus: "REGISTERED",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      expect(getEventOccupiedSeats(eventId, activeBookings).has("C1")).toBe(false);
    });
  });

  describe("validateEventTicketTiers dengan konfigurasi kursi", () => {
    it("mempertahankan dan memvalidasi rowPrefix, totalRows, seatsPerRow serta menolak tabrakan antar-tier", () => {
      const validRes = validateEventTicketTiers(
        [
          {
            id: "vip",
            name: "VIP",
            price: 150000,
            quota: 10,
            rowPrefix: "vip",
            totalRows: 1,
            seatsPerRow: 10,
          },
          {
            id: "reg",
            name: "Reguler",
            price: 50000,
            quota: 20,
            rowPrefix: "b",
            totalRows: 2,
            seatsPerRow: 10,
          },
        ],
        { hasSeatingChart: true }
      );
      expect(validRes.valid).toBe(true);
      expect(validRes.value?.[0]).toMatchObject({
        rowPrefix: "VIP",
        totalRows: 1,
        seatsPerRow: 10,
      });
      expect(validRes.value?.[1]).toMatchObject({
        rowPrefix: "B",
        totalRows: 2,
        seatsPerRow: 10,
      });

      const insufficientGrid = validateEventTicketTiers([
        {
          id: "t1",
          name: "VIP",
          price: 100000,
          quota: 30,
          rowPrefix: "A",
          totalRows: 2,
          seatsPerRow: 10,
        },
      ]);
      expect(insufficientGrid.valid).toBe(false);
      expect(insufficientGrid.error).toContain("kurang dari kuota");

      const collisionRes = validateEventTicketTiers(
        [
          { id: "t1", name: "Tier 1", price: 100000, quota: 5, rowPrefix: "A", totalRows: 2, seatsPerRow: 5 },
          { id: "t2", name: "Tier 2", price: 50000, quota: 5, rowPrefix: "B", totalRows: 1, seatsPerRow: 5 },
        ],
        { hasSeatingChart: true }
      );
      // Tier 1 quota=5 on 2x5 only produces A1..A5, so let's make Tier 1 quota=10 (A1..B5) colliding with Tier 2 B1..B5
      expect(collisionRes.valid).toBe(true);

      const realCollision = validateEventTicketTiers(
        [
          { id: "t1", name: "Tier 1", price: 100000, quota: 10, rowPrefix: "A", totalRows: 2, seatsPerRow: 5 },
          { id: "t2", name: "Tier 2", price: 50000, quota: 5, rowPrefix: "B", totalRows: 1, seatsPerRow: 5 },
        ],
        { hasSeatingChart: true }
      );
      expect(realCollision.valid).toBe(false);
      expect(realCollision.error).toContain("Tabrakan nomor kursi");
    });
  });

  describe("Integrasi Nyata S-43: Submission, Edit, Booking, Undangan, Cancel/Refund, dan Expired", () => {
    const DATA_DIR = process.env.DATA_DIR_OVERRIDE || path.join(process.cwd(), "data");
    const EVENTS_FILE = path.join(DATA_DIR, "events.json");
    const BOOKINGS_FILE = path.join(DATA_DIR, "event_bookings.json");
    const AUDIT_LOGS_FILE = path.join(DATA_DIR, "audit_logs.json");

    let originalEventsBackup: string | null = null;
    let originalBookingsBackup: string | null = null;
    let originalAuditLogsBackup: string | null = null;
    let createdEventId = "";

    beforeAll(() => {
      if (fs.existsSync(EVENTS_FILE)) originalEventsBackup = fs.readFileSync(EVENTS_FILE, "utf-8");
      if (fs.existsSync(BOOKINGS_FILE)) originalBookingsBackup = fs.readFileSync(BOOKINGS_FILE, "utf-8");
      if (fs.existsSync(AUDIT_LOGS_FILE)) originalAuditLogsBackup = fs.readFileSync(AUDIT_LOGS_FILE, "utf-8");
    });

    afterAll(() => {
      if (originalEventsBackup !== null) fs.writeFileSync(EVENTS_FILE, originalEventsBackup, "utf-8");
      if (originalBookingsBackup !== null) fs.writeFileSync(BOOKINGS_FILE, originalBookingsBackup, "utf-8");
      if (originalAuditLogsBackup !== null) fs.writeFileSync(AUDIT_LOGS_FILE, originalAuditLogsBackup, "utf-8");
    });

    it("menyimpan dan mempertahankan denah kursi multi-tier lewat createEventSubmission & updateEventDetails", async () => {
      const start = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
      const end = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString();

      const submitted = await createEventSubmission({
        organizerName: "Komunitas Musik Bali",
        organizerEmail: "musik-s43@dagohub.id",
        organizerPhone: "081234567890",
        title: "Konser Akustik S-43",
        category: "CREATIVE",
        description: "Konser akustik dengan pemilihan kursi per tier.",
        startDate: start,
        endDate: end,
        location: "Main Hall Dago",
        maxCapacity: 30,
        isPaid: true,
        price: 50000,
        posterUrl: "https://example.com/s43-poster.jpg",
        hasSeatingChart: true,
        ticketTiers: [
          {
            id: "tier-vip-s43",
            name: "VIP",
            price: 150000,
            quota: 10,
            rowPrefix: "VIP",
            totalRows: 1,
            seatsPerRow: 10,
          },
          {
            id: "tier-reg-s43",
            name: "Reguler",
            price: 50000,
            quota: 20,
            rowPrefix: "B",
            totalRows: 2,
            seatsPerRow: 10,
          },
        ],
        refundPolicy: {
          policyType: "REFUNDABLE_UNTIL_H_MINUS",
          hMinusDays: 2,
          refundFeePercent: 10,
        },
      });

      createdEventId = submitted.id;
      expect(submitted.hasSeatingChart).toBe(true);
      expect(submitted.ticketTiers?.[0]).toMatchObject({
        id: "tier-vip-s43",
        rowPrefix: "VIP",
        totalRows: 1,
        seatsPerRow: 10,
      });
      expect(submitted.ticketTiers?.[1]).toMatchObject({
        id: "tier-reg-s43",
        rowPrefix: "B",
        totalRows: 2,
        seatsPerRow: 10,
      });

      const updated = await updateEventDetails(createdEventId, {
        hasSeatingChart: true,
        ticketTiers: [
          {
            id: "tier-vip-s43",
            name: "VIP",
            price: 150000,
            quota: 10,
            rowPrefix: "VIP",
            totalRows: 2,
            seatsPerRow: 5,
          },
          {
            id: "tier-reg-s43",
            name: "Reguler",
            price: 50000,
            quota: 20,
            rowPrefix: "C",
            totalRows: 2,
            seatsPerRow: 10,
          },
        ],
      });

      expect(updated.ticketTiers?.[0]).toMatchObject({
        rowPrefix: "VIP",
        totalRows: 2,
        seatsPerRow: 5,
      });
      expect(updated.ticketTiers?.[1]).toMatchObject({
        rowPrefix: "C",
        totalRows: 2,
        seatsPerRow: 10,
      });

      await updateEventStatus(createdEventId, "APPROVED");
      const pub = await getPublicEventById(createdEventId);
      expect(pub).not.toBeNull();
      expect(pub?.hasSeatingChart).toBe(true);
      expect(pub?.ticketTiers?.[0].rowPrefix).toBe("VIP");
      expect(pub?.occupiedSeats).toEqual([]);
    });

    it("mengunci kursi pada createEventBooking & menolak pemesanan kursi yang sama", async () => {
      const booking1 = await createEventBooking({
        eventId: createdEventId,
        guestName: "Pembeli Pertama",
        guestEmail: "buyer1-s43@example.com",
        guestPhone: "081211112222",
        ticketTierId: "tier-vip-s43",
        ticketCount: 2,
        selectedSeats: ["VIP-A1", "VIP-A2"],
      });

      expect(booking1.selectedSeats).toEqual(["VIP-A1", "VIP-A2"]);

      await expect(
        createEventBooking({
          eventId: createdEventId,
          guestName: "Pembeli Kedua",
          guestEmail: "buyer2-s43@example.com",
          guestPhone: "081233334444",
          ticketTierId: "tier-vip-s43",
          ticketCount: 1,
          selectedSeats: ["VIP-A1"],
        })
      ).rejects.toThrow(/sudah dipesan atau tidak tersedia/i);

      const pubAfter = await getPublicEventById(createdEventId);
      expect(pubAfter?.occupiedSeats).toContain("VIP-A1");
      expect(pubAfter?.occupiedSeats).toContain("VIP-A2");
    });

    it("createInvitationTicket wajib memilih dan mengunci kursi pada event berkursi", async () => {
      await expect(
        createInvitationTicket(
          {
            eventId: createdEventId,
            guestName: "Tamu VIP Tanpa Kursi",
            guestEmail: "vip-nokursi@example.com",
            ticketTierId: "tier-vip-s43",
            ticketCount: 1,
          },
          "admin"
        )
      ).rejects.toThrow(/pilih nomor kursi/i);

      await expect(
        createInvitationTicket(
          {
            eventId: createdEventId,
            guestName: "Tamu VIP Bentrok",
            guestEmail: "vip-bentrok@example.com",
            ticketTierId: "tier-vip-s43",
            ticketCount: 1,
            selectedSeats: ["VIP-A1"],
          } as Parameters<typeof createInvitationTicket>[0],
          "admin"
        )
      ).rejects.toThrow(/sudah dipesan atau tidak tersedia/i);

      const invite = await createInvitationTicket(
        {
          eventId: createdEventId,
          guestName: "Tamu Kehormatan",
          guestEmail: "vip-tamu@example.com",
          ticketTierId: "tier-reg-s43",
          ticketCount: 1,
          selectedSeats: ["C1"],
        } as Parameters<typeof createInvitationTicket>[0],
        "admin"
      );
      expect(invite.selectedSeats).toEqual(["C1"]);

      const pub = await getPublicEventById(createdEventId);
      expect(pub?.occupiedSeats).toContain("C1");
    });

    it("membebaskan kursi saat booking dibatalkan (CANCELLED), di-refund (APPROVED), atau kedaluwarsa (PENDING expired)", async () => {
      // 1. Cancel booking melepaskan kursi
      const toCancel = await createEventBooking({
        eventId: createdEventId,
        guestName: "Pembeli Cancel",
        guestEmail: "cancel-s43@example.com",
        guestPhone: "081255556666",
        ticketTierId: "tier-reg-s43",
        ticketCount: 1,
        selectedSeats: ["C2"],
      });
      await updateBookingPaymentStatus(toCancel.id, "CANCELLED");
      expect((await getPublicEventById(createdEventId))?.occupiedSeats).not.toContain("C2");

      // Kursi C2 bisa dipesan lagi
      const rebooked = await createEventBooking({
        eventId: createdEventId,
        guestName: "Pembeli Rebook",
        guestEmail: "rebook-s43@example.com",
        guestPhone: "081277778888",
        ticketTierId: "tier-reg-s43",
        ticketCount: 1,
        selectedSeats: ["C2"],
      });
      await updateBookingPaymentStatus(rebooked.id, "PAID");

      // 2. Refund disetujui melepaskan kursi
      await requestTicketRefund(rebooked.id, {
        reason: "Berhalangan hadir mendadak karena tugas luar kota",
        bankName: "BCA",
        accountNumber: "1234567890",
        accountHolder: "Pembeli Rebook",
      });
      await adminProcessTicketRefund(rebooked.id, { decision: "APPROVE" });
      expect((await getPublicEventById(createdEventId))?.occupiedSeats).not.toContain("C2");

      // 3. Expired PENDING booking melepaskan kursi
      const toExpire = await createEventBooking({
        eventId: createdEventId,
        guestName: "Pembeli Expired",
        guestEmail: "expired-s43@example.com",
        guestPhone: "081299990000",
        ticketTierId: "tier-reg-s43",
        ticketCount: 1,
        selectedSeats: ["C3"],
      });
      const currentBookings = loadBookingsFromDisk();
      const idx = currentBookings.findIndex((b) => b.id === toExpire.id);
      currentBookings[idx] = {
        ...currentBookings[idx],
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      };
      await saveBookingsToDisk(currentBookings);

      const pubAfterExpiry = await getPublicEventById(createdEventId);
      expect(pubAfterExpiry?.occupiedSeats).not.toContain("C3");

      const rebookedExpiredSeat = await createEventBooking({
        eventId: createdEventId,
        guestName: "Pembeli Ambil Kursi Expired",
        guestEmail: "take-expired-s43@example.com",
        guestPhone: "081200001111",
        ticketTierId: "tier-reg-s43",
        ticketCount: 1,
        selectedSeats: ["C3"],
      });
      expect(rebookedExpiredSeat.selectedSeats).toEqual(["C3"]);
    });

    it("menangani Promise.all createEventBooking paralel untuk kursi yang sama: tepat satu berhasil dan satu ditolak", async () => {
      const results = await Promise.all([
        createEventBooking({
          eventId: createdEventId,
          guestName: "Pembeli Konkuren Satu",
          guestEmail: "conc1-s43@example.com",
          guestPhone: "081211100011",
          ticketTierId: "tier-vip-s43",
          ticketCount: 1,
          selectedSeats: ["VIP-B1"],
        }).then(
          (booking) => ({ ok: true as const, booking }),
          (err: Error) => ({ ok: false as const, error: err.message })
        ),
        createEventBooking({
          eventId: createdEventId,
          guestName: "Pembeli Konkuren Dua",
          guestEmail: "conc2-s43@example.com",
          guestPhone: "081211100022",
          ticketTierId: "tier-vip-s43",
          ticketCount: 1,
          selectedSeats: ["VIP-B1"],
        }).then(
          (booking) => ({ ok: true as const, booking }),
          (err: Error) => ({ ok: false as const, error: err.message })
        ),
      ]);

      const successes = results.filter((r) => r.ok);
      const failures = results.filter((r) => !r.ok);
      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      expect(failures[0].error).toMatch(/sudah dipesan atau tidak tersedia/i);
    });

    it("tetap mengunci kursi jika paymentProofUrl sudah diunggah meskipun expiresAt sudah lewat", async () => {
      const bookingWithProof = await createEventBooking({
        eventId: createdEventId,
        guestName: "Pembeli Dengan Bukti",
        guestEmail: "proof-past-expiry@example.com",
        guestPhone: "081222233344",
        ticketTierId: "tier-reg-s43",
        ticketCount: 1,
        selectedSeats: ["C4"],
      });

      expect(bookingWithProof.paymentStatus).toBe("PENDING");
      expect(bookingWithProof.expiresAt).toBeDefined();
      expect(Number.isFinite(Date.parse(bookingWithProof.expiresAt!))).toBe(true);

      const currentBookings = loadBookingsFromDisk();
      const idx = currentBookings.findIndex((b) => b.id === bookingWithProof.id);
      currentBookings[idx] = {
        ...currentBookings[idx],
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        paymentProofUrl: "/api/events/proofs/bukti-transfer-c4.jpg",
      };
      await saveBookingsToDisk(currentBookings);

      expect(getEventOccupiedSeats(createdEventId, currentBookings, Date.now()).has("C4")).toBe(true);

      const pub = await getPublicEventById(createdEventId);
      expect(pub?.occupiedSeats).toContain("C4");

      await expect(
        createEventBooking({
          eventId: createdEventId,
          guestName: "Pembeli Penyerobot C4",
          guestEmail: "snatch-c4@example.com",
          guestPhone: "081222233355",
          ticketTierId: "tier-reg-s43",
          ticketCount: 1,
          selectedSeats: ["C4"],
        })
      ).rejects.toThrow(/sudah dipesan atau tidak tersedia/i);
    });

    it("melepaskan kursi dan membatalkan booking saat DOKU Checkout melempar DokuCheckoutError dengan isDefiniteFailure=true", async () => {
      const dokuSpy = vi
        .spyOn(dokuModule, "createDokuCheckoutSession")
        .mockRejectedValueOnce(new dokuModule.DokuCheckoutError("MCH-400: Invalid config", true, 400));

      try {
        const req = new NextRequest(`http://localhost:3000/api/events/${createdEventId}/book`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guestName: "Pembeli DOKU Gagal",
            guestEmail: "doku-fail-c5@example.com",
            guestPhone: "081244455566",
            ticketTierId: "tier-reg-s43",
            ticketCount: 1,
            selectedSeats: ["C5"],
            paymentMethod: "DOKU_CHECKOUT",
          }),
        });

        const res = await handleBookPost(req, {
          params: Promise.resolve({ id: createdEventId }),
        });
        const json = await res.json();

        expect(res.status).toBe(502);
        expect(json.success).toBe(false);
        expect(json.error).toContain("Kuota tiket telah dilepaskan");

        const bookingsAfter = loadBookingsFromDisk();
        const failedBooking = bookingsAfter.find((b) => b.guestEmail === "doku-fail-c5@example.com");
        expect(failedBooking?.paymentStatus).toBe("CANCELLED");

        const pub = await getPublicEventById(createdEventId);
        expect(pub?.occupiedSeats).not.toContain("C5");

        const rebookedC5 = await createEventBooking({
          eventId: createdEventId,
          guestName: "Pembeli Sukses C5",
          guestEmail: "doku-rebook-c5@example.com",
          guestPhone: "081244455577",
          ticketTierId: "tier-reg-s43",
          ticketCount: 1,
          selectedSeats: ["C5"],
        });
        expect(rebookedC5.selectedSeats).toEqual(["C5"]);
      } finally {
        dokuSpy.mockRestore();
      }
    });
  });
});
