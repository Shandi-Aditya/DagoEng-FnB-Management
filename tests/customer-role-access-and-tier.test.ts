import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  calculateTierFromPoints,
  canUserExportCustomers,
  canUserViewFullCustomerContacts,
  maskCustomerEmail,
  maskCustomerPhone,
  resolveAuthoritativeMemberTier,
  sanitizeMemberForRole,
  filterMembers,
} from "@/features/customers/customers-domain";
import { INITIAL_MEMBERS } from "@/lib/master-data-defaults";
import { writePersistentData } from "@/lib/persistent-storage";
import * as serverAuth from "@/lib/server-auth";
import { GET, POST, PUT } from "@/app/api/loyalty/members/route";
import type { RoleSlug } from "@/types/auth";
import type { LoyaltyMember } from "@/types/loyalty";

describe("S-09: Customer Role Access & Tier Calculation", () => {
  describe("1. Role-based Export Permission", () => {
    it("denies customer export for CASHIER and staff roles", () => {
      expect(canUserExportCustomers("CASHIER")).toBe(false);
      expect(canUserExportCustomers("KITCHEN_STAFF")).toBe(false);
      expect(canUserExportCustomers(undefined)).toBe(false);
      expect(canUserExportCustomers("WAITER" as RoleSlug)).toBe(false);
    });

    it("allows customer export only for OWNER, SUPER_ADMIN, and MANAGER", () => {
      expect(canUserExportCustomers("OWNER")).toBe(true);
      expect(canUserExportCustomers("SUPER_ADMIN")).toBe(true);
      expect(canUserExportCustomers("MANAGER")).toBe(true);
    });
  });

  describe("2. Role-based Contact Privacy (Full vs Masked)", () => {
    it("denies full customer contact view for CASHIER and staff", () => {
      expect(canUserViewFullCustomerContacts("CASHIER")).toBe(false);
      expect(canUserViewFullCustomerContacts("KITCHEN_STAFF")).toBe(false);
      expect(canUserViewFullCustomerContacts(undefined)).toBe(false);
    });

    it("allows full customer contact view for OWNER, SUPER_ADMIN, and MANAGER", () => {
      expect(canUserViewFullCustomerContacts("OWNER")).toBe(true);
      expect(canUserViewFullCustomerContacts("SUPER_ADMIN")).toBe(true);
      expect(canUserViewFullCustomerContacts("MANAGER")).toBe(true);
    });
  });

  describe("3. Contact Masking Functions", () => {
    it("masks phone numbers correctly", () => {
      expect(maskCustomerPhone("+62 819-1122-3344")).toBe("+62 819-****-3344");
      expect(maskCustomerPhone("+62 857-9988-7766")).toBe("+62 857-****-7766");
      expect(maskCustomerPhone("081234567890")).toBe("0812****7890");
      expect(maskCustomerPhone("")).toBe("");
      expect(maskCustomerPhone("123")).toBe("123");
    });

    it("masks email addresses correctly", () => {
      expect(maskCustomerEmail("ketut.dian@gmail.com")).toBe("ke***n@gmail.com");
      expect(maskCustomerEmail("budi.santoso@yahoo.com")).toBe("bu***o@yahoo.com");
      expect(maskCustomerEmail("a@b.com")).toBe("a***@b.com");
      expect(maskCustomerEmail(null)).toBe("");
      expect(maskCustomerEmail(undefined)).toBe("");
      expect(maskCustomerEmail("")).toBe("");
    });
  });

  describe("4. Tier Calculation & Ketut Dian Data Integrity", () => {
    it("calculates loyalty tiers according to point thresholds", () => {
      expect(calculateTierFromPoints(0)).toBe("Bronze");
      expect(calculateTierFromPoints(55)).toBe("Bronze");
      expect(calculateTierFromPoints(499)).toBe("Bronze");
      expect(calculateTierFromPoints(500)).toBe("Silver");
      expect(calculateTierFromPoints(1499)).toBe("Silver");
      expect(calculateTierFromPoints(1500)).toBe("Gold");
      expect(calculateTierFromPoints(2999)).toBe("Gold");
      expect(calculateTierFromPoints(3000)).toBe("Platinum");
    });

    it("ensures Ketut Dian has Bronze tier for 55 points in default data", () => {
      const ketut = INITIAL_MEMBERS.find((m) => m.name === "Ketut Dian");
      expect(ketut).toBeDefined();
      expect(ketut?.points).toBe(55);
      expect(ketut?.tier).toBe("Bronze");
      expect(calculateTierFromPoints(ketut!.points)).toBe("Bronze");
    });
  });

  describe("5. Authoritative Member Tier Resolution (Auto-Tier vs Manual Override)", () => {
    it("derives tier from points when no override exists", () => {
      const member = { points: 600, tier: "Bronze" };
      expect(resolveAuthoritativeMemberTier(member)).toBe("Silver");
    });

    it("preserves active manual override when latest history entry is manual override", () => {
      const member = {
        points: 50,
        tier: "Gold",
        tierHistory: [
          { id: "th-1", isManualOverride: true, newTier: "Gold" },
          { id: "th-0", isManualOverride: false, newTier: "Bronze" },
        ],
      };
      expect(resolveAuthoritativeMemberTier(member)).toBe("Gold");
    });

    it("re-derives tier from points when latest history entry is automated upgrade (superseding past override)", () => {
      const member = {
        points: 1600,
        tier: "Silver",
        tierHistory: [
          { id: "th-2", isManualOverride: false, newTier: "Gold" },
          { id: "th-1", isManualOverride: true, newTier: "Silver" },
        ],
      };
      expect(resolveAuthoritativeMemberTier(member)).toBe("Gold");
    });
  });

  describe("6. Role-based Response Sanitization", () => {
    const rawMember: LoyaltyMember = {
      id: "M-TEST",
      name: "Budi Santoso",
      phone: "+62 819-1122-3344",
      email: "budi.santoso@yahoo.com",
      identityNo: "5108011234560001",
      tier: "Silver",
      points: 600,
      totalSpend: 600000,
      totalVisits: 5,
      registeredOutletId: "outlet-1",
      status: "ACTIVE",
      joinedDate: "2024-01-01",
      pointHistory: [],
      tierHistory: [],
    };

    it("keeps full contact and identity data for managerial roles", () => {
      const sanitized = sanitizeMemberForRole(rawMember, "MANAGER");
      expect(sanitized.phone).toBe("+62 819-1122-3344");
      expect(sanitized.email).toBe("budi.santoso@yahoo.com");
      expect(sanitized.identityNo).toBe("5108011234560001");
    });

    it("masks phone and email and clears identityNo for CASHIER and staff", () => {
      const sanitized = sanitizeMemberForRole(rawMember, "CASHIER");
      expect(sanitized.phone).toBe("+62 819-****-3344");
      expect(sanitized.email).toBe("bu***o@yahoo.com");
      expect(sanitized.identityNo).toBe("");
    });
  });

  describe("7. Filter Members Search Privacy", () => {
    const members: LoyaltyMember[] = [
      {
        id: "M-001",
        name: "Ketut Wijaya",
        phone: "+62 819-1122-3344",
        email: "ketut.secret@gmail.com",
        identityNo: "5108011234560001",
        tier: "Bronze",
        points: 55,
        totalSpend: 55000,
        totalVisits: 1,
        registeredOutletId: "outlet-1",
        status: "ACTIVE",
        joinedDate: "2024-01-01",
        pointHistory: [],
        tierHistory: [],
      },
    ];

    it("prevents searching by hidden/masked digits when canView is false", () => {
      // "1122" is in the middle of "+62 819-1122-3344", which is masked to "+62 819-****-3344"
      const resultsHiddenPhone = filterMembers(members, "1122", undefined, false);
      expect(resultsHiddenPhone).toHaveLength(0);

      // "secret" is in the middle of "ketut.secret@gmail.com", which is masked to "ke***t@gmail.com"
      const resultsHiddenEmail = filterMembers(members, "secret", undefined, false);
      expect(resultsHiddenEmail).toHaveLength(0);
    });

    it("allows searching by visible unmasked parts or name when canView is false", () => {
      const resultsName = filterMembers(members, "Ketut", undefined, false);
      expect(resultsName).toHaveLength(1);

      const resultsPhoneVisible = filterMembers(members, "3344", undefined, false);
      expect(resultsPhoneVisible).toHaveLength(1);
    });

    it("allows searching full unmasked phone when canView is true", () => {
      const results = filterMembers(members, "1122", undefined, true);
      expect(results).toHaveLength(1);
    });
  });

  describe("8. /api/loyalty/members Route Security & Tier Normalization", () => {
    beforeEach(async () => {
      await writePersistentData("loyalty_members.json", INITIAL_MEMBERS);
      vi.restoreAllMocks();
    });

    it("returns 403 on GET ?phone= for CASHIER to prevent enumeration oracle", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "user-cashier",
        name: "Kasir Test",
        role: "CASHIER",
      });

      const req = new NextRequest("http://localhost:3000/api/loyalty/members?phone=081911223344");
      const res = await GET(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Akses ditolak");
    });

    it("allows GET ?phone= for MANAGER and returns matching member", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "user-mgr",
        name: "Manager Test",
        role: "MANAGER",
      });

      const req = new NextRequest("http://localhost:3000/api/loyalty/members?phone=081911223344");
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.members)).toBe(true);
    });

    it("normalizes Ketut Dian with 55 points to Bronze on GET", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "user-mgr",
        name: "Manager Test",
        role: "MANAGER",
      });

      const req = new NextRequest("http://localhost:3000/api/loyalty/members");
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      const ketut = json.members.find((m: LoyaltyMember) => m.name === "Ketut Dian");
      expect(ketut).toBeDefined();
      expect(ketut.points).toBe(55);
      expect(ketut.tier).toBe("Bronze");
    });

    it("allows CASHIER to update points in POS with natural tier elevation without 403", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "user-cashier",
        name: "Kasir Test",
        role: "CASHIER",
      });

      // Ketut Dian has id "mem-001"
      const req = new NextRequest("http://localhost:3000/api/loyalty/members", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "mem-001",
          updates: {
            points: 550, // 550 qualifies naturally for Silver
            tier: "Silver",
            tierHistory: [
              {
                id: "th-auto-1",
                memberId: "mem-001",
                previousTier: "Bronze",
                newTier: "Silver",
                pointsAtChange: 550,
                isManualOverride: false,
              },
            ],
          },
        }),
      });

      const res = await PUT(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.member.points).toBe(550);
      expect(json.member.tier).toBe("Silver");
      // Cashier response must be masked
      expect(json.member.phone).toContain("****");
      expect(json.member.identityNo).toBe("");
    });

    it("rejects CASHIER manual tier override attempt with HTTP 403", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "user-cashier",
        name: "Kasir Test",
        role: "CASHIER",
      });

      // Ketut Dian has 55 points, cashier tries to set Platinum
      const req = new NextRequest("http://localhost:3000/api/loyalty/members", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "mem-001",
          updates: {
            tier: "Platinum",
            tierHistory: [
              {
                id: "th-manual-1",
                memberId: "mem-001",
                newTier: "Platinum",
                isManualOverride: true,
              },
            ],
          },
        }),
      });

      const res = await PUT(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Akses ditolak");
    });

    it("prevents CASHIER from erasing stored identityNo or overwriting real phone with masked *", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "user-cashier",
        name: "Kasir Test",
        role: "CASHIER",
      });

      const req = new NextRequest("http://localhost:3000/api/loyalty/members", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "mem-001",
          updates: {
            identityNo: "", // Empty identityNo sent by cashier UI
            phone: "+62 819-****-3344", // Masked phone sent by cashier UI
          },
        }),
      });

      const res = await PUT(req);
      expect(res.status).toBe(200);

      // Check stored member in persistent storage directly as MANAGER
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "user-mgr",
        name: "Manager Test",
        role: "MANAGER",
      });

      const getReq = new NextRequest("http://localhost:3000/api/loyalty/members");
      const getRes = await GET(getReq);
      const getJson = await getRes.json();
      const storedKetut = getJson.members.find((m: LoyaltyMember) => m.id === "mem-001");

      expect(storedKetut.phone).toBe("+62 819-1122-3344");
      expect(storedKetut.identityNo).not.toBe("");
    });
  });
});
