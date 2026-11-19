import { NextRequest, NextResponse } from "next/server";
import { getAdminEventById, createInvitationTicket } from "@/lib/events";
import { assertOrganizerAuth, assertEventAdmin } from "@/lib/server-auth";
import { CreateInvitationPayload } from "@/types/event";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const body = await req.json();

    const event = await getAdminEventById(id);
    if (!event) {
      return NextResponse.json(
        { success: false, error: "Event tidak ditemukan." },
        { status: 404 }
      );
    }

    const adminAuth = await assertEventAdmin(req);
    const organizerAuth = await assertOrganizerAuth(req, event.organizerEmail);

    if (!adminAuth.authorized && !organizerAuth.authorized) {
      return NextResponse.json(
        { success: false, error: "Hanya penyelenggara event atau admin yang dapat menerbitkan tiket undangan." },
        { status: 403 }
      );
    }

    const payload: CreateInvitationPayload = {
      eventId: id,
      guestName: body.guestName || body.attendeeName,
      guestEmail: body.guestEmail || body.attendeeEmail,
      guestPhone: body.guestPhone || body.attendeePhone,
      institution: body.institution,
      ticketTierId: body.ticketTierId,
      ticketCount: body.ticketCount ? Number(body.ticketCount) : 1,
      invitationNote: body.invitationNote || body.notes,
    };

    if (!payload.guestName || !payload.guestEmail) {
      return NextResponse.json(
        { success: false, error: "Nama dan email tamu undangan wajib diisi." },
        { status: 400 }
      );
    }

    const issuerEmail = adminAuth.authorized ? "admin" : (organizerAuth.email || event.organizerEmail);
    const booking = await createInvitationTicket(payload, issuerEmail);

    return NextResponse.json({
      success: true,
      message: "Tiket undangan berhasil diterbitkan.",
      booking,
    });
  } catch (error: any) {
    console.error("[api/events/invitations] Error issuing invitation ticket:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menerbitkan tiket undangan." },
      { status: 400 }
    );
  }
}
