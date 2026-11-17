import { NextRequest, NextResponse } from "next/server";
import {
  getPersistentProductsData,
  savePersistentProduct,
  deletePersistentProduct,
  savePersistentCustomCategory,
  appendAuditLog,
} from "@/lib/persistent-storage";
import { getRequestAuthUser, ServerAuthResult } from "@/lib/server-auth";
import { normalizeTenantId } from "@/features/orders/orders-domain";
import { RoleSlug } from "@/types/auth";
import { MasterProduct } from "@/types/product";

export const dynamic = "force-dynamic";

const PRODUCT_WRITE_ROLES: RoleSlug[] = ["SUPER_ADMIN", "OWNER", "MANAGER"];

async function authorizeProductWrite(
  req: NextRequest
): Promise<
  | { authorized: true; auth: ServerAuthResult }
  | { authorized: false; response: NextResponse }
> {
  const auth = await getRequestAuthUser(req);
  if (!auth.isAuthenticated || !auth.role || !auth.userId) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          success: false,
          error: auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan.",
        },
        { status: 401 }
      ),
    };
  }
  if (!PRODUCT_WRITE_ROLES.includes(auth.role)) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          success: false,
          error: `FORBIDDEN: Role [${auth.role}] tidak diizinkan mengubah master produk.`,
        },
        { status: 403 }
      ),
    };
  }
  return { authorized: true, auth };
}

function assertTenantOwnsProduct(
  auth: ServerAuthResult,
  productTenantId?: string | null
): NextResponse | null {
  if (auth.scopeLevel !== "TENANT" || !auth.tenantId) return null;
  const authTenant = normalizeTenantId(auth.tenantId);
  const targetTenant = normalizeTenantId(productTenantId);
  if (!targetTenant || targetTenant !== authTenant) {
    return NextResponse.json(
      {
        success: false,
        error: "FORBIDDEN: Mitra tidak diizinkan mengubah produk milik mitra lain.",
      },
      { status: 403 }
    );
  }
  return null;
}

/**
 * GET /api/products
 * Fetches master products and custom categories from persistent server storage.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get("outletId");
    const category = searchParams.get("category");
    const tenantId = searchParams.get("tenantId");
    const status = searchParams.get("status");

    const data = await getPersistentProductsData();
    let products = data.products || [];

    if (outletId && outletId !== "ALL") {
      products = products.filter((p) => p.outletId === outletId || p.outletId === "ALL");
    }
    if (category) {
      products = products.filter((p) => p.category === category);
    }
    if (tenantId) {
      products = products.filter((p) => p.tenantId === tenantId);
    }
    if (status) {
      products = products.filter((p) => p.status === status);
    }

    return NextResponse.json({
      success: true,
      products,
      customCategories: data.customCategories || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengambil data produk." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/products
 * Creates or updates a master product, or registers a new custom category.
 */
export async function POST(req: NextRequest) {
  try {
    const authCheck = await authorizeProductWrite(req);
    if (!authCheck.authorized) return authCheck.response;
    const { auth } = authCheck;

    const body = await req.json().catch(() => ({}));

    if (body.action === "ADD_CATEGORY" || body.newCategory) {
      const categoryName = body.categoryName || body.newCategory;
      if (!categoryName || typeof categoryName !== "string" || !categoryName.trim()) {
        return NextResponse.json(
          { success: false, error: "Nama kategori wajib diisi." },
          { status: 400 }
        );
      }
      const updatedCategories = await savePersistentCustomCategory(categoryName.trim());
      return NextResponse.json({
        success: true,
        customCategories: updatedCategories,
      });
    }

    const productData = body.product || body;
    if (!productData || !productData.name || typeof productData.basePrice !== "number") {
      return NextResponse.json(
        { success: false, error: "Nama produk dan harga dasar wajib diisi." },
        { status: 400 }
      );
    }

    const scopedTenant =
      auth.scopeLevel === "TENANT" && auth.tenantId
        ? normalizeTenantId(auth.tenantId)
        : undefined;
    if (scopedTenant && productData.tenantId) {
      const tenantError = assertTenantOwnsProduct(auth, productData.tenantId);
      if (tenantError) return tenantError;
    }

    const existingData = await getPersistentProductsData();
    const existingTarget = productData.id
      ? existingData.products.find((p) => p.id === productData.id)
      : undefined;
    if (existingTarget && scopedTenant) {
      const tenantError = assertTenantOwnsProduct(auth, existingTarget.tenantId);
      if (tenantError) return tenantError;
    }

    const nowIso = new Date().toISOString();
    const margin =
      productData.basePrice > 0
        ? `${Math.round(
            ((productData.basePrice - (productData.cogsEstimate || 0)) / productData.basePrice) * 1000
          ) / 10}%`
        : "0.0%";

    const product: MasterProduct = {
      id: productData.id || `prod-${Date.now()}`,
      name: productData.name.trim(),
      category: productData.category || "Lainnya",
      basePrice: Number(productData.basePrice),
      cogsEstimate: Number(productData.cogsEstimate || 0),
      grossMarginPercent: productData.grossMarginPercent || margin,
      status: productData.status || "ACTIVE",
      outletId: productData.outletId || "ALL",
      outletName: productData.outletName || "Semua Outlet",
      isAvailable: productData.isAvailable !== false,
      variants: productData.variants || [],
      modifierGroupNames: productData.modifierGroupNames || [],
      recipeMenuId: productData.recipeMenuId,
      description: productData.description || "",
      imageUrl: productData.imageUrl || "",
      tenantId: scopedTenant || productData.tenantId,
      createdAt: productData.createdAt || existingTarget?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    const saved = await savePersistentProduct(product);
    const actorName = auth.name || auth.email || "Admin";
    await appendAuditLog({
      id: `audit-prod-${saved.id}-${Date.now()}`,
      timestamp: nowIso,
      actorId: auth.userId || "unknown",
      actorName,
      actorRole: auth.role || "OWNER",
      role: auth.role || "OWNER",
      userId: auth.userId || "unknown",
      userName: actorName,
      userRole: auth.role || "OWNER",
      tenantId: saved.tenantId,
      outletId: saved.outletId,
      outletName: saved.outletName,
      module: "MENU",
      action: existingTarget ? "UPDATE_PRODUCT" : "CREATE_PRODUCT",
      recordId: saved.id,
      referenceId: saved.id,
      previousValue: existingTarget
        ? `Nama: ${existingTarget.name}, Harga: Rp ${existingTarget.basePrice.toLocaleString("id-ID")}, Status: ${existingTarget.status}`
        : undefined,
      newValue: `Nama: ${saved.name}, Harga: Rp ${saved.basePrice.toLocaleString("id-ID")}, Status: ${saved.status}`,
      description: existingTarget
        ? `Pembaruan produk "${saved.name}"`
        : `Penambahan produk baru "${saved.name}"`,
      reason: body.reason || "Manajemen master katalog menu",
      status: "SUCCESS",
      severity: existingTarget ? "MEDIUM" : "INFO",
      category: "CONFIGURATION",
    });

    return NextResponse.json({
      success: true,
      product: saved,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menyimpan data produk." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/products
 * Updates an existing master product.
 */
export async function PUT(req: NextRequest) {
  try {
    const authCheck = await authorizeProductWrite(req);
    if (!authCheck.authorized) return authCheck.response;
    const { auth } = authCheck;

    const body = await req.json().catch(() => ({}));
    const id = body.id || body.product?.id;
    const updates = body.updates || body.product || body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID produk wajib disertakan." },
        { status: 400 }
      );
    }

    const data = await getPersistentProductsData();
    const target = data.products.find((p) => p.id === id);

    if (!target) {
      return NextResponse.json(
        { success: false, error: `Produk dengan ID [${id}] tidak ditemukan.` },
        { status: 404 }
      );
    }

    const tenantError = assertTenantOwnsProduct(auth, target.tenantId);
    if (tenantError) return tenantError;

    if (auth.scopeLevel === "TENANT" && updates.tenantId) {
      const updateTenantError = assertTenantOwnsProduct(auth, updates.tenantId);
      if (updateTenantError) return updateTenantError;
    }

    const merged: MasterProduct = {
      ...target,
      ...updates,
      id,
      tenantId:
        auth.scopeLevel === "TENANT" ? target.tenantId : (updates.tenantId ?? target.tenantId),
      updatedAt: new Date().toISOString(),
    };

    if (updates.basePrice !== undefined || updates.cogsEstimate !== undefined) {
      const price = merged.basePrice;
      const cogs = merged.cogsEstimate;
      merged.grossMarginPercent =
        price > 0 ? `${Math.round(((price - cogs) / price) * 1000) / 10}%` : "0.0%";
    }

    const saved = await savePersistentProduct(merged);
    const actorName = auth.name || auth.email || "Admin";
    await appendAuditLog({
      id: `audit-prod-put-${saved.id}-${Date.now()}`,
      timestamp: saved.updatedAt,
      actorId: auth.userId || "unknown",
      actorName,
      actorRole: auth.role || "OWNER",
      role: auth.role || "OWNER",
      userId: auth.userId || "unknown",
      userName: actorName,
      userRole: auth.role || "OWNER",
      tenantId: saved.tenantId,
      outletId: saved.outletId,
      outletName: saved.outletName,
      module: "MENU",
      action: "UPDATE_PRODUCT",
      recordId: saved.id,
      referenceId: saved.id,
      previousValue: `Nama: ${target.name}, Harga: Rp ${target.basePrice.toLocaleString("id-ID")}, Status: ${target.status}`,
      newValue: `Nama: ${saved.name}, Harga: Rp ${saved.basePrice.toLocaleString("id-ID")}, Status: ${saved.status}`,
      description: `Perubahan produk "${saved.name}"`,
      reason: body.reason || "Pembaruan data master produk",
      status: "SUCCESS",
      severity: "MEDIUM",
      category: "CONFIGURATION",
    });

    return NextResponse.json({
      success: true,
      product: saved,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memperbarui data produk." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/products
 * Deletes a master product from persistent server storage.
 */
export async function DELETE(req: NextRequest) {
  try {
    const authCheck = await authorizeProductWrite(req);
    if (!authCheck.authorized) return authCheck.response;
    const { auth } = authCheck;

    const { searchParams } = new URL(req.url);
    const idFromQuery = searchParams.get("id");
    let id = idFromQuery;

    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = body.id;
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID produk wajib disertakan untuk penghapusan." },
        { status: 400 }
      );
    }

    const data = await getPersistentProductsData();
    const target = data.products.find((p) => p.id === id);
    if (target) {
      const tenantError = assertTenantOwnsProduct(auth, target.tenantId);
      if (tenantError) return tenantError;
    }

    await deletePersistentProduct(id);

    const actorName = auth.name || auth.email || "Admin";
    await appendAuditLog({
      id: `audit-prod-del-${id}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: auth.userId || "unknown",
      actorName,
      actorRole: auth.role || "OWNER",
      role: auth.role || "OWNER",
      userId: auth.userId || "unknown",
      userName: actorName,
      userRole: auth.role || "OWNER",
      tenantId: target?.tenantId,
      outletId: target?.outletId,
      outletName: target?.outletName,
      module: "MENU",
      action: "DELETE_PRODUCT",
      recordId: id,
      referenceId: id,
      previousValue: target
        ? `Nama: ${target.name}, Harga: Rp ${target.basePrice.toLocaleString("id-ID")}`
        : id,
      newValue: "DELETED",
      description: `Penghapusan produk "${target?.name || id}"`,
      reason: "Produk dihapus dari master katalog",
      status: "WARNING",
      severity: "HIGH",
      category: "CONFIGURATION",
    });

    return NextResponse.json({
      success: true,
      message: `Produk dengan ID [${id}] berhasil dihapus.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menghapus data produk." },
      { status: 500 }
    );
  }
}
