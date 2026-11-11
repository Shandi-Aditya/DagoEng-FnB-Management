# Implementation Plan — Perbaikan UI dengan shadcn/ui Resmi

- Dasar: [UNSLOP_AUDIT.md](./UNSLOP_AUDIT.md), metode unslop oleh Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), CC BY 4.0
- Target: seluruh UI memakai komponen resmi [shadcn/ui](https://ui.shadcn.com). Warna mengikuti konvensi token shadcn: base netral, satu warna tema sebagai `primary`, dan semua diatur dari [shadcn/create](https://ui.shadcn.com/create) lewat preset.
- Status: **rencana**. Belum ada kode yang diubah. Langkah berikutnya adalah menentukan design system (Fase 0).
- Referensi dicek: dokumentasi shadcn per November 2026 (CLI v4.23, Base UI 1.9, Tailwind 4.3).

---

## 1. Prinsip

Gabungan aturan shadcn dan unslop yang dipegang di setiap fase:

1. **Token, bukan warna mentah.** Komponen hanya memakai token semantik (`bg-background`, `bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`, dll.). Tidak boleh ada `bg-[#3B7A57]`, `text-slate-500`, atau `dark:bg-…` di kode fitur. Mode gelap cukup mengganti nilai variabel di `.dark`.
2. **Satu sumber kebenaran.** Nilai warna, radius, dan font berasal dari satu preset shadcn/create. Mengganti tampilan cukup dengan `shadcn apply --preset <kode>`, bukan mengedit puluhan file.
3. **Komponen shadcn dipakai apa adanya.** Kustomisasi lewat token, `variant`, dan `size`. Kalau benar-benar butuh, bungkus di `src/components/app/*`. File di `src/components/ui/*` jangan disunting manual, supaya `shadcn add --diff` tetap bisa memperbarui.
4. **Netral di chrome, warna di konten.** Sesuai unslop, `primary` hanya untuk aksi utama, item terpilih, dan satu angka kunci. Warna lain hanya untuk grafik dan penanda unit bisnis.
5. **Tidak ada `!important`.** Override `globals.css` yang sekarang dihapus bertahap sampai habis.
6. **Unslop sebagai checklist.** Setiap halaman yang dimigrasi juga melewati sembilan pass: spacing, warna, ikon, copy, tipe, layout, detail, visual, motion.

### Cara shadcn memakai warna (penting dipahami tim)

| Token | Arti di shadcn | Catatan untuk proyek ini |
| --- | --- | --- |
| `background` / `foreground` | Latar halaman dan teks utama | Netral dari base color |
| `card` / `card-foreground` | Permukaan yang terangkat | Kartu, panel |
| `popover` / `popover-foreground` | Permukaan melayang | Menu, popover, select |
| `primary` / `primary-foreground` | **Warna tema.** Aksi utama, item terpilih, badge aktif | Satu-satunya warna brand di chrome |
| `secondary` | Aksi sekunder berisi | Netral |
| `muted` / `muted-foreground` | Permukaan halus dan teks sekunder | Deskripsi, placeholder, empty state |
| `accent` / `accent-foreground` | **Permukaan hover, fokus, dan aktif yang netral** | **Bukan warna brand.** Sekarang di proyek `--accent` diisi hijau, dan itu salah kaprah |
| `destructive` | Aksi berbahaya dan error | |
| `border`, `input`, `ring` | Garis, border input, cincin fokus | |
| `chart-1` … `chart-5` | Palet grafik | Diatur `chartColor` di create |
| `sidebar-*` | Turunan khusus sidebar | |
| `radius` | Radius dasar | Skala `radius-sm` … `radius-4xl` diturunkan otomatis |

Token tambahan yang **bukan** bawaan shadcn ditambahkan dengan pola resmi (`:root`, `.dark`, lalu `@theme inline`):

- `success`, `warning`, `info` (+ `-foreground`) untuk status
- `unit-fnb`, `unit-coworking`, `unit-event`, `unit-loyalty` sebagai ciri khas empat warna logo. Hanya untuk titik penanda unit, legenda, dan badge unit.

---

## 2. Kondisi sekarang

| Hal | Sekarang | Yang dibutuhkan shadcn/create |
| --- | --- | --- |
| shadcn | Belum di-init (tidak ada `components.json`). Ada 10 komponen buatan sendiri bergaya shadcn lama di `src/components/ui` | `components.json` + komponen dari registry |
| Primitive | Tidak ada (tanpa Radix maupun Base UI) | Base UI (default sejak Juli 2026), Radix, atau React Aria |
| Tailwind | 3.4 + `tailwind.config.ts` + `tailwindcss-animate` | **Tailwind v4** + `@theme inline` + `tw-animate-css`. Preset dan style baru dari create menghasilkan CSS v4 dengan warna OKLCH |
| Warna | HSL di `globals.css`, hex hardcode, ±300 baris override `!important` | OKLCH di `:root`/`.dark` |
| Next / React | Next 14.2, React 18.3 | Tailwind v4 dan Base UI mendukung React 18. Upgrade ke Next 15/React 19 **tidak wajib** untuk rencana ini |
| `cn` | `clsx` + `tailwind-merge` | Paket `cn` (sejak September 2026, ada perintah `shadcn migrate cn`) |
| Ikon | lucide-react 0.460 | lucide bisa dipilih di create, tetap dipakai |
| Grafik | recharts 2.13 | Komponen `chart` shadcn (berbasis recharts). Versi recharts dicek dengan `add chart --dry-run` |
| Pola UI buatan sendiri | 21 file `*Modal.tsx`, overlay `fixed inset-0` di 45 file, 97 `<select>` native, 34 input tanggal/jam native, 112 pemanggilan toast buatan, ±122 tooltip `title=`, 394 `<button>` native, 56 `<table>` native | Dialog, Sheet, Select, Date Picker, Toast/Sonner, Tooltip, Button, Table |
| Ukuran file | `settings/page.tsx` 8.329 baris, `customer/page.tsx` 6.111, `events/portal/page.tsx` 5.349 | Perlu dipecah sebelum dimigrasi |

---

## 3. Keputusan teknis (usulan)

| Keputusan | Usulan | Alasan |
| --- | --- | --- |
| Library primitive | **Base UI** (`-b base`) | Default resmi sejak Juli 2026, mendukung React 18, dan proyek belum terikat Radix. Kalau tim lebih nyaman dengan Radix, cukup `-b radix`. API komponennya sama |
| Tailwind | Upgrade ke **v4** di awal (Fase 1) | Preset, style, dan token OKLCH dari create mengandalkan v4. Tanpa v4, komponen tetap memakai format lama |
| Next.js | Tetap 14 untuk saat ini | Tidak memblokir. Upgrade 15/React 19 dijadikan MR terpisah nanti |
| Dark mode | Pertahankan `ThemeContext` dan kunci `localStorage` `dagoeng_theme_preference` yang ada, atau ganti `next-themes` sesuai docs shadcn | Mengganti boleh, asal kunci lama dibaca supaya preferensi pengguna tidak hilang |
| Toast | `toast` (Base UI) kalau base = Base UI, `sonner` kalau Radix | Mengganti 112 pemanggilan `showToast`/`setXToast` lewat satu helper |
| Strategi rilis | Bertahap per area, satu MR per fase. Pakai lapisan CSS "legacy" sementara | Ada 29 halaman, jadi big-bang terlalu berisiko |

---

## 4. Fase 0: Menentukan design system (selesai)

**Keputusan (11 November 2026): preset `b1ZzrZdR2`** dengan style Mira, base Neutral, tema dan chart Blue (sementara, bisa diganti), DM Sans, lucide, dan radius default. Rinciannya ada di [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md).

```bash
npx shadcn@latest init --preset b1ZzrZdR2 --template next
```

Untuk mengganti warna tema nanti cukup jalankan `npx shadcn@latest apply --preset <kode-baru> --only theme`.

Tabel di bawah adalah opsi yang dipertimbangkan saat memilih, disimpan sebagai catatan.

| Pilihan di create | Opsi yang tersedia | Usulan awal untuk dicoba | Pertimbangan |
| --- | --- | --- | --- |
| Base (library) | Base UI, Radix, React Aria | Base UI | Lihat bagian 3 |
| Style | Vega (klasik), Nova (padat), Maia (bulat, lega), Lyra (kotak, cocok mono), Mira (padat), Luma (bulat, elevasi lembut), Sera (editorial, judul kapital), Rhea (Luma yang lebih padat) | **Rhea** atau **Nova** | Dashboard kasir dan admin butuh layar padat. Hindari Sera karena judul kapitalnya bertentangan dengan audit |
| Base color | Neutral, Stone, Zinc, Mauve, Olive, Mist, Taupe | **Neutral** atau **Zinc** untuk app, bandingkan dengan **Olive** | Audit menyarankan chrome abu netral. Olive sedikit hangat dan selaras dengan sage |
| Theme (warna `primary`) | Daftar tema warna di create | Hijau yang paling dekat dengan sage `#3B7A57`, atau oranye logo `#FF6B00` | **Keputusan brand utama.** Kalau oranye, cek kontras teks di atasnya |
| Chart color | Palet grafik | Satu hue utama + netral | Unslop: satu aksen per grafik |
| Icon library | lucide, hugeicons, dll. | **lucide** | Sudah dipakai di 68 file |
| Font | Daftar font create | Coba **DM Sans** (yang sekarang). Kalau tidak tersedia, pilih yang terdekat (Geist, Figtree, Instrument Sans) atau pasang lewat `registry:font` kustom | Karakter "hangat, jenaka" |
| Font heading | `inherit` atau font lain | `inherit` | Satu keluarga cukup untuk app |
| Radius | none … large | default atau medium | Tombol 8–10px, kartu 12–16px |
| Menu accent / menu color | subtle, bold / default, inverted, translucent | subtle / default | Netral, tanpa efek kaca |

Daftar keputusan yang harus dicatat di akhir Fase 0:

- [ ] Kode preset (contoh format: `npx shadcn@latest init --preset XXXXXXXX`)
- [ ] Warna `primary` final + kontras dengan `primary-foreground` minimal 4,5:1 di terang dan gelap
- [ ] Nilai OKLCH `success`, `warning`, `info`
- [ ] Pemetaan empat warna logo ke unit bisnis
- [ ] Font dan bobot yang dimuat (maksimal 400/500/600)
- [ ] Mode default (terang, gelap, atau ikut sistem)
- [ ] Satu nama produk resmi
- [ ] `docs/DESIGN_SYSTEM.md` diperbarui dan bagian oranye-sebagai-primary diselaraskan

Alat bantu CLI untuk fase ini:

```bash
npx shadcn@latest preset decode <kode>
```

```bash
npx shadcn@latest preset url <kode>
```

---

## 5. Fase 1: Fondasi (1 MR, tanpa perubahan tata letak)

Tujuan: proyek siap shadcn tanpa merusak 29 halaman yang ada.

**Status (11 November 2026): selesai di branch `feat/shadcn-foundation`, belum di-commit.**

- Tailwind 4.3 (codemod resmi), `@tailwindcss/postcss`, `tw-animate-css`, shadcn 4.23 + Base UI 1.9, paket `cn`, `components.json` (style `base-mira`).
- `globals.css` ditulis ulang menjadi satu sistem token preset `b1ZzrZdR2` + token kustom (`success`, `warning`, `info`, `unit-*`) + alias legacy yang ditandai.
- Override `!important` lama dipindah ke `src/app/legacy-dark.css`, dengan `:not([data-slot])` dan nilai navy diganti token.
- Font lewat `next/font` (DM Sans dan DM Mono). `<link>` Google Fonts dan DM Serif dihapus.
- Verifikasi: typecheck bersih, `next build` sukses, dan test 858 lulus / 4 gagal (sama dengan baseline sebelum perubahan, tidak terkait UI). Dashboard, POS, dan landing dicek di mode terang dan gelap tanpa tata letak rusak.

Catatan yang ditemukan saat pengerjaan:

- `shadcn init` menimpa `button.tsx` dan mengosongkan `lib/utils.ts` (`formatCurrencyIDR`, `formatPercentage` hilang) meski memakai `--no-reinstall`. Keduanya dipulihkan. `Button` versi shadcn baru dipasang di Fase 2.
- Codemod Tailwind mengganti hex arbitrer dengan nama token yang kebetulan bernilai sama. 96 kasus `bg-/text-[#1E293B]` → `warning-foreground` dikembalikan ke hex. Codemod juga mengubah prop `variant="outline"` menjadi `"outline-solid"` di 6 tempat, dan itu sudah diperbaiki.
- `tests/theme.test.ts` disesuaikan dari memeriksa `<link>` Google Fonts menjadi memeriksa `next/font`.
- Selama migrasi, warna tercampur: elemen bertoken memakai biru preset, sedangkan sage dan navy yang di-hardcode tetap ada sampai halamannya dimigrasi (Fase 3–7).

1. **Branch** `feat/shadcn-foundation` dari `develop`.
2. **Upgrade Tailwind v4** dengan codemod resmi:
   ```bash
   npx @tailwindcss/upgrade
   ```
   - `postcss.config.mjs` diubah ke `@tailwindcss/postcss`
   - Isi `tailwind.config.ts` dipindah ke CSS (`@theme`)
   - Cek kelas yang berganti nama di v4 (`shadow-sm` → `shadow-xs`, `rounded` → `rounded-sm`, `outline-none` → `outline-hidden`, `ring` default 1px, dll.). Codemod menangani sebagian besar, sisanya dicek manual
3. **Animasi**: hapus `tailwindcss-animate`, pasang `tw-animate-css`, lalu `@import "tw-animate-css"`.
4. **Init shadcn dengan preset dari Fase 0.** Cek dulu dengan `--dry-run`:
   ```bash
   npx shadcn@latest init --preset b1ZzrZdR2 --template next --dry-run
   ```
   ```bash
   npx shadcn@latest init --preset b1ZzrZdR2 --template next
   ```
   Hasilnya: `components.json`, token OKLCH di `globals.css`, `@theme inline`, font, dan `lib/utils.ts`.
5. **Pindahkan `cn`** ke paket `cn`:
   ```bash
   npx shadcn@latest migrate cn
   ```
6. **Pisahkan CSS lama.** Pindahkan blok override `!important` dari `globals.css` ke `src/app/legacy-dark.css` (sementara), dengan dua aturan:
   - **Hapus segera** override yang mengenai kelas atau elemen semantik yang dipakai shadcn, karena kalau dibiarkan akan merusak komponen baru di mode gelap: `.bg-card`, `.bg-popover`, `[role="dialog"]`, `[role="menu"]`, `[role="listbox"]`, `[role="tooltip"]`, `input`/`textarea`/`select`, `label`, `h1`–`h6`, `th`, dan `[data-radix-popper-content-wrapper]`.
   - **Biarkan sementara** override utilitas lama (`.dark .bg-white`, `.dark .text-slate-500`, pemetaan oranye/ungu ke sage, dll.) supaya halaman lama tetap tampil normal. Blok ini dihapus per halaman setelah halaman itu dimigrasi.
7. **Hapus dari `globals.css`**: `letter-spacing: -0.01em` di `body`, `.glass-panel`, `.glow-card`, `.bg-grid-pattern`, variabel ganda `--bg-main`/`--text-main`, dan hex hardcode di `layout.tsx:36,70`.
8. **Tambahkan token kustom** `success`, `warning`, `info`, dan `unit-*` dengan pola resmi shadcn.
9. **Muat font sesuai preset saja.** Ganti `<link>` Google Fonts yang memuat 100–1000 + italic dengan setup font dari preset (`next/font`).
10. **Verifikasi**: `npm run build`, `npm test`, typecheck, dan screenshot terang/gelap di 5 halaman acuan (landing, login, dashboard, POS, portal customer). Tampilan harus sama atau lebih baik, tidak boleh ada yang pecah.

---

## 6. Fase 2: Komponen dasar (1 MR)

Pasang komponen resmi, lalu buat lapisan kompatibilitas supaya import lama tetap jalan.

**Status (11 November 2026): selesai di branch `feat/shadcn-foundation`.**

- **Lapisan kompatibilitas:** alih-alih mapping variant di `index.ts`, komponen lama (11 file) dipindah utuh ke `src/components/legacy/ui/`, dan import di 61 file diarahkan ke sana. Tampilan halaman lama tidak berubah. `src/components/ui/` sekarang murni berisi registry shadcn.
- **Komponen shadcn (38):** alert, alert-dialog, avatar, badge, breadcrumb, button, calendar, card, chart, checkbox, combobox, dialog, drawer, dropdown-menu, empty, field, input, input-group, kbd, label, native-select, pagination, popover, progress, radio-group, scroll-area, select, separator, sheet, sidebar, skeleton, spinner, switch, table, tabs, textarea, toast, dan tooltip.
- **Dependensi baru:** `react-day-picker` 10. Recharts naik dari 2 ke 3 (dibutuhkan `chart`). `RevenueChartPreview.tsx` disesuaikan tipe `formatter`-nya.
- **`src/components/app/`:** `PageHeader`, `SectionHeader`, `StatCard`, `formatChange`, `UnitDot`, `StatusBadge`, `EmptyState`, `ConfirmDialog`, dan `notify()`. Ada 21 test di `tests/app-components.test.ts` yang merender HTML statis di lingkungan node. `vitest.config.ts` memakai `jsx: "automatic"`.
- **Provider:** `TooltipProvider` dan `Toaster` dipasang di `AppProviders`.
- **Verifikasi:** typecheck bersih, `next build` sukses (38 halaman), test 879 lulus / 4 gagal (baseline yang sama), dan dashboard dicek tanpa error konsol.

Aturan migrasi per halaman (Fase 3–7): ganti import `@/components/legacy/ui/*` dengan `@/components/ui/*` atau `@/components/app`. Folder `legacy/ui` dihapus di Fase 8 setelah tidak ada lagi yang mengimpornya.

```bash
npx shadcn@latest add button badge card input textarea label field select native-select checkbox radio-group switch tabs table skeleton pagination dialog alert-dialog sheet drawer dropdown-menu popover tooltip calendar separator scroll-area avatar breadcrumb progress empty spinner kbd sidebar chart toast
```

Gunakan `--dry-run` atau `--view` dulu untuk melihat dependensi yang ditambahkan.

### Pemetaan komponen lama ke shadcn

| Sekarang | Ganti dengan | Jumlah tempat (perkiraan) |
| --- | --- | --- |
| `components/ui/button.tsx` (variant `cyan`, `green`, `transition-all`) | `Button` shadcn (`default`, `secondary`, `outline`, `ghost`, `destructive`, `link`) | 53 import + 394 `<button>` native |
| `badge.tsx`, `ProFeatureBadge` | `Badge` | puluhan |
| `card.tsx` | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter` | 31 import |
| `input.tsx` | `Input`, `InputGroup`, `Field` | |
| `table.tsx` + 56 `<table>` native | `Table` (+ pola data table dengan TanStack Table untuk tabel besar) | 56 |
| `tabs.tsx` | `Tabs` | |
| `skeleton.tsx`, `.animate-shimmer` | `Skeleton` | |
| `table-pagination.tsx` | `Pagination` | |
| `ThemeToggle.tsx` | `Button` + `DropdownMenu` (pola mode toggle docs shadcn) | 1 |
| `animated-counter.tsx` | Dihapus atau dipertahankan sebagai util. Unslop: angka cukup di-tween saat berubah, tanpa animasi masuk | |
| 21 `*Modal.tsx` + overlay `fixed inset-0` di 45 file | `Dialog` (form), `AlertDialog` (konfirmasi), `Sheet` (panel samping), `Drawer` (mobile) | 45 file |
| 97 `<select>` native | `Select`, `NativeSelect` (form sederhana), `Combobox` (pencarian) | 97 |
| 25 checkbox/radio | `Checkbox`, `RadioGroup`, `Switch` | 25 |
| 25 `<textarea>` | `Textarea` | 25 |
| 34 input tanggal/jam, `DateRangePicker.tsx` | `Calendar` + `Popover` (date/range picker) | 34 |
| 112 toast buatan (`showToast`, `setPosToast`, …) | `toast` / `sonner` lewat satu helper `notify()` | 112 |
| ±122 `title=` + 9 tooltip `group-hover` | `Tooltip` (dengan `TooltipProvider` di root) | ±130 |
| Dropdown buatan (menu user landing, dll.) | `DropdownMenu` | |
| Keadaan kosong dan grafik kosong | `Empty` | |
| Grafik recharts | `ChartContainer`, `ChartTooltip`, `ChartLegend` dengan token `chart-*` | |
| Status pill | `Badge` variant + titik `unit-*` | |

### Lapisan kompatibilitas

- `src/components/ui/index.ts` tetap mengekspor nama yang sama, sehingga import lama tidak pecah.
- Variant lama yang tidak ada di shadcn (`cyan`, `green`) dipetakan sementara ke `secondary`/`default`, lalu dihapus saat halaman pemakainya dimigrasi.
- Komponen khusus aplikasi dibuat di `src/components/app/`, dirangkai dari primitive shadcn tanpa mengubahnya:
  - `StatCard` (label, angka, perubahan + pembanding)
  - `PageHeader` (judul, deskripsi, aksi)
  - `SectionHeader`
  - `UnitDot` (titik warna unit bisnis)
  - `StatusBadge`
  - `EmptyState`
  - `ConfirmDialog`
  - `notify()` sebagai helper toast

---

## 7. Fase 3: App shell dashboard (1 MR)

**Status (11 November 2026): selesai di branch `feat/shadcn-foundation`, belum di-commit.**

- **Shell:** mengikuti pola blok `dashboard-01`, dengan `SidebarProvider` + `AppSidebar variant="inset" collapsible="icon"` + `SidebarInset` + `SiteHeader`. Status buka/tutup sidebar disimpan di cookie `sidebar_state` bawaan shadcn, menggantikan key `localStorage` `dago_sidebar_collapsed`. Pintasan `Ctrl/Cmd+B` aktif, dan di mobile sidebar otomatis menjadi sheet.
- **File baru di `src/features/layout/`:** `AppSidebar.tsx`, `NavUser.tsx` (alur tutup shift kasir dipertahankan), `SiteHeader.tsx`, `NotificationMenu.tsx` (Popover), `ModeToggle.tsx`, dan `nav-groups.ts` (pengelompokan menu dan pencarian halaman aktif berbasis segmen URL). Test-nya ada di `tests/app-shell-nav.test.ts` (10 test).
- **Unslop:** label grup memakai huruf kalimat (Ringkasan, F&B, Ruang & tenant, Event, Laporan & administrasi) dengan `UnitDot` warna logo per unit. Tag modul `FNB`/`COMMERCIAL` dan badge `PRO` dihapus, dan ikon tanpa warna per item.
- **Dihapus:** `Sidebar.tsx` dan `Header.tsx` lama.
- **Belum dimigrasi:** `RoleAwareStatusPill` masih bergaya lama dan baru dirapikan bersama halaman dashboard di Fase 4.

**Upgrade Next 15.5 + React 19 (commit terpisah, prasyarat Fase 3).** Komponen shadcn Base UI ditulis untuk React 19, yang meneruskan `ref` sebagai prop. Di React 18, wrapper seperti `Button` dan `SidebarMenuButton` yang dipakai di `render` kehilangan ref, sehingga popover, dropdown, dan tooltip muncul di pojok kiri atas.

- **Paket:** `next` 15.5.29, `react`/`react-dom` 19, `@types/react` 19, dan `lucide-react` 1.x (ikon merek dihapus, sehingga `Instagram` di landing diganti `AtSign`).
- **Codemod `next-async-request-api`:** `await params` di 10 route handler dan `await cookies()` di `src/lib/session.ts`.
- **Konfigurasi:** `outputFileTracingRoot` di `next.config.js`. Duplikat `src/app/favicon.ico` dihapus karena Next 15 menolak konflik dengan `public/favicon.ico`.
- **Verifikasi:** typecheck bersih, build 38 halaman sukses, dan test 889 lulus / 4 gagal (baseline). Popover notifikasi, dropdown user, dan tooltip sidebar mode ikon dicek muncul di posisi yang benar.

- `SidebarProvider`, `Sidebar collapsible="icon"`, `SidebarHeader`, `SidebarContent`, `SidebarGroup`, `SidebarGroupLabel`, `SidebarMenu`, `SidebarMenuButton isActive`, `SidebarFooter`, `SidebarInset`, `SidebarTrigger`. Ini menggantikan logika collapse dan tooltip buatan sendiri.
- **Header**: `SidebarTrigger`, `Breadcrumb` (halaman aktif), pemilih outlet dengan `DropdownMenu`, `ThemeToggle`, dan menu user (`Avatar` + `DropdownMenu`) di `SidebarFooter`.
- **Unslop**:
  - Label grup sentence case (`Operasional`, `Keuangan`), bukan `MENU (SUPER ADMIN)`.
  - Tag modul `FNB`/`COMMERCIAL` di tiap baris diganti `UnitDot` atau dihapus.
  - Badge `PRO` dihapus kecuali ada paket berbayar yang nyata.
  - Tinggi baris 32–36px dengan ikon lucide 16px.
- `DevRoleSimulatorBar` dan `RoleAwareStatusPill` memakai `Badge` + `Tooltip`.
- **Verifikasi**: navigasi semua role demo, mode collapse, mobile (`Sheet` otomatis dari komponen `Sidebar`), keyboard (`Ctrl+B`), terang dan gelap.

---

## 8. Fase 4: Dashboard (1 MR)

**Status (11 November 2026): selesai di branch `feat/shadcn-foundation`, belum di-commit.**

- **Logika:** perhitungan dipindah dari `page.tsx` ke `features/dashboard/dashboard-metrics.ts` (fungsi murni, 17 test di `tests/dashboard-metrics.test.ts`) dan `use-dashboard-metrics.ts` (fetch dan scoping role).
- **UI:** `PageHeader` "Ringkasan" (tanpa salam), 4 `StatCard`, `ActionCenter`, `Alert` untuk tenant, grafik `ChartContainer` dengan `Tabs`, `UnitContributionCard` (`Progress` + `UnitDot`), dan versi baru `DailyProgressSummary`, `InventoryRiskCard`, `OutletCompareCard`, `DateRangePicker` (Popover), serta `RoleAwareStatusPill` (Badge). `KPICard` dihapus.
- **Bug data yang diperbaiki:** bar kontribusi kini proporsional terhadap porsi (dulu selalu penuh), dan grafik 7 hari tidak lagi menghitung pesanan di luar jendela sebagai pesanan hari ini.
- **Konten palsu dihapus:** kartu "Status sistem: siap operasi", ikon "Context sync" yang berputar, dan tanggal hardcode pada pintasan periode. HPP diberi label "estimasi 38%".
- **Test lama disesuaikan:** D3 di `tests/pos-d-bagian-d.test.ts` kini memeriksa bahwa nama tidak dipotong dan judulnya "Ringkasan".

- **Judul**: `PageHeader` dengan judul `Ringkasan`, deskripsi outlet dan periode, dan aksi `DateRangePicker` (Calendar + Popover). Tanpa salam "Selamat Datang".
- **KPI**: 3–4 `StatCard` (`Card` dengan `CardDescription`, angka `text-3xl font-medium tabular-nums`, perubahan + "vs periode lalu"). Tanpa tile ikon berwarna.
- **Grafik utama**: `ChartContainer` selebar ±2/3. Omzet memakai `chart-1`/`primary`, HPP abu, diskon garis putus-putus. Saat data kosong tampilkan `Empty`.
- **Kontribusi unit**: `Card` dengan daftar dan `Progress` tipis, plus `UnitDot`.
- **Notifikasi tindakan**: `Alert` dengan `Badge` jumlah, tanpa `animate-pulse`.
- **AI insight**: `Card` biasa dengan judul yang menyebut isinya, tanpa Sparkles.
- Hapus `font-black`, `uppercase tracking-*`, dan `text-[10px]`. Ukuran teks memakai skala Tailwind (`text-xs` sampai `text-3xl`).

---

## 9. Fase 5: Login dan landing (1 MR)

> **Status: selesai.** Catatan implementasi:
>
> - **Login** (`src/app/(auth)/login/page.tsx`): layout dua kolom seperti blok shadcn `login-02` (form di kiri, foto di kanan, foto disembunyikan di bawah `lg`), `FieldGroup` + `Input`, password memakai `InputGroup` dengan tombol tampil/sembunyi, error memakai `Alert`, loading memakai `Spinner`, toggle tema memakai `ModeToggle`. Konteks event (`?from=events`) jadi `Alert` dengan dua tombol. Logika login, register, dan `sanitizeReturnTo` tidak berubah.
> - **Landing** dipecah dari 1167 baris jadi `src/features/landing/` (header, hero, layanan, event, tentang, footer) dan `src/app/page.tsx` hanya merangkai section. Copy ada di `landing-content.ts`.
> - Carousel 3 slide diganti satu hero tetap. Blob, Sparkles berputar, emoji tenant, badge di atas judul, gradien, dan `hover:scale` dihapus. Scroll-spy diganti link anchor biasa; nav mobile memakai `Sheet`, menu akun memakai `DropdownMenu`.
> - Logika murni di `landing-logic.ts` (event mendatang, label peran, akses dashboard, label kategori event) dengan test di `tests/landing-content.test.ts`. Kategori event kini tampil sebagai label, bukan enum mentah.
> - Foto hero masih dari Unsplash. Ganti dengan foto asli DAGO di `HERO.image` saat tersedia.

- **Login**: pola blok login shadcn (`Card` + `Field` + `Input` + `Button`), logo flat, tanpa blob latar.
- **Landing**: shadcn tidak punya komponen landing, jadi dibangun dari token + `Button`, `Card`, `Badge`, dan `NavigationMenu`/`Sheet` untuk nav mobile. Ikuti pass unslop:
  - Satu hero tetap (bukan carousel) dengan foto asli DAGO. Judul menyebut apa yang bisa dilakukan pengunjung. Satu tombol utama dan satu sekunder.
  - Hapus blob, badge Sparkles berputar, gradien hover kartu, `hover:scale`, dan pola grid.
  - Badge di atas tiap judul section dihapus. Judul sentence case dengan bobot 500–600.
  - Bahasa Indonesia konsisten (`Lihat menu`, `Pesan meja kerja`).

---

## 10. Fase 6: Layar operasional (2–3 MR)

> Tracker semua fase, workflow per halaman, dan aturan pengujian ada di [REDESIGN_HANDOFF.md](./REDESIGN_HANDOFF.md).

Urutan dari yang paling sering dipakai staf: POS → KDS (kitchen) → pesanan → meja → inventory → menu → pelanggan → co-working → komersial → karyawan → laporan → log aktivitas → events-admin.

> **Progres (dikerjakan per halaman, satu halaman diverifikasi sebelum lanjut):**
>
> - [x] **KDS** (`/kitchen`): logika papan di `src/features/kitchen/kitchen-board.ts` (filter FIFO, scoping tenant, stasiun, data cetak ulang) dengan test `tests/kitchen-board.test.ts`; kartu tiket di `KitchenTicketCard.tsx` dengan nomor antrean dan waktu `font-mono tabular-nums`. Filter tipe memakai `Tabs`, status memakai `StatusBadge`, semua tombol aksi memakai `Button` default. Diperbaiki: filter "Takeaway" dulu mencari `TAKE_AWAY` sehingga tidak pernah cocok; legenda SLA kini mengikuti target per pesanan (75% = mendekati, lewat target = terlambat), bukan menit tetap. Generator pesanan demo yang tidak terpakai dihapus. Modal cetak ulang (`KitchenOrderReceiptModal`) masih komponen lama dan ikut dimigrasi bersama POS.
> - [~] **POS** (2856 → 2329 baris), dikerjakan dua tahap:
>   - [x] **Kerangka + mode F&B**: `PosToolbar` (mode `Tabs`, status shift), `ProductCatalog` + `ProductCard` (pencarian `InputGroup`, mitra dan kategori `Tabs`, kartu produk berupa `<button>` dengan status tutup/habis/stok tipis), dan panel keranjang `CartOrderSetup` (`NativeSelect` meja dan member), `CartItemList`, `CartPromoField`, `CartSummary`. State dan handler transaksi tetap di `page.tsx`; status produk diuji di `tests/pos-catalog.test.ts`. 17 toast buatan (`setPosToast`) diganti `notify()`. Diperbaiki: nomor antrean takeaway palsu (`Antrean #A-14`) dihapus, label service charge kini dari pengaturan (dulu ditulis 5%), fallback gambar produk kini juga menangkap gambar yang gagal sebelum hydration. Utility `no-scrollbar` (dipakai sidebar shadcn) ternyata belum didefinisikan; sekarang ada di `globals.css`.
>   - [ ] **Mode co-working** dan modal POS (`ModifierModal`, `PaymentModal`, `ReceiptModal`, `KitchenOrderReceiptModal`, `CashDrawerShiftModal`, buka shift, voucher, pratinjau foto).
> - [ ] Pesanan, meja, inventory, pelanggan, co-working, komersial, karyawan, laporan, log aktivitas, events-admin.

Untuk setiap halaman:

1. Ganti modal, select, input tanggal, toast, dan tooltip sesuai tabel di Fase 2.
2. Ganti warna mentah dengan token. Hapus kelas dari `legacy-dark.css` yang tidak lagi dipakai halaman ini.
3. Jalankan checklist unslop (bagian 13).
4. Momen khusus: struk POS (sukses bayar) dan kartu pesanan KDS dibuat sebagai benda nyata dengan angka `font-mono tabular-nums`. Pulse hanya untuk pesanan baru yang benar-benar live.

---

## 11. Fase 7: File besar dan portal publik (3+ MR)

`settings` (8.329 baris), `customer` (6.111), dan `events/portal` (5.349) **dipecah dulu tanpa mengubah tampilan** (refactor murni: per tab atau section menjadi file di `features/<area>/`). Setelah itu baru dimigrasi seperti Fase 6. Halaman `events/*`, `checkout-link-v2`, dan tiket mengikuti, dengan e-tiket sebagai momen (kartu tiket dengan perforasi dan QR).

---

## 12. Fase 8: Pembersihan dan pagar pengaman (1 MR)

- Hapus `src/app/legacy-dark.css`, variant kompatibilitas Button, `tailwindcss-animate`, `clsx`, dan `tailwind-merge` (kalau sudah tidak dipakai).
- Tambah skrip `npm run lint:ui` (grep sederhana atau aturan ESLint) yang gagal kalau menemukan:
  - `bg-\[#`, `text-\[#`, `border-\[#` (warna mentah)
  - `font-black`, `font-extrabold`
  - `transition-all`, `hover:scale-`
  - `uppercase` + `tracking-wider` pada label
  - `text-\[(8|9|10)px\]`
  - `!important` di CSS
  - emoji di file `.tsx`
- Pasang skrip itu di CI, setelah Fase 8 selesai supaya tidak memblokir migrasi.
- Perbarui `docs/DESIGN_SYSTEM.md` (aturan pakai token dan daftar komponen) dan `README.md`.
- Opsional: `npx skills add shadcn/ui` supaya agen koding memahami API komponen yang terpasang.

---

## 13. Checklist per halaman

Dipakai di setiap MR Fase 3–7:

- [ ] Hanya token semantik. Tidak ada hex, `slate-*`, atau `dark:` untuk warna
- [ ] Komponen shadcn untuk tombol, input, select, dialog, menu, tooltip, toast, tabel
- [ ] Spacing di skala 4px dengan baris sejenis setinggi sama
- [ ] Ikon lucide 16px, warna `muted-foreground`, tanpa emoji
- [ ] Teks sentence case, bobot 400–600, minimal 12px (11px hanya untuk meta padat)
- [ ] Angka `tabular-nums` dalam satu format Rupiah
- [ ] Tanpa salam, tanda seru, atau titik di label dan tombol. Persentase menyebut pembandingnya
- [ ] `primary` hanya untuk satu aksi utama, item terpilih, atau satu angka kunci
- [ ] Tanpa gradien, blob, glow, `backdrop-blur`, atau `hover:scale`. Transisi spesifik (`transition-colors`)
- [ ] Keadaan kosong memakai `Empty`. Keadaan loading memakai `Skeleton`
- [ ] Fokus keyboard terlihat. Dialog bisa ditutup dengan Esc
- [ ] Screenshot sebelum dan sesudah, terang dan gelap, desktop 1440 dan mobile 375

---

## 14. Verifikasi dan risiko

| Risiko | Mitigasi |
| --- | --- |
| Upgrade Tailwind v4 mengubah tampilan kelas lama | Codemod resmi, MR fondasi terpisah, screenshot 5 halaman acuan sebelum dan sesudah |
| Override `!important` lama menabrak komponen shadcn | Override pada selector semantik dihapus di Fase 1. Sisanya diisolasi di `legacy-dark.css` |
| Perilaku modal dan select berubah (fokus, scroll lock, portal) | Uji alur kritis: buka shift kasir, bayar POS, check-in event, reservasi co-working |
| File raksasa sulit di-review | Pecah dulu (refactor tanpa ubahan visual), baru migrasi |
| Preset diganti di tengah jalan | Aman. `shadcn apply --preset <kode>` (atau `--only theme`) menerapkan ulang ke komponen terpasang |
| Test yang ada (89+ test Vitest) | `npm test` + `npm run build` + typecheck di setiap MR. Tambah smoke test Playwright untuk login → dashboard → POS |

---

## 15. Ringkasan MR

| # | MR | Bergantung pada |
| --- | --- | --- |
| 0 | Keputusan design system dan preset (dokumen saja) | Sesi bersama |
| 1 | Fondasi: Tailwind v4, init shadcn, token, `legacy-dark.css` | 0 |
| 2 | Komponen dasar + lapisan kompatibilitas + `components/app` | 1 |
| 3 | App shell (Sidebar, Header) | 2 |
| 4 | Dashboard | 3 |
| 5 | Login dan landing | 2 |
| 6a–c | POS/KDS/pesanan, lalu sisa layar dashboard | 3 |
| 7a–c | Pecah dan migrasi settings, portal customer, portal event | 2 |
| 8 | Pembersihan, `lint:ui`, dokumentasi | Semua |

MR 3, 5, dan 7a bisa dikerjakan paralel setelah MR 2 masuk.

---

*Rencana ini menerapkan metode unslop oleh Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), lisensi CC BY 4.0, di atas komponen resmi shadcn/ui.*
