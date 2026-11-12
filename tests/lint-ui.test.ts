import { describe, expect, it } from "vitest";

import { lintUiSource, summarize } from "@/lib/lint-ui";

function ids(source: string): string[] {
  return lintUiSource(source).map((finding) => finding.rule);
}

describe("lintUiSource", () => {
  it("passes clean token-based markup", () => {
    expect(ids('<Card className="bg-card text-muted-foreground">\n  <Button size="sm">Simpan</Button>\n</Card>')).toEqual([]);
  });

  it("flags raw palette colours, hex colours and legacy brand tokens", () => {
    expect(ids('<div className="bg-slate-100 text-emerald-600" />')).toEqual(["raw-color", "raw-color"]);
    expect(ids('<div className="bg-[#2E6044]" />')).toEqual(["hex-color"]);
    expect(ids('<div className="text-brand-sage" />')).toEqual(["legacy-token"]);
  });

  it("flags dark: colour overrides but allows other dark: utilities", () => {
    expect(ids('<div className="dark:bg-slate-900" />')).toContain("dark-color");
    expect(ids('<img className="dark:brightness-50" />')).toEqual([]);
  });

  it("flags slop typography and motion", () => {
    expect(ids('<h2 className="font-black uppercase tracking-wider text-[10px]" />').sort()).toEqual(
      ["heavy-weight", "small-text", "tracked-uppercase", "uppercase"].sort(),
    );
    expect(ids('<button className="transition-all hover:scale-105" />').sort()).toEqual(["scale", "transition-all"].sort());
  });

  it("flags hand-built overlays, Radix asChild and emoji in copy", () => {
    expect(ids('<div className="fixed inset-0 bg-black/50" />')).toEqual(["manual-overlay"]);
    expect(ids("<Button asChild><a /></Button>")).toEqual(["as-child"]);
    expect(ids("<span>Kopi ☕</span>")).toEqual(["emoji"]);
    expect(ids("<p>© 2026 DagoEng</p>")).toEqual([]);
  });

  it("flags size overrides on Button but not layout classes", () => {
    expect(ids('<Button onClick={save} className="h-8 text-xs">Simpan</Button>')).toEqual(["button-size-override"]);
    expect(ids('<Button className="w-full">Simpan</Button>')).toEqual([]);
  });

  it("skips lines marked with lint-ui-ignore on the same or previous line", () => {
    expect(ids('<Input className="uppercase" /> {/* lint-ui-ignore: voucher codes */}')).toEqual([]);
    expect(ids('// lint-ui-ignore\n<Input className="uppercase" />\n<p className="uppercase" />')).toEqual(["uppercase"]);
  });

  it("reports 1-based line numbers", () => {
    const [finding] = lintUiSource('const a = 1;\n<div className="font-bold" />');
    expect(finding).toMatchObject({ rule: "heavy-weight", line: 2 });
  });
});

describe("summarize", () => {
  it("counts findings per rule", () => {
    const findings = lintUiSource('<div className="bg-red-500 bg-blue-500 font-bold" />');
    expect(summarize(findings)).toEqual({ "raw-color": 2, "heavy-weight": 1 });
  });
});
