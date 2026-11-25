import { NextRequest, NextResponse } from "next/server";
import { getRequestAuthUser } from "@/lib/server-auth";
import {
  appendAuditLog,
  applyPersistentDomainCommand,
  getPersistentOrders,
  mutatePersistentData,
  readPersistentData,
} from "@/lib/persistent-storage";
import { tenantsDomainSpec } from "@/lib/sync-domains/config-spec";
import { normalizeTenantId } from "@/lib/tax-breakdown";
import {
  calculateWeeklyTenantSettlement,
  WEEKLY_SETTLEMENTS_STORAGE_FILE,
  type SettlementActionDirection,
  type SettlementPaymentStatus,
  type SettlementStatusRecord,
} from "@/features/reports/settlement-weekly-domain";

export const dynamic = "force-dynamic";

function canReadAllSettlements(auth: { role: string | null; scopeLevel: string | null }): boolean {
  if (auth.role === "SUPER_ADMIN") return true;
  if (auth.role === "OWNER" && auth.scopeLevel !== "TENANT") return true;
  if (auth.role === "MANAGER" && auth.scopeLevel !== "TENANT") return true;
  return false;
}

function canMutateWeeklySettlement(auth: { role: string | null; scopeLevel: string | null }): boolean {
  if (auth.role === "SUPER_ADMIN") return true;
  if (auth.role === "OWNER" && auth.scopeLevel !== "TENANT") return true;
  return false;
}

function matchesTenantRecord(
  key: string,
  record: SettlementStatusRecord,
  normTenantId: string
): boolean {
  if (record.tenantId) {
    const recNorm = normalizeTenantId(record.tenantId) ?? record.tenantId.trim();
    return recNorm === normTenantId;
  }
  return key.endsWith(`_${normTenantId}`);
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

    const isAllReader = canReadAllSettlements(auth);
    const isTenantOwner =
      auth.role === "OWNER" && auth.scopeLevel === "TENANT" && Boolean(auth.tenantId);

    if (!isAllReader && !isTenantOwner) {
      return NextResponse.json(
        {
          success: false,
          error: `FORBIDDEN: Role [${auth.role}] tidak memiliki izin membaca status settlement mingguan.`,
        },
        { status: 403 }
      );
    }

    const periodKeyParam = req.nextUrl.searchParams.get("periodKey")?.trim();
    const stored = await readPersistentData<Record<string, SettlementStatusRecord>>(
      WEEKLY_SETTLEMENTS_STORAGE_FILE,
      {}
    );

    const normAuthTenant =
      isTenantOwner && auth.tenantId
        ? normalizeTenantId(auth.tenantId) ?? auth.tenantId.trim()
        : null;

    const filtered: Record<string, SettlementStatusRecord> = {};
    for (const [key, record] of Object.entries(stored || {})) {
      if (periodKeyParam && !key.startsWith(`${periodKeyParam}_`)) {
        continue;
      }
      if (normAuthTenant && !matchesTenantRecord(key, record, normAuthTenant)) {
        continue;
      }
      filtered[key] = record;
    }

    return NextResponse.json({
      success: true,
      records: filtered,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membaca status settlement mingguan.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role) {
      return NextResponse.json(
        { success: false, error: auth.error || "UNAUTHORIZED: Autentikasi sesi diperlukan." },
        { status: 401 }
      );
    }

    if (!canMutateWeeklySettlement(auth)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "FORBIDDEN: Hanya Super Admin atau Pemilik organisasi yang dapat mengubah status settlement mingguan.",
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

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Payload settlement tidak valid." },
        { status: 400 }
      );
    }

    const raw = body as Record<string, unknown>;
    const periodKey = typeof raw.periodKey === "string" ? raw.periodKey.trim() : "";
    const rawTenantId = typeof raw.tenantId === "string" ? raw.tenantId.trim() : "";
    const status = raw.status as SettlementPaymentStatus;
    const direction = raw.direction as SettlementActionDirection | undefined;
    const notes = typeof raw.notes === "string" ? raw.notes.trim() : undefined;

    if (!periodKey || !rawTenantId) {
      return NextResponse.json(
        { success: false, error: "periodKey dan tenantId wajib diisi." },
        { status: 400 }
      );
    }

    if (status !== "PAID" && status !== "PENDING") {
      return NextResponse.json(
        { success: false, error: "status harus bernilai PAID atau PENDING." },
        { status: 400 }
      );
    }

    if (
      direction !== undefined &&
      direction !== "MITRA_TO_DAGO" &&
      direction !== "DAGO_TO_MITRA" &&
      direction !== "SETTLED"
    ) {
      return NextResponse.json(
        { success: false, error: "direction tidak valid." },
        { status: 400 }
      );
    }

    const normTenantId = normalizeTenantId(rawTenantId) ?? rawTenantId;
    const key = `${periodKey}_${normTenantId}`;
    const actorName = auth.name || auth.email || "Admin";
    const nowIso = new Date().toISOString();

    let previousRecord: SettlementStatusRecord | undefined;

    const updatedStore = await mutatePersistentData<Record<string, SettlementStatusRecord>>(
      WEEKLY_SETTLEMENTS_STORAGE_FILE,
      {},
      (current) => {
        previousRecord = current?.[key];
        const nextRecord: SettlementStatusRecord = {
          status,
          paidAt: status === "PAID" ? nowIso : undefined,
          paidBy: status === "PAID" ? actorName : undefined,
          notes: notes || undefined,
          updatedAt: nowIso,
          periodKey,
          tenantId: normTenantId,
          direction,
        };
        return {
          ...(current || {}),
          [key]: nextRecord,
        };
      }
    );

    const savedRecord = updatedStore[key];

    let effectiveDirection = direction;
    if (effectiveDirection === undefined && status === "PAID") {
      const orders = await getPersistentOrders().catch(() => []);
      const periodAnchor = periodKey.split("_")[0];
      const computed = calculateWeeklyTenantSettlement(orders, normTenantId, {
        referenceDate: periodAnchor || undefined,
      });
      if (computed.transactionCount > 0 || (computed.refundDeduction ?? 0) > 0) {
        effectiveDirection = computed.actionDirection;
      } else {
        effectiveDirection = previousRecord?.direction ?? "MITRA_TO_DAGO";
      }
    }

    await appendAuditLog({
      id: `audit-weekly-settlement-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: nowIso,
      actorId: auth.userId || undefined,
      actorName,
      actorRole: auth.role,
      userId: auth.userId || "unknown",
      userName: actorName,
      userRole: auth.role,
      tenantId: normTenantId,
      module: "FINANCE",
      action:
        status === "PAID"
          ? "WEEKLY_SETTLEMENT_MARKED_PAID"
          : "WEEKLY_SETTLEMENT_REVERTED_PENDING",
      recordId: key,
      previousValue: JSON.stringify(previousRecord ?? null),
      newValue: JSON.stringify(savedRecord),
      description: `Status settlement mingguan [${key}] diubah menjadi ${status} oleh ${actorName}.`,
      status: "SUCCESS",
    });

    if (
      status === "PAID" &&
      effectiveDirection === "MITRA_TO_DAGO" &&
      normTenantId !== "DAGO_HUB"
    ) {
      await applyPersistentDomainCommand(
        tenantsDomainSpec,
        {
          op: "SET_TENANT_STATUS",
          tenantId: normTenantId,
          status: "ACTIVE",
        },
        auth
      );
    }

    return NextResponse.json({
      success: true,
      key,
      record: savedRecord,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menyimpan status settlement mingguan.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
