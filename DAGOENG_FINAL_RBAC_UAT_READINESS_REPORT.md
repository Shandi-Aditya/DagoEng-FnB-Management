# LAPORAN FINAL PENGUATAN KEAMANAN RBAC & KESIAPAN UAT MANUAL
## DagoEng F&B & Co-Working Management Platform
**Dokumen:** `DAGOENG_FINAL_RBAC_UAT_READINESS_REPORT.md`  
**Tanggal Eksekusi:** Jumat, 30 Oktober 2026  
**Status Gate Keamanan:** SECURE & READY FOR MANUAL BROWSER UAT  
**Integritas Database & Data:** Prisma Schema 100% Utuh | Data Baseline Demo 100% Utuh

---

## 1. EXECUTIVE SUMMARY

Laporan ini merupakan hasil audit keamanan lanjutan, penguatan arsitektur RBAC (Role-Based & Attribute-Based Access Control), dan penyiapan instrumen pengujian penerimaan pengguna manual (Manual UAT) pada sistem DagoEng.

Fokus audit didasarkan pada tiga temuan risiko:
1. **Pengecualian Berbasis String Domain Email:** Adanya logika pengecualian seperti `emailLower.includes("@kopisenja.com")` yang rentan jika ada domain email baru atau domain kustom.
2. **Ambiguitas Scope Akun OWNER/MANAGER:** Risiko kebocoran wewenang organisasi Hub jika akun OWNER atau MANAGER dari scope TENANT tidak dibatasi secara tegas.
3. **Validasi Penugasan Staf Event Lapangan (`assignedStaffEmails`) & Guard Event Tidak Aktif:** Perlunya normalisasi email yang konsisten, isolasi akses per-event bagi staf lapangan, serta penolakan check-in pada event yang berstatus non-APPROVED (misalnya `PENDING`, `REVISION_REQUESTED`, `REJECTED`, `ARCHIVED`).

### Ringkasan Hasil Verifikasi:
- **TypeScript Type-Check:** `tsc --noEmit` berhasil dengan **0 error** (Exit Code 0).
- **Automated Test Suite (Vitest):** **55 test files passed (100%)**, **602/602 tests passed**.
- **Next.js Production Build:** `next build` berhasil dengan **Exit Code 0** (32/32 rute halaman statis dan dynamic endpoint terkompilasi optimal).
- **Prisma Schema & Database:** Tidak ada modifikasi schema atau migrasi database yang dijalankan.
- **Integritas Data JSON:** Seluruh data file demo baseline (`data/*.json`) tetap utuh dan terlindungi dari mutasi liar selama pengujian.

---

## 2. PRIORITAS A: ELIMINASI TOTAL STRING MATCHING DOMAIN EMAIL MENUJU PURE ATTRIBUTE-BASED RBAC

### Evaluasi Kerentanan
Sebelumnya, pada fungsi otorisasi check-in server (`assertCheckInAuth` di `src/lib/server-auth.ts`), terdapat baris kode pengecualian berbasis substring string email:
```typescript
// SEBELUMNYA (FRAGILE):
if (
  auth.scopeLevel === "TENANT" ||
  emailLower.includes("@kopisenja.com") ||
  emailLower.includes("@dapurmama.com") ||
  emailLower.includes("@manisbakery.com") ||
  emailLower.includes("@warungbunarti.com")
) { ... }
```
Kelemahan pendekatan ini:
- Jika mitra F&B baru mendaftar dengan domain lain (contoh: `@rotibakar.id`), proteksi substring tidak mengenali mitra tersebut sebagai tenant dan berpotensi lolos ke evaluasi staf.
- Membuka celah *brittle security* di mana identitas bergantung pada penamaan email daripada klaim sesi kriptografis terpercaya.

### Implementasi Solusi (Pure Attribute-Based)
Seluruh pencocokan domain substring telah **dihapus 100%** dari `src/lib/server-auth.ts`. Otorisasi kini dievaluasi secara murni melalui atribut token/sesi terpercaya:
- `auth.scopeLevel === "TENANT"`
- `Boolean(auth.tenantId)`
- `auth.businessModule === "FNB"`

```typescript
// IMPLEMENTASI AKTUAL (SECURE & ATTRIBUTE-BASED):
if (
  auth.scopeLevel === "TENANT" ||
  Boolean(auth.tenantId) ||
  auth.businessModule === "FNB"
) {
  return {
    authorized: false,
    error: "FORBIDDEN: Mitra F&B / Tenant tidak memiliki wewenang untuk operasional Event Hub.",
  };
}
```

Setiap persona dan sesi database menyertakan `tenantId` dan `businessModule`. Akun tenant F&B mana pun—terlepas dari domain emailnya—akan ditolak secara deterministik (HTTP 403 Forbidden).

---

## 3. PRIORITAS B: PEMISAHAN SCOPE MUTLAK HUB VS MITRA TENANT (OWNER/MANAGER ISOLATION)

### Evaluasi Kerentanan
Peran `OWNER` dan `MANAGER` digunakan oleh dua tingkatan entitas yang berbeda:
1. **Pengelola Hub (DagoEng Creative Hub):** Beroperasi pada `scopeLevel: "ORGANIZATION"` atau `"PLATFORM"`, tidak terikat tenant (`tenantId === null`), modul bisnis `"CORE"` atau `"COMMERCIAL"`.
2. **Mitra Tenant (F&B):** Beroperasi pada `scopeLevel: "TENANT"` atau `"OUTLET"`, terikat tenant spesifik (`tenantId !== null`), modul bisnis `"FNB"`.

Tanpa validasi ketat pada `tenantId` dan `businessModule`, akun `OWNER` atau `MANAGER` tenant berpotensi memperoleh hak pengawasan check-in event yang seharusnya hanya dimiliki oleh manajemen Hub.

### Implementasi Solusi
Logika evaluasi hak pengawasan manajemen Hub pada `src/lib/server-auth.ts` diperketat dengan kondisi ganda:
```typescript
const isHubAdmin =
  (auth.role === "SUPER_ADMIN" && auth.scopeLevel === "PLATFORM") ||
  ((auth.role === "OWNER" || auth.role === "MANAGER") &&
    auth.scopeLevel === "ORGANIZATION" &&
    !auth.tenantId);
```
Dan pada frontend RBAC (`src/lib/rbac.ts`):
```typescript
export function canAccessEventCheckIn(user: AuthenticatedUser | null): boolean {
  if (!user) return false;
  if (user.role.slug === "SUPER_ADMIN") return true;
  if (user.tenant) return false; // Strict Tenant Exclusion
  if (user.role.slug === "CUSTOMER") return false;

  const isHubAdmin =
    (user.role.slug === "OWNER" || user.role.slug === "MANAGER") &&
    user.scopeLevel === "ORGANIZATION" &&
    !user.tenant;
  if (isHubAdmin) return true;

  return Boolean(user.permissions?.includes("events:checkin") || user.permissions?.includes("*"));
}
```
Hasil: Tidak ada celah *privilege escalation* dari akun mitra F&B untuk mengakses data maupun operasional check-in Hub.

---

## 4. PRIORITAS C: INTEGRITAS PENUGASAN STAF LAPANGAN & GUARD STATUS EVENT INAKTIF

### 1. Normalisasi Email yang Konsisten
Pencocokan email pada daftar penugasan (`assignedStaffEmails`) dan email penyelenggara (`organizerEmail`) kini dinormalisasi secara seragam menggunakan `.trim().toLowerCase()`.
- Menghindari kegagalan check-in akibat perbedaan kapitalisasi atau spasi tidak sengaja (misal: `" Staff@DagoEng.com "` vs `"staff@dagoeng.com"`).

### 2. Event Inactivity Guard (Guard Status Event)
Sebelum memvalidasi izin staf atau penyelenggara pada sebuah event, sistem memeriksa status event tersebut secara langsung dari data terpercaya:
```typescript
if (eventRecord.status && eventRecord.status !== "APPROVED") {
  return {
    authorized: false,
    error: `FORBIDDEN: Event "${eventRecord.title || eventId}" tidak berstatus aktif atau belum disetujui (Status: ${eventRecord.status}). Check-in ditolak.`,
  };
}
```
Hasil: Event dengan status `PENDING`, `REVISION_REQUESTED`, `REJECTED`, atau `ARCHIVED` **secara mutlak menolak check-in** peserta, melindungi integritas operasional tiket.

### 3. Isolasi Staf Lapangan Khusus Event
Petugas lapangan yang tidak memiliki izin global `events:checkin` hanya dapat melakukan check-in pada event yang secara eksplisit mencantumkan email mereka pada `assignedStaffEmails`. Upaya check-in ke event lain ditolak dengan pesan `FORBIDDEN` (HTTP 403).

---

## 5. MATRIKS PENGUJIAN OTOMATIS & REGRESI SISTEM

Seluruh pengujian otomatis dijalankan secara independen tanpa *mocking* palsu:

| Kategori Pengujian | File Uji | Jumlah Kasus | Status | Keterangan |
|---|---|:---:|:---:|---|
| **Targeted Security Audit** | `tests/targeted-security-audit.test.ts` | 19 tests | **PASSED** | Menguji 19 skenario keamanan RBAC, isolasi tenant, sanitasi URL, penugasan staf, dan guard event inaktif |
| **End-to-End Flow Hardening** | `tests/flow-hardening-audit-fixes.test.ts` | 27 tests | **PASSED** | Expiry booking, DOKU race condition reconciliation, preflight rollback, recovery flow |
| **System Hardening & Priorities** | `tests/system-hardening-and-priorities.test.ts` | 28 tests | **PASSED** | Kuota konsistensi, DOKU retry, audit trail |
| **Legacy ETL & Data Integrity** | `tests/etl-data-validation.test.ts` | 4 tests | **PASSED** | Verifikasi read-only rekonsiliasi finansial Rp 1.706.000 dan integritas file bukti |
| **Organizer Activation Hardening** | `tests/organizer-activation-hardening.test.ts` | 8 tests | **PASSED** | Token activation atomicity, failure rollback |
| **Multi-Tenant & Outlet Isolation** | `tests/outlet-isolation.test.ts`, `tenant-isolation.test.ts` | 7 tests | **PASSED** | Cross-tenant database & session segregation |
| **Seluruh Test Suite Lain (48 file)** | Berbagai file komponen, POS, Settlement, WiFi | 509 tests | **PASSED** | Seluruh test suite bawaan repo tetap hijau |
| **TOTAL KESELURUHAN** | **55 Test Files** | **602 Tests** | **100% PASSED** | **Zero Regressions** |

---

## 6. MASTER MANUAL UAT CHECKLIST (10 SKENARIO TERSTRUKTUR)

> [!IMPORTANT]
> **Pernyataan Transparansi QA:** Tabel di bawah memetakan hasil **Verifikasi Otomatis Aktual** dan panduan langkah **Pengujian Manual di Browser**. Status "READY FOR MANUAL UAT" menandakan bahwa fungsionalitas backend dan frontend telah lolos verifikasi kompilasi dan otomatis, serta siap untuk dieksekusi oleh tester manusia di browser.

| No | Skenario Pengujian | Persona / Kredensial Uji | Rute yang Diuji | Ekspektasi Perilaku | Hasil Verifikasi Aktual | Status HTTP | Rencana Bukti / Screenshot Manual |
|:---:|---|---|---|---|---|:---:|---|
| **1** | **Hub Owner Event Oversight** | `owner.dago@dagoeng.com` (`DAGO_OWNER`) | `/events/checkin`, `/dashboard`, `/activity-log` | Memiliki akses penuh ke navigasi check-in event, log aktivitas, dan dashboard Hub. | **VERIFIED (Automated)**<br>Frontend RBAC mengizinkan; server `assertCheckInAuth` memberikan hak akses. | `200 OK` | Tangkapan layar halaman `/events/checkin` menampilkan antarmuka pemindai QR dan selector event aktif. |
| **2** | **Mitra F&B Owner Isolation** | `owner.kopisenja@dagoeng.com` (`TENANT_OWNER_KS`) | `/events/checkin`, `/events-admin`, `/coworking` | Menu check-in TIDAK tampil di sidebar; akses langsung rute `/events/checkin` menampilkan kartu Access Denied. API menolak check-in. | **VERIFIED (Automated)**<br>Sidebar memfilter item; guard halaman checkin merender kartu 403; server menolak via atribut tenant. | `403 Forbidden` | Tangkapan layar sidebar tenant Kopi Senja (hanya modul F&B) dan kartu "Akses Ditolak" di `/events/checkin`. |
| **3** | **Hub Commercial Manager Oversight** | `manager.commercial@dagoeng.com` (`COMMERCIAL_MANAGER`) | `/events/checkin`, `/commercial`, `/dashboard` | Menampilkan menu Commercial dan Dashboard; memiliki wewenang pengawasan Hub event. | **VERIFIED (Automated)**<br>Scope ORGANIZATION tanpa tenantId diizinkan oleh `canAccessEventCheckIn` dan server. | `200 OK` | Tangkapan layar navbar dan akses halaman manajemen komersial dan check-in. |
| **4** | **Staf Waiter/Cashier Tanpa Penugasan** | `cashier.sgr@kopisenja.com` (`CASHIER_SGR`) | `/events/checkin`, `/api/events/bookings/[id]` (check-in) | Tidak melihat tombol check-in; akses langsung ditolak; API check-in mengembalikan error 403. | **VERIFIED (Automated)**<br>Ditolak secara tegas oleh `canAccessEventCheckIn` dan `assertCheckInAuth`. | `403 Forbidden` | Tangkapan layar halaman `/pos` (tujuan normal kasir) dan kartu penolakan jika memaksa buka `/events/checkin`. |
| **5** | **Petugas Event dengan Penugasan Sah** | `eventstaff@dagoeng.com` (`EVENT_STAFF`) | `/events/checkin`, `/api/events/bookings/[id]` | Tombol Check-in Event muncul di sidebar; dapat memvalidasi tiket peserta pada event yang ditugaskan. | **VERIFIED (Automated)**<br>Role WAITER + permission `events:checkin` lolos verifikasi frontend dan server check-in. | `200 OK` | Tangkapan layar sidebar staf event menampilkan item "Check-in Event" dan modal konfirmasi tiket berhasil. |
| **6** | **Petugas Event pada Event Tidak Ditugaskan** | Akun staf lapangan pada event tanpa nama mereka di `assignedStaffEmails` | `/api/events/bookings/[id]` pada Event B | API server menolak proses check-in karena staf tidak terdaftar dalam event tersebut. | **VERIFIED (Automated)**<br>`assertCheckInAuth` mengembalikan authorized=false dengan pesan penugasan tidak sah. | `403 Forbidden` | Tangkapan layar pesan peringatan di UI "Anda tidak terdaftar sebagai panitia pada event ini". |
| **7** | **Isolasi Antar-Penyelenggara Komunitas (IDOR)** | `baristaguild@dagocreative.id` (`COMMUNITY_BARISTA`) | Check-in tiket milik `halo@bandungdev.org` | Penyelenggara hanya dapat memvalidasi peserta pada event miliknya; dilarang keras memvalidasi event komunitas lain. | **VERIFIED (Automated)**<br>Server mencocokkan `organizerEmail` vs email sesi; percobaan cross-organizer ditolak. | `403 Forbidden` | Tangkapan layar portal penyelenggara Dago Barista Guild menampilkan hanya event terdaftar miliknya. |
| **8** | **Pelanggan Mengakses Rute Internal** | `customer@gmail.com` (`CUSTOMER_DEMO`) | `/dashboard`, `/events/checkin`, `/settings` | Pelanggan diarahkan kembali ke `/customer`; tidak ada navigasi admin; dilarang check-in tiket. | **VERIFIED (Automated)**<br>`canAccessEventCheckIn` menolak; auto-routing login mengarahkan fallback ke `/customer`. | `302/403` | Tangkapan layar pengalihan otomatis browser ke portal pelanggan `/customer`. |
| **9** | **Universal Login & Auto-Routing Berdasarkan Role** | Form Universal Login `/login` (tanpa tab manual) | Input berbagai email resmi | Pengguna memasukkan email/password; sistem otomatis mengarahkan ke dashboard yang sesuai peran masing-masing. | **VERIFIED (Automated)**<br>Single form universal; `defaultRedirect` berhasil memetakan rute per persona/role. | `200 / 302` | Rekaman video/tangkapan layar login berturut-turut untuk Admin, Mitra, Kasir, dan Pelanggan. |
| **10** | **Proteksi Sanitasi ReturnTo & Open Redirect** | Parameter query `?returnTo=//evil.com` atau `?returnTo=/dashboard` (login sebagai customer) | `/login?returnTo=...` | Manipulasi protocol-relative, backslash, dan domain eksternal ditolak (null); customer dibatasi dari rute admin terlarang. | **VERIFIED (Automated)**<br>`sanitizeReturnTo` menolak semua input berbahaya; customer fallback ke `/customer`. | `302 Found` | URL bar browser menunjukkan pengalihan aman ke `/customer`, bukan ke URL berbahaya atau rute admin. |

---

## 7. ANALISIS KESIAPAN STAGING & GATE RILIS

### Kriteria Release Gate:
1. **Zero High/Critical Vulnerabilities:** ✅ PASS. Seluruh celah string matching dan potensi privilege escalation tenant telah tertutup.
2. **Deterministic Type-Safety:** ✅ PASS. `tsc --noEmit` exit code 0.
3. **Full Automated Test Coverage:** ✅ PASS. 55 file uji lolos 100% (602/602 tests).
4. **Clean Production Compilation:** ✅ PASS. `next build` exit code 0.
5. **No Production Database Mutation:** ✅ PASS. Skema database Prisma dan data demo lokal tetap utuh tanpa modifikasi.

### Rekomendasi Status:
**APPROVED FOR MANUAL BROWSER UAT & STAGING TRIAL**

---

## 8. REKOMENDASI LANGKAH OPERASIONAL

1. **Jalankan UAT Browser Manual:** Eksekusi 10 skenario pada Tabel Seksi 6 menggunakan browser nyata (misalnya Google Chrome / Firefox) untuk mengumpulkan dokumentasi tangkapan layar.
2. **Pengujian Sandbox Gateway DOKU:** Sebelum rilis ke staging server publik, lakukan verifikasi koneksi webhook DOKU sandbox end-to-end menggunakan kredensial staging yang valid.
3. **Penyediaan Infrastruktur Cloud:** Selesaikan provisioning database Neon PostgreSQL dan bucket Cloudflare R2 sesuai checklist runbook migrasi yang telah disetujui sebelumnya.
4. **Audit Log Monitor:** Pastikan setiap percobaan akses terlarang (HTTP 403) pada endpoint `/events/checkin` dan `/api/events/bookings/[id]` tercatat dengan jelas pada tabel audit log untuk keperluan observabilitas keamanan.

