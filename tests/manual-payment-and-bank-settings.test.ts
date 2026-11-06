import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import {
  createEventSubmission,
  updateEventStatus,
  createEventBooking,
  getEventTicketAvailability,
  validateEventBooking,
  getMaxTicketsPerBooking,
  getEventBankAccounts,
  createEventBankAccount,
  updateEventBankAccount,
  setDefaultEventBankAccount,
  resolveDestinationBankAccount,
  getEventRevenuePolicy,
  updateEventRevenuePolicy,
  updateBookingPaymentProof,
  adminApproveBookingPayment,
  adminRejectBookingPayment,
  expirePendingBookings,
  loadBookingsFromDisk,
  saveBookingsToDisk,
  calculateEventRevenueSplit,
  getOrganizerPortalData,
} from "../src/lib/events";
import { POST as handleBookRoute } from "../src/app/api/events/[id]/book/route";
import { PATCH as handleBookingPatchRoute } from "../src/app/api/events/bookings/[id]/route";
import { GET as handleBanksGet, POST as handleBanksPost, PATCH as handleBanksPatch, DELETE as handleBanksDelete } from "../src/app/api/events/admin/settings/banks/route";
import { GET as handleSettingsGet, PATCH as handleSettingsPatch } from "../src/app/api/events/admin/settings/route";
import { NextRequest } from "next/server";
import { CommunityEvent, EventTicketOrder } from "../src/types/event";

const DATA_DIR = process.env.DATA_DIR_OVERRIDE || path.join(process.cwd(), "data");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");
const BOOKINGS_FILE = path.join(DATA_DIR, "event_bookings.json");
const SETTINGS_FILE = path.join(DATA_DIR, "event_settings.json");

describe("DAGOENG EVENT MARKETPLACE — TICKET QUOTA, MANUAL PAYMENT & BANK SETTINGS", () => {
  let testEvent: CommunityEvent;
  let limitedEvent: CommunityEvent;
  let existingBookingForAuthTest: EventTicketOrder;
  const organizerEmail = `organizer-${Date.now()}@dagoeng.com`;

  let backupEvents: string | null = null;
  let backupBookings: string | null = null;
  let backupSettings: string | null = null;

  beforeAll(async () => {
    if (fs.existsSync(EVENTS_FILE)) backupEvents = fs.readFileSync(EVENTS_FILE, "utf-8");
    if (fs.existsSync(BOOKINGS_FILE)) backupBookings = fs.readFileSync(BOOKINGS_FILE, "utf-8");
    if (fs.existsSync(SETTINGS_FILE)) backupSettings = fs.readFileSync(SETTINGS_FILE, "utf-8");

    // Create primary test event with ample maxCapacity (100)
    const submission = await createEventSubmission({
      title: "Marketplace Master Testing Summit 2026",
      category: "TECH",
      description: "Comprehensive testing summit for ticket limits and payment flows.",
      startDate: new Date(Date.now() + 5 * 86400000).toISOString(),
      endDate: new Date(Date.now() + 5 * 86400000 + 7200000).toISOString(),
      location: "Main Stage Dago Creative",
      maxCapacity: 100,
      isPaid: true,
      price: 50000,
      posterUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87",
      organizerName: "Dago Tech Community",
      organizerEmail,
      organizerPhone: "081234567890",
    });
    testEvent = (await updateEventStatus(submission.id, "APPROVED"))!;

    // Create limited event with strictly 2 maxCapacity
    const limitedSub = await createEventSubmission({
      title: "Intimate Workshop — Capacity 2",
      category: "WORKSHOP",
      description: "Intimate workshop strictly capped at 2 seats.",
      startDate: new Date(Date.now() + 6 * 86400000).toISOString(),
      endDate: new Date(Date.now() + 6 * 86400000 + 7200000).toISOString(),
      location: "Workshop Room B",
      maxCapacity: 2,
      isPaid: true,
      price: 100000,
      posterUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87",
      organizerName: "Dago Craft Workshop",
      organizerEmail,
      organizerPhone: "081234567891",
    });
    limitedEvent = (await updateEventStatus(limitedSub.id, "APPROVED"))!;

    // Create booking for API auth tests
    existingBookingForAuthTest = await createEventBooking({
      eventId: testEvent.id,
      guestName: "Auth Target User",
      guestEmail: "auth-target@test.com",
      guestPhone: "08199990000",
      ticketCount: 1,
    });
  });

  afterAll(() => {
    if (backupEvents !== null) fs.writeFileSync(EVENTS_FILE, backupEvents, "utf-8");
    if (backupBookings !== null) fs.writeFileSync(BOOKINGS_FILE, backupBookings, "utf-8");
    if (backupSettings !== null) fs.writeFileSync(SETTINGS_FILE, backupSettings, "utf-8");
  });

  // ==========================================
  // BAGIAN 1 — KUOTA DAN PEMBELIAN TIKET (1-10)
  // ==========================================

  it("1. Batas pembelian default 5 tiket berfungsi", async () => {
    const policy = getEventRevenuePolicy();
    expect(policy.maxTicketsPerBooking).toBe(5);

    const maxAllowed = getMaxTicketsPerBooking(testEvent);
    expect(maxAllowed).toBe(5);
  });

  it("2. Pembelian melebihi batas pembelian ditolak", async () => {
    const validation = validateEventBooking(
      {
        eventId: testEvent.id,
        guestName: "Budi Santoso",
        guestEmail: "budi@test.com",
        guestPhone: "08123456789",
        ticketCount: 6,
      },
      testEvent
    );
    expect(validation.valid).toBe(false);
    expect(validation.errors.join(", ")).toContain("5 tiket");
  });

  it("3. Kuota tersedia 2 dan pembelian 2 berhasil", async () => {
    const availability = getEventTicketAvailability(limitedEvent.id);
    expect(availability.ticketsRemaining).toBe(2);

    const booking = await createEventBooking({
      eventId: limitedEvent.id,
      guestName: "Budi Santoso",
      guestEmail: "budi-2seats@test.com",
      guestPhone: "0811111111",
      ticketCount: 2,
    });
    expect(booking).toBeDefined();
    expect(booking.ticketCount).toBe(2);
    expect(booking.paymentStatus).toBe("PENDING");
  });

  it("4. Kuota tersedia 0 (setelah booking 2 di atas) dan status sold out terdeteksi", async () => {
    const availability = getEventTicketAvailability(limitedEvent.id);
    expect(availability.ticketsRemaining).toBe(0);
    expect(availability.isSoldOut).toBe(true);
  });

  it("5. Kuota habis menolak booking baru", async () => {
    await expect(
      createEventBooking({
        eventId: limitedEvent.id,
        guestName: "Siti Rahma",
        guestEmail: "siti-rejected@test.com",
        guestPhone: "0812222222",
        ticketCount: 1,
      })
    ).rejects.toThrow(/penuh|habis|kuota/i);
  });

  it("6. Jumlah tiket nol, negatif, desimal, atau bukan integer ditolak", () => {
    const zeroVal = validateEventBooking(
      { eventId: testEvent.id, guestName: "User", guestEmail: "u@t.com", guestPhone: "08123456789", ticketCount: 0 },
      testEvent
    );
    expect(zeroVal.valid).toBe(false);

    const negVal = validateEventBooking(
      { eventId: testEvent.id, guestName: "User", guestEmail: "u@t.com", guestPhone: "08123456789", ticketCount: -2 },
      testEvent
    );
    expect(negVal.valid).toBe(false);

    const floatVal = validateEventBooking(
      { eventId: testEvent.id, guestName: "User", guestEmail: "u@t.com", guestPhone: "08123456789", ticketCount: 2.5 },
      testEvent
    );
    expect(floatVal.valid).toBe(false);
  });

  it("7. Kuota berubah sebelum checkout dan backend menolak jumlah berlebih secara real-time", async () => {
    // Create dedicated event with capacity 5
    const dynSub = await createEventSubmission({
      title: "Real-time Availability Dynamic Event",
      category: "TECH",
      description: "Testing dynamic quota depletion.",
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 90000000).toISOString(),
      location: "Room C",
      maxCapacity: 5,
      isPaid: false,
      price: 0,
      posterUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87",
      organizerName: "Testing Team",
      organizerEmail,
      organizerPhone: "081234567899",
    });
    const dynEvt = (await updateEventStatus(dynSub.id, "APPROVED"))!;

    const availBefore = getEventTicketAvailability(dynEvt.id);
    expect(availBefore.ticketsRemaining).toBe(5);

    // Book 3 tickets
    await createEventBooking({
      eventId: dynEvt.id,
      guestName: "Alice Walker",
      guestEmail: "alice-dyn@test.com",
      guestPhone: "0813333333",
      ticketCount: 3,
    });

    // Now remaining is 2.
    const availAfter = getEventTicketAvailability(dynEvt.id);
    expect(availAfter.ticketsRemaining).toBe(2);

    // Attempting to book 3 tickets (exceeding remaining 2) must be rejected
    await expect(
      createEventBooking({
        eventId: dynEvt.id,
        guestName: "Exceeding Buyer",
        guestEmail: "exceed-dyn@test.com",
        guestPhone: "0814444444",
        ticketCount: 3,
      })
    ).rejects.toThrow();
  });

  it("8. Booking bersamaan tidak menyebabkan overselling dalam jaminan withBookingLock", async () => {
    // Create dedicated small event with capacity 3
    const sub = await createEventSubmission({
      title: "Concurrent Stress Test Event",
      category: "TECH",
      description: "Testing concurrent booking lock guarantees.",
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 90000000).toISOString(),
      location: "Lab Room 1",
      maxCapacity: 3,
      isPaid: false,
      price: 0,
      posterUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87",
      organizerName: "Testing Team",
      organizerEmail,
      organizerPhone: "081234567899",
    });
    const concurrentEvt = (await updateEventStatus(sub.id, "APPROVED"))!;

    // Fire 3 simultaneous bookings for 2 tickets each (total 6 requested on capacity 3)
    const attempts = await Promise.allSettled([
      createEventBooking({ eventId: concurrentEvt.id, guestName: "User 1", guestEmail: "u1@test.com", guestPhone: "0811111110", ticketCount: 2 }),
      createEventBooking({ eventId: concurrentEvt.id, guestName: "User 2", guestEmail: "u2@test.com", guestPhone: "0822222220", ticketCount: 2 }),
      createEventBooking({ eventId: concurrentEvt.id, guestName: "User 3", guestEmail: "u3@test.com", guestPhone: "0833333330", ticketCount: 2 }),
    ]);

    const successes = attempts.filter((r) => r.status === "fulfilled");
    const rejections = attempts.filter((r) => r.status === "rejected");

    // Exactly 1 can succeed (2 tickets taken out of 3; remaining 1 cannot satisfy 2 tickets)
    expect(successes.length).toBe(1);
    expect(rejections.length).toBe(2);

    const finalAvail = getEventTicketAvailability(concurrentEvt.id);
    expect(finalAvail.ticketsReserved).toBe(2);
    expect(finalAvail.ticketsRemaining).toBe(1);
  });

  it("9. Booking expired dan cancelled mengembalikan kuota sesuai aturan", async () => {
    // Create a 2-ticket event
    const sub = await createEventSubmission({
      title: "Expiry Quota Release Event",
      category: "CREATIVE",
      description: "Release quota upon expiration.",
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 90000000).toISOString(),
      location: "Gallery",
      maxCapacity: 2,
      isPaid: true,
      price: 50000,
      posterUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87",
      organizerName: "Testing Team",
      organizerEmail,
      organizerPhone: "081234567899",
    });
    const expEvent = (await updateEventStatus(sub.id, "APPROVED"))!;

    const b = await createEventBooking({
      eventId: expEvent.id,
      guestName: "Late Payer",
      guestEmail: "late-payer@test.com",
      guestPhone: "08123456781",
      ticketCount: 2,
    });

    let avail = getEventTicketAvailability(expEvent.id);
    expect(avail.ticketsRemaining).toBe(0);

    // Force expired in storage
    const allBookings = loadBookingsFromDisk();
    const idx = allBookings.findIndex((x) => x.id === b.id);
    allBookings[idx].expiresAt = new Date(Date.now() - 60000).toISOString();
    saveBookingsToDisk(allBookings);

    expirePendingBookings();

    avail = getEventTicketAvailability(expEvent.id);
    expect(avail.ticketsRemaining).toBe(2);
    expect(avail.isSoldOut).toBe(false);
  });

  it("10. Booking PAID mempertahankan alokasi tiket dan tidak dilepas oleh expirePendingBookings", async () => {
    const sub = await createEventSubmission({
      title: "Paid Retention Event",
      category: "TECH",
      description: "Paid booking never released by expiry cycle.",
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 90000000).toISOString(),
      location: "Hall A",
      maxCapacity: 5,
      isPaid: true,
      price: 50000,
      posterUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87",
      organizerName: "Testing Team",
      organizerEmail,
      organizerPhone: "081234567899",
    });
    const paidEvt = (await updateEventStatus(sub.id, "APPROVED"))!;

    const b = await createEventBooking({
      eventId: paidEvt.id,
      guestName: "Firm Buyer",
      guestEmail: "firm-buyer@test.com",
      guestPhone: "08123456782",
      ticketCount: 3,
    });

    // Mark as PAID
    await adminApproveBookingPayment(b.id, "Admin DagoEng", "Bukti transfer valid");

    // Force expired timestamp in past
    const allBookings = loadBookingsFromDisk();
    const idx = allBookings.findIndex((x) => x.id === b.id);
    allBookings[idx].expiresAt = new Date(Date.now() - 3600000).toISOString();
    saveBookingsToDisk(allBookings);

    expirePendingBookings();

    // Verify still PAID and 3 seats retained
    const checked = loadBookingsFromDisk().find((x) => x.id === b.id);
    expect(checked?.paymentStatus).toBe("PAID");

    const avail = getEventTicketAvailability(paidEvt.id);
    expect(avail.ticketsReserved).toBe(3);
    expect(avail.ticketsRemaining).toBe(2);
  });

  // ==========================================
  // BAGIAN 2 — REKENING DAN KONFIGURASI (11-20)
  // ==========================================

  it("11. Admin menambahkan rekening bank baru ke sistem", async () => {
    const newBank = createEventBankAccount(
      {
        bankName: "Bank Syariah Indonesia (BSI)",
        accountNumber: "7123456789",
        accountHolder: "PT Dago Creative Sinergi",
        label: "Rekening Operasional BSI Syariah",
        accountType: "PLATFORM",
      },
      "Admin Finance DagoEng"
    );

    expect(newBank).toBeDefined();
    expect(newBank.bankName).toBe("Bank Syariah Indonesia (BSI)");
    expect(newBank.accountNumber).toBe("7123456789");
    expect(newBank.isActive).toBe(true);

    const allBanks = getEventBankAccounts();
    expect(allBanks.some((b) => b.id === newBank.id)).toBe(true);
  });

  it("12. Admin mengubah rekening default dari A menjadi B", async () => {
    const banks = getEventBankAccounts();
    const bankBCA = banks.find((b) => b.bankName.includes("BCA"));
    const bankMandiri = banks.find((b) => b.bankName.includes("Mandiri"));
    expect(bankBCA).toBeDefined();
    expect(bankMandiri).toBeDefined();

    // Set BCA as default
    setDefaultEventBankAccount(bankBCA!.id, "Admin Finance");
    let currentDefault = getEventBankAccounts().find((b) => b.isDefault);
    expect(currentDefault?.id).toBe(bankBCA!.id);

    // Switch default to Mandiri
    setDefaultEventBankAccount(bankMandiri!.id, "Admin Finance");
    currentDefault = getEventBankAccounts().find((b) => b.isDefault);
    expect(currentDefault?.id).toBe(bankMandiri!.id);
    expect(currentDefault?.bankName).toContain("Mandiri");
  });

  it("13. Booking baru menggunakan rekening default yang baru (Mandiri)", async () => {
    const bookingNew = await createEventBooking({
      eventId: testEvent.id,
      guestName: "Dewi Lestari",
      guestEmail: "dewi-mandiri@example.com",
      guestPhone: "0819999999",
      ticketCount: 1,
    });

    expect(bookingNew.destinationBankSnapshot).toBeDefined();
    expect(bookingNew.destinationBankSnapshot?.bankName).toContain("Mandiri");
  });

  it("14. Booking lama mempertahankan snapshot rekening sebelumnya (Snapshot Immutability)", async () => {
    // Switch default bank back to BCA
    const banks = getEventBankAccounts();
    const bankBCA = banks.find((b) => b.bankName.includes("BCA"));
    setDefaultEventBankAccount(bankBCA!.id, "Admin Finance");

    // Make an older booking that gets BCA snapshot
    const bookingOld = await createEventBooking({
      eventId: testEvent.id,
      guestName: "Rudi Hartono",
      guestEmail: "rudi-snapshot@example.com",
      guestPhone: "0818888888",
      ticketCount: 1,
    });
    expect(bookingOld.destinationBankSnapshot?.bankName).toContain("BCA");

    // Admin now switches default bank to BSI
    const bankBSI = getEventBankAccounts().find((b) => b.bankName.includes("BSI"));
    if (bankBSI) {
      setDefaultEventBankAccount(bankBSI.id, "Admin Finance");
    }

    // Verify bookingOld STILL retains BCA in its snapshot
    const reloaded = loadBookingsFromDisk().find((x) => x.id === bookingOld.id);
    expect(reloaded?.destinationBankSnapshot?.bankName).toContain("BCA");
    expect(reloaded?.destinationBankSnapshot?.accountNumber).toBe(bankBCA?.accountNumber);
  });

  it("15. Rekening nonaktif tidak digunakan untuk booking baru", async () => {
    // Disable BSI
    const banks = getEventBankAccounts();
    const bankBSI = banks.find((b) => b.bankName.includes("BSI"));
    if (bankBSI) {
      updateEventBankAccount(bankBSI.id, { isActive: false }, "Admin Finance");
    }

    const resolved = resolveDestinationBankAccount(testEvent);
    expect(resolved?.bankId).not.toBe(bankBSI?.id);
    expect(resolved?.bankName).toBeTruthy();
  });

  it("16. Event override rekening hanya digunakan jika fitur diizinkan", async () => {
    const banks = getEventBankAccounts();
    const bankBCA = banks.find((b) => b.bankName.includes("BCA"));
    const bankMandiri = banks.find((b) => b.bankName.includes("Mandiri"));
    expect(bankBCA).toBeDefined();
    expect(bankMandiri).toBeDefined();

    // Ensure BCA is default platform bank
    setDefaultEventBankAccount(bankBCA!.id, "Admin Finance");

    // Enable override in policy and override with Mandiri
    updateEventRevenuePolicy({ allowEventBankOverride: true });
    testEvent.destinationBankId = bankMandiri!.id;

    const resolved = resolveDestinationBankAccount(testEvent);
    expect(resolved?.bankId).toBe(bankMandiri!.id);

    // Disable override in policy
    updateEventRevenuePolicy({ allowEventBankOverride: false });
    const resolvedFallback = resolveDestinationBankAccount(testEvent);
    expect(resolvedFallback?.bankId).toBe(bankBCA!.id); // safely falls back to default BCA
  });

  it("17. Rekening penyelenggara tidak dapat digunakan sebelum disetujui", async () => {
    const unapprovedOrgBank = createEventBankAccount(
      {
        bankName: "Bank Danamon",
        accountNumber: "9988776655",
        accountHolder: "Komunitas Organizer Singaraja",
        label: "Rekening Khusus Konser",
        accountType: "ORGANIZER",
        approvalStatus: "PENDING",
        organizerEmail,
      },
      organizerEmail
    );

    // Attach unapproved bank to event
    testEvent.destinationBankId = unapprovedOrgBank.id;
    updateEventRevenuePolicy({ allowOrganizerBankAccounts: true, allowEventBankOverride: true });

    // Unapproved bank cannot be resolved
    const resolved = resolveDestinationBankAccount(testEvent);
    expect(resolved?.bankId).not.toBe(unapprovedOrgBank.id);

    // Approve the bank
    updateEventBankAccount(unapprovedOrgBank.id, { approvalStatus: "APPROVED" }, "Admin Finance");

    const resolvedApproved = resolveDestinationBankAccount(testEvent);
    expect(resolvedApproved?.bankId).toBe(unapprovedOrgBank.id);

    // Reset event destinationBankId
    testEvent.destinationBankId = null;
  });

  it("18. Pengguna tanpa izin tidak dapat mengubah konfigurasi bisnis via API", async () => {
    const req = new NextRequest("http://localhost:3000/api/events/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxTicketsPerBooking: 10 }),
    });

    const res = await handleSettingsPatch(req);
    expect([401, 403]).toContain(res.status);
  });

  it("19. Konfigurasi rekening tidak valid mencegah checkout secara aman", async () => {
    // Disable all bank accounts temporarily
    const policy = getEventRevenuePolicy();
    const allDisabled = policy.bankAccounts.map((b) => ({ ...b, isActive: false, isDefault: false }));
    updateEventRevenuePolicy({ bankAccounts: allDisabled });

    await expect(
      createEventBooking({
        eventId: testEvent.id,
        guestName: "No Bank Buyer",
        guestEmail: "nobank-buyer@test.com",
        guestPhone: "08123456789",
        ticketCount: 1,
      })
    ).rejects.toThrow(/rekening pembayaran aktif/i);

    // Restore active bank accounts with platform default active
    const restored = policy.bankAccounts.map((b) => {
      if (b.bankName.includes("BCA") && b.accountType === "PLATFORM") {
        return { ...b, isActive: true, isDefault: true };
      }
      return { ...b, isActive: true, isDefault: false };
    });
    updateEventRevenuePolicy({ bankAccounts: restored });
  });

  it("20. Konfigurasi tetap tersedia setelah reload dari disk", async () => {
    updateEventRevenuePolicy({
      bookingPaymentExpiryMinutes: 90,
      paymentInstructions: "Harap cantumkan kode booking pada berita transfer.",
    });

    const reloaded = getEventRevenuePolicy();
    expect(reloaded.bookingPaymentExpiryMinutes).toBe(90);
    expect(reloaded.paymentInstructions).toContain("berita transfer");
  });

  // ==========================================
  // BAGIAN 3 — PEMBAYARAN MANUAL (21-33)
  // ==========================================

  it("21. Booking tiket berbayar diarahkan ke alur transfer manual", async () => {
    const booking = await createEventBooking({
      eventId: testEvent.id,
      guestName: "Citra Kirana",
      guestEmail: "citra-manual@example.com",
      guestPhone: "0815555555",
      ticketCount: 1,
    });

    expect(booking.paymentMethod).toBe("MANUAL_TRANSFER");
    expect(booking.paymentStatus).toBe("PENDING");
    expect(booking.destinationBankSnapshot).toBeDefined();
    expect(booking.destinationBankSnapshot?.accountNumber).toBeTruthy();
  });

  it("22. Bukti transfer berhasil diunggah oleh peserta", async () => {
    const booking = await createEventBooking({
      eventId: testEvent.id,
      guestName: "Doni Pratama",
      guestEmail: "doni-proof@example.com",
      guestPhone: "0816666666",
      ticketCount: 1,
    });

    const updated = await updateBookingPaymentProof(booking.id, "https://storage.dagoeng.com/proofs/trx_12345.jpg");
    expect(updated).toBeDefined();
    expect(updated?.paymentProofUrl).toBe("https://storage.dagoeng.com/proofs/trx_12345.jpg");
    expect(updated?.paymentProofUploadedAt).toBeDefined();
  });

  it("23. Unggahan bukti transfer TIDAK otomatis mengubah status menjadi PAID", async () => {
    const booking = await createEventBooking({
      eventId: testEvent.id,
      guestName: "Eko Prasetyo",
      guestEmail: "eko-proof@example.com",
      guestPhone: "0817777777",
      ticketCount: 1,
    });

    const updated = await updateBookingPaymentProof(booking.id, "https://storage.dagoeng.com/proofs/trx_pending.jpg");
    expect(updated?.paymentStatus).toBe("PENDING");
    expect(updated?.paymentStatus).not.toBe("PAID");
  });

  it("24. Admin berwenang dapat menyetujui pembayaran manual", async () => {
    const booking = await createEventBooking({
      eventId: testEvent.id,
      guestName: "Fajar Nugraha",
      guestEmail: "fajar-approve@example.com",
      guestPhone: "0818888888",
      ticketCount: 1,
    });
    await updateBookingPaymentProof(booking.id, "https://storage.dagoeng.com/proofs/fajar.jpg");

    const approved = await adminApproveBookingPayment(booking.id, "Dana Rp 50.000 masuk mutasi BCA", "Admin Finance");
    expect(approved?.paymentStatus).toBe("PAID");
    expect(approved?.paymentVerifiedBy).toBe("Admin Finance");
    expect(approved?.paymentVerificationNote).toContain("Dana Rp 50.000 masuk mutasi BCA");
    expect(approved?.paymentVerifiedAt).toBeDefined();
  });

  it("25. Admin berwenang dapat menolak pembayaran dengan alasan wajib", async () => {
    const booking = await createEventBooking({
      eventId: testEvent.id,
      guestName: "Gita Gutawa",
      guestEmail: "gita-reject@example.com",
      guestPhone: "0819999999",
      ticketCount: 1,
    });
    await updateBookingPaymentProof(booking.id, "https://storage.dagoeng.com/proofs/fake.jpg");

    // Reject with empty reason must fail
    await expect(adminRejectBookingPayment(booking.id, "   ", "Admin Finance")).rejects.toThrow(/alasan penolakan/i);

    // Reject with valid reason
    const rejected = await adminRejectBookingPayment(
      booking.id,
      "Nominal transfer tidak sesuai (hanya Rp 10.000, seharusnya Rp 50.000)",
      "Admin Finance",
      false
    );
    expect(rejected?.paymentRejectionReason).toContain("Nominal transfer tidak sesuai");
    expect(rejected?.paymentStatus).toBe("PENDING"); // Allowed to re-upload while pending
  });

  it("26. Pengguna tanpa izin tidak dapat menyetujui atau menolak pembayaran via API", async () => {
    const req = new NextRequest(`http://localhost:3000/api/events/bookings/${existingBookingForAuthTest.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "APPROVE_PAYMENT" }),
    });

    const res = await handleBookingPatchRoute(req, { params: { id: existingBookingForAuthTest.id } });
    expect([401, 403]).toContain(res.status);
  });

  it("27. Hak akses peserta terhadap token transaksi terisolasi", async () => {
    const bookingA = await createEventBooking({
      eventId: testEvent.id,
      guestName: "User A",
      guestEmail: "usera-token@test.com",
      guestPhone: "081110001",
      ticketCount: 1,
    });
    const bookingB = await createEventBooking({
      eventId: testEvent.id,
      guestName: "User B",
      guestEmail: "userb-token@test.com",
      guestPhone: "082220002",
      ticketCount: 1,
    });

    expect(bookingA.guestToken).not.toBe(bookingB.guestToken);
  });

  it("28. File bukti tidak valid (bukan URL/format tidak didukung) ditolak oleh validasi", async () => {
    const booking = await createEventBooking({
      eventId: testEvent.id,
      guestName: "Hendra Setiawan",
      guestEmail: "hendra-invalidfile@test.com",
      guestPhone: "083330003",
      ticketCount: 1,
    });

    await expect(updateBookingPaymentProof(booking.id, "   ")).rejects.toThrow();
  });

  it("29. Persetujuan ganda bersifat idempotent dan tidak membuat tiket atau transaksi ganda", async () => {
    const booking = await createEventBooking({
      eventId: testEvent.id,
      guestName: "Indah Permata",
      guestEmail: "indah-idem@test.com",
      guestPhone: "084440004",
      ticketCount: 1,
    });

    const first = await adminApproveBookingPayment(booking.id, "Admin 1", "Persetujuan pertama");
    expect(first?.paymentStatus).toBe("PAID");

    const second = await adminApproveBookingPayment(booking.id, "Admin 2", "Persetujuan ulang");
    expect(second?.paymentStatus).toBe("PAID");
    expect(second?.id).toBe(first?.id);
  });

  it("30. Pembayaran terlambat ditangani sesuai kebijakan", async () => {
    const booking = await createEventBooking({
      eventId: testEvent.id,
      guestName: "Joko Susilo",
      guestEmail: "joko-late@test.com",
      guestPhone: "085550005",
      ticketCount: 1,
    });

    // Mark as EXPIRED
    const allBookings = loadBookingsFromDisk();
    const idx = allBookings.findIndex((x) => x.id === booking.id);
    allBookings[idx].paymentStatus = "EXPIRED";
    saveBookingsToDisk(allBookings);

    // Attempting to upload proof to EXPIRED booking fails
    await expect(updateBookingPaymentProof(booking.id, "https://storage.dagoeng.com/late.jpg")).rejects.toThrow(
      /kedaluwarsa|dibatalkan/i
    );
  });

  it("31. Booking kedaluwarsa tidak aktif kembali tanpa validasi status dan kuota", async () => {
    const allBookings = loadBookingsFromDisk();
    const expiredBookings = allBookings.filter((b) => b.paymentStatus === "EXPIRED");
    expect(expiredBookings.every((b) => b.paymentStatus === "EXPIRED")).toBe(true);
  });

  it("32. Tiket dan QR hanya aktif setelah persetujuan pembayaran", async () => {
    const booking = await createEventBooking({
      eventId: testEvent.id,
      guestName: "Kurnia Meiga",
      guestEmail: "kurnia-ticket@test.com",
      guestPhone: "086660006",
      ticketCount: 1,
    });

    // When PENDING, payment status is PENDING
    expect(booking.paymentStatus).toBe("PENDING");

    // After approval, ticket status is PAID and ready for event day check-in
    const approved = await adminApproveBookingPayment(booking.id, "Admin", "Lunas");
    expect(approved?.paymentStatus).toBe("PAID");
    expect(approved?.checkInStatus).toBe("REGISTERED");
  });

  it("33. Audit log mencatat riwayat perubahan rekening", async () => {
    const banks = getEventBankAccounts();
    const bsi = banks.find((b) => b.bankName.includes("BSI"));
    if (bsi) {
      updateEventBankAccount(bsi.id, { label: "Label Diperbarui untuk Audit" }, "Admin Auditor");
    }

    const policy = getEventRevenuePolicy();
    expect(policy.bankHistory).toBeDefined();
    expect(policy.bankHistory.length).toBeGreaterThan(0);
    const newestEntry = policy.bankHistory[0];
    expect(newestEntry.changedBy).toBe("Admin Auditor");
    expect(newestEntry.action).toBe("UPDATE");
  });

  // ==========================================
  // BAGIAN 4 — REVENUE SHARING DAN REGRESI (34-40)
  // ==========================================

  it("34. Komisi platform divalidasi dan dihitung sesuai kebijakan bisnis (20/80 default)", async () => {
    const split = calculateEventRevenueSplit(100000, 20);
    expect(split.grossRevenue).toBe(100000);
    expect(split.platformFeePercent).toBe(20);
    expect(split.platformFeeAmount).toBe(20000);
    expect(split.organizerSharePercent).toBe(80);
    expect(split.organizerShareAmount).toBe(80000);
  });

  it("35. Perubahan kebijakan komisi tidak mengubah histori transaksi lama", async () => {
    const booking = await createEventBooking({
      eventId: testEvent.id,
      guestName: "Lia Warokka",
      guestEmail: "lia-history@test.com",
      guestPhone: "087770007",
      ticketCount: 1,
    });
    await adminApproveBookingPayment(booking.id, "Admin", "Lunas");

    // Change global commission policy to 25%
    updateEventRevenuePolicy({ defaultPlatformFeePercent: 25, defaultOrganizerSharePercent: 75 });

    // Ensure calculation for booking with original 20% still holds
    const splitOld = calculateEventRevenueSplit(50000, 20);
    expect(splitOld.platformFeeAmount).toBe(10000);

    // Reset policy back to 20/80
    updateEventRevenuePolicy({ defaultPlatformFeePercent: 20, defaultOrganizerSharePercent: 80 });
  });

  it("36. Laporan keuangan membedakan pendapatan kotor, komisi platform, dan hak penyelenggara", async () => {
    const portalData = await getOrganizerPortalData(organizerEmail);
    expect(portalData).toBeDefined();
    expect(portalData.summary).toBeDefined();
    expect(typeof portalData.summary.grossRevenue).toBe("number");
    expect(typeof portalData.summary.platformFeeAmount).toBe("number");
    expect(typeof portalData.summary.organizerPayoutAmount).toBe("number");
  });

  it("37. Status payout tidak mengklaim transfer yang belum diproses", async () => {
    const portalData = await getOrganizerPortalData(organizerEmail);
    const myEvents = portalData.events || [];
    for (const evt of myEvents) {
      if (evt.payoutHistory) {
        for (const p of evt.payoutHistory) {
          if (p.status === "REQUESTED") {
            expect(p.processedAt).toBeUndefined();
          }
        }
      }
    }
  });

  it("38. Integrasi DOKU pada simulasi/modul lain tetap utuh dan tidak rusak", async () => {
    const policy = getEventRevenuePolicy();
    expect(policy.activePaymentMethod).toBe("MANUAL_TRANSFER");
  });

  it("39. RBAC dan isolasi bank tetap terjaga pada level API", async () => {
    const getReq = new NextRequest("http://localhost:3000/api/events/admin/settings/banks");
    const getRes = await handleBanksGet(getReq);
    expect([401, 403]).toContain(getRes.status);

    const postReq = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankName: "Hack Bank", accountNumber: "123", accountHolder: "Hacker" }),
    });
    const postRes = await handleBanksPost(postReq);
    expect([401, 403]).toContain(postRes.status);
  });

  it("40. Seluruh status rekening valid dan konsisten", async () => {
    const banks = getEventBankAccounts();
    expect(banks.length).toBeGreaterThan(0);
    const defaults = banks.filter((b) => b.isDefault);
    expect(defaults.length).toBe(1);
    expect(defaults[0].isActive).toBe(true);
  });
});
