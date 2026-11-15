import { describe, it, expect } from "vitest";
import {
  validatePasswordInput,
  formatActivationExpiry,
  getActivationErrorMessage,
} from "@/features/events-activate/organizer-activation-domain";

describe("Organizer Activation Domain Logic", () => {
  describe("validatePasswordInput", () => {
    it("rejects password shorter than 8 characters", () => {
      const res = validatePasswordInput("pass1", "pass1");
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Password wajib memiliki minimal 8 karakter.");
    });

    it("rejects password when confirmation does not match", () => {
      const res = validatePasswordInput("password123", "password321");
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Konfirmasi password tidak cocok dengan password baru.");
    });

    it("accepts valid password matching confirmation with at least 8 characters", () => {
      const res = validatePasswordInput("securePass123", "securePass123");
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it("rejects empty inputs gracefully", () => {
      const res = validatePasswordInput("", "");
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Password wajib memiliki minimal 8 karakter.");
    });
  });

  describe("formatActivationExpiry", () => {
    it("returns friendly human readable expiry label for ISO date string", () => {
      const expiry = formatActivationExpiry("2026-11-20T12:00:00.000Z");
      expect(expiry).toContain("48 jam sejak penerbitan");
    });

    it("returns default fallback when expiresAt is missing or invalid", () => {
      expect(formatActivationExpiry(null)).toBe("48 jam sejak penerbitan");
      expect(formatActivationExpiry(undefined)).toBe("48 jam sejak penerbitan");
    });
  });

  describe("getActivationErrorMessage", () => {
    it("returns specific message for missing token", () => {
      const msg = getActivationErrorMessage("TOKEN_MISSING");
      expect(msg).toBe("Tautan aktivasi tidak valid. Parameter token tidak ditemukan pada URL.");
    });

    it("returns fallback message for general server or token errors", () => {
      const msg = getActivationErrorMessage("TOKEN_EXPIRED");
      expect(msg).toBe("Tautan aktivasi tidak valid atau telah kedaluwarsa.");

      const customMsg = getActivationErrorMessage("Token sudah pernah digunakan");
      expect(customMsg).toBe("Token sudah pernah digunakan");
    });

    it("returns connection error message when specified", () => {
      const msg = getActivationErrorMessage("NETWORK_ERROR");
      expect(msg).toBe("Gagal menghubungi server untuk memvalidasi token aktivasi.");
    });
  });
});
