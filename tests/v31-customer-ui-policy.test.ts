import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getAllowedSelfOrderPayments, isQrSelfOrderQrisOnly } from "@/lib/self-order-policy";

function readWorkspaceFile(relPath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), "utf-8");
}

describe("V-31: Customer UI hardening & settings toggle policy", () => {
  describe("1. PaymentWaitingModal has no client self-confirm simulation", () => {
    const src = readWorkspaceFile("src/features/payment/PaymentWaitingModal.tsx");

    it("removes onPaymentSuccess, handleSimulateWebhookSuccess, isVerifying, and fake confirm button", () => {
      expect(src).not.toContain("onPaymentSuccess");
      expect(src).not.toContain("handleSimulateWebhookSuccess");
      expect(src).not.toContain("isVerifying");
      expect(src).not.toContain("Konfirmasi pembayaran berhasil");
    });

    it("derives isPaidSuccess strictly from server-backed activeItem.paymentStatus and shows read-only waiting banner", () => {
      expect(src).toContain('const isPaidSuccess = activeItem?.paymentStatus === "PAID";');
      expect(src).not.toContain("setIsPaidSuccess(");
      expect(src).toContain("Menunggu konfirmasi otomatis gateway atau verifikasi kasir.");
      expect(src).toContain("Tutup");
      expect(src).toContain("onCancelPayment");
    });
  });

  describe("2. Customer page removes unverified client-side settlement mutations and enforces QRIS-only", () => {
    const src = readWorkspaceFile("src/app/(mobile)/customer/page.tsx");

    it("removes handlePaymentSuccess and all client-side paid mutations", () => {
      expect(src).not.toContain("handlePaymentSuccess");
      expect(src).not.toContain("onPaymentSuccess");
      expect(src).not.toContain("confirmBookingPayment");
      expect(src).not.toContain("deductOrderBOM");
      expect(src).not.toContain("occupyTableWithOrder");
      expect(src).not.toContain("redeemPromo");
      expect(src).not.toContain("addPoints");
      expect(src).not.toContain('paymentStatus: "PAID"');
    });

    it("tracks live-polled waiting order/booking IDs with fallback snapshots", () => {
      expect(src).toContain("waitingOrderId");
      expect(src).toContain("waitingOrderSnapshot");
      expect(src).toContain("waitingBookingId");
      expect(src).toContain("waitingBookingSnapshot");
      expect(src).toContain("orders.find((o) => o.id === waitingOrderId) ?? waitingOrderSnapshot");
      expect(src).toContain("bookings.find((b) => b.id === waitingBookingId) ?? waitingBookingSnapshot");
    });

    it("computes qrisOnly via isQrSelfOrderQrisOnly and enforces QRIS across CheckoutSheet, submitOrder, and submitBooking", () => {
      expect(src).toContain('import { isQrSelfOrderQrisOnly } from "@/lib/self-order-policy";');
      expect(src).toContain("const qrisOnly = isQrSelfOrderQrisOnly(settings);");
      expect(src).toContain("qrisOnly={qrisOnly}");
      expect(src).toContain('const effectivePayment = qrisOnly ? "QRIS" : form.payment;');
      expect(src).toContain('const effectivePayment = qrisOnly ? "QRIS" : request.payment;');
    });
  });

  describe("3. Checkout & booking components gate cashier option behind qrisOnly via shared SelfOrderPaymentField", () => {
    it("SelfOrderPaymentField consumes policy helpers and renders QRIS-only card or option group", () => {
      const src = readWorkspaceFile("src/features/customer/SelfOrderPaymentField.tsx");
      expect(src).toContain("getAllowedSelfOrderPayments");
      expect(src).toContain("isQrSelfOrderQrisOnly");
      expect(src).toContain("Pembayaran diproses lewat QRIS. Status lunas diperbarui otomatis setelah verifikasi.");
      expect(src).toContain('cashierLabel = "Di kasir"');
      expect(src).toContain("allowedPayments.map(");
    });

    it("CheckoutSheet accepts qrisOnly (default true), renders SelfOrderPaymentField, and keeps QRIS submit copy", () => {
      const src = readWorkspaceFile("src/features/customer/app/CheckoutSheet.tsx");
      expect(src).toContain('import { SelfOrderPaymentField } from "@/features/customer/SelfOrderPaymentField";');
      expect(src).toContain("qrisOnly?: boolean;");
      expect(src).toContain("const isQrisOnly = props.qrisOnly ?? true;");
      expect(src).toContain("<SelfOrderPaymentField");
      expect(src).toContain("qrisOnly={isQrisOnly}");
      expect(src).toContain('isQrisOnly || form.payment === "QRIS" ? "Bayar dengan QRIS" : "Pesan, bayar di kasir"');
    });

    it("SpaceView gates payment via SelfOrderPaymentField and forces QRIS in onBook when enabled", () => {
      const src = readWorkspaceFile("src/features/customer/app/SpaceView.tsx");
      expect(src).toContain('import { SelfOrderPaymentField } from "@/features/customer/SelfOrderPaymentField";');
      expect(src).toContain('import { isQrSelfOrderQrisOnly } from "@/lib/self-order-policy";');
      expect(src).toContain("const qrisOnly = isQrSelfOrderQrisOnly(settings);");
      expect(src).toContain("<SelfOrderPaymentField");
      expect(src).toContain("qrisOnly={qrisOnly}");
      expect(src).toContain('payment: qrisOnly ? "QRIS" : payment');
    });

    it("CustomerCheckoutSheet reads settings policy and wires SelfOrderPaymentField with Bayar di kasir", () => {
      const src = readWorkspaceFile("src/features/customer/CustomerCheckoutSheet.tsx");
      expect(src).toContain('import { useSettings } from "@/contexts/SettingsContext";');
      expect(src).toContain('import { isQrSelfOrderQrisOnly } from "@/lib/self-order-policy";');
      expect(src).toContain('import { SelfOrderPaymentField } from "./SelfOrderPaymentField";');
      expect(src).toContain("const qrisOnly = isQrSelfOrderQrisOnly(settings);");
      expect(src).toContain('if (qrisOnly && paymentMethod !== "QRIS")');
      expect(src).toContain("<SelfOrderPaymentField");
      expect(src).toContain('cashierLabel="Bayar di kasir"');
    });

    it("CustomerBookingModal reads settings policy before early return and wires SelfOrderPaymentField with Bayar di resepsionis", () => {
      const src = readWorkspaceFile("src/features/customer/CustomerBookingModal.tsx");
      expect(src).toContain('import { isQrSelfOrderQrisOnly } from "@/lib/self-order-policy";');
      expect(src).toContain('import { SelfOrderPaymentField } from "./SelfOrderPaymentField";');
      expect(src).toContain("const qrisOnly = isQrSelfOrderQrisOnly(settings);");
      expect(src).toContain('if (qrisOnly && paymentMethod !== "QRIS")');
      expect(src).toContain("<SelfOrderPaymentField");
      expect(src).toContain('cashierLabel="Bayar di resepsionis"');

      const earlyReturnIdx = src.indexOf("if (!space) return null;");
      const useEffectIdx = src.indexOf("useEffect(");
      expect(earlyReturnIdx).toBeGreaterThan(-1);
      expect(useEffectIdx).toBeGreaterThan(-1);
      expect(useEffectIdx).toBeLessThan(earlyReturnIdx);
    });

    it("matches policy helper behavior for default vs relaxed outlet settings", () => {
      expect(isQrSelfOrderQrisOnly(undefined)).toBe(true);
      expect(getAllowedSelfOrderPayments(undefined)).toEqual(["QRIS"]);
      expect(isQrSelfOrderQrisOnly({ qrSelfOrderQrisOnly: false })).toBe(false);
      expect(getAllowedSelfOrderPayments({ qrSelfOrderQrisOnly: false })).toEqual(["QRIS", "CASHIER"]);
    });
  });

  describe("4. Settings UI exposes qrSelfOrderQrisOnly toggle end-to-end", () => {
    it("PlatformConfigTab renders Switch and Label with exact copy", () => {
      const src = readWorkspaceFile("src/features/settings/PlatformConfigTab.tsx");
      expect(src).toContain('import { Switch } from "@/components/ui/switch";');
      expect(src).toContain("qrSelfOrderQrisOnly: boolean;");
      expect(src).toContain("onQrSelfOrderQrisOnlyChange: (value: boolean) => void;");
      expect(src).toContain("Metode bayar self-order QR");
      expect(src).toContain("Self-order QR hanya QRIS");
      expect(src).toContain(
        "Sembunyikan opsi bayar di kasir di halaman pelanggan (/customer) dan tolak pesanan tunai dari self-order QR."
      );
    });

    it("settings/page.tsx wires qrSelfOrderQrisOnly state, syncs on settings change, passes to PlatformConfigTab, and persists via updateSettings", () => {
      const src = readWorkspaceFile("src/app/(dashboard)/settings/page.tsx");
      expect(src).toContain("useState<boolean>(settings.qrSelfOrderQrisOnly !== false)");
      expect(src).toContain("setQrSelfOrderQrisOnly(settings.qrSelfOrderQrisOnly !== false);");
      expect(src).toContain("qrSelfOrderQrisOnly,");
      expect(src).toContain("qrSelfOrderQrisOnly={qrSelfOrderQrisOnly}");
      expect(src).toContain("onQrSelfOrderQrisOnlyChange={setQrSelfOrderQrisOnly}");
    });
  });
});
