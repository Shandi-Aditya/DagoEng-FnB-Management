import { NextRequest, NextResponse } from "next/server";
import { getRequestAuthUser } from "@/lib/server-auth";
import {
  appendAuditLog,
  mutatePersistentData,
  readPersistentData,
} from "@/lib/persistent-storage";
import { DEFAULT_TENANT_REVENUE_SPLITS } from "@/lib/settlement";
import {
  canManageSettlementAndReceiptPolicy,
  DEFAULT_SETTLEMENT_RECEIPT_POLICY,
  mergeSettlementReceiptPolicy,
  SETTLEMENT_POLICY_STORAGE_FILE,
  validateSettlementReceiptPolicyInput,
  type SettlementReceiptPolicyConfig,
} from "@/lib/settlement-receipt-policy";

export const dynamic = "force-dynamic";

class PolicyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyValidationError";
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role) {
      return NextResponse.json(
        { success: false, error: auth.error || "UNAUTHORIZED: Autentikasi sesi diperlukan." },
        { status: 401 }
      );
    }

    const ALLOWED_SETTLEMENT_READ_ROLES: string[] = ["SUPER_ADMIN", "OWNER", "MANAGER"];
    if (!ALLOWED_SETTLEMENT_READ_ROLES.includes(auth.role)) {
      return NextResponse.json(
        {
          success: false,
          error: `Akses ditolak: Role [${auth.role}] tidak memiliki wewenang untuk membaca kebijakan bagi hasil.`,
        },
        { status: 403 }
      );
    }

    const stored = await readPersistentData<Partial<SettlementReceiptPolicyConfig> | null>(
      SETTLEMENT_POLICY_STORAGE_FILE,
      null
    );
    const policy = mergeSettlementReceiptPolicy(stored, DEFAULT_TENANT_REVENUE_SPLITS);

    return NextResponse.json({
      success: true,
      policy,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membaca kebijakan bagi hasil dan struk.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role) {
      return NextResponse.json(
        { success: false, error: auth.error || "UNAUTHORIZED: Autentikasi sesi diperlukan." },
        { status: 401 }
      );
    }

    if (!canManageSettlementAndReceiptPolicy({ role: auth.role, scopeLevel: auth.scopeLevel })) {
      return NextResponse.json(
        {
          success: false,
          error:
            "FORBIDDEN: Hanya Pemilik organisasi atau Super Admin yang berwenang mengubah kebijakan bagi hasil dan role struk.",
        },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Body JSON tidak valid." },
        { status: 400 }
      );
    }

    const actorName = auth.name || auth.email || auth.role;
    const nowIso = new Date().toISOString();
    let previousPolicy: SettlementReceiptPolicyConfig = mergeSettlementReceiptPolicy(
      DEFAULT_SETTLEMENT_RECEIPT_POLICY,
      DEFAULT_TENANT_REVENUE_SPLITS
    );

    const savedPolicy = await mutatePersistentData<SettlementReceiptPolicyConfig>(
      SETTLEMENT_POLICY_STORAGE_FILE,
      mergeSettlementReceiptPolicy(DEFAULT_SETTLEMENT_RECEIPT_POLICY, DEFAULT_TENANT_REVENUE_SPLITS),
      (current) => {
        previousPolicy = mergeSettlementReceiptPolicy(current, DEFAULT_TENANT_REVENUE_SPLITS);
        const validation = validateSettlementReceiptPolicyInput(body, previousPolicy);
        if (!validation.valid) {
          throw new PolicyValidationError(validation.error);
        }

        return {
          ...validation.policy,
          updatedAt: nowIso,
          updatedBy: actorName,
        };
      }
    );

    await appendAuditLog({
      id: `audit-settlement-receipt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: nowIso,
      actorId: auth.userId || undefined,
      actorName,
      actorRole: auth.role,
      userId: auth.userId || "unknown",
      userName: actorName,
      userRole: auth.role,
      module: "SETTINGS",
      action: "SETTLEMENT_RECEIPT_POLICY_UPDATED",
      recordId: "cfg-settlement-receipt",
      previousValue: JSON.stringify({
        settlementBasis: previousPolicy.settlementBasis,
        receiptRoles: previousPolicy.receiptRoles,
      }),
      newValue: JSON.stringify({
        settlementBasis: savedPolicy.settlementBasis,
        receiptRoles: savedPolicy.receiptRoles,
      }),
      description: `Kebijakan bagi hasil (${savedPolicy.settlementBasis}) dan distribusi role struk diperbarui oleh ${actorName}.`,
      status: "SUCCESS",
    });

    return NextResponse.json({
      success: true,
      policy: savedPolicy,
    });
  } catch (error) {
    if (error instanceof PolicyValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message =
      error instanceof Error ? error.message : "Gagal menyimpan kebijakan bagi hasil dan struk.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export const POST = PUT;
