# Review MR !31 Shandi S-38 sampai S-43 dan panduan perbaikan satu putaran

Tujuan audit ini memeriksa pekerjaan Shandi pada Merge Request `!31` untuk task `S-42`, `S-38`, `S-39`, `S-43`, dan `S-41` terhadap spesifikasi di `Task-List-Magang-POS-WebEvent-23Nov-18Des.xlsx`, lalu menyediakan urutan instruksi perbaikan satu putaran bagi Shandi dan AI agent-nya. Pemeriksaan dilakukan pada cabang `origin/shandi-dev` di commit `faf88505ee9090d1f5066beb1849a565b925eafc` (`50` file berubah di atas `origin/develop` `9c13f82`).

**Keputusan audit.** Merge Request `!31` **belum layak digabungkan** ke `develop`. Belum ada satu pun dari lima task (`S-42`, `S-38`, `S-39`, `S-43`, `S-41`) yang lulus penuh sesuai kriteria selesai di Excel. Cabang `origin/shandi-dev` saat ini gagal `npx tsc --noEmit -p tests/tsconfig.json` dengan `8` error pada `2` file test baru, memecahkan `2` file test regresi di luar baseline (`tests/events-portal-domain.test.ts` dan `tests/v20-pos-handover-docs.test.ts`), gagal di `TZ=UTC` pada test `S-39`, menyisakan celah kebocoran data rekening/NPWP/PKS di `GET /api/sync/tenants`, tidak memblokir order mitra `SUSPENDED` di API server, tidak memiliki aktivasi undangan `OWNER` di backend, menyimpan status `Lunas` settlement mingguan hanya di `localStorage`, tidak memfilter order per minggu pada laporan `#10` dan `#11`, mengabaikan pecahan `SPLIT` pada bagi hasil, serta membiarkan caller API melewati pemilihan kursi di event berkursi.

---

## 1. Ringkasan status dan hasil gerbang verifikasi

### 1.1 Hasil gerbang verifikasi terukur pada commit `faf8850`

Seluruh perintah dijalankan pada worktree bersih `faf88505ee9090d1f5066beb1849a565b925eafc` dengan `DATABASE_URL=""` dan `DIRECT_URL=""`:

1. **Status git dan konflik merge.**
	Perintah regenerasi:
	```bash
	git merge-tree --write-tree --messages origin/develop origin/shandi-dev
	```
	Hasil terukur adalah `0` konflik git terhadap `origin/develop` (`9c13f82`).

2. **Pemeriksaan UI lint.**
	Perintah regenerasi:
	```bash
	npm run lint:ui -- --strict src
	```
	Hasil terukur adalah kode keluar `0` (`0` temuan pada `496` file).

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
	Hasil terukur **GAGAL** dengan kode keluar `2` dan `8` error pada `2` file test baru MR `!31`:
	- `tests/s38-partner-management.test.ts` (`7` error di baris `168`, `217`, `226`, `268`, `299`, `335`, `342`): tipe `DomainWriteAuthDecision`, `OrderItemRecord.name` ilegal (seharusnya `productName`), `ServerAuthResult` belum diimpor, dan `DomainReadAuthDecision` diakses tanpa narrowing.
	- `tests/s39-weekly-settlement.test.ts` (`1` error di baris `336`): objek `TenantProfileData` kehilangan properti wajib `receiptHeader`, `receiptFooter`, `lowStockThresholdPercent`, dan `status`.

5. **Rangkaian uji Vitest.**
	Perintah regenerasi:
	```bash
	DATABASE_URL="" DIRECT_URL="" npx vitest run --reporter=basic
	```
	Hasil terukur **GAGAL** dengan kode keluar `1` (`5` dari `195` file gagal, `10` dari `2.218` skenario gagal, `190` file dan `2.208` skenario lulus). Klaim pada deskripsi MR `!31` bahwa hanya `4` baseline warisan `AGENTS.md` yang gagal tidak sesuai kondisi nyata:
	- `2` file gagal merupakan **regresi langsung MR `!31`**:
		- `tests/events-portal-domain.test.ts:321` (`GET /api/events/bookings?includeStats=true` tanpa `eventId` untuk `CHECKIN_STAFF` mengembalikan `400`, seharusnya `200` dengan `stats: null`).
		- `tests/v20-pos-handover-docs.test.ts:181` (`docs/DOKUMENTASI_SERAH_TERIMA_S41.md` memiliki 2 link markdown rusak: `docs/DEPLOY_COOLIFY.md` dan `docs/SOP_RILIS_DAN_STAGING.md`).
	- `3` file gagal termasuk dalam baseline `AGENTS.md`: `tests/etl-data-validation.test.ts`, `tests/final-demo-readiness.test.ts`, dan `tests/storage-sync-safety.test.ts`.
	- Uji tambahan zona waktu UTC (`TZ=UTC DATABASE_URL="" DIRECT_URL="" npx vitest run tests/s39-weekly-settlement.test.ts`) **GAGAL** pada `1` dari `11` skenario (`expected 'Rabu, 09 Des 2026' to contain 'Selasa'`).

6. **Build produksi Next.js.**
	Perintah regenerasi:
	```bash
	DATABASE_URL="" DIRECT_URL="" npm run build
	```
	Hasil terukur adalah kode keluar `0` (`36/36` rute statis dan dinamis berhasil dibangun).

### 1.2 Tabel status per task terhadap kriteria Excel

| Kode | Prioritas | Task di Excel | Kriteria selesai di Excel | Status di MR `!31` | Ringkasan gap utama |
| :--- | :---: | :--- | :--- | :---: | :--- |
| `S-42` | P1 | Status kehadiran tiket (`Hadir` / `Belum hadir`) | Scan 1 tiket catat jam dan petugas, scan ulang ditolak, belum lunas ditolak, jumlah hadir sama dengan scan, export sama | Perlu perbaikan | `GET /api/events/bookings` mengembalikan `400` untuk `CHECKIN_STAFF` sehingga `/events/checkin` kosong dan test `S-06` gagal. `PATCH /api/events/bookings/[id]` bocor PII + `guestToken` tanpa login saat body `{}`. QR `CustomerTicketPassModal.tsx` menyematkan `guestToken` sehingga tidak bisa di-scan. `updateBookingCheckIn` rawan `503`/`LOST_UPDATE_PREVENTED` di cold instance. `events-admin/page.tsx` tidak memakai `json.data`. |
| `S-38` | P1 | Kelola Mitra lengkap dan tersimpan di server | Data mitra sama di dua perangkat, mitra ditangguhkan tidak bisa bertransaksi, mitra internal tidak masuk settlement | Perlu perbaikan | Tanggal seed `2024-11-20` memicu suspensi otomatis terus-menerus, `POST /api/orders` dan `self-order` belum memblokir mitra `SUSPENDED`, link undangan Owner palsu tanpa backend, `GET /api/sync/tenants` membocorkan data bank/kontrak/PKS, test `s38` gagal `tsc`. |
| `S-39` | P1 | Skema bagi hasil per metode bayar dan settlement mingguan | Tunai 15%, QRIS 85%, basis net, MDR QRIS, status lunas persisten, `#10` dan `#11` cocok dengan export | Perlu perbaikan | Status `Lunas` hanya di `localStorage`, `getWeeklySettlementPeriod` gagal di `TZ=UTC`, order tidak difilter per minggu, `SPLIT` tidak memecah `splitDetails`, refund lintas minggu tidak terpotong, `#11` tanpa outlet/tren dan tidak cocok dengan `#10`, test `s39` gagal `tsc`. |
| `S-43` | P1 | Pilih kursi saat pesan tiket (MVP) | Toggle per event, denah per tier, 1 kursi = 1 tiket terkunci DB, tampil di e-tiket dan check-in, batal/refund buka kursi | Perlu perbaikan | `validateEventTicketTiers` menghapus `rowPrefix`, `totalRows`, dan `seatsPerRow` saat disimpan. `events-admin/page.tsx` lupa mengisi `hasSeatingChart` saat edit. `events.ts:2073` menimpa DB dengan disk lokal basi. `createInvitationTicket` mengabaikan kursi, `GET /api/events/[id]` tidak membersihkan kursi kedaluwarsa, layar `/events/checkin` belum menampilkan nomor kursi. |
| `S-41` | P1 | Regression test dan dokumentasi serah terima | Semua test case P0/P1 lulus, dokumen serah terima diserahkan ke Izzy | Perlu perbaikan | 2 link rusak di `docs/DOKUMENTASI_SERAH_TERIMA_S41.md` memecahkan `tests/v20-pos-handover-docs.test.ts`, 10 akun uji fiktif bertentangan dengan `AKUN_SISTEM.md`, 4 rute dan simbol `OFFICIAL_CS_WHATSAPP` tidak ada, klaim `0` error `tsc` dan `4` gagal baseline tidak sesuai fakta terukur. |

---

## 2. Audit detail temuan per task

### 2.1 Task S-42 (Status kehadiran tiket: `Hadir` / `Belum hadir`)

1. **[P0] Regresi `GET /api/events/bookings` memutus `/events/checkin` dan memecahkan test `S-06` (`src/app/api/events/bookings/route.ts:70-75`, `src/app/events/checkin/page.tsx:69-77`).**
	Commit `faf8850` mewajibkan `eventId` dan mengembalikan HTTP `400` bagi `CHECKIN_STAFF` saat `eventId` kosong. Padahal halaman `/events/checkin` (`checkin/page.tsx:69-77`) memanggil `/api/events/bookings` tanpa `eventId`, sehingga petugas menerima `0` tiket dan pemindai gagal total. Perubahan ini juga memecahkan `tests/events-portal-domain.test.ts:321` yang mensyaratkan respons HTTP `200` dengan `stats: null` saat `eventId` tidak disertakan.
2. **[P0] Celah IDOR PII dan kebocoran `guestToken` tanpa login di `PATCH /api/events/bookings/[id]` (`src/app/api/events/bookings/[id]/route.ts:27-207`).**
	`getBookingById(id)` dipanggil pada baris `27` sebelum pengecekan sesi. Bila pemanggil anonim mengirim `PATCH /api/events/bookings/<id_atau_ticketCode>` dengan body `{}`, seluruh percabangan mutasi bernilai salah dan baris `203` mengembalikan HTTP `200` berisi `guestEmail`, `guestPhone`, `guestName`, dan `guestToken` mentah. Selain itu, respons `PATCH` yang sah (`66-70, 93-99, 203-207`) tidak menyaring `guestToken` maupun menyamarkan kontak untuk `CHECKIN_STAFF` dan penyelenggara.
3. **[P0] QR code di `/customer` menyematkan `guestToken` sehingga gagal di-scan (`src/features/customer/CustomerTicketPassModal.tsx:110-115`).**
	Modal pass di `/customer` merender `value={ticket.guestToken || ticket.ticketCode}`. Karena `GET /api/events/bookings/my` mengirim `guestToken` 48 karakter heksadesimal, QR tersebut tidak dikenali oleh `parseTicketScanCode`, `OrganizerQRScannerDialog`, maupun `updateBookingCheckIn`, sehingga seluruh scan dari aplikasi pelanggan ditolak `"Tiket tidak ditemukan"`. Modal ini juga belum menampilkan status kehadiran (`Hadir` / `Belum hadir` / `Hadir X/Y`), waktu check-in, maupun daftar sub-tiket.
4. **[P0] `updateBookingCheckIn` dan `organizerCheckInAttendee` rawan `503` dan gagal retry CAS pada instance cold (`src/lib/events.ts:387-418, 4834-4855, 5213-5236, 5839`, `src/app/api/events/portal/check-in/route.ts:68-85`).**
	Kedua fungsi tidak memanggil `syncStorageFromDb("event_bookings.json")` pada check-in normal dan membaca `loadBookingsFromDisk()` sebelum masuk `runWithDistributedEventLock`. Di dalam lock, `loadBookingsFromTxOrDisk(tx)` tidak menyegarkan `lastSyncedUpdatedAtMap`, sehingga saat ada penulisan dari instance lain, `saveBookingsToDisk` melempar `LOST_UPDATE_PREVENTED` dan seluruh 3 kali retry gagal deterministik tanpa re-sync.
5. **[P1] State `events-admin` tidak memakai `json.data`, label/ekspor tidak seragam, dan pesan scan ulang belum persis (`events-admin/page.tsx:550-556`, `events.ts:5100-5185`, `events-portal-domain.ts:277-281`).**
	- `events-admin/page.tsx:550-556` menimpa state secara manual tanpa `json.data`, membuat `checkedInQty`, `checkedInBy`, dan tombol `"Batal hadir"` tidak sinkron sampai reload.
	- Seluruh pesan tolak scan ulang masih berbunyi `"Tiket sudah digunakan untuk check-in sebelumnya..."` alih-alih `"Tiket sudah dipakai, check-in pukul ..."` (sesuai Excel `S-42`, bersama pembaruan deteksi di `OrganizerQRScannerDialog.tsx:219`); cabang `currentCheckedInQty >= ticketCount` (`events.ts:5100`) mendahului `requestedSeat` sehingga jam sub-tiket `-02` tertutup oleh jam `-01`, dan fallback `P2002` (`5184`) tidak mencantumkan jam.
	- `buildAttendeesExportRows` (`events-portal-domain.ts:277-281`) mengekspor `"Sebagian hadir"` tanpa `X/Y`, dan `OrganizerAttendeesTab.tsx:328` menyembunyikan jam/petugas pada baris berstatus parsial sebelum di-expand.

### 2.2 Task S-38 (Kelola Mitra lengkap dan tersimpan di server)

1. **[P0] Tanggal seed `2024-11-20` memicu auto-suspensi permanen pada seluruh mitra (`src/lib/sync-domains/config-spec.ts:140, 162, 184, 206`, `src/app/(dashboard)/settings/page.tsx:372-387, 874-881`).**
	Keempat mitra bawaan memiliki `lastSettlementDepositDate: "2024-11-20"`. Saat `/settings` dibuka, `refreshAllTenantStatuses` mengevaluasi selisih hari ke tahun 2026 (`> 14` hari) lalu menandai seluruh 4 mitra menjadi `SUSPENDED`. Tombol `"Buka Kunci (Aktifkan)"` (`settings/page.tsx:874-881`) tidak memperbarui `lastSettlementDepositDate` dan langsung memanggil `refreshAllTenantStatuses()` lagi, sehingga mitra langsung kembali tertangguhkan. Selain itu, `refreshAllTenantStatuses` tetap terpanggil oleh akun `TENANT` `OWNER` dan mengirim permintaan `SET_TENANT_STATUS` yang ditolak `403`.
2. **[P0] API order server tidak memblokir transaksi mitra `SUSPENDED` atau `INACTIVE` (`src/app/api/orders/route.ts`, `src/lib/order-write-policy.ts`, `src/app/api/orders/self-order/route.ts`, `src/app/(dashboard)/pos/page.tsx:190-191, 1871-1896`).**
	- Kedua endpoint server (`POST /api/orders` dan `POST /api/orders/self-order`) tidak membaca `tenantsDomainSpec` untuk memverifikasi status mitra. Mitra yang ditangguhkan tetap dapat membuat pesanan dan self-order langsung ke server.
	- Di sisi klien `pos/page.tsx:190-191`, `lockedTenantId` hanya diisi saat `user?.scopeLevel === "TENANT"`, sedangkan akun `CASHIER_SGR` memiliki `scopeLevel: "OUTLET"` dengan `tenantId: "tenant-ks"`, sehingga kasir outlet tidak terkunci. `canPay` (`1871-1896`) juga tidak memeriksa isi `cartItems` jika terdapat item dari mitra `SUSPENDED` atau `INACTIVE`, dan `orders/page.tsx` belum memblokir pelunasan tagihan mitra `SUSPENDED`.
3. **[P0] Aktivasi undangan `OWNER` dan pembuatan outlet belum terhubung ke backend (`src/app/(dashboard)/settings/page.tsx:893-907`, `src/app/(auth)/login/page.tsx:170-174`, `src/contexts/OutletContext.tsx`).**
	`handleGenerateTenantActivationLink` hanya membentuk URL `/login?invite=inv_...` di memori browser. Halaman `/login` maupun API `/api/auth/login` dan `/api/auth/register` tidak memproses token undangan tersebut, dan tidak ada endpoint penerbitan atau aktivasi token undangan mitra seperti pada organizer event. Daftar outlet juga masih hardcoded di `DEMO_OUTLETS`.
4. **[P0] `GET /api/sync/tenants` masih membocorkan data bank, kontrak, PKS, dan alasan suspensi (`src/lib/sync-domains/config-spec.ts:1343-1378`).**
	Untuk pemanggil tanpa login, `CUSTOMER`, atau `CASHIER`, `tenantsDomainSpec.authorizeRead` hanya menyembunyikan `npwp`, `contactPerson`, `contactEmail`, `contactPhone`, dan `revenueSplits`, tetapi masih mengembalikan `bankAccountHolder`, `bankName`, 4 digit terakhir `bankAccountNumber`, `contractStartDate`, `contractEndDate`, `contractPksFile`, `lastSettlementDepositDate`, dan `suspendedReason`.
5. **[P1] Celah kelengkapan form, timezone auto-suspensi, dan tipe `INTERNAL` (`PartnerModals.tsx`, `PartnersAdminTab.tsx`, `TenantProfileTab.tsx`, `tenant.ts`, `dashboard-metrics.ts`).**
	- `PartnerModals.tsx:173-330` dan `settings/page.tsx:849-853` meng-hardcode tanggal kontrak `+365` hari dan menulis nama file palsu `pks-*.pdf` tanpa upload file sebenarnya; `PartnerModals.tsx:574` menampilkan `contractPksFile` sebagai teks biasa tanpa tautan unduh.
	- `PartnersAdminTab.tsx:445-480` tidak menyediakan tombol/modal Edit untuk mitra F&B (hanya untuk `EVENT`).
	- `checkTenantAutoSuspension` (`src/lib/tenant.ts:289-311`) memakai `new Date(lastSettlementDepositDate)` (tengah malam UTC = `08.00` WITA) sehingga meleset 8 jam pada batas 14 hari, dan tidak mengecualikan `partnerType === "INTERNAL"`.
	- `computeDashboardFnbRevenue` di `src/features/dashboard/dashboard-metrics.ts:289-312` memanggil `calculateSettlement` tanpa `{ includeInternal: true }`, membuat omzet dashboard owner mitra `INTERNAL` bernilai `0`.
	- `tests/s38-partner-management.test.ts` gagal kompilasi `tsc` dengan `7` error.

### 2.3 Task S-39 (Skema bagi hasil per metode bayar, MDR QRIS, Laporan `#10` & `#11`)

1. **[P0] Status `Lunas` / `Belum lunas` mingguan tidak tersimpan di server (`src/features/reports/settlement-weekly-domain.ts:37, 203-263`, `src/app/(dashboard)/reports/page.tsx:282-299, 451-457`).**
	`setSettlementPaymentStatus` hanya menulis ke `memorySettlementStatusStore` dan `localStorage` (`dagoeng_weekly_settlement_status_v1`). Tidak ada endpoint server, tidak ada `PersistStorage` ke Neon, tidak ada audit log, tidak ada `ConfirmDialog`, dan peran `MANAGER` dapat mengubah status lunas karena `onToggleSettlementStatus` hanya mengecek `!isTenantScope`.
2. **[P0] `getWeeklySettlementPeriod` bergantung timezone OS lokal dan order tidak difilter per minggu (`src/features/reports/settlement-weekly-domain.ts:152-201, 323-329`, `src/app/(dashboard)/reports/page.tsx:100-109, 260-280`).**
	- `getWeeklySettlementPeriod` memakai `getDay()`, `setDate()`, dan `setHours()` lokal OS lalu memformat di `Asia/Makassar`, sehingga gagal di `TZ=UTC` (`Rabu, 09 Des 2026`) dan `monday.toISOString().slice(0, 10)` di WITA menggeser `periodKey` mundur 1 hari ke hari Minggu (`2026-11-29_2026-12-06`).
	- `calculateWeeklyTenantSettlement` tidak memfilter `order.createdAt` terhadap `[weekStartDate, weekCutoffDate]`. Saat `/reports` dibuka pada filter bawaan `THIS_MONTH` (`1–25 Nov`), judul laporan `#10`/`#11` menulis 1 minggu (`26 Okt - 01 Nov`) sementara nominalnya menjumlahkan seluruh transaksi 25 hari.
3. **[P0] Pembayaran `SPLIT` mengabaikan `splitDetails` (`src/features/reports/settlement-weekly-domain.ts:373-384`, `src/lib/settlement.ts:589`).**
	Seluruh nilai order `paymentMethod === "SPLIT"` masuk ke `otherNetSales` meskipun berisi pecahan `CASH` dan `QRIS`. Akibatnya bagian `CASH` 15% tidak masuk kewajiban setor mitra dan `QRIS` tidak terkena MDR 0,7%.
4. **[P1] Refund lintas minggu, konsistensi `#10` vs `#11`, akses `MANAGER`, dan ekspor PDF/Excel.**
	- `calculateWeeklyTenantSettlement` melewatkan seluruh order `REFUNDED`, sehingga refund pada Minggu ke-2 untuk order yang terbayar di Minggu ke-1 tidak mengurangi penjualan bersih Minggu ke-2 (dan tidak memperhitungkan `refundMethod: "CASH"` pada refund QRIS `V-34`).
	- Laporan `#11` (`reports-domain.ts:1181-1270`) belum memecah omzet per outlet (`WeeklyTenantSettlement.outletName` selalu kosong), belum menampilkan tren perbandingan minggu sebelumnya, menampilkan angka pasca-MDR sementara `#10` menampilkan kartu/kolom pra-MDR, tidak menampilkan kolom `otherNetSales` (`EDC`/`TRANSFER`), dan menyembunyikan mitra `INTERNAL` dari `#11`.
	- `tenantsDomainSpec.authorizeRead` (`config-spec.ts:1371-1375`) mengosongkan `revenueSplits` untuk `MANAGER`, sehingga `MANAGER` yang membuka `/reports` selalu menghitung bagi hasil dengan default `85/15` meski Owner mengubahnya ke `70/30`.
	- `StructuredReportPDFModal.tsx:103, 143-151` memakai `table-layout: fixed` tanpa `<colgroup>` pada tabel 12–15 kolom sehingga kolom angka bertumpuk, `report-pdf-domain.ts:39-45` tidak mengenali `+Rp`/`-Rp` sebagai kolom angka, dan `exportableReportData` (`reports/page.tsx:301-312`) mempertahankan `summaryCards` yang belum difilter saat `searchQuery` aktif.
	- `reports-domain.ts` mencapai `1.553` baris dan `tests/s39-weekly-settlement.test.ts:336` gagal `tsc`.

### 2.4 Task S-43 (Pilih kursi saat pesan tiket MVP) dan S-41 (Serah terima)

1. **[P0] `validateEventTicketTiers` membuang konfigurasi denah kursi tier saat disimpan (`src/lib/event-validation.ts:467-476`, `src/lib/events.ts:2458-2463, 2758-2806, 6031-6077`).**
	`validateEventTicketTiers()` membangun ulang objek tier hanya dengan 8 field dasar dan menghapus `rowPrefix`, `totalRows`, serta `seatsPerRow`. Karena `createEventSubmission`, `updateEventDetails`, dan `organizerResubmitEvent` menimpa `ticketTiers` dengan hasil fungsi tersebut, konfigurasi kursi kustom seperti VIP `A1-A10` dan Reguler `B1-B20` selalu hilang saat disimpan dan jatuh kembali ke `K1..K{quota}`.
2. **[P0] Form edit Admin menghapus status kursi dan sinkronisasi disk menimpa DB lebih baru (`src/app/(dashboard)/events-admin/page.tsx:573-590`, `src/lib/events.ts:2068-2077`).**
	- `handleOpenEdit` (`events-admin/page.tsx:573-590`) tidak mengisi `hasSeatingChart` maupun `seatingConfig`, sehingga mengedit event berkursi selalu menampilkan checkbox tidak tercentang dan menyembunyikan input kursi tier.
	- Di `loadConsistentEventSnapshotsFromDb` (`events.ts:2073`), kondisi `local.hasSeatingChart !== undefined` menimpa record DB dengan file disk lokal walaupun `local.updatedAt < dbEvt.updatedAt`.
3. **[P1] Celah undangan tanpa kursi, batas `rowPrefix`, kursi kedaluwarsa, dan tampilan kursi di check-in (`events.ts`, `event-seating.ts`, `events/[id]/page.tsx`, `events-checkin/*`).**
	- `createInvitationTicket` (`events.ts:3716-3840`) dan `IssueInvitationDialog.tsx` belum mendukung maupun mengunci `selectedSeats` pada event berkursi, berisiko oversell antara tiket undangan dan pembeli kursi.
	- `generateTierSeats` (`event-seating.ts:29-65`) hanya membaca karakter pertama `rowPrefix` (padahal `TicketTiersEditor` mengizinkan 4 huruf seperti `VIP`), default `quota: 50` dengan `1x10` menyisakan 40 tiket tak punya kursi, dan `validateEventTicketTiers` belum menolak tabrakan kode kursi antar-tier.
	- `validateSeatSelection` (`event-seating.ts:110-112`) memanggil `s.trim()` tanpa cek `typeof s === "string"`, dan `getPublicEventById` (`events.ts:2115-2153`) tidak menyaring booking `PENDING` yang sudah kedaluwarsa sehingga kursi batal tetap tampil abu-abu.
	- Layar `/events/checkin` (`CheckInAttendeesTable.tsx`, `CheckInAttendeeCard.tsx`, `EventCheckInQRDialog.tsx`, `EventGroupCheckInDialog.tsx`), unduhan PNG (`ticket-download.ts`), dan email tiket (`email.ts`) belum menampilkan `selectedSeats`. Pada `events/[id]/page.tsx:222-226`, error bentrok kursi juga belum memanggil `fetchEventDetail` ulang untuk menyegarkan kursi terisi.
	- `tests/s43-seat-selection.test.ts` (`301-444`) hanya mensimulasikan fungsi lokal `attemptBooking()` tanpa memanggil `createEventBooking`, `createEventSubmission`, atau `updateEventDetails`.
4. **[P0/P1] `docs/DOKUMENTASI_SERAH_TERIMA_S41.md` memecahkan `tests/v20-pos-handover-docs.test.ts` dan memuat data fiktif (`S-41`).**
	- Baris `189` (`196, 198`) menulis link relatif `(docs/DEPLOY_COOLIFY.md)` dan `(docs/SOP_RILIS_DAN_STAGING.md)` dari dalam `docs/`, sehingga gagal pada `tests/v20-pos-handover-docs.test.ts:181`.
	- Bagian 5 (`125-139`) mencantumkan 10 akun dan password fiktif (`superadmin@dagoeng.com`, `kasir.singaraja@dagoeng.com`, dll.) yang bertentangan dengan `docs/AKUN_SISTEM.md`.
	- Dokumen dan deskripsi MR `!31` mencantumkan rute yang tidak ada (`/events/[id]/book`, `/events/pay/[bookingId]`, `/pos/tables`, `/settings/tenants`), nama konstanta salah (`OFFICIAL_CS_WHATSAPP` seharusnya `OFFICIAL_CS_WHATSAPP_NUMBER`), nama file test salah (`s43-event-seat-selection`, `s38-tenant-management-and-addons`), serta klaim `0` error `tsc` dan `4` gagal baseline yang bertentangan dengan hasil nyata.

### 2.5 Temuan lintas task (`DESIGN_SYSTEM.md` dan TypeScript)

- `PartnerModals.tsx:174, 334, 419-425, 517` dan `TenantProfileTab.tsx:178-183` memakai `<textarea>` mentah (bukan `<Textarea>`), override `Alert variant="destructive"` untuk warna warning, dan dialog tanpa pola `p-0 gap-0` + kontainer gulir dalam.
- `PartnersAdminTab.tsx:749-755` memakai `<Link>` yang di-style seperti tombol alih-alih `<Button render={<Link ... />} nativeButton={false}>`.
- `EventBookingDialog.tsx:403-436` dan `TicketTiersEditor.tsx:289-335` memakai warna statis `bg-slate-*` / `bg-emerald-*` dan `<label>` mentah alih-alih token semantik (`bg-primary`, `bg-muted`, `bg-success`) dan `<Label>`.
- Sejumlah copy masih memakai Title Case, kata `"berhasil"`, ALL CAPS (`DITANGGUHKAN`, `TOTAL`), atau istilah Inggris (`Tagline`, `Template`, `Settings`, `Badge`, `Export CSV`) di `PartnerModals.tsx`, `PartnersAdminTab.tsx`, `TenantProfileTab.tsx`, `pos/page.tsx:1944-1957`, `ReportsPreviewTable.tsx`, `reports-domain.ts`, dan `EventAttendeesModal.tsx`.

---

## 3. Panduan perbaikan satu putaran untuk AI agent Shandi

Aturan wajib sebelum mulai memperbaiki:
- Jangan mengubah file di `src/components/ui/*` (kecuali `ui/button.tsx` jika diperlukan) dan jangan mengimpor dari `src/components/legacy/*`.
- Jangan melemahkan asersi pada test regresi lama (`events-portal-domain.test.ts`, `v20-pos-handover-docs.test.ts`).
- Jangan melemahkan tipe domain produksi demi membungkam error `tests/`. Perbaiki fixture di file test.
- Jalankan seluruh perintah test dan build lokal dengan `DATABASE_URL="" DIRECT_URL=""`.

Kerjakan tujuh tahap berikut secara berurutan.

### Tahap 1. Pulihkan regresi `S-06`, tutup kebocoran IDOR `S-42`, perbaiki tipe test `S-38`/`S-39`, dan rapikan dokumen `S-41`

1. **`src/app/api/events/bookings/route.ts:70-75` dan `src/app/events/checkin/page.tsx:69-77` (`S-42` / `S-06`).**
	Saat `authRole === "CHECKIN_STAFF"` dan `!eventId`, kembalikan HTTP `200` dengan `{ success: true, data: [], stats: null }` atau perbarui `checkin/page.tsx` agar selalu mengirim `?eventId=` untuk event hari ini (WITA) dan pastikan `tests/events-portal-domain.test.ts:321` lulus.
2. **`src/app/api/events/bookings/[id]/route.ts:27-207` (`S-42` Security P0).**
	Wajibkan minimal satu aksi mutasi yang sah, pindahkan pemeriksaan autentikasi sebelum membuka/mengembalikan data booking pada body `{}`, dan tambahkan sanitizer yang menghapus `guestToken` serta menyamarkan `guestEmail`/`guestPhone` pada seluruh respons `PATCH` non-Hub-Admin.
3. **`docs/DOKUMENTASI_SERAH_TERIMA_S41.md` (`S-41`).**
	Ubah link relatif pada baris `189` menjadi `[DEPLOY_COOLIFY.md](./DEPLOY_COOLIFY.md)` dan `[SOP_RILIS_DAN_STAGING.md](./SOP_RILIS_DAN_STAGING.md)`. Ganti seluruh akun fiktif di Bagian 5 dengan daftar resmi dari `docs/AKUN_SISTEM.md`, perbaiki rute (`/events/[id]`, `/events/tickets/[token]`, `/tables`, `/settings`), simbol `OFFICIAL_CS_WHATSAPP_NUMBER`, serta nama file dan angka hasil test aktual.
4. **`tests/s38-partner-management.test.ts` (`168, 217, 226, 268, 299, 335, 342`) dan `tests/s39-weekly-settlement.test.ts` (`336`).**
	Impor `ServerAuthResult`, gunakan narrowing pada `DomainWriteAuthDecision` dan `DomainReadAuthDecision`, ganti `name` menjadi `productName` pada `OrderItemRecord`, dan lengkapi field wajib `TenantProfileData` pada `saveTenantProfile`.

### Tahap 2. Perbaiki QR `/customer`, sync DB `updateBookingCheckIn`, dan pesan scan ulang (`S-42`)

1. **`src/features/customer/CustomerTicketPassModal.tsx:110-115` (`S-42` P0).**
	Ganti nilai QR `ticket.guestToken || ticket.ticketCode` menjadi payload sub-tiket yang bisa di-scan (`getSubTicketDetails(ticket, idx).subPayload` atau `ticket.ticketCode`), tambahkan dukungan memilih sub-tiket bila `ticketCount > 1`, dan tampilkan badge status kehadiran (`Hadir` / `Belum hadir` / `Hadir X/Y`) beserta jam check-in.
2. **`src/lib/events.ts:4834-4855, 5213-5236, 5839` dan `src/app/api/events/portal/check-in/route.ts:68-85` (`S-42` P0).**
	Panggil `syncStorageFromDb("event_bookings.json")` sebelum `loadBookingsFromDisk()`, dan segarkan `expectedUpdatedAt` dari snapshot `loadBookingsFromTxOrDisk(tx)` (serta re-sync pada loop retry `LOST_UPDATE_PREVENTED`) agar check-in di instance serverless cold tidak gagal `503`.
3. **`src/app/(dashboard)/events-admin/page.tsx:550-556`, `src/lib/events.ts:5100-5185`, `OrganizerQRScannerDialog.tsx:219`, dan `events-portal-domain.ts:277-281`.**
	Gunakan `json.data` untuk menyinkronkan state `events-admin`, periksa `requestedSeat` sebelum `currentCheckedInQty >= ticketCount`, cantumkan jam WITA pada fallback `P2002`, seragamkan pesan tolak scan ulang menjadi `"Tiket sudah dipakai, check-in pukul ..."` (selaras dengan `OrganizerQRScannerDialog.tsx:219` dan unit test), serta tampilkan `Hadir Sebagian (X/Y)` dan jam/petugas di baris serta CSV ekspor.

### Tahap 3. Tutup kebocoran `/api/sync/tenants`, perbaiki suspensi seed, dan kunci transaksi mitra `SUSPENDED` (`S-38`)

1. **`src/lib/sync-domains/config-spec.ts:135-206, 1343-1451` (`tenantsDomainSpec`).**
	- Perbarui `lastSettlementDepositDate` pada 4 mitra seed (atau tambahkan aksi admin `"Catat setoran kas"` yang memperbarui `lastSettlementDepositDate` sekaligus mengaktifkan mitra) agar seed awal tidak langsung mengunci seluruh kasir demo saat `/settings` dibuka.
	- Pada `tenantsDomainSpec.authorizeRead` (`1350-1378`): untuk pemanggil tanpa login, `CUSTOMER`, `CASHIER`, atau `OWNER` tenant lain, hapus field `bankName`, `bankAccountNumber`, `bankAccountHolder`, `npwp`, `contactPerson`, `contactEmail`, `contactPhone`, `contractStartDate`, `contractEndDate`, `contractPksNumber`, `contractPksFile`, `lastSettlementDepositDate`, dan `suspendedReason`. Untuk `MANAGER` (non-`TENANT`) dan peran staf kasir/laporan yang sah, putuskan akses `revenueSplits` secara konsisten dengan `/api/settings/settlement-receipt` (izinkan `MANAGER` membaca `revenueSplits` agar laporan `#10`/`#11` memakai split aktual).
	- Pada `applyTenantsCommand` (`1265-1278`): lindungi pula `bankName`, `bankAccountNumber`, `bankAccountHolder`, dan `npwp` dari perubahan langsung oleh `TENANT` `OWNER` jika kebijakan mewajibkan persetujuan admin.
2. **`src/lib/tenant.ts:289-311` (`checkTenantAutoSuspension`).**
	Gunakan kalkulasi selisih hari kalender `Asia/Makassar` (WITA), kecualikan `partnerType === "INTERNAL"`, dan jangan panggil `refreshAllTenantStatuses` untuk peran `TENANT` `OWNER` di `settings/page.tsx`.
3. **Blokir order mitra `SUSPENDED` / `INACTIVE` di server dan klien (`src/app/api/orders/route.ts`, `src/app/api/orders/self-order/route.ts`, `src/app/(dashboard)/pos/page.tsx`, `src/app/(dashboard)/orders/page.tsx`).**
	- Di `POST/PUT /api/orders` dan `POST /api/orders/self-order`, muat state mitra melalui `readPersistentDomainState(tenantsDomainSpec)` saat pembuatan order atau pelunasan, lalu tolak dengan HTTP `403` apabila ada item F&B yang `tenantId`-nya berstatus `SUSPENDED` atau `INACTIVE`.
	- Di `pos/page.tsx:190-191, 1871-1896`, baca `user?.tenant?.id` tanpa mensyaratkan `scopeLevel === "TENANT"`, periksa seluruh `cartItems` pada `canPay` dan `handleRequestPayment`, serta periksa status `INACTIVE` di `handleAddToCart`. Blokir pula pelunasan tagihan mitra `SUSPENDED` di `orders/page.tsx`.
4. **Sistem undangan `OWNER` dan CRUD outlet (`S-38`).**
	Buat endpoint penerbitan token undangan (`POST /api/tenants/invite`) dan aktivasi akun `OWNER` (`POST /api/tenants/activate`) beserta halaman/alur penerimaan `invite` di `/login` (atau rute aktivasi khusus), serta hubungkan pemilihan/pembuatan outlet ke store persisten alih-alih `DEMO_OUTLETS` statis. Lengkapi pula input tanggal kontrak, upload PKS asli, modal edit mitra F&B di `PartnerModals.tsx` + `PartnersAdminTab.tsx`, dan `{ includeInternal: true }` di `src/features/dashboard/dashboard-metrics.ts:289-312`.

### Tahap 4. Persistenkan settlement mingguan, perbaiki timezone WITA, filter mingguan, `SPLIT`, dan Laporan `#10`/`#11` (`S-39`)

1. **Persistensi server dan RBAC status settlement mingguan (`src/app/api/reports/settlement/route.ts` atau sync domain baru, `src/features/reports/settlement-weekly-domain.ts`, `src/app/(dashboard)/reports/page.tsx`).**
	- Simpan status `PAID`/`PENDING` per `(periodKey, tenantId)` ke `weekly_settlements.json` via `readPersistentData`/`mutatePersistentData` (`persistStorageToDb`), lengkapi dengan RBAC (`SUPER_ADMIN` dan org-scope `OWNER`), audit log, dan `ConfirmDialog` sebelum menandai lunas. Saat deposit `MITRA_TO_DAGO` ditandai `PAID`, perbarui pula `lastSettlementDepositDate` mitra terkait.
2. **Perbaiki timezone `getWeeklySettlementPeriod` dan filter rentang minggu (`src/features/reports/settlement-weekly-domain.ts:152-201, 323-385`, `src/app/(dashboard)/reports/page.tsx:260-280`).**
	- Hitung batas Senin `00:00:00.000+08:00`, Minggu `23:59:59.999+08:00`, dan jatuh tempo Selasa murni dari tanggal kalender WITA (`Asia/Makassar`) menggunakan aritmetika UTC atas `YYYY-MM-DD`, tanpa `d.getDay()`/`setHours()` lokal OS dan tanpa `.toISOString().slice(0, 10)` di zona lokal.
	- Filter order pada `calculateWeeklyTenantSettlement` secara ketat ke rentang minggu `period`, dan kirim `reconciliationOrders` (atau order penuh berlingkup outlet/tenant) dari `reports/page.tsx` dengan pemilih minggu yang jelas saat tab `#10` atau `#11` aktif.
3. **Pecah `SPLIT` dan tangani refund lintas minggu (`settlement-weekly-domain.ts:373-384`, `src/lib/settlement.ts:589`).**
	- Untuk `paymentMethod === "SPLIT"` dengan `splitDetails`, alokasikan omzet dan diskon secara pro-rata (`allocateIntegerProRata`) ke bucket `CASH`, `QRIS`, dan `other` (`EDC`/`TRANSFER`).
	- Untuk refund lintas minggu (`createdAt` di minggu sebelumnya, `refundedAt` di minggu berjalan), kurangkan nominal refund dari penjualan bersih minggu terjadinya refund berdasarkan `refundMethod || paymentMethod`.
4. **Samakan data `#10` dan `#11`, tambahkan rincian outlet + tren + `otherNetSales`, dan rapikan PDF/export.**
	- Kelompokkan baris Laporan `#11` per `(tenantId, outletId)`, tambahkan perbandingan omzet/pendapatan Dago terhadap minggu sebelumnya untuk tren, tampilkan mitra `INTERNAL` di `#11` dengan transfer settlement `0`, samakan angka pasca-MDR antara `#10` dan `#11`, dan tampilkan kolom `Transfer / EDC (Rp)` di `#10`.
	- Ekstrak pembangun dataset `#10` dan `#11` dari `reports-domain.ts` (sekarang `1.553` baris) ke `settlement-weekly-domain.ts`.
	- Perbaiki `StructuredReportPDFModal.tsx` (`<colgroup>` atau mode lanskap untuk tabel >= 10 kolom), dukung `^[+-]?Rp` di `report-pdf-domain.ts:39-45`, hitung ulang `summaryCards` saat `searchQuery` aktif, dan rapikan label copy `DESIGN_SYSTEM.md` §8 (`"TOTAL"`, `"#10:"`, `"(85/15)"`, alignment kolom `Status`).

### Tahap 5. Pertahankan denah kursi tier saat simpan, tutup celah undangan, dan tampilkan kursi di check-in (`S-43`)

1. **`src/lib/event-validation.ts:467-476`, `src/lib/event-seating.ts:29-65, 110-112`, dan `src/app/(dashboard)/events-admin/page.tsx:573-590` (`S-43` P0).**
	- Pertahankan dan validasi `rowPrefix`, `totalRows`, dan `seatsPerRow` di dalam `validateEventTicketTiers` (tolak tabrakan kode kursi antar-tier dan pastikan `totalRows * seatsPerRow >= quota`), selaraskan aturan `rowPrefix` antara `generateTierSeats` dan `TicketTiersEditor`, serta isi `hasSeatingChart` dan `seatingConfig` di `handleOpenEdit`.
	- Hapus bypass `local.hasSeatingChart !== undefined` di `src/lib/events.ts:2073` agar file disk basi tidak menimpa DB yang lebih baru.
2. **`src/lib/events.ts:3716-3840`, `src/app/api/events/[id]/invitations/route.ts`, dan `src/components/events/IssueInvitationDialog.tsx`.**
	Validasi tipe `typeof s === "string"` di `validateSeatSelection`, dukung `selectedSeats` pada `createInvitationTicket` dan UI undangan untuk event berkursi, serta tambahkan pembersihan booking `PENDING` kedaluwarsa saat `getPublicEventById` membaca `getEventOccupiedSeats`.
3. **`src/app/events/[id]/page.tsx:131, 224` dan layar check-in (`CheckInAttendeesTable.tsx`, `CheckInAttendeeCard.tsx`, `EventCheckInQRDialog.tsx`, `EventGroupCheckInDialog.tsx`).**
	Segarkan `fetchEventDetail(event.id)` saat submit booking gagal karena bentrok kursi, reset `bookingAttemptRef` ketika `selectedSeats` berubah, dan tampilkan `selectedSeats` di tabel/kartu/modal check-in serta PNG/email tiket (`ticket-download.ts`, `email.ts`). Lengkapi pula `tests/s43-seat-selection.test.ts` dengan uji integrasi nyata memanggil `createEventBooking` dan `createEventSubmission`.
4. **Token desain `S-43` (`TicketTiersEditor.tsx`, `EventBookingDialog.tsx`, `EventSubmissionForm.tsx`, `EventEditModal.tsx`).**
	Ganti `<label>` dan `<input type="checkbox">` mentah menjadi `<Label>` dan `<Checkbox>`, lalu ganti kelas warna statis `bg-slate-*` / `bg-emerald-*` dengan token semantik `bg-primary`, `bg-muted`, `bg-success/15`, `border-success`.

### Tahap 6. Rapikan temuan `DESIGN_SYSTEM.md` pada komponen `S-38`

- Ganti `<textarea>` mentah menjadi `<Textarea>`, gunakan pola `p-0 gap-0` + kontainer gulir dalam pada dialog di `PartnerModals.tsx`, ubah `<Link>` ber-style manual di `PartnersAdminTab.tsx:749-755` menjadi `<Button render={<Link ... />} nativeButton={false}>`, dan ubah seluruh teks Title Case / Inggris / ALL CAPS menjadi sentence case Bahasa Indonesia sesuai `docs/DESIGN_SYSTEM.md` bagian 8.

### Tahap 7. Jalankan ulang seluruh gerbang verifikasi sebelum push

Jalankan keenam perintah berikut di worktree bersih sebelum meminta review ulang:

```bash
git merge-tree --write-tree --messages origin/develop HEAD
npm run lint:ui -- --strict src
npx tsc --noEmit -p .
npx tsc --noEmit -p tests/tsconfig.json
DATABASE_URL="" DIRECT_URL="" npx vitest run
TZ=UTC DATABASE_URL="" DIRECT_URL="" npx vitest run tests/s39-weekly-settlement.test.ts
DATABASE_URL="" DIRECT_URL="" npm run build
```

Syarat selesai sebelum review ulang:
- `0` konflik terhadap `origin/develop`.
- `0` temuan pada `npm run lint:ui -- --strict src`.
- `0` error pada `npx tsc --noEmit -p .` dan `0` error pada `npx tsc --noEmit -p tests/tsconfig.json`.
- `tests/events-portal-domain.test.ts`, `tests/v20-pos-handover-docs.test.ts`, serta seluruh suite `s38`, `s39`, `s42`, `s43` lulus penuh (`vitest` hanya menyisakan baseline `AGENTS.md`), termasuk di bawah `TZ=UTC`.
- `npm run build` keluar dengan kode `0`.
