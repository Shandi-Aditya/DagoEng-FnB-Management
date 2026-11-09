import { NextRequest, NextResponse } from "next/server";
import {
  authorizeSupervisorQrisOverride,
  verifyGatewayWebhook,
  getWebhookSecret,
} from "@/lib/qris-verification";
import {
  getPersistentQrisSession,
  savePersistentQrisSession,
  appendAuditLog,
  QrisVerificationSessionRecord,
} from "@/lib/persistent-storage";
import { getRequestAuthUser } from "@/lib/server-auth";
import { RoleSlug } from "@/types/auth";

const POS_ALLOWED_ROLES: RoleSlug[] = ["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER"];
const SUPERVISOR_ROLES: RoleSlug[] = ["SUPER_ADMIN", "OWNER", "MANAGER"];

export async function GET(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role) {
      return NextResponse.json(
        { error: auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const invoiceNumber =
      searchParams.get("invoiceNumber") || searchParams.get("orderId") || "";
    const expectedAmountParam = searchParams.get("expectedAmount");

    if (!invoiceNumber.trim()) {
      return NextResponse.json(
        { error: "Parameter invoiceNumber atau orderId wajib disertakan." },
        { status: 400 }
      );
    }

    const session = await getPersistentQrisSession(invoiceNumber);
    const statusVerified =
      session?.status === "VERIFIED_WEBHOOK" || session?.status === "VERIFIED_SUPERVISOR";

    const amountMatches =
      !expectedAmountParam ||
      !session ||
      Math.round(Number(expectedAmountParam)) === Math.round(session.expectedAmount);

    const isVerified = Boolean(statusVerified && amountMatches);

    return NextResponse.json({
      verified: isVerified,
      status: session?.status || "PENDING",
      amountMatches,
      session,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mode =
      body.mode || (body.pin !== undefined ? "SUPERVISOR_OVERRIDE" : "WEBHOOK");

    if (mode === "INIT" || mode === "INIT_SESSION") {
      const auth = await getRequestAuthUser(req);
      if (!auth.isAuthenticated || !auth.role || !auth.userId) {
        return NextResponse.json(
          { error: auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan." },
          { status: 401 }
        );
      }

      if (!POS_ALLOWED_ROLES.includes(auth.role)) {
        return NextResponse.json(
          { error: `FORBIDDEN: Role [${auth.role}] tidak diizinkan membuat sesi QRIS POS.` },
          { status: 403 }
        );
      }

      const invoiceNumber = String(body.invoiceNumber || body.orderId || "").trim();
      const expectedAmount = Math.round(Number(body.expectedAmount));

      if (!invoiceNumber) {
        return NextResponse.json(
          { error: "Parameter invoiceNumber wajib diisi untuk inisialisasi sesi QRIS." },
          { status: 400 }
        );
      }

      if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
        return NextResponse.json(
          { error: "Nominal tagihan QRIS (expectedAmount) wajib lebih besar dari 0." },
          { status: 400 }
        );
      }

      const existing = await getPersistentQrisSession(invoiceNumber);
      if (
        existing &&
        (existing.status === "VERIFIED_WEBHOOK" ||
          existing.status === "VERIFIED_SUPERVISOR") &&
        Math.round(existing.expectedAmount) === expectedAmount
      ) {
        return NextResponse.json({
          success: true,
          session: existing,
        });
      }

      const nowIso = new Date().toISOString();
      const pendingSession: QrisVerificationSessionRecord = {
        orderId: String(body.orderId || invoiceNumber).trim(),
        invoiceNumber,
        expectedAmount,
        status: "PENDING",
        updatedAt: nowIso,
      };

      await savePersistentQrisSession(pendingSession);
      return NextResponse.json({
        success: true,
        session: pendingSession,
      });
    }

    if (mode === "WEBHOOK") {
      // R4: Fail closed immediately with 500 in production if QRIS_WEBHOOK_SECRET is not configured
      try {
        getWebhookSecret();
      } catch (secretErr: any) {
        return NextResponse.json(
          { allowed: false, error: secretErr.message },
          { status: 500 }
        );
      }

      const invoiceNumber = String(body.invoiceNumber || body.orderId || "").trim();
      const amount = Number(body.amount);
      const transactionStatus = body.transactionStatus || "PENDING";
      const signature =
        req.headers.get("x-dago-signature") || body.signature || undefined;

      if (!invoiceNumber) {
        return NextResponse.json(
          { allowed: false, error: "Invoice number wajib disertakan pada webhook QRIS." },
          { status: 400 }
        );
      }

      // R4: Require a pre-registered server session for this invoiceNumber. Never trust body.expectedAmount.
      const existing = await getPersistentQrisSession(invoiceNumber);
      if (!existing || !Number.isFinite(existing.expectedAmount) || existing.expectedAmount <= 0) {
        return NextResponse.json(
          {
            allowed: false,
            error: `QRIS_SESSION_NOT_FOUND: Tagihan QRIS [${invoiceNumber}] belum terdaftar di server.`,
          },
          { status: 404 }
        );
      }

      const authoritativeExpectedAmount = existing.expectedAmount;

      // Enforce idempotency: duplicate webhook for already settled invoice returns 200 without double-processing
      if (existing.status === "VERIFIED_WEBHOOK") {
        // Still validate signature and amount so an invalid replay cannot probe or spoof
        const replayCheck = verifyGatewayWebhook({
          transactionStatus,
          invoiceNumber,
          amount,
          expectedAmount: authoritativeExpectedAmount,
          signature,
          requireSignature: true,
        });
        if (!replayCheck.allowed) {
          return NextResponse.json(
            { allowed: false, error: replayCheck.error },
            { status: replayCheck.statusCode || 400 }
          );
        }

        return NextResponse.json({
          success: true,
          allowed: true,
          idempotent: true,
          alreadyProcessed: true,
          session: existing,
          verification: {
            type: "GATEWAY_WEBHOOK",
            referenceNumber: existing.invoiceNumber,
            verifiedAt: existing.verifiedAt || existing.updatedAt,
            note: "Idempotent webhook replay (already verified)",
          },
        });
      }

      const webhookCheck = verifyGatewayWebhook({
        transactionStatus,
        invoiceNumber,
        amount,
        expectedAmount: authoritativeExpectedAmount,
        signature,
        requireSignature: true,
      });

      if (!webhookCheck.allowed || !webhookCheck.verification) {
        return NextResponse.json(
          { allowed: false, error: webhookCheck.error },
          { status: webhookCheck.statusCode || 400 }
        );
      }

      const nowIso = new Date().toISOString();
      const sessionRecord: QrisVerificationSessionRecord = {
        orderId: existing.orderId || body.orderId || invoiceNumber,
        invoiceNumber,
        expectedAmount: authoritativeExpectedAmount,
        status: "VERIFIED_WEBHOOK",
        verificationMethod: "GATEWAY_WEBHOOK",
        transactionId: body.transactionId || invoiceNumber,
        verifiedAt: webhookCheck.verification.verifiedAt,
        updatedAt: nowIso,
      };

      await savePersistentQrisSession(sessionRecord);

      await appendAuditLog({
        id: `audit-qris-wh-${invoiceNumber}-${Date.now()}`,
        timestamp: nowIso,
        userId: "system-gateway-webhook",
        userName: "DagoPay / DOKU Webhook",
        userRole: "SYSTEM",
        action: "QRIS_WEBHOOK_SETTLED",
        module: "POS",
        description: `Pembayaran QRIS terverifikasi otomatis via webhook gateway (${invoiceNumber}) sebesar Rp ${Math.round(amount).toLocaleString("id-ID")}`,
        referenceId: invoiceNumber,
        metadata: {
          invoiceNumber,
          amount,
          expectedAmount: authoritativeExpectedAmount,
          transactionStatus,
        },
      });

      return NextResponse.json({
        success: true,
        allowed: true,
        idempotent: false,
        session: sessionRecord,
        verification: webhookCheck.verification,
      });
    }

    if (mode === "SUPERVISOR_OVERRIDE") {
      const auth = await getRequestAuthUser(req);
      if (!auth.isAuthenticated || !auth.role || !auth.userId) {
        return NextResponse.json(
          {
            allowed: false,
            error: auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan.",
          },
          { status: 401 }
        );
      }

      if (!POS_ALLOWED_ROLES.includes(auth.role)) {
        return NextResponse.json(
          {
            allowed: false,
            error: `FORBIDDEN: Role [${auth.role}] tidak diizinkan mengakses verifikasi pembayaran POS.`,
          },
          { status: 403 }
        );
      }

      const {
        pin,
        referenceNumber,
        note,
        invoiceNumber,
        orderId,
        expectedAmount,
      } = body;

      // R5: Never read supervisorRole, supervisorId, or supervisorName from req.body!
      // Resolve supervisor authority strictly on the server.
      const isCallerAlreadySupervisor = SUPERVISOR_ROLES.includes(auth.role);
      const serverSupervisorRole: RoleSlug = isCallerAlreadySupervisor
        ? auth.role
        : "MANAGER";
      const serverSupervisorId = isCallerAlreadySupervisor
        ? auth.userId
        : "emp-001";
      const serverSupervisorName = isCallerAlreadySupervisor
        ? auth.name || "Store Supervisor"
        : "Putu Arya (Store Manager)";

      const overrideResult = authorizeSupervisorQrisOverride({
        pin,
        referenceNumber,
        note,
        supervisorRole: serverSupervisorRole,
        supervisorId: serverSupervisorId,
        supervisorName: serverSupervisorName,
        actorKey: auth.userId,
      });

      if (!overrideResult.allowed || !overrideResult.verification) {
        return NextResponse.json(
          { allowed: false, error: overrideResult.error },
          { status: overrideResult.statusCode || 403 }
        );
      }

      const resolvedInvoice = String(
        invoiceNumber || orderId || overrideResult.verification.referenceNumber
      ).trim();
      const existing = await getPersistentQrisSession(resolvedInvoice);
      const resolvedExpectedAmount =
        existing && existing.expectedAmount > 0
          ? existing.expectedAmount
          : Math.round(Number(expectedAmount) || 0);

      const nowIso = new Date().toISOString();

      const sessionRecord: QrisVerificationSessionRecord = {
        orderId: String(orderId || existing?.orderId || resolvedInvoice),
        invoiceNumber: resolvedInvoice,
        expectedAmount: resolvedExpectedAmount,
        status: "VERIFIED_SUPERVISOR",
        verificationMethod: "SUPERVISOR_OVERRIDE",
        rrn: overrideResult.verification.referenceNumber,
        verifiedByUserId: serverSupervisorId,
        verifiedByName: serverSupervisorName,
        verifiedByRole: serverSupervisorRole,
        verifiedAt: overrideResult.verification.verifiedAt,
        updatedAt: nowIso,
      };

      await savePersistentQrisSession(sessionRecord);

      await appendAuditLog({
        id: `audit-qris-sup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: nowIso,
        userId: auth.userId,
        userName: auth.name || auth.email || "Kasir POS",
        userRole: auth.role,
        action: "QRIS_SUPERVISOR_MANUAL_OVERRIDE",
        module: "POS",
        description: `Otorisasi manual QRIS Statis disetujui oleh Supervisor (${sessionRecord.verifiedByName}). RRN: ${overrideResult.verification.referenceNumber}`,
        referenceId: resolvedInvoice,
        metadata: {
          invoiceNumber: resolvedInvoice,
          rrn: overrideResult.verification.referenceNumber,
          expectedAmount: sessionRecord.expectedAmount,
          authorizedBySupervisorId: sessionRecord.verifiedByUserId,
          authorizedBySupervisorName: sessionRecord.verifiedByName,
          authorizedBySupervisorRole: sessionRecord.verifiedByRole,
          requestedByCashierId: auth.userId,
          requestedByRole: auth.role,
          note: overrideResult.verification.note,
        },
      });

      return NextResponse.json({
        success: true,
        allowed: true,
        session: sessionRecord,
        verification: overrideResult.verification,
      });
    }

    return NextResponse.json(
      { error: "Invalid verification mode. Expected INIT, WEBHOOK, or SUPERVISOR_OVERRIDE." },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
