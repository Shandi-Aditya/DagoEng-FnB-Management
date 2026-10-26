import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { POST as handleLogin } from "../src/app/api/auth/login/route";
import { POST as handleActivate, GET as handleCheckActivate } from "../src/app/api/events/auth/activate/route";
import {
  generateActivationToken,
  consumeActivationTokenAndSetPassword,
  verifyOrganizerCredentials,
  createOrganizerSession,
  getOrganizerSession,
  markDbOffline,
  isLocalDevFallbackAllowed,
  __setMockCredWriteFailure,
  __setMockInviteWriteFailure,
} from "../src/lib/organizer-activation";
import {
  getAllOrganizers,
  createOrganizer,
  getOrganizerByEmail,
  isOrganizerActive,
} from "../src/lib/organizers";
import {
  assertOrganizerAuth,
  getServerAuthSession,
} from "../src/lib/server-auth";

const DATA_DIR = process.env.DATA_DIR_OVERRIDE || path.join(process.cwd(), "data");
const ORGANIZERS_FILE = path.join(DATA_DIR, "organizers.json");
const INVITES_FILE = path.join(DATA_DIR, "organizer_invites.json");
const CREDENTIALS_FILE = path.join(DATA_DIR, "organizer_credentials.json");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");
const BOOKINGS_FILE = path.join(DATA_DIR, "event_bookings.json");

describe("Hardening Organizer Activation & Failure Scenarios (Section H)", () => {
  let originalOrganizersBackup: string | null = null;
  let originalInvitesBackup: string | null = null;
  let originalCredentialsBackup: string | null = null;
  let originalEventsBackup: string | null = null;
  let originalBookingsBackup: string | null = null;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    markDbOffline();
    __setMockCredWriteFailure(null);
    __setMockInviteWriteFailure(null);
    process.env.NODE_ENV = "test";

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
    __setMockCredWriteFailure(null);
    __setMockInviteWriteFailure(null);
    process.env.NODE_ENV = originalEnv;

    if (originalOrganizersBackup !== null) {
      fs.writeFileSync(ORGANIZERS_FILE, originalOrganizersBackup, "utf-8");
    }
    if (originalInvitesBackup !== null) {
      fs.writeFileSync(INVITES_FILE, originalInvitesBackup, "utf-8");
    } else if (fs.existsSync(INVITES_FILE)) {
      try { fs.writeFileSync(INVITES_FILE, "[]", "utf-8"); } catch {}
    }
    if (originalCredentialsBackup !== null) {
      fs.writeFileSync(CREDENTIALS_FILE, originalCredentialsBackup, "utf-8");
    } else if (fs.existsSync(CREDENTIALS_FILE)) {
      try { fs.writeFileSync(CREDENTIALS_FILE, "[]", "utf-8"); } catch {}
    }
    if (originalEventsBackup !== null) {
      fs.writeFileSync(EVENTS_FILE, originalEventsBackup, "utf-8");
    }
    if (originalBookingsBackup !== null) {
      fs.writeFileSync(BOOKINGS_FILE, originalBookingsBackup, "utf-8");
    }
  });

  afterAll(() => {
    __setMockCredWriteFailure(null);
    __setMockInviteWriteFailure(null);
    process.env.NODE_ENV = originalEnv;

    if (originalOrganizersBackup !== null) {
      fs.writeFileSync(ORGANIZERS_FILE, originalOrganizersBackup, "utf-8");
    }
    if (originalInvitesBackup !== null) {
      fs.writeFileSync(INVITES_FILE, originalInvitesBackup, "utf-8");
    }
    if (originalCredentialsBackup !== null) {
      fs.writeFileSync(CREDENTIALS_FILE, originalCredentialsBackup, "utf-8");
    }
    if (originalEventsBackup !== null) {
      fs.writeFileSync(EVENTS_FILE, originalEventsBackup, "utf-8");
    }
    if (originalBookingsBackup !== null) {
      fs.writeFileSync(BOOKINGS_FILE, originalBookingsBackup, "utf-8");
    }
  });

  function setupTestOrganizer(email: string, name: string) {
    const existing = getOrganizerByEmail(email);
    if (existing) return existing;
    return createOrganizer({
      name,
      category: "Komunitas Kreatif",
      contactPerson: "Test PIC",
      phone: "+62 811-2233-4455",
      email,
      initialStatus: "ACTIVE",
    });
  }

  // ---------------------------------------------------------------------------
  // 1. Kegagalan penyimpanan kredensial setelah proses hash
  // ---------------------------------------------------------------------------
  it("H-1: should NOT mark token consumed if credential saving fails after password hash", async () => {
    const org = setupTestOrganizer("h1.credfail@dagohub.org", "H1 Credential Fail Guild");
    const { rawToken } = await generateActivationToken(org.id, "Test Admin");

    // Simulate disk failure during credential storage
    __setMockCredWriteFailure(new Error("EACCES: Disk write permission denied"));

    // Attempt activation
    await expect(
      consumeActivationTokenAndSetPassword(rawToken, "ValidPassword123!")
    ).rejects.toThrow("Gagal menyimpan kredensial akun penyelenggara");

    // Reset failure hook
    __setMockCredWriteFailure(null);

    // Verify token was NOT marked consumed
    const invites = JSON.parse(fs.readFileSync(INVITES_FILE, "utf-8"));
    const inv = invites.find((i: any) => i.email === "h1.credfail@dagohub.org");
    expect(inv).toBeDefined();
    expect(inv.usedAt).toBeNull();

    // Verify no credentials were leaked or stored
    const creds = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf-8"));
    const cred = creds.find((c: any) => c.email === "h1.credfail@dagohub.org");
    expect(cred).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // 2. Kegagalan penyimpanan token (staged rollback of credentials)
  // ---------------------------------------------------------------------------
  it("H-2: should rollback credentials if saving token invites fails, maintaining consistency", async () => {
    const org = setupTestOrganizer("h2.tokenfail@dagohub.org", "H2 Token Fail Guild");
    const { rawToken } = await generateActivationToken(org.id, "Test Admin");

    // Simulate disk failure during invite storage
    __setMockInviteWriteFailure(new Error("ENOSPC: No space left on device"));

    // Attempt activation
    await expect(
      consumeActivationTokenAndSetPassword(rawToken, "ValidPassword123!")
    ).rejects.toThrow("Gagal menandai token aktivasi terpakai");

    // Reset failure hook
    __setMockInviteWriteFailure(null);

    // Verify compensating rollback: credentials file must NOT contain the orphaned credential
    const creds = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf-8"));
    const cred = creds.find((c: any) => c.email === "h2.tokenfail@dagohub.org");
    expect(cred).toBeUndefined();

    // Verify token remains unconsumed
    const invites = JSON.parse(fs.readFileSync(INVITES_FILE, "utf-8"));
    const inv = invites.find((i: any) => i.email === "h2.tokenfail@dagohub.org");
    expect(inv.usedAt).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // 3. Token tetap dapat dicoba kembali ketika aktivasi gagal sebelum akun terbentuk
  // ---------------------------------------------------------------------------
  it("H-3: should allow retrying activation with the same token after write failure is resolved", async () => {
    const org = setupTestOrganizer("h3.retry@dagohub.org", "H3 Retry Guild");
    const { rawToken } = await generateActivationToken(org.id, "Test Admin");

    // First attempt fails due to invite write error
    __setMockInviteWriteFailure(new Error("EIO: Transient IO error"));
    await expect(
      consumeActivationTokenAndSetPassword(rawToken, "P@sswordValid123!")
    ).rejects.toThrow();

    // Clear mock error (transient error resolved)
    __setMockInviteWriteFailure(null);

    // Second attempt with the SAME token succeeds
    const successResult = await consumeActivationTokenAndSetPassword(
      rawToken,
      "P@sswordValid123!"
    );
    expect(successResult.success).toBe(true);
    expect(successResult.email).toBe("h3.retry@dagohub.org");

    // Token is now consumed
    const invites = JSON.parse(fs.readFileSync(INVITES_FILE, "utf-8"));
    const inv = invites.find((i: any) => i.email === "h3.retry@dagohub.org");
    expect(inv.usedAt).not.toBeNull();

    // Credential is now saved
    const creds = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf-8"));
    const cred = creds.find((c: any) => c.email === "h3.retry@dagohub.org");
    expect(cred).toBeDefined();
    expect(await bcrypt.compare("P@sswordValid123!", cred.passwordHash)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 4. Token yang berhasil dipakai tidak bisa digunakan kembali (replay prevention)
  // ---------------------------------------------------------------------------
  it("H-4: should strictly reject replay attempts using an already consumed activation token", async () => {
    const org = setupTestOrganizer("h4.replay@dagohub.org", "H4 Replay Guild");
    const { rawToken } = await generateActivationToken(org.id, "Test Admin");

    // Consume token once
    const firstAttempt = await consumeActivationTokenAndSetPassword(
      rawToken,
      "InitialPassword123!"
    );
    expect(firstAttempt.success).toBe(true);

    // Second attempt via helper must throw
    await expect(
      consumeActivationTokenAndSetPassword(rawToken, "SecondPassword123!")
    ).rejects.toThrow("Tautan aktivasi ini sudah pernah digunakan sebelumnya.");

    // Second attempt via HTTP endpoint must return 400
    const replayReq = new NextRequest("http://localhost:3000/api/events/auth/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: rawToken,
        password: "SecondPassword123!",
      }),
    });
    const replayRes = await handleActivate(replayReq);
    expect(replayRes.status).toBe(400);
    const replayData = await replayRes.json();
    expect(replayData.success).toBe(false);
    expect(replayData.error).toContain("sudah pernah digunakan");
  });

  // ---------------------------------------------------------------------------
  // 5. Fallback JSON ditolak pada production
  // ---------------------------------------------------------------------------
  it("H-5: should strictly reject JSON credential fallback when running in production environment", async () => {
    const org = setupTestOrganizer("h5.prod@dagohub.org", "H5 Prod Guard Guild");
    const { rawToken } = await generateActivationToken(org.id, "Test Admin");

    // Activate in dev/test first
    await consumeActivationTokenAndSetPassword(rawToken, "ProdPassword123!");

    // Switch environment to production
    process.env.NODE_ENV = "production";
    expect(isLocalDevFallbackAllowed()).toBe(false);

    // Database is offline, so with NODE_ENV="production", verifyOrganizerCredentials MUST fail safely
    const credResult = await verifyOrganizerCredentials("h5.prod@dagohub.org", "ProdPassword123!");
    expect(credResult.success).toBe(false);
    expect(credResult.error).toContain("INFRASTRUCTURE_ERROR");

    // Login endpoint in production must return 500 when database fails, not 200 via JSON
    const loginReq = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "h5.prod@dagohub.org",
        password: "ProdPassword123!",
      }),
    });
    const loginRes = await handleLogin(loginReq);
    expect(loginRes.status).toBe(500);
    const loginData = await loginRes.json();
    expect(loginData.success).toBe(false);
    expect(loginData.error).toContain("gangguan");
  });

  // ---------------------------------------------------------------------------
  // 6. Session in-memory tidak digunakan sebagai fallback production
  // ---------------------------------------------------------------------------
  it("H-6: should refuse in-memory session lookups and creation when running in production", async () => {
    process.env.NODE_ENV = "production";
    expect(isLocalDevFallbackAllowed()).toBe(false);

    // getOrganizerSession must return null in production
    const dummyHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    expect(getOrganizerSession(dummyHash)).toBeNull();

    // createOrganizerSession must fail when database is unreachable in production
    await expect(
      createOrganizerSession("anyone@dagohub.org")
    ).rejects.toThrow("INFRASTRUCTURE_ERROR");

    // An in-memory session token header must NOT authenticate a user in production
    const dummyReq = new NextRequest("http://localhost:3000/api/events/portal", {
      headers: {
        cookie: "dagoeng_session=inmemorytoken12345",
      },
    });
    const authSession = await getServerAuthSession(dummyReq);
    expect(authSession.isAuthenticated).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // 7. Database gagal tidak menyebabkan login palsu atau eskalasi role
  // ---------------------------------------------------------------------------
  it("H-7: should never escalate role or permit false login when database or credentials fail", async () => {
    // 7a. Completely unknown email must be rejected with 401
    const unknownReq = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "attacker@malicious.com",
        password: "AnyPassword123!",
      }),
    });
    const unknownRes = await handleLogin(unknownReq);
    expect(unknownRes.status).toBe(401);
    const unknownData = await unknownRes.json();
    expect(unknownData.success).toBe(false);
    expect(unknownData.user).toBeUndefined();

    // 7b. Non-organizer email in verifyOrganizerCredentials must be rejected
    const nonOrgResult = await verifyOrganizerCredentials(
      "random.user@external.com",
      "AnyPassword123!"
    );
    expect(nonOrgResult.success).toBe(false);
    expect(nonOrgResult.error).toContain("tidak terdaftar sebagai penyelenggara");
    expect(nonOrgResult.user).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // 8. Data organizer, event, dan booking demo tetap utuh
  // ---------------------------------------------------------------------------
  it("H-8: should confirm demo organizers, events, and bookings baseline remain intact", async () => {
    const organizers = getAllOrganizers();
    const baristaOrg = organizers.find((o: any) => o.email === "baristaguild@dagocreative.id");
    const devOrg = organizers.find((o: any) => o.email === "halo@bandungdev.org");
    const aksaraOrg = organizers.find((o: any) => o.email === "info@aksarapriangan.id");

    expect(baristaOrg).toBeDefined();
    expect(baristaOrg?.status).toBe("ACTIVE");
    expect(devOrg).toBeDefined();
    expect(devOrg?.status).toBe("ACTIVE");
    expect(aksaraOrg).toBeDefined();
    expect(aksaraOrg?.status).toBe("ACTIVE");

    // Events data file check
    if (fs.existsSync(EVENTS_FILE)) {
      const events = JSON.parse(fs.readFileSync(EVENTS_FILE, "utf-8"));
      expect(Array.isArray(events)).toBe(true);
    }

    // Bookings data file check
    if (fs.existsSync(BOOKINGS_FILE)) {
      const bookings = JSON.parse(fs.readFileSync(BOOKINGS_FILE, "utf-8"));
      expect(Array.isArray(bookings)).toBe(true);
    }
  });
});
