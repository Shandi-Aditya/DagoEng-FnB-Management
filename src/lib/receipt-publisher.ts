import { DEFAULT_FNB_TENANTS, getTenantName, getAllStoredTenantSettings } from "./tenant";

import {
  OFFICIAL_CS_DISPLAY_PHONE,
  OFFICIAL_HUB_ADDRESS,
  OFFICIAL_HUB_OUTLET_NAME,
} from "@/lib/contact-config";

export interface OutletItem {
  id: string;
  name: string;
  code: string;
  address: string;
  phone?: string;
  status: "ACTIVE" | "COMING_SOON" | "INACTIVE";
  badgeLabel?: string;
  isComingSoon?: boolean;
}

export const DEMO_OUTLETS: OutletItem[] = [
  {
    id: "outlet-sgr",
    name: OFFICIAL_HUB_OUTLET_NAME,
    code: "KS-SGR",
    address: OFFICIAL_HUB_ADDRESS,
    phone: OFFICIAL_CS_DISPLAY_PHONE,
    status: "ACTIVE",
    badgeLabel: "● Beroperasi Aktif",
    isComingSoon: false,
  },
  {
    id: "outlet-dps",
    name: "Denpasar",
    code: "KS-DPS",
    address: "Jl. Teuku Umar No. 88, Denpasar",
    phone: OFFICIAL_CS_DISPLAY_PHONE,
    status: "COMING_SOON",
    badgeLabel: "Segera hadir (ekspansi)",
    isComingSoon: true,
  },
  {
    id: "outlet-ubd",
    name: "Ubud",
    code: "KS-UBD",
    address: "Jl. Raya Ubud No. 12, Ubud",
    phone: OFFICIAL_CS_DISPLAY_PHONE,
    status: "COMING_SOON",
    badgeLabel: "Segera hadir (ekspansi)",
    isComingSoon: true,
  },
];

export const ACTIVE_OUTLETS: OutletItem[] = DEMO_OUTLETS.filter(
  (o) => o.status === "ACTIVE"
);

export interface MasterOutletInfo {
  name: string;
  address: string;
  phone: string;
}

export const MASTER_HQ_OUTLET: MasterOutletInfo = {
  name: DEMO_OUTLETS[0].name,
  address: OFFICIAL_HUB_ADDRESS,
  phone: OFFICIAL_CS_DISPLAY_PHONE,
};

export interface ReceiptPublisherInfo {
  brandName: string;
  tagline?: string;
  outletName: string;
  outletAddress: string;
  outletPhone: string;
  isMultiTenant: boolean;
  tenantId?: string;
}

const NOTA_SEQ_STORAGE_KEY = "dagoeng_nota_seq_v1";

const PUBLISHER_CODE_MAP: Record<string, string> = {
  "tenant-ks": "KS",
  "kopi-senja": "KS",
  "kopi senja": "KS",
  ks: "KS",
  "tenant-kitchen": "DM",
  "tenant-dm": "DM",
  "dapur-mama": "DM",
  "dapur mama": "DM",
  dm: "DM",
  "tenant-bakery": "MB",
  "tenant-mb": "MB",
  "manis-bakery": "MB",
  "manis bakery": "MB",
  mb: "MB",
  "tenant-tea": "WBN",
  "tenant-wbn": "WBN",
  "warung-bu-narti": "WBN",
  "warung bu narti": "WBN",
  wbn: "WBN",
};

export function resolvePublisherCode(publisherOrTenantId?: string): string {
  const normalized = (publisherOrTenantId || "").trim().toLowerCase();
  if (!normalized) return "DAGO";
  return PUBLISHER_CODE_MAP[normalized] || "DAGO";
}

function formatWitaYmd(date?: Date | string): string {
  const target =
    date instanceof Date
      ? date
      : typeof date === "string" && date.trim()
        ? new Date(date)
        : new Date();
  const safeDate = Number.isNaN(target.getTime()) ? new Date() : target;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(safeDate);
  const year = parts.find((p) => p.type === "year")?.value || "2026";
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";
  return `${year}${month}${day}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readStoredSequenceMap(): Record<string, number> {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return {};
  }
  try {
    const raw = localStorage.getItem(NOTA_SEQ_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, number>;
    }
  } catch {
    return {};
  }
  return {};
}

function writeStoredSequenceMap(map: Record<string, number>): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(NOTA_SEQ_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage quota or private mode may reject writes; sequential fallback still works from existingNumbers.
  }
}

export function generateSequentialReceiptNumber(params: {
  publisherCode: string;
  existingNumbers?: string[];
  date?: Date | string;
  prefix?: string;
}): string {
  const prefix = (params.prefix || "INV").trim().toUpperCase() || "INV";
  const publisherCode = (params.publisherCode || "DAGO").trim().toUpperCase() || "DAGO";
  const witaYmd = formatWitaYmd(params.date);
  const pattern = new RegExp(`^${escapeRegex(prefix)}-${escapeRegex(publisherCode)}-${witaYmd}-(\\d+)$`);

  let maxExisting = 0;
  for (const num of params.existingNumbers || []) {
    if (typeof num !== "string") continue;
    const match = num.trim().match(pattern);
    if (!match) continue;
    const parsedSeq = parseInt(match[1], 10);
    if (Number.isFinite(parsedSeq) && parsedSeq > maxExisting) {
      maxExisting = parsedSeq;
    }
  }

  const storageKey = `${prefix}:${publisherCode}:${witaYmd}`;
  const storedMap = readStoredSequenceMap();
  const storedSeq = typeof storedMap[storageKey] === "number" && Number.isFinite(storedMap[storageKey])
    ? storedMap[storageKey]
    : 0;

  const nextSeq = Math.max(maxExisting, storedSeq) + 1;
  storedMap[storageKey] = nextSeq;
  writeStoredSequenceMap(storedMap);

  return `${prefix}-${publisherCode}-${witaYmd}-${String(nextSeq).padStart(4, "0")}`;
}

/**
 * Resolves receipt publisher info dynamically for Coworking & Meeting Spaces.
 * Co-working spaces belong to Dago Creative Hub, never Kopi Senja or other F&B tenants.
 */
export function resolveCoworkingReceiptPublisher(
  outlet?: { name?: string; address?: string; phone?: string } | null
): ReceiptPublisherInfo {
  const branchName = outlet?.name || MASTER_HQ_OUTLET.name;
  const outletName = `Dago Creative Hub — ${branchName}`;
  const outletAddress = outlet?.address || MASTER_HQ_OUTLET.address;
  const outletPhone = outlet?.phone || MASTER_HQ_OUTLET.phone;

  return {
    brandName: "DAGO CREATIVE HUB",
    tagline: "Co-Working & Meeting Spaces",
    outletName,
    outletAddress,
    outletPhone,
    isMultiTenant: false,
    tenantId: "tenant-cowork",
  };
}

/**
 * Resolves receipt publisher info dynamically for POS & F&B orders based on item tenant ownership.
 */
export function resolvePosReceiptPublisher(
  items: { tenantId?: string; tenantName?: string }[] = [],
  activeOutlet?: { id?: string; name?: string; address?: string; phone?: string } | null,
  fallbackTenantId?: string
): ReceiptPublisherInfo {
  const branchName = activeOutlet?.name || MASTER_HQ_OUTLET.name;
  const outletAddress = activeOutlet?.address || MASTER_HQ_OUTLET.address;
  const outletPhone = activeOutlet?.phone || MASTER_HQ_OUTLET.phone;

  // Find distinct tenants from items
  const tenantIdsInItems = Array.from(
    new Set(
      items
        .map(
          (i) =>
            i.tenantId ||
            (i.tenantName
              ? DEFAULT_FNB_TENANTS.find(
                  (t) => t.name.toLowerCase() === i.tenantName?.toLowerCase()
                )?.id
              : undefined)
        )
        .filter(Boolean) as string[]
    )
  );

  const isMultiTenant = tenantIdsInItems.length > 1;

  if (isMultiTenant) {
    return {
      brandName: "DAGO CREATIVE HUB",
      tagline: "Ringkasan Pesanan Multi-Mitra",
      outletName: `Dago Creative Hub — ${branchName}`,
      outletAddress,
      outletPhone,
      isMultiTenant: true,
    };
  }

  // Single tenant resolution
  const primaryTenantId = tenantIdsInItems[0] || fallbackTenantId || "tenant-ks";
  const tenantMeta = DEFAULT_FNB_TENANTS.find((t) => t.id === primaryTenantId);
  const matchingItem = items.find(
    (i) =>
      i.tenantId === primaryTenantId ||
      (i.tenantName &&
        DEFAULT_FNB_TENANTS.find((t) => t.name.toLowerCase() === i.tenantName?.toLowerCase())
          ?.id === primaryTenantId)
  );
  const tenantName =
    matchingItem?.tenantName ||
    tenantMeta?.name ||
    getTenantName(primaryTenantId) ||
    "Kopi Senja";

  const allStoredSettings = typeof window !== "undefined" ? getAllStoredTenantSettings() : {};
  const storedTenantSettings = (allStoredSettings as any)[primaryTenantId];

  const brandName =
    storedTenantSettings?.brandName ||
    storedTenantSettings?.receiptHeader ||
    tenantName;

  const tagline =
    storedTenantSettings?.tagline ||
    tenantMeta?.tagline ||
    tenantMeta?.badge;

  return {
    brandName,
    tagline,
    outletName: `${brandName} — ${branchName}`,
    outletAddress,
    outletPhone,
    isMultiTenant: false,
    tenantId: primaryTenantId,
  };
}
