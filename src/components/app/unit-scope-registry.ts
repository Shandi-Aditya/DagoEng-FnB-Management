import type { BusinessUnit } from "@/components/app/unit-dot";

/** The slice of an element the registry needs; <html> satisfies it. */
interface ScopeRoot {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

export interface UnitScopeRegistry {
  /** Marks `unit` as active on the root. Returns the function that withdraws this claim. */
  claim(unit: BusinessUnit): () => void;
}

const UNIT_ATTRIBUTE = "data-unit";

/**
 * Tracks which mounted scopes want a unit on the root. The newest claim wins; when
 * a claim is withdrawn the root falls back to the one before it, or loses the
 * attribute when none is left. Each claim is its own entry, so the order in which
 * nested scopes unmount cannot leave a stale unit behind (a "restore previous value"
 * scheme did exactly that: leaving /pos kept the F&B accent on neutral pages).
 */
export function createUnitScopeRegistry(root: ScopeRoot): UnitScopeRegistry {
  const claims: { unit: BusinessUnit }[] = [];

  const apply = () => {
    const current = claims[claims.length - 1];
    if (current) root.setAttribute(UNIT_ATTRIBUTE, current.unit);
    else root.removeAttribute(UNIT_ATTRIBUTE);
  };

  return {
    claim(unit) {
      const entry = { unit };
      claims.push(entry);
      apply();

      return () => {
        const index = claims.indexOf(entry);
        if (index === -1) return;
        claims.splice(index, 1);
        apply();
      };
    },
  };
}
