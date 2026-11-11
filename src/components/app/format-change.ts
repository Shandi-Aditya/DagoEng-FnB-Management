const percentFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 1,
});

/**
 * Formats a percentage change together with what it is compared to,
 * e.g. formatChange(12, "bulan lalu") -> "+12% vs bulan lalu".
 */
export function formatChange(percent: number, comparison: string): string {
  const rounded = Math.round(percent * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "";
  return `${sign}${percentFormatter.format(Math.abs(rounded))}% vs ${comparison}`;
}
