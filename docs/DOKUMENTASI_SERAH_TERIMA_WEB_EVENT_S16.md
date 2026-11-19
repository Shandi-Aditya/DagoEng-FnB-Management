# Dokumentasi Serah Terima Modul Web Event (Task S-16)

Dokumen ini merupakan laporan serah terima teknis dan hasil regression test menyeluruh untuk seluruh fitur Modul Web Event (Task S-01 sampai S-15) yang dikerjakan oleh Shandy untuk diserahkan kepada Ka Ari.

---

## 1. Informasi Serah Terima

- **Modul**: Web Event Dago Creative Hub
- **Pelaksana (PIC)**: Shandy (Mahasiswa Magang Undiksha)
- **Penerima**: Ka Ari (Lead Developer / Supervisor)
- **Tanggal**: 19 November 2026
- **Cabang Git**: `shandi-dev`
- **Target Integrasi**: `develop`
- **Repositori**: `https://gitlab.com/devdagoeng/dagoeng-management.git`
- **Total Test Web Event**: 24 file uji (369 skenario uji otomatis)
- **Tingkat Kelulusan Uji**: 100% (369 lulus, 0 gagal)

---

## 2. Ringkasan Eksekutif

Pekerjaan magang modul Web Event telah menyelesaikan seluruh milestone dari M1 hingga M5 (Task S-01 sampai S-15). Cakupan fitur mencakup pengelolaan rekening penampung resmi, pembersihan data uji, validasi harga dan kuota, sentralisasi nomor CS, pengiriman e-tiket dan pemulihan kode via email, pembatasan meja check-in WITA hari ini, siklus transaksi event berbayar end-to-end, isolasi RBAC kasir dan tier loyalty, standarisasi coworking WITA dan nota resmi, konsistensi omzet pesanan lunas, sistem tiket bertingkat (*multi-tier*), kode promo dan tiket undangan, kebijakan refund per event, serta dashboard penjualan penyelenggara.

Seluruh 369 skenario uji otomatis khusus Web Event berhasil dijalankan ulang pada tanggal 19 November 2026 tanpa ada kegagalan sama sekali.

---

## 3. Katalog Fitur yang Diserahterimakan (S-01 s/d S-15)

### S-01: Rekening Resmi Penampung Event
- Menghapus rekening demo `000011223344` dan peringatan demo pada formulir pembayaran tiket.
- Menerapkan pengamanan *fail-closed* di backend (`src/lib/events.ts`). Jika rekening resmi belum diset, pesanan tiket berbayar otomatis ditolak demi mencegah kebocoran dana.
- Menyediakan antarmuka konfigurasi rekening resmi pada portal Event Admin dengan sinkronisasi cloud-first ke PostgreSQL/Neon.
- File uji: `tests/official-bank-guard.test.ts`, `tests/admin-event-bank-cloud-first-persistence.test.ts`.

### S-02: Pembersihan Data Uji & Event Test
- Membersihkan event uji tiruan dan tiket uji dari penyimpanan data produksi.
- Menerapkan mekanisme penghapusan aman dengan *Compare-And-Swap (CAS)* berbasis `updatedAt` untuk mencegah tabrakan konkurensi antar-admin.
- File uji: `tests/admin-event-delete-and-cleanup.test.ts`.

### S-03: Validasi Ketat Harga, Kuota, dan Role Pengaju
- Memastikan harga tiket berupa bilangan bulat positif rupiah (menolak nilai desimal seperti Rp 0,9).
- Membatasi kuota maksimal dalam batas wajar (*safe integer*) dan menolak angka eksponensial.
- Melarang akun dengan peran Petugas Check-In (`CHECKIN_STAFF`) membuat atau mengajukan event baru.
- File uji: `tests/admin-event-validation-hardening.test.ts`.

### S-04: Sentralisasi Nomor WhatsApp Layanan Pelanggan (CS)
- Menyentralisasi nomor CS resmi (+62 821-1550-1995) pada satu konstanta konfigurasi.
- Menghilangkan seluruh nomor contoh seperti `081234567890` di halaman beranda, katalog, dan pemulihan tiket.
- File uji: `tests/events-admin-domain.test.ts`, `tests/events-portal-domain.test.ts`.

### S-05: Pemulihan Kode Booking via Email
- Menutup celah keamanan yang sebelumnya membuka e-tiket langsung dari kombinasi email dan nomor WhatsApp.
- Sistem kini mengirim tautan privat dan kode booking ke alamat email pemesan secara aman.
- File uji: `tests/ticket-recovery-and-grouping.test.ts`, `tests/ticket-recovery-domain.test.ts`.

### S-06: Restriksi Meja Check-in Khusus Hari Acara (WITA)
- Meja check-in lapangan (`/events/checkin`) hanya menampilkan dan mengizinkan pemilihan event yang berlangsung hari ini berdasarkan zona waktu WITA (Waktu Indonesia Tengah).
- Event yang telah lewat atau belum tiba harinya ditolak secara otomatis saat scan QR.
- File uji: `tests/events-checkin-domain.test.ts`, `tests/critical-checkin-bugfixes.test.ts`.

### S-07: Siklus Transaksi Event Berbayar End-to-End
- Alur lengkap: pemesanan tiket berbayar -> unggah bukti transfer -> verifikasi admin keuangan -> aktivasi tiket -> pembagian kode sub-tiket per kursi -> check-in mandiri per sub-tiket.
- Dilengkapi proteksi *anti-duplicate scan* yang menolak pemindaian ulang pada sub-tiket yang telah hadir.
- File uji: `tests/paid-event-e2e.test.ts`.

### S-08: Pengiriman E-Tiket & QR via Email Pasca Lunas
- Modul dispatcher otomatis yang menyiapkan payload e-tiket ber-QR begitu pembayaran diverifikasi lunas oleh admin.
- Melaporkan status `EMAIL_SERVICE_NOT_CONFIGURED` secara jujur jika server SMTP eksternal belum diatur di env.
- File uji: `tests/ticket-paid-email.test.ts`.

### S-09: Pembatasan Akses Kasir & Perhitungan Tier Loyalitas
- Menyembunyikan tombol ekspor data pelanggan untuk akun Kasir.
- Menyamarkan nomor kontak dan email pelanggan pada antarmuka kasir.
- Memperbaiki rumus penentuan tier pelanggan berdasarkan perolehan poin aktual.
- File uji: `tests/customer-role-access-and-tier.test.ts`.

### S-10: Booking Coworking WITA, Nota Resmi, & Konsistensi Pajak
- Mengatur default tanggal pemesanan coworking mengikuti zona waktu WITA.
- Menyelaraskan alamat nota coworking ke alamat resmi Dago Creative Hub di Singaraja, Bali.
- Menstandarkan label pajak non-PB1 menjadi `Pajak (bebas PB1)` secara konsisten.
- File uji: `tests/coworking-wita-receipt-tax.test.ts`, `tests/receipt-publisher-a6.test.ts`.

### S-11: Konsistensi Laporan Produk & Margin
- Memastikan agregasi menu terlaris dan margin laba kotor hanya bersumber dari pesanan yang telah berstatus `PAID` (lunas).
- Mengeliminasi pencatatan menu dari pesanan yang masih berstatus pending atau dibatalkan.
- File uji: `tests/reports-products-margin.test.ts`.

### S-12: Tiket Bertingkat (Multi-Tier)
- Satu event dapat memiliki beberapa jenis tiket sekaligus (contoh: Early Bird, Presale, Reguler, VIP).
- Setiap jenis tiket memiliki kuota mandiri, nominal harga tersendiri, dan jendela waktu penjualan masing-masing.
- Pengurangan kuota dilakukan secara atomik per jenis tiket.
- File uji: `tests/event-ticket-tiers.test.ts`.

### S-13: Kode Promo & Tiket Undangan Gratis
- Penyelenggara atau admin dapat menerbitkan kode voucher promo (diskon persentase atau nominal rupiah) dengan kuota pemakaian dan masa berlaku.
- Fitur penerbitan tiket undangan gratis (*invitation ticket*) untuk pembicara, VIP, atau media partner dengan penanda eksplisit pada e-tiket dan meja check-in.
- File uji: `tests/event-promo-and-invitations.test.ts`.

### S-14: Kebijakan Refund & Pembatalan Tiket
- Penyelenggara dapat menentukan kebijakan pembatalan event: tidak dapat di-refund (`NO_REFUND`) atau dapat di-refund hingga H-x hari sebelum acara (`REFUNDABLE_UNTIL_H_MINUS`) dengan potongan biaya admin.
- Peserta dapat mengajukan refund dari halaman e-tiket mereka dengan memasukkan rincian rekening tujuan.
- Admin keuangan memproses pengajuan (setuju atau tolak) melalui antarmuka moderasi refund di `/events-admin`.
- File uji: `tests/event-refund-policy.test.ts`.

### S-15: Dashboard Penjualan Tiket Penyelenggara
- Portal penyelenggara (`/events/portal`) menampilkan kartu ringkasan penjualan per jenis tiket untuk event aktif.
- Menampilkan rincian kuota total, tiket terjual, sisa kuota, badge *Habis*, dan omzet per tier.
- Memperluas tabel peserta dan ekspor CSV dengan kolom jenis tiket.
- File uji: `tests/organizer-sales-dashboard.test.ts`, `tests/events-portal-domain.test.ts`.

---

## 4. Matriks Hasil Pengujian Regresi Web Event

Pengujian regresi dijalankan serentak menggunakan Vitest pada environment node test. Hasil eksekusi adalah sebagai berikut:

| No | File Test Suite | Jumlah Test | Durasi | Status | Modul / Task Terkait |
| :--- | :--- | :---: | :---: | :---: | :--- |
| 1 | `tests/official-bank-guard.test.ts` | 9 | 154 ms | **LULUS** | S-01 (Rekening Resmi Penampung) |
| 2 | `tests/admin-event-bank-cloud-first-persistence.test.ts` | 22 | 384 ms | **LULUS** | S-01 (Cloud-First CAS Persistence) |
| 3 | `tests/manual-payment-and-bank-settings.test.ts` | 40 | 1679 ms | **LULUS** | S-01 (Pengaturan Rekening Bank) |
| 4 | `tests/admin-event-delete-and-cleanup.test.ts` | 22 | 731 ms | **LULUS** | S-02 (Pembersihan Event Uji) |
| 5 | `tests/admin-event-validation-hardening.test.ts` | 46 | 1694 ms | **LULUS** | S-03 (Hardening Validasi Event) |
| 6 | `tests/events-admin-domain.test.ts` | 11 | 31 ms | **LULUS** | S-04 (Domain Admin & CS WhatsApp) |
| 7 | `tests/ticket-recovery-and-grouping.test.ts` | 26 | 708 ms | **LULUS** | S-05 (Pemulihan Tiket & Sub-Tiket) |
| 8 | `tests/ticket-recovery-domain.test.ts` | 26 | 54 ms | **LULUS** | S-05 (Domain Pemulihan Tiket) |
| 9 | `tests/events-checkin-domain.test.ts` | 29 | 136 ms | **LULUS** | S-06 (Domain Check-In Hari Ini) |
| 10 | `tests/critical-checkin-bugfixes.test.ts` | 9 | 792 ms | **LULUS** | S-06 (Perbaikan Check-In WITA) |
| 11 | `tests/checkin-security-and-atomic-resilience.test.ts` | 9 | 959 ms | **LULUS** | S-06 (Resiliensi Atomik Check-In) |
| 12 | `tests/paid-event-e2e.test.ts` | 13 | 801 ms | **LULUS** | S-07 (End-to-End Event Berbayar) |
| 13 | `tests/ticket-paid-email.test.ts` | 10 | 615 ms | **LULUS** | S-08 (Dispatcher Email Tiket Lunas) |
| 14 | `tests/customer-role-access-and-tier.test.ts` | 8 | 39 ms | **LULUS** | S-09 (RBAC Kasir & Tier Member - POS/CRM) |
| 15 | `tests/coworking-wita-receipt-tax.test.ts` | 8 | 28 ms | **LULUS** | S-10 (Nota Coworking & Pajak WITA - Coworking) |
| 16 | `tests/receipt-publisher-a6.test.ts` | 5 | 28 ms | **LULUS** | S-10 (Penerbit Nota Resmi Dago - POS) |
| 17 | `tests/reports-products-margin.test.ts` | 8 | 51 ms | **LULUS** | S-11 (Laporan Produk & Margin - POS) |
| 18 | `tests/event-ticket-tiers.test.ts` | 8 | 233 ms | **LULUS** | S-12 (Tiket Bertingkat / Multi-Tier) |
| 19 | `tests/event-promo-and-invitations.test.ts` | 11 | 599 ms | **LULUS** | S-13 (Kode Promo & Tiket Undangan) |
| 20 | `tests/event-refund-policy.test.ts` | 12 | 356 ms | **LULUS** | S-14 (Kebijakan Refund Per Event) |
| 21 | `tests/organizer-sales-dashboard.test.ts` | 4 | 28 ms | **LULUS** | S-15 (Dashboard Penjualan Tier) |
| 22 | `tests/events-portal-domain.test.ts` | 8 | 118 ms | **LULUS** | S-15 (Domain Portal Penyelenggara) |
| 23 | `tests/events-portal-groups.test.ts` | 18 | 70 ms | **LULUS** | S-15 (Pengelompokan Status Event) |
| 24 | `tests/events-catalog-domain.test.ts` | 7 | 107 ms | **LULUS** | S-01 s/d S-15 (Katalog Publik) |
| **TOTAL** | **24 File Test Suite** | **369** | **~102 detik** | **100% LULUS** | **Seluruh Modul Web Event & Pendukung** |

> [!NOTE] Keterangan Suite: File 1–13 dan 18–24 merupakan suite inti Web Event, sedangkan File 14–17 merupakan suite pendukung POS/CRM/Coworking (`S-09`, `S-10`, `S-11`) yang telah terintegrasi dan lulus regresi penuh.

Perintah untuk menjalankan ulang seluruh regresi di atas:
```bash
npx vitest run tests/official-bank-guard.test.ts tests/admin-event-bank-cloud-first-persistence.test.ts tests/manual-payment-and-bank-settings.test.ts tests/admin-event-delete-and-cleanup.test.ts tests/admin-event-validation-hardening.test.ts tests/ticket-recovery-and-grouping.test.ts tests/ticket-recovery-domain.test.ts tests/events-checkin-domain.test.ts tests/critical-checkin-bugfixes.test.ts tests/checkin-security-and-atomic-resilience.test.ts tests/paid-event-e2e.test.ts tests/ticket-paid-email.test.ts tests/customer-role-access-and-tier.test.ts tests/coworking-wita-receipt-tax.test.ts tests/receipt-publisher-a6.test.ts tests/reports-products-margin.test.ts tests/event-ticket-tiers.test.ts tests/event-promo-and-invitations.test.ts tests/event-refund-policy.test.ts tests/organizer-sales-dashboard.test.ts tests/events-portal-domain.test.ts tests/events-portal-groups.test.ts tests/events-admin-domain.test.ts tests/events-catalog-domain.test.ts
```

---

## 5. Daftar Akun Uji (Test Credentials)

Berikut adalah daftar akun yang dapat digunakan oleh Ka Ari dan tim QA untuk verifikasi operasional:

| Peran (Role) | Email | Password Standar | Lingkup Hak Akses | URL Akses Utama |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@dagoeng.com` | `Password123!` | Moderasi penuh platform, verifikasi bayar, persetujuan event & refund, pengaturan rekening | `/events-admin` |
| **Petugas Check-In** | `eventstaff@dagoeng.com` | `Password123!` | Meja check-in lapangan, scan QR tiket hari ini (WITA) | `/events/checkin` |
| **Penyelenggara 1** | `baristaguild@dagocreative.id` | `Password123!` | Manajemen event komunitas Barista Guild, ajukan event, buat tier tiket & promo, lihat dashboard penjualan | `/events/portal` |
| **Penyelenggara 2** | `halo@bandungdev.org` | `Password123!` | Komunitas game dev, kelola event milik sendiri | `/events/portal` |
| **Penyelenggara 3** | `info@aksarapriangan.id` | `Password123!` | Studio seni/aksara, kelola event seni | `/events/portal` |
| **Kasir Outlet** | `cashier.sgr@kopisenja.com` | `Password123!` | Operasional kasir F&B/POS (akses data pelanggan tersamar, ekspor dimatikan) | `/pos` |
| **Pelanggan / Tamu** | `customer@gmail.com` | `Password123!` | Pemesanan tiket, riwayat pesanan, ajukan refund e-tiket | `/events`, `/events/tickets/[token]` |

> [!NOTE] Catatan Autentikasi Demo: Pada environment `NODE_ENV=production`, pastikan menyetel `ALLOW_DEMO_UAT=true` pada `.env` atau menjalankan migrasi/seeding tabel `User` (`npx prisma db seed`) agar akun statis di atas dapat login tanpa kendala verifikasi hash password.

---

## 6. Catatan Teknis, Kendala Lingkungan, & Batasan Sistem

1. **Pemeriksaan Build Produksi Next.js**:
   - Perintah `npm run build` dijalankan menggunakan `$env:NODE_OPTIONS="--experimental-require-module"` pada environment Node v22 Windows.
   - Hasil build: **Lulus penuh (exit code 0)** dengan seluruh 37 rute halaman statis berhasil di-generate (`✓ Generating static pages (37/37)`).
   - Pemeriksaan tipe statis `npx tsc --noEmit -p .` berhasil **100% (0 error)**.
   - Pemeriksaan tipe test `npx tsc --noEmit -p tests/tsconfig.json` berhasil **100% (0 error)**.
   - Pengecekan style shadcn `npm run lint:ui -- --strict src` memperoleh **0 temuan**.

2. **Layanan Pengiriman Email (SMTP Provider)**:
   - Fitur pengiriman email e-tiket (S-08) dan pemulihan tiket (S-05) telah diintegrasikan dengan transport `nodemailer` di `src/lib/email.ts`.
   - Jika kredensial `SMTP_HOST`, `SMTP_USER`, dan `SMTP_PASS` di environment belum diisi, sistem secara aman mencatat payload dan URL e-tiket privat ke log konsol (`[Email Dispatcher]`) tanpa memutus transaksi pengguna (`sent: false`, tidak melempar uncaught error).

3. **Baseline Suite Non-Web Event Workspace**:
   - Sesuai dengan dokumentasi `AGENTS.md` bagian Perintah Verifikasi, terdapat tepat 4 file test non-Web Event yang merupakan baseline gagal bawaan:
     1. `tests/etl-data-validation.test.ts`
     2. `tests/final-demo-readiness.test.ts`
     3. `tests/organizer-activation-hardening.test.ts`
     4. `tests/storage-sync-safety.test.ts`
   - Keempat file tersebut berada di luar lingkup modul Web Event. Seluruh suite Web Event (24 file) berstatus **100% lulus**.

---

## 7. Panduan Verifikasi Manual Pengguna (Ka Ari / QA)

Untuk pengujian manual secara visual di browser, ikuti tahapan berikut:

1. **Pengajuan Event Multi-Tier oleh Penyelenggara**:
   - Buka `/events/portal` dan login menggunakan akun `baristaguild@dagocreative.id`.
   - Klik tombol **Ajukan Event**.
   - Masukkan informasi event dan tambahkan tier tiket (misal: *Early Bird* Rp 50.000 kuota 10 pax, *Reguler* Rp 100.000 kuota 20 pax).
   - Pilih kebijakan refund: *Bisa refund hingga H-3 acara* dengan biaya admin 10%.
   - Simpan event. Status akan masuk ke antrean *Menunggu Persetujuan Admin*.

2. **Persetujuan Event oleh Super Admin**:
   - Buka `/events-admin` dan login sebagai `admin@dagoeng.com`.
   - Pada tab **Moderasi**, pilih event yang baru diajukan lalu klik **Setujui Event**.
   - Event kini aktif dan muncul di katalog publik `/events`.

3. **Pemesanan Tiket & Kode Promo oleh Pembeli**:
   - Buka `/events` (tanpa login atau sebagai tamu).
   - Buka detail event tersebut. Pastikan informasi rekening BCA an PT DAGO KREATIF MANDIRI tampil resmi tanpa tulisan demo.
   - Pilih tiket *Early Bird*, masukkan kode promo (jika ada), lalu selesaikan pemesanan.
   - Unggah bukti transfer pada halaman pembayaran.

4. **Verifikasi Pembayaran oleh Admin**:
   - Kembali ke `/events-admin` pada tab **Pembayaran tiket**.
   - Periksa bukti bayar, lalu klik **Setujui pembayaran**.
   - Status pesanan berubah menjadi `PAID` (Lunas).

5. **Akses E-Tiket & Simulasi Pengajuan Refund**:
   - Buka halaman e-tiket peserta melalui tautan tiket (`/events/tickets/[token]`).
   - QR Code aktif untuk setiap sub-tiket peserta.
   - Klik tombol **Ajukan refund**.
   - Masukkan nomor rekening pengembalian dana dan alasan pembatalan, lalu kirim.
   - Buka `/events-admin` tab **Pengajuan refund**, lalu setujui permohonan refund tersebut.

6. **Dashboard Penjualan Tiket**:
   - Masuk kembali ke `/events/portal` sebagai penyelenggara.
   - Pada tab ringkasan beranda dan modal detail event, periksa tabel **Penjualan per jenis tiket**.
   - Pastikan angka tiket terjual, sisa kuota, badge habis, dan omzet terhitung tepat sesuai transaksi yang telah terjadi.

7. **Meja Check-in Hari Acara**:
   - Buka `/events/checkin` dengan akun `eventstaff@dagoeng.com`.
   - Pilih event hari ini.
   - Lakukan scan QR atau input kode tiket.
   - Pastikan check-in berhasil dicatat dan scan kedua pada kode yang sama ditolak dengan pesan peringatan bahwa tiket sudah digunakan.

---

Dokumen ini disusun untuk melengkapi serah terima teknis Task S-16 kepada Ka Ari.
