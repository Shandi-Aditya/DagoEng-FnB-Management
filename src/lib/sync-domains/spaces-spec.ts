import {
  createSyncedDomainClient,
  type LocalStorageMirrorAdapter,
  type SyncedDomainClient,
} from "@/lib/domain-sync";
import {
  MAX_COWORKING_CHECK_LOGS,
  type CommercialCommand,
  type CommercialDomainState,
  type CoworkingMasterCommand,
  type CoworkingMasterState,
  type ServerDomainSpec,
  type TablesCommand,
  type TablesDomainState,
} from "@/lib/domain-sync-types";
import { MEMBERSHIP_PLANS } from "@/features/coworking/coworking-data";
import type { ServerAuthResult } from "@/lib/server-auth";
import type { RoleSlug } from "@/types/auth";
import type {
  AreaItem,
  ScheduledReservation,
  TableItem,
} from "@/contexts/TableContext";
import type {
  CheckInOutLog,
  CoworkingMemberProfile,
} from "@/contexts/CoworkingContext";
import type {
  CoworkingMembershipPlan,
  CoworkingSpaceItem,
} from "@/types/coworking";
import type { CommercialLease } from "@/types/commercial";

export const STORAGE_KEY_TABLES_AREAS = "dagoeng_tables_areas_v3";
export const STORAGE_KEY_TABLES_RESERVATIONS = "dagoeng_tables_reservations_v3";
export const STORAGE_KEY_CWK_SPACES = "dagoeng_cwk_spaces_v3";
export const STORAGE_KEY_CWK_MEMBERS = "dagoeng_cwk_members_v3";
export const STORAGE_KEY_CWK_LOGS = "dagoeng_cwk_logs_v3";
export const STORAGE_KEY_CWK_PLANS = "dagoeng_cwk_plans_v1";
export const STORAGE_KEY_COMMERCIAL = "dagoeng_commercial_leases_v3";

export const INITIAL_AREAS: AreaItem[] = [
  {
    id: "area-sgr-1",
    name: "Indoor AC Main Hall",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    tables: [
      { id: "T-01", number: "T-01", cap: 2, status: "AVAILABLE", outletId: "outlet-sgr", outletName: "Singaraja" },
      { id: "T-02", number: "T-02", cap: 4, status: "AVAILABLE", outletId: "outlet-sgr", outletName: "Singaraja" },
      { id: "T-03", number: "T-03", cap: 4, status: "AVAILABLE", outletId: "outlet-sgr", outletName: "Singaraja" },
      { id: "T-04", number: "T-04", cap: 6, status: "AVAILABLE", outletId: "outlet-sgr", outletName: "Singaraja" },
      { id: "VIP-01", number: "VIP-01", cap: 8, status: "AVAILABLE", outletId: "outlet-sgr", outletName: "Singaraja" },
    ],
  },
  {
    id: "area-sgr-2",
    name: "Outdoor Tropical Garden",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    tables: [
      { id: "OUT-01", number: "OUT-01", cap: 4, status: "AVAILABLE", outletId: "outlet-sgr", outletName: "Singaraja" },
      { id: "OUT-02", number: "OUT-02", cap: 6, status: "AVAILABLE", outletId: "outlet-sgr", outletName: "Singaraja" },
      { id: "OUT-03", number: "OUT-03", cap: 2, status: "AVAILABLE", outletId: "outlet-sgr", outletName: "Singaraja" },
    ],
  },
  {
    id: "area-dps-1",
    name: "VIP Lounge Denpasar",
    outletId: "outlet-dps",
    outletName: "Denpasar",
    tables: [
      { id: "DPS-01", number: "DPS-01", cap: 4, status: "AVAILABLE", outletId: "outlet-dps", outletName: "Denpasar" },
      { id: "DPS-02", number: "DPS-02", cap: 6, status: "AVAILABLE", outletId: "outlet-dps", outletName: "Denpasar" },
    ],
  },
  {
    id: "area-ubd-1",
    name: "Jungle Terrace Ubud",
    outletId: "outlet-ubd",
    outletName: "Ubud",
    tables: [
      { id: "UBD-01", number: "UBD-01", cap: 2, status: "AVAILABLE", outletId: "outlet-ubd", outletName: "Ubud" },
      { id: "UBD-02", number: "UBD-02", cap: 4, status: "AVAILABLE", outletId: "outlet-ubd", outletName: "Ubud" },
    ],
  },
];

export const INITIAL_RESERVATIONS: ScheduledReservation[] = [];

export const INITIAL_SPACES: CoworkingSpaceItem[] = [
  {
    id: "sp-hot-1",
    name: "Hot Desk Flex #01 - #08",
    type: "HOT_DESK",
    area: "Ground Floor Main",
    capacity: 8,
    hourlyRate: 15000,
    dailyRate: 65000,
    status: "AVAILABLE",
    amenities: ["High-speed Fiber WiFi", "Power Outlet", "Free Flow Infused Water"],
    description: "Meja kerja komunal yang nyaman dengan akses power outlet individual, koneksi fiber internet 100 Mbps, dan free-flow infused water.",
    imageUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=600&auto=format&fit=crop",
  },
  {
    id: "sp-ded-1",
    name: "Dedicated Desk D-01",
    type: "DEDICATED_DESK",
    area: "Mezzanine Quiet Zone",
    capacity: 1,
    hourlyRate: 25000,
    dailyRate: 120000,
    monthlyRate: 1850000,
    status: "AVAILABLE",
    amenities: ["Ergonomic Herman Miller Chair", "Dual Monitor 27-inch", "Locker Pribadi", "Free 2 Jam Meeting Room"],
    description: "Meja kerja pribadi khusus dengan kursi ergonomis Herman Miller, dual-monitor 27 inch 4K, dan locker penyimpanan personal.",
    imageUrl: "https://images.unsplash.com/photo-1527192491265-7e15c55b1ed2?q=80&w=600&auto=format&fit=crop",
  },
  {
    id: "sp-ded-2",
    name: "Dedicated Desk D-02",
    type: "DEDICATED_DESK",
    area: "Mezzanine Quiet Zone",
    capacity: 1,
    hourlyRate: 25000,
    dailyRate: 120000,
    monthlyRate: 1850000,
    status: "AVAILABLE",
    amenities: ["Ergonomic Chair", "Locker", "Free Coffee 1 Cup/Day"],
    description: "Meja kerja tetap di Mezzanine Quiet Zone untuk kenyamanan konsentrasi penuh dengan free coffee 1 cup/hari.",
    imageUrl: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=600&auto=format&fit=crop",
  },
  {
    id: "sp-meet-1",
    name: "Executive Glass Meeting Room (Room Alpha)",
    type: "MEETING_ROOM",
    area: "VIP Meeting Wing",
    capacity: 10,
    hourlyRate: 150000,
    dailyRate: 900000,
    status: "AVAILABLE",
    amenities: ["4K Smart TV Screen Share", "Whiteboard", "Jabra Conference Mic", "Soundproof Acoustic Walls"],
    description: "Ruang meeting premium berkapasitas 10 orang dengan Smart TV 4K, conference mic Jabra, dan dinding peredam suara akustik.",
    imageUrl: "https://images.unsplash.com/photo-1517502884422-41eaead166d4?q=80&w=600&auto=format&fit=crop",
  },
  {
    id: "sp-pod-1",
    name: "Focus Audio Pod #01",
    type: "PRIVATE_POD",
    area: "Mezzanine Quiet Zone",
    capacity: 1,
    hourlyRate: 35000,
    dailyRate: 180000,
    status: "AVAILABLE",
    amenities: ["Soundproof 35dB", "Ring Light Zoom Video", "Ventilation Fan"],
    description: "Pod kedap suara individual untuk panggilan video, podcast, dan interview online tanpa gangguan kebisingan.",
    imageUrl: "https://images.unsplash.com/photo-1573164713988-8665fc963095?q=80&w=600&auto=format&fit=crop",
  },
];

export const INITIAL_MEMBERSHIPS: CoworkingMemberProfile[] = [
  {
    id: "cwm-1",
    memberId: "CWM-2026-001",
    name: "Sarah Jenkins",
    contact: "+62 819-5566-7788",
    email: "sarah.j@nomadtech.io",
    packageName: "Dedicated Nomad Monthly",
    startDate: "01 Sep 2026",
    expiryDate: "30 Sep 2026",
    status: "ACTIVE",
    totalSpent: 0,
    paymentHistory: [],
  },
  {
    id: "cwm-2",
    memberId: "CWM-2026-002",
    name: "Gede Arya Wijaya",
    contact: "+62 812-4455-6677",
    email: "gede.arya@architect.co",
    packageName: "Flex 10 Days Pass",
    startDate: "10 Agu 2026",
    expiryDate: "10 Sep 2026",
    status: "ACTIVE",
    totalSpent: 0,
    paymentHistory: [],
  },
  {
    id: "cwm-3",
    memberId: "CWM-2026-003",
    name: "Ibu Maya Santika",
    contact: "+62 815-6677-8899",
    email: "maya.santika@corp.id",
    packageName: "Executive Team Pass",
    startDate: "15 Agu 2026",
    expiryDate: "15 Okt 2026",
    status: "ACTIVE",
    totalSpent: 0,
    paymentHistory: [],
  },
];

export const INITIAL_CHECK_LOGS: CheckInOutLog[] = [];

export const INITIAL_LEASES: CommercialLease[] = [
  {
    id: "lse-001",
    leaseNumber: "LSE-DAGO-2026-001",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    tenantName: "Artisan Leather Goods & Studio",
    tenantContact: "+62 812-3344-5566",
    tenantEmail: "contact@artisanleather.id",
    unitCode: "Lot A-01 (Ground Floor Main)",
    areaSquareMeters: 45,
    monthlyRent: 8500000,
    totalContractValue: 102000000,
    depositAmount: 17000000,
    startDate: "01 Jan 2026",
    endDate: "31 Des 2026",
    paymentSchedule: "MONTHLY",
    status: "ACTIVE",
    notes: "Tenant retail kerajinan kulit lokal. Tagihan sewa diterbitkan setiap tanggal 1.",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    paymentHistory: [],
  },
  {
    id: "lse-002",
    leaseNumber: "LSE-DAGO-2026-002",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    tenantName: "Bali Organic Skincare Lab",
    tenantContact: "+62 818-7788-9900",
    tenantEmail: "info@baliorganic.co.id",
    unitCode: "Lot A-02 (Ground Floor)",
    areaSquareMeters: 35,
    monthlyRent: 6800000,
    totalContractValue: 81600000,
    depositAmount: 13600000,
    startDate: "01 Feb 2026",
    endDate: "31 Jan 2027",
    paymentSchedule: "MONTHLY",
    status: "ACTIVE",
    notes: "Tenant perawatan kulit organik. Wajib mematuhi standar kebersihan komersial.",
    createdAt: "2026-02-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    paymentHistory: [],
  },
  {
    id: "lse-003",
    leaseNumber: "LSE-DAGO-2026-003",
    outletId: "outlet-sgr",
    outletName: "Singaraja",
    tenantName: "Creative Sound & Podcast Studio",
    tenantContact: "+62 819-2233-1100",
    tenantEmail: "podcast@creativestudio.com",
    unitCode: "Lot B-04 (Lantai 2 Mezzanine)",
    areaSquareMeters: 28,
    monthlyRent: 4200000,
    totalContractValue: 50400000,
    depositAmount: 8400000,
    startDate: "01 Jul 2026",
    endDate: "30 Jun 2027",
    paymentSchedule: "MONTHLY",
    status: "ACTIVE",
    notes: "Ruang podcast kedap suara untuk konten kreator.",
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    paymentHistory: [],
  },
];

const TABLES_STAFF_ROLES: readonly RoleSlug[] = [
  "SUPER_ADMIN",
  "OWNER",
  "MANAGER",
  "CASHIER",
  "WAITER",
];

const COWORKING_STAFF_READ_ROLES: readonly RoleSlug[] = [
  "SUPER_ADMIN",
  "OWNER",
  "MANAGER",
  "CASHIER",
];

function isNonTenantOwner(auth: ServerAuthResult): boolean {
  return (
    auth.isAuthenticated &&
    auth.role === "OWNER" &&
    !auth.tenantId &&
    auth.scopeLevel !== "TENANT"
  );
}

function readRawStorageItem(key: string): string | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parseRawArrayVerbatim<T>(raw: string | null, fallback: T[]): T[] {
  if (raw === null) {
    return fallback;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

export function defaultTablesState(): TablesDomainState {
  return {
    areas: INITIAL_AREAS.map((area) => ({
      ...area,
      tables: area.tables.map((table) => ({ ...table })),
    })),
    reservations: INITIAL_RESERVATIONS.map((res) => ({ ...res })),
  };
}

export function applyTablesCommand(
  current: TablesDomainState,
  command: TablesCommand
): TablesDomainState {
  switch (command.op) {
    case "UPSERT_AREA": {
      const exists = current.areas.some((a) => a.id === command.area.id);
      const nextAreas = exists
        ? current.areas.map((a) =>
            a.id === command.area.id ? { ...a, ...command.area } : a
          )
        : [...current.areas, command.area];
      return {
        ...current,
        areas: nextAreas,
      };
    }

    case "DELETE_AREA": {
      return {
        ...current,
        areas: current.areas.filter((a) => a.id !== command.areaId),
      };
    }

    case "UPSERT_TABLE": {
      const matchesTargetTable = (t: TableItem) =>
        t.id === command.table.id ||
        (Boolean(command.previousTableId) && t.id === command.previousTableId);

      let existingArea: AreaItem | undefined;
      let existingTable: TableItem | undefined;
      for (const area of current.areas) {
        const found = area.tables.find(matchesTargetTable);
        if (found) {
          existingArea = area;
          existingTable = found;
          break;
        }
      }

      const targetOutletId =
        command.outletId ||
        command.table.outletId ||
        existingArea?.outletId ||
        "outlet-sgr";
      const targetOutletName =
        command.outletName ||
        command.table.outletName ||
        existingArea?.outletName ||
        "Singaraja";
      const requestedAreaName = (
        command.areaName ??
        command.table.area ??
        ""
      ).trim();

      let destinationArea: AreaItem | undefined;
      if (command.areaId) {
        destinationArea = current.areas.find((a) => a.id === command.areaId);
      }
      if (!destinationArea && requestedAreaName) {
        destinationArea = current.areas.find(
          (a) =>
            a.outletId === targetOutletId &&
            a.name.trim().toLowerCase() === requestedAreaName.toLowerCase()
        );
      }
      if (
        !destinationArea &&
        !command.areaId &&
        !requestedAreaName &&
        existingArea
      ) {
        destinationArea = existingArea;
      }

      let workingAreas = current.areas;
      if (!destinationArea) {
        const areaLabel = requestedAreaName || "Main Hall";
        const areaSlug =
          areaLabel
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") || "default";
        const createdArea: AreaItem = {
          id: command.areaId || `area-${targetOutletId}-${areaSlug}`,
          name: areaLabel,
          outletId: targetOutletId,
          outletName: targetOutletName,
          tables: [],
        };
        destinationArea = createdArea;
        workingAreas = [...current.areas, createdArea];
      }

      const targetDest = destinationArea;
      const mergedBase: TableItem = existingTable
        ? { ...existingTable, ...command.table }
        : { ...command.table };
      const isAvailableReset = mergedBase.status === "AVAILABLE";
      const normalizedTable: TableItem = {
        ...mergedBase,
        outletId: targetDest.outletId,
        outletName: targetDest.outletName,
        area: targetDest.name,
        customer: isAvailableReset ? undefined : mergedBase.customer,
        total: isAvailableReset ? undefined : mergedBase.total,
        currentBillTotal: isAvailableReset
          ? undefined
          : mergedBase.currentBillTotal,
        time: isAvailableReset ? undefined : mergedBase.time,
        itemsCount: isAvailableReset ? undefined : mergedBase.itemsCount,
        activeOrderId: isAvailableReset ? undefined : mergedBase.activeOrderId,
        paymentStatus: isAvailableReset ? undefined : mergedBase.paymentStatus,
      };

      const nextAreas = workingAreas.map((area) => {
        if (area.id === targetDest.id) {
          const hasMatchInDest = area.tables.some(matchesTargetTable);
          if (hasMatchInDest) {
            let replaced = false;
            const updatedTables: TableItem[] = [];
            for (const t of area.tables) {
              if (matchesTargetTable(t)) {
                if (!replaced) {
                  updatedTables.push(normalizedTable);
                  replaced = true;
                }
              } else {
                updatedTables.push(t);
              }
            }
            return { ...area, tables: updatedTables };
          }
          return { ...area, tables: [...area.tables, normalizedTable] };
        }
        if (area.tables.some(matchesTargetTable)) {
          return {
            ...area,
            tables: area.tables.filter((t) => !matchesTargetTable(t)),
          };
        }
        return area;
      });

      return {
        ...current,
        areas: nextAreas,
      };
    }

    case "DELETE_TABLE": {
      const hasExactId = current.areas.some((area) =>
        area.tables.some((t) => t.id === command.tableId)
      );
      const nextAreas = current.areas.map((area) => ({
        ...area,
        tables: area.tables.filter((t) =>
          hasExactId
            ? t.id !== command.tableId
            : t.id !== command.tableId && t.number !== command.tableId
        ),
      }));
      return {
        ...current,
        areas: nextAreas,
      };
    }

    case "PATCH_TABLE_STATUS": {
      let targetTableId: string | null = null;
      for (const area of current.areas) {
        const found = area.tables.find(
          (t) => t.id === command.tableId || t.number === command.tableId
        );
        if (found) {
          targetTableId = found.id;
          break;
        }
      }
      if (!targetTableId) {
        return current;
      }

      const isReset = command.status === "AVAILABLE";
      const nextAreas: AreaItem[] = current.areas.map((area) => ({
        ...area,
        tables: area.tables.map((table): TableItem => {
          if (table.id !== targetTableId) return table;
          if (isReset) {
            return {
              ...table,
              status: "AVAILABLE",
              customer: undefined,
              total: undefined,
              currentBillTotal: undefined,
              time: undefined,
              itemsCount: undefined,
              activeOrderId: undefined,
              paymentStatus: undefined,
            };
          }

          const computedBillTotal =
            command.currentBillTotal !== undefined
              ? command.currentBillTotal
              : command.total !== undefined
                ? command.total.startsWith("DP Masuk")
                  ? 0
                  : Number(command.total.replace(/\D/g, "")) || 0
                : table.currentBillTotal;

          return {
            ...table,
            status: command.status,
            customer:
              command.customer !== undefined
                ? command.customer
                : table.customer,
            total: command.total !== undefined ? command.total : table.total,
            currentBillTotal: computedBillTotal,
            time:
              command.time !== undefined
                ? command.time
                : command.status === "OCCUPIED"
                  ? "Baru saja"
                  : table.time,
            itemsCount:
              command.itemsCount !== undefined
                ? command.itemsCount
                : table.itemsCount,
            activeOrderId:
              command.activeOrderId !== undefined
                ? command.activeOrderId
                : table.activeOrderId,
            paymentStatus:
              command.paymentStatus !== undefined
                ? command.paymentStatus
                : table.paymentStatus,
          };
        }),
      }));

      return {
        ...current,
        areas: nextAreas,
      };
    }

    case "UPSERT_RESERVATION": {
      const exists = current.reservations.some(
        (r) => r.id === command.reservation.id
      );
      const nextReservations = exists
        ? current.reservations.map((r) =>
            r.id === command.reservation.id
              ? { ...r, ...command.reservation }
              : r
          )
        : [command.reservation, ...current.reservations];
      return {
        ...current,
        reservations: nextReservations,
      };
    }

    case "PATCH_RESERVATION_STATUS": {
      return {
        ...current,
        reservations: current.reservations.map((r) =>
          r.id === command.reservationId ? { ...r, status: command.status } : r
        ),
      };
    }

    case "RESET_TABLES": {
      return defaultTablesState();
    }

    default: {
      const _exhaustive: never = command;
      return _exhaustive;
    }
  }
}

export const tablesDomainSpec: ServerDomainSpec<"tables"> = {
  domain: "tables",
  filename: "tables_state.json",
  defaultState: defaultTablesState,
  authorizeRead() {
    return { allowed: true };
  },
  authorizeWrite(auth, command) {
    if (command.op === "RESET_TABLES") {
      if (!auth.isAuthenticated || !auth.role) {
        return {
          allowed: false,
          status: 401,
          error:
            auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan.",
        };
      }
      if (auth.role === "SUPER_ADMIN" || isNonTenantOwner(auth)) {
        return { allowed: true };
      }
      return {
        allowed: false,
        status: 403,
        error:
          "FORBIDDEN: Hanya Super Admin atau Hub Owner yang dapat mereset data meja.",
      };
    }

    if (!auth.isAuthenticated || !auth.role || auth.role === "CUSTOMER") {
      if (command.op === "PATCH_TABLE_STATUS" && command.paymentStatus === "PAID") {
        return {
          allowed: false,
          status: 403,
          error:
            "FORBIDDEN: Pelanggan tidak dapat menandai status pembayaran meja menjadi lunas.",
        };
      }
      if (
        command.op === "PATCH_TABLE_STATUS" &&
        (command.status === "OCCUPIED" || command.status === "AVAILABLE")
      ) {
        return { allowed: true };
      }
      if (!auth.isAuthenticated || !auth.role) {
        return {
          allowed: false,
          status: 401,
          error:
            auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan.",
        };
      }
      return {
        allowed: false,
        status: 403,
        error:
          "FORBIDDEN: Pelanggan hanya dapat memperbarui status meja untuk pesanan mandiri.",
      };
    }

    if (TABLES_STAFF_ROLES.includes(auth.role)) {
      return { allowed: true };
    }

    return {
      allowed: false,
      status: 403,
      error: `FORBIDDEN: Role [${auth.role}] tidak memiliki izin mengubah data meja.`,
    };
  },
  applyCommand(current, command) {
    return applyTablesCommand(current, command);
  },
};

function createTablesStorageMirror(): LocalStorageMirrorAdapter<TablesDomainState> {
  let cachedSig: string | undefined;
  let cachedState: TablesDomainState | null = null;

  return {
    keys: [STORAGE_KEY_TABLES_AREAS, STORAGE_KEY_TABLES_RESERVATIONS],
    readFromStorage(fallback) {
      const rawAreas = readRawStorageItem(STORAGE_KEY_TABLES_AREAS);
      const rawRes = readRawStorageItem(STORAGE_KEY_TABLES_RESERVATIONS);
      const sig = `${rawAreas ?? "\u0001"}\u0000${rawRes ?? "\u0001"}`;
      if (cachedState !== null && sig === cachedSig) {
        return cachedState;
      }
      cachedSig = sig;
      cachedState = {
        areas: parseRawArrayVerbatim<AreaItem>(rawAreas, fallback.areas),
        reservations: parseRawArrayVerbatim<ScheduledReservation>(
          rawRes,
          fallback.reservations
        ),
      };
      return cachedState;
    },
    writeToStorage(state) {
      if (typeof window === "undefined" || !window.localStorage) return;
      try {
        const rawAreas = JSON.stringify(state.areas);
        const rawRes = JSON.stringify(state.reservations);
        window.localStorage.setItem(STORAGE_KEY_TABLES_AREAS, rawAreas);
        window.localStorage.setItem(STORAGE_KEY_TABLES_RESERVATIONS, rawRes);
        cachedSig = `${rawAreas}\u0000${rawRes}`;
        cachedState = state;
      } catch {}
    },
  };
}

const tablesStorageMirror = createTablesStorageMirror();

export const tablesSyncClient: SyncedDomainClient<"tables"> =
  createSyncedDomainClient({
    domain: "tables",
    defaultState: defaultTablesState,
    storageMirror: tablesStorageMirror,
    applyCommandLocally: applyTablesCommand,
  });

export function defaultCoworkingMasterState(): CoworkingMasterState {
  return {
    spaces: INITIAL_SPACES.map((space) => ({
      ...space,
      amenities: [...space.amenities],
      currentSession: space.currentSession
        ? { ...space.currentSession }
        : undefined,
    })),
    members: INITIAL_MEMBERSHIPS.map((member) => ({
      ...member,
      paymentHistory: member.paymentHistory.map((p) => ({ ...p })),
    })),
    checkLogs: INITIAL_CHECK_LOGS.map((log) => ({ ...log })),
    plans: MEMBERSHIP_PLANS.map((plan) => ({
      ...plan,
      amenities: [...plan.amenities],
    })),
  };
}

export function applyCoworkingMasterCommand(
  current: CoworkingMasterState,
  command: CoworkingMasterCommand
): CoworkingMasterState {
  switch (command.op) {
    case "UPSERT_SPACE": {
      const exists = current.spaces.some((s) => s.id === command.space.id);
      const nextSpaces = exists
        ? current.spaces.map((s) =>
            s.id === command.space.id ? { ...s, ...command.space } : s
          )
        : [command.space, ...current.spaces];
      return {
        ...current,
        spaces: nextSpaces,
      };
    }

    case "DELETE_SPACE": {
      return {
        ...current,
        spaces: current.spaces.filter((s) => s.id !== command.spaceId),
      };
    }

    case "PATCH_SPACE_SESSION": {
      const nextSpaces = current.spaces.map((space) => {
        if (space.id !== command.spaceId) return space;
        return {
          ...space,
          status: command.status,
          currentSession:
            command.status === "AVAILABLE" ? undefined : command.currentSession,
        };
      });

      let nextLogs = current.checkLogs;
      if (command.completedBookingCode) {
        nextLogs = nextLogs.map((log) =>
          log.bookingCode === command.completedBookingCode &&
          log.status === "ACTIVE_IN"
            ? {
                ...log,
                checkoutDate: command.checkoutDate ?? log.checkoutDate,
                checkoutTime: command.checkoutTime ?? log.checkoutTime,
                checkoutBy: command.checkoutBy ?? log.checkoutBy,
                durationFormatted: "Selesai (Check-out Berhasil)",
                status: "COMPLETED",
              }
            : log
        );
      }

      if (command.checkLog) {
        const incomingLog = command.checkLog;
        const existingLogIndex = nextLogs.findIndex(
          (log) =>
            log.id === incomingLog.id ||
            (incomingLog.status === "ACTIVE_IN" &&
              log.bookingCode === incomingLog.bookingCode &&
              log.status === "ACTIVE_IN")
        );
        if (existingLogIndex >= 0) {
          nextLogs = nextLogs.map((log, idx) =>
            idx === existingLogIndex ? { ...log, ...incomingLog } : log
          );
        } else {
          nextLogs = [incomingLog, ...nextLogs].slice(
            0,
            MAX_COWORKING_CHECK_LOGS
          );
        }
      }

      return {
        ...current,
        spaces: nextSpaces,
        checkLogs: nextLogs,
      };
    }

    case "UPSERT_MEMBER": {
      const exists = current.members.some(
        (m) =>
          m.id === command.member.id || m.memberId === command.member.memberId
      );
      const nextMembers = exists
        ? current.members.map((m) =>
            m.id === command.member.id || m.memberId === command.member.memberId
              ? { ...m, ...command.member }
              : m
          )
        : [command.member, ...current.members];
      return {
        ...current,
        members: nextMembers,
      };
    }

    case "UPSERT_PLAN": {
      const exists = current.plans.some((p) => p.id === command.plan.id);
      const nextPlans = exists
        ? current.plans.map((p) =>
            p.id === command.plan.id ? { ...p, ...command.plan } : p
          )
        : [...current.plans, command.plan];
      return {
        ...current,
        plans: nextPlans,
      };
    }

    case "DELETE_PLAN": {
      return {
        ...current,
        plans: current.plans.filter((p) => p.id !== command.planId),
      };
    }

    case "RESET_COWORKING_MASTER": {
      return defaultCoworkingMasterState();
    }

    default: {
      const _exhaustive: never = command;
      return _exhaustive;
    }
  }
}

export const coworkingMasterDomainSpec: ServerDomainSpec<"coworking-master"> = {
  domain: "coworking-master",
  filename: "coworking_master.json",
  defaultState: defaultCoworkingMasterState,
  authorizeRead(auth) {
    if (
      auth.isAuthenticated &&
      auth.role &&
      COWORKING_STAFF_READ_ROLES.includes(auth.role)
    ) {
      return { allowed: true };
    }
    return {
      allowed: true,
      transform: (state) => ({
        ...state,
        members: [],
        checkLogs: [],
      }),
    };
  },
  authorizeWrite(auth, command) {
    if (!auth.isAuthenticated || !auth.role) {
      return {
        allowed: false,
        status: 401,
        error:
          auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan.",
      };
    }

    if (
      auth.role === "SUPER_ADMIN" ||
      isNonTenantOwner(auth) ||
      auth.role === "MANAGER" ||
      auth.role === "CASHIER"
    ) {
      return { allowed: true };
    }

    if (auth.role === "CUSTOMER" && command.op === "PATCH_SPACE_SESSION") {
      if (
        (command.status === "RESERVED" || command.status === "AVAILABLE") &&
        !command.checkLog
      ) {
        return { allowed: true };
      }
      return {
        allowed: false,
        status: 403,
        error:
          "FORBIDDEN: Pelanggan tidak dapat melakukan check-in atau mencatat log sesi ruang.",
      };
    }

    return {
      allowed: false,
      status: 403,
      error: `FORBIDDEN: Role [${auth.role}] tidak memiliki izin mengubah data master co-working.`,
    };
  },
  applyCommand(current, command) {
    return applyCoworkingMasterCommand(current, command);
  },
};

function createCoworkingMasterStorageMirror(): LocalStorageMirrorAdapter<CoworkingMasterState> {
  let cachedSig: string | undefined;
  let cachedState: CoworkingMasterState | null = null;

  return {
    keys: [
      STORAGE_KEY_CWK_SPACES,
      STORAGE_KEY_CWK_MEMBERS,
      STORAGE_KEY_CWK_LOGS,
      STORAGE_KEY_CWK_PLANS,
    ],
    readFromStorage(fallback) {
      const rawSpaces = readRawStorageItem(STORAGE_KEY_CWK_SPACES);
      const rawMembers = readRawStorageItem(STORAGE_KEY_CWK_MEMBERS);
      const rawLogs = readRawStorageItem(STORAGE_KEY_CWK_LOGS);
      const rawPlans = readRawStorageItem(STORAGE_KEY_CWK_PLANS);
      const sig = `${rawSpaces ?? "\u0001"}\u0000${rawMembers ?? "\u0001"}\u0000${rawLogs ?? "\u0001"}\u0000${rawPlans ?? "\u0001"}`;
      if (cachedState !== null && sig === cachedSig) {
        return cachedState;
      }
      cachedSig = sig;
      cachedState = {
        spaces: parseRawArrayVerbatim<CoworkingSpaceItem>(
          rawSpaces,
          fallback.spaces
        ),
        members: parseRawArrayVerbatim<CoworkingMemberProfile>(
          rawMembers,
          fallback.members
        ),
        checkLogs: parseRawArrayVerbatim<CheckInOutLog>(
          rawLogs,
          fallback.checkLogs
        ),
        plans: parseRawArrayVerbatim<CoworkingMembershipPlan>(
          rawPlans,
          fallback.plans
        ),
      };
      return cachedState;
    },
    writeToStorage(state) {
      if (typeof window === "undefined" || !window.localStorage) return;
      try {
        const rawSpaces = JSON.stringify(state.spaces);
        const rawMembers = JSON.stringify(state.members);
        const rawLogs = JSON.stringify(state.checkLogs);
        const rawPlans = JSON.stringify(state.plans);
        window.localStorage.setItem(STORAGE_KEY_CWK_SPACES, rawSpaces);
        window.localStorage.setItem(STORAGE_KEY_CWK_MEMBERS, rawMembers);
        window.localStorage.setItem(STORAGE_KEY_CWK_LOGS, rawLogs);
        window.localStorage.setItem(STORAGE_KEY_CWK_PLANS, rawPlans);
        cachedSig = `${rawSpaces}\u0000${rawMembers}\u0000${rawLogs}\u0000${rawPlans}`;
        cachedState = state;
      } catch {}
    },
  };
}

const coworkingMasterStorageMirror = createCoworkingMasterStorageMirror();

export const coworkingMasterSyncClient: SyncedDomainClient<"coworking-master"> =
  createSyncedDomainClient({
    domain: "coworking-master",
    defaultState: defaultCoworkingMasterState,
    storageMirror: coworkingMasterStorageMirror,
    applyCommandLocally: applyCoworkingMasterCommand,
  });

export function defaultCommercialState(): CommercialDomainState {
  return {
    leases: INITIAL_LEASES.map((lease) => ({
      ...lease,
      paymentHistory: lease.paymentHistory.map((p) => ({ ...p })),
    })),
  };
}

export function applyCommercialCommand(
  current: CommercialDomainState,
  command: CommercialCommand
): CommercialDomainState {
  switch (command.op) {
    case "UPSERT_LEASE": {
      const exists = current.leases.some((l) => l.id === command.lease.id);
      const nextLeases = exists
        ? current.leases.map((l) =>
            l.id === command.lease.id ? { ...l, ...command.lease } : l
          )
        : [command.lease, ...current.leases];
      return {
        ...current,
        leases: nextLeases,
      };
    }

    case "PATCH_LEASE_STATUS": {
      return {
        ...current,
        leases: current.leases.map((l) =>
          l.id === command.leaseId
            ? { ...l, status: command.status, updatedAt: command.updatedAt }
            : l
        ),
      };
    }

    case "RECORD_LEASE_PAYMENT": {
      return {
        ...current,
        leases: current.leases.map((l) => {
          if (l.id !== command.leaseId) return l;
          const alreadyExists = l.paymentHistory.some(
            (p) => p.id === command.payment.id
          );
          const nextHistory = alreadyExists
            ? l.paymentHistory.map((p) =>
                p.id === command.payment.id ? command.payment : p
              )
            : [command.payment, ...l.paymentHistory];
          return {
            ...l,
            paymentHistory: nextHistory,
            updatedAt: command.updatedAt,
          };
        }),
      };
    }

    case "RESET_COMMERCIAL": {
      return defaultCommercialState();
    }

    default: {
      const _exhaustive: never = command;
      return _exhaustive;
    }
  }
}

function authorizeCommercialAccess(
  auth: ServerAuthResult
): { allowed: true } | { allowed: false; status: 401 | 403; error: string } {
  if (!auth.isAuthenticated || !auth.role) {
    return {
      allowed: false,
      status: 401,
      error:
        auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan.",
    };
  }
  if (
    auth.role === "SUPER_ADMIN" ||
    isNonTenantOwner(auth) ||
    auth.role === "MANAGER"
  ) {
    return { allowed: true };
  }
  return {
    allowed: false,
    status: 403,
    error: `FORBIDDEN: Role [${auth.role}] tidak memiliki akses kontrak sewa komersial.`,
  };
}

export const commercialDomainSpec: ServerDomainSpec<"commercial"> = {
  domain: "commercial",
  filename: "commercial_leases.json",
  defaultState: defaultCommercialState,
  authorizeRead(auth) {
    return authorizeCommercialAccess(auth);
  },
  authorizeWrite(auth) {
    return authorizeCommercialAccess(auth);
  },
  applyCommand(current, command) {
    return applyCommercialCommand(current, command);
  },
};

function createCommercialStorageMirror(): LocalStorageMirrorAdapter<CommercialDomainState> {
  let cachedSig: string | undefined;
  let cachedState: CommercialDomainState | null = null;

  return {
    keys: [STORAGE_KEY_COMMERCIAL],
    readFromStorage(fallback) {
      const rawLeases = readRawStorageItem(STORAGE_KEY_COMMERCIAL);
      const sig = rawLeases ?? "\u0001";
      if (cachedState !== null && sig === cachedSig) {
        return cachedState;
      }
      cachedSig = sig;
      cachedState = {
        leases: parseRawArrayVerbatim<CommercialLease>(
          rawLeases,
          fallback.leases
        ),
      };
      return cachedState;
    },
    writeToStorage(state) {
      if (typeof window === "undefined" || !window.localStorage) return;
      try {
        const rawLeases = JSON.stringify(state.leases);
        window.localStorage.setItem(STORAGE_KEY_COMMERCIAL, rawLeases);
        cachedSig = rawLeases;
        cachedState = state;
      } catch {}
    },
  };
}

const commercialStorageMirror = createCommercialStorageMirror();

export const commercialSyncClient: SyncedDomainClient<"commercial"> =
  createSyncedDomainClient({
    domain: "commercial",
    defaultState: defaultCommercialState,
    storageMirror: commercialStorageMirror,
    applyCommandLocally: applyCommercialCommand,
  });
