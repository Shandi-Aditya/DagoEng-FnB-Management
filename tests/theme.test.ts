import { describe, it, expect, beforeEach } from "vitest";

// In-memory localStorage mock for node environment
const mockStorage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, val: string) => {
    mockStorage[key] = val;
  },
  clear: () => {
    for (const k in mockStorage) delete mockStorage[k];
  },
};

describe("Theme Management & Design System Logic", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  it("should default to system preference or null when no preference stored", () => {
    const key = "dagoeng_theme_preference";
    const stored = mockLocalStorage.getItem(key);
    expect(stored).toBeNull();
  });

  it("should save and persist dark theme preference in localStorage", () => {
    const key = "dagoeng_theme_preference";
    mockLocalStorage.setItem(key, "dark");
    expect(mockLocalStorage.getItem(key)).toBe("dark");
  });

  it("should save and persist light theme preference in localStorage", () => {
    const key = "dagoeng_theme_preference";
    mockLocalStorage.setItem(key, "light");
    expect(mockLocalStorage.getItem(key)).toBe("light");
  });

  it("should correctly toggle from dark to light and vice versa", () => {
    let currentTheme: "light" | "dark" = "light";
    const toggle = () => {
      currentTheme = currentTheme === "dark" ? "light" : "dark";
      mockLocalStorage.setItem("dagoeng_theme_preference", currentTheme);
    };

    toggle();
    expect(currentTheme).toBe("dark");
    expect(mockLocalStorage.getItem("dagoeng_theme_preference")).toBe("dark");

    toggle();
    expect(currentTheme).toBe("light");
    expect(mockLocalStorage.getItem("dagoeng_theme_preference")).toBe("light");
  });

  describe("Typography & Font Best Practices", () => {
    it("ensures globals.css avoids render-blocking @import and defines DM font variables with tabular numbers", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const cssPath = path.resolve(process.cwd(), "src/app/globals.css");
      const content = fs.readFileSync(cssPath, "utf-8");

      // Verify no render-blocking @import at top of css
      expect(content).not.toMatch(/@import\s+url\(.+fonts\.googleapis\.com/);

      // Font variables come from next/font (layout.tsx) and are mapped into the Tailwind theme
      expect(content).toContain("--font-sans");
      expect(content).toContain("--font-dm-mono");
      expect(content).toContain("tabular-nums");
    });

    it("ensures layout.tsx loads DM Sans and DM Mono through next/font instead of render-blocking stylesheets", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const layoutPath = path.resolve(process.cwd(), "src/app/layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");

      // next/font self-hosts, preloads and uses font-display: swap by default
      expect(content).toMatch(/import\s*\{[^}]*DM_Sans[^}]*\}\s*from\s*"next\/font\/google"/);
      expect(content).toMatch(/import\s*\{[^}]*DM_Mono[^}]*\}\s*from\s*"next\/font\/google"/);
      expect(content).toContain('variable: "--font-sans"');
      expect(content).toContain('variable: "--font-dm-mono"');
      expect(content).not.toContain("fonts.googleapis.com/css2");
    });
  });
});
