import { describe, expect, it } from "vitest";

import { filterGuestBookings, filterGuestOrders, normalizePhone, parseTableParam } from "@/features/customer/guest-session";
import type { CoworkingBooking } from "@/types/coworking";
import type { OrderRecord } from "@/types/order";

const order = (id: string, customerName: string, customerPhone?: string) =>
  ({ id, customerName, customerPhone }) as OrderRecord;
const booking = (id: string, guestName: string, guestPhone: string) =>
  ({ id, guestName, guestPhone }) as CoworkingBooking;

describe("normalizePhone", () => {
  it("reduces Indonesian numbers to one comparable form", () => {
    expect(normalizePhone("+62 812-3456-7890")).toBe("081234567890");
    expect(normalizePhone("6281234567890")).toBe("081234567890");
    expect(normalizePhone("0812 3456 7890")).toBe("081234567890");
  });

  it("returns an empty string for blank or digit-less input", () => {
    expect(normalizePhone("")).toBe("");
    expect(normalizePhone("abc")).toBe("");
    expect(normalizePhone(undefined)).toBe("");
  });
});

describe("filterGuestOrders", () => {
  it("matches orders by phone, never by name", () => {
    const orders = [order("mine", "Made", "+62 812 1111"), order("same-name", "Made", "0812 9999"), order("legacy", "Made")];

    expect(filterGuestOrders(orders, { phone: "08121111" }).map((o) => o.id)).toEqual(["mine"]);
  });

  it("returns nothing for a guest without a phone", () => {
    expect(filterGuestOrders([order("a", "Made", "0812")], { phone: "" })).toEqual([]);
  });
});

describe("filterGuestBookings", () => {
  it("matches bookings by guest phone and ignores look-alike names", () => {
    const bookings = [booking("mine", "Made Bagus", "0812 1111"), booking("other", "Made", "0812 2222")];

    expect(filterGuestBookings(bookings, { phone: "+628121111" }).map((b) => b.id)).toEqual(["mine"]);
  });
});

describe("parseTableParam", () => {
  it("accepts a known table, case-insensitive", () => {
    expect(parseTableParam("t-04", ["T-01", "T-04"])).toBe("T-04");
  });

  it("rejects tables that do not exist or look unsafe", () => {
    expect(parseTableParam("T-99", ["T-01"])).toBeNull();
    expect(parseTableParam("<script>", ["T-01"])).toBeNull();
    expect(parseTableParam(null, ["T-01"])).toBeNull();
  });

  it("accepts a well-formed table when the table list is not loaded yet", () => {
    expect(parseTableParam("vip-01", [])).toBe("VIP-01");
  });
});
