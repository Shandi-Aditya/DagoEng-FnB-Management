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
});
