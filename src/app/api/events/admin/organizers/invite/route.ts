import { NextRequest, NextResponse } from "next/server";
import { assertEventAdmin } from "@/lib/server-auth";
import { generateActivationToken } from "@/lib/organizer-activation";

export const dynamic = "force-dynamic";

/**
 * POST /api/events/admin/organizers/invite
 * Admin endpoint to generate or reissue an activation link for a community organizer.
 * Restricted strictly to Super Admin, Owner, and Manager roles at Platform/Org scope.
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
    const { organizerId } = body;

    if (!organizerId || typeof organizerId !== "string") {
      return NextResponse.json(
        { success: false, error: "organizerId wajib disertakan." },
        { status: 400 }
      );
    }

    const result = await generateActivationToken(
      organizerId,
      auth.name || "Administrator Platform"
    );

    return NextResponse.json({
      success: true,
      message: `Tautan aktivasi untuk [${result.organizer.name}] berhasil diterbitkan. Tautan berlaku selama 48 jam.`,
      data: {
        organizerId: result.organizer.id,
        organizerName: result.organizer.name,
        email: result.organizer.email,
        activationUrl: result.activationUrl,
        expiresAt: result.record.expiresAt,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Gagal menerbitkan tautan aktivasi." },
      { status: 400 }
    );
  }
}
