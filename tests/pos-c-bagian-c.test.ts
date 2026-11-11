import { describe, it, expect } from "vitest";
import { resolveProductModifierGroups } from "@/lib/pos-modifiers";
import fs from "fs";
import path from "path";

describe("POS Bagian C — Perbaikan Menengah", () => {
  describe("C1: Pemetaan grup varian khusus per kategori/produk (POS-13 / TC-B03)", () => {
    it("mencegah opsi level gula dan pilihan susu pada produk croissant / pastry", () => {
      const croissant = {
        id: "prod-104",
        name: "Butter Croissant",
        category: "Camilan",
      };

      const groups = resolveProductModifierGroups(croissant);
      const groupNames = groups.map((g) => g.name);

      expect(groupNames).not.toContain("Level Gula");
      expect(groupNames).not.toContain("Pilihan Susu");
    });

    it("tidak menampilkan opsi susu untuk Classic Americano (TC-B03)", () => {
      const americano = {
        id: "prod-105",
        name: "Classic Americano",
        category: "Minuman",
      };

      const groups = resolveProductModifierGroups(americano);
      const groupNames = groups.map((g) => g.name);

      expect(groupNames).toContain("Level Gula");
      expect(groupNames).not.toContain("Pilihan Susu");
    });

    it("menyediakan opsi level gula dan susu untuk kopi berbasis susu (Kopi Senja Aren)", () => {
      const latte = {
        id: "prod-101",
        name: "Kopi Senja Aren",
        category: "Minuman",
      };

      const groups = resolveProductModifierGroups(latte);
      const groupNames = groups.map((g) => g.name);

      expect(groupNames).toContain("Level Gula");
      expect(groupNames).toContain("Pilihan Susu");
    });

    it("mencegah opsi gula dan susu pada makanan berat (Nasi Beef Bowl)", () => {
      const riceBowl = {
        id: "prod-103",
        name: "Nasi Beef Bowl Sambal Matah",
        category: "Makanan",
      };

      const groups = resolveProductModifierGroups(riceBowl);
      const groupNames = groups.map((g) => g.name);

      expect(groupNames).not.toContain("Level Gula");
      expect(groupNames).not.toContain("Pilihan Susu");
      expect(groupNames).toContain("Level Pedas");
    });
  });

  describe("C2: Hilangkan default selection Meja T-01 (POS-14 / TC-B02)", () => {
    it("memastikan pos/page.tsx tidak auto-select meja pertama saat mount", () => {
      const posPageContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/app/(dashboard)/pos/page.tsx"),
        "utf-8"
      );

      // Verify no auto-assignment of availableTables[0]
      expect(posPageContent).not.toMatch(/setSelectedTable\s*\(\s*availableTables\[0\]/);

      // Verify placeholder option exists (table picker moved to features/pos/CartOrderSetup)
      const orderSetupContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/features/pos/CartOrderSetup.tsx"),
        "utf-8"
      );
      expect(orderSetupContent).toContain('<NativeSelectOption value="">Pilih meja</NativeSelectOption>');
      expect(orderSetupContent).not.toMatch(/onTableChange\s*\(\s*areas/);

      // Verify dine in table validation before opening payment modal
      expect(posPageContent).toContain('orderType === "DINE_IN" && !selectedTable');
    });

    it("memastikan OrderContext tidak memaksa fallback T-01 pada order baru", () => {
      const orderContextContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/contexts/OrderContext.tsx"),
        "utf-8"
      );

      // Verify no silent forcing of T-01
      expect(orderContextContent).not.toContain('tableNumber: newOrderData.tableNumber || "T-01"');
    });
  });

  describe("C3: Kosongkan input nominal bayar tunai (POS-29 / TC-K12)", () => {
    it("memastikan PaymentModal tidak melakukan auto-fill uang pas saat dibuka", () => {
      const paymentModalContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/features/pos/PaymentModal.tsx"),
        "utf-8"
      );

      // Verify cashGiven starts at 0 and input starts empty
      expect(paymentModalContent).toContain("setCashGiven(0)");
      expect(paymentModalContent).toContain('setCashInputRaw("")');
      expect(paymentModalContent).not.toContain("setCashGiven(grandTotal)");
    });
  });

  describe("C4: Sembunyikan password Wi-Fi statis pada struk (POS-30)", () => {
    it("memastikan ReceiptModal dan CoworkingReceiptModal tidak mencetak password statis", () => {
      const receiptModalContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/features/pos/ReceiptModal.tsx"),
        "utf-8"
      );
      const coworkingReceiptContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/features/coworking/CoworkingReceiptModal.tsx"),
        "utf-8"
      );

      expect(receiptModalContent).not.toContain("Pass: smarterfnb2026");
      expect(coworkingReceiptContent).not.toContain("Pass: dagospace2026");
    });
  });

  describe("C5: Lengkapi log Audit Trail untuk aksi void, refund, discount, dan closing shift (POS-15)", () => {
    it("memverifikasi penamaan audit action eksplisit di OrderContext dan EmployeeShiftContext", () => {
      const orderContextContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/contexts/OrderContext.tsx"),
        "utf-8"
      );
      const shiftContextContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/contexts/EmployeeShiftContext.tsx"),
        "utf-8"
      );
      const posPageContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/app/(dashboard)/pos/page.tsx"),
        "utf-8"
      );

      expect(orderContextContent).toContain('action: auditAction');
      expect(orderContextContent).toContain('"REFUND_ORDER"');
      expect(orderContextContent).toContain('"VOID_ORDER"');
      expect(shiftContextContent).toContain('action: "CLOSE_SHIFT"');
      expect(posPageContent).toContain('action: "APPLY_DISCOUNT"');
    });
  });

  describe("C6: Batasi ekspor data nominal Kitchen dan hapus Demo Mode (POS-16, POS-17)", () => {
    it("memastikan tombol Demo Mode telah dibersihkan dari commercial/page.tsx (POS-17 / TC-I07)", () => {
      const commercialContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/app/(dashboard)/commercial/page.tsx"),
        "utf-8"
      );

      expect(commercialContent).not.toContain("Demo Mode");
    });

    it("memastikan tombol ekspor nominal dan angka tagihan diproteksi dari Kitchen Staff (POS-16 / TC-I03)", () => {
      const ordersPageContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/app/(dashboard)/orders/page.tsx"),
        "utf-8"
      );

      expect(ordersPageContent).toContain('const isKitchenStaff = roleSlug === "KITCHEN_STAFF"');
      expect(ordersPageContent).toContain("canExportNominalReports");
      expect(ordersPageContent).toContain("canViewNominals");
      expect(ordersPageContent).toContain('{canViewNominals ? formatCurrencyIDR(selectedOrder.total) : "—"}');
      expect(ordersPageContent).toContain('canViewNominals && (() => {');
    });
  });
});
