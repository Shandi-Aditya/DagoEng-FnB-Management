"use client";

/**
 * Tipe dan Model Data untuk Modul Manajemen Wi-Fi SaaS DagoEng
 * Mendukung pemisahan aturan Wi-Fi F&B (berbasis nominal transaksi)
 * dan Wi-Fi Co-working (berbasis paket sewa/booking).
 */

export type WifiServiceType = "FNB" | "COWORKING";

export type WifiVoucherStatus = "ACTIVE" | "USED" | "EXPIRED" | "CANCELLED";

export type NetworkIntegrationStatus = "DISCONNECTED" | "CONNECTED_SIMULATED" | "ERROR";

export type NetworkHardwareDriver = "MIKROTIK_ROUTEROS" | "UNIFI_CONTROLLER" | "TPLINK_OMADA" | "CUSTOM_RADIUS";

export type WifiCalculationBasis = "GRAND_TOTAL" | "NET_SALES";

export interface WifiFnBRule {
  id: string;
  minTransactionAmount: number; // Minimal nominal transaksi
  maxTransactionAmount?: number; // Maksimal nominal transaksi (opsional, undefined = tanpa batas atas)
  durationMinutes: number; // Durasi akses internet (menit)
  bandwidthLimitDownMbps?: number; // Batas kecepatan unduh (Mbps)
  bandwidthLimitUpMbps?: number; // Batas kecepatan unggah (Mbps)
  label: string; // Contoh: "Paket Hemat F&B (1 Jam)"
  isActive: boolean;
  notes?: string;
}

export interface WifiCoworkingRule {
  id: string;
  spaceType: "HOT_DESK" | "DEDICATED_DESK" | "MEETING_ROOM" | "ALL";
  bookingType: "HOURLY" | "DAILY" | "MONTHLY" | "ALL";
  durationMode: "FOLLOW_BOOKING" | "FIXED_HOURS" | "FULL_DAY_UNTIL_CLOSING";
  fixedDurationMinutes?: number;
  gracePeriodMinutes: number; // Toleransi waktu ekstra (misal 15 menit)
  maxConcurrentDevices: number; // 1 device untuk hot desk, multi-device untuk meeting room
  bandwidthLimitDownMbps?: number;
  bandwidthLimitUpMbps?: number;
  label: string;
  isActive: boolean;
}

export interface WifiVoucherRecord {
  id: string;
  voucherCode: string; // Kode unik akses, misal "DG-FNB-9821"
  serviceType: WifiServiceType;
  referenceId: string; // orderId / orderNumber untuk F&B, bookingCode untuk Co-working
  referenceLabel: string; // "Pesanan POS #ORD-2026-0042" atau "Booking Hot Desk BKG-001"
  customerName: string;
  customerPhone?: string;
  outletId: string;
  outletName: string;
  tenantId?: string; // Khusus F&B, tenant pemroses pesanan
  tenantName?: string;
  transactionAmount?: number; // Nilai nominal transaksi (untuk audit F&B)
  durationMinutes: number;
  durationFormatted: string; // "1 Jam", "2 Jam", "1 Hari Penuh"
  issuedAt: string; // ISO datetime
  activatedAt?: string; // Waktu pertama kali login di captive portal
  expiresAt: string; // Waktu kadaluwarsa akses
  status: WifiVoucherStatus;
  maxDevices: number;
  usedDevices: number;
  isSimulated: boolean;
}

export interface WifiNetworkConfig {
  outletId: string;
  outletName: string;
  ssidName: string; // e.g. "DagoEng-Guest@Hub"
  driver: NetworkHardwareDriver;
  serverHost: string; // e.g. "192.168.88.1" atau "gateway.dagoeng.internal"
  serverPort: number; // e.g. 8728 (API) atau 443 (HTTPS)
  status: NetworkIntegrationStatus;
  statusLabel: string;
  lastSyncAt: string;
  captivePortalUrl: string; // e.g. "https://wifi.dagoeng.id/login"
  notes: string;
}

/**
 * Aturan Default Wi-Fi F&B (Sesuai Arahan Atasan):
 * - < Rp 100.000 : 1 Jam
 * - Rp 100.000 - Rp 250.000 : 2 Jam
 * - > Rp 250.000 : 3 Jam
 */
export const DEFAULT_FNB_WIFI_RULES: WifiFnBRule[] = [
  {
    id: "rule-fnb-1",
    minTransactionAmount: 25000,
    maxTransactionAmount: 99999,
    durationMinutes: 60,
    bandwidthLimitDownMbps: 10,
    bandwidthLimitUpMbps: 5,
    label: "F&B Standar (1 Jam)",
    isActive: true,
    notes: "Akses 1 jam untuk pembelian ringan di bawah Rp 100.000 (minimal Rp 25.000)",
  },
  {
    id: "rule-fnb-2",
    minTransactionAmount: 100000,
    maxTransactionAmount: 249999,
    durationMinutes: 120,
    bandwidthLimitDownMbps: 20,
    bandwidthLimitUpMbps: 10,
    label: "F&B Santai (2 Jam)",
    isActive: true,
    notes: "Akses 2 jam untuk transaksi Rp 100.000 s/d Rp 249.999",
  },
  {
    id: "rule-fnb-3",
    minTransactionAmount: 250000,
    durationMinutes: 180,
    bandwidthLimitDownMbps: 35,
    bandwidthLimitUpMbps: 15,
    label: "F&B Produktif (3 Jam)",
    isActive: true,
    notes: "Akses 3 jam untuk transaksi kuliner besar / rombongan di atas Rp 250.000",
  },
];

/**
 * Aturan Default Wi-Fi Co-working:
 * Mengikuti durasi sewa booking + 15 menit grace period
 */
export const DEFAULT_COWORKING_WIFI_RULES: WifiCoworkingRule[] = [
  {
    id: "rule-cw-hourly",
    spaceType: "HOT_DESK",
    bookingType: "HOURLY",
    durationMode: "FOLLOW_BOOKING",
    gracePeriodMinutes: 15,
    maxConcurrentDevices: 1,
    bandwidthLimitDownMbps: 50,
    bandwidthLimitUpMbps: 25,
    label: "Hot Desk Flex (Sesuai Durasi Sewa + 15 Menit)",
    isActive: true,
  },
  {
    id: "rule-cw-daily",
    spaceType: "HOT_DESK",
    bookingType: "DAILY",
    durationMode: "FULL_DAY_UNTIL_CLOSING",
    gracePeriodMinutes: 30,
    maxConcurrentDevices: 2,
    bandwidthLimitDownMbps: 75,
    bandwidthLimitUpMbps: 35,
    label: "Daily Pass Coworking (Seharian s/d Tutup Operasional)",
    isActive: true,
  },
  {
    id: "rule-cw-meeting",
    spaceType: "MEETING_ROOM",
    bookingType: "HOURLY",
    durationMode: "FOLLOW_BOOKING",
    gracePeriodMinutes: 20,
    maxConcurrentDevices: 10,
    bandwidthLimitDownMbps: 100,
    bandwidthLimitUpMbps: 50,
    label: "Meeting Room Executive (Multi-Device hingga 10 Tamu)",
    isActive: true,
  },
  {
    id: "rule-cw-dedicated",
    spaceType: "DEDICATED_DESK",
    bookingType: "MONTHLY",
    durationMode: "FIXED_HOURS",
    fixedDurationMinutes: 30 * 24 * 60, // 30 hari
    gracePeriodMinutes: 60,
    maxConcurrentDevices: 3,
    bandwidthLimitDownMbps: 100,
    bandwidthLimitUpMbps: 50,
    label: "Dedicated Desk Member (Akses Penuh 30 Hari)",
    isActive: true,
  },
];

/**
 * Memvalidasi apakah ada aturan Wi-Fi F&B yang rentang nominalnya tumpang tindih
 */
export function validateFnBRulesOverlap(rules: WifiFnBRule[]): { hasOverlap: boolean; errorMessage?: string } {
  const activeRules = rules.filter((r) => r.isActive);
  for (let i = 0; i < activeRules.length; i++) {
    for (let j = i + 1; j < activeRules.length; j++) {
      const a = activeRules[i];
      const b = activeRules[j];
      const aMax = a.maxTransactionAmount ?? Infinity;
      const bMax = b.maxTransactionAmount ?? Infinity;

      // Rentang A: [a.min, aMax], Rentang B: [b.min, bMax]
      if (Math.max(a.minTransactionAmount, b.minTransactionAmount) <= Math.min(aMax, bMax)) {
        return {
          hasOverlap: true,
          errorMessage: `Rentang nominal "${a.label}" (Rp ${a.minTransactionAmount.toLocaleString("id-ID")} - ${
            a.maxTransactionAmount ? `Rp ${a.maxTransactionAmount.toLocaleString("id-ID")}` : "Tanpa Batas"
          }) tumpang-tindih dengan "${b.label}" (Rp ${b.minTransactionAmount.toLocaleString("id-ID")} - ${
            b.maxTransactionAmount ? `Rp ${b.maxTransactionAmount.toLocaleString("id-ID")}` : "Tanpa Batas"
          }).`,
        };
      }
    }
  }
  return { hasOverlap: false };
}export function matchFnBWifiRule(
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
  return getOrCreateSimulatedWifiVoucher(orderNumber, customerName, amount, outletName, tenantId, tenantName);
}

/**
 * Initial demo mock vouchers untuk riwayat voucher
 */
export const INITIAL_DEMO_WIFI_VOUCHERS: WifiVoucherRecord[] = [
  {
    id: "vcr-fnb-1",
    voucherCode: "DG-FNB-7821",
    serviceType: "FNB",
    referenceId: "ORD-2026-104",
    referenceLabel: "Struk POS #ORD-2026-104",
    customerName: "Budi Pratama",
    customerPhone: "081234567890",
    outletId: "out-sgr",
    outletName: "Dago Creative Hub Singaraja",
    tenantId: "tenant-ks",
    tenantName: "Kopi Senja",
    transactionAmount: 115000,
    durationMinutes: 120,
    durationFormatted: "2 Jam",
    issuedAt: "2026-10-14T08:30:00.000Z",
    activatedAt: "2026-10-14T08:35:10.000Z",
    expiresAt: "2026-10-14T10:35:10.000Z",
    status: "ACTIVE",
    maxDevices: 1,
    usedDevices: 1,
    isSimulated: true,
  },
  {
    id: "vcr-fnb-2",
    voucherCode: "DG-FNB-4190",
    serviceType: "FNB",
    referenceId: "ORD-2026-101",
    referenceLabel: "Struk POS #ORD-2026-101",
    customerName: "Citra Dewi",
    outletId: "out-sgr",
    outletName: "Dago Creative Hub Singaraja",
    tenantId: "tenant-dm",
    tenantName: "Dapur Mama",
    transactionAmount: 65000,
    durationMinutes: 60,
    durationFormatted: "1 Jam",
    issuedAt: "2026-10-14T07:15:00.000Z",
    activatedAt: "2026-10-14T07:18:22.000Z",
    expiresAt: "2026-10-14T08:18:22.000Z",
    status: "EXPIRED",
    maxDevices: 1,
    usedDevices: 1,
    isSimulated: true,
  },
  {
    id: "vcr-fnb-3",
    voucherCode: "DG-FNB-9342",
    serviceType: "FNB",
    referenceId: "ORD-2026-108",
    referenceLabel: "Struk POS #ORD-2026-108",
    customerName: "Komang Arya",
    outletId: "out-sgr",
    outletName: "Dago Creative Hub Singaraja",
    tenantId: "tenant-ks",
    tenantName: "Kopi Senja",
    transactionAmount: 280000,
    durationMinutes: 180,
    durationFormatted: "3 Jam",
    issuedAt: "2026-10-14T09:45:00.000Z",
    activatedAt: "2026-10-14T09:50:00.000Z",
    expiresAt: "2026-10-14T12:50:00.000Z",
    status: "ACTIVE",
    maxDevices: 1,
    usedDevices: 1,
    isSimulated: true,
  },
  {
    id: "vcr-fnb-4",
    voucherCode: "DG-FNB-2019",
    serviceType: "FNB",
    referenceId: "ORD-2026-095",
    referenceLabel: "Struk POS #ORD-2026-095 (Void)",
    customerName: "Tamu Kasir",
    outletId: "out-sgr",
    outletName: "Dago Creative Hub Singaraja",
    tenantId: "tenant-mb",
    tenantName: "Manis Bakery",
    transactionAmount: 55000,
    durationMinutes: 60,
    durationFormatted: "1 Jam",
    issuedAt: "2026-10-14T06:50:00.000Z",
    expiresAt: "2026-10-14T07:50:00.000Z",
    status: "CANCELLED",
    maxDevices: 1,
    usedDevices: 0,
    isSimulated: true,
  },
  {
    id: "vcr-cw-1",
    voucherCode: "DG-CW-8812",
    serviceType: "COWORKING",
    referenceId: "BKG-2026-001",
    referenceLabel: "Booking Hot Desk Flex (BKG-2026-001)",
    customerName: "Made Wijaya",
    customerPhone: "081987654321",
    outletId: "out-sgr",
    outletName: "Dago Creative Hub Singaraja",
    durationMinutes: 135,
    durationFormatted: "2 Jam (+15 mnt)",
    issuedAt: "2026-10-14T08:00:00.000Z",
    activatedAt: "2026-10-14T08:10:00.000Z",
    expiresAt: "2026-10-14T10:25:00.000Z",
    status: "ACTIVE",
    maxDevices: 1,
    usedDevices: 1,
    isSimulated: true,
  },
  {
    id: "vcr-cw-2",
    voucherCode: "DG-MEET-5501",
    serviceType: "COWORKING",
    referenceId: "BKG-2026-004",
    referenceLabel: "Executive Glass Meeting Room (BKG-2026-004)",
    customerName: "Startup Bali Tech",
    customerPhone: "081122334455",
    outletId: "out-sgr",
    outletName: "Dago Creative Hub Singaraja",
    durationMinutes: 200,
    durationFormatted: "3 Jam (+20 mnt)",
    issuedAt: "2026-10-14T09:00:00.000Z",
    activatedAt: "2026-10-14T09:05:00.000Z",
    expiresAt: "2026-10-14T12:25:00.000Z",
    status: "ACTIVE",
    maxDevices: 10,
    usedDevices: 6,
    isSimulated: true,
  },
];

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
  notes: "Driver adapter siap menerima koneksi API MikroTik RouterOS / UniFi Controller setelah konfigurasi jaringan lapangan dipasang.",
};

const STORAGE_KEY_FNB_RULES = "dagoeng_wifi_fnb_rules_v1";
const STORAGE_KEY_CW_RULES = "dagoeng_wifi_cw_rules_v1";
const STORAGE_KEY_VOUCHERS = "dagoeng_wifi_vouchers_v1";
const STORAGE_KEY_CALC_BASIS = "dagoeng_wifi_calc_basis_v1";

let memoryFnBRules: WifiFnBRule[] | null = null;
let memoryCwRules: WifiCoworkingRule[] | null = null;
let memoryVouchers: WifiVoucherRecord[] | null = null;
let memoryCalcBasis: WifiCalculationBasis = "GRAND_TOTAL";

/**
 * Mendapatkan basis perhitungan nominal transaksi untuk aturan Wi-Fi F&B
 */
export function getSimulatedWifiCalcBasis(): WifiCalculationBasis {
  if (typeof window === "undefined") {
    return memoryCalcBasis;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CALC_BASIS);
    if (raw === "GRAND_TOTAL" || raw === "NET_SALES") {
      return raw;
    }
  } catch (e) {
    console.error("Failed to read wifi calc basis", e);
  }
  return memoryCalcBasis;
}

/**
 * Menyimpan basis perhitungan nominal transaksi
 */
export function setSimulatedWifiCalcBasis(basis: WifiCalculationBasis): void {
  memoryCalcBasis = basis;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_CALC_BASIS, basis);
      window.dispatchEvent(new Event("wifi_calc_basis_updated"));
    } catch (e) {
      console.error("Failed to save wifi calc basis", e);
    }
  }
}

/**
 * Mendapatkan daftar aturan Wi-Fi F&B
 */
export function getSimulatedFnBRules(): WifiFnBRule[] {
  if (typeof window === "undefined") {
    return memoryFnBRules || DEFAULT_FNB_WIFI_RULES;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FNB_RULES);
    if (!raw) return memoryFnBRules || DEFAULT_FNB_WIFI_RULES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (e) {
    console.error("Failed to read wifi fnb rules", e);
  }
  return memoryFnBRules || DEFAULT_FNB_WIFI_RULES;
}

/**
 * Menyimpan daftar aturan Wi-Fi F&B
 */
export function saveSimulatedFnBRules(rules: WifiFnBRule[]): { success: boolean; error?: string } {
  const overlapCheck = validateFnBRulesOverlap(rules);
  if (overlapCheck.hasOverlap) {
    return { success: false, error: overlapCheck.errorMessage };
  }

  memoryFnBRules = rules;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_FNB_RULES, JSON.stringify(rules));
      window.dispatchEvent(new Event("wifi_rules_updated"));
    } catch (e) {
      console.error("Failed to save wifi fnb rules", e);
    }
  }
  return { success: true };
}

/**
 * Mendapatkan daftar aturan Wi-Fi Co-working
 */
export function getSimulatedCoworkingRules(): WifiCoworkingRule[] {
  if (typeof window === "undefined") {
    return memoryCwRules || DEFAULT_COWORKING_WIFI_RULES;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CW_RULES);
    if (!raw) return memoryCwRules || DEFAULT_COWORKING_WIFI_RULES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (e) {
    console.error("Failed to read wifi coworking rules", e);
  }
  return memoryCwRules || DEFAULT_COWORKING_WIFI_RULES;
}

/**
 * Mendapatkan seluruh riwayat voucher (F&B & Co-working)
 */
export function getSimulatedWifiVouchers(): WifiVoucherRecord[] {
  if (typeof window === "undefined") {
    return memoryVouchers || INITIAL_DEMO_WIFI_VOUCHERS;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VOUCHERS);
    if (!raw) return memoryVouchers || INITIAL_DEMO_WIFI_VOUCHERS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (e) {
    console.error("Failed to read wifi vouchers", e);
  }
  return memoryVouchers || INITIAL_DEMO_WIFI_VOUCHERS;
}

/**
 * Menyimpan / memperbarui daftar voucher ke storage
 */
export function saveSimulatedWifiVouchers(vouchers: WifiVoucherRecord[]) {
  memoryVouchers = vouchers;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_VOUCHERS, JSON.stringify(vouchers));
      window.dispatchEvent(new Event("wifi_vouchers_updated"));
    } catch (e) {
      console.error("Failed to save wifi vouchers", e);
    }
  }
}

/**
 * PENTING UNTUK RECEIPT MODAL:
 * Mengambil voucher yang SUDAH ADA untuk transaksi ini,
 * ATAU membuat baru jika transaksi memenuhi syarat nominal dan belum pernah dibuat.
 * Mencegah voucher ganda saat cetak ulang struk (reprint)!
 */
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
    // Kembalikan voucher yang sama untuk referensi transaksi ini (reprint safe)
    return found;
  }

  // Cek apakah memenuhi syarat aturan nominal
  const activeRules = getSimulatedFnBRules();
  const rule = matchFnBWifiRule(amount, activeRules);
  if (!rule) {
    return null; // Tidak memenuhi syarat nominal
  }

  // Buat voucher baru
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const voucherCode = `DG-FNB-${randomSuffix}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + rule.durationMinutes * 60 * 1000);

  const newVoucher: WifiVoucherRecord = {
    id: `vcr-${Date.now()}-${randomSuffix}`,
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

  saveSimulatedWifiVouchers([newVoucher, ...existingList]);
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
  if (bookingStatus === "CANCELLED" || bookingStatus === "VOID") {
    // Booking yang dibatalkan tidak boleh mengaktifkan voucher
    revokeSimulatedWifiVoucher(bookingCode);
    return null;
  }

  const existingList = getSimulatedWifiVouchers();
  const found = existingList.find((v) => v.referenceId === bookingCode);
  if (found) {
    if (found.status === "CANCELLED") {
      return null;
    }
    return found;
  }

  const isMeeting = spaceType === "MEETING_ROOM";
  const graceMinutes = isMeeting ? 20 : 15;
  const totalMinutes = durationHours * 60 + graceMinutes;
  const maxDevices = isMeeting ? 10 : 1;

  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const voucherCode = isMeeting ? `DG-MEET-${randomSuffix}` : `DG-CW-${randomSuffix}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + totalMinutes * 60 * 1000);

  const newVoucher: WifiVoucherRecord = {
    id: `vcr-cw-${Date.now()}-${randomSuffix}`,
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

  saveSimulatedWifiVouchers([newVoucher, ...existingList]);
  return newVoucher;
}

/**
 * Membatalkan / mencabut voucher Wi-Fi (misal transaksi di-cancel atau void)
 */
export function revokeSimulatedWifiVoucher(voucherId: string): boolean {
  const list = getSimulatedWifiVouchers();
  const updated = list.map((v) => {
    if (v.id === voucherId || v.referenceId === voucherId) {
      return { ...v, status: "CANCELLED" as WifiVoucherStatus };
    }
    return v;
  });

  saveSimulatedWifiVouchers(updated);
  return true;
}
