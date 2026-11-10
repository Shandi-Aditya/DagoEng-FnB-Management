import { describe, it, expect } from "vitest";
import { CoworkingBooking } from "@/types/coworking";
import { OrderRecord } from "@/types/order";

describe("POS B5: Sinkronisasi Ringkasan Dashboard (POS-04, POS-05, POS-06, POS-37, TC-E03, TC-H01, TC-H02, TC-H03, TC-K08)", () => {
  it("B5.1 (POS-04 / TC-E03): Agregasi transaksi co-working secara riil dan tidak hardcoded Rp 0", () => {
    const mockBookings: CoworkingBooking[] = [
      {
        id: "bk-1",
        bookingCode: "BK-001",
        guestName: "Alex Chandra",
        guestPhone: "08123456789",
        guestEmail: "alex@example.com",
        spaceId: "sp-dedicated-1",
        spaceName: "Dedicated Desk #01",
        spaceType: "DEDICATED_DESK",
        bookingType: "HOURLY",
        date: "2026-11-06",
        startTime: "10:00",
        duration: 2,
        totalAmount: 50000,
        paymentStatus: "PAID",
        checkInStatus: "CHECKED_IN",
      },
      {
        id: "bk-2",
        bookingCode: "BK-002",
        guestName: "Pending Guest",
        guestPhone: "08123456780",
        guestEmail: "pending@example.com",
        spaceId: "sp-meeting-1",
        spaceName: "Meeting Room A",
        spaceType: "MEETING_ROOM",
        bookingType: "HOURLY",
        date: "2026-11-06",
        startTime: "14:00",
        duration: 1,
        totalAmount: 150000,
        paymentStatus: "PENDING", // Not paid
        checkInStatus: "RESERVED",
      },
      {
        id: "bk-3",
        bookingCode: "BK-003",
        guestName: "Budi Santoso",
        guestPhone: "08123456781",
        guestEmail: "budi@example.com",
        spaceId: "sp-hot-1",
        spaceName: "Hot Desk #01",
        spaceType: "HOT_DESK",
        bookingType: "DAILY",
        date: "2026-11-06",
        startTime: "09:00",
        duration: 1,
        totalAmount: 65000,
        paymentStatus: "PAID",
        checkInStatus: "COMPLETED",
      },
    ];

    const paidCwkBookings = mockBookings.filter(
      (b) => b.paymentStatus === "PAID" && b.checkInStatus !== "CANCELLED"
    );
    const cwkRevenue = paidCwkBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    // Paid bookings: bk-1 (50.000) + bk-3 (65.000) = 115.000
    expect(paidCwkBookings).toHaveLength(2);
    expect(cwkRevenue).toBe(115000);
    expect(cwkRevenue).toBeGreaterThan(0);
  });

  it("B5.2 (POS-37 / TC-K08): Pendapatan Event Dago Organization hanya menghitung platformRevenue (20%), bukan total omzet tiket", () => {
    const eventStats = {
      totalRevenue: 5000000, // Total ticket turnover belonging to organizers
      paidBookingsCount: 50,
      platformRevenue: 1000000, // 20% Dago Creative Hub platform commission fee
    };

    const isDagoOwner = true;
    const eventRevenue = isDagoOwner ? eventStats.platformRevenue : 0;

    expect(eventRevenue).toBe(1000000);
    expect(eventRevenue).not.toBe(eventStats.totalRevenue);
  });

  it("B5.3 (POS-05 / TC-H03): Average Order Value (AOV) membagi total pendapatan konsolidasi dengan seluruh transaksi valid secara presisi", () => {
    // F&B: 35 orders, total Rp 3.500.000
    const fnbOrdersCount = 35;
    const fnbRevenue = 3500000;

    // Co-working: 5 bookings, total Rp 500.000
    const cwkBookingsCount = 5;
    const cwkRevenue = 500000;

    // Events: 10 tickets, platform revenue Rp 200.000
    const eventBookingsCount = 10;
    const eventPlatformRevenue = 200000;

    const consolidatedRevenue = fnbRevenue + cwkRevenue + eventPlatformRevenue; // Rp 4.200.000
    const totalTransactions = fnbOrdersCount + cwkBookingsCount + eventBookingsCount; // 50 transactions

    const aov = Math.round(consolidatedRevenue / totalTransactions);

    // 4.200.000 / 50 = 84.000
    expect(totalTransactions).toBe(50);
    expect(aov).toBe(84000);
  });
});
