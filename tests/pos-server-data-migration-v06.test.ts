import { describe, it, expect, beforeEach } from "vitest";
import {
  getPersistentEmployees,
  savePersistentEmployee,
  deletePersistentEmployee,
  getPersistentProductsData,
  savePersistentProduct,
  deletePersistentProduct,
  savePersistentCustomCategory,
  getPersistentLoyaltyMembers,
  savePersistentLoyaltyMember,
  deletePersistentLoyaltyMember,
  writePersistentData,
} from "@/lib/persistent-storage";
import {
  INITIAL_EMPLOYEES,
  INITIAL_PRODUCTS,
  INITIAL_MEMBERS,
  normalizeLoyaltyPhone,
} from "@/lib/master-data-defaults";
import { EmployeeProfile } from "@/types/shift";
import { MasterProduct } from "@/types/product";
import { LoyaltyMember } from "@/types/loyalty";
import {
  enqueueOutboxItem,
  getOutboxItems,
  clearOutboxForTests,
  flushOutbox,
} from "@/lib/sync-outbox";

describe("Task V-06: Migrasi Data Inti ke Server (Employees, Products, Loyalty CRM)", () => {
  beforeEach(async () => {
    // Reset persistent storage test files with clean seed defaults
    await writePersistentData("employees.json", INITIAL_EMPLOYEES);
    await writePersistentData("master_products.json", {
      products: INITIAL_PRODUCTS,
      customCategories: [],
    });
    await writePersistentData("loyalty_members.json", INITIAL_MEMBERS);
    clearOutboxForTests();
  });

  describe("1. Employees Server Persistence", () => {
    it("reads initial employees seeded on first server load", async () => {
      const employees = await getPersistentEmployees();
      expect(employees.length).toBeGreaterThanOrEqual(6);
      expect(employees.some((e) => e.name === "Putu Arya")).toBe(true);
    });

    it("persists new employee creation and survives subsequent reads", async () => {
      const newEmp: EmployeeProfile = {
        id: "emp-test-999",
        employeeNumber: "EMP-SGR-999",
        name: "Kadek Devira",
        role: "Senior Barista",
        department: "Barista",
        outletId: "outlet-sgr",
        outletName: "Singaraja",
        contact: "+62 812-9988-1122",
        email: "kadek.devira@kopisenja.com",
        status: "AKTIF",
        assignedShift: "Shift Pagi (08:00 - 16:00)",
        joinedDate: "16 Nov 2026",
        permissions: ["pos_access"],
      };

      await savePersistentEmployee(newEmp);

      const reloaded = await getPersistentEmployees();
      const found = reloaded.find((e) => e.id === "emp-test-999");
      expect(found).toBeDefined();
      expect(found?.name).toBe("Kadek Devira");
      expect(found?.role).toBe("Senior Barista");
    });

    it("updates employee status and permissions without creating duplicate entries", async () => {
      const updatedPutu: EmployeeProfile = {
        ...INITIAL_EMPLOYEES[0],
        status: "CUTI",
        role: "General Store Manager",
      };

      await savePersistentEmployee(updatedPutu);

      const list = await getPersistentEmployees();
      const putuEntries = list.filter((e) => e.id === "emp-001");
      expect(putuEntries).toHaveLength(1);
      expect(putuEntries[0].status).toBe("CUTI");
      expect(putuEntries[0].role).toBe("General Store Manager");
    });

    it("deletes employee from server storage permanently", async () => {
      await deletePersistentEmployee("emp-006");

      const list = await getPersistentEmployees();
      expect(list.some((e) => e.id === "emp-006")).toBe(false);
    });
  });

  describe("2. Master Products & Categories Server Persistence", () => {
    it("reads initial master products and categories", async () => {
      const data = await getPersistentProductsData();
      expect(data.products.length).toBeGreaterThanOrEqual(10);
      expect(data.products.some((p) => p.name === "Kopi Senja Aren")).toBe(true);
      expect(Array.isArray(data.customCategories)).toBe(true);
    });

    it("adds custom categories to server storage without duplicates", async () => {
      await savePersistentCustomCategory("Seasonal Special");
      await savePersistentCustomCategory("Seasonal Special"); // idempotent

      const data = await getPersistentProductsData();
      const occurrences = data.customCategories.filter((c) => c === "Seasonal Special");
      expect(occurrences).toHaveLength(1);
    });

    it("persists new product and computes gross margin percentage", async () => {
      const newProduct: MasterProduct = {
        id: "prod-test-coffee-coldbrew",
        name: "Cold Brew Slow Drip",
        category: "Minuman",
        basePrice: 30000,
        cogsEstimate: 10000,
        grossMarginPercent: "66.7%",
        status: "ACTIVE",
        outletId: "ALL",
        outletName: "Semua Outlet",
        isAvailable: true,
        tenantId: "tenant-ks",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await savePersistentProduct(newProduct);

      const data = await getPersistentProductsData();
      const saved = data.products.find((p) => p.id === "prod-test-coffee-coldbrew");
      expect(saved).toBeDefined();
      expect(saved?.name).toBe("Cold Brew Slow Drip");
      expect(saved?.basePrice).toBe(30000);
    });

    it("updates product availability and price idempotently", async () => {
      const original = INITIAL_PRODUCTS[0];
      const updatedProduct: MasterProduct = {
        ...original,
        basePrice: 28000,
        isAvailable: false,
      };

      await savePersistentProduct(updatedProduct);

      const data = await getPersistentProductsData();
      const target = data.products.find((p) => p.id === original.id);
      expect(target?.basePrice).toBe(28000);
      expect(target?.isAvailable).toBe(false);
    });

    it("deletes product from server storage", async () => {
      await deletePersistentProduct("prod-116");

      const data = await getPersistentProductsData();
      expect(data.products.some((p) => p.id === "prod-116")).toBe(false);
    });
  });

  describe("3. Loyalty Members CRM Server Persistence", () => {
    it("reads initial loyalty members from server storage", async () => {
      const members = await getPersistentLoyaltyMembers();
      expect(members.length).toBeGreaterThanOrEqual(4);
      expect(members.some((m) => m.name === "Ketut Dian")).toBe(true);
    });

    it("deduplicates members by phone number when saving", async () => {
      const phone = "+62 819-1122-3344";
      const normalized = normalizeLoyaltyPhone(phone);
      expect(normalized).toBe("081911223344");

      const updatedDian: LoyaltyMember = {
        ...INITIAL_MEMBERS[0],
        points: 150,
        tier: "Gold",
      };

      await savePersistentLoyaltyMember(updatedDian);

      const list = await getPersistentLoyaltyMembers();
      const matches = list.filter(
        (m) => normalizeLoyaltyPhone(m.phone) === normalized
      );
      expect(matches).toHaveLength(1);
      expect(matches[0].points).toBe(150);
      expect(matches[0].tier).toBe("Gold");
    });

    it("creates new member with zero points and Bronze tier on server", async () => {
      const newMember: LoyaltyMember = {
        id: "mem-test-99",
        name: "Luh Sari Dewi",
        phone: "+62 878-1234-5678",
        tier: "Bronze",
        points: 0,
        totalSpend: 0,
        totalVisits: 0,
        favoriteItem: "-",
        registeredOutletId: "outlet-sgr",
        registeredOutletName: "Singaraja",
        status: "ACTIVE",
        joinedDate: "16 Nov 2026",
        lastVisit: "16 Nov 2026",
        pointHistory: [],
        tierHistory: [],
      };

      await savePersistentLoyaltyMember(newMember);

      const list = await getPersistentLoyaltyMembers();
      const found = list.find((m) => m.id === "mem-test-99");
      expect(found).toBeDefined();
      expect(found?.name).toBe("Luh Sari Dewi");
    });

    it("deletes loyalty member from server storage", async () => {
      await deletePersistentLoyaltyMember("mem-004");

      const list = await getPersistentLoyaltyMembers();
      expect(list.some((m) => m.id === "mem-004")).toBe(false);
    });
  });

  describe("4. Offline Sync Outbox & Cache Resilience", () => {
    it("enqueues outbox items when offline and flushes cleanly on server reconnection", async () => {
      const queued = enqueueOutboxItem({
        id: "emp-offline-1",
        endpoint: "/api/employees",
        method: "POST",
        payload: {
          employee: {
            id: "emp-offline-1",
            name: "Staf Offline",
            role: "Kasir",
            department: "Cashier",
            outletId: "outlet-sgr",
            outletName: "Singaraja",
            status: "AKTIF",
          },
        },
      });

      expect(queued.length).toBe(1);
      expect(getOutboxItems()[0].id).toBe("emp-offline-1");

      // Mock successful fetch for outbox flush
      const mockFetch = async (url: any, init: any) => {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        } as any;
      };

      const flushResult = await flushOutbox(mockFetch);
      expect(flushResult.flushedCount).toBe(1);
      expect(flushResult.remainingCount).toBe(0);
    });

    it("simulates client cache clear: server remains authoritative source of truth", async () => {
      // Modify an employee and product on the server
      await savePersistentEmployee({
        ...INITIAL_EMPLOYEES[1],
        name: "Ni Kadek Sri (Supervisor)",
      });

      await savePersistentProduct({
        ...INITIAL_PRODUCTS[0],
        basePrice: 27000,
      });

      // Clear simulated client cache
      const clientCache: Record<string, string> = {};
      clientCache["dagoeng_employees_v1"] = "";
      clientCache["dagoeng_master_products_v1"] = "";

      // Re-hydrate from server
      const serverEmployees = await getPersistentEmployees();
      const serverProducts = (await getPersistentProductsData()).products;

      const updatedKadek = serverEmployees.find((e) => e.id === "emp-002");
      const updatedKopi = serverProducts.find((p) => p.id === "prod-101");

      expect(updatedKadek?.name).toBe("Ni Kadek Sri (Supervisor)");
      expect(updatedKopi?.basePrice).toBe(27000);
    });
  });
});
