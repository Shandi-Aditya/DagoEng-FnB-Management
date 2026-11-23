# Laporan Audit Keamanan Endpoint dan Penutupan Kebocoran Data (Task S-32)

Dokumen ini mencatat audit menyeluruh terhadap seluruh endpoint API (`src/app/api/**`) pada repositori DagoEng POS & Web Event, khususnya endpoint metode `GET`, guna memastikan tidak ada kebocoran data sensitif (PII member/karyawan, data transaksi finansial, atau kredensial) kepada pengguna tanpa login atau peran (*role*) yang tidak berhak.

---

## 1. Ringkasan Eksekutif

Audit dilakukan terhadap **33 endpoint GET** dan **18 endpoint mutasi** di dalam `src/app/api/`.
Sebelum task ini:
1. `GET /api/loyalty/members`: Pengguna tanpa login dapat memicu galat atau kebocoran data jika auth guard tidak mengunci role dengan ketat, dan role non-kasir/non-manajemen (`WAITER`, `KITCHEN_STAFF`, dll.) dapat membaca seluruh data member.
2. `GET /api/employees`: **Celah kritis**. Endpoint tidak memanggil fungsi otorisasi sama sekali, sehingga siapa pun tanpa login dapat mengunduh seluruh profil karyawan (nama lengkap, nomor HP, email, shift, dan izin sistem).
3. `POST /api/tenant/operations`: Endpoint tidak memiliki pemeriksaan sesi login, membiarkan pihak luar memanipulasi jam buka/tutup mitra.
4. `GET /api/reports/closing/pdf`: Endpoint pratinjau closing shift tidak memeriksa sesi login kasir/manajer.
5. `GET /api/products`: Menampilkan estimasi HPP (`cogsEstimate`) dan persentase margin kotor (`grossMarginPercent`) ke publik atau pelanggan umum.

Seluruh celah tersebut telah ditutup dan diverifikasi dengan tes otomatis `tests/s32-member-data-leak-and-endpoint-audit.test.ts`.

---

## 2. Rincian Penutupan Celah Utama (S-32)

### 2.1 Endpoint `/api/loyalty/members`
- **Sebelum**: Role non-manajerial di luar `CUSTOMER` (seperti `WAITER` atau `KITCHEN_STAFF`) tidak disaring dan menerima daftar seluruh member.
- **Perbaikan**:
  - Tanpa login: Mengembalikan HTTP `401 Unauthorized` (`Akses ditolak. Sesi login diperlukan.`).
  - Pembatasan Role: Hanya `SUPER_ADMIN`, `OWNER`, `MANAGER`, `CASHIER`, dan `CUSTOMER` yang diizinkan mengakses. Role lain menerima HTTP `403 Forbidden`.
  - Isolasi Pelanggan (`CUSTOMER`): Pelanggan hanya dapat melihat data dirinya sendiri (berdasarkan kecocokan `email` atau `userId`). Jika mencari pelanggan lain atau nomor telepon lain, server mengembalikan array kosong atau HTTP `403`. Nomor identitas (`identityNo`) selalu dikosongkan.
  - Kasir (`CASHIER`): Kontak telepon dan email pelanggan disamarkan (`+62 819-****-3344`, `ke***n@gmail.com`) dan `identityNo` dikosongkan untuk mencegah pencurian data massal.

### 2.2 Endpoint `/api/employees`
- **Sebelum**: `GET /api/employees` terbuka untuk umum tanpa pemeriksaan login.
- **Perbaikan**:
  - Menambahkan verifikasi autentikasi `getRequestAuthUser(req)`.
  - Tanpa login: Mengembalikan HTTP `401 Unauthorized`.
  - Role `CUSTOMER`: Ditolak dengan HTTP `403 Forbidden`.
  - Staf Non-Manajerial (`CASHIER`, `WAITER`, `KITCHEN_STAFF`): Menerima data karyawan dengan kontak telepon dan email yang disamarkan (*masked*).
  - Manajemen (`SUPER_ADMIN`, `OWNER`, `MANAGER`): Menerima data kontak lengkap untuk kebutuhan operasional outlet.

### 2.3 Endpoint `/api/reports/closing/pdf`
- **Sebelum**: Terbuka tanpa autentikasi, parameter URL diinterpolasi ke template HTML tanpa sanitasi.
- **Perbaikan**:
  - Mewajibkan sesi login kasir atau manajer (`SUPER_ADMIN`, `OWNER`, `MANAGER`, `CASHIER`). Panggilan tanpa login ditolak dengan HTTP `401`, role lain ditolak `403`.
  - Seluruh parameter input URL query (`outlet`, `cashier`, `date`, `time`, `docNo`, `notes`) disanitasi menggunakan `escapeHtml` guna mencegah celah Reflected XSS.

### 2.4 Endpoint `/api/tenant/operations`
- **Sebelum**: Metode `POST` dapat dipanggil tanpa login untuk mengubah jam operasional tenant.
- **Perbaikan**:
  - Metode `POST` dikunci hanya untuk role manajerial (`SUPER_ADMIN`, `OWNER`, `MANAGER`). Panggilan tanpa login ditolak dengan HTTP `401`.
  - Penegakan Batas Tenant (*Tenant Boundary*): Akun pemilik tenant (`OWNER` dengan scope `TENANT`) dibatasi secara ketat hanya dapat memodifikasi tenant miliknya sendiri (`auth.tenantId`). Upaya mengubah tenant mitra lain ditolak dengan HTTP `403`.

### 2.5 Endpoint `/api/products`
- **Sebelum**: Mengembalikan nilai HPP (`cogsEstimate`) dan persentase margin kotor (`grossMarginPercent`) ke semua pemanggil.
- **Perbaikan**:
  - Untuk pemanggil tanpa login atau role non-manajerial (`CUSTOMER`, tamu umum), nilai `cogsEstimate` dinetralkan ke `0` dan `grossMarginPercent` ke `"0%"`.
  - Pemilik tenant (`OWNER` scope `TENANT`) tetap diizinkan melihat data HPP untuk produk milik tenant-nya sendiri.

### 2.6 Endpoint `/api/settings/settlement-receipt`
- **Sebelum**: Terbuka untuk semua sesi terautentikasi (termasuk Customer).
- **Perbaikan**: Dikunci hanya untuk `SUPER_ADMIN`, `OWNER`, dan `MANAGER`. Role lain (seperti `CUSTOMER`) ditolak dengan HTTP `403`.

---

## 3. Matriks Hasil Audit Seluruh Endpoint GET

| No | Endpoint | Autentikasi | Role yang Diizinkan | Keterangan & Tindakan |
| :---: | :--- | :---: | :--- | :--- |
| 1 | `/api/loyalty/members` | Wajib (401) | `SUPER_ADMIN`, `OWNER`, `MANAGER`, `CASHIER`, `CUSTOMER` (hanya diri sendiri) | **Diperbaiki**. Role lain ditolak 403; kasir disamarkan. |
| 2 | `/api/employees` | Wajib (401) | `SUPER_ADMIN`, `OWNER`, `MANAGER`, `CASHIER`, `WAITER`, `KITCHEN_STAFF` | **Diperbaiki**. Customer ditolak 403; staf disamarkan. |
| 3 | `/api/reports/closing/pdf` | Wajib (401) | `SUPER_ADMIN`, `OWNER`, `MANAGER`, `CASHIER` | **Diperbaiki**. Tanpa login ditolak 401. |
| 4 | `/api/tenant/operations` | Publik (GET) / Wajib (POST) | GET: Publik (jam buka); POST: Manajemen | **Diperbaiki**. POST dikunci 401/403. |
| 5 | `/api/products` | Publik (Sanitasi) | Semua role (manajemen melihat HPP) | **Diperbaiki**. HPP & margin disamarkan untuk publik/customer. |
| 6 | `/api/audit-logs` | Wajib (401) | `SUPER_ADMIN`, `OWNER`, `MANAGER` | Aman. Memeriksa `getRequestAuthUser` dan role admin. |
| 7 | `/api/auth/session` | Wajib (401) | Semua role login | Aman. Mengembalikan identitas sesi aktif pemanggil. |
| 8 | `/api/coworking/bookings` | Wajib (401) | Staff & `CUSTOMER` (hanya booking miliknya) | Aman. Booking orang lain disamarkan menjadi "Terisi". |
| 9 | `/api/orders` | Wajib (401) | `ORDER_READ_ROLES` (Staff outlet) | Aman. Menolak customer dan publik dengan 401/403. |
| 10 | `/api/orders/self-order` | Dibatasi ID | Tamu dengan ID pesanan sah | Aman. Hanya memfilter pesanan yang cocok dengan `ids` (maks 20). |
| 11 | `/api/shifts` | Wajib (401) | `SUPER_ADMIN`, `OWNER`, `MANAGER`, `CASHIER` | Aman. Menolak role non-kasir/publik dengan 401/403. |
| 12 | `/api/events/admin` | Wajib (403) | `SUPER_ADMIN`, `OWNER`, `MANAGER` | Aman. Memeriksa `assertEventAdmin`. |
| 13 | `/api/events/admin/organizers` | Wajib (403) | `SUPER_ADMIN`, `OWNER`, `MANAGER` | Aman. Memeriksa `assertEventAdmin`. |
| 14 | `/api/events/admin/refunds` | Wajib (403) | `SUPER_ADMIN`, `OWNER`, `MANAGER` | Aman. Memeriksa `assertEventAdmin`. |
| 15 | `/api/events/admin/settings` | Wajib (403) | `SUPER_ADMIN`, `OWNER`, `MANAGER` | Aman. Memeriksa `assertEventAdmin`. |
| 16 | `/api/events/admin/settings/banks` | Wajib (403) | `SUPER_ADMIN`, `OWNER`, `MANAGER` | Aman. Memeriksa `assertEventAdmin`. |
| 17 | `/api/events/bookings` | Wajib (403) | Admin, Petugas Check-in, Penyelenggara (event miliknya) | Aman. Verifikasi berlapis `assertEventAdmin`, `assertCheckInAuth`, `assertOrganizerAuth`. |
| 18 | `/api/events/bookings/my` | Wajib / Token | Pengguna login (email sendiri) atau Guest Token >= 16 char | Aman. Tanpa token/login ditolak 401; larang pencarian email lain. |
| 19 | `/api/events/bookings/[id]/refund` | Wajib (401) | Pemilik booking (guestToken cocok / email sesi) | Aman. Verifikasi kepemilikan kriptografis. |
| 20 | `/api/events/portal` | Wajib (403) | Penyelenggara terdaftar | Aman. Memeriksa `assertOrganizerAuth`. |
| 21 | `/api/events/[id]/promos` | Wajib (403) | Admin, Penyelenggara event, atau publik dengan query `?code=` | Aman. Daftar kode promo tersembunyi kecuali kode valid dicocokkan. |
| 22 | `/api/events/[id]` | Publik | Semua pengunjung | Aman. Hanya mengembalikan data event publik yang disetujui. |
| 23 | `/api/events` | Publik | Semua pengunjung | Aman. Katalog acara komunitas publik. |
| 24 | `/api/events/tickets/[token]` | Token Publik | Pemegang token tiket sah | Aman. Hanya memuat tiket yang cocok dengan token 64-karakter. |
| 25 | `/api/events/auth/activate` | Token Publik | Penyelenggara bervalidasi token | Aman. Memvalidasi token undangan aktivasi. |
| 26 | `/api/events/posters/[filename]` | Publik | Semua pengunjung | Aman. File gambar poster statis. |
| 27 | `/api/events/proofs/[filename]` | Wajib (403) | Admin & Petugas Event | Aman. Bukti transfer bank terlindung dari akses publik. |
| 28 | `/api/notifications/closing-chatbot` | Wajib (401) | `SUPER_ADMIN`, `OWNER`, `MANAGER`, `CASHIER` | Aman. Memeriksa sesi operasional. |
| 29 | `/api/pos/qris/verify` | Wajib (401) | `SUPER_ADMIN`, `OWNER`, `MANAGER`, `CASHIER` | Aman. Verifikasi pembayaran kasir. |
| 30 | `/api/settings/settlement-receipt` | Wajib (401) | `SUPER_ADMIN`, `OWNER`, `MANAGER` | Aman. Laporan bagi hasil mitra terlindung. |
| 31 | `/api/sync/[domain]` | Wajib (401) | Sesi staf terautentikasi | Aman. Sinkronisasi outbox storage server. |
| 32 | `/api/system/health` | Publik | Monitor uptime | Aman. Mengembalikan status sistem tanpa data sensitif. |
| 33 | `/api/webhooks/doku/simulate` | Terkunci | Ditolak total di produksi (`NODE_ENV=production`) | Aman. Simulasi sandbox terkunci. |

---

## 4. Kesimpulan dan Bukti Verifikasi

1. Kriteria `Tanpa login -> 401`: Terpenuhi pada `/api/loyalty/members`, `/api/employees`, `/api/reports/closing/pdf`, dan seluruh endpoint transaksional.
2. Kriteria `Customer hanya melihat data dirinya`: Terpenuhi pada `/api/loyalty/members` (disaring ketat berdasarkan email/userId sesi) dan `/api/coworking/bookings` (booking lain di-anonymize).
3. Kriteria `Daftar endpoint yang dicek tercatat`: Seluruh 33 endpoint GET tercatat lengkap dalam laporan ini.
4. Pengujian otomatis: `tests/s32-member-data-leak-and-endpoint-audit.test.ts` (19/19 skenario lulus) dan `tests/customer-role-access-and-tier.test.ts` (27/27 skenario lulus).
