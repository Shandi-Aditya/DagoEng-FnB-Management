import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { registerUnifiedUser, verifyUnifiedUserPassword } from "../src/lib/unified-account";
import { createOrganizer } from "../src/lib/organizers";
import { verifyOrganizerCredentials } from "../src/lib/organizer-activation";
import { db } from "../src/lib/db";
import { POST as handleRegister } from "@/app/api/auth/register/route";

const FORMER_MASTER_PASSWORDS = ["Password123!", "demo"];

function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@example.com`;
}

function registerRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Akun nyata hanya menerima password bcrypt miliknya sendiri", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(FORMER_MASTER_PASSWORDS)("akun terpadu menolak password universal %s", async (masterPassword) => {
    const email = uniqueEmail("no-master");
    await registerUnifiedUser({ name: "Rina Wulandari", email, phone: "+62 812-3344-5566", password: "RahasiaRina9" });

    const result = await verifyUnifiedUserPassword(email, masterPassword);

    expect(result.success).toBe(false);
  });

  it("akun terpadu tetap menerima password miliknya", async () => {
    const email = uniqueEmail("own-password");
    await registerUnifiedUser({ name: "Rina Wulandari", email, phone: "+62 812-3344-5566", password: "RahasiaRina9" });

    const result = await verifyUnifiedUserPassword(email, "RahasiaRina9");

    expect(result.success).toBe(true);
  });

  it.each(FORMER_MASTER_PASSWORDS)("akun penyelenggara di database menolak password universal %s", async (masterPassword) => {
    const email = uniqueEmail("org-no-master");
    createOrganizer({
      name: "Komunitas Uji Sandi",
      email,
      contactPerson: "Rina Wulandari",
      phone: "+62 812-1111-2222",
      category: "Komunitas",
    } as Parameters<typeof createOrganizer>[0]);
    const passwordHash = await bcrypt.hash("SandiOrganizer7", 10);
    vi.spyOn(db.user, "findUnique").mockResolvedValue({
      id: "user-db-org",
      email,
      name: "Komunitas Uji Sandi",
      phone: null,
      passwordHash,
      isActive: true,
    } as never);

    const result = await verifyOrganizerCredentials(email, masterPassword);

    expect(result.success).toBe(false);
  });
});

describe("Registrasi wajib memakai password pilihan pengguna", () => {
  it.each([undefined, "", "   ", "12345"])("registerUnifiedUser menolak password %j", async (password) => {
    await expect(
      registerUnifiedUser({ name: "Tanpa Sandi", email: uniqueEmail("no-pass"), phone: "+62 812-7777-8888", password }),
    ).rejects.toThrow("Password minimal 6 karakter.");
  });

  it("POST /api/auth/register tanpa password ditolak 400 dengan pesan jelas", async () => {
    const res = await handleRegister(
      registerRequest({ name: "Tanpa Sandi", email: uniqueEmail("route-no-pass"), phone: "+62 812-7777-8888" }),
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Password minimal 6 karakter.");
  });

  it("form daftar di halaman login tidak lagi mengisi password default", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/(auth)/login/page.tsx"), "utf-8");

    expect(source).not.toContain("Password123!");
  });
});
