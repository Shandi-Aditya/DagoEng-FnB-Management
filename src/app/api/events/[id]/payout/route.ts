import { NextRequest, NextResponse } from "next/server";
import { requestOrganizerPayout, processOrganizerPayout } from "@/lib/events";
import { assertOrganizerAuth, assertEventAdmin } from "@/lib/server-auth";
import { OrganizerPayoutStatus } from "@/types/event";

export const dynamic = "force-dynamic";

/**
 * POST /api/events/[id]/payout
 * Organizer requests payout of accumulated ticket revenue for an event.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const {
      amount,
      bankDetails,
      notes,
      email,
    }: {
      amount: number;
      bankDetails: { bankName: string; accountNumber: string; accountHolder: string };
      notes?: string;
      email?: string;
    } = body;

    const auth = await assertOrganizerAuth(req, email);
    if (!auth.authorized || !auth.email) {
      return NextResponse.json(
        { success: false, error: auth.error || "Akses penyelenggara ditolak." },
        { status: 403 }
      );
    }

    if (!amount || amount <= 0 || !bankDetails) {
      return NextResponse.json(
        { success: false, error: "Nominal pencairan dan informasi rekening bank wajib diisi." },
        { status: 400 }
      );
    }

    const result = await requestOrganizerPayout(
      auth.email,
      id,
      Number(amount),
      bankDetails,
      notes,
      auth.isAdmin
    );

    return NextResponse.json({
      success: true,
      message: "Permintaan pencairan dana berhasil diajukan dan sedang menunggu verifikasi DAGO Finance.",
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengajukan pencairan dana." },
      { status: error.message?.includes("FORBIDDEN") ? 403 : 400 }
    );
  }
}

/**
 * PATCH /api/events/[id]/payout
 * Admin verifies, processes, or rejects organizer payout request.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const auth = await assertEventAdmin(req);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || "Akses Admin Dago ditolak." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      payoutId,
      newStatus,
      referenceNo,
      rejectionReason,
    }: {
      payoutId: string;
      newStatus: OrganizerPayoutStatus;
      referenceNo?: string;
      rejectionReason?: string;
    } = body;

    if (!payoutId || !newStatus) {
      return NextResponse.json(
        { success: false, error: "ID pengajuan dan status baru wajib disertakan." },
        { status: 400 }
      );
    }

    const result = await processOrganizerPayout(
      id,
      payoutId,
      newStatus,
      referenceNo,
      rejectionReason,
      auth.name || "DAGO Finance Admin"
    );

    return NextResponse.json({
      success: true,
      message: `Status pencairan dana berhasil diperbarui menjadi ${newStatus}.`,
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memperbarui status pencairan dana." },
      { status: error.message?.includes("FORBIDDEN") ? 403 : 400 }
    );
  }
}
