import { NextRequest, NextResponse } from "next/server";
import { loadBookingsFromDisk, getAdminEvents, updateBookingPaymentProof } from "@/lib/events";
import { CommunityEvent } from "@/types/event";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getProofsDirectory, getProofFilePath } from "@/lib/data-storage";
import {
  validateMagicBytes,
  ALLOWED_PROOF_EXTENSIONS,
  ALLOWED_PROOF_MIME_TYPES,
  sanitizeProofFilename,
} from "@/lib/file-security";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/tickets/[token]
 * Dedicated secure endpoint for guest and attendee ticket access via high-entropy token.
 * Does not require login, allowing seamless Eventbrite-style private link ticket access.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const rawToken = params?.token;
    if (!rawToken || typeof rawToken !== "string" || rawToken.trim().length < 16) {
      return NextResponse.json(
        {
          success: false,
          error: "Format token akses tiket tidak valid.",
        },
        { status: 400 }
      );
    }

    const token = rawToken.trim();
    const allBookings = loadBookingsFromDisk();
    const booking = allBookings.find((b) => b.guestToken === token);

    if (!booking) {
      return NextResponse.json(
        {
          success: false,
          error: "Tiket tidak ditemukan atau tautan akses privat tidak valid / telah kedaluwarsa.",
        },
        { status: 404 }
      );
    }

    // Enrich with event details
    const allEvents = await getAdminEvents();
    const matchingEvent = allEvents.find((e: CommunityEvent) => e.id === booking.eventId);

    const safeTicketData = {
      id: booking.id,
      ticketCode: booking.ticketCode,
      eventId: booking.eventId,
      eventTitle: booking.eventTitle,
      eventDate: booking.eventDate,
      eventLocation: booking.eventLocation,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      guestPhone: booking.guestPhone,
      institution: booking.institution,
      ticketCount: booking.ticketCount,
      unitPrice: booking.unitPrice,
      totalPrice: booking.totalPrice,
      paymentMethod: booking.paymentMethod,
      paymentStatus: booking.paymentStatus,
      paymentProofUrl: (() => {
        if (!booking.paymentProofUrl) return null;
        const guestTokenParam = encodeURIComponent(booking.guestToken || "");
        if (booking.paymentProofUrl.startsWith("/api/events/proofs/")) {
          return booking.paymentProofUrl.includes("?")
            ? booking.paymentProofUrl
            : `${booking.paymentProofUrl}?token=${guestTokenParam}`;
        }
        if (booking.paymentProofUrl.startsWith("/images/events/proofs/")) {
          const filename = path.basename(booking.paymentProofUrl);
          return `/api/events/proofs/${filename}?token=${guestTokenParam}`;
        }
        return booking.paymentProofUrl;
      })(),
      paymentProofUploadedAt: booking.paymentProofUploadedAt || null,
      paymentProofNote: booking.paymentProofNote || null,
      checkInStatus: booking.checkInStatus,
      checkedInQty: booking.checkedInQty,
      checkInTime: booking.checkInTime,
      dokuInvoiceNumber: booking.dokuInvoiceNumber,
      dokuPaymentUrl: booking.dokuPaymentUrl,
      paidAt: booking.paidAt,
      createdAt: booking.createdAt,
      eventDetails: matchingEvent
        ? {
          id: matchingEvent.id,
          title: matchingEvent.title,
          category: matchingEvent.category,
          posterUrl: matchingEvent.posterUrl,
          organizerName: matchingEvent.organizerName,
          startDate: matchingEvent.startDate,
          endDate: matchingEvent.endDate,
          location: matchingEvent.location,
          guidelines: matchingEvent.guidelines,
        }
        : null,
    };

    return NextResponse.json({
      success: true,
      data: safeTicketData,
    });
  } catch (error: any) {
    console.error("GET /api/events/tickets/[token] error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memuat informasi tiket." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events/tickets/[token]
 * Endpoint to upload proof of manual transfer payment for this ticket.
 * Accepts either JSON { paymentProofUrl, paymentProofNote } or FormData with 'file'.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const rawToken = params?.token;
    if (!rawToken || typeof rawToken !== "string" || rawToken.trim().length < 16) {
      return NextResponse.json(
        { success: false, error: "Format token akses tiket tidak valid." },
        { status: 400 }
      );
    }

    const token = rawToken.trim();
    const allBookings = loadBookingsFromDisk();
    const booking = allBookings.find((b) => b.guestToken === token);

    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Tiket tidak ditemukan." },
        { status: 404 }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    let proofUrl = "";
    let proofNote = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      proofNote = (formData.get("note") as string) || "";

      if (!file) {
        return NextResponse.json(
          { success: false, error: "File bukti pembayaran tidak ditemukan." },
          { status: 400 }
        );
      }

      // 1. File size validation (max 5MB default)
      const maxMb = 5;
      const maxBytes = maxMb * 1024 * 1024;
      if (file.size > maxBytes) {
        return NextResponse.json(
          { success: false, error: `Ukuran file bukti pembayaran melebihi batas maksimal ${maxMb}MB.` },
          { status: 400 }
        );
      }

      // 2. Allowed extension and MIME validation (prevent arbitrary file upload)
      const rawExt = path.extname(file.name || "").toLowerCase();
      if (!ALLOWED_PROOF_EXTENSIONS.has(rawExt)) {
        return NextResponse.json(
          { success: false, error: "Format file tidak didukung. Harap unggah file JPG, PNG, WEBP, atau PDF." },
          { status: 400 }
        );
      }
      const ext = rawExt;

      if (file.type && !ALLOWED_PROOF_MIME_TYPES.has(file.type.toLowerCase())) {
        return NextResponse.json(
          { success: false, error: "Tipe MIME file tidak didukung. Harap unggah gambar JPG, PNG, WEBP, atau PDF." },
          { status: 400 }
        );
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // 3. Header magic bytes validation (anti-spoofing)
      if (!validateMagicBytes(buffer, ext)) {
        return NextResponse.json(
          {
            success: false,
            error: "Integritas file tidak valid. Header file tidak sesuai dengan format ekstensi yang dinyatakan.",
          },
          { status: 400 }
        );
      }

      // 4. Save to secure private directory (never in public/)
      const safeTicketCode = (booking.ticketCode || "ticket").toLowerCase().replace(/[^a-z0-9]/g, "");
      const randomSuffix = crypto.randomBytes(4).toString("hex");
      const filename = `proof-${safeTicketCode}-${Date.now()}-${randomSuffix}${ext}`;
      const uploadDir = getProofsDirectory();

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      fs.writeFileSync(path.join(uploadDir, filename), buffer);
      proofUrl = `/api/events/proofs/${filename}`;
    } else {
      const body = await req.json();
      proofUrl = body.paymentProofUrl;
      proofNote = body.paymentProofNote || "";

      if (!proofUrl || typeof proofUrl !== "string" || !proofUrl.trim()) {
        return NextResponse.json(
          { success: false, error: "URL bukti pembayaran wajib disertakan." },
          { status: 400 }
        );
      }

      // Safe URL validation
      const trimmedUrl = proofUrl.trim();
      const isSafeProtocol =
        trimmedUrl.startsWith("https://") ||
        trimmedUrl.startsWith("/api/events/proofs/") ||
        trimmedUrl.startsWith("/images/events/proofs/");
      const hasTraversal = trimmedUrl.includes("..") || trimmedUrl.includes("\0");

      if (!isSafeProtocol || hasTraversal) {
        return NextResponse.json(
          { success: false, error: "Format URL bukti pembayaran tidak valid atau tidak aman." },
          { status: 400 }
        );
      }
    }

    const updated = await updateBookingPaymentProof(
      { guestToken: token },
      { paymentProofUrl: proofUrl, paymentProofNote: proofNote }
    );

    return NextResponse.json({
      success: true,
      message: "Bukti transfer pembayaran berhasil diunggah! Menunggu verifikasi admin.",
      data: updated,
    });
  } catch (error: any) {
    console.error("POST /api/events/tickets/[token] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengunggah bukti pembayaran." },
      { status: 500 }
    );
  }
}
