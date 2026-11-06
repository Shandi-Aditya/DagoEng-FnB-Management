# DAGOENG — PRE-APPROVAL GATE & SCHEMA AUDIT CHECKLIST

**Tujuan Dokumen:** Evaluasi kesiapan final proposal skema database (`DAGOENG_PRISMA_SCHEMA_PROPOSAL.md`) sebelum pemilik proyek memutuskan untuk menerapkan perubahan pada `prisma/schema.prisma` dan target database PostgreSQL.  
**Tanggal Evaluasi:** 29 Oktober 2026  
**Status Evaluasi:** REVIEW ONLY — ZERO DATABASE MUTATION — STRICT READ-ONLY  
**Target Environment:** Neon Serverless PostgreSQL + Vercel Serverless Functions + Cloudflare R2  

---

## 1. DOKUMENTASI VERIFIKASI BASELINE REPOSITORY

Pemeriksaan integritas baseline Git dijalankan pada working tree aktual:

| Perintah Verifikasi | Hasil Eksekusi | Status |
|---|---|---|
| `git status --short` | *(Output kosong / bersih)* | Working tree bersih (terikat pada commit `a358ebb`) |
| `git diff --stat` | *(Output kosong)* | Tidak ada perubahan yang belum di-stage |
| `git diff -- prisma/schema.prisma` | *(Output kosong)* | **100% Tidak Termutasi** (32 model eksisting utuh) |
| `git diff -- DAGOENG_PRISMA_SCHEMA_PROPOSAL.md` | *(Output kosong)* | Dokumen proposal dalam kondisi stabil v2.0 |
| `npm run type-check` (`tsc --noEmit`) | `Exit Code: 0` (0 errors) | Integritas tipe TypeScript proyek terjaga sempurna |

> [!NOTE]
> Seluruh histori uncommitted sebelumnya telah diamankan dalam commit `a358ebb` pada branch `main`. Tidak ada secret, token, atau data PII yang terekspos.

---

## 2. DAFTAR TEMUAN YANG SUDAH DIVERIFIKASI SECARA TEKNIS

Berdasarkan audit menyeluruh terhadap kode sumber (`src/types/event.ts`, `src/lib/events.ts`, `src/lib/event-capacity.ts`, `src/app/api/webhooks/doku/route.ts`, `src/app/api/events/proofs/`):

1. **Kompatibilitas Tipe Primary Key & ID Legacy**:
   - Primary key PostgreSQL bertipe `String @id @default(uuid())` terbukti **mampu mempertahankan ID legacy** (`evt-*`, `tkt-*`, `org-comm-*`). Saat migrasi ETL, PostgreSQL menerima string manual tanpa penolakan tipe, sedangkan transaksi baru otomatis menggunakan UUID v4.
2. **Pemisahan Identitas Tiket**:
   - `id`: Primary key internal database (misal `tkt-1793179787698-cnwy9`, `tkt-latte-001`).
   - `ticketCode`: Kode referensi publik unik (misal `DAGO-EVT-72676`, `DAGO-EVT-77491`) untuk tiket fisik, QR scanner pintu masuk, dan invoice DOKU (`INV-DAGO-EVT-*`).
   - `guestToken`: Token privat acak berkekuatan tinggi (48 karakter hex) untuk akses mandiri tanpa login (`/events/tickets/[token]`).
3. **Kesesuaian Enum Aplikasi**:
   - `EventStatus`: `PENDING`, `APPROVED`, `REVISION_REQUESTED`, `REJECTED`, `ARCHIVED`.
   - `TicketPaymentStatus`: `PAID`, `PENDING`, `CANCELLED`, `EXPIRED`.
   - `AttendeeCheckInStatus`: `REGISTERED`, `PARTIALLY_CHECKED_IN`, `CHECKED_IN`.
   - `TicketPaymentMethod`: `FREE`, `QRIS`, `CASH`, `TRANSFER`, `DOKU_CHECKOUT`, `MANUAL_TRANSFER`.
4. **Isolasi Hak Akses Penyelenggara Publik**:
   - Dari 16 event di `data/events.json`, 10 terhubung ke organizer resmi di `data/organizers.json`, dan 6 diajukan oleh publik.
   - Pengaju publik **tidak memiliki akses edit atau hapus**. Perubahan event publik hanya dapat dilakukan oleh kurator platform melalui sesi terautentikasi `/events-admin`.
5. **Keamanan Bukti Pembayaran**:
   - Akses bukti pembayaran pada `/api/events/proofs/[filename]` dibatasi ketat: hanya sesi admin terverifikasi atau pemegang tiket sah via `?token=<guestToken>`.
   - Hash integritas biner **SHA-256** dan path penyimpanan Cloudflare R2 dicatat di database untuk audit anti-pemalsuan struk transfer.
6. **Ketahanan Webhook DOKU**:
   - Idempotensi terjamin via `requestId` unik (header `Request-Id`).
   - Rekonsiliasi *late-settlement* (`CANCELLED -> PAID`) terbukti aktif menangani transaksi yang dibayar tepat pada batas timeout.
   - Validasi HMAC signature mencegah *replay attack* atau injeksi webhook palsu.
7. **Isolasi Bahan Baku Multi-Outlet**:
   - `InventoryIngredient` discoping ke `(tenantId, outletId)`, memastikan stok fisik cabang Singaraja tidak bercampur dengan cabang lain.
   - Presisi desimal `Decimal(12, 3)` mencegah error pembulatan takaran gram/ml.
   - Idempotensi pengurangan stok order POS dilindungi oleh constraint komposit `@@unique([orderItemId, ingredientId, movementType])`.

---

## 3. TEMUAN YANG MASIH BERUPA ASUMSI (BELUM TERKONFIRMASI 100%)

1. **Kapasitas Fisik 2 Event Legacy**:
   - `evt-latte-art-2026` dan `evt-community-cleanup-2026` memiliki `maxCapacity: undefined`.
   - Nilai 50 pax pada kode saat ini hanyalah estimasi operasional sementara (`UNCONFIRMED_ESTIMATE`), **bukan kapasitas gedung yang telah diverifikasi**.
2. **Ketersediaan Bucket Cloudflare R2**:
   - Proposal mengasumsikan bucket private R2 (`dago-proofs-staging`) akan tersedia dengan permission read/write melalui S3-compatible SDK. Kredensial dan endpoint aktual belum diuji coba ke cloud.
3. **Ketersediaan Database Neon PostgreSQL Staging**:
   - Parameter koneksi (`DATABASE_URL`, `DIRECT_URL`) dan connection pooler (PgBouncer) diasumsikan mendukung batas koneksi serverless Vercel. Instance staging belum disediakan.
4. **Volume Transaksi Bersamaan (Concurrency Load)**:
   - Penggunaan `SELECT FOR UPDATE` diasumsikan cukup untuk skala traffic Dago Creative Hub saat ini. Untuk skala ribuan transaksi per detik (flash sale), arsitektur antrean terpisah (misal Redis) mungkin diperlukan.

---

## 4. BLOCKER TEKNIS SEBELUM IMPLEMENTASI

| No | Blocker Teknis | Dampak | Syarat Penyelesaian |
|---|---|---|---|
| **B-1** | **Database Staging Belum Tersedia** | Tidak bisa menjalankan `prisma migrate dev --create-only` atau verifikasi DDL | Pemilik proyek perlu menyediakan instance Neon PostgreSQL kosong khusus staging. |
| **B-2** | **Ketiadaan Migration History Eksisting** | Folder `prisma/migrations` belum ada di repository | Wajib membuat baseline migration `0_init_baseline` dari 32 model eksisting sebelum menambah model baru. |
| **B-3** | **Check Constraint pada Prisma Client** | Prisma schema native tidak mendukung sintaks `CHECK (checked_in_qty <= ticket_count)` secara langsung | Harus disuntikkan secara manual melalui SQL migration file (`migration.sql`). |
| **B-4** | **3 Booking Legacy Tanpa Token** | Kolom `guestToken` di-set `UNIQUE NOT NULL` | Script backfill token kriptografis wajib dijalankan saat ETL sebelum data di-*commit* ke PostgreSQL. |

---

## 5. KEPUTUSAN BISNIS YANG MEMERLUKAN PERSETUJUAN PEMILIK PROYEK

Sebelum schema dimodifikasi atau migrasi dijalankan, pemilik proyek wajib menetapkan pilihan resmi untuk butir-butir berikut:

1. **Keputusan Kapasitas 2 Event Warisan**:
   - *Pilihan A (Direkomendasikan)*: Tetap biarkan `maxCapacity: NULL` (`isCapacityConfirmed: false`) dan tutup penjualan tiket online untuk 2 event tersebut (`evt-latte-art-2026` dan `evt-community-cleanup-2026`) sampai kurator gedung mengisi kapasitas fisik riil.
   - *Pilihan B*: Tetapkan angka seragam (misal 50 pax) dengan risiko *overselling* jika ruangan aktual lebih kecil.
2. **Kebijakan Pemulihan Tiket untuk Booking Warisan Tanpa Token**:
   - *Catatan Faktual*: Halaman `/events/recover-ticket` **belum tersedia di codebase**.
   - Pemilik proyek wajib memilih:
     - **Alternatif A (Mandiri)**: Membangun rute `/events/recover-ticket` baru yang aman dengan validasi ganda (`ticketCode` + `guestEmail`) sebelum cutover publik.
     - **Alternatif B (Bantuan Manual)**: Tim admin melakukan verifikasi identitas manual via kanal resmi terdaftar kepada 2 pembeli tiket berbayar (`b***@gmail.com` dan `c***@gmail.com`) dan menyerahkan tautan tiket privat secara langsung tanpa mengekspos token di log sistem.
3. **Kebijakan Retensi Bukti Transfer Manual**:
   - *Pilihan A*: Hapus bukti transfer (soft delete / purge) 90 hari setelah event selesai untuk menghemat storage.
   - *Pilihan B (Direkomendasikan)*: Pertahankan selamanya di disk lokal sebagai *cold master backup* dan simpan di Cloudflare R2 untuk kebutuhan pembukuan, rekonsiliasi kasir, dan audit pajak tahunan.
   - *Hash Biner Terverifikasi*:
     - `proof-dago-evt-51628-1793179519555.png` (588.864 bytes): `05a9d413298885a99b7993e08809019fd464f62c0f75751c776ef7d6e40c3d24`
     - `proof-dago-evt-72676-1793179816938.png` (143.997 bytes): `bc37d23026012de4fdad3b5da743a3682fa007dfeec2f790cc6081faf4effa47`
4. **Scope Model Inventori (BOM)**:
   - Apakah penambahan 3 model inventori (`InventoryIngredient` dengan scoping `tenantId + outletId`, `RecipeItem`, `StockMovement`) diterapkan bersamaan dalam migration awal ini, atau dipisahkan ke rilis Fase 2 setelah Event Marketplace stabil?

---

## 6. RISIKO JIKA SKEMA DITERAPKAN SEKARANG

> [!WARNING]
> Menerapkan perubahan skema saat ini secara langsung akan menimbulkan risiko operasional berikut:

1. **Kegagalan Inisialisasi Database (No Baseline)**:
   Menjalankan `prisma migrate dev` tanpa database target yang valid akan memicu error koneksi atau merusak sinkronisasi lokal.
2. **Potensi Data Ingestion Incomplete**:
   Jika skema diubah di kode tetapi data JSON belum di-ETL, route handler API yang beralih ke database akan mengembalikan data kosong bagi pengunjung web.
3. **Client LocalStorage Desynchronization**:
   Beberapa sesi keranjang kasir atau preferensi filter yang tersimpan di browser user dapat terputus jika token otentikasi JWT / sesi di-reset tanpa mekanisme *graceful degradation*.

---

## 7. CHECKLIST FINAL SEBELUM PERUBAHAN SKEMA

- [ ] **Langkah 1**: Pemilik proyek menyetujui seluruh model dan relasi pada `DAGOENG_PRISMA_SCHEMA_PROPOSAL.md`.
- [ ] **Langkah 2**: Instance Neon PostgreSQL Staging telah aktif dan URL koneksinya telah diverifikasi (`DIRECT_URL` & `DATABASE_URL` bebas objek/tabel).
- [ ] **Langkah 3**: Keputusan bisnis terkait kuota event warisan dan pengiriman bantuan tiket telah disepakati.
- [ ] **Langkah 4**: Model baru ditambahkan ke `prisma/schema.prisma` di branch terisolasi (`feature/prisma-staging-migration`).
- [ ] **Langkah 5**: Baseline migration dibuat via `npx prisma migrate dev --name init_baseline --create-only`.
- [ ] **Langkah 6**: File `migration.sql` diperiksa secara manual untuk memastikan CHECK constraints (termasuk `max_capacity IS NULL OR max_capacity > 0`) dan indeks terpasang.
- [ ] **Langkah 7**: DDL diterapkan ke staging via `npx prisma migrate deploy` (larangan keras `prisma/seed.ts` dipatuhi).
- [ ] **Langkah 8**: Script ETL `scripts/migrate-json-to-postgres.ts` dijalankan dalam live-mode ke staging dengan upsert idempotensi.
- [ ] **Langkah 9**: Rekonsiliasi data memverifikasi 16 event, 8 booking (6 PAID = Rp506.000, 1 PENDING = Rp1.000.000, 1 CANCELLED = Rp200.000, Total = Rp1.706.000), 9 organizer, dan 2 bukti bayar cocok sempurna.

---

## 8. REKOMENDASI FORMAL: STRICT NO-GO

### Rekomendasi Resmi: **STRICT NO-GO UNTUK EKSEKUSI DATABASE, ETL, CUTOVER, DAN PROVISIONING INFRASTRUKTUR SAAT INI**

### Alasan Keputusan STRICT NO-GO:
1. Skema Prisma di codebase saat ini berstatus **produksi lokal stabil** (seluruh 573 unit/integration test lulus).
2. Database staging Neon PostgreSQL dan bucket Cloudflare R2 **belum disediakan** (`PENDING PROVISIONING`).
3. Empat keputusan bisnis pada Bagian 5 (terutama penanganan tiket warisan tanpa token dan kuota fisik event) memerlukan arahan definitif dari pemilik proyek.
4. Rute `/events/recover-ticket` belum tersedia di codebase sehingga cutover langsung akan mengunci akses tiket warisan.

### Langkah Selanjutnya Begitu Pemilik Proyek Siap:
1. Pemilik proyek membuat database staging di Neon dan mengisi file `.env.staging`.
2. Menyetujui keputusan bisnis terkait kapasitas dan penanganan tiket warisan.
3. Menginstruksikan tim teknis untuk berpindah ke mode implementasi bersyarat (`GATE-01`).

---
*Dokumen ini disusun sebagai gerbang kendali mutu (Quality Gate) non-destruktif. Tidak ada skema atau kode yang diubah selama proses review ini.*

