import type { LoyaltyMember, LoyaltyTier } from "@/types/loyalty";
import type { StatusTone } from "@/components/app/status-badge";

export interface CustomerKPIs {
  totalMembers: number;
  platinumGoldCount: number;
  silverCount: number;
  bronzeCount: number;
}

export function calculateTierFromPoints(points: number): LoyaltyTier {
  if (points >= 3000) return "Platinum";
  if (points >= 1500) return "Gold";
  if (points >= 500) return "Silver";
  return "Bronze";
}

export function getTierHint(points: number): string {
  if (points >= 3000) {
    return "Masuk tier Platinum (3.000 poin ke atas)";
  }
  if (points >= 1500) {
    return "Masuk tier Gold (1.500 poin ke atas)";
  }
  if (points >= 500) {
    return "Masuk tier Silver (500 poin ke atas)";
  }
  return "Masuk tier Bronze (di bawah 500 poin)";
}

export function getTierTone(tier: LoyaltyTier): StatusTone {
  switch (tier) {
    case "Platinum":
      return "info";
    case "Gold":
      return "warning";
    case "Silver":
    case "Bronze":
    default:
      return "neutral";
  }
}

export function calculateCustomerKPIs(members: LoyaltyMember[]): CustomerKPIs {
  const totalMembers = members.length;
  let platinumGoldCount = 0;
  let silverCount = 0;
  let bronzeCount = 0;

  for (const member of members) {
    if (member.tier === "Platinum" || member.tier === "Gold") {
      platinumGoldCount += 1;
    } else if (member.tier === "Silver") {
      silverCount += 1;
    } else if (member.tier === "Bronze") {
      bronzeCount += 1;
    }
  }

  return {
    totalMembers,
    platinumGoldCount,
    silverCount,
    bronzeCount,
  };
}

export function filterMembers(
  members: LoyaltyMember[],
  rawQuery: string,
  tierFilter = "ALL"
): LoyaltyMember[] {
  const query = rawQuery.trim().toLowerCase();

  return members.filter((c) => {
    const matchQuery =
      !query ||
      c.name.toLowerCase().includes(query) ||
      c.phone.includes(query) ||
      c.tier.toLowerCase().includes(query) ||
      Boolean(c.email && c.email.toLowerCase().includes(query));

    const matchTier = tierFilter === "ALL" || c.tier === tierFilter;

    return matchQuery && matchTier;
  });
}

export function buildCustomerExportData(members: LoyaltyMember[]) {
  const headers = [
    "ID Pelanggan",
    "Nama Pelanggan",
    "No. Telepon / WA",
    "Email",
    "No. Identitas (KTP/Passport)",
    "Tier Loyalty",
    "Poin Aktif",
    "Total Belanja (Rp)",
    "Jumlah Kunjungan",
    "Status Akun",
    "Terdaftar Sejak",
  ];

  const rows = members.map((c) => [
    c.id,
    c.name,
    c.phone,
    c.email || "-",
    c.identityNo || "-",
    c.tier,
    c.points,
    `Rp ${(c.totalSpend || 0).toLocaleString("id-ID")}`,
    c.totalVisits || 0,
    c.status || "ACTIVE",
    c.joinedDate || "-",
  ]);

  return { headers, rows };
}

export const TIER_OPTIONS: readonly { id: string; label: string }[] = [
  { id: "ALL", label: "Semua tier" },
  { id: "Platinum", label: "Platinum" },
  { id: "Gold", label: "Gold" },
  { id: "Silver", label: "Silver" },
  { id: "Bronze", label: "Bronze" },
];

export function emptyCustomerMessage(
  hasFilter: boolean,
  searchQuery?: string
): { title: string; description: string } {
  if (hasFilter) {
    const trimmed = searchQuery?.trim();
    return {
      title: "Tidak ada member yang cocok",
      description: trimmed
        ? `Tidak ada member yang cocok dengan "${trimmed}". Ubah kata kunci atau pilih filter tier lain.`
        : "Ubah kata kunci pencarian atau pilih filter tier lain.",
    };
  }

  return {
    title: "Belum ada member",
    description: "Pelanggan yang terdaftar dari POS atau self-order akan tercatat di sini.",
  };
}

const TIER_RANK: Record<LoyaltyTier, number> = {
  Bronze: 0,
  Silver: 1,
  Gold: 2,
  Platinum: 3,
};

/**
 * Validates whether a member has accumulated enough points to qualify
 * for a higher loyalty tier than their current tier.
 */
export function isEligibleForTierPromotion(
  currentTier: LoyaltyTier,
  points: number
): boolean {
  const calculatedTier = calculateTierFromPoints(points);
  return TIER_RANK[calculatedTier] > TIER_RANK[currentTier];
}

export function canUserExportCustomers(roleSlug?: string): boolean {
  if (!roleSlug) return false;
  return roleSlug === "SUPER_ADMIN" || roleSlug === "OWNER" || roleSlug === "MANAGER";
}

export function canUserViewFullCustomerContacts(roleSlug?: string): boolean {
  if (!roleSlug) return false;
  return roleSlug === "SUPER_ADMIN" || roleSlug === "OWNER" || roleSlug === "MANAGER";
}

export function maskCustomerPhone(phone: string): string {
  if (!phone) return "";
  const trimmed = phone.trim();
  if (trimmed.startsWith("+62 ")) {
    const rest = trimmed.slice(4);
    const parts = rest.split("-");
    if (parts.length === 3) {
      return `+62 ${parts[0]}-****-${parts[2]}`;
    }
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8) return trimmed;
  return `${digits.slice(0, 4)}****${digits.slice(-4)}`;
}

export function maskCustomerEmail(email?: string | null): string {
  if (!email || !email.trim()) return "";
  const trimmed = email.trim();
  const parts = trimmed.split("@");
  if (parts.length !== 2) return trimmed;
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}


