/**
 * Task S-34: Script Pembersihan Data Uji dan Rekonsiliasi Shift Lama
 * 
 * Target:
 * 1. Rekonsiliasi/tutup 7 shift berstatus NEEDS_RECONCILIATION / gantung lama -> CLOSED
 * 2. Kosongkan pesanan uji aktif di KDS -> status COMPLETED
 * 3. Bersihkan notifikasi uji di dashboard (pengajuan event PENDING, usulan bagi hasil PENDING)
 * 4. Batalkan tiket dan arsipkan event uji:
 *    - Gift Voucher Tes 1 (evt-pilates-gift-voucher) -> ARCHIVED
 *    - [TEST QA 2] Uji Revisi MVP1 (evt-1793935470095-8vpsm) -> ARCHIVED
 *    - Junk test events (TEST, tes cek, dsb.) -> ARCHIVED
 *    - Tiket uji DAGO-EVT-14704, DAGO-EVT-91979, DAGO-EVT-13394 -> CANCELLED
 */

import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runCleanup() {
  console.log("=== MEMULAI PEMBERSIHAN DATA UJI & REKONSILIASI SHIFT (S-34) ===");

  // -------------------------------------------------------------
  // 1. REKONSILIASI & TUTUP 7 SHIFT LAMA
  // -------------------------------------------------------------
  const shiftRow = await prisma.systemSetting.findUnique({ where: { key: "STORAGE_shifts.json" } });
  if (shiftRow) {
    const shifts: any[] = JSON.parse(shiftRow.value);
    let reconciledCount = 0;

    const updatedShifts = shifts.map((s) => {
      // Shift gantung lama atau berstatus NEEDS_RECONCILIATION
      const isOverdueActive = s.status === "ACTIVE" && s.id === "shf-1795155251970-qdso";
      const isNeedsReconcile = s.status === "NEEDS_RECONCILIATION";

      if (isOverdueActive || isNeedsReconcile) {
        reconciledCount++;
        return {
          ...s,
          status: "CLOSED",
          endTime: s.endTime || new Date().toISOString(),
          closedAt: s.closedAt || new Date().toISOString(),
          closedBy: s.closedBy || "SYSTEM_RECONCILIATION_S34",
          actualCash: s.actualCash ?? s.expectedCash ?? s.openingCash ?? 0,
          cashVariance: 0,
          closingNotes: s.closingNotes
            ? `${s.closingNotes} | Direkonsiliasi otomatis (Task S-34)`
            : "Rekonsiliasi penutupan shift operasional lama (Task S-34)",
          updatedAt: new Date().toISOString(),
        };
      }
      return s;
    });

    console.log(`[Shifts] Direkonsiliasi/ditutup: ${reconciledCount} shift.`);
    const shiftJson = JSON.stringify(updatedShifts, null, 2);
    await prisma.systemSetting.update({
      where: { key: "STORAGE_shifts.json" },
      data: { value: shiftJson, updatedAt: new Date() },
    });
    fs.writeFileSync(path.join(process.cwd(), "data", "shifts.json"), shiftJson, "utf8");
  }

  // -------------------------------------------------------------
  // 2. KOSONGKAN PESANAN UJI DI KDS (pos_orders.json)
  // -------------------------------------------------------------
  const orderRow = await prisma.systemSetting.findUnique({ where: { key: "STORAGE_pos_orders.json" } });
  if (orderRow) {
    const orders: any[] = JSON.parse(orderRow.value);
    let completedKdsCount = 0;

    const updatedOrders = orders.map((o) => {
      // Selesaikan pesanan aktif uji yang masih menggantung di KDS
      const isActiveKds =
        o.status === "CONFIRMED" ||
        o.status === "IN_PROGRESS" ||
        o.status === "READY" ||
        o.status === "SERVED";

      if (isActiveKds) {
        completedKdsCount++;
        return {
          ...o,
          status: "COMPLETED",
          kitchenStatus: "COMPLETED",
          completedAt: o.completedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
      return o;
    });

    console.log(`[KDS] Diselesaikan: ${completedKdsCount} pesanan aktif.`);
    const orderJson = JSON.stringify(updatedOrders, null, 2);
    await prisma.systemSetting.update({
      where: { key: "STORAGE_pos_orders.json" },
      data: { value: orderJson, updatedAt: new Date() },
    });
    fs.writeFileSync(path.join(process.cwd(), "data", "pos_orders.json"), orderJson, "utf8");
  }

  // -------------------------------------------------------------
  // 3. BERSIHKAN NOTIFIKASI DASHBOARD & ARSIPKAN EVENT UJI (events.json)
  // -------------------------------------------------------------
  const eventRow = await prisma.systemSetting.findUnique({ where: { key: "STORAGE_events.json" } });
  if (eventRow) {
    const events: any[] = JSON.parse(eventRow.value);
    let cleanedModCount = 0;
    let cleanedSplitCount = 0;
    let archivedEventCount = 0;

    const updatedEvents = events.map((e) => {
      let changed = false;
      const titleLower = (e.title || "").toLowerCase();

      // Cek apakah event uji
      const isTestEvent =
        e.id === "evt-pilates-gift-voucher" ||
        e.id === "evt-1793935470095-8vpsm" ||
        e.id === "evt-1795236424582-7i9ls" ||
        titleLower.includes("tes 1") ||
        titleLower.includes("[test qa 2]") ||
        titleLower.includes("cek 1234567890") ||
        titleLower.includes("1234567890sdfgfg") ||
        titleLower.includes("sdhghfdsdsghjhghfgd") ||
        titleLower.includes("cek sans 1") ||
        titleLower === "test" ||
        titleLower === "tes cek";

      let status = e.status;
      if (isTestEvent && status !== "ARCHIVED") {
        status = "ARCHIVED";
        changed = true;
        archivedEventCount++;
      } else if (e.status === "PENDING") {
        // Bersihkan pengajuan event uji gantung
        status = "ARCHIVED";
        changed = true;
        cleanedModCount++;
      }

      // Bersihkan usulan bagi hasil (proposedRevenueSplit) PENDING
      let proposedRevenueSplit = e.proposedRevenueSplit;
      if (proposedRevenueSplit && proposedRevenueSplit.status === "PENDING") {
        proposedRevenueSplit = {
          ...proposedRevenueSplit,
          status: "ARCHIVED",
          resolutionNotes: "Dibersihkan via Task S-34",
          updatedAt: new Date().toISOString(),
        };
        changed = true;
        cleanedSplitCount++;
      }

      if (changed) {
        return {
          ...e,
          status,
          proposedRevenueSplit,
          updatedAt: new Date().toISOString(),
        };
      }
      return e;
    });

    console.log(`[Events] Diarsipkan: ${archivedEventCount} event uji.`);
    console.log(`[Dashboard] Dibersihkan: ${cleanedModCount} moderasi pending, ${cleanedSplitCount} usulan bagi hasil.`);
    const eventJson = JSON.stringify(updatedEvents, null, 2);
    await prisma.systemSetting.update({
      where: { key: "STORAGE_events.json" },
      data: { value: eventJson, updatedAt: new Date() },
    });
    fs.writeFileSync(path.join(process.cwd(), "data", "events.json"), eventJson, "utf8");
  }

  // -------------------------------------------------------------
  // 4. BATALKAN TIKET UJI (event_bookings.json)
  // -------------------------------------------------------------
  const bookingRow = await prisma.systemSetting.findUnique({ where: { key: "STORAGE_event_bookings.json" } });
  if (bookingRow) {
    const bookings: any[] = JSON.parse(bookingRow.value);
    let cancelledTicketCount = 0;
    const targetCodes = ["DAGO-EVT-14704", "DAGO-EVT-91979", "DAGO-EVT-13394"];

    const updatedBookings = bookings.map((b) => {
      const isTarget = targetCodes.includes(b.ticketCode);
      if (isTarget && b.paymentStatus !== "CANCELLED") {
        cancelledTicketCount++;
        return {
          ...b,
          paymentStatus: "CANCELLED",
          paymentRejectionReason: "Tiket uji coba internal dibatalkan (Task S-34)",
          updatedAt: new Date().toISOString(),
        };
      }
      return b;
    });

    console.log(`[Bookings] Dibatalkan: ${cancelledTicketCount} tiket uji.`);
    const bookingJson = JSON.stringify(updatedBookings, null, 2);
    await prisma.systemSetting.update({
      where: { key: "STORAGE_event_bookings.json" },
      data: { value: bookingJson, updatedAt: new Date() },
    });
    fs.writeFileSync(path.join(process.cwd(), "data", "event_bookings.json"), bookingJson, "utf8");
  }

  console.log("=== PEMBERSIHAN DATA UJI SELESAI SECARA SUKSES ===");
}

runCleanup()
  .catch((err) => {
    console.error("Gagal menjalankan pembersihan:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
