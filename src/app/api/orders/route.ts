import { NextRequest, NextResponse } from "next/server";
import {
  getPersistentOrders,
  savePersistentOrder,
  getPersistentLoyaltyPoints,
  updatePersistentLoyaltyPoints,
} from "@/lib/persistent-storage";
import { getRequestAuthUser } from "@/lib/server-auth";
import { OrderRecord } from "@/types/order";

export async function GET(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role) {
      return NextResponse.json(
        { error: auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get("outletId");
    const status = searchParams.get("status");
    const customerKey = searchParams.get("customerKey");

    let orders = await getPersistentOrders();
    if (outletId && outletId !== "ALL") {
      orders = orders.filter((o) => o.outletId === outletId);
    }
    if (status) {
      orders = orders.filter((o) => o.status === status || o.paymentStatus === status);
    }

    let loyaltyPoints = await getPersistentLoyaltyPoints();
    if (customerKey) {
      const normalized = customerKey.trim().toLowerCase();
      loyaltyPoints = loyaltyPoints.filter((l) => l.customerKey.toLowerCase() === normalized);
    }

    return NextResponse.json({ orders, loyaltyPoints });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getRequestAuthUser(req);
    if (!auth.isAuthenticated || !auth.role) {
      return NextResponse.json(
        { error: auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const orderData: OrderRecord = body.order || body;

    if (!orderData || !orderData.id) {
      return NextResponse.json(
        { error: "Order payload with valid id is required." },
        { status: 400 }
      );
    }

    const savedOrder = await savePersistentOrder(orderData);

    let loyaltyRecord = null;
    const customerKey = body.customerKey || (orderData as any).customerPhone || orderData.customerName;
    const pointsDelta =
      typeof body.loyaltyPointsDelta === "number"
        ? body.loyaltyPointsDelta
        : orderData.paymentStatus === "PAID" && typeof (orderData as any).earnedPoints === "number"
          ? (orderData as any).earnedPoints
          : 0;

    if (customerKey && pointsDelta !== 0) {
      loyaltyRecord = await updatePersistentLoyaltyPoints(
        String(customerKey),
        pointsDelta,
        orderData.customerName
      );
    }

    return NextResponse.json({
      success: true,
      order: savedOrder,
      loyaltyRecord,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
