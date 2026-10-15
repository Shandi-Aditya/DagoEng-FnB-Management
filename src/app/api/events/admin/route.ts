import { NextRequest, NextResponse } from "next/server";
import { getAdminEvents } from "@/lib/events";
import { assertEventAdmin } from "@/lib/server-auth";
import { EventStatus } from "@/types/event";
export const dynamic = "force-dynamic";

/**
 * GET /api/events/admin
 * Admin-only endpoint to list all event submissions across all statuses.
 * Includes private organizer email, phone, and moderation audit notes.
 * Enforces role verification on server side.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = assertEventAdmin(req);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") as EventStatus | null;

    const events = await getAdminEvents(statusParam || undefined);

    return NextResponse.json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error: any) {
    console.error("GET /api/events/admin error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memuat daftar moderasi event." },
      { status: 500 }
    );
  }
}
