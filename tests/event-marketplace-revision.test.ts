import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import {
  createEventSubmission,
  updateEventStatus,
  createEventBooking,
  updateBookingPaymentStatus,
  getOrganizerPortalData,
  organizerResubmitEvent,
  proposeEventRevenueSplit,
  respondToEventRevenueSplit,
  requestOrganizerPayout,
  processOrganizerPayout,
} from "../src/lib/events";
import { NextRequest } from "next/server";
import { assertOrganizerAuth } from "../src/lib/server-auth";
import { isOrganizerActive, getOrganizerByEmail } from "../src/lib/organizers";
import { CommunityEvent, EventTicketOrder } from "../src/types/event";

const DATA_DIR = process.env.DATA_DIR_OVERRIDE || path.join(process.cwd(), "data");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");
const BOOKINGS_FILE = path.join(DATA_DIR, "event_bookings.json");

describe("Event Marketplace Revision, Negotiation & Payout Integrity Test Suite", () => {
  const orgEmailA = `music-fest-${Date.now()}@singarajamedia.com`;
  const orgEmailB = `tech-hub-${Date.now()}@northbali.dev`;

  let eventA: CommunityEvent;
  let eventB: CommunityEvent;
  let originalEventsBackup: string | null = null;
  let originalBookingsBackup: string | null = null;

  beforeAll(() => {
    if (fs.existsSync(EVENTS_FILE)) originalEventsBackup = fs.readFileSync(EVENTS_FILE, "utf-8");
    if (fs.existsSync(BOOKINGS_FILE)) originalBookingsBackup = fs.readFileSync(BOOKINGS_FILE, "utf-8");
  });

  afterAll(() => {
    if (originalEventsBackup !== null) fs.writeFileSync(EVENTS_FILE, originalEventsBackup, "utf-8");
    if (originalBookingsBackup !== null) fs.writeFileSync(BOOKINGS_FILE, originalBookingsBackup, "utf-8");
  });

  it("1. Pengajuan event menyimpan usulan bagi hasil dan kebutuhan kolaborasi fasilitas & promosi", async () => {
    const sub = await createEventSubmission({
      organizerName: "Singaraja Indie Music",
      organizerEmail: orgEmailA,
      organizerPhone: "081299990001",
      title: "Singaraja Sunset Acoustics 2026",
      category: "CREATIVE",
      description: "Konser mini akustik senja di Dago Creative Hub Singaraja.",
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 93600000).toISOString(),
      location: "Amphitheater Dago",
      isPaid: true,
      price: 75000,
      posterUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",
      collaborationFacilities: ["Sound System & Mic Wireless", "Proyektor & Layar LED"],
      collaborationPromotion: ["Publikasi Instagram @dagocreativehub"],
      collaborationNotes: "Membutuhkan loading alat band H-3 jam sebelum open gate.",
      proposedOrganizerPercent: 85,
      proposedPlatformPercent: 15,
      revenueSplitReason: "Penyelenggara menanggung seluruh honor musisi bintang tamu.",
    });

    expect(sub.status).toBe("PENDING");
    expect(sub.organizerFeePercent).toBe(85);
    expect(sub.customPlatformFeePercent).toBe(15);
    expect(sub.collaborationFacilities).toContain("Sound System & Mic Wireless");
    expect(sub.proposedRevenueSplit).not.toBeNull();
    expect(sub.proposedRevenueSplit?.organizerPercent).toBe(85);
    expect(sub.proposedRevenueSplit?.platformPercent).toBe(15);

    eventA = sub;
  });

  it("2. Event yang disetujui kurator otomatis muncul di portal pemilik dan admin monitoring", async () => {
    const approved = await updateEventStatus(eventA.id, "APPROVED");
    expect(approved.status).toBe("APPROVED");

    // Portal data for Organizer A
    const portalA = await getOrganizerPortalData(orgEmailA, false);
    const foundInA = portalA.events.find((e) => e.id === eventA.id);
    expect(foundInA).toBeDefined();
    expect(foundInA?.title).toBe(eventA.title);

    // Portal data for Hub Admin (ALL_ADMIN view)
    const portalAdmin = await getOrganizerPortalData("ALL_ADMIN", true);
    const foundInAdmin = portalAdmin.events.find((e) => e.id === eventA.id);
    expect(foundInAdmin).toBeDefined();
  });

  it("3. Isolasi antar-penyelenggara terjaga ketat", async () => {
    // Create Event B
    const subB = await createEventSubmission({
      organizerName: "North Bali Tech Meetup",
      organizerEmail: orgEmailB,
      organizerPhone: "081299990002",
      title: "Singaraja AI & Cloud Hackathon",
      category: "TECH",
      description: "Hackathon 24 jam membangun solusi agrikultur cerdas.",
      startDate: new Date(Date.now() + 172800000).toISOString(),
      endDate: new Date(Date.now() + 259200000).toISOString(),
      location: "Meeting Room Coworking Dago",
      isPaid: false,
      price: 0,
      posterUrl: "https://images.unsplash.com/photo-1531482615713-2afd69097998",
    });
    eventB = await updateEventStatus(subB.id, "APPROVED");

    // Organizer A must NOT see event B
    const portalA = await getOrganizerPortalData(orgEmailA, false);
    const hasEventBInPortalA = portalA.events.some((e) => e.id === eventB.id);
    expect(hasEventBInPortalA).toBe(false);

    // Organizer B must NOT see event A
    const portalB = await getOrganizerPortalData(orgEmailB, false);
    const hasEventAInPortalB = portalB.events.some((e) => e.id === eventA.id);
    expect(hasEventAInPortalB).toBe(false);
  });

  it("4. Revisi proposal dan pengajuan ulang tidak menghilangkan data dan tidak membuat duplikat", async () => {
    // Put event B into REVISION_REQUESTED
    await updateEventStatus(eventB.id, "REVISION_REQUESTED", "Mohon sertakan panduan membawa laptop dan kapasitas meja.");

    // Resubmit event B
    const resubmitted = await organizerResubmitEvent(orgEmailB, eventB.id, {
      title: "Singaraja AI & Cloud Hackathon (Updated)",
      maxCapacity: 45,
      guidelines: "Wajib membawa laptop sendiri dan charger universal.",
    });

    expect(resubmitted.id).toBe(eventB.id); // Same ID, NO duplication!
    expect(resubmitted.status).toBe("PENDING");
    expect(resubmitted.title).toBe("Singaraja AI & Cloud Hackathon (Updated)");
    expect(resubmitted.maxCapacity).toBe(45);
    expect(resubmitted.revisionNotes).toBeNull(); // Cleared
  });

  it("5. Negosiasi bagi hasil: validasi total 100%, tandingan, persetujuan dan riwayat histori", async () => {
    // Attempt invalid split (total != 100) must throw
    await expect(
      proposeEventRevenueSplit(eventA.id, "ORGANIZER", 90, 20, "Salah hitung", orgEmailA)
    ).rejects.toThrow("Total persentase bagi hasil harus tepat 100%.");

    // Propose valid split by Organizer (85% / 15%)
    const proposed = await proposeEventRevenueSplit(
      eventA.id,
      "ORGANIZER",
      85,
      15,
      "Usulan peningkatan bagi hasil",
      orgEmailA
    );
    expect(proposed.proposedRevenueSplit?.organizerPercent).toBe(85);
    expect(proposed.proposedRevenueSplit?.platformPercent).toBe(15);
    expect(proposed.proposedRevenueSplit?.status).toBe("PENDING");

    // Counter-offer by Admin (80% / 20%)
    const countered = await respondToEventRevenueSplit(
      eventA.id,
      "COUNTER",
      "DAGO_ADMIN",
      "Admin Dago Finance",
      { organizerPercent: 80, platformPercent: 20, reason: "Standar operasional venue" },
      "admin@dagoeng.com",
      true
    );
    expect(countered.proposedRevenueSplit?.organizerPercent).toBe(80);
    expect(countered.proposedRevenueSplit?.platformPercent).toBe(20);

    // Accept by Organizer
    const accepted = await respondToEventRevenueSplit(
      eventA.id,
      "ACCEPT",
      "ORGANIZER",
      "Singaraja Indie Music",
      undefined,
      orgEmailA,
      false
    );
    expect(accepted.organizerFeePercent).toBe(80);
    expect(accepted.customPlatformFeePercent).toBe(20);
    expect(accepted.proposedRevenueSplit).toBeNull(); // Cleared on acceptance
    expect(accepted.revenueSplitHistory?.length).toBeGreaterThanOrEqual(1);
    expect(accepted.revenueSplitHistory?.[0].agreedOrganizerPercent).toBe(80);
  });

  it("6. Transaksi tiket, hak pendapatan penyelenggara, dan pembatasan pencairan saldo (payout)", async () => {
    // Create and pay ticket booking for Event A (2 tickets @ 75000 = 150000 total)
    const booking = await createEventBooking({
      eventId: eventA.id,
      guestName: "Doni Penonton",
      guestEmail: "doni@fanmusic.id",
      guestPhone: "081234567899",
      ticketCount: 2,
    });
    await updateBookingPaymentStatus(booking.id, "PAID");

    // Check organizer portal revenue
    // Total gross = 150.000. Organizer split = 80% = 120.000.
    const portal = await getOrganizerPortalData(orgEmailA, false);
    expect(portal.summary.grossRevenue).toBeGreaterThanOrEqual(150000);
    expect(portal.summary.organizerPayoutAmount).toBeGreaterThanOrEqual(120000);

    // Attempt payout exceeding available balance must fail
    await expect(
      requestOrganizerPayout(
        orgEmailA,
        eventA.id,
        9999999, // Exceeds 120.000
        { bankName: "BCA", accountNumber: "1234567890", accountHolder: "Singaraja Music" }
      )
    ).rejects.toThrow("melebihi saldo yang tersedia");

    // Valid payout request of 100.000
    const { event: afterReq, payout } = await requestOrganizerPayout(
      orgEmailA,
      eventA.id,
      100000,
      { bankName: "BCA", accountNumber: "1234567890", accountHolder: "Singaraja Music" },
      "Mohon dicairkan untuk DP persewaan instrumen"
    );
    expect(payout.status).toBe("REQUESTED");
    expect(payout.amount).toBe(100000);
    expect(afterReq.payoutStatus).toBe("REQUESTED");

    // Admin marks PROCESSING
    const { payout: processingPayout } = await processOrganizerPayout(
      eventA.id,
      payout.id,
      "PROCESSING",
      undefined,
      undefined,
      "Finance Admin Dago"
    );
    expect(processingPayout.status).toBe("PROCESSING");

    // Admin finishes transfer with manual reference number
    const { payout: paidPayout } = await processOrganizerPayout(
      eventA.id,
      payout.id,
      "PAID",
      "BCA-TRF-20261028-00129",
      undefined,
      "Finance Admin Dago"
    );
    expect(paidPayout.status).toBe("PAID");
    expect(paidPayout.referenceNo).toBe("BCA-TRF-20261028-00129");

    // Verify updated portal metrics reflect paid payout
    const updatedPortal = await getOrganizerPortalData(orgEmailA, false);
    expect(updatedPortal.summary.paidPayoutAmount).toBe(100000);
    expect(updatedPortal.summary.availablePayoutAmount).toBe(
      updatedPortal.summary.organizerPayoutAmount - 100000
    );
  });

  it("7. Proposal submission tidak otomatis mengaktifkan profil penyelenggara di organizers.json", async () => {
    const unapprovedEmail = `guest-proposal-${Date.now()}@unapproved.org`;

    // Ensure the email does not exist initially in organizers
    const initialOrg = getOrganizerByEmail(unapprovedEmail);
    expect(initialOrg).toBeNull();
    expect(isOrganizerActive(unapprovedEmail)).toBe(false);

    // Submit a new proposal
    const submission = await createEventSubmission({
      organizerName: "Guest Proposal Community",
      organizerEmail: unapprovedEmail,
      organizerPhone: "081299990009",
      title: "Proposal Acara Belum Disetujui",
      category: "CREATIVE",
      description: "Deskripsi acara proposal komunitas yang masih dalam tahap kurasi.",
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 93600000).toISOString(),
      location: "Coworking Space Dago",
      isPaid: false,
      price: 0,
      posterUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",
    });

    expect(submission.status).toBe("PENDING");

    // CRITICAL SECURITY ASSERTION: Submitter must NOT be added to organizers.json or active
    const orgAfterSubmission = getOrganizerByEmail(unapprovedEmail);
    expect(orgAfterSubmission).toBeNull();
    expect(isOrganizerActive(unapprovedEmail)).toBe(false);
  });

  it("8. ALL_ADMIN dibatasi ketat pada Hub Admin dan menolak Tenant Owner, Kasir, Customer, serta Komunitas", async () => {
    // 1. Tenant Owner attempting ALL_ADMIN must be rejected
    const tenantOwnerReq = new NextRequest("http://localhost:3000/api/events/portal?email=ALL_ADMIN", {
      headers: { cookie: "dagoeng_active_persona=TENANT_OWNER_KS" },
    });
    const tenantAuth = await assertOrganizerAuth(tenantOwnerReq, "ALL_ADMIN");
    expect(tenantAuth.authorized).toBe(false);
    expect(tenantAuth.error).toContain("Pelanggaran isolasi data");

    // 2. Customer attempting ALL_ADMIN must be rejected
    const customerReq = new NextRequest("http://localhost:3000/api/events/portal?email=ALL_ADMIN", {
      headers: { cookie: "dagoeng_active_persona=CUSTOMER_DEMO" },
    });
    const customerAuth = await assertOrganizerAuth(customerReq, "ALL_ADMIN");
    expect(customerAuth.authorized).toBe(false);
    expect(customerAuth.error).toContain("Pelanggaran isolasi data");

    // 3. Organizer attempting ALL_ADMIN must be rejected
    const organizerReq = new NextRequest("http://localhost:3000/api/events/portal?email=ALL_ADMIN", {
      headers: { cookie: "dagoeng_active_persona=COMMUNITY_BARISTA" },
    });
    const organizerAuth = await assertOrganizerAuth(organizerReq, "ALL_ADMIN");
    expect(organizerAuth.authorized).toBe(false);
    expect(organizerAuth.error).toContain("Pelanggaran isolasi data");

    // 4. Hub Admin (SUPER_ADMIN) is authorized for ALL_ADMIN
    const superAdminReq = new NextRequest("http://localhost:3000/api/events/portal?email=ALL_ADMIN", {
      headers: { cookie: "dagoeng_active_persona=SUPER_ADMIN" },
    });
    const adminAuth = await assertOrganizerAuth(superAdminReq, "ALL_ADMIN");
    expect(adminAuth.authorized).toBe(true);
    expect(adminAuth.isAdmin).toBe(true);
    expect(adminAuth.email).toBe("all_admin");
  });

  it("9. Gross revenue vs Eligible revenue membedakan transaksi PAID vs PENDING/CANCELLED", async () => {
    const revenueOrgEmail = `revenue-audit-${Date.now()}@dagoeng.com`;
    const eventSub = await createEventSubmission({
      organizerName: "Audit Revenue Fest",
      organizerEmail: revenueOrgEmail,
      organizerPhone: "081299990010",
      title: "Revenue Audit Event 2026",
      category: "CREATIVE",
      description: "Verifikasi ketat gross vs eligible revenue pada pembukuan tiket.",
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 93600000).toISOString(),
      location: "Auditorium Dago Hub",
      isPaid: true,
      price: 100000,
      posterUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",
      proposedOrganizerPercent: 80,
      proposedPlatformPercent: 20,
    });

    const event = await updateEventStatus(eventSub.id, "APPROVED");

    // 1. Create PAID booking (1 ticket = Rp 100.000)
    const paidBooking = await createEventBooking({
      eventId: event.id,
      guestName: "Pembeli Lunas",
      guestEmail: `buyer-paid-${Date.now()}@test.id`,
      guestPhone: "081234567801",
      ticketCount: 1,
    });
    await updateBookingPaymentStatus(paidBooking.id, "PAID");

    // 2. Create PENDING booking (2 tickets = Rp 200.000)
    const pendingBooking = await createEventBooking({
      eventId: event.id,
      guestName: "Pembeli Pending",
      guestEmail: `buyer-pending-${Date.now()}@test.id`,
      guestPhone: "081234567802",
      ticketCount: 2,
    });
    expect(pendingBooking.paymentStatus).toBe("PENDING");

    // 3. Create CANCELLED booking (1 ticket = Rp 100.000)
    const cancelledBooking = await createEventBooking({
      eventId: event.id,
      guestName: "Pembeli Batal",
      guestEmail: `buyer-cancelled-${Date.now()}@test.id`,
      guestPhone: "081234567803",
      ticketCount: 1,
    });
    await updateBookingPaymentStatus(cancelledBooking.id, "CANCELLED");

    // Retrieve Portal Data
    const portal = await getOrganizerPortalData(revenueOrgEmail, false);

    // Total gross: 100k (PAID) + 200k (PENDING) + 100k (CANCELLED) = 400.000
    expect(portal.summary.grossRevenue).toBe(400000);

    // Total eligible: strictly PAID = 100.000 (Gross != Eligible!)
    expect(portal.summary.eligibleRevenue).toBe(100000);
    expect(portal.summary.eligibleRevenue).not.toBe(portal.summary.grossRevenue);

    // Organizer payout: 80% of 100.000 = 80.000
    expect(portal.summary.organizerPayoutAmount).toBe(80000);
    expect(portal.summary.availablePayoutAmount).toBe(80000);
  });

  it("10. Pencegahan pencairan ganda (double-payout) saat pengajuan sebelumnya masih REQUESTED / PROCESSING", async () => {
    const doublePayoutEmail = `payout-lock-${Date.now()}@dagoeng.com`;
    const sub = await createEventSubmission({
      organizerName: "Double Payout Defense",
      organizerEmail: doublePayoutEmail,
      organizerPhone: "081299990011",
      title: "Double Payout Verification Event",
      category: "CREATIVE",
      description: "Uji integritas race condition dan duplikasi permintaan pencairan.",
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 93600000).toISOString(),
      location: "Main Hall Dago",
      isPaid: true,
      price: 200000,
      posterUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",
    });
    const event = await updateEventStatus(sub.id, "APPROVED");

    // Create and pay 2 tickets = Rp 400.000 (80% organizer = Rp 320.000)
    const booking = await createEventBooking({
      eventId: event.id,
      guestName: "Donatur Acara",
      guestEmail: `donatur-${Date.now()}@test.id`,
      guestPhone: "081234567811",
      ticketCount: 2,
    });
    await updateBookingPaymentStatus(booking.id, "PAID");

    // First payout request of 150.000
    const { payout: firstPayout } = await requestOrganizerPayout(
      doublePayoutEmail,
      event.id,
      150000,
      { bankName: "Mandiri", accountNumber: "9876543210", accountHolder: "Double Defense" }
    );
    expect(firstPayout.status).toBe("REQUESTED");

    // Second payout request while first is still REQUESTED must be rejected!
    await expect(
      requestOrganizerPayout(
        doublePayoutEmail,
        event.id,
        100000,
        { bankName: "Mandiri", accountNumber: "9876543210", accountHolder: "Double Defense" }
      )
    ).rejects.toThrow("Masih terdapat pengajuan pencairan dana yang sedang menunggu verifikasi");

    // Advance first payout to PROCESSING
    await processOrganizerPayout(
      event.id,
      firstPayout.id,
      "PROCESSING",
      undefined,
      undefined,
      "Finance Admin"
    );

    // Second payout request while first is PROCESSING must also be rejected!
    await expect(
      requestOrganizerPayout(
        doublePayoutEmail,
        event.id,
        100000,
        { bankName: "Mandiri", accountNumber: "9876543210", accountHolder: "Double Defense" }
      )
    ).rejects.toThrow("Masih terdapat pengajuan pencairan dana yang sedang menunggu verifikasi");

    // Now Admin marks first payout as PAID
    await processOrganizerPayout(
      event.id,
      firstPayout.id,
      "PAID",
      "MND-TRF-20261028-9999",
      undefined,
      "Finance Admin"
    );

    // Now second payout can proceed with remaining balance (320.000 - 150.000 = 170.000 available)
    const { payout: secondPayout } = await requestOrganizerPayout(
      doublePayoutEmail,
      event.id,
      100000,
      { bankName: "Mandiri", accountNumber: "9876543210", accountHolder: "Double Defense" }
    );
    expect(secondPayout.status).toBe("REQUESTED");
    expect(secondPayout.amount).toBe(100000);
  });

  it("11. Pihak yang mengusulkan bagi hasil dilarang menyetujui usulannya sendiri", async () => {
    // Propose split by Organizer (85% / 15%)
    await proposeEventRevenueSplit(
      eventA.id,
      "ORGANIZER",
      85,
      15,
      "Usulan sepihak penyelenggara",
      orgEmailA
    );

    // Organizer trying to ACCEPT their own proposal must throw!
    await expect(
      respondToEventRevenueSplit(
        eventA.id,
        "ACCEPT",
        "ORGANIZER",
        "Singaraja Indie Music",
        undefined,
        orgEmailA,
        false
      )
    ).rejects.toThrow("Pihak yang mengajukan usulan tidak dapat menyetujui usulannya sendiri");
  });

  it("12. Validasi transisi status pencairan: PAID dan REJECTED bersifat final & wajib data pelengkap", async () => {
    const transEmail = `trans-integrity-${Date.now()}@dagoeng.com`;
    const sub = await createEventSubmission({
      organizerName: "Transition Guard",
      organizerEmail: transEmail,
      organizerPhone: "081299990012",
      title: "Transition Guard Event",
      category: "CREATIVE",
      description: "Uji transisi final payout.",
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 93600000).toISOString(),
      location: "Main Hall Dago",
      isPaid: true,
      price: 100000,
      posterUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",
    });
    const event = await updateEventStatus(sub.id, "APPROVED");

    const booking = await createEventBooking({
      eventId: event.id,
      guestName: "Guest Transition",
      guestEmail: `trans-guest-${Date.now()}@test.id`,
      guestPhone: "081234567812",
      ticketCount: 1,
    });
    await updateBookingPaymentStatus(booking.id, "PAID");

    const { payout } = await requestOrganizerPayout(
      transEmail,
      event.id,
      50000,
      { bankName: "BNI", accountNumber: "1122334455", accountHolder: "Transition Guard" }
    );

    // Marking PAID without referenceNo must fail
    await expect(
      processOrganizerPayout(event.id, payout.id, "PAID", "", undefined, "Admin")
    ).rejects.toThrow("Nomor referensi transfer bank wajib disertakan");

    // Marking REJECTED without rejectionReason must fail
    await expect(
      processOrganizerPayout(event.id, payout.id, "REJECTED", undefined, "", "Admin")
    ).rejects.toThrow("Alasan penolakan pencairan saldo wajib disertakan");

    // Successfully mark PAID with referenceNo
    await processOrganizerPayout(event.id, payout.id, "PAID", "REF-BNI-98712", undefined, "Admin");

    // Modifying already PAID payout must fail
    await expect(
      processOrganizerPayout(event.id, payout.id, "PROCESSING", undefined, undefined, "Admin")
    ).rejects.toThrow("Pengajuan pencairan ini telah selesai dibayarkan (PAID) dan tidak dapat diubah kembali.");
  });

  it("13. Transaksi historis tidak berubah akibat persentase bagi hasil baru (immutability)", async () => {
    const histEmail = `history-immutability-${Date.now()}@dagoeng.com`;
    const sub = await createEventSubmission({
      organizerName: "Immutability Lab",
      organizerEmail: histEmail,
      organizerPhone: "081299990013",
      title: "Historical Immutability Concert",
      category: "CREATIVE",
      description: "Uji transaksi historis tetap terjaga saat terjadi negosiasi bagi hasil baru.",
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 93600000).toISOString(),
      location: "Main Hall Dago",
      isPaid: true,
      price: 100000,
      posterUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",
      proposedOrganizerPercent: 80, // Original split 80%
      proposedPlatformPercent: 20,
    });
    const event = await updateEventStatus(sub.id, "APPROVED");

    // 1. Booking under original 80% split (1 ticket = 100.000 -> organizer gets 80.000)
    const oldBooking = await createEventBooking({
      eventId: event.id,
      guestName: "Old Era Attendee",
      guestEmail: `old-era-${Date.now()}@test.id`,
      guestPhone: "081234567820",
      ticketCount: 1,
    });
    await updateBookingPaymentStatus(oldBooking.id, "PAID");
    expect(oldBooking.organizerRevenueAmount).toBe(80000);
    expect(oldBooking.platformFeeAmount).toBe(20000);

    // 2. Negotiate and accept new split: 90% organizer / 10% platform
    await proposeEventRevenueSplit(event.id, "ORGANIZER", 90, 10, "Kenaikan performa", histEmail);
    const updatedSplit = await respondToEventRevenueSplit(
      event.id,
      "ACCEPT",
      "DAGO_ADMIN",
      "Admin Dago Finance",
      undefined,
      "admin@dagoeng.com",
      true
    );
    expect(updatedSplit.organizerFeePercent).toBe(90);
    expect(updatedSplit.revenueSplitHistory?.[0].effectiveDate).toBeDefined();

    // 3. New booking under 90% split (1 ticket = 100.000 -> organizer gets 90.000)
    const newBooking = await createEventBooking({
      eventId: event.id,
      guestName: "New Era Attendee",
      guestEmail: `new-era-${Date.now()}@test.id`,
      guestPhone: "081234567821",
      ticketCount: 1,
    });
    await updateBookingPaymentStatus(newBooking.id, "PAID");
    expect(newBooking.organizerRevenueAmount).toBe(90000);
    expect(newBooking.platformFeeAmount).toBe(10000);

    // 4. Verify historical booking was NOT modified or recalculated retroactively
    const bookingsAfter = JSON.parse(fs.readFileSync(BOOKINGS_FILE, "utf-8"));
    const verifiedOldBooking = bookingsAfter.find((b: any) => b.id === oldBooking.id);
    expect(verifiedOldBooking.organizerRevenueAmount).toBe(80000); // Intact 80k!
    expect(verifiedOldBooking.platformFeeAmount).toBe(20000);

    // 5. Total portal organizer revenue must be exactly 80.000 + 90.000 = 170.000
    const portal = await getOrganizerPortalData(histEmail, false);
    expect(portal.summary.organizerPayoutAmount).toBe(170000);
  });
});

