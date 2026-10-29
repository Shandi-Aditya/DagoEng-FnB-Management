import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { loadBookingsFromDisk, getAdminEvents } from "@/lib/events";
import { getProofsDirectory, getProofFilePath } from "@/lib/data-storage";
import { sanitizeProofFilename, MIME_BY_EXTENSION } from "@/lib/file-security";
import { assertEventAdmin, getRequestAuthUser } from "@/lib/server-auth";
import { CommunityEvent } from "@/types/event";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/proofs/[filename]
 * Secure, authorized endpoint to serve sensitive transfer payment proofs.
 *
 * Security Enforcements:
 * 1. Strict Path Traversal Prevention: Rejects any filename with slashes, null bytes, or directory traversal.
 * 2. Mandatory Authentication & Authorization:
 *    - Hub Admins (SUPER_ADMIN, OWNER, MANAGER) have full verification access.
 *    - Event Organizers have read access strictly for bookings belonging to their organized events.
 *    - Attendees can access their own proof by presenting their private ticket guestToken as `?token=...`.
 *    - Unauthenticated, cross-tenant, and cross-attendee requests are strictly rejected (HTTP 401 / 403).
 * 3. Safe Content Headers: Serves with `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const rawFilename = params?.filename;
    const sanitizedFilename = sanitizeProofFilename(rawFilename);

    if (!sanitizedFilename) {
      return NextResponse.json(
        { success: false, error: "Nama file bukti pembayaran tidak valid atau format tidak diizinkan." },
        { status: 400 }
      );
    }

    // 1. Locate the booking associated with this proof filename
    const allBookings = loadBookingsFromDisk();
    const matchingBooking = allBookings.find((b) => {
      if (!b.paymentProofUrl) return false;
      return (
        b.paymentProofUrl.includes(sanitizedFilename) ||
        path.basename(b.paymentProofUrl.split("?")[0]) === sanitizedFilename
      );
    });

    if (!matchingBooking) {
      return NextResponse.json(
        { success: false, error: "Bukti pembayaran tidak ditemukan atau tidak terkait dengan transaksi aktif." },
        { status: 404 }
      );
    }

    // 2. Authorization Check
    let isAuthorized = false;

    // Check A: Guest token access (attendee viewing their own ticket proof)
    const requestToken = req.nextUrl.searchParams.get("token") || req.headers.get("x-guest-token");
    if (requestToken && matchingBooking.guestToken && requestToken.trim() === matchingBooking.guestToken.trim()) {
      isAuthorized = true;
    }

    // Check B: Authenticated User (Admin or Event Organizer)
    if (!isAuthorized) {
      const adminAuth = await assertEventAdmin(req);
      if (adminAuth.authorized) {
        isAuthorized = true;
      } else {
        // Check if user is the assigned organizer of this event
        const userAuth = await getRequestAuthUser(req);
        if (userAuth.isAuthenticated && userAuth.email) {
          const allEvents = await getAdminEvents();
          const event = allEvents.find((e: CommunityEvent) => e.id === matchingBooking.eventId);
          if (
            event &&
            event.organizerEmail &&
            event.organizerEmail.toLowerCase().trim() === userAuth.email.toLowerCase().trim()
          ) {
            isAuthorized = true;
          }
        }
      }
    }

    if (!isAuthorized) {
      const userAuth = await getRequestAuthUser(req);
      if (!userAuth.isAuthenticated && !requestToken) {
        return NextResponse.json(
          {
            success: false,
            error: "UNAUTHORIZED: Autentikasi diperlukan untuk mengakses bukti pembayaran transaksi.",
          },
          { status: 401 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          error: "FORBIDDEN: Anda tidak memiliki wewenang untuk melihat bukti pembayaran transaksi ini.",
        },
        { status: 403 }
      );
    }

    // 3. Locate the file strictly on private storage (never read from public directory)
    const targetFilePath = getProofFilePath(sanitizedFilename);

    if (!fs.existsSync(targetFilePath)) {
      return NextResponse.json(
        { success: false, error: "File fisik bukti pembayaran tidak ditemukan pada penyimpanan server." },
        { status: 404 }
      );
    }

    // 4. Read and serve file safely
    const ext = path.extname(sanitizedFilename).toLowerCase();
    const contentType = MIME_BY_EXTENSION[ext] || "application/octet-stream";
    const fileBuffer = fs.readFileSync(targetFilePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": fileBuffer.length.toString(),
        "Content-Disposition": `inline; filename="${sanitizedFilename}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
      },
    });
  } catch (error: any) {
    console.error("GET /api/events/proofs/[filename] error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memproses permintaan bukti pembayaran." },
      { status: 500 }
    );
  }
}

