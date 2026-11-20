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
      favoriteItem: "Es Kopi",
      registeredOutletId: "outlet-1",
      registeredOutletName: "Singaraja",
      status: "ACTIVE",
      joinedDate: "2024-01-01",
      lastVisit: "2024-01-01",
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
        favoriteItem: "Es Kopi",
        registeredOutletId: "outlet-1",
        registeredOutletName: "Singaraja",
        status: "ACTIVE",
        joinedDate: "2024-01-01",
        lastVisit: "2024-01-01",
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
        scopeLevel: "OUTLET",
      } as any);

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
        scopeLevel: "OUTLET",
      } as any);

      const req = new NextRequest("http://localhost:3000/api/loyalty/members?phone=081911223344");
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.members)).toBe(true);
    });

    it("normalizes Ketut Dian with stale Silver tier and 55 points to Bronze on GET", async () => {
      const staleMembers = INITIAL_MEMBERS.map((m) =>
        m.id === "mem-001" ? { ...m, tier: "Silver" as const, points: 55, tierHistory: [] } : m
      );
      await writePersistentData("loyalty_members.json", staleMembers);

      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "user-mgr",
        name: "Manager Test",
        role: "MANAGER",
        scopeLevel: "OUTLET",
      } as any);

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
        scopeLevel: "OUTLET",
      } as any);

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
        scopeLevel: "OUTLET",
      } as any);

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
        scopeLevel: "OUTLET",
      } as any);

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
        scopeLevel: "OUTLET",
      } as any);

      const getReq = new NextRequest("http://localhost:3000/api/loyalty/members");
      const getRes = await GET(getReq);
      const getJson = await getRes.json();
      const storedKetut = getJson.members.find((m: LoyaltyMember) => m.id === "mem-001");

      expect(storedKetut.phone).toBe("+62 819-1122-3344");
      expect(storedKetut.identityNo).not.toBe("");
    });

    it("rejects PUT with string points ('5000') or negative points with HTTP 400 so CASHIER cannot escalate to Platinum", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "user-cashier",
        name: "Kasir Test",
        role: "CASHIER",
        scopeLevel: "OUTLET",
      } as any);

      const strReq = new NextRequest("http://localhost:3000/api/loyalty/members", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "mem-001",
          updates: { points: "5000" },
        }),
      });
      const strRes = await PUT(strReq);
      expect(strRes.status).toBe(400);

      const negReq = new NextRequest("http://localhost:3000/api/loyalty/members", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "mem-001",
          updates: { points: -10 },
        }),
      });
      const negRes = await PUT(negReq);
      expect(negRes.status).toBe(400);
    });

    it("preserves Owner manual tier override when CASHIER updates member with same tier or omitted tier", async () => {
      const overriddenMembers = INITIAL_MEMBERS.map((m) =>
        m.id === "mem-001"
          ? {
              ...m,
              tier: "Gold" as const,
              points: 55,
              tierHistory: [
                {
                  id: "th-owner-gold",
                  memberId: "mem-001",
                  previousTier: "Bronze" as const,
                  newTier: "Gold" as const,
                  pointsAtChange: 55,
                  reason: "VIP Tamu Owner",
                  isManualOverride: true,
                  actorName: "Owner Hub",
                  timestamp: "2026-11-01T00:00:00.000Z",
                },
              ],
            }
          : m
      );
      await writePersistentData("loyalty_members.json", overriddenMembers);

      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "user-cashier",
        name: "Kasir Test",
        role: "CASHIER",
        scopeLevel: "OUTLET",
      } as any);

      // Case 1: CASHIER sends updates.tier === "Gold" (existing overridden tier)
      const resSame = await PUT(
        new NextRequest("http://localhost:3000/api/loyalty/members", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: "mem-001",
            updates: { favoriteItem: "Americano", tier: "Gold" },
          }),
        })
      );
      expect(resSame.status).toBe(200);
      const jsonSame = await resSame.json();
      expect(jsonSame.member.tier).toBe("Gold");

      // Case 2: CASHIER omits updates.tier
      const resOmit = await PUT(
        new NextRequest("http://localhost:3000/api/loyalty/members", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: "mem-001",
            updates: { favoriteItem: "Matcha Latte" },
          }),
        })
      );
      expect(resOmit.status).toBe(200);
      const jsonOmit = await resOmit.json();
      expect(jsonOmit.member.tier).toBe("Gold");
    });

    it("blocks CASHIER from mutating existing tierHistory entries or wiping email/phone/identityNo", async () => {
      const seededMembers = INITIAL_MEMBERS.map((m) =>
        m.id === "mem-001"
          ? {
              ...m,
              tierHistory: [
                {
                  id: "th-auto-old",
                  memberId: "mem-001",
                  previousTier: "Bronze" as const,
                  newTier: "Bronze" as const,
                  pointsAtChange: 55,
                  reason: "Sync awal",
                  isManualOverride: false,
                  actorName: "Sistem",
                  timestamp: "2026-11-01T00:00:00.000Z",
                },
              ],
            }
          : m
      );
      await writePersistentData("loyalty_members.json", seededMembers);

      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "user-cashier",
        name: "Kasir Test",
        role: "CASHIER",
        scopeLevel: "OUTLET",
      } as any);

      // Reusing old id with isManualOverride: true must fail with 403
      const tamperRes = await PUT(
        new NextRequest("http://localhost:3000/api/loyalty/members", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: "mem-001",
            updates: {
              tierHistory: [
                {
                  id: "th-auto-old",
                  memberId: "mem-001",
                  previousTier: "Bronze",
                  newTier: "Platinum",
                  pointsAtChange: 55,
                  reason: "Hijack",
                  isManualOverride: true,
                  actorName: "Kasir",
                  timestamp: "2026-11-01T00:00:00.000Z",
                },
              ],
            },
          }),
        })
      );
      expect(tamperRes.status).toBe(403);

      // Attempting to wipe phone, email, and overwrite identityNo must preserve original PII
      const wipeRes = await PUT(
        new NextRequest("http://localhost:3000/api/loyalty/members", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: "mem-001",
            updates: {
              phone: "",
              email: "   ",
              identityNo: "9999999999",
            },
          }),
        })
      );
      expect(wipeRes.status).toBe(200);

      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "user-mgr",
        name: "Manager Test",
        role: "MANAGER",
        scopeLevel: "OUTLET",
      } as any);
      const checkRes = await GET(new NextRequest("http://localhost:3000/api/loyalty/members"));
      const checkJson = await checkRes.json();
      const ketut = checkJson.members.find((m: LoyaltyMember) => m.id === "mem-001");
      expect(ketut.phone).toBe("+62 819-1122-3344");
      expect(ketut.email).toBe("ketut.dian@gmail.com");
      expect(ketut.identityNo).toBe("NIK-510801990001");
    });

    it("enforces POST /api/loyalty/members role, forced 0 points, allowUpdate block, PII masking, and * phone guard", async () => {
      // CUSTOMER cannot POST
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "usr-cust-1",
        name: "Ketut Dian",
        email: "ketut.dian@gmail.com",
        role: "CUSTOMER",
        scopeLevel: "OUTLET",
      } as any);
      const custRes = await POST(
        new NextRequest("http://localhost:3000/api/loyalty/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Baru", phone: "081200009999" }),
        })
      );
      expect(custRes.status).toBe(403);

      // CASHIER cannot create member with masked phone (*)
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "user-cashier",
        name: "Kasir Test",
        role: "CASHIER",
        scopeLevel: "OUTLET",
      } as any);
      const maskedPhoneRes = await POST(
        new NextRequest("http://localhost:3000/api/loyalty/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Baru", phone: "0812****9999" }),
        })
      );
      expect(maskedPhoneRes.status).toBe(400);

      // CASHIER creating new member gets forced points = 0 and masked response PII
      const createRes = await POST(
        new NextRequest("http://localhost:3000/api/loyalty/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Member Baru Kasir",
            phone: "081277778888",
            email: "baru.kasir@gmail.com",
            identityNo: "5108011122334455",
            points: 5000,
            tier: "Platinum",
          }),
        })
      );
      expect(createRes.status).toBe(200);
      const createJson = await createRes.json();
      expect(createJson.member.points).toBe(0);
      expect(createJson.member.tier).toBe("Bronze");
      expect(createJson.member.phone).toContain("****");
      expect(createJson.member.identityNo).toBe("");

      // CASHIER allowUpdate on existing member is blocked (returns existing without overwriting)
      const dupRes = await POST(
        new NextRequest("http://localhost:3000/api/loyalty/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Ketut Dian Hacked",
            phone: "+62 819-1122-3344",
            points: 9999,
            allowUpdate: true,
          }),
        })
      );
      expect(dupRes.status).toBe(200);
      const dupJson = await dupRes.json();
      expect(dupJson.isExisting).toBe(true);
      expect(dupJson.member.points).toBe(55);
      expect(dupJson.member.tier).toBe("Bronze");
    });

    it("returns unmasked own email and phone (with blank identityNo) for CUSTOMER on GET", async () => {
      vi.spyOn(serverAuth, "getRequestAuthUser").mockResolvedValue({
        isAuthenticated: true,
        userId: "usr-ketut-1",
        name: "Ketut Dian",
        email: "ketut.dian@gmail.com",
        role: "CUSTOMER",
        scopeLevel: "OUTLET",
      } as any);

      const res = await GET(new NextRequest("http://localhost:3000/api/loyalty/members"));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.members).toHaveLength(1);
      expect(json.members[0].id).toBe("mem-001");
      expect(json.members[0].email).toBe("ketut.dian@gmail.com");
      expect(json.members[0].phone).toBe("+62 819-1122-3344");
      expect(json.members[0].identityNo).toBe("");
    });
  });
});
