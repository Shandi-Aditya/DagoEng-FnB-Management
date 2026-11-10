import {
  PrinterDeviceConfig,
  POSPrintingSettings,
  KitchenTicketData,
  KitchenTicketItem,
  PrintJob,
  PrintPurpose,
  PrintJobStatus,
  DEFAULT_PRINTING_SETTINGS,
  PrinterPaperWidth,
} from "@/types/printer";
import { POSReceiptData } from "@/features/pos/types";
import { formatCurrencyIDR } from "@/lib/utils";

export const STORAGE_KEY_PRINT_QUEUE = "dagoeng_print_queue_v1";
export const STORAGE_KEY_PRINTER_DEVICES = "dagoeng_printer_devices_v1";
export const STORAGE_KEY_PRINTER_SETTINGS = "dagoeng_printer_settings_v1";

const MAX_QUEUE_HISTORY = 50;

/**
 * Membangun Idempotency Key untuk mencegah duplikasi print job otomatis.
 * Format: [orderId]_[purpose]_[sequenceNumber]
 */
export function buildIdempotencyKey(
  orderId: string,
  purpose: PrintPurpose,
  sequenceNumber: number = 1
): string {
  return `${orderId}_${purpose}_${sequenceNumber}`;
}

/**
 * Mengecek apakah job dengan idempotency key ini sudah pernah diproses.
 * Catatan penting: Manual REPRINT tidak pernah dianggap duplikat.
 */
export function isJobIdempotentDuplicate(
  queue: PrintJob[],
  key: string,
  purpose: PrintPurpose
): boolean {
  if (purpose === "REPRINT" || purpose === "TEST_PRINT") return false;

  return queue.some(
    (job) =>
      job.idempotencyKey === key &&
      job.status !== "FAILED"
  );
}

/**
 * Generator Nota Pesanan Dapur (Kitchen Order Ticket)
 * PRINSIP MUTLAK:
 * - Tidak boleh menampilkan harga menu
 * - Tidak boleh menampilkan subtotal
 * - Tidak boleh menampilkan pajak / service charge
 * - Tidak boleh menampilkan diskon
 * - Tidak boleh menampilkan total pembayaran
 * - Tidak boleh menampilkan metode pembayaran
 */
export function generateKitchenTicketText(
  ticket: KitchenTicketData,
  options?: {
    paperWidth?: PrinterPaperWidth;
    settings?: POSPrintingSettings;
  }
): string {
  const width = options?.paperWidth === "58mm" ? 32 : 42;
  const line = "-".repeat(width);
  const doubleLine = "=".repeat(width);

  let headerBadge = "NOTA PESANAN DAPUR";
  if (ticket.purpose === "ADDITIONAL_ORDER") {
    headerBadge = `PESANAN TAMBAHAN #${ticket.sequenceNumber || 1}`;
  } else if (ticket.purpose === "REPRINT") {
    headerBadge = "** SALINAN / REPRINT **";
  } else if (ticket.purpose === "CANCELLATION") {
    headerBadge = "!! PEMBATALAN PESANAN !!";
  }

  const lines: string[] = [
    doubleLine,
    centerText("DAGOENG CREATIVE HUB", width),
    centerText(ticket.outletName ? ticket.outletName.toUpperCase() : "OUTLET SINGARAJA", width),
    doubleLine,
    centerText(`[ ${headerBadge} ]`, width),
    doubleLine,
    `No. Pesanan : ${ticket.orderNumber}`,
    `Waktu       : ${ticket.timestamp}`,
    `Meja        : ${ticket.tableNumber || "-"}`,
    `Tipe        : ${ticket.orderType.replace("_", " ")}`,
    `Pelanggan   : ${ticket.customerName}`,
    `Petugas     : ${ticket.cashierName}`,
  ];

  if (ticket.reprintedBy) {
    lines.push(`Dicetak Ulg : ${ticket.reprintedBy} (${ticket.reprintedAt || "Baru saja"})`);
  }

  lines.push(line);
  lines.push("DAFTAR MENU PESANAN:");
  lines.push(line);

  if (!ticket.items || ticket.items.length === 0) {
    lines.push("  (Tidak ada item pesanan)");
  } else {
    ticket.items.forEach((item, idx) => {
      const qtyPrefix = `${item.quantity}x `;
      const name = item.productName.toUpperCase();
      lines.push(`${qtyPrefix}${name}`);

      if (item.variantName) {
        lines.push(`   Varian : ${item.variantName}`);
      }

      if (item.modifiers && item.modifiers.length > 0) {
        lines.push(`   Tambahan: ${item.modifiers.join(", ")}`);
      }

      if (item.notes && item.notes.trim()) {
        lines.push(`   *CATATAN: ${item.notes.trim()}`);
      }

      if (idx < ticket.items.length - 1) {
        lines.push("");
      }
    });
  }

  lines.push(line);

  if (ticket.kitchenNotes) {
    lines.push(`Instruksi : ${ticket.kitchenNotes}`);
    lines.push(line);
  }

  const footer = options?.settings?.kitchenFooterNote || "MOHON DIPROSES";
  lines.push(centerText(footer, width));
  lines.push(doubleLine);

  return lines.join("\n");
}

/**
 * Generator Struk Pelanggan (Customer Receipt)
 * Memuat informasi finansial lengkap.
 */
export function generateCustomerReceiptText(
  receipt: POSReceiptData,
  options?: { paperWidth?: PrinterPaperWidth }
): string {
  const width = options?.paperWidth === "58mm" ? 32 : 42;
  const line = "-".repeat(width);
  const doubleLine = "=".repeat(width);

  const lines: string[] = [
    doubleLine,
    centerText(receipt.outletName || "DAGO CREATIVE HUB", width),
    centerText("STRUK PEMBAYARAN KASIR", width),
    doubleLine,
    `No. Transaksi : ${receipt.orderNumber}`,
    `Tanggal       : ${receipt.date}`,
    `Kasir         : ${receipt.cashierName}`,
    `Tipe / Meja   : ${receipt.orderType} (Meja ${receipt.tableNumber || "-"})`,
    `Pelanggan     : ${receipt.customerName || "Tamu"}`,
    line,
  ];

  (receipt.items || []).forEach((item) => {
    const itemSub = formatCurrencyIDR(item.subtotal);
    lines.push(`${item.quantity}x ${item.name}`);
    lines.push(padBetween(`   @ ${formatCurrencyIDR(item.unitPrice)}`, itemSub, width));
    if (item.variantName) {
      lines.push(`   Varian: ${item.variantName}`);
    }
    if (item.modifiers && item.modifiers.length > 0) {
      lines.push(`   Opsi: ${item.modifiers.join(", ")}`);
    }
    if (item.notes) {
      lines.push(`   *Catatan: ${item.notes}`);
    }
  });

  lines.push(line);
  lines.push(padBetween("Subtotal", formatCurrencyIDR(receipt.subtotal), width));

  if (receipt.discount > 0) {
    lines.push(padBetween(`Diskon (${receipt.promoName || "Promo"})`, `-${formatCurrencyIDR(receipt.discount)}`, width));
  }

  lines.push(padBetween("Pajak PB1", formatCurrencyIDR(receipt.tax), width));

  if (receipt.serviceCharge > 0) {
    lines.push(padBetween("Service Charge", formatCurrencyIDR(receipt.serviceCharge), width));
  }

  lines.push(doubleLine);
  lines.push(padBetween("TOTAL TAGIHAN", formatCurrencyIDR(receipt.grandTotal), width));
  lines.push(padBetween(`Metode: ${receipt.paymentMethod}`, formatCurrencyIDR(receipt.amountPaid), width));
  lines.push(padBetween("Kembalian", formatCurrencyIDR(receipt.changeDue), width));
  lines.push(doubleLine);
  lines.push(centerText(receipt.receiptFooter || "Terima Kasih Atas Kunjungan Anda!", width));
  lines.push(doubleLine);

  return lines.join("\n");
}

/**
 * Helper untuk meratakan teks tengah
 */
function centerText(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  const left = Math.floor((width - text.length) / 2);
  const right = width - text.length - left;
  return " ".repeat(left) + text + " ".repeat(right);
}

/**
 * Helper untuk perataan kiri-kanan
 */
function padBetween(left: string, right: string, width: number): string {
  const total = left.length + right.length;
  if (total >= width) {
    return `${left} ${right}`;
  }
  return left + " ".repeat(width - total) + right;
}

/**
 * Ambil Antrean Cetak dari LocalStorage
 */
export function getStoredPrintQueue(): PrintJob[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRINT_QUEUE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Gagal membaca antrean cetak dari localStorage", err);
    return [];
  }
}

/**
 * Trim antrean cetak dengan proteksi:
 * Job berstatus QUEUED, PRINTING, FAILED, atau OFFLINE TIDAK BOLEH terhapus hanya karena limit riwayat.
 * Hanya riwayat job terminal (BRIDGE_ACKNOWLEDGED / SENT_TO_SPOOLER) yang dibatasi maksimal 50 item.
 */
export function trimQueuePreservingActionableJobs(
  queue: PrintJob[],
  maxTerminal: number = MAX_QUEUE_HISTORY
): PrintJob[] {
  const actionable = queue.filter(
    (j) =>
      j.status === "QUEUED" ||
      j.status === "PRINTING" ||
      j.status === "FAILED" ||
      j.status === "OFFLINE"
  );
  const terminal = queue.filter(
    (j) => j.status === "BRIDGE_ACKNOWLEDGED" || j.status === "SENT_TO_SPOOLER"
  );
  const trimmedTerminal = terminal.slice(0, maxTerminal);

  return queue.filter((j) => actionable.includes(j) || trimmedTerminal.includes(j));
}

/**
 * Simpan Antrean Cetak ke LocalStorage dengan Batas Kapasitas Riwayat Terminal (Maks 50 Job)
 * Menjamin job yang belum selesai atau membutuhkan tindakan kasir tidak hilang.
 */
export function saveStoredPrintQueue(queue: PrintJob[]): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = trimQueuePreservingActionableJobs(queue, MAX_QUEUE_HISTORY);
    localStorage.setItem(STORAGE_KEY_PRINT_QUEUE, JSON.stringify(trimmed));
  } catch (err) {
    console.error("Gagal menyimpan antrean cetak ke localStorage", err);
  }
}

/**
 * Pemulihan Job Menggantung (Stale Recovery):
 * Setiap job yang tertinggal dalam status 'PRINTING' saat browser ditutup / di-reload
 * dialihkan menjadi 'FAILED' dengan informasi kesalahan transparan.
 */
export function recoverStalePrintingJobs(queue: PrintJob[]): {
  recoveredQueue: PrintJob[];
  hasChanges: boolean;
} {
  let hasChanges = false;
  const recoveredQueue = queue.map((job) => {
    if (job.status === "PRINTING") {
      hasChanges = true;
      return {
        ...job,
        status: "FAILED" as PrintJobStatus,
        errorInfo: "Browser ditutup atau reload saat proses cetak berjalan. Silakan klik 'Coba Lagi'.",
      };
    }
    return job;
  });

  return { recoveredQueue, hasChanges };
}

/**
 * Dispatcher Pengiriman Cetak Bertingkat:
 * - Tier 1: Local Print Bridge (menguji koneksi nyata ke bridge lokal endpoint HTTP)
 * - Tier 2: Network LAN via Bridge (meneruskan relai IP port 9100 melalui local agent)
 * - Tier 3: Browser / System Print Spooler (fallback universal)
 */
export async function dispatchPrintJob(
  job: PrintJob,
  device: PrinterDeviceConfig
): Promise<{ status: PrintJobStatus; errorInfo?: string }> {
  // Jika perangkat nonaktif
  if (!device.isActive) {
    return {
      status: "FAILED",
      errorInfo: `Printer '${device.name}' sedang dalam status NON-AKTIF di pengaturan Admin.`,
    };
  }

  // 1. Jalur Local Print Bridge
  if (device.connectionType === "LOCAL_BRIDGE") {
    const endpoint = device.bridgeEndpoint || "http://localhost:8080/print";
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          orderNumber: job.orderNumber,
          purpose: job.purpose,
          receiptType: job.receiptType,
          paperWidth: device.paperWidth,
          printerName: device.name,
          content: job.payloadText,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        return {
          status: "BRIDGE_ACKNOWLEDGED",
        };
      } else {
        return {
          status: "FAILED",
          errorInfo: `Print Bridge merespons HTTP ${res.status}: ${res.statusText}`,
        };
      }
    } catch (err: any) {
      const isTimeout = err?.name === "AbortError";
      return {
        status: "OFFLINE",
        errorInfo: isTimeout
          ? `Koneksi ke Print Bridge timeout (${endpoint}). Pastikan agen lokal aktif.`
          : `Gagal menghubungi Print Bridge di ${endpoint}. Periksa kabel/driver printer lokal.`,
      };
    }
  }

  // 2. Jalur Network LAN via Local Bridge Relay
  if (device.connectionType === "NETWORK_LAN_VIA_BRIDGE") {
    if (!device.lanIpAddress) {
      return {
        status: "FAILED",
        errorInfo: "Alamat IP Printer LAN belum dikonfigurasi di pengaturan Admin.",
      };
    }

    const bridgeUrl = device.bridgeEndpoint || "http://localhost:8080/lan-print";
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(bridgeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetIp: device.lanIpAddress,
          targetPort: device.lanPort || 9100,
          paperWidth: device.paperWidth,
          content: job.payloadText,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        return { status: "BRIDGE_ACKNOWLEDGED" };
      } else {
        return {
          status: "FAILED",
          errorInfo: `Relai LAN merespons error HTTP ${res.status}`,
        };
      }
    } catch (err: any) {
      return {
        status: "OFFLINE",
        errorInfo: `Tidak dapat menjangkau printer LAN (${device.lanIpAddress}:${device.lanPort || 9100}) via relai bridge lokal.`,
      };
    }
  }

  // 3. Jalur Browser / System Print Spooler (Universal Fallback)
  // Menyiapkan isolated invisible iframe untuk mencetak payload thermal tanpa mengganggu UI kasir
  return new Promise<{ status: PrintJobStatus; errorInfo?: string }>((resolve) => {
    try {
      if (typeof window === "undefined") {
        resolve({ status: "SENT_TO_SPOOLER" });
        return;
      }

      // Buat elemen iframe tersembunyi
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.style.visibility = "hidden";

      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        document.body.removeChild(iframe);
        resolve({
          status: "FAILED",
          errorInfo: "Gagal menginisialisasi dokumen cetak browser.",
        });
        return;
      }

      const paperMm = device.paperWidth === "58mm" ? "58mm" : "80mm";
      const fontSize = device.paperWidth === "58mm" ? "10px" : "12px";

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${job.receiptType} - ${job.orderNumber || "Print Job"}</title>
          <style>
            @page {
              size: ${paperMm} auto;
              margin: 0;
            }
            body {
              font-family: 'Courier New', Courier, monospace, monospace;
              font-size: ${fontSize};
              line-height: 1.25;
              white-space: pre-wrap;
              word-wrap: break-word;
              padding: 6px;
              color: #000;
              background: #fff;
              margin: 0;
            }
          </style>
        </head>
        <body>${job.payloadText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          // Catat sebagai SENT_TO_SPOOLER (jujur, tidak mengklaim fisik sudah keluar)
          resolve({ status: "SENT_TO_SPOOLER" });
        } catch (printErr: any) {
          resolve({
            status: "FAILED",
            errorInfo: printErr?.message || "Dialog cetak dibatalkan atau diblokir browser.",
          });
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 1500);
        }
      }, 250);
    } catch (fatalErr: any) {
      resolve({
        status: "FAILED",
        errorInfo: fatalErr?.message || "Kesalahan fatal saat memproses spooler cetak browser.",
      });
    }
  });
}

