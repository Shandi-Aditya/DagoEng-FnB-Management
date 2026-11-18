# Pengujian otomatis dan gerbang kualitas

Repositori ini menerapkan empat gerbang pemeriksaan statis dan otomatis sebelum perubahan dinyatakan selesai. Seluruh pengujian unit dan integrasi dijalankan menggunakan **Vitest `2.1.5`** pada lingkungan Node terisolasi.

## 1. Empat gerbang verifikasi wajib

Jalankan keempat perintah berikut dari akar repositori:

```bash
npm run lint:ui -- --strict src
npx tsc --noEmit -p .
npx vitest run
npm run build
```

Fungsi setiap perintah adalah sebagai berikut:

- **Lint desain antarmuka (`npm run lint:ui`).** Menjalankan `scripts/lint-ui.ts` dan `src/lib/lint-ui.ts` untuk memeriksa 14 aturan sistem desain shadcn, termasuk pelarangan warna mentah Tailwind, hex hardcoded, token warisan, `font-extrabold`/`font-black`, `uppercase` ber-tracking lebar, teks di bawah `12px`, `transition-all`, efek `scale`, overlay manual `fixed inset-0`, prop `asChild` (karena proyek memakai `@base-ui/react`, bukan Radix), dan emoji dekoratif.
- **Pemeriksaan tipe (`npx tsc --noEmit -p .`).** Memastikan seluruh kode aplikasi di `src/` lolos kompilasi TypeScript `5.6` mode `strict` tanpa galat.
- **Suite pengujian Vitest (`npx vitest run`).** Menjalankan seluruh berkas `tests/*.test.ts` secara berurutan (`fileParallelism: false` di `vitest.config.ts`). Berkas `tests/setup-test-storage.ts` secara otomatis menyetel `DATA_DIR_OVERRIDE` ke `<cwd>/data/.test-storage` agar pengujian tidak mengubah berkas `data/*.json` kerja maupun database Neon selama `NODE_ENV="test"`.
- **Kompilasi produksi (`npm run build`).** Menjalankan `prisma generate` diikuti `next build`. Jangan menjalankan `npm run build` bersamaan dengan proses `npm run dev` yang sedang aktif karena keduanya berbagi direktori `.next`.

Untuk menghitung ulang jumlah berkas pengujian yang tersedia saat ini, jalankan perintah berikut:

```bash
ls -1 tests/*.test.ts | wc -l
```

## 2. Cakupan suite pengujian utama

Pengujian di direktori `tests/` mengunci aturan bisnis lintas modul POS, Co-working, Inventori, Laporan, Keamanan Sesi, dan Web Event:

- **Regresi penuh POS P1 dan P2.** `tests/v19-pos-p1-regression.test.ts` memverifikasi penomoran nota harian berurutan WITA, pemisahan struk mitra, verifikasi QRIS statis ber-PIN, pencegahan klik ganda bayar, void dan refund kasir, rekonsiliasi shift, serta pencabutan sesi lintas perangkat. Rincian 37 skenario terdokumentasi di [TC-V19-POS-REGRESSION-REPORT.md](./test-cases/TC-V19-POS-REGRESSION-REPORT.md).
- **Sinkronisasi server dan audit penyimpanan.** `tests/pos-data-storage-audit-v04.test.ts` dan pengujian domain `/api/sync/[domain]` memverifikasi replikasi `STORAGE_*` di PostgreSQL serta outbox sinkronisasi offline `dagoeng_sync_outbox_v1`. Lihat [AUDIT_PENYIMPANAN_DATA.md](./AUDIT_PENYIMPANAN_DATA.md).
- **Bagi hasil mitra, pajak struk, rekonsiliasi, dan chatbot tutup shift.** `tests/settlement.test.ts`, `tests/revenue-split-and-tax.test.ts`, serta pengujian V-16 hingga V-18 mengunci perhitungan DPP sebelum PB1, distribusi peran cetak struk, rekonsiliasi tiga pihak (Kasir, Struk, Settlement Mitra), ekspor `.xlsx` tiga lembar, dan pengiriman ringkasan tutup shift ke WhatsApp serta Telegram.
- **Resep BOM dan stok bahan baku.** `tests/inventory-cogs.test.ts` dan suite V-11 menguji pemotongan otomatis 16 menu aktif terhadap 19 bahan baku beserta pengganda varian dan modifier.
- **Siklus penuh tiket event berbayar.** `tests/paid-event-e2e-s07.test.ts` dan suite event terkait menguji alur pendaftaran, kuota tiket bertingkat, kode promo, undangan gratis, dan check-in QR. Lihat [TC-S07-PAID-EVENT-E2E.md](./test-cases/TC-S07-PAID-EVENT-E2E.md).
- **Kelengkapan dokumentasi serah terima.** `tests/v20-pos-handover-docs.test.ts` memverifikasi keutuhan seluruh tautan relatif antar-dokumen, ketersediaan bagian wajib serah terima V-20 di `README.md`, dan ketiadaan dokumen usang yang telah dihapus.

## 3. Empat berkas uji baseline yang diketahui gagal

Sesuai aturan pada `AGENTS.md`, terdapat tepat 4 berkas uji lama dari fase pra-POS yang tercatat gagal sebagai baseline dan tidak boleh dihapus tanpa penugasan khusus:

| Berkas uji | Penyebab teknis kegagalan saat ini |
|---|---|
| `tests/etl-data-validation.test.ts` | Berkas `data/organizers.json` diawali karakter UTF-8 BOM (`0xFEFF`) yang belum dibersihkan oleh `JSON.parse` pada `scripts/migrate-json-to-postgres.ts`, serta jumlah baris seed lokal (7 organizer) lebih kecil dari asersi lama (`>= 9`). |
| `tests/final-demo-readiness.test.ts` | Menggunakan tanggal event statis masa lalu (`2026-11-10`, `2026-11-15`, `2026-11-16`), sehingga `validateEventBooking` di `src/lib/events.ts` menolak pemesanan karena waktu pelaksanaan event sudah berakhir. |
| `tests/organizer-activation-hardening.test.ts` | Pengujian H-5 mengubah `process.env.NODE_ENV` menjadi `"production"` saat memanggil `POST /api/auth/login`, yang memicu `syncStorageFromDb("organizers.json")` ke database Neon aktif dan menimpa data uji lokal di `.test-storage`. |
| `tests/storage-sync-safety.test.ts` | Memuat asumsi mock lama sebelum penguatan penyimpanan: batas timeout DB kini dinaikkan dari `3500ms` menjadi `8000ms` di `src/lib/data-storage.ts`, dan status `SYNCED` tanpa `updatedAt` kini melempar `LOST_UPDATE_PREVENTED` alih-alih melakukan `upsert` tanpa pengaman CAS. |

Seluruh berkas pengujian di luar keempat baseline di atas wajib lulus 100 persen.
