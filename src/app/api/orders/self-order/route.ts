import { NextRequest, NextResponse } from "next/server";
import {
  claimQrisSessionForOrder,
  getPersistentOrders,
  getPersistentProductsData,
  readSeededPersistentData,
  savePersistentOrder,
  updatePersistentLoyaltyPoints,
} from "@/lib/persistent-storage";
import { POS_PRODUCTS } from "@/features/pos/mock-data";
import { resolveProductModifierGroups } from "@/lib/pos-modifiers";
import { calculateOrderPricing } from "@/lib/promo";
import { calculateCartTaxAndService } from "@/lib/tax-breakdown";
import { OrderItemRecord, OrderRecord, OrderStatus } from "@/types/order";
import { MasterProduct } from "@/types/product";
import { DEFAULT_PLATFORM_SETTINGS, PlatformSettings } from "@/types/settings";

export const dynamic = "force-dynamic";

const MAX_SELF_ORDER_POLL_IDS = 20;

const KITCHEN_STAGE_RANK: Record<OrderStatus, number> = {
  NEW: 0,
  CONFIRMED: 1,
  KITCHEN_RECEIVED: 2,
  COOKING: 3,
  READY: 4,
  SERVED: 5,
  COMPLETED: 6,
  CANCELLED: 7,
};

function resolveAuthoritativeItemPrice(
  rawItem: Record<string, unknown>,
  catalogProduct: MasterProduct | undefined
): number {
  if (!catalogProduct) {
    const fallback = Number(rawItem.unitPrice);
    return Number.isFinite(fallback) ? Math.max(0, Math.round(fallback)) : 0;
  }

  const basePrice = Math.max(0, Math.round(Number(catalogProduct.basePrice) || 0));
  const variants =
    catalogProduct.variants && catalogProduct.variants.length > 0
      ? catalogProduct.variants
      : POS_PRODUCTS.find((p) => p.id === catalogProduct.id)?.variants || [];
  const modifierGroups = resolveProductModifierGroups(catalogProduct);
  const modifierOptions = modifierGroups.flatMap((g) => g.options);

  const labels: string[] = [];
  if (typeof rawItem.variant === "string" && rawItem.variant.trim()) {
    labels.push(rawItem.variant.trim());
  }
  if (typeof rawItem.variantName === "string" && rawItem.variantName.trim()) {
    labels.push(rawItem.variantName.trim());
  }
  if (Array.isArray(rawItem.modifiers)) {
    for (const mod of rawItem.modifiers) {
      if (typeof mod === "string" && mod.trim()) {
        labels.push(mod.trim());
      }
    }
  }

  let variantAdjustment = 0;
  let variantMatched = false;
  let modifiersTotal = 0;
  const seenModifierNames = new Set<string>();

  for (const label of labels) {
    const lower = label.toLowerCase();
    if (!variantMatched) {
      const matchedVariant = variants.find((v) => v.name.trim().toLowerCase() === lower);
      if (matchedVariant) {
        variantAdjustment = Math.max(0, Math.round(Number(matchedVariant.priceAdjustment) || 0));
        variantMatched = true;
        continue;
      }
    }
    if (!seenModifierNames.has(lower)) {
      const matchedOption = modifierOptions.find((o) => o.name.trim().toLowerCase() === lower);
      if (matchedOption) {
        modifiersTotal += Math.max(0, Math.round(Number(matchedOption.price) || 0));
        seenModifierNames.add(lower);
      }
    }
  }

  return basePrice + variantAdjustment + modifiersTotal;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawIds = searchParams.get("ids") || "";
    const requestedIds = Array.from(
      new Set(
        rawIds
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      )
    ).slice(0, MAX_SELF_ORDER_POLL_IDS);

    if (requestedIds.length === 0) {
      return NextResponse.json({ orders: [] });
    }

    const idSet = new Set(requestedIds);
    const allOrders = await getPersistentOrders();
    const orders = allOrders.filter((order) => idSet.has(order.id));

    return NextResponse.json({ orders });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat status pesanan.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawOrder = (body?.order ?? body) as Record<string, unknown> | null;

    const orderId = typeof rawOrder?.id === "string" ? rawOrder.id.trim() : "";
    if (!rawOrder || !orderId || !Array.isArray(rawOrder.items) || rawOrder.items.length === 0) {
      return NextResponse.json(
        { error: "INVALID_SELF_ORDER: ID pesanan dan daftar item wajib diisi." },
        { status: 400 }
      );
    }

    const existingOrder = (await getPersistentOrders()).find((o) => o.id === orderId);
    if (existingOrder) {
      if (existingOrder.status === "CANCELLED" || existingOrder.paymentStatus === "REFUNDED") {
        return NextResponse.json(
          { error: "FORBIDDEN: Pesanan yang sudah dibatalkan atau di-refund tidak dapat diubah." },
          { status: 403 }
        );
      }
      if (existingOrder.paymentStatus === "PAID") {
        if (rawOrder.paymentStatus === "PAID") {
          return NextResponse.json({ success: true, order: existingOrder });
        }
        return NextResponse.json(
          { error: "FORBIDDEN: Pesanan yang sudah lunas tidak dapat diubah oleh tamu." },
          { status: 403 }
        );
      }
    }

    const [catalogData, platformSettings] = await Promise.all([
      getPersistentProductsData(),
      readSeededPersistentData<PlatformSettings>(
        "platform_settings.json",
        () => DEFAULT_PLATFORM_SETTINGS
      ),
    ]);

    const productById = new Map<string, MasterProduct>(
      catalogData.products.map((p) => [p.id, p])
    );

    const nowIso = new Date().toISOString();
    const sanitizedItems: OrderItemRecord[] = rawOrder.items.map((entry: unknown, index: number) => {
      const itemObj =
        entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
      const productId =
        typeof itemObj.productId === "string" && itemObj.productId.trim()
          ? itemObj.productId.trim()
          : undefined;
      const catalogProduct = productId ? productById.get(productId) : undefined;
      const rawQty = Number(itemObj.quantity);
      const quantity = Number.isFinite(rawQty) ? Math.max(1, Math.floor(rawQty)) : 1;
      const unitPrice = resolveAuthoritativeItemPrice(itemObj, catalogProduct);
      const modifiers = Array.isArray(itemObj.modifiers)
        ? itemObj.modifiers.filter((m): m is string => typeof m === "string")
        : undefined;

      return {
        id:
          typeof itemObj.id === "string" && itemObj.id.trim()
            ? itemObj.id.trim()
            : `it-${Date.now()}-${index}`,
        productId: catalogProduct?.id ?? productId,
        tenantId:
          catalogProduct?.tenantId ||
          (typeof itemObj.tenantId === "string" && itemObj.tenantId.trim()
            ? itemObj.tenantId.trim()
            : undefined),
        productName:
          catalogProduct?.name ||
          (typeof itemObj.productName === "string" && itemObj.productName.trim()
            ? itemObj.productName.trim()
            : "Menu"),
        quantity,
        unitPrice,
        notes: typeof itemObj.notes === "string" ? itemObj.notes : undefined,
        modifiers,
      };
    });

    const subtotal = sanitizedItems.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
    const orderType: OrderRecord["orderType"] =
      rawOrder.orderType === "TAKEAWAY" || rawOrder.orderType === "DELIVERY"
        ? rawOrder.orderType
        : "DINE_IN";

    const promoId =
      typeof rawOrder.promoId === "string" && rawOrder.promoId.trim()
        ? rawOrder.promoId.trim()
        : undefined;
    const matchedPromo = promoId
      ? (platformSettings.promos || []).find((p) => p.id === promoId || p.code === promoId)
      : undefined;

    const promoResult = matchedPromo
      ? calculateOrderPricing(
          sanitizedItems.map((it) => ({
            productId: it.productId,
            category: it.productId ? productById.get(it.productId)?.category : undefined,
            tenantId: it.tenantId,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
          })),
          matchedPromo,
          0
        )
      : null;
    const discountAmount = promoResult ? Math.max(0, Math.round(promoResult.discountAmount)) : 0;

    const isTaxEnabled = platformSettings.isTaxEnabled !== false;
    const taxRatePercent = isTaxEnabled
      ? Number(platformSettings.taxRatePercent ?? DEFAULT_PLATFORM_SETTINGS.taxRatePercent)
      : 0;
    const serviceChargePercent =
      orderType === "DINE_IN"
        ? Number(
            platformSettings.serviceChargePercent ?? DEFAULT_PLATFORM_SETTINGS.serviceChargePercent
          )
        : 0;

    const breakdown = calculateCartTaxAndService({
      subtotal,
      discount: discountAmount,
      taxRatePercent,
      serviceChargePercent,
      isTaxEnabled,
      orderType: orderType === "DINE_IN" ? "DINE_IN" : "TAKEAWAY",
    });

    const rawQris =
      rawOrder.qrisVerification && typeof rawOrder.qrisVerification === "object"
        ? (rawOrder.qrisVerification as Record<string, unknown>)
        : null;
    const qrisInvoiceNumber =
      (typeof rawQris?.invoiceNumber === "string" && rawQris.invoiceNumber.trim()) ||
      (typeof rawQris?.referenceNumber === "string" && rawQris.referenceNumber.trim()) ||
      "";

    let verifiedPaid = false;
    let verifiedQrisRecord: OrderRecord["qrisVerification"] | undefined;

    if (qrisInvoiceNumber) {
      const claim = await claimQrisSessionForOrder({
        invoiceNumber: qrisInvoiceNumber,
        orderId,
        amount: breakdown.total,
      });
      if (claim.ok) {
        verifiedPaid = true;
        verifiedQrisRecord = {
          type:
            claim.session.verificationMethod === "GATEWAY_WEBHOOK"
              ? "GATEWAY_WEBHOOK"
              : "SUPERVISOR_MANUAL",
          referenceNumber:
            (typeof rawQris?.referenceNumber === "string" && rawQris.referenceNumber.trim()) ||
            claim.session.rrn ||
            claim.session.transactionId ||
            claim.session.invoiceNumber,
          invoiceNumber: claim.session.invoiceNumber,
          verifiedAt: claim.session.verifiedAt || nowIso,
          note: typeof rawQris?.note === "string" ? rawQris.note : undefined,
        };
      }
    }

    const paymentStatus: OrderRecord["paymentStatus"] = verifiedPaid ? "PAID" : "PENDING";
    const resolvedStatus: OrderStatus = verifiedPaid
      ? existingOrder &&
        KITCHEN_STAGE_RANK[existingOrder.status] > KITCHEN_STAGE_RANK.CONFIRMED
        ? existingOrder.status
        : "CONFIRMED"
      : existingOrder
      ? existingOrder.status
      : "NEW";

    const rawMethod = rawOrder.paymentMethod;
    const paymentMethod: OrderRecord["paymentMethod"] = verifiedPaid
      ? "QRIS"
      : rawMethod === "CASH" || rawMethod === "QRIS"
      ? rawMethod
      : "QRIS";

    const customerName =
      typeof rawOrder.customerName === "string" && rawOrder.customerName.trim()
        ? rawOrder.customerName.trim()
        : existingOrder?.customerName || "Pelanggan Meja";
    const customerPhone =
      typeof rawOrder.customerPhone === "string" && rawOrder.customerPhone.trim()
        ? rawOrder.customerPhone.trim()
        : existingOrder?.customerPhone;

    const baseHistory = existingOrder?.statusHistory?.length
      ? existingOrder.statusHistory
      : [
          {
            id: `h-${Date.now()}`,
            orderId,
            fromStatus: null,
            toStatus: "NEW" as const,
            timestamp:
              typeof rawOrder.createdAt === "string" && rawOrder.createdAt
                ? rawOrder.createdAt
                : nowIso,
            actorName: customerName,
          },
        ];

    const statusHistory =
      verifiedPaid && !baseHistory.some((h) => h.toStatus === "CONFIRMED")
        ? [
            ...baseHistory,
            {
              id: `h-paid-${Date.now()}`,
              orderId,
              fromStatus: existingOrder?.status ?? ("NEW" as const),
              toStatus: "CONFIRMED" as const,
              timestamp: nowIso,
              actorName: customerName,
              note: "Pembayaran lunas via QRIS",
            },
          ]
        : baseHistory;

    const orderToSave: OrderRecord = {
      id: orderId,
      orderNumber:
        typeof rawOrder.orderNumber === "string" && rawOrder.orderNumber.trim()
          ? rawOrder.orderNumber.trim()
          : existingOrder?.orderNumber || `ORD-SELF-${Date.now().toString().slice(-6)}`,
      organizationId:
        typeof rawOrder.organizationId === "string" && rawOrder.organizationId.trim()
          ? rawOrder.organizationId.trim()
          : existingOrder?.organizationId || "org-dago-hub",
      outletId:
        typeof rawOrder.outletId === "string" && rawOrder.outletId.trim()
          ? rawOrder.outletId.trim()
          : existingOrder?.outletId || "outlet-sgr",
      outletName:
        typeof rawOrder.outletName === "string" && rawOrder.outletName.trim()
          ? rawOrder.outletName.trim()
          : existingOrder?.outletName || "Singaraja",
      tableNumber:
        orderType === "TAKEAWAY"
          ? "TAKEAWAY"
          : typeof rawOrder.tableNumber === "string" && rawOrder.tableNumber.trim()
          ? rawOrder.tableNumber.trim()
          : existingOrder?.tableNumber || "-",
      customerName,
      ...(customerPhone ? { customerPhone } : {}),
      orderType,
      status: resolvedStatus,
      ...(existingOrder?.tenantStatuses ? { tenantStatuses: existingOrder.tenantStatuses } : {}),
      items: sanitizedItems,
      subtotal: breakdown.subtotal,
      ...(discountAmount > 0 ? { discount: discountAmount, promoId } : {}),
      tax: breakdown.pb1,
      serviceCharge: breakdown.serviceCharge,
      taxRatePercent,
      serviceChargePercent,
      total: breakdown.total,
      paymentStatus,
      paymentMethod,
      ...(verifiedQrisRecord
        ? {
            qrisVerification: verifiedQrisRecord,
            paymentReference: verifiedQrisRecord.referenceNumber,
          }
        : {}),
      targetServiceMinutes: existingOrder?.targetServiceMinutes || 10,
      notes:
        typeof rawOrder.notes === "string" && rawOrder.notes.trim()
          ? rawOrder.notes.trim()
          : existingOrder?.notes,
      createdAt:
        existingOrder?.createdAt ||
        (typeof rawOrder.createdAt === "string" && rawOrder.createdAt ? rawOrder.createdAt : nowIso),
      ...(verifiedPaid ? { confirmedAt: existingOrder?.confirmedAt || nowIso } : {}),
      ...(existingOrder?.kitchenReceivedAt
        ? { kitchenReceivedAt: existingOrder.kitchenReceivedAt }
        : {}),
      ...(existingOrder?.cookingStartedAt
        ? { cookingStartedAt: existingOrder.cookingStartedAt }
        : {}),
      ...(existingOrder?.cookingFinishedAt
        ? { cookingFinishedAt: existingOrder.cookingFinishedAt }
        : {}),
      ...(existingOrder?.readyAt ? { readyAt: existingOrder.readyAt } : {}),
      ...(existingOrder?.servedAt ? { servedAt: existingOrder.servedAt } : {}),
      statusHistory,
    };

    const becomesPaid =
      verifiedPaid &&
      existingOrder?.paymentStatus !== "PAID" &&
      !existingOrder?.loyaltyPointsCredited;
    const loyaltyKey = (customerPhone || customerName).trim();
    const serverEarnedPoints = becomesPaid ? Math.floor(breakdown.total / 10000) : 0;
    const creditsLoyalty = Boolean(loyaltyKey) && serverEarnedPoints > 0;

    const savedOrder = await savePersistentOrder(
      creditsLoyalty ? { ...orderToSave, loyaltyPointsCredited: true } : orderToSave
    );

    if (creditsLoyalty) {
      await updatePersistentLoyaltyPoints(loyaltyKey, serverEarnedPoints, customerName, orderId);
    }

    return NextResponse.json({
      success: true,
      order: savedOrder,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menyimpan pesanan mandiri.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
