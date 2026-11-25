import crypto from "crypto";
import bcrypt from "bcryptjs";
import {
  mutatePersistentData,
  readPersistentDomainState,
  readSeededPersistentData,
} from "@/lib/persistent-storage";
import { DEFAULT_FNB_TENANTS } from "@/lib/tenant";
import { tenantsDomainSpec } from "@/lib/sync-domains/config-spec";
import { TRUSTED_PERSONAS } from "@/lib/server-auth";
import { getOrganizerByEmail, syncOrganizersFromDb } from "@/lib/organizers";
import { findUnifiedUserByEmail } from "@/lib/unified-account";
import { syncStorageFromDb } from "@/lib/data-storage";
import { revokeUserSessionsAfter } from "@/lib/session-revocation";

export const TENANT_INVITES_FILE = "tenant_owner_invitations.json";
export const TENANT_ACCOUNTS_FILE = "tenant_owner_accounts.json";

export interface TenantOwnerInvitationRecord {
  id: string;
  tenantId: string;
  tenantName: string;
  contactEmail?: string;
  tokenHash: string;
  expiresAt: string;
  createdBy: string;
  createdAt: string;
  usedAt?: string;
  usedByEmail?: string;
}

export interface TenantOwnerAccount {
  id: string;
  tenantId: string;
  tenantName: string;
  email: string;
  name: string;
  passwordHash: string;
  status: "ACTIVE" | "INACTIVE";
  activatedAt: string;
  updatedAt: string;
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function resolveTenantDirectoryInfo(tenantId: string): Promise<{
  exists: boolean;
  tenantName: string;
  contactEmail?: string;
}> {
  const tenantsState = await readPersistentDomainState(tenantsDomainSpec);
  const custom = (tenantsState.customTenants || []).find((t) => t.id === tenantId);
  const seed = DEFAULT_FNB_TENANTS.find((t) => t.id === tenantId);
  const profile = tenantsState.profiles?.[tenantId];

  if (!custom && !seed && !profile) {
    return { exists: false, tenantName: tenantId };
  }

  return {
    exists: true,
    tenantName: profile?.brandName || custom?.name || seed?.name || tenantId,
    contactEmail: profile?.contactEmail,
  };
}

export async function generateTenantOwnerInviteToken(
  tenantId: string,
  createdBy: string,
  ttlHours: number = 48
): Promise<{
  token: string;
  activationUrl: string;
  expiresAt: string;
  tenantId: string;
  tenantName: string;
  contactEmail?: string;
}> {
  const trimmedTenantId = tenantId.trim();
  if (!trimmedTenantId) {
    throw new Error("tenantId wajib disertakan.");
  }

  const tenantInfo = await resolveTenantDirectoryInfo(trimmedTenantId);
  if (!tenantInfo.exists) {
    throw new Error(`Mitra F&B [${trimmedTenantId}] tidak ditemukan.`);
  }

  const rawToken = `inv_${crypto.randomBytes(18).toString("hex")}`;
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlHours * 3600 * 1000).toISOString();

  await mutatePersistentData<TenantOwnerInvitationRecord[]>(
    TENANT_INVITES_FILE,
    [],
    (records) => [
      ...records,
      {
        id: `tinv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tenantId: trimmedTenantId,
        tenantName: tenantInfo.tenantName,
        contactEmail: tenantInfo.contactEmail,
        tokenHash,
        expiresAt,
        createdBy,
        createdAt: now.toISOString(),
      },
    ]
  );

  const activationUrl = `/login?invite=${encodeURIComponent(rawToken)}&tenantId=${encodeURIComponent(trimmedTenantId)}&role=owner`;
  return {
    token: rawToken,
    activationUrl,
    expiresAt,
    tenantId: trimmedTenantId,
    tenantName: tenantInfo.tenantName,
    contactEmail: tenantInfo.contactEmail,
  };
}

export async function validateTenantOwnerInviteToken(token: string): Promise<
  | {
      valid: true;
      tenantId: string;
      tenantName: string;
      contactEmail?: string;
      expiresAt: string;
    }
  | { valid: false; error: string }
> {
  const trimmed = typeof token === "string" ? token.trim() : "";
  if (!trimmed) {
    return { valid: false, error: "Token aktivasi tidak valid." };
  }
  const tokenHash = hashToken(trimmed);
  const records = await readSeededPersistentData<TenantOwnerInvitationRecord[]>(
    TENANT_INVITES_FILE,
    () => []
  );
  const record = records.find((r) => r.tokenHash === tokenHash);
  if (!record) {
    return { valid: false, error: "Tautan undangan tidak ditemukan atau sudah tidak berlaku." };
  }
  if (record.usedAt) {
    return { valid: false, error: "Tautan undangan sudah pernah digunakan." };
  }
  if (Date.parse(record.expiresAt) < Date.now()) {
    return { valid: false, error: "Tautan undangan telah kedaluwarsa." };
  }

  return {
    valid: true,
    tenantId: record.tenantId,
    tenantName: record.tenantName,
    contactEmail: record.contactEmail,
    expiresAt: record.expiresAt,
  };
}

export async function consumeTenantOwnerInviteToken(params: {
  token: string;
  email?: string;
  name?: string;
  password: string;
}): Promise<{
  email: string;
  name: string;
  tenantId: string;
  tenantName: string;
}> {
  const trimmedToken = typeof params.token === "string" ? params.token.trim() : "";
  if (!trimmedToken) {
    throw new Error("Token aktivasi wajib disertakan.");
  }
  if (!params.password || params.password.length < 8) {
    throw new Error("Password minimal 8 karakter.");
  }

  const tokenHash = hashToken(trimmedToken);
  const nowIso = new Date().toISOString();

  let reservedRecord: TenantOwnerInvitationRecord | null = null;
  let resolvedEmail = "";

  // Atomically validate and reserve the invite record BEFORE hashing/writing accounts
  await mutatePersistentData<TenantOwnerInvitationRecord[]>(
    TENANT_INVITES_FILE,
    [],
    (records) => {
      const idx = records.findIndex((r) => r.tokenHash === tokenHash);
      if (idx === -1) {
        throw new Error("Tautan undangan tidak ditemukan atau sudah tidak berlaku.");
      }
      const record = records[idx];
      if (record.usedAt) {
        throw new Error("Tautan undangan sudah pernah digunakan.");
      }
      if (Date.parse(record.expiresAt) < Date.now()) {
        throw new Error("Tautan undangan telah kedaluwarsa.");
      }

      const candidateEmail = (params.email || record.contactEmail || "").trim().toLowerCase();
      if (!candidateEmail || !candidateEmail.includes("@")) {
        throw new Error("Alamat email akun Owner wajib diisi dengan format valid.");
      }

      reservedRecord = record;
      resolvedEmail = candidateEmail;

      return records.map((r, i) =>
        i === idx ? { ...r, usedAt: nowIso, usedByEmail: candidateEmail } : r
      );
    }
  );

  const check: TenantOwnerInvitationRecord = reservedRecord!;

  try {
    if (process.env.NODE_ENV !== "test") {
      await Promise.allSettled([
        syncOrganizersFromDb(),
        syncStorageFromDb("unified_users.json"),
      ]);
    }

    const isDemoEmail = Object.values(TRUSTED_PERSONAS).some(
      (p) => p.email.toLowerCase() === resolvedEmail
    );
    if (isDemoEmail || getOrganizerByEmail(resolvedEmail) || findUnifiedUserByEmail(resolvedEmail)) {
      throw new Error(
        "Email tersebut sudah terdaftar pada akun sistem, pengguna terpadu, atau penyelenggara event. Gunakan email lain."
      );
    }

    const passwordHash = await bcrypt.hash(params.password, 10);
    const resolvedName = (params.name || `Owner ${check.tenantName}`).trim();

    await mutatePersistentData<TenantOwnerAccount[]>(
      TENANT_ACCOUNTS_FILE,
      [],
      (accounts) => {
        const existingIdx = accounts.findIndex((a) => a.email.toLowerCase() === resolvedEmail);
        if (existingIdx >= 0 && accounts[existingIdx].tenantId !== check.tenantId) {
          throw new Error(
            `Email ${resolvedEmail} sudah terdaftar untuk mitra ${accounts[existingIdx].tenantName}.`
          );
        }
        const nextAccount: TenantOwnerAccount = {
          id:
            existingIdx >= 0
              ? accounts[existingIdx].id
              : `tenant-owner-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tenantId: check.tenantId,
          tenantName: check.tenantName,
          email: resolvedEmail,
          name: resolvedName,
          passwordHash,
          status: "ACTIVE",
          activatedAt: existingIdx >= 0 ? accounts[existingIdx].activatedAt : nowIso,
          updatedAt: nowIso,
        };
        return existingIdx >= 0
          ? accounts.map((a, i) => (i === existingIdx ? nextAccount : a))
          : [...accounts, nextAccount];
      }
    );

    return {
      email: resolvedEmail,
      name: resolvedName,
      tenantId: check.tenantId,
      tenantName: check.tenantName,
    };
  } catch (err) {
    // Roll back reservation if account creation or collision check failed
    await mutatePersistentData<TenantOwnerInvitationRecord[]>(
      TENANT_INVITES_FILE,
      [],
      (records) =>
        records.map((r) => {
          if (r.tokenHash !== tokenHash || r.usedAt !== nowIso) {
            return r;
          }
          const { usedAt: _usedAt, usedByEmail: _usedByEmail, ...rest } = r;
          void _usedAt;
          void _usedByEmail;
          return rest;
        })
    ).catch(() => {});
    throw err;
  }
}

export async function updateTenantOwnerPassword(
  email: string,
  newPassword: string
): Promise<{
  success: boolean;
  account?: TenantOwnerAccount;
  revokedAt: number;
}> {
  const normalizedEmail = (email || "").trim().toLowerCase();
  if (!normalizedEmail || !newPassword || newPassword.trim().length < 6) {
    return { success: false, revokedAt: 0 };
  }

  const passwordHash = await bcrypt.hash(newPassword.trim(), 10);
  const revokedAt = Date.now();
  const nowIso = new Date(revokedAt).toISOString();
  let updatedAccount: TenantOwnerAccount | undefined;

  await mutatePersistentData<TenantOwnerAccount[]>(
    TENANT_ACCOUNTS_FILE,
    [],
    (accounts) => {
      const idx = accounts.findIndex((a) => a.email.toLowerCase() === normalizedEmail);
      if (idx === -1) {
        return accounts;
      }
      updatedAccount = {
        ...accounts[idx],
        passwordHash,
        updatedAt: nowIso,
      };
      return accounts.map((a, i) => (i === idx ? updatedAccount! : a));
    }
  );

  if (!updatedAccount) {
    return { success: false, revokedAt: 0 };
  }

  await revokeUserSessionsAfter(updatedAccount.id, revokedAt);
  await revokeUserSessionsAfter(updatedAccount.email, revokedAt);

  return {
    success: true,
    account: updatedAccount,
    revokedAt,
  };
}

export async function verifyTenantOwnerCredentials(
  email: string,
  password: string
): Promise<{
  found: boolean;
  authenticated: boolean;
  account?: TenantOwnerAccount;
  error?: string;
}> {
  const normalizedEmail = email.trim().toLowerCase();
  const accounts = await readSeededPersistentData<TenantOwnerAccount[]>(
    TENANT_ACCOUNTS_FILE,
    () => []
  );
  const matched = accounts.find((a) => a.email.toLowerCase() === normalizedEmail);
  if (!matched) {
    return { found: false, authenticated: false };
  }
  if (matched.status !== "ACTIVE") {
    return {
      found: true,
      authenticated: false,
      error: "Akun pemilik mitra sedang dinonaktifkan.",
    };
  }
  const passwordOk = await bcrypt.compare(password, matched.passwordHash);
  if (!passwordOk) {
    return {
      found: true,
      authenticated: false,
      error: "Password yang Anda masukkan salah.",
    };
  }
  return {
    found: true,
    authenticated: true,
    account: matched,
  };
}
