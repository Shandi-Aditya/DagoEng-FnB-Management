import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const outlet = searchParams.get("outlet") || "Dago Creative Hub (Singaraja)";
  const cashier = searchParams.get("cashier") || "Kasir Bertugas";
  const date = searchParams.get("date") || new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const time = searchParams.get("time") || new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const docNo = searchParams.get("docNo") || `EOD-${Date.now()}`;
  
  const transactions = searchParams.get("transactions") || "0";
  const gross = Number(searchParams.get("gross")) || 0;
  const tax = Number(searchParams.get("tax")) || 0;
  const net = Number(searchParams.get("net")) || (gross - tax);
  const qris = Number(searchParams.get("qris")) || 0;
  const cash = Number(searchParams.get("cash")) || 0;
  const edc = Number(searchParams.get("edc")) || 0;
  const mitraShare = Number(searchParams.get("mitra")) || Math.round(net * 0.85);
  const dagoShare = Number(searchParams.get("dago")) || (net - mitraShare);

  const formatIDR = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Laporan Closing Shift - ${docNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: #f8fafc; color: #1e293b; padding: 24px; font-size: 13px; line-height: 1.5; }
    .container { max-width: 760px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #ea580c; padding-bottom: 16px; margin-bottom: 20px; }
    .brand-title { font-size: 20px; font-weight: 800; color: #0f172a; }
    .brand-sub { font-size: 12px; color: #64748b; margin-top: 2px; }
    .doc-badge { text-align: right; }
    .badge { background: #fff7ed; color: #ea580c; border: 1px solid #fed7aa; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 11px; text-transform: uppercase; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e2e8f0; }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }
    .meta-val { font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 2px; }
    .section-title { font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #f1f5f9; text-align: left; padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
    .text-right { text-align: right; }
    .font-mono { font-family: monospace; }
    .highlight-row { background: #fffbeb; font-weight: 700; }
    .share-box { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .share-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
    .share-card.mitra { background: #f0fdf4; border-color: #bbf7d0; }
    .share-card.dago { background: #eff6ff; border-color: #bfdbfe; }
    .share-title { font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .share-val { font-size: 18px; font-weight: 800; margin-top: 4px; font-family: monospace; }
    .footer-note { font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px; }
    @media print {
      body { background: transparent; padding: 0; }
      .container { border: none; box-shadow: none; padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="brand-title">DAGOENG MANAGEMENT</div>
        <div class="brand-sub">Laporan Rekapitulasi Shift Kasir & Settlement Keuangan</div>
      </div>
      <div class="doc-badge">
        <div class="badge">Official Report</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px; font-family: monospace;">No: ${docNo}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <span class="meta-label">Outlet</span>
        <span class="meta-val">${outlet}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Kasir Bertugas</span>
        <span class="meta-val">${cashier}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Waktu Penutupan</span>
        <span class="meta-val">${date}, ${time}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Status Sesi</span>
        <span class="meta-val" style="color: #16a34a;">LOCKED & CLOSED</span>
      </div>
    </div>

    <div class="section-title">
      <span>1. Ringkasan Penjualan</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>Komponen</th>
          <th class="text-right">Keterangan / Nilai</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Total Transaksi Selesai</td>
          <td class="text-right font-mono font-bold">${transactions} Struk</td>
        </tr>
        <tr>
          <td>Omset Kotor (Gross Sales)</td>
          <td class="text-right font-mono">${formatIDR(gross)}</td>
        </tr>
        <tr>
          <td>Pajak Restoran PB1 (10%)</td>
          <td class="text-right font-mono" style="color: #dc2626;">-${formatIDR(tax)}</td>
        </tr>
        <tr class="highlight-row">
          <td>Omset Bersih (Net Sales)</td>
          <td class="text-right font-mono" style="color: #16a34a; font-size: 14px;">${formatIDR(net)}</td>
        </tr>
      </tbody>
    </table>

    <div class="section-title">
      <span>2. Breakdown Metode Pembayaran</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>Metode Bayar</th>
          <th>Tipe Settlement</th>
          <th class="text-right">Nominal</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>📲 QRIS Dinamis</td>
          <td>Digital Auto-Settlement</td>
          <td class="text-right font-mono">${formatIDR(qris)}</td>
        </tr>
        <tr>
          <td>💵 Uang Tunai (Cash)</td>
          <td>Setoran Kas Fisik</td>
          <td class="text-right font-mono">${formatIDR(cash)}</td>
        </tr>
        <tr>
          <td>💳 Kartu EDC</td>
          <td>Merchant Settlement</td>
          <td class="text-right font-mono">${formatIDR(edc)}</td>
        </tr>
      </tbody>
    </table>

    <div class="section-title">
      <span>3. Estimasi Bagi Hasil Pendapatan</span>
    </div>
    <div class="share-box">
      <div class="share-card mitra">
        <div class="share-title" style="color: #15803d;">Porsi Mitra / Owner (85%)</div>
        <div class="share-val" style="color: #166534;">${formatIDR(mitraShare)}</div>
        <div style="font-size: 10px; color: #166534; margin-top: 4px;">Pendapatan bersih bagian pemilik tenant</div>
      </div>
      <div class="share-card dago">
        <div class="share-title" style="color: #1d4ed8;">Manajemen DAGO (15%)</div>
        <div class="share-val" style="color: #1e40af;">${formatIDR(dagoShare)}</div>
        <div style="font-size: 10px; color: #1e40af; margin-top: 4px;">Platform & Hub Management Share</div>
      </div>
    </div>

    <div class="footer-note">
      Dokumen rekapitulasi ini digenerate secara otomatis oleh POS DagoEng Platform pada ${date} ${time}.<br />
      Telah terverifikasi digital & diteruskan ke WhatsApp Manajemen.
    </div>

    <div class="no-print" style="margin-top: 24px; text-align: center;">
      <button onclick="window.print()" style="background: #ea580c; color: white; border: none; padding: 10px 24px; border-radius: 8px; font-weight: 700; cursor: pointer;">
        🖨️ Cetak / Unduh PDF Dokumen
      </button>
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
