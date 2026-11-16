import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { validateManualShiftOpen } from "@/lib/shift-management";
import type { ShiftRecord } from "@/features/employees/types";

describe("Task V-02: Buka Shift - Cegah Request Ganda & Modal Awal Kosong", () => {
  describe("1. Static Analysis & Code Invariants", () => {
    it("memastikan pos/page.tsx tidak melakukan fetch('/api/shifts') manual ganda di onSubmit", () => {
      const posPagePath = path.resolve(process.cwd(), "src/app/(dashboard)/pos/page.tsx");
      const content = fs.readFileSync(posPagePath, "utf-8");

      // Verify that PosOpenShiftModal onSubmit does NOT contain manual fetch("/api/shifts")
      // because openShift() already handles server sync with outbox atomically
      const openModalSection = content.slice(content.indexOf("<PosOpenShiftModal"));
      expect(
        openModalSection.includes('fetch("/api/shifts"'),
        "Ditemukan fetch('/api/shifts') manual di dalam handler PosOpenShiftModal yang menyebabkan request ganda"
      ).toBe(false);
    });

    it("memastikan nilai default modal awal di pos/page.tsx tidak diset ke 500000", () => {
      const posPagePath = path.resolve(process.cwd(), "src/app/(dashboard)/pos/page.tsx");
      const content = fs.readFileSync(posPagePath, "utf-8");

      // Verify posOpeningCashInput starts empty, not hardcoded 500000
      expect(content).not.toContain("useState<number>(500000)");
      expect(content).not.toContain("setPosOpeningCashInput(500000)");
    });

    it("memastikan PosOpenShiftModal mengunci tombol submit selama request berjalan", () => {
      const modalPath = path.resolve(process.cwd(), "src/features/pos/PosOpenShiftModal.tsx");
      const content = fs.readFileSync(modalPath, "utf-8");

      expect(content).toContain("disabled={isSubmitting}");
      expect(content).toMatch(/disabled=\{\s*isSubmitting\s*\|\|/);
    });

    it("memastikan OpenShiftModal di modul karyawan tidak memiliki default 500000", () => {
      const modalPath = path.resolve(process.cwd(), "src/features/employees/OpenShiftModal.tsx");
      const content = fs.readFileSync(modalPath, "utf-8");

      expect(content).not.toContain("useState<number>(500000)");
    });
  });

  describe("2. Domain Validation: Validasi Wajib Isi Modal Awal", () => {
    it("menolak pembukaan shift jika modal awal tidak valid atau bernilai negatif", () => {
      const resultInvalid = validateManualShiftOpen({
        openingCash: -50000,
        shiftName: "Shift Pagi (08:00 - 16:00)",
        cashierId: "emp-001",
        cashierName: "Kasir Test",
        outletId: "outlet-sgr",
        existingShifts: [],
      });

      expect(resultInvalid.success).toBe(false);
      expect(resultInvalid.error).toBeDefined();
    });

    it("menerima pembukaan shift dengan modal kas awal 0 (misalnya kasir tanpa modal fisik)", () => {
      const resultZero = validateManualShiftOpen({
        openingCash: 0,
        shiftName: "Shift Pagi (08:00 - 16:00)",
        cashierId: "emp-001",
        cashierName: "Kasir Test",
        outletId: "outlet-sgr",
        existingShifts: [],
      });

      expect(resultZero.success).toBe(true);
      expect(resultZero.shift?.openingCash).toBe(0);
      expect(resultZero.shift?.status).toBe("ACTIVE");
    });

    it("menerima pembukaan shift dengan nominal kas yang diisi kasir (mis. Rp 200.000)", () => {
      const resultValid = validateManualShiftOpen({
        openingCash: 200000,
        shiftName: "Shift Sore (14:00 - 22:00)",
        cashierId: "emp-002",
        cashierName: "Kasir Sore",
        outletId: "outlet-sgr",
        existingShifts: [],
      });

      expect(resultValid.success).toBe(true);
      expect(resultValid.shift?.openingCash).toBe(200000);
      expect(resultValid.shift?.status).toBe("ACTIVE");
    });
  });

  describe("3. Concurrency Guard: Satu Klik = Satu Request (Anti 409 Conflict)", () => {
    it("mendeteksi shift yang sedang aktif di outlet dan mencegah pembukaan shift duplikat", () => {
      const activeShift: ShiftRecord = {
        id: "shift-act-001",
        shiftName: "Shift Pagi Aktif",
        assignedCashierId: "emp-001",
        assignedCashierName: "Kasir Aktif",
        outletId: "outlet-sgr",
        startTime: new Date().toISOString(),
        openingCash: 100000,
        expectedCash: 100000,
        cashSales: 0,
        nonCashSales: 0,
        totalSales: 0,
        transactionsCount: 0,
        status: "ACTIVE",
      };

      // Mencoba membuka shift kedua untuk kasir yang sama saat shift pertama masih ACTIVE
      const duplicateAttempt = validateManualShiftOpen({
        openingCash: 150000,
        shiftName: "Shift Pagi Duplikat",
        cashierId: "emp-001",
        cashierName: "Kasir Aktif",
        outletId: "outlet-sgr",
        existingShifts: [activeShift],
      });

      // Server / Domain harus menyatakan isAlreadyOpen dan mengembalikan shift aktif yang ada
      expect(duplicateAttempt.success).toBe(false);
      expect(duplicateAttempt.isAlreadyOpen).toBe(true);
      expect(duplicateAttempt.shift?.id).toBe("shift-act-001");
    });
  });
});
