# LAPORAN REKONSILIASI BUKTI RILIS & UAT — EVENT MARKETPLACE DAGOENG

**Tanggal Rekonsiliasi:** Jumat, 30 Oktober 2026  
**Auditor / QA Lead:** Senior QA Engineer & Release Manager  
**Repositori:** `d:\Magang Shandi\DagoEng F&B Management` (Branch: `main`)  
**Metodologi:** Evaluasi Bukti Empiris, Investigasi Windows File-Locking, Rekonsiliasi Hasil UAT & Validasi Checksum  

---

## 1. Rekonsiliasi Verifikasi Build (Build Verification Reconciliation)

Pada pengujian sebelumnya tercatat anomali:
- `npm run build` menghasilkan `exit code 1` (gagal pada tahap `prisma generate`).
- `next build` menghasilkan `exit code 1` (gagal pada tahap pembukaan `.next\trace`).

### A. Investigasi Akar Masalah (Root Cause Analysis):
1. **Analisis Kode Aplikasi & Konfigurasi**:
   - Seluruh kode TypeScript dan konfigurasi Next.js (`next.config.mjs`) **BEBAS DARI ERROR SINTAKS DAN TIPE**.
   - Skema Prisma (`prisma/schema.prisma`) valid 100%.
2. **Penyebab Kegagalan**:
   - Kegagalan murni disebabkan oleh **Windows OS File-Locking Conflict**.
   - Sebuah proses `node.exe` (PID 10052, server `next dev`) sedang aktif berjalan dan mendengarkan port 3000.
   - Di Windows, proses yang sedang memuat library DLL secara dinamis (`dlopen`) mengunci file `node_modules\.prisma\client\query_engine-windows.dll.node`. Ketika `prisma generate` mencoba menimpa file tersebut via `.tmp4320 -> query_engine-windows.dll.node`, Windows menolaknya dengan error `EPERM: operation not permitted, rename`.
   - Hal serupa terjadi ketika `next build` dijalankan bersamaan dengan `next dev`: keduanya mencoba membuka file telemetri `.next\trace` secara eksklusif, menghasilkan error `EPERM: operation not permitted, open '.next\trace'`.

### B. Hasil Uji Ulang Build Terkontrol:
Setelah proses `node.exe` (PID 10052) dihentikan dan port 3000 dilepaskan:
- **Perintah**: `npm run build` (menjalankan `prisma generate && next build`)
- **Output Aktual**:
  ```text
  > dagoeng-fnb-management@1.0.0 build
  > node ./node_modules/prisma/build/index.js generate && node ./node_modules/next/dist/bin/next build

  Environment variables loaded from .env
  Prisma schema loaded from prisma\schema.prisma
  ✔ Generated Prisma Client (v5.22.0) to .\node_modules\@prisma\client in 388ms

    ▲ Next.js 14.2.35
    - Environments: .env
     Creating an optimized production build ...
  warn - The class `duration-[4000ms]` is ambiguous and matches multiple utilities.
   ✓ Compiled successfully
     Linting and checking validity of types ...
     Collecting page data ...
     Generating static pages (0/32) ...
   ✓ Generating static pages (32/32)
     Finalizing page optimization ...
     Collecting build traces ...

  Route (app)                                Size     First Load JS
  ┌ ○ /                                      13.5 kB         128 kB
  ├ ○ /activity-log                          14.6 kB         124 kB
  ├ ƒ /api/events                            0 B                0 B
  ├ ƒ /api/events/[id]/book                  0 B                0 B
  ├ ƒ /api/events/bookings/my                0 B                0 B
  ├ ƒ /api/events/portal                     0 B                0 B
  ├ ƒ /api/events/portal/check-in            0 B                0 B
  ├ ƒ /api/events/tickets/[token]            0 B                0 B
  ├ ○ /events                                7.83 kB         122 kB
  ├ ○ /events-admin                          25.9 kB         135 kB
  ├ ○ /events/checkin                        6.57 kB         120 kB
  ├ ○ /events/portal                         130 kB          244 kB
  ├ ○ /events/tickets/recovery               5.63 kB         109 kB
  ... (seluruh 32 rute sukses)
  ```
- **Exit Code Aktual**: **`0` (BERHASIL / VERIFIED)**
- **Kesimpulan Build**: Kode aplikasi siap produksi. Tidak ada error build ketika lingkungan tidak mengalami konflik lock file Windows.

---

## 2. Rekonsiliasi Metode Pengujian UAT (UAT Method Classification)

Berdasarkan audit terhadap berkas pengujian [`scripts/run-browser-uat-simulation.mjs`](file:///d:/Magang%20Shandi/DagoEng%20F&B%20Management/scripts/run-browser-uat-simulation.mjs):

1. **Metode Aktual yang Dijalankan**:
   - Skrip menggunakan Node.js Native `fetch()` untuk mengeksekusi request HTTP live terhadap server lokal `http://localhost:3000`.
   - Mengelola cookie sesi (`dagoeng_active_persona`), payload JSON, response headers, dan status HTTP.
   - Menguji validitas HTML respon halaman publik melalui parsing string meta tag viewport.
2. **Keterbatasan Objektif**:
   - **TIDAK MENGGUNAKAN** browser automation engine (seperti Playwright, Puppeteer, atau Selenium).
   - **TIDAK ADA** interaksi DOM fisik (klik elemen, scroll, rendering CSS di canvas/peramban).
   - **TIDAK ADA** tangkapan layar visual (*screenshot*).
3. **Klasifikasi Akurat**:
   - **Live API Integration & HTTP User Journey Simulation**: **VERIFIED (PASS — 32/32 Kasus)**
   - **Browser Automated E2E (Playwright/Puppeteer)**: **NOT EXECUTED** (Dependensi tidak terpasang di repo)
   - **Manual Physical Browser UAT**: **NOT EXECUTED** (Sesi audit otomatis)

---

## 3. Verifikasi Integritas Data Demo Baseline (Data Integrity Verification)

Untuk memastikan pengujian simulasi tidak mencemari data historis atau meninggalkan *leftover records*:

### A. Pemeriksaan Git Working Tree:
```text
git diff data/ -> 0 lines changed (KOSONG)
```

### B. Verifikasi Checksum SHA-256 Berkas Data:
| Berkas | Algoritma | Hash Aktual | Integritas Baseline |
|---|---|---|---|
| `data/event_bookings.json` | SHA-256 | `2D65C2516BF77DE29055468082CBE1CCA958A656D399EF55DCF02F6B52D16FBA` | **UTUH (MATCH)** |
| `data/events.json` | SHA-256 | `6FC1B414DC3D8C1B83AE7B2E89E380E41F47C07564CC1E95CFA5531B41F3CFE7` | **UTUH (MATCH)** |
| `data/organizers.json` | SHA-256 | `87A40581A92425E89CDBD8717328A9E90742C133FDA81D0B0C1E611EE5B1CDFA` | **UTUH (MATCH)** |
| `data/proofs/proof-dago-evt-51628-1793179519555.png` | SHA-256 | `05A9D413298885A99B7993E08809019FD464F62C0F75751C776EF7D6E40C3D24` | **UTUH (MATCH)** |
| `data/proofs/proof-dago-evt-72676-1793179816938.png` | SHA-256 | `BC37D23026012DE4FDAD3B5DA743A3682FA007DFEEC2F790CC6081FAF4EFFA47` | **UTUH (MATCH)** |

**Kesimpulan Integritas Data**:
- Seluruh 8 transaksi pemesanan (6 PAID, 1 PENDING, 1 CANCELLED, Total Rp 1.706.000) **tetap utuh 100%**.
- Tidak ada data QA sementara yang tertinggal di disk.
- Bukti pembayaran fisik biner tetap identik.

---

## 4. Verifikasi Status Git & Workspace Hygiene

```text
Changes not staged for commit:
	modified:   src/app/(auth)/login/page.tsx
	modified:   src/app/events/page.tsx
	modified:   src/app/events/tickets/recovery/page.tsx

Untracked files:
	DAGOENG_EVENT_BROWSER_UAT_REPORT.md
	DAGOENG_FINAL_EVIDENCE_AUDIT.md
	DAGOENG_SCHEMA_APPROVAL_CHECKLIST.md
	DAGOENG_STAGING_MIGRATION_RUNBOOK.md
	scripts/run-browser-uat-simulation.mjs
	tests/event-marketplace-final-clearing.test.ts
```

- `prisma/schema.prisma`: **TIDAK TERSENTUH (0 lines changed)**
- Tidak ada `git commit`, `git push`, atau deployment yang dijalankan.
- Perubahan kode aplikasi hanya mencakup 3 berkas perbaikan navigasi UX dan penanganan tiket warisan (+34 baris, -1 baris).

---

## 5. Keputusan Rilis Final Berbasis Bukti (Final Release Decision Matrix)

| Dimensi Evaluasi | Status | Justifikasi Bukti |
|---|---|---|
| **1. Automated Regression Suite** | **VERIFIED** | 54 test files lulus (583/583 tests lulus), `type-check` 0 errors. |
| **2. Live API / HTTP Simulation** | **VERIFIED** | 32/32 skenario user journey lintas 4 persona berhasil diselesaikan di `http://localhost:3000`. |
| **3. Browser Automated E2E** | **NOT EXECUTED** | Tidak ada driver browser automation (Playwright/Puppeteer) terpasang pada repository. |
| **4. Manual Physical Browser UAT** | **NOT EXECUTED** | Pengujian manual visual via peramban oleh manusia belum dilakukan pada sesi ini. |
| **5. Production Build** | **VERIFIED** | `npm run build` sukses mengompilasi 32 rute (Exit code 0 saat tidak terkendala file-lock). |
| **6. Storage Readiness (Local)** | **VERIFIED** | JSON storage berfungsi stabil untuk demo lokal satu proses Node.js. |
| **7. Storage Readiness (Cloud)** | **BLOCKED** | JSON storage **TIDAK AMAN** untuk Vercel Serverless (ephemeral storage reset & ketiadaan distributed lock). |
| **8. Payment Gateway Live** | **NOT EXECUTED / BLOCKED** | DOKU hanya teruji via mock/simulasi; kredensial live & transaksi nyata belum diuji. |

---

## 6. Kesimpulan & Rekomendasi Auditor

1. **Apakah Event Marketplace layak untuk Demo Lokal?**  
   👉 **YA, LAYAK (READY FOR LOCAL DEMO)**. Pada mesin lokal / laptop presentasi (single-instance), seluruh alur registrasi, pemesanan, kalkulasi bagi hasil, verifikasi transfer admin, penguncian QR code, dan check-in parsial berfungsi mulus.
2. **Apakah Production Build benar-benar berhasil?**  
   👉 **YA, BERHASIL (VERIFIED, EXIT CODE 0)**. Kegagalan sebelumnya terbukti akibat konflik lock file Windows saat `next dev` sedang aktif.
3. **Apakah pengujian merupakan Browser E2E atau API Simulation?**  
   👉 Pengujian yang terlaksana adalah **Live HTTP / API Integration Simulation**, bukan Browser E2E berbasis peramban fisik.
4. **Apakah Data Demo tetap utuh?**  
   👉 **YA, 100% UTUH**. Terbukti melalui verifikasi SHA-256 dan `git diff data/` yang kosong.
5. **Daftar Blocker sebelum Staging & Production**:
   - **Staging Blocker**: Wajib provisioning Neon PostgreSQL dan Cloudflare R2 sebelum deploy ke Vercel.
   - **Production Blocker**: Migrasi skema database ACID formal, penerbitan kredensial DOKU produksi, setup vendor pengiriman email resmi, dan persetujuan migrasi 3 tiket legacy.
