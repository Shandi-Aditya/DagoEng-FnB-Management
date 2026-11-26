import fs from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateCoworkingKPIs,
  calculateCoworkingPrice,
  calculateDaysCount,
  calculateHourlyEndTime,
  computeBookingPricing,
  filterCoworkingMembers,
  filterCoworkingBookings,
  getSpaceImageUrl,
  getSpaceStatusTone,
  getBookingCheckInTone,
  getMemberStatusTone,
  buildCoworkingExportData,
  resolveSpaceCapacity,
  spaceTypeLabel,
  bookingCheckInStatusLabel,
  bookingPaymentStatusLabel,
  emptyCoworkingMessage,
  isSpaceAvailableNow,
} from "@/features/coworking/coworking-domain";
import { DAGO_SPACES, MEMBERSHIP_PLANS } from "@/features/coworking/coworking-data";
import { reconcileCoworkingMasterDefaults } from "@/lib/sync-domains/spaces-spec";
import { checkCoworkingBookingConflict } from "@/lib/operating-hours";
import { POST as postCoworkingBooking } from "@/app/api/coworking/bookings/route";
import {
  getCoworkingBookings,
  readSeededPersistentData,
  savePersistentOrder,
  writePersistentData,
} from "@/lib/persistent-storage";
import { isPromoEligibleForItem, type PromoConfig } from "@/lib/promo";
import { DEFAULT_PLATFORM_SETTINGS, type PlatformSettings } from "@/types/settings";
import type { OrderRecord } from "@/types/order";
import * as serverAuth from "@/lib/server-auth";
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

  it("converts raw space type enums to readable Indonesian labels", () => {
    expect(spaceTypeLabel("HOT_DESK")).toBe("Hot desk");
    expect(spaceTypeLabel("PRIVATE_POD")).toBe("Pod privat");
    expect(spaceTypeLabel("MEETING_ROOM")).toBe("Ruang rapat");
    expect(spaceTypeLabel("DEDICATED_DESK")).toBe("Meja khusus");
  });

  it("converts check-in and payment statuses to human readable labels", () => {
    expect(bookingCheckInStatusLabel("CHECKED_IN")).toBe("Sedang aktif");
    expect(bookingCheckInStatusLabel("RESERVED")).toBe("Menunggu");
    expect(bookingCheckInStatusLabel("COMPLETED")).toBe("Selesai");
    expect(bookingCheckInStatusLabel("CANCELLED")).toBe("Dibatalkan");

    expect(bookingPaymentStatusLabel("PAID")).toBe("Lunas");
    expect(bookingPaymentStatusLabel("UNPAID")).toBe("Menunggu bayar");
  });

  it("provides distinct empty-state copy for tabs when filtered vs empty data", () => {
    const spacesEmpty = emptyCoworkingMessage("SPACES", false);
    expect(spacesEmpty.title).toBe("Belum ada ruang");

    const bookingsFiltered = emptyCoworkingMessage("BOOKINGS", true);
    expect(bookingsFiltered.title).toBe("Tidak ada booking yang cocok");
    expect(bookingsFiltered.description).toContain("Ubah kata kunci");
  });

  it("filters coworking bookings by status and search query without mutating source", () => {
    const mockBookings: CoworkingBooking[] = [
      {
        id: "bk-1",
        bookingCode: "CWK-101",
        guestName: "Budi Santoso",
        guestPhone: "081111111",
        guestEmail: "budi@example.com",
        spaceId: "sp-1",
        spaceName: "Meja Hot Desk A1",
        spaceType: "HOT_DESK",
        bookingType: "HOURLY",
        date: "2026-11-12",
        startTime: "09:00 WITA",
        duration: 2,
        price: 50000,
        discount: 0,
        totalAmount: 50000,
        paidAmount: 50000,
        remainingAmount: 0,
        paymentStatus: "PAID",
        paymentMethod: "QRIS",
        checkInStatus: "CHECKED_IN",
      },
      {
        id: "bk-2",
        bookingCode: "CWK-102",
        guestName: "Siti Rahma",
        guestPhone: "082222222",
        guestEmail: "siti@example.com",
        spaceId: "sp-2",
        spaceName: "Private Pod 01",
        spaceType: "PRIVATE_POD",
        bookingType: "DAILY",
        date: "2026-11-12",
        startTime: "10:00 WITA",
        duration: 1,
        price: 200000,
        discount: 0,
        totalAmount: 200000,
        paidAmount: 200000,
        remainingAmount: 0,
        paymentStatus: "PAID",
        paymentMethod: "CASH",
        checkInStatus: "RESERVED",
      },
    ];

    expect(filterCoworkingBookings(mockBookings, "ALL", "")).toHaveLength(2);
    expect(filterCoworkingBookings(mockBookings, "CHECKED_IN", "")).toHaveLength(1);
    expect(filterCoworkingBookings(mockBookings, "ALL", "cwk-102")).toHaveLength(1);
    expect(filterCoworkingBookings(mockBookings, "ALL", "081111111")).toHaveLength(1);
    expect(filterCoworkingBookings(mockBookings, "ALL", "private pod")).toHaveLength(1);
    expect(filterCoworkingBookings(mockBookings, "RESERVED", "budi")).toHaveLength(0);
    expect(mockBookings).toHaveLength(2);
  });

  it("identifies space availability accurately considering status and active sessions", () => {
    const availableSpace: CoworkingSpaceItem = { ...mockSpaces[0], status: "AVAILABLE" };
    const occupiedSpace: CoworkingSpaceItem = { ...mockSpaces[1], status: "OCCUPIED" };
    const spaceWithPhantomSession: CoworkingSpaceItem = {
      ...mockSpaces[0],
      status: "AVAILABLE",
      currentSession: {
        guestName: "Active Guest",
        checkInTime: "11:00 WITA",
        endTime: "13:00 WITA",
        bookingCode: "CWK-999",
      },
    };

    expect(isSpaceAvailableNow(availableSpace)).toBe(true);
    expect(isSpaceAvailableNow(occupiedSpace)).toBe(false);
    expect(isSpaceAvailableNow(spaceWithPhantomSession)).toBe(false);

    const sharedOpenSpace: CoworkingSpaceItem = {
      ...DAGO_SPACES[0],
      status: "AVAILABLE",
      currentSession: {
        guestName: "First Guest",
        checkInTime: "10:00 WITA",
        endTime: "12:00 WITA",
        bookingCode: "CWK-OS-1",
      },
    };
    expect(isSpaceAvailableNow(sharedOpenSpace)).toBe(true);
    expect(isSpaceAvailableNow(sharedOpenSpace, 5)).toBe(true);
    expect(isSpaceAvailableNow(sharedOpenSpace, 20)).toBe(false);
    expect(isSpaceAvailableNow({ ...sharedOpenSpace, status: "MAINTENANCE" }, 0)).toBe(false);
  });

  it("calculates tiered, non-tier capped, daily, and monthly prices accurately via calculateCoworkingPrice", () => {
    const openSpace = DAGO_SPACES.find((s) => s.id === "sp-os-01")!;
    const spaceMonitor = DAGO_SPACES.find((s) => s.id === "sp-sm-01")!;
    const smallMeeting = DAGO_SPACES.find((s) => s.id === "sp-mr-sm")!;

    // Exact tier matches
    expect(calculateCoworkingPrice(spaceMonitor, { bookingType: "HOURLY", duration: 2 }).basePrice).toBe(26000);
    expect(calculateCoworkingPrice(spaceMonitor, { bookingType: "HOURLY", duration: 3 }).basePrice).toBe(40000);
    expect(calculateCoworkingPrice(spaceMonitor, { bookingType: "HOURLY", duration: 6 }).basePrice).toBe(60000);
    expect(calculateCoworkingPrice(spaceMonitor, { bookingType: "HOURLY", duration: 8 }).basePrice).toBe(80000);

    // Non-tier caps: 5h Space Monitor (5 * 13k = 65k -> capped to 6h tier 60k), 7h -> capped to 8h/daily 80k
    expect(calculateCoworkingPrice(spaceMonitor, { bookingType: "HOURLY", duration: 1 }).basePrice).toBe(13000);
    expect(calculateCoworkingPrice(spaceMonitor, { bookingType: "HOURLY", duration: 5 }).basePrice).toBe(60000);
    expect(calculateCoworkingPrice(spaceMonitor, { bookingType: "HOURLY", duration: 7 }).basePrice).toBe(80000);
    expect(calculateCoworkingPrice(smallMeeting, { bookingType: "HOURLY", duration: 7 }).basePrice).toBe(250000);

    // >= 8h daily fallback on non-tiered space & DAILY / MONTHLY quotes
    expect(calculateCoworkingPrice(mockSpaces[0], { bookingType: "HOURLY", duration: 8 }).basePrice).toBe(100000);
    expect(calculateCoworkingPrice(openSpace, { bookingType: "DAILY", duration: 3 }).basePrice).toBe(210000);
    expect(calculateCoworkingPrice(mockSpaces[0], { bookingType: "MONTHLY", duration: 30 }).basePrice).toBe(1500000);
  });

  it("resolves space capacities and default image URLs correctly", () => {
    expect(resolveSpaceCapacity(DAGO_SPACES[0])).toBe(20); // OPEN_SPACE
    expect(resolveSpaceCapacity(DAGO_SPACES[1])).toBe(8);  // SPACE_MONITOR
    expect(resolveSpaceCapacity(DAGO_SPACES[2])).toBe(1);  // SMALL_MEETING_ROOM (private booking)
    expect(resolveSpaceCapacity(DAGO_SPACES[3])).toBe(1);  // LARGE_MEETING_ROOM (private booking)
    expect(resolveSpaceCapacity({ ...mockSpaces[0], type: "HOT_DESK", capacity: 8 })).toBe(8);

    expect(getSpaceImageUrl({ imageUrl: "/custom/room.jpg", type: "OPEN_SPACE" })).toBe("/custom/room.jpg");
    expect(getSpaceImageUrl({ type: "SPACE_MONITOR" })).toBe("/images/spaces/spacemonitor.jpeg");
    expect(getSpaceImageUrl({ roomCategory: "LARGE_MEETING_ROOM" })).toBe("/images/spaces/largemeetingroom.jpeg");
    expect(getSpaceImageUrl({})).toBe("/images/spaces/openspace.jpeg");
  });

  it("reconciles legacy coworking_master state non-destructively with DAGO_SPACES and MEMBERSHIP_PLANS", () => {
    const legacyState = {
      spaces: [
        {
          id: "sp-os-01",
          name: "Open Space Custom Edit",
          type: "OPEN_SPACE",
          area: "Main Open Area",
          capacity: 20,
          hourlyRate: 12000,
          dailyRate: 75000,
          status: "MAINTENANCE" as const,
          amenities: ["WiFi"],
        },
        {
          id: "sp-custom-admin",
          name: "Custom Studio",
          type: "EVENT_SPACE",
          area: "Rooftop",
          capacity: 15,
          hourlyRate: 100000,
          dailyRate: 600000,
          status: "AVAILABLE" as const,
          amenities: ["Stage"],
        },
      ],
      members: [mockMembers[0] as any],
      checkLogs: [{ id: "chk-1", bookingCode: "CWK-1", guestName: "Budi", spaceName: "Open Space", checkInDate: "2026-11-20", checkInTime: "09:00", checkInBy: "Staff", durationFormatted: "2 Jam", status: "COMPLETED" as const }],
      plans: [
        {
          id: "plan-nomad",
          name: "Dedicated Nomad Monthly",
          priceFormatted: "Rp 1.850.000",
          priceNumber: 1850000,
          billingCycle: "Bulanan" as const,
          color: "blue",
          deskAccess: "Senin - Jumat",
          meetingCredits: "-",
          fnbPerk: "-",
          fnbVoucherCode: "V",
          amenities: [],
        },
        {
          id: "plan-custom-vip",
          name: "VIP Custom Plan",
          priceFormatted: "Rp 999.000",
          priceNumber: 999000,
          billingCycle: "1 Bulan" as const,
          color: "blue",
          deskAccess: "VIP",
          meetingCredits: "-",
          fnbPerk: "-",
          fnbVoucherCode: "VIP",
          amenities: [],
        },
      ],
    };

    const reconciled = reconcileCoworkingMasterDefaults(legacyState);

    // Preserved custom admin edits on sp-os-01 while backfilling tieredRates & imageUrl
    const os = reconciled.spaces.find((s) => s.id === "sp-os-01");
    expect(os?.name).toBe("Open Space Custom Edit");
    expect(os?.hourlyRate).toBe(12000);
    expect(os?.status).toBe("MAINTENANCE");
    expect(os?.tieredRates).toHaveLength(4);
    expect(os?.imageUrl).toBe("/images/spaces/openspace.jpeg");

    // Inserted missing Dago spaces and preserved custom admin space
    expect(reconciled.spaces.some((s) => s.id === "sp-sm-01")).toBe(true);
    expect(reconciled.spaces.some((s) => s.id === "sp-mr-sm")).toBe(true);
    expect(reconciled.spaces.some((s) => s.id === "sp-mr-lg")).toBe(true);
    expect(reconciled.spaces.some((s) => s.id === "sp-custom-admin")).toBe(true);

    // Preserved members and checkLogs
    expect(reconciled.members).toHaveLength(1);
    expect(reconciled.checkLogs).toHaveLength(1);

    // Replaced legacy plan ID with 7 official plans while preserving custom plan
    expect(reconciled.plans.some((p) => p.id === "plan-nomad")).toBe(false);
    expect(reconciled.plans.some((p) => p.id === "plan-custom-vip")).toBe(true);
    for (const officialPlan of MEMBERSHIP_PLANS) {
      expect(reconciled.plans.some((p) => p.id === officialPlan.id)).toBe(true);
    }
  });
});

describe("POST /api/coworking/bookings Dago spaces & security invariants", () => {
  let tempDir: string;
  let prevDataDir: string | undefined;

  beforeEach(() => {
    prevDataDir = process.env.DATA_DIR_OVERRIDE;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cwk-api-domain-"));
    process.env.DATA_DIR_OVERRIDE = tempDir;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (prevDataDir === undefined) delete process.env.DATA_DIR_OVERRIDE;
    else process.env.DATA_DIR_OVERRIDE = prevDataDir;
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("reconciles legacy coworking_master.json for DAGO_SPACES, enforces authoritative staff/customer tiered pricing & promos, allows customer DAILY>9/MONTHLY, and blocks tenant OWNER", async () => {
    // Seed legacy coworking_master.json lacking DAGO_SPACES
    await writePersistentData("coworking_master.json", {
      spaces: [{ id: "sp-hot-1", name: "Legacy Hot Desk", type: "HOT_DESK", area: "Old", capacity: 8, hourlyRate: 15000, dailyRate: 65000, status: "AVAILABLE", amenities: [] }],
      members: [],
      checkLogs: [],
      plans: [],
    });

    // 1. Tenant OWNER rejected on staff branch (403)
    vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
      isAuthenticated: true,
      userId: "tenant-owner-1",
      name: "Pemilik Mitra",
      role: "OWNER",
      scopeLevel: "TENANT",
      tenantId: "tenant-ks",
      permissions: [],
    });
    const tenantOwnerRes = await postCoworkingBooking(
      new NextRequest("http://localhost:3000/api/coworking/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          booking: {
            guestName: "Tenant Intruder",
            spaceId: "sp-os-01",
            bookingType: "HOURLY",
            date: "2099-01-05",
            startTime: "10:00",
            duration: 2,
          },
        }),
      })
    );
    expect(tenantOwnerRes.status).toBe(403);

    // 2. Staff booking on Dago Space Monitor (5h non-tier capped to 60.000) ignores tampered totalAmount: 1
    vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
      isAuthenticated: true,
      userId: "cashier-1",
      name: "Kasir Hub",
      role: "CASHIER",
      scopeLevel: "OUTLET",
      permissions: [],
    });
    const staffRes = await postCoworkingBooking(
      new NextRequest("http://localhost:3000/api/coworking/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          booking: {
            guestName: "Budi Staff",
            spaceId: "sp-sm-01",
            bookingType: "HOURLY",
            date: "2099-01-05",
            startTime: "10:00",
            duration: "5",
            totalAmount: 1,
            paymentMethod: "CASH",
            paymentStatus: "PAID",
          },
        }),
      })
    );
    expect(staffRes.status).toBe(200);
    const staffJson = await staffRes.json();
    expect(staffJson.booking.price).toBe(60000);
    expect(staffJson.booking.totalAmount).toBe(60000);
    expect(staffJson.booking.endTime).toBe("15:00");

    // 3. Customer booking with DAILY 14 days (>9), MONTHLY 30 days, and COWORK50 promo
    vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
      isAuthenticated: true,
      userId: "cust-1",
      name: "Customer Demo",
      email: "customer@example.com",
      role: "CUSTOMER",
      scopeLevel: "OUTLET",
      permissions: [],
    });
    const customerDailyRes = await postCoworkingBooking(
      new NextRequest("http://localhost:3000/api/coworking/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          booking: {
            guestName: "Customer Promo",
            spaceId: "sp-os-01",
            bookingType: "DAILY",
            date: "2099-01-12",
            endDate: "2099-01-16",
            duration: 14,
            promoCode: "COWORK50",
            paymentMethod: "QRIS",
          },
        }),
      })
    );
    expect(customerDailyRes.status).toBe(200);
    const customerDailyJson = await customerDailyRes.json();
    // 14 days * 70,000 = 980,000 - COWORK50 (50,000) = 930,000
    expect(customerDailyJson.booking.price).toBe(980000);
    expect(customerDailyJson.booking.discount).toBe(50000);
    expect(customerDailyJson.booking.totalAmount).toBe(930000);

    const customerMonthlyRes = await postCoworkingBooking(
      new NextRequest("http://localhost:3000/api/coworking/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          booking: {
            guestName: "Customer Monthly",
            spaceId: "sp-os-01",
            bookingType: "MONTHLY",
            date: "2099-02-02",
            endDate: "2099-03-03",
            duration: 30,
            paymentMethod: "QRIS",
          },
        }),
      })
    );
    expect(customerMonthlyRes.status).toBe(200);
    const customerMonthlyJson = await customerMonthlyRes.json();
    // MONTHLY without explicit monthlyRate uses dailyRate * 20 = 1,400,000
    expect(customerMonthlyJson.booking.price).toBe(1400000);
    expect(customerMonthlyJson.booking.totalAmount).toBe(1400000);
    expect(customerMonthlyJson.booking.endDate).toBe("2099-03-03");
  });

  it("allows DAILY booking on OPEN_SPACE (cap 20) with 20 non-overlapping 1h HOURLY bookings and rejects when 20 overlap 10:00-11:00", () => {
    const makeHourly = (idx: number, startTime: string, endTime: string): CoworkingBooking => ({
      id: `bk-h-${idx}`,
      bookingCode: `CWK-H-${idx}`,
      guestName: `Tamu ${idx}`,
      guestPhone: `08111${idx}`,
      guestEmail: `tamu${idx}@example.com`,
      spaceId: "sp-os-01",
      spaceName: "Open Space",
      spaceType: "OPEN_SPACE",
      bookingType: "HOURLY",
      date: "2099-04-06",
      endDate: "2099-04-06",
      startTime,
      endTime,
      duration: 1,
      totalAmount: 10000,
      paymentStatus: "PAID",
      checkInStatus: "RESERVED",
    });

    // 20 non-overlapping 1-hour slots across 4 distinct hours (max concurrent per hour = 5 < 20),
    // or 20 sequential non-overlapping bookings across 2099-04-06: max concurrent = 5 < 20
    const nonOverlapping20: CoworkingBooking[] = Array.from({ length: 20 }, (_, i) => {
      const hourOffset = i % 5; // 09..13, 4 bookings per slot => max concurrent 4 < 20
      const startH = String(9 + hourOffset).padStart(2, "0");
      const endH = String(10 + hourOffset).padStart(2, "0");
      return makeHourly(i, `${startH}:00`, `${endH}:00`);
    });

    const dailyAllowed = checkCoworkingBookingConflict(nonOverlapping20, {
      spaceId: "sp-os-01",
      spaceName: "Open Space",
      bookingType: "DAILY",
      date: "2099-04-06",
      endDate: "2099-04-06",
      startTime: "09:00",
      maxCapacity: 20,
    });
    expect(dailyAllowed.hasConflict).toBe(false);

    // 20 bookings all overlapping 10:00-11:00 => max concurrent = 20 >= 20 => conflict
    const overlapping20: CoworkingBooking[] = Array.from({ length: 20 }, (_, i) =>
      makeHourly(i, "10:00", "11:00")
    );
    const dailyRejected = checkCoworkingBookingConflict(overlapping20, {
      spaceId: "sp-os-01",
      spaceName: "Open Space",
      bookingType: "DAILY",
      date: "2099-04-06",
      endDate: "2099-04-06",
      startTime: "09:00",
      maxCapacity: 20,
    });
    expect(dailyRejected.hasConflict).toBe(true);
  });

  it("enforces MONTHLY duration=27 rejection, authoritative endDate, billedViaPosOrder link validation, matchedExisting PAID->PENDING guard, F&B TENANT promo isolation, and promo quota redemption", async () => {
    await writePersistentData("platform_settings.json", {
      ...DEFAULT_PLATFORM_SETTINGS,
      promos: [
        ...DEFAULT_PLATFORM_SETTINGS.promos,
        {
          id: "promo-mitra-only",
          code: "MITRA20",
          name: "Diskon Mitra Kopi Senja",
          discountType: "PERCENTAGE",
          discountValue: 20,
          targetType: "TENANT",
          targetId: "tenant-ks",
          tenantId: "tenant-ks",
          scope: "ALL",
          isActive: true,
        },
        {
          id: "promo-cw-single",
          code: "CWSINGLE",
          name: "Coworking Single Use",
          discountType: "FIXED",
          discountValue: 20000,
          targetType: "ALL",
          scope: "COWORKING",
          quota: 2,
          usageCount: 0,
          usedBy: [],
          isActive: true,
        },
      ],
    });

    vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
      isAuthenticated: true,
      userId: "cashier-1",
      name: "Kasir Hub",
      role: "CASHIER",
      scopeLevel: "OUTLET",
      permissions: [],
    });

    // 1. MONTHLY duration: 27 rejected 400
    const badMonthlyRes = await postCoworkingBooking(
      new NextRequest("http://localhost:3000/api/coworking/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          booking: {
            guestName: "Bad Monthly",
            spaceId: "sp-os-01",
            bookingType: "MONTHLY",
            date: "2099-05-04",
            duration: 27,
            paymentMethod: "CASH",
            paymentStatus: "PAID",
          },
        }),
      })
    );
    expect(badMonthlyRes.status).toBe(400);

    // 2. MONTHLY duration: 30 overwrites tampered endDate "2099-12-31" with authoritative "2099-06-02"
    const goodMonthlyRes = await postCoworkingBooking(
      new NextRequest("http://localhost:3000/api/coworking/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          booking: {
            guestName: "Tamper EndDate",
            spaceId: "sp-os-01",
            bookingType: "MONTHLY",
            date: "2099-05-04",
            endDate: "2099-12-31",
            duration: 30,
            paymentMethod: "CASH",
            paymentStatus: "PAID",
          },
        }),
      })
    );
    expect(goodMonthlyRes.status).toBe(200);
    const goodMonthlyJson = await goodMonthlyRes.json();
    expect(goodMonthlyJson.booking.endDate).toBe("2099-06-02");

    // 3. billedViaPosOrder with missing / non-existent linkedOrderId rejected
    const missingLinkRes = await postCoworkingBooking(
      new NextRequest("http://localhost:3000/api/coworking/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          booking: {
            guestName: "Fake POS Link",
            spaceId: "sp-sm-01",
            bookingType: "HOURLY",
            date: "2099-05-04",
            startTime: "10:00",
            duration: 2,
            paymentMethod: "CASH",
            paymentStatus: "PAID",
            billedViaPosOrder: true,
            linkedOrderId: "ORD-DOES-NOT-EXIST",
          },
        }),
      })
    );
    expect([400, 409]).toContain(missingLinkRes.status);

    // Cancelled POS order is also rejected
    const cancelledPosOrder: OrderRecord = {
      id: "ord-cancelled-1",
      orderNumber: "20990504-999",
      organizationId: "org-dago",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "01",
      customerName: "Budi",
      orderType: "DINE_IN",
      status: "CANCELLED",
      paymentStatus: "PENDING",
      paymentMethod: "CASH",
      subtotal: 50000,
      tax: 0,
      total: 50000,
      targetServiceMinutes: 15,
      items: [],
      statusHistory: [],
      createdAt: new Date().toISOString(),
    };
    await savePersistentOrder(cancelledPosOrder);
    const cancelledLinkRes = await postCoworkingBooking(
      new NextRequest("http://localhost:3000/api/coworking/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          booking: {
            guestName: "Cancelled POS Link",
            spaceId: "sp-sm-01",
            bookingType: "HOURLY",
            date: "2099-05-04",
            startTime: "10:00",
            duration: 2,
            paymentMethod: "CASH",
            paymentStatus: "PAID",
            billedViaPosOrder: true,
            linkedOrderId: "20990504-999",
          },
        }),
      })
    );
    expect([400, 409]).toContain(cancelledLinkRes.status);

    // 4. F&B TENANT promo rejected on COWORKING
    const tenantPromoRes = await postCoworkingBooking(
      new NextRequest("http://localhost:3000/api/coworking/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          booking: {
            guestName: "Tenant Promo User",
            guestPhone: "0812340001",
            spaceId: "sp-sm-01",
            bookingType: "HOURLY",
            date: "2099-05-04",
            startTime: "10:00",
            duration: 2,
            promoCode: "MITRA20",
            paymentMethod: "CASH",
            paymentStatus: "PAID",
          },
        }),
      })
    );
    expect(tenantPromoRes.status).toBe(400);

    // 5. Promo quota & single-use increments on success and rejects repeat customer
    const promoOkRes = await postCoworkingBooking(
      new NextRequest("http://localhost:3000/api/coworking/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          booking: {
            guestName: "Promo First Use",
            guestPhone: "0812340099",
            spaceId: "sp-sm-01",
            bookingType: "HOURLY",
            date: "2099-05-04",
            startTime: "10:00",
            duration: 2,
            promoCode: "CWSINGLE",
            paymentMethod: "CASH",
            paymentStatus: "PAID",
          },
        }),
      })
    );
    expect(promoOkRes.status).toBe(200);
    const promoOkJson = await promoOkRes.json();
    expect(promoOkJson.booking.discount).toBe(20000);
    expect(promoOkJson.booking.totalAmount).toBe(6000);

    const updatedSettings = await readSeededPersistentData<PlatformSettings>(
      "platform_settings.json",
      () => DEFAULT_PLATFORM_SETTINGS
    );
    const redeemedPromo = updatedSettings.promos.find((p) => p.id === "promo-cw-single");
    expect(redeemedPromo?.usageCount).toBe(1);
    expect(redeemedPromo?.usedBy).toContain("0812340099");

    // Second attempt by same customerId is rejected
    const promoRepeatRes = await postCoworkingBooking(
      new NextRequest("http://localhost:3000/api/coworking/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          booking: {
            guestName: "Promo Repeat Use",
            guestPhone: "0812340099",
            spaceId: "sp-sm-01",
            bookingType: "HOURLY",
            date: "2099-05-04",
            startTime: "12:00",
            duration: 2,
            promoCode: "CWSINGLE",
            paymentMethod: "CASH",
            paymentStatus: "PAID",
          },
        }),
      })
    );
    expect(promoRepeatRes.status).toBe(400);

    // 6. matchedExisting PAID -> PENDING downgrade rejected 403
    const downgradeRes = await postCoworkingBooking(
      new NextRequest("http://localhost:3000/api/coworking/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          booking: {
            ...promoOkJson.booking,
            paymentStatus: "PENDING",
          },
        }),
      })
    );
    expect(downgradeRes.status).toBe(403);
  });

  it("allows 2nd CUSTOMER booking with distinct id and colliding client bookingCode by minting a unique server bookingCode", async () => {
    const collidingCode = "CWK-DAGO-20261126-0001";

    vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
      isAuthenticated: true,
      userId: "cust-collide-1",
      name: "Customer Satu",
      email: "satu@example.com",
      role: "CUSTOMER",
      scopeLevel: "OUTLET",
      permissions: [],
    });

    const firstRes = await postCoworkingBooking(
      new NextRequest("http://localhost:3000/api/coworking/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          booking: {
            id: "cwb-cust-1",
            bookingCode: collidingCode,
            guestName: "Customer Satu",
            guestPhone: "0811111001",
            spaceId: "sp-os-01",
            bookingType: "HOURLY",
            date: "2099-05-04",
            startTime: "10:00",
            duration: 2,
            paymentMethod: "QRIS",
          },
        }),
      })
    );
    expect(firstRes.status).toBe(200);
    const firstJson = await firstRes.json();
    expect(firstJson.booking.id).toBe("cwb-cust-1");
    expect(firstJson.booking.bookingCode).toBe(collidingCode);

    vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
      isAuthenticated: true,
      userId: "cust-collide-2",
      name: "Customer Dua",
      email: "dua@example.com",
      role: "CUSTOMER",
      scopeLevel: "OUTLET",
      permissions: [],
    });

    const secondRes = await postCoworkingBooking(
      new NextRequest("http://localhost:3000/api/coworking/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          booking: {
            id: "cwb-cust-2",
            bookingCode: collidingCode,
            guestName: "Customer Dua",
            guestPhone: "0811111002",
            spaceId: "sp-os-01",
            bookingType: "HOURLY",
            date: "2099-05-04",
            startTime: "10:00",
            duration: 2,
            paymentMethod: "QRIS",
          },
        }),
      })
    );
    expect(secondRes.status).toBe(200);
    const secondJson = await secondRes.json();
    expect(secondJson.booking.id).toBe("cwb-cust-2");
    expect(secondJson.booking.bookingCode).toBeTruthy();
    expect(secondJson.booking.bookingCode).not.toBe(collidingCode);

    const saved = await getCoworkingBookings();
    expect(saved.some((b) => b.id === "cwb-cust-1" && b.bookingCode === collidingCode)).toBe(true);
    expect(
      saved.some(
        (b) => b.id === "cwb-cust-2" && b.bookingCode === secondJson.booking.bookingCode
      )
    ).toBe(true);
  });

  it("blocks tenant-owned promo (targetType ALL, scope undefined) on DAGO_HUB coworking items while allowing matching tenant F&B items", () => {
    const tenantPromo: PromoConfig = {
      id: "promo-ks-all",
      code: "KSALL",
      name: "Diskon Semua Menu Kopi Senja",
      discountType: "PERCENTAGE",
      discountValue: 15,
      targetType: "ALL",
      tenantId: "tenant-ks",
      isActive: true,
    };

    expect(
      isPromoEligibleForItem(
        {
          productId: "sp-os-01",
          category: "Co-Working",
          tenantId: "DAGO_HUB",
          quantity: 1,
          unitPrice: 70000,
        },
        tenantPromo
      )
    ).toBe(false);

    expect(
      isPromoEligibleForItem(
        {
          productId: "kopi-senja-1",
          category: "Minuman",
          tenantId: "tenant-ks",
          quantity: 1,
          unitPrice: 25000,
        },
        tenantPromo
      )
    ).toBe(true);

    expect(
      isPromoEligibleForItem(
        {
          productId: "dapur-mama-1",
          category: "Makanan",
          tenantId: "tenant-kitchen",
          quantity: 1,
          unitPrice: 30000,
        },
        tenantPromo
      )
    ).toBe(false);
  });
});

