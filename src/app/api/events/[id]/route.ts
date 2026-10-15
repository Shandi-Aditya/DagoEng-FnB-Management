import { NextRequest, NextResponse } from "next/server";
import { getPublicEventById, updateEventDetails, getAdminEventById } from "@/lib/events";
import { assertEventAdmin } from "@/lib/server-auth";

/**
 * GET /api/events/[id]
 * Public endpoint to view details of an APPROVED event.
 * Strips private organizer contacts. Returns 404 if event is not found or not approved.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const event = await getPublicEventById(id);

    if (!event) {
      return NextResponse.json(
        { success: false, error: "Event tidak ditemukan atau belum dipublikasikan." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: event,
    });
  } catch (error: any) {
    console.error(`GET /api/events/${params.id} error:`, error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil detail event." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/events/[id]
 * Admin endpoint to update event details.
 * Restricted to SUPER_ADMIN, OWNER, and MANAGER.
 */
export async function PUT(
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

    // Security Guard: Prevent status tampering or illegal publishing via PUT
    if (body.status !== undefined) {
      return NextResponse.json(
        {
          success: false,
          error:
            "FORBIDDEN_OPERATION: Perubahan status moderasi tidak diizinkan melalui endpoint PUT. Gunakan endpoint khusus PATCH /api/events/[id]/status.",
        },
        { status: 400 }
      );
    }

    // Whitelist only allowed editable event fields
    const allowedUpdates = {
      title: body.title,
      category: body.category,
      description: body.description,
      startDate: body.startDate,
      endDate: body.endDate,
      location: body.location,
      isPaid: body.isPaid,
      price: body.price,
      posterUrl: body.posterUrl,
      externalRegistrationUrl: body.externalRegistrationUrl,
      organizerName: body.organizerName,
    };

    const updated = await updateEventDetails(id, allowedUpdates);

    return NextResponse.json({
      success: true,
      message: "Detail event berhasil diperbarui.",
      data: updated,
    });
  } catch (error: any) {
    console.error(`PUT /api/events/${params.id} error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memperbarui detail event." },
      { status: 500 }
    );
  }
}
