/**
 * Email Service Interface & Dispatcher for DagoEng Event Marketplace (Task S-05, S-08).
 * Supports real transactional email dispatch via:
 * 1. SMTP (Nodemailer)
 * 2. Resend HTTP API
 * 3. SendGrid HTTP API
 */

import QRCode from "qrcode";
import { OFFICIAL_CS_DISPLAY_PHONE, buildOfficialCsWhatsAppUrl } from "@/lib/contact-config";

export interface PaidTicketItem {
  ticketCode: string;
  seatNumber: number;
  guestLabel: string;
  qrPayload: string;
  qrImageUrl: string;
  qrBuffer?: Buffer;
  cid?: string;
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

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  cid?: string;
  contentType?: string;
}

export interface TransactionalEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  attachments?: EmailAttachment[];
}

/**
 * Escapes unsafe HTML characters to prevent XSS in email clients.
 */
export function escapeHtml(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Builds individual e-ticket sub-ticket items and QR code buffers per participant.
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
    const cid = `qr-seat-${seat}@dagoeng.com`;
    const qrImageUrl = `cid:${cid}`;

    items.push({
      ticketCode: subCode,
      seatNumber: seat,
      guestLabel,
      qrPayload,
      qrImageUrl,
      cid,
    });
  }

  return items;
}

/**
 * Generates responsive transactional HTML email containing event details and visual QR per seat.
 */
export function generatePaidTicketEmailHtml(payload: TicketConfirmationEmailPayload): string {
  const safeEventTitle = escapeHtml(payload.eventTitle);
  const safeRecipientName = escapeHtml(payload.recipientName);
  const safeEventDate = escapeHtml(payload.eventDate || "-");
  const safeEventLocation = escapeHtml(payload.eventLocation || "Dago Creative Hub Singaraja");
  const safeTicketCode = escapeHtml(payload.ticketCode);
  const safePrivateAccessUrl = escapeHtml(payload.privateAccessUrl);

  const ticketsHtml = (payload.tickets || [])
    .map((t) => {
      const safeGuestLabel = escapeHtml(t.guestLabel);
      const safeSubCode = escapeHtml(t.ticketCode);
      const imgSrc = t.cid ? `cid:${t.cid}` : (t.qrImageUrl || `cid:qr-seat-${t.seatNumber}@dagoeng.com`);
      return `
    <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 16px; background-color: #f8fafc; text-align: center;">
      <div style="font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 4px;">${safeGuestLabel}</div>
      <div style="font-size: 13px; font-family: monospace; color: #0284c7; font-weight: 700; margin-bottom: 12px;">${safeSubCode}</div>
      <div style="margin: 0 auto 12px; display: inline-block; padding: 8px; background: #ffffff; border-radius: 8px; border: 1px solid #cbd5e1;">
        <img src="${imgSrc}" alt="QR ${safeSubCode}" width="180" height="180" style="display: block; max-width: 100%; height: auto;" />
      </div>
      <div style="font-size: 11px; color: #64748b;">Tunjukkan QR Code ini di meja check-in lapangan pada hari acara.</div>
    </div>
  `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>E-Tiket: ${safeEventTitle}</title>
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
        <h2 style="margin: 12px 0 6px; font-size: 22px; color: #0f172a;">${safeEventTitle}</h2>
        <p style="margin: 0; font-size: 14px; color: #64748b;">Halo <strong>${safeRecipientName}</strong>, pembayaran/konfirmasi tiket Anda telah berhasil diverifikasi.</p>
      </div>

      <div style="background-color: #f8fafc; border-radius: 8px; padding: 14px; margin-bottom: 24px; font-size: 13px; border-left: 4px solid #0284c7;">
        <div style="margin-bottom: 4px;"><strong>Waktu Acara:</strong> ${safeEventDate}</div>
        <div style="margin-bottom: 4px;"><strong>Lokasi:</strong> ${safeEventLocation}</div>
        <div style="margin-bottom: 4px;"><strong>Kode Booking:</strong> <span style="font-family: monospace; font-weight: 600;">${safeTicketCode}</span></div>
        <div><strong>Jumlah Peserta:</strong> ${payload.ticketCount} Tiket</div>
      </div>

      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 16px; margin: 0 0 12px; color: #0f172a;">E-Tiket & QR Code Peserta</h3>
        ${ticketsHtml}
      </div>

      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${safePrivateAccessUrl}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; font-size: 14px; font-weight: 600; border-radius: 8px;">
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
 * Generates responsive HTML email for ticket recovery.
 */
export function generateRecoveryEmailHtml(payload: TicketRecoveryEmailPayload): string {
  const safeRecipientName = escapeHtml(payload.recipientName || "Pelanggan Setia");

  const bookingsHtml = payload.bookings
    .map(
      (b) => `
    <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 16px; background-color: #f8fafc;">
      <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">${escapeHtml(b.eventTitle)}</div>
      <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">
        ${escapeHtml(b.eventDate || "-")} &bull; ${escapeHtml(b.eventLocation || "Dago Creative Hub")}
      </div>
      <div style="font-size: 13px; margin-bottom: 12px;">
        <strong>Kode Booking:</strong> <span style="font-family: monospace; font-weight: 600; color: #0284c7;">${escapeHtml(b.ticketCode)}</span> (${b.ticketCount} tiket)
      </div>
      <div>
        <a href="${escapeHtml(b.privateAccessUrl)}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 8px 16px; font-size: 12px; font-weight: 600; border-radius: 6px;">
          Buka E-Tiket
        </a>
      </div>
    </div>
  `
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Pemulihan Akses E-Tiket - Dago Creative Hub</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 24px; color: #334155; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
    <div style="background-color: #0f172a; padding: 24px; text-align: center; color: #ffffff;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 700;">Dago Creative Hub</h1>
      <p style="margin: 6px 0 0; font-size: 13px; color: #94a3b8;">Pemulihan Tautan E-Tiket</p>
    </div>

    <div style="padding: 24px;">
      <div style="margin-bottom: 20px;">
        <h2 style="margin: 0 0 8px; font-size: 18px; color: #0f172a;">Halo ${safeRecipientName},</h2>
        <p style="margin: 0; font-size: 14px; color: #64748b;">Berikut adalah daftar tiket aktif yang terdaftar atas email Anda. Klik tombol pada masing-masing tiket untuk mengakses e-tiket:</p>
      </div>

      <div style="margin-bottom: 24px;">
        ${bookingsHtml}
      </div>

      <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #94a3b8; text-align: center;">
        <p style="margin: 0;">Jika Anda tidak merasa meminta email ini, abaikan pesan ini.</p>
        <p style="margin: 4px 0 0;">Butuh bantuan? Hubungi WhatsApp resmi CS Dago Creative Hub di <a href="${buildOfficialCsWhatsAppUrl()}" style="color: #0f172a; text-decoration: underline;">${OFFICIAL_CS_DISPLAY_PHONE}</a>.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Checks whether an external email transport service is configured via environment variables.
 * Supported integrations: SMTP (Nodemailer), Resend HTTP API, or SendGrid HTTP API.
 */
export function isEmailServiceConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY ||
    process.env.SENDGRID_API_KEY ||
    (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  );
}

/**
 * Shared transactional email dispatcher supporting SMTP (Nodemailer), Resend, and SendGrid.
 * Returns sent: true ONLY when transport genuinely accepts the dispatch.
 */
export async function dispatchTransactionalEmail(options: TransactionalEmailOptions): Promise<EmailDispatchResult> {
  const timestamp = new Date().toISOString();
  const from = options.from || process.env.SMTP_FROM || "Dago Creative Hub <tickets@dagoeng.com>";

  if (!isEmailServiceConfigured()) {
    return {
      sent: false,
      reason: "EMAIL_SERVICE_NOT_CONFIGURED",
      message: "Layanan email belum dikonfigurasi pada environment saat ini.",
      timestamp,
    };
  }

  // 1. SMTP Transport via nodemailer
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          cid: a.cid,
          contentType: a.contentType,
        })),
      });

      return {
        sent: true,
        message: `Email berhasil dikirim ke ${options.to} via SMTP.`,
        timestamp,
      };
    } catch (err: any) {
      console.error("[Email Dispatcher] SMTP error:", err);
      return {
        sent: false,
        reason: "DISPATCH_ERROR",
        message: err.message || "Gagal mengirim email via SMTP.",
        timestamp,
      };
    }
  }

  // 2. Resend HTTP API
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [options.to],
          subject: options.subject,
          html: options.html,
          attachments: options.attachments?.map((a) => ({
            filename: a.filename,
            content: Buffer.isBuffer(a.content) ? a.content.toString("base64") : a.content,
            cid: a.cid,
          })),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Resend API returned status ${res.status}`);
      }

      return {
        sent: true,
        message: `Email berhasil dikirim ke ${options.to} via Resend.`,
        timestamp,
      };
    } catch (err: any) {
      console.error("[Email Dispatcher] Resend API error:", err);
      return {
        sent: false,
        reason: "DISPATCH_ERROR",
        message: err.message || "Gagal mengirim email via Resend.",
        timestamp,
      };
    }
  }

  // 3. SendGrid HTTP API
  if (process.env.SENDGRID_API_KEY) {
    try {
      const fromEmail = from.includes("<") ? from.split("<")[1].replace(">", "").trim() : from;
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: options.to }] }],
          from: { email: fromEmail },
          subject: options.subject,
          content: [{ type: "text/html", value: options.html }],
          attachments: options.attachments?.map((a) => ({
            content: Buffer.isBuffer(a.content) ? a.content.toString("base64") : a.content,
            filename: a.filename,
            content_id: a.cid,
            disposition: a.cid ? "inline" : "attachment",
          })),
        }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        throw new Error(`SendGrid API returned status ${res.status}: ${errorText}`);
      }

      return {
        sent: true,
        message: `Email berhasil dikirim ke ${options.to} via SendGrid.`,
        timestamp,
      };
    } catch (err: any) {
      console.error("[Email Dispatcher] SendGrid API error:", err);
      return {
        sent: false,
        reason: "DISPATCH_ERROR",
        message: err.message || "Gagal mengirim email via SendGrid.",
        timestamp,
      };
    }
  }

  return {
    sent: false,
    reason: "EMAIL_SERVICE_NOT_CONFIGURED",
    message: "Layanan email belum dikonfigurasi.",
    timestamp,
  };
}

/**
 * Attempts to send an order confirmation & ticket access email.
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

  const html = payload.htmlContent || generatePaidTicketEmailHtml(payload);
  const attachments: { filename: string; content: Buffer; cid: string; contentType: string }[] = [];
  for (const t of payload.tickets || []) {
    let buf = t.qrBuffer;
    if (!buf || buf.length === 0) {
      try {
        buf = await QRCode.toBuffer(t.qrPayload, { width: 250, margin: 2 });
      } catch (err) {
        console.warn(`[Email Dispatcher] Failed to generate QR buffer for ${t.ticketCode}:`, err);
        buf = Buffer.from([]);
      }
    }
    const cid = t.cid || `qr-seat-${t.seatNumber}@dagoeng.com`;
    attachments.push({
      filename: `qr-${t.ticketCode}.png`,
      content: buf,
      cid,
      contentType: "image/png",
    });
  }

  return dispatchTransactionalEmail({
    to: payload.recipientEmail,
    subject: `E-Tiket & Bukti Registrasi: ${payload.eventTitle}`,
    html,
    attachments,
  });
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

/**
 * Attempts to send a ticket recovery access email with private links.
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

  const html = generateRecoveryEmailHtml(payload);

  return dispatchTransactionalEmail({
    to: payload.recipientEmail,
    subject: "Pemulihan Akses E-Tiket Dago Creative Hub",
    html,
  });
}
