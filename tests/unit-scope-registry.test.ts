import { describe, expect, it } from "vitest";

import { createUnitScopeRegistry } from "@/components/app/unit-scope-registry";

function fakeRoot() {
  const attributes = new Map<string, string>();
  return {
    attributes,
    setAttribute: (name: string, value: string) => void attributes.set(name, value),
    removeAttribute: (name: string) => void attributes.delete(name),
  };
}

describe("createUnitScopeRegistry", () => {
  it("sets data-unit while a scope is mounted and removes it on release", () => {
    const root = fakeRoot();
    const registry = createUnitScopeRegistry(root);

    const release = registry.claim("fnb");
    expect(root.attributes.get("data-unit")).toBe("fnb");

    release();
    expect(root.attributes.has("data-unit")).toBe(false);
  });

  it("lets the most recent claim win and hands back to the earlier one", () => {
    const root = fakeRoot();
    const registry = createUnitScopeRegistry(root);

    const releasePage = registry.claim("fnb");
    const releaseMode = registry.claim("coworking");
    expect(root.attributes.get("data-unit")).toBe("coworking");

    releaseMode();
    expect(root.attributes.get("data-unit")).toBe("fnb");

    releasePage();
    expect(root.attributes.has("data-unit")).toBe(false);
  });

  it("clears the attribute when nested scopes unmount in either order", () => {
    // Regression: leaving /pos for a neutral page left data-unit="fnb" on <html>.
    for (const innerFirst of [true, false]) {
      const root = fakeRoot();
      const registry = createUnitScopeRegistry(root);

      const releasePage = registry.claim("fnb");
      const releaseMode = registry.claim("fnb");

      if (innerFirst) {
        releaseMode();
        releasePage();
      } else {
        releasePage();
        releaseMode();
      }

      expect(root.attributes.has("data-unit")).toBe(false);
    }
  });

  it("ignores a repeated release of the same claim", () => {
    const root = fakeRoot();
    const registry = createUnitScopeRegistry(root);

    const releasePage = registry.claim("event");
    const releaseOther = registry.claim("loyalty");

    releaseOther();
    releaseOther();

    expect(root.attributes.get("data-unit")).toBe("event");
    releasePage();
    expect(root.attributes.has("data-unit")).toBe(false);
  });
});
