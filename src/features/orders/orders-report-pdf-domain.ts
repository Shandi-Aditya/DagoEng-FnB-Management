import type { OrderRecord } from "@/types/order";

export interface OrdersReportPdfMetrics {
  totalRevenue: number;
  completedCount: number;
  inProgressCount: number;
  totalItemsSold: number;
}

export interface OrdersReportSignatory {
  role: string;
  name: string;
  outlet: string;
}

export interface OrdersReportSignatories {
  preparer: OrdersReportSignatory;
  reviewer: OrdersReportSignatory;
  approver: OrdersReportSignatory;
}

/**
 * Menghitung metrik ringkasan eksekutif laporan pesanan secara murni dan deterministik.
 */
export function computeOrdersReportPdfMetrics(orders: readonly OrderRecord[]): OrdersReportPdfMetrics {
  let totalRevenue = 0;
  let completedCount = 0;
  let inProgressCount = 0;
  let totalItemsSold = 0;

  for (const order of orders) {
    totalRevenue += order.total || 0;

    if (order.status === "COMPLETED") {
      completedCount++;
    } else if (
      order.status === "CONFIRMED" ||
      order.status === "COOKING" ||
      order.status === "SERVED"
    ) {
      inProgressCount++;
    }

    if (order.items && Array.isArray(order.items)) {
      for (const item of order.items) {
        totalItemsSold += item.quantity || 0;
      }
    }
  }

  return {
    totalRevenue,
    completedCount,
    inProgressCount,
    totalItemsSold,
  };
}

/**
 * Menghasilkan nomor dokumen laporan pesanan yang deterministik dan dapat diaudit.
 */
export function buildOrdersReportDocNumber(date: Date, totalCount: number): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `REP-ORD-${year}${month}${day}-${totalCount}`;
}

/**
 * Membangun struktur 3 pihak penandatangan otorisasi akuntabilitas operasional gerai.
 */
export function buildOrdersReportSignatories(
  generatedBy?: string,
  outletName?: string
): OrdersReportSignatories {
  const outlet = outletName || "Singaraja (Pusat)";
  const preparerName = generatedBy?.trim() || "Staf / Kasir Aktif";

  return {
    preparer: {
      role: "Staf / Kasir POS",
      name: preparerName,
      outlet,
    },
    reviewer: {
      role: "Supervisor Gerai",
      name: `Supervisor Gerai ${outlet}`,
      outlet,
    },
    approver: {
      role: "Pimpinan / Owner Gerai",
      name: `Pimpinan / Owner ${outlet}`,
      outlet,
    },
  };
}

/**
 * Memformat tanggal cetak dokumen sesuai konvensi resmi Indonesia (WITA).
 */
export function formatOrdersReportDate(date: Date): string {
  const d = new Date(date);

  const formattedDate = d.toLocaleDateString("id-ID", {
    timeZone: "Asia/Makassar",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const formattedTime = d.toLocaleTimeString("id-ID", {
    timeZone: "Asia/Makassar",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${formattedDate}, ${formattedTime} WITA`;
}
