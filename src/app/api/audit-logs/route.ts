import { NextRequest, NextResponse } from "next/server";
import { getAuditLogs, appendAuditLog } from "@/lib/persistent-storage";
import { ActivityLogEntry } from "@/types/audit";

export async function GET(req: NextRequest) {
  try {
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
    const body = await req.json();
    const entry: ActivityLogEntry = body.entry || body;

    if (!entry.action || !entry.description) {
      return NextResponse.json({ error: "Audit entry must contain action and description." }, { status: 400 });
    }

    if (!entry.id) {
      entry.id = `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }
    if (!entry.timestamp) {
      entry.timestamp = new Date().toISOString();
    }

    await appendAuditLog(entry);
    return NextResponse.json({ success: true, entry });
  } catch (err: any) {
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
