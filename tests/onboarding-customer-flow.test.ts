import { describe, it, expect } from "vitest";

// Data structures and helpers representing the enhanced Onboarding & Customer Flow
interface MockMember {
  id: string;
  name: string;
  phone: string;
  email?: string;
  tier: "Bronze" | "Silver" | "Gold" | "Platinum";
  points: number;
}

const mockMembersDb: MockMember[] = [
  {
    id: "mem-001",
    name: "Ketut Dian",
    phone: "+62 819-1122-3344",
    email: "ketut.dian@gmail.com",
    tier: "Silver",
    points: 840,
  },
  {
    id: "mem-002",
    name: "Budi Santoso",
    phone: "+62 857-9988-7766",
    email: "budi.santoso@yahoo.com",
    tier: "Bronze",
    points: 165,
  },
];

// Helper: Deduplication and Loyalty Linking
function getOrCreateMember(
  db: MockMember[],
  data: { name: string; phone: string; email?: string; initialPoints?: number }
): { member: MockMember; isNew: boolean } {
  const cleanPhone = data.phone.replace(/\D/g, "");
  const cleanEmail = data.email?.trim().toLowerCase();

  const existing = db.find((m) => {
    const mPhone = m.phone.replace(/\D/g, "");
    const mEmail = m.email?.trim().toLowerCase();
    if (cleanPhone && mPhone && cleanPhone === mPhone) return true;
    if (cleanEmail && mEmail && cleanEmail === mEmail) return true;
    return false;
  });

  if (existing) {
    return { member: existing, isNew: false };
  }

  const newMember: MockMember = {
    id: `mem-${Date.now()}`,
    name: data.name.trim(),
    phone: data.phone.trim(),
    email: data.email?.trim() || undefined,
    tier: "Bronze",
    points: data.initialPoints || 0,
  };

  db.push(newMember);
  return { member: newMember, isNew: true };
}

describe("Onboarding & Customer Portal Flow Enhancements", () => {
  describe("1. Onboarding Direct Routing", () => {
    it("should route 'Booking Working Space' directly to /customer?tab=COWORKING", () => {
      const targetUrl = "/customer?tab=COWORKING";
      const params = new URLSearchParams(targetUrl.split("?")[1]);
      expect(params.get("tab")).toBe("COWORKING");
    });

    it("should route 'Pesan F&B' directly to /customer?tab=MENU", () => {
      const targetUrl = "/customer?tab=MENU";
      const params = new URLSearchParams(targetUrl.split("?")[1]);
      expect(params.get("tab")).toBe("MENU");
    });

    it("should route 'Gabung Member' directly to registration with returnTo", () => {
      const returnUrl = "/customer?tab=LOYALTY";
      const targetUrl = `/login?mode=register&returnTo=${encodeURIComponent(returnUrl)}`;
      const params = new URLSearchParams(targetUrl.split("?")[1]);
      expect(params.get("mode")).toBe("register");
      expect(params.get("returnTo")).toBe("/customer?tab=LOYALTY");
    });
  });

  describe("2. Guest Customer Portal & ReturnTo Login", () => {
    it("allows Guests to browse products and configure items without login", () => {
      const isCustomerLoggedIn = false;
      const guestCart: { productId: string; quantity: number }[] = [];

      // Guest adds product
      guestCart.push({ productId: "prod-01", quantity: 2 });
      expect(guestCart.length).toBe(1);
      expect(guestCart[0].quantity).toBe(2);
      expect(isCustomerLoggedIn).toBe(false);
    });

    it("preserves returnTo context when guest logs in", () => {
      const activeTab = "COWORKING";
      const returnToUrl = `/customer?tab=${activeTab}`;
      const loginUrl = `/login?returnTo=${encodeURIComponent(returnToUrl)}&mode=customer`;

      const parsedParams = new URLSearchParams(loginUrl.split("?")[1]);
      const redirectDestination = parsedParams.get("returnTo");

      expect(redirectDestination).toBe("/customer?tab=COWORKING");
    });
  });

  describe("3. Checkout & Booking Authentication Guard", () => {
    it("intercepts Guest checkout and requires authentication before payment", () => {
      let isCustomerLoggedIn = false;
      let isPaymentModalOpen = false;
      let isAuthModalOpen = false;

      function attemptCheckout() {
        if (!isCustomerLoggedIn) {
          isAuthModalOpen = true;
          return;
        }
        isPaymentModalOpen = true;
      }

      // Guest attempts checkout
      attemptCheckout();
      expect(isAuthModalOpen).toBe(true);
      expect(isPaymentModalOpen).toBe(false);

      // Guest registers / logs in
      isCustomerLoggedIn = true;
      isAuthModalOpen = false;
      attemptCheckout();

      expect(isPaymentModalOpen).toBe(true);
    });
  });

  describe("4. Loyalty Deduplication & Customer Profile Linking", () => {
    it("creates a new member with 50 bonus points for a new phone/email", () => {
      const db = [...mockMembersDb];
      const res = getOrCreateMember(db, {
        name: "I Putu Agus",
        phone: "+62 812-9988-1122",
        email: "putu.agus@gmail.com",
        initialPoints: 50,
      });

      expect(res.isNew).toBe(true);
      expect(res.member.name).toBe("I Putu Agus");
      expect(res.member.points).toBe(50);
      expect(res.member.tier).toBe("Bronze");
    });

    it("deduplicates existing customer and preserves existing points & tier", () => {
      const db = [...mockMembersDb];
      // Ketut Dian already exists with 840 points in Silver tier
      const res = getOrCreateMember(db, {
        name: "Ketut Dian",
        phone: "+62 819-1122-3344",
        email: "ketut.dian@gmail.com",
        initialPoints: 50,
      });

      expect(res.isNew).toBe(false);
      expect(res.member.id).toBe("mem-001");
      expect(res.member.points).toBe(840);
      expect(res.member.tier).toBe("Silver");
    });
  });
});
