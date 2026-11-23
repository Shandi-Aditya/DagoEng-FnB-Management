import { describe, expect, it } from "vitest";
import { DEFAULT_PLATFORM_SETTINGS } from "@/types/settings";
import {
  defaultPlatformSettingsState,
  mergePlatformSettingsState,
} from "@/lib/sync-domains/config-spec";
import {
  getAllowedSelfOrderPayments,
  isQrSelfOrderQrisOnly,
  resolveSelfOrderPaymentMethod,
} from "@/lib/self-order-policy";

describe("V-31: Self-order QR payment policy & platform settings contract", () => {
  describe("Settings defaults & config-spec merge", () => {
    it("defaults qrSelfOrderQrisOnly to true in DEFAULT_PLATFORM_SETTINGS and defaultPlatformSettingsState()", () => {
      expect(DEFAULT_PLATFORM_SETTINGS.qrSelfOrderQrisOnly).toBe(true);
      expect(defaultPlatformSettingsState().qrSelfOrderQrisOnly).toBe(true);
    });

    it("preserves explicit true/false and handles omitted or undefined patch cleanly in mergePlatformSettingsState", () => {
      const base = defaultPlatformSettingsState();

      const disabled = mergePlatformSettingsState(base, {
        qrSelfOrderQrisOnly: false,
      });
      expect(disabled.qrSelfOrderQrisOnly).toBe(false);

      const keepDisabledOnOmitted = mergePlatformSettingsState(disabled, {
        taxRatePercent: 12,
      });
      expect(keepDisabledOnOmitted.qrSelfOrderQrisOnly).toBe(false);

      const keepDisabledOnUndefined = mergePlatformSettingsState(disabled, {
        qrSelfOrderQrisOnly: undefined,
      });
      expect(keepDisabledOnUndefined.qrSelfOrderQrisOnly).toBe(false);

      const reEnabled = mergePlatformSettingsState(disabled, {
        qrSelfOrderQrisOnly: true,
      });
      expect(reEnabled.qrSelfOrderQrisOnly).toBe(true);

      const legacyBase = {
        ...base,
        qrSelfOrderQrisOnly: undefined,
      };
      const mergedFromLegacy = mergePlatformSettingsState(legacyBase, {});
      expect(mergedFromLegacy.qrSelfOrderQrisOnly).toBe(true);
    });
  });

  describe("isQrSelfOrderQrisOnly", () => {
    it("returns true when settings are omitted, null, undefined, or qrSelfOrderQrisOnly is undefined/true", () => {
      expect(isQrSelfOrderQrisOnly()).toBe(true);
      expect(isQrSelfOrderQrisOnly(null)).toBe(true);
      expect(isQrSelfOrderQrisOnly(undefined)).toBe(true);
      expect(isQrSelfOrderQrisOnly({})).toBe(true);
      expect(isQrSelfOrderQrisOnly({ qrSelfOrderQrisOnly: undefined })).toBe(true);
      expect(isQrSelfOrderQrisOnly({ qrSelfOrderQrisOnly: true })).toBe(true);
    });

    it("returns false only when qrSelfOrderQrisOnly is explicitly false", () => {
      expect(isQrSelfOrderQrisOnly({ qrSelfOrderQrisOnly: false })).toBe(false);
    });
  });

  describe("getAllowedSelfOrderPayments", () => {
    it("returns ['QRIS'] when QRIS-only is active (default, omitted, null, undefined, true)", () => {
      expect(getAllowedSelfOrderPayments()).toEqual(["QRIS"]);
      expect(getAllowedSelfOrderPayments(null)).toEqual(["QRIS"]);
      expect(getAllowedSelfOrderPayments(undefined)).toEqual(["QRIS"]);
      expect(getAllowedSelfOrderPayments({})).toEqual(["QRIS"]);
      expect(getAllowedSelfOrderPayments({ qrSelfOrderQrisOnly: true })).toEqual(["QRIS"]);
    });

    it("returns ['QRIS', 'CASHIER'] when qrSelfOrderQrisOnly is false", () => {
      expect(getAllowedSelfOrderPayments({ qrSelfOrderQrisOnly: false })).toEqual([
        "QRIS",
        "CASHIER",
      ]);
    });
  });

  describe("resolveSelfOrderPaymentMethod", () => {
    describe("when QRIS-only is enabled (omitted / null / undefined / true)", () => {
      const qrisOnlyVariants = [
        undefined,
        null,
        {},
        { qrSelfOrderQrisOnly: undefined },
        { qrSelfOrderQrisOnly: true },
      ] as const;

      it("resolves undefined, null, empty/whitespace string, and 'QRIS' (case-insensitive) to QRIS", () => {
        for (const settings of qrisOnlyVariants) {
          expect(resolveSelfOrderPaymentMethod(undefined, settings)).toEqual({
            ok: true,
            paymentMethod: "QRIS",
          });
          expect(resolveSelfOrderPaymentMethod(null, settings)).toEqual({
            ok: true,
            paymentMethod: "QRIS",
          });
          expect(resolveSelfOrderPaymentMethod("", settings)).toEqual({
            ok: true,
            paymentMethod: "QRIS",
          });
          expect(resolveSelfOrderPaymentMethod("   ", settings)).toEqual({
            ok: true,
            paymentMethod: "QRIS",
          });
          expect(resolveSelfOrderPaymentMethod("QRIS", settings)).toEqual({
            ok: true,
            paymentMethod: "QRIS",
          });
          expect(resolveSelfOrderPaymentMethod("  qris ", settings)).toEqual({
            ok: true,
            paymentMethod: "QRIS",
          });
        }
      });

      it("rejects non-QRIS string methods with 403 SELF_ORDER_QRIS_ONLY", () => {
        const forbiddenInputs = [
          "CASH",
          "cash",
          "CASHIER",
          " cashier ",
          "CASH_COUNTER",
          "EDC",
          "SPLIT",
          "TUNAI",
        ];
        for (const method of forbiddenInputs) {
          expect(resolveSelfOrderPaymentMethod(method, { qrSelfOrderQrisOnly: true })).toEqual({
            ok: false,
            status: 403,
            code: "SELF_ORDER_QRIS_ONLY",
            error: "FORBIDDEN: Self-order QR hanya menerima pembayaran QRIS sesuai pengaturan outlet.",
          });
          expect(resolveSelfOrderPaymentMethod(method)).toEqual({
            ok: false,
            status: 403,
            code: "SELF_ORDER_QRIS_ONLY",
            error: "FORBIDDEN: Self-order QR hanya menerima pembayaran QRIS sesuai pengaturan outlet.",
          });
        }
      });

      it("rejects invalid non-string types with 400 INVALID_PAYMENT_METHOD", () => {
        const invalidTypes = [123, true, false, {}, [], Symbol("qris")];
        for (const method of invalidTypes) {
          expect(resolveSelfOrderPaymentMethod(method, { qrSelfOrderQrisOnly: true })).toEqual({
            ok: false,
            status: 400,
            code: "INVALID_PAYMENT_METHOD",
            error: "Metode pembayaran self-order tidak valid.",
          });
        }
      });
    });

    describe("when qrSelfOrderQrisOnly is false", () => {
      const relaxed = { qrSelfOrderQrisOnly: false };

      it("resolves undefined, null, empty, and 'QRIS' to QRIS", () => {
        expect(resolveSelfOrderPaymentMethod(undefined, relaxed)).toEqual({
          ok: true,
          paymentMethod: "QRIS",
        });
        expect(resolveSelfOrderPaymentMethod(null, relaxed)).toEqual({
          ok: true,
          paymentMethod: "QRIS",
        });
        expect(resolveSelfOrderPaymentMethod("", relaxed)).toEqual({
          ok: true,
          paymentMethod: "QRIS",
        });
        expect(resolveSelfOrderPaymentMethod(" qris ", relaxed)).toEqual({
          ok: true,
          paymentMethod: "QRIS",
        });
      });

      it("resolves 'CASH' and 'CASHIER' (case-insensitive trimmed) to CASH", () => {
        expect(resolveSelfOrderPaymentMethod("CASH", relaxed)).toEqual({
          ok: true,
          paymentMethod: "CASH",
        });
        expect(resolveSelfOrderPaymentMethod("  cash ", relaxed)).toEqual({
          ok: true,
          paymentMethod: "CASH",
        });
        expect(resolveSelfOrderPaymentMethod("CASHIER", relaxed)).toEqual({
          ok: true,
          paymentMethod: "CASH",
        });
        expect(resolveSelfOrderPaymentMethod(" cashier\t", relaxed)).toEqual({
          ok: true,
          paymentMethod: "CASH",
        });
      });

      it("rejects unsupported string methods and invalid non-string types with 400 INVALID_PAYMENT_METHOD", () => {
        const unsupported = [
          "CASH_COUNTER",
          "EDC",
          "SPLIT",
          "TUNAI",
          "TRANSFER",
          123,
          true,
          false,
          { method: "QRIS" },
          ["QRIS"],
        ];
        for (const method of unsupported) {
          expect(resolveSelfOrderPaymentMethod(method, relaxed)).toEqual({
            ok: false,
            status: 400,
            code: "INVALID_PAYMENT_METHOD",
            error: "Metode pembayaran self-order tidak valid.",
          });
        }
      });
    });
  });
});
