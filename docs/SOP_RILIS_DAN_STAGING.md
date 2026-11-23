# Standar Operasional Prosedur (SOP) Rilis dan Lingkungan Staging

Dokumen ini mengatur alur kerja rilis kode, pemisahan lingkungan server (Staging dan Produksi), pemisahan database, serta siklus rilis berkala setiap hari Senin untuk tim pengembang DagoEng POS & Web Event.

---

## 1. Latar Belakang dan Tujuan

Sebelum Task S-31, seluruh pengujian lokal dan dev server langsung terhubung ke database Neon produksi. Akibatnya:
1. Penggabungan Merge Request (seperti MR !25 ke `develop` pada 20 Nov 2026) tidak otomatis muncul di produksi (`pos.veryyyy.com`) karena server produksi melacak branch `main` atau belum ada alur rilis terjadwal.
2. Pengujian fitur baru (seperti shift kasir, pemesanan tiket uji, atau mutasi stok) berisiko mengotori dan memutasi database produksi secara nyata.

Tujuan SOP ini adalah:
- Memastikan server produksi (`pos.veryyyy.com`) berjalan stabil dengan kode yang telah diverifikasi penuh.
- Menyediakan server staging (`staging.pos.veryyyy.com`) dengan database terpisah untuk pengujian QA harian.
- Menetapkan siklus rilis terprediksi setiap hari Senin pagi dengan pencatatan changelog resmi.

---

## 2. Arsitektur Dua Lingkungan

| Parameter | Lingkungan Staging | Lingkungan Produksi |
| :--- | :--- | :--- |
| **URL Aplikasi** | `https://staging.pos.veryyyy.com` | `https://pos.veryyyy.com` |
| **Cabang Git** | `develop` | `main` |
| **Repositori Sumber** | `gitlab.com/devdagoeng/dagoeng-management.git` | `gitlab.com/devdagoeng/dagoeng-management.git` |
| **Database Neon** | Branch `staging` / DB `dagoeng_staging` | Branch `main` / DB `neondb` (produksi) |
| **Volume Bukti Bayar** | `/app/data/proofs` (volume staging) | `/app/data/proofs` (volume produksi) |
| **Tujuan Penggunaan** | Pengujian integrasi, UAT staf/Ka Ari/Izzy, verifikasi MR | Operasional nyata kasir outlet, transaksi pelanggan |
| **Role Simulator** | `ENABLE_ROLE_SIMULATOR=true` | Dikosongkan / `false` |
| **Login Akun Demo** | Diaktifkan untuk pengujian (`ALLOW_DEMO_UAT=true`) | `DISABLE_DEMO_LOGIN=true` |

---

## 3. Alur Kerja Cabang Git (Git Flow)

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
   - Seluruh developer (Shandy, Very) mencabangkan pekerjaan dari `develop` dengan format nama `feat/<nama-fitur>` atau `fix/<nama-bug>`.
   - Setelah pekerjaan selesai dan lulus pemeriksaan statis (`lint:ui`, `type-check`, `vitest`), buat Merge Request ke cabang `develop`.
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
     git pull gitlab develop
     ```
   - Jalankan pemeriksaan gerbang rilis:
     ```bash
     npm run type-check
     npm test
     npm run build
     ```
2. **Pencatatan Changelog**:
   - Buka `CHANGELOG.md`.
   - Tambahkan entri versi baru (misal `[1.1.0] - YYYY-MM-DD`) dan kelompokkan perubahan ke dalam bagian:
     - `Ditambahkan` (fitur baru)
     - `Diubah` (perubahan alur/UI)
     - `Keamanan` (penutupan celah atau pembatasan akses)
     - `Diperbaiki` (perbaikan bug)
   - Lakukan commit pembaruan changelog ke `develop`:
     ```bash
     git add CHANGELOG.md
     git commit -m "docs(release): prepare release notes v1.x.x"
     git push gitlab develop
     ```
3. **Penggabungan ke Cabang `main`**:
   - Buat Merge Request dari `develop` ke `main` di GitLab dengan judul `Release v1.x.x (Senin, DD Mon YYYY)`, atau gabungkan secara langsung jika memiliki otoritas rilis:
     ```bash
     git checkout main
     git pull gitlab main
     git merge develop --ff-only
     ```
     *(Catatan: Jika `main` dan `develop` memiliki riwayat terpisah, gunakan `git merge develop -m "Release v1.x.x"`)*.
4. **Pemberian Tag Rilis**:
   - Berikan tag versi resmi:
     ```bash
     git tag -a v1.x.x -m "Release v1.x.x: <ringkasan rilis>"
     git push gitlab main --tags
     ```
5. **Verifikasi Deployment Produksi**:
   - Coolify akan mendeteksi push pada branch `main` dan menjalankan build Nixpacks.
   - Buka `https://pos.veryyyy.com` dan lakukan *smoke test*:
     - Halaman landing & katalog event dapat dimuat tanpa error.
     - Halaman login kasir/admin berfungsi normal.
     - Versi dan fitur baru yang tercantum di changelog tampil dengan benar.

---

## 5. Panduan Penyiapan Staging di Coolify dan Neon

Bagi administrator sistem atau lead developer (Ka Ari / Shandy), berikut langkah membuat instance Staging:

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
4. Masukkan Environment Variables khusus Staging:
   - `DATABASE_URL`: *(Connection string Neon branch staging)*
   - `SESSION_SECRET`: *(Kunci acak 32 karakter khusus staging)*
   - `QRIS_WEBHOOK_SECRET`: *(Kunci webhook simulasi)*
   - `SUPERVISOR_OVERRIDE_PIN`: `123456` *(atau PIN staging yang disepakati)*
   - `NIXPACKS_NODE_VERSION`: `22`
   - `ENABLE_ROLE_SIMULATOR`: `true`
   - `NEXT_PUBLIC_APP_URL`: `https://staging.pos.veryyyy.com`
5. Pasang Persistent Storage untuk bukti bayar:
   - Mount Destination: `/app/data/proofs`
6. Atur Domain:
   - Isi kolom Domains dengan: `https://staging.pos.veryyyy.com`
7. Pasang Webhook Auto-Deploy GitLab:
   - Buka **Webhooks** di Coolify, salin Webhook URL dan Secret.
   - Di GitLab, buka **Settings** -> **Webhooks**, pasang URL tersebut, centang **Push events**, dan kunci ke branch `develop`.

---

## 6. Prosedur Hotfix Darurat di Luar Hari Senin

Jika ditemukan bug kritis di server produksi (`pos.veryyyy.com`) yang menghentikan transaksi operasional:
1. Buat branch hotfix langsung dari `main`:
   ```bash
   git checkout main
   git checkout -b hotfix/nama-bug-kritis
   ```
2. Terapkan perbaikan seminimal mungkin sesuai prinsip **Laziness Protocol**.
3. Verifikasi dengan unit test lokal.
4. Gabungkan hotfix ke `main` dan beri tag `v1.x.x-hotfix`:
   ```bash
   git checkout main
   git merge hotfix/nama-bug-kritis
   git push gitlab main
   ```
5. **Wajib sinkronkan balik ke `develop`** agar perbaikan tidak hilang pada rilis Senin berikutnya:
   ```bash
   git checkout develop
   git merge main
   git push gitlab develop
   ```
