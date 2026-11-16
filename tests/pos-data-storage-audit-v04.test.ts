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
});
