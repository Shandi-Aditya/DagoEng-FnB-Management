# Dokumen Hasil Pengujian End-to-End Siklus Event Berbayar (Task S-07)

- **ID Task**: S-07
- **Modul**: Web Event
- **Nama Penguji**: Shandy
- **Tanggal Pengujian**: 16 November 2026
- **Cabang / Branch**: `shandi-dev`
- **File Uji Otomatis**: `tests/paid-event-e2e.test.ts`
- **Hasil Uji**: **PASSED (13/13 Skenario Lulus)**
- **Dependensi Terkait**: Task S-01 (Rekening Resmi Event Dago Creative Hub)

---

## 1. Tujuan Pengujian

Menguji dan memvalidasi keutuhan alur transaksi event berbayar dari awal hingga akhir (*end-to-end*):
1. Pengamanan rekening penampung resmi (bukan nomor demo/placeholder).
2. Pemesanan tiket berbayar dan pembuatan kode booking.
3. Unggah bukti transfer pembayaran oleh pemesan.
4. Verifikasi dan persetujuan pembayaran oleh admin.
5. Aktivasi e-tiket dan pembagian kode sub-tiket per peserta.
6. Check-in lapangan pada hari acara sesuai jendela waktu operasional WITA.
7. Pencegahan pemindaian duplikat (*anti-duplicate scan*) per sub-tiket.

---

## 2. Matriks Hasil Pengujian (Test Matrix)

| ID Test Case | Tahapan / Deskripsi | Data Uji | Ekspektasi | Hasil Aktual | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-S07-01A** | Validasi Rekening Resmi (*Fail-Closed Guard*) | Rekening default: `000011223344` (Akun Demo) | Sistem menolak pemesanan tiket berbayar dengan pesan kendala rekening resmi | Error dilempar: `PEMBAYARAN_TERKENDALA` | **PASS** |
| **TC-S07-01B** | Validasi Rekening Resmi (Rekening Valid) | Rekening: `135002938411` an PT DAGO KREATIF MANDIRI (BCA) | Pemesanan diterima; snapshot rekening resmi tersimpan di data booking | Booking tersimpan dengan snapshot rekening resmi | **PASS** |
| **TC-S07-02** | Pemesanan Tiket Berbayar (*Order Creation*) | Event: Singaraja Jazz Night 2026, Jumlah: 2 Tiket @ Rp 150.000 | Status `PENDING`, metode `MANUAL_TRANSFER`, total `Rp 300.000`, kode tiket terbit | Status `PENDING`, Total Rp 300.000, Tiket `DAGO-EVT-...` | **PASS** |
| **TC-S07-03A** | Unggah Bukti Pembayaran | URL bukti transfer valid + Catatan pembayaran | Bukti tersimpan, timestamp unggah tercatat, status tetap `PENDING` | `paymentProofUrl` & `paymentProofUploadedAt` terisi | **PASS** |
| **TC-S07-03B** | Validasi Bukti Pembayaran Kosong | String spasi/kosong pada URL bukti transfer | Permintaan ditolak dengan pesan validasi | Ditolak dengan pesan: `URL atau data bukti transfer tidak valid` | **PASS** |
| **TC-S07-04A** | Verifikasi & Persetujuan Admin (*Approval*) | Aksi: Admin menyetujui transfer Rp 300.000 | Status pembayaran menjadi `PAID`, catatan verifikasi dan nama verifikator tercatat | Status `PAID`, `paymentVerifiedBy` & `paymentVerifiedAt` tersimpan | **PASS** |
| **TC-S07-04B** | Idempotensi Persetujuan Admin | Pemanggilan persetujuan kedua kali untuk pesanan yang sama | Sistem mengembalikan data yang sudah lunas tanpa error dan tanpa duplikasi | Mengembalikan status `PAID` secara aman | **PASS** |
| **TC-S07-05A** | Penguraian Sub-Tiket Rombongan | Tiket rombongan (2 pax): `-01` dan `-02` | Kode booking diurai menjadi sub-tiket independen per kursi/peserta | Kursi 1 terurai sebagai `-01`, Kursi 2 sebagai `-02` | **PASS** |
| **TC-S07-05B** | Pencegahan Check-in Tiket Belum Lunas | Tiket dengan status pembayaran `PENDING` | Validasi check-in gagal dengan kode `UNPAID` | Validasi mengembalikan `valid: false, code: "UNPAID"` | **PASS** |
| **TC-S07-06A** | Pembatasan Waktu Operasional Check-in | Waktu simulasi: 20 Des 2026 (H-1 sebelum acara 21 Des 2026) | Check-in ditolak karena meja check-in belum dibuka (buka H-2 jam WITA) | Ditolak: `Meja check-in belum dibuka untuk event...` | **PASS** |
| **TC-S07-06B** | Check-in Sub-Tiket Pertama pada Jam Operasional | Waktu simulasi: 21 Des 2026 09:30 WITA, Sub-tiket: `-01` | Check-in berhasil, status kehadiran berubah menjadi `PARTIALLY_CHECKED_IN` (1/2 hadir) | Status `PARTIALLY_CHECKED_IN`, `checkedInQty: 1`, `seats: [1]` | **PASS** |
| **TC-S07-07A** | Penolakan Pemindaian Ulang Sub-Tiket yang Sama | Pemindaian kedua untuk sub-tiket `-01` | Pemindaian kedua ditolak dengan pesan sudah check-in; total kehadiran tetap 1 | Ditolak: `sudah digunakan untuk check-in sebelumnya`; kehadiran tetap 1 | **PASS** |
| **TC-S07-07B** | Pemindaian Sub-Tiket Kedua & Penyelesaian Rombongan | Pemindaian sub-tiket `-02`, dilanjutkan pemindaian ulang `-02` | Tiket `-02` berhasil (2/2 hadir, status `CHECKED_IN`); pemindaian ulang `-02` ditolak | Status `CHECKED_IN`, `checkedInQty: 2`, scan ulang kedua ditolak | **PASS** |

---

## 3. Log Eksekusi Uji Otomatis

```bash
> node ./node_modules/vitest/vitest.mjs run tests/paid-event-e2e.test.ts

 RUN  v2.1.9 D:/Magang Shandi/dagoeng-shandi-dev

 ✓ tests/paid-event-e2e.test.ts (13 tests) 426ms
   ✓ Tahap 1: Validasi Rekening Resmi (Official Bank Guard) (2 tests)
   ✓ Tahap 2: Pemesanan Tiket Berbayar (Order Creation) (1 test)
   ✓ Tahap 3: Unggah Bukti Pembayaran (Payment Proof Upload) (2 tests)
   ✓ Tahap 4: Verifikasi & Persetujuan Admin (Admin Approval) (2 tests)
   ✓ Tahap 5: Aktivasi E-Tiket & Struktur Sub-Tiket Rombongan (2 tests)
   ✓ Tahap 6: Check-in di Hari Acara (WITA Window Enforcement) (2 tests)
   ✓ Tahap 7: Pencegahan Pemindaian Duplikat (Duplicate Scan Guard) (2 tests)

 Test Files  1 passed (1)
      Tests  13 passed (13)
```

---

## 4. Panduan Verifikasi Visual / Manual untuk Pengguna

> [!NOTE]
> Sesuai aturan `AGENTS.md`, agen dilarang melakukan aksi browser yang memicu penulisan data di database Neon produksi. Cek visual belum dilakukan oleh agen di antarmuka web langsung. Berikut adalah panduan langkah manual bagi operator / penguji manusia untuk memverifikasi visual di browser.

### Langkah Uji Visual:
1. **Halaman Detail Event Berbayar** (`/events/[id]`):
   - Buka event berbayar aktif.
   - Pastikan informasi rekening resmi menampilkan Bank BCA, Nomor Rekening `135002938411`, dan Nama Pemilik `PT DAGO KREATIF MANDIRI`.
2. **Pemesanan & Unggah Bukti**:
   - Lakukan pemesanan tiket (misal 2 tiket).
   - Di halaman detail pembayaran, pastikan tombol unggah bukti pembayaran aktif dan menampilkan status **Menunggu Verifikasi Pembayaran**.
3. **Portal Admin Keuangan** (`/events/admin`):
   - Masuk sebagai Admin.
   - Buka tab verifikasi pembayaran tiket.
   - Periksa bukti transfer yang diunggah peserta, lalu tekan tombol **Verifikasi Pembayaran (Setujui)**.
   - Pastikan badge status tiket berubah menjadi **Lunas (PAID)** dengan latar hijau.
4. **Halaman E-Tiket Peserta** (`/events/tickets/[token]`):
   - Buka tautan e-tiket peserta.
   - Pastikan QR Code aktif dan muncul badge **Tiket Aktif / Siap Digunakan**.
   - Periksa bahwa untuk pesanan 2 tiket, terdapat 2 kartu sub-tiket (`-01` dan `-02`).
5. **Meja Check-in Lapangan** (`/events/checkin`):
   - Buka meja check-in pada hari acara (WITA).
   - Pastikan event hari ini terpilih dengan badge `Hari ini (WITA)`.
   - Gunakan fitur scanner kamera atau masukkan kode tiket `-01`.
   - Pastikan muncul notifikasi sukses hadir (1/2 hadir).
   - Masukkan kembali kode `-01`. Pastikan muncul peringatan merah bahwa tiket sudah digunakan dan jumlah kehadiran tidak bertambah.
