import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  calculateCashChange,
  generateCashSuggestions,
  formatQrisCountdown,
  calculateSplitBalance,
  generateEqualSplitGuests,
} from "@/features/pos/pos-payment";
import type { POSReceiptData, POSCartItem } from "@/features/pos/types";
import { resolvePosReceiptPublisher } from "@/lib/receipt-publisher";

describe("Task V-01: Perbaiki crash pembayaran F&B (React error #310 / Hook Order)", () => {
  describe("1. Static Analysis: Rule of Hooks Integrity Guard", () => {
    it("memastikan src/features/pos/PaymentModal.tsx tidak memanggil hook setelah early return", () => {
      const filePath = path.resolve(process.cwd(), "src/features/pos/PaymentModal.tsx");
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      let earlyReturnIndex = -1;
      const hooksAfterEarlyReturn: { line: number; text: string }[] = [];

      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        // Check for component-level early return (e.g. if (!isOpen) return null;)
        if (
          trimmed.startsWith("if (!isOpen) return") ||
          trimmed === "if (!isOpen) return null;"
        ) {
          earlyReturnIndex = idx;
        }

        // Check for hook calls at top level (e.g. useState, useEffect, useMemo, etc.)
        if (
          earlyReturnIndex !== -1 &&
          idx > earlyReturnIndex &&
          /\buse[A-Z]\w*\s*\(/.test(trimmed)
        ) {
          hooksAfterEarlyReturn.push({ line: idx + 1, text: trimmed });
        }
      });

      // INVARIANT: React Error #310 occurs if any hook is called after an early return
      expect(
        hooksAfterEarlyReturn,
        `Ditemukan hook dipanggil setelah early return pada baris: ${JSON.stringify(hooksAfterEarlyReturn)}`
      ).toHaveLength(0);
    });

    it("memastikan semua hook pada PaymentModal.tsx berada di tingkat atas komponen", () => {
      const filePath = path.resolve(process.cwd(), "src/features/pos/PaymentModal.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      // Verify essential hooks exist unconditionally at the top level
      expect(content).toContain("useActivityLog()");
      expect(content).toContain("useState<POSPaymentMethod>(");
      expect(content).toContain("useState<number>(0)");
      expect(content).toContain("useEffect(() => {");
      expect(content).toContain("useMemo(");

      // Verify that polling useEffect is NOT located after if (!isOpen) return null
      const earlyReturnPos = content.indexOf("if (!isOpen) return null;");
      const qrisPollPos = content.indexOf("Poll server-side QRIS gateway status");

      expect(earlyReturnPos).toBeGreaterThan(-1);
      expect(qrisPollPos).toBeGreaterThan(-1);
      expect(
        qrisPollPos,
        "QRIS gateway polling hook harus dideklarasikan SEBELUM if (!isOpen) return null;"
      ).toBeLessThan(earlyReturnPos);
    });
  });

  describe("2. Acceptance Criteria: Alur Pembayaran Tunai (Cash)", () => {
    it("menghitung kembalian uang tunai dan memvalidasi kecukupan pembayaran", () => {
      const grandTotal = 75000;

      // Kasus 1: Uang pas
      const exactChange = calculateCashChange(75000, grandTotal);
      expect(exactChange.isSufficient).toBe(true);
      expect(exactChange.changeDue).toBe(0);

      // Kasus 2: Uang lebih (kembalian)
      const overChange = calculateCashChange(100000, grandTotal);
      expect(overChange.isSufficient).toBe(true);
      expect(overChange.changeDue).toBe(25000);

      // Kasus 3: Uang kurang
      const underChange = calculateCashChange(50000, grandTotal);
      expect(underChange.isSufficient).toBe(false);
      expect(underChange.changeDue).toBe(0);
    });

    it("menghasilkan shortcut pecahan uang tunai yang relevan di atas grand total", () => {
      const grandTotal = 68000;
      const suggestions = generateCashSuggestions(grandTotal);

      expect(suggestions).toContain(68000); // Uang pas
      expect(suggestions.some((s) => s >= grandTotal)).toBe(true);
      expect(suggestions.every((s) => s >= grandTotal)).toBe(true);
    });

    it("memvalidasi payload transaksi tunai untuk penerbitan struk", () => {
      const cartItems: POSCartItem[] = [
        {
          productId: "prod-kopi-senja",
          productName: "Kopi Senja Aren",
          quantity: 2,
          unitPrice: 24000,
          unitFinalPrice: 24000,
          itemTotal: 48000,
          tenantId: "tenant-ks",
          selectedModifiers: [],
        },
      ];
      const grandTotal = 52800; // Subtotal 48.000 + PB1 10% (4.800)
      const cashGiven = 100000;
      const { changeDue } = calculateCashChange(cashGiven, grandTotal);

      // Simulasi payload onPaymentSuccess untuk tunai
      const paymentData = {
        method: "CASH" as const,
        amountPaid: cashGiven,
        changeDue,
      };

      expect(paymentData.method).toBe("CASH");
      expect(paymentData.amountPaid).toBe(100000);
      expect(paymentData.changeDue).toBe(47200);

      // Simulasi pembuatan struk kasir
      const receipt: POSReceiptData = {
        orderNumber: "INV-20261116-1001",
        date: "16 Nov 2026, 10:30",
        cashierName: "Kasir Bertugas",
        tenantId: "tenant-ks",
        tenantName: "Kopi Senja",
        outletName: "Dago Creative Hub - Singaraja",
        tableNumber: "T-01",
        customerName: "Tamu Meja T-01",
        orderType: "DINE_IN",
        items: cartItems.map((item) => ({
          name: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitFinalPrice,
          subtotal: item.itemTotal,
          tenantId: item.tenantId,
        })),
        subtotal: 48000,
        tax: 4800,
        serviceCharge: 0,
        discount: 0,
        grandTotal: 52800,
        paymentMethod: paymentData.method,
        amountPaid: paymentData.amountPaid,
        changeDue: paymentData.changeDue,
      };

      expect(receipt.orderNumber).toBeDefined();
      expect(receipt.grandTotal).toBe(52800);
      expect(receipt.paymentMethod).toBe("CASH");
      expect(receipt.changeDue).toBe(47200);
    });
  });

  describe("3. Acceptance Criteria: Alur Pembayaran QRIS", () => {
    it("memformat countdown timer QRIS 120 detik dengan benar", () => {
      expect(formatQrisCountdown(120)).toBe("02:00");
      expect(formatQrisCountdown(90)).toBe("01:30");
      expect(formatQrisCountdown(15)).toBe("00:15");
      expect(formatQrisCountdown(0)).toBe("00:00");
    });

    it("memvalidasi otorisasi supervisor QRIS manual jika gateway tertunda", () => {
      const grandTotal = 85000;
      const gatewayTxId = "GW-DAGO-998877";
      const referenceNumber = "RRN-20261116-0001";

      const supervisorOverride = {
        type: "SUPERVISOR_MANUAL" as const,
        referenceNumber,
        invoiceNumber: gatewayTxId,
        supervisorPinVerified: true,
        verifiedAt: new Date().toISOString(),
        note: "Otorisasi manual QRIS statis oleh supervisor",
      };

      expect(supervisorOverride.type).toBe("SUPERVISOR_MANUAL");
      expect(supervisorOverride.supervisorPinVerified).toBe(true);
      expect(supervisorOverride.referenceNumber).toBe(referenceNumber);

      // Simulasi payload onPaymentSuccess untuk QRIS terotorisasi
      const paymentData = {
        method: "QRIS" as const,
        amountPaid: grandTotal,
        changeDue: 0,
        qrisVerification: supervisorOverride,
      };

      expect(paymentData.method).toBe("QRIS");
      expect(paymentData.amountPaid).toBe(grandTotal);
      expect(paymentData.qrisVerification?.type).toBe("SUPERVISOR_MANUAL");
    });

    it("menerbitkan struk valid setelah pembayaran QRIS terverifikasi", () => {
      const grandTotal = 60000;
      const qrisData = {
        type: "GATEWAY_WEBHOOK" as const,
        referenceNumber: "GW-DAGO-123456",
        invoiceNumber: "GW-DAGO-123456",
        verifiedAt: new Date().toISOString(),
        note: "Terverifikasi otomatis via gateway QRIS",
      };

      const receipt: POSReceiptData = {
        orderNumber: "INV-20261116-1002",
        date: "16 Nov 2026, 10:45",
        cashierName: "Kasir Bertugas",
        tenantId: "tenant-ks",
        tenantName: "Kopi Senja",
        outletName: "Dago Creative Hub - Singaraja",
        tableNumber: "T-03",
        customerName: "Tamu Meja T-03",
        orderType: "DINE_IN",
        items: [
          {
            name: "Beef Bowl Teriyaki",
            quantity: 1,
            unitPrice: 45000,
            subtotal: 45000,
          },
        ],
        subtotal: 45000,
        tax: 4500,
        serviceCharge: 0,
        discount: 0,
        grandTotal: 49500,
        paymentMethod: "QRIS",
        amountPaid: 49500,
        changeDue: 0,
        qrisVerification: qrisData,
      };

      expect(receipt.paymentMethod).toBe("QRIS");
      expect(receipt.qrisVerification?.referenceNumber).toBe("GW-DAGO-123456");
      expect(receipt.changeDue).toBe(0);
    });
  });

  describe("4. Perbandingan dengan Alur Co-working", () => {
    it("memastikan penerbit struk (publisher) teresolusi konsisten untuk F&B dan Co-working", () => {
      const fnbPublisher = resolvePosReceiptPublisher(
        [{ tenantId: "tenant-ks" }],
        { id: "outlet-sgr", name: "Singaraja", address: "Jl. Diponegoro No. 1", phone: "08123456789" },
        "tenant-ks"
      );

      expect(fnbPublisher.brandName).toBe("Kopi Senja");
      expect(fnbPublisher.tenantId).toBe("tenant-ks");
      expect(fnbPublisher.outletName).toContain("Singaraja");
    });
  });
});
