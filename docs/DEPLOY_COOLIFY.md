# Cara deploy aplikasi ke Coolify

Panduan ini menjelaskan langkah men-deploy branch `develop` ke VPS dengan Coolify dan database Neon PostgreSQL. Dokumen ini tidak memuat nilai rahasia.

## 1. Pasang deploy key GitLab

1. Buka Coolify, lalu pilih **Keys & Tokens**, **Private Keys**, **+ Add**, dan **Generate new ED25519 SSH key**.
2. Salin nilai **Public Key** yang dibuat Coolify.
3. Buka repositori GitLab, pilih **Settings**, **Repository**, lalu **Deploy keys**, dan tambahkan kunci tersebut dalam mode baca saja (`read-only`).

## 2. Buat aplikasi di Coolify

Atur konfigurasi sumber aplikasi sebagai berikut:

- **Resource.** Pilih **Private Repository (with Deploy Key)**.
- **Repository.** Isi `git@gitlab.com:devdagoeng/dagoeng-management.git`.
- **Branch.** Isi `develop`.
- **Build pack.** Pilih `Nixpacks`.
- **Port.** Isi `3000`.

Berkas `nixpacks.toml` di akar repositori mengunci snapshot `nixpkgs` ke Node `22.20.0`. Snapshot bawaan Nixpacks hanya menyediakan Node `22.11.0`, sedangkan Tailwind CSS v4 memerlukan Node `22.12` ke atas agar kompilasi `next/font` tidak gagal dengan galat `ERR_REQUIRE_ESM`. Pertahankan berkas `nixpacks.toml` tersebut.

## 3. Isi environment variables

Masukkan variabel lingkungan berikut pada menu **Environment Variables** di Coolify:

| Variabel | Status | Keterangan |
|---|---|---|
| `DATABASE_URL` | Wajib | String koneksi PostgreSQL Neon langsung (`direct`). |
| `SESSION_SECRET` | Wajib | Kunci HMAC sesi minimal 32 karakter, misalnya hasil `openssl rand -hex 32`. |
| `QRIS_WEBHOOK_SECRET` | Wajib | Kunci rahasia verifikasi HMAC-SHA256 untuk `/api/pos/qris/verify`. |
| `SUPERVISOR_OVERRIDE_PIN` | Wajib | PIN supervisor untuk verifikasi manual QRIS statis, void, dan refund kasir. |
| `NIXPACKS_NODE_VERSION` | Wajib | Isi `22`. |
| `ENABLE_ROLE_SIMULATOR` | Opsional (UAT) | Isi `true` pada server demo UAT, atau kosongkan di produksi publik. |
| `DISABLE_DEMO_LOGIN` | Wajib saat rilis publik | `next.config.js` mengaktifkan `ALLOW_DEMO_UAT='true'` untuk UAT. Isi `DISABLE_DEMO_LOGIN=true` saat rilis publik agar seluruh login akun demo dimatikan. |
| `FONNTE_API_TOKEN` | Opsional (Chatbot V-17) | Token API Fonnte untuk pengiriman ringkasan tutup shift via WhatsApp. |
| `KA_ARI_WHATSAPP_PHONE` | Opsional (Chatbot V-17) | Nomor WhatsApp tujuan laporan tutup shift Front Office untuk Ka Ari. |
| `FONNTE_TARGET_PHONE` | Opsional (Chatbot V-17) | Nomor WhatsApp cadangan apabila `KA_ARI_WHATSAPP_PHONE` tidak diisi. |
| `TELEGRAM_BOT_TOKEN` | Opsional (Chatbot V-17) | Token Bot Telegram untuk pengiriman ringkasan tutup shift otomatis. |
| `TELEGRAM_KA_ARI_CHAT_ID` | Opsional (Chatbot V-17) | Chat ID Telegram Ka Ari untuk ringkasan tutup shift gabungan. |
| `TELEGRAM_PARTNER_<TENANT_ID>_CHAT_ID` | Opsional (Chatbot V-17) | Chat ID Telegram per mitra, misalnya `TELEGRAM_PARTNER_TENANT_KS_CHAT_ID`. |
| `DOKU_CLIENT_ID` | Opsional (Web Event) | Client ID live DOKU untuk pembayaran otomatis tiket event. |
| `DOKU_SECRET_KEY` | Opsional (Web Event) | Secret Key live DOKU. |
| `DOKU_API_URL` | Opsional (Web Event) | Gunakan `https://api.doku.com` saat kredensial live tersedia. |
| `DOKU_NOTIFICATION_URL` | Opsional (Web Event) | Isi `/api/webhooks/doku`. |
| `DOKU_CALLBACK_URL` | Opsional (Web Event) | Isi `https://<domain-aplikasi>`. |
| `NEXT_PUBLIC_APP_URL` | Opsional | URL publik aplikasi untuk tautan tiket event, misalnya `https://<domain-aplikasi>`. |
| `NEXT_PUBLIC_CS_WHATSAPP` | Opsional | Nomor WhatsApp layanan pelanggan resmi pada halaman pemulihan tiket. |

Jangan menyetel `NODE_ENV` atau `PORT` secara manual di Coolify. Karena `next start` berjalan dengan `NODE_ENV=production`, modul `src/lib/doku.ts` secara otomatis menolak `DOKU_SIMULATION_MODE=true` dan URL sandbox DOKU demi keamanan produksi. Selama kredensial live `https://api.doku.com` belum dipasang, pemesanan tiket event berbayar di Coolify menggunakan metode transfer bank manual dengan unggah bukti bayar.

Skema tabel sudah tersedia di Neon. Jalankan `npx prisma db push` hanya ketika `prisma/schema.prisma` berubah.

## 4. Pasang volume bukti pembayaran

Buka menu **Persistent Storage**, lalu tambahkan volume dengan tujuan `/app/data/proofs`. Jangan me-mount seluruh direktori `/app/data`, sebab mount tersebut akan menutupi berkas JSON data awal dari repositori.

## 5. Hubungkan domain dan HTTPS

Arahkan **A record** DNS `<subdomain>` ke alamat IP VPS. Pada pengaturan aplikasi Coolify, isi kolom **Domains** dengan `https://<subdomain>.<domain>`, dan pastikan port `80` serta `443` terbuka pada firewall server.

## 6. Aktifkan auto-deploy saat merge ke `develop`

1. Di Coolify, buka aplikasi, pilih **Webhooks**, lalu **Manual Git Webhooks**, isi **GitLab Webhook Secret**, dan klik **Save**.
2. Di GitLab, buka **Settings**, lalu **Webhooks**, masukkan URL GitLab dari Coolify beserta token rahasia yang sama, centang **Push events**, dan isi filter branch dengan `develop`.

Tombol **Test** untuk **Push events** di GitLab mengirim contoh payload dari branch `main`, sehingga Coolify membalas `Nothing to do`. Untuk menguji auto-deploy secara nyata, lakukan push atau merge langsung ke branch `develop`.
