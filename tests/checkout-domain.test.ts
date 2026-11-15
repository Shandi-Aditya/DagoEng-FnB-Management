import { describe, expect, it } from "vitest";
import {
  getCheckoutMethodLabel,
  buildDokuSimulationPayload,
  formatInvoiceNumber,
  isTransactionSettled,
  type CheckoutPaymentMethod,
} from "@/features/checkout/checkout-domain";

describe("checkout-domain logic", () => {
  describe("getCheckoutMethodLabel", () => {
    it("returns correct labels for QRIS", () => {
      const res = getCheckoutMethodLabel("QRIS");
      expect(res.label).toBe("QRIS");
      expect(res.sublabel).toBe("Pembayaran instan QRIS");
    });

    it("returns correct labels for BCA_VA", () => {
      const res = getCheckoutMethodLabel("BCA_VA");
      expect(res.label).toBe("Virtual account");
      expect(res.sublabel).toBe("BCA / Mandiri / BNI");
    });

    it("returns correct labels for CREDIT_CARD", () => {
      const res = getCheckoutMethodLabel("CREDIT_CARD");
      expect(res.label).toBe("Kartu kredit");
      expect(res.sublabel).toBe("Visa / Mastercard / JCB");
    });

    it("handles unknown or fallback methods gracefully", () => {
      const res = getCheckoutMethodLabel("UNKNOWN");
      expect(res.label).toBe("QRIS");
      expect(res.sublabel).toBe("Pembayaran instan QRIS");
    });
  });

  describe("buildDokuSimulationPayload", () => {
    it("constructs payload with SUCCESS status", () => {
      const payload = buildDokuSimulationPayload("INV-12345", "SUCCESS", "tok_abc");
      expect(payload).toEqual({
        invoiceNumber: "INV-12345",
        status: "SUCCESS",
        token: "tok_abc",
      });
    });

    it("constructs payload with FAILED status", () => {
      const payload = buildDokuSimulationPayload("INV-67890", "FAILED", "tok_xyz");
      expect(payload).toEqual({
        invoiceNumber: "INV-67890",
        status: "FAILED",
        token: "tok_xyz",
      });
    });

    it("falls back to generated invoice when invoiceNumber is empty", () => {
      const payload = buildDokuSimulationPayload("", "SUCCESS", "tok_123");
      expect(payload.invoiceNumber).toMatch(/^INV-/);
    });
  });

  describe("formatInvoiceNumber", () => {
    it("returns invoice when provided", () => {
      expect(formatInvoiceNumber("INV-DOKU-999", "TCK-001")).toBe("INV-DOKU-999");
    });

    it("derives invoice from ticketCode if invoice is missing", () => {
      expect(formatInvoiceNumber("", "TCK-001")).toBe("INV-TCK-001");
      expect(formatInvoiceNumber(null, "TCK-002")).toBe("INV-TCK-002");
    });

    it("generates fallback when both are missing", () => {
      const fallback = formatInvoiceNumber("", "");
      expect(fallback).toMatch(/^INV-/);
    });
  });

  describe("isTransactionSettled", () => {
    it("returns true for PAID", () => {
      expect(isTransactionSettled("PAID")).toBe(true);
    });

    it("returns true for CANCELLED", () => {
      expect(isTransactionSettled("CANCELLED")).toBe(true);
    });

    it("returns false for PENDING or other statuses", () => {
      expect(isTransactionSettled("PENDING")).toBe(false);
      expect(isTransactionSettled("FAILED")).toBe(false);
      expect(isTransactionSettled("")).toBe(false);
    });
  });
});
