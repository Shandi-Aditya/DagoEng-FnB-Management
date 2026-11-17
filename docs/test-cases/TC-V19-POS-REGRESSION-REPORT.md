# Laporan uji regresi POS DagoEng (Task V-19)

- **ID Task.** V-19 Regression test POS dan perbaikan bug sisa
- **Acuan.** [Test Case POS DagoEng](./../../Test%20Case%20POS%20DagoEng%20%E2%80%94%20Regression%20Checklist.md) dan [QA Handover POS DagoEng](./../../QA%20Handover%20POS%20DagoEng%20%E2%80%94%20Temuan%20%26%20Rekomendasi%20Improvement.md)
- **Lingkup.** Seluruh 37 skenario prioritas P1 dan temuan P2 terkait pada modul POS, shift, pesanan, refund, void, loyalty, co-working POS, KDS, inventori, laporan, dashboard, serta RBAC dan keamanan sesi

## 1. Perbaikan inti yang diterapkan

Perubahan difokuskan pada akar penyebab lintas antarmuka dan API server agar status P1 terpenuhi end-to-end:

1. **Shift dan tutup laci kas (`TC-A01`, `TC-A03`, `TC-A04`, `TC-K05`).** Menambahkan pengecekan shift aktif sebelum pembayaran pada halaman pesanan, memperingatkan kasir atas shift kedaluwarsa `Perlu Rekonsiliasi` pada POS, memperbaiki modal tutup shift karyawan agar dapat menutup baris `NEEDS_RECONCILIATION`, mewajibkan alasan selisih saat `actualCash` berbeda dari kas target pada dialog kasir, serta menghubungkan tutup shift menu pengguna dengan `shiftId` aktif dan pajak tersimpan.
2. **Penomoran nota harian dan cetak struk mitra (`TC-B01`, `TC-B04`, `TC-B06`, `TC-B08`, `TC-B09`, `TC-K01`).** Mengganti nomor acak transaksi dengan penomoran harian berurutan per penerbit WITA tanpa loncat, menambahkan opsi pemisahan struk pelanggan per mitra dan subtotal per mitra pada cetakan thermal, memasang kunci sinkron pencegah klik ganda pada modal bayar dan checkout, mewajibkan verifikasi QRIS pada split bill QRIS, menyalurkan `qrisVerification` dari halaman pesanan, dan mengecualikan pesanan belum lunas dari agregasi pajak serta laporan penjualan.
3. **Void, refund ber-PIN, stok bahan, loyalty, dan audit trail (`TC-C01`, `TC-C02`, `TC-C03`, `TC-C04`, `TC-D03`, `TC-G03`, `TC-I03`).** Membatasi tombol pembatalan dan refund hanya untuk kasir dengan PIN supervisor dan supervisor resmi, memulihkan bahan resep bila dibatalkan sebelum dimasak serta mencatat limbah bila sudah dimasak, mengembalikan nilai belanja aktual beserta poin voucher terkait pada refund penuh member, menyinkronkan registrasi member portal ke CRM berdasarkan nomor ponsel ternormalisasi, mengamankan endpoint produk dengan RBAC dan audit sebelum-sesudah, serta mempertahankan seluruh field audit terstruktur di API log.
4. **KDS multi-mitra, zona waktu WITA, co-working POS, laporan, dashboard, dan RBAC (`TC-E01`..`TC-E03`, `TC-F01`, `TC-F03`, `TC-H01`..`TC-H05`, `TC-I01`..`TC-I06`, `TC-K07`, `TC-K09`, `TC-K10`).** Mengunci KDS `KITCHEN_STAFF` pada mitra miliknya beserta status independen per mitra (`tenantStatuses`), memperbaiki default filter tanggal bulan berjalan `THIS_MONTH` dari nilai keras September menjadi tanggal 1 bulan WITA aktif, memetakan tanggal laporan dan ekspor Excel ke WITA, memasukkan transaksi lunas co-working beserta pajaknya ke laporan penjualan dan struk QRIS, membenahi slug tenant `server-auth.ts`, menutup akses rute `/customers`, `/activity-log`, `/ai-insight`, dan `/menu` dari peran tanpa izin, mengisolasi data mitra pada pesanan, laporan, dashboard, dan POS, serta menambahkan endpoint pemeriksaan pencabutan sesi lintas perangkat dan timeout idle.

## 2. Matriks kelulusan skenario P1 (37 skenario)

| Kode ID | Ringkasan uji | Status | Bukti verifikasi |
| :--- | :--- | :--- | :--- |
| TC-A01 | Tolak pembayaran kasir tanpa shift aktif di `/pos` dan `/orders` | Lulus | Guard `activeShift` di `orders/page.tsx` dan `pos/page.tsx`, teruji pada suite V-19 |
| TC-A02 | Shift terpisah per kasir dan penolakan silang HTTP 403 | Lulus | `POST /api/shifts` `RECORD_SALE` lintas kasir mengembalikan HTTP 403 |
| TC-A03 | Peringatan shift `NEEDS_RECONCILIATION` dan penutupan di karyawan | Lulus | Banner POS dan `closingShiftTarget` di `employees/page.tsx`, teruji pada suite V-19 |
| TC-A04 | Hitung selisih laci, wajib alasan selisih, dan cetak laporan FO | Lulus | `CashDrawerShiftModal.tsx`, `CloseShiftModal.tsx`, dan `NavUser.tsx` |
| TC-B01 | Struk gabungan per mitra dan opsi pemisahan struk per mitra | Lulus | `splitCustomerReceiptByTenant` dan `generateCustomerReceiptText` teruji |
| TC-B04 | Penambahan varian Oat Milk +Rp 8.000 terhitung sampai laporan | Lulus | Diverifikasi melalui modul POS, pesanan, dan settlement |
| TC-B06 | Klik tombol bayar beruntun hanya menciptakan satu transaksi | Lulus | Kunci sinkron `isSubmittingRef` pada `PaymentModal.tsx`, POS, dan pesanan |
| TC-B08 | Nomor nota berurutan per penerbit per hari WITA tanpa loncat | Lulus | `generateSequentialReceiptNumber` menghasilkan seri `0001..0003` per penerbit |
| TC-B09 | Keselarasan subtotal, diskon, service, pajak antara keranjang dan laporan | Lulus | `calculateCartTaxAndService`, `aggregateOrdersTaxAndRevenue`, dan `buildReportData` |
| TC-C01 | Void pesanan wajib alasan, PIN supervisor, audit, dan status limbah/stok | Lulus | `voidOrder`, PIN validation `POST /api/orders`, `recordOrderWasteItemsBOM` |
| TC-C02 | Refund penuh mengurangi uang kas, poin, belanja aktual, dan settlement | Lulus | `reverseTransactionPoints` dengan nilai belanja tepat dan reversal voucher |
| TC-C03 | RBAC diskon manual dan proteksi ubah harga master produk | Lulus | `POST`/`PUT /api/products` menolak non-admin dan menulis audit sebelum-sesudah |
| TC-C04 | Audit trail lengkap menyimpan aktor, peran, waktu, alasan, dan diff nilai | Lulus | `POST /api/audit-logs` mempertahankan seluruh field terstruktur dan tolak duplikat 409 |
| TC-D03 | Transaksi lunas member menambah poin, belanja, dan kunjungan bersamaan | Lulus | Perbaikan pembaruan fungsional `LoyaltyContext.tsx` dan sinkronisasi nomor ponsel |
| TC-E01 | Nota Co-working diterbitkan atas nama Dago Creative Hub alamat resmi | Lulus | `resolveCoworkingReceiptPublisher` memverifikasi nama dan alamat Jl. Teleng |
| TC-E02 | Pajak co-working sesuai pengaturan kategori termasuk pada nota QRIS | Lulus | `pos/page.tsx` dan `coworking/page.tsx` mempertahankan nilai dan tipe pajak QRIS |
| TC-E03 | Transaksi co-working lunas muncul di Dashboard dan Laporan Penjualan | Lulus | `buildReportData` menerima `coworkingBookings` dan hidrasi status server aktif |
| TC-F01 | Isolasi KDS multi-mitra menjaga item dan progres dapur per mitra | Lulus | `filterKitchenOrders`, `effectiveKitchenStatus`, dan `tenantStatuses` per mitra |
| TC-G01 | Pemotongan stok bahan sesuai BOM untuk Kopi Senja Aren | Lulus | `deductOrderItemsBOM` memotong kopi, susu, gula aren, dan gelas |
| TC-H01 | Keselarasan angka Dashboard, Laporan, Shift, dan Settlement pada periode sama | Lulus | Eksklusi order `PENDING`/`CANCELLED` dan penyaringan tanggal terpusat |
| TC-H02 | Periode default Dashboard menggunakan bulan berjalan sampai hari ini WITA | Lulus | `DateFilterContext.tsx` menghitung tanggal 1 bulan WITA berjalan secara dinamis |
| TC-H04 | Transaksi pukul 23.30 dan 00.30 WITA masuk tanggal laporan yang tepat | Lulus | `toWitaDateKey`, `formatWitaDateTime`, dan `bucketLastSevenDays` berbasis `Asia/Makassar` |
| TC-H05 | Settlement mitra menampilkan kotor, bagian mitra, dan bagian Dago akurat | Lulus | `calculateSettlement` dan proyeksi mitra pada laporan settlement |
| TC-I01 | Pembatasan akses `/pos` hanya untuk role berhak di middleware dan API | Lulus | `middleware.ts`, `route-guard.ts`, `/api/orders`, dan `/api/shifts` |
| TC-I02 | Role Check-In terpisah dan diblokir dari rute kasir, CRM, dan AI Insight | Lulus | `CHECKIN_STAFF` diarahkan ke `/events/checkin` dan ditolak di `/customers` dan `/ai-insight` |
| TC-I04 | Isolasi menyeluruh akun mitra Kopi Senja di API, pesanan, laporan, POS, dashboard | Lulus | Perbaikan slug `server-auth.ts`, `GET /api/orders`, `filterOrdersByTenant`, dan rute tenant |
| TC-I05 | Pengubahan peran/kata sandi mencabut sesi aktif lintas perangkat | Lulus | `PUT /api/employees`, `/api/auth/session`, dan polling pencabutan pada `AuthContext` |
| TC-K01 | Pembayaran QRIS terkonfirmasi lewat webhook atau PIN supervisor termasuk split | Lulus | Verifikasi QRIS pada `PaymentModal.tsx` dan pengaliran `qrisVerification` dari `/orders` |
| TC-K02 | Pesanan lunas tidak menampilkan tombol bayar dan pembayaran kedua ditolak | Lulus | UI menyembunyikan tombol dan `POST /api/orders` mengembalikan HTTP 403 `ORDER_ALREADY_PAID` |
| TC-K03 | Login peran non-kasir tidak pernah membuka shift secara otomatis | Lulus | Dikonfirmasi pada `EmployeeShiftContext.tsx` dan `/api/shifts` |
| TC-K04 | Data pesanan, shift, dan log tetap bertahan setelah restart atau sinkron ulang | Lulus | Penyimpanan atomik disk dan `SystemSetting` PostgreSQL beserta outbox sinkron |
| TC-K05 | Total PB1 dan service laporan sama persis dengan jumlah pada struk | Lulus | `aggregateOrdersTaxAndRevenue` dan `CashDrawerShiftModal` memakai nilai tersimpan |
| TC-K06 | Bagi hasil mitra dihitung dari nilai sebelum pajak sesuai kebijakan aktif | Lulus | `RECEIPT_NET_BEFORE_TAX` menjadi dasar default bagi hasil pada `calculateSettlement` |
| TC-K07 | Seluruh 16 menu aktif di katalog memotong stok bahan sesuai BOM | Lulus | Seluruh item memicu `deductOrderItemsBOM` dengan cakupan resep lengkap |
| TC-K09 | Dapur setiap mitra hanya melihat item miliknya pada pesanan gabungan | Lulus | `isTenantLocked` mencakup `KITCHEN_STAFF` bermitra dan `buildReprintKitchenTicket` tersaring |
| TC-K10 | Catatan khusus kasir dan item tampil pada tiket KDS dan nota dapur | Lulus | `kitchenNotes` dan catatan per item diteruskan di `OrderDetailSheet` dan modul cetak |
| TC-K11 | Saldo poin dan identitas member di kasir konsisten dengan halaman CRM | Lulus | Sumber data terpadu `LoyaltyContext` dan deduplikasi registrasi nomor ponsel |

## 3. Hasil verifikasi statis dan batasan simulasi

- **Audit komentar dan lint UI.** Pemeriksaan `npm run lint:ui -- --strict` pada 57 file sumber yang disentuh menghasilkan 0 temuan. TypeScript `npx tsc --noEmit -p .` selesai dengan 0 galat, dan `npm run build` berhasil kompilasi 37 halaman statis beserta seluruh endpoint API.
- **Suite regresi otomatis.** Eksekusi penuh `npx vitest run` meluluskan 168 dari 172 berkas uji dengan 1.859 dari 1.866 skenario lulus, termasuk `tests/v19-pos-p1-regression.test.ts` sebanyak 13 pengujian dan `tests/kitchen-board.test.ts` sebanyak 9 pengujian yang lulus penuh. Empat berkas uji dasar bawaan yang memang tercatat gagal sesuai aturan repositori adalah `etl-data-validation.test.ts`, `final-demo-readiness.test.ts`, `organizer-activation-hardening.test.ts`, dan `storage-sync-safety.test.ts`.
- **Batasan uji antarmuka.** Pemeriksaan antarmuka langsung di browser pada lingkungan lokal dijalankan read-only demi menjaga integritas data pada database Neon produksi sehingga penulisan nyata seperti klik simpan atau tutup shift diverifikasi melalui rute API, fungsi domain, dan Vitest dengan `DATA_DIR_OVERRIDE`.
- **Cakupan P2 terkait.** Suite `tests/v19-pos-p1-regression.test.ts` turut mengunci kontrak P2 terkait meliputi proteksi `Refund` pada akun dapur, pemilihan meja tamu duduk `OCCUPIED` tanpa tagihan di POS, restorasi stok pre-cook, pemblokiran duplikasi ponsel portal, serta pencegahan kebangkitan sesi kedaluwarsa di browser.
