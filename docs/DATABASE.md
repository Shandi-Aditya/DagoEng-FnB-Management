# Struktur database dan penyimpanan data

DagoEng Management menggunakan **PostgreSQL di Neon** dengan **Prisma ORM `5.22.0`** dalam arsitektur dua lapis: skema relasional ternormalisasi di `prisma/schema.prisma` dan penyimpanan dokumen operasional ter-replikasi pada tabel `system_settings` dengan awalan kunci `STORAGE_`.

## 1. Lapisan relasional Prisma (`prisma/schema.prisma`)

Skema Prisma mendefinisikan **32 model** pada 7 domain bisnis. Jumlah model dapat diverifikasi dengan perintah berikut:

```bash
grep -c '^model ' prisma/schema.prisma
```

Daftar lengkap model per domain adalah sebagai berikut:

| Domain | Model Prisma (nama tabel PostgreSQL) | Fungsi utama |
|---|---|---|
| **Autentikasi & RBAC Dinamis (7)** | `User` (`users`), `Role` (`roles`), `Permission` (`permissions`), `RolePermission` (`role_permissions`), `UserRole` (`user_roles`), `Session` (`sessions`), `AuditLog` (`audit_logs`) | Akun pengguna, 9 peran sistem, izin modular, penugasan lingkup (`PLATFORM` hingga `OUTLET`), hash SHA-256 token sesi, dan log audit relasional. |
| **Organisasi, Gerai & Mitra (5)** | `Organization` (`organizations`), `Outlet` (`outlets`), `Tenant` (`tenants`), `Employee` (`employees`), `Customer` (`customers`) | Struktur induk Dago Creative Hub, cabang gerai, mitra F&B dengan persentase komisi, profil karyawan, serta pelanggan walk-in tanpa kewajiban akun (`userId` opsional). |
| **Katalog Produk F&B (5)** | `Category` (`categories`), `Product` (`products`), `ProductVariant` (`product_variants`), `ModifierGroup` (`modifier_groups`), `ModifierOption` (`modifier_options`) | Kategori menu, produk per `tenantId`, penyesuaian harga varian, dan opsi tambahan pesanan. |
| **Shift Kasir (1)** | `CashierShift` (`cashier_shifts`) | Pembukaan dan penutupan laci kasir (`startingCash`, `expectedCash`, `actualCash`, `cashDiff`). |
| **Co-Working & Virtual Office (6)** | `RoomCategory` (`room_categories`), `Room` (`rooms`), `Reservation` (`reservations`), `MembershipPackage` (`membership_packages`), `CustomerMembership` (`customer_memberships`), `VirtualOfficePackage` (`virtual_office_packages`) | Ruangan kerja per jam/harian/bulanan, reservasi ruang, paket kuota jam member, dan paket kantor virtual. |
| **Meja, Pesanan & KDS (4)** | `TableArea` (`table_areas`), `Table` (`tables`), `Order` (`orders`), `OrderItem` (`order_items`) | Zona denah meja, kapasitas meja dine-in, header transaksi pesanan, dan status dapur per item (`tenantStatus`). |
| **Pengaturan Sistem & Akuntansi (4)** | `SystemSetting` (`system_settings`), `ChartOfAccount` (`chart_of_accounts`), `CostBulanan` (`cost_bulanan`), `HutangAdmin` (`hutang_admin`) | Tabel kunci-nilai `system_settings` tempat dokumen `STORAGE_*` disimpan beserta kolom `updatedAt` untuk penguncian optimis, ditambah tabel akun biaya dan kewajiban admin. |

## 2. Lapisan dokumen operasional (`system_settings` `STORAGE_*`)

Pada fase operasional saat ini, modul POS, KDS, Inventori, Co-working, Komersial, Pengaturan, dan Event membaca serta menulis dokumen JSON ke direktori lokal (`<cwd>/data/<filename>` pada server Node atau `/tmp/dago-data/<filename>` pada lingkungan serverless) yang direplikasi secara atomik ke kolom `value` pada tabel `system_settings`. Rincian audit antara peramban dan server tersedia di [AUDIT_PENYIMPANAN_DATA.md](./AUDIT_PENYIMPANAN_DATA.md).

### 2.1 Sembilan domain sinkronisasi terpadu (`/api/sync/[domain]`)

| Domain API | Kunci `system_settings` | Berkas spesifikasi | Isi data utama |
|---|---|---|---|
| `platform-settings` | `STORAGE_platform_settings.json` | `src/lib/sync-domains/config-spec.ts` | Tarif PB1, service charge, modul aktif organisasi, dan jadwal operasional mitra. |
| `tenants` | `STORAGE_tenants_directory.json` | `src/lib/sync-domains/config-spec.ts` | Profil mitra F&B, nomor telepon kontak, dan rekening pencairan (disamarkan lintas mitra). |
| `wifi` | `STORAGE_wifi_state.json` | `src/lib/sync-domains/config-spec.ts` | Aturan pembangkitan dan riwayat kode voucher Wi-Fi untuk F&B serta Co-working. |
| `subscription` | `STORAGE_subscription_state.json` | `src/lib/sync-domains/config-spec.ts` | Paket langganan organisasi dan add-on fitur per mitra. |
| `printer-config` | `STORAGE_printer_config.json` | `src/lib/sync-domains/config-spec.ts` | Daftar perangkat printer thermal dan pengaturan cetak otomatis dapur. |
| `inventory` | `STORAGE_inventory_state.json` | `src/lib/sync-domains/inventory-spec.ts` | 19 bahan baku, 16 resep BOM, Purchase Order, log mutasi stok, dan Stock Opname. |
| `tables` | `STORAGE_tables_state.json` | `src/lib/sync-domains/spaces-spec.ts` | Area meja, status okupansi meja dine-in, dan reservasi meja. |
| `coworking-master` | `STORAGE_coworking_master.json` | `src/lib/sync-domains/spaces-spec.ts` | Katalog kursi/ruang rapat, paket membership, data member, dan log check-in ruang kerja. |
| `commercial` | `STORAGE_commercial_leases.json` | `src/lib/sync-domains/spaces-spec.ts` | Kontrak sewa unit komersial dan pencatatan tagihan bulanan. |

### 2.2 Tiga belas dokumen operasional POS, shift, CRM, dan kebijakan

| Kunci `system_settings` | Pengelola utama | Kegunaan dan jaminan integritas |
|---|---|---|
| `STORAGE_pos_orders.json` | `src/lib/persistent-storage.ts`, `/api/orders`, `/api/orders/self-order` | Seluruh pesanan kasir dan QR meja beserta rincian pajak struk, `tenantStatuses`, refund, dan void. |
| `STORAGE_shifts.json` | `src/lib/persistent-storage.ts`, `/api/shifts` | Riwayat buka/tutup shift kasir, penjualan tunai, refund kas, dan alasan selisih laci. |
| `STORAGE_coworking_bookings.json` | `src/lib/persistent-storage.ts`, `/api/coworking/bookings` | Transaksi sewa ruang kerja Co-working dan pembayaran QRIS terkait. |
| `STORAGE_master_products.json` | `src/lib/persistent-storage.ts`, `/api/products` | Katalog menu F&B aktif beserta kategori kustom yang diaudit sebelum dan sesudah perubahan. |
| `STORAGE_employees.json` | `src/lib/persistent-storage.ts`, `/api/employees` | Direktori staf dan hash kata sandi karyawan. |
| `STORAGE_loyalty_members.json` | `src/lib/persistent-storage.ts`, `/api/loyalty/members` | Direktori pelanggan CRM dengan nomor telepon ternormalisasi dan tingkat keanggotaan. |
| `STORAGE_loyalty_points.json` | `src/lib/persistent-storage.ts` | Buku besar poin pelanggan yang idempoten per `orderId` (`creditedOrderIds`). |
| `STORAGE_qris_sessions.json` | `src/lib/persistent-storage.ts`, `/api/pos/qris/verify` | Sesi pembayaran QRIS yang dikunci satu kali klaim per `consumedByOrderId`. |
| `STORAGE_audit_logs.json` | `src/lib/persistent-storage.ts`, `/api/audit-logs` | Catatan audit tambah-saja (`append-only`) yang menolak duplikasi ID dengan HTTP `409`. |
| `STORAGE_session_revocations.json` | `src/lib/session-revocation.ts` | Peta waktu pencabutan sesi per pengguna/email untuk memutus sesi lintas perangkat. |
| `STORAGE_closing_chatbot_dispatches.json` | `src/lib/closing-chatbot.ts` | Riwayat idempoten pengiriman ringkasan tutup shift ke WhatsApp dan Telegram. |
| `STORAGE_tenant_operations.json` | `/api/tenant/operations`, `/api/sync/platform-settings` | Jam buka-tutup mitra dan override buka/tutup manual. |
| `STORAGE_settlement_receipt_policy.json` | `src/lib/settlement-receipt-policy.ts` | Dasar perhitungan bagi hasil (`RECEIPT_NET_BEFORE_TAX`), persentase mitra, dan matriks peran cetak struk. |

### 2.3 Enam dokumen marketplace event dan dua berkas lokal

- **Tersinkronisasi ke `system_settings` (6 kunci).** `STORAGE_events.json`, `STORAGE_event_bookings.json`, `STORAGE_event_settings.json`, `STORAGE_organizers.json`, `STORAGE_organizer_credentials.json`, dan `STORAGE_unified_users.json`.
- **Khusus disk lokal (2 berkas).** `organizer_invites.json` (token aktivasi 48 jam) dan `organizer_sessions.json` (cadangan sesi lokal saat pengembangan non-produksi), ditambah direktori biner bukti transfer pada `<cwd>/data/proofs/` (di-mount ke volume persisten `/app/data/proofs` pada Coolify).

## 3. Pengendalian konkurensi dan pencegah kehilangan data

1. **Antrean kunci per berkas (`withFileLock`).** `src/lib/data-storage.ts` mengeksekusi baca-tulis setiap berkas JSON secara berurutan di dalam satu proses Node.
2. **Penjaga cold-start dan batas waktu 8 detik.** `syncStorageFromDb` memiliki batas waktu baca `8000ms`. Apabila pembacaan awal ke Neon gagal atau mengalami timeout (`UNAVAILABLE`, `TIMEOUT`, atau `INVALID_DATA`), `persistStorageToDb` memblokir penulisan (`RISK_DATA_LOSS`) agar data seed bawaan kontainer tidak menimpa data produksi di Neon.
3. **Optimistic Compare-And-Swap (`updatedAt`).** Pembaruan baris `STORAGE_*` memverifikasi kecocokan `updatedAt` terakhir (`updateMany` dengan klausa `where: { key, updatedAt }`). Apabila instans lain telah mengubah data lebih dulu, mutasi dihentikan dengan `LOST_UPDATE_PREVENTED`. Pengaturan bank event (`/api/events/admin/settings/banks`) menggunakan mode ketat `requireCas: true` dengan satu kali percobaan ulang otomatis.
4. **Kunci transaksional PostgreSQL untuk kuota tiket.** Mutasi kapasitas dan pemesanan tiket pada `src/lib/events.ts` menjalankan `SELECT pg_advisory_xact_lock(...)` di dalam `db.$transaction` agar pembelian serentak tidak melampaui kuota tiket.

## 4. Perbedaan seed awal Prisma dan data operasional aktif

Skrip `prisma/seed.ts` merupakan seeder relasional fase awal yang mengisi contoh organisasi `KOPI-SENJA` dan `BALI-BREW` ke tabel Prisma. Sebaliknya, operasional aplikasi berjalan di atas **Dago Creative Hub** (`DAGO-HUB`) dengan satu gerai aktif **Singaraja (Pusat)** (`KS-SGR`), dua gerai `COMING_SOON` (`Denpasar` dan `Ubud`), serta empat mitra F&B resmi (`Kopi Senja`, `Dapur Mama`, `Manis Bakery`, dan `Warung Bu Narti`). Migrasi penuh dokumen JSON `STORAGE_*` ke dalam ke-32 tabel relasional Prisma dijadwalkan sebagai pekerjaan tahap pengembangan berikutnya (Phase 3).
