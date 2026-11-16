import { describe, it, expect } from "vitest";
import {
  formatTicketCodeInput,
  normalizePhoneNumber,
  validateRecoveryCodeInput,
  validateRecoveryPhoneInput,
  getRecoveryStatusMeta,
  buildSupportWhatsAppUrl,
  DEFAULT_CS_WHATSAPP_NUMBER,
  maskEmail,
  maskPhone,
  buildRecoveryWhatsAppMessage,
} from "@/features/events-tickets-recovery/ticket-recovery-domain";
import { CONTACT } from "@/features/landing/landing-content";

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

    it("generates WhatsApp URL using default central CS number", () => {
      const url = buildSupportWhatsAppUrl(DEFAULT_CS_WHATSAPP_NUMBER, "user@example.com");
      expect(url).toBe(
        `https://wa.me/${DEFAULT_CS_WHATSAPP_NUMBER}?text=${encodeURIComponent(
          "Halo Admin Dago Hub, saya lupa kode booking tiket event saya untuk email (user@example.com). Mohon bantu verifikasi dan kirimkan e-tiket saya. Terima kasih!"
        )}`
      );
    });
  });

  describe("DEFAULT_CS_WHATSAPP_NUMBER", () => {
    it("is derived from central CONTACT.phone configuration", () => {
      expect(DEFAULT_CS_WHATSAPP_NUMBER).toBe(normalizePhoneNumber(CONTACT.phone));
      expect(DEFAULT_CS_WHATSAPP_NUMBER).toBe("6282115501995");
    });
  });

  describe("maskEmail", () => {
    it("masks email local part while preserving domain", () => {
      expect(maskEmail("budi.santoso@gmail.com")).toBe("b***o@gmail.com");
      expect(maskEmail("alex@example.com")).toBe("a***x@example.com");
    });

    it("handles short local parts safely", () => {
      expect(maskEmail("me@test.com")).toBe("m***@test.com");
      expect(maskEmail("a@test.com")).toBe("a***@test.com");
    });

    it("handles empty or invalid inputs gracefully", () => {
      expect(maskEmail("")).toBe("");
      expect(maskEmail("not-an-email")).toBe("not-an-email");
    });
  });

  describe("maskPhone", () => {
    it("masks middle digits of international phone numbers", () => {
      expect(maskPhone("6281234567890")).toBe("6281****7890");
      expect(maskPhone("081234567891")).toBe("0812****7891");
    });

    it("handles short or empty inputs gracefully", () => {
      expect(maskPhone("")).toBe("");
      expect(maskPhone("12345")).toBe("12345");
    });
  });

  describe("buildRecoveryWhatsAppMessage", () => {
    it("formats message for single booking correctly", () => {
      const msg = buildRecoveryWhatsAppMessage("Budi", [
        {
          ticketCode: "DAGO-EVT-001",
          eventTitle: "Workshop Kopi",
          ticketCount: 2,
          privateAccessUrl: "https://dagoeng.com/events/tickets/tok-123",
        },
      ]);
      expect(msg).toContain("Halo Budi,");
      expect(msg).toContain("Workshop Kopi");
      expect(msg).toContain("DAGO-EVT-001");
      expect(msg).toContain("2 tiket");
      expect(msg).toContain("https://dagoeng.com/events/tickets/tok-123");
    });

    it("formats message for multiple bookings correctly", () => {
      const msg = buildRecoveryWhatsAppMessage("", [
        {
          ticketCode: "DAGO-EVT-001",
          eventTitle: "Event A",
          ticketCount: 1,
          privateAccessUrl: "https://dagoeng.com/events/tickets/tok-1",
        },
        {
          ticketCode: "DAGO-EVT-002",
          eventTitle: "Event B",
          ticketCount: 3,
          privateAccessUrl: "https://dagoeng.com/events/tickets/tok-2",
        },
      ]);
      expect(msg).toContain("Halo Kak,");
      expect(msg).toContain("1. Event A");
      expect(msg).toContain("2. Event B");
      expect(msg).toContain("https://dagoeng.com/events/tickets/tok-1");
      expect(msg).toContain("https://dagoeng.com/events/tickets/tok-2");
    });
  });
});

