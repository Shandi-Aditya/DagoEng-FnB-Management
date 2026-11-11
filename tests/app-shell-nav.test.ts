import { describe, expect, it } from "vitest";

import { ALL_NAV_ITEMS, type NavigationItem } from "@/lib/rbac";
import { findActiveNavItem, groupNavItems } from "@/features/layout/nav-groups";

function item(name: string, href: string): NavigationItem {
  return { name, href, icon: "LayoutDashboard", module: "CORE", allowedRoles: ["SUPER_ADMIN"] };
}

describe("groupNavItems", () => {
  it("places every known navigation item in exactly one group", () => {
    const groups = groupNavItems(ALL_NAV_ITEMS);
    const grouped = groups.flatMap((group) => group.items.map((navItem) => navItem.href));

    expect(grouped).toHaveLength(ALL_NAV_ITEMS.length);
    expect(new Set(grouped).size).toBe(ALL_NAV_ITEMS.length);
    expect(groups.find((group) => group.id === "other")).toBeUndefined();
  });

  it("orders groups as overview, F&B, space, event, admin", () => {
    const ids = groupNavItems(ALL_NAV_ITEMS).map((group) => group.id);

    expect(ids).toEqual(["overview", "fnb", "space", "event", "admin"]);
  });

  it("uses sentence case labels, allowing short acronyms like F&B", () => {
    for (const group of groupNavItems(ALL_NAV_ITEMS)) {
      const isAcronym = /^[A-Z&]{1,4}$/.test(group.label);
      if (!isAcronym) {
        expect(group.label).toMatch(/^[A-Z][^A-Z]*$/);
      }
    }
  });

  it("links business groups to their unit color", () => {
    const groups = groupNavItems(ALL_NAV_ITEMS);

    expect(groups.find((group) => group.id === "fnb")?.unit).toBe("fnb");
    expect(groups.find((group) => group.id === "space")?.unit).toBe("coworking");
    expect(groups.find((group) => group.id === "event")?.unit).toBe("event");
    expect(groups.find((group) => group.id === "overview")?.unit).toBeUndefined();
  });

  it("drops empty groups for roles with few menu items", () => {
    const cashierItems = [item("POS Kasir", "/pos"), item("Pesanan", "/orders")];

    const groups = groupNavItems(cashierItems);

    expect(groups.map((group) => group.id)).toEqual(["fnb"]);
    expect(groups[0].items.map((navItem) => navItem.href)).toEqual(["/pos", "/orders"]);
  });

  it("keeps unknown routes in a trailing other group", () => {
    const groups = groupNavItems([item("Dashboard", "/dashboard"), item("Baru", "/fitur-baru")]);

    expect(groups.map((group) => group.id)).toEqual(["overview", "other"]);
    expect(groups[1].items[0].href).toBe("/fitur-baru");
  });
});

describe("findActiveNavItem", () => {
  const items = [
    item("Dashboard", "/dashboard"),
    item("Self-order", "/customer"),
    item("Pelanggan", "/customers"),
    item("Event", "/events-admin"),
    item("Check-in", "/events/checkin"),
  ];

  it("matches the exact route", () => {
    expect(findActiveNavItem(items, "/dashboard")?.href).toBe("/dashboard");
  });

  it("matches nested routes of an item", () => {
    expect(findActiveNavItem(items, "/customers/123")?.href).toBe("/customers");
  });

  it("does not treat /customers as a child of /customer", () => {
    expect(findActiveNavItem(items, "/customers")?.href).toBe("/customers");
  });

  it("returns undefined when no item matches", () => {
    expect(findActiveNavItem(items, "/tidak-ada")).toBeUndefined();
  });
});
