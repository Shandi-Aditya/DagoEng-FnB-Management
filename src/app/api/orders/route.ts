import { NextRequest, NextResponse } from "next/server";
import {
  getPersistentOrders,
  resetPersistentOrders,
  mutatePersistentOrders,
  updatePersistentOrderIf,
  upsertOrderInList,
  getPersistentLoyaltyPoints,
  updatePersistentLoyaltyPoints,
  claimQrisSessionForOrder,
  appendAuditLog,
  isOrderBeforeCooking,
  deductPersistentOrderBOM,
  restorePersistentOrderBOMIfBeforeCooking,
  readPersistentDomainState,
} from "@/lib/persistent-storage";
import { tenantsDomainSpec } from "@/lib/sync-domains/config-spec";
import {
  findBlockedOrderTenant,
  formatBlockedTenantError,
} from "@/lib/tenant-order-guard";
import {
  applyPersistentOrderRefundEffects,
  buildManualDiscountAuditEntry,
  buildOrderReversalAuditEntry,
  normalizeRefundTransition,
  shouldApplyRefundEffects,
  validateRefundReason,
  type OrderRefundSideEffectsSummary,
} from "@/lib/order-refund";
import {
  decideOrderWrite,
  LOYALTY_READ_ROLES,
  mergeTenantWorkflowStageUpdate,
  omitUndefinedProperties,
  ORDER_ACCESS_ROLES,
  ORDER_READ_ROLES,
  validateOrderPayload,
  validateOrderStateTransition,
  withoutClientOrderFields,
  withoutClientPatchFields,
} from "@/lib/order-write-policy";
import { getRequestAuthUser, type ServerAuthResult } from "@/lib/server-auth";
import {
  authorizeSupervisorQrisOverride,
  SHARED_SUPERVISOR_PIN_LABEL,
} from "@/lib/qris-verification";
import {
  filterOrdersByTenant,
  getOrderWorkflowTenants,
  normalizeTenantId,
  resolveNormalizedItemTenantId,
} from "@/features/orders/orders-domain";
import { OrderRecord } from "@/types/order";
import { RoleSlug } from "@/types/auth";

const QRIS_CLAIM_MESSAGES = {
  NOT_FOUND: "Sesi QRIS untuk invoice ini tidak ditemukan di server.",
  UNVERIFIED: "Pembayaran QRIS belum terverifikasi webhook atau supervisor.",
  AMOUNT_MISMATCH: "Nominal pembayaran QRIS tidak sama dengan total transaksi.",
  ALREADY_CONSUMED: "Pembayaran QRIS ini sudah dipakai untuk transaksi lain.",
} as const;

function payloadErrorResponse(failure: {
  error: string;
  details?: unknown;
}): NextResponse {
  return NextResponse.json(
    failure.details !== undefined
      ? { error: failure.error, details: failure.details }
      : { error: failure.error },
    { status: 400 }
  );
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role) {
      return NextResponse.json(
        { error: auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan." },
        { status: 401 }
      );
    }

    if (!ORDER_READ_ROLES.includes(auth.role)) {
      return NextResponse.json(
        { error: `FORBIDDEN: Role [${auth.role}] tidak diizinkan mengakses daftar transaksi POS.` },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get("outletId");
    const status = searchParams.get("status");
    const customerKey = searchParams.get("customerKey");

    let orders = await getPersistentOrders();
    if (outletId && outletId !== "ALL") {
      orders = orders.filter((o) => o.outletId === outletId);
    }

    const scopedTenantId =
      (auth.scopeLevel === "TENANT" || auth.role === "KITCHEN_STAFF") && auth.tenantId
        ? normalizeTenantId(auth.tenantId)
        : undefined;
    if (scopedTenantId) {
      orders = filterOrdersByTenant(orders, scopedTenantId, true);
    }

    if (status) {
      orders = orders.filter((o) => o.status === status || o.paymentStatus === status);
    }

    let loyaltyPoints = LOYALTY_READ_ROLES.includes(auth.role)
      ? await getPersistentLoyaltyPoints()
      : [];
    if (customerKey) {
      const normalized = customerKey.trim().toLowerCase();
      loyaltyPoints = loyaltyPoints.filter((l) => l.customerKey.toLowerCase() === normalized);
    }

    return NextResponse.json({ orders, loyaltyPoints });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat transaksi POS.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function authorizeOrderRouteWrite(req: NextRequest): Promise<
  | { ok: true; auth: ServerAuthResult & { role: RoleSlug } }
  | { ok: false; response: NextResponse }
> {
  const auth = await getRequestAuthUser(req);
  const { role } = auth;
  if (!auth.isAuthenticated || !role) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan." },
        { status: 401 }
      ),
    };
  }

  if (!ORDER_ACCESS_ROLES.includes(role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `FORBIDDEN: Role [${role}] tidak memiliki wewenang menyimpan transaksi POS.` },
        { status: 403 }
      ),
    };
  }

  return { ok: true, auth: { ...auth, role } };
}

type OrderWriteAction =
  | {
      mode: "UPSERT";
      initialOrderData: OrderRecord;
      rawRefundReason?: string;
    }
  | {
      mode: "PATCH";
      targetId: string;
      rawPatch: Partial<OrderRecord>;
      rawRefundReason?: string;
    }
  | {
      mode: "CANCEL_DELETE";
      targetId: string;
      voidReason: string;
    };

type OrderMutationOutcome =
  | { ok: false; response: NextResponse }
  | {
      ok: true;
      savedOrder: OrderRecord;
      priorOrder: OrderRecord | undefined;
      isNewInsert: boolean;
      transitionsPaidToRefunded: boolean;
      auditPaidChange: boolean;
      validatedTotal: number;
      isCancelOrRefund: boolean;
      shouldAttemptRestore: boolean;
      cancelReason: string;
      creditsLoyalty: boolean;
      customerKey: string;
      serverEarnedPoints: number;
    };

function buildOrderCandidateForWrite(
  action: OrderWriteAction,
  existingOrder: OrderRecord | undefined,
  auth: ServerAuthResult & { role: RoleSlug }
): { ok: true; orderData: OrderRecord } | { ok: false; response: NextResponse } {
  if (action.mode === "UPSERT") {
    return { ok: true, orderData: action.initialOrderData };
  }

  if (!existingOrder) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `NOT_FOUND: Pesanan [${action.targetId}] tidak ditemukan.` },
        { status: 404 }
      ),
    };
  }

  if (action.mode === "CANCEL_DELETE") {
    const nowIso = new Date().toISOString();
    const nextPaymentStatus =
      existingOrder.paymentStatus === "PAID"
        ? ("REFUNDED" as const)
        : existingOrder.paymentStatus;
    return {
      ok: true,
      orderData: {
        ...existingOrder,
        status: "CANCELLED",
        paymentStatus: nextPaymentStatus,
        voidReason: action.voidReason,
        voidedAt: existingOrder.voidedAt || nowIso,
        ...(nextPaymentStatus === "REFUNDED"
          ? {
              refundReason: existingOrder.refundReason || action.voidReason,
              refundedAt: existingOrder.refundedAt || nowIso,
            }
          : {}),
        statusHistory:
          existingOrder.status === "CANCELLED"
            ? existingOrder.statusHistory
            : [
                ...(existingOrder.statusHistory ?? []),
                {
                  id: `h-del-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  orderId: existingOrder.id,
                  fromStatus: existingOrder.status,
                  toStatus: "CANCELLED",
                  timestamp: nowIso,
                  actorId: auth.userId ?? undefined,
                  actorName: auth.name || auth.role,
                  note: action.voidReason,
                },
              ],
      },
    };
  }

  const mergedOrder: OrderRecord = {
    ...existingOrder,
    ...omitUndefinedProperties(action.rawPatch),
    id: existingOrder.id,
  };

  const rawHasHistory =
    Array.isArray(action.rawPatch.statusHistory) && action.rawPatch.statusHistory.length > 0;
  if (!rawHasHistory && mergedOrder.status && mergedOrder.status !== existingOrder.status) {
    const nowIso = new Date().toISOString();
    mergedOrder.statusHistory = [
      ...(existingOrder.statusHistory ?? []),
      {
        id: `h-patch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        orderId: existingOrder.id,
        fromStatus: existingOrder.status,
        toStatus: mergedOrder.status,
        timestamp: nowIso,
        actorId: auth.userId ?? undefined,
        actorName: auth.name || auth.role,
        note:
          mergedOrder.status === "CANCELLED"
            ? mergedOrder.voidReason || mergedOrder.refundReason || "Pesanan dibatalkan"
            : `Status diubah menjadi ${mergedOrder.status}`,
      },
    ];
  }

  return { ok: true, orderData: mergedOrder };
}

async function executeAuthorizedOrderWrite(params: {
  auth: ServerAuthResult & { role: RoleSlug };
  action: OrderWriteAction;
  supervisorPin: string;
  requirePinVerification?: boolean;
}): Promise<NextResponse> {
  const { auth, action, supervisorPin, requirePinVerification } = params;

  if (action.mode === "UPSERT") {
    const preValidation = validateOrderPayload(action.initialOrderData);
    if (!preValidation.ok) return payloadErrorResponse(preValidation);
  }

  const scopedTenantId =
    (auth.scopeLevel === "TENANT" || auth.role === "KITCHEN_STAFF") && auth.tenantId
      ? normalizeTenantId(auth.tenantId)
      : undefined;

  const tenantsState = await readPersistentDomainState(tenantsDomainSpec);

  const outcome = await mutatePersistentOrders<OrderMutationOutcome>(async (existingOrders) => {
    const targetId =
      action.mode === "UPSERT" ? action.initialOrderData.id : action.targetId;
    const existingOrder = existingOrders.find((o) => o.id === targetId);

    const candidate = buildOrderCandidateForWrite(action, existingOrder, auth);
    if (!candidate.ok) {
      return { nextOrders: existingOrders, result: candidate };
    }

    let orderData = candidate.orderData;
    const isCancelOrRefundAttempt =
      orderData.status === "CANCELLED" || orderData.paymentStatus === "REFUNDED";
    const isWorkflowProgressionOnPaidOrder = existingOrder?.paymentStatus === "PAID";
    if (!isCancelOrRefundAttempt && !isWorkflowProgressionOnPaidOrder) {
      const blockedTenant = findBlockedOrderTenant(
        orderData.items,
        tenantsState.profiles,
        orderData.tenantId
      );
      if (blockedTenant.blocked) {
        return {
          nextOrders: existingOrders,
          result: {
            ok: false,
            response: NextResponse.json(
              { error: formatBlockedTenantError(blockedTenant) },
              { status: 403 }
            ),
          },
        };
      }
    }
    const validation = validateOrderPayload(orderData);
    if (!validation.ok) {
      return {
        nextOrders: existingOrders,
        result: { ok: false, response: payloadErrorResponse(validation) },
      };
    }
    const validatedTotal = validation.total;

    const transitionCheck = validateOrderStateTransition(existingOrder, orderData);
    if (!transitionCheck.ok) {
      return {
        nextOrders: existingOrders,
        result: {
          ok: false,
          response: NextResponse.json(
            { error: transitionCheck.error },
            { status: transitionCheck.status }
          ),
        },
      };
    }

    if (existingOrder && scopedTenantId) {
      const orderFallback = existingOrder.tenantId;
      const allExistingTenants = Array.from(
        new Set(
          existingOrder.items.map((it) => resolveNormalizedItemTenantId(it, orderFallback))
        )
      );
      if (!allExistingTenants.includes(scopedTenantId)) {
        return {
          nextOrders: existingOrders,
          result: {
            ok: false,
            response: NextResponse.json(
              { error: "FORBIDDEN: Pesanan ini tidak memiliki item untuk tenant Anda." },
              { status: 403 }
            ),
          },
        };
      }

      const requestsReversal =
        orderData.status === "CANCELLED" ||
        orderData.paymentStatus === "REFUNDED" ||
        Boolean(orderData.voidReason);
      if (allExistingTenants.length > 1 && requestsReversal) {
        return {
          nextOrders: existingOrders,
          result: {
            ok: false,
            response: NextResponse.json(
              {
                error:
                  "FORBIDDEN: Pembatalan atau refund pesanan multi-mitra harus diproses oleh kasir atau supervisor hub.",
              },
              { status: 403 }
            ),
          },
        };
      }

      const existingTenants = getOrderWorkflowTenants(existingOrder.items, orderFallback);

      const isClosed =
        existingOrder.status === "CANCELLED" || existingOrder.paymentStatus === "REFUNDED";
      const explicitTenantStage =
        action.mode === "PATCH"
          ? action.rawPatch.tenantStatuses?.[scopedTenantId] ?? action.rawPatch.status
          : action.mode === "UPSERT"
          ? action.initialOrderData.tenantStatuses?.[scopedTenantId] ??
            action.initialOrderData.status
          : orderData.status;
      if (existingTenants.length > 1) {
        if (!isClosed) {
          orderData = mergeTenantWorkflowStageUpdate(
            existingOrder,
            orderData,
            scopedTenantId,
            explicitTenantStage
          );
        }
      } else if (!isClosed && !requestsReversal && (orderData.tenantStatuses || existingOrder.tenantStatuses)) {
        const scopedStage = explicitTenantStage || orderData.tenantStatuses?.[scopedTenantId];
        orderData = {
          ...orderData,
          ...(scopedStage ? { status: scopedStage } : {}),
          tenantStatuses: {
            ...(existingOrder.tenantStatuses || {}),
            ...(scopedStage ? { [scopedTenantId]: scopedStage } : {}),
          },
        };
      }
    }

    if (existingOrder) {
      orderData = {
        ...orderData,
        confirmedAt: existingOrder.confirmedAt || orderData.confirmedAt,
        kitchenReceivedAt: existingOrder.kitchenReceivedAt || orderData.kitchenReceivedAt,
        cookingStartedAt: existingOrder.cookingStartedAt || orderData.cookingStartedAt,
        cookingFinishedAt: existingOrder.cookingFinishedAt || orderData.cookingFinishedAt,
        readyAt: existingOrder.readyAt || orderData.readyAt,
        servedAt: existingOrder.servedAt || orderData.servedAt,
        completedAt: existingOrder.completedAt || orderData.completedAt,
        ...(existingOrder.supervisorPinVerified === true
          ? { supervisorPinVerified: true }
          : {}),
      };
      if (existingOrder.paymentStatus === "REFUNDED") {
        orderData = {
          ...orderData,
          paymentStatus: "REFUNDED",
          status: "CANCELLED",
          refundMethod: "CASH",
          refundReason: existingOrder.refundReason || orderData.refundReason,
          refundApprovedBy: existingOrder.refundApprovedBy || orderData.refundApprovedBy,
          refundedAt: existingOrder.refundedAt || orderData.refundedAt,
        };
      }
    }

    const hasCookingStage =
      orderData.status === "COOKING" ||
      Object.values(orderData.tenantStatuses ?? {}).some((stage) => stage === "COOKING");
    if (hasCookingStage && !orderData.cookingStartedAt) {
      orderData = { ...orderData, cookingStartedAt: new Date().toISOString() };
    }

    const rawRefundReason =
      action.mode === "PATCH" || action.mode === "UPSERT"
        ? action.rawRefundReason
        : undefined;
    const reasonCheck = validateRefundReason({
      existingOrder,
      orderData,
      rawRefundReason,
      requirePinVerification: Boolean(requirePinVerification),
    });
    if (!reasonCheck.ok) {
      return {
        nextOrders: existingOrders,
        result: {
          ok: false,
          response: NextResponse.json({ error: reasonCheck.error }, { status: 400 }),
        },
      };
    }

    const decision = decideOrderWrite(
      auth.role,
      auth.scopeLevel,
      existingOrder,
      orderData,
      Boolean(supervisorPin)
    );
    if (!decision.allowed) {
      return {
        nextOrders: existingOrders,
        result: {
          ok: false,
          response: NextResponse.json(
            { error: decision.error },
            { status: decision.status || 403 }
          ),
        },
      };
    }

    const isClosedBeforeWrite =
      existingOrder?.status === "CANCELLED" || existingOrder?.paymentStatus === "REFUNDED";
    const isRefundOrVoidWrite = Boolean(
      existingOrder &&
        (!isClosedBeforeWrite || requirePinVerification || supervisorPin.length > 0) &&
        (orderData.status === "CANCELLED" ||
          orderData.paymentStatus === "REFUNDED" ||
          Boolean(orderData.voidReason))
    );
    const mustVerifySupervisorPin =
      decision.requiresPinCheck ||
      (isRefundOrVoidWrite && (Boolean(requirePinVerification) || supervisorPin.length > 0));

    let verifiedSupervisorLabel: string | undefined;
    if (mustVerifySupervisorPin) {
      if (!supervisorPin) {
        return {
          nextOrders: existingOrders,
          result: {
            ok: false,
            response: NextResponse.json(
              {
                error:
                  "FORBIDDEN: SUPERVISOR_PIN_REQUIRED: Refund atau pembatalan pesanan wajib diotorisasi dengan PIN Manager/Owner.",
              },
              { status: 403 }
            ),
          },
        };
      }
      const pinCheck = authorizeSupervisorQrisOverride({
        pin: supervisorPin,
        referenceNumber: (orderData.orderNumber || orderData.id || "ORDER").padEnd(4, "0"),
        actorKey: auth.userId || auth.role,
      });
      if (!pinCheck.allowed) {
        const message =
          pinCheck.statusCode === 403
            ? "FORBIDDEN: INVALID_SUPERVISOR_PIN: PIN Supervisor tidak valid. Otorisasi pembatalan atau refund pesanan ditolak."
            : pinCheck.error;
        return {
          nextOrders: existingOrders,
          result: {
            ok: false,
            response: NextResponse.json(
              { error: message },
              { status: pinCheck.statusCode || 403 }
            ),
          },
        };
      }
      verifiedSupervisorLabel = SHARED_SUPERVISOR_PIN_LABEL;
      orderData = {
        ...orderData,
        supervisorPinVerified: true,
      };
    }

    // A PAID QRIS order must consume exactly one verified QRIS session, identified by its gateway invoice number.
    const alreadySettledByThisPayment =
      existingOrder?.paymentStatus === "PAID" &&
      existingOrder.paymentMethod === "QRIS" &&
      existingOrder.total === orderData.total &&
      existingOrder.qrisVerification?.invoiceNumber === orderData.qrisVerification?.invoiceNumber;
    if (
      orderData.paymentMethod === "QRIS" &&
      orderData.paymentStatus === "PAID" &&
      !alreadySettledByThisPayment
    ) {
      const qrisInvoiceNumber = orderData.qrisVerification?.invoiceNumber?.trim();
      const claim = qrisInvoiceNumber
        ? await claimQrisSessionForOrder({
            invoiceNumber: qrisInvoiceNumber,
            orderId: orderData.id,
            amount: validatedTotal,
          })
        : ({ ok: false, reason: "NOT_FOUND" } as const);

      if (!claim.ok) {
        return {
          nextOrders: existingOrders,
          result: {
            ok: false,
            response: NextResponse.json(
              {
                error: `QRIS_PAYMENT_UNVERIFIED [${claim.reason}]: ${QRIS_CLAIM_MESSAGES[claim.reason]}`,
              },
              { status: 409 }
            ),
          },
        };
      }
    }

    const reversalNowIso = new Date().toISOString();
    if (reasonCheck.requestsPaidRefund) {
      orderData = normalizeRefundTransition({
        orderData,
        verifiedSupervisorLabel,
        actorFallback: auth.name || auth.role,
        nowIso: reversalNowIso,
      });
    } else if (
      existingOrder &&
      !isClosedBeforeWrite &&
      orderData.status === "CANCELLED" &&
      orderData.paymentStatus !== "REFUNDED"
    ) {
      orderData = {
        ...orderData,
        voidedAt: orderData.voidedAt || reversalNowIso,
        voidApprovedBy:
          (orderData.voidApprovedBy || "").trim() ||
          verifiedSupervisorLabel ||
          auth.name ||
          auth.role,
      };
    }

    const isCancelOrRefund =
      orderData.status === "CANCELLED" || orderData.paymentStatus === "REFUNDED";
    const shouldAttemptRestore = Boolean(
      existingOrder && isCancelOrRefund && isOrderBeforeCooking(existingOrder)
    );
    const cancelReason =
      orderData.refundReason ||
      orderData.voidReason ||
      (orderData.paymentStatus === "REFUNDED"
        ? "Refund transaksi pelanggan"
        : "Pembatalan (void) pesanan");

    // Loyalty is earned once, when an order first becomes PAID, by the customer named on that order.
    const becomesPaid =
      orderData.paymentStatus === "PAID" &&
      orderData.status !== "CANCELLED" &&
      existingOrder?.paymentStatus !== "PAID" &&
      !existingOrder?.loyaltyPointsCredited;
    const customerKey = String(orderData.customerName || "").trim();
    const serverEarnedPoints = becomesPaid ? Math.floor(validatedTotal / 10000) : 0;
    const creditsLoyalty = Boolean(customerKey) && serverEarnedPoints > 0;

    const orderToPersist = creditsLoyalty
      ? { ...orderData, loyaltyPointsCredited: true }
      : orderData;
    const { nextOrders, savedOrder } = upsertOrderInList(existingOrders, orderToPersist);

    return {
      nextOrders,
      result: {
        ok: true,
        savedOrder,
        priorOrder: existingOrder,
        isNewInsert: !existingOrder,
        transitionsPaidToRefunded: reasonCheck.requestsPaidRefund,
        auditPaidChange: decision.auditPaidChange,
        validatedTotal,
        isCancelOrRefund,
        shouldAttemptRestore,
        cancelReason,
        creditsLoyalty,
        customerKey,
        serverEarnedPoints,
      },
    };
  });

  if (!outcome.ok) return outcome.response;

  const {
    savedOrder,
    priorOrder,
    isNewInsert,
    transitionsPaidToRefunded,
    auditPaidChange,
    validatedTotal,
    isCancelOrRefund,
    shouldAttemptRestore,
    cancelReason,
    creditsLoyalty,
    customerKey,
    serverEarnedPoints,
  } = outcome;

  let bomRestoration: { restored: boolean; reason: string; restoredItems: number } | null = null;
  if (priorOrder && isCancelOrRefund) {
    if (shouldAttemptRestore) {
      bomRestoration = await restorePersistentOrderBOMIfBeforeCooking(priorOrder, {
        reason: cancelReason,
      });
    } else {
      bomRestoration = {
        restored: false,
        reason: "already-cooking-or-beyond",
        restoredItems: 0,
      };
    }
  }

  let refundEffects: OrderRefundSideEffectsSummary | null = null;
  if (
    priorOrder &&
    shouldApplyRefundEffects({
      priorOrder,
      savedOrder,
      transitionsPaidToRefunded,
    })
  ) {
    refundEffects = await applyPersistentOrderRefundEffects({
      order: savedOrder,
      priorOrder,
      approvedBy: savedOrder.refundApprovedBy || auth.name || auth.role,
      reason: savedOrder.refundReason || cancelReason,
      nowIso: savedOrder.refundedAt || new Date().toISOString(),
      bomRestored: Boolean(bomRestoration?.restored || savedOrder.bomRestored),
    });
    if (refundEffects.loyaltyReversed && !savedOrder.loyaltyPointsReversed) {
      await updatePersistentOrderIf(
        savedOrder.id,
        (current) => !current.loyaltyPointsReversed,
        (current) => ({ ...current, loyaltyPointsReversed: true })
      );
    }
  }

  let bomDeduction: { applied: boolean; deductedItems: number } | null = null;
  const isCorporateInvoiceOrder =
    savedOrder.paymentMethod === "INVOICE" ||
    savedOrder.corporateInfo?.billingType === "INVOICE";
  if (
    (savedOrder.paymentStatus === "PAID" || isCorporateInvoiceOrder) &&
    savedOrder.status !== "CANCELLED" &&
    !savedOrder.bomDeducted
  ) {
    bomDeduction = await deductPersistentOrderBOM(savedOrder, {
      reason: isCorporateInvoiceOrder
        ? "POS Corporate Invoice Order Confirmation"
        : "POS Server Order Settlement",
    });
  }

  const finalOrder: OrderRecord =
    (await getPersistentOrders()).find((o) => o.id === savedOrder.id) ?? {
      ...savedOrder,
      ...(bomDeduction?.applied ? { bomDeducted: true } : {}),
      ...(bomRestoration?.restored ? { bomRestored: true } : {}),
      ...(refundEffects?.loyaltyReversed ? { loyaltyPointsReversed: true } : {}),
    };

  if (auditPaidChange) {
    await appendAuditLog(
      buildOrderReversalAuditEntry({
        finalOrder,
        priorOrder,
        validatedTotal,
        auth,
        refundEffects,
      })
    );
  }

  if (isNewInsert && finalOrder.discountSource === "MANUAL" && (finalOrder.discount ?? 0) > 0) {
    await appendAuditLog(
      buildManualDiscountAuditEntry({
        finalOrder,
        validatedTotal,
        auth,
      })
    );
  }

  const loyaltyRecord = creditsLoyalty
    ? await updatePersistentLoyaltyPoints(customerKey, serverEarnedPoints, finalOrder.customerName, finalOrder.id)
    : null;

  return NextResponse.json({
    success: true,
    order: finalOrder,
    loyaltyRecord,
    ...(bomDeduction ? { bomDeduction } : {}),
    ...(bomRestoration ? { bomRestoration } : {}),
    ...(refundEffects ? { refundEffects } : {}),
  });
}

export async function POST(req: NextRequest) {
  try {
    const authCheck = await authorizeOrderRouteWrite(req);
    if (!authCheck.ok) return authCheck.response;

    const requirePinVerification = req.headers.get("x-require-supervisor-pin") === "1";
    const body = await req.json();
    const rawOrderSource = body.order || body;
    const supervisorPin = (
      typeof body.supervisorPin === "string"
        ? body.supervisorPin
        : req.headers.get("x-supervisor-pin") || ""
    ).trim();
    const orderData: OrderRecord = withoutClientOrderFields(rawOrderSource);
    const rawRefundReason =
      typeof rawOrderSource?.refundReason === "string"
        ? rawOrderSource.refundReason
        : undefined;

    if (!orderData || !orderData.id) {
      return NextResponse.json(
        { error: "Order payload with valid id is required." },
        { status: 400 }
      );
    }

    return await executeAuthorizedOrderWrite({
      auth: authCheck.auth,
      action: {
        mode: "UPSERT",
        initialOrderData: orderData,
        rawRefundReason,
      },
      supervisorPin,
      requirePinVerification,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menyimpan transaksi POS.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  return POST(req);
}

export async function PATCH(req: NextRequest) {
  try {
    const authCheck = await authorizeOrderRouteWrite(req);
    if (!authCheck.ok) return authCheck.response;

    const requirePinVerification = req.headers.get("x-require-supervisor-pin") === "1";
    const body = await req.json().catch(() => ({}));
    const rawOrderSource = body?.order || body || {};
    const supervisorPin = (
      typeof body?.supervisorPin === "string"
        ? body.supervisorPin
        : req.headers.get("x-supervisor-pin") || ""
    ).trim();
    const rawPatch = withoutClientPatchFields(rawOrderSource);
    const targetId = String(rawPatch?.id || body?.orderId || "").trim();
    const rawRefundReason =
      typeof rawOrderSource?.refundReason === "string"
        ? rawOrderSource.refundReason
        : undefined;

    if (!targetId) {
      return NextResponse.json(
        { error: "Order payload with valid id is required." },
        { status: 400 }
      );
    }

    return await executeAuthorizedOrderWrite({
      auth: authCheck.auth,
      action: {
        mode: "PATCH",
        targetId,
        rawPatch,
        rawRefundReason,
      },
      supervisorPin,
      requirePinVerification,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memperbarui transaksi POS.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    const { role } = auth;
    if (!auth.isAuthenticated || !role) {
      return NextResponse.json(
        { error: auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const action = searchParams.get("action") || (typeof body?.action === "string" ? body.action : undefined);
    const targetId =
      searchParams.get("id") ||
      searchParams.get("orderId") ||
      (typeof body?.id === "string" ? body.id : undefined) ||
      (typeof body?.orderId === "string" ? body.orderId : undefined);

    if (targetId && action !== "RESET") {
      if (!ORDER_ACCESS_ROLES.includes(role)) {
        return NextResponse.json(
          { error: `FORBIDDEN: Role [${role}] tidak memiliki wewenang membatalkan transaksi POS.` },
          { status: 403 }
        );
      }

      const requirePinVerification = req.headers.get("x-require-supervisor-pin") === "1";
      const supervisorPin = (
        typeof body?.supervisorPin === "string"
          ? body.supervisorPin
          : req.headers.get("x-supervisor-pin") || ""
      ).trim();
      const voidReason =
        (typeof body?.voidReason === "string" && body.voidReason.trim()) ||
        searchParams.get("reason") ||
        "Dibatalkan via DELETE /api/orders";

      return await executeAuthorizedOrderWrite({
        auth: { ...auth, role },
        action: { mode: "CANCEL_DELETE", targetId: targetId.trim(), voidReason },
        supervisorPin,
        requirePinVerification,
      });
    }

    const canResetOrders =
      role === "SUPER_ADMIN" ||
      (role === "OWNER" && auth.scopeLevel !== "TENANT");
    if (!canResetOrders) {
      return NextResponse.json(
        {
          error: `FORBIDDEN: Role [${role}] tidak diizinkan mereset data transaksi POS.`,
        },
        { status: 403 }
      );
    }

    const previousCount = (await getPersistentOrders()).length;
    await resetPersistentOrders();

    const actorName = auth.name || auth.email || "Admin";
    await appendAuditLog({
      id: `audit-orders-reset-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: auth.userId || "unknown",
      actorName,
      actorRole: role,
      role,
      userId: auth.userId || "unknown",
      userName: actorName,
      userRole: role,
      action: "RESET_ORDERS",
      module: "POS",
      recordId: "pos_orders",
      referenceId: "pos_orders",
      previousValue: `${previousCount} transaksi`,
      newValue: "0 transaksi",
      description: `Reset seluruh data transaksi POS (${previousCount} pesanan dihapus).`,
      reason: "Reset data operasional POS oleh Super Admin / Hub Owner",
      status: "WARNING",
      severity: "HIGH",
      category: "CONFIGURATION",
    });

    return NextResponse.json({
      success: true,
      orders: [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mereset data transaksi POS.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
