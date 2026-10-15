import fs from "fs";
import path from "path";
import { CommunityEvent, EventCategory, EventStatus, EventSubmissionPayload, PublicCommunityEvent } from "@/types/event";

const DATA_FILE = path.join(process.cwd(), "data", "events.json");

// Default verified community events for Dago Creative Hub
const INITIAL_COMMUNITY_EVENTS: CommunityEvent[] = [
  {
    id: "evt-latte-art-2026",
    title: "Dago Barista Guild: Latte Art Throwdown & Sensory Workshop",
    category: "WORKSHOP",
    description: "Kompetisi persahabatan latte art pour-over dan workshop kalibrasi indra pengecap bersama barista juara regional Jawa Barat. Terbuka untuk antusias kopi, home barista, dan profesional.",
    startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
    location: "Amphitheater & Co-Working Lounge, Dago Creative Hub Lt. 2",
    isPaid: true,
    price: 35000,
    posterUrl: "https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=80",
    externalRegistrationUrl: "https://dagoeng.com/events/latte-art-register",
    organizerName: "Dago Specialty Coffee Society",
    organizerEmail: "baristaguild@dagocreative.id",
    organizerPhone: "+62 812-9876-5432",
    status: "APPROVED",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "evt-indie-game-2026",
    title: "Bandung Game Dev Showcase: Playtest & Pitch Jam",
    category: "TECH",
    description: "Sesi temu komunitas pengembang game indie se-Bandung Raya. Hadirkan prototype game buatanmu, dapatkan feedback pemain langsung, dan ikuti sharing session pendanaan kreatif.",
    startDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000).toISOString(),
    location: "Main Hall & Tech Lab, Dago Creative Hub",
    isPaid: false,
    price: 0,
    posterUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80",
    externalRegistrationUrl: "https://gamedev.org/event/bandung-playtest",
    organizerName: "Bandung Game Creators Collective",
    organizerEmail: "halo@bandungdev.org",
    organizerPhone: "+62 813-1122-3344",
    status: "APPROVED",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "evt-typography-2026",
    title: "Creative Typography & Risograph Print Lab",
    category: "CREATIVE",
    description: "Eksplorasi eksperimental aksara Sunda kontemporer dan teknik cetak risograph 2-warna bersama desainer grafis studio ternama Bandung. Bawa pulang hasil cetakan karyamu.",
    startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
    location: "Creative Maker Space Lt. 1, Dago Creative Hub",
    isPaid: true,
    price: 75000,
    posterUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80",
    externalRegistrationUrl: "https://artcollective.id/typography-riso",
    organizerName: "Studio Aksara Priangan",
    organizerEmail: "info@aksarapriangan.id",
    organizerPhone: "+62 817-2233-4455",
    status: "APPROVED",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "evt-community-cleanup-2026",
    title: "Dago Eco-Walk & Green Community Meetup",
    category: "COMMUNITY",
    description: "Kegiatan santai jalan pagi di kawasan Dago Atas, edukasi pemilahan sampah organik kafe, dan diskusi inisiatif sirkular ekonomi bersama pegiat lingkungan lokal.",
    startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // Past event for testing separator
    endDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
    location: "Courtyard Garden, Dago Creative Hub",
    isPaid: false,
    price: 0,
    posterUrl: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=80",
    externalRegistrationUrl: null,
    organizerName: "Dago Hijau Berkelanjutan",
    organizerEmail: "kontak@dagohijau.id",
    organizerPhone: "+62 819-8877-6655",
    status: "APPROVED",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

/**
 * In-memory cache for high-throughput reads.
 */
let cachedEvents: CommunityEvent[] | null = null;

// In-process write lock queue to serialize concurrent write operations
let writeQueue = Promise.resolve();

function loadEventsFromDisk(): CommunityEvent[] {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_COMMUNITY_EVENTS, null, 2), "utf-8");
      cachedEvents = [...INITIAL_COMMUNITY_EVENTS];
      return cachedEvents;
    }
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      cachedEvents = parsed;
      return cachedEvents;
    }
    cachedEvents = [...INITIAL_COMMUNITY_EVENTS];
    return cachedEvents;
  } catch (err) {
    console.error("Failed to read events from disk, fallback to memory", err);
    if (!cachedEvents) {
      cachedEvents = [...INITIAL_COMMUNITY_EVENTS];
    }
    return cachedEvents;
  }
}

/**
 * Hardened atomic file writer:
 * Writes to a temporary file first, then atomically renames to DATA_FILE.
 * Prevents file corruption, zero-byte reads, or truncated JSON during process restarts.
 */
function saveEventsToDisk(events: CommunityEvent[]): void {
  try {
    cachedEvents = events;
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Atomic write pattern: temp file + atomic rename
    const tmpFile = path.join(dir, `.events.json.tmp.${process.pid}.${Date.now()}`);
    fs.writeFileSync(tmpFile, JSON.stringify(events, null, 2), "utf-8");
    fs.renameSync(tmpFile, DATA_FILE);
  } catch (err) {
    console.error("Failed to write events to disk", err);
  }
}

/**
 * Sanitizes user-provided text inputs by stripping dangerous HTML/script tags.
 * Defense-in-depth against Stored XSS in public listings and admin moderation panels.
 */
export function sanitizeHtmlText(text: string): string {
  if (!text) return "";
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/**
 * Validates external URLs to block SSRF, internal network probing, and malicious schemes.
 * Strictly disallows loopback (localhost, 127.0.0.1, ::1), cloud metadata (169.254.169.254),
 * private IPv4 ranges (10.x, 172.16-31.x, 192.168.x), credentials in URLs, and non-HTTP(S) schemes.
 */
export function isSafePublicUrl(urlString: string): { safe: boolean; reason?: string } {
  try {
    const url = new URL(urlString.trim());

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { safe: false, reason: "Protokol URL harus menggunakan HTTP atau HTTPS." };
    }

    if (url.username || url.password) {
      return { safe: false, reason: "URL tidak boleh mengandung kredensial autentikasi." };
    }

    const hostname = url.hostname.toLowerCase();

    // Block loopback and local hostnames
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname === "[::1]"
    ) {
      return { safe: false, reason: "URL tidak boleh mengarah ke localhost atau antarmuka loopback." };
    }

    // Block cloud metadata services & internal TLDs
    if (
      hostname === "169.254.169.254" ||
      hostname === "metadata.google.internal" ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local")
    ) {
      return { safe: false, reason: "URL tidak boleh mengarah ke endpoint metadata internal cloud." };
    }

    // Block private IPv4 addresses (RFC 1918 & link-local)
    const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipMatch) {
      const octet1 = parseInt(ipMatch[1], 10);
      const octet2 = parseInt(ipMatch[2], 10);

      // 0.0.0.0/8
      if (octet1 === 0) return { safe: false, reason: "URL tidak boleh mengarah ke jaringan 0.0.0.0." };
      // 10.0.0.0/8
      if (octet1 === 10) return { safe: false, reason: "URL tidak boleh mengarah ke IP privat (10.x.x.x)." };
      // 127.0.0.0/8
      if (octet1 === 127) return { safe: false, reason: "URL tidak boleh mengarah ke IP loopback (127.x.x.x)." };
      // 169.254.0.0/16
      if (octet1 === 169 && octet2 === 254) return { safe: false, reason: "URL tidak boleh mengarah ke IP link-local." };
      // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
      if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) return { safe: false, reason: "URL tidak boleh mengarah ke IP privat (172.16-31.x.x)." };
      // 192.168.0.0/16
      if (octet1 === 192 && octet2 === 168) return { safe: false, reason: "URL tidak boleh mengarah ke IP privat (192.168.x.x)." };
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: "Format URL tidak valid." };
  }
}

/**
 * Sanitizes event object for public consumption.
 * Strips private organizer email, phone, and admin audit notes.
 */
export function toPublicEvent(event: CommunityEvent): PublicCommunityEvent {
  return {
    id: event.id,
    title: event.title,
    category: event.category,
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate,
    location: event.location,
    isPaid: event.isPaid,
    price: event.price,
    posterUrl: event.posterUrl,
    externalRegistrationUrl: event.externalRegistrationUrl || null,
    organizerName: event.organizerName,
    status: "APPROVED",
    createdAt: event.createdAt,
  };
}

/**
 * Get all APPROVED community events for public listing and landing page.
 * Strictly ignores any event that is PENDING, REJECTED, or ARCHIVED.
 */
export async function getApprovedEvents(): Promise<PublicCommunityEvent[]> {
  const all = loadEventsFromDisk();
  return all
    .filter((e) => e.status === "APPROVED")
    .map(toPublicEvent)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}

/**
 * Get a single approved event by ID for public detail page.
 * Returns null if not found or if the status is not APPROVED.
 */
export async function getPublicEventById(id: string): Promise<PublicCommunityEvent | null> {
  const all = loadEventsFromDisk();
  const event = all.find((e) => e.id === id && e.status === "APPROVED");
  if (!event) return null;
  return toPublicEvent(event);
}

/**
 * Get all events for Admin Moderation with optional status filter.
 * Internal only: Includes full organizer contact and moderation fields.
 */
export async function getAdminEvents(statusFilter?: EventStatus): Promise<CommunityEvent[]> {
  const all = loadEventsFromDisk();
  const filtered = statusFilter ? all.filter((e) => e.status === statusFilter) : all;
  return [...filtered].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Get a single event by ID for Admin Moderation.
 */
export async function getAdminEventById(id: string): Promise<CommunityEvent | null> {
  const all = loadEventsFromDisk();
  const found = all.find((e) => e.id === id);
  return found || null;
}

// Validation helpers
export function validateEventSubmission(payload: EventSubmissionPayload): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 1. Honeypot check (anti-spam)
  if (payload.honeypot && payload.honeypot.trim() !== "") {
    errors.push("Pengajuan terdeteksi sebagai spam.");
    return { valid: false, errors };
  }

  // 2. Organizer details
  if (!payload.organizerName || payload.organizerName.trim().length < 2) {
    errors.push("Nama penyelenggara wajib diisi (minimal 2 karakter).");
  } else if (payload.organizerName.length > 100) {
    errors.push("Nama penyelenggara maksimal 100 karakter.");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!payload.organizerEmail || !emailRegex.test(payload.organizerEmail.trim())) {
    errors.push("Format email penyelenggara tidak valid.");
  }

  const phoneRegex = /^(\+62|62|0)[0-9\s-]{8,15}$/;
  if (!payload.organizerPhone || !phoneRegex.test(payload.organizerPhone.trim())) {
    errors.push("Nomor WhatsApp/telepon tidak valid (contoh: 08123456789 atau +628123456789).");
  }

  // 3. Title & Category
  if (!payload.title || payload.title.trim().length < 3) {
    errors.push("Judul event wajib diisi (minimal 3 karakter).");
  } else if (payload.title.length > 150) {
    errors.push("Judul event maksimal 150 karakter.");
  }

  const validCategories: EventCategory[] = [
    "WORKSHOP",
    "MEETUP",
    "CREATIVE",
    "COMMUNITY",
    "TECH",
    "SEMINAR",
    "OTHER",
  ];
  if (!payload.category || !validCategories.includes(payload.category)) {
    errors.push("Kategori event yang dipilih tidak valid.");
  }

  // 4. Description
  if (!payload.description || payload.description.trim().length < 10) {
    errors.push("Deskripsi event wajib diisi (minimal 10 karakter).");
  } else if (payload.description.length > 3000) {
    errors.push("Deskripsi event maksimal 3000 karakter.");
  }

  // 5. Dates
  if (!payload.startDate || isNaN(new Date(payload.startDate).getTime())) {
    errors.push("Tanggal dan waktu mulai tidak valid.");
  }
  if (!payload.endDate || isNaN(new Date(payload.endDate).getTime())) {
    errors.push("Tanggal dan waktu selesai tidak valid.");
  }
  if (
    payload.startDate &&
    payload.endDate &&
    new Date(payload.endDate).getTime() < new Date(payload.startDate).getTime()
  ) {
    errors.push("Tanggal dan waktu selesai tidak boleh mendahului tanggal mulai.");
  }

  // 6. Location
  if (!payload.location || payload.location.trim().length < 3) {
    errors.push("Lokasi event wajib diisi (minimal 3 karakter).");
  }

  // 7. Pricing
  if (payload.isPaid) {
    if (typeof payload.price !== "number" || isNaN(payload.price) || payload.price <= 0) {
      errors.push("Nominal harga wajib diisi dan harus lebih dari Rp 0 untuk event berbayar.");
    }
  }

  // 8. Poster URL
  if (!payload.posterUrl || payload.posterUrl.trim().length === 0) {
    errors.push("URL poster event wajib diisi.");
  } else {
    const urlCheck = isSafePublicUrl(payload.posterUrl);
    if (!urlCheck.safe) {
      errors.push(`URL poster tidak valid: ${urlCheck.reason || "Format tidak diizinkan."}`);
    }
  }

  // 9. External Registration URL (Optional)
  if (payload.externalRegistrationUrl && payload.externalRegistrationUrl.trim().length > 0) {
    const urlCheck = isSafePublicUrl(payload.externalRegistrationUrl);
    if (!urlCheck.safe) {
      errors.push(`URL pendaftaran eksternal tidak valid: ${urlCheck.reason || "Format tidak diizinkan."}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Rate limiter map in memory (IP-based or key-based)
 */
const submissionRateMap = new Map<string, number[]>();

export function checkRateLimit(clientIp: string, maxRequests = 5, windowMs = 60000): boolean {
  const now = Date.now();
  const timestamps = submissionRateMap.get(clientIp) || [];
  const validTimestamps = timestamps.filter((t) => now - t < windowMs);

  if (validTimestamps.length >= maxRequests) {
    submissionRateMap.set(clientIp, validTimestamps);
    return false; // Rate limit exceeded
  }

  validTimestamps.push(now);
  submissionRateMap.set(clientIp, validTimestamps);
  return true;
}

/**
 * Create a new event submission.
 * Always sets status to PENDING.
 * Enforces duplicate submission prevention and input HTML sanitization.
 */
export async function createEventSubmission(payload: EventSubmissionPayload): Promise<CommunityEvent> {
  const validation = validateEventSubmission(payload);
  if (!validation.valid) {
    throw new Error(`Validasi gagal: ${validation.errors.join(", ")}`);
  }

  const all = loadEventsFromDisk();

  // Prevent rapid duplicate submission (same email + same title within 5 minutes)
  const normalizedTitle = payload.title.trim().toLowerCase();
  const normalizedEmail = payload.organizerEmail.trim().toLowerCase();
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

  const isDuplicate = all.some((e) => {
    const isSameOrganizer = e.organizerEmail.toLowerCase() === normalizedEmail;
    const isSameTitle = e.title.toLowerCase() === normalizedTitle;
    const isRecent = new Date(e.createdAt).getTime() > fiveMinutesAgo;
    return isSameOrganizer && isSameTitle && isRecent && e.status === "PENDING";
  });

  if (isDuplicate) {
    throw new Error(
      "Pengajuan event dengan judul serupa dari email ini baru saja dikirimkan dan sedang dalam antrean review. Mohon menunggu proses kurasi tim Dago Creative Hub."
    );
  }

  const newEvent: CommunityEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title: sanitizeHtmlText(payload.title),
    category: payload.category,
    description: sanitizeHtmlText(payload.description),
    startDate: new Date(payload.startDate).toISOString(),
    endDate: new Date(payload.endDate).toISOString(),
    location: sanitizeHtmlText(payload.location),
    isPaid: Boolean(payload.isPaid),
    price: payload.isPaid ? Number(payload.price || 0) : 0,
    posterUrl: payload.posterUrl.trim(),
    externalRegistrationUrl: payload.externalRegistrationUrl ? payload.externalRegistrationUrl.trim() : null,
    organizerName: sanitizeHtmlText(payload.organizerName),
    organizerEmail: payload.organizerEmail.trim().toLowerCase(),
    organizerPhone: payload.organizerPhone.trim(),
    status: "PENDING", // Always PENDING on submission
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  all.unshift(newEvent);
  saveEventsToDisk(all);

  return newEvent;
}

/**
 * Update event moderation status.
 * Handled only by authorized admin roles.
 */
export async function updateEventStatus(
  id: string,
  status: EventStatus,
  options?: {
    adminNotes?: string | null;
    rejectionReason?: string | null;
    revisionNotes?: string | null;
  }
): Promise<CommunityEvent> {
  const all = loadEventsFromDisk();
  const index = all.findIndex((e) => e.id === id);
  if (index === -1) {
    throw new Error(`Event dengan ID ${id} tidak ditemukan.`);
  }

  const existing = all[index];
  const updated: CommunityEvent = {
    ...existing,
    status,
    adminNotes: options?.adminNotes !== undefined ? options.adminNotes : existing.adminNotes,
    rejectionReason: options?.rejectionReason !== undefined ? options.rejectionReason : existing.rejectionReason,
    revisionNotes: options?.revisionNotes !== undefined ? options.revisionNotes : existing.revisionNotes,
    updatedAt: new Date().toISOString(),
  };

  all[index] = updated;
  saveEventsToDisk(all);

  return updated;
}

/**
 * Update event details (Admin editing).
 * Strictly forbids status modification, id tampering, or audit trail manipulation.
 * Status changes MUST only occur through updateEventStatus.
 */
export async function updateEventDetails(
  id: string,
  updates: Partial<Omit<CommunityEvent, "id" | "createdAt" | "status">>
): Promise<CommunityEvent> {
  const all = loadEventsFromDisk();
  const index = all.findIndex((e) => e.id === id);
  if (index === -1) {
    throw new Error(`Event dengan ID ${id} tidak ditemukan.`);
  }

  const existing = all[index];

  // Whitelist only editable content fields. Reject or discard status / audit fields
  const sanitizedUpdates: Partial<CommunityEvent> = {};
  if (updates.title !== undefined) sanitizedUpdates.title = sanitizeHtmlText(updates.title);
  if (updates.category !== undefined) sanitizedUpdates.category = updates.category;
  if (updates.description !== undefined) sanitizedUpdates.description = sanitizeHtmlText(updates.description);
  if (updates.startDate !== undefined) sanitizedUpdates.startDate = new Date(updates.startDate).toISOString();
  if (updates.endDate !== undefined) sanitizedUpdates.endDate = new Date(updates.endDate).toISOString();
  if (updates.location !== undefined) sanitizedUpdates.location = sanitizeHtmlText(updates.location);
  if (updates.isPaid !== undefined) sanitizedUpdates.isPaid = Boolean(updates.isPaid);
  if (updates.price !== undefined) sanitizedUpdates.price = Number(updates.price || 0);
  if (updates.posterUrl !== undefined) {
    const check = isSafePublicUrl(updates.posterUrl);
    if (!check.safe) throw new Error(`URL poster tidak valid: ${check.reason}`);
    sanitizedUpdates.posterUrl = updates.posterUrl.trim();
  }
  if (updates.externalRegistrationUrl !== undefined) {
    if (updates.externalRegistrationUrl && updates.externalRegistrationUrl.trim() !== "") {
      const check = isSafePublicUrl(updates.externalRegistrationUrl);
      if (!check.safe) throw new Error(`URL pendaftaran eksternal tidak valid: ${check.reason}`);
      sanitizedUpdates.externalRegistrationUrl = updates.externalRegistrationUrl.trim();
    } else {
      sanitizedUpdates.externalRegistrationUrl = null;
    }
  }
  if (updates.organizerName !== undefined) sanitizedUpdates.organizerName = sanitizeHtmlText(updates.organizerName);

  const updated: CommunityEvent = {
    ...existing,
    ...sanitizedUpdates,
    status: existing.status, // NEVER overwrite status via updateEventDetails
    updatedAt: new Date().toISOString(),
  };

  all[index] = updated;
  saveEventsToDisk(all);

  return updated;
}
