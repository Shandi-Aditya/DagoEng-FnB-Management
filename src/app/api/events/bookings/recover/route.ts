import { NextRequest, NextResponse } from "next/server";
import { getEventBookings, checkRateLimit } from "@/lib/events";
import { isEmailServiceConfigured, sendTicketRecoveryEmail } from "@/lib/email";
import {
  formatTicketCodeInput,
  normalizePhoneNumber,
  isValidEmail,
  maskEmail,
} from "@/features/events-tickets-recovery/ticket-recovery-domain";

export const dynamic = "force-dynamic";

/**
 * POST /api/events/bookings/recover
 * Secure ticket recovery endpoint strictly dispatched via verified email (Task S-05).
 *
 * Security & Anti-Takeover Guardrails:
 * 1. Strictly DOES NOT return guestToken, ticketCode, or ticket URLs in the HTTP response.
 *    Returning sensitive tokens to an unauthenticated caller allows unauthorized ticket takeover.
 * 2. Uniform non-enumerative response for forgot_code queries: returns the exact same message
 *    and HTTP 200 status regardless of whether 0 or N tickets exist or if transport fails,
 *    preventing email/phone enumeration or status oracles.
 * 3. Enforces dual ownership validation: forgot_code mode strictly requires BOTH email AND phone.
 * 4. Automated recovery is delivered strictly via email. WhatsApp automated delivery is rejected/disabled.
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

    // S-05 requirement: automated dispatch is strictly email-only. Reject WhatsApp channel requests.
    if (body.channel === "whatsapp") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Pemulihan tiket otomatis hanya tersedia melalui email resmi. Untuk bantuan via WhatsApp, silakan hubungi Customer Service kami.",
        },
        { status: 400 }
      );
    }

    if (body.channel && body.channel !== "email") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Kanal pemulihan tiket tidak didukung. Pemulihan tiket otomatis hanya tersedia melalui email resmi.",
        },
        { status: 400 }
      );
    }

    const mode: "code" | "forgot_code" =
      body.mode === "code" || Boolean(body.ticketCode) ? "code" : "forgot_code";

    // Resolve base origin for generating private ticket access links
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      "https://dagoeng.com";

    const allBookings = await getEventBookings();

    // =========================================================================
    // MODE A: Cari dengan Kode Booking + Email (Tab 1)
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

      if (!isEmailConfigured) {
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

      const emailRes = await sendTicketRecoveryEmail({
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

      if (!emailRes.sent) {
        return NextResponse.json(
          {
            success: false,
            configured: false,
            dispatched: false,
            emailConfigured: false,
            emailDispatched: false,
            error:
              "Gagal mengirimkan email pemulihan tiket. Silakan coba beberapa saat lagi atau hubungi CS kami.",
          },
          { status: 503 }
        );
      }

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

    // =========================================================================
    // MODE B: Lupa Kode Booking (Tab 2) - Wajib Email + Nomor Telepon
    // =========================================================================
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
    if (!rawPhone || rawPhone.length < 9) {
      return NextResponse.json(
        {
          success: false,
          error: "Nomor WhatsApp/telepon tidak valid (minimal 9 digit angka).",
        },
        { status: 400 }
      );
    }

    // Strictly match BOTH email and phone number
    const userBookings = allBookings.filter((b) => {
      const emailMatches = b.guestEmail.toLowerCase().trim() === email;
      const phoneMatches = normalizePhoneNumber(b.guestPhone) === rawPhone;
      return emailMatches && phoneMatches;
    });

    const isEmailConfigured = isEmailServiceConfigured();
    const maskedEmail = maskEmail(email);

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

    if (userBookings.length > 0) {
      try {
        const emailRes = await sendTicketRecoveryEmail({
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

        if (!emailRes.sent) {
          console.warn("sendTicketRecoveryEmail failed in forgot_code mode:", emailRes.message);
        }
      } catch (sendErr) {
        console.error("sendTicketRecoveryEmail exception in forgot_code mode:", sendErr);
      }
    }

    // Uniform non-enumerative response: returns identical message and status whether matching or not,
    // and whether transport succeeded or failed, preventing email/phone existence oracles.
    return NextResponse.json({
      success: true,
      channel: "email",
      emailConfigured: true,
      emailDispatched: true,
      configured: true,
      dispatched: true,
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
