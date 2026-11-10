# Bug Fix Playbook — QA Handover POS B1 sampai B8

- [ ] 1. Reproduce it yourself on the matching surface via the driver skill
- [ ] 2. Binary-search the cause
- [ ] 3. Plan the fix
- [ ] 4. Verify on the same surface
- [ ] 5. Stage the commits so the failing repro lands before the fix in git history
- [ ] 6. Run Opening a PR: skip: local branch development

## Task Checklist (B1 to B8)

- [x] **B1. Tombol Bayar Ganda (POS-26, TC-K02, TC-I03)**
  - [x] Sembunyikan tombol "Proses Pembayaran" pada pesanan dengan `paymentStatus === "PAID"` di tabel dan detail modal `src/app/(dashboard)/orders/page.tsx`.
  - [x] Tolak upaya pembayaran ganda pada order berstatus PAID di API endpoint `POST /api/orders` dengan pesan `ORDER_ALREADY_PAID`.
  - [x] Batasi tombol pembayaran di KDS dan Orders hanya untuk role berwenang (Kasir, Admin, Owner).

- [x] **B2. Formulasi Pajak & Service Charge (POS-11, POS-27, TC-B09)**
  - [x] Pastikan seluruh perhitungan cart kasir, modal tagihan, struk, dan laporan menggunakan fungsi terpusat `getOrderTaxBreakdown` di `src/lib/tax-breakdown.ts`.
  - [x] Sinkronkan formula subtotal, diskon promo, DPP, PB1 (10%), dan service charge (5% dine-in) agar menghasilkan angka identik sampai satuan rupiah.

- [x] **B3. Perhitungan Bagi Hasil Mitra (POS-35, TC-H05, TC-K06)**
  - [x] Ubah dasar kalkulasi bagi hasil mitra (85% tenant / 15% Dago) di `src/lib/settlement.ts` agar dihitung dari DPP (`data.gross - allocatedDiscount`) sebelum pajak.
  - [x] Pisahkan pajak PB1 dan service charge dari porsi bagi hasil merchant.

- [x] **B4. Pengurangan Stok / BOM (POS-36, TC-G01, TC-G02, TC-K07)**
  - [x] Perbaiki formula resep dan pemotongan bahan baku untuk produk minuman (Kopi Senja Aren, Classic Americano, Artisan Tea) dan makanan di `src/features/inventory/inventory-data.ts`.
  - [x] Implementasikan substitusi bahan baku modifier (misal Oat Milk menggantikan susu segar Greenfield).
  - [x] Pastikan pemotongan stok terpanggil otomatis saat transaksi diselesaikan dan tersimpan persisten ke storage/database.

- [x] **B5. Sinkronisasi Ringkasan Dashboard (POS-04, POS-05, POS-06, POS-37, TC-E03, TC-H01, TC-H02, TC-H03, TC-K08)**
  - [x] Hapus nilai hardcoded `cwkRevenue = 0` pada `src/app/(dashboard)/dashboard/page.tsx` dan agregasikan transaksi co-working secara riil.
  - [x] Koreksi pendapatan event Dago Hub pada dashboard agar hanya menghitung `platformRevenue` (komisi platform) dan bukan total omzet tiket organizer.
  - [x] Perbaiki perhitungan Average Order Value (AOV) agar membagi total pendapatan dengan total transaksi valid secara presisi.
  - [x] Hapus tanggal hardcoded `17 Sep 2026` di `src/features/layout/Header.tsx` dan gunakan rentang tanggal aktif dari `DateFilterContext.tsx`.

- [x] **B6. Sinkronisasi Poin & Member CRM (POS-08, POS-09, POS-28, TC-D03, TC-D04, TC-K11)**
  - [x] Perbaiki `addPoints` di `src/contexts/LoyaltyContext.tsx` agar mengupdate `totalSpend` dan `totalVisits` member saat transaksi selesai.
  - [x] Sinkronkan daftar member antara POS kasir dan CRM agar saldo poin historis tidak ter-reset ke 0.
  - [x] Cegah duplikasi member dengan validasi nomor telepon normalisasi pada portal dan kasir.

- [x] **B7. Routing Pesanan KDS & Catatan Stasiun (POS-38, POS-39, TC-F01, TC-K09, TC-K10)**
  - [x] Filter item di layar dapur `src/app/(dashboard)/kitchen/page.tsx` berdasarkan `tenantId` akun dapur yang login agar item mitra lain tidak tercampur.
  - [x] Tampilkan `notes` (catatan khusus per item dan catatan pesanan kasir) pada kartu antrean KDS dan cetakan nota dapur.

- [x] **B8. Konfigurasi Pajak Co-Working (POS-07, TC-E02)**
  - [x] Sediakan pengaturan tipe dan tarif pajak fleksibel per kategori produk (F&B PB1, Co-working non-pajak/PPN) di konfigurasi sistem dan `calculateCoworkingPricing`.
  - [x] Cetak jenis pajak yang sesuai pada struk co-working.
