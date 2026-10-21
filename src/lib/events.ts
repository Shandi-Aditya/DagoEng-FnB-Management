import fs from "fs";
import path from "path";
import {
  CommunityEvent,
  EventCategory,
  EventStatus,
  EventSubmissionPayload,
  PublicCommunityEvent,
  EventTicketOrder,
  EventBookingPayload,
  EventOperationalStats,
  AttendeeCheckInStatus,
  TicketPaymentStatus,
  TicketPaymentMethod,
} from "@/types/event";

const DATA_FILE = path.join(process.cwd(), "data", "events.json");
const BOOKINGS_DATA_FILE = path.join(process.cwd(), "data", "event_bookings.json");

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
    guidelines: [
      "Bawa apron dan milk pitcher favorit Anda (opsional, pitcher cadangan disediakan).",
      "Koneksi Wi-Fi publik dan sertifikat partisipasi workshop disediakan gratis.",
      "Sesi cupping dan kalibrasi sensoris dimulai tepat waktu pukul 14:00 WIB.",
    ],
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
    guidelines: [
      "Bawa laptop / device pengujian prototype game buatanmu.",
      "Tersedia meja display, monitor HDMI, dan colokan listrik di Main Tech Lab.",
      "Terbuka untuk umum, tester pemain, dan developer game segala level.",
    ],
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
    guidelines: [
      "Seluruh alat cetak risograph, master stensil, dan kertas seni disediakan studio.",
      "Peserta membawa pulang 10 lembar cetakan poster aksara Sunda 2-warna.",
      "Disarankan menggunakan pakaian yang siap terkena percikan tinta cetak kedelai.",
    ],
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
    guidelines: [
      "Harap membawa tumbler air minum pribadi dan sarung tangan kain.",
      "Gunakan pakaian olahraga santai dan sepatu jalan yang nyaman.",
      "Kumpul di Courtyard Garden Dago Creative Hub 15 menit sebelum kegiatan.",
    ],
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

    // Atomic write pattern: temp file + atomic rename with random nonce
    const nonce = Math.random().toString(36).slice(2, 8);
    const tmpFile = path.join(dir, `.events.json.tmp.${process.pid}.${Date.now()}.${nonce}`);
    fs.writeFileSync(tmpFile, JSON.stringify(events, null, 2), "utf-8");
    try {
      fs.renameSync(tmpFile, DATA_FILE);
    } catch {
      fs.writeFileSync(DATA_FILE, JSON.stringify(events, null, 2), "utf-8");
      try { fs.unlinkSync(tmpFile); } catch {}
    }
  } catch (err) {
    console.error("Failed to write events to disk", err);
  }
}

/**
 * Parses guidelines input (array of strings or newline-separated string).
 */
export function parseGuidelinesInput(input?: string[] | string | null): string[] | null {
  if (!input) return null;
  if (Array.isArray(input)) {
    const sanitized = input.map(sanitizeHtmlText).filter((s) => s.length > 0);
    return sanitized.length > 0 ? sanitized : null;
  }
  if (typeof input === "string") {
    const sanitized = input
      .split("\n")
      .map((line) => sanitizeHtmlText(line.trim()))
      .filter((s) => s.length > 0);
    return sanitized.length > 0 ? sanitized : null;
  }
  return null;
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

export type VenueCapacitySource =
  | "ORGANIZER_SPECIFIED"
  | "COWORKING_FACILITY_SPEC"
  | "UNCONFIRMED_ESTIMATE";

export interface VenueCapacityResolution {
  capacity: number;
  isConfirmed: boolean;
  source: VenueCapacitySource;
  sourceType: VenueCapacitySource;
  sourceDescription: string;
}

/**
 * Resolves venue seating capacity and traces data origin.
 * IMPORTANT AUDIT COMPLIANCE:
 * - Only coworking meeting rooms (Seminyak: 6, Ubud: 12) have confirmed specs in codebase.
 * - Public hub venues (Amphitheater, Main Hall, Tech Lab, Maker Space) do not have official database tables yet.
 *   They are explicitly flagged as UNCONFIRMED_ESTIMATE so assumed numbers are never treated as facts.
 */
export function resolveVenueCapacity(
  eventOrLocation: string | Pick<CommunityEvent, "location" | "maxCapacity">,
  explicitMaxCapacity?: number
): VenueCapacityResolution {
  const location =
    typeof eventOrLocation === "string" ? eventOrLocation : eventOrLocation.location;
  const maxCapacity =
    typeof eventOrLocation === "string"
      ? explicitMaxCapacity
      : eventOrLocation.maxCapacity ?? explicitMaxCapacity;

  // 1. Explicit quota specified by organizer or hub curator
  if (typeof maxCapacity === "number" && maxCapacity > 0) {
    return {
      capacity: maxCapacity,
      isConfirmed: true,
      source: "ORGANIZER_SPECIFIED",
      sourceType: "ORGANIZER_SPECIFIED",
      sourceDescription: "Kuota tiket ditentukan secara definitif oleh penyelenggara/admin pada formulir event.",
    };
  }

  const loc = (location || "").toLowerCase();

  // 2. Confirmed facility specifications from Coworking Module (src/features/coworking/coworking-data.ts)
  if (loc.includes("boardroom") || (loc.includes("meeting") && loc.includes("12"))) {
    return {
      capacity: 12,
      isConfirmed: true,
      source: "COWORKING_FACILITY_SPEC",
      sourceType: "COWORKING_FACILITY_SPEC",
      sourceDescription: "Berdasarkan spesifikasi fasilitas resmi Boardroom Ubud (12 Pax).",
    };
  }
  if (loc.includes("seminyak") || (loc.includes("meeting") && loc.includes("6"))) {
    return {
      capacity: 6,
      isConfirmed: true,
      source: "COWORKING_FACILITY_SPEC",
      sourceType: "COWORKING_FACILITY_SPEC",
      sourceDescription: "Berdasarkan spesifikasi fasilitas resmi Meeting Room Seminyak (6 Pax).",
    };
  }

  // 3. Unconfirmed Public Hub Venues (Estimates only - NOT yet confirmed by official hub master configuration)
  let estimatedCap = 50;
  if (loc.includes("main hall")) estimatedCap = 120;
  else if (loc.includes("amphitheater")) estimatedCap = 80;
  else if (loc.includes("tech lab")) estimatedCap = 35;
  else if (loc.includes("maker space") || loc.includes("maker")) estimatedCap = 25;

  return {
    capacity: estimatedCap,
    isConfirmed: false,
    source: "UNCONFIRMED_ESTIMATE",
    sourceType: "UNCONFIRMED_ESTIMATE",
    sourceDescription: `Kapasitas fisik belum memiliki master data resmi (belum dikonfirmasi di database, estimasi default operasional sementara: ${estimatedCap} pax).`,
  };
}

/**
 * Returns the maximum seating/ticket capacity for an event.
 * Uses event.maxCapacity if specified, otherwise matches venue name or defaults to 50.
 */
export function getEventCapacity(event: Pick<CommunityEvent, "location" | "maxCapacity">): number {
  return resolveVenueCapacity(event).capacity;
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
    maxCapacity: event.maxCapacity || getEventCapacity(event),
    isPaid: event.isPaid,
    price: event.price,
    posterUrl: event.posterUrl,
    externalRegistrationUrl: event.externalRegistrationUrl || null,
    organizerName: event.organizerName,
    status: "APPROVED",
    guidelines: event.guidelines || null,
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
      "Pengajuan event dengan judul serupa dari email ini baru saja dikirimkan dan sedang dalam antrean review. Mohon menunggu proses kurasi tim kurator platform."
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
    maxCapacity: payload.maxCapacity && payload.maxCapacity > 0 ? Number(payload.maxCapacity) : undefined,
    isPaid: Boolean(payload.isPaid),
    price: payload.isPaid ? Number(payload.price || 0) : 0,
    posterUrl: payload.posterUrl.trim(),
    externalRegistrationUrl: payload.externalRegistrationUrl ? payload.externalRegistrationUrl.trim() : null,
    organizerName: sanitizeHtmlText(payload.organizerName),
    organizerEmail: payload.organizerEmail.trim().toLowerCase(),
    organizerPhone: payload.organizerPhone.trim(),
    guidelines: parseGuidelinesInput(payload.guidelines),
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
  if (updates.guidelines !== undefined) sanitizedUpdates.guidelines = parseGuidelinesInput(updates.guidelines);

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

// =============================================================================
// EVENT TICKET ORDERS & ATTENDEE MANAGEMENT
// =============================================================================

const INITIAL_BOOKINGS: EventTicketOrder[] = [
  {
    id: "tkt-latte-001",
    ticketCode: "DAGO-EVT-77491",
    eventId: "evt-latte-art-2026",
    eventTitle: "Dago Barista Guild: Latte Art Throwdown & Sensory Workshop",
    eventDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    eventLocation: "Amphitheater & Co-Working Lounge, Dago Creative Hub Lt. 2",
    guestName: "Budi Santoso",
    guestEmail: "budi.santoso@gmail.com",
    guestPhone: "081234567891",
    institution: "Kopi Senja Staff",
    ticketCount: 1,
    unitPrice: 35000,
    totalPrice: 35000,
    platformFeePercent: 20,
    platformFeeAmount: 7000,
    organizerRevenueAmount: 28000,
    paymentMethod: "QRIS",
    paymentStatus: "PAID",
    checkInStatus: "REGISTERED",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "tkt-latte-002",
    ticketCode: "DAGO-EVT-88219",
    eventId: "evt-latte-art-2026",
    eventTitle: "Dago Barista Guild: Latte Art Throwdown & Sensory Workshop",
    eventDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    eventLocation: "Amphitheater & Co-Working Lounge, Dago Creative Hub Lt. 2",
    guestName: "Siti Rahmawati",
    guestEmail: "siti.rahma@yahoo.com",
    guestPhone: "081987654321",
    institution: "Home Brewer Community",
    ticketCount: 2,
    unitPrice: 35000,
    totalPrice: 70000,
    platformFeePercent: 20,
    platformFeeAmount: 14000,
    organizerRevenueAmount: 56000,
    paymentMethod: "QRIS",
    paymentStatus: "PAID",
    checkInStatus: "REGISTERED",
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "tkt-game-001",
    ticketCode: "DAGO-EVT-10293",
    eventId: "evt-indie-game-2026",
    eventTitle: "Bandung Game Dev Showcase: Playtest & Pitch Jam",
    eventDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
    eventLocation: "Main Hall & Tech Lab, Dago Creative Hub",
    guestName: "Fajar Nugraha",
    guestEmail: "fajar.nugraha@techdev.id",
    guestPhone: "085678912345",
    institution: "Indie Studio",
    ticketCount: 1,
    unitPrice: 0,
    totalPrice: 0,
    platformFeePercent: 20,
    platformFeeAmount: 0,
    organizerRevenueAmount: 0,
    paymentMethod: "FREE",
    paymentStatus: "PAID",
    checkInStatus: "REGISTERED",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "tkt-typo-001",
    ticketCode: "DAGO-EVT-44910",
    eventId: "evt-typography-2026",
    eventTitle: "Creative Typography & Risograph Print Lab",
    eventDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    eventLocation: "Creative Maker Space Lt. 1, Dago Creative Hub",
    guestName: "Dewi Lestari",
    guestEmail: "dewi.lestari@desain.ac.id",
    guestPhone: "087811223344",
    institution: "Desain Grafis ITB",
    ticketCount: 1,
    unitPrice: 75000,
    totalPrice: 75000,
    platformFeePercent: 20,
    platformFeeAmount: 15000,
    organizerRevenueAmount: 60000,
    paymentMethod: "QRIS",
    paymentStatus: "PAID",
    checkInStatus: "REGISTERED",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

let cachedBookings: EventTicketOrder[] | null = null;
let bookingOperationQueue: Promise<any> = Promise.resolve();

/**
 * Sequential execution wrapper for concurrent booking requests.
 * Eliminates race condition window on disk reads/writes.
 */
function withBookingLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = () => fn();
  const next = bookingOperationQueue.then(run, run);
  bookingOperationQueue = next.catch(() => {});
  return next;
}

function loadBookingsFromDisk(): EventTicketOrder[] {
  try {
    if (!fs.existsSync(BOOKINGS_DATA_FILE)) {
      const dir = path.dirname(BOOKINGS_DATA_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(BOOKINGS_DATA_FILE, JSON.stringify(INITIAL_BOOKINGS, null, 2), "utf-8");
      cachedBookings = [...INITIAL_BOOKINGS];
      return cachedBookings;
    }
    const raw = fs.readFileSync(BOOKINGS_DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      cachedBookings = parsed;
      return cachedBookings;
    }
    cachedBookings = [...INITIAL_BOOKINGS];
    return cachedBookings;
  } catch (err) {
    console.error("Failed to read event bookings from disk, fallback to memory", err);
    if (!cachedBookings) {
      cachedBookings = [...INITIAL_BOOKINGS];
    }
    return cachedBookings;
  }
}

function saveBookingsToDisk(bookings: EventTicketOrder[]): void {
  try {
    cachedBookings = bookings;
    const dir = path.dirname(BOOKINGS_DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const nonce = Math.random().toString(36).slice(2, 8);
    const tmpFile = path.join(dir, `.event_bookings.json.tmp.${process.pid}.${Date.now()}.${nonce}`);
    fs.writeFileSync(tmpFile, JSON.stringify(bookings, null, 2), "utf-8");
    try {
      fs.renameSync(tmpFile, BOOKINGS_DATA_FILE);
    } catch {
      fs.writeFileSync(BOOKINGS_DATA_FILE, JSON.stringify(bookings, null, 2), "utf-8");
      try { fs.unlinkSync(tmpFile); } catch {}
    }
  } catch (err) {
    console.error("Failed to write event bookings to disk", err);
  }
}

/**
 * Get all event bookings with optional eventId filter.
 */
export async function getEventBookings(eventId?: string): Promise<EventTicketOrder[]> {
  const all = loadBookingsFromDisk();
  const filtered = eventId ? all.filter((b) => b.eventId === eventId) : all;
  return [...filtered].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Get single booking by ID.
 */
export async function getBookingById(id: string): Promise<EventTicketOrder | null> {
  const all = loadBookingsFromDisk();
  return all.find((b) => b.id === id) || null;
}

/**
 * Validates ticket booking input against business rules.
 */
export function validateEventBooking(
  payload: EventBookingPayload,
  event: CommunityEvent
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Honeypot check
  if (payload.honeypot && payload.honeypot.trim() !== "") {
    errors.push("Pemesanan tiket terdeteksi sebagai bot.");
    return { valid: false, errors };
  }

  // Event status check
  if (event.status !== "APPROVED") {
    errors.push("Pendaftaran tiket hanya dibuka untuk event yang sudah disetujui kurator.");
  }

  // Event date check
  if (new Date(event.endDate).getTime() < Date.now()) {
    errors.push("Pendaftaran tiket telah ditutup karena waktu pelaksanaan event telah berakhir.");
  }

  // Guest name
  if (!payload.guestName || payload.guestName.trim().length < 2) {
    errors.push("Nama lengkap pemesan wajib diisi (minimal 2 karakter).");
  }

  // Guest email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!payload.guestEmail || !emailRegex.test(payload.guestEmail.trim())) {
    errors.push("Format alamat email tidak valid.");
  }

  // Guest phone
  const phoneRegex = /^(\+62|62|0)[0-9\s-]{8,15}$/;
  if (!payload.guestPhone || !phoneRegex.test(payload.guestPhone.trim())) {
    errors.push("Nomor WhatsApp / telepon tidak valid (contoh: 08123456789 atau +628123456789).");
  }

  // Ticket count
  if (
    typeof payload.ticketCount !== "number" ||
    isNaN(payload.ticketCount) ||
    payload.ticketCount < 1 ||
    payload.ticketCount > 10
  ) {
    errors.push("Jumlah pemesanan tiket harus antara 1 sampai 10 tiket per transaksi.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Creates a new ticket booking order for an event.
 * Enforces server-side price calculation, 20% platform commission fee, and 80% organizer payout.
 */
export async function createEventBooking(
  payload: EventBookingPayload,
  clientIp = "127.0.0.1"
): Promise<EventTicketOrder> {
  // Rate limit ticket booking: max 30 requests per minute
  const allowed = checkRateLimit(`booking-${clientIp}`, 30, 60000);
  if (!allowed) {
    throw new Error("Terlalu banyak permintaan pemesanan tiket dalam waktu singkat. Silakan tunggu beberapa saat.");
  }

  return withBookingLock(async () => {
    const allEvents = loadEventsFromDisk();
    const event = allEvents.find((e) => e.id === payload.eventId);
    if (!event) {
      throw new Error(`Event dengan ID ${payload.eventId} tidak ditemukan.`);
    }

    const validation = validateEventBooking(payload, event);
    if (!validation.valid) {
      throw new Error(`Validasi gagal: ${validation.errors.join(", ")}`);
    }

    const allBookings = loadBookingsFromDisk();
    const activeBookings = allBookings.filter(
      (b) => b.eventId === event.id && b.paymentStatus !== "CANCELLED"
    );

    // 1. Quota & Venue Capacity Check
    const maxCapacity = getEventCapacity(event);
    const currentlyBooked = activeBookings.reduce((sum, b) => sum + b.ticketCount, 0);
    const remainingQuota = maxCapacity - currentlyBooked;

    if (payload.ticketCount > remainingQuota) {
      throw new Error(
        `Kapasitas venue atau kuota tiket telah penuh. Sisa tiket tersedia saat ini: ${Math.max(0, remainingQuota)} tiket.`
      );
    }

    // 2. Anti-duplicate Booking Protection (same email + same event within 3 minutes)
    const normalizedEmail = payload.guestEmail.trim().toLowerCase();
    const threeMinutesAgo = Date.now() - 3 * 60 * 1000;
    const isDuplicate = activeBookings.some((b) => {
      const isSameEmail = b.guestEmail.toLowerCase() === normalizedEmail;
      const isRecent = new Date(b.createdAt).getTime() > threeMinutesAgo;
      return isSameEmail && isRecent;
    });

    if (isDuplicate) {
      throw new Error(
        "Pemesanan tiket untuk event ini baru saja dilakukan dari email yang sama. Mohon tunggu 3 menit sebelum melakukan pemesanan tiket baru."
      );
    }

    const ticketCount = Math.max(1, Math.min(10, Math.floor(payload.ticketCount)));
    const unitPrice = event.isPaid ? Number(event.price || 0) : 0;
    const totalPrice = unitPrice * ticketCount;

    // Revenue sharing formula: 20% Platform Fee, 80% Organizer Revenue
    const platformFeePercent = 20;
    const platformFeeAmount = Math.round((totalPrice * platformFeePercent) / 100);
    const organizerRevenueAmount = totalPrice - platformFeeAmount;

    // Determine initial payment status:
    // - FREE tickets are confirmed immediately as PAID.
    // - PAID tickets MUST start as PENDING until confirmed/verified by organizer or admin.
    const isFree = totalPrice === 0;
    const paymentStatus: TicketPaymentStatus = isFree ? "PAID" : "PENDING";
    const paymentMethod: TicketPaymentMethod = isFree ? "FREE" : payload.paymentMethod || "QRIS";

    // Generate unique human-readable ticket code e.g. DAGO-EVT-92812
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const ticketCode = `DAGO-EVT-${randomSuffix}`;

    const newBooking: EventTicketOrder = {
      id: `tkt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ticketCode,
      eventId: event.id,
      eventTitle: event.title,
      eventDate: event.startDate,
      eventLocation: event.location,
      guestName: sanitizeHtmlText(payload.guestName),
      guestEmail: payload.guestEmail.trim().toLowerCase(),
      guestPhone: payload.guestPhone.trim(),
      institution: payload.institution ? sanitizeHtmlText(payload.institution) : null,
      ticketCount,
      unitPrice,
      totalPrice,
      platformFeePercent,
      platformFeeAmount,
      organizerRevenueAmount,
      paymentMethod,
      paymentStatus,
      checkInStatus: "REGISTERED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    allBookings.unshift(newBooking);
    saveBookingsToDisk(allBookings);

    return newBooking;
  });
}

/**
 * Updates attendee check-in status (Admin/Staff check-in on event day).
 */
export async function updateBookingCheckIn(
  bookingId: string,
  status: AttendeeCheckInStatus
): Promise<EventTicketOrder> {
  const allBookings = loadBookingsFromDisk();
  const index = allBookings.findIndex((b) => b.id === bookingId);
  if (index === -1) {
    throw new Error(`Pemesanan tiket dengan ID ${bookingId} tidak ditemukan.`);
  }

  const existing = allBookings[index];
  const updated: EventTicketOrder = {
    ...existing,
    checkInStatus: status,
    checkInTime: status === "CHECKED_IN" ? new Date().toISOString() : null,
    updatedAt: new Date().toISOString(),
  };

  allBookings[index] = updated;
  saveBookingsToDisk(allBookings);

  return updated;
}

/**
 * Updates ticket payment status (e.g. PAID or CANCELLED).
 */
export async function updateBookingPaymentStatus(
  bookingId: string,
  status: TicketPaymentStatus
): Promise<EventTicketOrder> {
  const allBookings = loadBookingsFromDisk();
  const index = allBookings.findIndex((b) => b.id === bookingId);
  if (index === -1) {
    throw new Error(`Pemesanan tiket dengan ID ${bookingId} tidak ditemukan.`);
  }

  const existing = allBookings[index];
  const updated: EventTicketOrder = {
    ...existing,
    paymentStatus: status,
    updatedAt: new Date().toISOString(),
  };

  allBookings[index] = updated;
  saveBookingsToDisk(allBookings);

  return updated;
}

/**
 * Calculates operational KPIs for Event Komunitas.
 */
export async function getEventOperationalStats(): Promise<EventOperationalStats> {
  const events = loadEventsFromDisk();
  const bookings = loadBookingsFromDisk();

  const totalEvents = events.length;
  const approvedEvents = events.filter((e) => e.status === "APPROVED").length;
  const pendingEvents = events.filter((e) => e.status === "PENDING" || e.status === "REVISION_REQUESTED").length;

  const paidBookings = bookings.filter((b) => b.paymentStatus === "PAID");
  const totalTicketsSold = paidBookings.reduce((sum, b) => sum + b.ticketCount, 0);
  const totalAttendees = paidBookings.length;
  const totalTicketRevenue = paidBookings.reduce((sum, b) => sum + b.totalPrice, 0);
  const platformCommissionRevenue = paidBookings.reduce((sum, b) => sum + b.platformFeeAmount, 0);
  const organizerPayoutTotal = paidBookings.reduce((sum, b) => sum + b.organizerRevenueAmount, 0);

  return {
    totalEvents,
    approvedEvents,
    pendingEvents,
    totalAttendees,
    totalTicketsSold,
    totalTicketRevenue,
    platformCommissionRevenue,
    organizerPayoutTotal,
  };
}

export interface OrganizerPortalSummary {
  organizerEmail: string;
  organizerName: string;
  totalEvents: number;
  approvedEvents: number;
  pendingEvents: number;
  revisionEvents: number;
  totalAttendees: number;
  totalTicketsSold: number;
  grossRevenue: number;
  platformFeeAmount: number;
  organizerPayoutAmount: number; // 80% payout
}

export interface OrganizerPortalData {
  summary: OrganizerPortalSummary;
  events: CommunityEvent[];
  bookings: EventTicketOrder[];
}

/**
 * Retrieves Community Organizer Portal data strictly isolated by organizerEmail.
 * Returns only events and attendees belonging to the verified organizer.
 */
export async function getOrganizerPortalData(
  organizerEmail: string
): Promise<OrganizerPortalData> {
  const normalizedEmail = (organizerEmail || "").trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new Error("Alamat email penyelenggara tidak valid.");
  }

  const allEvents = loadEventsFromDisk();
  const myEvents = allEvents.filter(
    (e) => (e.organizerEmail || "").toLowerCase() === normalizedEmail
  );

  const eventIds = new Set(myEvents.map((e) => e.id));
  const allBookings = loadBookingsFromDisk();
  const myBookings = allBookings.filter((b) => eventIds.has(b.eventId));

  const approvedEvents = myEvents.filter((e) => e.status === "APPROVED").length;
  const pendingEvents = myEvents.filter((e) => e.status === "PENDING").length;
  const revisionEvents = myEvents.filter((e) => e.status === "REVISION_REQUESTED").length;

  const paidBookings = myBookings.filter((b) => b.paymentStatus === "PAID");
  const totalTicketsSold = paidBookings.reduce((sum, b) => sum + b.ticketCount, 0);
  const totalAttendees = paidBookings.length;
  const grossRevenue = paidBookings.reduce((sum, b) => sum + b.totalPrice, 0);
  const platformFeeAmount = paidBookings.reduce((sum, b) => sum + b.platformFeeAmount, 0);
  const organizerPayoutAmount = paidBookings.reduce((sum, b) => sum + b.organizerRevenueAmount, 0);

  const organizerName = myEvents[0]?.organizerName || "Komunitas Kreatif";

  return {
    summary: {
      organizerEmail: normalizedEmail,
      organizerName,
      totalEvents: myEvents.length,
      approvedEvents,
      pendingEvents,
      revisionEvents,
      totalAttendees,
      totalTicketsSold,
      grossRevenue,
      platformFeeAmount,
      organizerPayoutAmount,
    },
    events: myEvents,
    bookings: myBookings,
  };
}

/**
 * Secure check-in endpoint for event organizers.
 * Strictly verifies that the booking belongs to an event owned by the organizer.
 * Cross-community attendee manipulation is rejected.
 */
export async function organizerCheckInAttendee(
  organizerEmail: string,
  bookingId: string,
  checkInStatus: AttendeeCheckInStatus
): Promise<EventTicketOrder> {
  const normalizedEmail = (organizerEmail || "").trim().toLowerCase();
  const allBookings = loadBookingsFromDisk();
  const booking = allBookings.find((b) => b.id === bookingId);
  if (!booking) {
    throw new Error(`Pemesanan tiket dengan ID ${bookingId} tidak ditemukan.`);
  }

  const allEvents = loadEventsFromDisk();
  const event = allEvents.find((e) => e.id === booking.eventId);
  if (!event) {
    throw new Error(`Event terkait tidak ditemukan.`);
  }

  // Cross-community authorization barrier
  if ((event.organizerEmail || "").toLowerCase() !== normalizedEmail) {
    throw new Error("FORBIDDEN: Anda tidak memiliki izin untuk mengelola peserta event milik komunitas lain.");
  }

  return updateBookingCheckIn(bookingId, checkInStatus);
}

/**
 * Allows community organizer to edit and resubmit an event that was requested for revision.
 */
export async function organizerResubmitEvent(
  organizerEmail: string,
  eventId: string,
  updates: Partial<EventSubmissionPayload>
): Promise<CommunityEvent> {
  const normalizedEmail = (organizerEmail || "").trim().toLowerCase();
  const all = loadEventsFromDisk();
  const index = all.findIndex((e) => e.id === eventId);
  if (index === -1) {
    throw new Error(`Event dengan ID ${eventId} tidak ditemukan.`);
  }

  const existing = all[index];
  if ((existing.organizerEmail || "").toLowerCase() !== normalizedEmail) {
    throw new Error("FORBIDDEN: Anda tidak memiliki izin untuk mengubah event milik komunitas lain.");
  }

  const updated: CommunityEvent = {
    ...existing,
    title: updates.title ? sanitizeHtmlText(updates.title) : existing.title,
    category: updates.category || existing.category,
    description: updates.description ? sanitizeHtmlText(updates.description) : existing.description,
    startDate: updates.startDate ? new Date(updates.startDate).toISOString() : existing.startDate,
    endDate: updates.endDate ? new Date(updates.endDate).toISOString() : existing.endDate,
    location: updates.location ? sanitizeHtmlText(updates.location) : existing.location,
    maxCapacity: updates.maxCapacity && updates.maxCapacity > 0 ? Number(updates.maxCapacity) : existing.maxCapacity,
    isPaid: updates.isPaid !== undefined ? Boolean(updates.isPaid) : existing.isPaid,
    price: updates.price !== undefined ? Number(updates.price || 0) : existing.price,
    posterUrl: updates.posterUrl ? updates.posterUrl.trim() : existing.posterUrl,
    externalRegistrationUrl: updates.externalRegistrationUrl !== undefined ? updates.externalRegistrationUrl : existing.externalRegistrationUrl,
    guidelines: updates.guidelines ? parseGuidelinesInput(updates.guidelines) : existing.guidelines,
    status: "PENDING", // Back to review queue
    revisionNotes: null, // Cleared on resubmission
    updatedAt: new Date().toISOString(),
  };

  all[index] = updated;
  saveEventsToDisk(all);

  return updated;
}
