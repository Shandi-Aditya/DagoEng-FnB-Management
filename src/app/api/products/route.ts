import { NextRequest, NextResponse } from "next/server";
import {
  getPersistentProductsData,
  savePersistentProduct,
  deletePersistentProduct,
  savePersistentCustomCategory,
} from "@/lib/persistent-storage";
import { MasterProduct } from "@/types/product";

export const dynamic = "force-dynamic";

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
    const body = await req.json().catch(() => ({}));

    // Handle adding custom category
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

    // Handle product creation or update
    const productData = body.product || body;
    if (!productData || !productData.name || typeof productData.basePrice !== "number") {
      return NextResponse.json(
        { success: false, error: "Nama produk dan harga dasar wajib diisi." },
        { status: 400 }
      );
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
      tenantId: productData.tenantId,
      createdAt: productData.createdAt || nowIso,
      updatedAt: nowIso,
    };

    const saved = await savePersistentProduct(product);

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

    const merged: MasterProduct = {
      ...target,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    };

    if (updates.basePrice !== undefined || updates.cogsEstimate !== undefined) {
      const price = merged.basePrice;
      const cogs = merged.cogsEstimate;
      merged.grossMarginPercent =
        price > 0 ? `${Math.round(((price - cogs) / price) * 1000) / 10}%` : "0.0%";
    }

    const saved = await savePersistentProduct(merged);

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

    await deletePersistentProduct(id);

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
