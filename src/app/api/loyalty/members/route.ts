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
import { LoyaltyMember, LoyaltyPointTransaction, LoyaltyTier } from "@/types/loyalty";
import { DEFAULT_PLATFORM_SETTINGS, PlatformSettings } from "@/types/settings";

export const dynamic = "force-dynamic";

function resolveTierForPoints(points: number, settings: PlatformSettings): LoyaltyTier {
  const tiers = settings.loyaltyTiers || DEFAULT_PLATFORM_SETTINGS.loyaltyTiers;
  if (points >= tiers.platinumMin) return "Platinum";
  if (points >= tiers.goldMin) return "Gold";
  if (points >= tiers.silverMin) return "Silver";
  return "Bronze";
}

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

    const hasManualOverride = member.tierHistory?.some((th) => th.isManualOverride);
    const nextTier = hasManualOverride
      ? member.tier
      : resolveTierForPoints(currentPoints, platformSettings);

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
    const points =
      typeof memberData.points === "number"
        ? memberData.points
        : memberData.initialPoints || 0;

    const member: LoyaltyMember = {
      id: memberData.id || existing?.id || `mem-${Date.now()}`,
      name: memberData.name.trim(),
      phone: memberData.phone.trim(),
      email: memberData.email || existing?.email || "",
      identityNo: memberData.identityNo || existing?.identityNo || "",
      tier: (memberData.tier as LoyaltyTier) || existing?.tier || "Bronze",
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
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Gagal memperbarui data member loyalty.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

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
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Gagal menghapus data member loyalty.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
