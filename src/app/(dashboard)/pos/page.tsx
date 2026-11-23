"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
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
import { calculateCartTaxAndService } from "@/lib/tax-breakdown";
import { LOYALTY_VOUCHERS } from "@/features/pos/mock-data";
import { useCoworking } from "@/contexts/CoworkingContext";
import { useEmployeeShift } from "@/contexts/EmployeeShiftContext";
import { CoworkingReceiptModal, CoworkingReceiptData } from "@/features/coworking/CoworkingReceiptModal";
import { CoworkingSpaceItem, SpaceType } from "@/types/coworking";
import type { CorporateBillingType } from "@/types/order";
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
import { QRISVerificationDetail } from "@/lib/qris-verification";
import { ReceiptModal } from "@/features/pos/ReceiptModal";
import { KitchenOrderReceiptModal } from "@/features/pos/KitchenOrderReceiptModal";
import { usePrinter } from "@/contexts/PrinterContext";
import { KitchenTicketData } from "@/types/printer";
import { CashDrawerShiftModal, buildCashDrawerShiftSummary } from "@/features/pos/CashDrawerShiftModal";
import { formatCurrencyIDR } from "@/lib/utils";
import { OFFICIAL_CS_WHATSAPP_NUMBER } from "@/lib/contact-config";
import { isTenantActive, DEFAULT_FNB_TENANTS, getAllFnbTenants, getTenantName } from "@/lib/tenant";
import { resolveProductModifierGroups } from "@/lib/pos-modifiers";
import {
  generateSequentialReceiptNumber,
  resolveCoworkingReceiptPublisher,
  resolvePosReceiptPublisher,
  resolvePublisherCode,
} from "@/lib/receipt-publisher";
import {
  getNextOpenCoworkingDate,
  isCoworkingDateOpen,
  checkCoworkingBookingConflict,
  isTenantAcceptingOrders,
  isServiceWithinHours,
  isWithinCoworkingHours,
} from "@/lib/operating-hours";
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
  Building,
  Eye,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/app/notify";
import { EmptyState } from "@/components/app/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CartItemList } from "@/features/pos/CartItemList";
import { CartOrderSetup } from "@/features/pos/CartOrderSetup";
import { CartPromoField } from "@/features/pos/CartPromoField";
import { CartSummary } from "@/features/pos/CartSummary";
import { ProductCatalog } from "@/features/pos/ProductCatalog";
import { UnitScope } from "@/components/app/unit-scope";
import { PosToolbar } from "@/features/pos/PosToolbar";
import { cartItemCount, tenantClosedMessage } from "@/features/pos/pos-catalog";
import { CoworkingToolbar } from "@/features/pos/CoworkingToolbar";
import { CoworkingRoomCard } from "@/features/pos/CoworkingRoomCard";
import { CoworkingBookingPanel } from "@/features/pos/CoworkingBookingPanel";
import { CoworkingPhotoModal } from "@/features/pos/CoworkingPhotoModal";
import { CoworkingQrisModal } from "@/features/coworking/CoworkingQrisModal";
import { getTodayWitaDateString } from "@/features/coworking/coworking-domain";
import { CoworkingBooking } from "@/types/coworking";
import { PosVoucherModal } from "@/features/pos/PosVoucherModal";
import { PosOpenShiftModal } from "@/features/pos/PosOpenShiftModal";
import {
  COWORKING_TIME_SLOTS,
  parseHour,
  getCurrentTimeFormatted,
  getValidOperationalTime,
  calculateEndTime,
  checkSlotAvailability as checkSlotAvailabilityHelper,
  coworkingEmptyStateMessage,
} from "@/features/pos/pos-coworking";

export default function POSPage() {
  const { user } = useAuth();
  const { activeOutlet, activeOutletId } = useOutlet();
  const { orders, createPosOrder } = useOrders();
  const { getAvailableTables, occupyTableWithOrder, areas, filteredAreas } = useTables();
  const { simulateBOMDeduction, deductOrderBOM, checkProductStockStatus } = useInventory();
  const { filteredProducts: masterProducts, categories } = useProducts();
  const { filteredMembers: membersList, addPoints, redeemPoints } = useLoyalty();
  const { logActivity } = useActivityLog();
  const { settings, redeemPromo } = useSettings();
  const { spaces: cwSpaces, bookings: cwBookings, bookSpace: cwBookSpace } = useCoworking();
  const { shifts, activeShift, openShift, closeShift, recordShiftTransaction } = useEmployeeShift();

  const isTenantScoped = user?.scopeLevel === "TENANT" && Boolean(user?.tenant?.id);
  const lockedTenantId = isTenantScoped ? user?.tenant?.id : undefined;

  const isSubmittingOrderRef = useRef(false);
  const isSubmittingCoworkRef = useRef(false);
  const lastPrefilledTableCustomerRef = useRef<string | null>(null);

  // Mode: FNB vs COWORKING
  const [posMode, setPosMode] = useState<"FNB" | "COWORKING">("FNB");

  // Co-Working Specific States
  const [cwSelectedSpaceId, setCwSelectedSpaceId] = useState<string>("");
  const [cwSpaceTypeFilter, setCwSpaceTypeFilter] = useState<string>("ALL");
  const [cwSearchQuery, setCwSearchQuery] = useState<string>("");
  const [cwDate, setCwDate] = useState<string>(() =>
    getNextOpenCoworkingDate(getTodayWitaDateString(), settings?.coworkingHolidays)
  );
  const [cwStartTime, setCwStartTime] = useState<string>("09:00");
  const [isManualTimeSet, setIsManualTimeSet] = useState<boolean>(false);
  const [cwDuration, setCwDuration] = useState<number>(2); // hours
  const [cwUsageType, setCwUsageType] = useState<"PERSONAL" | "GROUP">("PERSONAL");
  const [cwCompanyName, setCwCompanyName] = useState<string>("");
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
  const [pendingCwQrisBooking, setPendingCwQrisBooking] = useState<CoworkingBooking | null>(null);
  const [isCwQrisModalOpen, setIsCwQrisModalOpen] = useState<boolean>(false);

  // Shift & Cash Drawer Quick Controls
  const [isPosOpenShiftModalOpen, setIsPosOpenShiftModalOpen] = useState<boolean>(false);
  const [posOpenShiftName, setPosOpenShiftName] = useState<string>("Shift Pagi (08:00 - 16:00)");
  const [posOpeningCashInput, setPosOpeningCashInput] = useState<number | "">("");
  const [isSubmittingShift, setIsSubmittingShift] = useState<boolean>(false);
  const [previewSpacePhoto, setPreviewSpacePhoto] = useState<CoworkingSpaceItem | null>(null);

  const handleOpenShiftModal = () => {
    setPosOpeningCashInput("");
    setIsPosOpenShiftModalOpen(true);
  };

  // Mount state for SSR Hydration safety
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (!isManualTimeSet) {
      setCwStartTime(getValidOperationalTime());
    }
  }, []);

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
    const all = getAllFnbTenants();
    const scoped = lockedTenantId ? all.filter((t) => t.id === lockedTenantId) : all;
    if (!isMounted) return scoped;
    return scoped.filter((t) => isTenantActive(t.id));
  }, [tenantSettingsVersion, isMounted, lockedTenantId]);

  // Primary Filter: Selected Mitra/Tenant
  const [selectedTenantId, setSelectedTenantId] = useState<string>(lockedTenantId || "ALL");

  useEffect(() => {
    if (!lockedTenantId) return;
    setSelectedTenantId(lockedTenantId);
    setPosMode("FNB");
  }, [lockedTenantId]);

  // Secondary Filter: Category & Search
  const [selectedCategory, setSelectedCategory] = useState<string>("Semua Kategori");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Cart & Order Settings
  const [cartItems, setCartItems] = useState<POSCartItem[]>([]);
  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKEAWAY">("DINE_IN");
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [orderNotes, setOrderNotes] = useState<string>("");
  const [selectedPromoId, setSelectedPromoId] = useState<string>("");
  const [fnbVoucherCode, setFnbVoucherCode] = useState<string>("");
  const [fnbVoucherValidationMsg, setFnbVoucherValidationMsg] = useState<{ type: "SUCCESS" | "ERROR"; text: string } | null>(null);
  const [manualDiscount, setManualDiscount] = useState<{
    type: "FIXED" | "PERCENT";
    value: number;
    reason: string;
  } | null>(null);

  // Loyalty & Voucher States
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [appliedVoucher, setAppliedVoucher] = useState<LoyaltyVoucher | null>(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState<boolean>(false);

  // Corporate Order States (Task S-36)
  const [isCorporateOrder, setIsCorporateOrder] = useState<boolean>(false);
  const [corporateCompany, setCorporateCompany] = useState<string>("");
  const [corporatePicName, setCorporatePicName] = useState<string>("");
  const [corporatePicPhone, setCorporatePicPhone] = useState<string>("");
  const [corporateHeadcount, setCorporateHeadcount] = useState<number>(1);
  const [corporateBillingType, setCorporateBillingType] = useState<CorporateBillingType>("PREPAID");
  const [corporateMeetingRoomId, setCorporateMeetingRoomId] = useState<string>("");

  const meetingRoomsList = useMemo(() => {
    return (cwSpaces || [])
      .filter((s) => s.type === "MEETING_ROOM")
      .map((s) => ({
        id: s.id,
        name: s.name,
        hourlyRate: s.hourlyRate,
      }));
  }, [cwSpaces]);

  const handleCorporateMeetingRoomChange = (roomId: string) => {
    setCorporateMeetingRoomId(roomId);
    if (!roomId) {
      setCartItems((prev) => prev.filter((it) => !it.cartItemId.startsWith("bundle-meeting-")));
      return;
    }
    const room = cwSpaces.find((s) => s.id === roomId);
    if (room) {
      const roomCartItem: POSCartItem = {
        cartItemId: `bundle-meeting-${room.id}`,
        productId: `space-${room.id}`,
        productName: `Sewa Ruang Meeting: ${room.name}`,
        quantity: 1,
        basePrice: room.hourlyRate,
        selectedModifiers: [],
        unitFinalPrice: room.hourlyRate,
        itemTotal: room.hourlyRate,
        tenantId: "tenant-dago-hub",
        notes: `Paket Ruang Meeting Perusahaan (${room.capacity} Pax)`,
      };
      setCartItems((prev) => {
        const withoutRoom = prev.filter((it) => !it.cartItemId.startsWith("bundle-meeting-"));
        return [...withoutRoom, roomCartItem];
      });
    }
  };

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
  const [isKitchenReceiptModalOpen, setIsKitchenReceiptModalOpen] = useState<boolean>(false);
  const [kitchenModalTicket, setKitchenModalTicket] = useState<KitchenTicketData | null>(null);
  const [kitchenPrintNotification, setKitchenPrintNotification] = useState<{
    type: "success" | "error" | "info";
    text: string;
    jobId?: string;
  } | null>(null);
  const {
    settings: printerSettings,
    printKitchenOrder,
    activeKitchenPrinter,
    retryPrintJob,
  } = usePrinter();
  const [isClosingShiftModalOpen, setIsClosingShiftModalOpen] = useState<boolean>(false);
  const [lastReceiptData, setLastReceiptData] = useState<POSReceiptData | null>(null);

  const needsReconciliationShift = useMemo(() => {
    if (!user?.id) return null;
    return (
      shifts.find(
        (s) =>
          s.status === "NEEDS_RECONCILIATION" &&
          s.assignedCashierId === user.id &&
          (activeOutletId === "ALL" || !s.outletId || s.outletId === activeOutletId)
      ) || null
    );
  }, [shifts, user?.id, activeOutletId]);

  const closingShiftSummary = useMemo(
    () => buildCashDrawerShiftSummary(orders, activeShift),
    [orders, activeShift]
  );

  // Real-time Available Tables for the Selected Outlet Scope ONLY
  const availableTables = useMemo(() => {
    return getAvailableTables(activeOutletId);
  }, [getAvailableTables, activeOutletId, areas]);

  // POS-14: Do not auto-select table. Only reset if current selection is no longer available.
  useEffect(() => {
    if (selectedTable && !availableTables.some((t) => t.id === selectedTable || t.number === selectedTable)) {
      setSelectedTable("");
    }
  }, [availableTables, selectedTable]);

  // Selected Member Object
  const selectedMember = useMemo(() => {
    return membersList.find((m) => m.id === selectedMemberId) || null;
  }, [membersList, selectedMemberId]);

  // Convert Master Products to POS format with Live Stock Status & Tenant Active Guard
  const posProducts = useMemo(() => {
    const activeTenantProducts = masterProducts.filter((prod) => {
      const tenantId = prod.tenantId || "tenant-ks";
      if (lockedTenantId && tenantId !== lockedTenantId) return false;
      if (!isMounted) return true;
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
        modifierGroups: resolveProductModifierGroups(prod),
      };
    });
  }, [masterProducts, checkProductStockStatus, tenantSettingsVersion, lockedTenantId, isMounted]);

  // 1. Scoped to Selected Mitra (Primary Filter)
  const tenantScopedProducts = useMemo(() => {
    const effectiveTenantId = lockedTenantId || selectedTenantId;
    if (effectiveTenantId === "ALL") return posProducts;
    return posProducts.filter((p) => (p.tenantId || "tenant-ks") === effectiveTenantId);
  }, [posProducts, selectedTenantId, lockedTenantId]);

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

  const manualDiscountAmount = useMemo(() => {
    if (!manualDiscount || subtotal <= 0) return 0;
    if (manualDiscount.type === "PERCENT") {
      const pct = Math.min(100, Math.max(0, manualDiscount.value));
      return Math.min(subtotal, Math.round((subtotal * pct) / 100));
    }
    return Math.min(subtotal, Math.max(0, Math.round(manualDiscount.value)));
  }, [manualDiscount, subtotal]);

  const totalDiscount = Math.min(
    subtotal,
    promoDiscountAmount + voucherDiscountAmount + manualDiscountAmount
  );

  const isSupervisorRole =
    user?.role?.slug === "SUPER_ADMIN" ||
    user?.role?.slug === "OWNER" ||
    user?.role?.slug === "MANAGER";

  const handleSelectTable = (tableValue: string) => {
    setSelectedTable(tableValue);
    if (selectedMember) return;

    const matchedTable = filteredAreas
      .flatMap((a) => a.tables)
      .find((t) => (t.number || t.id) === tableValue || t.id === tableValue);

    if (matchedTable?.status === "OCCUPIED" && matchedTable.customer) {
      if (!customerName.trim() || customerName === lastPrefilledTableCustomerRef.current) {
        setCustomerName(matchedTable.customer);
        lastPrefilledTableCustomerRef.current = matchedTable.customer;
      }
    } else if (lastPrefilledTableCustomerRef.current && customerName === lastPrefilledTableCustomerRef.current) {
      setCustomerName("");
      lastPrefilledTableCustomerRef.current = null;
    }
  };

  const handleApplyManualDiscount = async (params: {
    type: "FIXED" | "PERCENT";
    value: number;
    reason: string;
    supervisorPin?: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    if (subtotal <= 0) {
      return { ok: false, error: "Tambahkan menu ke keranjang sebelum menerapkan diskon." };
    }

    const computedAmount =
      params.type === "PERCENT"
        ? Math.min(subtotal, Math.round((subtotal * Math.min(100, Math.max(0, params.value))) / 100))
        : Math.min(subtotal, Math.max(0, Math.round(params.value)));

    if (computedAmount <= 0) {
      return { ok: false, error: "Nominal diskon harus lebih besar dari 0." };
    }

    if (!isSupervisorRole) {
      const cleanPin = (params.supervisorPin || "").trim();
      if (cleanPin.length < 4) {
        return { ok: false, error: "PIN supervisor wajib diisi." };
      }

      const pinSessionId = `PIN-DISC-${Date.now()}`;
      try {
        await fetch("/api/pos/qris/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "INIT",
            invoiceNumber: pinSessionId,
            expectedAmount: Math.max(1, computedAmount),
          }),
        });

        const verifyRes = await fetch("/api/pos/qris/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "SUPERVISOR_OVERRIDE",
            invoiceNumber: pinSessionId,
            expectedAmount: Math.max(1, computedAmount),
            pin: cleanPin,
            referenceNumber: "MANUAL-DISCOUNT",
            note: params.reason,
          }),
        });
        const verifyData = await verifyRes.json().catch(() => null);
        if (!verifyRes.ok || !verifyData?.allowed) {
          return { ok: false, error: verifyData?.error || "PIN supervisor tidak valid." };
        }
      } catch {
        return { ok: false, error: "Gagal memverifikasi PIN supervisor ke server." };
      }
    }

    setManualDiscount({
      type: params.type,
      value: params.value,
      reason: params.reason,
    });

    logActivity({
      module: "POS",
      action: "APPLY_DISCOUNT",
      recordId: "cart-manual-discount",
      previousValue: `Subtotal: Rp ${subtotal.toLocaleString("id-ID")}`,
      newValue: `Diskon manual: -Rp ${computedAmount.toLocaleString("id-ID")} (${params.reason})`,
      description: `Diskon manual Rp ${computedAmount.toLocaleString("id-ID")} diterapkan (${params.reason})`,
      reason: params.reason,
      status: "SUCCESS",
      outletId: activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr",
      outletName: activeOutlet?.name || "Singaraja",
    });

    notify.success("Diskon manual diterapkan", `Potongan Rp ${computedAmount.toLocaleString("id-ID")}`);
    return { ok: true };
  };

  // Single centralized tax & service charge calculation (POS-11, POS-27 / B2)
  const cartTaxBreakdown = useMemo(() => {
    return calculateCartTaxAndService({
      subtotal,
      discount: totalDiscount,
      taxRatePercent: Number(taxRatePercent) || 10,
      serviceChargePercent: Number(settings.serviceChargePercent) || 0,
      isTaxEnabled,
      orderType,
    });
  }, [subtotal, totalDiscount, taxRatePercent, settings.serviceChargePercent, isTaxEnabled, orderType]);

  const taxableAmount = cartTaxBreakdown.dpp;
  const taxPB1 = cartTaxBreakdown.pb1;
  const serviceCharge = cartTaxBreakdown.serviceCharge;
  const grandTotal = cartTaxBreakdown.total;

  // Handle Product Card Click -> Open Customization Modal
  const handleSelectProduct = (product: any) => {
    const tId = product.tenantId || "tenant-ks";
    const tenantOp = isTenantAcceptingOrders(tId, settings?.tenantOperations);
    if (!tenantOp.isOpen) {
      notify.warning(`${getTenantName(tId) || "Mitra F&B"} tutup sementara`, tenantClosedMessage(tenantOp));
      return;
    }

    if (!product.isAvailable || product.stockStatus === "OUT_OF_STOCK") {
      return; // Disabled for out of stock products
    }
    setActiveProductForCustomization(product);
    setIsModifierModalOpen(true);
  };

  // Add Item to Cart
  const handleAddToCart = (item: POSCartItem) => {
    const tId =
      item.tenantId ||
      posProducts.find((p) => p.id === item.productId)?.tenantId ||
      "tenant-ks";
    const tenantOp = isTenantAcceptingOrders(tId, settings?.tenantOperations);
    if (!tenantOp.isOpen) {
      notify.warning(`${getTenantName(tId) || "Mitra F&B"} tutup sementara`, tenantClosedMessage(tenantOp));
      return;
    }
    const resolvedItem: POSCartItem = {
      ...item,
      tenantId: tId,
    };
    setCartItems((prev) => {
      const existingIdx = prev.findIndex(
        (i) =>
          i.productId === resolvedItem.productId &&
          i.selectedVariant?.name === resolvedItem.selectedVariant?.name &&
          i.notes === resolvedItem.notes &&
          JSON.stringify(i.selectedModifiers.map((m) => m.name).sort()) ===
          JSON.stringify(resolvedItem.selectedModifiers.map((m) => m.name).sort())
      );

      if (existingIdx > -1) {
        const updated = [...prev];
        const exist = updated[existingIdx];
        const newQty = exist.quantity + resolvedItem.quantity;
        updated[existingIdx] = {
          ...exist,
          quantity: newQty,
          itemTotal: exist.unitFinalPrice * newQty,
          tenantId: exist.tenantId || tId,
        };
        return updated;
      }

      return [...prev, resolvedItem];
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
    const tierRank: Record<string, number> = { bronze: 1, silver: 2, gold: 3, platinum: 4 };
    if (
      voucher.minTier &&
      (tierRank[(selectedMember.tier || "bronze").toLowerCase()] ?? 0) <
        (tierRank[voucher.minTier.toLowerCase()] ?? 0)
    ) {
      notify.warning("Tier belum memenuhi syarat", `Voucher ini khusus member ${voucher.minTier}.`);
      return;
    }

    if (appliedVoucher?.id === voucher.id) {
      setAppliedVoucher(null);
    } else {
      setAppliedVoucher(voucher);
    }
    setIsVoucherModalOpen(false);
  };

  const handleApplyFnbVoucher = (codeToApply?: string) => {
    const code = (codeToApply !== undefined ? codeToApply : fnbVoucherCode).trim();
    if (!code) {
      setSelectedPromoId("");
      setFnbVoucherValidationMsg(null);
      return;
    }
    const res = validateVoucherCode(code, settings.promos || [], subtotal, {
      scope: "FNB",
      tenantId: selectedTenantId !== "ALL" ? selectedTenantId : undefined,
      customerId: selectedMember?.id,
    });
    if (res.isValid && res.promo) {
      setSelectedPromoId(res.promo.id);
      setFnbVoucherValidationMsg({
        type: "SUCCESS",
        text: `Voucher "${res.promo.code || res.promo.name}" aktif! Diskon Rp ${res.discountAmount.toLocaleString("id-ID")}`,
      });
    } else {
      setSelectedPromoId("");
      setFnbVoucherValidationMsg({
        type: "ERROR",
        text: res.reason || `Kode voucher "${code}" tidak ditemukan atau tidak valid.`,
      });
    }
  };

  // Process Successful Payment & Complete Business Actions
  const handlePaymentSuccess = (paymentData: {
    method: POSPaymentMethod;
    amountPaid: number;
    changeDue: number;
    splitDetails?: SplitGuestBill[];
    qrisVerification?: QRISVerificationDetail;
  }) => {
    if (isSubmittingOrderRef.current) return;
    isSubmittingOrderRef.current = true;
    try {
      setIsPaymentModalOpen(false);

      const nowFormatted = new Date().toLocaleString("id-ID", {
        timeZone: "Asia/Makassar",
        dateStyle: "medium",
        timeStyle: "short",
      });

      const primaryTenantId =
        cartItems[0]?.tenantId ||
        lockedTenantId ||
        (selectedTenantId !== "ALL" ? selectedTenantId : "tenant-ks");
      const posPublisher = resolvePosReceiptPublisher(
        cartItems.map((item) => ({ tenantId: item.tenantId })),
        activeOutlet,
        primaryTenantId
      );
      const publisherCode = posPublisher.isMultiTenant
        ? "DAGO"
        : resolvePublisherCode(posPublisher.tenantId);
      const receiptNo = generateSequentialReceiptNumber({
        publisherCode,
        existingNumbers: orders.map((o) => o.orderNumber),
      });

      const corporateInfo =
        isCorporateOrder && corporateCompany.trim()
          ? {
              companyName: corporateCompany.trim(),
              picName: corporatePicName.trim() || "PIC Tim",
              picPhone: corporatePicPhone.trim() || "-",
              headcount: corporateHeadcount || 1,
              billingType: paymentData.method === "INVOICE" ? "INVOICE" as const : corporateBillingType,
              invoiceNumber: `INV-${receiptNo}`,
              invoiceDueDate:
                paymentData.method === "INVOICE" || corporateBillingType === "INVOICE"
                  ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
                  : undefined,
              notes: orderNotes.trim() || undefined,
              linkedSpaceName: corporateMeetingRoomId
                ? cwSpaces.find((s) => s.id === corporateMeetingRoomId)?.name
                : undefined,
            }
          : undefined;

      const effectiveCustomerName = corporateInfo
        ? `${corporateInfo.companyName} (PIC: ${corporateInfo.picName})`
        : customerName.trim() ||
          (orderType === "DINE_IN" ? `Tamu Meja ${selectedTable}` : "Pelanggan Takeaway");

      const createdOrder = createPosOrder({
        orderNumber: receiptNo,
        cashierName: user?.name,
        tableNumber: orderType === "DINE_IN" ? selectedTable : "TAKEAWAY",
        customerName: effectiveCustomerName,
        customerPhone: selectedMember?.phone,
        corporateInfo,
        paymentStatus: paymentData.method === "INVOICE" ? "PENDING" : "PAID",
        orderType,
        subtotal,
        discount: totalDiscount,
        promoId: selectedPromoId || undefined,
        tax: taxPB1,
        serviceCharge: serviceCharge,
        taxRatePercent: isTaxEnabled ? Number(taxRatePercent) || 10 : 0,
        serviceChargePercent: orderType === "DINE_IN" ? Number(settings.serviceChargePercent) || 0 : 0,
        total: grandTotal,
        notes: orderNotes.trim() || undefined,
        paymentMethod: paymentData.method,
        paymentReference: paymentData.qrisVerification?.referenceNumber,
        qrisVerification: paymentData.qrisVerification,
        splitDetails: paymentData.splitDetails?.map((g, idx) => ({
          guestNumber: idx + 1,
          label: g.guestLabel,
          amount: g.assignedAmount,
          method: g.paymentMethod,
        })),
        items: cartItems.map((c, i) => ({
          id: `pos-it-${i}-${Date.now()}`,
          productId: c.productId,
          tenantId: c.tenantId || posProducts.find((p) => p.id === c.productId)?.tenantId || "tenant-ks",
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

      const kitchenTicket: KitchenTicketData = {
        orderId: createdOrder.id,
        orderNumber: createdOrder.orderNumber,
        outletId: createdOrder.outletId,
        outletName: activeOutlet?.name || "Singaraja",
        tableNumber: orderType === "DINE_IN" ? selectedTable : "TAKEAWAY",
        customerName: effectiveCustomerName,
        orderType,
        purpose: "NEW_ORDER",
        items: cartItems.map((c, i) => ({
          id: `kit-${i}-${Date.now()}`,
          productName: c.productName,
          quantity: c.quantity,
          variantName: c.selectedVariant?.name,
          modifiers: c.selectedModifiers.map((m) => m.name),
          notes: c.notes,
          tenantId: c.tenantId,
          tenantName: getTenantName(c.tenantId),
        })),
        cashierName: user?.name || "Kasir Bertugas",
        timestamp: new Date().toLocaleTimeString("id-ID", { timeZone: "Asia/Makassar", hour: "2-digit", minute: "2-digit" }) + " WITA",
        kitchenNotes: orderNotes.trim() || undefined,
        isSilent: true,
      };
      setKitchenModalTicket(kitchenTicket);

      if (printerSettings.autoPrintKitchenOrder) {
        printKitchenOrder(kitchenTicket, "NEW_ORDER", { isSilent: true }).then((res) => {
          if (res.success) {
            setKitchenPrintNotification({
              type: "success",
              text: res.message,
              jobId: res.job.id,
            });
            setTimeout(() => setKitchenPrintNotification(null), 5000);
          } else {
            setKitchenPrintNotification({
              type: "error",
              text: `Nota Dapur: ${res.message}`,
              jobId: res.job.id,
            });
          }
        });
      }

      const bomItems = cartItems.map((c) => ({
        productId: c.productId,
        productName: c.productName,
        quantity: c.quantity,
        modifiers: [
          ...(c.selectedVariant ? [c.selectedVariant.name] : []),
          ...c.selectedModifiers.map((m) => m.name),
        ],
      }));
      deductOrderBOM(bomItems);

      if (orderType === "DINE_IN" && selectedTable) {
        occupyTableWithOrder(selectedTable, {
          customerName: effectiveCustomerName,
          totalFormatted: formatCurrencyIDR(grandTotal),
          itemsCount: cartItems.reduce((s, i) => s + i.quantity, 0),
          orderId: createdOrder.id,
        });
      }

      let loyaltyReceiptInfo = undefined;
      if (selectedMember) {
        if (appliedVoucher) {
          redeemPoints(
            selectedMember.id,
            appliedVoucher.pointsCost,
            `Voucher "${appliedVoucher.title}" pada ${createdOrder.orderNumber}`,
            createdOrder.id
          );
        }
        const earnedPoints = Math.floor(grandTotal / 1000);
        addPoints(
          selectedMember.id,
          earnedPoints,
          `Transaksi POS #${createdOrder.orderNumber}`,
          createdOrder.id,
          grandTotal
        );

        loyaltyReceiptInfo = {
          name: selectedMember.name,
          tier: selectedMember.tier,
          pointsUsed: appliedVoucher ? appliedVoucher.pointsCost : 0,
          pointsRemaining:
            selectedMember.points - (appliedVoucher ? appliedVoucher.pointsCost : 0) + earnedPoints,
          voucherTitle: appliedVoucher?.title,
        };
      }

      if (selectedPromoId) {
        redeemPromo(selectedPromoId, selectedMember?.id || selectedMember?.phone || user?.id || "walk-in-customer");
      }

      const cashPortion =
        paymentData.method === "SPLIT"
          ? (paymentData.splitDetails || [])
              .filter((guest) => guest.paymentMethod === "CASH")
              .reduce((sum, guest) => sum + guest.assignedAmount, 0)
          : paymentData.method === "CASH"
            ? grandTotal
            : 0;
      recordShiftTransaction(cashPortion, grandTotal - cashPortion, activeOutletId, createdOrder.id);

      logActivity({
        module: "POS",
        action: "PAYMENT_SUCCESS",
        recordId: createdOrder.orderNumber,
        newValue: `Total: Rp ${grandTotal.toLocaleString()} (${paymentData.method}) - Bayar: Rp ${paymentData.amountPaid.toLocaleString()}`,
        description: `Pembayaran transaksi kasir POS ${createdOrder.orderNumber} berhasil`,
        reason: `Pembayaran kasir selesai via ${paymentData.method}`,
        status: "SUCCESS",
      });

      const receipt: POSReceiptData = {
        orderNumber: createdOrder.orderNumber,
        date: nowFormatted,
        cashierName: user?.name || "Kasir Bertugas",
        tenantId: posPublisher.tenantId || primaryTenantId,
        tenantName: posPublisher.brandName,
        outletName: posPublisher.outletName,
        outletAddress: posPublisher.outletAddress,
        outletPhone: posPublisher.outletPhone,
        tableNumber: selectedTable,
        customerName: effectiveCustomerName,
        customerPhone: selectedMember?.phone,
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
        promoName:
          activePromo?.name ||
          (appliedVoucher ? appliedVoucher.title : manualDiscount ? manualDiscount.reason : undefined),
        discount: totalDiscount,
        grandTotal,
        paymentMethod: paymentData.method,
        amountPaid: paymentData.amountPaid,
        changeDue: paymentData.changeDue,
        splitDetails: paymentData.splitDetails,
        qrisVerification: paymentData.qrisVerification,
        loyaltyMember: loyaltyReceiptInfo,
        corporateInfo,
      };

      if (totalDiscount > 0) {
        logActivity({
          module: "POS",
          action: "APPLY_DISCOUNT",
          recordId: createdOrder.orderNumber,
          previousValue: `Subtotal: Rp ${subtotal.toLocaleString("id-ID")}`,
          newValue: `Diskon: -Rp ${totalDiscount.toLocaleString("id-ID")} (Grand Total: Rp ${grandTotal.toLocaleString("id-ID")})`,
          description: `Diskon Rp ${totalDiscount.toLocaleString("id-ID")} diterapkan pada pesanan ${createdOrder.orderNumber}${receipt.promoName ? ` via ${receipt.promoName}` : ""}`,
          reason: receipt.promoName || "Penerapan diskon kasir",
          status: "SUCCESS",
          outletId: activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr",
          outletName: activeOutlet?.name || "Singaraja",
        });
      }

      setLastReceiptData(receipt);
      setIsReceiptModalOpen(true);
    } finally {
      isSubmittingOrderRef.current = false;
    }
  };

  const handleStartNewTransaction = () => {
    setIsReceiptModalOpen(false);
    setCartItems([]);
    setCustomerName("");
    lastPrefilledTableCustomerRef.current = null;
    setOrderNotes("");
    setSelectedMemberId("");
    setAppliedVoucher(null);
    setSelectedPromoId("");
    setFnbVoucherCode("");
    setFnbVoucherValidationMsg(null);
    setManualDiscount(null);
    setSearchQuery("");
    setSelectedCategory("Semua Kategori");
    setSelectedTable("");
    setOrderType("DINE_IN");
    setIsCorporateOrder(false);
    setCorporateCompany("");
    setCorporatePicName("");
    setCorporatePicPhone("");
    setCorporateHeadcount(1);
    setCorporateBillingType("PREPAID");
    setCorporateMeetingRoomId("");
    notify.success("Transaksi baru siap", "Keranjang dan formulir kasir sudah dikosongkan.");
  };

  // ==========================================
  // CO-WORKING COMPUTATIONS & HANDLERS
  // ==========================================
  const selectedSpace = useMemo(() => {
    if (!cwSelectedSpaceId) return null;
    return cwSpaces.find((s) => s.id === cwSelectedSpaceId) || null;
  }, [cwSpaces, cwSelectedSpaceId]);

  const handleSelectSpace = (spaceId: string) => {
    setCwSelectedSpaceId(spaceId);
    if (!isManualTimeSet) {
      setCwStartTime(getValidOperationalTime(cwDate));
    }
  };

  const handleClosePanel = () => {
    setCwSelectedSpaceId("");
  };

  const filteredCwSpaces = useMemo(() => {
    const query = cwSearchQuery.trim().toLowerCase();
    return cwSpaces.filter((sp) => {
      const matchType = cwSpaceTypeFilter === "ALL" || sp.type === cwSpaceTypeFilter;
      if (!matchType) return false;
      if (!query) return true;
      return (
        sp.name.toLowerCase().includes(query) ||
        sp.area.toLowerCase().includes(query) ||
        sp.type.toLowerCase().includes(query) ||
        sp.type.toLowerCase().replace(/_/g, " ").includes(query) ||
        sp.amenities.some((a) => a.toLowerCase().includes(query))
      );
    });
  }, [cwSpaces, cwSpaceTypeFilter, cwSearchQuery]);

  const availableCwSpacesCount = useMemo(() => {
    const startH = parseHour(cwStartTime);
    return filteredCwSpaces.filter((sp) =>
      checkSlotAvailabilityHelper({
        spaceId: sp.id,
        spaces: cwSpaces,
        bookings: cwBookings,
        targetDate: cwDate,
        startHour: startH,
        durationHours: cwDuration,
      }).isAvailable
    ).length;
  }, [filteredCwSpaces, cwSpaces, cwBookings, cwDate, cwStartTime, cwDuration]);

  const checkSlotAvailability = (
    spaceId: string,
    targetDate: string,
    startHour: number,
    durationHours: number
  ) => {
    return checkSlotAvailabilityHelper({
      spaceId,
      spaces: cwSpaces,
      bookings: cwBookings,
      targetDate,
      startHour,
      durationHours,
      checkPast: true,
    });
  };

  const cwSelectedMember = useMemo(() => {
    return membersList.find((m) => m.id === cwMemberId) || null;
  }, [membersList, cwMemberId]);

  const cwBaseAmount = useMemo(() => {
    if (!selectedSpace) return 0;
    if (cwDuration >= 8 && selectedSpace.dailyRate) {
      return selectedSpace.dailyRate;
    }
    return (selectedSpace.hourlyRate || 15000) * cwDuration;
  }, [selectedSpace, cwDuration]);

  const cwTaxConfig = settings?.categoryTax?.coworking;
  const cwTaxEnabled = cwTaxConfig !== undefined ? cwTaxConfig.isEnabled : false;
  const cwTaxRate = cwTaxEnabled && cwTaxConfig ? (cwTaxConfig.taxRatePercent || 0) / 100 : 0;
  const cwTaxType = cwTaxConfig?.taxType || "NON_TAX";

  const cwPricing = useMemo(() => {
    return calculateCoworkingPricing(cwBaseAmount, cwAppliedPromo || undefined, cwTaxRate, cwTaxType);
  }, [cwBaseAmount, cwAppliedPromo, cwTaxRate, cwTaxType]);

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
      notify.success(`Voucher ${res.promo.code || res.promo.name} diterapkan`);
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
      notify.warning("Pilih ruang kerja dulu");
      return;
    }

    let effectiveGuestName = "";
    let effectiveGuestPhone = "";
    let effectiveGuestEmail = "";

    if (cwCustomerType === "MEMBER") {
      if (!cwSelectedMember) {
        notify.warning("Pilih member dari daftar");
        return;
      }
      effectiveGuestName = cwSelectedMember.name;
      effectiveGuestPhone = cwSelectedMember.phone;
      effectiveGuestEmail = cwSelectedMember.email || "";
    } else {
      if (!cwGuestName.trim()) {
        notify.warning("Isi nama tamu walk-in");
        return;
      }
      effectiveGuestName = cwGuestName.trim();
      effectiveGuestPhone = cwGuestPhone.trim() || "-";
      effectiveGuestEmail = cwGuestEmail.trim() || "-";
    }

    const startH = parseHour(cwStartTime);
    if (!isWithinCoworkingHours(cwStartTime, cwDuration)) {
      notify.warning(
        "Di luar jam operasional",
        "Jam operasional Dago Creative Hub dan co-working adalah 09.00 sampai 18.00 WITA."
      );
      return;
    }
    const avail = checkSlotAvailability(selectedSpace.id, cwDate, startH, cwDuration);
    if (!avail.isAvailable) {
      notify.warning("Slot sudah terisi", `${cwStartTime}, ${cwDuration} jam pada ${cwDate} tidak tersedia.`);
      return;
    }

    // Holiday & Closed Date Check (Revisi 1)
    const holidayCheck = isCoworkingDateOpen(cwDate, settings?.coworkingHolidays);
    if (!holidayCheck.isOpen) {
      notify.warning("Co-working tutup", `${holidayCheck.reason} (${cwDate}).`);
      return;
    }

    if (selectedSpace.status === "MAINTENANCE") {
      notify.warning("Ruang tidak tersedia", "Ruang ini sedang dalam pemeliharaan.");
      return;
    }

    const conflict = checkCoworkingBookingConflict(cwBookings, {
      spaceId: selectedSpace.id,
      spaceName: selectedSpace.name,
      bookingType: "HOURLY",
      date: cwDate,
      startTime: cwStartTime,
      endTime: `${startH + cwDuration}:00 WITA`,
      maxCapacity: selectedSpace.type === "HOT_DESK" ? Math.max(1, selectedSpace.capacity || 8) : 1,
    });
    if (!activeShift) {
      notify.warning("Shift kasir belum dibuka", "Buka shift dengan modal awal sebelum menerima pembayaran.");
      handleOpenShiftModal();
      return;
    }

    if (conflict.hasConflict) {
      notify.warning("Jadwal bentrok", conflict.message);
      return;
    }

    if (isSubmittingCoworkRef.current) return;
    isSubmittingCoworkRef.current = true;

    try {
      const effectiveCompany =
        cwUsageType === "GROUP" ? cwCompanyName.trim() || "Group / Company" : "Personal";
      const isQris = cwPaymentMethod === "QRIS";
      const resolvedPromoTitle = cwAppliedPromo
        ? cwAppliedPromo.code
          ? `[${cwAppliedPromo.code}] ${cwAppliedPromo.name}`
          : cwAppliedPromo.name
        : undefined;

      let createdBooking: CoworkingBooking;
      try {
        createdBooking = cwBookSpace({
          guestName: effectiveGuestName,
          guestPhone: effectiveGuestPhone,
          guestEmail: effectiveGuestEmail,
          company: effectiveCompany,
          spaceId: selectedSpace.id,
          spaceName: selectedSpace.name,
          spaceType: selectedSpace.type,
          bookingType: "HOURLY",
          date: cwDate,
          startTime: cwStartTime,
          duration: cwDuration,
          price: cwPricing.originalSubtotal,
          discount: cwPricing.discountAmount,
          promoTitle: resolvedPromoTitle,
          tax: cwPricing.tax,
          taxType: cwPricing.taxType,
          taxRatePercent: cwPricing.taxRatePercent,
          outletId: activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr",
          createdAt: new Date().toISOString(),
          totalAmount: cwPricing.total,
          paymentMethod: cwPaymentMethod,
          paidAmount: isQris ? 0 : cwPricing.total,
          remainingAmount: isQris ? cwPricing.total : 0,
          paymentStatus: isQris ? "PENDING" : "PAID",
          fnbVoucherApplied: cwAppliedPromo?.code,
          notes: cwNotes || undefined,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Booking gagal disimpan.";
        notify.error("Booking gagal", message);
        return;
      }

      if (isQris) {
        setPendingCwQrisBooking(createdBooking);
        setIsCwQrisModalOpen(true);
        notify.warning(
          "Menunggu konfirmasi QRIS",
          `Booking ${createdBooking.bookingCode} dibuat. Tampilkan QRIS statis dan minta persetujuan supervisor.`
        );
        return;
      }

      if (cwAppliedPromo?.id) {
        redeemPromo(cwAppliedPromo.id, cwSelectedMember?.id || effectiveGuestPhone || "cw-guest");
      }

      if (cwCustomerType === "MEMBER" && cwSelectedMember) {
        const earnedPoints = Math.floor(cwPricing.total / 1000);
        if (earnedPoints > 0) {
          addPoints(cwSelectedMember.id, earnedPoints, `Booking Coworking #${createdBooking.bookingCode}`);
        }
      }

      recordShiftTransaction(
        cwPaymentMethod === "CASH" ? cwPricing.total : 0,
        cwPaymentMethod !== "CASH" ? cwPricing.total : 0,
        activeOutletId,
        createdBooking?.id ? `cw-${createdBooking.id}` : undefined
      );

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
      const cwPublisher = resolveCoworkingReceiptPublisher(activeOutlet);
      const coworkReceipt: CoworkingReceiptData = {
        bookingCode: createdBooking.bookingCode,
        transactionDate:
          new Date().toLocaleString("id-ID", {
            timeZone: "Asia/Makassar",
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }) + " WITA",
        guestName: effectiveGuestName,
        guestPhone: effectiveGuestPhone,
        guestEmail: effectiveGuestEmail,
        company: effectiveCompany,
        spaceName: selectedSpace.name,
        spaceType: selectedSpace.type,
        outletName: cwPublisher.outletName,
        outletAddress: cwPublisher.outletAddress,
        outletPhone: cwPublisher.outletPhone,
        bookingDate: cwDate,
        startTime: cwStartTime.replace(/\s*WITA$/i, ""),
        endTime: endTimeFormatted.replace(/\s*WITA$/i, ""),
        duration: cwDuration,
        bookingType: "HOURLY",
        basePrice: cwPricing.originalSubtotal,
        discount: cwPricing.discountAmount > 0 ? cwPricing.discountAmount : undefined,
        promoTitle: resolvedPromoTitle,
        tax: cwPricing.tax > 0 ? cwPricing.tax : 0,
        taxType: cwPricing.taxType,
        taxRatePercent: cwPricing.taxRatePercent,
        serviceCharge: 0,
        totalAmount: cwPricing.total,
        paymentMethod: cwPaymentMethod,
        paymentStatus: "PAID",
        notes: cwNotes || undefined,
      };

      setLastCoworkReceiptData(coworkReceipt);
      setIsCoworkReceiptModalOpen(true);
      setCwSelectedSpaceId("");
      setIsManualTimeSet(false);
      notify.success(`Booking ${createdBooking.bookingCode} tersimpan`);
    } finally {
      isSubmittingCoworkRef.current = false;
    }
  };

  const handleCwQrisSuccess = (verifiedBooking: CoworkingBooking) => {
    if (cwAppliedPromo?.id) {
      redeemPromo(
        cwAppliedPromo.id,
        cwSelectedMember?.id || verifiedBooking.guestPhone || "cw-guest"
      );
    }

    if (cwCustomerType === "MEMBER" && cwSelectedMember) {
      const earnedPoints = Math.floor(verifiedBooking.totalAmount / 1000);
      if (earnedPoints > 0) {
        addPoints(cwSelectedMember.id, earnedPoints, `Booking Coworking #${verifiedBooking.bookingCode}`);
      }
    }

    recordShiftTransaction(
      0,
      verifiedBooking.totalAmount,
      activeOutletId,
      verifiedBooking.id ? `cw-${verifiedBooking.id}` : undefined
    );

    const cleanStartTime = verifiedBooking.startTime.replace(/\s*WITA$/i, "").trim();
    const endTimeFormatted = verifiedBooking.endTime || calculateEndTime(cleanStartTime, verifiedBooking.duration);
    const cwPublisher = resolveCoworkingReceiptPublisher(activeOutlet);
    const coworkReceipt: CoworkingReceiptData = {
      bookingCode: verifiedBooking.bookingCode,
      transactionDate:
        new Date().toLocaleString("id-ID", {
          timeZone: "Asia/Makassar",
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }) + " WITA",
      guestName: verifiedBooking.guestName,
      guestPhone: verifiedBooking.guestPhone,
      guestEmail: verifiedBooking.guestEmail,
      company: verifiedBooking.company,
      spaceName: verifiedBooking.spaceName,
      spaceType: verifiedBooking.spaceType,
      outletName: cwPublisher.outletName,
      outletAddress: cwPublisher.outletAddress,
      outletPhone: cwPublisher.outletPhone,
      bookingDate: verifiedBooking.date,
      startTime: cleanStartTime,
      endTime: endTimeFormatted.replace(/\s*WITA$/i, "").trim(),
      duration: verifiedBooking.duration,
      bookingType: "HOURLY",
      basePrice: verifiedBooking.price ?? verifiedBooking.totalAmount,
      discount: verifiedBooking.discount && verifiedBooking.discount > 0 ? verifiedBooking.discount : undefined,
      promoTitle: verifiedBooking.promoTitle,
      tax: verifiedBooking.tax ?? 0,
      taxType: verifiedBooking.taxType || "NON_TAX",
      taxRatePercent: verifiedBooking.taxRatePercent ?? 0,
      serviceCharge: 0,
      totalAmount: verifiedBooking.totalAmount,
      paymentMethod: "QRIS",
      paymentStatus: "PAID",
      notes: verifiedBooking.notes,
    };

    setLastCoworkReceiptData(coworkReceipt);
    setIsCoworkReceiptModalOpen(true);
    setCwSelectedSpaceId("");
    setIsManualTimeSet(false);
    setIsCwQrisModalOpen(false);
    setPendingCwQrisBooking(null);
    notify.success("Pembayaran QRIS lunas", `Booking #${verifiedBooking.bookingCode} berhasil disetujui supervisor.`);
  };

  const fnbPromos = (settings.promos ?? []).filter(
    (promo: PromoConfig) => promo.isActive && (!promo.scope || promo.scope === "ALL" || promo.scope === "FNB"),
  );
  const promoMinimumNotice =
    activePromo?.minimumAmount && subtotal < activePromo.minimumAmount
      ? `Belum mencapai minimum belanja Rp ${activePromo.minimumAmount.toLocaleString("id-ID")}.`
      : null;
  const cartCount = cartItemCount(cartItems);
  const canPay = cartItems.length > 0 && !(orderType === "DINE_IN" && (!selectedTable || availableTables.length === 0));

  const handlePromoChange = (promoId: string) => {
    setSelectedPromoId(promoId);
    setFnbVoucherValidationMsg(null);
    const promo = settings.promos?.find((item) => item.id === promoId);
    setFnbVoucherCode(promo ? promo.code || promo.name : "");
  };

  const handleClearPromo = () => {
    setSelectedPromoId("");
    setFnbVoucherCode("");
    setFnbVoucherValidationMsg(null);
  };

  const handleRequestPayment = () => {
    if (orderType === "DINE_IN" && !selectedTable) {
      notify.warning("Pilih meja dulu", "Pesanan dine in perlu nomor meja sebelum dibayar.");
      return;
    }
    if (!activeShift) {
      notify.warning("Shift kasir belum dibuka", "Buka shift dengan modal awal sebelum menerima pembayaran.");
      handleOpenShiftModal();
      return;
    }
    setIsPaymentModalOpen(true);
  };

  const posUnit = !isTenantScoped && posMode === "COWORKING" ? "coworking" : "fnb";

  return (
    // Co-working mode switches the accent from F&B orange to co-working blue
    <div data-unit={posUnit} className="flex flex-col gap-4">
      <UnitScope unit={posUnit} />
      {isTenantScoped ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 text-xs">
              <Utensils className="size-3.5" />
              <span>F&B · {user?.tenant?.name || getTenantName(lockedTenantId) || "Mitra"}</span>
              {cartCount > 0 ? (
                <Badge variant="outline" className="ml-1 tabular-nums">
                  {cartCount}
                </Badge>
              ) : null}
            </Badge>
          </div>
          {activeShift ? (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="hidden h-8 gap-1.5 px-2.5 sm:inline-flex">
                <span className="size-1.5 rounded-full bg-success" aria-hidden />
                {activeShift.shiftName} · {activeShift.assignedCashierName}
              </Badge>
              <Button variant="outline" size="lg" onClick={() => setIsClosingShiftModalOpen(true)}>
                Tutup shift
              </Button>
            </div>
          ) : (
            <Button size="lg" onClick={handleOpenShiftModal}>
              <Clock />
              Buka shift
            </Button>
          )}
        </div>
      ) : (
        <PosToolbar
          mode={posMode}
          onModeChange={setPosMode}
          cartCount={cartCount}
          activeShift={activeShift}
          onOpenShift={handleOpenShiftModal}
          onCloseShift={() => setIsClosingShiftModalOpen(true)}
        />
      )}

      {needsReconciliationShift ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Shift sebelumnya melewati batas waktu dan berstatus Perlu Rekonsiliasi. Selesaikan tutup shift di halaman Karyawan & Shift sebelum membuka transaksi baru.
            </span>
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/employees" />}
              nativeButton={false}
            >
              Buka Karyawan & Shift
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {(isTenantScoped || posMode === "FNB") && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-7 xl:col-span-8">
            <ProductCatalog
              products={filteredProducts}
              tenants={activeTenants}
              selectedTenantId={lockedTenantId || selectedTenantId}
              onTenantChange={(tenantId) => setSelectedTenantId(lockedTenantId || tenantId)}
              categories={categoryTabs}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              tenantState={(tenantId) => isTenantAcceptingOrders(tenantId, settings?.tenantOperations)}
              onSelectProduct={handleSelectProduct}
            />
          </div>

          <Card className="self-start lg:sticky lg:top-[calc(var(--header-height)+1rem)] lg:col-span-5 xl:col-span-4">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Pesanan</CardTitle>
              <CardDescription className="tabular-nums">{cartCount} item</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <CartOrderSetup
                orderType={orderType}
                onOrderTypeChange={setOrderType}
                areas={filteredAreas}
                availableTableCount={availableTables.length}
                selectedTable={selectedTable}
                onTableChange={handleSelectTable}
                members={membersList}
                selectedMember={selectedMember}
                onMemberChange={handleSelectMember}
                appliedVoucherTitle={appliedVoucher?.title ?? null}
                onOpenVouchers={() => setIsVoucherModalOpen(true)}
                onRemoveVoucher={() => setAppliedVoucher(null)}
                orderNotes={orderNotes}
                onOrderNotesChange={setOrderNotes}
                isCorporateOrder={isCorporateOrder}
                onIsCorporateOrderChange={setIsCorporateOrder}
                companyName={corporateCompany}
                onCompanyNameChange={setCorporateCompany}
                picName={corporatePicName}
                onPicNameChange={setCorporatePicName}
                picPhone={corporatePicPhone}
                onPicPhoneChange={setCorporatePicPhone}
                headcount={corporateHeadcount}
                onHeadcountChange={setCorporateHeadcount}
                billingType={corporateBillingType}
                onBillingTypeChange={setCorporateBillingType}
                meetingRooms={meetingRoomsList}
                selectedMeetingRoomId={corporateMeetingRoomId}
                onSelectedMeetingRoomChange={handleCorporateMeetingRoomChange}
              />
              <Separator />
              <div className="max-h-80 overflow-y-auto">
                <CartItemList items={cartItems} onUpdateQuantity={handleUpdateQuantity} onRemove={handleRemoveItem} />
              </div>
              <Separator />
              <CartPromoField
                code={fnbVoucherCode}
                onCodeChange={setFnbVoucherCode}
                onApplyCode={() => handleApplyFnbVoucher()}
                message={fnbVoucherValidationMsg}
                promos={fnbPromos}
                selectedPromoId={selectedPromoId}
                onPromoChange={handlePromoChange}
                onClear={handleClearPromo}
                minimumNotice={promoMinimumNotice}
                manualDiscount={
                  manualDiscount
                    ? {
                        type: manualDiscount.type,
                        value: manualDiscount.value,
                        reason: manualDiscount.reason,
                        amount: manualDiscountAmount,
                      }
                    : null
                }
                requiresSupervisorPin={!isSupervisorRole}
                onApplyManualDiscount={handleApplyManualDiscount}
                onClearManualDiscount={() => setManualDiscount(null)}
              />
              <CartSummary
                subtotal={subtotal}
                voucherDiscount={voucherDiscountAmount}
                promoDiscount={promoDiscountAmount + manualDiscountAmount}
                promoName={
                  activePromo?.name || (manualDiscount ? `manual (${manualDiscount.reason})` : undefined)
                }
                isTaxEnabled={isTaxEnabled}
                taxRatePercent={taxRatePercent}
                tax={taxPB1}
                serviceCharge={serviceCharge}
                serviceChargePercent={Number(settings.serviceChargePercent) || 0}
                grandTotal={grandTotal}
                canPay={canPay}
                onPay={handleRequestPayment}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. CO-WORKING TRANSACTION MODE */}
      {/* ==================================================== */}
      {!isTenantScoped && posMode === "COWORKING" && (
        <div className="space-y-4">
          <CoworkingToolbar
            searchQuery={cwSearchQuery}
            onSearchChange={setCwSearchQuery}
            spaceTypeFilter={cwSpaceTypeFilter}
            onSpaceTypeFilterChange={setCwSpaceTypeFilter}
            date={cwDate}
            minDate={getTodayWitaDateString()}
            onDateChange={(newDate) => {
              setCwDate(newDate);
              if (!isManualTimeSet) {
                setCwStartTime(getValidOperationalTime(newDate));
              }
            }}
          />

          {!isCoworkingDateOpen(cwDate, settings?.coworkingHolidays).isOpen && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription className="text-xs">
                {isCoworkingDateOpen(cwDate, settings?.coworkingHolidays).reason}. Kantor Dago Creative Hub dan co-working beroperasi Senin sampai Jumat, pukul 09.00 sampai 18.00 WITA.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className={selectedSpace ? "lg:col-span-7 xl:col-span-8 space-y-3" : "col-span-12 space-y-3"}>
              {!selectedSpace ? (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-muted/40 border border-border rounded-xl text-xs text-muted-foreground">
                  <div className="flex items-center gap-2.5">
                    <div>
                      <h3 className="font-medium text-foreground text-xs">Pilih ruangan untuk memulai booking</h3>
                      <p className="text-xs text-muted-foreground">
                        Operasional Senin sampai Jumat, pukul 09.00 sampai 18.00 WITA. Pilih kartu ruangan atau meja di bawah.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-foreground bg-card px-2.5 py-1 rounded-md border border-border shrink-0 self-start sm:self-auto">
                    {availableCwSpacesCount} ruang tersedia
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-medium text-foreground">
                    Daftar ruangan ({filteredCwSpaces.length})
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClosePanel}
                  >
                    Buka tampilan penuh
                  </Button>
                </div>
              )}

              {filteredCwSpaces.length === 0 ? (
                <EmptyState
                  className="border"
                  icon={<Building />}
                  title={coworkingEmptyStateMessage(Boolean(cwSearchQuery || cwSpaceTypeFilter !== "ALL")).title}
                  description={coworkingEmptyStateMessage(Boolean(cwSearchQuery || cwSpaceTypeFilter !== "ALL")).description}
                />
              ) : (
                <div
                  className={`grid gap-3 ${
                    selectedSpace
                      ? "grid-cols-1 md:grid-cols-2"
                      : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
                  }`}
                >
                  {filteredCwSpaces.map((space) => {
                    const isSelected = selectedSpace?.id === space.id;
                    const startH = parseHour(cwStartTime);
                    const avail = checkSlotAvailability(space.id, cwDate, startH, cwDuration);

                    return (
                      <CoworkingRoomCard
                        key={space.id}
                        space={space}
                        isAvailable={avail.isAvailable}
                        isSelected={isSelected}
                        onSelect={() => {
                          if (avail.isAvailable) {
                            handleSelectSpace(space.id);
                          }
                        }}
                        onPreviewPhoto={space.imageUrl ? () => setPreviewSpacePhoto(space) : undefined}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {selectedSpace && (
              <div className="lg:col-span-5 xl:col-span-4">
                <CoworkingBookingPanel
                  selectedSpace={selectedSpace}
                  onClosePanel={handleClosePanel}
                  cwDuration={cwDuration}
                  onDurationChange={setCwDuration}
                  cwStartTime={cwStartTime}
                  onStartTimeChange={(time) => {
                    setIsManualTimeSet(true);
                    setCwStartTime(time);
                  }}
                  onResetStartTime={() => {
                    setIsManualTimeSet(false);
                    setCwStartTime(getValidOperationalTime(cwDate));
                  }}
                  checkSlotAvailable={(slot) => {
                    const startH = parseHour(slot);
                    return checkSlotAvailability(selectedSpace.id, cwDate, startH, cwDuration).isAvailable;
                  }}
                  getSlotInfo={(slot) => {
                    const startH = parseHour(slot);
                    return checkSlotAvailability(selectedSpace.id, cwDate, startH, cwDuration);
                  }}
                  cwUsageType={cwUsageType}
                  onUsageTypeChange={setCwUsageType}
                  cwCompanyName={cwCompanyName}
                  onCompanyNameChange={setCwCompanyName}
                  cwCustomerType={cwCustomerType}
                  onCustomerTypeChange={setCwCustomerType}
                  membersList={membersList}
                  cwMemberId={cwMemberId}
                  onMemberIdChange={setCwMemberId}
                  cwGuestName={cwGuestName}
                  onGuestNameChange={setCwGuestName}
                  cwGuestPhone={cwGuestPhone}
                  onGuestPhoneChange={setCwGuestPhone}
                  cwGuestEmail={cwGuestEmail}
                  onGuestEmailChange={setCwGuestEmail}
                  cwVoucherCode={cwVoucherCode}
                  onVoucherCodeChange={setCwVoucherCode}
                  onApplyVoucher={handleApplyCoworkVoucher}
                  onRemoveVoucher={() => {
                    setCwAppliedPromo(null);
                    setCwVoucherCode("");
                    setCwVoucherValidationMsg(null);
                  }}
                  cwAppliedPromo={cwAppliedPromo}
                  cwVoucherValidationMsg={cwVoucherValidationMsg}
                  cwPricing={cwPricing}
                  isTaxEnabled={isTaxEnabled}
                  taxRatePercent={taxRatePercent}
                  cwPaymentMethod={cwPaymentMethod}
                  onPaymentMethodChange={setCwPaymentMethod}
                  onCompletePayment={handleCompleteCoworkingPayment}
                  isDateClosed={!isCoworkingDateOpen(cwDate, settings?.coworkingHolidays).isOpen}
                  closedDateReason={isCoworkingDateOpen(cwDate, settings?.coworkingHolidays).reason}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Workspace Photo Preview Modal */}
      <CoworkingPhotoModal
        isOpen={Boolean(previewSpacePhoto)}
        onClose={() => setPreviewSpacePhoto(null)}
        space={previewSpacePhoto}
        onSelectSpace={(spaceId) => {
          setCwSelectedSpaceId(spaceId);
          setPreviewSpacePhoto(null);
        }}
      />

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
        discount={totalDiscount}
        grandTotal={grandTotal}
        tableNumber={selectedTable}
        customerName={
          isCorporateOrder && corporateCompany
            ? `${corporateCompany} (PIC: ${corporatePicName || "Tim"})`
            : selectedMember?.name || customerName.trim() || "Walk-in Guest"
        }
        orderType={orderType}
        isCorporateOrder={isCorporateOrder}
        corporateBillingType={corporateBillingType}
        corporateCompany={corporateCompany}
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* 3. Receipt Modal (Customer Receipt) */}
      {lastReceiptData && (
        <ReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={handleStartNewTransaction}
          onNewTransaction={handleStartNewTransaction}
          onViewKitchenTicket={() => setIsKitchenReceiptModalOpen(true)}
          receiptData={lastReceiptData}
        />
      )}

      {/* 3.5. Kitchen Order Receipt Modal (Dedicated Kitchen Ticket) */}
      {kitchenModalTicket && (
        <KitchenOrderReceiptModal
          isOpen={isKitchenReceiptModalOpen}
          ticketData={kitchenModalTicket}
          onClose={() => setIsKitchenReceiptModalOpen(false)}
        />
      )}

      {/* 3.6. Kitchen Print Floating Notification for Cashier */}
      {kitchenPrintNotification && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            className={`p-3.5 rounded-lg shadow-lg border flex items-center space-x-3 text-xs font-medium max-w-md ${
              kitchenPrintNotification.type === "success"
                ? "bg-card text-foreground border-success/40"
                : "bg-card text-foreground border-destructive/40"
            }`}
          >
            {kitchenPrintNotification.type === "success" ? (
              <CheckCircle2 className="size-4 text-success shrink-0" />
            ) : (
              <AlertTriangle className="size-4 text-destructive shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">{kitchenPrintNotification.text}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Printer: {activeKitchenPrinter?.name || "Printer dapur"}
              </p>
            </div>
            {kitchenPrintNotification.type === "error" && kitchenPrintNotification.jobId && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    const res = await retryPrintJob(kitchenPrintNotification.jobId!);
                    setKitchenPrintNotification({
                      type: res.success ? "success" : "error",
                      text: res.message,
                      jobId: kitchenPrintNotification.jobId,
                    });
                    if (res.success) {
                      setTimeout(() => setKitchenPrintNotification(null), 4000);
                    }
                  } catch (e: any) {
                    setKitchenPrintNotification((prev) =>
                      prev ? { ...prev, text: e.message || "Retry gagal" } : null
                    );
                  }
                }}
                className="shrink-0"
              >
                Coba lagi
              </Button>
            )}
            <button
              type="button"
              onClick={() => setKitchenPrintNotification(null)}
              className="text-muted-foreground hover:text-foreground p-1 transition-colors"
              aria-label="Tutup notifikasi"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* 4. Voucher Modal */}
      <PosVoucherModal
        isOpen={isVoucherModalOpen}
        onClose={() => setIsVoucherModalOpen(false)}
        memberName={selectedMember?.name}
        memberPoints={selectedMember?.points || 0}
        memberTier={selectedMember?.tier}
        vouchers={LOYALTY_VOUCHERS}
        appliedVoucherId={appliedVoucher?.id}
        onApplyVoucher={handleApplyVoucher}
      />

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

      {/* 6. Instant Closing & WhatsApp Report Modal */}
      {isClosingShiftModalOpen && activeShift && (
        <CashDrawerShiftModal
          isOpen={isClosingShiftModalOpen}
          onClose={() => setIsClosingShiftModalOpen(false)}
          shiftId={activeShift.id}
          cashierName={activeShift.assignedCashierName || user?.name || "Kasir Bertugas"}
          outletName={activeOutlet?.name || "Singaraja"}
          initialCash={activeShift.openingCash}
          totalCashSales={activeShift.cashSales || 0}
          totalNonCashSales={activeShift.nonCashSales || 0}
          totalTransactionsCount={closingShiftSummary.transactionsCount}
          qrisSales={closingShiftSummary.qrisSales}
          edcSales={closingShiftSummary.edcSales}
          totalDiscounts={closingShiftSummary.discounts}
          refundAmount={closingShiftSummary.refundAmount}
          storedTax={closingShiftSummary.storedTax}
          storedServiceCharge={closingShiftSummary.storedServiceCharge}
          isTaxEnabled={isTaxEnabled}
          taxRatePercent={taxRatePercent}
          tenantPhone={(user?.tenant as { phone?: string } | undefined)?.phone || OFFICIAL_CS_WHATSAPP_NUMBER}
          onConfirmClose={(actualCash, notes) => {
            closeShift(activeShift.id, actualCash, notes);
          }}
        />
      )}

      {/* 7. Coworking QRIS Supervisor Confirmation Modal (Task V-05) */}
      <CoworkingQrisModal
        isOpen={isCwQrisModalOpen}
        onClose={() => {
          setIsCwQrisModalOpen(false);
          setPendingCwQrisBooking(null);
        }}
        booking={pendingCwQrisBooking}
        onSuccess={handleCwQrisSuccess}
      />

      {/* 8. Quick Open Shift Modal for POS Cashier */}
      <PosOpenShiftModal
        isOpen={isPosOpenShiftModalOpen}
        onClose={() => setIsPosOpenShiftModalOpen(false)}
        isSubmitting={isSubmittingShift}
        shiftName={posOpenShiftName}
        onShiftNameChange={setPosOpenShiftName}
        openingCash={posOpeningCashInput}
        onOpeningCashChange={setPosOpeningCashInput}
        onSubmit={(e) => {
          e.preventDefault();
          if (isSubmittingShift) return;

          if (
            posOpeningCashInput === "" ||
            isNaN(Number(posOpeningCashInput)) ||
            Number(posOpeningCashInput) < 0
          ) {
            notify.warning("Modal awal wajib diisi", "Masukkan jumlah uang kas awal di laci kasir (minimal Rp 0).");
            return;
          }

          setIsSubmittingShift(true);

          const targetCashier = user?.name || "Kasir Bertugas";
          const cashAmount = Number(posOpeningCashInput);

          try {
            openShift(posOpenShiftName, cashAmount, targetCashier);
            setIsPosOpenShiftModalOpen(false);
            notify.success(
              `${posOpenShiftName} dibuka`,
              `Modal kas ${formatCurrencyIDR(cashAmount)}.`
            );
          } catch (err: any) {
            notify.error("Gagal membuka shift", err?.message || "Terjadi kesalahan saat membuka shift.");
          } finally {
            setIsSubmittingShift(false);
          }
        }}
      />
    </div>
  );
}
