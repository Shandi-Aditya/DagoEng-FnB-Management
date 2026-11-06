import { NextRequest, NextResponse } from "next/server";
import { assertEventAdmin } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/system/health
 * Production verification endpoint for database & runtime connectivity.
 * 
 * Access control:
 * - Public / Unauthenticated: Returns strictly generic status without exposing hostnames, database names, or infrastructure topology.
 * - Authenticated Dago Admin: Returns detailed diagnostic telemetry (masked host, provider, latency).
 */
export async function GET(req: NextRequest) {
  const start = Date.now();
  const rawUrl = process.env.DATABASE_URL;

  // Check if caller is authenticated Dago Admin
  const adminAuth = await assertEventAdmin(req).catch(() => ({
    authorized: false,
    name: undefined,
    role: undefined,
  }));
  const isAdmin = Boolean(adminAuth && adminAuth.authorized);

  if (!rawUrl) {
    if (!isAdmin) {
      return NextResponse.json(
        {
          status: "degraded",
          database: "disconnected",
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        status: "degraded",
        environment: process.env.NODE_ENV || "unknown",
        database: {
          configured: false,
          connected: false,
          message: "DATABASE_URL environment variable is not defined in this runtime.",
        },
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }

  try {
    const { db } = await import("@/lib/db");
    // Lightweight live connectivity probe with strict 3.5s timeout
    await Promise.race([
      db.$queryRaw`SELECT 1 as live`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Database probe timeout (3500ms)")), 3500)
      ),
    ]);

    const latencyMs = Date.now() - start;

    // 1. Public Response: Strictly generic, NO infrastructure leakage
    if (!isAdmin) {
      return NextResponse.json({
        status: "healthy",
        database: "connected",
        timestamp: new Date().toISOString(),
      });
    }

    // 2. Admin Diagnostic Response
    let sanitizedHost = "unknown";
    let databaseName = "unknown";
    try {
      const parsed = new URL(rawUrl);
      sanitizedHost = parsed.hostname;
      databaseName = parsed.pathname.replace(/^\//, "") || "default";
    } catch {
      sanitizedHost = "malformed-url";
    }

    return NextResponse.json({
      status: "healthy",
      environment: process.env.NODE_ENV || "unknown",
      database: {
        configured: true,
        connected: true,
        provider: "postgresql",
        host: sanitizedHost,
        database: databaseName,
        latencyMs,
      },
      diagnostics: {
        authenticatedAdmin: adminAuth.name || adminAuth.role || "Admin Dago",
        nodeVersion: process.version,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[system-health] Database probe failed:", err?.message || err);

    if (!isAdmin) {
      return NextResponse.json(
        {
          status: "degraded",
          database: "disconnected",
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        status: "degraded",
        environment: process.env.NODE_ENV || "unknown",
        database: {
          configured: true,
          connected: false,
          error: "Failed to connect to PostgreSQL database instance.",
        },
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
