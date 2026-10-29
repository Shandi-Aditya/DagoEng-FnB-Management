/**
 * DAGOENG — OFFLINE DATA VALIDATOR & ETL DRY-RUN SIMULATOR
 *
 * This script is strictly read-only and non-destructive.
 * It simulates data extraction, transformation, and validation against
 * relational schemas without connecting to PostgreSQL, Prisma, or Cloudflare R2.
 *
 * Usage:
 *   npx tsx scripts/migrate-json-to-postgres.ts [--dry-run]
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

// Ensure dry-run is always enforced in this phase
const isDryRun = true; // Hardcoded safety guard for phase A/B

export interface ValidationIssue {
  severity: "ERROR" | "WARNING" | "INFO";
  entity: string;
  recordIdentifier: string;
  field?: string;
  message: string;
}

export interface ETLDryRunSummary {
  timestamp: string;
  mode: "DRY_RUN_OFFLINE";
  filesAudited: {
    name: string;
    exists: boolean;
    recordCount: number;
    byteSize: number;
  }[];
  integrityChecks: {
    eventsCount: number;
    bookingsCount: number;
    organizersCount: number;
    proofsCount: number;
    totalRevenueNominalExact: string;
    paidRevenueNominalExact: string;
    pendingRevenueNominalExact: string;
    cancelledRevenueNominalExact: string;
  };
  crossRefIntegrity: {
    validEventReferences: number;
    orphanBookingReferences: number;
    validOrganizerReferences: number;
    unregisteredOrganizerEmails: number;
    validProofFileReferences: number;
    missingProofFileReferences: number;
  };
  issues: ValidationIssue[];
  passed: boolean;
}

// Utility: mask sensitive strings
export function maskSensitive(str: string | undefined | null, type: "email" | "token" | "phone" | "id"): string {
  if (!str) return "N/A";
  if (type === "email") {
    const parts = str.split("@");
    if (parts.length !== 2) return "***";
    const name = parts[0];
    const maskedName = name.length <= 2 ? name[0] + "*" : name[0] + "*".repeat(name.length - 2) + name[name.length - 1];
    return `${maskedName}@${parts[1]}`;
  }
  if (type === "token" || type === "id") {
    if (str.length <= 6) return "***";
    return `${str.slice(0, 4)}...${str.slice(-3)}`;
  }
  if (type === "phone") {
    if (str.length <= 6) return "***";
    return `${str.slice(0, 4)}****${str.slice(-2)}`;
  }
  return "***";
}

// Exact financial summation using integer cents/rupiah
export function safeAddDecimals(a: number | string, b: number | string): string {
  const bigA = BigInt(Math.round(Number(a)));
  const bigB = BigInt(Math.round(Number(b)));
  return (bigA + bigB).toString();
}

export function runOfflineETLValidation(): ETLDryRunSummary {
  const issues: ValidationIssue[] = [];
  const rootDir = process.cwd();
  const dataDir = path.join(rootDir, "data");
  const proofsDir = path.join(dataDir, "proofs");
  const publicProofsDir = path.join(rootDir, "public", "images", "events", "proofs");

  console.log("================================================================================");
  console.log("  DAGOENG OFFLINE ETL VALIDATOR & DATA INTEGRITY AUDIT");
  console.log("  Mode: DRY-RUN (Zero DB writes, Zero cloud uploads, Pure Read-Only)");
  console.log("================================================================================\n");

  // 1. Audit Physical Storage Directories
  const publicProofsExists = fs.existsSync(publicProofsDir);
  if (publicProofsExists) {
    issues.push({
      severity: "ERROR",
      entity: "Security",
      recordIdentifier: "public/images/events/proofs",
      message: "Public proofs directory STILL EXISTS! Payment proofs may be exposed anonymously.",
    });
  }

  const proofsExists = fs.existsSync(proofsDir);
  const physicalProofFiles = proofsExists ? fs.readdirSync(proofsDir) : [];
  const proofHashMap = new Map<string, { size: number; sha256: string }>();

  physicalProofFiles.forEach((f) => {
    const fullPath = path.join(proofsDir, f);
    const buf = fs.readFileSync(fullPath);
    const hash = crypto.createHash("sha256").update(buf).digest("hex").toUpperCase();
    proofHashMap.set(f, { size: buf.length, sha256: hash });
  });

  // 2. Read and Validate JSON Files
  function readJsonSafe(filename: string): { data: any; size: number } {
    const full = path.join(dataDir, filename);
    if (!fs.existsSync(full)) {
      issues.push({
        severity: "ERROR",
        entity: filename,
        recordIdentifier: filename,
        message: `File ${filename} not found on disk.`,
      });
      return { data: null, size: 0 };
    }
    const raw = fs.readFileSync(full, "utf8");
    try {
      return { data: JSON.parse(raw), size: Buffer.byteLength(raw, "utf8") };
    } catch (e: any) {
      issues.push({
        severity: "ERROR",
        entity: filename,
        recordIdentifier: filename,
        message: `JSON syntax error in ${filename}: ${e.message}`,
      });
      return { data: null, size: Buffer.byteLength(raw, "utf8") };
    }
  }

  const eventsFile = readJsonSafe("events.json");
  const bookingsFile = readJsonSafe("event_bookings.json");
  const organizersFile = readJsonSafe("organizers.json");
  const settingsFile = readJsonSafe("event_settings.json");
  const usersFile = readJsonSafe("unified_users.json");
  const bookingsBackupFile = readJsonSafe("event_bookings.backup.json");

  const events: any[] = Array.isArray(eventsFile.data) ? eventsFile.data : [];
  const bookings: any[] = Array.isArray(bookingsFile.data) ? bookingsFile.data : [];
  const organizers: any[] = Array.isArray(organizersFile.data) ? organizersFile.data : [];

  // Track Unique Keys
  const eventIds = new Set<string>();
  const organizerEmails = new Set<string>();
  const bookingCodes = new Set<string>();
  const guestTokens = new Set<string>();
  const dokuInvoices = new Set<string>();

  // 3. Validate Organizers
  organizers.forEach((org, idx) => {
    const id = org.id || `org-idx-${idx}`;
    if (!org.id) {
      issues.push({
        severity: "ERROR",
        entity: "Organizer",
        recordIdentifier: `idx-${idx}`,
        field: "id",
        message: "Organizer has missing or empty id.",
      });
    }
    if (!org.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(org.email)) {
      issues.push({
        severity: "ERROR",
        entity: "Organizer",
        recordIdentifier: maskSensitive(id, "id"),
        field: "email",
        message: `Invalid email format: ${maskSensitive(org.email, "email")}`,
      });
    } else {
      organizerEmails.add(org.email.trim().toLowerCase());
    }
  });

  // 4. Validate Events
  events.forEach((evt, idx) => {
    const id = evt.id || `evt-idx-${idx}`;
    if (!evt.id) {
      issues.push({
        severity: "ERROR",
        entity: "CommunityEvent",
        recordIdentifier: `idx-${idx}`,
        field: "id",
        message: "Event has empty ID.",
      });
    } else if (eventIds.has(evt.id)) {
      issues.push({
        severity: "ERROR",
        entity: "CommunityEvent",
        recordIdentifier: evt.id,
        field: "id",
        message: `Duplicate Event ID detected: ${evt.id}`,
      });
    } else {
      eventIds.add(evt.id);
    }

    // Dates check
    const start = new Date(evt.startDate);
    const end = new Date(evt.endDate);
    if (isNaN(start.getTime())) {
      issues.push({
        severity: "ERROR",
        entity: "CommunityEvent",
        recordIdentifier: evt.id,
        field: "startDate",
        message: `Invalid startDate format: ${evt.startDate}`,
      });
    }
    if (isNaN(end.getTime())) {
      issues.push({
        severity: "ERROR",
        entity: "CommunityEvent",
        recordIdentifier: evt.id,
        field: "endDate",
        message: `Invalid endDate format: ${evt.endDate}`,
      });
    }
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end < start) {
      issues.push({
        severity: "WARNING",
        entity: "CommunityEvent",
        recordIdentifier: evt.id,
        field: "endDate",
        message: "endDate is earlier than startDate.",
      });
    }

    // Capacity & Pricing
    if (typeof evt.maxCapacity !== "number" || evt.maxCapacity < 1) {
      issues.push({
        severity: "WARNING",
        entity: "CommunityEvent",
        recordIdentifier: evt.id,
        field: "maxCapacity",
        message: `Invalid or missing maxCapacity: ${evt.maxCapacity}`,
      });
    }
    if (evt.isPaid && (typeof evt.price !== "number" || evt.price < 0)) {
      issues.push({
        severity: "ERROR",
        entity: "CommunityEvent",
        recordIdentifier: evt.id,
        field: "price",
        message: `Paid event has invalid price: ${evt.price}`,
      });
    }

    // Organizer Link
    if (evt.organizerEmail) {
      const normalizedOrgEmail = evt.organizerEmail.trim().toLowerCase();
      if (!organizerEmails.has(normalizedOrgEmail)) {
        issues.push({
          severity: "INFO",
          entity: "CommunityEvent",
          recordIdentifier: evt.id,
          field: "organizerEmail",
          message: `Organizer email ${maskSensitive(normalizedOrgEmail, "email")} is not in organizers.json (unregistered or external creator).`,
        });
      }
    }
  });

  // 5. Validate Bookings
  let totalRevenueCents = BigInt(0);
  let paidRevenueCents = BigInt(0);
  let pendingRevenueCents = BigInt(0);
  let cancelledRevenueCents = BigInt(0);

  let validEventRefs = 0;
  let orphanBookingRefs = 0;
  let validProofRefs = 0;
  let missingProofRefs = 0;

  bookings.forEach((b, idx) => {
    const id = b.id || `bkg-idx-${idx}`;
    const code = b.ticketCode || `CODE-${idx}`;

    // Unique constraints
    if (bookingCodes.has(code)) {
      issues.push({
        severity: "ERROR",
        entity: "EventBooking",
        recordIdentifier: code,
        field: "ticketCode",
        message: `Duplicate ticketCode detected: ${code}`,
      });
    } else {
      bookingCodes.add(code);
    }

    if (b.guestToken) {
      if (guestTokens.has(b.guestToken)) {
        issues.push({
          severity: "ERROR",
          entity: "EventBooking",
          recordIdentifier: code,
          field: "guestToken",
          message: `Duplicate guestToken detected for ticket ${code}`,
        });
      } else {
        guestTokens.add(b.guestToken);
      }
    } else {
      issues.push({
        severity: "ERROR",
        entity: "EventBooking",
        recordIdentifier: code,
        field: "guestToken",
        message: `Missing guestToken on booking ${code}`,
      });
    }

    if (b.dokuInvoiceNumber) {
      if (dokuInvoices.has(b.dokuInvoiceNumber)) {
        issues.push({
          severity: "ERROR",
          entity: "EventBooking",
          recordIdentifier: code,
          field: "dokuInvoiceNumber",
          message: `Duplicate dokuInvoiceNumber detected: ${b.dokuInvoiceNumber}`,
        });
      } else {
        dokuInvoices.add(b.dokuInvoiceNumber);
      }
    }

    // Foreign Key check: eventId
    if (eventIds.has(b.eventId)) {
      validEventRefs++;
    } else {
      orphanBookingRefs++;
      issues.push({
        severity: "ERROR",
        entity: "EventBooking",
        recordIdentifier: code,
        field: "eventId",
        message: `Orphan booking! eventId "${b.eventId}" does not exist in events.json.`,
      });
    }

    // Financial Exact Arithmetic Check
    const unitPriceBig = BigInt(Math.round(Number(b.unitPrice || 0)));
    const qtyBig = BigInt(Math.round(Number(b.ticketCount || 1)));
    const totalPriceBig = BigInt(Math.round(Number(b.totalPrice || 0)));
    const expectedTotal = unitPriceBig * qtyBig;

    if (totalPriceBig !== expectedTotal) {
      issues.push({
        severity: "ERROR",
        entity: "EventBooking",
        recordIdentifier: code,
        field: "totalPrice",
        message: `Financial calculation mismatch: unitPrice (${unitPriceBig}) * qty (${qtyBig}) = ${expectedTotal}, but recorded totalPrice is ${totalPriceBig}`,
      });
    }

    totalRevenueCents += totalPriceBig;
    if (b.paymentStatus === "PAID") paidRevenueCents += totalPriceBig;
    else if (b.paymentStatus === "PENDING") pendingRevenueCents += totalPriceBig;
    else if (b.paymentStatus === "CANCELLED") cancelledRevenueCents += totalPriceBig;

    // Split Fee Consistency
    if (b.platformFeeAmount !== undefined && b.organizerRevenueAmount !== undefined) {
      const platFeeBig = BigInt(Math.round(Number(b.platformFeeAmount)));
      const orgRevBig = BigInt(Math.round(Number(b.organizerRevenueAmount)));
      if (platFeeBig + orgRevBig !== totalPriceBig) {
        issues.push({
          severity: "WARNING",
          entity: "EventBooking",
          recordIdentifier: code,
          field: "feeSplit",
          message: `Split fee mismatch: platformFee (${platFeeBig}) + organizerRevenue (${orgRevBig}) != totalPrice (${totalPriceBig})`,
        });
      }
    }

    // Payment Proof Reference Check
    if (b.paymentProofUrl) {
      const filename = path.basename(b.paymentProofUrl);
      if (proofHashMap.has(filename)) {
        validProofRefs++;
      } else {
        missingProofRefs++;
        issues.push({
          severity: "ERROR",
          entity: "EventBooking",
          recordIdentifier: code,
          field: "paymentProofUrl",
          message: `Broken proof reference! File "${filename}" referenced in booking ${code} does not exist in data/proofs/.`,
        });
      }
    }
  });

  // 6. Compare With Backup
  if (Array.isArray(bookingsBackupFile.data)) {
    const backupBookings: any[] = bookingsBackupFile.data;
    if (backupBookings.length !== bookings.length) {
      issues.push({
        severity: "INFO",
        entity: "BackupComparison",
        recordIdentifier: "event_bookings.json",
        message: `Active bookings count (${bookings.length}) differs from backup count (${backupBookings.length}).`,
      });
    }
  }

  const passed = issues.filter((i) => i.severity === "ERROR").length === 0;

  const summary: ETLDryRunSummary = {
    timestamp: new Date().toISOString(),
    mode: "DRY_RUN_OFFLINE",
    filesAudited: [
      { name: "events.json", exists: !!eventsFile.data, recordCount: events.length, byteSize: eventsFile.size },
      { name: "event_bookings.json", exists: !!bookingsFile.data, recordCount: bookings.length, byteSize: bookingsFile.size },
      { name: "organizers.json", exists: !!organizersFile.data, recordCount: organizers.length, byteSize: organizersFile.size },
      { name: "event_settings.json", exists: !!settingsFile.data, recordCount: 1, byteSize: settingsFile.size },
      { name: "unified_users.json", exists: !!usersFile.data, recordCount: Array.isArray(usersFile.data) ? usersFile.data.length : 0, byteSize: usersFile.size },
    ],
    integrityChecks: {
      eventsCount: events.length,
      bookingsCount: bookings.length,
      organizersCount: organizers.length,
      proofsCount: physicalProofFiles.length,
      totalRevenueNominalExact: `Rp ${totalRevenueCents.toLocaleString("id-ID")}`,
      paidRevenueNominalExact: `Rp ${paidRevenueCents.toLocaleString("id-ID")}`,
      pendingRevenueNominalExact: `Rp ${pendingRevenueCents.toLocaleString("id-ID")}`,
      cancelledRevenueNominalExact: `Rp ${cancelledRevenueCents.toLocaleString("id-ID")}`,
    },
    crossRefIntegrity: {
      validEventReferences: validEventRefs,
      orphanBookingReferences: orphanBookingRefs,
      validOrganizerReferences: organizerEmails.size,
      unregisteredOrganizerEmails: issues.filter((i) => i.field === "organizerEmail").length,
      validProofFileReferences: validProofRefs,
      missingProofFileReferences: missingProofRefs,
    },
    issues,
    passed,
  };

  return summary;
}

// Execute CLI
if (require.main === module || process.argv.includes("--dry-run") || isDryRun) {
  const result = runOfflineETLValidation();
  console.log("=== ETL VALIDATION RESULT SUMMARY ===");
  console.log(`Status: ${result.passed ? "SUCCESS (ALL CRITICAL CHECKS PASSED)" : "FAILED (CRITICAL ERRORS FOUND)"}`);
  console.log(`Audited Events: ${result.integrityChecks.eventsCount}`);
  console.log(`Audited Bookings: ${result.integrityChecks.bookingsCount}`);
  console.log(`Audited Organizers: ${result.integrityChecks.organizersCount}`);
  console.log(`Physical Proofs in data/proofs/: ${result.integrityChecks.proofsCount}`);
  console.log(`Financial Audit: Total ${result.integrityChecks.totalRevenueNominalExact} (Paid: ${result.integrityChecks.paidRevenueNominalExact}, Pending: ${result.integrityChecks.pendingRevenueNominalExact}, Cancelled: ${result.integrityChecks.cancelledRevenueNominalExact})`);
  console.log(`Issues Found: ${result.issues.length} (${result.issues.filter(i => i.severity === 'ERROR').length} Errors, ${result.issues.filter(i => i.severity === 'WARNING').length} Warnings, ${result.issues.filter(i => i.severity === 'INFO').length} Info)`);

  if (result.issues.length > 0) {
    console.log("\nIssue Details:");
    result.issues.forEach((iss, i) => {
      console.log(`  [${i + 1}] [${iss.severity}] ${iss.entity} (${iss.recordIdentifier}${iss.field ? '.' + iss.field : ''}): ${iss.message}`);
    });
  }
}

