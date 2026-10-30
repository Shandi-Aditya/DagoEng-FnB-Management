# DAGOENG — TARGETED SECURITY AUDIT & RBAC HARDENING REPORT
**Topik:** Universal Login, Auto-Routing & Event Check-in RBAC Hardening  
**Tanggal Eksekusi:** Jumat, 30 Oktober 2026  
**Status Audit:** PASSED & VERIFIED (55/55 TEST FILES, 600/600 TESTS PASSING, BUILD EXIT CODE 0)  
**Tingkat Keamanan:** Level Produksi Terisolasi (Production-Grade Scope & Persona Isolation)

---

## 1. TEMUAN AUDIT (AUDIT FINDINGS)

Berdasarkan audit mendalam terhadap implementasi RBAC, alur login, dan mekanisme check-in event, ditemukan beberapa potensi celah keamanan yang telah berhasil dievaluasi dan dikoreksi:

### A. Potensi Privilege Escalation pada Staf F&B (WAITER & CASHIER)
- **Kondisi Sebelum Perbaikan:**
  Pada fungsi `canAccessEventCheckIn()` (`src/lib/rbac.ts`) dan `assertCheckInAuth()` (`src/lib/server-auth.ts`), terdapat aturan permisif:
  ```typescript
  // Aturan permisif lama:
  if ((user.role.slug === "WAITER" || user.role.slug === "CASHIER") && user.scopeLevel === "ORGANIZATION" && !user.tenant) {
    return true;
  }
  ```
  Pada sisi API backend `assertCheckInAuth()`:
  ```typescript
  const isFieldStaff = auth.role === "CASHIER" || auth.role === "WAITER";
  if (isFieldStaff) return { authorized: true, isFieldOfficer: true };
  ```
- **Risiko Keamanan:**
  Seluruh staf waiter atau kasir F&B secara otomatis memperoleh wewenang check-in peserta dan melihat operasional event hub, meskipun mereka tidak ditugaskan sebagai panitia event atau tidak memiliki izin operasional event (`events:checkin`).
- **Tindakan Korektif:**
  Aturan permisif otomatis berbasis role/scope telah **DIHAPUS TOTAL**. Staf lapangan (termasuk waiter/kasir) **WAJIB** memiliki permission eksplisit `events:checkin` atau terdaftar dalam `assignedStaffEmails` pada event terkait. Staf F&B biasa tanpa penugasan event ditolak secara tegas (HTTP 403 Forbidden).

### B. Proteksi Halaman Frontend Check-in Event (`/events/checkin`)
- **Kondisi Sebelum Perbaikan:**
  Halaman `src/app/events/checkin/page.tsx` sebelumnya hanya menyaring event di dalam memori tanpa memblokir perenderan UI jika pengguna tidak berhak (misal: Customer atau Tenant Owner yang mengetik URL langsung).
- **Tindakan Korektif:**
  Halaman `/events/checkin` kini mengimpor `canAccessEventCheckIn(user)`. Jika pengguna tidak berhak, halaman menghentikan request data dan langsung merender kartu peringatan **"Akses Terbatas: Check-in Event"** dengan opsi kembali ke dashboard kerja masing-masing.

### C. Bypass Open Redirect Melalui Manipulasi Backslash (`\`)
- **Kondisi Sebelum Perbaikan:**
  Fungsi `sanitizeReturnTo()` memeriksa awalan `/` dan melarang `//` atau `/\\`, namun belum secara tegas menolak karakter backslash di bagian tengah URL (seperti `/\attacker.com` atau `/\malicious`).
- **Tindakan Korektif:**
  Ditambahkan aturan `!trimmed.includes("\\")`. Seluruh varian injeksi backslash ditolak secara mutlak (mengembalikan `null`).
  Daftar rute internal terlarang bagi role `CUSTOMER` (`isRestrictedAdminRoute`) diperluas untuk mencakup `/events/checkin`, `/events/portal`, `/commercial`, `/tables`, `/inventory`, `/customers`, dan `/activity-log`. Jika Customer mencoba memanfaatkan parameter `returnTo`, sistem otomatis memaksa redirect ke `/customer`.

### D. Audit Trail & Log Terbuka untuk Tenant
- **Kondisi Sebelum Perbaikan:**
  Rute navigasi `/activity-log` belum memiliki `minScope: "ORGANIZATION"`, sehingga Tenant Owner berpotensi melihat menu log audit global platform.
- **Tindakan Korektif:**
  Ditambahkan `minScope: "ORGANIZATION"` pada `/activity-log` di `ALL_NAV_ITEMS`. Tenant Owner (scope `TENANT`) tidak lagi melihat menu audit log platform.

---

## 2. FILE YANG DIPERIKSA DAN DIUBAH

| File Path | Status | Deskripsi Perubahan |
| :--- | :---: | :--- |
| `src/types/auth.ts` | **Diubah** | Menambahkan `EVENT_STAFF` ke dalam union type `PersonaKey`. |
| `src/lib/rbac.ts` | **Diubah** | Menghapus aturan otomatis WAITER/CASHIER di `canAccessEventCheckIn()`, menambahkan pengecekan strict CUSTOMER, menambahkan `minScope: "ORGANIZATION"` pada `/activity-log`, dan mendaftarkan `/commercial` ke `ALL_NAV_ITEMS`. |
| `src/lib/server-auth.ts` | **Diubah** | Menambahkan properti `permissions?: string[]` pada `ServerAuthResult`, memperbarui `TRUSTED_PERSONAS` dengan daftar permission eksplisit dan persona `EVENT_STAFF`, memperbarui `assertCheckInAuth()` untuk memvalidasi strict tenant exclusion, event assignment, dan explicit permission. |
| `src/contexts/AuthContext.tsx` | **Diubah** | Menambahkan profil `EVENT_STAFF` ke dalam `DEMO_PERSONAS` dengan permission `["events:checkin"]`. |
| `src/app/(auth)/login/page.tsx` | **Diubah** | Memperkuat sanitasi `returnTo` terhadap manipulasi backslash (`\`) dan memperluas daftar rute terlarang untuk Customer. |
| `src/app/events/checkin/page.tsx` | **Diubah** | Menambahkan pemeriksaan `canAccessEventCheckIn(user)` di level render halaman; merender halaman akses ditolak jika unauthorized; memperketat query event. |
| `src/app/page.tsx` | **Diubah** | Membersihkan tag sintaks penutup duplikat pada akhir berkas. |
| `tests/targeted-security-audit.test.ts` | **Baru** | Menambahkan 17 automated security test cases untuk memverifikasi seluruh skenario penolakan dan pengizinan. |
| `tests/flow-hardening-audit-fixes.test.ts` | **Diubah** | Menambahkan isolasi fixture `beforeAll` & `afterAll` agar restore data baseline `data/event_bookings.json` selalu terjaga. |
| `tests/system-hardening-and-priorities.test.ts` | **Diubah** | Menambahkan isolasi fixture `beforeAll` & `afterAll` untuk melindungi integritas berkas booking baseline. |

---

## 3. PERMISSION MATRIX SEBELUM DAN SESUDAH

| Role / Persona | Scope | Modul Utama | Hak Check-in Event (SEBELUM) | Hak Check-in Event (SESUDAH) | Dasar Kebijakan Keamanan |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **SUPER_ADMIN** | `PLATFORM` | Universal | ✅ Ya | ✅ Ya | Hak pengawasan penuh platform sentral. |
| **OWNER Hub (DagoEng)** | `ORGANIZATION` | `CORE` | ✅ Ya | ✅ Ya | Hak administratif pengelola tempat dan event hub. |
| **MANAGER Hub** | `ORGANIZATION` | `CORE` | ✅ Ya | ✅ Ya | Pengawasan operasional hub dan komunitas. |
| **OWNER Tenant (Mitra F&B)**| `TENANT` | `FNB` | ❌ Ditolak | ❌ **Ditolak** | Mitra F&B dilarang mengintervensi event hub. |
| **WAITER Hub (Tanpa Permission)** | `ORGANIZATION` | `FNB` | ⚠️ **Bocor (Ya)** | ❌ **DITOLAK (403)** | Staf F&B tanpa penugasan dilarang akses event. |
| **CASHIER Hub (Tanpa Permission)**| `ORGANIZATION` | `FNB` | ⚠️ **Bocor (Ya)** | ❌ **DITOLAK (403)** | Kasir F&B tanpa penugasan dilarang akses event. |
| **Event Staff / Panitia** | `ORGANIZATION` | `CORE` | ⚠️ Tidak Spesifik | ✅ **DIIZINKAN** | Memiliki izin eksplisit `events:checkin` atau `assignedStaffEmails`. |
| **Organizer (Event Sendiri)** | `TENANT`/Org | `EVENTS` | ✅ Ya | ✅ **DIIZINKAN** | Berhak check-in hanya untuk event yang dia selenggarakan. |
| **Organizer (Event Lain)** | `TENANT`/Org | `EVENTS` | ❌ Ditolak | ❌ **DITOLAK (403)** | Pencegahan IDOR antarkomunitas. |
| **CUSTOMER** | `OUTLET`/Org | `CUSTOMER` | ❌ Ditolak | ❌ **Ditolak (403)** | Pelanggan dilarang mengakses operasional internal. |

---

## 4. HASIL PENGUJIAN PER ROLE

Pengujian otomatis dilakukan melalui rangkaian pengujian Vitest pada `tests/targeted-security-audit.test.ts` (17 tests) dan integrasi:

1. **WAITER & CASHIER Organisasi (Tanpa Permission Event)**:
   - *Frontend Test:* `canAccessEventCheckIn(waiterUser)` mengembalikan `false`. `getAuthorizedNavItems()` tidak menyertakan rute `/events/checkin`.
   - *Backend Test:* Permintaan HTTP ke API check-in mengembalikan **HTTP 403 Forbidden** (`FORBIDDEN: Staf [WAITER] tidak memiliki penugasan atau izin check-in pada event ini`).
   - *Status:* **PASSED**.

2. **Event Staff / Petugas Lapangan Terakreditasi**:
   - *Frontend Test:* Pengguna dengan permission `events:checkin` melihat item "Check-in Event" pada sidebar navigasi.
   - *Backend Test:* `assertCheckInAuth()` mengembalikan `authorized: true` dan menandai `isFieldOfficer: true`.
   - *Status:* **PASSED**.

3. **Event Staff dengan Penugasan Spesifik (`assignedStaffEmails`)**:
   - *Backend Test:* Staff yang email-nya terdaftar di `assignedStaffEmails` pada metadata event diizinkan melakukan check-in pada event tersebut, namun ditolak saat mencoba check-in pada event yang tidak menugaskannya.
   - *Status:* **PASSED**.

4. **Isolasi Antar-Penyelenggara (Cross-Organizer Isolation)**:
   - *Backend Test:* Organizer A (`baristaguild@dagocreative.id`) diizinkan check-in pada event miliknya.
   - *Negative Test:* Organizer A ditolak secara tegas (HTTP 403 Forbidden) saat mencoba mengirimkan check-in untuk event milik Organizer B (`bandungdev` / `organizer.b@community.org`).
   - *Status:* **PASSED**.

5. **Mitra F&B / Tenant Owner**:
   - *Frontend Test:* Tenant Owner (`TENANT_OWNER_KS`) tidak melihat menu `/events/checkin`, `/events-admin`, `/coworking`, atau `/activity-log`.
   - *Backend Test:* `assertCheckInAuth()` langsung menolak kredensial tenant dengan pesan `FORBIDDEN: Mitra F&B / Tenant tidak memiliki wewenang untuk operasional Event Hub.`
   - *Status:* **PASSED**.

6. **Customer / Member**:
   - *Frontend Test:* Customer hanya melihat menu `Self-Order & Menu QR` (`/customer`). Tidak melihat menu manajerial atau operasional apapun.
   - *Redirect Test:* Customer yang login dengan parameter `returnTo=/events/checkin` atau `returnTo=/dashboard` otomatis dibelokkan ke `/customer`.
   - *Status:* **PASSED**.

---

## 5. BUKTI PROTEKSI ROUTE & API

### A. Server-Side Guard `assertCheckInAuth`
Implementasi pada `src/lib/server-auth.ts`:
```typescript
// 1. Strict Tenant Exclusion
if (auth.scopeLevel === "TENANT" || emailLower.includes("@kopisenja.com") || ...) {
  return { authorized: false, error: "FORBIDDEN: Mitra F&B / Tenant tidak memiliki wewenang..." };
}

// 2. Hub Management Oversight
const isHubAdmin = (auth.role === "SUPER_ADMIN" && auth.scopeLevel === "PLATFORM") ||
  ((auth.role === "OWNER" || auth.role === "MANAGER") && auth.scopeLevel === "ORGANIZATION");
if (isHubAdmin) return { authorized: true, ... };

// 3. Organizer verification
if (isEventOrganizer) return { authorized: true, ... };

// 4. Explicit Permission or Event Assignment
if (hasExplicitCheckInPerm || isAssignedToEvent) return { authorized: true, isFieldOfficer: true };

// 5. Unassigned Staff Rejection
if (auth.role === "WAITER" || auth.role === "CASHIER") {
  return { authorized: false, error: "FORBIDDEN: Staf [WAITER/CASHIER] tidak memiliki penugasan..." };
}
```

### B. Proteksi Halaman UI Check-in (`/events/checkin`)
Implementasi pada `src/app/events/checkin/page.tsx`:
- Memeriksa `const isAuthorized = canAccessEventCheckIn(user)`.
- Jika `!isAuthorized`, komponen membatalkan pemanggilan API data dan menampilkan tampilan terisolasi dengan peringatan keamanan.

### C. Pencegahan Open Redirect & Manipulasi Backslash
Implementasi pada `src/app/(auth)/login/page.tsx`:
- Karakter backslash (`\`), URL eksternal dengan protokol (`http:`, `https:`, `javascript:`), dan protocol-relative URL (`//`) menghasilkan `null`.
- Daftar rute terlarang mencegah eskalasi Customer ke rute staf internal.

---

## 6. HASIL EMPIRIS VERIFIKASI

### A. TypeScript Type-Check
```bash
> dagoeng-fnb-management@1.0.0 type-check
> node ./node_modules/typescript/bin/tsc --noEmit
```
**Exit Code:** `0` (0 errors)

### B. Automated Test Suite (Vitest)
```bash
node ./node_modules/vitest/vitest.mjs run
```
**Hasil Keseluruhan:**
- **Test Files:** 55 passed (55 files)
- **Total Tests:** 600 passed (600 tests, 100% PASS)
- **Durasi Eksekusi:** 37.18s

Detail Test Suites Kunci:
- `tests/targeted-security-audit.test.ts`: 17 passed
- `tests/community-events-portal.test.ts`: 16 passed
- `tests/community-events.test.ts`: 35 passed
- `tests/login-security-and-data-integrity.test.ts`: 20 passed
- `tests/multi-business-rbac.test.ts`: 6 passed
- `tests/rbac.test.ts`: 4 passed
- `tests/etl-data-validation.test.ts`: 4 passed

### C. Next.js Production Build
```powershell
$env:NEXT_PRIVATE_MAX_WORKERS="1"; node ./node_modules/next/dist/bin/next build
```
**Exit Code:** `0`  
**Hasil:** Seluruh 32 rute statis dan fungsi dynamic serverless berhasil dikompilasi sempurna.

---

## 7. STATUS INTEGRITAS DATABASE & DATA BASELINE JSON

- **`prisma/schema.prisma`**: **100% UNTOUCHED**. Tidak ada perubahan model, relasi, enum, atau field.
- **Migration & DB State**: Tidak ada migrasi database atau `prisma db push` yang dijalankan.
- **`data/*.json` Baseline**:
  - `data/event_bookings.json`: 100% utuh (8 booking: 6 PAID = Rp506.000, 1 PENDING = Rp1.000.000, 1 CANCELLED = Rp200.000, Total = Rp1.706.000).
  - `data/events.json`: 100% utuh tanpa residu event pengujian.
  - `data/organizers.json`: 100% utuh.

---

## 8. KETERBATASAN YANG BELUM DAPAT DIVERIFIKASI (KNOWN LIMITATIONS)

1. **Metode Verifikasi:**
   - Hasil audit ini diverifikasi melalui **Automated Unit & Integration Tests** dan **Static Route Analysis**.
   - **Browser User Acceptance Testing (UAT) manual** pada browser fisik dengan pemindaian kamera barcode QR scanner belum dilakukan dalam sesi ini (dieksekusi melalui simulasi payload token).
2. **Model Penugasan Multi-Staff Lanjutan:**
   - Saat ini penugasan panitia spesifik per event didukung melalui field array `assignedStaffEmails` pada berkas `events.json`.
   - Jika di masa mendatang pemilik proyek menginginkan tabel relasi database formal `EventStaffAssignment` pada PostgreSQL/Neon, hal tersebut memerlukan penambahan model baru pada `prisma/schema.prisma` setelah persetujuan skema disahkan.

