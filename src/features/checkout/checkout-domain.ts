export type CheckoutPaymentMethod = "QRIS" | "BCA_VA" | "CREDIT_CARD";

export interface TransactionDetails {
  id: string;
  ticketCode: string;
  eventId: string;
  eventTitle: string;
  guestName: string;
  guestEmail: string;
  ticketCount: number;
  unitPrice: number;
  totalPrice: number;
  paymentStatus: "PENDING" | "PAID" | "CANCELLED";
  dokuInvoiceNumber: string;
}

export interface CheckoutMethodInfo {
  label: string;
  sublabel: string;
}

export function getCheckoutMethodLabel(method: CheckoutPaymentMethod | string): CheckoutMethodInfo {
  switch (method) {
    case "BCA_VA":
      return {
        label: "Virtual account",
        sublabel: "BCA / Mandiri / BNI",
      };
    case "CREDIT_CARD":
      return {
        label: "Kartu kredit",
        sublabel: "Visa / Mastercard / JCB",
      };
    case "QRIS":
    default:
      return {
        label: "QRIS",
        sublabel: "Pembayaran instan QRIS",
      };
  }
}

export function formatInvoiceNumber(
  invoice?: string | null,
  ticketCode?: string | null
): string {
  if (invoice && invoice.trim() !== "") {
    return invoice.trim();
  }
  if (ticketCode && ticketCode.trim() !== "") {
    return `INV-${ticketCode.trim()}`;
  }
  return `INV-${Date.now()}`;
}

export function buildDokuSimulationPayload(
  invoiceNumber: string,
  status: "SUCCESS" | "FAILED",
  token: string
) {
  const safeInvoice = formatInvoiceNumber(invoiceNumber);
  return {
    invoiceNumber: safeInvoice,
    status,
    token,
  };
}

export function isTransactionSettled(status: string): boolean {
  return status === "PAID" || status === "CANCELLED";
}
