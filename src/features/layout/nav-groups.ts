import type { BusinessUnit } from "@/components/app/unit-dot";
import type { NavigationItem } from "@/lib/rbac";

export interface NavGroup {
  id: string;
  label: string;
  /** Business unit whose logo color marks this group */
  unit?: BusinessUnit;
  items: NavigationItem[];
}

interface NavGroupDefinition {
  id: string;
  label: string;
  unit?: BusinessUnit;
  hrefs: readonly string[];
}

// Sidebar sections, in display order. Labels are sentence case (docs/DESIGN_SYSTEM.md).
const NAV_GROUP_DEFINITIONS: readonly NavGroupDefinition[] = [
  { id: "overview", label: "Ringkasan", hrefs: ["/dashboard"] },
  {
    id: "fnb",
    label: "F&B",
    unit: "fnb",
    hrefs: ["/pos", "/orders", "/tables", "/kitchen", "/inventory", "/customers", "/customer"],
  },
  { id: "space", label: "Ruang & tenant", unit: "coworking", hrefs: ["/coworking", "/commercial"] },
  { id: "event", label: "Event", unit: "event", hrefs: ["/events-admin", "/events/checkin"] },
  {
    id: "admin",
    label: "Laporan & administrasi",
    hrefs: ["/reports", "/employees", "/activity-log", "/settings"],
  },
];

const OTHER_GROUP_LABEL = "Lainnya";

/** Groups authorized navigation items into sidebar sections, keeping item order and dropping empty sections. */
export function groupNavItems(items: readonly NavigationItem[]): NavGroup[] {
  const knownHrefs = new Set(NAV_GROUP_DEFINITIONS.flatMap((definition) => definition.hrefs));

  const groups: NavGroup[] = NAV_GROUP_DEFINITIONS.map((definition) => ({
    id: definition.id,
    label: definition.label,
    unit: definition.unit,
    items: items.filter((item) => definition.hrefs.includes(item.href)),
  }));

  const otherItems = items.filter((item) => !knownHrefs.has(item.href));
  if (otherItems.length > 0) {
    groups.push({ id: "other", label: OTHER_GROUP_LABEL, items: otherItems });
  }

  return groups.filter((group) => group.items.length > 0);
}

function matchesRoute(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Finds the navigation item for the current path. Segment-aware, longest match wins. */
export function findActiveNavItem(
  items: readonly NavigationItem[],
  pathname: string,
): NavigationItem | undefined {
  return items
    .filter((item) => matchesRoute(item.href, pathname))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

/**
 * Business unit that owns a dashboard route, or undefined for neutral routes
 * (overview, reports, settings). Drives the `data-unit` accent scope, so the
 * sidebar and page filters share one orange / blue / green per unit.
 */
export function unitForPath(pathname: string): BusinessUnit | undefined {
  return NAV_GROUP_DEFINITIONS.flatMap((definition) =>
    definition.hrefs.map((href) => ({ href, unit: definition.unit })),
  )
    .filter(({ href }) => matchesRoute(href, pathname))
    .sort((a, b) => b.href.length - a.href.length)[0]?.unit;
}
