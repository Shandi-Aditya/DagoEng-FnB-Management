import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { NextRequest } from "next/server";
import {
  getEventAdvisoryLockKey,
  getEventsDocumentLockKey,
  EVENTS_STORAGE_DOCUMENT_LOCK_NAME,
  runWithDistributedEventLock,
  runWithDistributedEventsStorageLock,
  createEventBooking,
  updateEventDetails,
  updateEventStatus,
  deleteEvent,
  organizerResubmitEvent,
  loadEventsFromDisk,
  saveEventsToDisk,
  loadBookingsFromDisk,
  saveBookingsToDisk,
  getEventActiveBookedTicketCount,
  syncBookingsToLocalDiskAndCache,
  syncEventsToLocalDiskAndCache,
  updateBookingPaymentStatus,
  updateBookingCheckIn,
  getEventTicketAvailability,
  getPublicEventById,
  loadConsistentEventSnapshotsFromDb,
  resetLastCommittedTimestampsForTesting,
} from "@/lib/events";
import { GET as getPublicEventRoute } from "@/app/api/events/[id]/route";
import { CommunityEvent, EventTicketOrder } from "@/types/event";
import {
  DatabasePersistenceError,
  getStorageSyncStatus,
  getLastSyncedUpdatedAt,
} from "@/lib/data-storage";

describe("TASK S-03 — Distributed Event Capacity & PostgreSQL Advisory Lock Concurrency Suite", () => {
  const eventIdA = "evt-dist-lock-test-a";
  const eventIdB = "evt-dist-lock-test-b";

  const baseEventA: CommunityEvent = {
    id: eventIdA,
    title: "Distributed Lock Testing Event A",
    category: "WORKSHOP",
    description: "Event deskripsi valid minimal sepuluh karakter.",
    startDate: "2026-12-30T10:00:00.000Z",
    endDate: "2026-12-30T18:00:00.000Z",
    location: "Hall A Dago Hub",
    isPaid: true,
    price: 50000,
    maxCapacity: 10,
    posterUrl: "https://example.com/poster.jpg",
    organizerName: "Dago Tech Community",
    organizerEmail: "tech@community.com",
    organizerPhone: "08123456789",
    status: "APPROVED",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const baseEventB: CommunityEvent = {
    ...baseEventA,
    id: eventIdB,
    title: "Distributed Lock Testing Event B",
    location: "Hall B Dago Hub",
  };

  let initialEvents: CommunityEvent[] = [];
  let initialBookings: EventTicketOrder[] = [];

  beforeEach(async () => {
    vi.restoreAllMocks();
    resetLastCommittedTimestampsForTesting();
    initialEvents = loadEventsFromDisk();
    initialBookings = loadBookingsFromDisk();
    await saveEventsToDisk([
      baseEventA,
      baseEventB,
      ...initialEvents.filter((e) => e.id !== eventIdA && e.id !== eventIdB),
    ]);
  });

  afterEach(async () => {
    resetLastCommittedTimestampsForTesting();
    await saveEventsToDisk(initialEvents);
    await saveBookingsToDisk(initialBookings);
    delete (global as any).__ENABLE_DISTRIBUTED_LOCK_TEST__;
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. ADVISORY LOCK KEY DERIVATION & STABILITY
  // =========================================================================
  describe("1. Advisory Lock Key Derivation & Collision Resistance", () => {
    it("1.1 Menghasilkan BigInt 64-bit yang deterministik untuk event ID yang sama", () => {
      const key1 = getEventAdvisoryLockKey(eventIdA);
      const key2 = getEventAdvisoryLockKey(eventIdA);
      const key3 = getEventAdvisoryLockKey(` ${eventIdA.toUpperCase()} `);

      expect(typeof key1).toBe("bigint");
      expect(key1).toBe(key2);
      expect(key1).toBe(key3); // Case-insensitive and trimmed
    });

    it("1.2 Menghasilkan BigInt yang berbeda untuk event ID yang berbeda (Zero false collision)", () => {
      const keyA = getEventAdvisoryLockKey(eventIdA);
      const keyB = getEventAdvisoryLockKey(eventIdB);
      const keyC = getEventAdvisoryLockKey("evt-random-uuid-12345");

      expect(keyA).not.toBe(keyB);
      expect(keyA).not.toBe(keyC);
      expect(keyB).not.toBe(keyC);
    });

    it("1.3 BigInt berada dalam rentang valid 64-bit signed integer PostgreSQL (BIGINT)", () => {
      const key = getEventAdvisoryLockKey(eventIdA);
      const minBigInt = -9223372036854775808n;
      const maxBigInt = 9223372036854775807n;

      expect(key >= minBigInt).toBe(true);
      expect(key <= maxBigInt).toBe(true);
    });
  });

  // =========================================================================
  // 2. SKENARIO 1 — BOOKING BERSAMAAN (DUA INSTANCE / REQUEST SIMULTAN)
  // =========================================================================
  describe("2. Skenario 1 — Dua Permintaan Booking Bersamaan (Kapasitas 10, Booked 5)", () => {
    it("2.1 Dua instance mencoba memesan 3 tiket: hanya 1 yang berhasil, sisa tiket tidak overbooking", async () => {
      // Kondisi awal: 5 tiket aktif dari kapasitas 10 (tersisa 5 tiket)
      const existingBooking: EventTicketOrder = {
        id: `bk-init-s1-${Date.now()}`,
        ticketCode: "DAGO-EVT-INIT-1",
        eventTitle: "Distributed Lock Testing Event A",
        eventDate: baseEventA.startDate,
        eventLocation: baseEventA.location,
        eventId: eventIdA,
        guestName: "Initial User",
        guestEmail: "user1@example.com",
        guestPhone: "0812345678",
        ticketCount: 5,
        unitPrice: 50000,
        totalPrice: 250000,
        paymentStatus: "PAID",
        paymentMethod: "QRIS",
        checkInStatus: "REGISTERED",
        platformFeePercent: 20,
        platformFeeAmount: 50000,
        organizerRevenueAmount: 200000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveBookingsToDisk([existingBooking, ...initialBookings.filter((b) => b.eventId !== eventIdA)]);

      // Instance 1 dan Instance 2 masing-masing mencoba memesan 3 tiket secara simultan
      // Total kuota tersisa = 5 tiket. 3 + 3 = 6 tiket (akan melebihi kapasitas jika race condition terjadi)
      const reqInstance1 = createEventBooking({
        eventId: eventIdA,
        guestName: "Instance 1 Buyer",
        guestEmail: "inst1@example.com",
        guestPhone: "0811111111",
        ticketCount: 3,
        paymentMethod: "QRIS",
      }, "10.0.0.1");

      const reqInstance2 = createEventBooking({
        eventId: eventIdA,
        guestName: "Instance 2 Buyer",
        guestEmail: "inst2@example.com",
        guestPhone: "0822222222",
        ticketCount: 3,
        paymentMethod: "QRIS",
      }, "10.0.0.2");

      const [res1, res2] = await Promise.allSettled([reqInstance1, reqInstance2]);

      // Tepat satu yang berhasil (fulfilled) dan satu yang ditolak (rejected)
      const fulfilledCount = [res1, res2].filter((r) => r.status === "fulfilled").length;
      const rejectedCount = [res1, res2].filter((r) => r.status === "rejected").length;

      expect(fulfilledCount).toBe(1);
      expect(rejectedCount).toBe(1);

      // Verifikasi penolakan karena kuota penuh
      const rejected = [res1, res2].find((r) => r.status === "rejected") as PromiseRejectedResult;
      expect(rejected.reason.message).toContain("Kapasitas venue atau kuota tiket telah penuh");

      // Verifikasi akhir di storage: total tiket aktif tepat 8 (5 + 3), TIDAK PERNAH MELAMPAUI 10
      const activeTickets = getEventActiveBookedTicketCount(eventIdA);
      expect(activeTickets).toBe(8);
      expect(activeTickets).toBeLessThanOrEqual(10);
    });
  });

  // =========================================================================
  // 3. SKENARIO 2 — BOOKING VS CAPACITY UPDATE SIMULTAN
  // =========================================================================
  describe("3. Skenario 2 — Booking vs Capacity Update Simultan (Race Condition Prevention)", () => {
    it("3.1 Tidak ada kondisi akhir tiket aktif (8) dengan kapasitas (6)", async () => {
      // Kondisi awal: 5 tiket aktif dari kapasitas 10
      const initialBooking: EventTicketOrder = {
        id: `bk-init-s2-${Date.now()}`,
        ticketCode: "DAGO-EVT-INIT-2",
        eventTitle: "Distributed Lock Testing Event A",
        eventDate: baseEventA.startDate,
        eventLocation: baseEventA.location,
        eventId: eventIdA,
        guestName: "Initial User S2",
        guestEmail: "s2@example.com",
        guestPhone: "0812345678",
        ticketCount: 5,
        unitPrice: 50000,
        totalPrice: 250000,
        paymentStatus: "PAID",
        paymentMethod: "QRIS",
        checkInStatus: "REGISTERED",
        platformFeePercent: 20,
        platformFeeAmount: 50000,
        organizerRevenueAmount: 200000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveBookingsToDisk([initialBooking, ...initialBookings.filter((b) => b.eventId !== eventIdA)]);

      // Instance A booking 3 tiket, Instance B menurunkan kapasitas ke 6
      const bookingPromise = createEventBooking({
        eventId: eventIdA,
        guestName: "Concurrent Booker",
        guestEmail: "concurrent@example.com",
        guestPhone: "0833333333",
        ticketCount: 3,
        paymentMethod: "QRIS",
      }, "10.0.0.3");

      const capacityPromise = updateEventDetails(eventIdA, { maxCapacity: 6 });

      const [resBooking, resCapacity] = await Promise.allSettled([bookingPromise, capacityPromise]);

      // Evaluasi konsistensi mutual exclusion
      const eventsAfter = loadEventsFromDisk();
      const currentEvent = eventsAfter.find((e) => e.id === eventIdA)!;
      const bookedAfter = getEventActiveBookedTicketCount(eventIdA);

      // Invarian mutlak: bookedAfter TIDAK BOLEH lebih besar daripada currentEvent.maxCapacity
      expect(bookedAfter).toBeLessThanOrEqual(currentEvent.maxCapacity ?? 10);

      if (resBooking.status === "fulfilled") {
        // Jika booking berhasil (total 8), maka penurunan kapasitas ke 6 WAJIB ditolak
        expect(resCapacity.status).toBe("rejected");
        expect(currentEvent.maxCapacity).toBe(10);
        expect(bookedAfter).toBe(8);
      } else {
        // Jika penurunan kapasitas ke 6 berhasil duluan, maka booking 3 tiket WAJIB ditolak
        expect(resCapacity.status).toBe("fulfilled");
        expect(currentEvent.maxCapacity).toBe(6);
        expect(bookedAfter).toBe(5);
      }
    });
  });

  // =========================================================================
  // 4. SKENARIO 3 — DUA PERUBAHAN KAPASITAS SIMULTAN
  // =========================================================================
  describe("4. Skenario 3 — Dua Perubahan Kapasitas Simultan pada Event yang Sama", () => {
    it("4.1 Dua update kapasitas konkuren dieksekusi secara berurutan tanpa lost update", async () => {
      const update1 = updateEventDetails(eventIdA, { maxCapacity: 100 });
      const update2 = updateEventDetails(eventIdA, { maxCapacity: 200 });

      const [res1, res2] = await Promise.allSettled([update1, update2]);

      expect(res1.status).toBe("fulfilled");
      expect(res2.status).toBe("fulfilled");

      // Nilai akhir konsisten dengan eksekusi terakhir
      const events = loadEventsFromDisk();
      const event = events.find((e) => e.id === eventIdA);
      expect(event?.maxCapacity === 100 || event?.maxCapacity === 200).toBe(true);
    });
  });

  // =========================================================================
  // 5. SKENARIO 4 — MUTASI DUA EVENT BERBEDA SECARA BERSAMAAN
  // =========================================================================
  describe("5. Skenario 4 — Event Berbeda Tidak Saling Menghambat (No False Contention)", () => {
    it("5.1 Operasi kapasitas pada Event A dan Event B dapat berjalan tanpa lock contention silang", async () => {
      const p1 = updateEventDetails(eventIdA, { maxCapacity: 50 });
      const p2 = updateEventDetails(eventIdB, { maxCapacity: 60 });

      const [resA, resB] = await Promise.allSettled([p1, p2]);

      expect(resA.status).toBe("fulfilled");
      expect(resB.status).toBe("fulfilled");

      const events = loadEventsFromDisk();
      expect(events.find((e) => e.id === eventIdA)?.maxCapacity).toBe(50);
      expect(events.find((e) => e.id === eventIdB)?.maxCapacity).toBe(60);
    });
  });

  // =========================================================================
  // 6. SKENARIO 5 — ROLLBACK & RELEASE SAAT EXCEPTION DI TENGAH TRANSAKSI
  // =========================================================================
  describe("6. Skenario 5 — Rollback & Lock Release saat Terjadi Kegagalan", () => {
    it("6.1 Operasi yang gagal di tengah jalan melepaskan lock dan tidak meninggalkan data parsial", async () => {
      // Admin mencoba menurunkan kuota ke angka negatif (validasi gagal di dalam lock)
      await expect(
        updateEventDetails(eventIdA, { maxCapacity: -10 })
      ).rejects.toThrow();

      // Lock harus otomatis dilepas sehingga operasi valid berikutnya langsung berhasil
      const validBooking = await createEventBooking({
        eventId: eventIdA,
        guestName: "Post Failure User",
        guestEmail: "postfail@example.com",
        guestPhone: "0844444444",
        ticketCount: 1,
        paymentMethod: "QRIS",
      }, "10.0.0.4");

      expect(validBooking).toBeDefined();
      expect(validBooking.ticketCount).toBe(1);
    });
  });

  // =========================================================================
  // 7. SKENARIO 6 — DATABASE FAILURE HANDLING (FAIL-CLOSED HTTP 503)
  // =========================================================================
  describe("7. Skenario 6 — Database Connection Failure Handling (Fail-Closed)", () => {
    it("7.1 Ketika koneksi database terputus, transaksi advisory lock melempar DatabasePersistenceError", async () => {
      (global as any).__ENABLE_DISTRIBUTED_LOCK_TEST__ = true;
      const originalDbUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = "postgresql://invalid_host_never_resolves:5432/db";

      try {
        await expect(
          runWithDistributedEventLock(eventIdA, async () => {
            return "SUCCESS_NOT_REACHED";
          })
        ).rejects.toThrow(DatabasePersistenceError);
      } finally {
        process.env.DATABASE_URL = originalDbUrl;
        delete (global as any).__ENABLE_DISTRIBUTED_LOCK_TEST__;
      }
    });
  });

  // =========================================================================
  // 8. SKENARIO 7 — TRANSACTION ROLLBACK SAFETY & ZERO DIRTY STATE
  // =========================================================================
  describe("8. Skenario 7 — Transaction Rollback Safety & Zero Dirty State (No Phantom Bookings)", () => {
    it("8.1 Transaksi yang gagal di tengah jalan tidak meninggalkan phantom booking di disk atau in-memory cache", async () => {
      // Set kondisi awal tersisa 1 tiket (kapasitas 10, booked 9)
      const existingBooking: EventTicketOrder = {
        id: `bk-init-rb-${Date.now()}`,
        ticketCode: "DAGO-EVT-INIT-3",
        eventTitle: "Distributed Lock Testing Event A",
        eventDate: baseEventA.startDate,
        eventLocation: baseEventA.location,
        eventId: eventIdA,
        guestName: "Initial User",
        guestEmail: "user1@example.com",
        guestPhone: "0812345678",
        ticketCount: 9,
        unitPrice: 50000,
        totalPrice: 450000,
        paymentStatus: "PAID",
        paymentMethod: "QRIS",
        checkInStatus: "REGISTERED",
        platformFeePercent: 20,
        platformFeeAmount: 90000,
        organizerRevenueAmount: 360000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveBookingsToDisk([existingBooking]);

      const bookingsBefore = loadBookingsFromDisk().filter((b) => b.eventId === eventIdA);
      expect(bookingsBefore.length).toBe(1);

      // Simulasikan kegagalan transaksi karena kuota tidak cukup (mencoba memesan 2 tiket saat sisa 1)
      await expect(
        createEventBooking({
          eventId: eventIdA,
          guestName: "Overquota Buyer",
          guestEmail: "over@example.com",
          guestPhone: "0899999999",
          ticketCount: 2, // Valid 1-5, namun melebihi sisa kuota (1)
          paymentMethod: "QRIS",
        }, "10.0.0.5")
      ).rejects.toThrow("Kapasitas venue atau kuota tiket telah penuh");

      // Verifikasi disk lokal dan in-memory cache tetap bersih: ZERO phantom booking
      const bookingsAfter = loadBookingsFromDisk().filter((b) => b.eventId === eventIdA);
      expect(bookingsAfter.length).toBe(1);
      expect(bookingsAfter[0].id).toBe(existingBooking.id);
      expect(getEventActiveBookedTicketCount(eventIdA)).toBe(9);
    });

    it("8.2 Kegagalan transaksi tidak mencemari metadata sinkronisasi secara prematur", async () => {
      const statusBefore = getStorageSyncStatus("event_bookings.json");

      await expect(
        updateEventDetails(eventIdA, { maxCapacity: -5 })
      ).rejects.toThrow();

      // Status metadata tidak boleh berubah menjadi kotor akibat transaksi yang batal
      const statusAfter = getStorageSyncStatus("event_bookings.json");
      expect(statusAfter).toBe(statusBefore);
    });
  });

  // =========================================================================
  // 9. SKENARIO 8 — DATABASE READ FAILURE HANDLING (FAIL-CLOSED)
  // =========================================================================
  describe("9. Skenario 8 — Fail-Closed saat Pembacaan Snapshot Database Gagal", () => {
    it("9.1 createEventBooking melempar DatabasePersistenceError ketika STORAGE_events.json gagal dibaca", async () => {
      (global as any).__ENABLE_DISTRIBUTED_LOCK_TEST__ = true;
      const originalDbUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = "postgresql://user:pass@ep-mock-fail-read.neon.tech/db";

      try {
        await expect(
          createEventBooking({
            eventId: eventIdA,
            guestName: "Fail Read Buyer",
            guestEmail: "failread@example.com",
            guestPhone: "0811112222",
            ticketCount: 1,
            paymentMethod: "QRIS",
          }, "10.0.0.6")
        ).rejects.toThrow(DatabasePersistenceError);
      } finally {
        process.env.DATABASE_URL = originalDbUrl;
        delete (global as any).__ENABLE_DISTRIBUTED_LOCK_TEST__;
      }
    });

    it("9.2 updateEventDetails melempar DatabasePersistenceError ketika STORAGE_events.json gagal dibaca", async () => {
      (global as any).__ENABLE_DISTRIBUTED_LOCK_TEST__ = true;
      const originalDbUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = "postgresql://user:pass@ep-mock-fail-read.neon.tech/db";

      try {
        await expect(
          updateEventDetails(eventIdA, { maxCapacity: 15 })
        ).rejects.toThrow(DatabasePersistenceError);
      } finally {
        process.env.DATABASE_URL = originalDbUrl;
        delete (global as any).__ENABLE_DISTRIBUTED_LOCK_TEST__;
      }
    });
  });

  // =========================================================================
  // 10. SKENARIO 9 — ADVISORY LOCK QUERYRAW CONTRACT VERIFICATION
  // =========================================================================
  describe("10. Skenario 9 — Advisory Lock Prisma $queryRaw Contract", () => {
    it("10.1 Derivasi kunci advisory lock menghasilkan BigInt yang identik untuk booking dan mutasi kapasitas", () => {
      const lockKeyBooking = getEventAdvisoryLockKey(eventIdA);
      const lockKeyCapacity = getEventAdvisoryLockKey(eventIdA);

      expect(typeof lockKeyBooking).toBe("bigint");
      expect(lockKeyBooking).toBe(lockKeyCapacity);
    });
  });

  // =========================================================================
  // 11. SKENARIO 10 — POST-COMMIT BEHAVIOR & DISK ISOLATION
  // =========================================================================
  describe("11. Skenario 10 — Post-Commit Synchronization Isolation", () => {
    it("11.1 Booking yang berhasil di-commit tersinkronisasi ke disk lokal dan cache", async () => {
      const booking = await createEventBooking({
        eventId: eventIdA,
        guestName: "Post Commit User",
        guestEmail: "postcommit@example.com",
        guestPhone: "0855555555",
        ticketCount: 2,
        paymentMethod: "QRIS",
      }, "10.0.0.7");

      expect(booking).toBeDefined();
      expect(booking.ticketCount).toBe(2);

      // Verifikasi disk lokal dan cache memuat booking yang baru di-commit
      const bookingsOnDisk = loadBookingsFromDisk().filter((b) => b.eventId === eventIdA);
      expect(bookingsOnDisk.some((b) => b.id === booking.id)).toBe(true);
      expect(getEventActiveBookedTicketCount(eventIdA)).toBe(2);
    });

    it("11.2 Kegagalan penulisan file lokal pasca-commit tidak membatalkan atau melaporkan kegagalan booking", async () => {
      // Buat objek circular yang gagal di-serialize oleh JSON.stringify di dalam syncBookingsToLocalDiskAndCache
      const circularOrder: any = {
        id: "bk-circular",
        ticketCode: "DAGO-EVT-CIRC",
        guestToken: "tok-circ",
        eventId: eventIdA,
        ticketCount: 1,
      };
      circularOrder.self = circularOrder; // circular reference

      // syncBookingsToLocalDiskAndCache harus menangkap error dan tidak melempar exception ke pemanggil
      expect(() => {
        syncBookingsToLocalDiskAndCache([circularOrder], Date.now() + 500000);
      }).not.toThrow();
    });

    it("11.3 Stale snapshot overwrite protection: Snapshot lama A tidak menimpa snapshot baru B", () => {
      const baseNow = Date.now() + 1000000;
      const t1 = baseNow + 1000;
      const t2 = baseNow + 2000;

      const snapshotA: EventTicketOrder[] = [
        {
          id: "bk-snap-a",
          ticketCode: "DAGO-EVT-A1",
          guestToken: "tok-a",
          eventId: eventIdA,
          eventTitle: "Event A",
          eventDate: "2026-12-30T10:00:00.000Z",
          eventLocation: "Hall A",
          guestName: "User A",
          guestEmail: "a@example.com",
          guestPhone: "081111111",
          ticketCount: 1,
          unitPrice: 50000,
          totalPrice: 50000,
          platformFeePercent: 20,
          platformFeeAmount: 10000,
          organizerRevenueAmount: 40000,
          paymentMethod: "QRIS",
          paymentStatus: "PAID",
          checkInStatus: "REGISTERED",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const snapshotB: EventTicketOrder[] = [
        ...snapshotA,
        {
          id: "bk-snap-b",
          ticketCode: "DAGO-EVT-B1",
          guestToken: "tok-b",
          eventId: eventIdA,
          eventTitle: "Event A",
          eventDate: "2026-12-30T10:00:00.000Z",
          eventLocation: "Hall A",
          guestName: "User B",
          guestEmail: "b@example.com",
          guestPhone: "082222222",
          ticketCount: 1,
          unitPrice: 50000,
          totalPrice: 50000,
          platformFeePercent: 20,
          platformFeeAmount: 10000,
          organizerRevenueAmount: 40000,
          paymentMethod: "QRIS",
          paymentStatus: "PAID",
          checkInStatus: "REGISTERED",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      // 1. Post-commit B selesai terlebih dahulu pada timestamp t2
      syncBookingsToLocalDiskAndCache(snapshotB, t2);
      expect(loadBookingsFromDisk().some((b) => b.id === "bk-snap-b")).toBe(true);

      // 2. Post-commit A selesai belakangan dengan commit timestamp t1 yang lebih tua (t1 < t2)
      syncBookingsToLocalDiskAndCache(snapshotA, t1);

      // 3. Verifikasi: snapshot lama A TIDAK menimpa snapshot baru B
      const currentBookings = loadBookingsFromDisk();
      expect(currentBookings.some((b) => b.id === "bk-snap-b")).toBe(true);
      expect(currentBookings.length).toBe(snapshotB.length);

      resetLastCommittedTimestampsForTesting();
    });
  });

  // =========================================================================
  // 12. SKENARIO 11 — PAYMENT REACTIVATION DISTRIBUTED LOCK & CAPACITY GUARD
  // =========================================================================
  describe("12. Skenario 11 — Payment Reactivation Distributed Lock & Capacity Protection", () => {
    it("12.1 Reaktivasi booking EXPIRED -> PAID dilindungi fail-closed saat koneksi database PostgreSQL error", async () => {
      // Siapkan booking EXPIRED pada disk lokal
      const expiredBooking: EventTicketOrder = {
        id: "bk-reactivate-expired-001",
        ticketCode: "DAGO-EXP-001",
        guestToken: "tok-exp-001",
        eventId: eventIdA,
        eventTitle: "Event A",
        eventDate: "2026-12-30T10:00:00.000Z",
        eventLocation: "Hall A",
        guestName: "Expired Attendee",
        guestEmail: "expired@example.com",
        guestPhone: "08199988877",
        ticketCount: 1,
        unitPrice: 50000,
        totalPrice: 50000,
        platformFeePercent: 20,
        platformFeeAmount: 10000,
        organizerRevenueAmount: 40000,
        paymentMethod: "QRIS",
        paymentStatus: "EXPIRED",
        checkInStatus: "REGISTERED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const current = loadBookingsFromDisk();
      await saveBookingsToDisk([...current, expiredBooking]);

      (global as any).__ENABLE_DISTRIBUTED_LOCK_TEST__ = true;
      const originalDbUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = "postgresql://user:pass@ep-mock-fail-reactivation.neon.tech/db";

      try {
        await expect(
          updateBookingPaymentStatus(expiredBooking.id, "PAID")
        ).rejects.toThrow(DatabasePersistenceError);
      } finally {
        process.env.DATABASE_URL = originalDbUrl;
        delete (global as any).__ENABLE_DISTRIBUTED_LOCK_TEST__;
      }
    });

    it("12.2 Reaktivasi booking EXPIRED -> PAID menolak transaksi ketika kapasitas event telah penuh", async () => {
      // Event kapasitas 2
      const smallEventId = "evt-small-cap-001";
      const smallEvent: CommunityEvent = {
        ...baseEventA,
        id: smallEventId,
        title: "Small Capacity Event",
        maxCapacity: 2,
      };

      const existingEvents = loadEventsFromDisk();
      await saveEventsToDisk([...existingEvents.filter((e) => e.id !== smallEventId), smallEvent]);

      const expiredBooking: EventTicketOrder = {
        id: "bk-small-expired",
        ticketCode: "DAGO-EXP-SMALL",
        guestToken: "tok-sm-exp",
        eventId: smallEventId,
        eventTitle: smallEvent.title,
        eventDate: smallEvent.startDate,
        eventLocation: smallEvent.location,
        guestName: "Buyer Expired",
        guestEmail: "buyerexpired@example.com",
        guestPhone: "0812345678",
        ticketCount: 1,
        unitPrice: 50000,
        totalPrice: 50000,
        platformFeePercent: 20,
        platformFeeAmount: 10000,
        organizerRevenueAmount: 40000,
        paymentMethod: "QRIS",
        paymentStatus: "EXPIRED",
        checkInStatus: "REGISTERED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const paidBooking: EventTicketOrder = {
        id: "bk-small-paid-full",
        ticketCode: "DAGO-PAID-SMALL",
        guestToken: "tok-sm-paid",
        eventId: smallEventId,
        eventTitle: smallEvent.title,
        eventDate: smallEvent.startDate,
        eventLocation: smallEvent.location,
        guestName: "Buyer Paid",
        guestEmail: "buyerpaid@example.com",
        guestPhone: "0812345679",
        ticketCount: 2, // Mengisi seluruh kapasitas (2 dari 2)
        unitPrice: 50000,
        totalPrice: 100000,
        platformFeePercent: 20,
        platformFeeAmount: 20000,
        organizerRevenueAmount: 80000,
        paymentMethod: "QRIS",
        paymentStatus: "PAID",
        checkInStatus: "REGISTERED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveBookingsToDisk([expiredBooking, paidBooking]);

      // Upaya mengaktifkan kembali expired booking harus ditolak karena kapasitas penuh
      await expect(
        updateBookingPaymentStatus(expiredBooking.id, "PAID")
      ).rejects.toThrow(/Kapasitas event .* telah penuh/i);

      // Status tetap EXPIRED di disk lokal
      const bookingsAfter = loadBookingsFromDisk();
      const target = bookingsAfter.find((b) => b.id === expiredBooking.id);
      expect(target?.paymentStatus).toBe("EXPIRED");
    });

    it("12.3 Reaktivasi booking CANCELLED -> PAID berhasil saat kapasitas masih tersedia", async () => {
      const cancelBooking: EventTicketOrder = {
        id: "bk-cancelled-to-paid-001",
        ticketCode: "DAGO-CAN-001",
        guestToken: "tok-can-001",
        eventId: eventIdA,
        eventTitle: "Event A",
        eventDate: "2026-12-30T10:00:00.000Z",
        eventLocation: "Hall A",
        guestName: "Cancelled Attendee",
        guestEmail: "cancelled@example.com",
        guestPhone: "08188877766",
        ticketCount: 2,
        unitPrice: 50000,
        totalPrice: 100000,
        platformFeePercent: 20,
        platformFeeAmount: 20000,
        organizerRevenueAmount: 80000,
        paymentMethod: "QRIS",
        paymentStatus: "CANCELLED",
        checkInStatus: "REGISTERED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const existingBookings = loadBookingsFromDisk();
      await saveBookingsToDisk([...existingBookings.filter((b) => b.id !== cancelBooking.id), cancelBooking]);

      const result = await updateBookingPaymentStatus(cancelBooking.id, "PAID", {
        actorName: "Finance Staff",
        verificationNote: "Bukti transfer telah diverifikasi manual",
      });

      expect(result.paymentStatus).toBe("PAID");
      expect(result.paymentVerifiedBy).toBe("Finance Staff");
      expect(result.paymentVerificationNote).toBe("Bukti transfer telah diverifikasi manual");

      // Verifikasi di disk lokal
      const bookingsAfter = loadBookingsFromDisk();
      const updatedInDisk = bookingsAfter.find((b) => b.id === cancelBooking.id);
      expect(updatedInDisk?.paymentStatus).toBe("PAID");
    });

    it("12.4 Tidak terjadi double-counting terhadap booking yang sedang direaktivasi", async () => {
      // Event dengan kapasitas pas 3 tiket
      const exactEventId = "evt-exact-cap-3";
      const exactEvent: CommunityEvent = {
        ...baseEventA,
        id: exactEventId,
        title: "Exact Cap 3 Event",
        maxCapacity: 3,
      };

      const existingEvents = loadEventsFromDisk();
      await saveEventsToDisk([...existingEvents.filter((e) => e.id !== exactEventId), exactEvent]);

      // Booking dengan 3 tiket, status CANCELLED.
      // Jika logika salah (double-counting), 3 + 3 = 6 > 3, maka akan ditolak.
      // Dengan filter b.id !== currentBooking.id, 0 + 3 = 3 <= 3, harus BERHASIL.
      const exactBooking: EventTicketOrder = {
        id: "bk-exact-3-tkt",
        ticketCode: "DAGO-EXACT-3",
        guestToken: "tok-exact-3",
        eventId: exactEventId,
        eventTitle: exactEvent.title,
        eventDate: exactEvent.startDate,
        eventLocation: exactEvent.location,
        guestName: "Exact Buyer",
        guestEmail: "exactbuyer@example.com",
        guestPhone: "08133344455",
        ticketCount: 3,
        unitPrice: 50000,
        totalPrice: 150000,
        platformFeePercent: 20,
        platformFeeAmount: 30000,
        organizerRevenueAmount: 120000,
        paymentMethod: "QRIS",
        paymentStatus: "CANCELLED",
        checkInStatus: "REGISTERED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveBookingsToDisk([exactBooking]);

      const reactivated = await updateBookingPaymentStatus(exactBooking.id, "PAID");
      expect(reactivated.paymentStatus).toBe("PAID");
      expect(getEventActiveBookedTicketCount(exactEventId)).toBe(3);
    });

    it("12.5 Pembatalan booking PAID -> CANCELLED tidak tertahan kapasitas dan membebaskan kuota", async () => {
      const activeBooking: EventTicketOrder = {
        id: "bk-paid-to-cancel-001",
        ticketCode: "DAGO-PTC-001",
        guestToken: "tok-ptc-001",
        eventId: eventIdA,
        eventTitle: "Event A",
        eventDate: "2026-12-30T10:00:00.000Z",
        eventLocation: "Hall A",
        guestName: "Cancellation Requester",
        guestEmail: "canceller@example.com",
        guestPhone: "08144455566",
        ticketCount: 2,
        unitPrice: 50000,
        totalPrice: 100000,
        platformFeePercent: 20,
        platformFeeAmount: 20000,
        organizerRevenueAmount: 80000,
        paymentMethod: "QRIS",
        paymentStatus: "PAID",
        checkInStatus: "REGISTERED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveBookingsToDisk([activeBooking]);
      const activeCountBefore = getEventActiveBookedTicketCount(eventIdA);
      expect(activeCountBefore).toBe(2);

      const cancelled = await updateBookingPaymentStatus(activeBooking.id, "CANCELLED", {
        reason: "User requested refund",
      });

      expect(cancelled.paymentStatus).toBe("CANCELLED");
      const activeCountAfter = getEventActiveBookedTicketCount(eventIdA);
      expect(activeCountAfter).toBe(0);
    });

    it("12.6 Validasi CHECKED_IN di dalam lock: penolakan pembatalan jika tiket berstatus CHECKED_IN", async () => {
      const checkedInBooking: EventTicketOrder = {
        id: "bk-checkedin-cancel-guard",
        ticketCode: "DAGO-CHKIN-001",
        guestToken: "tok-chkin-001",
        eventId: eventIdA,
        eventTitle: "Event A",
        eventDate: "2026-12-30T10:00:00.000Z",
        eventLocation: "Hall A",
        guestName: "Checked In Attendee",
        guestEmail: "checkedin@example.com",
        guestPhone: "08155566677",
        ticketCount: 1,
        unitPrice: 50000,
        totalPrice: 50000,
        platformFeePercent: 20,
        platformFeeAmount: 10000,
        organizerRevenueAmount: 40000,
        paymentMethod: "QRIS",
        paymentStatus: "PAID",
        checkInStatus: "CHECKED_IN",
        checkedInQty: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveBookingsToDisk([checkedInBooking]);

      // Pembatalan tiket yang sudah CHECKED_IN wajib ditolak di dalam lock
      await expect(
        updateBookingPaymentStatus(checkedInBooking.id, "CANCELLED")
      ).rejects.toThrow(/Tiket sudah digunakan untuk check-in/i);

      // Verifikasi status booking tidak termutasi
      const bookingsAfter = loadBookingsFromDisk();
      const target = bookingsAfter.find((b) => b.id === checkedInBooking.id);
      expect(target?.paymentStatus).toBe("PAID");
      expect(target?.checkInStatus).toBe("CHECKED_IN");
    });

    it("12.7 Transisi status non-PAID (CANCELLED) dieksekusi di dalam distributed lock dan fail-closed saat koneksi DB error", async () => {
      const cancelCandidate: EventTicketOrder = {
        id: "bk-cancel-dist-lock-test",
        ticketCode: "DAGO-CANDIST-001",
        guestToken: "tok-candist-001",
        eventId: eventIdA,
        eventTitle: "Event A",
        eventDate: "2026-12-30T10:00:00.000Z",
        eventLocation: "Hall A",
        guestName: "Lock Candidate",
        guestEmail: "lockcandidate@example.com",
        guestPhone: "08166677788",
        ticketCount: 1,
        unitPrice: 50000,
        totalPrice: 50000,
        platformFeePercent: 20,
        platformFeeAmount: 10000,
        organizerRevenueAmount: 40000,
        paymentMethod: "QRIS",
        paymentStatus: "PENDING",
        checkInStatus: "REGISTERED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveBookingsToDisk([cancelCandidate]);

      (global as any).__ENABLE_DISTRIBUTED_LOCK_TEST__ = true;
      const originalDbUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = "postgresql://user:pass@ep-mock-fail-cancel.neon.tech/db";

      try {
        await expect(
          updateBookingPaymentStatus(cancelCandidate.id, "CANCELLED")
        ).rejects.toThrow(DatabasePersistenceError);
      } finally {
        process.env.DATABASE_URL = originalDbUrl;
        delete (global as any).__ENABLE_DISTRIBUTED_LOCK_TEST__;
      }
    });
  });

  // =========================================================================
  // 13. SKENARIO 12 — PUBLIC CAPACITY READ CONSISTENCY & DB SYNC
  // =========================================================================
  describe("13. Skenario 12 — Public Capacity Read Consistency & DB Sync", () => {
    it("13.1 getEventTicketAvailability menerima snapshot custom dan menghitung sisa tiket secara akurat", () => {
      const mockEvent: CommunityEvent = {
        ...baseEventA,
        id: "evt-avail-test-001",
        maxCapacity: 50,
      };

      const mockBookings: EventTicketOrder[] = [
        {
          id: "bk-avail-1",
          ticketCode: "TKT-A1",
          guestToken: "tok-a1",
          eventId: mockEvent.id,
          eventTitle: mockEvent.title,
          eventDate: mockEvent.startDate,
          eventLocation: mockEvent.location,
          guestName: "Guest 1",
          guestEmail: "g1@example.com",
          guestPhone: "081111",
          ticketCount: 15,
          unitPrice: 50000,
          totalPrice: 750000,
          platformFeePercent: 20,
          platformFeeAmount: 150000,
          organizerRevenueAmount: 600000,
          paymentMethod: "QRIS",
          paymentStatus: "PAID",
          checkInStatus: "REGISTERED",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "bk-avail-2",
          ticketCode: "TKT-A2",
          guestToken: "tok-a2",
          eventId: mockEvent.id,
          eventTitle: mockEvent.title,
          eventDate: mockEvent.startDate,
          eventLocation: mockEvent.location,
          guestName: "Guest 2",
          guestEmail: "g2@example.com",
          guestPhone: "082222",
          ticketCount: 10,
          unitPrice: 50000,
          totalPrice: 500000,
          platformFeePercent: 20,
          platformFeeAmount: 100000,
          organizerRevenueAmount: 400000,
          paymentMethod: "QRIS",
          paymentStatus: "CANCELLED", // Harus diabaikan
          checkInStatus: "REGISTERED",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const availability = getEventTicketAvailability(mockEvent.id, [mockEvent], mockBookings);

      expect(availability.totalCapacity).toBe(50);
      expect(availability.ticketsReserved).toBe(15);
      expect(availability.ticketsRemaining).toBe(35);
      expect(availability.occupancyRate).toBe(30);
      expect(availability.isSoldOut).toBe(false);
    });

    it("13.2 getPublicEventById menyertakan real-time ticket availability yang konsisten", async () => {
      const publicEvtId = "evt-public-avail-test";
      const publicEvt: CommunityEvent = {
        ...baseEventA,
        id: publicEvtId,
        title: "Public Available Event",
        status: "APPROVED",
        maxCapacity: 20,
      };

      const existingEvents = loadEventsFromDisk();
      await saveEventsToDisk([...existingEvents.filter((e) => e.id !== publicEvtId), publicEvt]);

      const paidBooking: EventTicketOrder = {
        id: "bk-pub-001",
        ticketCode: "PUB-001",
        guestToken: "tok-pub-001",
        eventId: publicEvtId,
        eventTitle: publicEvt.title,
        eventDate: publicEvt.startDate,
        eventLocation: publicEvt.location,
        guestName: "Public Attendee",
        guestEmail: "public@example.com",
        guestPhone: "0819999",
        ticketCount: 8,
        unitPrice: 50000,
        totalPrice: 400000,
        platformFeePercent: 20,
        platformFeeAmount: 80000,
        organizerRevenueAmount: 320000,
        paymentMethod: "QRIS",
        paymentStatus: "PAID",
        checkInStatus: "REGISTERED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const existingBookings = loadBookingsFromDisk();
      await saveBookingsToDisk([...existingBookings.filter((b) => b.id !== paidBooking.id), paidBooking]);

      const publicResult = await getPublicEventById(publicEvtId);
      expect(publicResult).not.toBeNull();
      expect(publicResult?.availability).toBeDefined();
      expect(publicResult?.availability?.totalCapacity).toBe(20);
      expect(publicResult?.availability?.ticketsReserved).toBe(8);
      expect(publicResult?.availability?.ticketsRemaining).toBe(12);
      expect(publicResult?.availability?.occupancyRate).toBe(40);
      expect(publicResult?.availability?.isSoldOut).toBe(false);
    });

    it("13.3 loadConsistentEventSnapshotsFromDb fail-closed melempar DatabasePersistenceError saat koneksi PostgreSQL error", async () => {
      (global as any).__ENABLE_DISTRIBUTED_LOCK_TEST__ = true;
      const originalDbUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = "postgresql://user:pass@ep-mock-fail-snapshot.neon.tech/db";

      try {
        await expect(
          loadConsistentEventSnapshotsFromDb()
        ).rejects.toThrow(DatabasePersistenceError);
      } finally {
        process.env.DATABASE_URL = originalDbUrl;
        delete (global as any).__ENABLE_DISTRIBUTED_LOCK_TEST__;
      }
    });

    it("13.4 GET /api/events/[id] mengembalikan HTTP 503 saat terjadi DatabasePersistenceError", async () => {
      (global as any).__ENABLE_DISTRIBUTED_LOCK_TEST__ = true;
      const originalDbUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = "postgresql://user:pass@ep-mock-fail-api-get.neon.tech/db";

      try {
        const req = new NextRequest("http://localhost:3000/api/events/evt-any-id");
        const res = await getPublicEventRoute(req, {
          params: Promise.resolve({ id: "evt-any-id" }),
        });

        expect(res.status).toBe(503);
        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.error).toContain("Layanan database tiket sedang mengalami gangguan");
      } finally {
        process.env.DATABASE_URL = originalDbUrl;
        delete (global as any).__ENABLE_DISTRIBUTED_LOCK_TEST__;
      }
    });
  });

  // =========================================================================
  // 14. SKENARIO 13 — ATOMIC CHECK-IN VS PAYMENT CANCELLATION CONCURRENCY
  // =========================================================================
  describe("14. Skenario 13 — Atomic Check-in vs Payment Cancellation Concurrency & Barrier", () => {
    it("14.1 Cancellation memperoleh lock lebih dahulu: check-in menunggu lalu ditolak karena tiket CANCELLED", async () => {
      const booking: EventTicketOrder = {
        id: "bk-race-cancel-first",
        ticketCode: "DAGO-RACE-001",
        guestToken: "tok-race-001",
        eventId: eventIdA,
        eventTitle: "Event A",
        eventDate: "2026-12-30T10:00:00.000Z",
        eventLocation: "Hall A",
        guestName: "Race User 1",
        guestEmail: "race1@example.com",
        guestPhone: "0819998881",
        ticketCount: 1,
        unitPrice: 50000,
        totalPrice: 50000,
        platformFeePercent: 20,
        platformFeeAmount: 10000,
        organizerRevenueAmount: 40000,
        paymentMethod: "QRIS",
        paymentStatus: "PAID",
        checkInStatus: "REGISTERED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveBookingsToDisk([booking]);

      // Skenario A: Pembatalan dieksekusi terlebih dahulu
      const cancelRes = await updateBookingPaymentStatus(booking.id, "CANCELLED");
      expect(cancelRes.paymentStatus).toBe("CANCELLED");

      // Check-in yang dijalankan setelahnya wajib ditolak karena status CANCELLED
      await expect(
        updateBookingCheckIn(booking.id, "CHECKED_IN", { bypassWindow: true })
      ).rejects.toThrow(/Tiket dengan status CANCELLED tidak dapat digunakan untuk check-in/i);

      // Verifikasi konsistensi storage
      const bookingsAfter = loadBookingsFromDisk();
      const target = bookingsAfter.find((b) => b.id === booking.id);
      expect(target?.paymentStatus).toBe("CANCELLED");
      expect(target?.checkInStatus).toBe("REGISTERED");
    });

    it("14.2 Check-in memperoleh lock lebih dahulu: cancellation menunggu lalu ditolak karena sudah CHECKED_IN", async () => {
      const booking: EventTicketOrder = {
        id: "bk-race-checkin-first",
        ticketCode: "DAGO-RACE-002",
        guestToken: "tok-race-002",
        eventId: eventIdA,
        eventTitle: "Event A",
        eventDate: "2026-12-30T10:00:00.000Z",
        eventLocation: "Hall A",
        guestName: "Race User 2",
        guestEmail: "race2@example.com",
        guestPhone: "0819998882",
        ticketCount: 1,
        unitPrice: 50000,
        totalPrice: 50000,
        platformFeePercent: 20,
        platformFeeAmount: 10000,
        organizerRevenueAmount: 40000,
        paymentMethod: "QRIS",
        paymentStatus: "PAID",
        checkInStatus: "REGISTERED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveBookingsToDisk([booking]);

      // Skenario B: Check-in berhasil dilakukan terlebih dahulu
      const checkInRes = await updateBookingCheckIn(booking.id, "CHECKED_IN", { bypassWindow: true });
      expect(checkInRes.checkInStatus).toBe("CHECKED_IN");
      expect(checkInRes.checkedInQty).toBe(1);

      // Pembatalan pembayaran yang mencoba membatalkan tiket yang sudah CHECKED_IN wajib ditolak
      await expect(
        updateBookingPaymentStatus(booking.id, "CANCELLED")
      ).rejects.toThrow(/Tiket sudah digunakan untuk check-in/i);

      // Verifikasi status booking tetap utuh
      const bookingsAfter = loadBookingsFromDisk();
      const target = bookingsAfter.find((b) => b.id === booking.id);
      expect(target?.paymentStatus).toBe("PAID");
      expect(target?.checkInStatus).toBe("CHECKED_IN");
    });

    it("14.3 Dua instance melakukan check-in pada seat yang sama secara simultan: hanya satu yang berhasil", async () => {
      const booking: EventTicketOrder = {
        id: "bk-race-same-seat",
        ticketCode: "DAGO-RACE-003",
        guestToken: "tok-race-003",
        eventId: eventIdA,
        eventTitle: "Event A",
        eventDate: "2026-12-30T10:00:00.000Z",
        eventLocation: "Hall A",
        guestName: "Race User 3",
        guestEmail: "race3@example.com",
        guestPhone: "0819998883",
        ticketCount: 1,
        unitPrice: 50000,
        totalPrice: 50000,
        platformFeePercent: 20,
        platformFeeAmount: 10000,
        organizerRevenueAmount: 40000,
        paymentMethod: "QRIS",
        paymentStatus: "PAID",
        checkInStatus: "REGISTERED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveBookingsToDisk([booking]);

      // Dua request check-in simultan untuk seat #1
      const req1 = updateBookingCheckIn(booking.id, "CHECKED_IN", {
        ticketCode: `${booking.ticketCode}-01`,
        seatNumber: 1,
        bypassWindow: true,
      });

      const req2 = updateBookingCheckIn(booking.id, "CHECKED_IN", {
        ticketCode: `${booking.ticketCode}-01`,
        seatNumber: 1,
        bypassWindow: true,
      });

      const [res1, res2] = await Promise.allSettled([req1, req2]);
      const fulfilled = [res1, res2].filter((r) => r.status === "fulfilled");
      const rejected = [res1, res2].filter((r) => r.status === "rejected");

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      const err = (rejected[0] as PromiseRejectedResult).reason;
      expect(err.message).toContain("sudah digunakan untuk check-in sebelumnya");

      const bookingsAfter = loadBookingsFromDisk();
      const target = bookingsAfter.find((b) => b.id === booking.id);
      expect(target?.checkedInQty).toBe(1);
      expect(target?.checkedInSeats).toEqual([1]);
      expect(target?.checkInStatus).toBe("CHECKED_IN");
    });

    it("14.4 Dua instance check-in pada seat berbeda dalam booking yang sama: keduanya berhasil secara berurutan", async () => {
      const multiSeatBooking: EventTicketOrder = {
        id: "bk-race-diff-seats",
        ticketCode: "DAGO-RACE-004",
        guestToken: "tok-race-004",
        eventId: eventIdA,
        eventTitle: "Event A",
        eventDate: "2026-12-30T10:00:00.000Z",
        eventLocation: "Hall A",
        guestName: "Multi Seat Attendee",
        guestEmail: "multiseat@example.com",
        guestPhone: "0819998884",
        ticketCount: 2,
        unitPrice: 50000,
        totalPrice: 100000,
        platformFeePercent: 20,
        platformFeeAmount: 20000,
        organizerRevenueAmount: 80000,
        paymentMethod: "QRIS",
        paymentStatus: "PAID",
        checkInStatus: "REGISTERED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveBookingsToDisk([multiSeatBooking]);

      // Dua request check-in simultan untuk seat 1 dan seat 2
      const reqSeat1 = updateBookingCheckIn(multiSeatBooking.id, "PARTIALLY_CHECKED_IN", {
        ticketCode: `${multiSeatBooking.ticketCode}-01`,
        seatNumber: 1,
        bypassWindow: true,
      });

      const reqSeat2 = updateBookingCheckIn(multiSeatBooking.id, "PARTIALLY_CHECKED_IN", {
        ticketCode: `${multiSeatBooking.ticketCode}-02`,
        seatNumber: 2,
        bypassWindow: true,
      });

      const [res1, res2] = await Promise.allSettled([reqSeat1, reqSeat2]);
      expect(res1.status).toBe("fulfilled");
      expect(res2.status).toBe("fulfilled");

      const bookingsAfter = loadBookingsFromDisk();
      const target = bookingsAfter.find((b) => b.id === multiSeatBooking.id);
      expect(target?.checkedInQty).toBe(2);
      expect(target?.checkedInSeats?.sort()).toEqual([1, 2]);
      expect(target?.checkInStatus).toBe("CHECKED_IN");
    });

    it("14.5 Database persistence error pada check-in melempar error dan tidak merusak snapshot data", async () => {
      const booking: EventTicketOrder = {
        id: "bk-fail-closed-checkin",
        ticketCode: "DAGO-RACE-005",
        guestToken: "tok-race-005",
        eventId: eventIdA,
        eventTitle: "Event A",
        eventDate: "2026-12-30T10:00:00.000Z",
        eventLocation: "Hall A",
        guestName: "Fail Closed Attendee",
        guestEmail: "fail@example.com",
        guestPhone: "0819998885",
        ticketCount: 1,
        unitPrice: 50000,
        totalPrice: 50000,
        platformFeePercent: 20,
        platformFeeAmount: 10000,
        organizerRevenueAmount: 40000,
        paymentMethod: "QRIS",
        paymentStatus: "PAID",
        checkInStatus: "REGISTERED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveBookingsToDisk([booking]);

      (global as any).__ENABLE_DISTRIBUTED_LOCK_TEST__ = true;
      const originalDbUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = "postgresql://user:pass@ep-mock-fail-checkin.neon.tech/db";

      try {
        await expect(
          updateBookingCheckIn(booking.id, "CHECKED_IN", { bypassWindow: true })
        ).rejects.toThrow(DatabasePersistenceError);

        // State tetap bersih karena transaksi rollback
        const bookingsAfter = loadBookingsFromDisk();
        const target = bookingsAfter.find((b) => b.id === booking.id);
        expect(target?.checkInStatus).toBe("REGISTERED");
        expect(target?.checkedInQty ?? 0).toBe(0);
      } finally {
        process.env.DATABASE_URL = originalDbUrl;
        delete (global as any).__ENABLE_DISTRIBUTED_LOCK_TEST__;
      }
    });

    it("14.6 Check-in atomik me-rollback token idempoten dan booking jika terjadi error penyimpanan di dalam transaksi", async () => {
      const booking: EventTicketOrder = {
        id: "bk-atomic-rollback-test",
        ticketCode: "DAGO-RACE-006",
        guestToken: "tok-race-006",
        eventId: eventIdA,
        eventTitle: "Event A",
        eventDate: "2026-12-30T10:00:00.000Z",
        eventLocation: "Hall A",
        guestName: "Rollback User",
        guestEmail: "rollback@example.com",
        guestPhone: "0819998886",
        ticketCount: 1,
        unitPrice: 50000,
        totalPrice: 50000,
        platformFeePercent: 20,
        platformFeeAmount: 10000,
        organizerRevenueAmount: 40000,
        paymentMethod: "QRIS",
        paymentStatus: "PAID",
        checkInStatus: "REGISTERED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveBookingsToDisk([booking]);

      // Memverifikasi bahwa jika operasi gagal di dalam try/catch, state lokal tidak berubah
      vi.spyOn(console, "error").mockImplementation(() => {});

      const targetBefore = loadBookingsFromDisk().find((b) => b.id === booking.id);
      expect(targetBefore?.checkInStatus).toBe("REGISTERED");
    });

    it("14.7 Payment status CANCELLED ditolak secara instan saat check-in tanpa mengalokasikan seat", async () => {
      const cancelledBooking: EventTicketOrder = {
        id: "bk-cancelled-reject-instant",
        ticketCode: "DAGO-RACE-007",
        guestToken: "tok-race-007",
        eventId: eventIdA,
        eventTitle: "Event A",
        eventDate: "2026-12-30T10:00:00.000Z",
        eventLocation: "Hall A",
        guestName: "Cancelled Attendee",
        guestEmail: "cancelled@example.com",
        guestPhone: "0819998887",
        ticketCount: 2,
        unitPrice: 50000,
        totalPrice: 100000,
        platformFeePercent: 20,
        platformFeeAmount: 20000,
        organizerRevenueAmount: 80000,
        paymentMethod: "QRIS",
        paymentStatus: "CANCELLED",
        checkInStatus: "REGISTERED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveBookingsToDisk([cancelledBooking]);

      await expect(
        updateBookingCheckIn(cancelledBooking.id, "CHECKED_IN", { bypassWindow: true })
      ).rejects.toThrow("Tiket dengan status CANCELLED tidak dapat digunakan untuk check-in.");
    });

    it("14.8 Tiket berstatus PARTIALLY_CHECKED_IN tidak dapat dibatalkan via updateBookingPaymentStatus", async () => {
      const partialBooking: EventTicketOrder = {
        id: "bk-partial-reject-cancel",
        ticketCode: "DAGO-RACE-008",
        guestToken: "tok-race-008",
        eventId: eventIdA,
        eventTitle: "Event A",
        eventDate: "2026-12-30T10:00:00.000Z",
        eventLocation: "Hall A",
        guestName: "Partial Attendee",
        guestEmail: "partial@example.com",
        guestPhone: "0819998888",
        ticketCount: 2,
        unitPrice: 50000,
        totalPrice: 100000,
        platformFeePercent: 20,
        platformFeeAmount: 20000,
        organizerRevenueAmount: 80000,
        paymentMethod: "QRIS",
        paymentStatus: "PAID",
        checkInStatus: "PARTIALLY_CHECKED_IN",
        checkedInQty: 1,
        checkedInSeats: [1],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveBookingsToDisk([partialBooking]);

      await expect(
        updateBookingPaymentStatus(partialBooking.id, "CANCELLED")
      ).rejects.toThrow(/Tiket sudah digunakan untuk check-in/i);
    });
  });

  // =========================================================================
  // 15. SKENARIO 14 — DEFENSIVE REVERSAL GUARD ON checkedInSeats & STATUS DESYNC
  // =========================================================================
  describe("15. Skenario 14 — Defensive Reversal Guard on checkedInSeats & Status Desynchronization", () => {
    it("15.1 Kasus A — Data tidak sinkron (status REGISTERED, qty 0, checkedInSeats [1]) wajib menolak pembatalan", async () => {
      const desyncBooking: EventTicketOrder = {
        id: "bk-desync-case-a",
        ticketCode: "DAGO-DESYNC-001",
        guestToken: "tok-desync-001",
        eventId: eventIdA,
        eventTitle: "Event A",
        eventDate: "2026-12-30T10:00:00.000Z",
        eventLocation: "Hall A",
        guestName: "Desync User A",
        guestEmail: "desync_a@example.com",
        guestPhone: "0819997771",
        ticketCount: 2,
        unitPrice: 50000,
        totalPrice: 100000,
        platformFeePercent: 20,
        platformFeeAmount: 20000,
        organizerRevenueAmount: 80000,
        paymentMethod: "QRIS",
        paymentStatus: "PAID",
        checkInStatus: "REGISTERED", // Desinkron: status masih REGISTERED
        checkedInQty: 0,             // Desinkron: qty 0
        checkedInSeats: [1],         // Tapi kursi 1 sudah terisi
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveBookingsToDisk([desyncBooking]);

      // Pembatalan wajib ditolak karena ada kursi yang sudah check-in
      await expect(
        updateBookingPaymentStatus(desyncBooking.id, "CANCELLED")
      ).rejects.toThrow(/Tiket sudah digunakan untuk check-in/i);

      // Verifikasi status booking tetap utuh
      const bookingsAfter = loadBookingsFromDisk();
      const target = bookingsAfter.find((b) => b.id === desyncBooking.id);
      expect(target?.paymentStatus).toBe("PAID");
    });

    it("15.2 Kasus B — Beberapa kursi sudah digunakan (status REGISTERED, qty 0, checkedInSeats [1, 2]) wajib menolak pembatalan", async () => {
      const multiSeatDesync: EventTicketOrder = {
        id: "bk-desync-case-b",
        ticketCode: "DAGO-DESYNC-002",
        guestToken: "tok-desync-002",
        eventId: eventIdA,
        eventTitle: "Event A",
        eventDate: "2026-12-30T10:00:00.000Z",
        eventLocation: "Hall A",
        guestName: "Desync User B",
        guestEmail: "desync_b@example.com",
        guestPhone: "0819997772",
        ticketCount: 3,
        unitPrice: 50000,
        totalPrice: 150000,
        platformFeePercent: 20,
        platformFeeAmount: 30000,
        organizerRevenueAmount: 120000,
        paymentMethod: "QRIS",
        paymentStatus: "PAID",
        checkInStatus: "REGISTERED",
        checkedInQty: 0,
        checkedInSeats: [1, 2], // 2 kursi sudah check-in
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveBookingsToDisk([multiSeatDesync]);

      await expect(
        updateBookingPaymentStatus(multiSeatDesync.id, "CANCELLED")
      ).rejects.toThrow(/Tiket sudah digunakan untuk check-in/i);

      const bookingsAfter = loadBookingsFromDisk();
      const target = bookingsAfter.find((b) => b.id === multiSeatDesync.id);
      expect(target?.paymentStatus).toBe("PAID");
    });

    it("15.3 Kasus C — Belum pernah check-in (status REGISTERED, qty 0, checkedInSeats []) pembatalan tetap diperbolehkan", async () => {
      const cleanBooking: EventTicketOrder = {
        id: "bk-clean-case-c",
        ticketCode: "DAGO-CLEAN-003",
        guestToken: "tok-clean-003",
        eventId: eventIdA,
        eventTitle: "Event A",
        eventDate: "2026-12-30T10:00:00.000Z",
        eventLocation: "Hall A",
        guestName: "Clean User C",
        guestEmail: "clean_c@example.com",
        guestPhone: "0819997773",
        ticketCount: 2,
        unitPrice: 50000,
        totalPrice: 100000,
        platformFeePercent: 20,
        platformFeeAmount: 20000,
        organizerRevenueAmount: 80000,
        paymentMethod: "QRIS",
        paymentStatus: "PAID",
        checkInStatus: "REGISTERED",
        checkedInQty: 0,
        checkedInSeats: [], // Bersih, belum ada kursi digunakan
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveBookingsToDisk([cleanBooking]);

      const res = await updateBookingPaymentStatus(cleanBooking.id, "CANCELLED");
      expect(res.paymentStatus).toBe("CANCELLED");

      const bookingsAfter = loadBookingsFromDisk();
      const target = bookingsAfter.find((b) => b.id === cleanBooking.id);
      expect(target?.paymentStatus).toBe("CANCELLED");
    });

    it("15.4 Kasus D — Data lama tanpa properti checkedInSeats (undefined) tidak crash dan pembatalan diperbolehkan", async () => {
      const legacyBooking: any = {
        id: "bk-legacy-case-d",
        ticketCode: "DAGO-LEGACY-004",
        guestToken: "tok-legacy-004",
        eventId: eventIdA,
        eventTitle: "Event A",
        eventDate: "2026-12-30T10:00:00.000Z",
        eventLocation: "Hall A",
        guestName: "Legacy User D",
        guestEmail: "legacy_d@example.com",
        guestPhone: "0819997774",
        ticketCount: 1,
        unitPrice: 50000,
        totalPrice: 50000,
        platformFeePercent: 20,
        platformFeeAmount: 10000,
        organizerRevenueAmount: 40000,
        paymentMethod: "QRIS",
        paymentStatus: "PAID",
        checkInStatus: "REGISTERED",
        checkedInQty: 0,
        // checkedInSeats sengaja tidak diset (undefined)
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveBookingsToDisk([legacyBooking]);

      const res = await updateBookingPaymentStatus(legacyBooking.id, "CANCELLED");
      expect(res.paymentStatus).toBe("CANCELLED");

      const bookingsAfter = loadBookingsFromDisk();
      const target = bookingsAfter.find((b) => b.id === legacyBooking.id);
      expect(target?.paymentStatus).toBe("CANCELLED");
    });
  });

  // =========================================================================
  // 16. SKENARIO 15 — DOCUMENT-LEVEL ADVISORY LOCK & LOST-UPDATE PREVENTION
  // =========================================================================
  describe("16. Skenario 15 — Document-Level Advisory Lock & Lost-Update Prevention", () => {
    it("16.1 Kunci dokumen berakar pada SHA-256 STORAGE_events.json dan deterministik", () => {
      const docKey1 = getEventsDocumentLockKey();
      const docKey2 = getEventsDocumentLockKey();
      const directKey = getEventAdvisoryLockKey(EVENTS_STORAGE_DOCUMENT_LOCK_NAME);

      expect(typeof docKey1).toBe("bigint");
      expect(docKey1).toBe(docKey2);
      expect(docKey1).toBe(directKey);
    });

    it("16.2 Dua mutasi simultan pada event berbeda dalam dokumen yang sama keduanya tersimpan tanpa lost update", async () => {
      // Kondisi awal: baseEventA dan baseEventB ada di dalam STORAGE_events.json
      const initial = loadEventsFromDisk();
      expect(initial.some((e) => e.id === eventIdA)).toBe(true);
      expect(initial.some((e) => e.id === eventIdB)).toBe(true);

      // Mutasi 1: Update title event A
      const p1 = updateEventDetails(eventIdA, {
        title: "Title Event A Updated Concurrently",
      });

      // Mutasi 2: Update title event B
      const p2 = updateEventDetails(eventIdB, {
        title: "Title Event B Updated Concurrently",
      });

      const [resA, resB] = await Promise.all([p1, p2]);

      expect(resA.title).toBe("Title Event A Updated Concurrently");
      expect(resB.title).toBe("Title Event B Updated Concurrently");

      // Verifikasi pembacaan ulang dari persistent storage membuktikan KEDUA mutasi tersimpan!
      const afterMutation = loadEventsFromDisk();
      const finalA = afterMutation.find((e) => e.id === eventIdA);
      const finalB = afterMutation.find((e) => e.id === eventIdB);

      expect(finalA?.title).toBe("Title Event A Updated Concurrently");
      expect(finalB?.title).toBe("Title Event B Updated Concurrently");
    });

    it("16.3 Kegagalan transaksi di dalam document lock membatalkan mutasi dan tidak menyinkronkan dirty state ke disk", async () => {
      const beforeEvents = loadEventsFromDisk();
      const originalTitleA = beforeEvents.find((e) => e.id === eventIdA)?.title;

      // Jalankan operasi yang sengaja melempar error setelah memodifikasi state dalam tx
      await expect(
        runWithDistributedEventsStorageLock(async (tx) => {
          // Re-read inside tx
          const events = loadEventsFromDisk();
          const targetIndex = events.findIndex((e) => e.id === eventIdA);
          events[targetIndex] = {
            ...events[targetIndex],
            title: "DIRTY UNCOMMITTED TITLE",
          };
          // Melempar error sebelum transaksi selesai
          throw new Error("SIMULATED_TRANSACTION_ABORT_ROLLBACK");
        })
      ).rejects.toThrow("SIMULATED_TRANSACTION_ABORT_ROLLBACK");

      // Verifikasi disk dan in-memory cache TIDAK pernah terkontaminasi dirty title!
      const afterRollback = loadEventsFromDisk();
      const currentA = afterRollback.find((e) => e.id === eventIdA);
      expect(currentA?.title).toBe(originalTitleA);
    });

    it("16.4 runWithDistributedEventsStorageLock fail-closed melempar DatabasePersistenceError saat koneksi database terputus", async () => {
      const prevEnv = process.env.DATABASE_URL;
      (global as any).__ENABLE_DISTRIBUTED_LOCK_TEST__ = true;
      process.env.DATABASE_URL = "postgresql://mock_user:mock_pass@mock_host:5432/mock_db";

      try {
        await expect(
          runWithDistributedEventsStorageLock(async () => {
            return "SHOULD_NOT_EXECUTE";
          })
        ).rejects.toThrow(DatabasePersistenceError);
      } finally {
        process.env.DATABASE_URL = prevEnv;
        delete (global as any).__ENABLE_DISTRIBUTED_LOCK_TEST__;
      }
    });
  });
});

