import { NextRequest, NextResponse } from "next/server";
import { assertEventAdmin } from "@/lib/server-auth";
import { syncStorageFromDb, persistStorageToDb, isReconciliationGateActive } from "@/lib/data-storage";
import { getEventRevenuePolicy, updateEventRevenuePolicy, saveEventSettingsToDisk } from "@/lib/events";

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

    await syncStorageFromDb("event_settings.json").catch(() => {});
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
      // 1. RBAC Guard: Hanya SUPER_ADMIN atau OWNER dengan kewenangan tingkat PLATFORM atau ORGANIZATION yang berhak mengubah komisi platform default
      const isPlatformSuperAdmin = auth.role === "SUPER_ADMIN";
      const isPlatformOwner =
        auth.role === "OWNER" &&
        (auth.scopeLevel === "PLATFORM" || auth.scopeLevel === "ORGANIZATION");

      if (!isPlatformSuperAdmin && !isPlatformOwner) {
        return NextResponse.json(
          {
            success: false,
            error:
              "FORBIDDEN: Perubahan persentase komisi default platform hanya dapat dilakukan oleh SUPER_ADMIN atau OWNER pengelola platform. Pengguna tingkat tenant atau manajer operasional tidak berwenang.",
          },
          { status: 403 }
        );
      }

      const fee = Number(defaultPlatformFeePercent);
      if (isNaN(fee) || !Number.isInteger(fee) || fee < 0 || fee > 50) {
        return NextResponse.json(
          { success: false, error: "Persentase komisi platform harus berupa bilangan bulat antara 0% dan 50%." },
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

    // Pastikan tidak ada rekonsiliasi yang sedang berlangsung sebelum mengubah memori atau disk
    if (isReconciliationGateActive("event_settings.json")) {
      return NextResponse.json(
        {
          success: false,
          error: "Gagal memperbarui kebijakan event: Proses sinkronisasi database sedang berlangsung. Silakan coba beberapa saat lagi demi integritas data.",
        },
        { status: 503 }
      );
    }

    const previousPolicy = getEventRevenuePolicy();
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

    // Persistensi wajib ke database PostgreSQL (Neon). Jika gagal, teruskan sebagai error dan rollback disk.
    try {
      await persistStorageToDb("event_settings.json", JSON.stringify(updated, null, 2));
    } catch (dbErr: any) {
      // Rollback file lokal ke state sebelum update agar disk dan PostgreSQL tidak mengalami divergensi
      // Jangan menimpa disk jika rekonsiliasi database sedang berlangsung
      if (!isReconciliationGateActive("event_settings.json")) {
        saveEventSettingsToDisk(previousPolicy);
      }
      console.error("[settings] Gagal menyimpan ke PostgreSQL, rollback disk dijalankan:", dbErr?.message || dbErr);
      return NextResponse.json(
        {
          success: false,
          error: `Gagal mengamankan penyimpanan ke database cloud (PostgreSQL): ${dbErr?.message || "Koneksi database terputus"}. Perubahan dibatalkan demi integritas data.`,
        },
        { status: 500 }
      );
    }

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
