import { NextRequest, NextResponse } from "next/server";
import { assertEventAdmin, assertOrganizerAuth } from "@/lib/server-auth";
import { syncStorageFromDb } from "@/lib/data-storage";
import { maskAccountNumber } from "@/lib/payout";
import {
  getEventBankAccounts,
  createEventBankAccount,
  updateEventBankAccount,
  setDefaultEventBankAccount,
  deleteEventBankAccount,
  getEventRevenuePolicy,
} from "@/lib/events";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/admin/settings/banks
 * Returns bank accounts and change history.
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

    await syncStorageFromDb("event_settings.json").catch(() => {});
    const policy = getEventRevenuePolicy();
    const accounts = getEventBankAccounts();

    return NextResponse.json({
      success: true,
      data: {
        bankAccounts: accounts,
        bankHistory: policy.bankHistory || [],
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memuat daftar rekening bank." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events/admin/settings/banks
 * Create a new bank account.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let actorName = "Admin Dago";

    const adminAuth = await assertEventAdmin(req);
    if (!adminAuth.authorized) {
      // Non-admin path: must be an authenticated organizer
      const orgAuth = await assertOrganizerAuth(req);
      if (!orgAuth.authorized || !orgAuth.email) {
        return NextResponse.json(
          { success: false, error: orgAuth.error || "Akses ditolak: Autentikasi sesi penyelenggara atau admin diperlukan." },
          { status: 403 }
        );
      }

      // (a) Organizers may only modify their own bank account:
      // Identity is derived from the authenticated server session (orgAuth.email), not client body.
      // If client body attempts to pass a different third-party email, reject with 403 (FORBIDDEN).
      if (body.organizerEmail && body.organizerEmail.trim().toLowerCase() !== orgAuth.email.toLowerCase()) {
        return NextResponse.json(
          {
            success: false,
            error: "FORBIDDEN: Pelanggaran isolasi data. Anda tidak memiliki izin untuk mengubah rekening milik penyelenggara lain.",
          },
          { status: 403 }
        );
      }

      // (b) Organizer payout receiving accounts are segregated from Dago platform accounts:
      // Organizers may only configure type ORGANIZER.
      if (body.accountType && body.accountType !== "ORGANIZER") {
        return NextResponse.json(
          {
            success: false,
            error: "FORBIDDEN: Penyelenggara hanya berhak mengatur rekening penampung payout (tipe ORGANIZER), bukan rekening penampung platform Dago Hub.",
          },
          { status: 403 }
        );
      }

      // Force identity and account type from authenticated server session
      body.accountType = "ORGANIZER";
      body.organizerEmail = orgAuth.email;
      actorName = `Mitra (${orgAuth.email})`;
    } else {
      actorName = adminAuth.name || "Admin Dago";
    }

    const account = createEventBankAccount(body, actorName);

    return NextResponse.json(
      {
        success: true,
        message: `Rekening ${account.bankName} - ${maskAccountNumber(account.accountNumber)} berhasil disimpan.`,
        data: account,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menyimpan rekening bank." },
      { status: 400 }
    );
  }
}

/**
 * PATCH /api/events/admin/settings/banks
 * Update existing bank account or set as default.
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
    const { id, action, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID rekening bank wajib disertakan." },
        { status: 400 }
      );
    }

    let updated;
    if (action === "SET_DEFAULT") {
      updated = setDefaultEventBankAccount(id, auth.name || "Admin Dago");
    } else {
      updated = updateEventBankAccount(id, updates, auth.name || "Admin Dago");
    }

    return NextResponse.json({
      success: true,
      message: "Data rekening bank berhasil diperbarui.",
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memperbarui rekening bank." },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/events/admin/settings/banks
 * Delete bank account (cannot delete default account).
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await assertEventAdmin(req);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Parameter ID rekening bank (?id=...) wajib disertakan." },
        { status: 400 }
      );
    }

    deleteEventBankAccount(id, auth.name || "Admin Dago");

    return NextResponse.json({
      success: true,
      message: "Rekening bank berhasil dihapus.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menghapus rekening bank." },
      { status: 400 }
    );
  }
}
