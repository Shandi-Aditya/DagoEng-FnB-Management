import { describe, it, expect, beforeEach } from "vitest";
import {
  registerUnifiedUser,
  findUnifiedUserByEmail,
  verifyUnifiedUserPassword,
  activateOrganizerSelfService,
  loadUnifiedUsersFromDisk,
} from "../src/lib/unified-account";
import { getOrganizerByEmail, isOrganizerActive } from "../src/lib/organizers";
import { verifyOrganizerCredentials } from "../src/lib/organizer-activation";

describe("Unified Account & Self-Service Organizer Onboarding (Target A)", () => {
  const testEmail = `test.user.${Date.now()}@example.com`;
  const testPassword = "Password123!";

  it("1. Pengguna dapat mendaftar akun DagoEng satu kali", async () => {
    const result = await registerUnifiedUser({
      name: "Budi Santoso",
      email: testEmail,
      phone: "+62 812-9988-1122",
      password: testPassword,
    });

    expect(result.isExisting).toBe(false);
    expect(result.user.email).toBe(testEmail.toLowerCase());
    expect(result.user.name).toBe("Budi Santoso");
    expect(result.user.role).toBe("CUSTOMER");

    const found = findUnifiedUserByEmail(testEmail);
    expect(found).not.toBeNull();
    expect(found?.email).toBe(testEmail.toLowerCase());
  });

  it("2. Registrasi ulang dengan email yang sama tidak membuat identitas duplikat", async () => {
    const secondReg = await registerUnifiedUser({
      name: "Budi Santoso Clone",
      email: testEmail,
      phone: "+62 812-9988-1122",
      password: testPassword,
    });

    expect(secondReg.isExisting).toBe(true);
    expect(secondReg.user.email).toBe(testEmail.toLowerCase());

    // Pastikan tidak ada duplikasi akun di storage
    const allUsers = loadUnifiedUsersFromDisk();
    const matchingUsers = allUsers.filter((u) => u.email.toLowerCase() === testEmail.toLowerCase());
    expect(matchingUsers.length).toBe(1);
  });

  it("3. Verifikasi password akun terpadu bekerja dengan benar", async () => {
    // Password benar
    const authSuccess = await verifyUnifiedUserPassword(testEmail, testPassword);
    expect(authSuccess.success).toBe(true);
    expect(authSuccess.user?.email).toBe(testEmail.toLowerCase());

    // Password salah
    const authFail = await verifyUnifiedUserPassword(testEmail, "WrongPassword123!");
    expect(authFail.success).toBe(false);
    expect(authFail.error).toContain("Password yang Anda masukkan salah");
  });

  it("4. Pengguna dapat mengaktifkan profil Organizer menggunakan akun yang sudah ada (Self-Service)", async () => {
    const onboardResult = await activateOrganizerSelfService(testEmail, {
      organizationName: "Komunitas Desain Bandung",
      category: "Komunitas Kreatif",
      notes: "Inisiatif desainer lokal",
    });

    expect(onboardResult.success).toBe(true);
    expect(onboardResult.organizer.name).toBe("Komunitas Desain Bandung");
    expect(onboardResult.organizer.email).toBe(testEmail.toLowerCase());
    expect(onboardResult.organizer.status).toBe("ACTIVE");

    // Akun unified kini memiliki organizerProfileId
    expect(onboardResult.user.organizerProfileId).toBe(onboardResult.organizer.id);

    // Profil tersimpan dan aktif di organizers.json
    const org = getOrganizerByEmail(testEmail);
    expect(org).not.toBeNull();
    expect(org?.status).toBe("ACTIVE");
    expect(isOrganizerActive(testEmail)).toBe(true);
  });

  it("5. Kredensial akun terpadu otomatis sinkron dengan login organizer", async () => {
    const credResult = await verifyOrganizerCredentials(testEmail, testPassword);
    expect(credResult.success).toBe(true);
    expect(credResult.user?.email).toBe(testEmail.toLowerCase());
  });

  it("6. Organizer dapat kembali menggunakan identitas yang sama sebagai Customer", async () => {
    const user = findUnifiedUserByEmail(testEmail);
    expect(user).not.toBeNull();
    // Memiliki role Customer sekaligus terhubung ke Organizer
    expect(user?.email).toBe(testEmail.toLowerCase());
    expect(user?.organizerProfileId).toBeDefined();
  });
});
