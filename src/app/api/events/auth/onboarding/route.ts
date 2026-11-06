import { NextRequest, NextResponse } from "next/server";
import { getRequestAuthUser } from "@/lib/server-auth";
import { activateOrganizerSelfService } from "@/lib/unified-account";

export const dynamic = "force-dynamic";

/**
 * POST /api/events/auth/onboarding
 * Self-service Organizer Onboarding:
 * Enables an existing authenticated DagoEng Customer to activate their Organizer profile
 * without creating a second account or waiting for manual administrator invitations.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    const body = await req.json();
    const { organizationName, category, contactPerson, phone, notes } = body;

    const targetEmail = auth.isAuthenticated && auth.email ? auth.email : body.email;

    if (!targetEmail || typeof targetEmail !== "string" || !targetEmail.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Alamat email wajib diisi atau Anda harus login terlebih dahulu." },
        { status: 400 }
      );
    }

    if (!organizationName || typeof organizationName !== "string" || organizationName.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: "Nama organisasi/komunitas minimal 3 karakter." },
        { status: 400 }
      );
    }

    const result = await activateOrganizerSelfService(targetEmail, {
      organizationName: organizationName.trim(),
      category: category?.trim() || "Komunitas Kreatif",
      contactPerson: contactPerson?.trim() || auth.name || organizationName.trim(),
      phone: phone?.trim(),
      notes: notes?.trim(),
    });

    return NextResponse.json({
      success: true,
      message: `Selamat! Profil penyelenggara [${result.organizer.name}] berhasil diaktifkan. Anda kini dapat mengakses dashboard organizer.`,
      data: {
        organizer: result.organizer,
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
        },
        redirectUrl: "/events/portal",
      },
    });
  } catch (err: any) {
    console.error("POST /api/events/auth/onboarding error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal mengaktifkan profil penyelenggara." },
      { status: 500 }
    );
  }
}
