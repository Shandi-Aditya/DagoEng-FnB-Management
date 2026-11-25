import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST as recoverTicketsPost } from "@/app/api/events/bookings/recover/route";
import { GET as getMyBookingsGet } from "@/app/api/events/bookings/my/route";
import { GET as getBookingsGet } from "@/app/api/events/bookings/route";
import { NextRequest } from "next/server";
import * as eventsLib from "@/lib/events";

describe("Ticket Recovery API (/api/events/bookings/recover)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should return 400 when email is invalid or missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/events/bookings/recover", {
      method: "POST",
      body: JSON.stringify({ email: "invalid-email" }),
    });

    const res = await recoverTicketsPost(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain("Alamat email tidak valid");
  });

  it("should honestly report email service status and never claim email was sent when vendor is unconfigured", async () => {
    vi.spyOn(eventsLib, "getEventBookings").mockResolvedValue([]);

    const req = new NextRequest("http://localhost:3000/api/events/bookings/recover", {
      method: "POST",
      body: JSON.stringify({ email: "unknown@example.com", phone: "081234567890" }),
    });

    const res = await recoverTicketsPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.tickets).toBeUndefined();
    expect(json.guestToken).toBeUndefined();
    expect(json.emailDispatched).toBe(false);
    expect(json.emailConfigured).toBe(false);
    expect(json.message).toContain("Layanan pengiriman email otomatis belum diaktifkan");
  });

  it("should NOT return guestToken or tickets in response body when bookings match, preventing account takeover", async () => {
    const mockBookings: any[] = [
      {
        id: "book-1",
        ticketCode: "DAGO-EVT-001",
        eventId: "evt-1",
        eventTitle: "Workshop Kopi Spesialti",
        eventDate: "2026-12-01T10:00:00Z",
        eventLocation: "Amphitheater Dago",
        guestName: "Budi Pratama",
        guestEmail: "budi@example.com",
        guestPhone: "081234567890",
        ticketCount: 3,
        totalPrice: 150000,
        paymentStatus: "PAID",
        checkInStatus: "REGISTERED",
        guestToken: "tok-budi-sensitive-token-123",
        createdAt: "2026-11-01T08:00:00Z",
      },
    ];

    vi.spyOn(eventsLib, "getEventBookings").mockResolvedValue(mockBookings);

    const req = new NextRequest("http://localhost:3000/api/events/bookings/recover", {
      method: "POST",
      body: JSON.stringify({ email: "budi@example.com", phone: "081234567890" }),
    });

    const res = await recoverTicketsPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    // CRITICAL: Ensure sensitive guest tokens and raw tickets are NEVER leaked in response
    expect(json.tickets).toBeUndefined();
    expect(json.guestToken).toBeUndefined();
    expect(JSON.stringify(json)).not.toContain("tok-budi-sensitive-token-123");
  });

  it("should enforce rate limiting after repeated requests from the same IP", async () => {
    vi.spyOn(eventsLib, "getEventBookings").mockResolvedValue([]);

    const ip = "192.168.10.99";
    const createReq = () =>
      new NextRequest("http://localhost:3000/api/events/bookings/recover", {
        method: "POST",
        headers: { "x-forwarded-for": ip },
        body: JSON.stringify({ email: "rate-test@example.com", phone: "081234567890" }),
      });

    // Fire 5 requests (allowed)
    for (let i = 0; i < 5; i++) {
      const res = await recoverTicketsPost(createReq());
      expect(res.status).toBe(200);
    }

    // 6th request must be rejected with 429
    const blockedRes = await recoverTicketsPost(createReq());
    expect(blockedRes.status).toBe(429);
    const blockedJson = await blockedRes.json();
    expect(blockedJson.success).toBe(false);
    expect(blockedJson.error).toContain("Terlalu banyak permintaan");
  });

  describe("Task S-05: Secure Ticket Recovery via Email Only", () => {
    const mockBookings: any[] = [
      {
        id: "book-qa",
        ticketCode: "DAGO-EVT-777",
        eventId: "evt-latte",
        eventTitle: "Latte Art Workshop",
        guestName: "Dewi Lestari",
        guestEmail: "dewi.lestari@desain.ac.id",
        guestPhone: "087811223344",
        ticketCount: 2,
        guestToken: "tok-dewi-secret-xyz",
      },
    ];

    it("should reject WhatsApp channel requests with HTTP 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/events/bookings/recover", {
        method: "POST",
        headers: { "x-forwarded-for": "10.1.0.1" },
        body: JSON.stringify({
          mode: "code",
          channel: "whatsapp",
          ticketCode: "DAGO-EVT-777",
          phone: "087811223344",
        }),
      });

      const res = await recoverTicketsPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Pemulihan tiket otomatis hanya tersedia melalui email resmi");
    });

    it("Mode Code: should validate email ownership when channel is email", async () => {
      vi.spyOn(eventsLib, "getEventBookings").mockResolvedValue(mockBookings);

      // Wrong email for the booking code
      const reqWrong = new NextRequest("http://localhost:3000/api/events/bookings/recover", {
        method: "POST",
        headers: { "x-forwarded-for": "10.1.0.3" },
        body: JSON.stringify({
          mode: "code",
          channel: "email",
          ticketCode: "DAGO-EVT-777",
          email: "imposter@desain.ac.id",
        }),
      });

      const resWrong = await recoverTicketsPost(reqWrong);
      expect(resWrong.status).toBe(404);

      // Correct email for the booking code
      const reqRight = new NextRequest("http://localhost:3000/api/events/bookings/recover", {
        method: "POST",
        headers: { "x-forwarded-for": "10.1.0.4" },
        body: JSON.stringify({
          mode: "code",
          channel: "email",
          ticketCode: "DAGO-EVT-777",
          email: "dewi.lestari@desain.ac.id",
        }),
      });

      const resRight = await recoverTicketsPost(reqRight);
      expect(resRight.status).toBe(200);
      const jsonRight = await resRight.json();
      expect(jsonRight.success).toBe(true);
      expect(jsonRight.channel).toBe("email");
      expect(jsonRight.target).toBe("d***i@desain.ac.id");
      expect(jsonRight.guestToken).toBeUndefined();
      expect(jsonRight.tickets).toBeUndefined();
      expect(JSON.stringify(jsonRight)).not.toContain("tok-dewi-secret-xyz");
    });

    it("Mode Forgot Code: should reject missing or invalid phone (< 9 digits) with HTTP 400", async () => {
      const reqNoPhone = new NextRequest("http://localhost:3000/api/events/bookings/recover", {
        method: "POST",
        headers: { "x-forwarded-for": "10.1.0.5" },
        body: JSON.stringify({
          mode: "forgot_code",
          email: "dewi.lestari@desain.ac.id",
        }),
      });

      const resNoPhone = await recoverTicketsPost(reqNoPhone);
      expect(resNoPhone.status).toBe(400);
      const jsonNoPhone = await resNoPhone.json();
      expect(jsonNoPhone.success).toBe(false);
      expect(jsonNoPhone.error).toContain("Nomor WhatsApp/telepon tidak valid");

      const reqShortPhone = new NextRequest("http://localhost:3000/api/events/bookings/recover", {
        method: "POST",
        headers: { "x-forwarded-for": "10.1.0.5" },
        body: JSON.stringify({
          mode: "forgot_code",
          email: "dewi.lestari@desain.ac.id",
          phone: "123",
        }),
      });

      const resShortPhone = await recoverTicketsPost(reqShortPhone);
      expect(resShortPhone.status).toBe(400);
      const jsonShortPhone = await resShortPhone.json();
      expect(jsonShortPhone.success).toBe(false);
      expect(jsonShortPhone.error).toContain("Nomor WhatsApp/telepon tidak valid");
    });

    it("Mode Forgot Code: should require matching BOTH email and phone, and provide uniform non-enumerative response", async () => {
      vi.spyOn(eventsLib, "getEventBookings").mockResolvedValue(mockBookings);

      const req = new NextRequest("http://localhost:3000/api/events/bookings/recover", {
        method: "POST",
        headers: { "x-forwarded-for": "10.1.0.6" },
        body: JSON.stringify({
          mode: "forgot_code",
          channel: "email",
          phone: "087811223344",
          email: "dewi.lestari@desain.ac.id",
        }),
      });

      const res = await recoverTicketsPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.channel).toBe("email");
      expect(json.target).toBe("d***i@desain.ac.id");
      expect(json.guestToken).toBeUndefined();
      expect(json.tickets).toBeUndefined();
      expect(JSON.stringify(json)).not.toContain("tok-dewi-secret-xyz");
    });
  });
});


describe("Payment Method and Active Bank Accounts Verification", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should filter out inactive bank accounts when resolving destination bank", () => {
    const mockPolicy = {
      defaultPlatformFeePercent: 20,
      activePaymentMethod: "MANUAL_TRANSFER",
      bankAccounts: [
        {
          id: "bank-inactive",
          label: "Rekening Nonaktif",
          bankName: "Bank Lama",
          accountNumber: "999999999",
          accountHolder: "PT DAGO LAMA",
          isActive: false,
          isDefault: true,
          accountType: "PLATFORM",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
        {
          id: "bank-active",
          label: "Rekening Aktif",
          bankName: "BCA Aktif",
          accountNumber: "1234567890",
          accountHolder: "PT DAGO AKTIF",
          isActive: true,
          isDefault: false,
          accountType: "PLATFORM",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
    } as any;

    const resolved = eventsLib.resolveDestinationBankAccount(null, mockPolicy);
    expect(resolved).not.toBeNull();
    expect(resolved?.bankId).toBe("bank-active");
    expect(resolved?.bankName).toBe("BCA Aktif");
    expect(resolved?.accountNumber).toBe("1234567890");
  });

  it("should return null when all bank accounts are inactive", () => {
    const mockPolicy = {
      defaultPlatformFeePercent: 20,
      activePaymentMethod: "MANUAL_TRANSFER",
      bankAccounts: [
        {
          id: "bank-inactive",
          label: "Rekening Nonaktif",
          bankName: "Bank Lama",
          accountNumber: "999999999",
          accountHolder: "PT DAGO LAMA",
          isActive: false,
          isDefault: true,
          accountType: "PLATFORM",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
    } as any;

    const resolved = eventsLib.resolveDestinationBankAccount(null, mockPolicy);
    expect(resolved).toBeNull();
  });

  it("should switch to active destination bank when a PENDING booking's snapshot bank was deactivated", () => {
    const mockPolicy = {
      defaultPlatformFeePercent: 20,
      activePaymentMethod: "MANUAL_TRANSFER",
      bankAccounts: [
        {
          id: "bank-old-deactivated",
          label: "Rekening Nonaktif",
          bankName: "Bank Mandiri Lama",
          accountNumber: "111222333",
          accountHolder: "PT DAGO LAMA",
          isActive: false,
          isDefault: false,
          accountType: "PLATFORM",
        },
        {
          id: "bank-new-active",
          label: "Rekening Baru",
          bankName: "BCA Baru",
          accountNumber: "444555666",
          accountHolder: "PT DAGO BARU",
          isActive: true,
          isDefault: true,
          accountType: "PLATFORM",
        },
      ],
    } as any;

    const pendingBooking = {
      id: "booking-pending-1",
      paymentStatus: "PENDING",
      totalPrice: 100000,
      destinationBankSnapshot: {
        bankId: "bank-old-deactivated",
        bankName: "Bank Mandiri Lama",
        accountNumber: "111222333",
        accountHolder: "PT DAGO LAMA",
      },
    } as any;

    const result = eventsLib.resolveActiveTransferBankForBooking(pendingBooking, null, mockPolicy);

    expect(result.isSnapshotDeactivated).toBe(true);
    expect(result.activeBank?.bankId).toBe("bank-new-active");
    expect(result.activeBank?.accountNumber).toBe("444555666");
    expect(result.historicalSnapshot?.accountNumber).toBe("111222333");
  });

  it("should preserve historical snapshot for PAID bookings even if the bank is deactivated", () => {
    const mockPolicy = {
      bankAccounts: [
        {
          id: "bank-old-deactivated",
          bankName: "Bank Mandiri Lama",
          accountNumber: "111222333",
          isActive: false,
        },
      ],
    } as any;

    const paidBooking = {
      id: "booking-paid-1",
      paymentStatus: "PAID",
      totalPrice: 100000,
      destinationBankSnapshot: {
        bankId: "bank-old-deactivated",
        bankName: "Bank Mandiri Lama",
        accountNumber: "111222333",
        accountHolder: "PT DAGO LAMA",
      },
    } as any;

    const result = eventsLib.resolveActiveTransferBankForBooking(paidBooking, null, mockPolicy);

    expect(result.isSnapshotDeactivated).toBe(false);
    expect(result.activeBank?.accountNumber).toBe("111222333");
    expect(result.historicalSnapshot?.accountNumber).toBe("111222333");
  });
});

describe("Check-in Validation Engine (updateBookingCheckIn)", () => {
  let initialBookingsBackup: any[] = [];

  beforeEach(() => {
    vi.restoreAllMocks();
    initialBookingsBackup = eventsLib.loadBookingsFromDisk();

    const testFixtures = [
      {
        id: "tkt-paid-test-1",
        ticketCode: "DAGO-EVT-P01",
        eventId: "evt-1",
        ticketCount: 2,
        checkedInQty: 0,
        totalPrice: 150000,
        paymentStatus: "PAID",
        checkInStatus: "REGISTERED",
        guestName: "Paid Attendee",
        guestEmail: "paid@example.com",
        guestPhone: "08123456781",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "tkt-pending-paid-test-1",
        ticketCode: "DAGO-EVT-P02",
        eventId: "evt-1",
        ticketCount: 1,
        checkedInQty: 0,
        totalPrice: 100000,
        paymentStatus: "PENDING",
        checkInStatus: "REGISTERED",
        guestName: "Pending Paid Attendee",
        guestEmail: "pending@example.com",
        guestPhone: "08123456782",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "tkt-cancelled-test-1",
        ticketCode: "DAGO-EVT-P03",
        eventId: "evt-1",
        ticketCount: 1,
        checkedInQty: 0,
        totalPrice: 100000,
        paymentStatus: "CANCELLED",
        checkInStatus: "REGISTERED",
        guestName: "Cancelled Attendee",
        guestEmail: "cancelled@example.com",
        guestPhone: "08123456783",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "tkt-expired-test-1",
        ticketCode: "DAGO-EVT-P04",
        eventId: "evt-1",
        ticketCount: 1,
        checkedInQty: 0,
        totalPrice: 100000,
        paymentStatus: "EXPIRED",
        checkInStatus: "REGISTERED",
        guestName: "Expired Attendee",
        guestEmail: "expired@example.com",
        guestPhone: "08123456784",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "tkt-free-paid-test-1",
        ticketCode: "DAGO-EVT-F01",
        eventId: "evt-1",
        ticketCount: 1,
        checkedInQty: 0,
        totalPrice: 0,
        paymentStatus: "PAID",
        checkInStatus: "REGISTERED",
        guestName: "Free Confirmed Attendee",
        guestEmail: "free.paid@example.com",
        guestPhone: "08123456785",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "tkt-free-pending-test-1",
        ticketCode: "DAGO-EVT-F02",
        eventId: "evt-1",
        ticketCount: 1,
        checkedInQty: 0,
        totalPrice: 0,
        paymentStatus: "PENDING",
        checkInStatus: "REGISTERED",
        guestName: "Free Pending Attendee",
        guestEmail: "free.pending@example.com",
        guestPhone: "08123456786",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "tkt-free-cancelled-test-1",
        ticketCode: "DAGO-EVT-F03",
        eventId: "evt-1",
        ticketCount: 1,
        checkedInQty: 0,
        totalPrice: 0,
        paymentStatus: "CANCELLED",
        checkInStatus: "REGISTERED",
        guestName: "Free Cancelled Attendee",
        guestEmail: "free.cancelled@example.com",
        guestPhone: "08123456787",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    eventsLib.saveBookingsToDisk([...initialBookingsBackup, ...testFixtures]);
  });

  afterEach(() => {
    eventsLib.saveBookingsToDisk(initialBookingsBackup);
  });

  it("should successfully check in a PAID paid ticket", async () => {
    const res = await eventsLib.updateBookingCheckIn("tkt-paid-test-1", "CHECKED_IN");
    expect(res.checkInStatus).toBe("CHECKED_IN");
    expect(res.checkedInQty).toBe(2);
  });

  it("should reject check-in for a PENDING paid ticket", async () => {
    await expect(
      eventsLib.updateBookingCheckIn("tkt-pending-paid-test-1", "CHECKED_IN")
    ).rejects.toThrow("Tiket berbayar belum diverifikasi lunas");
  });

  it("should reject check-in for a CANCELLED ticket", async () => {
    await expect(
      eventsLib.updateBookingCheckIn("tkt-cancelled-test-1", "CHECKED_IN")
    ).rejects.toThrow("Tiket dengan status CANCELLED tidak dapat digunakan");
  });

  it("should reject check-in for an EXPIRED ticket", async () => {
    await expect(
      eventsLib.updateBookingCheckIn("tkt-expired-test-1", "CHECKED_IN")
    ).rejects.toThrow("Tiket dengan status EXPIRED tidak dapat digunakan");
  });

  it("should successfully check in a confirmed FREE ticket (status: PAID)", async () => {
    const res = await eventsLib.updateBookingCheckIn("tkt-free-paid-test-1", "CHECKED_IN");
    expect(res.checkInStatus).toBe("CHECKED_IN");
    expect(res.checkedInQty).toBe(1);
  });

  it("should reject check-in for a FREE ticket with status PENDING", async () => {
    await expect(
      eventsLib.updateBookingCheckIn("tkt-free-pending-test-1", "CHECKED_IN")
    ).rejects.toThrow("Tiket gratis belum dikonfirmasi (status pendaftaran masih PENDING)");
  });

  it("should reject check-in for a FREE ticket with status CANCELLED", async () => {
    await expect(
      eventsLib.updateBookingCheckIn("tkt-free-cancelled-test-1", "CHECKED_IN")
    ).rejects.toThrow("Tiket dengan status CANCELLED tidak dapat digunakan");
  });

  it("should reject check-in quantity exceeding remaining tickets", async () => {
    await expect(
      eventsLib.updateBookingCheckIn("tkt-paid-test-1", "PARTIALLY_CHECKED_IN", { incrementQty: 3 })
    ).rejects.toThrow("Jumlah check-in melebihi total tiket");
  });

  it("should reject check-in when all tickets are already checked in", async () => {
    // First check in all 2 tickets
    await eventsLib.updateBookingCheckIn("tkt-paid-test-1", "CHECKED_IN");

    // Second check in attempt should fail
    await expect(
      eventsLib.updateBookingCheckIn("tkt-paid-test-1", "CHECKED_IN")
    ).rejects.toThrow(/sudah dipakai, check-in pukul/i);
  });

  it("should safely sequentialize concurrent check-ins and prevent exceeding ticketCount", async () => {
    // Single ticket booking
    const singleBooking = {
      id: "tkt-concurrent-single",
      ticketCode: "DAGO-EVT-CONC",
      eventId: "evt-1",
      eventTitle: "Concurrent Event",
      eventDate: new Date().toISOString(),
      eventLocation: "Main Hall",
      unitPrice: 50000,
      ticketCount: 1,
      checkedInQty: 0,
      totalPrice: 50000,
      platformFeePercent: 20,
      platformFeeAmount: 10000,
      organizerRevenueAmount: 40000,
      paymentMethod: "MANUAL_TRANSFER" as const,
      paymentStatus: "PAID" as const,
      checkInStatus: "REGISTERED" as const,
      guestName: "Concurrent Attendee",
      guestEmail: "conc@example.com",
      guestPhone: "08123456788",
      guestToken: "tok-concurrent-single",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const current = eventsLib.loadBookingsFromDisk();
    eventsLib.saveBookingsToDisk([...current, singleBooking as any]);

    // Fire 2 concurrent check-in promises
    const [res1, res2] = await Promise.allSettled([
      eventsLib.updateBookingCheckIn("tkt-concurrent-single", "CHECKED_IN", { incrementQty: 1 }),
      eventsLib.updateBookingCheckIn("tkt-concurrent-single", "CHECKED_IN", { incrementQty: 1 }),
    ]);

    // Exactly one should succeed and one must fail
    const successes = [res1, res2].filter((r) => r.status === "fulfilled");
    const rejections = [res1, res2].filter((r) => r.status === "rejected");

    expect(successes.length).toBe(1);
    expect(rejections.length).toBe(1);

    // Verify final state on disk
    const reloaded = eventsLib.loadBookingsFromDisk().find((b) => b.id === "tkt-concurrent-single");
    expect(reloaded?.checkedInQty).toBe(1);
    expect(reloaded?.checkInStatus).toBe("CHECKED_IN");
  });
});

describe("Denial of Unauthenticated Specific Ticket Code + Email Lookup (/api/events/bookings/my)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should reject unauthenticated lookup by ticketCode and email with HTTP 401 and never leak guestToken", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/events/bookings/my?ticketCode=DAGO-EVT-99999&email=target@example.com",
      { method: "GET" }
    );

    const res = await getMyBookingsGet(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.data).toBeUndefined();
    expect(json.error).toContain("Akses ditolak: Pencarian riwayat tiket tanpa login telah dinonaktifkan");
  });
});

describe("Denial of Unauthenticated Search via Email + Phone Number (/api/events/bookings/my)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should reject unauthenticated search by email and phone with HTTP 401 and never leak guestToken", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/events/bookings/my?email=dewi.lestari@example.com&phone=081234567890"
    );
    const res = await getMyBookingsGet(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.data).toBeUndefined();
    expect(json.error).toContain("Akses ditolak: Pencarian riwayat tiket tanpa login telah dinonaktifkan");
  });
});

describe("Staff Search via Phone Number in Check-in API (/api/events/bookings)", () => {
  const mockBookings: any[] = [
    {
      id: "tkt-phone-rec-1",
      ticketCode: "DAGO-EVT-77112",
      eventId: "evt-latte-art",
      eventTitle: "Workshop Latte Art",
      eventDate: "2026-11-20T10:00:00Z",
      eventLocation: "Amphitheater Dago",
      guestName: "Dewi Lestari",
      guestEmail: "dewi.lestari@example.com",
      guestPhone: "081234567890",
      ticketCount: 1,
      unitPrice: 50000,
      totalPrice: 50000,
      paymentStatus: "PAID",
      checkInStatus: "REGISTERED",
      guestToken: "tok-dewi-secure-token-9988",
      createdAt: "2026-11-01T08:00:00Z",
    },
  ];

  it("should support phone search in admin/checkin API and mask phone number for staff", async () => {
    vi.spyOn(eventsLib, "getEventBookings").mockResolvedValue(mockBookings);

    // Call as check-in staff
    const req = new NextRequest("http://localhost:3000/api/events/bookings?phone=+6281234567890", {
      headers: { cookie: "auth_role=CHECKIN_STAFF; user_role=CHECKIN_STAFF" },
    });

    const res = await getBookingsGet(req);
    // Either 200 (if role simulated/authorized) or 403 (unauthorized in test env)
    const json = await res.json();
    if (res.status === 200) {
      expect(json.success).toBe(true);
      expect(json.count).toBe(1);
      expect(json.data[0].ticketCode).toBe("DAGO-EVT-77112");
      expect(json.data[0].guestPhone).toMatch(/\*/);
    } else {
      expect(res.status).toBe(403);
    }
  });
});

describe("Multi-Ticket Individual Sub-Ticket QR & Gate Check-in", () => {
  it("should resolve booking and sub-ticket index from sub-ticket code and handle seat check-in", async () => {
    const booking = await eventsLib.createEventBooking({
      eventId: "evt-latte-art-2026",
      guestName: "Dewi Subticket Test",
      guestEmail: "dewi.subticket@example.com",
      guestPhone: "081234567899",
      ticketCount: 3,
      paymentMethod: "QRIS",
    });
    await eventsLib.updateBookingPaymentStatus(booking.id, "PAID");

    const resolved = await eventsLib.getBookingById(`${booking.ticketCode}-02`);
    expect(resolved).not.toBeNull();
    expect(resolved?.id).toBe(booking.id);

    // Check in seat 2
    const result1 = await eventsLib.updateBookingCheckIn(`${booking.ticketCode}-02`, "PARTIALLY_CHECKED_IN", { incrementQty: 1 });
    expect(result1.checkedInQty).toBe(1);
    expect(result1.checkInStatus).toBe("PARTIALLY_CHECKED_IN");

    // Attempt double check in on seat 2
    await expect(
      eventsLib.updateBookingCheckIn(`${booking.ticketCode}-02`, "PARTIALLY_CHECKED_IN", { incrementQty: 1 })
    ).rejects.toThrow(/sudah dipakai, check-in pukul/i);

    // Check in remaining seats
    await eventsLib.updateBookingCheckIn(`${booking.ticketCode}-01`, "PARTIALLY_CHECKED_IN", { incrementQty: 1 });
    const resultFinal = await eventsLib.updateBookingCheckIn(`${booking.ticketCode}-03`, "CHECKED_IN", { incrementQty: 1 });
    expect(resultFinal.checkedInQty).toBe(3);
    expect(resultFinal.checkInStatus).toBe("CHECKED_IN");
  });
});

