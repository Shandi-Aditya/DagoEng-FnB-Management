import { NextRequest, NextResponse } from "next/server";
import {
  requestOrganizerPayout,
  processOrganizerPayout,
  getOrganizerServerBankAccount,
} from "@/lib/events";
import { assertOrganizerAuth, assertEventAdmin } from "@/lib/server-auth";
import { getMissingPayoutFields, maskAccountNumber } from "@/lib/payout";
import { OrganizerPayoutStatus } from "@/types/event";

export const dynamic = "force-dynamic";

/**
 * POST /api/events/[id]/payout
 * Organizer requests payout of accumulated ticket revenue for an event.
 * Server guard: verifies that organizer bank account in server storage is complete & valid.
 */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { id } = params;
    const body = await req.json();
    const {
      amount,
      notes,
      email,
    }: {
      amount: number;
      bankDetails?: { bankName: string; accountNumber: string; accountHolder: string };
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

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json(
        { success: false, error: "Nominal pencairan harus lebih besar dari Rp 0." },
        { status: 400 }
      );
    }

    // SERVER STORAGE GUARD: Check organizer registered bank account from server storage
    const serverBank = getOrganizerServerBankAccount(auth.email);
    const validation = getMissingPayoutFields(serverBank);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          code: "PAYOUT_BANK_INCOMPLETE",
          error: "Lengkapi data rekening terlebih dahulu sebelum mengajukan pencairan dana.",
          missingFields: validation.missingFields,
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    const result = await requestOrganizerPayout(
      auth.email,
      id,
      Number(amount),
      body.bankDetails,
      notes,
      auth.isAdmin
    );

    return NextResponse.json({
      success: true,
      message: `Permintaan pencairan dana berhasil diajukan ke rekening ${result.payout.bankName} (${maskAccountNumber(result.payout.accountNumber)}) dan sedang menunggu verifikasi DAGO Finance.`,
      data: result,
    });
  } catch (error: any) {
    if (
      error?.code === "PAYOUT_BANK_INCOMPLETE" ||
      error?.message?.startsWith("PAYOUT_BANK_INCOMPLETE")
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "PAYOUT_BANK_INCOMPLETE",
          error: error.message.replace(/^PAYOUT_BANK_INCOMPLETE:\s*/, ""),
          missingFields: error.missingFields || ["bankName", "accountNumber", "accountHolder"],
          errors: error.errors || [],
        },
        { status: 400 }
      );
    }
    if (error?.name === "DatabasePersistenceError") {
      return NextResponse.json(
        {
          success: false,
          error: "Layanan database keuangan sedang mengalami gangguan. Pengajuan pencairan dana belum dapat dikonfirmasi demi mencegah double-payout. Silakan coba kembali.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengajukan pencairan dana." },
      { status: error.message?.includes("FORBIDDEN") ? 403 : 400 }
    );
  }
}

/**
 * PATCH /api/events/[id]/payout
 * Admin verifies, processes, or rejects organizer payout request.
 * Server guard: destination bank must be complete & valid to approve.
 */
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
    if (
      error?.code === "PAYOUT_BANK_INCOMPLETE" ||
      error?.message?.startsWith("PAYOUT_BANK_INCOMPLETE")
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "PAYOUT_BANK_INCOMPLETE",
          error: error.message.replace(/^PAYOUT_BANK_INCOMPLETE:\s*/, ""),
          missingFields: error.missingFields || ["bankName", "accountNumber", "accountHolder"],
          errors: error.errors || [],
        },
        { status: 400 }
      );
    }
    if (error?.name === "DatabasePersistenceError") {
      return NextResponse.json(
        {
          success: false,
          error: "Layanan database keuangan sedang mengalami gangguan. Pembaruan status pencairan dana belum dapat dikonfirmasi demi mencegah double-payout. Silakan coba kembali.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memperbarui status pencairan dana." },
      { status: error.message?.includes("FORBIDDEN") ? 403 : 400 }
    );
  }
}
