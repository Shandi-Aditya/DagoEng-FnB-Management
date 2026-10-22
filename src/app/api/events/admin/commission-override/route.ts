import { NextRequest, NextResponse } from "next/server";
import { assertEventAdmin } from "@/lib/server-auth";
import { setEventCommissionOverride } from "@/lib/events";

export const dynamic = "force-dynamic";

/**
 * POST /api/events/admin/commission-override
 * Sets or resets custom platform fee percent for a specific event.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await assertEventAdmin(req);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { eventId, customPlatformFeePercent } = body;

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: "eventId wajib disertakan." },
        { status: 400 }
      );
    }

    const updated = await setEventCommissionOverride(eventId, customPlatformFeePercent ?? null);

    return NextResponse.json({
      success: true,
      message:
        customPlatformFeePercent !== null && customPlatformFeePercent !== undefined
          ? `Override komisi platform untuk event [${updated.title}] berhasil ditetapkan sebesar ${customPlatformFeePercent}%.`
          : `Override komisi event [${updated.title}] berhasil direset ke default platform.`,
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengatur override komisi event." },
      { status: 400 }
    );
  }
}
