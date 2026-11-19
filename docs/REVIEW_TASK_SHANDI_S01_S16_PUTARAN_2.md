# Review putaran 2 task Shandi S-01 sampai S-16 dan panduan perbaikan final

Dokumen ini memuat hasil audit putaran 2 terhadap perbaikan Shandi pada cabang `origin/shandi-dev` di commit `0bd4841f305c92d155b8767be841e6b43af13de8` (14 commit setelah `bec02d1942e0d85d38272d4a379315f3b046ef1d`) terhadap basis `origin/develop` (`e028ed27a5a1b711a1687cbeb3882e152ff0b9a7`) untuk Merge Request `!25`. Penilaian mengacu pada `Task-List-Magang-POS-WebEvent-13Nov-18Des.xlsx` serta temuan putaran 1 di `docs/REVIEW_TASK_SHANDI_S01_S16.md`.

**Keputusan audit.** Merge Request `!25` **belum layak digabungkan ke `develop`**. Dari 16 task yang diaudit, baru `1` task (`S-04`) yang lulus bersih. Sebanyak `15` task lainnya masih menyisakan regresi keamanan, alur pengguna yang putus, cacat logika data, pelemahan konfigurasi pemeriksaan tipe test, serta 6 bukti gambar E2E tiruan yang bukan tangkapan layar browser.

---

## 1. Ringkasan status putaran 2 (S-01 sampai S-16)

### 1.1 Kemajuan nyata dari putaran 1

Shandi telah menutup sejumlah besar temuan dari `docs/REVIEW_TASK_SHANDI_S01_S16.md` pada commit `d07dd6b` sampai `0bd4841`:
- Tiga dari lima celah keamanan P0 berhasil ditutup, yaitu verifikasi kepemilikan dengan `crypto.timingSafeEqual` dan sanitasi respons pada `/api/events/bookings/[id]/refund`, penutupan IDOR lintas penyelenggara pada `/api/events/[id]/promos` dan `/invitations`, serta penghapusan kebocoran `promoCodes` pada `toPublicEvent`.
- Antarmuka pengguna yang sebelumnya hilang pada `S-12`, `S-13`, dan `S-14` sudah dibangun (`TicketTiersEditor.tsx`, `EventPromosDialog.tsx`, `IssueInvitationDialog.tsx`, `EventRefundPolicyEditor.tsx`, `TicketRefundSection.tsx`, `TicketRefundRequestDialog.tsx`, `EventsRefundsTable.tsx`, `RefundActionDialog.tsx`).
- Transport email nyata berbasis `nodemailer`, Resend, dan SendGrid sudah diimplementasikan pada `src/lib/email.ts` lengkap dengan `escapeHtml` dan lampiran QR lokal tanpa `api.qrserver.com`.
- Konflik merge dengan MR `!26` sudah diselesaikan melalui integrasi `origin/develop` (`aba388d`) serta penyelarasan `EventAttendeesModal.tsx`.
- Task `S-04` sudah bersih untuk seluruh target konfigurasi kontak resmi.

### 1.2 Hasil gerbang verifikasi terukur pada commit `0bd4841`

Seluruh perintah dijalankan pada worktree bersih `0bd4841f305c92d155b8767be841e6b43af13de8` dengan `DATABASE_URL=""` dan `DIRECT_URL=""`:
- `npm run lint:ui -- --strict src` keluar dengan kode `0` (`0` temuan pada `486` file, dan `src/components/ui/*` tidak diubah sama sekali terhadap `e028ed2`).
- `npx tsc --noEmit -p .` keluar dengan kode `0` (`0` error).
- `npx tsc --noEmit -p tests/tsconfig.json` keluar dengan kode `0` **hanya karena commit `742cf10` mempersempit `"include"` menjadi 7 file**. Ketika dijalankan dengan cakupan asli `["**/*.ts", "../src/**/*.ts"]`, compiler gagal dengan kode `2` dan `215` error pada `48` file test, termasuk `58` error pada `7` file test milik Shandi.
- `npx vitest run` meluluskan `174` dari `177` file test (`1.912` dari `1.918` skenario uji). Tiga file gagal (`tests/etl-data-validation.test.ts`, `tests/final-demo-readiness.test.ts`, dan `tests/storage-sync-safety.test.ts`) berada dalam batas 4 file baseline yang dicatat di `AGENTS.md`.
- `npm run build` keluar dengan kode `0` dan menghasilkan seluruh `37/37` halaman statis.
- Agen tidak menjalankan pengujian browser langsung pada sesi audit read-only ini, tetapi membaca dan mendekode seluruh file gambar pada `docs/test-cases/screenshots/s07/`.

### 1.3 Status per task (S-01 sampai S-16)

| Kode | Prioritas | Judul task | Status putaran 2 | Ringkasan gap tersisa |
| :--- | :---: | :--- | :---: | :--- |
| `S-01` | P1 | Ganti rekening DEMO dengan rekening resmi | Perlu perbaikan | `buildUpdateEventBankAccount` tidak menolak rekening placeholder atau label kosong; `destinationBankSnapshot` fallback tidak disaring; `BankModal` tidak cocok nama bank bawaan; `data/event_settings.json` lokal masih berisi rekening demo dan nomor default di `src/types/event.ts` menduplikasi rekening Kopi Senja; skenario test `2.4` tidak menanam fixture demo. |
| `S-02` | P1 | Bersihkan event uji dan data uji | Perlu perbaikan | `scripts/cleanup-test-events.ts:114` memblokir penghapusan target eksplisit `DAGO-EVT-88221` dan `DAGO-EVT-14704` jika berstatus `PAID` non-`example.com`, serta lanjut menulis saat `syncStorageFromDb` gagal; tombol hapus admin mengabaikan `bookedCount === 0`, status `REFUNDED`, dan bukti transfer yang ada. |
| `S-03` | P1 | Validasi harga, kuota, dan role pengaju event | Perlu perbaikan | Update `ticketTiers` tanpa `maxCapacity` selalu gagal di backend; `normalizeDateToWitaIso` melempar `RangeError` HTTP `500` untuk tanggal cacat; form pengajuan deadlock saat tier berbayar dipilih sementara `price` bernilai `0`; modal edit admin menghilangkan `isPaid`, `ticketTiers`, dan `refundPolicy`; `OrganizerRevisionDialog` serta `TicketTiersEditor` tidak punya state input mentah dan pesan error inline. |
| `S-04` | P2 | Nomor WhatsApp CS resmi di semua halaman | Lulus | Seluruh target sentralisasi kontak resmi tercapai dan nihil nomor contoh lama. Hanya tersisa catatan ringan non-pemblokir pada lookup telepon tenant di `pos/page.tsx:1874`, tata letak 5 kartu di `HomeLanding.tsx:397`, dan placeholder format input. |
| `S-05` | P1 | Lupa kode booking kirim lewat email | Perlu perbaikan | Commit `99fd23e` membuka kembali pintu belakang `GET /api/events/bookings/my?ticketCode=X&email=Y` yang membocorkan `guestToken` mentah beserta rate limit `x-forwarded-for` yang dapat dipalsukan; `recover/route.ts` masih membuka `channel: "whatsapp"` dengan email opsional dan kebocoran `dispatched: matchingBookings.length > 0`, serta belum mewajibkan `phone` pada `forgot_code` email. |
| `S-06` | P2 | Meja check-in hanya untuk event hari ini | Perlu perbaikan | `OrganizerQRScannerDialog.tsx` memantul kembali ke `selectedEventId` saat pengguna mengganti event di dropdown, dan mengizinkan `eventId` dari QR mengabaikan `activeEventId`; `portal/check-in/route.ts` memakai `getApprovedEvents()` sehingga melewatkan guard reset pada event arsip. |
| `S-07` | P1 | Uji end-to-end event berbayar | Perlu perbaikan | Keenam file `docs/test-cases/screenshots/s07/*.png` bukan screenshot browser melainkan gambar QR code `400x400` berisi nama filenya sendiri, bertentangan dengan `TC-S07-PAID-EVENT-E2E.md:72, 99-125`; pemanggil non-scanner `handleCheckIn` di `checkin/page.tsx` tidak menangkap promise rejection yang dilempar ulang. |
| `S-08` | P2 | Kirim e-tiket lewat email setelah lunas | Perlu perbaikan | Transport Resend memakai key `cid` yang salah (seharusnya `content_id`) sehingga gambar QR inline rusak; SendGrid tidak mengirim field `type` dan tetap mengirim `attachments: []`; `POST /api/webhooks/doku/simulate` tidak punya guard idempotensi `PAID` sehingga mengirim email ganda. |
| `S-09` | P2 | Hak akses data pelanggan untuk Kasir dan tier member | Perlu perbaikan | Commit `99fd23e` membatalkan normalisasi tier di `persistent-storage.ts` sehingga `Ketut Dian` tetap terbaca `Silver`; `POST` dan `PUT /api/loyalty/members` mengembalikan kontak serta NIK utuh tanpa penyamaran dan membobol akses `CUSTOMER`; `PUT` menolak kenaikan tier otomatis kasir POS dengan HTTP `403`; `filterMembers` punya kondisi terbalik. |
| `S-10` | P2 | Booking co-working tanggal WITA dan nota resmi | Perlu perbaikan | `coworking/page.tsx:318` masih mencetak `"WITA WITA"` pada `transactionDate`; `CustomerBookingModal.tsx` belum disentuh; empat layar coworking mengunci pajak `Rp 0` alih-alih membaca `settings.categoryTax?.coworking`; `pos/page.tsx:786` belum memakai `Asia/Makassar`. |
| `S-11` | P2 | Produk dan margin konsisten | Perlu perbaikan | Kartu `Total terjual` menghitung item di luar katalog `products` sehingga bisa menampilkan `"0 menu"` bersama `"<N> pcs"`; `salesMap` di `PRODUCTS` membuang penjualan ID campuran; `handleExportExcelTemplate` tidak memakai `isSettledPaidOrder`. |
| `S-12` | P2 | Jenis tiket bertingkat | Perlu perbaikan | `handleOpenEdit` menghilangkan `ticketTiers`, `isPaid`, dan `refundPolicy` sehingga mengedit event bertingkat berisiko menghapus tier lama; update tier-only gagal; pengajuan tier berbayar deadlock; `TicketTiersEditor` tidak bisa menghapus tier terakhir; `UPCOMING`/`ENDED` masih dilabeli `"Habis terjual"`. |
| `S-13` | P2 | Kode promo per event dan tiket undangan | Perlu perbaikan | `GET /api/events/[id]/promos?code=...` gagal saat pengguna login sebagai Admin atau Penyelenggara; pembatalan pesanan di `updateBookingPaymentStatus` dan rollback DOKU tidak memulihkan `usedCount`; toggle promo `quota: 0` merusak kuota unlimited; dialog undangan tidak menyegarkan daftar peserta. |
| `S-14` | P3 | Kebijakan refund atau pembatalan per event | Perlu perbaikan | `forceApproveDeficit` di API tidak dibatasi untuk `SUPER_ADMIN`; pelemahan kebijakan refund tidak dikunci di server; `feeDeducted` tidak disimpan pada `refundRequest`; `RefundActionDialog` menampilkan tombol setujui/tolak pada refund yang sudah diproses; label UI masih memakai Title Case dan bahasa Inggris. |
| `S-15` | P3 | Dashboard penjualan penyelenggara versi awal | Perlu perbaikan | `tests/tsconfig.json` dipersempit menjadi 7 file untuk menyembunyikan `215` error (`58` error di 7 file test Shandi); `calculateEventSalesSummary` mengabaikan reservasi `PENDING` aktif pada `remainingCapacity` serta `isSoldOut` dan mencampur tiket undangan non-tier ke `soldCount`. |
| `S-16` | P1 | Regression test Web Event dan dokumentasi serah terima | Perlu perbaikan | Cabang `"Pengajuan refund"` di `buildAttendeesExportRows` tidak pernah tercapai karena tertutup cabang `PAID`; `EventAttendeesModal` menghitung tiket `REFUNDED` sebagai peserta aktif; `DOKUMENTASI_SERAH_TERIMA_WEB_EVENT_S16.md` masih melabeli `organizer-activation-hardening.test.ts` sebagai non-Web Event, menyembunyikan penyempitan `tests/tsconfig.json`, menukar pemilik rekening BCA dan Mandiri, dan salah menulis 6 label UI. |

---

## 2. Penghalang kritis penggabungan Merge Request `!25`

Empat kelompok penghalang utama berikut wajib diselesaikan seluruhnya sebelum MR `!25` digabungkan ke `develop`.

### 2.1 Bukti screenshot palsu dan pelemahan `tests/tsconfig.json`

1. **Keenam gambar `S-07` bukan tangkapan layar antarmuka (`docs/test-cases/screenshots/s07/*.png`, `docs/test-cases/TC-S07-PAID-EVENT-E2E.md:72, 99-125`).**
   Keenam file PNG (`s07-01-event-detail-paid.png` sampai `s07-06-checkin-duplicate-guard.png`) berukuran `2.520` hingga `2.581` byte dengan dimensi seragam `400x400` piksel. Pemeriksaan gambar langsung dan dekode CoreImage `CIDetectorTypeQRCode` menunjukkan seluruhnya berisi QR code hitam-putih dengan payload teks nama filenya sendiri, seperti `"TC-S07 s07-01-event-detail-paid.png"`. Bagian 5 `TC-S07-PAID-EVENT-E2E.md` menulis keterangan layar palsu yang bertentangan langsung dengan catatan baris `72` bahwa cek visual browser belum dilakukan.
2. **Pelemahan `tests/tsconfig.json` (`tests/tsconfig.json:9-17`, commit `742cf10`).**
   Daftar `"include"` diubah dari `["**/*.ts", "../src/**/*.ts"]` menjadi hanya 7 file test terpilih. Tindakan ini melanggar aturan `AGENTS.md` ("Jangan menghapus atau melemahkan test") dan menyembunyikan `215` error TypeScript di `48` file test, termasuk `58` error di 7 file test Shandi sendiri (`tests/admin-event-validation-hardening.test.ts` 19 error, `tests/admin-event-delete-and-cleanup.test.ts` 18 error, `tests/manual-payment-and-bank-settings.test.ts` 9 error, `tests/events-checkin-domain.test.ts` 7 error, `tests/checkin-security-and-atomic-resilience.test.ts` 2 error, `tests/events-admin-domain.test.ts` 2 error, dan `tests/reports-products-margin.test.ts` 1 error).

### 2.2 Regresi keamanan dan integritas data

1. **Pintu belakang `guestToken` dibuka kembali di commit `99fd23e` (`src/app/api/events/bookings/my/route.ts:79-123`).**
   Commit `cccc51c` sempat menutup jalur tanpa login ini, lalu commit `99fd23e` memulihkannya beserta asersi HTTP `200` di `tests/ticket-recovery-and-grouping.test.ts:634-660`. Panggilan tanpa sesi `GET /api/events/bookings/my?ticketCode=DAGO-EVT-XXXXX&email=korban@example.com` mengembalikan HTTP `200` dan membocorkan `guestToken` mentah di baris `113`. Pembatas laju di baris `81` memakai header `x-forwarded-for` dan `x-real-ip` yang dapat dipalsukan untuk menebak kode 5 digit.
2. **Kanal otomatis WhatsApp dan bypass verifikasi pada `POST /api/events/bookings/recover` (`src/app/api/events/bookings/recover/route.ts:49, 164-296, 310-325`).**
   Endpoint masih menerima `channel: "whatsapp"` yang pada mode `forgot_code` mengizinkan pengiriman tautan hanya bermodalkan nomor telepon tanpa verifikasi email (baris `258`), membocorkan apakah nomor terdaftar melalui `dispatched: matchingBookings.length > 0` (baris `292`), dan mengabaikan kegagalan pengiriman WhatsApp (baris `206, 285`). Pada mode `forgot_code` email, baris `310-325` juga tidak mewajibkan kecocokan `phone`.
3. **Kebocoran PII, bypass otorisasi, dan regresi tier pada `/api/loyalty/members` (`src/app/api/loyalty/members/route.ts`, `src/lib/persistent-storage.ts:620-625`).**
   - Commit `99fd23e` membatalkan pemanggilan `resolveAuthoritativeMemberTier` di `src/lib/persistent-storage.ts`. Fungsi `reconcileMembersWithServerLoyaltyPoints` hanya menormalisasi tier bila `mutated === true`, sehingga data lama seperti `Ketut Dian` (`55` poin) tetap keluar sebagai `"Silver"` di `GET`.
   - `POST` (`route.ts:279, 353`) dan `PUT` (`route.ts:455`) mengembalikan objek member utuh beserta `phone`, `email`, dan `identityNo` tanpa penyamaran kepada `CASHIER` dan `CUSTOMER`.
   - `GET ?phone=...` (`route.ts:202-205`) menyaring nomor telepon mentah sebelum disamarkan.
   - `POST` hanya mereset poin menjadi `0` untuk peran `CASHIER` (baris `296`), tetapi tetap membiarkan `CUSTOMER`, `WAITER`, `KITCHEN_STAFF`, `INVENTORY_STAFF`, dan `CHECKIN_STAFF` menyetel `initialPoints: 5000`, `allowUpdate: true`, serta `tierHistory` palsu. `PUT` tidak membatasi peran pengubah poin atau menghapus `identityNo` dengan string kosong `""`.
4. **Celah otorisasi defisit refund dan penguncian kebijakan (`src/app/api/events/admin/refunds/route.ts:69`, `src/lib/events.ts:2717-2723, 5771-5777`).**
   Parameter `forceApproveDeficit` di `POST /api/events/admin/refunds` tidak memeriksa `auth.role === "SUPER_ADMIN"`, sehingga `OWNER` maupun `MANAGER` dapat memaksa saldo penyelenggara menjadi defisit. Selain itu, backend tidak menolak pelemahan `refundPolicy` saat event sudah memiliki tiket lunas aktif.

### 2.3 Bug fungsional yang memutus alur pengguna utama

1. **Pengajuan event multi-tier berbayar mengalami deadlock (`EventSubmissionForm.tsx:343-349`, `event-submission.ts:156`, `src/lib/events.ts:2235`).**
   Jika penyelenggara menambahkan tier berbayar pada `TicketTiersEditor`, `onChange` mengubah `isPaid = true` tanpa memperbarui `form.price` (`0`). Saat submit, `validateSubmissionForm` dan `validateEventSubmission` menolak payload karena memanggil `validateEventPrice(true, 0)`.
2. **Modal edit admin menghapus data tier dan kebijakan refund (`src/app/(dashboard)/events-admin/page.tsx:569-583`).**
   `handleOpenEdit` tidak menyertakan `isPaid`, `ticketTiers`, dan `refundPolicy` saat mengisi `editFormData`. Membuka modal edit pada event bertingkat menampilkan daftar tier kosong dan menyembunyikan editor kebijakan refund.
3. **Update `ticketTiers` tanpa `maxCapacity` dan tanggal cacat memicu error server (`src/lib/events.ts:2586-2633, 5621-5691`, `src/lib/event-validation.ts:300-311`).**
   `updateEventDetails` dan `organizerResubmitEvent` memanggil `validateEventCapacity(updates.maxCapacity, false)` saat `updates.ticketTiers !== undefined`, sehingga pembaruan tier tanpa mengirim ulang `maxCapacity` selalu ditolak. Pada `normalizeDateToWitaIso`, pemanggilan `.toISOString()` dilakukan sebelum validasi `isNaN`, melempar `RangeError` HTTP `500` untuk input tanggal cacat.
4. **Sinkronisasi transaksi POS kasir gagal (`src/app/api/loyalty/members/route.ts:395-413` vs `src/contexts/LoyaltyContext.tsx:552-568`).**
   Saat kasir POS mencatat poin yang menaikkan tier member secara otomatis, `LoyaltyContext` mengirim `PUT` berisi `points`, `tier` baru, dan entri `tierHistory` dengan `isManualOverride: false`. Server langsung menolak dengan HTTP `403` karena baris `396` menganggap setiap perubahan `updates.tier !== target.tier` sebagai manual override.
5. **Validasi kode promo gagal bagi Admin dan Penyelenggara (`src/app/api/events/[id]/promos/route.ts:25-57`).**
   `GET /api/events/[id]/promos` hanya mengevaluasi parameter `?code=...` di dalam blok `if (!adminAuth.authorized && !organizerAuth.authorized)`. Saat akun Admin atau Penyelenggara memesan tiket di `EventBookingDialog`, endpoint mengembalikan `{ promoCodes: [...] }` tanpa `promo`, sehingga UI selalu menampilkan `"Kode promo tidak valid."`.
6. **Pemindai QR portal macet di event terpilih dan dapat dibajak QR lain (`src/features/events-portal/OrganizerQRScannerDialog.tsx:59-74, 180`).**
   Variabel `todayEvents` dibuat ulang setiap render tanpa memoization, sehingga memilih event kedua di dropdown memicu `useEffect` yang langsung menimpa `activeEventId` kembali ke `selectedEventId`. Baris `180` mengirim `eventId: eventId || activeEventId`, membiarkan `eventId` di dalam QR mengabaikan event yang dipilih operator.
7. **Lampiran QR email rusak di Resend dan SendGrid, serta duplikasi email DOKU (`src/lib/email.ts:352, 393-398, 465`, `src/app/api/webhooks/doku/simulate/route.ts:163-242`).**
   Payload Resend memakai key `cid` alih-alih `content_id` sesuai spesifikasi REST API Resend. Payload SendGrid tidak mengirim `type` dan tetap menyertakan array `attachments: []` saat kosong. Endpoint simulasi DOKU tidak menjaga status `booking.paymentStatus === "PAID"` sehingga memanggil pengiriman email berulang kali.

---

## 3. Audit detail putaran 2 per task (S-01 sampai S-16)

### S-01. Ganti rekening DEMO dengan rekening resmi (P1, perlu perbaikan)

- **Yang sudah diperbaiki di putaran 2.**
  - `src/types/event.ts:470-539` dan `src/lib/events.ts:5208-5216`. Konstanta default `DEFAULT_EVENT_BANK_ACCOUNTS`, `DEFAULT_EVENT_POLICY.bankHistory`, dan `MANUAL_TRANSFER_BANK_ACCOUNTS` tidak lagi memakai `0000...` maupun `"PT DAGO CREATIVE HUB (DEMO)"`.
  - `src/lib/events.ts:937-953`. `buildCreateEventBankAccount` mengisi label otomatis bila kosong dan menolak rekening placeholder pada tipe `PLATFORM` di luar environment test.
  - `tests/official-bank-guard.test.ts:116-136`. Skenario `2.1` kini menyuntikkan fixture `placeholderPolicy` secara mandiri lewat `saveEventSettingsToDisk`.
  - `src/app/api/events/tickets/[token]/route.ts:67-69, 130-156` dan `src/app/events/tickets/[token]/page.tsx:242-249`. Menyaring `activeBankAccounts` agar hanya berisi rekening `PLATFORM` aktif non-placeholder sesuai event, dan memprioritaskan `destinationBankSnapshot` pada tiket `PAID`.
  - `src/app/(dashboard)/events-admin/page.tsx:238, 672-705`, `src/features/events-admin/EventsSettingsView.tsx:140-153, 185, 239-265, 322-341`, dan `src/features/events-admin/BankModal.tsx:76-88`. Menyaring rekening `ORGANIZER`, menampilkan tombol aktif/nonaktif dengan proteksi rekening utama, membatasi `"Jadikan utama"` hanya untuk rekening aktif, mengganti `"PAYMENT_GATEWAY"` menjadi `"DOKU_CHECKOUT"`, memperbaiki kolom riwayat (`changedAt`, `changedBy`, `details`), dan menambah input bank kustom untuk `"Lainnya"`.
- **Sisa masalah yang wajib diperbaiki.**
  1. `src/lib/events.ts:1122-1181` (`buildUpdateEventBankAccount`). Tidak menolak rekening placeholder pada `PATCH /api/events/admin/settings/banks` dan membiarkan `updates.label` kosong menimpa label menjadi string kosong `""`.
  2. `src/app/api/events/tickets/[token]/route.ts:125-128` dan `src/app/events/tickets/[token]/page.tsx:242-249`. Nilai `destinationBankSnapshot` dan `activeDestinationBank` tidak disaring dari rekening `ORGANIZER` atau placeholder. Jika seluruh rekening `PLATFORM` terfilter habis, halaman tiket `PENDING` tetap jatuh ke `destinationBankSnapshot` yang bisa berisi rekening demo lama atau rekening penyelenggara.
  3. `src/features/events-admin/BankModal.tsx:65-72` dan `src/app/(dashboard)/events-admin/page.tsx:674-700`. Opsi select bank memakai `"BCA"`, `"Mandiri"`, `"BRI"`, tidak cocok dengan nilai default `"BCA (Bank Central Asia)"`, `"Bank Mandiri"`, `"Bank BRI"`, sehingga saat edit modal selalu terbuka di pilihan `"Lainnya"`. Mengirim spasi kosong di input kustom juga jatuh ke literal `"Other"`.
  4. `data/event_settings.json:20-95` masih menyimpan tiga rekening `0000...` atas nama `"PT DAGO CREATIVE HUB (DEMO)"` karena `AGENTS.md` melarang commit ke `data/*`, namun pada server lokal dengan file `data/` yang belum dibersihkan, seluruh pesanan berbayar akan ditolak `PEMBAYARAN_TERKENDALA`. Selain itu, nomor default di `src/types/event.ts:475, 489, 503` memakai nomor buatan atau salinan (`8830192841` sama dengan rekening Kopi Senja di `src/lib/sync-domains/config-spec.ts:127`, sedangkan `1450012345678` dan `012301001234567` berpola `1234567`) sehingga perlu dikonfirmasi nomor rekening resmi perusahaan sebelum rilis produksi.
  5. `tests/official-bank-guard.test.ts:209-224`. Skenario `2.4` berjalan tepat sesudah skenario `2.3` menyimpan rekening resmi tanpa menanam ulang rekening placeholder, sehingga bypass `ALLOW_DEMO_BANK="true"` tidak benar-benar diuji.
  6. `src/features/events-admin/EventsSettingsView.tsx:198-199, 316`. Header tabel masih memakai Title Case (`"Bank & Rekening"`, `"Atas Nama"`, `"Aksi & Bank"`).

### S-02. Bersihkan event uji dan data uji (P1, perlu perbaikan)

- **Yang sudah diperbaiki di putaran 2.**
  - `src/lib/events.ts:1749, 2085-2086`. `getApprovedEvents` dan `getPublicEventById` kini memfilter `!e.isTestData`.
  - `scripts/cleanup-test-events.ts:30-43, 60-61, 73-80, 133-143`. Menambahkan `syncStorageFromDb`, pencocokan judul uji Excel serta `DAGO-EVT-88221` dan `DAGO-EVT-14704`, dan mengubah event uji yang memiliki booking menjadi `ARCHIVED` dan `isTestData: true`.
  - `src/app/(dashboard)/events-admin/page.tsx:427-447`, `EventDetailSheet.tsx:288-302`, `EventsModerationTable.tsx:294-305`, `EventsPaymentsTable.tsx:247`, dan `EventAttendeesModal.tsx:353`. Menambahkan fungsi `handleDeleteBooking` dan tombol hapus pada antarmuka admin.
- **Sisa masalah yang wajib diperbaiki.**
  1. `scripts/cleanup-test-events.ts:77-79, 114`. Baris `114` menolak penghapusan setiap booking `PAID` non-`FREE` yang emailnya bukan `@example.com`, sehingga target eksplisit Excel `DAGO-EVT-88221` dan `DAGO-EVT-14704` gagal dihapus bila berstatus `PAID` non-`example.com`. Baris `77-79` juga hanya memberi peringatan lalu tetap melanjutkan penulisan ke Neon saat `syncStorageFromDb` gagal. Pola `isIdentifiedTestData` (`30-43`) belum menangkap `"tes 1"` / `"(tes 1)"` atau `"tes cek"`.
  2. `src/features/events-admin/EventDetailSheet.tsx:288-302, 360-374` dan `EventsModerationTable.tsx:294-305`. Tombol hapus event ditampilkan tanpa memeriksa `bookedCount === 0` (di `EventDetailSheet.tsx:360` bahkan muncul untuk semua event `APPROVED`), sehingga klik konfirmasi langsung gagal dengan `FORBIDDEN_DELETE`.
  3. `src/features/events-admin/EventAttendeesModal.tsx:353` dan `EventsPaymentsTable.tsx:247`. Penjagaan tombol hapus pesanan tidak selaras dengan backend `deleteEventBooking` (`src/lib/events.ts:5139-5162`). `EventAttendeesModal` memunculkan tombol hapus pada status `REFUNDED`, `refundStatus === "REQUESTED"`, dan bukti transfer tertunda; `EventsPaymentsTable` memunculkan tombol hapus pada status `REFUNDED`, `REQUESTED`, serta `PENDING` dengan bukti ditolak sementara `src/lib/events.ts:5158` masih memblokir semua `PENDING` yang memiliki `paymentProofUrl` tanpa mengecek `!booking.paymentRejectionReason`.
  4. `data/events.json`, `data/event_bookings.json`, dan database Neon produksi masih perlu dibersihkan menggunakan skrip pembersih setelah guard skrip diperbaiki (file `data/*` tidak di-commit di MR ini sesuai `AGENTS.md`).

### S-03. Validasi harga, kuota, dan role pengaju event (P1, perlu perbaikan)

- **Yang sudah diperbaiki di putaran 2.**
  - `src/lib/server-auth.ts:586-603, 641-653`, `src/app/api/events/route.ts:105-119`, `src/app/api/events/portal/route.ts:108`, `src/lib/events.ts:2178-2180`, dan `src/app/events/portal/page.tsx:611-628`. `CHECKIN_STAFF` (baik dari sesi maupun email `payload.organizerEmail`) diblokir di seluruh endpoint dan halaman portal.
  - `src/lib/event-validation.ts:321-578` dan `src/app/api/events/[id]/route.ts:102-103, 139-151`. Menambahkan `validateEventTicketTiers` dan `validateEventRefundPolicy`, memanggilnya di seluruh mutasi event, dan melindungi tier ber-booking aktif saat edit/resubmit.
  - `src/features/events-admin/EventEditModal.tsx:86-141, 231-256, 332`. Menggunakan state string mentah `rawPrice` dan `rawQuota` agar kolom bisa dihapus kosong, menyertakan atribut `min`/`max={1000}`/`step={1}`, dan merender error validasi inline.
- **Sisa masalah yang wajib diperbaiki.**
  1. `src/lib/events.ts:2586-2633, 5621-5691`. `updateEventDetails` dan `organizerResubmitEvent` mengaktifkan `hasCapacityChange` ketika `updates.ticketTiers !== undefined`, lalu memanggil `validateEventCapacity(updates.maxCapacity, false)`. Setiap pembaruan `ticketTiers` yang tidak menyertakan `maxCapacity` langsung ditolak server.
  2. `src/lib/event-validation.ts:300-311` (`normalizeDateToWitaIso`) serta `src/lib/events.ts:2614-2615, 5784-5785`. Memanggil `.toISOString()` pada input tanggal cacat tanpa cek `isNaN(date.getTime())` terlebih dahulu, memicu `RangeError` HTTP `500`. `updateEventDetails` juga tidak memeriksa urutan `startDate <= endDate`.
  3. `src/app/(dashboard)/events-admin/page.tsx:569-583`. `handleOpenEdit` tidak menyalin `isPaid`, `ticketTiers`, dan `refundPolicy` ke `editFormData`.
  4. `src/features/events-portal/EventSubmissionForm.tsx:343-349` dan `event-submission.ts:156` (serta `src/lib/events.ts:2235`). Saat tier berbayar ditambahkan, `isPaid` menjadi `true` sedangkan `price` tetap `0`, menyebabkan `validateEventPrice(true, 0)` menolak pengajuan. `EventSubmissionForm` juga masih memakai `Number(v)` yang tidak mempertahankan input mentah.
  5. `src/features/events-portal/OrganizerRevisionDialog.tsx:210-221` dan `src/app/events/portal/page.tsx:304-359`. Tidak menggunakan state string mentah, tidak memanggil `validateEventCapacity`, dan tidak menampilkan pesan error inline di dialog revisi.
  6. `src/components/events/TicketTiersEditor.tsx:212-250`. Input harga memakai `step={1000}` (seharusnya `step={1}`) dan membulatkan input diam-diam (`Math.max(0, Math.floor(...))`), sedangkan input kuota tidak punya `max={1000}` serta `step={1}` dan memaksa nilai kembali ke `1` saat kolom dikosongkan.
  7. `src/lib/event-validation.ts:526-567` (`validateEventRefundPolicy`). Tidak menolak nilai boolean atau array pada `hMinusDays` dan `refundFeePercent`.

### S-04. Nomor WhatsApp CS resmi di semua halaman (P2, lulus)

- **Yang sudah diperbaiki di putaran 2.**
  - `src/lib/contact-config.ts:1-22`. Menyentralisasi `OFFICIAL_HUB_NAME`, `OFFICIAL_HUB_OUTLET_NAME`, `OFFICIAL_HUB_ADDRESS`, `OFFICIAL_CS_DISPLAY_PHONE`, `OFFICIAL_CS_WHATSAPP_NUMBER`, `normalizeWhatsAppDigits`, dan `buildOfficialCsWhatsAppUrl`.
  - Seluruh referensi alamat dan nomor CS lama pada `HomeLanding.tsx`, `home-content.ts`, `landing-content.ts`, `ticket-recovery-domain.ts`, `recovery/page.tsx`, `tickets/[token]/page.tsx`, `email.ts`, `receipt-publisher.ts`, `ReceiptModal.tsx`, `employees-domain.ts`, `employees/page.tsx`, `CashDrawerShiftModal.tsx`, `pos/page.tsx`, `settings/page.tsx`, `sync-domains/config-spec.ts`, `doku.ts`, `organizers.ts`, dan `unified-account.ts` sudah memakai `contact-config.ts`. Pencarian grep pada `src/` mengonfirmasi nol kemunculan `"Ngurah Rai"`, `(0361)`, `(0362)`, `889900`, `776655`, `812-0000-0000`, `628120000000`, maupun duplikasi string `+62 821-1550-1995` di luar `contact-config.ts`.
- **Catatan non-pemblokir.**
  1. `src/app/(dashboard)/pos/page.tsx:1874`. Membaca `(user?.tenant as { phone?: string } | undefined)?.phone`, padahal properti telepon tenant disimpan di `getTenantProfile(user.tenant.id).contactPhone` sehingga nilainya selalu jatuh ke `OFFICIAL_CS_WHATSAPP_NUMBER`.
  2. `src/features/landing/home/HomeLanding.tsx:397`. Penambahan kartu WhatsApp menghasilkan 5 item di dalam `lg:grid-cols-4` pada seksi Visit.
  3. Data seed mock mitra/demo dan placeholder format input di beberapa form masih memakai angka contoh seperti `"081234567890"`.

### S-05. Lupa kode booking kirim lewat email (P1, perlu perbaikan)

- **Yang sudah diperbaiki di putaran 2.**
  - `src/app/api/events/bookings/my/route.ts:31-77, 126-144`. Menghapus lookup `?email=&phone=`, mengembalikan HTTP `401` untuk pencarian tak terautentikasi tanpa kode, dan mewajibkan sesi terautentikasi atau `guestToken`/`tokens` `>= 16` karakter.
  - `src/features/events-tickets-recovery/TicketRecoveryResultCard.tsx` dihapus beserta ekspornya di `index.ts`.
  - `src/app/events/tickets/recovery/page.tsx:41-407`. Menggunakan email sebagai satu-satunya kanal otomatis, mewajibkan kode+email atau email+telepon, dan menampilkan kartu konfirmasi email.
  - `src/app/api/events/bookings/recover/route.ts:54-57, 122-161, 344-384`. Mengunci `baseUrl` ke variabel environment, mengecek hasil nyata `sendTicketRecoveryEmail`, dan menyamakan respons `dispatched: true` pada jalur `forgot_code` email.
- **Sisa masalah yang wajib diperbaiki.**
  1. **Regresi pada commit `99fd23e` (`src/app/api/events/bookings/my/route.ts:79-123` dan `tests/ticket-recovery-and-grouping.test.ts:634-660`).** Blok `2b` kembali mengizinkan panggilan tanpa sesi `?ticketCode=...&email=...` dan mengembalikan `guestToken` mentah di baris `113`. Pembatas laju `checkRateLimit` membaca header `x-forwarded-for` dan `x-real-ip` (`15-18`) yang bebas dipalsukan klien. Selain `ticket-recovery-and-grouping.test.ts:634-660`, file `tests/flow-hardening-audit-fixes.test.ts:879-914` juga masih menguji ekspektasi `200` + `guestToken`.
  2. `src/app/api/events/bookings/recover/route.ts:49, 164-296`. API masih menerima `channel: "whatsapp"` yang pada mode `forgot_code` mengizinkan `email` kosong (`258`), membocorkan apakah nomor telepon terdaftar lewat `dispatched: matchingBookings.length > 0` (`292`), dan mengabaikan kegagalan `sendWhatsAppMessage` (`206, 285`).
  3. `src/app/api/events/bookings/recover/route.ts:310-325`. Pada mode `forgot_code` email, parameter `phone` masih opsional (`if (!rawPhone) return emailMatches;` di baris `323`).
  4. `src/app/api/events/bookings/recover/route.ts:344-384`. Saat transport email error (`!emailRes.sent`), email terdaftar mengembalikan HTTP `503` sedangkan email tidak terdaftar melewati pengiriman dan mengembalikan HTTP `200`, membentuk oracle eksistensi email.
  5. `src/app/events/tickets/recovery/page.tsx:10, 29, 200, 204` dan `TicketRecoveryConfirmationCard.tsx:46-48, 97, 112`. Terdapat import tak terpakai (`Mail`, `DEFAULT_CS_WHATSAPP_NUMBER`) dan judul Title Case.

### S-06. Meja check-in hanya untuk event hari ini (P2, perlu perbaikan)

- **Yang sudah diperbaiki di putaran 2.**
  - `src/app/api/events/bookings/route.ts:38-68, 75-77`. Penyelenggara kini dapat memuat daftar booking milik seluruh event `APPROVED` miliknya di `/events/checkin` tanpa mengirim `eventId`, sementara `eventId` milik penyelenggara lain ditolak HTTP `403`.
  - `src/lib/events.ts:4722-4788, 5571-5604`, `src/features/events-checkin/events-checkin-domain.ts:358-392`, `src/app/api/events/bookings/[id]/route.ts:143-155`, dan `src/app/api/events/portal/check-in/route.ts:68-83`. Menegakkan status hari ini WITA dengan batas `endDate` maksimal 7 hari pada `updateBookingCheckIn`, `organizerCheckInAttendee`, dan aksi `reset` kehadiran.
  - `src/features/events-portal/OrganizerQRScannerDialog.tsx:59, 237, 245, 315, 336`. Memperbaiki crash `TypeError` dengan membaca `json.data || json.booking`, menyaring `todayEvents`, menonaktifkan pemindai saat kosong, dan menghilangkan `.toUpperCase()` sebelum `parseQRContent`.
  - `OrganizerHomeTab.tsx:302-310`, `CheckInActionToolbar.tsx:37-43`, dan `EventAttendeesModal.tsx:334-339`. Mengunci tombol check-in ke hari ini WITA dan menambahkan `timeZone: "Asia/Makassar"`.
- **Sisa masalah yang wajib diperbaiki.**
  1. `src/features/events-portal/OrganizerQRScannerDialog.tsx:59-74`. `todayEvents` tidak di-memoize, dan `useEffect` di baris `68-74` selalu mengembalikan `activeEventId` ke `selectedEventId` setiap kali nilai `activeEventId` berubah dari dropdown, sehingga operator tidak pernah bisa pindah ke event lain pada hari yang sama.
  2. `src/features/events-portal/OrganizerQRScannerDialog.tsx:180`. Mengirim `eventId: eventId || activeEventId` sehingga QR dari event lain milik penyelenggara yang sama dapat melewati verifikasi event terpilih.
  3. `src/app/api/events/portal/check-in/route.ts:69`. Memakai `getApprovedEvents()` alih-alih `getAdminEvents()`, sehingga event berstatus `ARCHIVED` atau `isTestData` menghasilkan `undefined` dan melewati penjagaan tanggal saat `reset`.
  4. `src/app/api/events/bookings/route.ts:112-115`. Query `?includeStats=true` mengembalikan statistik global seluruh platform kepada penyelenggara.
  5. `src/lib/events.ts:5572` (`organizerCheckInAttendee`). Memakai `new Date()` langsung dan mengabaikan `options?.currentTimestamp`.
  6. `src/features/events-portal/OrganizerQRScannerDialog.tsx:162, 195, 206-257, 375, 459`. Pencarian duplikat memakai `b.ticketCode.toUpperCase()` tanpa membuang akhiran sub-tiket `-01`, `toLocaleTimeString` tidak memakai `Asia/Makassar`, dan dropdown/input masih memakai `<select>` dan `<input>` mentah.

### S-07. Uji end-to-end event berbayar (P1, perlu perbaikan)

- **Yang sudah diperbaiki di putaran 2.**
  - `src/app/events/checkin/page.tsx:234-238` dan `src/features/events-checkin/EventCheckInScannerDialog.tsx:196-227, 250`. `handleCheckIn` kini melempar ulang error sehingga pemindai kamera memutar nada gagal dan menampilkan penolakan merah saat scan duplikat. String scan QR tidak lagi di-uppercase sebelum `parseTicketScanCode`.
  - `src/app/api/events/tickets/[token]/route.ts:106-122` dan `src/app/events/tickets/[token]/page.tsx:83-89, 229-240, 354`. Mengembalikan ke-15 field status kursi, alasan penolakan, tier, promo, undangan, serta refund, dan mengirim `eventId` ke `getSubTicketDetails`.
- **Sisa masalah yang wajib diperbaiki.**
  1. **Keenam screenshot `S-07` palsu (`docs/test-cases/screenshots/s07/s07-01..06.png` dan `docs/test-cases/TC-S07-PAID-EVENT-E2E.md:72, 99-125`).** Keenam file adalah QR code `400x400` berisi nama file masing-masing, bukan tangkapan layar UI aplikasi. Dokumentasi harus jujur dan memakai screenshot browser nyata pada database lokal terisolasi (atau menghapus klaim dan gambar palsu bila cek visual dilakukan oleh operator manusia).
  2. `src/app/events/checkin/page.tsx:269-301, 405, 408, 431, 434, 461`. `handleQuickBarcodeSubmit` (memiliki blok `try...finally` tanpa `catch`) dan callback check-in pada kartu serta tabel melewatkan penanganan error dari `handleCheckIn` yang kini melempar ulang exception.
  3. `src/app/events/tickets/[token]/page.tsx:349`. Saat bukti bayar ditolak dengan `cancelBooking: true` (`CANCELLED`), `TicketPaymentTransferSection` tidak tampil sehingga pembeli tidak melihat `paymentRejectionReason`.
  4. `src/features/events-tickets/ticket-pass-domain.ts:3-77`. Interface `TicketPassData` belum mendeklarasikan `seatCheckInTimes`.
  5. `tests/paid-event-e2e.test.ts`. Belum memiliki pengujian di lapisan route `GET /api/events/tickets/[token]` maupun pengujian regresi error scanner.

### S-08. Kirim e-tiket lewat email setelah lunas (P2, perlu perbaikan)

- **Yang sudah diperbaiki di putaran 2.**
  - `package.json:37-38, 53-54` dan `.env.example:37-45`. Memasang `nodemailer` dan `qrcode` beserta tipe TypeScript serta mendokumentasikan variabel env email.
  - `src/lib/email.ts`. Mengimplementasikan `dispatchTransactionalEmail` (SMTP, Resend, SendGrid), `escapeHtml` pada template e-tiket dan pemulihan, serta buffer QR lokal lewat `QRCode.toBuffer` sebagai CID inline. Seluruh referensi `api.qrserver.com` dihapus.
  - `src/app/api/webhooks/doku/route.ts:99-127` dan `src/lib/events.ts:3692-3701, 4490-4499, 5019, 5092-5101`. Menjaga idempotensi `PAID` di webhook DOKU dan `updateBookingPaymentStatus`, serta menunggu `dispatchPaidTicketEmail` dengan batas 10 detik.
- **Sisa masalah yang wajib diperbaiki.**
  1. `src/lib/email.ts:349-353`. Payload lampiran Resend mengirim properti `cid: a.cid` padahal API `POST https://api.resend.com/emails` mewajibkan `content_id` (snake_case), sehingga gambar `<img src="cid:...">` gagal tampil inline di klien email saat memakai Resend.
  2. `src/lib/email.ts:393-398, 465-483`. Lampiran SendGrid v3 tidak menyertakan field `type` (`a.contentType || "image/png"`), `sendTicketConfirmationEmail` tetap mengirim array `attachments: []` saat tidak ada tiket, dan kegagalan `QRCode.toBuffer` tetap mendorong `Buffer.from([])` kosong ke daftar lampiran.
  3. `src/app/api/webhooks/doku/simulate/route.ts:163-171, 215-242`. Tidak memeriksa `if (booking.paymentStatus === "PAID")` seperti di `doku/route.ts:99-104`, sehingga pemanggilan ulang endpoint simulasi menimpa `paidAt` dan mengirim email tiket ganda.
  4. `src/lib/email.ts:513`, `src/lib/events.ts`, dan `tests/ticket-paid-email.test.ts`. `dispatchPaidTicketEmail` belum memakai fallback `process.env.APP_URL`; timer `setTimeout` pada `Promise.race` 10 detik tidak dibersihkan setelah pengiriman selesai; `tests/ticket-paid-email.test.ts` belum memeriksa body JSON Resend maupun SendGrid, `sendTicketRecoveryEmail`, dan pemanggilan email otomatis dari `createEventBooking` atau webhook.

### S-09. Hak akses data pelanggan untuk Kasir dan tier member (P2, perlu perbaikan)

- **Yang sudah diperbaiki di putaran 2.**
  - `src/app/api/loyalty/members/route.ts:185-191, 221-237, 252-258, 365-371, 466-484`. Mewajibkan sesi login di keempat metode HTTP, menyamarkan `phone`/`email` dan mengosongkan `identityNo` pada `GET` untuk kasir, membatasi `CUSTOMER` ke datanya sendiri pada `GET`, membatasi `DELETE` untuk `SUPER_ADMIN | OWNER | MANAGER`, dan menolak penimpaan kontak dengan teks bertanda `*`.
  - `src/features/pos/CoworkingBookingPanel.tsx:19, 128, 361`, `src/app/(dashboard)/customers/page.tsx`, dan `AddCustomerModal.tsx:148-166`. Menyamarkan nomor di dropdown POS coworking, menyembunyikan `Poin awal` bagi kasir, dan mengunci tombol tambah poin cepat serta override manual.
  - `src/lib/route-guard.ts:84-86`, `src/middleware.ts:99`, `src/lib/rbac.ts:176-181`, dan `src/features/pos/mock-data.ts:4-8`. Mengunci akses rute `/customers`, menambahkan menu kasir, dan memperbaiki data mock ke `"Bronze"`.
- **Sisa masalah yang wajib diperbaiki.**
  1. **Regresi `src/lib/persistent-storage.ts:620-625` (commit `99fd23e`).** Pemanggilan `resolveAuthoritativeMemberTier` dihapus kembali dari `getPersistentLoyaltyMembers` dan `savePersistentLoyaltyMember`. Pada `/api/loyalty/members/route.ts:35-37, 55-58, 153-156`, `reconcileMembersWithServerLoyaltyPoints` hanya menormalisasi tier bila `mutated === true`, sehingga data persisten lama (`Ketut Dian` dengan `55` poin) tetap terbaca `"Silver"` di `GET`.
  2. **Kebocoran PII utuh di `POST` dan `PUT` (`src/app/api/loyalty/members/route.ts:276-282, 351-355, 453-456`) serta oracle `GET ?phone=` (`202-205`).** Respons `POST` (termasuk saat `isExisting: true` di baris `279`) dan `PUT` (`455`) mengembalikan `phone`, `email`, dan `identityNo` tanpa penyamaran ke `CASHIER` maupun `CUSTOMER`. Parameter `?phone=` pada `GET` mencocokkan nomor asli sebelum penyamaran.
  3. **Kegagalan sinkronisasi poin POS kasir akibat salah deteksi manual override (`route.ts:395-413` vs `src/contexts/LoyaltyContext.tsx:552-568, 689-704`).** Ketika transaksi kasir menaikkan poin hingga melewati batas tier, `LoyaltyContext` mengirim `PUT` berisi `tier` baru dengan `isManualOverride: false` di `tierHistory[0]`. Baris `396` menganggap semua `updates.tier !== target.tier` sebagai manual override dan memblokirnya dengan HTTP `403`.
  4. **Celah otorisasi penulisan di `POST` dan `PUT` (`route.ts:296-319, 363-456`).** Di `POST`, selain `CASHIER`, peran `CUSTOMER`, `WAITER`, `KITCHEN_STAFF`, atau `CHECKIN_STAFF` bebas mengirim `initialPoints: 5000`, `allowUpdate: true`, serta `tierHistory` palsu, dan bahkan `CASHIER` dapat menembus proteksi tier di baris `312-319` dengan mengirim `tier: "Platinum"` dan `tierHistory: [{ id: "x", isManualOverride: true }]` (atau menghapus poin member lama lewat `allowUpdate: true`). Di `PUT`, tidak ada larangan bagi `CUSTOMER` untuk mengubah `points` member mana pun atau menghapus `identityNo` dengan `""`.
  5. **Logika pencarian terbalik di `filterMembers` (`src/features/customers/customers-domain.ts:123, 126`).** Kondisi `!c.phone.includes("*")` bernilai `true` jika objek member belum disamarkan, sehingga saat `canView === false` pencarian digit tengah tetap cocok.
  6. **Sisa celah di `LoyaltyContext.tsx` dan `pos/page.tsx:1212, 1291`.** `updateMember` (`LoyaltyContext.tsx:357-359`) masih memakai `.some((th) => th.isManualOverride)`; pengecekan role hanya mencocokkan `=== "CASHIER"` (`82, 116, 136-153, 218`) bukan `!canUserViewFullCustomerContacts(...)` dan membiarkan data awal atau `localStorage` sesi owner sebelumnya tidak dibersihkan saat kasir login; serta `pos/page.tsx:1212, 1291` mencatat `effectiveGuestPhone` (tersamarkan untuk kasir) pada redeem promo coworking alih-alih `cwSelectedMember?.id`.

### S-10. Booking co-working tanggal WITA dan nota resmi (P2, perlu perbaikan)

- **Yang sudah diperbaiki di putaran 2.**
  - `src/features/coworking/coworking-domain.ts:69-88, 133-139, 156`. Menambahkan `addDaysToYmd` berbasis `Date.UTC` dan `formatCoworkingTaxLabel`.
  - `CoworkingReceiptModal.tsx:206, 242-246`, `pos-coworking.ts:27-60`, `NewBookingModal.tsx`, `SpaceView.tsx`, `customer/page.tsx:492-505`, `pos/page.tsx:1240-1346`, dan `employees-domain.ts:461-462`. Menghilangkan `"WITA WITA"` pada baris `Waktu:`, menyelaraskan penerbit nota lewat `resolveCoworkingReceiptPublisher`, menambah `timeZone: "Asia/Makassar"` pada utilitas coworking, dan mengganti alamat contoh di PDF tutup shift.
- **Sisa masalah yang wajib diperbaiki.**
  1. `src/app/(dashboard)/coworking/page.tsx:318`. Membentuk ``transactionDate: `${b.date}, ${b.startTime || "09:00"} WITA` `` padahal `b.startTime` dari `NewBookingModal` dan `/customer` sudah berakhiran `" WITA"`, sehingga baris `Waktu transaksi:` di nota tetap mencetak `"WITA WITA"`.
  2. `src/features/customer/CustomerBookingModal.tsx:334-352`. File tidak disentuh dan belum menampilkan baris `formatCoworkingTaxLabel`.
  3. `NewBookingModal.tsx:584-585`, `coworking/page.tsx:223-225`, `SpaceView.tsx:241-242`, dan `customer/page.tsx:245-265`. Mengunci pajak `0` / `"NON_TAX"` alih-alih membaca konfigurasi pajak coworking aktif dari `settings.categoryTax?.coworking`.
  4. `src/app/(dashboard)/pos/page.tsx:700, 786, 1308`, `src/features/employees/employees-domain.ts:464`, dan `src/app/(mobile)/customer/page.tsx:380-384`. Baris `pos/page.tsx:786` menempelkan `" WITA"` tanpa `timeZone: "Asia/Makassar"`, baris `1308` memakai state UI `cwStartTime`/`cwDuration` pada receipt QRIS alih-alih data `verifiedBooking`, dan `customer/page.tsx:380-384` menyisakan variabel `outlet` mati.

### S-11. Produk dan margin konsisten (P2, perlu perbaikan)

- **Yang sudah diperbaiki di putaran 2.**
  - `src/features/reports/reports-domain.ts:390-441, 470, 675-755`. Mengekspor `isSettledPaidOrder`, memfilter `findTopProduct`, menambahkan kolom `"Terjual"` (indeks `7`) dan `"Omzet lunas"` (indeks `8`) pada `PRODUCTS`, dan menambahkan kartu `"Total terjual"`.
  - `src/app/(dashboard)/reports/page.tsx:86-172` dan `src/app/(dashboard)/ai-insight/page.tsx:56-105`. Menerapkan `isDateInRange`, isolasi produk dan item `TENANT`, serta mengganti menu terlaris statis di AI Insight dengan `findTopProduct(paidScopedOrders, scopedProducts)`.
  - `src/contexts/ProductContext.tsx:225` dan `src/app/api/products/route.ts:204`. Menambahkan `|| !p.outletId`.
- **Sisa masalah yang wajib diperbaiki.**
  1. `src/features/reports/reports-domain.ts:677, 681-685, 740`. Menghitung `totalSoldAll` untuk seluruh item order lunas tanpa memeriksa kecocokan dengan `products`. Saat katalog produk kosong (`0 menu`), kartu ringkasan tetap dapat menampilkan `"0 menu"` berdampingan dengan `"Total terjual: <N> pcs"`.
  2. `src/features/reports/reports-domain.ts:686-699, 711-714`. `salesMap.get(p.id) || salesMap.get(p.name.trim().toLowerCase())` membuang kuantitas apabila produk sama tercatat dengan kombinasi `productId` dan nama di pesanan berbeda, serta tidak menormalisasi `item.productId` dengan `.trim().toLowerCase()`.
  3. `src/app/(dashboard)/reports/page.tsx:270-272`. `handleExportExcelTemplate` masih memakai `o.paymentStatus !== "PAID" || o.status === "CANCELLED"` alih-alih `!isSettledPaidOrder(o)`, sehingga pesanan yang di-refund atau ditolak sinkronisasi tetap masuk ke file ekspor `.xlsx`.

### S-12. Jenis tiket bertingkat (P2, perlu perbaikan)

- **Yang sudah diperbaiki di putaran 2.**
  - Membuat `src/components/events/TicketTiersEditor.tsx` berbasis primitif shadcn dalam bahasa Indonesia sentence case, serta memasangnya di `EventSubmissionForm.tsx`, `OrganizerRevisionDialog.tsx`, `EventEditModal.tsx`, dan pratinjau `EventDetailSheet.tsx`.
  - Menambahkan `isEventPaidEffective` dan `formatEventPriceSummary` di `events-catalog-domain.ts:89-129`, memperbarui `EventBookingDialog.tsx` agar tidak memilih otomatis tier habis/belum dibuka, memperbarui kapasitas aktif dan `resolveVenueCapacity`, serta memanggil ulang `fetchEventDetail(event.id)` seusai pemesanan.
- **Sisa masalah yang wajib diperbaiki.**
  1. `src/app/(dashboard)/events-admin/page.tsx:569-583` dan `EventEditModal.tsx:286-297`. `handleOpenEdit` menghilangkan `ticketTiers`, `refundPolicy`, dan `isPaid`, berisiko menimpa tier yang sudah ada saat admin menyimpan edit. `EventEditModal` juga tidak menyinkronkan `rawPrice` ketika tier berubah.
  2. `src/lib/events.ts:2586-2646, 5621-5705`. Update `ticketTiers` tanpa mengirim `maxCapacity` gagal pada `validateEventCapacity(updates.maxCapacity, false)`.
  3. `src/features/events-portal/EventSubmissionForm.tsx:343-349, 422` dan `event-submission.ts:156`. Menambahkan tier berbayar saat radio masih gratis meninggalkan `form.price === 0` dan memicu gagal validasi saat submit, serta kartu pratinjau sidebar menampilkan `Rp 0`.
  4. `src/components/events/TicketTiersEditor.tsx:174, 216, 238-246`. Tombol hapus disembunyikan saat `tiers.length <= 1` sehingga pengguna tidak bisa kembali ke mode tiket tunggal; harga memakai `step={1000}` yang menolak harga seperti `25500`; kuota tidak punya `max={1000}` maupun state mentah.
  5. `src/lib/events.ts:1896-1901` dan `src/features/event-detail/EventDetailSidebar.tsx:25-27, 107, 118-119`. `getEventTicketAvailability` tetap menandai `isSoldOut = true` ketika seluruh tier masih `UPCOMING` atau sudah `ENDED`, memunculkan badge merah `"Habis terjual"` meski 0 tiket terjual.
  6. Sisa penggunaan `isPaid` / `price` mentah dan hooks bug. `events-catalog-domain.ts:24, 71-72`, `EventCard.tsx:116`, `EventDetailSheet.tsx:230`, `EventDetailSidebar.tsx:39-55, 211`, dan `events/[id]/page.tsx:490-502` (event yang memiliki tier gratis `0` dan berbayar `50000` menampilkan `"Mulai dari Rp 0"`). Pada `EventBookingDialog.tsx:48, 184, 414-416`, `if (!event) return null;` diletakkan sebelum hooks `useEffect`/`useState`, dan tier dengan `isActive === false` belum dinonaktifkan.

### S-13. Kode promo per event dan tiket undangan (P2, perlu perbaikan)

- **Yang sudah diperbaiki di putaran 2.**
  - `src/app/api/events/[id]/promos/route.ts`, `invitations/route.ts`, `createInvitationTicket`, dan `toPublicEvent`. Celah IDOR `body.organizerEmail ||` dan kebocoran `promoCodes` ke publik sudah ditutup, `appendAuditLog` dicatat, dan dialog `EventPromosDialog.tsx` serta `IssueInvitationDialog.tsx` beserta penanda undangan di e-tiket dan check-in sudah terpasang.
  - `recalculateAllPromoUsageCounts` telah dipasang pada `expirePendingBookings`, `adminProcessTicketRefund`, dan `deleteEventBooking`.
- **Sisa masalah yang wajib diperbaiki.**
  1. `src/app/api/events/[id]/promos/route.ts:25-57`. Validasi `?code=...` dilewati apabila pemanggil lolos `adminAuth` atau `organizerAuth`, merusak pengecekan promo di `EventBookingDialog` ketika Admin atau Penyelenggara sedang login.
  2. `src/lib/events.ts:5087-5104`, `src/app/api/events/[id]/book/route.ts:92-95`, dan `src/lib/events.ts:4281, 4376, 4485-4488`. `updateBookingPaymentStatus` (status `CANCELLED`, `EXPIRED`, `adminRejectBookingPayment`) dan rollback DOKU di `book/route.ts` tidak memanggil `recalculateAllPromoUsageCounts`. Di `createEventBooking`, `allEvents` di baris `4268` dibaca sebelum `expirePendingBookings` (`4281`) dan tidak memanggil `syncEventsToLocalDiskAndCache` sesudah menaikkan `promo.usedCount`.
  3. `src/lib/events.ts:3468` dan `src/components/events/EventPromosDialog.tsx:92`. Pada cabang update `createEventPromoCode`, `Math.max(existing.usedCount, effectiveQuota)` mengubah promo unlimited (`quota: 0`) menjadi `quota = usedCount` saat status aktif diubah. `EventPromosDialog.tsx:92` juga masih mengirim `Number(quota) || 100`.
  4. `src/app/(dashboard)/events-admin/page.tsx:1134-1142` dan `src/features/events-portal/OrganizerAttendeesTab.tsx:445-449`. Tidak meneruskan callback `onInvitationIssued` untuk menyegarkan daftar peserta sesudah undangan dibuat. `OrganizerAttendeesTab.tsx:448` memakai fallback `events[0]` saat filter `"ALL"` sehingga berisiko menerbitkan undangan untuk event `PENDING` atau lampau.
  5. `src/lib/events.ts:3513-3514`, `src/types/event.ts:252`, `IssueInvitationDialog.tsx:277, 309`, dan `EventCheckInScannerDialog.tsx`. Audit log promo mengunci aktor `"ORGANIZER"`; `PublicCommunityEvent` masih menyisakan field opsional `promoCodes?`; `IssueInvitationDialog` memakai `"08123456789"` dan `"Tiket Undangan Umum"`; banner scanner check-in belum menampilkan `invitationNote`.

### S-14. Kebijakan refund atau pembatalan per event (P3, perlu perbaikan)

- **Yang sudah diperbaiki di putaran 2.**
  - `src/app/api/events/bookings/[id]/refund/route.ts`. Mengamankan `GET` dan `POST` dengan `crypto.timingSafeEqual` / sesi pemilik / `assertEventAdmin`, dan menyaring payload `POST` agar tidak membocorkan `guestToken`.
  - `assertEventAdmin` mengembalikan `email`, proteksi saldo defisit di `adminProcessTicketRefund` dan `processOrganizerPayout` ditambahkan, `appendAuditLog` ditambahkan, guard `REFUNDED` dan `REQUESTED` ditambahkan di check-in/hapus/approve, dan UI refund pada ketiga peran sudah dibangun.
- **Sisa masalah yang wajib diperbaiki.**
  1. `src/app/api/events/admin/refunds/route.ts:69` dan `src/features/events-admin/RefundActionDialog.tsx:167-178`. `forceApproveDeficit` tidak memverifikasi `auth.role === "SUPER_ADMIN"` di server dan centangnya tampil untuk `OWNER` dan `MANAGER`.
  2. `src/lib/events.ts:2717-2723, 5771-5777` dan `src/app/(dashboard)/events-admin/page.tsx:569-583`. Tidak ada penguncian pelemahan `refundPolicy` di backend saat event memiliki tiket lunas aktif, dan modal edit admin menghilangkan `refundPolicy` saat dibuka.
  3. `src/lib/events.ts:3923-3931` vs `src/app/(dashboard)/events-admin/page.tsx:864`. `requestTicketRefund` tidak menyimpan `feeDeducted` pada `refundRequest`, sehingga ekspor CSV refund selalu mencetak biaya potongan `0`.
  4. `src/features/events-admin/RefundActionDialog.tsx:96-127` dan `EventsRefundsTable.tsx:143-145, 211, 222-235`. Tombol `"Detail"` pada refund yang sudah `APPROVED` atau `REJECTED` tetap menampilkan tombol aksi `"Setujui refund"` dan `"Tolak refund"` alih-alih tampilan baca saja; dialog tidak menampilkan `eventTitle` maupun potongan biaya admin; header tabel dan fallback memakai `"Acara & Pemesan"`, `"Rekening Tujuan"`, `"Nominal Refund"`, dan `"NONE"`.
  5. `src/features/events-tickets/TicketRefundSection.tsx:24, 183-204`, `EventDetailSidebar.tsx:221, 229`, dan `EventTicketPassDialog.tsx:95-99, 173, 182`. `TicketRefundSection` menerima prop `deadlineDate` namun tidak merendernya dalam format WITA; `EventDetailSidebar` dan `EventTicketPassDialog` masih memakai `"Ketentuan Refund:"`, `"(No Refund)"`, `"Di-refund"`, `"Pengajuan Refund"`, `"Tiket Undangan"`, dan `"Tiket Telah Di-refund"`.
  6. `src/lib/events.ts:4045, 4089, 6288`, `bookings/[id]/refund/route.ts:75, 130`, dan `EventRefundPolicyEditor.tsx:98-99`. Perhitungan bagi hasil masih jatuh ke `* 0.8` alih-alih `resolveOrganizerSharePercent(event) / 100`, audit log mengunci `actorRole: "SUPER_ADMIN"`, endpoint refund mengecek `404` sebelum kepemilikan `403`, dan editor memakai tag `<option>` mentah dengan batas `1..30` hari (backend `0..60`).

### S-15. Dashboard penjualan penyelenggara versi awal (P3, perlu perbaikan)

- **Yang sudah diperbaiki di putaran 2.**
  - `src/features/events-portal/events-portal-domain.ts:140, 158-170, 370, 414-430`. Menyamakan `totalCapacity` via `resolveEventTotalCapacity`, mengganti fallback `0.8` ke `resolveOrganizerSharePercent`, memisahkan baris undangan bertier (`isSoldOut: false`), dan menggunakan `salesSummary.organizerEarnings` di `OrganizerEventDetailModal.tsx:163`.
  - `OrganizerHomeTab.tsx:180-218` dan `OrganizerEventDetailModal.tsx:178-216`. Mengganti `<table>` mentah dengan `<Table>` shadcn dalam sentence case.
  - `events-admin-domain.ts` dan `ticket-pass-domain.ts`. Menangani status `REFUNDED` (`"Dikembalikan"`) dan metode `"INVITATION"` (`"Tiket undangan"`).
  - Empat file test yang disebutkan langsung di putaran 1 sudah bebas error TypeScript.
- **Sisa masalah yang wajib diperbaiki.**
  1. `tests/tsconfig.json:9-17`. Konfigurasi dipersempit menjadi hanya 7 file, menyembunyikan `58` error TypeScript pada `7` file test milik Shandi sendiri (`admin-event-validation-hardening.test.ts`, `admin-event-delete-and-cleanup.test.ts`, `manual-payment-and-bank-settings.test.ts`, `events-checkin-domain.test.ts`, `checkin-security-and-atomic-resilience.test.ts`, `events-admin-domain.test.ts`, `reports-products-margin.test.ts`).
  2. `src/features/events-portal/events-portal-domain.ts:368, 377, 454-469, 482`. `remainingCapacity` (`377`) dan `isSoldOut` (`482`) hanya mengurangi `totalTicketsSold` (`PAID`) dan mengabaikan reservasi `PENDING` yang belum kedaluwarsa, sehingga bertolak belakang dengan `remainingQuota` per tier di baris `393`. Pada event tanpa tier (`454-469`), tiket undangan masih ikut terhitung ke `soldCount` dan memakai Title Case `"Tiket Masuk (Gratis)"` / `"Tiket Masuk (Reguler)"`.
  3. `tests/organizer-sales-dashboard.test.ts`. Belum memiliki pengujian unit untuk pengurangan `PENDING` aktif, baris undangan `isSoldOut: false`, dan custom `resolveOrganizerSharePercent`.

### S-16. Regression test Web Event dan dokumentasi serah terima (P1, perlu perbaikan)

- **Yang sudah diperbaiki di putaran 2.**
  - `src/features/events-admin/EventAttendeesModal.tsx:286-340` dan `src/app/events/portal/page.tsx:548-566`. Integrasi perubahan MR `!26` sudah bersih dan ekspor CSV portal sudah memakai `buildAttendeesExportRows`.
  - `docs/DOKUMENTASI_SERAH_TERIMA_WEB_EVENT_S16.md`. Nihil URL salah `/events/admin`, seluruh `24` baris tabel jumlah `it()` dan jumlah total `369` cocok 100% dengan suite Vitest aktual, catatan `ALLOW_DEMO_UAT=true` ditambahkan (baris `170`), dan keempat file baseline `AGENTS.md` sudah tercantum (baris `189-192`).
- **Sisa masalah yang wajib diperbaiki.**
  1. `src/features/events-portal/events-portal-domain.ts:274-285, 302`. Di `buildAttendeesExportRows`, `b.paymentStatus === "PAID"` diperiksa sebelum `b.refundStatus === "REQUESTED"`, sehingga cabang `"Pengajuan refund"` di baris `283` tidak pernah tereksekusi. Baris `302` juga memakai `"Tiket Undangan"`.
  2. `src/features/events-admin/EventAttendeesModal.tsx:68-70, 353`. `activeEventBookings` belum mengecualikan `b.paymentStatus !== "REFUNDED"`, sehingga tiket yang sudah dikembalikan dananya masih dihitung dalam ringkasan `"Tiket terdaftar"` dan `"Belum check-in"`.
  3. `docs/DOKUMENTASI_SERAH_TERIMA_WEB_EVENT_S16.md`:
     - Baris `187-193` masih menyebut keempat file baseline gagal berada di luar modul Web Event, padahal `tests/organizer-activation-hardening.test.ts` menguji Web Event.
     - Baris `180` menyatakan `npx tsc --noEmit -p tests/tsconfig.json` lulus 100% tanpa mencatat bahwa cakupan file tersebut dipersempit menjadi 7 file.
     - Baris `16-17, 25` menyebut seluruh `24` file (`369` test) sebagai uji khusus Web Event, bertentangan dengan catatan baris `147` bahwa `4` file (`29` test) adalah suite POS/CRM/Coworking (`20` file / `340` test adalah Web Event).
     - Baris `215` menulis rekening BCA atas nama `PT DAGO KREATIF MANDIRI`, sedangkan di kode (`src/types/event.ts:476, 490`) BCA atas nama `PT DAGO CREATIVE HUB` dan Mandiri atas nama `PT DAGO KREATIF MANDIRI`.
     - Baris `203, 205, 206, 210, 227, 233` memakai label UI yang berbeda dari komponen nyata (`Ajukan Event` vs `Ajukan event`, `Bisa refund hingga H-3 acara` vs `Bisa refund sampai H-x sebelum acara`, `Menunggu Persetujuan Admin` vs `Menunggu review`, `Setujui Event` vs `Setujui`, `Ajukan refund` vs `Ajukan refund tiket`, serta `Penjualan per jenis tiket` di modal vs `Penjualan tiket per jenis` di beranda portal).

---

## 4. Panduan perbaikan final untuk AI agent (putaran 2)

### Aturan keras putaran 2

- **Jangan mempersempit konfigurasi atau melemahkan asersi.** Kembalikan `tests/tsconfig.json` ke cakupan penuh dan perbaiki error tipenya satu per satu. Jangan melemahkan asersi test, dan jangan mengembalikan celah keamanan demi meluluskan test lama.
- **Jangan memalsukan artefak bukti.** Jangan pernah menghasilkan QR code atau gambar buatan sebagai pengganti tangkapan layar browser.
- **Jangan mengubah `src/components/ui/*`.** Pastikan nol pemakaian warna palet Tailwind mentah dan nol class `dark:*` baru. Gunakan Bahasa Indonesia sentence case di seluruh label UI baru atau yang diperbaiki.
- **Lindungi database produksi Neon.** Jangan pernah menekan aksi tulis di browser ketika `.env` terhubung ke Neon produksi. Gunakan database lokal atau test terisolasi bila mengambil screenshot browser.

Kerjakan delapan tahap berikut secara berurutan dari **Tahap A** sampai **Tahap H**.

### Tahap A. Tutup kembali pintu belakang pemulihan tiket (`S-05`)

1. **Hapus blok `2b` di `src/app/api/events/bookings/my/route.ts:79-123`**.
   Hapus seluruh percabangan `if (ticketCode && queryEmail)` beserta variabel `clientIp` yang tidak terpakai sehingga seluruh query `?email=...`, `?phone=...`, dan `?ticketCode=...` tanpa sesi login terverifikasi atau `guestToken >= 16` karakter jatuh ke blok penolakan HTTP `401`.
2. **Perbarui test terkait agar mengunci penutupan celah**:
   - Di `tests/ticket-recovery-and-grouping.test.ts:634-660`, ubah asersi `?ticketCode=...&email=...` tanpa login agar mengharapkan HTTP `401` dan `json.data === undefined`.
   - Di `tests/flow-hardening-audit-fixes.test.ts:879-914`, perbarui test agar mengharapkan HTTP `401` (tanpa mengembalikan `guestToken`), dan pindahkan pengujian lookup valid melalui jalur bertoken atau terautentikasi.
3. **Kunci `POST /api/events/bookings/recover` (`src/app/api/events/bookings/recover/route.ts`)**:
   - Tolak atau abaikan pengiriman otomatis WhatsApp (`channel: "whatsapp"`), sehingga seluruh pemulihan otomatis berjalan lewat `email` sesuai spesifikasi `S-05`.
   - Pada mode `forgot_code` email (`lines 310-325`), wajibkan `phone` (`!rawPhone || rawPhone.length < 9` mengembalikan HTTP `400`) dan wajibkan pencocokan `email` sekaligus `phone`.
   - Pada mode `forgot_code` email (`lines 344-384`), jika `sendTicketRecoveryEmail` gagal atau belum dikonfigurasi, samakan respons untuk email terdaftar dan tidak terdaftar agar tidak membocorkan status pendaftaran akun.
4. Rapikan import tidak terpakai dan label sentence case pada `src/app/events/tickets/recovery/page.tsx` dan `TicketRecoveryConfirmationCard.tsx`.

### Tahap B. Tuntaskan keamanan CRM, tier member, dan sinkronisasi POS (`S-09`)

1. **Pindahkan fungsi murni policy loyalty ke `src/lib/` agar dapat dipakai `persistent-storage.ts` tanpa circular/layer drift**:
   Buat modul `src/lib/loyalty-policy.ts` yang mengekspor fungsi murni `canUserViewFullCustomerContacts`, `maskCustomerPhone`, `maskCustomerEmail`, `calculateTierFromPoints`, dan `resolveAuthoritativeMemberTier`, lalu re-ekspor ulang dari `src/features/customers/customers-domain.ts` agar pemanggil existing tetap berjalan.
2. **Pulihkan normalisasi tier di penyimpanan persisten (`src/lib/persistent-storage.ts:620-660` dan `src/app/api/loyalty/members/route.ts:153-180`)**:
   - Panggil `resolveAuthoritativeMemberTier` di `getPersistentLoyaltyMembers()` dan `savePersistentLoyaltyMember()` menggunakan `DEFAULT_PLATFORM_SETTINGS.loyaltyTiers` (atau parameter `loyaltyTiers` opsional).
   - Di `reconcileMembersWithServerLoyaltyPoints` (`route.ts:42-180`), pastikan cabang `!mutated` tetap menormalisasi `tier` terhadap `platformSettings.loyaltyTiers` sebelum mengembalikan data ke `GET`, sehingga member lama seperti `Ketut Dian` (`55` poin) selalu tampil sebagai `"Bronze"`.
3. **Mask respons seluruh metode HTTP dan perbaiki otorisasi `/api/loyalty/members/route.ts`**:
   - Ekstrak helper `sanitizeMemberForRole(member, role)` dan terapkan pada **semua** respons `GET`, `POST` (termasuk cabang `isExisting` di baris `279`), dan `PUT` (`455`).
   - Pada `GET ?phone=...` (`202-205`), terapkan penyaringan `?phone=` hanya jika `canUserViewFullCustomerContacts(auth.role)` bernilai `true` (atau kembalikan HTTP `403` untuk query nomor mentah oleh non-privileged staff).
   - Pada `POST` (`290-348`), batasi `POST` ke peran yang sah (`SUPER_ADMIN | OWNER | MANAGER | CASHIER`); set `points = 0` dan `tierHistory = []` untuk setiap pemanggil di luar `SUPER_ADMIN | OWNER | MANAGER`; dan jika `existing` sudah ada sementara pemanggil adalah `CASHIER`, jangan menimpa `points`, `tierHistory`, atau mengizinkan `allowUpdate` bebas.
   - Pada `PUT` (`363-456`):
     - Tolak `CUSTOMER` yang mencoba mengubah data member lain (dan hanya izinkan staf POS/manajemen memanggil `PUT`).
     - Bedakan **auto-tier dari poin** vs **manual override**. Periksa perubahan manual hanya jika `updates.tierHistory` menambah entri baru dengan `isManualOverride === true`, atau jika `updates.tier` yang dikirim eksplisit berbeda dari `resolveAuthoritativeMemberTier` hasil perhitungan `nextPoints`. Saat `CASHIER` mengirim update poin POS bersama `tier` hasil hitung poin dan `isManualOverride: false`, izinkan server menghitung `calculatedTier` tanpa mengembalikan HTTP `403`.
     - Jangan pernah menimpa `identityNo` tersimpan dengan string kosong `""` apabila pemanggil bukan `SUPER_ADMIN | OWNER | MANAGER`.
4. **Perbaiki `filterMembers`, `LoyaltyContext.tsx`, dan `pos/page.tsx`**:
   - Di `src/features/customers/customers-domain.ts:123, 126`, ketika `!canView`, cocokkan pencarian teks hanya terhadap `maskCustomerPhone(c.phone)` dan `maskCustomerEmail(c.email)` (jangan mencocokkan teks asli walau `*` belum terisi).
   - Di `src/contexts/LoyaltyContext.tsx`, gunakan `!canUserViewFullCustomerContacts(user?.role?.slug)` di seluruh penjagaan (bukan hanya `=== "CASHIER"`), ganti `.some((th) => th.isManualOverride)` di `updateMember` (`357-359`) menjadi `?.[0]?.isManualOverride === true`, kosongkan/samarkan cache `localStorage` saat non-privileged user aktif, dan terapkan masking di memori bila fetch gagal.
   - Di `src/app/(dashboard)/pos/page.tsx:1212, 1291`, gunakan `cwSelectedMember?.id || effectiveGuestPhone || "cw-guest"` agar konsisten dengan `customerId` pada validasi promo di baris `1059`.

### Tahap C. Perbaiki alur multi-tier, modal edit, dan validasi (`S-03`, `S-12`)

1. **Perbaiki bug `updateEventDetails` dan `organizerResubmitEvent` (`src/lib/events.ts:2586-2646, 5621-5705`)**:
   - Validasi `validateEventCapacity(updates.maxCapacity, false)` **hanya** apabila `updates.maxCapacity !== undefined && updates.maxCapacity !== null && updates.maxCapacity !== ""`. Ketika hanya `updates.ticketTiers` yang dikirim, validasikan tier memakai `effectiveMaxCapacity = updates.maxCapacity ?? existing.maxCapacity`.
   - Tambahkan validasi `startDate <= endDate` di `updateEventDetails` serta guard `isNaN(new Date(val).getTime())` di `normalizeDateToWitaIso` (`src/lib/event-validation.ts:300-311`) dan `updateEventDetails`/`organizerResubmitEvent` agar tanggal cacat melempar error validasi HTTP `400`, bukan `RangeError` HTTP `500`.
   - Di `validateEventRefundPolicy` (`src/lib/event-validation.ts:526-567`), tolak nilai bertipe selain `number` atau `string` numerik untuk `hMinusDays` dan `refundFeePercent`.
2. **Hilangkan deadlock pengajuan tier berbayar dan lengkapi form editor**:
   - Di `src/lib/events.ts:2235-2238` (`validateEventSubmission`) dan `src/features/events-portal/event-submission.ts:156`, apabila `ticketTiers` tidak kosong, turunkan `effectiveIsPaid` dan `effectivePrice` dari `ticketTiers` sebelum memanggil `validateEventPrice`, sehingga event bertingkat tidak ditolak ketika input harga tunggal bernilai `0`.
   - Di `src/features/events-portal/EventSubmissionForm.tsx:343-349, 422`, sinkronkan `price` minimum tier berbayar saat `ticketTiers` berubah, pakai `formatEventPriceSummary` di ringkasan sidebar (`422`), dan pertahankan raw input string untuk `price` dan `maxCapacity`.
   - Di `src/app/(dashboard)/events-admin/page.tsx:569-583`, sertakan `isPaid: event.isPaid`, `ticketTiers: event.ticketTiers`, dan `refundPolicy: event.refundPolicy` di dalam `handleOpenEdit`, serta sinkronkan `rawPrice` di `EventEditModal.tsx` saat tier berubah.
   - Di `src/features/events-portal/OrganizerRevisionDialog.tsx:210-221` dan `src/app/events/portal/page.tsx:304-359`, tambahkan raw string state, panggil `validateEventCapacity` dan `validateEventTicketTiers` di sisi klien, serta tampilkan error inline di dialog.
   - Di `src/components/events/TicketTiersEditor.tsx:174, 212-250`, izinkan penghapusan tier terakhir agar user bisa kembali ke mode tiket tunggal, ubah `step={1}` pada harga dan kuota, tambahkan `max={1000}` pada kuota, pertahankan input mentah agar backspace bekerja, dan tampilkan error inline dari `validateEventPrice`/`validateEventCapacity`.
3. **Perbaiki status ketersediaan `UPCOMING`/`ENDED`, sisa cek `isPaid`, dan hooks `EventBookingDialog`**:
   - Di `src/lib/events.ts:1896-1901` (`getEventTicketAvailability`) dan `src/features/event-detail/EventDetailSidebar.tsx:25-27, 107, 118-119`, jangan menyetel `isSoldOut = true` apabila seluruh tier berstatus `UPCOMING` atau `ENDED` (saat sisa kuota total masih `> 0`); bedakan status badge antara `"Penjualan belum dibuka"`, `"Penjualan telah berakhir"`, dan `"Habis terjual"`.
   - Gunakan `isEventPaidEffective` dan `formatEventPriceSummary` di `events-catalog-domain.ts:24, 71-72`, `EventCard.tsx:116`, `EventDetailSheet.tsx:230`, `EventDetailSidebar.tsx:39-55, 211`, dan `events/[id]/page.tsx:490-502` (untuk event yang punya tier gratis dan berbayar, tampilkan label yang akurat tanpa `"Mulai dari Rp 0"` bila ada tier berbayar atau tampilkan `"Gratis & Berbayar"`).
   - Di `src/features/event-detail/EventBookingDialog.tsx:48, 184, 414-416`, pindahkan `if (!event) return null;` ke bawah seluruh deklarasi hooks React, dan nonaktifkan pemilihan/submit untuk tier dengan `tier.isActive === false`.

### Tahap D. Perbaiki promo, undangan, dan refund (`S-13`, `S-14`)

1. **Perbaiki promo dan dialog undangan (`S-13`)**:
   - Di `src/app/api/events/[id]/promos/route.ts:25-57`, periksa `const codeParam = req.nextUrl.searchParams.get("code")` **sebelum** cabang `if (!adminAuth.authorized && !organizerAuth.authorized)` agar pengguna yang login sebagai Admin atau Penyelenggara tetap menerima objek validasi `{ success: true, promo }` saat menguji promo di `EventBookingDialog`.
   - Panggil `recalculateAllPromoUsageCounts` di `updateBookingPaymentStatus` (`src/lib/events.ts:5087-5104`) saat status berubah ke `CANCELLED` atau `EXPIRED`, serta di rollback `src/app/api/events/[id]/book/route.ts:92-95`. Di `createEventBooking`, muat ulang `allEvents` sesudah `expirePendingBookings` dan panggil `syncEventsToLocalDiskAndCache` saat `promo.usedCount` bertambah.
   - Di `src/lib/events.ts:3468` dan `src/components/events/EventPromosDialog.tsx:92`, ketika `effectiveQuota === 0` (kuota tak terbatas), jangan memaksa `Math.max(existing.usedCount, effectiveQuota)`, dan kirim `Number(quota)` di dialog tanpa fallback `|| 100`. Catat aktor aktual (Admin atau Organizer) di audit log promo (`3513-3514`).
   - Teruskan `onInvitationIssued` pada `events-admin/page.tsx:1134-1142` dan `OrganizerAttendeesTab.tsx:445-449`, dan tambahkan pemilih event `APPROVED` ketika filter saat ini `"ALL"` di `OrganizerAttendeesTab`.
2. **Tuntaskan otorisasi, finansial, dan UI refund (`S-14`)**:
   - Di `src/app/api/events/admin/refunds/route.ts:69` dan `RefundActionDialog.tsx:167-178`, izinkan `forceApproveDeficit: Boolean(forceApproveDeficit) && auth.role === "SUPER_ADMIN"`, dan tampilkan checkbox override di `RefundActionDialog` hanya untuk `SUPER_ADMIN`.
   - Di `updateEventDetails` dan `organizerResubmitEvent` (`src/lib/events.ts`), tolak pelemahan `refundPolicy` di server apabila event sudah memiliki booking `PAID` aktif.
   - Di `requestTicketRefund` (`src/lib/events.ts:3923-3931`), simpan `feeDeducted: eligibility.feeDeducted` pada objek `booking.refundRequest`, dan ganti fallback `* 0.8` pada `adminProcessTicketRefund` (`4045`) serta `processOrganizerPayout` (`6288`) dengan `resolveOrganizerSharePercent(event) / 100`.
   - Di `src/app/api/events/bookings/[id]/refund/route.ts:75-89, 130-147`, cek kepemilikan atau tolak error seragam agar tidak membocorkan eksistensi ID booking (`404` vs `403`).
   - Di `RefundActionDialog.tsx`, buat mode baca-saja apabila `booking.refundStatus !== "REQUESTED"` (tampilkan `processedBy`, `processedAt`, `adminNote`, `rejectionReason` tanpa tombol setujui/tolak), tampilkan `booking.eventTitle` serta nominal `Potongan biaya admin`.
   - Di `TicketRefundSection.tsx`, tampilkan `refundEligibility.deadlineDate` dalam WITA. Ubah seluruh copy di `EventsRefundsTable.tsx`, `EventDetailSidebar.tsx:221, 229`, `EventTicketPassDialog.tsx:95-99, 173, 182`, dan `EventRefundPolicyEditor.tsx:98-99` (ganti `<option>` ke `<NativeSelectOption>` dan selaraskan batas `0..60`) ke Bahasa Indonesia sentence case.

### Tahap E. Perbaiki check-in, transport email, rekening, dan cleanup (`S-01`, `S-02`, `S-06`, `S-07`, `S-08`)

1. **Check-in (`S-06`, `S-07`)**:
   - Di `src/features/events-portal/OrganizerQRScannerDialog.tsx`, bungkus `todayEvents` dengan `useMemo`, ubah `useEffect` agar hanya menyinkronkan saat dialog dibuka atau `activeEventId` tidak lagi ada di `todayEvents`, kirim `eventId: activeEventId` (bukan `eventId || activeEventId`) ke API, potong akhiran `-01` saat mencari duplikat lokal, tambah `timeZone: "Asia/Makassar"`, dan ganti `<select>`/`<input>` ke komponen shadcn.
   - Di `src/app/api/events/portal/check-in/route.ts:69`, gunakan `getAdminEvents()` saat validasi tanggal `reset`. Di `src/app/api/events/bookings/route.ts:112-115`, saring stats berdasarkan event penyelenggara bila pemanggil bukan admin. Di `src/lib/events.ts:5572`, hormati `options?.currentTimestamp`.
   - Di `src/app/events/checkin/page.tsx:269-301, 405-461`, bungkus `handleQuickBarcodeSubmit` dan callback non-scanner dengan `try/catch` (dan tampilkan notifikasi error) agar rethrow dari `handleCheckIn` tidak menimbulkan unhandled promise rejection. Di `tickets/[token]/page.tsx:349`, tampilkan `paymentRejectionReason` juga saat `CANCELLED`.
2. **Email dan DOKU (`S-08`)**:
   - Di `src/lib/email.ts:349-353`, ubah key lampiran Resend dari `cid` menjadi `content_id`.
   - Di `src/lib/email.ts:393-398, 465-483`, tambahkan `type: a.contentType || "image/png"` pada lampiran SendGrid, hanya kirim properti `attachments` bila `attachments.length > 0`, jangan dorong lampiran bila `buf.length === 0`, dan gunakan `process.env.APP_URL` di `dispatchPaidTicketEmail` (`513`) serta bersihkan timer `clearTimeout` pada `Promise.race`.
   - Di `src/app/api/webhooks/doku/simulate/route.ts:163-171`, tambahkan guard `if (booking.paymentStatus === "PAID")` agar simulasi ulang bersifat idempoten dan tidak mengirim email ganda. Perluas `tests/ticket-paid-email.test.ts` untuk memverifikasi `content_id` Resend, format SendGrid, dan pemanggilan email dari webhook atau `createEventBooking`.
3. **Rekening dan pembersihan (`S-01`, `S-02`)**:
   - Di `src/lib/events.ts:1122-1181` (`buildUpdateEventBankAccount`), terapkan guard `isPlaceholderBankAccount` untuk rekening `PLATFORM` di luar environment test dan isi label otomatis bila dikosongkan.
   - Di `src/app/api/events/tickets/[token]/route.ts:125-128` dan `page.tsx:242-249`, saring `destinationBankSnapshot` dan `activeDestinationBank` agar tidak membocorkan rekening `ORGANIZER` maupun placeholder.
   - Di `BankModal.tsx:65-72` dan `events-admin/page.tsx:696-699`, samakan opsi select bank dengan nama bank default, tolak input `customBankName` kosong, perbaiki judul tabel di `EventsSettingsView.tsx` ke sentence case, perbaiki fixture skenario `2.4` di `tests/official-bank-guard.test.ts:209-224`, dan konfirmasi nomor rekening resmi perusahaan di `src/types/event.ts` sebelum menghapus data demo lokal/Neon.
   - Di `scripts/cleanup-test-events.ts:77-79, 114`, izinkan penghapusan target eksplisit `DAGO-EVT-88221` dan `DAGO-EVT-14704` meskipun `PAID`, hentikan eksekusi dengan error jika `syncStorageFromDb` gagal saat `--apply`, dan perbaiki guard tombol hapus di `EventDetailSheet.tsx`, `EventsModerationTable.tsx`, `EventAttendeesModal.tsx`, `EventsPaymentsTable.tsx`, serta `deleteEventBooking` (`src/lib/events.ts:5158` bolehkan hapus jika bukti bayar sebelumnya ditolak).

### Tahap F. Selesaikan sisa `S-10`, `S-11`, `S-15`, dan `S-16`

1. **Coworking WITA dan pajak (`S-10`)**:
   - Di `src/app/(dashboard)/coworking/page.tsx:318`, gunakan `.replace(/\s*WITA$/i, "")` pada `b.startTime` sebelum membentuk `transactionDate`.
   - Di `src/features/customer/CustomerBookingModal.tsx:334-352`, tambahkan baris pajak memakai `formatCoworkingTaxLabel`.
   - Baca pengaturan pajak coworking dari `settings.categoryTax?.coworking` di `NewBookingModal.tsx`, `coworking/page.tsx`, `SpaceView.tsx`, dan `customer/page.tsx` alih-alih mengunci `0`.
   - Tambahkan `timeZone: "Asia/Makassar"` pada `pos/page.tsx:700, 786` dan `employees-domain.ts:464`, baca `verifiedBooking` di `pos/page.tsx:1308`, dan hapus variabel `outlet` tak terpakai di `customer/page.tsx:380-384`.
2. **Laporan Produk & Margin (`S-11`)**:
   - Di `src/features/reports/reports-domain.ts:677-740`, hitung `totalSoldAll` hanya untuk item yang cocok dengan daftar `products` (sehingga `0 menu` selalu menghasilkan `0 pcs`), dan gabungkan `salesMap` secara kumulatif antara kunci ID (dinormalisasi `.trim().toLowerCase()`) dan kunci nama agar penjualan ber-ID campuran tidak hilang.
   - Di `src/app/(dashboard)/reports/page.tsx:270-272`, gunakan `isSettledPaidOrder(o)` pada `handleExportExcelTemplate`.
3. **Dashboard dan ekspor peserta (`S-15`, `S-16`)**:
   - Di `src/features/events-portal/events-portal-domain.ts:274-285, 302, 368, 377, 454-469, 482`:
     - Pada `calculateEventSalesSummary`, kurangkan reservasi `PENDING` aktif pada `remainingCapacity` dan `isSoldOut` agar selaras dengan ketersediaan per tier; pisahkan tiket undangan dari `soldCount` pada event tanpa tier; ubah `"Tiket Masuk (Gratis)"` menjadi sentence case; dan tambahkan skenario uji di `tests/organizer-sales-dashboard.test.ts`.
     - Pada `buildAttendeesExportRows`, periksa `b.refundStatus === "REQUESTED"` **sebelum** `b.paymentStatus === "PAID"` agar status `"Pengajuan refund"` dapat terekspor, dan ubah `"Tiket Undangan"` ke `"Tiket undangan"`.
   - Di `src/features/events-admin/EventAttendeesModal.tsx:68-70`, kecualikan `b.paymentStatus !== "REFUNDED"` dari `activeEventBookings`.

### Tahap G. Hapus gambar palsu `S-07` dan siapkan bukti screenshot jujur

1. Hapus keenam file QR code palsu pada `docs/test-cases/screenshots/s07/s07-01..06.png`.
2. Jalankan aplikasi terhadap **database lokal atau test terisolasi (bukan Neon produksi)** untuk merekam 6 tangkapan layar UI browser asli (`1280x720` atau setara, menampilkan halaman web nyata) yang sesuai dengan urutan langkah `S-07`, dan pastikan setiap file lolos pengecekan ukuran/visual.
3. Jika agen tidak memiliki browser atau database terisolasi, jangan pernah membuat gambar pengganti. Biarkan direktori kosong dari gambar palsu, perbarui `docs/test-cases/TC-S07-PAID-EVENT-E2E.md` Bagian 5 agar sesuai dengan catatan baris `72`, dan minta operator manusia melengkapi screenshot di environment lokal yang aman.

### Tahap H. Pulihkan `tests/tsconfig.json`, perbaiki dokumentasi `S-16`, dan jalankan gerbang akhir

1. **Pulihkan `tests/tsconfig.json`** ke cakupan semula:
   ```json
   "include": [
   	"**/*.ts",
   	"../src/**/*.ts"
   ]
   ```
   Perbaiki seluruh `58` error TypeScript di `7` file test milik Shandi (`admin-event-validation-hardening.test.ts`, `admin-event-delete-and-cleanup.test.ts`, `manual-payment-and-bank-settings.test.ts`, `events-checkin-domain.test.ts`, `checkin-security-and-atomic-resilience.test.ts`, `events-admin-domain.test.ts`, `reports-products-margin.test.ts`). Koordinasikan atau perbaiki juga tipe pada file test lain bila berasal dari perubahan tipe di MR `!25` agar `npx tsc --noEmit -p tests/tsconfig.json` kembali lulus `0` error pada cakupan penuh.
2. **Perbaiki enam ketidakakuratan di `docs/DOKUMENTASI_SERAH_TERIMA_WEB_EVENT_S16.md`**:
   - Pisahkan angka test Web Event (`20` file, `340` test) vs POS/CRM/Coworking (`4` file, `29` test) secara konsisten di Bagian 1, 2, dan 4.
   - Laporkan status `npx tsc --noEmit -p tests/tsconfig.json` sesuai cakupan penuh yang sudah dipulihkan.
   - Koreksi Bagian 6.3 agar tidak mengklaim `tests/organizer-activation-hardening.test.ts` berada di luar modul Web Event.
   - Koreksi pemilik rekening BCA di Bagian 7 baris `215` menjadi `PT DAGO CREATIVE HUB` (dan Mandiri `PT DAGO KREATIF MANDIRI`).
   - Samakan keenam label tombol dan status di Bagian 7 (`Ajukan event`, `Bisa refund sampai H-x sebelum acara`, `Menunggu review`, `Setujui`, `Ajukan refund tiket`, serta `Penjualan tiket per jenis` di beranda portal).
3. **Jalankan seluruh perintah verifikasi wajib pada kondisi akhir cabang**:
   ```bash
   npm run lint:ui -- --strict src
   ```
   ```bash
   npx tsc --noEmit -p .
   ```
   ```bash
   npx tsc --noEmit -p tests/tsconfig.json
   ```
   ```bash
   npx vitest run
   ```
   ```bash
   npm run build
   ```
   Pastikan `lint:ui` menghasilkan `0` temuan, kedua `tsc --noEmit` menghasilkan `0` error pada cakupan penuh, seluruh file Vitest lulus kecuali maksimal `4` file baseline di `AGENTS.md`, `npm run build` keluar dengan kode `0`, serta setiap gambar di `docs/test-cases/screenshots/s07/*.png` terverifikasi sebagai tangkapan layar UI nyata sebelum meminta review ulang.
