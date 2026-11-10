import { describe, it, expect } from "vitest";
import {
  INITIAL_INGREDIENTS,
  INITIAL_RECIPES,
  deductRecipeIngredients,
  deductOrderItemsBOM,
} from "@/features/inventory/inventory-data";

describe("POS B4: Pengurangan Stok & BOM Resep (POS-36, TC-G01, TC-G02, TC-K07)", () => {
  it("B4.1 (TC-G01): Jual 1 Kopi Senja Aren memotong seluruh bahan baku formula resep", () => {
    const ksaRecipe = INITIAL_RECIPES.find((r) => r.menuId === "m-1");
    expect(ksaRecipe).toBeDefined();

    const { updatedStock, logs } = deductRecipeIngredients(
      INITIAL_INGREDIENTS,
      ksaRecipe!,
      1
    );

    const kopi = updatedStock.find((i) => i.id === "ing-2");
    const susu = updatedStock.find((i) => i.id === "ing-1");
    const gula = updatedStock.find((i) => i.id === "ing-3");
    const cup = updatedStock.find((i) => i.id === "ing-8");

    // ing-2 Biji Kopi: 10.0 - 0.018 = 9.982 kg
    expect(kopi?.stockNumber).toBe(9.982);
    // ing-1 Susu Fresh Milk: 20.0 - 0.12 = 19.88 Liter
    expect(susu?.stockNumber).toBe(19.88);
    // ing-3 Gula Aren: 10.0 - 0.02 = 9.98 Liter
    expect(gula?.stockNumber).toBe(9.98);
    // ing-8 Cup: 300 - 1 = 299 Pcs
    expect(cup?.stockNumber).toBe(299);

    expect(logs).toHaveLength(4);
  });

  it("B4.2 (TC-G02): Modifier Oat Milk menggantikan susu segar Greenfield dengan Oat Milk pada pemotongan stok", () => {
    const ksaRecipe = INITIAL_RECIPES.find((r) => r.menuId === "m-1");
    expect(ksaRecipe).toBeDefined();

    const { updatedStock, logs } = deductRecipeIngredients(
      INITIAL_INGREDIENTS,
      ksaRecipe!,
      1,
      ["Ganti Susu Oat (Oat Milk)"]
    );

    const freshMilk = updatedStock.find((i) => i.id === "ing-1");
    const oatMilk = updatedStock.find((i) => i.id === "ing-9");

    // Fresh milk remains untouched at 20.0
    expect(freshMilk?.stockNumber).toBe(20.0);
    // Oat milk (ing-9) is deducted by 0.12 L (15.0 - 0.12 = 14.88)
    expect(oatMilk?.stockNumber).toBe(14.88);

    const oatLog = logs.find((l) => l.ingredientId === "ing-9");
    expect(oatLog).toBeDefined();
    expect(oatLog?.delta).toBe(-0.12);
  });

  it("B4.3: Modifier Extra Espresso Shot menambahkan pemotongan biji kopi tambahan 18g", () => {
    const ksaRecipe = INITIAL_RECIPES.find((r) => r.menuId === "m-1");
    expect(ksaRecipe).toBeDefined();

    const { updatedStock } = deductRecipeIngredients(
      INITIAL_INGREDIENTS,
      ksaRecipe!,
      1,
      ["Extra Espresso Shot"]
    );

    const kopi = updatedStock.find((i) => i.id === "ing-2");
    // Standard 0.018 + Extra 0.018 = 0.036 kg (10.0 - 0.036 = 9.964)
    expect(kopi?.stockNumber).toBe(9.964);
  });

  it("B4.4 (TC-G01 / ORD-POS-5612 Repro): Pesanan multi-item memotong Kopi Senja dan Croissant secara atomik tanpa saling menimpa", () => {
    const orderItems = [
      {
        productName: "Kopi Senja Aren",
        quantity: 1,
        modifiers: ["Regular (250ml)"],
      },
      {
        productName: "Butter Croissant",
        quantity: 1,
        modifiers: [],
      },
    ];

    const { updatedStock, logs, deductedCount } = deductOrderItemsBOM(
      INITIAL_INGREDIENTS,
      INITIAL_RECIPES,
      orderItems
    );

    expect(deductedCount).toBe(2);

    // Kopi Senja Aren ingredients MUST be deducted
    const kopi = updatedStock.find((i) => i.id === "ing-2");
    const susu = updatedStock.find((i) => i.id === "ing-1");
    const gula = updatedStock.find((i) => i.id === "ing-3");
    const cup = updatedStock.find((i) => i.id === "ing-8");

    expect(kopi?.stockNumber).toBe(9.982);
    expect(susu?.stockNumber).toBe(19.88);
    expect(gula?.stockNumber).toBe(9.98);
    expect(cup?.stockNumber).toBe(299);

    // Croissant ingredient MUST ALSO be deducted (-0.1 pack dough)
    const dough = updatedStock.find((i) => i.id === "ing-7");
    expect(dough?.stockNumber).toBe(9.9);

    // Total 4 coffee ingredients + 1 pastry ingredient = 5 logs
    expect(logs).toHaveLength(5);
  });

  it("B4.5 (TC-K07): Seluruh produk aktif (Classic Americano, Artisan Tea, Wagyu Beef Bowl) memotong bahan sesuai BOM", () => {
    const orderItems = [
      { productName: "Classic Americano", quantity: 2 },
      { productName: "Artisan Peach White Tea", quantity: 1 },
      { productName: "Signature Wagyu Beef Bowl", quantity: 1 },
    ];

    const { updatedStock, deductedCount } = deductOrderItemsBOM(
      INITIAL_INGREDIENTS,
      INITIAL_RECIPES,
      orderItems
    );

    expect(deductedCount).toBe(3);

    // Americano: 2x 0.018 = 0.036 kg coffee, 2 cups
    const kopi = updatedStock.find((i) => i.id === "ing-2");
    expect(kopi?.stockNumber).toBe(9.964);

    // Tea: 1x 0.04 botol sirup peach
    const peach = updatedStock.find((i) => i.id === "ing-4");
    expect(peach?.stockNumber).toBe(7.96);

    // Wagyu Beef Bowl: 1x 0.12 kg wagyu, 0.03 karung beras
    const wagyu = updatedStock.find((i) => i.id === "ing-5");
    const beras = updatedStock.find((i) => i.id === "ing-6");
    expect(wagyu?.stockNumber).toBe(14.88);
    expect(beras?.stockNumber).toBe(9.97);

    // Cups: 2 (Americano) + 1 (Tea) = 3 cups (300 - 3 = 297)
    const cup = updatedStock.find((i) => i.id === "ing-8");
    expect(cup?.stockNumber).toBe(297);
  });
});
