export type RoleSlug =
  | "SUPER_ADMIN"
  | "OWNER"
  | "MANAGER"
  | "CASHIER"
  | "KITCHEN_STAFF"
  | "INVENTORY_STAFF"
  | "WAITER"
  | "CUSTOMER";

export type ScopeLevel =
  | "PLATFORM"
  | "ORGANIZATION"
  | "BUSINESS_UNIT"
  | "TENANT"
  | "OUTLET";

export type BusinessModuleCode =
  | "CORE"
  | "FNB"
  | "CO_WORKING"
  | "COMMERCIAL";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: {
    id: string;
    slug: RoleSlug;
    name: string;
  };
  scopeLevel: ScopeLevel;
  allowedModules: BusinessModuleCode[];
  organization: {
    id: string;
    name: string;
    code: string;
  } | null;
  tenant: {
    id: string;
    name: string;
    code: string;
    businessModule: BusinessModuleCode;
  } | null;
  outlet: {
    id: string;
    name: string;
    code: string;
  } | null;
  permissions: string[];
}

export interface SessionContext {
  user: AuthenticatedUser;
  sessionId: string;
  activeOutletId: string | null;
  activeTenantId: string | null;
}
