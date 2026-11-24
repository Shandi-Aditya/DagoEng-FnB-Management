/**
 * WhatsApp Gateway Interface & Dispatcher for DagoEng Event Marketplace.
 * Connects to Fonnte API Gateway (https://api.fonnte.com/send).
 */

export interface WhatsAppDispatchResult {
  sent: boolean;
  configured: boolean;
  message: string;
  reason?: "GATEWAY_NOT_CONFIGURED" | "INVALID_TARGET" | "DISPATCH_ERROR";
  timestamp: string;
  data?: any;
}

/**
 * Checks whether the Fonnte WhatsApp API token is configured in environment variables.
 */
export function isWhatsAppServiceConfigured(): boolean {
  if (
    process.env.NODE_ENV !== "test" &&
    (process.env.ENABLE_WHATSAPP_CHATBOT === "false" ||
      process.env.DISABLE_WHATSAPP_CHATBOT === "true")
  ) {
    return false;
  }
  const token = process.env.FONNTE_API_TOKEN;
  return Boolean(token && token.trim().length > 0);
}

/**
 * Normalizes destination phone number to standard international format (628...).
 */
export function sanitizeTargetPhone(phone: string): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    digits = "62" + digits.slice(1);
  }
  return digits;
}

/**
 * Sends a WhatsApp message via Fonnte Gateway.
 * If the gateway token is not set, cleanly reports that the gateway is unconfigured
 * without fabricating a false delivery status.
 */
export async function sendWhatsAppMessage(
  targetPhone: string,
  message: string
): Promise<WhatsAppDispatchResult> {
  const timestamp = new Date().toISOString();

  if (!isWhatsAppServiceConfigured()) {
    const isExplicitlyDisabled =
      process.env.ENABLE_WHATSAPP_CHATBOT === "false" ||
      process.env.DISABLE_WHATSAPP_CHATBOT === "true";
    console.info(
      isExplicitlyDisabled
        ? `[WhatsApp Gateway] Layanan WhatsApp dinonaktifkan sementara (ENABLE_WHATSAPP_CHATBOT=false). Pengiriman dilewati untuk target: ${targetPhone}`
        : `[WhatsApp Gateway] FONNTE_API_TOKEN belum dikonfigurasi. Pengiriman WhatsApp otomatis dilewati untuk target: ${targetPhone}`
    );
    return {
      sent: false,
      configured: false,
      reason: "GATEWAY_NOT_CONFIGURED",
      message: isExplicitlyDisabled
        ? "Layanan pengiriman WhatsApp otomatis dinonaktifkan sementara hingga sistem siap rilis produksi."
        : "Layanan pengiriman WhatsApp otomatis belum dikonfigurasi pada server ini. Silakan hubungi admin acara melalui kontak Customer Service resmi.",
      timestamp,
    };
  }

  const resolvedTarget = sanitizeTargetPhone(targetPhone);
  if (!resolvedTarget || resolvedTarget.length < 9) {
    return {
      sent: false,
      configured: true,
      reason: "INVALID_TARGET",
      message: "Nomor WhatsApp tujuan tidak valid (minimal 9 digit).",
      timestamp,
    };
  }

  try {
    const fonnteToken = process.env.FONNTE_API_TOKEN!.trim();
    const response = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: fonnteToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target: resolvedTarget,
        message: message,
        countryCode: "62",
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || result?.status === false) {
      console.error("[WhatsApp Gateway Error]", result);
      return {
        sent: false,
        configured: true,
        reason: "DISPATCH_ERROR",
        message:
          result?.reason ||
          result?.message ||
          "Gagal mengirim pesan melalui gateway WhatsApp.",
        timestamp,
        data: result,
      };
    }

    return {
      sent: true,
      configured: true,
      message: `Pesan WhatsApp berhasil dikirim ke nomor ${resolvedTarget}.`,
      timestamp,
      data: result,
    };
  } catch (err: any) {
    console.error("[WhatsApp Gateway Exception]", err);
    return {
      sent: false,
      configured: true,
      reason: "DISPATCH_ERROR",
      message: err.message || "Terjadi kesalahan internal saat menghubungi gateway WhatsApp.",
      timestamp,
    };
  }
}
