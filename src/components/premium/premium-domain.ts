/**
 * Pure domain logic for Commercial/Premium Add-On components.
 */

export type ProBadgeVariant = "pro" | "addon" | "beta" | "enterprise";

export type ProBadgeTone = "primary" | "warning" | "info" | "neutral";

export interface ProBadgeMeta {
  label: string;
  tone: ProBadgeTone;
}

/**
 * Maps ProBadgeVariant to default label and tone.
 */
export function getProBadgeVariantMeta(variant: ProBadgeVariant): ProBadgeMeta {
  switch (variant) {
    case "pro":
      return { label: "PRO", tone: "warning" };
    case "enterprise":
      return { label: "ENTERPRISE", tone: "info" };
    case "beta":
      return { label: "BETA", tone: "neutral" };
    case "addon":
    default:
      return { label: "ADD-ON", tone: "primary" };
  }
}

/**
 * Formats, cleans, and limits feature benefits list.
 */
export function formatFeatureBenefits(benefits?: string[], maxCount?: number): string[] {
  if (!benefits || !Array.isArray(benefits)) return [];
  const cleaned = benefits
    .map((b) => (typeof b === "string" ? b.trim() : ""))
    .filter(Boolean);

  if (typeof maxCount === "number" && maxCount > 0) {
    return cleaned.slice(0, maxCount);
  }
  return cleaned;
}

/**
 * Returns formatted status label for sample plans.
 */
export function getSamplePlanStatusLabel(statusText?: string): string {
  if (statusText && statusText.trim()) {
    return statusText.trim();
  }
  return "Tersedia untuk Pengujian Demo";
}
