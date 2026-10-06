"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOutlet } from "@/contexts/OutletContext";
import { useOrders } from "@/contexts/OrderContext";
import { useTables } from "@/contexts/TableContext";
import { useInventory } from "@/contexts/InventoryContext";
import { useProducts } from "@/contexts/ProductContext";
import { useLoyalty } from "@/contexts/LoyaltyContext";
import { useActivityLog } from "@/contexts/ActivityLogContext";
import { useSettings } from "@/contexts/SettingsContext";
import { calculateOrderPricing, calculateCoworkingPricing, validateVoucherCode, PromoConfig } from "@/lib/promo";
import { LOYALTY_VOUCHERS } from "@/features/pos/mock-data";
import { useCoworking } from "@/contexts/CoworkingContext";
import { CoworkingReceiptModal, CoworkingReceiptData } from "@/features/coworking/CoworkingReceiptModal";
import { CoworkingSpaceItem, SpaceType } from "@/types/coworking";
import {
  POSProductItem,
  POSCartItem,
  POSPaymentMethod,
  POSReceiptData,
  SplitGuestBill,
  LoyaltyVoucher,
} from "@/features/pos/types";
import { ModifierModal } from "@/features/pos/ModifierModal";
import { PaymentModal } from "@/features/pos/PaymentModal";
import { ReceiptModal } from "@/features/pos/ReceiptModal";
import { formatCurrencyIDR } from "@/lib/utils";
import { isTenantActive, DEFAULT_FNB_TENANTS, getTenantName } from "@/lib/tenant";
import {
  Calculator,
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Lock,
  Utensils,
  Sparkles,
  CheckCircle2,
  Tag,
  ArrowRight,
  Crown,
  Ticket,
  X,
  Percent,
  AlertTriangle,
  Ban,
  Store,
  Laptop,
  Calendar,
  Clock,
  MapPin,
  Users,
  Check,
  User,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

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

export default function POSPage() {
  const { user } = useAuth();
  const { activeOutlet, activeOutletId } = useOutlet();
  const { createPosOrder } = useOrders();
  const { getAvailableTables, occupyTableWithOrder, areas, filteredAreas } = useTables();
  const { simulateBOMDeduction, checkProductStockStatus } = useInventory();
  const { filteredProducts: masterProducts, categories } = useProducts();
  const { filteredMembers: membersList, addPoints, redeemPoints } = useLoyalty();
  const { logActivity } = useActivityLog();
  const { settings } = useSettings();
  const { spaces: cwSpaces, bookings: cwBookings, bookSpace: cwBookSpace } = useCoworking();

  // Mode: FNB vs COWORKING
  const [posMode, setPosMode] = useState<"FNB" | "COWORKING">("FNB");

  // Co-Working Specific States
  const [cwSelectedSpaceId, setCwSelectedSpaceId] = useState<string>("");
  const [cwSpaceTypeFilter, setCwSpaceTypeFilter] = useState<string>("ALL");
  const [cwSearchQuery, setCwSearchQuery] = useState<string>("");
  const [cwDate, setCwDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [cwStartTime, setCwStartTime] = useState<string>("09:00");
  const [cwDuration, setCwDuration] = useState<number>(2); // hours
  const [cwCustomerType, setCwCustomerType] = useState<"MEMBER" | "WALK_IN">("MEMBER");
  const [cwMemberId, setCwMemberId] = useState<string>("");
  const [cwGuestName, setCwGuestName] = useState<string>("");
  const [cwGuestPhone, setCwGuestPhone] = useState<string>("");
  const [cwGuestEmail, setCwGuestEmail] = useState<string>("");
  const [cwNotes, setCwNotes] = useState<string>("");
  const [cwPaymentMethod, setCwPaymentMethod] = useState<POSPaymentMethod>("QRIS");
  const [cwVoucherCode, setCwVoucherCode] = useState<string>("");
  const [cwAppliedPromo, setCwAppliedPromo] = useState<PromoConfig | null>(null);
  const [cwVoucherValidationMsg, setCwVoucherValidationMsg] = useState<{ type: "SUCCESS" | "ERROR"; text: string } | null>(null);
  const [lastCoworkReceiptData, setLastCoworkReceiptData] = useState<CoworkingReceiptData | null>(null);
  const [isCoworkReceiptModalOpen, setIsCoworkReceiptModalOpen] = useState<boolean>(false);

  const [tenantSettingsVersion, setTenantSettingsVersion] = useState(0);

  useEffect(() => {
    const handleTenantUpdate = () => setTenantSettingsVersion((v) => v + 1);
    window.addEventListener("tenant_settings_updated", handleTenantUpdate);
    window.addEventListener("storage", handleTenantUpdate);
    return () => {
      window.removeEventListener("tenant_settings_updated", handleTenantUpdate);
      window.removeEventListener("storage", handleTenantUpdate);
    };
  }, []);

  // Filter Active Mitra (Tenant) - Priority Filter Utama
  const activeTenants = useMemo(() => {
    return DEFAULT_FNB_TENANTS.filter((t) => isTenantActive(t.id));
  }, [tenantSettingsVersion]);

  // Primary Filter: Selected Mitra/Tenant
  const [selectedTenantId, setSelectedTenantId] = useState<string>("ALL");

  // Secondary Filter: Category & Search
  const [selectedCategory, setSelectedCategory] = useState<string>("Semua Kategori");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Cart & Order Settings
  const [cartItems, setCartItems] = useState<POSCartItem[]>([]);
  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKEAWAY">("DINE_IN");
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [selectedPromoId, setSelectedPromoId] = useState<string>("");

  // Loyalty & Voucher States
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [appliedVoucher, setAppliedVoucher] = useState<LoyaltyVoucher | null>(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState<boolean>(false);

  // Tax Settings State
  const [isTaxEnabled, setIsTaxEnabled] = useState<boolean>(true);
  const [taxRatePercent, setTaxRatePercent] = useState<number>(settings.taxRatePercent ?? 10);
  const [isTaxSettingsModalOpen, setIsTaxSettingsModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (settings.taxRatePercent !== undefined) {
      setTaxRatePercent(settings.taxRatePercent);
    }
  }, [settings.taxRatePercent]);

  // Modal States
  const [activeProductForCustomization, setActiveProductForCustomization] = useState<POSProductItem | null>(null);
  const [isModifierModalOpen, setIsModifierModalOpen] = useState<boolean>(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [lastReceiptData, setLastReceiptData] = useState<POSReceiptData | null>(null);
  const [posToast, setPosToast] = useState<string>("");

  // Real-time Available Tables for the Selected Outlet Scope ONLY
  const availableTables = useMemo(() => {
    return getAvailableTables(activeOutletId);
  }, [getAvailableTables, activeOutletId, areas]);

  // Set default table when available tables change
  useEffect(() => {
    if (availableTables.length > 0) {
      if (!selectedTable || !availableTables.some((t) => t.id === selectedTable || t.number === selectedTable)) {
        setSelectedTable(availableTables[0].number || availableTables[0].id);
      }
    } else {
      setSelectedTable("");
    }
  }, [availableTables, selectedTable]);

  // Selected Member Object
  const selectedMember = useMemo(() => {
    return membersList.find((m) => m.id === selectedMemberId) || null;
  }, [membersList, selectedMemberId]);

  // Convert Master Products to POS format with Live Stock Status & Tenant Active Guard
  const posProducts = useMemo(() => {
    // Strictly filter out products from inactive F&B partners
    const activeTenantProducts = masterProducts.filter((prod) => {
      const tenantId = prod.tenantId || "tenant-ks";
      return isTenantActive(tenantId);
    });

    return activeTenantProducts.map((prod) => {
      const stockCheck = checkProductStockStatus(prod.name);
      return {
        id: prod.id,
        tenantId: prod.tenantId,
        name: prod.name,
        category: prod.category,
        basePrice: prod.basePrice,
        cogs: prod.cogsEstimate,
        margin: prod.grossMarginPercent,
        description: prod.description,
        imageUrl: prod.imageUrl,
        stockStatus: stockCheck.status,
        stockLabel: stockCheck.label,
        isAvailable: prod.status === "ACTIVE" && stockCheck.status !== "OUT_OF_STOCK",
        variants: prod.variants || [
          { name: "Regular", priceAdjustment: 0 },
          { name: "Large (+5k)", priceAdjustment: 5000 },
        ],
        modifierGroups: [
          {
            id: "mod-sugar",
            name: "Level Gula",
            isRequired: false,
            minSelect: 0,
            maxSelect: 1,
            options: [
              { name: "Normal Sugar (100%)", price: 0, priceAdjustment: 0 },
              { name: "Less Sugar (50%)", price: 0, priceAdjustment: 0 },
              { name: "No Sugar (0%)", price: 0, priceAdjustment: 0 },
            ],
          },
          {
            id: "mod-milk",
            name: "Pilihan Susu",
            isRequired: false,
            minSelect: 0,
            maxSelect: 1,
            options: [
              { name: "Fresh Milk Standard", price: 0, priceAdjustment: 0 },
              { name: "Oat Milk (+Rp 8.000)", price: 8000, priceAdjustment: 8000 },
            ],
          },
        ],
      };
    });
  }, [masterProducts, checkProductStockStatus, tenantSettingsVersion]);

  // 1. Scoped to Selected Mitra (Primary Filter)
  const tenantScopedProducts = useMemo(() => {
    if (selectedTenantId === "ALL") return posProducts;
    return posProducts.filter((p) => (p.tenantId || "tenant-ks") === selectedTenantId);
  }, [posProducts, selectedTenantId]);

  // 2. Dynamic Categories for the chosen Mitra (Secondary Filter)
  const categoryTabs = useMemo(() => {
    const cats = Array.from(new Set(tenantScopedProducts.map((p) => p.category)));
    return ["Semua Kategori", ...cats];
  }, [tenantScopedProducts]);

  // Fallback category if selected category is not in the scoped categories
  useEffect(() => {
    if (selectedCategory !== "Semua Kategori" && !categoryTabs.includes(selectedCategory)) {
      setSelectedCategory("Semua Kategori");
    }
  }, [categoryTabs, selectedCategory]);

  // 3. Final Filtered Products based on search, tenant, and category
  const filteredProducts = useMemo(() => {
    return tenantScopedProducts.filter((prod) => {
      const matchCat = selectedCategory === "Semua Kategori" || prod.category === selectedCategory;
      const matchQuery =
        prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prod.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [tenantScopedProducts, selectedCategory, searchQuery]);

  // Calculations
  const activePromo = useMemo(() => {
    if (!settings.promos || !selectedPromoId) return undefined;
    return settings.promos.find((p: PromoConfig) => p.id === selectedPromoId);
  }, [settings.promos, selectedPromoId]);

  const cartPricing = useMemo(() => {
    const items = cartItems.map((c) => {
      const prod = posProducts.find(p => p.id === c.productId);
      return { 
        productId: c.productId,
        category: prod?.category,
        tenantId: c.tenantId,
        quantity: c.quantity, 
        unitPrice: c.unitFinalPrice 
      };
    });
    // We pass taxRate=0 because we calculate tax locally in POS
    return calculateOrderPricing(items, activePromo, 0);
  }, [cartItems, activePromo, posProducts]);

  const subtotal = cartPricing.originalSubtotal;
  const promoDiscountAmount = Math.round(cartPricing.discountAmount);

  const voucherDiscountAmount = useMemo(() => {
    if (!appliedVoucher) return 0;
    if (appliedVoucher.discountType === "FIXED") {
      return Math.min(subtotal, Number(appliedVoucher.discountValue) || 0);
    } else {
      return Math.round((subtotal * (Number(appliedVoucher.discountValue) || 0)) / 100);
    }
  }, [appliedVoucher, subtotal]);

  const totalDiscount = promoDiscountAmount + voucherDiscountAmount;
  const taxableAmount = Math.max(0, subtotal - totalDiscount);
  const taxPB1 = isTaxEnabled ? Math.round(taxableAmount * ((Number(taxRatePercent) || 0) / 100)) : 0;
  const serviceCharge = orderType === "DINE_IN" ? Math.round(taxableAmount * ((Number(settings.serviceChargePercent) || 0) / 100)) : 0;
  const grandTotal = Math.max(0, taxableAmount + taxPB1 + serviceCharge);

  // Handle Product Card Click -> Open Customization Modal
  const handleSelectProduct = (product: any) => {
    if (!product.isAvailable || product.stockStatus === "OUT_OF_STOCK") {
      return; // Disabled for out of stock products
    }
    setActiveProductForCustomization(product);
    setIsModifierModalOpen(true);
  };

  // Add Item to Cart
  const handleAddToCart = (item: POSCartItem) => {
    setCartItems((prev) => {
      const existingIdx = prev.findIndex(
        (i) =>
          i.productId === item.productId &&
          i.selectedVariant?.name === item.selectedVariant?.name &&
          i.notes === item.notes &&
          JSON.stringify(i.selectedModifiers.map((m) => m.name).sort()) ===
          JSON.stringify(item.selectedModifiers.map((m) => m.name).sort())
      );

      if (existingIdx > -1) {
        const updated = [...prev];
        const exist = updated[existingIdx];
        const newQty = exist.quantity + item.quantity;
        updated[existingIdx] = {
          ...exist,
          quantity: newQty,
          itemTotal: exist.unitFinalPrice * newQty,
        };
        return updated;
      }

      return [...prev, item];
    });
  };

  const handleUpdateQuantity = (cartItemId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.cartItemId !== cartItemId) return item;
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          return {
            ...item,
            quantity: newQty,
            itemTotal: item.unitFinalPrice * newQty,
          };
        })
        .filter(Boolean) as POSCartItem[]
    );
  };

  const handleRemoveItem = (cartItemId: string) => {
    setCartItems((prev) => prev.filter((i) => i.cartItemId !== cartItemId));
  };

  const handleSelectMember = (memberId: string) => {
    setSelectedMemberId(memberId);
    if (!memberId) {
      setAppliedVoucher(null);
      return;
    }
    const mem = membersList.find((m) => m.id === memberId);
    if (mem) {
      setCustomerName(mem.name);
      if (appliedVoucher && mem.points < appliedVoucher.pointsCost) {
        setAppliedVoucher(null);
      }
    }
  };

  const handleApplyVoucher = (voucher: LoyaltyVoucher) => {
    if (!selectedMember) return;
    if (selectedMember.points < voucher.pointsCost) return;

    if (appliedVoucher?.id === voucher.id) {
      setAppliedVoucher(null);
    } else {
      setAppliedVoucher(voucher);
    }
    setIsVoucherModalOpen(false);
  };

  // Process Successful Payment & Complete Business Actions
  const handlePaymentSuccess = (paymentData: {
    method: POSPaymentMethod;
    amountPaid: number;
    changeDue: number;
    splitDetails?: SplitGuestBill[];
  }) => {
    setIsPaymentModalOpen(false);

    const nowFormatted = new Date().toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const receiptNo = `INV-${new Date().getFullYear()}${(new Date().getMonth() + 1)
      .toString()
      .padStart(2, "0")}${new Date().getDate().toString().padStart(2, "0")}-${Math.floor(
        1000 + Math.random() * 9000
      )}`;

    const effectiveCustomerName = customerName.trim() || (orderType === "DINE_IN" ? `Tamu Meja ${selectedTable}` : "Pelanggan Takeaway");

    // 1. Create Live POS Order in OrderContext
    const createdOrder = createPosOrder({
      tableNumber: orderType === "DINE_IN" ? selectedTable : "TAKEAWAY",
      customerName: effectiveCustomerName,
      orderType,
      subtotal,
      discount: totalDiscount,
      promoId: selectedPromoId || undefined,
      tax: taxPB1 + serviceCharge,
      total: grandTotal,
      paymentMethod: paymentData.method === "CASH" ? "CASH" : paymentData.method === "EDC" ? "EDC" : "QRIS",
      items: cartItems.map((c, i) => ({
        id: `pos-it-${i}-${Date.now()}`,
        productId: c.productId,
        tenantId: c.tenantId,
        productName: c.productName,
        quantity: c.quantity,
        unitPrice: c.unitFinalPrice,
        modifiers: [
          ...(c.selectedVariant ? [c.selectedVariant.name] : []),
          ...c.selectedModifiers.map((m) => m.name),
        ],
        notes: c.notes,
      })),
    });

    // 2. Cross-Module: Auto-deduct inventory ingredients based on Recipe BOM
    cartItems.forEach((item) => {
      simulateBOMDeduction(item.productName, item.quantity);
    });

    // 3. Cross-Module: If Dine-in, occupy table in TableContext
    if (orderType === "DINE_IN" && selectedTable) {
      occupyTableWithOrder(selectedTable, {
        customerName: effectiveCustomerName,
        totalFormatted: formatCurrencyIDR(grandTotal),
        itemsCount: cartItems.reduce((s, i) => s + i.quantity, 0),
        orderId: createdOrder.id,
      });
    }

    // 4. Cross-Module: Update Loyalty points and tier calculation
    let loyaltyReceiptInfo = undefined;
    if (selectedMember) {
      if (appliedVoucher) {
        redeemPoints(selectedMember.id, appliedVoucher.pointsCost, `Voucher "${appliedVoucher.title}" pada ${receiptNo}`);
      }
      const earnedPoints = Math.floor(grandTotal / 1000); // 1 pt per Rp 1.000 spend
      addPoints(selectedMember.id, earnedPoints, `Transaksi POS #${receiptNo}`, createdOrder.id);

      loyaltyReceiptInfo = {
        name: selectedMember.name,
        tier: selectedMember.tier,
        pointsUsed: appliedVoucher ? appliedVoucher.pointsCost : 0,
        pointsRemaining: selectedMember.points - (appliedVoucher ? appliedVoucher.pointsCost : 0) + earnedPoints,
        voucherTitle: appliedVoucher?.title,
      };
    }

    // 6. Audit Trail Logging
    logActivity({
      module: "POS",
      action: "PAYMENT_SUCCESS",
      recordId: receiptNo,
      newValue: `Total: Rp ${grandTotal.toLocaleString()} (${paymentData.method}) - Bayar: Rp ${paymentData.amountPaid.toLocaleString()}`,
      description: `Pembayaran transaksi kasir POS ${receiptNo} berhasil`,
      reason: `Pembayaran kasir selesai via ${paymentData.method}`,
      status: "SUCCESS",
    });

    // 7. Prepare Receipt Data
    const receipt: POSReceiptData = {
      orderNumber: receiptNo,
      date: nowFormatted,
      cashierName: user?.name || "Kasir Bertugas",
      outletName: activeOutlet?.name ? `Kopi Senja — ${activeOutlet.name}` : "Dago Creative Hub",
      outletAddress: "Jl. Veteran No. 18, Singaraja, Bali",
      outletPhone: "(0362) 23456",
      tableNumber: selectedTable,
      customerName: effectiveCustomerName,
      orderType,
      items: cartItems.map((item) => ({
        name: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitFinalPrice,
        subtotal: item.itemTotal,
        variantName: item.selectedVariant?.name,
        modifiers: item.selectedModifiers.map((m) => m.name),
        notes: item.notes,
        tenantId: item.tenantId,
        tenantName: getTenantName(item.tenantId),
      })),
      subtotal,
      tax: taxPB1,
      serviceCharge,
      promoName: activePromo?.name || (appliedVoucher ? appliedVoucher.title : undefined),
      discount: totalDiscount,
      grandTotal,
      paymentMethod: paymentData.method,
      amountPaid: paymentData.amountPaid,
      changeDue: paymentData.changeDue,
      splitDetails: paymentData.splitDetails,
      loyaltyMember: loyaltyReceiptInfo,
    };

    setLastReceiptData(receipt);
    setIsReceiptModalOpen(true);
  };

  const handleStartNewTransaction = () => {
    setIsReceiptModalOpen(false);
    setCartItems([]);
    setCustomerName("");
    setSelectedMemberId("");
    setAppliedVoucher(null);
    setSelectedPromoId("");
    setSearchQuery("");
    setSelectedCategory("Semua Menu");
    setSelectedTable("");
    setOrderType("DINE_IN");
    setPosToast("Sesi transaksi baru aktif! Keranjang belanja dan formulir kasir telah di-reset bersih.");
    setTimeout(() => setPosToast(""), 3500);
  };

  // ==========================================
  // CO-WORKING COMPUTATIONS & HANDLERS
  // ==========================================
  const selectedSpace = useMemo(() => {
    return cwSpaces.find((s) => s.id === cwSelectedSpaceId) || cwSpaces[0] || null;
  }, [cwSpaces, cwSelectedSpaceId]);

  useEffect(() => {
    if (cwSpaces.length > 0 && !cwSelectedSpaceId) {
      setCwSelectedSpaceId(cwSpaces[0].id);
    }
  }, [cwSpaces, cwSelectedSpaceId]);

  const filteredCwSpaces = useMemo(() => {
    return cwSpaces.filter((sp) => {
      const matchType = cwSpaceTypeFilter === "ALL" || sp.type === cwSpaceTypeFilter;
      const matchSearch =
        sp.name.toLowerCase().includes(cwSearchQuery.toLowerCase()) ||
        sp.area.toLowerCase().includes(cwSearchQuery.toLowerCase()) ||
        sp.amenities.some((a) => a.toLowerCase().includes(cwSearchQuery.toLowerCase()));
      return matchType && matchSearch;
    });
  }, [cwSpaces, cwSpaceTypeFilter, cwSearchQuery]);

  const checkSlotAvailability = (
    spaceId: string,
    targetDate: string,
    startHour: number,
    durationHours: number
  ): { isAvailable: boolean; reason?: string; conflictingBooking?: any } => {
    const space = cwSpaces.find((s) => s.id === spaceId);
    const maxCapacity = space?.type === "HOT_DESK" ? (space.capacity || 8) : 1;
    const targetEndHour = startHour + durationHours;

    const activeBookings = cwBookings.filter(
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

  const cwSelectedMember = useMemo(() => {
    return membersList.find((m) => m.id === cwMemberId) || null;
  }, [membersList, cwMemberId]);

  const cwBaseAmount = useMemo(() => {
    if (!selectedSpace) return 0;
    return (selectedSpace.hourlyRate || 15000) * cwDuration;
  }, [selectedSpace, cwDuration]);

  const cwTaxRate = isTaxEnabled ? (taxRatePercent || 10) / 100 : 0;
  const cwPricing = useMemo(() => {
    return calculateCoworkingPricing(cwBaseAmount, cwAppliedPromo || undefined, cwTaxRate);
  }, [cwBaseAmount, cwAppliedPromo, cwTaxRate]);

  const handleApplyCoworkVoucher = (codeToApply?: string) => {
    const code = (codeToApply !== undefined ? codeToApply : cwVoucherCode).trim();
    if (!code) {
      setCwAppliedPromo(null);
      setCwVoucherValidationMsg(null);
      return;
    }
    const res = validateVoucherCode(code, settings.promos || [], cwBaseAmount, {
      customerId: cwSelectedMember?.id,
      scope: "COWORKING",
    });
    if (res.isValid && res.promo) {
      setCwAppliedPromo(res.promo);
      setCwVoucherValidationMsg({
        type: "SUCCESS",
        text: `Voucher "${res.promo.code || res.promo.name}" aktif! Hemat ${formatCurrencyIDR(res.discountAmount)}`,
      });
      setPosToast(`Voucher ${res.promo.code || res.promo.name} berhasil diterapkan!`);
    } else {
      setCwAppliedPromo(null);
      setCwVoucherValidationMsg({
        type: "ERROR",
        text: res.reason || "Voucher tidak valid untuk Co-Working.",
      });
    }
  };

  const handleCompleteCoworkingPayment = () => {
    if (!selectedSpace) {
      setPosToast("Silakan pilih workspace terlebih dahulu.");
      return;
    }

    let effectiveGuestName = "";
    let effectiveGuestPhone = "";
    let effectiveGuestEmail = "";

    if (cwCustomerType === "MEMBER") {
      if (!cwSelectedMember) {
        setPosToast("Silakan pilih member terdaftar dari daftar.");
        return;
      }
      effectiveGuestName = cwSelectedMember.name;
      effectiveGuestPhone = cwSelectedMember.phone;
      effectiveGuestEmail = cwSelectedMember.email || "";
    } else {
      if (!cwGuestName.trim()) {
        setPosToast("Silakan isi nama tamu walk-in.");
        return;
      }
      effectiveGuestName = cwGuestName.trim();
      effectiveGuestPhone = cwGuestPhone.trim() || "-";
      effectiveGuestEmail = cwGuestEmail.trim() || "-";
    }

    const startH = parseHour(cwStartTime);
    const avail = checkSlotAvailability(selectedSpace.id, cwDate, startH, cwDuration);
    if (!avail.isAvailable) {
      setPosToast(`Slot waktu ${cwStartTime} (${cwDuration} Jam) pada tanggal ${cwDate} sudah tidak tersedia/penuh.`);
      return;
    }

    const createdBooking = cwBookSpace({
      guestName: effectiveGuestName,
      guestPhone: effectiveGuestPhone,
      guestEmail: effectiveGuestEmail,
      company: "Walk-in / POS Kasir",
      spaceId: selectedSpace.id,
      spaceName: selectedSpace.name,
      spaceType: selectedSpace.type,
      bookingType: "HOURLY",
      date: cwDate,
      startTime: cwStartTime,
      duration: cwDuration,
      price: cwPricing.originalSubtotal,
      discount: cwPricing.discountAmount,
      totalAmount: cwPricing.total,
      paymentMethod: cwPaymentMethod,
      paidAmount: cwPricing.total,
      remainingAmount: 0,
      paymentStatus: "PAID",
      fnbVoucherApplied: cwAppliedPromo?.code,
      notes: cwNotes || undefined,
    });

    if (cwCustomerType === "MEMBER" && cwSelectedMember) {
      const earnedPoints = Math.floor(cwPricing.total / 1000);
      if (earnedPoints > 0) {
        addPoints(cwSelectedMember.id, earnedPoints, `Booking Coworking #${createdBooking.bookingCode}`);
      }
    }

    logActivity({
      module: "COWORKING",
      action: "PAYMENT_SUCCESS",
      recordId: createdBooking.bookingCode,
      newValue: `Booking: ${selectedSpace.name} - ${effectiveGuestName} (${formatCurrencyIDR(cwPricing.total)} via ${cwPaymentMethod})`,
      description: `Transaksi booking Co-working ${createdBooking.bookingCode} berhasil di Kasir`,
      reason: `Pembayaran kasir selesai via ${cwPaymentMethod}`,
      status: "SUCCESS",
    });

    const endTimeFormatted = calculateEndTime(cwStartTime, cwDuration);
    const coworkReceipt: CoworkingReceiptData = {
      bookingCode: createdBooking.bookingCode,
      transactionDate: new Date().toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) + " WITA",
      guestName: effectiveGuestName,
      guestPhone: effectiveGuestPhone,
      guestEmail: effectiveGuestEmail,
      company: "Personal / POS Kasir",
      spaceName: selectedSpace.name,
      spaceType: selectedSpace.type,
      outletName: activeOutlet?.name ? `Kopi Senja — ${activeOutlet.name}` : "Dago Creative Hub",
      outletAddress: "Jl. Veteran No. 18, Singaraja, Bali",
      outletPhone: "(0362) 23456",
      bookingDate: cwDate,
      startTime: cwStartTime,
      endTime: endTimeFormatted,
      duration: cwDuration,
      bookingType: "HOURLY",
      basePrice: cwPricing.originalSubtotal,
      discount: cwPricing.discountAmount > 0 ? cwPricing.discountAmount : undefined,
      promoTitle: cwAppliedPromo ? (cwAppliedPromo.code ? `[${cwAppliedPromo.code}] ${cwAppliedPromo.name}` : cwAppliedPromo.name) : undefined,
      tax: cwPricing.tax > 0 ? cwPricing.tax : 0,
      serviceCharge: 0,
      totalAmount: cwPricing.total,
      paymentMethod: cwPaymentMethod,
      paymentStatus: "PAID",
      notes: cwNotes || undefined,
    };

    setLastCoworkReceiptData(coworkReceipt);
    setIsCoworkReceiptModalOpen(true);
    setPosToast(`Booking ${createdBooking.bookingCode} berhasil diproses!`);
  };

  return (
    <div className="space-y-4">
      {/* POS Toast Notification */}
      {posToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 flex items-center space-x-2 animate-in fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{posToast}</span>
        </div>
      )}

      {/* Top Bar with POS Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Calculator className="w-5 h-5 text-brand-orange" />
            <h2 className="text-lg font-bold text-slate-900">
              Point of Sale (POS) Kasir — {activeOutlet?.name || "Singaraja"}
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Kasir Bertugas: <strong className="text-slate-800">{user?.name}</strong> • Scope:{" "}
            <strong className="text-brand-orange font-mono">{activeOutlet?.name || "Singaraja"}</strong>
          </p>
        </div>

        {/* Mode Switcher & Tax Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* POS Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setPosMode("FNB")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                posMode === "FNB"
                  ? "bg-brand-orange text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Kuliner F&B</span>
              {cartItems.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-white text-brand-orange rounded-full text-[10px] font-black">
                  {cartItems.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setPosMode("COWORKING")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                posMode === "COWORKING"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>Co-Working & Ruang Kerja</span>
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsTaxSettingsModalOpen(true)}
            className={`text-xs font-semibold space-x-1.5 ${
              isTaxEnabled
                ? "border-emerald-300 text-emerald-800 bg-emerald-50/50"
                : "border-slate-300 text-slate-500"
            }`}
          >
            <Percent className="w-3.5 h-3.5" />
            <span>Pajak: {isTaxEnabled ? `PB1 ${taxRatePercent}%` : "Non-Aktif"}</span>
          </Button>

          <Button
            size="sm"
            onClick={handleStartNewTransaction}
            className="text-xs font-bold space-x-1 bg-slate-900 hover:bg-slate-800 text-white shadow-sm active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Transaksi Baru</span>
          </Button>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 1. F&B TRANSACTION MODE */}
      {/* ==================================================== */}
      {posMode === "FNB" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-in fade-in duration-200">
        {/* Left Catalog (Col 7 / 12) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* Search, Primary Mitra Filter, & Secondary Category Tabs */}
          <div className="space-y-3.5 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari menu, SKU, atau kategori..."
                className="w-full pl-10 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange shadow-2xs"
              />
            </div>

            {/* 1. Primary Filter: Mitra F&B Navigation Buttons */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span className="flex items-center space-x-1">
                  <Store className="w-3.5 h-3.5 text-brand-orange" />
                  <span>Pilih Mitra F&B:</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  {activeTenants.length} Mitra Aktif
                </span>
              </div>

              <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedTenantId("ALL")}
                  className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all duration-200 flex items-center space-x-1.5 ${
                    selectedTenantId === "ALL"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900"
                  }`}
                >
                  <span>🏢</span>
                  <span>Semua Mitra</span>
                </button>

                {activeTenants.map((tenant) => {
                  const isSelected = selectedTenantId === tenant.id;
                  return (
                    <button
                      key={tenant.id}
                      type="button"
                      onClick={() => setSelectedTenantId(tenant.id)}
                      className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all duration-200 flex items-center space-x-1.5 ${
                        isSelected
                          ? "bg-slate-900 text-white shadow-sm"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900"
                      }`}
                    >
                      <span className="text-sm">{tenant.icon}</span>
                      <span>{tenant.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Secondary Filter: Category Sub-Pills */}
            {categoryTabs.length > 1 && (
              <div className="pt-2 border-t border-slate-100 flex items-center space-x-1.5 overflow-x-auto pb-0.5 text-xs no-scrollbar">
                <span className="text-[10px] font-semibold text-slate-400 mr-1 flex-shrink-0">Kategori:</span>
                {categoryTabs.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                      selectedCategory === cat
                        ? "bg-brand-orange text-white shadow-2xs"
                        : "bg-slate-50 border border-slate-200/80 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Cards Grid with Live Stock Status & Disabled Out of Stock */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredProducts.map((product) => {
              const isOutOfStock = product.stockStatus === "OUT_OF_STOCK" || !product.isAvailable;
              const isCriticalStock = product.stockStatus === "CRITICAL";

              return (
                <div
                  key={product.id}
                  onClick={() => handleSelectProduct(product)}
                  className={`p-3 rounded-xl border transition-all flex flex-col justify-between relative overflow-hidden ${isOutOfStock
                      ? "bg-slate-100/80 border-slate-300 opacity-60 cursor-not-allowed select-none"
                      : "bg-white border-slate-200 hover:border-brand-orange hover:shadow-md cursor-pointer group"
                    }`}
                >
                  {/* Stock Status Badge */}
                  {isOutOfStock ? (
                    <div className="absolute top-2 right-2 z-10 bg-rose-600 text-white text-[9px] font-extrabold px-2 py-0.5 rounded shadow-sm flex items-center space-x-1">
                      <Ban className="w-2.5 h-2.5" />
                      <span>Habis</span>
                    </div>
                  ) : isCriticalStock ? (
                    <div className="absolute top-2 right-2 z-10 bg-amber-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-sm flex items-center space-x-1">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      <span>Stok Menipis</span>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    {product.imageUrl ? (
                      <div className="relative w-full h-24 rounded-lg overflow-hidden bg-slate-100 border border-slate-100">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-16 rounded-lg bg-slate-100 border border-slate-100 flex items-center justify-center text-slate-400">
                        <Utensils className="w-6 h-6 opacity-30" />
                      </div>
                    )}

                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                        {product.category}
                      </span>
                      <h4 className={`font-bold text-xs line-clamp-2 transition-colors ${isOutOfStock ? "text-slate-500" : "text-slate-900 group-hover:text-brand-orange"
                        }`}>
                        {product.name}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                    <span className="font-extrabold text-xs text-slate-900 font-mono">
                      {formatCurrencyIDR(product.basePrice)}
                    </span>
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${isOutOfStock
                        ? "bg-slate-200 text-slate-400"
                        : "bg-slate-100 group-hover:bg-brand-orange group-hover:text-white text-slate-600"
                      }`}>
                      <Plus className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Cart & Checkout Panel (Col 5 / 12) */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col flex-1 overflow-hidden">
            {/* Cart Header & Dine-In / Takeaway Toggle */}
            <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/70">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShoppingCart className="w-4 h-4 text-brand-orange" />
                  <span className="font-bold text-xs text-slate-900">
                    Keranjang Pesanan ({cartItems.reduce((s, i) => s + i.quantity, 0)} item)
                  </span>
                </div>

                {/* Dine-In vs Takeaway */}
                <div className="flex items-center bg-slate-200 p-0.5 rounded-lg text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setOrderType("DINE_IN")}
                    className={`px-2 py-0.5 rounded-md transition-all ${orderType === "DINE_IN"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600"
                      }`}
                  >
                    Dine In
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType("TAKEAWAY")}
                    className={`px-2 py-0.5 rounded-md transition-all ${orderType === "TAKEAWAY"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600"
                      }`}
                  >
                    Takeaway
                  </button>
                </div>
              </div>

              {/* Table Selector (Strictly AVAILABLE tables only) */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {orderType === "DINE_IN" ? (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 flex items-center justify-between">
                      <span>Pilih Meja Tersedia:</span>
                      <span className="text-[9px] text-emerald-600 font-bold font-mono">
                        {availableTables.length} Siap
                      </span>
                    </label>
                    {availableTables.length === 0 ? (
                      <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-[10px] text-rose-700 font-bold">
                        ⚠️ Semua meja terisi/reservasi!
                      </div>
                    ) : (
                      <select
                        value={selectedTable}
                        onChange={(e) => setSelectedTable(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white focus:outline-none focus:ring-1 focus:ring-brand-orange"
                      >
                        {filteredAreas.map((area) => {
                          const areaAvailableTables = area.tables.filter((t) => t.status === "AVAILABLE");
                          if (areaAvailableTables.length === 0) return null;
                          return (
                            <optgroup key={area.id} label={`${area.name} (${area.outletName})`}>
                              {areaAvailableTables.map((t) => (
                                <option key={t.id} value={t.number || t.id}>
                                  Meja {t.number || t.id} (Kapasitas {t.cap} Org)
                                </option>
                              ))}
                            </optgroup>
                          );
                        })}
                      </select>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Nomor Antrean:</label>
                    <input
                      type="text"
                      disabled
                      value="Antrean #A-14"
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-slate-100 text-slate-700"
                    />
                  </div>
                )}

                {/* Loyalty Member Selector */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 flex items-center justify-between">
                    <span>Member Loyalty:</span>
                    <Crown className="w-3 h-3 text-amber-500" />
                  </label>
                  <select
                    value={selectedMemberId}
                    onChange={(e) => handleSelectMember(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-medium focus:outline-none focus:ring-1 focus:ring-brand-orange"
                  >
                    <option value="">Guest (Non-Member)</option>
                    {membersList.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.tier} - {m.points} Pts)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Member Points Card & Voucher Trigger */}
              {selectedMember && (
                <div className="p-2.5 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 rounded-xl border border-amber-200 text-xs flex items-center justify-between shadow-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-1.5 font-bold text-slate-900">
                      <span className="text-amber-800">👑 {selectedMember.name}</span>
                      <span className="text-[9px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-mono">
                        {selectedMember.tier}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Saldo Poin: <strong className="font-mono text-brand-orange">{selectedMember.points} Pts</strong>
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setIsVoucherModalOpen(true)}
                    className="text-[10px] h-7 px-2.5 font-bold space-x-1 bg-white border-amber-300 text-amber-900 hover:bg-amber-100"
                  >
                    <Ticket className="w-3 h-3 text-brand-orange" />
                    <span>{appliedVoucher ? "Ubah Voucher" : "Klaim Voucher"}</span>
                  </Button>
                </div>
              )}

              {/* Active Voucher Tag */}
              {appliedVoucher && (
                <div className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg border border-emerald-200 text-xs">
                  <div className="flex items-center space-x-1.5 text-emerald-900 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{appliedVoucher.title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAppliedVoucher(null)}
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Cart Items List */}
            <div className="p-4 overflow-y-auto max-h-[280px] space-y-3 flex-1 divide-y divide-slate-100">
              {cartItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <ShoppingCart className="w-8 h-8 mx-auto stroke-[1.5] text-slate-300" />
                  <p className="text-xs font-medium">Keranjang masih kosong.</p>
                  <p className="text-[11px] text-slate-400">
                    Pilih menu di samping untuk menambahkan pesanan.
                  </p>
                </div>
              ) : (
                cartItems.map((item) => (
                  <div key={item.cartItemId} className="pt-3 first:pt-0 space-y-1 text-xs">
                    <div className="flex items-start justify-between">
                      <div>
                        <h5 className="font-bold text-slate-900">{item.productName}</h5>
                        {item.selectedVariant && (
                          <span className="text-[10px] text-brand-orange font-semibold block">
                            • {item.selectedVariant.name}
                          </span>
                        )}
                        {item.selectedModifiers.length > 0 && (
                          <span className="text-[10px] text-slate-500 block">
                            • {item.selectedModifiers.map((m) => m.name).join(", ")}
                          </span>
                        )}
                        {item.notes && (
                          <span className="text-[10px] italic text-slate-400 block">
                            *{item.notes}
                          </span>
                        )}
                      </div>

                      <span className="font-bold font-mono text-slate-900">
                        {formatCurrencyIDR(item.itemTotal)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.cartItemId)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center space-x-1.5 bg-slate-100 rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.cartItemId, -1)}
                          className="w-5 h-5 rounded flex items-center justify-center text-slate-600 hover:bg-white active:scale-95"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center text-xs font-bold font-mono">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.cartItemId, 1)}
                          className="w-5 h-5 rounded flex items-center justify-center text-slate-600 hover:bg-white active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Calculations & Checkout Trigger */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
              {/* Promo & Voucher Code Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-700 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-emerald-600" />
                    <span>Promo / Voucher Diskon</span>
                  </span>
                  {selectedPromoId && (
                    <button
                      type="button"
                      onClick={() => setSelectedPromoId("")}
                      className="text-[10px] text-rose-600 hover:underline font-bold"
                    >
                      Hapus Promo
                    </button>
                  )}
                </div>
                <select
                  value={selectedPromoId}
                  onChange={(e) => setSelectedPromoId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-medium focus:outline-none focus:ring-1 focus:ring-brand-orange"
                >
                  <option value="">-- Pilih Promo / Masukkan Kode --</option>
                  {settings.promos?.filter((p: PromoConfig) => p.isActive && (!p.scope || p.scope === "ALL" || p.scope === "FNB")).map((promo: PromoConfig) => (
                    <option key={promo.id} value={promo.id}>
                      {promo.code ? `[${promo.code}] ` : ""}{promo.name} &bull; {promo.discountType === "PERCENTAGE" ? `${promo.discountValue}% (Maks Rp${(promo.maxDiscount || 0).toLocaleString()})` : `Potongan Rp${promo.discountValue.toLocaleString()}`}
                    </option>
                  ))}
                </select>
                {activePromo && activePromo.minimumAmount && subtotal < activePromo.minimumAmount && (
                  <p className="text-[10px] text-amber-600 font-medium">
                    * Belum mencapai min. belanja Rp {activePromo.minimumAmount.toLocaleString("id-ID")}.
                  </p>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="space-y-1 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-mono font-semibold">{formatCurrencyIDR(subtotal)}</span>
                </div>
                {voucherDiscountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Voucher Loyalty Poin:</span>
                    <span className="font-mono">-{formatCurrencyIDR(voucherDiscountAmount)}</span>
                  </div>
                )}
                {promoDiscountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Diskon Promo {activePromo ? `(${activePromo.name})` : ""}:</span>
                    <span className="font-mono">-{formatCurrencyIDR(promoDiscountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Pajak {isTaxEnabled ? `PB1 (${taxRatePercent}%)` : "(Non-Aktif)"}:</span>
                  <span className="font-mono font-semibold">
                    {isTaxEnabled ? formatCurrencyIDR(taxPB1) : "Rp 0"}
                  </span>
                </div>
                {serviceCharge > 0 && (
                  <div className="flex justify-between">
                    <span>Service Charge (5%):</span>
                    <span className="font-mono font-semibold">{formatCurrencyIDR(serviceCharge)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1.5 border-t border-slate-200">
                  <span>Total Tagihan:</span>
                  <span className="font-mono text-brand-orange text-base">
                    {formatCurrencyIDR(grandTotal)}
                  </span>
                </div>
              </div>

              {/* Pay Button */}
              <Button
                type="button"
                disabled={cartItems.length === 0 || (orderType === "DINE_IN" && availableTables.length === 0)}
                onClick={() => setIsPaymentModalOpen(true)}
                className="w-full text-xs font-bold h-11 space-x-2 bg-brand-orange hover:bg-orange-600 text-white shadow-md"
              >
                <CreditCard className="w-4 h-4" />
                <span>Proses Pembayaran ({formatCurrencyIDR(grandTotal)})</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. CO-WORKING TRANSACTION MODE */}
      {/* ==================================================== */}
      {posMode === "COWORKING" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-in fade-in duration-200">
          {/* Left Column: Workspace Catalog (Col 7 / 12) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            <div className="space-y-3.5 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={cwSearchQuery}
                  onChange={(e) => setCwSearchQuery(e.target.value)}
                  placeholder="Cari ruang kerja, area, fasilitas..."
                  className="w-full pl-10 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 shadow-2xs"
                />
              </div>

              {/* Workspace Type Pills */}
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5 text-xs no-scrollbar">
                {[
                  { key: "ALL", label: "Semua Tipe" },
                  { key: "HOT_DESK", label: "Hot Desk" },
                  { key: "DEDICATED_DESK", label: "Dedicated Desk" },
                  { key: "MEETING_ROOM", label: "Meeting Room" },
                  { key: "PRIVATE_POD", label: "Private Pod" },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setCwSpaceTypeFilter(f.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                      cwSpaceTypeFilter === f.key
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Workspaces Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredCwSpaces.map((space) => {
                const isSelected = selectedSpace?.id === space.id;
                const startH = parseHour(cwStartTime);
                const avail = checkSlotAvailability(space.id, cwDate, startH, cwDuration);

                return (
                  <div
                    key={space.id}
                    onClick={() => setCwSelectedSpaceId(space.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                      isSelected
                        ? "bg-blue-50/40 border-blue-600 ring-2 ring-blue-600/20 shadow-md"
                        : "bg-white border-slate-200 hover:border-slate-400 hover:shadow-sm"
                    }`}
                  >
                    <div className="space-y-2.5">
                      {space.imageUrl ? (
                        <div className="relative w-full h-28 rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
                          <img
                            src={space.imageUrl}
                            alt={space.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-16 rounded-xl bg-slate-100 border border-slate-100 flex items-center justify-center text-slate-400">
                          <Laptop className="w-6 h-6 opacity-30" />
                        </div>
                      )}

                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                              {space.type.replace("_", " ")}
                            </span>
                            <h4 className="font-bold text-sm text-slate-900 line-clamp-1">{space.name}</h4>
                            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span>{space.area}</span>
                            </p>
                          </div>

                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${
                              avail.isAvailable
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}
                          >
                            {avail.isAvailable ? "🟢 Tersedia" : "🔴 Terisi"}
                          </span>
                        </div>

                        {space.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-1 leading-relaxed">
                            {space.description}
                          </p>
                        )}

                        {/* Amenities */}
                        <div className="flex flex-wrap gap-1 pt-1">
                          {space.amenities.slice(0, 3).map((a, idx) => (
                            <span key={idx} className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                              • {a}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-1 text-slate-600">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium text-[11px]">{space.capacity} Tamu</span>
                      </div>

                      <div className="text-right">
                        <span className="font-mono font-black text-xs text-blue-600">
                          {formatCurrencyIDR(space.hourlyRate)}
                        </span>
                        <span className="text-[10px] text-slate-400">/jam</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Reservation & Checkout Panel (Col 5 / 12) */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col space-y-3">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
              {/* Workspace Summary Header */}
              {selectedSpace && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  {selectedSpace.imageUrl && (
                    <div className="relative w-full h-24 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                      <img
                        src={selectedSpace.imageUrl}
                        alt={selectedSpace.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-[9px] uppercase font-bold text-slate-400">{selectedSpace.type.replace("_", " ")}</span>
                      <h4 className="font-black text-xs text-slate-900">{selectedSpace.name}</h4>
                      <p className="text-[10px] text-slate-500">{selectedSpace.area}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-xs text-blue-600 font-mono">
                        {formatCurrencyIDR(selectedSpace.hourlyRate)}
                      </span>
                      <span className="text-[10px] text-slate-400 block">/jam</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Date & Duration */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Tanggal</span>
                  </label>
                  <input
                    type="date"
                    value={cwDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setCwDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Durasi</span>
                  </label>
                  <select
                    value={cwDuration}
                    onChange={(e) => setCwDuration(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none"
                  >
                    <option value={1}>1 Jam</option>
                    <option value={2}>2 Jam</option>
                    <option value={3}>3 Jam</option>
                    <option value={4}>4 Jam (Setengah Hari)</option>
                    <option value={8}>8 Jam (Seharian Penuh)</option>
                  </select>
                </div>
              </div>

              {/* Time Slots Selector with Availability Matrix */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>Pilih Jam Mulai</span>
                  </label>
                  <span className="text-[10px] text-slate-500">
                    Sewa: <strong>{cwStartTime} - {calculateEndTime(cwStartTime, cwDuration)} WITA</strong>
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1 max-h-32 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200/80">
                  {COWORKING_TIME_SLOTS.map((slot) => {
                    const startH = parseHour(slot);
                    const avail = selectedSpace
                      ? checkSlotAvailability(selectedSpace.id, cwDate, startH, cwDuration)
                      : { isAvailable: true };
                    const isSelected = cwStartTime === slot;

                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={!avail.isAvailable}
                        onClick={() => setCwStartTime(slot)}
                        className={`py-1.5 px-1 rounded-lg text-center transition-all flex flex-col items-center justify-center ${
                          !avail.isAvailable
                            ? "bg-rose-50 border border-rose-200 text-rose-400 cursor-not-allowed opacity-60 line-through"
                            : isSelected
                            ? "bg-slate-900 text-white shadow-xs font-black ring-1 ring-slate-900 scale-105"
                            : "bg-white border border-slate-200 text-slate-700 hover:bg-blue-50"
                        }`}
                      >
                        <span className="text-[11px] font-mono">{slot}</span>
                        <span className={`text-[8px] font-bold ${!avail.isAvailable ? "text-rose-600" : isSelected ? "text-blue-200" : "text-emerald-600"}`}>
                          {avail.isAvailable ? "Tersedia" : "Terisi"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Customer / Guest Selection */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>Identitas Pelanggan / Tamu</span>
                  </label>
                  <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setCwCustomerType("MEMBER")}
                      className={`px-2 py-0.5 rounded ${cwCustomerType === "MEMBER" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"}`}
                    >
                      Member
                    </button>
                    <button
                      type="button"
                      onClick={() => setCwCustomerType("WALK_IN")}
                      className={`px-2 py-0.5 rounded ${cwCustomerType === "WALK_IN" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"}`}
                    >
                      Walk-in
                    </button>
                  </div>
                </div>

                {cwCustomerType === "MEMBER" ? (
                  <select
                    value={cwMemberId}
                    onChange={(e) => setCwMemberId(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none"
                  >
                    <option value="">-- Pilih Member Terdaftar ({membersList.length}) --</option>
                    {membersList.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.tier} • {m.points} Pts) - {m.phone}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      placeholder="Nama Lengkap Tamu *"
                      value={cwGuestName}
                      onChange={(e) => setCwGuestName(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none"
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="tel"
                        placeholder="No. WhatsApp / HP"
                        value={cwGuestPhone}
                        onChange={(e) => setCwGuestPhone(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none"
                      />
                      <input
                        type="email"
                        placeholder="Email Tamu"
                        value={cwGuestEmail}
                        onChange={(e) => setCwGuestEmail(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Voucher / Promo Co-Working */}
              <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-bold text-slate-800 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-blue-600" />
                    <span>Voucher Promo Co-Working</span>
                  </label>
                  {cwAppliedPromo && (
                    <button
                      type="button"
                      onClick={() => {
                        setCwAppliedPromo(null);
                        setCwVoucherCode("");
                        setCwVoucherValidationMsg(null);
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
                    placeholder="Kode: COWORK50 / DAGO20"
                    value={cwVoucherCode}
                    onChange={(e) => setCwVoucherCode(e.target.value.toUpperCase())}
                    className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold uppercase text-slate-900 outline-none"
                  />
                  <Button
                    type="button"
                    onClick={() => handleApplyCoworkVoucher()}
                    className="h-8 px-3 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
                  >
                    Terapkan
                  </Button>
                </div>

                {cwVoucherValidationMsg && (
                  <div
                    className={`p-2 rounded-lg text-[11px] font-medium flex items-center space-x-1.5 ${
                      cwVoucherValidationMsg.type === "SUCCESS"
                        ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                        : "bg-rose-50 border border-rose-200 text-rose-800"
                    }`}
                  >
                    {cwVoucherValidationMsg.type === "SUCCESS" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    )}
                    <span>{cwVoucherValidationMsg.text}</span>
                  </div>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Sewa ({cwDuration} Jam)</span>
                  <span>{formatCurrencyIDR(cwPricing.originalSubtotal)}</span>
                </div>
                {cwPricing.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Diskon Promo {cwAppliedPromo ? `(${cwAppliedPromo.code || cwAppliedPromo.name})` : ""}</span>
                    <span>-{formatCurrencyIDR(cwPricing.discountAmount)}</span>
                  </div>
                )}
                {isTaxEnabled && (
                  <div className="flex justify-between text-slate-600">
                    <span>Pajak PB1 ({taxRatePercent}%)</span>
                    <span>{formatCurrencyIDR(cwPricing.tax)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-slate-900 pt-1.5 border-t border-slate-200 text-sm">
                  <span>Total Tagihan</span>
                  <span className="text-blue-600 font-black">{formatCurrencyIDR(cwPricing.total)}</span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Metode Pembayaran Kasir</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "QRIS", label: "QRIS", desc: "e-Wallet" },
                    { id: "CASH", label: "Kasir", desc: "Tunai" },
                    { id: "EDC", label: "Debit/EDC", desc: "Kartu Bank" },
                  ].map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setCwPaymentMethod(pm.id as POSPaymentMethod)}
                      className={`p-2 rounded-xl border text-center transition-all ${
                        cwPaymentMethod === pm.id
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <span className="text-xs font-black block">{pm.label}</span>
                      <span className={`text-[9px] block ${cwPaymentMethod === pm.id ? "text-slate-300" : "text-slate-400"}`}>
                        {pm.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <Button
                type="button"
                onClick={handleCompleteCoworkingPayment}
                className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-md space-x-2"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Bayar & Cetak Nota Co-Working ({formatCurrencyIDR(cwPricing.total)})</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      {/* 1. Modifier Modal */}
      {activeProductForCustomization && (
        <ModifierModal
          isOpen={isModifierModalOpen}
          onClose={() => {
            setIsModifierModalOpen(false);
            setActiveProductForCustomization(null);
          }}
          product={activeProductForCustomization}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* 2. Payment Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        cartItems={cartItems}
        subtotal={subtotal}
        tax={taxPB1}
        serviceCharge={serviceCharge}
        discount={voucherDiscountAmount + promoDiscountAmount}
        grandTotal={grandTotal}
        tableNumber={selectedTable}
        customerName={selectedMember?.name || "Walk-in Guest"}
        orderType={orderType}
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* 3. Receipt Modal */}
      {lastReceiptData && (
        <ReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={handleStartNewTransaction}
          onNewTransaction={handleStartNewTransaction}
          receiptData={lastReceiptData}
        />
      )}

      {/* 4. Voucher Modal */}
      {isVoucherModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Ticket className="w-5 h-5 text-brand-orange" />
                <h3 className="font-bold text-sm text-slate-900">Klaim Voucher Poin Loyalty</h3>
              </div>
              <button
                onClick={() => setIsVoucherModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <p className="text-slate-600">
                Poin member <strong>{selectedMember?.name}</strong>:{" "}
                <span className="font-bold text-brand-orange font-mono">{selectedMember?.points} Pts</span>
              </p>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {LOYALTY_VOUCHERS.map((voucher) => {
                  const canAfford = (selectedMember?.points || 0) >= voucher.pointsCost;
                  const isSelected = appliedVoucher?.id === voucher.id;

                  return (
                    <div
                      key={voucher.id}
                      onClick={() => canAfford && handleApplyVoucher(voucher)}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-all ${!canAfford
                          ? "opacity-50 bg-slate-50 border-slate-200 cursor-not-allowed"
                          : isSelected
                            ? "bg-amber-50 border-amber-400 shadow-sm cursor-pointer"
                            : "bg-white border-slate-200 hover:border-amber-300 cursor-pointer"
                        }`}
                    >
                      <div className="space-y-0.5">
                        <p className="font-bold text-slate-900">{voucher.title}</p>
                        <p className="text-[10px] text-slate-500">{voucher.description}</p>
                        <p className="text-[10px] font-bold text-brand-orange font-mono">
                          Biaya: {voucher.pointsCost} Poin
                        </p>
                      </div>

                      <Button
                        size="sm"
                        disabled={!canAfford}
                        variant={isSelected ? "default" : "outline"}
                        className={`text-[10px] h-7 px-2 font-bold ${isSelected ? "bg-amber-600 text-white" : ""
                          }`}
                      >
                        {isSelected ? "Terpasang" : "Gunakan"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsVoucherModalOpen(false)}
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Coworking Receipt Modal */}
      {lastCoworkReceiptData && (
        <CoworkingReceiptModal
          isOpen={isCoworkReceiptModalOpen}
          booking={lastCoworkReceiptData}
          onClose={() => {
            setIsCoworkReceiptModalOpen(false);
            setLastCoworkReceiptData(null);
          }}
        />
      )}
    </div>
  );
}
