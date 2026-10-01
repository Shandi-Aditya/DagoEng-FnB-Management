import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting DagoEng F&B Management Seed...");

  // 1. CLEAR EXISTING DATA (Clean seed)
  await prisma.auditLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.table.deleteMany();
  await prisma.tableArea.deleteMany();
  await prisma.modifierOption.deleteMany();
  await prisma.modifierGroup.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.user.deleteMany();
  await prisma.outlet.deleteMany();
  await prisma.organization.deleteMany();

  console.log("🧹 Cleaned existing database records.");

  // 2. CREATE ROLES
  const rolesData = [
    { name: "Super Admin", slug: "SUPER_ADMIN", description: "Global platform administration" },
    { name: "Owner", slug: "OWNER", description: "Business owner with full org & analytics access" },
    { name: "Manager", slug: "MANAGER", description: "Outlet operational management" },
    { name: "Cashier", slug: "CASHIER", description: "POS, payment & shift operations" },
    { name: "Kitchen Staff", slug: "KITCHEN_STAFF", description: "Kitchen Display System operations" },
    { name: "Inventory Staff", slug: "INVENTORY_STAFF", description: "Stock, ingredients & procurement" },
    { name: "Waiter", slug: "WAITER", description: "Table & customer floor ordering" },
    { name: "Customer", slug: "CUSTOMER", description: "Digital menu & self-ordering user" },
  ];

  const createdRoles: Record<string, any> = {};
  for (const role of rolesData) {
    createdRoles[role.slug] = await prisma.role.create({ data: role });
  }
  console.log("✅ Created 8 Standard Roles.");

  // 3. CREATE PERMISSIONS
  const permissionsData = [
    { code: "dashboard:view", module: "DASHBOARD", description: "View analytics & executive briefing" },
    { code: "dashboard:compare_outlets", module: "DASHBOARD", description: "Compare multi-outlet metrics" },
    { code: "pos:operate", module: "POS", description: "Create orders and process cashier payments" },
    { code: "orders:view", module: "ORDERS", description: "View order queue and active bills" },
    { code: "orders:manage", module: "ORDERS", description: "Modify, void or transfer orders" },
    { code: "tables:view", module: "TABLES", description: "View table map and floor layout" },
    { code: "tables:manage", module: "TABLES", description: "Update table status, merge or split" },
    { code: "kitchen:kds", module: "KITCHEN", description: "View and update Kitchen Display System" },
    { code: "inventory:view", module: "INVENTORY", description: "View stock balances and movements" },
    { code: "inventory:manage", module: "INVENTORY", description: "Manage stocks, PO and suppliers" },
    { code: "menu:view", module: "MENU", description: "View products, categories and recipes" },
    { code: "menu:manage", module: "MENU", description: "Create and update menu catalog and prices" },
    { code: "customers:view", module: "CUSTOMERS", description: "View customer CRM and loyalty" },
    { code: "reports:view", module: "REPORTS", description: "View sales, financial and staff reports" },
    { code: "employees:manage", module: "EMPLOYEES", description: "Manage staff, shifts and rosters" },
    { code: "settings:manage", module: "SETTINGS", description: "Configure outlet and system settings" },
  ];

  const createdPermissions: Record<string, any> = {};
  for (const perm of permissionsData) {
    createdPermissions[perm.code] = await prisma.permission.create({ data: perm });
  }

  // Map permissions to roles
  const rolePermissionsMap: Record<string, string[]> = {
    SUPER_ADMIN: Object.keys(createdPermissions),
    OWNER: [
      "dashboard:view", "dashboard:compare_outlets", "orders:view", "tables:view",
      "inventory:view", "menu:view", "menu:manage", "customers:view", "reports:view",
      "employees:manage", "settings:manage"
    ],
    MANAGER: [
      "dashboard:view", "pos:operate", "orders:view", "orders:manage", "tables:view",
      "tables:manage", "kitchen:kds", "inventory:view", "inventory:manage", "menu:view",
      "customers:view", "reports:view", "employees:manage"
    ],
    CASHIER: ["pos:operate", "orders:view", "tables:view"],
    KITCHEN_STAFF: ["kitchen:kds", "orders:view"],
    INVENTORY_STAFF: ["inventory:view", "inventory:manage"],
    WAITER: ["tables:view", "tables:manage", "orders:view"],
    CUSTOMER: ["menu:view"],
  };

  for (const [roleSlug, permCodes] of Object.entries(rolePermissionsMap)) {
    for (const code of permCodes) {
      if (createdRoles[roleSlug] && createdPermissions[code]) {
        await prisma.rolePermission.create({
          data: {
            roleId: createdRoles[roleSlug].id,
            permissionId: createdPermissions[code].id,
          },
        });
      }
    }
  }
  console.log("✅ Created Permissions & Assigned Role Matrix.");

  // 4. CREATE 2 ORGANIZATIONS & 4 OUTLETS
  // Organization 1: Kopi Senja (Singaraja, Denpasar, Ubud)
  const orgKopiSenja = await prisma.organization.create({
    data: {
      name: "Kopi Senja",
      code: "KOPI-SENJA",
      status: "ACTIVE",
    },
  });

  const outletSingaraja = await prisma.outlet.create({
    data: {
      organizationId: orgKopiSenja.id,
      name: "Kopi Senja - Singaraja",
      code: "KS-SGR",
      address: "Jl. Ngurah Rai No. 45, Singaraja",
      phone: "+62 812-3456-7891",
      status: "ACTIVE",
    },
  });

  const outletDenpasar = await prisma.outlet.create({
    data: {
      organizationId: orgKopiSenja.id,
      name: "Kopi Senja - Denpasar",
      code: "KS-DPS",
      address: "Jl. Teuku Umar No. 88, Denpasar",
      phone: "+62 812-3456-7892",
      status: "ACTIVE",
    },
  });

  const outletUbud = await prisma.outlet.create({
    data: {
      organizationId: orgKopiSenja.id,
      name: "Kopi Senja - Ubud",
      code: "KS-UBD",
      address: "Jl. Raya Ubud No. 12, Ubud",
      phone: "+62 812-3456-7893",
      status: "ACTIVE",
    },
  });

  // Organization 2: Bali Brew Demo (Renon) - For Cross-Tenant Isolation Testing
  const orgBaliBrew = await prisma.organization.create({
    data: {
      name: "Bali Brew Demo",
      code: "BALI-BREW",
      status: "ACTIVE",
    },
  });

  const outletRenon = await prisma.outlet.create({
    data: {
      organizationId: orgBaliBrew.id,
      name: "Bali Brew - Renon",
      code: "BB-RNN",
      address: "Jl. Raya Puputan No. 20, Renon, Denpasar",
      phone: "+62 813-9876-5432",
      status: "ACTIVE",
    },
  });

  console.log("✅ Created 2 Organizations and 4 Outlets.");

  // 5. CREATE USERS & CREDENTIALS
  const defaultPasswordHash = await bcrypt.hash("Password123!", 10);

  const usersData = [
    {
      email: "admin@dagoeng.com",
      name: "Super Admin Platform",
      roleSlug: "SUPER_ADMIN",
      orgId: null,
      outletId: null,
    },
    {
      email: "owner@kopisenja.com",
      name: "I Wayan Pratama (Owner)",
      roleSlug: "OWNER",
      orgId: orgKopiSenja.id,
      outletId: null,
    },
    {
      email: "manager.sgr@kopisenja.com",
      name: "Putu Arya (Manager Singaraja)",
      roleSlug: "MANAGER",
      orgId: orgKopiSenja.id,
      outletId: outletSingaraja.id,
      employeeNumber: "EMP-SGR-001",
      designation: "General Store Manager",
    },
    {
      email: "cashier.sgr@kopisenja.com",
      name: "Ni Kadek Sri (Cashier Singaraja)",
      roleSlug: "CASHIER",
      orgId: orgKopiSenja.id,
      outletId: outletSingaraja.id,
      employeeNumber: "EMP-SGR-002",
      designation: "Head Cashier",
    },
    {
      email: "kitchen.sgr@kopisenja.com",
      name: "Gede Agus (Kitchen Singaraja)",
      roleSlug: "KITCHEN_STAFF",
      orgId: orgKopiSenja.id,
      outletId: outletSingaraja.id,
      employeeNumber: "EMP-SGR-003",
      designation: "Head Chef",
    },
    {
      email: "inventory.sgr@kopisenja.com",
      name: "Komang Bayu (Inventory Staff)",
      roleSlug: "INVENTORY_STAFF",
      orgId: orgKopiSenja.id,
      outletId: outletSingaraja.id,
      employeeNumber: "EMP-SGR-004",
      designation: "Inventory Specialist",
    },
    {
      email: "waiter.sgr@kopisenja.com",
      name: "Made Surya (Waiter Singaraja)",
      roleSlug: "WAITER",
      orgId: orgKopiSenja.id,
      outletId: outletSingaraja.id,
      employeeNumber: "EMP-SGR-005",
      designation: "Floor Server",
    },
    {
      email: "customer@gmail.com",
      name: "Ketut Dian (Customer Member)",
      roleSlug: "CUSTOMER",
      orgId: orgKopiSenja.id,
      outletId: null,
    },
    // User for Organization 2 (Bali Brew)
    {
      email: "manager@balibrew.com",
      name: "Nyoman Oka (Manager Bali Brew)",
      roleSlug: "MANAGER",
      orgId: orgBaliBrew.id,
      outletId: outletRenon.id,
      employeeNumber: "EMP-BB-001",
      designation: "Store Manager",
    },
    {
      email: "cashier@balibrew.com",
      name: "Luh Ratna (Cashier Bali Brew)",
      roleSlug: "CASHIER",
      orgId: orgBaliBrew.id,
      outletId: outletRenon.id,
      employeeNumber: "EMP-BB-002",
      designation: "Cashier",
    },
  ];

  const createdUsers: Record<string, any> = {};

  for (const u of usersData) {
    const user = await prisma.user.create({
      data: {
        email: u.email,
        passwordHash: defaultPasswordHash,
        name: u.name,
        phone: "+62 812-3456-0000",
        isActive: true,
      },
    });

    createdUsers[u.email] = user;

    // Attach UserRole
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: createdRoles[u.roleSlug].id,
        organizationId: u.orgId,
        outletId: u.outletId,
      },
    });

    // If staff employee
    if (u.employeeNumber) {
      await prisma.employee.create({
        data: {
          userId: user.id,
          organizationId: u.orgId!,
          outletId: u.outletId,
          employeeNumber: u.employeeNumber,
          designation: u.designation,
          status: "ACTIVE",
        },
      });
    }
  }
  console.log("✅ Created Test Users across 8 Roles & 2 Organizations.");

  // 6. CREATE CUSTOMERS (Decoupled model: 1 linked account, 2 guest/standalone customers)
  await prisma.customer.create({
    data: {
      organizationId: orgKopiSenja.id,
      userId: createdUsers["customer@gmail.com"].id, // Linked user account
      name: "Ketut Dian",
      phone: "+62 819-1122-3344",
      email: "customer@gmail.com",
      status: "ACTIVE",
    },
  });

  await prisma.customer.create({
    data: {
      organizationId: orgKopiSenja.id,
      userId: null, // Standalone guest transacting customer
      name: "Budi Santoso (Guest Walk-in)",
      phone: "+62 857-9988-7766",
      email: "budi.guest@gmail.com",
      status: "ACTIVE",
    },
  });

  await prisma.customer.create({
    data: {
      organizationId: orgKopiSenja.id,
      userId: null,
      name: "Siti Rahma (Frequent Dine-in)",
      phone: "+62 818-4455-6677",
      email: null,
      status: "ACTIVE",
    },
  });
  console.log("✅ Created Decoupled Customer Records.");

  // 7. CREATE MENU CATEGORIES & PRODUCTS (Realistic High/Low Margin & Best/Slow Sellers)
  const catCoffee = await prisma.category.create({
    data: { organizationId: orgKopiSenja.id, name: "Signature Coffee", sortOrder: 1 },
  });
  const catTea = await prisma.category.create({
    data: { organizationId: orgKopiSenja.id, name: "Artisan Tea & Refreshers", sortOrder: 2 },
  });
  const catMains = await prisma.category.create({
    data: { organizationId: orgKopiSenja.id, name: "Main Course", sortOrder: 3 },
  });
  const catPastry = await prisma.category.create({
    data: { organizationId: orgKopiSenja.id, name: "Pastry & Snacks", sortOrder: 4 },
  });

  // Product 1: Best Seller & High Velocity (Kopi Senja Aren)
  const prodSenjaAren = await prisma.product.create({
    data: {
      organizationId: orgKopiSenja.id,
      categoryId: catCoffee.id,
      name: "Kopi Senja Aren",
      description: "Signature espresso with premium organic palm sugar and fresh milk.",
      basePrice: 24000,
      isAvailable: true,
      variants: {
        create: [
          { name: "Regular (Ice)", priceAdjustment: 0 },
          { name: "Large (Ice)", priceAdjustment: 5000 },
          { name: "Hot", priceAdjustment: 0 },
        ],
      },
    },
  });

  // Product 2: High Margin (Artisan Peach White Tea)
  const prodPeachTea = await prisma.product.create({
    data: {
      organizationId: orgKopiSenja.id,
      categoryId: catTea.id,
      name: "Artisan Peach White Tea",
      description: "Fragrant white tea infused with white peach extract and mint leaf.",
      basePrice: 28000,
      isAvailable: true,
      variants: {
        create: [
          { name: "Regular", priceAdjustment: 0 },
          { name: "Large", priceAdjustment: 6000 },
        ],
      },
    },
  });

  // Product 3: Low Margin & High Cost (Signature Wagyu Beef Bowl)
  const prodBeefBowl = await prisma.product.create({
    data: {
      organizationId: orgKopiSenja.id,
      categoryId: catMains.id,
      name: "Signature Wagyu Beef Bowl",
      description: "Pan-seared Australian Wagyu beef slices over warm Japanese rice and onsen egg.",
      basePrice: 65000,
      isAvailable: true,
    },
  });

  // Product 4: Slow Moving (Herbal Lemongrass Infusion)
  const prodHerbal = await prisma.product.create({
    data: {
      organizationId: orgKopiSenja.id,
      categoryId: catTea.id,
      name: "Herbal Lemongrass Infusion",
      description: "Traditional brew with fresh lemongrass, ginger, and wild forest honey.",
      basePrice: 22000,
      isAvailable: true,
    },
  });

  // Product 5: Pastry Snack (Butter Croissant)
  await prisma.product.create({
    data: {
      organizationId: orgKopiSenja.id,
      categoryId: catPastry.id,
      name: "Flaky French Butter Croissant",
      description: "Freshly baked artisan butter croissant with crisp layers.",
      basePrice: 20000,
      isAvailable: true,
    },
  });

  // Modifiers
  const modSugar = await prisma.modifierGroup.create({
    data: {
      organizationId: orgKopiSenja.id,
      name: "Sugar Level",
      minSelect: 1,
      maxSelect: 1,
      isRequired: true,
      options: {
        create: [
          { name: "Normal Sugar (100%)", price: 0 },
          { name: "Less Sugar (50%)", price: 0 },
          { name: "No Sugar (0%)", price: 0 },
        ],
      },
    },
  });

  const modDairy = await prisma.modifierGroup.create({
    data: {
      organizationId: orgKopiSenja.id,
      name: "Milk Substitute & Add-on",
      minSelect: 0,
      maxSelect: 2,
      isRequired: false,
      options: {
        create: [
          { name: "Oat Milk Substitution", price: 8000 },
          { name: "Extra Espresso Shot", price: 6000 },
          { name: "Grass Jelly Topping", price: 4000 },
        ],
      },
    },
  });

  console.log("✅ Created Menu Categories, Products, Variants & Modifiers.");

  // 8. CREATE TABLE AREAS & TABLES (Singaraja, Denpasar, Ubud, Renon)
  const areaSgrIndoor = await prisma.tableArea.create({
    data: { outletId: outletSingaraja.id, name: "Indoor AC Main Hall", sortOrder: 1 },
  });
  const areaSgrOutdoor = await prisma.tableArea.create({
    data: { outletId: outletSingaraja.id, name: "Outdoor Tropical Garden", sortOrder: 2 },
  });

  // Singaraja Tables
  const sgrTables = [
    { tableAreaId: areaSgrIndoor.id, number: "T-01", capacity: 2, status: "OCCUPIED" },
    { tableAreaId: areaSgrIndoor.id, number: "T-02", capacity: 4, status: "AVAILABLE" },
    { tableAreaId: areaSgrIndoor.id, number: "T-03", capacity: 4, status: "AVAILABLE" },
    { tableAreaId: areaSgrIndoor.id, number: "VIP-01", capacity: 8, status: "RESERVED" },
    { tableAreaId: areaSgrOutdoor.id, number: "OUT-01", capacity: 4, status: "AVAILABLE" },
    { tableAreaId: areaSgrOutdoor.id, number: "OUT-02", capacity: 6, status: "AVAILABLE" },
  ];

  for (const tbl of sgrTables) {
    await prisma.table.create({ data: tbl });
  }

  // Denpasar Tables
  const areaDps = await prisma.tableArea.create({
    data: { outletId: outletDenpasar.id, name: "Main Dining Floor", sortOrder: 1 },
  });
  await prisma.table.create({ data: { tableAreaId: areaDps.id, number: "DPS-01", capacity: 4, status: "AVAILABLE" } });
  await prisma.table.create({ data: { tableAreaId: areaDps.id, number: "DPS-02", capacity: 2, status: "AVAILABLE" } });

  // Bali Brew Demo Table
  const areaRenon = await prisma.tableArea.create({
    data: { outletId: outletRenon.id, name: "Brew Bar Floor", sortOrder: 1 },
  });
  await prisma.table.create({ data: { tableAreaId: areaRenon.id, number: "BB-01", capacity: 4, status: "AVAILABLE" } });

  console.log("✅ Created Table Areas and Tables.");
  console.log("🎉 Seed finished successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
