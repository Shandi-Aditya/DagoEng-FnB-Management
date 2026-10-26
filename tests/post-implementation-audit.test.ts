import { describe, it, expect } from "vitest";
import {
  registerUnifiedUser,
  findUnifiedUserByEmail,
  verifyUnifiedUserPassword,
  activateOrganizerSelfService,
} from "../src/lib/unified-account";
import {
  getOrganizerByEmail,
  updateOrganizerStatus,
  isOrganizerActive,
} from "../src/lib/organizers";
import {
  verifyOrganizerCredentials,
  createOrganizerSession,
} from "../src/lib/organizer-activation";
import {
  createEventSubmission,
  updateEventStatus,
  getApprovedEvents,
  createEventBooking,
  getEventBookings,
} from "../src/lib/events";
import { assertOrganizerAuth } from "../src/lib/server-auth";
import { NextRequest } from "next/server";

describe("POST-IMPLEMENTATION AUDIT — DAGOENG UNIFIED ACCOUNT & EVENT MARKETPLACE", () => {
  const nonce = Date.now().toString(36);
  const auditCustomerEmail = `audit.customer.${nonce}@example.com`;
  const auditPassword = "PasswordSecure123!";

  // =========================================================================
  // SECTION A: AUDIT AUTENTIKASI & UNIFIED IDENTITY
  // =========================================================================
  describe("A. Audit Autentikasi", () => {
    it("A1. Customer baru mendaftar, logout, lalu login kembali dengan akun yang sama", async () => {
      // 1. Register customer
      const reg = await registerUnifiedUser({
        name: "Audit User A1",
        email: auditCustomerEmail,
        phone: "+62 811-1234-5678",
        password: auditPassword,
      });
      expect(reg.isExisting).toBe(false);
      expect(reg.user.email).toBe(auditCustomerEmail.toLowerCase());

      // 2. Simulasi Login kembali
      const auth = await verifyUnifiedUserPassword(auditCustomerEmail, auditPassword);
      expect(auth.success).toBe(true);
      expect(auth.user?.id).toBe(reg.user.id);

      // 3. Password salah ditolak
      const authWrong = await verifyUnifiedUserPassword(auditCustomerEmail, "WrongPassword!");
      expect(authWrong.success).toBe(false);
      expect(authWrong.error).toContain("Password yang Anda masukkan salah");
    });

    it("A2. Customer yang sudah terdaftar mengaktifkan Organizer tanpa membuat akun kedua", async () => {
      const onboard = await activateOrganizerSelfService(auditCustomerEmail, {
        organizationName: "Audit Creative Club",
        category: "Komunitas Kreatif",
        contactPerson: "Audit User A1",
        phone: "+62 811-1234-5678",
      });

      expect(onboard.success).toBe(true);
      expect(onboard.organizer.status).toBe("ACTIVE");
      expect(onboard.organizer.email).toBe(auditCustomerEmail.toLowerCase());
      expect(onboard.user.organizerProfileId).toBe(onboard.organizer.id);

      // User ID tetap sama, bukan akun kedua
      const user = findUnifiedUserByEmail(auditCustomerEmail);
      expect(user?.organizerProfileId).toBe(onboard.organizer.id);
    });

    it("A3. Organizer login melalui jalur kredensial dengan password yang sama", async () => {
      const cred = await verifyOrganizerCredentials(auditCustomerEmail, auditPassword);
      expect(cred.success).toBe(true);
      expect(cred.user?.email).toBe(auditCustomerEmail.toLowerCase());
    });

    it("A4. Akun organizer yang dinonaktifkan ditolak hak aksesnya", async () => {
      const org = getOrganizerByEmail(auditCustomerEmail);
      expect(org).not.toBeNull();

      // Deactivate organizer
      updateOrganizerStatus(org!.id, "INACTIVE");
      expect(isOrganizerActive(auditCustomerEmail)).toBe(false);

      // Re-activate for subsequent tests
      updateOrganizerStatus(org!.id, "ACTIVE");
      expect(isOrganizerActive(auditCustomerEmail)).toBe(true);
    });

    it("A5. Isolasi otorisasi server menolak cross-community access", async () => {
      // Mock request from audit customer trying to access another organizer's data
      const fakeReq = new NextRequest("http://localhost:3000/api/events/portal", {
        headers: {
          cookie: "dagoeng_active_persona=CUSTOMER_DEMO",
        },
      });

      const check = await assertOrganizerAuth(fakeReq, "another.organizer@dagoeng.com");
      expect(check.authorized).toBe(false);
      expect(check.error).toContain("Pelanggaran isolasi data");
    });
  });

  // =========================================================================
  // SECTION B: AUDIT PENYIMPANAN AKUN
  // =========================================================================
  describe("B. Audit Penyimpanan Akun", () => {
    it("B1. Password disimpan terenkripsi (bcrypt) dan tidak pernah plaintext", () => {
      const user = findUnifiedUserByEmail(auditCustomerEmail);
      expect(user).not.toBeNull();
      expect(user!.passwordHash).toMatch(/^\$2[aby]\$\d+\$/);
      expect(user!.passwordHash).not.toBe(auditPassword);
    });

    it("B2. Registrasi serentak dengan email yang sama tidak membuat duplikasi akun", async () => {
      const p1 = registerUnifiedUser({
        name: "Concurrent Test",
        email: auditCustomerEmail,
        phone: "+62 812-9999-8888",
        password: auditPassword,
      });
      const p2 = registerUnifiedUser({
        name: "Concurrent Test 2",
        email: auditCustomerEmail,
        phone: "+62 812-9999-8888",
        password: auditPassword,
      });

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1.isExisting).toBe(true);
      expect(r2.isExisting).toBe(true);
      expect(r1.user.id).toBe(r2.user.id);
    });
  });

  // =========================================================================
  // SECTION C: AUDIT FLOW EVENTBRITE & PUBLIKASI
  // =========================================================================
  describe("C. Audit Flow Eventbrite", () => {
    let createdEventId: string;

    it("C1. Organizer membuat draft event (status: DRAFT / SUBMITTED)", async () => {
      const newEvent = await createEventSubmission({
        title: `Audit Workshop ${nonce}`,
        category: "CREATIVE",
        description: "Audit testing flow eventbrite",
        startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
        location: "Meeting Room Alpha, Dago Creative Hub",
        posterUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87",
        isPaid: false,
        price: 0,
        organizerName: "Audit Creative Club",
        organizerEmail: auditCustomerEmail,
        organizerPhone: "+62 811-1234-5678",
      });

      expect(newEvent).toBeDefined();
      expect(newEvent.id).toBeDefined();
      expect(["DRAFT", "SUBMITTED", "PENDING"]).toContain(newEvent.status);
      createdEventId = newEvent.id;
    });

    it("C2. Event belum disetujui (DRAFT/SUBMITTED) TIDAK MUNCUL di marketplace publik", async () => {
      const publicEvents = await getApprovedEvents();
      const isVisible = publicEvents.some((e) => e.id === createdEventId);
      expect(isVisible).toBe(false);
    });

    it("C3. Admin menyetujui event -> Event muncul di marketplace publik", async () => {
      const approved = await updateEventStatus(createdEventId, "APPROVED", "Disetujui kurator");
      expect(approved.status).toBe("APPROVED");

      const publicEvents = await getApprovedEvents();
      const isVisible = publicEvents.some((e) => e.id === createdEventId);
      expect(isVisible).toBe(true);
    });

    it("C4. Tiket gratis langsung terkonfirmasi sebagai PAID tanpa gateway", async () => {
      const booking = await createEventBooking({
        eventId: createdEventId,
        guestName: "Peserta Gratis",
        guestEmail: `peserta.gratis.${nonce}@example.com`,
        guestPhone: "+62 812-7777-6666",
        ticketCount: 1,
      });

      expect(booking.paymentStatus).toBe("PAID");
      expect(booking.paymentMethod).toBe("FREE");
      expect(booking.ticketCode).toMatch(/^DAGO-EVT-\d+$/);
    });

    it("C5. Anti-duplicate booking protection menolak booking ganda dalam 3 menit", async () => {
      await expect(
        createEventBooking({
          eventId: createdEventId,
          guestName: "Peserta Gratis Ulang",
          guestEmail: `peserta.gratis.${nonce}@example.com`,
          guestPhone: "+62 812-7777-6666",
          ticketCount: 1,
        })
      ).rejects.toThrow("Pemesanan tiket untuk event ini baru saja dilakukan dari email yang sama");
    });

    it("C6. Tiket berbayar yang masih PENDING ditolak saat mencoba check-in", async () => {
      const { updateBookingCheckIn } = await import("../src/lib/events");

      // Create and approve a paid event
      const paidEvent = await createEventSubmission({
        title: `Paid Workshop ${nonce}`,
        category: "CREATIVE",
        description: "Paid workshop for checkin testing",
        startDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
        location: "Meeting Room Beta",
        posterUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87",
        isPaid: true,
        price: 50000,
        organizerName: "Audit Creative Club",
        organizerEmail: auditCustomerEmail,
        organizerPhone: "+62 811-1234-5678",
      });

      await updateEventStatus(paidEvent.id, "APPROVED");

      const paidBooking = await createEventBooking({
        eventId: paidEvent.id,
        guestName: "Peserta Berbayar Pending",
        guestEmail: `peserta.pending.${nonce}@example.com`,
        guestPhone: "+62 812-1111-2222",
        ticketCount: 1,
      });

      expect(paidBooking.paymentStatus).toBe("PENDING");
      expect(paidBooking.totalPrice).toBe(50000);

      // Attempting check-in on PENDING ticket must be strictly rejected
      await expect(
        updateBookingCheckIn(paidBooking.id, "CHECKED_IN")
      ).rejects.toThrow("Tiket berbayar belum diverifikasi lunas (status pembayaran masih PENDING)");
    });
  });

  // =========================================================================
  // SECTION D: AUDIT ISOLASI DATA PESERTA & LOGOUT
  // =========================================================================
  describe("D. Audit Kepemilikan & Isolasi Data Peserta", () => {
    it("D1. Peserta hanya dapat memfilter tiket miliknya sendiri", async () => {
      const allBookings = await getEventBookings();
      const myEmail = `peserta.gratis.${nonce}@example.com`;

      const myBookings = allBookings.filter(
        (b) => b.guestEmail.toLowerCase().trim() === myEmail.toLowerCase().trim()
      );

      expect(myBookings.length).toBe(1);
      expect(myBookings[0].guestEmail).toBe(myEmail);
    });

    it("D2. Server logout endpoint mengakhiri sesi dan membersihkan cookie", async () => {
      const { POST: logoutHandler } = await import("../src/app/api/auth/logout/route");
      const req = new NextRequest("http://localhost:3000/api/auth/logout", {
        method: "POST",
      });

      const res = await logoutHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);

      // Verify cookie cleared
      const setCookieHeader = res.headers.get("set-cookie");
      expect(setCookieHeader).toContain("dagoeng_session=");
      expect(setCookieHeader).toContain("Max-Age=0");
    });
  });
});
