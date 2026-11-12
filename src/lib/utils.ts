export { cn } from "cn";

/**
 * Formats an integer number to Indonesian Rupiah currency format.
 * Example: 24000 -> "Rp 24.000"
 */
export function formatCurrencyIDR(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formats a percentage value.
 * Example: 0.578 -> "57.8%"
 */
export function formatPercentage(val: number): string {
  return `${(val * 100).toFixed(1)}%`;
}

/**
 * Normalizes Indonesian phone numbers into canonical format: "08xxxxxxxxxx".
 * Handles: "+62 812-3456-7890", "628123456789", "08123456789", "8123456789".
 */
export function normalizeIndonesianPhone(phone: string): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("62")) {
    digits = "0" + digits.slice(2);
  } else if (digits.startsWith("8")) {
    digits = "0" + digits;
  }
  return digits;
}
