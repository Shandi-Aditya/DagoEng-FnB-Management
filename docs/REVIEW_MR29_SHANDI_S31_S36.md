# Review MR !29 Shandi S-31 sampai S-36 dan panduan perbaikan satu putaran

Tujuan audit ini memeriksa pekerjaan Shandi pada Merge Request `!29` untuk task `S-31` sampai `S-36` terhadap spesifikasi di `Task-List-Magang-POS-WebEvent-23Nov-18Des.xlsx`, lalu menyediakan urutan instruksi perbaikan satu putaran bagi AI agent Shandi. Pemeriksaan dilakukan pada cabang `origin/shandi-dev` di commit `d6892e40fe7118b357d92d8e42f57b5485ffd1df` (`11` commit di atas `origin/develop` `6155cb3632cf98468687740f2f3b4059be183b11`), dibandingkan terhadap `origin/main` di commit `28e8c02ad32d0545f343f217085cb5fe0a06cd33` serta Merge Request paralel `!28` (`origin/feat/v31-v33-pos-qris-kds-mixed-cart` di commit `fb0db24fe7441ea63961f1741ecc440aba081b35`).

**Keputusan audit.** Merge Request `!29` belum layak digabungkan ke `develop`. Belum ada satu pun dari enam task (`S-31` sampai `S-36`) yang lulus penuh sesuai kriteria selesai di Excel. Cabang `origin/shandi-dev` saat ini memecahkan `4` file test regresi yang sebelumnya lulus, gagal `npx tsc --noEmit -p tests/tsconfig.json` dengan `11` error pada `3` file test baru, meninggalkan endpoint pengiriman WhatsApp dan unggah file tanpa autentikasi, menampilkan kuota co-working palsu kepada pengunjung QR tanpa login di `/customer`, menghitung ganda pendapatan ruang meeting di laporan penjualan, menelan error booking ruang meeting sambil tetap menagih pelanggan, menolak pelunasan invoice oleh Kasir dengan HTTP `403`, melanggar arsitektur cetak A4 terisolasi di `docs/DESIGN_SYSTEM.md`, serta berkonflik pada `5` file dengan MR `!28`.

---

## 1. Ringkasan status dan hasil gerbang verifikasi

### 1.1 Hasil gerbang verifikasi terukur pada commit `d6892e40`

Seluruh perintah verifikasi dijalankan pada worktree bersih `d6892e40fe7118b357d92d8e42f57b5485ffd1df` dengan `DATABASE_URL=""` dan `DIRECT_URL=""` setelah `npm ci`:

1. **Status git dan konflik merge.**
	Perintah regenerasi:
	```bash
	git rev-list --count origin/main..origin/develop
	git merge-tree --write-tree --messages origin/develop origin/shandi-dev
	git merge-tree --write-tree --messages origin/feat/v31-v33-pos-qris-kds-mixed-cart origin/shandi-dev
	```
	Hasil terukur:
	- Terhadap `origin/develop` (`6155cb36`): `0` konflik git.
	- Terhadap `origin/main` (`28e8c02ad`): `origin/main` masih tertinggal `232` commit di belakang `origin/develop`. Seluruh pekerjaan `S-01` sampai `S-16` dari MR `!25` belum digabungkan ke `main`.
	- Terhadap MR `!28` (`fb0db24f`): terjadi konflik konten langsung pada `5` file (`src/app/api/coworking/bookings/route.ts`, `src/features/orders/OrderDetailSheet.tsx`, `src/features/pos/types.ts`, `src/features/reports/reports-domain.ts`, dan `src/lib/persistent-storage.ts`), ditambah tabrakan semantik pada `src/app/(dashboard)/pos/page.tsx`, `src/types/order.ts`, `src/app/api/orders/route.ts`, dan `src/features/kitchen/kitchen-board.ts`.

2. **Pemeriksaan UI lint.**
	Perintah regenerasi:
	```bash
	npm run lint:ui -- --strict src
	```
	Hasil terukur adalah kode keluar `0` (`0` temuan otomatis pada `490` file). Namun audit manual terhadap `docs/DESIGN_SYSTEM.md` bagian 7 dan 8 menemukan pelanggaran arsitektur cetak dialog pada `CorporateInvoicePDFModal.tsx`, kebocoran kode enum mentah di `PaymentModal.tsx:865`, kata terlarang `"Harap"`, dan penggunaan Title Case pada empat komponen POS baru.

3. **Pemeriksaan tipe produksi.**
	Perintah regenerasi:
	```bash
	npx tsc --noEmit -p .
	```
	Hasil terukur adalah kode keluar `0` (`0` error).

4. **Pemeriksaan tipe rangkaian test.**
	Perintah regenerasi:
	```bash
	npx tsc --noEmit -p tests/tsconfig.json
	```
	Hasil terukur **GAGAL** dengan kode keluar `2` dan `11` error pada `3` file test baru yang ditambahkan MR `!29`:
	- `tests/s34-cleanup-test-data-and-reconciliation.test.ts` (`baris 90, 108`): properti wajib `createdAt` hilang pada objek `OrderRecord`.
	- `tests/s35-coworking-quota-and-overbooking.test.ts` (`baris 45`): tipe `guestEmail?: string | undefined` tidak kompatibel dengan `guestEmail: string` pada `CoworkingBooking`.
	- `tests/s36-corporate-order-and-invoicing.test.ts` (`baris 43, 52, 61, 88, 97, 125, 170, 175` dan `baris 142`): properti `subtotal` tidak ada pada `OrderItemRecord`, dan properti `phone` tidak ada pada `CoworkingBooking`.

5. **Rangkaian uji Vitest.**
	Perintah regenerasi:
	```bash
	DATABASE_URL="" DIRECT_URL="" npx vitest run
	```
	Hasil terukur **GAGAL** dengan kode keluar `1` (`9` dari `182` file gagal, `17` dari `2.023` skenario gagal, `173` file dan `2.006` skenario lulus). Klaim pada deskripsi MR `!29` bahwa hanya 4 baseline warisan `AGENTS.md` yang gagal tidak sesuai kondisi nyata:
	- `4` file gagal merupakan **regresi langsung akibat perubahan MR `!29`**: `tests/community-events-integration.test.ts:155`, `tests/post-implementation-audit.test.ts:207`, `tests/pos-tenant-operating-hours-v03.test.ts:50, 94`, dan `tests/v18-receipt-settlement-and-roles.test.ts:297`.
	- `2` file gagal merupakan efek tanggal fixture masa lalu pada base `develop` saat tanggal sistem melewati `2026-11-20` (bukan regresi MR `!29`): `tests/events-admin-domain.test.ts` dan `tests/release-verification-audit.test.ts`.
	- `3` file gagal termasuk dalam daftar 4 baseline `AGENTS.md`: `tests/etl-data-validation.test.ts`, `tests/final-demo-readiness.test.ts`, dan `tests/storage-sync-safety.test.ts`.

6. **Build produksi Next.js.**
	Perintah regenerasi:
	```bash
	DATABASE_URL="" DIRECT_URL="" npm run build
	```
	Hasil terukur adalah kode keluar `0` (`36/36` rute statis dan dinamis berhasil dibangun). Uji klik interaktif di browser tidak dijalankan oleh agent pada sesi review ini.

### 1.2 Tabel status per task terhadap kriteria Excel

| Kode | Prioritas | Task di Excel | Kriteria selesai di Excel | Status di MR `!29` | Ringkasan gap utama |
| :--- | :---: | :--- | :--- | :---: | :--- |
| `S-31` | P0 | Rilis perbaikan ke production dan siapkan staging | Staging aktif dengan database terpisah, perubahan `S-01` s.d. `S-16` terlihat di production, changelog rilis pertama ada | Perlu perbaikan | `origin/main` masih tertinggal `232` commit di belakang `origin/develop` sehingga `S-01` s.d. `S-16` belum masuk cabang produksi. SOP belum mewajibkan `npx tsc --noEmit -p tests/tsconfig.json`. Item `S-31` salah ditempatkan di bawah `[1.0.0]` di `CHANGELOG.md:37`. |
| `S-32` | P0 | Tutup kebocoran data member dan audit endpoint publik | Tanpa login `401`, Customer hanya melihat data dirinya, daftar endpoint tercatat di MR | Perlu perbaikan | Memecahkan `tests/v18-receipt-settlement-and-roles.test.ts` (`403` bagi Kasir di `GET /api/settings/settlement-receipt`) dan `tests/pos-tenant-operating-hours-v03.test.ts` (`401`). `POST /api/notifications/whatsapp` dan `POST /api/events/upload` masih tanpa autentikasi. `GET /api/sync/wifi` dkk terbuka publik walau dokumen audit mengklaim terkunci `401`. `GET /api/pos/qris/verify` tidak memeriksa role. `CASHIER` masih dapat menginjeksi `points: 99999` di `PUT /api/loyalty/members`. |
| `S-33` | P0 | Perbaiki pesan tiket berbayar atomik dan klik berulang | Pesan sukses langsung ke instruksi bayar, bila gagal tidak ada tiket tersimpan, tidak ada tiket ganda saat klik berulang | Perlu perbaikan | Tidak ada `clientReferenceId` di kode walaupun diklaim di deskripsi MR. Heuristik 15 detik memecahkan `tests/community-events-integration.test.ts` dan `tests/post-implementation-audit.test.ts`, serta membocorkan `guestToken` lewat klausul `!normalizedPhone` di `events.ts:4414`. `expirePendingBookings()` di `events.ts:4395` menulis ke DB di luar transaksi dan di luar advisory lock. |
| `S-34` | P0 | Bersihkan data uji dan rekonsiliasi shift lama | Layar kasir tanpa peringatan shift, KDS dan dashboard tanpa data uji, halaman event hanya event asli | Perlu perbaikan | `transformEvents` menolak usulan bagi hasil milik event asli (`Fun Run & Coffee Morning 2026`). Tiket aktif pada event uji yang diarsipkan tidak ikut dibatalkan. Event `PENDING` `"sdfghjkl;;;;"` terlewat. `runCleanup` tetap keluar dengan kode `0` saat transaksi DB gagal. `data/*.json` di repo masih kotor dan test gagal `tsc`. |
| `S-35` | P1 | Kuota co-working terlihat oleh kasir dan pelanggan | Kasir dan pelanggan melihat sisa kursi yang sama, overbooking ditolak, slot lewat berlabel `"Lewat"` | Perlu perbaikan | Pengunjung QR tanpa login di `/customer` mendapat `401` dari `GET /api/coworking/bookings` sehingga selalu melihat `8/8 tersisa` dan booking tamu tersangkut di outbox. `POST` mempercayai `booking.maxCapacity` dari body klien. `NewBookingModal.tsx` di `/coworking` menolak kursi ke-2 Hot Desk dan belum menampilkan kuota serta label `"Lewat"`. Server belum menolak slot yang sudah lewat. |
| `S-36` | P1 | Order perusahaan | Buat 1 order perusahaan berisi meeting room + konsumsi, invoice terbit, laporan bisa difilter per perusahaan | Perlu perbaikan | Gagal booking ruang meeting ditelan diam-diam namun tetap ditagih, jam dikunci `09:00` 1 jam dengan tanggal UTC, omzet ruang meeting dihitung ganda di laporan, sewa ruang kena PB1 + masuk tiket dapur, pelunasan `COMPLETED + INVOICE` oleh Kasir ditolak server `403`, invoice belum lunas tidak bisa dibuka dari `/orders`, dan `CorporateInvoicePDFModal` memakai `window.print()` yang melanggar `DESIGN_SYSTEM.md`. |

---

## 2. Audit detail temuan per task dan integrasi cabang

### 2.1 Task S-31 (Rilis perbaikan ke production dan siapkan staging)

1. **Cabang `main` belum menerima rilis `S-01` sampai `S-16`.**
	Pada git remote saat ini, `origin/main` (`28e8c02ad32d0545f343f217085cb5fe0a06cd33`) tertinggal `232` commit di belakang `origin/develop` (`6155cb3632cf98468687740f2f3b4059be183b11`). Dokumen `docs/SOP_RILIS_DAN_STAGING.md` dan `docs/DEPLOY_COOLIFY.md` sudah disusun dengan baik, tetapi kriteria selesai Excel menuntut staging benar-benar aktif dengan database terpisah dan perubahan `S-01` sampai `S-16` sudah tampil di production. Rilis `develop` ke `main` serta bukti URL staging dan produksi perlu diverifikasi bersama operator.
2. **Gerbang tipe test belum masuk ke SOP rilis (`docs/SOP_RILIS_DAN_STAGING.md`).**
	Skrip `npm run type-check` di `package.json:12` hanya memeriksa `tsconfig.json` yang mengecualikan direktori `tests/`. Karena `npx tsc --noEmit -p tests/tsconfig.json` tidak tercantum di 4 gerbang SOP rilis, `11` error TypeScript pada file test baru MR `!29` lolos tanpa terdeteksi.
3. **Penempatan entri `S-31` di `CHANGELOG.md:37` tidak akurat.**
	Baris `Arsitektur Rilis dan Server Staging (S-31)` ditulis di dalam seksi `[1.0.0] - 2026-11-23`, padahal file SOP tersebut baru ditambahkan oleh MR `!29` ini bersama `S-32` sampai `S-36`. Pindahkan poin `S-31` ke blok `[Unreleased]`.

### 2.2 Task S-32 (Kebocoran data member dan audit endpoint publik)

1. **Regresi HTTP `403` untuk Kasir pada `GET /api/settings/settlement-receipt` (`src/app/api/settings/settlement-receipt/route.ts:37-46`).**
	Pembatasan `ALLOWED_SETTLEMENT_READ_ROLES` hanya ke `["SUPER_ADMIN", "OWNER", "MANAGER"]` menyebabkan dua kerusakan sekaligus:
	- `tests/v18-receipt-settlement-and-roles.test.ts:292-301` langsung gagal (`expected 403 to be 200`) saat menguji sesi `CASHIER_SGR`.
	- `src/contexts/PrinterContext.tsx:151-154` gagal mengambil konfigurasi `receiptRoles` untuk akun `CASHIER`, `WAITER`, dan `KITCHEN_STAFF`, sehingga perubahan izin cetak struk yang diatur Super Admin tidak pernah sampai ke perangkat kasir.
	Akar masalahnya adalah penyamaan hak baca seluruh objek dengan hak baca persentase `revenueSplits`. Solusinya adalah mengizinkan peran operasional POS membaca endpoint ini, namun menyamarkan `revenueSplits` menjadi `{}` bagi peran non-manajerial.
2. **Regresi HTTP `401` pada `tests/pos-tenant-operating-hours-v03.test.ts:43-50, 78-84`.**
	Penambahan autentikasi pada `POST /api/tenant/operations` sudah tepat secara keamanan, tetapi file test regresi `v03` belum diperbarui untuk menyertakan cookie sesi berwenang (`dagoeng_active_persona=SUPER_ADMIN` atau `TENANT_OWNER_KS`), sehingga 2 skenario `v03` gagal dengan HTTP `401`.
3. **Tiga endpoint terbuka terlewat dan dua baris matriks salah pada `docs/AUDIT_ENDPOINT_KEAMANAN_S32.md`.**
	- `src/app/api/notifications/whatsapp/route.ts:10-125` (`POST`) tidak memiliki pemeriksaan `getRequestAuthUser` sama sekali dan tidak tercantum di dokumen audit. Siapa pun tanpa login dapat mengirim pesan WhatsApp sembarang ke `targetPhone` pilihan penyerang memakai token `FONNTE_API_TOKEN` milik perusahaan saat layanan diaktifkan.
	- `src/app/api/sync/[domain]/route.ts:96-107` (`GET`) tertulis di baris 31 dokumen audit memerlukan sesi staf (`401`). Faktanya, `spec.authorizeRead` pada `6` dari `9` domain mengembalikan `{ allowed: true }` tanpa sesi login: `wifi` (`config-spec.ts:1448`, membocorkan kode voucher Wi-Fi aktif di `wifi_state.json`), `subscription` (`config-spec.ts:1689`), `printer-config` (`config-spec.ts:1962`), `inventory` (`inventory-spec.ts:254`), `platform-settings` (`config-spec.ts:867`), dan `tables` (`spaces-spec.ts:622`). Domain internal (`wifi`, `subscription`, `printer-config`, `inventory`) wajib dikunci `401` tanpa sesi staf, sedangkan domain yang memang dibaca halaman publik `/customer` (`platform-settings`, `tables`, `tenants`, `coworking-master`) harus disanitasi dari field sensitif dan dicatat jujur di dokumen audit.
	- `src/app/api/events/upload/route.ts:27` (`POST`) tidak memiliki autentikasi sesi maupun pembatasan peran, padahal menyimpan gambar hingga 10 MB langsung ke tabel `SystemSetting` PostgreSQL (`baris 75-91`) dan `public/images/events/` (`baris 102`).
	- `src/app/api/pos/qris/verify/route.ts:21-29` (`GET`) hanya memeriksa `auth.isAuthenticated` tanpa memeriksa `POS_ALLOWED_ROLES.includes(auth.role)` (konstanta `POS_ALLOWED_ROLES` di baris `18` tidak terpakai pada `GET`), sehingga sesi `CUSTOMER` atau `WAITER` dapat membaca rincian sesi QRIS (`rrn`, `referenceNumber`, nominal). Baris 29 dokumen audit mengklaim endpoint ini sudah dibatasi ke 4 peran POS.
	- `src/app/api/tenant/products/[id]/toggle/route.ts:3-27` (`PATCH`) adalah stub tanpa autentikasi yang selalu mengembalikan `success: true` palsu tanpa penyimpanan data.
4. **Celah injeksi poin dan eskalasi tier oleh `CASHIER` pada `PUT /api/loyalty/members` (`src/app/api/loyalty/members/route.ts:488-525`).**
	Saat ini `updates.points` dari `CASHIER` hanya divalidasi sebagai angka non-negatif (`baris 488-506`), lalu dipakai menghitung `expectedNextTier`. Akibatnya sesi `CASHIER` dapat memanggil `PUT /api/loyalty/members` dengan `{ id, updates: { points: 99999 } }` secara langsung untuk menaikkan member ke `Platinum`. Perhatikan bahwa `LoyaltyContext.addPoints` dan `redeemPoints` (`src/contexts/LoyaltyContext.tsx:711-765`) sah dipanggil dari kasir POS dengan menyertakan entri `pointHistory` yang memiliki `relatedTransactionId`. Oleh karena itu, jangan memblokir `CASHIER` secara buta, melainkan validasi bahwa setiap perubahan `points` oleh peran non-manajerial wajib didukung entri `pointHistory` baru dengan `relatedTransactionId` yang cocok terhadap transaksi lunas di `getPersistentOrders()`.

### 2.3 Task S-33 (Booking atomik tiket berbayar dan klik berulang)

1. **`clientReferenceId` belum diimplementasikan, memicu regresi 2 suite test dan celah pencurian `guestToken` (`src/lib/events.ts:4406-4438`, `src/app/events/[id]/page.tsx`).**
	Deskripsi MR `!29` menyebut penggunaan `clientReferenceId`, namun pencarian di seluruh kode menunjukkan nol kemunculan `clientReferenceId`. Sebagai gantinya, `events.ts:4412-4425` mencocokkan semua request dalam jendela 15 detik dengan email, tier, dan jumlah tiket yang sama:
	- Akibat pertama, dua pemanggilan terpisah `createEventBooking` dengan email sama dalam 15 detik (skenario anti-spam yang diuji `tests/community-events-integration.test.ts:155` dan `tests/post-implementation-audit.test.ts:207`) mengembalikan booking pertama alih-alih melempar error tunggu 3 menit, sehingga kedua suite test tersebut gagal.
	- Akibat kedua, baris `4414` menulis `const isSamePhone = !normalizedPhone || !b.guestPhone || b.guestPhone.trim() === normalizedPhone;`. Pihak luar yang mengetahui email pembeli dan mengirim request tanpa `guestPhone` dalam 15 detik sejak korban memesan akan langsung menerima objek booking lengkap berisi rahasia `guestToken`.
	- Akibat ketiga, jika koneksi pembeli lambat dan klik ulang terjadi pada detik ke-16 sampai menit ke-3, request tertolak oleh guard anti-spam 3 menit (`baris 4427-4438`) tanpa mengembalikan halaman instruksi bayar.
2. **`expirePendingBookings()` di dalam transaksi menulis di luar transaksi dan di luar lock (`src/lib/events.ts:4395`).**
	Di dalam callback `runWithDistributedEventLock(payload.eventId, async (tx) => ...)`, baris `4395` memanggil `await expirePendingBookings()`. Fungsi tersebut (`events.ts:3271-3314`) membaca `loadBookingsFromDisk()` (bukan snapshot `tx`) dan memanggil `saveBookingsToDisk(allBookings)` tanpa `{ tx }`. Penulisan di luar transaksi ini membuka koneksi kedua yang berpotensi memicu error `LOST_UPDATE_PREVENTED` (`503` "database penyimpanan tiket sedang gangguan", gejala yang justru harus dimatikan oleh `S-33`) atau menyimpan perubahan parsial ketika transaksi utama gagal.
3. **Pencocokan judul event uji di rute produksi (`src/app/api/events/[id]/book/route.ts:48`).**
	Kondisi `eventRecord?.title.includes("Next.js 14 Production Workshop")` yang memaksa metode pembayaran menjadi `DOKU_CHECKOUT` aktif di semua environment. Batasi kondisi tersebut hanya saat `process.env.NODE_ENV === "test"`.

### 2.4 Task S-34 (Pembersihan data uji dan rekonsiliasi shift lama)

1. **`transformEvents` menolak usulan bagi hasil milik event asli (`scripts/reconcile-and-cleanup-s34.ts:167-175`).**
	Pengecekan `if (updated.proposedRevenueSplit && updated.proposedRevenueSplit.status === "PENDING")` berada di luar kondisi `isTargetTest`. Jika skrip dijalankan terhadap data saat ini, usulan bagi hasil pada event nyata yang sudah disetujui seperti `evt-1793857072198-wxia1` (`"Fun Run & Coffee Morning 2026"` di `data/events.json:91-130`) ikut ditolak dengan alasan `"Usulan uji coba diabaikan"`.
2. **Tiket pada event uji belum ikut dibatalkan seluruhnya (`scripts/reconcile-and-cleanup-s34.ts:191-210`).**
	`transformBookings` hanya membatalkan tiga kode tiket (`DAGO-EVT-14704`, `DAGO-EVT-91979`, `DAGO-EVT-13394`). Tiket lain yang menempel pada event uji yang diarsipkan, seperti `DAGO-EVT-96354` pada `[TEST QA 2]` (`data/event_bookings.json:151-200`) dan empat tiket pada `evt-pilates-gift-voucher` (`Gift Voucher (Tes 1)`), tetap berstatus `PAID` atau `CHECKED_IN` dan tautan e-tiketnya tetap aktif.
3. **Target event sampah `PENDING` terlewat dan kegagalan database ditelan dengan exit code `0` (`scripts/reconcile-and-cleanup-s34.ts:40-60, 264-297`).**
	- Event `evt-1793810790340-73pia` berjudul `"sdfghjkl;;;;"` dengan status `PENDING` di `data/events.json:133` tidak masuk daftar `S34_TARGETS`, sehingga notifikasi pengajuan di dashboard tidak menjadi bersih. Sebaliknya, konfirmasi dulu apakah `evt-1794204831538-jjg02` (`"Komunitas pencinta musang"`) benar merupakan data uji sebelum diarsipkan.
	- Pada baris `282-284`, saat `prisma.$transaction` gagal, blok `catch` hanya mencatat `console.error`, lalu skrip tetap menimpa file JSON lokal, mencetak `"PEMBERSIHAN DATA UJI SELESAI SECARA SUKSES & ATOMIK"`, dan keluar dengan kode `0`.
	- File `data/events.json` dan `data/event_bookings.json` di dalam commit MR `!29` masih menyimpan `[TEST QA 2]` berstatus `APPROVED` serta `Gift Voucher (Tes 1)` tanpa pembersihan, dan skrip belum memiliki mode `--dry-run` vs `--apply`.
4. **Fixture test gagal kompilasi TypeScript (`tests/s34-cleanup-test-data-and-reconciliation.test.ts:90, 108`).**
	Objek `OrderRecord` pada test kehilangan field wajib `createdAt`.

### 2.5 Task S-35 (Kuota co-working terlihat oleh kasir dan pelanggan)

1. **Pengunjung QR tanpa login di `/customer` melihat `8/8 tersisa` palsu dan booking tamu tersangkut di outbox (`src/app/api/coworking/bookings/route.ts:64-75, 149-158`, `src/contexts/CoworkingContext.tsx:255-267`, `src/lib/sync-outbox.ts:374`).**
	Halaman `/customer` terbuka untuk publik tanpa login (`src/lib/route-guard.ts:134`). Saat pengunjung memindai QR meja dan membuka tab **Ruang kerja** (`SpaceView.tsx`), `CoworkingContext` memanggil `GET /api/coworking/bookings` yang langsung mengembalikan HTTP `401`. Karena `hydrateFromServer` berhenti saat `!res.ok`, `SpaceView.tsx` menghitung sisa kursi dari `localStorage` kosong dan menampilkan `8/8 tersisa` pada seluruh jam, sementara Kasir melihat angka sebenarnya (`5/8 tersisa`). Lebih buruk lagi, jika tamu menekan pesan ruang tanpa sesi login, `POST /api/coworking/bookings` mengembalikan `401` yang dianggap dapat dicoba ulang oleh `sync-outbox.ts:374`, sehingga booking hanya tersimpan semu di HP tamu dan tidak pernah masuk ke server maupun layar Kasir.
2. **Parameter `booking.maxCapacity` dari request klien dapat menembus batas kuota server (`src/app/api/coworking/bookings/route.ts:200-202`).**
	Baris `const maxCapacity = booking.maxCapacity ?? (space.type === "HOT_DESK" ? space.capacity || 8 : 1);` mempercayai field `maxCapacity` dari payload JSON klien. Pengiriman `{ maxCapacity: 999 }` meloloskan ratusan booking paralel di dalam lock `saveCoworkingBooking`.
3. **Modal admin `/coworking` (`src/features/coworking/NewBookingModal.tsx:179-187, 392-404`) menolak kursi ke-2 Hot Desk dan belum menampilkan kuota serta label `"Lewat"`.**
	Pemanggilan `checkCoworkingBookingConflict` di `NewBookingModal.tsx:179-187` tidak menyertakan `maxCapacity`, sehingga default ke `1` (`src/lib/operating-hours.ts:448`) dan menolak pemesanan kursi ke-2 pada Hot Desk berkapasitas 8 kursi dengan pesan `"Jadwal bentrok"`. Selain itu, deretan tombol pilih jam di baris `392-404` belum menampilkan sisa kursi (`5/8 tersisa`) maupun badge `"Lewat"`.
4. **Penolakan slot `"Lewat"` belum ditegakkan di server dan batas menit belum seragam (`src/app/api/coworking/bookings/route.ts:218-247`, `src/features/pos/pos-coworking.ts:37-60, 76-98`).**
	`validateCoworkingBookingSchedule` di server hanya memeriksa jam buka `09:00` sampai `18:00` tanpa memeriksa apakah jam slot sudah terlewat pada hari ini WITA, serta dilewati sama sekali saat pembaruan booking (`if (!matchedExisting)`). Di sisi UI, `isSlotPast` memakai `slotH < curH` (pukul `14:59` masih mengizinkan slot `14:00`), sedangkan `getValidOperationalTime` sudah menggeser jam default ke `15:00` lewat menit ke-15.
5. **Polusi file data nyata dan error tipe pada `tests/s35-coworking-quota-and-overbooking.test.ts:45, 226-246`.**
	Helper `makeBooking` memicu error `TS2322` pada `guestEmail`, dan pengujian `saveCoworkingBooking` di baris `226-245` menulis langsung ke penyimpanan `coworking_bookings.json` tanpa isolasi direktori sementara (`DATA_DIR_OVERRIDE`) serta menguji penolakan secara berurutan, bukan paralel dengan `Promise.all`.

### 2.6 Task S-36 (Order perusahaan)

1. **Kegagalan booking ruang meeting ditelan diam-diam namun tetap ditagihkan, dengan jadwal hardcoded `09:00` 1 jam dan tanggal UTC (`src/app/(dashboard)/pos/page.tsx:785-812`, `src/features/pos/CartOrderSetup.tsx:253-274`).**
	- Jika `cwBookSpace` melempar `DOUBLE_BOOKING_CONFLICT` atau jadwal tutup, blok `catch` di `pos/page.tsx:809-811` hanya menjalankan `console.warn` lalu tetap membuat `OrderRecord` beserta tagihan item `Sewa Ruang Meeting` di struk dan invoice.
	- Pemanggilan `cwBookSpace` mengunci `date: new Date().toISOString().split("T")[0]` (tanggal UTC yang meleset mundur satu hari sebelum pukul 08.00 WITA), `startTime: "09:00"`, dan `duration: 1`. Formulir `CartOrderSetup.tsx` belum memiliki input tanggal pakai, jam mulai, dan durasi jam sewa untuk pesanan perusahaan (misalnya DE memesan ruang meeting 4 jam untuk besok).
	- Di keranjang kasir, kuantitas item `bundle-meeting-*` dapat ditambah kasir tanpa mengubah `duration` pada booking co-working.
2. **Pendapatan ruang meeting dihitung ganda di laporan penjualan (`src/app/(dashboard)/pos/page.tsx:280-296, 787-807`, `src/features/reports/reports-domain.ts:485-529`, `tests/s36-corporate-order-and-invoicing.test.ts:235-238`).**
	Bundling korporat memasukkan item ruang meeting bernilai `hourlyRate` ke dalam `OrderRecord.total` sekaligus membuat `CoworkingBooking` terpisah dengan `paidAmount: hourlyRate` (`paymentStatus: "PAID"` untuk `PREPAID`). Pada `buildReportData` tipe `SALES`, `totalRevenue` menjumlahkan `order.total` dan `paidCoworking.paidAmount`, sehingga sewa ruang Rp 200.000 tercatat dua kali. File test `tests/s36-corporate-order-and-invoicing.test.ts:238` justru mengunci bug ini dengan menguji nilai gabungan `"968.000"` (`748.000` + `220.000`).
3. **`CorporateInvoicePDFModal.tsx` melanggar aturan mesin cetak A4 terisolasi di `docs/DESIGN_SYSTEM.md` bagian 7 (`src/features/pos/CorporateInvoicePDFModal.tsx:61-95, 207-247`).**
	`docs/DESIGN_SYSTEM.md` baris `200-251` melarang pemanggilan `window.print()` langsung pada dokumen induk dialog karena scroll-lock Base UI Dialog dan tinggi `100vh` dashboard memicu halaman 1 kosong saat dicetak. `CorporateInvoicePDFModal.tsx` justru menggunakan `window.print()` dengan injeksi `<style>@media print ...` pada DOM utama, tidak memakai struktur pembungkus `DialogContent` terikat (`max-h-[88vh] h-[88vh] flex flex-col p-0 gap-0 overflow-hidden` + reset scroll `requestAnimationFrame`), dan tabel rinciannya belum memakai `table-fixed` beserta `<colgroup>` 100% dan `break-words`.
4. **Pelunasan tagihan `COMPLETED + INVOICE` oleh Kasir ditolak HTTP `403` oleh server, tidak mendukung metode `TRANSFER`, dan meninggalkan booking co-working menggantung (`src/app/api/orders/route.ts:207, 261-274`, `src/features/pos/types.ts:50`).**
	- Di antarmuka `/orders`, tombol **Bayar** sengaja diaktifkan untuk pesanan `COMPLETED` ber-`paymentMethod === "INVOICE"` dan `paymentStatus === "PENDING"` (`OrdersTable.tsx:167`, `OrderDetailSheet.tsx:100`). Namun di server, `authorizeOrderMutation` (`src/app/api/orders/route.ts:207, 261-274`) mendefinisikan `const isClosed = existing.status === "COMPLETED" || existing.status === "CANCELLED"` lalu hanya mengizinkan peran POS bila `!isClosed`. Saat Kasir memproses pelunasan invoice yang makanannya sudah selesai disajikan (`COMPLETED`), server menolak dengan HTTP `403`.
	- Dokumen invoice memerintahkan klien melunasi lewat transfer bank ke rekening BCA atau Mandiri resmi (`CorporateInvoicePDFModal.tsx:293-304`), tetapi `POSPaymentMethod` dan `PaymentModal.tsx` hanya menyediakan `QRIS`, `CASH`, `EDC`, `SPLIT`, dan `INVOICE` tanpa opsi `TRANSFER` (dengan input nomor referensi bukti transfer).
	- Saat pesanan `INVOICE` dilunasi di `/orders` atau dibatalkan (`voidOrder`), `CoworkingBooking` yang tertaut lewat `corporateInfo.linkedBookingCode` tidak ikut diperbarui menjadi `PAID` atau `CANCELLED`.
5. **Invoice perusahaan tidak bisa dibuka atau dicetak ulang dari `/orders` selama belum lunas (`src/features/orders/OrderDetailSheet.tsx:296`, `src/app/(dashboard)/orders/page.tsx:644-648`, `src/features/pos/CorporateInvoicePDFModal.tsx:45`).**
	Tombol invoice hanya diletakkan di dalam `ReceiptModal` yang di halaman `/orders` baru bisa dibuka ketika `isPaid === true`. Akibatnya, segera setelah kasir menutup modal usai menerbitkan tagihan bertempo (`paymentStatus: "PENDING"`), kasir maupun manajer tidak lagi memiliki tombol apa pun di `/orders` untuk mengunduh atau mencetak ulang PDF invoice yang harus dikirim ke perusahaan untuk ditagihkan. Selain itu, baris `45` di `CorporateInvoicePDFModal.tsx` menentukan `const isPaid = receiptData.paymentMethod !== "INVOICE"` alih-alih memeriksa `paymentStatus === "PAID"`.
6. **Sewa ruang meeting ikut terkena PB1 10% + service charge F&B, tercetak ke tiket dapur KDS, dan audit log salah menulis `"LUNAS"` (`src/app/(dashboard)/pos/page.tsx:435-448, 865-904`, `src/contexts/OrderContext.tsx:973`).**
	- Item `bundle-meeting-*` tidak diberi penanda kategori ruang kerja, sehingga dikenakan pajak restoran PB1 10% serta service charge `DINE_IN`, dan ikut masuk ke `kitchenTicket.items` sehingga dapur menerima cetakan tiket memasak `"Sewa Ruang Meeting"`.
	- `OrderContext.tsx:973` mencatat audit log `(${newOrder.paymentMethod} - LUNAS)` meskipun `newOrder.paymentStatus === "PENDING"` pada tagihan bertempo.
	- Jika kasir menyalakan toggle **Order perusahaan** tetapi lupa mengisi nama perusahaan (`pos/page.tsx:776`), transaksi diam-diam turun menjadi pesanan reguler dan membuang data PIC tanpa peringatan validasi.
	- `OrderPayloadSchema` di `src/app/api/orders/route.ts:287-303` belum mendeklarasikan skema `corporateInfo`, dan ekspor Excel di `src/app/(dashboard)/reports/page.tsx:281-299` saat difilter perusahaan belum menyertakan `CoworkingBooking` ber-`company` yang tampil di layar `SALES`.
7. **Pelanggaran copy `docs/DESIGN_SYSTEM.md` bagian 8, `any` di `persistent-storage.ts`, dan kualitas test `s36`.**
	- Kebocoran enum mentah pada tombol `Konfirmasi pembayaran (${activeTab})` di `src/features/pos/PaymentModal.tsx:865` (menampilkan `"Konfirmasi pembayaran (CASH)"` atau `"(SPLIT)"`).
	- Kata terlarang `"Harap"` di `CorporateInvoicePDFModal.tsx:304` dan label Inggris/Title Case pada `CartOrderSetup.tsx:156, 176, 221, 239, 247-248, 256`, `PaymentTabInvoice.tsx:24, 37, 41-42, 45`, `ReceiptModal.tsx:557`, serta `CorporateInvoicePDFModal.tsx:69, 128, 150, 170-196, 214, 267-299`.
	- Penggunaan tipe `any` dan `as any` pada `src/lib/persistent-storage.ts:305-310, 317, 348-349, 382`.
	- `tests/s36-corporate-order-and-invoicing.test.ts` gagal `tsc` (`9` error), baris `160-190` hanya menguji objek fixture buatan sendiri (tautologi tanpa memanggil fungsi aplikasi), dan baris `238` mengunci bug pendapatan ganda.

### 2.7 Benturan integrasi dan konflik langsung dengan MR `!28` (`V-31` sampai `V-33`)

Merge Request `!28` (`origin/feat/v31-v33-pos-qris-kds-mixed-cart` di `fb0db24f`) sedang berjalan paralel ke `develop` dan menyentuh subsistem POS yang sama:

1. **Perbedaan nama diskriminan tipe item co-working (`src/types/order.ts`).**
	MR `!28` menetapkan `export type OrderItemCategoryType = "FNB" | "COWORKING"` beserta `coworkingMeta?: CoworkingOrderItemMeta` dan helper `isCoworkingOrderItem`. Sebaliknya, MR `!29` menambahkan `itemType?: "FNB" | "COWORKING_SPACE"` di `src/types/order.ts:71`. Jika tidak disamakan ke `"COWORKING"`, seluruh pembebasan PB1 per item, pemisahan struk, dan penyaringan KDS milik `V-33` tidak akan mengenali item ruang meeting dari `S-36`.
2. **Gerbang pembayaran KDS `V-32` vs pesanan perusahaan bertempo `INVOICE` (`src/features/kitchen/kitchen-board.ts`).**
	Pada MR `!28`, `isOrderEligibleForKds` (`kitchen-board.ts:132-136`) membatasi KDS hanya untuk `order.paymentStatus === "PAID" && order.status !== "CANCELLED"`. Untuk pesanan perusahaan `billingType: "INVOICE"`, status bayar sah bernilai `"PENDING"` selama termin 14 hari, tetapi dapur wajib memasak konsumsi rapat pada hari pesanan dibuat. Saat kedua cabang disatukan, `isOrderEligibleForKds` dan alur potong BOM wajib mengizinkan pesanan bertempo perusahaan yang sudah terkonfirmasi (`paymentMethod === "INVOICE"` atau `corporateInfo?.billingType === "INVOICE"`).
3. **Lima file konflik git langsung (`coworking/bookings/route.ts`, `OrderDetailSheet.tsx`, `pos/types.ts`, `reports-domain.ts`, `persistent-storage.ts`) dan duplikasi mixed-cart di `pos/page.tsx`.**
	Panduan penyelarasan per file dicantumkan pada Tahap 7 di bawah agar penggabungan MR `!28` dan MR `!29` berjalan mulus tanpa regresi silang.

---

## 3. Panduan perbaikan satu putaran untuk AI agent Shandi

Ikuti aturan dasar berikut selama mengerjakan perbaikan:
- Jangan mengubah file di `src/components/ui/*` dan jangan mengimpor dari `src/components/legacy/*`.
- Jangan melemahkan tipe domain produksi di `src/types/*` demi membungkam error TypeScript di `tests/`. Perbaiki fixture di file test.
- Jangan menghapus atau melemahkan asersi pada test regresi lama.
- Jalankan seluruh perintah test atau skrip verifikasi lokal dengan `DATABASE_URL="" DIRECT_URL=""` agar tidak menulis ke database Neon produksi.

Kerjakan delapan tahap berikut secara berurutan.

### Tahap 1. Rapikan dokumen rilis dan gerbang tipe test (`S-31`)

1. Buka `CHANGELOG.md` dan pindahkan poin `Arsitektur Rilis dan Server Staging (S-31)` dari bawah `[1.0.0] - 2026-11-23` (`baris 37`) ke bagian `[Unreleased]` bersama `S-32` sampai `S-36`.
2. Buka `docs/SOP_RILIS_DAN_STAGING.md` dan tambahkan perintah `npx tsc --noEmit -p tests/tsconfig.json` ke daftar gerbang wajib pra-rilis berdampingan dengan `npm run type-check`, sehingga error tipe pada `tests/` selalu tertangkap sebelum merge ke `develop` maupun `main`.
3. Catat di deskripsi MR status aktual `origin/main` (`28e8c02ad`) terhadap `origin/develop` (`6155cb36`), lalu koordinasikan eksekusi merge rilis ke `main` dan verifikasi environment staging Coolify dengan database Neon terpisah sesuai kriteria selesai `S-31`.

### Tahap 2. Tutup celah endpoint tersisa dan pulihkan regresi RBAC (`S-32`)

1. **Pulihkan akses baca kebijakan struk untuk staf POS di `src/app/api/settings/settlement-receipt/route.ts:37-57`.**
	- Ubah daftar peran baca pada `GET` menjadi `["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER", "WAITER", "KITCHEN_STAFF"]`.
	- Periksa apakah pemanggil termasuk peran manajerial (`["SUPER_ADMIN", "OWNER", "MANAGER"].includes(auth.role)`). Jika bukan peran manajerial, kembalikan `policy: { ...policy, revenueSplits: {} }` dengan status HTTP `200`. Dengan cara ini persentase bagi hasil mitra tetap tersembunyi dari Kasir, `PrinterContext.tsx` tetap memperoleh `receiptRoles` dan `settlementBasis`, serta `tests/v18-receipt-settlement-and-roles.test.ts:297` kembali lulus.
2. **Perbarui pemanggil autentikasi pada `tests/pos-tenant-operating-hours-v03.test.ts:43-50, 78-84`.**
	- Tambahkan header `cookie: "dagoeng_active_persona=SUPER_ADMIN"` pada `postReq` (`baris 45`) dan `saveReq` (`baris 80`) agar skenario persistensi jam operasional mitra menguji penyimpanan dengan sesi sah dan kembali lulus `200`, sambil mempertahankan pengujian penolakan `401` tanpa login di `tests/s32-member-data-leak-and-endpoint-audit.test.ts`.
3. **Kunci endpoint yang masih terbuka tanpa login.**
	- Di `src/app/api/notifications/whatsapp/route.ts:10`, panggil `const auth = await getRequestAuthUser(req);` di awal `POST`. Kembalikan `401` bila `!auth.isAuthenticated || !auth.role`, dan kembalikan `403` bila `!["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER"].includes(auth.role)`.
	- Di `src/app/api/pos/qris/verify/route.ts:21-29`, tambahkan pengecekan `if (!POS_ALLOWED_ROLES.includes(auth.role))` pada `GET` yang mengembalikan HTTP `403` (selaras dengan MR `!28`).
	- Di `src/app/api/events/upload/route.ts:27`, tambahkan pemeriksaan sesi `getRequestAuthUser(req)` (izinkan peran penyelenggara/admin event yang sah, tolak tanpa login dengan `401` dan peran tidak berhak dengan `403`).
	- Di `src/app/api/sync/[domain]/route.ts` dan spesifikasi domain terkait (`src/lib/sync-domains/config-spec.ts` serta `inventory-spec.ts`), wajibkan sesi staf terautentikasi (`401` bila belum login, `403` bila `auth.role === "CUSTOMER"`) untuk `GET` pada domain internal `wifi`, `subscription`, `printer-config`, dan `inventory`. Untuk domain yang memang dibutuhkan halaman publik `/customer` (`platform-settings`, `tables`, `tenants`, `coworking-master`), pastikan fungsi `transform` menyaring field sensitif dan perbaiki klaim pada baris 31 `docs/AUDIT_ENDPOINT_KEAMANAN_S32.md`.
	- Pada `src/app/api/tenant/products/[id]/toggle/route.ts`, tambahkan autentikasi dan otorisasi pemilik tenant/manajemen atau hapus rute stub tersebut jika tidak dipakai di seluruh `src/`.
4. **Tutup injeksi poin langsung oleh `CASHIER` di `src/app/api/loyalty/members/route.ts:488-525`.**
	- Ketika `!isManagerial` (`CASHIER`) mengirim `updates.points !== undefined && updates.points !== target.points`, validasi bahwa `Array.isArray(updates.pointHistory)` memiliki entri baru dibanding `target.pointHistory`, seluruh entri baru memiliki `relatedTransactionId` bertipe string tidak kosong, jumlah poin pada entri baru sama persis dengan `updates.points - target.points`, dan `relatedTransactionId` tersebut benar-benar cocok dengan pesanan di `await getPersistentOrders()` yang berstatus `paymentStatus === "PAID"` (untuk `EARN`, maksimal `Math.floor(order.total / 1000)` poin). Tolak dengan HTTP `403` apabila syarat tersebut tidak terpenuhi.
5. **Lengkapi `docs/AUDIT_ENDPOINT_KEAMANAN_S32.md` dan `tests/s32-member-data-leak-and-endpoint-audit.test.ts`.**
	- Tambahkan tabel matriks endpoint mutasi (`POST`, `PUT`, `PATCH`, `DELETE`) termasuk `/api/notifications/whatsapp`, `/api/events/upload`, `/api/orders/self-order`, dan `/api/auth/register`.
	- Tambahkan skenario unit test untuk `POST /api/notifications/whatsapp` (`401` tanpa login), `GET /api/sync/wifi` (`401` tanpa login), `GET /api/pos/qris/verify` (`403` untuk `CUSTOMER`), dan penolakan injeksi `PUT /api/loyalty/members` `{ points: 99999 }` oleh `CASHIER` (`403`).

### Tahap 3. Implementasikan `clientReferenceId` sejati dan kedaluwarsa in-tx (`S-33`)

1. **Tambahkan `clientReferenceId` pada tipe dan antarmuka pemesanan tiket.**
	- Di `src/types/event.ts`, tambahkan `clientReferenceId?: string;` pada `EventTicketOrder` dan `CreateEventBookingInput`.
	- Di `src/app/events/[id]/page.tsx`, simpan `bookingAttemptRef = useRef<string>("")` yang membangkitkan UUID baru (`crypto.randomUUID()`) saat pengguna membuka form atau mengubah pilihan `selectedTierId`, `ticketCount`, atau `guestEmail`, tetapi mempertahankan UUID yang sama selama tombol submit ditekan berulang atau dicoba ulang karena jaringan lambat. Kirim `clientReferenceId: bookingAttemptRef.current` di body `POST /api/events/[id]/book`, dan kosongkan ref setelah redirect sukses.
2. **Perbaiki logika idempotensi dan anti-duplikat di `src/lib/events.ts:4406-4438`.**
	- Hapus pencocokan heuristik 15 detik tanpa `clientReferenceId` dan hapus klausul longgar `!normalizedPhone ||`.
	- Sebelum pengecekan anti-duplikat 3 menit dan pengecekan sisa kuota, lakukan konvergensi idempoten **hanya jika** `typeof payload.clientReferenceId === "string" && payload.clientReferenceId.trim().length >= 8`: cari di `activeBookings` entri dengan `b.eventId === event.id`, `b.clientReferenceId === payload.clientReferenceId.trim()`, `b.guestEmail.toLowerCase() === normalizedEmail`, `(b.guestPhone || "").trim() === normalizedPhone`, dan `b.paymentStatus === "PENDING" || b.paymentStatus === "PAID"`. Jika cocok, kembalikan `b` secara idempoten.
	- Simpan `clientReferenceId: payload.clientReferenceId?.trim() || undefined` pada objek `newBooking` yang baru dibuat.
	- Biarkan pemanggilan kedua tanpa `clientReferenceId` yang sama langsung masuk ke guard anti-duplikat 3 menit (`baris 4427-4438`) sehingga `tests/community-events-integration.test.ts:155` dan `tests/post-implementation-audit.test.ts:207` kembali lulus, sekaligus menutup celah pencurian `guestToken`.
	- Perbarui skenario klik ganda di `tests/s33-paid-event-ticket-atomic-booking.test.ts` agar mengirim `clientReferenceId` yang sama seperti perilaku tombol UI.
3. **Pindahkan kedaluwarsa booking ke dalam snapshot transaksi di `src/lib/events.ts:4395`.**
	- Hapus pemanggilan `await expirePendingBookings();` di baris `4395` yang menulis di luar `tx`.
	- Buat fungsi murni `expirePendingBookingsSnapshot(bookings: EventTicketOrder[], events: CommunityEvent[], nowMs: number)` yang menandai booking `PENDING` kedaluwarsa menjadi `EXPIRED` dan memulihkan `usedCount` promo langsung di atas array `allBookings` dan `allEvents` hasil `loadBookingsFromTxOrDisk(tx)` serta `loadEventsFromTxOrDisk(tx)`. Perubahan tersebut akan tersimpan secara atomik dalam satu transaksi tunggal melalui `saveBookingsToDisk(allBookings, { tx })` dan `saveEventsToDisk(allEvents, { tx })` di akhir blok transaksi.
4. **Batasi hook judul event DOKU di `src/app/api/events/[id]/book/route.ts:48`.**
	- Ubah pengecekan `eventRecord?.title.includes("Next.js 14 Production Workshop")` agar hanya aktif ketika `process.env.NODE_ENV === "test"`.

### Tahap 4. Perbaiki ketepatan target dan keamanan skrip pembersihan (`S-34`)

1. **Perbaiki `scripts/reconcile-and-cleanup-s34.ts`.**
	- Di `transformEvents` (`baris 167-175`), pindahkan penolakan `proposedRevenueSplit.status === "PENDING"` ke dalam cabang `if (isTargetTest)` (atau daftar eksplisit ID usulan uji coba) agar usulan bagi hasil milik event nyata seperti `evt-1793857072198-wxia1` tidak ikut ditolak.
	- Tambahkan `evt-1793810790340-73pia` (`"sdfghjkl;;;;"`) ke `S34_TARGETS.testEventIds`, dan verifikasi ulang apakah `evt-1794204831538-jjg02` benar event uji. Tandai pula `updated.isTestData = true` pada setiap event uji yang diarsipkan.
	- Ubah tanda tangan `transformBookings(bookings, archivedTestEventIds, now)` agar selain membatalkan `S34_TARGETS.testTicketCodes`, juga membatalkan seluruh booking belum batal (`paymentStatus !== "CANCELLED"`) yang `b.eventId`-nya berada di `archivedTestEventIds` (termasuk `DAGO-EVT-96354` dan tiket pada `evt-pilates-gift-voucher`).
	- Tambahkan mode default `--dry-run` yang hanya mencetak rincian ID dan jumlah perubahan tanpa menulis ke DB maupun disk, serta wajibkan argumen `--apply` untuk mengeksekusi penulisan.
	- Pada blok `catch (dbErr)` di `runCleanup` (`baris 282-284`), jangan menelan kegagalan DB saat `DATABASE_URL` terisi: tetapkan `process.exitCode = 1` dan lempar ulang error sebelum menulis ke disk lokal agar kegagalan transaksi Neon tidak pernah dilaporkan sukses.
2. **Bersihkan fixture uji di `data/events.json` dan `data/event_bookings.json` serta perbaiki tipe test `s34`.**
	- Jalankan transformasi yang sudah diperbaiki terhadap file JSON lokal agar `[TEST QA 2]`, `Gift Voucher (Tes 1)`, `"sdfghjkl;;;;"`, dan tiket ujinya tidak lagi berstatus `APPROVED` atau `PAID` di repo, lalu lampirkan log hasil eksekusi staging pada deskripsi MR.
	- Di `tests/s34-cleanup-test-data-and-reconciliation.test.ts:90, 108`, tambahkan properti `createdAt: "2026-11-20T08:00:00.000Z"` pada kedua fixture `OrderRecord` dan tambahkan pengujian bahwa `proposedRevenueSplit` pada event non-uji tetap `PENDING` serta tiket pada event uji yang diarsipkan ikut menjadi `CANCELLED`.

### Tahap 5. Samakan kuota co-working tamu QR, admin, kasir, dan server (`S-35`)

1. **Buka pembacaan ketersediaan slot teranonimisasi bagi pengunjung `/customer` tanpa login di `src/app/api/coworking/bookings/route.ts:64-140`.**
	- Saat `!auth.isAuthenticated || !auth.role`, jangan mengembalikan `401` pada `GET /api/coworking/bookings`. Kembalikan daftar booking aktif (`checkInStatus !== "CANCELLED" && checkInStatus !== "COMPLETED" && paymentStatus !== "CANCELLED"`) yang sudah dibersihkan seluruh data pribadinya: hanya sertakan `{ id, spaceId, spaceName, spaceType, bookingType, date, endDate, startTime, endTime, duration, checkInStatus, paymentStatus, guestName: "Terisi", guestPhone: "", guestEmail: "" }` (tanpa `bookingCode`, `price`, `totalAmount`, `company`, `notes`, `paymentRef`, `qrisVerification`). Dengan perubahan ini, pengunjung QR di `SpaceView.tsx` melihat sisa kursi yang identik dengan Kasir POS.
	- Pada alur pemesanan ruang di `/customer` (`SpaceView.tsx` / `CustomerBookingModal.tsx`), pastikan pengguna tanpa sesi diarahkan masuk/registrasi pelanggan terlebih dahulu sebelum memanggil `bookSpace` (atau sediakan endpoint pemesanan tamu tervalidasi seperti `/api/orders/self-order` yang membuat booking berstatus `PENDING`), dan jangan biarkan respons `401` masuk ke antrean ulang tak terbatas di `src/lib/sync-outbox.ts:374` (`401` dan `403` harus dianggap permanent rejection, bukan retriable network failure).
2. **Abaikan `maxCapacity` dari body klien dan tegakkan penolakan slot `"Lewat"` di server (`src/app/api/coworking/bookings/route.ts:200-248`, `src/lib/operating-hours.ts`).**
	- Ubah baris `200-202` menjadi `const maxCapacity = space.type === "HOT_DESK" ? Math.max(1, space.capacity || 8) : 1;` dan abaikan `booking.maxCapacity` dari request klien.
	- Jalankan `validateCoworkingBookingSchedule` baik saat pembuatan baru maupun saat pembaruan booking yang masih aktif (`booking.checkInStatus !== "CANCELLED" && booking.checkInStatus !== "COMPLETED"`).
	- Di `validateCoworkingBookingSchedule` (atau helper bersama WITA), ketika `bookingType === "HOURLY"` dan `date === todayWita` pada pembuatan booking baru, tolak jam mulai yang sudah melewati batas toleransi waktu WITA saat ini dengan HTTP `400` dan pesan jelas `"Slot jam yang dipilih sudah lewat."`. Seragamkan aturan menit batas `"Lewat"` antara `src/features/customer/space-slots.ts`, `src/features/pos/pos-coworking.ts`, dan server.
3. **Lengkapi `src/features/coworking/NewBookingModal.tsx:179-187, 392-404`.**
	- Teruskan `maxCapacity: selectedSpace?.type === "HOT_DESK" ? Math.max(1, selectedSpace.capacity || 8) : 1` ke `checkCoworkingBookingConflict` agar kursi ke-2 sampai ke-8 pada Hot Desk tidak ditolak palsu.
	- Gunakan helper `checkSlotAvailability` pada tombol pilihan jam di `NewBookingModal.tsx:392-404` untuk menampilkan sisa kuota (`5/8 tersisa`) dan menonaktifkan slot lampau dengan label `"Lewat"`.
4. **Perbaiki tipe dan isolasi test di `tests/s35-coworking-quota-and-overbooking.test.ts`.**
	- Di baris `45`, pastikan `guestEmail: overrides.guestEmail ?? ""` bertipe `string` murni agar lulus `tsc`.
	- Gunakan direktori sementara `DATA_DIR_OVERRIDE` di `beforeEach`/`afterEach` agar pemanggilan `saveCoworkingBooking` tidak mengotori `data/coworking_bookings.json`, dan uji 2 pemanggilan paralel menggunakan `await Promise.all([save1, save2])` untuk membuktikan tepat satu berhasil dan satu ditolak `OVERBOOKING_CONFLICT`.
	- Di `src/lib/persistent-storage.ts:305-382`, ganti seluruh anotasi `any` dan `as any` dengan tipe `CoworkingBooking` serta class error bertipe `CoworkingConflictError`.

### Tahap 6. Tuntaskan alur penuh order perusahaan, pajak, pelunasan, dan cetak A4 (`S-36`)

1. **Lengkapi jadwal sewa ruang meeting, validasi form, dan keatomikan booking di `src/types/order.ts`, `src/features/pos/CartOrderSetup.tsx`, dan `src/app/(dashboard)/pos/page.tsx`.**
	- Samakan diskriminan item ruang kerja di `src/types/order.ts` dan `src/features/pos/types.ts` menjadi `export type OrderItemCategoryType = "FNB" | "COWORKING"` beserta `coworkingMeta?: CoworkingOrderItemMeta` (mengikuti kontrak MR `!28`, hapus literal `"COWORKING_SPACE"`).
	- Tambahkan field `meetingBookingDate: string` (default tanggal hari ini WITA lewat `getTodayWitaDateString()`, bukan UTC `toISOString()`), `meetingStartTime: string` (default jam operasional valid berikutnya WITA), dan `meetingDurationHours: number` (default `1`, minimal `1`) ke `CorporateOrderDraft` serta tampilkan pemilih tanggal, slot jam (lengkap dengan pengecekan kuota/`"Lewat"` dari `S-35`), dan durasi di `CartOrderSetup.tsx` saat `meetingRoomId` dipilih.
	- Saat `meetingRoomId` dipilih, setel item keranjang `bundle-meeting-*` dengan `itemType: "COWORKING"`, `tenantId: "DAGO_HUB"`, `quantity: corporateDraft.meetingDurationHours`, `coworkingMeta: { spaceId, spaceName, spaceType, durationHours, startTime, endTime, bookingDate }`, dan kunci tombol tambah/kurang kuantitas langsung di daftar keranjang agar selalu sinkron dengan `meetingDurationHours`.
	- Di `handleRequestPayment` (`pos/page.tsx`), apabila `corporateDraft.enabled` bernilai `true`, validasi wajib `companyName.trim()`, `picName.trim()`, dan `picPhone.trim()` sebelum membuka `PaymentModal` (tampilkan `notify.error` kalimat perintah singkat seperti `"Isi nama perusahaan dan kontak PIC"` bila kosong). Selaraskan tab metode bayar dengan `corporateDraft.billingType` agar pilihan skema tidak berubah diam-diam.
	- Di `pos/page.tsx:785-812`, teruskan `meetingBookingDate`, `meetingStartTime`, dan `meetingDurationHours` ke `cwBookSpace`. Jika `cwBookSpace` melempar error konflik/tutup, tampilkan `notify.error` dan **hentikan (`return`) proses pembuatan pesanan** sebelum `createPosOrder` dipanggil agar pelanggan tidak pernah ditagih untuk ruangan yang gagal dipesan.
2. **Hapus perhitungan pendapatan ganda, pajak PB1 salah sasaran, tiket dapur ruang meeting, dan log audit palsu.**
	- Agar pendapatan sewa ruang meeting hanya dihitung satu kali (melalui baris item `COWORKING` pada `OrderRecord`, konsisten dengan `V-33` di MR `!28`), tandai `CoworkingBooking` yang dibuat dari bundling POS dengan field `linkedOrderId: receiptNo` (atau `billedViaPosOrder: true` pada tipe `CoworkingBooking`). Di `src/features/reports/reports-domain.ts` (`SALES` dan rekonsiliasi) serta `src/app/(dashboard)/reports/page.tsx`, kecualikan booking yang memiliki `linkedOrderId` / `billedViaPosOrder === true` dari penjumlahan `coworkingRevenue` dan `paidCoworkingCount` (karena nilainya sudah masuk melalui `OrderRecord` POS).
	- Bebaskan item ber-`itemType === "COWORKING"` dari perhitungan pajak restoran PB1 10% dan service charge F&B di `pos/page.tsx` (gunakan pajak kategori co-working dari `settings`, default `0%` bebas PB1), saring keluar item `itemType === "COWORKING"` dari `kitchenTicket.items` (`pos/page.tsx:889`, jangan kirim tiket dapur jika seluruh item keranjang adalah `COWORKING`), dan saring keluar dari `deductOrderBOM` (`pos/page.tsx:925`).
	- Di `src/contexts/OrderContext.tsx:973`, ubah teks log aktivitas pembuatan pesanan agar membaca `newOrder.paymentStatus === "PENDING" ? "BELUM DIBAYAR (TAGIHAN)" : "LUNAS"`.
3. **Buka pelunasan `COMPLETED + INVOICE` di server, dukung metode `TRANSFER`, dan sinkronkan siklus hidup booking tertaut.**
	- Di `src/app/api/orders/route.ts:207, 261-274` (`authorizeOrderMutation`), izinkan `isPosRole` (`SUPER_ADMIN`, `OWNER`, `MANAGER`, `CASHIER`) memproses pelunasan (`existing.paymentStatus === "PENDING"` menjadi `next.paymentStatus === "PAID"`) termasuk ketika `existing.status === "COMPLETED"` selama `existing.status !== "CANCELLED"` dan item/total pesanan tidak dimanipulasi. Tambahkan pula skema `corporateInfo` dan `itemType: z.enum(["FNB", "COWORKING"]).optional()` ke `OrderPayloadSchema` (`baris 276-303`).
	- Tambahkan `"TRANSFER"` ke `POSPaymentMethod` (`src/features/pos/types.ts`) dan sediakan tab/opsi **Transfer bank** dengan input nomor referensi transfer pada `PaymentModal.tsx` saat melunasi tagihan (catat sebagai transaksi non-kas di shift kasir).
	- Saat pesanan yang memiliki `corporateInfo?.linkedBookingCode` dilunasi di `src/app/(dashboard)/orders/page.tsx` (`advanceOrderStatus` ke `PAID`), panggil pembaruan status bayar booking co-working terkait menjadi `PAID` (`paidAmount = totalAmount`, `remainingAmount = 0`). Sebaliknya, saat pesanan dibatalkan (`voidOrder`), batalkan juga booking co-working terkait menjadi `CANCELLED` agar slot ruangan kembali tersedia.
4. **Sediakan akses cetak/lihat Invoice Perusahaan dari `/orders` baik sebelum maupun sesudah lunas.**
	- Di `src/features/orders/OrderDetailSheet.tsx` dan `src/features/orders/OrdersTable.tsx` (beserta state di `src/app/(dashboard)/orders/page.tsx`), tampilkan tombol **Lihat invoice** setiap kali `Boolean(order.corporateInfo)` bernilai `true`, terlepas dari `paymentStatus` masih `"PENDING"` atau sudah `"PAID"`.
	- Di `src/features/pos/CorporateInvoicePDFModal.tsx:45`, ubah penentuan status lunas menjadi: periksa `order.paymentStatus === "PAID"` bila input bertipe `OrderRecord` (atau tambahkan `paymentStatus?: "PENDING" | "PAID" | "REFUNDED"` pada `POSReceiptData` dan `buildOrderReceiptData` sehingga `CorporateInvoicePDFModal` selalu membaca `receiptData.paymentStatus === "PAID"`). Format pula tanggal `invoiceDueDate` (`YYYY-MM-DD`) ke format tanggal Bahasa Indonesia yang konsisten dengan `issueDate`.
	- Di `src/app/(dashboard)/reports/page.tsx:281-299`, teruskan penyaringan perusahaan ke daftar `coworkingBookings` pada `handleExportExcelTemplate` agar konsisten dengan layar laporan `SALES`.
5. **Bangun ulang `CorporateInvoicePDFModal.tsx` sesuai `docs/DESIGN_SYSTEM.md` bagian 7 dan rapikan seluruh copy bagian 8.**
	- Ganti `window.print()` dan `<style>@media print` di `src/features/pos/CorporateInvoicePDFModal.tsx` dengan mesin invisible `<iframe>` berdimensi eksplisit `width: 210mm; height: 297mm; position: fixed; left: -9999px; top: 0; visibility: hidden;` lengkap dengan `<base href="${window.location.origin}/" />`, tautan Google Fonts (`DM Sans` dan `DM Mono`), aturan CSS `table-layout: fixed`, `thead { display: table-header-group !important; }`, `tr { break-inside: avoid !important; }`, dan jeda `setTimeout(..., 400)` sebelum `iframe.contentWindow?.print()`, mengikuti pola persis pada `src/features/reports/StructuredReportPDFModal.tsx:61-145`.
	- Ubah `DialogContent` memakai kelas `w-full sm:max-w-5xl max-h-[88vh] h-[88vh] flex flex-col p-0 gap-0 overflow-hidden` dengan `scrollContainerRef` (`flex-1 min-h-0 overflow-y-auto overflow-x-auto`) dan reset `scrollTop = 0` di dalam `requestAnimationFrame` saat `isOpen` aktif. Gunakan `table-fixed w-full` dengan `<colgroup>` berjumlah 100% serta `break-words`.
	- Ubah seluruh label Title Case dan istilah Inggris/terlarang ke sentence case Bahasa Indonesia sesuai `docs/DESIGN_SYSTEM.md` bagian 8:
		- Di `src/features/pos/PaymentModal.tsx:863-866`, ganti `Konfirmasi pembayaran (${activeTab})` dengan label terpetakan (`"Konfirmasi pembayaran tunai"`, `"Konfirmasi pembayaran QRIS"`, `"Konfirmasi pembayaran EDC"`, `"Konfirmasi pembayaran transfer"`, `"Konfirmasi bagi tagihan"`, dan `"Terbitkan invoice perusahaan"`).
		- Di `src/features/pos/CartOrderSetup.tsx`, ubah menjadi `"Order perusahaan"`, `"Nama perusahaan atau instansi"`, `"Jumlah peserta"`, `"Skema penagihan"`, `"Bayar di muka"`, `"Tagihan bertempo (14 hari)"`, `"Sewa ruang pertemuan (opsional)"`, dan `"Tanpa ruang pertemuan (hanya F&B)"`.
		- Di `src/features/pos/payment/PaymentTabInvoice.tsx`, ubah menjadi `"Tagihan bertempo perusahaan"`, `"Status pembayaran"`, `"Belum dibayar (tempo 14 hari)"`, `"Jatuh tempo"`, `"14 hari dari pemesanan"`, dan `"Total tagihan"`.
		- Di `src/features/pos/ReceiptModal.tsx:557`, ubah menjadi `"Lihat invoice perusahaan"`.
		- Di `src/features/pos/CorporateInvoicePDFModal.tsx`, ubah seluruh judul seksi dan header kolom ke sentence case (`"Ditujukan kepada"`, `"Tanggal terbit"`, `"Jatuh tempo"`, `"Status pembayaran"`, `"Harga satuan"`, `"Instruksi pembayaran rekening resmi"`, `"Atas nama"`) serta hapus kata `"Harap"` pada baris `304` menjadi `"Cantumkan nomor invoice ... pada berita transfer untuk mempercepat verifikasi."`.
6. **Tulis ulang `tests/s36-corporate-order-and-invoicing.test.ts` agar valid terhadap tipe penuh dan menguji perilaku nyata.**
	- Hapus field ilegal `subtotal` pada `OrderItemRecord` dan `phone` pada `CoworkingBooking` (`guestPhone`), lengkapi field wajib `OrderRecord`, serta ganti `"COWORKING_SPACE"` menjadi `"COWORKING"`.
	- Hapus asersi tautologis pada objek fixture (baris `160-190`) dan ganti dengan pengujian perilaku nyata: perhitungan pajak bebas PB1 untuk item `COWORKING` + kena PB1 untuk F&B, penolakan duplikasi omzet ruang meeting pada `buildReportData("SALES")` (nilai omzet hanya menghitung ruang satu kali), pelunasan pesanan `COMPLETED + INVOICE` oleh `CASHIER` pada handler `PUT /api/orders` mengembalikan HTTP `200`, serta penyaringan perusahaan di `SALES`, `PRODUCTS`, dan `extractAvailableReportCompanies`.

### Tahap 7. Panduan penyelarasan konflik dengan MR `!28` (`feat/v31-v33-pos-qris-kds-mixed-cart`)

Apabila MR `!28` digabungkan lebih dulu ke `develop` sebelum MR `!29` (atau saat menggabungkan `origin/develop` terbaru ke `shandi-dev`), selesaikan kelima file konflik dan titik temu logika dengan aturan berikut:

1. **`src/features/kitchen/kitchen-board.ts` (Gerbang KDS `V-32` + `S-36`).**
	Pada fungsi `isOrderEligibleForKds`, izinkan pesanan perusahaan bertempo masuk ke layar dapur pada hari pemesanan dengan kondisi:
	```ts
	export function isOrderEligibleForKds(
		order: Pick<OrderRecord, "paymentStatus" | "paymentMethod" | "status" | "corporateInfo">
	): boolean {
		if (order.status === "CANCELLED") return false;
		const isCorporateInvoice =
			order.paymentMethod === "INVOICE" || order.corporateInfo?.billingType === "INVOICE";
		return order.paymentStatus === "PAID" || isCorporateInvoice;
	}
	```
	Pastikan pula pemotongan stok resep (`deductPersistentOrderBOM` di `src/app/api/orders/route.ts`) tetap berjalan saat pesanan `INVOICE` terkonfirmasi masuk dapur (`bomDeducted: true`) dan dikembalikan bila pesanan dibatalkan sebelum dimasak.
2. **`src/app/api/coworking/bookings/route.ts`.**
	Pertahankan seluruh pengamanan `V-31` dari MR `!28` (validasi klaim sesi QRIS, penolakan pelanggan menandai lunas sendiri, pembuat `bookingCode` unik bebas tabrakan QRIS) dan gabungkan di atasnya pembacaan publik teranonimisasi `GET` untuk `/customer`, penolakan slot `"Lewat"`, `maxCapacity` murni dari `space`, serta pemetaan konflik `OVERBOOKING_CONFLICT` (`409`) dari `S-35`.
3. **`src/lib/persistent-storage.ts`.**
	Pertahankan helper `V-31`/`V-32` dari MR `!28` (`claimQrisSessionForOrder`, `updatePersistentOrderIf`, `deductPersistentOrderBOM`, `restorePersistentOrderBOM`) sekaligus pertahankan pengecekan atomik `checkCoworkingBookingConflict` di dalam `mutatePersistentData` pada `saveCoworkingBooking` (dengan tipe `CoworkingBooking` tanpa `any`).
4. **`src/features/orders/OrderDetailSheet.tsx`, `src/features/pos/types.ts`, `src/features/reports/reports-domain.ts`, dan `src/app/(dashboard)/pos/page.tsx`.**
	- Di `OrderDetailSheet.tsx`, gabungkan pengecekan `hasFnbItems` dari MR `!28` dengan tombol **Bayar** untuk `COMPLETED + INVOICE` serta tombol **Lihat invoice** untuk `Boolean(selectedOrder.corporateInfo)`.
	- Di `src/features/pos/types.ts`, gabungkan `OrderItemCategoryType`/`CoworkingOrderItemMeta`/`fnbTax`/`coworkingTax` dari MR `!28` dengan metode bayar `"INVOICE"` dan `"TRANSFER"` serta `corporateInfo` pada `POSReceiptData`.
	- Di `src/features/reports/reports-domain.ts`, gabungkan rincian `formatOrderUnitContext` dan kartu ringkasan `Co-working POS (0% PB1)` dari MR `!28` dengan filter `companyFilter`, `extractAvailableReportCompanies`, dan pengecualian `linkedOrderId`/`billedViaPosOrder` dari `coworkingRevenue`.
	- Di `src/app/(dashboard)/pos/page.tsx`, gunakan kalkulator pajak mixed-cart `calculateMixedCartTaxAndService` serta `createPosOrderWithSync` milik MR `!28` untuk menghitung item ruang meeting korporat (`itemType: "COWORKING"`) sehingga tidak ada dua jalur perhitungan pajak dan struk yang saling bertentangan.

### Tahap 8. Jalankan keenam gerbang verifikasi akhir sebelum push

Setelah seluruh tahap di atas selesai, jalankan keenam perintah berikut secara berurutan pada kondisi pohon kerja bersih:

```bash
git merge-tree --write-tree --messages origin/develop HEAD
npm run lint:ui -- --strict src
npx tsc --noEmit -p .
npx tsc --noEmit -p tests/tsconfig.json
DATABASE_URL="" DIRECT_URL="" npx vitest run
DATABASE_URL="" DIRECT_URL="" npm run build
```

Syarat selesai sebelum meminta review ulang:
- `0` konflik terhadap `origin/develop`.
- `0` temuan pada `npm run lint:ui -- --strict src` dan patuh penuh terhadap `docs/DESIGN_SYSTEM.md` bagian 7 dan 8.
- `0` error pada `npx tsc --noEmit -p .` dan `0` error pada `npx tsc --noEmit -p tests/tsconfig.json`.
- Keempat file test regresi yang sebelumnya pecah (`community-events-integration`, `post-implementation-audit`, `pos-tenant-operating-hours-v03`, dan `v18-receipt-settlement-and-roles`) beserta keenam file test baru `S-32` sampai `S-36` lulus penuh pada `npx vitest run`.
- `npm run build` keluar dengan kode `0`.
