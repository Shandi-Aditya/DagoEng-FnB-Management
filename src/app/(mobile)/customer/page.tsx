"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatCurrencyIDR } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useOutlet } from "@/contexts/OutletContext";
import { useProducts } from "@/contexts/ProductContext";
import { useLoyalty } from "@/contexts/LoyaltyContext";
import { useOrders } from "@/contexts/OrderContext";
import { useTables } from "@/contexts/TableContext";
import { useInventory } from "@/contexts/InventoryContext";
import { useCoworking } from "@/contexts/CoworkingContext";
import { useSettings } from "@/contexts/SettingsContext";
import { DEMO_PERSONAS } from "@/contexts/AuthContext";
import { calculateOrderPricing, checkPromoValidity, isPromoEligibleForItem } from "@/lib/promo";
import { LOYALTY_VOUCHERS } from "@/features/pos/mock-data";
import { MEMBERSHIP_PLANS } from "@/features/coworking/coworking-data";
import { PaymentWaitingModal } from "@/features/payment/PaymentWaitingModal";
import { MasterProduct } from "@/types/product";
import { OrderRecord } from "@/types/order";
import { LoyaltyTier } from "@/types/loyalty";
import { CoworkingSpaceItem, CoworkingMembershipPlan } from "@/types/coworking";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import {
  Home,
  UtensilsCrossed,
  ClipboardList,
  Award,
  User,
  Search,
  Building2,
  Coffee,
  Clock,
  MapPin,
  Phone,
  Wifi,
  Users,
  CheckCircle2,
  AlertCircle,
  LogIn,
  ShieldCheck,
  Tag,
  Plus,
  Minus,
  ShoppingBag,
  ArrowRight,
  Sparkles,
  QrCode,
  TrendingUp,
  Check,
  ChevronRight,
  Receipt,
  RotateCcw,
  Store,
  Laptop,
  Calendar,
  X,
  Crown,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface FnbPartner {
  id: string;
  name: string;
  tagline: string;
  desc: string;
  category: string;
  icon: string;
  badge: string;
}

const FNB_PARTNERS: FnbPartner[] = [
  {
    id: "tenant-ks",
    name: "Kopi Senja",
    tagline: "Specialty Coffee & Beverages",
    desc: "Sajian kopi pilihan dan aneka minuman segar untuk menemani aktivitas Anda.",
    category: "Signature Coffee",
    icon: "☕",
    badge: "Official Mitra Kopi",
  },
  {
    id: "tenant-kitchen",
    name: "Dapur Mama",
    tagline: "Masakan Rumahan & Hidangan Utama",
    desc: "Hidangan utama hangat, aneka olahan nasi, dan lauk lezat khas masakan rumah.",
    category: "Main Course",
    icon: "🍽️",
    badge: "Official Kitchen",
  },
  {
    id: "tenant-bakery",
    name: "Manis Bakery",
    tagline: "Roti, Kue & Pastry Segar",
    desc: "Roti segar, pastry mentega lembut, dan camilan lezat yang dipanggang setiap hari.",
    category: "Pastry & Snacks",
    icon: "🥐",
    badge: "Fresh Baked Daily",
  },
  {
    id: "tenant-tea",
    name: "Warung Bu Narti",
    tagline: "Kuliner Tradisional & Minuman Nusantara",
    desc: "Aneka seduhan teh segar, minuman rempah tradisional, dan sajian khas nusantara.",
    category: "Artisan Tea & Refreshers",
    icon: "🍃",
    badge: "Mitra Nusantara",
  },
];

type CustomerTab = "HOME" | "MENU" | "COWORKING" | "ORDERS" | "LOYALTY" | "PROFILE";

interface CartItem {
  product: MasterProduct;
  quantity: number;
  selectedVariant?: string;
  notes?: string;
}

function CustomerPortalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab")?.toUpperCase() as CustomerTab | null;
  const initialTab: CustomerTab =
    urlTab && ["HOME", "MENU", "COWORKING", "ORDERS", "LOYALTY", "PROFILE"].includes(urlTab)
      ? urlTab
      : "HOME";

  const { user, login, loginCustomer, logout } = useAuth();
  const { activeOutlet, activeOutletId, outlets, setOutlet } = useOutlet();
  const { filteredProducts } = useProducts();
  const { members, getOrCreateMember, redeemPoints, reverseTransactionPoints, addPoints } = useLoyalty();
  const { orders, createOrder, advanceOrderStatus } = useOrders();
  const { releaseTableToAvailable, occupyTableWithOrder } = useTables();
  const { simulateBOMDeduction } = useInventory();
  const { spaces, bookings, bookSpace, confirmBookingPayment, cancelBooking } = useCoworking();
  const { settings } = useSettings();

  const urlPartner = searchParams.get("partner");
  const initialPartnerId =
    urlPartner && FNB_PARTNERS.some((p) => p.id === urlPartner)
      ? urlPartner
      : "tenant-ks";

  // Active Tab initialized directly from URL searchParams
  const [activeTab, setActiveTab] = useState<CustomerTab>(initialTab);

  // Active F&B Partner State (Segmented Mitra Navigation)
  const [activePartnerId, setActivePartnerId] = useState<string>(initialPartnerId);
  const [partnerSwitchModal, setPartnerSwitchModal] = useState<{ isOpen: boolean; targetPartnerId: string } | null>(null);

  // Order Cancellation State
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [menuCatFilter, setMenuCatFilter] = useState<string>("ALL");
  const [spaceTypeFilter, setSpaceTypeFilter] = useState<string>("ALL");

  // Transition state
  const [isTabLoading, setIsTabLoading] = useState<boolean>(false);

  // F&B Cart & Checkout State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<"QRIS" | "CASH" | "EDC">("QRIS");
  const [waitingPaymentOrder, setWaitingPaymentOrder] = useState<OrderRecord | null>(null);
  const [waitingPaymentBooking, setWaitingPaymentBooking] = useState<any | null>(null);
  const [isWaitingPaymentOpen, setIsWaitingPaymentOpen] = useState<boolean>(false);
  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKEAWAY">("DINE_IN");
  const [tableNumber, setTableNumber] = useState<string>("T-03");
  const [orderNotes, setOrderNotes] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string>("");

  // Co-working Booking Modal State
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedSpaceForBooking, setSelectedSpaceForBooking] = useState<CoworkingSpaceItem | null>(null);
  const [bookingDate, setBookingDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [bookingDuration, setBookingDuration] = useState<number>(2); // hours
  const [bookingGuests, setBookingGuests] = useState<number>(1);
  const [bookingPaymentMethod, setBookingPaymentMethod] = useState<"QRIS" | "CASH">("QRIS");

  // Guest Authentication & Interceptor State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"LOGIN" | "REGISTER">("REGISTER");
  const [pendingActionAfterAuth, setPendingActionAfterAuth] = useState<"CHECKOUT_FNB" | "BOOKING_COWORK" | null>(null);

  // React to URL search param changes
  useEffect(() => {
    if (urlTab && ["HOME", "MENU", "COWORKING", "ORDERS", "LOYALTY", "PROFILE"].includes(urlTab)) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  useEffect(() => {
    if (urlPartner && FNB_PARTNERS.some((p) => p.id === urlPartner)) {
      setActivePartnerId(urlPartner);
    }
  }, [urlPartner]);

  const urlOutlet = searchParams.get("outlet");
  useEffect(() => {
    if (urlOutlet) {
      setOutlet(urlOutlet);
    }
  }, [urlOutlet, setOutlet]);

  // Switch Tab with micro-smooth state
  const handleTabChange = (tab: CustomerTab) => {
    setIsTabLoading(true);
    setActiveTab(tab);
    setSearchQuery("");
    setTimeout(() => {
      setIsTabLoading(false);
    }, 150);
  };

  // Check if Customer is logged in
  const isCustomerLoggedIn = !!user && user.role.slug === "CUSTOMER";

  // Identify Current Customer Member Profile
  const currentMember = useMemo(() => {
    if (isCustomerLoggedIn && user) {
      const match = members.find(
        (m) =>
          (user.phone && m.phone.replace(/\D/g, "") === user.phone.replace(/\D/g, "")) ||
          (user.email && m.email?.toLowerCase() === user.email.toLowerCase()) ||
          m.name.toLowerCase() === user.name.toLowerCase()
      );
      if (match) return match;
      return members[0];
    }
    return null;
  }, [user, isCustomerLoggedIn, members]);

  // Automatically sync outlet scope to customer's registered branch
  useEffect(() => {
    if (currentMember?.registeredOutletId && currentMember.registeredOutletId !== activeOutletId) {
      setOutlet(currentMember.registeredOutletId);
    }
  }, [currentMember, activeOutletId, setOutlet]);

  // Customer Orders (Filtered strictly to logged in customer, empty if Guest)
  const customerOrders = useMemo(() => {
    if (!isCustomerLoggedIn) return [];
    const custName = currentMember?.name || user?.name;
    if (!custName) return [];
    return orders.filter(
      (o) => o.customerName.toLowerCase() === custName.toLowerCase()
    );
  }, [orders, currentMember, user, isCustomerLoggedIn]);

  // Active (Ongoing) Customer Orders
  const activeOrders = useMemo(() => {
    return customerOrders.filter(
      (o) => o.status !== "SERVED" && o.status !== "COMPLETED" && o.status !== "CANCELLED"
    );
  }, [customerOrders]);

  // Past Completed Customer Orders
  const completedOrders = useMemo(() => {
    return customerOrders.filter(
      (o) => o.status === "SERVED" || o.status === "COMPLETED"
    );
  }, [customerOrders]);

  // Customer Coworking Bookings (Filtered strictly to logged in customer, empty if Guest)
  const customerBookings = useMemo(() => {
    if (!isCustomerLoggedIn) return [];
    const custName = currentMember?.name || user?.name;
    if (!custName) return [];
    return bookings.filter(
      (b) => b.guestName.toLowerCase().includes(custName.toLowerCase())
    );
  }, [bookings, currentMember, user, isCustomerLoggedIn]);

  // Active Partner Object Memo
  const activePartner = useMemo(() => {
    return FNB_PARTNERS.find((p) => p.id === activePartnerId) || FNB_PARTNERS[0];
  }, [activePartnerId]);

  const handleSelectPartner = (targetPartnerId: string) => {
    if (targetPartnerId === activePartnerId) return;

    // Check if cart has items from another partner
    const hasItemsFromOtherPartner = cart.some(
      (item) => item.product.tenantId && item.product.tenantId !== targetPartnerId
    );

    if (hasItemsFromOtherPartner && cart.length > 0) {
      setPartnerSwitchModal({ isOpen: true, targetPartnerId });
    } else {
      setActivePartnerId(targetPartnerId);
      setMenuCatFilter("ALL");
    }
  };

  const confirmPartnerSwitch = () => {
    if (partnerSwitchModal) {
      setCart([]);
      setActivePartnerId(partnerSwitchModal.targetPartnerId);
      setMenuCatFilter("ALL");
      setPartnerSwitchModal(null);
      showToast("Keranjang dikosongkan untuk beralih ke mitra baru.");
    }
  };

  // Menu Categories scoped to active partner
  const menuCategories = useMemo(() => {
    const partnerProducts = filteredProducts.filter(
      (p) => (p.tenantId || "tenant-ks") === activePartnerId && p.status === "ACTIVE"
    );
    const cats = Array.from(new Set(partnerProducts.map((p) => p.category)));
    return ["ALL", ...cats];
  }, [filteredProducts, activePartnerId]);

  // Filtered Menu Items scoped to active partner (No mixing of products)
  const filteredMenuItems = useMemo(() => {
    return filteredProducts.filter((item) => {
      const matchPartner = (item.tenantId || "tenant-ks") === activePartnerId;
      const matchStatus = item.status === "ACTIVE";
      const matchCat = menuCatFilter === "ALL" || item.category === menuCatFilter;
      const matchSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchPartner && matchStatus && matchCat && matchSearch;
    });
  }, [filteredProducts, activePartnerId, menuCatFilter, searchQuery]);

  // Filtered Coworking Spaces
  const filteredSpaces = useMemo(() => {
    return spaces.filter((sp) => {
      const matchType = spaceTypeFilter === "ALL" || sp.type === spaceTypeFilter;
      const matchSearch =
        sp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sp.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sp.amenities.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchType && matchSearch;
    });
  }, [spaces, spaceTypeFilter, searchQuery]);

  // Extract unique tenants from FNB_PARTNERS as the source of truth
  const tenantMap = useMemo(() => {
    const map = new Map<string, { name: string; logoUrl?: string }>();
    FNB_PARTNERS.forEach((partner) => {
      map.set(partner.id, { 
        name: partner.name, 
      });
    });
    return map;
  }, []);

  // Loyalty Vouchers & Coupons in Customer Account
  const [myVouchers, setMyVouchers] = useState<{ id: string; title: string; discountType: "PERCENTAGE" | "FIXED"; discountValue: number }[]>([
    { id: "v-default", title: "Diskon Member Baru 10%", discountType: "PERCENTAGE", discountValue: 10 },
  ]);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string>("");

  // Cart Calculations
  const cartTotalItems = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const activePromo = useMemo(() => {
    if (!settings.promos) return undefined;
    const currentSubtotal = cart.reduce((sum, item) => sum + item.product.basePrice * item.quantity, 0);

    for (const promo of settings.promos) {
      if (checkPromoValidity(promo, currentSubtotal)) {
        const hasEligible = cart.some(ci => 
          isPromoEligibleForItem({
            productId: ci.product.id,
            category: ci.product.category,
            tenantId: ci.product.tenantId,
            quantity: ci.quantity,
            unitPrice: ci.product.basePrice
          }, promo)
        );
        if (hasEligible) return promo;
      }
    }
    return undefined;
  }, [settings.promos, cart]);

  const selectedVoucher = useMemo(() => {
    return myVouchers.find((v) => v.id === selectedVoucherId);
  }, [myVouchers, selectedVoucherId]);

  const cartPricing = useMemo(() => {
    const items = cart.map((c) => ({ 
      productId: c.product.id,
      category: c.product.category,
      tenantId: c.product.tenantId,
      quantity: c.quantity, 
      unitPrice: c.product.basePrice 
    }));
    const basePricing = calculateOrderPricing(items, activePromo, settings.taxRatePercent / 100);
    
    // Apply custom voucher if selected
    if (selectedVoucher) {
      let voucherDisc = 0;
      if (selectedVoucher.discountType === "FIXED") {
        voucherDisc = Math.min(basePricing.originalSubtotal, selectedVoucher.discountValue);
      } else {
        voucherDisc = Math.round((basePricing.originalSubtotal * selectedVoucher.discountValue) / 100);
      }
      const newDisc = Math.max(basePricing.discountAmount, voucherDisc);
      const taxable = Math.max(0, basePricing.originalSubtotal - newDisc);
      const tax = Math.round(taxable * (settings.taxRatePercent / 100));
      return {
        ...basePricing,
        discountAmount: newDisc,
        tax,
        total: taxable + tax,
      };
    }

    return basePricing;
  }, [cart, activePromo, selectedVoucher, settings.taxRatePercent]);

  const cartSubtotal = cartPricing.originalSubtotal;
  const cartDiscountAmount = cartPricing.discountAmount;
  const cartTax = cartPricing.tax;
  const cartGrandTotal = cartPricing.total;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  // Cart Operations
  const addToCart = (product: MasterProduct) => {
    if (!product.isAvailable) return;

    // Check if cart already has items from another partner
    const hasItemsFromOtherPartner = cart.some(
      (item) => item.product.tenantId && item.product.tenantId !== product.tenantId
    );

    if (hasItemsFromOtherPartner && product.tenantId) {
      setPartnerSwitchModal({ isOpen: true, targetPartnerId: product.tenantId });
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    showToast(`+1 ${product.name} dimasukkan ke keranjang`);
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const executeFnbOrder = () => {
    if (cart.length === 0) return;

    const newOrderItems = cart.map((ci, idx) => ({
      id: `it-${Date.now()}-${idx}`,
      productId: ci.product.id,
      tenantId: ci.product.tenantId,
      productName: ci.product.name,
      quantity: ci.quantity,
      unitPrice: ci.product.basePrice,
      modifiers: ci.notes ? [ci.notes] : undefined,
    }));

    const customerName = currentMember?.name || user?.name || "Pelanggan Member";

    // 1. Create order with NEW status & PENDING payment status
    const newOrder = createOrder({
      tableNumber: orderType === "DINE_IN" ? tableNumber : "TAKEAWAY",
      customerName,
      orderType,
      items: newOrderItems,
      subtotal: cartSubtotal,
      tax: cartTax,
      total: cartGrandTotal,
      discount: cartDiscountAmount > 0 ? cartDiscountAmount : undefined,
      promoId: selectedVoucher ? selectedVoucher.title : (activePromo ? activePromo.name : undefined),
      outletId: activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr",
      outletName: activeOutlet?.name || "Singaraja",
      status: "NEW",
      paymentStatus: "PENDING",
      paymentMethod: checkoutPaymentMethod,
      notes: orderNotes || undefined,
    });

    // 2. Clear cart & close drawer
    setCart([]);
    setOrderNotes("");
    setIsCheckoutOpen(false);

    // 3. Open Waiting for Payment modal
    setWaitingPaymentOrder(newOrder);
    setIsWaitingPaymentOpen(true);
    showToast(`Pesanan #${newOrder.orderNumber} dibuat. Menunggu pembayaran.`);
  };

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    // Authentication Guard: Guests MUST login or register before completing checkout
    if (!isCustomerLoggedIn) {
      setPendingActionAfterAuth("CHECKOUT_FNB");
      setAuthModalMode("REGISTER");
      setIsAuthModalOpen(true);
      return;
    }

    executeFnbOrder();
  };

  const handleWaitingPaymentSuccess = (targetOrder: OrderRecord) => {
    // Guard against duplicate processing
    const currentOrder = orders.find((o) => o.id === targetOrder.id) || targetOrder;
    if (currentOrder.paymentStatus === "PAID") return;

    const chosenMethod = targetOrder.paymentMethod || "QRIS";

    // 1. Advance order status to CONFIRMED and mark payment PAID
    advanceOrderStatus(
      targetOrder.id,
      "CONFIRMED",
      `Pembayaran lunas via ${chosenMethod}`,
      {
        paymentStatus: "PAID",
        paymentMethod: chosenMethod,
      }
    );

    // 2. Inventory: Deduct ingredients based on Recipe BOM
    targetOrder.items.forEach((ci) => {
      simulateBOMDeduction(ci.productName, ci.quantity);
    });

    // 3. Loyalty: Award points ONLY now upon successful payment
    let pointsEarned = 0;
    if (currentMember) {
      pointsEarned = Math.floor(targetOrder.total / 1000);
      if (pointsEarned > 0) {
        addPoints(
          currentMember.id,
          pointsEarned,
          `Pesanan Mandiri #${targetOrder.orderNumber} (Lunas)`,
          targetOrder.id
        );
      }
    }

    // 4. Table: Occupy table if Dine-In
    if (targetOrder.orderType === "DINE_IN" && targetOrder.tableNumber && targetOrder.tableNumber !== "TAKEAWAY") {
      occupyTableWithOrder(targetOrder.tableNumber, {
        customerName: targetOrder.customerName,
        totalFormatted: formatCurrencyIDR(targetOrder.total),
        itemsCount: targetOrder.items.reduce((s, i) => s + i.quantity, 0),
        orderId: targetOrder.id,
      });
    }

    // 5. Update local state
    setWaitingPaymentOrder((prev) =>
      prev && prev.id === targetOrder.id
        ? { ...prev, paymentStatus: "PAID", status: "CONFIRMED" }
        : prev
    );

    const loyaltyText = pointsEarned > 0 ? ` (+${pointsEarned} Poin Loyalty)` : "";
    showToast(`Pembayaran ${chosenMethod} Berhasil! Pesanan #${targetOrder.orderNumber} diteruskan ke Dapur.${loyaltyText}`);
  };

  const handleCancelWaitingOrder = (targetOrder: OrderRecord) => {
    advanceOrderStatus(targetOrder.id, "CANCELLED", "Pesanan dibatalkan oleh Pelanggan pada tahap pembayaran");
    if (targetOrder.orderType === "DINE_IN" && targetOrder.tableNumber && targetOrder.tableNumber !== "TAKEAWAY") {
      releaseTableToAvailable(targetOrder.tableNumber);
    }
    setIsWaitingPaymentOpen(false);
    setWaitingPaymentOrder(null);
    showToast(`Pesanan #${targetOrder.orderNumber} telah dibatalkan.`);
  };

  // Coworking Booking Submission
  const handleOpenBookingModal = (space: CoworkingSpaceItem) => {
    setSelectedSpaceForBooking(space);
    setIsBookingModalOpen(true);
  };

  const executeCoworkingBooking = () => {
    if (!selectedSpaceForBooking) return;

    const rate = selectedSpaceForBooking.hourlyRate || 15000;
    const totalAmount = rate * bookingDuration;
    const customerName = currentMember?.name || user?.name || "Pelanggan Member";

    // 1. Create booking with PENDING payment status (requires payment before use)
    const newBooking = bookSpace({
      spaceId: selectedSpaceForBooking.id,
      spaceName: selectedSpaceForBooking.name,
      spaceType: selectedSpaceForBooking.type,
      guestName: customerName,
      guestPhone: currentMember?.phone || user?.phone || "+62 819-1122-3344",
      guestEmail: currentMember?.email || user?.email || "customer@dagoeng.com",
      company: "Member Dago",
      bookingType: "HOURLY",
      date: bookingDate,
      startTime: "09:00 WITA",
      duration: bookingDuration,
      price: totalAmount,
      discount: 0,
      totalAmount,
      paidAmount: 0,
      remainingAmount: totalAmount,
      paymentMethod: bookingPaymentMethod,
      paymentStatus: "PENDING",
      notes: `Booking via Customer Portal (${bookingGuests} orang)`,
    });

    setIsBookingModalOpen(false);
    setWaitingPaymentOrder(null);
    setWaitingPaymentBooking(newBooking);
    setIsWaitingPaymentOpen(true);
    showToast(`Booking ${selectedSpaceForBooking.name} dibuat. Silakan selesaikan pembayaran.`);
  };

  const handleCoworkingBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpaceForBooking) return;

    // Authentication Guard: Guests MUST login or register before completing booking
    if (!isCustomerLoggedIn) {
      setPendingActionAfterAuth("BOOKING_COWORK");
      setAuthModalMode("REGISTER");
      setIsAuthModalOpen(true);
      return;
    }

    executeCoworkingBooking();
  };

  const handleAuthSuccess = () => {
    setIsAuthModalOpen(false);
    if (pendingActionAfterAuth === "CHECKOUT_FNB") {
      setPendingActionAfterAuth(null);
      executeFnbOrder();
    } else if (pendingActionAfterAuth === "BOOKING_COWORK") {
      setPendingActionAfterAuth(null);
      executeCoworkingBooking();
    }
  };

  const handleUniversalPaymentSuccess = (payload: { type: "FNB" | "COWORKING"; id: string }) => {
    if (payload.type === "FNB") {
      const order = orders.find((o) => o.id === payload.id) || waitingPaymentOrder;
      if (order) handleWaitingPaymentSuccess(order);
    } else {
      const booking = bookings.find((b) => b.id === payload.id || b.bookingCode === payload.id) || waitingPaymentBooking;
      if (booking) {
        confirmBookingPayment(booking.id, booking.paymentMethod || "QRIS");

        // Award loyalty points ONLY on paid
        let pts = 0;
        if (currentMember) {
          pts = Math.floor(booking.totalAmount / 1000);
          if (pts > 0) {
            addPoints(
              currentMember.id,
              pts,
              `Booking Ruang #${booking.bookingCode} (Lunas)`,
              booking.id
            );
          }
        }

        setWaitingPaymentBooking((prev: any) => (prev ? { ...prev, paymentStatus: "PAID" } : null));
        const loyaltyMsg = pts > 0 ? ` (+${pts} Poin Loyalty)` : "";
        showToast(`Pembayaran Booking ${booking.spaceName} Berhasil! Ruangan siap digunakan.${loyaltyMsg}`);
      }
    }
  };

  const handleUniversalCancelPayment = (payload: { type: "FNB" | "COWORKING"; id: string }) => {
    if (payload.type === "FNB") {
      const order = orders.find((o) => o.id === payload.id) || waitingPaymentOrder;
      if (order) handleCancelWaitingOrder(order);
    } else {
      const booking = bookings.find((b) => b.id === payload.id || b.bookingCode === payload.id) || waitingPaymentBooking;
      if (booking) {
        cancelBooking(booking.id);
        setIsWaitingPaymentOpen(false);
        setWaitingPaymentBooking(null);
        showToast(`Booking ${booking.bookingCode} telah dibatalkan.`);
      }
    }
  };

  const handleRedeemVoucher = (voucher: typeof LOYALTY_VOUCHERS[0]) => {
    if (!currentMember) return;
    if (currentMember.points < voucher.pointsCost) {
      showToast("Poin Anda tidak mencukupi untuk menukar voucher ini.");
      return;
    }

    const success = redeemPoints(
      currentMember.id,
      voucher.pointsCost,
      `Penukaran ${voucher.title}`
    );

    if (success) {
      const newV = {
        id: `vouch-${Date.now()}`,
        title: voucher.title,
        discountType: voucher.discountType as "PERCENTAGE" | "FIXED",
        discountValue: voucher.discountValue,
      };
      setMyVouchers((prev) => [newV, ...prev]);
      setSelectedVoucherId(newV.id);
      showToast(`Berhasil menukar "${voucher.title}"! Kupon otomatis terpasang untuk checkout.`);
    }
  };

  const handleCancelOrder = (order: OrderRecord) => {
    if (
      order.status === "COOKING" ||
      order.status === "READY" ||
      order.status === "SERVED" ||
      order.status === "COMPLETED"
    ) {
      showToast("Pesanan yang sedang dimasak atau sudah selesai tidak dapat dibatalkan.");
      return;
    }

    advanceOrderStatus(
      order.id,
      "CANCELLED",
      "Dibatalkan oleh Pelanggan via Customer Portal"
    );

    if (order.orderType === "DINE_IN" && order.tableNumber && order.tableNumber !== "TAKEAWAY") {
      releaseTableToAvailable(order.tableNumber);
    }

    if (currentMember && order.id) {
      reverseTransactionPoints(currentMember.id, order.id, `Pembatalan pesanan #${order.orderNumber}`);
    }

    setCancellingOrderId(null);
    showToast(`Pesanan ${order.orderNumber} berhasil dibatalkan.`);
  };

  // Next tier points calculation
  const nextTierInfo = useMemo(() => {
    if (!currentMember) return { nextTier: "Gold", pointsNeeded: 0, progress: 100 };
    const pts = currentMember.points;
    const cfg = settings.loyaltyTiers;

    if (pts < cfg.silverMin) {
      return {
        nextTier: "Silver",
        target: cfg.silverMin,
        pointsNeeded: cfg.silverMin - pts,
        progress: Math.min(100, Math.round((pts / cfg.silverMin) * 100)),
      };
    } else if (pts < cfg.goldMin) {
      const span = cfg.goldMin - cfg.silverMin;
      const done = pts - cfg.silverMin;
      return {
        nextTier: "Gold",
        target: cfg.goldMin,
        pointsNeeded: cfg.goldMin - pts,
        progress: Math.min(100, Math.round((done / span) * 100)),
      };
    } else if (pts < cfg.platinumMin) {
      const span = cfg.platinumMin - cfg.goldMin;
      const done = pts - cfg.goldMin;
      return {
        nextTier: "Platinum",
        target: cfg.platinumMin,
        pointsNeeded: cfg.platinumMin - pts,
        progress: Math.min(100, Math.round((done / span) * 100)),
      };
    } else {
      return {
        nextTier: "Platinum (Max Tier)",
        target: cfg.platinumMin,
        pointsNeeded: 0,
        progress: 100,
      };
    }
  }, [currentMember, settings]);

  const getTierColor = (tier: LoyaltyTier) => {
    switch (tier) {
      case "Platinum":
        return "bg-gradient-to-r from-purple-900 via-indigo-950 to-slate-900 text-purple-200 border-purple-500/40 shadow-purple-500/10";
      case "Gold":
        return "bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 text-white border-yellow-300 shadow-amber-500/20";
      case "Silver":
        return "bg-gradient-to-r from-slate-400 via-slate-500 to-slate-600 text-white border-slate-300 shadow-slate-500/10";
      default:
        return "bg-gradient-to-r from-amber-700 via-amber-800 to-orange-900 text-white border-amber-600";
    }
  };

  const getOrderStatusLabel = (status: OrderRecord["status"], paymentStatus?: OrderRecord["paymentStatus"]) => {
    if (paymentStatus === "PENDING" && status === "NEW") {
      return { label: "Menunggu Pembayaran", color: "bg-amber-100 text-amber-900 border-amber-300 font-bold animate-pulse" };
    }
    switch (status) {
      case "NEW":
        return { label: "Menunggu Konfirmasi", color: "bg-blue-50 text-blue-700 border-blue-200" };
      case "CONFIRMED":
      case "KITCHEN_RECEIVED":
        return { label: "Diterima Dapur", color: "bg-amber-50 text-amber-700 border-amber-200" };
      case "COOKING":
        return { label: "Sedang Dimasak 👨‍🍳", color: "bg-orange-50 text-orange-700 border-orange-200" };
      case "READY":
        return { label: "Siap Disajikan / Ambil ✨", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
      case "SERVED":
      case "COMPLETED":
        return { label: "Selesai", color: "bg-slate-100 text-slate-700 border-slate-200" };
      case "CANCELLED":
        return { label: "Dibatalkan ⚪", color: "bg-rose-50 text-rose-700 border-rose-200" };
      default:
        return { label: status, color: "bg-slate-100 text-slate-700 border-slate-200" };
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col justify-between font-sans pb-24 sm:pb-8 selection:bg-brand-orange selection:text-white">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-xl border border-slate-700 text-xs font-semibold flex items-center space-x-2 animate-in fade-in slide-in-from-top-3 duration-300">
          <Sparkles className="w-4 h-4 text-brand-orange" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. CLEAN HEADER (Branch indicator in top header, no clutter) */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/90 sticky top-0 z-30 shadow-xs transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          
          <div className="flex items-center space-x-3">
            <Link href="/" className="w-8 h-10 relative flex-shrink-0 group">
              <Image
                src="/logo-dago.png"
                alt="DagoEng Logo"
                width={32}
                height={40}
                priority
                className="object-contain transition-transform duration-300 group-hover:scale-105"
              />
            </Link>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-black text-sm sm:text-base tracking-tight text-slate-900 leading-none">
                  DagoEng <span className="text-brand-orange">Customer Portal</span>
                </h1>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0 font-bold">
                  ● Live
                </Badge>
              </div>

              {/* Clean Branch Location Indicator (Auto Scoped) */}
              <div className="text-[11px] text-slate-500 font-medium flex items-center space-x-1.5 mt-0.5">
                <Store className="w-3.5 h-3.5 text-brand-orange" />
                <span className="text-slate-400">Cabang:</span>
                <span className="font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80 text-[10px]">
                  {currentMember?.registeredOutletName || activeOutlet?.name || "Singaraja (Outlet Utama)"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            {/* Quick Cart Pill on Header */}
            <button
              onClick={() => {
                handleTabChange("MENU");
                if (cart.length > 0) setIsCheckoutOpen(true);
              }}
              className="relative p-2 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 transition-all hover:scale-105 active:scale-95"
              title="Keranjang Belanja"
            >
              <ShoppingBag className="w-4 h-4" />
              {cartTotalItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-brand-orange text-white font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center animate-in zoom-in-50">
                  {cartTotalItems}
                </span>
              )}
            </button>

            {/* Guest vs Logged-In Customer Access */}
            {!isCustomerLoggedIn ? (
              <div className="flex items-center space-x-2">
                <span className="hidden sm:inline-flex items-center space-x-1 text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200">
                  <User className="w-3 h-3 text-slate-400" />
                  <span>Guest</span>
                </span>
                <Link href={`/login?returnTo=${encodeURIComponent(`/customer?tab=${activeTab}`)}&mode=customer`}>
                  <Button size="sm" className="text-xs h-8 px-3.5 font-bold bg-brand-orange hover:bg-orange-600 text-white rounded-xl shadow-xs transition-all hover:scale-105 active:scale-95">
                    <LogIn className="w-3.5 h-3.5 mr-1.5" />
                    <span>Daftar / Masuk</span>
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="outline" size="sm" className="text-xs h-8 px-2.5 font-bold text-slate-600 hover:text-slate-900 border-slate-300 rounded-xl" title="Kembali ke Beranda / Onboarding">
                    <Home className="w-3.5 h-3.5 sm:mr-1 text-slate-500" />
                    <span className="hidden sm:inline">Ke Beranda</span>
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 text-amber-950 text-xs font-bold shadow-2xs">
                  <Crown className="w-3.5 h-3.5 text-amber-500" />
                  <span>{currentMember?.name.split(" ")[0]}</span>
                  <span className="text-[10px] bg-amber-200/70 text-amber-900 px-1.5 py-0.2 rounded-md font-black">
                    {currentMember?.points || 0} Pts
                  </span>
                </div>
                <button
                  onClick={async () => {
                    await logout();
                    showToast("Anda telah berhasil keluar dari sesi member.");
                    router.push("/");
                  }}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 text-xs font-bold transition-all hover:scale-105 active:scale-95"
                  title="Keluar Sesi & Kembali ke Beranda"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-500" />
                  <span className="hidden sm:inline">Keluar</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 2. Top Desktop Tab Navigation */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex space-x-1.5 border-t border-slate-100 overflow-x-auto scrollbar-none py-1.5">
          {[
            { key: "HOME", label: "Home", icon: <Home className="w-3.5 h-3.5" /> },
            { key: "MENU", label: "Menu & Pesan", icon: <UtensilsCrossed className="w-3.5 h-3.5" /> },
            { key: "COWORKING", label: "Co-working & Ruang Kerja", icon: <Laptop className="w-3.5 h-3.5" /> },
            {
              key: "ORDERS",
              label: "Pesanan & Booking",
              icon: <ClipboardList className="w-3.5 h-3.5" />,
              badge: activeOrders.length + customerBookings.length > 0 ? activeOrders.length + customerBookings.length : undefined,
            },
            { key: "LOYALTY", label: "Loyalty & Poin", icon: <Award className="w-3.5 h-3.5" /> },
            ...(isCustomerLoggedIn ? [{ key: "PROFILE", label: "Profil Member", icon: <User className="w-3.5 h-3.5" /> }] : []),
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key as CustomerTab)}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                activeTab === t.key
                  ? "bg-slate-900 text-white shadow-xs scale-100"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.badge && (
                <span className="bg-brand-orange text-white text-[9px] px-1.5 py-0.2 rounded-full font-black">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* 3. MAIN CONTENT CONTAINER */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 flex-1 space-y-6">

        {/* Shimmer Skeleton Loader on Tab Transition */}
        {isTabLoading ? (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="h-44 rounded-3xl animate-shimmer" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="h-32 rounded-2xl animate-shimmer" />
              <div className="h-32 rounded-2xl animate-shimmer" />
              <div className="h-32 rounded-2xl animate-shimmer" />
            </div>
          </div>
        ) : (
          <>
            {/* ---------------------------------------------------- */}
            {/* TAB A: HOME (Dashboard Ringkas Pelanggan) */}
            {/* ---------------------------------------------------- */}
            {activeTab === "HOME" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                {/* Greeting & Summary Banner (Guest vs Logged In Member) */}
                {!isCustomerLoggedIn ? (
                  <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 space-y-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-brand-orange/15 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                      <div className="space-y-2 max-w-xl">
                        <div className="flex items-center space-x-2">
                          <span className="px-3 py-0.5 rounded-full bg-brand-orange/20 text-brand-orange text-[10px] font-bold tracking-wide uppercase border border-brand-orange/30">
                            Dago Creative Hub • Customer Portal
                          </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white">
                          Nikmati Kuliner Artisan & Coworking Nyaman ✨
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                          Pesan makanan & minuman artisan atau booking ruang kerja modern tanpa ribet. Kumpulkan poin loyalty untuk setiap transaksi.
                        </p>
                      </div>

                      {/* Guest CTA Card */}
                      <div className="bg-white/10 backdrop-blur-md border border-white/15 p-4 sm:p-5 rounded-2xl flex flex-col justify-between space-y-3 min-w-[260px] shadow-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center font-bold shadow-md shadow-orange-500/30">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-xs font-black text-white block">Program Member Loyalty</span>
                            <span className="text-[11px] text-amber-300 font-semibold">+50 Poin Bonus Member Baru</span>
                          </div>
                        </div>
                        <Link href={`/login?returnTo=${encodeURIComponent(`/customer?tab=${activeTab}`)}&mode=customer`}>
                          <Button className="w-full h-9 bg-brand-orange hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-xs transition-all hover:scale-105 active:scale-95">
                            <span>Daftar / Masuk Akun</span>
                            <ArrowRight className="w-3.5 h-3.5 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {/* Quick Action Shortcuts */}
                    <div className="pt-2 flex flex-wrap gap-3 relative z-10">
                      <Button
                        onClick={() => handleTabChange("MENU")}
                        size="sm"
                        className="font-bold bg-brand-orange text-white hover:bg-orange-600 text-xs h-10 px-5 rounded-xl shadow-md shadow-orange-500/20 hover:-translate-y-0.5 transition-all"
                      >
                        <UtensilsCrossed className="w-3.5 h-3.5 mr-1.5" />
                        <span>Pesan Menu F&B</span>
                      </Button>
                      <Button
                        onClick={() => handleTabChange("COWORKING")}
                        size="sm"
                        variant="outline"
                        className="font-bold bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs h-10 px-5 rounded-xl hover:-translate-y-0.5 transition-all"
                      >
                        <Laptop className="w-3.5 h-3.5 mr-1.5 text-brand-orange" />
                        <span>Booking Ruang Kerja</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 space-y-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-brand-orange/15 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative z-10">
                      <div className="space-y-1.5">
                        <div className="flex items-center space-x-2">
                          <span className="px-3 py-0.5 rounded-full bg-brand-orange/20 text-brand-orange text-[10px] font-bold tracking-wide uppercase border border-brand-orange/30">
                            Digital Member Card
                          </span>
                          <span className="text-xs text-slate-400 font-mono font-semibold">
                            #{currentMember?.id || "mem-001"}
                          </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white">
                          Halo, {currentMember?.name} 👋
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-300">
                          Selamat datang di portal mandiri Dago Creative Hub!
                        </p>
                      </div>

                      {/* Tier Badge & Points Counter */}
                      <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/90 p-4 rounded-2xl flex items-center space-x-4 min-w-[240px] shadow-lg">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-yellow-400 text-slate-950 flex items-center justify-center font-extrabold shadow-md shadow-amber-500/20">
                          <Award className="w-6 h-6 text-slate-950" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-300 block">
                            {currentMember?.tier} Member
                          </span>
                          <div className="text-2xl font-black text-white tracking-tight">
                            <AnimatedCounter value={currentMember?.points || 0} />{" "}
                            <span className="text-xs text-brand-orange font-normal">Poin</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progress to Next Tier */}
                    {nextTierInfo.pointsNeeded > 0 && (
                      <div className="space-y-2 pt-3 border-t border-slate-800 relative z-10">
                        <div className="flex items-center justify-between text-xs text-slate-300">
                          <span>
                            Kumpulkan <strong>{nextTierInfo.pointsNeeded} Poin lagi</strong> untuk mencapai{" "}
                            <span className="text-brand-orange font-bold">{nextTierInfo.nextTier} Member</span>
                          </span>
                          <span className="font-mono text-[11px] text-slate-400">
                            {currentMember?.points} / {nextTierInfo.target}
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                          <div
                            className="bg-gradient-to-r from-amber-400 via-orange-500 to-brand-orange h-full rounded-full transition-all duration-700 shadow-sm"
                            style={{ width: `${nextTierInfo.progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Quick Action Shortcuts */}
                    <div className="pt-2 flex flex-wrap gap-3 relative z-10">
                      <Button
                        onClick={() => handleTabChange("MENU")}
                        size="sm"
                        className="font-bold bg-brand-orange text-white hover:bg-orange-600 text-xs h-10 px-5 rounded-xl shadow-md shadow-orange-500/20 hover:-translate-y-0.5 transition-all"
                      >
                        <UtensilsCrossed className="w-3.5 h-3.5 mr-1.5" />
                        <span>Pesan Menu F&B</span>
                      </Button>
                      <Button
                        onClick={() => handleTabChange("COWORKING")}
                        size="sm"
                        variant="outline"
                        className="font-bold bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 text-xs h-10 px-4 rounded-xl hover:-translate-y-0.5 transition-all"
                      >
                        <Laptop className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
                        <span>Booking Ruang Kerja</span>
                      </Button>
                      <Button
                        onClick={() => handleTabChange("LOYALTY")}
                        size="sm"
                        variant="outline"
                        className="font-bold bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 text-xs h-10 px-4 rounded-xl hover:-translate-y-0.5 transition-all"
                      >
                        <Award className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                        <span>Tukar Voucher ({LOYALTY_VOUCHERS.length})</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Active Orders & Bookings Tracker */}
                {(activeOrders.length > 0 || customerBookings.length > 0) && (
                  <Card className="border-amber-200 bg-amber-50/60 shadow-sm p-5 space-y-3.5 rounded-3xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <span className="flex h-2.5 w-2.5 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-orange opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-orange"></span>
                        </span>
                        <h3 className="font-black text-sm text-slate-900">
                          Aktivitas Berjalan Anda ({activeOrders.length} Pesanan F&B, {customerBookings.length} Ruang Kerja)
                        </h3>
                      </div>
                      <Button
                        onClick={() => handleTabChange("ORDERS")}
                        size="sm"
                        variant="ghost"
                        className="text-xs font-bold text-brand-orange hover:bg-amber-100/80 h-8"
                      >
                        Buka Status Lengkap &rarr;
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeOrders.slice(0, 1).map((ord) => {
                        const st = getOrderStatusLabel(ord.status);
                        return (
                          <div
                            key={ord.id}
                            className="p-3.5 bg-white rounded-2xl border border-amber-200/80 space-y-1 text-xs shadow-2xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900">{ord.orderNumber} (Meja {ord.tableNumber})</span>
                              <Badge className={`${st.color} text-[10px] font-bold`}>{st.label}</Badge>
                            </div>
                            <p className="text-[11px] text-slate-500 line-clamp-1">
                              {ord.items.map((i) => `${i.quantity}x ${i.productName}`).join(", ")}
                            </p>
                          </div>
                        );
                      })}

                      {customerBookings.slice(0, 1).map((bk) => (
                        <div
                          key={bk.id}
                          className="p-3.5 bg-white rounded-2xl border border-blue-200/80 space-y-1 text-xs shadow-2xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">{bk.spaceName}</span>
                            <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold">
                              {bk.checkInStatus}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {bk.date} &bull; {bk.startTime} ({bk.duration} Jam)
                          </p>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Explore Mitra Kuliner (F&B Partners Grid) */}
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-black text-base text-slate-900 flex items-center space-x-2">
                        <span>Pilih Mitra Kuliner DAGO (F&B)</span>
                        <Badge className="bg-orange-100 text-brand-orange border-orange-200 text-[10px] font-bold">
                          Multi-Mitra
                        </Badge>
                      </h3>
                      <p className="text-xs text-slate-500">Pilih mitra favorit Anda untuk melihat katalog menu khusus dan memesan</p>
                    </div>
                    <Button
                      onClick={() => handleTabChange("MENU")}
                      size="sm"
                      variant="ghost"
                      className="text-xs font-bold text-brand-orange hover:bg-orange-50 h-8"
                    >
                      Buka Menu &rarr;
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {FNB_PARTNERS.map((partner) => {
                      const partnerProductCount = filteredProducts.filter(
                        (p) => (p.tenantId || "tenant-ks") === partner.id && p.status === "ACTIVE"
                      ).length;
                      return (
                        <div
                          key={partner.id}
                          onClick={() => {
                            handleSelectPartner(partner.id);
                            handleTabChange("MENU");
                          }}
                          className="bg-white border border-slate-200/90 hover:border-brand-orange/50 hover:shadow-lg rounded-3xl p-4 sm:p-5 flex flex-col justify-between cursor-pointer transition-all duration-300 hover:-translate-y-1 group"
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="w-12 h-12 rounded-2xl bg-orange-50 text-brand-orange border border-orange-200 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                                {partner.icon}
                              </div>
                              <Badge className="bg-slate-100 text-slate-700 text-[10px] font-bold">
                                {partner.badge}
                              </Badge>
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-slate-900 group-hover:text-brand-orange transition-colors">
                                {partner.name}
                              </h4>
                              <p className="text-[11px] text-slate-400 font-medium">{partner.category}</p>
                              <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                                {partner.desc}
                              </p>
                            </div>
                          </div>

                          <div className="pt-3.5 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                            <span className="text-[11px] font-semibold text-slate-500">
                              {partnerProductCount} Menu Tersedia
                            </span>
                            <span className="text-brand-orange font-bold flex items-center group-hover:translate-x-1 transition-transform">
                              <span>Pesan</span>
                              <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Loyalty Perks & Promo Highlight */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-6 rounded-3xl bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 text-white space-y-3 shadow-lg shadow-orange-500/15 flex flex-col justify-between hover:scale-[1.01] transition-all">
                    <div>
                      <Badge className="bg-white/20 backdrop-blur-md text-white border-0 text-[10px] uppercase font-black mb-2">
                        Reward Spesial Member
                      </Badge>
                      <h3 className="font-black text-lg">Voucher Diskon Rp 25.000</h3>
                      <p className="text-xs text-orange-100 leading-relaxed">
                        Tukarkan 100 poin loyalty Anda untuk potongan langsung semua menu F&B Dago Creative Hub.
                      </p>
                    </div>
                    <div className="pt-3 border-t border-white/20 flex items-center justify-between">
                      <span className="text-xs font-bold font-mono">Biaya: 100 Poin</span>
                      <Button
                        onClick={() => handleRedeemVoucher(LOYALTY_VOUCHERS[0])}
                        size="sm"
                        className="bg-white text-orange-600 hover:bg-orange-50 font-bold text-xs h-8 px-4 rounded-xl shadow-xs"
                      >
                        Tukar Poin
                      </Button>
                    </div>
                  </div>

                  <div className="p-6 rounded-3xl bg-white border border-slate-200/90 space-y-3 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-brand-orange/40 hover:scale-[1.01] transition-all">
                    <div>
                      <Badge variant="outline" className="text-brand-orange border-orange-200 bg-orange-50 text-[10px] uppercase font-black mb-2">
                        Co-working Benefit
                      </Badge>
                      <h3 className="font-bold text-lg text-slate-900">Akses Hot Desk & WiFi 100Mbps</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Nikmati ruang kerja tenang dengan koneksi fiber optic cepat dan gratis flow kopi/teh artisan.
                      </p>
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-semibold">Mulai Rp 15.000/jam</span>
                      <Button
                        onClick={() => handleTabChange("COWORKING")}
                        size="sm"
                        variant="outline"
                        className="font-bold text-xs h-8 px-4 rounded-xl border-slate-300 hover:bg-slate-50"
                      >
                        Booking Ruang
                      </Button>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* TAB B: MENU & F&B (Katalog & Keranjang Multi-Mitra) */}
            {/* ---------------------------------------------------- */}
            {activeTab === "MENU" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                {/* 1. Active Mitra Header Banner (Primary: Mitra, Secondary: Powered by DAGO) */}
                <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start space-x-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-orange-100 text-brand-orange border border-orange-200 flex items-center justify-center text-2xl flex-shrink-0 shadow-2xs">
                        {activePartner.icon}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h2 className="text-xl font-black text-slate-900">{activePartner.name}</h2>
                          <Badge className="bg-orange-50 text-brand-orange border-orange-200 text-[10px] font-bold">
                            {activePartner.badge}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-600 font-semibold mt-0.5">{activePartner.tagline}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{activePartner.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1.5 self-start sm:self-center px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-500">
                      <span>Powered by</span>
                      <span className="font-black text-slate-800">DAGO</span>
                    </div>
                  </div>

                  {/* Horizontal Segmented Partner Navigation Tabs */}
                  <div className="pt-3 border-t border-slate-100 flex items-center space-x-2 overflow-x-auto scrollbar-none pb-1">
                    {FNB_PARTNERS.map((partner) => {
                      const isSelected = activePartnerId === partner.id;
                      return (
                        <button
                          key={partner.id}
                          onClick={() => handleSelectPartner(partner.id)}
                          className={`px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all duration-200 flex items-center space-x-2 ${
                            isSelected
                              ? "bg-slate-900 text-white shadow-md shadow-slate-900/20 scale-[1.02]"
                              : "bg-slate-100/90 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                          }`}
                        >
                          <span className="text-sm">{partner.icon}</span>
                          <span>{partner.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Search & Category Filter for Active Mitra */}
                <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      placeholder={`Cari menu di ${activePartner.name}...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange transition-all shadow-2xs"
                    />
                  </div>

                  <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
                    {menuCategories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setMenuCatFilter(cat)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                          menuCatFilter === cat
                            ? "bg-slate-900 text-white shadow-xs"
                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {cat === "ALL" ? "Semua Kategori" : cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Menu Items Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredMenuItems.length === 0 ? (
                    <div className="col-span-full py-12 text-center bg-white rounded-3xl border border-slate-200/90 p-8 space-y-3 shadow-xs">
                      <div className="w-12 h-12 mx-auto rounded-2xl bg-orange-50 text-brand-orange border border-orange-200 flex items-center justify-center text-xl">
                        <UtensilsCrossed className="w-6 h-6" />
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm">Tidak ada menu yang ditemukan</h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        {searchQuery
                          ? `Tidak ditemukan menu yang cocok dengan pencarian "${searchQuery}" pada mitra ${activePartner.name}.`
                          : `Belum ada produk untuk kategori "${menuCatFilter}" di ${activePartner.name}.`}
                      </p>
                      {(searchQuery || menuCatFilter !== "ALL") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSearchQuery("");
                            setMenuCatFilter("ALL");
                          }}
                          className="text-xs font-bold rounded-xl mt-2 border-slate-300 hover:bg-slate-50"
                        >
                          Reset Filter Menu
                        </Button>
                      )}
                    </div>
                  ) : (
                    filteredMenuItems.map((item) => {
                    const isAvailable = item.isAvailable;
                    const inCart = cart.find((ci) => ci.product.id === item.id);

                    return (
                      <div
                        key={item.id}
                        className={`bg-white border rounded-3xl p-5 shadow-xs flex flex-col justify-between gap-4 transition-all duration-300 ${
                          !isAvailable
                            ? "opacity-60 bg-slate-50/80 border-slate-200"
                            : "border-slate-200/90 hover:border-brand-orange/40 hover:shadow-xl hover:-translate-y-1"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-brand-orange uppercase tracking-wider block">
                              {(() => {
                                const tenantInfo = item.tenantId ? tenantMap.get(item.tenantId) : null;
                                const tName = tenantInfo?.name || activePartner.name || "Mitra F&B";
                                return (
                                  <span className="flex items-center space-x-1.5">
                                    <span>{tName} • {item.category}</span>
                                  </span>
                                );
                              })()}
                            </span>
                            {!isAvailable && (
                              <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-bold">
                                Habis
                              </Badge>
                            )}
                          </div>

                          <h3 className="font-bold text-base text-slate-900">{item.name}</h3>
                          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                            {item.description || "Menu pilihan dibuat dengan bahan berkualitas dan higienis."}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                          <div className="space-y-0.5">
                            <span className="font-black text-base text-slate-900 block">
                              {formatCurrencyIDR(item.basePrice)}
                            </span>
                            {item.variants && item.variants.length > 0 && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                {item.variants.length} Opsi Varian
                              </span>
                            )}
                          </div>

                          {/* Add to Cart Actions */}
                          {isAvailable ? (
                            inCart ? (
                              <div className="flex items-center space-x-2 bg-slate-100/90 p-1 rounded-2xl border border-slate-200">
                                <button
                                  onClick={() => updateCartQty(item.id, -1)}
                                  className="w-7 h-7 rounded-xl bg-white text-slate-800 hover:bg-slate-200 flex items-center justify-center font-black text-xs shadow-2xs transition-all active:scale-90"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="font-black text-xs px-1.5 text-slate-900">
                                  {inCart.quantity}
                                </span>
                                <button
                                  onClick={() => updateCartQty(item.id, 1)}
                                  className="w-7 h-7 rounded-xl bg-slate-900 text-white hover:bg-slate-800 flex items-center justify-center font-black text-xs shadow-2xs transition-all active:scale-90"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <Button
                                onClick={() => addToCart(item)}
                                size="sm"
                                className="bg-brand-orange text-white hover:bg-orange-600 font-bold text-xs h-9 px-4 rounded-xl shadow-xs shadow-orange-500/20 transition-all hover:scale-105 active:scale-95"
                              >
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                <span>Pesan</span>
                              </Button>
                            )
                          ) : (
                            <Button size="sm" disabled className="text-xs h-9 px-4 rounded-xl">
                              Habis
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                </div>

                {/* Floating Bottom Cart Bar */}
                {cart.length > 0 && (
                  <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-40 bg-slate-950/90 backdrop-blur-xl text-white p-4 rounded-3xl shadow-2xl border border-slate-800 flex items-center justify-between animate-in slide-in-from-bottom-4 duration-300">
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="bg-brand-orange text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                          {cartTotalItems} Item
                        </span>
                        <span className="text-xs text-slate-300 font-bold">Total Belanja</span>
                      </div>
                      <div className="text-base font-black text-white">
                        {formatCurrencyIDR(cartGrandTotal)}{" "}
                        <span className="text-[10px] text-slate-400 font-normal">(Termasuk PB1)</span>
                      </div>
                    </div>

                    <Button
                      onClick={() => setIsCheckoutOpen(true)}
                      className="bg-brand-orange hover:bg-orange-600 text-white font-bold text-xs h-10 px-5 rounded-2xl shadow-md shadow-orange-500/30 transition-all hover:scale-105 active:scale-95"
                    >
                      <span>Checkout</span>
                      <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Button>
                  </div>
                )}

                {/* Checkout Modal */}
                {isCheckoutOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                      
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-xl bg-orange-100 text-brand-orange flex items-center justify-center font-bold">
                            <ShoppingBag className="w-4 h-4" />
                          </div>
                          <h3 className="font-black text-lg text-slate-900">Konfirmasi Pesanan F&B</h3>
                        </div>
                        <button
                          onClick={() => setIsCheckoutOpen(false)}
                          className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold transition-all"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Cart Items List */}
                      <div className="space-y-2.5 divide-y divide-slate-100 max-h-48 overflow-y-auto pr-1">
                        {cart.map((ci) => (
                          <div key={ci.product.id} className="pt-2 flex items-center justify-between text-xs">
                            <div className="space-y-0.5">
                              <span className="font-bold text-slate-900">{ci.product.name}</span>
                              <p className="text-[11px] text-slate-400">
                                {ci.quantity} x {formatCurrencyIDR(ci.product.basePrice)}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2.5">
                              <span className="font-black text-slate-900">
                                {formatCurrencyIDR(ci.product.basePrice * ci.quantity)}
                              </span>
                              <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg">
                                <button
                                  onClick={() => updateCartQty(ci.product.id, -1)}
                                  className="w-5 h-5 bg-white text-slate-700 rounded flex items-center justify-center text-[10px] font-bold shadow-2xs"
                                >
                                  -
                                </button>
                                <span className="text-[11px] font-bold px-1.5">{ci.quantity}</span>
                                <button
                                  onClick={() => updateCartQty(ci.product.id, 1)}
                                  className="w-5 h-5 bg-slate-900 text-white rounded flex items-center justify-center text-[10px] font-bold shadow-2xs"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Order Options Form */}
                      <form onSubmit={handleCheckoutSubmit} className="space-y-3.5 pt-2 border-t border-slate-100">
                        <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                          <button
                            type="button"
                            onClick={() => setOrderType("DINE_IN")}
                            className={`py-2.5 rounded-xl border text-center transition-all ${
                              orderType === "DINE_IN"
                                ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            Makan di Tempat (Dine-In)
                          </button>
                          <button
                            type="button"
                            onClick={() => setOrderType("TAKEAWAY")}
                            className={`py-2.5 rounded-xl border text-center transition-all ${
                              orderType === "TAKEAWAY"
                                ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            Bawa Pulang (Takeaway)
                          </button>
                        </div>

                        {orderType === "DINE_IN" && (
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700">Pilih Nomor Meja</label>
                            <select
                              value={tableNumber}
                              onChange={(e) => setTableNumber(e.target.value)}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-orange/20"
                            >
                              <option value="T-01">Meja T-01 (Lantai 1)</option>
                              <option value="T-02">Meja T-02 (Lantai 1)</option>
                              <option value="T-03">Meja T-03 (Lantai 1 - Window)</option>
                              <option value="T-04">Meja T-04 (Lantai 2 Mezzanine)</option>
                              <option value="T-05">Meja T-05 (Outdoor Terrace)</option>
                            </select>
                          </div>
                        )}

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700">Catatan Pesanan (Opsional)</label>
                          <input
                            type="text"
                            placeholder="Contoh: Kurang manis, tanpa sedotan..."
                            value={orderNotes}
                            onChange={(e) => setOrderNotes(e.target.value)}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-brand-orange/20"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">Pilih Metode Pembayaran</label>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { id: "QRIS", label: "QRIS", desc: "e-Wallet / BCA" },
                              { id: "CASH", label: "Kasir", desc: "Bayar Tunai" },
                              { id: "EDC", label: "Debit/EDC", desc: "Kartu Bank" },
                            ].map((pm) => (
                              <button
                                key={pm.id}
                                type="button"
                                onClick={() => setCheckoutPaymentMethod(pm.id as "QRIS" | "CASH" | "EDC")}
                                className={`p-2.5 rounded-xl border text-center transition-all ${
                                  checkoutPaymentMethod === pm.id
                                    ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                                }`}
                              >
                                <span className="text-xs font-black block">{pm.label}</span>
                                <span className={`text-[9px] block ${checkoutPaymentMethod === pm.id ? "text-slate-300" : "text-slate-400"}`}>
                                  {pm.desc}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Voucher & Loyalty Coupon Selection */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                            <span>Voucher & Poin Loyalty</span>
                            {selectedVoucher && (
                              <span className="text-[10px] text-emerald-600 font-bold">✓ Kupon Terpasang</span>
                            )}
                          </label>
                          <select
                            value={selectedVoucherId}
                            onChange={(e) => setSelectedVoucherId(e.target.value)}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none"
                          >
                            <option value="">-- Tanpa Voucher Khusus (Promo Otomatis) --</option>
                            {myVouchers.map((v) => (
                              <option key={v.id} value={v.id}>
                                🎟️ {v.title} ({v.discountType === "FIXED" ? formatCurrencyIDR(v.discountValue) : `Diskon ${v.discountValue}%`})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Price Breakdown */}
                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5 text-xs">
                          <div className="flex justify-between text-slate-600">
                            <span>Subtotal Item</span>
                            <span>{formatCurrencyIDR(cartSubtotal)}</span>
                          </div>
                          {cartDiscountAmount > 0 && (
                            <div className="flex justify-between text-emerald-600 font-bold">
                              <span>Diskon ({activePromo?.name})</span>
                              <span>-{formatCurrencyIDR(cartDiscountAmount)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-slate-600">
                            <span>Pajak Restoran PB1 ({settings.taxRatePercent}%)</span>
                            <span>{formatCurrencyIDR(cartTax)}</span>
                          </div>
                          <div className="flex justify-between font-black text-slate-900 pt-2 border-t border-slate-200 text-sm">
                            <span>Total Pembayaran</span>
                            <span className="text-brand-orange">{formatCurrencyIDR(cartGrandTotal)}</span>
                          </div>
                        </div>

                        <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200/80 text-[11px] text-amber-800 flex items-start space-x-2">
                          <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <span>Pesanan akan dibuat dengan status menunggu pembayaran dan langsung diteruskan ke dapur setelah lunas.</span>
                        </div>

                        <Button
                          type="submit"
                          className="w-full h-11 bg-brand-orange hover:bg-orange-600 text-white font-black text-xs rounded-2xl shadow-md shadow-orange-500/20"
                        >
                          <span>Buat Pesanan & Lanjut Bayar</span>
                          <ArrowRight className="w-4 h-4 ml-1.5" />
                        </Button>
                      </form>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* TAB C: CO-WORKING & RUANG KERJA (Dedicated Booking) */}
            {/* ---------------------------------------------------- */}
            {activeTab === "COWORKING" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                {/* Header Title & Filter */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Reservasi Ruang Kerja & Meeting Suite</h2>
                    <p className="text-xs text-slate-500">
                      Pilih ruang kerja produktif yang dilengkapi WiFi 100Mbps dan fasilitas kopi/teh.
                    </p>
                  </div>

                  <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none">
                    {[
                      { key: "ALL", label: "Semua Tipe" },
                      { key: "HOT_DESK", label: "Hot Desk" },
                      { key: "DEDICATED_DESK", label: "Dedicated Desk" },
                      { key: "MEETING_ROOM", label: "Meeting Room" },
                      { key: "PRIVATE_POD", label: "Private Pod" },
                    ].map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setSpaceTypeFilter(f.key)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                          spaceTypeFilter === f.key
                            ? "bg-slate-900 text-white"
                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Spaces List Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredSpaces.map((space) => {
                    const isAvailable = space.status === "AVAILABLE";

                    return (
                      <Card
                        key={space.id}
                        className="border-slate-200/90 bg-white shadow-xs hover:shadow-xl hover:-translate-y-1 hover:border-brand-orange/40 transition-all duration-300 rounded-3xl p-6 flex flex-col justify-between space-y-4 group"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <Badge variant="outline" className="text-[10px] font-bold uppercase mb-1 bg-slate-50 text-slate-600 border-slate-200">
                                {space.type.replace("_", " ")}
                              </Badge>
                              <CardTitle className="text-base font-black text-slate-900 group-hover:text-brand-orange transition-colors">
                                {space.name}
                              </CardTitle>
                              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                {space.area}
                              </p>
                            </div>

                            <Badge
                              className={`text-[10px] px-2.5 py-0.5 font-bold ${
                                isAvailable
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                            >
                              {isAvailable ? "Tersedia" : "Terisi"}
                            </Badge>
                          </div>

                          {/* Rates & Capacity */}
                          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold block">Tarif Per Jam</span>
                              <span className="font-black text-slate-900 text-sm">
                                {formatCurrencyIDR(space.hourlyRate)}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 font-bold block">Kapasitas</span>
                              <span className="font-bold text-slate-700 flex items-center space-x-1">
                                <Users className="w-3 h-3 mr-1 text-slate-400" />
                                <span>{space.capacity} Orang</span>
                              </span>
                            </div>
                          </div>

                          {/* Amenities */}
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Fasilitas Termasuk:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {space.amenities.map((a, idx) => (
                                <span key={idx} className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                  • {a}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-xs text-slate-500">
                            {space.dailyRate ? `${formatCurrencyIDR(space.dailyRate)}/hari` : "Fleksibel"}
                          </span>
                          <Button
                            onClick={() => handleOpenBookingModal(space)}
                            size="sm"
                            className="bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs h-9 px-4 rounded-xl shadow-xs"
                          >
                            <span>Booking Sekarang</span>
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>

                {/* Membership Plans Showcase */}
                <div className="pt-8 border-t border-slate-200 space-y-4">
                  <div className="text-center max-w-md mx-auto space-y-1">
                    <Badge className="bg-brand-orange text-white text-[10px] font-bold uppercase">
                      Paket Berlangganan
                    </Badge>
                    <h3 className="font-black text-lg text-slate-900">Paket Keanggotaan Bulanan</h3>
                    <p className="text-xs text-slate-500">Dapatkan kuota akses meja kerja dan diskon eksklusif F&B.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {MEMBERSHIP_PLANS.map((plan: CoworkingMembershipPlan) => (
                      <Card
                        key={plan.id}
                        className={`p-6 rounded-3xl border bg-white shadow-xs flex flex-col justify-between space-y-4 ${
                          plan.popular ? "border-brand-orange ring-2 ring-brand-orange/20" : "border-slate-200"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-black text-base text-slate-900">{plan.name}</span>
                            {plan.popular && (
                              <Badge className="bg-brand-orange text-white text-[9px] font-bold">Populer</Badge>
                            )}
                          </div>
                          <div className="text-2xl font-black text-slate-900">
                            {plan.priceFormatted} <span className="text-xs text-slate-400 font-normal">/ {plan.billingCycle}</span>
                          </div>

                          <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                            <div className="flex items-center space-x-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              <span>{plan.deskAccess}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              <span>{plan.meetingCredits}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-brand-orange" />
                              <span>{plan.fnbPerk}</span>
                            </div>
                          </div>
                        </div>

                        <Button
                          onClick={() => {
                            showToast(`Silakan hubungi resepsionis untuk aktivasi paket ${plan.name}`);
                          }}
                          className="w-full bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs h-9 rounded-xl"
                        >
                          Pilih Paket
                        </Button>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Booking Modal */}
                {isBookingModalOpen && selectedSpaceForBooking && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                      
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                            <Laptop className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="font-black text-lg text-slate-900">Booking Ruang Kerja</h3>
                            <p className="text-[11px] text-slate-500">{selectedSpaceForBooking.name}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setIsBookingModalOpen(false)}
                          className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold"
                        >
                          ✕
                        </button>
                      </div>

                      <form onSubmit={handleCoworkingBookingSubmit} className="space-y-3.5">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700">Tanggal Penggunaan</label>
                          <input
                            type="date"
                            value={bookingDate}
                            onChange={(e) => setBookingDate(e.target.value)}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700">Durasi (Jam)</label>
                            <select
                              value={bookingDuration}
                              onChange={(e) => setBookingDuration(Number(e.target.value))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none"
                            >
                              <option value={1}>1 Jam</option>
                              <option value={2}>2 Jam</option>
                              <option value={3}>3 Jam</option>
                              <option value={4}>4 Jam (Setengah Hari)</option>
                              <option value={8}>8 Jam (Seharian Penuh)</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700">Jumlah Tamu</label>
                            <input
                              type="number"
                              min={1}
                              max={selectedSpaceForBooking.capacity}
                              value={bookingGuests}
                              onChange={(e) => setBookingGuests(Number(e.target.value))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none"
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700">Metode Pembayaran</label>
                          <select
                            value={bookingPaymentMethod}
                            onChange={(e) => setBookingPaymentMethod(e.target.value as "QRIS" | "CASH")}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none"
                          >
                            <option value="QRIS">QRIS Instan (BCA / Mandiri / GoPay / OVO)</option>
                            <option value="CASH">Bayar Tunai di Resepsionis</option>
                          </select>
                        </div>

                        {/* Total Cost Box */}
                        <div className="p-3.5 bg-blue-50/70 rounded-2xl border border-blue-100 space-y-1 text-xs">
                          <div className="flex justify-between text-slate-600">
                            <span>Tarif {selectedSpaceForBooking.name}</span>
                            <span>{formatCurrencyIDR(selectedSpaceForBooking.hourlyRate)} / jam</span>
                          </div>
                          <div className="flex justify-between font-black text-slate-900 pt-1.5 border-t border-blue-200 text-sm">
                            <span>Total Biaya Booking</span>
                            <span className="text-blue-700 font-black">
                              {formatCurrencyIDR(selectedSpaceForBooking.hourlyRate * bookingDuration)}
                            </span>
                          </div>
                        </div>

                        <Button
                          type="submit"
                          className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-2xl shadow-md"
                        >
                          <span>Konfirmasi Booking Ruang</span>
                          <ArrowRight className="w-4 h-4 ml-1.5" />
                        </Button>
                      </form>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* TAB D: PESANAN & BOOKING (Status & Riwayat) */}
            {/* ---------------------------------------------------- */}
            {activeTab === "ORDERS" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                {/* Header Title */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Pelacak Pesanan & Booking Saya</h2>
                    <p className="text-xs text-slate-500">
                      Pantau progres pesanan kuliner F&B dan status reservasi ruang kerja Anda.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={() => handleTabChange("MENU")}
                      size="sm"
                      className="bg-brand-orange text-white hover:bg-orange-600 text-xs font-bold h-9 px-3.5 rounded-xl shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      <span>Menu</span>
                    </Button>
                    <Button
                      onClick={() => handleTabChange("COWORKING")}
                      size="sm"
                      variant="outline"
                      className="text-xs font-bold h-9 px-3.5 rounded-xl border-slate-300"
                    >
                      <Laptop className="w-3.5 h-3.5 mr-1" />
                      <span>Ruang</span>
                    </Button>
                  </div>
                </div>

                {/* Co-working Bookings Section */}
                <div className="space-y-3.5">
                  <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <Laptop className="w-3.5 h-3.5 text-blue-600" />
                    <span>Booking Ruang Kerja Aktif ({customerBookings.length})</span>
                  </h3>

                  {customerBookings.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {customerBookings.map((bk) => {
                        const isPending = bk.paymentStatus === "PENDING";
                        return (
                          <Card key={bk.id} className="p-5 rounded-3xl border border-blue-200/80 bg-white shadow-xs space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-mono text-[10px] text-slate-400 font-bold">{bk.bookingCode}</span>
                                <h4 className="font-black text-base text-slate-900">{bk.spaceName}</h4>
                                <p className="text-xs text-slate-500">{bk.date} &bull; {bk.startTime}</p>
                              </div>
                              <Badge
                                className={`text-[10px] font-bold ${
                                  isPending
                                    ? "bg-amber-100 text-amber-800 border-amber-300 animate-pulse"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                }`}
                              >
                                {isPending ? "Menunggu Pembayaran" : bk.checkInStatus}
                              </Badge>
                            </div>

                            {/* Pending payment banner for Coworking */}
                            {isPending && (
                              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200/90 flex items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                                  <span>Bayar {formatCurrencyIDR(bk.totalAmount)}</span>
                                </span>
                                <div className="flex items-center space-x-1.5">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      cancelBooking(bk.id);
                                      showToast("Booking dibatalkan.");
                                    }}
                                    className="h-7 text-[11px] text-rose-600 border-rose-200 hover:bg-rose-50 rounded-xl"
                                  >
                                    Batalkan
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => {
                                      setWaitingPaymentOrder(null);
                                      setWaitingPaymentBooking(bk);
                                      setIsWaitingPaymentOpen(true);
                                    }}
                                    className="bg-brand-orange hover:bg-orange-600 text-white font-bold text-[11px] h-7 px-3 rounded-xl shadow-xs"
                                  >
                                    <QrCode className="w-3 h-3 mr-1" />
                                    <span>Bayar QRIS</span>
                                  </Button>
                                </div>
                              </div>
                            )}

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                              <span className="text-slate-500">Durasi: <strong>{bk.duration} Jam</strong></span>
                              <span className="font-black text-slate-900">{formatCurrencyIDR(bk.totalAmount)}</span>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-6 text-center bg-white rounded-3xl border border-slate-200 text-xs text-slate-500">
                      Belum ada booking ruang kerja aktif. Silakan pilih di tab <strong>Co-working & Ruang Kerja</strong>.
                    </div>
                  )}
                </div>

                {/* F&B Orders Section */}
                <div className="space-y-3.5 pt-4 border-t border-slate-200">
                  <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-brand-orange" />
                    <span>Pesanan Kuliner F&B Aktif ({activeOrders.length})</span>
                  </h3>

                  {activeOrders.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                      {activeOrders.map((ord) => {
                        const isPendingPayment = ord.paymentStatus === "PENDING";
                        const st = getOrderStatusLabel(ord.status, ord.paymentStatus);
                        return (
                          <Card key={ord.id} className="border-slate-200/90 bg-white shadow-xs p-6 space-y-4 rounded-3xl">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                              <div className="space-y-0.5">
                                <div className="flex items-center space-x-2">
                                  <span className="font-black text-base text-slate-900">{ord.orderNumber}</span>
                                  <Badge className={`${st.color} text-[10px] font-bold shadow-2xs`}>
                                    {st.label}
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-slate-400">
                                  Meja {ord.tableNumber} ({ord.outletName}) &bull; {new Date(ord.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WITA
                                </p>
                              </div>

                              <div className="text-right">
                                <span className="text-[10px] text-slate-400 block font-medium">Total Tagihan</span>
                                <span className="font-black text-base text-brand-orange">
                                  {formatCurrencyIDR(ord.total)}
                                </span>
                              </div>
                            </div>

                            {/* Pending Payment Action Banner */}
                            {isPendingPayment && (
                              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                                <div className="space-y-0.5 text-xs text-amber-950">
                                  <span className="font-bold flex items-center space-x-1.5">
                                    <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                                    <span>Menunggu Pembayaran ({ord.paymentMethod || "QRIS"})</span>
                                  </span>
                                  <p className="text-[11px] text-amber-700">
                                    Pesanan akan mulai dimasak oleh dapur setelah pembayaran berhasil terverifikasi.
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => {
                                    setWaitingPaymentOrder(ord);
                                    setIsWaitingPaymentOpen(true);
                                  }}
                                  className="bg-brand-orange hover:bg-orange-600 text-white font-bold text-xs h-8 px-3.5 rounded-xl shadow-xs shrink-0"
                                >
                                  <QrCode className="w-3.5 h-3.5 mr-1" />
                                  <span>Buka Pembayaran</span>
                                </Button>
                              </div>
                            )}

                            {/* Lifecycle Step Tracker */}
                            <div className="py-2">
                              <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-bold">
                                {[
                                  { key: "NEW", label: "Menunggu", step: 1 },
                                  { key: "KITCHEN_RECEIVED", label: "Dapur", step: 2 },
                                  { key: "COOKING", label: "Dimasak", step: 3 },
                                  { key: "READY", label: "Siap Saji", step: 4 },
                                ].map((stepItem, idx) => {
                                  const isCurrent =
                                    ord.status === stepItem.key ||
                                    (ord.status === "CONFIRMED" && stepItem.key === "KITCHEN_RECEIVED");
                                  const isPassed =
                                    (stepItem.step === 1 && ord.status !== "NEW") ||
                                    (stepItem.step === 2 && (ord.status === "COOKING" || ord.status === "READY" || ord.status === "SERVED")) ||
                                    (stepItem.step === 3 && (ord.status === "READY" || ord.status === "SERVED"));

                                  return (
                                    <div key={idx} className="space-y-1.5">
                                      <div
                                        className={`h-2 rounded-full transition-all duration-500 ${
                                          isCurrent
                                            ? "bg-brand-orange animate-pulse shadow-xs shadow-orange-500/50"
                                            : isPassed
                                            ? "bg-emerald-500"
                                            : "bg-slate-200"
                                        }`}
                                      />
                                      <span
                                        className={
                                          isCurrent
                                            ? "text-brand-orange font-black"
                                            : isPassed
                                            ? "text-emerald-700"
                                            : "text-slate-400"
                                        }
                                      >
                                        {stepItem.label}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Ordered Items list */}
                            <div className="bg-slate-50/80 p-3.5 rounded-2xl space-y-1.5 text-xs border border-slate-100">
                              {ord.items.map((it, idx) => (
                                <div key={idx} className="flex justify-between text-slate-700">
                                  <span>
                                    <strong>{it.quantity}x</strong> {it.productName}
                                  </span>
                                  <span className="font-bold text-slate-900">
                                    {formatCurrencyIDR(it.quantity * it.unitPrice)}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Customer Cancellation Action */}
                            {(ord.status === "NEW" || ord.status === "CONFIRMED" || ord.status === "KITCHEN_RECEIVED") && (
                              <div className="pt-2 border-t border-slate-100">
                                {cancellingOrderId === ord.id ? (
                                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 text-xs text-rose-900 animate-in fade-in">
                                    <p className="font-bold">Batalkan pesanan {ord.orderNumber}?</p>
                                    <p className="text-[11px] text-rose-700">
                                      Pesanan belum mulai dimasak dan meja/kuota akan otomatis dibebaskan.
                                    </p>
                                    <div className="flex space-x-2 justify-end pt-1">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setCancellingOrderId(null)}
                                        className="h-7 text-xs border-slate-300"
                                      >
                                        Kembali
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => handleCancelOrder(ord)}
                                        className="h-7 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs"
                                      >
                                        Ya, Batalkan Pesanan
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] text-slate-400">
                                      Pesanan belum dimasak dapat dibatalkan.
                                    </span>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setCancellingOrderId(ord.id)}
                                      className="h-7 text-[11px] text-rose-600 hover:text-rose-700 border-rose-200 hover:bg-rose-50 font-bold space-x-1 rounded-xl"
                                    >
                                      <X className="w-3 h-3 text-rose-500" />
                                      <span>Batalkan Pesanan</span>
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-6 text-center bg-white rounded-3xl border border-slate-200 text-xs text-slate-500">
                      Tidak ada pesanan F&B aktif saat ini.
                    </div>
                  )}
                </div>

                {/* Past Completed Orders Section */}
                <div className="space-y-3.5 pt-4 border-t border-slate-200">
                  <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Riwayat Pesanan Lampau ({completedOrders.length})</span>
                  </h3>

                  {completedOrders.length > 0 ? (
                    <div className="space-y-3">
                      {completedOrders.map((ord) => (
                        <div
                          key={ord.id}
                          className="p-5 bg-white rounded-3xl border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900">{ord.orderNumber}</span>
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                                Lunas ({ord.paymentMethod || "QRIS"})
                              </Badge>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              {ord.items.map((i) => `${i.quantity}x ${i.productName}`).join(", ")}
                            </p>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end sm:space-x-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                            <span className="font-black text-slate-900 text-sm sm:text-base">
                              {formatCurrencyIDR(ord.total)}
                            </span>
                            <Button
                              onClick={() => {
                                handleTabChange("MENU");
                                showToast("Silakan pilih menu untuk memesan ulang");
                              }}
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs font-bold border-slate-300 hover:bg-slate-50 rounded-xl"
                            >
                              Pesan Lagi
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center bg-white rounded-3xl border border-slate-200 text-xs text-slate-500">
                      Belum ada riwayat transaksi masa lalu.
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* TAB E: LOYALTY & REWARDS (Poin, Tier & Redeem Perk) */}
            {/* ---------------------------------------------------- */}
            {activeTab === "LOYALTY" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                {/* Loyalty Card Header (Guest vs Member) */}
                {!isCustomerLoggedIn ? (
                  <div className="rounded-3xl p-6 sm:p-8 shadow-xl border bg-gradient-to-br from-amber-600 via-orange-600 to-amber-700 text-white space-y-4 relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider opacity-90 block">
                          DagoEng Loyalty Rewards Program
                        </span>
                        <h2 className="text-xl sm:text-2xl font-black text-white">
                          Kumpulkan Poin di Setiap Transaksi ✨
                        </h2>
                        <p className="text-xs text-amber-100 max-w-lg mt-1">
                          Dapatkan 1 poin setiap kelipatan Rp 1.000 transaksi. Tukarkan dengan voucher diskon, promo menu, dan benefit coworking.
                        </p>
                      </div>

                      <Link href={`/login?returnTo=${encodeURIComponent(`/customer?tab=LOYALTY`)}&mode=customer`}>
                        <Button className="bg-white text-orange-700 hover:bg-orange-50 font-bold text-xs h-10 px-5 rounded-xl shadow-md transition-all hover:scale-105 active:scale-95">
                          <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                          <span>Daftar / Masuk Member</span>
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className={`rounded-3xl p-6 sm:p-8 shadow-xl border space-y-4 relative overflow-hidden ${getTierColor(currentMember?.tier || "Bronze")}`}>
                    <div className="flex items-center justify-between relative z-10">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider opacity-90 block">
                          DagoEng Loyalty Rewards
                        </span>
                        <h2 className="text-xl sm:text-3xl font-black text-white">
                          {currentMember?.tier} Member Status
                        </h2>
                      </div>

                      <div className="px-3.5 py-1 rounded-xl text-xs font-black uppercase bg-white/20 backdrop-blur-md border border-white/30 text-white">
                        {currentMember?.tier}
                      </div>
                    </div>

                    <div className="pt-2 flex items-baseline space-x-2 relative z-10">
                      <span className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                        <AnimatedCounter value={currentMember?.points || 0} />
                      </span>
                      <span className="text-xs sm:text-sm text-white/80 font-bold">Total Poin Terkumpul</span>
                    </div>

                    {/* Progress to Next Tier */}
                    {nextTierInfo.pointsNeeded > 0 && (
                      <div className="space-y-2 pt-3 border-t border-white/20 relative z-10">
                        <div className="flex justify-between text-xs text-white/90 font-medium">
                          <span>
                            {nextTierInfo.pointsNeeded} Poin lagi menuju <strong>{nextTierInfo.nextTier}</strong>
                          </span>
                          <span className="font-mono">{nextTierInfo.progress}%</span>
                        </div>
                        <div className="w-full bg-black/20 h-2.5 rounded-full overflow-hidden p-0.5 border border-white/20">
                          <div
                            className="bg-white h-full rounded-full transition-all duration-700 shadow-sm"
                            style={{ width: `${nextTierInfo.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Redeem Vouchers Grid */}
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-black text-base text-slate-900">Katalog Voucher & Reward Poin</h3>
                      <p className="text-xs text-slate-500">Tukarkan poin Anda dengan voucher diskon dan benefit F&B.</p>
                    </div>
                    <Badge variant="outline" className="text-slate-600 bg-white font-bold">
                      {LOYALTY_VOUCHERS.length} Voucher Tersedia
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {LOYALTY_VOUCHERS.map((vouch) => {
                      const canRedeem = (currentMember?.points || 0) >= vouch.pointsCost;
                      return (
                        <Card key={vouch.id} className="border-slate-200/90 bg-white shadow-xs p-5 flex flex-col justify-between space-y-3.5 rounded-3xl hover:border-brand-orange/40 hover:shadow-md transition-all">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="text-[10px] font-black text-brand-orange bg-orange-50 border-orange-200">
                                {vouch.pointsCost === 0 ? "Gratis Tier Perk" : `${vouch.pointsCost} Poin`}
                              </Badge>
                              {vouch.minTier && (
                                <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
                                  Min. {vouch.minTier}
                                </span>
                              )}
                            </div>

                            <h4 className="font-bold text-base text-slate-900 pt-1">{vouch.title}</h4>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                              {vouch.description}
                            </p>
                          </div>

                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-xs font-black text-slate-900">
                              {vouch.discountType === "FIXED"
                                ? `Potongan ${formatCurrencyIDR(vouch.discountValue)}`
                                : `Diskon ${vouch.discountValue}%`}
                            </span>

                            <Button
                              onClick={() => handleRedeemVoucher(vouch)}
                              disabled={!canRedeem && vouch.pointsCost > 0}
                              size="sm"
                              className={`text-xs font-bold h-8 px-4 rounded-xl transition-all ${
                                canRedeem || vouch.pointsCost === 0
                                  ? "bg-brand-orange hover:bg-orange-600 text-white shadow-xs"
                                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
                              }`}
                            >
                              {canRedeem || vouch.pointsCost === 0 ? "Tukar Poin" : "Poin Kurang"}
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* Point History */}
                <div className="space-y-3 pt-4 border-t border-slate-200">
                  <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider">
                    Riwayat Perolehan & Penukaran Poin
                  </h3>

                  {currentMember?.pointHistory && currentMember.pointHistory.length > 0 ? (
                    <div className="bg-white rounded-3xl border border-slate-200/90 divide-y divide-slate-100 overflow-hidden shadow-xs">
                      {currentMember.pointHistory.map((ptx) => (
                        <div key={ptx.id} className="p-4 flex items-center justify-between text-xs hover:bg-slate-50/60 transition-colors">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-900">{ptx.reason}</span>
                            <p className="text-[10px] text-slate-400">
                              {new Date(ptx.timestamp).toLocaleDateString("id-ID", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })} &bull; Saldo: {ptx.balanceAfter} Poin
                            </p>
                          </div>

                          <span
                            className={`font-black text-xs ${
                              ptx.type === "EARN" ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {ptx.type === "EARN" ? `+${ptx.points}` : ptx.points} Pts
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-400">
                      Belum ada catatan transaksi poin.
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* TAB F: PROFILE (Profil, Data Member & QR Card) */}
            {/* ---------------------------------------------------- */}
            {activeTab === "PROFILE" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Member Card Digital QR */}
                  <Card className="md:col-span-1 border-slate-200/90 bg-white shadow-xs p-6 flex flex-col items-center text-center space-y-4 rounded-3xl">
                    <div className="w-16 h-16 rounded-2xl bg-orange-100 text-brand-orange flex items-center justify-center font-black text-xl shadow-xs">
                      {currentMember?.name.slice(0, 2).toUpperCase() || "KD"}
                    </div>

                    <div>
                      <h3 className="font-black text-lg text-slate-900">{currentMember?.name}</h3>
                      <p className="text-xs text-slate-400">{currentMember?.phone}</p>
                    </div>

                    <Badge className="bg-slate-900 text-white text-xs px-3 py-1 font-bold rounded-xl">
                      {currentMember?.tier} Member
                    </Badge>

                    {/* Digital Barcode / QR Simulation */}
                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/90 w-full flex flex-col items-center space-y-2 shadow-2xs">
                      <QrCode className="w-24 h-24 text-slate-900" />
                      <span className="font-mono text-xs font-black text-slate-700 tracking-wider">
                        {currentMember?.id || "MEM-001"}
                      </span>
                      <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                        Tunjukkan QR ini ke kasir saat memesan untuk perolehan poin otomatis.
                      </p>
                    </div>
                  </Card>

                  {/* Profile Information & Stats */}
                  <Card className="md:col-span-2 border-slate-200/90 bg-white shadow-xs p-6 space-y-6 rounded-3xl">
                    <div>
                      <h3 className="font-black text-lg text-slate-900">Informasi Akun Member</h3>
                      <p className="text-xs text-slate-500">Detail keanggotaan dan statistik aktivitas di Dago Creative Hub.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Total Akumulasi Belanja</span>
                        <div className="text-base font-black text-slate-900 block">
                          <AnimatedCounter
                            value={currentMember?.totalSpend || 0}
                            formatter={(v) => formatCurrencyIDR(v)}
                          />
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Total Kunjungan</span>
                        <div className="text-base font-black text-slate-900 block">
                          <AnimatedCounter value={currentMember?.totalVisits || 1} /> Kali
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Cabang Terdaftar</span>
                        <span className="text-xs font-bold text-slate-800 block">
                          {currentMember?.registeredOutletName || "Singaraja"}
                        </span>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Tanggal Bergabung</span>
                        <span className="text-xs font-bold text-slate-800 block">
                          {currentMember?.joinedDate || "12 Jan 2026"}
                        </span>
                      </div>
                    </div>

                    {/* Account Actions */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          await logout();
                          showToast("Anda telah keluar dari sesi member.");
                          router.push("/");
                        }}
                        className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl border-rose-200 flex items-center space-x-1.5"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Keluar Sesi & Ke Beranda</span>
                      </Button>

                      <Link href="/">
                        <Button variant="ghost" size="sm" className="text-xs font-bold text-brand-orange hover:bg-orange-50 rounded-xl">
                          Halaman Utama &rarr;
                        </Button>
                      </Link>
                    </div>
                  </Card>

                </div>

              </div>
            )}
          </>
        )}

        {/* FLOATING CART BUTTON (Active when items are in cart) */}
        {cart.length > 0 && !isCheckoutOpen && activeTab !== "ORDERS" && (
          <div className="fixed bottom-16 sm:bottom-6 right-4 sm:right-8 z-40 animate-in fade-in slide-in-from-bottom-4">
            <Button
              onClick={() => setIsCheckoutOpen(true)}
              className="h-12 px-5 bg-brand-orange hover:bg-orange-600 text-white font-black text-xs rounded-full shadow-2xl flex items-center space-x-3 border-2 border-white transition-all hover:scale-105 active:scale-95"
            >
              <div className="flex items-center space-x-1.5">
                <ShoppingBag className="w-4 h-4" />
                <span className="bg-white text-brand-orange px-1.5 py-0.5 rounded-full text-[10px] font-black">
                  {cartTotalItems}
                </span>
              </div>
              <span>•</span>
              <span>{formatCurrencyIDR(cartGrandTotal)}</span>
              <span>•</span>
              <span className="underline">Lihat Keranjang</span>
            </Button>
          </div>
        )}

      </main>

      {/* 4. BOTTOM MOBILE NAVIGATION BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/90 backdrop-blur-xl border-t border-slate-200/90 py-2 px-3 sm:hidden flex justify-around items-center shadow-lg">
        {[
          { key: "HOME", label: "Home", icon: <Home className="w-4 h-4" /> },
          { key: "MENU", label: "Menu", icon: <UtensilsCrossed className="w-4 h-4" /> },
          { key: "COWORKING", label: "Ruang", icon: <Laptop className="w-4 h-4" /> },
          {
            key: "ORDERS",
            label: "Pesanan",
            icon: <ClipboardList className="w-4 h-4" />,
            badge: activeOrders.length + customerBookings.length > 0 ? activeOrders.length + customerBookings.length : undefined,
          },
          { key: "LOYALTY", label: "Loyalty", icon: <Award className="w-4 h-4" /> },
          { key: "PROFILE", label: "Profil", icon: <User className="w-4 h-4" /> },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key as CustomerTab)}
            className={`flex flex-col items-center py-1 px-2 text-[10px] font-bold transition-all relative ${
              activeTab === t.key
                ? "text-brand-orange scale-105"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.icon}
            <span className="mt-0.5">{t.label}</span>
            {t.badge && (
              <span className="absolute top-0 right-0.5 bg-brand-orange text-white text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 5. PAYMENT WAITING MODAL FOR SELF-ORDER & COWORKING */}
      <PaymentWaitingModal
        isOpen={isWaitingPaymentOpen}
        order={waitingPaymentOrder}
        booking={waitingPaymentBooking}
        onClose={() => {
          setIsWaitingPaymentOpen(false);
          setWaitingPaymentOrder(null);
          setWaitingPaymentBooking(null);
        }}
        onPaymentSuccess={handleUniversalPaymentSuccess}
        onCancelPayment={handleUniversalCancelPayment}
      />

      {/* 6. GUEST AUTHENTICATION & REGISTRATION MODAL (Requirements 4, 5, 6, 7) */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-orange text-white flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">
                    {authModalMode === "REGISTER" ? "Daftar Member & Lanjut Pembayaran" : "Masuk Akun Pelanggan"}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    {pendingActionAfterAuth === "CHECKOUT_FNB"
                      ? "Simpan pesanan & klaim poin loyalty"
                      : pendingActionAfterAuth === "BOOKING_COWORK"
                      ? "Konfirmasi reservasi working space"
                      : "Akses benefit loyalty & riwayat pesanan"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAuthModalOpen(false);
                  setPendingActionAfterAuth(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Toggle Login vs Register */}
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setAuthModalMode("REGISTER")}
                  className={`py-2 rounded-lg transition-all flex items-center justify-center space-x-1 ${
                    authModalMode === "REGISTER" ? "bg-brand-orange text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Daftar (+50 Poin)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAuthModalMode("LOGIN")}
                  className={`py-2 rounded-lg transition-all ${
                    authModalMode === "LOGIN" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Masuk Akun
                </button>
              </div>

              {authModalMode === "REGISTER" ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const name = (form.elements.namedItem("modalName") as HTMLInputElement).value;
                    const phone = (form.elements.namedItem("modalPhone") as HTMLInputElement).value;
                    const email = (form.elements.namedItem("modalEmail") as HTMLInputElement).value;

                    if (!name.trim() || !phone.trim()) return;

                    // Deduplication & Loyalty profile linking (Requirement 7)
                    const member = getOrCreateMember({
                      name: name.trim(),
                      phone: phone.trim(),
                      email: email.trim() || undefined,
                      initialPoints: 50,
                    });

                    await loginCustomer({
                      name: member.name,
                      phone: member.phone,
                      email: member.email,
                    });

                    showToast(`Selamat datang ${member.name}! +50 Poin Bonus Member.`);
                    handleAuthSuccess();
                  }}
                  className="space-y-3"
                >
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Nama Lengkap</label>
                    <Input name="modalName" placeholder="Contoh: I Putu Agus" defaultValue="I Putu Agus" required className="h-10 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Nomor WhatsApp / HP</label>
                    <Input name="modalPhone" type="tel" placeholder="+62 812-xxxx-xxxx" defaultValue="+62 812-3344-5566" required className="h-10 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Email (Opsional)</label>
                    <Input name="modalEmail" type="email" placeholder="nama@email.com" defaultValue="agus@gmail.com" className="h-10 text-xs" />
                  </div>

                  <Button type="submit" className="w-full h-11 bg-brand-orange hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-md">
                    <span>
                      {pendingActionAfterAuth ? "Daftar & Lanjut Pembayaran" : "Daftar & Klaim 50 Poin"}
                    </span>
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </form>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">Pilih akun demo atau gunakan data tersimpan:</p>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await login("CUSTOMER_DEMO");
                        showToast("Masuk sebagai Ketut Dian (Silver Member).");
                        handleAuthSuccess();
                      }}
                      className="w-full p-3 rounded-2xl border border-slate-200 hover:border-brand-orange hover:bg-orange-50/50 flex items-center justify-between text-left transition-all group"
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-black">
                          KD
                        </div>
                        <div>
                          <span className="font-bold text-xs text-slate-900 group-hover:text-brand-orange block">Ketut Dian</span>
                          <span className="text-[10px] text-slate-500">Silver Member • 840 Poin</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-orange" />
                    </button>
                  </div>

                  <div className="pt-2 text-center">
                    <Link
                      href={`/login?returnTo=${encodeURIComponent(`/customer?tab=${activeTab}`)}&mode=customer`}
                      className="text-xs font-bold text-brand-orange hover:underline inline-flex items-center"
                    >
                      <span>Buka Halaman Login Lengkap</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 11. PARTNER SWITCH WARNING MODAL (Requirement: Clear cart on partner switch) */}
      {partnerSwitchModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 mx-auto flex items-center justify-center font-bold">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-black text-base text-slate-900">Ganti Mitra Kuliner?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Keranjang kamu saat ini berisi produk dari <strong className="text-slate-800">{activePartner.name}</strong>. Mengganti mitra akan mengosongkan keranjang. Apakah kamu ingin melanjutkan?
              </p>
            </div>
            <div className="flex items-center space-x-2.5 pt-2">
              <Button
                type="button"
                onClick={() => setPartnerSwitchModal(null)}
                variant="outline"
                className="w-1/2 h-10 text-xs font-bold rounded-xl border-slate-300 hover:bg-slate-50"
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={confirmPartnerSwitch}
                className="w-1/2 h-10 text-xs font-bold bg-brand-orange hover:bg-orange-600 text-white rounded-xl shadow-xs"
              >
                Ganti Mitra
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function CustomerPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="flex flex-col items-center space-y-3">
            <div className="w-8 h-8 border-3 border-brand-orange border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold text-slate-500">Memuat Customer Portal...</span>
          </div>
        </div>
      }
    >
      <CustomerPortalContent />
    </Suspense>
  );
}
