import { describe, it, expect } from "vitest";
import {
  MASTER_HQ_OUTLET,
  DEMO_OUTLETS,
  resolveCoworkingReceiptPublisher,
  resolvePosReceiptPublisher,
} from "@/lib/receipt-publisher";
import { DEMO_OUTLETS as CONTEXT_OUTLETS } from "@/contexts/OutletContext";

describe("Task A6: Dynamic Receipt Publisher & Location Consistency (POS-03)", () => {
  describe("Master Data Lokasi (A6-1)", () => {
    it("uses single shared master location Jl. Ngurah Rai No. 45, Singaraja, Bali across OutletContext and receipt-publisher", () => {
      expect(MASTER_HQ_OUTLET.address).toBe("Jl. Ngurah Rai No. 45, Singaraja, Bali");
      expect(MASTER_HQ_OUTLET.name).toContain("Singaraja");
      expect(CONTEXT_OUTLETS[0].address).toBe(MASTER_HQ_OUTLET.address);
      expect(DEMO_OUTLETS).toBe(CONTEXT_OUTLETS);
    });
  });

  describe("Co-working Receipt Publisher (POS-03)", () => {
    it("dynamically publishes co-working receipts under Dago Creative Hub, never Kopi Senja", () => {
      const activeOutlet = {
        name: "Singaraja (Pusat)",
        address: "Jl. Ngurah Rai No. 45, Singaraja, Bali",
        phone: "(0362) 23456",
      };

      const publisher = resolveCoworkingReceiptPublisher(activeOutlet);
      expect(publisher.brandName).toBe("DAGO CREATIVE HUB");
      expect(publisher.outletName).toContain("Dago Creative Hub");
      expect(publisher.outletName).not.toContain("Kopi Senja");
      expect(publisher.outletAddress).toBe("Jl. Ngurah Rai No. 45, Singaraja, Bali");
      expect(publisher.outletPhone).toBe("(0362) 23456");
    });

    it("falls back to central HQ data when active outlet is null or undefined", () => {
      const publisher = resolveCoworkingReceiptPublisher(null);
      expect(publisher.brandName).toBe("DAGO CREATIVE HUB");
      expect(publisher.outletName).toContain("Dago Creative Hub");
      expect(publisher.outletName).not.toContain("Kopi Senja");
      expect(publisher.outletAddress).toBe(MASTER_HQ_OUTLET.address);
    });
  });

  describe("F&B Order Receipt Publisher (A6-2)", () => {
    const activeOutlet = {
      name: "Singaraja (Pusat)",
      address: "Jl. Ngurah Rai No. 45, Singaraja, Bali",
      phone: "(0362) 23456",
    };

    it("publishes single-mitra receipt under the specific tenant name even if first item lacked tenantId", () => {
      const items = [
        { tenantId: undefined, tenantName: undefined },
        { tenantId: "tenant-kitchen", tenantName: "Dapur Mama" },
      ];

      const publisher = resolvePosReceiptPublisher(items, activeOutlet);
      expect(publisher.isMultiTenant).toBe(false);
      expect(publisher.brandName).toBe("Dapur Mama");
      expect(publisher.outletName).toBe("Dapur Mama — Singaraja (Pusat)");
      expect(publisher.outletAddress).toBe("Jl. Ngurah Rai No. 45, Singaraja, Bali");
    });

    it("publishes multi-mitra receipt under Dago Creative Hub with multi-tenant tagline", () => {
      const items = [
        { tenantId: "tenant-ks", tenantName: "Kopi Senja" },
        { tenantId: "tenant-kitchen", tenantName: "Dapur Mama" },
      ];

      const publisher = resolvePosReceiptPublisher(items, activeOutlet);
      expect(publisher.isMultiTenant).toBe(true);
      expect(publisher.brandName).toBe("DAGO CREATIVE HUB");
      expect(publisher.outletName).toBe("Dago Creative Hub — Singaraja (Pusat)");
      expect(publisher.tagline).toBe("Ringkasan Pesanan Multi-Mitra");
      expect(publisher.outletAddress).toBe("Jl. Ngurah Rai No. 45, Singaraja, Bali");
    });
  });
});
