import { NextRequest, NextResponse } from "next/server";
import {
  deletePersistentLoyaltyMember,
  getPersistentLoyaltyMembers,
  getPersistentLoyaltyPoints,
  getPersistentOrders,
  readSeededPersistentData,
  savePersistentLoyaltyMember,
} from "@/lib/persistent-storage";
import { normalizeLoyaltyPhone } from "@/lib/master-data-defaults";
import { LoyaltyMember, LoyaltyPointTransaction } from "@/types/loyalty";
import { DEFAULT_PLATFORM_SETTINGS, PlatformSettings } from "@/types/settings";
import { getRequestAuthUser } from "@/lib/server-auth";
import {
  canUserViewFullCustomerContacts,
  maskCustomerEmail,
  maskCustomerPhone,
  resolveAuthoritativeMemberTier,
} from "@/features/customers/customers-domain";

export const dynamic = "force-dynamic";

async function reconcileMembersWithServerLoyaltyPoints(
  members: LoyaltyMember[]
): Promise<LoyaltyMember[]> {
  const [pointsRecords, orders, platformSettings] = await Promise.all([
    getPersistentLoyaltyPoints(),
    getPersistentOrders(),
    readSeededPersistentData<PlatformSettings>(
      "platform_settings.json",
      () => DEFAULT_PLATFORM_SETTINGS
    ),
  ]);

  if (pointsRecords.length === 0 || members.length === 0) {
    return members;
  }

  const ordersById = new Map(orders.map((o) => [o.id, o]));
  const result: LoyaltyMember[] = [];

  for (const member of members) {
    const normPhone = normalizeLoyaltyPhone(member.phone);
    const idKey = member.id.trim().toLowerCase();
    const nameKey = member.name.trim().toLowerCase();

    const matchedRecords = pointsRecords.filter((rec) => {
      const recKey = rec.customerKey.trim().toLowerCase();
      if (recKey === idKey) return true;
      if (normPhone && normalizeLoyaltyPhone(rec.customerKey) === normPhone) return true;
      if (nameKey && recKey === nameKey) return true;
      return false;
    });

    if (matchedRecords.length === 0) {
      result.push(member);
      continue;
    }

    let currentPoints = Number(member.points) || 0;
    let currentSpend = Number(member.totalSpend) || 0;
    let currentVisits = Number(member.totalVisits) || 0;
    const history: LoyaltyPointTransaction[] = Array.isArray(member.pointHistory)
      ? [...member.pointHistory]
      : [];
    const existingTxIds = new Set(
      history.map((h) => h.relatedTransactionId).filter((id): id is string => Boolean(id))
    );
    let mutated = false;

    for (const rec of matchedRecords) {
      const creditedIds = Array.isArray(rec.creditedOrderIds)
        ? Array.from(new Set(rec.creditedOrderIds.map((id) => id.trim()).filter(Boolean)))
        : [];
      if (creditedIds.length === 0) continue;

      const missingOrderIds = creditedIds.filter((oid) => !existingTxIds.has(oid));
      if (missingOrderIds.length === 0) continue;

      const presentIds = creditedIds.filter((oid) => existingTxIds.has(oid));
      let accountedInRecord = 0;
      for (const pid of presentIds) {
        const ord = ordersById.get(pid);
        if (ord) {
          accountedInRecord += Math.floor((Number(ord.total) || 0) / 10000);
        } else {
          const histEntry = history.find(
            (h) => h.type === "EARN" && h.relatedTransactionId === pid
          );
          accountedInRecord += Math.max(0, Number(histEntry?.points) || 0);
        }
      }

      const remainingRecordPoints = Math.max(
        0,
        (Number(rec.points) || 0) - accountedInRecord
      );

      let knownMissingSum = 0;
      const unknownOrderIds: string[] = [];
      for (const oid of missingOrderIds) {
        const ord = ordersById.get(oid);
        if (ord) {
          knownMissingSum += Math.floor((Number(ord.total) || 0) / 10000);
        } else {
          unknownOrderIds.push(oid);
        }
      }

      const poolForUnknown = Math.max(0, remainingRecordPoints - knownMissingSum);
      const baseUnknownShare =
        unknownOrderIds.length > 0 ? Math.floor(poolForUnknown / unknownOrderIds.length) : 0;
      let unknownRemainder =
        unknownOrderIds.length > 0 ? poolForUnknown % unknownOrderIds.length : 0;

      for (const oid of missingOrderIds) {
        const ord = ordersById.get(oid);
        let ptsToAdd = 0;
        if (ord) {
          ptsToAdd = Math.floor((Number(ord.total) || 0) / 10000);
        } else {
          ptsToAdd = baseUnknownShare + (unknownRemainder > 0 ? 1 : 0);
          if (unknownRemainder > 0) unknownRemainder -= 1;
        }

        const spendDelta = ord
          ? Math.max(0, Math.round(Number(ord.total) || 0))
          : ptsToAdd * 10000;
        currentPoints += ptsToAdd;
        currentSpend += spendDelta;
        currentVisits += 1;

        history.unshift({
          id: `ptx-srv-${oid}`,
          memberId: member.id,
          type: "EARN",
          points: ptsToAdd,
          spendAmount: spendDelta,
          balanceAfter: currentPoints,
          reason: ord?.orderNumber
            ? `Transaksi #${ord.orderNumber}`
            : `Transaksi Server #${oid}`,
          relatedTransactionId: oid,
          timestamp: ord?.createdAt || rec.updatedAt || new Date().toISOString(),
          actorName: "Sistem Server",
          outletId: ord?.outletId || member.registeredOutletId,
        });
        existingTxIds.add(oid);
        mutated = true;
      }
    }

    if (!mutated) {
      result.push(member);
      continue;
    }

    const nextTier = resolveAuthoritativeMemberTier(
      {
        tier: member.tier,
        points: currentPoints,
        tierHistory: member.tierHistory,
      },
      platformSettings.loyaltyTiers
    );

    const reconciled: LoyaltyMember = {
      ...member,
      points: currentPoints,
      tier: nextTier,
      totalSpend: currentSpend,
      totalVisits: currentVisits,
      pointHistory: history,
    };

    const saved = await savePersistentLoyaltyMember(reconciled);
    result.push(saved);
  }

  return result;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role) {
      return NextResponse.json(
        { success: false, error: "Akses ditolak. Sesi login diperlukan." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone");
    const outletId = searchParams.get("outletId");
    const tier = searchParams.get("tier");
    const status = searchParams.get("status");

    const storedMembers = await getPersistentLoyaltyMembers();
    let members = await reconcileMembersWithServerLoyaltyPoints(storedMembers);

    if (phone) {
      const norm = normalizeLoyaltyPhone(phone);
      members = members.filter((m) => normalizeLoyaltyPhone(m.phone) === norm);
    }
    if (outletId && outletId !== "ALL") {
      members = members.filter(
        (m) => m.registeredOutletId === outletId || !m.registeredOutletId
      );
    }
    if (tier && tier !== "ALL") {
      const targetTier = tier.trim().toLowerCase();
      members = members.filter((m) => (m.tier || "").toLowerCase() === targetTier);
    }
    if (status && status !== "ALL") {
      const targetStatus = status.trim().toUpperCase();
      members = members.filter((m) => (m.status || "").toUpperCase() === targetStatus);
    }

    // Role-based visibility
    if (auth.role === "CUSTOMER") {
      const sessionEmail = auth.email?.toLowerCase().trim();
      members = members.filter((m) => {
        if (sessionEmail && m.email && m.email.toLowerCase().trim() === sessionEmail) {
          return true;
        }
        return false;
      });
    } else if (!canUserViewFullCustomerContacts(auth.role)) {
      // Peran kasir / staf non-manager: samarkan kontak dan kosongkan nomor identitas
      members = members.map((m) => ({
        ...m,
        phone: maskCustomerPhone(m.phone),
        email: maskCustomerEmail(m.email),
        identityNo: "",
      }));
    }

    return NextResponse.json({
      success: true,
      members,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Gagal mengambil data member loyalty.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role) {
      return NextResponse.json(
        { success: false, error: "Akses ditolak. Sesi login diperlukan." },
        { status: 401 }
      );
    }

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

    const platformSettings = await readSeededPersistentData<PlatformSettings>(
      "platform_settings.json",
      () => DEFAULT_PLATFORM_SETTINGS
    );

    const nowIso = new Date().toISOString();
    let points =
      typeof memberData.points === "number"
        ? memberData.points
        : memberData.initialPoints || 0;

    // Larang CASHIER menetapkan initialPoints > 0
    if (auth.role === "CASHIER") {
      points = 0;
    }

    // Jangan pernah menimpa kontak asli dengan data yang disamarkan (*)
    const effectivePhone =
      memberData.phone.includes("*") && existing ? existing.phone : memberData.phone.trim();
    const effectiveEmail =
      memberData.email && memberData.email.includes("*") && existing
        ? existing.email
        : memberData.email || existing?.email || "";
    const effectiveIdentityNo =
      memberData.identityNo && memberData.identityNo.includes("*") && existing
        ? existing.identityNo
        : memberData.identityNo || existing?.identityNo || "";

    const calculatedTier = resolveAuthoritativeMemberTier(
      {
        tier: memberData.tier,
        points,
        tierHistory: memberData.tierHistory || existing?.tierHistory || [],
      },
      platformSettings.loyaltyTiers
    );

    const member: LoyaltyMember = {
      id: memberData.id || existing?.id || `mem-${Date.now()}`,
      name: memberData.name.trim(),
      phone: effectivePhone,
      email: effectiveEmail,
      identityNo: effectiveIdentityNo,
      tier: calculatedTier,
      points,
      totalSpend:
        typeof memberData.totalSpend === "number"
          ? memberData.totalSpend
          : existing?.totalSpend || 0,
      totalVisits:
        typeof memberData.totalVisits === "number"
          ? memberData.totalVisits
          : existing?.totalVisits || 0,
      favoriteItem: memberData.favoriteItem || existing?.favoriteItem || "-",
      registeredOutletId:
        memberData.registeredOutletId || existing?.registeredOutletId || "outlet-sgr",
      registeredOutletName:
        memberData.registeredOutletName || existing?.registeredOutletName || "Singaraja",
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
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Gagal menyimpan data member loyalty.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role) {
      return NextResponse.json(
        { success: false, error: "Akses ditolak. Sesi login diperlukan." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const id = body.id || body.member?.id;
    const updates = { ...(body.updates || body.member || body) };

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

    // Larang override tier manual oleh selain SUPER_ADMIN | OWNER | MANAGER
    const isManualOverrideAttempt =
      (updates.tier && updates.tier !== target.tier) ||
      (Array.isArray(updates.tierHistory) &&
        updates.tierHistory.some(
          (th: any) =>
            th.isManualOverride &&
            !target.tierHistory?.some((tth) => tth.id === th.id)
        ));

    if (isManualOverrideAttempt && !canUserViewFullCustomerContacts(auth.role)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Akses ditolak: Hanya Owner, Super Admin, dan Manager yang dapat mengubah tier secara manual.",
        },
        { status: 403 }
      );
    }

    // Jangan pernah menimpa kontak asli di penyimpanan dengan teks yang mengandung *
    if (typeof updates.phone === "string" && updates.phone.includes("*")) {
      delete updates.phone;
    }
    if (typeof updates.email === "string" && updates.email.includes("*")) {
      delete updates.email;
    }
    if (typeof updates.identityNo === "string" && updates.identityNo.includes("*")) {
      delete updates.identityNo;
    }

    const platformSettings = await readSeededPersistentData<PlatformSettings>(
      "platform_settings.json",
      () => DEFAULT_PLATFORM_SETTINGS
    );

    const nextPoints =
      typeof updates.points === "number" ? updates.points : target.points;
    const mergedTierHistory = updates.tierHistory || target.tierHistory || [];

    const calculatedTier = resolveAuthoritativeMemberTier(
      {
        tier: updates.tier || target.tier,
        points: nextPoints,
        tierHistory: mergedTierHistory,
      },
      platformSettings.loyaltyTiers
    );

    const merged: LoyaltyMember = {
      ...target,
      ...updates,
      tier: calculatedTier,
      id,
    };

    const saved = await savePersistentLoyaltyMember(merged);

    return NextResponse.json({
      success: true,
      member: saved,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Gagal memperbarui data member loyalty.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role) {
      return NextResponse.json(
        { success: false, error: "Akses ditolak. Sesi login diperlukan." },
        { status: 401 }
      );
    }

    // Batasi DELETE hanya untuk SUPER_ADMIN | OWNER | MANAGER
    if (!canUserViewFullCustomerContacts(auth.role)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Akses ditolak: Hanya Owner, Super Admin, dan Manager yang dapat menghapus member.",
        },
        { status: 403 }
      );
    }

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
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Gagal menghapus data member loyalty.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
