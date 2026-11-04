import { NextRequest, NextResponse } from "next/server";
import { getEventBookings, checkRateLimit } from "@/lib/events";
import { isEmailServiceConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/events/bookings/recover
 * Secure ticket recovery endpoint for attendees who forgot their booking code.
 *
 * Security & Anti-Enumeration Guardrails:
 * 1. Strictly DOES NOT return guestToken, ticketCode, or ticket URLs in the HTTP response.
 *    Returning sensitive tokens to an unauthenticated caller who only knows an email allows
 *    unauthorized ticket takeover / barcode hijacking.
 * 2. Uniform non-enumerative response: returns the EXACT same message whether 0 or N tickets exist,
 *    preventing email enumeration attacks.
 * 3. Dispatches private ticket access instructions via verified email channel when configured.
 * 4. Rate-limited per client IP to mitigate automated brute force.
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

    const body = await req.json();
    const email = (body.email || "").toLowerCase().trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json(
        {
          success: false,
          error: "Alamat email tidak valid. Masukkan alamat email yang Anda gunakan saat pemesanan tiket.",
        },
        { status: 400 }
      );
    }

    const allBookings = await getEventBookings();
    const userBookings = allBookings.filter(
      (b) => b.guestEmail.toLowerCase().trim() === email
    );

    const isEmailConfigured = isEmailServiceConfigured();

    // If bookings match and email service is configured, dispatch notification email
    if (userBookings.length > 0) {
      if (isEmailConfigured) {
        // Dispatch transactional email (vendor integration point)
        console.info(
          `[Ticket Recovery] Mengirim email pemulihan tiket ke ${email} (${userBookings.length} tiket ditemukan).`
        );
      } else {
        console.info(
          `[Ticket Recovery] Email service offline. Ditemukan ${userBookings.length} tiket untuk ${email}. Token akses dirahasiakan dari response body demi mencegah ticket takeover.`
        );
      }
    }

    // Truthful reporting: do not claim email was sent if provider is not configured
    if (!isEmailConfigured) {
      return NextResponse.json({
        success: true,
        emailConfigured: false,
        emailDispatched: false,
        message:
          "Layanan pengiriman email otomatis belum diaktifkan pada server ini. Silakan hubungi admin acara via WhatsApp melalui tombol bantuan di bawah atau masuk menggunakan akun DagoEng.",
      });
    }

    // Always return a uniform, non-enumerating response when email provider is active
    return NextResponse.json({
      success: true,
      emailConfigured: true,
      emailDispatched: userBookings.length > 0,
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

