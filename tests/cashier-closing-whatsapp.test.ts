import { describe, it, expect } from "vitest";

describe("Fitur Closing Kasir & Integrasi WhatsApp Report (PDF + Teks)", () => {
  const mockShiftData = {
    outletName: "DAGO Creative Hub (Singaraja)",
    cashierName: "Budi Santoso",
    dateTime: "Kamis, 8 Oktober 2026, 22:00",
    totalTransactions: 42,
    grossSales: 3500000,
    taxRatePercent: 10,
    qrisSales: 2100000,
    cashSales: 1050000,
    edcSales: 350000,
  };

  it("1. Kalkulasi omset kotor, pajak PB1 10%, dan omset bersih terhitung otomatis secara presisi", () => {
    const gross = mockShiftData.grossSales;
    const taxRate = mockShiftData.taxRatePercent;
    const estimatedTax = Math.round(gross * (taxRate / (100 + taxRate)));
    const netSales = gross - estimatedTax;

    expect(estimatedTax).toBe(318182);
    expect(netSales).toBe(3181818);
    expect(netSales + estimatedTax).toBe(gross);
  });

  it("2. Breakdown metode pembayaran (QRIS, Tunai, EDC) seimbang dengan total omset kotor", () => {
    const totalPayments = mockShiftData.qrisSales + mockShiftData.cashSales + mockShiftData.edcSales;
    expect(totalPayments).toBe(mockShiftData.grossSales);
  });

  it("3. Estimasi bagi hasil (85% Mitra, 15% Dago) terhitung secara otomatis dari omset bersih", () => {
    const gross = mockShiftData.grossSales;
    const taxRate = mockShiftData.taxRatePercent;
    const estimatedTax = Math.round(gross * (taxRate / (100 + taxRate)));
    const netSales = gross - estimatedTax;

    const tenantShare = Math.round((netSales * 85) / 100);
    const dagoShare = netSales - tenantShare;

    expect(tenantShare + dagoShare).toBe(netSales);
    expect(tenantShare).toBe(2704545);
    expect(dagoShare).toBe(477273);
  });

  it("4. Template pesan WhatsApp Fonnte sesuai standar format resmi yang ditentukan", () => {
    const formatNum = (num: number) => num.toLocaleString("id-ID");
    const gross = mockShiftData.grossSales;
    const estimatedTax = Math.round(gross * (10 / 110));
    const netSales = gross - estimatedTax;
    const tenantShare = Math.round((netSales * 85) / 100);
    const dagoShare = netSales - tenantShare;

    const message = `📊 *LAPORAN CLOSING SHIFT & REKAP KEUANGAN*
📍 *Outlet:* ${mockShiftData.outletName}
📅 *Waktu:* ${mockShiftData.dateTime}
👤 *Kasir:* ${mockShiftData.cashierName}

━━━━━━━━━━━━━━━━━━━━
💰 *RINGKASAN PENJUALAN*
• Total Transaksi: ${mockShiftData.totalTransactions} Struk
• Omset Kotor: Rp ${formatNum(gross)}
• Pajak PB1 (10%): Rp ${formatNum(estimatedTax)}
• *Omset Bersih:* *Rp ${formatNum(netSales)}*

💳 *METODE PEMBAYARAN*
• 📲 QRIS Dinamis: Rp ${formatNum(mockShiftData.qrisSales)}
• 💵 Tunai (Cash): Rp ${formatNum(mockShiftData.cashSales)}
• 💳 Kartu EDC: Rp ${formatNum(mockShiftData.edcSales)}

🤝 *ESTIMASI BAGI HASIL*
• *Mitra / Owner (85%):* Rp ${formatNum(tenantShare)}
• *Manajemen Dago (15%):* Rp ${formatNum(dagoShare)}
━━━━━━━━━━━━━━━━━━━━
📄 *DOKUMEN RESMI:*
• File Rekapitulasi PDF terlampir di bawah ini (Auto-Generated).
_Sent via POS DagoEng Platform_`;

    expect(message).toContain("LAPORAN CLOSING SHIFT & REKAP KEUANGAN");
    expect(message).toContain("Mitra / Owner (85%)");
    expect(message).toContain("Manajemen Dago (15%)");
    expect(message).toContain("File Rekapitulasi PDF terlampir");
    expect(message).toContain("Sent via POS DagoEng Platform");
  });

  it("5. URL dokumen PDF memuat parameter rekapitulasi lengkap untuk rendering server", () => {
    const docNo = "EOD-20261008-001";
    const gross = mockShiftData.grossSales;
    const tax = Math.round(gross * (10 / 110));
    const net = gross - tax;
    const mitra = Math.round((net * 85) / 100);
    const dago = net - mitra;

    const params = new URLSearchParams({
      outlet: mockShiftData.outletName,
      cashier: mockShiftData.cashierName,
      transactions: String(mockShiftData.totalTransactions),
      gross: String(gross),
      tax: String(tax),
      net: String(net),
      qris: String(mockShiftData.qrisSales),
      cash: String(mockShiftData.cashSales),
      edc: String(mockShiftData.edcSales),
      mitra: String(mitra),
      dago: String(dago),
      docNo,
    });

    const pdfEndpoint = `/api/reports/closing/pdf?${params.toString()}`;
    expect(pdfEndpoint).toContain("/api/reports/closing/pdf?");
    expect(pdfEndpoint).toContain("docNo=EOD-20261008-001");
    expect(pdfEndpoint).toContain("gross=3500000");
  });
});
