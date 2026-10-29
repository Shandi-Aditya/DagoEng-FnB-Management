# DAGOENG — OFFLINE DATA VALIDATION & ETL DRY-RUN REPORT
**Mode**: Pure Offline Dry-Run | Zero Database Writes | Zero Cloud Uploads  
**Tanggal Audit**: 29 Oktober 2026  
**Status Eksekusi**: Non-Destructive Local Verification Only

---

## 1. AUDIT BASELINE & STATUS GIT

### 1.1 Status Repositori Git Aktual
* **Branch**: `main` (sinkron dengan `origin/main`).
* **Toolchain & Runtime**:
  - Node.js: `v22.11.0`
  - npm: `10.9.0`
  - Next.js: `^14.2.18` (terpasang `14.2.35`)
  - Prisma CLI & Client: `^5.22.0`
  - TypeScript: `^5.6.3`
  - tsx runner: `v4.23.13`
* **Status File Kerja Pengguna**:
  - Seluruh modifikasi kode eksisting pada route auth, event ticket, simulator DOKU, dan helper storage dipertahankan 100%.
  - Seluruh berkas data JSON di `data/` dan berkas bukti pembayaran di `data/proofs/` tidak tersentuh dan tidak dimodifikasi.

### 1.2 Inventaris Berkas Data & Penyimpanan Fisik
| Nama Berkas / Direktori | Ukuran Fisik | Jumlah Record Aktual | Lokasi & Sifat Akses | Status Integritas |
| :--- | :---: | :---: | :--- | :--- |
| `data/events.json` | 17.211 B | 16 Events | Disk Lokal Server | Valid JSON, 0 duplikasi ID |
| `data/event_bookings.json` | 8.473 B | 8 Bookings | Disk Lokal Server | Valid JSON, 0 duplikasi Booking Code |
| `data/event_settings.json` | 3.465 B | 1 Config Object | Disk Lokal Server | Valid JSON, 3 Rekening Bank |
| `data/organizers.json` | 5.009 B | 9 Organizers | Disk Lokal Server | Valid JSON, 9 Komunitas |
| `data/organizer_credentials.json` | 1.166 B | 4 Kredensial | Disk Lokal Server | Valid JSON, Hash Password |
| `data/organizer_invites.json` | 2.631 B | 7 Undangan | Disk Lokal Server | Valid JSON, Token Hash |
| `data/unified_users.json` | 1.359 B | 4 User Akun | Disk Lokal Server | Valid JSON, RBAC User Profiles |
| `data/proofs/` | 732.861 B | 2 Berkas PNG | **Folder Privat (Lokal)** | Terisolasi dari akses publik anonim |
| `data/backup_legacy_proofs/` | 732.861 B | 2 Berkas PNG | **Folder Cadangan (Lokal)** | Hash SHA-256 identik dengan `data/proofs/` |
| `public/images/events/proofs/` | 0 B | 0 Berkas | Folder Publik Lama | **SUDAH DIHAPUS TOTAL (Test-Path: False)** |
| `public/images/events/` | ~4,8 MB | 14 Berkas Gambar | Folder Publik Statis | Hanya berisi poster promosi acara publik |

---

## 2. HASIL VALIDASI OFFLINE ETL DRY-RUN

Validasi dijalankan secara otomatis menggunakan skrip [`scripts/migrate-json-to-postgres.ts`](file:///d:/Magang%20Shandi/DagoEng%20F&B%20Management/scripts/migrate-json-to-postgres.ts) dalam mode `--dry-run`. Skrip ini melakukan pengecekan mendalam terhadap 10 aspek integritas data:

```text
================================================================================
  DAGOENG OFFLINE ETL VALIDATOR & DATA INTEGRITY AUDIT
  Mode: DRY-RUN (Zero DB writes, Zero cloud uploads, Pure Read-Only)
================================================================================

=== ETL VALIDATION RESULT SUMMARY ===
Status: AUDIT COMPLETED — 11 ANOMALI TERDETEKSI (3 Kritis, 2 Peringatan, 6 Info)
Audited Events: 16
Audited Bookings: 8
Audited Organizers: 9
Physical Proofs in data/proofs/: 2
Financial Audit: Total Rp 1.706.000 (Paid: Rp 506.000, Pending: Rp 1.000.000, Cancelled: Rp 200.000)
```

### 2.1 Temuan Anomali Data yang Wajib Dimitigasi Sebelum Staging
Validator offline berhasil mendeteksi anomali nyata pada data warisan (*legacy data*) yang jika dipaksakan masuk ke PostgreSQL tanpa penanganan akan memicu kegagalan migrasi (*constraint violation*):

1. **3 Booking Warisan Tanpa `guestToken` (Severity: ERROR)**:
   - Tiket `DAGO-EVT-48246` (Status: `CANCELLED`) -> `guestToken: undefined`
   - Tiket `DAGO-EVT-77491` (Status: `PAID`) -> `guestToken: undefined`
   - Tiket `DAGO-EVT-88219` (Status: `PAID`) -> `guestToken: undefined`
   - *Penyebab*: Tiga tiket ini dibuat pada versi aplikasi lama sebelum arsitektur tautan privat `guestToken` diimplementasikan.
   - *Solusi Migrasi*: Pada skrip ETL migrasi, field `guestToken` untuk ketiga tiket ini wajib diisi dengan token kriptografis baru (`crypto.randomBytes(32).toString('hex')`) agar mematuhi constraint `@unique` non-nullable di PostgreSQL.
2. **2 Event Warisan Tanpa `maxCapacity` (Severity: WARNING)**:
   - Event `evt-latte-art-2026` -> `maxCapacity: undefined`
   - Event `evt-community-cleanup-2026` -> `maxCapacity: undefined`
   - *Penyebab*: Merupakan event benih awal (*seed*) sebelum validasi kapasitas diwajibkan.
   - *Solusi Migrasi*: Skema Prisma wajib menetapkan default `@default(50)` atau skrip ETL menyematkan nilai fallback `50`.
3. **6 Event dengan `organizerEmail` Tidak Terdaftar di `organizers.json` (Severity: INFO)**:
   - Event `evt-1793173055748-1ujzs` (Email: `c******r@gmail.com`)
   - Event `evt-1793083665642-lv4kl` (Email: `1*@gmail.com`)
   - Event `evt-1793073538004-rekb8` (Email: `t*s@gmail.com`)
   - Event `evt-1793073371363-zli0p` (Email: `c*k@gmail.com`)
   - Event `evt-1793073243970-l4bew` (Email: `t*s@gmail.com`)
   - Event `evt-1793004679533-13yqp` (Email: `s***************5@gmail.com`)
   - *Penyebab*: Event diajukan oleh pengguna publik atau penyelenggara tamu yang belum melalui onboarding resmi di tabel komunitas.
   - *Solusi Migrasi*: Relasi `CommunityEvent.organizerId` ke `Organizer.id` **TIDAK BOLEH** dibuat sebagai *Foreign Key* wajib (*mandatory*), melainkan harus bersifat opsional (`organizerId String?`), atau dibuatkan entitas profil fallback (*External/Guest Organizer*) selama proses ETL.

### 2.2 Hasil Audit Finansial & Rekonsiliasi Matematika
Perhitungan dilakukan menggunakan aritmatika bilangan bulat pasti (*exact integer cents/rupiah*) tanpa komputasi *floating-point*:
* **Total Akumulasi Seluruh Booking**: **Rp 1.706.000**
  - Akumulasi Transaksi Berstatus `PAID` (Lunas): **Rp 506.000** (6 booking)
  - Akumulasi Transaksi Berstatus `PENDING` (Menunggu Verifikasi): **Rp 1.000.000** (1 booking: `DAGO-EVT-72676`)
  - Akumulasi Transaksi Berstatus `CANCELLED` (Batal): **Rp 200.000** (1 booking: `DAGO-EVT-48246`)
* **Validasi Perkalian Unit Price x Qty**: 100% konsisten pada seluruh 8 baris booking (0 selisih).
* **Validasi Pembagian Komisi (*Fee Split*)**:
  - Pada booking berbayar: `platformFeeAmount + organizerRevenueAmount == totalPrice` terverifikasi 100% sinkron.

### 2.3 Integritas Bukti Pembayaran Fisik
* 2 berkas bukti transfer fisik di `data/proofs/` terverifikasi memiliki referensi valid dari `data/event_bookings.json`:
  1. `proof-dago-evt-72676-1793179816938.png` (143.997 B) -> Direferensikan oleh tiket `DAGO-EVT-72676`. SHA-256: `BC37D23026012DE4FDAD3B5DA743A3682FA007DFEEC2F790CC6081FAF4EFFA47`.
  2. `proof-dago-evt-51628-1793179519555.png` (588.864 B) -> Direferensikan oleh tiket `DAGO-EVT-51628`. SHA-256: `05A9D413298885A99B7993E08809019FD464F62C0F75751C776EF7D6E40C3D24`.
* Tidak ada bukti pembayaran yatim (*orphan file*) dan tidak ada booking yang merujuk pada berkas yang hilang (*missing file*).

---

## 3. MATRIKS KOMPATIBILITAS SKEMA (DATA TERHADAP PRISMA)

| Entitas Data | Sumber Data Saat Ini | Jumlah Record | Kandidat Model Database | Kandidat Primary Key | Relasi & Foreign Keys | Tipe Data & Enum Kunci | Risiko Kehilangan Data & Penyesuaian |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| **Community Organizer** | `data/organizers.json` | 9 | `CommunityOrganizer` *(Model Baru)* | `id` (String / CUID) | Relasi opsional ke `Organization` | `status`: ACTIVE, PENDING, INACTIVE | Aman. Format data konsisten. |
| **Community Event** | `data/events.json` | 16 | `CommunityEvent` *(Model Baru)* | `id` (String, format `evt-*`) | Opsional ke `Organization`, 1-to-many ke `EventBooking` | `status`: APPROVED, PENDING, REJECTED | **Ada Risiko**: 2 event tidak punya `maxCapacity`, 6 event punya email di luar tabel komunitas. |
| **Event Booking / Tiket** | `data/event_bookings.json` | 8 | `EventBooking` *(Model Baru)* | `id` (String, format `tkt-*`) | Wajib ke `CommunityEvent(id)` | `paymentStatus`: PAID, PENDING, CANCELLED | **Ada Risiko**: 3 booking tidak punya `guestToken`. Wajib dibuatkan token saat ETL. |
| **Bukti Transfer Privat** | `data/proofs/` | 2 berkas | `EventPaymentProof` *(Model Baru)* | `id` (CUID) | 1-to-1 ke `EventBooking(id)` | `storageKey` (R2 Object Key), `sha256Checksum` | Aman. File fisik dipindahkan ke Cloudflare R2, path lokal diubah jadi R2 key. |
| **Gateway DOKU Log** | In-memory / Webhook | N/A | `DokuPaymentLog` *(Model Baru)* | `id` (CUID) | Relasi ke `EventBooking(id)` | `invoiceNumber` (Unique), `rawPayload` (Text) | Aman. Diperlukan untuk mencegah serangan replay (*replay attack*). |
| **F&B POS Orders** | `localStorage["dago_orders_v1"]` | Dinamis di Client | `Order`, `OrderItem` *(Model Eksisting)* | `id` (CUID) | Relasi ke `Tenant`, `Outlet`, `Customer` | `status`: PENDING, COMPLETED, CANCELLED | **Tinggi**: Data masih di peramban kasir. Butuh migrasi client-to-server. |
| **Resep & Bahan (BOM)** | `localStorage["dago_ingredients_v1"]` | Dinamis di Client | `InventoryIngredient`, `RecipeItem` *(Model Baru)* | `id` (CUID) | Relasi ke `Product(id)`, `Tenant(id)` | `quantity` (Decimal), `currentStock` (Decimal) | **Tinggi**: Perlu model baru di Prisma untuk pengurangan stok atomik. |
| **Kategori & Menu POS** | `localStorage["dago_products_v1"]` | Dinamis di Client | `Product`, `Category`, `ProductVariant` *(Model Eksisting)* | `id` (CUID) | Relasi ke `Outlet`, `Tenant` | `price` (Decimal), `isAvailable` (Boolean) | Model sudah ada di Prisma, tinggal sinkronisasi data dari client context. |

---

## 4. STRATEGI MIGRASI DAN PEMULIHAN (RECOVERY PLAN)

Prosedur migrasi saat staging/produksi telah disiapkan dengan batasan **non-destruktif**:

### 4.1 Tahapan Eksekusi ETL Idempotent (Mendatang)
1. **Pencadangan Pre-ETL**:
   - Salin direktori `data/` ke `.backups/pre_migration_snapshot_<timestamp>/`.
   - Simpan berkas `CHECKSUMS.sha256` berisi hash seluruh berkas data dan bukti bayar.
2. **Backfill Nilai Hilang (Sanitasi Pra-Migrasi)**:
   - Untuk 3 booking tanpa `guestToken`: generate token unik 64-karakter hex.
   - Untuk 2 event tanpa `maxCapacity`: tetapkan nilai default `50`.
3. **Pemuatan Bertahap Berdasarkan Hierarki Relasi**:
   - Level 1: `Organization` & `Tenant`
   - Level 2: `CommunityOrganizer`
   - Level 3: `CommunityEvent`
   - Level 4: `EventBooking`
   - Level 5: `EventPaymentProof` (unggah fisik ke Cloudflare R2 -> simpan metadata ke database)
4. **Idempotensi via `upsert`**:
   - Seluruh perintah Prisma menggunakan `prisma.model.upsert({ where: { id }, update: { ... }, create: { ... } })` sehingga proses dapat diulang jika terjadi *network timeout* tanpa menimbulkan duplikasi baris.

### 4.2 Strategi Rollback & Penolakan Dual-Write
* **Mengapa Dual-Write Ditolak**: Menulis bersamaan ke JSON dan PostgreSQL secara simultan rawan *split-brain*: jika database berhasil namun penulisan berkas JSON gagal (atau sebaliknya), status pembayaran dan nomor tiket akan menyimpang.
* **Strategi Rollback**:
  - Selama fase uji staging, berkas JSON lokal tetap menjadi acuan utama.
  - Pengalihan ke PostgreSQL hanya dilakukan pada tingkat Route Handler setelah seluruh pengujian rekonsiliasi bernilai 0 selisih.
  - Jika terjadi kendala pada serverless PostgreSQL, Route Handler dapat dibalikkan ke mode pembacaan JSON secara instan tanpa kehilangan transaksi baru melalui pencatatan delta log.

---

## 5. HASIL PENGUJIAN OTOMATIS & OFFLINE VERIFICATION

Verifikasi dilakukan melalui test suite otomatis:

| Perintah Pengujian | Berkas Uji | Hasil Aktual | Keterangan |
| :--- | :--- | :---: | :--- |
| **Offline ETL Validator** | `scripts/migrate-json-to-postgres.ts` | **LULUS (Exit 0)** | Berhasil mendeteksi seluruh anomali data warisan secara murni *read-only*. |
| **ETL Unit & Integrity Test** | `tests/etl-data-validation.test.ts` | **LULUS (4/4 passed)** | Verifikasi *masking PII*, aritmatika desimal pasti, dan deteksi ketiadaan `guestToken`. |
| **Payment Proof Security Test**| `tests/payment-proof-security.test.ts` | **LULUS (17/17 passed)**| RBAC, isolasi tenant, penolakan IDOR, dan penutupan folder publik terbukti aman. |
| **Login Security & RBAC Test** | `tests/login-security-and-data-integrity.test.ts` | **LULUS (20/20 passed)**| Pemblokiran eskalasi role, pemisahan akun demo dari akun publik terbukti aman. |
| **TypeScript Type-Check** | `npm run type-check` (`tsc --noEmit`) | **LULUS (Exit 0)** | 0 error TypeScript pada seluruh kode dan skrip validator baru. |

---

## 6. BLOCKER SEBELUM NEON & R2 STAGING

Sebelum akun Neon PostgreSQL dan Cloudflare R2 staging dibuat, blocker berikut perlu diselesaikan:

1. **Penyelarasan Nilai Hilang (`guestToken`)**:
   - Pemilik proyek perlu menyetujui bahwa 3 booking lama tanpa `guestToken` akan diberikan `guestToken` baru yang dibuat secara acak kriptografis saat migrasi ke database.
2. **Keputusan Relasi Organizer Event**:
   - Pemilik proyek perlu menyetujui bahwa relasi `CommunityEvent.organizerEmail` bersifat opsional di tingkat database agar 6 event yang dibuat oleh penyelenggara eksternal tidak ditolak oleh sistem.
3. **Penyetujuan Penambahan Model Skema Prisma**:
   - Skema `prisma/schema.prisma` belum dapat diubah sebelum pemilik proyek menyetujui penambahan model `CommunityEvent`, `EventBooking`, `EventPaymentProof`, dan `InventoryIngredient`.

---

## 7. PANDUAN MENJALANKAN DRY-RUN SECARA MANDIRI

Untuk memverifikasi laporan ini secara mandiri tanpa mengubah data apapun di lingkungan lokal:

1. **Jalankan Validator Offline**:
   ```bash
   node ./node_modules/tsx/dist/cli.mjs scripts/migrate-json-to-postgres.ts --dry-run
   ```
2. **Jalankan Unit Test ETL**:
   ```bash
   node ./node_modules/vitest/vitest.mjs run tests/etl-data-validation.test.ts
   ```
3. **Verifikasi Bahwa Berkas Data Tidak Berubah**:
   ```bash
   git status --short
   ```
   *Hasil akan membuktikan bahwa berkas `data/events.json`, `data/event_bookings.json`, dan bukti pembayaran tidak mengalami perubahan tanggal modifikasi maupun isi.*

---

*(Pekerjaan tahap persiapan non-destruktif selesai. Menunggu persetujuan pemilik proyek sebelum melangkah ke pembuatan resource cloud atau pengubahan skema Prisma).*

