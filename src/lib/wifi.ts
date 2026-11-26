import {
  applyWifiCommand,
  capWifiVouchersList,
  mutateConfigDomain,
  SEED_COWORKING_WIFI_RULES,
  SEED_DEMO_WIFI_VOUCHERS,
  SEED_FNB_WIFI_RULES,
  STORAGE_KEY_WIFI_VOUCHERS,
  wifiStorageMirror,
  wifiSyncClient,
} from "@/lib/sync-domains/config-spec";

export type WifiServiceType = "FNB" | "COWORKING";

export type WifiVoucherStatus = "ACTIVE" | "USED" | "EXPIRED" | "CANCELLED";

export type NetworkIntegrationStatus = "DISCONNECTED" | "CONNECTED_SIMULATED" | "ERROR";

export type NetworkHardwareDriver =
  | "MIKROTIK_ROUTEROS"
  | "UNIFI_CONTROLLER"
  | "TPLINK_OMADA"
  | "CUSTOM_RADIUS";

export type WifiCalculationBasis = "GRAND_TOTAL" | "NET_SALES";

export interface WifiFnBRule {
  id: string;
  minTransactionAmount: number;
  maxTransactionAmount?: number;
  durationMinutes: number;
  bandwidthLimitDownMbps?: number;
  bandwidthLimitUpMbps?: number;
  label: string;
  isActive: boolean;
  notes?: string;
}

export interface WifiCoworkingRule {
  id: string;
  spaceType: "HOT_DESK" | "DEDICATED_DESK" | "MEETING_ROOM" | "ALL";
  bookingType: "HOURLY" | "DAILY" | "MONTHLY" | "ALL";
  durationMode: "FOLLOW_BOOKING" | "FIXED_HOURS" | "FULL_DAY_UNTIL_CLOSING";
  fixedDurationMinutes?: number;
  gracePeriodMinutes: number;
  maxConcurrentDevices: number;
  bandwidthLimitDownMbps?: number;
  bandwidthLimitUpMbps?: number;
  label: string;
  isActive: boolean;
}

export interface WifiVoucherRecord {
  id: string;
  voucherCode: string;
  serviceType: WifiServiceType;
  referenceId: string;
  referenceLabel: string;
  customerName: string;
  customerPhone?: string;
  outletId: string;
  outletName: string;
  tenantId?: string;
  tenantName?: string;
  transactionAmount?: number;
  durationMinutes: number;
  durationFormatted: string;
  issuedAt: string;
  activatedAt?: string;
  expiresAt: string;
  status: WifiVoucherStatus;
  maxDevices: number;
  usedDevices: number;
  isSimulated: boolean;
}

export interface WifiNetworkConfig {
  outletId: string;
  outletName: string;
  ssidName: string;
  driver: NetworkHardwareDriver;
  serverHost: string;
  serverPort: number;
  status: NetworkIntegrationStatus;
  statusLabel: string;
  lastSyncAt: string;
  captivePortalUrl: string;
  notes: string;
}

export const DEFAULT_FNB_WIFI_RULES: WifiFnBRule[] = SEED_FNB_WIFI_RULES;
export const DEFAULT_COWORKING_WIFI_RULES: WifiCoworkingRule[] = SEED_COWORKING_WIFI_RULES;
export const INITIAL_DEMO_WIFI_VOUCHERS: WifiVoucherRecord[] = SEED_DEMO_WIFI_VOUCHERS;

export const DEFAULT_NETWORK_CONFIG: WifiNetworkConfig = {
  outletId: "out-sgr",
  outletName: "Dago Creative Hub Singaraja",
  ssidName: "DagoEng-Guest@Singaraja",
  driver: "MIKROTIK_ROUTEROS",
  serverHost: "192.168.88.1 (Gateway IP)",
  serverPort: 8728,
  status: "DISCONNECTED",
  statusLabel: "Belum Terhubung (Siap Diintegrasikan)",
  lastSyncAt: "-",
  captivePortalUrl: "https://wifi.dagoeng.id/login",
  notes:
    "Driver adapter siap menerima koneksi API MikroTik RouterOS / UniFi Controller setelah konfigurasi jaringan lapangan dipasang.",
};

const pendingIssuedVouchers = new Map<string, WifiVoucherRecord>();

function deriveDeterministicVoucherSuffix(referenceId: string): string {
  const normalized = referenceId.trim();
  if (!normalized) {
    return String(Math.floor(1000 + Math.random() * 9000));
  }
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return String(1000 + ((hash >>> 0) % 9000));
}

function writeVouchersCacheSilently(vouchers: WifiVoucherRecord[]): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY_WIFI_VOUCHERS, JSON.stringify(vouchers));
  } catch {}
}

function flushPendingIssuedVoucherNow(key: string): void {
  const pending = pendingIssuedVouchers.get(key);
  if (!pending) return;
  pendingIssuedVouchers.delete(key);
  const issueCmd = {
    op: "ISSUE_VOUCHER" as const,
    voucher: pending,
  };
  mutateConfigDomain(
    wifiSyncClient,
    wifiStorageMirror,
    (prev) => applyWifiCommand(prev, issueCmd),
    {
      id: `wifi-issue-${pending.referenceId || pending.id}`,
      isCreate: true,
      command: issueCmd,
    }
  );
}

function stageVoucherAndScheduleSync(voucher: WifiVoucherRecord): void {
  const key = voucher.referenceId || voucher.id;
  pendingIssuedVouchers.set(key, voucher);
  const currentList = wifiSyncClient.getSnapshot().vouchers;
  const merged = capWifiVouchersList([
    voucher,
    ...currentList.filter(
      (v) => v.id !== voucher.id && (!voucher.referenceId || v.referenceId !== voucher.referenceId)
    ),
  ]);
  writeVouchersCacheSilently(merged);

  queueMicrotask(() => {
    flushPendingIssuedVoucherNow(key);
  });
}

export function validateFnBRulesOverlap(
  rules: WifiFnBRule[]
): { hasOverlap: boolean; errorMessage?: string } {
  const activeRules = rules.filter((r) => r.isActive);
  for (let i = 0; i < activeRules.length; i++) {
    for (let j = i + 1; j < activeRules.length; j++) {
      const a = activeRules[i];
      const b = activeRules[j];
      const aMax = a.maxTransactionAmount ?? Infinity;
      const bMax = b.maxTransactionAmount ?? Infinity;

      if (Math.max(a.minTransactionAmount, b.minTransactionAmount) <= Math.min(aMax, bMax)) {
        return {
          hasOverlap: true,
          errorMessage: `Rentang nominal "${a.label}" (Rp ${a.minTransactionAmount.toLocaleString("id-ID")} - ${
            a.maxTransactionAmount
              ? `Rp ${a.maxTransactionAmount.toLocaleString("id-ID")}`
              : "Tanpa Batas"
          }) tumpang-tindih dengan "${b.label}" (Rp ${b.minTransactionAmount.toLocaleString("id-ID")} - ${
            b.maxTransactionAmount
              ? `Rp ${b.maxTransactionAmount.toLocaleString("id-ID")}`
              : "Tanpa Batas"
          }).`,
        };
      }
    }
  }
  return { hasOverlap: false };
}

export function matchFnBWifiRule(
  amount: number,
  rules: WifiFnBRule[] = getSimulatedFnBRules()
): WifiFnBRule | null {
  const list = rules || getSimulatedFnBRules();
  const activeRules = list.filter((r) => r.isActive);
  for (const rule of activeRules) {
    const min = rule.minTransactionAmount;
    const max = rule.maxTransactionAmount ?? Infinity;
    if (amount >= min && amount <= max) {
      return rule;
    }
  }
  return null;
}

export function generateSimulatedFnBVoucher(
  orderNumber: string,
  customerName: string,
  amount: number,
  outletName: string = "Dago Hub Singaraja",
  tenantName: string = "Kopi Senja",
  tenantId: string = "tenant-ks"
): WifiVoucherRecord | null {
  return getOrCreateSimulatedWifiVoucher(
    orderNumber,
    customerName,
    amount,
    outletName,
    tenantId,
    tenantName
  );
}

export function getSimulatedWifiCalcBasis(): WifiCalculationBasis {
  return wifiSyncClient.getSnapshot().calcBasis;
}

export function setSimulatedWifiCalcBasis(basis: WifiCalculationBasis): void {
  const command = {
    op: "SET_CALC_BASIS" as const,
    calcBasis: basis,
  };
  mutateConfigDomain(
    wifiSyncClient,
    wifiStorageMirror,
    (prev) => applyWifiCommand(prev, command),
    {
      id: "wifi-calc-basis",
      command,
    }
  );
}

export function getSimulatedFnBRules(): WifiFnBRule[] {
  return wifiSyncClient.getSnapshot().fnbRules.map((r) => ({ ...r }));
}

export function saveSimulatedFnBRules(
  rules: WifiFnBRule[]
): { success: boolean; error?: string } {
  const overlapCheck = validateFnBRulesOverlap(rules);
  if (overlapCheck.hasOverlap) {
    return { success: false, error: overlapCheck.errorMessage };
  }

  const command = {
    op: "SAVE_FNB_RULES" as const,
    rules: rules.map((r) => ({ ...r })),
  };
  mutateConfigDomain(
    wifiSyncClient,
    wifiStorageMirror,
    (prev) => applyWifiCommand(prev, command),
    {
      id: "wifi-fnb-rules",
      command,
    }
  );
  return { success: true };
}

export function getSimulatedCoworkingRules(): WifiCoworkingRule[] {
  return wifiSyncClient.getSnapshot().cwRules.map((r) => ({ ...r }));
}

export function saveSimulatedCoworkingRules(
  rules: WifiCoworkingRule[]
): { success: boolean } {
  const command = {
    op: "SAVE_CW_RULES" as const,
    rules: rules.map((r) => ({ ...r })),
  };
  mutateConfigDomain(
    wifiSyncClient,
    wifiStorageMirror,
    (prev) => applyWifiCommand(prev, command),
    {
      id: "wifi-cw-rules",
      command,
    }
  );
  return { success: true };
}

export function getSimulatedWifiVouchers(): WifiVoucherRecord[] {
  const stored = wifiSyncClient.getSnapshot().vouchers;
  if (pendingIssuedVouchers.size === 0) {
    return stored.map((v) => ({ ...v }));
  }
  const extra: WifiVoucherRecord[] = [];
  for (const pending of pendingIssuedVouchers.values()) {
    const exists = stored.some(
      (v) =>
        v.id === pending.id ||
        (Boolean(pending.referenceId) && v.referenceId === pending.referenceId)
    );
    if (!exists) {
      extra.push({ ...pending });
    }
  }
  return [...extra, ...stored.map((v) => ({ ...v }))];
}

export function saveSimulatedWifiVouchers(vouchers: WifiVoucherRecord[]): void {
  pendingIssuedVouchers.clear();
  const capped = capWifiVouchersList(vouchers.map((v) => ({ ...v })));
  mutateConfigDomain(
    wifiSyncClient,
    wifiStorageMirror,
    (prev) => ({ ...prev, vouchers: capped }),
    null
  );
}

export function getOrCreateSimulatedWifiVoucher(
  orderNumber: string,
  customerName: string,
  amount: number,
  outletName: string = "Dago Hub Singaraja",
  tenantId?: string,
  tenantName?: string
): WifiVoucherRecord | null {
  if (!orderNumber) return null;

  const existingList = getSimulatedWifiVouchers();
  const found = existingList.find((v) => v.referenceId === orderNumber);
  if (found) {
    return found;
  }

  const activeRules = getSimulatedFnBRules();
  const rule = matchFnBWifiRule(amount, activeRules);
  if (!rule) {
    return null;
  }

  const suffix = deriveDeterministicVoucherSuffix(orderNumber);
  const voucherCode = `DG-FNB-${suffix}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + rule.durationMinutes * 60 * 1000);

  const newVoucher: WifiVoucherRecord = {
    id: `vcr-fnb-${orderNumber}-${suffix}`,
    voucherCode,
    serviceType: "FNB",
    referenceId: orderNumber,
    referenceLabel: `Struk POS #${orderNumber}`,
    customerName: customerName || "Pelanggan F&B",
    outletId: "out-sgr",
    outletName,
    tenantId: tenantId || "tenant-ks",
    tenantName: tenantName || "Kopi Senja",
    transactionAmount: amount,
    durationMinutes: rule.durationMinutes,
    durationFormatted: `${rule.durationMinutes / 60} Jam`,
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: "ACTIVE",
    maxDevices: 1,
    usedDevices: 0,
    isSimulated: true,
  };

  stageVoucherAndScheduleSync(newVoucher);
  return newVoucher;
}

export function getOrCreateSimulatedCoworkingVoucher(
  bookingCode: string,
  guestName: string,
  spaceType: string,
  bookingType: string,
  durationHours: number = 2,
  outletName: string = "Dago Hub Singaraja",
  bookingStatus?: string
): WifiVoucherRecord | null {
  if (!bookingCode) return null;

  const existingList = getSimulatedWifiVouchers();
  const found = existingList.find((v) => v.referenceId === bookingCode);

  if (bookingStatus === "CANCELLED" || bookingStatus === "VOID") {
    if (found && found.status !== "CANCELLED") {
      queueMicrotask(() => {
        revokeSimulatedWifiVoucher(bookingCode);
      });
    }
    return null;
  }

  if (found) {
    if (found.status === "CANCELLED") {
      return null;
    }
    return found;
  }

  const isMeeting =
    spaceType === "MEETING_ROOM" ||
    spaceType === "SMALL_MEETING_ROOM" ||
    spaceType === "LARGE_MEETING_ROOM" ||
    bookingType === "MEETING_ROOM";
  const graceMinutes = isMeeting ? 20 : 15;
  const totalMinutes = durationHours * 60 + graceMinutes;
  const maxDevices = isMeeting ? 10 : 1;

  const suffix = deriveDeterministicVoucherSuffix(bookingCode);
  const voucherCode = isMeeting ? `DG-MEET-${suffix}` : `DG-CW-${suffix}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + totalMinutes * 60 * 1000);

  const newVoucher: WifiVoucherRecord = {
    id: `vcr-cw-${bookingCode}-${suffix}`,
    voucherCode,
    serviceType: "COWORKING",
    referenceId: bookingCode,
    referenceLabel: `Booking Co-working ${bookingCode}`,
    customerName: guestName || "Tamu Co-working",
    outletId: "out-sgr",
    outletName,
    durationMinutes: totalMinutes,
    durationFormatted: `${durationHours} Jam (+${graceMinutes} mnt)`,
    issuedAt: now.toISOString(),
    activatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: "ACTIVE",
    maxDevices,
    usedDevices: 0,
    isSimulated: true,
  };

  stageVoucherAndScheduleSync(newVoucher);
  return newVoucher;
}

export function revokeSimulatedWifiVoucher(voucherId: string): boolean {
  if (!voucherId) return false;
  for (const [key, pending] of Array.from(pendingIssuedVouchers.entries())) {
    if (key === voucherId || pending.id === voucherId || pending.referenceId === voucherId) {
      flushPendingIssuedVoucherNow(key);
    }
  }
  const command = {
    op: "REVOKE_VOUCHER" as const,
    voucherIdOrRef: voucherId,
  };
  mutateConfigDomain(
    wifiSyncClient,
    wifiStorageMirror,
    (prev) => applyWifiCommand(prev, command),
    {
      id: `wifi-revoke-${voucherId}`,
      command,
    }
  );
  return true;
}
