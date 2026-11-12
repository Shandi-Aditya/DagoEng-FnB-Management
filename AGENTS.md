# Instruksi untuk semua agent di repo ini

Berlaku untuk agent apa pun (Claude Code, Gemini CLI, Codex, Cursor, dll.) dan model apa pun. `CLAUDE.md` dan `GEMINI.md` hanya meng-import file ini; ubah aturan **di sini saja**.

Repo ini sedang menjalani redesign UI (shadcn + unslop) di branch `feat/shadcn-foundation`. Sebelum menyentuh kode, baca **berurutan dan sampai habis**:

1. [docs/REDESIGN_HANDOFF.md](docs/REDESIGN_HANDOFF.md): status, tracker per halaman, aturan, keamanan data, Definition of Done (bagian 5a).
2. [docs/REDESIGN_PLAYBOOK.md](docs/REDESIGN_PLAYBOOK.md): langkah 0–10 untuk me-redesign satu halaman. **Ikuti persis.**
3. [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) bagian 7 (komponen) dan 8 (copy, glosarium, toast).

Baca [docs/REDESIGN_REVIEW_GEMINI.md](docs/REDESIGN_REVIEW_GEMINI.md) sekali untuk tahu kesalahan yang pernah terjadi dan rencana P0–P4.

## Aturan keras

- Satu halaman per sesi. Status `selesai` hanya kalau seluruh Definition of Done terpenuhi.
- Sebelum coding, tulis ke user: hasil pemetaan, kalimat tugas utama layar, dan daftar keputusan desain (playbook langkah 1–2). Mengganti tag ke shadcn tanpa mengubah tata letak **bukan** redesign.
- Jangan edit `src/components/ui/*` (kecuali `ui/button.tsx`). Jangan import `components/legacy` di kode baru.
- Jangan menekan aksi yang menulis data di browser. Dev lokal menulis ke database Neon produksi.
- Jangan mematikan dev server yang tidak kamu jalankan.
- Jangan menghapus atau melemahkan test. Test yang membaca file sumber mengunci aturan bisnis; pindahkan string-nya ke file baru.
- Jangan commit kecuali user meminta. Tanpa `Co-Authored-By` atau atribusi AI. Stage file satu per satu; jangan pernah stage `data/*`, `.audit/`, `*.xlsx`, `docs/KLARIFIKASI_SETTLEMENT_MITRA.md`, `panduan.md`, `.claude/`.
- Jangan posting komentar ke PR/issue dan jangan men-tag orang.
- Kalau sesuatu tidak bisa diverifikasi (build, test, browser), katakan apa yang tidak diverifikasi. Jangan menyatakan selesai tanpa bukti angka.

## Kalau harness tidak punya alat tertentu

- **Tidak ada alat browser** (mis. Claude Code di terminal): jalankan semua pemeriksaan statis, lalu minta user melakukan cek visual sesuai playbook langkah 7 dengan daftar yang kamu tulis. Di laporan tulis jelas "cek visual belum dilakukan oleh agent".
- **Hook menolak `Write`/`Edit`** (mis. "Fact-Forcing Gate"): penuhi fakta yang diminta (siapa yang memakai file, bukti tidak ada file sejenis, kutip instruksi user), lalu ulangi operasi yang sama. Jangan mengakali hook lewat cara lain.
- **Perintah ditolak oleh izin**: jangan mencari jalan memutar. Laporkan ke user.

## Perintah verifikasi

```bash
npm run lint:ui -- <file yang disentuh>
```
```bash
npx tsc --noEmit -p .
```
```bash
npx vitest run
```
```bash
npm run build
```

Baseline: hanya 4 test yang boleh gagal (`etl-data-validation`, `final-demo-readiness`, `organizer-activation-hardening`, `storage-sync-safety`).

## Laporan akhir setiap sesi

Tugas layar, keputusan utama (minimal satu yang berbeda dari layout lama), angka lint/tsc/test/build, apa yang dicek di browser (gelap, terang, mobile 375px), temuan yang tidak dikerjakan, dan baris tracker yang diperbarui.
