import { formatCurrencyIDR } from "@/lib/utils";

export interface BookingValidationInput {
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  ticketCount: number;
  maxTickets: number;
  ticketTierId?: string;
  hasTiers?: boolean;
}

export interface BookingValidationResult {
  isValid: boolean;
  error: string | null;
}

export interface QuotaBadgeResult {
  label: string;
  tone: "success" | "warning" | "destructive";
}

export interface ShareData {
  text: string;
  whatsAppUrl: string;
  twitterUrl: string;
}

/**
 * Validasi form pendaftaran tiket secara murni.
 */
export function validateBookingInput(input: BookingValidationInput): BookingValidationResult {
  const name = input.guestName.trim();
  if (!name) {
    return { isValid: false, error: "Nama lengkap pemesan wajib diisi." };
  }

  const email = input.guestEmail.trim();
  if (!email) {
    return { isValid: false, error: "Alamat email wajib diisi." };
  }
  // Simple RFC-compliant email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: "Format alamat email tidak valid." };
  }

  const phone = input.guestPhone.trim();
  if (!phone) {
    return { isValid: false, error: "Nomor WhatsApp wajib diisi." };
  }

  if (input.hasTiers && !input.ticketTierId) {
    return { isValid: false, error: "Silakan pilih jenis tiket yang diinginkan." };
  }

  if (input.ticketCount < 1) {
    return { isValid: false, error: "Jumlah tiket minimal 1." };
  }

  if (input.ticketCount > input.maxTickets) {
    return {
      isValid: false,
      error: `Jumlah tiket maksimal ${input.maxTickets} tiket untuk pemesanan ini.`,
    };
  }

  return { isValid: true, error: null };
}

/**
 * Hitung total biaya pemesanan tiket.
 */
export function calculateBookingTotal(
  price: number = 0,
  isPaid: boolean = false,
  ticketCount: number = 1
): number {
  if (!isPaid || price <= 0) return 0;
  return price * Math.max(1, ticketCount);
}

/**
 * Tentukan status dan tone kuota tiket acara.
 */
export function getQuotaBadgeTone(
  occupancyRate: number = 0,
  isSoldOut: boolean = false
): QuotaBadgeResult {
  if (isSoldOut || occupancyRate >= 100) {
    return { label: "Tiket habis", tone: "destructive" };
  }
  if (occupancyRate >= 80) {
    return { label: "Sisa sedikit", tone: "warning" };
  }
  return { label: "Tersedia", tone: "success" };
}

/**
 * Format jadwal event lengkap dengan hari, tanggal, dan rentang jam WITA.
 */
export function formatDetailSchedule(startIso: string, endIso?: string | null): string {
  try {
    const s = new Date(startIso);
    const dateFormatted = s.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Makassar",
    });
    const startTimeStr = s.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Makassar",
    });

    if (endIso) {
      const e = new Date(endIso);
      const endTimeStr = e.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Makassar",
      });
      return `${dateFormatted} • ${startTimeStr} – ${endTimeStr} WITA`;
    }

    return `${dateFormatted} • ${startTimeStr} WITA`;
  } catch {
    return startIso;
  }
}

/**
 * Bangun teks dan URL berbagi media sosial.
 */
export function buildShareText(eventTitle: string, eventUrl: string): ShareData {
  const text = `Ikuti event "${eventTitle}" di Dago Creative Hub:\n${eventUrl}`;
  const encodedText = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(eventUrl);

  return {
    text,
    whatsAppUrl: `https://api.whatsapp.com/send?text=${encodedText}`,
    twitterUrl: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodeURIComponent(`Ikuti event "${eventTitle}" di Dago Creative Hub!`)}`,
  };
}
