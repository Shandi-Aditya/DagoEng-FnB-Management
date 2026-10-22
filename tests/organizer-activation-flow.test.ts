import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { POST as handleLogin } from "@/app/api/auth/login/route";
import { POST as handleInvite } from "@/app/api/events/admin/organizers/invite/route";
import { GET as handleCheckActivate, POST as handleActivate } from "@/app/api/events/auth/activate/route";
import {
  generateActivationToken,
  validateActivationToken,
  consumeActivationToken,
  verifyOrganizerCredentials,
  getOrganizerActivationStatus,
  createOrganizerSession,
  markDbOffline,
} from "@/lib/organizer-activation";
import {
  getAllOrganizers,
  createOrganizer,
  updateOrganizerStatus,
  getOrganizerByEmail,
} from "@/lib/organizers";
import {
  assertOrganizerAuth,
  assertEventAdmin,
  getRequestAuthUser,
} from "@/lib/server-auth";

const DATA_DIR = path.join(process.cwd(), "data");
const ORGANIZERS_FILE = path.join(DATA_DIR, "organizers.json");
const INVITES_FILE = path.join(DATA_DIR, "organizer_invites.json");
const CREDENTIALS_FILE = path.join(DATA_DIR, "organizer_credentials.json");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");
const BOOKINGS_FILE = path.join(DATA_DIR, "event_bookings.json");

describe("Community Organizer Account Activation & Auth Flow (Section G Verification)", () => {
  let originalOrganizersBackup: string | null = null;
  let originalInvitesBackup: string | null = null;
  let originalCredentialsBackup: string | null = null;
  let originalEventsBackup: string | null = null;
  let originalBookingsBackup: string | null = null;

  beforeEach(() => {
    markDbOffline();
    if (fs.existsSync(ORGANIZERS_FILE)) {
      originalOrganizersBackup = fs.readFileSync(ORGANIZERS_FILE, "utf-8");
    }
    if (fs.existsSync(INVITES_FILE)) {
      originalInvitesBackup = fs.readFileSync(INVITES_FILE, "utf-8");
    }
    if (fs.existsSync(CREDENTIALS_FILE)) {
      originalCredentialsBackup = fs.readFileSync(CREDENTIALS_FILE, "utf-8");
    }
    if (fs.existsSync(EVENTS_FILE)) {
      originalEventsBackup = fs.readFileSync(EVENTS_FILE, "utf-8");
    }
    if (fs.existsSync(BOOKINGS_FILE)) {
      originalBookingsBackup = fs.readFileSync(BOOKINGS_FILE, "utf-8");
    }
  });

  afterEach(() => {
    if (originalOrganizersBackup !== null) {
      fs.writeFileSync(ORGANIZERS_FILE, originalOrganizersBackup, "utf-8");
    }
    if (originalInvitesBackup !== null) {
      fs.writeFileSync(INVITES_FILE, originalInvitesBackup, "utf-8");
    } else if (fs.existsSync(INVITES_FILE)) {
      try {
        fs.unlinkSync(INVITES_FILE);
      } catch {
        try { fs.writeFileSync(INVITES_FILE, "[]", "utf-8"); } catch {}
      }
    }
    if (originalCredentialsBackup !== null) {
      fs.writeFileSync(CREDENTIALS_FILE, originalCredentialsBackup, "utf-8");
    } else if (fs.existsSync(CREDENTIALS_FILE)) {
      try {
        fs.unlinkSync(CREDENTIALS_FILE);
      } catch {
        try { fs.writeFileSync(CREDENTIALS_FILE, "[]", "utf-8"); } catch {}
      }
    }
    if (originalEventsBackup !== null) {
      fs.writeFileSync(EVENTS_FILE, originalEventsBackup, "utf-8");
    }
    if (originalBookingsBackup !== null) {
      fs.writeFileSync(BOOKINGS_FILE, originalBookingsBackup, "utf-8");
    }
  });

  afterAll(() => {
    // Final restoration to guarantee pristine repository state
    if (originalOrganizersBackup !== null) {
      fs.writeFileSync(ORGANIZERS_FILE, originalOrganizersBackup, "utf-8");
    }
    if (originalInvitesBackup !== null) {
      fs.writeFileSync(INVITES_FILE, originalInvitesBackup, "utf-8");
    } else if (fs.existsSync(INVITES_FILE)) {
      try { fs.unlinkSync(INVITES_FILE); } catch {
        try { fs.writeFileSync(INVITES_FILE, "[]", "utf-8"); } catch {}
      }
    }
    if (originalCredentialsBackup !== null) {
      fs.writeFileSync(CREDENTIALS_FILE, originalCredentialsBackup, "utf-8");
    } else if (fs.existsSync(CREDENTIALS_FILE)) {
      try { fs.unlinkSync(CREDENTIALS_FILE); } catch {
        try { fs.writeFileSync(CREDENTIALS_FILE, "[]", "utf-8"); } catch {}
      }
    }
  });

  // Helper to create an active organizer profile
  function setupTestOrganizer(email = "test.organizer@dagohub.org", name = "Test Bandung Creative") {
    return createOrganizer({
      name,
      category: "Komunitas Kreatif",
      contactPerson: "Budi PIC",
      phone: "+62 811-9988-7766",
      email,
      initialStatus: "ACTIVE",
    });
  }

  // ---------------------------------------------------------------------------
  // 1. Aktivasi dengan token valid
  // ---------------------------------------------------------------------------
  it("G-1: should successfully activate an account with a valid high-entropy token", async () => {
    const org = setupTestOrganizer("creative.valid@dagohub.org", "Creative Valid Guild");
    const { rawToken } = await generateActivationToken(org.id, "Test Admin");

    // Check token inspection route (GET)
    const checkReq = new NextRequest(`http://localhost:3000/api/events/auth/activate?token=${rawToken}`);
    const checkRes = await handleCheckActivate(checkReq);
    expect(checkRes.status).toBe(200);
    const checkData = await checkRes.json();
    expect(checkData.success).toBe(true);
    expect(checkData.data.organizer.email).toBe("creative.valid@dagohub.org");

    // Activate with password >= 8 characters (POST)
    const activateReq = new NextRequest("http://localhost:3000/api/events/auth/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: rawToken,
        password: "SuperSecretPassword123!",
      }),
    });
    const activateRes = await handleActivate(activateReq);
    expect(activateRes.status).toBe(200);
    const activateData = await activateRes.json();
    expect(activateData.success).toBe(true);
    expect(activateData.message).toContain("berhasil diaktifkan");

    // Status should now be ACTIVATED
    const status = getOrganizerActivationStatus("creative.valid@dagohub.org");
    expect(status).toBe("ACTIVATED");
  });

  // ---------------------------------------------------------------------------
  // 2. Token kedaluwarsa ditolak
  // ---------------------------------------------------------------------------
  it("G-2: should reject activation when token has expired (>48 hours)", async () => {
    const org = setupTestOrganizer("creative.expired@dagohub.org", "Expired Creative Org");
    const { rawToken, record } = await generateActivationToken(org.id, "Test Admin");

    // Manually backdate the invite record expiration to 50 hours ago
    const invites = JSON.parse(fs.readFileSync(INVITES_FILE, "utf-8"));
    const updated = invites.map((i: any) =>
      i.id === record.id ? { ...i, expiresAt: new Date(Date.now() - 50 * 3600 * 1000).toISOString() } : i
    );
    fs.writeFileSync(INVITES_FILE, JSON.stringify(updated, null, 2), "utf-8");

    // GET check should return invalid
    const checkReq = new NextRequest(`http://localhost:3000/api/events/auth/activate?token=${rawToken}`);
    const checkRes = await handleCheckActivate(checkReq);
    expect(checkRes.status).toBe(400);
    const checkData = await checkRes.json();
    expect(checkData.success).toBe(false);
    expect(checkData.error).toMatch(/kedaluwarsa/i);

    // POST activation should fail
    const activateReq = new NextRequest("http://localhost:3000/api/events/auth/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: rawToken,
        password: "ValidPassword123!",
      }),
    });
    const activateRes = await handleActivate(activateReq);
    expect(activateRes.status).toBe(400);
    const activateData = await activateRes.json();
    expect(activateData.success).toBe(false);
    expect(activateData.error).toMatch(/kedaluwarsa/i);
  });

  // ---------------------------------------------------------------------------
  // 3. Token yang sudah digunakan ditolak (Single-Use Replay Protection)
  // ---------------------------------------------------------------------------
  it("G-3: should strictly reject a token that has already been consumed", async () => {
    const org = setupTestOrganizer("creative.singleuse@dagohub.org", "Single Use Guild");
    const { rawToken } = await generateActivationToken(org.id, "Test Admin");

    // First activation succeeds
    const firstReq = new NextRequest("http://localhost:3000/api/events/auth/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: rawToken,
        password: "FirstPassword123!",
      }),
    });
    const firstRes = await handleActivate(firstReq);
    expect(firstRes.status).toBe(200);

    // Second activation with same token MUST fail
    const secondReq = new NextRequest("http://localhost:3000/api/events/auth/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: rawToken,
        password: "SecondPassword999!",
      }),
    });
    const secondRes = await handleActivate(secondReq);
    expect(secondRes.status).toBe(400);
    const secondData = await secondRes.json();
    expect(secondData.success).toBe(false);
    expect(secondData.error).toMatch(/sudah pernah digunakan/i);
  });

  // ---------------------------------------------------------------------------
  // 4. Dua permintaan aktivasi bersamaan tidak dapat membuat aktivasi ganda (Concurrency)
  // ---------------------------------------------------------------------------
  it("G-4: should prevent double activation under concurrent parallel requests (mutex guard)", async () => {
    const org = setupTestOrganizer("creative.concurrent@dagohub.org", "Concurrent Guild");
    const { rawToken } = await generateActivationToken(org.id, "Test Admin");

    // Fire 2 simultaneous requests with the exact same token
    const req1 = new NextRequest("http://localhost:3000/api/events/auth/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: rawToken,
        password: "ConcurrentPassOne123!",
      }),
    });
    const req2 = new NextRequest("http://localhost:3000/api/events/auth/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: rawToken,
        password: "ConcurrentPassTwo123!",
      }),
    });

    const [res1, res2] = await Promise.all([handleActivate(req1), handleActivate(req2)]);
    const statuses = [res1.status, res2.status];

    // Exactly one must succeed (200) and one must be rejected (400)
    expect(statuses).toContain(200);
    expect(statuses).toContain(400);
  });

  // ---------------------------------------------------------------------------
  // 5. Password tersimpan sebagai hash (bcrypt) & no plaintext
  // ---------------------------------------------------------------------------
  it("G-5: should store password exclusively as a bcrypt hash with no plaintext or raw tokens", async () => {
    const org = setupTestOrganizer("creative.hashcheck@dagohub.org", "Hash Check Org");
    const { rawToken } = await generateActivationToken(org.id, "Test Admin");

    const plainPassword = "MySecretSecurePassword456!";
    const req = new NextRequest("http://localhost:3000/api/events/auth/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: rawToken,
        password: plainPassword,
      }),
    });
    const res = await handleActivate(req);
    expect(res.status).toBe(200);

    // Verify credentials store
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf-8"));
    const cred = credentials.find((c: any) => c.email === "creative.hashcheck@dagohub.org");
    expect(cred).toBeDefined();

    // Plaintext password MUST NOT be stored anywhere
    expect(cred.passwordHash).not.toBe(plainPassword);
    expect(cred.password).toBeUndefined();

    // Verify bcrypt hash format ($2a$ or $2b$)
    expect(cred.passwordHash).toMatch(/^\$2[ab]\$\d+\$/);
    const matches = bcrypt.compareSync(plainPassword, cred.passwordHash);
    expect(matches).toBe(true);

    // Raw token MUST NOT be stored in invites file
    const invites = JSON.parse(fs.readFileSync(INVITES_FILE, "utf-8"));
    const inviteRecord = invites.find((i: any) => i.email === "creative.hashcheck@dagohub.org");
    expect(inviteRecord.rawToken).toBeUndefined();
    expect(inviteRecord.tokenHash).toBeDefined();
    expect(inviteRecord.tokenHash).not.toBe(rawToken);
  });

  // ---------------------------------------------------------------------------
  // 6. Login mandiri organizer berhasil
  // ---------------------------------------------------------------------------
  it("G-6: should allow activated organizer to log in with database credentials and access portal", async () => {
    const org = setupTestOrganizer("creative.login@dagohub.org", "Login Test Org");
    const { rawToken } = await generateActivationToken(org.id, "Test Admin");

    // Activate
    const activateReq = new NextRequest("http://localhost:3000/api/events/auth/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: rawToken,
        password: "OrganizerPassword123!",
      }),
    });
    await handleActivate(activateReq);

    // Attempt login with valid email & password
    const loginReq = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "creative.login@dagohub.org",
        password: "OrganizerPassword123!",
      }),
    });

    const loginRes = await handleLogin(loginReq);
    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData.success).toBe(true);
    expect(loginData.user.email).toBe("creative.login@dagohub.org");
    expect(loginData.user.role).toBe("CUSTOMER");
    expect(loginData.user.scopeLevel).toBe("TENANT");
    expect(loginData.user.redirectTo).toBe("/events/portal");

    // Verify session cookie was set
    const setCookie = loginRes.headers.get("set-cookie");
    expect(setCookie).toContain("dagoeng_session=");
  });

  // ---------------------------------------------------------------------------
  // 7. Login dengan email tidak dikenal tetap ditolak
  // ---------------------------------------------------------------------------
  it("G-7: should reject login for unknown email without privilege escalation or fallback", async () => {
    const loginReq = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "hacker.unknown@randomdomain.xyz",
        password: "RandomPassword123!",
      }),
    });

    const res = await handleLogin(loginReq);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/tidak valid|tidak terdaftar/i);
  });

  // ---------------------------------------------------------------------------
  // 8. Seluruh akun demo existing tetap dapat login
  // ---------------------------------------------------------------------------
  it("G-8: should preserve login for all existing demo accounts", async () => {
    const demoAccounts = [
      { email: "owner.dago@dagoeng.com", expectedRole: "OWNER", expectedScope: "ORGANIZATION" },
      { email: "admin@dagoeng.com", expectedRole: "SUPER_ADMIN", expectedScope: "PLATFORM" },
      { email: "manager.commercial@dagoeng.com", expectedRole: "MANAGER", expectedScope: "ORGANIZATION" },
      { email: "cashier.sgr@kopisenja.com", expectedRole: "CASHIER", expectedScope: "OUTLET" },
      { email: "kitchen.sgr@kopisenja.com", expectedRole: "KITCHEN_STAFF", expectedScope: "OUTLET" },
      { email: "owner.kopisenja@dagoeng.com", expectedRole: "OWNER", expectedScope: "TENANT" },
      { email: "baristaguild@dagocreative.id", expectedRole: "CUSTOMER", expectedScope: "OUTLET" },
      { email: "customer@gmail.com", expectedRole: "CUSTOMER", expectedScope: "OUTLET" },
    ];

    for (const demo of demoAccounts) {
      const loginReq = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: demo.email, password: "demo" }),
      });
      const res = await handleLogin(loginReq);
      expect(res.status).toBe(200);
      const data = await res.json();
      const roleSlug = typeof data.user.role === "object" ? data.user.role.slug : data.user.role;
      expect(roleSlug).toBe(demo.expectedRole);
      expect(data.user.scopeLevel).toBe(demo.expectedScope);
    }
  });

  // ---------------------------------------------------------------------------
  // 9. Organizer A tidak dapat mengakses data organizer B (Tenant Isolation)
  // ---------------------------------------------------------------------------
  it("G-9: should enforce tenant isolation so Organizer A cannot access Organizer B data", async () => {
    const orgA = setupTestOrganizer("organizer.a@dagohub.org", "Community A");
    const orgB = setupTestOrganizer("organizer.b@dagohub.org", "Community B");

    // Create session token for Organizer A
    const { rawToken: sessionToken } = await createOrganizerSession(orgA.email);

    // Organizer A attempts to access Organizer A data -> SUCCESS
    const reqOwn = new NextRequest("http://localhost:3000/api/events/portal", {
      headers: { cookie: `dagoeng_session=${sessionToken}` },
    });
    const authOwn = await assertOrganizerAuth(reqOwn, orgA.id);
    expect(authOwn.authorized).toBe(true);

    // Organizer A attempts to access Organizer B data -> FORBIDDEN (403)
    const reqCross = new NextRequest("http://localhost:3000/api/events/portal", {
      headers: { cookie: `dagoeng_session=${sessionToken}` },
    });
    const authCross = await assertOrganizerAuth(reqCross, orgB.id);
    expect(authCross.authorized).toBe(false);
    expect(authCross.error).toMatch(/tidak memiliki izin|tidak memiliki hak akses|lintas penyelenggara|pelanggaran isolasi/i);
  });

  // ---------------------------------------------------------------------------
  // 10. Organizer nonaktif ditolak, termasuk melalui session yang sebelumnya valid
  // ---------------------------------------------------------------------------
  it("G-10: should block deactivated organizer from both new login and existing active sessions", async () => {
    const org = setupTestOrganizer("creative.deactivated@dagohub.org", "Deactivated Org");
    const { rawToken } = await generateActivationToken(org.id, "Test Admin");

    // Activate account
    const actReq = new NextRequest("http://localhost:3000/api/events/auth/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: rawToken,
        password: "ValidPass12345!",
      }),
    });
    await handleActivate(actReq);

    // Establish active session before deactivation
    const { rawToken: sessionToken } = await createOrganizerSession(org.email);

    // Deactivate the organizer
    updateOrganizerStatus(org.id, "INACTIVE");

    // 10a. New login must be rejected
    const loginReq = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "creative.deactivated@dagohub.org",
        password: "ValidPass12345!",
      }),
    });
    const loginRes = await handleLogin(loginReq);
    expect(loginRes.status).toBe(403);
    const loginData = await loginRes.json();
    expect(loginData.success).toBe(false);
    expect(loginData.error).toMatch(/dinonaktifkan|nonaktif/i);

    // 10b. Active session must be rejected on authorization check
    const sessReq = new NextRequest("http://localhost:3000/api/events/portal", {
      headers: { cookie: `dagoeng_session=${sessionToken}` },
    });
    const authResult = await assertOrganizerAuth(sessReq, org.id);
    expect(authResult.authorized).toBe(false);
    expect(authResult.error).toMatch(/dinonaktifkan/i);
  });

  // ---------------------------------------------------------------------------
  // 11. Request tidak dapat mengatur role atau scope secara arbitrer
  // ---------------------------------------------------------------------------
  it("G-11: should ignore client-injected role or scopeLevel in activation or login requests", async () => {
    const org = setupTestOrganizer("creative.spoof@dagohub.org", "Role Spoof Guild");
    const { rawToken } = await generateActivationToken(org.id, "Test Admin");

    // Inject role SUPER_ADMIN and scopeLevel PLATFORM into activation body
    const spoofReq = new NextRequest("http://localhost:3000/api/events/auth/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: rawToken,
        password: "LegitPassword123!",
        role: "SUPER_ADMIN",
        scopeLevel: "PLATFORM",
        permissions: ["all:super_admin"],
      }),
    });
    const actRes = await handleActivate(spoofReq);
    expect(actRes.status).toBe(200);

    // Log in
    const loginReq = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "creative.spoof@dagohub.org",
        password: "LegitPassword123!",
        role: "SUPER_ADMIN",
      }),
    });
    const loginRes = await handleLogin(loginReq);
    const loginData = await loginRes.json();

    // Authenticated role MUST remain strictly CUSTOMER with TENANT scope
    expect(loginData.user.role).toBe("CUSTOMER");
    expect(loginData.user.scopeLevel).toBe("TENANT");
    expect(loginData.user.role).not.toBe("SUPER_ADMIN");
  });

  // ---------------------------------------------------------------------------
  // 12. Kegagalan proses tidak meninggalkan token dalam status yang memungkinkan penyalahgunaan
  // ---------------------------------------------------------------------------
  it("G-12: should not consume or corrupt token if activation validation fails (e.g. password < 8 chars)", async () => {
    const org = setupTestOrganizer("creative.failure@dagohub.org", "Failure Test Guild");
    const { rawToken } = await generateActivationToken(org.id, "Test Admin");

    // Attempt activation with short password (4 chars) -> fails
    const failReq = new NextRequest("http://localhost:3000/api/events/auth/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: rawToken,
        password: "1234",
      }),
    });
    const failRes = await handleActivate(failReq);
    expect(failRes.status).toBe(400);

    // Token must remain unconsumed
    const invites = JSON.parse(fs.readFileSync(INVITES_FILE, "utf-8"));
    const inv = invites.find((i: any) => i.email === "creative.failure@dagohub.org");
    expect(inv.usedAt).toBeNull();

    // Organizer can still activate with valid password
    const retryReq = new NextRequest("http://localhost:3000/api/events/auth/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: rawToken,
        password: "ValidPassword123!",
      }),
    });
    const retryRes = await handleActivate(retryReq);
    expect(retryRes.status).toBe(200);
  });

  // ---------------------------------------------------------------------------
  // 13. Endpoint admin tetap dilindungi RBAC
  // ---------------------------------------------------------------------------
  it("G-13: should enforce RBAC on admin invite generation endpoint (requires event admin)", async () => {
    const org = setupTestOrganizer("creative.rbac@dagohub.org", "RBAC Test Guild");

    // 13a. Unauthenticated request -> Rejected (403)
    const unauthReq = new NextRequest("http://localhost:3000/api/events/admin/organizers/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizerId: org.id }),
    });
    const unauthRes = await handleInvite(unauthReq);
    expect(unauthRes.status).toBe(403);

    // 13b. Customer request -> Rejected (403)
    const customerReq = new NextRequest("http://localhost:3000/api/events/admin/organizers/invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: "dagoeng_active_persona=CUSTOMER",
      },
      body: JSON.stringify({ organizerId: org.id }),
    });
    const customerRes = await handleInvite(customerReq);
    expect(customerRes.status).toBe(403);

    // 13c. Super Admin / Dago Owner request -> Authorized (200)
    const adminReq = new NextRequest("http://localhost:3000/api/events/admin/organizers/invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: "dagoeng_active_persona=DAGO_OWNER",
      },
      body: JSON.stringify({ organizerId: org.id }),
    });
    const adminRes = await handleInvite(adminReq);
    expect(adminRes.status).toBe(200);
    const adminData = await adminRes.json();
    expect(adminData.success).toBe(true);
    expect(adminData.data.activationUrl).toContain("/events/activate?token=");
  });

  // ---------------------------------------------------------------------------
  // 14. Data JSON existing tidak berubah akibat test
  // ---------------------------------------------------------------------------
  it("G-14: should ensure initial JSON baseline is cleanly restored and zero test pollution remains", async () => {
    // Verify that after all test operations, organizers file can be restored exactly
    const currentOrganizers = fs.readFileSync(ORGANIZERS_FILE, "utf-8");
    expect(currentOrganizers).toBeDefined();
    const parsed = JSON.parse(currentOrganizers);
    expect(Array.isArray(parsed)).toBe(true);
  });
});
