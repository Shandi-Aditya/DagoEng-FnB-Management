import { describe, it, expect } from "vitest";
import type { CoworkingBooking, CoworkingMember, CoworkingSpace } from "@/types/coworking";
import {
  computeCoworkingReportPdfMetrics,
  buildCoworkingReportDocNumber,
  buildCoworkingReportSignatories,
  formatCoworkingReportPrintDate,
  formatCoworkingDurationLabel,
  formatCoworkingCheckInStatusLabel,
  formatCoworkingCheckInStatusTone,
} from "@/features/coworking/coworking-report-pdf-domain";

describe("coworking-report-pdf-domain", () => {
  const mockSpaces: CoworkingSpace[] = [
    {
      id: "sp-1",
      name: "Desk 01",
      type: "HOT_DESK",
      area: "INDOOR_AC",
      capacity: 1,
      hourlyRate: 15000,
      dailyRate: 75000,
      status: "OCCUPIED",
      amenities: ["Wi-Fi", "Stopkontak"],
    },
    {
      id: "sp-2",
      name: "Meeting Room A",
      type: "MEETING_ROOM",
      area: "PRIVATE_POD",
      capacity: 6,
      hourlyRate: 100000,
      dailyRate: 600000,
      status: "AVAILABLE",
      amenities: ["TV Monitor", "Wi-Fi"],
    },
  ];

  const mockBookings: CoworkingBooking[] = [
    {
      id: "bk-1",
      bookingCode: "CWK-20261115-001",
      guestName: "Made Bagus",
      guestPhone: "081234567890",
      guestEmail: "made@example.com",
      spaceId: "sp-1",
      spaceName: "Desk 01",
      spaceType: "HOT_DESK",
      bookingType: "HOURLY",
      date: "2026-11-15",
      startTime: "09:00",
      endTime: "13:00",
      duration: 4,
      totalAmount: 60000,
      paymentStatus: "PAID",
      checkInStatus: "CHECKED_IN",
    },
    {
      id: "bk-2",
      bookingCode: "CWK-20261115-002",
      guestName: "Ketut Saraswati",
      guestPhone: "081987654321",
      guestEmail: "ketut@example.com",
      spaceId: "sp-2",
      spaceName: "Meeting Room A",
      spaceType: "MEETING_ROOM",
      bookingType: "DAILY",
      date: "2026-11-15",
      startTime: "10:00",
      duration: 1,
      totalAmount: 600000,
      paymentStatus: "PENDING",
      checkInStatus: "RESERVED",
    },
    {
      id: "bk-3",
      bookingCode: "CWK-20261115-003",
      guestName: "Komang Arya",
      guestPhone: "081122334455",
      guestEmail: "komang@example.com",
      spaceId: "sp-1",
      spaceName: "Desk 01",
      spaceType: "HOT_DESK",
      bookingType: "HOURLY",
      date: "2026-11-14",
      startTime: "14:00",
      endTime: "16:00",
      duration: 2,
      totalAmount: 30000,
      paymentStatus: "PAID",
      checkInStatus: "COMPLETED",
    },
  ];

  const mockMembers: CoworkingMember[] = [
    {
      id: "mb-1",
      memberId: "MEM-001",
      name: "Nyoman Dharma",
      contact: "081233445566",
      email: "nyoman@example.com",
      packageName: "Unlimited Monthly",
      startDate: "2026-11-01",
      expiryDate: "2026-11-30",
      status: "ACTIVE",
      totalSpent: 1200000,
    },
  ];

  it("computes executive summary metrics accurately without mutating input", () => {
    const metrics = computeCoworkingReportPdfMetrics(mockSpaces, mockBookings, mockMembers);

    expect(metrics.totalRevenue).toBe(690000); // 60000 + 600000 + 30000
    expect(metrics.activeBookingsCount).toBe(2); // CHECKED_IN + RESERVED
    expect(metrics.occupiedSpacesCount).toBe(1);
    expect(metrics.occupancyPercent).toBe(50); // 1 out of 2 = 50%
    expect(metrics.totalSpaces).toBe(2);
    expect(metrics.totalMembers).toBe(1);
  });

  it("handles empty spaces, bookings, and members gracefully with safe zero defaults", () => {
    const metrics = computeCoworkingReportPdfMetrics([], [], []);

    expect(metrics.totalRevenue).toBe(0);
    expect(metrics.activeBookingsCount).toBe(0);
    expect(metrics.occupiedSpacesCount).toBe(0);
    expect(metrics.occupancyPercent).toBe(0);
    expect(metrics.totalSpaces).toBe(0);
    expect(metrics.totalMembers).toBe(0);
  });

  it("builds a deterministic official document number without Math.random", () => {
    const fixedDate = new Date("2026-11-15T10:00:00Z");
    const docNo = buildCoworkingReportDocNumber(fixedDate, 3);

    expect(docNo).toBe("REP-CWK-20261115-3");
  });

  it("builds 3 factual accountable signatories for the outlet", () => {
    const signatories = buildCoworkingReportSignatories("Singaraja (Pusat)");

    expect(signatories.staff.role).toBe("Front Office & Kasir Co-working");
    expect(signatories.staff.outlet).toBe("Singaraja (Pusat)");

    expect(signatories.supervisor.role).toBe("Supervisor Ruang & Fasilitas");
    expect(signatories.supervisor.name).toContain("Singaraja (Pusat)");

    expect(signatories.approver.role).toBe("Pimpinan / Owner Gerai");
    expect(signatories.approver.name).toContain("Singaraja (Pusat)");
  });

  it("formats coworking print date properly in Indonesian convention", () => {
    const fixedDate = new Date("2026-11-15T10:30:00Z");
    const formatted = formatCoworkingReportPrintDate(fixedDate);

    expect(formatted).toContain("15 November 2026");
  });

  it("formats booking duration labels properly in Indonesian", () => {
    expect(formatCoworkingDurationLabel(3, "HOURLY")).toBe("3 jam");
    expect(formatCoworkingDurationLabel(1, "DAILY")).toBe("1 hari");
    expect(formatCoworkingDurationLabel(2, "MONTHLY")).toBe("2 bulan");
    expect(formatCoworkingDurationLabel(5, "OTHER")).toBe("5 sesi");
  });

  it("translates check-in statuses into standard Indonesian labels and tones", () => {
    expect(formatCoworkingCheckInStatusLabel("CHECKED_IN")).toBe("Sedang digunakan");
    expect(formatCoworkingCheckInStatusTone("CHECKED_IN")).toBe("success");

    expect(formatCoworkingCheckInStatusLabel("RESERVED")).toBe("Dipesan");
    expect(formatCoworkingCheckInStatusTone("RESERVED")).toBe("info");

    expect(formatCoworkingCheckInStatusLabel("COMPLETED")).toBe("Selesai");
    expect(formatCoworkingCheckInStatusTone("COMPLETED")).toBe("neutral");

    expect(formatCoworkingCheckInStatusLabel("CANCELLED")).toBe("Dibatalkan");
    expect(formatCoworkingCheckInStatusTone("CANCELLED")).toBe("destructive");
  });
});
