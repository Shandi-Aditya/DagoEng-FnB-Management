import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Task V-04: Audit Penyimpanan Data (localStorage vs Server)", () => {
  const docPath = path.join(process.cwd(), "docs/AUDIT_PENYIMPANAN_DATA.md");

  it("1. Dokumen audit tersedia dan memiliki format 1 halaman ringkas", () => {
    expect(fs.existsSync(docPath)).toBe(true);
    const content = fs.readFileSync(docPath, "utf-8");
    expect(content.length).toBeGreaterThan(500);
    expect(content).toContain("# Audit Penyimpanan Data (localStorage vs Server)");
    expect(content).toContain("Ka Ari");
  });

  it("2. Mencakup seluruh 8 data inti yang diwajibkan dalam task description", () => {
    const content = fs.readFileSync(docPath, "utf-8");
    const requiredEntities = [
      "orders",
      "shifts",
      "audit trail",
      "loyalty members",
      "employees",
      "master products",
      "coworking bookings",
      "platform settings",
    ];

    for (const entity of requiredEntities) {
      expect(content.toLowerCase()).toContain(entity.toLowerCase());
    }
  });

  it("3. Menyajikan tabel komparasi sumber data dan status arsitektur", () => {
    const content = fs.readFileSync(docPath, "utf-8");
    expect(content).toContain("| Entitas Data |");
    expect(content).toContain("| Sumber Browser (localStorage) |");
    expect(content).toContain("| Sumber Server Saat Ini |");
    expect(content).toContain("| Status |");
    expect(content).toContain("| Prioritas Migrasi |");
  });

  it("4. Mengidentifikasi data yang 100% hanya ada di browser vs hybrid server", () => {
    const content = fs.readFileSync(docPath, "utf-8");
    // Entities that are browser only
    expect(content).toContain("dagoeng_employees_v1");
    expect(content).toContain("dagoeng_master_products_v1");
    expect(content).toContain("dagoeng_loyalty_members_v3");
    // Entities that have server persistence
    expect(content).toContain("/api/orders");
    expect(content).toContain("/api/shifts");
    expect(content).toContain("/api/audit-logs");
  });

  it("5. Memuat rencana migrasi bertahap yang terstruktur untuk dibahas bersama Ka Ari", () => {
    const content = fs.readFileSync(docPath, "utf-8");
    expect(content).toContain("Rencana Migrasi ke Server");
    expect(content).toContain("Fase 1");
    expect(content).toContain("Fase 2");
    expect(content).toContain("Fase 3");
  });

  it("6. Mendokumentasikan seluruh kunci localStorage aktual lintas modul inti serta kunci lokal perangkat", () => {
    const content = fs.readFileSync(docPath, "utf-8");
    const allCoreAndDeviceKeys = [
      "dagoeng_sync_outbox_v1",
      "dagoeng_orders_v3",
      "dagoeng_shifts_v3",
      "dagoeng_audit_trail_persistent_v3",
      "dagoeng_loyalty_members_v3",
      "dagoeng_employees_v1",
      "dagoeng_master_products_v1",
      "dagoeng_master_categories_v1",
      "dagoeng_cwk_bookings_v3",
      "dagoeng_cwk_spaces_v3",
      "dagoeng_cwk_members_v3",
      "dagoeng_cwk_logs_v3",
      "dagoeng_platform_settings_v1",
      "dagoeng_inventory_ingredients_v3",
      "dagoeng_inventory_recipes_v3",
      "dagoeng_inventory_pos_v3",
      "dagoeng_inventory_logs_v3",
      "dagoeng_inventory_opnames_v1",
      "dagoeng_tables_areas_v3",
      "dagoeng_tables_reservations_v3",
      "dagoeng_commercial_leases_v3",
      "dagoeng_tenant_settings_v1",
      "dago_custom_tenants",
      "dagoeng_settlement_receipt_policy_v1",
      "dagoeng_tenant_revenue_splits_v1",
      "dagoeng_wifi_fnb_rules_v1",
      "dagoeng_wifi_cw_rules_v1",
      "dagoeng_wifi_vouchers_v1",
      "dagoeng_wifi_calc_basis_v1",
      "dagoeng_simulated_org_sub_v1",
      "dagoeng_simulated_tenant_addons_v1",
      "dagoeng_printer_devices_v1",
      "dagoeng_printer_settings_v1",
      "dagoeng_print_queue_v1",
      "dagoeng_nota_seq_v1",
      "dagoeng_notifications_v3",
      "dagoeng_theme_preference",
      "dagoeng_active_persona",
      "dagoeng_custom_customer",
      "dagoeng_is_logged_out",
      "dagoeng_last_activity_at",
      "dago_organizer_email",
      "dago_my_event_tickets",
      "dagoeng_guest_identity_v1",
      "dagoeng_cwk_plans_v1",
      "dagoeng_simulated_tenant_addons_v1_scopes",
    ];

    for (const key of allCoreAndDeviceKeys) {
      expect(content).toContain(key);
    }
  });

  it("7. Mencatat hasil akhir pasca-migrasi V-06 termasuk seluruh endpoint /api/sync/* dan /api/orders/self-order", () => {
    const content = fs.readFileSync(docPath, "utf-8");
    const syncedEndpoints = [
      "/api/orders/self-order",
      "/api/sync/platform-settings",
      "/api/sync/tenants",
      "/api/sync/wifi",
      "/api/sync/subscription",
      "/api/sync/printer-config",
      "/api/sync/inventory",
      "/api/sync/tables",
      "/api/sync/coworking-master",
      "/api/sync/commercial",
    ];

    for (const endpoint of syncedEndpoints) {
      expect(content).toContain(endpoint);
    }
  });
});
