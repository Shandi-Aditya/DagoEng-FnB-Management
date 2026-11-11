/**
 * Reports redesign-rule violations (see docs/DESIGN_SYSTEM.md).
 *
 *   npm run lint:ui                 # files changed vs HEAD plus untracked files under src/
 *   npm run lint:ui -- <path…>      # specific files or directories
 *   npm run lint:ui -- --strict …   # exit 1 when anything is found (for CI after Fase 8)
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { lintUiSource, summarize } from "../src/lib/lint-ui";

const EXTENSIONS = /\.(tsx|ts|jsx|css)$/;
const SKIP = /(^|\/)(node_modules|\.next|components\/ui|components\/legacy)(\/|$)|legacy-dark\.css$|lint-ui\.ts$/;

function walk(path: string): string[] {
  if (statSync(path).isDirectory()) return readdirSync(path).flatMap((entry) => walk(join(path, entry)));
  return EXTENSIONS.test(path) ? [path] : [];
}

function changedFiles(): string[] {
  const git = (args: string[]) => execFileSync("git", args, { encoding: "utf-8" }).split("\n").filter(Boolean);
  const files = [...git(["diff", "--name-only", "HEAD", "--", "src"]), ...git(["ls-files", "--others", "--exclude-standard", "src"])];
  return Array.from(new Set(files)).filter((file) => EXTENSIONS.test(file));
}

function main(): void {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  const targets = args.filter((arg) => arg !== "--strict");
  const files = (targets.length > 0 ? targets.flatMap(walk) : changedFiles()).filter((file) => !SKIP.test(file));

  let total = 0;
  for (const file of files) {
    let source: string;
    try {
      source = readFileSync(file, "utf-8");
    } catch {
      continue; // deleted in the working tree
    }
    const findings = lintUiSource(source);
    if (findings.length === 0) continue;
    total += findings.length;
    const counts = Object.entries(summarize(findings))
      .map(([rule, count]) => `${rule}×${count}`)
      .join(", ");
    console.log(`\n${file}  (${findings.length}: ${counts})`);
    for (const finding of findings.slice(0, 15)) {
      console.log(`  ${finding.line}  ${finding.rule.padEnd(22)} ${finding.match}`);
    }
    if (findings.length > 15) console.log(`  … ${findings.length - 15} lagi`);
  }

  console.log(`\nlint:ui: ${total} temuan di ${files.length} file diperiksa.`);
  if (strict && total > 0) process.exit(1);
}

main();
