# Spesifikasi Database — DagoEng F&B Management

Database: **PostgreSQL**  
ORM: **Prisma ORM**  
Strategi Skema: **Incremental Domain Phasing**

---

## 1. Model Skema Inti & Siklus Pesanan

```
+---------------------------------------------------------------------------------------------------+
|                                      ORGANISASI & UNIT BISNIS                                     |
+---------------------------------------------------------------------------------------------------+
| Organization   | id, name, code, activeModules (FNB, COWORKING, COMMERCIAL), status, timestamps   |
| Outlet         | id, organizationId, name, code, address, phone, status, timestamps               |
| User           | id, email, passwordHash, name, phone, isActive, timestamps                       |
| UserRole       | id, userId, roleId, scopeLevel, organizationId, outletId, allowedModules         |
| Session        | id, sessionTokenHash, userId, expiresAt, userAgent, ipAddress, createdAt          |
+---------------------------------------------------------------------------------------------------+

+---------------------------------------------------------------------------------------------------+
|                                      MENU & PRODUK (F&B)                                          |
+---------------------------------------------------------------------------------------------------+
| Category       | id, organizationId, name, sortOrder, isActive, timestamps                        |
| Product        | id, organizationId, categoryId, name, description, imageUrl, basePrice, status   |
| ProductVariant | id, productId, name, priceAdjustment, isAvailable                                |
| ModifierGroup  | id, organizationId, name, minSelect, maxSelect, isRequired                        |
| ModifierOption | id, modifierGroupId, name, price                                                 |
+---------------------------------------------------------------------------------------------------+

+---------------------------------------------------------------------------------------------------+
|                                  ORDER LIFECYCLE & SERVICE TIMERS                                 |
+---------------------------------------------------------------------------------------------------+
| Order          | id, orderNumber, outletId, tableNumber, customerName, diningOption, status,       |
|                | paymentStatus, totalAmount, queueMinutes, cookMinutes, serveMinutes,             |
|                | totalServiceMinutes, slaStatus (ON_TIME, AT_RISK, DELAYED), timestamps           |
| OrderItem      | id, orderId, productId, name, quantity, unitPrice, subtotal, notes, modifiers     |
| OrderHistory   | id, orderId, fromStatus, toStatus, changedByUserId, reason, timestamp             |
+---------------------------------------------------------------------------------------------------+

+---------------------------------------------------------------------------------------------------+
|                                      MANAJEMEN AREA & MEJA                                        |
+---------------------------------------------------------------------------------------------------+
| TableArea      | id, outletId, name, sortOrder, createdAt                                         |
| Table          | id, tableAreaId, number, capacity, status (AVAILABLE, OCCUPIED, RESERVED), ...   |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Model Pelanggan Tanpa Akun Wajib (Decoupled Customer)

Model `Customer` dirancang terpisah dari kredensial pengguna aplikasi:
- Pelanggan walk-in atau pengunjung meja dapat memesan melalui QR tanpa perlu membuat akun pengguna (`userId = null`).
- Jika pelanggan mendaftar program keanggotaan/loyalitas, entitas `User` dapat ditautkan kemudian secara opsional.

---

## 3. Strategi Seed Data (2 Organisasi, 4 Gerai)

1. **Organisasi 1**: `Dago Creative Hub / Kopi Senja` (`KOPI-SENJA`)
   - Singaraja (`KS-SGR`)
   - Denpasar (`KS-DPS`)
   - Ubud (`KS-UBD`)
2. **Organisasi 2**: `Bali Brew Demo` (`BALI-BREW`)
   - Renon (`BB-RNN`) — digunakan untuk pengujian isolasi tenant otomatis.
