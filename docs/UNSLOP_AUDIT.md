# Audit UI — DagoEng Creative Hub

Audit dengan metode [unslop](https://github.com/heydamir/unslop) oleh Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), CC BY 4.0.

- Tanggal: 10 November 2026
- Cakupan: seluruh `src/` (29 halaman), dengan render langsung untuk landing (`/`), login (`/login`), dan dashboard (`/dashboard`, akun demo admin) pada 1440×900
- Status: **audit saja, belum ada kode yang diubah**

---

## Ringkasan

**Kesimpulan: slop sedang–berat, tetapi fondasinya bagus.** Proyek ini sudah punya arah: aksen sage green, DM Sans, lucide sebagai satu-satunya set ikon, dan tidak ada gradien ungu–biru di mode terang. Yang membuatnya terlihat "AI-generated" adalah kebiasaan di level kelas:

- Label huruf besar dengan tracking lebar di mana-mana
- `font-black` untuk judul
- `transition-all` dan `hover:scale`
- Blob blur dan badge berkilau di hero
- Ukuran teks acak `text-[9px]`/`text-[10px]`
- Salam pembuka di dashboard

Ada dua masalah sistemik yang perlu dibereskan sebelum perbaikan visual:

1. **Mode gelap bergantung pada ±300 baris aturan `!important`** di `globals.css`. Aturan ini menimpa kelas utilitas warna, termasuk mengubah oranye/ungu menjadi sage.
2. **Pedoman brand dan kode saling bertentangan.** `docs/DESIGN_SYSTEM.md` menetapkan oranye `#FF6B00` sebagai warna utama dan tombol default, sedangkan kodenya sudah beralih ke sage `#3B7A57` dan secara aktif menekan warna oranye, kuning, dan cyan.

Rekomendasi: **jangan redesain total**. Jalankan mode *polish* bertahap:

1. Putuskan warna brand dan bereskan token serta komponen dasar
2. Rapikan shell dashboard dan landing
3. Rapikan halaman-halaman besar satu per satu

---

## Angka dari pemindaian kode

Hitungan kemunculan pola di `src/` (perkiraan, termasuk `.ts`/`.css`):

| Tanda | Jumlah | Catatan |
| --- | ---: | --- |
| `text-[Npx]` (ukuran teks acak) | 1.895 | Banyak `text-[9px]`/`text-[10px]` di bawah batas baca 11–12px |
| `font-bold` | 2.472 | Hierarki dibangun dari ketebalan, bukan ukuran |
| `font-black` | 323 | Judul berat 900 |
| `font-extrabold` | 54 | |
| `uppercase` | 385 | Hampir selalu dipasangkan dengan tracking lebar |
| `tracking-wider/widest` | 186 | |
| `transition-all` | 363 | Termasuk di komponen `Button` dasar |
| `hover:scale-*` | 59 | Tombol dan kartu membesar saat hover |
| `hover:-translate-y` | 11 | Kartu melayang |
| `animate-pulse` | 47 | Sebagian di elemen yang tidak "live" |
| `animate-ping/bounce` | 9 | |
| `rounded-2xl/3xl/[Npx]` | 537 | Radius besar tanpa aturan bersarang |
| `rounded-full` | 349 | Banyak pill untuk hal yang bukan pill |
| `backdrop-blur` | 126 | Efek kaca |
| `blur-2xl/3xl` (blob) | 10 | Aura warna di hero dan kartu |
| `bg-gradient-to-*` | 50 | Terutama di portal customer dan event |
| Kelas `violet/purple/indigo/fuchsia/pink` | 538 | Di mode gelap disamarkan oleh override CSS, di mode terang tetap tampil |
| Shadow berwarna (`shadow-[#…]/20`, `shadow-emerald…`) | 22 | Glow hijau di tombol |
| Spacing acak `p-[13px]` dll. | 129 | |
| Emoji di UI | 66 | Terbanyak: landing, customer, events-admin, portal event |

Halaman dengan tanda terbanyak:

| File | Baris | gradient | uppercase | font-black | rounded besar | teks 8–10px |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `src/app/(mobile)/customer/page.tsx` | 6.111 | 16 | 29 | 94 | 130 | 88 |
| `src/app/events/portal/page.tsx` | 5.349 | 7 | 46 | 41 | 123 | 105 |
| `src/app/(dashboard)/settings/page.tsx` | 8.329 | 4 | 61 | 6 | 88 | 182 |
| `src/app/(dashboard)/pos/page.tsx` | 2.835 | 0 | 6 | 4 | 13 | 40 |
| `src/app/page.tsx` (landing) | 1.167 | 8 | 16 | ±30 | ±40 | ±15 |

> Tiga file teratas berukuran 5.000–8.000 baris. Perbaikan visual akan jauh lebih aman kalau bagian berulangnya (label section, kartu statistik, pill status) dipecah dulu menjadi komponen kecil.

---

## Temuan per area

### 1. Sistem warna dan tema (`globals.css`, `tailwind.config.ts`, `layout.tsx`, `docs/DESIGN_SYSTEM.md`)

- **Pedoman brand tidak sesuai kode.** `DESIGN_SYSTEM.md:13-19` menetapkan oranye `#FF6B00` (aksi utama), cyan `#00B2FE`, hijau `#00C853`, dan kuning `#FFB300`, ditambah tombol default oranye (`DESIGN_SYSTEM.md:46`). Kodenya memakai sage `#3B7A57` sebagai `--primary` (`globals.css:30`), dan `tailwind.config.ts:21-24` memetakan `brand.orange`, `brand.cyan`, dan `brand.yellow` ke sage. Salah satunya perlu diputuskan sebagai sumber kebenaran.
- **Override mode gelap berbasis `!important`.** Di `globals.css:117-435`, kelas seperti `.dark .bg-white`, `.dark .text-slate-500`, `.dark h1` ditimpa paksa. Setiap komponen baru harus "menebak" override mana yang aktif, dan kelas yang tidak masuk daftar akan bocor.
- **Warna disembunyikan, bukan dihapus.** `globals.css:383-435` mengubah oranye/kuning/ungu menjadi sage hanya di mode gelap. Akibatnya, nama kelas tidak lagi sesuai dengan warna yang tampil, dan mode terang menampilkan warna lain.
- **Netral kebiruan, bukan netral.** Mode gelap memakai `#0F172A`/`#1E293B` (slate navy). Untuk aplikasi yang dipandangi staf berjam-jam, permukaannya sebaiknya abu netral (graphite) supaya warna konten yang bicara.
- **Tiga sumber warna untuk hal yang sama.** Ada `--bg-main`/`--text-main` (hex), `--background`/`--foreground` (HSL), dan hex hardcode di `layout.tsx:36,70` (`bg-[#F8FAFC] dark:bg-[#0F172A]`).
- **Teks muted terlalu terang di gelap.** `--muted-foreground: 215 25% 80%` dan override `#CBD5E1` membuat teks sekunder dan muted hampir sama terangnya dengan teks utama, sehingga ketiga peran teks tidak terbedakan.
- **Dua hijau bersaing di grafik.** `RevenueChartPreview.tsx:236-238,280-281`: omzet memakai sage `#3B7A57`/`#52B788`, sedangkan diskon memakai emerald `#10B981`. Dua seri yang maknanya berbeda tampil dengan warna hampir sama.
- **Efek kaca dan glow.** `.glass-panel` (`globals.css:459-479`) dan `.glow-card` dengan border gradien saat hover (`globals.css:481-509`).

### 2. Tipografi

- **Tracking negatif global.** `body { letter-spacing: -0.01em }` di `globals.css:445` mempersempit semua teks kecil, padahal teks kecil justru butuh tracking 0 atau sedikit positif.
- **Header tabel paksa.** `th { font-weight: 700 !important; letter-spacing: 0.04em }` di `globals.css:260-264`.
- **Hierarki dari ketebalan.** Judul memakai `font-black` (900), contohnya hero `page.tsx:533`, judul section `page.tsx:597,804,1004`, dan kartu `page.tsx:621,711`.
- **Label kapital bertracking di mana-mana.** Contohnya label KPI (`KPICard.tsx:36`, sehingga di layar terlihat "TOTAL PENDAPATAN KONSO…" terpotong), label menu sidebar (`Sidebar.tsx:245`), badge section landing (`page.tsx:594,1001`), dan judul footer (`page.tsx:1093,1114,1140`).
- **Teks terlalu kecil.** Ada ratusan `text-[9px]`/`text-[10px]`, misalnya tag modul di sidebar, badge, dan keterangan di bawah angka.
- **Font yang dimuat berlebihan.** `layout.tsx:43` memuat DM Sans 100–1000 + italic, DM Mono 300–500 + italic, dan DM Serif Display, padahal yang dipakai hanya sebagian kecil.
- **Italic.** Ada 41 pemakaian `italic`.

### 3. Ikon

- Hanya satu set ikon (`lucide-react`, 68 import). **Ini sudah baik.**
- 66 emoji masih dipakai sebagai ikon atau dekorasi: 🎉 ✅ 👋 ☕ 🍲 🥐 🍛 💻 🖥 🎙 👥 📅 👤 🏢 ✨ 🌐 📊 ⚡ 📌 📝 💡 🛡 🎟 🟢, ditambah simbol ➔ ✕ ✓ ⚠. Terbanyak di `page.tsx`, `customer/page.tsx`, `events-admin/page.tsx`, `events/portal/page.tsx`, `customers/page.tsx`, dan `EventCheckInQRScannerModal.tsx`.
- **Kotak ikon berwarna.** Di `KPICard.tsx:24-31`, ikon diberi tile berwarna sendiri (sage, sky, emerald, amber) sehingga empat kartu tampil dengan empat warna tanpa makna.
- **Sparkles untuk AI.** Ada di `AIInsightCard.tsx:42-44` ("DagoEng AI Business Insight") dan, yang berputar terus, di badge hero (`page.tsx:528`, `animate-spin`).

### 4. Copy

- **Salam pembuka di dashboard.** `dashboard/page.tsx:297-298` menampilkan `Selamat Datang, {nama depan}`. Untuk akun "Platform Super Admin" hasilnya **"Selamat Datang, Platform"** (terlihat di render), yang terbaca seperti bug. Sebaiknya ganti dengan nama konteks, misalnya `Ringkasan · Outlet Singaraja` atau periode `1 Sep – 10 Nov 2026`.
- **Tanda seru di UI.** Contohnya `Pembayaran Sukses!` (`checkout-link-v2/[token]/page.tsx:186`), `E-Tiket Ditemukan!`, `Tersalin!`/`Disalin!` (5 tempat), `Check-in Berhasil! 🎉`, `Sesi transaksi baru aktif! …` (`pos/page.tsx:806`), `Selamat! Profil penyelenggara Anda aktif …` (`customer/page.tsx:544`), dan `Antusiasme sangat tinggi! …` (`events/portal/page.tsx:3597`).
- **Nama produk tidak konsisten.** Ada "DagoEng Creative Hub" di landing dan `DESIGN_SYSTEM.md`, "DagoEng Platform" di login, "DAGO Creative Hub" di sidebar, "DagoEng F&B Management" di `<title>`, dan "DAGO Creative Hub Bali" di section tentang. Nama tidak perlu diubah, cukup diputuskan satu bentuk utama.
- **Campuran Inggris–Indonesia di tombol dan label.** Contohnya `Explore F&B`, `Explore Co-Working`, `Explore Our Services` di halaman yang sisanya berbahasa Indonesia.
- **Klaim yang perlu dicek kebenarannya.** Contohnya "kedap suara", "koneksi fiber optic dedicated berkecepatan tinggi", "kopi spesialti", "kuliner premium" (`page.tsx` HERO_SLIDES), dan "+50 Poin" untuk member baru. Kalau benar, pertahankan dengan nada tenang. Kalau tidak pasti, hapus.
- **Perubahan tanpa pembanding.** Persentase di `KPICard` tidak menyebut pembandingnya (`+12%` versus apa?).

### 5. Spacing dan layout

- 129 nilai spacing acak (`p-[13px]` dan sejenisnya), serta campuran `space-x-*` dan `gap-*`.
- **Sidebar.** Baris navigasi `py-2` dengan `text-xs`, ditambah tag modul (`FNB`, `COMMERCIAL`, `PRO`) di hampir setiap baris (`Sidebar.tsx:305-316`). Kolom kanan jadi ramai dan label tidak bisa dipindai cepat.
- **Kartu KPI.** Empat kartu sama lebar dengan isi sejenis dan ikon berwarna. Di bawahnya ada grafik dan panel "Kontribusi Unit Bisnis" yang ukurannya hampir sama besar, sehingga tidak ada satu elemen utama.
- **Hero landing.** Teks ditumpuk rata kiri di atas foto stok Unsplash yang berganti otomatis (carousel 3 slide), ditambah dua blob blur dan dua lapis gradien gelap. Fotonya bukan tempat DAGO yang sebenarnya.

### 6. Detail komponen

- **Badge di atas judul section.** Pola badge → judul `font-black` → paragraf kecil diulang di setiap section landing (`page.tsx:594-597,800-804,1001-1004`).
- **Badge `PRO`.** Ada di menu Co-working (`Sidebar.tsx:308`) dan pill status "Beroperasi Aktif" di header.
- **Radius tanpa aturan bersarang.** Contohnya kartu `rounded-3xl` berisi kartu `rounded-2xl` berisi tombol `rounded-2xl`. Tombol hero `rounded-2xl` (`page.tsx:547`) berbeda dengan `Button` dasar `rounded-lg`.
- **Grafik kosong tetap digambar.** Saat data nol, sumbu Y menampilkan `Rp 4, Rp 3, Rp 2…` dan garis datar di nol. Lebih baik tampilkan keadaan kosong yang jujur.
- **Pill kosong.** Ada satu pill kosong di samping judul "Performa Penjualan & Analisis Margin" di render dashboard. Ini perlu dicek, kemungkinan skeleton yang tidak hilang.

### 7. Visual

- Hero dan section tentang memakai foto stok Unsplash (kafe dan ruang kerja generik), dengan teks dan badge ditumpuk di atasnya.
- Pola grid (`.bg-grid-pattern`, `globals.css:533-545`) dan blob blur di hero (`page.tsx:519-520`) murni dekorasi.
- **Logo asli adalah aset terkuat.** Wordmark "dago" flat empat warna (oranye, cyan, hijau, kuning, sesuai `DESIGN_SYSTEM.md:36-40`) di `public/logo-dago.png` dan `logo-dagoeng.svg`. Warnanya sekarang tidak dipakai sama sekali di UI, bahkan sengaja ditekan oleh override CSS.

### 8. Motion

- `transition-all` di komponen `Button` dasar (`components/ui/button.tsx:6`), `Sidebar.tsx:155,262,293`, dan 360 tempat lain.
- `hover:scale-105` pada tombol CTA (`page.tsx:547,558,815,1064`) dan gambar yang membesar saat hover (`page.tsx:954`).
- `animate-spin` permanen pada ikon Sparkles di badge hero (`page.tsx:528`), dan `animate-pulse` pada ikon peringatan dashboard (`dashboard/page.tsx:330`).
- Carousel hero yang berganti otomatis dengan transisi `scale-105`.
- Kurva easing campuran (`ease-out`, `ease-in-out`, `cubic-bezier(0.16,1,0.3,1)`, `ease-linear`).

---

## Arah desain (usulan, perlu persetujuan)

Diambil dari isi produk sendiri, bukan tren.

- **Produk.** Sistem operasional satu atap untuk hub kreatif DAGO: kasir dan dapur F&B, reservasi co-working, event komunitas, dan loyalty, dipakai staf, tenant, dan pengunjung.
- **Karakter.** Hangat, sibuk tapi tertib, sedikit jenaka, mengikuti logonya.
- **Dunia.** Kafe dan ruang kerja bersama: meja kayu, struk kasir, papan menu, tiket event, kunci loker.
- **Momen.** Di dashboard: satu grafik omzet utama yang digambar dengan cermat. Di POS dan event: struk atau e-tiket yang tampil seperti benda nyata (kertas, perforasi, angka mono). Di landing: foto asli ruangan DAGO plus pratinjau menu QR yang sungguhan.
- **Ciri khas.** Empat titik warna dari logo, satu per unit bisnis (misalnya F&B oranye, co-working cyan, event hijau, loyalty kuning). Dipakai hanya sebagai penanda unit di navigasi, legenda grafik, dan badge unit. Pemetaan warna perlu diputuskan tim.

---

## Rekomendasi per pass

Nilai-nilai di bawah adalah titik awal dari referensi unslop, disesuaikan dengan proyek ini.

### Pass 0: Fondasi (paling berdampak, lakukan pertama)

1. **Putuskan satu sumber kebenaran untuk brand.** Pilih antara oranye `#FF6B00` sesuai `DESIGN_SYSTEM.md` atau sage seperti kode sekarang, lalu samakan dokumen dan kodenya. Usulan: satu aksen untuk aksi (sage sudah terpasang dan lebih tenang untuk layar kasir yang dipandang lama), dan empat warna logo khusus untuk penanda unit bisnis.
2. Ganti sistem override `!important` di `globals.css:117-435` dengan token semantik. Komponen hanya memakai `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, dan `border-border`, sehingga mode gelap cukup mengganti nilai variabel CSS.
3. Satukan sumber warna: hapus `--bg-main`/`--text-main` dan hex hardcode di `layout.tsx`, lalu pakai satu set variabel HSL.
4. Ganti `brand.orange`/`cyan`/`yellow` yang sekarang palsu dengan warna logo yang sebenarnya, khusus untuk penanda unit bisnis.
5. Perbaiki komponen dasar: `Button` (hapus `transition-all`, ganti dengan `transition-colors`, radius 8px), `Badge`, `Card`, dan `KPICard`.
6. Buat komponen kecil untuk pola yang berulang (judul section, kartu statistik, pill status) sebelum menyentuh file besar.

### Pass 1: Spacing

- Pakai skala 4px: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`. Ganti 129 nilai acak.
- Navigasi sidebar: tinggi baris 36px, jarak antarbaris 2–4px, label section 24px di atas dan 8px di bawah, padding panel 16px.
- Kartu 20–24px, tepi halaman 24–32px. Konten dashboard dibatasi sekitar 1440–1600px, bukan `max-w-7xl` (1280px).

### Pass 2: Warna

- **Dashboard (gelap).** Pakai ramp graphite: halaman `#141415`, sidebar `#0f0f10`, kartu `#19191b`, raised `#232325`, garis teks 8%, teks `#ededed`/`#a1a1a6`/`#85858b`.
- **Dashboard (terang).** Halaman `#fafafa`, kartu `#ffffff`, raised `#f4f4f5`, teks `#171717`/`#525252`/`#737373`.
- **Landing.** Boleh memakai ramp hangat (`#f7f4ee` terang, `#161513` gelap) karena dunianya kafe.
- **Satu aksen.** Kalau sage dipertahankan: `#3B7A57` di terang, `#52B788` di gelap, untuk aksi utama, item terpilih, dan satu angka kunci. Teks putih di atas `#3B7A57` sudah lolos kontras 4,5:1. Kalau oranye `#FF6B00` yang dipilih, teks putih di atasnya **tidak** lolos 4,5:1, jadi pakai teks gelap atau oranye yang lebih tua (sekitar `#C2410C`).
- **Grafik.** Omzet memakai aksen, HPP abu dari ramp, dan diskon abu yang lebih terang atau garis putus-putus. Jangan memakai hijau kedua.
- **Hapus.** Blob blur, shadow hijau di tombol, `.glow-card`, `.glass-panel`, gradien hover di kartu landing, dan gradien banner loyalty (`page.tsx:1050`).

### Pass 3: Ikon

- Ganti 66 emoji dengan ikon lucide ukuran 16px dan stroke 1,5, berwarna teks sekunder atau muted.
- Hapus tile ikon berwarna di `KPICard`. Kartu angka tidak perlu ikon.
- Ganti Sparkles di kartu AI dengan `Lightbulb` atau tanpa ikon, dan beri judul yang menyebut isinya (misalnya `Saran stok minggu ini`).

### Pass 4: Copy

- Judul dashboard: `Ringkasan` + konteks outlet dan periode, tanpa salam.
- Hapus tanda seru: `Disalin`, `Pembayaran berhasil`, `Check-in berhasil · Kursi 2 dari 3`.
- Pilih satu bahasa per layar. Untuk pengunjung, pakai Indonesia: `Lihat menu`, `Pesan meja kerja`.
- Sertakan pembanding pada persentase: `+12% vs bulan lalu`.
- Putuskan satu nama produk dan pakai sama di logo, login, sidebar, `<title>`, dan `DESIGN_SYSTEM.md`.
- Verifikasi atau hapus klaim yang belum pasti (lihat daftar pertanyaan di bawah).

### Pass 5: Tipografi

- Pertahankan DM Sans sebagai font utama dan DM Mono untuk angka dan meta, karena keduanya cocok dengan karakter "hangat, jenaka". DM Serif Display hanya untuk judul hero landing, atau hapus.
- Muat hanya bobot 400, 500, dan 600, tanpa italic.
- Hapus `letter-spacing: -0.01em` di `body`. Tracking negatif hanya untuk judul ≥40px.
- Ganti semua `font-black`/`font-extrabold` dengan 500–600 dan atur hierarki lewat ukuran. Judul halaman 28–32px, angka KPI 28–32px 500 tabular, isi 14px, meta 12px.
- Ganti label kapital bertracking dengan huruf kalimat 12–13px berwarna muted (`Total pendapatan`, `Menu`).
- Ukuran minimum teks 11px. Ganti `text-[9px]`/`text-[10px]` dengan 11–12px.

### Pass 6: Layout

- **Dashboard.** Tiga atau empat statistik ringkas di satu baris, lalu satu grafik utama selebar ±2/3 dengan tinggi 280–360px, dan di sebelahnya daftar "Kontribusi unit bisnis" yang lebih sempit dengan bar tipis.
- **Landing.** Ganti carousel tiga foto stok dengan satu hero tetap berisi foto asli DAGO, judul yang menyebut apa yang bisa dilakukan pengunjung (pesan dari meja, sewa meja kerja, ikut event), satu tombol utama, dan satu sekunder.

### Pass 7: Detail

- Radius kontrol 8–10px, kartu 12–16px, panel 16–20px. Radius bagian dalam sama dengan radius luar dikurangi padding. Pill hanya untuk status.
- Tag modul di sidebar diganti titik warna unit (ciri khas) atau dihapus. Badge `PRO` dihapus kecuali benar-benar ada paket berbayar.
- Grafik tanpa data menampilkan keadaan kosong (`Belum ada transaksi di periode ini`) alih-alih sumbu `Rp 4`.
- Fokus keyboard yang terlihat di semua kontrol, dengan warna dari ramp.

### Pass 8: Visual

- Pakai foto asli ruangan dan menu DAGO sebagai pengganti foto stok Unsplash. Tanpa blob dan tanpa pola grid.
- Momen di POS dan event: struk dan e-tiket dibuat di kode sebagai benda nyata.
- Dashboard tidak butuh gambar. Momennya adalah grafik utama.

### Pass 9: Motion

- Satu kurva `cubic-bezier(0.22, 1, 0.36, 1)`. Hover 120–180ms, menu 160–220ms, masuk layar 300–500ms.
- Ganti `transition-all` dengan `transition-colors` atau `transition-[transform,opacity]`.
- Hapus `hover:scale-*`, `hover:-translate-y`, putaran Sparkles, carousel otomatis, dan `animate-pulse` pada elemen yang tidak live. Pertahankan pulse hanya untuk status yang benar-benar live, misalnya pesanan baru di KDS.
- Efek tekan cukup `active:scale-[0.98]`.

---

## Urutan kerja yang disarankan

| Tahap | Isi | Dampak | Risiko |
| --- | --- | --- | --- |
| 1 | Pass 0: keputusan brand, token warna, hapus override `!important`, komponen dasar | Semua layar | Sedang. Perlu cek visual mode terang dan gelap di semua halaman |
| 2 | Shell dashboard (sidebar, header) dan halaman `/dashboard` | Semua staf | Rendah |
| 3 | Landing dan login | Kesan pertama | Rendah |
| 4 | POS, KDS, dan pesanan (dipakai paling lama oleh kasir dan dapur) | Operasional | Sedang |
| 5 | Portal customer, portal event, dan pengaturan (pecah file besar dulu) | Pengunjung dan admin | Tinggi karena ukuran file |

Setiap tahap sebaiknya menjadi MR terpisah yang bisa ditinjau dengan screenshot sebelum dan sesudah.

---

## Pertanyaan untuk tim

1. Mana warna aksi utama yang resmi: oranye `#FF6B00` (sesuai `DESIGN_SYSTEM.md`) atau sage `#3B7A57` (sesuai kode)? Usulan audit ini: sage untuk aksi, empat warna logo hanya sebagai penanda unit bisnis, lalu `DESIGN_SYSTEM.md` diperbarui.
2. Nama produk mana yang resmi: "DagoEng", "DAGO Creative Hub", atau "DagoEng Creative Hub"?
3. Apakah klaim ini benar dan bisa dipertahankan: ruang meeting kedap suara, fiber optic dedicated, kopi spesialti, dan bonus +50 poin untuk member baru?
4. Apakah ada foto asli ruangan dan menu DAGO yang bisa menggantikan foto Unsplash?
5. Apakah badge `PRO` di Co-working menandai paket berbayar yang nyata?

---

*Audit ini disusun dengan metode unslop oleh Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), lisensi CC BY 4.0.*
