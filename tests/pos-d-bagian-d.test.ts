import { describe, it, expect } from "vitest";
import { isTenantAcceptingOrders, TenantOperationConfig } from "@/lib/operating-hours";
import { ACTIVE_OUTLETS, DEMO_OUTLETS } from "@/lib/receipt-publisher";
import fs from "fs";
import path from "path";

describe("POS Bagian D — Perbaikan Minor UI/UX", () => {
  describe("D1: Ganti checkbox varian level gula menjadi radio button (POS-12)", () => {
    it("memastikan ModifierModal menggunakan role radio dan radiogroup untuk single select", () => {
      const modalContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/features/pos/ModifierModal.tsx"),
        "utf-8"
      );

      // Verify radio semantics for single select modifier groups
      expect(modalContent).toContain('role={group.maxSelect === 1 ? "radiogroup" : "group"}');
      expect(modalContent).toContain('role={group.maxSelect === 1 ? "radio" : "checkbox"}');
      expect(modalContent).toContain('group.maxSelect === 1 ? "rounded-full" : "rounded"');
    });
  });

  describe("D2: Fallback image untuk gambar produk yang rusak (POS-18 / TC-J02)", () => {
    it("memastikan kartu produk POS memiliki onError fallback placeholder", () => {
      // The product tile moved from pos/page.tsx to features/pos/ProductCard.tsx
      const productCardContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/features/pos/ProductCard.tsx"),
        "utf-8"
      );

      expect(productCardContent).toContain("onError={(e) => {");
      expect(productCardContent).toContain("setImageFailed(true)");
      // Images that failed before hydration are caught on mount as well
      expect(productCardContent).toContain("node.naturalWidth === 0");
      expect(productCardContent).toContain(
        'className="product-fallback-placeholder flex size-full items-center justify-center text-muted-foreground"'
      );
    });

    it("memastikan settings/page.tsx memiliki onError fallback placeholder pada tabel menu", () => {
      // The product catalog table was extracted to features/settings/ProductsCatalogTab.tsx
      const settingsContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/features/settings/ProductsCatalogTab.tsx"),
        "utf-8"
      );

      expect(settingsContent).toContain("settings-fallback-placeholder");
      expect(settingsContent).toContain("onError={(e) => {");
      expect(settingsContent).toContain(
        'className="settings-fallback-placeholder hidden flex w-full h-full items-center justify-center text-slate-400"'
      );
    });
  });

  describe("D3: Perbaiki pemotongan nama profil pengguna pada dashboard (POS-19 / TC-J03)", () => {
    it("memastikan dashboard menampilkan nama lengkap pengguna tanpa split string", () => {
      const dashboardContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/app/(dashboard)/dashboard/page.tsx"),
        "utf-8"
      );

      // The greeting was replaced by a context title (docs/UNSLOP_AUDIT.md); the name must never be truncated
      expect(dashboardContent).not.toContain('{user?.name.split(" ")[0]}');
      expect(dashboardContent).not.toMatch(/name\??\.split\(/);
      expect(dashboardContent).toContain('title="Ringkasan"');
    });
  });

  describe("D4: Bersihkan data dummy outlet Denpasar/Ubud (POS-20 / TC-J04)", () => {
    it("memastikan ACTIVE_OUTLETS hanya berisi outlet yang aktif beroperasi (Singaraja)", () => {
      expect(ACTIVE_OUTLETS.length).toBe(1);
      expect(ACTIVE_OUTLETS[0].id).toBe("outlet-sgr");
      expect(ACTIVE_OUTLETS[0].status).toBe("ACTIVE");
      expect(ACTIVE_OUTLETS[0].name).toContain("Singaraja");

      // Verify non-active coming soon outlets are excluded from active list
      const activeIds = ACTIVE_OUTLETS.map((o) => o.id);
      expect(activeIds).not.toContain("outlet-dps");
      expect(activeIds).not.toContain("outlet-ubd");
    });

    it("memastikan OutletContext menyediakan daftar outlet aktif tanpa dummy outlet", () => {
      const outletContextContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/contexts/OutletContext.tsx"),
        "utf-8"
      );

      expect(outletContextContent).toContain("outlets: ACTIVE_OUTLETS");
    });

    it("memastikan OutletCompareCard hanya memonitor cabang fisik yang aktif", () => {
      const compareCardContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/features/dashboard/OutletCompareCard.tsx"),
        "utf-8"
      );

      expect(compareCardContent).toContain('{ id: "outlet-sgr", name: "Singaraja (Pusat)", code: "KS-SGR" }');
      expect(compareCardContent).not.toContain('{ id: "outlet-dps"');
      expect(compareCardContent).not.toContain('{ id: "outlet-ubd"');
    });
  });

  describe("D5: Tampilkan alasan dan perkiraan waktu untuk status Tutup Sementara (POS-24, POS-31 / TC-J01)", () => {
    it("mengembalikan alasan dan estimasi jam buka kembali saat open order dinonaktifkan", () => {
      const mockOperations: Record<string, TenantOperationConfig> = {
        "tenant-ks": {
          isOpenOrder: false,
          openTime: "08:00",
          closeTime: "22:00",
          notes: "Persiapan bahan dan kalibrasi mesin kopi",
          estimatedReopenTime: "Buka kembali pk 13:00 WITA",
        },
      };

      const status = isTenantAcceptingOrders("tenant-ks", mockOperations);
      expect(status.isOpen).toBe(false);
      expect(status.reason).toContain("Persiapan bahan");
      expect(status.estimatedReopenTime).toBe("Buka kembali pk 13:00 WITA");
    });

    it("mengembalikan alasan dan estimasi jam buka kembali saat di luar jam operasional", () => {
      const mockOperations: Record<string, TenantOperationConfig> = {
        "tenant-ks": {
          isOpenOrder: true,
          openTime: "08:00",
          closeTime: "22:00",
        },
      };

      // 03:00 AM WITA (outside hours)
      const outsideDate = new Date();
      outsideDate.setHours(3, 0, 0, 0);

      const status = isTenantAcceptingOrders("tenant-ks", mockOperations, outsideDate);
      expect(status.isOpen).toBe(false);
      expect(status.reason).toContain("di luar jam operasional");
      expect(status.estimatedReopenTime).toContain("pk 08:00 WITA");
    });

    it("memastikan kartu produk POS menyertakan alasan dan estimasi buka saat Tutup Sementara", () => {
      // Message formatting is covered behaviourally in tests/pos-catalog.test.ts
      const productCardContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/features/pos/ProductCard.tsx"),
        "utf-8"
      );
      const catalogContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/features/pos/pos-catalog.ts"),
        "utf-8"
      );

      expect(productCardContent).toContain("tenantClosedMessage(tenant)");
      expect(catalogContent).toContain("tenant.reason");
      expect(catalogContent).toContain("tenant.estimatedReopenTime");
    });
  });

  describe("D6: Perbaiki penomoran status antrean KDS (POS-40 / TC-F02)", () => {
    it("memastikan KDS mengurutkan tiket secara kronologis FIFO dan menampilkan nomor antrean eksplisit", () => {
      const kitchenPageContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/app/(dashboard)/kitchen/page.tsx"),
        "utf-8"
      );

      // The board logic moved to features/kitchen (FIFO order is covered in tests/kitchen-board.test.ts);
      // the page must still feed it and number tickets per column from 1.
      expect(kitchenPageContent).toContain("filterKitchenOrders(");
      expect(kitchenPageContent).toContain("const queueNumber = ticketIdx + 1;");

      const boardContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/features/kitchen/kitchen-board.ts"),
        "utf-8"
      );
      expect(boardContent).toMatch(
        /\.sort\s*\(\s*\(a,\s*b\)\s*=>\s*new Date\(a\.createdAt\)\.getTime\(\)\s*-\s*new Date\(b\.createdAt\)\.getTime\(\)\s*\)/
      );
      expect(boardContent).toContain("sequenceNumber: queueNumber");

      const cardContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/features/kitchen/KitchenTicketCard.tsx"),
        "utf-8"
      );
      expect(cardContent).toContain("#{queueNumber}");
    });
  });
});
