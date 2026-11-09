# **QA Handover POS DagoEng — Temuan & Rekomendasi Improvement**

# **1\. Pendahuluan & Cara Pengujian**

Dokumen ini adalah catatan serah terima modul POS DagoEng yang berisi hasil pengujian: fitur yang berfungsi, kendala/bug, dan rekomendasi perbaikan.

* **Prioritas:** Masalah telah diurutkan dari yang paling krusial. Jika waktu terbatas, utamakan **Bagian A** yang berdampak pada integritas keuangan, kas, dan pajak.  
* **Kode Kode Masalah:** Setiap temuan memiliki kode unik (contoh: `POS-32`) yang tersinkronisasi dengan dokumen *Test Case*.  
* **Metode Pengujian:** Pengujian dilakukan melalui berbagai role akun (*Super Admin, Owner, Owner Tenant, Kasir, Kitchen, Waiter*) serta menjalankan transaksi simulasi langsung (*ORD-POS-5612*, Rp 56.350, tunai) pada 6 Nov 2026\.

## **Gambaran Singkat Sistem**

POS digunakan oleh Dago Creative Hub di Singaraja yang menaungi multi-mitra F\&B (Kopi Senja, Dapur Mama, Manis Bakery, Warung Bu Narti) dan sewa ruang co-working. Satu transaksi kasir dapat mencakup gabungan menu dari berbagai mitra dan layanan sewa ruang.

# **2\. Fitur yang Sudah Berjalan dengan Baik**

*Harap menjaga keberfungsian fitur-fitur berikut agar tidak terdampak perubahan (regression):*

* **Kasir:** Pemilihan menu, varian, catatan, kalkulasi harga varian, serta perhitungan kembalian tunai.  
* **Sistem Promo:** Penolakan otomatis transaksi yang belum memenuhi batas minimum belanja.  
* **Struk & Pesanan:** Struk gabungan menampilkan subtotal per mitra; pesanan masuk ke KDS dengan status real-time; meja otomatis terisi setelah pemesanan.  
* **Inventaris & Audit:** Settlement mitra membagi per tenant; stok bahan terpotong otomatis sesuai resep (cth: croissant); Audit Trail mencatat aktivitas pembayaran, poin, status meja, dan approval event.

# **3\. Temuan & Rekomendasi Perbaikan**

## **Bagian A — Wajib Beres Dulu (Prioritas Utama)**

### **A1. Shift Kasir Terbuka Otomatis dan Jatuh ke Akun yang Salah (`POS-01`, `POS-02`, `POS-32`)**

* **Kondisi Saat Ini:** Setiap akun yang login otomatis membuka shift kasir yang tidak pernah ditutup.  
* **Dampak:** Akuntabilitas uang kas di laci hilang, laporan kas per shift tidak valid.  
* **Solusi/Ekspektasi:** Hapus fitur buka shift otomatis. Kasir wajib membuka shift manual dengan modal awal; 1 shift terikat pada 1 kasir; berikan penutupan otomatis "Perlu Rekonsiliasi" jika melebihi batas waktu.

### **A2. Data Lama Hilang / Resets (`POS-33`)**

* **Kondisi Saat Ini:** Riwayat audit trail, shift, dan booking co-working hilang ter-reset (diduga tersimpan di memori sementara).  
* **Dampak:** Data tidak dapat diaudit dan potensi hilangnya pencatatan transaksi keuangan.  
* **Solusi/Ekspektasi:** Simpan seluruh transaksi, shift, booking, poin, dan audit trail secara permanen di database (*append-only* untuk audit trail).

### **A3. Ketidaksesuaian Perhitungan Pajak pada Laporan vs Struk (`POS-34`)**

* **Kondisi Saat Ini:** Struk mencatat PB1 Rp 4.900 & Service Rp 2.450, namun laporan menghitung ulang dari nilai nett sehingga menghasilkan PB1 Rp 5.635 & Service Rp 2.818.  
* **Dampak:** Penyetoran pajak menjadi salah.  
* **Solusi/Ekspektasi:** Simpan nilai pajak dan service final saat pembayaran dilakukan; laporan cukup menjumlahkan nilai tersimpan.

### **A4. Verifikasi Manual Pembayaran QRIS oleh Kasir (`POS-25`)**

* **Kondisi Saat Ini:** QRIS menampilkan placeholder QR dan tombol yang memungkinkan kasir menandai lunas secara manual.  
* **Dampak:** Risiko klaim lunas tanpa ada uang masuk.  
* **Solusi/Ekspektasi:** Ubah status lunas hanya via callback webhooks payment gateway, atau gunakan QRIS statis dengan otorisasi manual supervisor.

### **A5. Implements Otentikasi dan Akses Server-Side Rendah (`POS-21`, `POS-22`, `POS-23`)**

* **Kondisi Saat Ini:** Hak akses hanya disembunyikan di UI client-side. Akun non-kasir dapat membuka POS Kasir via URL langsung.  
* **Solusi/Ekspektasi:** Terapkan verifikasi role di sisi server (*backend RBAC*), pisahkan role Petugas Check-In dengan Waiter, dan atur *session expiration*.

### **A6. Identitas & Penerbit Struk Tidak Sesuai (`POS-03`)**

* **Kondisi Saat Ini:** Struk co-working tercetak atas nama "Outlet: Kopi Senja", dan alamat tidak konsisten dengan data pusat.  
* **Solusi/Ekspektasi:** Dinamiskan penerbit struk berdasarkan pemilik produk/jasa serta sesuaikan master data lokasi.

## **Bagian B — Penting (Kerjakan Setelah Bagian A)**

* **B1. Tombol Bayar Ganda (`POS-26`):** Tombol bayar masih tampil pada pesanan yang berstatus LUNAS.  
* **B2. Formulasi Pajak & Service Charge (`POS-11`, `POS-27`):** Buat fungsi terpusat untuk kalkulasi PB1 dan service charge.  
* **B3. Perhitungan Bagi Hasil Mitra (`POS-35`):** Bagi hasil mitra (85/15) dihitung dari harga bruto (termasuk pajak). Harusnya dari DPP (sebelum pajak).  
* **B4. Pengurangan Stok/BOM (`POS-36`):** Resep produk minuman (Kopi Senja Aren) belum memotong stok bahan baku.  
* **B5. Sinkronisasi Ringkasan Dashboard (`POS-04` s/d `POS-37`):** Dashboard menampilkan data \$0, menggabungkan tiket event secara penuh, dan tanggal header *hardcoded*.  
* **B6. Sinkronisasi Poin & Member CRM (`POS-08`, `POS-09`, `POS-28`):** Poin member kasir dan CRM tidak sinkron serta terjadi data ganda.  
* **B7. Routing Pesanan KDS & Catatan Stasiun (`POS-38`, `POS-39`):** Tiket KDS tercampur antar-mitra dan catatan khusus dari kasir tidak muncul di layar dapur.  
* **B8. Konfigurasi Pajak Co-Working (`POS-07`):** Sediakan pengaturan tipe pajak fleksibel per kategori produk.

## **Bagian C — Perbaikan Menengah**

* Pemetaan grup varian khusus per kategori/produk (mencegah pilihan level gula pada croissant \- `POS-13`).  
* Hilangkan *default selection* Meja T-01 untuk mencegah salah pencatatan (`POS-14`).  
* Kosongkan input nominal bayar tunai (mencegah *auto-fill* uang pas \- `POS-29`).  
* Sembunyikan password Wi-Fi statis pada struk (`POS-30`).  
* Lengkapi log Audit Trail untuk aksi *void, refund, discount,* dan *closing shift* (`POS-15`).  
* Batasi akses laporan keuangan/nominal pada akun Kitchen (`POS-16`) dan bersihkan tombol Demo Mode (`POS-17`).

## **Bagian D — Perbaikan Minor UI/UX**

* Ganti *checkbox* varian level gula menjadi *radio button* (`POS-12`).  
* Tambahkan *fallback image* untuk gambar produk yang rusak (`POS-18`).  
* Perbaiki pemotongan nama profil pengguna pada dashboard (`POS-19`).  
* Bersihkan data dummy outlet Denpasar/Ubud (`POS-20`).  
* Tampilkan alasan dan perkiraan waktu untuk status "Tutup Sementara" (`POS-24`, `POS-31`).  
* Perbaiki penomoran status antrean KDS (`POS-40`).

# **4\. Usulan Matriks Hak Akses (RBAC)**

| Aksi / Modul | Super Admin | Owner Dago | Owner Tenant | Kasir | Kitchen | Waiter | Petugas Check-In | Customer |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| **Buka Halaman Kasir** | Ya | Ya | Ya (Mitra) | Ya | Tidak | Tidak | Tidak | Tidak |
| **Buat & Bayar Transaksi** | Ya | Ya | Ya (Mitra) | Ya | Tidak | Tidak | Tidak | Tidak |
| **Buka & Tutup Shift** | Ya | Ya | Tidak | Ya (Miliknya) | Tidak | Tidak | Tidak | Tidak |
| **Void & Refund** | Ya | Ya | Persetujuan | PIN Supervisor | Tidak | Tidak | Tidak | Tidak |
| **Layar Dapur (KDS)** | Ya | Ya | Ya (Mitra) | Lihat Saja | Ya | Lihat Saja | Tidak | Tidak |
| **Layar Waiter** | Ya | Ya | Tidak | Ya | Tidak | Ya | Tidak | Tidak |
| **Check-in Event** | Ya | Ya | Tidak | Tidak | Tidak | Tidak | Ya | Tidak |
| **Ekspor Laporan Nominal** | Ya | Ya | Ya (Mitra) | Tidak | Tidak | Tidak | Tidak | Tidak |
| **Lihat Data Mitra Lain** | Ya | Ya | Tidak | Tidak | Tidak | Tidak | Tidak | Tidak |

# **5\. Data Uji (Test Data) yang Perlu Dibersihkan**

1. Transaksi `ORD-POS-5612` / Struk `INV-20261106-4389` (Rp 56.350, Member Ketut Dian, Meja T-02).  
2. Shift aktif gantung atas nama *Barista Community Bandung* (sejak 5 Nov 14.58).  
3. Koreksi saldo poin Ketut Dian (56 Pts) dan penyesuaian stok bahan *Dough Croissant* (-0,1 pack).

*Dokumen acuan pengujian lengkap: **Test Case POS DagoEng — Regression Checklist** (63 Skenario Uji)*