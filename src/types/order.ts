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

export interface OrderItemRecord {
  id: string;
  productId?: string;
  tenantId?: string;
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
  tableNumber: string;
  customerName: string;
  orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  status: OrderStatus;
  items: OrderItemRecord[];
  subtotal: number;
  discount?: number;
  promoId?: string;
  tax: number;
  total: number;
  paymentStatus: "PENDING" | "PAID" | "REFUNDED";
  paymentMethod?: "CASH" | "QRIS" | "EDC" | "TRANSFER";
  targetServiceMinutes: number; // Target SLA in minutes (e.g. 10m or 15m)
  notes?: string; // Optional customer / order notes

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
