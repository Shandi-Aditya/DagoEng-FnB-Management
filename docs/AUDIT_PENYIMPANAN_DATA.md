# Audit Penyimpanan Data (localStorage vs Server)

Dokumen ini disusun untuk Task V-04 sebagai dasar diskusi arsitektur data bersama Ka Ari.
Tujuannya memetakan seluruh data operasional POS dan F&B yang saat ini tersimpan di browser (localStorage) versus server.
Pemetaan ini menjadi acuan eksekusi migrasi data inti pada Task V-06 (Minggu M2).

## 1. Tabel Inventarisasi Penyimpanan Data

| Entitas Data | Sumber Browser (localStorage) | Sumber Server Saat Ini | Status | Risiko Kehilangan Data | Prioritas Migrasi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Orders** (Pesanan POS & F&B) | `dago_fnb_orders`, outbox `dagoeng_sync_outbox_v1` | `/api/orders` (`pos_orders.json` disinkronkan ke PostgreSQL) | Hybrid (Cache + Server) | Rendah (tersimpan di server saat online). | P1 |
| **Shifts** (Buka/Tutup Shift Kasir) | `dagoeng_shifts_v3`, outbox `dagoeng_sync_outbox_v1` | `/api/shifts` (`shifts.json` disinkronkan ke PostgreSQL) | Hybrid (Cache + Server) | Rendah (shift tersimpan di server). | P1 |
| **Audit Trail** (Log Audit Sistem) | `dagoeng_audit_trail_persistent_v3` | `/api/audit-logs` (`audit_logs.json` disinkronkan ke PostgreSQL) | Hybrid (Cache + Server) | Rendah (audit tersinkronisasi ke server). | P2 |
| **Loyalty Members** (Member CRM & Poin) | `dagoeng_loyalty_members_v3` | Hanya `loyalty_points.json` saat order POS lunas | Browser Only (95%) | Kritis (clear browser menghapus seluruh member). | P1 |
| **Employees** (Profil Karyawan & Akun) | `dagoeng_employees_v1` | Tidak ada endpoint (hanya inisial hardcoded) | Browser Only (100%) | Kritis (perubahan PIN / staff hilang saat clear cache). | P1 |
| **Master Products** (Menu & Kategori F&B) | `dagoeng_master_products_v1`, `dagoeng_master_categories_v1` | Tidak ada endpoint aktif (mock toggle saja) | Browser Only (100%) | Kritis (menu baru tidak muncul di perangkat lain). | P1 |
| **Coworking Bookings** (Reservasi Ruang) | `dagoeng_cwk_bookings_v3` | `/api/coworking/bookings` (`coworking_bookings.json`) | Hybrid (Cache + Server) | Rendah untuk booking. | P2 |
| **Coworking Spaces & Members** | `dagoeng_cwk_spaces_v3`, `dagoeng_cwk_members_v3` | Tidak ada endpoint | Browser Only (100%) | Tinggi (daftar paket membership hilang). | P2 |
| **Platform Settings** (Pengaturan Sistem) | `dagoeng_platform_settings_v3` | `/api/tenant/operations` (jam buka-tutup mitra saja) | Sebagian Server (20%) | Sedang (pengaturan pajak/wifi kembali ke default). | P2 |
| **Inventory & Resep** (BOM & Bahan Baku) | `dagoeng_ingredients_v1`, `dagoeng_recipes_v1`, `dagoeng_stock_opnames_v1` | Tidak ada endpoint | Browser Only (100%) | Tinggi (stok opname tidak tersentralisasi). | P2 |
| **Tables & Meja** (Area Meja Resto) | `dagoeng_table_areas_v1`, `dagoeng_table_reservations_v1` | Tidak ada endpoint | Browser Only (100%) | Sedang (denah meja lokal di kasir). | P3 |
| **Web Event & Tiket** (Modul Event) | Local tiket recovery | `/api/events/*` (PostgreSQL Advisory Lock) | Full Server | Aman (sudah sepenuhnya di cloud database). | Selesai |

## 2. Temuan Utama Arsitektur

1. Data transaksional utama (Orders, Shifts, Audit Trail, Coworking Bookings) sudah berstatus hybrid. Data membaca dari server saat mount dan mengirim perubahan ke endpoint server.
2. Server saat ini menyimpan data sebagai file JSON di disk server (`data/*.json`). File tersebut disinkronkan ke tabel `system_settings` PostgreSQL sebagai payload string JSON.
3. Skema tabel relasional PostgreSQL yang sebenarnya (`orders`, `order_items`, `cashier_shifts`, `products`, `customers`, `employees`) sudah siap di Prisma schema. Namun tabel tersebut belum digunakan oleh runtime aplikasi.
4. Tiga master data operasional paling rawan adalah Employees, Master Products, dan Loyalty Members. Ketiganya 100% hanya berada di browser operator. Bila operator berganti tablet kasir atau membersihkan storage browser, seluruh master data tersebut kembali ke data contoh bawaan.

## 3. Rencana Migrasi ke Server (Bahan Diskusi Ka Ari)

### Fase 1: Penyelamatan Master Data Operasional (Target Minggu M2 - Task V-06)
- Bangun endpoint server untuk Employees (`/api/employees`).
- Bangun endpoint server untuk Master Products dan Categories (`/api/products`).
- Bangun endpoint server untuk Loyalty Members (`/api/loyalty/members`).
- Pasang mekanisme server hydration pada `ProductContext`, `LoyaltyContext`, dan `EmployeeShiftContext`.
- Simpan data ke server storage terpusat agar tablet kasir dan laptop admin membaca data yang identik.

### Fase 2: Standarisasi Offline Sync Outbox (Target Minggu M2 - Task V-06)
- Gunakan `localStorage` murni sebagai cache lokal dan antrean outbox saat jaringan offline.
- Terapkan retry outbox otomatis dengan validasi idempotensi pada semua endpoint server.
- Pastikan penghapusan cache browser tidak menghilangkan transaksi maupun master data.

### Fase 3: Transisi dari JSON Storage ke Tabel Relasional Prisma (Target Minggu M3/M4)
- Alihkan penyimpanan dari file JSON disk ke query Prisma langsung pada PostgreSQL Neon.
- Lakukan migrasi data (ETL) dari file JSON ke tabel relasional `orders`, `order_items`, `cashier_shifts`, dan `customers`.
- Manfaatkan relasi SQL untuk laporan transaksi akurat dan settlement mitra F&B.

## 4. Rekomendasi Keputusan untuk Ka Ari

1. Menyetujui pembuatan endpoint master data (`/api/employees`, `/api/products`, `/api/loyalty/members`) pada Task V-06.
2. Mempertahankan format `persistent-storage` JSON pada Fase 1 agar tidak mengganggu kecepatan rilis fitur M2.
3. Menjadwalkan migrasi ke Prisma relasional pada Fase 3 setelah alur settlement mitra dan laporan closing selesai diverifikasi.
