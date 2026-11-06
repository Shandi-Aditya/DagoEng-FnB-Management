export type NotificationType =
  | "CRITICAL_STOCK"
  | "OUT_OF_STOCK"
  | "PAYMENT_RECEIVED"
  | "BOOKING_CREATED"
  | "BOOKING_CHECKOUT"
  | "SHIFT_CLOSED"
  | "TIER_UPGRADE"
  | "SYSTEM_ALERT";

export interface SystemNotification {
  id: string;
  type: NotificationType;
  title: string;
  detail: string;
  relatedModule: string;
  relatedRecordId?: string;
  actionUrl?: string;
  outletId: string;
  outletName: string;
  timestamp: string;
  formattedTime: string;
  isRead: boolean;
}
