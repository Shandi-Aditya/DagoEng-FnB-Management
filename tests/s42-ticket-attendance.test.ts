import { describe, it, expect, beforeEach, vi } from "vitest";
import type { EventTicketOrder } from "@/types/event";
import {
  validateTicketCheckIn,
  calculateCheckInStats,
  formatCheckInTime,
  getBookingAttendance,
  parseTicketScanCode,
} from "@/features/events-checkin/events-checkin-domain";
import {
  filterOrganizerAttendees,
  buildAttendeesExportRows,
} from "@/features/events-portal/events-portal-domain";
import { getSubTicketDetails } from "@/features/events-tickets/ticket-pass-domain";
import { checkedInGuests } from "@/features/events-portal/events-portal-groups";
import {
  updateBookingCheckIn,
  formatCheckInTimeWita,
  loadBookingsSnapshotFromTxOrDisk,
  createEventSubmission,
  updateEventStatus,
  createEventBooking,
  updateBookingPaymentStatus,
} from "@/lib/events";

function createMockTicket(override: Partial<EventTicketOrder> = {}): EventTicketOrder {
  return {
    id: "tkt-s42-01",
    ticketCode: "DAGO-EVT-S42-01",
    eventId: "evt-s42-music",
    eventTitle: "Jazz Night Singaraja",
    eventDate: "2026-12-07T19:00:00Z",
    eventLocation: "Dago Space Hub",
    guestName: "Made Artha",
    guestEmail: "artha@example.com",
    guestPhone: "081234567890",
    ticketCount: 1,
    unitPrice: 75000,
    totalPrice: 75000,
    platformFeePercent: 20,
    platformFeeAmount: 15000,
    organizerRevenueAmount: 60000,
    paymentMethod: "QRIS",
    paymentStatus: "PAID",
    checkInStatus: "REGISTERED",
    createdAt: "2026-11-20T10:00:00Z",
    updatedAt: "2026-11-20T10:00:00Z",
    ...override,
  };
}

describe("Task S-42: Status Kehadiran Tiket & Check-In", () => {
  describe("1. Validasi Kehadiran & Penolakan Scan (Domain)", () => {
    it("menolak check-in tiket yang berstatus PENDING (belum lunas)", () => {
      const ticket = createMockTicket({ paymentStatus: "PENDING" });
      const result = validateTicketCheckIn(ticket, ticket.eventId);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("UNPAID");
      expect(result.message).toContain("status pembayaran masih PENDING");
    });

    it("menolak check-in tiket yang dibatalkan (CANCELLED)", () => {
      const ticket = createMockTicket({ paymentStatus: "CANCELLED" });
      const result = validateTicketCheckIn(ticket, ticket.eventId);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("UNPAID");
      expect(result.message).toContain("CANCELLED");
    });

    it("menolak check-in tiket yang kedaluwarsa (EXPIRED)", () => {
      const ticket = createMockTicket({ paymentStatus: "EXPIRED" });
      const result = validateTicketCheckIn(ticket, ticket.eventId);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("UNPAID");
      expect(result.message).toContain("EXPIRED");
    });

    it("menyetujui tiket lunas yang belum check-in", () => {
      const ticket = createMockTicket({ paymentStatus: "PAID", checkInStatus: "REGISTERED" });
      const result = validateTicketCheckIn(ticket, ticket.eventId);
      expect(result.valid).toBe(true);
      expect(result.code).toBe("OK");
      expect(result.targetStatus).toBe("CHECKED_IN");
      expect(result.isComplete).toBe(true);
    });

    it("menolak scan kedua dengan pesan bahwa tiket sudah dipakai beserta jam check-in", () => {
      const checkInIso = "2026-12-07T14:30:00+08:00";
      const checkedTicket = createMockTicket({
        paymentStatus: "PAID",
        checkInStatus: "CHECKED_IN",
        checkedInQty: 1,
        checkInTime: checkInIso,
      });

      const result = validateTicketCheckIn(checkedTicket, checkedTicket.eventId);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("ALREADY_USED");
      expect(result.message).toContain("Tiket sudah dipakai");
      expect(result.message).toMatch(/sudah dipakai, check-in pukul \d{2}[:.]\d{2} WITA/i);
    });

    it("menolak scan kedua sub-tiket rombongan yang sama beserta jam check-in sub-tiket", () => {
      const checkInIso = "2026-12-07T15:15:00+08:00";
      const groupTicket = createMockTicket({
        ticketCount: 3,
        paymentStatus: "PAID",
        checkInStatus: "PARTIALLY_CHECKED_IN",
        checkedInQty: 1,
        checkedInSeats: [1],
        seatCheckInTimes: { "1": checkInIso },
      });

      // Scan ulang tiket #1 ditolak
      const resSeat1 = validateTicketCheckIn(groupTicket, groupTicket.eventId, 1);
      expect(resSeat1.valid).toBe(false);
      expect(resSeat1.code).toBe("SEAT_ALREADY_USED");
      expect(resSeat1.message).toContain("Tiket #1 sudah dipakai");
      expect(resSeat1.message).toMatch(/sudah dipakai, check-in pukul \d{2}[:.]\d{2} WITA/i);

      // Scan tiket #2 diizinkan
      const resSeat2 = validateTicketCheckIn(groupTicket, groupTicket.eventId, 2);
      expect(resSeat2.valid).toBe(true);
      expect(resSeat2.code).toBe("OK");
    });
  });

  describe("2. Filter Hadir / Belum Hadir & Rekapitulasi Penyelenggara (Organizer)", () => {
    const sampleBookings: EventTicketOrder[] = [
      createMockTicket({
        id: "b-1",
        ticketCode: "EVT-01",
        guestName: "Peserta 1",
        ticketCount: 1,
        paymentStatus: "PAID",
        checkInStatus: "CHECKED_IN",
        checkedInQty: 1,
        checkInTime: "2026-12-07T14:00:00+08:00",
        checkedInBy: "Hendra Staff",
      }),
      createMockTicket({
        id: "b-2",
        ticketCode: "EVT-02",
        guestName: "Peserta 2",
        ticketCount: 2,
        paymentStatus: "PAID",
        checkInStatus: "PARTIALLY_CHECKED_IN",
        checkedInQty: 1,
        checkedInSeats: [1],
        checkInTime: "2026-12-07T14:10:00+08:00",
        checkedInBy: "Hendra Staff",
      }),
      createMockTicket({
        id: "b-3",
        ticketCode: "EVT-03",
        guestName: "Peserta 3",
        ticketCount: 1,
        paymentStatus: "PAID",
        checkInStatus: "REGISTERED",
        checkedInQty: 0,
      }),
      createMockTicket({
        id: "b-4",
        ticketCode: "EVT-04",
        guestName: "Peserta Batal",
        ticketCount: 1,
        paymentStatus: "CANCELLED",
        checkInStatus: "REGISTERED",
        checkedInQty: 0,
      }),
    ];

    it("menghitung jumlah kehadiran tepat sama dengan total tiket yang sudah scan", () => {
      // Event-level count
      const totalHadir = checkedInGuests("evt-s42-music", sampleBookings);
      // b-1 (1 hadir) + b-2 (1 hadir) = 2 tiket hadir
      expect(totalHadir).toBe(2);

      // All events count
      const allHadir = checkedInGuests("ALL", sampleBookings);
      expect(allHadir).toBe(2);
    });

    it("menyaring daftar peserta dengan filter CHECKED_IN", () => {
      const filtered = filterOrganizerAttendees(sampleBookings, "ALL", "", null, "ALL", "CHECKED_IN");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("b-1");
    });

    it("menyaring daftar peserta dengan filter PARTIALLY_CHECKED_IN", () => {
      const filtered = filterOrganizerAttendees(sampleBookings, "ALL", "", null, "ALL", "PARTIALLY_CHECKED_IN");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("b-2");
    });

    it("menyaring daftar peserta dengan filter REGISTERED (Belum hadir)", () => {
      const filtered = filterOrganizerAttendees(sampleBookings, "ALL", "", null, "ALL", "REGISTERED");
      // b-3 (PAID belum hadir) dan b-4 (CANCELLED belum hadir)
      expect(filtered).toHaveLength(2);
      expect(filtered.map((b) => b.id)).toEqual(["b-3", "b-4"]);
    });

    it("menghitung statistik check-in akurat (checkedInCount vs remainingCount)", () => {
      const stats = calculateCheckInStats(sampleBookings.filter((b) => b.paymentStatus === "PAID"));
      // 3 pesanan lunas: b-1 (1 tiket), b-2 (2 tiket), b-3 (1 tiket) = 4 tiket total
      expect(stats.totalTickets).toBe(4);
      expect(stats.checkedInCount).toBe(2);
      expect(stats.remainingCount).toBe(2);
      expect(stats.percentage).toBe(50);
    });
  });

  describe("3. Ekspor Data Peserta dengan Status, Waktu, & Petugas Check-In", () => {
    it("membangun baris ekspor CSV dengan kolom status kehadiran, jam, dan nama petugas", () => {
      const exportBookings: EventTicketOrder[] = [
        createMockTicket({
          id: "exp-1",
          ticketCode: "EVT-EXP-01",
          guestName: "Komang Wisnu",
          eventTitle: "Singaraja Expo",
          ticketCount: 1,
          paymentStatus: "PAID",
          checkInStatus: "CHECKED_IN",
          checkedInQty: 1,
          checkInTime: "2026-12-07T16:45:00+08:00",
          checkedInBy: "Shandy Admin",
        }),
        createMockTicket({
          id: "exp-2",
          ticketCode: "EVT-EXP-02",
          guestName: "Dewi Lestari",
          eventTitle: "Singaraja Expo",
          ticketCount: 2,
          paymentStatus: "PAID",
          checkInStatus: "REGISTERED",
          checkedInQty: 0,
        }),
      ];

      const rows = buildAttendeesExportRows(exportBookings);
      expect(rows).toHaveLength(2);

      // Baris 1: Sudah Hadir
      expect(rows[0][0]).toBe("EVT-EXP-01");
      expect(rows[0][3]).toBe("Komang Wisnu");
      expect(rows[0][7]).toBe("Lunas");
      expect(rows[0][8]).toBe("Hadir");
      expect(rows[0][9]).not.toBe("—"); // Waktu terformat
      expect(rows[0][10]).toBe("Shandy Admin"); // Petugas tercatat

      // Baris 2: Belum Hadir
      expect(rows[1][0]).toBe("EVT-EXP-02");
      expect(rows[1][3]).toBe("Dewi Lestari");
      expect(rows[1][7]).toBe("Lunas");
      expect(rows[1][8]).toBe("Belum hadir");
      expect(rows[1][9]).toBe("—");
      expect(rows[1][10]).toBe("—");
    });
  });

  describe("4. Helper getBookingAttendance & Penanganan Sub-Tiket Acak", () => {
    it("menghitung metrik kehadiran dengan tepat untuk pesanan penuh, sebagian, dan belum hadir", () => {
      // 1. Penuh
      const full = getBookingAttendance({
        ticketCount: 2,
        checkedInQty: 2,
        checkInStatus: "CHECKED_IN",
      });
      expect(full.isCheckedIn).toBe(true);
      expect(full.isPartial).toBe(false);
      expect(full.isUnchecked).toBe(false);
      expect(full.attendanceLabel).toBe("Hadir");
      expect(full.remainingQty).toBe(0);

      // 2. Sebagian
      const partial = getBookingAttendance({
        ticketCount: 3,
        checkedInQty: 1,
        checkInStatus: "PARTIALLY_CHECKED_IN",
      });
      expect(partial.isCheckedIn).toBe(false);
      expect(partial.isPartial).toBe(true);
      expect(partial.isUnchecked).toBe(false);
      expect(partial.attendanceLabel).toBe("Hadir 1/3");
      expect(partial.remainingQty).toBe(2);

      // 3. Belum hadir
      const empty = getBookingAttendance({
        ticketCount: 2,
        checkedInQty: 0,
        checkInStatus: "REGISTERED",
      });
      expect(empty.isCheckedIn).toBe(false);
      expect(empty.isPartial).toBe(false);
      expect(empty.isUnchecked).toBe(true);
      expect(empty.attendanceLabel).toBe("Belum hadir");
      expect(empty.remainingQty).toBe(2);
    });

    it("memastikan check-in sub-tiket acak (misal kursi 2 sebelum kursi 1) teridentifikasi benar", () => {
      const outOfOrderTicket = createMockTicket({
        ticketCount: 3,
        checkedInQty: 1,
        checkedInSeats: [2], // Kursi #2 check-in duluan
        seatCheckInTimes: { "2": "2026-12-07T15:00:00+08:00" },
        seatCheckInBy: { "2": "Petugas Meja 2" },
      });

      const attendance = getBookingAttendance(outOfOrderTicket);
      expect(attendance.checkedInQty).toBe(1);
      expect(attendance.isPartial).toBe(true);
      expect(attendance.attendanceLabel).toBe("Hadir 1/3");

      // Periksa identifikasi kursi individual
      const isSeat1Checked = outOfOrderTicket.checkedInSeats?.includes(1) ?? false;
      const isSeat2Checked = outOfOrderTicket.checkedInSeats?.includes(2) ?? false;
      const isSeat3Checked = outOfOrderTicket.checkedInSeats?.includes(3) ?? false;

      expect(isSeat1Checked).toBe(false);
      expect(isSeat2Checked).toBe(true);
      expect(isSeat3Checked).toBe(false);
    });

    it("memformat waktu WITA dengan aman dan mengembalikan string kosong bila tanggal invalid", () => {
      expect(formatCheckInTimeWita(null)).toBe("");
      expect(formatCheckInTimeWita(undefined)).toBe("");
      expect(formatCheckInTimeWita("not-a-valid-date")).toBe("");
      const formatted = formatCheckInTimeWita("2026-12-07T14:30:00+08:00");
      expect(formatted).toMatch(/\d{2}[:.]\d{2} WITA/i);
    });
  });

  describe("5. QR Sub-Tiket, Ekspor Parsial X/Y, & Snapshot CAS", () => {
    it("menghasilkan payload QR sub-tiket yang terbaca scanner (bukan guestToken hex)", () => {
      const multiTicket = createMockTicket({
        ticketCode: "DAGO-EVT-CUST1",
        ticketCount: 2,
        guestToken: "deadbeef".repeat(6),
      });

      const sub2 = getSubTicketDetails(multiTicket, 2);
      expect(sub2.subTicketCode).toBe("DAGO-EVT-CUST1-02");
      expect(sub2.subPayload).not.toContain(multiTicket.guestToken!);

      const parsed = parseTicketScanCode(sub2.subPayload);
      expect(parsed.cleanCode).toBe("DAGO-EVT-CUST1-02");
      expect(parsed.baseCode).toBe("DAGO-EVT-CUST1");
      expect(parsed.seatNumber).toBe(2);
    });

    it("mengekspor status Hadir Sebagian (X/Y) pada buildAttendeesExportRows", () => {
      const partialBooking = createMockTicket({
        ticketCode: "EVT-PART-01",
        ticketCount: 3,
        checkedInQty: 1,
        checkInStatus: "PARTIALLY_CHECKED_IN",
        checkInTime: "2026-12-07T15:00:00+08:00",
        checkedInBy: "Bagus Staff",
      });

      const rows = buildAttendeesExportRows([partialBooking]);
      expect(rows[0][8]).toBe("Hadir Sebagian (1/3)");
    });

    it("memprioritaskan jam check-in spesifik sub-tiket -02 saat seluruh pemesanan sudah check-in", () => {
      const fullGroup = createMockTicket({
        ticketCount: 2,
        checkInStatus: "CHECKED_IN",
        checkedInQty: 2,
        checkedInSeats: [1, 2],
        checkInTime: "2026-12-07T09:10:00+08:00",
        seatCheckInTimes: {
          "1": "2026-12-07T09:10:00+08:00",
          "2": "2026-12-07T11:45:00+08:00",
        },
      });

      const resSeat2 = validateTicketCheckIn(fullGroup, fullGroup.eventId, 2);
      expect(resSeat2.valid).toBe(false);
      expect(resSeat2.code).toBe("SEAT_ALREADY_USED");
      expect(resSeat2.message).toMatch(/11[:.]45 WITA/i);
    });

    it("memperbarui check-in melalui updateBookingCheckIn dan mencatat jam sub-tiket ke-2 terpisah dari ke-1", async () => {
      const nowIso = new Date(Date.now() - 1800000).toISOString();
      const endIso = new Date(Date.now() + 7200000).toISOString();
      const ev = await createEventSubmission({
        organizerName: "Komunitas S42",
        organizerEmail: "s42-sub@dagocreative.id",
        organizerPhone: "081234567890",
        title: "Event Sub-Tiket S42",
        category: "COMMUNITY",
        description: "Test check-in sub-tiket",
        startDate: nowIso,
        endDate: endIso,
        location: "Dago Hub",
        isPaid: true,
        price: 50000,
        posterUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",
      });
      await updateEventStatus(ev.id, "APPROVED");

      const booking = await createEventBooking({
        eventId: ev.id,
        guestName: "Sari Group",
        guestEmail: "sari.group@example.com",
        guestPhone: "081299001122",
        ticketCount: 2,
        paymentMethod: "CASH",
      });
      await updateBookingPaymentStatus(booking.id, "PAID");

      await updateBookingCheckIn(booking.id, "PARTIALLY_CHECKED_IN", {
        ticketCode: `${booking.ticketCode}-01`,
        seatNumber: 1,
        incrementQty: 1,
        enforceDateWindow: false,
      });

      const seat2Result = await updateBookingCheckIn(booking.id, "CHECKED_IN", {
        ticketCode: `${booking.ticketCode}-02`,
        seatNumber: 2,
        incrementQty: 1,
        enforceDateWindow: false,
      });
      expect(seat2Result.checkInStatus).toBe("CHECKED_IN");
      expect(seat2Result.seatCheckInTimes?.["1"]).toBeDefined();
      expect(seat2Result.seatCheckInTimes?.["2"]).toBeDefined();

      await expect(
        updateBookingCheckIn(booking.id, "CHECKED_IN", {
          ticketCode: `${booking.ticketCode}-02`,
          seatNumber: 2,
          enforceDateWindow: false,
        })
      ).rejects.toThrow(/Tiket #2 .*sudah dipakai, check-in pukul \d{2}[:.]\d{2} WITA/i);
    });

    it("loadBookingsSnapshotFromTxOrDisk membaca updatedAt transaksi secara murni tanpa memutasi status sync sebelum commit", async () => {
      const { getStorageSyncStatus, markStorageSyncSynced } = await import("@/lib/data-storage");
      markStorageSyncSynced("event_bookings.json", new Date("2026-11-25T01:00:00.000Z"));
      const beforeStatus = getStorageSyncStatus("event_bookings.json");
      const txMock = {
        systemSetting: {
          findUnique: async () => ({
            key: "STORAGE_event_bookings.json",
            value: JSON.stringify([]),
            updatedAt: new Date("2026-11-25T03:00:00.000Z"),
          }),
        },
      };
      const snapshot = await loadBookingsSnapshotFromTxOrDisk(txMock);
      expect(snapshot.bookings).toEqual([]);
      expect(snapshot.updatedAt?.toISOString()).toBe("2026-11-25T03:00:00.000Z");
      expect(getStorageSyncStatus("event_bookings.json")).toBe(beforeStatus);
    });
  });
});
