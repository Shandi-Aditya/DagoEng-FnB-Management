import { NextRequest, NextResponse } from "next/server";
import { updateEventStatus, getAdminEventById } from "@/lib/events";
import { assertEventAdmin } from "@/lib/server-auth";
import { EventStatus } from "@/types/event";
export const dynamic = "force-dynamic";

const VALID_STATUSES: EventStatus[] = [
  "PENDING",
  "APPROVED",
  "REVISION_REQUESTED",
  "REJECTED",
  "ARCHIVED",
];

/**
 * PATCH /api/events/[id]/status
 * Admin endpoint to update the moderation status of an event.
 * Validates role on server: only SUPER_ADMIN, OWNER, and MANAGER may moderate.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = assertEventAdmin(req);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 403 }
      );
    }

    const { id } = params;
    const existing = await getAdminEventById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: `Event dengan ID ${id} tidak ditemukan.` },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { status, adminNotes, rejectionReason, revisionNotes } = body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Status [${status}] tidak valid. Status yang diizinkan: ${VALID_STATUSES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const updated = await updateEventStatus(id, status, {
      adminNotes,
      rejectionReason,
      revisionNotes,
    });

    const actionLabels: Record<EventStatus, string> = {
      APPROVED: "disetujui dan dipublikasikan",
      REVISION_REQUESTED: "diminta revisi",
      REJECTED: "ditolak",
      ARCHIVED: "diarsipkan",
      PENDING: "dikembalikan ke status pending",
    };

    return NextResponse.json({
      success: true,
      message: `Event '${updated.title}' berhasil ${actionLabels[status as EventStatus] || "diperbarui"}.`,
      data: updated,
    });
  } catch (error: any) {
    console.error(`PATCH /api/events/${params.id}/status error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memperbarui status event." },
      { status: 500 }
    );
  }
}
