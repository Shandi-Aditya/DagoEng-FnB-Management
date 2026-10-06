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
import { calculateOrderPricing, checkPromoValidity, isPromoEligibleForItem, PromoConfig, validateVoucherCode, calculateCoworkingPricing } from "@/lib/promo";
import { LOYALTY_VOUCHERS } from "@/features/pos/mock-data";
import { MEMBERSHIP_PLANS } from "@/features/coworking/coworking-data";
import { PaymentWaitingModal } from "@/features/payment/PaymentWaitingModal";
import { MasterProduct } from "@/types/product";
import { OrderRecord } from "@/types/order";
import { LoyaltyTier } from "@/types/loyalty";
import { CoworkingSpaceItem, CoworkingMembershipPlan } from "@/types/coworking";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { isTenantActive, getTenantStatus } from "@/lib/tenant";
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
  AlertTriangle,
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
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReceiptModal } from "@/features/pos/ReceiptModal";
import { POSReceiptData } from "@/features/pos/types";
import { CoworkingReceiptModal, CoworkingReceiptData } from "@/features/coworking/CoworkingReceiptModal";

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
    tagline: "Kopi Spesialti & Aneka Minuman",
    desc: "Sajian kopi pilihan dan aneka minuman segar untuk menemani aktivitas Anda.",
    category: "Minuman",
    icon: "☕",
    badge: "Official Mitra Kopi",
  },
  {
    id: "tenant-kitchen",
    name: "Dapur Mama",
    tagline: "Masakan Rumahan & Hidangan Utama",
    desc: "Hidangan utama hangat, aneka olahan nasi, dan lauk lezat khas masakan rumah.",
    category: "Makanan",
    icon: "🍽️",
    badge: "Official Kitchen",
  },
  {
    id: "tenant-bakery",
    name: "Manis Bakery",
    tagline: "Roti, Kue & Pastry Segar",
    desc: "Roti segar, pastry mentega lembut, dan camilan lezat yang dipanggang setiap hari.",
    category: "Camilan",
    icon: "🥐",
    badge: "Fresh Baked Daily",
  },
  {
    id: "tenant-tea",
    name: "Warung Bu Narti",
    tagline: "Kuliner Tradisional & Minuman Nusantara",
    desc: "Aneka seduhan teh segar, minuman rempah tradisional, dan sajian khas nusantara.",
    category: "Minuman",
    icon: "🍃",
    badge: "Mitra Nusantara",
  },
];

type CustomerTab = "HOME" | "MENU" | "COWORKING" | "ORDERS" | "LOYALTY" | "PROFILE";

const COWORKING_TIME_SLOTS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
];

function parseHour(timeStr: string): number {
  if (!timeStr) return 9;
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (match) return parseInt(match[1], 10);
  const matchNum = timeStr.match(/(\d{1,2})/);
  if (matchNum) return parseInt(matchNum[1], 10);
  return 9;
}

function calculateEndTime(startTime: string, durationHours: number): string {
  const startHour = parseHour(startTime);
  const endHour = startHour + durationHours;
  return `${endHour.toString().padStart(2, "0")}:00`;
}

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
  const { areas, filteredAreas, getAvailableTables, releaseTableToAvailable, occupyTableWithOrder } = useTables();
  const { simulateBOMDeduction } = useInventory();
  const { spaces, bookings, bookSpace, confirmBookingPayment, cancelBooking } = useCoworking();
  const { settings } = useSettings();

  const [isMounted, setIsMounted] = useState(false);
  const [tenantSettingsVersion, setTenantSettingsVersion] = useState(0);

  useEffect(() => {
    setIsMounted(true);
    const handleUpdate = () => setTenantSettingsVersion((v) => v + 1);
    window.addEventListener("tenant_settings_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("tenant_settings_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  // Filter only ACTIVE tenants for customer portal visibility (prevent SSR hydration mismatch)
  const activeFnbPartners = useMemo(() => {
    if (!isMounted) return FNB_PARTNERS;
    return FNB_PARTNERS.filter((partner) => isTenantActive(partner.id));
  }, [tenantSettingsVersion, isMounted]);

  const urlPartner = searchParams.get("partner");
  const initialPartnerId =
    urlPartner && FNB_PARTNERS.some((p) => p.id === urlPartner)
      ? urlPartner
      : "tenant-ks";

  // Active Tab initialized directly from URL searchParams
  const [activeTab, setActiveTab] = useState<CustomerTab>(initialTab);

  // Active F&B Partner State (Segmented Mitra Navigation)
  const [activePartnerId, setActivePartnerId] = useState<string>(initialPartnerId);

  // Fallback if active partner becomes inactive
  useEffect(() => {
    if (activeFnbPartners.length > 0 && !activeFnbPartners.some((p) => p.id === activePartnerId)) {
      setActivePartnerId(activeFnbPartners[0].id);
    }
  }, [activeFnbPartners, activePartnerId]);

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
  const [tableNumber, setTableNumber] = useState<string>("");
  const [orderNotes, setOrderNotes] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string>("");

  // Real-time available tables for the active outlet
  const availableCustomerTables = useMemo(() => {
    return getAvailableTables(activeOutletId);
  }, [getAvailableTables, activeOutletId, areas]);

  // Synchronize default tableNumber with real available tables
  useEffect(() => {
    if (availableCustomerTables.length > 0) {
      if (!tableNumber || !availableCustomerTables.some((t) => t.id === tableNumber || t.number === tableNumber)) {
        setTableNumber(availableCustomerTables[0].number || availableCustomerTables[0].id);
      }
    } else {
      setTableNumber("");
    }
  }, [availableCustomerTables, tableNumber]);

  // Co-working Booking Modal State
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedSpaceForBooking, setSelectedSpaceForBooking] = useState<CoworkingSpaceItem | null>(null);
  const [bookingDate, setBookingDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [bookingStartTime, setBookingStartTime] = useState<string>("09:00");
  const [bookingDuration, setBookingDuration] = useState<number>(2); // hours
  const [bookingGuests, setBookingGuests] = useState<number>(1);
  const [bookingPaymentMethod, setBookingPaymentMethod] = useState<"QRIS" | "CASH" | "EDC">("QRIS");
  const [bookingNotes, setBookingNotes] = useState<string>("");

  // Guest Authentication & Interceptor State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"LOGIN" | "REGISTER">("REGISTER");
  const [pendingActionAfterAuth, setPendingActionAfterAuth] = useState<"CHECKOUT_FNB" | "BOOKING_COWORK" | null>(null);

  // Receipt Modal States for Customer Portal
  const [receiptModalFnb, setReceiptModalFnb] = useState<POSReceiptData | null>(null);
  const [isReceiptModalFnbOpen, setIsReceiptModalFnbOpen] = useState<boolean>(false);
  const [receiptModalCowork, setReceiptModalCowork] = useState<CoworkingReceiptData | null>(null);
  const [isReceiptModalCoworkOpen, setIsReceiptModalCoworkOpen] = useState<boolean>(false);

  // React to URL search param changes
  useEffect(() => {
    if (urlTab && ["HOME", "MENU", "COWORKING", "ORDERS", "LOYALTY", "PROFILE"].includes(urlTab)) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  useEffect(() => {
    if (urlPartner && FNB_PARTNERS.some((p) => p.id === urlPartner) && isTenantActive(urlPartner)) {
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

      // Safe fallback synthesized directly from the active user object (NEVER fallback to members[0])
      return {
        id: user.id || `mem-${user.name.toLowerCase().replace(/\s+/g, "-")}`,
        name: user.name,
        phone: user.phone || "",
        email: user.email || "",
        tier: "Bronze" as const,
        points: 0,
        totalSpend: 0,
        totalVisits: 1,
        favoriteItem: "-",
        lastVisit: "-",
        registeredOutletId: activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr",
        registeredOutletName: activeOutlet?.name || "Singaraja",
        status: "ACTIVE" as const,
        joinedDate: new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
        pointHistory: [],
        tierHistory: [],
      };
    }
    return null;
  }, [user, isCustomerLoggedIn, members, activeOutletId, activeOutlet]);

  // Automatically sync outlet scope to customer's registered branch
  useEffect(() => {
    if (currentMember?.registeredOutletId && currentMember.registeredOutletId !== activeOutletId) {
      setOutlet(currentMember.registeredOutletId);
    }
  }, [currentMember, activeOutletId, setOutlet]);

  // Customer Orders (Filtered strictly to logged in customer, empty if Guest)
  const customerOrders = useMemo(() => {
    if (!isCustomerLoggedIn || !user) return [];
    const custName = currentMember?.name?.trim() || user?.name?.trim();
    if (!custName) return [];
    const targetLower = custName.toLowerCase();
    return orders.filter(
      (o) => o.customerName && o.customerName.trim().toLowerCase() === targetLower
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
    if (!isCustomerLoggedIn || !user) return [];
    const custName = currentMember?.name?.trim() || user?.name?.trim();
    if (!custName) return [];
    const targetLower = custName.toLowerCase();
    return bookings.filter(
      (b) => b.guestName && b.guestName.trim().toLowerCase().includes(targetLower)
    );
  }, [bookings, currentMember, user, isCustomerLoggedIn]);

  // Active Partner Object Memo
  const activePartner = useMemo(() => {
    return (
      activeFnbPartners.find((p) => p.id === activePartnerId) ||
      activeFnbPartners[0] ||
      FNB_PARTNERS[0]
    );
  }, [activeFnbPartners, activePartnerId]);

  const handleSelectPartner = (targetPartnerId: string) => {
    setActivePartnerId(targetPartnerId);
    setMenuCatFilter("ALL");
  };

  // Menu Categories scoped to active partner
  const menuCategories = useMemo(() => {
    if (isMounted && !isTenantActive(activePartnerId)) return ["ALL"];
    const partnerProducts = filteredProducts.filter(
      (p) => (p.tenantId || "tenant-ks") === activePartnerId && p.status === "ACTIVE"
    );
    const cats = Array.from(new Set(partnerProducts.map((p) => p.category)));
    return ["ALL", ...cats];
  }, [filteredProducts, activePartnerId, tenantSettingsVersion, isMounted]);

  // Filtered Menu Items scoped to active partner (No mixing of products)
  const filteredMenuItems = useMemo(() => {
    if (isMounted && !isTenantActive(activePartnerId)) return [];
    return filteredProducts.filter((item) => {
      const matchPartner = (item.tenantId || "tenant-ks") === activePartnerId;
      const matchStatus = item.status === "ACTIVE";
      const matchCat = menuCatFilter === "ALL" || item.category === menuCatFilter;
      const matchSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchPartner && matchStatus && matchCat && matchSearch;
    });
  }, [filteredProducts, activePartnerId, menuCatFilter, searchQuery, tenantSettingsVersion, isMounted]);

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

  // Promo Lifecycle & Voucher Codes (AVAILABLE -> CLAIMED -> USED)
  const [claimedPromoIds, setClaimedPromoIds] = useState<string[]>(["promo-dago20"]);
  const [usedPromoIds, setUsedPromoIds] = useState<string[]>([]);
  const [voucherInputCode, setVoucherInputCode] = useState<string>("");
  const [appliedVoucherPromo, setAppliedVoucherPromo] = useState<PromoConfig | null>(null);
  const [voucherValidationMsg, setVoucherValidationMsg] = useState<{ type: "SUCCESS" | "ERROR"; text: string } | null>(null);

  // Co-Working Voucher States
  const [coworkVoucherCode, setCoworkVoucherCode] = useState<string>("");
  const [appliedCoworkPromo, setAppliedCoworkPromo] = useState<PromoConfig | null>(null);
  const [coworkVoucherValidationMsg, setCoworkVoucherValidationMsg] = useState<{ type: "SUCCESS" | "ERROR"; text: string } | null>(null);

  // Cart Calculations
  const cartTotalItems = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const rawCartSubtotal = useMemo(() => {
    return cart.reduce(
      (sum, item) => sum + (Number(item.product.basePrice) || (item.product as any).price || 0) * item.quantity,
      0
    );
  }, [cart]);

  const autoDetectedPromo = useMemo(() => {
    if (!settings?.promos) return undefined;
    for (const promo of settings.promos) {
      if (promo.scope === "COWORKING") continue;
      if (checkPromoValidity(promo, rawCartSubtotal, { scope: "FNB", tenantId: activePartnerId }).isValid) {
        const hasEligible = cart.some((ci) =>
          isPromoEligibleForItem(
            {
              productId: ci.product.id,
              category: ci.product.category,
              tenantId: ci.product.tenantId,
              quantity: ci.quantity,
              unitPrice: Number(ci.product.basePrice) || (ci.product as any).price || 0,
            },
            promo
          )
        );
        if (hasEligible) return promo;
      }
    }
    return undefined;
  }, [settings?.promos, rawCartSubtotal, cart, activePartnerId]);

  const effectiveFnbPromo = useMemo(() => {
    if (appliedVoucherPromo) return appliedVoucherPromo;
    return autoDetectedPromo;
  }, [appliedVoucherPromo, autoDetectedPromo]);

  const selectedVoucher = useMemo(() => {
    return myVouchers.find((v) => v.id === selectedVoucherId);
  }, [myVouchers, selectedVoucherId]);

  const cartPricing = useMemo(() => {
    const items = cart.map((c) => ({
      productId: c.product.id,
      category: c.product.category,
      tenantId: c.product.tenantId,
      quantity: c.quantity,
      unitPrice: Number(c.product.basePrice) || (c.product as any).price || 0,
    }));
    const taxRate = (settings?.taxRatePercent !== undefined ? settings.taxRatePercent : 10) / 100;
    const basePricing = calculateOrderPricing(items, effectiveFnbPromo, taxRate);

    // Apply custom voucher if selected
    if (selectedVoucher) {
      let voucherDisc = 0;
      if (selectedVoucher.discountType === "FIXED") {
        voucherDisc = Math.min(basePricing.originalSubtotal, selectedVoucher.discountValue);
      } else {
        voucherDisc = Math.round((basePricing.originalSubtotal * (selectedVoucher.discountValue || 0)) / 100);
      }
      const newDisc = Math.min(basePricing.originalSubtotal, Math.max(basePricing.discountAmount, voucherDisc));
      const taxable = Math.max(0, basePricing.originalSubtotal - newDisc);
      const tax = Math.round(taxable * taxRate);
      return {
        ...basePricing,
        discountAmount: newDisc,
        subtotalAfterDiscount: taxable,
        tax,
        total: taxable + tax,
      };
    }

    return basePricing;
  }, [cart, effectiveFnbPromo, selectedVoucher, settings?.taxRatePercent]);

  const cartSubtotal = cartPricing.originalSubtotal;
  const cartDiscountAmount = cartPricing.discountAmount;
  const cartTax = cartPricing.tax;
  const cartGrandTotal = cartPricing.total;

  // Voucher validation handlers
  const handleApplyVoucherCode = (codeToApply?: string) => {
    const code = (codeToApply !== undefined ? codeToApply : voucherInputCode).trim();
    if (!code) {
      setAppliedVoucherPromo(null);
      setVoucherValidationMsg(null);
      return;
    }
    const res = validateVoucherCode(code, settings.promos || [], cartSubtotal, {
      customerId: currentMember?.id || user?.id,
      scope: "FNB",
      tenantId: activePartnerId,
    });
    if (res.isValid && res.promo) {
      setAppliedVoucherPromo(res.promo);
      setVoucherValidationMsg({
        type: "SUCCESS",
        text: `Voucher "${res.promo.code || res.promo.name}" aktif! Hemat Rp ${res.discountAmount.toLocaleString("id-ID")}`,
      });
      showToast(`Voucher ${res.promo.code || res.promo.name} berhasil diterapkan!`);
    } else {
      setAppliedVoucherPromo(null);
      setVoucherValidationMsg({
        type: "ERROR",
        text: res.reason || "Voucher tidak valid.",
      });
    }
  };

  const handleApplyCoworkVoucher = (codeToApply?: string) => {
    const code = (codeToApply !== undefined ? codeToApply : coworkVoucherCode).trim();
    if (!code) {
      setAppliedCoworkPromo(null);
      setCoworkVoucherValidationMsg(null);
      return;
    }
    const rate = selectedSpaceForBooking?.hourlyRate || 15000;
    const baseAmount = rate * bookingDuration;
    const res = validateVoucherCode(code, settings.promos || [], baseAmount, {
      customerId: currentMember?.id || user?.id,
      scope: "COWORKING",
    });
    if (res.isValid && res.promo) {
      setAppliedCoworkPromo(res.promo);
      setCoworkVoucherValidationMsg({
        type: "SUCCESS",
        text: `Voucher "${res.promo.code || res.promo.name}" aktif! Hemat Rp ${res.discountAmount.toLocaleString("id-ID")}`,
      });
      showToast(`Voucher ${res.promo.code || res.promo.name} berhasil diterapkan!`);
    } else {
      setAppliedCoworkPromo(null);
      setCoworkVoucherValidationMsg({
        type: "ERROR",
        text: res.reason || "Voucher tidak valid untuk Co-Working.",
      });
    }
  };

  const handleClaimPromo = (promo: PromoConfig) => {
    if (claimedPromoIds.includes(promo.id)) {
      showToast(`Voucher "${promo.code || promo.name}" sudah Anda klaim.`);
      return;
    }
    setClaimedPromoIds((prev) => [...prev, promo.id]);
    showToast(`Berhasil klaim voucher "${promo.code || promo.name}"!`);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  // Cart Operations
  const addToCart = (product: MasterProduct) => {
    if (!product.isAvailable) return;

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

  const executeFnbOrder = (explicitCustomer?: { name: string; phone?: string; email?: string }) => {
    if (cart.length === 0) return;

    // Explicit identity resolution: explicit argument > currentMember > user
    const resolvedName = explicitCustomer?.name?.trim() || currentMember?.name?.trim() || user?.name?.trim();

    if (!resolvedName) {
      showToast("Gagal memproses pesanan: Silakan masuk atau daftar akun terlebih dahulu.");
      setPendingActionAfterAuth("CHECKOUT_FNB");
      setAuthModalMode("REGISTER");
      setIsAuthModalOpen(true);
      return;
    }

    const newOrderItems = cart.map((ci, idx) => ({
      id: `it-${Date.now()}-${idx}`,
      productId: ci.product.id,
      tenantId: ci.product.tenantId,
      productName: ci.product.name,
      quantity: ci.quantity,
      unitPrice: Number(ci.product.basePrice) || (ci.product as any).price || 0,
      modifiers: ci.notes ? [ci.notes] : undefined,
    }));

    // 1. Create order with NEW status & PENDING payment status
    const newOrder = createOrder({
      tableNumber: orderType === "DINE_IN" ? tableNumber : "TAKEAWAY",
      customerName: resolvedName,
      orderType,
      items: newOrderItems,
      subtotal: cartSubtotal,
      tax: cartTax,
      total: cartGrandTotal,
      discount: cartDiscountAmount > 0 ? cartDiscountAmount : undefined,
      promoId: selectedVoucher
        ? selectedVoucher.title
        : effectiveFnbPromo
        ? effectiveFnbPromo.code
          ? `[${effectiveFnbPromo.code}] ${effectiveFnbPromo.name}`
          : effectiveFnbPromo.name
        : undefined,
      outletId: activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr",
      outletName: activeOutlet?.name || "Singaraja",
      status: "NEW",
      paymentStatus: "PENDING",
      paymentMethod: checkoutPaymentMethod,
      notes: orderNotes || undefined,
    });

    if (effectiveFnbPromo) {
      setUsedPromoIds((prev) => [...prev, effectiveFnbPromo.id]);
    }

    // 2. Clear cart & close drawer
    setCart([]);
    setOrderNotes("");
    setVoucherInputCode("");
    setAppliedVoucherPromo(null);
    setVoucherValidationMsg(null);
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

    // Dine-In Table Availability Guard
    if (orderType === "DINE_IN" && (!tableNumber || availableCustomerTables.length === 0)) {
      showToast("Semua meja di outlet ini sedang penuh. Silakan pilih opsi Bawa Pulang (Takeaway).");
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

  // Check availability considering space + date + time range overlap
  const checkSlotAvailability = (
    spaceId: string,
    targetDate: string,
    startHour: number,
    durationHours: number
  ): { isAvailable: boolean; reason?: string; conflictingBooking?: any } => {
    const space = spaces.find((s) => s.id === spaceId);
    const maxCapacity = space?.type === "HOT_DESK" ? (space.capacity || 8) : 1;
    const targetEndHour = startHour + durationHours;

    const activeBookings = bookings.filter(
      (b) =>
        b.spaceId === spaceId &&
        b.date === targetDate &&
        b.checkInStatus !== "CANCELLED"
    );

    for (let h = startHour; h < targetEndHour; h++) {
      const overlapping = activeBookings.filter((b) => {
        const bStart = parseHour(b.startTime);
        const bEnd = bStart + (b.duration || 1);
        return h >= bStart && h < bEnd;
      });

      if (overlapping.length >= maxCapacity) {
        return {
          isAvailable: false,
          reason: "Sudah dibooking",
          conflictingBooking: overlapping[0],
        };
      }
    }

    return { isAvailable: true };
  };

  // Coworking Booking Submission
  const handleOpenBookingModal = (space: CoworkingSpaceItem) => {
    setSelectedSpaceForBooking(space);
    const today = new Date().toISOString().split("T")[0];
    setBookingDate(today);
    setBookingDuration(2);
    setBookingGuests(1);
    setBookingPaymentMethod("QRIS");
    setBookingNotes("");

    // Auto pick first available slot for today
    const firstAvail = COWORKING_TIME_SLOTS.find((slot) => {
      const h = parseHour(slot);
      return checkSlotAvailability(space.id, today, h, 2).isAvailable;
    }) || "09:00";
    setBookingStartTime(firstAvail);

    setIsBookingModalOpen(true);
  };

  const executeCoworkingBooking = (explicitCustomer?: { name: string; phone?: string; email?: string }) => {
    if (!selectedSpaceForBooking) return;

    const resolvedName = explicitCustomer?.name?.trim() || currentMember?.name?.trim() || user?.name?.trim();
    const resolvedPhone = explicitCustomer?.phone?.trim() || currentMember?.phone?.trim() || user?.phone?.trim() || "+62 819-1122-3344";
    const resolvedEmail = explicitCustomer?.email?.trim() || currentMember?.email?.trim() || user?.email?.trim() || "customer@dagoeng.com";

    if (!resolvedName) {
      showToast("Gagal memproses booking: Silakan masuk atau daftar akun terlebih dahulu.");
      setPendingActionAfterAuth("BOOKING_COWORK");
      setAuthModalMode("REGISTER");
      setIsAuthModalOpen(true);
      return;
    }

    // Availability validation guard before confirming booking
    const startH = parseHour(bookingStartTime);
    const availability = checkSlotAvailability(
      selectedSpaceForBooking.id,
      bookingDate,
      startH,
      bookingDuration
    );

    if (!availability.isAvailable) {
      showToast(`Slot waktu ${bookingStartTime} pada ${bookingDate} sudah terisi. Silakan pilih jam lain.`);
      return;
    }

    const rate = selectedSpaceForBooking.hourlyRate || 15000;
    const subtotal = rate * bookingDuration;
    const taxRate = (settings?.taxRatePercent !== undefined ? settings.taxRatePercent : 10) / 100;
    const calc = calculateCoworkingPricing(subtotal, appliedCoworkPromo || undefined, taxRate);

    // 1. Create booking with PENDING payment status (requires payment before use)
    const newBooking = bookSpace({
      spaceId: selectedSpaceForBooking.id,
      spaceName: selectedSpaceForBooking.name,
      spaceType: selectedSpaceForBooking.type,
      guestName: resolvedName,
      guestPhone: resolvedPhone,
      guestEmail: resolvedEmail,
      company: "Member Dago",
      bookingType: "HOURLY",
      date: bookingDate,
      startTime: `${bookingStartTime} WITA`,
      duration: bookingDuration,
      price: subtotal,
      discount: calc.discountAmount,
      totalAmount: calc.total,
      paidAmount: 0,
      remainingAmount: calc.total,
      paymentMethod: bookingPaymentMethod,
      paymentStatus: "PENDING",
      notes: bookingNotes
        ? `${bookingNotes} (${bookingGuests} orang)${appliedCoworkPromo ? ` [Promo: ${appliedCoworkPromo.code || appliedCoworkPromo.name}]` : ""}`
        : `Booking via Customer Portal (${bookingGuests} orang)${appliedCoworkPromo ? ` [Promo: ${appliedCoworkPromo.code || appliedCoworkPromo.name}]` : ""}`,
    });

    if (appliedCoworkPromo) {
      setUsedPromoIds((prev) => [...prev, appliedCoworkPromo.id]);
    }

    setIsBookingModalOpen(false);
    setBookingNotes("");
    setCoworkVoucherCode("");
    setAppliedCoworkPromo(null);
    setCoworkVoucherValidationMsg(null);
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

  const handleAuthSuccess = (customerData?: { name: string; phone?: string; email?: string }) => {
    setIsAuthModalOpen(false);
    if (pendingActionAfterAuth === "CHECKOUT_FNB") {
      setPendingActionAfterAuth(null);
      executeFnbOrder(customerData);
    } else if (pendingActionAfterAuth === "BOOKING_COWORK") {
      setPendingActionAfterAuth(null);
      executeCoworkingBooking(customerData);
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

      {/* 1. CLEAN & NEUTRAL HEADER (No DAGO/Mitra branding logos, focused on neutral navigation & branch) */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/90 sticky top-0 z-30 shadow-xs transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">

          <div className="flex items-center space-x-2.5">
            <div className="flex items-center space-x-1.5 bg-slate-100/90 border border-slate-200/80 px-2.5 py-1.5 rounded-xl text-xs">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-400 text-[11px]">Cabang:</span>
              <span className="font-bold text-slate-800 text-[11px]">
                {currentMember?.registeredOutletName || activeOutlet?.name || "Singaraja (Outlet Utama)"}
              </span>
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
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 ${activeTab === t.key
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
                            Pemesanan Mandiri & Layanan Mitra
                          </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white">
                          Nikmati Sajian Kuliner Mitra & Layanan Terbaik ✨
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                          Pesan makanan & minuman lezat dari mitra favorit Anda atau booking ruang kerja modern. Kumpulkan poin loyalty untuk setiap transaksi.
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

                {/* Promo & Voucher Showcase Section */}
                {settings.promos && settings.promos.filter((p: PromoConfig) => p.isActive).length > 0 && (
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-black text-base text-slate-900 flex items-center space-x-2">
                          <Tag className="w-4 h-4 text-emerald-600" />
                          <span>Promo & Kupon Spesial Hari Ini</span>
                        </h3>
                        <p className="text-xs text-slate-500">Klaim voucher dan gunakan kodenya saat checkout untuk hemat lebih banyak</p>
                      </div>
                      <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 text-[10px] font-bold">
                        {settings.promos.filter((p: PromoConfig) => p.isActive).length} Promo Aktif
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {settings.promos
                        .filter((p: PromoConfig) => p.isActive)
                        .map((promo: PromoConfig) => {
                          const isUsed = usedPromoIds.includes(promo.id);
                          const isClaimed = claimedPromoIds.includes(promo.id);
                          const isCowork = promo.scope === "COWORKING";

                          return (
                            <Card
                              key={promo.id}
                              className="p-4 rounded-3xl border border-slate-200/90 bg-white shadow-xs hover:border-emerald-300 hover:shadow-md transition-all flex flex-col justify-between space-y-3 relative overflow-hidden group"
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-1.5">
                                    <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-mono text-[11px] font-black tracking-wider border border-emerald-200">
                                      {promo.code || promo.name}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className={`text-[9px] font-bold ${
                                        isCowork ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-orange-50 text-orange-700 border-orange-200"
                                      }`}
                                    >
                                      {promo.scope === "COWORKING" ? "Co-Working" : promo.scope === "FNB" ? "Kuliner F&B" : "Semua Layanan"}
                                    </Badge>
                                  </div>

                                  <span className="text-xs font-black text-emerald-600">
                                    {promo.discountType === "PERCENTAGE"
                                      ? `Diskon ${promo.discountValue}%`
                                      : `-${formatCurrencyIDR(promo.discountValue)}`}
                                  </span>
                                </div>

                                <h4 className="font-bold text-xs text-slate-900 line-clamp-1">{promo.name}</h4>
                                <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                                  {promo.description || (promo.discountType === "PERCENTAGE" ? `Potongan ${promo.discountValue}% transaksi` : `Potongan langsung ${formatCurrencyIDR(promo.discountValue)}`)}
                                </p>
                              </div>

                              <div className="space-y-2 pt-2 border-t border-slate-100">
                                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                                  <span>
                                    {promo.minimumAmount ? `Min. Belanja ${formatCurrencyIDR(promo.minimumAmount)}` : "Tanpa Min. Belanja"}
                                  </span>
                                  <span>
                                    {promo.validUntil ? `s.d. ${new Date(promo.validUntil).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}` : "Berlaku Selamanya"}
                                  </span>
                                </div>

                                {isUsed ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled
                                    className="w-full h-8 text-xs font-bold bg-slate-100 text-slate-400 border border-slate-200 rounded-xl cursor-not-allowed"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                    <span>Sudah Digunakan</span>
                                  </Button>
                                ) : isClaimed ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => {
                                      if (isCowork) {
                                        handleTabChange("COWORKING");
                                        setCoworkVoucherCode(promo.code || promo.name);
                                      } else {
                                        handleTabChange("MENU");
                                        setVoucherInputCode(promo.code || promo.name);
                                      }
                                      showToast(`Kode ${promo.code || promo.name} siap digunakan di checkout!`);
                                    }}
                                    className="w-full h-8 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-xl"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                                    <span>Tersimpan &bull; Pakai Sekarang</span>
                                  </Button>
                                ) : (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleClaimPromo(promo)}
                                    className="w-full h-8 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs"
                                  >
                                    <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-400" />
                                    <span>Klaim Voucher</span>
                                  </Button>
                                )}
                              </div>
                            </Card>
                          );
                        })}
                    </div>
                  </div>
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
                    {activeFnbPartners.length === 0 ? (
                      <div className="col-span-full p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-500 text-xs">
                        <UtensilsCrossed className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-bold text-slate-700">Semua mitra F&B sedang tutup sementara.</p>
                        <p className="mt-1 text-slate-400">Silakan periksa kembali nanti atau hubungi staf operasional.</p>
                      </div>
                    ) : (
                      activeFnbPartners.map((partner) => {
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
                      })
                    )}
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

                  </div>

                  {/* Horizontal Segmented Partner Navigation Tabs */}
                  <div className="pt-3 border-t border-slate-100 flex items-center space-x-2 overflow-x-auto scrollbar-none pb-1">
                    {activeFnbPartners.length === 0 ? (
                      <span className="text-xs text-slate-500 font-medium py-1">
                        Tidak ada mitra F&B yang aktif saat ini.
                      </span>
                    ) : (
                      activeFnbPartners.map((partner) => {
                        const isSelected = activePartnerId === partner.id;
                        return (
                          <button
                            key={partner.id}
                            onClick={() => handleSelectPartner(partner.id)}
                            className={`px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all duration-200 flex items-center space-x-2 ${isSelected
                              ? "bg-slate-900 text-white shadow-md shadow-slate-900/20 scale-[1.02]"
                              : "bg-slate-100/90 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                              }`}
                          >
                            <span className="text-sm">{partner.icon}</span>
                            <span>{partner.name}</span>
                          </button>
                        );
                      })
                    )}
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
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 ${menuCatFilter === cat
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
                          className={`bg-white border rounded-3xl p-5 shadow-xs flex flex-col justify-between gap-4 transition-all duration-300 group ${!isAvailable
                            ? "opacity-60 bg-slate-50/80 border-slate-200"
                            : "border-slate-200/90 hover:border-brand-orange/40 hover:shadow-xl hover:-translate-y-1"
                            }`}
                        >
                          <div className="space-y-3">
                            {/* Menu Photo Card Banner */}
                            {item.imageUrl ? (
                              <div className="relative w-full h-36 rounded-2xl overflow-hidden bg-slate-100 border border-slate-100">
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              </div>
                            ) : (
                              <div className="w-full h-24 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50/50 border border-orange-100/50 flex items-center justify-center text-brand-orange/40">
                                <UtensilsCrossed className="w-8 h-8 opacity-40" />
                              </div>
                            )}

                            <div className="space-y-1.5">
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

                              <h3 className="font-bold text-base text-slate-900 group-hover:text-brand-orange transition-colors">{item.name}</h3>
                              <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                                {item.description || "Menu pilihan dibuat dengan bahan berkualitas dan higienis."}
                              </p>
                            </div>
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

                      {/* Cart Items List Grouped by Mitra / Tenant */}
                      <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                        {(() => {
                          const tenantGroups = new Map<string, typeof cart>();
                          cart.forEach((ci) => {
                            const tId = ci.product.tenantId || "tenant-ks";
                            if (!tenantGroups.has(tId)) {
                              tenantGroups.set(tId, []);
                            }
                            tenantGroups.get(tId)!.push(ci);
                          });

                          return Array.from(tenantGroups.entries()).map(([tenantId, items]) => {
                            const partner = FNB_PARTNERS.find((p) => p.id === tenantId);
                            const groupSubtotal = items.reduce(
                              (sum, ci) => sum + (Number(ci.product.basePrice) || (ci.product as any).price || 0) * ci.quantity,
                              0
                            );

                            return (
                              <div key={tenantId} className="p-3 bg-slate-50/90 rounded-2xl border border-slate-200/80 space-y-2">
                                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                                  <div className="flex items-center space-x-1.5">
                                    <span className="text-sm">{partner?.icon || "🍽️"}</span>
                                    <span className="font-black text-xs text-slate-800">
                                      {partner?.name || "Mitra Kuliner"}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-500">
                                    Subtotal: {formatCurrencyIDR(groupSubtotal)}
                                  </span>
                                </div>

                                <div className="space-y-2 divide-y divide-slate-100/80">
                                  {items.map((ci) => {
                                    const itemPrice = Number(ci.product.basePrice) || (ci.product as any).price || 0;
                                    return (
                                      <div key={ci.product.id} className="pt-1.5 first:pt-0 flex items-center justify-between text-xs">
                                        <div className="space-y-0.5">
                                          <span className="font-bold text-slate-900">{ci.product.name}</span>
                                          <p className="text-[11px] text-slate-400">
                                            {ci.quantity} x {formatCurrencyIDR(itemPrice)}
                                          </p>
                                        </div>
                                        <div className="flex items-center space-x-2.5">
                                          <span className="font-black text-slate-900">
                                            {formatCurrencyIDR(itemPrice * ci.quantity)}
                                          </span>
                                          <div className="flex items-center space-x-1 bg-white p-0.5 rounded-lg border border-slate-200">
                                            <button
                                              type="button"
                                              onClick={() => updateCartQty(ci.product.id, -1)}
                                              className="w-5 h-5 bg-slate-100 text-slate-700 rounded flex items-center justify-center text-[10px] font-bold shadow-2xs hover:bg-slate-200"
                                            >
                                              -
                                            </button>
                                            <span className="text-[11px] font-bold px-1.5">{ci.quantity}</span>
                                            <button
                                              type="button"
                                              onClick={() => updateCartQty(ci.product.id, 1)}
                                              className="w-5 h-5 bg-slate-900 text-white rounded flex items-center justify-center text-[10px] font-bold shadow-2xs hover:bg-slate-800"
                                            >
                                              +
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>

                      {/* Order Options Form */}
                      <form onSubmit={handleCheckoutSubmit} className="space-y-3.5 pt-2 border-t border-slate-100">
                        <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                          <button
                            type="button"
                            onClick={() => setOrderType("DINE_IN")}
                            className={`py-2.5 rounded-xl border text-center transition-all ${orderType === "DINE_IN"
                              ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                              : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                              }`}
                          >
                            Makan di Tempat (Dine-In)
                          </button>
                          <button
                            type="button"
                            onClick={() => setOrderType("TAKEAWAY")}
                            className={`py-2.5 rounded-xl border text-center transition-all ${orderType === "TAKEAWAY"
                              ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                              : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                              }`}
                          >
                            Bawa Pulang (Takeaway)
                          </button>
                        </div>

                        {orderType === "DINE_IN" && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-slate-700">Pilih Nomor Meja</label>
                              <span className="text-[10px] text-emerald-600 font-bold font-mono">
                                {availableCustomerTables.length} Meja Siap
                              </span>
                            </div>
                            {availableCustomerTables.length === 0 ? (
                              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
                                ⚠️ Semua meja di {activeOutlet?.name || "outlet ini"} sedang terisi/penuh. Silakan pilih opsi Bawa Pulang (Takeaway) atau hubungi kasir/waiter.
                              </div>
                            ) : (
                              <select
                                value={tableNumber}
                                onChange={(e) => setTableNumber(e.target.value)}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-orange/20"
                              >
                                {filteredAreas.map((area) => {
                                  const areaAvailableTables = area.tables.filter((t) => t.status === "AVAILABLE");
                                  if (areaAvailableTables.length === 0) return null;
                                  return (
                                    <optgroup key={area.id} label={`${area.name} (${area.outletName})`}>
                                      {areaAvailableTables.map((t) => (
                                        <option key={t.id} value={t.number || t.id}>
                                          Meja {t.number || t.id} — Kapasitas {t.cap} Orang
                                        </option>
                                      ))}
                                    </optgroup>
                                  );
                                })}
                              </select>
                            )}
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
                                className={`p-2.5 rounded-xl border text-center transition-all ${checkoutPaymentMethod === pm.id
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

                        {/* Voucher Code Input & Selection */}
                        <div className="space-y-2 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                          <div className="flex items-center justify-between text-xs">
                            <label className="font-bold text-slate-800 flex items-center gap-1.5">
                              <Tag className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Kode Kupon / Voucher Promo</span>
                            </label>
                            {appliedVoucherPromo && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAppliedVoucherPromo(null);
                                  setVoucherInputCode("");
                                  setVoucherValidationMsg(null);
                                }}
                                className="text-[10px] text-rose-600 font-bold hover:underline"
                              >
                                Hapus
                              </button>
                            )}
                          </div>

                          {/* Code input form */}
                          <div className="flex space-x-1.5">
                            <input
                              type="text"
                              placeholder="Masukkan kode: DAGO20"
                              value={voucherInputCode}
                              onChange={(e) => setVoucherInputCode(e.target.value.toUpperCase())}
                              className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold uppercase text-slate-900 placeholder:normal-case placeholder:font-normal placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20"
                            />
                            <Button
                              type="button"
                              onClick={() => handleApplyVoucherCode()}
                              className="h-9 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
                            >
                              Terapkan
                            </Button>
                          </div>

                          {/* Validation feedback message */}
                          {voucherValidationMsg && (
                            <div className={`p-2.5 rounded-xl text-xs font-medium flex items-center space-x-1.5 ${
                              voucherValidationMsg.type === "SUCCESS"
                                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                                : "bg-rose-50 border border-rose-200 text-rose-800"
                            }`}>
                              {voucherValidationMsg.type === "SUCCESS" ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : (
                                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                              )}
                              <span className="text-[11px] leading-tight">{voucherValidationMsg.text}</span>
                            </div>
                          )}

                          {/* Available / Claimed Promos Dropdown */}
                          <div className="pt-1">
                            <select
                              value={appliedVoucherPromo?.id || ""}
                              onChange={(e) => {
                                const selectedId = e.target.value;
                                if (!selectedId) {
                                  setAppliedVoucherPromo(null);
                                  setVoucherValidationMsg(null);
                                  return;
                                }
                                const p = settings.promos?.find((promo) => promo.id === selectedId);
                                if (p) {
                                  setVoucherInputCode(p.code || "");
                                  handleApplyVoucherCode(p.code || p.name);
                                }
                              }}
                              className="w-full p-2 bg-white border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-700 outline-none"
                            >
                              <option value="">-- Pilih dari Voucher Tersedia --</option>
                              {settings.promos
                                ?.filter((p: PromoConfig) => p.isActive && (!p.scope || p.scope === "ALL" || p.scope === "FNB"))
                                .map((p: PromoConfig) => (
                                  <option key={p.id} value={p.id}>
                                    {p.code ? `[${p.code}] ` : ""}🎟️ {p.name} ({p.discountType === "PERCENTAGE" ? `${p.discountValue}%` : formatCurrencyIDR(p.discountValue)})
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>

                        {/* Price Breakdown */}
                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5 text-xs">
                          <div className="flex justify-between text-slate-600">
                            <span>Subtotal Item</span>
                            <span>{formatCurrencyIDR(cartSubtotal)}</span>
                          </div>
                          {cartDiscountAmount > 0 && (
                            <div className="flex justify-between text-emerald-600 font-bold">
                              <span>Diskon Promo {effectiveFnbPromo ? `(${effectiveFnbPromo.code || effectiveFnbPromo.name})` : ""}</span>
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
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${spaceTypeFilter === f.key
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
                          {/* Workspace Photo Banner */}
                          {space.imageUrl ? (
                            <div className="relative w-full h-40 rounded-2xl overflow-hidden bg-slate-100 border border-slate-100">
                              <img
                                src={space.imageUrl}
                                alt={space.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>
                          ) : (
                            <div className="w-full h-28 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-100 flex items-center justify-center text-blue-400">
                              <Laptop className="w-8 h-8 opacity-40" />
                            </div>
                          )}

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
                              className={`text-[10px] px-2.5 py-0.5 font-bold ${isAvailable
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                                }`}
                            >
                              {isAvailable ? "Tersedia" : "Terisi"}
                            </Badge>
                          </div>

                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                            {space.description || "Ruang kerja kondusif dengan fasilitas lengkap."}
                          </p>

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
                        className={`p-6 rounded-3xl border bg-white shadow-xs flex flex-col justify-between space-y-4 ${plan.popular ? "border-brand-orange ring-2 ring-brand-orange/20" : "border-slate-200"
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

                {/* Booking & Checkout Modal for Coworking (Harmonized with F&B Checkout) */}
                {isBookingModalOpen && selectedSpaceForBooking && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200">

                      {/* Header matching F&B */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                            <Laptop className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="font-black text-lg text-slate-900">Konfirmasi Booking Co-working</h3>
                            <p className="text-[11px] text-slate-500">{selectedSpaceForBooking.name} &bull; {selectedSpaceForBooking.area}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setIsBookingModalOpen(false)}
                          className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold transition-all"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Workspace Summary Card */}
                      <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3 text-xs">
                        {selectedSpaceForBooking.imageUrl && (
                          <div className="relative w-full h-28 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                            <img
                              src={selectedSpaceForBooking.imageUrl}
                              alt={selectedSpaceForBooking.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}

                        <div className="flex justify-between items-start">
                          <div>
                            <Badge variant="outline" className="text-[9px] font-bold uppercase mb-1 bg-white text-slate-700 border-slate-200">
                              {selectedSpaceForBooking.type.replace("_", " ")}
                            </Badge>
                            <h4 className="font-black text-sm text-slate-900">{selectedSpaceForBooking.name}</h4>
                            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span>{selectedSpaceForBooking.area} &bull; Kapasitas: {selectedSpaceForBooking.capacity} Orang</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 font-bold block">Tarif Sewa</span>
                            <span className="font-black text-sm text-blue-600">
                              {formatCurrencyIDR(selectedSpaceForBooking.hourlyRate)} <span className="text-[10px] font-normal text-slate-500">/ jam</span>
                            </span>
                          </div>
                        </div>

                        {selectedSpaceForBooking.description && (
                          <p className="text-[11px] text-slate-600 leading-relaxed bg-white p-2 rounded-xl border border-slate-200/80">
                            {selectedSpaceForBooking.description}
                          </p>
                        )}
                      </div>

                      <form onSubmit={handleCoworkingBookingSubmit} className="space-y-3.5 pt-1 border-t border-slate-100">
                        {/* Tanggal & Durasi */}
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>Pilih Tanggal</span>
                            </label>
                            <input
                              type="date"
                              min={new Date().toISOString().split("T")[0]}
                              value={bookingDate}
                              onChange={(e) => setBookingDate(e.target.value)}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20"
                              required
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>Durasi Booking</span>
                            </label>
                            <select
                              value={bookingDuration}
                              onChange={(e) => setBookingDuration(Number(e.target.value))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20"
                            >
                              <option value={1}>1 Jam</option>
                              <option value={2}>2 Jam</option>
                              <option value={3}>3 Jam</option>
                              <option value={4}>4 Jam (Setengah Hari)</option>
                              <option value={8}>8 Jam (Seharian Penuh)</option>
                            </select>
                          </div>
                        </div>

                        {/* Interactive Time Slot Availability Grid */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-blue-600" />
                              <span>Pilih Jam Mulai (Ketersediaan Slot)</span>
                            </label>
                            <span className="text-[10px] text-slate-500 font-medium">
                              Sewa: <strong>{bookingStartTime} &ndash; {calculateEndTime(bookingStartTime, bookingDuration)} WITA</strong>
                            </span>
                          </div>

                          <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                            {COWORKING_TIME_SLOTS.map((slot) => {
                              const startH = parseHour(slot);
                              const avail = checkSlotAvailability(
                                selectedSpaceForBooking.id,
                                bookingDate,
                                startH,
                                bookingDuration
                              );
                              const isSelected = bookingStartTime === slot;

                              return (
                                <button
                                  key={slot}
                                  type="button"
                                  disabled={!avail.isAvailable}
                                  onClick={() => setBookingStartTime(slot)}
                                  className={`py-2 px-1 rounded-xl text-center transition-all flex flex-col items-center justify-center ${
                                    !avail.isAvailable
                                      ? "bg-rose-50/70 border border-rose-200 text-rose-400 cursor-not-allowed opacity-60 line-through"
                                      : isSelected
                                      ? "bg-slate-900 text-white shadow-xs font-black ring-2 ring-slate-900/20 scale-[1.02]"
                                      : "bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300 font-bold"
                                  }`}
                                >
                                  <span className="text-xs font-mono">{slot}</span>
                                  <span className={`text-[8px] font-bold mt-0.5 ${
                                    !avail.isAvailable
                                      ? "text-rose-600 font-black"
                                      : isSelected
                                      ? "text-blue-200"
                                      : "text-emerald-600"
                                  }`}>
                                    {avail.isAvailable ? "Tersedia" : "Sudah Dibooking"}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Jumlah Tamu & Catatan */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700">Jumlah Tamu / Orang</label>
                            <input
                              type="number"
                              min={1}
                              max={selectedSpaceForBooking.capacity}
                              value={bookingGuests}
                              onChange={(e) => setBookingGuests(Number(e.target.value))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20"
                              required
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700">Catatan Booking (Opsional)</label>
                            <input
                              type="text"
                              placeholder="Contoh: Butuh proyektor..."
                              value={bookingNotes}
                              onChange={(e) => setBookingNotes(e.target.value)}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                          </div>
                        </div>

                        {/* Payment Method Selector (Harmonized with F&B) */}
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
                                onClick={() => setBookingPaymentMethod(pm.id as "QRIS" | "CASH" | "EDC")}
                                className={`p-2.5 rounded-xl border text-center transition-all ${
                                  bookingPaymentMethod === pm.id
                                    ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                                }`}
                              >
                                <span className="text-xs font-black block">{pm.label}</span>
                                <span className={`text-[9px] block ${bookingPaymentMethod === pm.id ? "text-slate-300" : "text-slate-400"}`}>
                                  {pm.desc}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Voucher / Promo Code for Co-Working */}
                        <div className="space-y-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                          <div className="flex items-center justify-between text-xs">
                            <label className="font-bold text-slate-800 flex items-center gap-1.5">
                              <Tag className="w-3.5 h-3.5 text-blue-600" />
                              <span>Voucher Promo Co-Working</span>
                            </label>
                            {appliedCoworkPromo && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAppliedCoworkPromo(null);
                                  setCoworkVoucherCode("");
                                  setCoworkVoucherValidationMsg(null);
                                }}
                                className="text-[10px] text-rose-600 font-bold hover:underline"
                              >
                                Hapus
                              </button>
                            )}
                          </div>

                          <div className="flex space-x-1.5">
                            <input
                              type="text"
                              placeholder="Contoh: COWORK50 / DAGO20"
                              value={coworkVoucherCode}
                              onChange={(e) => setCoworkVoucherCode(e.target.value.toUpperCase())}
                              className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold uppercase text-slate-900 placeholder:normal-case placeholder:font-normal placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                            <Button
                              type="button"
                              onClick={() => handleApplyCoworkVoucher()}
                              className="h-9 px-3 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
                            >
                              Terapkan
                            </Button>
                          </div>

                          {coworkVoucherValidationMsg && (
                            <div className={`p-2.5 rounded-xl text-xs font-medium flex items-center space-x-1.5 ${
                              coworkVoucherValidationMsg.type === "SUCCESS"
                                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                                : "bg-rose-50 border border-rose-200 text-rose-800"
                            }`}>
                              {coworkVoucherValidationMsg.type === "SUCCESS" ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : (
                                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                              )}
                              <span className="text-[11px] leading-tight">{coworkVoucherValidationMsg.text}</span>
                            </div>
                          )}

                          <div className="pt-1">
                            <select
                              value={appliedCoworkPromo?.id || ""}
                              onChange={(e) => {
                                const selectedId = e.target.value;
                                if (!selectedId) {
                                  setAppliedCoworkPromo(null);
                                  setCoworkVoucherValidationMsg(null);
                                  return;
                                }
                                const p = settings.promos?.find((promo) => promo.id === selectedId);
                                if (p) {
                                  setCoworkVoucherCode(p.code || "");
                                  handleApplyCoworkVoucher(p.code || p.name);
                                }
                              }}
                              className="w-full p-2 bg-white border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-700 outline-none"
                            >
                              <option value="">-- Pilih Promo Co-Working Tersedia --</option>
                              {settings.promos
                                ?.filter((p: PromoConfig) => p.isActive && (!p.scope || p.scope === "ALL" || p.scope === "COWORKING"))
                                .map((p: PromoConfig) => (
                                  <option key={p.id} value={p.id}>
                                    {p.code ? `[${p.code}] ` : ""}🎟️ {p.name} ({p.discountType === "PERCENTAGE" ? `${p.discountValue}%` : formatCurrencyIDR(p.discountValue)})
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>

                        {/* Price Breakdown Card (Harmonized with F&B) */}
                        {(() => {
                          const baseRate = (selectedSpaceForBooking?.hourlyRate || 15000) * bookingDuration;
                          const taxRate = (settings?.taxRatePercent !== undefined ? settings.taxRatePercent : 10) / 100;
                          const calc = calculateCoworkingPricing(baseRate, appliedCoworkPromo || undefined, taxRate);
                          return (
                            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5 text-xs">
                              <div className="flex justify-between text-slate-600">
                                <span>Sewa {selectedSpaceForBooking.name} ({bookingDuration} Jam)</span>
                                <span>{formatCurrencyIDR(calc.originalSubtotal)}</span>
                              </div>
                              {calc.discountAmount > 0 && (
                                <div className="flex justify-between text-emerald-600 font-bold">
                                  <span>Diskon Promo {appliedCoworkPromo ? `(${appliedCoworkPromo.code || appliedCoworkPromo.name})` : ""}</span>
                                  <span>-{formatCurrencyIDR(calc.discountAmount)}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-slate-600">
                                <span>Pajak Layanan PB1 ({settings.taxRatePercent}%)</span>
                                <span>{formatCurrencyIDR(calc.tax)}</span>
                              </div>
                              <div className="flex justify-between font-black text-slate-900 pt-2 border-t border-slate-200 text-sm">
                                <span>Total Biaya Booking</span>
                                <span className="text-blue-600 font-black">
                                  {formatCurrencyIDR(calc.total)}
                                </span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Security Notice (Harmonized with F&B) */}
                        <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200/80 text-[11px] text-blue-900 flex items-start space-x-2">
                          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                          <span>Booking akan dibuat dengan status reservasi dan ruangan siap digunakan setelah pembayaran terverifikasi.</span>
                        </div>

                        {/* Action Button (Harmonized with F&B) */}
                        <Button
                          type="submit"
                          className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-2xl shadow-md"
                        >
                          <span>Buat Booking & Lanjut Bayar</span>
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
                                className={`text-[10px] font-bold ${isPending
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
                              <div className="flex items-center space-x-2">
                                <span className="font-black text-slate-900">{formatCurrencyIDR(bk.totalAmount)}</span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const [startH, startM] = (bk.startTime || "09:00").split(":").map(Number);
                                    const endH = (startH + (bk.duration || 1)) % 24;
                                    const endTime = `${endH.toString().padStart(2, "0")}:${(startM || 0).toString().padStart(2, "0")}`;
                                    setReceiptModalCowork({
                                      bookingCode: bk.bookingCode || bk.id,
                                      transactionDate: `${bk.date}, ${bk.startTime || "09:00"} WITA`,
                                      guestName: bk.guestName,
                                      guestPhone: bk.guestPhone,
                                      guestEmail: bk.guestEmail,
                                      company: bk.company,
                                      spaceName: bk.spaceName,
                                      spaceType: bk.spaceType,
                                      outletName: (bk as any).outletName || activeOutlet?.name || "Singaraja",
                                      outletAddress: "Jl. Veteran No. 18, Singaraja, Bali",
                                      outletPhone: "(0362) 23456",
                                      bookingDate: bk.date,
                                      startTime: bk.startTime,
                                      endTime,
                                      duration: bk.duration,
                                      bookingType: bk.bookingType || "HOURLY",
                                      basePrice: bk.totalAmount,
                                      totalAmount: bk.totalAmount,
                                      paymentMethod: bk.paymentMethod || "QRIS",
                                      paymentStatus: bk.paymentStatus || "PAID",
                                      notes: bk.notes,
                                    });
                                    setIsReceiptModalCoworkOpen(true);
                                  }}
                                  className="h-7 text-[10px] font-bold text-slate-700 hover:bg-slate-100 flex items-center space-x-1"
                                >
                                  <Receipt className="w-3 h-3 text-slate-500" />
                                  <span>Bukti Nota</span>
                                </Button>
                              </div>
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
                                        className={`h-2 rounded-full transition-all duration-500 ${isCurrent
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

                            {/* Receipt & Cancellation Actions */}
                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setReceiptModalFnb({
                                    orderNumber: ord.orderNumber,
                                    date: new Date(ord.createdAt).toLocaleDateString("id-ID", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    }),
                                    cashierName: "Kasir / Self-Order Online",
                                    outletName: ord.outletName ? `Kopi Senja — ${ord.outletName}` : "Dago Creative Hub",
                                    outletAddress: "Jl. Veteran No. 18, Singaraja, Bali",
                                    outletPhone: "(0362) 23456",
                                    tableNumber: ord.tableNumber,
                                    customerName: ord.customerName,
                                    orderType: (ord.orderType as any) || "DINE_IN",
                                    items: ord.items.map((i) => ({
                                      name: i.productName,
                                      quantity: i.quantity,
                                      unitPrice: i.unitPrice,
                                      subtotal: i.quantity * i.unitPrice,
                                      modifiers: i.modifiers,
                                      notes: i.notes,
                                      tenantId: i.tenantId,
                                      tenantName: i.tenantId ? FNB_PARTNERS.find((p) => p.id === i.tenantId)?.name : undefined,
                                    })),
                                    subtotal: ord.subtotal,
                                    tax: ord.tax || 0,
                                    serviceCharge: 0,
                                    promoName: ord.promoId,
                                    discount: ord.discount || 0,
                                    grandTotal: ord.total,
                                    paymentMethod: (ord.paymentMethod as any) || "QRIS",
                                    amountPaid: ord.total,
                                    changeDue: 0,
                                  });
                                  setIsReceiptModalFnbOpen(true);
                                }}
                                className="h-7 text-[10px] font-bold text-slate-700 hover:bg-slate-100 flex items-center space-x-1"
                              >
                                <Receipt className="w-3 h-3 text-slate-500" />
                                <span>Lihat Nota Struk</span>
                              </Button>
                            </div>

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

                          <div className="flex items-center justify-between sm:justify-end sm:space-x-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                            <span className="font-black text-slate-900 text-sm sm:text-base">
                              {formatCurrencyIDR(ord.total)}
                            </span>
                            <div className="flex items-center space-x-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setReceiptModalFnb({
                                    orderNumber: ord.orderNumber,
                                    date: new Date(ord.createdAt).toLocaleDateString("id-ID", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    }),
                                    cashierName: "Kasir / Self-Order Online",
                                    outletName: ord.outletName ? `Kopi Senja — ${ord.outletName}` : "Dago Creative Hub",
                                    outletAddress: "Jl. Veteran No. 18, Singaraja, Bali",
                                    outletPhone: "(0362) 23456",
                                    tableNumber: ord.tableNumber,
                                    customerName: ord.customerName,
                                    orderType: (ord.orderType as any) || "DINE_IN",
                                    items: ord.items.map((i) => ({
                                      name: i.productName,
                                      quantity: i.quantity,
                                      unitPrice: i.unitPrice,
                                      subtotal: i.quantity * i.unitPrice,
                                      modifiers: i.modifiers,
                                      notes: i.notes,
                                      tenantId: i.tenantId,
                                      tenantName: i.tenantId ? FNB_PARTNERS.find((p) => p.id === i.tenantId)?.name : undefined,
                                    })),
                                    subtotal: ord.subtotal,
                                    tax: ord.tax || 0,
                                    serviceCharge: 0,
                                    promoName: ord.promoId,
                                    discount: ord.discount || 0,
                                    grandTotal: ord.total,
                                    paymentMethod: (ord.paymentMethod as any) || "QRIS",
                                    amountPaid: ord.total,
                                    changeDue: 0,
                                  });
                                  setIsReceiptModalFnbOpen(true);
                                }}
                                className="h-8 text-xs font-bold border-slate-300 hover:bg-slate-50 rounded-xl flex items-center space-x-1"
                              >
                                <Receipt className="w-3.5 h-3.5 text-slate-500" />
                                <span>Nota</span>
                              </Button>
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
                              className={`text-xs font-bold h-8 px-4 rounded-xl transition-all ${canRedeem || vouch.pointsCost === 0
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
                            className={`font-black text-xs ${ptx.type === "EARN" ? "text-emerald-600" : "text-rose-600"
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
            className={`flex flex-col items-center py-1 px-2 text-[10px] font-bold transition-all relative ${activeTab === t.key
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
                  className={`py-2 rounded-lg transition-all flex items-center justify-center space-x-1 ${authModalMode === "REGISTER" ? "bg-brand-orange text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Daftar (+50 Poin)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAuthModalMode("LOGIN")}
                  className={`py-2 rounded-lg transition-all ${authModalMode === "LOGIN" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
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
                    handleAuthSuccess({
                      name: member.name,
                      phone: member.phone,
                      email: member.email,
                    });
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
                        const demoCustomer = DEMO_PERSONAS.CUSTOMER_DEMO;
                        showToast("Masuk sebagai Ketut Dian (Silver Member).");
                        handleAuthSuccess({
                          name: demoCustomer.name,
                          phone: demoCustomer.phone || undefined,
                          email: demoCustomer.email || undefined,
                        });
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



      {/* 12. SUBTLE FOOTER (Powered by DAGO) */}
      <footer className="w-full py-6 mt-12 border-t border-slate-200/70 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
        <span>Powered by</span>
        <Image
          src="/logo-dago.png"
          alt="DAGO"
          width={14}
          height={18}
          className="inline-block object-contain opacity-75"
        />
        <span className="font-bold text-slate-700"></span>
      </footer>

      {/* 13. RECEIPT MODALS (F&B and Co-Working) */}
      {isReceiptModalFnbOpen && receiptModalFnb && (
        <ReceiptModal
          order={receiptModalFnb}
          onClose={() => {
            setIsReceiptModalFnbOpen(false);
            setReceiptModalFnb(null);
          }}
        />
      )}

      {isReceiptModalCoworkOpen && receiptModalCowork && (
        <CoworkingReceiptModal
          booking={receiptModalCowork}
          onClose={() => {
            setIsReceiptModalCoworkOpen(false);
            setReceiptModalCowork(null);
          }}
        />
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
