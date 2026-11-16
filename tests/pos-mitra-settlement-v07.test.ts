import { describe, it, expect } from "vitest";
import {
  calculateSettlement,
  resolveItemTenantId,
  calculateTenantProfitSharing,
} from "@/lib/settlement";
import { buildReportData } from "@/features/reports/reports-domain";
import { OrderRecord } from "@/types/order";

describe("POS V-07: Settlement Mitra - Pemetaan Item & Bagi Hasil Sebelum Pajak", () => {
  const createMockOrder = (params: {
    id: string;
    items: {
      tenantId?: string;
      productId?: string;
      productName: string;
      qty: number;
      price: number;
    }[];
    discount?: number;
    tax?: number;
    serviceCharge?: number;
    paymentStatus?: "PAID" | "PENDING" | "REFUNDED";
    orderFallbackTenantId?: string;
  }): OrderRecord => {
    const subtotal = params.items.reduce((sum, item) => sum + item.qty * item.price, 0);
    const discount = params.discount || 0;
    const tax = params.tax || 0;
    const serviceCharge = params.serviceCharge || 0;

    return {
      id: params.id,
      orderNumber: `ORD-${params.id}`,
      organizationId: "org-1",
      outletId: "outlet-sgr",
      outletName: "Singaraja",
      tableNumber: "T-01",
      customerName: "Pelanggan Uji",
      orderType: "DINE_IN",
      status: "COMPLETED",
      paymentStatus: params.paymentStatus || "PAID",
      paymentMethod: "QRIS",
      tenantId: params.orderFallbackTenantId,
      subtotal,
      discount,
      tax,
      serviceCharge,
      total: subtotal - discount + tax + serviceCharge,
      targetServiceMinutes: 10,
      createdAt: "2026-11-16T10:00:00.000Z",
      statusHistory: [],
      items: params.items.map((i, idx) => ({
        id: `it-${params.id}-${idx}`,
        productId: i.productId,
        productName: i.productName,
        tenantId: i.tenantId,
        quantity: i.qty,
        unitPrice: i.price,
      })),
    };
  };

  describe("1. Resolusi Tenant Pemilik Item (resolveItemTenantId)", () => {
    it("menggunakan tenantId langsung bila sudah tersedia", () => {
      const tenant = resolveItemTenantId({
        tenantId: "tenant-kitchen",
        productName: "Nasi Ayam",
      });
      expect(tenant).toBe("tenant-kitchen");
    });

    it("memetakan ke tenant berdasarkan productId master saat tenantId kosong", () => {
      const tenant = resolveItemTenantId({
        productId: "prod-101", // Kopi Senja Aren di master data
        productName: "Produk Custom",
      });
      expect(tenant).toBe("tenant-ks");
    });

    it("memetakan ke tenant berdasarkan nama produk persis saat tenantId kosong", () => {
      const tenant = resolveItemTenantId({
        productName: "Kopi Senja Aren",
      });
      expect(tenant).toBe("tenant-ks");
    });

    it("memetakan nama produk demo singkat 'Beef Bowl' ke tenant-kitchen", () => {
      const tenant = resolveItemTenantId({
        productName: "Beef Bowl",
      });
      expect(tenant).toBe("tenant-kitchen");
    });

    it("memetakan kata kunci bakery ke tenant-bakery", () => {
      const tenant = resolveItemTenantId({
        productName: "Butter Croissant Prancis",
      });
      expect(tenant).toBe("tenant-bakery");
    });

    it("memetakan kata kunci teh / warung ke tenant-tea", () => {
      const tenant = resolveItemTenantId({
        productName: "Teh Tarik Rempah",
      });
      expect(tenant).toBe("tenant-tea");
    });

    it("menggunakan fallback tenant pesanan jika item tidak cocok dengan master", () => {
      const tenant = resolveItemTenantId(
        { productName: "Barang Merchandise Khusus" },
        "tenant-bakery"
      );
      expect(tenant).toBe("tenant-bakery");
    });

    it("jatuh ke DAGO_HUB jika item benar-benar tidak terpetakan", () => {
      const tenant = resolveItemTenantId({ productName: "Sewa Ruang Rapat Jam-jaman" });
      expect(tenant).toBe("DAGO_HUB");
    });
  });

  describe("2. Transaksi Campuran 2 Mitra Menghasilkan 2 Baris Settlement", () => {
    it("memecah order demo multi-mitra tanpa tenantId menjadi baris Kopi Senja dan Dapur Mama", () => {
      // Meniru pesanan ORD-DEMO-3 dari demo order historis
      const demoOrder = createMockOrder({
        id: "demo-3",
        items: [
          { productName: "Kopi Senja Aren", qty: 2, price: 24000 }, // 48.000 -> KS
          { productName: "Beef Bowl", qty: 1, price: 45000 },       // 45.000 -> Kitchen
        ],
        tax: 9300, // 10% PB1
      });

      const settlements = calculateSettlement([demoOrder]);
      expect(settlements).toHaveLength(2);

      const ks = settlements.find((s) => s.tenantId === "tenant-ks");
      const kitchen = settlements.find((s) => s.tenantId === "tenant-kitchen");

      expect(ks).toBeDefined();
      expect(kitchen).toBeDefined();

      // Kopi Senja: Gross 48.000, DPP 48.000, 85/15 split
      expect(ks?.grossRevenue).toBe(48000);
      expect(ks?.discount).toBe(0);
      expect(ks?.dpp).toBe(48000);
      expect(ks?.tenantSharePercent).toBe(85);
      expect(ks?.dagoSharePercent).toBe(15);
      expect(ks?.tenantShareAmount).toBe(40800);
      expect(ks?.dagoShareAmount).toBe(7200);
      expect((ks?.tenantShareAmount || 0) + (ks?.dagoShareAmount || 0)).toBe(48000);

      // Dapur Mama: Gross 45.000, DPP 45.000, 85/15 split
      expect(kitchen?.grossRevenue).toBe(45000);
      expect(kitchen?.discount).toBe(0);
      expect(kitchen?.dpp).toBe(45000);
      expect(kitchen?.tenantSharePercent).toBe(85);
      expect(kitchen?.dagoSharePercent).toBe(15);
      expect(kitchen?.tenantShareAmount).toBe(38250);
      expect(kitchen?.dagoShareAmount).toBe(6750);
      expect((kitchen?.tenantShareAmount || 0) + (kitchen?.dagoShareAmount || 0)).toBe(45000);

      // Tidak ada baris DAGO_HUB
      expect(settlements.find((s) => s.tenantId === "DAGO_HUB")).toBeUndefined();
    });

    it("menghitung bagi hasil dari DPP setelah alokasi diskon prorata", () => {
      // Subtotal 100.000, Diskon 20.000 -> Total DPP = 80.000
      // KS: 60.000 (60%) -> Diskon 12.000 -> DPP 48.000
      // Kitchen: 40.000 (40%) -> Diskon 8.000 -> DPP 32.000
      const orderWithDiscount = createMockOrder({
        id: "multi-disc",
        items: [
          { tenantId: "tenant-ks", productName: "Kopi Senja Aren", qty: 3, price: 20000 },
          { tenantId: "tenant-kitchen", productName: "Nasi Beef Bowl", qty: 1, price: 40000 },
        ],
        discount: 20000,
        tax: 8000,
        serviceCharge: 4000,
      });

      const settlements = calculateSettlement([orderWithDiscount]);
      const ks = settlements.find((s) => s.tenantId === "tenant-ks");
      const kitchen = settlements.find((s) => s.tenantId === "tenant-kitchen");

      expect(ks?.grossRevenue).toBe(60000);
      expect(ks?.discount).toBe(12000);
      expect(ks?.dpp).toBe(48000);
      // 85% dari 48.000 = 40.800
      expect(ks?.tenantShareAmount).toBe(40800);
      expect(ks?.dagoShareAmount).toBe(7200);

      expect(kitchen?.grossRevenue).toBe(40000);
      expect(kitchen?.discount).toBe(8000);
      expect(kitchen?.dpp).toBe(32000);
      // 85% dari 32.000 = 27.200
      expect(kitchen?.tenantShareAmount).toBe(27200);
      expect(kitchen?.dagoShareAmount).toBe(4800);

      // Bagian mitra + bagian Dago identik dengan DPP masing-masing
      expect((ks?.tenantShareAmount || 0) + (ks?.dagoShareAmount || 0)).toBe(48000);
      expect((kitchen?.tenantShareAmount || 0) + (kitchen?.dagoShareAmount || 0)).toBe(32000);
    });
  });

  describe("3. Konfigurasi Persentase Bagi Hasil (85/15 vs 70/30)", () => {
    it("menghormati custom split 70% Mitra / 30% DAGO dari DPP", () => {
      const order = createMockOrder({
        id: "custom-split-1",
        items: [
          { tenantId: "tenant-ks", productName: "Kopi Senja Aren", qty: 2, price: 50000 }, // 100.000
        ],
        discount: 10000, // DPP = 90.000
        tax: 9000,
      });

      const customSplits = {
        "tenant-ks": { tenantSharePercent: 70, dagoSharePercent: 30 },
      };

      const settlements = calculateSettlement([order], undefined, customSplits);
      expect(settlements).toHaveLength(1);
      const ks = settlements[0];

      expect(ks.grossRevenue).toBe(100000);
      expect(ks.discount).toBe(10000);
      expect(ks.dpp).toBe(90000);
      expect(ks.tenantSharePercent).toBe(70);
      expect(ks.dagoSharePercent).toBe(30);

      // 70% dari 90.000 = 63.000
      expect(ks.tenantShareAmount).toBe(63000);
      // 30% dari 90.000 = 27.000
      expect(ks.dagoShareAmount).toBe(27000);
      expect((ks.tenantShareAmount || 0) + (ks.dagoShareAmount || 0)).toBe(90000);
    });
  });

  describe("4. Integritas Laporan Settlement (reports-domain)", () => {
    it("kolom Bersih (Rp) sama dengan DPP dan tidak pernah lebih besar dari Kotor (Rp)", () => {
      // Order dengan PB1 10% dan Service Charge 5%
      const taxedOrder = createMockOrder({
        id: "taxed-1",
        items: [
          { tenantId: "tenant-ks", productName: "Kopi Senja Aren", qty: 2, price: 50000 }, // Gross: 100.000
        ],
        discount: 10000, // DPP: 90.000
        tax: 9000,       // PB1: 9.000
        serviceCharge: 4500, // Service: 4.500
        // Grand Total dibayar tamu = 103.500
      });

      const report = buildReportData({
        type: "SETTLEMENT",
        scopeName: "Outlet Singaraja",
        orders: [taxedOrder],
        products: [],
        shifts: [],
        ingredients: [],
        logs: [],
      });

      expect(report.tableRows).toHaveLength(1);
      const row = report.tableRows[0];

      // Kolom 5 = Kotor (Rp), Kolom 6 = Bagian Mitra, Kolom 7 = Bagian DAGO, Kolom 8 = Bersih (Rp)
      expect(row[5]).toBe("Rp 100.000"); // Kotor
      expect(row[6]).toBe("Rp 76.500");  // 85% dari 90.000 DPP
      expect(row[7]).toBe("Rp 13.500");  // 15% dari 90.000 DPP
      expect(row[8]).toBe("Rp 90.000");   // Bersih (DPP, bukan 103.500!)

      // Bersih (90.000) <= Kotor (100.000)
      const kotorNum = 100000;
      const bersihNum = 90000;
      expect(bersihNum).toBeLessThanOrEqual(kotorNum);

      // Bagian mitra + Bagian DAGO = Bersih
      expect(76500 + 13500).toBe(bersihNum);

      // Kartu ringkasan settlement bersih
      const netSummaryCard = report.summaryCards.find((c) => c.label === "Settlement bersih");
      expect(netSummaryCard?.value).toBe("Rp 90.000");
    });

    it("calculateTenantProfitSharing menghitung item tanpa tenantId secara benar lewat resolusi", () => {
      const demoOrder = createMockOrder({
        id: "profit-demo",
        items: [
          { productName: "Kopi Senja Aren", qty: 2, price: 25000 }, // 50.000
        ],
      });

      const profitShare = calculateTenantProfitSharing(
        [demoOrder],
        "tenant-ks",
        "Kopi Senja"
      );

      expect(profitShare.orderCount).toBe(1);
      expect(profitShare.grossSales).toBe(50000);
      expect(profitShare.platformFee).toBe(7500); // 15% DAGO
    });
  });
});
