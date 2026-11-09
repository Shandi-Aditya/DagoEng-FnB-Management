import { NextRequest, NextResponse } from "next/server";
import {
  authorizeSupervisorQrisOverride,
  verifyGatewayWebhook,
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
    const invoiceNumber = searchParams.get("invoiceNumber") || searchParams.get("orderId") || "";

    if (!invoiceNumber.trim()) {
      return NextResponse.json(
        { error: "Parameter invoiceNumber atau orderId wajib disertakan." },
        { status: 400 }
      );
    }

    const session = await getPersistentQrisSession(invoiceNumber);
    const isVerified =
      session?.status === "VERIFIED_WEBHOOK" || session?.status === "VERIFIED_SUPERVISOR";

    return NextResponse.json({
      verified: isVerified,
      status: session?.status || "PENDING",
      session,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mode = body.mode || (body.pin !== undefined ? "SUPERVISOR_OVERRIDE" : "WEBHOOK");

    if (mode === "WEBHOOK") {
      const invoiceNumber = (body.invoiceNumber || body.orderId || "").trim();
      const amount = Number(body.amount);
      const expectedAmount =
        body.expectedAmount !== undefined ? Number(body.expectedAmount) : amount;
      const transactionStatus = body.transactionStatus || "PENDING";
      const signature =
        req.headers.get("x-dago-signature") || body.signature || undefined;

      // Check existing session for expectedAmount if already registered
      const existing = await getPersistentQrisSession(invoiceNumber);
      const effectiveExpected =
        existing && existing.expectedAmount > 0 ? existing.expectedAmount : expectedAmount;

      // Enforce idempotency: duplicate webhook for already settled invoice returns 200 without double-processing
      if (existing && existing.status === "VERIFIED_WEBHOOK") {
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
        expectedAmount: effectiveExpected,
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
        orderId: body.orderId || invoiceNumber,
        invoiceNumber,
        expectedAmount: effectiveExpected,
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
          expectedAmount: effectiveExpected,
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
        supervisorRole,
        supervisorId,
        supervisorName,
      } = body;

      const overrideResult = authorizeSupervisorQrisOverride({
        pin,
        referenceNumber,
        note,
        supervisorRole: supervisorRole || "MANAGER",
        supervisorId: supervisorId || auth.userId,
        supervisorName: supervisorName || auth.name || "Store Supervisor",
      });

      if (!overrideResult.allowed || !overrideResult.verification) {
        return NextResponse.json(
          { allowed: false, error: overrideResult.error },
          { status: overrideResult.statusCode || 403 }
        );
      }

      const resolvedInvoice = (invoiceNumber || orderId || overrideResult.verification.referenceNumber).trim();
      const nowIso = new Date().toISOString();

      const sessionRecord: QrisVerificationSessionRecord = {
        orderId: orderId || resolvedInvoice,
        invoiceNumber: resolvedInvoice,
        expectedAmount: Number(expectedAmount) || 0,
        status: "VERIFIED_SUPERVISOR",
        verificationMethod: "SUPERVISOR_OVERRIDE",
        rrn: overrideResult.verification.referenceNumber,
        verifiedByUserId: overrideResult.verification.supervisorId || auth.userId,
        verifiedByName: overrideResult.verification.supervisorName || auth.name || "Supervisor",
        verifiedByRole: supervisorRole || "MANAGER",
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
          cashierUserId: auth.userId,
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
      { error: "Invalid verification mode. Expected WEBHOOK or SUPERVISOR_OVERRIDE." },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
