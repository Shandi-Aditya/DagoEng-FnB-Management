import { NextRequest, NextResponse } from "next/server";
import { getRequestAuthUser, isSuperAdminOrOrgOwner } from "@/lib/server-auth";
import {
  appendAuditLog,
  mutatePersistentData,
  readSeededPersistentData,
} from "@/lib/persistent-storage";
import { DEMO_OUTLETS, type OutletItem } from "@/lib/receipt-publisher";

export const dynamic = "force-dynamic";

const OUTLETS_STORAGE_FILE = "outlets.json";
const DEFAULT_OUTLET_ID = "outlet-sgr";

function buildOutletBadgeLabel(status: OutletItem["status"]): string {
  if (status === "ACTIVE") return "● Beroperasi Aktif";
  if (status === "COMING_SOON") return "Segera hadir (ekspansi)";
  return "Nonaktif";
}

export async function GET() {
  try {
    const outlets = await readSeededPersistentData<OutletItem[]>(
      OUTLETS_STORAGE_FILE,
      () => DEMO_OUTLETS
    );
    return NextResponse.json({ success: true, outlets });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat daftar outlet.";
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
    if (!isSuperAdminOrOrgOwner(auth)) {
      return NextResponse.json(
        {
          success: false,
          error: "FORBIDDEN: Hanya Super Admin atau Hub Owner yang dapat menambah outlet.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
    const address = typeof body?.address === "string" ? body.address.trim() : "";
    const phone = typeof body?.phone === "string" ? body.phone.trim() : undefined;
    const status: OutletItem["status"] =
      body?.status === "COMING_SOON" || body?.status === "INACTIVE" ? body.status : "ACTIVE";

    if (!name || !code || !address) {
      return NextResponse.json(
        { success: false, error: "Nama, kode, dan alamat outlet wajib diisi." },
        { status: 400 }
      );
    }

    const newOutlet: OutletItem = {
      id: `outlet-${code.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`,
      name,
      code,
      address,
      phone,
      status,
      badgeLabel: buildOutletBadgeLabel(status),
      isComingSoon: status === "COMING_SOON",
    };

    let duplicateCode = false;
    const outlets = await mutatePersistentData<OutletItem[]>(
      OUTLETS_STORAGE_FILE,
      DEMO_OUTLETS,
      (existing) => {
        if (existing.some((o) => o.code.trim().toLowerCase() === code.toLowerCase())) {
          duplicateCode = true;
          return existing;
        }
        return [...existing, newOutlet];
      }
    );

    if (duplicateCode) {
      return NextResponse.json(
        { success: false, error: `Kode outlet [${code}] sudah digunakan.` },
        { status: 409 }
      );
    }

    const actorName = auth.name || auth.email || "Administrator";
    await appendAuditLog({
      id: `audit-outlet-create-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      actorId: auth.userId || undefined,
      actorName,
      actorRole: auth.role,
      role: auth.role,
      userId: auth.userId || undefined,
      userName: actorName,
      userRole: auth.role,
      module: "SETTINGS",
      action: "OUTLET_CREATED",
      recordId: newOutlet.id,
      referenceId: newOutlet.code,
      newValue: `${newOutlet.name} (${newOutlet.code}) [${newOutlet.status}]`,
      description: `Menambahkan outlet baru ${newOutlet.name} (${newOutlet.code}).`,
      status: "SUCCESS",
      severity: "INFO",
      category: "CONFIGURATION",
    });

    return NextResponse.json({ success: true, outlet: newOutlet, outlets });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menambahkan outlet.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role) {
      return NextResponse.json(
        { success: false, error: auth.error || "UNAUTHORIZED: Autentikasi sesi diperlukan." },
        { status: 401 }
      );
    }
    if (!isSuperAdminOrOrgOwner(auth)) {
      return NextResponse.json(
        {
          success: false,
          error: "FORBIDDEN: Hanya Super Admin atau Hub Owner yang dapat memperbarui outlet.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ success: false, error: "ID outlet wajib diisi." }, { status: 400 });
    }

    let found = false;
    let duplicateCode: string | null = null;
    let prevOutlet: OutletItem | undefined;
    let updatedOutlet: OutletItem | undefined;

    const outlets = await mutatePersistentData<OutletItem[]>(
      OUTLETS_STORAGE_FILE,
      DEMO_OUTLETS,
      (existing) => {
        const idx = existing.findIndex((o) => o.id === id);
        if (idx === -1) {
          return existing;
        }
        found = true;
        const prev = existing[idx];
        prevOutlet = prev;
        const nextCode =
          typeof body?.code === "string" && body.code.trim()
            ? body.code.trim().toUpperCase()
            : prev.code;

        if (
          existing.some(
            (o) => o.id !== id && o.code.trim().toLowerCase() === nextCode.toLowerCase()
          )
        ) {
          duplicateCode = nextCode;
          return existing;
        }

        const nextStatus: OutletItem["status"] =
          body?.status === "ACTIVE" || body?.status === "COMING_SOON" || body?.status === "INACTIVE"
            ? body.status
            : prev.status;
        const updated: OutletItem = {
          ...prev,
          name: typeof body?.name === "string" && body.name.trim() ? body.name.trim() : prev.name,
          code: nextCode,
          address:
            typeof body?.address === "string" && body.address.trim()
              ? body.address.trim()
              : prev.address,
          phone: typeof body?.phone === "string" ? body.phone.trim() : prev.phone,
          status: nextStatus,
          isComingSoon: nextStatus === "COMING_SOON",
          badgeLabel: buildOutletBadgeLabel(nextStatus),
        };
        updatedOutlet = updated;
        return existing.map((o, i) => (i === idx ? updated : o));
      }
    );

    if (!found) {
      return NextResponse.json({ success: false, error: "Outlet tidak ditemukan." }, { status: 404 });
    }

    if (duplicateCode) {
      return NextResponse.json(
        { success: false, error: `Kode outlet [${duplicateCode}] sudah digunakan.` },
        { status: 409 }
      );
    }

    if (prevOutlet && updatedOutlet) {
      const actorName = auth.name || auth.email || "Administrator";
      await appendAuditLog({
        id: `audit-outlet-update-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        actorId: auth.userId || undefined,
        actorName,
        actorRole: auth.role,
        role: auth.role,
        userId: auth.userId || undefined,
        userName: actorName,
        userRole: auth.role,
        module: "SETTINGS",
        action: "OUTLET_UPDATED",
        recordId: updatedOutlet.id,
        referenceId: updatedOutlet.code,
        previousValue: `${prevOutlet.name} (${prevOutlet.code}) [${prevOutlet.status}]`,
        newValue: `${updatedOutlet.name} (${updatedOutlet.code}) [${updatedOutlet.status}]`,
        description: `Memperbarui outlet ${updatedOutlet.name} (${updatedOutlet.code}).`,
        status: "SUCCESS",
        severity: "INFO",
        category: "CONFIGURATION",
      });
    }

    return NextResponse.json({ success: true, outlet: updatedOutlet, outlets });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memperbarui outlet.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role) {
      return NextResponse.json(
        { success: false, error: auth.error || "UNAUTHORIZED: Autentikasi sesi diperlukan." },
        { status: 401 }
      );
    }
    if (!isSuperAdminOrOrgOwner(auth)) {
      return NextResponse.json(
        {
          success: false,
          error: "FORBIDDEN: Hanya Super Admin atau Hub Owner yang dapat menghapus outlet.",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const id =
      searchParams.get("id")?.trim() ||
      (typeof body?.id === "string" ? body.id.trim() : "");

    if (!id) {
      return NextResponse.json({ success: false, error: "ID outlet wajib diisi." }, { status: 400 });
    }

    if (id === DEFAULT_OUTLET_ID) {
      return NextResponse.json(
        { success: false, error: "Outlet utama tidak dapat dihapus." },
        { status: 400 }
      );
    }

    let removedOutlet: OutletItem | undefined;
    let lastActiveBlocked = false;

    const outlets = await mutatePersistentData<OutletItem[]>(
      OUTLETS_STORAGE_FILE,
      DEMO_OUTLETS,
      (existing) => {
        const target = existing.find((o) => o.id === id);
        if (!target) {
          return existing;
        }
        const remainingActive = existing.filter(
          (o) => o.id !== id && o.status === "ACTIVE"
        );
        if (target.status === "ACTIVE" && remainingActive.length === 0) {
          lastActiveBlocked = true;
          return existing;
        }
        removedOutlet = target;
        return existing.filter((o) => o.id !== id);
      }
    );

    if (lastActiveBlocked) {
      return NextResponse.json(
        { success: false, error: "Minimal satu outlet aktif harus dipertahankan." },
        { status: 400 }
      );
    }

    if (!removedOutlet) {
      return NextResponse.json({ success: false, error: "Outlet tidak ditemukan." }, { status: 404 });
    }

    const actorName = auth.name || auth.email || "Administrator";
    await appendAuditLog({
      id: `audit-outlet-delete-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      actorId: auth.userId || undefined,
      actorName,
      actorRole: auth.role,
      role: auth.role,
      userId: auth.userId || undefined,
      userName: actorName,
      userRole: auth.role,
      module: "SETTINGS",
      action: "OUTLET_DELETED",
      recordId: removedOutlet.id,
      referenceId: removedOutlet.code,
      previousValue: `${removedOutlet.name} (${removedOutlet.code}) [${removedOutlet.status}]`,
      description: `Menghapus outlet non-utama ${removedOutlet.name} (${removedOutlet.code}).`,
      status: "WARNING",
      severity: "MEDIUM",
      category: "CONFIGURATION",
    });

    return NextResponse.json({ success: true, deletedId: id, outlets });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menghapus outlet.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
