import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { POST as selfOrderPost } from "@/app/api/orders/self-order/route";
import {
  buildCustomerCartItemFromPos,
  calculateCartTotals,
  decrementCustomerCartByProduct,
  decrementCustomerCartLine,
  formatCustomerCartItemOptions,
  getCustomerCartItemKey,
  getCustomerCartItemUnitPrice,
  incrementCustomerCartLine,
  resolveCustomerInitialView,
  resolveCustomerProductOptions,
  toCustomerPosProductItem,
  upsertCustomerCartItem,
  type CustomerCartItem,
} from "@/features/customer/customer-domain";
import { calculateItemFinalPrice } from "@/features/pos/pos-catalog";
import { INITIAL_PRODUCTS } from "@/lib/master-data-defaults";

function findProduct(id: string) {
  const found = INITIAL_PRODUCTS.find((p) => p.id === id);
  if (!found) throw new Error(`Missing product ${id} in INITIAL_PRODUCTS`);
  return found;
}

describe("Customer portal tab order, product photos, and cashier-parity options", () => {
  describe("1. Initial view resolution & navigation order", () => {
    it("defaults to coworking space when no tab or meja param is given", () => {
      expect(resolveCustomerInitialView(null)).toBe("space");
      expect(resolveCustomerInitialView(null, null)).toBe("space");
      expect(resolveCustomerInitialView("", "")).toBe("space");
    });

    it("routes legacy and explicit tab params accurately", () => {
      expect(resolveCustomerInitialView("MENU")).toBe("order");
      expect(resolveCustomerInitialView("order")).toBe("order");
      expect(resolveCustomerInitialView("fnb")).toBe("order");
      expect(resolveCustomerInitialView("COWORKING")).toBe("space");
      expect(resolveCustomerInitialView("space")).toBe("space");
      expect(resolveCustomerInitialView("ORDERS")).toBe("activity");
      expect(resolveCustomerInitialView("activity")).toBe("activity");
      expect(resolveCustomerInitialView("LOYALTY")).toBe("account");
      expect(resolveCustomerInitialView("PROFILE")).toBe("account");
      expect(resolveCustomerInitialView("account")).toBe("account");
    });

    it("opens order view for table QR links when no explicit tab is given, while explicit tab wins", () => {
      expect(resolveCustomerInitialView(null, "T-04")).toBe("order");
      expect(resolveCustomerInitialView("COWORKING", "T-04")).toBe("space");
    });

    it("puts Ruang (coworking) first in CustomerShell bottom navigation", () => {
      const shellSrc = fs.readFileSync(
        path.resolve(process.cwd(), "src/features/customer/app/CustomerShell.tsx"),
        "utf-8",
      );
      const navMatches = Array.from(shellSrc.matchAll(/\{\s*id:\s*"([^"]+)"/g)).map((m) => m[1]);
      expect(navMatches).toEqual(["space", "order", "activity", "account"]);
    });
  });

  describe("2. Product option resolution parity with POS", () => {
    it("resolves variants and category/POS modifier groups for customizable items", () => {
      const kopi = findProduct("prod-101"); // Kopi Senja Aren
      const kopiOpts = resolveCustomerProductOptions(kopi);
      expect(kopiOpts.hasOptions).toBe(true);
      expect(kopiOpts.variants.some((v) => v.name === "Large (+5k)" && v.priceAdjustment === 5000)).toBe(true);
      expect(kopiOpts.modifierGroups.some((g) => g.name === "Pilihan Susu")).toBe(true);

      const nasiAyam = findProduct("prod-109"); // Nasi Ayam Sambal Matah (modifiers only, no variants)
      const nasiOpts = resolveCustomerProductOptions(nasiAyam);
      expect(nasiOpts.hasOptions).toBe(true);
      expect(nasiOpts.variants).toHaveLength(0);
      expect(nasiOpts.modifierGroups.some((g) => g.name === "Level Pedas")).toBe(true);
    });

    it("flags plain items without variants or modifiers as hasOptions=false", () => {
      const bananaBread = findProduct("prod-113"); // Banana Bread Slice
      const breadOpts = resolveCustomerProductOptions(bananaBread);
      expect(breadOpts.variants).toHaveLength(0);
      expect(breadOpts.modifierGroups).toHaveLength(0);
      expect(breadOpts.hasOptions).toBe(false);
    });

    it("maps MasterProduct cleanly to POSProductItem for ModifierModal", () => {
      const kopi = findProduct("prod-101");
      const posItem = toCustomerPosProductItem(kopi);
      expect(posItem.id).toBe(kopi.id);
      expect(posItem.basePrice).toBe(kopi.basePrice);
      expect(posItem.variants?.length).toBeGreaterThan(0);
      expect(posItem.modifierGroups?.length).toBeGreaterThan(0);
    });
  });

  describe("3. Customized cart line management & pricing", () => {
    const kopi = findProduct("prod-101"); // basePrice 24.000
    const bananaBread = findProduct("prod-113"); // basePrice 18.000

    it("keeps different option combinations separate and merges identical combinations", () => {
      const regularCold = buildCustomerCartItemFromPos(kopi, {
        cartItemId: "c1",
        productId: kopi.id,
        productName: kopi.name,
        quantity: 1,
        basePrice: kopi.basePrice,
        selectedVariant: { name: "Regular", priceAdjustment: 0 },
        selectedModifiers: [{ name: "Less Sugar (50%)", price: 0 }],
        unitFinalPrice: 24000,
        itemTotal: 24000,
      });

      const largeOat = buildCustomerCartItemFromPos(kopi, {
        cartItemId: "c2",
        productId: kopi.id,
        productName: kopi.name,
        quantity: 2,
        basePrice: kopi.basePrice,
        selectedVariant: { name: "Large (+5k)", priceAdjustment: 5000 },
        selectedModifiers: [{ name: "Oat Milk (+Rp 8.000)", price: 8000 }],
        notes: "Es sedikit",
        unitFinalPrice: 37000,
        itemTotal: 74000,
      });

      let cart: CustomerCartItem[] = [];
      cart = upsertCustomerCartItem(cart, regularCold);
      cart = upsertCustomerCartItem(cart, largeOat);
      expect(cart).toHaveLength(2);

      // Merging same variant + modifier + note increments quantity instead of adding duplicate row
      cart = upsertCustomerCartItem(cart, { ...regularCold, quantity: 1 });
      expect(cart).toHaveLength(2);
      expect(cart[0].quantity).toBe(2);
      expect(cart[1].quantity).toBe(2);

      expect(formatCustomerCartItemOptions(cart[1])).toBe("Large (+5k) · Oat Milk (+Rp 8.000)");
      expect(getCustomerCartItemUnitPrice(cart[1])).toBe(37000);

      const totals = calculateCartTotals(cart, { isDineIn: false, taxRatePercent: 0, serviceChargePercent: 0 });
      expect(totals.subtotal).toBe(2 * 24000 + 2 * 37000);
      expect(totals.finalTotal).toBe(122000);

      const largeKey = getCustomerCartItemKey(cart[1]);
      cart = incrementCustomerCartLine(cart, largeKey);
      expect(cart[1].quantity).toBe(3);

      cart = decrementCustomerCartLine(cart, largeKey);
      expect(cart[1].quantity).toBe(2);

      // Menu stepper decrement targets the latest matching product line
      cart = decrementCustomerCartByProduct(cart, kopi.id);
      expect(cart[1].quantity).toBe(1);

      // Plain item without options still works cleanly
      cart = upsertCustomerCartItem(cart, { product: bananaBread, quantity: 1 });
      expect(cart).toHaveLength(3);
      expect(getCustomerCartItemUnitPrice(cart[2])).toBe(18000);
    });
  });

  describe("4. Server /api/orders/self-order authoritative price parity", () => {
    let tempDir = "";
    let prevDataDir: string | undefined;

    beforeEach(() => {
      prevDataDir = process.env.DATA_DIR_OVERRIDE;
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cust-menu-opts-"));
      process.env.DATA_DIR_OVERRIDE = tempDir;
    });

    afterEach(() => {
      if (prevDataDir === undefined) delete process.env.DATA_DIR_OVERRIDE;
      else process.env.DATA_DIR_OVERRIDE = prevDataDir;
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("computes identical unitPrice server-side for customer-selected variants and modifiers", async () => {
      const kopi = findProduct("prod-101"); // basePrice 24.000
      // Large (+5.000) + Oat Milk (+8.000) + Extra Espresso Shot (+6.000) = 43.000
      const { unitFinalPrice } = calculateItemFinalPrice(kopi.basePrice, 5000, 8000 + 6000, 1);
      expect(unitFinalPrice).toBe(43000);

      const req = new NextRequest("http://localhost:3000/api/orders/self-order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          order: {
            id: "ord-cust-opts-1",
            tableNumber: "T-02",
            customerName: "Rani",
            customerPhone: "08123456789",
            orderType: "TAKEAWAY",
            paymentMethod: "QRIS",
            items: [
              {
                id: "it-1",
                productId: kopi.id,
                productName: kopi.name,
                quantity: 1,
                unitPrice: unitFinalPrice,
                modifiers: ["Large (+5k)", "Oat Milk (+Rp 8.000)", "Extra Espresso Shot"],
                notes: "Pisahkan es",
              },
            ],
          },
        }),
      });

      const res = await selfOrderPost(req);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        order: { items: Array<{ unitPrice: number; modifiers?: string[]; notes?: string }>; subtotal: number };
      };
      expect(json.success).toBe(true);
      expect(json.order.items[0].unitPrice).toBe(43000);
      expect(json.order.items[0].modifiers).toEqual([
        "Large (+5k)",
        "Oat Milk (+Rp 8.000)",
        "Extra Espresso Shot",
      ]);
      expect(json.order.items[0].notes).toBe("Pisahkan es");
      expect(json.order.subtotal).toBe(43000);
    });
  });
});
