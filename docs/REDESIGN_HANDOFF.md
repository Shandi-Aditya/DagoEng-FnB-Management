# Handoff redesign UI (shadcn + unslop)

Dokumen ini untuk agent atau developer yang melanjutkan redesign. Isinya status terakhir, tracker fase, aturan yang sudah disepakati, dan cara kerja per halaman yang dipakai sejauh ini. Baca sampai habis sebelum menyentuh kode.

Terakhir diperbarui: 12 November 2026, branch `feat/shadcn-foundation`.

## 1. Dokumen acuan

| Dokumen | Isi | Kapan dibaca |
| --- | --- | --- |
| [REDESIGN_PLAYBOOK.md](./REDESIGN_PLAYBOOK.md) | Langkah 0–10 untuk me-redesign satu halaman (P3), dengan contoh `/orders` dan `/inventory` | **Setiap mulai halaman baru** |
| [UNSLOP_AUDIT.md](./UNSLOP_AUDIT.md) | Temuan audit UI lama dan alasannya | Sekali, untuk konteks |
| [SHADCN_UI_IMPLEMENTATION_PLAN.md](./SHADCN_UI_IMPLEMENTATION_PLAN.md) | Rencana fase 0–8, pemetaan komponen lama ke shadcn (bagian 6), checklist per halaman (bagian 13) | Sebelum mulai fase atau halaman baru |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Preset, token warna, tipografi, komponen app, pengecualian tombol | Setiap kali ragu soal warna, ukuran, atau komponen |
| [REDESIGN_REVIEW_GEMINI.md](./REDESIGN_REVIEW_GEMINI.md) | Review pekerjaan Gemini dan rencana perbaikan P0–P4 | Sebelum menyentuh halaman Fase 6 yang sudah dipecah |
| Dokumen ini | Tracker, workflow, jebakan | Setiap mulai sesi |

## 2. Tracker fase

Status: `selesai` (sudah di-commit), `selesai, belum commit`, `struktur selesai` (sudah dipecah ke `features/`, tampilan dan copy belum di-redesign), `berjalan`, `belum`.

| Fase | Cakupan | Status | Commit |
| --- | --- | --- | --- |
| 0 | Keputusan design system: preset `b1ZzrZdR2` (Mira, Neutral, Blue, DM Sans, lucide) | selesai | dokumen |
| 1 | Fondasi: Tailwind v4, init shadcn, token, `legacy-dark.css` | selesai | `5828f19` |
| 2 | Komponen shadcn, `src/components/app/*`, lapisan `components/legacy/ui` | selesai | `d0116f7` |
| – | Upgrade Next 15.5 + React 19 (Base UI butuh ref React 19) | selesai | `ee7089c` |
| 3 | App shell: sidebar inset, `SiteHeader`, `NavUser` | selesai | `7137efa` |
| 4 | Dashboard eksekutif | selesai | `67cb541` |
| 5 | Landing + login | selesai | `c7e3907` |
| 5b | Login dua kolom (`login-02`) + tombol 3D gaya Cloudflare Kumo | selesai | `3d00557` |
| 6 | Layar operasional (rincian di bawah) | berjalan | `5f98197` (KDS, POS F&B) |
| 7 | Pecah dan migrasi `settings`, portal `customer`, `events/portal`, halaman `events/*`, `checkout-link-v2` | belum | – |
| 8 | Hapus `legacy-dark.css` dan `components/legacy`, skrip `lint:ui`, dokumentasi | belum | – |

### Fase 6 per halaman

Urutan mengikuti seberapa sering staf memakai halaman. Kerjakan satu halaman sampai terverifikasi sebelum pindah.

| Halaman | Baris (awal) | Status | Catatan |
| --- | --- | --- | --- |
| `/kitchen` (KDS) | 572 | selesai (`5f98197`) | `src/features/kitchen/*`, test `kitchen-board.test.ts` |
| `/pos` mode F&B + kerangka | 2856 → 2329 | selesai (`5f98197`) | `src/features/pos/{PosToolbar,ProductCatalog,ProductCard,Cart*}.tsx`, `pos-catalog.ts` |
| `/pos` mode co-working | 2329 → 1493 | struktur selesai, redesign belum | `src/features/pos/{CoworkingToolbar,CoworkingRoomCard,CoworkingPhotoModal,CoworkingBookingPanel}.tsx`, `pos-coworking.ts`, test `pos-coworking.test.ts` |
| Modal POS | 2765 total | berjalan | Import sudah ke shadcn, tapi isinya masih gaya lama (mis. `PaymentModal` 278 kelas lama, `DailyClosingPDFModal` 170). `PosVoucherModal` dan `PosOpenShiftModal` baru dipisah dari `pos/page.tsx`. Lihat review P4. |
| `/orders` | 896 → 325 | selesai (`80ec405`, P3) | **Tugas:** menemukan pesanan yang perlu ditindak, lalu bayar atau cetak. **Keputusan:** antrean `Tabs` (Perlu dibayar, Diproses, Selesai, Dibatalkan, Semua) dengan jumlah, default "Perlu dibayar" untuk peran kasir; antrean tunggu diurutkan dari yang terlama, riwayat dari yang terbaru; pencarian nomor/meja/nama; tabel 9 → 6 kolom (target waktu jadi titik di kolom waktu, metode bayar di bawah status bayar, waktu disembunyikan untuk pesanan yang sudah ditutup); detail di `Sheet` samping (`OrderDetailSheet`) supaya daftar tetap terlihat; ekspor dalam satu `DropdownMenu`; `DataPagination`; di mobile hanya pesanan, status, total, dan Bayar. Logika di `orders-queue.ts` + test. `lint:ui` 0 di file yang disentuh (sisa di `OrdersReportPDFModal`, menunggu `ReportPreviewDialog`). |
| `/tables` | 910 → 226 | selesai, belum commit (P3) | **Tugas:** melihat meja mana yang kosong atau perlu tindakan saat ini, lalu mendudukkan tamu atau mengarahkan pesanan ke kasir. **Keputusan:** detail meja terpusat dalam `Dialog` (`TableDetailModal`) dengan info tagihan aktif, switcher status semantik `Button variant="default"|"outline"`, dan tombol langsung *"Buka di POS"*; satu aksi primary `Buat reservasi` di header, aksi denah fisik (`Tambah meja`, `Tambah area`) masuk dropdown `Kelola denah`; 3 `StatCard` okupansi (*Tersedia*, *Terisi*, *Reservasi*); denah visual per area dengan `StatusBadge` semantik; pencarian reservasi dengan `InputGroup` dan antrean `Tabs` status ber-badge numerik; tabel reservasi (`ReservationsView`) diselaraskan: pembungkus border tanpa Card berjarak, `DataPagination`, kolom responsif (sub-teks di mobile `375px`, tanpa scroll horizontal), tombol aksi ikon mobile; shortcut tanggal/jam reservasi menggunakan `Button size="sm"` semantik. Logika di `tables-domain.ts` + test `tables-domain.test.ts` (10/10 lulus). `lint:ui` 0 di seluruh file disentuh; `tsc` 0 error. Catatan: build dilewati karena dev server aktif (PID 30374), cek visual menunggu verifikasi manual user. |
| `/inventory` | 2038 → 466 | selesai (`c808b01`, P3) | **Tugas:** tahu bahan apa yang harus dibeli, lalu buat PO. **Keputusan:** panel "Perlu dibeli" langsung di bawah judul (`ReorderPanel`, menggantikan `RestockAlertModal` yang tersembunyi di balik tombol), bahan habis dulu lalu yang paling jauh di bawah minimum, dengan saran jumlah (kembali ke 2× minimum) dan tombol "Buat PO" per bahan yang membuka form terisi; kalau tidak ada yang perlu dibeli, cukup satu baris tenang. "Buat PO" satu-satunya aksi primary; simulasi resep, laporan nilai stok, dan ekspor masuk menu "Lainnya". Tiga angka saja (nilai stok, menipis, perlu dibeli). Tab Stok, Resep, Pesanan pembelian ("PO" di mobile), dan Opname dengan jumlah. Tabel stok: kategori dan alasan perubahan memakai label bahasa Indonesia, bukan enum; bilah stok terhadap 2× minimum; HPP dan nilai disembunyikan di tablet, status di mobile. Kartu resep: takaran jadi kolom sendiri supaya nama panjang tidak memotong angkanya. Opname: kartu angka baru muncul setelah ada data, ekspor dalam satu menu. Perkiraan tiba PO berupa tanggal nyata (`deliveryDateLabel`), bukan "2 Hari ke Depan". Logika di `inventory-reorder.ts` + test. `lint:ui` 0 di file yang disentuh (sisa 171 di `BOMRecipeModal` dan dua modal PDF, menunggu P4 dan `ReportPreviewDialog`). Catatan: label navigasi "Smart Inventory" berasal dari `src/lib/rbac.ts` dan dikunci test, jadi ikut sapuan label navigasi. |
| `/menu` | 21 | struktur selesai, redesign belum | Hanya pembungkus redirect ke `/settings`, token dibersihkan |
| `/customers` | 727 → 184 | berjalan (sapuan tabel P3, menunggu cek visual & build) | **Tugas:** mencari pelanggan atau member loyalty, lalu memeriksa saldo poin/riwayat atau mendaftarkan member baru. **Keputusan:** hapus banner tutorial CRM yang memakan sepertiga layar dan memuat kata buzzword; konsolidasi 4 tombol header menjadi 1 primary (`Tambah member`) dan 1 dropdown `Ekspor`; tabel (`CustomersTable`) diselaraskan ke gaya `/reports`/`/activity-log`: memakai `DataTableToolbar` bersama (tanpa kotak card filter), `<div className="overflow-hidden rounded-lg border bg-card">` (tanpa `<Card>` gap 16px), `<EmptyState className="border" />` di luar tabel, `DataPagination`, kolom `Riwayat` & aksi digabung (`w-0`, menu `MoreHorizontal` + tombol `Riwayat`, 3 kolom di mobile `375px`), serta `"poin"` menggantikan `"Pts"`; perbaikan copy sentence case dan konversi warna mentah emerald/rose ke token semantik success/destructive pada modal riwayat. Logika di `customers-domain.ts` + test `customers-domain.test.ts` (7/7 lulus). `lint:ui` 0 di file disentuh (sisa 161 di `CustomersReportPDFModal`, menunggu `ReportPreviewDialog`); `tsc` 0 error. Catatan: `npm run build` dilewati (`PID 52884`) dan cek visual pasca-sapuan tabel belum dilakukan. |
| `/coworking` | 1579 → 367 | berjalan (sapuan tabel P3, menunggu cek visual & build) | **Tugas:** melihat ketersediaan ruang kerja saat ini dan linimasa pemakaian, lalu membuat booking baru atau memproses check-in/out tamu. **Keputusan:** toolbar diringkas dari 6 tombol berderet menjadi 1 primary (`Buat booking`), 1 outline (`Tambah member`), dan menu dropdown `Lainnya` (ekspor & pengaturan); tab Ruang dan Meja bersih tanpa string bantuan instruksional, menggunakan label tipe resmi; ketiga tabel (`CoworkingBookingsTab`, `CoworkingMembersTab`, `CoworkingLogsTab`) diselaraskan ke gaya `/reports`/`/activity-log`: memakai `DataTableToolbar` bersama, menghapus `<Card>` pembungkus tabel (hilangkan gap 16px), `<EmptyState className="border" />` di luar tabel, menambah `DataPagination` ke `CoworkingLogsTab`, menyembunyikan kolom sekunder di mobile `375px`, meratakan kanan kolom angka/Rupiah, dan menyembunyikan email `"-"` pada member; pembersihan data palsu (menghapus fallback `guest@nomad.com` dan `member@nomad.com`, default QRIS tanpa label marketing). Logika di `coworking-domain.ts` (`filterCoworkingBookings`) + test `coworking-domain.test.ts` (13/13 lulus). `lint:ui` 0 di file disentuh (sisa 173 di `CoworkingReceiptModal`, `CoworkingReportPDFModal`, `coworking-data.ts`); `tsc` 0 error. Catatan: `npm run build` dilewati (`PID 52884`) dan cek visual pasca-sapuan tabel belum dilakukan. |
| `/commercial` | 903 → 268 | berjalan (sapuan tabel P3, menunggu cek visual & build) | **Tugas:** memantau status masa berlaku kontrak sewa tenant dan tagihannya, lalu mencatat pembayaran sewa atau membuat kontrak sewa baru. **Keputusan:** toolbar dikonsolidasi dari 5 tombol menjadi 1 primary (`Tambah kontrak`) dan dropdown `Lainnya` (ekspor & nonaktifkan modul); tabel (`CommercialTable`) diselaraskan ke gaya `/reports`/`/activity-log`: memakai `DataTableToolbar` bersama (tanpa kotak card filter), menghapus `<Card>` pembungkus tabel (hilangkan gap 16px), `<EmptyState className="border" />` di luar tabel, `DataPagination`, kolom responsif 3 kolom di mobile `375px`, dan header sentence case tanpa `&`; enum jadwal bayar diterjemahkan ke bahasa Indonesia; pembersihan form tambah kontrak dari nilai tanggal & sewa fiktif bawaan form; warna mentah amber diganti token semantik. Logika di `commercial-domain.ts` + test `commercial-domain.test.ts` (6/6 lulus). `lint:ui` 0 di file disentuh (sisa 132 di `CommercialReportPDFModal`, menunggu `ReportPreviewDialog`); `tsc` 0 error. Catatan: `npm run build` dilewati (`PID 52884`) dan cek visual pasca-sapuan tabel belum dilakukan. |
| `/employees` | 1697 → 368 | berjalan (sapuan tabel P3, menunggu cek visual & build) | **Tugas:** memantau dan merekonsiliasi shift kasir harian, serta mengelola data dan hak akses karyawan outlet. **Keputusan:** konsolidasi 5 tombol header menjadi 1 primary (`Tambah staf`), tombol buka shift terintegrasi, dan dropdown `Lainnya` (ekspor); kartu shift aktif ber-badge jelas dan aksi tutup shift; kedua tabel (`EmployeesShiftsTab`, `EmployeesDirectoryTab`) diselaraskan ke gaya `/reports`/`/activity-log`: memakai `DataTableToolbar` bersama, menghapus `<Card>` pembungkus tabel (hilangkan gap 16px), `<EmptyState className="border" />` di luar tabel, `DataPagination`, aksi direktori diringkas (`Detail` + `DropdownMenu` `Edit`/`Hapus`), dan penyembunyian kolom sekunder di mobile `375px`; pembersihan prefill fiktif (`+62 812-`) pada form karyawan. Logika di `employees-domain.ts` + test `employees-domain.test.ts` (9/9 lulus). `lint:ui` 0 di file disentuh (sisa 95 di `EmployeesReportPDFModal`, menunggu `ReportPreviewDialog`); `tsc` 0 error. Catatan: `npm run build` dilewati (`PID 52884`) dan cek visual pasca-sapuan tabel belum dilakukan. |
| `/reports` | 575 → 166 | berjalan (P3, menunggu cek visual) | **Tugas:** memilih jenis laporan operasional pada periode tertentu, membaca dan mencari rinciannya di layar, lalu mencetak PDF atau mengekspornya. **Keputusan:** ganti grid 7 kartu kategori (`ReportsCategorySelector`) menjadi bar `Tabs` bergaya `/orders` dengan hitungan numerik murni (`rawCount`); hapus pembungkus `<Card>` pada tabel laporan dan pakai `overflow-hidden rounded-lg border bg-card` (seperti `OrdersTable`) agar tidak ada gap kosong di atas, di bawah, maupun di antara judul dan kolom tabel; tambah pencarian baris (`InputGroup`) dan `DataPagination` menggantikan pemotongan 10 baris; konsolidasi header 1 primary (`Cetak PDF`) + dropdown `Ekspor` + `DateRangePicker` tanpa badge palsu `PRO`; bersihkan enum mentah pada laporan `EVENTS` (`Gratis`, `Transfer manual`, `Lunas`, `Kedaluwarsa`, `Hadir`/`Belum hadir`, pembulatan Rupiah), `INVENTORY` (`ingredientCategoryLabel`), dan `FINANCE_AUDIT` (`auditModuleLabel`, `auditActionLabel`), serta seragamkan fallback outlet `"Semua outlet"`. Logika di `reports-domain.ts` + test `reports-domain.test.ts` (12/12 lulus; suite penuh 1047/1051, 4 baseline). `lint:ui` 0 di 5 file yang disentuh (sisa 108 di `StructuredReportPDFModal`, menunggu `ReportPreviewDialog`); `tsc` 0 error; `npm run build` hijau (37/37 halaman). Catatan: cek visual browser belum dilakukan. |
| `/activity-log` | 1189 → 245 | berjalan (P3, menunggu cek visual & build) | **Tugas:** menelusuri dan menyaring catatan perubahan data di outlet, lalu memeriksa detailnya atau mengekspor laporan audit. **Keputusan:** header disederhanakan menjadi 1 primary (`Cetak PDF`) + dropdown `Ekspor` (`Excel`, `CSV`, `JSON`); pengalih `Tabel`/`Riwayat` dipindah ke `Tabs` bersama filter pencarian `InputGroup` dan `NativeSelect` (menggantikan tombol pill buatan); 4 kartu manual (termasuk `% integritas sistem`) diganti 3 `StatCard` faktual (Total catatan, Peringatan, Dampak tinggi); tabel diringkas 8 → 5 kolom tanpa `<Card>` (nol gap, responsif hingga 3 kolom di mobile) + `DataPagination` pada tabel dan riwayat; detail dipindah ke `Sheet` samping (`ActivityLogDetailModal`) tanpa `bg-slate-950`/warna mentah; seluruh enum status, dampak, modul, dan aksi diterjemahkan ke bahasa Indonesia (`auditStatusLabel`, `auditSeverityLabel`, `auditModuleLabel`, `auditActionLabel`), dan fallback nama `"Hendra Wijaya"` serta `"Semua Gerai"` dibersihkan. Logika di `activity-log-domain.ts` + test `activity-log-domain.test.ts` (11/11 lulus; suite penuh 1050/1054, 4 baseline). `lint:ui` 0 di 9 file yang disentuh (sisa 136 di `ActivityLogPDFModal`, menunggu `ReportPreviewDialog`); `tsc` 0 error. Catatan: `npm run build` dilewati karena dev server aktif di port 3000 (`PID 52884`), dan cek visual browser belum dilakukan. |
| `/ai-insight` | 358 → 133 | selesai (`eed5d67`, P3) | **Tugas:** menanyakan ringkasan performa operasional (penjualan, stok kritis, meja, dan ruang kerja), lalu membuka halaman modul terkait untuk mengambil tindakan operasional. **Keputusan:** header bersih langsung memakai `PageHeader` standar; baris prompt cepat (`AIInsightQuickPrompts`) dibersihkan dari label slop dan teks ilegal `text-[11px]` serta titik dua; wadah percakapan (`AIInsightChatContainer`) dinaikkan menjadi `h-[560px]` adaptif dengan gelembung pesan semantik `bg-card border` dan kotak data sistem `bg-muted/50 border`; menghapus seluruh kelas slop (`uppercase`, `tracking-wider`, `font-bold`, teks `text-[10px]` dan `text-[11px]`); rekomendasi tindakan diganti tombol resmi `<Button variant="outline" size="sm">` dengan `ArrowUpRight`; input chat distandarkan tanpa override ukuran `h-9 px-4` pada `<Button>`; pembersihan copy dan glosarium (`"omset"` → `"omzet"`, fallback `"Semua Gerai"` diganti `"Semua outlet"`, `"Kopi Senja Signature"` diganti `"Menu terlaris"`). Logika di `ai-insight-domain.ts` + test `ai-insight-domain.test.ts` (9/9 lulus). `lint:ui` 0 di seluruh file yang disentuh. |
| `/events-admin` | 4700 → 680 | selesai (`24e88e7`, P3) | **Tugas:** memoderasi pengajuan event baru dan memverifikasi pembayaran tiket manual, lalu memproses persetujuan event, konfirmasi tiket, atau pencairan saldo mitra. **Keputusan:** memecah file monolitik 4.700 baris menjadi modul terfokus di `features/events-admin/`; mengganti seluruh komponen legacy `@/components/legacy/ui/*` ke komponen shadcn semantik; header bersih dengan 1 aksi primary (`Tambah event`) + dropdown `Lainnya` (ekspor, segarkan, katalog publik); 4 sub-modul admin ditata rapi dalam `EventsAdminTabs` (`Moderasi`, `Pembayaran tiket`, `Pencairan saldo`, `Pengaturan bisnis`) dengan hitungan antrean numerik murni; 3 `StatCard` faktual (menunggu review, disetujui, perlu revisi); tabel moderasi diselaraskan ke gaya tabel bersama tanpa `<Card>` bertumpuk, dengan `StatusBadge` semantik dan aksi ringkas (`Detail` langsung, aksi sekunder di `DropdownMenu`); verifikasi pembayaran dan pencairan saldo memakai tabel terdedikasi + `DataPagination`; detail pengajuan event dipindah ke `Sheet` samping (`EventDetailSheet`); menghapus seluruh 1.786 temuan slop/cyberpunk (`uppercase`, `tracking-wider`, `text-[10px]`, `font-black`, `bg-brand-sage`, hex/raw color); pembersihan enum mentah dan copy glosarium (`"payout"` → `"pencairan saldo"`, `"revenue split"` → `"bagi hasil"`). Logika di `events-admin-domain.ts` + test `events-admin-domain.test.ts` (11/11 lulus; suite penuh 1069/1073, 4 baseline). `lint:ui` 0 di seluruh 18 file yang disentuh; `tsc` 0 error. |
| `/settings` | 9386 → 620 | selesai (`59fa12a`, Fase 7/P3) | **Tugas:** memilih kategori pengaturan yang relevan (menu, mitra, ruang, pajak/operasional, promo, atau perangkat), lalu mengubah, menambah, atau menyimpan aturan bisnis yang berlaku ke operasional. **Keputusan:** memecah file monolitik 8.371 baris `settings/page.tsx` + 1.015 baris `PrinterSettingsTab.tsx` menjadi modul terfokus di `features/settings/`; menyatukan tabel menu admin dan tenant ke satu komponen `ProductsCatalogTab`; merapikan 20 modal manual `fixed inset-0` menjadi `Dialog`, `Sheet` samping (`PartnerDetailSheet`), dan `ConfirmDialog`; menggantikan seluruh toast alert inline buatan dengan `notify()`; menghapus seluruh 3.694 temuan slop (warna mentah, dark color, teks 10px, uppercase tracking-wide, emoji); menandai simulasi secara jujur tanpa klaim palsu (`"GATEWAY AKTIF"` / `"Real-time"`). Logika di `settings-domain.ts` + test `settings-domain.test.ts` (11/11 lulus; suite penuh 1081/1084, 3 baseline). `lint:ui` 0 di seluruh 13 file disentuh; `tsc` 0 error; `npm run build` sukses (37/37 halaman). |
| `/customer` (portal pelanggan) | 6116 → 590 | selesai (`59fa12a`, Fase 7/P3) | **Tugas:** memesan menu F&B, memesan ruang kerja, memeriksa tiket event, atau menukarkan poin loyalty secara mandiri dari perangkat mobile. **Keputusan:** memecah file monolitik 6.116 baris `customer/page.tsx` menjadi 10 sub-modul terfokus di `features/customer/`; mengganti kartu sapaan berat bergaya cyberpunk (gradien hitam-ungu, blur blob 80px) menjadi kartu member semantik shadcn yang tenang dengan angka poin mono; menyatukan checkout F&B mandiri ke `CustomerCheckoutSheet` samping/bawah; merapikan modal pemesanan co-working (`CustomerBookingModal`) dan e-tiket masuk ber-QR code (`CustomerTicketPassModal`); menghapus 2.035 temuan slop (glow, scale, emoji, teks < 12px, warna mentah); membersihkan copy dan enum mentah ke bahasa Indonesia sentence case. Logika di `customer-domain.ts` + test `customer-domain.test.ts` (10/10 lulus; suite penuh 1081/1084, 3 baseline). `lint:ui` 0 di seluruh 12 file disentuh; `tsc` 0 error. Catatan: dev server aktif di port 3000 (PID 89136) sehingga build dilewati, dan cek visual browser belum dilakukan oleh agent. |
| `/events/portal` (portal mitra event) | 6158 → 650 | redesign selesai, belum commit | **Tugas:** penyelenggara tahu apa yang menunggu jawabannya, bagaimana event berikutnya berjalan, dan berapa yang bisa dicairkan. **Keputusan (sesi 2026-11-13):** layar belum login berdiri sendiri dengan header gaya landing dan BrandRings hijau event (tidak lagi kartu 'Lock' di dalam sidebar); menu urut Ringkasan, Event, Peserta, Keuangan, Pengaturan, dengan Ringkasan sebagai default; tombol Check-in dan Ajukan event ada di header setiap tab; Ringkasan berisi daftar 'Perlu tindakan', kartu event berikutnya (tiket terjual, check-in, mulai check-in), dan saldo; Event dikelompokkan per tindakan (perlu tindakan, mendatang, ditinjau, selesai) menggantikan filter status, kalender, dan filter tanggal; Keuangan memakai bagian yang tercatat di tiket per event (`eventBalances`), bukan 80/20 yang di-hardcode; Pengaturan hanya rekening pencairan (API) dan info akun read-only, form profil dan notifikasi yang hanya ke localStorage dihapus; pintasan 'Katalog publik' dan 'Portal pelanggan' dihapus dari sidebar. **Bug diperbaiki:** tombol terima tawaran bagi hasil admin tidak pernah tampil (`proposedBy === "PLATFORM"`); rekening dilaporkan tersimpan walau API gagal; ekspor CSV tidak meng-escape kutip dan mengabaikan filter; 5 error tsc di file portal. Logika di `events-portal-groups.ts` + `tests/events-portal-groups.test.ts` (9 lulus). **Sesi 2 (ajukan event):** form pengajuan terintegrasi di dalam portal (`?view=submit`, `EventSubmissionForm` bersama); `/events/submit` ditutup dari publik dan dialihkan ke `/events/portal?view=submit`; semua tautan publik di landing hero, footer, `/events`, dan `/events/[id]` diperbarui sehingga hanya `/events` dan `/events/[id]` yang dapat diakses publik; `OrganizerHeader.tsx` yang tidak terpakai dihapus; tombol tambah event di `/events-admin` diarahkan ke portal. |
| `/events` (katalog event publik) | 656 → 150 | selesai, belum commit (Fase 7/P3) | **Tugas:** pengunjung mencari dan menyaring jadwal kegiatan komunitas (berdasarkan waktu, kategori, atau harga), lalu memilih acara untuk mendaftar atau memesan tiket. **Keputusan:** memecah monolitik `events/page.tsx` ke modul fitur di `features/events-catalog/`; header katalog publik resmi dengan brand link, `ModeToggle`, akses `Tiket saya` (`DropdownMenu` shadcn), dan tombol outline `Portal mitra`; hero bersih bersahaja tanpa gradien neon berlebih; kontrol terpadu (`EventsCatalogToolbar`) menggabungkan tabs waktu (`Mendatang` vs `Telah selesai`), pencarian `InputGroup`, filter tiket `NativeSelect`, dan chips kategori; grid kartu event (`EventCard`) berbasis shadcn `Card`, `aspect-video` poster, badge kategori resmi sentence case, format waktu WITA, harga mono tabular (`font-mono tabular-nums`), tombol primary `Pesan tiket` / `Daftar` untuk event aktif, dan outline `Lihat detail` untuk event lampau; `DataPagination` dan `EmptyState` resmi. Logika di `events-catalog-domain.ts` + test `events-catalog-domain.test.ts` (7/7 lulus). `lint:ui` 0 di seluruh 5 file disentuh; `tsc` 0 error. |
| `/events/[id]` (detail event publik) | 1447 → 420 | selesai, belum commit (Fase 7/P3) | **Tugas:** pengunjung membaca informasi lengkap dan ketersediaan kuota acara komunitas, lalu mendaftar atau memesan tiket dan menerima konfirmasi e-tiket masuk. **Keputusan:** memecah monolitik 1.447 baris `page.tsx` ke modul fitur di `features/event-detail/`; navbar atas resmi dengan tombol kembali ke katalog, tombol `Tiket saya`, `Bagikan`, dan `ModeToggle`; poster bersih rasio 16:9 tanpa glow blur artifisial; grid 2 kolom dengan sticky ticket box di kolom kanan; bilah ketersediaan tiket terpadu (`occupancyRate`% dan sisa kuota); 4 modal manual `fixed inset-0` diubah ke shadcn `Dialog` resmi (`EventBookingDialog`, `EventPaymentGuideDialog`, `EventTicketPassDialog`, `EventShareDialog`); mobile sticky bottom bar dengan harga dan tombol aksi; pembersihan seluruh 419 temuan slop dan warna mentah (`emerald-*`, `slate-*`, `font-black`, `uppercase`, `text-[10px]/[11px]`). Logika di `event-detail-domain.ts` + test `event-detail-domain.test.ts` (5/5 lulus). `lint:ui` 0 di seluruh 6 file disentuh; `tsc` 0 error. |

Masih ada 20 file yang meng-import `components/legacy`. Cek dengan `grep -rl "components/legacy" src | wc -l`.

## 3. Kondisi working tree saat handoff

Pemecahan struktural Fase 6 sudah di-commit (`64964f4`), begitu juga `lint:ui` (`37105c0`), pass copy (`4c88aa1`), dan `/orders` (`80ec405`). Cek `git status` untuk pekerjaan yang belum di-commit. Yang ada di working tree bukan bagian redesign dan **tidak boleh ikut di-commit**: `data/*`, `.audit/`, `Laporan_Settlement_Mingguan_Dago_Mitra.xlsx`, `docs/KLARIFIKASI_SETTLEMENT_MITRA.md`, `panduan.md`, `.claude/`, `data/*.json` baru (`audit_logs`, `loyalty_points`, `pos_orders`, `shifts`). Stage file satu per satu, jangan `git add -A`.

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

## 5. Workflow pemecahan struktur

Ini cara kerja untuk **memecah** file besar (dipakai untuk KDS dan POS, dan nanti Fase 7). Untuk **me-redesign** halaman yang sudah dipecah (P3), ikuti [REDESIGN_PLAYBOOK.md](./REDESIGN_PLAYBOOK.md).

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
8. **Verifikasi penuh.** Build memakai `.next` yang sama dengan dev server. Jalankan build hanya kalau tidak ada dev server milik user yang hidup; **jangan mematikan dev server user**. Kalau ada, lewati build dan laporkan.
   ```bash
   npx vitest run
   ```
   ```bash
   npm run build
   ```
   Baseline: **4 test gagal sejak sebelum redesign** dan tidak terkait UI (`etl-data-validation`, `final-demo-readiness`, `organizer-activation-hardening`, `storage-sync-safety`). Selain 4 itu harus lulus semua. Terakhir: 1028 lulus dari 1032 (test `unified-account` sesekali timeout saat suite penuh; jalankan ulang sendiri sebelum dianggap gagal). Setelah selesai, jalankan lagi dev server (`npm run dev` di background).
9. **Cek Definition of Done** (bagian 5a). Status `selesai` hanya boleh dipakai kalau semua butirnya terpenuhi.
10. **Catat progres** di tabel bagian 2 dokumen ini dan di blok progres Fase 6 pada rencana. Tulis apa yang dipindah ke mana, bug yang ikut diperbaiki, dan apa yang belum.
11. **Tutup sesi:** ringkas ke user, jangan commit sebelum diminta.

## 5a. Definition of Done per halaman

Memecah file dan mengganti tag ke shadcn **belum** redesign. Sebuah halaman baru boleh ditandai `selesai` kalau:

1. **Tugas utama layar ditulis** dalam satu kalimat di catatan tracker, dan tata letak disusun dari situ: apa yang dilihat pertama, satu aksi primary, dan apa yang dipindah ke menu atau panel samping. Sebutkan minimal satu keputusan desain yang berbeda dari layout lama, beserta alasannya.
2. `npm run lint:ui -- <file atau folder yang disentuh>` menghasilkan **0 temuan**. Pengecualian yang disengaja harus diberi komentar `lint-ui-ignore: <alasan>`.
3. Copy lolos glosarium dan aturan pesan di `DESIGN_SYSTEM.md` bagian 8: sentence case, satu bahasa, judul pendek, tanpa enum mentah, tanpa `Mohon/Silakan/Berhasil!`.
4. Komponen bersama dipakai, bukan disalin: `PageHeader`, `StatusBadge`, `EmptyState`, `DataPagination`, `notify()`. Pola yang muncul di dua halaman atau lebih dijadikan komponen di `src/components/app`.
5. Keadaan kosong, loading (`Skeleton`), dan error ditangani jujur, tanpa data palsu.
6. Dicek di browser dalam mode terang, gelap, dan mobile 375px, tanpa menekan aksi yang menulis ke server (lihat bagian 6). Overlay dicek lewat DOM.
7. `tsc`, `vitest` (hanya baseline yang gagal), dan `npm run build` hijau.

Baseline `lint:ui` saat Definition of Done ini dibuat (11 November 2026), sebagai target yang harus turun ke 0 per halaman:

| Area | Temuan |
| --- | --- |
| `features/pos` (termasuk modal) | 713 |
| `features/settings` (termasuk page & printer) | 3694 → 0 |
| `features/customer` (portal pelanggan mobile) | 2035 → 0 |
| `features/events-catalog` (katalog event publik) | 118 → 0 |
| `features/event-detail` (detail event publik) | 419 → 0 |
| `features/events-portal` (portal mitra event) | 900+ → 0 |
| `features/events-admin` | 1786 → 0 |
| `features/activity-log` | 239 → 136 (0 di file disentuh; sisa 136 di `ActivityLogPDFModal`) |
| `features/inventory` | 219 → 171 (sisa di BOMRecipeModal dan modal PDF) |
| `features/coworking` | 208 → 0 di file disentuh (sisa di modal PDF & struk) |
| `features/customers` | 184 → 0 di file disentuh (sisa di modal PDF) |
| `features/commercial` | 161 → 0 di file disentuh (sisa di modal PDF) |
| `features/employees` | 154 → 0 di file disentuh (sisa di modal PDF) |
| `features/reports` | 124 → 108 (0 di file disentuh; sisa 108 di `StructuredReportPDFModal`) |
| `features/orders` | 33 |
| `features/tables` | 24 → 0 |
| `features/ai-insight` | 13 → 0 |
| `features/kitchen` | 0 |
| Seluruh `src/app`, `src/features`, `src/components` | 16528 |

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
- Hook "Fact-Forcing Gate" (khusus Claude Code dengan ECC) menolak `Write` pertama pada file baru. Sebutkan importer, API, skema, dan instruksi user, lalu ulangi.
- zsh: `grep --include=*.ts` gagal karena glob. Pakai kutip atau `grep -rn … src/lib/*.ts`.
- Codemod Tailwind pernah mengubah warna `#1E293B` dan varian `outline`. Kalau menjalankan codemod lagi, periksa diff-nya.
- Test D6, C2, D2, dan D5 sudah diarahkan ke file baru. Pola yang sama berlaku untuk test lain yang membaca sumber.

## 8. Langkah berikutnya

Ikuti rencana di [REDESIGN_REVIEW_GEMINI.md](./REDESIGN_REVIEW_GEMINI.md) bagian 4. P0 (pulihkan branch) dan P1 (`lint:ui`, glosarium, Definition of Done) sudah selesai.

1. P2 (pass copy) selesai. P3: `/orders` dan `/inventory` selesai.
2. **P3 berikutnya: `/tables`**, lalu `/coworking`, `/customers`/`/employees`/`/commercial`, `/reports`/`/activity-log`, `/ai-insight`. Ikuti [REDESIGN_PLAYBOOK.md](./REDESIGN_PLAYBOOK.md).
3. **P4 — modal POS** sebagai `Dialog`/`AlertDialog` sungguhan. Test yang mengunci teks modal: D1 (`ModifierModal`, semantik radio untuk grup sekali pilih), C3 (`PaymentModal`, nominal tunai tidak terisi otomatis), C4 (`ReceiptModal`, tanpa password Wi-Fi statis). Lalu Fase 7 dengan pola pecah dulu, baru migrasi.
4. Fase 8: hapus legacy, lalu jalankan `npm run lint:ui -- --strict` di CI.
