import { NextRequest, NextResponse } from "next/server";
import { getAdminEventById, createEventPromoCode, validateAndCalculatePromoDiscount } from "@/lib/events";
import { assertOrganizerAuth, assertEventAdmin } from "@/lib/server-auth";
import { EventPromoCode } from "@/types/event";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const event = await getAdminEventById(id);
    if (!event) {
      return NextResponse.json(
        { success: false, error: "Event tidak ditemukan." },
        { status: 404 }
      );
    }

    const adminAuth = await assertEventAdmin(req);
    const organizerAuth = await assertOrganizerAuth(req, event.organizerEmail);

    const codeParam = req.nextUrl.searchParams.get("code");
    if (codeParam && codeParam.trim() !== "") {
      const subtotalParam = Number(req.nextUrl.searchParams.get("subtotal") || 0);
      const tierIdParam = req.nextUrl.searchParams.get("tierId") || undefined;
      const calc = validateAndCalculatePromoDiscount(event, codeParam, subtotalParam, tierIdParam);
      if (!calc.valid) {
        return NextResponse.json(
          { success: false, error: calc.error || "Kode promo tidak valid." },
          { status: 400 }
        );
      }
      return NextResponse.json({
        success: true,
        promo: {
          code: calc.promo?.code || codeParam.trim().toUpperCase(),
          discountType: calc.promo?.discountType,
          discountValue: calc.promo?.discountValue,
          discountAmount: calc.discountAmount,
          finalPrice: calc.finalPrice,
        },
      });
    }

    if (!adminAuth.authorized && !organizerAuth.authorized) {
      return NextResponse.json(
        { success: false, error: "Akses ditolak: Hanya admin atau penyelenggara yang dapat melihat daftar promo." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      promoCodes: event.promoCodes || [],
    });
  } catch (error: any) {
    console.error("[api/events/promos] GET error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memuat kode promo." },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const body = await req.json();

    const event = await getAdminEventById(id);
    if (!event) {
      return NextResponse.json(
        { success: false, error: "Event tidak ditemukan." },
        { status: 404 }
      );
    }

    const adminAuth = await assertEventAdmin(req);
    const organizerAuth = await assertOrganizerAuth(req, event.organizerEmail);

    if (!adminAuth.authorized && !organizerAuth.authorized) {
      return NextResponse.json(
        { success: false, error: "Hanya penyelenggara event atau admin yang dapat membuat kode promo." },
        { status: 403 }
      );
    }

    if (!body.code || !body.discountType || body.discountValue === undefined) {
      return NextResponse.json(
        { success: false, error: "Kode promo, tipe diskon, dan nilai diskon wajib diisi." },
        { status: 400 }
      );
    }

    const actor = adminAuth.authorized
      ? { name: (adminAuth as any).user?.username || (adminAuth as any).user?.name || "Admin", role: adminAuth.role || "ADMIN" }
      : { name: event.organizerName || "Organizer", role: "ORGANIZER" };

    const promo = await createEventPromoCode(
      id,
      {
        code: body.code,
        discountType: body.discountType,
        discountValue: Number(body.discountValue),
        maxDiscountAmount: body.maxDiscountAmount ? Number(body.maxDiscountAmount) : undefined,
        minOrderAmount: body.minOrderAmount ? Number(body.minOrderAmount) : undefined,
        quota: body.quota !== undefined ? Number(body.quota) : 100,
        validFrom: body.validFrom,
        validUntil: body.validUntil,
        applicableTierIds: body.applicableTierIds,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
      },
      actor
    );

    return NextResponse.json({
      success: true,
      message: "Kode promo berhasil dibuat.",
      promoCode: promo,
    });
  } catch (error: any) {
    console.error("[api/events/promos] POST error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal membuat kode promo." },
      { status: 400 }
    );
  }
}
