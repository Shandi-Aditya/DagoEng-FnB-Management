import type { MasterProduct } from "@/types/product";
import type { WifiVoucherRecord, WifiVoucherStatus } from "@/lib/wifi";
import type { PromoComputedStatus } from "@/lib/promo";
import type { PrinterConnectionType, PrinterRole, PrintJobStatus } from "@/types/printer";
import type { TenantStatus, TenantPartnerType } from "@/lib/domain-sync-types";

export type SettingsBadgeTone = "success" | "warning" | "info" | "destructive" | "neutral";

export type ProductSortOrder =
  | "UPDATED_DESC"
  | "UPDATED_ASC"
  | "NAME_ASC"
  | "PRICE_ASC"
  | "PRICE_DESC";

export interface ProductFilterOptions {
  tenantId?: string;
  category?: string;
  status?: "ALL" | "ACTIVE" | "INACTIVE";
  searchQuery?: string;
  sortOrder?: ProductSortOrder;
}

export interface UnifiedPartnerRow {
  id: string;
  name: string;
  type: "FNB" | "EVENT";
  categoryOrBadge: string;
  contactPerson: string;
  phone: string;
  email: string;
  status: TenantStatus;
  activationStatus?: string;
  serviceModule: string;
  scopeLevel: string;
  roleName: string;
  permissions: string[];
  bankInfo?: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  };
  notes?: string;
  npwp?: string;
  partnerType?: TenantPartnerType;
  contractStartDate?: string;
  contractEndDate?: string;
  contractPksNumber?: string;
  contractPksFile?: string;
  suspendedReason?: string;
}

export interface PartnerFilterOptions {
  type?: "ALL" | "FNB" | "EVENT";
  status?: "ALL" | TenantStatus;
  searchQuery?: string;
}

export interface WifiVoucherFilterOptions {
  serviceType?: "ALL" | "FNB" | "COWORKING";
  status?: "ALL" | WifiVoucherStatus;
  searchQuery?: string;
}

/**
 * Filter dan urutkan katalog menu secara murni tanpa memutasi array asal.
 */
export function filterAndSortProducts(
  products: readonly MasterProduct[],
  options: ProductFilterOptions = {},
): MasterProduct[] {
  const {
    tenantId = "ALL",
    category = "ALL",
    status = "ALL",
    searchQuery = "",
    sortOrder = "UPDATED_DESC",
  } = options;

  const needle = searchQuery.trim().toLowerCase();

  const filtered = products.filter((p) => {
    if (tenantId !== "ALL" && p.tenantId !== tenantId) return false;
    if (category !== "ALL" && p.category !== category) return false;
    if (status !== "ALL" && p.status !== status) return false;
    if (needle) {
      const matchName = p.name.toLowerCase().includes(needle);
      const matchCat = p.category.toLowerCase().includes(needle);
      const matchDesc = p.description?.toLowerCase().includes(needle) ?? false;
      if (!matchName && !matchCat && !matchDesc) return false;
    }
    return true;
  });

  return filtered.sort((a, b) => {
    if (sortOrder === "UPDATED_DESC") {
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    }
    if (sortOrder === "UPDATED_ASC") {
      return new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime();
    }
    if (sortOrder === "NAME_ASC") {
      return a.name.localeCompare(b.name, "id-ID");
    }
    if (sortOrder === "PRICE_ASC") {
      return a.basePrice - b.basePrice;
    }
    if (sortOrder === "PRICE_DESC") {
      return b.basePrice - a.basePrice;
    }
    return 0;
  });
}

/**
 * Filter daftar mitra F&B dan penyelenggara event secara murni tanpa mutasi.
 */
export function filterPartners(
  partners: readonly UnifiedPartnerRow[],
  options: PartnerFilterOptions = {},
): UnifiedPartnerRow[] {
  const { type = "ALL", status = "ALL", searchQuery = "" } = options;
  const needle = searchQuery.trim().toLowerCase();

  return partners.filter((item) => {
    if (type !== "ALL" && item.type !== type) return false;
    if (status !== "ALL" && item.status !== status) return false;
    if (needle) {
      const normalizedNeedleDigits = needle.replace(/\D+/g, "");
      const phoneDigits = (item.phone || "").replace(/\D+/g, "");
      const matchPhoneDigits =
        normalizedNeedleDigits.length >= 3 &&
        (phoneDigits.includes(normalizedNeedleDigits) ||
          (normalizedNeedleDigits.startsWith("0") &&
            phoneDigits.includes(`62${normalizedNeedleDigits.slice(1)}`)));
      const haystacks = [
        item.name,
        item.contactPerson,
        item.email,
        item.phone || "",
        item.categoryOrBadge || "",
        item.serviceModule,
        item.npwp || "",
        item.contractPksNumber || "",
      ];
      if (!matchPhoneDigits && !haystacks.some((value) => value.toLowerCase().includes(needle))) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Filter riwayat voucher Wi-Fi berdasarkan layanan, status, dan kata kunci.
 */
export function filterWifiVouchers(
  vouchers: readonly WifiVoucherRecord[],
  options: WifiVoucherFilterOptions = {},
): WifiVoucherRecord[] {
  const { serviceType = "ALL", status = "ALL", searchQuery = "" } = options;
  const needle = searchQuery.trim().toLowerCase();

  return vouchers.filter((v) => {
    if (serviceType !== "ALL" && v.serviceType !== serviceType) return false;
    if (status !== "ALL" && v.status !== status) return false;
    if (needle) {
      const haystacks = [v.voucherCode, v.referenceLabel, v.referenceId, v.customerName];
      if (!haystacks.some((value) => value?.toLowerCase().includes(needle))) return false;
    }
    return true;
  });
}

/**
 * Validasi persentase bagi hasil agar tetap dalam rentang 0-100 dan berjumlah 100.
 */
export function validateRevenueSplit(tenantPercent: number, platformPercent: number): string | null {
  if (
    Number.isNaN(tenantPercent) ||
    Number.isNaN(platformPercent) ||
    tenantPercent < 0 ||
    tenantPercent > 100 ||
    platformPercent < 0 ||
    platformPercent > 100
  ) {
    return "Persentase harus antara 0% dan 100%.";
  }
  if (Math.round(tenantPercent + platformPercent) !== 100) {
    return "Total pembagian (mitra + Dago) harus 100%.";
  }
  return null;
}

export function productStatusLabel(status: string): string {
  if (status === "ACTIVE") return "Aktif";
  if (status === "SUSPENDED") return "Ditangguhkan";
  if (status === "INACTIVE") return "Nonaktif";
  return status || "—";
}

export function productStatusTone(status: string): SettingsBadgeTone {
  if (status === "ACTIVE") return "success";
  if (status === "SUSPENDED") return "warning";
  return "neutral";
}

export function tableStatusLabel(status?: string): string {
  switch (status) {
    case "AVAILABLE":
      return "Tersedia";
    case "OCCUPIED":
      return "Terisi";
    case "RESERVED":
      return "Dipesan";
    default:
      return status || "Tersedia";
  }
}

export function tableStatusTone(status?: string): SettingsBadgeTone {
  switch (status) {
    case "AVAILABLE":
      return "success";
    case "OCCUPIED":
      return "destructive";
    case "RESERVED":
      return "warning";
    default:
      return "success";
  }
}

export function spaceStatusLabel(status?: string): string {
  switch (status) {
    case "AVAILABLE":
      return "Tersedia";
    case "OCCUPIED":
    case "IN_USE":
      return "Terisi";
    case "MAINTENANCE":
      return "Perbaikan";
    default:
      return status || "Tersedia";
  }
}

export function spaceStatusTone(status?: string): SettingsBadgeTone {
  switch (status) {
    case "AVAILABLE":
      return "success";
    case "OCCUPIED":
    case "IN_USE":
      return "info";
    case "MAINTENANCE":
      return "warning";
    default:
      return "neutral";
  }
}

export function printerRoleLabel(role: PrinterRole | string): string {
  switch (role) {
    case "KITCHEN_ORDER":
      return "Nota dapur";
    case "CUSTOMER_RECEIPT":
      return "Struk kasir";
    case "BAR_STATION":
      return "Bar / minuman";
    case "ALL":
      return "Kasir + dapur";
    default:
      return role || "—";
  }
}

export function printerConnectionLabel(type: PrinterConnectionType | string): string {
  switch (type) {
    case "BROWSER_SYSTEM":
      return "Dialog cetak browser";
    case "LOCAL_BRIDGE":
      return "Bridge lokal";
    case "NETWORK_LAN_VIA_BRIDGE":
      return "LAN via bridge";
    case "QZ_TRAY":
      return "QZ Tray agent (Senyap)";
    case "PRINTNODE":
      return "PrintNode cloud agent";
    default:
      return type || "—";
  }
}

export function printJobStatusLabel(status: PrintJobStatus | string): string {
  switch (status) {
    case "BRIDGE_ACKNOWLEDGED":
      return "Diterima bridge";
    case "SENT_TO_SPOOLER":
      return "Terkirim ke antrean";
    case "PRINTING":
      return "Mencetak";
    case "QUEUED":
      return "Menunggu";
    case "OFFLINE":
      return "Offline";
    case "FAILED":
      return "Gagal";
    default:
      return status || "—";
  }
}

export function printJobStatusTone(status: PrintJobStatus | string): SettingsBadgeTone {
  switch (status) {
    case "BRIDGE_ACKNOWLEDGED":
      return "success";
    case "SENT_TO_SPOOLER":
    case "QUEUED":
      return "info";
    case "PRINTING":
      return "warning";
    case "OFFLINE":
    case "FAILED":
      return "destructive";
    default:
      return "neutral";
  }
}

export function wifiVoucherStatusLabel(status: WifiVoucherStatus | string): string {
  switch (status) {
    case "ACTIVE":
      return "Aktif";
    case "USED":
      return "Terpakai";
    case "EXPIRED":
      return "Kedaluwarsa";
    case "CANCELLED":
      return "Dibatalkan";
    default:
      return status || "—";
  }
}

export function wifiVoucherStatusTone(status: WifiVoucherStatus | string): SettingsBadgeTone {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "USED":
      return "neutral";
    case "EXPIRED":
      return "warning";
    case "CANCELLED":
      return "destructive";
    default:
      return "neutral";
  }
}

export function promoStatusLabel(status: PromoComputedStatus | string): string {
  switch (status) {
    case "ACTIVE":
      return "Aktif";
    case "SCHEDULED":
      return "Terjadwal";
    case "QUOTA_EXHAUSTED":
      return "Kuota habis";
    case "EXPIRED":
      return "Kedaluwarsa";
    case "INACTIVE":
      return "Nonaktif";
    default:
      return status || "—";
  }
}

export function promoStatusTone(status: PromoComputedStatus | string): SettingsBadgeTone {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "SCHEDULED":
      return "info";
    case "QUOTA_EXHAUSTED":
      return "warning";
    case "EXPIRED":
    case "INACTIVE":
      return "neutral";
    default:
      return "neutral";
  }
}

export function organizerActivationLabel(status?: string): string {
  switch (status) {
    case "ACTIVE":
    case "ACTIVATED":
      return "Aktif";
    case "PENDING_ACTIVATION":
      return "Menunggu aktivasi";
    case "NOT_INVITED":
      return "Belum diundang";
    case "EXPIRED":
      return "Undangan kedaluwarsa";
    case "INACTIVE":
      return "Nonaktif";
    default:
      return status || "—";
  }
}

export function organizerActivationTone(status?: string): SettingsBadgeTone {
  switch (status) {
    case "ACTIVE":
    case "ACTIVATED":
      return "success";
    case "PENDING_ACTIVATION":
    case "NOT_INVITED":
      return "warning";
    case "EXPIRED":
    case "INACTIVE":
      return "neutral";
    default:
      return "neutral";
  }
}

export function formatSettingsDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Makassar",
  });
}
