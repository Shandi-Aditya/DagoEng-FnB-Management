import { NextRequest, NextResponse } from "next/server";
import { assertEventAdmin } from "@/lib/server-auth";
import { getAdminRefundBookings, adminProcessTicketRefund } from "@/lib/events";
import { ProcessRefundPayload, TicketRefundStatus } from "@/types/event";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/admin/refunds
 * Fetches ticket refund requests for admin moderation.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await assertEventAdmin(req);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || "FORBIDDEN: Akses admin ditolak." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId") || undefined;
    const status = (searchParams.get("status") as TicketRefundStatus) || undefined;

    const refunds = await getAdminRefundBookings({ eventId, status });

    return NextResponse.json({
      success: true,
      refunds,
    });
  } catch (error: any) {
    console.error("[api/events/admin/refunds] GET error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memuat daftar pengajuan refund." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events/admin/refunds
 * Moderates an attendee refund request (APPROVE or REJECT).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await assertEventAdmin(req);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || "FORBIDDEN: Akses admin ditolak." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { bookingId, decision, adminNotes, rejectionReason, forceApproveDeficit } = body;

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: "bookingId wajib disertakan." },
        { status: 400 }
      );
    }

    const payload: ProcessRefundPayload = {
      decision,
      adminNotes,
      rejectionReason,
      forceApproveDeficit: Boolean(forceApproveDeficit) && auth.role === "SUPER_ADMIN",
    };

    const adminEmail = auth.email || auth.name || "admin";
    const updated = await adminProcessTicketRefund(bookingId, payload, adminEmail);

    return NextResponse.json({
      success: true,
      message:
        decision === "APPROVE"
          ? "Pengajuan refund tiket berhasil disetujui. Status tiket telah diubah menjadi REFUNDED."
          : "Pengajuan refund tiket telah ditolak.",
      booking: updated,
    });
  } catch (error: any) {
    console.error("[api/events/admin/refunds] POST error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memproses pengajuan refund." },
      { status: 400 }
    );
  }
}
