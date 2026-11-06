# DagoEng F&B Management & Coworking Hub

> **Brand**: DagoEng Creative Hub  
> **Tagline**: *Smarter F&B. Better Operations.*  
> **Product**: Integrated Multi-Tenant F&B, Coworking & Retail Space Management

---

## 📌 Product Overview & Prioritas Modul Sistem

**DagoEng F&B Management** adalah platform all-in-one enterprise terpadu yang dirancang untuk mengelola seluruh ekosistem bisnis dengan hierarki prioritas sistem sebagai berikut:

### 🏆 Prioritas Arsitektur & Modul Sistem:
1. **Prioritas 1 — Co-Working Space**: Reservasi Hot Desk/Dedicated Nomad Desk, VIP Meeting Room hourly booking, pass harian/bulanan, dan integrasi voucher Wi-Fi Mikrotik.
2. **Prioritas 2 — F&B Culinary & POS**: POS Kasir multi-payment, Kitchen Display System (KDS) SLA, Table Floor Plan, BOM Recipe stock deduction, dan AI inventory procurement.
3. **Prioritas 3 — Event Marketplace & Community**: Pengajuan proposal event, kurasi kurator, pemesanan tiket, live attendee check-in, dan negosiasi bagi hasil transparan.

Modul pendukung lainnya meliputi **Commercial Retail Space**, **Customer CRM & Loyalty**, serta **Executive Dashboard & Export Suite** (PDF, Excel .xlsx, CSV).

---

## 📂 Struktur Direktori & Modul Proyek (Clean Architecture)

```text
dagoeng-fnb-management/
├── prisma/                          # Database ORM schema & seed data
│   ├── schema.prisma                # Multi-tenant relational schema (PostgreSQL)
│   └── seed.ts                      # Demo seeders (8 personas, products, tables, spaces)
│
├── docs/                            # Dokumentasi teknis & spesifikasi sistem
│   ├── ARCHITECTURE.md              # Blueprint arsitektur multi-tenant & state machine
│   ├── DATABASE.md                  # Skema database, relasi tabel & index
│   ├── RBAC.md                      # Role-Based Access Control matrix
│   ├── DESIGN_SYSTEM.md             # Color tokens, typography, glassmorphism standards
│   ├── TESTING.md                   # Panduan unit test & quality gate
│   ├── implementation_plan.md       # Catatan roadmap & implementasi teknis
│   └── prd_sistem_working_space.md  # Dokumen PRD sistem working space
│
├── src/
│   ├── app/                         # Next.js 14 App Router (Pages & Routes)
│   │   ├── (auth)/login/            # Multi-persona quick switcher & login modal
│   │   ├── (dashboard)/             # Protected admin/staff dashboard routes
│   │   │   ├── dashboard/           # Executive KPI, chart trend & AI insights
│   │   │   ├── pos/                 # Kasir POS & split payment
│   │   │   ├── kitchen/             # Kitchen Display System (KDS) live timers
│   │   │   ├── orders/              # Riwayat pesanan & rekap modal PDF/Excel
│   │   │   ├── tables/              # Denah meja interaktif & status dine-in
│   │   │   ├── menu/                # Manajemen katalog menu & recipe linking
│   │   │   ├── inventory/           # Stok bahan baku, BOM recipe & AI assistant
│   │   │   ├── customers/           # CRM database & tier membership
│   │   │   ├── coworking/           # Reservasi Hot Desk & VIP Meeting Room
│   │   │   ├── commercial/          # Retail tenant lease contract & billing
│   │   │   ├── employees/           # Shift kasir, cash drawer float & clock in/out
│   │   │   ├── activity-log/        # Audit trail aktivitas pengguna
│   │   │   ├── reports/             # Laporan penjualan, laba rugi & traffic
│   │   │   ├── ai-insight/          # AI business advisor & revenue forecasting
│   │   │   └── settings/            # Konfigurasi sistem & profil outlet
│   │   ├── (mobile)/                # Mobile-first customer & waiter portal
│   │   │   ├── customer/            # Self-order digital menu & loyalty card
│   │   │   └── waiter/              # Waiter table handheld order taker
│   │   ├── globals.css              # Styling utama Tailwind & glassmorphism
│   │   ├── layout.tsx               # Root application wrapper & providers
│   │   └── page.tsx                 # Landing page publik Dago Creative Hub
│   │
│   ├── components/                  # Reusable shared UI primitives
│   │   ├── providers/               # AppProviders context composition root
│   │   └── ui/                      # Base atoms (Button, Card, Badge, Input, Table, Tabs, Skeleton)
│   │
│   ├── contexts/                    # Global state management & business engines
│   │   ├── AuthContext.tsx          # Multi-role authentication & session state
│   │   ├── OutletContext.tsx        # Multi-outlet switcher & tenant isolation
│   │   ├── OrderContext.tsx         # Transaksi pesanan, billing & payment state
│   │   ├── TableContext.tsx         # Denah meja & dine-in occupancy
│   │   ├── InventoryContext.tsx     # Stok bahan baku & BOM recipe deduction
│   │   ├── ProductContext.tsx       # Katalog menu makanan/minuman
│   │   ├── LoyaltyContext.tsx       # Tier membership & point redemption
│   │   ├── CoworkingContext.tsx     # Workspace space availability & check-in
│   │   ├── CommercialContext.tsx    # Tenant contracts, lease & rent invoices
│   │   ├── EmployeeShiftContext.tsx # Shift schedule, cash float & drawer closing
│   │   ├── ActivityLogContext.tsx   # Security audit trail logging
│   │   ├── NotificationContext.tsx  # Toast & alert notifications
│   │   ├── SettingsContext.tsx      # Business profiles, tax & receipt settings
│   │   └── DateFilterContext.tsx    # Filter rentang tanggal laporan global
│   │
│   ├── features/                    # Domain-driven feature components & export modals
│   │   ├── activity-log/            # ActivityLogPDFModal
│   │   ├── commercial/              # CommercialReportPDFModal
│   │   ├── coworking/               # CoworkingReportPDFModal
│   │   ├── customers/               # CustomersReportPDFModal
│   │   ├── dashboard/               # KPICard, RevenueChart, AIInsightCard, OutletCompare
│   │   ├── employees/               # EmployeesReportPDFModal
│   │   ├── inventory/               # BOMRecipeModal, InventoryReportPDFModal
│   │   ├── layout/                  # Sidebar, Header, RoleAwareStatusPill, DevRoleBar
│   │   ├── orders/                  # OrdersReportPDFModal
│   │   ├── payment/                 # PaymentWaitingModal
│   │   ├── pos/                     # PaymentModal, ModifierModal, ReceiptModal, DailyClosingPDFModal
│   │   └── reports/                 # StructuredReportPDFModal
│   │
│   ├── lib/                         # Core utilities, helpers & calculation engines
│   │   ├── rbac.ts                  # Role & permission matrix enforcement
│   │   ├── tenant.ts                # Tenant security isolation helpers
│   │   ├── settlement.ts            # Payment fee, service tax & net payout
│   │   ├── promo.ts                 # Promo code calculation & discounting
│   │   ├── export-utils.ts          # Universal Excel (.xlsx) & CSV export engine
│   │   ├── order-analytics.ts       # Hourly traffic & sales velocity analytics
│   │   ├── audio-chime.ts           # Sound notification synthesizer (Web Audio API)
│   │   ├── session.ts               # Secure cookie session helper
│   │   ├── utils.ts                 # Formatting currency (IDR), dates & CN class helper
│   │   └── db.ts                    # Prisma client singleton
│   │
│   └── types/                       # TypeScript interfaces & domain type definitions
│       └── index.ts                 # Clean barrel export of all models
│
└── tests/                           # Vitest / Jest comprehensive test suite (89 passing tests)
    ├── auth.test.ts
    ├── rbac.test.ts
    ├── multi-business-rbac.test.ts
    ├── tenant-isolation.test.ts
    ├── outlet-isolation.test.ts
    ├── pos-transaction.test.ts
    ├── pos-promo-integration.test.ts
    ├── promo-calculation.test.ts
    ├── settlement.test.ts
    ├── revenue-split-and-tax.test.ts
    ├── order-lifecycle.test.ts
    ├── core-operational-flow.test.ts
    ├── inventory-cogs.test.ts
    ├── coworking-booking.test.ts
    ├── customer-loyalty.test.ts
    ├── customer-portal-payment.test.ts
    └── activity-log.test.ts
```

---
