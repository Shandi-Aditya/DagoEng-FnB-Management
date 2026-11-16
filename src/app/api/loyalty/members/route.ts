import { NextRequest, NextResponse } from "next/server";
import {
  getPersistentLoyaltyMembers,
  savePersistentLoyaltyMember,
  deletePersistentLoyaltyMember,
} from "@/lib/persistent-storage";
import { normalizeLoyaltyPhone } from "@/lib/master-data-defaults";
import { LoyaltyMember, LoyaltyTier } from "@/types/loyalty";

export const dynamic = "force-dynamic";

/**
 * GET /api/loyalty/members
 * Fetches all loyalty members from persistent server storage.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone");
    const outletId = searchParams.get("outletId");
    const tier = searchParams.get("tier");
    const status = searchParams.get("status");

    let members = await getPersistentLoyaltyMembers();

    if (phone) {
      const norm = normalizeLoyaltyPhone(phone);
      members = members.filter((m) => normalizeLoyaltyPhone(m.phone) === norm);
    }
    if (outletId && outletId !== "ALL") {
      members = members.filter(
        (m) => m.registeredOutletId === outletId || !m.registeredOutletId
      );
    }
    if (tier) {
      members = members.filter((m) => m.tier === tier);
    }
    if (status) {
      members = members.filter((m) => m.status === status);
    }

    return NextResponse.json({
      success: true,
      members,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengambil data member loyalty." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/loyalty/members
 * Registers a new loyalty member or updates an existing member (deduplicated by phone number).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const memberData = body.member || body;

    if (!memberData || !memberData.name || !memberData.phone) {
      return NextResponse.json(
        { success: false, error: "Nama dan nomor telepon member wajib diisi." },
        { status: 400 }
      );
    }

    const normPhone = normalizeLoyaltyPhone(memberData.phone);
    const existingList = await getPersistentLoyaltyMembers();
    const existing = existingList.find(
      (m) => normalizeLoyaltyPhone(m.phone) === normPhone
    );

    if (existing && !memberData.allowUpdate) {
      return NextResponse.json({
        success: true,
        member: existing,
        isExisting: true,
      });
    }

    const nowIso = new Date().toISOString();
    const points = typeof memberData.points === "number" ? memberData.points : (memberData.initialPoints || 0);

    const member: LoyaltyMember = {
      id: memberData.id || existing?.id || `mem-${Date.now()}`,
      name: memberData.name.trim(),
      phone: memberData.phone.trim(),
      email: memberData.email || existing?.email || "",
      identityNo: memberData.identityNo || existing?.identityNo || "",
      tier: (memberData.tier as LoyaltyTier) || existing?.tier || "Bronze",
      points,
      totalSpend: typeof memberData.totalSpend === "number" ? memberData.totalSpend : (existing?.totalSpend || 0),
      totalVisits: typeof memberData.totalVisits === "number" ? memberData.totalVisits : (existing?.totalVisits || 0),
      favoriteItem: memberData.favoriteItem || existing?.favoriteItem || "-",
      registeredOutletId: memberData.registeredOutletId || existing?.registeredOutletId || "outlet-sgr",
      registeredOutletName: memberData.registeredOutletName || existing?.registeredOutletName || "Singaraja",
      status: memberData.status || existing?.status || "ACTIVE",
      joinedDate: memberData.joinedDate || existing?.joinedDate || nowIso,
      lastVisit: memberData.lastVisit || existing?.lastVisit || nowIso,
      pointHistory: memberData.pointHistory || existing?.pointHistory || [],
      tierHistory: memberData.tierHistory || existing?.tierHistory || [],
    };

    const saved = await savePersistentLoyaltyMember(member);

    return NextResponse.json({
      success: true,
      member: saved,
      isExisting: Boolean(existing),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menyimpan data member loyalty." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/loyalty/members
 * Updates an existing loyalty member (points, tier, profile, history).
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = body.id || body.member?.id;
    const updates = body.updates || body.member || body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID member wajib disertakan." },
        { status: 400 }
      );
    }

    const existingList = await getPersistentLoyaltyMembers();
    const target = existingList.find((m) => m.id === id);

    if (!target) {
      return NextResponse.json(
        { success: false, error: `Member dengan ID [${id}] tidak ditemukan.` },
        { status: 404 }
      );
    }

    const merged: LoyaltyMember = {
      ...target,
      ...updates,
      id,
    };

    const saved = await savePersistentLoyaltyMember(merged);

    return NextResponse.json({
      success: true,
      member: saved,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memperbarui data member loyalty." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/loyalty/members
 * Deletes a loyalty member from persistent server storage.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idFromQuery = searchParams.get("id");
    let id = idFromQuery;

    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = body.id;
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID member wajib disertakan untuk penghapusan." },
        { status: 400 }
      );
    }

    await deletePersistentLoyaltyMember(id);

    return NextResponse.json({
      success: true,
      message: `Member dengan ID [${id}] berhasil dihapus.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menghapus data member loyalty." },
      { status: 500 }
    );
  }
}
