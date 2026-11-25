import fs from "fs";
import path from "path";
import { ScopeLevel, BusinessModuleCode } from "@/types/auth";

import {
  CommunityOrganizerProfile,
  INITIAL_ORGANIZERS,
} from "@/types/organizer";

export {
  type CommunityOrganizerProfile,
  INITIAL_ORGANIZERS,
};

import { getDataFilePath, syncStorageFromDb, persistStorageToDb } from "@/lib/data-storage";
import { readPersistentData } from "@/lib/persistent-storage";
import { OFFICIAL_CS_DISPLAY_PHONE } from "@/lib/contact-config";

const TENANT_OWNER_ACCOUNTS_FILE = "tenant_owner_accounts.json";

function isTenantOwnerEmailSync(email: string): boolean {
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized) return false;
  try {
    const filePath = getDataFilePath(TENANT_OWNER_ACCOUNTS_FILE);
    if (!fs.existsSync(filePath)) return false;
    const raw = fs.readFileSync(filePath, "utf-8").trim();
    if (!raw) return false;
    const accounts = JSON.parse(raw);
    if (!Array.isArray(accounts)) return false;
    return accounts.some(
      (acc: { email?: unknown; status?: unknown }) =>
        typeof acc?.email === "string" && acc.email.trim().toLowerCase() === normalized
    );
  } catch {
    return false;
  }
}

export async function isTenantOwnerEmailAsync(email: string): Promise<boolean> {
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized) return false;
  const accounts = await readPersistentData<Array<{ email?: string; status?: string }>>(
    TENANT_OWNER_ACCOUNTS_FILE,
    []
  );
  if (!Array.isArray(accounts)) return false;
  return accounts.some(
    (acc) => typeof acc?.email === "string" && acc.email.trim().toLowerCase() === normalized
  );
}

const getDataFile = () => getDataFilePath("organizers.json");

let cachedOrganizers: CommunityOrganizerProfile[] | null = null;

export function clearOrganizersCache(): void {
  cachedOrganizers = null;
}

/**
 * Synchronizes organizers data from PostgreSQL SystemSetting (STORAGE_organizers.json).
 * Safe against slow/offline database: never clobbers local data with empty if DB unconfirmed.
 */
export async function syncOrganizersFromDb(): Promise<boolean> {
  const synced = await syncStorageFromDb("organizers.json").catch(() => false);
  if (synced) {
    cachedOrganizers = null;
  }
  return synced;
}

/**
 * Persists organizers data to PostgreSQL SystemSetting (STORAGE_organizers.json).
 */
export async function persistOrganizersToDb(organizers?: CommunityOrganizerProfile[]): Promise<boolean> {
  const all = organizers || getAllOrganizers();
  const content = JSON.stringify(all, null, 2);
  return persistStorageToDb("organizers.json", content);
}

export function loadOrganizersFromDisk(): CommunityOrganizerProfile[] {
  const dataFile = getDataFile();
  if (!fs.existsSync(dataFile)) {
    const dir = path.dirname(dataFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dataFile, JSON.stringify(INITIAL_ORGANIZERS, null, 2), "utf-8");
    cachedOrganizers = [...INITIAL_ORGANIZERS];
    return cachedOrganizers;
  }

  let raw: string;
  try {
    raw = fs.readFileSync(dataFile, "utf-8");
  } catch (readErr) {
    console.error("Failed to read organizers file from disk:", readErr);
    throw new Error("ORGANIZER_DATA_UNAVAILABLE: Berkas data penyelenggara tidak dapat diakses.");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (parseErr) {
    console.error("ORGANIZER_DATA_CORRUPT: Failed to parse organizers.json as valid JSON:", parseErr);
    throw new Error("ORGANIZER_DATA_CORRUPT: Berkas profil penyelenggara rusak atau tidak valid.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("ORGANIZER_DATA_CORRUPT: Format data penyelenggara harus berupa array JSON.");
  }

  cachedOrganizers = parsed;
  return cachedOrganizers;
}

export function saveOrganizersToDisk(organizers: CommunityOrganizerProfile[]): void {
  try {
    cachedOrganizers = organizers;
    const dataFile = getDataFile();
    const dir = path.dirname(dataFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const nonce = Math.random().toString(36).slice(2, 8);
    const tmpFile = path.join(dir, `.organizers.json.tmp.${process.pid}.${Date.now()}.${nonce}`);
    const content = JSON.stringify(organizers, null, 2);
    fs.writeFileSync(tmpFile, content, "utf-8");
    try {
      fs.renameSync(tmpFile, dataFile);
    } catch {
      fs.writeFileSync(dataFile, content, "utf-8");
      try {
        fs.unlinkSync(tmpFile);
      } catch {}
    }

    // Persist to PostgreSQL SystemSetting (STORAGE_organizers.json)
    persistStorageToDb("organizers.json", content).catch((err) => {
      console.warn("[organizers] Background persist organizers.json to DB warning:", err);
    });
  } catch (err) {
    console.error("Failed to write organizers to disk", err);
  }
}

export function getAllOrganizers(): CommunityOrganizerProfile[] {
  return loadOrganizersFromDisk();
}

export function getOrganizerByEmail(email: string): CommunityOrganizerProfile | null {
  const normalized = (email || "").trim().toLowerCase();
  const all = getAllOrganizers();
  return all.find((o) => o.email.toLowerCase() === normalized) || null;
}

export function getOrganizerById(id: string): CommunityOrganizerProfile | null {
  const all = getAllOrganizers();
  return all.find((o) => o.id === id) || null;
}

export function ensureOrganizerActive(
  payloadOrEmail:
    | string
    | {
        email: string;
        name?: string;
        category?: string;
        contactPerson?: string;
        phone?: string;
        notes?: string;
      },
  optionalName?: string
): CommunityOrganizerProfile {
  const payload =
    typeof payloadOrEmail === "string"
      ? { email: payloadOrEmail, name: optionalName }
      : payloadOrEmail;
  const normalizedEmail = (payload.email || "").trim().toLowerCase();
  const all = getAllOrganizers();
  const existing = all.find((o) => o.email.toLowerCase() === normalizedEmail);

  if (existing) {
    if (existing.status !== "ACTIVE") {
      existing.status = "ACTIVE";
      existing.updatedAt = new Date().toISOString();
      saveOrganizersToDisk(all);
    }
    return existing;
  }

  const now = new Date().toISOString();
  const newOrg: CommunityOrganizerProfile = {
    id: `org-comm-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    name: payload.name?.trim() || "Komunitas Kreatif",
    category: payload.category?.trim() || "Komunitas",
    contactPerson: payload.contactPerson?.trim() || payload.name?.trim() || "PIC Komunitas",
    phone: payload.phone?.trim() || OFFICIAL_CS_DISPLAY_PHONE,
    email: normalizedEmail,
    status: "ACTIVE",
    serviceModule: "CO_WORKING",
    scopeLevel: "TENANT",
    roleName: "Penyelenggara Event",
    notes: payload.notes || "Penyelenggara terdaftar resmi DAGO Creative Hub",
    bankName: null,
    accountNumber: null,
    accountHolder: null,
    branch: null,
    createdAt: now,
    updatedAt: now,
  };

  all.unshift(newOrg);
  saveOrganizersToDisk(all);
  return newOrg;
}

export function isOrganizerActive(email: string): boolean {
  try {
    const normalized = (email || "").trim().toLowerCase();
    const org = getOrganizerByEmail(normalized);
    if (org) {
      return org.status === "ACTIVE";
    }

    // Auto-healing fallback: If organizer has submitted or approved events in events.json, activate automatically
    try {
      const eventsFile = getDataFilePath("events.json");
      if (fs.existsSync(eventsFile)) {
        const raw = fs.readFileSync(eventsFile, "utf-8");
        const events = JSON.parse(raw);
        if (Array.isArray(events)) {
          const matchedEvt = events.find(
            (e: any) =>
              (e.organizerEmail || "").toLowerCase() === normalized &&
              e.status === "APPROVED"
          );
          if (matchedEvt) {
            ensureOrganizerActive({
              email: normalized,
              name: matchedEvt.organizerName,
              category: matchedEvt.category,
              phone: matchedEvt.organizerPhone,
              notes: `Penyelenggara aktif otomatis dari event: ${matchedEvt.title}`,
            });
            return true;
          }
        }
      }
    } catch {
      // Safe fallback
    }

    return false;
  } catch (err) {
    console.error("isOrganizerActive: Failed to check organizer status due to data error", err);
    return false;
  }
}

export interface RegisterOrganizerPayload {
  name: string;
  category: string;
  contactPerson: string;
  phone: string;
  email: string;
  notes?: string;
  initialStatus?: "ACTIVE" | "INACTIVE";
}

export function createOrganizer(payload: RegisterOrganizerPayload): CommunityOrganizerProfile {
  const normalizedEmail = (payload.email || "").trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new Error("Alamat email penyelenggara wajib diisi dengan format valid.");
  }
  if (!payload.name || payload.name.trim().length < 3) {
    throw new Error("Nama komunitas atau penyelenggara minimal 3 karakter.");
  }
  if (!payload.contactPerson || payload.contactPerson.trim().length < 2) {
    throw new Error("Nama penanggung jawab (PIC) wajib diisi.");
  }
  if (!payload.phone || payload.phone.trim().length < 8) {
    throw new Error("Nomor kontak telepon/WhatsApp minimal 8 digit.");
  }

  if (isTenantOwnerEmailSync(normalizedEmail)) {
    throw new Error(
      `EMAIL_CONFLICT: Email [${normalizedEmail}] sudah terdaftar sebagai akun pemilik mitra.`
    );
  }

  const all = getAllOrganizers();
  const existing = all.find((o) => o.email.toLowerCase() === normalizedEmail);
  if (existing) {
    throw new Error(`Penyelenggara dengan email [${normalizedEmail}] sudah terdaftar sebelumnya.`);
  }

  const now = new Date().toISOString();
  const newOrg: CommunityOrganizerProfile = {
    id: `org-comm-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    name: payload.name.trim(),
    category: payload.category?.trim() || "Komunitas Kreatif",
    contactPerson: payload.contactPerson.trim(),
    phone: payload.phone.trim(),
    email: normalizedEmail,
    status: payload.initialStatus || "ACTIVE",
    serviceModule: "CO_WORKING",
    scopeLevel: "TENANT",
    roleName: "Penyelenggara Event",
    notes: payload.notes?.trim() || null,
    createdAt: now,
    updatedAt: now,
  };

  all.unshift(newOrg);
  saveOrganizersToDisk(all);
  return newOrg;
}

export function updateOrganizerStatus(id: string, status: "ACTIVE" | "INACTIVE"): CommunityOrganizerProfile {
  const all = getAllOrganizers();
  const idx = all.findIndex((o) => o.id === id);
  if (idx === -1) {
    throw new Error(`Penyelenggara dengan ID [${id}] tidak ditemukan.`);
  }

  all[idx] = {
    ...all[idx],
    status,
    updatedAt: new Date().toISOString(),
  };

  saveOrganizersToDisk(all);
  return all[idx];
}

export function updateOrganizerDetails(
  id: string,
  updates: Partial<
    Pick<
      CommunityOrganizerProfile,
      | "name"
      | "category"
      | "contactPerson"
      | "phone"
      | "notes"
      | "bankName"
      | "accountNumber"
      | "accountHolder"
      | "branch"
    >
  >
): CommunityOrganizerProfile {
  const all = getAllOrganizers();
  const idx = all.findIndex((o) => o.id === id || o.email.toLowerCase() === id.toLowerCase());
  if (idx === -1) {
    throw new Error(`Penyelenggara dengan ID/Email [${id}] tidak ditemukan.`);
  }

  all[idx] = {
    ...all[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveOrganizersToDisk(all);
  return all[idx];
}

/**
 * Updates organizer's bank account credentials on server storage.
 */
export function updateOrganizerBankDetails(
  emailOrId: string,
  bankDetails: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    branch?: string;
  }
): CommunityOrganizerProfile {
  const all = getAllOrganizers();
  const normalized = (emailOrId || "").trim().toLowerCase();
  const idx = all.findIndex(
    (o) => o.id === emailOrId || o.email.toLowerCase() === normalized
  );
  if (idx === -1) {
    throw new Error(`Penyelenggara [${emailOrId}] tidak ditemukan.`);
  }

  all[idx] = {
    ...all[idx],
    bankName: bankDetails.bankName.trim(),
    accountNumber: bankDetails.accountNumber.trim(),
    accountHolder: bankDetails.accountHolder.trim(),
    branch: bankDetails.branch ? bankDetails.branch.trim() : all[idx].branch || null,
    updatedAt: new Date().toISOString(),
  };

  saveOrganizersToDisk(all);
  return all[idx];
}

/**
 * Async version of updateOrganizerBankDetails: syncs with DB before read, persists after write.
 */
export async function updateOrganizerBankDetailsAsync(
  emailOrId: string,
  bankDetails: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    branch?: string;
  }
): Promise<CommunityOrganizerProfile> {
  await syncOrganizersFromDb().catch(() => {});
  const res = updateOrganizerBankDetails(emailOrId, bankDetails);
  await persistOrganizersToDb().catch(() => {});
  return res;
}

/**
 * Async version of ensureOrganizerActive: syncs with DB before read, persists after write.
 */
export async function ensureOrganizerActiveAsync(
  payloadOrEmail:
    | string
    | {
        email: string;
        name?: string;
        category?: string;
        contactPerson?: string;
        phone?: string;
        notes?: string;
      },
  optionalName?: string
): Promise<CommunityOrganizerProfile> {
  await syncOrganizersFromDb().catch(() => {});
  const res = ensureOrganizerActive(payloadOrEmail, optionalName);
  await persistOrganizersToDb().catch(() => {});
  return res;
}
