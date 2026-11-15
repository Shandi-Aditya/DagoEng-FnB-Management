# Playbook redesign per halaman (P3)

Resep langkah demi langkah untuk me-redesign satu halaman Fase 6. Ini cara yang dipakai untuk `/orders` (`80ec405`) dan `/inventory`. Kerjakan **satu halaman per sesi**, urut dari langkah 0 sampai 10, dan jangan melompati langkah.

Dokumen ini melengkapi, bukan menggantikan:

- [REDESIGN_HANDOFF.md](./REDESIGN_HANDOFF.md): tracker, aturan, keamanan data, Definition of Done (bagian 5a).
- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md): token, komponen, dan **bagian 8 Copy** (glosarium dan aturan pesan).

## 0. Apa bedanya "redesign" dengan "ganti tag"

Pekerjaan sebelumnya ditolak karena hanya mengganti `<div>` lama ke komponen shadcn dan mempertahankan tata letak lama. Itu **belum** redesign. Redesign berarti:

| Bukan redesign | Redesign |
| --- | --- |
| Tabel 9 kolom yang sama, sekarang pakai `<Table>` shadcn | Tanya dulu kolom mana yang dipakai untuk memutuskan sesuatu, buang atau gabungkan sisanya (9 → 6 kolom di `/orders`) |
| 4 tombol outline sejajar di header (Excel, CSV, PDF, Tambah) | Satu tombol primary; sisanya masuk `DropdownMenu` "Lainnya" atau "Ekspor" |
| Info penting tersembunyi di balik tombol yang membuka modal | Info itu tampil langsung di halaman (`ReorderPanel` menggantikan `RestockAlertModal`) |
| 4–6 `StatCard` yang semuanya angka | Maksimal 3 angka, hanya yang dipakai untuk bertindak |
| Kartu angka bernilai 0 tetap tampil saat belum ada data | Sembunyikan, atau ganti satu baris kalimat tenang |
| Kolom menampilkan enum (`PENJUALAN_RESEP`, `Dairy`) | Lewat fungsi label di modul domain (`Terjual`, `Susu dan olahan`) |
| Teks "2 Hari ke Depan" ditulis langsung | Nilai nyata yang dihitung (`deliveryDateLabel`) |
| Default filter "Semua" | Default ke antrean yang perlu ditindak ("Perlu dibayar") |

Kalau setelah selesai layout halaman masih bisa ditumpuk di atas layout lama dan terlihat sama, ulangi dari langkah 2.

## 1. Pemetaan (baca dulu, belum menulis apa pun)

```bash
wc -l "src/app/(dashboard)/<halaman>/page.tsx" src/features/<area>/*
```
```bash
npm run lint:ui -- src/features/<area> "src/app/(dashboard)/<halaman>/page.tsx"
```
```bash
grep -rln "features/<area>/\|<halaman>/page.tsx" tests
```

Lalu baca `page.tsx` dan **semua** file di `src/features/<area>/`. Catat di catatan kerja (bukan di kode):

1. Apa yang tampil di layar pertama, dari atas ke bawah.
2. Semua tombol di header dan toolbar, dan berapa yang terlihat "primary".
3. Semua kolom tabel, dan untuk tiap kolom: keputusan apa yang dibantu oleh kolom ini?
4. Semua teks yang terlihat user. Tandai yang melanggar glosarium, enum mentah, string buatan ("2 Hari ke Depan", "Kebutuhan stok operasional mingguan" sebagai isi default form), dan klaim palsu ("Real-time", "AI", angka contoh).
5. Test mana yang membaca file sumber area ini dan string apa yang dikuncinya (contoh: test C6 mengunci `canViewNominals && (() => {` di `OrderDetailSheet.tsx`). String itu wajib tetap ada di file tujuannya.
6. Hasil `lint:ui` per file. File yang sengaja ditunda (`BOMRecipeModal`, semua `*ReportPDFModal`, `*PDFModal`) dicatat, tidak disentuh.

## 2. Tugas utama layar dan keputusan desain

Tulis satu kalimat: **"Di layar ini staf perlu ___, lalu ___."** Pakai usulan di [REDESIGN_REVIEW_GEMINI.md](./REDESIGN_REVIEW_GEMINI.md) bagian P3 sebagai titik awal, tapi periksa ulang terhadap data dan kode yang sebenarnya.

Dari kalimat itu tentukan, dan tulis sebagai daftar sebelum mulai coding:

- **Yang dilihat pertama** (di atas lipatan): informasi yang menjawab tugas itu.
- **Satu aksi primary.** Hanya satu `Button` default di header. Semua aksi lain `variant="outline"`, `ghost`, atau masuk menu.
- **Yang dipindah:** ke `DropdownMenu`, ke `Sheet` samping (detail baris), ke tab, atau dihapus.
- **Kolom tabel final** dan kolom mana yang disembunyikan di tablet (`hidden md:table-cell`) dan di mobile (`hidden sm:table-cell`).
- **Keadaan kosong** untuk setiap daftar: tanpa data vs hasil filter kosong (dua pesan berbeda).
- **Minimal satu keputusan yang berbeda dari layout lama**, beserta alasannya. Ini wajib masuk tracker.

Contoh yang sudah jadi:

- `/orders`: "menemukan pesanan yang perlu ditindak, lalu bayar atau cetak" → antrean `Tabs` dengan jumlah, default "Perlu dibayar", detail di `Sheet`.
- `/inventory`: "tahu bahan apa yang harus dibeli, lalu buat PO" → panel "Perlu dibeli" di atas, "Buat PO" satu-satunya primary.

Buka file contoh ini sebagai acuan gaya kode sebelum menulis: `src/features/orders/{OrdersToolbar,OrdersTable,orders-queue}.ts*`, `src/features/inventory/{InventoryToolbar,ReorderPanel,InventoryStockTab,inventory-reorder}.ts*`.

## 3. Logika murni dulu, dengan test (TDD)

Semua keputusan yang bukan tampilan (filter antrean, urutan, saran jumlah, label enum, format tanggal) masuk ke modul murni `src/features/<area>/<nama>.ts`. Contoh: `orders-queue.ts`, `inventory-reorder.ts`.

1. Tulis `tests/<nama>.test.ts` lebih dulu, pola Arrange-Act-Assert, nama test menjelaskan perilaku.
2. Jalankan sampai **gagal** (`npx vitest run tests/<nama>.test.ts`), baru implementasi sampai lulus.
3. Aturan:
   - Jangan memutasi input. `filter(...)` dulu (membuat salinan), baru `sort`. **Jangan** pakai `toSorted` (target ES2022).
   - Tanggal tampil memakai `toLocaleDateString("id-ID", { ..., timeZone: "Asia/Makassar" })`.
   - Fungsi label mengembalikan fallback yang wajar untuk nilai tak dikenal (nilai aslinya, atau "—").
   - Angka ambang diberi nama konstanta (`CRITICAL_RATIO`, `VISIBLE_LIMIT`), bukan angka telanjang.
4. Kalau label untuk enum sudah ada di `<area>-domain.ts`, pakai itu. Jangan menduplikasi.

## 4. Tulis ulang komponen

Urutan: header/toolbar → bagian "yang dilihat pertama" → konten utama (tabel/tab) → tab lain → modal milik halaman ini.

**Boleh menulis ulang file komponen dari nol.** Itu lebih cepat dan lebih bersih daripada mengedit kelas satu per satu. Yang **tidak boleh** berubah:

- State dan handler transaksi di `page.tsx` (bayar, simpan, terima PO, dsb.) dan panggilan ke context. Komponen hanya menerima props dan callback.
- String yang dikunci test (langkah 1 poin 5).
- Nama prop yang dipakai halaman lain.

Pola komponen yang wajib dipakai:

| Kebutuhan | Pakai |
| --- | --- |
| Judul halaman + aksi | `PageHeader` dari `@/components/app/page-header` dengan prop `actions` |
| Angka ringkasan | `StatCard` (`label`, `value`, `hint`, `className`); grid `grid-cols-2 sm:grid-cols-3`, kartu terpenting `col-span-2 sm:col-span-1` |
| Status | `StatusBadge status="success\|warning\|info\|destructive\|neutral"` |
| Daftar kosong | `EmptyState` dengan `className="border"`, `icon`, `title`, `description` |
| Pagination | `DataPagination` (`currentPage`, `totalItems`, `pageSize`, `onPageChange`, `onPageSizeChange`, `itemLabel`) |
| Pencarian | `InputGroup` + `InputGroupAddon` (ikon `Search`) + `InputGroupInput type="search"` dengan `aria-label` |
| Filter | `NativeSelect` + `NativeSelectOption`, dengan `aria-label` |
| Aksi sekunder | `DropdownMenu` + `DropdownMenuTrigger render={<Button variant="outline" />}` + `ChevronDown` |
| Detail satu baris | `Sheet` samping (contoh `OrderDetailSheet.tsx`) |
| Antrean/tampilan | `Tabs`; jumlah per tab memakai `<Badge variant="secondary">` di dalam `TabsTrigger` |
| Toast | `notify.success\|error\|warning\|info(judul, deskripsi?)` |

Aturan kelas yang paling sering dilanggar:

- **Jangan** memberi `className` ukuran pada `Button` (`h-8`, `text-xs`, `px-2`, `gap-1.5`). Ukuran hanya lewat `size="sm" | "default" | "lg" | "icon"`. Ikon di dalam `Button` tanpa kelas ukuran. Aturan ini juga berlaku kalau atribut ditulis multi-baris (lint tidak menangkapnya, jadi periksa sendiri).
- **Jangan** `text-[10px]` atau `text-[11px]`. Minimum `text-xs`.
- **Jangan** `uppercase`, `tracking-*`, `font-bold`/`font-semibold` untuk label. Judul kartu `text-sm font-medium`.
- **Jangan** warna mentah (`text-emerald-500`, `bg-slate-800`, hex, `dark:`). Pakai `text-success`, `text-warning`, `text-destructive`, `text-muted-foreground`, `bg-muted`.
- Angka uang dan jumlah: `font-mono tabular-nums` **hanya pada angkanya**, satuan di luar span mono (`<span className="font-mono tabular-nums">20</span> Liter`).
- Sel tabel yang berisi nama panjang diberi `className="whitespace-normal"` agar membungkus di mobile.
- Kolom aksi di mobile: tombol jadi ikon (`<span className="hidden sm:inline">Label</span>`) dengan `aria-label`.
- Kolom yang kehilangan header teks (aksi) diberi `<span className="sr-only">Aksi</span>`.
- Kartu yang bisa diklik dijadikan `<button>`, bukan `div onClick`.
- Base UI: tidak ada `asChild`. Pakai `render={<Link href="…" />}` dengan `nativeButton={false}`. `Tabs` `onValueChange` memberi `unknown`, jadi cast ke union-nya.
- **Modal & Dialog**:
  - Wajib `p-0 gap-0 max-h-[88vh] h-[88vh] flex flex-col overflow-hidden` pada `DialogContent` agar tidak meluap ke bawah viewport.
  - Pembungkus scroll dalam wajib `flex-1 min-h-0 overflow-y-auto overflow-x-auto` dan pasang reset `scrollTop = 0` via `requestAnimationFrame` saat `isOpen`.
  - Tabel dalam modal wajib `w-full min-w-[760px] sm:min-w-0 table-fixed` dengan `<colgroup>` persentase (total 100%) dan `break-words` di sel teks agar kolom kanan (alasan bisnis/status) tidak terpotong (cropped).
  - Modal cetak PDF: gunakan invisible iframe dengan dimensi fisik A4 (`width: 210mm; height: 297mm; position: fixed; left: -9999px; visibility: hidden;`), sertakan `<base href="${window.location.origin}/" />`, link Google Fonts CDN (DM Sans & DM Mono), dan delay 400ms sebelum memanggil `iframe.contentWindow?.print()`. Jangan gunakan iframe 0x0 atau `window.print()` langsung pada modal (memicu halaman 1 cetak kosong/blank). Lihat detail di `docs/DESIGN_SYSTEM.md` bagian 7.

## 5. Copy

Setiap teks yang terlihat user diperiksa terhadap `DESIGN_SYSTEM.md` bagian 8. Ringkasan cepat:

- Sentence case di semua tempat: `Pesanan pembelian`, bukan `Purchase Order`.
- Judul halaman 1–2 kata (`Inventori`). Deskripsi satu kalimat tentang isi, bukan pujian.
- Glosarium: Ekspor, Cetak, Riwayat, Pemasok, Bahan, Opname, Resep, Limbah, Member, Tamu, Shift.
- Toast: judul pernyataan hasil (`PO dibuat`, `Stok disesuaikan`), deskripsi satu fakta (`Susu Oat, 10 Liter ke Oatside`). Tanpa "berhasil", "Sukses", "Mohon", "Silakan", tanda seru.
- Tidak ada teks default di form yang seolah-olah diisi user (catatan PO dikosongkan).
- Tidak ada fitur palsu. Kalau tombol mengklaim "AI" atau "otomatis" tapi isinya data contoh, laporkan ke user, jangan dipoles.

## 6. Pemeriksaan statis

Semua harus bersih sebelum membuka browser:

```bash
npm run lint:ui -- <setiap file yang disentuh> "src/app/(dashboard)/<halaman>/page.tsx"
```
```bash
npx tsc --noEmit -p .
```
```bash
npx vitest run
```

- `lint:ui` harus **0 temuan** di file yang disentuh. Lalu jalankan juga pada seluruh `src/features/<area>` dan pastikan sisa temuannya hanya ada di file yang sengaja ditunda.
- Vitest: hanya 4 kegagalan baseline yang boleh (`etl-data-validation`, `final-demo-readiness`, `organizer-activation-hardening`, `storage-sync-safety`). Terakhir: 1028 lulus dari 1032. `unified-account` kadang timeout; jalankan ulang sendirian sebelum menganggapnya gagal.
- Cari sisa referensi ke komponen yang dihapus: `grep -rn "<NamaKomponen>" src tests`.

## 7. Cek visual di browser

Dev server di `http://localhost:3000` (browser pane sudah login sebagai Super Admin). **Kalau harness tidak punya alat browser**, kerjakan langkah lain, lalu berikan user daftar pemeriksaan di bawah untuk dilakukan sendiri, dan tulis di laporan bahwa cek visual belum dilakukan agent. **Kalau dev server bukan dijalankan olehmu, jangan dimatikan.** Kalau tidak ada yang jalan, nyalakan sendiri.

Batasan keamanan (lihat handoff bagian 6): hanya membuka halaman, tab, menu, dan dialog. **Jangan** menekan simpan, bayar, terima, buat, buka/tutup shift, check-in. Database lokal = Neon produksi.

Periksa di tiga ukuran, dan untuk setiap ukuran catat apa yang dilihat:

1. **Desktop 1280×800, mode gelap.** Header: tepat satu tombol primary. Buka setiap tab dan setiap `DropdownMenu`. Screenshot bisa tertinggal satu render; ambil ulang kalau isinya tidak berubah setelah klik.
2. **Desktop 1280×800, mode terang.** Kontras badge dan teks muted terbaca.
3. **Mobile 375×812.** Jalankan di console:
   ```js
   [document.documentElement.scrollWidth, innerWidth]
   ```
   Kedua angka harus sama (tidak ada scroll samping). Untuk setiap tabel:
   ```js
   const t = document.querySelector('main table'); [t.scrollWidth, t.parentElement.clientWidth]
   ```
   Kalau `scrollWidth` lebih besar, sembunyikan kolom sekunder, izinkan nama membungkus, ubah tombol aksi jadi ikon. Pastikan juga `TabsList` tidak terpotong (pendekkan label di mobile, contoh "PO").

Kembalikan viewport ke desktop setelah selesai. Overlay (dialog, toast, popover) tidak selalu terekam screenshot; cek lewat DOM.

## 8. Build

Hanya bila tidak ada dev server milik user yang sedang jalan (build dan dev memakai `.next` yang sama):

```bash
npm run build
```

Kalau dev server user sedang jalan, lewati, dan tulis di laporan bahwa build belum diverifikasi.

## 9. Catat di tracker

Di `REDESIGN_HANDOFF.md` bagian 2 tabel Fase 6, ganti baris halaman dengan status `selesai, belum commit (P3)` dan catatan berformat:

> **Tugas:** <kalimat langkah 2>. **Keputusan:** <daftar keputusan, termasuk yang berbeda dari layout lama dan alasannya>. Logika di `<modul>.ts` + test. `lint:ui` 0 di file yang disentuh (sisa N di <file yang ditunda>). Catatan: <temuan yang tidak dikerjakan>.

Perbarui juga tabel baseline `lint:ui` di bagian 5a (`awal → sekarang`) dan baris status di `REDESIGN_REVIEW_GEMINI.md` bagian 4.

## 10. Tutup sesi

- **Jangan commit** kecuali user meminta. Saat diminta: stage file satu per satu (`git add <path>`), jangan `git add -A`. Jangan pernah ikut-stage `data/*`, `.audit/`, `*.xlsx`, `docs/KLARIFIKASI_SETTLEMENT_MITRA.md`, `panduan.md`, `.claude/`.
- Pesan commit: `feat(<area>): redesign the <halaman> page around <tugas>`. Tanpa `Co-Authored-By` atau atribusi AI apa pun.
- Laporkan ke user: tugas layar, keputusan utama, hasil lint/tsc/test/build (dengan angka), apa yang dicek di browser, dan temuan yang sengaja tidak dikerjakan.

## Kesalahan yang sudah pernah terjadi (jangan diulangi)

1. Hanya mengganti import ke shadcn dan menyebutnya selesai. Status `selesai` hanya boleh dipakai kalau Definition of Done (handoff 5a) terpenuhi semua.
2. Copy setengah jalan: judul sudah sentence case, tapi kolom tabel, opsi select, toast, dan placeholder masih Title Case atau bahasa Inggris.
3. Mengganti string pakai cari-ganti global sehingga **nilai data** ikut berubah (nilai `value=` pada opsi, enum yang dibandingkan di kode). Ganti hanya teks tampilan; periksa diff untuk `value=`, `===`, dan `case`.
4. Menghapus atau melemahkan assert test yang membaca sumber. Pindahkan string-nya ke file baru; jangan ubah test kecuali path filenya.
5. Mematikan dev server milik user untuk menjalankan build.
6. Menekan tombol yang menulis ke database saat cek visual.
7. Menyembunyikan kegagalan: kalau test, build, atau cek visual tidak bisa dijalankan, tulis apa yang tidak diverifikasi.
8. Mengedit `src/components/ui/*` (registry shadcn). Satu-satunya pengecualian adalah `ui/button.tsx`.
9. Membuat komponen tiruan (tabel, pagination, badge) di folder fitur padahal versi bersama sudah ada di `src/components/app`.
10. Mengerjakan beberapa halaman sekaligus lalu tidak ada satu pun yang lolos Definition of Done.

## Urutan halaman berikutnya

| Urutan | Halaman | Tugas awal (periksa ulang di langkah 2) |
| --- | --- | --- |
| 1 | `/tables` | Melihat meja mana yang kosong sekarang; denah sebagai tampilan utama, reservasi di panel samping |
| 2 | `/coworking` | Melihat dan mengatur pemakaian ruang hari ini; linimasa ruang × jam, booking dari slot kosong |
| 3 | `/customers`, `/employees`, `/commercial` | Mencari orang atau kontrak lalu bertindak; buat `DataTableToolbar` bersama di `src/components/app` saat dipakai halaman kedua |
| 4 | `/reports`, `/activity-log` | Membaca dan mengekspor data; satu `ReportPreviewDialog` menggantikan modal PDF |
| 5 | `/ai-insight` | Ditentukan saat pemetaan |

Setelah semua halaman ini, lanjut P4 (modal POS) sesuai review.
