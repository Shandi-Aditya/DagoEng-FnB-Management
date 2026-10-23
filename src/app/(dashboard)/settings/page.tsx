"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useOutlet } from "@/contexts/OutletContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { PromoConfig, PromoType, PromoScope, TargetType, getPromoComputedStatus, sortPromosByPriority } from "@/lib/promo";
import { useProducts } from "@/contexts/ProductContext";
import { useCoworking } from "@/contexts/CoworkingContext";
import { useTables } from "@/contexts/TableContext";
import { formatCurrencyIDR } from "@/lib/utils";
import { MasterProduct } from "@/types/product";
import {
  Settings,
  Store,
  Building,
  ShieldCheck,
  Coffee,
  Laptop,
  Briefcase,
  Globe,
  Clock,
  Coins,
  AlertTriangle,
  Award,
  Receipt,
  Save,
  CheckCircle2,
  RotateCcw,
  Tag,
  Plus,
  Trash2,
  CreditCard,
  Power,
  ToggleLeft,
  ToggleRight,
  Edit2,
  Search,
  Filter,
  X,
  UtensilsCrossed,
  Grid,
  UploadCloud,
  ImageIcon,
  Calendar,
  CalendarDays,
  CheckSquare,
  Square,
  ArrowUpDown,
  Zap,
  Check,
  Layers,
  Crown,
  Sparkles,
  Package,
  Wifi,
  Router,
  Signal,
  Server,
  Info,
  Sliders,
  Users,
  UserCheck,
  Eye,
  TrendingUp,
  Calculator,
  Percent,
  History,
  FileCheck,
  Key,
  Copy,
  ExternalLink,
} from "lucide-react";
import { CommunityOrganizerProfile, INITIAL_ORGANIZERS } from "@/types/organizer";
import { CommunityEvent, EventRevenueSharingPolicy, DEFAULT_EVENT_POLICY } from "@/types/event";
import {
  INDONESIAN_NATIONAL_HOLIDAYS_2026,
  HolidayOverride,
  HolidayOverrideDate,
  TenantOperationConfig,
} from "@/lib/operating-hours";
import { Button } from "@/components/ui/button";
import {
  getTenantStatus,
  setTenantStatus,
  DEFAULT_FNB_TENANTS,
  DEFAULT_TENANT_PROFILES,
  getTenantProfile,
  getTenantName,
  getAllFnbTenants,
  saveCustomTenant,
} from "@/lib/tenant";
import { MEMBERSHIP_PLANS } from "@/features/coworking/coworking-data";
import {
  getAllTenantRevenueSplits,
  setTenantRevenueSplit,
  TenantRevenueSplitConfig,
  getTenantRevenueSplit,
  DEFAULT_TENANT_REVENUE_SPLITS,
} from "@/lib/settlement";
import { ProFeatureBadge, PremiumFeatureCard, UpgradeModal } from "@/components/premium";
import {
  PLATFORM_PLANS,
  PlanTier,
  getSimulatedOrgSubscription,
  setSimulatedOrgPlan,
  getSimulatedTenantAddons,
  toggleSimulatedTenantAddon,
  OrgSubscriptionState,
  TenantAddonItem,
} from "@/lib/subscription";
import {
  WifiFnBRule,
  WifiCoworkingRule,
  WifiVoucherRecord,
  WifiNetworkConfig,
  DEFAULT_NETWORK_CONFIG,
  getSimulatedFnBRules,
  saveSimulatedFnBRules,
  getSimulatedCoworkingRules,
  getSimulatedWifiVouchers,
  saveSimulatedWifiVouchers,
  revokeSimulatedWifiVoucher,
  validateFnBRulesOverlap,
  getSimulatedWifiCalcBasis,
  setSimulatedWifiCalcBasis,
} from "@/lib/wifi";

export default function SettingsPage() {
  const { user, activeOrgModules, toggleOrgModule } = useAuth();
  const { filteredProducts, categories, addProduct, updateProduct, deleteProduct, toggleProductStatus, addCategory } = useProducts();
  const { spaces: cwSpaces, addSpace, updateSpace, deleteSpace } = useCoworking();
  const { areas } = useTables();
  const allTables = areas.flatMap((a) => a.tables.map((t) => ({ ...t, areaName: a.name })));
  const { settings, updateSettings } = useSettings();
  const { outlets } = useOutlet();

  const isSuperAdmin = user?.role.slug === "SUPER_ADMIN";
  const isOrgOwner = user?.role.slug === "OWNER" && user?.scopeLevel === "ORGANIZATION";
  const isTenantOwner = user?.role.slug === "OWNER" && user?.scopeLevel === "TENANT";
  const canAccessSettings = isSuperAdmin || isOrgOwner || isTenantOwner;

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [tenantSavedSuccess, setTenantSavedSuccess] = useState(false);

  // Platform Form State
  const [language, setLanguage] = useState<"id" | "en">(settings.language);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [currency, setCurrency] = useState(settings.currency);
  const [lowStock, setLowStock] = useState(settings.lowStockThresholdPercent);
  const [taxRate, setTaxRate] = useState(settings.taxRatePercent);
  const [serviceCharge, setServiceCharge] = useState(settings.serviceChargePercent);

  // Loyalty thresholds
  const [silverPts, setSilverPts] = useState(settings.loyaltyTiers.silverMin);
  const [goldPts, setGoldPts] = useState(settings.loyaltyTiers.goldMin);
  const [platPts, setPlatPts] = useState(settings.loyaltyTiers.platinumMin);

  // Promos (Revisi 6: diurutkan berdasarkan prioritas aktif)
  const [promos, setPromos] = useState<PromoConfig[]>(() => sortPromosByPriority(settings.promos || []));

  // Master Product Filters & Sorting (Revisi 7)
  const [masterStatusFilter, setMasterStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [masterSortOrder, setMasterSortOrder] = useState<"UPDATED_DESC" | "UPDATED_ASC" | "NAME_ASC" | "PRICE_ASC" | "PRICE_DESC">("UPDATED_DESC");

  // Promo Product Multi-Select Modal State (Revisi 5)
  const [isPromoProductModalOpen, setIsPromoProductModalOpen] = useState(false);
  const [activePromoIdForProductSelect, setActivePromoIdForProductSelect] = useState<string | null>(null);
  const [selectedProductIdsInModal, setSelectedProductIdsInModal] = useState<string[]>([]);
  const [promoProductSearch, setPromoProductSearch] = useState("");
  const [promoProductCategoryFilter, setPromoProductCategoryFilter] = useState("ALL");
  const [promoProductTenantFilter, setPromoProductTenantFilter] = useState("ALL");

  // Co-working Holidays & Operating Hours State (Revisi 1 & 4)
  const [cwWeekendClosed, setCwWeekendClosed] = useState(settings.coworkingHolidays?.closeOnWeekends ?? true);
  const [cwNationalHolidaysClosed, setCwNationalHolidaysClosed] = useState(settings.coworkingHolidays?.closeOnNationalHolidays ?? true);
  const [cwOverrides, setCwOverrides] = useState<HolidayOverrideDate[]>(settings.coworkingHolidays?.overrides || []);
  const [newOverrideDate, setNewOverrideDate] = useState("");
  const [newOverrideType, setNewOverrideType] = useState<"OPEN" | "CLOSED">("OPEN");
  const [newOverrideReason, setNewOverrideReason] = useState("");

  // Operating Hours State (Revisi 4)
  const [cwOpenTime, setCwOpenTime] = useState(settings.operationalHours?.coworking?.open || "09:00");
  const [cwCloseTime, setCwCloseTime] = useState(settings.operationalHours?.coworking?.close || "18:00");
  const [fnbOpenTime, setFnbOpenTime] = useState(settings.operationalHours?.fnb?.open || "07:00");
  const [fnbCloseTime, setFnbCloseTime] = useState(settings.operationalHours?.fnb?.close || "22:00");

  // Tenant Operations State (Revisi 2)
  const [tenantOps, setTenantOps] = useState<Record<string, TenantOperationConfig>>(settings.tenantOperations || {});
  const [tenantOpenTime, setTenantOpenTime] = useState(
    settings.tenantOperations?.[user?.tenant?.id || "tenant-ks"]?.openTime || "08:00"
  );
  const [tenantCloseTime, setTenantCloseTime] = useState(
    settings.tenantOperations?.[user?.tenant?.id || "tenant-ks"]?.closeTime || "21:00"
  );
  const [tenantClosedReason, setTenantClosedReason] = useState(
    settings.tenantOperations?.[user?.tenant?.id || "tenant-ks"]?.temporaryClosedReason || ""
  );

  // Tenant Settings Form State (Owner Mitra)
  const [tenantBrandName, setTenantBrandName] = useState(user?.tenant?.name || "Kopi Senja");
  const [tenantTagline, setTenantTagline] = useState("Specialty Coffee & Beverages");
  const [tenantDesc, setTenantDesc] = useState(
    "Single origin espresso blend Kintamani, olahan susu segar & gula aren organik Bali."
  );
  const [tenantPhone, setTenantPhone] = useState("+62 812-3456-7890");
  const [tenantReceiptHeader, setTenantReceiptHeader] = useState("Kopi Senja — Specialty Coffee & Beverages");
  const [tenantReceiptFooter, setTenantReceiptFooter] = useState("Terima kasih telah berkunjung ke Kopi Senja!");
  const [tenantLowStock, setTenantLowStock] = useState(35);
  const [tenantStatus, setTenantStatusState] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");

  // State for all tenants status in Master Data view
  const [allTenantStatuses, setAllTenantStatuses] = useState<Record<string, "ACTIVE" | "INACTIVE">>({});

  // Rekening Pencairan Dana & Pembayaran Mitra
  const [bankName, setBankName] = useState<string>("BCA");
  const [bankAccountNumber, setBankAccountNumber] = useState<string>("");
  const [bankAccountHolder, setBankAccountHolder] = useState<string>("");
  const [bankFormError, setBankFormError] = useState<string>("");

  // Flexible Revenue Sharing State (Super Admin & Org Owner)
  const [revenueSplits, setRevenueSplits] = useState<Record<string, TenantRevenueSplitConfig>>({});
  const [revenueSplitErrors, setRevenueSplitErrors] = useState<Record<string, string>>({});
  const [splitSaveFeedback, setSplitSaveFeedback] = useState<string>("");

  // Unified Platform Administration: Mitra F&B & Penyelenggara Event
  const [partnerSubTab, setPartnerSubTab] = useState<"MANAJEMEN_MITRA" | "BAGI_HASIL_FNB" | "BAGI_HASIL_EVENTS">("MANAJEMEN_MITRA");
  const [partnerTypeFilter, setPartnerTypeFilter] = useState<"ALL" | "FNB" | "EVENT">("ALL");
  const [partnerStatusFilter, setPartnerStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [partnerSearchQuery, setPartnerSearchQuery] = useState<string>("");
  const [organizers, setOrganizers] = useState<CommunityOrganizerProfile[]>(INITIAL_ORGANIZERS);
  const [isAddOrganizerModalOpen, setIsAddOrganizerModalOpen] = useState(false);
  const [selectedPartnerDetail, setSelectedPartnerDetail] = useState<{
    id: string;
    name: string;
    type: "FNB" | "EVENT";
    categoryOrBadge: string;
    contactPerson: string;
    phone: string;
    email: string;
    status: "ACTIVE" | "INACTIVE";
    serviceModule: string;
    scopeLevel: string;
    roleName: string;
    permissions: string[];
    bankInfo?: { bankName: string; accountNumber: string; accountHolder: string };
    notes?: string;
  } | null>(null);

  // Form Tambah Penyelenggara
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgCategory, setNewOrgCategory] = useState("Komunitas Kreatif");
  const [newOrgPIC, setNewOrgPIC] = useState("");
  const [newOrgPhone, setNewOrgPhone] = useState("");
  const [newOrgEmail, setNewOrgEmail] = useState("");
  const [newOrgNotes, setNewOrgNotes] = useState("");
  const [newOrgStatus, setNewOrgStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [addOrgError, setAddOrgError] = useState("");
  const [isSubmittingOrg, setIsSubmittingOrg] = useState(false);

  // Organizer Activation Modal State
  const [activationModalData, setActivationModalData] = useState<{
    organizerName: string;
    organizerEmail: string;
    activationUrl: string;
    expiresAt: string;
  } | null>(null);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Event Marketplace Revenue Sharing Policy State
  const [eventPlatformFee, setEventPlatformFee] = useState<number>(20);
  const [eventPolicyEffectiveDate, setEventPolicyEffectiveDate] = useState<string>("2026-01-01T00:00:00.000Z");
  const [eventPolicyNotes, setEventPolicyNotes] = useState<string>("Kebijakan komisi standar platform DAGO Creative Hub (20% Platform / 80% Penyelenggara Komunitas).");
  const [eventPolicyHistory, setEventPolicyHistory] = useState<any[]>(DEFAULT_EVENT_POLICY.history || []);
  const [eventPolicyFeedback, setEventPolicyFeedback] = useState<string>("");
  const [isSavingEventPolicy, setIsSavingEventPolicy] = useState(false);
  const [eventSimTicketPrice, setEventSimTicketPrice] = useState<number>(50000);
  const [eventSimTicketQty, setEventSimTicketQty] = useState<number>(10);
  const [activeAdminEvents, setActiveAdminEvents] = useState<CommunityEvent[]>([]);
  const [eventOverrides, setEventOverrides] = useState<Record<string, number | null>>({});

  // Master Data Tabs & Filters State
  const [selectedMasterTab, setSelectedMasterTab] = useState("Produk & Kategori");
  const [tenantActiveTab, setTenantActiveTab] = useState<"PRODUCTS" | "PROFILE" | "PROMOS" | "ADDONS">("PRODUCTS");
  const [masterTenantFilter, setMasterTenantFilter] = useState<string>("ALL");
  const [masterCategoryFilter, setMasterCategoryFilter] = useState<string>("ALL");
  const [masterSearch, setMasterSearch] = useState<string>("");
  const [masterToast, setMasterToast] = useState<string>("");
  const [previewModalFeature, setPreviewModalFeature] = useState<{
    title: string;
    badgeLabel?: string;
    badgeVariant?: "pro" | "addon" | "enterprise";
    categoryTag?: string;
    description: string;
    benefits?: string[];
    samplePlanName?: string;
    statusText?: string;
  } | null>(null);

  // Subscription & Add-ons Commercial State
  const [orgSub, setOrgSub] = useState<OrgSubscriptionState>(getSimulatedOrgSubscription());
  const [tenantAddons, setTenantAddons] = useState<TenantAddonItem[]>(getSimulatedTenantAddons());

  // Wi-Fi Management State (Gateway MikroTik / Hotspot Engine)
  const [wifiFnBRules, setWifiFnBRules] = useState<WifiFnBRule[]>(() => getSimulatedFnBRules());
  const [wifiCwRules, setWifiCwRules] = useState<WifiCoworkingRule[]>(() => getSimulatedCoworkingRules());
  const [wifiVouchers, setWifiVouchers] = useState<WifiVoucherRecord[]>(() => getSimulatedWifiVouchers());
  const [wifiNetworkConfig] = useState<WifiNetworkConfig>(DEFAULT_NETWORK_CONFIG);
  const [wifiCalcBasis, setWifiCalcBasis] = useState<"GRAND_TOTAL" | "NET_SALES">(() => getSimulatedWifiCalcBasis());

  // Wi-Fi Voucher Filters
  const [wifiServiceFilter, setWifiServiceFilter] = useState<"ALL" | "FNB" | "COWORKING">("ALL");
  const [wifiStatusFilter, setWifiStatusFilter] = useState<"ALL" | "ACTIVE" | "USED" | "EXPIRED" | "CANCELLED">("ALL");
  const [wifiSearchQuery, setWifiSearchQuery] = useState<string>("");

  // Wi-Fi FnB Rule Add/Edit Modal State
  const [isWifiRuleModalOpen, setIsWifiRuleModalOpen] = useState(false);
  const [editingWifiRule, setEditingWifiRule] = useState<WifiFnBRule | null>(null);
  const [wifiRuleFormLabel, setWifiRuleFormLabel] = useState("");
  const [wifiRuleFormMin, setWifiRuleFormMin] = useState<number>(25000);
  const [wifiRuleFormMax, setWifiRuleFormMax] = useState<string>("");
  const [wifiRuleFormDuration, setWifiRuleFormDuration] = useState<number>(60);
  const [wifiRuleFormBandwidthDown, setWifiRuleFormBandwidthDown] = useState<number>(10);
  const [wifiRuleFormBandwidthUp, setWifiRuleFormBandwidthUp] = useState<number>(5);
  const [wifiRuleFormNotes, setWifiRuleFormNotes] = useState<string>("");
  const [wifiRuleFormError, setWifiRuleFormError] = useState<string>("");

  const handleOpenAddWifiRule = () => {
    setEditingWifiRule(null);
    setWifiRuleFormLabel("Paket Hemat Baru (1 Jam)");
    setWifiRuleFormMin(50000);
    setWifiRuleFormMax("");
    setWifiRuleFormDuration(60);
    setWifiRuleFormBandwidthDown(15);
    setWifiRuleFormBandwidthUp(5);
    setWifiRuleFormNotes("Paket internet resmi transaksi F&B");
    setWifiRuleFormError("");
    setIsWifiRuleModalOpen(true);
  };

  const handleOpenEditWifiRule = (rule: WifiFnBRule) => {
    setEditingWifiRule(rule);
    setWifiRuleFormLabel(rule.label);
    setWifiRuleFormMin(rule.minTransactionAmount);
    setWifiRuleFormMax(rule.maxTransactionAmount !== undefined ? String(rule.maxTransactionAmount) : "");
    setWifiRuleFormDuration(rule.durationMinutes);
    setWifiRuleFormBandwidthDown(rule.bandwidthLimitDownMbps || 10);
    setWifiRuleFormBandwidthUp(rule.bandwidthLimitUpMbps || 5);
    setWifiRuleFormNotes(rule.notes || "");
    setWifiRuleFormError("");
    setIsWifiRuleModalOpen(true);
  };

  const handleSaveWifiRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wifiRuleFormLabel.trim()) {
      setWifiRuleFormError("Nama label aturan wajib diisi.");
      return;
    }
    const minVal = Number(wifiRuleFormMin);
    if (isNaN(minVal) || minVal < 0) {
      setWifiRuleFormError("Minimum nominal transaksi harus berupa angka positif.");
      return;
    }
    const maxVal = wifiRuleFormMax.trim() === "" ? undefined : Number(wifiRuleFormMax);
    if (maxVal !== undefined && (isNaN(maxVal) || maxVal <= minVal)) {
      setWifiRuleFormError("Maksimum nominal harus lebih besar dari minimum nominal.");
      return;
    }

    const newRule: WifiFnBRule = {
      id: editingWifiRule ? editingWifiRule.id : `rule-fnb-${Date.now()}`,
      minTransactionAmount: minVal,
      maxTransactionAmount: maxVal,
      durationMinutes: Number(wifiRuleFormDuration) || 60,
      bandwidthLimitDownMbps: Number(wifiRuleFormBandwidthDown) || 10,
      bandwidthLimitUpMbps: Number(wifiRuleFormBandwidthUp) || 5,
      label: wifiRuleFormLabel.trim(),
      isActive: editingWifiRule ? editingWifiRule.isActive : true,
      notes: wifiRuleFormNotes.trim() || undefined,
    };

    let updatedRules: WifiFnBRule[];
    if (editingWifiRule) {
      updatedRules = wifiFnBRules.map((r) => (r.id === editingWifiRule.id ? newRule : r));
    } else {
      updatedRules = [...wifiFnBRules, newRule];
    }

    const overlap = validateFnBRulesOverlap(updatedRules);
    if (overlap.hasOverlap) {
      setWifiRuleFormError(overlap.errorMessage || "Terdeteksi rentang nominal tumpang-tindih dengan aturan lain.");
      return;
    }

    const res = saveSimulatedFnBRules(updatedRules);
    if (!res.success) {
      setWifiRuleFormError(res.error || "Gagal menyimpan aturan Wi-Fi.");
      return;
    }

    setWifiFnBRules(updatedRules);
    setIsWifiRuleModalOpen(false);
    showMasterToast(`Aturan Wi-Fi F&B "${newRule.label}" berhasil disimpan.`);
  };

  const handleToggleWifiRuleStatus = (ruleId: string) => {
    const updated = wifiFnBRules.map((r) => (r.id === ruleId ? { ...r, isActive: !r.isActive } : r));
    const overlap = validateFnBRulesOverlap(updated);
    if (overlap.hasOverlap) {
      showMasterToast(overlap.errorMessage || "Tidak dapat mengaktifkan aturan: rentang tumpang tindih.");
      return;
    }
    saveSimulatedFnBRules(updated);
    setWifiFnBRules(updated);
    showMasterToast("Status aturan Wi-Fi berhasil diperbarui.");
  };

  const handleDeleteWifiRule = (ruleId: string) => {
    const updated = wifiFnBRules.filter((r) => r.id !== ruleId);
    saveSimulatedFnBRules(updated);
    setWifiFnBRules(updated);
    showMasterToast("Aturan Wi-Fi berhasil dihapus.");
  };

  const handleRevokeVoucher = (voucherId: string) => {
    revokeSimulatedWifiVoucher(voucherId);
    setWifiVouchers(getSimulatedWifiVouchers());
    showMasterToast("Voucher berhasil dibatalkan statusnya.");
  };

  // Modals for Product Master Data
  const [isAddProdModalOpen, setIsAddProdModalOpen] = useState(false);
  const [isEditProdModalOpen, setIsEditProdModalOpen] = useState(false);
  const [editingProd, setEditingProd] = useState<MasterProduct | null>(null);
  const [isDeleteProdModalOpen, setIsDeleteProdModalOpen] = useState(false);
  const [deletingProd, setDeletingProd] = useState<MasterProduct | null>(null);

  // Product Form Fields
  const [formProdName, setFormProdName] = useState("");
  const [formProdCat, setFormProdCat] = useState("Minuman");
  const [formProdTenantId, setFormProdTenantId] = useState("tenant-ks");
  const [formProdPrice, setFormProdPrice] = useState<number>(25000);
  const [formProdCogs, setFormProdCogs] = useState<number>(9000);
  const [formProdDesc, setFormProdDesc] = useState("");
  const [formProdImg, setFormProdImg] = useState("");
  const [formProdStatus, setFormProdStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");

  // Category Modal
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);
  const [formNewCatName, setFormNewCatName] = useState("");

  const showMasterToast = (msg: string) => {
    setMasterToast(msg);
    setTimeout(() => setMasterToast(""), 3500);
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const result = loadEvt.target?.result as string;
      if (result) {
        callback(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleOpenAddProduct = () => {
    setFormProdName("");
    setFormProdCat(categories[0] || "Minuman");
    setFormProdTenantId(user?.tenant?.id || "tenant-ks");
    setFormProdPrice(25000);
    setFormProdCogs(9000);
    setFormProdDesc("");
    setFormProdImg("");
    setFormProdStatus("ACTIVE");
    setIsAddProdModalOpen(true);
  };

  const handleSaveNewProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProdName.trim()) return;

    addProduct({
      name: formProdName.trim(),
      category: formProdCat,
      basePrice: Number(formProdPrice) || 0,
      cogsEstimate: Number(formProdCogs) || 0,
      status: formProdStatus,
      outletId: "ALL",
      outletName: "Semua Outlet",
      isAvailable: formProdStatus === "ACTIVE",
      description: formProdDesc.trim(),
      imageUrl: formProdImg.trim() || undefined,
      tenantId: formProdTenantId,
    });

    setIsAddProdModalOpen(false);
    showMasterToast(`Produk "${formProdName}" berhasil ditambahkan ke Master Data & disinkronkan.`);
  };

  const handleOpenEditProduct = (prod: MasterProduct) => {
    setEditingProd(prod);
    setFormProdName(prod.name);
    setFormProdCat(prod.category);
    setFormProdTenantId(prod.tenantId || "tenant-ks");
    setFormProdPrice(prod.basePrice);
    setFormProdCogs(prod.cogsEstimate || 0);
    setFormProdDesc(prod.description || "");
    setFormProdImg(prod.imageUrl || "");
    setFormProdStatus(prod.status);
    setIsEditProdModalOpen(true);
  };

  const handleSaveEditProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProd || !formProdName.trim()) return;

    updateProduct(
      editingProd.id,
      {
        name: formProdName.trim(),
        category: formProdCat,
        tenantId: formProdTenantId,
        basePrice: Number(formProdPrice) || 0,
        cogsEstimate: Number(formProdCogs) || 0,
        description: formProdDesc.trim(),
        imageUrl: formProdImg.trim() || undefined,
        status: formProdStatus,
        isAvailable: formProdStatus === "ACTIVE",
      },
      "Update Master Data via Settings"
    );

    setIsEditProdModalOpen(false);
    setEditingProd(null);
    showMasterToast(`Perubahan produk "${formProdName}" berhasil disimpan & langsung aktif di POS & Customer Portal.`);
  };

  const handleConfirmDeleteProduct = () => {
    if (!deletingProd) return;
    deleteProduct(deletingProd.id);
    showMasterToast(`Produk "${deletingProd.name}" berhasil dihapus dari Master Data.`);
    setIsDeleteProdModalOpen(false);
    setDeletingProd(null);
  };

  const handleSaveNewCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNewCatName.trim()) return;
    addCategory(formNewCatName.trim());
    setIsAddCatModalOpen(false);
    setFormNewCatName("");
    showMasterToast(`Kategori "${formNewCatName}" berhasil ditambahkan ke Master Data.`);
  };

  // Local Tenants for Master Data
  const [localTenants, setLocalTenants] = useState<any[]>(() => getAllFnbTenants());
  const [isAddTenantModalOpen, setIsAddTenantModalOpen] = useState(false);
  const [formTenantName, setFormTenantName] = useState("");
  const [formTenantCode, setFormTenantCode] = useState("");
  const [formTenantBadge, setFormTenantBadge] = useState("");

  const handleSaveNewTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTenantName.trim()) return;
    const newId = `tenant-${Date.now()}`;
    const newCode = formTenantCode.trim().toUpperCase() || `TENANT-${Math.floor(100 + Math.random() * 900)}`;
    const newTenant = {
      id: newId,
      name: formTenantName.trim(),
      code: newCode,
      badge: formTenantBadge.trim() || formTenantName.trim(),
      defaultSharePercent: 85,
      tagline: "Mitra Resmi Dago",
      desc: "Mitra resmi platform Dago Hub",
      icon: "Store",
    };
    setLocalTenants((prev) => [...prev, newTenant]);
    saveCustomTenant(newTenant);
    setTenantRevenueSplit(newId, 85);
    setIsAddTenantModalOpen(false);
    setFormTenantName("");
    setFormTenantCode("");
    setFormTenantBadge("");
    showMasterToast(`Mitra "${newTenant.name}" berhasil ditambahkan ke Master Data.`);
  };

  // Local Coworking Spaces for Master Data (Synced with CoworkingContext)
  const [localSpaces, setLocalSpaces] = useState<any[]>(cwSpaces);

  useEffect(() => {
    if (cwSpaces && cwSpaces.length > 0) {
      setLocalSpaces(cwSpaces);
    }
  }, [cwSpaces]);

  const [isAddSpaceModalOpen, setIsAddSpaceModalOpen] = useState(false);
  const [isEditSpaceModalOpen, setIsEditSpaceModalOpen] = useState(false);
  const [editingSpace, setEditingSpace] = useState<any>(null);
  const [isDeleteSpaceModalOpen, setIsDeleteSpaceModalOpen] = useState(false);
  const [deletingSpace, setDeletingSpace] = useState<any>(null);
  const [formSpaceName, setFormSpaceName] = useState("");
  const [formSpaceType, setFormSpaceType] = useState<string>("HOT_DESK");
  const [formSpaceArea, setFormSpaceArea] = useState("Ground Floor Main");
  const [formSpaceCap, setFormSpaceCap] = useState(4);
  const [formSpaceHourly, setFormSpaceHourly] = useState(15000);
  const [formSpaceDaily, setFormSpaceDaily] = useState(65000);
  const [formSpaceStatus, setFormSpaceStatus] = useState<string>("AVAILABLE");
  const [formSpaceImg, setFormSpaceImg] = useState("");

  const handleOpenAddSpace = () => {
    setFormSpaceName("");
    setFormSpaceType("HOT_DESK");
    setFormSpaceArea("Ground Floor Main");
    setFormSpaceCap(4);
    setFormSpaceHourly(15000);
    setFormSpaceDaily(65000);
    setFormSpaceStatus("AVAILABLE");
    setFormSpaceImg("");
    setIsAddSpaceModalOpen(true);
  };

  const handleSaveNewSpace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSpaceName.trim()) return;
    const newSpacePayload = {
      name: formSpaceName.trim(),
      type: formSpaceType.trim() || "HOT_DESK",
      area: formSpaceArea.trim() || "Ground Floor Main",
      capacity: Number(formSpaceCap) || 1,
      hourlyRate: Number(formSpaceHourly) || 15000,
      dailyRate: Number(formSpaceDaily) || 65000,
      status: formSpaceStatus as any,
      imageUrl: formSpaceImg.trim() || undefined,
      amenities: ["WiFi 100Mbps", "Power Hub", "Air Conditioner"],
    };
    const created = addSpace(newSpacePayload);
    setLocalSpaces((prev) => [...prev, created]);
    setIsAddSpaceModalOpen(false);
    showMasterToast(`Ruang "${created.name}" (${created.type}) berhasil ditambahkan ke Master Data.`);
  };

  const handleOpenEditSpace = (sp: any) => {
    setEditingSpace(sp);
    setFormSpaceName(sp.name);
    setFormSpaceType(sp.type || "HOT_DESK");
    setFormSpaceArea(sp.area || "Ground Floor Main");
    setFormSpaceCap(sp.capacity || 1);
    setFormSpaceHourly(sp.hourlyRate || 15000);
    setFormSpaceDaily(sp.dailyRate || 65000);
    setFormSpaceStatus(sp.status || "AVAILABLE");
    setFormSpaceImg(sp.imageUrl || "");
    setIsEditSpaceModalOpen(true);
  };

  const handleSaveEditSpace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSpace || !formSpaceName.trim()) return;
    const updates = {
      name: formSpaceName.trim(),
      type: formSpaceType.trim() || "HOT_DESK",
      area: formSpaceArea.trim() || "Ground Floor Main",
      capacity: Number(formSpaceCap) || 1,
      hourlyRate: Number(formSpaceHourly) || 15000,
      dailyRate: Number(formSpaceDaily) || 65000,
      status: formSpaceStatus as any,
      imageUrl: formSpaceImg.trim() || undefined,
    };
    updateSpace(editingSpace.id, updates);
    setLocalSpaces((prev) =>
      prev.map((s) => (s.id === editingSpace.id ? { ...s, ...updates } : s))
    );
    setIsEditSpaceModalOpen(false);
    setEditingSpace(null);
    showMasterToast(`Perubahan ruang "${formSpaceName}" berhasil disimpan ke Master Data.`);
  };

  const handleConfirmDeleteSpace = () => {
    if (!deletingSpace) return;
    deleteSpace(deletingSpace.id);
    setLocalSpaces((prev) => prev.filter((s) => s.id !== deletingSpace.id));
    setIsDeleteSpaceModalOpen(false);
    setDeletingSpace(null);
    showMasterToast(`Ruang "${deletingSpace.name}" berhasil dihapus dari Master Data.`);
  };

  // Local Membership Plans for Master Data
  const [localPlans, setLocalPlans] = useState<any[]>(MEMBERSHIP_PLANS);
  const [isAddPlanModalOpen, setIsAddPlanModalOpen] = useState(false);
  const [isEditPlanModalOpen, setIsEditPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [isDeletePlanModalOpen, setIsDeletePlanModalOpen] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState<any>(null);
  const [formPlanName, setFormPlanName] = useState("");
  const [formPlanCycle, setFormPlanCycle] = useState("Bulanan");
  const [formPlanPrice, setFormPlanPrice] = useState(500000);
  const [formPlanDeskAccess, setFormPlanDeskAccess] = useState("Akses Hot Desk Bebas Pakai");

  const handleOpenAddPlan = () => {
    setFormPlanName("");
    setFormPlanCycle("Bulanan");
    setFormPlanPrice(500000);
    setFormPlanDeskAccess("Akses Hot Desk Bebas Pakai");
    setIsAddPlanModalOpen(true);
  };

  const handleSaveNewPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPlanName.trim()) return;
    const newPlan = {
      id: `plan-${Date.now()}`,
      name: formPlanName.trim(),
      billingCycle: formPlanCycle,
      priceNumber: Number(formPlanPrice) || 0,
      priceFormatted: formatCurrencyIDR(Number(formPlanPrice) || 0),
      deskAccess: formPlanDeskAccess.trim(),
      amenities: ["WiFi Ultra-Fast", "Power Outlet", "Free Water"],
    };
    setLocalPlans((prev) => [...prev, newPlan]);
    setIsAddPlanModalOpen(false);
    showMasterToast(`Paket Membership "${newPlan.name}" berhasil ditambahkan.`);
  };

  const handleOpenEditPlan = (pl: any) => {
    setEditingPlan(pl);
    setFormPlanName(pl.name);
    setFormPlanCycle(pl.billingCycle || "Bulanan");
    setFormPlanPrice(pl.priceNumber || 500000);
    setFormPlanDeskAccess(pl.deskAccess || "");
    setIsEditPlanModalOpen(true);
  };

  const handleSaveEditPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan || !formPlanName.trim()) return;
    setLocalPlans((prev) =>
      prev.map((p) =>
        p.id === editingPlan.id
          ? {
            ...p,
            name: formPlanName.trim(),
            billingCycle: formPlanCycle,
            priceNumber: Number(formPlanPrice) || 0,
            priceFormatted: formatCurrencyIDR(Number(formPlanPrice) || 0),
            deskAccess: formPlanDeskAccess.trim(),
          }
          : p
      )
    );
    setIsEditPlanModalOpen(false);
    setEditingPlan(null);
    showMasterToast(`Perubahan paket "${formPlanName}" berhasil disimpan.`);
  };

  const handleConfirmDeletePlan = () => {
    if (!deletingPlan) return;
    setLocalPlans((prev) => prev.filter((p) => p.id !== deletingPlan.id));
    setIsDeletePlanModalOpen(false);
    setDeletingPlan(null);
    showMasterToast(`Paket "${deletingPlan.name}" berhasil dihapus.`);
  };

  // Local Tables for Master Data
  const [localTables, setLocalTables] = useState<any[]>(allTables);
  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);
  const [isEditTableModalOpen, setIsEditTableModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<any>(null);
  const [isDeleteTableModalOpen, setIsDeleteTableModalOpen] = useState(false);
  const [deletingTable, setDeletingTable] = useState<any>(null);
  const [formTableNumber, setFormTableNumber] = useState<number>(allTables.length + 1);
  const [formTableArea, setFormTableArea] = useState("Main Hall");
  const [formTableCap, setFormTableCap] = useState(4);
  const [formTableStatus, setFormTableStatus] = useState<string>("AVAILABLE");

  const handleOpenAddTable = () => {
    setFormTableNumber(localTables.length + 1);
    setFormTableArea("Main Hall");
    setFormTableCap(4);
    setFormTableStatus("AVAILABLE");
    setIsAddTableModalOpen(true);
  };

  const handleSaveNewTable = (e: React.FormEvent) => {
    e.preventDefault();
    const newTable = {
      id: `tbl-${Date.now()}`,
      number: String(formTableNumber) || String(localTables.length + 1),
      areaName: formTableArea,
      cap: Number(formTableCap) || 4,
      status: formTableStatus as any,
      outletId: "outlet-1",
      outletName: "Dago Hub Main",
    };
    setLocalTables((prev) => [...prev, newTable]);
    setIsAddTableModalOpen(false);
    showMasterToast(`Meja ${newTable.number} (${newTable.areaName}) berhasil ditambahkan.`);
  };

  const handleOpenEditTable = (tbl: any) => {
    setEditingTable(tbl);
    setFormTableNumber(tbl.number);
    setFormTableArea(tbl.areaName || "Main Hall");
    setFormTableCap(tbl.cap || 4);
    setFormTableStatus(tbl.status || "AVAILABLE");
    setIsEditTableModalOpen(true);
  };

  const handleSaveEditTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTable) return;
    setLocalTables((prev) =>
      prev.map((t) =>
        t.id === editingTable.id
          ? {
            ...t,
            number: Number(formTableNumber) || t.number,
            areaName: formTableArea,
            cap: Number(formTableCap) || 4,
            status: formTableStatus as any,
          }
          : t
      )
    );
    setIsEditTableModalOpen(false);
    setEditingTable(null);
    showMasterToast(`Perubahan Meja ${formTableNumber} berhasil disimpan.`);
  };

  const handleToggleTableStatus = (tblId: string) => {
    setLocalTables((prev) =>
      prev.map((t) => {
        if (t.id !== tblId) return t;
        const next = t.status === "AVAILABLE" ? "OCCUPIED" : t.status === "OCCUPIED" ? "RESERVED" : "AVAILABLE";
        return { ...t, status: next };
      })
    );
    showMasterToast("Status meja berhasil diubah.");
  };

  const handleConfirmDeleteTable = () => {
    if (!deletingTable) return;
    setLocalTables((prev) => prev.filter((t) => t.id !== deletingTable.id));
    setIsDeleteTableModalOpen(false);
    setDeletingTable(null);
    showMasterToast(`Meja ${deletingTable.number} berhasil dihapus.`);
  };

  const MASTER_DATA_TABS = [
    "Produk & Kategori",
    "Mitra & Bagi Hasil",
    "Co-working & Ruangan",
    "Meja & Area",
    "Voucher & Promo",
    "Konfigurasi Platform & Pajak",
    "Paket Langganan & Add-on",
    "Manajemen Wi-Fi",
  ];

  const MASTER_TAB_ICONS: Record<string, React.ReactNode> = {
    "Produk & Kategori": <UtensilsCrossed className="w-3.5 h-3.5" />,
    "Mitra & Bagi Hasil": <Store className="w-3.5 h-3.5" />,
    "Co-working & Ruangan": <Laptop className="w-3.5 h-3.5" />,
    "Meja & Area": <Grid className="w-3.5 h-3.5" />,
    "Voucher & Promo": <Tag className="w-3.5 h-3.5" />,
    "Konfigurasi Platform & Pajak": <Settings className="w-3.5 h-3.5" />,
    "Paket Langganan & Add-on": <Sparkles className="w-3.5 h-3.5 text-purple-600" />,
    "Manajemen Wi-Fi": <Wifi className="w-3.5 h-3.5 text-blue-600" />,
  };

  // Filtered & Sorted Master Products (Revisi 7)
  const sortProducts = (list: MasterProduct[]) => {
    return [...list].sort((a, b) => {
      if (masterSortOrder === "UPDATED_DESC") {
        return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      }
      if (masterSortOrder === "UPDATED_ASC") {
        return new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime();
      }
      if (masterSortOrder === "NAME_ASC") {
        return a.name.localeCompare(b.name);
      }
      if (masterSortOrder === "PRICE_ASC") {
        return a.basePrice - b.basePrice;
      }
      if (masterSortOrder === "PRICE_DESC") {
        return b.basePrice - a.basePrice;
      }
      return 0;
    });
  };

  const displayedMasterProducts = sortProducts(
    filteredProducts.filter((p) => {
      const matchTenant = masterTenantFilter === "ALL" || p.tenantId === masterTenantFilter;
      const matchCategory = masterCategoryFilter === "ALL" || p.category === masterCategoryFilter;
      const matchStatus = masterStatusFilter === "ALL" || p.status === masterStatusFilter;
      const matchSearch =
        p.name.toLowerCase().includes(masterSearch.toLowerCase()) ||
        p.category.toLowerCase().includes(masterSearch.toLowerCase()) ||
        (p.tenantId && getTenantName(p.tenantId)?.toLowerCase().includes(masterSearch.toLowerCase()));
      return matchTenant && matchCategory && matchStatus && matchSearch;
    })
  );

  const refreshRevenueSplits = () => {
    setRevenueSplits(getAllTenantRevenueSplits());
  };

  const refreshAllTenantStatuses = () => {
    const statuses: Record<string, "ACTIVE" | "INACTIVE"> = {};
    DEFAULT_FNB_TENANTS.forEach((t) => {
      statuses[t.id] = getTenantStatus(t.id);
    });
    setAllTenantStatuses(statuses);
  };

  useEffect(() => {
    refreshAllTenantStatuses();
    refreshRevenueSplits();

    const currentScopeId = isTenantOwner ? (user?.tenant?.id || "tenant-unassigned") : "org-dago-hub";
    setTenantAddons(getSimulatedTenantAddons(currentScopeId));

    const handleSubscriptionUpdate = () => {
      setOrgSub(getSimulatedOrgSubscription());
      const activeScope = isTenantOwner ? (user?.tenant?.id || "tenant-unassigned") : "org-dago-hub";
      setTenantAddons(getSimulatedTenantAddons(activeScope));
    };

    window.addEventListener("subscription_state_updated", handleSubscriptionUpdate);
    return () => window.removeEventListener("subscription_state_updated", handleSubscriptionUpdate);
  }, [user, isTenantOwner]);

  // Load Organizers, Event Policy, and Events
  useEffect(() => {
    fetch("/api/events/admin/organizers")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setOrganizers(data.data);
        }
      })
      .catch(() => {});

    fetch("/api/events/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          setEventPlatformFee(data.data.defaultPlatformFeePercent ?? 20);
          setEventPolicyEffectiveDate(data.data.effectiveDate || "2026-01-01T00:00:00.000Z");
          setEventPolicyNotes(data.data.policyNotes || "");
          setEventPolicyHistory(data.data.history || []);
        }
      })
      .catch(() => {});

    fetch("/api/events/admin")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setActiveAdminEvents(data.data);
          const overrides: Record<string, number | null> = {};
          data.data.forEach((evt: CommunityEvent) => {
            overrides[evt.id] = evt.customPlatformFeePercent ?? null;
          });
          setEventOverrides(overrides);
        }
      })
      .catch(() => {});
  }, []);

  const handleToggleOrganizerStatus = async (orgId: string, currentStatus: "ACTIVE" | "INACTIVE") => {
    const nextStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await fetch("/api/events/admin/organizers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orgId, status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setOrganizers((prev) =>
          prev.map((o) => (o.id === orgId ? { ...o, status: nextStatus, updatedAt: new Date().toISOString() } : o))
        );
        showMasterToast(`Status akun penyelenggara diubah menjadi ${nextStatus === "ACTIVE" ? "AKTIF" : "NONAKTIF"}.`);
      } else {
        showMasterToast(data.error || "Gagal mengubah status penyelenggara.");
      }
    } catch {
      showMasterToast("Terjadi kesalahan koneksi saat mengubah status.");
    }
  };

  const handleCreateOrganizerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddOrgError("");
    if (!newOrgName.trim() || !newOrgPIC.trim() || !newOrgPhone.trim() || !newOrgEmail.trim()) {
      setAddOrgError("Seluruh field bertanda bintang (*) wajib diisi.");
      return;
    }

    setIsSubmittingOrg(true);
    try {
      const res = await fetch("/api/events/admin/organizers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newOrgName.trim(),
          category: newOrgCategory.trim(),
          contactPerson: newOrgPIC.trim(),
          phone: newOrgPhone.trim(),
          email: newOrgEmail.trim().toLowerCase(),
          notes: newOrgNotes.trim(),
          initialStatus: newOrgStatus,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setOrganizers((prev) => [data.data, ...prev]);
        setIsAddOrganizerModalOpen(false);
        setNewOrgName("");
        setNewOrgCategory("Komunitas Kreatif");
        setNewOrgPIC("");
        setNewOrgPhone("");
        setNewOrgEmail("");
        setNewOrgNotes("");
        setNewOrgStatus("ACTIVE");
        showMasterToast(`Penyelenggara [${data.data.name}] berhasil didaftarkan.`);
      } else {
        setAddOrgError(data.error || "Gagal mendaftarkan penyelenggara.");
      }
    } catch {
      setAddOrgError("Terjadi kesalahan jaringan saat mendaftarkan penyelenggara.");
    } finally {
      setIsSubmittingOrg(false);
    }
  };

  const handleGenerateActivationLink = async (orgId: string) => {
    setIsGeneratingInvite(true);
    setCopiedLink(false);
    try {
      const res = await fetch("/api/events/admin/organizers/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizerId: orgId }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        const fullUrl = `${window.location.origin}${data.data.activationUrl}`;
        const orgName = data.data.organizer?.name || data.data.organizerName || "Komunitas";
        const orgEmail = data.data.organizer?.email || data.data.email || "";
        setActivationModalData({
          organizerName: orgName,
          organizerEmail: orgEmail,
          activationUrl: fullUrl,
          expiresAt: data.data.expiresAt,
        });
        fetch("/api/events/admin/organizers")
          .then((r) => r.json())
          .then((d) => {
            if (d.success && Array.isArray(d.data)) setOrganizers(d.data);
          })
          .catch(() => {});
        showMasterToast(`Tautan aktivasi untuk [${orgName}] berhasil diterbitkan.`);
      } else {
        showMasterToast(data.error || "Gagal menerbitkan tautan aktivasi.");
      }
    } catch {
      showMasterToast("Terjadi kesalahan jaringan saat menerbitkan tautan aktivasi.");
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  const handleSaveEventRevenuePolicy = async () => {
    setIsSavingEventPolicy(true);
    setEventPolicyFeedback("");
    try {
      const res = await fetch("/api/events/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultPlatformFeePercent: eventPlatformFee,
          policyNotes: eventPolicyNotes,
          effectiveDate: eventPolicyEffectiveDate,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setEventPolicyHistory(data.data.history || []);
        setEventPolicyFeedback(`Kebijakan komisi platform berhasil disimpan (${eventPlatformFee}% DAGO / ${100 - eventPlatformFee}% Penyelenggara).`);
        showMasterToast("Kebijakan komisi Event Marketplace berhasil disimpan.");
        updateSettings({
          eventRevenueSharing: data.data,
        });
      } else {
        setEventPolicyFeedback(`Error: ${data.error || "Gagal menyimpan kebijakan."}`);
      }
    } catch {
      setEventPolicyFeedback("Error: Terjadi kesalahan jaringan saat menyimpan kebijakan.");
    } finally {
      setIsSavingEventPolicy(false);
    }
  };

  const handleSaveEventOverride = async (eventId: string, customFeePercent: number | null) => {
    try {
      const res = await fetch("/api/events/admin/commission-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, customPlatformFeePercent: customFeePercent }),
      });
      const data = await res.json();
      if (data.success) {
        setEventOverrides((prev) => ({ ...prev, [eventId]: customFeePercent }));
        setActiveAdminEvents((prev) =>
          prev.map((e) => (e.id === eventId ? { ...e, customPlatformFeePercent: customFeePercent } : e))
        );
        showMasterToast(
          customFeePercent !== null
            ? `Override komisi ${customFeePercent}% berhasil disimpan untuk event ini.`
            : "Override komisi dihapus, kembali ke default platform."
        );
      } else {
        showMasterToast(data.error || "Gagal menyimpan override komisi event.");
      }
    } catch {
      showMasterToast("Terjadi kesalahan koneksi saat menyimpan override event.");
    }
  };

  useEffect(() => {
    if (!isTenantOwner || !user?.tenant?.id) return;
    try {
      const currentTenantId = user.tenant.id;
      const profile = getTenantProfile(currentTenantId);
      setTenantBrandName(profile.brandName);
      setTenantTagline(profile.tagline);
      setTenantDesc(profile.description);
      setTenantPhone(profile.contactPhone);
      setTenantReceiptHeader(profile.receiptHeader);
      setTenantReceiptFooter(profile.receiptFooter);
      setTenantLowStock(profile.lowStockThresholdPercent);
      setBankName(profile.bankName);
      setBankAccountNumber(profile.bankAccountNumber);
      setBankAccountHolder(profile.bankAccountHolder);
      setTenantStatusState(profile.status);
    } catch (e) {
      console.error("Failed to load tenant settings", e);
    }
  }, [user, isTenantOwner]);

  const handleTenantSplitChange = (tenantId: string, tenantShare: number) => {
    const validTenantShare = Math.max(0, Math.min(100, isNaN(tenantShare) ? 0 : tenantShare));
    const dagoShare = 100 - validTenantShare;

    // Clear error for this tenant if valid
    setRevenueSplitErrors((prev) => {
      const next = { ...prev };
      delete next[tenantId];
      return next;
    });

    setRevenueSplits((prev) => {
      const existing = prev[tenantId] || {
        tenantId,
        tenantName: DEFAULT_FNB_TENANTS.find((t) => t.id === tenantId)?.name || tenantId,
        status: "ACTIVE",
        tenantSharePercent: 85,
        dagoSharePercent: 15,
      };
      return {
        ...prev,
        [tenantId]: {
          ...existing,
          tenantSharePercent: validTenantShare,
          dagoSharePercent: dagoShare,
        },
      };
    });
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate and save revenue splits
    let hasSplitError = false;
    const newErrors: Record<string, string> = {};

    Object.values(revenueSplits).forEach((cfg) => {
      if (cfg.tenantSharePercent < 0 || cfg.tenantSharePercent > 100) {
        newErrors[cfg.tenantId] = "Persentase harus antara 0% dan 100%";
        hasSplitError = true;
      } else if (Math.round(cfg.tenantSharePercent + cfg.dagoSharePercent) !== 100) {
        newErrors[cfg.tenantId] = "Total pembagian (Mitra + DAGO) harus 100%";
        hasSplitError = true;
      }
    });

    if (hasSplitError) {
      setRevenueSplitErrors(newErrors);
      return;
    }

    // Persist each tenant revenue split
    Object.values(revenueSplits).forEach((cfg) => {
      setTenantRevenueSplit(cfg.tenantId, cfg.tenantSharePercent, cfg.dagoSharePercent);
    });

    updateSettings({
      language,
      timezone,
      currency,
      lowStockThresholdPercent: Number(lowStock),
      taxRatePercent: Number(taxRate),
      serviceChargePercent: Number(serviceCharge),
      loyaltyTiers: {
        bronzeMin: 0,
        bronzeMax: Number(silverPts) - 1,
        silverMin: Number(silverPts),
        silverMax: Number(goldPts) - 1,
        goldMin: Number(goldPts),
        goldMax: Number(platPts) - 1,
        platinumMin: Number(platPts),
      },
      promos,
      coworkingHolidays: {
        defaultWeekendClosed: cwWeekendClosed,
        nationalHolidays: cwNationalHolidaysClosed ? INDONESIAN_NATIONAL_HOLIDAYS_2026 : [],
        closeOnWeekends: cwWeekendClosed,
        closeOnNationalHolidays: cwNationalHolidaysClosed,
        overrides: cwOverrides,
      },
      operationalHours: {
        coworking: {
          openTime: cwOpenTime,
          closeTime: cwCloseTime,
          isOpen: true,
          open: cwOpenTime,
          close: cwCloseTime,
          allowBookingOutsideHours: false,
        },
        fnb: {
          openTime: fnbOpenTime,
          closeTime: fnbCloseTime,
          isOpen: true,
          open: fnbOpenTime,
          close: fnbCloseTime,
          allowOrderOutsideHours: false,
        },
      },
      tenantOperations: tenantOps,
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  // Promo Product Multi-Select Handlers (Revisi 5)
  const handleOpenPromoProductSelect = (promoId: string) => {
    const targetPromo = promos.find((p) => p.id === promoId);
    if (!targetPromo) return;
    setActivePromoIdForProductSelect(promoId);
    let initialIds: string[] = [];
    if (targetPromo.applicableProductIds && targetPromo.applicableProductIds.length > 0) {
      initialIds = [...targetPromo.applicableProductIds];
    } else if (targetPromo.targetId) {
      initialIds = targetPromo.targetId.split(",").map((s) => s.trim()).filter(Boolean);
    }
    setSelectedProductIdsInModal(initialIds);
    setPromoProductSearch("");
    setPromoProductCategoryFilter("ALL");
    setPromoProductTenantFilter("ALL");
    setIsPromoProductModalOpen(true);
  };

  const handleToggleModalProduct = (productId: string) => {
    setSelectedProductIdsInModal((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const handleSelectAllModalProducts = (ids: string[]) => {
    setSelectedProductIdsInModal((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const handleClearAllModalProducts = () => {
    setSelectedProductIdsInModal([]);
  };

  const handleSavePromoProducts = () => {
    if (!activePromoIdForProductSelect) return;
    setPromos((prev) =>
      prev.map((p) => {
        if (p.id !== activePromoIdForProductSelect) return p;
        return {
          ...p,
          applicableProductIds: selectedProductIdsInModal,
          targetId: selectedProductIdsInModal.join(","),
        };
      })
    );
    setIsPromoProductModalOpen(false);
    showMasterToast(`${selectedProductIdsInModal.length} produk menu berhasil dikaitkan ke kupon diskon.`);
  };

  const handleRemoveProductFromPromo = (promoId: string, productId: string) => {
    setPromos((prev) =>
      prev.map((p) => {
        if (p.id !== promoId) return p;
        const currentList = p.applicableProductIds || (p.targetId ? p.targetId.split(",").map((s) => s.trim()).filter(Boolean) : []);
        const nextList = currentList.filter((id) => id !== productId);
        return {
          ...p,
          applicableProductIds: nextList,
          targetId: nextList.join(","),
        };
      })
    );
  };

  // Co-working Holiday Override Handlers (Revisi 1)
  const handleAddHolidayOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOverrideDate) return;
    const newEntry: HolidayOverride = {
      date: newOverrideDate,
      isOpen: newOverrideType === "OPEN",
      type: newOverrideType,
      reason: newOverrideReason.trim() || undefined,
    };
    setCwOverrides((prev) => {
      const filtered = prev.filter((o) => o.date !== newOverrideDate);
      return [...filtered, newEntry];
    });
    setNewOverrideDate("");
    setNewOverrideReason("");
    showMasterToast(`Override tanggal ${newOverrideDate} (${newOverrideType === "OPEN" ? "Buka Khusus" : "Tutup Khusus"}) berhasil ditambahkan.`);
  };

  const handleRemoveHolidayOverride = (dateStr: string) => {
    setCwOverrides((prev) => prev.filter((o) => o.date !== dateStr));
    showMasterToast(`Override tanggal ${dateStr} dihapus.`);
  };

  // Tenant Operation Controls Handler (Revisi 2)
  const handleUpdateTenantOperation = (
    tenantId: string,
    field: keyof TenantOperationConfig,
    value: any
  ) => {
    setTenantOps((prev) => {
      const existing: TenantOperationConfig = prev[tenantId] || {
        isOpenOrder: true,
        tenantId,
        tenantName: localTenants.find((t) => t.id === tenantId)?.name || tenantId,
        isAcceptingOrders: true,
        openTime: "08:00",
        closeTime: "21:00",
      };
      return {
        ...prev,
        [tenantId]: {
          ...existing,
          [field]: value,
          ...(field === "isOpenOrder" ? { isAcceptingOrders: value } : {}),
          ...(field === "isAcceptingOrders" ? { isOpenOrder: value } : {}),
        },
      };
    });
  };

  const handleSaveTenantSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setBankFormError("");

    // Minimal Validation for Bank Account
    if (bankAccountNumber.trim() && !bankAccountHolder.trim()) {
      setBankFormError("Nama pemilik rekening wajib diisi jika nomor rekening dimasukkan.");
      return;
    }

    const currentTenantId = user?.tenant?.id || "tenant-ks";
    let existingMap: Record<string, any> = {};

    try {
      const raw = localStorage.getItem("dagoeng_tenant_settings_v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          if (parsed.tenantId && typeof parsed.tenantId === "string") {
            existingMap[parsed.tenantId] = parsed;
          } else {
            existingMap = parsed;
          }
        }
      }
    } catch (err) {
      console.error("Failed reading existing tenant settings map", err);
    }

    existingMap[currentTenantId] = {
      tenantId: currentTenantId,
      brandName: tenantBrandName.trim(),
      tagline: tenantTagline.trim(),
      description: tenantDesc.trim(),
      contactPhone: tenantPhone.trim(),
      receiptHeader: tenantReceiptHeader.trim(),
      receiptFooter: tenantReceiptFooter.trim(),
      lowStockThresholdPercent: Number(tenantLowStock),
      bankName: bankName,
      bankAccountNumber: bankAccountNumber.trim(),
      bankAccountHolder: bankAccountHolder.trim(),
      status: tenantStatus,
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem("dagoeng_tenant_settings_v1", JSON.stringify(existingMap));
      window.dispatchEvent(new Event("tenant_settings_updated"));
    } catch (err) {
      console.error("Failed saving tenant settings", err);
    }

    const updatedTenantOps: Record<string, TenantOperationConfig> = {
      ...tenantOps,
      [currentTenantId]: {
        isOpenOrder: tenantStatus === "ACTIVE",
        tenantId: currentTenantId,
        tenantName: tenantBrandName.trim(),
        isAcceptingOrders: tenantStatus === "ACTIVE",
        openTime: tenantOpenTime,
        closeTime: tenantCloseTime,
        temporaryClosedReason: tenantClosedReason.trim() || undefined,
      },
    };
    setTenantOps(updatedTenantOps);
    updateSettings({ tenantOperations: updatedTenantOps });

    setTenantSavedSuccess(true);
    setTimeout(() => setTenantSavedSuccess(false), 3500);
  };

  const moduleDefinitions = [
    {
      code: "FNB",
      name: "Food & Beverage (F&B)",
      desc: "Transaksi kasir POS, Kitchen Display System (KDS), Smart Inventory, Resep & COGS, Meja, dan CRM.",
      icon: <Coffee className="w-5 h-5 text-brand-orange" />,
      isRequired: true,
    },
    {
      code: "CO_WORKING",
      name: "Co-working Space & Memberships",
      desc: "Manajemen meja fleksibel/dedicated, booking ruang meeting, paket keanggotaan, dan penagihan berkala.",
      icon: <Laptop className="w-5 h-5 text-blue-600" />,
      isRequired: false,
    },
  ];

  if (!canAccessSettings) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4 bg-white border border-slate-200 rounded-2xl shadow-xs my-12 animate-in fade-in">
        <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900">Akses Dibatasi (Scope Terkunci)</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Halaman Pengaturan hanya dapat diakses oleh{" "}
            <strong className="text-slate-700">Platform Super Admin</strong>,{" "}
            <strong className="text-slate-700">Owner Level Organisasi (Dago Hub)</strong>, atau{" "}
            <strong className="text-slate-700">Owner Tenant / Mitra</strong>.
          </p>
        </div>
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 text-left space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-400">Akun Pengguna:</span>
            <span className="font-semibold text-slate-800">{user?.name || "Staf"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Role:</span>
            <span className="font-semibold text-slate-800">{user?.role.name || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Scope Level:</span>
            <span className="font-mono font-bold text-amber-700">{user?.scopeLevel || "-"}</span>
          </div>
        </div>
      </div>
    );
  }

  // Render Settings
  const myTenantId = user?.tenant?.id || "";
  const myTenantProducts = filteredProducts.filter((p) => p.tenantId === myTenantId);
  const displayedMyTenantProducts = sortProducts(
    myTenantProducts.filter((p) => {
      const matchCategory = masterCategoryFilter === "ALL" || p.category === masterCategoryFilter;
      const matchStatus = masterStatusFilter === "ALL" || p.status === masterStatusFilter;
      const matchSearch =
        p.name.toLowerCase().includes(masterSearch.toLowerCase()) ||
        p.category.toLowerCase().includes(masterSearch.toLowerCase());
      return matchCategory && matchStatus && matchSearch;
    })
  );

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Toast Alert */}
      {masterToast && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-bold flex items-center space-x-2 animate-in fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{masterToast}</span>
        </div>
      )}
      {tenantSavedSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-bold flex items-center space-x-2 animate-in fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>Pengaturan profil mitra dan konfigurasi operasional {tenantBrandName} berhasil disimpan!</span>
        </div>
      )}
      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-bold flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Pengaturan platform berhasil disimpan dan disinkronkan ke seluruh modul.</span>
        </div>
      )}

      {isTenantOwner ? (
        <div className="space-y-6">

          {/* Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                <Coffee className="w-6 h-6 text-brand-orange" />
                <span>Master Data & Pengaturan Mitra — {tenantBrandName}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola katalog menu & produk F&B mitra, harga jual, profil merek, rekening pencairan, dan status operasional gerai.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full font-bold">
                Scope: TENANT ({user?.tenant?.code || "KOPI-SENJA"})
              </span>
            </div>
          </div>

          {/* Tab Navigation for Tenant Owner */}
          <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-700 pb-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setTenantActiveTab("PRODUCTS")}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                tenantActiveTab === "PRODUCTS"
                  ? "bg-primary text-white shadow-xs font-bold"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700"
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Katalog Menu & Produk Mitra ({myTenantProducts.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setTenantActiveTab("PROFILE")}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                tenantActiveTab === "PROFILE"
                  ? "bg-primary text-white shadow-xs font-bold"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700"
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Profil Bisnis & Rekening Mitra</span>
            </button>
            <button
              type="button"
              onClick={() => setTenantActiveTab("PROMOS")}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                tenantActiveTab === "PROMOS"
                  ? "bg-primary text-white shadow-xs font-bold"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700"
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Voucher & Promo Mitra ({promos.filter((p) => !p.tenantId || p.tenantId === myTenantId).length})</span>
            </button>
            <button
              type="button"
              onClick={() => setTenantActiveTab("ADDONS")}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                tenantActiveTab === "ADDONS"
                  ? "bg-primary text-white shadow-xs font-bold"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-primary dark:text-emerald-400" />
              <span>Add-on Gerai Mitra</span>
            </button>
          </div>

          {tenantActiveTab === "PRODUCTS" && (
            <Card className="shadow-xs border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-800 flex items-center space-x-2">
                    <UtensilsCrossed className="w-4 h-4 text-brand-orange" />
                    <span>Katalog Menu Produk {tenantBrandName} ({myTenantProducts.length} Item)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Perubahan harga, nama, dan status ketersediaan langsung disinkronkan ke POS Kasir & Customer Portal QR Menu.
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={handleOpenAddProduct}
                  className="bg-brand-orange hover:bg-orange-600 text-white font-bold text-xs px-4 space-x-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Menu Produk</span>
                </Button>
              </div>

              {/* Filters */}
              <div className="p-3 bg-white border-b border-slate-100 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Cari nama menu atau kategori..."
                    value={masterSearch}
                    onChange={(e) => setMasterSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="flex items-center space-x-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">Kategori:</span>
                  <select
                    value={masterCategoryFilter}
                    onChange={(e) => setMasterCategoryFilter(e.target.value)}
                    className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 font-medium"
                  >
                    <option value="ALL">Semua Kategori</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">Status:</span>
                  <select
                    value={masterStatusFilter}
                    onChange={(e) => setMasterStatusFilter(e.target.value as any)}
                    className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 font-semibold"
                  >
                    <option value="ALL">Semua Status</option>
                    <option value="ACTIVE">Aktif Saja</option>
                    <option value="INACTIVE">Nonaktif Saja</option>
                  </select>
                </div>

                <div className="flex items-center space-x-1.5">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[11px] font-semibold text-slate-500">Urutkan:</span>
                  <select
                    value={masterSortOrder}
                    onChange={(e) => setMasterSortOrder(e.target.value as any)}
                    className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 font-semibold"
                  >
                    <option value="UPDATED_DESC">Terakhir Diubah/Diaktifkan</option>
                    <option value="UPDATED_ASC">Terlama Diubah</option>
                    <option value="NAME_ASC">Nama Menu (A-Z)</option>
                    <option value="PRICE_ASC">Harga Termurah</option>
                    <option value="PRICE_DESC">Harga Tertinggi</option>
                  </select>
                </div>
              </div>

              {/* Product Table */}
              <div className="p-4 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                      <th className="pb-2 font-bold">Menu & Deskripsi</th>
                      <th className="pb-2 font-bold">Kategori</th>
                      <th className="pb-2 font-bold">Harga Jual</th>
                      <th className="pb-2 font-bold">Estimasi HPP (COGS)</th>
                      <th className="pb-2 font-bold">Status Menu</th>
                      <th className="pb-2 font-bold text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {displayedMyTenantProducts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Tidak ada menu produk yang sesuai dengan filter.
                        </td>
                      </tr>
                    ) : (
                      displayedMyTenantProducts.map((p) => {
                        const isAct = p.status === "ACTIVE";
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 font-bold text-slate-900">
                              <div className="flex items-center space-x-2">
                                {p.imageUrl ? (
                                  <img src={p.imageUrl} alt={p.name} className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0" />
                                ) : (
                                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                    <UtensilsCrossed className="w-4 h-4" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-bold text-slate-900">{p.name}</p>
                                  {p.description && (
                                    <p className="text-[10px] text-slate-400 line-clamp-1 max-w-xs">{p.description}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 font-medium text-slate-600">{p.category}</td>
                            <td className="py-3 font-mono font-bold text-slate-900">{formatCurrencyIDR(p.basePrice)}</td>
                            <td className="py-3 font-mono text-slate-500">{formatCurrencyIDR(p.cogsEstimate || 0)}</td>
                            <td className="py-3">
                              <button
                                type="button"
                                onClick={() => toggleProductStatus(p.id)}
                                className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer select-none ${
                                  isAct
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200"
                                    : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200"
                                }`}
                                title={`Klik untuk ${isAct ? "menonaktifkan (Matikan)" : "mengaktifkan"} produk`}
                              >
                                <Power className={`w-3 h-3 ${isAct ? "text-emerald-700" : "text-slate-400"}`} />
                                <span>{isAct ? "AKTIF" : "NON-AKTIF"}</span>
                              </button>
                            </td>
                            <td className="py-3 text-right">
                              <Button
                                size="sm"
                                type="button"
                                variant="outline"
                                onClick={() => handleOpenEditProduct(p)}
                                className="h-7 text-xs font-bold px-3 border-slate-200 hover:bg-orange-50 hover:text-brand-orange hover:border-brand-orange/40 text-slate-700 rounded-lg shadow-2xs"
                                title="Edit data master produk & opsi hapus"
                              >
                                <Edit2 className="w-3.5 h-3.5 mr-1 text-slate-500 group-hover:text-brand-orange" />
                                <span>Edit</span>
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {tenantActiveTab === "PROFILE" && (
            <form onSubmit={handleSaveTenantSettings} className="space-y-6 text-xs">
              {/* Card 0: Status Operasional Mitra (Aktif / Nonaktif) */}
              <Card className="shadow-xs border border-slate-200 overflow-hidden">
                <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                      <Power className={`w-4 h-4 ${tenantStatus === "ACTIVE" ? "text-emerald-600" : "text-slate-400"}`} />
                      <span>Status Operasional Mitra F&B</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Kontrol visibilitas gerai dan penerimaan pesanan di Customer Portal & Kasir POS.
                    </CardDescription>
                  </div>
                  <div>
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full flex items-center space-x-1.5 border ${tenantStatus === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : "bg-red-50 text-red-700 border-red-300"
                        }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${tenantStatus === "ACTIVE" ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                          }`}
                      />
                      <span>{tenantStatus === "ACTIVE" ? "STATUS: AKTIF" : "STATUS: NONAKTIF"}</span>
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div
                      onClick={() => setTenantStatusState("ACTIVE")}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${tenantStatus === "ACTIVE"
                        ? "border-emerald-500 bg-emerald-50/40 text-emerald-950 shadow-xs"
                        : "border-slate-200 bg-white hover:border-slate-300 opacity-70"
                        }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-base">🟢</span>
                          <span className="font-bold text-sm text-emerald-900">Aktif / Buka Operasional</span>
                        </div>
                        {tenantStatus === "ACTIVE" && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Mitra <strong>tampil di Customer Portal</strong> dan pelanggan dapat memesan secara mandiri. Kasir POS <strong>dapat memilih dan membuat transaksi</strong> untuk mitra ini.
                      </p>
                    </div>

                    <div
                      onClick={() => setTenantStatusState("INACTIVE")}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${tenantStatus === "INACTIVE"
                        ? "border-red-500 bg-red-50/40 text-red-950 shadow-xs"
                        : "border-slate-200 bg-white hover:border-slate-300 opacity-70"
                        }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-red-900">Nonaktif / Tutup Sementara</span>
                        </div>
                        {tenantStatus === "INACTIVE" && <CheckCircle2 className="w-5 h-5 text-red-600" />}
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Mitra <strong>disembunyikan dari Customer Portal</strong>. Kasir POS <strong>tidak dapat membuat transaksi baru</strong> untuk menu mitra ini.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 space-y-1">
                    <p className="font-semibold text-slate-700">Sinkronisasi Real-time:</p>
                    <p>
                      Perubahan status akan segera diterapkan pada <strong>Portal Pelanggan (QR Menu)</strong> dan <strong>Sistem Kasir (POS)</strong> setelah tombol Simpan diklik.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Card 1: Brand & Profile Info */}
              <Card className="shadow-xs border border-slate-200">
                <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                  <CardTitle className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                    <Store className="w-4 h-4 text-brand-orange" />
                    <span>Identitas Merek & Profil Mitra</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Informasi yang ditampilkan kepada pelanggan di Portal Pemesanan & QR Menu.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Nama Brand Mitra *</label>
                      <input
                        type="text"
                        required
                        value={tenantBrandName}
                        onChange={(e) => setTenantBrandName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Kode Mitra (Sistem)</label>
                      <input
                        type="text"
                        disabled
                        value={user?.tenant?.code || "KOPI-SENJA"}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Modul Bisnis Terdaftar</label>
                      <input
                        type="text"
                        disabled
                        value="Food & Beverage (F&B)"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-500 font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Tagline Singkat</label>
                      <input
                        type="text"
                        value={tenantTagline}
                        onChange={(e) => setTenantTagline(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                        placeholder="cth. Specialty Coffee & Beverages"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Nomor WhatsApp / Hotline Pelanggan</label>
                      <input
                        type="text"
                        value={tenantPhone}
                        onChange={(e) => setTenantPhone(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                        placeholder="+62 812-xxxx-xxxx"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Deskripsi Profil Bisnis</label>
                    <textarea
                      rows={3}
                      value={tenantDesc}
                      onChange={(e) => setTenantDesc(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                      placeholder="Jelaskan keunikan dan filosofi menu kuliner/minuman Anda..."
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: Rekening Pencairan Dana & Pembayaran Mitra */}
              <Card className="shadow-xs border border-slate-200">
                <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                      <CreditCard className="w-4 h-4 text-brand-orange" />
                      <span>Rekening Pencairan Dana & Pembayaran Mitra</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Informasi nomor rekening bank atau e-wallet untuk pencairan bagi hasil (settlement) penjualan berkala.
                    </CardDescription>
                  </div>
                  <div>
                    {bankAccountNumber.trim() ? (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full flex items-center space-x-1 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Tersimpan</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full flex items-center space-x-1 border border-amber-200">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Belum Diisi</span>
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {bankFormError && (
                    <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-medium flex items-center space-x-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{bankFormError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Bank / Penyedia E-Wallet *</label>
                      <select
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 bg-white"
                      >
                        <option value="BCA">Bank BCA</option>
                        <option value="Mandiri">Bank Mandiri</option>
                        <option value="BRI">Bank BRI</option>
                        <option value="BNI">Bank BNI</option>
                        <option value="BSI">Bank Syariah Indonesia (BSI)</option>
                        <option value="GoPay">GoPay (No. HP)</option>
                        <option value="OVO">OVO (No. HP)</option>
                        <option value="DANA">DANA (No. HP)</option>
                        <option value="ShopeePay">ShopeePay (No. HP)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Nomor Rekening / No. HP *</label>
                      <input
                        type="text"
                        value={bankAccountNumber}
                        onChange={(e) => setBankAccountNumber(e.target.value)}
                        placeholder="cth. 8830192841"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Nama Pemilik Rekening (a.n.) *</label>
                      <input
                        type="text"
                        value={bankAccountHolder}
                        onChange={(e) => setBankAccountHolder(e.target.value)}
                        placeholder="cth. Kopi Senja Utama"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium text-slate-900 bg-white"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 space-y-1">
                    <p className="font-semibold text-slate-700">Catatan Operasional & Keamanan:</p>
                    <p>• Data rekening di atas hanya dapat diakses dan diubah oleh Owner Mitra <strong>{user?.tenant?.name || "terkait"}</strong>.</p>
                    <p>• DAGO Creative Hub menggunakan data ini sebagai tujuan transfer pencairan bagi hasil (settlement) bersih berkala.</p>
                  </div>

                  {/* Read-only Active Revenue Sharing Scheme for Tenant Owner */}
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-[11px] text-blue-900 space-y-1">
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center space-x-1.5">
                        <Coins className="w-3.5 h-3.5 text-blue-600" />
                        <span>Skema Bagi Hasil (Revenue Sharing) Terdaftar:</span>
                      </span>
                      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-mono text-xs">
                        {getTenantRevenueSplit(user?.tenant?.id || "tenant-ks").tenantSharePercent}% Mitra / {getTenantRevenueSplit(user?.tenant?.id || "tenant-ks").dagoSharePercent}% DAGO
                      </span>
                    </div>
                    <p className="text-slate-600">
                      Persentase bagi hasil ditentukan oleh Manajemen Pusat (Super Admin / Organization Owner) dan diterapkan secara otomatis pada setiap settlement transaksi yang diproses.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Card 3: Receipt & Operational Customization */}
              <Card className="shadow-xs border border-slate-200">
                <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                  <CardTitle className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                    <Receipt className="w-4 h-4 text-emerald-600" />
                    <span>Format Nota Struk Kasir & Operasional Gerai</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Kustomisasi teks cetak struk POS dan parameter peringatan stok internal tenant.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Header Struk POS Kasir</label>
                      <input
                        type="text"
                        value={tenantReceiptHeader}
                        onChange={(e) => setTenantReceiptHeader(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium text-slate-900"
                        placeholder="Header struk kasir"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Dicetak di bagian atas setiap struk pembayaran.</p>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Footer Struk POS Kasir</label>
                      <input
                        type="text"
                        value={tenantReceiptFooter}
                        onChange={(e) => setTenantReceiptFooter(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium text-slate-900"
                        placeholder="Footer struk kasir"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Pesan ucapan terima kasih / sosial media di akhir struk.</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Ambang Batas Peringatan Stok Rendah (%)</label>
                    <div className="max-w-xs">
                      <input
                        type="number"
                        value={tenantLowStock}
                        onChange={(e) => setTenantLowStock(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-amber-700"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Bahan baku dengan sisa di bawah persentase ini akan memicu badge Stok Menipis pada panel Inventory mitra.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Card 3: Outlets List */}
              <Card className="shadow-xs border border-slate-200">
                <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                  <CardTitle className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                    <Store className="w-4 h-4 text-purple-600" />
                    <span>Gerai / Cabang Outlet Terdaftar ({outlets.length})</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Daftar outlet fisik yang terafiliasi dengan akun kemitraan Anda di platform DAGO.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {outlets.map((outlet) => (
                      <div key={outlet.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-xs">{outlet.name}</span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${outlet.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                              }`}
                          >
                            {outlet.status === "ACTIVE" ? "AKTIF" : "EKSPANSI"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono">Kode: {outlet.code}</p>
                        <p className="text-[11px] text-slate-600">{outlet.address || "Alamat belum diatur"}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Save Bar */}
              <div className="flex items-center justify-end pt-3 border-t border-slate-200">
                <Button
                  type="submit"
                  size="sm"
                  className="bg-brand-orange hover:bg-orange-600 text-white font-bold px-6 space-x-1.5 shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Pengaturan Mitra</span>
                </Button>
              </div>
            </form>
          )}

          {tenantActiveTab === "PROMOS" && (
            <Card className="shadow-xs border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-800 flex items-center space-x-2">
                    <Tag className="w-4 h-4 text-brand-orange" />
                    <span>Manajemen Voucher & Promo — {tenantBrandName}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Kelola voucher diskon khusus produk {tenantBrandName} untuk pelanggan di POS Kasir dan Customer Portal.
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={() => {
                    const newCode = `${(tenantBrandName || "MITRA").substring(0, 4).toUpperCase()}${Math.floor(10 + Math.random() * 90)}`;
                    const newPromo: PromoConfig = {
                      id: `promo-${Date.now()}`,
                      code: newCode,
                      name: `Promo Spesial ${tenantBrandName}`,
                      description: `Diskon khusus menu ${tenantBrandName}`,
                      discountType: "PERCENTAGE",
                      discountValue: 10,
                      maxDiscount: 20000,
                      minimumAmount: 25000,
                      targetType: "TENANT",
                      targetId: myTenantId,
                      tenantId: myTenantId,
                      scope: "FNB",
                      quota: 25,
                      usageCount: 0,
                      validFrom: new Date().toISOString().split("T")[0],
                      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                      isActive: true,
                    };
                    setPromos((prev) => [...prev, newPromo]);
                    showMasterToast(`Voucher baru ${newCode} ditambahkan.`);
                  }}
                  className="bg-brand-orange hover:bg-orange-600 text-white font-bold text-xs px-4 space-x-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Voucher Mitra</span>
                </Button>
              </div>

              <div className="p-4 space-y-4">
                {promos.filter((p) => !p.tenantId || p.tenantId === myTenantId).length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs italic">
                    Belum ada voucher promo untuk tenant ini. Klik tombol "+ Tambah Voucher Mitra" di atas.
                  </div>
                ) : (
                  promos
                    .filter((p) => !p.tenantId || p.tenantId === myTenantId)
                    .map((promo) => {
                      const computedStatus = getPromoComputedStatus(promo);
                      const isMuted = computedStatus !== "ACTIVE" && computedStatus !== "SCHEDULED";

                      return (
                        <div
                          key={promo.id}
                          className={`border rounded-2xl p-4 space-y-3 shadow-2xs transition-all ${
                            isMuted
                              ? "bg-slate-100/70 border-slate-300/80 opacity-80"
                              : "bg-slate-50 border-slate-200"
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200/80">
                            <div className="flex items-center space-x-2 flex-1">
                              <div className="w-28">
                                <label className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Kode Kupon</label>
                                <input
                                  type="text"
                                  value={promo.code || ""}
                                  onChange={(e) => {
                                    const val = e.target.value.toUpperCase();
                                    setPromos((prev) => prev.map((p) => (p.id === promo.id ? { ...p, code: val } : p)));
                                  }}
                                  placeholder="PROMO10"
                                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-black uppercase w-full bg-white text-emerald-700"
                                />
                              </div>
                              <div className="flex-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Nama Promo</label>
                                <input
                                  type="text"
                                  value={promo.name}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPromos((prev) => prev.map((p) => (p.id === promo.id ? { ...p, name: val } : p)));
                                  }}
                                  placeholder="Nama Promo"
                                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold w-full bg-white text-slate-800"
                                />
                              </div>
                              <div className="self-end pb-1.5">
                                {computedStatus === "ACTIVE" && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    AKTIF
                                  </span>
                                )}
                                {computedStatus === "EXPIRED" && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                    KADALUWARSA
                                  </span>
                                )}
                                {computedStatus === "QUOTA_EXHAUSTED" && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                    KUOTA HABIS
                                  </span>
                                )}
                                {computedStatus === "INACTIVE" && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 border border-slate-300">
                                    NONAKTIF
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center space-x-3 self-end sm:self-center">
                              <div className="text-right">
                                <span className="text-[10px] font-bold text-slate-500 block">
                                  Terpakai: <strong className="text-slate-900">{promo.usageCount || 0}</strong> / {promo.quota || "∞"}
                                </span>
                              </div>
                              <label className="text-xs flex items-center space-x-1.5 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                                <input
                                  type="checkbox"
                                  checked={promo.isActive}
                                  onChange={(e) => {
                                    const val = e.target.checked;
                                    setPromos((prev) => prev.map((p) => (p.id === promo.id ? { ...p, isActive: val } : p)));
                                  }}
                                  className="rounded text-emerald-600"
                                />
                                <span className="font-bold text-[11px] text-slate-700">{promo.isActive ? "Aktif" : "Nonaktif"}</span>
                              </label>
                              <button
                                type="button"
                                onClick={() => setPromos((prev) => prev.filter((p) => p.id !== promo.id))}
                                className="text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Deskripsi / Ketentuan Promo</label>
                            <input
                              type="text"
                              value={promo.description || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPromos((prev) => prev.map((p) => (p.id === promo.id ? { ...p, description: val } : p)));
                              }}
                              placeholder="Contoh: Diskon 10% untuk menu kopi..."
                              className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs w-full bg-white text-slate-600"
                            />
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div>
                              <label className="block text-slate-500 font-medium mb-1">Tipe Diskon</label>
                              <select
                                value={promo.discountType}
                                onChange={(e) => {
                                  const val = e.target.value as any;
                                  setPromos((prev) => prev.map((p) => (p.id === promo.id ? { ...p, discountType: val } : p)));
                                }}
                                className="w-full px-2 py-1.5 border rounded-lg bg-white font-bold text-slate-700"
                              >
                                <option value="PERCENTAGE">Persentase (%)</option>
                                <option value="FIXED">Nominal Tetap (Rp)</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-slate-500 font-medium mb-1">
                                {promo.discountType === "PERCENTAGE" ? "Nilai Diskon (%)" : "Nominal Potongan (Rp)"}
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={promo.discountValue}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setPromos((prev) => prev.map((p) => (p.id === promo.id ? { ...p, discountValue: val } : p)));
                                }}
                                className="w-full px-2 py-1.5 border rounded-lg bg-white font-bold"
                              />
                            </div>

                            <div>
                              <label className="block text-slate-500 font-medium mb-1">Maks. Diskon (Rp)</label>
                              <input
                                type="number"
                                min={0}
                                value={promo.maxDiscount || ""}
                                onChange={(e) => {
                                  const val = e.target.value ? Number(e.target.value) : undefined;
                                  setPromos((prev) => prev.map((p) => (p.id === promo.id ? { ...p, maxDiscount: val } : p)));
                                }}
                                placeholder="Tanpa batas"
                                className="w-full px-2 py-1.5 border rounded-lg bg-white"
                              />
                            </div>

                            <div>
                              <label className="block text-slate-500 font-medium mb-1">Kuota Pemakaian</label>
                              <input
                                type="number"
                                min={1}
                                value={promo.quota || ""}
                                onChange={(e) => {
                                  const val = e.target.value ? Number(e.target.value) : undefined;
                                  setPromos((prev) => prev.map((p) => (p.id === promo.id ? { ...p, quota: val } : p)));
                                }}
                                placeholder="Tanpa batas"
                                className="w-full px-2 py-1.5 border rounded-lg bg-white"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
                            <div>
                              <label className="block text-slate-500 font-medium mb-1">Target Menu Mitra</label>
                              <select
                                value={promo.targetType || "ALL"}
                                onChange={(e) => {
                                  const val = e.target.value as any;
                                  setPromos((prev) =>
                                    prev.map((p) => (p.id === promo.id ? { ...p, targetType: val } : p))
                                  );
                                }}
                                className="w-full px-2 py-1.5 border rounded-lg bg-white font-bold text-slate-700"
                              >
                                <option value="ALL">Semua Menu {tenantBrandName}</option>
                                <option value="CATEGORY">Khusus Kategori</option>
                                <option value="PRODUCT">Khusus Menu Tertentu</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-slate-500 font-medium mb-1">Tgl Mulai Berlaku</label>
                              <input
                                type="date"
                                value={promo.validFrom ? promo.validFrom.split("T")[0] : ""}
                                onChange={(e) => {
                                  const val = e.target.value ? new Date(e.target.value).toISOString() : undefined;
                                  setPromos((prev) => prev.map((p) => (p.id === promo.id ? { ...p, validFrom: val } : p)));
                                }}
                                className="w-full px-2.5 py-1.5 border rounded-lg bg-white text-xs"
                              />
                            </div>

                            <div>
                              <label className="block text-slate-500 font-medium mb-1">Tgl Kadaluarsa</label>
                              <input
                                type="date"
                                value={promo.validUntil ? promo.validUntil.split("T")[0] : ""}
                                onChange={(e) => {
                                  const val = e.target.value ? new Date(e.target.value + "T23:59:59.000Z").toISOString() : undefined;
                                  setPromos((prev) => prev.map((p) => (p.id === promo.id ? { ...p, validUntil: val } : p)));
                                }}
                                className="w-full px-2.5 py-1.5 border rounded-lg bg-white text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                )}

                <div className="flex justify-end pt-3 border-t border-slate-200">
                  <Button
                    type="button"
                    onClick={() => {
                      updateSettings({ promos });
                      showMasterToast("Daftar voucher promo mitra berhasil disimpan!");
                    }}
                    size="sm"
                    className="bg-brand-orange hover:bg-orange-600 text-white font-bold px-6 space-x-1.5 shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    <span>Simpan Perubahan Voucher Promo</span>
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {tenantActiveTab === "ADDONS" && (
            <div className="space-y-4">
              {/* Header Info Banner */}
              <div className="p-4 bg-gradient-to-r from-purple-50/80 to-indigo-50/50 border border-purple-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-start space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 border border-purple-200 mt-0.5">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <h3 className="font-bold text-sm text-slate-900">
                        Katalog Add-on Gerai Mitra — {tenantBrandName}
                      </h3>
                      <ProFeatureBadge label="MODUL GERAI" variant="addon" size="xs" />
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold border border-slate-200">
                        Scope: Gerai Booth F&B
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed max-w-2xl">
                      Fitur bernilai tambah khusus untuk operasional gerai {tenantBrandName}. Modul yang aktif di sini langsung mengubah kapabilitas operasional gerai Anda di sistem kasir dan dapur.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 self-start sm:self-center shrink-0">
                  <span className="text-xs px-3 py-1 bg-white border border-purple-200 text-purple-700 font-bold rounded-full shadow-2xs">
                    {tenantAddons.filter((a) => a.status === "ACTIVE").length} dari {tenantAddons.length} Add-on Aktif
                  </span>
                </div>
              </div>

              {/* Scope Distinction Callout */}
              <div className="p-3 bg-primary/10 dark:bg-primary/15 border border-primary/20 dark:border-primary/30 rounded-xl flex items-start space-x-2.5 text-xs">
                <AlertTriangle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-[11px] text-primary uppercase tracking-wide">Pemisahan Lingkup Layanan:</p>
                  <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                    Add-on di bawah ini hanya berlaku untuk alur kerja operasional booth {tenantBrandName} (seperti KDS stasiun, resep BOM, dan nota WhatsApp). Lisensi platform pusat dan kuota outlet cabang fisik dikelola secara terpusat oleh Pengelola Dago Creative Hub.
                  </p>
                </div>
              </div>

              {/* Addon Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tenantAddons.map((addon) => {
                  const isActive = addon.status === "ACTIVE";
                  const iconComponent =
                    addon.code === "KDS_MULTI_STATION" ? (
                      <UtensilsCrossed className="w-4 h-4 text-primary" />
                    ) : addon.code === "ADVANCED_BOM_COGS" ? (
                      <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : addon.code === "WHATSAPP_AUTO_DISPATCH" ? (
                      <Zap className="w-4 h-4 text-primary" />
                    ) : (
                      <Tag className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    );

                  return (
                    <div
                      key={addon.id}
                      className={`p-4 sm:p-5 rounded-2xl bg-white border transition-all shadow-2xs flex flex-col justify-between space-y-4 ${
                        isActive
                          ? "border-purple-200/90 ring-1 ring-purple-100"
                          : "border-slate-200/80 opacity-90"
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center shrink-0">
                              {iconComponent}
                            </div>
                            <div>
                              <div className="flex items-center space-x-1.5 flex-wrap">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  {addon.categoryTag}
                                </span>
                                <ProFeatureBadge label={addon.badgeLabel} variant={addon.badgeVariant} size="xs" />
                              </div>
                              <h4 className="font-bold text-sm text-slate-900 leading-snug">{addon.name}</h4>
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            {isActive ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Aktif
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                Belum Aktif
                              </span>
                            )}
                            <span className="block text-[10px] text-slate-400 font-medium mt-0.5">
                              {addon.monthlyPriceDisplay}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">{addon.description}</p>

                        <div className="pt-2 border-t border-slate-100 space-y-1.5">
                          <span className="text-[11px] font-bold text-slate-700 block">Manfaat Operasional Gerai:</span>
                          {addon.benefits.map((benefit, idx) => (
                            <div key={idx} className="flex items-start space-x-2 text-xs text-slate-600">
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                              <span className="leading-tight">{benefit}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setPreviewModalFeature({
                              title: addon.name,
                              badgeLabel: addon.badgeLabel,
                              badgeVariant: addon.badgeVariant,
                              categoryTag: addon.categoryTag,
                              description: addon.description,
                              benefits: addon.benefits,
                              samplePlanName: `Add-on Gerai Mitra: ${tenantBrandName}`,
                              statusText: isActive ? "Aktif di Gerai Anda" : "Tersedia untuk Diaktifkan",
                            })
                          }
                          className="text-xs text-slate-600 hover:text-slate-900 font-semibold px-2.5 h-8"
                        >
                          Pelajari Fitur
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            toggleSimulatedTenantAddon(addon.id, myTenantId);
                            if (isActive) {
                              showMasterToast(`Add-on "${addon.name}" dinonaktifkan untuk ${tenantBrandName}.`);
                            } else {
                              showMasterToast(`Add-on "${addon.name}" berhasil diaktifkan untuk ${tenantBrandName}!`);
                            }
                          }}
                          className={`text-xs font-bold px-3.5 h-8 rounded-xl shadow-2xs transition-all ${
                            isActive
                              ? "bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300"
                              : "bg-purple-600 hover:bg-purple-700 text-white"
                          }`}
                        >
                          {isActive ? "Nonaktifkan Fitur" : "Aktifkan Fitur"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">

          {/* Top Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                <Settings className="w-6 h-6 text-slate-700" />
                <span>Master Data & Pengaturan Platform DAGO</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pusat pengelolaan data master terpadu: Menu F&B multi-mitra, kategori, tenant, ruang co-working, dan konfigurasi platform.
              </p>
            </div>
          </div>

          {/* Master Data Centralized Hub Card */}
          <Card className="shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-xs text-slate-800 uppercase tracking-wide">Pusat Master Data:</span>
                <span className="text-xs bg-brand-orange text-white font-bold px-3 py-0.5 rounded-full shadow-2xs">
                  {selectedMasterTab}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedMasterTab === "Produk & Kategori" && (
                  <>
                    <Button
                      size="sm"
                      type="button"
                      onClick={handleOpenAddProduct}
                      className="bg-brand-orange hover:bg-orange-600 text-white font-bold text-xs space-x-1.5 rounded-xl shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Produk</span>
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddCatModalOpen(true)}
                      className="border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs space-x-1.5 rounded-xl"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Kategori</span>
                    </Button>
                  </>
                )}

                {selectedMasterTab === "Mitra & Bagi Hasil" && (
                  <Button
                    size="sm"
                    type="button"
                    onClick={() => setIsAddTenantModalOpen(true)}
                    className="bg-brand-orange hover:bg-orange-600 text-white font-bold text-xs space-x-1.5 rounded-xl shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Mitra Baru</span>
                  </Button>
                )}

                {selectedMasterTab === "Co-working & Ruangan" && (
                  <>
                    <Button
                      size="sm"
                      type="button"
                      onClick={handleOpenAddSpace}
                      className="bg-brand-orange hover:bg-orange-600 text-white font-bold text-xs space-x-1.5 rounded-xl shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Ruang</span>
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={handleOpenAddPlan}
                      className="border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs space-x-1.5 rounded-xl"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Paket</span>
                    </Button>
                  </>
                )}

                {selectedMasterTab === "Meja & Area" && (
                  <Button
                    size="sm"
                    type="button"
                    onClick={handleOpenAddTable}
                    className="bg-brand-orange hover:bg-orange-600 text-white font-bold text-xs space-x-1.5 rounded-xl shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Meja Baru</span>
                  </Button>
                )}

                {selectedMasterTab === "Voucher & Promo" && (
                  <Button
                    size="sm"
                    type="button"
                    onClick={() => {
                      const newCode = `PROMO${Math.floor(10 + Math.random() * 90)}`;
                      setPromos([
                        ...promos,
                        {
                          id: `promo-${Date.now()}`,
                          code: newCode,
                          name: "Promo Spesial Dago",
                          description: "Diskon spesial untuk transaksi",
                          discountType: "PERCENTAGE",
                          discountValue: 10,
                          maxDiscount: 25000,
                          minimumAmount: 30000,
                          targetType: "ALL",
                          scope: "ALL",
                          quota: 50,
                          usageCount: 0,
                          validFrom: new Date().toISOString().split("T")[0],
                          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                          isActive: true,
                        },
                      ]);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs space-x-1.5 rounded-xl shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Voucher Promo</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Scrollable Navigation Tabs */}
            <div className="flex items-center space-x-2 overflow-x-auto p-3 bg-white dark:bg-slate-800 scrollbar-thin border-b border-slate-100 dark:border-slate-700">
              {MASTER_DATA_TABS.filter((tab) => {
                if (tab === "Manajemen Wi-Fi") {
                  return isOrgOwner || isSuperAdmin;
                }
                return true;
              }).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setSelectedMasterTab(tab)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 flex items-center space-x-1.5 ${
                    selectedMasterTab === tab
                      ? "bg-primary text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {MASTER_TAB_ICONS[tab]}
                  <span>{tab}</span>
                </button>
              ))}
            </div>

            {/* TAB 1: PRODUK & KATEGORI */}
            {selectedMasterTab === "Produk & Kategori" && (
              <div>
                {/* Filters for Produk */}
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[180px]">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={masterSearch}
                        onChange={(e) => setMasterSearch(e.target.value)}
                        placeholder="Cari nama produk, kategori, mitra..."
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
                      />
                    </div>

                    {/* Mitra Filter */}
                    <div className="flex items-center space-x-1">
                      <Store className="w-3.5 h-3.5 text-brand-orange shrink-0" />
                      <select
                        value={masterTenantFilter}
                        onChange={(e) => setMasterTenantFilter(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
                      >
                        <option value="ALL">Semua Mitra F&B</option>
                        {localTenants.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.badge})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Category Filter */}
                    <select
                      value={masterCategoryFilter}
                      onChange={(e) => setMasterCategoryFilter(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
                    >
                      <option value="ALL">Semua Kategori</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>

                    {/* Status Filter (Revisi 7) */}
                    <div className="flex items-center space-x-1">
                      <Power className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <select
                        value={masterStatusFilter}
                        onChange={(e) => setMasterStatusFilter(e.target.value as any)}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
                      >
                        <option value="ALL">Semua Status</option>
                        <option value="ACTIVE">Aktif Saja</option>
                        <option value="INACTIVE">Nonaktif Saja</option>
                      </select>
                    </div>

                    {/* Sort Order (Revisi 7) */}
                    <div className="flex items-center space-x-1">
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <select
                        value={masterSortOrder}
                        onChange={(e) => setMasterSortOrder(e.target.value as any)}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
                      >
                        <option value="UPDATED_DESC">Terakhir Diubah/Diaktifkan</option>
                        <option value="UPDATED_ASC">Terlama Diubah</option>
                        <option value="NAME_ASC">Nama Produk (A-Z)</option>
                        <option value="PRICE_ASC">Harga Termurah</option>
                        <option value="PRICE_DESC">Harga Tertinggi</option>
                      </select>
                    </div>
                  </div>

                  <div className="text-[11px] font-bold text-slate-500">
                    Total: {displayedMasterProducts.length} Produk Terdaftar
                  </div>
                </div>

                {/* Products Table */}
                <div className="p-4 overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[720px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                        <th className="pb-2.5 font-bold">Produk Menu</th>
                        <th className="pb-2.5 font-bold">Mitra / Tenant</th>
                        <th className="pb-2.5 font-bold">Kategori</th>
                        <th className="pb-2.5 font-bold">Harga Jual</th>
                        <th className="pb-2.5 font-bold">Estimasi HPP</th>
                        <th className="pb-2.5 font-bold">Status</th>
                        <th className="pb-2.5 font-bold text-right">Aksi Manajemen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {displayedMasterProducts.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            Tidak ada produk yang cocok dengan filter.
                          </td>
                        </tr>
                      ) : (
                        displayedMasterProducts.map((p) => {
                          const isAct = p.status === "ACTIVE";
                          const tName = localTenants.find((t) => t.id === p.tenantId)?.name || getTenantName(p.tenantId) || "Kopi Senja";
                          return (
                            <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 font-bold text-slate-900">
                                <div className="flex items-center space-x-2">
                                  {p.imageUrl ? (
                                    <img src={p.imageUrl} alt={p.name} className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                      <UtensilsCrossed className="w-4 h-4" />
                                    </div>
                                  )}
                                  <div>
                                    <p className="font-bold text-slate-900">{p.name}</p>
                                    {p.description && (
                                      <p className="text-[10px] text-slate-400 line-clamp-1 max-w-xs">{p.description}</p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 font-semibold text-slate-700">
                                <span className="bg-brand-orange/10 text-brand-orange border border-brand-orange/25 px-2 py-0.5 rounded-md text-[11px] font-bold">
                                  {tName}
                                </span>
                              </td>
                              <td className="py-3 font-medium text-slate-600">{p.category}</td>
                              <td className="py-3 font-mono font-bold text-slate-900">{formatCurrencyIDR(p.basePrice)}</td>
                              <td className="py-3 font-mono text-slate-500">{formatCurrencyIDR(p.cogsEstimate || 0)}</td>
                              <td className="py-3">
                                <button
                                  type="button"
                                  onClick={() => toggleProductStatus(p.id)}
                                  className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer select-none ${
                                    isAct
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                      : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                                  }`}
                                  title={`Klik untuk ${isAct ? "menonaktifkan (Matikan)" : "mengaktifkan"} produk`}
                                >
                                  <Power className={`w-3 h-3 ${isAct ? "text-emerald-600" : "text-slate-400"}`} />
                                  <span>{isAct ? "AKTIF" : "NON-AKTIF"}</span>
                                </button>
                              </td>
                              <td className="py-3 text-right">
                                <Button
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                  onClick={() => handleOpenEditProduct(p)}
                                  className="h-7 text-xs font-bold px-3 border-slate-200 hover:bg-orange-50 hover:text-brand-orange hover:border-brand-orange/40 text-slate-700 rounded-lg shadow-2xs"
                                  title="Edit data master produk & opsi hapus"
                                >
                                  <Edit2 className="w-3.5 h-3.5 mr-1 text-slate-500 group-hover:text-brand-orange" />
                                  <span>Edit</span>
                                </Button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Categories Overview Bar */}
                <div className="p-4 bg-slate-50 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Tag className="w-4 h-4 text-brand-orange" />
                      <h4 className="font-bold text-xs text-slate-900">Kategori Menu Terdaftar ({categories.length})</h4>
                    </div>
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddCatModalOpen(true)}
                      className="h-7 text-xs font-bold px-2.5 rounded-lg border-slate-200 bg-white"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Tambah Kategori
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => {
                      const count = filteredProducts.filter((p) => p.category === cat).length;
                      return (
                        <div
                          key={cat}
                          className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs flex items-center space-x-2 shadow-2xs"
                        >
                          <span className="font-bold text-slate-800">{cat}</span>
                          <span className="bg-slate-100 text-slate-600 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md">
                            {count} item
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: MITRA & BAGI HASIL — PUSAT ADMINISTRASI TERPADU */}
            {selectedMasterTab === "Mitra & Bagi Hasil" && (
              <div className="p-4 space-y-6">
                {/* Sub-Navigasi Administrasi Platform */}
                <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
                  <button
                    type="button"
                    onClick={() => setPartnerSubTab("MANAJEMEN_MITRA")}
                    className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                      partnerSubTab === "MANAJEMEN_MITRA"
                        ? "bg-white dark:bg-slate-700 text-[#3B7A57] dark:text-[#52B788] shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Manajemen Mitra & Akun Terpadu</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPartnerSubTab("BAGI_HASIL_FNB")}
                    className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                      partnerSubTab === "BAGI_HASIL_FNB"
                        ? "bg-white dark:bg-slate-700 text-brand-orange shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    <Coffee className="w-3.5 h-3.5" />
                    <span>Bagi Hasil & Operasional F&B</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPartnerSubTab("BAGI_HASIL_EVENTS")}
                    className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                      partnerSubTab === "BAGI_HASIL_EVENTS"
                        ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Bagi Hasil Event Marketplace</span>
                  </button>
                </div>

                {/* SUB-TAB 1: MANAJEMEN MITRA & AKUN TERPADU */}
                {partnerSubTab === "MANAJEMEN_MITRA" && (
                  <div className="space-y-4">
                    {/* Header & Action Button */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center space-x-2">
                          <Users className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788]" />
                          <span>Direktori Mitra & Hak Akses Akun Platform</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Pusat administrasi akun mitra kuliner F&B dan komunitas penyelenggara event DAGO Creative Hub.
                        </p>
                      </div>

                      <Button
                        size="sm"
                        type="button"
                        onClick={() => setIsAddOrganizerModalOpen(true)}
                        className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold rounded-xl h-8 px-3.5 space-x-1.5 shadow-xs shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Penyelenggara Event</span>
                      </Button>
                    </div>

                    {/* Filter & Search Toolbar */}
                    <div className="p-3 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3">
                      <div className="relative flex-1 min-w-[200px]">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={partnerSearchQuery}
                          onChange={(e) => setPartnerSearchQuery(e.target.value)}
                          placeholder="Cari nama mitra, PIC, email, atau modul..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#3B7A57]"
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] font-semibold text-slate-500">Tipe:</span>
                        <select
                          value={partnerTypeFilter}
                          onChange={(e) => setPartnerTypeFilter(e.target.value as any)}
                          className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 font-medium"
                        >
                          <option value="ALL">Semua Tipe Mitra</option>
                          <option value="FNB">Mitra F&B Kuliner</option>
                          <option value="EVENT">Penyelenggara Event</option>
                        </select>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] font-semibold text-slate-500">Status:</span>
                        <select
                          value={partnerStatusFilter}
                          onChange={(e) => setPartnerStatusFilter(e.target.value as any)}
                          className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 font-medium"
                        >
                          <option value="ALL">Semua Status</option>
                          <option value="ACTIVE">Aktif</option>
                          <option value="INACTIVE">Nonaktif</option>
                        </select>
                      </div>
                    </div>

                    {/* Combined Partners Directory Table */}
                    {(() => {
                      // 1. Map F&B tenants
                      const fnbRows = localTenants.map((t) => {
                        const status = allTenantStatuses[t.id] || "ACTIVE";
                        const prof = DEFAULT_TENANT_PROFILES[t.id];
                        const email =
                          t.id === "tenant-ks"
                            ? "owner.kopisenja@dagoeng.com"
                            : t.id === "tenant-kitchen"
                            ? "owner.dapurmama@dagoeng.com"
                            : t.id === "tenant-bakery"
                            ? "owner.manisbakery@dagoeng.com"
                            : "owner.warungbunarti@dagoeng.com";
                        const contactPerson =
                          t.id === "tenant-ks"
                            ? "I Wayan Pratama"
                            : t.id === "tenant-kitchen"
                            ? "Siti Aminah"
                            : t.id === "tenant-bakery"
                            ? "David Santoso"
                            : "Bu Narti";

                        return {
                          id: t.id,
                          name: t.name,
                          type: "FNB" as const,
                          categoryOrBadge: t.badge,
                          contactPerson,
                          phone: prof?.contactPhone || "+62 812-3456-7890",
                          email,
                          status,
                          serviceModule: "FNB",
                          scopeLevel: "TENANT",
                          roleName: "Tenant Owner (F&B)",
                          permissions: [
                            "dashboard:view",
                            "orders:view",
                            "tables:view",
                            "inventory:view",
                            "menu:view",
                            "menu:manage",
                            "reports:view",
                          ],
                          bankInfo: {
                            bankName: prof?.bankName || "BCA",
                            accountNumber: prof?.bankAccountNumber || "8830192841",
                            accountHolder: prof?.bankAccountHolder || t.name,
                          },
                          notes: "Mitra gerai kuliner F&B terintegrasi POS multi-tenant.",
                        };
                      });

                      // 2. Map Community Organizers
                      const eventRows = organizers.map((o) => ({
                        id: o.id,
                        name: o.name,
                        type: "EVENT" as const,
                        categoryOrBadge: o.category,
                        contactPerson: o.contactPerson,
                        phone: o.phone,
                        email: o.email,
                        status: o.status,
                        activationStatus: (o as any).activationStatus || (o.status === "INACTIVE" ? "INACTIVE" : "PENDING_ACTIVATION"),
                        serviceModule: "CO_WORKING / Event",
                        scopeLevel: "TENANT",
                        roleName: "Penyelenggara Event",
                        permissions: [
                          "events:manage_own",
                          "events:portal_access",
                          "events:checkin_attendee",
                          "events:view_revenue",
                        ],
                        notes: o.notes || "Mitra komunitas penyelenggara event di DAGO Hub.",
                      }));

                      const combined = [...fnbRows, ...eventRows].filter((item) => {
                        if (partnerTypeFilter !== "ALL" && item.type !== partnerTypeFilter) return false;
                        if (partnerStatusFilter !== "ALL" && item.status !== partnerStatusFilter) return false;
                        if (partnerSearchQuery.trim()) {
                          const q = partnerSearchQuery.toLowerCase();
                          const matchName = item.name.toLowerCase().includes(q);
                          const matchPic = item.contactPerson.toLowerCase().includes(q);
                          const matchEmail = item.email.toLowerCase().includes(q);
                          const matchModule = item.serviceModule.toLowerCase().includes(q);
                          return matchName || matchPic || matchEmail || matchModule;
                        }
                        return true;
                      });

                      return (
                        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-2xs">
                          <table className="w-full text-left text-xs border-collapse min-w-[850px]">
                            <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800">
                              <tr className="text-slate-400 dark:text-slate-400 uppercase text-[10px] tracking-wider">
                                <th className="p-3 font-bold">Mitra / Organisasi</th>
                                <th className="p-3 font-bold">Tipe & Modul</th>
                                <th className="p-3 font-bold">Penanggung Jawab (PIC)</th>
                                <th className="p-3 font-bold">Akun Login Terhubung</th>
                                <th className="p-3 font-bold">Status Akses & Aktivasi</th>
                                <th className="p-3 font-bold text-right">Aksi Kelola</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                              {combined.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="p-6 text-center text-slate-400 text-xs">
                                    Tidak ada mitra yang cocok dengan filter pencarian.
                                  </td>
                                </tr>
                              ) : (
                                combined.map((p) => {
                                  const isActive = p.status === "ACTIVE";

                                  return (
                                    <tr key={`${p.type}-${p.id}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                                      <td className="p-3">
                                        <div className="flex items-center space-x-2.5">
                                          <div
                                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                              p.type === "FNB"
                                                ? "bg-amber-100 dark:bg-amber-950/60 text-brand-orange"
                                                : "bg-emerald-100 dark:bg-emerald-950/60 text-[#3B7A57] dark:text-[#52B788]"
                                            }`}
                                          >
                                            {p.type === "FNB" ? (
                                              <Store className="w-3.5 h-3.5" />
                                            ) : (
                                              <Calendar className="w-3.5 h-3.5" />
                                            )}
                                          </div>
                                          <div>
                                            <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                                              <span>{p.name}</span>
                                            </div>
                                            <div className="text-[10px] text-slate-400">
                                              {p.categoryOrBadge}
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="p-3">
                                        <div className="space-y-1">
                                          <span
                                            className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-md ${
                                              p.type === "FNB"
                                                ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                                                : "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                            }`}
                                          >
                                            {p.type === "FNB" ? "Mitra F&B" : "Penyelenggara Event"}
                                          </span>
                                          <div className="text-[10px] text-slate-500 font-mono">
                                            Modul: {p.serviceModule}
                                          </div>
                                        </div>
                                      </td>
                                      <td className="p-3">
                                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                                          {p.contactPerson}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-mono">
                                          {p.phone}
                                        </div>
                                      </td>
                                      <td className="p-3">
                                        <div className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                                          {p.email}
                                        </div>
                                        <div className="text-[10px] text-slate-400">
                                          Scope: {p.scopeLevel}
                                        </div>
                                      </td>
                                      <td className="p-3">
                                        <div className="space-y-1">
                                          <span
                                            className={`inline-flex items-center space-x-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                              isActive
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                                : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                                            }`}
                                          >
                                            <span
                                              className={`w-1.5 h-1.5 rounded-full ${
                                                isActive ? "bg-emerald-500" : "bg-rose-500"
                                              }`}
                                            />
                                            <span>{isActive ? "AKTIF" : "NONAKTIF"}</span>
                                          </span>

                                          {/* Activation status for Event Organizer */}
                                          {p.type === "EVENT" && (
                                            <div>
                                              {!isActive ? (
                                                <span className="text-[9px] text-rose-500 font-medium">Akses Ditangguhkan</span>
                                              ) : (p as any).activationStatus === "ACTIVATED" ? (
                                                <span className="inline-flex items-center text-[9px] font-bold text-emerald-700 dark:text-emerald-400">
                                                  <Check className="w-2.5 h-2.5 mr-0.5" />
                                                  <span>Sudah Diaktifkan</span>
                                                </span>
                                              ) : (p as any).activationStatus === "EXPIRED" ? (
                                                <span className="inline-flex items-center text-[9px] font-bold text-amber-700 dark:text-amber-400">
                                                  <span>Token Kedaluwarsa</span>
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center text-[9px] font-bold text-amber-600 dark:text-amber-400">
                                                  <span>Menunggu Aktivasi</span>
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                      <td className="p-3 text-right">
                                        <div className="inline-flex items-center space-x-1.5">
                                          {p.type === "EVENT" && (
                                            <Button
                                              size="sm"
                                              type="button"
                                              variant="outline"
                                              onClick={() => handleGenerateActivationLink(p.id)}
                                              disabled={isGeneratingInvite || !isActive}
                                              className="h-7 text-[11px] font-bold px-2.5 rounded-lg border-emerald-300 text-emerald-800 bg-emerald-50/60 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-300 dark:bg-emerald-950/40 disabled:opacity-40"
                                              title="Terbitkan tautan aktivasi mandiri berdurasi 48 jam"
                                            >
                                              <Key className="w-3 h-3 mr-1 text-[#3B7A57]" />
                                              <span>Tautan Aktivasi</span>
                                            </Button>
                                          )}

                                          <Button
                                            size="sm"
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                              if (p.type === "FNB") {
                                                const next = !isActive;
                                                setTenantStatus(p.id, next ? "ACTIVE" : "INACTIVE");
                                                refreshAllTenantStatuses();
                                                showMasterToast(
                                                  `Status akun ${p.name} diubah menjadi ${
                                                    next ? "AKTIF" : "NONAKTIF"
                                                  }.`
                                                );
                                              } else {
                                                handleToggleOrganizerStatus(p.id, p.status);
                                              }
                                            }}
                                            className={`h-7 text-[11px] font-bold px-2.5 rounded-lg ${
                                              isActive
                                                ? "border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40"
                                                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                                            }`}
                                            title={isActive ? "Nonaktifkan hak akses akun" : "Aktifkan hak akses akun"}
                                          >
                                            <Power className="w-3 h-3 mr-1" />
                                            <span>{isActive ? "Nonaktifkan" : "Aktifkan"}</span>
                                          </Button>

                                          <Button
                                            size="sm"
                                            type="button"
                                            variant="outline"
                                            onClick={() => setSelectedPartnerDetail(p as any)}
                                            className="h-7 text-[11px] font-bold px-2.5 rounded-lg border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                                            title="Lihat detail identitas, RBAC, dan relasi data"
                                          >
                                            <Eye className="w-3 h-3 mr-1 text-slate-500" />
                                            <span>Detail</span>
                                          </Button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* SUB-TAB 2: BAGI HASIL MITRA F&B */}
                {partnerSubTab === "BAGI_HASIL_FNB" && (
                  <div className="space-y-6">
                    {/* Mitra Operational Hours Table */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center space-x-2">
                          <Store className="w-4 h-4 text-brand-orange" />
                          <span>Daftar Mitra F&B & Status Operasional</span>
                        </h4>
                      </div>
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-2xs">
                        <table className="w-full text-left text-xs border-collapse min-w-[760px]">
                          <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800">
                            <tr className="text-slate-400 dark:text-slate-400 uppercase text-[10px]">
                              <th className="p-3 font-bold">Mitra F&B</th>
                              <th className="p-3 font-bold">Kode Merchant</th>
                              <th className="p-3 font-bold">Jam Buka - Tutup Gerai</th>
                              <th className="p-3 font-bold">Status Terima Order</th>
                              <th className="p-3 font-bold text-right">Aksi Buka / Tutup</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                            {localTenants.map((t) => {
                              const op = tenantOps[t.id] || {
                                tenantId: t.id,
                                tenantName: t.name,
                                isAcceptingOrders: (allTenantStatuses[t.id] || "ACTIVE") === "ACTIVE",
                                openTime: "08:00",
                                closeTime: "21:00",
                              };
                              const isAccepting = op.isAcceptingOrders;

                              return (
                                <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                  <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                                    <div className="flex items-center space-x-2">
                                      <Store className="w-3.5 h-3.5 text-brand-orange shrink-0" />
                                      <span>{t.name}</span>
                                      <span className="text-[10px] text-slate-500 font-normal">({t.badge})</span>
                                    </div>
                                  </td>
                                  <td className="p-3 font-mono text-slate-500">{t.code}</td>
                                  <td className="p-3">
                                    <div className="flex items-center space-x-1.5">
                                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <input
                                        type="time"
                                        value={op.openTime || "08:00"}
                                        onChange={(e) => handleUpdateTenantOperation(t.id, "openTime", e.target.value)}
                                        className="px-1.5 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono font-bold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                                        title="Jam Buka Gerai"
                                      />
                                      <span className="text-slate-400">-</span>
                                      <input
                                        type="time"
                                        value={op.closeTime || "21:00"}
                                        onChange={(e) => handleUpdateTenantOperation(t.id, "closeTime", e.target.value)}
                                        className="px-1.5 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono font-bold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                                        title="Jam Tutup Gerai"
                                      />
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <span
                                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border inline-flex items-center space-x-1.5 ${
                                        isAccepting
                                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                          : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                                      }`}
                                    >
                                      <span className={`w-1.5 h-1.5 rounded-full ${isAccepting ? "bg-emerald-600" : "bg-red-600"}`} />
                                      <span>{isAccepting ? "OPEN ORDER (Buka)" : "TUTUP SEMENTARA"}</span>
                                    </span>
                                  </td>
                                  <td className="p-3 text-right">
                                    <Button
                                      size="sm"
                                      type="button"
                                      variant="outline"
                                      onClick={() => {
                                        const next = !isAccepting;
                                        handleUpdateTenantOperation(t.id, "isAcceptingOrders", next);
                                        setTenantStatus(t.id, next ? "ACTIVE" : "INACTIVE");
                                        refreshAllTenantStatuses();
                                        showMasterToast(`Status order ${t.name} diubah menjadi ${next ? "Open Order (Buka)" : "Tutup Sementara"}.`);
                                      }}
                                      className={`h-7 text-xs font-bold px-2.5 rounded-xl ${
                                        isAccepting
                                          ? "border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                                          : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                                      }`}
                                    >
                                      <Power className="w-3 h-3 mr-1" />
                                      <span>{isAccepting ? "Tutup Order" : "Buka Order"}</span>
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* F&B Flexible Revenue Sharing */}
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center space-x-2">
                            <Coins className="w-4 h-4 text-brand-orange" />
                            <span>Skema Bagi Hasil Mitra F&B (Flexible Revenue Sharing)</span>
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Konfigurasi persentase bagi hasil individual per tenant/mitra F&B. Berlaku pada saat transaksi diproses.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {localTenants.map((tenant) => {
                          const config = revenueSplits[tenant.id] || DEFAULT_TENANT_REVENUE_SPLITS[tenant.id] || {
                            tenantId: tenant.id,
                            tenantName: tenant.name,
                            tenantSharePercent: 85,
                            dagoSharePercent: 15,
                            status: "ACTIVE",
                          };
                          const hasError = !!revenueSplitErrors[tenant.id];

                          const simGross = 100000;
                          const simTenant = Math.round(simGross * (config.tenantSharePercent / 100));
                          const simDago = simGross - simTenant;

                          return (
                            <div
                              key={tenant.id}
                              className={`p-4 rounded-xl border transition-all ${
                                hasError
                                  ? "border-red-300 bg-red-50/40 dark:border-red-800 dark:bg-red-950/20"
                                  : "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                              }`}
                            >
                              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                                <div className="flex items-center space-x-2">
                                  <Store className="w-4 h-4 text-brand-orange" />
                                  <span className="font-bold text-slate-900 dark:text-slate-100">{tenant.name}</span>
                                  <span className="text-[10px] text-slate-500 font-mono">({tenant.code})</span>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                                  STATUS: AKTIF
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-3 mt-3">
                                <div>
                                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                                    Bagian Mitra / Tenant (%)
                                  </label>
                                  <div className="flex items-center space-x-1">
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      step={0.5}
                                      value={config.tenantSharePercent}
                                      onChange={(e) => handleTenantSplitChange(tenant.id, parseFloat(e.target.value))}
                                      className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900"
                                    />
                                    <span className="font-bold text-slate-500">%</span>
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                                    Bagian DAGO Hub (%)
                                  </label>
                                  <div className="flex items-center space-x-1">
                                    <input
                                      type="number"
                                      disabled
                                      value={config.dagoSharePercent}
                                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 cursor-not-allowed"
                                    />
                                    <span className="font-bold text-slate-500">%</span>
                                  </div>
                                </div>
                              </div>

                              {hasError && (
                                <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold mt-2">
                                  {revenueSplitErrors[tenant.id]}
                                </p>
                              )}

                              {/* Estimasi Perhitungan Preview */}
                              <div className="mt-3 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] text-slate-600 dark:text-slate-300 flex items-center justify-between">
                                <span className="text-slate-400">Estimasi Rp 100k:</span>
                                <span className="font-mono">
                                  Mitra: <strong className="text-emerald-700 dark:text-emerald-400">Rp {simTenant.toLocaleString("id-ID")}</strong> | DAGO: <strong className="text-brand-orange">Rp {simDago.toLocaleString("id-ID")}</strong>
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-4 p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
                        <p className="font-semibold">Ketentuan Settlement Multi-Tenant & Immutability F&B:</p>
                        <p>• Perubahan persentase bagi hasil di atas hanya berlaku untuk transaksi baru yang diproses setelah penyimpanan.</p>
                        <p>• Transaksi historis yang telah berstatus PAID tetap mengunci pembagian pendapatan yang berlaku pada saat transaksi diselesaikan.</p>
                      </div>

                      <div className="flex justify-end mt-4">
                        <Button
                          type="button"
                          onClick={handleSaveSettings}
                          size="sm"
                          className="bg-brand-orange hover:bg-orange-600 text-white font-bold px-5 space-x-1.5 shadow-sm"
                        >
                          <Save className="w-4 h-4" />
                          <span>Simpan Skema Bagi Hasil F&B</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* SUB-TAB 3: BAGI HASIL EVENT MARKETPLACE */}
                {partnerSubTab === "BAGI_HASIL_EVENTS" && (
                  <div className="space-y-6">
                    {/* Header Policy */}
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Kebijakan Komisi Bagi Hasil Event Marketplace</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Konfigurasi persentase komisi bagi hasil platform DAGO Creative Hub dan hak penyelenggara komunitas untuk penjualan tiket event publik.
                      </p>
                    </div>

                    {/* Section 1: Default Platform Policy Form */}
                    <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                          <Percent className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>1. Tarif Komisi Standar Platform (Default Policy)</span>
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                          TOTAL PEMBAGIAN: 100% (SEIMBANG)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">
                            Komisi Platform DAGO Hub (%)
                          </label>
                          <div className="flex items-center space-x-1.5">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              value={eventPlatformFee}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setEventPlatformFee(isNaN(val) ? 0 : Math.max(0, Math.min(100, val)));
                              }}
                              className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 text-xs"
                            />
                            <span className="font-bold text-slate-500 text-xs">%</span>
                          </div>
                          <span className="text-[10px] text-slate-400 mt-1 block">Default platform: 20%</span>
                        </div>

                        <div>
                          <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">
                            Bagian Penyelenggara Komunitas (%)
                          </label>
                          <div className="flex items-center space-x-1.5">
                            <input
                              type="number"
                              disabled
                              value={100 - eventPlatformFee}
                              className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 cursor-not-allowed text-xs"
                            />
                            <span className="font-bold text-slate-500 text-xs">%</span>
                          </div>
                          <span className="text-[10px] text-slate-400 mt-1 block">Otomatis dihitung (100% - Komisi)</span>
                        </div>

                        <div>
                          <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">
                            Tanggal Efektif Berlaku
                          </label>
                          <input
                            type="date"
                            value={eventPolicyEffectiveDate.split("T")[0]}
                            onChange={(e) => setEventPolicyEffectiveDate(new Date(e.target.value).toISOString())}
                            className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 text-xs"
                          />
                          <span className="text-[10px] text-slate-400 mt-1 block">Mulai berlaku untuk tiket baru</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">
                          Catatan / Alasan Penetapan Kebijakan
                        </label>
                        <input
                          type="text"
                          value={eventPolicyNotes}
                          onChange={(e) => setEventPolicyNotes(e.target.value)}
                          placeholder="Contoh: Penyesuaian komisi platform semester gasal 2026..."
                          className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900"
                        />
                      </div>

                      {eventPolicyFeedback && (
                        <div
                          className={`p-2.5 rounded-lg text-xs font-semibold ${
                            eventPolicyFeedback.startsWith("Error")
                              ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                          }`}
                        >
                          {eventPolicyFeedback}
                        </div>
                      )}

                      <div className="flex justify-end pt-2">
                        <Button
                          type="button"
                          onClick={handleSaveEventRevenuePolicy}
                          disabled={isSavingEventPolicy}
                          size="sm"
                          className="bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold px-4 text-xs rounded-xl shadow-xs"
                        >
                          <Save className="w-3.5 h-3.5 mr-1.5" />
                          <span>{isSavingEventPolicy ? "Menyimpan..." : "Simpan Kebijakan Komisi Platform"}</span>
                        </Button>
                      </div>
                    </div>

                    {/* Section 2: Interactive Revenue Simulation */}
                    <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                          <Calculator className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788]" />
                          <span>2. Simulasi Interaktif Pembagian Pendapatan Tiket</span>
                        </span>
                        <span className="text-[10px] text-slate-400">Model Komisi: {eventPlatformFee}% DAGO / {100 - eventPlatformFee}% Komunitas</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1 text-[11px]">
                            Harga Tiket Peserta (Rp)
                          </label>
                          <input
                            type="number"
                            step={5000}
                            min={0}
                            value={eventSimTicketPrice}
                            onChange={(e) => setEventSimTicketPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1 text-[11px]">
                            Estimasi Jumlah Tiket Terjual
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={500}
                            value={eventSimTicketQty}
                            onChange={(e) => setEventSimTicketQty(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      </div>

                      {(() => {
                        const gross = eventSimTicketPrice * eventSimTicketQty;
                        const platformFeeAmount = Math.round((gross * eventPlatformFee) / 100);
                        const organizerAmount = gross - platformFeeAmount;

                        return (
                          <div className="mt-2 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Omset Bruto</span>
                              <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 font-mono">
                                Rp {gross.toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                              <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 block">
                                Hak Penyelenggara ({100 - eventPlatformFee}%)
                              </span>
                              <span className="text-sm font-extrabold text-[#3B7A57] dark:text-[#52B788] font-mono">
                                Rp {organizerAmount.toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                                Komisi DAGO Hub ({eventPlatformFee}%)
                              </span>
                              <span className="text-sm font-extrabold text-slate-700 dark:text-slate-300 font-mono">
                                Rp {platformFeeAmount.toLocaleString("id-ID")}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Section 3: Per-Event Commission Overrides */}
                    <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                        <div>
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                            <Award className="w-4 h-4 text-brand-orange" />
                            <span>3. Override Tarif Komisi Khusus Per Event (Admin Only)</span>
                          </span>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Admin Dago dapat menetapkan persentase komisi khusus untuk event kolaborasi tertentu. Event tanpa override otomatis mengikuti default platform ({eventPlatformFee}%).
                          </p>
                        </div>
                      </div>

                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                        <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                          <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800">
                            <tr className="text-slate-400 uppercase text-[10px]">
                              <th className="p-2.5 font-bold">Event & Penyelenggara</th>
                              <th className="p-2.5 font-bold">Harga Tiket</th>
                              <th className="p-2.5 font-bold">Status Kebijakan Komisi</th>
                              <th className="p-2.5 font-bold text-right">Aksi Override Komisi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                            {activeAdminEvents.filter((e) => e.isPaid).length === 0 ? (
                              <tr>
                                <td colSpan={4} className="p-4 text-center text-slate-400 text-xs">
                                  Belum ada event berbayar yang terdaftar.
                                </td>
                              </tr>
                            ) : (
                              activeAdminEvents
                                .filter((e) => e.isPaid)
                                .map((evt) => {
                                  const currentOverride = eventOverrides[evt.id] ?? evt.customPlatformFeePercent ?? null;
                                  const isCustom = currentOverride !== null && currentOverride !== undefined;
                                  const effectiveRate = isCustom ? currentOverride : eventPlatformFee;

                                  return (
                                    <tr key={evt.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                      <td className="p-2.5">
                                        <div className="font-bold text-slate-900 dark:text-slate-100">{evt.title}</div>
                                        <div className="text-[10px] text-slate-400">{evt.organizerName}</div>
                                      </td>
                                      <td className="p-2.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                                        Rp {(evt.price || 0).toLocaleString("id-ID")}
                                      </td>
                                      <td className="p-2.5">
                                        {isCustom ? (
                                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                                            <span>CUSTOM: {effectiveRate}% DAGO / {100 - effectiveRate}% Mitra</span>
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                            <span>DEFAULT PLATFORM ({eventPlatformFee}% / {100 - eventPlatformFee}%)</span>
                                          </span>
                                        )}
                                      </td>
                                      <td className="p-2.5 text-right">
                                        <div className="inline-flex items-center space-x-2">
                                          <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            placeholder={`${eventPlatformFee}%`}
                                            value={currentOverride ?? ""}
                                            onChange={(e) => {
                                              const val = e.target.value === "" ? null : parseFloat(e.target.value);
                                              setEventOverrides((prev) => ({
                                                ...prev,
                                                [evt.id]: val === null || isNaN(val) ? null : Math.max(0, Math.min(100, val)),
                                              }));
                                            }}
                                            className="w-16 px-2 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded text-center font-bold bg-white dark:bg-slate-900"
                                          />
                                          <Button
                                            size="sm"
                                            type="button"
                                            variant="outline"
                                            onClick={() => handleSaveEventOverride(evt.id, eventOverrides[evt.id] ?? null)}
                                            className="h-7 text-[11px] font-bold px-2 rounded-lg"
                                          >
                                            Simpan
                                          </Button>
                                          {isCustom && (
                                            <Button
                                              size="sm"
                                              type="button"
                                              variant="ghost"
                                              onClick={() => handleSaveEventOverride(evt.id, null)}
                                              className="h-7 text-[11px] text-slate-400 hover:text-red-600 px-1.5"
                                              title="Kembalikan ke default platform"
                                            >
                                              Reset
                                            </Button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Section 4: Immutability & Business Rules Note */}
                    <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-[11px] text-emerald-950 dark:text-emerald-200 space-y-1.5">
                      <p className="font-bold flex items-center space-x-1.5">
                        <ShieldCheck className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788]" />
                        <span>Prinsip Keamanan Finansial & Snapshot Immutability:</span>
                      </p>
                      <ul className="list-disc list-inside space-y-0.5 text-[10px] text-emerald-900 dark:text-emerald-300 pl-1">
                        <li>
                          <strong>Snapshot Transaksi:</strong> Setiap pemesanan tiket yang berstatus <code>PAID</code> membekukan snapshot nominal komisi platform dan hak payout penyelenggara pada saat transaksi dibuat. Perubahan persentase komisi di halaman ini HANYA berlaku untuk tiket baru.
                        </li>
                        <li>
                          <strong>Dasar Perhitungan Bersih:</strong> Tiket yang berstatus <code>PENDING</code> atau <code>CANCELLED</code> tidak dihitung sebagai omset final.
                        </li>
                        <li>
                          <strong>Pemisahan Rekonsiliasi:</strong> Penghitungan estimasi bagi hasil tidak sama dengan pencairan dana (payout). Pencairan nyata memerlukan proses settlement verifikasi berkala.
                        </li>
                      </ul>
                    </div>

                    {/* Section 5: Policy Change History Log */}
                    <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                          <History className="w-4 h-4 text-slate-500" />
                          <span>4. Riwayat Perubahan Kebijakan Komisi (Audit Trail)</span>
                        </span>
                        <span className="text-[10px] text-slate-400">Total {eventPolicyHistory.length} entri terekam</span>
                      </div>

                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                        <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                          <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800">
                            <tr className="text-slate-400 uppercase text-[10px]">
                              <th className="p-2.5 font-bold">Waktu Perubahan</th>
                              <th className="p-2.5 font-bold">Diubah Oleh</th>
                              <th className="p-2.5 font-bold">Tarif Komisi</th>
                              <th className="p-2.5 font-bold">Catatan / Alasan</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                            {eventPolicyHistory.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="p-3 text-center text-slate-400 text-xs">
                                  Belum ada catatan riwayat perubahan.
                                </td>
                              </tr>
                            ) : (
                              eventPolicyHistory.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                  <td className="p-2.5 font-mono text-[11px] text-slate-500">
                                    {new Date(item.changedAt).toLocaleString("id-ID")}
                                  </td>
                                  <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200">
                                    {item.changedBy}
                                  </td>
                                  <td className="p-2.5 font-mono font-bold">
                                    <span className="text-slate-400 line-through mr-1">{item.previousPlatformFeePercent}%</span>
                                    <span className="text-[#3B7A57] dark:text-[#52B788]">➔ {item.newPlatformFeePercent}% DAGO</span>
                                  </td>
                                  <td className="p-2.5 text-slate-600 dark:text-slate-400">
                                    {item.reason}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* MODAL 1: TAMBAH PENYELENGGARA EVENT */}
                {isAddOrganizerModalOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-[#3B7A57] dark:text-[#52B788] flex items-center justify-center">
                            <Plus className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                              Daftarkan Penyelenggara Event Baru
                            </h3>
                            <p className="text-[10px] text-slate-400">
                              Pemberian hak akses dan pembuatan profil komunitas di DAGO Creative Hub
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsAddOrganizerModalOpen(false)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <form onSubmit={handleCreateOrganizerSubmit} className="space-y-3.5">
                        {addOrgError && (
                          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs">
                            {addOrgError}
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Nama Komunitas / Penyelenggara *
                          </label>
                          <input
                            type="text"
                            required
                            value={newOrgName}
                            onChange={(e) => setNewOrgName(e.target.value)}
                            placeholder="Contoh: Bandung Indie Filmmakers Guild"
                            className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#3B7A57]"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                              Kategori Komunitas
                            </label>
                            <input
                              type="text"
                              value={newOrgCategory}
                              onChange={(e) => setNewOrgCategory(e.target.value)}
                              placeholder="Kolektif Seni / Teknologi / Kopi"
                              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#3B7A57]"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                              Nama Penanggung Jawab (PIC) *
                            </label>
                            <input
                              type="text"
                              required
                              value={newOrgPIC}
                              onChange={(e) => setNewOrgPIC(e.target.value)}
                              placeholder="Nama koordinator komunitas"
                              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#3B7A57]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                              Nomor Telepon / WhatsApp *
                            </label>
                            <input
                              type="tel"
                              required
                              value={newOrgPhone}
                              onChange={(e) => setNewOrgPhone(e.target.value)}
                              placeholder="+62 812-xxxx-xxxx"
                              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#3B7A57]"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                              Alamat Email Login Terhubung *
                            </label>
                            <input
                              type="email"
                              required
                              value={newOrgEmail}
                              onChange={(e) => setNewOrgEmail(e.target.value)}
                              placeholder="kontak@komunitas.id"
                              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#3B7A57]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                              Status Akses Awal
                            </label>
                            <select
                              value={newOrgStatus}
                              onChange={(e) => setNewOrgStatus(e.target.value as any)}
                              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                            >
                              <option value="ACTIVE">AKTIF (Dapat Login & Ajukan Event)</option>
                              <option value="INACTIVE">NONAKTIF (Tertunda / Review)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                              Cakupan Hak Akses (RBAC)
                            </label>
                            <input
                              type="text"
                              disabled
                              value="Scope: TENANT (events:manage_own)"
                              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed font-mono text-[11px]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Catatan Kerjasama (Opsional)
                          </label>
                          <textarea
                            rows={2}
                            value={newOrgNotes}
                            onChange={(e) => setNewOrgNotes(e.target.value)}
                            placeholder="Informasi tambahan mengenai MOU atau jadwal kegiatan komunitas..."
                            className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#3B7A57]"
                          />
                        </div>

                        <div className="pt-2 flex items-center justify-end space-x-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsAddOrganizerModalOpen(false)}
                            className="text-xs h-9 px-4 rounded-xl"
                          >
                            Batal
                          </Button>
                          <Button
                            type="submit"
                            disabled={isSubmittingOrg}
                            className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold h-9 px-4 rounded-xl shadow-xs"
                          >
                            {isSubmittingOrg ? "Menyimpan..." : "Simpan Penyelenggara"}
                          </Button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* MODAL AKTIVASI: SALIN TAUTAN AKTIVASI PENYELENGGARA */}
                {activationModalData && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-[#3B7A57] dark:text-[#52B788] flex items-center justify-center">
                            <Key className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                              Tautan Aktivasi Akun Penyelenggara
                            </h3>
                            <p className="text-[10px] text-slate-400">
                              Masa berlaku 48 jam • Satu kali pakai • Token di-hash secara aman
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setActivationModalData(null);
                            setCopiedLink(false);
                          }}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Penyelenggara:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{activationModalData.organizerName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Email Akun:</span>
                          <span className="font-mono text-slate-800 dark:text-slate-200">{activationModalData.organizerEmail}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Kedaluwarsa:</span>
                          <span className="text-amber-600 dark:text-amber-400 font-medium">48 Jam (sejak diterbitkan)</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Tautan Aktivasi (Berikan kepada Penyelenggara secara Manual):
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            readOnly
                            value={activationModalData.activationUrl}
                            className="w-full px-3 py-2 text-xs font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 select-all"
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                          />
                          <Button
                            type="button"
                            onClick={() => {
                              if (navigator?.clipboard?.writeText) {
                                navigator.clipboard.writeText(activationModalData.activationUrl);
                              }
                              setCopiedLink(true);
                              showMasterToast("Tautan aktivasi berhasil disalin ke clipboard.");
                              setTimeout(() => setCopiedLink(false), 3000);
                            }}
                            className={`h-9 px-3 shrink-0 rounded-xl text-xs font-bold transition-all ${
                              copiedLink
                                ? "bg-emerald-600 text-white"
                                : "bg-[#3B7A57] hover:bg-[#2D5F43] text-white"
                            }`}
                          >
                            {copiedLink ? (
                              <>
                                <Check className="w-3.5 h-3.5 mr-1" />
                                <span>Tersalin!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 mr-1" />
                                <span>Salin Tautan</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-2.5">
                        <span className="font-semibold text-amber-800 dark:text-amber-300">Catatan Keamanan:</span> Tautan ini hanya berlaku untuk 1 kali aktivasi password. Token mentah tidak disimpan dan tidak akan ditampilkan kembali setelah jendela ini ditutup.
                      </div>

                      <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setActivationModalData(null);
                            setCopiedLink(false);
                          }}
                          className="text-xs font-bold h-8 px-4 rounded-xl border-slate-300 dark:border-slate-700"
                        >
                          Tutup
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* MODAL 2: DETAIL & HAK AKSES MITRA */}
                {selectedPartnerDetail && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center space-x-2.5">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              selectedPartnerDetail.type === "FNB"
                                ? "bg-amber-100 dark:bg-amber-950/60 text-brand-orange"
                                : "bg-emerald-100 dark:bg-emerald-950/60 text-[#3B7A57] dark:text-[#52B788]"
                            }`}
                          >
                            {selectedPartnerDetail.type === "FNB" ? (
                              <Store className="w-4 h-4" />
                            ) : (
                              <Calendar className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                              {selectedPartnerDetail.name}
                            </h3>
                            <span className="text-[10px] text-slate-400">
                              {selectedPartnerDetail.categoryOrBadge} • {selectedPartnerDetail.type === "FNB" ? "Mitra Kuliner F&B" : "Komunitas Penyelenggara Event"}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedPartnerDetail(null)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="space-y-3 text-xs">
                        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Penanggung Jawab (PIC)</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedPartnerDetail.contactPerson}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Kontak Telepon / WA</span>
                            <span className="font-mono text-slate-700 dark:text-slate-300">{selectedPartnerDetail.phone}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Akun Login Terdaftar</span>
                            <span className="font-mono text-slate-700 dark:text-slate-300">{selectedPartnerDetail.email}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Status Akses Akun</span>
                            <span
                              className={`inline-flex items-center space-x-1 font-bold ${
                                selectedPartnerDetail.status === "ACTIVE"
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              <span>{selectedPartnerDetail.status === "ACTIVE" ? "AKTIF (Dapat Login)" : "NONAKTIF (Diblokir)"}</span>
                            </span>
                          </div>
                        </div>

                        {/* RBAC & Isolation Context */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Aturan Hak Akses & Isolasi Data (RBAC)
                          </span>
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-slate-500">Scope Level: </span>
                              <strong className="font-mono text-slate-800 dark:text-slate-200">{selectedPartnerDetail.scopeLevel}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500">Peran Sistem: </span>
                              <strong className="text-slate-800 dark:text-slate-200">{selectedPartnerDetail.roleName}</strong>
                            </div>
                          </div>
                          <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] text-slate-400 block mb-1">Daftar Kode Izin (Permissions):</span>
                            <div className="flex flex-wrap gap-1">
                              {selectedPartnerDetail.permissions.map((code) => (
                                <span
                                  key={code}
                                  className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[9px] text-slate-600 dark:text-slate-300"
                                >
                                  {code}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {selectedPartnerDetail.bankInfo && (
                          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              Rekening Settlement / Pencairan Bagi Hasil
                            </span>
                            <p className="font-mono text-slate-800 dark:text-slate-200 text-xs">
                              {selectedPartnerDetail.bankInfo.bankName} — {selectedPartnerDetail.bankInfo.accountNumber} ({selectedPartnerDetail.bankInfo.accountHolder})
                            </p>
                          </div>
                        )}

                        {selectedPartnerDetail.notes && (
                          <div className="text-[11px] text-slate-500 italic p-2 bg-slate-50 dark:bg-slate-800/30 rounded-lg">
                            "{selectedPartnerDetail.notes}"
                          </div>
                        )}
                      </div>

                      <div className="pt-2 flex justify-end">
                        <Button
                          type="button"
                          onClick={() => setSelectedPartnerDetail(null)}
                          className="text-xs h-8 px-4 rounded-xl bg-slate-800 text-white hover:bg-slate-700"
                        >
                          Tutup
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: CO-WORKING & RUANGAN */}
            {selectedMasterTab === "Co-working & Ruangan" && (
              <div className="p-4 space-y-6">
                {/* Workspaces Table */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wide flex items-center space-x-2">
                      <Laptop className="w-4 h-4 text-blue-600" />
                      <span>Daftar Ruang Workspace & Meeting Room</span>
                    </h4>
                  </div>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                      <thead className="bg-slate-50">
                        <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                          <th className="p-3 font-bold">Nama Workspace</th>
                          <th className="p-3 font-bold">Tipe & Area</th>
                          <th className="p-3 font-bold">Kapasitas</th>
                          <th className="p-3 font-bold">Tarif / Jam</th>
                          <th className="p-3 font-bold">Tarif / Hari</th>
                          <th className="p-3 font-bold">Status</th>
                          <th className="p-3 font-bold text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                        {localSpaces.map((sp) => (
                          <tr key={sp.id} className="hover:bg-slate-50/50">
                            <td className="p-3 font-bold text-slate-900 flex items-center space-x-2.5">
                              {sp.imageUrl ? (
                                <img
                                  src={sp.imageUrl}
                                  alt={sp.name}
                                  className="w-8 h-8 rounded-lg object-cover border border-slate-200 shadow-2xs shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                                  <Laptop className="w-4 h-4 text-blue-600" />
                                </div>
                              )}
                              <span>{sp.name}</span>
                            </td>
                            <td className="p-3 font-semibold text-slate-700">{sp.type} ({sp.area})</td>
                            <td className="p-3 font-mono text-slate-600">{sp.capacity} Orang</td>
                            <td className="p-3 font-mono font-bold text-brand-orange">{formatCurrencyIDR(sp.hourlyRate || 15000)}</td>
                            <td className="p-3 font-mono text-slate-600">{formatCurrencyIDR(sp.dailyRate || 65000)}</td>
                            <td className="p-3">
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                                {sp.status}
                              </span>
                            </td>
                            <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                              <Button
                                size="sm"
                                type="button"
                                variant="outline"
                                onClick={() => handleOpenEditSpace(sp)}
                                className="h-7 w-7 p-0 rounded-lg hover:bg-slate-100 text-slate-600"
                                title="Edit Ruang"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setDeletingSpace(sp);
                                  setIsDeleteSpaceModalOpen(true);
                                }}
                                className="h-7 w-7 p-0 rounded-lg hover:bg-rose-50 text-rose-600 border-rose-200"
                                title="Hapus Ruang"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Membership Plans Table */}
                <div className="pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center space-x-2">
                      <Award className="w-4 h-4 text-primary" />
                      <span>Daftar Paket Membership Co-Working</span>
                    </h4>
                  </div>
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                      <thead className="bg-slate-50 dark:bg-slate-850">
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px]">
                          <th className="p-3 font-bold">Nama Paket</th>
                          <th className="p-3 font-bold">Siklus / Durasi</th>
                          <th className="p-3 font-bold">Harga</th>
                          <th className="p-3 font-bold">Akses Meja & Fasilitas</th>
                          <th className="p-3 font-bold">Status</th>
                          <th className="p-3 font-bold text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900">
                        {localPlans.map((pl) => (
                          <tr key={pl.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                            <td className="p-3 font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                              <Award className="w-3.5 h-3.5 text-primary" />
                              <span>{pl.name}</span>
                            </td>
                            <td className="p-3 font-mono text-slate-500 dark:text-slate-400">{pl.billingCycle}</td>
                            <td className="p-3 font-mono font-bold text-primary">{pl.priceFormatted}</td>
                            <td className="p-3 font-medium text-slate-600 dark:text-slate-400 max-w-xs truncate">{pl.deskAccess}</td>
                            <td className="p-3">
                              <span className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                                AKTIF
                              </span>
                            </td>
                            <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                              <Button
                                size="sm"
                                type="button"
                                variant="outline"
                                onClick={() => handleOpenEditPlan(pl)}
                                className="h-7 w-7 p-0 rounded-lg hover:bg-slate-100 text-slate-600"
                                title="Edit Paket"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setDeletingPlan(pl);
                                  setIsDeletePlanModalOpen(true);
                                }}
                                className="h-7 w-7 p-0 rounded-lg hover:bg-rose-50 text-rose-600 border-rose-200"
                                title="Hapus Paket"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: MEJA & AREA */}
            {selectedMasterTab === "Meja & Area" && (
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wide flex items-center space-x-2">
                    <Grid className="w-4 h-4 text-slate-600" />
                    <span>Daftar Meja Dine-In F&B & Layout Area</span>
                  </h4>
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                    <thead className="bg-slate-50">
                      <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                        <th className="p-3 font-bold">Nomor / Nama Meja</th>
                        <th className="p-3 font-bold">Area</th>
                        <th className="p-3 font-bold">Kapasitas Kursi</th>
                        <th className="p-3 font-bold">Status</th>
                        <th className="p-3 font-bold text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                      {localTables.map((tbl) => (
                        <tr key={tbl.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-bold text-slate-900 flex items-center space-x-2">
                            <Grid className="w-3.5 h-3.5 text-slate-600" />
                            <span>Meja {tbl.number}</span>
                          </td>
                          <td className="p-3 font-medium text-slate-700">{tbl.areaName || "Main Hall"}</td>
                          <td className="p-3 font-mono text-slate-600">{tbl.cap || 4} Kursi</td>
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => handleToggleTableStatus(tbl.id)}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${tbl.status === "AVAILABLE"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                : tbl.status === "OCCUPIED"
                                  ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                                  : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                }`}
                              title="Klik untuk ubah status meja"
                            >
                              {tbl.status || "AVAILABLE"} ⟳
                            </button>
                          </td>
                          <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                            <Button
                              size="sm"
                              type="button"
                              variant="outline"
                              onClick={() => handleOpenEditTable(tbl)}
                              className="h-7 w-7 p-0 rounded-lg hover:bg-slate-100 text-slate-600"
                              title="Edit Meja"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setDeletingTable(tbl);
                                setIsDeleteTableModalOpen(true);
                              }}
                              className="h-7 w-7 p-0 rounded-lg hover:bg-rose-50 text-rose-600 border-rose-200"
                              title="Hapus Meja"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 5: VOUCHER & PROMO */}
            {selectedMasterTab === "Voucher & Promo" && (
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wide flex items-center space-x-2">
                      <Tag className="w-4 h-4 text-emerald-600" />
                      <span>Manajemen Voucher & Promo Platform</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Konfigurasi voucher kupon untuk F&B (Kasir / Customer Portal) dan Co-Working.
                    </p>
                  </div>
                </div>

                {promos.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs italic">
                    Belum ada promo yang dikonfigurasi. Klik "+ Tambah Voucher Promo" di pojok kanan atas.
                  </div>
                ) : (
                  sortPromosByPriority(promos).map((promo) => {
                    const computedStatus = getPromoComputedStatus(promo);
                    const isMuted = computedStatus !== "ACTIVE" && computedStatus !== "SCHEDULED";
                    const targetProductIds = promo.applicableProductIds || (promo.targetId ? promo.targetId.split(",").map((s) => s.trim()).filter(Boolean) : []);

                    return (
                      <div
                        key={promo.id}
                        className={`border rounded-2xl p-4 space-y-3 shadow-2xs transition-all ${
                          isMuted
                            ? "bg-slate-100/70 border-slate-300/80 opacity-80"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        {/* Row 1: Code, Name, Status Badge, Active Toggle & Delete */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200/80">
                          <div className="flex items-center space-x-2 flex-1">
                            <div className="w-28">
                              <label className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Kode Kupon</label>
                              <input
                                type="text"
                                value={promo.code || ""}
                                onChange={(e) => {
                                  const val = e.target.value.toUpperCase();
                                  setPromos((prev) => prev.map((p) => (p.id === promo.id ? { ...p, code: val } : p)));
                                }}
                                placeholder="DAGO20"
                                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-black uppercase w-full bg-white text-emerald-700 focus:ring-1 focus:ring-emerald-500"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Nama Promo</label>
                              <input
                                type="text"
                                value={promo.name}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPromos((prev) => prev.map((p) => (p.id === promo.id ? { ...p, name: val } : p)));
                                }}
                                placeholder="Nama Promo"
                                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold w-full bg-white text-slate-800"
                              />
                            </div>
                            {/* Computed Status Badge (Revisi 6) */}
                            <div className="self-end pb-1.5">
                              {computedStatus === "ACTIVE" && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                                  AKTIF
                                </span>
                              )}
                              {computedStatus === "SCHEDULED" && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                  TERJADWAL
                                </span>
                              )}
                              {computedStatus === "EXPIRED" && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  KADALUWARSA
                                </span>
                              )}
                              {computedStatus === "QUOTA_EXHAUSTED" && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  KUOTA HABIS
                                </span>
                              )}
                              {computedStatus === "INACTIVE" && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 border border-slate-300">
                                  NONAKTIF
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-3 self-end sm:self-center">
                            <div className="text-right">
                              <span className="text-[10px] font-bold text-slate-500 block">
                                Terpakai: <strong className="text-slate-900">{promo.usageCount || 0}</strong> / {promo.quota || "∞"}
                              </span>
                            </div>
                            <label className="text-xs flex items-center space-x-1.5 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                              <input
                                type="checkbox"
                                checked={promo.isActive}
                                onChange={(e) => {
                                  const val = e.target.checked;
                                  setPromos((prev) => prev.map((p) => (p.id === promo.id ? { ...p, isActive: val } : p)));
                                }}
                                className="rounded text-emerald-600"
                              />
                              <span className="font-bold text-[11px] text-slate-700">{promo.isActive ? "Aktif" : "Nonaktif"}</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => setPromos((prev) => prev.filter((p) => p.id !== promo.id))}
                              className="text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Row 2: Deskripsi */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Deskripsi Singkat / Syarat Ketentuan</label>
                          <input
                            type="text"
                            value={promo.description || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPromos((prev) => prev.map((p) => (p.id === promo.id ? { ...p, description: val } : p)));
                            }}
                            placeholder="Contoh: Diskon 20% untuk semua transaksi weekend..."
                            className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs w-full bg-white text-slate-600"
                          />
                        </div>

                        {/* Row 3: Grid Configuration */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                          <div>
                            <label className="block text-slate-500 font-medium mb-1">Berlaku Untuk</label>
                            <select
                              value={promo.scope || "ALL"}
                              onChange={(e) => {
                                const val = e.target.value as any;
                                setPromos((prev) => prev.map((p) => (p.id === promo.id ? { ...p, scope: val } : p)));
                              }}
                              className="w-full px-2 py-1.5 border rounded-lg bg-white font-bold text-slate-700"
                            >
                              <option value="ALL">Semua (F&B & Co-Work)</option>
                              <option value="FNB">Khusus F&B</option>
                              <option value="COWORKING">Khusus Co-Working</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-slate-500 font-medium mb-1">Tipe Diskon</label>
                            <select
                              value={promo.discountType}
                              onChange={(e) => {
                                const val = e.target.value as PromoType;
                                setPromos((prev) => prev.map((p) => (p.id === promo.id ? { ...p, discountType: val } : p)));
                              }}
                              className="w-full px-2 py-1.5 border rounded-lg bg-white font-bold text-slate-700"
                            >
                              <option value="PERCENTAGE">Persentase (%)</option>
                              <option value="FIXED">Nominal Fixed (Rp)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-slate-500 font-medium mb-1">
                              {promo.discountType === "PERCENTAGE" ? "Nilai Diskon (%)" : "Nilai Diskon (Rp)"}
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={promo.discountValue}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setPromos((prev) => prev.map((p) => (p.id === promo.id ? { ...p, discountValue: val } : p)));
                              }}
                              className="w-full px-2 py-1.5 border rounded-lg bg-white font-bold"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-500 font-medium mb-1">Maks. Diskon (Rp)</label>
                            <input
                              type="number"
                              min={0}
                              value={promo.maxDiscount || ""}
                              onChange={(e) => {
                                const val = e.target.value ? Number(e.target.value) : undefined;
                                setPromos((prev) => prev.map((p) => (p.id === promo.id ? { ...p, maxDiscount: val } : p)));
                              }}
                              placeholder="Tanpa batas"
                              className="w-full px-2 py-1.5 border rounded-lg bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-500 font-medium mb-1">Min. Belanja (Rp)</label>
                            <input
                              type="number"
                              min={0}
                              value={promo.minimumAmount || ""}
                              onChange={(e) => {
                                const val = e.target.value ? Number(e.target.value) : undefined;
                                setPromos((prev) => prev.map((p) => (p.id === promo.id ? { ...p, minimumAmount: val } : p)));
                              }}
                              placeholder="0 (Tanpa min)"
                              className="w-full px-2 py-1.5 border rounded-lg bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-500 font-medium mb-1">Kuota Pemakaian</label>
                            <input
                              type="number"
                              min={1}
                              value={promo.quota || ""}
                              onChange={(e) => {
                                const val = e.target.value ? Number(e.target.value) : undefined;
                                setPromos((prev) => prev.map((p) => (p.id === promo.id ? { ...p, quota: val } : p)));
                              }}
                              placeholder="Tanpa batas"
                              className="w-full px-2 py-1.5 border rounded-lg bg-white"
                            />
                          </div>
                        </div>

                        {/* Row 4: Scope, Target Type & Periode Validitas */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 text-xs pt-1">
                          <div>
                            <label className="block text-slate-500 font-medium mb-1">Lingkup Layanan</label>
                            <select
                              value={promo.scope || "ALL"}
                              onChange={(e) => {
                                const val = e.target.value as PromoScope;
                                setPromos((prev) =>
                                  prev.map((p) =>
                                    p.id === promo.id
                                      ? {
                                          ...p,
                                          scope: val,
                                          targetType: "ALL",
                                          targetId: undefined,
                                          applicableProductIds: [],
                                        }
                                      : p
                                  )
                                );
                              }}
                              className="w-full px-2 py-1.5 border rounded-lg bg-white font-bold text-slate-700"
                            >
                              <option value="ALL">Semua Layanan (F&B & Co-Work)</option>
                              <option value="FNB">Khusus F&B</option>
                              <option value="COWORKING">Khusus Co-Working</option>
                            </select>
                          </div>

                          {promo.scope === "COWORKING" ? (
                            <div>
                              <label className="block text-slate-500 font-medium mb-1">Target Ruangan Co-Working</label>
                              <select
                                value={promo.targetId || "ALL"}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPromos((prev) =>
                                    prev.map((p) =>
                                      p.id === promo.id
                                        ? {
                                            ...p,
                                            targetType: val === "ALL" ? "ALL" : ("SPACE" as any),
                                            targetId: val === "ALL" ? undefined : val,
                                          }
                                        : p
                                    )
                                  );
                                }}
                                className="w-full px-2 py-1.5 border rounded-lg bg-white font-bold text-slate-700"
                              >
                                <option value="ALL">Semua Ruangan & Desk</option>
                                {cwSpaces.map((sp) => (
                                  <option key={sp.id} value={sp.id}>
                                    {sp.name} ({sp.type.replace("_", " ")})
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div>
                              <label className="block text-slate-500 font-medium mb-1">Target Menu/Mitra</label>
                              <select
                                value={promo.targetType || "ALL"}
                                onChange={(e) => {
                                  const val = e.target.value as any;
                                  setPromos((prev) =>
                                    prev.map((p) => (p.id === promo.id ? { ...p, targetType: val } : p))
                                  );
                                }}
                                className="w-full px-2 py-1.5 border rounded-lg bg-white font-bold text-slate-700"
                              >
                                <option value="ALL">Semua Menu & Mitra</option>
                                <option value="TENANT">Khusus Mitra / Tenant</option>
                                <option value="CATEGORY">Khusus Kategori</option>
                                <option value="PRODUCT">Khusus Produk Tertentu (Multi-Select)</option>
                              </select>
                            </div>
                          )}

                          <div>
                            {promo.scope === "COWORKING" ? (
                              <div>
                                <label className="block text-slate-500 font-medium mb-1">Keterangan Target</label>
                                <input
                                  type="text"
                                  disabled
                                  value={
                                    !promo.targetId || promo.targetId === "ALL"
                                      ? "Semua Desk & Ruangan"
                                      : cwSpaces.find((s) => s.id === promo.targetId)?.name || promo.targetId
                                  }
                                  className="w-full px-2.5 py-1.5 border rounded-lg text-xs bg-slate-100 text-slate-500 cursor-not-allowed font-medium"
                                />
                              </div>
                            ) : (
                              <>
                                <label className="block text-slate-500 font-medium mb-1">
                                  {promo.targetType === "TENANT"
                                    ? "Pilih Mitra Target"
                                    : promo.targetType === "CATEGORY"
                                    ? "Pilih Kategori Target"
                                    : promo.targetType === "PRODUCT"
                                    ? `Produk Target (${targetProductIds.length} Dipilih)`
                                    : "Lingkup Target"}
                                </label>

                                {/* Dropdown for TENANT */}
                                {promo.targetType === "TENANT" && (
                                  <select
                                    value={promo.targetId || ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setPromos((prev) =>
                                        prev.map((p) => (p.id === promo.id ? { ...p, targetId: val } : p))
                                      );
                                    }}
                                    className="w-full px-2.5 py-1.5 border rounded-lg bg-white font-semibold text-slate-800"
                                  >
                                    <option value="">Pilih Mitra...</option>
                                    {localTenants.map((t) => (
                                      <option key={t.id} value={t.id}>
                                        {t.name} ({t.code})
                                      </option>
                                    ))}
                                  </select>
                                )}

                                {/* Dropdown for CATEGORY */}
                                {promo.targetType === "CATEGORY" && (
                                  <select
                                    value={promo.targetId || ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setPromos((prev) =>
                                        prev.map((p) => (p.id === promo.id ? { ...p, targetId: val } : p))
                                      );
                                    }}
                                    className="w-full px-2.5 py-1.5 border rounded-lg bg-white font-semibold text-slate-800"
                                  >
                                    <option value="">Pilih Kategori...</option>
                                    {categories.map((c) => (
                                      <option key={c} value={c}>
                                        {c}
                                      </option>
                                    ))}
                                  </select>
                                )}

                                {/* Multi-Select Button for PRODUCT (Revisi 5) */}
                                {promo.targetType === "PRODUCT" && (
                                  <div className="space-y-1.5">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleOpenPromoProductSelect(promo.id)}
                                      className="w-full h-8 text-xs font-bold border-brand-orange text-brand-orange hover:bg-orange-50 flex items-center justify-center space-x-1 rounded-lg"
                                    >
                                      <UtensilsCrossed className="w-3.5 h-3.5 mr-1" />
                                      <span>+ Pilih Menu Produk ({targetProductIds.length})</span>
                                    </Button>
                                    {targetProductIds.length > 0 && (
                                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto p-1.5 bg-white border border-slate-200 rounded-lg">
                                        {targetProductIds.map((pid) => {
                                          const prod = filteredProducts.find((p) => p.id === pid);
                                          return (
                                            <span
                                              key={pid}
                                              className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-orange-50 border border-orange-200 text-orange-900 text-[10px] font-medium"
                                            >
                                              <span className="truncate max-w-[100px]">{prod?.name || pid}</span>
                                              <button
                                                type="button"
                                                onClick={() => handleRemoveProductFromPromo(promo.id, pid)}
                                                className="text-orange-500 hover:text-rose-600 ml-0.5"
                                                title="Hapus dari promo"
                                              >
                                                <X className="w-2.5 h-2.5" />
                                              </button>
                                            </span>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* ALL / Fallback */}
                                {(!promo.targetType || promo.targetType === "ALL") && (
                                  <input
                                    type="text"
                                    disabled
                                    value="Berlaku untuk Semua Menu"
                                    className="w-full px-2.5 py-1.5 border rounded-lg text-xs bg-slate-100 text-slate-400 cursor-not-allowed"
                                  />
                                )}
                              </>
                            )}
                          </div>

                          <div>
                            <label className="block text-slate-500 font-medium mb-1">Tanggal Mulai Berlaku</label>
                            <input
                              type="date"
                              value={promo.validFrom ? promo.validFrom.split("T")[0] : ""}
                              onChange={(e) => {
                                const val = e.target.value ? new Date(e.target.value).toISOString() : undefined;
                                setPromos((prev) =>
                                  prev.map((p) => (p.id === promo.id ? { ...p, validFrom: val } : p))
                                );
                              }}
                              className="w-full px-2.5 py-1.5 border rounded-lg bg-white text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-500 font-medium mb-1">Tanggal Berakhir (Expired)</label>
                            <input
                              type="date"
                              value={promo.validUntil ? promo.validUntil.split("T")[0] : ""}
                              onChange={(e) => {
                                const val = e.target.value ? new Date(e.target.value + "T23:59:59.000Z").toISOString() : undefined;
                                setPromos((prev) =>
                                  prev.map((p) => (p.id === promo.id ? { ...p, validUntil: val } : p))
                                );
                              }}
                              className="w-full px-2.5 py-1.5 border rounded-lg bg-white text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    onClick={handleSaveSettings}
                    size="sm"
                    className="bg-brand-orange hover:bg-orange-600 text-white font-bold px-5 space-x-1.5 shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    <span>Simpan Perubahan Voucher Promo</span>
                  </Button>
                </div>
              </div>
            )}

            {/* TAB 6: KONFIGURASI PLATFORM & PAJAK */}
            {selectedMasterTab === "Konfigurasi Platform & Pajak" && (
              <form onSubmit={handleSaveSettings} className="p-4 space-y-6">
                {/* Business Module Activation Toggles */}
                <Card className="shadow-2xs border border-slate-200">
                  <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                    <CardTitle className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                      <Building className="w-4 h-4 text-brand-orange" />
                      <span>Aktivasi Modul Bisnis Organisasi</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Modul yang dinonaktifkan akan diblokir dari antarmuka, routing, dan API secara server-side.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    {moduleDefinitions.map((mod) => {
                      const isActive = activeOrgModules.includes(mod.code as any);
                      return (
                        <div
                          key={mod.code}
                          className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${isActive ? "bg-white border-slate-200" : "bg-slate-50/70 border-slate-200/60 opacity-80"
                            }`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="p-2 rounded-lg bg-slate-100 mt-0.5">{mod.icon}</div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <h4 className="font-bold text-xs text-slate-900">{mod.name}</h4>
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                                    }`}
                                >
                                  {isActive ? "ACTIVE" : "INACTIVE"}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5 max-w-xl">{mod.desc}</p>
                            </div>
                          </div>

                          <div className="pl-4">
                            {mod.isRequired ? (
                              <span className="text-[10px] text-slate-400 font-semibold italic">Modul Inti (Wajib)</span>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant={isActive ? "outline" : "default"}
                                onClick={() => toggleOrgModule(mod.code as any)}
                                className={`text-xs h-8 ${isActive ? "text-red-600 hover:bg-red-50" : "bg-purple-600 hover:bg-purple-700 text-white"
                                  }`}
                              >
                                {isActive ? "Nonaktifkan" : "Aktifkan Modul"}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* Localization & Region */}
                <Card className="shadow-2xs border border-slate-200">
                  <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                    <CardTitle className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                      <Globe className="w-4 h-4 text-blue-600" />
                      <span>Lokalisasi, Bahasa & Zona Waktu</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Bahasa Tampilan (Language)</label>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value as "id" | "en")}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="id">Bahasa Indonesia (ID)</option>
                        <option value="en">English (EN)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Zona Waktu Operasional</label>
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="Asia/Makassar">WITA (Asia/Makassar - Bali & Singaraja)</option>
                        <option value="Asia/Jakarta">WIB (Asia/Jakarta - Jawa)</option>
                        <option value="Asia/Jayapura">WIT (Asia/Jayapura - Timur)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Mata Uang Transaksi</label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="IDR">IDR (Rupiah Indonesia - Rp)</option>
                        <option value="USD">USD (US Dollar - $)</option>
                      </select>
                    </div>
                  </CardContent>
                </Card>

                {/* Tax & Financial Charges */}
                <Card className="shadow-2xs border border-slate-200">
                  <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                    <CardTitle className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                      <Receipt className="w-4 h-4 text-purple-600" />
                      <span>Konfigurasi Pajak PB1 & Service Charge</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Pajak Restoran / PB1 (%)</label>
                      <input
                        type="number"
                        value={taxRate}
                        onChange={(e) => setTaxRate(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Diterapkan otomatis pada kalkulasi struk POS Kasir.</p>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Service Charge Gerai (%)</label>
                      <input
                        type="number"
                        value={serviceCharge}
                        onChange={(e) => setServiceCharge(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Biaya pelayanan dine-in operasional gerai.</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Inventory Stock Thresholds & Loyalty Configuration */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Low Stock Alert */}
                  <Card className="shadow-2xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850">
                      <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 text-primary" />
                        <span>Ambang Batas Peringatan Stok Kritis (%)</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 text-xs space-y-2">
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Low Stock Threshold Percent (%)</label>
                        <input
                          type="number"
                          value={lowStock}
                          onChange={(e) => setLowStock(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg font-bold text-slate-900 dark:text-slate-100"
                        />
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                          Bahan dengan sisa stok di bawah persentase ini otomatis memicu Restock Alert.
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Loyalty Tier Thresholds */}
                  <Card className="shadow-2xs border border-slate-200">
                    <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                      <CardTitle className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                        <Award className="w-4 h-4 text-purple-600" />
                        <span>Ambang Batas Poin Loyalty Tier</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 text-xs space-y-2.5">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-slate-600 font-semibold mb-1">Min. Silver (Pts)</label>
                          <input
                            type="number"
                            value={silverPts}
                            onChange={(e) => setSilverPts(Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 font-semibold mb-1">Min. Gold (Pts)</label>
                          <input
                            type="number"
                            value={goldPts}
                            onChange={(e) => setGoldPts(Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 font-semibold mb-1">Min. Platinum (Pts)</label>
                          <input
                            type="number"
                            value={platPts}
                            onChange={(e) => setPlatPts(Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold"
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Member baru otomatis Bronze (0 poin). Kenaikan tier dihitung otomatis sesuai akumulasi transaksi.
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* PEMISAHAN JAM OPERASIONAL LAYANAN (REVISI 4) */}
                <Card className="shadow-2xs border border-slate-200">
                  <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                    <CardTitle className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-brand-orange" />
                      <span>Pemisahan Jam Operasional Layanan (F&B vs Co-Working)</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Atur jam operasional independen untuk layanan Kuliner F&B (POS Kasir & Portal) dan Ruang Co-Working.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    {/* Co-working Operating Hours */}
                    <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                        <div className="flex items-center space-x-2 font-bold text-slate-800">
                          <Laptop className="w-4 h-4 text-blue-600" />
                          <span>Co-Working Space</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">09.00 - 18.00 Default</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Pemesanan slot / meja co-working hanya diizinkan dalam rentang jam operasional ini.
                      </p>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Jam Buka</label>
                          <input
                            type="time"
                            value={cwOpenTime}
                            onChange={(e) => setCwOpenTime(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-bold text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Jam Tutup</label>
                          <input
                            type="time"
                            value={cwCloseTime}
                            onChange={(e) => setCwCloseTime(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-bold text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* F&B Operating Hours */}
                    <div className="p-3.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-850 space-y-2">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center space-x-2 font-bold text-slate-800 dark:text-slate-200">
                          <UtensilsCrossed className="w-4 h-4 text-primary" />
                          <span>Kuliner & F&B Hub</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 dark:bg-primary/20 text-primary">07.00 - 22.00 Default</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Transaksi POS kasir dan pesanan Customer Portal mobile F&B dibatasi dalam rentang jam ini.
                      </p>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Jam Buka</label>
                          <input
                            type="time"
                            value={fnbOpenTime}
                            onChange={(e) => setFnbOpenTime(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-bold text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Jam Tutup</label>
                          <input
                            type="time"
                            value={fnbCloseTime}
                            onChange={(e) => setFnbCloseTime(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-bold text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* KALENDER HARI LIBUR & ATURAN CO-WORKING (REVISI 1) */}
                <Card className="shadow-2xs border border-slate-200">
                  <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                    <CardTitle className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-emerald-600" />
                      <span>Kalender Hari Libur & Aturan Co-Working</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Aturan operasional hari libur nasional Indonesia dan akhir pekan (Sabtu & Minggu) beserta override tanggal khusus.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4 text-xs">
                    {/* Toggles */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 border border-slate-200 rounded-xl bg-white flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-800">Tutup Akhir Pekan (Sabtu & Minggu)</p>
                          <p className="text-[11px] text-slate-500">Co-working tutup default pada hari Sabtu dan Minggu.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer ml-3">
                          <input
                            type="checkbox"
                            checked={cwWeekendClosed}
                            onChange={(e) => setCwWeekendClosed(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                      </div>

                      <div className="p-3 border border-slate-200 rounded-xl bg-white flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-800">Tutup Hari Libur Nasional (Default)</p>
                          <p className="text-[11px] text-slate-500">Tutup otomatis saat libur nasional resmi Republik Indonesia.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer ml-3">
                          <input
                            type="checkbox"
                            checked={cwNationalHolidaysClosed}
                            onChange={(e) => setCwNationalHolidaysClosed(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                      </div>
                    </div>

                    {/* Daftar Libur Nasional 2026 */}
                    <details className="border border-slate-200 rounded-xl bg-slate-50/50 p-3">
                      <summary className="font-bold text-slate-700 cursor-pointer flex items-center justify-between">
                        <span className="flex items-center space-x-2">
                          <CalendarDays className="w-4 h-4 text-slate-500" />
                          <span>Lihat Jadwal Hari Libur Nasional Indonesia 2026 ({INDONESIAN_NATIONAL_HOLIDAYS_2026.length} Hari)</span>
                        </span>
                        <span className="text-[10px] text-slate-400">Klik untuk melihat</span>
                      </summary>
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pt-2 border-t border-slate-200">
                        {INDONESIAN_NATIONAL_HOLIDAYS_2026.map((h: { date: string; name: string }) => (
                          <div key={h.date} className="p-2 bg-white border border-slate-200 rounded-lg text-[11px]">
                            <span className="font-mono font-bold text-rose-700 block">{h.date}</span>
                            <span className="text-slate-600 line-clamp-1">{h.name}</span>
                          </div>
                        ))}
                      </div>
                    </details>

                    {/* Form Override Tanggal Khusus */}
                    <div className="border border-slate-200 rounded-xl p-3.5 bg-white space-y-3">
                      <div>
                        <h5 className="font-bold text-slate-800">Override Tanggal Khusus (Owner / Admin)</h5>
                        <p className="text-[11px] text-slate-500">
                          Gunakan override untuk membuka Co-working pada tanggal merah / akhir pekan tertentu, atau menutup pada hari kerja biasa.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Tanggal</label>
                          <input
                            type="date"
                            value={newOverrideDate}
                            onChange={(e) => setNewOverrideDate(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Kebijakan Status</label>
                          <select
                            value={newOverrideType}
                            onChange={(e) => setNewOverrideType(e.target.value as "OPEN" | "CLOSED")}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-bold"
                          >
                            <option value="OPEN">BUKA_KHUSUS (Buka di Hari Libur)</option>
                            <option value="CLOSED">TUTUP_KHUSUS (Tutup di Hari Kerja)</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2 flex items-end space-x-2">
                          <div className="flex-1">
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Alasan / Catatan</label>
                            <input
                              type="text"
                              placeholder="Contoh: Event Khusus Hackathon / Maintenance Gedung"
                              value={newOverrideReason}
                              onChange={(e) => setNewOverrideReason(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                            />
                          </div>
                          <Button
                            type="button"
                            onClick={handleAddHolidayOverride}
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 px-3 rounded-lg text-xs shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            <span>Tambah</span>
                          </Button>
                        </div>
                      </div>

                      {/* Tabel Active Overrides */}
                      {cwOverrides.length > 0 && (
                        <div className="border border-slate-200 rounded-lg overflow-hidden mt-2">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase border-b border-slate-200">
                              <tr>
                                <th className="p-2.5 font-bold">Tanggal</th>
                                <th className="p-2.5 font-bold">Status Override</th>
                                <th className="p-2.5 font-bold">Keterangan / Alasan</th>
                                <th className="p-2.5 font-bold text-right">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {cwOverrides.map((ov) => (
                                <tr key={ov.date} className="hover:bg-slate-50/50">
                                  <td className="p-2.5 font-mono font-bold text-slate-800">{ov.date}</td>
                                  <td className="p-2.5">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        (ov.isOpen ?? ov.type === "OPEN")
                                          ? "bg-emerald-100 text-emerald-800"
                                          : "bg-rose-100 text-rose-800"
                                      }`}
                                    >
                                      {(ov.isOpen ?? ov.type === "OPEN") ? "BUKA KHUSUS" : "TUTUP KHUSUS"}
                                    </span>
                                  </td>
                                  <td className="p-2.5 text-slate-600">{ov.reason || "-"}</td>
                                  <td className="p-2.5 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveHolidayOverride(ov.date)}
                                      className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded"
                                      title="Hapus Override"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Save Bar */}
                <div className="flex items-center justify-end pt-4 border-t border-slate-200">
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-brand-orange hover:bg-orange-600 text-white font-bold px-5 space-x-1.5 shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    <span>Simpan Pengaturan Platform</span>
                  </Button>
                </div>
              </form>
            )}

            {/* TAB 7: MANAJEMEN LANGGANAN & ADD-ON PLATFORM */}
            {selectedMasterTab === "Paket Langganan & Add-on" && (
              <div className="p-4 sm:p-6 space-y-6">
                {/* Header Info Banner with Quick Tier Switcher */}
                <div className="p-4 bg-gradient-to-r from-purple-50/80 to-indigo-50/50 dark:from-slate-850 dark:to-slate-800 border border-purple-200/80 dark:border-slate-700 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
                  <div className="flex items-start space-x-3.5">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0 border border-purple-200 dark:border-purple-800/60 mt-0.5">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          Manajemen Langganan Organisasi DagoEng
                        </h3>
                        <ProFeatureBadge label="SUBSCRIPTION SAAS" variant="pro" size="xs" />
                        <span className="text-[10px] bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded-md font-semibold border border-purple-200 dark:border-purple-800/50">
                          Scope: {isSuperAdmin ? "PLATFORM SUPER ADMIN" : "ORGANISASI (DAGO HUB)"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-2xl leading-relaxed">
                        Pusat pemantauan paket lisensi platform, kuota cabang fisik, kapasitas tenant kuliner, dan pengelolaan modul komersial terintegrasi.
                      </p>
                    </div>
                  </div>

                  {/* Quick Tier Switcher */}
                  <div className="flex items-center space-x-1.5 bg-white/90 dark:bg-slate-800 p-1.5 rounded-xl border border-purple-200/80 dark:border-slate-700 shadow-2xs self-start sm:self-center shrink-0">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 px-1.5 uppercase">Pilihan Paket:</span>
                    {(["STARTER", "PROFESSIONAL", "ENTERPRISE"] as PlanTier[]).map((tier) => {
                      const isCurrent = orgSub.planTier === tier;
                      return (
                        <button
                          key={tier}
                          type="button"
                          onClick={() => {
                            setSimulatedOrgPlan(tier);
                            showMasterToast(`Paket tier organisasi berhasil diubah ke: ${PLATFORM_PLANS[tier].name}`);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                            isCurrent
                              ? "bg-purple-600 text-white shadow-2xs"
                              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                          }`}
                        >
                          {tier === "STARTER" ? "Starter" : tier === "PROFESSIONAL" ? "Pro (Default)" : "Enterprise"}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* HERO CARD: PAKET ANDA SAAT INI */}
                <Card className="border-2 border-purple-300/80 dark:border-slate-700 rounded-2xl overflow-hidden shadow-xs bg-gradient-to-b from-white to-purple-50/20 dark:from-slate-900 dark:to-slate-900">
                  <CardHeader className="p-4 sm:p-5 bg-purple-50/50 dark:bg-slate-800/60 border-b border-purple-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">Paket Anda Saat Ini:</span>
                        <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-base">{orgSub.planName}</h4>
                        <ProFeatureBadge
                          label={orgSub.planTier}
                          variant={orgSub.planTier === "ENTERPRISE" ? "enterprise" : "pro"}
                          size="sm"
                        />
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                        {PLATFORM_PLANS[orgSub.planTier].tagline}. Siklus Penagihan: <strong>{orgSub.billingCycle}</strong> — {PLATFORM_PLANS[orgSub.planTier].monthlyPriceDisplay}.
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="text-xs font-bold px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 rounded-full flex items-center space-x-1.5 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Status: {orgSub.statusLabel}</span>
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 sm:p-5 space-y-5">
                    {/* Key Subscription Meta */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 shadow-2xs text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Organisasi</span>
                        <p className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">{orgSub.organizationName}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mulai Berlangganan</span>
                        <p className="font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{orgSub.activeSince}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Jadwal Perpanjangan</span>
                        <p className="font-semibold text-purple-700 dark:text-purple-400 mt-0.5">{orgSub.nextRenewalDate}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Modul Terpasang</span>
                        <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                          {PLATFORM_PLANS[orgSub.planTier].includedModules.join(" + ")}
                        </p>
                      </div>
                    </div>

                    {/* Real-time Usage vs Quotas Grid */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Kapasitas & Kuota Terpakai (Real-time vs Batas Paket)
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">Berdasarkan data operasional workspace</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                        {/* 1. Outlets Quota */}
                        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 space-y-2 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Outlet Cabang Fisik
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50">
                              Hub Level
                            </span>
                          </div>
                          <div className="flex items-baseline space-x-1">
                            <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{outlets.length}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              / {PLATFORM_PLANS[orgSub.planTier].maxOutlets === "UNLIMITED" ? "Unlimited" : `${PLATFORM_PLANS[orgSub.planTier].maxOutlets} Cabang`}
                            </span>
                          </div>
                          {/* Progress Bar */}
                          <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                typeof PLATFORM_PLANS[orgSub.planTier].maxOutlets === "number" && outlets.length >= (PLATFORM_PLANS[orgSub.planTier].maxOutlets as number)
                                  ? "bg-amber-500"
                                  : "bg-purple-600"
                              }`}
                              style={{
                                width:
                                  PLATFORM_PLANS[orgSub.planTier].maxOutlets === "UNLIMITED"
                                    ? "40%"
                                    : `${Math.min(100, (outlets.length / (PLATFORM_PLANS[orgSub.planTier].maxOutlets as number)) * 100)}%`,
                              }}
                            />
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                            Singaraja, Denpasar, Renon
                          </p>
                        </div>

                        {/* 2. Tenants Quota */}
                        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 space-y-2 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Tenant / Mitra Kuliner
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 dark:bg-primary/20 dark:text-primary-light">
                              Booth Level
                            </span>
                          </div>
                          <div className="flex items-baseline space-x-1">
                            <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{localTenants.length}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              / {PLATFORM_PLANS[orgSub.planTier].maxTenants === "UNLIMITED" ? "Unlimited" : `${PLATFORM_PLANS[orgSub.planTier].maxTenants} Mitra`}
                            </span>
                          </div>
                          {/* Progress Bar */}
                          <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                typeof PLATFORM_PLANS[orgSub.planTier].maxTenants === "number" && localTenants.length >= (PLATFORM_PLANS[orgSub.planTier].maxTenants as number)
                                  ? "bg-rose-500"
                                  : "bg-emerald-600"
                              }`}
                              style={{
                                width:
                                  PLATFORM_PLANS[orgSub.planTier].maxTenants === "UNLIMITED"
                                    ? "35%"
                                    : `${Math.min(100, (localTenants.length / (PLATFORM_PLANS[orgSub.planTier].maxTenants as number)) * 100)}%`,
                              }}
                            />
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                            Kopi Senja, Dapur Mama, Manis Bakery, Bu Narti
                          </p>
                        </div>

                        {/* 3. Staff Accounts */}
                        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 space-y-2 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Akun Staf & Karyawan
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                              Akses POS/KDS
                            </span>
                          </div>
                          <div className="flex items-baseline space-x-1">
                            <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">7</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              / {PLATFORM_PLANS[orgSub.planTier].maxStaff === "UNLIMITED" ? "Unlimited" : `${PLATFORM_PLANS[orgSub.planTier].maxStaff} Staf`}
                            </span>
                          </div>
                          {/* Progress Bar */}
                          <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full"
                              style={{
                                width:
                                  PLATFORM_PLANS[orgSub.planTier].maxStaff === "UNLIMITED"
                                    ? "25%"
                                    : `${Math.min(100, (7 / (PLATFORM_PLANS[orgSub.planTier].maxStaff as number)) * 100)}%`,
                              }}
                            />
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                            Kasir, Barista, Waiter, Kitchen, Inventory
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Architecture Scope Notice */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/90 dark:border-slate-700 rounded-xl flex items-start space-x-2.5 text-xs text-slate-600 dark:text-slate-300">
                      <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="font-bold text-[11px] text-slate-900 dark:text-slate-100">Pemisahan Arsitektur Kuota SaaS:</p>
                        <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                          Kuota outlet fisik organisasi merepresentasikan gedung cabang hub fisik (Singaraja, Denpasar, Renon). Sementara jumlah tenant mitra kuliner merepresentasikan booth/gerai mandiri yang menyewa lot di dalam cabang tersebut. Keduanya tidak saling tumpang tindih.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* KOMPARASI 3 PAKET UTAMA PLATFORM */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">Perbandingan 3 Paket Utama Platform SaaS</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Evaluasi spesifikasi batas kuota, modul bisnis, dan kemampuan platform pada setiap tier.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(["STARTER", "PROFESSIONAL", "ENTERPRISE"] as PlanTier[]).map((tierKey) => {
                      const plan = PLATFORM_PLANS[tierKey];
                      const isCurrentPlan = orgSub.planTier === tierKey;

                      return (
                        <div
                          key={plan.id}
                          className={`p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border transition-all shadow-2xs flex flex-col justify-between space-y-4 ${
                            isCurrentPlan
                              ? "border-2 border-purple-500 ring-2 ring-purple-100 dark:ring-purple-950 bg-purple-50/10 dark:bg-purple-950/20"
                              : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                          }`}
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                {tierKey === "STARTER" ? "Tier 1 — Single" : tierKey === "PROFESSIONAL" ? "Tier 2 — Hybrid Hub" : "Tier 3 — Chain"}
                              </span>
                              {isCurrentPlan ? (
                                <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800 shadow-2xs">
                                  PAKET AKTIF
                                </span>
                              ) : (
                                <ProFeatureBadge
                                  label={tierKey}
                                  variant={tierKey === "ENTERPRISE" ? "enterprise" : tierKey === "PROFESSIONAL" ? "pro" : "addon"}
                                  size="xs"
                                />
                              )}
                            </div>

                            <div>
                              <h5 className="font-extrabold text-base text-slate-900 dark:text-slate-100">{plan.name}</h5>
                              <p className="text-xs text-purple-700 dark:text-purple-400 font-bold mt-0.5">{plan.monthlyPriceDisplay}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{plan.tagline}</p>
                            </div>

                            {/* Quota Specs */}
                            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 rounded-xl space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-slate-400 text-[11px]">Batas Outlet:</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {plan.maxOutlets === "UNLIMITED" ? "Unlimited" : `${plan.maxOutlets} Cabang`}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-slate-400 text-[11px]">Batas Mitra:</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {plan.maxTenants === "UNLIMITED" ? "Unlimited" : `${plan.maxTenants} Tenant`}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-slate-400 text-[11px]">Batas Staf:</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {plan.maxStaff === "UNLIMITED" ? "Unlimited" : `${plan.maxStaff} Staf`}
                                </span>
                              </div>
                            </div>

                            {/* Features Checklist */}
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">Fitur & Modul Utama:</span>
                              {plan.features.slice(0, 5).map((f, i) => (
                                <div key={i} className="flex items-start space-x-2">
                                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                  <span className="leading-tight">{f}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-medium">
                              Rekomendasi: {plan.recommendedFor}
                            </span>

                            {isCurrentPlan ? (
                              <div className="w-full py-2 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold text-xs rounded-xl text-center border border-purple-200 dark:border-purple-800/60">
                                Sedang Digunakan (Workspace Saat Ini)
                              </div>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSimulatedOrgPlan(tierKey);
                                  showMasterToast(`Berhasil beralih ke paket ${plan.name}!`);
                                }}
                                className="w-full text-xs font-bold border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-xl"
                              >
                                Pilih & Terapkan Paket Ini
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* KATALOG ADD-ON TINGKAT GERAI & HUB */}
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">Katalog Fitur Add-on Fungsional</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Modul nilai tambah operasional yang aktif langsung di seluruh workspace hub atau gerai mitra.
                      </p>
                    </div>

                    <span className="text-xs px-3 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-full self-start sm:self-center">
                      {tenantAddons.filter((a) => a.status === "ACTIVE").length} dari {tenantAddons.length} Add-on Aktif
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tenantAddons.map((addon) => {
                      const isActive = addon.status === "ACTIVE";
                      const iconComponent =
                        addon.code === "KDS_MULTI_STATION" ? (
                          <UtensilsCrossed className="w-4 h-4 text-primary" />
                        ) : addon.code === "ADVANCED_BOM_COGS" ? (
                          <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : addon.code === "WHATSAPP_AUTO_DISPATCH" ? (
                          <Zap className="w-4 h-4 text-primary" />
                        ) : (
                          <Tag className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                        );

                      return (
                        <div
                          key={addon.id}
                          className={`p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border transition-all shadow-2xs flex flex-col justify-between space-y-4 ${
                            isActive
                              ? "border-purple-200/90 dark:border-purple-800 ring-1 ring-purple-100 dark:ring-purple-950"
                              : "border-slate-200/80 dark:border-slate-800 opacity-90"
                          }`}
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center space-x-2.5">
                                <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center shrink-0">
                                  {iconComponent}
                                </div>
                                <div>
                                  <div className="flex items-center space-x-1.5 flex-wrap">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                      {addon.categoryTag}
                                    </span>
                                    <ProFeatureBadge label={addon.badgeLabel} variant={addon.badgeVariant} size="xs" />
                                  </div>
                                  <h5 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-snug">{addon.name}</h5>
                                </div>
                              </div>

                              <div className="shrink-0 text-right">
                                {isActive ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                                    Aktif
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                    Belum Aktif
                                  </span>
                                )}
                                <span className="block text-[10px] text-slate-400 font-medium mt-0.5">
                                  {addon.monthlyPriceDisplay}
                                </span>
                              </div>
                            </div>

                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{addon.description}</p>

                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">Manfaat Operasional:</span>
                              {addon.benefits.map((benefit, idx) => (
                                <div key={idx} className="flex items-start space-x-2 text-xs text-slate-600 dark:text-slate-300">
                                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                  <span className="leading-tight">{benefit}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setPreviewModalFeature({
                                  title: addon.name,
                                  badgeLabel: addon.badgeLabel,
                                  badgeVariant: addon.badgeVariant,
                                  categoryTag: addon.categoryTag,
                                  description: addon.description,
                                  benefits: addon.benefits,
                                  samplePlanName: "Katalog Add-on F&B",
                                  statusText: isActive ? "Aktif di Workspace" : "Tersedia untuk Diaktifkan",
                                })
                              }
                              className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-semibold px-2.5 h-8"
                            >
                              Pelajari Fitur
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                toggleSimulatedTenantAddon(addon.id, "org-dago-hub");
                                if (isActive) {
                                  showMasterToast(`Add-on "${addon.name}" dinonaktifkan.`);
                                } else {
                                  showMasterToast(`Add-on "${addon.name}" berhasil diaktifkan!`);
                                }
                              }}
                              className={`text-xs font-bold px-3.5 h-8 rounded-xl shadow-2xs transition-all ${
                                isActive
                                  ? "bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300"
                                  : "bg-purple-600 hover:bg-purple-700 text-white"
                              }`}
                            >
                              {isActive ? "Nonaktifkan Add-on" : "Aktifkan Add-on"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ROLE SUPER ADMIN OVERSIGHT SECTION */}
                {isSuperAdmin && (
                  <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-4 shadow-sm border border-slate-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                      <div>
                        <div className="flex items-center space-x-2">
                          <Crown className="w-5 h-5 text-amber-400" />
                          <h4 className="font-extrabold text-sm text-white">
                            Platform SaaS Administration & Multi-Tenant Oversight
                          </h4>
                          <span className="text-[10px] bg-amber-400/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-full font-bold">
                            SUPER ADMIN ONLY
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Kontrol tingkat platform untuk memantau lisensi seluruh organisasi dan konfigurasi tier komersial global.
                        </p>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        onClick={() => showMasterToast("Sinkronisasi lisensi seluruh hub berhasil diperbarui.")}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs shrink-0"
                      >
                        Sinkronisasi Seluruh Hub
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Organisasi Hub</span>
                        <p className="text-lg font-extrabold text-white mt-1">2 <span className="text-xs text-slate-400 font-normal">Hub</span></p>
                        <p className="text-[10px] text-emerald-400 mt-0.5">Dago Hub, Bandung Hub</p>
                      </div>

                      <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Distribusi Lisensi</span>
                        <p className="text-lg font-extrabold text-purple-300 mt-1">1 Pro / 1 Starter</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Lisensi multi-tier aktif</p>
                      </div>

                      <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Tenant Mitra</span>
                        <p className="text-lg font-extrabold text-emerald-300 mt-1">7 <span className="text-xs text-slate-400 font-normal">Mitra Booth</span></p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Across all registered hubs</p>
                      </div>

                      <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Terminal POS Kasir</span>
                        <p className="text-lg font-extrabold text-blue-300 mt-1">8 <span className="text-xs text-slate-400 font-normal">Terminal</span></p>
                        <p className="text-[10px] text-emerald-400 mt-0.5">Semua aktif online</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 8: MANAJEMEN WI-FI TERPADU */}
            {(isOrgOwner || isSuperAdmin) && selectedMasterTab === "Manajemen Wi-Fi" && (
              <div className="p-4 sm:p-6 space-y-8">
                {/* 1. RINGKASAN & STATUS INTEGRASI */}
                <div className="space-y-4">
                  <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-slate-50 dark:from-slate-850 dark:via-slate-800 dark:to-slate-850 border border-blue-200/80 dark:border-slate-700 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
                    <div className="flex items-start space-x-3.5">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-800/60 mt-0.5">
                        <Wifi className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                            Manajemen Wi-Fi Captive Portal DagoEng
                          </h3>
                          <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 px-2 py-0.5 rounded-md font-semibold">
                            GATEWAY AKTIF
                          </span>
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md font-semibold">
                            STATUS: SIAP INTEGRASI
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                          Pusat konfigurasi aturan voucher internet tamu F&B dan Co-working Space. Mengatur ambang transaksi, durasi kupon, bandwidth speed tier, dan monitoring voucher aktif secara real-time.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs text-right">
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Mode Jaringan</span>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1 justify-end">
                          <Signal className="w-3 h-3 text-emerald-500" />
                          <span>Sistem Terintegrasi</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Metrik Ringkasan Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Status Router</span>
                        <Router className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <p className="text-sm font-extrabold text-slate-700 dark:text-slate-200">SIAP INTEGRASI</p>
                      <p className="text-[10px] text-slate-400">RouterOS / UniFi Gateway</p>
                    </div>

                    <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Voucher Diterbitkan</span>
                        <Receipt className="w-3.5 h-3.5 text-sky-500" />
                      </div>
                      <p className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                        {wifiVouchers.length} <span className="text-xs font-normal text-slate-400">Voucher</span>
                      </p>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                        {wifiVouchers.filter((v) => v.status === "ACTIVE").length} Aktif Berlaku
                      </p>
                    </div>

                    <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Aturan F&B</span>
                        <Coffee className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <p className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                        {wifiFnBRules.filter((r) => r.isActive).length} <span className="text-xs font-normal text-slate-400">Aktif</span>
                      </p>
                      <p className="text-[10px] text-slate-400">Berbasis nominal struk</p>
                    </div>

                    <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Paket Co-working</span>
                        <Laptop className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                      </div>
                      <p className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                        {wifiCwRules.filter((r) => r.isActive).length} <span className="text-xs font-normal text-slate-400">Paket</span>
                      </p>
                      <p className="text-[10px] text-slate-400">Aktif saat tamu check-in</p>
                    </div>
                  </div>
                </div>

                {/* 2. ATURAN WI-FI F&B */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                          <Coffee className="w-4 h-4 text-brand-orange" />
                          <span>Aturan Wi-Fi F&B (Berbasis Transaksi Struk POS)</span>
                        </h4>
                        <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                          ATURAN AKTIF
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Aturan penerbitan voucher otomatis pada struk kasir berdasarkan nominal belanja pelanggan.
                      </p>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      onClick={handleOpenAddWifiRule}
                      className="bg-brand-orange hover:bg-orange-600 text-white font-bold text-xs space-x-1.5 rounded-xl shadow-xs self-start sm:self-auto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Aturan F&B</span>
                    </Button>
                  </div>

                  {/* Pengaturan Basis Perhitungan Nominal */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center space-x-2">
                        <Sliders className="w-4 h-4 text-slate-600" />
                        <span className="text-xs font-bold text-slate-800">Basis Perhitungan Nominal Transaksi</span>
                        <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                          Basis Aktif
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setWifiCalcBasis("GRAND_TOTAL");
                            setSimulatedWifiCalcBasis("GRAND_TOTAL");
                            showMasterToast("Basis kalkulasi diatur ke Grand Total Pembayaran.");
                          }}
                          className={`px-3 py-1 text-xs rounded-lg font-semibold transition-all ${
                            wifiCalcBasis === "GRAND_TOTAL"
                              ? "bg-slate-900 text-white shadow-2xs"
                              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          Grand Total (Final Bayar)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setWifiCalcBasis("NET_SALES");
                            setSimulatedWifiCalcBasis("NET_SALES");
                            showMasterToast("Basis kalkulasi diatur ke Net Sales (Subtotal Produk).");
                          }}
                          className={`px-3 py-1 text-xs rounded-lg font-semibold transition-all ${
                            wifiCalcBasis === "NET_SALES"
                              ? "bg-slate-900 text-white shadow-2xs"
                              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          Net Sales (Subtotal Produk)
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Catatan Kebijakan: Penentuan batas minimum Wi-Fi dapat dihitung dari Grand Total akhir transaksi (setelah diskon, pajak, & biaya layanan) atau dari Net Sales (subtotal produk saja).
                    </p>
                  </div>

                  {/* Tabel Aturan F&B */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-4">Label Aturan</th>
                          <th className="py-2.5 px-4">Rentang Nominal Transaksi</th>
                          <th className="py-2.5 px-4">Durasi Akses</th>
                          <th className="py-2.5 px-4">Batas Bandwidth</th>
                          <th className="py-2.5 px-4 text-center">Status</th>
                          <th className="py-2.5 px-4 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {wifiFnBRules.map((rule) => {
                          const rangeFormatted = `${formatCurrencyIDR(rule.minTransactionAmount)} — ${
                            rule.maxTransactionAmount ? formatCurrencyIDR(rule.maxTransactionAmount) : "Tanpa Batas Atas"
                          }`;

                          return (
                            <tr key={rule.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-3 px-4">
                                <span className="font-bold text-slate-900 block">{rule.label}</span>
                                {rule.notes && <span className="text-[10px] text-slate-400">{rule.notes}</span>}
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-800">
                                {rangeFormatted}
                              </td>
                              <td className="py-3 px-4 text-slate-700">
                                <span className="font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                                  {rule.durationMinutes >= 60
                                    ? `${rule.durationMinutes / 60} Jam`
                                    : `${rule.durationMinutes} Menit`}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-600">
                                {rule.bandwidthLimitDownMbps ? (
                                  <span>{rule.bandwidthLimitDownMbps}M / {rule.bandwidthLimitUpMbps || 5}M</span>
                                ) : (
                                  <span className="text-slate-400 italic">Bawaan Gateway</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleWifiRuleStatus(rule.id)}
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                                    rule.isActive
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                      : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200"
                                  }`}
                                >
                                  {rule.isActive ? "Aktif" : "Nonaktif"}
                                </button>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center space-x-1.5">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenEditWifiRule(rule)}
                                    className="text-[10px] h-7 px-2 border-slate-200 text-slate-600 hover:text-slate-900"
                                  >
                                    <Edit2 className="w-3 h-3 mr-1" />
                                    <span>Edit</span>
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDeleteWifiRule(rule.id)}
                                    className="text-[10px] h-7 px-2 border-rose-200 text-rose-600 hover:bg-rose-50"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3. ATURAN WI-FI CO-WORKING */}
                <div className="space-y-4">
                  <div className="pb-2 border-b border-slate-200">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                        <Laptop className="w-4 h-4 text-indigo-600" />
                        <span>Aturan Wi-Fi Co-working (Terkait Booking & Check-In)</span>
                      </h4>
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-bold">
                        OTORISASI SAAT CHECK-IN
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Penerbitan voucher internet terikat pada status reservasi ruang kerja. Logika masa aktif dipisahkan secara ketat agar reservasi terjadwal tidak kedaluwarsa sebelum tamu tiba.
                    </p>
                  </div>

                  {/* Informational Box Alur Aktivasi Co-working */}
                  <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-1.5 text-xs text-indigo-950">
                    <p className="font-bold text-indigo-900 flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Alur Waktu & Siklus Hidup Voucher Co-working:</span>
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-indigo-900/90 pt-1">
                      <div className="p-2 bg-white/70 rounded-lg border border-indigo-100">
                        <span className="font-bold block text-indigo-950">1. Penerbitan Voucher</span>
                        Dibuat saat reservasi terkonfirmasi atau saat tamu tiba di resepsionis.
                      </div>
                      <div className="p-2 bg-white/70 rounded-lg border border-indigo-100">
                        <span className="font-bold block text-indigo-950">2. Awal Masa Aktif</span>
                        Timer durasi <strong>hanya mulai dihitung saat check-in resmi</strong> tamu divalidasi.
                      </div>
                      <div className="p-2 bg-white/70 rounded-lg border border-indigo-100">
                        <span className="font-bold block text-indigo-950">3. Kedaluwarsa & Toleransi</span>
                        Berakhir setelah durasi sewa + grace period (15–30 menit) setelah check-in.
                      </div>
                    </div>
                  </div>

                  {/* Tabel Aturan Co-working */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-4">Paket / Ruang</th>
                          <th className="py-2.5 px-4">Tipe Booking</th>
                          <th className="py-2.5 px-4">Mode Durasi</th>
                          <th className="py-2.5 px-4">Toleransi Ekstra</th>
                          <th className="py-2.5 px-4">Kuota Perangkat</th>
                          <th className="py-2.5 px-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {wifiCwRules.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3 px-4 font-bold text-slate-900">
                              <span>{r.label}</span>
                              <span className="block text-[10px] text-slate-400">{r.spaceType}</span>
                            </td>
                            <td className="py-3 px-4 text-slate-700">
                              <span className="font-semibold">{r.bookingType}</span>
                            </td>
                            <td className="py-3 px-4 text-slate-700">
                              <span className="font-medium text-slate-800">
                                {r.durationMode === "FOLLOW_BOOKING"
                                  ? "Sesuai Durasi Jam Booking"
                                  : r.durationMode === "FULL_DAY_UNTIL_CLOSING"
                                  ? "Seharian s/d Jam Tutup (18:00)"
                                  : "Akses Tetap 30 Hari"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              +{r.gracePeriodMinutes} Menit Grace Period
                            </td>
                            <td className="py-3 px-4 text-slate-700">
                              <span className="font-bold text-slate-800">{r.maxConcurrentDevices} Perangkat</span>
                              {r.maxConcurrentDevices > 1 && (
                                <span className="block text-[10px] text-indigo-600 font-medium">Multi-Device Member</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Aktif
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. RIWAYAT VOUCHER TERPADU */}
                <div className="space-y-4">
                  <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                        <Receipt className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                        <span>Riwayat Voucher Wi-Fi Terpadu</span>
                      </h4>
                      <span className="text-[10px] bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50 px-2 py-0.5 rounded font-bold">
                        STABIL & BEBAS DUPLIKASI
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Voucher diikat stabil ke nomor transaksi POS atau booking Co-working. Cetak ulang struk kasir selalu menampilkan kode voucher yang sama tanpa menerbitkan voucher ganda.
                    </p>
                  </div>

                  {/* Filter Bar */}
                  <div className="p-3 bg-slate-50/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
                      <div className="relative flex-1 min-w-[200px]">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={wifiSearchQuery}
                          onChange={(e) => setWifiSearchQuery(e.target.value)}
                          placeholder="Cari kode voucher, no struk, booking ID, atau nama..."
                          className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      <select
                        value={wifiServiceFilter}
                        onChange={(e) => setWifiServiceFilter(e.target.value as any)}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="ALL">Semua Layanan (F&B & CW)</option>
                        <option value="FNB">Hanya F&B Kasir</option>
                        <option value="COWORKING">Hanya Co-working</option>
                      </select>

                      <select
                        value={wifiStatusFilter}
                        onChange={(e) => setWifiStatusFilter(e.target.value as any)}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="ALL">Semua Status</option>
                        <option value="ACTIVE">Aktif</option>
                        <option value="USED">Terpakai</option>
                        <option value="EXPIRED">Kedaluwarsa</option>
                        <option value="CANCELLED">Dibatalkan</option>
                      </select>
                    </div>

                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Total <strong>{wifiVouchers.length}</strong> voucher aktif tersimpan
                    </span>
                  </div>

                  {/* Table Riwayat */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                            <th className="py-2.5 px-4">Kode Voucher</th>
                            <th className="py-2.5 px-4">Layanan & Referensi</th>
                            <th className="py-2.5 px-4">Pelanggan / Tamu</th>
                            <th className="py-2.5 px-4">Durasi & Kuota</th>
                            <th className="py-2.5 px-4">Waktu Terbit</th>
                            <th className="py-2.5 px-4">Kedaluwarsa</th>
                            <th className="py-2.5 px-4">Status</th>
                            <th className="py-2.5 px-4 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                          {(() => {
                            const filtered = wifiVouchers.filter((v) => {
                              if (wifiServiceFilter !== "ALL" && v.serviceType !== wifiServiceFilter) return false;
                              if (wifiStatusFilter !== "ALL" && v.status !== wifiStatusFilter) return false;
                              if (wifiSearchQuery.trim()) {
                                const q = wifiSearchQuery.toLowerCase();
                                const matchCode = v.voucherCode.toLowerCase().includes(q);
                                const matchRef = v.referenceLabel.toLowerCase().includes(q) || v.referenceId.toLowerCase().includes(q);
                                const matchName = v.customerName.toLowerCase().includes(q);
                                if (!matchCode && !matchRef && !matchName) return false;
                              }
                              return true;
                            });

                            if (filtered.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                                    Tidak ada data voucher yang sesuai dengan filter pencarian.
                                  </td>
                                </tr>
                              );
                            }

                            return filtered.map((v) => (
                              <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="py-3 px-4 font-mono font-bold text-slate-800 flex items-center space-x-1.5">
                                  <span>{v.voucherCode}</span>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    AKTIF
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-700">
                                  <span className="font-semibold text-slate-900 block">{v.referenceLabel}</span>
                                  <span className="text-[10px] text-slate-400">
                                    {v.serviceType === "FNB" ? `Tenant: ${v.tenantName || "Kopi Senja"}` : "Co-working Reservation"}
                                    {v.transactionAmount && ` • ${formatCurrencyIDR(v.transactionAmount)}`}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-700">
                                  <span>{v.customerName}</span>
                                  {v.customerPhone && <span className="block text-[10px] text-slate-400">{v.customerPhone}</span>}
                                </td>
                                <td className="py-3 px-4 text-slate-700">
                                  <span className="font-bold text-slate-800">{v.durationFormatted}</span>
                                  <span className="block text-[10px] text-slate-400">Maks. {v.maxDevices} Device</span>
                                </td>
                                <td className="py-3 px-4 text-slate-500 text-[11px]">
                                  {new Date(v.issuedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })},{" "}
                                  {new Date(v.issuedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                                </td>
                                <td className="py-3 px-4 text-slate-500 text-[11px]">
                                  {new Date(v.expiresAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })},{" "}
                                  {new Date(v.expiresAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      v.status === "ACTIVE"
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        : v.status === "USED"
                                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                                        : v.status === "EXPIRED"
                                        ? "bg-slate-100 text-slate-600 border border-slate-200"
                                        : "bg-rose-50 text-rose-700 border border-rose-200"
                                    }`}
                                  >
                                    {v.status === "ACTIVE"
                                      ? "Aktif"
                                      : v.status === "USED"
                                      ? "Terpakai"
                                      : v.status === "EXPIRED"
                                      ? "Kedaluwarsa"
                                      : "Dibatalkan"}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <div className="flex items-center justify-center space-x-1.5">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        navigator.clipboard?.writeText(v.voucherCode);
                                        showMasterToast(`Kode voucher "${v.voucherCode}" berhasil disalin.`);
                                      }}
                                      className="text-[10px] h-7 px-2 rounded-lg border-slate-200 text-slate-600 hover:text-slate-900"
                                    >
                                      Salin
                                    </Button>
                                    {v.status === "ACTIVE" && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleRevokeVoucher(v.id)}
                                        className="text-[10px] h-7 px-2 rounded-lg border-rose-200 text-rose-600 hover:bg-rose-50"
                                      >
                                        Batal
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* 5. INTEGRASI ROUTER & GATEWAY (INFORMASIONAL) */}
                <div className="space-y-4">
                  <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                        <Server className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                        <span>Integrasi Router & Gateway (Informasional)</span>
                      </h4>
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded font-bold">
                        STATUS: BELUM TERHUBUNG
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Rencana kesiapan teknis penyambungan captive portal DagoEng ke perangkat keras jaringan.
                    </p>
                  </div>

                  {/* Warning Security Banner */}
                  <div className="p-4 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl flex items-start space-x-3 text-xs text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold text-amber-950 dark:text-amber-100">Prinsip Keamanan Kredensial Jaringan</p>
                      <p className="text-amber-800 dark:text-amber-300 leading-relaxed text-[11px]">
                        Sesuai standar keamanan sistem web, password router API, secret token captive portal, dan kredensial RADIUS <strong>tidak disimpan di frontend browser maupun di localStorage</strong>. Integrasi lapangan nantinya akan dijalankan melalui server backend aman / network daemon terisolasi.
                      </p>
                    </div>
                  </div>

                  {/* Kartu Status Hardware & Kebutuhan Integrasi */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center space-x-2">
                          <Router className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                          <span>Status Gateway Outlet</span>
                        </span>
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded font-bold">
                          BELUM TERHUBUNG
                        </span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/60">
                          <span className="text-slate-400">Outlet Fisik</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{wifiNetworkConfig.outletName}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/60">
                          <span className="text-slate-400">SSID Tamu (Target)</span>
                          <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{wifiNetworkConfig.ssidName}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/60">
                          <span className="text-slate-400">Driver Adapter Siap</span>
                          <span className="font-semibold text-indigo-700 dark:text-indigo-400">MikroTik RouterOS API / UniFi</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-400">Captive Portal Landing</span>
                          <span className="font-mono text-[11px] text-sky-600 dark:text-sky-400 underline">{wifiNetworkConfig.captivePortalUrl}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center space-x-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>Checklist Implementasi Lapangan</span>
                        </span>
                        <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold">
                          Tahap Berikutnya
                        </span>
                      </div>
                      <ul className="space-y-2 text-xs text-slate-600">
                        <li className="flex items-start space-x-2">
                          <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
                          <span>Penetapan subnet IP & VLAN khusus tamu (isolasi dari traffic internal POS & kasir).</span>
                        </li>
                        <li className="flex items-start space-x-2">
                          <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center shrink-0 text-[10px]">2</span>
                          <span>Pemasangan controller router hardware di rack server Dago Hub Singaraja.</span>
                        </li>
                        <li className="flex items-start space-x-2">
                          <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center shrink-0 text-[10px]">3</span>
                          <span>Konfigurasi webhook sync voucher POS ke router captive portal via backend daemon.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* COMMON MASTER DATA MODALS */}

          {/* MODAL: TAMBAH / EDIT ATURAN WI-FI F&B */}
          {isWifiRuleModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in zoom-in-95">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
                  <div>
                    <h3 className="font-bold text-sm">
                      {editingWifiRule ? "Edit Aturan Wi-Fi F&B" : "Tambah Aturan Wi-Fi F&B Baru"}
                    </h3>
                    <span className="text-[10px] text-amber-300 font-semibold block">PENGATURAN VOUCHER OTOMATIS</span>
                  </div>
                  <button onClick={() => setIsWifiRuleModalOpen(false)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveWifiRule} className="p-6 space-y-4 text-xs">
                  {wifiRuleFormError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-bold flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{wifiRuleFormError}</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Nama Label Aturan *</label>
                    <input
                      type="text"
                      required
                      value={wifiRuleFormLabel}
                      onChange={(e) => setWifiRuleFormLabel(e.target.value)}
                      placeholder="Contoh: F&B Standar (1 Jam)"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Min. Transaksi (Rp) *</label>
                      <input
                        type="number"
                        required
                        min={0}
                        step={5000}
                        value={wifiRuleFormMin}
                        onChange={(e) => setWifiRuleFormMin(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 font-semibold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Maks. Transaksi (Rp)</label>
                      <input
                        type="number"
                        min={0}
                        step={5000}
                        value={wifiRuleFormMax}
                        onChange={(e) => setWifiRuleFormMax(e.target.value)}
                        placeholder="Kosongkan jika tanpa batas"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Durasi Akses *</label>
                      <select
                        value={wifiRuleFormDuration}
                        onChange={(e) => setWifiRuleFormDuration(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-semibold text-slate-800"
                      >
                        <option value={30}>30 Menit</option>
                        <option value={60}>60 Menit (1 Jam)</option>
                        <option value={120}>120 Menit (2 Jam)</option>
                        <option value={180}>180 Menit (3 Jam)</option>
                        <option value={240}>240 Menit (4 Jam)</option>
                        <option value={360}>360 Menit (6 Jam)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Limit Unduh (Mbps)</label>
                      <input
                        type="number"
                        min={1}
                        value={wifiRuleFormBandwidthDown}
                        onChange={(e) => setWifiRuleFormBandwidthDown(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Limit Unggah (Mbps)</label>
                      <input
                        type="number"
                        min={1}
                        value={wifiRuleFormBandwidthUp}
                        onChange={(e) => setWifiRuleFormBandwidthUp(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Catatan Internal (Opsional)</label>
                    <textarea
                      rows={2}
                      value={wifiRuleFormNotes}
                      onChange={(e) => setWifiRuleFormNotes(e.target.value)}
                      placeholder="Keterangan aturan untuk tim operasional..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsWifiRuleModalOpen(false)}
                      className="rounded-xl"
                    >
                      Batal
                    </Button>
                    <Button
                      type="submit"
                      className="bg-brand-orange hover:bg-orange-600 text-white font-bold rounded-xl"
                    >
                      {editingWifiRule ? "Simpan Perubahan" : "Simpan Aturan"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL: TAMBAH PRODUK BARU */}
          {isAddProdModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
                  <h3 className="font-bold text-sm">Tambah Produk F&B Baru (Master Data)</h3>
                  <button onClick={() => setIsAddProdModalOpen(false)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={handleSaveNewProduct} className="p-6 space-y-3.5 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Nama Produk *</label>
                    <input
                      type="text"
                      required
                      value={formProdName}
                      onChange={(e) => setFormProdName(e.target.value)}
                      placeholder="Contoh: Kopi Aren Spesial"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-orange/20"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Mitra / Tenant *</label>
                      <select
                        value={formProdTenantId}
                        onChange={(e) => setFormProdTenantId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-semibold text-slate-800"
                      >
                        {localTenants.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Kategori *</label>
                      <select
                        value={formProdCat}
                        onChange={(e) => setFormProdCat(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-semibold text-slate-800"
                      >
                        {categories.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Harga Jual (Rp) *</label>
                      <input
                        type="number"
                        required
                        min={0}
                        step={1000}
                        value={formProdPrice}
                        onChange={(e) => setFormProdPrice(Number(e.target.value))}
                        className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Estimasi HPP (Rp)</label>
                      <input
                        type="number"
                        min={0}
                        step={500}
                        value={formProdCogs}
                        onChange={(e) => setFormProdCogs(Number(e.target.value))}
                        className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Deskripsi Menu</label>
                    <textarea
                      rows={2}
                      value={formProdDesc}
                      onChange={(e) => setFormProdDesc(e.target.value)}
                      placeholder="Keterangan singkat komposisi produk..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">Foto / Gambar Produk</label>
                    {formProdImg ? (
                      <div className="flex items-center space-x-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <img
                          src={formProdImg}
                          alt="Preview"
                          className="w-14 h-14 rounded-lg object-cover border border-slate-300 shadow-2xs"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-[11px] font-bold text-emerald-700 flex items-center space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Gambar Terpasang</span>
                          </span>
                          <p className="text-[10px] text-slate-400 truncate">Siap disimpan ke Master Data</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setFormProdImg("")}
                          className="h-7 text-xs font-bold text-rose-600 hover:bg-rose-50 border-rose-200 rounded-lg"
                        >
                          Hapus
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-slate-300 hover:border-brand-orange/60 rounded-xl cursor-pointer bg-slate-50/60 hover:bg-orange-50/30 transition-all text-center group">
                        <UploadCloud className="w-5 h-5 text-slate-400 group-hover:text-brand-orange mb-1 transition-colors" />
                        <span className="text-xs font-bold text-slate-700 group-hover:text-brand-orange">
                          Klik untuk Upload Gambar Produk
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WebP langsung dari perangkat</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageFileUpload(e, setFormProdImg)}
                        />
                      </label>
                    )}
                  </div>

                  <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                    <Button type="button" variant="outline" onClick={() => setIsAddProdModalOpen(false)} className="rounded-xl">
                      Batal
                    </Button>
                    <Button type="submit" className="bg-brand-orange hover:bg-orange-600 text-white font-bold rounded-xl">
                      Simpan Produk
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL: EDIT PRODUK */}
          {isEditProdModalOpen && editingProd && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
                  <h3 className="font-bold text-sm">Edit Produk Master: {editingProd.name}</h3>
                  <button onClick={() => setIsEditProdModalOpen(false)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={handleSaveEditProduct} className="p-6 space-y-3.5 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Nama Produk *</label>
                    <input
                      type="text"
                      required
                      value={formProdName}
                      onChange={(e) => setFormProdName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Mitra / Tenant *</label>
                      <select
                        value={formProdTenantId}
                        onChange={(e) => setFormProdTenantId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-semibold text-slate-800"
                      >
                        {localTenants.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Kategori *</label>
                      <select
                        value={formProdCat}
                        onChange={(e) => setFormProdCat(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-semibold text-slate-800"
                      >
                        {categories.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Harga Jual (Rp) *</label>
                      <input
                        type="number"
                        required
                        min={0}
                        step={1000}
                        value={formProdPrice}
                        onChange={(e) => setFormProdPrice(Number(e.target.value))}
                        className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl font-bold text-brand-orange text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Estimasi HPP (Rp)</label>
                      <input
                        type="number"
                        min={0}
                        step={500}
                        value={formProdCogs}
                        onChange={(e) => setFormProdCogs(Number(e.target.value))}
                        className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Deskripsi Menu</label>
                    <textarea
                      rows={2}
                      value={formProdDesc}
                      onChange={(e) => setFormProdDesc(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Status Produk</label>
                    <select
                      value={formProdStatus}
                      onChange={(e) => setFormProdStatus(e.target.value as "ACTIVE" | "INACTIVE")}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-semibold"
                    >
                      <option value="ACTIVE">ACTIVE (Tersedia)</option>
                      <option value="INACTIVE">INACTIVE (Non-Aktif)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">Foto / Gambar Produk</label>
                    {formProdImg ? (
                      <div className="flex items-center space-x-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <img
                          src={formProdImg}
                          alt="Preview"
                          className="w-14 h-14 rounded-lg object-cover border border-slate-300 shadow-2xs"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-[11px] font-bold text-emerald-700 flex items-center space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Gambar Terpasang</span>
                          </span>
                          <p className="text-[10px] text-slate-400 truncate">Siap disimpan ke Master Data</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setFormProdImg("")}
                          className="h-7 text-xs font-bold text-rose-600 hover:bg-rose-50 border-rose-200 rounded-lg"
                        >
                          Hapus
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-slate-300 hover:border-brand-orange/60 rounded-xl cursor-pointer bg-slate-50/60 hover:bg-orange-50/30 transition-all text-center group">
                        <UploadCloud className="w-5 h-5 text-slate-400 group-hover:text-brand-orange mb-1 transition-colors" />
                        <span className="text-xs font-bold text-slate-700 group-hover:text-brand-orange">
                          Klik untuk Upload Gambar Produk
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WebP langsung dari perangkat</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageFileUpload(e, setFormProdImg)}
                        />
                      </label>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setDeletingProd(editingProd);
                        setIsEditProdModalOpen(false);
                        setIsDeleteProdModalOpen(true);
                      }}
                      className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-rose-200 rounded-xl font-bold flex items-center space-x-1.5 h-9 px-3 text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Produk</span>
                    </Button>

                    <div className="flex items-center space-x-2">
                      <Button type="button" variant="outline" onClick={() => setIsEditProdModalOpen(false)} className="rounded-xl h-9 text-xs">
                        Batal
                      </Button>
                      <Button type="submit" className="bg-brand-orange hover:bg-orange-600 text-white font-bold rounded-xl shadow-xs h-9 text-xs">
                        Simpan Perubahan
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL: DELETE CONFIRMATION */}
          {isDeleteProdModalOpen && deletingProd && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 p-6 space-y-4 animate-in zoom-in-95">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="text-center space-y-1">
                  <h4 className="font-bold text-sm text-slate-900">Hapus Produk Master?</h4>
                  <p className="text-xs text-slate-500">
                    Apakah Anda yakin ingin menghapus <strong>"{deletingProd.name}"</strong>? Data produk ini akan dihapus dari katalog master.
                  </p>
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsDeleteProdModalOpen(false)} className="flex-1 rounded-xl">
                    Batal
                  </Button>
                  <Button type="button" onClick={handleConfirmDeleteProduct} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs">
                    Ya, Hapus
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL: TAMBAH KATEGORI */}
          {isAddCatModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 animate-in zoom-in-95">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
                  <h3 className="font-bold text-sm">Tambah Kategori Produk Baru</h3>
                  <button onClick={() => setIsAddCatModalOpen(false)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={handleSaveNewCategory} className="p-6 space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Nama Kategori Baru *</label>
                    <input
                      type="text"
                      required
                      value={formNewCatName}
                      onChange={(e) => setFormNewCatName(e.target.value)}
                      placeholder="Contoh: Aneka Jus Segar"
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-orange/20"
                    />
                  </div>
                  <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                    <Button type="button" variant="outline" onClick={() => setIsAddCatModalOpen(false)} className="rounded-xl">
                      Batal
                    </Button>
                    <Button type="submit" className="bg-brand-orange hover:bg-orange-600 text-white font-bold rounded-xl">
                      Tambah Kategori
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL: TAMBAH MITRA / TENANT */}
          {isAddTenantModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
                  <h3 className="font-bold text-sm">Tambah Mitra F&B Baru</h3>
                  <button onClick={() => setIsAddTenantModalOpen(false)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={handleSaveNewTenant} className="p-6 space-y-3.5 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Nama Mitra / Merchant *</label>
                    <input
                      type="text"
                      required
                      value={formTenantName}
                      onChange={(e) => setFormTenantName(e.target.value)}
                      placeholder="Contoh: Dago Bakery & Pastry"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Kode Merchant (Unik)</label>
                      <input
                        type="text"
                        value={formTenantCode}
                        onChange={(e) => setFormTenantCode(e.target.value)}
                        placeholder="Contoh: DAGO-BAKERY"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono uppercase"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Badge Singkat</label>
                      <input
                        type="text"
                        value={formTenantBadge}
                        onChange={(e) => setFormTenantBadge(e.target.value)}
                        placeholder="Contoh: Bakery"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-[11px] text-amber-900">
                    Mitra baru akan otomatis terdaftar dengan skema bagi hasil standar 85% Mitra / 15% DAGO.
                  </div>
                  <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                    <Button type="button" variant="outline" onClick={() => setIsAddTenantModalOpen(false)} className="rounded-xl">
                      Batal
                    </Button>
                    <Button type="submit" className="bg-brand-orange hover:bg-orange-600 text-white font-bold rounded-xl shadow-xs">
                      Tambah Mitra
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL: TAMBAH RUANG WORKSPACE */}
          {isAddSpaceModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
                  <h3 className="font-bold text-sm">Tambah Ruang Workspace / Meeting Room</h3>
                  <button onClick={() => setIsAddSpaceModalOpen(false)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={handleSaveNewSpace} className="p-6 space-y-3.5 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Nama Workspace / Ruangan *</label>
                    <input
                      type="text"
                      required
                      value={formSpaceName}
                      onChange={(e) => setFormSpaceName(e.target.value)}
                      placeholder="Contoh: Meeting Room Beta"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-700">Tipe Ruangan (Kustom / Bebas) *</label>
                        <span className="text-[10px] text-slate-400">Ketik bebas atau pilih preset</span>
                      </div>
                      <input
                        type="text"
                        required
                        value={formSpaceType}
                        onChange={(e) => setFormSpaceType(e.target.value)}
                        placeholder="Contoh: HOT_DESK, PODCAST_STUDIO, EVENT_SPACE"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold bg-white"
                      />
                      <div className="flex flex-wrap gap-1 mt-1">
                        {["HOT_DESK", "DEDICATED_DESK", "PRIVATE_OFFICE", "MEETING_ROOM", "PODCAST_STUDIO", "EVENT_SPACE"].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setFormSpaceType(preset)}
                            className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-all ${
                              formSpaceType === preset
                                ? "bg-slate-900 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-700">Area / Lantai (Kustom / Bebas) *</label>
                        <span className="text-[10px] text-slate-400">Ketik bebas atau pilih preset</span>
                      </div>
                      <input
                        type="text"
                        required
                        value={formSpaceArea}
                        onChange={(e) => setFormSpaceArea(e.target.value)}
                        placeholder="Contoh: Ground Floor Main, Rooftop Terrace"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                      />
                      <div className="flex flex-wrap gap-1 mt-1">
                        {["Ground Floor Main", "Mezzanine Quiet Zone", "VIP Meeting Wing", "Lantai 2 Mezzanine", "Rooftop Terrace"].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setFormSpaceArea(preset)}
                            className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-all ${
                              formSpaceArea === preset
                                ? "bg-slate-900 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Kapasitas</label>
                      <input
                        type="number"
                        min={1}
                        value={formSpaceCap}
                        onChange={(e) => setFormSpaceCap(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Tarif / Jam</label>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={formSpaceHourly}
                        onChange={(e) => setFormSpaceHourly(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Tarif / Hari</label>
                      <input
                        type="number"
                        min={0}
                        step={5000}
                        value={formSpaceDaily}
                        onChange={(e) => setFormSpaceDaily(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Status Awal</label>
                    <select
                      value={formSpaceStatus}
                      onChange={(e) => setFormSpaceStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-semibold"
                    >
                      <option value="AVAILABLE">AVAILABLE (Tersedia)</option>
                      <option value="OCCUPIED">OCCUPIED (Terpakai)</option>
                      <option value="MAINTENANCE">MAINTENANCE (Pemeliharaan)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">Foto / Gambar Ruang Workspace</label>
                    {formSpaceImg ? (
                      <div className="flex items-center space-x-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <img
                          src={formSpaceImg}
                          alt="Preview Ruang"
                          className="w-14 h-14 rounded-lg object-cover border border-slate-300 shadow-2xs"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-[11px] font-bold text-emerald-700 flex items-center space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Foto Ruangan Terpasang</span>
                          </span>
                          <p className="text-[10px] text-slate-400 truncate">Siap ditampilkan di portal Co-Working</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setFormSpaceImg("")}
                          className="h-7 text-xs font-bold text-rose-600 hover:bg-rose-50 border-rose-200 rounded-lg"
                        >
                          Hapus
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-slate-300 hover:border-brand-orange/60 rounded-xl cursor-pointer bg-slate-50/60 hover:bg-orange-50/30 transition-all text-center group">
                        <UploadCloud className="w-5 h-5 text-slate-400 group-hover:text-brand-orange mb-1 transition-colors" />
                        <span className="text-xs font-bold text-slate-700 group-hover:text-brand-orange">
                          Klik untuk Upload Foto Ruangan
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WebP langsung dari perangkat</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageFileUpload(e, setFormSpaceImg)}
                        />
                      </label>
                    )}
                  </div>

                  <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                    <Button type="button" variant="outline" onClick={() => setIsAddSpaceModalOpen(false)} className="rounded-xl">
                      Batal
                    </Button>
                    <Button type="submit" className="bg-brand-orange hover:bg-orange-600 text-white font-bold rounded-xl shadow-xs">
                      Tambah Ruang
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL: EDIT RUANG WORKSPACE */}
          {isEditSpaceModalOpen && editingSpace && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
                  <h3 className="font-bold text-sm">Edit Ruang Workspace: {editingSpace.name}</h3>
                  <button onClick={() => setIsEditSpaceModalOpen(false)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={handleSaveEditSpace} className="p-6 space-y-3.5 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Nama Workspace / Ruangan *</label>
                    <input
                      type="text"
                      required
                      value={formSpaceName}
                      onChange={(e) => setFormSpaceName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-700">Tipe Ruangan (Kustom / Bebas) *</label>
                        <span className="text-[10px] text-slate-400">Ketik bebas atau pilih preset</span>
                      </div>
                      <input
                        type="text"
                        required
                        value={formSpaceType}
                        onChange={(e) => setFormSpaceType(e.target.value)}
                        placeholder="Contoh: HOT_DESK, PODCAST_STUDIO, EVENT_SPACE"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold bg-white"
                      />
                      <div className="flex flex-wrap gap-1 mt-1">
                        {["HOT_DESK", "DEDICATED_DESK", "PRIVATE_OFFICE", "MEETING_ROOM", "PODCAST_STUDIO", "EVENT_SPACE"].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setFormSpaceType(preset)}
                            className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-all ${
                              formSpaceType === preset
                                ? "bg-slate-900 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-700">Area / Lantai (Kustom / Bebas) *</label>
                        <span className="text-[10px] text-slate-400">Ketik bebas atau pilih preset</span>
                      </div>
                      <input
                        type="text"
                        required
                        value={formSpaceArea}
                        onChange={(e) => setFormSpaceArea(e.target.value)}
                        placeholder="Contoh: Ground Floor Main, Rooftop Terrace"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                      />
                      <div className="flex flex-wrap gap-1 mt-1">
                        {["Ground Floor Main", "Mezzanine Quiet Zone", "VIP Meeting Wing", "Lantai 2 Mezzanine", "Rooftop Terrace"].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setFormSpaceArea(preset)}
                            className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-all ${
                              formSpaceArea === preset
                                ? "bg-slate-900 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Kapasitas</label>
                      <input
                        type="number"
                        min={1}
                        value={formSpaceCap}
                        onChange={(e) => setFormSpaceCap(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Tarif / Jam</label>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={formSpaceHourly}
                        onChange={(e) => setFormSpaceHourly(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Tarif / Hari</label>
                      <input
                        type="number"
                        min={0}
                        step={5000}
                        value={formSpaceDaily}
                        onChange={(e) => setFormSpaceDaily(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Status</label>
                    <select
                      value={formSpaceStatus}
                      onChange={(e) => setFormSpaceStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-semibold"
                    >
                      <option value="AVAILABLE">AVAILABLE (Tersedia)</option>
                      <option value="OCCUPIED">OCCUPIED (Terpakai)</option>
                      <option value="MAINTENANCE">MAINTENANCE (Pemeliharaan)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">Foto / Gambar Ruang Workspace</label>
                    {formSpaceImg ? (
                      <div className="flex items-center space-x-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <img
                          src={formSpaceImg}
                          alt="Preview Ruang"
                          className="w-14 h-14 rounded-lg object-cover border border-slate-300 shadow-2xs"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-[11px] font-bold text-emerald-700 flex items-center space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Foto Ruangan Terpasang</span>
                          </span>
                          <p className="text-[10px] text-slate-400 truncate">Siap disimpan ke Master Data</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setFormSpaceImg("")}
                          className="h-7 text-xs font-bold text-rose-600 hover:bg-rose-50 border-rose-200 rounded-lg"
                        >
                          Hapus
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-slate-300 hover:border-brand-orange/60 rounded-xl cursor-pointer bg-slate-50/60 hover:bg-orange-50/30 transition-all text-center group">
                        <UploadCloud className="w-5 h-5 text-slate-400 group-hover:text-brand-orange mb-1 transition-colors" />
                        <span className="text-xs font-bold text-slate-700 group-hover:text-brand-orange">
                          Klik untuk Upload Foto Ruangan
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WebP langsung dari perangkat</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageFileUpload(e, setFormSpaceImg)}
                        />
                      </label>
                    )}
                  </div>
                  <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                    <Button type="button" variant="outline" onClick={() => setIsEditSpaceModalOpen(false)} className="rounded-xl">
                      Batal
                    </Button>
                    <Button type="submit" className="bg-brand-orange hover:bg-orange-600 text-white font-bold rounded-xl shadow-xs">
                      Simpan Perubahan
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL: DELETE RUANG CONFIRMATION */}
          {isDeleteSpaceModalOpen && deletingSpace && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 p-6 space-y-4 animate-in zoom-in-95">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="text-center space-y-1">
                  <h4 className="font-bold text-sm text-slate-900">Hapus Ruang Workspace?</h4>
                  <p className="text-xs text-slate-500">
                    Apakah Anda yakin ingin menghapus ruang <strong>"{deletingSpace.name}"</strong>? Data ruangan ini akan dihapus dari master data co-working.
                  </p>
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsDeleteSpaceModalOpen(false)} className="flex-1 rounded-xl">
                    Batal
                  </Button>
                  <Button type="button" onClick={handleConfirmDeleteSpace} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs">
                    Ya, Hapus
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL: TAMBAH PAKET MEMBERSHIP */}
          {isAddPlanModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
                  <h3 className="font-bold text-sm">Tambah Paket Membership Co-Working</h3>
                  <button onClick={() => setIsAddPlanModalOpen(false)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={handleSaveNewPlan} className="p-6 space-y-3.5 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Nama Paket Membership *</label>
                    <input
                      type="text"
                      required
                      value={formPlanName}
                      onChange={(e) => setFormPlanName(e.target.value)}
                      placeholder="Contoh: Starter Monthly Pass"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Siklus / Durasi *</label>
                      <select
                        value={formPlanCycle}
                        onChange={(e) => setFormPlanCycle(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-semibold"
                      >
                        <option value="Harian">Harian</option>
                        <option value="Mingguan">Mingguan</option>
                        <option value="Bulanan">Bulanan</option>
                        <option value="Tahunan">Tahunan</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Harga Paket (Rp) *</label>
                      <input
                        type="number"
                        required
                        min={0}
                        step={10000}
                        value={formPlanPrice}
                        onChange={(e) => setFormPlanPrice(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono font-bold text-brand-orange"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Akses Meja & Fasilitas</label>
                    <input
                      type="text"
                      value={formPlanDeskAccess}
                      onChange={(e) => setFormPlanDeskAccess(e.target.value)}
                      placeholder="Contoh: Akses Meja Hot Desk Bebas + 2 Jam Meeting Room"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                    <Button type="button" variant="outline" onClick={() => setIsAddPlanModalOpen(false)} className="rounded-xl">
                      Batal
                    </Button>
                    <Button type="submit" className="bg-brand-orange hover:bg-orange-600 text-white font-bold rounded-xl shadow-xs">
                      Tambah Paket
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL: EDIT PAKET MEMBERSHIP */}
          {isEditPlanModalOpen && editingPlan && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
                  <h3 className="font-bold text-sm">Edit Paket Membership: {editingPlan.name}</h3>
                  <button onClick={() => setIsEditPlanModalOpen(false)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={handleSaveEditPlan} className="p-6 space-y-3.5 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Nama Paket Membership *</label>
                    <input
                      type="text"
                      required
                      value={formPlanName}
                      onChange={(e) => setFormPlanName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Siklus / Durasi *</label>
                      <select
                        value={formPlanCycle}
                        onChange={(e) => setFormPlanCycle(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-semibold"
                      >
                        <option value="Harian">Harian</option>
                        <option value="Mingguan">Mingguan</option>
                        <option value="Bulanan">Bulanan</option>
                        <option value="Tahunan">Tahunan</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Harga Paket (Rp) *</label>
                      <input
                        type="number"
                        required
                        min={0}
                        step={10000}
                        value={formPlanPrice}
                        onChange={(e) => setFormPlanPrice(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono font-bold text-brand-orange"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Akses Meja & Fasilitas</label>
                    <input
                      type="text"
                      value={formPlanDeskAccess}
                      onChange={(e) => setFormPlanDeskAccess(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                    <Button type="button" variant="outline" onClick={() => setIsEditPlanModalOpen(false)} className="rounded-xl">
                      Batal
                    </Button>
                    <Button type="submit" className="bg-brand-orange hover:bg-orange-600 text-white font-bold rounded-xl shadow-xs">
                      Simpan Perubahan
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL: DELETE PAKET CONFIRMATION */}
          {isDeletePlanModalOpen && deletingPlan && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 p-6 space-y-4 animate-in zoom-in-95">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="text-center space-y-1">
                  <h4 className="font-bold text-sm text-slate-900">Hapus Paket Membership?</h4>
                  <p className="text-xs text-slate-500">
                    Apakah Anda yakin ingin menghapus paket <strong>"{deletingPlan.name}"</strong>? Paket ini tidak akan bisa dipilih untuk langganan baru.
                  </p>
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsDeletePlanModalOpen(false)} className="flex-1 rounded-xl">
                    Batal
                  </Button>
                  <Button type="button" onClick={handleConfirmDeletePlan} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs">
                    Ya, Hapus
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL: TAMBAH MEJA */}
          {isAddTableModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
                  <h3 className="font-bold text-sm">Tambah Meja Dine-In Baru</h3>
                  <button onClick={() => setIsAddTableModalOpen(false)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={handleSaveNewTable} className="p-6 space-y-3.5 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Nomor Meja *</label>
                      <input
                        type="number"
                        required
                        min={1}
                        value={formTableNumber}
                        onChange={(e) => setFormTableNumber(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Area Layout *</label>
                      <input
                        type="text"
                        required
                        value={formTableArea}
                        onChange={(e) => setFormTableArea(e.target.value)}
                        placeholder="Main Hall"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Kapasitas Kursi</label>
                      <input
                        type="number"
                        min={1}
                        value={formTableCap}
                        onChange={(e) => setFormTableCap(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Status Meja</label>
                      <select
                        value={formTableStatus}
                        onChange={(e) => setFormTableStatus(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-semibold"
                      >
                        <option value="AVAILABLE">AVAILABLE (Tersedia)</option>
                        <option value="OCCUPIED">OCCUPIED (Terisi)</option>
                        <option value="RESERVED">RESERVED (Reservasi)</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                    <Button type="button" variant="outline" onClick={() => setIsAddTableModalOpen(false)} className="rounded-xl">
                      Batal
                    </Button>
                    <Button type="submit" className="bg-brand-orange hover:bg-orange-600 text-white font-bold rounded-xl shadow-xs">
                      Tambah Meja
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL: EDIT MEJA */}
          {isEditTableModalOpen && editingTable && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
                  <h3 className="font-bold text-sm">Edit Meja Dine-In #{editingTable.number}</h3>
                  <button onClick={() => setIsEditTableModalOpen(false)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={handleSaveEditTable} className="p-6 space-y-3.5 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Nomor Meja *</label>
                      <input
                        type="number"
                        required
                        min={1}
                        value={formTableNumber}
                        onChange={(e) => setFormTableNumber(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Area Layout *</label>
                      <input
                        type="text"
                        required
                        value={formTableArea}
                        onChange={(e) => setFormTableArea(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Kapasitas Kursi</label>
                      <input
                        type="number"
                        min={1}
                        value={formTableCap}
                        onChange={(e) => setFormTableCap(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Status Meja</label>
                      <select
                        value={formTableStatus}
                        onChange={(e) => setFormTableStatus(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-semibold"
                      >
                        <option value="AVAILABLE">AVAILABLE (Tersedia)</option>
                        <option value="OCCUPIED">OCCUPIED (Terisi)</option>
                        <option value="RESERVED">RESERVED (Reservasi)</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                    <Button type="button" variant="outline" onClick={() => setIsEditTableModalOpen(false)} className="rounded-xl">
                      Batal
                    </Button>
                    <Button type="submit" className="bg-brand-orange hover:bg-orange-600 text-white font-bold rounded-xl shadow-xs">
                      Simpan Perubahan
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL: DELETE MEJA CONFIRMATION */}
          {isDeleteTableModalOpen && deletingTable && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 p-6 space-y-4 animate-in zoom-in-95">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="text-center space-y-1">
                  <h4 className="font-bold text-sm text-slate-900">Hapus Meja Dine-In?</h4>
                  <p className="text-xs text-slate-500">
                    Apakah Anda yakin ingin menghapus <strong>Meja {deletingTable.number}</strong> ({deletingTable.areaName})?
                  </p>
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsDeleteTableModalOpen(false)} className="flex-1 rounded-xl">
                    Batal
                  </Button>
                  <Button type="button" onClick={handleConfirmDeleteTable} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs">
                    Ya, Hapus
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL: PILIH MENU PRODUK PROMO (REVISI 5) */}
          {isPromoProductModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden animate-in zoom-in-95">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-orange-100 text-brand-orange flex items-center justify-center shrink-0">
                      <UtensilsCrossed className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">Katalog Menu Promo Diskon</h4>
                      <p className="text-[11px] text-slate-500">
                        Pilih menu yang berhak mendapatkan diskon dengan mencentang checkbox produk.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPromoProductModalOpen(false)}
                    className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Filter and Search Bar */}
                <div className="p-3 border-b border-slate-100 bg-white grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari nama menu..."
                      value={promoProductSearch}
                      onChange={(e) => setPromoProductSearch(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <select
                      value={promoProductCategoryFilter}
                      onChange={(e) => setPromoProductCategoryFilter(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-medium"
                    >
                      <option value="ALL">Semua Kategori</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <select
                      value={promoProductTenantFilter}
                      onChange={(e) => setPromoProductTenantFilter(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-medium"
                    >
                      <option value="ALL">Semua Mitra / Tenant</option>
                      {localTenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Multi-Select Toolbar */}
                {(() => {
                  const modalFilteredProducts = filteredProducts.filter((p) => {
                    const matchCat = promoProductCategoryFilter === "ALL" || p.category === promoProductCategoryFilter;
                    const matchTenant = promoProductTenantFilter === "ALL" || p.tenantId === promoProductTenantFilter;
                    const matchSearch =
                      p.name.toLowerCase().includes(promoProductSearch.toLowerCase()) ||
                      p.category.toLowerCase().includes(promoProductSearch.toLowerCase());
                    return matchCat && matchTenant && matchSearch;
                  });

                  return (
                    <>
                      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-[11px] font-bold text-slate-500">
                          Menampilkan {modalFilteredProducts.length} produk ({selectedProductIdsInModal.length} terpilih)
                        </span>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handleSelectAllModalProducts(modalFilteredProducts.map((p) => p.id))}
                            className="text-[11px] font-bold text-brand-orange hover:underline"
                          >
                            Pilih Semua
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={handleClearAllModalProducts}
                            className="text-[11px] font-bold text-rose-600 hover:underline"
                          >
                            Hapus Semua
                          </button>
                        </div>
                      </div>

                      {/* Product Checkbox List */}
                      <div className="flex-1 overflow-y-auto p-4 max-h-[50vh] divide-y divide-slate-100">
                        {modalFilteredProducts.length === 0 ? (
                          <div className="text-center py-8 text-xs text-slate-400 italic">
                            Tidak ada produk menu yang sesuai filter.
                          </div>
                        ) : (
                          modalFilteredProducts.map((p) => {
                            const isSelected = selectedProductIdsInModal.includes(p.id);
                            const tenantName = p.tenantId ? getTenantName(p.tenantId) : "Dago Hub";

                            return (
                              <label
                                key={p.id}
                                className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                                  isSelected ? "bg-orange-50/70" : "hover:bg-slate-50"
                                }`}
                              >
                                <div className="flex items-center space-x-3">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleModalProduct(p.id)}
                                    className="w-4 h-4 rounded text-brand-orange focus:ring-brand-orange"
                                  />
                                  <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                                    {p.imageUrl ? (
                                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <UtensilsCrossed className="w-4 h-4 text-slate-400" />
                                    )}
                                  </div>
                                  <div>
                                    <div className="flex items-center space-x-2">
                                      <h5 className="font-bold text-xs text-slate-900">{p.name}</h5>
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                                        {p.category}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-slate-500">{tenantName}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="font-mono font-bold text-xs text-slate-900 block">
                                    {formatCurrencyIDR(p.basePrice)}
                                  </span>
                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                      p.status === "ACTIVE"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-slate-100 text-slate-500"
                                    }`}
                                  >
                                    {p.status}
                                  </span>
                                </div>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </>
                  );
                })()}

                {/* Footer */}
                <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">
                    Total: <strong className="text-brand-orange">{selectedProductIdsInModal.length}</strong> produk dipilih
                  </span>
                  <div className="flex items-center space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsPromoProductModalOpen(false)}
                      className="rounded-xl text-xs h-8"
                    >
                      Batal
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSavePromoProducts}
                      className="bg-brand-orange hover:bg-orange-600 text-white font-bold rounded-xl text-xs h-8 shadow-xs"
                    >
                      Simpan Pilihan Produk
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {previewModalFeature && (
        <UpgradeModal
          isOpen={Boolean(previewModalFeature)}
          onClose={() => setPreviewModalFeature(null)}
          title={previewModalFeature.title}
          badgeLabel={previewModalFeature.badgeLabel}
          badgeVariant={previewModalFeature.badgeVariant}
          categoryTag={previewModalFeature.categoryTag}
          description={previewModalFeature.description}
          benefits={previewModalFeature.benefits}
          samplePlanName={previewModalFeature.samplePlanName}
          statusText={previewModalFeature.statusText}
        />
      )}
    </div>
  );
}
