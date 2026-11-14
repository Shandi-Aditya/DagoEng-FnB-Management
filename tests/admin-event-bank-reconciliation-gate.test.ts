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

describe("Tahap 6 — Event Bank Accounts Reconciliation Gate & Persistence Hardening", () => {
  let backupSettings: string | null = null;

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

    const testPolicy: EventRevenueSharingPolicy = {
      ...DEFAULT_EVENT_POLICY,
      bankAccounts: JSON.parse(JSON.stringify(initialAccounts)),
      bankHistory: [],
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(testPolicy, null, 2), "utf-8");
    eventsLib.saveEventSettingsToDisk(testPolicy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    dataStorage.resetStorageSyncStatus();

    if (backupSettings !== null) {
      fs.writeFileSync(SETTINGS_FILE, backupSettings, "utf-8");
      try {
        eventsLib.saveEventSettingsToDisk(JSON.parse(backupSettings));
      } catch (_) {}
    } else if (fs.existsSync(SETTINGS_FILE)) {
      fs.unlinkSync(SETTINGS_FILE);
    }
  });

  // ===========================================================================
  // 1. RECONCILIATION GATE PROTECTION TESTS (POST, PATCH, DELETE)
  // ===========================================================================
  describe("1. Reconciliation Gate Enforcement on HTTP Handlers", () => {
    it("1.1 POST when gate is active must return HTTP 503 and reject creation", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);
      const persistSpy = vi.spyOn(dataStorage, "persistStorageToDb");

      // Activate gate
      dataStorage.setReconciliationGateForTest("event_settings.json", true);

      const req = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "Rekening Baru BNI",
          bankName: "BNI",
          accountNumber: "5556667778",
          accountHolder: "PT Dago Hub Baru",
        }),
      });

      const res = await handleBanksPost(req);
      const data = await res.json();

      expect(res.status).toBe(503);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Proses sinkronisasi database sedang berlangsung");
      expect(persistSpy).not.toHaveBeenCalled();
    });

    it("1.2 PATCH when gate is active must return HTTP 503 and reject update", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);
      const persistSpy = vi.spyOn(dataStorage, "persistStorageToDb");

      // Activate gate
      dataStorage.setReconciliationGateForTest("event_settings.json", true);

      const req = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "bank-secondary-2",
          label: "Nama Diubah Saat Gate Aktif",
        }),
      });

      const res = await handleBanksPatch(req);
      const data = await res.json();

      expect(res.status).toBe(503);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Proses sinkronisasi database sedang berlangsung");
      expect(persistSpy).not.toHaveBeenCalled();
    });

    it("1.3 DELETE when gate is active must return HTTP 503 and reject deletion", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);
      const persistSpy = vi.spyOn(dataStorage, "persistStorageToDb");

      // Activate gate
      dataStorage.setReconciliationGateForTest("event_settings.json", true);

      const req = new NextRequest("http://localhost:3000/api/events/admin/settings/banks?id=bank-secondary-2", {
        method: "DELETE",
      });

      const res = await handleBanksDelete(req);
      const data = await res.json();

      expect(res.status).toBe(503);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Proses sinkronisasi database sedang berlangsung");
      expect(persistSpy).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 2. MEMORY AND DISK INTEGRITY UNDER GATE REJECTION
  // ===========================================================================
  describe("2. Memory, Disk, and Persistence Isolation Under Gate Rejection", () => {
    it("2.1 Rejection by gate does not modify in-memory state", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);

      const initialCount = eventsLib.getEventBankAccounts().length;
      dataStorage.setReconciliationGateForTest("event_settings.json", true);

      const req = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "Rekening Ghost",
          bankName: "BRI",
          accountNumber: "9998887776",
          accountHolder: "Ghost Holder",
        }),
      });

      await handleBanksPost(req);

      const accountsAfter = eventsLib.getEventBankAccounts();
      expect(accountsAfter.length).toBe(initialCount);
      expect(accountsAfter.find((b) => b.bankName === "BRI")).toBeUndefined();
    });

    it("2.2 Rejection by gate does not modify physical disk replica", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);

      const diskBefore = fs.readFileSync(SETTINGS_FILE, "utf-8");
      dataStorage.setReconciliationGateForTest("event_settings.json", true);

      const req = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "Rekening Ghost Disk",
          bankName: "BSI",
          accountNumber: "1112223334",
          accountHolder: "BSI Holder",
        }),
      });

      await handleBanksPost(req);

      const diskAfter = fs.readFileSync(SETTINGS_FILE, "utf-8");
      expect(diskAfter).toBe(diskBefore);
    });

    it("2.3 No database persistence query is triggered when operation is rejected by gate", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);
      const persistSpy = vi.spyOn(dataStorage, "persistStorageToDb");

      dataStorage.setReconciliationGateForTest("event_settings.json", true);

      const reqPost = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "Rekening BNI",
          bankName: "BNI",
          accountNumber: "9988776655",
          accountHolder: "BNI Holder",
        }),
      });
      await handleBanksPost(reqPost);

      const reqPatch = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "bank-secondary-2", label: "Changed" }),
      });
      await handleBanksPatch(reqPatch);

      const reqDelete = new NextRequest("http://localhost:3000/api/events/admin/settings/banks?id=bank-secondary-2", {
        method: "DELETE",
      });
      await handleBanksDelete(reqDelete);

      expect(persistSpy).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 3. NORMAL OPERATION & DATABASE PERSISTENCE WHEN GATE INACTIVE
  // ===========================================================================
  describe("3. Normal Operation and Database Persistence When Gate Inactive", () => {
    it("3.1 POST creates new bank account, persists to DB, and returns HTTP 201", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);
      const persistSpy = vi.spyOn(dataStorage, "persistStorageToDb").mockResolvedValue(true);

      const req = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "Rekening Operasional CIMB",
          bankName: "CIMB Niaga",
          accountNumber: "700123456789",
          accountHolder: "PT Dago Hub Kreatif",
        }),
      });

      const res = await handleBanksPost(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.bankName).toBe("CIMB Niaga");
      expect(persistSpy).toHaveBeenCalledWith("event_settings.json", expect.any(String), expect.objectContaining({ requireCas: true }));

      // Verify persisted in memory
      const allBanks = eventsLib.getEventBankAccounts();
      expect(allBanks.some((b) => b.bankName === "CIMB Niaga")).toBe(true);
    });

    it("3.2 PATCH updates existing account, persists to DB, and returns HTTP 200", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);
      const persistSpy = vi.spyOn(dataStorage, "persistStorageToDb").mockResolvedValue(true);

      const req = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "bank-secondary-2",
          label: "Rekening Sekunder Updated",
        }),
      });

      const res = await handleBanksPatch(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.label).toBe("Rekening Sekunder Updated");
      expect(persistSpy).toHaveBeenCalled();
    });

    it("3.3 DELETE removes account, persists to DB, and returns HTTP 200", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);
      const persistSpy = vi.spyOn(dataStorage, "persistStorageToDb").mockResolvedValue(true);

      const req = new NextRequest("http://localhost:3000/api/events/admin/settings/banks?id=bank-secondary-2", {
        method: "DELETE",
      });

      const res = await handleBanksDelete(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(persistSpy).toHaveBeenCalled();

      const allBanks = eventsLib.getEventBankAccounts();
      expect(allBanks.find((b) => b.id === "bank-secondary-2")).toBeUndefined();
    });
  });

  // ===========================================================================
  // 4. DATABASE PERSISTENCE FAILURE & ROLLBACK SAFETY
  // ===========================================================================
  describe("4. Database Persistence Failure and Rollback Safety", () => {
    it("4.1 should return HTTP 500 and rollback local disk when persistStorageToDb fails on POST", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);
      vi.spyOn(dataStorage, "persistStorageToDb").mockRejectedValue(new Error("Connection refused: Neon DB"));

      const diskBefore = fs.readFileSync(SETTINGS_FILE, "utf-8");

      const req = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "Rekening Gagal DB",
          bankName: "Permata",
          accountNumber: "8887776665",
          accountHolder: "PT Dago Permata",
        }),
      });

      const res = await handleBanksPost(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Gagal mengamankan penyimpanan ke database cloud");

      // Verify disk rolled back
      const diskAfter = fs.readFileSync(SETTINGS_FILE, "utf-8");
      const policyAfter = JSON.parse(diskAfter);
      expect(policyAfter.bankAccounts.find((b: any) => b.bankName === "Permata")).toBeUndefined();
    });

    it("4.2 Rollback must NOT execute or overwrite if reconciliation gate became active", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);
      const saveSpy = vi.spyOn(eventsLib, "saveEventSettingsToDisk");

      vi.spyOn(dataStorage, "persistStorageToDb").mockImplementation(async () => {
        // Simulate reconciliation gate activating while DB write was in-flight
        dataStorage.setReconciliationGateForTest("event_settings.json", true);
        throw new Error("Neon timeout 8000ms");
      });

      const req = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "Rekening Concurrent Reconcile",
          bankName: "Danamon",
          accountNumber: "4445556667",
          accountHolder: "PT Danamon Hub",
        }),
      });

      const res = await handleBanksPost(req);
      expect(res.status).toBe(500);

      // saveEventSettingsToDisk was NOT called for rollback because gate was active!
      expect(saveSpy).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 5. DETERMINISTIC CONCURRENCY: IN-FLIGHT WRITES AND RECONCILIATION
  // ===========================================================================
  describe("5. Deterministic Concurrency: Bank Writes and Reconciliation Drain", () => {
    it("5.1 Reconciliation drain loop must wait for in-flight bank account write to finish before reading DB", async () => {
      let resolveDbWrite!: (val: boolean) => void;
      const inFlightWritePromise = new Promise<boolean>((resolve) => {
        resolveDbWrite = resolve;
      });

      // Register active in-flight write
      dataStorage.registerInFlightWrite("event_settings.json", inFlightWritePromise);
      expect(dataStorage.getInFlightWriteCount("event_settings.json")).toBe(1);

      let dbReadExecuted = false;
      dataStorage.setTestDatabaseReadHandler(async () => {
        dbReadExecuted = true;
        const policy: EventRevenueSharingPolicy = {
          ...DEFAULT_EVENT_POLICY,
          bankAccounts: [
            ...initialAccounts,
            {
              id: "bank-from-cloud",
              label: "Cloud Synced Bank",
              bankName: "BSI",
              accountNumber: "7778889990",
              accountHolder: "Cloud PT",
              isDefault: false,
              isActive: true,
              accountType: "PLATFORM",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        };
        return { value: JSON.stringify(policy) };
      });

      // Start reconciliation (it will wait in drain loop)
      const reconPromise = dataStorage.syncStorageFromDb("event_settings.json");

      // While in-flight write is pending, reconciliation must be holding gate and not finished read
      expect(dataStorage.isReconciliationGateActive("event_settings.json")).toBe(true);
      expect(dbReadExecuted).toBe(false);

      // Resolve the in-flight write
      resolveDbWrite(true);
      await inFlightWritePromise;

      // Now reconciliation finishes
      const syncResult = await reconPromise;
      expect(syncResult).toBe(true);
      expect(dbReadExecuted).toBe(true);
      expect(dataStorage.isReconciliationGateActive("event_settings.json")).toBe(false);
      expect(dataStorage.getStorageSyncStatus("event_settings.json")).toBe("SYNCED");

      const banks = eventsLib.getEventBankAccounts();
      expect(banks.some((b) => b.id === "bank-from-cloud")).toBe(true);
    });
  });

  // ===========================================================================
  // 6. DOMAIN LEVEL PROTECTION (LIB/EVENTS.TS DIRECT INVOCATIONS)
  // ===========================================================================
  describe("6. Domain Level Protection in src/lib/events.ts", () => {
    it("6.1 createEventBankAccount throws Error when reconciliation gate is active", () => {
      dataStorage.setReconciliationGateForTest("event_settings.json", true);

      expect(() => {
        eventsLib.createEventBankAccount({
          label: "Direct Bank",
          bankName: "BCA",
          accountNumber: "12345678",
          accountHolder: "Direct User",
        });
      }).toThrow("Proses sinkronisasi database sedang berlangsung");
    });

    it("6.2 updateEventBankAccount throws Error when reconciliation gate is active", () => {
      dataStorage.setReconciliationGateForTest("event_settings.json", true);

      expect(() => {
        eventsLib.updateEventBankAccount("bank-secondary-2", {
          label: "Direct Update",
        });
      }).toThrow("Proses sinkronisasi database sedang berlangsung");
    });

    it("6.3 setDefaultEventBankAccount throws Error when reconciliation gate is active", () => {
      dataStorage.setReconciliationGateForTest("event_settings.json", true);

      expect(() => {
        eventsLib.setDefaultEventBankAccount("bank-secondary-2");
      }).toThrow("Proses sinkronisasi database sedang berlangsung");
    });

    it("6.4 deleteEventBankAccount throws Error when reconciliation gate is active", () => {
      dataStorage.setReconciliationGateForTest("event_settings.json", true);

      expect(() => {
        eventsLib.deleteEventBankAccount("bank-secondary-2");
      }).toThrow("Proses sinkronisasi database sedang berlangsung");
    });

    it("6.5 saveEventSettingsToDisk aborts without modifying memory or disk when gate is active", () => {
      const diskBefore = fs.readFileSync(SETTINGS_FILE, "utf-8");
      dataStorage.setReconciliationGateForTest("event_settings.json", true);

      const mutatedPolicy = {
        ...DEFAULT_EVENT_POLICY,
        defaultPlatformFeePercent: 49,
      };

      eventsLib.saveEventSettingsToDisk(mutatedPolicy);

      const diskAfter = fs.readFileSync(SETTINGS_FILE, "utf-8");
      expect(diskAfter).toBe(diskBefore);
      expect(eventsLib.getEventRevenuePolicy().defaultPlatformFeePercent).not.toBe(49);
    });
  });

  // ===========================================================================
  // 7. EXISTING RBAC & BUSINESS VALIDATION PRESERVATION
  // ===========================================================================
  describe("7. Existing RBAC & Business Validations Preservation", () => {
    it("7.1 Unauthenticated requests are rejected with HTTP 403", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue({
        authorized: false,
        error: "UNAUTHORIZED: Anda harus login.",
      });
      vi.spyOn(serverAuth, "assertOrganizerAuth").mockResolvedValue({
        authorized: false,
        error: "Akses ditolak: Autentikasi sesi penyelenggara diperlukan.",
      });

      const req = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankName: "Hack", accountNumber: "123", accountHolder: "Hacker" }),
      });

      const res = await handleBanksPost(req);
      expect(res.status).toBe(403);
    });

    it("7.2 Account number with less than 5 digits is rejected with HTTP 400", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);

      const req = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "Short Number",
          bankName: "BCA",
          accountNumber: "1234",
          accountHolder: "Test",
        }),
      });

      const res = await handleBanksPost(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("minimal 5 digit angka");
    });

    it("7.3 Missing required fields are rejected with HTTP 400", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);

      const req = new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "Incomplete",
          bankName: "BCA",
        }),
      });

      const res = await handleBanksPost(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("wajib diisi");
    });

    it("7.4 Cannot delete default platform account (HTTP 400)", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);

      const req = new NextRequest("http://localhost:3000/api/events/admin/settings/banks?id=bank-default-1", {
        method: "DELETE",
      });

      const res = await handleBanksDelete(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("Rekening default platform tidak dapat dihapus");
    });

    it("7.5 Cannot set an inactive bank account as default platform (HTTP 400)", async () => {
      vi.spyOn(serverAuth, "assertEventAdmin").mockResolvedValue(mockAdminAuth);
      vi.spyOn(dataStorage, "persistStorageToDb").mockResolvedValue(true);

      // First deactivate secondary account
      await handleBanksPatch(
        new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: "bank-secondary-2", isActive: false }),
        })
      );

      // Attempt to set as default
      const res = await handleBanksPatch(
        new NextRequest("http://localhost:3000/api/events/admin/settings/banks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: "bank-secondary-2", action: "SET_DEFAULT" }),
        })
      );
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("Rekening yang dinonaktifkan tidak dapat dijadikan rekening default");
    });
  });
});
