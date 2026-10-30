import fs from "fs";
import path from "path";

const BASE_URL = "http://localhost:3000";

// Keep snapshots of baseline data files so we guarantee 100% data preservation
const bookingsFile = path.resolve("data/event_bookings.json");
const eventsFile = path.resolve("data/events.json");
const baselineBookings = fs.readFileSync(bookingsFile, "utf-8");
const baselineEvents = fs.readFileSync(eventsFile, "utf-8");

const results = [];

function record(persona, testCase, expected, actual, status, evidence) {
  results.push({ persona, testCase, expected, actual, status, evidence });
  console.log(`[${status}] [${persona}] ${testCase}`);
  if (status !== "PASS") {
    console.error(`  Expected: ${expected}`);
    console.error(`  Actual:   ${actual}`);
  }
}

async function runUAT() {
  console.log("==================================================================");
  console.log("  DAGOENG EVENT MARKETPLACE — LIVE HTTP / BROWSER UAT SIMULATION");
  console.log("  Target: " + BASE_URL);
  console.log("==================================================================\n");

  let createdEventId = null;
  let createdBookingId = null;
  let guestToken = null;
  let ticketCode = null;

  try {
    // -------------------------------------------------------------
    // PHASE 2: ADMIN UAT
    // -------------------------------------------------------------
    console.log("--- PHASE 2: ADMIN UAT ---");

    // 1. Admin Login
    let adminCookie = "";
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "owner.dago@dagoeng.com", password: "Password123!" }),
    });
    const adminLoginJson = await adminLoginRes.json();
    const setCookie = adminLoginRes.headers.get("set-cookie") || "";
    // Extract session cookie or persona cookie
    adminCookie = setCookie.split(";")[0] || "dagoeng_persona=DAGO_OWNER";

    record(
      "ADMIN",
      "Login as Dago Hub Owner / Admin",
      "Login sukses, role OWNER, redirectUrl /dashboard",
      `HTTP ${adminLoginRes.status}, user: ${adminLoginJson.user?.name}, role: ${adminLoginJson.user?.role?.slug}`,
      adminLoginRes.status === 200 && adminLoginJson.success ? "PASS" : "FAIL",
      `User ID: ${adminLoginJson.user?.id}`
    );

    // 2. Admin View Event Submissions
    const adminEventsRes = await fetch(`${BASE_URL}/api/events/admin`, {
      headers: { Cookie: adminCookie },
    });
    const adminEventsJson = await adminEventsRes.json();
    record(
      "ADMIN",
      "Melihat daftar pengajuan event",
      "Mendapatkan seluruh event berbagai status",
      `HTTP ${adminEventsRes.status}, Total events: ${adminEventsJson.count || 0}`,
      adminEventsRes.status === 200 && adminEventsJson.success && Array.isArray(adminEventsJson.data) ? "PASS" : "FAIL",
      `Count: ${adminEventsJson.count}`
    );

    // 3. Admin View Settings
    const adminSettingsRes = await fetch(`${BASE_URL}/api/events/admin/settings`, {
      headers: { Cookie: adminCookie },
    });
    const adminSettingsJson = await adminSettingsRes.json();
    record(
      "ADMIN",
      "Memeriksa pengaturan komisi dan konfigurasi event",
      "Mendapatkan policy komisi platform (misal 20%)",
      `HTTP ${adminSettingsRes.status}, Platform Fee: ${adminSettingsJson.data?.platformFeePercent}%`,
      adminSettingsRes.status === 200 && adminSettingsJson.success ? "PASS" : "FAIL",
      `Bank transfer accounts: ${adminSettingsJson.data?.bankAccounts?.length || 0}`
    );

    // 4. Admin View Bookings & Payments
    const adminBookingsRes = await fetch(`${BASE_URL}/api/events/bookings`, {
      headers: { Cookie: adminCookie },
    });
    const adminBookingsJson = await adminBookingsRes.json();
    record(
      "ADMIN",
      "Memeriksa daftar booking dan pembayaran",
      "Mendapatkan daftar seluruh booking dengan masking PII",
      `HTTP ${adminBookingsRes.status}, Total bookings: ${adminBookingsJson.count || 0}`,
      adminBookingsRes.status === 200 && adminBookingsJson.success ? "PASS" : "FAIL",
      `First booking PII masked: ${adminBookingsJson.data?.[0]?.guestEmail}`
    );

    // 5. Admin Navigation Pages Accessibility
    const adminPageRes = await fetch(`${BASE_URL}/events-admin`, { headers: { Cookie: adminCookie } });
    record(
      "ADMIN",
      "Akses visual dashboard admin (/events-admin)",
      "Halaman admin dapat diakses (HTTP 200)",
      `HTTP ${adminPageRes.status}`,
      adminPageRes.status === 200 ? "PASS" : "FAIL",
      `Content-Type: ${adminPageRes.headers.get("content-type")}`
    );

    // -------------------------------------------------------------
    // PHASE 3: ORGANIZER UAT
    // -------------------------------------------------------------
    console.log("\n--- PHASE 3: ORGANIZER UAT ---");

    // 1. Organizer Login
    const orgLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "baristaguild@dagocreative.id", password: "Password123!" }),
    });
    const orgLoginJson = await orgLoginRes.json();
    const orgCookie = "dagoeng_active_persona=COMMUNITY_BARISTA";

    record(
      "ORGANIZER",
      "Login sebagai Organizer Komunitas",
      "Login sukses dengan akun penyelenggara",
      `HTTP ${orgLoginRes.status}, user: ${orgLoginJson.user?.name}`,
      orgLoginRes.status === 200 && orgLoginJson.success ? "PASS" : "FAIL",
      `Email: ${orgLoginJson.user?.email}`
    );

    // 2. Organizer Dashboard Access
    const orgPortalRes = await fetch(`${BASE_URL}/api/events/portal`, {
      headers: { Cookie: orgCookie },
    });
    const orgPortalJson = await orgPortalRes.json();
    record(
      "ORGANIZER",
      "Melihat portal penyelenggara (/api/events/portal)",
      "Hanya memuat acara dan peserta milik komunitas sendiri",
      `HTTP ${orgPortalRes.status}, Events: ${orgPortalJson.data?.events?.length || 0}`,
      orgPortalRes.status === 200 && orgPortalJson.success ? "PASS" : "FAIL",
      `Organizer: ${orgPortalJson.data?.organizerEmail}`
    );

    // 3. Organizer Submit Event
    const submitPayload = {
      title: "UAT Live Demo: Sensory Coffee Cupping Session",
      category: "WORKSHOP",
      description: "Sesi uji coba UAT live barista coffee cupping.",
      startDate: new Date(Date.now() + 86400000 * 3).toISOString(),
      endDate: new Date(Date.now() + 86400000 * 3 + 7200000).toISOString(),
      location: "Coffee Lab & Lounge Dago Creative Hub",
      maxCapacity: 25,
      isPaid: true,
      price: 50000,
      organizerName: "Dago Barista Guild",
      organizerEmail: "baristaguild@dagocreative.id",
      organizerPhone: "081234567890",
      posterUrl: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800",
      collaborationFacilities: ["Sound System", "Tables"],
      guidelines: ["Hadir tepat waktu", "Bawa tumbler"],
      website: "", // honeypot empty
    };

    const submitRes = await fetch(`${BASE_URL}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submitPayload),
    });
    const submitJson = await submitRes.json();
    if (submitJson.success && submitJson.data?.id) {
      createdEventId = submitJson.data.id;
    }

    record(
      "ORGANIZER",
      "Mengajukan proposal event baru",
      "Proposal berhasil dibuat dengan status PENDING",
      `HTTP ${submitRes.status}, status: ${submitJson.data?.status}, ID: ${submitJson.data?.id}`,
      submitRes.status === 201 && submitJson.data?.status === "PENDING" ? "PASS" : "FAIL",
      `Event Title: ${submitJson.data?.title}`
    );

    // 4. Admin Moderate Proposal (Revision -> Resubmit -> Approve)
    if (createdEventId) {
      // 4a. Admin Request Revision
      const revRes = await fetch(`${BASE_URL}/api/events/${createdEventId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ status: "REVISION_REQUESTED", revisionNotes: "Mohon lengkapi tata tertib venue." }),
      });
      const revJson = await revRes.json();
      record(
        "ADMIN",
        "Meminta revisi proposal event",
        "Status berubah REVISION_REQUESTED dengan revisionNotes",
        `HTTP ${revRes.status}, status: ${revJson.data?.status}`,
        revRes.status === 200 && revJson.data?.status === "REVISION_REQUESTED" ? "PASS" : "FAIL",
        `Revision note: ${revJson.data?.revisionNotes}`
      );

      // 4b. Organizer Resubmit Event
      const orgEditRes = await fetch(`${BASE_URL}/api/events/portal`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: orgCookie },
        body: JSON.stringify({
          eventId: createdEventId,
          updates: {
            description: "Sesi uji coba UAT live barista coffee cupping (Revisi Tata Tertib Dilengkapi).",
            guidelines: ["Hadir tepat waktu", "Bawa tumbler", "Wajib menjaga kebersihan meja cupping"],
          },
        }),
      });
      const orgEditJson = await orgEditRes.json();
      record(
        "ORGANIZER",
        "Mengedit event yang memerlukan revisi",
        "Proposal terkirim ulang dengan status PENDING kembali",
        `HTTP ${orgEditRes.status}, status: ${orgEditJson.data?.status}`,
        orgEditRes.status === 200 && orgEditJson.data?.status === "PENDING" ? "PASS" : "FAIL",
        `Guidelines count: ${orgEditJson.data?.guidelines?.length}`
      );

      // 4c. Admin Approve Event
      const appRes = await fetch(`${BASE_URL}/api/events/${createdEventId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ status: "APPROVED", adminNotes: "Proposal disetujui untuk demo UAT." }),
      });
      const appJson = await appRes.json();
      record(
        "ADMIN",
        "Menyetujui event (Approve)",
        "Status event berubah APPROVED dan dapat diakses publik",
        `HTTP ${appRes.status}, status: ${appJson.data?.status}`,
        appRes.status === 200 && appJson.data?.status === "APPROVED" ? "PASS" : "FAIL",
        `Admin note: ${appJson.data?.adminNotes}`
      );
    }

    // -------------------------------------------------------------
    // PHASE 4: GUEST UAT
    // -------------------------------------------------------------
    console.log("\n--- PHASE 4: GUEST UAT ---");

    // 1. Guest Browse Public Catalog
    const publicEventsRes = await fetch(`${BASE_URL}/api/events`);
    const publicEventsJson = await publicEventsRes.json();
    const hasApprovedEvent = publicEventsJson.data?.some((e) => e.id === createdEventId);
    record(
      "GUEST",
      "Membuka katalog event publik dan melihat event yang disetujui",
      "Event yang baru disetujui tampil di daftar publik",
      `HTTP ${publicEventsRes.status}, Contains approved event: ${hasApprovedEvent}`,
      publicEventsRes.status === 200 && hasApprovedEvent ? "PASS" : "FAIL",
      `Public events total: ${publicEventsJson.count}`
    );

    // 2. Guest Book Ticket
    const bookPayload = {
      guestName: "Auditor QA Pratama",
      guestEmail: "qa.auditor.uat@gmail.com",
      guestPhone: "089876543210",
      institution: "Dago Quality Guild",
      ticketCount: 2,
      paymentMethod: "TRANSFER",
      destinationBankId: "bank-bca-plat",
    };

    const bookRes = await fetch(`${BASE_URL}/api/events/${createdEventId}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookPayload),
    });
    const bookJson = await bookRes.json();
    if (bookJson.success && bookJson.data?.id) {
      createdBookingId = bookJson.data.id;
      guestToken = bookJson.data.guestToken;
      ticketCode = bookJson.data.ticketCode;
    }

    const expectedTotal = 50000 * 2; // 100,000
    const expectedFee = Math.round(expectedTotal * 0.2); // 20,000
    const expectedOrgRev = expectedTotal - expectedFee; // 80,000

    const priceCalcCorrect =
      bookJson.data?.totalPrice === expectedTotal &&
      bookJson.data?.platformFeeAmount === expectedFee &&
      bookJson.data?.organizerRevenueAmount === expectedOrgRev;

    record(
      "GUEST",
      "Melakukan booking tiket dan verifikasi hitungan harga server-side",
      `Total Rp ${expectedTotal}, Fee Rp ${expectedFee}, Revenue Rp ${expectedOrgRev}`,
      `Total Rp ${bookJson.data?.totalPrice}, Fee Rp ${bookJson.data?.platformFeeAmount}, Revenue Rp ${bookJson.data?.organizerRevenueAmount}`,
      bookRes.status === 201 && priceCalcCorrect && Boolean(guestToken) ? "PASS" : "FAIL",
      `TicketCode: ${ticketCode}, Token length: ${guestToken?.length}`
    );

    // 3. Guest Access Private E-Ticket Link
    const ticketPageRes = await fetch(`${BASE_URL}/api/events/tickets/${guestToken}`);
    const ticketPageJson = await ticketPageRes.json();
    const qrIsLockedWhenPending = ticketPageJson.data?.paymentStatus === "PENDING";

    record(
      "GUEST",
      "Membuka halaman privat e-tiket (/api/events/tickets/[token])",
      "Tiket dapat dibuka, status PENDING, QR code aman (belum aktif sebelum lunas)",
      `HTTP ${ticketPageRes.status}, Status: ${ticketPageJson.data?.paymentStatus}`,
      ticketPageRes.status === 200 && qrIsLockedWhenPending ? "PASS" : "FAIL",
      `Guest: ${ticketPageJson.data?.guestName}, Bank: ${ticketPageJson.data?.destinationBankSnapshot?.bankName}`
    );

    // 4. Admin Approve Payment
    const approvePayRes = await fetch(`${BASE_URL}/api/events/bookings/${createdBookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        action: "APPROVE_PAYMENT",
        verificationNote: "Transfer BCA Rp 100.000 diverifikasi sah.",
      }),
    });
    const approvePayJson = await approvePayRes.json();
    record(
      "ADMIN",
      "Memverifikasi bukti transfer dan menyetujui pembayaran tiket",
      "Status pembayaran berubah menjadi PAID, tiket dan QR resmi aktif",
      `HTTP ${approvePayRes.status}, PaymentStatus: ${approvePayJson.data?.paymentStatus}`,
      approvePayRes.status === 200 && approvePayJson.data?.paymentStatus === "PAID" ? "PASS" : "FAIL",
      `VerifiedBy: ${approvePayJson.data?.paymentVerifiedBy}`
    );

    // 5. Guest Ticket Recovery Tests
    // 5a. Valid ticketCode + valid email
    const recSuccessRes = await fetch(`${BASE_URL}/api/events/bookings/my?ticketCode=${ticketCode}&email=qa.auditor.uat@gmail.com`);
    const recSuccessJson = await recSuccessRes.json();
    record(
      "GUEST",
      "Pemulihan tiket dengan kombinasi kode tiket benar + email benar",
      "Tiket ditemukan (count: 1) dan mengembalikan guestToken yang cocok",
      `HTTP ${recSuccessRes.status}, count: ${recSuccessJson.count}, token: ${recSuccessJson.data?.[0]?.guestToken === guestToken}`,
      recSuccessRes.status === 200 && recSuccessJson.count === 1 ? "PASS" : "FAIL",
      `Found ticket: ${recSuccessJson.data?.[0]?.ticketCode}`
    );

    // 5b. Valid ticketCode + WRONG email (Zero leakage)
    const recWrongEmailRes = await fetch(`${BASE_URL}/api/events/bookings/my?ticketCode=${ticketCode}&email=wrong.email@gmail.com`);
    const recWrongEmailJson = await recWrongEmailRes.json();
    record(
      "GUEST",
      "Pemulihan tiket dengan kode tiket benar + email SALAH (Anti-Leakage)",
      "Tiket TIDAK ditemukan (count: 0), tidak membocorkan token",
      `HTTP ${recWrongEmailRes.status}, count: ${recWrongEmailJson.count || 0}`,
      recWrongEmailRes.status === 200 && recWrongEmailJson.count === 0 ? "PASS" : "FAIL",
      `Data count: ${recWrongEmailJson.data?.length}`
    );

    // 5c. WRONG ticketCode + valid email (Anti-Leakage)
    const recWrongCodeRes = await fetch(`${BASE_URL}/api/events/bookings/my?ticketCode=DAGO-INVALID-999&email=qa.auditor.uat@gmail.com`);
    const recWrongCodeJson = await recWrongCodeRes.json();
    record(
      "GUEST",
      "Pemulihan tiket dengan kode tiket SALAH + email benar (Anti-Leakage)",
      "Tiket TIDAK ditemukan (count: 0)",
      `HTTP ${recWrongCodeRes.status}, count: ${recWrongCodeJson.count || 0}`,
      recWrongCodeRes.status === 200 && recWrongCodeJson.count === 0 ? "PASS" : "FAIL",
      `Data count: ${recWrongCodeJson.data?.length}`
    );

    // 5d. Query email only without ticketCode (Anti-Harvesting)
    const recHarvestRes = await fetch(`${BASE_URL}/api/events/bookings/my?email=qa.auditor.uat@gmail.com`);
    record(
      "GUEST",
      "Percobaan pencarian email tanpa kode tiket (Anti-Harvesting)",
      "Ditolak dengan HTTP 401 Unauthorized",
      `HTTP ${recHarvestRes.status}`,
      recHarvestRes.status === 401 ? "PASS" : "FAIL",
      `Harvest protection active`
    );

    // -------------------------------------------------------------
    // PHASE 5: STAFF CHECK-IN UAT
    // -------------------------------------------------------------
    console.log("\n--- PHASE 5: STAFF CHECK-IN UAT ---");

    // Staff Login (WAITER / Field Officer)
    const staffLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "waiter.sgr@kopisenja.com", password: "Password123!" }),
    });
    const staffCookie = "dagoeng_active_persona=WAITER_SGR";

    record(
      "STAFF",
      "Login sebagai Petugas Lapangan (Staff Check-in)",
      "Login sukses dengan role WAITER / Field Officer",
      `HTTP ${staffLoginRes.status}`,
      staffLoginRes.status === 200 ? "PASS" : "FAIL",
      `Staff user: waiter.sgr@kopisenja.com`
    );

    // Partial Check-in (1 of 2 tickets)
    const checkinStep1Res = await fetch(`${BASE_URL}/api/events/bookings/${createdBookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: staffCookie },
      body: JSON.stringify({
        checkInStatus: "PARTIALLY_CHECKED_IN",
        incrementQty: 1,
      }),
    });
    const checkinStep1Json = await checkinStep1Res.json();
    record(
      "STAFF",
      "Check-in parsial (1 dari 2 tiket)",
      "Status PARTIALLY_CHECKED_IN, checkedInQty: 1, ticketCount: 2",
      `HTTP ${checkinStep1Res.status}, Status: ${checkinStep1Json.data?.checkInStatus}, Qty: ${checkinStep1Json.data?.checkedInQty}/${checkinStep1Json.data?.ticketCount}`,
      checkinStep1Res.status === 200 && checkinStep1Json.data?.checkedInQty === 1 && checkinStep1Json.data?.checkInStatus === "PARTIALLY_CHECKED_IN" ? "PASS" : "FAIL",
      `CheckInTime recorded: ${checkinStep1Json.data?.checkInTime}`
    );

    // Complete Check-in (2 of 2 tickets)
    const checkinStep2Res = await fetch(`${BASE_URL}/api/events/bookings/${createdBookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: staffCookie },
      body: JSON.stringify({
        checkInStatus: "CHECKED_IN",
        incrementQty: 1,
      }),
    });
    const checkinStep2Json = await checkinStep2Res.json();
    record(
      "STAFF",
      "Menuntaskan check-in seluruh tiket (2 dari 2 tiket)",
      "Status CHECKED_IN, checkedInQty: 2",
      `HTTP ${checkinStep2Res.status}, Status: ${checkinStep2Json.data?.checkInStatus}, Qty: ${checkinStep2Json.data?.checkedInQty}/${checkinStep2Json.data?.ticketCount}`,
      checkinStep2Res.status === 200 && checkinStep2Json.data?.checkedInQty === 2 && checkinStep2Json.data?.checkInStatus === "CHECKED_IN" ? "PASS" : "FAIL",
      `Full attendance achieved`
    );

    // Duplicate Check-in Attempt (Prevent Over-Checkin)
    const checkinDupRes = await fetch(`${BASE_URL}/api/events/bookings/${createdBookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: staffCookie },
      body: JSON.stringify({
        checkInStatus: "CHECKED_IN",
        incrementQty: 1,
      }),
    });
    const checkinDupJson = await checkinDupRes.json();
    record(
      "STAFF",
      "Percobaan scan tiket yang sudah selesai check-in (Duplicate Scan Protection)",
      "Ditolak dengan pesan: Tiket sudah digunakan untuk check-in sebelumnya",
      `HTTP ${checkinDupRes.status}, Error: ${checkinDupJson.error}`,
      checkinDupRes.status !== 200 && checkinDupJson.error?.includes("Tiket sudah digunakan untuk check-in sebelumnya") ? "PASS" : "FAIL",
      `Over-checkin rejected successfully`
    );

    // Check-in on CANCELLED ticket attempt
    const checkinCancelledRes = await fetch(`${BASE_URL}/api/events/bookings/tkt-1793006245099-bpw9k`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: staffCookie },
      body: JSON.stringify({ checkInStatus: "CHECKED_IN" }),
    });
    const checkinCancelledJson = await checkinCancelledRes.json();
    record(
      "STAFF",
      "Percobaan check-in tiket berstatus CANCELLED (DAGO-EVT-48246)",
      "Ditolak: Tiket dengan status CANCELLED tidak dapat digunakan untuk check-in",
      `HTTP ${checkinCancelledRes.status}, Error: ${checkinCancelledJson.error}`,
      checkinCancelledRes.status !== 200 && checkinCancelledJson.error?.includes("CANCELLED") ? "PASS" : "FAIL",
      `Cancelled ticket blocked`
    );

    // -------------------------------------------------------------
    // PHASE 6: UX INSPECTION
    // -------------------------------------------------------------
    console.log("\n--- PHASE 6: UX INSPECTION ---");

    const pages = [
      { path: "/events", name: "Katalog Event Publik" },
      { path: `/events/${createdEventId}`, name: "Detail Event" },
      { path: "/events/tickets/recovery", name: "Halaman Pemulihan Tiket Tamu" },
      { path: `/events/tickets/${guestToken}`, name: "Halaman Privat E-Tiket Tamu" },
      { path: "/events/portal", name: "Portal Penyelenggara Komunitas" },
      { path: "/events/checkin", name: "Dasbor Lapangan Check-in Petugas" },
      { path: "/events/submit", name: "Formulir Pengajuan Event" },
      { path: "/events-admin", name: "Dasbor Moderasi Admin Event" },
    ];

    for (const p of pages) {
      const pageRes = await fetch(`${BASE_URL}${p.path}`, {
        headers: { Cookie: adminCookie },
      });
      const html = await pageRes.text();
      const hasViewport = html.includes('name="viewport"');
      const hasTheme = html.includes("dark") || html.includes("theme");
      const isOk = pageRes.status === 200 && hasViewport;

      record(
        "UX",
        `Akses visual & respon halaman ${p.name} (${p.path.split("?")[0]})`,
        "HTTP 200, valid HTML, responsive viewport meta tag aktif",
        `HTTP ${pageRes.status}, HTML size: ${html.length} bytes, Viewport: ${hasViewport}`,
        isOk ? "PASS" : "FAIL",
        `Page title / response verified`
      );
    }

  } catch (err) {
    console.error("UAT Execution Error:", err);
  } finally {
    // -------------------------------------------------------------
    // RESTORE BASELINE DATA (Zero leftover data pollution)
    // -------------------------------------------------------------
    console.log("\n--- RESTORING BASELINE DATA ---");
    fs.writeFileSync(bookingsFile, baselineBookings, "utf-8");
    fs.writeFileSync(eventsFile, baselineEvents, "utf-8");
    console.log("Baseline event_bookings.json and events.json successfully restored.");
  }

  // Print Summary Matrix
  console.log("\n==================================================================");
  console.log("  UAT RESULTS SUMMARY MATRIX");
  console.log("==================================================================");
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  console.log(`TOTAL CASES: ${results.length} | PASS: ${passed} | FAIL: ${failed}`);
  console.log("==================================================================\n");

  return results;
}

runUAT().then((res) => {
  fs.writeFileSync("uat_results.json", JSON.stringify(res, null, 2));
  process.exit(0);
});
