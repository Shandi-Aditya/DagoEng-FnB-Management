import {
  appendAuditLog,
  getPersistentOrders,
  mutatePersistentData,
  readPersistentData,
} from "@/lib/persistent-storage";
import { MASTER_HQ_OUTLET } from "@/lib/receipt-publisher";
import {
  DEFAULT_TENANT_REVENUE_SPLITS,
  calculateSettlement,
} from "@/lib/settlement";
import {
  SETTLEMENT_POLICY_STORAGE_FILE,
  isSettlementBasisMode,
  settlementBasisLabel,
  type SettlementBasisMode,
  type SettlementReceiptPolicyConfig,
} from "@/lib/settlement-receipt-policy";
import { extractShiftStartTimeMs } from "@/lib/shift-management";
import {
  aggregateOrdersTaxAndRevenue,
  getOrderTaxBreakdown,
} from "@/lib/tax-breakdown";
import {
  DEFAULT_TENANT_PROFILES,
  getAllStoredTenantSettings,
} from "@/lib/tenant";
import { formatCurrencyIDR } from "@/lib/utils";
import {
  isWhatsAppServiceConfigured,
  sanitizeTargetPhone,
} from "@/lib/whatsapp";
import type { OrderRecord } from "@/types/order";
import type { ShiftRecord } from "@/types/shift";

export type { SettlementBasisMode };

export type SettlementReceiptPolicyShape = Partial<
  Pick<SettlementReceiptPolicyConfig, "settlementBasis" | "revenueSplits">
>;

export interface PartnerContactTarget {
  whatsappPhone?: string;
  telegramChatId?: string;
}

export interface ClosingChatbotRecipientConfig {
  kaAriWhatsappPhone?: string;
  kaAriTelegramChatId?: string;
  partnerContacts?: Record<string, PartnerContactTarget>;
}

export interface TenantSettingsContactOverride {
  brandName?: string;
  contactPhone?: string;
}

export interface PaymentMethodSummary {
  cash: number;
  qris: number;
  otherNonCash: number;
}

export interface PartnerShiftShareSummary {
  tenantId: string;
  tenantName: string;
  transactionCount: number;
  itemCount: number;
  grossRevenue: number;
  discount: number;
  dpp: number;
  tax: number;
  serviceCharge: number;
  netRevenue: number;
  settlementBasis: SettlementBasisMode;
  effectiveBasisAmount: number;
  tenantSharePercent: number;
  dagoSharePercent: number;
  partnerShareAmount: number;
  dagoShareAmount: number;
}

export interface KaAriShiftSummary {
  shiftId: string;
  shiftName: string;
  outletId: string;
  outletName: string;
  cashierName: string;
  closingTimeWita: string;
  paidOrderCount: number;
  grossSales: number;
  discount: number;
  pb1Tax: number;
  serviceCharge: number;
  netSales: number;
  totalCollected: number;
  paymentBreakdown: PaymentMethodSummary;
  cashReconciliation: {
    openingCash: number;
    cashSales: number;
    refundAmount: number;
    expectedCash: number;
    actualCash: number;
    cashVariance: number;
    closingNotes: string;
  };
  settlementBasis: SettlementBasisMode;
  partnerSummaries: PartnerShiftShareSummary[];
  dagoHubTotalShare: number;
}

export type ClosingChatbotEnvelope =
  | {
      role: "KA_ARI";
      recipientId: "ka-ari";
      recipientName: "Ka Ari";
      whatsappPhone?: string;
      telegramChatId?: string;
      message: string;
      summary: KaAriShiftSummary;
    }
  | {
      role: "PARTNER";
      recipientId: string;
      recipientName: string;
      whatsappPhone?: string;
      telegramChatId?: string;
      message: string;
      summary: PartnerShiftShareSummary;
    };

export interface ClosingChannelDeliveryResult {
  channel: "WHATSAPP" | "TELEGRAM";
  target: string;
  sent: boolean;
  configured: boolean;
  reason?: "GATEWAY_NOT_CONFIGURED" | "INVALID_TARGET" | "DISPATCH_ERROR";
  message: string;
  timestamp: string;
  durationMs: number;
}

export interface ClosingEnvelopeDispatchRecord {
  role: "KA_ARI" | "PARTNER";
  recipientId: string;
  recipientName: string;
  message: string;
  deliveries: ClosingChannelDeliveryResult[];
  summary: KaAriShiftSummary | PartnerShiftShareSummary;
}

export interface ClosingChatbotDispatchRecord {
  id: string;
  shiftId: string;
  shiftName: string;
  outletId: string;
  outletName: string;
  settlementBasis: SettlementBasisMode;
  dispatchedAt: string;
  elapsedMs: number;
  withinOneMinuteSla: boolean;
  forceResend: boolean;
  duplicateSkipped?: boolean;
  envelopeCount: number;
  sentCount: number;
  envelopes: ClosingEnvelopeDispatchRecord[];
}

export interface ChatbotTransportOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  apiToken?: string;
  botToken?: string;
}

const FILE_CLOSING_CHATBOT_DISPATCHES = "closing_chatbot_dispatches.json";
const DEFAULT_DISPATCH_TIMEOUT_MS = 8000;
const ONE_MINUTE_SLA_MS = 60_000;

function formatRupiahText(amount: number): string {
  return formatCurrencyIDR(Math.round(amount)).replace(/\u00A0/g, " ");
}

function formatSignedRupiahText(amount: number): string {
  const rounded = Math.round(amount);
  const absText = formatRupiahText(Math.abs(rounded));
  if (rounded > 0) return `+${absText}`;
  if (rounded < 0) return `-${absText}`;
  return absText;
}

function resolveSettlementBasis(raw?: string): SettlementBasisMode {
  return isSettlementBasisMode(raw) ? raw : "RECEIPT_NET_BEFORE_TAX";
}

function sanitizeTenantEnvKey(tenantId: string): string {
  return tenantId
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

export function isTelegramServiceConfigured(botToken?: string): boolean {
  const token = botToken ?? process.env.TELEGRAM_BOT_TOKEN;
  return Boolean(token && token.trim().length > 0);
}

export function formatWitaDateTime(isoDate?: string): string {
  const date = isoDate ? new Date(isoDate) : new Date();
  if (Number.isNaN(date.getTime())) return "-";
  const datePart = date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Makassar",
  });
  const timePart = date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Makassar",
  });
  return `${datePart}, ${timePart} WITA`;
}

/**
 * Filters orders strictly to the shift's outlet and [startMs, endMs] window.
 * Never falls back to unrelated orders when a shift has zero orders.
 */
export function filterOrdersForShiftWindow(
  orders: OrderRecord[],
  shift: ShiftRecord
): OrderRecord[] {
  const startMs =
    extractShiftStartTimeMs(shift) ||
    (shift.startTime ? Date.parse(shift.startTime) : 0);
  const effectiveStartMs = Number.isFinite(startMs) && startMs > 0 ? startMs : 0;

  const rawEnd = shift.closedAt || shift.endTime;
  const parsedEndMs = rawEnd ? Date.parse(rawEnd) : NaN;
  const effectiveEndMs =
    Number.isFinite(parsedEndMs) && parsedEndMs > 0 ? parsedEndMs : Infinity;

  return orders.filter((order) => {
    if (
      shift.outletId &&
      shift.outletId !== "ALL" &&
      order.outletId &&
      order.outletId !== shift.outletId
    ) {
      return false;
    }

    if ((effectiveStartMs > 0 || effectiveEndMs < Infinity) && order.createdAt) {
      const orderMs = Date.parse(order.createdAt);
      if (!Number.isNaN(orderMs)) {
        if (orderMs < effectiveStartMs || orderMs > effectiveEndMs) {
          return false;
        }
      }
    }

    return true;
  });
}

function computePaymentBreakdown(
  paidOrders: OrderRecord[],
  shift: ShiftRecord
): PaymentMethodSummary {
  if (paidOrders.length === 0) {
    return {
      cash: Math.round(shift.cashSales || 0),
      qris: 0,
      otherNonCash: Math.round(shift.nonCashSales || 0),
    };
  }

  let cash = 0;
  let qris = 0;
  let otherNonCash = 0;

  for (const order of paidOrders) {
    const orderTotal = getOrderTaxBreakdown(order).total;
    if (order.paymentMethod === "CASH") {
      cash += orderTotal;
    } else if (order.paymentMethod === "QRIS") {
      qris += orderTotal;
    } else {
      otherNonCash += orderTotal;
    }
  }

  return {
    cash: Math.round(cash),
    qris: Math.round(qris),
    otherNonCash: Math.round(otherNonCash),
  };
}

function formatKaAriClosingMessage(summary: KaAriShiftSummary): string {
  const variance = summary.cashReconciliation.cashVariance;
  const varianceStatus =
    variance === 0 ? "Seimbang" : variance < 0 ? "Kurang" : "Lebih";
  const basisLabel = settlementBasisLabel(summary.settlementBasis);

  const partnerLines =
    summary.partnerSummaries.length > 0
      ? summary.partnerSummaries.map(
          (p) =>
            `- ${p.tenantName}: ${p.transactionCount} transaksi (${p.itemCount} item) | Basis ${formatRupiahText(p.effectiveBasisAmount)} | Mitra (${p.tenantSharePercent}%): ${formatRupiahText(p.partnerShareAmount)} | Dago Hub (${p.dagoSharePercent}%): ${formatRupiahText(p.dagoShareAmount)}`
        )
      : ["- Tidak ada transaksi mitra pada shift ini"];

  return [
    "Laporan closing shift FO - DagoEng",
    `ID shift: ${summary.shiftId}`,
    `Shift: ${summary.shiftName}`,
    `Outlet: ${summary.outletName}`,
    `Kasir: ${summary.cashierName}`,
    `Waktu tutup: ${summary.closingTimeWita}`,
    "",
    "Ringkasan penjualan:",
    `- Order lunas: ${summary.paidOrderCount} transaksi`,
    `- Penjualan kotor: ${formatRupiahText(summary.grossSales)}`,
    `- Diskon: ${formatRupiahText(summary.discount)}`,
    `- Pajak PB1: ${formatRupiahText(summary.pb1Tax)}`,
    `- Biaya layanan: ${formatRupiahText(summary.serviceCharge)}`,
    `- Penjualan bersih: ${formatRupiahText(summary.netSales)}`,
    `- Total diterima: ${formatRupiahText(summary.totalCollected)}`,
    "",
    "Metode pembayaran:",
    `- Tunai: ${formatRupiahText(summary.paymentBreakdown.cash)}`,
    `- QRIS: ${formatRupiahText(summary.paymentBreakdown.qris)}`,
    `- Non-tunai lainnya / EDC: ${formatRupiahText(summary.paymentBreakdown.otherNonCash)}`,
    "",
    "Rekonsiliasi kas laci (FO):",
    `- Modal awal: ${formatRupiahText(summary.cashReconciliation.openingCash)}`,
    `- Penjualan tunai: ${formatRupiahText(summary.cashReconciliation.cashSales)}`,
    `- Refund kas: ${formatRupiahText(summary.cashReconciliation.refundAmount)}`,
    `- Kas seharusnya: ${formatRupiahText(summary.cashReconciliation.expectedCash)}`,
    `- Kas aktual: ${formatRupiahText(summary.cashReconciliation.actualCash)}`,
    `- Selisih kas: ${formatSignedRupiahText(variance)} (${varianceStatus})`,
    `- Catatan closing: ${summary.cashReconciliation.closingNotes}`,
    "",
    `Bagi hasil mitra (basis ${basisLabel}):`,
    ...partnerLines,
    `- Total hak Dago Hub: ${formatRupiahText(summary.dagoHubTotalShare)}`,
  ].join("\n");
}

function formatPartnerClosingMessage(
  partner: PartnerShiftShareSummary,
  shiftMeta: { shiftName: string; outletName: string; closingTimeWita: string }
): string {
  const basisLabel = settlementBasisLabel(partner.settlementBasis);
  return [
    `Ringkasan closing mitra - ${partner.tenantName}`,
    `Outlet: ${shiftMeta.outletName}`,
    `Shift: ${shiftMeta.shiftName}`,
    `Waktu tutup: ${shiftMeta.closingTimeWita}`,
    "",
    `Transaksi ${partner.tenantName}: ${partner.transactionCount} transaksi (${partner.itemCount} item)`,
    `Penjualan kotor mitra: ${formatRupiahText(partner.grossRevenue)}`,
    `Diskon prorata: ${formatRupiahText(partner.discount)}`,
    `Basis bagi hasil (${basisLabel}): ${formatRupiahText(partner.effectiveBasisAmount)}`,
    `Hak mitra (${partner.tenantSharePercent}%): ${formatRupiahText(partner.partnerShareAmount)}`,
    `Biaya Dago Hub (${partner.dagoSharePercent}%): ${formatRupiahText(partner.dagoShareAmount)}`,
  ].join("\n");
}

/**
 * Pure builder producing isolated shift closing chatbot envelopes for Ka Ari and each active F&B partner.
 */
export function buildShiftClosingEnvelopes(params: {
  shift: ShiftRecord;
  orders: OrderRecord[];
  recipientConfig?: Partial<ClosingChatbotRecipientConfig>;
  settlementPolicy?: SettlementReceiptPolicyShape;
  tenantSettingsOverrides?: Record<string, TenantSettingsContactOverride>;
}): ClosingChatbotEnvelope[] {
  const { shift, orders, recipientConfig, settlementPolicy, tenantSettingsOverrides } = params;

  const settlementBasis = resolveSettlementBasis(settlementPolicy?.settlementBasis);
  const mergedSplits: Record<string, { tenantSharePercent: number; dagoSharePercent: number }> = {
    ...DEFAULT_TENANT_REVENUE_SPLITS,
  };
  const tenantNameMap: Record<string, string> = {};

  if (settlementPolicy?.revenueSplits) {
    for (const [tenantId, entry] of Object.entries(settlementPolicy.revenueSplits)) {
      if (!entry || typeof entry !== "object") continue;
      if (typeof entry.tenantSharePercent === "number" && typeof entry.dagoSharePercent === "number") {
        mergedSplits[tenantId] = {
          tenantSharePercent: entry.tenantSharePercent,
          dagoSharePercent: entry.dagoSharePercent,
        };
      }
      if (entry.tenantName) {
        tenantNameMap[tenantId] = entry.tenantName;
      }
    }
  }

  const storedOverrides =
    tenantSettingsOverrides ||
    (typeof window !== "undefined"
      ? (getAllStoredTenantSettings() as Record<string, TenantSettingsContactOverride>)
      : {});

  for (const [tenantId, override] of Object.entries(storedOverrides)) {
    if (override?.brandName) {
      tenantNameMap[tenantId] = override.brandName;
    }
  }

  const windowOrders = filterOrdersForShiftWindow(orders, shift);
  const paidShiftOrders = windowOrders.filter(
    (order) => order.paymentStatus === "PAID" && order.status !== "CANCELLED"
  );

  const taxAgg = aggregateOrdersTaxAndRevenue(paidShiftOrders);
  const settlements = calculateSettlement(paidShiftOrders, tenantNameMap, mergedSplits, {
    settlementBasis,
  });

  const partnerSummaries: PartnerShiftShareSummary[] = [];
  let dagoHubDirectShare = 0;

  for (const s of settlements) {
    if (s.transactionCount <= 0) continue;

    const effectiveBasisAmount =
      s.settlementBasisAmount ?? s.dpp ?? Math.max(0, s.grossRevenue - s.discount);

    if (s.tenantId === "DAGO_HUB") {
      dagoHubDirectShare += effectiveBasisAmount;
      continue;
    }

    const tenantSharePercent = s.tenantSharePercent ?? 85;
    const dagoSharePercent = s.dagoSharePercent ?? 15;

    const partnerShareAmount =
      s.tenantShareAmount ?? Math.round(effectiveBasisAmount * (tenantSharePercent / 100));
    const dagoShareAmount = s.dagoShareAmount ?? effectiveBasisAmount - partnerShareAmount;

    partnerSummaries.push({
      tenantId: s.tenantId,
      tenantName: s.tenantName,
      transactionCount: s.transactionCount,
      itemCount: s.itemCount,
      grossRevenue: s.grossRevenue,
      discount: s.discount,
      dpp: s.dpp ?? Math.max(0, s.grossRevenue - s.discount),
      tax: s.tax,
      serviceCharge: s.serviceCharge,
      netRevenue: s.netRevenue,
      settlementBasis,
      effectiveBasisAmount,
      tenantSharePercent,
      dagoSharePercent,
      partnerShareAmount,
      dagoShareAmount,
    });
  }

  const dagoHubTotalShare =
    partnerSummaries.reduce((sum, partner) => sum + partner.dagoShareAmount, 0) +
    dagoHubDirectShare;

  const closingTimeWita = formatWitaDateTime(shift.closedAt || shift.endTime);
  const outletLabel = shift.outletName || shift.outletId || MASTER_HQ_OUTLET.name;
  const cashierName = shift.assignedCashierName || shift.closedBy || "Kasir Bertugas";

  const openingCash = Math.round(shift.openingCash || 0);
  const cashSales = Math.round(shift.cashSales || 0);
  const refundAmount = Math.round(shift.refundAmount || 0);
  const expectedCash = Math.round(
    shift.expectedCash !== undefined
      ? shift.expectedCash
      : openingCash + cashSales - refundAmount
  );
  const actualCash = Math.round(
    shift.actualCash !== undefined ? shift.actualCash : expectedCash
  );
  const cashVariance = Math.round(
    shift.cashVariance !== undefined ? shift.cashVariance : actualCash - expectedCash
  );
  const closingNotes = shift.closingNotes?.trim() || "-";

  const paymentBreakdown = computePaymentBreakdown(paidShiftOrders, shift);
  const hasOrders = paidShiftOrders.length > 0;
  const grossSales = hasOrders
    ? taxAgg.totalSubtotal
    : Math.round((shift.cashSales || 0) + (shift.nonCashSales || 0));
  const netSales = hasOrders ? taxAgg.totalNetSales : grossSales;
  const totalCollected = hasOrders ? taxAgg.totalRevenue : grossSales;

  const kaAriSummary: KaAriShiftSummary = {
    shiftId: shift.id,
    shiftName: shift.shiftName,
    outletId: shift.outletId,
    outletName: outletLabel,
    cashierName,
    closingTimeWita,
    paidOrderCount: paidShiftOrders.length,
    grossSales,
    discount: hasOrders ? taxAgg.totalDiscounts : 0,
    pb1Tax: hasOrders ? taxAgg.totalTaxPB1 : 0,
    serviceCharge: hasOrders ? taxAgg.totalServiceCharge : 0,
    netSales,
    totalCollected,
    paymentBreakdown,
    cashReconciliation: {
      openingCash,
      cashSales,
      refundAmount,
      expectedCash,
      actualCash,
      cashVariance,
      closingNotes,
    },
    settlementBasis,
    partnerSummaries,
    dagoHubTotalShare,
  };

  const kaAriWhatsappPhone =
    recipientConfig?.kaAriWhatsappPhone ||
    process.env.KA_ARI_WHATSAPP_PHONE ||
    process.env.FONNTE_TARGET_PHONE ||
    MASTER_HQ_OUTLET.phone;
  const kaAriTelegramChatId =
    recipientConfig?.kaAriTelegramChatId ||
    process.env.TELEGRAM_KA_ARI_CHAT_ID ||
    process.env.TELEGRAM_CHAT_ID;

  const envelopes: ClosingChatbotEnvelope[] = [
    {
      role: "KA_ARI",
      recipientId: "ka-ari",
      recipientName: "Ka Ari",
      whatsappPhone: kaAriWhatsappPhone || undefined,
      telegramChatId: kaAriTelegramChatId || undefined,
      message: formatKaAriClosingMessage(kaAriSummary),
      summary: kaAriSummary,
    },
  ];

  for (const partner of partnerSummaries) {
    const partnerContactOverride = recipientConfig?.partnerContacts?.[partner.tenantId];
    const tenantOverride = storedOverrides[partner.tenantId];
    const sanitizedId = sanitizeTenantEnvKey(partner.tenantId);

    const whatsappPhone =
      partnerContactOverride?.whatsappPhone ||
      tenantOverride?.contactPhone ||
      DEFAULT_TENANT_PROFILES[partner.tenantId]?.contactPhone;

    const telegramChatId =
      partnerContactOverride?.telegramChatId ||
      process.env[`TELEGRAM_PARTNER_${sanitizedId}_CHAT_ID`];

    envelopes.push({
      role: "PARTNER",
      recipientId: partner.tenantId,
      recipientName: partner.tenantName,
      whatsappPhone: whatsappPhone || undefined,
      telegramChatId: telegramChatId || undefined,
      message: formatPartnerClosingMessage(partner, {
        shiftName: shift.shiftName,
        outletName: outletLabel,
        closingTimeWita,
      }),
      summary: partner,
    });
  }

  return envelopes;
}

export async function sendWhatsAppChatbotMessage(
  phone: string,
  text: string,
  options?: ChatbotTransportOptions
): Promise<ClosingChannelDeliveryResult> {
  const startedAt = Date.now();
  const timestamp = new Date(startedAt).toISOString();

  if (
    !options?.fetchImpl &&
    (process.env.ENABLE_WHATSAPP_CHATBOT === "false" ||
      process.env.DISABLE_WHATSAPP_CHATBOT === "true")
  ) {
    return {
      channel: "WHATSAPP",
      target: phone,
      sent: false,
      configured: false,
      reason: "GATEWAY_NOT_CONFIGURED",
      message: "Chatbot WhatsApp dinonaktifkan sementara hingga sistem siap rilis produksi.",
      timestamp,
      durationMs: Math.max(0, Date.now() - startedAt),
    };
  }

  const token = options?.apiToken ?? process.env.FONNTE_API_TOKEN;

  if (!token || !token.trim()) {
    return {
      channel: "WHATSAPP",
      target: phone,
      sent: false,
      configured: false,
      reason: "GATEWAY_NOT_CONFIGURED",
      message: "Token Fonnte WhatsApp belum dikonfigurasi di server.",
      timestamp,
      durationMs: Math.max(0, Date.now() - startedAt),
    };
  }

  const resolvedTarget = sanitizeTargetPhone(phone);
  if (!resolvedTarget || resolvedTarget.length < 9) {
    return {
      channel: "WHATSAPP",
      target: phone,
      sent: false,
      configured: true,
      reason: "INVALID_TARGET",
      message: "Nomor WhatsApp tujuan tidak valid.",
      timestamp,
      durationMs: Math.max(0, Date.now() - startedAt),
    };
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_DISPATCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: token.trim(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target: resolvedTarget,
        message: text,
        countryCode: "62",
      }),
      signal: controller.signal,
    });

    const result = await response.json().catch(() => null);
    const durationMs = Math.max(0, Date.now() - startedAt);

    if (!response.ok || result?.status === false) {
      return {
        channel: "WHATSAPP",
        target: resolvedTarget,
        sent: false,
        configured: true,
        reason: "DISPATCH_ERROR",
        message:
          result?.reason ||
          result?.message ||
          "Gagal mengirim pesan WhatsApp melalui gateway Fonnte.",
        timestamp,
        durationMs,
      };
    }

    return {
      channel: "WHATSAPP",
      target: resolvedTarget,
      sent: true,
      configured: true,
      message: `Pesan WhatsApp terkirim ke ${resolvedTarget}.`,
      timestamp,
      durationMs,
    };
  } catch (err: unknown) {
    const durationMs = Math.max(0, Date.now() - startedAt);
    const errorMessage =
      err instanceof Error ? err.message : "Gagal menghubungi gateway WhatsApp.";
    return {
      channel: "WHATSAPP",
      target: resolvedTarget,
      sent: false,
      configured: true,
      reason: "DISPATCH_ERROR",
      message: errorMessage,
      timestamp,
      durationMs,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function sendTelegramChatbotMessage(
  chatId: string,
  text: string,
  options?: ChatbotTransportOptions
): Promise<ClosingChannelDeliveryResult> {
  const startedAt = Date.now();
  const timestamp = new Date(startedAt).toISOString();
  const token = options?.botToken ?? process.env.TELEGRAM_BOT_TOKEN;

  if (!token || !token.trim()) {
    return {
      channel: "TELEGRAM",
      target: chatId,
      sent: false,
      configured: false,
      reason: "GATEWAY_NOT_CONFIGURED",
      message: "Token bot Telegram belum dikonfigurasi di server.",
      timestamp,
      durationMs: Math.max(0, Date.now() - startedAt),
    };
  }

  const trimmedChatId = (chatId || "").trim();
  if (!trimmedChatId) {
    return {
      channel: "TELEGRAM",
      target: chatId,
      sent: false,
      configured: true,
      reason: "INVALID_TARGET",
      message: "Chat ID Telegram tujuan kosong.",
      timestamp,
      durationMs: Math.max(0, Date.now() - startedAt),
    };
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_DISPATCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(
      `https://api.telegram.org/bot${token.trim()}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: trimmedChatId,
          text,
        }),
        signal: controller.signal,
      }
    );

    const result = await response.json().catch(() => null);
    const durationMs = Math.max(0, Date.now() - startedAt);

    if (!response.ok || result?.ok === false) {
      return {
        channel: "TELEGRAM",
        target: trimmedChatId,
        sent: false,
        configured: true,
        reason: "DISPATCH_ERROR",
        message:
          result?.description ||
          result?.message ||
          "Gagal mengirim pesan melalui bot Telegram.",
        timestamp,
        durationMs,
      };
    }

    return {
      channel: "TELEGRAM",
      target: trimmedChatId,
      sent: true,
      configured: true,
      message: `Pesan Telegram terkirim ke ${trimmedChatId}.`,
      timestamp,
      durationMs,
    };
  } catch (err: unknown) {
    const durationMs = Math.max(0, Date.now() - startedAt);
    const errorMessage =
      err instanceof Error ? err.message : "Gagal menghubungi gateway Telegram.";
    return {
      channel: "TELEGRAM",
      target: trimmedChatId,
      sent: false,
      configured: true,
      reason: "DISPATCH_ERROR",
      message: errorMessage,
      timestamp,
      durationMs,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function getClosingChatbotDispatches(): Promise<
  ClosingChatbotDispatchRecord[]
> {
  return readPersistentData<ClosingChatbotDispatchRecord[]>(
    FILE_CLOSING_CHATBOT_DISPATCHES,
    []
  );
}

/**
 * Dispatches shift closing chatbot notifications concurrently to Ka Ari and participating F&B partners.
 * Enforces idempotency per shift.id unless forceResend is true.
 */
export async function dispatchShiftClosingChatbot(params: {
  shift: ShiftRecord;
  orders?: OrderRecord[];
  forceResend?: boolean;
  recipientConfig?: Partial<ClosingChatbotRecipientConfig>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<ClosingChatbotDispatchRecord> {
  const forceResend = Boolean(params.forceResend);

  if (!forceResend) {
    const existingDispatches = await getClosingChatbotDispatches();
    const existing = existingDispatches.find(
      (item) => item.shiftId === params.shift.id
    );
    if (existing) {
      return {
        ...existing,
        duplicateSkipped: true,
      };
    }
  }

  const startedAt = Date.now();
  const [settlementPolicy, orders] = await Promise.all([
    readPersistentData<SettlementReceiptPolicyShape>(
      SETTLEMENT_POLICY_STORAGE_FILE,
      {}
    ),
    params.orders ? Promise.resolve(params.orders) : getPersistentOrders(),
  ]);

  const settlementBasis = resolveSettlementBasis(settlementPolicy?.settlementBasis);
  const envelopes = buildShiftClosingEnvelopes({
    shift: params.shift,
    orders,
    recipientConfig: params.recipientConfig,
    settlementPolicy,
  });

  const dispatchedEnvelopes = await Promise.all(
    envelopes.map(async (envelope): Promise<ClosingEnvelopeDispatchRecord> => {
      const channelTasks: Promise<ClosingChannelDeliveryResult>[] = [];

      if (envelope.whatsappPhone) {
        channelTasks.push(
          sendWhatsAppChatbotMessage(envelope.whatsappPhone, envelope.message, {
            fetchImpl: params.fetchImpl,
            timeoutMs: params.timeoutMs,
          })
        );
      }

      if (envelope.telegramChatId) {
        channelTasks.push(
          sendTelegramChatbotMessage(envelope.telegramChatId, envelope.message, {
            fetchImpl: params.fetchImpl,
            timeoutMs: params.timeoutMs,
          })
        );
      }

      if (channelTasks.length === 0) {
        channelTasks.push(
          Promise.resolve({
            channel: "WHATSAPP",
            target: "",
            sent: false,
            configured: isWhatsAppServiceConfigured(),
            reason: "INVALID_TARGET",
            message: `Tidak ada kontak WhatsApp atau Telegram untuk ${envelope.recipientName}.`,
            timestamp: new Date().toISOString(),
            durationMs: 0,
          })
        );
      }

      const deliveries = await Promise.all(channelTasks);
      return {
        role: envelope.role,
        recipientId: envelope.recipientId,
        recipientName: envelope.recipientName,
        message: envelope.message,
        deliveries,
        summary: envelope.summary,
      };
    })
  );

  const elapsedMs = Math.max(0, Date.now() - startedAt);
  const dispatchedAt = new Date().toISOString();
  const sentCount = dispatchedEnvelopes.reduce(
    (sum, env) => sum + env.deliveries.filter((d) => d.sent).length,
    0
  );

  const record: ClosingChatbotDispatchRecord = {
    id: `cbd-${params.shift.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    shiftId: params.shift.id,
    shiftName: params.shift.shiftName,
    outletId: params.shift.outletId,
    outletName: params.shift.outletName || params.shift.outletId || MASTER_HQ_OUTLET.name,
    settlementBasis,
    dispatchedAt,
    elapsedMs,
    withinOneMinuteSla: elapsedMs < ONE_MINUTE_SLA_MS,
    forceResend,
    envelopeCount: dispatchedEnvelopes.length,
    sentCount,
    envelopes: dispatchedEnvelopes,
  };

  let persistedRecord = record;
  await mutatePersistentData<ClosingChatbotDispatchRecord[]>(
    FILE_CLOSING_CHATBOT_DISPATCHES,
    [],
    (existing) => {
      if (!forceResend) {
        const duplicate = existing.find((item) => item.shiftId === params.shift.id);
        if (duplicate) {
          persistedRecord = {
            ...duplicate,
            duplicateSkipped: true,
          };
          return existing;
        }
      }
      return [record, ...existing];
    }
  );

  if (!persistedRecord.duplicateSkipped) {
    await appendAuditLog({
      id: `audit-closing-chatbot-${params.shift.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: dispatchedAt,
      module: "EMPLOYEES_SHIFT",
      action: "CLOSING_CHATBOT_DISPATCHED",
      recordId: params.shift.id,
      referenceId: params.shift.id,
      outletId: params.shift.outletId,
      outletName: params.shift.outletName,
      actorName: params.shift.closedBy || params.shift.assignedCashierName,
      description: `Ringkasan closing shift ${params.shift.shiftName} diproses ke ${dispatchedEnvelopes.length} penerima (${sentCount} kanal terkirim, ${elapsedMs}ms).`,
      status: sentCount > 0 ? "SUCCESS" : "WARNING",
      severity: "INFO",
      category: "OPERATIONAL",
      metadata: {
        dispatchId: record.id,
        shiftId: params.shift.id,
        envelopeCount: dispatchedEnvelopes.length,
        sentCount,
        elapsedMs,
        withinOneMinuteSla: record.withinOneMinuteSla,
        forceResend,
      },
    });
  }

  return persistedRecord;
}
