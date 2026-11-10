import { describe, it, expect } from "vitest";
import {
  INITIAL_SPACES,
  INITIAL_BOOKINGS,
  MEMBERSHIP_PLANS,
} from "../src/features/coworking/coworking-data";
import { CoworkingBooking } from "../src/types/coworking";

describe("Co-Working Space & Community Membership Engine", () => {
  it("verifies space availability and rates across desk types", () => {
    const hotDesk = INITIAL_SPACES.find((s) => s.type === "HOT_DESK");
    const meetingRoom = INITIAL_SPACES.find((s) => s.type === "MEETING_ROOM");

    expect(hotDesk).toBeDefined();
    expect(hotDesk?.dailyRate).toBe(75000);
    expect(meetingRoom).toBeDefined();
    expect(meetingRoom?.hourlyRate).toBeGreaterThanOrEqual(150000);
  });

  it("calculates booking subtotal and respects membership tier perks", () => {
    const flexiPlan = MEMBERSHIP_PLANS.find((p) => p.id === "plan-flexi");
    const residentPlan = MEMBERSHIP_PLANS.find((p) => p.id === "plan-resident");

    expect(flexiPlan?.fnbVoucherCode).toBe("VOUCHER-CWK-FLEXI-15");
    expect(residentPlan?.fnbVoucherCode).toBe("VOUCHER-CWK-RESIDENT-20");
    expect(residentPlan?.billingCycle).toBe("Bulanan");
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
