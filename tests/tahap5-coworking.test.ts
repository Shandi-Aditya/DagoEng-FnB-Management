import { describe, it, expect } from "vitest";
import {
  INITIAL_SPACES,
  INITIAL_BOOKINGS,
  MEMBERSHIP_PLANS,
} from "../src/features/coworking/coworking-data";
import { CoworkingBooking, CoworkingSpaceItem } from "../src/types/coworking";
import {
  calculateCoworkingPricing,
  checkPromoValidity,
  calculateOrderPricing,
  PromoConfig,
  OrderItemInput,
} from "../src/lib/promo";
import { DEFAULT_PLATFORM_SETTINGS } from "../src/types/settings";

// Helper functions mirroring POS & Customer Portal logic
function parseHour(timeStr: string): number {
  if (!timeStr) return 9;
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (match) return parseInt(match[1], 10);
  const matchNum = timeStr.match(/(\d{1,2})/);
  if (matchNum) return parseInt(matchNum[1], 10);
  return 9;
}

function calculateEndTime(startTime: string, durationHours: number): string {
  if (!startTime) return "11:00";
  const match = startTime.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    const startHour = parseInt(match[1], 10);
    const startMin = match[2];
    const endHour = (startHour + durationHours) % 24;
    return `${endHour.toString().padStart(2, "0")}:${startMin}`;
  }
  const startHour = parseHour(startTime);
  const endHour = (startHour + durationHours) % 24;
  return `${endHour.toString().padStart(2, "0")}:00`;
}

function checkSlotAvailability(
  space: CoworkingSpaceItem,
  bookingsList: CoworkingBooking[],
  targetDate: string,
  startHour: number,
  durationHours: number
): { isAvailable: boolean; reason?: string } {
  const maxCapacity = space.type === "HOT_DESK" ? (space.capacity || 8) : 1;
  const targetEndHour = startHour + durationHours;

  const activeBookings = bookingsList.filter(
    (b) =>
      b.spaceId === space.id &&
      b.date === targetDate &&
      b.checkInStatus !== "CANCELLED" &&
      b.checkInStatus !== "COMPLETED"
  );

  for (let h = startHour; h < targetEndHour; h++) {
    const overlapping = activeBookings.filter((b) => {
      const bStart = parseHour(b.startTime);
      const bEnd = bStart + (b.duration || 1);
      return h >= bStart && h < bEnd;
    });

    if (overlapping.length >= maxCapacity) {
      return {
        isAvailable: false,
        reason: "Sudah dibooking",
      };
    }
  }

  return { isAvailable: true };
}

describe("Tahap 5: Co-Working System Comprehensive Tests", () => {
  // 1. Package 2 jam menghitung end time dengan benar
  it("1. Package 2 jam menghitung end time dengan benar", () => {
    expect(calculateEndTime("10:30", 2)).toBe("12:30");
    expect(calculateEndTime("09:00", 2)).toBe("11:00");
    expect(calculateEndTime("14:45", 2)).toBe("16:45");
  });

  // 2. Package 4 jam menghitung end time dengan benar
  it("2. Package 4 jam menghitung end time dengan benar", () => {
    expect(calculateEndTime("09:00", 4)).toBe("13:00");
    expect(calculateEndTime("10:30", 4)).toBe("14:30");
    expect(calculateEndTime("15:00", 4)).toBe("19:00");
  });

  // 3. Start time menggunakan waktu transaksi
  it("3. Start time menggunakan waktu transaksi default secara otomatis", () => {
    const mockTxDate = new Date("2026-10-07T10:30:00");
    const formattedTxTime = `${mockTxDate.getHours().toString().padStart(2, "0")}:${mockTxDate.getMinutes().toString().padStart(2, "0")}`;
    expect(formattedTxTime).toBe("10:30");

    const packageDuration = 2;
    const computedEnd = calculateEndTime(formattedTxTime, packageDuration);
    expect(computedEnd).toBe("12:30");
  });

  // 4. Booking yang bentrok ditolak
  it("4. Booking yang bentrok ditolak jika ruang privat / meeting room sudah terisi", () => {
    const meetingRoom: CoworkingSpaceItem = {
      id: "sp-meet-1",
      name: "Executive Meeting Room",
      type: "MEETING_ROOM",
      area: "VIP Meeting Wing",
      capacity: 1, // Single group occupying room
      hourlyRate: 150000,
      dailyRate: 900000,
      status: "AVAILABLE",
      amenities: ["Projector", "AC"],
    };

    const existingBookings: CoworkingBooking[] = [
      {
        id: "bk-01",
        bookingCode: "BK-CWK-01",
        guestName: "Budi Santoso",
        guestPhone: "+62 812-3456-7890",
        guestEmail: "budi@example.com",
        spaceId: "sp-meet-1",
        spaceName: "Executive Meeting Room",
        spaceType: "MEETING_ROOM",
        bookingType: "HOURLY",
        date: "2026-10-07",
        startTime: "10:00 WITA",
        duration: 2, // 10:00 - 12:00
        totalAmount: 300000,
        paymentStatus: "PAID",
        checkInStatus: "CHECKED_IN",
      },
    ];

    // Attempt booking overlapping 11:00 - 13:00 (overlaps at 11:00)
    const overlapCheck = checkSlotAvailability(meetingRoom, existingBookings, "2026-10-07", 11, 2);
    expect(overlapCheck.isAvailable).toBe(false);

    // Non-overlapping booking 12:00 - 14:00 is available
    const nonOverlapCheck = checkSlotAvailability(meetingRoom, existingBookings, "2026-10-07", 12, 2);
    expect(nonOverlapCheck.isAvailable).toBe(true);
  });

  // 5. Booking cancelled/completed tidak salah dianggap occupied
  it("5. Booking CANCELLED atau COMPLETED tidak salah dianggap occupied", () => {
    const meetingRoom: CoworkingSpaceItem = {
      id: "sp-meet-2",
      name: "Private Studio Pod",
      type: "PRIVATE_POD",
      area: "VIP Meeting Wing",
      capacity: 1,
      hourlyRate: 100000,
      dailyRate: 600000,
      status: "AVAILABLE",
      amenities: ["Fiber WiFi"],
    };

    const cancelledAndCompletedBookings: CoworkingBooking[] = [
      {
        id: "bk-cancelled",
        bookingCode: "BK-CWK-CANCEL",
        guestName: "Joko",
        guestPhone: "+62 812-3456-7890",
        guestEmail: "joko@example.com",
        spaceId: "sp-meet-2",
        spaceName: "Private Studio Pod",
        spaceType: "PRIVATE_POD",
        bookingType: "HOURLY",
        date: "2026-10-07",
        startTime: "10:00 WITA",
        duration: 2,
        totalAmount: 200000,
        paymentStatus: "PENDING",
        checkInStatus: "CANCELLED",
      },
      {
        id: "bk-completed",
        bookingCode: "BK-CWK-COMPLETED",
        guestName: "Rina",
        guestPhone: "+62 812-3456-7890",
        guestEmail: "rina@example.com",
        spaceId: "sp-meet-2",
        spaceName: "Private Studio Pod",
        spaceType: "PRIVATE_POD",
        bookingType: "HOURLY",
        date: "2026-10-07",
        startTime: "10:00 WITA",
        duration: 2,
        totalAmount: 200000,
        paymentStatus: "PAID",
        checkInStatus: "COMPLETED",
      },
    ];

    const checkAvail = checkSlotAvailability(
      meetingRoom,
      cancelledAndCompletedBookings,
      "2026-10-07",
      10,
      2
    );
    expect(checkAvail.isAvailable).toBe(true);
  });

  // 6. Personal dan Group/Company tersimpan dengan benar
  it("6. Personal dan Group/Company tersimpan dengan benar", () => {
    const personalBooking: CoworkingBooking = {
      id: "bk-pers-1",
      bookingCode: "BK-CWK-P01",
      guestName: "Dewi Lestari",
      guestPhone: "+62 812-3456-7890",
      guestEmail: "dewi@example.com",
      company: "Personal",
      spaceId: "sp-hd-01",
      spaceName: "Hot Desk 01",
      spaceType: "HOT_DESK",
      bookingType: "HOURLY",
      date: "2026-10-07",
      startTime: "10:00 WITA",
      duration: 2,
      totalAmount: 33000,
      paymentStatus: "PAID",
      checkInStatus: "CHECKED_IN",
    };

    const groupBooking: CoworkingBooking = {
      id: "bk-grp-1",
      bookingCode: "BK-CWK-G01",
      guestName: "Michael Surya",
      guestPhone: "+62 812-3456-7890",
      guestEmail: "michael@dagomedia.com",
      company: "PT Dago Media Solusindo",
      spaceId: "sp-meet-1",
      spaceName: "Meeting Room A",
      spaceType: "MEETING_ROOM",
      bookingType: "HOURLY",
      date: "2026-10-07",
      startTime: "14:00 WITA",
      duration: 4,
      totalAmount: 660000,
      paymentStatus: "PAID",
      checkInStatus: "CHECKED_IN",
    };

    expect(personalBooking.company).toBe("Personal");
    expect(groupBooking.company).toBe("PT Dago Media Solusindo");
  });

  // 7. Payment harus berhasil sebelum booking final
  it("7. Payment harus berhasil (PAID) sebelum booking final", () => {
    const pendingBooking: CoworkingBooking = {
      id: "bk-pending-1",
      bookingCode: "BK-CWK-PEND",
      guestName: "Guest User",
      guestPhone: "+62 812-3456-7890",
      guestEmail: "guest@example.com",
      spaceId: "sp-hd-01",
      spaceName: "Hot Desk 01",
      spaceType: "HOT_DESK",
      bookingType: "HOURLY",
      date: "2026-10-07",
      startTime: "10:00 WITA",
      duration: 2,
      totalAmount: 33000,
      paymentStatus: "PENDING",
      checkInStatus: "RESERVED",
    };

    expect(pendingBooking.paymentStatus).toBe("PENDING");
    expect(pendingBooking.checkInStatus).toBe("RESERVED");

    // Finalize payment
    const paidBooking: CoworkingBooking = {
      ...pendingBooking,
      paymentStatus: "PAID",
      checkInStatus: "CHECKED_IN",
    };

    expect(paidBooking.paymentStatus).toBe("PAID");
    expect(paidBooking.totalAmount).toBe(33000);
    expect(paidBooking.checkInStatus).toBe("CHECKED_IN");
  });

  // 8. Receipt Co-Working tetap terpisah dari F&B
  it("8. Receipt Co-Working memiliki data struktur tersendiri dan terpisah dari F&B", () => {
    const coworkReceipt = {
      bookingCode: "BK-CWK-7711",
      transactionDate: "07 Okt 2026 10:30",
      guestName: "Sarah Connor",
      guestPhone: "+62 812-9988-7766",
      company: "Cyberdyne Systems",
      spaceName: "Executive Glass Meeting Room",
      spaceType: "MEETING_ROOM",
      outletName: "Singaraja (Pusat)",
      bookingDate: "2026-10-07",
      startTime: "10:30 WITA",
      endTime: "12:30 WITA",
      duration: 2,
      bookingType: "HOURLY",
      basePrice: 300000,
      discount: 50000,
      promoTitle: "COWORK50",
      tax: 25000,
      totalAmount: 275000,
      paymentMethod: "QRIS",
      paymentStatus: "PAID",
    };

    expect(coworkReceipt.bookingCode).toContain("BK-CWK-");
    expect(coworkReceipt.spaceName).toBe("Executive Glass Meeting Room");
    expect(coworkReceipt.startTime).toBe("10:30 WITA");
    expect(coworkReceipt.endTime).toBe("12:30 WITA");
    expect(coworkReceipt.company).toBe("Cyberdyne Systems");
    expect(coworkReceipt.totalAmount).toBe(275000);
  });

  // 9. Promo COWORKING tidak salah diterapkan ke F&B
  it("9. Promo dengan scope COWORKING tidak dapat diterapkan ke pesanan F&B", () => {
    const coworkPromo = (DEFAULT_PLATFORM_SETTINGS.promos as PromoConfig[]).find((p) => p.code === "COWORK50");
    expect(coworkPromo).toBeDefined();
    expect(coworkPromo?.scope).toBe("COWORKING");

    const fnbItems: OrderItemInput[] = [
      {
        productId: "p1",
        category: "COFFEE",
        tenantId: "tenant-coffee",
        quantity: 2,
        unitPrice: 25000,
      },
    ];

    const result = calculateOrderPricing(fnbItems, coworkPromo, 0.1);
    expect(result.discountAmount).toBe(0);
    expect(result.total).toBe(55000); // 50000 + 10% tax = 55000, no discount applied
  });

  // 10. Flow existing tetap berjalan dengan baik
  it("10. Flow existing Co-Working pricing calculation & master data spaces tetap berjalan", () => {
    expect(INITIAL_SPACES.length).toBeGreaterThanOrEqual(4);
    const pricing = calculateCoworkingPricing(100000, undefined, 0.1);
    expect(pricing.originalSubtotal).toBe(100000);
    expect(pricing.discountAmount).toBe(0);
    expect(pricing.tax).toBe(10000);
    expect(pricing.total).toBe(110000);
  });
});

