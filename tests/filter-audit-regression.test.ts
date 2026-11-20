import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { EDGE_SESSION_COOKIE_NAME, signEdgeSessionToken } from "@/lib/edge-session";
import {
  formatWitaDateTime,
  normalizeDateRange,
  toWitaDateKey,
} from "@/contexts/DateFilterContext";
import { bucketOrdersByDateRange } from "@/features/dashboard/dashboard-metrics";
import { checkPromoValidity, getPromoComputedStatus } from "@/lib/promo";
import type { PromoConfig } from "@/lib/promo";
import { filterActivityLogs } from "@/features/activity-log/activity-log-domain";
import type { ActivityLogEntry } from "@/types/audit";
import { checkSlotAvailability } from "@/features/pos/pos-coworking";
import {
  checkCoworkingBookingConflict,
  validateCoworkingBookingSchedule,
} from "@/lib/operating-hours";
import { isVoucherTierEligible } from "@/features/pos/PosVoucherModal";
import {
  bookingStatusLabel,
  filterCustomerProducts,
  spaceTypeLabel,
} from "@/features/customer/customer-domain";
import { filterEmployees, filterShifts } from "@/features/employees/employees-domain";
import { filterMembers } from "@/features/customers/customers-domain";
import { filterCoworkingBookings } from "@/features/coworking/coworking-domain";
import {
  getWitaDaysAgoString,
  isEventInWitaPeriod,
  isTimestampInWitaPeriod,
} from "@/components/events/EventDateRangeFilter";
import {
  CATALOG_CATEGORIES,
  eventPriceLabel,
  filterPublicEvents,
} from "@/features/events-catalog/events-catalog-domain";
import {
  calculateEventsKPI,
  filterBookings,
} from "@/features/events-admin/events-admin-domain";
import { filterOrganizerAttendees } from "@/features/events-portal/events-portal-domain";
import { GET as getCoworkingBookingsRoute } from "@/app/api/coworking/bookings/route";
import type { CoworkingBooking, CoworkingSpaceItem } from "@/types/coworking";
import type { EventTicketOrder, PublicCommunityEvent } from "@/types/event";

describe("Filter audit behavioral regressions", () => {
  describe("DateFilterContext WITA date parsing and range normalization", () => {
    it("normalizes inverted custom ranges by swapping start and end dates", () => {
      expect(normalizeDateRange("2026-11-20", "2026-11-05", "2026-11-18")).toEqual({
        startDate: "2026-11-05",
        endDate: "2026-11-20",
      });
      expect(normalizeDateRange("2026-11-12", "", "2026-11-18")).toEqual({
        startDate: "2026-11-12",
        endDate: "2026-11-12",
      });
    });

    it("parses Indonesian month labels with time, periods, and DD/MM/YYYY without US swap", () => {
      expect(toWitaDateKey("18 Agu 2026 14.30 WITA")).toBe("2026-08-18");
      expect(toWitaDateKey("18 Agustus 2026")).toBe("2026-08-18");
      expect(toWitaDateKey("09 Sep. 2026, 09:15 WITA")).toBe("2026-09-09");
      expect(toWitaDateKey("14 Mei 2026")).toBe("2026-05-14");
      expect(toWitaDateKey("22 Okt 2026")).toBe("2026-10-22");
      expect(toWitaDateKey("31 Des 2026")).toBe("2026-12-31");
      expect(toWitaDateKey("05/11/2026")).toBe("2026-11-05");
      expect(toWitaDateKey("05/11/2026 16:45")).toBe("2026-11-05");
      expect(formatWitaDateTime("18 Agu 2026 14.30 WITA", "dd MMM yyyy")).toBe("18 Agu 2026");
      expect(formatWitaDateTime("05/11/2026 16:45", "dd MMM yyyy")).toBe("05 Nov 2026");
    });
  });

  describe("Dashboard revenue chart date-range bucketing", () => {
    const orders = [
      {
        total: 120000,
        discount: 0,
        createdAt: "2026-10-05T03:00:00.000Z",
      },
      {
        total: 80000,
        discount: 5000,
        createdAt: "2026-10-07T06:00:00.000Z",
      },
    ];

    it("buckets historical custom ranges instead of hardcoding the last 7 days from today", () => {
      const buckets = bucketOrdersByDateRange(
        orders,
        "2026-10-04",
        "2026-10-08",
        new Date("2026-11-18T04:00:00.000Z")
      );
      expect(buckets).toHaveLength(5);
      expect(buckets.find((b) => b.date === "2026-10-05")?.revenue).toBe(120000);
      expect(buckets.find((b) => b.date === "2026-10-07")?.revenue).toBe(80000);
      expect(buckets.reduce((sum, b) => sum + b.revenue, 0)).toBe(200000);
    });

    it("buckets a single-day range and normalizes inverted inputs", () => {
      const singleDay = bucketOrdersByDateRange(
        orders,
        "2026-10-05",
        "2026-10-05",
        new Date("2026-11-18T04:00:00.000Z")
      );
      expect(singleDay).toHaveLength(1);
      expect(singleDay[0].revenue).toBe(120000);

      const inverted = bucketOrdersByDateRange(
        orders,
        "2026-10-08",
        "2026-10-04",
        new Date("2026-11-18T04:00:00.000Z")
      );
      expect(inverted).toHaveLength(5);
      expect(inverted.reduce((sum, b) => sum + b.revenue, 0)).toBe(200000);
    });
  });

  describe("Promo WITA start-of-day and end-of-day validity", () => {
    const basePromo: any = {
      id: "promo-nov18",
      name: "Promo Hari Kerja",
      type: "AUTOMATIC_PROMO",
      scope: "ALL",
      targetType: "ALL",
      discountType: "PERCENTAGE",
      discountValue: 10,
      validFrom: "2026-11-18",
      validUntil: "2026-11-18",
      isActive: true,
      usageCount: 0,
      createdAt: "2026-11-01T00:00:00.000Z",
      updatedAt: "2026-11-01T00:00:00.000Z",
    };

    it("keeps YYYY-MM-DD promos active from 00:00 WITA through 23:59:59.999 WITA", () => {
      const earlyMorningWita = new Date("2026-11-18T01:00:00+08:00");
      const afternoonWita = new Date("2026-11-18T14:00:00+08:00");
      const nextDayWita = new Date("2026-11-19T00:01:00+08:00");

      expect(getPromoComputedStatus(basePromo, earlyMorningWita)).toBe("ACTIVE");
      expect(getPromoComputedStatus(basePromo, afternoonWita)).toBe("ACTIVE");
      expect(checkPromoValidity(basePromo, 50000, { atDate: earlyMorningWita }).isValid).toBe(true);
      expect(checkPromoValidity(basePromo, 50000, { atDate: afternoonWita }).isValid).toBe(true);
      expect(getPromoComputedStatus(basePromo, nextDayWita)).toBe("EXPIRED");
    });
  });

  describe("Activity log WITA date, custom range, outlet ALL, and localized search", () => {
    const sampleLogs: ActivityLogEntry[] = [
      {
        id: "log-global-1",
        timestamp: "2026-11-18T00:30:00+08:00",
        userName: "Super Admin",
        userRole: "SUPER_ADMIN",
        outletId: "ALL",
        module: "SECURITY",
        action: "LOGIN",
        description: "Otentikasi sesi admin berhasil",
        status: "SUCCESS",
        severity: "INFO",
      },
      {
        id: "log-corrupt",
        timestamp: "not-a-timestamp",
        userName: "Ghost",
        userRole: "STAFF",
        outletId: "OUTLET-001",
        module: "POS_ORDER" as any,
        action: "CREATE",
        description: "Data korup",
        status: "FAILED",
        severity: "CRITICAL",
      },
    ];

    it("retains outletId ALL logs under outlet scoping, matches CUSTOM WITA range, and rejects NaN timestamps", () => {
      const result = filterActivityLogs(sampleLogs, {
        activeOutletId: "OUTLET-001",
        dateFilter: "CUSTOM",
        customStartDate: "2026-11-18",
        customEndDate: "2026-11-18",
      });
      expect(result.map((l) => l.id)).toEqual(["log-global-1"]);
    });

    it("matches localized Indonesian module and action labels in search", () => {
      const byLocalizedModule = filterActivityLogs(sampleLogs, {
        searchTerm: "keamanan",
      });
      expect(byLocalizedModule.map((l) => l.id)).toEqual(["log-global-1"]);
    });
  });

  describe("POS coworking slot availability, conflict parity, and voucher tier gate", () => {
    const hotDeskSpace: CoworkingSpaceItem = {
      id: "sp-hotdesk",
      name: "Hot Desk Utama",
      type: "HOT_DESK",
      capacity: 8,
      hourlyRate: 15000,
      dailyRate: 60000,
      monthlyRate: 900000,
      area: "Ground Floor Main",
      status: "AVAILABLE",
      amenities: ["WiFi"],
    };

    const makeBooking = (overrides: any): any => ({
      id: "cw-1",
      bookingCode: "CW-001",
      guestName: "Tamu Satu",
      guestPhone: "081234567890",
      spaceId: "sp-hotdesk",
      spaceName: "Hot Desk Utama",
      bookingType: "HOURLY",
      date: "2026-11-18",
      startTime: "10:00",
      endTime: "12:00",
      duration: 2,
      basePrice: 30000,
      discountAmount: 0,
      totalPrice: 30000,
      paymentStatus: "PAID",
      checkInStatus: "RESERVED",
      createdAt: "2026-11-18T01:00:00.000Z",
      ...overrides,
    });

    it("blocks MAINTENANCE rooms, allows up to 8 seats on HOT_DESK, and frees COMPLETED early check-outs", () => {
      const maintenanceSpace: CoworkingSpaceItem = { ...hotDeskSpace, status: "MAINTENANCE" };
      expect(
        checkSlotAvailability({
          spaceId: "sp-hotdesk",
          spaces: [maintenanceSpace],
          bookings: [],
          targetDate: "2026-11-18",
          startHour: 10,
          durationHours: 2,
        }).isAvailable
      ).toBe(false);

      const singleSeatTaken = [makeBooking({ id: "cw-seat-1" })];
      expect(
        checkSlotAvailability({
          spaceId: "sp-hotdesk",
          spaces: [hotDeskSpace],
          bookings: singleSeatTaken,
          targetDate: "2026-11-18",
          startHour: 10,
          durationHours: 2,
        }).isAvailable
      ).toBe(true);
      expect(
        checkCoworkingBookingConflict(singleSeatTaken, {
          spaceId: "sp-hotdesk",
          bookingType: "HOURLY",
          date: "2026-11-18",
          startTime: "10:00",
          endTime: "12:00",
          maxCapacity: 8,
        }).hasConflict
      ).toBe(false);

      const privateRoom: CoworkingSpaceItem = {
        ...hotDeskSpace,
        id: "sp-pod",
        type: "PRIVATE_ROOM",
        capacity: 4,
      };
      const completedEarly = [
        makeBooking({
          id: "cw-done",
          spaceId: "sp-pod",
          checkInStatus: "COMPLETED",
        }),
      ];
      expect(
        checkSlotAvailability({
          spaceId: "sp-pod",
          spaces: [privateRoom],
          bookings: completedEarly,
          targetDate: "2026-11-18",
          startHour: 10,
          durationHours: 2,
        }).isAvailable
      ).toBe(true);
    });

    it("rejects multi-day coworking schedules that cross weekend closed days or invert endDate", () => {
      const crossesWeekend = validateCoworkingBookingSchedule({
        bookingType: "DAILY",
        date: "2026-11-20",
        endDate: "2026-11-23",
      });
      expect(crossesWeekend.isValid).toBe(false);

      const inverted = validateCoworkingBookingSchedule({
        bookingType: "DAILY",
        date: "2026-11-19",
        endDate: "2026-11-18",
      });
      expect(inverted.isValid).toBe(false);
    });

    it("enforces minimum loyalty tier on POS vouchers", () => {
      expect(isVoucherTierEligible("Bronze", "Gold")).toBe(false);
      expect(isVoucherTierEligible("Gold", "Gold")).toBe(true);
      expect(isVoucherTierEligible("Platinum", "Gold")).toBe(true);
    });
  });

  describe("Customer catalog and coworking labels", () => {
    it("excludes INACTIVE products and resolves canonical tenant slugs", () => {
      const products = [
        {
          id: "p-active",
          sku: "KS-1",
          name: "Es Kopi Dago",
          category: "Minuman",
          price: 25000,
          cost: 10000,
          stock: 10,
          minStock: 2,
          unit: "Cup",
          status: "ACTIVE" as const,
          outletId: "OUTLET-001",
        },
        {
          id: "p-inactive",
          sku: "KS-2",
          name: "Menu Lama",
          category: "Minuman",
          price: 20000,
          cost: 8000,
          stock: 10,
          minStock: 2,
          unit: "Cup",
          status: "INACTIVE" as const,
          outletId: "OUTLET-001",
        },
      ];
      const visible = filterCustomerProducts(products as any, { partnerId: "tenant-ks", category: "Semua", searchQuery: "" });
      expect(visible.map((p) => p.id)).toEqual(["p-active"]);
      expect(spaceTypeLabel("PRIVATE_POD")).toBe("Private pod");
      expect(bookingStatusLabel("RESERVED")).toBe("Dipesan");
    });
  });

  describe("CRM, HR, and Coworking API/domain filters", () => {
    it("matches normalized Indonesian phone numbers and emails across customers, employees, and coworking", () => {
      const members = [
        {
          id: "m-1",
          name: "Kadek Ayu",
          phone: "+62 812-3456-7890",
          email: "kadek@dago.id",
          points: 150,
          tier: "Silver" as const,
          joinDate: "2026-01-10",
          lastVisit: "2026-11-17",
          totalSpent: 450000,
        },
      ];
      expect(filterMembers(members as any, "081234567890", "ALL")).toHaveLength(1);

      const employees = [
        {
          id: "emp-1",
          employeeNumber: "EMP-01",
          name: "Gede Putra",
          role: "Barista",
          department: "F&B" as const,
          outletId: "OUTLET-001",
          outletName: "Dago Singaraja",
          status: "AKTIF" as const,
          joinDate: "2026-02-01",
          contact: "+62 819-9988-7766",
          email: "gede@dago.id",
          pin: "1234",
        },
      ];
      expect(filterEmployees(employees as any, "ALL", "ALL", "081999887766")).toHaveLength(1);
      expect(filterEmployees(employees as any, "ALL", "ALL", "gede@dago.id")).toHaveLength(1);

      const shifts = [
        {
          id: "sh-1",
          shiftName: "Shift Pagi",
          assignedCashierId: "emp-1",
          assignedCashierName: "Gede Putra",
          outletId: "OUTLET-001",
          startTime: "2026-11-17T23:30:00.000Z",
          openingBalance: 200000,
          systemExpectedCash: 350000,
          status: "OPEN" as const,
        },
      ];
      expect(filterShifts(shifts as any, "", "ACTIVE", "2026-11-18")).toHaveLength(1);
      expect(filterShifts(shifts as any, "", "ACTIVE", "2026-11-17")).toHaveLength(0);

      const cwBookings: any[] = [
        {
          id: "cwb-1",
          bookingCode: "CW-900",
          guestName: "Putu Adi",
          guestPhone: "+62 813-1122-3344",
          company: "Studio Buleleng",
          spaceId: "sp-1",
          spaceName: "Hot Desk",
          bookingType: "DAILY",
          date: "18 Nov 2026",
          startTime: "09:00",
          duration: 1,
          basePrice: 60000,
          discountAmount: 0,
          totalPrice: 60000,
          paymentStatus: "PAID",
          checkInStatus: "CHECKED_IN",
          createdAt: "2026-11-18T01:00:00.000Z",
        },
      ];
      expect(filterCoworkingBookings(cwBookings, "ALL", "081311223344", "2026-11-18")).toHaveLength(
        1
      );
      expect(filterCoworkingBookings(cwBookings, "ALL", "buleleng", "2026-11-18")).toHaveLength(1);
    });

    it("supports normalized ?date=YYYY-MM-DD and checkInStatus ?status= in GET /api/coworking/bookings", async () => {
      process.env.SESSION_SECRET = "super-secret-session-key-testing-minimum-32-chars-long";
      const token = signEdgeSessionToken({
        userId: "user-admin-filter-test",
        role: "SUPER_ADMIN",
        scopeLevel: "PLATFORM",
        email: "admin@dagoeng.com",
        maxAgeSeconds: 3600,
      });
      const req = new NextRequest(
        "http://localhost:3000/api/coworking/bookings?date=2099-12-31&status=CHECKED_IN",
        {
          headers: {
            cookie: `${EDGE_SESSION_COOKIE_NAME}=${token}`,
          },
        }
      );
      const res = await getCoworkingBookingsRoute(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.bookings)).toBe(true);
      expect(body.bookings).toHaveLength(0);
    });
  });

  describe("Events date-range, catalog tiers/categories, and admin/portal booking filters", () => {
    it("computes WITA relative presets accurately and prevents missing-endDate spillover into next day", () => {
      const refWitaMorning = new Date("2026-11-18T00:30:00+08:00");
      expect(getWitaDaysAgoString(6, refWitaMorning)).toBe("2026-11-12");
      expect(getWitaDaysAgoString(29, refWitaMorning)).toBe("2026-10-20");

      const yesterdayEveningNoEnd = {
        startDate: "2026-11-17T19:00:00+08:00",
      };
      expect(
        isEventInWitaPeriod(yesterdayEveningNoEnd, {
          startDate: "2026-11-17",
          endDate: "2026-11-17",
        })
      ).toBe(true);
      expect(
        isEventInWitaPeriod(yesterdayEveningNoEnd, {
          startDate: "2026-11-18",
          endDate: "2026-11-18",
        })
      ).toBe(false);
      expect(
        isEventInWitaPeriod(
          { startDate: "invalid-date" },
          { startDate: "2026-11-18", endDate: "2026-11-18" }
        )
      ).toBe(false);
      expect(
        isTimestampInWitaPeriod(null, { startDate: "2026-11-18", endDate: "2026-11-18" })
      ).toBe(false);
    });

    it("includes OTHER category and filters multi-tier paid events when base price is 0", () => {
      expect(CATALOG_CATEGORIES.some((c) => c.key === "OTHER")).toBe(true);

      const tieredEvent: PublicCommunityEvent = {
        id: "evt-tiered",
        title: "Konferensi Kreatif Bali Utara",
        description: "Sesi lintas komunitas",
        category: "OTHER",
        startDate: "2026-11-25T09:00:00+08:00",
        endDate: "2026-11-25T17:00:00+08:00",
        location: "Dago Creative Hub",
        isPaid: true,
        price: 0,
        ticketTiers: [
          { id: "t-early", name: "Early Bird", price: 35000, quota: 20, isActive: true },
          { id: "t-reg", name: "Reguler", price: 50000, quota: 30, isActive: true },
        ],
        posterUrl: "",
        organizerName: "Komunitas Buleleng",
        status: "APPROVED",
        createdAt: "2026-11-01T00:00:00Z",
      };

      const nowMs = new Date("2026-11-18T04:00:00Z").getTime();
      expect(
        filterPublicEvents([tieredEvent], "UPCOMING", "OTHER", "PAID", "", nowMs, {
          startDate: "2026-11-25",
          endDate: "2026-11-25",
        })
      ).toHaveLength(1);
      expect(filterPublicEvents([tieredEvent], "UPCOMING", "OTHER", "FREE", "", nowMs)).toHaveLength(
        0
      );
      expect(eventPriceLabel(true, 0, tieredEvent.ticketTiers)).toContain("Mulai");
    });

    it("separates rejected payment proofs from pending verification in events-admin and portal", () => {
      const bookings: EventTicketOrder[] = ([
        {
          id: "bk-pending-valid",
          eventId: "ev-1",
          ticketCode: "DAGO-EVT-101",
          guestName: "Ayu",
          guestEmail: "ayu@dago.id",
          guestPhone: "081234567890",
          ticketCount: 2,
          totalPrice: 100000,
          paymentMethod: "MANUAL_TRANSFER",
          paymentStatus: "PENDING",
          paymentProofUrl: "/uploads/proof-ok.jpg",
          checkInStatus: "REGISTERED",
          createdAt: "2026-11-18T02:00:00.000Z",
        },
        {
          id: "bk-rejected-proof",
          eventId: "ev-1",
          ticketCode: "DAGO-EVT-102",
          guestName: "Bima",
          guestEmail: "bima@dago.id",
          guestPhone: "081298765432",
          ticketCount: 1,
          totalPrice: 50000,
          paymentMethod: "MANUAL_TRANSFER",
          paymentStatus: "PENDING",
          paymentProofUrl: "/uploads/proof-blur.jpg",
          paymentRejectionReason: "Bukti transfer buram",
          checkInStatus: "REGISTERED",
          createdAt: "2026-11-18T03:00:00.000Z",
        },
        {
          id: "bk-partial-checkin",
          eventId: "ev-1",
          ticketCode: "DAGO-EVT-103",
          guestName: "Citra",
          guestEmail: "citra@dago.id",
          guestPhone: "081355556666",
          ticketCount: 3,
          checkedInQty: 1,
          totalPrice: 150000,
          paymentMethod: "MANUAL_TRANSFER",
          paymentStatus: "PAID",
          checkInStatus: "PARTIALLY_CHECKED_IN",
          createdAt: "2026-11-18T04:00:00.000Z",
        },
      ] as any);

      expect(filterBookings(bookings as any, "PENDING_PROOF", "").map((b) => b.id)).toEqual([
        "bk-pending-valid",
      ]);
      expect(filterBookings(bookings, "REJECTED", "").map((b) => b.id)).toEqual([
        "bk-rejected-proof",
      ]);
      expect(calculateEventsKPI([], bookings).pendingPaymentsCount).toBe(1);
      expect(calculateEventsKPI([], bookings).totalTicketsSold).toBe(3);

      expect(
        filterOrganizerAttendees(
          bookings,
          "ALL",
          "",
          { startDate: "2026-11-18", endDate: "2026-11-18" },
          "PAID",
          "PARTIALLY_CHECKED_IN"
        ).map((b) => b.id)
      ).toEqual(["bk-partial-checkin"]);
    });
  });
});
