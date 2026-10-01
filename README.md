# DagoEng F&B Management

> **Brand**: DagoEng Creative Hub  
> **Tagline**: *Smarter F&B. Better Operations.*  
> **Product**: Integrated Smart F&B Management Platform

---

## 📌 Product Overview

DagoEng F&B Management adalah platform terintegrasi yang dirancang untuk mengelola seluruh siklus operasional bisnis Food & Beverage: transaksi kasir (POS), kitchen display system (KDS), manajemen meja, smart inventory berbasis resep & COGS, customer CRM & loyalty, analisis multi-outlet, hingga AI business advisory.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
# Development Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dagoeng_fnb_dev?schema=public"

# Isolated Test Database
DATABASE_URL_TEST="postgresql://postgres:postgres@localhost:5432/dagoeng_fnb_test?schema=public"

# Developer Role Simulator Flag (development & QA only)
ENABLE_ROLE_SIMULATOR="true"
```

### 3. Generate Prisma Client & Run Database Migrations
```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

### 4. Run Automated Test Suite
```bash
npm run test
```

### 5. Start Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 👥 Seeded Standard Accounts (8 Roles)

| Role | Email | Default Password | Initial View |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@dagoeng.com` | `Password123!` | Global Platform Dashboard |
| **Owner** | `owner@kopisenja.com` | `Password123!` | Multi-Outlet Executive Dashboard |
| **Manager** | `manager.sgr@kopisenja.com` | `Password123!` | Outlet Singaraja Dashboard |
| **Cashier** | `cashier.sgr@kopisenja.com` | `Password123!` | POS Kasir & Sesi Shift |
| **Kitchen Staff** | `kitchen.sgr@kopisenja.com` | `Password123!` | Kitchen Display System (KDS) |
| **Inventory Staff**| `inventory.sgr@kopisenja.com` | `Password123!` | Smart Inventory & Procurement |
| **Waiter** | `waiter.sgr@kopisenja.com` | `Password123!` | Handheld Table Floor Ordering |
| **Customer** | `customer@gmail.com` | `Password123!` | Digital QR Menu Self-Order |

---

## 📁 Project Architecture & Documentation

- [ARCHITECTURE.md](file:///d:/Magang%20Shandi/DagoEng%20F&B%20Management/docs/ARCHITECTURE.md)
- [DATABASE.md](file:///d:/Magang%20Shandi/DagoEng%20F&B%20Management/docs/DATABASE.md)
- [RBAC.md](file:///d:/Magang%20Shandi/DagoEng%20F&B%20Management/docs/RBAC.md)
- [DESIGN_SYSTEM.md](file:///d:/Magang%20Shandi/DagoEng%20F&B%20Management/docs/DESIGN_SYSTEM.md)
- [TESTING.md](file:///d:/Magang%20Shandi/DagoEng%20F&B%20Management/docs/TESTING.md)
