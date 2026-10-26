import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import {
  getAllOrganizers,
  getOrganizerByEmail,
  createOrganizer,
  CommunityOrganizerProfile,
} from "./organizers";
import {
  saveCredentialsToDisk,
  loadCredentialsFromDisk,
  OrganizerCredentialRecord,
} from "./organizer-activation";

export interface UnifiedUserAccount {
  id: string;
  email: string;
  name: string;
  phone: string;
  passwordHash: string;
  role: "CUSTOMER" | "STAFF" | "ADMIN";
  organizerProfileId?: string | null;
  createdAt: string;
  updatedAt: string;
}

import { getDataDirectory, getDataFilePath } from "@/lib/data-storage";

const getDataDir = () => getDataDirectory();
const getUsersFile = () => getDataFilePath("unified_users.json");


// Default seed users for zero-config startup & test compatibility
const SEED_USERS: UnifiedUserAccount[] = [
  {
    id: "user-customer-demo",
    email: "customer@gmail.com",
    name: "Ketut Dian (Customer Member)",
    phone: "+62 819-1122-3344",
    // bcrypt hash of "Password123!"
    passwordHash: "$2a$10$wN1F1y15eP34h8h.ZfGkE.tHfg70k6VnS/Vq6wTj6O7H7LhUuJ6k.",
    role: "CUSTOMER",
    organizerProfileId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

let cachedUsers: UnifiedUserAccount[] | null = null;

export function loadUnifiedUsersFromDisk(): UnifiedUserAccount[] {
  const usersFile = getUsersFile();
  const dataDir = getDataDir();
  if (!fs.existsSync(usersFile)) {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(usersFile, JSON.stringify(SEED_USERS, null, 2), "utf-8");
    cachedUsers = [...SEED_USERS];
    return cachedUsers;
  }

  try {
    const raw = fs.readFileSync(usersFile, "utf-8");
    const parsed = JSON.parse(raw);
    cachedUsers = Array.isArray(parsed) ? parsed : [];
    return cachedUsers;
  } catch (err) {
    console.error("Failed to read unified_users.json", err);
    return cachedUsers || [];
  }
}

export function saveUnifiedUsersToDisk(users: UnifiedUserAccount[]): void {
  try {
    cachedUsers = users;
    const usersFile = getUsersFile();
    const dataDir = getDataDir();
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const nonce = Math.random().toString(36).slice(2, 8);
    const tmpFile = path.join(dataDir, `.unified_users.tmp.${process.pid}.${Date.now()}.${nonce}`);
    fs.writeFileSync(tmpFile, JSON.stringify(users, null, 2), "utf-8");
    try {
      fs.renameSync(tmpFile, usersFile);
    } catch {
      fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), "utf-8");
      try {
        fs.unlinkSync(tmpFile);
      } catch {}
    }
  } catch (err) {
    console.error("Failed to write unified_users to disk", err);
  }
}

export function findUnifiedUserByEmail(email: string): UnifiedUserAccount | null {
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized) return null;
  const all = loadUnifiedUsersFromDisk();
  return all.find((u) => u.email.toLowerCase() === normalized) || null;
}

export function findUnifiedUserById(id: string): UnifiedUserAccount | null {
  const all = loadUnifiedUsersFromDisk();
  return all.find((u) => u.id === id) || null;
}

export interface RegisterUserPayload {
  name: string;
  email: string;
  phone: string;
  password?: string;
  role?: "CUSTOMER" | "STAFF" | "ADMIN";
}

/**
 * Register a unified user account.
 * Deduplicates strictly by normalized email.
 */
export async function registerUnifiedUser(payload: RegisterUserPayload): Promise<{
  user: UnifiedUserAccount;
  isExisting: boolean;
}> {
  const normalizedEmail = (payload.email || "").trim().toLowerCase();
  const normalizedPhone = (payload.phone || "").trim();
  const normalizedName = (payload.name || "").trim();

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new Error("Format alamat email tidak valid.");
  }
  if (!normalizedName || normalizedName.length < 2) {
    throw new Error("Nama lengkap minimal 2 karakter.");
  }
  if (!normalizedPhone || normalizedPhone.length < 8) {
    throw new Error("Nomor telepon/WhatsApp minimal 8 digit.");
  }

  const all = loadUnifiedUsersFromDisk();
  const existing = all.find((u) => u.email.toLowerCase() === normalizedEmail);

  if (existing) {
    // Account already exists
    return { user: existing, isExisting: true };
  }

  const rawPassword = payload.password && payload.password.trim() ? payload.password.trim() : "Password123!";
  const passwordHash = await bcrypt.hash(rawPassword, 10);
  const now = new Date().toISOString();

  // Check if this email already exists in organizers.json
  const existingOrg = getOrganizerByEmail(normalizedEmail);

  const newUser: UnifiedUserAccount = {
    id: `user-cust-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    email: normalizedEmail,
    name: normalizedName,
    phone: normalizedPhone,
    passwordHash,
    role: payload.role || "CUSTOMER",
    organizerProfileId: existingOrg ? existingOrg.id : null,
    createdAt: now,
    updatedAt: now,
  };

  all.unshift(newUser);
  saveUnifiedUsersToDisk(all);

  // If already an organizer, make sure credentials record is also synchronized
  if (existingOrg) {
    syncOrganizerCredentials(existingOrg.id, normalizedEmail, passwordHash);
  }

  return { user: newUser, isExisting: false };
}

/**
 * Synchronizes password hash to organizer_credentials.json so organizer logins succeed seamlessly.
 */
function syncOrganizerCredentials(organizerId: string, email: string, passwordHash: string): void {
  try {
    const creds: OrganizerCredentialRecord[] = loadCredentialsFromDisk();
    const existingIdx = creds.findIndex((c: OrganizerCredentialRecord) => c.email.toLowerCase() === email.toLowerCase());
    const now = new Date().toISOString();

    if (existingIdx !== -1) {
      creds[existingIdx].passwordHash = passwordHash;
      creds[existingIdx].updatedAt = now;
    } else {
      creds.push({
        organizerId,
        email: email.toLowerCase(),
        passwordHash,
        activatedAt: now,
        updatedAt: now,
      });
    }
    saveCredentialsToDisk(creds);
  } catch (err) {
    console.error("Failed to sync organizer credentials:", err);
  }
}

/**
 * Verifies unified user password.
 */
export async function verifyUnifiedUserPassword(
  email: string,
  plainPassword: string
): Promise<{ success: boolean; user: UnifiedUserAccount | null; error?: string }> {
  const user = findUnifiedUserByEmail(email);
  if (!user) {
    return { success: false, user: null, error: "Akun tidak ditemukan." };
  }

  const isMatch = await bcrypt.compare(plainPassword, user.passwordHash);
  if (!isMatch) {
    return { success: false, user: null, error: "Password yang Anda masukkan salah." };
  }

  return { success: true, user };
}

export interface SelfServiceOrganizerPayload {
  organizationName: string;
  category: string;
  contactPerson?: string;
  phone?: string;
  notes?: string;
}

/**
 * Self-service onboarding: A logged-in customer activates their Organizer profile
 * without creating a second login account and without needing manual admin invite approval.
 */
export async function activateOrganizerSelfService(
  userEmail: string,
  payload: SelfServiceOrganizerPayload
): Promise<{
  success: boolean;
  organizer: CommunityOrganizerProfile;
  user: UnifiedUserAccount;
}> {
  const normalizedEmail = (userEmail || "").trim().toLowerCase();
  let user = findUnifiedUserByEmail(normalizedEmail);

  if (!user) {
    // If user record doesn't exist yet, auto-register unified user
    const regResult = await registerUnifiedUser({
      email: normalizedEmail,
      name: payload.contactPerson || payload.organizationName,
      phone: payload.phone || "+62 812-0000-0000",
      role: "CUSTOMER",
    });
    user = regResult.user;
  }

  // Check if organizer profile already exists
  let organizer = getOrganizerByEmail(normalizedEmail);
  if (!organizer) {
    organizer = createOrganizer({
      name: payload.organizationName,
      category: payload.category || "Komunitas Kreatif",
      contactPerson: payload.contactPerson || user.name,
      phone: payload.phone || user.phone,
      email: normalizedEmail,
      notes: payload.notes || "Aktivasi mandiri dari Customer Portal DagoEng",
      initialStatus: "ACTIVE",
    });
  }

  // Link profile to user
  const allUsers = loadUnifiedUsersFromDisk();
  const uIdx = allUsers.findIndex((u) => u.email.toLowerCase() === normalizedEmail);
  if (uIdx !== -1) {
    allUsers[uIdx].organizerProfileId = organizer.id;
    allUsers[uIdx].updatedAt = new Date().toISOString();
    saveUnifiedUsersToDisk(allUsers);
    user = allUsers[uIdx];
  }

  // Ensure password credentials exist for organizer login
  syncOrganizerCredentials(organizer.id, normalizedEmail, user.passwordHash);

  return {
    success: true,
    organizer,
    user,
  };
}
