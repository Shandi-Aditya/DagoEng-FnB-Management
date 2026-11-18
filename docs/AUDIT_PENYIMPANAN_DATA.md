# Audit Penyimpanan Data (localStorage vs Server)

Dokumen satu halaman ini disusun pada Task V-04 sebagai acuan teknis untuk dibahas bersama Ka Ari. Pemetaan ini mencakup seluruh 45 kunci `localStorage`, 1 kunci `sessionStorage`, dan 4 state memori di aplikasi DagoEng guna menemukan akar masalah data hilang atau ter-reset saat pindah perangkat maupun hapus cache browser, sekaligus menjadi kontrak eksekusi penuh Task V-06.

## 1. Tabel Inventarisasi Data Inti dan Operasional

| Entitas Data | Sumber Browser (localStorage) | Sumber Server Saat Ini | Status | Prioritas Migrasi |
| :--- | :--- | :--- | :--- | :--- |
| **Orders** dan QR Self-Order | `dagoeng_orders_v3`, `dagoeng_sync_outbox_v1` | `/api/orders` (`pos_orders.json` ke PostgreSQL `SystemSetting`), belum mencakup order mandiri `CUSTOMER` | Hybrid sebagian (order kasir di server, QR tamu lokal) | P1 (tutup celah `/api/orders/self-order`) |
| **Shifts** kasir | `dagoeng_shifts_v3`, `dagoeng_sync_outbox_v1` | `/api/shifts` (`shifts.json` ke PostgreSQL `SystemSetting`) | Hybrid penuh (cache + outbox + server) | Selesai (jaga single-flight flush) |
| **Audit Trail** sistem | `dagoeng_audit_trail_persistent_v3` | `/api/audit-logs` (`audit_logs.json` append-only ke PostgreSQL) | Hybrid tanpa outbox (raw `fetch` hilang saat offline) | P1 (integrasikan `sync-outbox`) |
| **Loyalty Members** dan poin CRM | `dagoeng_loyalty_members_v3` | `/api/loyalty/members` (`loyalty_members.json`) dan `loyalty_points.json` terpisah | Hybrid bercelah (item terhapus bangkit lagi, dua file poin terpisah) | P1 (rekonsiliasi poin dan hapus permanen) |
| **Employees** dan hak akses staf | `dagoeng_employees_v1` | `/api/employees` (`employees.json`) | Hybrid bercelah (staf bawaan terhapus bangkit lagi saat hidrasi) | P1 (perbaiki rekonsiliasi outbox) |
| **Master Products** dan kategori F&B | `dagoeng_master_products_v1`, `dagoeng_master_categories_v1` | `/api/products` (`master_products.json`) | Hybrid bercelah (menu bawaan terhapus bangkit lagi saat cache kosong) | P1 (perbaiki seed sekali pakai) |
| **Coworking Bookings** | `dagoeng_cwk_bookings_v3` | `/api/coworking/bookings` (`coworking_bookings.json`) | Hybrid tanpa outbox (raw `fetch`, `CUSTOMER` ditolak `GET` 403) | P1 (pasang outbox dan bacaan milik tamu) |
| **Coworking Spaces, Members, Plans, Logs** | `dagoeng_cwk_spaces_v3`, `dagoeng_cwk_members_v3`, `dagoeng_cwk_logs_v3`, `localPlans` di memori | Tidak ada endpoint server | Browser Only 100% (`localPlans` 0% tersimpan saat ganti tab) | P1 (migrasi ke `/api/sync/coworking-master`) |
| **Platform Settings** dan modul aktif | `dagoeng_platform_settings_v1`, `activeOrgModules` dan draft `PromosTab` di memori | Hanya `.tenantOperations` (~15%) ke `/api/tenant/operations` (`tenant_operations.json`) | Browser Only 85% (pajak PB1/PPN, service, promo, kuota, hari libur, modul aktif hilang) | P1 (migrasi penuh ke `/api/sync/platform-settings`) |
| **Inventory, Resep BOM, PO, Opname** | `dagoeng_inventory_ingredients_v3`, `dagoeng_inventory_recipes_v3`, `dagoeng_inventory_pos_v3`, `dagoeng_inventory_logs_v3`, `dagoeng_inventory_opnames_v1` | Tidak ada endpoint server | Browser Only 100% (potong stok kasir tidak terlihat di gudang atau manajer) | P1 (migrasi delta atomik ke `/api/sync/inventory`) |
| **Tables, Denah Area, Reservasi Meja** | `dagoeng_tables_areas_v3`, `dagoeng_tables_reservations_v3`, `localTables` di memori | Tidak ada endpoint server | Browser Only 100% (status meja pramusaji HP tidak sinkron ke tablet kasir) | P1 (migrasi ke `/api/sync/tables`) |
| **Commercial Leases** dan sewa unit | `dagoeng_commercial_leases_v3` | Tidak ada endpoint server | Browser Only 100% (kontrak dan riwayat bayar sewa hilang saat clear cache) | P1 (migrasi ke `/api/sync/commercial`) |
| **Profil Mitra F&B, Bank, Mitra Baru** | `dagoeng_tenant_settings_v1`, `dago_custom_tenants` | Tidak ada endpoint server (form profil mitra juga gagal menulis storage) | Browser Only 100% (mitra baru dan rekening bank tidak sinkron lintas alat) | P1 (migrasi ke `/api/sync/tenants`) |
| **Kebijakan Settlement dan Bagi Hasil** | `dagoeng_settlement_receipt_policy_v1`, `dagoeng_tenant_revenue_splits_v1` | `/api/settings/settlement-receipt` (`settlement_receipt_policy.json`) | Hybrid tanpa outbox (mitra baru hanya menulis bagi hasil ke browser) | P1 (hubungkan outbox dan mitra baru) |
| **Aturan dan Voucher Wi-Fi** | `dagoeng_wifi_fnb_rules_v1`, `dagoeng_wifi_cw_rules_v1`, `dagoeng_wifi_vouchers_v1`, `dagoeng_wifi_calc_basis_v1` | Tidak ada endpoint server | Browser Only 100% (cetak ulang struk di alat kedua memicu kode voucher beda) | P2 (migrasi ke `/api/sync/wifi`) |
| **Langganan Hub dan Add-on Mitra** | `dagoeng_simulated_org_sub_v1`, `dagoeng_simulated_tenant_addons_v1`, `dagoeng_simulated_tenant_addons_v1_${scopeId}` | Tidak ada endpoint server (tombol toggle add-on belum memanggil penyimpan) | Browser Only 100% (fitur KDS multi-stasiun dan auto-WA tidak konsisten) | P2 (migrasi ke `/api/sync/subscription`) |
| **Perangkat dan Kebijakan Printer POS** | `dagoeng_printer_devices_v1`, `dagoeng_printer_settings_v1` | Hanya `receiptRoles` di `/api/settings/settlement-receipt` | Browser Only 85% (opsi pisah struk mitra dan daftar printer LAN lokal) | P2 (migrasi ke `/api/sync/printer-config`) |
| **Web Event dan E-Tiket Komunitas** | Cache token lokal `dago_my_event_tickets` | `/api/events/*` (tabel relasional PostgreSQL dengan advisory lock) | Full Server | Selesai |

## 2. Kunci Browser yang Tetap Lokal Sesuai Desain Perangkat

Sebanyak 13 kunci penyimpanan sengaja dipertahankan di masing-masing browser karena terikat perangkat fisik, antrean keluar sementara, atau sesi layar operator:

- **Antrean dan Spooler Perangkat.** `dagoeng_sync_outbox_v1` menyimpan antrean mutasi offline sebelum terkirim ke server, `dagoeng_print_queue_v1` mengelola spooler jembatan cetak thermal lokal (`localhost:8080` atau `8182`), dan `dagoeng_nota_seq_v1` menjadi batas bawah nomor urut nota lokal yang dikombinasikan dengan daftar transaksi server.
- **Preferensi Tampilan dan Lonceng Operator.** `dagoeng_theme_preference` menyimpan tema gelap atau terang per layar, sedangkan `dagoeng_notifications_v3` menyimpan status baca lonceng notifikasi operator lokal sementara pop-up pesanan baru KDS dan pramusaji ditarik langsung dari `/api/orders`.
- **Sesi Klien dan Penunjuk Tamu.** `dagoeng_active_persona`, `dagoeng_custom_customer`, `dagoeng_is_logged_out`, `dagoeng_last_activity_at`, `sessionStorage` `dagoeng_shift_closed_${userId}_${outletId}`, `dago_organizer_email`, pembersihan kunci lama `dago_org_bank_${activeEmail}`, serta `dagoeng_guest_identity_v1` menjaga konteks sesi per perangkat sementara otorisasi dan pencabutan sesi diverifikasi oleh cookie HTTP serta `/api/auth/session`.

## 3. Akar Masalah Kehilangan dan Reset Data

1. **Sebanyak 22 kunci data operasional dan 4 state memori belum memiliki endpoint server.** Pengaturan pajak, promo, stok bahan, resep BOM, PO, opname, status meja, ruang dan member co-working, kontrak komersial, profil bank mitra, voucher Wi-Fi, langganan, dan kebijakan printer hilang total ketika cache browser dibersihkan atau saat staf berpindah perangkat.
2. **Bug penggabungan antrean `sync-outbox` (`POST` ditimpa `PUT`).** Ketika operator membuat data baru saat offline (`POST`) lalu menyuntingnya sebelum online (`PUT`), `enqueueOutboxItem` menimpa metode `POST` menjadi `PUT` sehingga server menolak dengan HTTP 404 dan menghapus data tersebut secara permanen.
3. **Tidak ada pengurasan outbox otomatis saat jaringan pulih.** Aplikasi belum memasang pendengar global `online` atau `visibilitychange` dan memanggil `flushOutbox` ganda tanpa kunci single-flight saat pemuatan awal.
4. **Kebangkitan kembali data bawaan yang sudah dihapus.** Fungsi baca di `persistent-storage.ts` menulis ulang data contoh bila array bernilai kosong `[]`, dan hidrasi klien menggabungkan kembali item `INITIAL_*` yang sudah dihapus di perangkat lain.
5. **Enam aksi simpan pada halaman Pengaturan hanya mengubah memori komponen.** Form profil dan bank mitra, toggle add-on, paket member co-working, serta edit daftar meja di Pengaturan belum meneruskan perubahan ke penyimpanan permanen.

## 4. Rencana Migrasi ke Server (Bahan Diskusi Ka Ari)

### Fase 1: Penyatuan Penyimpanan Server Seluruh Domain Inti (Task V-06)
- Pertahankan fondasi yang sudah berjalan di `/api/orders`, `/api/shifts`, `/api/audit-logs`, `/api/employees`, `/api/products`, `/api/loyalty/members`, `/api/coworking/bookings`, `/api/tenant/operations`, dan `/api/settings/settlement-receipt`.
- Bangun mesin sinkronisasi komando domain terpadu `/api/sync/[domain]` di atas `persistent-storage.ts` dan replikasi PostgreSQL `SystemSetting` (`STORAGE_<filename>`) untuk 9 domain yang tersisa yaitu `platform-settings`, `tenants`, `wifi`, `subscription`, `printer-config`, `inventory`, `tables`, `coworking-master`, dan `commercial`, ditambah rute khusus `/api/orders/self-order` untuk pesanan QR pelanggan.
- Gunakan komando delta atomik ber-ID idempoten pada pemotongan stok resep, status meja, dan kuota promo agar transaksi serentak dari tablet kasir, ponsel pramusaji, serta laptop manajer tidak saling menimpa, serta batasi riwayat log stok dan voucher terminal maksimal 1.000 entri.

### Fase 2: Penguatan Offline Sync Outbox dan Rekonsiliasi Tanpa Data Hantu (Task V-06)
- Perbarui `sync-outbox.ts` dengan mesin transisi koalesensi (`POST` diikuti `PUT` tetap `POST`, `POST` diikuti `DELETE` dibatalkan lokal, `PUT` diikuti `PUT` digabung) beserta nomor urut monotonik `seq` dan pengunci single-flight `flushOutbox` yang terpanggil otomatis pada event `online` dan `visibilitychange`.
- Pisahkan pembacaan data contoh sekali pakai (`readSeededPersistentData`) dari jalur tulis agar penghapusan seluruh item bawaan bertahan sebagai `[]` tanpa memicu galat `RISK_DATA_LOSS` saat database dingin, serta gunakan `reconcileCollectionWithOutbox` di seluruh context React dan cermin sinkron `src/lib/*`.

### Fase 3: Transisi Bertahap JSON Replica ke Tabel Relasional Prisma (Pasca V-06)
- Alihkan penyimpanan dokumen JSON `SystemSetting` ke tabel relasional PostgreSQL yang sudah disiapkan pada skema Prisma meliputi `orders`, `order_items`, `cashier_shifts`, `products`, `customers`, `employees`, `tables`, dan `rooms` melalui skrip migrasi ETL terverifikasi setelah seluruh kontrak operasional multi-perangkat stabil.

## 5. Poin Keputusan Bersama Ka Ari

1. Menyetujui migrasi seluruh 22 kunci `localStorage` bisnis dan 4 state memori ke server melalui lapisan `persistent-storage` bereplikasi PostgreSQL `SystemSetting` pada Task V-06 sambil membiarkan 13 kunci perangkat dan sesi tetap lokal.
2. Menyetujui batas penyimpanan riwayat operasional berfrekuensi tinggi maksimal 1.000 log pergerakan stok dan 1.000 voucher Wi-Fi terminal agar sinkronisasi JSON lintas perangkat tetap ringan.
3. Menjadwalkan migrasi penuh ke tabel relasional Prisma pada Fase 3 setelah seluruh pengujian multi-perangkat dan ketahanan hapus cache pada Task V-06 dinyatakan lulus.
