import type { RoleSlug, ScopeLevel } from "@/types/auth";
import type { TenantRevenueSplitConfig } from "@/lib/settlement";

export type SettlementBasisMode =
  | "RECEIPT_NET_BEFORE_TAX"
  | "RECEIPT_GROSS_SUBTOTAL"
  | "RECEIPT_TOTAL_WITH_TAX";

export interface ReceiptRoleDistributionPolicy {
  cashierReceiptRoles: RoleSlug[];
  kitchenReceiptRoles: RoleSlug[];
}

export interface SettlementReceiptPolicyConfig {
  settlementBasis: SettlementBasisMode;
  revenueSplits: Record<string, TenantRevenueSplitConfig>;
  receiptRoles: ReceiptRoleDistributionPolicy;
  updatedAt: string;
  updatedBy?: string;
}

export const SETTLEMENT_POLICY_STORAGE_FILE = "settlement_receipt_policy.json";
export const SETTLEMENT_POLICY_LOCAL_KEY = "dagoeng_settlement_receipt_policy_v1";
const LEGACY_REVENUE_SPLIT_LOCAL_KEY = "dagoeng_tenant_revenue_splits_v1";

export const SETTLEMENT_BASIS_OPTIONS: readonly {
  value: SettlementBasisMode;
  label: string;
  description: string;
}[] = [
  {
    value: "RECEIPT_NET_BEFORE_TAX",
    label: "Struk bersih sebelum pajak (default)",
    description:
      "Dihitung dari subtotal dikurangi diskon pada struk lunas, sebelum PB1 dan biaya layanan.",
  },
  {
    value: "RECEIPT_GROSS_SUBTOTAL",
    label: "Subtotal kotor struk sebelum diskon",
    description:
      "Dihitung dari nilai item kotor pada struk lunas sebelum potongan diskon promo, pajak, dan layanan.",
  },
  {
    value: "RECEIPT_TOTAL_WITH_TAX",
    label: "Total akhir struk termasuk pajak",
    description:
      "Dihitung dari total akhir yang dibayar tamu pada struk lunas, termasuk PB1 dan biaya layanan.",
  },
];

const SETTLEMENT_BASIS_LABELS: Record<SettlementBasisMode, string> = {
  RECEIPT_NET_BEFORE_TAX: "Struk bersih sebelum pajak",
  RECEIPT_GROSS_SUBTOTAL: "Subtotal kotor struk sebelum diskon",
  RECEIPT_TOTAL_WITH_TAX: "Total akhir struk termasuk pajak",
};

export const CONFIGURABLE_RECEIPT_ROLES: readonly {
  role: RoleSlug;
  label: string;
  description: string;
}[] = [
  { role: "OWNER", label: "Pemilik", description: "Pemilik organisasi dan mitra" },
  { role: "MANAGER", label: "Manajer", description: "Manajer outlet atau unit usaha" },
  { role: "CASHIER", label: "Kasir", description: "Operator kasir POS" },
  { role: "WAITER", label: "Pelayan", description: "Staf layanan meja dan pengantar pesanan" },
  { role: "KITCHEN_STAFF", label: "Staf dapur", description: "Kru dapur dan layar KDS" },
];

const VALID_ROLE_SLUGS: readonly RoleSlug[] = [
  "SUPER_ADMIN",
  "OWNER",
  "MANAGER",
  "CASHIER",
  "KITCHEN_STAFF",
  "INVENTORY_STAFF",
  "WAITER",
  "CHECKIN_STAFF",
  "CUSTOMER",
];

export const DEFAULT_RECEIPT_ROLE_POLICY: ReceiptRoleDistributionPolicy = {
  cashierReceiptRoles: ["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER"],
  kitchenReceiptRoles: ["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER", "KITCHEN_STAFF", "WAITER"],
};

const DEFAULT_POLICY_REVENUE_SPLITS: Record<string, TenantRevenueSplitConfig> = {
  "tenant-ks": {
    tenantId: "tenant-ks",
    tenantName: "Kopi Senja",
    tenantSharePercent: 85,
    dagoSharePercent: 15,
    status: "ACTIVE",
  },
  "tenant-kitchen": {
    tenantId: "tenant-kitchen",
    tenantName: "Dapur Mama",
    tenantSharePercent: 85,
    dagoSharePercent: 15,
    status: "ACTIVE",
  },
  "tenant-bakery": {
    tenantId: "tenant-bakery",
    tenantName: "Manis Bakery",
    tenantSharePercent: 85,
    dagoSharePercent: 15,
    status: "ACTIVE",
  },
  "tenant-tea": {
    tenantId: "tenant-tea",
    tenantName: "Warung Bu Narti",
    tenantSharePercent: 85,
    dagoSharePercent: 15,
    status: "ACTIVE",
  },
};

export const DEFAULT_SETTLEMENT_RECEIPT_POLICY: SettlementReceiptPolicyConfig = {
  settlementBasis: "RECEIPT_NET_BEFORE_TAX",
  revenueSplits: DEFAULT_POLICY_REVENUE_SPLITS,
  receiptRoles: DEFAULT_RECEIPT_ROLE_POLICY,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

export function isSettlementBasisMode(value: unknown): value is SettlementBasisMode {
  return (
    value === "RECEIPT_NET_BEFORE_TAX" ||
    value === "RECEIPT_GROSS_SUBTOTAL" ||
    value === "RECEIPT_TOTAL_WITH_TAX"
  );
}

function isValidRoleSlug(value: unknown): value is RoleSlug {
  return typeof value === "string" && (VALID_ROLE_SLUGS as readonly string[]).includes(value);
}

function normalizeRoleList(roles: readonly RoleSlug[]): RoleSlug[] {
  const unique = new Set<RoleSlug>(["SUPER_ADMIN"]);
  for (const role of roles) {
    if (isValidRoleSlug(role)) unique.add(role);
  }
  return Array.from(unique);
}

function cloneSplits(
  splits: Record<string, TenantRevenueSplitConfig>
): Record<string, TenantRevenueSplitConfig> {
  const next: Record<string, TenantRevenueSplitConfig> = {};
  for (const [key, cfg] of Object.entries(splits)) {
    next[key] = { ...cfg };
  }
  return next;
}

export function settlementBasisLabel(basis: SettlementBasisMode): string {
  return SETTLEMENT_BASIS_LABELS[basis] ?? SETTLEMENT_BASIS_LABELS.RECEIPT_NET_BEFORE_TAX;
}

export function canManageSettlementAndReceiptPolicy(
  user:
    | {
        role?: RoleSlug | { slug?: RoleSlug };
        scopeLevel?: ScopeLevel | null;
      }
    | null
    | undefined
): boolean {
  if (!user) return false;
  const roleSlug = typeof user.role === "string" ? user.role : user.role?.slug;
  if (roleSlug === "SUPER_ADMIN") return true;
  if (roleSlug === "OWNER") {
    return (
      user.scopeLevel !== "TENANT" &&
      user.scopeLevel !== "OUTLET" &&
      user.scopeLevel !== "BUSINESS_UNIT"
    );
  }
  return false;
}

export function canRoleReceiveCashierReceipt(
  role: RoleSlug | string | null | undefined,
  policy?: ReceiptRoleDistributionPolicy
): boolean {
  if (!role) return false;
  const normalized = String(role).trim().toUpperCase();
  if (!normalized) return false;
  if (normalized === "SUPER_ADMIN") return true;
  const allowed = policy?.cashierReceiptRoles ?? DEFAULT_RECEIPT_ROLE_POLICY.cashierReceiptRoles;
  return (allowed as readonly string[]).includes(normalized);
}

export function canRoleReceiveKitchenReceipt(
  role: RoleSlug | string | null | undefined,
  policy?: ReceiptRoleDistributionPolicy
): boolean {
  if (!role) return false;
  const normalized = String(role).trim().toUpperCase();
  if (!normalized) return false;
  if (normalized === "SUPER_ADMIN") return true;
  const allowed = policy?.kitchenReceiptRoles ?? DEFAULT_RECEIPT_ROLE_POLICY.kitchenReceiptRoles;
  return (allowed as readonly string[]).includes(normalized);
}

export function mergeSettlementReceiptPolicy(
  raw?: Partial<SettlementReceiptPolicyConfig> | null,
  defaultSplits: Record<string, TenantRevenueSplitConfig> = DEFAULT_POLICY_REVENUE_SPLITS
): SettlementReceiptPolicyConfig {
  const settlementBasis = isSettlementBasisMode(raw?.settlementBasis)
    ? raw.settlementBasis
    : DEFAULT_SETTLEMENT_RECEIPT_POLICY.settlementBasis;

  const revenueSplits = cloneSplits(defaultSplits);
  if (raw?.revenueSplits && typeof raw.revenueSplits === "object") {
    for (const [tenantId, cfg] of Object.entries(raw.revenueSplits)) {
      if (!cfg || typeof cfg !== "object") continue;
      revenueSplits[tenantId] = {
        ...revenueSplits[tenantId],
        ...cfg,
        tenantId,
      };
    }
  }

  const cashierReceiptRoles = Array.isArray(raw?.receiptRoles?.cashierReceiptRoles)
    ? normalizeRoleList(raw.receiptRoles.cashierReceiptRoles)
    : [...DEFAULT_RECEIPT_ROLE_POLICY.cashierReceiptRoles];

  const kitchenReceiptRoles = Array.isArray(raw?.receiptRoles?.kitchenReceiptRoles)
    ? normalizeRoleList(raw.receiptRoles.kitchenReceiptRoles)
    : [...DEFAULT_RECEIPT_ROLE_POLICY.kitchenReceiptRoles];

  return {
    settlementBasis,
    revenueSplits,
    receiptRoles: {
      cashierReceiptRoles,
      kitchenReceiptRoles,
    },
    updatedAt:
      typeof raw?.updatedAt === "string" && raw.updatedAt.trim()
        ? raw.updatedAt
        : DEFAULT_SETTLEMENT_RECEIPT_POLICY.updatedAt,
    updatedBy: typeof raw?.updatedBy === "string" ? raw.updatedBy : undefined,
  };
}

export type PolicyValidationResult =
  | { valid: true; policy: SettlementReceiptPolicyConfig }
  | { valid: false; error: string };

export function validateSettlementReceiptPolicyInput(
  input: unknown,
  current?: SettlementReceiptPolicyConfig | null
): PolicyValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, error: "Payload kebijakan bagi hasil dan struk tidak valid." };
  }

  const body = input as Record<string, unknown>;
  const base = mergeSettlementReceiptPolicy(current);

  let nextBasis = base.settlementBasis;
  if (body.settlementBasis !== undefined) {
    if (!isSettlementBasisMode(body.settlementBasis)) {
      return { valid: false, error: "Dasar perhitungan bagi hasil tidak dikenali." };
    }
    nextBasis = body.settlementBasis;
  }

  const nextSplits = cloneSplits(base.revenueSplits);
  if (body.revenueSplits !== undefined) {
    if (!body.revenueSplits || typeof body.revenueSplits !== "object" || Array.isArray(body.revenueSplits)) {
      return { valid: false, error: "Format pembagian hasil mitra tidak valid." };
    }

    for (const [tenantId, rawCfg] of Object.entries(body.revenueSplits as Record<string, unknown>)) {
      if (!tenantId.trim()) {
        return { valid: false, error: "ID mitra tidak boleh kosong." };
      }
      if (!rawCfg || typeof rawCfg !== "object" || Array.isArray(rawCfg)) {
        return { valid: false, error: `Konfigurasi bagi hasil untuk ${tenantId} tidak valid.` };
      }
      const cfgObj = rawCfg as Record<string, unknown>;
      const tenantShare = Number(cfgObj.tenantSharePercent);
      if (!Number.isFinite(tenantShare) || tenantShare < 0 || tenantShare > 100) {
        return {
          valid: false,
          error: `Persentase bagian mitra untuk ${tenantId} harus antara 0% hingga 100%.`,
        };
      }
      const dagoShare =
        cfgObj.dagoSharePercent !== undefined
          ? Number(cfgObj.dagoSharePercent)
          : 100 - tenantShare;
      if (!Number.isFinite(dagoShare) || dagoShare < 0 || dagoShare > 100) {
        return {
          valid: false,
          error: `Persentase bagian DAGO untuk ${tenantId} harus antara 0% hingga 100%.`,
        };
      }
      if (Math.abs(tenantShare + dagoShare - 100) > 0.01) {
        return {
          valid: false,
          error: `Total pembagian mitra dan DAGO untuk ${tenantId} harus tepat 100%.`,
        };
      }

      const existing = nextSplits[tenantId];
      const tenantName =
        typeof cfgObj.tenantName === "string" && cfgObj.tenantName.trim()
          ? cfgObj.tenantName.trim()
          : existing?.tenantName || tenantId;
      const status = cfgObj.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";

      nextSplits[tenantId] = {
        tenantId,
        tenantName,
        tenantSharePercent: tenantShare,
        dagoSharePercent: dagoShare,
        status,
        updatedAt: typeof cfgObj.updatedAt === "string" ? cfgObj.updatedAt : existing?.updatedAt,
      };
    }
  }

  let nextCashierRoles = [...base.receiptRoles.cashierReceiptRoles];
  let nextKitchenRoles = [...base.receiptRoles.kitchenReceiptRoles];

  if (body.receiptRoles !== undefined) {
    if (!body.receiptRoles || typeof body.receiptRoles !== "object" || Array.isArray(body.receiptRoles)) {
      return { valid: false, error: "Format distribusi role struk tidak valid." };
    }
    const rolesObj = body.receiptRoles as Record<string, unknown>;

    if (rolesObj.cashierReceiptRoles !== undefined) {
      if (!Array.isArray(rolesObj.cashierReceiptRoles)) {
        return { valid: false, error: "Daftar role struk kasir harus berupa array." };
      }
      for (const item of rolesObj.cashierReceiptRoles) {
        if (!isValidRoleSlug(item)) {
          return { valid: false, error: `Role struk kasir tidak dikenali: ${String(item)}` };
        }
      }
      nextCashierRoles = normalizeRoleList(rolesObj.cashierReceiptRoles);
    }

    if (rolesObj.kitchenReceiptRoles !== undefined) {
      if (!Array.isArray(rolesObj.kitchenReceiptRoles)) {
        return { valid: false, error: "Daftar role nota dapur harus berupa array." };
      }
      for (const item of rolesObj.kitchenReceiptRoles) {
        if (!isValidRoleSlug(item)) {
          return { valid: false, error: `Role nota dapur tidak dikenali: ${String(item)}` };
        }
      }
      nextKitchenRoles = normalizeRoleList(rolesObj.kitchenReceiptRoles);
    }
  }

  return {
    valid: true,
    policy: {
      settlementBasis: nextBasis,
      revenueSplits: nextSplits,
      receiptRoles: {
        cashierReceiptRoles: nextCashierRoles,
        kitchenReceiptRoles: nextKitchenRoles,
      },
      updatedAt: base.updatedAt,
      updatedBy: base.updatedBy,
    },
  };
}

export function getStoredSettlementReceiptPolicy(): SettlementReceiptPolicyConfig {
  if (typeof window === "undefined") {
    return mergeSettlementReceiptPolicy(DEFAULT_SETTLEMENT_RECEIPT_POLICY);
  }
  try {
    const storage = window.localStorage;
    if (!storage) {
      return mergeSettlementReceiptPolicy(DEFAULT_SETTLEMENT_RECEIPT_POLICY);
    }
    const rawPolicy = storage.getItem(SETTLEMENT_POLICY_LOCAL_KEY);
    const parsedPolicy = rawPolicy ? (JSON.parse(rawPolicy) as Partial<SettlementReceiptPolicyConfig>) : null;
    const rawLegacySplits = storage.getItem(LEGACY_REVENUE_SPLIT_LOCAL_KEY);
    const parsedLegacySplits = rawLegacySplits
      ? (JSON.parse(rawLegacySplits) as Record<string, TenantRevenueSplitConfig>)
      : null;

    const merged = mergeSettlementReceiptPolicy(parsedPolicy);
    if (parsedLegacySplits && typeof parsedLegacySplits === "object") {
      merged.revenueSplits = {
        ...merged.revenueSplits,
        ...parsedLegacySplits,
      };
    }
    return merged;
  } catch {
    return mergeSettlementReceiptPolicy(DEFAULT_SETTLEMENT_RECEIPT_POLICY);
  }
}

function writeBrowserStorageItem(key: string, value: string): void {
  try {
    window.localStorage?.setItem(key, value);
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === "QuotaExceededError" || err.name === "SecurityError")
    ) {
      return;
    }
    throw err;
  }
}

export function saveStoredSettlementReceiptPolicy(
  policy: Partial<SettlementReceiptPolicyConfig>
): SettlementReceiptPolicyConfig {
  const current = getStoredSettlementReceiptPolicy();
  const next = mergeSettlementReceiptPolicy({
    ...current,
    ...policy,
    revenueSplits: policy.revenueSplits
      ? { ...current.revenueSplits, ...policy.revenueSplits }
      : current.revenueSplits,
    receiptRoles: policy.receiptRoles
      ? {
          cashierReceiptRoles:
            policy.receiptRoles.cashierReceiptRoles ?? current.receiptRoles.cashierReceiptRoles,
          kitchenReceiptRoles:
            policy.receiptRoles.kitchenReceiptRoles ?? current.receiptRoles.kitchenReceiptRoles,
        }
      : current.receiptRoles,
    updatedAt: policy.updatedAt || new Date().toISOString(),
  });

  if (typeof window !== "undefined") {
    writeBrowserStorageItem(SETTLEMENT_POLICY_LOCAL_KEY, JSON.stringify(next));
    if (policy.revenueSplits) {
      writeBrowserStorageItem(LEGACY_REVENUE_SPLIT_LOCAL_KEY, JSON.stringify(next.revenueSplits));
    }
    window.dispatchEvent(new Event("settlement_receipt_policy_updated"));
    window.dispatchEvent(new Event("tenant_revenue_split_updated"));
  }

  return next;
}
