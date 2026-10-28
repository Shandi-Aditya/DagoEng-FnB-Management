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
  * PUT/PATCH /api/events/admin/settings
 * Admin-only endpoint to update platform event marketplace revenue sharing & business settings.
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
    const {
      defaultPlatformFeePercent,
      maxTicketsPerBooking,
      activePaymentMethod,
      bookingPaymentExpiryMinutes,
      allowOrganizerBankAccounts,
      allowEventBankOverride,
      paymentInstructions,
      allowedProofFormats,
      maxProofFileSizeMb,
      policyNotes,
      effectiveDate,
    } = body;

    if (defaultPlatformFeePercent !== undefined && defaultPlatformFeePercent !== null) {
      const fee = Number(defaultPlatformFeePercent);
      if (isNaN(fee) || fee < 0 || fee > 100) {
        return NextResponse.json(
          { success: false, error: "Persentase komisi platform harus berupa angka valid antara 0% dan 100%." },
          { status: 400 }
        );
      }
    }

    if (maxTicketsPerBooking !== undefined && maxTicketsPerBooking !== null) {
      const maxTkt = Number(maxTicketsPerBooking);
      if (isNaN(maxTkt) || !Number.isInteger(maxTkt) || maxTkt < 1) {
        return NextResponse.json(
          { success: false, error: "Batas tiket per pemesanan harus berupa bilangan bulat positif (minimal 1)." },
          { status: 400 }
        );
      }
    }

    const updated = updateEventRevenuePolicy(
      {
        defaultPlatformFeePercent: defaultPlatformFeePercent !== undefined ? Number(defaultPlatformFeePercent) : undefined,
        maxTicketsPerBooking: maxTicketsPerBooking !== undefined ? Number(maxTicketsPerBooking) : undefined,
        activePaymentMethod,
        bookingPaymentExpiryMinutes: bookingPaymentExpiryMinutes !== undefined ? Number(bookingPaymentExpiryMinutes) : undefined,
        allowOrganizerBankAccounts,
        allowEventBankOverride,
        paymentInstructions,
        allowedProofFormats,
        maxProofFileSizeMb: maxProofFileSizeMb !== undefined ? Number(maxProofFileSizeMb) : undefined,
        policyNotes,
        effectiveDate,
      },
      auth.name || "Admin Dago"
    );

    return NextResponse.json({
      success: true,
      message: "Konfigurasi kebijakan bisnis dan pembayaran event berhasil diperbarui.",
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memperbarui kebijakan event." },
      { status: 500 }
    );
  }
}

export const PATCH = PUT;
