import { BusinessModuleCode } from "./auth";

export interface OrganizationSummary {
  id: string;
  name: string;
  code: string;
  logoUrl?: string | null;
  status: string;
  modules: {
    moduleCode: BusinessModuleCode;
    isActive: boolean;
  }[];
}

export interface TenantSummary {
  id: string;
  organizationId: string;
  businessModule: BusinessModuleCode;
  name: string;
  code: string;
  status: string;
}

export interface OutletSummary {
  id: string;
  organizationId: string;
  tenantId?: string;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  status: string;
}
