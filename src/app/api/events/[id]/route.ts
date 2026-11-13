import { NextRequest, NextResponse } from "next/server";
import { getPublicEventById, updateEventDetails, getAdminEventById, deleteEvent } from "@/lib/events";
import { assertEventAdmin } from "@/lib/server-auth";
export const dynamic = "force-dynamic";

/**
 * GET /api/events/[id]
 * Public endpoint to view details of an APPROVED event.
 * Strips private organizer contacts. Returns 404 if event is not found or not approved.
 */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await assertEventAdmin(req);
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
      guidelines: body.guidelines,
      customPlatformFeePercent: body.customPlatformFeePercent,
    };

    const updated = await updateEventDetails(id, allowedUpdates);

    return NextResponse.json({
      success: true,
      message: "Detail event berhasil diperbarui.",
      data: updated,
    });
  } catch (error: any) {
    if (
      error?.code === "EVENT_REVENUE_SPLIT_LOCKED" ||
      error?.message?.includes("EVENT_REVENUE_SPLIT_LOCKED")
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "EVENT_REVENUE_SPLIT_LOCKED",
          error: error.message.replace(/^EVENT_REVENUE_SPLIT_LOCKED:\s*/, ""),
        },
        { status: 400 }
      );
    }
    console.error(`PUT /api/events/${params.id} error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memperbarui detail event." },
      { status: error?.message?.includes("tidak valid") ? 400 : 500 }
    );
  }
}

/**
 * DELETE /api/events/[id]
 * Admin endpoint to permanently delete an event with zero bookings/transactions.
 * Strictly restricted to SUPER_ADMIN, OWNER, and MANAGER.
 */
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await assertEventAdmin(req);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 403 }
      );
    }

    const { id } = params;
    const result = await deleteEvent(id, {
      actorName: auth.name || "Admin Dago",
      actorRole: auth.role || "SUPER_ADMIN",
    });

    return NextResponse.json({
      success: true,
      message: `Event '${result.event.title}' (${result.event.id}) berhasil dihapus secara permanen.`,
      data: result.event,
    });
  } catch (error: any) {
    console.error(`DELETE /api/events/${params.id} error:`, error);
    if (error?.name === "DatabasePersistenceError") {
      return NextResponse.json(
        {
          success: false,
          error: "Layanan database cloud sedang mengalami gangguan. Penghapusan event belum dapat dikonfirmasi demi menjaga konsistensi data. Silakan coba kembali.",
        },
        { status: 503 }
      );
    }
    const isForbidden = error?.message?.startsWith("FORBIDDEN_DELETE");
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menghapus event." },
      { status: isForbidden ? 409 : 400 }
    );
  }
}
