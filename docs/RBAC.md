# Otorisasi 3-dimensi dan matriks RBAC

DagoEng Management mengevaluasi hak akses setiap pengguna melalui irisan tiga sumbu independen di sisi klien maupun server:

$$\text{Akses Diizinkan} = \text{Role Permission} \cap \text{Scope Hierarchy} \cap \text{Active Business Module}$$

```mermaid
flowchart LR
    subgraph Axis1 ["1. Peran (RoleSlug)"]
        R1["Izin fungsional di src/lib/rbac.ts dan src/lib/role-matrix.ts"]
    end

    subgraph Axis2 ["2. Hierarki Lingkup (5 ScopeLevel)"]
        S1["5: PLATFORM"]
        S2["4: ORGANIZATION (Dago Creative Hub)"]
        S3["3: BUSINESS_UNIT (Cowork / Commercial)"]
        S4["2: TENANT (Mitra F&B)"]
        S5["1: OUTLET (Singaraja Pusat)"]
    end

    subgraph Axis3 ["3. Modul Bisnis (4 Kode)"]
        M1["CORE (Selalu aktif)"]
        M2["FNB"]
        M3["CO_WORKING"]
        M4["COMMERCIAL"]
    end

    Axis1 --> Guard["Middleware Edge & Guard API Server"]
    Axis2 --> Guard
    Axis3 --> Guard
    Guard --> Result{"Diizinkan atau Ditolak (401/403/Redirect)"}
```

## 1. Peran sistem dan cakupan rute

Penegakan akses rute dijalankan oleh `src/middleware.ts` dan `src/lib/route-guard.ts` pada 18 awalan rute dashboard, serta diperkuat di tiap endpoint API menggunakan `getRequestAuthUser` di `src/lib/server-auth.ts`:

| `RoleSlug` | Lingkup umum | Rute bawaan | Hak operasional dan pembatasan utama |
|---|---|---|---|
| `SUPER_ADMIN` | `PLATFORM` | `/dashboard` | Akses penuh lintas modul, pengaturan platform, pengelolaan kebijakan bagi hasil, manajemen karyawan, dan diagnostik `/api/system/health`. |
| `FINANCE` | `PLATFORM` | `/reports` | Pengawasan keuangan konsolidasi Dago, monitoring bagi hasil tunai vs QRIS, audit log finansial, dan verifikasi payout tanpa hak modifikasi langsung operasional kasir. |
| `OWNER` (Hub) | `ORGANIZATION` | `/dashboard` | Akses eksekutif konsolidasi seluruh unit bisnis Dago Creative Hub, pengubahan kebijakan bagi hasil mitra, dan persetujuan langsung void atau refund. |
| `OWNER` (Mitra F&B) | `TENANT` | `/dashboard` | Terkunci ketat pada `tenantId` miliknya di dashboard, pesanan, menu, KDS, inventori, dan laporan bagi hasil. Diblokir oleh `TENANT_OWNER_BLOCKED_PREFIXES` dari `/coworking`, `/commercial`, `/employees`, `/events-admin`, `/activity-log`, `/customers`, dan `/events/checkin`. |
| `MANAGER` | `BUSINESS_UNIT` / `ORGANIZATION` | `/commercial` atau `/coworking` | Mengelola operasional unit bisnis, inventori, laporan, dan persetujuan void atau refund tanpa perlu memasukkan PIN supervisor. |
| `CASHIER` | `OUTLET` | `/pos` | Mengoperasikan kasir POS, buka/tutup shift laci kas, dan klaim pesanan meja. Diblokir dari ekspor data pelanggan CRM dengan nomor telepon dan email pelanggan tersamar (`S-09`). Wajib memasukkan `SUPERVISOR_OVERRIDE_PIN` untuk konfirmasi manual QRIS statis, void, dan refund (`V-05`, `V-13`). |
| `KITCHEN_STAFF` | `OUTLET` | `/kitchen` | Mengelola papan KDS (`/kitchen`) yang difilter ketat hanya untuk item milik mitranya (`V-09`). Nominal rupiah pada pesanan disembunyikan (`—`), tombol refund dinonaktifkan, dan akses ke `/customers` maupun `/pos` ditolak (`V-19`). Memiliki hak pencatatan waste bahan. |
| `INVENTORY_STAFF` | `OUTLET` | `/inventory` | Mengelola stok bahan baku gudang, Purchase Order, dan Stock Opname pada `/inventory`. |
| `WAITER` | `OUTLET` | `/waiter` | Mengelola status meja lantai, input pesanan, dan menerima notifikasi pesanan siap saji dari dapur pada `/waiter` serta `/tables`. |
| `CHECKIN_STAFF` | `ORGANIZATION` | `/events/checkin` | Khusus meja registrasi tiket event hari berjalan WITA (`/events/checkin`). Diblokir penuh dari POS, KDS, CRM, dan AI Insight (`V-19`). |
| `CUSTOMER` | `OUTLET` / `TENANT` | `/customer` atau `/events/portal` | Pemesanan mandiri via QR meja, pemesanan tiket event, atau pengelolaan acara komunitas bagi akun yang terdaftar sebagai organizer. |

Daftar email dan kata sandi akun pengujian untuk setiap peran tersedia di [AKUN_SISTEM.md](./AKUN_SISTEM.md).

## 2. Role matrix POS F&B multi-mitra

Berikut implementasi matriks hak akses pengguna pada operasional POS F&B multi-mitra Dago Creative Hub yang dimodelkan di `src/types/rbac.ts` dan dievaluasi secara murni di `src/lib/role-matrix.ts`.

### Definisi tingkat akses

- **Penuh:** Bisa melihat, membuat, mengubah, dan menghapus data.
- **Terbatas:** Hanya bisa mengakses data, outlet, atau shift miliknya sendiri.
- **Approval:** Bisa melakukan tindakan, tetapi wajib mendapatkan persetujuan PIN Manager atau Owner dan tercatat di audit log.
- **Lihat:** Hanya bisa melihat data tanpa mengubahnya.
- **Kosong:** Tidak memiliki akses.

### Tabel matriks hak akses operasional

| Kategori | Fitur / Hak Akses | Super Admin | Finance | Owner / Mitra | Manager | Kasir | Waitress | Dapur / Bar | Gudang | Catatan Khusus |
|---|---|---|---|---|---|---|---|---|---|---|
| **1. Platform** | Kelola mitra & skema bagi hasil | Penuh | Lihat | Kosong | Kosong | Kosong | Kosong | Kosong | Kosong | Termasuk persentase bagi hasil pembayaran Tunai dan QRIS. |
| **1. Platform** | Pengaturan outlet & struk | Penuh | Kosong | Terbatas | Kosong | Kosong | Kosong | Kosong | Kosong | Owner hanya dapat mengatur outlet miliknya sendiri. |
| **1. Platform** | Kelola user & role | Penuh | Kosong | Terbatas | Kosong | Kosong | Kosong | Kosong | Kosong | Owner hanya dapat mengelola staf outletnya sendiri. |
| **2. Master Data** | Master menu & harga | Lihat | Terbatas | Terbatas | Lihat | Kosong | Kosong | Kosong | Kosong | Owner dan Finance terbatas pada katalog tenant terkait. |
| **2. Master Data** | Atur promo / diskon terjadwal | Lihat | Terbatas | Terbatas | Lihat | Kosong | Kosong | Kosong | Kosong | Promo terjadwal diselaraskan dengan batas tenant. |
| **3. Kasir** | Buka/tutup shift & kas awal | Kosong | Kosong | Lihat | Penuh | Terbatas | Kosong | Kosong | Kosong | Kasir hanya mengelola shift miliknya sendiri. |
| **3. Kasir** | Input pesanan (Dine-in / Takeaway / Delivery) | Kosong | Kosong | Penuh | Penuh | Penuh | Penuh | Kosong | Kosong | Mendukung multi-meja dan order omnichannel. |
| **3. Kasir** | Kelola meja (Pindah / Gabung / Split Bill) | Kosong | Kosong | Penuh | Penuh | Penuh | Penuh | Kosong | Kosong | Operasional meja lantai restoran. |
| **3. Kasir** | Terima pembayaran (Tunai / Non-Tunai) | Kosong | Kosong | Penuh | Penuh | Penuh | Kosong | Kosong | Kosong | Otorisasi pembayaran kasir dan pencatatan laci kas. |
| **3. Kasir** | Cetak ulang struk | Kosong | Kosong | Penuh | Penuh | Penuh | Kosong | Kosong | Kosong | Setiap aksi cetak ulang tercatat di audit log. |
| **4. Kontrol Kritis** | Refund | Kosong | Lihat | Penuh | Penuh | Approval | Kosong | Kosong | Kosong | Wajib PIN supervisor/manager dan mencantumkan alasan. Tercatat di audit log. |
| **5. Dapur** | Layar Dapur (KDS): Ubah status pesanan | Kosong | Kosong | Lihat | Lihat | Kosong | Lihat | Penuh | Kosong | Update status memasak dan pesanan siap saji. |
| **5. Dapur** | Tandai menu habis | Kosong | Kosong | Penuh | Penuh | Terbatas | Kosong | Penuh | Kosong | Bergantung pada ketersediaan stok fisik harian. |
| **6. Inventori** | Stok masuk, waste, & stock opname | Kosong | Kosong | Penuh | Penuh | Kosong | Kosong | Terbatas | Penuh | Dapur/Bar hanya memiliki akses mencatat waste. |
| **7. Laporan** | Laporan penjualan | Penuh | Penuh | Terbatas | Terbatas | Terbatas | Kosong | Kosong | Kosong | Dago & Finance melihat seluruh mitra. Owner melihat outlet sendiri. Manager fokus harian. Kasir rekap shift. |
| **7. Laporan** | Laporan stok & HPP | Lihat | Lihat | Penuh | Lihat | Kosong | Kosong | Kosong | Lihat | Analisis valuasi bahan baku dan margin menu. |
| **7. Laporan** | Settlement bagi hasil (Tunai vs Non-Tunai) | Penuh | Penuh | Lihat | Kosong | Kosong | Kosong | Kosong | Kosong | Rekonsiliasi hak bagi hasil Dago vs tenant mitra. |
| **7. Laporan** | Audit log | Penuh | Lihat | Terbatas | Lihat | Kosong | Kosong | Kosong | Kosong | Jejak audit keamanan data dan kontrol kritis. |

## 3. Matriks peran cetak struk (`V-18`)

Pengaturan distribusi cetak struk disimpan di `STORAGE_settlement_receipt_policy.json` dan hanya dapat diubah oleh `SUPER_ADMIN` atau `OWNER` tingkat organisasi (`PUT /api/settings/settlement-receipt`):

- **Struk kasir dan pelanggan (`cashierReceiptRoles`).** Secara bawaan diizinkan bagi `SUPER_ADMIN`, `OWNER`, `MANAGER`, dan `CASHIER`.
- **Tiket dapur tanpa harga (`kitchenReceiptRoles`).** Secara bawaan diizinkan bagi `SUPER_ADMIN`, `OWNER`, `MANAGER`, `CASHIER`, `KITCHEN_STAFF`, dan `WAITER`.

## 4. Keamanan sesi, simulator peran, dan mode UAT vs produksi

- **Verifikasi tanpa header klien.** `getRequestAuthUser` di `src/lib/server-auth.ts` tidak pernah mempercayai header `x-user-*` dari peramban. Identitas pengguna selalu diverifikasi dari `dagoeng_session` (hash SHA-256 di database), `dagoeng_edge_token` (HMAC-SHA256 `SESSION_SECRET`), serta pemeriksaan daftar pencabutan di `STORAGE_session_revocations.json`.
- **Bilah simulator peran (`ENABLE_ROLE_SIMULATOR`).** Mengaktifkan bilah pengalih persona cepat untuk pengembangan lokal dan QA. Pada `NODE_ENV=production`, bilah simulator disembunyikan dari antarmuka, dan variabel `ENABLE_ROLE_SIMULATOR` saja tetap menolak login demo untuk peran berhak tinggi (`SUPER_ADMIN`, `FINANCE`, `OWNER`, `MANAGER`).
- **Sakelar UAT (`ALLOW_DEMO_UAT`) dan penguncian produksi (`DISABLE_DEMO_LOGIN`).** Saat ini `next.config.js` menyetel `ALLOW_DEMO_UAT: 'true'` supaya pimpinan dan penguji UAT dapat masuk ke ke-17 akun demo pada server staging. Ketika aplikasi beralih ke produksi publik pasca-UAT, operator wajib menyetel `DISABLE_DEMO_LOGIN=true` pada environment server untuk mematikan seluruh login demo dan cookie `dagoeng_active_persona`.
