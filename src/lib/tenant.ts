import { AuthenticatedUser, BusinessModuleCode, ScopeLevel } from "@/types/auth";

/**
 * Validates that the user has access to a specific organization.
 */
export function assertOrganizationAccess(
  user: AuthenticatedUser | null,
  targetOrganizationId: string
): void {
  if (!user) throw new Error("UNAUTHENTICATED");
  if (user.role.slug === "SUPER_ADMIN") return;

  if (user.organization?.id !== targetOrganizationId) {
    throw new Error(
      `CROSS_TENANT_VIOLATION: User belongs to org [${user.organization?.name}], cannot access target org [${targetOrganizationId}].`
    );
  }
}

/**
 * Validates that a requested business module is currently active in the organization.
 */
export function assertModuleActive(
  moduleCode: BusinessModuleCode,
  activeOrgModules: BusinessModuleCode[] = ["CORE", "FNB", "CO_WORKING"]
): void {
  if (moduleCode === "CORE") return;
  if (!activeOrgModules.includes(moduleCode)) {
    throw new Error(
      `MODULE_DISABLED: Business module [${moduleCode}] is currently inactive in this organization.`
    );
  }
}

/**
 * Validates tenant access boundary.
 * - Dago Organization Owner (Scope: ORGANIZATION) can access all tenants.
 * - Tenant Owner (Scope: TENANT) can strictly access ONLY their assigned tenantId.
 */
export function assertTenantAccess(
  user: AuthenticatedUser | null,
  targetTenantId?: string | null
): void {
  if (!user) throw new Error("UNAUTHENTICATED");
  if (user.role.slug === "SUPER_ADMIN") return;
  if (user.scopeLevel === "ORGANIZATION") return; // Org Owner has multi-tenant scope

  // If user scope is TENANT, targetTenantId must match user's tenantId
  if (user.scopeLevel === "TENANT" || user.scopeLevel === "OUTLET") {
    if (targetTenantId && user.tenant && user.tenant.id !== targetTenantId) {
      throw new Error(
        `TENANT_ISOLATION_VIOLATION: User belongs to tenant [${user.tenant.name}], cannot access target tenant [${targetTenantId}].`
      );
    }
  }
}

/**
 * Validates outlet context for operational vs analytics actions.
 */
export function assertOutletAccess(
  user: AuthenticatedUser | null,
  targetOutletId: string | null,
  isOperationalAction: boolean = false
): void {
  if (!user) throw new Error("UNAUTHENTICATED");
  if (user.role.slug === "SUPER_ADMIN") return;

  // Operational actions (e.g. POS order, Shift opening, Kitchen dispatch) CANNOT run in "ALL OUTLETS" mode
  if (isOperationalAction && (!targetOutletId || targetOutletId === "ALL")) {
    throw new Error(
      "INVALID_OPERATIONAL_CONTEXT: Operational transactions require an explicit Single Outlet context."
    );
  }

  // Owner with Organization or Tenant scope can view "ALL" in read-only analytics mode
  if (user.role.slug === "OWNER" && !isOperationalAction) {
    return;
  }

  // Cashier, Kitchen, Waiter, Inventory staff MUST only access their assigned outlet
  if (user.outlet && targetOutletId && user.outlet.id !== targetOutletId) {
    throw new Error(
      `OUTLET_ISOLATION_VIOLATION: User is assigned to outlet [${user.outlet.name}], cannot access outlet [${targetOutletId}].`
    );
  }
}

/**
 * Generates the scoped reporting query filter according to Role + Access Scope + Module.
 */
export function getScopedDataFilter(
  user: AuthenticatedUser,
  requestedModule: BusinessModuleCode
) {
  // Base check
  if (user.scopeLevel === "ORGANIZATION") {
    return {
      organizationId: user.organization?.id,
      module: requestedModule,
      tenantId: undefined, // All tenants
      outletId: undefined, // All outlets
    };
  }

  if (user.scopeLevel === "TENANT") {
    return {
      organizationId: user.organization?.id,
      module: user.tenant?.businessModule || requestedModule,
      tenantId: user.tenant?.id, // Strictly scoped to user's tenant
      outletId: undefined,
    };
  }

  // Scope is OUTLET (e.g. Cashier, Kitchen, Manager)
  return {
    organizationId: user.organization?.id,
    module: requestedModule,
    tenantId: user.tenant?.id,
    outletId: user.outlet?.id,
  };
}
