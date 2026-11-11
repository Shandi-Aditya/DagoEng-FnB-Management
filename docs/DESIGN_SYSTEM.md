# DagoEng Design System

Sumber kebenaran untuk tampilan aplikasi. Dibangun di atas **shadcn/ui** dengan preset dari [shadcn/create](https://ui.shadcn.com/create), mengikuti hasil [UNSLOP_AUDIT.md](./UNSLOP_AUDIT.md) dan langkah di [SHADCN_UI_IMPLEMENTATION_PLAN.md](./SHADCN_UI_IMPLEMENTATION_PLAN.md).

- Status: **Fase 1 selesai**. Preset terpasang (`components.json`, token di `src/app/globals.css`). Komponen shadcn dipasang mulai Fase 2.
- Diputuskan: 11 November 2026

---

## 1. Preset

```bash
npx shadcn@latest init --preset b1ZzrZdR2 --template next
```

Pratinjau: [ui.shadcn.com/create?preset=b1ZzrZdR2](https://ui.shadcn.com/create?preset=b1ZzrZdR2)

| Pengaturan | Nilai | Arti |
| --- | --- | --- |
| Style | **Mira** | Padat, dibuat untuk antarmuka yang rapat seperti kasir, KDS, dan tabel admin |
| Base color | **Neutral** | Abu murni untuk latar, kartu, garis, dan teks. Chrome tidak berwarna |
| Theme | **Blue** (sementara) | Mengisi `primary`. Bisa diganti kapan saja (lihat bagian 3) |
| Chart color | **Blue** | Palet `chart-1` … `chart-5` |
| Icon library | **Lucide** | Sama dengan yang sudah dipakai di kode |
| Font | **DM Sans** | Sama dengan font sekarang |
| Font heading | Inherit (DM Sans) | Satu keluarga font |
| Radius | Default (bawaan Mira) | Skala `radius-sm` … `radius-4xl` diturunkan dari `--radius` |
| Menu | Default / Solid | Menu solid, tanpa efek kaca |
| Menu accent | Subtle | Item menu aktif ditandai permukaan netral, bukan warna |
| Base (library) | Base UI (default CLI) | Tambahkan `-b radix` kalau ingin Radix |

Catatan pemasangan:

- Jalankan di root repo **setelah** upgrade ke Tailwind v4 (Fase 1, langkah 2).
- Di proyek yang sudah ada, Next.js terdeteksi otomatis. `--template` hanya berpengaruh saat membuat proyek baru dengan `--name`.
- Cek hasilnya dulu dengan `--dry-run`.
- Untuk melihat isi preset kapan saja:

```bash
npx shadcn@latest preset decode b1ZzrZdR2
```

---

## 2. Aturan pemakaian warna

Ikuti konvensi token shadcn. **Kode fitur hanya boleh memakai token**, tidak boleh hex, `slate-*`, `blue-*`, atau `dark:` untuk warna.

| Token | Dipakai untuk | Jangan dipakai untuk |
| --- | --- | --- |
| `background` / `foreground` | Latar halaman, teks utama | |
| `card` / `card-foreground` | Kartu dan panel | |
| `popover` / `popover-foreground` | Menu, popover, select, dialog | |
| `primary` / `primary-foreground` | **Satu** aksi utama per area, item terpilih, satu angka kunci | Latar section, ikon dekoratif, judul, banyak tombol sekaligus |
| `secondary` / `secondary-foreground` | Tombol sekunder berisi | |
| `muted` / `muted-foreground` | Teks sekunder, deskripsi, placeholder, permukaan halus | |
| `accent` / `accent-foreground` | Hover, fokus, dan item aktif di menu/tabel (netral) | Warna brand |
| `destructive` | Hapus, batal transaksi, error | |
| `border` / `input` / `ring` | Garis, border kontrol, cincin fokus | |
| `chart-1` … `chart-5` | Seri grafik | UI di luar grafik |
| `sidebar-*` | Komponen `Sidebar` | |

Aturan tambahan dari audit:

- Satu grafik punya satu seri utama berwarna. Seri lain memakai abu (`muted-foreground`) atau garis putus-putus.
- Tidak ada gradien, glow, blob blur, `backdrop-blur`, atau bayangan berwarna.
- Kedalaman (depth) dibentuk dari `card` di atas `background` dan garis `border`. Bayangan hanya `shadow-xs`/`shadow-sm` netral.

### Kontras tema (dihitung dari nilai OKLCH shadcn)

| Tema | `primary` terang | Kontras teks | `primary` gelap | Kontras teks |
| --- | --- | ---: | --- | ---: |
| **Blue (terpilih)** | `#1447E6` | 6,26 | `#193CB8` | 8,11 |
| Emerald (paling dekat sage `#3B7A57`) | `#007A55` | 5,09 | `#006045` | 7,19 |
| Green | `#008236` | 4,72 | `#016630` | 6,78 |
| Teal | `#00786F` | 5,17 | `#005F5A` | 7,23 |
| Orange (versi aman dari oranye logo) | `#CA3500` | 4,93 | `#9F2D00` | 6,93 |

Semua lolos WCAG AA (minimal 4,5:1). Oranye logo asli `#FF6B00` **tidak** lolos untuk teks putih, jadi tidak dipakai sebagai `primary`.

---

## 3. Mengganti warna tema nanti

Tema bisa diganti tanpa mengubah komponen:

1. Buka [shadcn/create](https://ui.shadcn.com/create?preset=b1ZzrZdR2), ganti **Theme** (dan **Chart Color** kalau perlu), lalu salin kode preset baru.
2. Terapkan hanya bagian warnanya:

```bash
npx shadcn@latest apply --preset <kode-baru> --only theme
```

3. Perbarui tabel di bagian 1 dan kontras di bagian 2.

Karena kode fitur hanya memakai token, mengganti tema tidak butuh perubahan di file halaman. Kalau ada yang ikut berubah selain token di `globals.css`, berarti ada warna mentah yang lolos dan harus diperbaiki.

---

## 4. Token tambahan (di luar shadcn)

Ditambahkan di `globals.css` dengan pola resmi shadcn (`:root`, `.dark`, lalu `@theme inline`). Nilai final ditetapkan di Fase 1 dan harus lolos kontras 4,5:1 dengan pasangan `-foreground`-nya.

| Token | Kegunaan |
| --- | --- |
| `success` / `success-foreground` | Pembayaran lunas, stok aman, check-in berhasil |
| `warning` / `warning-foreground` | Stok menipis, menunggu verifikasi |
| `info` / `info-foreground` | Informasi netral, status draft |
| `unit-fnb`, `unit-coworking`, `unit-event`, `unit-loyalty` | Penanda unit bisnis dari empat warna logo |

### Warna logo sebagai penanda unit bisnis

Logo "dago" (`public/logo-dagoeng.svg`, `public/logo-dago.png`) terdiri dari empat huruf berwarna. Warna ini **bukan** `primary` dan hanya dipakai sebagai titik kecil (`UnitDot`), legenda grafik per unit, dan badge unit.

| Huruf | Warna | Unit (usulan, perlu konfirmasi) |
| --- | --- | --- |
| d | `#FF6B00` oranye | F&B |
| a | `#00B2FE` cyan | Co-working |
| g | `#00C853` hijau | Event komunitas |
| o | `#FFB300` kuning | Loyalty |

Karena warna ini terang, teks tidak boleh ditaruh di atasnya. Titik penanda cukup berukuran 8px di samping label.

---

## 5. Tipografi

- Satu keluarga: **DM Sans** untuk semua teks. Angka di tabel, struk, dan kode memakai `font-mono` (DM Mono, atau mono bawaan preset) dengan `tabular-nums`.
- Bobot hanya 400, 500, dan 600. Tidak ada `font-bold` untuk judul, `font-black`, `font-extrabold`, atau italic.
- Hierarki dibangun dari ukuran dan warna (`foreground` dan `muted-foreground`), bukan dari ketebalan.
- Semua teks memakai huruf kalimat (sentence case). Tidak ada label `UPPERCASE` dengan tracking lebar.
- Tidak ada tracking negatif pada teks di bawah 40px.

| Peran | Kelas Tailwind | Bobot |
| --- | --- | --- |
| Meta, hitungan, keterangan kecil | `text-xs` (12px) | 400 |
| Teks sekunder, isi tabel | `text-sm` (14px) | 400 |
| Isi, item navigasi | `text-sm`/`text-base` | 400–500 |
| Judul kartu | `text-sm`/`text-base` | 500 |
| Judul halaman | `text-2xl` (24px) | 500–600 |
| Angka KPI | `text-2xl`/`text-3xl` + `tabular-nums` | 500 |
| Judul hero landing | `text-5xl`–`text-6xl` | 500 |

Ukuran minimum 12px. Ukuran `text-[9px]`/`text-[10px]` tidak dipakai lagi.

---

## 6. Spacing, radius, ikon, motion

- **Spacing**: skala Tailwind dengan kelipatan 4px (`1`, `2`, `3`, `4`, `5`, `6`, `8`, `10`, `12`, `16`). Tidak ada nilai acak seperti `p-[13px]`.
- **Radius**: pakai token (`rounded-md`, `rounded-lg`, `rounded-xl`) yang diturunkan dari `--radius` preset. Radius bagian dalam sama dengan radius luar dikurangi padding. Pill (`rounded-full`) hanya untuk badge status dan avatar.
- **Ikon**: lucide, `size-4` (16px), warna `muted-foreground` atau mengikuti teks. Tidak ada emoji di antarmuka.
- **Motion**: transisi spesifik (`transition-colors`, `transition-[opacity,transform]`). Tidak ada `transition-all`, `hover:scale`, efek melayang, atau carousel otomatis. `animate-pulse` hanya untuk status yang benar-benar live, misalnya pesanan baru di KDS.

---

## 7. Komponen

Semua komponen dasar berasal dari registry shadcn (`src/components/ui/*`) dan **tidak disunting manual**. Komponen khusus aplikasi dirangkai di `src/components/app/*`:

| Komponen app | Disusun dari |
| --- | --- |
| `PageHeader` | Judul, deskripsi, dan slot aksi |
| `StatCard` | `Card`: label, angka, perubahan + pembanding |
| `SectionHeader` | Judul + deskripsi section |
| `UnitDot` | Titik warna `unit-*` |
| `StatusBadge` | `Badge` + token status |
| `EmptyState` | `Empty` |
| `ConfirmDialog` | `AlertDialog` |
| `notify()` | `toast` (Base UI) |

Daftar lengkap pemetaan komponen lama ke shadcn ada di bagian Fase 2 [rencana implementasi](./SHADCN_UI_IMPLEMENTATION_PLAN.md).

---

## 8. Copy

- Bahasa Indonesia konsisten di satu layar, termasuk tombol (`Lihat menu`, bukan `Explore F&B`).
- Tidak ada salam pembuka sebagai judul, tanda seru, atau titik di label dan tombol.
- Persentase selalu menyebut pembandingnya (`+12% vs bulan lalu`).
- Format Rupiah konsisten (`Rp 432.200`) dengan `tabular-nums`.

---

## 9. Yang belum diputuskan

- [ ] Warna tema final (sekarang Blue, kandidat pengganti: Emerald untuk hijau yang dekat dengan sage)
- [ ] Pemetaan empat warna logo ke unit bisnis
- [ ] Nilai OKLCH final untuk `success`, `warning`, `info`, dan `unit-*`
- [ ] Mode default: terang, gelap, atau ikut sistem
- [ ] Nama produk resmi: "DagoEng", "DAGO Creative Hub", atau "DagoEng Creative Hub"
