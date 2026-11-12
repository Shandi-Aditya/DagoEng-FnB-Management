/**
 * Static checks for the redesign rules in docs/DESIGN_SYSTEM.md and the unslop checklist.
 * Regex based on purpose: fast, dependency free, good enough to stop regressions in review.
 */

export interface UiLintRule {
  id: string;
  pattern: RegExp;
  message: string;
}

export interface UiLintFinding {
  rule: string;
  line: number;
  match: string;
  message: string;
}

const PALETTE = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const COLOR_UTILITY = "bg|text|border|ring|fill|stroke|from|to|via|outline|divide|shadow";

export const UI_LINT_RULES: readonly UiLintRule[] = [
  {
    id: "raw-color",
    pattern: new RegExp(`(?<![\\w:-])(?:${COLOR_UTILITY})-(?:${PALETTE})-\\d{2,3}\\b`, "g"),
    message: "Pakai token semantik (primary, muted, success, warning, destructive, …), bukan palet mentah.",
  },
  {
    id: "dark-color",
    pattern: new RegExp(`dark:(?:${COLOR_UTILITY})-(?:${PALETTE}|white|black|\\[)`, "g"),
    message: "Token sudah menangani mode gelap; hapus override warna dark:.",
  },
  { id: "hex-color", pattern: /\b(?:bg|text|border|ring|from|to|fill|stroke)-\[#[0-9a-fA-F]{3,8}\]/g, message: "Warna hex mentah dilarang." },
  { id: "legacy-token", pattern: /\bbrand-(?:sage|sageBright|orange)\b/g, message: "Token brand lama; pakai primary atau token unit-*." },
  { id: "heavy-weight", pattern: /\bfont-(?:bold|extrabold|black)\b/g, message: "Bobot maksimal 600 (font-semibold)." },
  { id: "uppercase", pattern: /(?<![\w-])uppercase\b/g, message: "Gunakan sentence case, bukan teks uppercase." },
  { id: "tracked-uppercase", pattern: /\btracking-(?:wide|wider|widest)\b/g, message: "Label tracking lebar adalah pola slop." },
  { id: "small-text", pattern: /\btext-\[(?:[0-9]|10|11)(?:\.\d+)?px\]/g, message: "Teks minimal 12px (text-xs)." },
  { id: "transition-all", pattern: /\btransition-all\b/g, message: "Sebutkan properti transisi (transition-colors, …)." },
  { id: "scale", pattern: /\b(?:hover|active|group-hover):scale-\d+/g, message: "Tanpa efek zoom saat hover/klik." },
  { id: "manual-overlay", pattern: /\bfixed inset-0\b/g, message: "Pakai Dialog, AlertDialog, Sheet, atau Drawer." },
  { id: "as-child", pattern: /<\w+[^>]*\basChild\b/g, message: "Base UI memakai prop render, bukan asChild." },
  {
    id: "emoji",
    pattern: /(?![©®™])\p{Extended_Pictographic}/gu,
    message: "Tanpa emoji di UI; pakai ikon lucide.",
  },
  {
    id: "button-size-override",
    pattern: /<Button\b[^>]*?className="[^"]*\b(?:h-\d+|text-(?:xs|sm|base))\b[^"]*"/g,
    message: "Ukuran tombol lewat prop size, bukan className.",
  },
];

function lineOf(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (source.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

const IGNORE_MARKER = "lint-ui-ignore";

/** All rule violations in one source file, ordered by position. A `lint-ui-ignore` comment on the same or previous line marks a deliberate exception. */
export function lintUiSource(source: string, rules: readonly UiLintRule[] = UI_LINT_RULES): UiLintFinding[] {
  const lines = source.split("\n");
  const isIgnored = (line: number) =>
    lines[line - 1]?.includes(IGNORE_MARKER) || lines[line - 2]?.includes(IGNORE_MARKER);
  const findings: (UiLintFinding & { index: number })[] = [];
  for (const rule of rules) {
    for (const match of source.matchAll(rule.pattern)) {
      const index = match.index ?? 0;
      if (isIgnored(lineOf(source, index))) continue;
      findings.push({ rule: rule.id, line: lineOf(source, index), match: match[0].slice(0, 80), message: rule.message, index });
    }
  }
  return findings.sort((a, b) => a.index - b.index).map(({ index: _index, ...finding }) => finding);
}

/** Findings counted per rule id. */
export function summarize(findings: readonly UiLintFinding[]): Record<string, number> {
  return findings.reduce<Record<string, number>>((counts, finding) => {
    return { ...counts, [finding.rule]: (counts[finding.rule] ?? 0) + 1 };
  }, {});
}
