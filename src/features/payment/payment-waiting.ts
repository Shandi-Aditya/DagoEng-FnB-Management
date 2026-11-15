import type { OrderRecord } from "@/types/order";

export const DEFAULT_PAYMENT_EXPIRY_SECONDS = 900; // 15 minutes

export interface UnifiedPaymentItem {
  id: string;
  itemCode: string;
  title: string;
  subtitle: string;
  customerName: string;
  total: number;
  paymentMethod: "QRIS" | "CASH" | "EDC" | string;
  type: "FNB" | "COWORKING";
  paymentStatus: "PENDING" | "PAID" | "REFUNDED" | string;
  createdAt?: string;
  itemsBreakdown?: { label: string; qty?: number; price: number }[];
  dateInfo?: string;
}

export interface BookingLike {
  id: string;
  bookingCode?: string;
  spaceName?: string;
  guestName?: string;
  duration?: number;
  totalAmount?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  date?: string;
  startTime?: string;
}

/**
 * Formats seconds into MM:SS display format.
 * Clamps negative values to 00:00.
 */
export function formatPaymentTimer(secondsRemaining: number): string {
  const safeSeconds = Math.max(0, Math.floor(secondsRemaining));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Calculates remaining progress percentage (0 - 100).
 */
export function calculatePaymentProgress(
  secondsRemaining: number,
  totalDurationSeconds: number = DEFAULT_PAYMENT_EXPIRY_SECONDS
): number {
  if (totalDurationSeconds <= 0) return 0;
  const clamped = Math.max(0, Math.min(totalDurationSeconds, secondsRemaining));
  return Math.round((clamped / totalDurationSeconds) * 100);
}

/**
 * Normalizes an OrderRecord, Co-working booking, or UnifiedPaymentItem into a consistent UnifiedPaymentItem.
 */
export function normalizePaymentItem(params: {
  order?: OrderRecord | null;
  booking?: BookingLike | null;
  paymentItem?: UnifiedPaymentItem | null;
}): UnifiedPaymentItem | null {
  const { order, booking, paymentItem } = params;

  if (paymentItem) {
    return paymentItem;
  }

  if (order) {
    return {
      id: order.id,
      itemCode: order.orderNumber,
      title: "Pesanan F&B",
      subtitle: `Meja ${order.tableNumber}${order.outletName ? ` (${order.outletName})` : ""}`,
      customerName: order.customerName,
      total: order.total,
      paymentMethod: order.paymentMethod || "QRIS",
      type: "FNB",
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      itemsBreakdown: order.items.map((i) => ({
        label: i.productName,
        qty: i.quantity,
        price: i.quantity * i.unitPrice,
      })),
    };
  }

  if (booking) {
    const durationLabel = booking.duration ? ` (${booking.duration} jam)` : "";
    const dateLabel = [booking.date, booking.startTime].filter(Boolean).join(" • ");
    return {
      id: booking.id,
      itemCode: booking.bookingCode || booking.id,
      title: "Sewa ruang kerja co-working",
      subtitle: `${booking.spaceName || "Ruang kerja"}${durationLabel}`,
      customerName: booking.guestName || "Tamu",
      total: booking.totalAmount || 0,
      paymentMethod: booking.paymentMethod || "QRIS",
      type: "COWORKING",
      paymentStatus: booking.paymentStatus || "PENDING",
      dateInfo: dateLabel || undefined,
      itemsBreakdown: [
        {
          label: `${booking.spaceName || "Ruang kerja"}${durationLabel}`,
          qty: 1,
          price: booking.totalAmount || 0,
        },
      ],
    };
  }

  return null;
}

export interface PaymentMethodDisplay {
  label: string;
  instruction: string;
  iconType: "qris" | "cash" | "edc";
}

/**
 * Maps payment method string to clean UI label and unslopped instructions.
 */
export function getPaymentMethodDisplay(method: string): PaymentMethodDisplay {
  const normalized = method?.toUpperCase() || "";

  if (normalized === "CASH") {
    return {
      label: "Tunai di kasir",
      instruction: "Tunjukkan kode referensi pembayaran di meja kasir untuk menyelesaikan transaksi tunai.",
      iconType: "cash",
    };
  }

  if (normalized === "EDC") {
    return {
      label: "Kartu debit / kredit",
      instruction: "Lakukan pembayaran kartu melalui mesin EDC di meja kasir atau melalui staf.",
      iconType: "edc",
    };
  }

  return {
    label: "QRIS dinamis",
    instruction: "Pindai kode QRIS menggunakan aplikasi mobile banking atau dompet digital yang mendukung pembayaran QRIS.",
    iconType: "qris",
  };
}

/**
 * Calculates remaining seconds until expiration based on order creation timestamp.
 */
export function calculateSecondsRemaining(
  createdAt?: string,
  nowTimestamp: number = Date.now(),
  maxDurationSeconds: number = DEFAULT_PAYMENT_EXPIRY_SECONDS
): number {
  if (!createdAt) return maxDurationSeconds;

  const createdTime = new Date(createdAt).getTime();
  if (isNaN(createdTime)) return maxDurationSeconds;

  const elapsedSeconds = Math.floor((nowTimestamp - createdTime) / 1000);
  const remaining = maxDurationSeconds - elapsedSeconds;
  return Math.max(0, remaining);
}
