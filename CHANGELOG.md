# Changelog

Semua perubahan penting pada proyek DagoEng F&B Management dicatat di dokumen ini.
Format pencatatan mengacu pada [Keep a Changelog](https://keepachangelog.com/id/1.0.0/) dan menganut [Semantic Versioning](https://semver.org/lang/id/).

---

## [Unreleased]

### Ditambahkan
- Penambahan verifikasi atomic booking tiket berbayar dan pelindung double-click pada alur pembayaran (S-33).
- Visualisasi sisa kuota slot coworking, label status "Lewat", dan pencegahan overbooking (S-35).

### Diperbaiki
- Rekonsiliasi shift tertunda, pembersihan transaksi uji, dan penegakan invariant kas (S-34).
- Penutupan celah kebocoran data anggota kasir, masking PII, sanitasi XSS struk PDF, dan pengetatan RBAC endpoint (S-32).

---

## [1.0.0] - 2026-11-23

Rilis stabil pertama untuk konsolidasi perbaikan operasional POS dan Modul Web Event (Task S-01 sampai S-16) pasca-penggabungan Merge Request !25 ke cabang `develop`.

### Ditambahkan
- **Tiket Bertingkat / Multi-Tier (S-12)**: Dukungan multi-tier tiket pada satu event (Early Bird, Presale, Reguler, VIP) dengan kuota mandiri, nominal harga tersendiri, dan jendela waktu penjualan masing-masing.
- **Kode Promo dan Tiket Undangan (S-13)**: Penerbitan kode promo berbasis potongan persentase atau nominal rupiah serta tiket undangan gratis (*complimentary pass*) untuk media partner dan tamu VIP dengan penanda visual khusus.
- **Kebijakan Refund Fleksibel (S-14)**: Pengaturan kebijakan refund per event (dapat diajukan hingga H-3 acara atau non-refundable), pemotongan biaya administrasi, dan pelacakan status persetujuan refund admin.
- **Dashboard Penjualan Penyelenggara (S-15)**: Dasbor analitik khusus organizer untuk memantau ringkasan omzet kotor, sisa kuota tiket per tier, serta rekapitulasi kehadiran check-in secara langsung.
- **Sentralisasi Kontak CS WhatsApp Resmi (S-04)**: Sentralisasi kontak layanan pelanggan resmi (+62 821-1550-1995) pada satu konstanta konfigurasi dan eliminasi nomor contoh lama di seluruh halaman katalog, landing, dan tiket.
- **Pengiriman E-Tiket Otomatis via Email (S-08)**: Dispatcher pengiriman otomatis berkas e-tiket dan kode QR ke email pemesan setelah transaksi diverifikasi lunas, mendukung transport SMTP, Resend, dan SendGrid.
- **Dokumentasi Serah Terima & Regression Test Suite (S-16)**: Integrasi 20 file uji otomatis inti Web Event (377 skenario uji) ditambah 4 file uji pendukung POS/CRM/Coworking (50 skenario uji) dengan tingkat kelulusan 100% pada seluruh 24 file uji modul terkait (di luar 4 file baseline warisan yang tercatat pada `AGENTS.md`).

### Diubah
- **Standarisasi Coworking WITA dan Nota Resmi (S-10)**: Penyelarasan tanggal transaksi booking coworking ke zona waktu WITA (`Asia/Makassar`), format struk thermal 80mm monokrom beralamat resmi Dago Creative Hub Singaraja, dan standarisasi tarif pajak non-PB1.
- **Konsistensi Laporan Penjualan dan Margin (S-11)**: Agregasi menu terlaris, pendapatan kotor, dan margin operasional disaring secara ketat hanya dari transaksi yang telah berstatus `PAID` (lunas).
- **Pembatasan Waktu Meja Check-in (S-06)**: Restriksi meja registrasi `/events/checkin` agar hanya menampilkan dan menerima pemindaian tiket untuk event yang berlangsung pada hari ini (WITA).
- **Arsitektur Rilis dan Server Staging (S-31)**: Pemisahan branch `develop` khusus server Staging dengan database terisolasi dan branch `main` khusus server Produksi dengan siklus rilis terjadwal setiap Senin.

### Diperbaiki
- Perbaikan deadlock validasi harga pada formulir pengajuan event multi-tier berbayar.
- Penanganan error sinkronisasi poin loyalitas saat kasir POS memproses transaksi member dengan kenaikan tier otomatis.
- Sinkronisasi sisa kuota event terhadap reservasi pending yang masih aktif dalam batas waktu pembayaran 60 menit.

### Keamanan
- **Proteksi Rekening Resmi Penampung Event (S-01)**: Pengamanan *fail-closed* di backend (`src/lib/events.ts`) yang otomatis menolak pesanan tiket berbayar jika rekening resmi belum dikonfigurasi, mencegah kebocoran dana ke rekening demo.
- **Pembersihan Data Uji Aman (S-02)**: Mekanisme pembersihan event dan tiket uji dengan validasi *Compare-And-Swap (CAS)* berbasis `updatedAt` untuk mencegah konflik konkurensi data antar-admin.
- **Validasi Ketat Harga dan Kuota (S-03)**: Validasi harga tiket berupa bilangan bulat positif rupiah, pembatasan kuota dalam batas aman integer, dan larangan role petugas check-in mengajukan event baru.
- **Pemulihan Kode Booking Aman via Email (S-05)**: Penutupan celah kebocoran guest token publik; pemulihan tautan e-tiket yang hilang dialihkan melalui tautan privat ke email terdaftar.
- **Isolasi Hak Akses Kasir & Rekonsiliasi Tier Member (S-09)**: Penyamaran nomor HP, email, dan NIK pelanggan dari antarmuka kasir serta pembatasan mutasi poin ilegal dari role non-kasir.
- **Proteksi Pemindaian Ganda Check-in (S-07)**: Pencegahan scan QR tiket berulang pada sub-tiket yang telah tercatat hadir pada event berbayar end-to-end.

[Unreleased]: https://gitlab.com/devdagoeng/dagoeng-management/compare/v1.0.0...develop
[1.0.0]: https://gitlab.com/devdagoeng/dagoeng-management/-/releases/v1.0.0
