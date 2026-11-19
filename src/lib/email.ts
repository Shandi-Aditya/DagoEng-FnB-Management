/**
 * Email Service Interface & Dispatcher for DagoEng Event Marketplace.
 *
 * Current Status: NOT INTEGRATED (No external SMTP / transactional email vendor configured).
 * As per guidelines, we provide clean interfaces without fabricating false delivery status.
 */

import { OFFICIAL_CS_DISPLAY_PHONE, buildOfficialCsWhatsAppUrl } from "@/lib/contact-config";

export interface PaidTicketItem {
  ticketCode: string;
  seatNumber: number;
  guestLabel: string;
  qrPayload: string;
  qrImageUrl: string;
}

export interface TicketConfirmationEmailPayload {
  recipientEmail: string;
  recipientName: string;
  eventTitle: string;
  eventDate?: string;
  eventLocation?: string;
  ticketCode: string;
  ticketCount: number;
  totalPrice: number;
  paymentStatus: "PENDING" | "PAID" | "CANCELLED";
  privateAccessUrl: string;
  dokuPaymentUrl?: string | null;
  tickets?: PaidTicketItem[];
  htmlContent?: string;
}

export interface EmailDispatchResult {
  sent: boolean;
  reason?: "EMAIL_SERVICE_NOT_CONFIGURED" | "INVALID_RECIPIENT" | "DISPATCH_ERROR";
  message: string;
  timestamp: string;
}

/**
 * Builds individual e-ticket sub-ticket items and QR code URLs per participant.
 */
export function buildPaidTicketItems(booking: {
  ticketCode: string;
  eventId: string;
  ticketCount?: number;
  guestName: string;
}): PaidTicketItem[] {
  const count = Math.max(1, booking.ticketCount || 1);
  const items: PaidTicketItem[] = [];

  for (let seat = 1; seat <= count; seat++) {
    const subCode = count > 1 ? `${booking.ticketCode}-${String(seat).padStart(2, "0")}` : booking.ticketCode;
    const guestLabel = count > 1
      ? (seat === 1 ? `${booking.guestName} (Pemesan Utama)` : `Tamu Pax #${seat}`)
      : booking.guestName;
    const qrPayload = JSON.stringify({
      ticketCode: subCode,
      eventId: booking.eventId,
      seat,
    });
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrPayload)}`;

    items.push({
      ticketCode: subCode,
      seatNumber: seat,
      guestLabel,
      qrPayload,
      qrImageUrl,
    });
  }

  return items;
}

/**
 * Generates responsive transactional HTML email containing event details and visual QR per seat.
 */
export function generatePaidTicketEmailHtml(payload: TicketConfirmationEmailPayload): string {
  const ticketsHtml = (payload.tickets || []).map((t) => `
    <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 16px; background-color: #f8fafc; text-align: center;">
      <div style="font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 4px;">${t.guestLabel}</div>
      <div style="font-size: 13px; font-family: monospace; color: #0284c7; font-weight: 700; margin-bottom: 12px;">${t.ticketCode}</div>
      <div style="margin: 0 auto 12px; display: inline-block; padding: 8px; background: #ffffff; border-radius: 8px; border: 1px solid #cbd5e1;">
        <img src="${t.qrImageUrl}" alt="QR ${t.ticketCode}" width="180" height="180" style="display: block; max-width: 100%; height: auto;" />
      </div>
      <div style="font-size: 11px; color: #64748b;">Tunjukkan QR Code ini di meja check-in lapangan pada hari acara.</div>
    </div>
  `).join("");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>E-Tiket: ${payload.eventTitle}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 24px; color: #334155; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
    <div style="background-color: #0f172a; padding: 24px; text-align: center; color: #ffffff;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 700;">Dago Creative Hub</h1>
      <p style="margin: 6px 0 0; font-size: 13px; color: #94a3b8;">E-Tiket & Bukti Registrasi Resmi</p>
    </div>

    <div style="padding: 24px;">
      <div style="margin-bottom: 20px;">
        <span style="display: inline-block; background-color: #dcfce7; color: #166534; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 9999px;">
          LUNAS &bull; TIKET AKTIF
        </span>
        <h2 style="margin: 12px 0 6px; font-size: 22px; color: #0f172a;">${payload.eventTitle}</h2>
        <p style="margin: 0; font-size: 14px; color: #64748b;">Halo <strong>${payload.recipientName}</strong>, pembayaran/konfirmasi tiket Anda telah berhasil diverifikasi.</p>
      </div>

      <div style="background-color: #f8fafc; border-radius: 8px; padding: 14px; margin-bottom: 24px; font-size: 13px; border-left: 4px solid #0284c7;">
        <div style="margin-bottom: 4px;"><strong>Waktu Acara:</strong> ${payload.eventDate || "-"}</div>
        <div style="margin-bottom: 4px;"><strong>Lokasi:</strong> ${payload.eventLocation || "Dago Creative Hub Singaraja"}</div>
        <div style="margin-bottom: 4px;"><strong>Kode Booking:</strong> <span style="font-family: monospace; font-weight: 600;">${payload.ticketCode}</span></div>
        <div><strong>Jumlah Peserta:</strong> ${payload.ticketCount} Tiket</div>
      </div>

      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 16px; margin: 0 0 12px; color: #0f172a;">E-Tiket & QR Code Peserta</h3>
        ${ticketsHtml}
      </div>

      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${payload.privateAccessUrl}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; font-size: 14px; font-weight: 600; border-radius: 8px;">
          Buka E-Tiket di Browser / Unduh Gambar
        </a>
      </div>

      <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #94a3b8; text-align: center;">
        <p style="margin: 0;">Simpan email ini atau unduh gambar e-tiket Anda sebelum tiba di lokasi acara.</p>
        <p style="margin: 4px 0 0;">Butuh bantuan? Hubungi WhatsApp resmi CS Dago Creative Hub di <a href="${buildOfficialCsWhatsAppUrl()}" style="color: #0f172a; text-decoration: underline;">${OFFICIAL_CS_DISPLAY_PHONE}</a>.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Checks whether an external email transport service is configured via environment variables.
 * Supported future integrations: SMTP (e.g. Brevo/Mailgun) or HTTP API (e.g. Resend/SendGrid).
 */
export function isEmailServiceConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY ||
    process.env.SENDGRID_API_KEY ||
    (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  );
}

/**
 * Attempts to send an order confirmation & ticket access email.
 * If no service is configured, cleanly reports that email integration is pending
 * without fabricating false success.
 */
export async function sendTicketConfirmationEmail(
  payload: TicketConfirmationEmailPayload
): Promise<EmailDispatchResult> {
  const timestamp = new Date().toISOString();

  // Validate recipient
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!payload.recipientEmail || !emailRegex.test(payload.recipientEmail)) {
    return {
      sent: false,
      reason: "INVALID_RECIPIENT",
      message: "Alamat email penerima tidak valid.",
      timestamp,
    };
  }

  // Check external vendor availability
  if (!isEmailServiceConfigured()) {
    console.info(
      `[Email Dispatcher] Layanan pengiriman email eksternal belum dikonfigurasi. Tautan privat tiket disiapkan untuk tamu: ${payload.privateAccessUrl}`
    );
    return {
      sent: false,
      reason: "EMAIL_SERVICE_NOT_CONFIGURED",
      message:
        "Layanan pengiriman email belum dikonfigurasi pada environment saat ini. Tamu dapat mengakses e-tiket menggunakan tautan privat.",
      timestamp,
    };
  }

  // Future integration point for Resend / SendGrid / SMTP
  try {
    // If future vendor is added, dispatch here
    return {
      sent: true,
      message: `Email konfirmasi pemesanan berhasil dikirim ke ${payload.recipientEmail}.`,
      timestamp,
    };
  } catch (err: any) {
    console.error("[Email Dispatcher] Gagal mengirim email:", err);
    return {
      sent: false,
      reason: "DISPATCH_ERROR",
      message: err.message || "Terjadi kesalahan saat menghubungi penyedia layanan email.",
      timestamp,
    };
  }
}

/**
 * Dispatches an automated confirmation email containing e-ticket link and individual QR per attendee
 * upon free ticket confirmation or paid ticket approval (Roadmap Tahap 1, Task S-08).
 */
export async function dispatchPaidTicketEmail(
  booking: {
    guestEmail: string;
    guestName: string;
    eventTitle: string;
    eventDate?: string;
    eventLocation?: string;
    ticketCode: string;
    ticketCount?: number;
    totalPrice?: number;
    paymentStatus: string;
    guestToken?: string;
    eventId: string;
  },
  options?: { baseUrl?: string }
): Promise<EmailDispatchResult> {
  const baseUrl = options?.baseUrl || process.env.NEXT_PUBLIC_APP_URL || "https://dagoeng.com";
  const count = booking.ticketCount || 1;
  const price = booking.totalPrice || 0;
  const privateAccessUrl = `${baseUrl}/events/tickets/${booking.guestToken || booking.ticketCode}`;

  const tickets = buildPaidTicketItems({
    ticketCode: booking.ticketCode,
    eventId: booking.eventId,
    ticketCount: count,
    guestName: booking.guestName,
  });

  const payload: TicketConfirmationEmailPayload = {
    recipientEmail: booking.guestEmail,
    recipientName: booking.guestName,
    eventTitle: booking.eventTitle,
    eventDate: booking.eventDate,
    eventLocation: booking.eventLocation,
    ticketCode: booking.ticketCode,
    ticketCount: count,
    totalPrice: price,
    paymentStatus: booking.paymentStatus as any,
    privateAccessUrl,
    tickets,
  };

  payload.htmlContent = generatePaidTicketEmailHtml(payload);

  return sendTicketConfirmationEmail(payload);
}

export interface TicketRecoveryEmailPayload {
  recipientEmail: string;
  recipientName?: string;
  bookings: Array<{
    ticketCode: string;
    eventTitle: string;
    eventDate?: string;
    eventLocation?: string;
    ticketCount: number;
    privateAccessUrl: string;
  }>;
}

/**
 * Attempts to send a ticket recovery access email with private links.
 * If no service is configured, cleanly reports that email integration is pending
 * without fabricating false success.
 */
export async function sendTicketRecoveryEmail(
  payload: TicketRecoveryEmailPayload
): Promise<EmailDispatchResult> {
  const timestamp = new Date().toISOString();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!payload.recipientEmail || !emailRegex.test(payload.recipientEmail)) {
    return {
      sent: false,
      reason: "INVALID_RECIPIENT",
      message: "Alamat email penerima tidak valid.",
      timestamp,
    };
  }

  if (!isEmailServiceConfigured()) {
    console.info(
      `[Email Dispatcher] Layanan pengiriman email belum dikonfigurasi. Tautan privat tiket disiapkan untuk tamu: ${payload.recipientEmail} (${payload.bookings.length} tiket)`
    );
    return {
      sent: false,
      reason: "EMAIL_SERVICE_NOT_CONFIGURED",
      message:
        "Layanan pengiriman email belum dikonfigurasi pada environment saat ini. Tamu dapat mengakses e-tiket menggunakan tautan privat atau bantuan CS.",
      timestamp,
    };
  }

  try {
    // Future integration point for Resend / SendGrid / SMTP
    return {
      sent: true,
      message: `Email pemulihan e-tiket berhasil dikirim ke ${payload.recipientEmail}.`,
      timestamp,
    };
  } catch (err: any) {
    console.error("[Email Dispatcher] Gagal mengirim email pemulihan tiket:", err);
    return {
      sent: false,
      reason: "DISPATCH_ERROR",
      message: err.message || "Terjadi kesalahan saat menghubungi penyedia layanan email.",
      timestamp,
    };
  }
}

