import { NextRequest, NextResponse } from "next/server";
import { proposeEventRevenueSplit, respondToEventRevenueSplit } from "@/lib/events";
import { assertOrganizerAuth, assertEventAdmin } from "@/lib/server-auth";
import { RevenueSplitParty } from "@/types/event";

export const dynamic = "force-dynamic";

/**
 * POST /api/events/[id]/revenue-share
 * Submit a revenue share proposal (from Organizer or Admin)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const {
      proposedBy,
      organizerPercent,
      platformPercent,
      reason,
      email,
    }: {
      proposedBy: RevenueSplitParty;
      organizerPercent: number;
      platformPercent: number;
      reason: string;
      email?: string;
    } = body;

    if (!proposedBy || organizerPercent === undefined || platformPercent === undefined) {
      return NextResponse.json(
        { success: false, error: "Data usulan bagi hasil tidak lengkap." },
        { status: 400 }
      );
    }

    let actorEmail = "";
    let isAdmin = false;

    if (proposedBy === "DAGO_ADMIN" || (proposedBy as string) === "ADMIN") {
      const adminAuth = await assertEventAdmin(req);
      if (!adminAuth.authorized) {
        return NextResponse.json(
          { success: false, error: adminAuth.error || "Akses Admin Dago ditolak." },
          { status: 403 }
        );
      }
      actorEmail = adminAuth.name || "Admin Dago";
      isAdmin = true;
    } else {
      const orgAuth = await assertOrganizerAuth(req, email);
      if (!orgAuth.authorized || !orgAuth.email) {
        return NextResponse.json(
          { success: false, error: orgAuth.error || "Akses Penyelenggara ditolak." },
          { status: 403 }
        );
      }
      actorEmail = orgAuth.email;
      isAdmin = orgAuth.isAdmin;
    }

    const updatedEvent = await proposeEventRevenueSplit(
      id,
      proposedBy,
      Number(organizerPercent),
      Number(platformPercent),
      reason,
      actorEmail,
      isAdmin
    );

    return NextResponse.json({
      success: true,
      message: "Usulan penyesuaian bagi hasil berhasil diajukan.",
      data: updatedEvent,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengajukan usulan bagi hasil." },
      { status: error.message?.includes("FORBIDDEN") ? 403 : 400 }
    );
  }
}

/**
 * PATCH /api/events/[id]/revenue-share
 * Accept, Reject, or Counter-Offer a revenue share proposal
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const {
      decision,
      respondingParty,
      counterOffer,
      email,
    }: {
      decision: "ACCEPT" | "REJECT" | "COUNTER";
      respondingParty: RevenueSplitParty;
      counterOffer?: { organizerPercent: number; platformPercent: number; reason: string };
      email?: string;
    } = body;

    if (!decision || !respondingParty) {
      return NextResponse.json(
        { success: false, error: "Parameter keputusan dan pihak perespons wajib disertakan." },
        { status: 400 }
      );
    }

    let actorName = "";
    let actorEmail = "";
    let isAdmin = false;

    if (respondingParty === "DAGO_ADMIN" || (respondingParty as string) === "ADMIN") {
      const adminAuth = await assertEventAdmin(req);
      if (!adminAuth.authorized) {
        return NextResponse.json(
          { success: false, error: adminAuth.error || "Akses Admin Dago ditolak." },
          { status: 403 }
        );
      }
      actorName = adminAuth.name || "Admin Dago";
      actorEmail = "admin@dagoeng.com";
      isAdmin = true;
    } else {
      const orgAuth = await assertOrganizerAuth(req, email);
      if (!orgAuth.authorized || !orgAuth.email) {
        return NextResponse.json(
          { success: false, error: orgAuth.error || "Akses Penyelenggara ditolak." },
          { status: 403 }
        );
      }
      actorName = orgAuth.name || orgAuth.email;
      actorEmail = orgAuth.email;
      isAdmin = orgAuth.isAdmin;
    }

    const updatedEvent = await respondToEventRevenueSplit(
      id,
      decision,
      respondingParty,
      actorName,
      counterOffer,
      actorEmail,
      isAdmin
    );

    const message =
      decision === "ACCEPT"
        ? "Kesepakatan bagi hasil berhasil disetujui dan diberlakukan."
        : decision === "REJECT"
        ? "Usulan bagi hasil ditolak. Kesepakatan aktif sebelumnya tetap berlaku."
        : "Penawaran tandingan bagi hasil berhasil dikirim.";

    return NextResponse.json({
      success: true,
      message,
      data: updatedEvent,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memproses respons bagi hasil." },
      { status: error.message?.includes("FORBIDDEN") ? 403 : 400 }
    );
  }
}
