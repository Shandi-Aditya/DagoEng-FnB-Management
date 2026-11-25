import { NextRequest, NextResponse } from "next/server";
import { getRequestAuthUser, isHubAdminOrManager } from "@/lib/server-auth";
import {
  mutatePersistentData,
  readSeededPersistentData,
} from "@/lib/persistent-storage";
import { DEMO_OUTLETS, type OutletItem } from "@/lib/receipt-publisher";

export const dynamic = "force-dynamic";

const OUTLETS_STORAGE_FILE = "outlets.json";

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
    if (!isHubAdminOrManager(auth)) {
      return NextResponse.json(
        {
          success: false,
          error: "FORBIDDEN: Hanya Super Admin, Hub Owner, atau Hub Manager yang dapat menambah outlet.",
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
      badgeLabel: status === "ACTIVE" ? "● Beroperasi Aktif" : status === "COMING_SOON" ? "Segera hadir" : "Nonaktif",
      isComingSoon: status === "COMING_SOON",
    };

    const outlets = await mutatePersistentData<OutletItem[]>(
      OUTLETS_STORAGE_FILE,
      DEMO_OUTLETS,
      (existing) => [...existing, newOutlet]
    );

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
    if (!isHubAdminOrManager(auth)) {
      return NextResponse.json(
        {
          success: false,
          error: "FORBIDDEN: Hanya Super Admin, Hub Owner, atau Hub Manager yang dapat memperbarui outlet.",
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
        const nextStatus: OutletItem["status"] =
          body?.status === "ACTIVE" || body?.status === "COMING_SOON" || body?.status === "INACTIVE"
            ? body.status
            : prev.status;
        const updated: OutletItem = {
          ...prev,
          name: typeof body?.name === "string" && body.name.trim() ? body.name.trim() : prev.name,
          code: typeof body?.code === "string" && body.code.trim() ? body.code.trim().toUpperCase() : prev.code,
          address: typeof body?.address === "string" && body.address.trim() ? body.address.trim() : prev.address,
          phone: typeof body?.phone === "string" ? body.phone.trim() : prev.phone,
          status: nextStatus,
          isComingSoon: nextStatus === "COMING_SOON",
          badgeLabel:
            nextStatus === "ACTIVE"
              ? "● Beroperasi Aktif"
              : nextStatus === "COMING_SOON"
                ? "Segera hadir (ekspansi)"
                : "Nonaktif",
        };
        return existing.map((o, i) => (i === idx ? updated : o));
      }
    );

    if (!found) {
      return NextResponse.json({ success: false, error: "Outlet tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ success: true, outlets });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memperbarui outlet.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
