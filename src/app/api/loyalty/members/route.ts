import { NextRequest, NextResponse } from "next/server";
import {
  deletePersistentLoyaltyMember,
  getCoworkingBookings,
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
import { RoleSlug } from "@/types/auth";
import {
  canUserViewFullCustomerContacts,
  resolveAuthoritativeMemberTier,
  sanitizeMemberForRole,
} from "@/lib/loyalty-policy";

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

  if (members.length === 0) {
    return [];
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
      const normalizedTier = resolveAuthoritativeMemberTier(
        member,
        platformSettings.loyaltyTiers
      );
      if (member.tier !== normalizedTier) {
        const normalizedMember: LoyaltyMember = { ...member, tier: normalizedTier };
        await savePersistentLoyaltyMember(normalizedMember, platformSettings.loyaltyTiers);
        result.push(normalizedMember);
      } else {
        result.push(member);
      }
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

    const nextTier = resolveAuthoritativeMemberTier(
      {
        tier: member.tier,
        points: currentPoints,
        tierHistory: member.tierHistory,
      },
      platformSettings.loyaltyTiers
    );

    const hasTierChange = member.tier !== nextTier;

    if (!mutated && !hasTierChange) {
      result.push(member);
      continue;
    }

    const reconciled: LoyaltyMember = {
      ...member,
      points: currentPoints,
      tier: nextTier,
      totalSpend: currentSpend,
      totalVisits: currentVisits,
      pointHistory: history,
    };

    const saved = await savePersistentLoyaltyMember(reconciled, platformSettings.loyaltyTiers);
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

    const ALLOWED_LOYALTY_GET_ROLES: RoleSlug[] = [
      "SUPER_ADMIN",
      "OWNER",
      "MANAGER",
      "CASHIER",
      "CUSTOMER",
    ];

    if (!ALLOWED_LOYALTY_GET_ROLES.includes(auth.role)) {
      return NextResponse.json(
        {
          success: false,
          error: `Akses ditolak: Role [${auth.role}] tidak memiliki izin untuk mengakses data member loyalty.`,
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone");
    const outletId = searchParams.get("outletId");
    const tier = searchParams.get("tier");
    const status = searchParams.get("status");

    const platformSettings = await readSeededPersistentData<PlatformSettings>(
      "platform_settings.json",
      () => DEFAULT_PLATFORM_SETTINGS
    );
    const storedMembers = await getPersistentLoyaltyMembers(platformSettings.loyaltyTiers);
    let members = await reconcileMembersWithServerLoyaltyPoints(storedMembers);

    if (phone) {
      // Query raw phone number is strictly restricted to managerial roles
      if (!canUserViewFullCustomerContacts(auth.role, auth.scopeLevel)) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Akses ditolak: Pencarian langsung berdasarkan nomor telepon hanya diizinkan untuk Manager, Owner, atau Super Admin.",
          },
          { status: 403 }
        );
      }
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

    // Role-based visibility: CUSTOMER only ever sees their own member profile
    if (auth.role === "CUSTOMER") {
      const sessionEmail = auth.email?.toLowerCase().trim();
      const sessionUserId = auth.userId?.trim();
      members = members.filter((m) => {
        if (sessionEmail && m.email && m.email.toLowerCase().trim() === sessionEmail) {
          return true;
        }
        if (sessionUserId && (m.id === sessionUserId || (m as { metadata?: { userId?: string } }).metadata?.userId === sessionUserId)) {
          return true;
        }
        return false;
      });
    }

    const sanitizedMembers = members.map((m) =>
      sanitizeMemberForRole(m, auth.role, auth.scopeLevel, { isSelf: auth.role === "CUSTOMER" })
    );

    return NextResponse.json({
      success: true,
      members: sanitizedMembers,
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

    const allowedPostRoles = ["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER"];
    if (!allowedPostRoles.includes(auth.role)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Akses ditolak: Pendaftaran member loyalty hanya dapat dilakukan oleh Staf Kasir atau Manajemen.",
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const memberData = body.member || body;

    if (
      !memberData ||
      typeof memberData.name !== "string" ||
      !memberData.name.trim() ||
      typeof memberData.phone !== "string" ||
      !memberData.phone.trim()
    ) {
      return NextResponse.json(
        { success: false, error: "Nama dan nomor telepon member wajib diisi." },
        { status: 400 }
      );
    }

    if (memberData.phone.includes("*")) {
      return NextResponse.json(
        {
          success: false,
          error: "Nomor telepon tidak valid atau mengandung karakter tersamarkan (*).",
        },
        { status: 400 }
      );
    }

    const platformSettings = await readSeededPersistentData<PlatformSettings>(
      "platform_settings.json",
      () => DEFAULT_PLATFORM_SETTINGS
    );

    const normPhone = normalizeLoyaltyPhone(memberData.phone);
    const existingList = await getPersistentLoyaltyMembers(platformSettings.loyaltyTiers);
    const existing = existingList.find(
      (m) => normalizeLoyaltyPhone(m.phone) === normPhone
    );

    const isManagerial = canUserViewFullCustomerContacts(auth.role, auth.scopeLevel);

    // If existing member found:
    // Non-managerial callers (CASHIER, TENANT OWNER) are strictly forbidden from overwriting points, tier, or using allowUpdate
    if (existing && (!isManagerial || !memberData.allowUpdate)) {
      return NextResponse.json({
        success: true,
        member: sanitizeMemberForRole(existing, auth.role, auth.scopeLevel),
        isExisting: true,
      });
    }

    const nowIso = new Date().toISOString();

    // Set points = 0 and tierHistory = [] for non-managerial callers
    const points = isManagerial
      ? (typeof memberData.points === "number" ? memberData.points : memberData.initialPoints || 0)
      : 0;

    const tierHistory = isManagerial
      ? (memberData.tierHistory || existing?.tierHistory || [])
      : [];

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
        tier: isManagerial ? memberData.tier : undefined,
        points,
        tierHistory,
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
      pointHistory: isManagerial ? (memberData.pointHistory || existing?.pointHistory || []) : [],
      tierHistory,
    };

    const saved = await savePersistentLoyaltyMember(member, platformSettings.loyaltyTiers);

    return NextResponse.json({
      success: true,
      member: sanitizeMemberForRole(saved, auth.role, auth.scopeLevel),
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

    const allowedPutRoles = ["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER"];
    if (!allowedPutRoles.includes(auth.role)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Akses ditolak: Pembaruan data member loyalty hanya dapat dilakukan oleh Staf Kasir atau Manajemen.",
        },
        { status: 403 }
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

    const platformSettings = await readSeededPersistentData<PlatformSettings>(
      "platform_settings.json",
      () => DEFAULT_PLATFORM_SETTINGS
    );

    const existingList = await getPersistentLoyaltyMembers(platformSettings.loyaltyTiers);
    const target = existingList.find((m) => m.id === id);

    if (!target) {
      return NextResponse.json(
        { success: false, error: `Member dengan ID [${id}] tidak ditemukan.` },
        { status: 404 }
      );
    }

    if (updates.points !== undefined) {
      if (
        typeof updates.points !== "number" ||
        !Number.isFinite(updates.points) ||
        updates.points < 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Nilai poin tidak valid. Harus berupa angka non-negatif yang valid.",
          },
          { status: 400 }
        );
      }
    }

    const isManagerial = canUserViewFullCustomerContacts(auth.role, auth.scopeLevel);
    const existingPointHistory = Array.isArray(target.pointHistory) ? target.pointHistory : [];

    // Validate updates.pointHistory suffix for non-managerial callers (CASHIER)
    if (!isManagerial && updates.pointHistory !== undefined) {
      if (
        !Array.isArray(updates.pointHistory) ||
        updates.pointHistory.length < existingPointHistory.length
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Akses ditolak: Riwayat transaksi poin tidak boleh dikurangi atau dihapus oleh kasir.",
          },
          { status: 403 }
        );
      }

      const suffixStart = updates.pointHistory.length - existingPointHistory.length;
      const suffixEntries = updates.pointHistory.slice(suffixStart) as unknown[];
      const tamperedExistingHistory = existingPointHistory.some((orig, idx) => {
        const cand = suffixEntries[idx];
        if (!cand || typeof cand !== "object" || Array.isArray(cand)) return true;
        const c = cand as Record<string, unknown>;
        return (
          c.id !== orig.id ||
          c.type !== orig.type ||
          c.points !== orig.points ||
          c.relatedTransactionId !== orig.relatedTransactionId ||
          c.timestamp !== orig.timestamp
        );
      });

      if (tamperedExistingHistory) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Akses ditolak: Riwayat transaksi poin lama tidak boleh diubah oleh kasir.",
          },
          { status: 403 }
        );
      }
    }

    const hasPointChange = updates.points !== undefined && updates.points !== target.points;
    const hasAddedPointHistory =
      Array.isArray(updates.pointHistory) &&
      updates.pointHistory.length > existingPointHistory.length;

    // Validate updates.points and new pointHistory entries for non-managerial callers (CASHIER)
    if (!isManagerial && (hasPointChange || hasAddedPointHistory)) {
      if (!Array.isArray(updates.pointHistory) || updates.pointHistory.length <= existingPointHistory.length) {
        return NextResponse.json(
          {
            success: false,
            error: "Akses ditolak: Perubahan poin oleh kasir wajib menyertakan riwayat transaksi poin yang sah.",
          },
          { status: 403 }
        );
      }

      const addedCount = updates.pointHistory.length - existingPointHistory.length;
      const addedEntries = updates.pointHistory.slice(0, addedCount) as unknown[];
      const [orders, coworkingBookings] = await Promise.all([
        getPersistentOrders(),
        getCoworkingBookings(),
      ]);

      const seenHistoryKeys = new Set<string>();
      for (const orig of existingPointHistory) {
        const origTxId =
          typeof orig.relatedTransactionId === "string"
            ? orig.relatedTransactionId.trim()
            : "";
        if (origTxId) {
          seenHistoryKeys.add(`${orig.type}:${origTxId}`);
        }
      }

      const deltaPoints = updates.points !== undefined ? updates.points - target.points : 0;
      let totalAddedPoints = 0;

      for (const rawEntry of addedEntries) {
        if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) {
          return NextResponse.json(
            { success: false, error: "Akses ditolak: Entri riwayat poin tidak valid." },
            { status: 403 }
          );
        }

        const entry = rawEntry as Record<string, unknown>;
        if (entry.type !== "EARN" && entry.type !== "REDEEM" && entry.type !== "ADJUSTMENT") {
          return NextResponse.json(
            {
              success: false,
              error: `Akses ditolak: Tipe mutasi poin [${String(entry.type)}] tidak diizinkan untuk kasir.`,
            },
            { status: 403 }
          );
        }

        if (typeof entry.points !== "number" || !Number.isFinite(entry.points)) {
          return NextResponse.json(
            { success: false, error: "Akses ditolak: Nilai poin entri riwayat tidak valid." },
            { status: 403 }
          );
        }
        const entryPoints = entry.points;

        const rawRelatedTxId =
          typeof entry.relatedTransactionId === "string" ? entry.relatedTransactionId : "";
        const relatedTxId = rawRelatedTxId.trim();
        if (!relatedTxId) {
          return NextResponse.json(
            {
              success: false,
              error: "Akses ditolak: Setiap mutasi poin kasir wajib memiliki relatedTransactionId yang sah.",
            },
            { status: 403 }
          );
        }

        const dedupKey = `${entry.type}:${relatedTxId}`;
        if (seenHistoryKeys.has(dedupKey)) {
          return NextResponse.json(
            {
              success: false,
              error: `Akses ditolak: Transaksi poin (${entry.type}, ${relatedTxId}) sudah tercatat dan tidak dapat diputar ulang.`,
            },
            { status: 403 }
          );
        }
        seenHistoryKeys.add(dedupKey);

        if (entry.type === "ADJUSTMENT") {
          const isRedeemReversal = relatedTxId.startsWith("rev-redeem-");
          const isEarnReversal = !isRedeemReversal && relatedTxId.startsWith("rev-");
          if (rawRelatedTxId !== relatedTxId || (!isRedeemReversal && !isEarnReversal)) {
            return NextResponse.json(
              {
                success: false,
                error:
                  "Akses ditolak: Penyesuaian poin (ADJUSTMENT) oleh kasir hanya diizinkan untuk pembalikan transaksi rev- yang sah.",
              },
              { status: 403 }
            );
          }

          const txId = isRedeemReversal
            ? relatedTxId.slice("rev-redeem-".length)
            : relatedTxId.slice("rev-".length);
          if (!txId) {
            return NextResponse.json(
              {
                success: false,
                error: "Akses ditolak: ID pesanan pembalikan poin tidak valid.",
              },
              { status: 403 }
            );
          }

          const cancelledOrRefundedOrder = orders.find(
            (o) =>
              (o.id === txId || o.orderNumber === txId) &&
              (o.status === "CANCELLED" || o.paymentStatus === "REFUNDED")
          );
          const cancelledBooking = !cancelledOrRefundedOrder
            ? coworkingBookings.find(
                (b) =>
                  (b.id === txId || b.bookingCode === txId) &&
                  b.checkInStatus === "CANCELLED"
              )
            : undefined;
          if (!cancelledOrRefundedOrder && !cancelledBooking) {
            return NextResponse.json(
              {
                success: false,
                error: `Akses ditolak: Transaksi [${txId}] tidak ditemukan atau belum berstatus CANCELLED/REFUNDED.`,
              },
              { status: 403 }
            );
          }

          const alreadyReversed = existingPointHistory.some(
            (h) => h.relatedTransactionId === relatedTxId
          );
          if (isRedeemReversal) {
            const priorRedeem = existingPointHistory.find(
              (h) => h.type === "REDEEM" && h.relatedTransactionId === txId
            );
            if (!priorRedeem || alreadyReversed || entryPoints !== Math.abs(priorRedeem.points)) {
              return NextResponse.json(
                {
                  success: false,
                  error:
                    "Akses ditolak: Pengembalian poin voucher ADJUSTMENT tidak cocok dengan riwayat REDEEM asal atau sudah pernah dikembalikan.",
                },
                { status: 403 }
              );
            }
          } else {
            const priorEarn = existingPointHistory.find(
              (h) => h.type === "EARN" && h.relatedTransactionId === txId
            );
            if (!priorEarn || alreadyReversed || entryPoints !== -priorEarn.points) {
              return NextResponse.json(
                {
                  success: false,
                  error:
                    "Akses ditolak: Pembalikan poin ADJUSTMENT tidak cocok dengan riwayat EARN asal atau sudah pernah dibalik.",
                },
                { status: 403 }
              );
            }
          }
        } else {
          const matchingOrder = orders.find(
            (o) =>
              (o.id === relatedTxId || o.orderNumber === relatedTxId) &&
              o.paymentStatus === "PAID" &&
              o.status !== "CANCELLED"
          );
          const matchingBooking = !matchingOrder
            ? coworkingBookings.find(
                (b) =>
                  (b.id === relatedTxId || b.bookingCode === relatedTxId) &&
                  b.paymentStatus === "PAID" &&
                  b.checkInStatus !== "CANCELLED"
              )
            : undefined;

          if (!matchingOrder && !matchingBooking) {
            return NextResponse.json(
              {
                success: false,
                error: `Akses ditolak: Transaksi [${relatedTxId}] tidak ditemukan, belum berstatus PAID, atau telah dibatalkan.`,
              },
              { status: 403 }
            );
          }

          const transactionAmount = matchingOrder
            ? Number(matchingOrder.total) || 0
            : Number(matchingBooking?.totalAmount ?? matchingBooking?.price) || 0;

          if (entry.type === "EARN") {
            const maxAllowedEarn = Math.floor(transactionAmount / 1000);
            const allowZeroPointEarn =
              deltaPoints === 0 && maxAllowedEarn === 0 && addedEntries.length === 1;
            if (
              entryPoints < 0 ||
              (!allowZeroPointEarn && entryPoints === 0) ||
              entryPoints > maxAllowedEarn
            ) {
              return NextResponse.json(
                {
                  success: false,
                  error: `Akses ditolak: Poin EARN [${entryPoints}] melebihi batas maksimal transaksi [${maxAllowedEarn}].`,
                },
                { status: 403 }
              );
            }
          } else if (entryPoints >= 0) {
            return NextResponse.json(
              {
                success: false,
                error: "Akses ditolak: Poin REDEEM harus bernilai negatif.",
              },
              { status: 403 }
            );
          }
        }

        totalAddedPoints += entryPoints;
      }

      if (totalAddedPoints !== deltaPoints) {
        return NextResponse.json(
          {
            success: false,
            error: `Akses ditolak: Jumlah mutasi poin riwayat (${totalAddedPoints}) tidak sesuai dengan perubahan total (${deltaPoints}).`,
          },
          { status: 403 }
        );
      }
    }

    const nextPoints =
      updates.points !== undefined ? updates.points : target.points;

    const expectedCurrentTier = resolveAuthoritativeMemberTier(
      target,
      platformSettings.loyaltyTiers
    );
    const expectedNextTier = resolveAuthoritativeMemberTier(
      {
        tier: target.tier,
        points: nextPoints,
        tierHistory: target.tierHistory,
      },
      platformSettings.loyaltyTiers
    );
    const isLatestManualOverride =
      target.tierHistory?.[0]?.isManualOverride === true;

    // Validate updates.tierHistory for non-managerial callers (CASHIER)
    let hasTierHistoryTampering = false;
    if (!isManagerial && updates.tierHistory !== undefined) {
      const existingHistory = Array.isArray(target.tierHistory) ? target.tierHistory : [];
      if (!Array.isArray(updates.tierHistory)) {
        hasTierHistoryTampering = true;
      } else if (updates.tierHistory.length < existingHistory.length) {
        hasTierHistoryTampering = true;
      } else {
        const addedCount = updates.tierHistory.length - existingHistory.length;
        const addedEntries = updates.tierHistory.slice(0, addedCount);
        const suffixEntries = updates.tierHistory.slice(addedCount);
        const existingIds = new Set(existingHistory.map((e) => e.id));

        const invalidAdded = addedEntries.some(
          (entry: any) =>
            !entry ||
            typeof entry !== "object" ||
            entry.isManualOverride === true ||
            (typeof entry.id === "string" && existingIds.has(entry.id))
        );

        const tamperedExisting = existingHistory.some((orig, idx) => {
          const cand = suffixEntries[idx];
          if (!cand || typeof cand !== "object") return true;
          return (
            cand.id !== orig.id ||
            cand.memberId !== orig.memberId ||
            cand.previousTier !== orig.previousTier ||
            cand.newTier !== orig.newTier ||
            cand.pointsAtChange !== orig.pointsAtChange ||
            Boolean(cand.isManualOverride) !== Boolean(orig.isManualOverride) ||
            cand.reason !== orig.reason ||
            cand.actorName !== orig.actorName ||
            cand.timestamp !== orig.timestamp
          );
        });

        hasTierHistoryTampering = invalidAdded || tamperedExisting;
      }
    }

    const isExplicitTierDrift =
      Boolean(updates.tier) &&
      updates.tier !== expectedNextTier &&
      updates.tier !== expectedCurrentTier &&
      updates.tier !== target.tier;

    if ((hasTierHistoryTampering || isExplicitTierDrift) && !isManagerial) {
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

    if (!isManagerial) {
      delete updates.identityNo;
      if (
        updates.phone === null ||
        (typeof updates.phone === "string" && updates.phone.trim() === "") ||
        (updates.phone !== undefined && typeof updates.phone !== "string")
      ) {
        delete updates.phone;
      }
      if (
        updates.email === null ||
        (typeof updates.email === "string" && updates.email.trim() === "") ||
        (updates.email !== undefined && typeof updates.email !== "string")
      ) {
        delete updates.email;
      }
    }

    const mergedTierHistory = updates.tierHistory || target.tierHistory || [];

    const calculatedTier = resolveAuthoritativeMemberTier(
      {
        tier: isManagerial
          ? updates.tier || target.tier
          : isLatestManualOverride
          ? target.tier
          : expectedNextTier,
        points: nextPoints,
        tierHistory: mergedTierHistory,
      },
      platformSettings.loyaltyTiers
    );

    const merged: LoyaltyMember = {
      ...target,
      ...updates,
      points: nextPoints,
      tier: calculatedTier,
      id,
    };

    const saved = await savePersistentLoyaltyMember(
      merged,
      platformSettings.loyaltyTiers
    );

    return NextResponse.json({
      success: true,
      member: sanitizeMemberForRole(saved, auth.role, auth.scopeLevel),
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

    // Batasi DELETE hanya untuk SUPER_ADMIN | Hub OWNER | MANAGER
    if (!canUserViewFullCustomerContacts(auth.role, auth.scopeLevel)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Akses ditolak: Hanya Owner, Super Admin, dan Manager Hub yang dapat menghapus member.",
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
