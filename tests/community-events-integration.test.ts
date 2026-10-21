import { describe, it, expect, beforeAll } from "vitest";
import {
  createEventBooking,
  getEventBookings,
  getBookingById,
  updateBookingCheckIn,
  updateBookingPaymentStatus,
  getEventOperationalStats,
  getAdminEvents,
  createEventSubmission,
  updateEventStatus,
} from "../src/lib/events";
import { CommunityEvent } from "../src/types/event";

describe("Community Events Integrated Module (DAGO Creative Hub)", () => {
  let freeEvent: CommunityEvent;
  let paidEvent: CommunityEvent;
  let limitedEvent: CommunityEvent;

  beforeAll(async () => {
    const timestamp = Date.now();
    // Create dedicated clean events with ample capacity for test execution
    const freeSub = await createEventSubmission({
      organizerName: "Komunitas Musik Dago",
      organizerEmail: `musik-${timestamp}@example.com`,
      organizerPhone: "081234567800",
      title: `Free Acoustic Night ${timestamp}`,
      category: "COMMUNITY",
      description: "Malam musik akustik santai komunitas Dago Hub.",
      startDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      endDate: new Date(Date.now() + 26 * 3600 * 1000).toISOString(),
      location: "Amphitheater Dago Hub",
      maxCapacity: 150,
      isPaid: false,
      price: 0,
      posterUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",
    });
    freeEvent = await updateEventStatus(freeSub.id, "APPROVED");

    const paidSub = await createEventSubmission({
      organizerName: "Dago Barista Guild",
      organizerEmail: `barista-${timestamp}@example.com`,
      organizerPhone: "081234567801",
      title: `Brewing Workshop Masterclass ${timestamp}`,
      category: "WORKSHOP",
      description: "Workshop seduh manual dan sensory analysis kopi spesialti.",
      startDate: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      endDate: new Date(Date.now() + 52 * 3600 * 1000).toISOString(),
      location: "Main Hall Dago Hub",
      maxCapacity: 150,
      isPaid: true,
      price: 50000,
      posterUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085",
    });
    paidEvent = await updateEventStatus(paidSub.id, "APPROVED");

    const limitedSub = await createEventSubmission({
      organizerName: "Exclusive VIP Cohort",
      organizerEmail: `vip-${timestamp}@example.com`,
      organizerPhone: "081234567802",
      title: `Intimate VIP Roundtable ${timestamp}`,
      category: "COMMUNITY",
      description: "Diskusi intim terbatas untuk 2 orang undangan.",
      startDate: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
      endDate: new Date(Date.now() + 74 * 3600 * 1000).toISOString(),
      location: "VIP Meeting Wing / Boardroom",
      maxCapacity: 2,
      isPaid: false,
      price: 0,
      posterUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085",
    });
    limitedEvent = await updateEventStatus(limitedSub.id, "APPROVED");
  });

  it("1. harus berhasil mendaftarkan tiket gratis dengan status bayar langsung PAID", async () => {
    const booking = await createEventBooking({
      eventId: freeEvent.id,
      guestName: "Budi Pratama",
      guestEmail: `budi-${Date.now()}@example.com`,
      guestPhone: "081234567890",
      institution: "Tech Community Bandung",
      ticketCount: 2,
    });

    expect(booking).toBeDefined();
    expect(booking.ticketCode).toMatch(/^DAGO-EVT-\d{5}$/);
    expect(booking.unitPrice).toBe(0);
    expect(booking.totalPrice).toBe(0);
    expect(booking.platformFeeAmount).toBe(0);
    expect(booking.organizerRevenueAmount).toBe(0);
    expect(booking.paymentStatus).toBe("PAID");
    expect(booking.checkInStatus).toBe("REGISTERED");
    expect(booking.checkInTime).toBeFalsy();
  });

  it("2. tiket berbayar harus berstatus PENDING hingga diverifikasi admin dan menghitung skema bagi hasil 20/80", async () => {
    const ticketCount = 3;
    const testEmail = `siti-${Date.now()}@example.com`;
    const booking = await createEventBooking({
      eventId: paidEvent.id,
      guestName: "Siti Rahma",
      guestEmail: testEmail,
      guestPhone: "089876543210",
      institution: "Art & Craft Studio",
      ticketCount: ticketCount,
    });

    const expectedTotal = (paidEvent.isPaid ? paidEvent.price : 0) * ticketCount;
    const expectedPlatformFee = Math.round((expectedTotal * 20) / 100);
    const expectedOrganizerRevenue = expectedTotal - expectedPlatformFee;

    expect(booking.unitPrice).toBe(paidEvent.isPaid ? paidEvent.price : 0);
    expect(booking.totalPrice).toBe(expectedTotal);
    expect(booking.platformFeeAmount).toBe(expectedPlatformFee);
    expect(booking.organizerRevenueAmount).toBe(expectedOrganizerRevenue);
    // Strict integrity: Paid tickets MUST be PENDING initially
    expect(booking.paymentStatus).toBe("PENDING");

    // Admin verifies payment to PAID
    const verified = await updateBookingPaymentStatus(booking.id, "PAID");
    expect(verified.paymentStatus).toBe("PAID");
  });

  it("3. harus menolak pemesanan ganda dari email yang sama dalam selang 3 menit", async () => {
    const duplicateEmail = `duplicate-${Date.now()}@example.com`;
    await createEventBooking({
      eventId: freeEvent.id,
      guestName: "Duplikat Tester",
      guestEmail: duplicateEmail,
      guestPhone: "081234567890",
      ticketCount: 1,
    });

    // Immediate second booking attempt from same email
    await expect(
      createEventBooking({
        eventId: freeEvent.id,
        guestName: "Duplikat Tester Kedua",
        guestEmail: duplicateEmail,
        guestPhone: "081234567890",
        ticketCount: 1,
      })
    ).rejects.toThrow("Mohon tunggu 3 menit");
  });

  it("4. harus menolak pemesanan dengan jumlah tiket di luar batas (1-10 tiket per booking)", async () => {
    await expect(
      createEventBooking({
        eventId: paidEvent.id,
        guestName: "Toni",
        guestEmail: `toni-${Date.now()}@example.com`,
        guestPhone: "0811111111",
        ticketCount: 0,
      })
    ).rejects.toThrow("Jumlah pemesanan tiket harus antara 1 sampai 10");

    await expect(
      createEventBooking({
        eventId: paidEvent.id,
        guestName: "Toni",
        guestEmail: `toni2-${Date.now()}@example.com`,
        guestPhone: "0811111111",
        ticketCount: 15,
      })
    ).rejects.toThrow("Jumlah pemesanan tiket harus antara 1 sampai 10");
  });

  it("5. harus memvalidasi data tamu (nama, email, no whatsapp wajib diisi)", async () => {
    await expect(
      createEventBooking({
        eventId: paidEvent.id,
        guestName: "",
        guestEmail: `valid-${Date.now()}@example.com`,
        guestPhone: "0812345678",
        ticketCount: 1,
      })
    ).rejects.toThrow();

    await expect(
      createEventBooking({
        eventId: paidEvent.id,
        guestName: "Valid Name",
        guestEmail: "",
        guestPhone: "0812345678",
        ticketCount: 1,
      })
    ).rejects.toThrow();

    await expect(
      createEventBooking({
        eventId: paidEvent.id,
        guestName: "Valid Name",
        guestEmail: `valid2-${Date.now()}@example.com`,
        guestPhone: "",
        ticketCount: 1,
      })
    ).rejects.toThrow();
  });

  it("6. harus mendukung check-in kehadiran di venue dan pembatalan check-in dengan timestamp", async () => {
    const booking = await createEventBooking({
      eventId: freeEvent.id,
      guestName: "Dewi Sartika",
      guestEmail: `dewi-${Date.now()}@example.com`,
      guestPhone: "081299998888",
      ticketCount: 1,
    });

    expect(booking.checkInStatus).toBe("REGISTERED");
    expect(booking.checkInTime).toBeFalsy();

    // Check-in
    const checkedIn = await updateBookingCheckIn(booking.id, "CHECKED_IN");
    expect(checkedIn).not.toBeNull();
    expect(checkedIn?.checkInStatus).toBe("CHECKED_IN");
    expect(checkedIn?.checkInTime).toBeDefined();
    expect(typeof checkedIn?.checkInTime).toBe("string");

    // Cancel check-in
    const cancelledCheckIn = await updateBookingCheckIn(booking.id, "REGISTERED");
    expect(cancelledCheckIn?.checkInStatus).toBe("REGISTERED");
    expect(cancelledCheckIn?.checkInTime).toBeFalsy();
  });

  it("7. harus mendukung update status pembayaran tiket", async () => {
    const booking = await createEventBooking({
      eventId: paidEvent.id,
      guestName: "Andi Wijaya",
      guestEmail: `andi-${Date.now()}@example.com`,
      guestPhone: "081377778888",
      ticketCount: 1,
    });

    const updated = await updateBookingPaymentStatus(booking.id, "CANCELLED");
    expect(updated?.paymentStatus).toBe("CANCELLED");
  });

  it("8. harus mengagregasi statistik operasional dan finansial event dengan presisi", async () => {
    const stats = await getEventOperationalStats();

    expect(stats.totalEvents).toBeGreaterThan(0);
    expect(stats.approvedEvents).toBeGreaterThan(0);
    expect(stats.totalAttendees).toBeGreaterThanOrEqual(0);
    expect(stats.totalTicketsSold).toBeGreaterThanOrEqual(0);
    expect(stats.totalTicketRevenue).toBe(stats.platformCommissionRevenue + stats.organizerPayoutTotal);
  });

  it("9. harus memfilter booking berdasarkan eventId", async () => {
    const event1Bookings = await getEventBookings(freeEvent.id);
    event1Bookings.forEach((b) => {
      expect(b.eventId).toBe(freeEvent.id);
    });
  });

  it("10. harus menolak pemesanan ketika kuota tiket venue terlampaui", async () => {
    // limitedEvent has maxCapacity: 2
    // Booking 1 ticket succeeds
    await createEventBooking({
      eventId: limitedEvent.id,
      guestName: "Tamu VIP 1",
      guestEmail: `vip1-${Date.now()}@example.com`,
      guestPhone: "081234567891",
      ticketCount: 1,
    });

    // Booking another 1 ticket succeeds (total: 2, capacity full)
    await createEventBooking({
      eventId: limitedEvent.id,
      guestName: "Tamu VIP 2",
      guestEmail: `vip2-${Date.now()}@example.com`,
      guestPhone: "081234567892",
      ticketCount: 1,
    });

    // Booking a 3rd ticket must be strictly rejected
    await expect(
      createEventBooking({
        eventId: limitedEvent.id,
        guestName: "Tamu VIP 3",
        guestEmail: `vip3-${Date.now()}@example.com`,
        guestPhone: "081234567893",
        ticketCount: 1,
      })
    ).rejects.toThrow("Kapasitas venue atau kuota tiket telah penuh");
  });
});
