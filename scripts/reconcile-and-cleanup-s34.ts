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
import path from "path";
import { PrismaClient } from "@prisma/client";
import { getDataFilePath } from "@/lib/data-storage";
import type { ShiftRecord } from "@/types/shift";
import type { OrderRecord } from "@/types/order";
import type { CommunityEvent, EventTicketOrder } from "@/types/event";

export const prisma = new PrismaClient();

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
    "evt-1793073538004-rekb8",
    "evt-1793004679533-13yqp",
    "evt-1793073371363-zli0p",
    "evt-1793083665642-lv4kl",
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

type LegacyProposedRevenueSplit = Omit<
  NonNullable<CommunityEvent["proposedRevenueSplit"]>,
  "status"
> & {
  status: NonNullable<CommunityEvent["proposedRevenueSplit"]>["status"] | "ARCHIVED";
  resolutionNotes?: string;
};

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
    const updated = { ...e };
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
      if (updated.proposedRevenueSplit) {
        const split: LegacyProposedRevenueSplit = updated.proposedRevenueSplit;
        if (split.status === "PENDING" || split.status === "ARCHIVED") {
          updated.proposedRevenueSplit = {
            ...updated.proposedRevenueSplit,
            status: "REJECTED",
            reason: "Dibersihkan via Task S-34 (Usulan uji coba diabaikan)",
          };
          modified = true;
        }
      }
    } else {
      // Pulihkan usulan bagi hasil event nyata jika pernah tertolak/terarsip keliru oleh skrip lama
      if (updated.proposedRevenueSplit) {
        const split: LegacyProposedRevenueSplit = updated.proposedRevenueSplit;
        if (
          (split.status === "REJECTED" || split.status === "ARCHIVED") &&
          (split.reason?.includes("Task S-34") ||
            split.resolutionNotes?.includes("Task S-34"))
        ) {
          const { resolutionNotes: _removed, ...restSplit } = split;
          void _removed;
          updated.proposedRevenueSplit = {
            ...restSplit,
            status: "PENDING",
            reason: "Usulan bagi hasil awal saat pengajuan event",
          };
          modified = true;
        }
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

export interface CleanupStore {
  findSetting: (key: string) => Promise<{ value: string } | null>;
  upsertSettings: (
    entries: Array<{ key: string; file: string; value: string }>
  ) => Promise<void>;
}

const prismaCleanupStore: CleanupStore = {
  findSetting: (key) => prisma.systemSetting.findUnique({ where: { key } }),
  upsertSettings: async (entries) => {
    await prisma.$transaction(
      entries.map((f) =>
        prisma.systemSetting.upsert({
          where: { key: f.key },
          create: {
            key: f.key,
            value: f.value,
            description: `Persistent storage for ${f.file}`,
          },
          update: {
            value: f.value,
            updatedAt: new Date(),
          },
        })
      )
    );
  },
};

type SourceOrigin = "db" | "disk" | "missing" | "unreadable";

interface LoadedSource<T> {
  items: T[];
  origin: SourceOrigin;
  diskExists: boolean;
  hasNonEmptyDbRow: boolean;
}

function loadSource<T>(dbRow: { value: string } | null, fileName: string): LoadedSource<T> {
  const filePath = getDataFilePath(fileName);
  const diskExists = fs.existsSync(filePath);

  if (dbRow !== null) {
    if (!dbRow.value || dbRow.value.trim() === "") {
      return {
        items: [],
        origin: "unreadable",
        diskExists,
        hasNonEmptyDbRow: false,
      };
    }
    try {
      const parsed: unknown = JSON.parse(dbRow.value);
      if (!Array.isArray(parsed)) {
        console.warn(`Payload DB bukan array untuk ${fileName}.`);
        return {
          items: [],
          origin: "unreadable",
          diskExists,
          hasNonEmptyDbRow: false,
        };
      }
      return {
        items: parsed as T[],
        origin: "db",
        diskExists,
        hasNonEmptyDbRow: parsed.length > 0,
      };
    } catch (err) {
      console.warn(`Gagal parse DB row untuk ${fileName}:`, err);
      return {
        items: [],
        origin: "unreadable",
        diskExists,
        hasNonEmptyDbRow: false,
      };
    }
  }

  if (diskExists) {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (!Array.isArray(parsed)) {
        console.warn(`Payload disk bukan array untuk ${fileName}.`);
        return {
          items: [],
          origin: "unreadable",
          diskExists: true,
          hasNonEmptyDbRow: false,
        };
      }
      return {
        items: parsed as T[],
        origin: "disk",
        diskExists: true,
        hasNonEmptyDbRow: false,
      };
    } catch (err) {
      console.warn(`Gagal baca disk fallback untuk ${fileName}:`, err);
      return {
        items: [],
        origin: "unreadable",
        diskExists: true,
        hasNonEmptyDbRow: false,
      };
    }
  }

  return {
    items: [],
    origin: "missing",
    diskExists: false,
    hasNonEmptyDbRow: false,
  };
}

export async function runCleanup(options?: {
  apply?: boolean;
  store?: CleanupStore;
}) {
  const isApply = options?.apply ?? process.argv.includes("--apply");
  const isDryRun = !isApply;
  const store = options?.store ?? prismaCleanupStore;
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== "");

  console.log("=== MEMULAI PEMBERSIHAN DATA UJI & REKONSILIASI SHIFT (S-34) ===");
  if (isDryRun) {
    console.log("[DRY-RUN] Mode simulasi aktif (tanpa --apply). Tidak ada penulisan ke Database maupun Disk.");
  } else {
    console.log("[APPLY] Mode eksekusi aktif (--apply). Perubahan akan disimpan ke Database dan Disk.");
  }

  let shiftRow: { value: string } | null = null;
  let orderRow: { value: string } | null = null;
  let eventRow: { value: string } | null = null;
  let bookingRow: { value: string } | null = null;

  if (hasDatabaseUrl) {
    try {
      [shiftRow, orderRow, eventRow, bookingRow] = await Promise.all([
        store.findSetting("STORAGE_shifts.json"),
        store.findSetting("STORAGE_pos_orders.json"),
        store.findSetting("STORAGE_events.json"),
        store.findSetting("STORAGE_event_bookings.json"),
      ]);
    } catch (dbErr) {
      console.error("[Database] Gagal membaca data SystemSetting dari DB:", dbErr);
      process.exitCode = 1;
      throw dbErr;
    }
  }

  const shiftsSource = loadSource<ShiftRecord>(shiftRow, "shifts.json");
  const ordersSource = loadSource<OrderRecord>(orderRow, "pos_orders.json");
  const eventsSource = loadSource<CommunityEvent>(eventRow, "events.json");
  const bookingsSource = loadSource<EventTicketOrder>(bookingRow, "event_bookings.json");

  const shiftsRes = transformShifts(shiftsSource.items);
  const ordersRes = transformOrders(ordersSource.items);
  const eventsRes = transformEvents(eventsSource.items);
  const bookingsRes = transformBookings(bookingsSource.items, eventsRes.archivedEventIds);

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

  const datasets = [
    {
      key: "STORAGE_shifts.json",
      file: "shifts.json",
      data: shiftsRes.items,
      count: shiftsRes.count,
      source: shiftsSource,
    },
    {
      key: "STORAGE_pos_orders.json",
      file: "pos_orders.json",
      data: ordersRes.items,
      count: ordersRes.count,
      source: ordersSource,
    },
    {
      key: "STORAGE_events.json",
      file: "events.json",
      data: eventsRes.items,
      count: eventsRes.count,
      source: eventsSource,
    },
    {
      key: "STORAGE_event_bookings.json",
      file: "event_bookings.json",
      data: bookingsRes.items,
      count: bookingsRes.count,
      source: bookingsSource,
    },
  ];

  const dbTargets = datasets.filter((d) => {
    if (d.source.origin === "missing" || d.source.origin === "unreadable") {
      return false;
    }
    if (d.count === 0) {
      return false;
    }
    if (d.source.origin === "db" && !d.source.hasNonEmptyDbRow) {
      return false;
    }
    return d.data.length > 0;
  });

  if (hasDatabaseUrl) {
    if (dbTargets.length > 0) {
      try {
        await store.upsertSettings(
          dbTargets.map((f) => ({
            key: f.key,
            file: f.file,
            value: JSON.stringify(f.data, null, 2),
          }))
        );
        console.log(`[Database] ${dbTargets.length} key berhasil di-upsert secara atomik ke Neon DB.`);
      } catch (dbErr) {
        console.error("[Database] Gagal update transaksi DB:", dbErr);
        process.exitCode = 1;
        throw dbErr;
      }
    } else {
      console.log("[Database] Tidak ada key yang dimodifikasi dari sumber valid; melewati upsert database.");
    }
  } else {
    console.log("[Database] DATABASE_URL tidak diatur / kosong, melewati upsert database.");
  }

  // Sinkronisasi ke disk hanya untuk dataset valid yang dimodifikasi dan tidak menciptakan file kosong baru
  const diskTargets = datasets.filter((d) => {
    if (d.source.origin === "missing" || d.source.origin === "unreadable") {
      return false;
    }
    if (d.count === 0) {
      return false;
    }
    if (!d.source.diskExists && d.data.length === 0) {
      return false;
    }
    return d.data.length > 0 || d.source.diskExists;
  });

  for (const f of diskTargets) {
    try {
      const diskPath = getDataFilePath(f.file);
      fs.mkdirSync(path.dirname(diskPath), { recursive: true });
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
