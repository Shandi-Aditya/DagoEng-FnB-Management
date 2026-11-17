import { NextRequest, NextResponse } from "next/server";
import {
  dispatchShiftClosingChatbot,
  getClosingChatbotDispatches,
  isTelegramServiceConfigured,
} from "@/lib/closing-chatbot";
import { getPersistentShifts } from "@/lib/persistent-storage";
import { getRequestAuthUser } from "@/lib/server-auth";
import { isWhatsAppServiceConfigured } from "@/lib/whatsapp";
import type { RoleSlug } from "@/types/auth";

export const dynamic = "force-dynamic";

const AUTHORIZED_ROLES: readonly RoleSlug[] = [
  "SUPER_ADMIN",
  "OWNER",
  "MANAGER",
  "CASHIER",
];

export async function GET(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role) {
      return NextResponse.json(
        { error: auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan." },
        { status: 401 }
      );
    }

    if (!AUTHORIZED_ROLES.includes(auth.role)) {
      return NextResponse.json(
        { error: `FORBIDDEN: Role [${auth.role}] tidak memiliki akses laporan closing chatbot.` },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const shiftId = searchParams.get("shiftId")?.trim();

    const allDispatches = await getClosingChatbotDispatches();
    const dispatches = shiftId
      ? allDispatches.filter((d) => d.shiftId === shiftId)
      : allDispatches;

    return NextResponse.json({
      dispatches,
      whatsappConfigured: isWhatsAppServiceConfigured(),
      telegramConfigured: isTelegramServiceConfigured(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat riwayat notifikasi closing.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role || !auth.userId) {
      return NextResponse.json(
        { error: auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan." },
        { status: 401 }
      );
    }

    if (!AUTHORIZED_ROLES.includes(auth.role)) {
      return NextResponse.json(
        { error: `FORBIDDEN: Role [${auth.role}] tidak diizinkan mengirim laporan closing chatbot.` },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      shiftId?: unknown;
      forceResend?: unknown;
    };

    const shiftId = typeof body.shiftId === "string" ? body.shiftId.trim() : "";
    if (!shiftId) {
      return NextResponse.json(
        { error: "Parameter shiftId wajib diisi." },
        { status: 400 }
      );
    }

    const shifts = await getPersistentShifts();
    const targetShift = shifts.find((s) => s.id === shiftId);
    if (!targetShift) {
      return NextResponse.json(
        { error: `Shift dengan ID [${shiftId}] tidak ditemukan.` },
        { status: 404 }
      );
    }

    if (
      targetShift.status !== "CLOSED" &&
      targetShift.status !== "NEEDS_RECONCILIATION"
    ) {
      return NextResponse.json(
        {
          error: `Shift [${shiftId}] masih berstatus ${targetShift.status}. Tutup shift terlebih dahulu sebelum mengirim laporan closing.`,
        },
        { status: 400 }
      );
    }

    const dispatch = await dispatchShiftClosingChatbot({
      shift: targetShift,
      forceResend: Boolean(body.forceResend),
    });

    return NextResponse.json({
      success: true,
      dispatch,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mengirim ringkasan closing chatbot.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
