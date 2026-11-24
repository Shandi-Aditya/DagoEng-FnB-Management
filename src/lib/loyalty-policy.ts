import type { LoyaltyMember, LoyaltyTier } from "@/types/loyalty";

export interface LoyaltyTierThresholds {
  platinumMin?: number;
  goldMin?: number;
  silverMin?: number;
  bronzeMin?: number;
}

/**
 * Determines whether a given user role is permitted to view full (unmasked) customer contact info (PII).
 * Only SUPER_ADMIN, Hub OWNER (not TENANT scope), and MANAGER are granted full access.
 */
export function canUserViewFullCustomerContacts(
  roleSlug?: string | null,
  scopeLevel?: string | null
): boolean {
  if (!roleSlug) return false;
  if (roleSlug === "SUPER_ADMIN" || roleSlug === "MANAGER") return true;
  if (roleSlug === "OWNER") {
    // Tenant Owner is restricted from viewing full hub customer contacts
    return scopeLevel !== "TENANT";
  }
  return false;
}

/**
 * Masks phone numbers to protect customer privacy for non-managerial staff.
 * Example: "+62 819-1122-3344" -> "+62 819-****-3344", "081234567890" -> "0812****7890".
 */
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

/**
 * Masks email addresses to protect customer privacy for non-managerial staff.
 * Example: "ketut.dian@gmail.com" -> "ke***n@gmail.com".
 */
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

/**
 * Pure function to calculate loyalty tier from point thresholds.
 */
export function calculateTierFromPoints(
  points: number,
  tierConfig?: LoyaltyTierThresholds
): LoyaltyTier {
  const platinum = tierConfig?.platinumMin ?? 3000;
  const gold = tierConfig?.goldMin ?? 1500;
  const silver = tierConfig?.silverMin ?? 500;
  if (points >= platinum) return "Platinum";
  if (points >= gold) return "Gold";
  if (points >= silver) return "Silver";
  return "Bronze";
}

/**
 * Pure function to resolve the authoritative member tier.
 * Prioritizes active manual override (if latest entry in tierHistory is marked isManualOverride === true).
 * Otherwise derives tier strictly from current point balance against tier configuration.
 */
export function resolveAuthoritativeMemberTier(
  member: {
    tier?: string;
    points?: number;
    tierHistory?: Array<{ isManualOverride?: boolean; [key: string]: any }>;
  },
  tierConfig?: LoyaltyTierThresholds
): LoyaltyTier {
  const isLatestOverride = member.tierHistory?.[0]?.isManualOverride === true;
  if (isLatestOverride && member.tier) {
    const validTiers: LoyaltyTier[] = ["Bronze", "Silver", "Gold", "Platinum"];
    if (validTiers.includes(member.tier as LoyaltyTier)) {
      return member.tier as LoyaltyTier;
    }
  }
  return calculateTierFromPoints(Number(member.points) || 0, tierConfig);
}

/**
 * Sanitizes a member record based on role permissions.
 * Non-managerial roles receive masked phone, masked email, and blank identity number.
 */
export function sanitizeMemberForRole(
  member: LoyaltyMember,
  role?: string | null,
  scopeLevel?: string | null,
  options?: { isSelf?: boolean }
): LoyaltyMember {
  if (canUserViewFullCustomerContacts(role, scopeLevel) || options?.isSelf) {
    return {
      ...member,
      identityNo: role === "CUSTOMER" ? "" : member.identityNo,
    };
  }
  return {
    ...member,
    phone: maskCustomerPhone(member.phone),
    email: member.email ? maskCustomerEmail(member.email) : "",
    identityNo: "",
  };
}
