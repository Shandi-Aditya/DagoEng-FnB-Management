/**
 * Pure domain logic for Ticket Recovery Portal.
 * Handles input normalization, validation, WhatsApp link generation, and status mapping.
 */
import { CONTACT } from "@/features/landing/landing-content";

export interface TicketRecoveryCodeValidation {
  valid: boolean;
  ticketCode?: string;
  email?: string;
  error?: string;
}

export interface TicketRecoveryPhoneValidation {
  valid: boolean;
  phone?: string;
  email?: string;
  error?: string;
}

export type TicketStatusTone = "success" | "warning" | "destructive" | "info" | "neutral";

export interface TicketStatusMeta {
  label: string;
  tone: TicketStatusTone;
}

/**
 * Trims whitespace and normalizes ticket code to capital letters.
 */
export function formatTicketCodeInput(input: string): string {
  if (!input) return "";
  return input.trim().toUpperCase();
}

/**
 * Normalizes Indonesian phone / WhatsApp number into standard international format (e.g. 62812...).
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return "";
  // Strip non-digits except initial + if present
  let cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.startsWith("08")) {
    cleaned = "62" + cleaned.slice(1);
  }
  return cleaned;
}

/**
 * Default Customer Service WhatsApp number derived from central contact configuration.
 */
export const DEFAULT_CS_WHATSAPP_NUMBER = normalizePhoneNumber(CONTACT.phone);

/**
 * Validates email format.
 */
export function isValidEmail(email: string): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Validates ticket code + email input pair.
 */
export function validateRecoveryCodeInput(
  ticketCode: string,
  email: string
): TicketRecoveryCodeValidation {
  const trimmedCode = formatTicketCodeInput(ticketCode);
  const trimmedEmail = email ? email.trim().toLowerCase() : "";

  if (!trimmedCode || !trimmedEmail) {
    return {
      valid: false,
      error: "Kode booking tiket dan alamat email wajib diisi.",
    };
  }

  if (!isValidEmail(trimmedEmail)) {
    return {
      valid: false,
      error: "Format alamat email tidak valid.",
    };
  }

  return {
    valid: true,
    ticketCode: trimmedCode,
    email: trimmedEmail,
  };
}

/**
 * Validates WhatsApp number + email input pair.
 */
export function validateRecoveryPhoneInput(
  phone: string,
  email: string
): TicketRecoveryPhoneValidation {
  const normalizedPhone = normalizePhoneNumber(phone);
  const trimmedEmail = email ? email.trim().toLowerCase() : "";

  if (!phone.trim() || !trimmedEmail) {
    return {
      valid: false,
      error: "Alamat email dan nomor WhatsApp/HP wajib diisi.",
    };
  }

  if (!isValidEmail(trimmedEmail)) {
    return {
      valid: false,
      error: "Format alamat email tidak valid.",
    };
  }

  if (normalizedPhone.length < 9) {
    return {
      valid: false,
      error: "Nomor WhatsApp minimal 9 digit angka.",
    };
  }

  return {
    valid: true,
    phone: normalizedPhone,
    email: trimmedEmail,
  };
}

/**
 * Maps ticket payment/check-in status to user-friendly label and tone.
 */
export function getRecoveryStatusMeta(status: string): TicketStatusMeta {
  const normalized = (status || "").toUpperCase();

  switch (normalized) {
    case "PAID":
      return { label: "Lunas", tone: "success" };
    case "PENDING":
      return { label: "Menunggu Verifikasi", tone: "warning" };
    case "CANCELLED":
    case "EXPIRED":
      return { label: "Dibatalkan", tone: "destructive" };
    case "FREE":
      return { label: "Gratis", tone: "info" };
    default:
      return { label: status, tone: "neutral" };
  }
}

export type RecoveryChannel = "whatsapp" | "email";

export interface RecoveryBookingItem {
  ticketCode: string;
  eventTitle: string;
  ticketCount: number;
  privateAccessUrl: string;
}

/**
 * Builds customer support WhatsApp escalation link.
 */
export function buildSupportWhatsAppUrl(csNumber: string, email?: string): string {
  const em = (email || "").trim();
  const msg = em
    ? `Halo Admin Dago Hub, saya lupa kode booking tiket event saya untuk email (${em}). Mohon bantu verifikasi dan kirimkan e-tiket saya. Terima kasih!`
    : `Halo Admin Dago Hub, saya lupa kode booking tiket event saya di DagoEng. Mohon bantu verifikasi e-tiket saya. Terima kasih!`;
  return `https://wa.me/${csNumber}?text=${encodeURIComponent(msg)}`;
}

/**
 * Masks an email address for privacy (e.g. b***o@example.com).
 */
export function maskEmail(email: string): string {
  if (!email) return "";
  const parts = email.trim().split("@");
  if (parts.length !== 2) return email;
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Masks a phone number for privacy (e.g. 62812****7890 or 0812****7890).
 */
export function maskPhone(phone: string): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length < 8) return phone;
  const start = cleaned.slice(0, 4);
  const end = cleaned.slice(-4);
  return `${start}****${end}`;
}

/**
 * Formats transactional WhatsApp message containing private e-ticket access links.
 */
export function buildRecoveryWhatsAppMessage(
  guestName: string,
  bookings: RecoveryBookingItem[]
): string {
  const salutation = guestName?.trim() ? `Halo ${guestName.trim()},` : "Halo Kak,";
  if (bookings.length === 1) {
    const b = bookings[0];
    return (
      `${salutation}\n\n` +
      `Berikut tautan akses privat e-tiket DagoEng Anda:\n\n` +
      `• Acara: ${b.eventTitle}\n` +
      `• Kode Booking: ${b.ticketCode}\n` +
      `• Jumlah Tiket: ${b.ticketCount} tiket\n` +
      `• Tautan E-Tiket: ${b.privateAccessUrl}\n\n` +
      `Harap simpan tautan ini dengan baik dan tunjukkan barcode tiket saat kedatangan di lokasi acara. Terima kasih!`
    );
  }

  const list = bookings
    .map(
      (b, idx) =>
        `${idx + 1}. ${b.eventTitle}\n` +
        `   Kode: ${b.ticketCode} (${b.ticketCount} tiket)\n` +
        `   Tautan: ${b.privateAccessUrl}`
    )
    .join("\n\n");

  return (
    `${salutation}\n\n` +
    `Berikut adalah daftar tautan akses privat e-tiket DagoEng Anda:\n\n` +
    `${list}\n\n` +
    `Harap simpan tautan ini dan jangan bagikan ke pihak lain demi mencegah penyalahgunaan tiket. Terima kasih!`
  );
}

