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

    // Bind actor identity from server session; generate server timestamp if not explicitly provided
    const entry: ActivityLogEntry = {
      id: rawEntry.id || `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      userId: auth.userId,
      userName: auth.name || rawEntry.userName || auth.email || "Authenticated Staff",
      userRole: auth.role,
      action: rawEntry.action,
      module: rawEntry.module || "SYSTEM",
      outletId: rawEntry.outletId,
      outletName: rawEntry.outletName,
      description: rawEntry.description,
      referenceId: rawEntry.referenceId,
      metadata: rawEntry.metadata,
    };

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
