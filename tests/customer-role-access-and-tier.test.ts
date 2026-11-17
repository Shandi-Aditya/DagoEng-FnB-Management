import { describe, expect, it } from "vitest";
import {
  calculateTierFromPoints,
  canUserExportCustomers,
  canUserViewFullCustomerContacts,
  maskCustomerEmail,
  maskCustomerPhone,
} from "@/features/customers/customers-domain";
import { INITIAL_MEMBERS } from "@/lib/master-data-defaults";
import type { RoleSlug } from "@/types/auth";

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
});
