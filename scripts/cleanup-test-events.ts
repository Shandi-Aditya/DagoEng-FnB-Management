/**
 * Test Events & Bookings Safe Cleanup Script (Task S-02)
 *
 * Usage:
 *   npx tsx scripts/cleanup-test-events.ts          # Dry-run mode (Preview only, no data deleted)
 *   npx tsx scripts/cleanup-test-events.ts --apply  # Execution mode (Permanently clean eligible test data)
 */

import fs from "fs";
import path from "path";
import {
  loadEventsFromDisk,
  saveEventsToDisk,
  loadBookingsFromDisk,
  saveBookingsToDisk,
  appendAuditLog,
} from "../src/lib/events";
import type { CommunityEvent, EventTicketOrder } from "../src/types/event";

const isApply = process.argv.includes("--apply");

function isIdentifiedTestData(event: CommunityEvent): boolean {
  if (event.isTestData) return true;
  const t = (event.title || "").toLowerCase();
  const d = (event.description || "").toLowerCase();
  const o = (event.organizerName || "").toLowerCase();
  const id = (event.id || "").toLowerCase();

  return (
    id.startsWith("evt-test") ||
    id.startsWith("evt-dist-lock") ||
    id.startsWith("evt-zero-booking") ||
    id.includes("disposable") ||
    t.includes("test") ||
    t.includes("testing") ||
    t.includes("uji coba") ||
    t.includes("dummy") ||
    o.includes("test") ||
    o.includes("fixing bug")
  );
}

function isIdentifiedTestBooking(booking: EventTicketOrder): boolean {
  const n = (booking.guestName || "").toLowerCase();
  const e = (booking.guestEmail || "").toLowerCase();
  const id = (booking.id || "").toLowerCase();

  return (
    id.startsWith("bk-test") ||
    id.startsWith("bk-init") ||
    id.startsWith("tkt-test") ||
    n.includes("test") ||
    n.includes("dummy") ||
    e.includes("example.com") ||
    e.includes("@test.com")
  );
}

async function main() {
  console.log("================================================================================");
  console.log(`DAGOENG TEST DATA CLEANUP UTILITY (Mode: ${isApply ? "EXECUTION (--apply)" : "DRY RUN (Preview Only)"})`);
  console.log("================================================================================");

  const allEvents = loadEventsFromDisk();
  const allBookings = loadBookingsFromDisk();

  console.log(`Total events di storage: ${allEvents.length}`);
  console.log(`Total bookings di storage: ${allBookings.length}\n`);

  const testEvents = allEvents.filter(isIdentifiedTestData);
  const testBookings = allBookings.filter(isIdentifiedTestBooking);

  console.log(`Ditemukan ${testEvents.length} event yang terindikasi data uji.`);
  console.log(`Ditemukan ${testBookings.length} booking/tiket yang terindikasi data uji.\n`);

  const report: {
    deletedBookings: string[];
    rejectedBookings: Array<{ id: string; reason: string }>;
    deletedEvents: string[];
    rejectedEvents: Array<{ id: string; reason: string }>;
  } = {
    deletedBookings: [],
    rejectedBookings: [],
    deletedEvents: [],
    rejectedEvents: [],
  };

  // 1. Process Bookings
  const survivingBookings: EventTicketOrder[] = [];
  for (const b of allBookings) {
    if (isIdentifiedTestBooking(b)) {
      if (b.paymentStatus === "PAID" && b.paymentMethod !== "FREE" && !b.guestEmail.includes("example.com")) {
        report.rejectedBookings.push({
          id: b.id,
          reason: `Pemesanan tiket berbayar non-mock (${b.ticketCode}) ditolak demi keamanan finansial.`,
        });
        survivingBookings.push(b);
      } else {
        report.deletedBookings.push(`${b.ticketCode} (${b.guestName} - ${b.guestEmail})`);
      }
    } else {
      survivingBookings.push(b);
    }
  }

  // 2. Process Events
  const survivingEvents: CommunityEvent[] = [];
  for (const ev of allEvents) {
    if (isIdentifiedTestData(ev)) {
      const remainingBookings = survivingBookings.filter((b) => b.eventId === ev.id);
      if (remainingBookings.length > 0) {
        report.rejectedEvents.push({
          id: ev.id,
          reason: `Event [${ev.title}] masih memiliki ${remainingBookings.length} tiket aktif yang tidak dihapus.`,
        });
        survivingEvents.push(ev);
      } else {
        report.deletedEvents.push(`[${ev.id}] ${ev.title}`);
      }
    } else {
      survivingEvents.push(ev);
    }
  }

  // Output Report
  console.log("--- LAPORAN PEMERIKSAAN BOOKING/TIKET ---");
  console.log(`Eligible untuk dihapus : ${report.deletedBookings.length}`);
  report.deletedBookings.forEach((item) => console.log(`  [DELETE] ${item}`));
  if (report.rejectedBookings.length > 0) {
    console.log(`Ditolak (Dipertahankan) : ${report.rejectedBookings.length}`);
    report.rejectedBookings.forEach((item) => console.log(`  [REJECT] ${item.id}: ${item.reason}`));
  }

  console.log("\n--- LAPORAN PEMERIKSAAN EVENT ---");
  console.log(`Eligible untuk dihapus : ${report.deletedEvents.length}`);
  report.deletedEvents.forEach((item) => console.log(`  [DELETE] ${item}`));
  if (report.rejectedEvents.length > 0) {
    console.log(`Ditolak (Dipertahankan) : ${report.rejectedEvents.length}`);
    report.rejectedEvents.forEach((item) => console.log(`  [REJECT] ${item.id}: ${item.reason}`));
  }

  if (!isApply) {
    console.log("\n================================================================================");
    console.log("DRY RUN SELESAI. Tidak ada data yang dimutasi.");
    console.log("Jalankan dengan perintah: npx tsx scripts/cleanup-test-events.ts --apply");
    console.log("untuk mengeksekusi penghapusan secara permanen.");
    console.log("================================================================================");
    return;
  }

  // Execution Phase
  console.log("\n--- MENGEKSEKUSI PEMBERSIHAN DATA NYATA ---");
  await saveBookingsToDisk(survivingBookings);
  await saveEventsToDisk(survivingEvents);

  await appendAuditLog({
    id: `audit-${Date.now()}-cleanup`,
    timestamp: new Date().toISOString(),
    module: "SETTINGS",
    action: "EVENT_DELETE",
    category: "CONFIGURATION",
    severity: "HIGH",
    status: "SUCCESS",
    actorName: "System Maintenance CLI",
    actorRole: "SUPER_ADMIN",
    recordId: "BATCH_CLEANUP",
    description: `Eksekusi script cleanup-test-events.ts: Menghapus ${report.deletedEvents.length} event uji dan ${report.deletedBookings.length} booking uji.`,
  });

  console.log("Pembersihan data uji berhasil dieksekusi dan dicatat ke audit log.");
  console.log(`Sisa events: ${survivingEvents.length}, Sisa bookings: ${survivingBookings.length}`);
}

main().catch((err) => {
  console.error("Critical error saat menjalankan cleanup script:", err);
  process.exit(1);
});
