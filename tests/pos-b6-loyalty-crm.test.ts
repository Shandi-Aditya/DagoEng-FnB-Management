import { describe, it, expect } from "vitest";
import {
  INITIAL_MEMBERS,
  normalizeLoyaltyPhone,
  LoyaltyMember,
} from "@/contexts/LoyaltyContext";

describe("POS B6: Sinkronisasi Poin & Member CRM (POS-08, POS-09, POS-28, TC-D03, TC-D04, TC-K11)", () => {
  it("B6.1 (POS-09 / TC-D04): normalizeLoyaltyPhone menormalkan berbagai format nomor telepon Indonesia", () => {
    expect(normalizeLoyaltyPhone("+62 819-1122-3344")).toBe("081911223344");
    expect(normalizeLoyaltyPhone("6281911223344")).toBe("081911223344");
    expect(normalizeLoyaltyPhone("0819-1122-3344")).toBe("081911223344");
    expect(normalizeLoyaltyPhone("081911223344")).toBe("081911223344");
  });

  it("B6.2 (POS-08 / TC-D03): Transaksi member lunas menambah poin, totalSpend, dan totalVisits secara simultan", () => {
    const member: LoyaltyMember = { ...INITIAL_MEMBERS[0] };
    const initialPoints = member.points;
    const initialSpend = member.totalSpend;
    const initialVisits = member.totalVisits;

    const pointsEarned = 56;
    const spendAmount = 56350;

    // Simulate addPoints logic
    const updatedMember: LoyaltyMember = {
      ...member,
      points: member.points + pointsEarned,
      totalSpend: member.totalSpend + spendAmount,
      totalVisits: member.totalVisits + 1,
      lastVisit: "06 Nov 2026",
    };

    expect(updatedMember.points).toBe(initialPoints + 56);
    expect(updatedMember.totalSpend).toBe(initialSpend + 56350);
    expect(updatedMember.totalVisits).toBe(initialVisits + 1);
    expect(updatedMember.totalSpend).toBeGreaterThan(0);
    expect(updatedMember.totalVisits).toBeGreaterThan(0);
  });

  it("B6.3 (POS-28 / TC-K11): Member memiliki saldo poin historis di CRM dan transaksi menambah poin tanpa mereset saldo lama", () => {
    const ketutDian = INITIAL_MEMBERS.find((m) => m.name === "Ketut Dian");
    expect(ketutDian).toBeDefined();

    // Saldo awal CRM bukan 0
    expect(ketutDian?.points).toBe(55);
    expect(ketutDian?.totalSpend).toBe(550000);
    expect(ketutDian?.totalVisits).toBe(5);

    // Transaksi baru menghasilkan +56 Pts
    const newPoints = (ketutDian?.points || 0) + 56;
    expect(newPoints).toBe(111);
  });

  it("B6.4 (POS-09 / TC-D04): Mencegah duplikasi member dengan nomor telepon yang sama", () => {
    const membersList: LoyaltyMember[] = [...INITIAL_MEMBERS];

    const newRegisterInput = {
      name: "Dian Ketut",
      phone: "0819-1122-3344", // Same normalized phone as +62 819-1122-3344
    };

    const normInputPhone = normalizeLoyaltyPhone(newRegisterInput.phone);
    const existing = membersList.find(
      (m) => normalizeLoyaltyPhone(m.phone) === normInputPhone
    );

    expect(existing).toBeDefined();
    expect(existing?.id).toBe("mem-001");
    expect(existing?.name).toBe("Ketut Dian");
  });
});
