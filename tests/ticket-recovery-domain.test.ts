import { describe, it, expect } from "vitest";
import {
  formatTicketCodeInput,
  normalizePhoneNumber,
  validateRecoveryCodeInput,
  validateRecoveryPhoneInput,
  getRecoveryStatusMeta,
  buildSupportWhatsAppUrl,
} from "@/features/events-tickets-recovery/ticket-recovery-domain";

describe("Ticket Recovery Domain Logic", () => {
  describe("formatTicketCodeInput", () => {
    it("trims and converts ticket code to capital letters", () => {
      expect(formatTicketCodeInput("  dago-evt-48246  ")).toBe("DAGO-EVT-48246");
      expect(formatTicketCodeInput("evt-12345")).toBe("EVT-12345");
    });

    it("handles empty or falsy inputs gracefully", () => {
      expect(formatTicketCodeInput("")).toBe("");
      expect(formatTicketCodeInput("   ")).toBe("");
    });
  });

  describe("normalizePhoneNumber", () => {
    it("converts leading 08xx to 628xx format", () => {
      expect(normalizePhoneNumber("081234567890")).toBe("6281234567890");
    });

    it("strips plus signs, dashes, spaces, and non-numeric characters", () => {
      expect(normalizePhoneNumber("+62 812-3456-7890")).toBe("6281234567890");
      expect(normalizePhoneNumber("0812-3456-7890")).toBe("6281234567890");
    });

    it("preserves numbers that already start with 62", () => {
      expect(normalizePhoneNumber("6281911223344")).toBe("6281911223344");
    });
  });

  describe("validateRecoveryCodeInput", () => {
    it("returns error if ticket code is missing", () => {
      const res = validateRecoveryCodeInput("", "user@example.com");
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Kode booking tiket dan alamat email wajib diisi.");
    });

    it("returns error if email is missing or invalid", () => {
      const res = validateRecoveryCodeInput("DAGO-EVT-123", "");
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Kode booking tiket dan alamat email wajib diisi.");

      const invalidEmail = validateRecoveryCodeInput("DAGO-EVT-123", "invalid-email");
      expect(invalidEmail.valid).toBe(false);
      expect(invalidEmail.error).toBe("Format alamat email tidak valid.");
    });

    it("returns valid and cleaned data for correct inputs", () => {
      const res = validateRecoveryCodeInput("  dago-evt-999  ", " USER@Example.COM ");
      expect(res.valid).toBe(true);
      expect(res.ticketCode).toBe("DAGO-EVT-999");
      expect(res.email).toBe("user@example.com");
    });
  });

  describe("validateRecoveryPhoneInput", () => {
    it("returns error if phone or email is missing", () => {
      const res = validateRecoveryPhoneInput("", "user@example.com");
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Alamat email dan nomor WhatsApp/HP wajib diisi.");
    });

    it("returns error if phone number is too short or invalid", () => {
      const res = validateRecoveryPhoneInput("081", "user@example.com");
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Nomor WhatsApp minimal 9 digit angka.");
    });

    it("returns valid and normalized data for correct inputs", () => {
      const res = validateRecoveryPhoneInput("0812-3456-7890", "user@example.com");
      expect(res.valid).toBe(true);
      expect(res.phone).toBe("6281234567890");
      expect(res.email).toBe("user@example.com");
    });
  });

  describe("getRecoveryStatusMeta", () => {
    it("maps PAID status to Lunas with success badge tone", () => {
      const meta = getRecoveryStatusMeta("PAID");
      expect(meta.label).toBe("Lunas");
      expect(meta.tone).toBe("success");
    });

    it("maps PENDING status to Menunggu Verifikasi with warning badge tone", () => {
      const meta = getRecoveryStatusMeta("PENDING");
      expect(meta.label).toBe("Menunggu Verifikasi");
      expect(meta.tone).toBe("warning");
    });

    it("maps CANCELLED status to Dibatalkan with destructive badge tone", () => {
      const meta = getRecoveryStatusMeta("CANCELLED");
      expect(meta.label).toBe("Dibatalkan");
      expect(meta.tone).toBe("destructive");
    });

    it("maps unknown or free statuses gracefully", () => {
      const metaFree = getRecoveryStatusMeta("FREE");
      expect(metaFree.label).toBe("Gratis");
      expect(metaFree.tone).toBe("info");

      const metaUnknown = getRecoveryStatusMeta("OTHER");
      expect(metaUnknown.label).toBe("OTHER");
      expect(metaUnknown.tone).toBe("neutral");
    });
  });

  describe("buildSupportWhatsAppUrl", () => {
    it("generates WhatsApp URL with custom email context", () => {
      const url = buildSupportWhatsAppUrl("6281234567890", "tamu@example.com");
      expect(url).toContain("https://wa.me/6281234567890?text=");
      expect(url).toContain(encodeURIComponent("tamu@example.com"));
      expect(url).toContain(encodeURIComponent("Halo Admin Dago Hub"));
    });

    it("generates fallback WhatsApp URL when email is empty", () => {
      const url = buildSupportWhatsAppUrl("6281234567890", "");
      expect(url).toContain("https://wa.me/6281234567890?text=");
      expect(url).toContain(encodeURIComponent("Halo Admin Dago Hub, saya lupa kode booking tiket event saya"));
    });
  });
});
