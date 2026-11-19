import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import * as dataStorage from "@/lib/data-storage";
import {
  isPlaceholderBankAccount,
  createEventBooking,
  saveEventsToDisk,
  saveBookingsToDisk,
  saveEventSettingsToDisk,
  getEventRevenuePolicy,
} from "@/lib/events";
import { CommunityEvent, EventRevenueSharingPolicy } from "@/types/event";

describe("TASK S-01 — Official Bank Account Guard & Fail-Closed Booking Verification", () => {
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

  describe("1. isPlaceholderBankAccount Helper Detection", () => {
    it("1.1 should identify accounts starting with 0000 as placeholder/demo", () => {
      expect(
        isPlaceholderBankAccount({
          accountNumber: "000011223344",
          accountHolder: "PT Dago Hub",
        })
      ).toBe(true);
      expect(
        isPlaceholderBankAccount({
          accountNumber: "000012345678",
          accountHolder: "Bendahara",
        })
      ).toBe(true);
    });

    it("1.2 should identify accounts with DEMO in accountHolder as placeholder", () => {
      expect(
        isPlaceholderBankAccount({
          accountNumber: "9876543210",
          accountHolder: "PT DAGO CREATIVE HUB (DEMO)",
        })
      ).toBe(true);
      expect(
        isPlaceholderBankAccount({
          accountNumber: "5551234567",
          accountHolder: "Demo Account",
        })
      ).toBe(true);
    });

    it("1.3 should identify accounts with DEMO in label as placeholder", () => {
      expect(
        isPlaceholderBankAccount({
          label: "Akun Demo Sandbox",
          accountNumber: "9876543210",
          accountHolder: "Shandi Aditya",
        })
      ).toBe(true);
    });

    it("1.4 should recognize real/official accounts as valid (not placeholder)", () => {
      expect(
        isPlaceholderBankAccount({
          label: "BCA Operasional PT",
          accountNumber: "1350029384",
          accountHolder: "PT DAGO KREATIF MANDIRI",
        })
      ).toBe(false);
    });

    it("1.5 should safely handle null or empty values", () => {
      expect(isPlaceholderBankAccount(null)).toBe(false);
      expect(isPlaceholderBankAccount(undefined)).toBe(false);
      expect(isPlaceholderBankAccount({})).toBe(false);
    });
  });

  describe("2. Fail-Closed Guard in createEventBooking", () => {
    const mockPaidEvent: CommunityEvent = {
      id: "evt-paid-bank-guard-01",
      title: "Workshop Desain UI Berbayar",
      description: "Workshop berbayar untuk validasi rekening resmi",
      category: "WORKSHOP",
      location: "Coworking Hall",
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 172800000).toISOString(),
      maxCapacity: 50,
      price: 100000,
      isPaid: true,
      posterUrl: "/images/events/default-poster.jpg",
      status: "APPROVED",
      organizerName: "Dago Community",
      organizerEmail: "org@dago.com",
      organizerPhone: "08123456789",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockFreeEvent: CommunityEvent = {
      ...mockPaidEvent,
      id: "evt-free-bank-guard-02",
      title: "Meetup Komunitas Gratis",
      price: 0,
      isPaid: false,
    };

    it("2.1 should reject paid booking when default platform bank is placeholder/demo", async () => {
      await saveEventsToDisk([mockPaidEvent]);
      await saveBookingsToDisk([]);
      const placeholderPolicy: EventRevenueSharingPolicy = {
        ...getEventRevenuePolicy(),
        bankAccounts: [
          {
            id: "bank-demo",
            label: "Akun Demo",
            bankName: "BCA Demo",
            accountNumber: "000011223344",
            accountHolder: "PT DAGO CREATIVE HUB (DEMO)",
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
          eventId: mockPaidEvent.id,
          guestName: "Budi Santoso",
          guestEmail: "budi@example.com",
          guestPhone: "081234567890",
          ticketCount: 1,
          enforceOfficialBank: true,
        })
      ).rejects.toThrow(
        /PEMBAYARAN_TERKENDALA: Rekening bank penampung resmi Dago Creative Hub sedang dalam proses verifikasi/
      );
    });

    it("2.2 should allow free event booking even when platform bank is placeholder", async () => {
      await saveEventsToDisk([mockFreeEvent]);
      await saveBookingsToDisk([]);

      const booking = await createEventBooking({
        eventId: mockFreeEvent.id,
        guestName: "Siti Rahma",
        guestEmail: "siti@example.com",
        guestPhone: "081234567890",
        ticketCount: 1,
        enforceOfficialBank: true,
      });

      expect(booking).toBeDefined();
      expect(booking.paymentStatus).toBe("PAID");
      expect(booking.paymentMethod).toBe("FREE");
    });

    it("2.3 should succeed for paid booking when official non-placeholder bank is configured", async () => {
      const officialPolicy: EventRevenueSharingPolicy = {
        ...getEventRevenuePolicy(),
        bankAccounts: [
          {
            id: "bank-official-001",
            label: "BCA Rekening Resmi",
            bankName: "Bank BCA",
            accountNumber: "135002938411",
            accountHolder: "PT DAGO KREATIF MANDIRI",
            branch: "KCU Dago",
            isDefault: true,
            isActive: true,
            accountType: "PLATFORM",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      await saveEventSettingsToDisk(officialPolicy);
      await saveEventsToDisk([mockPaidEvent]);
      await saveBookingsToDisk([]);

      const booking = await createEventBooking({
        eventId: mockPaidEvent.id,
        guestName: "Ahmad Dani",
        guestEmail: "ahmad@example.com",
        guestPhone: "081234567890",
        ticketCount: 1,
        enforceOfficialBank: true,
      });

      expect(booking).toBeDefined();
      expect(booking.paymentStatus).toBe("PENDING");
      expect(booking.destinationBankSnapshot?.accountHolder).toBe("PT DAGO KREATIF MANDIRI");
      expect(booking.destinationBankSnapshot?.accountNumber).toBe("135002938411");
    });

    it("2.4 should allow bypass when ALLOW_DEMO_BANK='true'", async () => {
      process.env.ALLOW_DEMO_BANK = "true";
      await saveEventsToDisk([mockPaidEvent]);
      await saveBookingsToDisk([]);

      const booking = await createEventBooking({
        eventId: mockPaidEvent.id,
        guestName: "Tester Demo",
        guestEmail: "tester@demo.com",
        guestPhone: "081234567890",
        ticketCount: 1,
      });

      expect(booking).toBeDefined();
      expect(booking.paymentStatus).toBe("PENDING");
    });
  });
});
