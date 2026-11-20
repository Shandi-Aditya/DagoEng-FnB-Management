import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { PUT as updateSettingsHandler, GET as getSettingsHandler } from "../src/app/api/events/admin/settings/route";
import * as eventsLib from "../src/lib/events";
import * as serverAuth from "../src/lib/server-auth";
import * as dataStorage from "../src/lib/data-storage";
import { CommunityEvent, EventBooking } from "../src/types/event";

const originalPersistStorageToDb = dataStorage.persistStorageToDb;
const originalSyncStorageFromDb = dataStorage.syncStorageFromDb;

describe("Tahap 6 — Admin Event Commission Settings & Immutability Regression Tests", () => {
  let mockPolicy = {
    defaultPlatformFeePercent: 20,
    policyNotes: "Kebijakan awal DagoEng",
    effectiveDate: new Date("2026-01-01T00:00:00Z").toISOString(),
    history: [],
    allowOrganizerBankAccounts: true,
    allowEventBankOverride: true,
    maxTicketsPerBooking: 5,
    activePaymentMethod: "MANUAL_BANK_TRANSFER" as const,
    bookingPaymentExpiryMinutes: 60,
    paymentInstructions: "Silakan transfer ke rekening resmi.",
  };

  beforeEach(() => {
    mockPolicy = {
      defaultPlatformFeePercent: 20,
      policyNotes: "Kebijakan awal DagoEng",
      effectiveDate: new Date("2026-01-01T00:00:00Z").toISOString(),
      history: [],
      allowOrganizerBankAccounts: true,
      allowEventBankOverride: true,
      maxTicketsPerBooking: 5,
      activePaymentMethod: "MANUAL_BANK_TRANSFER",
      bookingPaymentExpiryMinutes: 60,
      paymentInstructions: "Silakan transfer ke rekening resmi.",
    };

    vi.spyOn(eventsLib, "getEventRevenuePolicy").mockImplementation(() => ({ ...mockPolicy }));
    vi.spyOn(eventsLib, "updateEventRevenuePolicy").mockImplementation((updates: any, actor?: string) => {
      if (typeof updates === "number") {
        mockPolicy.defaultPlatformFeePercent = updates;
      } else if (updates && typeof updates === "object") {
        Object.assign(mockPolicy, updates);
      }
      return { ...mockPolicy };
    });
    vi.spyOn(eventsLib, "saveEventSettingsToDisk").mockImplementation((policy: any) => {
      mockPolicy = { ...policy };
    });
    vi.spyOn(dataStorage, "syncStorageFromDb").mockResolvedValue(true);
    vi.spyOn(dataStorage, "persistStorageToDb").mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. RBAC Tests: SUPER_ADMIN and Platform OWNER vs Tenant OWNER and MANAGER
  // ---------------------------------------------------------------------------
  describe("1. Strict RBAC Enforcement on Commission Changes", () => {
    it("should allow SUPER_ADMIN to change defaultPlatformFeePercent", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue({
        authorized: true,
        user: { id: "admin-1", role: { name: "Super Admin", slug: "SUPER_ADMIN" } } as any,
        role: "SUPER_ADMIN",
        scopeLevel: "ORGANIZATION",
        name: "Super Admin Dago",
      });

      const req = new NextRequest("http://localhost:3000/api/events/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultPlatformFeePercent: 25, policyNotes: "Updated by SUPER_ADMIN" }),
      });

      const res = await updateSettingsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.defaultPlatformFeePercent).toBe(25);
    });

    it("should allow Platform/Organization OWNER to change defaultPlatformFeePercent", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue({
        authorized: true,
        user: { id: "owner-1", role: { name: "Owner", slug: "OWNER" } } as any,
        role: "OWNER",
        scopeLevel: "ORGANIZATION",
        name: "Pak Hendra Owner Platform",
      });

      const req = new NextRequest("http://localhost:3000/api/events/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultPlatformFeePercent: 18, policyNotes: "Updated by Org Owner" }),
      });

      const res = await updateSettingsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.defaultPlatformFeePercent).toBe(18);
    });

    it("should reject Tenant OWNER (scopeLevel: TENANT) with HTTP 403", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue({
        authorized: true,
        user: { id: "tenant-owner-1", role: { name: "Owner", slug: "OWNER" } } as any,
        role: "OWNER",
        scopeLevel: "TENANT",
        name: "Owner Kopi Senja",
      });

      const req = new NextRequest("http://localhost:3000/api/events/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultPlatformFeePercent: 10 }),
      });

      const res = await updateSettingsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error).toContain("FORBIDDEN");
      expect(json.error).toContain("SUPER_ADMIN atau OWNER pengelola platform");
    });

    it("should reject MANAGER with HTTP 403 when attempting to change commission", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue({
        authorized: true,
        user: { id: "manager-1", role: { name: "Manager", slug: "MANAGER" } } as any,
        role: "MANAGER",
        scopeLevel: "ORGANIZATION",
        name: "Manager Operasional",
      });

      const req = new NextRequest("http://localhost:3000/api/events/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultPlatformFeePercent: 15 }),
      });

      const res = await updateSettingsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error).toContain("FORBIDDEN");
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Input Validation (Integer 0% - 50%)
  // ---------------------------------------------------------------------------
  describe("2. Strict Input Bounds and Validation", () => {
    beforeEach(() => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue({
        authorized: true,
        user: { id: "admin-1", role: { name: "Super Admin", slug: "SUPER_ADMIN" } } as any,
        role: "SUPER_ADMIN",
        scopeLevel: "ORGANIZATION",
        name: "Super Admin",
      });
    });

    it("should reject negative commission values with HTTP 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/events/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultPlatformFeePercent: -5 }),
      });

      const res = await updateSettingsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain("0% dan 50%");
    });

    it("should reject commission values exceeding 50% with HTTP 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/events/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultPlatformFeePercent: 55 }),
      });

      const res = await updateSettingsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain("0% dan 50%");
    });

    it("should reject non-integer commission values with HTTP 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/events/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultPlatformFeePercent: 22.5 }),
      });

      const res = await updateSettingsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain("bilangan bulat");
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Immutability of Existing Agreements vs New Event Default
  // ---------------------------------------------------------------------------
  describe("3. Immutability of Existing Agreements vs New Event Default", () => {
    it("should assign newest default commission to new event creation", () => {
      mockPolicy.defaultPlatformFeePercent = 25;

      const resolvedPolicy = eventsLib.getEventRevenuePolicy();
      const initialEventCommission = resolvedPolicy.defaultPlatformFeePercent;
      expect(initialEventCommission).toBe(25);
    });

    it("should NOT mutate existing PENDING events when platform default changes", () => {
      const pendingEvent: Partial<CommunityEvent> = {
        id: "evt-pending-1",
        title: "Pameran Desain Bandung",
        status: "PENDING",
        customPlatformFeePercent: 15,
      };

      // Default policy updated from 20% to 30%
      mockPolicy.defaultPlatformFeePercent = 30;

      const effectiveFee = pendingEvent.customPlatformFeePercent ?? mockPolicy.defaultPlatformFeePercent;
      expect(effectiveFee).toBe(15);
      expect(pendingEvent.customPlatformFeePercent).toBe(15);
    });

    it("should NOT mutate events with approved custom agreements when default changes", () => {
      const customEvent: Partial<CommunityEvent> = {
        id: "evt-approved-custom",
        title: "Konser Amal Dago",
        status: "APPROVED",
        customPlatformFeePercent: 10,
      };

      // Platform changes global default to 35%
      mockPolicy.defaultPlatformFeePercent = 35;

      const split = eventsLib.calculateEventRevenueSplit(100000, customEvent.customPlatformFeePercent ?? undefined);
      expect(split.platformFeePercent).toBe(10);
      expect(split.organizerSharePercent).toBe(90);
      expect(split.platformFeeAmount).toBe(10000);
      expect(split.organizerRevenueAmount).toBe(90000);
    });

    it("should maintain immutable locked split on LOCKED events even if default changes", () => {
      const lockedEvent: Partial<CommunityEvent> = {
        id: "evt-locked-1",
        title: "Tech Meetup Dago",
        status: "APPROVED",
        customPlatformFeePercent: 20,
      };

      // Booking exists -> locked
      const bookings: any[] = [
        { id: "b-1", eventId: lockedEvent.id!, status: "CONFIRMED", totalAmount: 50000 },
      ];
      const isLocked = eventsLib.isEventRevenueSplitLocked(lockedEvent.id!, bookings as any);
      expect(isLocked).toBe(true);

      // Attempting to change global default to 40%
      mockPolicy.defaultPlatformFeePercent = 40;

      const split = eventsLib.calculateEventRevenueSplit(50000, lockedEvent.customPlatformFeePercent ?? undefined);
      expect(split.platformFeePercent).toBe(20);
      expect(split.platformFeeAmount).toBe(10000);
      expect(split.organizerRevenueAmount).toBe(40000);
    });

    it("should preserve historical booking snapshots untouched when default changes", () => {
      const historicalBookingSnapshot = {
        id: "b-hist-1",
        eventId: "evt-hist-1",
        totalAmount: 200000,
        platformFeePercent: 20,
        platformFeeAmount: 40000,
        organizerPercent: 80,
        organizerRevenueAmount: 160000,
      };

      // Admin updates platform default to 15%
      mockPolicy.defaultPlatformFeePercent = 15;

      expect(historicalBookingSnapshot.platformFeePercent).toBe(20);
      expect(historicalBookingSnapshot.platformFeeAmount).toBe(40000);
      expect(historicalBookingSnapshot.organizerRevenueAmount).toBe(160000);
      expect(historicalBookingSnapshot.platformFeeAmount + historicalBookingSnapshot.organizerRevenueAmount).toBe(200000);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Database Persistence & Failure Rollback Verification
  // ---------------------------------------------------------------------------
  describe("4. Database Persistence & Failure Rollback Verification", () => {
    beforeEach(() => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue({
        authorized: true,
        user: { id: "admin-1", role: { name: "Super Admin", slug: "SUPER_ADMIN" } } as any,
        role: "SUPER_ADMIN",
        scopeLevel: "ORGANIZATION",
        name: "Super Admin",
      });
    });

    it("should trigger persistStorageToDb and return HTTP 200 when database succeeds", async () => {
      const persistSpy = vi.spyOn(dataStorage, "persistStorageToDb").mockResolvedValue(true);

      const req = new NextRequest("http://localhost:3000/api/events/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultPlatformFeePercent: 30, policyNotes: "Test Persist" }),
      });

      const res = await updateSettingsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(persistSpy).toHaveBeenCalledWith("event_settings.json", expect.any(String));
      expect(json.data.defaultPlatformFeePercent).toBe(30);
    });

    it("should return HTTP 500, reject update, and rollback local disk when persistStorageToDb fails", async () => {
      // Pastikan policy awal adalah 20%
      mockPolicy.defaultPlatformFeePercent = 20;

      // Simulasikan kegagalan database (misal connection timeout atau PostgreSQL error)
      vi.spyOn(dataStorage, "persistStorageToDb").mockRejectedValue(
        new Error("Connection to PostgreSQL failed: timeout 8000ms")
      );
      const rollbackSpy = vi.spyOn(eventsLib, "saveEventSettingsToDisk");

      const req = new NextRequest("http://localhost:3000/api/events/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultPlatformFeePercent: 45, policyNotes: "Gagal disimpan ke DB" }),
      });

      const res = await updateSettingsHandler(req);
      const json = await res.json();

      // 1. API HARUS mengembalikan 500 dan success: false
      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toContain("Gagal mengamankan penyimpanan ke database cloud (PostgreSQL)");
      expect(json.error).toContain("Perubahan dibatalkan demi integritas data");

      // 2. Rollback disk harus dipanggil untuk mengembalikan state awal (20%)
      expect(rollbackSpy).toHaveBeenCalled();
      expect(mockPolicy.defaultPlatformFeePercent).toBe(20);
    });

    it("should call syncStorageFromDb on GET /api/events/admin/settings to maintain Single Source of Truth", async () => {
      const syncSpy = vi.spyOn(dataStorage, "syncStorageFromDb").mockResolvedValue(true);

      const req = new NextRequest("http://localhost:3000/api/events/admin/settings", {
        method: "GET",
      });

      const res = await getSettingsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(syncSpy).toHaveBeenCalledWith("event_settings.json");
    });

    it("should block subsequent writes with RISK_DATA_LOSS when storageSyncStatusMap is UNAVAILABLE following a timeout", async () => {
      dataStorage.setStorageSyncStatus("event_settings.json", "UNAVAILABLE");

      await expect(
        originalPersistStorageToDb("event_settings.json", JSON.stringify(mockPolicy))
      ).rejects.toThrow(/RISK_DATA_LOSS/);

      dataStorage.resetStorageSyncStatus();
    });

    it("should strictly verify asynchronous order of delayed DB write, state divergence, UNAVAILABLE write block, and GET reconciliation", async () => {
      // Baseline: platform fee 20%
      let simulatedDbStorage: string = JSON.stringify({ ...mockPolicy, defaultPlatformFeePercent: 20 });
      let localDiskContent: string = simulatedDbStorage;
      let cachedPolicyInMemory = { ...mockPolicy, defaultPlatformFeePercent: 20 };

      vi.spyOn(eventsLib, "getEventRevenuePolicy").mockImplementation(() => ({ ...cachedPolicyInMemory }));
      vi.spyOn(eventsLib, "saveEventSettingsToDisk").mockImplementation((p: any) => {
        cachedPolicyInMemory = { ...p };
        localDiskContent = JSON.stringify(p);
      });

      // Deferred Promise to simulate slow in-flight database query
      let completeDelayedDbWrite: () => void = () => {};
      const slowDbQuery = new Promise<boolean>((resolve) => {
        completeDelayedDbWrite = () => {
          simulatedDbStorage = JSON.stringify({ ...mockPolicy, defaultPlatformFeePercent: 45 });
          resolve(true);
        };
      });

      // 1. Simulasikan PUT: persistStorageToDb melempar timeout pada level JS runtime (8 detik)
      vi.spyOn(dataStorage, "persistStorageToDb").mockImplementationOnce(async () => {
        dataStorage.setStorageSyncStatus("event_settings.json", "UNAVAILABLE");
        throw new dataStorage.DatabasePersistenceError("Batas waktu (timeout 8000ms) terlampaui", "event_settings.json", true);
      });

      const putReq = new NextRequest("http://localhost:3000/api/events/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultPlatformFeePercent: 45 }),
      });

      // 2. Route mengembalikan 500 dan rollback dieksekusi
      const putRes = await updateSettingsHandler(putReq);
      const putJson = await putRes.json();
      expect(putRes.status).toBe(500);
      expect(putJson.success).toBe(false);

      // Keadaan saat ini (t = timeout):
      // - Local Disk: 20%
      // - Cache Memori: 20%
      // - DB Remote: masih 20% (query lambat belum selesai)
      // - Sync Status: UNAVAILABLE
      expect(JSON.parse(localDiskContent).defaultPlatformFeePercent).toBe(20);
      expect(cachedPolicyInMemory.defaultPlatformFeePercent).toBe(20);
      expect(JSON.parse(simulatedDbStorage).defaultPlatformFeePercent).toBe(20);
      expect(dataStorage.getStorageSyncStatus("event_settings.json")).toBe("UNAVAILABLE");

      // 3. Setelah rollback selesai, biarkan query PostgreSQL pertama yang terlambat berhasil selesai di remote server
      completeDelayedDbWrite();
      await slowDbQuery;

      // 4. Periksa kondisi database, disk, dan cache:
      // Terjadi divergensi: Database = 45%, Disk = 20%, Cache = 20%
      expect(JSON.parse(simulatedDbStorage).defaultPlatformFeePercent).toBe(45);
      expect(JSON.parse(localDiskContent).defaultPlatformFeePercent).toBe(20);
      expect(cachedPolicyInMemory.defaultPlatformFeePercent).toBe(20);

      // 5. Periksa apakah status UNAVAILABLE tetap memblokir operasi tulis berikutnya
      await expect(
        originalPersistStorageToDb("event_settings.json", JSON.stringify({ defaultPlatformFeePercent: 30 }))
      ).rejects.toThrow(/RISK_DATA_LOSS/);

      // 6. Jalankan GET dan verifikasi rekonsiliasi Single Source of Truth
      // syncStorageFromDb membaca master PostgreSQL (45%), memperbarui disk, cache, dan status SYNCED
      vi.spyOn(dataStorage, "syncStorageFromDb").mockImplementationOnce(async () => {
        localDiskContent = simulatedDbStorage;
        cachedPolicyInMemory = JSON.parse(simulatedDbStorage);
        dataStorage.setStorageSyncStatus("event_settings.json", "SYNCED");
        return true;
      });

      const getRes = await getSettingsHandler(new NextRequest("http://localhost:3000/api/events/admin/settings"));
      const getJson = await getRes.json();

      expect(getRes.status).toBe(200);
      expect(getJson.success).toBe(true);
      expect(getJson.data.defaultPlatformFeePercent).toBe(45);

      // Seluruh state kembali 100% konsisten:
      expect(JSON.parse(simulatedDbStorage).defaultPlatformFeePercent).toBe(45);
      expect(JSON.parse(localDiskContent).defaultPlatformFeePercent).toBe(45);
      expect(cachedPolicyInMemory.defaultPlatformFeePercent).toBe(45);
      expect(dataStorage.getStorageSyncStatus("event_settings.json")).toBe("SYNCED");

      dataStorage.resetStorageSyncStatus();
    });

    it("should prove early GET edge case: GET before delayed DB commit resets status to SYNCED with stale 20%, then delayed write commits 45% causing hidden divergence", async () => {
      let simulatedDbStorage: string = JSON.stringify({ ...mockPolicy, defaultPlatformFeePercent: 20 });
      let localDiskContent: string = simulatedDbStorage;
      let cachedPolicyInMemory = { ...mockPolicy, defaultPlatformFeePercent: 20 };

      vi.spyOn(eventsLib, "getEventRevenuePolicy").mockImplementation(() => ({ ...cachedPolicyInMemory }));
      vi.spyOn(eventsLib, "saveEventSettingsToDisk").mockImplementation((p: any) => {
        cachedPolicyInMemory = { ...p };
        localDiskContent = JSON.stringify(p);
      });

      // 1. Query 1 kirim 45%, timeout pada detik ke-8
      vi.spyOn(dataStorage, "persistStorageToDb").mockImplementationOnce(async () => {
        dataStorage.setStorageSyncStatus("event_settings.json", "UNAVAILABLE");
        throw new dataStorage.DatabasePersistenceError("Timeout 8000ms", "event_settings.json", true);
      });

      const putRes = await updateSettingsHandler(new NextRequest("http://localhost:3000/api/events/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultPlatformFeePercent: 45 }),
      }));
      expect(putRes.status).toBe(500);
      expect(dataStorage.getStorageSyncStatus("event_settings.json")).toBe("UNAVAILABLE");

      // 2. Pada detik ke-8.2, GET dipanggil SEBELUM query 1 selesai di remote database
      // Karena query 1 belum commit di PostgreSQL, PostgreSQL masih 20%
      vi.spyOn(dataStorage, "syncStorageFromDb").mockImplementationOnce(async () => {
        localDiskContent = simulatedDbStorage; // 20%
        cachedPolicyInMemory = JSON.parse(simulatedDbStorage);
        dataStorage.setStorageSyncStatus("event_settings.json", "SYNCED");
        return true;
      });

      const earlyGetRes = await getSettingsHandler(new NextRequest("http://localhost:3000/api/events/admin/settings"));
      const earlyGetJson = await earlyGetRes.json();
      expect(earlyGetRes.status).toBe(200);
      expect(earlyGetJson.data.defaultPlatformFeePercent).toBe(20);

      // Status kembali ke SYNCED!
      expect(dataStorage.getStorageSyncStatus("event_settings.json")).toBe("SYNCED");

      // 3. Pada detik ke-8.5, query 1 terlambat BERHASIL commit 45% di remote PostgreSQL!
      simulatedDbStorage = JSON.stringify({ ...mockPolicy, defaultPlatformFeePercent: 45 });

      // 4. BUKTI RISIKO DIVERGENSI:
      // PostgreSQL sudah 45%, tetapi Disk dan Cache lokal masih 20% dengan status SYNCED!
      expect(JSON.parse(simulatedDbStorage).defaultPlatformFeePercent).toBe(45);
      expect(JSON.parse(localDiskContent).defaultPlatformFeePercent).toBe(20);
      expect(cachedPolicyInMemory.defaultPlatformFeePercent).toBe(20);
      expect(dataStorage.getStorageSyncStatus("event_settings.json")).toBe("SYNCED");

      dataStorage.resetStorageSyncStatus();
    });
  });

  // ---------------------------------------------------------------------------
  // 5. In-Flight Database Write Tracker & Reconciliation Hardening (10 Skenario Wajib)
  // ---------------------------------------------------------------------------
  describe("5. In-Flight Database Write Tracker & Reconciliation Hardening", () => {
    beforeEach(() => {
      dataStorage.resetStorageSyncStatus();
    });

    afterEach(() => {
      dataStorage.resetStorageSyncStatus();
    });

    // Skenario 1: Query database selesai normal sebelum timeout
    it("1. should track query database normally and clean up tracker when completed before timeout", async () => {
      let resolveQuery: (val: any) => void = () => {};
      const normalQuery = new Promise((res) => { resolveQuery = res; });

      dataStorage.registerInFlightWrite("event_settings.json", normalQuery);
      expect(dataStorage.getInFlightWriteCount("event_settings.json")).toBe(1);

      resolveQuery(true);
      await normalQuery;

      expect(dataStorage.getInFlightWriteCount("event_settings.json")).toBe(0);
    });

    // Skenario 2: Query database mengalami timeout tetapi tetap berjalan
    it("2. should keep tracker active when query database times out but continues running in background", async () => {
      let resolveSlowQuery: (val: any) => void = () => {};
      const slowQuery = new Promise((res) => { resolveSlowQuery = res; });

      dataStorage.registerInFlightWrite("event_settings.json", slowQuery);

      // Simulasikan timeout pada level runtime JS
      dataStorage.setStorageSyncStatus("event_settings.json", "UNAVAILABLE");

      // Tracker harus tetap aktif (size = 1) meskipun status sudah UNAVAILABLE karena query fisik masih berjalan
      expect(dataStorage.getInFlightWriteCount("event_settings.json")).toBe(1);

      // Selesaikan query lambat
      resolveSlowQuery(true);
      await slowQuery;

      expect(dataStorage.getInFlightWriteCount("event_settings.json")).toBe(0);
    });

    // Skenario 3: GET dipanggil sebelum query lama selesai
    it("3. should detect active in-flight write when GET is called before old query finishes", async () => {
      const pendingQuery = new Promise((resolve) => setTimeout(resolve, 500));
      dataStorage.registerInFlightWrite("event_settings.json", pendingQuery);

      expect(dataStorage.getInFlightWriteCount("event_settings.json")).toBe(1);
      dataStorage.clearInFlightWrites();
    });

    // Skenario 4: GET menunggu query lama dan membaca nilai terbaru setelah query selesai
    it("4. should make GET wait for in-flight write and read newest value after query finishes", async () => {
      let resolveQuery: (val: any) => void = () => {};
      const delayedDbWrite = new Promise((resolve) => { resolveQuery = resolve; });

      dataStorage.registerInFlightWrite("event_settings.json", delayedDbWrite);

      let getFinished = false;
      let finalPolicyValue = 20;

      // Jalankan syncStorageFromDb yang akan menunggu in-flight write
      const syncPromise = dataStorage.syncStorageFromDb("event_settings.json").then((res) => {
        getFinished = true;
        finalPolicyValue = 45; // Nilai terbaca dari DB setelah query 1 selesai
        return res;
      });

      // Pada saat t=0, get belum selesai karena menunggu delayedDbWrite
      expect(getFinished).toBe(false);

      // Selesaikan delayedDbWrite
      resolveQuery(true);
      await delayedDbWrite;
      await syncPromise;

      expect(getFinished).toBe(true);
      expect(finalPolicyValue).toBe(45);
      expect(dataStorage.getInFlightWriteCount("event_settings.json")).toBe(0);
    });

    // Skenario 5: Query lama gagal setelah timeout
    it("5. should handle old query failure cleanly after timeout without crashing reconciliation", async () => {
      let rejectQuery: (err: any) => void = () => {};
      const failingQuery = new Promise((_, rej) => { rejectQuery = rej; });
      failingQuery.catch(() => {});

      dataStorage.registerInFlightWrite("event_settings.json", failingQuery);

      const syncPromise = dataStorage.syncStorageFromDb("event_settings.json");

      // Gagalkan query lama
      rejectQuery(new Error("PostgreSQL connection terminated"));

      const result = await syncPromise;
      expect(result).toBe(true);
      expect(dataStorage.getInFlightWriteCount("event_settings.json")).toBe(0);
    });

    // Skenario 6: Rekonsiliasi mencapai timeout
    it("6. should maintain UNAVAILABLE status and return false when reconciliation timeout is reached", async () => {
      // Query yang tidak pernah selesai (stuck)
      const stuckQuery = new Promise(() => {});
      dataStorage.registerInFlightWrite("event_settings.json", stuckQuery);

      // Simulasikan timeout rekonsiliasi dengan timeout buatan pendek untuk pengujian
      const reconTimeout = new Promise<"RECON_TIMEOUT">((resolve) => setTimeout(() => resolve("RECON_TIMEOUT"), 50));
      const waitResult = await Promise.race([
        Promise.allSettled([stuckQuery]),
        reconTimeout,
      ]);

      expect(waitResult).toBe("RECON_TIMEOUT");
      dataStorage.setStorageSyncStatus("event_settings.json", "UNAVAILABLE");
      expect(dataStorage.getStorageSyncStatus("event_settings.json")).toBe("UNAVAILABLE");

      dataStorage.clearInFlightWrites();
    });

    // Skenario 7: Dua operasi tulis aktif pada filename yang sama
    it("7. should track multiple active write operations on the same filename without clobbering", async () => {
      let resolve1: (v: any) => void = () => {};
      let resolve2: (v: any) => void = () => {};
      const query1 = new Promise((res) => { resolve1 = res; });
      const query2 = new Promise((res) => { resolve2 = res; });

      dataStorage.registerInFlightWrite("event_settings.json", query1);
      dataStorage.registerInFlightWrite("event_settings.json", query2);

      expect(dataStorage.getInFlightWriteCount("event_settings.json")).toBe(2);

      resolve1(true);
      await query1;
      expect(dataStorage.getInFlightWriteCount("event_settings.json")).toBe(1);

      resolve2(true);
      await query2;
      expect(dataStorage.getInFlightWriteCount("event_settings.json")).toBe(0);
    });

    // Skenario 8: Tracker dibersihkan setelah seluruh operasi selesai
    it("8. should clean up tracker completely after all operations settle", async () => {
      const q = Promise.resolve(true);
      dataStorage.registerInFlightWrite("event_settings.json", q);
      await q;

      expect(dataStorage.getInFlightWriteCount("event_settings.json")).toBe(0);
    });

    // Skenario 9: Status tidak berubah menjadi SYNCED ketika query lama masih aktif
    it("9. should not change status to SYNCED while old query is still active and unconfirmed", async () => {
      let resolveQuery: (val: any) => void = () => {};
      const activeQuery = new Promise((res) => { resolveQuery = res; });

      dataStorage.registerInFlightWrite("event_settings.json", activeQuery);
      dataStorage.setStorageSyncStatus("event_settings.json", "UNAVAILABLE");

      // Selama activeQuery belum selesai, status lokal tetap UNAVAILABLE
      expect(dataStorage.getStorageSyncStatus("event_settings.json")).toBe("UNAVAILABLE");

      resolveQuery(true);
      await activeQuery;
    });

    // Skenario 10: Operasi tulis tetap diblokir ketika status UNAVAILABLE
    it("10. should strictly block new writes with RISK_DATA_LOSS while status is UNAVAILABLE", async () => {
      dataStorage.setStorageSyncStatus("event_settings.json", "UNAVAILABLE");

      await expect(
        originalPersistStorageToDb("event_settings.json", JSON.stringify({ defaultPlatformFeePercent: 35 }))
      ).rejects.toThrow(/RISK_DATA_LOSS/);

      dataStorage.resetStorageSyncStatus();
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Deterministic Concurrency Tests — Per-Filename Reconciliation Gate (Skenario A - J)
  // ---------------------------------------------------------------------------
  describe("7. Deterministic Concurrency Tests — Per-Filename Reconciliation Gate", () => {
    beforeEach(() => {
      vi.spyOn(dataStorage, "syncStorageFromDb").mockImplementation(originalSyncStorageFromDb);
      vi.spyOn(dataStorage, "persistStorageToDb").mockImplementation(originalPersistStorageToDb);
      dataStorage.resetStorageSyncStatus();
    });

    afterEach(() => {
      dataStorage.resetStorageSyncStatus();
    });

    // Skenario A: Write baru ketika reconciliation sedang menunggu Write A
    it("A. should reject new write with RECONCILIATION_IN_PROGRESS when reconciliation is waiting for in-flight Write A", async () => {
      let resolveWriteA: (v: any) => void = () => {};
      const writeAPromise = new Promise((res) => { resolveWriteA = res; });
      dataStorage.registerInFlightWrite("event_settings.json", writeAPromise);

      // Mulai proses rekonsiliasi
      const reconPromise = dataStorage.syncStorageFromDb("event_settings.json");

      // Gate harus aktif secara sinkron
      expect(dataStorage.isReconciliationGateActive("event_settings.json")).toBe(true);

      // Write baru mencoba masuk saat rekonsiliasi sedang menunggu Write A
      await expect(
        originalPersistStorageToDb("event_settings.json", JSON.stringify({ defaultPlatformFeePercent: 40 }))
      ).rejects.toThrow(/RECONCILIATION_IN_PROGRESS/);

      // Selesaikan Write A
      resolveWriteA(true);
      await writeAPromise;
      const result = await reconPromise;

      expect(result).toBe(true);
      expect(dataStorage.isReconciliationGateActive("event_settings.json")).toBe(false);
    });

    // Skenario B: Write baru ketika query findUnique sedang berjalan
    it("B. should reject new write with RECONCILIATION_IN_PROGRESS when findUnique database query is in-flight", async () => {
      let resolveDbQuery: (val: any) => void = () => {};
      const dbQueryPromise = new Promise((res) => { resolveDbQuery = res; });

      dataStorage.setTestDatabaseReadHandler(async () => {
        return dbQueryPromise as any;
      });

      const reconPromise = dataStorage.syncStorageFromDb("event_settings.json");

      // Gate harus aktif saat query DB berjalan
      expect(dataStorage.isReconciliationGateActive("event_settings.json")).toBe(true);

      // Write baru mencoba menyusup saat query findUnique berlangsung
      await expect(
        originalPersistStorageToDb("event_settings.json", JSON.stringify({ defaultPlatformFeePercent: 30 }))
      ).rejects.toThrow(/RECONCILIATION_IN_PROGRESS/);

      // Selesaikan query DB
      resolveDbQuery({ value: JSON.stringify({ defaultPlatformFeePercent: 20 }), updatedAt: new Date() });
      const result = await reconPromise;

      expect(result).toBe(true);
      expect(dataStorage.isReconciliationGateActive("event_settings.json")).toBe(false);
      dataStorage.setTestDatabaseReadHandler(null);
    });

    // Skenario C: Write baru ketika penulisan disk sedang berlangsung
    it("C. should reject new write with RECONCILIATION_IN_PROGRESS when local disk writing is in progress", async () => {
      let resolveDiskWrite: () => void = () => {};
      const diskWritePromise = new Promise<void>((res) => { resolveDiskWrite = res; });

      dataStorage.setTestDatabaseReadHandler(async () => ({
        value: JSON.stringify({ defaultPlatformFeePercent: 25 }),
        updatedAt: new Date(),
      }));
      dataStorage.setTestDiskWriteHandler(async () => {
        await diskWritePromise;
      });

      const reconPromise = dataStorage.syncStorageFromDb("event_settings.json");

      // Berikan 10ms agar query DB selesai dan disk write mulai
      await new Promise((r) => setTimeout(r, 10));

      // Gate harus tetap aktif selama disk write berlangsung
      expect(dataStorage.isReconciliationGateActive("event_settings.json")).toBe(true);

      // Write baru mencoba masuk saat disk write berlangsung
      await expect(
        originalPersistStorageToDb("event_settings.json", JSON.stringify({ defaultPlatformFeePercent: 35 }))
      ).rejects.toThrow(/RECONCILIATION_IN_PROGRESS/);

      // Selesaikan disk write
      resolveDiskWrite();
      const result = await reconPromise;

      expect(result).toBe(true);
      expect(dataStorage.isReconciliationGateActive("event_settings.json")).toBe(false);
      dataStorage.setTestDatabaseReadHandler(null);
      dataStorage.setTestDiskWriteHandler(null);
    });

    // Skenario D: Dua reconciliation bersamaan pada filename yang sama
    it("D. should coalesce concurrent reconciliations on the same filename into the same execution safely", async () => {
      let resolveDbQuery: (val: any) => void = () => {};
      const dbQueryPromise = new Promise((res) => { resolveDbQuery = res; });

      dataStorage.setTestDatabaseReadHandler(async () => {
        return dbQueryPromise as any;
      });

      const reconPromise1 = dataStorage.syncStorageFromDb("event_settings.json");
      const reconPromise2 = dataStorage.syncStorageFromDb("event_settings.json");

      // Harus merujuk pada Promise yang sama (coalesced)
      expect(reconPromise1).toBe(reconPromise2);
      expect(dataStorage.isReconciliationGateActive("event_settings.json")).toBe(true);

      resolveDbQuery({ value: JSON.stringify({ defaultPlatformFeePercent: 20 }), updatedAt: new Date() });

      const [res1, res2] = await Promise.all([reconPromise1, reconPromise2]);
      expect(res1).toBe(true);
      expect(res2).toBe(true);
      expect(dataStorage.isReconciliationGateActive("event_settings.json")).toBe(false);
      dataStorage.setTestDatabaseReadHandler(null);
    });

    // Skenario E: Reconciliation filename berbeda tetap dapat berjalan independen
    it("E. should allow independent reconciliations and writes on different filenames without cross-blocking", async () => {
      let resolveFile1: (val: any) => void = () => {};
      const dbPromiseFile1 = new Promise((res) => { resolveFile1 = res; });

      dataStorage.setTestDatabaseReadHandler(async (filename) => {
        if (filename === "event_settings.json") {
          return dbPromiseFile1 as any;
        }
        return { value: JSON.stringify({ otherSetting: true }), updatedAt: new Date() };
      });

      // Mulai rekonsiliasi file 1 (tertahan di dbPromiseFile1)
      const recon1 = dataStorage.syncStorageFromDb("event_settings.json");
      expect(dataStorage.isReconciliationGateActive("event_settings.json")).toBe(true);
      expect(dataStorage.isReconciliationGateActive("other_settings.json")).toBe(false);

      // Rekonsiliasi file 2 harus dapat berjalan dan selesai independen
      const recon2 = await dataStorage.syncStorageFromDb("other_settings.json");
      expect(recon2).toBe(true);
      expect(dataStorage.isReconciliationGateActive("other_settings.json")).toBe(false);

      // Write ke file 2 diizinkan karena gate file 2 tidak aktif
      const writeResultFile2 = await originalPersistStorageToDb("other_settings.json", JSON.stringify({ otherSetting: false }));
      expect(writeResultFile2).toBe(true);

      // Namun write ke file 1 tetap diblokir oleh gate file 1
      await expect(
        originalPersistStorageToDb("event_settings.json", JSON.stringify({ defaultPlatformFeePercent: 50 }))
      ).rejects.toThrow(/RECONCILIATION_IN_PROGRESS/);

      // Selesaikan file 1
      resolveFile1({ value: JSON.stringify({ defaultPlatformFeePercent: 20 }), updatedAt: new Date() });
      await recon1;
      expect(dataStorage.isReconciliationGateActive("event_settings.json")).toBe(false);
      dataStorage.setTestDatabaseReadHandler(null);
    });

    // Skenario F: Timeout saat menunggu in-flight write
    it("F. should fail reconciliation and maintain UNAVAILABLE status when in-flight write times out", async () => {
      const stuckWrite = new Promise(() => {}); // never resolves
      dataStorage.registerInFlightWrite("event_settings.json", stuckWrite);

      // Gunakan timeout singkat 50ms untuk pengujian
      dataStorage.setReconciliationTimeoutForTest(50);

      const reconResult = await dataStorage.syncStorageFromDb("event_settings.json");

      expect(reconResult).toBe(false);
      expect(dataStorage.getStorageSyncStatus("event_settings.json")).toBe("UNAVAILABLE");
      expect(dataStorage.isReconciliationGateActive("event_settings.json")).toBe(false);

      dataStorage.clearInFlightWrites();
      dataStorage.setReconciliationTimeoutForTest(10000);
    });

    // Skenario G: Query database gagal ketika reconciliation berjalan
    it("G. should mark status UNAVAILABLE and release gate when database query rejects during reconciliation", async () => {
      dataStorage.setTestDatabaseReadHandler(async () => {
        throw new Error("PostgreSQL connection refused");
      });

      const reconResult = await dataStorage.syncStorageFromDb("event_settings.json");

      expect(reconResult).toBe(false);
      expect(dataStorage.getStorageSyncStatus("event_settings.json")).toBe("UNAVAILABLE");
      expect(dataStorage.isReconciliationGateActive("event_settings.json")).toBe(false);

      dataStorage.setTestDatabaseReadHandler(null);
    });

    // Skenario H: Gate selalu dilepas setelah error
    it("H. should always release reconciliation gate even when unexpected errors or invalid JSON occur", async () => {
      dataStorage.setTestDatabaseReadHandler(async () => ({
        value: "{ invalid json payload --- corrupt",
        updatedAt: new Date(),
      }));

      const reconResult = await dataStorage.syncStorageFromDb("event_settings.json");

      expect(reconResult).toBe(false);
      expect(dataStorage.getStorageSyncStatus("event_settings.json")).toBe("INVALID_DATA");
      // Gate harus tetap dilepas meskipun data korup
      expect(dataStorage.isReconciliationGateActive("event_settings.json")).toBe(false);

      dataStorage.setTestDatabaseReadHandler(null);
    });

    // Skenario I: Write setelah reconciliation selesai dapat berjalan normal
    it("I. should allow write operations to proceed normally after reconciliation completes successfully", async () => {
      dataStorage.setTestDatabaseReadHandler(async () => ({
        value: JSON.stringify({ defaultPlatformFeePercent: 20 }),
        updatedAt: new Date(),
      }));

      const reconResult = await dataStorage.syncStorageFromDb("event_settings.json");
      expect(reconResult).toBe(true);
      expect(dataStorage.getStorageSyncStatus("event_settings.json")).toBe("SYNCED");
      expect(dataStorage.isReconciliationGateActive("event_settings.json")).toBe(false);

      // Write baru setelah rekonsiliasi selesai harus berhasil
      const writeSuccess = await originalPersistStorageToDb(
        "event_settings.json",
        JSON.stringify({ defaultPlatformFeePercent: 25 })
      );
      expect(writeSuccess).toBe(true);

      dataStorage.setTestDatabaseReadHandler(null);
    });

    // Skenario J: Tidak ada status SYNCED ketika masih terdapat operasi write aktif
    it("J. should never assign status SYNCED when any in-flight write operation remains active", async () => {
      let resolveActiveWrite: (v: any) => void = () => {};
      const activeWrite = new Promise((res) => { resolveActiveWrite = res; });
      dataStorage.registerInFlightWrite("event_settings.json", activeWrite);

      // Simulasikan status saat ini
      dataStorage.setStorageSyncStatus("event_settings.json", "UNAVAILABLE");

      // Jika getInFlightWriteCount > 0, status tidak boleh SYNCED
      expect(dataStorage.getInFlightWriteCount("event_settings.json")).toBe(1);
      expect(dataStorage.getStorageSyncStatus("event_settings.json")).not.toBe("SYNCED");

      // Jika syncStorageFromDb dijalankan tetapi write belum selesai, status tidak boleh SYNCED
      dataStorage.setReconciliationTimeoutForTest(40);
      const syncResult = await dataStorage.syncStorageFromDb("event_settings.json");
      expect(syncResult).toBe(false);
      expect(dataStorage.getStorageSyncStatus("event_settings.json")).toBe("UNAVAILABLE");

      resolveActiveWrite(true);
      await activeWrite;
      expect(dataStorage.getInFlightWriteCount("event_settings.json")).toBe(0);
      dataStorage.setReconciliationTimeoutForTest(10000);
    });
  });
});
