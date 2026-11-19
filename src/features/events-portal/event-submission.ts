import type { EventCategory, EventSubmissionPayload } from "@/types/event";
import { validateEventPrice, validateEventCapacity } from "@/lib/event-validation";

export const EVENT_CATEGORIES: readonly { value: EventCategory; label: string }[] = [
  { value: "WORKSHOP", label: "Workshop" },
  { value: "MEETUP", label: "Meetup komunitas" },
  { value: "CREATIVE", label: "Seni dan kreatif" },
  { value: "TECH", label: "Teknologi" },
  { value: "COMMUNITY", label: "Aksi sosial" },
  { value: "SEMINAR", label: "Seminar dan talkshow" },
  { value: "OTHER", label: "Lainnya" },
];

/** Rooms in the hub. Capacities for these live in `lib/event-capacity`. */
export const HUB_VENUES: readonly string[] = [
  "Amphitheater Dago Creative Hub",
  "Main Hall Dago Creative Hub",
  "Tech Lab Dago Hub",
  "Maker Space Dago Hub",
  "Boardroom Ubud (12 Pax)",
  "Meeting Room Seminyak (6 Pax)",
];

export const HUB_FACILITIES: readonly string[] = [
  "Sound system dan 2 mic nirkabel",
  "Proyektor dan layar 120 inci",
  "Wi-Fi khusus komunitas",
  "Kopi dan air mineral",
  "Meja dan kursi tambahan (hingga 50 orang)",
  "Panggung dan lampu",
];

export const HUB_PROMOTIONS: readonly string[] = [
  "Instagram @dagocreativehub",
  "Poster di lobi",
  "Grup WhatsApp komunitas Dago",
  "Banner di halaman event",
];

const VENUE_HINTS = ["dago", "amphitheater", "main hall", "tech lab", "maker space", "boardroom", "seminyak", "ubud"];
const OWN_UPLOAD_PREFIXES = ["/images/", "/uploads/", "/api/events/posters/", "data:image/"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^(\+62|62|0)[0-9\s-]{8,15}$/;
const DEFAULT_ORGANIZER_PERCENT = 80;
const DEFAULT_CAPACITY = 50;
const MIN_PASSWORD = 6;

export interface SubmissionForm {
  organizerName: string;
  organizerEmail: string;
  organizerPhone: string;
  password: string;
  title: string;
  category: EventCategory;
  description: string;
  posterUrl: string;
  startDate: string;
  endDate: string;
  location: string;
  maxCapacity: number;
  isPaid: boolean;
  price: number;
  proposedOrganizerPercent: number;
  revenueSplitReason: string;
  collaborationFacilities: string[];
  collaborationPromotion: string[];
  collaborationNotes: string;
  barterNote: string;
  guidelines: string;
  honeypot: string;
}

export type SubmissionField = keyof SubmissionForm;
export type SubmissionErrors = Partial<Record<SubmissionField, string>>;

export function emptySubmissionForm(organizer: { name?: string; email?: string; phone?: string } = {}): SubmissionForm {
  return {
    organizerName: organizer.name ?? "",
    organizerEmail: organizer.email ?? "",
    organizerPhone: organizer.phone ?? "",
    password: "",
    title: "",
    category: "COMMUNITY",
    description: "",
    posterUrl: "",
    startDate: "",
    endDate: "",
    location: HUB_VENUES[0],
    maxCapacity: DEFAULT_CAPACITY,
    isPaid: false,
    price: 0,
    proposedOrganizerPercent: DEFAULT_ORGANIZER_PERCENT,
    revenueSplitReason: "",
    collaborationFacilities: [],
    collaborationPromotion: [],
    collaborationNotes: "",
    barterNote: "",
    guidelines: "",
    honeypot: "",
  };
}

export function isHubVenue(location: string): boolean {
  const loc = location.trim().toLowerCase();
  return loc.length > 0 && VENUE_HINTS.some((hint) => loc.includes(hint));
}

/** A `datetime-local` value has no zone; the hub runs on WITA. */
export function toWitaIso(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  if (trimmed.includes("T")) return `${trimmed.length === 16 ? `${trimmed}:00` : trimmed}+08:00`;
  return `${trimmed}T00:00:00+08:00`;
}

function posterError(url: string): string | undefined {
  const poster = url.trim();
  if (!poster) return "Unggah poster event.";
  if (OWN_UPLOAD_PREFIXES.some((prefix) => poster.startsWith(prefix))) return undefined;
  try {
    const parsed = new URL(poster);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? undefined : "Tautan poster harus http atau https.";
  } catch {
    return "Tautan poster tidak valid.";
  }
}

/** Field-level problems, mirroring the server's rules so the organizer sees them before sending. */
export function validateSubmissionForm(form: SubmissionForm, options: { needsPassword: boolean }): SubmissionErrors {
  const errors: SubmissionErrors = {};
  if (form.organizerName.trim().length < 2) errors.organizerName = "Isi nama komunitas, minimal 2 karakter.";
  if (!EMAIL.test(form.organizerEmail.trim())) errors.organizerEmail = "Email tidak valid.";
  if (!PHONE.test(form.organizerPhone.trim())) errors.organizerPhone = "Nomor WhatsApp tidak valid, contoh 081234567890.";
  if (options.needsPassword && form.password.trim().length < MIN_PASSWORD) {
    errors.password = `Password minimal ${MIN_PASSWORD} karakter.`;
  }
  if (form.title.trim().length < 3) errors.title = "Judul minimal 3 karakter.";
  if (form.description.trim().length < 10) errors.description = "Deskripsi minimal 10 karakter.";
  const poster = posterError(form.posterUrl);
  if (poster) errors.posterUrl = poster;
  if (!form.startDate) errors.startDate = "Isi waktu mulai.";
  if (!form.endDate) errors.endDate = "Isi waktu selesai.";
  if (form.startDate && form.endDate && new Date(form.endDate).getTime() < new Date(form.startDate).getTime()) {
    errors.endDate = "Waktu selesai tidak boleh sebelum waktu mulai.";
  }
  if (form.location.trim().length < 3) errors.location = "Isi lokasi event.";
  const capVal = validateEventCapacity(form.maxCapacity, false);
  if (!capVal.valid) {
    errors.maxCapacity = capVal.error;
  }
  const priceVal = validateEventPrice(form.isPaid, form.price);
  if (!priceVal.valid) {
    errors.price = priceVal.error;
  }
  if (form.isPaid) {
    const orgShareNum = Number(form.proposedOrganizerPercent);
    if (!Number.isSafeInteger(orgShareNum) || orgShareNum < 50 || orgShareNum > 100) {
      errors.proposedOrganizerPercent = "Hak komunitas harus berupa bilangan bulat antara 50% dan 100% (komisi platform maksimal 50%).";
    }
  }
  return errors;
}

function notesWithBarter(form: SubmissionForm): string {
  const barter = form.barterNote.trim();
  if (!barter) return form.collaborationNotes;
  const extra = form.collaborationNotes.trim();
  return `[SKEMA BARTER KOMUNITAS]: ${barter}${extra ? `\n\nCatatan Tambahan: ${extra}` : ""}`;
}

/** The body `POST /api/events` expects. */
export function buildSubmissionPayload(form: SubmissionForm): EventSubmissionPayload {
  const { barterNote: _barterNote, password, ...rest } = form;
  const organizerPercent = form.isPaid ? form.proposedOrganizerPercent : DEFAULT_ORGANIZER_PERCENT;
  return {
    ...rest,
    startDate: toWitaIso(form.startDate),
    endDate: toWitaIso(form.endDate),
    price: form.isPaid ? Number(form.price) : 0,
    maxCapacity: Number(form.maxCapacity) || DEFAULT_CAPACITY,
    proposedOrganizerPercent: organizerPercent,
    proposedPlatformPercent: 100 - organizerPercent,
    collaborationFacilities: isHubVenue(form.location) ? form.collaborationFacilities : [],
    collaborationNotes: notesWithBarter(form),
    password: password.trim() || undefined,
  };
}
