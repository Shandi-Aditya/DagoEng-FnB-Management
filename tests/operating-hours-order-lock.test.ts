import { describe, it, expect } from "vitest";
import {
  validateOrderOperationalHours,
  isServiceWithinHours,
  isTenantAcceptingOrders,
} from "@/lib/operating-hours";

describe("TSK-01: Operational Hours Server Lock & Boundary Validation", () => {
  const customOperationalHours = {
    fnb: {
      openTime: "08:00",
      closeTime: "22:00",
      isOpen: true,
    },
    coworking: {
      openTime: "09:00",
      closeTime: "18:00",
      isOpen: true,
    },
  };

  it("permits orders within regular operational hours (e.g. 14:00 WITA)", () => {
    // 14:00 WITA = 06:00 UTC
    const orderDate = new Date("2026-11-25T06:00:00.000Z");
    const result = validateOrderOperationalHours(orderDate, {
      operationalHours: customOperationalHours,
    });
    expect(result.allowed).toBe(true);
    expect(result.isOutsideOperatingHours).toBeUndefined();
  });

  it("rejects orders outside regular operational hours (e.g. 03:00 WITA)", () => {
    // 03:00 WITA = 19:00 UTC previous day
    const orderDate = new Date("2026-11-24T19:00:00.000Z");
    const result = validateOrderOperationalHours(orderDate, {
      operationalHours: customOperationalHours,
    });
    expect(result.allowed).toBe(false);
    expect(result.isOutsideOperatingHours).toBe(true);
    expect(result.reason).toContain("di luar jam operasional");
  });

  it("permits orders outside hours if supervisor PIN is verified", () => {
    const orderDate = new Date("2026-11-24T19:00:00.000Z");
    const result = validateOrderOperationalHours(orderDate, {
      operationalHours: customOperationalHours,
      supervisorPinVerified: true,
    });
    expect(result.allowed).toBe(true);
  });

  it("permits orders outside hours if requester is Super Admin or Owner", () => {
    const orderDate = new Date("2026-11-24T19:00:00.000Z");
    const result = validateOrderOperationalHours(orderDate, {
      operationalHours: customOperationalHours,
      isSuperAdminOrOwner: true,
    });
    expect(result.allowed).toBe(true);
  });

  it("enforces tenant-specific operational hours when tenant is closed", () => {
    // 14:00 WITA (within platform hours, but tenant has 08:00 - 12:00)
    const orderDate = new Date("2026-11-25T06:00:00.000Z");
    const tenantOperations = {
      "tenant-bakery": {
        isOpenOrder: true,
        openTime: "08:00",
        closeTime: "12:00",
      },
    };

    const result = validateOrderOperationalHours(orderDate, {
      operationalHours: customOperationalHours,
      tenantOperations,
      tenantIds: ["tenant-bakery"],
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Mitra di luar jam operasional");
  });

  it("allows tenant order when manualOverride is OPEN even if outside hours", () => {
    const orderDate = new Date("2026-11-25T06:00:00.000Z");
    const tenantOperations = {
      "tenant-bakery": {
        isOpenOrder: false, // normally closed
        manualOverride: "OPEN" as const, // manually opened by operator
        openTime: "08:00",
        closeTime: "12:00",
      },
    };

    const result = validateOrderOperationalHours(orderDate, {
      operationalHours: customOperationalHours,
      tenantOperations,
      tenantIds: ["tenant-bakery"],
    });
    expect(result.allowed).toBe(true);
  });

  it("rejects invalid date format without throwing RangeError", () => {
    const result = validateOrderOperationalHours("invalid-date-string", {
      operationalHours: customOperationalHours,
    });
    expect(result.allowed).toBe(false);
    expect(result.isOutsideOperatingHours).toBe(true);
    expect(result.reason).toContain("Format waktu transaksi tidak valid");
  });

  it("respects isAcceptingOrders legacy field when isOpenOrder is omitted", () => {
    const orderDate = new Date("2026-11-25T06:00:00.000Z");
    const tenantOperations = {
      "tenant-bakery": {
        isAcceptingOrders: false,
        openTime: "08:00",
        closeTime: "22:00",
      } as any,
    };

    const result = validateOrderOperationalHours(orderDate, {
      operationalHours: customOperationalHours,
      tenantOperations,
      tenantIds: ["tenant-bakery"],
    });
    expect(result.allowed).toBe(false);
  });
});
