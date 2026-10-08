import { NextRequest, NextResponse } from "next/server";

interface WhatsAppSendPayload {
  message: string;
  targetPhone?: string;
  url?: string;
  filename?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as WhatsAppSendPayload;
    const { message, targetPhone, url, filename } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { success: false, error: "Pesan WhatsApp wajib diisi (string)." },
        { status: 400 }
      );
    }

    const fonnteToken = process.env.FONNTE_API_TOKEN;
    const defaultTarget = process.env.FONNTE_TARGET_PHONE;
    let resolvedTarget = (targetPhone || defaultTarget || "").replace(/\D/g, "");

    if (resolvedTarget.startsWith("0")) {
      resolvedTarget = "62" + resolvedTarget.slice(1);
    }

    // Check if token is configured
    if (!fonnteToken || fonnteToken.trim() === "") {
      console.warn(
        "[WhatsApp Gateway - Fonnte] FONNTE_API_TOKEN belum dikonfigurasi di environment variable (.env)."
      );
      return NextResponse.json({
        success: false,
        configured: false,
        message:
          "FONNTE_API_TOKEN belum diset di server environment. Laporan closing tetap diproses di sistem.",
      });
    }

    if (!resolvedTarget) {
      return NextResponse.json(
        { success: false, error: "Nomor WhatsApp tujuan tidak valid atau kosong." },
        { status: 400 }
      );
    }

    // Server-side HTTP call to Fonnte API Gateway
    const isLocalUrl = url && (url.includes("localhost") || url.includes("127.0.0.1") || url.includes("0.0.0.0"));
    const fonntePayload: Record<string, any> = {
      target: resolvedTarget,
      message: message,
      countryCode: "62",
    };

    // Only attach URL if it is a public accessible URL (Fonnte server cannot download from local PC localhost)
    if (url && typeof url === "string" && !isLocalUrl) {
      fonntePayload.url = url;
      fonntePayload.filename = filename || "Laporan_Closing_Shift.pdf";
    }

    let fonnteResponse = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: fonnteToken.trim(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fonntePayload),
    });

    let result = await fonnteResponse.json().catch(() => null);

    // Fallback: If failed with url attachment, retry with pure text message
    if (!fonnteResponse.ok || result?.status === false) {
      if (fonntePayload.url) {
        console.warn("[WhatsApp Gateway] Retrying without URL attachment...");
        delete fonntePayload.url;
        delete fonntePayload.filename;
        fonnteResponse = await fetch("https://api.fonnte.com/send", {
          method: "POST",
          headers: {
            Authorization: fonnteToken.trim(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(fonntePayload),
        });
        result = await fonnteResponse.json().catch(() => null);
      }
    }

    if (!fonnteResponse.ok || result?.status === false) {
      console.error("[WhatsApp Gateway - Fonnte Error]", result);
      return NextResponse.json(
        {
          success: false,
          error: result?.reason || result?.message || "Gagal mengirim pesan via Fonnte Gateway.",
          details: result,
        },
        { status: fonnteResponse.status || 400 }
      );
    }

    return NextResponse.json({
      success: true,
      configured: true,
      message: "Laporan closing berhasil diteruskan ke WhatsApp via Fonnte Gateway.",
      data: result,
    });
  } catch (error: any) {
    console.error("[WhatsApp Gateway - Internal Error]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error pada WhatsApp Gateway." },
      { status: 500 }
    );
  }
}
