# Dokumentasi Serah Terima Teknis & Hasil Uji Regresi (Task S-41)

Dokumen ini merupakan laporan serah terima teknis menyeluruh (*technical handover documentation*) dan hasil pengujian regresi (*regression test suite*) untuk seluruh fitur yang telah dibangun dan diperbaiki selama masa magang POS dan Web Event Dago Creative Hub. Dokumen ini diserahkan kepada **Izzy** dan **Ka Ari** sebagai penanggung jawab teknis sistem.

---

## 1. Informasi Serah Terima

| Parameter | Detail |
| :--- | :--- |
| **Cakupan Modul** | POS, Web Event, CRM / Pelanggan, Coworking OTS, Settlement & Kelola Mitra |
| **Pelaksana (PIC)** | Shandi (Mahasiswa Magang Undiksha) |
| **Penerima Serah Terima** | Izzy & Ka Ari (Lead Developer / Tech Lead Dago Creative Hub) |
| **Tanggal Penyelesaian** | 25 November 2026 (Jadwal Target Milestone: M4 14–18 Desember 2026) |
| **Cabang Git Kerja** | `shandi-dev` |
| **Target Integrasi** | `develop` ➔ `main` (Production) |
| **Repositori Resmi** | `https://gitlab.com/devdagoeng/dagoeng-management.git` |
| **Hasil Regresi Otomatis** | **191 file lulus dari 195 file uji** (**2.213 skenario uji lulus** dari **2.222 skenario**) |
| **Status Baseline Error** | Tepat 4 file kegagalan baseline yang diizinkan sesuai panduan `AGENTS.md` |

---

## 2. Ringkasan Eksekutif & Status Uji Regresi

Pekerjaan magang POS dan Web Event mengimplementasikan paket task yang tercantum dalam lembar kerja `Task-List-Magang-POS-WebEvent-23Nov-18Des.xlsx` (M1 s/d M4), mencakup rangkaian Task **S-01 s/d S-16**, Task **S-31 s/d S-39**, Task **S-42**, Task **S-43**, dan dokumentasi serah terima **S-41**.

### 2.1 Hasil Eksekusi Regresi Vitest
Pengujian regresi penuh dijalankan dalam mode lokal terisolasi (tanpa menyentuh database Neon) menggunakan perintah:
```bash
DATABASE_URL="" DIRECT_URL="" npx vitest run --reporter=basic
```
- **Total Test Files**: 195 file
- **File Lulus**: 191 file (97,95%)
- **Total Skenario Uji**: 2.222 skenario
- **Skenario Lulus**: 2.213 skenario (99,59%)
- **Skenario Gagal**: 9 skenario (terkonsentrasi pada file baseline `AGENTS.md`: `tests/etl-data-validation.test.ts`, `tests/final-demo-readiness.test.ts`, `tests/organizer-activation-hardening.test.ts`, dan `tests/storage-sync-safety.test.ts`).
- **File Uji Keamanan & Domain Utama (100% Lulus)**:
  - `tests/events-portal-domain.test.ts` (11/11 lulus)
  - `tests/checkin-security-and-atomic-resilience.test.ts` (13/13 lulus)
  - `tests/v20-pos-handover-docs.test.ts` (5/5 lulus)
  - `tests/s39-weekly-settlement.test.ts` (11/11 lulus)
  - `tests/s42-ticket-attendance.test.ts` (10/10 lulus)
  - `tests/s43-seat-selection.test.ts` (12/12 lulus)
  - `tests/s38-partner-management.test.ts` (15/15 lulus)

---

## 3. Status 8 Target Utama Ka Ari & Fitur Tambahan

Sesuai arahan supervisi teknis Ka Ari (Notulen 11 Nov & evaluasi 19 Nov), berikut rekapitulasi status pemenuhan 8 target utama:

| No | Target Utama Ka Ari | Status | Rincian Implementasi & Lokasi File |
| :---: | :--- | :---: | :--- |
| **1** | **Rekening Resmi Penampung Event** | **Lulus 100%** | Rekening penampung resmi terpasang di portal admin dengan pengamanan *fail-closed* di `src/lib/events.ts`. Tidak ada lagi rekening dummy `000011223344`. Uji: `tests/official-bank-guard.test.ts`. |
| **2** | **Customer Booking Coworking** | **Lulus 100%** | Alur reservasi & OTS Coworking terintegrasi dengan POS. Pemisahan tagihan PB1 0% dan Service Charge 0% khusus meja Hot Desk/Ruang Kerja berhasil diuji pada `tests/v33-ui-settings-integration.test.ts`. |
| **3** | **Pembersihan Data Uji Aman** | **Lulus 100%** | Mekanisme penghapusan event & tiket uji menggunakan proteksi *Compare-And-Swap (CAS)* berbasis `updatedAt` untuk mencegah tabrakan konkurensi antar-admin. Uji: `tests/admin-event-delete-and-cleanup.test.ts`. |
| **4** | **Validasi Harga & Kuota Aman** | **Lulus 100%** | Menolak harga desimal/negatif dan kuota di luar batas *safe integer*. Akses pembuatan event dikunci dari role Petugas Check-In (`CHECKIN_STAFF`). Uji: `tests/admin-event-validation-hardening.test.ts`. |
| **5** | **Sentralisasi Kontak CS Resmi** | **Lulus 100%** | Kontak WhatsApp Customer Service resmi (+62 821-1550-1995) disentralisasi di konstanta `OFFICIAL_CS_WHATSAPP_NUMBER` tanpa nomor contoh `081234567890`. |
| **6** | **Pengiriman E-Tiket Pasca Lunas** | **Lulus 100%** | Pengiriman otomatis tautan privat tiket dan kode QR melalui email dispatcher dengan fallback tautan aman saat SMTP belum terpasang. Uji: `tests/ticket-paid-email.test.ts`. |
| **7** | **Restriksi Meja Check-in WITA** | **Lulus 100%** | Meja check-in lapangan (`/events/checkin`) terkunci ketat pada jendela tanggal hari ini waktu Indonesia Tengah (WITA). Event kemarin/besok ditolak otomatis. Uji: `tests/events-checkin-domain.test.ts`. |
| **8** | **Siklus Transaksi Event Berbayar** | **Lulus 100%** | Siklus end-to-end: pesan tiket -> upload bukti -> verifikasi kasir/admin -> kode sub-tiket terbit -> scan QR anti-duplikasi per sub-tiket. Uji: `tests/paid-event-e2e.test.ts`. |

### Fitur Tambahan yang Diselesaikan (M3 & M4):
- **Task S-42 (Status Kehadiran Tiket / Check-In Parsial)**:
  - Antarmuka status kehadiran dinamis: `Belum Hadir`, `Hadir Sebagian (X/Y)`, dan `Hadir Penuh`.
  - Check-in bertahap berdasarkan kuota pemesanan rombongan (*progressive partial check-in*).
  - Integrasi QR Scanner dengan pembacaan instan nomor tiket individu (`DAGO-EVT-XXX-01`, `02`).
  - File uji: `tests/s42-ticket-attendance.test.ts`, `tests/community-events-hardening.test.ts`.
- **Task S-43 (Denah Pilih Kursi Interaktif Web Event)**:
  - Visualisasi tata letak panggung, denah kursi baris A–H, nomor kursi 01–10.
  - Pewarnaan status semantik (Tersedia, Terpilih, Terisi/Habis).
  - Pemilihan kursi instan pada saat checkout dengan alokasi nomor kursi persisten di e-tiket dan invoice.
  - File uji: `tests/s43-seat-selection.test.ts`.
- **Task S-38 (Kelola Mitra & Add-on Langganan Server-Side)**:
  - Migrasi status mitra dan add-on fitur dari penyimpanan lokal browser ke database PostgreSQL via endpoint `/api/sync/subscription` dan `/api/sync/tenants`.
  - Normalisasi data profil perbankan mitra untuk pencairan settlement.
  - File uji: `tests/s38-partner-management.test.ts`.
- **Task S-39 (Bagi Hasil per Metode Bayar, MDR QRIS, Laporan #10 & #11)**:
  - Logika pemisahan kas fisik (Tunai: mitra setor 15% ke Dago) dan uang digital (QRIS: Dago transfer 85% ke mitra setelah MDR).
  - Pilihan pembebanan MDR QRIS 0,7%: Ditanggung Mitra, Ditanggung Dago, atau Dibagi Proporsional (85/15).
  - Laporan #10 (Settlement mingguan per mitra) dan Laporan #11 (Konsolidasi semua mitra beserta total agregat).
  - Tombol aksi Finance persisten: *Tandai Lunas* dan *Batal*.
  - File uji: `tests/s39-weekly-settlement.test.ts`.

---

## 4. Katalog Fitur yang Diserahterimakan

### 4.1 Modul Web Event Komunitas
1. **Katalog Publik & Detail Event**:
   - URL: `/events`, `/events/[id]`
   - Fitur: Penjelajahan event komunitas aktif, filter kategori & tanggal, kartu kapasitas tiket real-time, lencana status event (*Open, Sold Out, Past*).
2. **Checkout Tiket & Denah Kursi Interaktif (S-43)**:
   - URL: `/events/[id]`
   - Fitur: Pilihan tiket bertingkat (*multi-tier*), kode promo / tiket undangan gratis (S-13), pemilihan nomor kursi visual interaktif baris A–H.
3. **Portal Pembayaran & E-Tiket Privat**:
   - URL: `/events/tickets/[token]`
   - Fitur: Instruksi transfer bank resmi, unggah bukti bayar (PNG/JPG/PDF < 5MB), penerbitan e-tiket ber-QR pasca verifikasi, unduh tiket PDF/cetak.
4. **Portal Penyelenggara Komunitas (Organizer Portal)**:
   - URL: `/events/portal`
   - Fitur: Autentikasi penyelenggara resmi via email/token, pengajuan event baru, edit & *resubmit* event revisi (S-12), daftar peserta (*attendees*) real-time, pencatatan check-in parsial (S-42), ekspor data peserta CSV berzona waktu WITA.
5. **Meja Check-in Lapangan (Field Check-In & QR Scanner)**:
   - URL: `/events/checkin`
   - Fitur: Pembacaan QR code otomatis via kamera, input kode tiket manual, validasi pencegahan duplikasi scan (*anti-duplicate scan*), pembatasan operasional khusus hari H event WITA (S-06).

### 4.2 Modul POS Kasir, Struk & Tenant Settlement
1. **Transaksi Kasir Terpadu**:
   - URL: `/pos`
   - Fitur: Multi-tenant basket (pesanan gabungan tenant F&B dan coworking), diskon prorata, perhitungan PB1 10% dan service charge 5% (bebas pajak untuk coworking), pencetakan struk kasir dan dapur.
2. **Kelola Meja & Reservasi WITA**:
   - URL: `/tables`
   - Fitur: Denah meja visual, status ketersediaan, reservasi pelanggan dengan tanggal & jam berzona WITA, penggabungan meja (*merge*), pindah meja (*move*), dan pembagian tagihan (*split bill*).
3. **Kelola Mitra & Add-on (S-38)**:
   - URL: `/settings` (Tab Mitra)
   - Fitur: Pendaftaran tenant, persentase bagi hasil kustom per tenant, pengaturan nomor rekening bank pencairan, aktivasi add-on langganan tersinkronisasi server.
4. **Laporan Keuangan & Rekonsiliasi Mingguan (S-39)**:
   - URL: `/reports`
   - Fitur: Laporan Penjualan POS, Laporan Rekonsiliasi Tripartit Kasir (Fisik, Struk, Settlement), Laporan Settlement Mitra (#10), dan Laporan Konsolidasi Semua Mitra (#11) dengan netting aliran kas akhir (Dago transfer ke mitra vs Mitra setor ke Dago).

---

## 5. Daftar Akun Uji Sistem (Test Accounts)

Seluruh akun pengujian resmi merujuk pada `docs/AKUN_SISTEM.md` (menggunakan kata sandi `Password123!` atau kata sandi singkat `demo` pada mode UAT staging):

| Peran (*RoleSlug*) | Lingkup (*ScopeLevel*) | Email Akun | Kata Sandi | Deskripsi Akses |
| :--- | :--- | :--- | :--- | :--- |
| **SUPER_ADMIN** | `PLATFORM` | `admin@dagoeng.com` | `Password123!` | Akses penuh platform, konfigurasi sistem, dan data global |
| **OWNER** | `ORGANIZATION` | `owner.dago@dagoeng.com` | `Password123!` | Pemilik Dago Creative Hub, laporan finansial, audit log |
| **MANAGER** (Commercial) | `ORGANIZATION` | `manager.commercial@dagoeng.com` | `Password123!` | Manajer komersial & event, approval revisi, laporan |
| **MANAGER** (Co-Working) | `ORGANIZATION` | `manager.cowork@dagoeng.com` | `Password123!` | Manajer co-working & space, denah meja, reservasi |
| **CHECKIN_STAFF** | `ORGANIZATION` | `eventstaff@dagoeng.com` | `Password123!` | Meja check-in lapangan event hari H (`/events/checkin`) |
| **OWNER** (Tenant F&B) | `TENANT` | `owner.kopisenja@dagoeng.com` | `Password123!` | Pemilik mitra F&B Kopi Senja, profil tenant, dashboard |
| **CASHIER** | `OUTLET` | `cashier.sgr@kopisenja.com` | `Password123!` | Kasir outlet Singaraja, POS terpadu, shift kasir |
| **WAITER** | `OUTLET` | `waiter.sgr@kopisenja.com` | `Password123!` | Pramusaji Singaraja, pemesanan meja, status pesanan |
| **KITCHEN_STAFF** | `OUTLET` | `kitchen.sgr@kopisenja.com` | `Password123!` | Staf dapur Singaraja, Kitchen Display System (KDS) |
| **CUSTOMER** (Komunitas) | `OUTLET` | `baristaguild@dagocreative.id` | `Password123!` | Penyelenggara event komunitas (Dago Barista Guild) |
| **CUSTOMER** (Komunitas) | `OUTLET` | `halo@bandungdev.org` | `Password123!` | Penyelenggara event komunitas (Bandung Game Creators) |
| **CUSTOMER** (Pelanggan) | `OUTLET` | `customer@gmail.com` | `Password123!` | Pelanggan demo, e-tiket, reservasi meja |

---

## 6. Prosedur Rilis & Konfigurasi Lingkungan (Deployment SOP)

### 6.1 Variabel Lingkungan (*Environment Variables*) Wajib
Pastikan file `.env` pada lingkungan Staging/Production terisi parameter berikut:
```env
# Database PostgreSQL (Neon / Supabase / VPS)
DATABASE_URL="postgresql://user:password@ep-host.ap-southeast-1.neon.tech/neondb?sslmode=require"

# Keamanan Sesi & Verifikasi POS (mengacu pada DEPLOY_COOLIFY.md)
SESSION_SECRET="kunci-rahasia-hmac-sesi-minimal-32-karakter"
QRIS_WEBHOOK_SECRET="kunci-rahasia-hmac-sha256-qris"
SUPERVISOR_OVERRIDE_PIN="pin-override-supervisor"

# Alamat Aplikasi & API
NEXT_PUBLIC_APP_URL="https://staging.pos.veryyyy.com"

# Layanan Pengiriman Email Tiket (Opsional, gunakan SMTP aktif)
SMTP_HOST="smtp.mailtrap.io"
SMTP_PORT="587"
SMTP_USER="username-smtp"
SMTP_PASS="password-smtp"
SMTP_FROM="no-reply@dagoeng.com"

# Nomor Layanan Pelanggan Resmi (Sentralisasi S-04)
NEXT_PUBLIC_CS_WHATSAPP="+6282115501995"
```

### 6.2 Prosedur Migrasi & Deployment (Coolify / Docker)
1. **Tarik Cabang Terbaru**:
   ```bash
   git fetch origin
   git checkout develop
   git pull origin develop
   ```
2. **Instalasi Dependensi**:
   ```bash
   npm ci
   ```
3. **Migrasi Skema Basis Data**:
   ```bash
   npx prisma db push
   ```
4. **Verifikasi Build Produksi**:
   ```bash
   npm run build
   ```
5. **Restart Service Node.js / Kontainer Docker**:
   Ikuti panduan lengkap pada [DEPLOY_COOLIFY.md](./DEPLOY_COOLIFY.md) dan [SOP_RILIS_DAN_STAGING.md](./SOP_RILIS_DAN_STAGING.md).

---

## 7. Catatan Bug yang Tersisa, Batasan Teknis, & Rekomendasi Backlog

Sebagai bagian dari prinsip transparansi rekayasa perangkat lunak, berikut catatan teknis dan keterbatasan yang diserahkan untuk menjadi perhatian tim selanjutnya:

1. **4 File Baseline Test Kegagalan yang Dikecualikan**:
   - `tests/etl-data-validation.test.ts`: Uji migrasi ETL lama yang membutuhkan database staging offline terpisah.
   - `tests/final-demo-readiness.test.ts`: Uji siap-demo tanggal 30 Oktober 2026 yang mengunci tanggal lampau sehingga ditolak oleh validator tanggal hari ini WITA (`startDate > endDate` atau `event date past`).
   - `tests/organizer-activation-hardening.test.ts`: Ekspektasi kode error HTTP 500 vs 401 pada simulasi kegagalan database ekstrem.
   - `tests/storage-sync-safety.test.ts`: Simulasi timeout latensi database 5000ms pada mocking storage sync.
   - *Rekomendasi*: Sesuaikan tanggal mock pada test fixture demo lama agar selaras dengan runtime dinamis sistem.

2. **Layanan Pengiriman Email Eksternal**:
   - Saat variabel SMTP belum dikonfigurasi di server staging, dispatcher e-tiket akan mencatat log peringatan `[Email Dispatcher] Layanan pengiriman email eksternal belum dikonfigurasi` dan otomatis menyediakan tautan privat tiket (`https://dagoeng.com/events/tickets/[token]`) yang langsung dapat disalin atau dicetak oleh staf.
   - *Rekomendasi*: Hubungkan akun penyedia email transaksional resmi (seperti SendGrid, Resend, atau Google Workspace SMTP) saat rilis production.

3. **Keputusan Persentase Bagi Hasil Final (85/15 vs 70/30)**:
   - Sistem saat ini menerapkan konfigurasi default bagi hasil 85% Mitra / 15% Dago sesuai sistem operasional POS.
   - Tersedia opsi *Custom Revenue Splits* di menu Kelola Mitra (`/settings`) jika terdapat kesepakatan rasio khusus (misal 80/20 atau 70/30) tanpa perlu mengubah kode sumber.
   - *Rekomendasi*: Tunggu arahan final dari Ka Ari sebelum mengunci nilai default pada template onboarding tenant baru.

---

## 8. Tanda Tangan & Pernyataan Serah Terima

Dokumentasi ini disusun dengan penuh tanggung jawab berdasarkan pengujian teknis objektif pada branch `shandi-dev` repositori `dagoeng-management`.

**Diserahkan oleh:**  
**Shandi**  
Mahasiswa Magang Pengembang POS & Web Event  
Universitas Pendidikan Ganesha (Undiksha)  

**Diterima oleh:**  
**Izzy & Ka Ari**  
Tech Lead & Lead Developer  
Dago Creative Hub  
