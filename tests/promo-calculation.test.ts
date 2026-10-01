import { expect, test, describe } from 'vitest';
import { calculateOrderPricing, PromoConfig, OrderItemInput } from '../src/lib/promo';

describe('Promo Calculation Logic', () => {
  const items: OrderItemInput[] = [
    { productId: 'p-1', category: 'COFFEE', tenantId: 't-1', quantity: 2, unitPrice: 24000 },
    { productId: 'p-2', category: 'FOOD', tenantId: 't-2', quantity: 1, unitPrice: 20000 }
  ]; // Total = 48000 + 20000 = 68000

  test('1. Promo ALL diterapkan', () => {
    const promo: PromoConfig = { id: 'p1', name: 'Disc 10%', discountType: 'PERCENTAGE', discountValue: 10, targetType: 'ALL', isActive: true };
    const res = calculateOrderPricing(items, promo);
    expect(res.discountAmount).toBe(6800);
  });

  test('2. Promo PRODUCT hanya berlaku pada produk target', () => {
    const promo: PromoConfig = { id: 'p2', name: 'Promo Kopi', discountType: 'FIXED', discountValue: 10000, targetType: 'PRODUCT', targetId: 'p-1', isActive: true };
    const res = calculateOrderPricing(items, promo);
    expect(res.discountAmount).toBe(10000); // fixed
  });

  test('3. Promo CATEGORY hanya berlaku pada kategori target', () => {
    const promo: PromoConfig = { id: 'p3', name: 'Promo Makanan', discountType: 'PERCENTAGE', discountValue: 50, targetType: 'CATEGORY', targetId: 'FOOD', isActive: true };
    const res = calculateOrderPricing(items, promo);
    expect(res.discountAmount).toBe(10000); // 50% of 20000
  });

  test('4. Promo TENANT hanya berlaku pada produk mitra target', () => {
    const promo: PromoConfig = { id: 'p4', name: 'Promo Tenant 1', discountType: 'PERCENTAGE', discountValue: 10, targetType: 'TENANT', targetId: 't-1', isActive: true };
    const res = calculateOrderPricing(items, promo);
    expect(res.discountAmount).toBe(4800); // 10% of 48000
  });

  test('5. Promo minimum transaksi', () => {
    const promoValid: PromoConfig = { id: 'p5a', name: 'Min 50k', discountType: 'FIXED', discountValue: 5000, targetType: 'ALL', minimumAmount: 50000, isActive: true };
    const res1 = calculateOrderPricing(items, promoValid);
    expect(res1.discountAmount).toBe(5000);

    const promoInvalid: PromoConfig = { id: 'p5b', name: 'Min 100k', discountType: 'FIXED', discountValue: 5000, targetType: 'ALL', minimumAmount: 100000, isActive: true };
    const res2 = calculateOrderPricing(items, promoInvalid);
    expect(res2.discountAmount).toBe(0);
  });

  test('6. Promo inactive/expired tidak diterapkan', () => {
    const inactivePromo: PromoConfig = { id: 'p6a', name: 'Inactive', discountType: 'PERCENTAGE', discountValue: 50, targetType: 'ALL', isActive: false };
    const res1 = calculateOrderPricing(items, inactivePromo);
    expect(res1.discountAmount).toBe(0);

    const expiredPromo: PromoConfig = { 
      id: 'p6b', 
      name: 'Expired', 
      discountType: 'FIXED', 
      discountValue: 20000, 
      targetType: 'ALL',
      isActive: true, 
      validUntil: '2020-01-01T00:00:00Z' // Past date
    };
    const res2 = calculateOrderPricing(items, expiredPromo);
    expect(res2.discountAmount).toBe(0);
  });

  test('7. Tidak ada promo', () => {
    const res = calculateOrderPricing(items);
    expect(res.discountAmount).toBe(0);
    expect(res.total).toBe(74800); // 68000 + 10% tax
  });
});
