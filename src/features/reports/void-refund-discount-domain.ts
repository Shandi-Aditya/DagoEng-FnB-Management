import { filterOrdersByTenant, paymentMethodLabel } from "@/features/orders/orders-domain";
import type { ActivityLogEntry } from "@/types/audit";
import type { OrderRecord } from "@/types/order";
import type { ReportDataset } from "./reports-domain";

type AdjustmentKind = "REFUND" | "VOID" | "MANUAL_DISCOUNT";

interface AdjustmentEntry {
  readonly kind: AdjustmentKind;
  readonly orderNumber: string;
  readonly timestamp: string;
  readonly kindLabel: "Refund" | "Void" | "Diskon manual";
  readonly methodLabel: string;
  readonly amount: number;
  readonly isQrisOrigin: boolean;
  readonly impactLabel: string;
  readonly reason: string;
  readonly authorizedBy: string;
}

function formatRp(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
}

function formatWitaDateTimeCell(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Makassar",
  });
}

function scopeOrdersIfNeeded(
  orders: readonly OrderRecord[],
  tenantId?: string
): OrderRecord[] {
  if (!tenantId || tenantId === "ALL") {
    return [...orders];
  }
  return filterOrdersByTenant([...orders], tenantId, true);
}

function isManualDiscountOrder(
  order: OrderRecord,
  matchingLog: ActivityLogEntry | undefined
): boolean {
  if (order.paymentStatus !== "PAID" || order.status === "CANCELLED" || Boolean(order.refundedAt)) {
    return false;
  }
  if (order.syncStatus === "REJECTED") return false;
  if ((Number(order.discount) || 0) <= 0) return false;

  if (order.discountSource !== undefined) {
    return order.discountSource === "MANUAL";
  }

  if (order.promoId || order.voucherTitle) {
    return false;
  }

  if (matchingLog && /^voucher\b/i.test((matchingLog.reason || "").trim())) {
    return false;
  }

  return true;
}

function collectVoidRefundDiscountEntries(params: {
  orders: readonly OrderRecord[];
  logs?: readonly ActivityLogEntry[];
  tenantId?: string;
  isTimestampInRange?: (isoTimestamp: string) => boolean;
}): AdjustmentEntry[] {
  const { orders, logs = [], tenantId, isTimestampInRange } = params;
  const scopedOrders = scopeOrdersIfNeeded(orders, tenantId);
  const entries: AdjustmentEntry[] = [];

  for (const order of scopedOrders) {
    if (order.syncStatus === "REJECTED") continue;

    if (order.paymentStatus === "REFUNDED") {
      const eventTimestamp = order.refundedAt || order.createdAt;
      if (isTimestampInRange && !isTimestampInRange(eventTimestamp)) continue;

      const amount = Math.max(0, Math.round(Number(order.total) || 0));
      const isQris = order.paymentMethod === "QRIS";
      const methodLabel = isQris
        ? "QRIS ke tunai"
        : `${paymentMethodLabel(order.paymentMethod || "CASH")} ke tunai`;
      const impactLabel = `${order.bomRestored ? "Stok kembali" : "Limbah dapur"}${
        order.loyaltyPointsReversed ? " · Poin ditarik" : ""
      }`;

      entries.push({
        kind: "REFUND",
        orderNumber: order.orderNumber || order.id,
        timestamp: eventTimestamp,
        kindLabel: "Refund",
        methodLabel,
        amount,
        isQrisOrigin: isQris,
        impactLabel,
        reason: (order.refundReason || "").trim() || "-",
        authorizedBy: (order.refundApprovedBy || order.cashierName || "").trim() || "-",
      });
      continue;
    }

    if (order.status === "CANCELLED") {
      const eventTimestamp = order.voidedAt || order.createdAt;
      if (isTimestampInRange && !isTimestampInRange(eventTimestamp)) continue;

      const amount = Math.max(0, Math.round(Number(order.total) || 0));
      entries.push({
        kind: "VOID",
        orderNumber: order.orderNumber || order.id,
        timestamp: eventTimestamp,
        kindLabel: "Void",
        methodLabel: "Belum bayar",
        amount,
        isQrisOrigin: false,
        impactLabel: order.bomRestored ? "Stok kembali" : "Stok tidak terpotong",
        reason: (order.voidReason || "").trim() || "-",
        authorizedBy: (order.voidApprovedBy || order.cashierName || "").trim() || "-",
      });
      continue;
    }

    const matchingLog = logs.find(
      (l) =>
        l.action === "APPLY_DISCOUNT" &&
        (l.recordId === order.orderNumber || l.referenceId === order.id)
    );

    if (isManualDiscountOrder(order, matchingLog)) {
      const eventTimestamp = order.confirmedAt || order.createdAt;
      if (isTimestampInRange && !isTimestampInRange(eventTimestamp)) continue;

      const discountAmount = Math.max(0, Math.round(Number(order.discount) || 0));
      entries.push({
        kind: "MANUAL_DISCOUNT",
        orderNumber: order.orderNumber || order.id,
        timestamp: eventTimestamp,
        kindLabel: "Diskon manual",
        methodLabel: paymentMethodLabel(order.paymentMethod),
        amount: discountAmount,
        isQrisOrigin: false,
        impactLabel: "Mengurangi penjualan bersih",
        reason:
          (order.manualDiscountReason || matchingLog?.reason || "").trim() ||
          "Diskon manual kasir",
        authorizedBy:
          (
            order.manualDiscountApprovedBy ||
            matchingLog?.userName ||
            matchingLog?.actorName ||
            order.cashierName ||
            ""
          ).trim() || "-",
      });
    }
  }

  entries.sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0));
  return entries;
}

export function countVoidRefundDiscountEntries(params: {
  orders: readonly OrderRecord[];
  logs?: readonly ActivityLogEntry[];
  tenantId?: string;
  isTimestampInRange?: (isoTimestamp: string) => boolean;
}): number {
  return collectVoidRefundDiscountEntries(params).length;
}

export function buildVoidRefundDiscountReport(params: {
  orders: readonly OrderRecord[];
  logs?: readonly ActivityLogEntry[];
  scopeName: string;
  tenantId?: string;
  isTimestampInRange?: (isoTimestamp: string) => boolean;
}): ReportDataset {
  const { scopeName } = params;
  const entries = collectVoidRefundDiscountEntries(params);

  let totalRefundAmount = 0;
  let refundCount = 0;
  let qrisRefundCount = 0;
  let totalVoidAmount = 0;
  let voidCount = 0;
  let totalManualDiscountAmount = 0;
  let manualDiscountCount = 0;

  for (const entry of entries) {
    switch (entry.kind) {
      case "REFUND":
        totalRefundAmount += entry.amount;
        refundCount += 1;
        if (entry.isQrisOrigin) qrisRefundCount += 1;
        break;
      case "VOID":
        totalVoidAmount += entry.amount;
        voidCount += 1;
        break;
      case "MANUAL_DISCOUNT":
        totalManualDiscountAmount += entry.amount;
        manualDiscountCount += 1;
        break;
      default: {
        const _exhaustive: never = entry.kind;
        void _exhaustive;
      }
    }
  }

  const rows = entries.map((entry) => [
    entry.orderNumber,
    formatWitaDateTimeCell(entry.timestamp),
    entry.kindLabel,
    entry.methodLabel,
    formatRp(entry.amount),
    entry.impactLabel,
    entry.reason,
    entry.authorizedBy,
  ]);

  return {
    title: "Laporan void, refund & diskon manual",
    subtitle: `Audit pengembalian dana tunai, pembatalan pesanan, dan diskon manual kasir — ${scopeName}`,
    summaryCards: [
      {
        label: "Refund tunai",
        value: formatRp(totalRefundAmount),
        valueTone: totalRefundAmount > 0 ? "destructive" : undefined,
        sub: `${refundCount} transaksi (${qrisRefundCount} asal QRIS)`,
      },
      {
        label: "Pembatalan (void)",
        value: formatRp(totalVoidAmount),
        sub: `${voidCount} pesanan batal sebelum lunas`,
      },
      {
        label: "Diskon manual",
        value: formatRp(totalManualDiscountAmount),
        valueTone: totalManualDiscountAmount > 0 ? "warning" : undefined,
        sub: `${manualDiscountCount} transaksi diskon kasir`,
      },
      {
        label: "Total nilai koreksi",
        value: formatRp(totalRefundAmount + totalVoidAmount + totalManualDiscountAmount),
        sub: `${rows.length} kejadian tercatat`,
      },
    ],
    tableHeaders: [
      "No. pesanan",
      "Waktu",
      "Jenis koreksi",
      "Metode bayar",
      "Nominal",
      "Dampak stok & poin",
      "Alasan",
      "Otorisasi",
    ],
    tableRows: rows,
    reconciliationInfo: [
      {
        label: "Kebijakan refund QRIS",
        value: "Dikembalikan tunai dari laci kasir",
      },
      {
        label: "Otorisasi refund",
        value: "Wajib alasan dan PIN supervisor",
      },
    ],
  };
}
