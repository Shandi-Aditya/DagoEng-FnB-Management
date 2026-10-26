import fs from "fs";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import {
  getAllOrganizers,
  getOrganizerByEmail,
  getOrganizerById,
  isOrganizerActive,
  CommunityOrganizerProfile,
} from "./organizers";
import { db } from "./db";
import { AuthenticatedUser } from "@/types/auth";

export interface OrganizerActivationTokenRecord {
  id: string;
  organizerId: string;
  email: string;
  tokenHash: string; // SHA-256 of rawToken
  expiresAt: string; // ISO date (48 hours from creation)
  createdAt: string;
  usedAt: string | null;
  createdBy: string;
}

export interface OrganizerCredentialRecord {
  organizerId: string;
  email: string;
  passwordHash: string;
  activatedAt: string;
  updatedAt: string;
}

import { getDataDirectory, getDataFilePath } from "@/lib/data-storage";

const getDataDir = () => getDataDirectory();
const getInvitesFile = () => getDataFilePath("organizer_invites.json");
const getCredentialsFile = () => getDataFilePath("organizer_credentials.json");


// Concurrency Mutex Lock
let lockPromise = Promise.resolve();
export async function withInviteLock<T>(fn: () => Promise<T> | T): Promise<T> {
  let release: () => void;
  const nextLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  const prevLock = lockPromise;
  lockPromise = nextLock;
  await prevLock;
  try {
    return await fn();
  } finally {
    release!();
  }
}

// Fast Database Availability & Cooldown Checker
let lastDbFailureTime = 0;
const DB_FAILURE_COOLDOWN_MS = 10000;

export function isDbAvailable(): boolean {
  return Date.now() - lastDbFailureTime > DB_FAILURE_COOLDOWN_MS;
}

export function markDbOffline(): void {
  lastDbFailureTime = Date.now();
}

export async function withDbTimeout<T>(fn: () => Promise<T>, timeoutMs = 200): Promise<T> {
  if (!isDbAvailable()) {
    throw new Error("Database known to be offline");
  }
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      markDbOffline();
      reject(new Error("Database connection timeout"));
    }, timeoutMs);
  });
  try {
    return await Promise.race([fn(), timeout]);
  } catch (err) {
    markDbOffline();
    throw err;
  } finally {
    clearTimeout(timer!);
  }
}

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
}

function loadInvitesFromDisk(): OrganizerActivationTokenRecord[] {
  try {
    const invitesFile = getInvitesFile();
    if (!fs.existsSync(invitesFile)) {
      return [];
    }
    const raw = fs.readFileSync(invitesFile, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Failed to read organizer_invites.json", err);
    return [];
  }
}

// Environment guard for local development / test fallbacks
export function isLocalDevFallbackAllowed(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  if (process.env.ALLOW_LOCAL_AUTH_FALLBACK === "false") {
    return false;
  }
  return true;
}

// Simulated filesystem failure hooks for unit testing
let mockCredWriteFailure: Error | null = null;
let mockInviteWriteFailure: Error | null = null;

export function __setMockCredWriteFailure(err: Error | null): void {
  mockCredWriteFailure = err;
}

export function __setMockInviteWriteFailure(err: Error | null): void {
  mockInviteWriteFailure = err;
}

function saveInvitesToDisk(invites: OrganizerActivationTokenRecord[]): void {
  if (mockInviteWriteFailure) {
    throw mockInviteWriteFailure;
  }
  const invitesFile = getInvitesFile();
  const dir = path.dirname(invitesFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const nonce = Math.random().toString(36).slice(2, 8);
  const tmpFile = path.join(dir, `.organizer_invites.tmp.${process.pid}.${Date.now()}.${nonce}`);
  fs.writeFileSync(tmpFile, JSON.stringify(invites, null, 2), "utf-8");
  try {
    fs.renameSync(tmpFile, invitesFile);
  } catch {
    fs.writeFileSync(invitesFile, JSON.stringify(invites, null, 2), "utf-8");
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
  }
}

export function loadCredentialsFromDisk(): OrganizerCredentialRecord[] {
  try {
    const credsFile = getCredentialsFile();
    if (!fs.existsSync(credsFile)) {
      return [];
    }
    const raw = fs.readFileSync(credsFile, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Failed to read organizer_credentials.json", err);
    return [];
  }
}

export function saveCredentialsToDisk(credentials: OrganizerCredentialRecord[]): void {
  if (mockCredWriteFailure) {
    throw mockCredWriteFailure;
  }
  const credsFile = getCredentialsFile();
  const dir = path.dirname(credsFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const nonce = Math.random().toString(36).slice(2, 8);
  const tmpFile = path.join(dir, `.organizer_credentials.tmp.${process.pid}.${Date.now()}.${nonce}`);
  fs.writeFileSync(tmpFile, JSON.stringify(credentials, null, 2), "utf-8");
  try {
    fs.renameSync(tmpFile, credsFile);
  } catch {
    fs.writeFileSync(credsFile, JSON.stringify(credentials, null, 2), "utf-8");
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
  }
}

/**
 * 1. Admin generates activation token for an existing registered organizer.
 * Token has high entropy (32 bytes hex) and 48 hours TTL.
 * Stored only as SHA-256 hash.
 */
export async function generateActivationToken(
  organizerId: string,
  createdBy = "Platform Admin"
): Promise<{ rawToken: string; activationUrl: string; record: OrganizerActivationTokenRecord; organizer: CommunityOrganizerProfile }> {
  return withInviteLock(async () => {
    const organizer = getOrganizerById(organizerId);
    if (!organizer) {
      throw new Error(`Penyelenggara dengan ID [${organizerId}] tidak ditemukan.`);
    }

    if (organizer.status === "INACTIVE") {
      throw new Error(`Penyelenggara [${organizer.name}] saat ini nonaktif. Aktifkan statusnya terlebih dahulu sebelum menerbitkan tautan aktivasi.`);
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

    const newRecord: OrganizerActivationTokenRecord = {
      id: `inv-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      organizerId: organizer.id,
      email: organizer.email.toLowerCase().trim(),
      tokenHash,
      expiresAt,
      createdAt: now.toISOString(),
      usedAt: null,
      createdBy,
    };

    const allInvites = loadInvitesFromDisk();
    allInvites.unshift(newRecord);
    saveInvitesToDisk(allInvites);

    return {
      rawToken,
      activationUrl: `/events/activate?token=${rawToken}`,
      record: newRecord,
      organizer,
    };
  });
}

/**
 * 2. Get current activation status for an organizer profile (for Admin table).
 */
export function getOrganizerActivationStatus(
  email: string
): "NOT_INVITED" | "PENDING_ACTIVATION" | "ACTIVATED" | "EXPIRED" | "INACTIVE" {
  const normalizedEmail = (email || "").toLowerCase().trim();
  const org = getOrganizerByEmail(normalizedEmail);
  if (!org || org.status === "INACTIVE") {
    return "INACTIVE";
  }

  // Check if credentials already exist
  const creds = loadCredentialsFromDisk();
  const isActivated = creds.some((c) => c.email === normalizedEmail);
  if (isActivated) {
    return "ACTIVATED";
  }

  // Check latest invite
  const invites = loadInvitesFromDisk().filter((i) => i.email === normalizedEmail);
  if (invites.length === 0) {
    return "NOT_INVITED";
  }

  const latest = invites[0];
  if (latest.usedAt !== null) {
    return "ACTIVATED";
  }

  if (new Date() > new Date(latest.expiresAt)) {
    return "EXPIRED";
  }

  return "PENDING_ACTIVATION";
}

/**
 * 3. Validate activation token without consuming it (for activation page mount check).
 */
export async function validateActivationToken(rawToken: string): Promise<{
  valid: boolean;
  error?: string;
  organizer?: Pick<CommunityOrganizerProfile, "name" | "category" | "contactPerson" | "email">;
  expiresAt?: string;
}> {
  if (!rawToken || typeof rawToken !== "string" || rawToken.trim().length < 32) {
    return { valid: false, error: "Tautan aktivasi tidak valid atau format token salah." };
  }

  const tokenHash = hashToken(rawToken);
  const invites = loadInvitesFromDisk();
  const record = invites.find((i) => i.tokenHash === tokenHash);

  if (!record) {
    return { valid: false, error: "Tautan aktivasi tidak ditemukan atau sudah tidak valid." };
  }

  if (record.usedAt !== null) {
    return { valid: false, error: "Tautan aktivasi ini sudah pernah digunakan. Silakan login menggunakan password yang telah Anda buat." };
  }

  if (new Date() > new Date(record.expiresAt)) {
    return { valid: false, error: "Tautan aktivasi telah kedaluwarsa (masa berlaku 48 jam terlampaui). Hubungi Administrator DAGO untuk menerbitkan tautan baru." };
  }

  const organizer = getOrganizerById(record.organizerId) || getOrganizerByEmail(record.email);
  if (!organizer) {
    return { valid: false, error: "Profil penyelenggara terkait tidak ditemukan dalam sistem." };
  }

  if (organizer.status === "INACTIVE") {
    return { valid: false, error: "Akun penyelenggara ini saat ini dinonaktifkan oleh Administrator Platform." };
  }

  return {
    valid: true,
    organizer: {
      name: organizer.name,
      category: organizer.category,
      contactPerson: organizer.contactPerson,
      email: organizer.email,
    },
    expiresAt: record.expiresAt,
  };
}

/**
 * 4. Consume activation token and establish password credentials.
 * Concurrency protected via withInviteLock to prevent double activation / replay.
 *
 * NOTE ON NON-ATOMICITY:
 * Writing across two independent JSON files (organizer_credentials.json and organizer_invites.json)
 * cannot provide atomic ACID transactions. We use a staged write with explicit programmatic rollback
 * (compensating action) under a process-level mutex:
 * 1. Calculate password hash with bcrypt BEFORE initiating any disk writes.
 * 2. Stage candidate mutations in memory.
 * 3. Write credentials to disk FIRST. If this fails, the token is untouched and remains retryable.
 * 4. Write updated invites (marking usedAt) to disk SECOND.
 *    If this fails, rollback the credentials file to its prior state to restore consistency,
 *    so the token remains unconsumed and retryable without orphaned credentials.
 */
export async function consumeActivationTokenAndSetPassword(
  rawToken: string,
  password: string
): Promise<{
  success: boolean;
  message: string;
  email: string;
  organizerName: string;
}> {
  if (!password || typeof password !== "string" || password.length < 8) {
    throw new Error("Password minimal 8 karakter demi keamanan akun.");
  }

  return withInviteLock(async () => {
    const tokenHash = hashToken(rawToken);
    const invites = loadInvitesFromDisk();
    const index = invites.findIndex((i) => i.tokenHash === tokenHash);

    if (index === -1) {
      throw new Error("Tautan aktivasi tidak ditemukan atau tidak valid.");
    }

    const record = invites[index];

    if (record.usedAt !== null) {
      throw new Error("Tautan aktivasi ini sudah pernah digunakan sebelumnya.");
    }

    if (new Date() > new Date(record.expiresAt)) {
      throw new Error("Tautan aktivasi telah kedaluwarsa. Masa berlaku 48 jam telah habis.");
    }

    const organizer = getOrganizerById(record.organizerId) || getOrganizerByEmail(record.email);
    if (!organizer) {
      throw new Error("Profil penyelenggara terkait tidak ditemukan.");
    }

    if (organizer.status === "INACTIVE") {
      throw new Error("Akun penyelenggara ini saat ini dinonaktifkan oleh Administrator Platform.");
    }

    // 1. Calculate bcrypt hash BEFORE initiating any disk write
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    // 2. Stage credential mutation in memory
    const originalCredentials = loadCredentialsFromDisk();
    const updatedCredentials = [...originalCredentials];
    const credIndex = updatedCredentials.findIndex((c) => c.email === record.email);
    const credRecord: OrganizerCredentialRecord = {
      organizerId: organizer.id,
      email: record.email,
      passwordHash,
      activatedAt: now,
      updatedAt: now,
    };
    if (credIndex >= 0) {
      updatedCredentials[credIndex] = credRecord;
    } else {
      updatedCredentials.push(credRecord);
    }

    // 3. Stage invite mutation in memory
    const originalInvites = [...invites];
    const updatedInvites = [...invites];
    const updatedRecord: OrganizerActivationTokenRecord = {
      ...record,
      usedAt: now,
    };
    updatedInvites[index] = updatedRecord;

    // 4. Write credentials FIRST (token has NOT been marked consumed yet)
    try {
      saveCredentialsToDisk(updatedCredentials);
    } catch (credErr) {
      // Failed before token was marked. Token remains untouched and retryable.
      throw new Error(
        `Gagal menyimpan kredensial akun penyelenggara: ${credErr instanceof Error ? credErr.message : String(credErr)}`
      );
    }

    // 5. Write invites SECOND (marking token consumed)
    try {
      saveInvitesToDisk(updatedInvites);
    } catch (inviteErr) {
      // Compensating action: rollback credentials file to restore consistency
      try {
        saveCredentialsToDisk(originalCredentials);
      } catch (rollbackErr) {
        console.error("CRITICAL: Failed to rollback credentials after invite write failure", rollbackErr);
        throw new Error(
          "INKONSISTENSI_SISTEM: Gagal menandai token dan pemulihan kredensial gagal. Hubungi Administrator DAGO."
        );
      }

      throw new Error(
        `Gagal menandai token aktivasi terpakai: ${inviteErr instanceof Error ? inviteErr.message : String(inviteErr)}. Perubahan kredensial telah dipulihkan agar token dapat dicoba kembali.`
      );
    }

    // 6. Also sync to database User table if available (best effort in dev)
    try {
      await withDbTimeout(() =>
        db.user.upsert({
          where: { email: record.email },
          create: {
            email: record.email,
            name: organizer.name,
            phone: organizer.phone || null,
            passwordHash,
            isActive: true,
          },
          update: {
            name: organizer.name,
            phone: organizer.phone || null,
            passwordHash,
            isActive: true,
          },
        })
      );
    } catch {
      // Prisma DB unavailable in offline dev/test environment; local credential store guarantees resilience
    }

    return {
      success: true,
      message: `Akun penyelenggara [${organizer.name}] berhasil diaktifkan. Silakan masuk menggunakan email dan password baru Anda.`,
      email: record.email,
      organizerName: organizer.name,
    };
  });
}

// Backward-compatible alias
export const consumeActivationToken = consumeActivationTokenAndSetPassword;

/**
 * 5. Verify credentials for non-demo organizer login.
 */
export async function verifyOrganizerCredentials(
  email: string,
  password: string
): Promise<{
  success: boolean;
  error?: string;
  user?: AuthenticatedUser;
}> {
  const normalizedEmail = (email || "").toLowerCase().trim();

  // Enforce registered organizer identity in organizers.json
  const org = getOrganizerByEmail(normalizedEmail);
  if (!org) {
    return {
      success: false,
      error: "Akun email ini tidak terdaftar sebagai penyelenggara event di sistem DAGO.",
    };
  }

  if (org.status === "INACTIVE") {
    return {
      success: false,
      error: `FORBIDDEN: Akun penyelenggara [${org.name}] saat ini dinonaktifkan oleh Administrator Platform.`,
    };
  }

  // 1. Check database User if database is available
  let dbUser: any = null;
  let dbError: any = null;
  try {
    dbUser = await withDbTimeout(() =>
      db.user.findUnique({
        where: { email: normalizedEmail },
      })
    );
  } catch (err) {
    dbError = err;
  }

  if (dbError) {
    // In production, database query failure MUST NOT fall back to local JSON
    if (!isLocalDevFallbackAllowed()) {
      return {
        success: false,
        error: "INFRASTRUCTURE_ERROR: Layanan autentikasi database sedang mengalami gangguan.",
      };
    }
  } else if (dbUser && dbUser.passwordHash) {
    const match = await bcrypt.compare(password, dbUser.passwordHash);
    if (match) {
      if (!dbUser.isActive) {
        return {
          success: false,
          error: "Akun Anda saat ini berstatus nonaktif. Silakan hubungi Administrator DAGO.",
        };
      }

      const authenticatedUser: AuthenticatedUser = {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name || org.name,
        phone: dbUser.phone || org.phone,
        role: {
          id: "role-community",
          slug: "CUSTOMER",
          name: "Community Organizer",
        },
        scopeLevel: "TENANT",
        allowedModules: ["CO_WORKING"],
        organization: { id: "org-dago-hub", name: "Dago Creative Hub", code: "DAGO-HUB" },
        tenant: null,
        outlet: null,
        permissions: ["events:manage_own"],
      };

      return { success: true, user: authenticatedUser };
    } else {
      return {
        success: false,
        error: "Password yang Anda masukkan salah. Silakan coba kembali.",
      };
    }
  } else {
    // Database was queried but user not found in database User table
    if (!isLocalDevFallbackAllowed()) {
      return {
        success: false,
        error: "Kredensial login belum terdaftar atau belum diaktivasi pada database.",
      };
    }
  }

  // 2. Check local activated credentials (local dev/test fallback ONLY)
  if (!isLocalDevFallbackAllowed()) {
    return {
      success: false,
      error: "Autentikasi kredensial lokal dinonaktifkan pada lingkungan produksi.",
    };
  }

  const credentials = loadCredentialsFromDisk();
  const cred = credentials.find((c) => c.email === normalizedEmail);

  if (!cred) {
    return {
      success: false,
      error: "Kredensial login belum diaktivasi untuk email ini. Silakan gunakan tautan aktivasi yang diberikan Administrator.",
    };
  }

  const passwordMatch = await bcrypt.compare(password, cred.passwordHash);
  if (!passwordMatch) {
    return {
      success: false,
      error: "Password yang Anda masukkan salah. Silakan coba kembali.",
    };
  }

  const authenticatedUser: AuthenticatedUser = {
    id: `user-org-${cred.organizerId}`,
    email: cred.email,
    name: org.name,
    phone: org.phone || null,
    role: {
      id: "role-community",
      slug: "CUSTOMER",
      name: "Community Organizer",
    },
    scopeLevel: "TENANT",
    allowedModules: ["CO_WORKING"],
    organization: { id: "org-dago-hub", name: "Dago Creative Hub", code: "DAGO-HUB" },
    tenant: null,
    outlet: null,
    permissions: ["events:manage_own"],
  };

  return { success: true, user: authenticatedUser };
}

/**
 * 6. Session Management for authenticated organizers.
 * Integrates with db.session if PostgreSQL is active, and provides in-memory fallback.
 */
const activeOrganizerSessions = new Map<
  string,
  { email: string; name: string; expiresAt: Date; userId: string }
>();

export async function createOrganizerSession(
  email: string,
  userAgent?: string,
  ipAddress?: string
): Promise<{ rawToken: string; expiresAt: Date; sessionId: string }> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const org = getOrganizerByEmail(email);
  const name = org?.name || "Penyelenggara Event";
  const normalizedEmail = email.toLowerCase().trim();

  // If in production, in-memory session fallback is strictly forbidden!
  if (!isLocalDevFallbackAllowed()) {
    try {
      const dbUser = await withDbTimeout(() =>
        db.user.findUnique({ where: { email: normalizedEmail } })
      );
      if (!dbUser) {
        throw new Error("Pengguna tidak ditemukan dalam database server.");
      }
      const dbSession = await withDbTimeout(() =>
        db.session.create({
          data: {
            userId: dbUser.id,
            sessionTokenHash: tokenHash,
            expiresAt,
            userAgent: userAgent || null,
            ipAddress: ipAddress || null,
          },
        })
      );
      return { rawToken, expiresAt, sessionId: dbSession.id };
    } catch (err) {
      throw new Error(`INFRASTRUCTURE_ERROR: Gagal membuat sesi autentikasi database: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Local development / test fallback:
  const userId = `user-org-${org?.id || Date.now().toString(36)}`;
  const sessionId = `sess-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  activeOrganizerSessions.set(tokenHash, {
    email: normalizedEmail,
    name,
    expiresAt,
    userId,
  });

  // Also try saving session to database if connected
  try {
    const dbUser = await withDbTimeout(() =>
      db.user.findUnique({ where: { email: normalizedEmail } })
    );
    if (dbUser) {
      const dbSession = await withDbTimeout(() =>
        db.session.create({
          data: {
            userId: dbUser.id,
            sessionTokenHash: tokenHash,
            expiresAt,
            userAgent: userAgent || null,
            ipAddress: ipAddress || null,
          },
        })
      );
      return { rawToken, expiresAt, sessionId: dbSession.id };
    }
  } catch {
    // DB offline, in-memory activeOrganizerSessions handles seamlessly in dev
  }

  return { rawToken, expiresAt, sessionId };
}

export function getOrganizerSession(tokenHash: string): {
  email: string;
  name: string;
  expiresAt: Date;
  userId: string;
} | null {
  if (!isLocalDevFallbackAllowed()) {
    return null;
  }
  const session = activeOrganizerSessions.get(tokenHash);
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    activeOrganizerSessions.delete(tokenHash);
    return null;
  }
  return session;
}

export function revokeOrganizerSession(tokenHash: string): void {
  activeOrganizerSessions.delete(tokenHash);
}

