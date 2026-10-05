import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
