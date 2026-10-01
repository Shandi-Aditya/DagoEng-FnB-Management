import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
