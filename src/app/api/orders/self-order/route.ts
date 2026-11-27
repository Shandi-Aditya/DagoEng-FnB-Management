import { NextRequest, NextResponse } from "next/server";
import {
  getPersistentOrders,
  getPersistentProductsData,
  getPersistentQrisSession,
  isVerifiedQrisStatus,
  mutatePersistentOrders,
  readPersistentDomainState,
  readSeededPersistentData,
  savePersistentQrisSession,
  upsertOrderInList,
} from "@/lib/persistent-storage";
import { tenantsDomainSpec } from "@/lib/sync-domains/config-spec";
import {
  findBlockedOrderTenant,
  formatBlockedTenantError,
} from "@/lib/tenant-order-guard";
import { POS_PRODUCTS } from "@/features/pos/mock-data";
import { resolveProductModifierGroups } from "@/lib/pos-modifiers";
import { calculateOrderPricing } from "@/lib/promo";
import { resolvePosReceiptPublisher } from "@/lib/receipt-publisher";
import { resolveSelfOrderPaymentMethod } from "@/lib/self-order-policy";
import { calculateCartTaxAndService } from "@/lib/tax-breakdown";
import { validateOrderOperationalHours } from "@/lib/operating-hours";
import { OrderItemRecord, OrderRecord } from "@/types/order";
import { MasterProduct } from "@/types/product";
import { DEFAULT_PLATFORM_SETTINGS, PlatformSettings } from "@/types/settings";

export const dynamic = "force-dynamic";

const MAX_SELF_ORDER_POLL_IDS = 20;

function resolveAuthoritativeItemPrice(
  rawItem: Record<string, unknown>,
  catalogProduct: MasterProduct
): number {
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
    if (!rawOrder || !orderId) {
      return NextResponse.json(
        { error: "INVALID_SELF_ORDER: ID pesanan dan daftar item wajib diisi." },
        { status: 400 }
      );
    }

    if (rawOrder.paymentStatus !== undefined && rawOrder.paymentStatus !== "PENDING") {
      return NextResponse.json(
        { error: "FORBIDDEN: Pelanggan tidak dapat mengubah status pembayaran menjadi lunas." },
        { status: 403 }
      );
    }

    if (rawOrder.qrisVerification !== undefined && rawOrder.qrisVerification !== null) {
      return NextResponse.json(
        { error: "FORBIDDEN: Bukti verifikasi QRIS hanya dapat diproses oleh gateway atau staf." },
        { status: 403 }
      );
    }

    if (
      rawOrder.status !== undefined &&
      rawOrder.status !== "NEW" &&
      rawOrder.status !== "CANCELLED"
    ) {
      return NextResponse.json(
        { error: "FORBIDDEN: Status pesanan tersebut hanya dapat diatur oleh staf." },
        { status: 403 }
      );
    }

    const nowIso = new Date().toISOString();
    const isCancelRequest = rawOrder.status === "CANCELLED";

    if (isCancelRequest) {
      const cancelOutcome = await mutatePersistentOrders<
        | { ok: true; order: OrderRecord }
        | { ok: false; status: number; error: string }
      >((existingOrders) => {
        const existingOrder = existingOrders.find((o) => o.id === orderId);
        if (!existingOrder) {
          return {
            nextOrders: existingOrders,
            result: {
              ok: false,
              status: 404,
              error: `NOT_FOUND: Pesanan [${orderId}] tidak ditemukan.`,
            },
          };
        }
        if (
          existingOrder.status === "CANCELLED" ||
          existingOrder.paymentStatus === "REFUNDED" ||
          existingOrder.paymentStatus === "PAID"
        ) {
          return {
            nextOrders: existingOrders,
            result: {
              ok: false,
              status: 403,
              error:
                "FORBIDDEN: Pesanan yang sudah lunas, dibatalkan, atau di-refund tidak dapat diubah.",
            },
          };
        }

        const cancelledOrder: OrderRecord = {
          ...existingOrder,
          status: "CANCELLED",
          paymentStatus: "PENDING",
          statusHistory: [
            ...(existingOrder.statusHistory ?? []),
            {
              id: `h-cancel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              orderId,
              fromStatus: existingOrder.status,
              toStatus: "CANCELLED",
              timestamp: nowIso,
              actorName: existingOrder.customerName || "Pelanggan Meja",
              note: "Pesanan dibatalkan oleh pelanggan",
            },
          ],
        };
        const { nextOrders, savedOrder } = upsertOrderInList(existingOrders, cancelledOrder);
        return { nextOrders, result: { ok: true, order: savedOrder } };
      });

      if (!cancelOutcome.ok) {
        return NextResponse.json(
          { error: cancelOutcome.error },
          { status: cancelOutcome.status }
        );
      }
      return NextResponse.json({ success: true, order: cancelOutcome.order });
    }

    if (!Array.isArray(rawOrder.items) || rawOrder.items.length === 0) {
      return NextResponse.json(
        { error: "INVALID_SELF_ORDER: ID pesanan dan daftar item wajib diisi." },
        { status: 400 }
      );
    }

    const [catalogData, platformSettings] = await Promise.all([
      getPersistentProductsData(),
      readSeededPersistentData<PlatformSettings>(
        "platform_settings.json",
        () => DEFAULT_PLATFORM_SETTINGS
      ),
    ]);

    const methodResolution = resolveSelfOrderPaymentMethod(
      rawOrder.paymentMethod,
      platformSettings
    );
    if (!methodResolution.ok) {
      return NextResponse.json(
        { error: methodResolution.error, code: methodResolution.code },
        { status: methodResolution.status }
      );
    }

    const productById = new Map<string, MasterProduct>(
      catalogData.products.map((p) => [p.id, p])
    );

    for (const entry of rawOrder.items) {
      const itemObj =
        entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
      const productId =
        typeof itemObj.productId === "string" && itemObj.productId.trim()
          ? itemObj.productId.trim()
          : "";
      if (!productId || !productById.has(productId)) {
        return NextResponse.json(
          {
            error: "INVALID_PRODUCT: Menu tidak ditemukan di katalog resmi outlet.",
            code: "INVALID_PRODUCT",
          },
          { status: 400 }
        );
      }
    }

    const sanitizedItems: OrderItemRecord[] = rawOrder.items.map((entry: unknown, index: number) => {
      const itemObj =
        entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
      const productId = (itemObj.productId as string).trim();
      const catalogProduct = productById.get(productId)!;
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
        productId: catalogProduct.id,
        tenantId:
          catalogProduct.tenantId ||
          (typeof itemObj.tenantId === "string" && itemObj.tenantId.trim()
            ? itemObj.tenantId.trim()
            : undefined),
        productName: catalogProduct.name,
        quantity,
        unitPrice,
        notes: typeof itemObj.notes === "string" ? itemObj.notes : undefined,
        modifiers,
      };
    });

    const subtotal = sanitizedItems.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);

    const tenantsState = await readPersistentDomainState(tenantsDomainSpec);
    const blockedTenant = findBlockedOrderTenant(sanitizedItems, tenantsState.profiles);
    if (blockedTenant.blocked) {
      return NextResponse.json(
        {
          error: formatBlockedTenantError(blockedTenant),
          code: "TENANT_BLOCKED",
        },
        { status: 403 }
      );
    }

    const selfOrderTenantIds = Array.from(
      new Set(sanitizedItems.map((it) => it.tenantId).filter((t): t is string => Boolean(t)))
    );
    const hoursValidation = validateOrderOperationalHours(new Date(), {
      operationalHours: platformSettings.operationalHours,
      tenantOperations: platformSettings.tenantOperations,
      tenantIds: selfOrderTenantIds,
    });
    if (!hoursValidation.allowed) {
      return NextResponse.json(
        {
          error: `OPERATIONAL_HOURS_LOCK: Pemesanan mandiri tidak tersedia di luar jam operasional. ${hoursValidation.reason || "Layanan atau mitra sedang tutup."}`,
          code: "OPERATIONAL_HOURS_LOCKED",
        },
        { status: 403 }
      );
    }
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

    const paymentStatus = "PENDING" as const;
    const resolvedStatus = "NEW" as const;
    const paymentMethod = methodResolution.paymentMethod;

    const customerName =
      typeof rawOrder.customerName === "string" && rawOrder.customerName.trim()
        ? rawOrder.customerName.trim()
        : "Pelanggan Meja";
    const customerPhone =
      typeof rawOrder.customerPhone === "string" && rawOrder.customerPhone.trim()
        ? rawOrder.customerPhone.trim()
        : undefined;

    const statusHistory = [
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

    const outletName =
      typeof rawOrder.outletName === "string" && rawOrder.outletName.trim()
        ? rawOrder.outletName.trim()
        : "Singaraja";

    const publisher = resolvePosReceiptPublisher(sanitizedItems, { name: outletName });

    // Defer final sequential uniqueness to savePersistentOrder (locked under FILE_POS_ORDERS),
    // clearing any candidate that collides with another order's QRIS session.
    const rawCandidateOrderNumber =
      typeof rawOrder.orderNumber === "string" ? rawOrder.orderNumber.trim() : "";
    const existingQrisForCandidate = rawCandidateOrderNumber
      ? await getPersistentQrisSession(rawCandidateOrderNumber)
      : null;
    const candidateOrderNumber =
      existingQrisForCandidate && existingQrisForCandidate.orderId !== orderId
        ? ""
        : rawCandidateOrderNumber;

    const orderToSave: OrderRecord = {
      id: orderId,
      orderNumber: candidateOrderNumber,
      organizationId:
        typeof rawOrder.organizationId === "string" && rawOrder.organizationId.trim()
          ? rawOrder.organizationId.trim()
          : "org-dago-hub",
      outletId:
        typeof rawOrder.outletId === "string" && rawOrder.outletId.trim()
          ? rawOrder.outletId.trim()
          : "outlet-sgr",
      outletName,
      ...(publisher.tenantId ? { tenantId: publisher.tenantId } : {}),
      tableNumber:
        orderType === "TAKEAWAY"
          ? "TAKEAWAY"
          : typeof rawOrder.tableNumber === "string" && rawOrder.tableNumber.trim()
          ? rawOrder.tableNumber.trim()
          : "-",
      customerName,
      ...(customerPhone ? { customerPhone } : {}),
      orderType,
      status: resolvedStatus,
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
      targetServiceMinutes: 10,
      notes:
        typeof rawOrder.notes === "string" && rawOrder.notes.trim()
          ? rawOrder.notes.trim()
          : undefined,
      createdAt: nowIso,
      statusHistory,
    };

    const createOutcome = await mutatePersistentOrders<
      | { ok: true; order: OrderRecord }
      | { ok: false; status: number; error: string }
    >((existingOrders) => {
      const existingOrder = existingOrders.find((o) => o.id === orderId);
      if (existingOrder) {
        if (
          existingOrder.status === "CANCELLED" ||
          existingOrder.paymentStatus === "REFUNDED" ||
          existingOrder.paymentStatus === "PAID"
        ) {
          return {
            nextOrders: existingOrders,
            result: {
              ok: false,
              status: 403,
              error:
                "FORBIDDEN: Pesanan yang sudah lunas, dibatalkan, atau di-refund tidak dapat diubah.",
            },
          };
        }
        return {
          nextOrders: existingOrders,
          result: {
            ok: false,
            status: 403,
            error: "FORBIDDEN: Pesanan yang sudah dibuat tidak dapat diubah oleh pelanggan.",
          },
        };
      }

      const { nextOrders, savedOrder } = upsertOrderInList(existingOrders, orderToSave);
      return { nextOrders, result: { ok: true, order: savedOrder } };
    });

    if (!createOutcome.ok) {
      return NextResponse.json(
        { error: createOutcome.error },
        { status: createOutcome.status }
      );
    }
    const savedOrder = createOutcome.order;

    if (savedOrder.paymentMethod === "QRIS" && breakdown.total > 0) {
      const existingQrisSession = await getPersistentQrisSession(savedOrder.orderNumber);
      if (!existingQrisSession || !isVerifiedQrisStatus(existingQrisSession.status)) {
        await savePersistentQrisSession({
          orderId: savedOrder.id,
          invoiceNumber: savedOrder.orderNumber,
          expectedAmount: savedOrder.total,
          status: "PENDING",
          updatedAt: nowIso,
        });
      }
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
