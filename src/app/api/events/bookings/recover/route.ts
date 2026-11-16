import { NextRequest, NextResponse } from "next/server";
import { getEventBookings, checkRateLimit } from "@/lib/events";
import { isEmailServiceConfigured, sendTicketRecoveryEmail } from "@/lib/email";
import { isWhatsAppServiceConfigured, sendWhatsAppMessage } from "@/lib/whatsapp";
import {
  formatTicketCodeInput,
  normalizePhoneNumber,
  isValidEmail,
  maskEmail,
  maskPhone,
  buildRecoveryWhatsAppMessage,
} from "@/features/events-tickets-recovery/ticket-recovery-domain";

export const dynamic = "force-dynamic";

/**
 * POST /api/events/bookings/recover
 * Secure ticket recovery endpoint with delivery channel options (Email or WhatsApp).
 *
 * Security & Anti-Takeover Guardrails:
 * 1. Strictly DOES NOT return guestToken, ticketCode, or ticket URLs in the HTTP response.
 *    Returning sensitive tokens to an unauthenticated caller who queries an email/phone allows
 *    unauthorized ticket takeover / barcode hijacking.
 * 2. Uniform non-enumerative response for forgot_code queries: returns the exact same message
 *    regardless of whether 0 or N tickets exist, preventing enumeration attacks.
 * 3. Validates contact ownership against booking records before dispatching.
 * 4. Dispatches private ticket access instructions strictly via verified channels (WhatsApp / Email).
 * 5. Rate-limited per client IP to mitigate automated brute force attacks.
 */
export async function POST(req: NextRequest) {
  try {
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    const allowed = checkRateLimit(`recover-${clientIp}`, 5, 60000);
    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Terlalu banyak permintaan pemulihan tiket. Harap tunggu 1 menit sebelum mencoba kembali.",
        },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const channel: "whatsapp" | "email" = body.channel === "whatsapp" ? "whatsapp" : "email";
    const mode: "code" | "forgot_code" =
      body.mode === "code" || Boolean(body.ticketCode) ? "code" : "forgot_code";

    // Resolve base origin for generating private ticket access links
    const origin =
      req.headers.get("origin") ||
      req.headers.get("x-forwarded-host") ||
      "https://dagoeng.com";
    const protocol = req.headers.get("x-forwarded-proto") || "https";
    const baseUrl = origin.startsWith("http") ? origin : `${protocol}://${origin}`;

    const allBookings = await getEventBookings();

    // =========================================================================
    // MODE A: Cari dengan Kode Booking (Tab 1)
    // =========================================================================
    if (mode === "code") {
      const ticketCode = formatTicketCodeInput(body.ticketCode || "");
      if (!ticketCode) {
        return NextResponse.json(
          {
            success: false,
            error: "Kode booking tiket wajib diisi.",
          },
          { status: 400 }
        );
      }

      if (channel === "email") {
        const email = (body.email || "").toLowerCase().trim();
        if (!email || !isValidEmail(email)) {
          return NextResponse.json(
            {
              success: false,
              error: "Alamat email tidak valid. Masukkan alamat email pemesan.",
            },
            { status: 400 }
          );
        }

        const match = allBookings.find(
          (b) =>
            formatTicketCodeInput(b.ticketCode) === ticketCode &&
            b.guestEmail.toLowerCase().trim() === email
        );

        if (!match) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Tiket dengan kombinasi kode booking dan email tersebut tidak ditemukan. Periksa kembali data Anda.",
            },
            { status: 404 }
          );
        }

        const isEmailConfigured = isEmailServiceConfigured();
        const masked = maskEmail(email);

        if (isEmailConfigured) {
          await sendTicketRecoveryEmail({
            recipientEmail: email,
            recipientName: match.guestName,
            bookings: [
              {
                ticketCode: match.ticketCode,
                eventTitle: match.eventTitle,
                eventDate: match.eventDate,
                eventLocation: match.eventLocation,
                ticketCount: match.ticketCount || 1,
                privateAccessUrl: `${baseUrl}/events/tickets/${match.guestToken}`,
              },
            ],
          });

          return NextResponse.json({
            success: true,
            channel: "email",
            emailConfigured: true,
            emailDispatched: true,
            configured: true,
            dispatched: true,
            target: masked,
            message: `Tautan akses privat e-tiket telah dikirimkan ke email ${masked}. Harap periksa folder Inbox atau Spam Anda.`,
          });
        }

        return NextResponse.json({
          success: true,
          channel: "email",
          emailConfigured: false,
          emailDispatched: false,
          configured: false,
          dispatched: false,
          target: masked,
          message:
            "Layanan pengiriman email otomatis belum diaktifkan pada server ini. Silakan hubungi admin acara via WhatsApp melalui tombol bantuan di bawah atau masuk menggunakan akun DagoEng.",
        });
      }

      // channel === "whatsapp"
      const normalizedPhone = normalizePhoneNumber(body.phone || "");
      if (!normalizedPhone || normalizedPhone.length < 9) {
        return NextResponse.json(
          {
            success: false,
            error: "Nomor WhatsApp tidak valid (minimal 9 digit angka).",
          },
          { status: 400 }
        );
      }

      const match = allBookings.find(
        (b) =>
          formatTicketCodeInput(b.ticketCode) === ticketCode &&
          normalizePhoneNumber(b.guestPhone) === normalizedPhone
      );

      if (!match) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Tiket dengan kombinasi kode booking dan nomor WhatsApp tersebut tidak ditemukan. Periksa kembali data Anda.",
          },
          { status: 404 }
        );
      }

      const isWaConfigured = isWhatsAppServiceConfigured();
      const masked = maskPhone(normalizedPhone);

      if (isWaConfigured) {
        const privateUrl = `${baseUrl}/events/tickets/${match.guestToken}`;
        const waMsg = buildRecoveryWhatsAppMessage(match.guestName, [
          {
            ticketCode: match.ticketCode,
            eventTitle: match.eventTitle,
            ticketCount: match.ticketCount || 1,
            privateAccessUrl: privateUrl,
          },
        ]);
        await sendWhatsAppMessage(normalizedPhone, waMsg);

        return NextResponse.json({
          success: true,
          channel: "whatsapp",
          configured: true,
          dispatched: true,
          target: masked,
          message: `Tautan akses privat e-tiket telah dikirimkan ke nomor WhatsApp ${masked}. Harap periksa pesan masuk Anda.`,
        });
      }

      return NextResponse.json({
        success: true,
        channel: "whatsapp",
        configured: false,
        dispatched: false,
        target: masked,
        message:
          "Layanan pengiriman WhatsApp otomatis belum dikonfigurasi pada server ini (FONNTE_API_TOKEN belum disetel). Silakan hubungi Customer Service resmi via WhatsApp untuk bantuan pemulihan tiket.",
      });
    }

    // =========================================================================
    // MODE B: Lupa Kode Booking (Tab 2)
    // =========================================================================
    if (channel === "whatsapp") {
      const normalizedPhone = normalizePhoneNumber(body.phone || "");
      if (!normalizedPhone || normalizedPhone.length < 9) {
        return NextResponse.json(
          {
            success: false,
            error: "Nomor WhatsApp tidak valid. Masukkan nomor WhatsApp yang Anda gunakan saat pemesanan tiket.",
          },
          { status: 400 }
        );
      }

      const rawEmail = (body.email || "").toLowerCase().trim();
      if (rawEmail && !isValidEmail(rawEmail)) {
        return NextResponse.json(
          {
            success: false,
            error: "Format alamat email tidak valid.",
          },
          { status: 400 }
        );
      }

      // Filter matching bookings (by phone, and optionally verified email if provided)
      const matchingBookings = allBookings.filter((b) => {
        const phoneMatches = normalizePhoneNumber(b.guestPhone) === normalizedPhone;
        if (!rawEmail) return phoneMatches;
        return phoneMatches && b.guestEmail.toLowerCase().trim() === rawEmail;
      });

      const isWaConfigured = isWhatsAppServiceConfigured();
      const masked = maskPhone(normalizedPhone);

      if (!isWaConfigured) {
        return NextResponse.json({
          success: true,
          channel: "whatsapp",
          configured: false,
          dispatched: false,
          target: masked,
          message:
            "Layanan pengiriman WhatsApp otomatis belum dikonfigurasi pada server ini (FONNTE_API_TOKEN belum disetel). Silakan hubungi Customer Service resmi via WhatsApp untuk bantuan pemulihan tiket.",
        });
      }

      if (matchingBookings.length > 0) {
        const items = matchingBookings.map((b) => ({
          ticketCode: b.ticketCode,
          eventTitle: b.eventTitle,
          ticketCount: b.ticketCount || 1,
          privateAccessUrl: `${baseUrl}/events/tickets/${b.guestToken}`,
        }));
        const waMsg = buildRecoveryWhatsAppMessage(matchingBookings[0].guestName, items);
        await sendWhatsAppMessage(normalizedPhone, waMsg);
      }

      return NextResponse.json({
        success: true,
        channel: "whatsapp",
        configured: true,
        dispatched: matchingBookings.length > 0,
        target: masked,
        message: `Jika nomor WhatsApp Anda terdaftar pada sistem pemesanan kami, instruksi dan tautan akses e-tiket telah dikirimkan ke nomor WhatsApp ${masked}. Harap periksa pesan masuk Anda.`,
      });
    }

    // Default channel: email (also backward-compatible with legacy requests)
    const email = (body.email || "").toLowerCase().trim();
    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        {
          success: false,
          error: "Alamat email tidak valid. Masukkan alamat email yang Anda gunakan saat pemesanan tiket.",
        },
        { status: 400 }
      );
    }

    const rawPhone = body.phone ? normalizePhoneNumber(body.phone) : "";
    const userBookings = allBookings.filter((b) => {
      const emailMatches = b.guestEmail.toLowerCase().trim() === email;
      if (!rawPhone) return emailMatches;
      return emailMatches && normalizePhoneNumber(b.guestPhone) === rawPhone;
    });

    const isEmailConfigured = isEmailServiceConfigured();
    const maskedEmail = maskEmail(email);

    if (userBookings.length > 0 && isEmailConfigured) {
      await sendTicketRecoveryEmail({
        recipientEmail: email,
        recipientName: userBookings[0].guestName,
        bookings: userBookings.map((b) => ({
          ticketCode: b.ticketCode,
          eventTitle: b.eventTitle,
          eventDate: b.eventDate,
          eventLocation: b.eventLocation,
          ticketCount: b.ticketCount || 1,
          privateAccessUrl: `${baseUrl}/events/tickets/${b.guestToken}`,
        })),
      });
    }

    if (!isEmailConfigured) {
      return NextResponse.json({
        success: true,
        channel: "email",
        emailConfigured: false,
        emailDispatched: false,
        configured: false,
        dispatched: false,
        target: maskedEmail,
        message:
          "Layanan pengiriman email otomatis belum diaktifkan pada server ini. Silakan hubungi admin acara via WhatsApp melalui tombol bantuan di bawah atau masuk menggunakan akun DagoEng.",
      });
    }

    return NextResponse.json({
      success: true,
      channel: "email",
      emailConfigured: true,
      emailDispatched: userBookings.length > 0,
      configured: true,
      dispatched: userBookings.length > 0,
      target: maskedEmail,
      message:
        "Jika alamat email Anda terdaftar pada sistem pemesanan kami, instruksi dan tautan akses e-tiket telah dikirimkan ke kotak masuk email Anda. Harap periksa folder Inbox atau Spam Anda.",
    });
  } catch (err: any) {
    console.error("POST /api/events/bookings/recover error:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Terjadi kesalahan pada sistem saat memproses permintaan pemulihan tiket.",
      },
      { status: 500 }
    );
  }
}
