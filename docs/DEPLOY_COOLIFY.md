# Deploy Demo (branch `develop`) ke Coolify

Panduan singkat men-deploy branch `develop` ke VPS yang menjalankan Coolify.
Database tetap memakai Neon (PostgreSQL). Tidak ada nilai rahasia di dokumen ini.

## 1. Deploy key

1. Coolify → **Keys & Tokens → Private Keys → + Add → Generate new ED25519 SSH key**.
2. Salin **Public Key**-nya.
3. GitLab repo → **Settings → Repository → Deploy keys** → tambahkan key tersebut (read-only).

## 2. Aplikasi

- Resource: **Private Repository (with Deploy Key)**
- Repository: `git@gitlab.com:devdagoeng/dagoeng-management.git`
- Branch: `develop`
- Build pack: Nixpacks
- Port: `3000`

## 3. Environment variables

| Variable | Catatan |
|---|---|
| `DATABASE_URL` | URL Neon (direct) |
| `SESSION_SECRET` | wajib, minimal 32 karakter (`openssl rand -hex 32`) |
| `QRIS_WEBHOOK_SECRET` | string acak |
| `SUPERVISOR_OVERRIDE_PIN` | PIN demo |
| `ENABLE_ROLE_SIMULATOR` | `true` |
| `DOKU_SIMULATION_MODE` | `true` (tanpa kredensial DOKU) |
| `DOKU_API_URL` | `https://api-sandbox.doku.com` |
| `DOKU_NOTIFICATION_URL` | `/api/webhooks/doku` |
| `DOKU_CALLBACK_URL` | `https://<domain-demo>` |
| `NIXPACKS_NODE_VERSION` | `22` |

`nixpacks.toml` di root mengunci snapshot nixpkgs ke Node 22.20. Snapshot bawaan Nixpacks hanya punya Node 22.11, sedangkan Tailwind v4 butuh Node 22.12 ke atas (tanpa itu build gagal dengan `ERR_REQUIRE_ESM` di `next/font`). Jangan hapus file itu kecuali Nixpacks sudah memakai Node 22.12+ secara default.

Jangan set `NODE_ENV` dan `PORT` manual. Tabel sudah ada di Neon, jadi
`prisma db push` hanya perlu dijalankan kalau `prisma/schema.prisma` berubah.

## 4. Volume bukti pembayaran

Persistent Storage → volume dengan destination `/app/data/proofs`.
Jangan mount seluruh `/app/data`, karena menimpa file JSON seed dari repo.

## 5. Domain

DNS **A record** `<subdomain>` → IP VPS. Di Coolify isi Domains dengan
`https://<subdomain>.<domain>`. Port 80 dan 443 harus terbuka.

## 6. Auto-deploy saat merge ke `develop`

1. Coolify → aplikasi → **Webhooks → Manual Git Webhooks**: isi **GitLab Webhook Secret**, lalu **Save**.
2. GitLab → **Settings → Webhooks**: URL GitLab dari Coolify, Secret token yang sama,
   trigger **Push events**, branch filter (wildcard) `develop`.

Tombol **Test → Push events** di GitLab mengirim contoh dari branch `main`, jadi
Coolify membalas `Nothing to do`. Itu normal. Pembuktian yang valid adalah push
atau merge sungguhan ke `develop`.
