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
import { findBlockedOrderTenant } from "@/lib/tenant-order-guard";
import { computeDashboardFnbRevenue } from "@/features/dashboard/dashboard-metrics";
import {
  generateTenantOwnerInviteToken,
  validateTenantOwnerInviteToken,
  consumeTenantOwnerInviteToken,
  verifyTenantOwnerCredentials,
} from "@/lib/tenant-activation";
import type { OrderRecord } from "@/types/order";
import type { ServerAuthResult } from "@/lib/server-auth";

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
        expect(transformed.profiles["tenant-ks"].bankAccountNumber).toBe("");
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
        expect(transformed.profiles["tenant-ks"].bankAccountNumber).toBe("");
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
        [{ tenantId: "tenant-ks", itemType: "COWORKING", productName: "Hot Desk" }],
        state.profiles
      );
      expect(coworkOnly.blocked).toBe(false);
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
});
