import { NextRequest, NextResponse } from "next/server";
import { assertEventAdmin } from "@/lib/server-auth";
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
    const auth = await assertEventAdmin(req);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 403 }
      );
    }

    const body = await req.json();
    const account = createEventBankAccount(body, auth.name || "Admin Dago");

    return NextResponse.json(
      {
        success: true,
        message: `Rekening ${account.bankName} - ${account.accountNumber} berhasil ditambahkan.`,
        data: account,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menambahkan rekening bank." },
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
