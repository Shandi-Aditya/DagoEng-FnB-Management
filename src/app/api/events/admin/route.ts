import { NextRequest, NextResponse } from "next/server";
import { getAdminEvents, getEventBookings } from "@/lib/events";
import { assertEventAdmin } from "@/lib/server-auth";
import { EventStatus } from "@/types/event";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await assertEventAdmin(req);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const rawStatus = searchParams.get("status")?.trim();
    const isAllOrSplit = !rawStatus || rawStatus === "ALL" || rawStatus === "REVENUE_SPLIT";

    const [baseEvents, allBookings] = await Promise.all([
      getAdminEvents(isAllOrSplit ? undefined : (rawStatus as EventStatus)),
      getEventBookings(),
    ]);

    const bookedByEvent = new Map<string, number>();
    for (const b of allBookings) {
      if (b.paymentStatus === "PAID") {
        bookedByEvent.set(b.eventId, (bookedByEvent.get(b.eventId) ?? 0) + (b.ticketCount || 1));
      }
    }

    const filteredEvents =
      rawStatus === "REVENUE_SPLIT"
        ? baseEvents.filter((e) =>
            Boolean(e.proposedRevenueSplit && e.proposedRevenueSplit.status === "PENDING")
          )
        : baseEvents;

    const events = filteredEvents.map((e) => ({
      ...e,
      bookedCount: bookedByEvent.get(e.id) ?? 0,
    }));

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
