import { NextRequest, NextResponse } from "next/server";
import { getRequestAuthUser } from "@/lib/server-auth";
import { getPersistentProductsData } from "@/lib/persistent-storage";
import { normalizeTenantId } from "@/lib/tax-breakdown";
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
    const rawBody: unknown = await req.json().catch(() => ({}));
    const body =
      rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
        ? (rawBody as Record<string, unknown>)
        : {};
    const isAvailable = body.isAvailable;
    const rawTenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : undefined;

    if (auth.scopeLevel === "TENANT") {
      const authTenant = normalizeTenantId(auth.tenantId);
      const bodyTenant = normalizeTenantId(rawTenantId);
      if (!authTenant || !bodyTenant || bodyTenant !== authTenant) {
        return NextResponse.json(
          {
            error:
              "FORBIDDEN: Mitra wajib menyertakan tenantId yang sesuai dan tidak diizinkan mengubah produk milik mitra lain.",
          },
          { status: 403 }
        );
      }

      const { products } = await getPersistentProductsData();
      const targetProduct = products.find((p) => p.id === id);
      if (targetProduct) {
        const productTenant = normalizeTenantId(targetProduct.tenantId);
        if (!productTenant || productTenant !== authTenant) {
          return NextResponse.json(
            {
              error:
                "FORBIDDEN: Mitra tidak diizinkan mengubah ketersediaan produk milik mitra lain.",
            },
            { status: 403 }
          );
        }
      }
    }

    // Simulation / Database update response
    return NextResponse.json({
      success: true,
      productId: id,
      tenantId: rawTenantId || null,
      isAvailable: Boolean(isAvailable),
      updatedAt: new Date().toISOString(),
      message: `Status ketersediaan produk ${id} berhasil diperbarui menjadi ${
        isAvailable ? "Tersedia" : "Habis"
      }.`,
    });
  } catch (error: unknown) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Gagal memperbarui ketersediaan stok", details },
      { status: 500 }
    );
  }
}
