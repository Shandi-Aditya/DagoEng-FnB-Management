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

import { getDataFilePath } from "@/lib/data-storage";

const getDataFile = () => getDataFilePath("organizers.json");


let cachedOrganizers: CommunityOrganizerProfile[] | null = null;

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
    fs.writeFileSync(tmpFile, JSON.stringify(organizers, null, 2), "utf-8");
    try {
      fs.renameSync(tmpFile, dataFile);
    } catch {
      fs.writeFileSync(dataFile, JSON.stringify(organizers, null, 2), "utf-8");
      try {
        fs.unlinkSync(tmpFile);
      } catch {}
    }
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

export function ensureOrganizerActive(payload: {
  email: string;
  name?: string;
  category?: string;
  contactPerson?: string;
  phone?: string;
  notes?: string;
}): CommunityOrganizerProfile {
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
    phone: payload.phone?.trim() || "+62 812-0000-0000",
    email: normalizedEmail,
    status: "ACTIVE",
    serviceModule: "CO_WORKING",
    scopeLevel: "TENANT",
    roleName: "Penyelenggara Event",
    notes: payload.notes || "Penyelenggara terdaftar resmi DAGO Creative Hub",
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
  updates: Partial<Pick<CommunityOrganizerProfile, "name" | "category" | "contactPerson" | "phone" | "notes">>
): CommunityOrganizerProfile {
  const all = getAllOrganizers();
  const idx = all.findIndex((o) => o.id === id);
  if (idx === -1) {
    throw new Error(`Penyelenggara dengan ID [${id}] tidak ditemukan.`);
  }

  all[idx] = {
    ...all[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveOrganizersToDisk(all);
  return all[idx];
}
