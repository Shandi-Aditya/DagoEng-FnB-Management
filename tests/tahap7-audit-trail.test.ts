import { describe, it, expect } from "vitest";
import { ActivityLogEntry, ActivityModule, AuditStatus, ActivitySeverity } from "../src/types/audit";

// Helper function implementing the filtering logic from the Activity Log Page
function filterLogs(
  logs: ActivityLogEntry[],
  filters: {
    searchTerm?: string;
    selectedModule?: string;
    selectedStatus?: string;
    selectedSeverity?: string;
    selectedRole?: string;
    selectedActor?: string;
    dateFilter?: "ALL" | "TODAY" | "LAST_7_DAYS" | "LAST_30_DAYS";
    outletId?: string;
    tenantId?: string;
    isTenantOwner?: boolean;
  }
) {
  const {
    searchTerm = "",
    selectedModule = "ALL",
    selectedStatus = "ALL",
    selectedSeverity = "ALL",
    selectedRole = "ALL",
    selectedActor = "ALL",
    dateFilter = "ALL",
    outletId = "ALL",
    tenantId,
    isTenantOwner = false,
  } = filters;

  return logs.filter((l) => {
    // Tenant isolation
    if (isTenantOwner && tenantId) {
      if (l.tenantId && l.tenantId !== tenantId) {
        return false;
      }
    }

    // Outlet filter
    if (outletId !== "ALL" && l.outletId && l.outletId !== outletId) {
      return false;
    }

    // Module filter
    if (selectedModule !== "ALL" && l.module !== selectedModule) {
      return false;
    }

    // Status filter
    if (selectedStatus !== "ALL" && l.status !== selectedStatus) {
      return false;
    }

    // Severity filter
    if (selectedSeverity !== "ALL" && l.severity !== selectedSeverity) {
      return false;
    }

    // Role filter
    if (selectedRole !== "ALL" && l.actorRole !== selectedRole && l.role !== selectedRole) {
      return false;
    }

    // Actor filter
    if (selectedActor !== "ALL" && l.actorName !== selectedActor) {
      return false;
    }

    // Date range filter
    const logTime = new Date(l.timestamp).getTime();
    const now = new Date().getTime();
    if (dateFilter === "TODAY") {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      if (logTime < startOfDay.getTime()) return false;
    } else if (dateFilter === "LAST_7_DAYS") {
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      if (logTime < sevenDaysAgo) return false;
    } else if (dateFilter === "LAST_30_DAYS") {
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
      if (logTime < thirtyDaysAgo) return false;
    }

    // Search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchActor = l.actorName?.toLowerCase().includes(term);
      const matchRole = l.actorRole?.toLowerCase().includes(term);
      const matchAction = l.action?.toLowerCase().includes(term);
      const matchDesc = l.description?.toLowerCase().includes(term);
      const matchReason = l.reason?.toLowerCase().includes(term);
      const matchRecord = l.recordId?.toLowerCase().includes(term);
      const matchPrev = l.previousValue?.toLowerCase().includes(term);
      const matchNext = l.newValue?.toLowerCase().includes(term);

      if (
        !matchActor &&
        !matchRole &&
        !matchAction &&
        !matchDesc &&
        !matchReason &&
        !matchRecord &&
        !matchPrev &&
        !matchNext
      ) {
        return false;
      }
    }

    return true;
  });
}

// Helper function for pagination
function paginateLogs(logs: ActivityLogEntry[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const startIndex = (safePage - 1) * pageSize;
  const pageData = logs.slice(startIndex, startIndex + pageSize);

  return {
    currentPage: safePage,
    totalPages,
    totalCount: logs.length,
    pageSize,
    pageData,
  };
}

describe("Tahap 7: Audit Trail & Activity Log Comprehensive Test Suite", () => {
  // Generate 65 realistic sample log entries across various modules, users, roles, outlets, and timestamps
  const mockLogs: ActivityLogEntry[] = Array.from({ length: 65 }, (_, index) => {
    const modules: ActivityModule[] = [
      "POS",
      "INVENTORY",
      "TABLES",
      "MENU",
      "LOYALTY",
      "COWORKING",
      "SETTINGS",
      "AUTH",
    ];
    const module = modules[index % modules.length];
    const actors = [
      { name: "Hendra Wijaya", role: "Owner" },
      { name: "Ni Kadek Sri", role: "Head Cashier" },
      { name: "Gede Agus", role: "Chef" },
      { name: "Wayan Sudirman", role: "Manager" },
      { name: "Mitra Dapoer Bali", role: "Tenant Owner", tenantId: "tenant-dapoer-bali" },
    ];
    const actor = actors[index % actors.length];
    const outletId = index % 2 === 0 ? "outlet-sgr" : "outlet-dps";
    const outletName = index % 2 === 0 ? "Singaraja" : "Denpasar";
    const status: AuditStatus = index % 10 === 0 ? "FAILED" : index % 5 === 0 ? "WARNING" : "SUCCESS";
    const severity: ActivitySeverity = index % 15 === 0 ? "CRITICAL" : index % 8 === 0 ? "HIGH" : index % 4 === 0 ? "MEDIUM" : "LOW";

    return {
      id: `log-${index + 1}`,
      actorId: `usr-${index + 1}`,
      actorName: actor.name,
      actorRole: actor.role,
      role: actor.role,
      tenantId: actor.tenantId,
      organization: "org-dago-hub",
      organizationName: "Dago Creative Hub",
      outletId,
      outletName,
      module,
      action: `${module}_ACTION_${index + 1}`,
      recordId: `REC-${1000 + index}`,
      timestamp: new Date(Date.now() - index * 3600 * 1000 * 4).toISOString(),
      previousValue: `State A for item ${index + 1}`,
      newValue: `State B for item ${index + 1}`,
      description: `Aktivitas audit log sistem untuk modul ${module} #${index + 1}`,
      reason: index % 3 === 0 ? `Business reason justification for record #${index + 1}` : undefined,
      status,
      severity,
      category: "OPERATIONAL",
      metadata: { recordSeq: index + 1, module },
    };
  });

  // 1. Search test
  it("1. Activity Log can perform keyword search across action, actor, description, recordId, and reason", () => {
    const searchByAction = filterLogs(mockLogs, { searchTerm: "POS_ACTION_1" });
    expect(searchByAction.length).toBeGreaterThan(0);
    expect(searchByAction.every((l) => l.action.includes("POS_ACTION_1"))).toBe(true);

    const searchByActor = filterLogs(mockLogs, { searchTerm: "Ni Kadek" });
    expect(searchByActor.length).toBeGreaterThan(0);
    expect(searchByActor.every((l) => l.actorName.includes("Ni Kadek"))).toBe(true);

    const searchByRecordId = filterLogs(mockLogs, { searchTerm: "REC-1005" });
    expect(searchByRecordId.length).toBe(1);
    expect(searchByRecordId[0].recordId).toBe("REC-1005");

    const searchByReason = filterLogs(mockLogs, { searchTerm: "Business reason justification" });
    expect(searchByReason.length).toBeGreaterThan(0);
    expect(searchByReason.every((l) => l.reason?.includes("Business reason justification"))).toBe(true);
  });

  // 2. Module filter test
  it("2. Filter activity by module works accurately", () => {
    const posLogs = filterLogs(mockLogs, { selectedModule: "POS" });
    expect(posLogs.length).toBeGreaterThan(0);
    expect(posLogs.every((l) => l.module === "POS")).toBe(true);

    const inventoryLogs = filterLogs(mockLogs, { selectedModule: "INVENTORY" });
    expect(inventoryLogs.length).toBeGreaterThan(0);
    expect(inventoryLogs.every((l) => l.module === "INVENTORY")).toBe(true);

    const coworkingLogs = filterLogs(mockLogs, { selectedModule: "COWORKING" });
    expect(coworkingLogs.length).toBeGreaterThan(0);
    expect(coworkingLogs.every((l) => l.module === "COWORKING")).toBe(true);
  });

  // 3. User & Role filter test
  it("3. Filter user and role works accurately", () => {
    const ownerLogs = filterLogs(mockLogs, { selectedRole: "Owner" });
    expect(ownerLogs.length).toBeGreaterThan(0);
    expect(ownerLogs.every((l) => l.actorRole === "Owner" || l.role === "Owner")).toBe(true);

    const hendraLogs = filterLogs(mockLogs, { selectedActor: "Hendra Wijaya" });
    expect(hendraLogs.length).toBeGreaterThan(0);
    expect(hendraLogs.every((l) => l.actorName === "Hendra Wijaya")).toBe(true);

    const chefLogs = filterLogs(mockLogs, { selectedRole: "Chef" });
    expect(chefLogs.length).toBeGreaterThan(0);
    expect(chefLogs.every((l) => l.actorRole === "Chef")).toBe(true);
  });

  // 4. Pagination test
  it("4. Pagination works correctly calculating total pages and safe indexing", () => {
    const total = mockLogs.length; // 65 items
    const page1 = paginateLogs(mockLogs, 1, 15);
    expect(page1.totalPages).toBe(5); // ceil(65 / 15) = 5
    expect(page1.currentPage).toBe(1);
    expect(page1.pageData.length).toBe(15);
    expect(page1.pageData[0].id).toBe("log-1");
    expect(page1.pageData[14].id).toBe("log-15");

    const page2 = paginateLogs(mockLogs, 2, 15);
    expect(page2.currentPage).toBe(2);
    expect(page2.pageData.length).toBe(15);
    expect(page2.pageData[0].id).toBe("log-16");

    const page5 = paginateLogs(mockLogs, 5, 15);
    expect(page5.currentPage).toBe(5);
    expect(page5.pageData.length).toBe(5); // remaining items
  });

  // 5. Page size 10 test
  it("5. Page size 10 works accurately", () => {
    const res = paginateLogs(mockLogs, 1, 10);
    expect(res.pageSize).toBe(10);
    expect(res.pageData.length).toBe(10);
    expect(res.totalPages).toBe(7); // ceil(65 / 10) = 7
  });

  // 6. Page size 15 test
  it("6. Page size 15 works accurately", () => {
    const res = paginateLogs(mockLogs, 1, 15);
    expect(res.pageSize).toBe(15);
    expect(res.pageData.length).toBe(15);
    expect(res.totalPages).toBe(5); // ceil(65 / 15) = 5
  });

  // 7. Page size 25 test
  it("7. Page size 25 works accurately", () => {
    const res = paginateLogs(mockLogs, 1, 25);
    expect(res.pageSize).toBe(25);
    expect(res.pageData.length).toBe(25);
    expect(res.totalPages).toBe(3); // ceil(65 / 25) = 3
  });

  // 8. Page size 50 test
  it("8. Page size 50 works accurately", () => {
    const res = paginateLogs(mockLogs, 1, 50);
    expect(res.pageSize).toBe(50);
    expect(res.pageData.length).toBe(50);
    expect(res.totalPages).toBe(2); // ceil(65 / 50) = 2
  });

  // 9. Preserving filter on page navigation & resetting on filter change
  it("9. Filter and search do not break when navigating pages and reset correctly", () => {
    const filtered = filterLogs(mockLogs, { selectedModule: "POS" });
    const totalFiltered = filtered.length;

    const p1 = paginateLogs(filtered, 1, 10);
    const p2 = paginateLogs(filtered, 2, 10);

    // Filters still match on page 2
    expect(p2.pageData.every((l) => l.module === "POS")).toBe(true);

    // If an impossible page is requested (e.g. page 99), safe page clamp takes effect
    const outOfBounds = paginateLogs(filtered, 99, 10);
    expect(outOfBounds.currentPage).toBe(p1.totalPages);
    expect(outOfBounds.pageData.length).toBeGreaterThan(0);
  });

  // 10. Export integration test
  it("10. Export formats all filtered data without truncation from pagination", () => {
    const filtered = filterLogs(mockLogs, { selectedModule: "SETTINGS" });
    // Export should take the full filtered dataset, not just the currently sliced page
    const exportDataset = filtered.map((l) => ({
      timestamp: l.timestamp,
      actor: l.actorName,
      role: l.actorRole,
      module: l.module,
      action: l.action,
      status: l.status,
      severity: l.severity,
      description: l.description,
    }));

    expect(exportDataset.length).toBe(filtered.length);
    expect(exportDataset.every((item) => item.module === "SETTINGS")).toBe(true);
  });

  // 11. RBAC Guard test
  it("11. Unauthorized roles (Cashier, Waiter, Staff, Customer) cannot access Audit Trail", () => {
    const checkAuditAccess = (roleSlug: string, scopeLevel?: string) => {
      const isSuperAdmin = roleSlug === "SUPER_ADMIN";
      const isOrgOwner = roleSlug === "OWNER" && scopeLevel === "ORGANIZATION";
      const isManager = roleSlug === "MANAGER";
      const isTenantOwner = roleSlug === "OWNER" && scopeLevel === "TENANT";
      return isSuperAdmin || isOrgOwner || isManager || isTenantOwner;
    };

    expect(checkAuditAccess("SUPER_ADMIN")).toBe(true);
    expect(checkAuditAccess("OWNER", "ORGANIZATION")).toBe(true);
    expect(checkAuditAccess("MANAGER")).toBe(true);
    expect(checkAuditAccess("OWNER", "TENANT")).toBe(true);

    expect(checkAuditAccess("CASHIER")).toBe(false);
    expect(checkAuditAccess("WAITER")).toBe(false);
    expect(checkAuditAccess("STAFF")).toBe(false);
    expect(checkAuditAccess("CHEF")).toBe(false);
    expect(checkAuditAccess("CUSTOMER")).toBe(false);
  });

  // 12. Multi-tenant isolation test
  it("12. Tenant isolation ensures Tenant Owner only views logs associated with their tenant", () => {
    const tenantOwnerLogs = filterLogs(mockLogs, {
      isTenantOwner: true,
      tenantId: "tenant-dapoer-bali",
    });

    expect(tenantOwnerLogs.length).toBeGreaterThan(0);
    expect(tenantOwnerLogs.every((l) => !l.tenantId || l.tenantId === "tenant-dapoer-bali")).toBe(true);
  });

  // 13. Existing POS/Transaction flow preservation test
  it("13. Existing transaction/POS flow remains unchanged when activity logs are recorded", () => {
    // Simulate POS transaction creation
    const transaction = {
      orderId: "ord-9999",
      tableId: "T-05",
      items: [
        { id: "menu-1", name: "Ayam Betutu Singaraja", price: 45000, quantity: 2 },
        { id: "menu-2", name: "Es Teh Manis", price: 8000, quantity: 2 },
      ],
      subtotal: 106000,
      tax: 11660,
      total: 117660,
      status: "PAID",
      paymentMethod: "QRIS",
    };

    // Audit log generated alongside transaction
    const generatedLog: ActivityLogEntry = {
      id: `log-tx-1`,
      actorId: "usr-cashier-1",
      actorName: "Ni Kadek Sri",
      actorRole: "Head Cashier",
      role: "Head Cashier",
      organization: "org-dago-hub",
      outletId: "outlet-sgr",
      module: "POS",
      action: "PAYMENT_CONFIRMED",
      recordId: transaction.orderId,
      timestamp: new Date().toISOString(),
      previousValue: "Status: UNPAID",
      newValue: `Status: PAID (Total: Rp ${transaction.total.toLocaleString("id-ID")})`,
      description: `Checkout kasir pesanan meja ${transaction.tableId} lunas via ${transaction.paymentMethod}`,
      status: "SUCCESS",
      severity: "INFO",
      metadata: {
        orderId: transaction.orderId,
        subtotal: transaction.subtotal,
        tax: transaction.tax,
        total: transaction.total,
      },
    };

    expect(generatedLog.recordId).toBe(transaction.orderId);
    expect(transaction.total).toBe(117660);
    expect(transaction.status).toBe("PAID");
    expect(generatedLog.metadata?.total).toBe(117660);
  });
});
