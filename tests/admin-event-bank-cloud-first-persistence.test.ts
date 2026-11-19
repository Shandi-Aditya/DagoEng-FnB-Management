import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import {
  POST as handleBanksPost,
  PATCH as handleBanksPatch,
  DELETE as handleBanksDelete,
  GET as handleBanksGet,
} from "../src/app/api/events/admin/settings/banks/route";
import * as eventsLib from "../src/lib/events";
import * as serverAuth from "../src/lib/server-auth";
import * as dataStorage from "../src/lib/data-storage";
import { EventBankAccount, EventRevenueSharingPolicy, DEFAULT_EVENT_POLICY } from "../src/types/event";

const DATA_DIR = dataStorage.getDataDirectory();
const SETTINGS_FILE = path.join(DATA_DIR, "event_settings.json");
const ORGANIZERS_FILE = path.join(DATA_DIR, "organizers.json");

describe("TASK S-01 — Cloud-First Storage Reliability & CAS Concurrency Suite", () => {
  let backupSettings: string | null = null;
  let backupOrganizers: string | null = null;

  const mockAdminAuth = {
    authorized: true,
    role: "SUPER_ADMIN" as const,
    scopeLevel: "PLATFORM" as const,
    userId: "admin-1",
    name: "Admin Platform Dago",
  };

  const initialAccounts: EventBankAccount[] = [
    {
      id: "bank-default-1",
      label: "Rekening Utama Platform",
      bankName: "BCA",
      accountNumber: "1234567890",
      accountHolder: "PT Dago Creative Hub",
      isDefault: true,
      isActive: true,
      accountType: "PLATFORM",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "bank-secondary-2",
      label: "Rekening Sekunder Platform",
      bankName: "Mandiri",
      accountNumber: "9876543210",
      accountHolder: "PT Dago Creative Hub",
      isDefault: false,
      isActive: true,
      accountType: "PLATFORM",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    dataStorage.resetStorageSyncStatus();

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(SETTINGS_FILE)) {
      backupSettings = fs.readFileSync(SETTINGS_FILE, "utf-8");
    } else {
      backupSettings = null;
    }

    if (fs.existsSync(ORGANIZERS_FILE)) {
      backupOrganizers = fs.readFileSync(ORGANIZERS_FILE, "utf-8");
    } else {
      backupOrganizers = null;
    }

    const testPolicy: EventRevenueSharingPolicy = {
      ...DEFAULT_EVENT_POLICY,
      _revision: 1,
      bankAccounts: JSON.parse(JSON.stringify(initialAccounts)),
      bankHistory: [],
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(testPolicy, null, 2), "utf-8");
    eventsLib.saveEventSettingsToDisk(testPolicy, { forceDiskWrite: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    dataStorage.resetStorageSyncStatus();

    if (backupSettings !== null) {
      fs.writeFileSync(SETTINGS_FILE, backupSettings, "utf-8");
      try {
        eventsLib.saveEventSettingsToDisk(JSON.parse(backupSettings), { forceDiskWrite: true });
      } catch (_) {}
    } else if (fs.existsSync(SETTINGS_FILE)) {
      fs.unlinkSync(SETTINGS_FILE);
    }

    if (backupOrganizers !== null) {
      fs.writeFileSync(ORGANIZERS_FILE, backupOrganizers, "utf-8");
    }
  });

  // 1. POST berhasil (Happy path Cloud-First)
  it("1. POST berhasil: Cloud-First commit ke Neon lalu disk lokal, revision bertambah", async () => {
    vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);
    vi.spyOn(dataStorage, "syncStorageFromDb").mockResolvedValue(true);
    const persistSpy = vi.spyOn(dataStorage, "persistStorageToDb").mockResolvedValue(true);

    const req = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: "BNI Rekening Resmi",
        bankName: "BNI",
        accountNumber: "5556667778",
        accountHolder: "PT DAGO CREATIVE HUB",
      }),
    });

    const res = await handleBanksPost(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.bankName).toBe("BNI");
    expect(body.data.accountNumber).toBe("5556667778");
    expect(persistSpy).toHaveBeenCalledTimes(1);

    // Verify disk replica was updated with incremented revision
    const diskContent = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    expect(diskContent._revision).toBeGreaterThanOrEqual(2);
    expect(diskContent.bankAccounts.some((b: any) => b.bankName === "BNI")).toBe(true);
  });

  // 2. PATCH aktif/nonaktif berhasil
  it("2. PATCH aktif/nonaktif berhasil memperbarui rekening", async () => {
    vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);
    vi.spyOn(dataStorage, "syncStorageFromDb").mockResolvedValue(true);
    vi.spyOn(dataStorage, "persistStorageToDb").mockResolvedValue(true);

    const req = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "bank-secondary-2",
        isActive: false,
      }),
    });

    const res = await handleBanksPatch(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.isActive).toBe(false);

    const diskContent = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    const updated = diskContent.bankAccounts.find((b: any) => b.id === "bank-secondary-2");
    expect(updated.isActive).toBe(false);
  });

  // 3. DELETE berhasil
  it("3. DELETE berhasil menghapus rekening non-default", async () => {
    vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);
    vi.spyOn(dataStorage, "syncStorageFromDb").mockResolvedValue(true);
    vi.spyOn(dataStorage, "persistStorageToDb").mockResolvedValue(true);

    const req = new NextRequest("http://localhost:3000/api/events/admin/settings/banks?id=bank-secondary-2", {
      method: "DELETE",
    });

    const res = await handleBanksDelete(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    const diskContent = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    expect(diskContent.bankAccounts.some((b: any) => b.id === "bank-secondary-2")).toBe(false);
  });

  // 4. Set Default berhasil
  it("4. Set Default berhasil menetapkan rekening default baru", async () => {
    vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);
    vi.spyOn(dataStorage, "syncStorageFromDb").mockResolvedValue(true);
    vi.spyOn(dataStorage, "persistStorageToDb").mockResolvedValue(true);

    const req = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "bank-secondary-2",
        action: "SET_DEFAULT",
      }),
    });

    const res = await handleBanksPatch(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.isDefault).toBe(true);

    const diskContent = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    const newDefault = diskContent.bankAccounts.find((b: any) => b.id === "bank-secondary-2");
    const oldDefault = diskContent.bankAccounts.find((b: any) => b.id === "bank-default-1");
    expect(newDefault.isDefault).toBe(true);
    expect(oldDefault.isDefault).toBe(false);
  });

  // 5. CAS mencegah concurrent update
  it("5. CAS mencegah concurrent update ketika database mendeteksi LOST_UPDATE_PREVENTED", async () => {
    vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);
    vi.spyOn(dataStorage, "syncStorageFromDb").mockResolvedValue(true);
    // Simulate CAS failure on both initial and retry
    vi.spyOn(dataStorage, "persistStorageToDb").mockRejectedValue(
      new dataStorage.DatabasePersistenceError("LOST_UPDATE_PREVENTED: Rekaman telah diperbarui di PostgreSQL", "event_settings.json")
    );

    const req = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: "Rekening CAS Collision",
        bankName: "BSI",
        accountNumber: "9998887771",
        accountHolder: "PT Dago BSI",
      }),
    });

    const res = await handleBanksPost(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.error).toContain("Konflik pembaruan konkuren");

    // Local disk must remain clean
    const diskContent = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    expect(diskContent.bankAccounts.some((b: any) => b.bankName === "BSI")).toBe(false);
  });

  // 6. Dua payload dengan revision sama tetapi isi berbeda ditolak oleh revision guard
  it("6. Dua payload dengan revision sama tetapi isi berbeda ditolak oleh revision guard", () => {
    const basePolicy: EventRevenueSharingPolicy = {
      ...DEFAULT_EVENT_POLICY,
      _revision: 5,
      policyNotes: "Versi A",
    };
    eventsLib.saveEventSettingsToDisk(basePolicy, { forceDiskWrite: true });

    const competingPolicy: EventRevenueSharingPolicy = {
      ...DEFAULT_EVENT_POLICY,
      _revision: 5,
      policyNotes: "Versi B Berbeda",
    };

    // Attempting to overwrite with same revision but different content without forceDiskWrite must be rejected
    eventsLib.saveEventSettingsToDisk(competingPolicy);

    const disk = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    expect(disk.policyNotes).toBe("Versi A");
  });

  // 7. Retry satu kali setelah konflik konkurensi (LOST_UPDATE_PREVENTED retry 1x berhasil)
  it("7. Retry satu kali setelah konflik: percobaan pertama bentrok, retry re-sync sukses commit", async () => {
    vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);
    vi.spyOn(dataStorage, "syncStorageFromDb").mockResolvedValue(true);

    let attempts = 0;
    vi.spyOn(dataStorage, "persistStorageToDb").mockImplementation(async () => {
      attempts++;
      if (attempts === 1) {
        throw new dataStorage.DatabasePersistenceError("LOST_UPDATE_PREVENTED: Rekaman telah diperbarui", "event_settings.json");
      }
      return true;
    });

    const req = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: "Rekening Retry Sukses",
        bankName: "CIMB",
        accountNumber: "7778889990",
        accountHolder: "PT Dago CIMB",
      }),
    });

    const res = await handleBanksPost(req);
    const body = await res.json();

    expect(attempts).toBe(2);
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.bankName).toBe("CIMB");

    const disk = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    expect(disk.bankAccounts.some((b: any) => b.bankName === "CIMB")).toBe(true);
  });

  // 8. Konflik berulang menghasilkan HTTP 409
  it("8. Konflik berulang menghasilkan HTTP 409 setelah retry 1x habis", async () => {
    vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);
    vi.spyOn(dataStorage, "syncStorageFromDb").mockResolvedValue(true);

    let attempts = 0;
    vi.spyOn(dataStorage, "persistStorageToDb").mockImplementation(async () => {
      attempts++;
      throw new dataStorage.DatabasePersistenceError("LOST_UPDATE_PREVENTED: Rekaman telah diperbarui", "event_settings.json");
    });

    const req = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "bank-secondary-2",
        label: "Mandiri Updated",
      }),
    });

    const res = await handleBanksPatch(req);
    const body = await res.json();

    expect(attempts).toBe(2); // Initial attempt + 1 retry
    expect(res.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.error).toContain("Konflik pembaruan konkuren");
  });

  // 9. Neon tidak tersedia menghasilkan kegagalan yang aman (HTTP 503)
  it("9. Neon tidak tersedia saat pre-sync menghasilkan kegagalan yang aman (HTTP 503)", async () => {
    vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);
    // Simulate pre-sync failing because database is unreachable
    vi.spyOn(dataStorage, "syncStorageFromDb").mockResolvedValue(false);
    vi.spyOn(dataStorage, "syncStorageFromDbWithSnapshot").mockResolvedValue({
      success: false,
      status: "UNAVAILABLE",
    });
    const persistSpy = vi.spyOn(dataStorage, "persistStorageToDb");

    const originalEnv = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://mock@neon.tech/test";

    try {
      const req = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "Rekening Fail Closed",
          bankName: "Permata",
          accountNumber: "1122334455",
          accountHolder: "PT Dago Permata",
        }),
      });

      const res = await handleBanksPost(req);
      const body = await res.json();

      expect(res.status).toBe(503);
      expect(body.success).toBe(false);
      expect(persistSpy).not.toHaveBeenCalled();
    } finally {
      process.env.DATABASE_URL = originalEnv;
    }
  });

  // 10. Disk gagal setelah Neon commit (tetap return 201/200, cloud tetap source of truth)
  it("10. Disk gagal setelah Neon commit tetap mengembalikan respons sukses", async () => {
    vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);
    vi.spyOn(dataStorage, "syncStorageFromDb").mockResolvedValue(true);
    vi.spyOn(dataStorage, "persistStorageToDb").mockResolvedValue(true);

    // Simulate transient disk write error after DB commit
    vi.spyOn(eventsLib, "saveEventSettingsToDisk").mockImplementation(() => {
      throw new Error("EPERM: disk locked by backup process");
    });

    const req = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: "Rekening Disk Error Post-Commit",
        bankName: "OCBC",
        accountNumber: "6677889900",
        accountHolder: "PT Dago OCBC",
      }),
    });

    const res = await handleBanksPost(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.bankName).toBe("OCBC");
  });

  // 11. Restart dan rekonsiliasi dari Neon (syncStorageFromDb memulihkan disk lokal)
  it("11. Restart dan rekonsiliasi: syncStorageFromDb memulihkan disk lokal dari cloud", async () => {
    const cloudPolicy: EventRevenueSharingPolicy = {
      ...DEFAULT_EVENT_POLICY,
      _revision: 10,
      bankAccounts: [
        {
          id: "bank-recovered-cloud",
          label: "Rekening Pulih Dari Cloud",
          bankName: "BCA Cloud",
          accountNumber: "1010101010",
          accountHolder: "PT DAGO CLOUD",
          isDefault: true,
          isActive: true,
          accountType: "PLATFORM",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };

    // Reset local memory status to simulate app restart
    dataStorage.resetStorageSyncStatus();

    // Simulate test read handler returning cloud state after restart
    dataStorage.setTestDatabaseReadHandler(async (filename) => {
      if (filename === "event_settings.json") {
        return {
          value: JSON.stringify(cloudPolicy),
          updatedAt: new Date("2026-11-13T10:00:00.000Z"),
        };
      }
      return null;
    });

    const syncOk = await dataStorage.syncStorageFromDb("event_settings.json");
    expect(syncOk).toBe(true);

    const policy = eventsLib.getEventRevenuePolicy();
    expect(policy._revision).toBe(10);
    expect(policy.bankAccounts?.[0].bankName).toBe("BCA Cloud");
  });

  // 12. Organizer tidak berubah sebelum commit Neon berhasil (organizers.json bersih saat DB error)
  it("12. Organizer profile tidak berubah sebelum commit Neon berhasil", async () => {
    // Setup organizer session
    const mockOrgAuth = {
      authorized: true,
      role: "ORGANIZER" as const,
      scopeLevel: "ORGANIZER" as const,
      userId: "org-1",
      email: "partner@community.id",
      name: "Partner Komunitas",
    };

    vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue({ authorized: false });
    vi.spyOn(serverAuth, "assertOrganizerAuth").mockResolvedValue(mockOrgAuth);
    vi.spyOn(dataStorage, "syncStorageFromDb").mockResolvedValue(true);

    // Write initial organizer profile
    const initialOrganizers = [
      {
        id: "org-1",
        name: "Partner Komunitas",
        email: "partner@community.id",
        bankName: "Initial Bank",
        accountNumber: "11112222",
        accountHolder: "Partner Asli",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    fs.writeFileSync(ORGANIZERS_FILE, JSON.stringify(initialOrganizers, null, 2), "utf-8");

    // Simulate DB failure
    vi.spyOn(dataStorage, "persistStorageToDb").mockRejectedValue(new Error("Neon network timeout"));

    const req = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: "Rekening Mitra Baru",
        bankName: "Bank Baru Mitra",
        accountNumber: "9988776655",
        accountHolder: "Partner Komunitas Baru",
        organizerEmail: "partner@community.id",
      }),
    });

    const res = await handleBanksPost(req);
    expect(res.status).toBe(500);

    // Verify organizers.json was NOT mutated!
    const orgsAfter = JSON.parse(fs.readFileSync(ORGANIZERS_FILE, "utf-8"));
    expect(orgsAfter[0].bankName).toBe("Initial Bank");
    expect(orgsAfter[0].accountNumber).toBe("11112222");
  });

  // 13. Kompatibilitas pemanggil lama fungsi create/update
  it("13. Pemanggil lama fungsi createEventBankAccount tanpa options tetap berfungsi dan menulis disk", () => {
    const account = eventsLib.createEventBankAccount(
      {
        label: "Legacy Caller Account",
        bankName: "Danamon Legacy",
        accountNumber: "4443332221",
        accountHolder: "PT Dago Legacy",
      },
      "Admin Dago"
    );

    expect(account.id).toBeDefined();
    expect(account.bankName).toBe("Danamon Legacy");

    // Disk must have been written directly as legacy callers expect
    const disk = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    expect(disk.bankAccounts.some((b: any) => b.bankName === "Danamon Legacy")).toBe(true);
  });

  // 14. RBAC dan tenant isolation tetap terjaga
  it("14. RBAC: Penyelenggara ditolak dengan HTTP 403 jika mencoba mengubah rekening platform atau mitra lain", async () => {
    const mockOrgAuth = {
      authorized: true,
      role: "ORGANIZER" as const,
      scopeLevel: "ORGANIZER" as const,
      userId: "org-1",
      email: "partner@community.id",
      name: "Partner Komunitas",
    };

    vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue({ authorized: false });
    vi.spyOn(serverAuth, "assertOrganizerAuth").mockResolvedValue(mockOrgAuth);

    // Attempt to touch PLATFORM bank account
    const reqPlatform = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: "Illegal Platform Bank",
        bankName: "Mandiri",
        accountNumber: "8888999900",
        accountHolder: "Hacker Platform",
        accountType: "PLATFORM",
      }),
    });

    const resPlatform = await handleBanksPost(reqPlatform);
    expect(resPlatform.status).toBe(403);
    const bodyPlatform = await resPlatform.json();
    expect(bodyPlatform.error).toContain("FORBIDDEN");

    // Attempt to modify another organizer's email
    const reqTenant = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: "Illegal Tenant Bank",
        bankName: "Mandiri",
        accountNumber: "8888999900",
        accountHolder: "Victim Organizer",
        organizerEmail: "victim@othercommunity.id",
      }),
    });

    const resTenant = await handleBanksPost(reqTenant);
    expect(resTenant.status).toBe(403);
    const bodyTenant = await resTenant.json();
    expect(bodyTenant.error).toContain("FORBIDDEN");
  });

  // 15. GET Transparency
  it("15. GET menyajikan metadata transparansi sinkronisasi cloud", async () => {
    vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);
    vi.spyOn(dataStorage, "syncStorageFromDb").mockResolvedValue(true);

    const req = new NextRequest("http://localhost:3000/api/events/admin/settings/banks");
    const res = await handleBanksGet(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.meta).toBeDefined();
    expect(body.meta.source).toBe("NEON_DATABASE");
    expect(body.meta.isVerified).toBe(true);
    expect(body.meta.revision).toBeGreaterThanOrEqual(1);
  });

  // ===========================================================================
  // 16. TASK S-01B: INTERLEAVING CONCURRENCY BARRIERS & REQUEST ISOLATION
  // ===========================================================================
  describe("16. Interleaving Concurrency Barriers & Request Isolation Tests", () => {
    it("16.1 Interleaving CAS Barrier: Request A and B start concurrently; A commits first, B gets CAS conflict, re-syncs, and merges cleanly", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);

      // In-memory simulated cloud store
      let cloudDbUpdatedAt = new Date("2026-11-13T10:00:00.000Z");
      let cloudDbContent = fs.readFileSync(SETTINGS_FILE, "utf-8");

      // Mock database reader
      dataStorage.setTestDatabaseReadHandler(async (filename) => {
        if (filename === "event_settings.json") {
          return {
            value: cloudDbContent,
            updatedAt: new Date(cloudDbUpdatedAt.getTime()),
          };
        }
        return null;
      });

      // Mock persistStorageToDb using actual expectedUpdatedAt CAS semantics
      vi.spyOn(dataStorage, "persistStorageToDb").mockImplementation(
        async (filename, content, options) => {
          if (filename === "event_settings.json") {
            const expected = options?.expectedUpdatedAt;

            // CAS validation:
            if (expected && expected.getTime() !== cloudDbUpdatedAt.getTime()) {
              throw new dataStorage.DatabasePersistenceError(
                `LOST_UPDATE_PREVENTED: Expected ${expected.toISOString()} but DB is at ${cloudDbUpdatedAt.toISOString()}`,
                filename,
                true
              );
            }

            // Commit to simulated cloud DB
            cloudDbContent = content;
            cloudDbUpdatedAt = new Date(cloudDbUpdatedAt.getTime() + 1000);
            return true;
          }
          return true;
        }
      );

      // Create Request A
      const reqA = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "Bank Alpha",
          bankName: "BCA Alpha",
          accountNumber: "1111222233",
          accountHolder: "PT Dago Alpha",
        }),
      });

      // Create Request B
      const reqB = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "Bank Beta",
          bankName: "Mandiri Beta",
          accountNumber: "9999888877",
          accountHolder: "PT Dago Beta",
        }),
      });

      // Interleave: Request A starts first and enters Cloud-First pipeline
      const promiseA = handleBanksPost(reqA);
      // Wait for Request A's initial pre-sync to finish so gate is released, while DB remains at T0
      await new Promise((r) => setTimeout(r, 20));
      // Request B starts and reads the SAME version T0 before A has committed to Neon
      const promiseB = handleBanksPost(reqB);

      const [resA, resB] = await Promise.all([promiseA, promiseB]);
      const bodyA = await resA.json();
      const bodyB = await resB.json();

      expect(resA.status).toBe(201);
      expect(resB.status).toBe(201);
      expect(bodyA.success).toBe(true);
      expect(bodyB.success).toBe(true);

      // Verify that BOTH banks exist in the final cloud database content!
      const finalCloudPolicy = JSON.parse(cloudDbContent);
      expect(finalCloudPolicy.bankAccounts.some((b: any) => b.bankName === "BCA Alpha")).toBe(true);
      expect(finalCloudPolicy.bankAccounts.some((b: any) => b.bankName === "Mandiri Beta")).toBe(true);
      expect(finalCloudPolicy._revision).toBeGreaterThanOrEqual(3);
    });

    it("16.2 Candidate context isolation: Request A and B candidate contexts never cross-contaminate", () => {
      const basePolicy = eventsLib.getEventRevenuePolicy();

      const contextA = eventsLib.buildCreateEventBankAccount(
        {
          label: "Iso Bank A",
          bankName: "Bank A",
          accountNumber: "11111111",
          accountHolder: "Holder A",
        },
        "Admin A",
        basePolicy
      );

      const contextB = eventsLib.buildCreateEventBankAccount(
        {
          label: "Iso Bank B",
          bankName: "Bank B",
          accountNumber: "22222222",
          accountHolder: "Holder B",
        },
        "Admin B",
        basePolicy
      );

      // Verify A's candidate contains ONLY A
      expect(contextA.candidatePolicy.bankAccounts?.some((b) => b.bankName === "Bank A")).toBe(true);
      expect(contextA.candidatePolicy.bankAccounts?.some((b) => b.bankName === "Bank B")).toBe(false);

      // Verify B's candidate contains ONLY B
      expect(contextB.candidatePolicy.bankAccounts?.some((b) => b.bankName === "Bank B")).toBe(true);
      expect(contextB.candidatePolicy.bankAccounts?.some((b) => b.bankName === "Bank A")).toBe(false);
    });

    it("16.3 Organizer side-effects are isolated per request and never cross-contaminate", () => {
      const initialOrganizers = [
        {
          id: "org-1",
          name: "Org 1",
          email: "org1@community.id",
          bankName: "Old Bank 1",
          accountNumber: "1111",
          accountHolder: "Org 1",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "org-2",
          name: "Org 2",
          email: "org2@community.id",
          bankName: "Old Bank 2",
          accountNumber: "2222",
          accountHolder: "Org 2",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      fs.writeFileSync(ORGANIZERS_FILE, JSON.stringify(initialOrganizers, null, 2), "utf-8");

      const basePolicy = eventsLib.getEventRevenuePolicy();

      const context1 = eventsLib.buildCreateEventBankAccount(
        {
          label: "Org 1 Payout",
          bankName: "New Bank 1",
          accountNumber: "11119999",
          accountHolder: "Org 1 New",
          accountType: "ORGANIZER",
          organizerEmail: "org1@community.id",
        },
        "Mitra 1",
        basePolicy
      );

      const context2 = eventsLib.buildCreateEventBankAccount(
        {
          label: "Org 2 Payout",
          bankName: "New Bank 2",
          accountNumber: "22228888",
          accountHolder: "Org 2 New",
          accountType: "ORGANIZER",
          organizerEmail: "org2@community.id",
        },
        "Mitra 2",
        basePolicy
      );

      // Execute side effect for Org 2 ONLY
      expect(context2.organizerSideEffect).toBeDefined();
      context2.organizerSideEffect!();

      const orgsAfter = JSON.parse(fs.readFileSync(ORGANIZERS_FILE, "utf-8"));
      // Org 2 is updated
      expect(orgsAfter.find((o: any) => o.id === "org-2").bankName).toBe("New Bank 2");
      // Org 1 is UNTOUCHED
      expect(orgsAfter.find((o: any) => o.id === "org-1").bankName).toBe("Old Bank 1");

      // Execute side effect for Org 1
      expect(context1.organizerSideEffect).toBeDefined();
      context1.organizerSideEffect!();

      const orgsFinal = JSON.parse(fs.readFileSync(ORGANIZERS_FILE, "utf-8"));
      expect(orgsFinal.find((o: any) => o.id === "org-1").bankName).toBe("New Bank 1");
    });

    it("16.4 Snapshot isolation: Concurrent sync queries with interleaving resolution never swap timestamps", async () => {
      const t0 = new Date("2026-11-13T10:00:00.000Z");
      const t1 = new Date("2026-11-13T10:05:00.000Z");

      let queryCount = 0;
      dataStorage.setTestDatabaseReadHandler(async (filename) => {
        queryCount++;
        const currentCount = queryCount;
        if (currentCount === 1) {
          return {
            value: fs.readFileSync(SETTINGS_FILE, "utf-8"),
            updatedAt: t0,
          };
        } else {
          return {
            value: fs.readFileSync(SETTINGS_FILE, "utf-8"),
            updatedAt: t1,
          };
        }
      });

      // Execute sync A
      const snapshotA = await dataStorage.syncStorageFromDbWithSnapshot("event_settings.json");
      expect(snapshotA.success).toBe(true);
      expect(snapshotA.updatedAt?.toISOString()).toBe(t0.toISOString());

      // Execute sync B
      const snapshotB = await dataStorage.syncStorageFromDbWithSnapshot("event_settings.json");
      expect(snapshotB.success).toBe(true);
      expect(snapshotB.updatedAt?.toISOString()).toBe(t1.toISOString());

      // Snapshot A still strictly holds T0 even after sync B has finished and updated any global state
      expect(snapshotA.updatedAt?.toISOString()).toBe(t0.toISOString());
    });

    it("16.5 Missing snapshot fail-closed: POST, PATCH, and DELETE reject with 503 and perform zero disk/cloud writes", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);
      const persistSpy = vi.spyOn(dataStorage, "persistStorageToDb");

      // Simulate missing/invalid snapshot from sync
      vi.spyOn(dataStorage, "syncStorageFromDbWithSnapshot").mockResolvedValue({
        success: true,
        status: "SYNCED",
        updatedAt: undefined, // missing snapshot!
      });

      const diskBefore = fs.readFileSync(SETTINGS_FILE, "utf-8");

      // 1. POST
      const reqPost = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "No Snapshot Post",
          bankName: "BNI",
          accountNumber: "5555666677",
          accountHolder: "PT Dago",
        }),
      });
      const resPost = await handleBanksPost(reqPost);
      expect(resPost.status).toBe(503);
      const bodyPost = await resPost.json();
      expect(bodyPost.error).toContain("Tidak dapat menyinkronkan data snapshot terbaru");

      // 2. PATCH
      const reqPatch = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "bank-secondary-2",
          label: "No Snapshot Patch",
        }),
      });
      const resPatch = await handleBanksPatch(reqPatch);
      expect(resPatch.status).toBe(503);

      // 3. DELETE
      const reqDelete = new NextRequest("http://localhost:3000/api/events/admin/settings/banks?id=bank-secondary-2", {
        method: "DELETE",
      });
      const resDelete = await handleBanksDelete(reqDelete);
      expect(resDelete.status).toBe(503);

      // Verify no persistence occurred and disk was not modified (fail-closed)
      expect(persistSpy).not.toHaveBeenCalled();
      const diskAfter = fs.readFileSync(SETTINGS_FILE, "utf-8");
      expect(diskAfter).toBe(diskBefore);
    });

    it("16.6 Retry conflict kedua: HTTP 409 dikembalikan dan side effect organizer tidak pernah dijalankan", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);
      
      const t0 = new Date("2026-11-13T10:00:00.000Z");
      vi.spyOn(dataStorage, "syncStorageFromDbWithSnapshot").mockResolvedValue({
        success: true,
        status: "SYNCED",
        updatedAt: t0,
      });

      // Both initial and retry fail with LOST_UPDATE_PREVENTED
      let persistAttempts = 0;
      vi.spyOn(dataStorage, "persistStorageToDb").mockImplementation(async () => {
        persistAttempts++;
        throw new dataStorage.DatabasePersistenceError("LOST_UPDATE_PREVENTED: Database changed concurrently", "event_settings.json");
      });

      // Set initial organizer
      const initialOrgs = [
        {
          id: "org-conflict",
          name: "Org Conflict",
          email: "conflict@community.id",
          bankName: "Unchanged Bank",
          accountNumber: "9999",
          accountHolder: "Org Conflict",
        },
      ];
      fs.writeFileSync(ORGANIZERS_FILE, JSON.stringify(initialOrgs, null, 2), "utf-8");

      const req = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "Org Payout Retry Fail",
          bankName: "Changed Bank Should Not Exist",
          accountNumber: "88887777",
          accountHolder: "Org Conflict",
          accountType: "ORGANIZER",
          organizerEmail: "conflict@community.id",
        }),
      });

      const res = await handleBanksPost(req);
      expect(res.status).toBe(409);
      expect(persistAttempts).toBe(2); // Attempt 1 + Exactly 1 Retry

      // Verify organizer side effect was NEVER executed
      const orgsAfter = JSON.parse(fs.readFileSync(ORGANIZERS_FILE, "utf-8"));
      expect(orgsAfter.find((o: any) => o.id === "org-conflict").bankName).toBe("Unchanged Bank");
    });

    it("16.7 Side effect hanya dijalankan setelah commit Neon berhasil dan tepat 1 kali saat retry sukses", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);

      const t0 = new Date("2026-11-13T10:00:00.000Z");
      const t1 = new Date("2026-11-13T10:05:00.000Z");

      let syncCount = 0;
      vi.spyOn(dataStorage, "syncStorageFromDbWithSnapshot").mockImplementation(async () => {
        syncCount++;
        return {
          success: true,
          status: "SYNCED",
          updatedAt: syncCount === 1 ? t0 : t1,
        };
      });

      let bankPersistCalls = 0;
      vi.spyOn(dataStorage, "persistStorageToDb").mockImplementation(async (file, _content, options) => {
        if (file === "event_settings.json") {
          bankPersistCalls++;
          if (bankPersistCalls === 1) {
            // Attempt 1 fails CAS
            throw new dataStorage.DatabasePersistenceError("LOST_UPDATE_PREVENTED", "event_settings.json");
          }
          // Attempt 2 (retry) succeeds with strict CAS
          expect(options?.expectedUpdatedAt?.toISOString()).toBe(t1.toISOString());
          expect(options?.requireCas).toBe(true);
          return true;
        }
        return true;
      });

      const initialOrgs = [
        {
          id: "org-retry-success",
          name: "Org Retry Success",
          email: "retryok@community.id",
          bankName: "Original Bank",
          accountNumber: "1234",
          accountHolder: "Org Retry",
        },
      ];
      fs.writeFileSync(ORGANIZERS_FILE, JSON.stringify(initialOrgs, null, 2), "utf-8");

      const req = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "Org Payout Retry Ok",
          bankName: "New Successful Bank",
          accountNumber: "99887766",
          accountHolder: "Org Retry",
          accountType: "ORGANIZER",
          organizerEmail: "retryok@community.id",
        }),
      });

      const res = await handleBanksPost(req);
      expect(res.status).toBe(201);
      expect(bankPersistCalls).toBe(2);

      // Verify organizer was updated exactly once to the new bank
      const orgsAfter = JSON.parse(fs.readFileSync(ORGANIZERS_FILE, "utf-8"));
      expect(orgsAfter.find((o: any) => o.id === "org-retry-success").bankName).toBe("New Successful Bank");
    });
  });
});
