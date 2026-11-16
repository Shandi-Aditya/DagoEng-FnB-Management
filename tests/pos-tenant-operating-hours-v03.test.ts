import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getTenantOperations, POST as postTenantOperations } from "@/app/api/tenant/operations/route";
import {
  isTenantAcceptingOrders,
  DEFAULT_TENANT_OPERATIONS,
  type TenantOperationConfig,
} from "@/lib/operating-hours";
import { writePersistentData, readPersistentData } from "@/lib/persistent-storage";

describe("Task V-03: Simpan Jam Operasional & Status Buka/Tutup Mitra ke Server", () => {
  const TEST_TENANT_ID = "tenant-ks";

  beforeEach(async () => {
    // Reset test storage to clean default state
    await writePersistentData("tenant_operations.json", DEFAULT_TENANT_OPERATIONS);
  });

  describe("1. Server Persistence Endpoint (/api/tenant/operations)", () => {
    it("GET mengembalikan data jam operasional tersimpan dari server", async () => {
      const req = new NextRequest("http://localhost:3000/api/tenant/operations");
      const res = await getTenantOperations(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.tenantOperations).toBeDefined();
      expect(data.tenantOperations[TEST_TENANT_ID]).toBeDefined();
      expect(data.tenantOperations[TEST_TENANT_ID].openTime).toBe("07:00");
      expect(data.tenantOperations[TEST_TENANT_ID].closeTime).toBe("22:00");
    });

    it("POST menyimpan perubahan jam buka-tutup mitra ke disk server", async () => {
      const updatedOps: Record<string, TenantOperationConfig> = {
        ...DEFAULT_TENANT_OPERATIONS,
        [TEST_TENANT_ID]: {
          ...DEFAULT_TENANT_OPERATIONS[TEST_TENANT_ID],
          openTime: "09:00",
          closeTime: "17:00",
          notes: "Jam baru khusus cabang Singaraja",
        },
      };

      const postReq = new NextRequest("http://localhost:3000/api/tenant/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantOperations: updatedOps }),
      });

      const postRes = await postTenantOperations(postReq);
      expect(postRes.status).toBe(200);

      // Verifikasi bahwa data benar-benar tersimpan di persistent disk storage (simulasi reload)
      const diskData = await readPersistentData<Record<string, TenantOperationConfig>>(
        "tenant_operations.json",
        DEFAULT_TENANT_OPERATIONS
      );

      expect(diskData[TEST_TENANT_ID].openTime).toBe("09:00");
      expect(diskData[TEST_TENANT_ID].closeTime).toBe("17:00");
      expect(diskData[TEST_TENANT_ID].notes).toBe("Jam baru khusus cabang Singaraja");
    });
  });

  describe("2. Acceptance Criteria: Ubah Jam -> Reload -> Jam Tetap", () => {
    it("menjaga perubahan jam operasional setelah reload dan tidak kembali ke 07.00–22.00", async () => {
      // 1. Simpan perubahan jam menjadi 10:00 - 23:00
      const customOps: Record<string, TenantOperationConfig> = {
        ...DEFAULT_TENANT_OPERATIONS,
        [TEST_TENANT_ID]: {
          isOpenOrder: true,
          openTime: "10:00",
          closeTime: "23:00",
          tenantId: TEST_TENANT_ID,
          tenantName: "Kopi Senja",
        },
      };

      const saveReq = new NextRequest("http://localhost:3000/api/tenant/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantOperations: customOps }),
      });
      await postTenantOperations(saveReq);

      // 2. Simulasi Reload: Lakukan GET baru dari server
      const reloadReq = new NextRequest("http://localhost:3000/api/tenant/operations");
      const reloadRes = await getTenantOperations(reloadReq);
      expect(reloadRes.status).toBe(200);

      const reloadedData = await reloadRes.json();
      const reloadedTenant = reloadedData.tenantOperations[TEST_TENANT_ID];

      // Kriteria: Jam tetap 10:00 - 23:00 dan TIDAK kembali ke 07:00 - 22:00
      expect(reloadedTenant.openTime).toBe("10:00");
      expect(reloadedTenant.closeTime).toBe("23:00");
      expect(reloadedTenant.openTime).not.toBe("07:00");
      expect(reloadedTenant.closeTime).not.toBe("22:00");
    });
  });

  describe("3. Acceptance Criteria: Tombol Buka/Tutup Manual Mengalahkan Jadwal", () => {
    it("tombol 'Buka' manual mengalahkan jadwal di luar jam operasional (override OPEN)", () => {
      // Jadwal mitra: 09:00 - 17:00
      // Waktu sekarang: 20:30 (di luar jam buka)
      const outsideHoursDate = new Date("2026-11-16T20:30:00");

      const scheduledOps: Record<string, TenantOperationConfig> = {
        [TEST_TENANT_ID]: {
          isOpenOrder: true,
          openTime: "09:00",
          closeTime: "17:00",
        },
      };

      // Tanpa manual override -> status tutup karena di luar jam operasional
      const normalCheck = isTenantAcceptingOrders(TEST_TENANT_ID, scheduledOps, outsideHoursDate);
      expect(normalCheck.isOpen).toBe(false);
      expect(normalCheck.reason).toContain("di luar jam operasional");

      // Operator klik "Buka" manual (manualOverride: "OPEN")
      const manualOpenOps: Record<string, TenantOperationConfig> = {
        [TEST_TENANT_ID]: {
          ...scheduledOps[TEST_TENANT_ID],
          isOpenOrder: true,
          manualOverride: "OPEN",
        },
      };

      // Kriteria: Manual Buka mengalahkan jadwal sehingga kasir langsung bisa pesan
      const overrideCheck = isTenantAcceptingOrders(TEST_TENANT_ID, manualOpenOps, outsideHoursDate);
      expect(overrideCheck.isOpen).toBe(true);
      expect(overrideCheck.reason).toContain("Buka manual");
    });

    it("tombol 'Tutup' manual mengalahkan jadwal di dalam jam operasional (override CLOSED)", () => {
      // Jadwal mitra: 08:00 - 22:00
      // Waktu sekarang: 12:00 (di dalam jam buka)
      const midDayDate = new Date("2026-11-16T12:00:00");

      const scheduledOps: Record<string, TenantOperationConfig> = {
        [TEST_TENANT_ID]: {
          isOpenOrder: true,
          openTime: "08:00",
          closeTime: "22:00",
        },
      };

      // Tanpa manual override -> status buka normal
      const normalCheck = isTenantAcceptingOrders(TEST_TENANT_ID, scheduledOps, midDayDate);
      expect(normalCheck.isOpen).toBe(true);

      // Operator klik "Tutup" manual (manualOverride: "CLOSED")
      const manualCloseOps: Record<string, TenantOperationConfig> = {
        [TEST_TENANT_ID]: {
          ...scheduledOps[TEST_TENANT_ID],
          isOpenOrder: false,
          manualOverride: "CLOSED",
          temporaryClosedReason: "Habis bahan baku mendadak",
        },
      };

      // Kriteria: Manual Tutup mengalahkan jadwal operasional
      const closedCheck = isTenantAcceptingOrders(TEST_TENANT_ID, manualCloseOps, midDayDate);
      expect(closedCheck.isOpen).toBe(false);
      expect(closedCheck.reason).toContain("Habis bahan baku mendadak");
    });

    it("reset manual override mengembalikan status ke jadwal operasional normal", () => {
      const scheduledOps: Record<string, TenantOperationConfig> = {
        [TEST_TENANT_ID]: {
          isOpenOrder: true,
          openTime: "09:00",
          closeTime: "17:00",
          manualOverride: null, // Reset override
        },
      };

      // Jam 14:00 -> di dalam jam operasional -> kembali buka
      const dayDate = new Date("2026-11-16T14:00:00");
      expect(isTenantAcceptingOrders(TEST_TENANT_ID, scheduledOps, dayDate).isOpen).toBe(true);

      // Jam 21:00 -> di luar jam operasional -> kembali tutup
      const nightDate = new Date("2026-11-16T21:00:00");
      expect(isTenantAcceptingOrders(TEST_TENANT_ID, scheduledOps, nightDate).isOpen).toBe(false);
    });
  });

  describe("4. Acceptance Criteria: Integrasi Layar Kasir POS", () => {
    it("memastikan kasir langsung dapat memesan menu saat mitra dibuka manual walau di luar jam operasional", () => {
      // Skenario: Kasir bertugas jam 23:00 malam (jadwal tutup 22:00)
      const lateNight = new Date("2026-11-16T23:00:00");

      const operationsBefore: Record<string, TenantOperationConfig> = {
        [TEST_TENANT_ID]: {
          isOpenOrder: true,
          openTime: "07:00",
          closeTime: "22:00",
          manualOverride: null,
        },
      };

      // Kasir awalnya tertolak
      const checkBefore = isTenantAcceptingOrders(TEST_TENANT_ID, operationsBefore, lateNight);
      expect(checkBefore.isOpen).toBe(false);

      // Operator menekan tombol "Buka" di Pengaturan
      const operationsAfterOpen: Record<string, TenantOperationConfig> = {
        [TEST_TENANT_ID]: {
          ...operationsBefore[TEST_TENANT_ID],
          isOpenOrder: true,
          manualOverride: "OPEN",
        },
      };

      // Kasir sekarang langsung diizinkan pesan menu Kopi Senja
      const checkAfter = isTenantAcceptingOrders(TEST_TENANT_ID, operationsAfterOpen, lateNight);
      expect(checkAfter.isOpen).toBe(true);
    });
  });
});
