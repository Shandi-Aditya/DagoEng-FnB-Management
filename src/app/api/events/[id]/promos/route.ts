import { NextRequest, NextResponse } from "next/server";
import { getAdminEventById, createEventPromoCode } from "@/lib/events";
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

    if (!adminAuth.authorized && !organizerAuth.authorized) {
      const publicPromos = (event.promoCodes || [])
        .filter((p: EventPromoCode) => p.isActive)
        .map((p: EventPromoCode) => ({
          code: p.code,
          discountType: p.discountType,
          discountValue: p.discountValue,
          maxDiscountAmount: p.maxDiscountAmount,
          minOrderAmount: p.minOrderAmount,
          validFrom: p.validFrom,
          validUntil: p.validUntil,
          applicableTierIds: p.applicableTierIds,
        }));
      return NextResponse.json({ success: true, promoCodes: publicPromos });
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
    const organizerAuth = await assertOrganizerAuth(req, body.organizerEmail || event.organizerEmail);

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

    const promo = await createEventPromoCode(id, {
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
    });

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
