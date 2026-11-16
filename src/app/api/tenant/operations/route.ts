import { NextRequest, NextResponse } from "next/server";
import {
  readPersistentData,
  writePersistentData,
} from "@/lib/persistent-storage";
import {
  DEFAULT_TENANT_OPERATIONS,
  type TenantOperationConfig,
} from "@/lib/operating-hours";

export const dynamic = "force-dynamic";

const STORAGE_FILE = "tenant_operations.json";

/**
 * GET /api/tenant/operations
 * Reads tenant operational hours, open/closed statuses, and manual overrides from persistent server storage.
 */
export async function GET(_req: NextRequest) {
  try {
    const stored = await readPersistentData<Record<string, TenantOperationConfig>>(
      STORAGE_FILE,
      DEFAULT_TENANT_OPERATIONS
    );

    const merged: Record<string, TenantOperationConfig> = {
      ...DEFAULT_TENANT_OPERATIONS,
      ...(stored || {}),
    };

    return NextResponse.json({
      success: true,
      tenantOperations: merged,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal membaca data operasional mitra." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tenant/operations
 * Updates and persists tenant operational hours, status, and manual overrides.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { tenantOperations, tenantId, updates } = body;

    const current = await readPersistentData<Record<string, TenantOperationConfig>>(
      STORAGE_FILE,
      DEFAULT_TENANT_OPERATIONS
    );

    let nextOperations: Record<string, TenantOperationConfig> = {
      ...DEFAULT_TENANT_OPERATIONS,
      ...(current || {}),
    };

    const nowIso = new Date().toISOString();

    if (tenantOperations && typeof tenantOperations === "object") {
      Object.entries(tenantOperations).forEach(([tId, config]) => {
        if (config && typeof config === "object") {
          nextOperations[tId] = {
            ...nextOperations[tId],
            ...(config as TenantOperationConfig),
            tenantId: tId,
            updatedAt: nowIso,
          };
        }
      });
    } else if (tenantId && updates && typeof updates === "object") {
      nextOperations[tenantId] = {
        ...nextOperations[tenantId],
        ...updates,
        tenantId,
        updatedAt: nowIso,
      };
    } else {
      return NextResponse.json(
        { success: false, error: "Payload tidak valid. Kirim 'tenantOperations' atau 'tenantId' dengan 'updates'." },
        { status: 400 }
      );
    }

    await writePersistentData(STORAGE_FILE, nextOperations);

    return NextResponse.json({
      success: true,
      tenantOperations: nextOperations,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menyimpan jam operasional mitra." },
      { status: 500 }
    );
  }
}
