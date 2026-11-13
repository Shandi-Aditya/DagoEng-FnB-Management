"use client";

import { useEffect } from "react";

import type { BusinessUnit } from "@/components/app/unit-dot";

/**
 * Mirrors a page's business unit onto <html data-unit>. Dialogs, sheets and menus
 * render in a portal outside the page wrapper, so only the root element reaches
 * them. Renders nothing; the wrapper `data-unit` on the page still paints the
 * first frame before this effect runs.
 */
export function UnitScope({ unit }: { unit: BusinessUnit | undefined }) {
  useEffect(() => {
    if (!unit) return;

    const root = document.documentElement;
    const previous = root.dataset.unit;
    root.dataset.unit = unit;
    // Restore, not delete: a nested scope (POS mode) hands the value back to the page scope.
    return () => {
      if (previous === undefined) delete root.dataset.unit;
      else root.dataset.unit = previous;
    };
  }, [unit]);

  return null;
}
