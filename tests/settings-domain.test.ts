import { describe, it, expect } from "vitest";
import {
  filterAndSortProducts,
  filterPartners,
  filterWifiVouchers,
  validateRevenueSplit,
  productStatusLabel,
  productStatusTone,
  tableStatusLabel,
  tableStatusTone,
  printJobStatusLabel,
  printJobStatusTone,
  printerRoleLabel,
  printerConnectionLabel,
  wifiVoucherStatusLabel,
  wifiVoucherStatusTone,
  promoStatusLabel,
  promoStatusTone,
  organizerActivationLabel,
  organizerActivationTone,
  spaceStatusLabel,
  spaceStatusTone,
  type UnifiedPartnerRow,
} from "@/features/settings/settings-domain";
import type { MasterProduct } from "@/types/product";
import type { WifiVoucherRecord } from "@/lib/wifi";

describe("settings-domain", () => {
  const mockProducts: MasterProduct[] = [
    {
      id: "prd-1",
      name: "Es Kopi Susu Gula Aren",
      category: "Minuman",
      basePrice: 25000,
      cogsEstimate: 9000,
      grossMarginPercent: "64%",
      status: "ACTIVE",
      outletId: "ALL",
      outletName: "Semua Outlet",
      isAvailable: true,
      tenantId: "tenant-ks",
      createdAt: "2026-11-01T08:00:00Z",
      updatedAt: "2026-11-10T08:00:00Z",
    },
    {
      id: "prd-2",
      name: "Nasi Ayam Sambal Matah",
      category: "Makanan",
      basePrice: 38000,
      cogsEstimate: 15000,
      grossMarginPercent: "60%",
      status: "INACTIVE",
      outletId: "ALL",
      outletName: "Semua Outlet",
      isAvailable: false,
      tenantId: "tenant-kitchen",
      createdAt: "2026-11-02T08:00:00Z",
      updatedAt: "2026-11-11T09:00:00Z",
    },
    {
      id: "prd-3",
      name: "Croissant Mentega",
      category: "Camilan",
      basePrice: 22000,
      cogsEstimate: 8000,
      grossMarginPercent: "63%",
      status: "ACTIVE",
      outletId: "ALL",
      outletName: "Semua Outlet",
      isAvailable: true,
      tenantId: "tenant-bakery",
      createdAt: "2026-11-03T08:00:00Z",
      updatedAt: "2026-11-09T08:00:00Z",
    },
  ];

  describe("filterAndSortProducts", () => {
    it("filters products by tenant, category, status, and search query without mutating input", () => {
      const originalOrder = mockProducts.map((p) => p.id);

      const byTenant = filterAndSortProducts(mockProducts, { tenantId: "tenant-ks" });
      expect(byTenant).toHaveLength(1);
      expect(byTenant[0].id).toBe("prd-1");

      const byStatus = filterAndSortProducts(mockProducts, { status: "INACTIVE" });
      expect(byStatus).toHaveLength(1);
      expect(byStatus[0].id).toBe("prd-2");

      const byQuery = filterAndSortProducts(mockProducts, { searchQuery: "croissant" });
      expect(byQuery).toHaveLength(1);
      expect(byQuery[0].id).toBe("prd-3");

      // Input array must stay untouched
      expect(mockProducts.map((p) => p.id)).toEqual(originalOrder);
    });

    it("sorts products by price ascending, price descending, name, and updated time", () => {
      const priceAsc = filterAndSortProducts(mockProducts, { sortOrder: "PRICE_ASC" });
      expect(priceAsc.map((p) => p.id)).toEqual(["prd-3", "prd-1", "prd-2"]);

      const priceDesc = filterAndSortProducts(mockProducts, { sortOrder: "PRICE_DESC" });
      expect(priceDesc.map((p) => p.id)).toEqual(["prd-2", "prd-1", "prd-3"]);

      const nameAsc = filterAndSortProducts(mockProducts, { sortOrder: "NAME_ASC" });
      expect(nameAsc.map((p) => p.id)).toEqual(["prd-3", "prd-1", "prd-2"]);

      const updatedDesc = filterAndSortProducts(mockProducts, { sortOrder: "UPDATED_DESC" });
      expect(updatedDesc.map((p) => p.id)).toEqual(["prd-2", "prd-1", "prd-3"]);
    });
  });

  describe("filterPartners", () => {
    const partners: UnifiedPartnerRow[] = [
      {
        id: "tenant-ks",
        name: "Kopi Senja",
        type: "FNB",
        categoryOrBadge: "Kopi & Minuman",
        contactPerson: "I Wayan Pratama",
        phone: "081234567890",
        email: "kopisenja@example.com",
        status: "ACTIVE",
        serviceModule: "FNB",
        scopeLevel: "TENANT",
        roleName: "Pemilik mitra",
        permissions: [],
      },
      {
        id: "org-1",
        name: "Singaraja Dev",
        type: "EVENT",
        categoryOrBadge: "Komunitas Teknologi",
        contactPerson: "Fajar",
        phone: "081987654321",
        email: "dev@example.com",
        status: "INACTIVE",
        activationStatus: "PENDING_ACTIVATION",
        serviceModule: "CO_WORKING",
        scopeLevel: "TENANT",
        roleName: "Penyelenggara event",
        permissions: [],
      },
    ];

    it("filters partners by type, status, and search query without mutation", () => {
      expect(filterPartners(partners, { type: "FNB" })).toHaveLength(1);
      expect(filterPartners(partners, { status: "INACTIVE" })).toHaveLength(1);
      expect(filterPartners(partners, { searchQuery: "singaraja" })[0].id).toBe("org-1");
      expect(partners).toHaveLength(2);
    });
  });

  describe("filterWifiVouchers", () => {
    const vouchers: WifiVoucherRecord[] = [
      {
        id: "v-1",
        voucherCode: "DG-FNB-101",
        serviceType: "FNB",
        referenceId: "ORD-001",
        referenceLabel: "Pesanan #ORD-001",
        customerName: "Dewi",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        durationMinutes: 60,
        durationFormatted: "1 jam",
        issuedAt: "2026-11-12T08:00:00Z",
        expiresAt: "2026-11-12T09:00:00Z",
        status: "ACTIVE",
        maxDevices: 1,
        usedDevices: 0,
        isSimulated: true,
      },
      {
        id: "v-2",
        voucherCode: "DG-CW-202",
        serviceType: "COWORKING",
        referenceId: "BKG-002",
        referenceLabel: "Booking Hot Desk",
        customerName: "Rama",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        durationMinutes: 240,
        durationFormatted: "4 jam",
        issuedAt: "2026-11-12T07:00:00Z",
        expiresAt: "2026-11-12T11:00:00Z",
        status: "EXPIRED",
        maxDevices: 2,
        usedDevices: 1,
        isSimulated: true,
      },
    ];

    it("filters vouchers by service type, status, and search query", () => {
      expect(filterWifiVouchers(vouchers, { serviceType: "FNB" })).toHaveLength(1);
      expect(filterWifiVouchers(vouchers, { status: "EXPIRED" })[0].id).toBe("v-2");
      expect(filterWifiVouchers(vouchers, { searchQuery: "dg-cw-202" })[0].id).toBe("v-2");
    });
  });

  describe("validateRevenueSplit", () => {
    it("accepts split percentages summing to 100 within 0-100 range", () => {
      expect(validateRevenueSplit(80, 20)).toBeNull();
      expect(validateRevenueSplit(0, 100)).toBeNull();
    });

    it("rejects out-of-range or mismatched totals", () => {
      expect(validateRevenueSplit(-5, 105)).toBe("Persentase harus antara 0% dan 100%.");
      expect(validateRevenueSplit(70, 20)).toBe("Total pembagian (mitra + Dago) harus 100%.");
    });
  });

  describe("Indonesian status labels and semantic tones", () => {
    it("translates product status enums", () => {
      expect(productStatusLabel("ACTIVE")).toBe("Aktif");
      expect(productStatusLabel("INACTIVE")).toBe("Nonaktif");
      expect(productStatusTone("ACTIVE")).toBe("success");
      expect(productStatusTone("INACTIVE")).toBe("neutral");
    });

    it("translates table status enums", () => {
      expect(tableStatusLabel("AVAILABLE")).toBe("Tersedia");
      expect(tableStatusLabel("OCCUPIED")).toBe("Terisi");
      expect(tableStatusLabel("RESERVED")).toBe("Dipesan");
      expect(tableStatusTone("AVAILABLE")).toBe("success");
      expect(tableStatusTone("OCCUPIED")).toBe("destructive");
      expect(tableStatusTone("RESERVED")).toBe("warning");
    });

    it("translates space status enums", () => {
      expect(spaceStatusLabel("AVAILABLE")).toBe("Tersedia");
      expect(spaceStatusLabel("MAINTENANCE")).toBe("Perbaikan");
      expect(spaceStatusTone("AVAILABLE")).toBe("success");
      expect(spaceStatusTone("MAINTENANCE")).toBe("warning");
    });

    it("translates printer role, connection, and print job status", () => {
      expect(printerRoleLabel("KITCHEN_ORDER")).toBe("Nota dapur");
      expect(printerRoleLabel("CUSTOMER_RECEIPT")).toBe("Struk kasir");
      expect(printerConnectionLabel("BROWSER_SYSTEM")).toBe("Dialog cetak browser");
      expect(printJobStatusLabel("BRIDGE_ACKNOWLEDGED")).toBe("Diterima bridge");
      expect(printJobStatusLabel("SENT_TO_SPOOLER")).toBe("Terkirim ke antrean");
      expect(printJobStatusLabel("PRINTING")).toBe("Mencetak");
      expect(printJobStatusLabel("FAILED")).toBe("Gagal");
      expect(printJobStatusTone("BRIDGE_ACKNOWLEDGED")).toBe("success");
      expect(printJobStatusTone("FAILED")).toBe("destructive");
    });

    it("translates wifi voucher, promo, and organizer activation statuses", () => {
      expect(wifiVoucherStatusLabel("ACTIVE")).toBe("Aktif");
      expect(wifiVoucherStatusLabel("EXPIRED")).toBe("Kedaluwarsa");
      expect(wifiVoucherStatusTone("ACTIVE")).toBe("success");
      expect(promoStatusLabel("QUOTA_EXHAUSTED")).toBe("Kuota habis");
      expect(promoStatusTone("SCHEDULED")).toBe("info");
      expect(organizerActivationLabel("PENDING_ACTIVATION")).toBe("Menunggu aktivasi");
      expect(organizerActivationTone("ACTIVE")).toBe("success");
    });
  });
});
