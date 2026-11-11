# Handoff redesign UI (shadcn + unslop)

Dokumen ini untuk agent atau developer yang melanjutkan redesign. Isinya status terakhir, tracker fase, aturan yang sudah disepakati, dan cara kerja per halaman yang dipakai sejauh ini. Baca sampai habis sebelum menyentuh kode.

Terakhir diperbarui: 11 November 2026, branch `feat/shadcn-foundation`.

## 1. Dokumen acuan

| Dokumen | Isi | Kapan dibaca |
| --- | --- | --- |
| [UNSLOP_AUDIT.md](./UNSLOP_AUDIT.md) | Temuan audit UI lama dan alasannya | Sekali, untuk konteks |
| [SHADCN_UI_IMPLEMENTATION_PLAN.md](./SHADCN_UI_IMPLEMENTATION_PLAN.md) | Rencana fase 0–8, pemetaan komponen lama ke shadcn (bagian 6), checklist per halaman (bagian 13) | Sebelum mulai fase atau halaman baru |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Preset, token warna, tipografi, komponen app, pengecualian tombol | Setiap kali ragu soal warna, ukuran, atau komponen |
| Dokumen ini | Tracker, workflow, jebakan | Setiap mulai sesi |

## 2. Tracker fase

Status: `selesai` (sudah di-commit), `selesai, belum commit`, `berjalan`, `belum`.

| Fase | Cakupan | Status | Commit |
| --- | --- | --- | --- |
| 0 | Keputusan design system: preset `b1ZzrZdR2` (Mira, Neutral, Blue, DM Sans, lucide) | selesai | dokumen |
| 1 | Fondasi: Tailwind v4, init shadcn, token, `legacy-dark.css` | selesai | `5828f19` |
| 2 | Komponen shadcn, `src/components/app/*`, lapisan `components/legacy/ui` | selesai | `d0116f7` |
| – | Upgrade Next 15.5 + React 19 (Base UI butuh ref React 19) | selesai | `ee7089c` |
| 3 | App shell: sidebar inset, `SiteHeader`, `NavUser` | selesai | `7137efa` |
| 4 | Dashboard eksekutif | selesai | `67cb541` |
| 5 | Landing + login | selesai | `c7e3907` |
| 5b | Login dua kolom (`login-02`) + tombol 3D gaya Cloudflare Kumo | selesai, belum commit | – |
| 6 | Layar operasional (rincian di bawah) | berjalan | – |
| 7 | Pecah dan migrasi `settings`, portal `customer`, `events/portal`, halaman `events/*`, `checkout-link-v2` | belum | – |
| 8 | Hapus `legacy-dark.css` dan `components/legacy`, skrip `lint:ui`, dokumentasi | belum | – |

### Fase 6 per halaman

Urutan mengikuti seberapa sering staf memakai halaman. Kerjakan satu halaman sampai terverifikasi sebelum pindah.

| Halaman | Baris (awal) | Status | Catatan |
| --- | --- | --- | --- |
| `/kitchen` (KDS) | 572 | selesai, belum commit | `src/features/kitchen/*`, test `kitchen-board.test.ts` |
| `/pos` mode F&B + kerangka | 2856 → 2329 | selesai, belum commit | `src/features/pos/{PosToolbar,ProductCatalog,ProductCard,Cart*}.tsx`, `pos-catalog.ts` |
| `/pos` mode co-working | (bagian dari 2329) | belum | Baris 1209–1953 di `pos/page.tsx` (blok `2. CO-WORKING TRANSACTION MODE` sampai `MODALS`) |
| Modal POS | 2765 total | belum | `ModifierModal`, `PaymentModal` (901), `ReceiptModal`, `KitchenOrderReceiptModal`, `CashDrawerShiftModal`, `DailyClosingPDFModal`, plus modal inline buka shift, voucher, foto ruang, closing |
| `/orders` | 896 | belum | |
| `/tables` | 910 | belum | |
| `/inventory` | 2038 | belum | Pecah dulu |
| `/menu` | 21 | belum | Hanya pembungkus |
| `/customers` | 727 | belum | |
| `/coworking` | 1579 | belum | |
| `/commercial` | 903 | belum | |
| `/employees` | 1697 | belum | |
| `/reports` | 575 | belum | Pakai `DateRangePicker` yang sudah baru |
| `/activity-log` | 1189 | belum | |
| `/ai-insight` | 358 | belum | |
| `/events-admin` | 4700 | belum | Pecah dulu |

Masih ada 50 file yang meng-import `components/legacy`. Cek dengan `grep -rl "components/legacy" src | wc -l`.

## 3. Kondisi working tree saat handoff

Belum di-commit (pekerjaan redesign):

- `src/components/ui/button.tsx`, `src/app/globals.css` (token `--button-*`, utility `no-scrollbar`)
- `src/app/(auth)/login/page.tsx` (layout `login-02`)
- `src/app/(dashboard)/kitchen/page.tsx`, `src/features/kitchen/*`, `tests/kitchen-board.test.ts`
- `src/app/(dashboard)/pos/page.tsx`, file baru di `src/features/pos/`, `tests/pos-catalog.test.ts`
- `tests/pos-c-bagian-c.test.ts`, `tests/pos-d-bagian-d.test.ts` (diarahkan ke file baru)
- `docs/DESIGN_SYSTEM.md`, `docs/SHADCN_UI_IMPLEMENTATION_PLAN.md`, dokumen ini

**Jangan pernah ikut di-commit** (bukan bagian redesign): `data/*`, `.audit/`, `Laporan_Settlement_Mingguan_Dago_Mitra.xlsx`, `docs/KLARIFIKASI_SETTLEMENT_MITRA.md`, `panduan.md`. Stage file satu per satu, jangan `git add -A`.

## 4. Aturan yang sudah disepakati

### Komponen dan token

- `src/components/ui/*` adalah kode registry shadcn dan tidak disunting. **Satu-satunya pengecualian** adalah `ui/button.tsx` (permukaan 3D gaya Cloudflare Kumo). Kalau menjalankan `npx shadcn add button --overwrite`, terapkan ulang kelas variannya (lihat DESIGN_SYSTEM.md bagian "Tombol").
- Warna hanya lewat token semantik: `primary`, `muted`, `accent` (permukaan hover netral, bukan warna brand), `destructive`, ditambah token aplikasi `success`, `warning`, `info`, dan `unit-fnb|coworking|event|loyalty`. Tidak boleh ada hex, `slate-*`, `emerald-*`, atau `dark:` untuk warna.
- Warna tema masih Blue dan sengaja sementara. User bisa menggantinya nanti, misalnya ke hijau, lewat preset. Semua token (termasuk `--button-*`) diturunkan dari `--primary`, jadi jangan menulis warna tema secara langsung.
- Komponen aplikasi ada di `src/components/app`: `PageHeader`, `SectionHeader`, `StatCard`, `StatusBadge` (tone `success|warning|info|destructive|neutral`), `UnitDot`, `EmptyState`, `ConfirmDialog`, dan `notify()`.
- Toast: selalu `notify.success|error|warning|info(title, description?)`. Copy berupa kalimat datar tanpa tanda seru. `Toaster` sudah terpasang di `AppProviders`.
- Kode baru tidak boleh meng-import `components/legacy`. Halaman yang belum dimigrasi boleh tetap memakainya.

### Unslop (ringkas, versi lengkap ada di bagian 13 rencana)

- Sentence case, bobot 400–600, teks minimal 12px (`text-xs`).
- Tanpa emoji, gradien dekoratif, blob, glow, `hover:scale`, `transition-all`, `animate-ping/pulse` dekoratif, label uppercase tracking, badge di atas judul, salam, atau tanda seru.
- Angka uang dan antrean: `font-mono tabular-nums`.
- Keadaan kosong jujur (`EmptyState`). Jangan pernah menampilkan data palsu. Contoh yang sudah dibuang: "Antrean #A-14", "Status sistem: siap operasi", label "Service Charge (5%)" yang ditulis langsung di kode.

### Git

- Commit **hanya** saat user meminta.
- Format: `feat(ui): …`, `fix: …`, dan sejenisnya (lihat `git log`).
- Tanpa atribusi AI dan tanpa `Co-Authored-By`. Pakai identitas git user. Jangan memposting komentar PR/MR atau men-tag orang.

## 5. Workflow per halaman

Ini cara kerja yang dipakai untuk KDS dan POS. Ikuti urutannya.

1. **Petakan dulu, jangan langsung menulis.**
   - Ukur file dan pemakaian legacy:
     ```bash
     wc -l "src/app/(dashboard)/<halaman>/page.tsx"
     ```
   - Daftar section: `grep -n "{/\* " <file>`. Daftar state dan handler: `grep -n "const \[\|const handle" <file>`.
   - Cari kode mati (handler yang tidak pernah dipanggil, import tak terpakai) dan data palsu yang ditulis langsung di kode.
2. **Cari test yang mengunci teks sumber.**
   ```bash
   grep -rln "<halaman>/page.tsx\|features/<area>/" tests
   ```
   Banyak test lama (`pos-c-bagian-c`, `pos-d-bagian-d`, …) membaca file sumber dan mencocokkan string. Setiap string itu mewakili aturan bisnis. Kalau kode dipindah, **pindahkan assert-nya ke file baru dengan aturan yang sama** dan beri komentar alasannya. Jangan menghapus aturannya.
3. **Keluarkan logika murni lalu tulis test lebih dulu (TDD).**
   - Buat `src/features/<area>/<nama>.ts`, contohnya `kitchen-board.ts` dan `pos-catalog.ts`.
   - Test di `tests/<nama>.test.ts` dengan pola Arrange-Act-Assert. Jalankan sampai RED (modul belum ada), implementasikan, lalu GREEN.
   - Fungsi tidak boleh memutasi input (`filter` membuat salinan, jadi `sort` sesudahnya aman). Jangan pakai `toSorted`, karena target tsconfig masih ES2022.
4. **Pecah tampilan ke komponen kecil di `src/features/<area>/`.**
   - State dan handler transaksi **tetap di `page.tsx`**, supaya perilakunya tidak berubah. Komponen hanya menerima props dan callback.
   - Targetkan file di bawah 400 baris dan fungsi di bawah 50 baris.
5. **Ganti ke komponen shadcn** sesuai tabel bagian 6 di rencana:
   - pill/tab buatan → `Tabs`; `<select>` → `NativeSelect` (bisa `optgroup`) atau `Select`; input dengan ikon → `InputGroup`; status → `StatusBadge`; toast → `notify()`.
   - Kartu yang bisa diklik dijadikan `<button>`, jangan `div onClick`.
   - Link berbentuk tombol: `<Button render={<Link href="…" />} nativeButton={false}>`.
6. **Validasi:**
   ```bash
   npx tsc --noEmit -p .
   ```
   ```bash
   npx vitest run tests/<file-terkait>.test.ts
   ```
7. **Cek di browser** (dev server di `localhost:3000`, browser pane sudah login sebagai Super Admin). Lihat bagian 6 untuk batasannya.
8. **Verifikasi penuh.** Hentikan dev server dulu karena build memakai `.next` yang sama:
   ```bash
   pkill -f "next dev"; npx vitest run; npm run build
   ```
   Baseline: **4 test gagal sejak sebelum redesign** dan tidak terkait UI (`etl-data-validation`, `final-demo-readiness`, `organizer-activation-hardening`, `storage-sync-safety`). Selain 4 itu harus lulus semua. Terakhir: 926 lulus dari 930. Setelah selesai, jalankan lagi dev server (`npm run dev` di background).
9. **Catat progres** di tabel bagian 2 dokumen ini dan di blok progres Fase 6 pada rencana. Tulis apa yang dipindah ke mana, bug yang ikut diperbaiki, dan apa yang belum.
10. **Tutup sesi:** ringkas ke user, jangan commit sebelum diminta.

## 6. Keamanan data saat menguji (penting)

- **Dev lokal menulis ke database Neon yang asli.** File `data/*.json` hanya replika disk. `src/lib/persistent-storage.ts` menyinkronkannya dari tabel `system_settings` (kunci `STORAGE_<file>`) setiap kali dibaca. Client juga menyimpan antrean sync di localStorage `dagoeng_sync_outbox_v1` dan mengirim ulang isinya saat aplikasi dibuka.
- Di browser, **jangan menekan aksi yang menulis ke server**: memajukan status pesanan, bayar, buka/tutup shift, booking, check-in. Verifikasi alur seperti itu lewat DOM (sampai sebelum submit) dan unit test.
- Kalau perlu data contoh untuk melihat tampilan, isi localStorage (`dagoeng_orders_v3`) **untuk dilihat saja**, lalu kembalikan nilai aslinya. Data contoh wajib punya `statusHistory: []`.
- Riwayat: pada 11 November 2026, pesanan contoh `kds-demo-3` (status SERVED) dan 10 poin untuk "Tamu 3" sempat masuk ke Neon. **User memutuskan data itu dibiarkan di database.** Karena itu `data/pos_orders.json` dan `data/loyalty_points.json` akan terus muncul lagi di lokal. Jangan di-commit dan jangan dihapus dari DB tanpa izin user.
- Setiap penulisan ke DB atau penghapusan data harus dengan izin eksplisit user.

## 7. Jebakan yang sudah ditemui

- **Screenshot browser pane tidak merekam overlay** (dialog, popover, sheet, toast). Pastikan lewat DOM, misalnya `document.querySelectorAll('[data-slot=toast]')`. Screenshot yang diambil saat transisi tema juga bisa tampak pudar, jadi ambil ulang.
- Gambar `loading="lazy"` belum termuat saat screenshot cepat. Cek `img.complete` dan `naturalWidth` sebelum menyimpulkan gambar rusak.
- Base UI: `Tabs` `onValueChange` memberi `unknown`, jadi cast ke union-nya. `DropdownMenuItem` dan `Button` memakai prop `render`.
- Tailwind v4: pakai `bg-linear-to-b`, `inset-shadow-[…]`, dan variabel `(--nama)`. Utility kustom ditambahkan dengan `@utility` di `globals.css`.
- Hook "Fact-Forcing Gate" menolak `Write` pertama pada file baru. Sebutkan importer, API, skema, dan instruksi user, lalu ulangi.
- zsh: `grep --include=*.ts` gagal karena glob. Pakai kutip atau `grep -rn … src/lib/*.ts`.
- Codemod Tailwind pernah mengubah warna `#1E293B` dan varian `outline`. Kalau menjalankan codemod lagi, periksa diff-nya.
- Test D6, C2, D2, dan D5 sudah diarahkan ke file baru. Pola yang sama berlaku untuk test lain yang membaca sumber.

## 8. Langkah berikutnya

1. Minta user meng-commit pekerjaan yang belum di-commit (bagian 3). Usulan pemisahan:
   - `feat(ui): two-column login and tactile buttons`
   - `feat(kitchen): rebuild KDS with shadcn components`
   - `feat(pos): rebuild POS catalog and cart with shadcn components`
2. POS tahap 2: mode co-working (`CoworkingBookingPanel`, grid ruang, pemilih durasi dan jam memakai `Tabs`/`NativeSelect`), lalu modal-modal POS memakai `Dialog`/`AlertDialog`. Test yang mengunci teks modal: D1 (`ModifierModal`, semantik radio untuk grup sekali pilih), C3 (`PaymentModal`, nominal tunai tidak terisi otomatis), C4 (`ReceiptModal`, tanpa password Wi-Fi statis).
3. Lanjutkan Fase 6 sesuai tabel. Halaman di atas 1500 baris dipecah dulu tanpa mengubah tampilan.
4. Fase 7, lalu Fase 8 (hapus legacy, `lint:ui`).
