# Akun sistem dan kredensial pengujian

Dokumen ini memuat daftar akun pengujian resmi pada lingkungan pengembangan dan staging UAT DagoEng Management. Seluruh 16 persona demo menerima kata sandi `Password123!` dan kata sandi singkat `demo` selama mode UAT aktif.

## Aturan aktivasi login demo

Konfigurasi `next.config.js` menyetel `ALLOW_DEMO_UAT` ke `'true'` agar seluruh 16 akun demo dapat dipakai selama pengujian serah terima bersama manajemen. Sebelum aplikasi dibuka untuk publik pada lingkungan produksi penuh, setel variabel `DISABLE_DEMO_LOGIN=true` pada server agar seluruh login demo dan cookie `dagoeng_active_persona` ditolak.

## 1. Manajemen platform dan unit bisnis Dago Creative Hub

| Peran (`RoleSlug`) | Lingkup (`ScopeLevel`) | Rute awal | Email | Kata sandi |
|---|---|---|---|---|
| `SUPER_ADMIN` | `PLATFORM` | `/dashboard` | `admin@dagoeng.com` | `Password123!` |
| `OWNER` (Dago Creative Hub) | `ORGANIZATION` | `/dashboard` | `owner.dago@dagoeng.com` | `Password123!` |
| `MANAGER` (Commercial) | `BUSINESS_UNIT` (klien), `ORGANIZATION` (server) | `/commercial` | `manager.commercial@dagoeng.com` | `Password123!` |
| `MANAGER` (Co-Working) | `BUSINESS_UNIT` (klien), `ORGANIZATION` (server) | `/coworking` | `manager.cowork@dagoeng.com` | `Password123!` |
| `CHECKIN_STAFF` (Operasional Event) | `ORGANIZATION` | `/events/checkin` | `eventstaff@dagoeng.com` | `Password123!` |

## 2. Mitra kuliner F&B dan staf gerai Singaraja

### Pemilik mitra F&B (`TENANT`)

| Mitra (`tenantId`) | Peran (`RoleSlug`) | Rute awal | Email | Kata sandi |
|---|---|---|---|---|
| Kopi Senja (`tenant-ks`) | `OWNER` | `/dashboard` | `owner.kopisenja@dagoeng.com` | `Password123!` |
| Dapur Mama (`tenant-kitchen`) | `OWNER` | `/dashboard` | `owner.dapurmama@dagoeng.com` | `Password123!` |
| Manis Bakery (`tenant-bakery`) | `OWNER` | `/dashboard` | `owner.manisbakery@dagoeng.com` | `Password123!` |
| Warung Bu Narti (`tenant-tea`) | `OWNER` | `/dashboard` | `owner.warungbunarti@dagoeng.com` | `Password123!` |

### Staf operasional gerai Singaraja (`outlet-sgr`)

| Posisi | Peran (`RoleSlug`) | Mitra bawaan | Rute awal | Email | Kata sandi |
|---|---|---|---|---|---|
| Kasir Singaraja | `CASHIER` | `tenant-ks` | `/pos` | `cashier.sgr@kopisenja.com` | `Password123!` |
| Staf Dapur | `KITCHEN_STAFF` | `tenant-ks` | `/kitchen` | `kitchen.sgr@kopisenja.com` | `Password123!` |
| Pramusaji | `WAITER` | `tenant-ks` | `/waiter` | `waiter.sgr@kopisenja.com` | `Password123!` |

Peran `INVENTORY_STAFF` terdaftar di skema RBAC, tetapi belum memiliki akun persona demo khusus pada halaman login. Pengujian inventori dilakukan menggunakan akun `SUPER_ADMIN`, `OWNER`, atau `MANAGER`.

## 3. Penyelenggara event komunitas

| Nama komunitas atau akun | Jenis akun | Rute awal | Email | Kata sandi |
|---|---|---|---|---|
| Dago Barista Guild | Persona demo organizer | `/events/portal` | `baristaguild@dagocreative.id` | `Password123!` |
| Bandung Game Creators | Persona demo organizer | `/events/portal` | `halo@bandungdev.org` | `Password123!` |
| Aksara Priangan Studio | Persona demo organizer | `/events/portal` | `info@aksarapriangan.id` | `Password123!` |
| Tes Penyelenggara 1 | Akun kredensial terpadu (staging) | `/events/portal` atau `/customer` | `sansaditya2105@gmail.com` | `123456` |
| Tes Penyelenggara 2 | Akun kredensial terpadu (staging) | `/events/portal` atau `/customer` | `shandi@student.undiksha.ac.id` | `123456` |

Kedua akun tes penyelenggara (`sansaditya2105@gmail.com` dan `shandi@student.undiksha.ac.id`) diarahkan ke `/events/portal` apabila profil penyelenggaranya aktif di `STORAGE_organizers.json` pada database Neon, atau ke `/customer` bila hanya terdaftar sebagai akun terpadu.

## 4. Pelanggan dan member

| Peran (`RoleSlug`) | Rute awal | Email | Kata sandi |
|---|---|---|---|
| `CUSTOMER` | `/customer` | `customer@gmail.com` | `Password123!` |
