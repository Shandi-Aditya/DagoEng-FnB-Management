import fs from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  defaultTenantsState,
  applyTenantsCommand,
  tenantsDomainSpec,
  buildTenantProfileWithDefaults,
} from "@/lib/sync-domains/config-spec";
import {
  checkTenantAutoSuspension,
  isTenantActive,
  isTenantSuspended,
  setTenantStatus,
  getTenantProfile,
  saveTenantProfile,
  type TenantProfileData,
} from "@/lib/tenant";
import {
  getAllTenantRevenueSplits,
  setTenantRevenueSplit,
  calculateSettlement,
} from "@/lib/settlement";
import {
  findBlockedOrderTenant,
  resolveCatalogOrderGuardItems,
} from "@/lib/tenant-order-guard";
import { computeDashboardFnbRevenue } from "@/features/dashboard/dashboard-metrics";
import {
  generateTenantOwnerInviteToken,
  validateTenantOwnerInviteToken,
  consumeTenantOwnerInviteToken,
  verifyTenantOwnerCredentials,
} from "@/lib/tenant-activation";
import {
  applyPersistentDomainCommand,
  getPersistentOrders,
  getPersistentQrisSession,
} from "@/lib/persistent-storage";
import {
  getRequestAuthUser,
  TRUSTED_PERSONAS,
  type ServerAuthResult,
} from "@/lib/server-auth";
import { EDGE_SESSION_COOKIE_NAME } from "@/lib/edge-session";
import { POST as inviteTenantPost } from "@/app/api/tenants/invite/route";
import {
  POST as outletsPost,
  PATCH as outletsPatch,
  DELETE as outletsDelete,
} from "@/app/api/outlets/route";
import { POST as registerPost } from "@/app/api/auth/register/route";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as sessionPost } from "@/app/api/auth/session/route";
import { POST as ordersPost, PATCH as ordersPatch } from "@/app/api/orders/route";
import { POST as qrisVerifyPost } from "@/app/api/pos/qris/verify/route";
import { POST as eventsPost } from "@/app/api/events/route";
import { createOrganizer } from "@/lib/organizers";
import { registerUnifiedUser } from "@/lib/unified-account";
import { signQrisWebhookPayload } from "@/lib/qris-verification";
import type { OrderRecord } from "@/types/order";

describe("Task S-38: Kelola Data Mitra Lengkap, Auto-Suspension & Server Persistence", () => {
  beforeEach(() => {
    // Reset tenant status if needed
    setTenantStatus("tenant-ks", "ACTIVE");
    setTenantStatus("tenant-bakery", "ACTIVE");
  });

  describe("1. Kelengkapan Profil Mitra (Data Profil Lengkap & Tipe Mitra)", () => {
    it("memiliki default data mitra lengkap: PIC, kontak, NPWP, rekening settlement, dan kontrak PKS", () => {
      const state = defaultTenantsState();
      const ksProfile = state.profiles["tenant-ks"];

      expect(ksProfile).toBeDefined();
      expect(ksProfile.brandName).toBe("Kopi Senja");
      expect(ksProfile.contactPerson).toBe("Budi Santoso");
      expect(ksProfile.contactPhone).toBeTruthy();
      expect(ksProfile.contactEmail).toBe("kopisenja@dagocreative.id");
      expect(ksProfile.npwp).toBe("01.234.567.8-012.000");
      expect(ksProfile.bankName).toBe("BCA");
      expect(ksProfile.bankAccountNumber).toBe("8830192841");
      expect(ksProfile.bankAccountHolder).toBe("Kopi Senja Utama");
      expect(ksProfile.partnerType).toBe("EXTERNAL");
      expect(ksProfile.contractStartDate).toBe("2024-01-01");
      expect(ksProfile.contractEndDate).toBe("2025-12-31");
      expect(ksProfile.contractPksNumber).toBe("PKS/DCH/2024/001");
      expect(ksProfile.contractPksFile).toBe("pks-kopi-senja-2024.pdf");
      expect(ksProfile.status).toBe("ACTIVE");
    });

    it("membedakan tipe mitra INTERNAL vs EXTERNAL secara tepat", () => {
      const extProfile = buildTenantProfileWithDefaults("tenant-ks", { partnerType: "EXTERNAL" });
      const intProfile = buildTenantProfileWithDefaults("tenant-internal", { partnerType: "INTERNAL" });

      expect(extProfile.partnerType).toBe("EXTERNAL");
      expect(intProfile.partnerType).toBe("INTERNAL");
    });

    it("buildTenantProfileWithDefaults mempertahankan field baru saat penggabungan parsial", () => {
      const merged = buildTenantProfileWithDefaults("tenant-custom", {
        brandName: "Mitra Baru",
        contactPerson: "Andi Wijaya",
        contactEmail: "andi@mitrabaru.id",
        npwp: "09.876.543.2-123.000",
        partnerType: "EXTERNAL",
        contractStartDate: "2024-06-01",
        contractEndDate: "2025-05-31",
        contractPksNumber: "PKS/DCH/2024/099",
        contractPksFile: "pks-mitra-baru.pdf",
        status: "ACTIVE",
      });

      expect(merged.contactPerson).toBe("Andi Wijaya");
      expect(merged.contactEmail).toBe("andi@mitrabaru.id");
      expect(merged.npwp).toBe("09.876.543.2-123.000");
      expect(merged.partnerType).toBe("EXTERNAL");
      expect(merged.contractPksNumber).toBe("PKS/DCH/2024/099");
    });
  });

  describe("2. Mekanisme Status Mitra & Auto-Suspension bila Setoran Telat > 2 Minggu", () => {
    it("mendeteksi otomatis penangguhan (SUSPENDED) jika setoran telat lebih dari 14 hari", () => {
      const baseDate = new Date("2024-11-20T12:00:00Z");
      // Setoran terakhir 16 hari yang lalu (telat > 14 hari)
      const overdueProfile: TenantProfileData = buildTenantProfileWithDefaults("tenant-ks", {
        status: "ACTIVE",
        lastSettlementDepositDate: "2024-11-04",
      });

      const check = checkTenantAutoSuspension(overdueProfile, baseDate);
      expect(check.shouldSuspend).toBe(true);
      expect(check.reason).toContain("Setoran telat lebih dari 2 minggu");
    });

    it("tidak menangguhkan mitra jika setoran masih dalam batas 14 hari", () => {
      const baseDate = new Date("2024-11-20T12:00:00Z");
      // Setoran terakhir 7 hari yang lalu
      const timelyProfile: TenantProfileData = buildTenantProfileWithDefaults("tenant-ks", {
        status: "ACTIVE",
        lastSettlementDepositDate: "2024-11-13",
      });

      const check = checkTenantAutoSuspension(timelyProfile, baseDate);
      expect(check.shouldSuspend).toBe(false);
    });

    it("mengunci kasir outlet jika mitra berstatus SUSPENDED", () => {
      setTenantStatus("tenant-ks", "SUSPENDED", "Keterlambatan setoran settlement");

      expect(isTenantSuspended("tenant-ks")).toBe(true);
      expect(isTenantActive("tenant-ks")).toBe(false);
    });

    it("dapat memulihkan status mitra menjadi ACTIVE kembali", () => {
      setTenantStatus("tenant-ks", "SUSPENDED");
      expect(isTenantSuspended("tenant-ks")).toBe(true);

      setTenantStatus("tenant-ks", "ACTIVE");
      expect(isTenantSuspended("tenant-ks")).toBe(false);
      expect(isTenantActive("tenant-ks")).toBe(true);
    });
  });

  describe("3. Penyimpanan Server (Server-Backed Persistence via Domain Sync)", () => {
    it("menyimpan dan mensinkronkan revenue split ke state server domain", () => {
      const current = defaultTenantsState();
      const updated = applyTenantsCommand(current, {
        op: "SET_REVENUE_SPLIT",
        tenantId: "tenant-ks",
        split: {
          tenantId: "tenant-ks",
          tenantName: "Kopi Senja",
          tenantSharePercent: 80,
          dagoSharePercent: 20,
          status: "ACTIVE",
          updatedAt: "2024-11-20T10:00:00Z",
        },
      });

      expect(updated.revenueSplits).toBeDefined();
      expect(updated.revenueSplits!["tenant-ks"].tenantSharePercent).toBe(80);
      expect(updated.revenueSplits!["tenant-ks"].dagoSharePercent).toBe(20);
    });

    it("mengizinkan superadmin mengubah status mitra menjadi SUSPENDED pada domain spec", () => {
      const auth: ServerAuthResult = {
        isAuthenticated: true,
        role: "SUPER_ADMIN",
        userId: "usr-super-admin",
        scopeLevel: "PLATFORM",
      };
      const authResult = tenantsDomainSpec.authorizeWrite(auth, {
        op: "SET_TENANT_STATUS",
        tenantId: "tenant-ks",
        status: "SUSPENDED",
        reason: "Penangguhan administratif",
      });

      expect(authResult.allowed).toBe(true);
    });

    it("menolak perubahan status mitra atau revenue split oleh peran yang tidak berwenang", () => {
      const auth: ServerAuthResult = {
        isAuthenticated: true,
        role: "CASHIER",
        userId: "usr-cashier",
        scopeLevel: "OUTLET",
      };
      const authResult = tenantsDomainSpec.authorizeWrite(auth, {
        op: "SET_TENANT_STATUS",
        tenantId: "tenant-ks",
        status: "SUSPENDED",
      });

      expect(authResult.allowed).toBe(false);
      if (!authResult.allowed) {
        expect(authResult.status).toBe(403);
      }
    });

    it("setTenantRevenueSplit memutasi konfigurasi pembagian hasil", () => {
      const result = setTenantRevenueSplit("tenant-ks", 88, 12);
      expect(result.success).toBe(true);

      const splits = getAllTenantRevenueSplits();
      expect(splits["tenant-ks"].tenantSharePercent).toBe(88);
      expect(splits["tenant-ks"].dagoSharePercent).toBe(12);
    });
  });

  describe("4. Pengecualian Mitra Internal pada Kalkulasi Settlement", () => {
    beforeEach(() => {
      saveTenantProfile({
        ...getTenantProfile("tenant-bakery"),
        partnerType: "INTERNAL",
      });
    });

    afterEach(() => {
      saveTenantProfile({
        ...getTenantProfile("tenant-bakery"),
        partnerType: "EXTERNAL",
      });
    });

    it("melewati mitra internal pada calculateSettlement namun tetap memperhitungkan mitra eksternal", () => {
      const orders: OrderRecord[] = [
        {
          id: "ord-1",
          orderNumber: "ORD-001",
          organizationId: "org-1",
          outletId: "outlet-sgr",
          outletName: "Singaraja",
          tableNumber: "01",
          customerName: "Pelanggan 1",
          orderType: "DINE_IN",
          status: "COMPLETED",
          paymentStatus: "PAID",
          paymentMethod: "CASH",
          targetServiceMinutes: 15,
          statusHistory: [],
          subtotal: 100000,
          tax: 10000,
          serviceCharge: 5000,
          discount: 0,
          total: 115000,
          items: [
            // Produk dari mitra eksternal (Kopi Senja)
            {
              id: "item-1",
              productId: "prod-1",
              productName: "Espresso",
              tenantId: "tenant-ks",
              unitPrice: 50000,
              quantity: 1,
            },
            // Produk dari mitra internal (Manis Bakery)
            {
              id: "item-2",
              productId: "prod-2",
              productName: "Croissant Butter",
              tenantId: "tenant-bakery",
              unitPrice: 50000,
              quantity: 1,
            },
          ],
          createdAt: new Date().toISOString(),
        },
      ];

      const settlements = calculateSettlement(orders);

      // Mitra eksternal (Kopi Senja) harus masuk settlement
      const ksSummary = settlements.find((s) => s.tenantId === "tenant-ks");
      expect(ksSummary).toBeDefined();
      expect(ksSummary?.grossRevenue).toBe(50000);

      // Mitra internal (Manis Bakery) harus dilewati / tidak masuk settlement
      const bakerySummary = settlements.find((s) => s.tenantId === "tenant-bakery");
      expect(bakerySummary).toBeUndefined();
    });

    it("dapat menyertakan mitra internal bila opsi includeInternal diberikan secara eksplisit", () => {
      const orders: OrderRecord[] = [
        {
          id: "ord-2",
          orderNumber: "ORD-002",
          organizationId: "org-1",
          outletId: "outlet-sgr",
          outletName: "Singaraja",
          tableNumber: "01",
          customerName: "Pelanggan 2",
          orderType: "TAKEAWAY",
          status: "COMPLETED",
          paymentStatus: "PAID",
          paymentMethod: "QRIS",
          targetServiceMinutes: 15,
          statusHistory: [],
          subtotal: 50000,
          tax: 5000,
          serviceCharge: 0,
          discount: 0,
          total: 55000,
          items: [
            {
              id: "item-3",
              productId: "prod-3",
              productName: "Croissant Cheese",
              tenantId: "tenant-bakery",
              unitPrice: 50000,
              quantity: 1,
            },
          ],
          createdAt: new Date().toISOString(),
        },
      ];

      const settlementsWithInternal = calculateSettlement(orders, undefined, undefined, {
        includeInternal: true,
      });

      const bakerySummary = settlementsWithInternal.find((s) => s.tenantId === "tenant-bakery");
      expect(bakerySummary).toBeDefined();
      expect(bakerySummary?.grossRevenue).toBe(50000);
    });
  });

  describe("6. Keamanan RBAC Profil Mitra & Masking Sensitif (SEC-01 & SEC-02)", () => {
    it("mencegah Tenant Owner membatalkan penangguhan (self-unsuspend) atau mengubah partnerType", () => {
      const state = defaultTenantsState();
      state.profiles["tenant-ks"] = {
        ...state.profiles["tenant-ks"],
        status: "SUSPENDED",
        suspendedReason: "Menunggak setoran kas > 14 hari",
        partnerType: "EXTERNAL",
      };

      const tenantOwnerAuth: ServerAuthResult = {
        isAuthenticated: true,
        userId: "usr-ks-owner",
        email: "owner@kopisenja.com",
        name: "Owner Kopi Senja",
        role: "OWNER",
        scopeLevel: "TENANT",
        tenantId: "tenant-ks",
      };

      const maliciousProfile: TenantProfileData = {
        ...state.profiles["tenant-ks"],
        status: "ACTIVE",
        suspendedReason: undefined,
        partnerType: "INTERNAL",
      };

      const updatedState = tenantsDomainSpec.applyCommand(
        state,
        {
          op: "UPSERT_PROFILE",
          profile: maliciousProfile,
        },
        tenantOwnerAuth
      );

      expect(updatedState.profiles["tenant-ks"].status).toBe("SUSPENDED");
      expect(updatedState.profiles["tenant-ks"].suspendedReason).toBe("Menunggak setoran kas > 14 hari");
      expect(updatedState.profiles["tenant-ks"].partnerType).toBe("EXTERNAL");
    });

    it("menyembunyikan NPWP, telepon PIC, dan revenue splits milik tenant lain dari publik/tenant non-admin", () => {
      const state = defaultTenantsState();
      state.profiles["tenant-ks"].npwp = "12.345.678.9-012.000";
      state.profiles["tenant-ks"].contactPhone = "08123456789";

      const unauthenticatedAuth: ServerAuthResult = {
        isAuthenticated: false,
        role: null,
        userId: null,
        scopeLevel: null,
        error: "Unauthenticated",
      };

      const decision = tenantsDomainSpec.authorizeRead(unauthenticatedAuth);
      expect(decision.allowed).toBe(true);
      if (decision.allowed) {
        const transformed = decision.transform!(state);
        expect(transformed.profiles["tenant-ks"].npwp).toBeUndefined();
        expect(transformed.profiles["tenant-ks"].contactPhone).toBe("••••••••");
        expect(transformed.profiles["tenant-ks"].bankName).toBe("");
        expect(transformed.profiles["tenant-ks"].bankAccountNumber).toBe("••••••••");
        expect(transformed.profiles["tenant-ks"].bankAccountNumber).not.toMatch(/\d/);
        expect(transformed.profiles["tenant-ks"].bankAccountHolder).toBe("");
        expect(transformed.profiles["tenant-ks"].contactPerson).toBeUndefined();
        expect(transformed.profiles["tenant-ks"].contactEmail).toBeUndefined();
        expect(transformed.profiles["tenant-ks"].contractStartDate).toBeUndefined();
        expect(transformed.profiles["tenant-ks"].contractEndDate).toBeUndefined();
        expect(transformed.profiles["tenant-ks"].contractPksNumber).toBeUndefined();
        expect(transformed.profiles["tenant-ks"].contractPksFile).toBeUndefined();
        expect(transformed.profiles["tenant-ks"].lastSettlementDepositDate).toBeUndefined();
        expect(transformed.revenueSplits).toEqual({});
      }
    });
  });

  describe("7. Audit Fix Tahap 3 (S-38 Hardening & Flow)", () => {
    it("mengizinkan MANAGER non-tenant membaca revenueSplits dan mencegah Tenant Owner mengubah bank/NPWP", () => {
      const state = defaultTenantsState();
      const managerAuth: ServerAuthResult = {
        isAuthenticated: true,
        userId: "usr-mgr",
        email: "manager.commercial@dagoeng.com",
        name: "Commercial Manager",
        role: "MANAGER",
        scopeLevel: "ORGANIZATION",
        tenantId: null,
      };
      const readDecision = tenantsDomainSpec.authorizeRead(managerAuth);
      expect(readDecision.allowed).toBe(true);
      if (readDecision.allowed) {
        const transformed = readDecision.transform!(state);
        expect(transformed.revenueSplits?.["tenant-ks"]).toBeDefined();
        expect(transformed.profiles["tenant-ks"].bankAccountNumber).toBe("••••••••");
        expect(transformed.profiles["tenant-ks"].bankAccountNumber).not.toMatch(/\d/);
      }

      const tenantOwnerAuth: ServerAuthResult = {
        isAuthenticated: true,
        userId: "usr-ks-owner",
        email: "owner@kopisenja.com",
        name: "Owner Kopi Senja",
        role: "OWNER",
        scopeLevel: "TENANT",
        tenantId: "tenant-ks",
      };
      const originalBank = state.profiles["tenant-ks"].bankAccountNumber;
      const originalNpwp = state.profiles["tenant-ks"].npwp;
      const updated = tenantsDomainSpec.applyCommand(
        state,
        {
          op: "UPSERT_PROFILE",
          profile: {
            ...state.profiles["tenant-ks"],
            bankName: "Mandiri",
            bankAccountNumber: "9999999999",
            bankAccountHolder: "Attacker",
            npwp: "99.999.999.9-999.000",
          },
        },
        tenantOwnerAuth
      );
      expect(updated.profiles["tenant-ks"].bankAccountNumber).toBe(originalBank);
      expect(updated.profiles["tenant-ks"].npwp).toBe(originalNpwp);
    });

    it("mengecualikan mitra INTERNAL dari auto-suspension dan menghitung selisih hari kalender WITA", () => {
      const internalOverdue: TenantProfileData = {
        ...getTenantProfile("tenant-bakery"),
        partnerType: "INTERNAL",
        status: "ACTIVE",
        lastSettlementDepositDate: "2024-01-01",
      };
      expect(checkTenantAutoSuspension(internalOverdue, new Date("2026-11-25T10:00:00Z")).shouldSuspend).toBe(
        false
      );

      const externalExact14Days: TenantProfileData = {
        ...getTenantProfile("tenant-ks"),
        partnerType: "EXTERNAL",
        status: "ACTIVE",
        lastSettlementDepositDate: "2026-11-10",
      };
      expect(
        checkTenantAutoSuspension(externalExact14Days, new Date("2026-11-24T17:00:00Z")).shouldSuspend
      ).toBe(true); // 2026-11-25 WITA -> 15 hari kalender
      expect(
        checkTenantAutoSuspension(externalExact14Days, new Date("2026-11-24T15:00:00Z")).shouldSuspend
      ).toBe(false); // 2026-11-24 WITA -> 14 hari kalender
    });

    it("memblokir order F&B untuk mitra SUSPENDED/INACTIVE sementara COWORKING tetap diizinkan", () => {
      const state = defaultTenantsState();
      state.profiles["tenant-ks"] = {
        ...state.profiles["tenant-ks"],
        status: "SUSPENDED",
        suspendedReason: "Menunggak setoran",
      };
      const blockedRes = findBlockedOrderTenant(
        [{ tenantId: "tenant-ks", itemType: "FNB", productName: "Es Kopi" }],
        state.profiles
      );
      expect(blockedRes.blocked).toBe(true);

      const coworkOnly = findBlockedOrderTenant(
        [
          {
            tenantId: "DAGO_HUB",
            itemType: "COWORKING",
            productName: "Hot Desk",
            coworkingMeta: {
              spaceId: "sp-hot-1",
              spaceName: "Hot Desk",
              durationHours: 2,
            },
          },
        ],
        state.profiles
      );
      expect(coworkOnly.blocked).toBe(false);

      const spoofedCowork = findBlockedOrderTenant(
        [{ tenantId: "tenant-ks", itemType: "COWORKING", productName: "Hot Desk" }],
        state.profiles
      );
      expect(spoofedCowork.blocked).toBe(true);
    });

    it("menyertakan pendapatan mitra INTERNAL di dashboard-metrics", () => {
      const state = defaultTenantsState();
      state.profiles["tenant-bakery"].partnerType = "INTERNAL";
      saveTenantProfile(state.profiles["tenant-bakery"]);
      const paidOrder: OrderRecord = {
        id: "ord-dash-internal",
        orderNumber: "ORD-INT-1",
        organizationId: "org-dago",
        outletId: "outlet-sgr",
        outletName: "Dago Creative Hub",
        tableNumber: "T1",
        customerName: "Tamu",
        orderType: "DINE_IN",
        status: "COMPLETED",
        paymentStatus: "PAID",
        paymentMethod: "CASH",
        subtotal: 100000,
        discount: 0,
        tax: 10000,
        serviceCharge: 0,
        total: 110000,
        createdAt: new Date().toISOString(),
        targetServiceMinutes: 15,
        statusHistory: [],
        items: [
          {
            id: "it-1",
            productId: "p-bakery",
            tenantId: "tenant-bakery",
            productName: "Croissant",
            quantity: 2,
            unitPrice: 50000,
          },
        ],
      };

      const rev = computeDashboardFnbRevenue([paidOrder], {
        isTenantOwner: true,
        tenantId: "tenant-bakery",
      });
      expect(rev).toBeGreaterThan(0);
    });

    it("mendukung alur undangan & aktivasi akun Owner mitra sekali pakai", async () => {
      const invite = await generateTenantOwnerInviteToken("tenant-ks", "Admin Hub");
      const token = new URL(`http://localhost${invite.activationUrl}`).searchParams.get("invite")!;
      const validBefore = await validateTenantOwnerInviteToken(token);
      expect(validBefore.valid).toBe(true);

      const activated = await consumeTenantOwnerInviteToken({
        token,
        email: "new.owner.ks@dagoeng.com",
        name: "Owner Baru KS",
        password: "PasswordAman123!",
      });
      expect(activated.tenantId).toBe("tenant-ks");

      const validAfter = await validateTenantOwnerInviteToken(token);
      expect(validAfter.valid).toBe(false);

      const loginCheck = await verifyTenantOwnerCredentials(
        "new.owner.ks@dagoeng.com",
        "PasswordAman123!"
      );
      expect(loginCheck.authenticated).toBe(true);
      expect(loginCheck.account?.tenantId).toBe("tenant-ks");

      // Email collision with another tenant must be rejected
      const secondInvite = await generateTenantOwnerInviteToken("tenant-kitchen", "Admin Hub");
      const secondToken = new URL(`http://localhost${secondInvite.activationUrl}`).searchParams.get("invite")!;
      await expect(
        consumeTenantOwnerInviteToken({
          token: secondToken,
          email: "new.owner.ks@dagoeng.com",
          name: "Attacker",
          password: "PasswordAman123!",
        })
      ).rejects.toThrow(/sudah terdaftar/i);
    });
  });

  describe("8. Hardening TOCTOU, Unified Collision, Catalog Guard, Outlet RBAC & Session Owner", () => {
    let tempDir = "";
    let prevDataDirOverride: string | undefined;
    let prevSupervisorPin: string | undefined;

    beforeEach(() => {
      prevDataDirOverride = process.env.DATA_DIR_OVERRIDE;
      prevSupervisorPin = process.env.SUPERVISOR_OVERRIDE_PIN;
      process.env.SUPERVISOR_OVERRIDE_PIN = "123456";
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "s38-hardening-"));
      process.env.DATA_DIR_OVERRIDE = tempDir;
      fs.writeFileSync(path.join(tempDir, "organizers.json"), "[]", "utf-8");
      fs.writeFileSync(path.join(tempDir, "unified_users.json"), "[]", "utf-8");
    });

    afterEach(() => {
      if (prevDataDirOverride === undefined) {
        delete process.env.DATA_DIR_OVERRIDE;
      } else {
        process.env.DATA_DIR_OVERRIDE = prevDataDirOverride;
      }
      if (prevSupervisorPin === undefined) {
        delete process.env.SUPERVISOR_OVERRIDE_PIN;
      } else {
        process.env.SUPERVISOR_OVERRIDE_PIN = prevSupervisorPin;
      }
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("mencegah TOCTOU race pada consumeTenantOwnerInviteToken dan melakukan rollback bila gagal", async () => {
      const invite = await generateTenantOwnerInviteToken("tenant-ks", "Admin Hub");
      const token = new URL(`http://localhost${invite.activationUrl}`).searchParams.get("invite")!;

      // Kegagalan validasi email sistem harus melakukan rollback usedAt sehingga token masih bisa dipakai
      await expect(
        consumeTenantOwnerInviteToken({
          token,
          email: TRUSTED_PERSONAS.DAGO_OWNER.email,
          name: "Blocked",
          password: "PasswordAman123!",
        })
      ).rejects.toThrow(/sudah terdaftar/i);
      const stillValid = await validateTenantOwnerInviteToken(token);
      expect(stillValid.valid).toBe(true);

      // Konsumsi paralel hanya boleh meluluskan tepat 1 pemanggil
      const results = await Promise.allSettled([
        consumeTenantOwnerInviteToken({
          token,
          email: "race.owner1@mitra.id",
          name: "Owner 1",
          password: "PasswordAman123!",
        }),
        consumeTenantOwnerInviteToken({
          token,
          email: "race.owner2@mitra.id",
          name: "Owner 2",
          password: "PasswordAman123!",
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
    });

    it("menolak email yang sudah terdaftar di unified_users.json dan menolak register jika sudah di tenant_owner_accounts.json", async () => {
      const regReq = new NextRequest("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Pelanggan Terpadu",
          email: "unified.user@dagoeng.com",
          phone: "081234567890",
          password: "Password123!",
        }),
      });
      const regRes = await registerPost(regReq);
      expect(regRes.status).toBe(201);

      const invite = await generateTenantOwnerInviteToken("tenant-ks", "Admin Hub");
      const token = new URL(`http://localhost${invite.activationUrl}`).searchParams.get("invite")!;
      await expect(
        consumeTenantOwnerInviteToken({
          token,
          email: "unified.user@dagoeng.com",
          name: "Shadow Attacker",
          password: "PasswordAman123!",
        })
      ).rejects.toThrow(/sudah terdaftar/i);

      await consumeTenantOwnerInviteToken({
        token,
        email: "owner.teraktivasi@mitra.id",
        name: "Owner Aktif",
        password: "PasswordAman123!",
      });

      const dupRegReq = new NextRequest("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Penyerang Register",
          email: "owner.teraktivasi@mitra.id",
          phone: "081299998888",
          password: "Password123!",
        }),
      });
      const dupRegRes = await registerPost(dupRegReq);
      expect(dupRegRes.status).toBe(409);
    });

    it("menutup bypass catalog itemType/tenantId di POST /api/orders, item kosong fallback tenantId, dan memblokir QRIS verify untuk mitra SUSPENDED", async () => {
      const adminAuth: ServerAuthResult = {
        isAuthenticated: true,
        role: "SUPER_ADMIN",
        userId: "user-admin",
        scopeLevel: "PLATFORM",
      };

      // Pastikan item kosong tetap memeriksa fallback orderData.tenantId
      const stateWithSuspended = defaultTenantsState();
      stateWithSuspended.profiles["tenant-ks"].status = "SUSPENDED";
      expect(
        findBlockedOrderTenant([], stateWithSuspended.profiles, "tenant-ks").blocked
      ).toBe(true);

      // 1. Buat order PENDING QRIS saat tenant-ks masih ACTIVE
      const pendingOrderReq = new NextRequest("http://localhost:3000/api/orders", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "dagoeng_active_persona=CASHIER_SGR",
        },
        body: JSON.stringify({
          id: "ord-qris-suspend-test",
          orderNumber: "ORD-S38-QRIS-1",
          organizationId: "org-dago-hub",
          outletId: "outlet-sgr",
          outletName: "Singaraja",
          tableNumber: "01",
          customerName: "Tamu QRIS",
          orderType: "DINE_IN",
          status: "NEW",
          paymentStatus: "PENDING",
          paymentMethod: "QRIS",
          subtotal: 24000,
          discount: 0,
          tax: 2400,
          serviceCharge: 1200,
          total: 27600,
          targetServiceMinutes: 15,
          statusHistory: [],
          items: [
            {
              id: "it-qris-1",
              productId: "prod-101",
              tenantId: "tenant-ks",
              productName: "Kopi Senja Aren",
              quantity: 1,
              unitPrice: 24000,
            },
          ],
          createdAt: new Date().toISOString(),
        }),
      });
      const pendingRes = await ordersPost(pendingOrderReq);
      expect(pendingRes.status).toBe(200);

      const initQrisReq = new NextRequest("http://localhost:3000/api/pos/qris/verify", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "dagoeng_active_persona=CASHIER_SGR",
        },
        body: JSON.stringify({
          mode: "INIT",
          orderId: "ord-qris-suspend-test",
          invoiceNumber: "ORD-S38-QRIS-1",
          expectedAmount: 27600,
        }),
      });
      const initQrisRes = await qrisVerifyPost(initQrisReq);
      expect(initQrisRes.status).toBe(200);

      // 2. Tangguhkan tenant-ks
      await applyPersistentDomainCommand(
        tenantsDomainSpec,
        {
          op: "SET_TENANT_STATUS",
          tenantId: "tenant-ks",
          status: "SUSPENDED",
          reason: "Telat setor mingguan",
        },
        adminAuth
      );

      // 3. Upaya bypass spoof itemType: "COWORKING" & tenantId lain untuk prod-101 wajib ditolak 403
      const spoofReq = new NextRequest("http://localhost:3000/api/orders", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "dagoeng_active_persona=CASHIER_SGR",
        },
        body: JSON.stringify({
          id: "ord-spoof-bypass",
          orderNumber: "ORD-S38-SPOOF",
          organizationId: "org-dago-hub",
          outletId: "outlet-sgr",
          outletName: "Singaraja",
          tableNumber: "02",
          customerName: "Attacker",
          orderType: "DINE_IN",
          status: "NEW",
          paymentStatus: "PAID",
          paymentMethod: "CASH",
          subtotal: 24000,
          discount: 0,
          tax: 2400,
          serviceCharge: 1200,
          total: 27600,
          targetServiceMinutes: 15,
          statusHistory: [],
          items: [
            {
              id: "it-spoof",
              productId: "prod-101",
              tenantId: "tenant-kitchen",
              itemType: "COWORKING",
              productName: "Kopi Senja Aren",
              quantity: 1,
              unitPrice: 24000,
            },
          ],
          createdAt: new Date().toISOString(),
        }),
      });
      const spoofRes = await ordersPost(spoofReq);
      expect(spoofRes.status).toBe(403);

      // 4. Pelunasan QRIS terhadap order PENDING milik tenant-ks yang SUSPENDED wajib ditolak 403 & tetap PENDING
      const verifyReq = new NextRequest("http://localhost:3000/api/pos/qris/verify", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "dagoeng_active_persona=DAGO_OWNER",
        },
        body: JSON.stringify({
          mode: "SUPERVISOR_OVERRIDE",
          orderId: "ord-qris-suspend-test",
          invoiceNumber: "ORD-S38-QRIS-1",
          pin: "123456",
          referenceNumber: "RRN-998877",
        }),
      });
      const verifyRes = await qrisVerifyPost(verifyReq);
      expect(verifyRes.status).toBe(403);

      const persistedOrders = await getPersistentOrders();
      const targetOrder = persistedOrders.find((o) => o.id === "ord-qris-suspend-test");
      expect(targetOrder?.paymentStatus).toBe("PENDING");
    });

    it("membatasi /api/tenants/invite & /api/outlets hanya untuk SUPER_ADMIN / Org OWNER serta menangani duplikat kode & DELETE", async () => {
      // MANAGER ditolak 403
      for (const persona of ["COWORK_MANAGER", "COMMERCIAL_MANAGER"]) {
        const invRes = await inviteTenantPost(
          new NextRequest("http://localhost:3000/api/tenants/invite", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              cookie: `dagoeng_active_persona=${persona}`,
            },
            body: JSON.stringify({ tenantId: "tenant-ks" }),
          })
        );
        expect(invRes.status).toBe(403);

        const outRes = await outletsPost(
          new NextRequest("http://localhost:3000/api/outlets", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              cookie: `dagoeng_active_persona=${persona}`,
            },
            body: JSON.stringify({
              name: "Outlet Baru",
              code: "DCH-NEW",
              address: "Jl. Raya",
            }),
          })
        );
        expect(outRes.status).toBe(403);
      }

      // DAGO_OWNER diizinkan
      const ownerInvRes = await inviteTenantPost(
        new NextRequest("http://localhost:3000/api/tenants/invite", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=DAGO_OWNER",
          },
          body: JSON.stringify({ tenantId: "tenant-ks" }),
        })
      );
      expect(ownerInvRes.status).toBe(200);

      const createOutletRes = await outletsPost(
        new NextRequest("http://localhost:3000/api/outlets", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=DAGO_OWNER",
          },
          body: JSON.stringify({
            name: "Canggu",
            code: "KS-CGU",
            address: "Jl. Pantai Berawa",
          }),
        })
      );
      expect(createOutletRes.status).toBe(200);
      const createdJson = await createOutletRes.json();
      const createdId = createdJson.outlet.id as string;

      // Duplikat kode case-insensitive ditolak 409
      const dupCreateRes = await outletsPost(
        new NextRequest("http://localhost:3000/api/outlets", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=SUPER_ADMIN",
          },
          body: JSON.stringify({
            name: "Canggu Duplikat",
            code: "ks-cgu",
            address: "Jl. Lain",
          }),
        })
      );
      expect(dupCreateRes.status).toBe(409);

      const dupPatchRes = await outletsPatch(
        new NextRequest("http://localhost:3000/api/outlets", {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=DAGO_OWNER",
          },
          body: JSON.stringify({
            id: createdId,
            code: "ks-sgr",
          }),
        })
      );
      expect(dupPatchRes.status).toBe(409);

      // Outlet utama tidak boleh dihapus
      const delDefaultRes = await outletsDelete(
        new NextRequest("http://localhost:3000/api/outlets?id=outlet-sgr", {
          method: "DELETE",
          headers: { cookie: "dagoeng_active_persona=SUPER_ADMIN" },
        })
      );
      expect(delDefaultRes.status).toBe(400);

      // Outlet non-utama bisa dihapus
      const delCreatedRes = await outletsDelete(
        new NextRequest(`http://localhost:3000/api/outlets?id=${createdId}`, {
          method: "DELETE",
          headers: { cookie: "dagoeng_active_persona=SUPER_ADMIN" },
        })
      );
      expect(delCreatedRes.status).toBe(200);
    });

    it("mengembalikan profil sesi lengkap & mendukung ganti password untuk Tenant Owner teraktivasi serta menolak login saat INACTIVE", async () => {
      const invite = await generateTenantOwnerInviteToken("tenant-ks", "Admin Hub");
      const token = new URL(`http://localhost${invite.activationUrl}`).searchParams.get("invite")!;
      await consumeTenantOwnerInviteToken({
        token,
        email: "session.owner@mitra.id",
        name: "Pemilik Sesi KS",
        password: "PasswordAwal123!",
      });

      const loginRes = await loginPost(
        new NextRequest("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: "session.owner@mitra.id",
            password: "PasswordAwal123!",
          }),
        })
      );
      expect(loginRes.status).toBe(200);
      const loginJson = await loginRes.json();
      expect(loginJson.user.organization).toEqual({
        id: "org-dago-hub",
        name: "Dago Creative Hub",
        code: "DAGO-HUB",
      });
      expect(loginJson.user.businessModule).toBe("FNB");
      expect(loginJson.user.permissions).toEqual(TRUSTED_PERSONAS.TENANT_OWNER_KS.permissions);

      const edgeCookie = loginRes.cookies.get(EDGE_SESSION_COOKIE_NAME)?.value;
      expect(edgeCookie).toBeTruthy();

      const authFromEdge = await getRequestAuthUser(
        new NextRequest("http://localhost:3000/api/orders", {
          headers: { cookie: `${EDGE_SESSION_COOKIE_NAME}=${edgeCookie}` },
        })
      );
      expect(authFromEdge.isAuthenticated).toBe(true);
      expect(authFromEdge.role).toBe("OWNER");
      expect(authFromEdge.scopeLevel).toBe("TENANT");
      expect(authFromEdge.businessModule).toBe("FNB");
      expect(authFromEdge.name).toBe("Pemilik Mitra");
      expect(authFromEdge.permissions).toEqual(TRUSTED_PERSONAS.TENANT_OWNER_KS.permissions);

      // Ganti password via POST /api/auth/session
      const changePassRes = await sessionPost(
        new NextRequest("http://localhost:3000/api/auth/session", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `${EDGE_SESSION_COOKIE_NAME}=${edgeCookie}`,
          },
          body: JSON.stringify({
            email: "session.owner@mitra.id",
            newPassword: "PasswordBaru456!",
          }),
        })
      );
      expect(changePassRes.status).toBe(200);

      // Password lama ditolak, password baru diterima
      const oldPassLogin = await loginPost(
        new NextRequest("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: "session.owner@mitra.id",
            password: "PasswordAwal123!",
          }),
        })
      );
      expect(oldPassLogin.status).toBe(401);

      const newPassLogin = await loginPost(
        new NextRequest("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: "session.owner@mitra.id",
            password: "PasswordBaru456!",
          }),
        })
      );
      expect(newPassLogin.status).toBe(200);

      // Saat mitra berstatus INACTIVE, login ditolak 403
      await applyPersistentDomainCommand(
        tenantsDomainSpec,
        { op: "SET_TENANT_STATUS", tenantId: "tenant-ks", status: "INACTIVE" },
        {
          isAuthenticated: true,
          role: "SUPER_ADMIN",
          userId: "user-admin",
          scopeLevel: "PLATFORM",
        }
      );

      const inactiveLogin = await loginPost(
        new NextRequest("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: "session.owner@mitra.id",
            password: "PasswordBaru456!",
          }),
        })
      );
      expect(inactiveLogin.status).toBe(403);
    });
  });

  describe("9. Audit P0/P1 Hardening (Group A)", () => {
    let tempDir = "";
    let prevDataDirOverride: string | undefined;
    let prevSupervisorPin: string | undefined;

    beforeEach(() => {
      prevDataDirOverride = process.env.DATA_DIR_OVERRIDE;
      prevSupervisorPin = process.env.SUPERVISOR_OVERRIDE_PIN;
      process.env.SUPERVISOR_OVERRIDE_PIN = "123456";
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "s38-group-a-"));
      process.env.DATA_DIR_OVERRIDE = tempDir;
      fs.writeFileSync(path.join(tempDir, "organizers.json"), "[]", "utf-8");
      fs.writeFileSync(path.join(tempDir, "unified_users.json"), "[]", "utf-8");
      fs.writeFileSync(path.join(tempDir, "events.json"), "[]", "utf-8");
    });

    afterEach(() => {
      if (prevDataDirOverride === undefined) {
        delete process.env.DATA_DIR_OVERRIDE;
      } else {
        process.env.DATA_DIR_OVERRIDE = prevDataDirOverride;
      }
      if (prevSupervisorPin === undefined) {
        delete process.env.SUPERVISOR_OVERRIDE_PIN;
      } else {
        process.env.SUPERVISOR_OVERRIDE_PIN = prevSupervisorPin;
      }
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("menutup spoof COWORKING tanpa productId/katalog pada mitra SUSPENDED", async () => {
      const adminAuth: ServerAuthResult = {
        isAuthenticated: true,
        role: "SUPER_ADMIN",
        userId: "user-admin",
        scopeLevel: "PLATFORM",
      };
      await applyPersistentDomainCommand(
        tenantsDomainSpec,
        {
          op: "SET_TENANT_STATUS",
          tenantId: "tenant-ks",
          status: "SUSPENDED",
          reason: "Telat setor",
        },
        adminAuth
      );

      const resolved = resolveCatalogOrderGuardItems(
        [
          {
            productId: "unknown-spoof-item",
            tenantId: "tenant-ks",
            itemType: "COWORKING",
            productName: "Kopi Spoof",
          },
        ],
        []
      );
      expect(resolved[0].itemType).toBe("FNB");

      const spoofReq = new NextRequest("http://localhost:3000/api/orders", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "dagoeng_active_persona=CASHIER_SGR",
        },
        body: JSON.stringify({
          id: "ord-unmatched-cowork-spoof",
          orderNumber: "ORD-UNMATCHED-SPOOF",
          organizationId: "org-dago-hub",
          outletId: "outlet-sgr",
          outletName: "Singaraja",
          tableNumber: "03",
          customerName: "Attacker",
          orderType: "DINE_IN",
          status: "NEW",
          paymentStatus: "PAID",
          paymentMethod: "CASH",
          subtotal: 25000,
          discount: 0,
          tax: 2500,
          serviceCharge: 1250,
          total: 28750,
          targetServiceMinutes: 15,
          statusHistory: [],
          items: [
            {
              id: "it-unmatched-spoof",
              productId: "non-existent-prod-999",
              tenantId: "tenant-ks",
              itemType: "COWORKING",
              productName: "Item Tanpa Katalog",
              quantity: 1,
              unitPrice: 25000,
            },
          ],
          createdAt: new Date().toISOString(),
        }),
      });
      const spoofRes = await ordersPost(spoofReq);
      expect(spoofRes.status).toBe(403);
    });

    it("memblokir mutasi item pada order PAID untuk mitra SUSPENDED via UPSERT dan PATCH namun mengizinkan progresi workflow saja", async () => {
      const adminAuth: ServerAuthResult = {
        isAuthenticated: true,
        role: "SUPER_ADMIN",
        userId: "user-admin",
        scopeLevel: "PLATFORM",
      };

      const baseOrder: OrderRecord = {
        id: "ord-paid-mutation-guard",
        orderNumber: "ORD-PAID-MUT-1",
        organizationId: "org-dago-hub",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        tableNumber: "04",
        customerName: "Pelanggan Sah",
        orderType: "DINE_IN",
        status: "CONFIRMED",
        paymentStatus: "PAID",
        paymentMethod: "CASH",
        subtotal: 24000,
        discount: 0,
        tax: 2400,
        serviceCharge: 1200,
        total: 27600,
        targetServiceMinutes: 15,
        statusHistory: [],
        items: [
          {
            id: "it-paid-1",
            productId: "prod-101",
            tenantId: "tenant-ks",
            productName: "Kopi Senja Aren",
            quantity: 1,
            unitPrice: 24000,
          },
        ],
        createdAt: new Date().toISOString(),
      };

      const createRes = await ordersPost(
        new NextRequest("http://localhost:3000/api/orders", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=CASHIER_SGR",
          },
          body: JSON.stringify(baseOrder),
        })
      );
      expect(createRes.status).toBe(200);

      await applyPersistentDomainCommand(
        tenantsDomainSpec,
        {
          op: "SET_TENANT_STATUS",
          tenantId: "tenant-ks",
          status: "SUSPENDED",
          reason: "Telat setor",
        },
        adminAuth
      );

      // UPSERT pada order PAID untuk mitra SUSPENDED wajib ditolak 403
      const upsertRes = await ordersPost(
        new NextRequest("http://localhost:3000/api/orders", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=DAGO_OWNER",
          },
          body: JSON.stringify({
            ...baseOrder,
            subtotal: 48000,
            tax: 4800,
            serviceCharge: 2400,
            total: 55200,
            items: [
              ...baseOrder.items,
              {
                id: "it-paid-2",
                productId: "prod-101",
                tenantId: "tenant-ks",
                productName: "Kopi Senja Aren",
                quantity: 1,
                unitPrice: 24000,
              },
            ],
          }),
        })
      );
      expect(upsertRes.status).toBe(403);

      // PATCH yang memodifikasi items untuk mitra SUSPENDED wajib ditolak 403
      const patchItemsRes = await ordersPatch(
        new NextRequest("http://localhost:3000/api/orders", {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=DAGO_OWNER",
          },
          body: JSON.stringify({
            order: {
              id: baseOrder.id,
              subtotal: 48000,
              tax: 4800,
              serviceCharge: 2400,
              total: 55200,
              items: [
                ...baseOrder.items,
                {
                  id: "it-paid-3",
                  productId: "prod-101",
                  tenantId: "tenant-ks",
                  productName: "Kopi Senja Aren",
                  quantity: 1,
                  unitPrice: 24000,
                },
              ],
            },
          }),
        })
      );
      expect(patchItemsRes.status).toBe(403);

      // PATCH progresi workflow KDS tanpa mutasi item tetap diizinkan (200)
      const patchWorkflowRes = await ordersPatch(
        new NextRequest("http://localhost:3000/api/orders", {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=KITCHEN_SGR",
          },
          body: JSON.stringify({
            order: {
              id: baseOrder.id,
              status: "COOKING",
              tenantStatuses: { "tenant-ks": "COOKING" },
            },
          }),
        })
      );
      expect(patchWorkflowRes.status).toBe(200);
    });

    it("tidak menyimpan sesi QRIS VERIFIED_WEBHOOK / VERIFIED_SUPERVISOR saat order milik mitra SUSPENDED", async () => {
      const adminAuth: ServerAuthResult = {
        isAuthenticated: true,
        role: "SUPER_ADMIN",
        userId: "user-admin",
        scopeLevel: "PLATFORM",
      };

      const pendingRes = await ordersPost(
        new NextRequest("http://localhost:3000/api/orders", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=CASHIER_SGR",
          },
          body: JSON.stringify({
            id: "ord-qris-session-guard",
            orderNumber: "ORD-QRIS-NO-PERSIST-1",
            organizationId: "org-dago-hub",
            outletId: "outlet-sgr",
            outletName: "Singaraja",
            tableNumber: "05",
            customerName: "Tamu QRIS",
            orderType: "DINE_IN",
            status: "NEW",
            paymentStatus: "PENDING",
            paymentMethod: "QRIS",
            subtotal: 24000,
            discount: 0,
            tax: 2400,
            serviceCharge: 1200,
            total: 27600,
            targetServiceMinutes: 15,
            statusHistory: [],
            items: [
              {
                id: "it-qris-guard-1",
                productId: "prod-101",
                tenantId: "tenant-ks",
                productName: "Kopi Senja Aren",
                quantity: 1,
                unitPrice: 24000,
              },
            ],
            createdAt: new Date().toISOString(),
          }),
        })
      );
      expect(pendingRes.status).toBe(200);

      const initRes = await qrisVerifyPost(
        new NextRequest("http://localhost:3000/api/pos/qris/verify", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=CASHIER_SGR",
          },
          body: JSON.stringify({
            mode: "INIT",
            orderId: "ord-qris-session-guard",
            invoiceNumber: "ORD-QRIS-NO-PERSIST-1",
            expectedAmount: 27600,
          }),
        })
      );
      expect(initRes.status).toBe(200);

      await applyPersistentDomainCommand(
        tenantsDomainSpec,
        {
          op: "SET_TENANT_STATUS",
          tenantId: "tenant-ks",
          status: "SUSPENDED",
          reason: "Telat setor",
        },
        adminAuth
      );

      // 1. Supervisor override ditolak 403 dan sesi tetap PENDING
      const supRes = await qrisVerifyPost(
        new NextRequest("http://localhost:3000/api/pos/qris/verify", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "dagoeng_active_persona=DAGO_OWNER",
          },
          body: JSON.stringify({
            mode: "SUPERVISOR_OVERRIDE",
            orderId: "ord-qris-session-guard",
            invoiceNumber: "ORD-QRIS-NO-PERSIST-1",
            pin: "123456",
            referenceNumber: "RRN-123456",
          }),
        })
      );
      expect(supRes.status).toBe(403);
      const afterSupSession = await getPersistentQrisSession("ORD-QRIS-NO-PERSIST-1");
      expect(afterSupSession?.status).toBe("PENDING");

      // 2. Webhook ditolak 403 dan sesi tetap PENDING (tidak menjadi VERIFIED_WEBHOOK)
      const signature = signQrisWebhookPayload({
        invoiceNumber: "ORD-QRIS-NO-PERSIST-1",
        amount: 27600,
        transactionStatus: "SUCCESS",
      });
      const whRes = await qrisVerifyPost(
        new NextRequest("http://localhost:3000/api/pos/qris/verify", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-dago-signature": signature,
          },
          body: JSON.stringify({
            mode: "WEBHOOK",
            orderId: "ord-qris-session-guard",
            invoiceNumber: "ORD-QRIS-NO-PERSIST-1",
            amount: 27600,
            transactionStatus: "SUCCESS",
          }),
        })
      );
      expect(whRes.status).toBe(403);
      const afterWhSession = await getPersistentQrisSession("ORD-QRIS-NO-PERSIST-1");
      expect(afterWhSession?.status).toBe("PENDING");
    });

    it("menjaga guard onToggleTenantOrderStatus agar tidak menimpa status SUSPENDED", () => {
      const settingsSource = fs.readFileSync(
        path.resolve(process.cwd(), "src/app/(dashboard)/settings/page.tsx"),
        "utf-8"
      );
      expect(settingsSource).toContain('currentProfile?.status === "SUSPENDED"');
      expect(settingsSource).toContain(
        "Mitra sedang ditangguhkan. Gunakan 'Buka kunci' atau 'Catat setoran kas' terlebih dahulu."
      );
      expect(settingsSource).toContain('await fetch("/api/tenant/operations"');
      expect(settingsSource).toContain("!res.ok || !data?.success");
    });

    it("memblokir createOrganizer, registerUnifiedUser, dan POST /api/events bila email sudah dimiliki Tenant Owner", async () => {
      const invite = await generateTenantOwnerInviteToken("tenant-ks", "Admin Hub");
      const token = new URL(`http://localhost${invite.activationUrl}`).searchParams.get("invite")!;
      await consumeTenantOwnerInviteToken({
        token,
        email: "locked.owner@mitra.id",
        name: "Pemilik Terkunci",
        password: "PasswordAman123!",
      });

      expect(() =>
        createOrganizer({
          name: "Komunitas Bayangan",
          category: "Komunitas",
          contactPerson: "Shadow",
          phone: "081234567890",
          email: "locked.owner@mitra.id",
        })
      ).toThrow(/EMAIL_CONFLICT/i);

      await expect(
        registerUnifiedUser({
          name: "User Bayangan",
          email: "locked.owner@mitra.id",
          phone: "081234567891",
          password: "Password123!",
        })
      ).rejects.toThrow(/EMAIL_CONFLICT/i);

      const eventRes = await eventsPost(
        new NextRequest("http://localhost:3000/api/events", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: "Event Shadowing Test",
            description: "Deskripsi lengkap acara komunitas kreatif Singaraja minimal 20 karakter.",
            category: "WORKSHOP",
            startDate: "2026-12-20T10:00:00.000Z",
            endDate: "2026-12-20T13:00:00.000Z",
            location: "Main Hall Dago",
            isPaid: false,
            price: 0,
            posterUrl: "https://example.com/poster.png",
            organizerName: "Komunitas Bayangan",
            organizerEmail: "locked.owner@mitra.id",
            organizerPhone: "081234567892",
            password: "Password123!",
            maxCapacity: 30,
          }),
        })
      );
      expect(eventRes.status).toBe(409);
    });
  });
});
