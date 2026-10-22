import { NextRequest, NextResponse } from "next/server";
import { assertEventAdmin } from "@/lib/server-auth";
import {
  getAllOrganizers,
  createOrganizer,
  updateOrganizerStatus,
  updateOrganizerDetails,
} from "@/lib/organizers";
import { getOrganizerActivationStatus } from "@/lib/organizer-activation";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/admin/organizers
 * Returns all registered community organizers.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await assertEventAdmin(req);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 403 }
      );
    }

    const rawOrganizers = getAllOrganizers();
    const organizers = rawOrganizers.map((org) => ({
      ...org,
      activationStatus: getOrganizerActivationStatus(org.email),
    }));

    return NextResponse.json({
      success: true,
      count: organizers.length,
      data: organizers,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memuat daftar penyelenggara." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events/admin/organizers
 * Registers a new community organizer account.
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
    const newOrg = createOrganizer({
      name: body.name,
      category: body.category,
      contactPerson: body.contactPerson,
      phone: body.phone,
      email: body.email,
      notes: body.notes,
      initialStatus: body.initialStatus || "ACTIVE",
    });

    return NextResponse.json({
      success: true,
      message: `Penyelenggara [${newOrg.name}] berhasil didaftarkan ke platform DAGO.`,
      data: newOrg,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mendaftarkan penyelenggara." },
      { status: 400 }
    );
  }
}

/**
 * PATCH /api/events/admin/organizers
 * Updates organizer status or details.
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await assertEventAdmin(req);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, status, updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID penyelenggara wajib disertakan." },
        { status: 400 }
      );
    }

    if (status) {
      if (status !== "ACTIVE" && status !== "INACTIVE") {
        return NextResponse.json(
          { success: false, error: "Status harus berupa 'ACTIVE' atau 'INACTIVE'." },
          { status: 400 }
        );
      }
      const updated = updateOrganizerStatus(id, status);
      return NextResponse.json({
        success: true,
        message: `Status penyelenggara [${updated.name}] diubah menjadi ${status === "ACTIVE" ? "AKTIF" : "NONAKTIF"}.`,
        data: updated,
      });
    }

    if (updates) {
      const updated = updateOrganizerDetails(id, updates);
      return NextResponse.json({
        success: true,
        message: `Detail penyelenggara [${updated.name}] berhasil diperbarui.`,
        data: updated,
      });
    }

    return NextResponse.json(
      { success: false, error: "Tidak ada data perubahan yang diberikan." },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memperbarui penyelenggara." },
      { status: 400 }
    );
  }
}
