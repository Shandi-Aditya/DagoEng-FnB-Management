import { NextRequest, NextResponse } from "next/server";
import { assertEventAdmin, assertOrganizerAuth } from "@/lib/server-auth";
import {
  syncStorageFromDb,
  syncStorageFromDbWithSnapshot,
  persistStorageToDb,
  isReconciliationGateActive,
  getStorageSyncStatus,
} from "@/lib/data-storage";
import { maskAccountNumber } from "@/lib/payout";
import {
  getEventBankAccounts,
  buildCreateEventBankAccount,
  buildUpdateEventBankAccount,
  buildSetDefaultEventBankAccount,
  buildDeleteEventBankAccount,
  getEventRevenuePolicy,
  saveEventSettingsToDisk,
  BankMutationContext,
  EventRevenueSharingPolicy,
} from "@/lib/events";

export const dynamic = "force-dynamic";

interface MutationSuccess<T> {
  success: true;
  data: T;
  revision: number;
}

interface MutationFailure {
  success: false;
  status: number;
  error: string;
}

/**
 * Cloud-First Atomic Mutation Pipeline:
 * 1. Pre-sync from Neon fail-closed and capture isolated per-request database version snapshot.
 * 2. In-memory candidate policy generation strictly per-request (zero shared global state).
 * 3. Atomic CAS persistStorageToDb using THIS request's own expectedUpdatedAt with requireCas: true.
 * 4. Automatic single retry on LOST_UPDATE_PREVENTED / CAS conflict with fresh re-sync snapshot.
 * 5. Disk replica commit with integer revision guard after cloud success.
 * 6. Executes deferred organizer profile side effects only for THIS request after cloud success.
 */
async function executeCloudFirstBankMutation<T>(
  actionName: string,
  builderFn: (currentPolicy: EventRevenueSharingPolicy) => BankMutationContext<T>
): Promise<MutationSuccess<T> | MutationFailure> {
  // Step 1: Pre-sync from Neon fail-closed and capture per-request snapshot
  const snapshot = await syncStorageFromDbWithSnapshot("event_settings.json").catch(() => null);
  if (!snapshot || !snapshot.success || !snapshot.updatedAt || !(snapshot.updatedAt instanceof Date) || isNaN(snapshot.updatedAt.getTime())) {
    return {
      success: false,
      status: 503,
      error: "Gagal memproses rekening bank: Tidak dapat menyinkronkan data snapshot terbaru dari database cloud (Neon). Silakan coba beberapa saat lagi demi integritas data.",
    };
  }

  let currentPolicy = getEventRevenuePolicy();
  let expectedUpdatedAt: Date = snapshot.updatedAt;

  // Build candidate context strictly per-request (pure in-memory, no global state)
  let context: BankMutationContext<T>;
  try {
    context = builderFn(currentPolicy);
  } catch (err: any) {
    return {
      success: false,
      status: 400,
      error: err?.message || "Validasi rekening bank gagal.",
    };
  }

  let isConflict = false;
  let commitError: any = null;

  try {
    const payload = JSON.stringify(context.candidatePolicy, null, 2);
    await persistStorageToDb("event_settings.json", payload, {
      expectedUpdatedAt,
      requireCas: true,
    });
  } catch (err: any) {
    if (err?.message?.includes("LOST_UPDATE_PREVENTED") || err?.message?.includes("CONCURRENT_CREATE_CONFLICT")) {
      isConflict = true;
    } else {
      commitError = err;
    }
  }

  // If CAS conflict: Perform EXACTLY ONE retry with re-sync
  if (isConflict) {
    const retrySnapshot = await syncStorageFromDbWithSnapshot("event_settings.json").catch(() => null);
    if (!retrySnapshot || !retrySnapshot.success || !retrySnapshot.updatedAt || !(retrySnapshot.updatedAt instanceof Date) || isNaN(retrySnapshot.updatedAt.getTime())) {
      return {
        success: false,
        status: 503,
        error: "Gagal rekonsiliasi setelah konflik konkurensi: Sinkronisasi ulang database cloud gagal.",
      };
    }

    currentPolicy = getEventRevenuePolicy();
    expectedUpdatedAt = retrySnapshot.updatedAt;

    try {
      context = builderFn(currentPolicy);
    } catch (retryValidationErr: any) {
      return {
        success: false,
        status: 409,
        error: `Konflik pembaruan konkuren: Data telah diperbarui oleh sesi lain (${retryValidationErr?.message || "Data berubah"}). Silakan muat ulang halaman.`,
      };
    }

    try {
      const retryPayload = JSON.stringify(context.candidatePolicy, null, 2);
      await persistStorageToDb("event_settings.json", retryPayload, {
        expectedUpdatedAt,
        requireCas: true,
      });
      isConflict = false;
    } catch (retryDbErr: any) {
      if (retryDbErr?.message?.includes("LOST_UPDATE_PREVENTED") || retryDbErr?.message?.includes("CONCURRENT_CREATE_CONFLICT")) {
        return {
          success: false,
          status: 409,
          error: "Konflik pembaruan konkuren: Data rekening bank telah diperbarui secara bersamaan oleh sesi lain. Silakan muat ulang halaman.",
        };
      }
      commitError = retryDbErr;
    }
  }

  if (commitError) {
    console.error("[banks] Gagal menyimpan ke PostgreSQL, rollback disk dijalankan:", commitError?.message || commitError);
    return {
      success: false,
      status: 500,
      error: `Gagal mengamankan penyimpanan ke database cloud (PostgreSQL): ${commitError?.message || "Koneksi database terputus"}. Perubahan rekening bank dibatalkan demi integritas data.`,
    };
  }

  // Neon commit is successful!
  // Execute THIS request's own organizer side-effect (if any)
  if (context.organizerSideEffect) {
    try {
      context.organizerSideEffect();
    } catch (orgErr) {
      console.warn("[banks] Gagal memperbarui detail bank mitra setelah commit cloud sukses:", orgErr);
    }
  }

  // Save THIS request's own candidate policy to disk with revision guard
  try {
    saveEventSettingsToDisk(context.candidatePolicy);
  } catch (diskErr) {
    console.warn("[banks] Gagal menyimpan replika disk lokal setelah commit cloud sukses:", diskErr);
  }

  return {
    success: true,
    data: context.result,
    revision: context.candidatePolicy._revision || 0,
  };
}

/**
 * GET /api/events/admin/settings/banks
 * Returns bank accounts and change history with transparent cloud sync metadata.
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

    const syncSuccess = await syncStorageFromDb("event_settings.json").catch(() => false);
    const syncStatus = getStorageSyncStatus("event_settings.json");
    const policy = getEventRevenuePolicy();
    const accounts = getEventBankAccounts();

    return NextResponse.json({
      success: true,
      data: {
        bankAccounts: accounts,
        bankHistory: policy.bankHistory || [],
      },
      meta: {
        syncStatus,
        isVerified: syncSuccess && syncStatus === "SYNCED",
        source: syncSuccess ? "NEON_DATABASE" : "LOCAL_CACHE",
        warning: syncSuccess
          ? undefined
          : "Koneksi database cloud (Neon) tidak tersedia. Menampilkan data cache lokal yang belum terverifikasi.",
        revision: policy._revision || 0,
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
 * Create a new bank account via Cloud-First mutation pipeline.
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

    // Pastikan tidak ada rekonsiliasi database yang sedang aktif sebelum memproses
    if (isReconciliationGateActive("event_settings.json")) {
      return NextResponse.json(
        {
          success: false,
          error: "Gagal memproses rekening bank: Proses sinkronisasi database sedang berlangsung. Silakan coba beberapa saat lagi demi integritas data.",
        },
        { status: 503 }
      );
    }

    const mutationResult = await executeCloudFirstBankMutation("CREATE", (currentPolicy) =>
      buildCreateEventBankAccount(body, actorName, currentPolicy)
    );

    if (!mutationResult.success) {
      return NextResponse.json(
        { success: false, error: mutationResult.error },
        { status: mutationResult.status }
      );
    }

    const account = mutationResult.data;
    return NextResponse.json(
      {
        success: true,
        message: `Rekening ${account.bankName} - ${maskAccountNumber(account.accountNumber)} berhasil disimpan.`,
        data: account,
        meta: { revision: mutationResult.revision },
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
 * Update existing bank account or set as default via Cloud-First mutation pipeline.
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

    // Pastikan tidak ada rekonsiliasi database yang sedang aktif sebelum memproses
    if (isReconciliationGateActive("event_settings.json")) {
      return NextResponse.json(
        {
          success: false,
          error: "Gagal memperbarui rekening bank: Proses sinkronisasi database sedang berlangsung. Silakan coba beberapa saat lagi demi integritas data.",
        },
        { status: 503 }
      );
    }

    const mutationResult = await executeCloudFirstBankMutation("UPDATE", (currentPolicy) => {
      if (action === "SET_DEFAULT") {
        return buildSetDefaultEventBankAccount(id, auth.name || "Admin Dago", currentPolicy);
      }
      return buildUpdateEventBankAccount(id, updates, auth.name || "Admin Dago", currentPolicy);
    });

    if (!mutationResult.success) {
      return NextResponse.json(
        { success: false, error: mutationResult.error },
        { status: mutationResult.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Data rekening bank berhasil diperbarui.",
      data: mutationResult.data,
      meta: { revision: mutationResult.revision },
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
 * Delete bank account (cannot delete default account) via Cloud-First mutation pipeline.
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

    // Pastikan tidak ada rekonsiliasi database yang sedang aktif sebelum memproses
    if (isReconciliationGateActive("event_settings.json")) {
      return NextResponse.json(
        {
          success: false,
          error: "Gagal menghapus rekening bank: Proses sinkronisasi database sedang berlangsung. Silakan coba beberapa saat lagi demi integritas data.",
        },
        { status: 503 }
      );
    }

    const mutationResult = await executeCloudFirstBankMutation("DELETE", (currentPolicy) =>
      buildDeleteEventBankAccount(id, auth.name || "Admin Dago", currentPolicy)
    );

    if (!mutationResult.success) {
      return NextResponse.json(
        { success: false, error: mutationResult.error },
        { status: mutationResult.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Rekening bank berhasil dihapus.",
      meta: { revision: mutationResult.revision },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menghapus rekening bank." },
      { status: 400 }
    );
  }
}
