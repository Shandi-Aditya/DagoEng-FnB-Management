# Audit Penyimpanan Data (localStorage vs Server)

Dokumen satu halaman ini merangkum hasil audit Task V-04 sekaligus status akhir pasca-implementasi Task V-06 hingga V-19 sebagai bahan serah terima bersama Ka Ari. Audit memetakan seluruh 47 kunci `localStorage` termasuk 2 kunci cermin baru hasil V-06, 1 kunci `sessionStorage`, dan 4 state memori komponen yang sebelumnya belum persisten. Seluruh data bisnis dan operasional inti kini tersimpan di server PostgreSQL Neon pada tabel `system_settings` dengan awalan `STORAGE_`, sementara `localStorage` berfungsi murni sebagai cermin baca offline dan antrean sinkronisasi keluar.

## 1. Tabel Inventarisasi Data Inti dan Operasional

| Entitas Data | Sumber Browser (localStorage) | Sumber Server Saat Ini | Status | Prioritas Migrasi |
| :--- | :--- | :--- | :--- | :--- |
| **Orders** dan QR Self-Order | Cermin `dagoeng_orders_v3`, antrean `dagoeng_sync_outbox_v1` | `/api/orders` untuk staf dan `/api/orders/self-order` berharga otoritatif server (`STORAGE_pos_orders.json`) | Tersinkron Server + Outbox (temuan V-04: QR tamu hanya di browser) | P1 (Selesai di V-06) |
| **Shifts** kasir | Cermin `dagoeng_shifts_v3`, antrean `dagoeng_sync_outbox_v1` | `/api/shifts` (`STORAGE_shifts.json`) | Tersinkron Server + Outbox single-flight | P1 (Selesai) |
| **Audit Trail** sistem | Cermin `dagoeng_audit_trail_persistent_v3`, antrean `dagoeng_sync_outbox_v1` | `/api/audit-logs` append-only (`STORAGE_audit_logs.json`) | Tersinkron Server + Outbox (temuan V-04: raw `fetch` tanpa antrean) | P1 (Selesai di V-06) |
| **Loyalty Members** dan poin CRM | Cermin `dagoeng_loyalty_members_v3`, antrean `dagoeng_sync_outbox_v1` | `/api/loyalty/members` terpadu antara `STORAGE_loyalty_members.json` dan `STORAGE_loyalty_points.json` | Tersinkron Server + Outbox (temuan V-04: dua berkas poin terpisah dan data contoh bangkit lagi) | P1 (Selesai di V-06) |
| **Employees** dan hak akses staf | Cermin `dagoeng_employees_v1`, antrean `dagoeng_sync_outbox_v1` | `/api/employees` (`STORAGE_employees.json`) | Tersinkron Server + Outbox (temuan V-04: staf bawaan terhapus muncul lagi) | P1 (Selesai di V-06) |
| **Master Products** dan kategori F&B | Cermin `dagoeng_master_products_v1`, `dagoeng_master_categories_v1`, antrean `dagoeng_sync_outbox_v1` | `/api/products` (`STORAGE_master_products.json`) | Tersinkron Server + Outbox (temuan V-04: menu bawaan terhapus muncul lagi) | P1 (Selesai di V-06) |
| **Coworking Bookings** | Cermin `dagoeng_cwk_bookings_v3`, antrean `dagoeng_sync_outbox_v1` | `/api/coworking/bookings` (`STORAGE_coworking_bookings.json`, bacaan `CUSTOMER` tersaring aman) | Tersinkron Server + Outbox (temuan V-04: raw `fetch` dan `GET` tamu ditolak 403) | P1 (Selesai di V-06) |
| **Coworking Spaces, Members, Plans, Logs** | Cermin `dagoeng_cwk_spaces_v3`, `dagoeng_cwk_members_v3`, `dagoeng_cwk_logs_v3`, `dagoeng_cwk_plans_v1` | `/api/sync/coworking-master` (`STORAGE_coworking_master.json`, batas 1.000 log check-in) | Tersinkron Server + Outbox (temuan V-04: Browser Only 100% dan `localPlans` hanya di memori) | P1 (Selesai di V-06) |
| **Platform Settings** dan modul aktif | Cermin `dagoeng_platform_settings_v1`, antrean `dagoeng_sync_outbox_v1` | `/api/sync/platform-settings` (`STORAGE_platform_settings.json`) dan cermin `/api/tenant/operations` (`STORAGE_tenant_operations.json`) | Tersinkron Server + Outbox (temuan V-04: pajak, service, promo, hari libur, dan `activeOrgModules` hilang saat clear cache) | P1 (Selesai di V-06) |
| **Inventory, Resep BOM, PO, Opname** | Cermin `dagoeng_inventory_ingredients_v3`, `dagoeng_inventory_recipes_v3`, `dagoeng_inventory_pos_v3`, `dagoeng_inventory_logs_v3`, `dagoeng_inventory_opnames_v1` | `/api/sync/inventory` (`STORAGE_inventory_state.json`, delta `APPLY_BOM_DELTAS` ber-`opId` dan batas 1.000 log) | Tersinkron Server + Outbox (temuan V-04: Browser Only 100%) | P1 (Selesai di V-06) |
| **Tables, Denah Area, Reservasi Meja** | Cermin `dagoeng_tables_areas_v3`, `dagoeng_tables_reservations_v3` | `/api/sync/tables` (`STORAGE_tables_state.json`) | Tersinkron Server + Outbox (temuan V-04: Browser Only 100% dan `localTables` hanya di memori) | P1 (Selesai di V-06) |
| **Commercial Leases** dan sewa unit | Cermin `dagoeng_commercial_leases_v3` | `/api/sync/commercial` (`STORAGE_commercial_leases.json`, RBAC khusus Owner Hub, Super Admin, dan Manajer) | Tersinkron Server + Outbox (temuan V-04: Browser Only 100%) | P1 (Selesai di V-06) |
| **Profil Mitra F&B, Bank, Mitra Baru** | Cermin `dagoeng_tenant_settings_v1`, `dago_custom_tenants` | `/api/sync/tenants` (`STORAGE_tenants_directory.json`, penyamaran rekening bank lintas mitra) | Tersinkron Server + Outbox (temuan V-04: Browser Only 100% dan form profil gagal menyimpan) | P1 (Selesai di V-06) |
| **Kebijakan Settlement dan Bagi Hasil** | Cermin `dagoeng_settlement_receipt_policy_v1`, `dagoeng_tenant_revenue_splits_v1` | `/api/settings/settlement-receipt` (`STORAGE_settlement_receipt_policy.json`) terhubung ke `sync-outbox` | Tersinkron Server + Outbox (temuan V-04: bagi hasil mitra baru hanya lokal) | P1 (Selesai di V-06 & V-18) |
| **Aturan dan Voucher Wi-Fi** | Cermin `dagoeng_wifi_fnb_rules_v1`, `dagoeng_wifi_cw_rules_v1`, `dagoeng_wifi_vouchers_v1`, `dagoeng_wifi_calc_basis_v1` | `/api/sync/wifi` (`STORAGE_wifi_state.json`, kode voucher deterministik FNV-1a dan batas 1.000 voucher) | Tersinkron Server + Outbox (temuan V-04: Browser Only 100% dan kode struk berbeda antar alat) | P2 (Selesai di V-06) |
| **Langganan Hub dan Add-on Mitra** | Cermin `dagoeng_simulated_org_sub_v1`, `dagoeng_simulated_tenant_addons_v1`, `dagoeng_simulated_tenant_addons_v1_${scopeId}`, `dagoeng_simulated_tenant_addons_v1_scopes` | `/api/sync/subscription` (`STORAGE_subscription_state.json`, normalisasi cakupan `org-dago-hub`) | Tersinkron Server + Outbox (temuan V-04: Browser Only 100% dan tombol add-on belum memanggil penyimpan) | P2 (Selesai di V-06) |
| **Perangkat dan Kebijakan Printer POS** | Cermin `dagoeng_printer_devices_v1`, `dagoeng_printer_settings_v1` | `/api/sync/printer-config` (`STORAGE_printer_config.json`) dan distribusi role struk di `/api/settings/settlement-receipt` | Tersinkron Server + Outbox (temuan V-04: konfigurasi printer dan pisah struk mitra lokal) | P2 (Selesai di V-06 & V-18) |
| **Web Event dan E-Tiket Komunitas** | Cache token lokal `dago_my_event_tickets` | `/api/events/*` (tabel relasional PostgreSQL dengan advisory lock) | Full Server | Selesai |

## 2. Kunci Browser yang Tetap Lokal Sesuai Desain Perangkat

Sebanyak 13 kunci penyimpanan dipertahankan lokal di masing-masing perangkat karena mengikat antrean keluar sementara, jembatan perangkat keras kasir, atau konteks tampilan operator:

- **Antrean dan Spooler Perangkat.** `dagoeng_sync_outbox_v1` menyimpan antrean mutasi offline sebelum terkirim ke server, `dagoeng_print_queue_v1` mengelola antrean cetak thermal lokal (`localhost:8080` atau `8182`) per meja kasir, dan `dagoeng_nota_seq_v1` menjaga batas bawah nomor urut nota lokal yang digabungkan dengan nomor transaksi tertinggi dari server.
- **Preferensi Tampilan dan Status Baca Lonceng.** `dagoeng_theme_preference` menyimpan pilihan tema gelap atau terang pada layar tersebut, sedangkan `dagoeng_notifications_v3` menyimpan tanda baca lonceng operator lokal sementara pop-up pesanan baru KDS dan pramusaji ditarik real-time dari `/api/orders`.
- **Sesi Klien dan Penunjuk Tamu.** `dagoeng_active_persona`, `dagoeng_custom_customer`, `dagoeng_is_logged_out`, `dagoeng_last_activity_at`, `sessionStorage` `dagoeng_shift_closed_${userId}_${outletId}`, `dago_organizer_email`, pembersihan kunci lama `dago_org_bank_${activeEmail}`, serta `dagoeng_guest_identity_v1` menjaga penunjuk sesi di perangkat sementara otorisasi dan pencabutan sesi tetap ditegakkan oleh cookie HTTP di server.

## 3. Temuan Akar Masalah V-04 dan Perbaikan Permanen di V-06

1. **Sebanyak 22 kunci data bisnis dan 4 state memori semula belum memiliki endpoint server.** Seluruhnya kini terhubung ke `/api/sync/[domain]` dan `/api/orders/self-order` melalui `createSyncedDomainClient` dan hook `useSyncedDomain` dengan memoisasi snapshot yang stabil untuk React 19.
2. **Bug penimpaan metode `POST` menjadi `PUT` pada antrean offline.** Fungsi `coalesceOutboxMutation` di `sync-outbox.ts` kini mempertahankan metode `POST` saat entri offline baru disunting sebelum online, membatalkan pasangan `POST` lalu `DELETE` secara lokal, serta menjaga nomor urut monotonik `seq`.
3. **Ketiadaan pengurasan antrean otomatis dan potensi kirim ganda.** `ensureGlobalOutboxAutoFlush` kini menguras antrean otomatis saat event `online` dan `visibilitychange` dengan kunci single-flight pada `flushOutbox` serta parameter `?id=` otomatis untuk metode `DELETE`.
4. **Kebangkitan kembali data bawaan yang sudah dihapus.** Fungsi `readSeededPersistentData` dan `mutateSeededPersistentData` pada `persistent-storage.ts` hanya menyemai `INITIAL_*` ketika berkas JSON belum pernah dibuat, sehingga koleksi yang dihapus habis tetap bernilai `[]` di seluruh perangkat.
5. **Lima aksi simpan di halaman Pengaturan sebelumnya terputus di memori lokal.** Form profil dan rekening mitra, pengelolaan paket co-working, pengelolaan meja F&B, perubahan promo langsung, dan sakelar add-on pada `src/app/(dashboard)/settings/page.tsx` kini seluruhnya tersambung ke penyimpanan server.
6. **Penolakan tulis `UNAVAILABLE` pada instans server dingin.** Pengujian langsung ke database Neon menemukan bahwa pemanggilan `writePersistentData` sebelum pembacaan awal memicu galat `RISK_DATA_LOSS`, dan celah ini telah ditutup dengan rekonsiliasi `syncStorageFromDb` otomatis sebelum penulisan ke disk dan PostgreSQL.

## 4. Rencana Migrasi ke Server dan Status Pelaksanaan

### Fase 1: Penyatuan Penyimpanan Server Seluruh Domain Inti (Selesai di Task V-06)
- Mempertahankan rute inti `/api/orders`, `/api/shifts`, `/api/audit-logs`, `/api/employees`, `/api/products`, `/api/loyalty/members`, `/api/coworking/bookings`, `/api/tenant/operations`, dan `/api/settings/settlement-receipt`.
- Mengaktifkan `/api/sync/[domain]` di atas replikasi PostgreSQL `SystemSetting` (`STORAGE_<filename>`) untuk kesembilan domain (`platform-settings`, `tenants`, `wifi`, `subscription`, `printer-config`, `inventory`, `tables`, `coworking-master`, dan `commercial`) beserta `/api/orders/self-order`.
- Terverifikasi langsung pada database Neon PostgreSQL bahwa seluruh 14 berkas `STORAGE_*` tersimpan fisik dan terhidrasi identik pada instans server kedua yang kosong, serta seluruh 9 endpoint `/api/sync/*` mengembalikan HTTP 200 di browser.

### Fase 2: Penguatan Offline Sync Outbox dan Rekonsiliasi Tanpa Data Hantu (Selesai di Task V-06)
- Mengaktifkan koalesensi mutasi `sync-outbox.ts`, rekonsiliasi koleksi `reconcileCollectionWithOutbox`, idempotensi `opId` pada pemotongan stok resep dan kuota promo, serta batas bergulir 1.000 entri pada log inventori, log check-in co-working, dan voucher Wi-Fi.
- Terverifikasi lulus 32 dari 32 pengujian terarah V-04 dan V-06 serta 169 dari 173 berkas pengujian pada suite regresi penuh.

### Fase 3: Transisi Bertahap JSON Replica ke Tabel Relasional Prisma (Peta Jalan Pasca Magang)
- Memigrasikan dokumen JSON `STORAGE_*` pada `system_settings` ke tabel relasional PostgreSQL yang sudah tersedia di skema Prisma (`orders`, `order_items`, `cashier_shifts`, `products`, `customers`, `employees`, `tables`, dan `rooms`) menggunakan skrip ETL terverifikasi apabila volume transaksi historis memerlukan kueri analitik SQL langsung.

## 5. Poin Serah Terima Bersama Ka Ari

1. Seluruh data operasional POS, inventori BOM, meja, co-working, sewa komersial, pengaturan pajak dan promo, profil serta rekening mitra, Wi-Fi, langganan, dan printer kini sudah tersinkron penuh ke database Neon PostgreSQL dan tahan terhadap pembersihan cache browser maupun perpindahan perangkat.
2. Sebanyak 13 kunci perangkat dan sesi tetap disimpan lokal per workstation kasir sesuai kebutuhan perangkat keras cetak thermal dan isolasi tab operator, sedangkan riwayat log stok, check-in, dan voucher dibatasi 1.000 entri terbaru agar sinkronisasi tetap cepat.
3. Fase 3 berupa pemindahan penyimpanan JSON `STORAGE_*` ke tabel relasional Prisma disiapkan sebagai agenda pengembangan lanjutan pasca serah terima `V-20`.
