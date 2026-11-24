export type OrderStatus =
  | "NEW"
  | "CONFIRMED"
  | "KITCHEN_RECEIVED"
  | "COOKING"
  | "READY"
  | "SERVED"
  | "COMPLETED"
  | "CANCELLED";

export type SLAStatus = "ON_TIME" | "AT_RISK" | "DELAYED";

export type CorporateBillingType = "PREPAID" | "INVOICE";

export interface CorporateOrderDraft {
  enabled: boolean;
  companyName: string;
  picName: string;
  picPhone: string;
  headcount: number;
  billingType: CorporateBillingType;
  meetingRoomId?: string;
  notes?: string;
}

export const DEFAULT_CORPORATE_DRAFT: CorporateOrderDraft = {
  enabled: false,
  companyName: "",
  picName: "",
  picPhone: "",
  headcount: 1,
  billingType: "PREPAID",
  meetingRoomId: undefined,
  notes: "",
};

export interface CorporateOrderInfo {
  companyName: string;
  picName: string;
  picPhone: string;
  picEmail?: string;
  headcount?: number;
  billingType: CorporateBillingType;
  invoiceNumber?: string;
  invoiceDueDate?: string;
  notes?: string;
  linkedBookingCode?: string;
  linkedSpaceName?: string;
}

export interface OrderStatusHistoryItem {
  id: string;
  orderId: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  timestamp: string; // ISO string
  actorId?: string;
  actorName?: string;
  note?: string;
}

export type OrderItemCategoryType = "FNB" | "COWORKING";

export type CoworkingOrderItemMeta = {
  spaceId: string;
  spaceName: string;
  spaceType?: string;
  durationHours: number;
  startTime?: string;
  endTime?: string;
  bookingDate?: string;
  rateLabel?: string;
};

export interface OrderItemRecord {
  id: string;
  productId?: string;
  tenantId?: string;
  tenantName?: string;
  itemType?: OrderItemCategoryType;
  category?: string;
  coworkingMeta?: CoworkingOrderItemMeta;
  productName: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
  modifiers?: string[];
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  organizationId: string;
  outletId: string;
  outletName: string;
  tenantId?: string;
  tableNumber: string;
  customerName: string;
  /** Phone left by the guest at self-order checkout; the customer app finds "my orders" by this, never by name. */
  customerPhone?: string;
  corporateInfo?: CorporateOrderInfo;
  cashierName?: string;
  orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  status: OrderStatus;
  tenantStatuses?: Record<string, OrderStatus>;
  items: OrderItemRecord[];
  subtotal: number;
  discount?: number;
  fnbDiscount?: number;
  coworkingDiscount?: number;
  promoId?: string;
  tax: number;
  fnbTax?: number;
  coworkingTax?: number;
  serviceCharge?: number;
  taxRatePercent?: number;
  serviceChargePercent?: number;
  total: number;
  paymentStatus: "PENDING" | "PAID" | "REFUNDED";
  paymentMethod?: "CASH" | "QRIS" | "EDC" | "TRANSFER" | "SPLIT" | "INVOICE";
  paymentReference?: string;
  splitDetails?: Array<{
    guestNumber: number;
    label?: string;
    amount: number;
    method: string;
  }>;
  supervisorPinVerified?: boolean;
  qrisVerification?: {
    type: "GATEWAY_WEBHOOK" | "SUPERVISOR_MANUAL";
    referenceNumber: string;
    invoiceNumber?: string;
    supervisorPinVerified?: boolean;
    verifiedAt: string;
    note?: string;
  };
  loyaltyPointsCredited?: boolean;
  bomDeducted?: boolean;
  bomRestored?: boolean;
  syncStatus?: "SYNCED" | "PENDING" | "REJECTED";
  syncError?: string;
  targetServiceMinutes: number; // Target SLA in minutes (e.g. 10m or 15m)
  notes?: string; // Optional customer / order notes
  refundReason?: string;
  refundApprovedBy?: string;
  refundedAt?: string;
  refundMethod?: "CASH" | "QRIS";
  voidReason?: string;
  voidApprovedBy?: string;
  voidedAt?: string;

  // Critical Time Tracking Timestamps
  createdAt: string;            // 1. Order Created
  confirmedAt?: string;          // 2. Confirmed / Paid
  kitchenReceivedAt?: string;    // 3. Kitchen Received / Accepted
  cookingStartedAt?: string;     // 4. Cooking Started
  cookingFinishedAt?: string;    // 5. Cooking Finished (Marked Ready)
  readyAt?: string;              // 6. Ready at Pick-up Station
  servedAt?: string;             // 7. Served to Customer
  completedAt?: string;          // 8. Order Closed / Bill Closed

  statusHistory: OrderStatusHistoryItem[];
}

export interface OrderTimeMetrics {
  kitchenQueueMinutes: number;   // kitchenReceivedAt - confirmedAt
  cookingMinutes: number;        // readyAt - cookingStartedAt
  servingMinutes: number;        // servedAt - readyAt
  totalCustomerWaitingMinutes: number; // servedAt (or now) - createdAt
  totalFulfillmentMinutes: number;     // completedAt - createdAt
  slaStatus: SLAStatus;
  isDelayed: boolean;
  delayMinutes: number;
}

export interface OperationalBottleneckSummary {
  avgKitchenQueueMinutes: number;
  avgCookingMinutes: number;
  avgServingMinutes: number;
  avgTotalWaitingMinutes: number;
  targetServiceMinutes: number;
  totalOrders: number;
  delayedOrdersCount: number;
  delayedPercentage: number;
  primaryBottleneck: "KITCHEN_QUEUE" | "COOKING" | "SERVING" | "BALANCED";
  diagnosisStatement: string;
}
