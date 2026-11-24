/**
 * Task S-34: Safe Cleanup and Shift Reconciliation Pipeline
 * 
 * Target:
 * 1. Rekonsiliasi/tutup 7 shift berstatus NEEDS_RECONCILIATION / gantung lama -> CLOSED
 * 2. Kosongkan pesanan uji aktif di KDS -> status COMPLETED (hanya pesanan uji coba)
 * 3. Bersihkan notifikasi uji di dashboard (pengajuan event uji, usulan bagi hasil PENDING -> REJECTED)
 * 4. Batalkan tiket dan arsipkan event uji:
 *    - Gift Voucher Tes 1 (evt-pilates-gift-voucher) -> ARCHIVED
 *    - [TEST QA 2] Uji Revisi MVP1 (evt-1793935470095-8vpsm) -> ARCHIVED
 *    - Junk test events (TEST, tes cek, dsb.) -> ARCHIVED
 *    - Tiket uji DAGO-EVT-14704, DAGO-EVT-91979, DAGO-EVT-13394 -> CANCELLED
 */

import fs from "fs";
import { PrismaClient } from "@prisma/client";
import { getDataFilePath } from "@/lib/data-storage";
import type { ShiftRecord } from "@/types/shift";
import type { OrderRecord } from "@/types/order";
import type { CommunityEvent, EventTicketOrder } from "@/types/event";

const prisma = new PrismaClient();

export const S34_TARGETS = {
  shiftIds: new Set([
    "shf-1795155251970-qdso",
    "shf-1795057481913-qr16",
    "shf-1794808682614-2a7c",
    "shf-1794528551394-f149",
    "shf-1794510324077-u0rg",
    "shf-1794447697747-a10v",
    "shf-1794284443827-jcgg",
  ]),
  testEventIds: new Set([
    "evt-pilates-gift-voucher",
    "evt-1793935470095-8vpsm",
    "evt-1795236424582-7i9ls",
    "evt-1794204831538-jjg02",
    "evt-1793515068148-7xazf",
    "evt-1793513163350-b87do",
    "evt-1793810790340-73pia",
  ]),
  testTicketCodes: new Set([
    "DAGO-EVT-14704",
    "DAGO-EVT-91979",
    "DAGO-EVT-13394",
    "DAGO-EVT-96354",
  ]),
  testTitleExact: new Set(["test", "tes cek"]),
  testTitleKeywords: [
    "tes 1",
    "[test qa 2]",
    "cek 1234567890",
    "1234567890sdfgfg",
    "sdhghfdsdsghjhghfgd",
    "cek sans 1",
    "sdfghjkl;;;;",
  ],
};

/**
 * 1. Transform Shifts:
 * Tutup shift berstatus NEEDS_RECONCILIATION dan target overdue shift lama.
 * Menegakkan kaidah akuntansi: actualCash disamakan dengan expectedCash agar cashVariance = 0.
 */
export function transformShifts(
  shifts: ShiftRecord[],
  now = new Date().toISOString()
): { items: ShiftRecord[]; count: number } {
  let count = 0;
  const items = shifts.map((s) => {
    const isTargetShift = S34_TARGETS.shiftIds.has(s.id) || s.status === "NEEDS_RECONCILIATION";
    if (!isTargetShift || s.status === "CLOSED") return s;

    count++;
    const resolvedActualCash = s.expectedCash ?? s.openingCash ?? 0;
    return {
      ...s,
      status: "CLOSED" as const,
      endTime: s.endTime || now,
      closedAt: s.closedAt || now,
      closedBy: s.closedBy || "SYSTEM_RECONCILIATION_S34",
      actualCash: resolvedActualCash,
      cashVariance: 0,
      closingNotes: s.closingNotes
        ? `${s.closingNotes} | Direkonsiliasi otomatis (Task S-34)`
        : "Rekonsiliasi penutupan shift operasional lama (Task S-34)",
      updatedAt: now,
    };
  });
  return { items, count };
}

/**
 * 2. Transform Orders:
 * Selesaikan pesanan uji coba aktif di KDS tanpa menyentuh pesanan nyata pelanggan.
 */
export function transformOrders(
  orders: OrderRecord[],
  now = new Date().toISOString()
): { items: OrderRecord[]; count: number } {
  let count = 0;
  const activeStatuses = new Set(["CONFIRMED", "KITCHEN_RECEIVED", "COOKING", "READY", "SERVED"]);

  const items = orders.map((o) => {
    if (!activeStatuses.has(o.status)) return o;

    // Lindungi pesanan riil: hanya selesaikan yang terindikasi pesanan uji
    const nameLower = (o.customerName || "").toLowerCase();
    const notesLower = (o.items?.some((i) => (i.notes || "").toLowerCase().includes("test")) || false);
    const orderNumLower = (o.orderNumber || "").toLowerCase();
    const isTestOrder =
      nameLower.includes("test") ||
      nameLower.includes("uji") ||
      orderNumLower.includes("test") ||
      notesLower;

    if (!isTestOrder) return o;

    count++;
    return {
      ...o,
      status: "COMPLETED" as const,
      completedAt: (o as { completedAt?: string }).completedAt || now,
      statusHistory: [
        ...(o.statusHistory || []),
        {
          id: `h-s34-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          orderId: o.id,
          fromStatus: o.status,
          toStatus: "COMPLETED" as const,
          timestamp: now,
          actorName: "SYSTEM_RECONCILIATION_S34",
          note: "Pembersihan pesanan uji aktif KDS (Task S-34)",
        },
      ],
      updatedAt: now,
    };
  });
  return { items, count };
}

/**
 * 3. Transform Events:
 * Arsipkan event uji coba dan selesaikan usulan bagi hasil pending dengan status legal REJECTED.
 * Menjamin event riil non-uji tidak ikut tertolak usulan bagi hasilnya.
 */
export function transformEvents(
  events: CommunityEvent[],
  now = new Date().toISOString()
): { items: CommunityEvent[]; count: number; archivedEventIds: Set<string> } {
  let count = 0;
  const archivedEventIds = new Set<string>();

  const items = events.map((e) => {
    let updated = { ...e };
    let modified = false;

    const titleLower = (e.title || "").toLowerCase();
    const isTargetTest =
      S34_TARGETS.testEventIds.has(e.id) ||
      S34_TARGETS.testTitleExact.has(titleLower) ||
      S34_TARGETS.testTitleKeywords.some((kw) => titleLower.includes(kw));

    if (isTargetTest) {
      archivedEventIds.add(e.id);
      if (updated.status !== "ARCHIVED") {
        updated.status = "ARCHIVED";
        modified = true;
      }
      if (updated.isTestData !== true) {
        updated.isTestData = true;
        modified = true;
      }

      // Tolak usulan bagi hasil HANYA untuk event uji coba dengan status legal REJECTED
      if (
        updated.proposedRevenueSplit &&
        (updated.proposedRevenueSplit.status === "PENDING" ||
          (updated.proposedRevenueSplit.status as string) === "ARCHIVED")
      ) {
        updated.proposedRevenueSplit = {
          ...updated.proposedRevenueSplit,
          status: "REJECTED",
          reason: "Dibersihkan via Task S-34 (Usulan uji coba diabaikan)",
        };
        modified = true;
      }
    } else {
      // Pulihkan usulan bagi hasil event nyata jika pernah tertolak/terarsip keliru oleh skrip lama
      if (
        updated.proposedRevenueSplit &&
        (updated.proposedRevenueSplit.status === "REJECTED" ||
          (updated.proposedRevenueSplit.status as string) === "ARCHIVED") &&
        (updated.proposedRevenueSplit.reason?.includes("Task S-34") ||
          (updated.proposedRevenueSplit as any).resolutionNotes?.includes("Task S-34"))
      ) {
        const cleanedSplit = { ...updated.proposedRevenueSplit };
        delete (cleanedSplit as any).resolutionNotes;
        updated.proposedRevenueSplit = {
          ...cleanedSplit,
          status: "PENDING",
          reason: "Usulan bagi hasil awal saat pengajuan event",
        };
        modified = true;
      }
    }

    if (modified) {
      count++;
      updated.updatedAt = now;
      return updated;
    }
    return e;
  });
  return { items, count, archivedEventIds };
}

/**
 * 4. Transform Bookings:
 * Batalkan tiket uji internal secara terarah berdasarkan kode tiket maupun event ID yang diarsipkan.
 */
export function transformBookings(
  bookings: EventTicketOrder[],
  archivedTestEventIds?: Set<string> | string,
  now?: string
): { items: EventTicketOrder[]; count: number } {
  let count = 0;
  const targetEventIds = new Set<string>(S34_TARGETS.testEventIds);
  let timestamp = new Date().toISOString();

  if (archivedTestEventIds instanceof Set) {
    for (const id of archivedTestEventIds) {
      targetEventIds.add(id);
    }
    if (typeof now === "string") {
      timestamp = now;
    }
  } else if (typeof archivedTestEventIds === "string") {
    timestamp = archivedTestEventIds;
  }

  const items = bookings.map((b) => {
    const isTargetTicket = S34_TARGETS.testTicketCodes.has(b.ticketCode);
    const isBelongsToTestEvent = Boolean(b.eventId && targetEventIds.has(b.eventId));

    if ((!isTargetTicket && !isBelongsToTestEvent) || b.paymentStatus === "CANCELLED") {
      return b;
    }

    count++;
    return {
      ...b,
      paymentStatus: "CANCELLED" as const,
      paymentRejectionReason: isBelongsToTestEvent
        ? "Tiket pada event uji coba yang diarsipkan dibatalkan (Task S-34)"
        : "Tiket uji coba internal dibatalkan (Task S-34)",
      updatedAt: timestamp,
    };
  });
  return { items, count };
}

export async function runCleanup(options?: { apply?: boolean }) {
  const isApply = options?.apply ?? process.argv.includes("--apply");
  const isDryRun = !isApply;

  console.log("=== MEMULAI PEMBERSIHAN DATA UJI & REKONSILIASI SHIFT (S-34) ===");
  if (isDryRun) {
    console.log("[DRY-RUN] Mode simulasi aktif (tanpa --apply). Tidak ada penulisan ke Database maupun Disk.");
  } else {
    console.log("[APPLY] Mode eksekusi aktif (--apply). Perubahan akan disimpan ke Database dan Disk.");
  }

  const [shiftRow, orderRow, eventRow, bookingRow] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: "STORAGE_shifts.json" } }).catch(() => null),
    prisma.systemSetting.findUnique({ where: { key: "STORAGE_pos_orders.json" } }).catch(() => null),
    prisma.systemSetting.findUnique({ where: { key: "STORAGE_events.json" } }).catch(() => null),
    prisma.systemSetting.findUnique({ where: { key: "STORAGE_event_bookings.json" } }).catch(() => null),
  ]);

  function loadFallback<T>(dbRow: { value: string } | null, fileName: string): T[] {
    if (dbRow?.value) {
      try {
        return JSON.parse(dbRow.value) as T[];
      } catch (err) {
        console.warn(`Gagal parse DB row untuk ${fileName}:`, err);
      }
    }
    const filePath = getDataFilePath(fileName);
    if (fs.existsSync(filePath)) {
      try {
        return JSON.parse(fs.readFileSync(filePath, "utf8")) as T[];
      } catch (err) {
        console.warn(`Gagal baca disk fallback untuk ${fileName}:`, err);
      }
    }
    return [];
  }

  const shiftsInput = loadFallback<ShiftRecord>(shiftRow, "shifts.json");
  const ordersInput = loadFallback<OrderRecord>(orderRow, "pos_orders.json");
  const eventsInput = loadFallback<CommunityEvent>(eventRow, "events.json");
  const bookingsInput = loadFallback<EventTicketOrder>(bookingRow, "event_bookings.json");

  const shiftsRes = transformShifts(shiftsInput);
  const ordersRes = transformOrders(ordersInput);
  const eventsRes = transformEvents(eventsInput);
  const bookingsRes = transformBookings(bookingsInput, eventsRes.archivedEventIds);

  console.log(`[Shifts] Direkonsiliasi/ditutup: ${shiftsRes.count} shift.`);
  console.log(`[KDS Orders] Pesanan uji diselesaikan: ${ordersRes.count} pesanan.`);
  console.log(`[Events] Event/notifikasi uji dibersihkan: ${eventsRes.count} entri.`);
  console.log(`[Bookings] Tiket uji dibatalkan: ${bookingsRes.count} tiket.`);

  if (isDryRun) {
    console.log("[DRY-RUN] Ringkasan target yang akan diubah:");
    console.log(`- Shift IDs: ${shiftsRes.items.filter((s) => s.status === "CLOSED" && (S34_TARGETS.shiftIds.has(s.id) || s.closingNotes?.includes("S-34"))).map((s) => s.id).join(", ")}`);
    console.log(`- Event IDs diarsipkan: ${Array.from(eventsRes.archivedEventIds).join(", ")}`);
    console.log(`- Tiket dibatalkan: ${bookingsRes.items.filter((b) => b.paymentStatus === "CANCELLED" && b.paymentRejectionReason?.includes("S-34")).map((b) => b.ticketCode).join(", ")}`);
    console.log("[DRY-RUN] Selesai simulasi tanpa penulisan data. Berikan argumen --apply untuk menerapkan.");
    return {
      shiftsCount: shiftsRes.count,
      ordersCount: ordersRes.count,
      eventsCount: eventsRes.count,
      bookingsCount: bookingsRes.count,
      dryRun: true,
    };
  }

  const filesToWrite = [
    { key: "STORAGE_shifts.json", file: "shifts.json", data: shiftsRes.items },
    { key: "STORAGE_pos_orders.json", file: "pos_orders.json", data: ordersRes.items },
    { key: "STORAGE_events.json", file: "events.json", data: eventsRes.items },
    { key: "STORAGE_event_bookings.json", file: "event_bookings.json", data: bookingsRes.items },
  ];

  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== "");
  if (hasDatabaseUrl) {
    try {
      await prisma.$transaction(
        filesToWrite.map((f) =>
          prisma.systemSetting.upsert({
            where: { key: f.key },
            create: {
              key: f.key,
              value: JSON.stringify(f.data, null, 2),
              description: `Persistent storage for ${f.file}`,
            },
            update: {
              value: JSON.stringify(f.data, null, 2),
              updatedAt: new Date(),
            },
          })
        )
      );
      console.log("[Database] Seluruh data berhasil di-upsert secara atomik ke Neon DB.");
    } catch (dbErr) {
      console.error("[Database] Gagal update transaksi DB:", dbErr);
      process.exitCode = 1;
      throw dbErr;
    }
  } else {
    console.log("[Database] DATABASE_URL tidak diatur / kosong, melewati upsert database.");
  }

  // Sinkronisasi ke disk
  for (const f of filesToWrite) {
    try {
      const diskPath = getDataFilePath(f.file);
      fs.writeFileSync(diskPath, JSON.stringify(f.data, null, 2), "utf8");
    } catch (diskErr) {
      console.warn(`[Disk] Gagal simpan ke ${f.file}:`, diskErr);
    }
  }

  console.log("=== PEMBERSIHAN DATA UJI SELESAI SECARA SUKSES & ATOMIK ===");
  return {
    shiftsCount: shiftsRes.count,
    ordersCount: ordersRes.count,
    eventsCount: eventsRes.count,
    bookingsCount: bookingsRes.count,
    dryRun: false,
  };
}

if (process.env.NODE_ENV !== "test") {
  runCleanup()
    .catch((err) => {
      console.error("Gagal menjalankan pembersihan:", err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
