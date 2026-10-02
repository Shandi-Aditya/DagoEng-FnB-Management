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
import { useEmployeeShift } from "@/contexts/EmployeeShiftContext";
import { useCoworking } from "@/contexts/CoworkingContext";
import { calculateOrderPricing, PromoConfig } from "@/lib/promo";
import { LOYALTY_VOUCHERS } from "@/features/pos/mock-data";
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
  Laptop,
  DoorOpen,
  History as HistoryIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function POSPage() {
  const { user } = useAuth();
  const { activeOutlet, activeOutletId } = useOutlet();
  const { createPosOrder } = useOrders();
  const { getAvailableTables, occupyTableWithOrder, areas } = useTables();
  const { simulateBOMDeduction, checkProductStockStatus } = useInventory();
  const { filteredProducts: masterProducts, categories } = useProducts();
  const { filteredMembers: membersList, addPoints, redeemPoints } = useLoyalty();
  const { logActivity } = useActivityLog();
  const { settings } = useSettings();
  const { activeShift, openShift, closeShift, recordShiftSale } = useEmployeeShift();
  const { spaces: coworkingSpaces } = useCoworking();

  // Catalog Switcher: F&B vs Coworking Spaces (Unified Cart Pilar B)
  const [catalogMode, setCatalogMode] = useState<"FNB" | "COWORKING">("FNB");

  // Search and Category Filter
  const [selectedCategory, setSelectedCategory] = useState<string>("Semua Menu");
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

  // Shift Operasional & Rekonsiliasi Kas Modal States
  const [isShiftOpenModalOpen, setIsShiftOpenModalOpen] = useState<boolean>(false);
  const [isShiftCloseModalOpen, setIsShiftCloseModalOpen] = useState<boolean>(false);
  const [openingCashInput, setOpeningCashInput] = useState<number>(500000);
  const [closingActualCashInput, setClosingActualCashInput] = useState<number>(activeShift?.expectedCash || 842000);
  const [closingNotesInput, setClosingNotesInput] = useState<string>("");

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

  // Shift & Cash Drawer Metrics
  const [initialCashDrawer] = useState<number>(500000);
  const [totalCashSales, setTotalCashSales] = useState<number>(342000);
  const [totalNonCashSales, setTotalNonCashSales] = useState<number>(688000);
  const [totalTransactionsCount, setTotalTransactionsCount] = useState<number>(14);

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

  // Convert Master Products to POS format with Live Stock Status
  const posProducts = useMemo(() => {
    return masterProducts.map((prod) => {
      const stockCheck = checkProductStockStatus(prod.name);
      return {
        id: prod.id,
        tenantId: prod.tenantId,
        name: prod.name,
        category: prod.category,
        basePrice: prod.basePrice,
        cogs: prod.cogsEstimate,
        margin: prod.grossMarginPercent,
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
  }, [masterProducts, checkProductStockStatus]);

  // Category List for filter tabs
  const categoryTabs = useMemo(() => {
    return ["Semua Menu", ...Array.from(new Set(posProducts.map((p) => p.category)))];
  }, [posProducts]);

  // Filtered Products based on search & category
  const filteredProducts = useMemo(() => {
    return posProducts.filter((prod) => {
      const matchCat = selectedCategory === "Semua Menu" || prod.category === selectedCategory;
      const matchQuery =
        prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prod.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [posProducts, selectedCategory, searchQuery]);

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

    // 5. Update Cash Drawer Metrics & Live Shift Sales
    if (paymentData.method === "CASH") {
      setTotalCashSales((prev) => prev + grandTotal);
    } else {
      setTotalNonCashSales((prev) => prev + grandTotal);
    }
    setTotalTransactionsCount((prev) => prev + 1);

    // Record sale into active employee shift session (Pilar B Sesi Kasir)
    recordShiftSale(grandTotal, paymentData.method === "CASH");

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

  const handleOpenShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    openShift(
      `Shift Operasional (${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })})`,
      openingCashInput,
      user?.name || "Kasir Bertugas"
    );
    setIsShiftOpenModalOpen(false);
    setPosToast(`Sesi kasir berhasil dibuka dengan Modal Awal Rp ${openingCashInput.toLocaleString("id-ID")}!`);
    setTimeout(() => setPosToast(""), 3500);
  };

  const handleCloseShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;
    closeShift(activeShift.id, closingActualCashInput, closingNotesInput);
    setIsShiftCloseModalOpen(false);
    const variance = closingActualCashInput - (activeShift.expectedCash || 0);
    const varText =
      variance === 0
        ? "Cocok Sempurna (Rp 0)"
        : variance > 0
        ? `Lebih Rp ${variance.toLocaleString("id-ID")}`
        : `Kurang Rp ${Math.abs(variance).toLocaleString("id-ID")}`;
    setPosToast(`Sesi kasir ditutup! Rekonsiliasi kas: ${varText}. Laporan sesi tersimpan.`);
    setTimeout(() => setPosToast(""), 4000);
  };

  const handleAddCoworkingToCart = (space: any, type: "HOURLY" | "DAILY") => {
    const price = type === "HOURLY" ? space.hourlyRate : space.dailyRate;
    const name = `${space.name} (${type === "HOURLY" ? "1 Jam" : "1 Hari"})`;
    const cartItem: POSCartItem = {
      cartItemId: `cwk-${space.id}-${type}-${Date.now()}`,
      productId: space.id,
      tenantId: "tenant-cowork",
      productName: name,
      basePrice: price,
      unitFinalPrice: price,
      quantity: 1,
      itemTotal: price,
      selectedModifiers: [],
      notes: "Sewa Co-working POS",
    };
    setCartItems((prev) => [...prev, cartItem]);
    setPosToast(`Ditambahkan ke keranjang: ${name}`);
    setTimeout(() => setPosToast(""), 2500);
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

  return (
    <div className="space-y-4">
      {/* POS Toast Notification */}
      {posToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 flex items-center space-x-2 animate-in fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{posToast}</span>
        </div>
      )}

      {/* Top Bar with Sesi Operasional Kasir (Pilar B) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Calculator className="w-5 h-5 text-brand-orange" />
            <span>Point of Sale (POS) Multi-Tenant — {activeOutlet?.name || "Singaraja"}</span>
          </h2>
          <div className="flex items-center space-x-2 text-xs text-slate-500 mt-0.5">
            <span>Kasir: <strong className="text-slate-800">{user?.name}</strong></span>
            <span>•</span>
            {activeShift ? (
              <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Sesi Aktif: {activeShift.assignedCashierName}</span>
                <span className="font-mono text-emerald-900 font-extrabold">(Kas: Rp {activeShift.expectedCash.toLocaleString("id-ID")})</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md font-bold">
                <AlertTriangle className="w-3 h-3 text-rose-600" />
                <span>Sesi Kasir Belum Dibuka</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sesi Kasir Button */}
          {activeShift ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setClosingActualCashInput(activeShift.expectedCash);
                setIsShiftCloseModalOpen(true);
              }}
              className="text-xs font-bold border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
            >
              <DoorOpen className="w-3.5 h-3.5 mr-1 text-amber-700" />
              <span>Tutup Sesi (Rekonsiliasi)</span>
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setIsShiftOpenModalOpen(true)}
              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Buka Sesi Kasir</span>
            </Button>
          )}

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

      {/* Unified Cart Catalog Switcher */}
      <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl max-w-md">
        <button
          type="button"
          onClick={() => setCatalogMode("FNB")}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
            catalogMode === "FNB"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Utensils className="w-3.5 h-3.5 text-brand-orange" />
          <span>Menu F&B Multi-Tenant</span>
        </button>
        <button
          type="button"
          onClick={() => setCatalogMode("COWORKING")}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
            catalogMode === "COWORKING"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Laptop className="w-3.5 h-3.5 text-blue-600" />
          <span>Sewa Ruang & Co-working</span>
        </button>
      </div>

      {/* Main Grid: Left (Catalog) & Right (Cart) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Catalog (Col 7 / 12) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {catalogMode === "FNB" ? (
            <>
              {/* Search & Category Tabs */}
              <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari menu, SKU, atau kategori F&B..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange"
                  />
                </div>

                {/* Category Filter Badges */}
                <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                  {categoryTabs.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
                        selectedCategory === cat
                          ? "bg-brand-orange text-white shadow-sm"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
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
                      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between h-36 relative overflow-hidden ${
                        isOutOfStock
                          ? "bg-slate-100/80 border-slate-300 opacity-60 cursor-not-allowed select-none"
                          : "bg-white border-slate-200 hover:border-brand-orange hover:shadow-md cursor-pointer group"
                      }`}
                    >
                      {/* Stock Status Badge */}
                      {isOutOfStock ? (
                        <div className="absolute top-2 right-2 bg-rose-600 text-white text-[9px] font-extrabold px-2 py-0.5 rounded shadow-sm flex items-center space-x-1">
                          <Ban className="w-2.5 h-2.5" />
                          <span>Habis</span>
                        </div>
                      ) : isCriticalStock ? (
                        <div className="absolute top-2 right-2 bg-amber-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-sm flex items-center space-x-1">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          <span>Stok Menipis</span>
                        </div>
                      ) : null}

                      <div className="space-y-1">
                        <div className="flex items-center justify-between pr-14">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            {product.category}
                          </span>
                        </div>
                        <h4
                          className={`font-bold text-xs line-clamp-2 transition-colors ${
                            isOutOfStock ? "text-slate-500" : "text-slate-900 group-hover:text-brand-orange"
                          }`}
                        >
                          {product.name}
                        </h4>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                        <span className="font-extrabold text-xs text-slate-900 font-mono">
                          {formatCurrencyIDR(product.basePrice)}
                        </span>
                        <div
                          className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                            isOutOfStock
                              ? "bg-slate-200 text-slate-400"
                              : "bg-slate-100 group-hover:bg-brand-orange group-hover:text-white text-slate-600"
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* COWORKING SPACE CATALOG */
            <div className="space-y-4">
              <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-200 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-blue-950 flex items-center space-x-1.5">
                    <Laptop className="w-4 h-4 text-blue-600" />
                    <span>Katalog Sewa Ruang & Hot Desk (Unified Cart)</span>
                  </h3>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Pilih ruang untuk dimasukkan langsung ke keranjang POS kasir bersama pesanan F&B.
                  </p>
                </div>
                <span className="text-xs font-bold text-blue-900 bg-white px-2.5 py-1 rounded-lg border border-blue-200">
                  {coworkingSpaces.length} Pilihan Ruang
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {coworkingSpaces.map((space) => {
                  const isOccupied = space.status === "OCCUPIED";

                  return (
                    <div
                      key={space.id}
                      className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                        isOccupied
                          ? "bg-slate-50 border-slate-200 opacity-70"
                          : "bg-white border-slate-200 hover:border-blue-400 hover:shadow-sm"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            {space.type}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              isOccupied ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {isOccupied ? "Terpakai" : "Tersedia"}
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-slate-900 line-clamp-1">{space.name}</h4>
                        <p className="text-[10px] text-slate-500">{space.area} • Kapasitas: {space.capacity} Org</p>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[11px] text-slate-500">Per Jam:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {formatCurrencyIDR(space.hourlyRate)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[11px] text-slate-500">Per Hari:</span>
                          <span className="font-mono font-bold text-blue-700">
                            {formatCurrencyIDR(space.dailyRate)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAddCoworkingToCart(space, "HOURLY")}
                            className="text-[10px] h-7 px-1 font-bold text-slate-700 hover:bg-slate-100"
                          >
                            + 1 Jam
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleAddCoworkingToCart(space, "DAILY")}
                            className="text-[10px] h-7 px-1 font-bold bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            + 1 Hari
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
                        {availableTables.map((t) => (
                          <option key={t.id} value={t.number || t.id}>
                            Meja {t.number || t.id} (Kapasitas {t.cap} Org)
                          </option>
                        ))}
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
              {/* Promo Select */}
              <div className="space-y-1">
                <select
                  value={selectedPromoId}
                  onChange={(e) => setSelectedPromoId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-medium focus:outline-none focus:ring-1 focus:ring-brand-orange"
                >
                  <option value="">-- Pilih Promo (Opsional) --</option>
                  {settings.promos?.filter((p: PromoConfig) => p.isActive).map((promo: PromoConfig) => (
                    <option key={promo.id} value={promo.id}>
                      {promo.name} {promo.discountType === "PERCENTAGE" ? `(${promo.discountValue}%)` : `(-Rp${promo.discountValue.toLocaleString()})`}
                    </option>
                  ))}
                </select>
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

      {/* 5. Buka Sesi Kasir Modal */}
      {isShiftOpenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Buka Sesi Kasir Baru</h3>
                  <p className="text-[11px] text-slate-500">Pilar B: Sesi Operasional & Saldo Awal</p>
                </div>
              </div>
              <button
                onClick={() => setIsShiftOpenModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleOpenShiftSubmit} className="space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Kasir Bertugas</span>
                <p className="font-bold text-slate-900 text-sm">{user?.name || "Kasir Utama"}</p>
                <p className="text-[11px] text-slate-500">Outlet: {activeOutlet?.name || "Singaraja"}</p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Modal Kas Awal di Laci (Float Cash) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-slate-400">Rp</span>
                  <input
                    type="number"
                    required
                    min={0}
                    step={1000}
                    value={openingCashInput}
                    onChange={(e) => setOpeningCashInput(Number(e.target.value))}
                    className="w-full pl-10 pr-3 py-2 border rounded-xl font-mono text-sm font-bold text-slate-900"
                  />
                </div>
                <p className="text-[10px] text-slate-500">
                  Uang tunai awal di kasir untuk uang kembalian transaksi pelanggan.
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsShiftOpenModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Konfirmasi & Buka Sesi
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Tutup Sesi Kasir & Rekonsiliasi Fisik Kas Modal */}
      {isShiftCloseModalOpen && activeShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                  <DoorOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Tutup Sesi & Rekonsiliasi Kas</h3>
                  <p className="text-[11px] text-slate-500">Pilar B & C: Pencocokan Kas Laci vs Penjualan Sistem</p>
                </div>
              </div>
              <button
                onClick={() => setIsShiftCloseModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCloseShiftSubmit} className="space-y-3.5 text-xs">
              {/* Shift Metrics Breakdown */}
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <p className="text-[10px] text-slate-500 font-medium">Saldo Modal Awal</p>
                  <p className="font-mono font-bold text-slate-800">{formatCurrencyIDR(activeShift.openingCash)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-medium">Penjualan Tunai (Cash)</p>
                  <p className="font-mono font-bold text-emerald-700">+{formatCurrencyIDR(activeShift.cashSales)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-medium">Penjualan Non-Tunai (QRIS/EDC)</p>
                  <p className="font-mono font-bold text-blue-700">{formatCurrencyIDR(activeShift.nonCashSales)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-medium">Kas Sistem Diharapkan</p>
                  <p className="font-mono font-black text-slate-900 text-sm">
                    {formatCurrencyIDR(activeShift.expectedCash)}
                  </p>
                </div>
              </div>

              {/* Physical Cash Count Input */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-800">
                  Hitungan Fisik Uang Tunai di Laci Kasir (Actual Cash) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-slate-400">Rp</span>
                  <input
                    type="number"
                    required
                    min={0}
                    step={1000}
                    value={closingActualCashInput}
                    onChange={(e) => setClosingActualCashInput(Number(e.target.value))}
                    className="w-full pl-10 pr-3 py-2 border rounded-xl font-mono text-sm font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Real-time Variance Calculation */}
              {(() => {
                const diff = closingActualCashInput - activeShift.expectedCash;
                return (
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between ${
                      diff === 0
                        ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                        : diff > 0
                        ? "bg-blue-50 border-blue-300 text-blue-900"
                        : "bg-rose-50 border-rose-300 text-rose-900"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <p className="font-bold text-xs">
                        {diff === 0
                          ? "✓ Kas Cocok Sempurna (Balance)"
                          : diff > 0
                          ? "▲ Kas Fisik Lebih (Over)"
                          : "▼ Kas Fisik Kurang (Shortage)"}
                      </p>
                      <p className="text-[10px] opacity-80">
                        {diff === 0
                          ? "Fisik laci kasir cocok dengan akumulasi pencatatan POS."
                          : "Perbedaan nilai akan dicatat otomatis pada audit shift."}
                      </p>
                    </div>
                    <span className="font-mono font-black text-sm">
                      {diff > 0 ? `+${formatCurrencyIDR(diff)}` : formatCurrencyIDR(diff)}
                    </span>
                  </div>
                );
              })()}

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Catatan Penutupan Shift (Opsional)</label>
                <textarea
                  rows={2}
                  value={closingNotesInput}
                  onChange={(e) => setClosingNotesInput(e.target.value)}
                  placeholder="Contoh: Fisik kas cocok, struk telah diarsipkan."
                  className="w-full px-3 py-2 border rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsShiftCloseModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                >
                  Tutup Sesi & Simpan Rekonsiliasi
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
