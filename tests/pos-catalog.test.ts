import { describe, expect, it } from "vitest";

import { cartItemCount, productAvailability, tenantClosedMessage } from "@/features/pos/pos-catalog";

const OPEN = { isOpen: true };
const CLOSED = { isOpen: false, reason: "Persiapan bahan", estimatedReopenTime: "Buka kembali pk 13:00 WITA" };

describe("productAvailability", () => {
  it("puts a closed tenant before stock state", () => {
    expect(productAvailability({ isAvailable: false, stockStatus: "OUT_OF_STOCK" }, CLOSED)).toBe("closed");
  });

  it("marks unavailable or out-of-stock products as sold out", () => {
    expect(productAvailability({ isAvailable: false, stockStatus: "SAFE" }, OPEN)).toBe("soldOut");
    expect(productAvailability({ isAvailable: true, stockStatus: "OUT_OF_STOCK" }, OPEN)).toBe("soldOut");
  });

  it("flags critical stock and otherwise allows ordering", () => {
    expect(productAvailability({ isAvailable: true, stockStatus: "CRITICAL" }, OPEN)).toBe("lowStock");
    expect(productAvailability({ isAvailable: true, stockStatus: "SAFE" }, OPEN)).toBe("available");
  });
});

describe("tenantClosedMessage", () => {
  it("joins the reason and the reopen estimate", () => {
    expect(tenantClosedMessage(CLOSED)).toBe("Persiapan bahan · Buka kembali pk 13:00 WITA");
    expect(tenantClosedMessage({ isOpen: false, reason: "Libur" })).toBe("Libur");
  });
});

describe("cartItemCount", () => {
  it("sums quantities, not lines", () => {
    expect(cartItemCount([{ quantity: 2 }, { quantity: 3 }])).toBe(5);
    expect(cartItemCount([])).toBe(0);
  });
});
