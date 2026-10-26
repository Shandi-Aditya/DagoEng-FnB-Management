import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import {
  createEventSubmission,
  updateEventStatus,
  createEventBooking,
  updateBookingPaymentStatus,
  getOrganizerPortalData,
  organizerCheckInAttendee,
  organizerResubmitEvent,
  resolveVenueCapacity,
} from "../src/lib/events";
import { assertOrganizerAuth } from "../src/lib/server-auth";
import { CommunityEvent, EventTicketOrder } from "../src/types/event";

const DATA_DIR = process.env.DATA_DIR_OVERRIDE || path.join(process.cwd(), "data");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");
const BOOKINGS_FILE = path.join(DATA_DIR, "event_bookings.json");

describe("Community Organizer Portal & Cross-Community Isolation", () => {
  const orgEmailA = `guild-${Date.now()}@dagocreative.id`;
  const orgEmailB = `bandungdev-${Date.now()}@bandungdev.org`;

  let eventA: CommunityEvent;
  let eventB: CommunityEvent;
  let bookingA: EventTicketOrder;
  let originalEventsBackup: string | null = null;
  let originalBookingsBackup: string | null = null;

  beforeAll(async () => {
    if (fs.existsSync(EVENTS_FILE)) originalEventsBackup = fs.readFileSync(EVENTS_FILE, "utf-8");
    if (fs.existsSync(BOOKINGS_FILE)) originalBookingsBackup = fs.readFileSync(BOOKINGS_FILE, "utf-8");

    // 1. Create Event for Organizer A
    const subA = await createEventSubmission({
      organizerName: "Dago Barista Guild",
      organizerEmail: orgEmailA,
      organizerPhone: "081234567811",
      title: `Latte Art Masterclass ${Date.now()}`,
      category: "WORKSHOP",
      description: "Sesi workshop barista dan kompetisi latte art.",
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 90000000).toISOString(),
      location: "Amphitheater Dago Hub",
      isPaid: true,
      price: 50000,
      posterUrl: "https://images.unsplash.com/photo-1511920170033",
    });
    eventA = await updateEventStatus(subA.id, "APPROVED");

    // Book a ticket for Event A
    bookingA = await createEventBooking({
      eventId: eventA.id,
      guestName: "Peserta Barista",
      guestEmail: `barista-fan-${Date.now()}@example.com`,
      guestPhone: "081298765432",
      ticketCount: 2,
    });

    // 2. Create Event for Organizer B
    const subB = await createEventSubmission({
      organizerName: "Bandung Dev Community",
      organizerEmail: orgEmailB,
      organizerPhone: "081234567822",
      title: `Tech Jam Coding Bootcamp ${Date.now()}`,
      category: "TECH",
      description: "Bootcamp coding seharian di Tech Lab.",
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 90000000).toISOString(),
      location: "Tech Lab Dago Hub",
      isPaid: false,
      price: 0,
      posterUrl: "https://images.unsplash.com/photo-1550745165",
    });
    eventB = await updateEventStatus(subB.id, "REVISION_REQUESTED", {
      revisionNotes: "Mohon lengkapi ketentuan membawa laptop pada panduan acara.",
    });
  });

  it("1. harus mengisolasi data antarkomunitas: Komunitas A hanya melihat event dan peserta miliknya", async () => {
    const portalDataA = await getOrganizerPortalData(orgEmailA);

    expect(portalDataA.events.length).toBeGreaterThanOrEqual(1);
    expect(portalDataA.events.some((e) => e.id === eventA.id)).toBe(true);
    // Crucial isolation check: Event B must NOT appear in Portal A!
    expect(portalDataA.events.some((e) => e.id === eventB.id)).toBe(false);

    // Bookings check: Booking A is visible in Portal A
    expect(portalDataA.bookings.some((b) => b.id === bookingA.id)).toBe(true);
  });

  it("2. harus mengisolasi data antarkomunitas: Komunitas B tidak dapat melihat event milik Komunitas A", async () => {
    const portalDataB = await getOrganizerPortalData(orgEmailB);

    expect(portalDataB.events.some((e) => e.id === eventB.id)).toBe(true);
    // Event A must NOT appear in Portal B
    expect(portalDataB.events.some((e) => e.id === eventA.id)).toBe(false);
    // Booking A must NOT appear in Portal B
    expect(portalDataB.bookings.some((b) => b.id === bookingA.id)).toBe(false);
  });

  it("3. Penyelenggara A DITOLAK saat check-in tiket berbayar yang belum diverifikasi (PENDING)", async () => {
    // bookingA adalah tiket berbayar (Rp 50.000) dan masih berstatus PENDING
    await expect(
      organizerCheckInAttendee(orgEmailA, bookingA.id, "CHECKED_IN")
    ).rejects.toThrow("Tiket berbayar belum diverifikasi lunas (status pembayaran masih PENDING). Silakan verifikasi pembayaran terlebih dahulu sebelum check-in.");
  });

  it("3b. Penyelenggara A dapat menandai hadir peserta setelah pembayaran diverifikasi lunas", async () => {
    // Verifikasi pembayaran lunas
    await updateBookingPaymentStatus(bookingA.id, "PAID");

    const checkedIn = await organizerCheckInAttendee(
      orgEmailA,
      bookingA.id,
      "CHECKED_IN"
    );

    expect(checkedIn.checkInStatus).toBe("CHECKED_IN");
    expect(checkedIn.checkInTime).toBeDefined();

    // Tolak check-in berulang (T-1)
    await expect(
      organizerCheckInAttendee(orgEmailA, bookingA.id, "CHECKED_IN")
    ).rejects.toThrow("Tiket sudah digunakan untuk check-in sebelumnya");
  });

  it("4. NEGATIVE TEST: Penyelenggara B DITOLAK saat mencoba check-in peserta milik Komunitas A", async () => {
    await expect(
      organizerCheckInAttendee(orgEmailB, bookingA.id, "CHECKED_IN")
    ).rejects.toThrow("FORBIDDEN: Anda tidak memiliki izin untuk mengelola peserta event milik komunitas lain.");
  });

  it("5. Penyelenggara B dapat memperbaiki dan mengajukan ulang event yang berstatus REVISION_REQUESTED", async () => {
    const resubmitted = await organizerResubmitEvent(orgEmailB, eventB.id, {
      title: `${eventB.title} (Revisi)`,
      description: "Deskripsi yang sudah diperbaiki dengan rincian bawa laptop.",
    });

    expect(resubmitted.id).toBe(eventB.id);
    expect(resubmitted.status).toBe("PENDING"); // Re-entered curator moderation queue
    expect(resubmitted.revisionNotes).toBeNull();
  });

  it("6. NEGATIVE TEST: Penyelenggara A DITOLAK saat mencoba merevisi event milik Komunitas B", async () => {
    await expect(
      organizerResubmitEvent(orgEmailA, eventB.id, {
        title: "Ilegal Title Change Attempt",
      })
    ).rejects.toThrow("FORBIDDEN: Anda tidak memiliki izin untuk mengubah event milik komunitas lain.");
  });

  it("7. harus memverifikasi formula hak bagi hasil 80% pada ringkasan portal komunitas", async () => {
    const portalDataA = await getOrganizerPortalData(orgEmailA);
    const summary = portalDataA.summary;

    expect(summary.organizerEmail).toBe(orgEmailA.toLowerCase());
    expect(summary.grossRevenue).toBe(summary.platformFeeAmount + summary.organizerPayoutAmount);
  });

  describe("API Authentication & Cross-Community Authorization Enforcement", () => {
    it("8. NEGATIVE TEST: Request anonim ditolak dengan status UNAUTHORIZED (401)", async () => {
      const anonymousReq = new NextRequest("http://localhost:3000/api/events/portal?email=baristaguild@dagocreative.id");
      const auth = await assertOrganizerAuth(anonymousReq, "baristaguild@dagocreative.id");

      expect(auth.authorized).toBe(false);
      expect(auth.error).toContain("UNAUTHORIZED");
      expect(auth.email).toBeNull();
    });

    it("9. NEGATIVE TEST: Header role/id palsu (spoofed headers) tidak dipercaya dan tetap ditolak", async () => {
      const spoofedReq = new NextRequest("http://localhost:3000/api/events/portal?email=baristaguild@dagocreative.id", {
        headers: {
          "x-user-role": "SUPER_ADMIN",
          "x-user-id": "hacker-user-id",
          "x-user-scope": "PLATFORM",
        },
      });
      const auth = await assertOrganizerAuth(spoofedReq, "baristaguild@dagocreative.id");

      expect(auth.authorized).toBe(false);
      expect(auth.error).toContain("UNAUTHORIZED");
    });

    it("10. NEGATIVE TEST: Komunitas Barista DITOLAK saat mencoba mengakses data Bandung Dev (IDOR Prevention - 403)", async () => {
      const baristaReq = new NextRequest("http://localhost:3000/api/events/portal?email=halo@bandungdev.org", {
        headers: {
          cookie: "dagoeng_active_persona=COMMUNITY_BARISTA",
        },
      });
      const auth = await assertOrganizerAuth(baristaReq, "halo@bandungdev.org");

      expect(auth.authorized).toBe(false);
      expect(auth.error).toContain("FORBIDDEN: Pelanggaran isolasi data");
      expect(auth.error).toContain("baristaguild@dagocreative.id");
    });

    it("11. Sesi terverifikasi Komunitas Barista berhasil mengakses datanya sendiri", async () => {
      const baristaReq = new NextRequest("http://localhost:3000/api/events/portal?email=baristaguild@dagocreative.id", {
        headers: {
          cookie: "dagoeng_active_persona=COMMUNITY_BARISTA",
        },
      });
      const auth = await assertOrganizerAuth(baristaReq, "baristaguild@dagocreative.id");

      expect(auth.authorized).toBe(true);
      expect(auth.email).toBe("baristaguild@dagocreative.id");
      expect(auth.isAdmin).toBe(false);
    });

    it("12. Admin Hub Dago (DAGO_OWNER) memiliki otorisasi supervisi untuk meninjau event komunitas manapun", async () => {
      const hubAdminReq = new NextRequest("http://localhost:3000/api/events/portal?email=halo@bandungdev.org", {
        headers: {
          cookie: "dagoeng_active_persona=DAGO_OWNER",
        },
      });
      const auth = await assertOrganizerAuth(hubAdminReq, "halo@bandungdev.org");

      expect(auth.authorized).toBe(true);
      expect(auth.isAdmin).toBe(true);
      expect(auth.email).toBe("halo@bandungdev.org");
    });
  });

  describe("Venue Capacity Audit & Source Verification", () => {
    it("13. Venue terdaftar di master Coworking (Boardroom Ubud) terverifikasi resmi (COWORKING_FACILITY_SPEC)", () => {
      const spec = resolveVenueCapacity("Boardroom Ubud");
      expect(spec.isConfirmed).toBe(true);
      expect(spec.sourceType).toBe("COWORKING_FACILITY_SPEC");
      expect(spec.capacity).toBe(12);
    });

    it("14. Ruang tanpa master spesifikasi (Amphitheater) ditandai sebagai estimasi belum dikonfirmasi (UNCONFIRMED_ESTIMATE)", () => {
      const spec = resolveVenueCapacity("Amphitheater Dago Hub");
      expect(spec.isConfirmed).toBe(false);
      expect(spec.sourceType).toBe("UNCONFIRMED_ESTIMATE");
      expect(spec.sourceDescription).toContain("belum dikonfirmasi");
    });

    it("15. Kapasitas yang ditentukan eksplisit oleh penyelenggara ditandai sebagai ORGANIZER_SPECIFIED", () => {
      const spec = resolveVenueCapacity("Workshop Area", 35);
      expect(spec.isConfirmed).toBe(true);
      expect(spec.sourceType).toBe("ORGANIZER_SPECIFIED");
      expect(spec.capacity).toBe(35);
    });
  });

  afterAll(() => {
    if (originalEventsBackup !== null) {
      fs.writeFileSync(EVENTS_FILE, originalEventsBackup, "utf-8");
    }
    if (originalBookingsBackup !== null) {
      fs.writeFileSync(BOOKINGS_FILE, originalBookingsBackup, "utf-8");
    }
  });
});
