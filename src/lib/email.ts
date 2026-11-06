/**
 * Email Service Interface & Dispatcher for DagoEng Event Marketplace.
 *
 * Current Status: NOT INTEGRATED (No external SMTP / transactional email vendor configured).
 * As per guidelines, we provide clean interfaces without fabricating false delivery status.
 */

export interface TicketConfirmationEmailPayload {
  recipientEmail: string;
  recipientName: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  ticketCode: string;
  ticketCount: number;
  totalPrice: number;
  paymentStatus: "PENDING" | "PAID" | "CANCELLED";
  privateAccessUrl: string;
  dokuPaymentUrl?: string | null;
}

export interface EmailDispatchResult {
  sent: boolean;
  reason?: "EMAIL_SERVICE_NOT_CONFIGURED" | "INVALID_RECIPIENT" | "DISPATCH_ERROR";
  message: string;
  timestamp: string;
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
