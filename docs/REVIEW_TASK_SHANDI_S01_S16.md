# Review task Shandi S-01 sampai S-16 dan panduan perbaikan satu putaran

Dokumen ini memuat hasil audit menyeluruh atas seluruh pekerjaan Shandi dari kode task `S-01` sampai `S-16` berdasarkan `Task-List-Magang-POS-WebEvent-13Nov-18Des.xlsx` terhadap kode aktual pada cabang `origin/shandi-dev` di commit `bec02d1942e0d85d38272d4a379315f3b046ef1d` untuk Merge Request `!25`.

Bagian 1 sampai Bagian 3 menyajikan referensi temuan per task, celah keamanan, komponen antarmuka yang belum dibangun, dan konflik integrasi dengan cabang `develop` serta Merge Request `!26`. Bagian 4 menyajikan urutan instruksi teknis lengkap untuk AI agent milik Shandi agar seluruh perbaikan selesai dalam satu putaran tanpa revisi ulang.

## 1. Ringkasan status S-01 sampai S-16

Tidak ada satu pun dari 16 task yang berstatus lulus penuh tanpa catatan pada commit `bec02d1942e0d85d38272d4a379315f3b046ef1d`. Seluruh 16 task memerlukan perbaikan kode, penutupan celah keamanan, pembangunan antarmuka yang belum ada, atau koreksi data dan dokumentasi sebelum layak digabungkan ke `develop`.

| Kode | Prioritas | Judul task di Excel | Kriteria selesai di Excel | Status aktual di `shandi-dev` | Ringkasan gap utama |
| :--- | :---: | :--- | :--- | :---: | :--- |
| `S-01` | P1 | Ganti rekening DEMO dengan rekening resmi | Halaman bayar dan e-tiket menampilkan rekening resmi tanpa peringatan demo | Perlu perbaikan | `data/event_settings.json`, `DEFAULT_EVENT_BANK_ACCOUNTS`, dan `MANUAL_TRANSFER_BANK_ACCOUNTS` masih berisi `000011223344` atas nama `PT DAGO CREATIVE HUB (DEMO)`. Endpoint tiket membocorkan rekening pencairan penyelenggara. Tabel riwayat rekening admin merender `Invalid Date`. |
| `S-02` | P1 | Bersihkan event uji dan data uji | Halaman event publik hanya berisi event asli | Perlu perbaikan | Event `[TEST QA 2]` dan `(Tes 1)` masih berstatus `APPROVED` di `data/events.json`. Query publik `getApprovedEvents` mengabaikan flag `isTestData`. Skrip pembersih tidak melakukan pra-sinkronisasi Neon dan melewatkan target eksplisit Excel. |
| `S-03` | P1 | Validasi harga, kuota, dan role pengaju event | Input tidak valid ditolak dengan pesan jelas, juga lewat API langsung | Perlu perbaikan | Akun `CHECKIN_STAFF` dapat menembus pengajuan tanpa sesi login atau lewat `PUT /api/events/portal`. Array `ticketTiers` melewati validasi harga dan kuota sehingga `0.9` dan `1e+58` lolos. Modal edit admin menelan input salah tanpa pesan error. |
| `S-04` | P2 | Nomor WhatsApp CS resmi di semua halaman | Tidak ada lagi nomor contoh di seluruh situs | Perlu perbaikan | Nomor CS tersebar di banyak file dan hilang dari halaman utama `HomeLanding.tsx`. Nomor contoh `081234567890` dan `+62 812-3344-5566` masih aktif di modal tutup shift POS, halaman karyawan, dan pengaturan. |
| `S-05` | P1 | Lupa kode booking kirim lewat email | Email pemulihan terkirim dan e-tiket tidak terbuka tanpa tautan dari email | Perlu perbaikan | Endpoint lama `GET /api/events/bookings/my` masih mengembalikan `guestToken` mentah tanpa autentikasi dari parameter `email` dan `phone`. Fungsi `sendTicketRecoveryEmail` hanya stub tanpa pengiriman nyata. Halaman pemulihan masih memakai WhatsApp sebagai kanal bawaan. |
| `S-06` | P2 | Meja check-in hanya untuk event hari ini | Event lampau dan mendatang tidak bisa dipilih | Perlu perbaikan | Penyelenggara komunitas mendapat HTTP `403` saat membuka `/events/checkin`. Backend masih membuka jendela check-in hingga 36 jam setelah mulai. Pemindai QR di `/events/portal` mengalami error runtime `TypeError` di setiap scan berhasil karena membaca `json.booking` alih-alih `json.data`. |
| `S-07` | P1 | Uji end-to-end event berbayar | Semua langkah lulus dan terdokumentasi dengan screenshot | Perlu perbaikan | Dokumen `docs/test-cases/TC-S07-PAID-EVENT-E2E.md` tidak memuat satu pun screenshot. Endpoint tiket menghilangkan `checkedInSeats` dan `paymentRejectionReason`. Pemindai kamera menampilkan status hijau palsu saat server menolak scan duplikat. |
| `S-08` | P2 | Kirim e-tiket lewat email setelah lunas | Pembeli menerima email e-tiket dalam 1 menit | Perlu perbaikan | `sendTicketConfirmationEmail` di `src/lib/email.ts` hanya stub yang memalsukan `sent: true` tanpa memanggil SMTP atau API email. Webhook DOKU tidak memicu pengiriman email e-tiket. |
| `S-09` | P2 | Hak akses data pelanggan untuk Kasir dan tier member | Kasir tidak melihat tombol Ekspor, kontak tersamarkan, dan tier sesuai aturan | Perlu perbaikan | Dropdown member coworking di `/pos` masih menampilkan nomor telepon utuh ke Kasir. Endpoint `/api/loyalty/members` tidak memiliki autentikasi, tidak menyamarkan kontak untuk Kasir, dan tidak menghitung ulang tier di server. Rute `/customers` belum dikunci di `route-guard.ts`. |
| `S-10` | P2 | Booking co-working tanggal WITA dan nota resmi | Tanggal default hari ini WITA, nota memakai alamat dan kontak resmi, dan label pajak konsisten | Perlu perbaikan | Nota coworking di `/customer` mengosongkan nomor telepon resmi. Laporan PDF tutup shift masih memuat `Jl. Ngurah Rai No. 45`. Baris pajak hilang di `NewBookingModal` dan `CustomerBookingModal`. Nota mencetak teks ganda `WITA WITA`. |
| `S-11` | P2 | Produk dan margin konsisten | Laporan menampilkan menu terjual dari pesanan lunas saja | Perlu perbaikan | Tabel laporan `PRODUCTS` belum menampilkan kolom jumlah terjual dari pesanan lunas. Halaman `/ai-insight` masih mengunci menu pertama katalog sebagai produk paling laris walau pesanan lunas nol. Pesanan yang sudah di-refund atau ditolak sinkronisasi masih ikut terhitung. |
| `S-12` | P2 | Jenis tiket bertingkat | Pembeli memilih jenis tiket dan kuota per jenis berkurang benar | Perlu perbaikan | Tidak ada antarmuka bagi penyelenggara maupun admin untuk membuat atau mengedit `ticketTiers`. Endpoint `PUT /api/events/[id]` dan `organizerResubmitEvent` membuang field `ticketTiers`. Katalog publik menampilkan label `Gratis` palsu pada event bertingkat. |
| `S-13` | P2 | Kode promo per event dan tiket undangan | Kode promo memotong harga dan tiket undangan bisa di-scan | Perlu perbaikan | Tidak ada antarmuka pembuatan promo maupun penerbitan tiket undangan di portal penyelenggara dan admin. Terdapat celah keamanan lintas penyelenggara lewat `body.organizerEmail` dan kebocoran seluruh kode promo aktif ke publik lewat `toPublicEvent`. |
| `S-14` | P3 | Kebijakan refund atau pembatalan per event | Alur refund berjalan dan tercatat | Perlu perbaikan | Tidak ada antarmuka pada ketiga peran pengguna (pengaturan kebijakan oleh penyelenggara, tombol pengajuan refund oleh pembeli, dan tab moderasi refund oleh admin). Endpoint `POST /api/events/bookings/[id]/refund` tanpa autentikasi membocorkan `guestToken` dan memungkinkan pembajakan rekening refund. Kursi yang di-refund gagal dipesan ulang di `createEventBooking`. |
| `S-15` | P3 | Dashboard penjualan penyelenggara versi awal | Penyelenggara login lalu dashboard tampil sesuai event miliknya | Perlu perbaikan | Perhitungan kapasitas total bentrok antara kartu ringkasan dan tabel jenis tiket. Tiket undangan gratis memicu badge `Habis` palsu. Reservasi `PENDING` diabaikan pada sisa kuota. File test baru gagal pada pemeriksaan `npx tsc --noEmit -p tests/tsconfig.json`. |
| `S-16` | P1 | Regression test Web Event dan dokumentasi serah terima | Dokumen diserahkan ke Ka Ari | Perlu perbaikan | Dokumen `docs/DOKUMENTASI_SERAH_TERIMA_WEB_EVENT_S16.md` menulis URL salah `/events/admin` sebanyak 5 kali, menulis panduan klik untuk tombol dan tab UI `S-12` sampai `S-14` yang tidak ada di kode, salah menjumlah tabel test (`371` tertulis `370`), dan melewatkan file gagal keempat `organizer-activation-hardening.test.ts`. |

---

## 2. Masalah kritis di Merge Request !25 dan konflik integrasi

Merge Request `!25` dari cabang `origin/shandi-dev` ke `develop` tidak boleh digabungkan dalam kondisi saat ini karena empat kategori penghalang utama berikut.

### 2.1 Celah keamanan finansial dan data pribadi

1. **Pembajakan refund tanpa autentikasi dan kebocoran `guestToken` (`src/app/api/events/bookings/[id]/refund/route.ts:16-91`)**
   Endpoint `GET` dan `POST` menerima kode tiket berurutan `DAGO-EVT-XXXXX` tanpa memeriksa sesi login maupun `guestToken`. Siapa pun dapat menebak kode tiket 5 digit, mengalihkan pencairan refund ke rekening miliknya, dan membaca objek `updatedBooking` utuh termasuk `guestToken`, `guestEmail`, `guestPhone`, serta `paymentProofUrl` pada baris `82`.
2. **Eskalasi hak akses lintas penyelenggara pada promo dan tiket undangan (`src/app/api/events/[id]/promos/route.ts:71` dan `src/app/api/events/[id]/invitations/route.ts:25`)**
   Kedua endpoint memanggil `assertOrganizerAuth(req, body.organizerEmail || event.organizerEmail)`. Penyelenggara komunitas B dapat mengirim email miliknya sendiri di `body.organizerEmail` ke ID event milik penyelenggara A untuk membuat promo diskon 100 persen atau menerbitkan tiket undangan VIP gratis di event penyelenggara A.
3. **Kebocoran seluruh kode promo rahasia ke publik (`src/lib/events.ts:1701-1713` dan `src/app/api/events/[id]/promos/route.ts:25-39`)**
   Fungsi `toPublicEvent` dan endpoint `GET` menyertakan seluruh kode promo aktif beserta besaran potongannya dalam JSON publik tanpa autentikasi.
4. **Pintu belakang pembukaan e-tiket tanpa email masih terbuka (`src/app/api/events/bookings/my/route.ts:80-180`)**
   Query `GET /api/events/bookings/my?email=X&phone=Y` dan `?ticketCode=X&email=Y` masih mengembalikan `guestToken` mentah di respons HTTP tanpa tautan email.
5. **Endpoint data member tanpa autentikasi (`src/app/api/loyalty/members/route.ts:16-203`)**
   Seluruh metode `GET`, `POST`, `PUT`, dan `DELETE` terbuka tanpa pemeriksaan sesi sehingga pihak tanpa login maupun Kasir dapat membaca nomor telepon, email, serta NIK lengkap atau mengubah tier secara langsung.

### 2.2 Fitur hanya dibangun di backend tanpa antarmuka pengguna

Tiga fitur utama pada milestone M3 dan M4 hanya memiliki fungsi domain dan route API tanpa komponen UI bagi pengguna akhir:
- `S-12` tidak memiliki form input jenis tiket bertingkat di `EventSubmissionForm.tsx`, `OrganizerRevisionDialog.tsx`, `EventEditModal.tsx`, maupun tampilan kurasi di `EventDetailSheet.tsx`.
- `S-13` tidak memiliki satu pun pemanggilan `fetch` ke `/api/events/[id]/promos` atau `/api/events/[id]/invitations` di seluruh direktori `src/`. Penyelenggara dan admin tidak dapat membuat kode promo atau menerbitkan tiket undangan dari layar aplikasi.
- `S-14` tidak memiliki pemilih kebijakan refund bagi penyelenggara, tidak memiliki tombol maupun dialog pengajuan refund di `/events/tickets/[token]/page.tsx`, dan tidak memiliki tab maupun dialog persetujuan refund di `/events-admin`.

### 2.3 Pelanggaran aturan `docs/DESIGN_SYSTEM.md` dan pemeriksaan tipe test

1. `src/features/events-admin/events-admin-domain.ts:57-90` belum menangani status `REFUNDED` pada `paymentStatusLabel` dan `paymentStatusTone`, sehingga string enum mentah `REFUNDED` bocor langsung ke layar pengguna.
2. `src/features/events-admin/EventAttendeesModal.tsx:252-256` menggunakan label bahasa Inggris `"Refunded"` dan `"Refund Req"`, melanggar aturan Bahasa Indonesia sentence case pada `docs/DESIGN_SYSTEM.md` bagian 8.
3. `src/features/events-portal/OrganizerHomeTab.tsx:171-209` dan `OrganizerEventDetailModal.tsx:160-205` memakai elemen HTML `<table>` mentah dan judul kolom Title Case (`"Jenis Tiket"`, `"Sisa Kuota"`), bukan komponen `<Table>` dari `@/components/ui/table` dengan sentence case (`"Jenis tiket"`, `"Sisa kuota"`).
4. `src/features/event-detail/EventTicketPassDialog.tsx:39, 190-235` menampilkan peringatan kuning `"QR check-in belum aktif"` dan `"Tiket menunggu verifikasi pembayaran"` tepat di bawah pemberitahuan tiket yang sudah di-refund karena hanya memeriksa `!isPaid`.
5. Pemeriksaan `npx tsc --noEmit -p tests/tsconfig.json` gagal pada file test baru (`tests/organizer-sales-dashboard.test.ts`, `tests/event-promo-and-invitations.test.ts`, `tests/event-refund-policy.test.ts`, dan `tests/events-portal-domain.test.ts`) akibat properti objek yang tidak sesuai definisi tipe `EventTicketTier`, `ProposedRevenueSplit`, `CommunityEvent`, dan `EventTicketOrder`.

### 2.4 Konflik merge antara `origin/shandi-dev` (MR !25) dan MR !26

Terhadap `origin/develop` (`a47354a`) saat ini, `origin/shandi-dev` tidak memiliki konflik git. Namun, segera setelah Merge Request `!26` (`feat/pos-closing-settlement-v17-v18`) digabungkan ke `develop`, terdapat irisan pada 4 file berikut:
1. `src/features/events-admin/EventAttendeesModal.tsx` mengalami **konflik git langsung** pada blok badge status bayar, badge kehadiran parsial, dan tombol aksi check-in di baris `238` sampai `295`.
2. `src/app/events/portal/page.tsx`, `src/features/events-portal/OrganizerAttendeesTab.tsx`, dan `src/features/events-portal/events-portal-domain.ts` tergabung otomatis di level baris git, tetapi mengalami **bentrok logika ekspor CSV** karena MR `!26` sudah menyatukan ekspor peserta ke filter tanggal WITA, sementara `shandi-dev` masih menyusun array CSV manual dengan kode enum mentah di `portal/page.tsx:507-532`.

Resolusi kode gabungan yang tepat untuk `EventAttendeesModal.tsx` dan `portal/page.tsx` disediakan secara utuh pada Bagian 4 Tahap 10.

---

## 3. Audit detail per task S-01 sampai S-16

### S-01. Ganti rekening DEMO dengan rekening resmi (P1)
- **Permintaan Excel**: Ganti rekening tujuan transfer `BRI 000011223344` atas nama `"PT DAGO CREATIVE HUB (DEMO)"` dari Event Admin > Pengaturan bisnis > Rekening resmi dan hapus banner demo agar halaman bayar serta e-tiket menampilkan rekening resmi tanpa peringatan demo.
- **Yang sudah dikerjakan (`2adb1c6`, `81c1f4c`)**: Menambahkan penyimpanan atomik rekening ke database, menghapus banner peringatan demo di dialog pembayaran, dan menambahkan penolakan otomatis (`fail-closed`) di `createEventBooking` apabila rekening tujuan masih terdeteksi sebagai rekening contoh.
- **Masalah yang ditemukan**:
  1. `data/event_settings.json:20-71`, `src/types/event.ts:463-506` (`DEFAULT_EVENT_BANK_ACCOUNTS`), dan `src/lib/events.ts:4863-4871` (`MANUAL_TRANSFER_BANK_ACCOUNTS`) masih menyimpan nomor `000011223344`, `000012345678`, dan `000098765432` atas nama `"PT DAGO CREATIVE HUB (DEMO)"`. Akibatnya, di luar mode test setiap pemesanan event berbayar gagal total dengan error `PEMBAYARAN_TERKENDALA` sampai admin mengganti data secara manual, sementara tiket `PENDING` lama tetap menampilkan rekening demo.
  2. `src/app/api/events/tickets/[token]/route.ts:106-117` mengembalikan `getEventBankAccounts().filter((b) => b.isActive)` tanpa menyaring `b.accountType === "PLATFORM"` dan `!isPlaceholderBankAccount(b)`. Rekening pencairan milik penyelenggara komunitas (`ORGANIZER`) ikut tampil sebagai rekening tujuan transfer pembeli tiket di `/events/tickets/[token]/page.tsx:239-244`.
  3. `src/features/events-admin/BankModal.tsx:111-120` menandai input `label` sebagai opsional, tetapi `buildCreateEventBankAccount` di `src/lib/events.ts:932` melempar error HTTP `400` saat `label` kosong.
  4. `src/features/events-admin/EventsSettingsView.tsx:43, 199-267` menerima prop `onToggleBankActive` tetapi tidak merender tombol aktif atau nonaktif, menampilkan tombol jadikan utama pada rekening nonaktif, mencampur rekening `ORGANIZER` ke tabel rekening platform (`events-admin/page.tsx:211`), memakai nilai `<NativeSelectOption value="PAYMENT_GATEWAY">` yang salah (seharusnya `"DOKU_CHECKOUT"` di baris `148`), dan membaca field riwayat yang salah (`h.timestamp`, `h.actorName`, `h.description` di baris `299-314` padahal tipe `EventBankAccountHistoryEntry` memakai `changedAt`, `changedBy`, `details`) sehingga seluruh baris riwayat menampilkan `Invalid Date`.

### S-02. Bersihkan event uji dan data uji (P1)
- **Permintaan Excel**: Tarik atau arsipkan event `"yjryuxrt`123"`, `"kfhjgdhsgfaf"`, `"Fixing Bug"`, `"[TEST QA 2]"`; hapus booking uji `DAGO-EVT-88221`, `DAGO-EVT-14704`; pastikan halaman event publik hanya berisi event asli.
- **Yang sudah dikerjakan (`bbe5ea5`, `81c1f4c`)**: Membuat endpoint hapus event dan booking beserta `scripts/cleanup-test-events.ts`.
- **Masalah yang ditemukan**:
  1. `data/events.json:51-89` masih memuat `evt-1793935470095-8vpsm` berjudul `"[TEST QA 2] Uji Revisi MVP1 - Abaikan"` dengan status `"APPROVED"` sehingga masih tampil di katalog publik `/events`. Event `evt-pilates-gift-voucher` (`baris 744-769`) juga masih memuat akhiran `"(Tes 1)"`, ditambah beberapa event `PENDING` uji (`evt-1794204831538-jjg02` oleh `eventstaff@dagoeng.com`, `"sdfghjkl;;;;"`, `"TEST"`, `"cek sans 1"`, `"Cek 1234567890"`) dan belasan tiket uji di `data/event_bookings.json`.
  2. `getApprovedEvents` (`src/lib/events.ts:1741-1744`) dan `getPublicEventById` (`src/lib/events.ts:2075-2079`) tidak memeriksa `!e.isTestData`.
  3. `scripts/cleanup-test-events.ts:22-65, 108-123` tidak memanggil `syncStorageFromDb` sebelum pembersihan, melewatkan pencocokan judul `"yjryuxrt`123"`, `"kfhjgdhsgfaf"`, `"fixing bug"`, serta kode tiket `DAGO-EVT-88221` dan `DAGO-EVT-14704`, dan membiarkan event uji tetap berstatus `"APPROVED"` apabila event tersebut telanjur memiliki booking lunas (seharusnya diubah menjadi `status: "ARCHIVED"` dan `isTestData: true`).
  4. Antarmuka admin tidak memiliki tombol hapus booking uji (`DELETE /api/events/bookings/[id]` tidak dipanggil di mana pun pada `src/`), serta menyembunyikan tombol hapus event pada event berstatus `PENDING` di `EventDetailSheet.tsx:211-311`.

### S-03. Validasi harga, kuota, dan role pengaju event (P1)
- **Permintaan Excel**: Harga tiket bilangan bulat rupiah (tolak `Rp 0,9`), kuota bilangan bulat dengan batas wajar (tolak `1e+58`), dan akun Petugas Check-In (`CHECKIN_STAFF`) dilarang mengajukan event di frontend maupun API langsung.
- **Yang sudah dikerjakan (`9a1ecb2`)**: Menambahkan modul `src/lib/event-validation.ts` dan pengecekan peran dasar di `/events/submit` serta `POST /api/events`.
- **Masalah yang ditemukan**:
  1. `assertOrganizerAuth` (`src/lib/server-auth.ts:559-670`) dan `PUT /api/events/portal` (`src/app/api/events/portal/route.ts:103-135`) tidak menolak `isCheckInStaffRole(auth.role)`. Selain itu, karena `eventstaff@dagoeng.com` berada di `TRUSTED_PERSONAS` dan belum tercatat di `unified_users.json`, request `POST /api/events` tanpa cookie sesi yang mengirim `organizerEmail: "eventstaff@dagoeng.com"` lolos dari baris `107-118` di `src/app/api/events/route.ts` dan berhasil membuat event baru dengan HTTP `201`. Halaman `/events/portal/page.tsx` juga belum memblokir tampilan pengajuan untuk `CHECKIN_STAFF`.
  2. Field `ticketTiers` dari `S-12` disimpan mentah di `validateEventSubmission`, `createEventSubmission`, `updateEventDetails`, dan `organizerResubmitEvent` tanpa validasi `validateEventPrice` maupun `validateEventCapacity`, sehingga harga `0.9` dan kuota `1e+58` di dalam tier diterima penuh oleh server.
  3. `OrganizerRevisionDialog.tsx:199-206` tidak memiliki atribut `max={1000}` dan `step={1}`, tidak memiliki validasi sisi klien di `portal/page.tsx:273-300`, dan `organizerResubmitEvent` (`src/lib/events.ts:5326-5347`) melewati pemeriksaan keamanan URL `isSafePublicUrl` serta urutan tanggal.
  4. `EventEditModal.tsx:142, 160, 167-171` langsung mengembalikan angka `30` saat kolom kuota dikosongkan dan menelan input tidak valid seperti `0.9` atau `1500` tanpa menampilkan pesan error yang jelas.

### S-04. Nomor WhatsApp CS resmi di semua halaman (P2)
- **Permintaan Excel**: Gunakan satu variabel konfigurasi untuk nomor CS resmi dan pastikan tidak ada lagi nomor contoh di seluruh situs.
- **Yang sudah dikerjakan (`9fefce9`)**: Mengubah nomor CS di `landing-content.ts` dan halaman pemulihan tiket ke `+62 821-1550-1995`.
- **Masalah yang ditemukan**:
  1. Konfigurasi nomor CS belum terpusat di satu modul bersama; string `"+62 821-1550-1995"` masih ditulis berulang di `landing-content.ts:89`, `receipt-publisher.ts:20, 60`, dan `ReceiptModal.tsx:130`.
  2. Halaman beranda publik baru (`src/features/landing/home/home-content.ts:14-22` dan `HomeLanding.tsx`) tidak mengimpor `CONTACT.phone`, sehingga beranda publik sama sekali tidak menampilkan kontak WhatsApp CS resmi. Footer email konfirmasi tiket (`src/lib/email.ts:132`) juga menyebut WhatsApp CS tanpa menyertakan nomor maupun tautannya.
  3. Nomor contoh masih aktif di berbagai fitur operasional: `src/app/(dashboard)/employees/page.tsx:367` (`managerPhone="+62 812-3456-7890"`), `src/features/employees/employees-domain.ts:433-434` (`"+62 812-3344-5566"`), `src/features/pos/CashDrawerShiftModal.tsx:55` (`"081234567890"` yang otomatis ditembak setiap tutup shift POS dari `pos/page.tsx:1542`), `src/app/(dashboard)/settings/page.tsx:174`, `src/lib/tenant.ts:195, 266`, `src/lib/doku.ts:260`, `src/lib/organizers.ts:163`, dan `src/lib/unified-account.ts:315`.

### S-05. Lupa kode booking kirim lewat email (P1)
- **Permintaan Excel**: Sistem mengirim kode booking dan tautan e-tiket ke email pemesan, halaman hanya menampilkan `"cek email Anda"`, dan e-tiket tidak terbuka tanpa tautan dari email.
- **Yang sudah dikerjakan (`c539194`)**: Membuat endpoint `POST /api/events/bookings/recover` dan komponen `TicketRecoveryConfirmationCard`.
- **Masalah yang ditemukan**:
  1. Endpoint lama `GET /api/events/bookings/my` (`src/app/api/events/bookings/my/route.ts:80-180`, baris `114` dan `171`) **masih mengembalikan `guestToken` mentah** secara langsung ketika dipanggil tanpa autentikasi dengan `?email=X&phone=Y` atau `?ticketCode=X&email=Y`. Celah utama yang diminta ditutup oleh `S-05` masih terbuka lebar di API.
  2. `sendTicketRecoveryEmail` (`src/lib/email.ts:275-319`) adalah fungsi stub yang tidak menyusun isi HTML email dan tidak mengirim email ke mana pun, tetapi mengembalikan `sent: true` saat variabel env diset. Selain itu, `recover/route.ts:111, 308` mengabaikan nilai kembalian `sendTicketRecoveryEmail`.
  3. `src/app/events/tickets/recovery/page.tsx:46, 56` menetapkan `"whatsapp"` sebagai kanal bawaan, dan `recover/route.ts:219-283` pada mode `forgot_code` dengan kanal `whatsapp` bahkan mengizinkan pengiriman tautan tiket hanya bermodalkan nomor telepon tanpa memverifikasi email pemesan.
  4. `recover/route.ts:54-59` menyusun `baseUrl` dari header `Origin` atau `X-Forwarded-Host` yang dapat dipalsukan penyerang untuk mencuri `guestToken` lewat tautan pemulihan, serta baris `340` dan `342` membocorkan apakah email terdaftar lewat boolean `dispatched: userBookings.length > 0`.

### S-06. Meja check-in hanya untuk event hari ini (P2)
- **Permintaan Excel**: Perbaiki logika tanggal WITA sehingga hanya event yang berlangsung hari itu yang muncul, serta event lampau dan mendatang tidak bisa dipilih.
- **Yang sudah dikerjakan (`2a7e05d`)**: Menambahkan fungsi `filterTodayEventsWita` di `events-checkin-domain.ts` dan menyaring dropdown di `/events/checkin/page.tsx`.
- **Masalah yang ditemukan**:
  1. Penyelenggara komunitas yang membuka `/events/checkin` gagal memuat daftar peserta karena `checkin/page.tsx:68` memanggil `GET /api/events/bookings` tanpa `eventId`, sementara `assertCheckInAuth(req)` di `bookings/route.ts:24` menolak penyelenggara apabila `eventId` bernilai `undefined` (HTTP `403`).
  2. Di sisi backend, `updateBookingCheckIn` (`src/lib/events.ts:4426-4459`) dan `organizerCheckInAttendee` (`src/lib/events.ts:5219-5232`) masih memakai jendela `[start - 2 jam, end + 12 jam]` dengan fallback `end = start + 24 jam` (total hingga 36 jam setelah acara mulai), tidak membatasi durasi `endDate` korup lebih dari 7 hari, dan mematikan validasi tanggal saat mereset kehadiran (`reset: true`).
  3. Di portal penyelenggara (`/events/portal`), `OrganizerHomeTab.tsx:293-296` mengaktifkan tombol `"Mulai check-in"` untuk event masa depan, `OrganizerQRScannerDialog.tsx` tidak menyaring event ke hari ini WITA, mengabaikan prop `selectedEventId`, dan **selalu mengalami crash `TypeError` pada baris `219-224`** setiap kali scan berhasil karena membaca `json.booking` padahal `PATCH /api/events/portal/check-in` mengembalikan `json.data`.
  4. Di panel admin (`/events-admin`), `EventAttendeesModal.tsx:271-294` masih mengizinkan klik `"Tandai hadir"` untuk event lampau, event mendatang, maupun tiket yang belum lunas (`PENDING`).

### S-07. Uji end-to-end event berbayar (P1)
- **Permintaan Excel**: Uji alur pesan tiket dengan rekening resmi, upload bukti, verifikasi admin, e-tiket aktif, check-in di hari acara, hingga penolakan scan kedua pada kode yang sama, lalu dokumentasikan dengan screenshot di dokumen test case.
- **Yang sudah dikerjakan (`d977ab4`)**: Menulis `tests/paid-event-e2e.test.ts` dan `docs/test-cases/TC-S07-PAID-EVENT-E2E.md`.
- **Masalah yang ditemukan**:
  1. Dokumen `docs/test-cases/TC-S07-PAID-EVENT-E2E.md:72` tidak memiliki satu pun screenshot dan secara tertulis menyatakan cek visual browser belum dilakukan.
  2. Pengujian otomatis hanya memanggil fungsi internal `src/lib/events.ts`, sehingga melewatkan empat bug nyata pada lapisan API dan halaman web:
     - `GET /api/events/tickets/[token]/route.ts:96-98` tidak menyertakan `checkedInSeats`, `seatCheckInTimes`, dan `paymentRejectionReason`. Jika peserta kursi `-02` masuk lebih dulu daripada `-01`, halaman `/events/tickets/[token]/page.tsx:86` salah menandai kursi `-01` yang hadir, dan alasan penolakan bukti bayar tidak pernah tampil ke pembeli.
     - `src/app/events/tickets/[token]/page.tsx:227-237` tidak mengirim `eventId: ticket.eventId` ke `getSubTicketDetails`, menghasilkan `"eventId": ""` di dalam QR peserta.
     - `src/app/events/checkin/page.tsx:203-206` menangkap error dari server di dalam `handleCheckIn` tanpa melempar ulang error tersebut, sehingga `EventCheckInScannerDialog.tsx:190-208` tetap memutar bunyi sukses dan menampilkan pesan hijau `"Check-in dicatat"` saat scan kedua ditolak server.
     - `EventCheckInScannerDialog.tsx:241` memanggil `.toUpperCase()` pada teks JSON hasil scan sebelum `JSON.parse`, merusak pembacaan properti camelCase `ticketCode`.

### S-08. Kirim e-tiket lewat email setelah lunas (P2)
- **Permintaan Excel**: Setelah tiket gratis terkonfirmasi atau tiket berbayar diverifikasi, kirim email berisi e-tiket dan QR per peserta sehingga pembeli menerima email dalam 1 menit.
- **Yang sudah dikerjakan (`bf020ba`)**: Menambahkan generator HTML tiket `generatePaidTicketEmailHtml` di `src/lib/email.ts` dan pemanggilan `dispatchPaidTicketEmail` di `src/lib/events.ts`.
- **Masalah yang ditemukan**:
  1. `sendTicketConfirmationEmail` (`src/lib/email.ts:144-204`) sama sekali belum terhubung ke `nodemailer`, Resend, maupun SendGrid. Saat env `SMTP_*` atau `RESEND_API_KEY` diisi, blok `try` di baris `188-195` langsung mengembalikan `sent: true` tanpa melakukan pengiriman apa pun.
  2. Webhook pembayaran DOKU (`src/app/api/webhooks/doku/route.ts:106-127` dan `src/app/api/webhooks/doku/simulate/route.ts:215-228`) belum memanggil `dispatchPaidTicketEmail` saat transaksi menjadi `PAID`.
  3. `updateBookingPaymentStatus` (`src/lib/events.ts:4762`) mengirim ulang email meskipun status tiket sebelumnya sudah `PAID`, tidak menunggu (`await`) penyelesaian pengiriman dengan batas waktu aman, tidak melakukan HTML escaping pada input nama/judul di `generatePaidTicketEmailHtml` (`src/lib/email.ts:78-138`), dan menggantungkan gambar QR pada layanan pihak ketiga eksternal `api.qrserver.com` alih-alih lampiran inline CID hasil render lokal.

### S-09. Hak akses data pelanggan untuk Kasir dan tier member (P2)
- **Permintaan Excel**: Sembunyikan tombol Ekspor untuk Kasir, samarkan kontak nomor HP dan email, serta hitung tier member dari poin (contoh `Ketut Dian` dengan 55 poin masuk Bronze, bukan Silver).
- **Yang sudah dikerjakan (`cfc702a`)**: Menyembunyikan tombol Ekspor di `CustomersToolbar.tsx`, menyamarkan kontak di tabel `/customers`, dan mengubah data awal `Ketut Dian` di `master-data-defaults.ts`.
- **Masalah yang ditemukan**:
  1. Pada halaman kerja utama Kasir (`/pos` mode coworking), dropdown pilihan member di `src/features/pos/CoworkingBookingPanel.tsx:341-345` masih menampilkan nomor telepon member secara utuh tanpa penyamaran.
  2. Endpoint `/api/loyalty/members/route.ts:16-203` tidak memeriksa autentikasi sama sekali, mengembalikan telepon, email, dan `identityNo` utuh ke Kasir (yang juga disimpan utuh ke `localStorage` oleh `LoyaltyContext.tsx:76, 104`), serta mengizinkan `PUT` dan `DELETE` tanpa pembatasan peran.
  3. Server (`getPersistentLoyaltyMembers` di `src/lib/persistent-storage.ts:531-538`, serta `POST` dan `PUT` di `/api/loyalty/members/route.ts:93, 149`) tidak menghitung ulang tier dari poin, sehingga data lama `Ketut Dian` yang sudah tersimpan di database Neon tetap terbaca `Silver`, dan member baru dengan `initialPoints: 600` tetap tersimpan `Bronze`.
  4. `LoyaltyContext.tsx:56, 85` mengecek `.some((th) => th.isManualOverride)` pada seluruh riwayat, bukan hanya entri terbaru `tierHistory?.[0]?.isManualOverride`.
  5. `AddCustomerModal.tsx:146-162` masih mengizinkan Kasir mengisi `initialPoints` bebas (misalnya `5000` poin agar langsung `Platinum`), `filterMembers` (`customers-domain.ts:68-87`) masih mencari pada digit kontak yang disembunyikan, dan rute `/customers` belum terdaftar di `ROUTE_PERMISSIONS` (`src/lib/route-guard.ts`) maupun sidebar `CASHIER` (`src/lib/rbac.ts:180`).

### S-10. Booking co-working tanggal WITA dan nota resmi (P2)
- **Permintaan Excel**: Tanggal default booking memakai hari ini WITA, nota memakai alamat dan kontak resmi (bukan `Jl. Ngurah Rai No. 45, (0362) 23456`), dan label pajak konsisten antara form dan nota.
- **Yang sudah dikerjakan (`8d611a4`)**: Menambahkan `getTodayWitaDateString` dan menyelaraskan alamat di `receipt-publisher.ts` serta label pajak di panel POS coworking.
- **Masalah yang ditemukan**:
  1. Halaman portal pelanggan `src/app/(mobile)/customer/page.tsx:377-381, 476-504` tidak memakai `resolveCoworkingReceiptPublisher`, sehingga fallback `outletPhone` kosong `""` dan rincian pajak tidak dikirim ke nota.
  2. `src/features/employees/employees-domain.ts:433-434` masih menulis alamat palsu `"Jl. Ngurah Rai No. 45, Singaraja, Bali"` dan telepon contoh `"+62 812-3344-5566"` pada laporan PDF tutup shift.
  3. Baris label pajak (`Pajak (bebas PB1)` `Rp 0` atau pajak aktif) belum muncul di `NewBookingModal.tsx:558-576`, `CustomerBookingModal.tsx:305-323`, dan `SpaceView.tsx:215-218`, serta hilang saat pembayaran QRIS coworking disetujui di `pos/page.tsx:1081-1110` dan `coworking/page.tsx:253-257`.
  4. `CoworkingReceiptModal.tsx:205` menambahkan akhiran `"WITA"` pada string jam yang sudah berakhiran `"WITA"` dari `NewBookingModal` dan `customer/page.tsx`, menghasilkan cetakan `"09:00 WITA s/d 11:00 WITA WITA"`.
  5. Perhitungan `computedEndDate` di `coworking-domain.ts:108-121, 137-139` masih mencampur `new Date(startDate)`, `.setDate()`, dan `.toISOString().split("T")[0]` yang dapat meleset 1 hari menurut zona waktu server, sementara `getCurrentTimeFormatted` di `pos-coworking.ts:26-31` belum memakai zona waktu `Asia/Makassar`.

### S-11. Produk dan margin konsisten (P2)
- **Permintaan Excel**: Perbaiki sumber data laporan Produk dan margin agar menampilkan menu terjual dari pesanan lunas saja dan tidak menampilkan kontradiksi `"0 menu terdaftar"` dengan produk `"Paling laris"`.
- **Yang sudah dikerjakan (`0734e8f`)**: Menyaring `paymentStatus === "PAID"` pada `findTopProduct` dan menyertakan produk global di `reports/page.tsx`.
- **Masalah yang ditemukan**:
  1. Tabel laporan `PRODUCTS` di `src/features/reports/reports-domain.ts:516-557` masih hanya menampilkan katalog statis (`SKU`, `Menu`, `Kategori`, `Harga jual`, `Estimasi HPP`, `Margin kotor`, `Margin %`) tanpa menampilkan jumlah unit terjual dan omzet per menu dari pesanan lunas.
  2. `findTopProduct` (`reports-domain.ts:331-350, 536`) masih menghitung pesanan yang telah di-refund (`order.refundedAt` terisi) maupun pesanan gagal sinkronisasi (`order.syncStatus === "REJECTED"`), serta tetap menampilkan produk terlaris walau daftar `products` bernilai kosong (`0 menu`).
  3. Pada cabang `origin/shandi-dev`, `src/app/(dashboard)/reports/page.tsx:65-84` belum menyaring pesanan berdasarkan rentang tanggal aktif (`isDateInRange`) maupun cakupan mitra `TENANT` (catatan: penyaringan tanggal `isDateInRange` sudah dikerjakan di MR `!26`, pastikan diselaraskan saat rebase ke `develop`).
  4. `src/app/(dashboard)/ai-insight/page.tsx:55-57, 100` yang ikut diubah pada commit `S-11` masih mengunci `const topMenu = scopedProducts[0]?.name || "Menu terlaris"` sehingga tetap menampilkan `"Kopi Senja Aren"` sebagai menu terlaris ketika pesanan lunas berjumlah nol, serta menghitung pesanan `PENDING` dan `REFUNDED` ke dalam pendapatan.

### S-12. Jenis tiket bertingkat (P2)
- **Permintaan Excel**: Satu event bisa memiliki beberapa jenis tiket (`Early Bird`, `Reguler`, `VIP`) dengan harga, kuota, dan periode jual masing-masing; pembeli memilih jenis tiket dan kuota per jenis berkurang dengan benar.
- **Yang sudah dikerjakan (`d318273`)**: Menambahkan tipe `EventTicketTier`, perhitungan ketersediaan tier di `src/lib/events.ts`, dan pemilih tier untuk pembeli di `EventBookingDialog.tsx` serta `EventDetailSidebar.tsx`.
- **Masalah yang ditemukan**:
  1. **Tidak ada UI pembuatan atau pengeditan tier**: Penyelenggara maupun admin tidak memiliki form untuk menambah atau mengubah `ticketTiers` di `EventSubmissionForm.tsx`, `OrganizerRevisionDialog.tsx`, `EventEditModal.tsx`, maupun pratinjau moderasi di `EventDetailSheet.tsx`.
  2. **API membuang `ticketTiers`**: `PUT /api/events/[id]/route.ts:87-102` tidak memasukkan `ticketTiers` ke dalam `allowedUpdates`, dan `organizerResubmitEvent` (`src/lib/events.ts:5326-5347`) tidak menyimpan perubahan `ticketTiers`.
  3. **Tanpa validasi server dan tanpa kunci kuota saat edit**: `ticketTiers` tidak divalidasi harga bulat, batas kuota `1..1000`, urutan tanggal jual WITA, maupun perlindungan terhadap penghapusan tier atau pengurangan kuota di bawah jumlah tiket yang sudah dipesan pada `updateEventDetails` (`src/lib/events.ts:2535-2548`).
  4. **Pengurangan kuota salah pada kursi refund dan tanpa `maxCapacity`**: `createEventBooking` (`src/lib/events.ts:3990`) belum mengecualikan `b.paymentStatus !== "REFUNDED"` dan pada baris `4028` memanggil `getEventCapacity(event)` yang jatuh ke estimasi ruangan kecil (`25` atau `50`) ketika `event.maxCapacity` kosong walau total kuota tier masih tersedia.
  5. **Label `"Gratis"` palsu dan bug tombol beli**: Katalog `/events` (`events-catalog-domain.ts:62-86`), halaman utama (`landing-logic.ts:81`), halaman detail (`events/[id]/page.tsx:222, 413`), dan tabel admin hanya memeriksa `event.isPaid` serta `event.price` tanpa memeriksa `event.ticketTiers`. Selain itu, ketika seluruh tier masih berstatus `UPCOMING`, `getEventTicketAvailability` (`events.ts:1892`) menandai `isSoldOut = true` sehingga sidebar menulis `"Tiket habis terjual"`, sementara `EventBookingDialog.tsx:69` memilih otomatis `tiers[0]` meskipun sudah habis atau belum dibuka.

### S-13. Kode promo per event dan tiket undangan (P2)
- **Permintaan Excel**: Penyelenggara atau admin membuat kode promo (persen atau nominal, kuota, masa berlaku) dan menerbitkan tiket undangan gratis; kode promo memotong harga dan tiket undangan bisa di-scan.
- **Yang sudah dikerjakan (`ef0969f`)**: Menambahkan fungsi backend `createEventPromoCode`, `validateAndCalculatePromoDiscount`, `createInvitationTicket`, route `/promos` dan `/invitations`, serta input kode promo pada `EventBookingDialog.tsx`.
- **Masalah yang ditemukan**:
  1. **Tidak ada UI manajemen promo dan tiket undangan**: Tidak ada satu pun komponen di `/events/portal` maupun `/events-admin` yang memanggil `/api/events/[id]/promos` atau `/api/events/[id]/invitations`.
  2. **Celah keamanan IDOR lintas penyelenggara**: `promos/route.ts:71` dan `invitations/route.ts:25` memakai `body.organizerEmail || event.organizerEmail` pada `assertOrganizerAuth`, sedangkan `createInvitationTicket` (`src/lib/events.ts:3386-3388`) membiarkan blok pemeriksaan kepemilikan kosong (`// Reserved for authorization`).
  3. **Kebocoran kode promo rahasia dan pratinjau diskon salah di klien**: `toPublicEvent` (`src/lib/events.ts:1701-1713`) dan `GET /api/events/[id]/promos` (`baris 25-39`) mengekspos seluruh daftar kode promo aktif ke publik. Sementara itu, pratinjau diskon di `EventBookingDialog.tsx:98-124` tidak memeriksa masa berlaku maupun sisa kuota sehingga menampilkan centang hijau `"Hemat Rp ..."` untuk kode kedaluwarsa atau habis sebelum akhirnya gagal saat tombol pesan ditekan.
  4. **Kuota promo hangus permanen (DoS), bug `quota: 0`, dan zona waktu WITA**: `usedCount` langsung ditambah saat pesanan `PENDING` dibuat (`events.ts:4079`) tetapi tidak pernah dikembalikan saat pesanan kedaluwarsa, dibatalkan, dihapus, atau di-refund. Nilai `quota: 0` tertimpa menjadi `100` karena operator `|| 100` di `events.ts:3310, 3327`. Tanggal `validFrom` dan `validUntil` disimpan tanpa normalisasi WITA `+08:00`. Fungsi `createInvitationTicket` (`baris 3392`) juga belum mengecualikan `REFUNDED` dan belum menulis `appendAuditLog`.
  5. **Penanda tiket undangan hilang di e-tiket privat dan meja check-in**: Halaman `/events/tickets/[token]` dan meja check-in `/events/checkin` belum menampilkan badge `"Tiket undangan"` maupun catatan undangan.

### S-14. Kebijakan refund atau pembatalan per event (P3)
- **Permintaan Excel**: Penyelenggara memilih kebijakan (`tidak bisa refund` atau `refund sampai H-x`), pembeli mengajukan refund, dan admin memproses sehingga alur refund berjalan dan tercatat.
- **Yang sudah dikerjakan (`5237d1b`)**: Menambahkan fungsi backend `validateTicketRefundEligibility`, `requestTicketRefund`, `adminProcessTicketRefund`, serta route `/api/events/bookings/[id]/refund` dan `/api/events/admin/refunds`.
- **Masalah yang ditemukan**:
  1. **Tidak ada UI pada ketiga aktor**: Tidak ada input kebijakan refund saat membuat, merevisi, atau mengedit event; tidak ada tombol dan form rekening pengajuan refund bagi pembeli di `/events/tickets/[token]/page.tsx` maupun `EventTicketPassDialog.tsx`; dan tidak ada tab maupun dialog persetujuan/penolakan refund bagi admin di `/events-admin`.
  2. **Celah keamanan pembajakan refund dan kebocoran `guestToken`**: `GET` dan `POST /api/events/bookings/[id]/refund` (`src/app/api/events/bookings/[id]/refund/route.ts:16-91`) berjalan tanpa autentikasi, menerima kode tiket 5 digit yang mudah ditebak, dan mengembalikan `guestToken` rahasia beserta data pribadi pemesan di JSON respons.
  3. **Kursi yang telah di-refund tidak dapat dipesan kembali**: `createEventBooking` (`src/lib/events.ts:3990`) dan `createInvitationTicket` (`baris 3392`) masih menghitung tiket berstatus `REFUNDED` sebagai kursi terpakai, sehingga pembeli berikutnya ditolak meskipun indikator kuota publik menampilkan kursi tersedia.
  4. **Bahaya saldo minus pasca pencairan dana penyelenggara**: `adminProcessTicketRefund` (`src/lib/events.ts:3753-3835`) menyetujui refund tanpa memeriksa apakah dana bagi hasil event tersebut sudah terlanjur dicairkan (`PAID`) atau sedang diproses (`PROCESSING`) ke penyelenggara, sementara `processOrganizerPayout` (`src/lib/events.ts:5815`) tidak memvalidasi ulang saldo bersih terbaru setelah dikurangi tiket `REFUNDED`.
  5. **Tidak tercatat di audit trail dan pelanggaran state guard**: `requestTicketRefund` dan `adminProcessTicketRefund` sama sekali tidak memanggil `appendAuditLog`, `admin/refunds/route.ts:71` selalu mencatat email `"admin@dagoeng.com"` karena `assertEventAdmin` belum mengembalikan `email`, `deleteEventBooking` (`baris 4804`) dan `adminApproveBookingPayment` (`baris 4959`) belum memblokir tiket `REFUNDED`, serta meja check-in belum mengunci tombol check-in pada tiket berstatus `refundStatus === "REQUESTED"`.

### S-15. Dashboard penjualan penyelenggara versi awal (P3)
- **Permintaan Excel**: Penyelenggara melihat tiket terjual per jenis, pendapatan, sisa kuota, dan daftar peserta sesuai event miliknya saat login.
- **Yang sudah dikerjakan (`376bd4c`)**: Menambahkan `calculateEventSalesSummary` di `events-portal-domain.ts`, tabel ringkasan per tier di `OrganizerHomeTab.tsx` dan `OrganizerEventDetailModal.tsx`, serta kolom jenis tiket di `OrganizerAttendeesTab.tsx`.
- **Masalah yang ditemukan**:
  1. `calculateEventOccupancy` (`events-portal-domain.ts:142`) memakai `resolveVenueCapacity(event).capacity`, sedangkan `calculateEventSalesSummary` (`baris 290-291`) menimpa `totalCapacity` dengan jumlah kuota tier tanpa menghormati `event.maxCapacity`, menyebabkan dua angka kapasitas berbeda tampil berdampingan pada layar yang sama.
  2. Tiket undangan gratis (`isInvitation: true`, `paymentStatus: "PAID"`, `totalPrice: 0`) digabung ke tiket terjual berbayar, dan apabila tidak memiliki `ticketTierId`, baris sintetis `"Tiket Undangan"` (`baris 340-350`) diberi `isSoldOut: true` sehingga merender badge merah `"Habis"` palsu.
  3. Reservasi aktif yang masih `PENDING` tidak dikurangkan dari `remainingQuota` dan `remainingCapacity` pada dashboard penyelenggara, bertolak belakang dengan perhitungan sisa kuota di halaman pembeli.
  4. Fallback bagi hasil di `events-portal-domain.ts:117, 285, 314, 337` mengunci angka `0.8` alih-alih `resolveOrganizerSharePercent(event) / 100`, dan `OrganizerEventDetailModal.tsx:65` menghitung ulang persentase dari total kotor alih-alih memakai `salesSummary.organizerEarnings`.
  5. Pelanggaran komponen `<Table>`, copy sentence case, kebocoran enum `REFUNDED`, duplikasi ekspor CSV mentah di `portal/page.tsx:507-532`, serta error TypeScript pada `tests/organizer-sales-dashboard.test.ts`.

### S-16. Regression test Web Event dan dokumentasi serah terima (P1)
- **Permintaan Excel**: Jalankan ulang test case Web Event, tulis dokumentasi fitur, akun test, dan bug tersisa untuk diserahkan ke Ka Ari.
- **Yang sudah dikerjakan (`bec02d1`)**: Menulis `docs/DOKUMENTASI_SERAH_TERIMA_WEB_EVENT_S16.md`.
- **Masalah yang ditemukan**:
  1. Menulis URL yang salah **`/events/admin`** sebanyak 5 kali (`baris 104, 160, 200, 211, 220`). Rute yang benar adalah **`/events-admin`**; membuka `/events/admin` akan masuk ke rute dinamis `/events/[id]` dengan `id = "admin"` dan menampilkan event tidak ditemukan.
  2. Bagian 3 (`baris 90-105`), Bagian 5 (`baris 158-167`), dan Bagian 7 (`baris 192-221`) mendokumentasikan langkah klik tombol dan tab UI untuk `S-12`, `S-13`, dan `S-14` yang **sama sekali tidak ada di kode** (menambah tier di **Ajukan Event**, memilih kebijakan refund H-3, klik **Ajukan Refund / Pembatalan Tiket** di `/events/tickets/[token]`, dan membuka tab **Pengajuan Refund**), serta salah menulis nama tab dan tombol yang ada (`Moderasi` ditulis `Moderasi Event`, `Pembayaran tiket` ditulis `Verifikasi Pembayaran`).
  3. Tabel matriks regresi Bagian 4 (`baris 119-145`) salah menulis jumlah test pada 4 file (`events-checkin-domain.test.ts` aktual `29` ditulis `16`, `critical-checkin-bugfixes.test.ts` aktual `9` ditulis `12`, `event-ticket-tiers.test.ts` aktual `8` ditulis `14`, `event-promo-and-invitations.test.ts` aktual `11` ditulis `16`), dan penjumlahan angka yang tercetak di tabel menghasilkan **`371`**, bukan **`370`**.
  4. Bagian 6.2 (`baris 178-180`) mengklaim pengiriman email siap berjalan begitu `SMTP_HOST`, `SMTP_USER`, dan `SMTP_PASS` diisi, padahal `src/lib/email.ts` belum memiliki implementasi SMTP.
  5. Bagian 6.3 (`baris 182-184`) hanya menyebut 3 file test gagal baseline dan mengklaim semuanya di luar Web Event, padahal sesuai `AGENTS.md` terdapat **4** file baseline gagal (kurang `tests/organizer-activation-hardening.test.ts` yang justru menguji Web Event).

---

## 4. Panduan perbaikan lengkap untuk AI agent (satu putaran tanpa revisi)

Ikuti aturan wajib repositori selama mengerjakan perbaikan ini:
- Baca `AGENTS.md`, `docs/REDESIGN_HANDOFF.md`, `docs/REDESIGN_PLAYBOOK.md`, dan `docs/DESIGN_SYSTEM.md` bagian 7 serta 8 sebelum mengubah komponen UI.
- Jangan mengubah file di `src/components/ui/*` (kecuali `ui/button.tsx` bila sangat terpaksa, dan tidak diperlukan untuk perbaikan ini). Jangan mengimpor dari `components/legacy`.
- Jangan memakai warna palet Tailwind mentah (`bg-amber-500`, `text-emerald-600`, `border-red-200`) atau class `dark:*`. Gunakan komponen shadcn (`Dialog`, `Table`, `Badge`, `Button`, `Input`, `Label`, `NativeSelect`, `Tabs`, `Alert`) dan `StatusBadge` dari `@/components/app/status-badge`.
- Gunakan Bahasa Indonesia sentence case di seluruh judul, label, header tabel, tab, badge, dan tombol (`Pengajuan refund`, `Jenis tiket`, `Sisa kuota`, `Dikembalikan`, bukan `Pengajuan Refund`, `Jenis Tiket`, `Refunded`).
- Jangan menekan aksi tulis di browser apabila `DATABASE_URL` mengarah ke database produksi Neon. Gunakan database lokal/test terisolasi saat mengambil screenshot uji `S-07`.
- Jangan melemahkan atau menghapus test yang sudah ada. Perbarui asersi test hanya pada bagian pintu belakang keamanan yang memang wajib ditutup (`GET /api/events/bookings/my` tanpa token).

Kerjakan perbaikan secara berurutan dari **Tahap 1** sampai **Tahap 10** di bawah ini.

### Tahap 1. Sentralisasi kontak resmi (`S-04`, `S-10`) dan rekening resmi (`S-01`)

1. **Buat modul tunggal `src/lib/contact-config.ts`**:
   Ekspor konstanta dan fungsi berikut sebagai satu-satunya sumber kebenaran kontak dan alamat resmi:
   ```ts
   export const OFFICIAL_HUB_NAME = "Dago Creative Hub";
   export const OFFICIAL_HUB_OUTLET_NAME = "Singaraja (Pusat)";
   export const OFFICIAL_HUB_ADDRESS =
   	"Jl. Teleng No. 1, Banyuasri, Kec. Buleleng, Kabupaten Buleleng, Bali 81116";
   export const OFFICIAL_CS_DISPLAY_PHONE =
   	process.env.NEXT_PUBLIC_CS_PHONE_DISPLAY?.trim() || "+62 821-1550-1995";

   export function normalizeWhatsAppDigits(phone: string): string {
   	const digits = (phone || "").replace(/\D/g, "");
   	if (digits.startsWith("08")) return `62${digits.slice(1)}`;
   	if (digits.startsWith("8")) return `62${digits}`;
   	return digits;
   }

   export const OFFICIAL_CS_WHATSAPP_NUMBER = normalizeWhatsAppDigits(
   	process.env.NEXT_PUBLIC_CS_WHATSAPP || OFFICIAL_CS_DISPLAY_PHONE
   );

   export function buildOfficialCsWhatsAppUrl(message?: string): string {
   	const base = `https://wa.me/${OFFICIAL_CS_WHATSAPP_NUMBER}`;
   	return message ? `${base}?text=${encodeURIComponent(message)}` : base;
   }
   ```
2. **Ganti seluruh nomor contoh dan alamat lama di `src/`**:
   - `src/features/landing/landing-content.ts:87, 89`: Impor `OFFICIAL_HUB_ADDRESS` dan `OFFICIAL_CS_DISPLAY_PHONE`.
   - `src/features/landing/home/home-content.ts:14-22` dan `src/features/landing/home/HomeLanding.tsx`: Tambahkan `WHATSAPP_DISPLAY: OFFICIAL_CS_DISPLAY_PHONE` dan `WHATSAPP_URL: buildOfficialCsWhatsAppUrl()`, lalu tampilkan tautan WhatsApp CS resmi pada seksi kunjungan (`Visit`) dan `Footer`.
   - `src/features/events-tickets-recovery/ticket-recovery-domain.ts:52` dan `src/app/events/tickets/recovery/page.tsx:62-63`: Gunakan `OFFICIAL_CS_WHATSAPP_NUMBER` dari `@/lib/contact-config`.
   - `src/app/events/tickets/[token]/page.tsx`: Tampilkan tautan bantuan CS resmi (`buildOfficialCsWhatsAppUrl`) pada bagian bantuan pembayaran dan kendala tiket.
   - `src/lib/email.ts:132`: Sertakan nomor `OFFICIAL_CS_DISPLAY_PHONE` dan tautan `buildOfficialCsWhatsAppUrl()` di footer HTML email tiket.
   - `src/lib/receipt-publisher.ts:19-20, 30, 40, 58-60` dan `src/features/pos/ReceiptModal.tsx:130`: Gunakan `OFFICIAL_HUB_ADDRESS` dan `OFFICIAL_CS_DISPLAY_PHONE` (kosongkan atau samakan kontak ekspansi `COMING_SOON` agar tidak memakai nomor fiktif `(0361) 889900` dan `(0361) 776655`).
   - `src/features/employees/employees-domain.ts:433-434` dan `src/app/(dashboard)/employees/page.tsx:367`: Ganti `"Jl. Ngurah Rai No. 45, Singaraja, Bali"`, `"+62 812-3344-5566"`, dan `"+62 812-3456-7890"` dengan `OFFICIAL_HUB_ADDRESS` serta `OFFICIAL_CS_DISPLAY_PHONE`.
   - `src/features/pos/CashDrawerShiftModal.tsx:55` dan `src/app/(dashboard)/pos/page.tsx:1542-1564`: Ubah nilai default `tenantPhone` ke nomor tenant tersimpan atau `OFFICIAL_CS_WHATSAPP_NUMBER` (hapus `"081234567890"`).
   - `src/app/(dashboard)/settings/page.tsx:174`, `src/lib/tenant.ts:195, 266`, `src/lib/doku.ts:260`, `src/lib/organizers.ts:163`, dan `src/lib/unified-account.ts:315`: Ganti seluruh fallback `+62 812-3456-7890`, `+62 812-0000-0000`, dan `628120000000` dengan `OFFICIAL_CS_DISPLAY_PHONE` atau `OFFICIAL_CS_WHATSAPP_NUMBER`.
3. **Selesaikan rekening resmi dan perbaiki panel pengaturan bank (`S-01`)**:
   - Di `src/types/event.ts:463-506` (`DEFAULT_EVENT_BANK_ACCOUNTS`), `src/types/event.ts:530`, dan `src/lib/events.ts:4863-4871` (`MANUAL_TRANSFER_BANK_ACCOUNTS`): Ganti seluruh rekening `0000...` dan nama `"PT DAGO CREATIVE HUB (DEMO)"` dengan rekening resmi non-placeholder (pertahankan satu rekening `"BCA"` aktif sebagai `isDefault: true` dan satu rekening `"Mandiri"` aktif bertipe `"PLATFORM"` atas nama `"PT DAGO KREATIF MANDIRI"` atau `"PT DAGO CREATIVE HUB"` tanpa kata `"DEMO"` dan tanpa awalan `"0000"` agar `tests/manual-payment-and-bank-settings.test.ts:388-392` tetap lulus).
   - Di `tests/official-bank-guard.test.ts:116-132` (skenario `2.1`): Simpan eksplisit fixture rekening placeholder (`000011223344` / `"PT DAGO CREATIVE HUB (DEMO)"`) lewat `saveEventSettingsToDisk` di awal test tersebut sebagaimana pola pada `tests/paid-event-e2e.test.ts:88-105`, agar test `fail-closed` menguji guard secara mandiri tanpa bergantung pada konstanta default produksi.
   - Di `src/app/api/events/tickets/[token]/route.ts:104-117` dan `src/app/events/tickets/[token]/page.tsx:239-244`: Saring `activeBankAccounts` dengan `b.isActive && b.accountType === "PLATFORM" && !isPlaceholderBankAccount(b)`. Jika event memiliki rekening tujuan khusus dari `resolveActiveTransferBankForBooking(booking, matchingEvent)`, kembalikan hanya rekening yang sesuai untuk event tersebut. Pada pesanan `PAID`, prioritaskan `ticket.destinationBankSnapshot`.
   - Di `src/lib/events.ts:932, 1022`: Isi otomatis `label` dengan ``data.label?.trim() || `${data.bankName.trim()} Resmi` `` bila kosong, dan tolak penyimpanan rekening `PLATFORM` yang terdeteksi `isPlaceholderBankAccount(data)` di luar environment test.
   - Di `src/app/(dashboard)/events-admin/page.tsx:211`, `src/features/events-admin/EventsSettingsView.tsx:148, 199-267, 299-314`, dan `src/features/events-admin/BankModal.tsx:58-72`:
     - Saring daftar rekening platform dengan `b.accountType !== "ORGANIZER"`.
     - Render tombol aktif/nonaktif yang memanggil `onToggleBankActive(acc.id, acc.isActive)` (nonaktifkan tombol jika `acc.isDefault && acc.isActive`), dan tampilkan tombol jadikan utama hanya saat `acc.isActive && !acc.isDefault`.
     - Perbaiki nilai opsi gateway dari `"PAYMENT_GATEWAY"` menjadi `"DOKU_CHECKOUT"`.
     - Perbaiki pembacaan kolom riwayat rekening ke `h.changedAt || h.timestamp`, `h.changedBy || h.actorName || "Admin"`, dan `h.details || h.description || "—"`.
     - Samakan nilai opsi nama bank di `BankModal.tsx` dan tambahkan input nama bank kustom saat pengguna memilih `"Lainnya"`.

### Tahap 2. Pembersihan event uji dan kelengkapan tombol hapus admin (`S-02`)

1. Di `src/lib/events.ts:1741-1744` (`getApprovedEvents`) dan `src/lib/events.ts:2075-2079` (`getPublicEventById`), tambahkan syarat `&& !e.isTestData`.
2. Di `scripts/cleanup-test-events.ts`:
   - Panggil `await syncStorageFromDb("events.json")` dan `await syncStorageFromDb("event_bookings.json")` terlebih dahulu apabila `process.env.DATABASE_URL` tersedia.
   - Perluas `isIdentifiedTestData` agar menangkap `"yjryuxrt`123"`, `"kfhjgdhsgfaf"`, `"fixing bug"` pada judul maupun penyelenggara, `"[test qa 2]"`, `"sdfghjkl;;;;"`, `"cek sans"`, dan `"cek 1234567890"`.
   - Perluas `isIdentifiedTestBooking` agar menangkap kode tiket eksplisit `"DAGO-EVT-88221"` dan `"DAGO-EVT-14704"`.
   - Pada baris `108-123`, jika sebuah event teridentifikasi sebagai event uji tetapi memiliki booking `PAID` yang tidak boleh dihapus paksa, jangan biarkan statusnya `"APPROVED"`, melainkan ubah menjadi `status: "ARCHIVED"`, `isTestData: true`, dan perbarui `updatedAt`.
3. Di `src/features/events-admin/EventDetailSheet.tsx:211-311` dan `EventsModerationTable.tsx:234-285`: Tampilkan aksi `"Hapus permanen"` juga untuk event `PENDING` dan `REVISION_REQUESTED` yang memiliki `0` booking aktif.
4. Di `src/app/(dashboard)/events-admin/page.tsx`, `EventsPaymentsTable.tsx`, dan `EventAttendeesModal.tsx`: Tambahkan fungsi `handleDeleteBooking` yang memanggil `DELETE /api/events/bookings/${booking.id}` dan tampilkan tombol hapus khusus untuk pesanan uji yang memenuhi syarat (`paymentStatus !== "PAID"`, tanpa bukti transfer tertunda, dan `checkedInQty === 0`).

### Tahap 3. Hardening validasi `CHECKIN_STAFF`, harga, kuota, dan `ticketTiers` (`S-03`, `S-12`)

1. **Tutup seluruh celah peran `CHECKIN_STAFF`**:
   - Di `src/lib/server-auth.ts`: Buat dan ekspor fungsi `isCheckInStaffEmail(email: string): boolean` yang memeriksa apakah email cocok dengan salah satu entri ber-role `"CHECKIN_STAFF"` di `TRUSTED_PERSONAS` maupun `findUnifiedUserByEmail(email)`. Di dalam `assertOrganizerAuth` (`baris 573`), segera kembalikan `{ authorized: false, error: CHECKIN_STAFF_SUBMISSION_BLOCKED_MESSAGE, email: auth.email, isAdmin: false, userId: auth.userId }` apabila `isCheckInStaffRole(auth.role)` atau `isCheckInStaffEmail(auth.email || targetEmail || "")` bernilai `true`.
   - Di `src/app/api/events/route.ts:107-125`, `src/app/api/events/portal/route.ts:108`, dan `validateEventSubmission` (`src/lib/events.ts:2160`): Tolak dengan HTTP `403` dan pesan `CHECKIN_STAFF_SUBMISSION_BLOCKED_MESSAGE` apabila sesi pemanggil atau `payload.organizerEmail` terdeteksi sebagai `CHECKIN_STAFF` lewat `isCheckInStaffRole` atau `isCheckInStaffEmail`.
   - Di `src/app/events/portal/page.tsx`: Jika `isCheckInStaffRole(user?.role)` bernilai `true`, render tampilan akses ditolak yang menampilkan `CHECKIN_STAFF_SUBMISSION_BLOCKED_MESSAGE` beserta tombol kembali ke `/events/checkin`, tanpa menampilkan tombol `"Ajukan event"`.
2. **Validasi penuh `ticketTiers` dan `refundPolicy` di boundary server**:
   - Di `src/lib/event-validation.ts`: Tambahkan `validateEventTicketTiers(rawTiers: unknown, options?: { maxCapacity?: number }): EventValidationResult<EventTicketTier[]>` dan `validateEventRefundPolicy(rawPolicy: unknown): EventValidationResult<EventRefundPolicy>`:
     - Setiap tier wajib memiliki `id` unik (buat otomatis bila kosong saat pengajuan), `name` bersih `2..80` karakter, `price` berupa bilangan bulat aman `>= 0` (tolak desimal seperti `0.9`, negatif, `NaN`, dan eksponensial seperti `1e+58` menggunakan logika ketat yang setara dengan `validateEventPrice`), `quota` tervalidasi lewat `validateEventCapacity(tier.quota, false)` (`1..1000`), serta `salesStartDate` dan `salesEndDate` ternormalisasi ke ISO WITA (`+08:00`) dengan syarat `salesEndDate >= salesStartDate`.
     - Jumlah seluruh `tier.quota` tidak boleh melebihi `MAX_EVENT_CAPACITY` (`1000`), dan bila `maxCapacity` eksplisit diberikan harus memenuhi `maxCapacity >= sumTierQuota`.
     - Untuk `refundPolicy`, validasi `policyType` hanya `"NO_REFUND"` atau `"REFUNDABLE_UNTIL_H_MINUS"`, `hMinusDays` bilangan bulat `0..60`, dan `refundFeePercent` bilangan bulat `0..100`.
   - Panggil kedua validator tersebut di `validateEventSubmission`, `createEventSubmission`, `updateEventDetails`, dan `organizerResubmitEvent` (`src/lib/events.ts`). Saat `ticketTiers` tidak kosong, turunkan otomatis `isPaid = tiers.some((t) => t.price > 0)` dan `price = isPaid ? Math.min(...tiers.filter((t) => t.price > 0).map((t) => t.price)) : 0`.
   - Di `src/app/api/events/[id]/route.ts:87-102, 137-143`: Masukkan `ticketTiers: body.ticketTiers` dan `refundPolicy: body.refundPolicy` ke dalam `allowedUpdates`, dan perluas deteksi `isValidationError` agar error validasi tier atau kebijakan refund mengembalikan HTTP `400`.
   - Di `updateEventDetails` (`src/lib/events.ts:2535-2548`) dan `organizerResubmitEvent` (`src/lib/events.ts:5249-5347`): Aktifkan kunci kapasitas (`hasCapacityChange = ... || updates.ticketTiers !== undefined`), muat `allBookings`, tolak penghapusan tier yang sudah memiliki booking aktif (`getEventActiveBookedTicketCountForTier > 0`), tolak penurunan `tier.quota` di bawah jumlah booking aktif tier tersebut, serta jalankan `isSafePublicUrl` dan validasi urutan tanggal di `organizerResubmitEvent`.
3. **Perbaiki validasi input di seluruh form frontend**:
   - Di `EventSubmissionForm.tsx`, `event-submission.ts`, `OrganizerRevisionDialog.tsx`, dan `EventEditModal.tsx`: Pasang atribut `min`, `max={1000}`, dan `step={1}`, simpan nilai ketikan mentah di state input agar kolom kuota di `EventEditModal.tsx` dapat dihapus dengan backspace tanpa melompat kembali ke `30`, dan tampilkan pesan error inline dari `validateEventPrice` serta `validateEventCapacity` setiap kali pengguna memasukkan desimal (`0.9`) atau angka di luar batas (`1500`, `1e+58`).

### Tahap 4. Perbaikan pengiriman email nyata dan penutupan celah pemulihan tiket (`S-05`, `S-08`)

1. **Tutup pintu belakang di `src/app/api/events/bookings/my/route.ts:80-180`**:
   - Hapus blok pencarian tanpa autentikasi berdasarkan `ticketCode && queryEmail` (`baris 80-124`) dan `queryEmail && queryPhone` (`baris 126-180`).
   - Endpoint `GET /api/events/bookings/my` hanya boleh mengembalikan daftar tiket apabila:
     1. Pemanggil memiliki sesi login terverifikasi (`auth.isAuthenticated && auth.email`), atau
     2. Pemanggil mengirim `guestToken` / `tokens` ber-entropi tinggi yang sudah ia miliki (`token.length >= 16`).
   - Kembalikan HTTP `401` untuk semua query `email`, `phone`, atau `ticketCode` tanpa sesi dengan pesan yang mengarahkan ke `POST /api/events/bookings/recover`.
   - Hapus komponen mati `src/features/events-tickets-recovery/TicketRecoveryResultCard.tsx` beserta ekspornya di `index.ts`.
   - Perbarui `tests/ticket-recovery-and-grouping.test.ts:634-775` agar menguji bahwa panggilan `GET /api/events/bookings/my?email=...&phone=...` tanpa login ditolak dengan HTTP `401` dan tidak pernah membocorkan `guestToken`.
2. **Implementasikan pengiriman email nyata di `src/lib/email.ts` (`S-05`, `S-08`)**:
   - Pasang dependensi `nodemailer`, `@types/nodemailer`, `qrcode`, dan `@types/qrcode` di `package.json`, serta dokumentasikan `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, dan `RESEND_API_KEY` di `.env.example`.
   - Buat fungsi `escapeHtml(str: string)` dan terapkan pada seluruh field teks pengguna (`recipientName`, `eventTitle`, `eventDate`, `eventLocation`, `ticketCode`, `guestLabel`, `privateAccessUrl`) di `generatePaidTicketEmailHtml` maupun fungsi baru `generateRecoveryEmailHtml`.
   - Generate buffer PNG QR untuk setiap kursi (`-01`, `-02`, dst.) secara lokal memakai `QRCode.toBuffer(qrPayload, { width: 250, margin: 2 })` dan lampirkan sebagai inline CID (`cid:qr-seat-${seat}@dagoeng.com`) agar tidak bocor atau terblokir di `api.qrserver.com`.
   - Buat fungsi pengirim bersama `dispatchTransactionalEmail` yang mendukung:
     1. SMTP via `nodemailer.createTransport` ketika `SMTP_HOST`, `SMTP_USER`, dan `SMTP_PASS` tersedia,
     2. HTTP `POST https://api.resend.com/emails` ketika `RESEND_API_KEY` tersedia,
     3. HTTP `POST https://api.sendgrid.com/v3/mail/send` ketika `SENDGRID_API_KEY` tersedia.
   - Kembalikan `sent: true` **hanya** jika transport benar-benar menerima pengiriman. Jangan pernah memalsukan `sent: true` tanpa pemanggilan transport. Perbarui `tests/ticket-paid-email.test.ts` dengan mock transport yang memverifikasi subjek, penerima, HTML ter-escape, dan lampiran QR per peserta.
3. **Kunci pemulihan tiket ke email dan amankan `recover/route.ts` (`S-05`)**:
   - Di `src/app/events/tickets/recovery/page.tsx`: Jadikan email satu-satunya kanal pengiriman otomatis sesuai spesifikasi Excel `S-05`. Hapus pemilih kanal otomatis WhatsApp, wajibkan input `ticketCode + email` pada tab pertama dan `email + nomor telepon` pada tab `"Lupa kode booking"`, lalu tampilkan kartu konfirmasi `"Cek email Anda"` setelah submit berhasil (tautan WhatsApp CS resmi tetap tersedia sebagai bantuan manual ke petugas).
   - Di `src/app/api/events/bookings/recover/route.ts`:
     - Susun `baseUrl` murni dari `process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://dagoeng.com"` (jangan pernah membaca `req.headers.get("origin")` atau `x-forwarded-host`).
     - Wajibkan pencocokan `email` pada kedua mode (`code` maupun `forgot_code`; pada `forgot_code` wajib cocok `email` sekaligus `phone`).
     - Periksa hasil `const emailRes = await sendTicketRecoveryEmail(...)`; jika `!emailRes.sent`, kembalikan status jujur (`configured: false` atau HTTP `503`), dan pada saat aktif jangan membocorkan `userBookings.length > 0` di field `dispatched` maupun `emailDispatched`.
4. **Lengkapi pemicu email tiket lunas pada DOKU dan cegah duplikasi (`S-08`)**:
   - Panggil `await dispatchPaidTicketEmail(updatedBooking)` di `src/app/api/webhooks/doku/route.ts:118` dan `src/app/api/webhooks/doku/simulate/route.ts:228` saat status berubah menjadi `PAID`.
   - Di `updateBookingPaymentStatus` (`src/lib/events.ts:4762`), kirim email hanya jika `previousStatus !== "PAID" && status === "PAID"`, dan tunggu pengiriman dengan `Promise.race` berbatas waktu 10 detik di dalam `try/catch` pada `createEventBooking`, `createInvitationTicket`, serta `updateBookingPaymentStatus`.

### Tahap 5. Perbaikan meja check-in WITA hari ini dan alur e-tiket (`S-06`, `S-07`)

1. **Izinkan penyelenggara memuat peserta event miliknya di `/events/checkin` (`S-06`)**:
   - Di `src/app/api/events/bookings/route.ts:20-50`: Jika `adminAuth.authorized` dan `checkInAuth.authorized` bernilai `false`, periksa `const organizerAuth = await assertOrganizerAuth(req)`. Bila `organizerAuth.authorized` bernilai `true`, izinkan akses tetapi saring `rawBookings` hanya untuk event `APPROVED` yang dimiliki `organizerAuth.email` (dan tolak dengan HTTP `403` apabila query `eventId` menunjuk ke event milik penyelenggara lain).
2. **Tegakkan validasi hari acara WITA di backend (`S-06`)**:
   - Gunakan `getEventDateStatusWita` (dengan batas durasi maksimal 7 hari untuk `endDate` tidak wajar) di dalam `updateBookingCheckIn` (`src/lib/events.ts:4426-4459`) dan `organizerCheckInAttendee` (`src/lib/events.ts:5219-5232`).
   - Jika `dateStatus === "UPCOMING"`, lempar error yang diawali `"Meja check-in belum dibuka untuk event ..."` (pertahankan awalan kalimat ini agar `tests/critical-checkin-bugfixes.test.ts:241` dan `tests/paid-event-e2e.test.ts:313` tetap lulus).
   - Jika `dateStatus === "PAST"`, lempar error `"Pintu check-in telah ditutup karena tanggal pelaksanaan event ... telah lewat (WITA)."`.
   - Jika `dateStatus === "TODAY"`, pertahankan validasi jam `now < twoHoursBefore` dan `now > twelveHoursAfter`. Terapkan juga pemeriksaan `dateStatus === "TODAY"` pada aksi `reset` kehadiran di `bookings/[id]/route.ts:147` dan `portal/check-in/route.ts:65`.
3. **Perbaiki crash scanner portal, pembatasan hari ini, dan error scanner kamera (`S-06`, `S-07`)**:
   - Di `src/features/events-portal/OrganizerQRScannerDialog.tsx`:
     - Saring `todayEvents = filterTodayEventsWita(events.filter((e) => e.status === "APPROVED"))`. Jika kosong, tampilkan pesan kosong bahwa meja check-in hanya aktif pada hari pelaksanaan event (WITA) dan nonaktifkan kamera serta input kode.
     - Gunakan state `activeEventId` dari `todayEvents` (selaras dengan `selectedEventId` jika ada di `todayEvents`), sediakan pemilih event khusus `todayEvents` bila lebih dari satu, dan kirim `eventId: activeEventId` ke `PATCH /api/events/portal/check-in`.
     - Pada baris `219` dan `227`, ganti `json.booking` menjadi `(json.data || json.booking) as EventTicketOrder` dan `checkedInQty: updatedBooking.checkedInQty ?? updatedBooking.ticketCount`. Jangan memanggil `.toUpperCase()` sebelum `parseQRContent` pada baris `318`.
   - Di `src/features/events-portal/OrganizerHomeTab.tsx:255-301` (`NextEventCard`): Aktifkan tombol `"Mulai check-in"` hanya apabila `isEventTodayWita(event)` bernilai `true`.
   - Di `src/features/events-checkin/CheckInActionToolbar.tsx:37-42`: Tambahkan `timeZone: "Asia/Makassar"` pada `toLocaleDateString`.
   - Di `src/features/events-admin/EventAttendeesModal.tsx:271-294`: Nonaktifkan tombol `"Tandai hadir"` / `"Batal hadir"` apabila `!isEventTodayWita(event) || b.paymentStatus !== "PAID"`.
   - Di `src/app/events/checkin/page.tsx:203-206` dan `src/features/events-checkin/EventCheckInScannerDialog.tsx:189-209, 241`: Lempar ulang error dari `handleCheckIn` setelah gagal agar `EventCheckInScannerDialog` masuk ke blok `catch`, memutar nada gagal `playChime(false)`, dan menampilkan status merah penolakan; jangan meng-uppercase string JSON mentah sebelum `parseTicketScanCode`.
4. **Lengkapi data endpoint e-tiket dan dokumentasi screenshot `S-07`**:
   - Di `src/app/api/events/tickets/[token]/route.ts:96-120`: Sertakan `checkedInSeats`, `seatCheckInTimes`, `paymentRejectionReason`, `paymentVerificationNote`, `ticketTierId`, `ticketTierName`, `isInvitation`, `invitationNote`, `promoCode`, `discountAmount`, `subtotalPrice`, `refundStatus`, `refundRequest`, serta `refundPolicy` dan `refundEligibility` dari event terkait.
   - Di `src/app/events/tickets/[token]/page.tsx:227-237`: Sertakan `eventId: ticket.eventId` saat memanggil `getSubTicketDetails`.
   - Jalankan aplikasi pada database lokal/test terisolasi (bukan Neon produksi), rekam 6 screenshot alur `S-07` ke `docs/test-cases/screenshots/s07/`, dan tautkan seluruh gambar tersebut di `docs/test-cases/TC-S07-PAID-EVENT-E2E.md`.

### Tahap 6. Pengamanan RBAC Kasir, penyamaran kontak, coworking WITA, dan laporan produk (`S-09`, `S-10`, `S-11`)

1. **Tuntaskan keamanan CRM & tier member (`S-09`)**:
   - Di `src/app/api/loyalty/members/route.ts`:
     - Wajibkan sesi login terverifikasi via `getRequestAuthUser(req)` pada `GET`, `POST`, `PUT`, dan `DELETE` (kembalikan HTTP `401` bila belum login).
     - Pada `GET`: Untuk `SUPER_ADMIN`, `OWNER`, dan `MANAGER` (`canUserViewFullCustomerContacts(auth.role)`), kembalikan data utuh; untuk `CUSTOMER`, kembalikan hanya record milik dirinya sendiri; untuk peran staf lain seperti `CASHIER`, samarkan `phone` dengan `maskCustomerPhone`, `email` dengan `maskCustomerEmail`, dan kosongkan `identityNo: ""`.
     - Pada `POST` dan `PUT`: Hitung tier secara otoritatif di server menggunakan `resolveAuthoritativeMemberTier(member, tierConfig)` yang hanya mempertahankan tier manual jika entri terbaru `member.tierHistory?.[0]?.isManualOverride === true`, dan selebihnya menghitung dari `calculateTierFromPoints(points, tierConfig)`. Larang `CASHIER` menetapkan `initialPoints > 0` pada `POST`, larang override tier manual oleh selain `SUPER_ADMIN | OWNER | MANAGER` pada `PUT` (HTTP `403`), jangan pernah menimpa nomor/email asli di penyimpanan dengan teks yang mengandung `*`, dan batasi `DELETE` hanya untuk `SUPER_ADMIN | OWNER | MANAGER`.
   - Di `src/lib/persistent-storage.ts:531-538`: Terapkan `resolveAuthoritativeMemberTier` saat membaca member dari penyimpanan sehingga data lama `Ketut Dian` (`55` poin) selalu ternormalisasi menjadi `"Bronze"`.
   - Di `src/contexts/LoyaltyContext.tsx`: Muat ulang data saat `[user?.id, user?.role?.slug]` berubah, cek `m.tierHistory?.[0]?.isManualOverride === true` (bukan `.some(...)`), sinkronkan ulang terhadap `settings.loyaltyTiers`, samarkan kontak di memori untuk `CASHIER`, dan jangan menyimpan kontak utuh ke `localStorage` saat login sebagai `CASHIER`.
   - Di `src/features/pos/CoworkingBookingPanel.tsx:341-345`: Samarkan nomor telepon pada opsi dropdown member jika `!canUserViewFullCustomerContacts(user?.role?.slug)`, dan gunakan `selectedMember?.id` untuk pencatatan pemakaian promo di `pos/page.tsx:680`.
   - Di `src/features/customers/AddCustomerModal.tsx` dan `src/app/(dashboard)/customers/page.tsx:46, 79-98`: Sembunyikan input `Poin awal` untuk `CASHIER`, teruskan `{ canViewFullContact }` ke `filterMembers` agar pencarian tidak bisa menebak digit tengah yang disamarkan, dan lindungi `handleAddPointsQuick` serta `handleManualOverride` dengan `if (!isOwnerOrAdmin) return;`.
   - Di `src/lib/route-guard.ts`, `src/middleware.ts`, dan `src/lib/rbac.ts:180`: Tambahkan `{ prefix: "/customers", allowedRoles: ["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER"] }` ke `ROUTE_PERMISSIONS`, daftarkan `"/customers/:path*"` pada `middleware.ts`, dan tambahkan `"CASHIER"` pada menu navigasi `Pelanggan & CRM`. Perbaiki juga tier mock di `src/features/pos/mock-data.ts:4-8` menjadi `"Bronze"`.
2. **Selaraskan tanggal WITA, kontak nota, dan baris pajak coworking (`S-10`)**:
   - Di `src/features/coworking/coworking-domain.ts`: Buat fungsi kalender murni `addDaysToYmd(ymd: string, days: number): string` berbasis `Date.UTC` untuk menggantikan `.setDate()` + `.toISOString()` pada `computedEndDate`, dan ekspor helper `formatCoworkingTaxLabel(tax: number, taxType?: string, taxRatePercent?: number): string` yang mengembalikan `"Pajak (bebas PB1)"` saat `tax <= 0` atau `` `Pajak (${taxType || "PPN"} ${taxRatePercent ?? 0}%)` `` saat `tax > 0`.
   - Tampilkan baris pajak konsisten dari `formatCoworkingTaxLabel` di `NewBookingModal.tsx:558-576`, `CustomerBookingModal.tsx:305-323`, `SpaceView.tsx:215-218`, `CoworkingBookingPanel.tsx`, dan `CoworkingReceiptModal.tsx`.
   - Di `src/app/(mobile)/customer/page.tsx:377-381, 476-504`: Gunakan `resolveCoworkingReceiptPublisher(activeOutlet)` agar nama outlet, alamat, dan telepon resmi selalu tampil di nota pelanggan, serta kirimkan field pajak coworking.
   - Di `src/app/(dashboard)/pos/page.tsx:1018-1024, 1081-1110`, `src/app/(dashboard)/coworking/page.tsx:230-257`, `src/features/coworking/CoworkingReceiptModal.tsx:205`, dan `src/features/pos/pos-coworking.ts:26-31`: Bersihkan duplikasi akhiran `"WITA"` dengan `.replace(/\s*WITA$/i, "")` sebelum merender `"WITA"`, sertakan rincian harga dasar/diskon/pajak pada nota QRIS coworking, dan tambahkan `timeZone: "Asia/Makassar"` pada seluruh pemformatan waktu.
3. **Lengkapi kolom terjual pesanan lunas di laporan Produk dan AI Insight (`S-11`)**:
   - Di `src/features/reports/reports-domain.ts`: Buat dan ekspor `isSettledPaidOrder(order: OrderRecord): boolean` yang memeriksa `order.paymentStatus === "PAID" && order.status !== "CANCELLED" && !order.refundedAt && order.syncStatus !== "REJECTED"`.
   - Gunakan `isSettledPaidOrder` di `findTopProduct(orders, allowedProducts?)` (kembalikan `"-"` bila `allowedProducts` diberikan dan kosong, serta saring item ke himpunan `allowedProducts`), di `case "SALES"` (`totalItemsSold`), dan di `case "PRODUCTS"` (`baris 516-557`).
   - Pada `case "PRODUCTS"`, tambahkan kolom `"Terjual"` (`${soldQty} pcs`) dan `"Omzet lunas"` (`Rp ...`) di akhir `tableHeaders` serta `tableRows` (indeks ke-7 dan ke-8 agar indeks kolom `0..6` yang diuji test lama tidak bergeser), dan tambahkan kartu ke-4 `"Total terjual"`.
   - Di `src/app/(dashboard)/reports/page.tsx:31, 65-84`: Saring `filteredOrders`, `filteredShifts`, `filteredFinanceLogs`, dan `eventBookings` dengan `isDateInRange` dari `useDateFilter()`, serta batasi produk dan item pesanan ke `user.tenant.id` apabila `user?.scopeLevel === "TENANT"`.
   - Di `src/app/(dashboard)/ai-insight/page.tsx:55-57, 100`: Gunakan `isSettledPaidOrder` untuk menghitung pendapatan serta jumlah pesanan, dan ganti `scopedProducts[0]?.name` dengan `findTopProduct(paidScopedOrders, scopedProducts)`. Tambahkan juga `|| !p.outletId` di `src/contexts/ProductContext.tsx:122` dan `src/app/api/products/route.ts:28`.

### Tahap 7. Bangun UI dan perbaikan penuh jenis tiket bertingkat (`S-12`) serta promo & undangan (`S-13`)

1. **Bangun editor dan tampilan jenis tiket bertingkat (`S-12`)**:
   - Buat komponen `src/components/events/TicketTiersEditor.tsx` memakai primitif shadcn (`Button`, `Input`, `Label`, `Badge`) dalam Bahasa Indonesia sentence case yang mendukung mode tiket tunggal maupun tiket bertingkat (`+ Tambah jenis tiket` untuk contoh Early Bird, Reguler, VIP) dengan kolom `Nama jenis tiket`, `Harga (Rp)`, `Kuota`, `Mulai jual (WITA)`, `Berakhir jual (WITA)`, dan `Keterangan singkat`.
   - Pasang `TicketTiersEditor` ke dalam:
     1. `src/features/events-portal/EventSubmissionForm.tsx` dan `event-submission.ts`,
     2. `src/features/events-portal/OrganizerRevisionDialog.tsx` dan `src/app/events/portal/page.tsx`,
     3. `src/features/events-admin/EventEditModal.tsx` dan `src/app/(dashboard)/events-admin/page.tsx`.
   - Tampilkan rincian daftar tier pada panel kurasi admin `src/features/events-admin/EventDetailSheet.tsx`.
   - Buat helper `isEventPaidEffective` dan `formatEventPriceSummary` (misalnya `"Mulai dari Rp 50.000"` atau `"Gratis"` sesuai seluruh tier) lalu gunakan di `events-catalog-domain.ts`, `EventCard.tsx`, `landing-logic.ts`, `src/app/events/[id]/page.tsx:222, 413`, `EventsModerationTable.tsx`, `OrganizerEventsTab.tsx`, dan `OrganizerEventDetailModal.tsx`. Panggil juga `void fetchEventDetail(event.id)` seusai pemesanan berhasil di `events/[id]/page.tsx:220`.
   - Perbaiki `EventDetailSidebar.tsx` dan `EventBookingDialog.tsx` agar membedakan status `"Penjualan belum dibuka"`, `"Penjualan berakhir"`, dan `"Habis terjual"`, menampilkan rentang tanggal jual WITA per tier, tidak memilih otomatis `tiers[0]` yang habis atau belum dibuka, serta menonaktifkan tombol submit jika tier belum aktif dijual.
   - Di `createEventBooking` (`src/lib/events.ts:3989-4036`), `createInvitationTicket` (`baris 3391-3420`), dan `resolveVenueCapacity` (`src/lib/event-capacity.ts:24-43`), gunakan `getEventActiveBookedTicketCountForTier` dan `getEventActiveBookedTicketCount` (yang sudah mengecualikan `REFUNDED` serta `PENDING` kedaluwarsa), dan gunakan jumlah kuota tier saat `event.maxCapacity` tidak diisi.
2. **Tutup celah keamanan dan bangun UI kode promo serta tiket undangan (`S-13`)**:
   - **Perbaikan keamanan API**:
     - Di `src/app/api/events/[id]/promos/route.ts:71` dan `src/app/api/events/[id]/invitations/route.ts:25`, ubah pemanggilan auth menjadi ketat terhadap pemilik event:
       ```ts
       const organizerAuth = await assertOrganizerAuth(req, event.organizerEmail);
       ```
     - Di `createInvitationTicket` (`src/lib/events.ts:3386-3388`), tolak dengan error `"FORBIDDEN"` apabila `issuerEmail && issuerEmail !== "admin"` tidak sama dengan `event.organizerEmail`.
     - Hapus `promoCodes` dari `toPublicEvent` (`src/lib/events.ts:1701-1713`) dan ganti dengan boolean `hasActivePromos?: boolean`.
     - Di `GET /api/events/[id]/promos/route.ts:25-39`: Jika pemanggil bukan admin dan bukan penyelenggara pemilik event, larang pengembalian daftar seluruh promo (kembalikan HTTP `403` bila tanpa parameter `?code=`), dan hanya layani validasi satu kode yang diketik pembeli lewat `?code=XXXX&subtotal=...&tierId=...` menggunakan `validateAndCalculatePromoDiscount`. Perbarui `EventBookingDialog.tsx` untuk memeriksa kode promo lewat endpoint tersebut.
   - **Perbaikan kuota promo dan zona waktu**:
     - Di `createEventPromoCode` (`src/lib/events.ts:3310, 3327`), ganti `Number(payload.quota || 100)` menjadi `payload.quota !== undefined && payload.quota !== null ? Math.max(0, Math.floor(Number(payload.quota))) : 100`, dan normalisasi `validFrom` serta `validUntil` ke WITA (`+08:00`).
     - Pulihkan atau hitung ulang `promo.usedCount` secara idempoten dari booking aktif yang tidak berstatus `CANCELLED`, `EXPIRED`, maupun `REFUNDED` pada saat `expirePendingBookings`, pembatalan pembayaran, persetujuan refund, dan `deleteEventBooking`. Catat `appendAuditLog` saat promo dibuat dan saat tiket undangan diterbitkan.
   - **Bangun UI Promo dan Tiket Undangan**:
     - Buat `src/components/events/EventPromosDialog.tsx` untuk melihat daftar promo (`usedCount / quota`), membuat kode promo baru (persen atau nominal, kuota, masa berlaku WITA, pilihan tier), serta mengaktifkan atau menonaktifkan promo. Pasang tombol `"Kelola promo"` di `OrganizerEventsTab.tsx` / `OrganizerEventDetailModal.tsx` dan `EventDetailSheet.tsx`.
     - Buat `src/components/events/IssueInvitationDialog.tsx` yang memanggil `POST /api/events/${event.id}/invitations` (nama tamu, email, nomor WhatsApp, instansi, jenis tiket opsional, jumlah kursi, catatan undangan) lalu menampilkan tautan tiket privat yang siap disalin. Pasang tombol `"Terbitkan tiket undangan"` di toolbar `OrganizerAttendeesTab.tsx` dan header `EventAttendeesModal.tsx`.
     - Tampilkan badge `"Tiket undangan"`, `invitationNote`, `ticketTierName`, serta potongan `promoCode` pada halaman `/events/tickets/[token]` (`TicketEventMeta.tsx`, `TicketOrderSummary.tsx`) dan meja check-in (`/events/checkin`: `CheckInAttendeesTable.tsx`, `CheckInAttendeeCard.tsx`, `EventCheckInScannerDialog.tsx`).

### Tahap 8. Amankan API refund dan bangun UI refund untuk ketiga peran (`S-14`)

1. **Tutup celah keamanan dan perbaiki integritas finansial refund di backend**:
   - Di `src/app/api/events/bookings/[id]/refund/route.ts`:
     - Wajibkan bukti kepemilikan tiket pada `GET` maupun `POST` melalui salah satu dari: (a) `guestToken` valid minimal 32 karakter (lewat query `?token=`, header `x-guest-token`, atau `body.guestToken`) yang diverifikasi secara constant-time (`crypto.timingSafeEqual`) terhadap `booking.guestToken`, (b) sesi login terautentikasi (`getRequestAuthUser(req)`) yang emailnya sama dengan `booking.guestEmail`, atau (c) admin event terverifikasi (`assertEventAdmin(req).authorized`). Jika tidak terpenuhi, tolak dengan HTTP `403` sebelum mengembalikan data apa pun.
     - Pada respons `POST` (`baris 79-83`), **jangan kembalikan `updatedBooking` mentah** yang berisi `guestToken`; kembalikan hanya ringkasan aman (`bookingId`, `ticketCode`, `paymentStatus`, `refundStatus`, `refundRequest`).
   - Di `src/lib/server-auth.ts:686-730` (`assertEventAdmin`): Sertakan `email: auth.email || undefined` pada objek hasil autentikasi, lalu gunakan `auth.email || auth.name || "admin"` di `src/app/api/events/admin/refunds/route.ts:71`.
   - Di `adminProcessTicketRefund` (`src/lib/events.ts:3753-3835`) dan `processOrganizerPayout` (`src/lib/events.ts:5814-5846`):
     - Saat admin akan menyetujui refund (`decision === "APPROVE"`), hitung proyeksi pendapatan bersih penyelenggara setelah refund dikurangi total payout berstatus `PAID` dan `PROCESSING` milik event tersebut. Jika proyeksi saldo penyelenggara menjadi negatif, tolak persetujuan secara default dengan pesan jelas bahwa dana bagi hasil sudah dicairkan ke penyelenggara (kecuali Super Admin mengirim konfirmasi eksplisit `forceApproveDeficit === true`), dan tampilkan nilai defisit di ringkasan keuangan.
     - Di `processOrganizerPayout`, baca ulang seluruh booking di dalam transaksi dan tolak pencairan ke `PROCESSING` atau `PAID` apabila nominal payout melebihi pendapatan bersih dari booking yang masih berstatus `PAID`.
   - Panggil `appendAuditLog` pada `requestTicketRefund` (`EVENT_TICKET_REFUND_REQUESTED`) dan `adminProcessTicketRefund` (`EVENT_TICKET_REFUND_APPROVED` / `EVENT_TICKET_REFUND_REJECTED`).
   - Tambahkan penjagaan status `REFUNDED` dan `refundStatus === "REQUESTED"` pada `deleteEventBooking` (`events.ts:4804`), `adminApproveBookingPayment` (`events.ts:4959`), serta `validateTicketCheckIn` (`events-checkin-domain.ts:112`), `CheckInAttendeesTable.tsx:101`, dan `CheckInAttendeeCard.tsx:41`.
2. **Bangun UI kebijakan dan alur refund pada ketiga peran**:
   - **Peran 1 (Penyelenggara & Admin Pengaturan Kebijakan)**: Tambahkan pemilih kebijakan pembatalan di `EventSubmissionForm.tsx`, `OrganizerRevisionDialog.tsx`, dan `EventEditModal.tsx` saat event berbayar (`Tidak bisa refund` vs `Bisa refund sampai H-x sebelum acara`, input `Batas hari (H-x)`, dan `Potongan biaya admin (%)`). Kunci pelemahan kebijakan apabila event sudah memiliki tiket lunas aktif. Perbaiki juga copy sentence case di `EventDetailSidebar.tsx:198-206`.
   - **Peran 2 (Pembeli di Halaman E-Tiket `/events/tickets/[token]/page.tsx`)**:
     - Buat `src/features/events-tickets/TicketRefundSection.tsx` dan `TicketRefundRequestDialog.tsx`.
     - Tampilkan ketentuan refund event, estimasi dana bersih yang diterima (`totalPrice - feeDeducted`), dan batas waktu pengajuan dalam WITA.
     - Jika `refundEligibility.eligible === true`, tampilkan tombol `"Ajukan refund"` yang membuka dialog input `Nama bank`, `Nomor rekening`, `Nama pemilik rekening`, dan `Alasan pembatalan`, lalu mengirim `POST /api/events/bookings/${ticket.id}/refund` beserta `guestToken: token`.
     - Tampilkan kartu status yang jelas untuk `REQUESTED` (`"Pengajuan refund sedang diproses"`), `APPROVED` / `REFUNDED` (`"Dana tiket telah dikembalikan"`, sembunyikan QR check-in tanpa memunculkan pesan kuning `"menunggu verifikasi pembayaran"` baik di `TicketQRSection.tsx` maupun di `EventTicketPassDialog.tsx:190-235`), serta `REJECTED` (tampilkan `rejectionReason` dari admin).
   - **Peran 3 (Admin Moderasi Refund di `/events-admin`)**:
     - Tambahkan tab `"REFUNDS"` berlabel `"Pengajuan refund"` beserta penghitung badge jumlah `REQUESTED` di `src/features/events-admin/EventsAdminTabs.tsx` dan `src/app/(dashboard)/events-admin/page.tsx`.
     - Buat `src/features/events-admin/EventsRefundsTable.tsx` dan `RefundActionDialog.tsx` yang memuat `GET /api/events/admin/refunds` dan mengirim keputusan `POST /api/events/admin/refunds` (`decision: "APPROVE" | "REJECT"`, `adminNotes`, dan `rejectionReason` wajib saat menolak), lengkap dengan rincian nama acara, pemesan, kode tiket, nominal bayar, potongan biaya admin, nominal bersih refund, rekening tujuan pembeli, alasan pengajuan, dan filter status.

### Tahap 9. Perbaiki akurasi dashboard penyelenggara, komponen Design System, dan tipe test (`S-15`)

1. Di `src/features/events-portal/events-portal-domain.ts:116-119, 134-152, 275-380`:
   - Samakan perhitungan `totalCapacity` antara `calculateEventOccupancy` dan `calculateEventSalesSummary` mengikuti aturan `getEventTicketAvailability` (`event.maxCapacity` bila `> 0`, fallback ke jumlah kuota tier bila bertingkat, lalu kapasitas ruangan).
   - Pisahkan tiket undangan gratis (`b.isInvitation || b.paymentMethod === "INVITATION"`) dari penjualan tiket berbayar (`soldCount`), hitung pemakaian kursi tier dari seluruh reservasi aktif (`PAID` + `PENDING` belum kedaluwarsa + undangan) agar `remainingQuota` sama dengan ketersediaan di katalog publik, dan jangan pernah memberi `isSoldOut: true` pada baris ringkasan `"Tiket undangan"`.
   - Ganti angka tetap `0.8` dengan `resolveOrganizerSharePercent(event) / 100`, dan gunakan `salesSummary.organizerEarnings` secara langsung di `OrganizerEventDetailModal.tsx:65`.
2. Di `src/features/events-portal/OrganizerHomeTab.tsx:171-209` dan `OrganizerEventDetailModal.tsx:160-205`:
   - Ganti elemen `<table>` mentah dengan komponen shadcn `<Table>`, `<TableHeader>`, `<TableBody>`, `<TableRow>`, `<TableHead>`, dan `<TableCell>` dari `@/components/ui/table`.
   - Ubah seluruh judul dan header ke Bahasa Indonesia sentence case (`"Penjualan per jenis tiket"`, `"Jenis tiket"`, `"Sisa kuota"`) dan format angka `0` dengan `formatCurrencyIDR(t.revenue)`.
3. Di `src/features/events-admin/events-admin-domain.ts:57-90` dan `src/features/events-tickets/ticket-pass-domain.ts:18, 212-255`:
   - Tambahkan penanganan `case "REFUNDED"` (`"Dikembalikan"`, tone `"destructive"`) dan dukungan label `"Tiket undangan"` untuk metode `"INVITATION"`.
4. Perbaiki seluruh error pemeriksaan tipe pada file test (`tests/organizer-sales-dashboard.test.ts`, `tests/event-promo-and-invitations.test.ts`, `tests/event-refund-policy.test.ts`, dan `tests/events-portal-domain.test.ts`) sehingga `npx tsc --noEmit -p tests/tsconfig.json` menghasilkan **0 error** (hapus field tidak sah `remainingQuota` pada objek `EventTicketTier`, ganti `agreed: true` pada `ProposedRevenueSplit` menjadi `proposedBy: "ORGANIZER", status: "ACCEPTED", organizerFeePercent: 80, customPlatformFeePercent: 20`, ganti `checkInStatus: "PENDING"` menjadi `"REGISTERED"`, dan lengkapi properti wajib `posterUrl`, `eventDate`, `eventLocation`, `guestPhone`, `unitPrice`, `platformFeePercent`, serta `paymentMethod`).

### Tahap 10. Resolusi konflik dengan MR !26 (`develop`), perbaikan dokumen S-16, dan gerbang verifikasi akhir

1. **Sinkronkan cabang dengan `develop` terbaru dan selesaikan irisan file MR `!26`**:
   - Pada `src/features/events-admin/EventAttendeesModal.tsx` (baris `220-310`), gabungkan logika kehadiran parsial dan zona waktu `Asia/Makassar` dari `develop` / MR `!26` dengan status refund Bahasa Indonesia sentence case serta kunci hari acara WITA seperti berikut:
     ```tsx
     <TableCell className="hidden md:table-cell">
     	<Badge
     		variant={
     			b.paymentStatus === "REFUNDED" ||
     			b.paymentStatus === "CANCELLED" ||
     			b.paymentStatus === "EXPIRED"
     				? "destructive"
     				: b.refundStatus === "REQUESTED"
     				? "secondary"
     				: b.isInvitation || b.paymentMethod === "INVITATION"
     				? "outline"
     				: b.paymentStatus === "PAID"
     				? "default"
     				: "secondary"
     		}
     	>
     		{b.paymentStatus === "REFUNDED"
     			? "Dikembalikan"
     			: b.refundStatus === "REQUESTED"
     			? "Pengajuan refund"
     			: b.isInvitation || b.paymentMethod === "INVITATION"
     			? "Undangan"
     			: b.paymentStatus === "PAID"
     			? "Lunas"
     			: b.paymentStatus === "CANCELLED"
     			? "Dibatalkan"
     			: b.paymentStatus === "EXPIRED"
     			? "Kedaluwarsa"
     			: "Menunggu"}
     	</Badge>
     </TableCell>
     ```
     Dan pada tombol aksi check-in di baris `271-294`, tampilkan status parsial `Hadir ${checkedQty}/${ticketCount}` serta kunci `disabled` ketika:
     ```tsx
     disabled={
     	isUpdating ||
     	!isEventTodayWita(event) ||
     	b.paymentStatus !== "PAID" ||
     	b.refundStatus === "REQUESTED"
     }
     ```
   - Pada `src/app/events/portal/page.tsx:507-532` dan `src/features/events-portal/events-portal-domain.ts:219-250`: Jangan menulis penyusunan CSV manual ber-enum mentah di `portal/page.tsx`. Panggil `buildAttendeesExportRows(exportSourceBookings)` (yang telah diperbarui agar menerjemahkan `REFUNDED` menjadi `"Dikembalikan"`, `EXPIRED` menjadi `"Kedaluwarsa"`, `PARTIALLY_CHECKED_IN` menjadi `"Sebagian hadir"`, dan menyertakan kolom `"Jenis tiket"`).
2. **Perbarui `docs/DOKUMENTASI_SERAH_TERIMA_WEB_EVENT_S16.md` (`S-16`)**:
   - Ganti seluruh kemunculan `/events/admin` menjadi `/events-admin`.
   - Sesuaikan seluruh nama tab dan tombol di panduan verifikasi manual dengan label kalimat nyata pada antarmuka yang sudah dibangun (`Moderasi`, `Pembayaran tiket`, `Pengajuan refund`, `Pencairan dana`, `Pengaturan bisnis`).
   - Hitung ulang jumlah `it()` aktual per file test dengan skrip otomatis agar setiap baris tabel Bagian 4 dan baris `TOTAL` cocok 100 persen tanpa selisih penjumlahan, serta pisahkan keterangan antara suite Web Event dan suite POS/CRM/Coworking (`S-09`, `S-10`, `S-11`).
   - Cantumkan catatan autentikasi demo (`ALLOW_DEMO_UAT=true` atau seed tabel `User` untuk login akun statis di `NODE_ENV=production`) pada Bagian 5.
   - Cantumkan secara akurat **4** file test baseline yang dikecualikan oleh `AGENTS.md` (`etl-data-validation`, `final-demo-readiness`, `organizer-activation-hardening`, `storage-sync-safety`), perbarui status transport email sesuai kode nyata di `src/lib/email.ts`, dan catat angka hasil `npm run build` yang benar-benar dijalankan.
3. **Jalankan kelima perintah verifikasi wajib sebelum menyatakan selesai**:
   Pastikan kelima perintah berikut menghasilkan angka bersih sebelum memperbarui Merge Request `!25`:
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
   Target wajib kelulusan adalah `0` temuan pada `lint:ui --strict src`, `0` error pada kedua `tsc --noEmit`, seluruh suite Vitest lulus kecuali maksimal 4 file baseline di `AGENTS.md`, dan `npm run build` keluar dengan kode `0`.
