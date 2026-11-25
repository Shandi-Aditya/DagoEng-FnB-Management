import { NextRequest, NextResponse } from "next/server";
import {
  updateBookingCheckIn,
  updateBookingPaymentStatus,
  getBookingById,
  isMatchingTicketCode,
  updateBookingPaymentProof,
  adminApproveBookingPayment,
  adminRejectBookingPayment,
  deleteEventBooking,
  getAdminEvents,
} from "@/lib/events";
import { getEventDateStatusWita } from "@/features/events-checkin/events-checkin-domain";
import {
  assertEventAdmin,
  assertCheckInAuth,
  getRequestAuthUser,
  validateCheckInCandidateSession,
  sanitizeBookingForResponse,
  type ServerAuthResult,
} from "@/lib/server-auth";
import type {
  AttendeeCheckInStatus,
  EventTicketOrder,
  TicketPaymentStatus,
} from "@/types/event";

export const dynamic = "force-dynamic";

const ALLOWED_CHECKIN_STATUSES = new Set<AttendeeCheckInStatus>([
  "CHECKED_IN",
  "PARTIALLY_CHECKED_IN",
  "REGISTERED",
]);

const ALLOWED_PAYMENT_STATUSES = new Set<TicketPaymentStatus>([
  "PAID",
  "CANCELLED",
  "PENDING",
  "EXPIRED",
]);

type BookingPatchIntent =
  | { kind: "APPROVE_PAYMENT"; verificationNote?: string }
  | { kind: "REJECT_PAYMENT"; rejectionReason: string; cancelBooking: boolean }
  | {
      kind: "SET_PAYMENT_STATUS";
      paymentStatus: TicketPaymentStatus;
      rejectionReason?: string;
      verificationNote?: string;
    }
  | {
      kind: "UPDATE_CHECKIN";
      checkInStatus: AttendeeCheckInStatus;
      incrementQty?: number;
      targetQty?: number;
      reset?: boolean;
      ticketCode?: string;
      seatNumber?: number;
    }
  | {
      kind: "UPLOAD_PAYMENT_PROOF";
      paymentProofUrl: string;
      paymentProofNote?: string;
      guestToken?: string;
    };

type PreLookupAuthContext =
  | { ok: false; response: NextResponse }
  | {
      ok: true;
      adminAuth: Awaited<ReturnType<typeof assertEventAdmin>> | null;
      checkInSessionAuth?: ServerAuthResult;
      proofGuestToken?: string;
    };

function parseOptionalStringField(
  value: unknown,
  fieldName: string
): { ok: true; value?: string } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: undefined };
  if (typeof value !== "string") {
    return { ok: false, error: `Kolom ${fieldName} harus berupa teks yang valid.` };
  }
  return { ok: true, value };
}

function parseOptionalNonNegativeInt(
  value: unknown,
  fieldName: string
): { ok: true; value?: number } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: undefined };
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return { ok: false, error: `Kolom ${fieldName} harus berupa bilangan bulat yang valid.` };
  }
  return { ok: true, value };
}

function isSafePaymentProofUrl(rawUrl: string): boolean {
  const trimmedUrl = rawUrl.trim();
  const hasAllowedPrefix =
    trimmedUrl.startsWith("https://") ||
    trimmedUrl.startsWith("/api/events/proofs/") ||
    trimmedUrl.startsWith("/images/events/proofs/");
  return hasAllowedPrefix && !trimmedUrl.includes("..") && !trimmedUrl.includes("\0");
}

function resolveBookingPatchIntent(
  rawBody: unknown
): { ok: true; intent: BookingPatchIntent } | { ok: false; error: string } {
  if (typeof rawBody !== "object" || rawBody === null || Array.isArray(rawBody)) {
    return { ok: false, error: "Format request body tidak valid (harus objek JSON)." };
  }

  const body = rawBody as Record<string, unknown>;
  const actionRes = parseOptionalStringField(body.action, "action");
  if (!actionRes.ok) return actionRes;
  if (
    body.action !== undefined &&
    body.action !== null &&
    actionRes.value !== "APPROVE_PAYMENT" &&
    actionRes.value !== "REJECT_PAYMENT"
  ) {
    return { ok: false, error: "Aksi pembaruan tiket tidak valid." };
  }

  const paymentStatusRes = parseOptionalStringField(body.paymentStatus, "paymentStatus");
  if (!paymentStatusRes.ok) return paymentStatusRes;
  if (body.paymentStatus !== undefined && body.paymentStatus !== null && !paymentStatusRes.value?.trim()) {
    return { ok: false, error: "Status pembayaran tiket harus berupa string yang valid." };
  }

  const checkInStatusRes = parseOptionalStringField(body.checkInStatus, "checkInStatus");
  if (!checkInStatusRes.ok) return checkInStatusRes;
  if (body.checkInStatus !== undefined && body.checkInStatus !== null && !checkInStatusRes.value?.trim()) {
    return { ok: false, error: "Status kehadiran harus berupa string yang valid." };
  }

  const paymentProofUrlRes = parseOptionalStringField(body.paymentProofUrl, "paymentProofUrl");
  if (!paymentProofUrlRes.ok) return paymentProofUrlRes;
  if (
    body.paymentProofUrl !== undefined &&
    body.paymentProofUrl !== null &&
    !paymentProofUrlRes.value?.trim()
  ) {
    return { ok: false, error: "URL bukti pembayaran harus berupa string yang valid." };
  }

  const intents: BookingPatchIntent[] = [];

  if (actionRes.value === "APPROVE_PAYMENT") {
    const verificationNoteRes = parseOptionalStringField(body.verificationNote, "verificationNote");
    if (!verificationNoteRes.ok) return verificationNoteRes;
    intents.push({
      kind: "APPROVE_PAYMENT",
      verificationNote: verificationNoteRes.value,
    });
  } else if (actionRes.value === "REJECT_PAYMENT") {
    const rejectionReasonRes = parseOptionalStringField(body.rejectionReason, "rejectionReason");
    if (!rejectionReasonRes.ok) return rejectionReasonRes;
    const rejectionReason = rejectionReasonRes.value?.trim() || "";
    if (!rejectionReason) {
      return { ok: false, error: "Alasan penolakan pembayaran wajib diisi." };
    }
    intents.push({
      kind: "REJECT_PAYMENT",
      rejectionReason,
      cancelBooking: Boolean(body.cancelBooking),
    });
  }

  if (paymentStatusRes.value?.trim()) {
    const normalized = paymentStatusRes.value.trim() as TicketPaymentStatus;
    if (!ALLOWED_PAYMENT_STATUSES.has(normalized)) {
      return { ok: false, error: "Status pembayaran tiket tidak valid." };
    }
    const rejectionReasonRes = parseOptionalStringField(body.rejectionReason, "rejectionReason");
    if (!rejectionReasonRes.ok) return rejectionReasonRes;
    const verificationNoteRes = parseOptionalStringField(body.verificationNote, "verificationNote");
    if (!verificationNoteRes.ok) return verificationNoteRes;
    intents.push({
      kind: "SET_PAYMENT_STATUS",
      paymentStatus: normalized,
      rejectionReason: rejectionReasonRes.value,
      verificationNote: verificationNoteRes.value,
    });
  }

  if (checkInStatusRes.value?.trim()) {
    const normalized = checkInStatusRes.value.trim() as AttendeeCheckInStatus;
    if (!ALLOWED_CHECKIN_STATUSES.has(normalized)) {
      return {
        ok: false,
        error:
          "Status kehadiran tidak valid (harus CHECKED_IN, PARTIALLY_CHECKED_IN, atau REGISTERED).",
      };
    }
    if (body.reset !== undefined && body.reset !== null && typeof body.reset !== "boolean") {
      return { ok: false, error: "Kolom reset harus berupa boolean." };
    }
    if (body.reset === true && normalized !== "REGISTERED") {
      return {
        ok: false,
        error: "Reset kehadiran hanya boleh dilakukan dengan status REGISTERED.",
      };
    }
    const incrementQtyRes = parseOptionalNonNegativeInt(body.incrementQty, "incrementQty");
    if (!incrementQtyRes.ok) return incrementQtyRes;
    const targetQtyRes = parseOptionalNonNegativeInt(body.targetQty, "targetQty");
    if (!targetQtyRes.ok) return targetQtyRes;
    const seatNumberRes = parseOptionalNonNegativeInt(body.seatNumber, "seatNumber");
    if (!seatNumberRes.ok) return seatNumberRes;
    const ticketCodeRes = parseOptionalStringField(body.ticketCode, "ticketCode");
    if (!ticketCodeRes.ok) return ticketCodeRes;

    intents.push({
      kind: "UPDATE_CHECKIN",
      checkInStatus: normalized,
      incrementQty: incrementQtyRes.value,
      targetQty: targetQtyRes.value,
      reset: typeof body.reset === "boolean" ? body.reset : undefined,
      ticketCode: ticketCodeRes.value,
      seatNumber: seatNumberRes.value,
    });
  }

  if (paymentProofUrlRes.value?.trim()) {
    const trimmedUrl = paymentProofUrlRes.value.trim();
    if (!isSafePaymentProofUrl(trimmedUrl)) {
      return { ok: false, error: "Format URL bukti pembayaran tidak valid atau tidak aman." };
    }
    const paymentProofNoteRes = parseOptionalStringField(body.paymentProofNote, "paymentProofNote");
    if (!paymentProofNoteRes.ok) return paymentProofNoteRes;
    const guestTokenRes = parseOptionalStringField(body.guestToken, "guestToken");
    if (!guestTokenRes.ok) return guestTokenRes;
    intents.push({
      kind: "UPLOAD_PAYMENT_PROOF",
      paymentProofUrl: trimmedUrl,
      paymentProofNote: paymentProofNoteRes.value,
      guestToken: guestTokenRes.value,
    });
  }

  if (intents.length === 0) {
    return { ok: false, error: "Aksi atau bidang pembaruan tiket tidak sah atau kosong." };
  }

  if (intents.length > 1) {
    return {
      ok: false,
      error: "Tidak dapat menggabungkan beberapa aksi mutasi tiket dalam satu permintaan.",
    };
  }

  return { ok: true, intent: intents[0] };
}

async function authorizePatchBeforeLookup(
  req: NextRequest,
  intent: BookingPatchIntent
): Promise<PreLookupAuthContext> {
  if (
    intent.kind === "APPROVE_PAYMENT" ||
    intent.kind === "REJECT_PAYMENT" ||
    intent.kind === "SET_PAYMENT_STATUS"
  ) {
    const adminAuth = await assertEventAdmin(req);
    if (!adminAuth.authorized) {
      return {
        ok: false,
        response: NextResponse.json({ success: false, error: adminAuth.error }, { status: 403 }),
      };
    }
    return { ok: true, adminAuth };
  }

  if (intent.kind === "UPDATE_CHECKIN") {
    const auth = await getRequestAuthUser(req);
    const sessionCheck = validateCheckInCandidateSession(auth);
    if (!sessionCheck.allowed) {
      return {
        ok: false,
        response: NextResponse.json({ success: false, error: sessionCheck.error }, { status: 403 }),
      };
    }
    return { ok: true, adminAuth: null, checkInSessionAuth: auth };
  }

  const adminAuth = await assertEventAdmin(req);
  const proofGuestToken = (intent.guestToken || req.headers.get("x-guest-token") || "").trim();
  if (!adminAuth.authorized && !proofGuestToken) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error: "FORBIDDEN: Anda tidak memiliki wewenang untuk memperbarui bukti pembayaran pemesanan ini.",
        },
        { status: 403 }
      ),
    };
  }
  return { ok: true, adminAuth, proofGuestToken };
}

function bookingErrorResponse(
  error: unknown,
  id: string,
  method: "PATCH" | "DELETE",
  defaultMessage: string
): NextResponse {
  console.error(`${method} /api/events/bookings/${id} error:`, error);
  if (error instanceof Error && error.name === "DatabasePersistenceError") {
    const busyMessage =
      method === "DELETE"
        ? "Layanan database tiket sedang mengalami gangguan. Penghapusan pemesanan tiket belum dapat dikonfirmasi demi menjaga konsistensi data. Silakan coba kembali."
        : "Layanan database tiket sedang mengalami gangguan. Pembaruan tiket belum dapat dikonfirmasi demi menjaga konsistensi data. Silakan coba kembali.";
    return NextResponse.json({ success: false, error: busyMessage }, { status: 503 });
  }
  const message = error instanceof Error && error.message ? error.message : defaultMessage;
  const status = method === "DELETE" && message.startsWith("FORBIDDEN_DELETE") ? 409 : 400;
  return NextResponse.json({ success: false, error: message }, { status });
}

/**
 * PATCH /api/events/bookings/[id]
 * Endpoint to update ticket check-in status (Field Officer, Organizer, or Admin)
 * or payment status (strictly Admin).
 */
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Format request body tidak valid (harus JSON)." },
        { status: 400 }
      );
    }

    const parsed = resolveBookingPatchIntent(rawBody);
    if (!parsed.ok) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }
    const { intent } = parsed;

    const preAuth = await authorizePatchBeforeLookup(req, intent);
    if (!preAuth.ok) {
      return preAuth.response;
    }

    const existing = await getBookingById(id);
    if (!existing) {
      if (intent.kind === "UPLOAD_PAYMENT_PROOF" && !preAuth.adminAuth?.authorized) {
        return NextResponse.json(
          {
            success: false,
            error: "FORBIDDEN: Anda tidak memiliki wewenang untuk memperbarui bukti pembayaran pemesanan ini.",
          },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { success: false, error: `Pemesanan tiket dengan ID ${id} tidak ditemukan.` },
        { status: 404 }
      );
    }

    let updated: EventTicketOrder;
    let message = "Data tiket peserta berhasil diperbarui.";
    let isHubAdmin = Boolean(preAuth.adminAuth?.authorized);

    switch (intent.kind) {
      case "APPROVE_PAYMENT": {
        updated = await adminApproveBookingPayment(
          id,
          intent.verificationNote,
          preAuth.adminAuth?.name || "Admin Dago"
        );
        message = "Pembayaran tiket berhasil diverifikasi dan disetujui (PAID). Tiket dan QR code kini aktif.";
        break;
      }
      case "REJECT_PAYMENT": {
        updated = await adminRejectBookingPayment(
          id,
          intent.rejectionReason,
          { cancelBooking: intent.cancelBooking },
          preAuth.adminAuth?.name || "Admin Dago"
        );
        message = intent.cancelBooking
          ? "Bukti pembayaran ditolak dan pemesanan tiket telah dibatalkan."
          : "Bukti pembayaran ditolak. Peserta dapat mengunggah bukti perbaikan sebelum batas waktu berakhir.";
        break;
      }
      case "SET_PAYMENT_STATUS": {
        updated = await updateBookingPaymentStatus(id, intent.paymentStatus, {
          rejectionReason: intent.rejectionReason,
          verificationNote: intent.verificationNote,
          actorName: preAuth.adminAuth?.name || "Admin Dago",
        });
        break;
      }
      case "UPDATE_CHECKIN": {
        const checkInAuth = await assertCheckInAuth(req, existing.eventId, preAuth.checkInSessionAuth);
        if (!checkInAuth.authorized) {
          return NextResponse.json(
            { success: false, error: checkInAuth.error },
            { status: 403 }
          );
        }
        isHubAdmin = Boolean(checkInAuth.isHubAdmin);

        if (intent.reset || intent.checkInStatus === "REGISTERED") {
          const events = await getAdminEvents();
          const event = events.find((e) => e.id === existing.eventId);
          if (event && getEventDateStatusWita(event) !== "TODAY") {
            return NextResponse.json(
              {
                success: false,
                error: "Status kehadiran hanya dapat diatur ulang pada hari pelaksanaan event (WITA).",
              },
              { status: 400 }
            );
          }
        }

        const suppliedTicketCode = intent.ticketCode?.trim();
        if (
          suppliedTicketCode &&
          existing.ticketCode &&
          !isMatchingTicketCode(suppliedTicketCode, existing.ticketCode)
        ) {
          return NextResponse.json(
            {
              success: false,
              error: "Kode tiket tidak sesuai dengan pemesanan yang dipilih.",
            },
            { status: 403 }
          );
        }

        updated = await updateBookingCheckIn(id, intent.checkInStatus, {
          incrementQty: intent.incrementQty,
          targetQty: intent.targetQty,
          reset: intent.reset,
          ticketCode: suppliedTicketCode || existing.ticketCode || id,
          seatNumber: intent.seatNumber,
          enforceDateWindow: !intent.reset,
          checkedInBy: checkInAuth.name || checkInAuth.email || "Petugas Check-In",
        });
        break;
      }
      case "UPLOAD_PAYMENT_PROOF": {
        const token = preAuth.proofGuestToken || "";
        const isTicketHolder = Boolean(
          token && existing.guestToken && token === existing.guestToken.trim()
        );
        if (!isHubAdmin && !isTicketHolder) {
          return NextResponse.json(
            {
              success: false,
              error: "FORBIDDEN: Anda tidak memiliki wewenang untuk memperbarui bukti pembayaran pemesanan ini.",
            },
            { status: 403 }
          );
        }

        updated = await updateBookingPaymentProof(
          { bookingId: id },
          {
            paymentProofUrl: intent.paymentProofUrl,
            paymentProofNote: intent.paymentProofNote,
          }
        );
        break;
      }
    }

    return NextResponse.json({
      success: true,
      message,
      data: sanitizeBookingForResponse(updated, { maskPii: !isHubAdmin }),
    });
  } catch (error: unknown) {
    return bookingErrorResponse(error, id, "PATCH", "Gagal memperbarui tiket peserta.");
  }
}

/**
 * DELETE /api/events/bookings/[id]
 * Admin endpoint to permanently delete an unpaid/expired/cancelled booking without transactions.
 * Strictly restricted to SUPER_ADMIN, OWNER, and MANAGER.
 */
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  try {
    const auth = await assertEventAdmin(req);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 403 }
      );
    }

    const result = await deleteEventBooking(id, {
      actorName: auth.name || "Admin Dago",
      actorRole: auth.role || "SUPER_ADMIN",
    });

    return NextResponse.json({
      success: true,
      message: `Pemesanan tiket '${result.booking.ticketCode || result.booking.id}' berhasil dihapus.`,
      data: sanitizeBookingForResponse(result.booking, { maskPii: false }),
    });
  } catch (error: unknown) {
    return bookingErrorResponse(error, id, "DELETE", "Gagal menghapus pemesanan tiket.");
  }
}
