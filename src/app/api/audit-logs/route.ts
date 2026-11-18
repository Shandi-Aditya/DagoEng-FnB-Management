import { NextRequest, NextResponse } from "next/server";
import { getAuditLogs, appendAuditLog } from "@/lib/persistent-storage";
import { ActivityLogEntry } from "@/types/audit";
import { getRequestAuthUser } from "@/lib/server-auth";
import { RoleSlug } from "@/types/auth";

const AUDIT_READ_ROLES: RoleSlug[] = ["SUPER_ADMIN", "OWNER", "MANAGER"];

export async function GET(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role) {
      return NextResponse.json(
        { error: auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan." },
        { status: 401 }
      );
    }

    if (!AUDIT_READ_ROLES.includes(auth.role)) {
      return NextResponse.json(
        { error: `FORBIDDEN: Role [${auth.role}] tidak memiliki izin membaca log audit.` },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const module = searchParams.get("module");
    const outletId = searchParams.get("outletId");

    let logs = await getAuditLogs();

    if (module) {
      logs = logs.filter((l) => l.module === module);
    }
    if (outletId && outletId !== "ALL") {
      logs = logs.filter((l) => !l.outletId || l.outletId === outletId || l.outletId === "ALL");
    }

    return NextResponse.json({ logs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function buildTrustedAuditEntry(
  auth: { userId: string; role: RoleSlug; name?: string | null; email?: string | null; scopeLevel?: string | null; tenantId?: string | null },
  rawEntry: Partial<ActivityLogEntry> & { action: ActivityLogEntry["action"]; description: string }
): ActivityLogEntry {
  const trustedActorName =
    auth.name ||
    rawEntry.actorName ||
    rawEntry.userName ||
    auth.email ||
    "Authenticated Staff";
  const resolvedStatus = rawEntry.status || "SUCCESS";

  const preservedTimestamp =
    typeof rawEntry.timestamp === "string" && !Number.isNaN(Date.parse(rawEntry.timestamp))
      ? rawEntry.timestamp
      : new Date().toISOString();

  return {
    id: rawEntry.id || `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: preservedTimestamp,
    formattedTime: rawEntry.formattedTime,
    userId: auth.userId,
    userName: trustedActorName,
    userRole: auth.role,
    actorId: auth.userId,
    actorName: trustedActorName,
    actorRole: auth.role,
    role: auth.role,
    organization: rawEntry.organization,
    organizationName: rawEntry.organizationName,
    tenantId:
      auth.scopeLevel === "TENANT" && auth.tenantId ? auth.tenantId : rawEntry.tenantId,
    tenantName: rawEntry.tenantName,
    action: rawEntry.action,
    module: rawEntry.module || "SYSTEM",
    outletId: rawEntry.outletId,
    outletName: rawEntry.outletName,
    description: rawEntry.description,
    recordId: rawEntry.recordId || rawEntry.referenceId,
    referenceId: rawEntry.referenceId || rawEntry.recordId,
    previousValue: rawEntry.previousValue,
    newValue: rawEntry.newValue,
    reason: rawEntry.reason,
    status: resolvedStatus,
    severity:
      rawEntry.severity ||
      (resolvedStatus === "FAILED"
        ? "HIGH"
        : resolvedStatus === "WARNING"
          ? "MEDIUM"
          : "INFO"),
    category: rawEntry.category || "OPERATIONAL",
    metadata: rawEntry.metadata,
  };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role || !auth.userId) {
      return NextResponse.json(
        { error: auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan untuk mencatat audit." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const rawEntry: Partial<ActivityLogEntry> = body.entry || body;

    if (!rawEntry.action || !rawEntry.description) {
      return NextResponse.json({ error: "Audit entry must contain action and description." }, { status: 400 });
    }

    const entry = buildTrustedAuditEntry(
      {
        userId: auth.userId,
        role: auth.role,
        name: auth.name,
        email: auth.email,
        scopeLevel: auth.scopeLevel,
        tenantId: auth.tenantId,
      },
      { ...rawEntry, action: rawEntry.action, description: rawEntry.description }
    );

    const saved = await appendAuditLog(entry);
    return NextResponse.json({ success: true, entry: saved });
  } catch (err: any) {
    if (err.message && err.message.includes("AUDIT_INTEGRITY_VIOLATION")) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Invariant: Audit logs are strictly append-only. DELETE requests are permanently rejected.
export async function DELETE() {
  return NextResponse.json(
    { error: "AUDIT_INTEGRITY_VIOLATION: Audit logs are immutable and cannot be cleared or deleted." },
    { status: 403 }
  );
}
