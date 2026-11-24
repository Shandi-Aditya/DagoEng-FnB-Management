import type { PlatformSettings } from "@/types/settings";

export type SelfOrderPaymentChoice = "QRIS" | "CASHIER";

export type SelfOrderPaymentResolution =
  | { ok: true; paymentMethod: "QRIS" | "CASH" }
  | { ok: false; status: 400 | 403; code: string; error: string };

type SelfOrderPolicySettings = Pick<PlatformSettings, "qrSelfOrderQrisOnly"> | null | undefined;

const INVALID_PAYMENT_METHOD_RESULT: SelfOrderPaymentResolution = {
  ok: false,
  status: 400,
  code: "INVALID_PAYMENT_METHOD",
  error: "Metode pembayaran self-order tidak valid.",
};

const QRIS_ONLY_FORBIDDEN_RESULT: SelfOrderPaymentResolution = {
  ok: false,
  status: 403,
  code: "SELF_ORDER_QRIS_ONLY",
  error: "FORBIDDEN: Self-order QR hanya menerima pembayaran QRIS sesuai pengaturan outlet.",
};

export function isQrSelfOrderQrisOnly(settings?: SelfOrderPolicySettings): boolean {
  return settings?.qrSelfOrderQrisOnly !== false;
}

export function getAllowedSelfOrderPayments(
  settings?: SelfOrderPolicySettings
): readonly SelfOrderPaymentChoice[] {
  return isQrSelfOrderQrisOnly(settings) ? ["QRIS"] : ["QRIS", "CASHIER"];
}

export function resolveSelfOrderPaymentMethod(
  rawMethod: unknown,
  settings?: SelfOrderPolicySettings
): SelfOrderPaymentResolution {
  if (rawMethod === undefined || rawMethod === null) {
    return { ok: true, paymentMethod: "QRIS" };
  }

  if (typeof rawMethod !== "string") {
    return INVALID_PAYMENT_METHOD_RESULT;
  }

  const normalized = rawMethod.trim().toUpperCase();
  if (normalized === "" || normalized === "QRIS") {
    return { ok: true, paymentMethod: "QRIS" };
  }

  if (isQrSelfOrderQrisOnly(settings)) {
    return QRIS_ONLY_FORBIDDEN_RESULT;
  }

  if (normalized === "CASH" || normalized === "CASHIER") {
    return { ok: true, paymentMethod: "CASH" };
  }

  return INVALID_PAYMENT_METHOD_RESULT;
}
