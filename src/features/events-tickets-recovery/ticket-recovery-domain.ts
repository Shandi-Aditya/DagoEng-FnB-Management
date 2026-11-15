/**
 * Pure domain logic for Ticket Recovery Portal.
 * Handles input normalization, validation, WhatsApp link generation, and status mapping.
 */

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
