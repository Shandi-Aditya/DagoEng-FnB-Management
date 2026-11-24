# Standar Operasional Prosedur (SOP) Rilis dan Lingkungan Staging

Dokumen ini mengatur alur kerja rilis kode, pemisahan lingkungan server (Staging dan Produksi), pemisahan database, siklus rilis berkala setiap hari Senin, serta prosedur penanganan darurat (hotfix dan rollback) untuk tim pengembang DagoEng POS & Web Event.

---

## 1. Latar Belakang dan Tujuan

Sebelum Task S-31, seluruh pengujian lokal dan dev server langsung terhubung ke database Neon produksi. Akibatnya:
1. Penggabungan Merge Request (seperti MR !25 ke `develop` pada 20 Nov 2026) tidak otomatis muncul di produksi (`pos.veryyyy.com`) karena server produksi melacak branch `main` atau belum ada alur rilis terjadwal.
2. Pengujian fitur baru (seperti shift kasir, pemesanan tiket uji, atau mutasi stok) berisiko mengotori dan memutasi database produksi secara nyata.

Tujuan SOP ini adalah:
- Memastikan server produksi (`pos.veryyyy.com`) berjalan stabil dengan kode yang telah diverifikasi penuh.
- Menyediakan server staging (`staging.pos.veryyyy.com`) dengan database terpisah untuk pengujian QA harian.
- Menetapkan siklus rilis terprediksi setiap hari Senin pagi dengan pencatatan changelog resmi.
- Menjamin tersedianya prosedur rollback cepat jika terjadi kegagalan deployment.

---

## 2. Arsitektur Dua Lingkungan

| Parameter | Lingkungan Staging | Lingkungan Produksi |
| :--- | :--- | :--- |
| **URL Aplikasi** | `https://staging.pos.veryyyy.com` | `https://pos.veryyyy.com` |
| **Cabang Git** | `develop` | `main` |
| **Repositori Sumber** | `gitlab.com/devdagoeng/dagoeng-management.git` | `gitlab.com/devdagoeng/dagoeng-management.git` |
| **Database Neon** | Branch `staging` / DB `neondb` (terisolasi) | Branch `main` / DB `neondb` (produksi) |
| **Volume Bukti Bayar** | `/app/data/proofs` (volume staging) | `/app/data/proofs` (volume produksi) |
| **Tujuan Penggunaan** | Pengujian integrasi, UAT staf/Ka Ari/Izzy, verifikasi MR | Operasional nyata kasir outlet, transaksi pelanggan |
| **Role Simulator** | `ENABLE_ROLE_SIMULATOR=true` | Dikosongkan / `false` |
| **Login Akun Demo** | Diaktifkan untuk pengujian (`ALLOW_DEMO_UAT=true`) | `DISABLE_DEMO_LOGIN=true` (wajib ditutup) |

---

## 3. Alur Kerja Cabang Git (Git Flow)

> [!NOTE]
> **Catatan Konfigurasi Remote Git**:
> Perintah git pada dokumen ini menggunakan remote `origin` sebagai alias repositori resmi GitLab (`gitlab.com/devdagoeng/dagoeng-management.git`). Jika lingkungan lokal Anda menamai remote resmi sebagai `gitlab`, ganti `origin` dengan `gitlab` (contoh: `git push gitlab develop`). Periksa nama remote lokal Anda melalui perintah `git remote -v`.

```
[Fitur Baru: feat/* atau fix/*]
       │
       ▼ (Merge Request)
   [develop] ──────────► Auto-deploy ke Staging (staging.pos.veryyyy.com)
       │                 Database: Neon Staging
       │                 Uji QA oleh tim (Selasa - Jumat)
       ▼ (Rilis Mingguan setiap Senin)
    [main]   ──────────► Auto-deploy ke Produksi (pos.veryyyy.com)
                         Database: Neon Produksi
                         Tag rilis: v1.x.x
```

1. **Pengembangan Harian**:
   - Seluruh developer mencabangkan pekerjaan dari `develop` dengan format nama `feat/<nama-fitur>` atau `fix/<nama-bug>`.
   - Setelah pekerjaan selesai dan lulus pemeriksaan gerbang lokal (`npm run lint:ui`, `npm run type-check`, `npx tsc --noEmit -p tests/tsconfig.json`, `npm test`), buat Merge Request ke cabang `develop`.
2. **Penyatuan ke Staging**:
   - Merge Request yang disetujui digabungkan ke `develop`.
   - Webhook GitLab memicu build otomatis di Coolify Staging.
3. **Pengujian Staging**:
   - Pengujian dilakukan langsung di `https://staging.pos.veryyyy.com`.
   - Data uji tidak akan memengaruhi data transaksi di outlet nyata karena database terpisah sepenuhnya.

---

## 4. Siklus Rilis Mingguan Setiap Senin

Rilis ke server produksi dilakukan secara rutin setiap hari **Senin pukul 08.00 - 09.00 WITA** sebelum jam sibuk operasional outlet.

### Jadwal Aktivitas Mingguan:
- **Senin - Kamis**: Siklus pengembangan fitur dan perbaikan bug. Penggabungan MR ke `develop` dan pengujian di Staging.
- **Jumat sore (17.00 WITA)**: *Feature Freeze*. Tidak ada penggabungan MR baru ke `develop` kecuali perbaikan blocker rilis.
- **Jumat - Minggu**: Pengujian regresi menyeluruh di Staging.
- **Senin pagi (08.00 WITA)**: Eksekusi rilis ke `main`.

### Langkah Eksekusi Rilis Hari Senin:

1. **Verifikasi Kesiapan di Lokal**:
   - Pastikan cabang `develop` lokal mutakhir:
     ```bash
     git checkout develop
     git pull origin develop
     ```
   - Jalankan pemeriksaan 5 gerbang rilis secara berurutan:
     ```bash
     npm run lint:ui
     npm run type-check
     npx tsc --noEmit -p tests/tsconfig.json
     npm test
     npm run build
     ```
   > [!IMPORTANT]
   > **Catatan Toleransi Gerbang Uji**: Eksekusi `npm test` wajib meluluskan seluruh rangkaian uji dengan toleransi maksimal hanya pada 4 baseline kegagalan warisan yang tercatat pada `AGENTS.md` (`etl-data-validation`, `final-demo-readiness`, `organizer-activation-hardening`, `storage-sync-safety`). Jika terdapat kegagalan uji di luar keempat file tersebut, rilis **DITOLAK**.

2. **Pencadangan dan Migrasi Database**:
   - Masuk ke dasbor [Neon Console](https://console.neon.tech).
   - Buka menu **Branches**, lalu klik **Create branch** dari branch `main` dengan nama `backup-release-v1.x.x`. Fitur *instant branching* Neon menjamin salinan basis data siap dalam hitungan detik sebagai jaring pengaman *point-in-time*.
   - Jika terdapat perubahan pada `prisma/schema.prisma`, jalankan migrasi resmi:
     ```bash
     npm run prisma:deploy
     ```

3. **Pencatatan Changelog**:
   - Buka `CHANGELOG.md`.
   - Pindahkan entri dari seksi `[Unreleased]` ke blok versi baru (misal `## [1.1.0] - YYYY-MM-DD`) dan kelompokkan perubahan ke dalam bagian:
     - `Ditambahkan` (fitur baru)
     - `Diubah` (perubahan alur/UI)
     - `Diperbaiki` (perbaikan bug)
     - `Keamanan` (penutupan celah atau pembatasan akses)
   - Lakukan commit pembaruan changelog ke `develop`:
     ```bash
     git add CHANGELOG.md
     git commit -m "docs(release): prepare release notes v1.x.x"
     git push origin develop
     ```

4. **Penggabungan ke Cabang `main`**:
   - Buat Merge Request dari `develop` ke `main` di GitLab dengan judul `Release v1.x.x (Senin, DD Mon YYYY)`, atau gabungkan secara langsung jika memiliki otoritas rilis:
     ```bash
     git checkout main
     git pull origin main
     git merge develop --ff-only
     ```
     *(Catatan: Jika `main` dan `develop` memiliki riwayat terpisah, gunakan `git merge develop -m "Release v1.x.x"`)*.
   - Unggah hasil penggabungan ke remote:
     ```bash
     git push origin main
     ```

5. **Pemberian Tag Rilis**:
   - Berikan tag versi resmi:
     ```bash
     git tag -a v1.x.x -m "Release v1.x.x: <ringkasan rilis>"
     git push origin main --tags
     ```

6. **Verifikasi Deployment Produksi**:
   - Coolify akan mendeteksi push pada branch `main` dan menjalankan build Nixpacks.
   - Buka `https://pos.veryyyy.com` dan lakukan *smoke test*:
     - Halaman landing & katalog event dapat dimuat tanpa error.
     - Halaman login kasir/admin berfungsi normal.
     - Versi dan fitur baru yang tercantum di changelog tampil dengan benar.

---

## 5. Panduan Penyiapan Staging di Coolify dan Neon

Panduan teknis konfigurasi server, deploy key, dan persistent storage diatur lengkap pada [Dokumentasi Deploy Coolify](./DEPLOY_COOLIFY.md). Berikut ringkasan langkah khusus staging:

### 5.1 Buat Database Staging di Neon
1. Masuk ke dasbor [Neon Console](https://console.neon.tech).
2. Pilih proyek `dagoeng` aktif.
3. Buka menu **Branches**, lalu klik **Create branch**.
4. Beri nama branch: `staging`.
5. Salin connection string PostgreSQL branch staging (mode `direct`). Format:
   `postgresql://<user>:<password>@<ep-staging-id>.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`

### 5.2 Buat Aplikasi Staging di Coolify
1. Buka dasbor Coolify, pilih project atau server target.
2. Klik **+ Add Resource** -> **Private Repository (with Deploy Key)**.
3. Atur konfigurasi dasar:
   - **Repository**: `git@gitlab.com:devdagoeng/dagoeng-management.git`
   - **Branch**: `develop`
   - **Build pack**: `Nixpacks`
   - **Port**: `3000`
4. Masukkan Environment Variables khusus Staging sesuai tabel di [DEPLOY_COOLIFY.md](./DEPLOY_COOLIFY.md), dengan ketentuan khusus:
   - `DATABASE_URL`: *(Connection string Neon branch staging)*
   - `ENABLE_ROLE_SIMULATOR`: `true`
   - `DISABLE_DEMO_LOGIN`: *(Kosongkan agar persona demo dapat diuji tim UAT)*
   - `NEXT_PUBLIC_APP_URL`: `https://staging.pos.veryyyy.com`
5. Pasang Persistent Storage untuk bukti bayar:
   - Mount Destination: `/app/data/proofs`
6. Atur Domain:
   - Isi kolom Domains dengan: `https://staging.pos.veryyyy.com`
7. Pasang Webhook Auto-Deploy GitLab untuk branch `develop`.

---

## 6. Prosedur Hotfix Darurat di Luar Hari Senin

Jika ditemukan bug kritis di server produksi (`pos.veryyyy.com`) yang menghentikan transaksi operasional kasir atau event:

1. Buat branch hotfix langsung dari `main`:
   ```bash
   git checkout main
   git checkout -b hotfix/nama-bug-kritis
   ```
2. Terapkan perbaikan minimal yang berfokus langsung pada akar masalah (*root cause*) tanpa menambahkan refaktor atau dependensi baru di luar cakupan bug.
3. Jalankan verifikasi lengkap di lokal:
   ```bash
   npm run lint:ui
   npm run type-check
   npx tsc --noEmit -p tests/tsconfig.json
   npm test
   npm run build
   ```
4. Perbarui `CHANGELOG.md` dengan nomor versi patch (misal `## [1.0.1] - YYYY-MM-DD`).
5. Gabungkan hotfix ke `main` dan beri tag `v1.x.x-hotfix`:
   ```bash
   git checkout main
   git merge hotfix/nama-bug-kritis
   git push origin main
   git tag -a v1.0.1 -m "Hotfix v1.0.1: <ringkasan perbaikan>"
   git push origin main --tags
   ```
6. **Wajib sinkronkan balik ke `develop`** agar perbaikan tidak tertimpa pada rilis Senin berikutnya:
   ```bash
   git checkout develop
   git merge main
   git push origin develop
   ```

---

## 7. Prosedur Rollback Darurat Rilis Produksi

Apabila rilis Senin atau hotfix memicu galat runtime fatal di outlet operasional:

1. **Rollback Aplikasi Cepat via Dasbor Coolify (< 2 Menit)**:
   - Buka dasbor Coolify -> Pilih aplikasi **Produksi**.
   - Buka menu **Deployments**.
   - Cari baris deployment sukses terakhir sebelum rilis bermasalah.
   - Klik tombol **Redeploy** pada deployment tersebut. Container lama yang stabil akan langsung dipulihkan tanpa menunggu commit git baru.
2. **Rollback Kode pada Cabang `main`**:
   - Jika perbaikan membutuhkan waktu analisis, revert commit rilis di cabang `main`:
     ```bash
     git checkout main
     git pull origin main
     git revert -m 1 HEAD
     git commit -m "revert(release): rollback to previous stable release due to <alasan-insiden>"
     git push origin main
     ```
3. **Rollback Skema Database Neon**:
   - Jika kegagalan disebabkan oleh migrasi skema destruktif, buka [Neon Console](https://console.neon.tech).
   - Pilih branch `main`, lakukan *restore* atau alihkan koneksi ke branch snapshot `backup-release-v1.x.x` yang telah dibuat pada Langkah 4.2.
