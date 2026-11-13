"use client";

import { useEffect } from "react";

import type { BusinessUnit } from "@/components/app/unit-dot";
import { createUnitScopeRegistry, type UnitScopeRegistry } from "@/components/app/unit-scope-registry";

let registry: UnitScopeRegistry | null = null;

/** One registry per document, created on first use so server rendering never touches `document`. */
function getRegistry(): UnitScopeRegistry {
  registry ??= createUnitScopeRegistry(document.documentElement);
  return registry;
}

/**
 * Mirrors a page's business unit onto <html data-unit>. Dialogs, sheets and menus
 * render in a portal outside the page wrapper, so only the root element reaches
 * them. Renders nothing; the wrapper `data-unit` on the page still paints the
 * first frame before this effect runs. Scopes can nest (POS mode inside the page
 * scope); the registry keeps them from clobbering each other on unmount.
 */
export function UnitScope({ unit }: { unit: BusinessUnit | undefined }) {
  useEffect(() => {
    if (!unit) return;
    return getRegistry().claim(unit);
  }, [unit]);

  return null;
}
