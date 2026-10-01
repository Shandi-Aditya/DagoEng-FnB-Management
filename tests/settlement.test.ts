import { expect, test, describe } from 'vitest';
import { calculateSettlement } from '../src/lib/settlement';
import { OrderRecord } from '../src/types/order';

describe('Settlement Calculation Logic', () => {
  const createMockOrder = (
    id: string, 
    paymentStatus: "PENDING" | "PAID" | "REFUNDED", 
    items: {tenantId?: string, qty: number, price: number}[],
    statusOverride?: OrderRecord["status"],
    tax: number = 0,
    discount: number = 0
  ): OrderRecord => {
    const subtotal = items.reduce((s, i) => s + (i.qty * i.price), 0);
    return {
      id,
      orderNumber: id,
      organizationId: "org-1",
      outletId: "out-1",
      outletName: "Outlet",
      tableNumber: "T1",
      customerName: "Test",
      orderType: "DINE_IN",
      status: statusOverride || (paymentStatus === "PAID" ? "COMPLETED" : "NEW"),
      paymentStatus,
      items: items.map((i, idx) => ({
        id: `it-${idx}`,
        productName: "Prod",
        tenantId: i.tenantId,
        quantity: i.qty,
        unitPrice: i.price,
      })),
      subtotal,
      tax,
      total: subtotal - discount + tax,
      targetServiceMinutes: 10,
      createdAt: new Date().toISOString(),
      statusHistory: []
    };
  };

  test('1. Order hanya berisi produk Dago (tanpa tenantId)', () => {
    const orders = [
      createMockOrder("o1", "PAID", [{qty: 2, price: 10000}])
    ];
    const res = calculateSettlement(orders);
    expect(res).toHaveLength(1);
    expect(res[0].tenantId).toBe("DAGO_HUB");
    expect(res[0].grossRevenue).toBe(20000);
  });

  test('2. Order hanya berisi produk mitra', () => {
    const orders = [
      createMockOrder("o1", "PAID", [{tenantId: "mitra-A", qty: 1, price: 30000}])
    ];
    const res = calculateSettlement(orders);
    expect(res).toHaveLength(1);
    expect(res[0].tenantId).toBe("mitra-A");
    expect(res[0].grossRevenue).toBe(30000);
  });

  test('3. Satu order berisi produk Dago + mitra', () => {
    const orders = [
      createMockOrder("o1", "PAID", [
        {tenantId: "mitra-A", qty: 2, price: 15000},
        {qty: 1, price: 20000} // Dago
      ])
    ];
    const res = calculateSettlement(orders);
    expect(res).toHaveLength(2);
    const mitraA = res.find(r => r.tenantId === "mitra-A");
    const dago = res.find(r => r.tenantId === "DAGO_HUB");
    
    expect(mitraA?.grossRevenue).toBe(30000);
    expect(dago?.grossRevenue).toBe(20000);
  });

  test('4. Quantity lebih dari 1 (sudah tercover di atas)', () => {
    const orders = [
      createMockOrder("o1", "PAID", [{tenantId: "mitra-B", qty: 5, price: 10000}])
    ];
    const res = calculateSettlement(orders);
    expect(res[0].grossRevenue).toBe(50000);
  });

  test('5. Order yang belum PAID tidak masuk settlement', () => {
    const orders = [
      createMockOrder("o1", "PENDING", [{tenantId: "mitra-C", qty: 1, price: 50000}])
    ];
    const res = calculateSettlement(orders);
    expect(res).toHaveLength(0);
  });

  test('6. Order status PAID tetapi CANCELLED tidak masuk settlement', () => {
    const orders = [
      createMockOrder("o1", "PAID", [{tenantId: "mitra-A", qty: 1, price: 50000}], "CANCELLED")
    ];
    const res = calculateSettlement(orders);
    expect(res).toHaveLength(0);
  });

  test('7. Order dengan paymentStatus REFUNDED tidak masuk settlement', () => {
    const orders = [
      createMockOrder("o1", "REFUNDED", [{tenantId: "mitra-A", qty: 1, price: 50000}])
    ];
    const res = calculateSettlement(orders);
    expect(res).toHaveLength(0);
  });

  test('8. Item dengan quantity 0 atau negatif diabaikan', () => {
    const orders = [
      createMockOrder("o1", "PAID", [
        {tenantId: "mitra-A", qty: 0, price: 50000},
        {tenantId: "mitra-A", qty: -2, price: 50000},
        {tenantId: "mitra-A", qty: 1, price: 25000},
      ])
    ];
    const res = calculateSettlement(orders);
    expect(res).toHaveLength(1);
    expect(res[0].grossRevenue).toBe(25000);
  });

  test('9. Item dengan unitPrice 0 atau tidak valid (NaN) diabaikan', () => {
    const orders = [
      createMockOrder("o1", "PAID", [
        {tenantId: "mitra-A", qty: 1, price: 0},
        {tenantId: "mitra-A", qty: 1, price: NaN},
        {tenantId: "mitra-A", qty: 2, price: 10000},
      ])
    ];
    const res = calculateSettlement(orders);
    expect(res).toHaveLength(1);
    expect(res[0].grossRevenue).toBe(20000);
  });

  test('10. Produk mitra dari data POS maintain tenantId sampai ke OrderItem', () => {
    const masterProducts = [
      {
        id: "prod-ks-1",
        name: "Kopi Senja Aren",
        category: "Kopi",
        basePrice: 24000,
        cogsEstimate: 10000,
        grossMarginPercent: 58,
        status: "ACTIVE",
        tenantId: "tenant-ks",
      },
    ];

    const posProducts = masterProducts.map((prod) => ({
      id: prod.id,
      tenantId: prod.tenantId,
      name: prod.name,
      category: prod.category,
      basePrice: prod.basePrice,
    }));

    expect(posProducts[0].tenantId).toBe("tenant-ks");

    const createdOrder = createMockOrder("pos-1", "PAID", [
      { tenantId: posProducts[0].tenantId, qty: 2, price: posProducts[0].basePrice },
    ]);

    const res = calculateSettlement([createdOrder]);
    expect(res).toHaveLength(1);
    expect(res[0].tenantId).toBe("tenant-ks");
    expect(res[0].grossRevenue).toBe(48000);
  });

  test('11. Mixed Dago + Mitra with discount prorata', () => {
    // Dago = 40.000, Mitra = 60.000, subtotal = 100.000
    // Discount = 10.000 -> Dago = 4.000, Mitra = 6.000
    // Net: Dago = 36.000, Mitra = 54.000
    const orders = [
      createMockOrder("o1", "PAID", [
        {tenantId: "DAGO_HUB", qty: 2, price: 20000},
        {tenantId: "mitra-A", qty: 3, price: 20000}
      ], undefined, 0, 10000)
    ];
    const res = calculateSettlement(orders);
    
    const dago = res.find(r => r.tenantId === "DAGO_HUB");
    const mitraA = res.find(r => r.tenantId === "mitra-A");
    
    expect(dago?.grossRevenue).toBe(40000);
    expect(dago?.discount).toBe(4000);
    expect(dago?.netRevenue).toBe(36000);

    expect(mitraA?.grossRevenue).toBe(60000);
    expect(mitraA?.discount).toBe(6000);
    expect(mitraA?.netRevenue).toBe(54000);
  });

  test('12. Mixed Dago + Mitra with tax prorata', () => {
    // Dago = 40.000, Mitra = 60.000, subtotal = 100.000
    // Tax = 10.000 -> Dago = 4.000, Mitra = 6.000
    // Net: Dago = 44.000, Mitra = 66.000
    const orders = [
      createMockOrder("o1", "PAID", [
        {tenantId: "DAGO_HUB", qty: 2, price: 20000},
        {tenantId: "mitra-A", qty: 3, price: 20000}
      ], undefined, 10000, 0)
    ];
    const res = calculateSettlement(orders);
    
    const dago = res.find(r => r.tenantId === "DAGO_HUB");
    const mitraA = res.find(r => r.tenantId === "mitra-A");
    
    expect(dago?.netRevenue).toBe(44000);
    expect(dago?.tax).toBe(4000);

    expect(mitraA?.netRevenue).toBe(66000);
    expect(mitraA?.tax).toBe(6000);
  });

  test('13. Mixed Dago + Mitra with discount and tax', () => {
    // Dago = 36.000, Mitra = 54.000, subtotal = 90.000
    // Discount = 10.000 (Dago=4.000, Mitra=6.000)
    // Tax = 9.000 (Dago=3.600, Mitra=5.400)
    // Net Dago = 36.000 - 4.000 + 3.600 = 35.600
    // Net Mitra = 54.000 - 6.000 + 5.400 = 53.400
    const orders = [
      createMockOrder("o1", "PAID", [
        {tenantId: "DAGO_HUB", qty: 1, price: 36000},
        {tenantId: "mitra-A", qty: 1, price: 54000}
      ], undefined, 9000, 10000)
    ];
    const res = calculateSettlement(orders);
    
    const dago = res.find(r => r.tenantId === "DAGO_HUB");
    const mitraA = res.find(r => r.tenantId === "mitra-A");
    
    expect(dago?.grossRevenue).toBe(36000);
    expect(dago?.discount).toBe(4000);
    expect(dago?.tax).toBe(3600);
    expect(dago?.netRevenue).toBe(35600);

    expect(mitraA?.grossRevenue).toBe(54000);
    expect(mitraA?.discount).toBe(6000);
    expect(mitraA?.tax).toBe(5400);
    expect(mitraA?.netRevenue).toBe(53400);

    const totalNet = res.reduce((sum, r) => sum + r.netRevenue, 0);
    expect(totalNet).toBe(orders[0].total); // 35.600 + 53.400 = 89.000 = 90.000 - 10.000 + 9.000
  });

  test('14. Total settlement konsisten dengan transaction total pada data edge case', () => {
    // 3 Tenants with weird rounding
    const orders = [
      createMockOrder("o1", "PAID", [
        {tenantId: "t1", qty: 1, price: 33333},
        {tenantId: "t2", qty: 1, price: 33333},
        {tenantId: "t3", qty: 1, price: 33334},
      ], undefined, 10000, 10000)
    ];
    const res = calculateSettlement(orders);
    
    const totalNet = res.reduce((sum, r) => sum + r.netRevenue, 0);
    // Subtotal = 100000. Total = 100000 - 10000 + 10000 = 100000
    expect(totalNet).toBe(100000);
  });
});
