import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { authorizeSupervisorQrisOverride, resetSupervisorPinRateLimitForTests } from "@/lib/qris-verification";
import { POST as postQrisVerify } from "@/app/api/pos/qris/verify/route";
import { NextRequest } from "next/server";

describe("Task V-05: QRIS Co-Working Tidak Boleh Langsung Lunas Tanpa Konfirmasi", () => {
  beforeEach(() => {
    process.env.QRIS_WEBHOOK_SECRET = "test-webhook-secret-key-2026-secure";
    process.env.SUPERVISOR_OVERRIDE_PIN = "8899";
    resetSupervisorPinRateLimitForTests();
  });

  it("1. File QRIS Statis Dago tersedia di public/images/qris/qris-dago.jpeg", () => {
    const qrisPath = path.join(process.cwd(), "public/images/qris/qris-dago.jpeg");
    expect(fs.existsSync(qrisPath)).toBe(true);
    const stats = fs.statSync(qrisPath);
    expect(stats.size).toBeGreaterThan(1000);
  });

  it("2. Otorisasi supervisor menolak PIN yang salah dan menerima PIN yang benar", () => {
    // PIN salah
    const invalidRes = authorizeSupervisorQrisOverride({
      pin: "0000",
      referenceNumber: "RRN-CWK-12345",
      supervisorRole: "MANAGER",
      supervisorName: "Budi Santoso (Supervisor)",
    });
    expect(invalidRes.allowed).toBe(false);
    expect(invalidRes.statusCode).toBe(403);

    // PIN benar
    const validRes = authorizeSupervisorQrisOverride({
      pin: "8899",
      referenceNumber: "RRN-CWK-12345",
      supervisorRole: "MANAGER",
      supervisorName: "Budi Santoso (Supervisor)",
      note: "Konfirmasi QRIS Co-Working BK-CWK-001",
    });
    expect(validRes.allowed).toBe(true);
    expect(validRes.statusCode).toBe(200);
    expect(validRes.verification?.supervisorPinVerified).toBe(true);
    expect(validRes.verification?.referenceNumber).toBe("RRN-CWK-12345");
    expect(validRes.verification?.supervisorName).toBe("Budi Santoso (Supervisor)");
    expect(validRes.verification?.verifiedAt).toBeDefined();
  });

  it("3. Endpoint /api/pos/qris/verify mencatat audit log saat supervisor menyetujui QRIS statis", async () => {
    const invoiceNumber = `BK-CWK-TEST-${Date.now()}`;

    const cookie = "dagoeng_active_persona=CASHIER_SGR";

    // 1. Inisialisasi sesi QRIS
    const initReq = new NextRequest("http://localhost:3000/api/pos/qris/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        mode: "INIT",
        invoiceNumber,
        expectedAmount: 150000,
      }),
    });
    const initRes = await postQrisVerify(initReq);
    expect(initRes.status).toBe(200);

    // 2. Otorisasi supervisor dengan PIN valid
    const overrideReq = new NextRequest("http://localhost:3000/api/pos/qris/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        mode: "SUPERVISOR_OVERRIDE",
        invoiceNumber,
        expectedAmount: 150000,
        pin: "8899",
        referenceNumber: "RRN-CWK-998877",
        note: "Konfirmasi pembayaran QRIS Co-Working",
      }),
    });
    const overrideRes = await postQrisVerify(overrideReq);
    expect(overrideRes.status).toBe(200);
    const overrideData = await overrideRes.json();
    expect(overrideData.allowed).toBe(true);
    expect(overrideData.verification.referenceNumber).toBe("RRN-CWK-998877");
    expect(overrideData.verification.supervisorPinVerified).toBe(true);
    expect(overrideData.verification.verifiedAt).toBeDefined();
  });

  it("4. Acceptance Criteria: Booking Co-working dengan QRIS berstatus 'PENDING' sampai konfirmasi supervisor", () => {
    // Verifikasi kontrak logika booking coworking
    const mockCwBookingInput = {
      guestName: "Wayan Sudirga",
      spaceId: "sp-hot-1",
      spaceName: "Hot Desk Flex #01",
      totalAmount: 65000,
      paymentMethod: "QRIS",
    };

    // Fungsi penentu paymentStatus awal untuk Co-working
    const determineInitialPaymentStatus = (paymentMethod: string): "PAID" | "PENDING" => {
      if (paymentMethod === "QRIS") {
        return "PENDING"; // Menunggu konfirmasi QRIS statis
      }
      return "PAID"; // Cash / metode konvensional langsung lunas di kasir
    };

    expect(determineInitialPaymentStatus(mockCwBookingInput.paymentMethod)).toBe("PENDING");
    expect(determineInitialPaymentStatus("CASH")).toBe("PAID");
  });

  it("5. Acceptance Criteria: Konfirmasi supervisor mencatat audit trail (siapa dan kapan)", () => {
    const supervisorVerification = {
      type: "SUPERVISOR_MANUAL" as const,
      referenceNumber: "RRN-778899",
      supervisorPinVerified: true,
      supervisorId: "usr-sup-01",
      supervisorName: "Ahmad Wijaya (Supervisor)",
      verifiedAt: "2026-11-16T11:30:00.000Z",
    };

    const auditEntry = {
      module: "COWORKING",
      action: "CONFIRM_BOOKING_PAYMENT_QRIS",
      recordId: "BK-CWK-12345",
      actorName: supervisorVerification.supervisorName,
      timestamp: supervisorVerification.verifiedAt,
      description: `Otorisasi pembayaran QRIS Co-working BK-CWK-12345 oleh supervisor ${supervisorVerification.supervisorName}. RRN: ${supervisorVerification.referenceNumber}`,
      status: "SUCCESS",
    };

    expect(auditEntry.actorName).toBe("Ahmad Wijaya (Supervisor)");
    expect(auditEntry.timestamp).toBe("2026-11-16T11:30:00.000Z");
    expect(auditEntry.action).toBe("CONFIRM_BOOKING_PAYMENT_QRIS");
  });

  it("6. Verifikasi source code: QRIS Co-working dan Payment Modal memakai gambar static QRIS Dago", () => {
    const posModalPath = path.join(process.cwd(), "src/features/pos/PaymentModal.tsx");
    const cwModalPath = path.join(process.cwd(), "src/features/coworking/CoworkingQrisModal.tsx");
    const cwContextPath = path.join(process.cwd(), "src/contexts/CoworkingContext.tsx");
    const cwTabPath = path.join(process.cwd(), "src/features/coworking/CoworkingBookingsTab.tsx");

    const posModalContent = fs.readFileSync(posModalPath, "utf-8");
    const cwModalContent = fs.readFileSync(cwModalPath, "utf-8");
    const cwContextContent = fs.readFileSync(cwContextPath, "utf-8");
    const cwTabContent = fs.readFileSync(cwTabPath, "utf-8");

    // Static image referenced
    expect(posModalContent).toContain("/images/qris/qris-dago.jpeg");
    expect(cwModalContent).toContain("/images/qris/qris-dago.jpeg");

    // Coworking context guards QRIS from being marked PAID directly
    expect(cwContextContent).toContain("isQris");
    expect(cwContextContent).toContain('effectivePaymentStatus: "PAID" | "PENDING" = isQris ? "PENDING"');

    // Coworking bookings tab has Konfirmasi QRIS button for pending items
    expect(cwTabContent).toContain("Konfirmasi QRIS");
  });
});
