import { describe, it, expect } from "vitest";
import {
  INITIAL_INGREDIENTS,
  INITIAL_RECIPES,
  deductRecipeIngredients,
  deductOrderItemsBOM,
} from "@/features/inventory/inventory-data";
import { INITIAL_PRODUCTS } from "@/lib/master-data-defaults";

describe("Task V-11: Pengurangan Stok Bahan Sesuai Resep (BOM) untuk Semua Menu Aktif", () => {
  it("V-11.1: Jual 1 unit tiap menu aktif -> stok bahan berkurang sesuai resep (Kriteria Selesai V-11)", () => {
    const activeProducts = INITIAL_PRODUCTS.filter((p) => p.status === "ACTIVE");
    expect(activeProducts.length).toBe(16);

    const orderItems = activeProducts.map((p) => ({
      productId: p.id,
      productName: p.name,
      quantity: 1,
    }));

    const { updatedStock, deductedCount, logs } = deductOrderItemsBOM(
      INITIAL_INGREDIENTS,
      INITIAL_RECIPES,
      orderItems
    );

    // Semua 16 menu aktif wajib berhasil dipotong stoknya
    expect(deductedCount).toBe(activeProducts.length);
    expect(logs.length).toBeGreaterThanOrEqual(activeProducts.length);

    // Verifikasi pemotongan stok pada bahan baku representatif:
    // 1. Kopi Senja Aren / Americano (Biji Kopi House Blend)
    const kopi = updatedStock.find((i) => i.id === "ing-2");
    expect(kopi?.stockNumber).toBeLessThan(10.0);

    // 2. Kopi Senja Aren / Matcha Latte (Susu Fresh Milk Greenfield)
    const susu = updatedStock.find((i) => i.id === "ing-1");
    expect(susu?.stockNumber).toBeLessThan(20.0);

    // 3. Wagyu Beef Bowl (Daging Sapi Wagyu Slice & Beras Jepang)
    const wagyu = updatedStock.find((i) => i.id === "ing-5");
    const beras = updatedStock.find((i) => i.id === "ing-6");
    expect(wagyu?.stockNumber).toBeLessThan(15.0);
    expect(beras?.stockNumber).toBeLessThan(10.0);

    // 4. Croissant (Dough French Butter Croissant)
    const dough = updatedStock.find((i) => i.id === "ing-7");
    expect(dough?.stockNumber).toBeLessThan(10.0);

    // 5. Truffle Parmesan & French Fries (Kentang Goreng)
    const kentang = updatedStock.find((i) => i.id === "ing-11");
    expect(kentang?.stockNumber).toBeLessThan(20.0);

    // 6. Nasi Ayam Sambal Matah & Nasi Ayam Kremes (Daging Ayam Fillet)
    const ayam = updatedStock.find((i) => i.id === "ing-12");
    expect(ayam?.stockNumber).toBeLessThan(15.0);

    // 7. Mie Goreng Jawa (Mie Telur Basah)
    const mie = updatedStock.find((i) => i.id === "ing-13");
    expect(mie?.stockNumber).toBeLessThan(12.0);

    // 8. Es Jeruk Peras (Jeruk Peras Segar)
    const jeruk = updatedStock.find((i) => i.id === "ing-14");
    expect(jeruk?.stockNumber).toBeLessThan(15.0);

    // 9. Tempe Mendoan (Tempe Kedelai Segar)
    const tempe = updatedStock.find((i) => i.id === "ing-18");
    expect(tempe?.stockNumber).toBeLessThan(20.0);

    // 10. Es Teh Manis Melati (Daun Teh Melati)
    const teh = updatedStock.find((i) => i.id === "ing-19");
    expect(teh?.stockNumber).toBeLessThan(6.0);
  });

  it("V-11.2: Varian minuman (Large, 1 Liter) dan makanan (Double Meat) menyesuaikan takaran bahan", () => {
    const ksaRecipe = INITIAL_RECIPES.find((r) => r.menuId === "m-1");
    expect(ksaRecipe).toBeDefined();

    // Varian Large (+5k): takaran susu dan kopi berskala 1.5x (18g -> 27g kopi; 120ml -> 180ml susu)
    const { updatedStock: largeStock } = deductRecipeIngredients(
      INITIAL_INGREDIENTS,
      ksaRecipe!,
      1,
      ["Large (+5k)"]
    );
    const largeKopi = largeStock.find((i) => i.id === "ing-2");
    const largeSusu = largeStock.find((i) => i.id === "ing-1");
    const largeCup = largeStock.find((i) => i.id === "ing-8");
    expect(largeKopi?.stockNumber).toBeCloseTo(10.0 - 0.018 * 1.5, 3);
    expect(largeSusu?.stockNumber).toBeCloseTo(20.0 - 0.12 * 1.5, 3);
    // Cup tetap berkurang 1 pcs
    expect(largeCup?.stockNumber).toBe(299);

    // Varian 1 Liter Bottle: takaran berskala 4x
    const { updatedStock: literStock } = deductRecipeIngredients(
      INITIAL_INGREDIENTS,
      ksaRecipe!,
      1,
      ["1 Liter Bottle (+45k)"]
    );
    const literSusu = literStock.find((i) => i.id === "ing-1");
    const literKopi = literStock.find((i) => i.id === "ing-2");
    expect(literSusu?.stockNumber).toBeCloseTo(20.0 - 0.12 * 4, 3);
    expect(literKopi?.stockNumber).toBeCloseTo(10.0 - 0.018 * 4, 3);

    // Varian Double Beef (+15k) pada Wagyu Beef Bowl: daging berskala 2x (0.12kg -> 0.24kg)
    const beefRecipe = INITIAL_RECIPES.find((r) => r.menuId === "m-3")!;
    const { updatedStock: doubleBeefStock } = deductRecipeIngredients(
      INITIAL_INGREDIENTS,
      beefRecipe,
      1,
      ["Double Beef (+15k)"]
    );
    const doubleWagyu = doubleBeefStock.find((i) => i.id === "ing-5");
    expect(doubleWagyu?.stockNumber).toBeCloseTo(15.0 - 0.12 * 2, 3);
  });

  it("V-11.3: Modifier substitusi Oat Milk memotong Susu Oat Milk dan membiarkan Susu Fresh Milk utuh", () => {
    const ksaRecipe = INITIAL_RECIPES.find((r) => r.menuId === "m-1");
    const { updatedStock } = deductRecipeIngredients(
      INITIAL_INGREDIENTS,
      ksaRecipe!,
      1,
      ["Oat Milk (+Rp 8.000)"]
    );

    const freshMilk = updatedStock.find((i) => i.id === "ing-1");
    const oatMilk = updatedStock.find((i) => i.id === "ing-9");

    expect(freshMilk?.stockNumber).toBe(20.0);
    expect(oatMilk?.stockNumber).toBe(14.88);
  });

  it("V-11.4: Modifier Extra Espresso Shot menambahkan 18g biji kopi pada pesanan", () => {
    const ksaRecipe = INITIAL_RECIPES.find((r) => r.menuId === "m-1");
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
});
