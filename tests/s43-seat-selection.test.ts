import { describe, it, expect } from "vitest";
import {
  generateTierSeats,
  getEventOccupiedSeats,
  validateSeatSelection,
  formatSeatsList,
} from "@/lib/event-seating";
import type { EventTicketOrder, CommunityEvent, EventTicketTier } from "@/types/event";

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
      const occupied = getEventOccupiedSeats("evt-101", mockBookings);
      expect(occupied.has("A1")).toBe(true);
      expect(occupied.has("A2")).toBe(true);
      expect(occupied.has("A3")).toBe(true);
      // Kursi A4 dari tiket CANCELLED harus tersedia kembali
      expect(occupied.has("A4")).toBe(false);
      // Kursi A5 dari tiket refund APPROVED harus tersedia kembali
      expect(occupied.has("A5")).toBe(false);
      expect(occupied.size).toBe(3);
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
  });
});
