import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { GET as getProofRoute } from "@/app/api/events/proofs/[filename]/route";
import { POST as uploadProofRoute, GET as getTicketRoute } from "@/app/api/events/tickets/[token]/route";
import { PATCH as updateBookingRoute } from "@/app/api/events/bookings/[id]/route";
import {
  createEventSubmission,
  updateEventStatus,
  createEventBooking,
  getBookingById,
  saveBookingsToDisk,
  loadBookingsFromDisk,
} from "@/lib/events";
import { getProofsDirectory, getProofFilePath, getDataDirectory } from "@/lib/data-storage";
import { validateMagicBytes, sanitizeProofFilename } from "@/lib/file-security";
import { CommunityEvent, EventTicketOrder } from "@/types/event";

// Valid magic byte fixtures
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF_HEADER = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const FAKE_TEXT = Buffer.from("THIS IS NOT AN IMAGE OR PDF");

describe("DAGOENG PAYMENT PROOF SECURITY & ACCESS CONTROL (P0 REMEDIATION)", () => {
  let testEvent: CommunityEvent;
  let bookingA: EventTicketOrder;
  let bookingB: EventTicketOrder;

  beforeAll(async () => {
    // Create and approve a test event
    const submission = await createEventSubmission({
      title: "Security Verification Summit 2026",
      category: "TECH",
      description: "Automated security test summit for payment proof authorization.",
      startDate: new Date(Date.now() + 5 * 86400000).toISOString(),
      endDate: new Date(Date.now() + 5 * 86400000 + 7200000).toISOString(),
      location: "Main Stage Dago Hub",
      maxCapacity: 50,
      isPaid: true,
      price: 25000,
      posterUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87",
      organizerName: "Dago Security Lab",
      organizerEmail: "security-lab@dagoeng.com",
      organizerPhone: "081234567890",
    });
    testEvent = (await updateEventStatus(submission.id, "APPROVED"))!;
  });

  beforeEach(async () => {
    const randomIp = `10.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;
    // Create fresh Booking A
    bookingA = await createEventBooking({
      eventId: testEvent.id,
      guestName: "Alice Attendee",
      guestEmail: `alice-${Date.now()}-${Math.random()}@example.com`,
      guestPhone: "0811111111",
      ticketCount: 1,
    }, randomIp);

    // Create fresh Booking B
    bookingB = await createEventBooking({
      eventId: testEvent.id,
      guestName: "Bob Attendee",
      guestEmail: `bob-${Date.now()}-${Math.random()}@example.com`,
      guestPhone: "0822222222",
      ticketCount: 1,
    }, randomIp + ".b");
  });

  describe("1. Magic Bytes & Filename Sanitization", () => {
    it("Validates magic bytes correctly for JPG, PNG, and PDF", () => {
      expect(validateMagicBytes(JPEG_HEADER, ".jpg")).toBe(true);
      expect(validateMagicBytes(JPEG_HEADER, ".jpeg")).toBe(true);
      expect(validateMagicBytes(PNG_HEADER, ".png")).toBe(true);
      expect(validateMagicBytes(PDF_HEADER, ".pdf")).toBe(true);

      // Mismatches and fake content
      expect(validateMagicBytes(FAKE_TEXT, ".jpg")).toBe(false);
      expect(validateMagicBytes(FAKE_TEXT, ".png")).toBe(false);
      expect(validateMagicBytes(JPEG_HEADER, ".png")).toBe(false);
      expect(validateMagicBytes(PNG_HEADER, ".pdf")).toBe(false);
    });

    it("Rejects dangerous path traversal filenames", () => {
      expect(sanitizeProofFilename("../../etc/passwd")).toBeNull();
      expect(sanitizeProofFilename("..\\..\\windows\\system32\\cmd.exe")).toBeNull();
      expect(sanitizeProofFilename("proof.php")).toBeNull();
      expect(sanitizeProofFilename("proof.exe")).toBeNull();
      expect(sanitizeProofFilename("proof-test.jpg\0.png")).toBeNull();
      expect(sanitizeProofFilename("valid-proof-123.jpg")).toBe("valid-proof-123.jpg");
      expect(sanitizeProofFilename("proof_ticket_001.png")).toBe("proof_ticket_001.png");
    });
  });

  describe("2. Upload & Private Storage Enforcement", () => {
    it("Rejects upload with spoofed extension when magic bytes do not match", async () => {
      const fakeBlob = new Blob([FAKE_TEXT], { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", fakeBlob, "exploit.jpg");

      const req = new NextRequest(`http://localhost:3000/api/events/tickets/${bookingA.guestToken}`, {
        method: "POST",
        body: formData,
      });

      const res = await uploadProofRoute(req, { params: { token: bookingA.guestToken } });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/integritas file tidak valid/i);
    });

    it("Saves valid proof to private directory (never in public/) and generates secure /api/events/proofs/ URL", async () => {
      const validJpg = new Blob([JPEG_HEADER], { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", validJpg, "transfer.jpg");
      formData.append("note", "Transfer dari BCA Alice");

      const req = new NextRequest(`http://localhost:3000/api/events/tickets/${bookingA.guestToken}`, {
        method: "POST",
        body: formData,
      });

      const res = await uploadProofRoute(req, { params: { token: bookingA.guestToken } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.paymentProofUrl).toMatch(/^\/api\/events\/proofs\/proof-/);
      expect(json.data.paymentProofUrl).not.toContain("/images/events/proofs/");

      // Verify physical file was saved to private proofs directory
      const filename = path.basename(json.data.paymentProofUrl);
      const privateFilePath = getProofFilePath(filename);
      expect(fs.existsSync(privateFilePath)).toBe(true);

      // Verify it is NOT in public directory
      const publicFilePath = path.join(process.cwd(), "public", "images", "events", "proofs", filename);
      expect(fs.existsSync(publicFilePath)).toBe(false);
    });
  });

  describe("3. Server-Side Access Control & IDOR Prevention", () => {
    let savedFilename: string;

    beforeEach(async () => {
      // Upload valid proof for Booking A
      const validJpg = new Blob([JPEG_HEADER], { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", validJpg, "receipt.jpg");

      const req = new NextRequest(`http://localhost:3000/api/events/tickets/${bookingA.guestToken}`, {
        method: "POST",
        body: formData,
      });

      const res = await uploadProofRoute(req, { params: { token: bookingA.guestToken } });
      const json = await res.json();
      savedFilename = path.basename(json.data.paymentProofUrl);
    });

    it("Rejects unauthenticated access without any token (HTTP 401)", async () => {
      const req = new NextRequest(`http://localhost:3000/api/events/proofs/${savedFilename}`, {
        method: "GET",
      });

      const res = await getProofRoute(req, { params: { filename: savedFilename } });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/UNAUTHORIZED/i);
    });

    it("Allows ticket owner with matching guestToken (HTTP 200)", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/events/proofs/${savedFilename}?token=${bookingA.guestToken}`,
        { method: "GET" }
      );

      const res = await getProofRoute(req, { params: { filename: savedFilename } });
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/jpeg");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("Cache-Control")).toContain("no-store");
    });

    it("Rejects IDOR: Attendee B using their valid token to view Attendee A's proof (HTTP 403)", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/events/proofs/${savedFilename}?token=${bookingB.guestToken}`,
        { method: "GET" }
      );

      const res = await getProofRoute(req, { params: { filename: savedFilename } });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/FORBIDDEN/i);
    });

    it("Allows authenticated Admin to view proof for verification (HTTP 200)", async () => {
      const req = new NextRequest(`http://localhost:3000/api/events/proofs/${savedFilename}`, {
        method: "GET",
        headers: {
          cookie: "dagoeng_active_persona=SUPER_ADMIN",
        },
      });

      const res = await getProofRoute(req, { params: { filename: savedFilename } });
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    });

    it("Rejects path traversal attempts (HTTP 400)", async () => {
      const req = new NextRequest(`http://localhost:3000/api/events/proofs/..%2f..%2fetc%2fpasswd`, {
        method: "GET",
      });

      const res = await getProofRoute(req, { params: { filename: "../../etc/passwd" } });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/tidak valid/i);
    });
  });

  describe("4. PATCH /api/events/bookings/[id] Authorization & IDOR Protection", () => {
    it("Rejects unauthenticated PATCH to update payment proof without token (HTTP 403)", async () => {
      const req = new NextRequest(`http://localhost:3000/api/events/bookings/${bookingA.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          paymentProofUrl: "/api/events/proofs/fake.jpg",
        }),
      });

      const res = await updateBookingRoute(req, { params: { id: bookingA.id } });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/FORBIDDEN/i);
    });

    it("Allows ticket owner with matching guestToken to PATCH payment proof (HTTP 200)", async () => {
      const req = new NextRequest(`http://localhost:3000/api/events/bookings/${bookingA.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          paymentProofUrl: "/api/events/proofs/proof-valid.jpg",
          guestToken: bookingA.guestToken,
        }),
      });

      const res = await updateBookingRoute(req, { params: { id: bookingA.id } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.paymentProofUrl).toBe("/api/events/proofs/proof-valid.jpg");
    });
  });

  describe("5. Legacy Proofs Migration & Zero Public Exposure Verification", () => {
    const LEGACY_FILE_1 = "proof-dago-evt-51628-1793179519555.png";
    const LEGACY_FILE_2 = "proof-dago-evt-72676-1793179816938.png";
    const HASH_FILE_1 = "05A9D413298885A99B7993E08809019FD464F62C0F75751C776EF7D6E40C3D24";
    const HASH_FILE_2 = "BC37D23026012DE4FDAD3B5DA743A3682FA007DFEEC2F790CC6081FAF4EFFA47";

    it("Guarantees public/images/events/proofs directory no longer exists on disk", () => {
      const publicProofsDir = path.join(process.cwd(), "public", "images", "events", "proofs");
      expect(fs.existsSync(publicProofsDir)).toBe(false);
      expect(fs.existsSync(path.join(publicProofsDir, LEGACY_FILE_1))).toBe(false);
      expect(fs.existsSync(path.join(publicProofsDir, LEGACY_FILE_2))).toBe(false);
    });

    it("Guarantees both legacy files are safely preserved in data/proofs and data/backup_legacy_proofs with exact SHA-256 hashes", () => {
      const crypto = require("crypto");
      const sha256 = (filePath: string) => {
        const buf = fs.readFileSync(filePath);
        return crypto.createHash("sha256").update(buf).digest("hex").toUpperCase();
      };

      const primaryFile1 = path.join(process.cwd(), "data", "proofs", LEGACY_FILE_1);
      const primaryFile2 = path.join(process.cwd(), "data", "proofs", LEGACY_FILE_2);
      const backupFile1 = path.join(process.cwd(), "data", "backup_legacy_proofs", LEGACY_FILE_1);
      const backupFile2 = path.join(process.cwd(), "data", "backup_legacy_proofs", LEGACY_FILE_2);

      expect(fs.existsSync(primaryFile1)).toBe(true);
      expect(fs.existsSync(primaryFile2)).toBe(true);
      expect(fs.existsSync(backupFile1)).toBe(true);
      expect(fs.existsSync(backupFile2)).toBe(true);

      expect(sha256(primaryFile1)).toBe(HASH_FILE_1);
      expect(sha256(primaryFile2)).toBe(HASH_FILE_2);
      expect(sha256(backupFile1)).toBe(HASH_FILE_1);
      expect(sha256(backupFile2)).toBe(HASH_FILE_2);
    });

    it("Allows authorized Admin to open legacy proof via private endpoint", async () => {
      // Ensure file is accessible in test proofs dir for the route handler
      const testProofsDir = getProofsDirectory();
      if (!fs.existsSync(testProofsDir)) {
        fs.mkdirSync(testProofsDir, { recursive: true });
      }
      const testFilePath = path.join(testProofsDir, LEGACY_FILE_1);
      const sourceFile = path.join(process.cwd(), "data", "proofs", LEGACY_FILE_1);
      fs.copyFileSync(sourceFile, testFilePath);

      // Associate a booking in test storage
      const existingBookings = loadBookingsFromDisk();
      const legacyBooking: EventTicketOrder = {
        id: "tkt-legacy-test-01",
        ticketCode: "DAGO-EVT-51628",
        guestToken: "legacy-token-51628",
        eventId: testEvent.id,
        eventTitle: testEvent.title,
        guestName: "Legacy User",
        guestEmail: "legacy@dagoeng.com",
        guestPhone: "0812345678",
        ticketCount: 1,
        unitPrice: 25000,
        totalPrice: 25000,
        platformFeePercent: 20,
        platformFeeAmount: 5000,
        organizerRevenueAmount: 20000,
        paymentMethod: "TRANSFER",
        paymentStatus: "PAID",
        checkInStatus: "REGISTERED",
        paymentProofUrl: `/api/events/proofs/${LEGACY_FILE_1}`,
        createdAt: new Date().toISOString(),
      };
      saveBookingsToDisk([...existingBookings, legacyBooking]);

      // Request as Super Admin
      const req = new NextRequest(`http://localhost:3000/api/events/proofs/${LEGACY_FILE_1}`, {
        method: "GET",
        headers: {
          cookie: "dagoeng_active_persona=SUPER_ADMIN",
        },
      });

      const res = await getProofRoute(req, { params: { filename: LEGACY_FILE_1 } });
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/png");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    });

    it("Allows ticket owner with guestToken to open legacy proof via private endpoint", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/events/proofs/${LEGACY_FILE_1}?token=legacy-token-51628`,
        { method: "GET" }
      );

      const res = await getProofRoute(req, { params: { filename: LEGACY_FILE_1 } });
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/png");
    });

    it("Strictly blocks unauthenticated access to legacy proof via private endpoint (HTTP 401)", async () => {
      const req = new NextRequest(`http://localhost:3000/api/events/proofs/${LEGACY_FILE_1}`, {
        method: "GET",
      });

      const res = await getProofRoute(req, { params: { filename: LEGACY_FILE_1 } });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/UNAUTHORIZED/i);
    });

    it("Strictly blocks IDOR cross-attendee access to legacy proof (HTTP 403)", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/events/proofs/${LEGACY_FILE_1}?token=wrong-token-999`,
        { method: "GET" }
      );

      const res = await getProofRoute(req, { params: { filename: LEGACY_FILE_1 } });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/FORBIDDEN/i);
    });
  });
});
