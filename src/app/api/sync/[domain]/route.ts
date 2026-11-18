import { NextRequest, NextResponse } from "next/server";
import { getRequestAuthUser, type ServerAuthResult } from "@/lib/server-auth";
import {
  appendAuditLog,
  applyPersistentDomainCommand,
  readPersistentData,
  readPersistentDomainState,
  writePersistentData,
} from "@/lib/persistent-storage";
import {
  SYNC_DOMAINS,
  type DomainCommandMap,
  type DomainStateMap,
  type ServerDomainSpec,
  type SyncDomainName,
} from "@/lib/domain-sync-types";
import {
  platformSettingsDomainSpec,
  printerConfigDomainSpec,
  subscriptionDomainSpec,
  tenantsDomainSpec,
  wifiDomainSpec,
} from "@/lib/sync-domains/config-spec";
import { inventoryDomainSpec } from "@/lib/sync-domains/inventory-spec";
import {
  commercialDomainSpec,
  coworkingMasterDomainSpec,
  tablesDomainSpec,
} from "@/lib/sync-domains/spaces-spec";
import type { TenantOperationConfig } from "@/lib/operating-hours";
import type { ActivityModule } from "@/types/audit";

export const dynamic = "force-dynamic";

const TENANT_OPERATIONS_FILE = "tenant_operations.json";

const SERVER_DOMAIN_SPECS: {
  [D in SyncDomainName]: ServerDomainSpec<D>;
} = {
  "platform-settings": platformSettingsDomainSpec,
  tenants: tenantsDomainSpec,
  wifi: wifiDomainSpec,
  subscription: subscriptionDomainSpec,
  "printer-config": printerConfigDomainSpec,
  inventory: inventoryDomainSpec,
  tables: tablesDomainSpec,
  "coworking-master": coworkingMasterDomainSpec,
  commercial: commercialDomainSpec,
};

const DOMAIN_AUDIT_MODULES: Record<SyncDomainName, ActivityModule> = {
  "platform-settings": "SETTINGS",
  tenants: "SETTINGS",
  wifi: "SETTINGS",
  subscription: "SETTINGS",
  "printer-config": "SETTINGS",
  inventory: "INVENTORY",
  tables: "TABLES",
  "coworking-master": "COWORKING",
  commercial: "COMMERCIAL",
};

const HIGH_FREQUENCY_OPS = new Set<string>([
  "APPLY_BOM_DELTAS",
  "ISSUE_VOUCHER",
  "REDEEM_PROMO",
  "REFUND_PROMO",
  "PATCH_TABLE_STATUS",
  "PATCH_SPACE_SESSION",
]);

function isSyncDomainName(value: string): value is SyncDomainName {
  return (SYNC_DOMAINS as readonly string[]).includes(value);
}

async function overlayTenantOperationsIfNeeded<D extends SyncDomainName>(
  domain: D,
  state: DomainStateMap[D]
): Promise<DomainStateMap[D]> {
  if (domain !== "platform-settings") return state;
  const storedOps = await readPersistentData<Record<string, TenantOperationConfig> | null>(
    TENANT_OPERATIONS_FILE,
    null
  );
  if (!storedOps || typeof storedOps !== "object") return state;
  const platformState = state as DomainStateMap["platform-settings"];
  return {
    ...platformState,
    tenantOperations: {
      ...(platformState.tenantOperations || {}),
      ...storedOps,
    },
  } as DomainStateMap[D];
}

async function handleDomainGet<D extends SyncDomainName>(
  domain: D,
  auth: ServerAuthResult
): Promise<NextResponse> {
  const spec = SERVER_DOMAIN_SPECS[domain];
  const readDecision = spec.authorizeRead(auth);
  if (!readDecision.allowed) {
    return NextResponse.json(
      { success: false, error: readDecision.error },
      { status: readDecision.status }
    );
  }

  const rawState = await readPersistentDomainState(spec);
  const hydratedState = await overlayTenantOperationsIfNeeded(domain, rawState);
  const output = readDecision.transform
    ? readDecision.transform(hydratedState)
    : hydratedState;

  return NextResponse.json({
    success: true,
    domain,
    state: output,
  });
}

async function handleDomainPost<D extends SyncDomainName>(
  domain: D,
  auth: ServerAuthResult,
  command: DomainCommandMap[D]
): Promise<NextResponse> {
  const spec = SERVER_DOMAIN_SPECS[domain];
  const writeDecision = spec.authorizeWrite(auth, command);
  if (!writeDecision.allowed) {
    return NextResponse.json(
      { success: false, error: writeDecision.error },
      { status: writeDecision.status }
    );
  }

  const nextState = await applyPersistentDomainCommand(spec, command, auth);

  if (domain === "platform-settings") {
    const platformCmd = command as DomainCommandMap["platform-settings"];
    if (platformCmd.op === "PATCH_SETTINGS" && platformCmd.patch?.tenantOperations) {
      const platformState = nextState as DomainStateMap["platform-settings"];
      if (platformState.tenantOperations) {
        await writePersistentData(TENANT_OPERATIONS_FILE, platformState.tenantOperations);
      }
    }
  }

  const mergedState = await overlayTenantOperationsIfNeeded(domain, nextState);
  const readDecision = spec.authorizeRead(auth);
  const output =
    readDecision.allowed && readDecision.transform
      ? readDecision.transform(mergedState)
      : mergedState;

  if (auth.isAuthenticated && auth.userId && !HIGH_FREQUENCY_OPS.has(command.op)) {
    await appendAuditLog({
      id: `audit-sync-${domain}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      actorId: auth.userId,
      actorName: auth.name || auth.email || auth.userId,
      actorRole: auth.role || "SYSTEM",
      userId: auth.userId,
      userName: auth.name || auth.email || auth.userId,
      userRole: auth.role || "SYSTEM",
      tenantId: auth.tenantId || undefined,
      module: DOMAIN_AUDIT_MODULES[domain],
      action: `DOMAIN_SYNC_${command.op}`,
      description: `Sinkronisasi domain [${domain}] operasi [${command.op}]`,
      status: "SUCCESS",
      severity: "INFO",
      category: "CONFIGURATION",
    }).catch(() => {});
  }

  return NextResponse.json({
    success: true,
    domain,
    state: output,
  });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ domain: string }> }
) {
  try {
    const { domain } = await context.params;
    if (!isSyncDomainName(domain)) {
      return NextResponse.json(
        { success: false, error: `Domain sinkronisasi [${domain}] tidak dikenal.` },
        { status: 404 }
      );
    }

    const auth = await getRequestAuthUser(req);
    return await handleDomainGet(domain, auth);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Gagal membaca state domain dari server.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ domain: string }> }
) {
  try {
    const { domain } = await context.params;
    if (!isSyncDomainName(domain)) {
      return NextResponse.json(
        { success: false, error: `Domain sinkronisasi [${domain}] tidak dikenal.` },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => null);
    const command = body?.command;
    if (!command || typeof command !== "object" || typeof command.op !== "string") {
      return NextResponse.json(
        { success: false, error: "Payload wajib menyertakan objek command dengan field op." },
        { status: 400 }
      );
    }

    const auth = await getRequestAuthUser(req);
    return await handleDomainPost(
      domain,
      auth,
      command as DomainCommandMap[typeof domain]
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Gagal menyimpan mutasi domain ke server.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
