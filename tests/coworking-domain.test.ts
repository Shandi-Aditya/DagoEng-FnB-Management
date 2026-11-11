import { describe, expect, it } from "vitest";
import {
  calculateCoworkingKPIs,
  calculateDaysCount,
  calculateHourlyEndTime,
  computeBookingPricing,
  filterCoworkingMembers,
  getSpaceStatusTone,
  getBookingCheckInTone,
  getMemberStatusTone,
  buildCoworkingExportData,
} from "@/features/coworking/coworking-domain";
import type {
  CoworkingSpaceItem,
  CoworkingMember,
  CoworkingBooking,
} from "@/types/coworking";

const mockSpaces: CoworkingSpaceItem[] = [
  {
    id: "sp-1",
    name: "Meja Hot Desk A1",
    type: "HOT_DESK",
    area: "Ground Floor Main",
    capacity: 1,
    hourlyRate: 25000,
    dailyRate: 100000,
    monthlyRate: 1500000,
    status: "AVAILABLE",
    amenities: ["WiFi", "Stopkontak"],
  },
  {
    id: "sp-2",
    name: "Private Pod 01",
    type: "PRIVATE_POD",
    area: "Mezzanine Quiet Zone",
    capacity: 2,
    hourlyRate: 50000,
    dailyRate: 200000,
    status: "OCCUPIED",
    amenities: ["WiFi", "Monitor"],
    currentSession: {
      guestName: "Budi",
      checkInTime: "10:00 WITA",
      endTime: "14:00 WITA",
      bookingCode: "CWK-001",
    },
  },
];

const mockMembers: CoworkingMember[] = [
  {
    id: "mem-1",
    memberId: "MBR-001",
    name: "Alex Pratama",
    contact: "0812345678",
    email: "alex@example.com",
    packageName: "Dedicated Nomad Monthly",
    startDate: "2024-03-01",
    expiryDate: "2024-03-31",
    status: "ACTIVE",
    totalSpent: 1850000,
  },
  {
    id: "mem-2",
    memberId: "MBR-002",
    name: "Citra Dewi",
    contact: "0823456789",
    email: "citra@example.com",
    packageName: "Flex 10 Days Pass",
    startDate: "2024-01-01",
    expiryDate: "2024-02-01",
    status: "EXPIRED",
    totalSpent: 550000,
  },
];

describe("coworking-domain", () => {
  it("calculates coworking space and member KPIs", () => {
    const kpis = calculateCoworkingKPIs(mockSpaces, mockMembers);
    expect(kpis.totalSpaces).toBe(2);
    expect(kpis.availableSpaces).toBe(1);
    expect(kpis.occupiedSpaces).toBe(1);
    expect(kpis.activeMembers).toBe(1);
  });

  it("calculates day difference accurately", () => {
    expect(calculateDaysCount("2024-03-01", "2024-03-01")).toBe(1);
    expect(calculateDaysCount("2024-03-01", "2024-03-03")).toBe(3);
    expect(calculateDaysCount("2024-03-01", "2024-03-07")).toBe(7);
  });

  it("calculates end time for hourly bookings", () => {
    expect(calculateHourlyEndTime("09:00", 2)).toBe("11:00");
    expect(calculateHourlyEndTime("16:00", 4)).toBe("20:00");
    expect(calculateHourlyEndTime("22:00", 3)).toBe("23:00");
  });

  it("computes pricing for hourly booking", () => {
    const pricing = computeBookingPricing({
      space: mockSpaces[0],
      bookType: "HOURLY",
      durationHours: 3,
      dailyPreset: "1_DAY",
      startDate: "2024-03-10",
      endDate: "2024-03-10",
      startTime: "10:00",
    });
    expect(pricing.computedDuration).toBe(3);
    expect(pricing.computedTotal).toBe(75000);
    expect(pricing.computedEndTime).toBe("13:00 WITA");
  });

  it("computes pricing for daily presets", () => {
    const pricing3Days = computeBookingPricing({
      space: mockSpaces[0],
      bookType: "DAILY",
      durationHours: 1,
      dailyPreset: "3_DAYS",
      startDate: "2024-03-10",
      endDate: "2024-03-10",
      startTime: "09:00",
    });
    expect(pricing3Days.computedDuration).toBe(3);
    expect(pricing3Days.computedTotal).toBe(300000);
    expect(pricing3Days.computedEndDate).toBe("2024-03-12");
  });

  it("computes pricing for monthly plan", () => {
    const pricingMonthly = computeBookingPricing({
      space: mockSpaces[0],
      bookType: "MONTHLY",
      durationHours: 1,
      dailyPreset: "1_DAY",
      startDate: "2024-03-01",
      endDate: "2024-03-01",
      startTime: "09:00",
    });
    expect(pricingMonthly.computedDuration).toBe(30);
    expect(pricingMonthly.computedTotal).toBe(1500000);
  });

  it("filters members by status and search query", () => {
    expect(filterCoworkingMembers(mockMembers, "ALL", "")).toHaveLength(2);
    expect(filterCoworkingMembers(mockMembers, "ACTIVE", "")).toHaveLength(1);
    expect(filterCoworkingMembers(mockMembers, "EXPIRED", "")).toHaveLength(1);
    expect(filterCoworkingMembers(mockMembers, "ALL", "alex")).toHaveLength(1);
    expect(filterCoworkingMembers(mockMembers, "ALL", "nomad")).toHaveLength(1);
  });

  it("maps space and booking status to appropriate status tones", () => {
    expect(getSpaceStatusTone("AVAILABLE")).toBe("success");
    expect(getSpaceStatusTone("OCCUPIED")).toBe("info");
    expect(getBookingCheckInTone("CHECKED_IN")).toBe("info");
    expect(getBookingCheckInTone("RESERVED")).toBe("warning");
    expect(getBookingCheckInTone("COMPLETED")).toBe("neutral");
    expect(getMemberStatusTone("ACTIVE")).toBe("success");
    expect(getMemberStatusTone("EXPIRED")).toBe("destructive");
  });

  it("builds export datasets for members and bookings", () => {
    const memberExport = buildCoworkingExportData("MEMBERS", [], mockMembers, "Singaraja");
    expect(memberExport.headers).toHaveLength(9);
    expect(memberExport.rows).toHaveLength(2);

    const bookingExport = buildCoworkingExportData("BOOKINGS", [], [], "Singaraja");
    expect(bookingExport.headers).toHaveLength(10);
    expect(bookingExport.rows).toHaveLength(0);
  });
});
