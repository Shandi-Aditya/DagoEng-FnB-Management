# Sistem manajemen dan POS Dago Creative Hub

Repositori `dagoeng-fnb-management` memuat aplikasi web monolitik berbasis Next.js App Router untuk operasional multi-unit `Dago Creative Hub`. Organisasi induk menggunakan ID `org-dago-hub` dan kode `DAGO-HUB`. Aplikasi ini menjalankan empat modul bisnis inti, yaitu `CORE`, `FNB`, `CO_WORKING`, dan `COMMERCIAL`, ditambah Web Event Marketplace publik. Dokumen ini menjadi referensi teknis repositori sekaligus dokumen serah terima Point of Sale Task `V-20` untuk Ka Ari.

## Profil organisasi, outlet aktif, dan mitra F&B

Seluruh transaksi POS, reservasi ruang kerja, sewa ritel komersial, dan pembagian hasil mitra mengacu pada entitas organisasi serta outlet berikut:

| Entitas | Nama resmi | ID sistem | Kode | Status operasional | Detail lokasi dan kontak |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Organisasi induk | Dago Creative Hub | `org-dago-hub` | `DAGO-HUB` | Aktif | Pengelola ruang kerja, ritel komersial, event, dan kasir terpusat |
| Outlet pusat | Singaraja (Pusat) | `outlet-sgr` | `KS-SGR` | Aktif | Jl. Teleng No. 1, Banyuasri, Buleleng, Bali 81116, telepon `+62 821-1550-1995` |
| Outlet cabang | Denpasar | `outlet-dps` | `KS-DPS` | `COMING_SOON` | Belum menerima transaksi operasional |
| Outlet cabang | Ubud | `outlet-ubd` | `KS-UBD` | `COMING_SOON` | Belum menerima transaksi operasional |

Outlet aktif `outlet-sgr` melayani empat mitra F&B resmi. Kebijakan bawaan membagi `85%` nilai DPP untuk mitra dan `15%` untuk Dago Creative Hub sebelum pajak PB1 sesuai basis `RECEIPT_NET_BEFORE_TAX`:

| No | Nama mitra F&B | ID tenant | Kode tenant | Porsi mitra bawaan | Porsi Dago Creative Hub bawaan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Kopi Senja | `tenant-ks` | `KOPI-SENJA` | `85%` dari DPP | `15%` dari DPP |
| 2 | Dapur Mama | `tenant-kitchen` | `DAPUR-MAMA` | `85%` dari DPP | `15%` dari DPP |
| 3 | Manis Bakery | `tenant-bakery` | `MANIS-BAKERY` | `85%` dari DPP | `15%` dari DPP |
| 4 | Warung Bu Narti | `tenant-tea` | `WARUNG-BU-NARTI` | `85%` dari DPP | `15%` dari DPP |

## Arsitektur aplikasi dan otorisasi RBAC tiga dimensi

Satu proses Next.js menyajikan antarmuka React, menjalankan middleware otorisasi di Edge Runtime, dan mengeksekusi Route Handler API di Node.js dengan pengetikan ketat TypeScript `strict: true`. Spesifikasi arsitektur selengkapnya tersedia di [dokumen arsitektur sistem](./docs/ARCHITECTURE.md).

### Tumpukan teknologi dan versi terkunci

Tabel berikut memuat komponen perangkat lunak beserta versi yang terkunci pada `package.json`, `components.json`, dan `nixpacks.toml`:

| Lapisan | Paket dan teknologi | Versi | Peran teknis di sistem |
| :--- | :--- | :--- | :--- |
| Kerangka kerja web | `next`, `react`, `typescript` | `15.5.29`, `19.3.1`, `5.6.3` | Menyediakan App Router, Edge Middleware, Node Route Handlers, dan kompilasi `strict: true` |
| Runtime produksi | Node.js via `nixpacks.toml` | `22.20.0` | Mengunci snapshot `nixos-25.05` komit `ac62194c3917d5f474c1a844b6fd6da2db95077d` karena `@tailwindcss/node` membutuhkan Node.js `22.12` ke atas |
| Antarmuka dan grafik | `tailwindcss`, `shadcn`, `@base-ui/react`, `lucide-react`, `recharts` | `4.3.5`, `4.23.0`, `1.9.0`, `1.71.0`, `3.8.0` | Menerapkan gaya `base-mira` di atas `@base-ui/react` tanpa Radix UI dan tanpa `src/components/legacy/` |
| ORM dan database | `prisma`, `@prisma/client` | `5.22.0` | Menghubungkan aplikasi ke Neon PostgreSQL untuk tabel relasional dan replikasi `system_settings` |
| Validasi dan sandi | `zod`, `bcryptjs` | `3.23.8`, `2.4.3` | Memvalidasi payload di batas API dan mengacak kata sandi akun pengguna |
| Ekspor dan kode QR | `exceljs`, `qrcode.react`, `html5-qrcode` | `4.4.0`, `4.2.0`, `2.3.8` | Menghasilkan laporan `.xlsx` tiga lembar, merender kode QR, dan memindai tiket masuk |
| Pengujian dan linter UI | `vitest`, `tsx`, `scripts/lint-ui.ts` | `2.1.5`, `4.19.2` | Menjalankan uji otomatis di lingkungan `node` dengan `fileParallelism: false` dan memeriksa `14` aturan sistem desain UI |

### Metrik kode sumber dan perintah verifikasi jumlah

Jalankan perintah pada kolom kanan dari akar repositori untuk menghitung ulang setiap komponen kode sumber:

| Komponen kode sumber | Jumlah terverifikasi | Perintah verifikasi ulang |
| :--- | :--- | :--- |
| Halaman App Router | `29` | `find src/app -name 'page.tsx' \| wc -l` |
| Endpoint API App Router | `55` | `find src/app/api -name 'route.ts' \| wc -l` |
| Provider React Context | `16` | `ls -1 src/contexts/*.tsx \| wc -l` |
| Modul fitur domain | `29` | `ls -1d src/features/* \| wc -l` |
| Primitif UI shadcn | `38` | `ls -1 src/components/ui/*.tsx \| wc -l` |
| Berkas definisi tipe domain | `17` | `ls -1 src/types/*.ts \| wc -l` |
| Model relasional Prisma | `32` | `grep -c '^model ' prisma/schema.prisma` |
| Berkas pengujian Vitest | `195` | `ls -1 tests/*.test.ts \| wc -l` |

### Peta direktori repositori

Tabel berikut memetakan setiap direktori dan berkas inti beserta tanggung jawab utamanya:

| Path direktori atau berkas | Tanggung jawab utama |
| :--- | :--- |
| `prisma/schema.prisma` | Mendefinisikan `32` model relasional PostgreSQL dan generator Prisma Client |
| `prisma/seed.ts` | Mengisi data awal relasional fase dasar untuk pengembangan baru |
| `nixpacks.toml` | Mengunci arsip Nixpkgs `nixos-25.05` agar Coolify membangun aplikasi dengan Node.js `22.20.0` |
| `scripts/lint-ui.ts` | Memeriksa kepatuhan kode terhadap `14` aturan sistem desain shadcn dan melarang pola UI warisan |
| `src/middleware.ts` | Memverifikasi `dagoeng_edge_token` di Edge Runtime pada `18` prefiks rute dasbor internal |
| `src/app/(auth)/login/` | Menyajikan halaman login staf, pemilik mitra, penyelenggara event, dan pemilih persona demo UAT |
| `src/app/(dashboard)/` | Memuat `16` halaman operasional internal: `dashboard`, `pos`, `kitchen`, `orders`, `tables`, `menu`, `inventory`, `customers`, `coworking`, `commercial`, `employees`, `events-admin`, `activity-log`, `reports`, `ai-insight`, dan `settings` |
| `src/app/(mobile)/` | Memuat `2` halaman layar bergerak untuk pemesanan mandiri QR meja di `customer` dan pramusaji di `waiter` |
| `src/app/events/` | Memuat `9` halaman publik dan portal penyelenggara untuk katalog, pengajuan, aktivasi, tiket, pemulihan, dan check-in |
| `src/app/api/` | Memuat `55` Route Handler untuk autentikasi, POS, shift, QRIS, PDF, chatbot tutup shift, `/api/sync/[domain]`, `/api/reports/settlement`, `/api/outlets`, `/api/tenants/*`, dan event |
| `src/components/ui/` | Menyimpan `38` komponen primitif antarmuka berbasis `@base-ui/react` dan Tailwind CSS v4 |
| `src/components/app/` | Menyimpan komponen tata letak komposit aplikasi seperti header halaman, kartu metrik, paginasi, dan badge status |
| `src/contexts/` | Menyimpan `16` React Context untuk sesi, outlet, pesanan, meja, stok, produk, loyalty, co-working, komersial, shift, audit, notifikasi, printer, pengaturan, tanggal, dan tema |
| `src/features/` | Menyimpan `29` modul antarmuka dan aturan domain murni per fitur bisnis |
| `src/lib/` | Menyimpan mesin settlement, pajak, resep BOM, penyimpanan JSON terkunci, RBAC, sesi, DOKU, printer thermal, dan chatbot tutup shift |
| `data/` | Menyimpan replika lokal JSON bawaan repositori serta subdirektori `data/proofs` untuk bukti pembayaran |
| `tests/` | Menyimpan `195` berkas pengujian otomatis Vitest yang mengunci aturan bisnis POS, RBAC, inventori, event, dan dokumentasi |

### Keamanan sesi dua cookie dan matriks RBAC

Modul `src/lib/rbac.ts` mengevaluasi hak akses menggunakan tiga dimensi otorisasi pada setiap permintaan. Rincian hak per rute tersedia di [dokumentasi matriks RBAC](./docs/RBAC.md):

- **Dimensi peran `RoleSlug`.** Sistem mendefinisikan `9` peran, yaitu `SUPER_ADMIN`, `OWNER`, `MANAGER`, `CASHIER`, `KITCHEN_STAFF`, `INVENTORY_STAFF`, `WAITER`, `CHECKIN_STAFF`, dan `CUSTOMER`.
- **Dimensi cakupan `ScopeLevel`.** Hierarki terdiri atas `5` tingkat dari tertinggi ke terendah, yaitu `PLATFORM`, `ORGANIZATION`, `BUSINESS_UNIT`, `TENANT`, dan `OUTLET`.
- **Dimensi modul `BusinessModuleCode`.** Setiap izin terikat pada salah satu dari `4` kode modul, yaitu `CORE`, `FNB`, `CO_WORKING`, atau `COMMERCIAL`.

Lapisan autentikasi memakai dua cookie terpisah untuk menggabungkan penyaringan cepat di Edge dan validasi sesi database:

- **Cookie Edge `dagoeng_edge_token`.** Server menandatangani cookie `HttpOnly` ini dengan HMAC-SHA256 memakai `SESSION_SECRET`. Berkas `src/middleware.ts` memvalidasi tanda tangan dan peran secara langsung di Edge pada `18` prefiks rute dasbor.
- **Cookie database `dagoeng_session`.** Server mengubah token sesi menjadi hash SHA-256 lalu mencocokkannya dengan tabel `sessions` di PostgreSQL tanpa pernah mempercayai header `x-user-*` dari peramban.
- **Batas waktu dan pencabutan sesi lintas perangkat.** Sesi operasional berlaku selama `16` jam dengan batas waktu diam `8` jam untuk staf. Klien dan server memeriksa `STORAGE_session_revocations.json` setiap `60` detik sehingga perubahan peran atau kata sandi karyawan langsung memutus sesi lama di perangkat lain.

## Struktur database dua lapis di Neon PostgreSQL

Aplikasi memadukan tabel relasional PostgreSQL dengan penyimpanan dokumen JSON bereplikasi awan di dalam tabel `system_settings`. Penjelasan relasi tabel dan pemetaan domain tersedia di [dokumentasi skema database](./docs/DATABASE.md) serta [audit penyimpanan data](./docs/AUDIT_PENYIMPANAN_DATA.md).

### Lapisan 1 berupa skema relasional Prisma

Berkas `prisma/schema.prisma` mendefinisikan `32` model PostgreSQL ternormalisasi untuk autentikasi, struktur organisasi, dan kesiapan kueri relasional:

- **Identitas, hak akses, dan pengaturan.** Kelompok ini memuat `8` model, yaitu `User`, `Role`, `Permission`, `RolePermission`, `UserRole`, `Session`, `AuditLog`, dan `SystemSetting`.
- **Organisasi, karyawan, dan pelanggan.** Kelompok ini memuat `5` model, yaitu `Organization`, `Outlet`, `Tenant`, `Employee`, dan `Customer`.
- **Katalog kuliner, kasir, meja, dan pesanan.** Kelompok ini memuat `10` model, yaitu `Category`, `Product`, `ProductVariant`, `ModifierGroup`, `ModifierOption`, `CashierShift`, `TableArea`, `Table`, `Order`, dan `OrderItem`.
- **Ruang kerja bersama dan paket anggota.** Kelompok ini memuat `6` model, yaitu `RoomCategory`, `Room`, `Reservation`, `MembershipPackage`, `CustomerMembership`, dan `VirtualOfficePackage`.
- **Akuntansi dan kewajiban bulanan.** Kelompok ini memuat `3` model, yaitu `ChartOfAccount`, `CostBulanan`, dan `HutangAdmin`.

### Lapisan 2 berupa penyimpanan JSON pada system_settings

Operasional aktif POS, CRM, inventori, dan event membaca serta menulis `28` kunci berawalan `STORAGE_<nama_berkas>` di tabel `system_settings`. Server menyalin dokumen tersebut ke `<cwd>/data/*.json`, peramban menyimpan cermin baca cepat di `localStorage`, dan modul penyelenggara menyimpan `2` berkas sesi khusus di disk lokal:

| Kelompok penyimpanan | Jumlah | Daftar kunci domain atau nama berkas JSON | Mekanisme akses dan proteksi |
| :--- | :--- | :--- | :--- |
| Domain sinkronisasi `/api/sync/[domain]` | `9` | `platform-settings`, `tenants`, `wifi`, `subscription`, `printer-config`, `inventory`, `tables`, `coworking-master`, `commercial` | Mengirim mutasi berbasis aksi perintah dari React Context disertai antrean penggabungan luring |
| Dokumen operasional POS, CRM, dan kebijakan | `13` | `pos_orders.json`, `shifts.json`, `coworking_bookings.json`, `employees.json`, `master_products.json`, `loyalty_members.json`, `loyalty_points.json`, `qris_sessions.json`, `audit_logs.json`, `session_revocations.json`, `closing_chatbot_dispatches.json`, `tenant_operations.json`, `settlement_receipt_policy.json` | Memakai Route Handler khusus domain dengan kunci berkas dalam proses dan validasi CAS `updatedAt` |
| Dokumen Event Marketplace dan akun terpadu | `6` | `events.json`, `event_bookings.json`, `event_settings.json`, `organizers.json`, `organizer_credentials.json`, `unified_users.json` | Memakai kunci transaksi PostgreSQL `pg_advisory_xact_lock` saat memutasi kuota tiket dan booking event |
| Berkas khusus disk lokal penyelenggara | `2` | `organizer_invites.json`, `organizer_sessions.json` | Menulis hanya ke direktori `<cwd>/data/` tanpa replikasi ke tabel `system_settings` |

### Penjaga konkurensi dan antrean sinkronisasi luring

Lapisan penyimpanan JSON menerapkan lima mekanisme pengaman untuk mencegah kehilangan data transaksi:

- **Kunci berkas dalam proses.** Fungsi `withFileLock(filename)` mengurutkan operasi baca-tulis pada dokumen yang sama di dalam satu proses Node.js.
- **Batas waktu baca database.** Operasi baca ke Neon PostgreSQL memiliki batas waktu `8` detik agar antrean permintaan tidak menggantung saat jaringan melambat.
- **Penjaga kehilangan data cold-start.** Saat pembacaan awal dari Neon gagal ketika kontainer baru menyala, penjaga `RISK_DATA_LOSS` memblokir penulisan agar data seed lokal tidak menimpa data produksi di awan.
- **Validasi versi optimis.** Server memeriksa stempel waktu `updatedAt` dengan pola Compare-And-Swap dan menolak penulisan usang menggunakan kode `LOST_UPDATE_PREVENTED`.
- **Antrean keluar luring.** Saat koneksi kasir terputus, peramban menampung mutasi pada `dagoeng_sync_outbox_v1`, menggabungkan perubahan berurutan pada entitas yang sama, dan mengirimkannya ulang ketika jaringan pulih.

## Pengembangan lokal, deploy Coolify, dan variabel lingkungan

Apabila `DATABASE_URL` pada berkas `.env` lokal mengarah ke database Neon produksi, setiap aksi simpan, buka shift, atau bayar di peramban lokal akan mengubah data produksi secara langsung. Gunakan branch database Neon terpisah untuk pengembangan fitur baru, dan hindari menekan tombol mutasi data saat memeriksa tampilan dengan koneksi produksi.

### Menjalankan aplikasi di lingkungan lokal

Siapkan lingkungan pengembangan dengan Node.js minimal versi `22.12`, isi `.env` berdasarkan `.env.example`, lalu jalankan perintah berikut:

```bash
npm install
npm run prisma:push
npm run db:seed
npm run dev
```

Tabel berikut merangkum seluruh skrip CLI untuk pengembangan, pemeriksaan kualitas, dan kompilasi produksi. Rincian isolasi pengujian `DATA_DIR_OVERRIDE` dibahas di [panduan pengujian kualitas](./docs/TESTING.md):

| Perintah CLI | Perilaku eksekusi |
| :--- | :--- |
| `npm install` | Memasang dependensi paket lalu menjalankan `prisma generate` lewat skrip `postinstall` |
| `npm run dev` | Menjalankan server pengembangan Next.js pada `http://localhost:3000` |
| `npm run lint:ui -- --strict src` | Mengevaluasi kode antarmuka terhadap `14` aturan sistem desain di `scripts/lint-ui.ts` |
| `npx tsc --noEmit -p .` | Menjalankan kompiler TypeScript `5.6` untuk memeriksa tipe seluruh proyek |
| `npx vitest run` | Menjalankan seluruh suite pengujian Vitest secara berurutan pada direktori uji terisolasi |
| `npm run build` | Menjalankan `prisma generate` lalu membangun bundel produksi Next.js ke `.next` |
| `npm run start` | Menjalankan server produksi Next.js dari hasil build |

### Konfigurasi deploy Coolify dan Nixpacks

Lingkungan staging dan produksi di-deploy melalui Coolify yang memantau branch GitLab `develop`. Langkah konfigurasi antarmuka Coolify selengkapnya tersedia di [panduan deploy Coolify](./docs/DEPLOY_COOLIFY.md):

- **Sumber repositori dan port.** Coolify menarik branch `develop` dari `git@gitlab.com:devdagoeng/dagoeng-management.git` memakai SSH Deploy Key khusus baca dan mengekspos aplikasi pada port `3000`.
- **Penguncian versi Node.js di `nixpacks.toml`.** Snapshot bawaan Nixpacks menjalankan Node.js `22.11.0`, sedangkan `@tailwindcss/node` pada Tailwind CSS v4 membutuhkan Node.js minimal `22.12` agar tidak gagal dengan galat `ERR_REQUIRE_ESM`. Berkas `nixpacks.toml` mengunci `nixpkgsArchive` ke `ac62194c3917d5f474c1a844b6fd6da2db95077d` sehingga kontainer build memakai Node.js `22.20.0`.
- **Batas mount volume persisten.** Pasang volume persisten hanya pada `/app/data/proofs` untuk menyimpan bukti transfer tiket event. Jangan pernah memasang volume pada `/app/data` karena mount tersebut menimpa seluruh berkas seed JSON bawaan repositori.
- **Penutupan akun demo saat rilis publik.** Pengaturan `ALLOW_DEMO_UAT: 'true'` di `next.config.js` mengaktifkan login persona demo selama masa UAT. Sebelum domain produksi dibuka untuk publik, tambahkan `DISABLE_DEMO_LOGIN="true"` pada konfigurasi environment Coolify.

### Referensi variabel lingkungan

Tabel berikut mendata seluruh nama variabel lingkungan yang dibaca oleh aplikasi tanpa mencantumkan nilai rahasia:

| Nama variabel | Kategori | Kewajiban | Fungsi dan aturan nilai |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Database | Wajib | Menentukan URL koneksi Neon PostgreSQL untuk Prisma Client dan penyimpanan `system_settings` |
| `SESSION_SECRET` | Keamanan | Wajib | Menyediakan kunci minimal `32` karakter untuk tanda tangan HMAC-SHA256 pada `dagoeng_edge_token` |
| `QRIS_WEBHOOK_SECRET` | Pembayaran POS | Wajib | Menyediakan kunci verifikasi tanda tangan HMAC pada endpoint `/api/pos/qris/verify` |
| `SUPERVISOR_OVERRIDE_PIN` | Operasional POS | Wajib | Menentukan PIN supervisor untuk konfirmasi QRIS statis, refund tunai, dan void pesanan |
| `NEXT_PUBLIC_APP_URL` | Publik | Wajib | Menentukan URL dasar publik untuk pembuatan tautan tiket, cetak laporan, dan callback |
| `NEXT_PUBLIC_CS_WHATSAPP` | Publik | Disarankan | Menampilkan nomor WhatsApp layanan pelanggan pada halaman tiket dan pemulihan pesanan |
| `ALLOW_DEMO_UAT` | Kontrol akses | Bawaan `next.config.js` | Bernilai `'true'` di `next.config.js` guna mengaktifkan login akun demo selama fase UAT |
| `DISABLE_DEMO_LOGIN` | Kontrol akses | Wajib saat rilis publik | Setel ke `"true"` pada produksi pasca-UAT guna menonaktifkan seluruh akun demo dan sandi `demo` |
| `ENABLE_ROLE_SIMULATOR` | Diagnostik | Opsional | Setel ke `"true"` hanya di pengembangan atau staging untuk menampilkan bilah pengalih peran |
| `FONNTE_API_TOKEN` | Notifikasi WhatsApp | Opsional fitur `V-17` | Menyediakan token API Fonnte untuk pengiriman pesan rekap tutup shift |
| `KA_ARI_WHATSAPP_PHONE` | Notifikasi WhatsApp | Opsional fitur `V-17` | Menentukan nomor WhatsApp Ka Ari penerima rekap penuh Front Office dan seluruh mitra F&B |
| `FONNTE_TARGET_PHONE` | Notifikasi WhatsApp | Opsional fitur `V-17` | Menentukan nomor tujuan cadangan Fonnte apabila nomor spesifik penerima kosong |
| `TELEGRAM_BOT_TOKEN` | Notifikasi Telegram | Opsional fitur `V-17` | Menyediakan token Bot Telegram untuk pengiriman ringkasan tutup shift otomatis |
| `TELEGRAM_KA_ARI_CHAT_ID` | Notifikasi Telegram | Opsional fitur `V-17` | Menentukan Chat ID Telegram Ka Ari untuk penerimaan rekap lengkap penutupan shift |
| `TELEGRAM_PARTNER_<TENANT_ID>_CHAT_ID` | Notifikasi Telegram | Opsional fitur `V-17` | Menentukan Chat ID Telegram per mitra F&B agar tiap mitra hanya menerima bagi hasilnya sendiri |
| `DOKU_CLIENT_ID` | Pembayaran Event | Opsional fitur Event | Menyediakan Client ID merchant DOKU untuk pembayaran otomatis tiket Web Event |
| `DOKU_SECRET_KEY` | Pembayaran Event | Opsional fitur Event | Menyediakan Secret Key DOKU untuk tanda tangan permintaan dan validasi `/api/webhooks/doku` |
| `DOKU_API_URL` | Pembayaran Event | Opsional fitur Event | Wajib berisi `https://api.doku.com` saat `NODE_ENV=production` karena endpoint sandbox ditolak |
| `DOKU_NOTIFICATION_URL` | Pembayaran Event | Opsional fitur Event | Menentukan URL publik atau path menuju endpoint `/api/webhooks/doku` |
| `DOKU_CALLBACK_URL` | Pembayaran Event | Opsional fitur Event | Menentukan URL tujuan pengalihan pembeli seusai pembayaran di halaman DOKU |
| `DOKU_SIMULATION_MODE` | Pembayaran Event | Hanya lokal | Bernilai `"true"` hanya untuk simulasi lokal dan ditolak otomatis saat `NODE_ENV=production` |

## Akun pengujian UAT dan staging

Selama `ALLOW_DEMO_UAT` aktif dan `DISABLE_DEMO_LOGIN` belum bernilai `"true"`, sistem mengizinkan login `16` persona demo memakai kata sandi `Password123!` atau kata sandi singkat `demo`, ditambah `2` akun penyelenggara staging. Kredensial lengkap beserta rute awal setiap peran tersedia di [daftar akun sistem](./docs/AKUN_SISTEM.md).

### Akun manajemen platform dan operasional Hub

Lima akun berikut menguji otorisasi lintas unit bisnis, pelaporan manajemen, ruang kerja, komersial, dan meja registrasi tiket event:

| Peran sistem | Lingkup akses | Email login | Kata sandi UAT |
| :--- | :--- | :--- | :--- |
| `SUPER_ADMIN` | Seluruh platform dan pengaturan global | `admin@dagoeng.com` | `Password123!` |
| `OWNER` | Organisasi `Dago Creative Hub` | `owner.dago@dagoeng.com` | `Password123!` |
| `MANAGER` | Unit bisnis Commercial Space | `manager.commercial@dagoeng.com` | `Password123!` |
| `MANAGER` | Unit bisnis Co-Working Space | `manager.cowork@dagoeng.com` | `Password123!` |
| `CHECKIN_STAFF` | Operasional pemindaian kehadiran event | `eventstaff@dagoeng.com` | `Password123!` |

### Akun pemilik mitra F&B dan staf outlet Singaraja

Tujuh akun berikut menguji isolasi data per mitra F&B serta operasional kasir, dapur KDS, dan pramusaji di outlet `outlet-sgr`. Peran `INVENTORY_STAFF` belum memiliki akun demo terpisah sehingga modul inventori diuji menggunakan akun `SUPER_ADMIN`, `OWNER`, atau `MANAGER`:

| Peran sistem | Unit atau mitra terkait | Email login | Kata sandi UAT |
| :--- | :--- | :--- | :--- |
| `OWNER` | Mitra Kopi Senja dengan ID `tenant-ks` | `owner.kopisenja@dagoeng.com` | `Password123!` |
| `OWNER` | Mitra Dapur Mama dengan ID `tenant-kitchen` | `owner.dapurmama@dagoeng.com` | `Password123!` |
| `OWNER` | Mitra Manis Bakery dengan ID `tenant-bakery` | `owner.manisbakery@dagoeng.com` | `Password123!` |
| `OWNER` | Mitra Warung Bu Narti dengan ID `tenant-tea` | `owner.warungbunarti@dagoeng.com` | `Password123!` |
| `CASHIER` | Kasir Front Office outlet `Singaraja (Pusat)` | `cashier.sgr@kopisenja.com` | `Password123!` |
| `KITCHEN_STAFF` | Layar KDS dapur Kopi Senja di `Singaraja (Pusat)` | `kitchen.sgr@kopisenja.com` | `Password123!` |
| `WAITER` | Portal pramusaji meja di `Singaraja (Pusat)` | `waiter.sgr@kopisenja.com` | `Password123!` |

### Akun penyelenggara event dan pelanggan

Enam akun berikut mencakup tiga komunitas penyelenggara demo, satu anggota loyalty pelanggan, dan dua akun penyelenggara staging:

| Peran sistem | Nama unit atau profil | Email login | Kata sandi UAT |
| :--- | :--- | :--- | :--- |
| Organizer | Dago Barista Guild | `baristaguild@dagocreative.id` | `Password123!` |
| Organizer | Bandung Game Creators | `halo@bandungdev.org` | `Password123!` |
| Organizer | Aksara Priangan Studio | `info@aksarapriangan.id` | `Password123!` |
| `CUSTOMER` | Pelanggan pemesanan mandiri dan member loyalty | `customer@gmail.com` | `Password123!` |
| Organizer Staging | Akun uji penyelenggara staging 1 | `sansaditya2105@gmail.com` | `123456` |
| Organizer Staging | Akun uji penyelenggara staging 2 | `shandi@student.undiksha.ac.id` | `123456` |

## Daftar fitur POS terselesaikan dari V-01 sampai V-19

Tabel ini merinci implementasi tugas `V-01` sampai `V-19` beserta tiga pengerasan keamanan dan pelaporan `S-09` sampai `S-11`. Bukti eksekusi skenario uji tercatat di [laporan regresi POS V-19](./docs/test-cases/TC-V19-POS-REGRESSION-REPORT.md) serta [laporan uji E2E event berbayar S-07](./docs/test-cases/TC-S07-PAID-EVENT-E2E.md):

| Kode | Sub-sistem | Implementasi teknis dan artefak sistem |
| :--- | :--- | :--- |
| `V-01` | Header POS dan pembayaran | Memperbaiki urutan React Hook pada header POS dan memverifikasi alur pembayaran F&B dari keranjang hingga struk lunas |
| `V-02` | Penjagaan shift kasir aktif | Menolak pembukaan shift ganda dengan status `409`, membersihkan input modal awal, dan menghapus buka shift otomatis bagi peran selain kasir |
| `V-03` | Jam operasional mitra | Menyimpan jadwal operasional mitra F&B dan sakelar buka atau tutup manual di `STORAGE_tenant_operations.json` melalui `/api/tenant/operations` |
| `V-04` | Audit penyimpanan data | Memetakan seluruh domain penyimpanan peramban terhadap server di [`docs/AUDIT_PENYIMPANAN_DATA.md`](./docs/AUDIT_PENYIMPANAN_DATA.md) |
| `V-05` | Pembayaran QRIS statis | Menampilkan `qris-dago.jpeg` di POS dan Co-working dengan verifikasi `SUPERVISOR_OVERRIDE_PIN` beserta RRN minimal `4` karakter dan kunci `15` menit sesudah `5` salah input, atau webhook HMAC `/api/pos/qris/verify` |
| `V-06` | Migrasi sinkronisasi server | Memindahkan `22` domain peramban dan `4` state memori komponen ke server lewat `9` endpoint `/api/sync/[domain]`, `/api/orders/self-order`, dan antrean `dagoeng_sync_outbox_v1` |
| `V-07` | Pemetaan dan bagi hasil mitra | Memetakan setiap item pesanan ke tenant pemiliknya dan menghitung bagi hasil bawaan `85%` mitra berbanding `15%` Hub dari DPP `RECEIPT_NET_BEFORE_TAX` |
| `V-08` | Penguncian pajak struk | Mengunci nilai pajak PB1 dan biaya layanan pada tiap pesanan agar angkanya konsisten di struk, laporan penjualan, tutup shift, dan PDF penutupan |
| `V-09` | Isolasi KDS dan catatan dapur | Memisahkan status tiket per mitra melalui `tenantStatuses`, mengunci filter mitra bagi `KITCHEN_STAFF` dan `TENANT`, serta mencetak catatan kasir dan item di KDS maupun tiket dapur |
| `V-10` | Ekspor transaksi Excel | Menghasilkan berkas `.xlsx` tiga lembar kerja yang memuat `transaction`, `transactionDetail`, dan `tenantShares` memakai `exceljs` dalam zona waktu WITA |
| `V-11` | Resep BOM dan potong stok | Memotong stok `19` bahan baku pada `16` produk beresep BOM dengan penskalaan varian dan modifier `Oat Milk`, `Extra Shot`, `Large`, `1 Liter`, `Double Meat`, serta `Chocolate` lewat aksi idempoten `APPLY_BOM_DELTAS` |
| `V-12` | Rekonsiliasi kas tutup shift | Menghitung kas seharusnya Front Office dari modal awal ditambah tunai dikurangi refund terhadap kas aktual, mewajibkan alasan selisih, dan mencetak PDF lewat `/api/reports/closing/pdf` |
| `V-13` | Refund kas dan void pesanan | Mengeluarkan dana refund tunai maupun QRIS dari laci kas fisik lewat `RECORD_REFUND`, memproses void dengan alasan wajib dan PIN supervisor, membalikkan poin loyalty, memulihkan stok pra-masak atau mencatat limbah pasca-masak, serta menulis audit log tingkat `HIGH` |
| `V-14` | Notifikasi KDS dan pramusaji | Memungut data pesanan setiap `5` detik untuk menampilkan modal pesanan masuk beserta bunyi WebAudio per mitra di KDS, serta spanduk dan modal siap antar di layar pramusaji |
| `V-15` | Cetak senyap tiket dapur | Mencetak tiket dapur tanpa harga yang terpisah per mitra saat kasir mencetak struk melalui lima tingkat fallback berurutan, yaitu `LOCAL_BRIDGE`, `NETWORK_LAN_VIA_BRIDGE`, `QZ_TRAY`, `PRINTNODE`, dan `iframe` tersembunyi untuk Chrome `--kiosk-printing` |
| `V-16` | Pelacakan selisih tiga pihak | Membandingkan catatan kasir, struk pesanan, dan settlement mitra lalu mengelompokkan selisih ke kategori `CASH_VARIANCE`, `REFUND`, `UNCONFIRMED_QRIS`, `VOID_ORDER`, dan `MANUAL_DISCOUNT` |
| `V-17` | Chatbot rekap tutup shift | Mengirim ringkasan tutup shift otomatis via WhatsApp Fonnte dan Bot Telegram di `/api/notifications/closing-chatbot`, mencakup rekap lengkap untuk Ka Ari, porsi terisolasi per mitra F&B, dan pelacakan SLA `60` detik |
| `V-18` | Kebijakan settlement dan struk | Menyediakan pengaturan basis settlement bawaan `RECEIPT_NET_BEFORE_TAX`, persentase bagi hasil per mitra, serta matriks distribusi peran `cashierReceiptRoles` dan `kitchenReceiptRoles` di `/api/settings/settlement-receipt` |
| `V-19` | Regresi menyeluruh POS | Meluluskan seluruh `37` skenario P1 dan pengaman P2, meliputi nomor urut struk harian WITA per penerbit, pemisahan struk pelanggan per tenant, kunci klik ganda bayar, rentang dinamis `THIS_MONTH` WITA, transaksi co-working di laporan penjualan, penjaga rute, dan pencabutan sesi lintas perangkat |
| `S-09` | Privasi data CRM kasir | Memblokir ekspor pelanggan bagi peran `CASHIER` serta menyamarkan sebagian nomor telepon dan alamat email pelanggan |
| `S-10` | Standar waktu WITA dan alamat | Menetapkan waktu bawaan WITA pada reservasi co-working dan mencetak alamat resmi Dago Creative Hub di struk |
| `S-11` | Laporan margin produk lunas | Menghitung margin produk hanya dari pesanan lunas dan menyertakan produk global milik Hub |

## Keterbatasan operasional, perbedaan formula, dan bug tersisa

Delapan poin berikut mendokumentasikan batas operasional saat ini, kebutuhan kredensial pihak ketiga, perbedaan formula laporan, dan celah teknis yang tersisa saat serah terima kepada Ka Ari:

1. **Verifikasi manual pada QRIS statis POS dan Co-working.** Pembayaran QRIS saat ini menampilkan kode statis `qris-dago.jpeg`. Kasir memerlukan otorisasi `SUPERVISOR_OVERRIDE_PIN` dan nomor RRN bank minimal `4` karakter untuk melunaskan transaksi. Alur konfirmasi otomatis baru aktif setelah penyedia pembayaran QRIS mengirim webhook bertanda tangan ke `/api/pos/qris/verify`.
2. **Pemblokiran sandbox DOKU pada mode produksi Coolify.** Modul `src/lib/doku.ts` menolak `DOKU_SIMULATION_MODE=true` dan domain `api-sandbox.doku.com` ketika `NODE_ENV=production` aktif pada `next start` di Coolify. Pembeli tiket berbayar Web Event di Coolify memakai transfer bank manual dan mengunggah bukti bayar ke `/app/data/proofs` sampai kredensial produksi `https://api.doku.com` dipasang.
3. **Kebutuhan jembatan cetak lokal untuk printer termal senyap.** Keamanan peramban memblokir akses langsung ke printer tanpa dialog sistem operasi. Perangkat kasir wajib menjalankan QZ Tray pada port `8182`, jembatan HTTP lokal atau PrintNode pada port `8080`, atau Google Chrome dengan argumen `--kiosk-printing` agar pencetakan struk dan tiket dapur berjalan tanpa dialog.
4. **Ketergantungan kredensial eksternal untuk chatbot tutup shift dan email.** Endpoint chatbot tutup shift `V-17` mencatat pengiriman ke `STORAGE_closing_chatbot_dispatches.json` dengan status `GATEWAY_NOT_CONFIGURED` selama token Fonnte dan Telegram di Coolify belum diisi. Modul `src/lib/email.ts` mendukung SMTP (`nodemailer`), Resend, dan SendGrid, dan fallback ke status `EMAIL_SERVICE_NOT_CONFIGURED` saat kredensial email belum dipasang sehingga staf memakai tautan token privat langsung dan pemulihan via WhatsApp di `+62 821-1550-1995`.
5. **Kewajiban mematikan bendera login demo sebelum rilis publik.** Pengaturan `ALLOW_DEMO_UAT: 'true'` pada `next.config.js` mengaktifkan ke-16 akun demo selama masa UAT. Administrator wajib menyetel `DISABLE_DEMO_LOGIN="true"` pada variabel lingkungan produksi Coolify sebelum membuka akses publik.
6. **Perbedaan potongan MDR antara settlement aplikasi dasar dan ekspor Excel.** Mesin settlement aplikasi dasar pada `V-07` dan `V-18` menghitung bagi hasil mitra dari DPP sebelum PB1 sesuai basis `RECEIPT_NET_BEFORE_TAX` tanpa potongan MDR (sementara laporan settlement mingguan `S-39` `#10` dan `#11` sudah mendukung konfigurasi beban MDR QRIS `0.7%`). Sebaliknya, ekspor `.xlsx` tiga lembar pada `V-10` mengikuti rumus spreadsheet manajemen yang memotong MDR QRIS `0.7%` dari `GrandTotal` termasuk pajak, sehingga kolom `Share Tenant` pada lembar `tenantShares` mencerminkan nilai bersih sesudah MDR.
7. **Celah otorisasi endpoint sekunder dan cakupan bilah samping persona demo.** Endpoint `POST /api/tenant/operations` belum memvalidasi pengirim melalui `getRequestAuthUser`, berbeda dari `/api/sync/platform-settings` yang sudah memeriksanya. Endpoint `GET /api/reports/closing/pdf` merender HTML dari parameter kueri agar tab cetak baru langsung terbuka. Di sisi klien, `DEMO_PERSONAS` memberi cakupan `BUSINESS_UNIT` ke `COMMERCIAL_MANAGER`, sedangkan bilah samping `ALL_NAV_ITEMS` meminta cakupan `ORGANIZATION` untuk menu `/commercial` walaupun pengalihan login tetap mendarat di `/commercial`. Selain itu, belum tersedia akun login demo khusus untuk peran `INVENTORY_STAFF`.
8. **Batas konkurensi dokumen JSON dan empat suite uji warisan non-POS.** Operasional POS masih menyimpan dokumen JSON utuh di tabel `system_settings` dengan penjaga CAS `updatedAt` dan pemungutan HTTP tiap `5` detik. Migrasi `STORAGE_*` ke `32` tabel relasional Prisma serta notifikasi dorong SSE atau WebSocket dijadwalkan pada Fase 3. Pada pengujian Vitest, seluruh suite POS lulus penuh dan tersisa `4` suite warisan non-POS yang tercatat gagal pada baseline, yaitu `etl-data-validation` akibat UTF-8 BOM dan jumlah baris seed, `final-demo-readiness` akibat tanggal statis November 2026 yang lewat, `organizer-activation-hardening` akibat sinkronisasi ke Neon saat mutasi `NODE_ENV=production`, serta `storage-sync-safety` akibat mock lama sebelum batas baca `8000` milidetik dan penjaga CAS.

## Indeks dokumentasi di direktori docs

Tabel berikut memetakan seluruh dokumen teknis, panduan operasional, laporan uji, dan pedoman desain yang aktif di direktori `./docs/`:

| Berkas dokumentasi | Isi dan kegunaan |
| :--- | :--- |
| [`./docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Arsitektur lapisan aplikasi, autentikasi dua cookie, state konteks React, dan alur POS ke KDS serta printer |
| [`./docs/DATABASE.md`](./docs/DATABASE.md) | Daftar `32` model Prisma PostgreSQL, `28` kunci JSON `STORAGE_*` di `system_settings`, dan mekanisme penguncian CAS |
| [`./docs/AUDIT_PENYIMPANAN_DATA.md`](./docs/AUDIT_PENYIMPANAN_DATA.md) | Audit penyimpanan peramban terhadap server dari Task `V-04` beserta status akhir migrasi `V-06` |
| [`./docs/RBAC.md`](./docs/RBAC.md) | Matriks otorisasi tiga dimensi untuk `9` peran, `5` tingkat cakupan, `4` modul bisnis, dan peran cetak struk |
| [`./docs/AKUN_SISTEM.md`](./docs/AKUN_SISTEM.md) | Daftar kredensial resmi `16` persona demo UAT, rute awal per peran, dan `2` akun penyelenggara staging |
| [`./docs/DEPLOY_COOLIFY.md`](./docs/DEPLOY_COOLIFY.md) | Panduan langkah deploy GitLab ke Coolify, kunci Node.js `22.20.0` di Nixpacks, dan aturan volume `/app/data/proofs` |
| [`./docs/TESTING.md`](./docs/TESTING.md) | Empat gerbang kualitas wajib, isolasi `DATA_DIR_OVERRIDE`, cakupan pengujian utama, dan rincian `4` baseline gagal |
| [`./docs/DOKUMENTASI_TEKNIS_POS_V35.md`](./docs/DOKUMENTASI_TEKNIS_POS_V35.md) | Catatan alur pembayaran, status pesanan, BOM/stok, rekap review MR POS Shandi, audit laporan `#1–11`, dan audit Role Matriks (`V-35`) |
| [`./docs/test-cases/TC-V19-POS-REGRESSION-REPORT.md`](./docs/test-cases/TC-V19-POS-REGRESSION-REPORT.md) | Laporan kelulusan `37` skenario regresi P1 dan pengaman P2 pada modul POS |
| [`./docs/test-cases/TC-S07-PAID-EVENT-E2E.md`](./docs/test-cases/TC-S07-PAID-EVENT-E2E.md) | Skenario dan bukti uji ujung-ke-ujung siklus pemesanan serta penerbitan e-tiket event berbayar |
| [`./docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md) | Standar token warna, tipografi, komponen shadcn `@base-ui/react`, dan glosarium antarmuka |
| [`./docs/REDESIGN_HANDOFF.md`](./docs/REDESIGN_HANDOFF.md) | Status pelacak perombakan antarmuka per halaman, keamanan database, dan kriteria selesai UI |
| [`./docs/REDESIGN_PLAYBOOK.md`](./docs/REDESIGN_PLAYBOOK.md) | Urutan kerja langkah 0 sampai 10 untuk merombak dan memverifikasi satu halaman antarmuka |
| [`./docs/REDESIGN_REVIEW_GEMINI.md`](./docs/REDESIGN_REVIEW_GEMINI.md) | Catatan evaluasi perombakan antarmuka dan rencana perbaikan prioritas P0 hingga P4 |
| [`./docs/SHADCN_UI_IMPLEMENTATION_PLAN.md`](./docs/SHADCN_UI_IMPLEMENTATION_PLAN.md) | Rencana fondasi migrasi komponen antarmuka ke primitif shadcn |
| [`./docs/UNSLOP_AUDIT.md`](./docs/UNSLOP_AUDIT.md) | Audit pembersihan pola visual dan penulisan antarmuka di seluruh halaman |
