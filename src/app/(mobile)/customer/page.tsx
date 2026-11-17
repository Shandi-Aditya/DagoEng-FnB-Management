"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { notify } from "@/components/app/notify";
import { useAuth } from "@/contexts/AuthContext";
import { useCoworking } from "@/contexts/CoworkingContext";
import { useInventory } from "@/contexts/InventoryContext";
import { useLoyalty } from "@/contexts/LoyaltyContext";
import { useOrders } from "@/contexts/OrderContext";
import { useOutlet } from "@/contexts/OutletContext";
import { useProducts } from "@/contexts/ProductContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useTables } from "@/contexts/TableContext";
import { AccountView } from "@/features/customer/app/AccountView";
import { ActivityView } from "@/features/customer/app/ActivityView";
import { CheckoutSheet, type CheckoutForm } from "@/features/customer/app/CheckoutSheet";
import { CustomerShell, type CustomerView } from "@/features/customer/app/CustomerShell";
import { OrderView, type PartnerOption } from "@/features/customer/app/OrderView";
import { SpaceView, type SpaceBookingRequest } from "@/features/customer/app/SpaceView";
import { useGuestIdentity } from "@/features/customer/app/use-guest-identity";
import { CustomerTicketPassModal } from "@/features/customer/CustomerTicketPassModal";
import { calculateCartTotals, calculateEndTime, filterCustomerProducts, type CustomerCartItem } from "@/features/customer/customer-domain";
import { filterGuestBookings, filterGuestOrders, parseTableParam } from "@/features/customer/guest-session";
import { CoworkingReceiptModal } from "@/features/coworking/CoworkingReceiptModal";
import { buildOrderReceiptData } from "@/features/orders/orders-domain";
import { PaymentWaitingModal } from "@/features/payment/PaymentWaitingModal";
import { ReceiptModal } from "@/features/pos/ReceiptModal";
import { isCoworkingDateOpen, isTenantAcceptingOrders } from "@/lib/operating-hours";
import { getAllFnbTenants, isTenantActive } from "@/lib/tenant";
import { formatCurrencyIDR } from "@/lib/utils";
import type { CoworkingBooking } from "@/types/coworking";
import type { EventTicketOrder } from "@/types/event";
import type { OrderRecord } from "@/types/order";
import type { MasterProduct } from "@/types/product";

const DEFAULT_PARTNER = "tenant-ks";
const POINTS_PER_RUPIAH = 1000;

/** Old links used ?tab=MENU|COWORKING|ORDERS|LOYALTY|PROFILE; keep them working. */
function viewFromParam(raw: string | null): CustomerView {
  switch ((raw ?? "").toUpperCase()) {
    case "COWORKING":
    case "SPACE":
      return "space";
    case "ORDERS":
    case "ACTIVITY":
      return "activity";
    case "LOYALTY":
    case "PROFILE":
    case "ACCOUNT":
      return "account";
    default:
      return "order";
  }
}

const EMPTY_FORM: CheckoutForm = { name: "", phone: "", orderType: "DINE_IN", tableNumber: "", payment: "QRIS", notes: "" };

function CustomerApp() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { user, logout } = useAuth();
  const { activeOutlet, activeOutletId, setOutlet } = useOutlet();
  const { filteredProducts } = useProducts();
  const { members, addPoints } = useLoyalty();
  const { orders, createOrder, advanceOrderStatus } = useOrders();
  const { areas, releaseTableToAvailable, occupyTableWithOrder } = useTables();
  const { deductOrderBOM } = useInventory();
  const { spaces, bookings, bookSpace, confirmBookingPayment, cancelBooking } = useCoworking();
  const { settings, redeemPromo } = useSettings();

  const [view, setView] = useState<CustomerView>(() => viewFromParam(searchParams.get("tab")));

  // Identity: a signed-in member, or the name and WhatsApp a guest left at checkout on this device.
  const isStaff = Boolean(user && user.role?.slug !== "CUSTOMER");
  const isCustomerSignedIn = Boolean(user && user.role?.slug === "CUSTOMER");
  const currentMember = useMemo(() => {
    if (!user) return null;
    return (
      members.find(
        (m) =>
          (user.phone && m.phone === user.phone) ||
          (user.email && m.email && m.email.toLowerCase() === user.email.toLowerCase()) ||
          m.id === user.id,
      ) ?? null
    );
  }, [user, members]);
  const { identity, remember } = useGuestIdentity(
    currentMember ? { name: currentMember.name, phone: currentMember.phone } : user?.phone ? { name: user.name, phone: user.phone } : null,
  );

  useEffect(() => {
    if (currentMember?.registeredOutletId && currentMember.registeredOutletId !== activeOutletId) {
      setOutlet(currentMember.registeredOutletId);
    }
  }, [currentMember, activeOutletId, setOutlet]);

  // Table from the QR sticker (?meja=T-04), checked against the outlet's real tables.
  const allTableNumbers = useMemo(() => areas.flatMap((area) => area.tables.map((table) => table.number)), [areas]);
  const lockedTable = useMemo(() => parseTableParam(searchParams.get("meja"), allTableNumbers), [searchParams, allTableNumbers]);
  const freeTables = useMemo(
    () => areas.flatMap((area) => area.tables.filter((t) => t.status === "AVAILABLE").map((t) => ({ number: t.number, areaName: area.name }))),
    [areas],
  );

  // Menu
  const partners: PartnerOption[] = useMemo(
    () =>
      getAllFnbTenants()
        .filter((tenant) => isTenantActive(tenant.id))
        .map((tenant) => ({
          id: tenant.id,
          name: tenant.name,
          tagline: tenant.tagline || "",
          isOpen: isTenantAcceptingOrders(tenant.id, settings?.tenantOperations).isOpen,
        })),
    [settings?.tenantOperations],
  );
  const [partnerId, setPartnerId] = useState(DEFAULT_PARTNER);
  const [category, setCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const categories = useMemo(
    () =>
      Array.from(
        new Set(filteredProducts.filter((p) => (p.tenantId || DEFAULT_PARTNER) === partnerId && p.status === "ACTIVE").map((p) => p.category)),
      ),
    [filteredProducts, partnerId],
  );
  const products = useMemo(
    () => filterCustomerProducts(filteredProducts, { partnerId, category, searchQuery }),
    [filteredProducts, partnerId, category, searchQuery],
  );

  // Cart and checkout
  const [cart, setCart] = useState<CustomerCartItem[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [form, setForm] = useState<CheckoutForm>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totals = calculateCartTotals(cart, {
    taxRatePercent: settings.isTaxEnabled === false ? 0 : settings.taxRatePercent,
    serviceChargePercent: settings.serviceChargePercent,
    isDineIn: form.orderType === "DINE_IN",
  });

  const addProduct = (product: MasterProduct) => {
    if (!product.isAvailable) return;
    const status = isTenantAcceptingOrders(product.tenantId || DEFAULT_PARTNER, settings?.tenantOperations);
    if (!status.isOpen) {
      notify.error("Dapur sedang tutup", status.reason || "Dapur ini tidak menerima pesanan sekarang.");
      return;
    }
    setCart((prev) =>
      prev.some((item) => item.product.id === product.id)
        ? prev.map((item) => (item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
        : [...prev, { product, quantity: 1 }],
    );
  };
  const addById = (productId: string) => {
    const item = cart.find((entry) => entry.product.id === productId);
    if (item) addProduct(item.product);
  };
  const removeProduct = (productId: string) =>
    setCart((prev) =>
      prev.flatMap((item) => (item.product.id !== productId ? [item] : item.quantity > 1 ? [{ ...item, quantity: item.quantity - 1 }] : [])),
    );

  const openCheckout = () => {
    setForm((prev) => ({
      ...prev,
      name: prev.name || identity.name || "",
      phone: prev.phone || identity.phone || "",
      tableNumber: lockedTable ?? prev.tableNumber,
    }));
    setIsCheckoutOpen(true);
  };

  // Payment state shared by orders and bookings
  const [waitingOrder, setWaitingOrder] = useState<OrderRecord | null>(null);
  const [waitingBooking, setWaitingBooking] = useState<CoworkingBooking | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const openPayment = (order: OrderRecord | null, booking: CoworkingBooking | null) => {
    setWaitingOrder(order);
    setWaitingBooking(booking);
    setIsPaymentOpen(true);
  };

  const submitOrder = () => {
    if (cart.length === 0) return;
    const name = form.name.trim();
    const phone = form.phone.trim();
    const table = form.orderType === "DINE_IN" ? lockedTable ?? form.tableNumber : "TAKEAWAY";
    setIsSubmitting(true);
    try {
      const order = createOrder({
        tableNumber: table,
        customerName: name,
        customerPhone: phone,
        orderType: form.orderType,
        items: cart.map((item, index) => ({
          id: `it-${Date.now()}-${index}`,
          productId: item.product.id,
          tenantId: item.product.tenantId,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: Number(item.product.basePrice) || 0,
        })),
        subtotal: totals.subtotal,
        serviceCharge: totals.serviceChargeAmount,
        serviceChargePercent: form.orderType === "DINE_IN" ? settings.serviceChargePercent : 0,
        tax: totals.taxAmount,
        taxRatePercent: settings.taxRatePercent,
        total: totals.finalTotal,
        outletId: activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr",
        outletName: activeOutlet?.name || "Singaraja",
        status: "NEW",
        paymentStatus: "PENDING",
        paymentMethod: form.payment === "CASHIER" ? "CASH" : "QRIS",
        notes: form.notes.trim() || undefined,
      });
      remember({ name, phone });
      setCart([]);
      setForm((prev) => ({ ...EMPTY_FORM, name: prev.name, phone: prev.phone }));
      setIsCheckoutOpen(false);
      if (form.payment === "QRIS") {
        openPayment(order, null);
      } else {
        notify.success("Pesanan dikirim", `#${order.orderNumber}. Bayar ${formatCurrencyIDR(order.total)} di kasir.`);
        setView("activity");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Room bookings
  const [isBooking, setIsBooking] = useState(false);
  const submitBooking = (request: SpaceBookingRequest) => {
    setIsBooking(true);
    try {
      const subtotal = request.space.hourlyRate * request.hours;
      const booking = bookSpace({
        spaceId: request.space.id,
        spaceName: request.space.name,
        spaceType: request.space.type,
        guestName: request.name.trim(),
        guestPhone: request.phone.trim(),
        guestEmail: currentMember?.email || user?.email || "",
        bookingType: "HOURLY",
        date: request.date,
        startTime: `${request.start} WITA`,
        endTime: `${calculateEndTime(request.start, request.hours)} WITA`,
        duration: request.hours,
        price: subtotal,
        discount: 0,
        totalAmount: subtotal,
        paidAmount: 0,
        remainingAmount: subtotal,
        paymentMethod: request.payment,
        paymentStatus: "PENDING",
        notes: `Booking ${request.space.name}`,
      });
      remember({ name: request.name.trim(), phone: request.phone.trim() });
      if (request.payment === "QRIS") {
        openPayment(null, booking);
      } else {
        notify.success("Ruang dipesan", `${request.space.name}, bayar ${formatCurrencyIDR(subtotal)} di kasir.`);
        setView("activity");
      }
    } finally {
      setIsBooking(false);
    }
  };

  const handlePaymentSuccess = (payload: { type: "FNB" | "COWORKING"; id: string }) => {
    if (payload.type === "FNB") {
      const order = orders.find((o) => o.id === payload.id) || waitingOrder;
      if (order && order.paymentStatus !== "PAID") {
        advanceOrderStatus(order.id, "CONFIRMED", "Pembayaran lunas via QRIS", { paymentStatus: "PAID", paymentMethod: order.paymentMethod || "QRIS" });
        deductOrderBOM(order.items.map((item) => ({ productId: item.productId, productName: item.productName, quantity: item.quantity, modifiers: item.modifiers })));
        if (currentMember) {
          const points = Math.floor(order.total / POINTS_PER_RUPIAH);
          if (points > 0) addPoints(currentMember.id, points, `Pesanan #${order.orderNumber}`, order.id, order.total);
        }
        if (order.orderType === "DINE_IN" && order.tableNumber && order.tableNumber !== "TAKEAWAY") {
          occupyTableWithOrder(order.tableNumber, {
            customerName: order.customerName,
            totalFormatted: formatCurrencyIDR(order.total),
            itemsCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
            orderId: order.id,
          });
        }
        if (order.promoId) redeemPromo(order.promoId, identity.phone || "cust");
        notify.success("Pembayaran diterima", `Pesanan #${order.orderNumber} diteruskan ke dapur.`);
      }
    } else {
      const booking = bookings.find((b) => b.id === payload.id) || waitingBooking;
      if (booking) {
        confirmBookingPayment(booking.id, booking.paymentMethod || "QRIS");
        if (currentMember) {
          const points = Math.floor(booking.totalAmount / POINTS_PER_RUPIAH);
          if (points > 0) addPoints(currentMember.id, points, `Booking #${booking.bookingCode}`, booking.id);
        }
        notify.success("Pembayaran diterima", `${booking.spaceName} siap dipakai.`);
      }
    }
    setIsPaymentOpen(false);
    setView("activity");
  };

  const handlePaymentCancel = (payload: { type: "FNB" | "COWORKING"; id: string }) => {
    if (payload.type === "FNB") {
      const order = orders.find((o) => o.id === payload.id) || waitingOrder;
      if (order) {
        advanceOrderStatus(order.id, "CANCELLED", "Pesanan dibatalkan oleh pelanggan.");
        if (order.orderType === "DINE_IN" && order.tableNumber && order.tableNumber !== "TAKEAWAY") releaseTableToAvailable(order.tableNumber);
        notify.success("Pesanan dibatalkan", `#${order.orderNumber}`);
      }
    } else {
      const booking = bookings.find((b) => b.id === payload.id) || waitingBooking;
      if (booking) {
        cancelBooking(booking.id);
        notify.success("Booking dibatalkan", `#${booking.bookingCode}`);
      }
    }
    setIsPaymentOpen(false);
  };

  // Activity: matched by phone, never by name.
  const myOrders = useMemo(
    () => [...filterGuestOrders(orders, identity)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [orders, identity.phone], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const myBookings = useMemo(() => filterGuestBookings(bookings, identity), [bookings, identity.phone]); // eslint-disable-line react-hooks/exhaustive-deps
  const [tickets, setTickets] = useState<EventTicketOrder[]>([]);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    fetch("/api/events/bookings/my", { signal: controller.signal })
      .then((res) => res.json())
      .then((json: { success?: boolean; data?: unknown }) => {
        if (json.success && Array.isArray(json.data)) setTickets(json.data as EventTicketOrder[]);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) console.error("Gagal memuat tiket event", error);
      });
    return () => controller.abort();
  }, [user]);
  const activeCount = myOrders.filter((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED").length;

  const [receiptOrder, setReceiptOrder] = useState<OrderRecord | null>(null);
  const [receiptBooking, setReceiptBooking] = useState<CoworkingBooking | null>(null);
  const [ticketPass, setTicketPass] = useState<EventTicketOrder | null>(null);

  // Account
  const nextTier = useMemo(() => {
    if (!currentMember) return { nextTier: "Silver", pointsNeeded: 0, progress: 0 };
    const points = currentMember.points;
    const tiers = settings.loyaltyTiers;
    const ladder = [
      { name: "Silver", min: tiers.silverMin, from: 0 },
      { name: "Gold", min: tiers.goldMin, from: tiers.silverMin },
      { name: "Platinum", min: tiers.platinumMin, from: tiers.goldMin },
    ];
    const next = ladder.find((step) => points < step.min);
    if (!next) return { nextTier: "Platinum", pointsNeeded: 0, progress: 100 };
    return {
      nextTier: next.name,
      pointsNeeded: next.min - points,
      progress: Math.min(100, Math.round(((points - next.from) / (next.min - next.from)) * 100)),
    };
  }, [currentMember, settings.loyaltyTiers]);

  const outlet = activeOutlet || {
    name: "Singaraja",
    address: "Jl. Teleng No. 1, Banyuasri, Kec. Buleleng, Kabupaten Buleleng, Bali 81116",
    phone: "",
  };

  return (
    <>
      <CustomerShell view={view} onViewChange={setView} tableNumber={lockedTable} activeCount={activeCount}>
        {view === "order" ? (
          <OrderView
            partners={partners}
            activePartnerId={partnerId}
            onPartnerChange={(id) => {
              setPartnerId(id);
              setCategory("ALL");
            }}
            categories={categories}
            activeCategory={category}
            onCategoryChange={setCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            products={products}
            cart={cart}
            onAdd={addProduct}
            onRemove={removeProduct}
            cartCount={cartCount}
            cartSubtotal={totals.subtotal}
            onOpenCheckout={openCheckout}
          />
        ) : null}
        {view === "space" ? (
          <SpaceView
            spaces={spaces}
            bookings={bookings}
            isDateOpen={(date) => isCoworkingDateOpen(date, settings.coworkingHolidays)}
            defaultName={identity.name ?? ""}
            defaultPhone={identity.phone ?? ""}
            onBook={submitBooking}
            isSubmitting={isBooking}
          />
        ) : null}
        {view === "activity" ? (
          <ActivityView
            hasIdentity={Boolean(identity.phone)}
            orders={myOrders}
            bookings={myBookings}
            tickets={tickets}
            onPayOrder={(order) => openPayment(order, null)}
            onPayBooking={(booking) => openPayment(null, booking)}
            onOpenOrderReceipt={setReceiptOrder}
            onOpenBookingReceipt={setReceiptBooking}
            onOpenTicket={setTicketPass}
            onStartOrder={() => setView("order")}
          />
        ) : null}
        {view === "account" ? (
          <AccountView
            member={currentMember}
            isSignedIn={isCustomerSignedIn}
            isStaff={isStaff}
            nextTier={nextTier}
            onLogout={async () => {
              await logout();
              notify.success("Anda sudah keluar");
              router.push("/");
            }}
          />
        ) : null}
      </CustomerShell>

      <CheckoutSheet
        open={isCheckoutOpen}
        onOpenChange={setIsCheckoutOpen}
        cart={cart}
        totals={totals}
        form={form}
        onFormChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
        lockedTable={lockedTable}
        tables={freeTables}
        onAdd={addById}
        onRemove={removeProduct}
        onSubmit={submitOrder}
        isSubmitting={isSubmitting}
      />

      {isPaymentOpen ? (
        <PaymentWaitingModal
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          order={waitingOrder}
          booking={waitingBooking}
          onPaymentSuccess={handlePaymentSuccess}
          onCancelPayment={handlePaymentCancel}
        />
      ) : null}

      {receiptOrder ? <ReceiptModal isOpen onClose={() => setReceiptOrder(null)} receiptData={buildOrderReceiptData(receiptOrder)} /> : null}

      {receiptBooking ? (
        <CoworkingReceiptModal
          isOpen
          onClose={() => setReceiptBooking(null)}
          receiptData={{
            bookingCode: receiptBooking.bookingCode,
            transactionDate: receiptBooking.date,
            guestName: receiptBooking.guestName,
            guestPhone: receiptBooking.guestPhone,
            guestEmail: receiptBooking.guestEmail,
            company: receiptBooking.company,
            spaceName: receiptBooking.spaceName,
            spaceType: receiptBooking.spaceType,
            outletName: outlet.name,
            outletAddress: outlet.address,
            outletPhone: outlet.phone ?? "",
            bookingDate: receiptBooking.date,
            startTime: receiptBooking.startTime,
            endTime: receiptBooking.endTime ?? "",
            duration: receiptBooking.duration,
            bookingType: receiptBooking.bookingType,
            basePrice: receiptBooking.totalAmount,
            discount: 0,
            totalAmount: receiptBooking.totalAmount,
            paymentMethod: receiptBooking.paymentMethod ?? "QRIS",
            paymentStatus: receiptBooking.paymentStatus,
          }}
        />
      ) : null}

      <CustomerTicketPassModal ticket={ticketPass} open={ticketPass !== null} onOpenChange={(open) => !open && setTicketPass(null)} />
    </>
  );
}

export default function CustomerPage() {
  return (
    <Suspense fallback={<p className="p-6 text-center text-sm text-muted-foreground">Memuat</p>}>
      <CustomerApp />
    </Suspense>
  );
}
