export type PrinterConnectionType =
  | "BROWSER_SYSTEM"
  | "LOCAL_BRIDGE"
  | "NETWORK_LAN_VIA_BRIDGE";

export type PrinterPaperWidth = "58mm" | "80mm";

export type PrinterRole = "CUSTOMER_RECEIPT" | "KITCHEN_ORDER" | "BAR_STATION" | "ALL";

export type PrintJobStatus =
  | "QUEUED"
  | "PRINTING"
  | "BRIDGE_ACKNOWLEDGED"
  | "SENT_TO_SPOOLER"
  | "FAILED"
  | "OFFLINE";

export type PrintPurpose =
  | "NEW_ORDER"
  | "ADDITIONAL_ORDER"
  | "REPRINT"
  | "CANCELLATION"
  | "TEST_PRINT";

export type ReceiptType = "CUSTOMER_RECEIPT" | "KITCHEN_ORDER";

export interface PrinterDeviceConfig {
  id: string;
  name: string;
  outletId: string; // "ALL" or specific e.g. "outlet-sgr"
  outletName?: string;
  role: PrinterRole;
  connectionType: PrinterConnectionType;
  bridgeEndpoint?: string; // e.g. "http://localhost:8080/print"
  lanIpAddress?: string; // for NETWORK_LAN_VIA_BRIDGE e.g. "192.168.1.200"
  lanPort?: number; // default 9100
  paperWidth: PrinterPaperWidth;
  isActive: boolean;
  isDefaultCustomer: boolean;
  isDefaultKitchen: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface POSPrintingSettings {
  autoPrintKitchenOrder: boolean;
  autoPrintCustomerReceipt: boolean;
  kitchenCopies: number;
  customerCopies: number;
  kitchenFontSize: "NORMAL" | "LARGE";
  includeNotesOnKitchenTicket: boolean;
  includeModifiersOnKitchenTicket: boolean;
  autoPrintAdditionalOrder: boolean;
  autoPrintCancellationNotice: boolean;
  reprintWatermarkEnabled: boolean;
  maxRetryAttempts: number;
  kitchenHeaderNote?: string;
  kitchenFooterNote?: string;
}

export interface KitchenTicketItem {
  id: string;
  productName: string;
  quantity: number;
  variantName?: string;
  modifiers?: string[];
  notes?: string;
  isAdditional?: boolean;
}

export interface KitchenTicketData {
  orderId: string;
  orderNumber: string;
  outletId: string;
  outletName: string;
  tableNumber: string;
  customerName: string;
  orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  purpose: PrintPurpose;
  sequenceNumber?: number; // e.g. for ADDITIONAL_ORDER #1, #2
  items: KitchenTicketItem[];
  cashierName: string;
  timestamp: string;
  reprintedBy?: string;
  reprintedAt?: string;
  kitchenNotes?: string;
}

export interface PrintJob {
  id: string;
  idempotencyKey?: string;
  orderId?: string;
  orderNumber?: string;
  outletId: string;
  printerId: string;
  printerName: string;
  receiptType: ReceiptType;
  purpose: PrintPurpose;
  sequenceNumber?: number;
  payloadText: string;
  status: PrintJobStatus;
  attempts: number;
  lastAttemptAt?: string;
  errorInfo?: string;
  createdAt: string;
  completedAt?: string;
  reprintedBy?: string;
}

export const DEFAULT_PRINTER_DEVICES: PrinterDeviceConfig[] = [
  {
    id: "prn-cashier-default",
    name: "Printer Kasir Thermal (Default)",
    outletId: "ALL",
    outletName: "Semua Outlet",
    role: "CUSTOMER_RECEIPT",
    connectionType: "BROWSER_SYSTEM",
    paperWidth: "80mm",
    isActive: true,
    isDefaultCustomer: true,
    isDefaultKitchen: false,
    notes: "Printer struk transaksi pelanggan via browser/system spooler.",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "prn-kitchen-default",
    name: "Printer Dapur Thermal (Default)",
    outletId: "ALL",
    outletName: "Semua Outlet",
    role: "KITCHEN_ORDER",
    connectionType: "BROWSER_SYSTEM",
    paperWidth: "80mm",
    isActive: true,
    isDefaultCustomer: false,
    isDefaultKitchen: true,
    notes: "Printer nota dapur otomatis via system spooler / local bridge.",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

export const DEFAULT_PRINTING_SETTINGS: POSPrintingSettings = {
  autoPrintKitchenOrder: true,
  autoPrintCustomerReceipt: false,
  kitchenCopies: 1,
  customerCopies: 1,
  kitchenFontSize: "LARGE",
  includeNotesOnKitchenTicket: true,
  includeModifiersOnKitchenTicket: true,
  autoPrintAdditionalOrder: true,
  autoPrintCancellationNotice: true,
  reprintWatermarkEnabled: true,
  maxRetryAttempts: 3,
  kitchenHeaderNote: "DAGOENG — NOTA OPERASIONAL DAPUR",
  kitchenFooterNote: "MOHON DIPROSES",
};

