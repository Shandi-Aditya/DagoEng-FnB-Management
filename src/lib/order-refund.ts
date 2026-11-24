import { resolveAuthoritativeMemberTier } from "@/lib/loyalty-policy";
import { normalizeLoyaltyPhone } from "@/lib/master-data-defaults";
import {
  mutatePersistentLoyaltyMembers,
  mutatePersistentShifts,
  readSeededPersistentData,
  updatePersistentLoyaltyPoints,
} from "@/lib/persistent-storage";
import { SHARED_SUPERVISOR_PIN_LABEL } from "@/lib/qris-verification";
import { recordShiftRefundTransaction } from "@/lib/shift-management";
import type { ActivityLogEntry } from "@/types/audit";
import type { RoleSlug } from "@/types/auth";
import type {
  LoyaltyMember,
  LoyaltyPointTransaction,
  LoyaltyTierChangeLog,
} from "@/types/loyalty";
import type { OrderRecord } from "@/types/order";
import { DEFAULT_PLATFORM_SETTINGS, type PlatformSettings } from "@/types/settings";

export interface OrderRefundSideEffectsSummary {
  readonly refundMethod: "CASH";
  readonly bomRestored: boolean;
  readonly shiftRefundRecorded: boolean;
  readonly shiftId?: string;
  readonly loyaltyReversed: boolean;
  readonly pointsDeducted: number;
  readonly voucherPointsRestored: number;
  readonly memberId?: string;
  readonly updatedTier?: string;
}

export interface OrderAuditActor {
  readonly userId?: string | null;
  readonly name?: string | null;
  readonly email?: string | null;
  readonly role: RoleSlug;
}

export function validateRefundReason(params: {
  existingOrder: OrderRecord | undefined;
  orderData: OrderRecord;
  rawRefundReason: string | undefined;
  requirePinVerification: boolean;
}): { ok: true; requestsPaidRefund: boolean } | { ok: false; error: string } {
  const { existingOrder, orderData, rawRefundReason, requirePinVerification } = params;
  const requestsPaidRefund =
    existingOrder?.paymentStatus === "PAID" &&
    (orderData.paymentStatus === "REFUNDED" || orderData.status === "CANCELLED");
  const requestsExplicitRefund =
    orderData.paymentStatus === "REFUNDED" && existingOrder?.paymentStatus !== "REFUNDED";

  if (
    (requestsPaidRefund || requestsExplicitRefund) &&
    ((rawRefundReason !== undefined && rawRefundReason.trim() === "") ||
      (requirePinVerification && !(orderData.refundReason || "").trim()))
  ) {
    return {
      ok: false,
      error: "INVALID_REFUND_REASON: Alasan refund wajib diisi.",
    };
  }

  return { ok: true, requestsPaidRefund: Boolean(requestsPaidRefund) };
}

export function normalizeRefundTransition(params: {
  orderData: OrderRecord;
  verifiedSupervisorLabel?: string;
  actorFallback: string;
  nowIso: string;
}): OrderRecord {
  const { orderData, verifiedSupervisorLabel, actorFallback, nowIso } = params;
  return {
    ...orderData,
    status: "CANCELLED",
    paymentStatus: "REFUNDED",
    refundMethod: "CASH",
    refundedAt: orderData.refundedAt || nowIso,
    refundApprovedBy:
      (orderData.refundApprovedBy || "").trim() ||
      verifiedSupervisorLabel ||
      actorFallback,
    refundReason:
      (orderData.refundReason || orderData.voidReason || "").trim() ||
      "Refund disetujui supervisor",
  };
}

export function shouldApplyRefundEffects(params: {
  priorOrder: OrderRecord | undefined;
  savedOrder: OrderRecord;
  transitionsPaidToRefunded: boolean;
}): boolean {
  const { priorOrder, savedOrder, transitionsPaidToRefunded } = params;
  if (!priorOrder) return false;
  if (transitionsPaidToRefunded) return true;
  return (
    priorOrder.paymentStatus === "REFUNDED" &&
    savedOrder.paymentStatus === "REFUNDED" &&
    !savedOrder.loyaltyPointsReversed
  );
}

export function buildOrderReversalAuditEntry(params: {
  finalOrder: OrderRecord;
  priorOrder: OrderRecord | undefined;
  validatedTotal: number;
  auth: OrderAuditActor;
  refundEffects: OrderRefundSideEffectsSummary | null;
}): ActivityLogEntry {
  const { finalOrder, priorOrder, validatedTotal, auth, refundEffects } = params;
  const isRefund = finalOrder.paymentStatus === "REFUNDED";
  const isVoid = !isRefund && (finalOrder.status === "CANCELLED" || Boolean(finalOrder.voidReason));
  const auditAction = isRefund
    ? "REFUND_ORDER"
    : isVoid
    ? "VOID_ORDER"
    : "PAID_ORDER_CHANGED_BY_SUPERVISOR";
  const supervisorLabel = isRefund
    ? finalOrder.refundApprovedBy || auth.name || SHARED_SUPERVISOR_PIN_LABEL
    : isVoid
    ? finalOrder.voidApprovedBy || auth.name || SHARED_SUPERVISOR_PIN_LABEL
    : auth.name || auth.email || "Supervisor";
  const auditReason = isRefund
    ? finalOrder.refundReason || "Refund transaksi pelanggan"
    : isVoid
    ? finalOrder.voidReason || "Pembatalan (void) pesanan"
    : "Perubahan transaksi lunas oleh supervisor";
  const actorName = auth.name || auth.email || "Supervisor";

  return {
    id: `audit-order-reversal-${finalOrder.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    actorId: auth.userId || "unknown",
    actorName,
    actorRole: auth.role,
    role: auth.role,
    userId: auth.userId || "unknown",
    userName: actorName,
    userRole: auth.role,
    action: auditAction,
    module: "POS",
    recordId: finalOrder.orderNumber || finalOrder.id,
    referenceId: finalOrder.id,
    outletId: finalOrder.outletId,
    outletName: finalOrder.outletName,
    previousValue: `Status: ${priorOrder?.status || "-"}, Payment: ${priorOrder?.paymentStatus || "-"}, Total: Rp ${(priorOrder?.total ?? 0).toLocaleString("id-ID")}`,
    newValue: isRefund
      ? `Status: ${finalOrder.status}, Payment: ${finalOrder.paymentStatus} (via CASH), Total: Rp ${validatedTotal.toLocaleString("id-ID")}`
      : `Status: ${finalOrder.status}, Payment: ${finalOrder.paymentStatus}, Total: Rp ${validatedTotal.toLocaleString("id-ID")}`,
    description: isRefund
      ? `Refund transaksi ${finalOrder.orderNumber || finalOrder.id} sebesar Rp ${validatedTotal.toLocaleString("id-ID")} dikembalikan tunai. Disetujui: ${supervisorLabel}`
      : isVoid
      ? `Pembatalan (void) pesanan ${finalOrder.orderNumber || finalOrder.id}. Disetujui: ${supervisorLabel}`
      : `Transaksi lunas ${finalOrder.orderNumber || finalOrder.id} diubah supervisor: status ${finalOrder.paymentStatus}/${finalOrder.status}, total ${priorOrder?.total} -> ${validatedTotal}.`,
    reason: auditReason,
    status: "SUCCESS",
    severity: "HIGH",
    category: "TRANSACTION",
    metadata: {
      previousStatus: priorOrder?.status,
      previousPaymentStatus: priorOrder?.paymentStatus,
      previousTotal: priorOrder?.total,
      originalPaymentMethod: priorOrder?.paymentMethod,
      total: validatedTotal,
      paymentStatus: finalOrder.paymentStatus,
      status: finalOrder.status,
      supervisorApprovedBy: supervisorLabel,
      supervisorPinVerified: Boolean(finalOrder.supervisorPinVerified),
      ...(isRefund
        ? {
            refundMethod: "CASH",
            refundReason: finalOrder.refundReason || auditReason,
            bomRestored: Boolean(finalOrder.bomRestored),
            loyaltyReversed: Boolean(refundEffects?.loyaltyReversed),
            pointsDeducted: refundEffects?.pointsDeducted ?? 0,
            shiftRefundRecorded: Boolean(refundEffects?.shiftRefundRecorded),
          }
        : {}),
    },
  };
}

export function buildManualDiscountAuditEntry(params: {
  finalOrder: OrderRecord;
  validatedTotal: number;
  auth: OrderAuditActor;
}): ActivityLogEntry {
  const { finalOrder, validatedTotal, auth } = params;
  const discountActor =
    finalOrder.manualDiscountApprovedBy ||
    auth.name ||
    auth.email ||
    finalOrder.cashierName ||
    "Kasir POS";

  return {
    id: `audit-order-discount-${finalOrder.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    actorId: auth.userId || "unknown",
    actorName: discountActor,
    actorRole: auth.role,
    role: auth.role,
    userId: auth.userId || "unknown",
    userName: discountActor,
    userRole: auth.role,
    action: "APPLY_DISCOUNT",
    module: "POS",
    recordId: finalOrder.orderNumber || finalOrder.id,
    referenceId: finalOrder.id,
    outletId: finalOrder.outletId,
    outletName: finalOrder.outletName,
    previousValue: `Subtotal: Rp ${(finalOrder.subtotal ?? 0).toLocaleString("id-ID")}`,
    newValue: `Diskon manual: -Rp ${(finalOrder.discount ?? 0).toLocaleString("id-ID")} (Total: Rp ${validatedTotal.toLocaleString("id-ID")})`,
    description: `Diskon manual pada pesanan ${finalOrder.orderNumber || finalOrder.id} sebesar Rp ${(finalOrder.discount ?? 0).toLocaleString("id-ID")}.`,
    reason: finalOrder.manualDiscountReason || "Diskon manual kasir",
    status: "SUCCESS",
    severity: "MEDIUM",
    category: "TRANSACTION",
  };
}

function isGenericCustomerPlaceholder(cleanLowerName: string): boolean {
  if (!cleanLowerName) return true;
  if (
    cleanLowerName === "tamu" ||
    cleanLowerName === "walk-in guest" ||
    cleanLowerName === "pelanggan takeaway" ||
    cleanLowerName === "pelanggan kasir" ||
    cleanLowerName === "pelanggan meja"
  ) {
    return true;
  }
  return /^tamu\s+meja\b/i.test(cleanLowerName);
}

function findMatchingLoyaltyMember(
  members: readonly LoyaltyMember[],
  order: OrderRecord
): LoyaltyMember | undefined {
  if (order.loyaltyMemberId) {
    const byId = members.find((m) => m.id === order.loyaltyMemberId);
    if (byId) return byId;
  }

  if (order.customerPhone && !order.customerPhone.includes("*")) {
    const normPhone = normalizeLoyaltyPhone(order.customerPhone);
    if (normPhone) {
      const byPhone = members.find((m) => normalizeLoyaltyPhone(m.phone) === normPhone);
      if (byPhone) return byPhone;
    }
  }

  const byHistory = members.find(
    (m) =>
      Array.isArray(m.pointHistory) &&
      m.pointHistory.some((ptx) => ptx.relatedTransactionId === order.id)
  );
  if (byHistory) return byHistory;

  const cleanCustomerName = (order.customerName || "").trim().toLowerCase();
  if (cleanCustomerName && !isGenericCustomerPlaceholder(cleanCustomerName)) {
    return members.find((m) => m.name.trim().toLowerCase() === cleanCustomerName);
  }

  return undefined;
}

export async function applyPersistentOrderRefundEffects(params: {
  order: OrderRecord;
  priorOrder: OrderRecord;
  approvedBy: string;
  reason: string;
  nowIso: string;
  bomRestored: boolean;
}): Promise<OrderRefundSideEffectsSummary> {
  const { order, priorOrder, approvedBy, reason, nowIso, bomRestored } = params;

  const platformSettings = await readSeededPersistentData<PlatformSettings>(
    "platform_settings.json",
    () => DEFAULT_PLATFORM_SETTINGS
  );

  const loyaltyOutcome = await mutatePersistentLoyaltyMembers<{
    loyaltyReversed: boolean;
    pointsDeducted: number;
    voucherPointsRestored: number;
    memberId?: string;
    updatedTier?: string;
  }>(platformSettings.loyaltyTiers, (members) => {
    const matchedMember = findMatchingLoyaltyMember(members, order);
    if (!matchedMember) {
      return {
        nextMembers: members,
        result: {
          loyaltyReversed: Boolean(priorOrder.loyaltyPointsReversed),
          pointsDeducted: 0,
          voucherPointsRestored: 0,
        },
      };
    }

    const history = Array.isArray(matchedMember.pointHistory) ? matchedMember.pointHistory : [];
    const revEarnId = `rev-${order.id}`;
    const revRedeemId = `rev-redeem-${order.id}`;

    const alreadyHasRevEarn = history.some(
      (ptx) => ptx.id === revEarnId || ptx.relatedTransactionId === revEarnId
    );
    const alreadyHasRevRedeem = history.some(
      (ptx) => ptx.id === revRedeemId || ptx.relatedTransactionId === revRedeemId
    );

    const earnedPtx = history.find(
      (ptx) => ptx.type === "EARN" && ptx.relatedTransactionId === order.id && ptx.points > 0
    );
    const redeemPtx = history.find(
      (ptx) => ptx.type === "REDEEM" && ptx.relatedTransactionId === order.id && ptx.points < 0
    );

    const canReverseEarn = !alreadyHasRevEarn && Boolean(earnedPtx);
    const canReverseRedeem = !alreadyHasRevRedeem && Boolean(redeemPtx);
    const wasPreviouslyReversed =
      Boolean(priorOrder.loyaltyPointsReversed) || alreadyHasRevEarn || alreadyHasRevRedeem;

    if (!canReverseEarn && !canReverseRedeem) {
      return {
        nextMembers: members,
        result: {
          loyaltyReversed: wasPreviouslyReversed,
          pointsDeducted: 0,
          voucherPointsRestored: 0,
          memberId: matchedMember.id,
          updatedTier: matchedMember.tier,
        },
      };
    }

    const currentPoints = Number(matchedMember.points) || 0;
    const voucherPointsRestored = canReverseRedeem && redeemPtx ? Math.abs(redeemPtx.points) : 0;
    const pointsDeducted = canReverseEarn && earnedPtx ? Math.max(0, earnedPtx.points) : 0;
    const afterRedeemPoints = currentPoints + voucherPointsRestored;
    const nextPoints = Math.max(0, afterRedeemPoints - pointsDeducted);

    const appendedEntries: LoyaltyPointTransaction[] = [];
    if (canReverseEarn) {
      appendedEntries.push({
        id: revEarnId,
        memberId: matchedMember.id,
        type: "ADJUSTMENT",
        points: -pointsDeducted,
        balanceAfter: nextPoints,
        reason: `Refund pesanan #${order.orderNumber}: ${reason}`,
        relatedTransactionId: revEarnId,
        timestamp: nowIso,
        actorName: approvedBy,
        outletId: order.outletId || matchedMember.registeredOutletId,
      });
    }
    if (canReverseRedeem) {
      appendedEntries.push({
        id: revRedeemId,
        memberId: matchedMember.id,
        type: "ADJUSTMENT",
        points: voucherPointsRestored,
        balanceAfter: canReverseEarn ? afterRedeemPoints : nextPoints,
        reason: `Pengembalian poin voucher pesanan #${order.orderNumber}: ${reason}`,
        relatedTransactionId: revRedeemId,
        timestamp: nowIso,
        actorName: approvedBy,
        outletId: order.outletId || matchedMember.registeredOutletId,
      });
    }

    const nextSpend = wasPreviouslyReversed
      ? Number(matchedMember.totalSpend) || 0
      : Math.max(0, (Number(matchedMember.totalSpend) || 0) - (Number(order.total) || 0));
    const nextVisits = wasPreviouslyReversed
      ? Number(matchedMember.totalVisits) || 0
      : Math.max(0, (Number(matchedMember.totalVisits) || 0) - 1);

    const nextTier = resolveAuthoritativeMemberTier(
      {
        tier: matchedMember.tier,
        points: nextPoints,
        tierHistory: matchedMember.tierHistory,
      },
      platformSettings.loyaltyTiers
    );

    const existingTierHistory = Array.isArray(matchedMember.tierHistory)
      ? matchedMember.tierHistory
      : [];
    const nextTierHistory: LoyaltyTierChangeLog[] =
      nextTier !== matchedMember.tier
        ? [
            {
              id: `th-rev-${order.id}`,
              memberId: matchedMember.id,
              previousTier: matchedMember.tier,
              newTier: nextTier,
              pointsAtChange: nextPoints,
              reason: `Penyesuaian tier otomatis pasca refund #${order.orderNumber} (${nextPoints} poin)`,
              isManualOverride: false,
              actorName: approvedBy,
              timestamp: nowIso,
            },
            ...existingTierHistory,
          ]
        : existingTierHistory;

    const updatedMember: LoyaltyMember = {
      ...matchedMember,
      points: nextPoints,
      tier: nextTier,
      totalSpend: nextSpend,
      totalVisits: nextVisits,
      pointHistory: [...appendedEntries, ...history],
      tierHistory: nextTierHistory,
    };

    const normPhone = normalizeLoyaltyPhone(updatedMember.phone);
    const memberIdx = members.findIndex(
      (m) =>
        m.id === updatedMember.id ||
        (normPhone && normalizeLoyaltyPhone(m.phone) === normPhone)
    );
    const nextMembers =
      memberIdx >= 0
        ? members.map((m, idx) => (idx === memberIdx ? updatedMember : m))
        : [updatedMember, ...members];

    return {
      nextMembers,
      result: {
        loyaltyReversed: true,
        pointsDeducted,
        voucherPointsRestored,
        memberId: updatedMember.id,
        updatedTier: nextTier,
      },
    };
  });

  if (priorOrder.loyaltyPointsCredited || order.loyaltyPointsCredited) {
    const customerKey = (order.customerName || "").trim();
    const serverPointsDelta = -Math.floor((Number(order.total) || 0) / 10000);
    if (customerKey && serverPointsDelta < 0) {
      await updatePersistentLoyaltyPoints(
        customerKey,
        serverPointsDelta,
        order.customerName,
        `refund:${order.id}`
      );
    }
  }

  const shiftOutcome = await mutatePersistentShifts<{
    shiftRefundRecorded: boolean;
    shiftId?: string;
  }>((shifts) => {
    const outletActiveShift = shifts.find(
      (s) =>
        (s.status === "ACTIVE" || s.status === "OPEN") &&
        (!order.outletId || order.outletId === "ALL" || s.outletId === order.outletId)
    );
    const fallbackActiveShift =
      outletActiveShift ?? shifts.find((s) => s.status === "ACTIVE" || s.status === "OPEN");

    if (!fallbackActiveShift) {
      return { nextShifts: shifts, result: { shiftRefundRecorded: false } };
    }

    if (fallbackActiveShift.recordedRefundIds?.includes(order.id)) {
      return {
        nextShifts: shifts,
        result: { shiftRefundRecorded: true, shiftId: fallbackActiveShift.id },
      };
    }

    const shiftResult = recordShiftRefundTransaction({
      shifts,
      cashierId: fallbackActiveShift.assignedCashierId,
      shiftId: fallbackActiveShift.id,
      refundAmount: order.total,
      orderId: order.id,
      actorId: approvedBy,
      actorRole: "MANAGER",
    });

    if (!shiftResult.success || !shiftResult.shift) {
      return { nextShifts: shifts, result: { shiftRefundRecorded: false } };
    }

    return {
      nextShifts: shiftResult.updatedShifts,
      result: { shiftRefundRecorded: true, shiftId: shiftResult.shift.id },
    };
  });

  return {
    refundMethod: "CASH",
    bomRestored,
    shiftRefundRecorded: shiftOutcome.shiftRefundRecorded,
    shiftId: shiftOutcome.shiftId,
    loyaltyReversed: loyaltyOutcome.loyaltyReversed,
    pointsDeducted: loyaltyOutcome.pointsDeducted,
    voucherPointsRestored: loyaltyOutcome.voucherPointsRestored,
    memberId: loyaltyOutcome.memberId,
    updatedTier: loyaltyOutcome.updatedTier,
  };
}
