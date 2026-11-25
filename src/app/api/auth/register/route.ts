import { NextRequest, NextResponse } from "next/server";
import { registerUnifiedUser } from "@/lib/unified-account";
import { createOrganizerSession } from "@/lib/organizer-activation";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import {
  getPersistentLoyaltyMembers,
  readSeededPersistentData,
  savePersistentLoyaltyMember,
} from "@/lib/persistent-storage";
import {
  TENANT_ACCOUNTS_FILE,
  type TenantOwnerAccount,
} from "@/lib/tenant-activation";
import { normalizeLoyaltyPhone } from "@/lib/master-data-defaults";
import type { LoyaltyMember } from "@/types/loyalty";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, password } = body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: "Nama lengkap minimal 2 karakter." },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Alamat email tidak valid." },
        { status: 400 }
      );
    }

    if (!phone || typeof phone !== "string" || phone.trim().length < 8) {
      return NextResponse.json(
        { success: false, error: "Nomor telepon/WhatsApp minimal 8 digit." },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.trim().length < 6) {
      return NextResponse.json(
        { success: false, error: "Password minimal 6 karakter." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const tenantOwnerAccounts = await readSeededPersistentData<TenantOwnerAccount[]>(
      TENANT_ACCOUNTS_FILE,
      () => []
    );
    if (tenantOwnerAccounts.some((a) => a.email.toLowerCase() === normalizedEmail)) {
      return NextResponse.json(
        {
          success: false,
          error: "Email tersebut sudah terdaftar sebagai akun pemilik mitra. Gunakan halaman masuk atau email lain.",
        },
        { status: 409 }
      );
    }

    const { user, isExisting } = await registerUnifiedUser({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password: password.trim(),
      role: "CUSTOMER",
      enforceUniquePhone: true,
    });

    const normPhone = normalizeLoyaltyPhone(user.phone);
    const existingMembers = await getPersistentLoyaltyMembers();
    const existingMember = existingMembers.find(
      (m) =>
        (normPhone && normalizeLoyaltyPhone(m.phone) === normPhone) ||
        (m.email && m.email.toLowerCase() === user.email.toLowerCase())
    );

    if (existingMember) {
      if (!existingMember.email && user.email) {
        await savePersistentLoyaltyMember({
          ...existingMember,
          email: user.email,
        });
      }
    } else {
      const joinedLabel = new Date().toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Makassar",
      });
      const newMember: LoyaltyMember = {
        id: `mem-${Date.now()}`,
        name: user.name,
        phone: user.phone,
        email: user.email,
        tier: "Bronze",
        points: 0,
        totalSpend: 0,
        totalVisits: 0,
        favoriteItem: "-",
        registeredOutletId: "outlet-sgr",
        registeredOutletName: "Singaraja",
        status: "ACTIVE",
        joinedDate: joinedLabel,
        lastVisit: "-",
        pointHistory: [],
        tierHistory: [],
      };
      await savePersistentLoyaltyMember(newMember);
    }

    const session = await createOrganizerSession(
      user.email,
      req.headers.get("user-agent") || undefined,
      req.headers.get("x-forwarded-for") || undefined
    );

    const res = NextResponse.json(
      {
        success: true,
        isExisting,
        message: isExisting
          ? "Akun Anda sudah terdaftar. Berhasil masuk ke sesi DagoEng."
          : "Pendaftaran akun terpadu DagoEng berhasil.",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          organizerProfileId: user.organizerProfileId,
        },
      },
      { status: isExisting ? 200 : 201 }
    );

    res.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: session.rawToken,
      path: "/",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return res;
  } catch (err: any) {
    if (typeof err?.message === "string" && err.message.startsWith("PHONE_CONFLICT:")) {
      return NextResponse.json(
        {
          success: false,
          error: err.message.replace("PHONE_CONFLICT:", "").trim(),
        },
        { status: 409 }
      );
    }
    console.error("POST /api/auth/register error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal memproses pendaftaran akun." },
      { status: 500 }
    );
  }
}
