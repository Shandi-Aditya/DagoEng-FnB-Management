# Review pekerjaan redesign Gemini dan rencana perbaikan

Tanggal review: 11 November 2026. Cakupan: semua perubahan yang belum di-commit di `feat/shadcn-foundation` setelah `787a779` (56 file diubah, ±90 file baru, 11 file test baru).

## 1. Ringkasan

Gemini mengerjakan bagian **struktural** dengan cukup baik: halaman Fase 6 dipecah ke `src/features/<area>/`, logika dipindah ke modul `*-domain.ts` dengan test, dan test lama yang membaca teks sumber dipindahkan dengan benar. Tapi bagian **redesign**-nya belum dikerjakan. Yang terjadi adalah *reskin*: struktur, isi, dan copy halaman lama dipertahankan, lalu tag-nya diganti ke komponen shadcn. Di modal dan halaman Fase 7, bahkan hanya baris import yang diganti.

Pekerjaan ini **belum layak di-commit**: typecheck gagal dan ada 1 test baru yang gagal di luar baseline.

## 2. Yang sudah baik (pertahankan)

- File besar dipecah: `orders` 896 → 325, `inventory` 2038 → 466, `employees` 1697 → 373, `coworking` 1579 → 404, `pos` 2329 → 1493 baris.
- Modul domain murni beserta test: `orders`, `tables`, `inventory`, `customers`, `coworking`, `commercial`, `employees`, `reports`, `activity-log`, `ai-insight`, `pos-coworking`. Test sekarang 1000 lulus.
- Test C6 (`pos-c-bagian-c`) dipindah ke `OrderDetailModal.tsx` dengan aturan yang sama, sesuai pola handoff.
- Status memakai `StatusBadge` + fungsi tone, dan keadaan kosong memakai `EmptyState` di tabel-tabel baru.
- Ada komponen `DataPagination` di `src/components/app/`.

## 3. Temuan

### 3.1 Blocker

| # | Temuan | Bukti |
| --- | --- | --- |
| B1 | **Typecheck gagal**, jadi build juga gagal | `src/app/events/checkin/page.tsx:487` dan `:490` memakai `<Button asChild>`. Itu API Radix; Base UI memakai `render={<Link …/>}` + `nativeButton={false}`. Import `Button` diganti ke shadcn tanpa menyesuaikan pemakaiannya. |
| B2 | **Test baru gagal di luar baseline** | `tests/unified-account.test.ts` › "Kredensial akun terpadu otomatis sinkron dengan login organizer". Hasil: 5 gagal, padahal baseline 4. Penyebabnya belum ditelusuri (perintah test tunggal ditolak permission di sesi review). |
| B3 | **Tracker handoff melebih-lebihkan status** | `REDESIGN_HANDOFF.md` menulis modal POS "selesai, migrasi ke shadcn Dialog/Button", tapi `PaymentModal` masih memuat 278 kelas gaya lama, `DailyClosingPDFModal` 170, `ReceiptModal` 105, dan masih ada 62 overlay `fixed inset-0` di 21 file. |

### 3.2 Hanya ganti import (belum redesign sama sekali)

Diff file-file ini cuma 3–4 baris, tapi diperlakukan seolah sudah ikut migrasi. Gaya lamanya utuh, lalu dicampur dengan komponen baru, misalnya `Button` shadcn dengan override `rounded-xl bg-brand-sage hover:bg-[#2E6044]`.

| File | Sisa kelas gaya lama |
| --- | --- |
| `settings/page.tsx` | 3375 |
| `events/portal/page.tsx` | 2592 |
| `(mobile)/customer/page.tsx` | 2111 |
| `events-admin/page.tsx` | 1797 |
| `events/[id]`, `events/submit`, `events/checkin`, `events/tickets/[token]` | 550–807 per file |
| `PrinterSettingsTab`, `PaymentWaitingModal`, `checkout-link-v2`, `events/activate`, `events/tickets/recovery`, `(mobile)/waiter` | 94–443 per file |

Ini termasuk Fase 7 yang menurut rencana harus **dipecah dulu**, baru dimigrasi. Mencampur dua sistem justru membuat file-file ini lebih sulit dibersihkan nanti.

### 3.3 Reskin, bukan redesign (halaman Fase 6)

Halaman yang dipecah memang sudah bersih dari kelas lama, tapi keputusan desain dari UI lama dibawa apa adanya.

- **Tata letak tidak dipikir ulang.** Contohnya `/orders`: tabel tetap 9 kolom (dua kolom status, ditambah waktu tunggu, SLA, dan metode bayar), tanpa pencarian dan tanpa filter status. Padahal pertanyaan utama di layar ini adalah "pesanan mana yang perlu ditindak".
- **Tidak ada momen.** Struk, nota dapur, dan laporan tidak dibuat sebagai "benda nyata" seperti tiket KDS.
- **Override ukuran melawan design system.** Hampir setiap `Button` diberi `className="h-8 gap-1.5 text-xs"` atau sejenisnya, jadi skala dan permukaan tombol yang sudah disepakati tidak konsisten.
- **Warna dipakai sebagai hiasan.** Ikon diberi warna semantik tanpa makna, misalnya ikon Excel `text-success` dan ikon restock `text-warning` padahal tidak ada peringatan.
- **Duplikasi.** `DataPagination` dibuat, tapi `OrdersTable`, `InventoryStockTab`, `ActivityLogTableView`, dan `ActivityLogTimelineView` masih memakai pagination inline masing-masing. Delapan modal laporan PDF (`*ReportPDFModal`) juga hampir identik dan bisa jadi satu komponen.
- **Enum mentah tampil ke user**, misalnya kolom SLA berisi `ON TIME` atau `AT RISK` lewat `.replace("_", " ")`.

### 3.4 Copywriting

Copy lama dipindah apa adanya, tanpa disunting.

- **Title Case**, padahal aturannya sentence case: "Status Operasional", "Status Pembayaran", "Total Tagihan", "Metode Bayar", "Bahan Baku", "Shift Penugasan", "Stok Fisik", "Catatan Khusus", "Buat PO Baru", "Laporan Valuasi", "Peringatan Restock".
- **Campuran bahasa**: "Export Excel", "Export CSV", "Timeline", "SLA Status", "Waste Operasional", "Store Manager", "Sample Promo".
- **Judul terlalu panjang dan berupa deskripsi**: "Riwayat & Pelacakan Pesanan", "Inventori & Bahan Baku · Singaraja". Judul cukup menyebut konteks ("Pesanan", "Inventori"), sementara outlet sudah tampil di header.
- **Copy generik atau marketing**: "Smart Inventory", "Sistem Terintegrasi DAGO (Simulasi QRIS / Tunai)", "Dago Creative Hub Operations", "Verifikasi Sistem Otomatis", "Tervalidasi Digital".
- **Nada kaku**: "Mohon lengkapi nama dan nomor WhatsApp tamu." Lebih baik langsung: "Isi nama dan nomor WhatsApp tamu."
- **Toast berisi jargon teknis**, misalnya "Stok BOM dipotong". Kasir tidak perlu tahu itu.
- **Satuan ditempel di angka KPI**, misalnya `12 Bahan`. Angka dan satuan sebaiknya dipisah supaya `tabular-nums` rapi.

### 3.5 Verifikasi visual

Tidak ada bukti bahwa halaman-halaman ini sudah dicek di terang, gelap, dan mobile. Review ini juga belum bisa mengeceknya karena akses browser ditolak permission. Rencana perbaikan di bawah memasukkan langkah ini.

## 4. Rencana perbaikan

> Status: **P0 selesai** (`64964f4`, `799780c`), **P1 selesai** (`npm run lint:ui`, glosarium di `DESIGN_SYSTEM.md` bagian 8, Definition of Done di `REDESIGN_HANDOFF.md` bagian 5a). **P2 selesai** (belum di-commit): copy di semua fitur Fase 6 disunting sesuai glosarium. P3 selesai: seluruh halaman operasional selesai/dilewati sesuai konfirmasi (termasuk `/pos` mode co-working). P4 berjalan: Modal POS (`PaymentModal.tsx` selesai P4); lihat tracker di handoff. Celah yang ditemukan: aturan `button-size-override` di `lint:ui` tidak menangkap `<Button>` yang atributnya ditulis multi-baris.

> Catatan P2:
> - Label domain baru: `slaStatusLabel`, `paymentMethodLabel` (orders), `getEmployeeStatusLabel`, `OPNAME_REASONS` sebagai satu sumber daftar alasan opname.
> - Bug yang ikut diperbaiki: status pesanan `READY` dan status meja `BILLING` tampil sebagai enum mentah; `SERVED` dilabeli "Siap disajikan"; `slaStatusTone` mengecek `ON_TRACK` sehingga pesanan tepat waktu berwarna netral; laporan penjualan mengisi metode bayar kosong dengan "QRIS"; ejaan "Kadaluwarsa".
> - Klaim tanpa dasar data dihapus: "Status audit: Terverifikasi sistem", "Keamanan log: Immutable", "Gateway: Sistem terintegrasi", badge "Data tersinkronisasi", dan kalimat analisis AI insight yang tidak dihitung (misalnya "margin pada kisaran optimal", "retensi stabil"). AI insight kini hanya menyebut angka yang dihitung.
> - Teks pilihan metode bayar sewa dan co-working diganti (mis. "QRIS DagoPay" → "QRIS"); `value` tetap, kecuali modal pembayaran sewa yang kini menyimpan string baru (`Transfer BCA`, `QRIS`, `Tunai`). Tidak ada kode yang membandingkan string itu; data lama tetap tampil apa adanya.
> - Di luar cakupan P2: `*ReportPDFModal` (akan dilebur di P3), `BOMRecipeModal` (P4). Temuan untuk diputuskan user: tombol "AI Generate" di `BOMRecipeModal` bukan AI, melainkan template kata kunci yang mengisi resep dengan ID bahan palsu (`ing-1`…`ing-8`) dan harga karangan, sehingga resep tersimpan bisa menunjuk bahan yang tidak ada di inventori.
> - `lint:ui` hampir tidak berubah (mis. orders 33 → 32) karena P2 hanya menyentuh copy; penurunan angka itu target P3.

Urutannya disusun supaya branch cepat hijau lagi, lalu kualitas dinaikkan halaman demi halaman.

### P0 — Pulihkan branch (blocker, ±setengah hari)

1. Perbaiki `asChild` di `events/checkin/page.tsx` dengan pola `render` + `nativeButton={false}`, lalu cari pola yang sama di file lain: `grep -rn "asChild" src`.
2. Telusuri dan perbaiki `unified-account.test.ts`. Cek apakah penyebabnya perubahan Gemini atau data `data/*.json` di working tree.
3. Untuk file di bagian 3.2: **kembalikan swap import-nya ke legacy** (`git checkout -- <file>`, setelah dipastikan tidak ada perubahan lain di file itu). Halaman-halaman ini dikerjakan ulang dengan benar di P4.
4. Koreksi `REDESIGN_HANDOFF.md`: modal POS kembali ke status "berjalan", dan status halaman Fase 6 diganti ke "struktur selesai, redesign belum".
5. Verifikasi: `tsc`, `vitest` (kembali ke baseline 4 gagal), dan `npm run build`.
6. Commit dalam dua bagian supaya mudah di-revert:
   - `refactor(ops): split operational pages into feature modules`
   - `docs: correct redesign tracker`

### P1 — Pagar pengaman dan definisi "selesai" (±setengah hari)

Supaya kejadian serupa tidak terulang dengan agent mana pun:

1. Majukan sebagian Fase 8 sekarang. Tambahkan skrip `npm run lint:ui -- <path…>` yang menghitung pola terlarang (warna mentah, `dark:` untuk warna, `brand-*`, `font-bold/black`, `uppercase`, `text-[≤11px]`, `transition-all`, `scale`, emoji, `fixed inset-0`, `asChild`, `className` ukuran pada `Button`). Untuk sementara skrip hanya melapor (non-blocking) dan dijalankan untuk file yang disentuh.
2. Tambahkan **glosarium copy** di `DESIGN_SYSTEM.md`: istilah baku (Ekspor, Riwayat, Tagihan, Bahan, Pemasok, Opname), label status dalam bahasa Indonesia, larangan "Mohon/Silakan/Berhasil!", dan pola toast (judul pendek + deskripsi opsional).
3. Tambahkan **Definition of Done per halaman** di handoff. Status "selesai" hanya boleh dipakai kalau:
   - `lint:ui` menghasilkan 0 temuan di file yang disentuh,
   - tidak ada override `className` ukuran pada `Button`,
   - copy sudah lolos glosarium,
   - tersedia screenshot terang, gelap, dan mobile,
   - ada catatan "keputusan desain" (apa yang diubah dari layout lama dan alasannya).

### P2 — Pass copy (±1 hari)

Sapu semua file `src/features/{orders,tables,inventory,customers,coworking,commercial,employees,reports,activity-log,ai-insight}` dan `pos/Coworking*`:

- Ubah ke sentence case, satu bahasa, dan judul pendek.
- Ganti enum mentah dengan fungsi label (pola `orderStatusLabel` sudah ada, terapkan juga ke SLA, metode bayar, dan tipe ruang).
- Buang copy marketing dan jargon dari toast.
- Pisahkan satuan dari angka di `StatCard`.

### P3 — Redesign halaman Fase 6 (±1 halaman per sesi)

Kerjakan per halaman, mulai dari `/orders`, `/inventory`, `/tables`, lalu `/coworking`. Setiap halaman dimulai dengan menulis **tugas utama layar** dalam satu kalimat, lalu tata letaknya disusun dari situ. Usulan awal:

| Halaman | Tugas utama | Perubahan |
| --- | --- | --- |
| `/orders` | Menemukan pesanan yang perlu ditindak | `Tabs` status (Perlu bayar, Diproses, Selesai, Batal) dengan jumlah per tab, pencarian nomor/meja/nama, kolom diringkas jadi pesanan, meja, status, waktu (dengan titik SLA), dan total. Detail dibuka di `Sheet` samping. Ekspor masuk `DropdownMenu`. Pagination memakai `DataPagination`. |
| `/inventory` | Tahu bahan apa yang harus dibeli | Ringkasan "perlu dibeli" di paling atas (daftar bahan kritis + tombol "Buat PO" sebagai satu-satunya aksi primary). Tab Stok, Resep, PO, dan Opname. Aksi sekunder masuk menu. Hanya KPI yang butuh perhatian yang diberi warna. |
| `/tables` | Melihat meja kosong sekarang (berjalan sapuan tabel P3, menunggu cek visual & build) | Denah sebagai tampilan utama, status meja semantik, detail di modal Dialog, tabel reservasi tanpa `EmptyState` dalam sel + `DataPagination` + responsif mobile (`lint:ui` 0, `tsc` 0, `vitest` 9/9). |
| `/coworking` | Melihat dan mengatur pemakaian ruang hari ini (berjalan sapuan tabel P3, menunggu cek visual & build) | Toolbar 1 primary + dropdown ekspor, ketiga tabel tanpa `<Card>` + `DataTableToolbar` bersama + `DataPagination` + responsif mobile (`lint:ui` 0 di file disentuh, `tsc` 0, `vitest` 13/13). |
| `/customers` | Mencari pelanggan atau member lalu bertindak (berjalan sapuan tabel P3, menunggu cek visual & build) | Toolbar 1 primary + dropdown ekspor, tabel tanpa `<Card>` + `DataTableToolbar` bersama + `DataPagination` + menu aksi ringkas + `"poin"` (`lint:ui` 0 di file disentuh, `tsc` 0, `vitest` 7/7). |
| `/employees` | Memantau shift kasir dan data staf (berjalan sapuan tabel P3, menunggu cek visual & build) | Toolbar 1 primary + dropdown ekspor, kedua tabel tanpa `<Card>` + `DataTableToolbar` bersama + `DataPagination` + menu aksi ringkas (`lint:ui` 0 di file disentuh, `tsc` 0, `vitest` 9/9). |
| `/commercial` | Mencari kontrak lalu bertindak (berjalan sapuan tabel P3, menunggu cek visual & build) | Toolbar 1 primary + dropdown ekspor, tabel tanpa `<Card>` + `DataTableToolbar` bersama + `DataPagination` + responsif mobile (`lint:ui` 0 di file disentuh, `tsc` 0, `vitest` 6/6). |
| `/reports` | Memilih jenis laporan, membaca dan mencari rinciannya, lalu cetak/ekspor (berjalan P3, menunggu cek visual) | Kategori jadi bar `Tabs` seperti `/orders` dengan angka murni, tabel tanpa `<Card>` (nol gap kosong) + `DataPagination` + pencarian, enum mentah di `EVENTS`/`INVENTORY`/`FINANCE_AUDIT` dibersihkan (`lint:ui` 0 di file disentuh, `tsc` 0 error, `vitest` 1047/1051, `build` hijau). |
| `/activity-log` | Menelusuri catatan perubahan data lalu periksa detail/ekspor (berjalan P3, menunggu cek visual & build) | Header 1 primary + dropdown `Ekspor`, 3 `StatCard` faktual, `Tabs` `Tabel`/`Riwayat` + `NativeSelect`, tabel 5 kolom tanpa `<Card>` + `DataPagination`, detail di `Sheet` samping, seluruh enum diterjemahkan (`lint:ui` 0 di 9 file disentuh, `tsc` 0 error, `vitest` 1050/1054; `ActivityLogPDFModal` ditunda ke P4). |
| `/ai-insight` | Menanyakan ringkasan performa operasional lalu bertindak (selesai `eed5d67`, P3) | Header bersih `PageHeader`, prompt cepat `AIInsightQuickPrompts` bersih tanpa label slop/titik dua, container chat `h-[560px]` adaptif tanpa slop cyberpunk (`uppercase tracking-wider font-bold` dan `text-[10px]/[11px]`), rekomendasi tindakan memakai `Button` outline semantik dengan `ArrowUpRight`, button submit `size="default"`, copy dan glosarium baku (`"omzet"`, fallback `"Semua outlet"`, `"Menu terlaris"`). (`lint:ui` 0, `tsc` 0, `vitest` 9/9 lulus). |
| `/events-admin` | Memoderasi pengajuan event dan memverifikasi pembayaran tiket manual (selesai `24e88e7`, P3) | Pemecahan file 4.700 baris menjadi modul terfokus di `features/events-admin/`; migrasi total dari `@/components/legacy/ui/*` ke shadcn; header 1 primary (`Tambah event`) + dropdown `Lainnya`; 4 sub-modul ditata di `EventsAdminTabs` dengan counter antrean murni; 3 `StatCard` faktual; tabel moderasi, pembayaran, dan pencairan saldo diselaraskan ke gaya tabel bersama + `DataPagination`; detail pengajuan dipindah ke `Sheet` samping (`EventDetailSheet`); menghapus 1.786 temuan slop/cyberpunk (`uppercase`, `tracking-wider`, `text-[10px]`, `font-black`, `bg-brand-sage`, hex); pembersihan enum mentah dan copy glosarium (`"payout"` → `"pencairan saldo"`). (`lint:ui` 0 di 18 file disentuh, `tsc` 0, `vitest` 11/11 lulus). |
| `/settings` | Memilih kategori pengaturan lalu mengubah atau menyimpan aturan bisnis (selesai, `59fa12a`, Fase 7/P3) | Pemecahan file monolitik 8.371 baris `settings/page.tsx` + 1.015 baris `PrinterSettingsTab.tsx` menjadi modul terfokus di `features/settings/`; menyatukan tabel menu admin dan tenant ke satu komponen `ProductsCatalogTab`; merapikan 20 modal manual `fixed inset-0` menjadi `Dialog`, `Sheet` samping (`PartnerDetailSheet`), dan `ConfirmDialog`; menggantikan seluruh toast alert inline buatan dengan `notify()`; menghapus seluruh 3.694 temuan slop (warna mentah, dark color, teks 10px, uppercase tracking-wide, emoji); menandai simulasi secara jujur tanpa klaim palsu (`"GATEWAY AKTIF"` / `"Real-time"`). (`lint:ui` 0 di 13 file disentuh, `tsc` 0 error, `vitest` 1081/1084, `build` 37/37 hijau). |
| `/customer` | Memesan menu F&B, sewa ruang, periksa tiket, atau tukar poin secara mandiri (selesai, `59fa12a`, Fase 7/P3) | Pemecahan file monolitik 6.116 baris `customer/page.tsx` menjadi 10 modul terfokus di `features/customer/`; kartu member digital bersih dengan angka mono tanpa gradien ungu-hitam & blur blob 80px; checkout mandiri dipindah ke `CustomerCheckoutSheet` samping/bawah; modal booking ruang (`CustomerBookingModal`) dan e-tiket QR pass (`CustomerTicketPassModal`) dimigrasi ke shadcn; menghapus seluruh 2.035 temuan slop (glow, scale, emoji, text < 12px, warna mentah). (`lint:ui` 0 di 12 file disentuh, `tsc` 0 error, `vitest` 10/10 lulus). |
| `/events/portal` | Memantau status moderasi event, verifikasi check-in QR, dan kelola pencairan bagi hasil (selesai, belum commit Fase 7/P3) | Redesign portal penyelenggara: ringkasan tindakan, kartu event berikutnya, saldo per event, alur check-in QR, dan form pengajuan event internal (`?view=submit`). Akses publik `/events/submit` ditutup dan dialihkan ke portal. Hanya `/events` dan `/events/[id]` yang dapat diakses publik. |
| `/events` | Mencari dan memesan tiket kegiatan komunitas (selesai, belum commit Fase 7/P3) | Redesign katalog publik event: navbar publik bersih, hero tenang tanpa gradien neon berlebih, `EventsCatalogToolbar` (tabs waktu, pencarian `InputGroup`, filter harga `NativeSelect`, chips kategori), kartu `EventCard` semantik dengan badge kategori resmi sentence case, harga mono tabular, dan `DataPagination` + `EmptyState` resmi. |
| `/events/[id]` | Membaca informasi detail event dan memesan/mendaftar tiket (selesai, belum commit Fase 7/P3) | Redesign detail publik event: navbar atas bersih dengan tautan kembali dan bagikan, poster 16:9 tanpa glow blur artifisial, grid 2 kolom dengan sticky ticket box, bilah kuota tiket terpadu, 4 modal manual `fixed inset-0` diubah ke shadcn `Dialog` (`EventBookingDialog`, `EventPaymentGuideDialog`, `EventTicketPassDialog`, `EventShareDialog`), dan mobile bottom CTA bar. |

Hapus override `h-8 text-xs` pada `Button`. Ukuran cukup lewat prop `size`.

### P4 — Modal POS dan Fase 7 (sesuai rencana awal)

1. Modal POS (`PaymentModal`, `ReceiptModal`, `KitchenOrderReceiptModal`, `CashDrawerShiftModal`, `DailyClosingPDFModal`, `PaymentWaitingModal`) dipindah ke `Dialog`/`AlertDialog` sungguhan. Struk dan nota dibuat sebagai benda nyata (`font-mono tabular-nums`, lebar 80mm). Test D1, C3, dan C4 tetap dijaga.
2. Fase 7 (`settings`, portal customer, portal event, `events/*`, `checkout-link-v2`, `waiter`): **pecah dulu tanpa ubahan visual** di satu commit, baru dimigrasi di commit berikutnya, sesuai rencana bagian 11.

## 5. Cara menjalankan scan yang dipakai di review ini

Path dengan tanda kurung seperti `(dashboard)` harus dilewatkan dengan aman (pakai `xargs -0`):

```bash
git diff --name-only -- src > /tmp/touched.txt; git ls-files --others --exclude-standard src >> /tmp/touched.txt
```

```bash
tr '\n' '\0' < /tmp/touched.txt | xargs -0 grep -cE "(bg|text|border)-(slate|emerald|amber|rose|blue|orange)-[0-9]+|brand-(sage|orange)|dark:(bg|text|border)-|font-(black|extrabold|bold)|uppercase|text-\[(8|9|10|11)px\]|transition-all|fixed inset-0|asChild" | grep -v ":0$" | sort -t: -k2 -rn
```
