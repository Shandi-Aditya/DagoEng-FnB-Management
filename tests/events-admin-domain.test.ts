import { describe, it, expect } from "vitest";
import {
  eventStatusLabel,
  eventStatusTone,
  paymentStatusLabel,
  paymentStatusTone,
  payoutStatusLabel,
  payoutStatusTone,
  eventCategoryLabel,
  filterEvents,
  filterBookings,
  calculateEventsKPI,
  formatWhatsAppUrl,
  isPastUnapproved,
  getEffectiveStatus,
} from "@/features/events-admin/events-admin-domain";
import type { CommunityEvent, EventTicketOrder } from "@/types/event";

describe("events-admin-domain", () => {
  const mockEvents: CommunityEvent[] = [
    {
      id: "evt-1",
      title: "Workshop Barista Pemula",
      category: "WORKSHOP",
      status: "PENDING",
      startDate: "2026-11-20T10:00:00Z",
      endDate: "2026-11-20T14:00:00Z",
      location: "Dago Creative Hub",
      organizerName: "Komunitas Kopi Singaraja",
      organizerEmail: "kopi@example.com",
      organizerPhone: "081234567890",
      posterUrl: "/images/events/workshop.jpg",
      description: "Pelatihan dasar manual brew",
      isPaid: true,
      price: 50000,
      maxCapacity: 30,
      createdAt: "2026-11-10T08:00:00Z",
      updatedAt: "2026-11-10T08:00:00Z",
      proposedRevenueSplit: {
        platformPercent: 20,
        organizerPercent: 80,
        proposedBy: "ORGANIZER",
        status: "PENDING",
      },
    },
    {
      id: "evt-2",
      title: "Meetup Tech Developer",
      category: "TECH",
      status: "APPROVED",
      startDate: "2026-11-25T18:00:00Z",
      endDate: "2026-11-25T21:00:00Z",
      location: "Ruang Kolaborasi",
      organizerName: "Singaraja Dev",
      organizerEmail: "dev@example.com",
      organizerPhone: "081987654321",
      posterUrl: "/images/events/meetup.jpg",
      description: "Sharing session backend & frontend",
      isPaid: false,
      price: 0,
      maxCapacity: 50,
      createdAt: "2026-11-08T09:00:00Z",
      updatedAt: "2026-11-09T10:00:00Z",
    },
    {
      id: "evt-3",
      title: "Kelas Melukis Cat Air",
      category: "CREATIVE",
      status: "REVISION_REQUESTED",
      startDate: "2026-11-30T13:00:00Z",
      endDate: "2026-11-30T16:00:00Z",
      location: "Area Terbuka",
      organizerName: "Studio Seni Bali",
      organizerEmail: "seni@example.com",
      organizerPhone: "081333444555",
      posterUrl: "/images/events/melukis.jpg",
      description: "Workshop melukis cat air santai",
      isPaid: true,
      price: 120000,
      maxCapacity: 15,
      createdAt: "2026-11-05T10:00:00Z",
      updatedAt: "2026-11-06T11:00:00Z",
    },
  ];

  
function mockAdminTicket(override: any): EventTicketOrder {
  return {
    eventTitle: "Workshop Melukis",
    eventDate: "2026-11-20T10:00:00Z",
    eventLocation: "Singaraja",
    ticketCount: 1,
    unitPrice: override.totalPrice ?? 50000,
    platformFeePercent: 20,
    platformFeeAmount: 10000,
    organizerRevenueAmount: 40000,
    paymentMethod: "MANUAL_TRANSFER",
    updatedAt: "2026-11-11T12:00:00Z",
    ...override,
  };
}

const mockBookings: EventTicketOrder[] = [
    {
      id: "bkg-1",
      eventId: "evt-1",
      ticketCode: "TCK-001",
      guestName: "Wayan Sudirga",
      guestPhone: "081234567890",
      guestEmail: "wayan@example.com",
      totalPrice: 50000,
      paymentStatus: "PENDING",
      paymentProofUrl: "/images/events/proofs/transfer-1.jpg",
      checkInStatus: "REGISTERED",
      createdAt: "2026-11-11T12:00:00Z",
    },
    {
      id: "bkg-2",
      eventId: "evt-2",
      ticketCode: "TCK-002",
      guestName: "Made Suarta",
      guestPhone: "+6281987654321",
      guestEmail: "made@example.com",
      totalPrice: 0,
      paymentStatus: "PAID",
      checkInStatus: "CHECKED_IN",
      createdAt: "2026-11-11T14:00:00Z",
    },
].map(mockAdminTicket);

  describe("Status labels and tones", () => {
    it("maps event status to proper Indonesian sentence case label", () => {
      expect(eventStatusLabel("PENDING")).toBe("Menunggu review");
      expect(eventStatusLabel("REVISION_REQUESTED")).toBe("Perlu revisi");
      expect(eventStatusLabel("APPROVED")).toBe("Disetujui");
      expect(eventStatusLabel("REJECTED")).toBe("Ditolak");
      expect(eventStatusLabel("ARCHIVED")).toBe("Diarsipkan");
      expect(eventStatusLabel("UNKNOWN")).toBe("UNKNOWN");
    });

    it("maps event status to semantic badge tones", () => {
      expect(eventStatusTone("PENDING")).toBe("warning");
      expect(eventStatusTone("REVISION_REQUESTED")).toBe("info");
      expect(eventStatusTone("APPROVED")).toBe("success");
      expect(eventStatusTone("REJECTED")).toBe("destructive");
      expect(eventStatusTone("ARCHIVED")).toBe("neutral");
    });

    it("maps payment status to Indonesian labels and tones", () => {
      expect(paymentStatusLabel("PENDING")).toBe("Menunggu verifikasi");
      expect(paymentStatusLabel("PAID")).toBe("Lunas");
      expect(paymentStatusLabel("REJECTED")).toBe("Ditolak");
      expect(paymentStatusLabel("EXPIRED")).toBe("Kedaluwarsa");
      expect(paymentStatusTone("PAID")).toBe("success");
      expect(paymentStatusTone("PENDING")).toBe("warning");
    });

    it("maps payout status to Indonesian labels and tones", () => {
      expect(payoutStatusLabel("REQUESTED")).toBe("Diajukan");
      expect(payoutStatusLabel("PROCESSING")).toBe("Diproses");
      expect(payoutStatusLabel("PAID")).toBe("Selesai");
      expect(payoutStatusLabel("REJECTED")).toBe("Ditolak");
      expect(payoutStatusTone("PAID")).toBe("success");
    });

    it("maps event categories to friendly names", () => {
      expect(eventCategoryLabel("WORKSHOP")).toBe("Workshop");
      expect(eventCategoryLabel("TECH")).toBe("Teknologi");
      expect(eventCategoryLabel("CREATIVE")).toBe("Kreatif");
    });
  });

  describe("Filtering and Searching (immutability)", () => {
    it("filters events by status tab correctly without mutating array", () => {
      const pending = filterEvents(mockEvents, "PENDING", "");
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe("evt-1");
      expect(mockEvents).toHaveLength(3); // Original untouched
    });

    it("searches events by title, organizer, or location query", () => {
      const searched = filterEvents(mockEvents, "ALL", "developer");
      expect(searched).toHaveLength(1);
      expect(searched[0].id).toBe("evt-2");
    });

    it("filters manual payment bookings by status and search query", () => {
      const pendingProof = filterBookings(mockBookings, "PENDING_PROOF", "");
      expect(pendingProof).toHaveLength(1);
      expect(pendingProof[0].ticketCode).toBe("TCK-001");

      const searchByName = filterBookings(mockBookings, "ALL", "Sudirga");
      expect(searchByName).toHaveLength(1);
      expect(searchByName[0].id).toBe("bkg-1");
    });
  });

  describe("KPI Calculations", () => {
    it("computes operational summary counters accurately", () => {
      const kpi = calculateEventsKPI(mockEvents, mockBookings);
      expect(kpi.pendingReviewsCount).toBe(1);
      expect(kpi.approvedEventsCount).toBe(1);
      expect(kpi.revisionEventsCount).toBe(1);
      expect(kpi.pendingPaymentsCount).toBe(1);
      expect(kpi.totalRevenuePaid).toBe(0); // Only TCK-002 is paid (Rp 0)
    });
  });

  describe("Utilities", () => {
    it("formats WhatsApp URL properly with country code 62", () => {
      expect(formatWhatsAppUrl("081234567890")).toBe("https://wa.me/6281234567890");
      expect(formatWhatsAppUrl("+6281987654321")).toBe("https://wa.me/6281987654321");
      expect(formatWhatsAppUrl("")).toBe("#");
      expect(formatWhatsAppUrl(null)).toBe("#");
    });

    it("checks past unapproved events correctly", () => {
      const pastEvent: CommunityEvent = {
        ...mockEvents[0],
        startDate: "2020-01-01T00:00:00Z",
        endDate: "2020-01-01T05:00:00Z",
        status: "PENDING",
      };
      const now = new Date("2026-11-12T00:00:00Z").getTime();
      expect(isPastUnapproved(pastEvent, now)).toBe(true);
      expect(getEffectiveStatus(pastEvent, now)).toBe("ARCHIVED");
    });
  });
});
