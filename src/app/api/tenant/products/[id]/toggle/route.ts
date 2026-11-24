import { NextRequest, NextResponse } from "next/server";
import { getRequestAuthUser } from "@/lib/server-auth";
import type { RoleSlug } from "@/types/auth";

const ALLOWED_ROLES: RoleSlug[] = ["SUPER_ADMIN", "OWNER", "MANAGER"];

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role) {
      return NextResponse.json(
        { error: auth.error || "UNAUTHORIZED: Autentikasi sesi diperlukan." },
        { status: 401 }
      );
    }

    if (!ALLOWED_ROLES.includes(auth.role)) {
      return NextResponse.json(
        { error: `FORBIDDEN: Role [${auth.role}] tidak memiliki wewenang mengubah ketersediaan produk tenant.` },
        { status: 403 }
      );
    }

    const { id } = params;
    const body = await req.json();
    const { isAvailable, tenantId } = body;

    // Simulation / Database update response
    return NextResponse.json({
      success: true,
      productId: id,
      tenantId: tenantId || null,
      isAvailable: Boolean(isAvailable),
      updatedAt: new Date().toISOString(),
      message: `Status ketersediaan produk ${id} berhasil diperbarui menjadi ${
        isAvailable ? "Tersedia" : "Habis"
      }.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Gagal memperbarui ketersediaan stok", details: error.message },
      { status: 500 }
    );
  }
}
