import { NextRequest, NextResponse } from "next/server";
import { assertEventAdmin } from "@/lib/server-auth";
import { getEventRevenuePolicy, updateEventRevenuePolicy } from "@/lib/events";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/admin/settings
 * Admin-only endpoint to get platform event marketplace revenue sharing configuration.
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
    return NextResponse.json({
      success: true,
      data: policy,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memuat kebijakan bagi hasil event." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/events/admin/settings
 * Admin-only endpoint to update platform event marketplace revenue sharing policy.
 */
export async function PUT(req: NextRequest) {
  try {
    const auth = await assertEventAdmin(req);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { defaultPlatformFeePercent, policyNotes, effectiveDate } = body;

    if (defaultPlatformFeePercent === undefined || defaultPlatformFeePercent === null) {
      return NextResponse.json(
        { success: false, error: "Nilai defaultPlatformFeePercent wajib disertakan." },
        { status: 400 }
      );
    }

    const fee = Number(defaultPlatformFeePercent);
    if (isNaN(fee) || fee < 0 || fee > 100) {
      return NextResponse.json(
        { success: false, error: "Persentase komisi platform harus berupa angka valid antara 0% dan 100%." },
        { status: 400 }
      );
    }

    const updated = updateEventRevenuePolicy(
      {
        defaultPlatformFeePercent: fee,
        policyNotes,
        effectiveDate,
      },
      auth.name || "Admin Dago"
    );

    return NextResponse.json({
      success: true,
      message: `Kebijakan komisi platform berhasil diperbarui menjadi ${fee}% Platform / ${100 - fee}% Penyelenggara.`,
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memperbarui kebijakan bagi hasil event." },
      { status: 500 }
    );
  }
}
