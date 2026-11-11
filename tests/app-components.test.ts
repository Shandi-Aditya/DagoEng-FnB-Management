import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { formatChange } from "@/components/app/format-change";
import { StatCard } from "@/components/app/stat-card";
import { UnitDot, UNIT_LABELS } from "@/components/app/unit-dot";
import { StatusBadge } from "@/components/app/status-badge";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { notify } from "@/components/app/notify";
import { toast } from "@/components/ui/toast";

describe("formatChange", () => {
  it("adds a plus sign and the comparison for positive changes", () => {
    expect(formatChange(12, "bulan lalu")).toBe("+12% vs bulan lalu");
  });

  it("keeps the minus sign for negative changes", () => {
    expect(formatChange(-3.5, "minggu lalu")).toBe("-3,5% vs minggu lalu");
  });

  it("shows zero without a sign", () => {
    expect(formatChange(0, "kemarin")).toBe("0% vs kemarin");
  });

  it("rounds to one decimal using Indonesian formatting", () => {
    expect(formatChange(7.26, "bulan lalu")).toBe("+7,3% vs bulan lalu");
  });
});

describe("StatCard", () => {
  it("renders the label, the value with tabular figures and the change with its comparison", () => {
    const html = renderToStaticMarkup(
      createElement(StatCard, {
        label: "Total pendapatan",
        value: "Rp 432.200",
        change: { value: 12, comparison: "bulan lalu" },
      }),
    );

    expect(html).toContain("Total pendapatan");
    expect(html).toContain("Rp 432.200");
    expect(html).toContain("tabular-nums");
    expect(html).toContain("+12% vs bulan lalu");
    expect(html).toContain("text-success");
  });

  it("marks a negative change with the destructive color", () => {
    const html = renderToStaticMarkup(
      createElement(StatCard, {
        label: "Pesanan batal",
        value: "4",
        change: { value: -8, comparison: "minggu lalu" },
      }),
    );

    expect(html).toContain("-8% vs minggu lalu");
    expect(html).toContain("text-destructive");
  });

  it("renders without a change row when no change is given", () => {
    const html = renderToStaticMarkup(createElement(StatCard, { label: "Unit aktif", value: "3" }));

    expect(html).toContain("Unit aktif");
    expect(html).not.toContain("vs ");
  });

  it("does not use uppercase labels", () => {
    const html = renderToStaticMarkup(createElement(StatCard, { label: "Total transaksi", value: "53" }));

    expect(html).not.toContain("uppercase");
  });
});

describe("UnitDot", () => {
  it("renders the unit color token and an accessible label", () => {
    const html = renderToStaticMarkup(createElement(UnitDot, { unit: "fnb" }));

    expect(html).toContain("bg-unit-fnb");
    // renderToStaticMarkup escapes "&" in attributes
    expect(html).toContain(`aria-label="${UNIT_LABELS.fnb.replace("&", "&amp;")}"`);
  });

  it("shows a visible label when requested", () => {
    const html = renderToStaticMarkup(createElement(UnitDot, { unit: "coworking", showLabel: true }));

    expect(html).toContain("bg-unit-coworking");
    expect(html).toContain(">Co-working<");
  });
});

describe("StatusBadge", () => {
  it.each([
    ["success", "text-success"],
    ["warning", "text-warning"],
    ["info", "text-info"],
    ["destructive", "text-destructive"],
  ] as const)("maps %s to its token color", (status, expected) => {
    const html = renderToStaticMarkup(createElement(StatusBadge, { status }, "Lunas"));

    expect(html).toContain(expected);
    expect(html).toContain("Lunas");
  });

  it("uses the neutral secondary style for neutral status", () => {
    const html = renderToStaticMarkup(createElement(StatusBadge, { status: "neutral" }, "Draf"));

    expect(html).toContain("bg-secondary");
  });
});

describe("PageHeader", () => {
  it("renders the title as an h1 with description and actions", () => {
    const html = renderToStaticMarkup(
      createElement(PageHeader, {
        title: "Ringkasan",
        description: "Outlet Singaraja · 1 Sep – 10 Nov 2026",
        actions: createElement("button", null, "Ekspor"),
      }),
    );

    expect(html).toMatch(/<h1[^>]*>Ringkasan<\/h1>/);
    expect(html).toContain("Outlet Singaraja");
    expect(html).toContain("Ekspor");
  });
});

describe("EmptyState", () => {
  it("renders the title, description and action", () => {
    const html = renderToStaticMarkup(
      createElement(EmptyState, {
        title: "Belum ada transaksi",
        description: "Transaksi di periode ini akan muncul di sini",
        action: createElement("button", null, "Buka POS"),
      }),
    );

    expect(html).toContain("Belum ada transaksi");
    expect(html).toContain("Transaksi di periode ini akan muncul di sini");
    expect(html).toContain("Buka POS");
  });
});

describe("notify", () => {
  it.each(["success", "error", "info", "warning"] as const)("forwards %s toasts to the toast manager", (type) => {
    const add = vi.spyOn(toast, "add").mockReturnValue("toast-id");

    notify[type]("Pembayaran berhasil", "Struk dikirim ke pelanggan");

    expect(add).toHaveBeenCalledWith({
      title: "Pembayaran berhasil",
      description: "Struk dikirim ke pelanggan",
      type,
    });
    add.mockRestore();
  });
});
