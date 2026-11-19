import type { BusinessModuleCode } from "@/types/auth";
import type { ServerAuthResult } from "@/lib/server-auth";
import type { PlatformSettings } from "@/types/settings";
import type { PromoConfig } from "@/lib/promo";
import type {
  IngredientItem,
  PurchaseOrder,
  RecipeBOM,
  StockAdjustmentLog,
  StockOpnameRecord,
} from "@/types/inventory";
import type {
  AreaItem,
  ScheduledReservation,
  TableItem,
  TableStatus,
} from "@/contexts/TableContext";
import type {
  CoworkingMembershipPlan,
  CoworkingSpaceItem,
} from "@/types/coworking";
import type {
  CheckInOutLog,
  CoworkingMemberProfile,
} from "@/contexts/CoworkingContext";
import type {
  CommercialLease,
  LeasePaymentRecord,
  LeaseStatus,
} from "@/types/commercial";
import type { FnbPartnerInfo, TenantProfileData } from "@/lib/tenant";
import type {
  WifiCalculationBasis,
  WifiCoworkingRule,
  WifiFnBRule,
  WifiVoucherRecord,
} from "@/lib/wifi";
import type {
  OrgSubscriptionState,
  PlanTier,
  TenantAddonItem,
} from "@/lib/subscription";
import type {
  POSPrintingSettings,
  PrinterDeviceConfig,
} from "@/types/printer";

export const MAX_INVENTORY_LOGS = 1000;
export const MAX_WIFI_VOUCHERS = 1000;
export const MAX_COWORKING_CHECK_LOGS = 1000;
export const MAX_APPLIED_OP_IDS = 500;

export const SYNC_DOMAINS = [
  "platform-settings",
  "tenants",
  "wifi",
  "subscription",
  "printer-config",
  "inventory",
  "tables",
  "coworking-master",
  "commercial",
] as const;

export type SyncDomainName = (typeof SYNC_DOMAINS)[number];

export interface InventoryDomainState {
  ingredients: IngredientItem[];
  recipes: RecipeBOM[];
  purchaseOrders: PurchaseOrder[];
  logs: StockAdjustmentLog[];
  stockOpnames: StockOpnameRecord[];
  appliedOpIds?: string[];
}

export type InventoryCommand =
  | {
      op: "APPLY_BOM_DELTAS";
      opId: string;
      deltas: Array<{ ingredientId: string; delta: number }>;
      logs: StockAdjustmentLog[];
    }
  | {
      op: "ADJUST_STOCK";
      opId: string;
      ingredientId: string;
      delta: number;
      log: StockAdjustmentLog;
    }
  | {
      op: "RECORD_OPNAME";
      opname: StockOpnameRecord;
      log: StockAdjustmentLog;
    }
  | { op: "UPSERT_RECIPE"; recipe: RecipeBOM }
  | { op: "DELETE_RECIPE"; menuId: string }
  | { op: "CREATE_PO"; po: PurchaseOrder }
  | { op: "RECEIVE_PO"; poId: string }
  | { op: "RESET_INVENTORY" };

export interface TablesDomainState {
  areas: AreaItem[];
  reservations: ScheduledReservation[];
}

export type TablesCommand =
  | { op: "UPSERT_AREA"; area: AreaItem }
  | { op: "DELETE_AREA"; areaId: string }
  | {
      op: "UPSERT_TABLE";
      areaId?: string;
      areaName?: string;
      outletId?: string;
      outletName?: string;
      table: TableItem;
      previousTableId?: string;
    }
  | { op: "DELETE_TABLE"; tableId: string }
  | {
      op: "PATCH_TABLE_STATUS";
      tableId: string;
      status: TableStatus;
      customer?: string;
      total?: string;
      currentBillTotal?: number;
      time?: string;
      itemsCount?: number;
      activeOrderId?: string;
      paymentStatus?: "UNPAID" | "PAID";
    }
  | { op: "UPSERT_RESERVATION"; reservation: ScheduledReservation }
  | {
      op: "PATCH_RESERVATION_STATUS";
      reservationId: string;
      status: ScheduledReservation["status"];
    }
  | { op: "RESET_TABLES" };

export interface CoworkingMasterState {
  spaces: CoworkingSpaceItem[];
  members: CoworkingMemberProfile[];
  checkLogs: CheckInOutLog[];
  plans: CoworkingMembershipPlan[];
}

export type CoworkingMasterCommand =
  | { op: "UPSERT_SPACE"; space: CoworkingSpaceItem }
  | { op: "DELETE_SPACE"; spaceId: string }
  | {
      op: "PATCH_SPACE_SESSION";
      spaceId: string;
      status: CoworkingSpaceItem["status"];
      currentSession?: CoworkingSpaceItem["currentSession"];
      checkLog?: CheckInOutLog;
      completedBookingCode?: string;
      checkoutDate?: string;
      checkoutTime?: string;
      checkoutBy?: string;
    }
  | { op: "UPSERT_MEMBER"; member: CoworkingMemberProfile }
  | { op: "UPSERT_PLAN"; plan: CoworkingMembershipPlan }
  | { op: "DELETE_PLAN"; planId: string }
  | { op: "RESET_COWORKING_MASTER" };

export interface CommercialDomainState {
  leases: CommercialLease[];
}

export type CommercialCommand =
  | { op: "UPSERT_LEASE"; lease: CommercialLease }
  | {
      op: "PATCH_LEASE_STATUS";
      leaseId: string;
      status: LeaseStatus;
      updatedAt: string;
    }
  | {
      op: "RECORD_LEASE_PAYMENT";
      leaseId: string;
      payment: LeasePaymentRecord;
      updatedAt: string;
    }
  | { op: "RESET_COMMERCIAL" };

export type PlatformSettingsDomainState = PlatformSettings & {
  activeOrgModules: BusinessModuleCode[];
  appliedPromoOpIds?: string[];
};

export type PlatformSettingsCommand =
  | {
      op: "PATCH_SETTINGS";
      patch: Partial<PlatformSettingsDomainState>;
      reason?: string;
    }
  | { op: "TOGGLE_ORG_MODULE"; moduleCode: BusinessModuleCode }
  | { op: "SAVE_PROMOS"; promos: PromoConfig[]; tenantScopeId?: string }
  | {
      op: "REDEEM_PROMO";
      opId: string;
      promoIdOrCode: string;
      customerId?: string;
    }
  | {
      op: "REFUND_PROMO";
      opId: string;
      promoIdOrCode: string;
      customerId?: string;
    };

export interface TenantsDomainState {
  customTenants: FnbPartnerInfo[];
  profiles: Record<string, TenantProfileData>;
}

export type TenantsCommand =
  | { op: "UPSERT_CUSTOM_TENANT"; tenant: FnbPartnerInfo }
  | { op: "UPSERT_PROFILE"; profile: TenantProfileData }
  | {
      op: "SET_TENANT_STATUS";
      tenantId: string;
      status: "ACTIVE" | "INACTIVE";
    };

export interface WifiDomainState {
  calcBasis: WifiCalculationBasis;
  fnbRules: WifiFnBRule[];
  cwRules: WifiCoworkingRule[];
  vouchers: WifiVoucherRecord[];
}

export type WifiCommand =
  | { op: "SET_CALC_BASIS"; calcBasis: WifiCalculationBasis }
  | { op: "SAVE_FNB_RULES"; rules: WifiFnBRule[] }
  | { op: "SAVE_CW_RULES"; rules: WifiCoworkingRule[] }
  | { op: "ISSUE_VOUCHER"; voucher: WifiVoucherRecord }
  | { op: "REVOKE_VOUCHER"; voucherIdOrRef: string };

export interface SubscriptionDomainState {
  orgSubscription: OrgSubscriptionState;
  addonsByScope: Record<string, TenantAddonItem[]>;
}

export type SubscriptionCommand =
  | { op: "SET_ORG_PLAN"; planTier: PlanTier }
  | { op: "TOGGLE_ADDON"; scopeId: string; addonIdOrCode: string };

export interface PrinterConfigDomainState {
  devices: PrinterDeviceConfig[];
  settings: POSPrintingSettings;
}

export type PrinterConfigCommand =
  | { op: "UPSERT_DEVICE"; device: PrinterDeviceConfig }
  | { op: "DELETE_DEVICE"; deviceId: string }
  | { op: "PATCH_SETTINGS"; updates: Partial<POSPrintingSettings> };

export interface DomainStateMap {
  "platform-settings": PlatformSettingsDomainState;
  tenants: TenantsDomainState;
  wifi: WifiDomainState;
  subscription: SubscriptionDomainState;
  "printer-config": PrinterConfigDomainState;
  inventory: InventoryDomainState;
  tables: TablesDomainState;
  "coworking-master": CoworkingMasterState;
  commercial: CommercialDomainState;
}

export interface DomainCommandMap {
  "platform-settings": PlatformSettingsCommand;
  tenants: TenantsCommand;
  wifi: WifiCommand;
  subscription: SubscriptionCommand;
  "printer-config": PrinterConfigCommand;
  inventory: InventoryCommand;
  tables: TablesCommand;
  "coworking-master": CoworkingMasterCommand;
  commercial: CommercialCommand;
}

export type DomainReadAuthDecision<S> =
  | { allowed: true; transform?: (state: S) => S }
  | { allowed: false; status: 401 | 403; error: string };

export type DomainWriteAuthDecision =
  | { allowed: true }
  | { allowed: false; status: 400 | 401 | 403; error: string };

export interface ServerDomainSpec<D extends SyncDomainName> {
  readonly domain: D;
  readonly filename: string;
  readonly defaultState: () => DomainStateMap[D];
  authorizeRead(auth: ServerAuthResult): DomainReadAuthDecision<DomainStateMap[D]>;
  authorizeWrite(
    auth: ServerAuthResult,
    command: DomainCommandMap[D]
  ): DomainWriteAuthDecision;
  applyCommand(
    current: DomainStateMap[D],
    command: DomainCommandMap[D],
    auth: ServerAuthResult
  ): DomainStateMap[D];
}
