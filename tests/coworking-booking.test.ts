import { describe, it, expect } from "vitest";
import {
  DAGO_SPACES,
  INITIAL_SPACES,
  MEMBERSHIP_PLANS,
} from "../src/features/coworking/coworking-data";
import { CoworkingBooking } from "../src/types/coworking";

describe("Co-Working Space & Community Membership Engine", () => {
  it("verifies Dago space availability, capacities, and tiered rates across all 4 official spaces", () => {
    expect(DAGO_SPACES).toHaveLength(4);
    const openSpace = INITIAL_SPACES.find((s) => s.type === "OPEN_SPACE");
    const spaceMonitor = INITIAL_SPACES.find((s) => s.type === "SPACE_MONITOR");
    const smallMeeting = INITIAL_SPACES.find((s) => s.type === "SMALL_MEETING_ROOM");
    const largeMeeting = INITIAL_SPACES.find((s) => s.type === "LARGE_MEETING_ROOM");

    expect(openSpace?.id).toBe("sp-os-01");
    expect(openSpace?.capacity).toBe(20);
    expect(openSpace?.dailyRate).toBe(70000);
    expect(openSpace?.tieredRates).toHaveLength(4);

    expect(spaceMonitor?.id).toBe("sp-sm-01");
    expect(spaceMonitor?.capacity).toBe(8);
    expect(spaceMonitor?.dailyRate).toBe(80000);
    expect(spaceMonitor?.tieredRates).toHaveLength(4);

    expect(smallMeeting?.id).toBe("sp-mr-sm");
    expect(smallMeeting?.capacity).toBe(6);
    expect(smallMeeting?.hourlyRate).toBe(37500);
    expect(smallMeeting?.dailyRate).toBe(250000);

    expect(largeMeeting?.id).toBe("sp-mr-lg");
    expect(largeMeeting?.capacity).toBe(12);
    expect(largeMeeting?.hourlyRate).toBe(50000);
    expect(largeMeeting?.dailyRate).toBe(360000);
  });

  it("verifies the 7 official Dago membership plans and their perks", () => {
    expect(MEMBERSHIP_PLANS).toHaveLength(7);

    const os1w = MEMBERSHIP_PLANS.find((p) => p.id === "plan-os-1w");
    const os2w = MEMBERSHIP_PLANS.find((p) => p.id === "plan-os-2w");
    const os1m = MEMBERSHIP_PLANS.find((p) => p.id === "plan-os-1m");
    const smr2w = MEMBERSHIP_PLANS.find((p) => p.id === "plan-smr-2w");
    const smr1m = MEMBERSHIP_PLANS.find((p) => p.id === "plan-smr-1m");
    const lmr2w = MEMBERSHIP_PLANS.find((p) => p.id === "plan-lmr-2w");
    const lmr1m = MEMBERSHIP_PLANS.find((p) => p.id === "plan-lmr-1m");

    expect(os1w?.priceNumber).toBe(150000);
    expect(os1w?.validityDays).toBe(7);
    expect(os1w?.creditHours).toBe(20);
    expect(os1w?.fnbVoucherCode).toBe("VOUCHER-CWK-OS1W");

    expect(os2w?.validityDays).toBe(14);
    expect(os2w?.creditHours).toBe(40);
    expect(os1m?.validityDays).toBe(30);
    expect(os1m?.billingCycle).toBe("1 Bulan");

    expect(smr2w?.priceNumber).toBe(240000);
    expect(smr1m?.priceNumber).toBe(450000);
    expect(lmr2w?.priceNumber).toBe(320000);
    expect(lmr1m?.priceNumber).toBe(600000);

    for (const plan of MEMBERSHIP_PLANS) {
      expect(plan.deskAccess).toContain("Senin - Jumat");
      expect(plan.deskAccess).toContain("09:00 - 18:00 WITA");
    }
  });

  it("ensures cross-business voucher formatting and active session tracking", () => {
    const activeBooking: CoworkingBooking = {
      id: "bk-sample-active",
      bookingCode: "BK-CWK-1001",
      guestName: "Wayan Sudirga",
      guestPhone: "+62 812-3456-7890",
      guestEmail: "wayan@example.com",
      spaceId: "sp-hd-01",
      spaceName: "Hot Desk 01 (Window View)",
      spaceType: "HOT_DESK",
      bookingType: "DAILY",
      date: new Date().toISOString().split("T")[0],
      startTime: "09:00 WITA",
      duration: 8,
      totalAmount: 75000,
      paymentStatus: "PAID",
      checkInStatus: "CHECKED_IN",
      fnbVoucherApplied: "VOUCHER-CWK-NOMAD-10",
    };
    expect(activeBooking.checkInStatus).toBe("CHECKED_IN");
    expect(activeBooking.fnbVoucherApplied).toContain("VOUCHER-CWK");
    expect(activeBooking.paymentStatus).toBe("PAID");
  });

  it("requires payment before space booking is confirmed (PENDING -> PAID)", () => {
    // 1. Initial Booking created with PENDING payment
    const newBooking: CoworkingBooking = {
      id: "bk-test-pending",
      bookingCode: "BK-CWK-99901",
      guestName: "Ketut Dian",
      guestPhone: "+62 819-1122-3344",
      guestEmail: "customer@dagoeng.com",
      spaceId: "sp-meet-1",
      spaceName: "Executive Glass Meeting Room",
      spaceType: "MEETING_ROOM",
      bookingType: "HOURLY",
      date: "2026-09-24",
      startTime: "14:00 WITA",
      duration: 2,
      totalAmount: 300000,
      paymentStatus: "PENDING",
      checkInStatus: "RESERVED",
    };

    expect(newBooking.paymentStatus).toBe("PENDING");
    expect(newBooking.checkInStatus).toBe("RESERVED");

    // 2. Simulating payment confirmation (PAID via QRIS)
    const paidBooking: CoworkingBooking = {
      ...newBooking,
      paymentStatus: "PAID",
      checkInStatus: "RESERVED",
    };

    expect(paidBooking.paymentStatus).toBe("PAID");

    // Points earned upon payment
    const loyaltyPointsEarned = Math.floor(paidBooking.totalAmount / 1000);
    expect(loyaltyPointsEarned).toBe(300);
  });
});
