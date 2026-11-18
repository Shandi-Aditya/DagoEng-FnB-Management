"use client";

import type React from "react";
import { useEffect, useState } from "react";
import {
  Award,
  Coffee,
  Grid,
  Laptop,
  Plus,
  Printer,
  Settings,
  ShieldAlert,
  Sparkles,
  Store,
  Tag,
  UtensilsCrossed,
  Wifi,
} from "lucide-react";

import { notify } from "@/components/app/notify";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useActivityLog } from "@/contexts/ActivityLogContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCoworking } from "@/contexts/CoworkingContext";
import { useOutlet } from "@/contexts/OutletContext";
import { useProducts } from "@/contexts/ProductContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useTables } from "@/contexts/TableContext";
import {
  INDONESIAN_NATIONAL_HOLIDAYS_2026,
  type HolidayOverride,
  type HolidayOverrideDate,
  type TenantOperationConfig,
} from "@/lib/operating-hours";
import { sortPromosByPriority, type PromoConfig } from "@/lib/promo";
import {
  DEFAULT_TENANT_REVENUE_SPLITS,
  getAllTenantRevenueSplits,
  setTenantRevenueSplit,
  type TenantRevenueSplitConfig,
} from "@/lib/settlement";
import {
  canManageSettlementAndReceiptPolicy,
  getStoredSettlementReceiptPolicy,
  saveStoredSettlementReceiptPolicy,
  type SettlementBasisMode,
} from "@/lib/settlement-receipt-policy";
import {
  getSimulatedOrgSubscription,
  getSimulatedTenantAddons,
  type OrgSubscriptionState,
  type PlanTier,
  setSimulatedOrgPlan,
  type TenantAddonItem,
  toggleSimulatedTenantAddon,
} from "@/lib/subscription";
import {
  subscriptionSyncClient,
  tenantsSyncClient,
  wifiSyncClient,
} from "@/lib/sync-domains/config-spec";
import {
  getAllFnbTenants,
  getTenantName,
  getTenantProfile,
  getTenantStatus,
  saveCustomTenant,
  saveTenantProfile,
  setTenantStatus,
} from "@/lib/tenant";
import {
  DEFAULT_NETWORK_CONFIG,
  getSimulatedCoworkingRules,
  getSimulatedFnBRules,
  getSimulatedWifiCalcBasis,
  getSimulatedWifiVouchers,
  revokeSimulatedWifiVoucher,
  saveSimulatedFnBRules,
  setSimulatedWifiCalcBasis,
  validateFnBRulesOverlap,
  type WifiCalculationBasis,
  type WifiCoworkingRule,
  type WifiFnBRule,
  type WifiNetworkConfig,
  type WifiVoucherRecord,
  type WifiVoucherStatus,
} from "@/lib/wifi";
import type { CategoryTaxType } from "@/types/settings";
import type { CoworkingMembershipPlan } from "@/types/coworking";
import type { TableStatus } from "@/contexts/TableContext";
import type { CommunityEvent, EventRevenueSharingPolicy, DEFAULT_EVENT_POLICY } from "@/types/event";
import type { CommunityOrganizerProfile, INITIAL_ORGANIZERS } from "@/types/organizer";
import type { MasterProduct } from "@/types/product";

// Sub-komponen modular settings yang telah di-unslop
import { PartnerModals } from "@/features/settings/PartnerModals";
import { PartnersAdminTab, type PartnerSubTabId } from "@/features/settings/PartnersAdminTab";
import { PlatformConfigTab } from "@/features/settings/PlatformConfigTab";
import { PrinterSettingsTab } from "@/features/settings/PrinterSettingsTab";
import { ProductModals } from "@/features/settings/ProductModals";
import { ProductsCatalogTab } from "@/features/settings/ProductsCatalogTab";
import { PromosTab } from "@/features/settings/PromosTab";
import {
  filterAndSortProducts,
  type ProductSortOrder,
  type UnifiedPartnerRow,
} from "@/features/settings/settings-domain";
import { SpacesAndTablesTab } from "@/features/settings/SpacesAndTablesTab";
import { SubscriptionTab } from "@/features/settings/SubscriptionTab";
import { TenantProfileTab } from "@/features/settings/TenantProfileTab";
import { WifiManagementTab } from "@/features/settings/WifiManagementTab";

export default function SettingsPage() {
  const { user, activeOrgModules, toggleOrgModule } = useAuth();
  const { filteredProducts, categories, addProduct, updateProduct, deleteProduct, toggleProductStatus, addCategory } = useProducts();
  const {
    spaces: cwSpaces,
    plans: cwPlans,
    addSpace,
    updateSpace,
    deleteSpace,
    addPlan: cwAddPlan,
    updatePlan: cwUpdatePlan,
    deletePlan: cwDeletePlan,
  } = useCoworking();
  const { areas, addTable, updateTable, deleteTable, updateTableStatus } = useTables();
  const allTables = areas.flatMap((a) => a.tables.map((t) => ({ ...t, areaName: a.name })));
  const { settings, updateSettings, savePromos } = useSettings();
  const { outlets } = useOutlet();

  const isSuperAdmin = user?.role?.slug === "SUPER_ADMIN";
  const isOrgOwner = user?.role?.slug === "OWNER" && user?.scopeLevel === "ORGANIZATION";
  const isTenantOwner = user?.role?.slug === "OWNER" && user?.scopeLevel === "TENANT";
  const canAccessSettings = isSuperAdmin || isOrgOwner || isTenantOwner;
  const canEditSettlementPolicy = canManageSettlementAndReceiptPolicy(user);

  // Tab Utama Navigasi
  const [selectedAdminTab, setSelectedAdminTab] = useState<string>("PRODUCTS");
  const [tenantActiveTab, setTenantActiveTab] = useState<"PRODUCTS" | "PROFILE" | "PROMOS" | "ADDONS">("PRODUCTS");

  // Platform Form State
  const [language, setLanguage] = useState<"id" | "en">(settings.language);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [currency, setCurrency] = useState(settings.currency);
  const [lowStock, setLowStock] = useState(settings.lowStockThresholdPercent);
  const [fnbTaxType, setFnbTaxType] = useState<CategoryTaxType>(settings.categoryTax?.fnb?.taxType || "PB1");
  const [fnbTaxRate, setFnbTaxRate] = useState(settings.categoryTax?.fnb?.taxRatePercent ?? settings.taxRatePercent ?? 10);
  const [fnbTaxEnabled, setFnbTaxEnabled] = useState(settings.categoryTax?.fnb?.isEnabled ?? true);
  const [cwTaxType, setCwTaxType] = useState<CategoryTaxType>(settings.categoryTax?.coworking?.taxType || "NON_TAX");
  const [cwTaxRate, setCwTaxRate] = useState(settings.categoryTax?.coworking?.taxRatePercent ?? 0);
  const [cwTaxEnabled, setCwTaxEnabled] = useState(settings.categoryTax?.coworking?.isEnabled ?? false);
  const [serviceCharge, setServiceCharge] = useState(settings.serviceChargePercent);

  // Loyalty thresholds
  const [silverPts, setSilverPts] = useState(settings.loyaltyTiers.silverMin);
  const [goldPts, setGoldPts] = useState(settings.loyaltyTiers.goldMin);
  const [platPts, setPlatPts] = useState(settings.loyaltyTiers.platinumMin);

  // Promos
  const [promos, setPromos] = useState<PromoConfig[]>(() => sortPromosByPriority(settings.promos || []));
  const [isPromoProductModalOpen, setIsPromoProductModalOpen] = useState(false);
  const [activePromoIdForProductSelect, setActivePromoIdForProductSelect] = useState<string | null>(null);
  const [selectedProductIdsInModal, setSelectedProductIdsInModal] = useState<string[]>([]);
  const [promoProductSearch, setPromoProductSearch] = useState("");
  const [promoProductCategoryFilter, setPromoProductCategoryFilter] = useState("ALL");
  const [promoProductTenantFilter, setPromoProductTenantFilter] = useState("ALL");

  // Filter & Urutan Produk
  const [masterSearch, setMasterSearch] = useState<string>("");
  const [masterTenantFilter, setMasterTenantFilter] = useState<string>("ALL");
  const [masterCategoryFilter, setMasterCategoryFilter] = useState<string>("ALL");
  const [masterStatusFilter, setMasterStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [masterSortOrder, setMasterSortOrder] = useState<ProductSortOrder>("UPDATED_DESC");

  // Co-working Holidays & Operating Hours
  const [cwWeekendClosed, setCwWeekendClosed] = useState(settings.coworkingHolidays?.closeOnWeekends ?? true);
  const [cwNationalHolidaysClosed, setCwNationalHolidaysClosed] = useState(settings.coworkingHolidays?.closeOnNationalHolidays ?? true);
  const [cwOverrides, setCwOverrides] = useState<HolidayOverrideDate[]>(settings.coworkingHolidays?.overrides || []);
  const [newOverrideDate, setNewOverrideDate] = useState("");
  const [newOverrideType, setNewOverrideType] = useState<"OPEN" | "CLOSED">("OPEN");
  const [newOverrideReason, setNewOverrideReason] = useState("");
  const [cwOpenTime, setCwOpenTime] = useState(settings.operationalHours?.coworking?.open || "09:00");
  const [cwCloseTime, setCwCloseTime] = useState(settings.operationalHours?.coworking?.close || "18:00");
  const [fnbOpenTime, setFnbOpenTime] = useState(settings.operationalHours?.fnb?.open || "07:00");
  const [fnbCloseTime, setFnbCloseTime] = useState(settings.operationalHours?.fnb?.close || "22:00");

  // Tenant Operations & Profil
  const [localTenants, setLocalTenants] = useState<{ id: string; name: string; code: string; badge: string }[]>(() => getAllFnbTenants());
  const [allTenantStatuses, setAllTenantStatuses] = useState<Record<string, "ACTIVE" | "INACTIVE">>({});
  const [tenantOps, setTenantOps] = useState<Record<string, TenantOperationConfig>>(settings.tenantOperations || {});
  const [tenantBrandName, setTenantBrandName] = useState(user?.tenant?.name || "Kopi Senja");
  const [tenantTagline, setTenantTagline] = useState("Specialty Coffee & Beverages");
  const [tenantDesc, setTenantDesc] = useState("Single origin espresso blend Kintamani, olahan susu segar & gula aren organik Bali.");
  const [tenantPhone, setTenantPhone] = useState("+62 812-3456-7890");
  const [tenantReceiptHeader, setTenantReceiptHeader] = useState("Kopi Senja — Specialty Coffee & Beverages");
  const [tenantReceiptFooter, setTenantReceiptFooter] = useState("Terima kasih telah berkunjung ke Kopi Senja!");
  const [tenantLowStock, setTenantLowStock] = useState(35);
  const [tenantStatus, setTenantStatusState] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [tenantOpenTime, setTenantOpenTime] = useState(settings.tenantOperations?.[user?.tenant?.id || "tenant-ks"]?.openTime || "08:00");
  const [tenantCloseTime, setTenantCloseTime] = useState(settings.tenantOperations?.[user?.tenant?.id || "tenant-ks"]?.closeTime || "21:00");
  const [tenantClosedReason, setTenantClosedReason] = useState(settings.tenantOperations?.[user?.tenant?.id || "tenant-ks"]?.temporaryClosedReason || "");
  const [bankName, setBankName] = useState<string>("BCA");
  const [bankAccountNumber, setBankAccountNumber] = useState<string>("");
  const [bankAccountHolder, setBankAccountHolder] = useState<string>("");
  const [bankFormError, setBankFormError] = useState<string>("");
  const [isSavingTenantOps, setIsSavingTenantOps] = useState(false);

  // Flexible Revenue Sharing
  const [settlementBasis, setSettlementBasis] = useState<SettlementBasisMode>(
    () => getStoredSettlementReceiptPolicy().settlementBasis
  );
  const [revenueSplits, setRevenueSplits] = useState<Record<string, TenantRevenueSplitConfig>>({});
  const [revenueSplitErrors, setRevenueSplitErrors] = useState<Record<string, string>>({});
  const [splitSaveFeedback, setSplitSaveFeedback] = useState<string>("");

  // Organizers & Event Policy
  const [partnerSubTab, setPartnerSubTab] = useState<PartnerSubTabId>("MANAJEMEN_MITRA");
  const [partnerTypeFilter, setPartnerTypeFilter] = useState<"ALL" | "FNB" | "EVENT">("ALL");
  const [partnerStatusFilter, setPartnerStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [partnerSearchQuery, setPartnerSearchQuery] = useState<string>("");
  const [organizers, setOrganizers] = useState<CommunityOrganizerProfile[]>([]);
  const [selectedPartnerDetail, setSelectedPartnerDetail] = useState<UnifiedPartnerRow | null>(null);
  const [isAddTenantModalOpen, setIsAddTenantModalOpen] = useState(false);
  const [formTenantName, setFormTenantName] = useState("");
  const [formTenantCode, setFormTenantCode] = useState("");
  const [formTenantBadge, setFormTenantBadge] = useState("");
  const [isAddOrganizerModalOpen, setIsAddOrganizerModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgCategory, setNewOrgCategory] = useState("Komunitas Kreatif");
  const [newOrgPIC, setNewOrgPIC] = useState("");
  const [newOrgPhone, setNewOrgPhone] = useState("");
  const [newOrgEmail, setNewOrgEmail] = useState("");
  const [newOrgNotes, setNewOrgNotes] = useState("");
  const [newOrgStatus, setNewOrgStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [addOrgError, setAddOrgError] = useState("");
  const [isSubmittingOrg, setIsSubmittingOrg] = useState(false);
  const [activationModalData, setActivationModalData] = useState<{
    organizerName: string;
    organizerEmail: string;
    activationUrl: string;
    expiresAt: string;
  } | null>(null);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [eventPlatformFee, setEventPlatformFee] = useState<number>(20);
  const [eventPolicyEffectiveDate, setEventPolicyEffectiveDate] = useState<string>("2026-01-01T00:00:00.000Z");
  const [eventPolicyNotes, setEventPolicyNotes] = useState<string>("Kebijakan komisi standar platform DAGO Creative Hub (20% Platform / 80% Penyelenggara Komunitas).");
  const [eventPolicyHistory, setEventPolicyHistory] = useState<any[]>([]);
  const [eventPolicyFeedback, setEventPolicyFeedback] = useState<string>("");
  const [isSavingEventPolicy, setIsSavingEventPolicy] = useState(false);
  const [eventSimTicketPrice, setEventSimTicketPrice] = useState<number>(50000);
  const [eventSimTicketQty, setEventSimTicketQty] = useState<number>(10);
  const [activeAdminEvents, setActiveAdminEvents] = useState<CommunityEvent[]>([]);
  const [eventOverrides, setEventOverrides] = useState<Record<string, number | null>>({});

  // Subscription State
  const [orgSub, setOrgSub] = useState<OrgSubscriptionState>(getSimulatedOrgSubscription());
  const [tenantAddons, setTenantAddons] = useState<TenantAddonItem[]>([]);

  // Wi-Fi State
  const [wifiFnBRules, setWifiFnBRules] = useState<WifiFnBRule[]>(() => getSimulatedFnBRules());
  const [wifiCwRules] = useState<WifiCoworkingRule[]>(() => getSimulatedCoworkingRules());
  const [wifiVouchers, setWifiVouchers] = useState<WifiVoucherRecord[]>(() => getSimulatedWifiVouchers());
  const [wifiNetworkConfig] = useState<WifiNetworkConfig>(DEFAULT_NETWORK_CONFIG);
  const [wifiCalcBasis, setWifiCalcBasis] = useState<WifiCalculationBasis>(() => getSimulatedWifiCalcBasis());
  const [wifiServiceFilter, setWifiServiceFilter] = useState<"ALL" | "FNB" | "COWORKING">("ALL");
  const [wifiStatusFilter, setWifiStatusFilter] = useState<"ALL" | WifiVoucherStatus>("ALL");
  const [wifiSearchQuery, setWifiSearchQuery] = useState<string>("");

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

  // Product Modals
  const [isAddProdModalOpen, setIsAddProdModalOpen] = useState(false);
  const [isEditProdModalOpen, setIsEditProdModalOpen] = useState(false);
  const [editingProd, setEditingProd] = useState<MasterProduct | null>(null);
  const [isDeleteProdModalOpen, setIsDeleteProdModalOpen] = useState(false);
  const [deletingProd, setDeletingProd] = useState<MasterProduct | null>(null);
  const [formProdName, setFormProdName] = useState("");
  const [formProdCat, setFormProdCat] = useState("Minuman");
  const [formProdTenantId, setFormProdTenantId] = useState("tenant-ks");
  const [formProdPrice, setFormProdPrice] = useState<number>(25000);
  const [formProdCogs, setFormProdCogs] = useState<number>(9000);
  const [formProdDesc, setFormProdDesc] = useState("");
  const [formProdImg, setFormProdImg] = useState("");
  const [formProdStatus, setFormProdStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);
  const [formNewCatName, setFormNewCatName] = useState("");

  const [localSpaces, setLocalSpaces] = useState<any[]>(cwSpaces);
  useEffect(() => {
    setLocalSpaces(cwSpaces);
  }, [cwSpaces]);
  const [isAddSpaceModalOpen, setIsAddSpaceModalOpen] = useState(false);
  const [isEditSpaceModalOpen, setIsEditSpaceModalOpen] = useState(false);
  const [editingSpace, setEditingSpace] = useState<any>(null);
  const [isDeleteSpaceOpen, setIsDeleteSpaceOpen] = useState(false);
  const [deletingSpace, setDeletingSpace] = useState<any>(null);
  const [formSpaceName, setFormSpaceName] = useState("");
  const [formSpaceType, setFormSpaceType] = useState<string>("HOT_DESK");
  const [formSpaceArea, setFormSpaceArea] = useState("Ground Floor Main");
  const [formSpaceCap, setFormSpaceCap] = useState(4);
  const [formSpaceHourly, setFormSpaceHourly] = useState(15000);
  const [formSpaceDaily, setFormSpaceDaily] = useState(65000);
  const [formSpaceStatus, setFormSpaceStatus] = useState<string>("AVAILABLE");

  const [isAddPlanModalOpen, setIsAddPlanModalOpen] = useState(false);
  const [isEditPlanModalOpen, setIsEditPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [isDeletePlanOpen, setIsDeletePlanOpen] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState<any>(null);
  const [formPlanName, setFormPlanName] = useState("");
  const [formPlanCycle, setFormPlanCycle] = useState("Bulanan");
  const [formPlanPrice, setFormPlanPrice] = useState(500000);
  const [formPlanDeskAccess, setFormPlanDeskAccess] = useState("Akses Hot Desk Bebas Pakai");

  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);
  const [isEditTableModalOpen, setIsEditTableModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<any>(null);
  const [isDeleteTableOpen, setIsDeleteTableOpen] = useState(false);
  const [deletingTable, setDeletingTable] = useState<any>(null);
  const [formTableNumber, setFormTableNumber] = useState<number>(allTables.length + 1);
  const [formTableArea, setFormTableArea] = useState("Main Hall");
  const [formTableCap, setFormTableCap] = useState(4);
  const [formTableStatus, setFormTableStatus] = useState<string>("AVAILABLE");

  const refreshAllTenantStatuses = () => {
    const tenants = getAllFnbTenants();
    setLocalTenants(tenants);
    const statuses: Record<string, "ACTIVE" | "INACTIVE"> = {};
    tenants.forEach((t) => {
      statuses[t.id] = getTenantStatus(t.id);
    });
    setAllTenantStatuses(statuses);
  };

  const refreshRevenueSplits = () => {
    setRevenueSplits(getAllTenantRevenueSplits());
  };

  useEffect(() => {
    setLanguage(settings.language);
    setTimezone(settings.timezone);
    setCurrency(settings.currency);
    setLowStock(settings.lowStockThresholdPercent);
    setFnbTaxType(settings.categoryTax?.fnb?.taxType || "PB1");
    setFnbTaxRate(settings.categoryTax?.fnb?.taxRatePercent ?? settings.taxRatePercent ?? 10);
    setFnbTaxEnabled(settings.categoryTax?.fnb?.isEnabled ?? true);
    setCwTaxType(settings.categoryTax?.coworking?.taxType || "NON_TAX");
    setCwTaxRate(settings.categoryTax?.coworking?.taxRatePercent ?? 0);
    setCwTaxEnabled(settings.categoryTax?.coworking?.isEnabled ?? false);
    setServiceCharge(settings.serviceChargePercent);
    setSilverPts(settings.loyaltyTiers.silverMin);
    setGoldPts(settings.loyaltyTiers.goldMin);
    setPlatPts(settings.loyaltyTiers.platinumMin);
    setPromos(sortPromosByPriority(settings.promos || []));
    setCwWeekendClosed(settings.coworkingHolidays?.closeOnWeekends ?? true);
    setCwNationalHolidaysClosed(settings.coworkingHolidays?.closeOnNationalHolidays ?? true);
    setCwOverrides(settings.coworkingHolidays?.overrides || []);
    setCwOpenTime(settings.operationalHours?.coworking?.open || "09:00");
    setCwCloseTime(settings.operationalHours?.coworking?.close || "18:00");
    setFnbOpenTime(settings.operationalHours?.fnb?.open || "07:00");
    setFnbCloseTime(settings.operationalHours?.fnb?.close || "22:00");
    setTenantOps(settings.tenantOperations || {});
    const currentTenantId = user?.tenant?.id || "tenant-ks";
    const myOp = settings.tenantOperations?.[currentTenantId];
    if (myOp) {
      setTenantOpenTime(myOp.openTime || "08:00");
      setTenantCloseTime(myOp.closeTime || "21:00");
      setTenantClosedReason(myOp.temporaryClosedReason || "");
    }
  }, [settings, user?.tenant?.id]);

  useEffect(() => {
    refreshAllTenantStatuses();
    refreshRevenueSplits();
    const currentScopeId = isTenantOwner ? (user?.tenant?.id || "tenant-unassigned") : "org-dago-hub";
    setOrgSub(getSimulatedOrgSubscription());
    setTenantAddons(getSimulatedTenantAddons(currentScopeId));

    void tenantsSyncClient.hydrate();
    void wifiSyncClient.hydrate();
    void subscriptionSyncClient.hydrate();

    const unsubTenants = tenantsSyncClient.subscribe(() => {
      refreshAllTenantStatuses();
      if (isTenantOwner && user?.tenant?.id) {
        const profile = getTenantProfile(user.tenant.id);
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
      }
    });
    const unsubWifi = wifiSyncClient.subscribe(() => {
      setWifiFnBRules(getSimulatedFnBRules());
      setWifiVouchers(getSimulatedWifiVouchers());
      setWifiCalcBasis(getSimulatedWifiCalcBasis());
    });
    const unsubSub = subscriptionSyncClient.subscribe(() => {
      setOrgSub(getSimulatedOrgSubscription());
      setTenantAddons(getSimulatedTenantAddons(currentScopeId));
    });

    return () => {
      unsubTenants();
      unsubWifi();
      unsubSub();
    };
  }, [user, isTenantOwner]);

  useEffect(() => {
    let active = true;
    fetch("/api/settings/settlement-receipt")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.success || !data?.policy) return;
        const policy = data.policy;
        setSettlementBasis(policy.settlementBasis);
        if (policy.revenueSplits) {
          setRevenueSplits((prev) => ({
            ...DEFAULT_TENANT_REVENUE_SPLITS,
            ...prev,
            ...policy.revenueSplits,
          }));
        }
        saveStoredSettlementReceiptPolicy(policy);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    fetch("/api/events/admin/organizers")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) setOrganizers(data.data);
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
      console.error("Gagal memuat profil mitra", e);
    }
  }, [user, isTenantOwner]);

  // Image Upload Helper
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const result = loadEvt.target?.result as string;
      if (result) callback(result);
    };
    reader.readAsDataURL(file);
  };

  // Product Handlers
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
    notify.success("Menu ditambahkan", `${formProdName} berhasil disimpan.`);
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
      "Update Master Data via Settings",
    );
    setIsEditProdModalOpen(false);
    setEditingProd(null);
    notify.success("Menu diperbarui", `Perubahan ${formProdName} disimpan.`);
  };

  const handleConfirmDeleteProduct = () => {
    if (!deletingProd) return;
    deleteProduct(deletingProd.id);
    notify.success("Menu dihapus", `${deletingProd.name} dihapus dari master data.`);
    setIsDeleteProdModalOpen(false);
    setDeletingProd(null);
  };

  const handleSaveNewCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNewCatName.trim()) return;
    addCategory(formNewCatName.trim());
    setIsAddCatModalOpen(false);
    setFormNewCatName("");
    notify.success("Kategori ditambahkan", `Kategori ${formNewCatName} siap digunakan.`);
  };

  // Space Handlers
  const handleSaveNewSpace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSpaceName.trim()) return;
    const created = addSpace({
      name: formSpaceName.trim(),
      type: formSpaceType.trim() || "HOT_DESK",
      area: formSpaceArea.trim() || "Ground Floor Main",
      capacity: Number(formSpaceCap) || 1,
      hourlyRate: Number(formSpaceHourly) || 15000,
      dailyRate: Number(formSpaceDaily) || 65000,
      status: formSpaceStatus as any,
      amenities: ["WiFi 100Mbps", "Power Hub", "Air Conditioner"],
    });
    setLocalSpaces((prev) => [...prev, created]);
    setIsAddSpaceModalOpen(false);
    notify.success("Ruang ditambahkan", `${created.name} berhasil disimpan.`);
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
    };
    updateSpace(editingSpace.id, updates);
    setLocalSpaces((prev) => prev.map((s) => (s.id === editingSpace.id ? { ...s, ...updates } : s)));
    setIsEditSpaceModalOpen(false);
    setEditingSpace(null);
    notify.success("Ruang diperbarui", `Perubahan ${formSpaceName} disimpan.`);
  };

  const handleConfirmDeleteSpace = () => {
    if (!deletingSpace) return;
    deleteSpace(deletingSpace.id);
    setLocalSpaces((prev) => prev.filter((s) => s.id !== deletingSpace.id));
    setIsDeleteSpaceOpen(false);
    setDeletingSpace(null);
    notify.success("Ruang dihapus", `${deletingSpace.name} dihapus.`);
  };

  const handleSaveNewPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPlanName.trim()) return;
    const priceNum = Number(formPlanPrice) || 0;
    const cycle: CoworkingMembershipPlan["billingCycle"] =
      formPlanCycle === "Harian" || formPlanCycle === "Paket 10 Hari"
        ? formPlanCycle
        : "Bulanan";
    const newPlan: CoworkingMembershipPlan = {
      id: `plan-${Date.now()}`,
      name: formPlanName.trim(),
      billingCycle: cycle,
      priceNumber: priceNum,
      priceFormatted: `Rp ${priceNum.toLocaleString("id-ID")}`,
      color: "blue",
      deskAccess: formPlanDeskAccess.trim() || "Akses Hot Desk Bebas Pakai",
      meetingCredits: "Termasuk kuota ruang rapat standar",
      fnbPerk: "Diskon 10% mitra F&B",
      fnbVoucherCode: "MEMBER10",
      amenities: ["High-speed Fiber WiFi", "Free Flow Infused Water"],
    };
    cwAddPlan(newPlan);
    setIsAddPlanModalOpen(false);
    notify.success("Paket ditambahkan", `${newPlan.name} berhasil disimpan.`);
  };

  const handleSaveEditPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan || !formPlanName.trim()) return;
    const priceNum = Number(formPlanPrice) || 0;
    const cycle: CoworkingMembershipPlan["billingCycle"] =
      formPlanCycle === "Harian" || formPlanCycle === "Paket 10 Hari"
        ? formPlanCycle
        : "Bulanan";
    cwUpdatePlan(editingPlan.id, {
      name: formPlanName.trim(),
      billingCycle: cycle,
      priceNumber: priceNum,
      priceFormatted: `Rp ${priceNum.toLocaleString("id-ID")}`,
      deskAccess: formPlanDeskAccess.trim(),
    });
    setIsEditPlanModalOpen(false);
    setEditingPlan(null);
    notify.success("Paket diperbarui", `Perubahan ${formPlanName} disimpan.`);
  };

  const handleConfirmDeletePlan = () => {
    if (!deletingPlan) return;
    cwDeletePlan(deletingPlan.id);
    setIsDeletePlanOpen(false);
    setDeletingPlan(null);
    notify.success("Paket dihapus", `${deletingPlan.name} dihapus.`);
  };

  const handleSaveNewTable = (e: React.FormEvent) => {
    e.preventDefault();
    const tableNum = String(formTableNumber || allTables.length + 1).trim();
    const targetArea = formTableArea.trim() || "Main Hall";
    const capNum = Number(formTableCap) || 4;
    const desiredStatus = (formTableStatus || "AVAILABLE") as TableStatus;
    addTable(targetArea, tableNum, capNum);
    if (desiredStatus !== "AVAILABLE") {
      updateTableStatus(tableNum, desiredStatus);
    }
    setIsAddTableModalOpen(false);
    notify.success("Meja ditambahkan", `Meja ${tableNum} (${targetArea}) disimpan.`);
  };

  const handleSaveEditTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTable) return;
    const nextNumber = String(formTableNumber || editingTable.number).trim();
    updateTable(editingTable.id, {
      number: nextNumber,
      areaName: formTableArea.trim() || editingTable.areaName || "Main Hall",
      cap: Number(formTableCap) || 4,
      status: (formTableStatus || editingTable.status || "AVAILABLE") as TableStatus,
    });
    setIsEditTableModalOpen(false);
    setEditingTable(null);
    notify.success("Meja diperbarui", `Perubahan meja ${nextNumber} disimpan.`);
  };

  const handleToggleTableStatus = (tblId: string) => {
    const existing = allTables.find((t) => t.id === tblId);
    if (!existing) return;
    const next: TableStatus =
      existing.status === "AVAILABLE"
        ? "OCCUPIED"
        : existing.status === "OCCUPIED"
          ? "RESERVED"
          : "AVAILABLE";
    updateTableStatus(tblId, next);
  };

  const handleConfirmDeleteTable = () => {
    if (!deletingTable) return;
    deleteTable(deletingTable.id);
    setIsDeleteTableOpen(false);
    setDeletingTable(null);
    notify.success("Meja dihapus", `Meja ${deletingTable.number} dihapus.`);
  };

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
      tagline: "Mitra resmi Dago",
      desc: "Mitra resmi platform Dago Hub",
      icon: "Store",
    };
    saveCustomTenant(newTenant);
    setTenantRevenueSplit(newId, 85);
    refreshAllTenantStatuses();
    refreshRevenueSplits();
    setIsAddTenantModalOpen(false);
    setFormTenantName("");
    setFormTenantCode("");
    setFormTenantBadge("");
    notify.success("Mitra ditambahkan", `${newTenant.name} berhasil disimpan.`);
  };

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
          prev.map((o) => (o.id === orgId ? { ...o, status: nextStatus, updatedAt: new Date().toISOString() } : o)),
        );
        notify.success("Status diubah", `Status akun diubah menjadi ${nextStatus === "ACTIVE" ? "Aktif" : "Nonaktif"}.`);
      } else {
        notify.error("Gagal", data.error || "Gagal mengubah status penyelenggara.");
      }
    } catch {
      notify.error("Kendala jaringan", "Gagal menghubungi server.");
    }
  };

  const handleCreateOrganizerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddOrgError("");
    if (!newOrgName.trim() || !newOrgPIC.trim() || !newOrgPhone.trim() || !newOrgEmail.trim()) {
      setAddOrgError("Field nama, PIC, nomor telepon, dan email wajib diisi.");
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
        notify.success("Penyelenggara didaftarkan", `${data.data.name} berhasil disimpan.`);
      } else {
        setAddOrgError(data.error || "Gagal mendaftarkan penyelenggara.");
      }
    } catch {
      setAddOrgError("Terjadi kendala jaringan saat mendaftarkan penyelenggara.");
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
        setActivationModalData({
          organizerName: data.data.organizer?.name || "Penyelenggara",
          organizerEmail: data.data.organizer?.email || "",
          activationUrl: fullUrl,
          expiresAt: data.data.expiresAt,
        });
        notify.success("Tautan dibuat", "Tautan aktivasi siap dibagikan.");
      } else {
        notify.error("Gagal", data.error || "Gagal membuat tautan.");
      }
    } catch {
      notify.error("Kendala jaringan", "Gagal membuat tautan.");
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  const handleCopyActivationLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    notify.success("Tautan disalin", "Tautan aktivasi telah disalin ke clipboard.");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSaveTenantSplits = async () => {
    if (!canEditSettlementPolicy) {
      notify.error(
        "Akses ditolak",
        "Hanya pemilik organisasi atau super admin yang dapat mengubah bagi hasil."
      );
      return;
    }

    let hasError = false;
    const newErrors: Record<string, string> = {};

    Object.values(revenueSplits).forEach((cfg) => {
      if (cfg.tenantSharePercent < 0 || cfg.tenantSharePercent > 100) {
        newErrors[cfg.tenantId] = "Persentase harus antara 0% dan 100%.";
        hasError = true;
      } else if (Math.round(cfg.tenantSharePercent + cfg.dagoSharePercent) !== 100) {
        newErrors[cfg.tenantId] = "Total pembagian (mitra + Dago) harus 100%.";
        hasError = true;
      }
    });

    if (hasError) {
      setRevenueSplitErrors(newErrors);
      return;
    }

    setRevenueSplitErrors({});

    Object.values(revenueSplits).forEach((cfg) => {
      setTenantRevenueSplit(cfg.tenantId, cfg.tenantSharePercent, cfg.dagoSharePercent);
    });
    saveStoredSettlementReceiptPolicy({ settlementBasis, revenueSplits });

    try {
      const res = await fetch("/api/settings/settlement-receipt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settlementBasis, revenueSplits }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        const errMsg = data?.error || "Gagal menyimpan kebijakan bagi hasil ke server.";
        setSplitSaveFeedback("");
        notify.error("Gagal menyimpan bagi hasil", errMsg);
        return;
      }
      if (data.policy) {
        saveStoredSettlementReceiptPolicy(data.policy);
      }
    } catch {
      notify.warning(
        "Tersimpan di browser",
        "Skema bagi hasil tersimpan lokal, tetapi sinkronisasi server belum tercapai."
      );
      return;
    }

    setSplitSaveFeedback("Skema dan dasar bagi hasil mitra F&B diperbarui.");
    notify.success("Bagi hasil disimpan", "Dasar perhitungan dan pembagian mitra diperbarui.");
    setTimeout(() => setSplitSaveFeedback(""), 4000);
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
        setEventPolicyFeedback(`Kebijakan komisi berhasil disimpan (${eventPlatformFee}% Dago).`);
        notify.success("Kebijakan disimpan", "Kebijakan komisi event berhasil diperbarui.");
        updateSettings({ eventRevenueSharing: data.data });
      } else {
        setEventPolicyFeedback(`Error: ${data.error || "Gagal menyimpan."}`);
      }
    } catch {
      setEventPolicyFeedback("Error: Kendala jaringan.");
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
          prev.map((e) => (e.id === eventId ? { ...e, customPlatformFeePercent: customFeePercent } : e)),
        );
        notify.success("Override disimpan", "Komisi khusus event berhasil diperbarui.");
      }
    } catch {
      notify.error("Kendala jaringan", "Gagal menyimpan override.");
    }
  };

  // Wi-Fi Handlers
  const handleSaveWifiRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wifiRuleFormLabel.trim()) {
      setWifiRuleFormError("Nama label aturan wajib diisi.");
      return;
    }
    const minVal = Number(wifiRuleFormMin);
    const maxVal = wifiRuleFormMax.trim() === "" ? undefined : Number(wifiRuleFormMax);
    if (maxVal !== undefined && maxVal <= minVal) {
      setWifiRuleFormError("Maksimum belanja harus lebih besar dari minimum.");
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

    const updatedRules = editingWifiRule
      ? wifiFnBRules.map((r) => (r.id === editingWifiRule.id ? newRule : r))
      : [...wifiFnBRules, newRule];

    const overlap = validateFnBRulesOverlap(updatedRules);
    if (overlap.hasOverlap) {
      setWifiRuleFormError(overlap.errorMessage || "Rentang belanja tumpang-tindih.");
      return;
    }

    saveSimulatedFnBRules(updatedRules);
    setWifiFnBRules(updatedRules);
    setIsWifiRuleModalOpen(false);
    notify.success("Aturan Wi-Fi disimpan", `${newRule.label} siap digunakan.`);
  };

  const handleToggleWifiRuleStatus = (ruleId: string) => {
    const updated = wifiFnBRules.map((r) => (r.id === ruleId ? { ...r, isActive: !r.isActive } : r));
    const overlap = validateFnBRulesOverlap(updated);
    if (overlap.hasOverlap) {
      notify.error("Tidak dapat diaktifkan", overlap.errorMessage || "Rentang tumpang-tindih.");
      return;
    }
    saveSimulatedFnBRules(updated);
    setWifiFnBRules(updated);
  };

  const handleDeleteWifiRule = (ruleId: string) => {
    const updated = wifiFnBRules.filter((r) => r.id !== ruleId);
    saveSimulatedFnBRules(updated);
    setWifiFnBRules(updated);
    notify.success("Aturan Wi-Fi dihapus", "Aturan dihapus dari sistem.");
  };

  const handleRevokeVoucher = (voucherId: string) => {
    revokeSimulatedWifiVoucher(voucherId);
    setWifiVouchers(getSimulatedWifiVouchers());
    notify.success("Voucher dicabut", "Status voucher diubah menjadi dibatalkan.");
  };

  // Save Settings General
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      language,
      timezone,
      currency,
      lowStockThresholdPercent: Number(lowStock),
      taxRatePercent: Number(fnbTaxRate),
      isTaxEnabled: fnbTaxEnabled,
      serviceChargePercent: Number(serviceCharge),
      categoryTax: {
        fnb: {
          taxType: fnbTaxType,
          taxRatePercent: Number(fnbTaxRate),
          isEnabled: fnbTaxEnabled,
        },
        coworking: {
          taxType: cwTaxType,
          taxRatePercent: Number(cwTaxRate),
          isEnabled: cwTaxEnabled,
        },
      },
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
    notify.success("Pengaturan disimpan", "Seluruh konfigurasi platform berhasil disinkronkan.");
  };

  const handleAddHolidayOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOverrideDate) return;
    const newEntry: HolidayOverrideDate = {
      date: newOverrideDate,
      isOpen: newOverrideType === "OPEN",
      type: newOverrideType,
      reason: newOverrideReason.trim() || undefined,
    };
    setCwOverrides((prev) => [...prev.filter((o) => o.date !== newOverrideDate), newEntry]);
    setNewOverrideDate("");
    setNewOverrideReason("");
    notify.success("Tanggal ditambahkan", `Pengecualian tanggal ${newOverrideDate} disimpan.`);
  };

  const handleRemoveHolidayOverride = (dateStr: string) => {
    setCwOverrides((prev) => prev.filter((o) => o.date !== dateStr));
    notify.success("Tanggal dihapus", `Pengecualian tanggal ${dateStr} dihapus.`);
  };

  const handleSaveTenantSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setBankFormError("");
    if (bankAccountNumber.trim() && !bankAccountHolder.trim()) {
      setBankFormError("Nama pemilik rekening wajib diisi.");
      return;
    }
    const currentTenantId = user?.tenant?.id || "tenant-ks";
    saveTenantProfile({
      tenantId: currentTenantId,
      brandName: tenantBrandName.trim(),
      tagline: tenantTagline.trim(),
      description: tenantDesc.trim(),
      contactPhone: tenantPhone.trim(),
      receiptHeader: tenantReceiptHeader.trim(),
      receiptFooter: tenantReceiptFooter.trim(),
      lowStockThresholdPercent: Number(tenantLowStock) || 0,
      bankName: bankName || "BCA",
      bankAccountNumber: bankAccountNumber.trim(),
      bankAccountHolder: bankAccountHolder.trim(),
      status: tenantStatus,
    });
    refreshAllTenantStatuses();
    const updatedTenantOps = {
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
    notify.success("Pengaturan mitra disimpan", `Profil dan status operasional ${tenantBrandName} disimpan.`);
  };

  const handleSaveTenantOperations = async () => {
    setIsSavingTenantOps(true);
    updateSettings({ tenantOperations: tenantOps });
    try {
      const res = await fetch("/api/tenant/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantOperations: tenantOps }),
      });
      if (res.ok) {
        notify.success("Jam operasional disimpan", "Jam buka-tutup mitra tersimpan ke server.");
      } else {
        notify.warning("Penyimpanan lokal berhasil", "Pembaruan tersimpan di browser, gagal sinkronisasi server.");
      }
    } catch {
      notify.warning("Penyimpanan lokal berhasil", "Pembaruan tersimpan di browser, gagal sinkronisasi server.");
    } finally {
      setIsSavingTenantOps(false);
    }
  };

  const myTenantId = user?.tenant?.id || "";
  const persistPromos: React.Dispatch<React.SetStateAction<PromoConfig[]>> = (action) => {
    setPromos((prev) => {
      const next = typeof action === "function" ? action(prev) : action;
      savePromos(next, isTenantOwner ? myTenantId : undefined);
      return next;
    });
  };
  const displayedProducts = filterAndSortProducts(filteredProducts, {
    tenantId: isTenantOwner ? myTenantId : masterTenantFilter,
    category: masterCategoryFilter,
    status: masterStatusFilter,
    searchQuery: masterSearch,
    sortOrder: masterSortOrder,
  });

  if (!canAccessSettings) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center p-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-3">
          <ShieldAlert className="size-6" />
        </div>
        <h2 className="text-lg font-medium text-foreground">Akses dibatasi</h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          Halaman pengaturan hanya dapat diakses oleh Administrator, Pemilik Organisasi, atau Pemilik Mitra.
        </p>
      </div>
    );
  }

  const moduleDefinitions = [
    {
      code: "FNB",
      name: "Food & Beverage (F&B)",
      desc: "Kasir POS, Kitchen Display System (KDS), Inventori, Meja, dan CRM.",
      icon: <Coffee className="size-4" />,
      isRequired: true,
    },
    {
      code: "CO_WORKING",
      name: "Co-working Space & Membership",
      desc: "Meja fleksibel/dedicated, booking ruang rapat, dan paket keanggotaan.",
      icon: <Laptop className="size-4" />,
      isRequired: false,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <PageHeader
        title={isTenantOwner ? "Pengaturan mitra" : "Pengaturan"}
        description={
          isTenantOwner
            ? `Kelola katalog menu, profil gerai, dan rekening pencairan untuk ${tenantBrandName}.`
            : "Pusat konfigurasi master data menu, mitra, ruang kerja, pajak, dan perangkat cetak."
        }
        actions={
          isTenantOwner && tenantActiveTab === "PRODUCTS" ? (
            <Button size="lg" onClick={handleOpenAddProduct}>
              <Plus />
              <span>Tambah menu</span>
            </Button>
          ) : !isTenantOwner && selectedAdminTab === "PRODUCTS" ? (
            <Button size="lg" onClick={handleOpenAddProduct}>
              <Plus />
              <span>Tambah menu</span>
            </Button>
          ) : null}
      />

      {/* Tampilan Khusus Tenant Owner */}
      {isTenantOwner ? (
        <div className="flex flex-col gap-6">
          <Tabs
            value={tenantActiveTab}
            onValueChange={(val) => setTenantActiveTab(val as typeof tenantActiveTab)}
          >
            <TabsList className="w-full justify-start overflow-x-auto no-scrollbar">
              <TabsTrigger value="PRODUCTS" className="gap-1.5">
                <UtensilsCrossed />
                <span>Katalog menu ({displayedProducts.length})</span>
              </TabsTrigger>
              <TabsTrigger value="PROFILE" className="gap-1.5">
                <Store />
                <span>Profil gerai</span>
              </TabsTrigger>
              <TabsTrigger value="PROMOS" className="gap-1.5">
                <Tag />
                <span>Voucher & promo</span>
              </TabsTrigger>
              <TabsTrigger value="ADDONS" className="gap-1.5">
                <Sparkles />
                <span>Add-on gerai</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {tenantActiveTab === "PRODUCTS" ? (
            <ProductsCatalogTab
              products={displayedProducts}
              categories={categories}
              isTenantScope
              searchQuery={masterSearch}
              onSearchChange={setMasterSearch}
              categoryFilter={masterCategoryFilter}
              onCategoryFilterChange={setMasterCategoryFilter}
              statusFilter={masterStatusFilter}
              onStatusFilterChange={setMasterStatusFilter}
              sortOrder={masterSortOrder}
              onSortOrderChange={setMasterSortOrder}
              onToggleStatus={toggleProductStatus}
              onEditProduct={handleOpenEditProduct}
            />
          ) : null}

          {tenantActiveTab === "PROFILE" ? (
            <TenantProfileTab
              tenantBrandName={tenantBrandName}
              onTenantBrandNameChange={setTenantBrandName}
              tenantTagline={tenantTagline}
              onTenantTaglineChange={setTenantTagline}
              tenantDesc={tenantDesc}
              onTenantDescChange={setTenantDesc}
              tenantPhone={tenantPhone}
              onTenantPhoneChange={setTenantPhone}
              tenantReceiptHeader={tenantReceiptHeader}
              onTenantReceiptHeaderChange={setTenantReceiptHeader}
              tenantReceiptFooter={tenantReceiptFooter}
              onTenantReceiptFooterChange={setTenantReceiptFooter}
              tenantLowStock={tenantLowStock}
              onTenantLowStockChange={setTenantLowStock}
              tenantStatus={tenantStatus}
              onTenantStatusChange={setTenantStatusState}
              tenantOpenTime={tenantOpenTime}
              onTenantOpenTimeChange={setTenantOpenTime}
              tenantCloseTime={tenantCloseTime}
              onTenantCloseTimeChange={setTenantCloseTime}
              tenantClosedReason={tenantClosedReason}
              onTenantClosedReasonChange={setTenantClosedReason}
              bankName={bankName}
              onBankNameChange={setBankName}
              bankAccountNumber={bankAccountNumber}
              onBankAccountNumberChange={setBankAccountNumber}
              bankAccountHolder={bankAccountHolder}
              onBankAccountHolderChange={setBankAccountHolder}
              bankFormError={bankFormError}
              onSaveTenantSettings={handleSaveTenantSettings}
            />
          ) : null}

          {tenantActiveTab === "PROMOS" ? (
            <PromosTab
              promos={promos}
              onChangePromos={persistPromos}
              isTenantScope
              tenantId={myTenantId}
              tenants={localTenants}
              categories={categories}
              products={filteredProducts}
              spaces={localSpaces}
              onAddPromo={() => {
                const newCode = `PROMO${Math.floor(10 + Math.random() * 90)}`;
                persistPromos((prev) => [
                  ...prev,
                  {
                    id: `promo-${Date.now()}`,
                    code: newCode,
                    name: "Promo menu mitra",
                    description: "Diskon menu pilihan",
                    discountType: "PERCENTAGE",
                    discountValue: 10,
                    targetType: "ALL",
                    scope: "FNB",
                    tenantId: myTenantId,
                    quota: 50,
                    validFrom: new Date().toISOString().slice(0, 10),
                    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                    isActive: true,
                  },
                ]);
              }}
              isProductModalOpen={isPromoProductModalOpen}
              onProductModalOpenChange={setIsPromoProductModalOpen}
              onOpenPromoProductSelect={(id) => {
                const p = promos.find((item) => item.id === id);
                setActivePromoIdForProductSelect(id);
                setSelectedProductIdsInModal(p?.applicableProductIds || []);
                setIsPromoProductModalOpen(true);
              }}
              selectedProductIdsInModal={selectedProductIdsInModal}
              onToggleModalProduct={(pid) =>
                setSelectedProductIdsInModal((prev) =>
                  prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid],
                )
              }
              onSelectAllModalProducts={(ids) => setSelectedProductIdsInModal(ids)}
              onClearAllModalProducts={() => setSelectedProductIdsInModal([])}
              onSavePromoProducts={() => {
                if (activePromoIdForProductSelect) {
                  persistPromos((prev) =>
                    prev.map((p) =>
                      p.id === activePromoIdForProductSelect
                        ? { ...p, applicableProductIds: selectedProductIdsInModal }
                        : p,
                    ),
                  );
                }
                setIsPromoProductModalOpen(false);
              }}
              onRemoveProductFromPromo={(pId, prodId) =>
                persistPromos((prev) =>
                  prev.map((p) =>
                    p.id === pId
                      ? {
                          ...p,
                          applicableProductIds: (p.applicableProductIds || []).filter((id) => id !== prodId),
                        }
                      : p,
                  ),
                )
              }
              modalSearch={promoProductSearch}
              onModalSearchChange={setPromoProductSearch}
              modalCategoryFilter={promoProductCategoryFilter}
              onModalCategoryFilterChange={setPromoProductCategoryFilter}
              modalTenantFilter={promoProductTenantFilter}
              onModalTenantFilterChange={setPromoProductTenantFilter}
            />
          ) : null}

          {tenantActiveTab === "ADDONS" ? (
            <SubscriptionTab
              orgSub={orgSub}
              tenantAddons={tenantAddons}
              outletsCount={outlets.length}
              isSuperAdmin={false}
              onSelectPlanTier={(tier) => {
                setSimulatedOrgPlan(tier);
                setOrgSub(getSimulatedOrgSubscription());
              }}
              onToggleAddon={(code) => {
                const scopeKey = myTenantId || "tenant-unassigned";
                setTenantAddons(toggleSimulatedTenantAddon(code, scopeKey));
              }}
            />
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <Tabs
            value={selectedAdminTab}
            onValueChange={setSelectedAdminTab}
          >
            <TabsList className="w-full justify-start overflow-x-auto no-scrollbar">
              <TabsTrigger value="PRODUCTS" className="gap-1.5">
                <UtensilsCrossed />
                <span>Menu & kategori</span>
              </TabsTrigger>
              <TabsTrigger value="PARTNERS" className="gap-1.5">
                <Store />
                <span>Mitra & bagi hasil</span>
              </TabsTrigger>
              <TabsTrigger value="SPACES_TABLES" className="gap-1.5">
                <Laptop />
                <span>Ruang & meja</span>
              </TabsTrigger>
              <TabsTrigger value="PROMOS" className="gap-1.5">
                <Tag />
                <span>Voucher & promo</span>
              </TabsTrigger>
              <TabsTrigger value="CONFIG" className="gap-1.5">
                <Settings />
                <span>Platform & pajak</span>
              </TabsTrigger>
              <TabsTrigger value="SUBSCRIPTION" className="gap-1.5">
                <Sparkles />
                <span>Paket & add-on</span>
              </TabsTrigger>
              <TabsTrigger value="WIFI" className="gap-1.5">
                <Wifi />
                <span>Manajemen Wi-Fi</span>
              </TabsTrigger>
              <TabsTrigger value="PRINTER" className="gap-1.5">
                <Printer />
                <span>Printer & nota POS</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {selectedAdminTab === "PRODUCTS" ? (
            <ProductsCatalogTab
              products={displayedProducts}
              categories={categories}
              tenants={localTenants}
              searchQuery={masterSearch}
              onSearchChange={setMasterSearch}
              tenantFilter={masterTenantFilter}
              onTenantFilterChange={setMasterTenantFilter}
              categoryFilter={masterCategoryFilter}
              onCategoryFilterChange={setMasterCategoryFilter}
              statusFilter={masterStatusFilter}
              onStatusFilterChange={setMasterStatusFilter}
              sortOrder={masterSortOrder}
              onSortOrderChange={setMasterSortOrder}
              onToggleStatus={toggleProductStatus}
              onEditProduct={handleOpenEditProduct}
              onOpenAddCategory={() => setIsAddCatModalOpen(true)}
              resolveTenantName={(tId) => localTenants.find((t) => t.id === tId)?.name || getTenantName(tId) || "—"}
            />
          ) : null}

          {selectedAdminTab === "PARTNERS" ? (
            <PartnersAdminTab
              partnerSubTab={partnerSubTab}
              onPartnerSubTabChange={setPartnerSubTab}
              partnerTypeFilter={partnerTypeFilter}
              onPartnerTypeFilterChange={setPartnerTypeFilter}
              partnerStatusFilter={partnerStatusFilter}
              onPartnerStatusFilterChange={setPartnerStatusFilter}
              partnerSearchQuery={partnerSearchQuery}
              onPartnerSearchQueryChange={setPartnerSearchQuery}
              localTenants={localTenants}
              allTenantStatuses={allTenantStatuses}
              organizers={organizers}
              onOpenAddOrganizer={() => setIsAddOrganizerModalOpen(true)}
              onOpenAddTenant={() => setIsAddTenantModalOpen(true)}
              onSelectPartnerDetail={setSelectedPartnerDetail}
              onToggleOrganizerStatus={handleToggleOrganizerStatus}
              onGenerateActivationLink={handleGenerateActivationLink}
              isGeneratingInvite={isGeneratingInvite}
              tenantOps={tenantOps}
              onUpdateTenantOperation={(tId, field, val) => {
                setTenantOps((prev) => ({
                  ...prev,
                  [tId]: {
                    ...prev[tId],
                    tenantId: tId,
                    tenantName: localTenants.find((t) => t.id === tId)?.name || tId,
                    isAcceptingOrders: prev[tId]?.isAcceptingOrders ?? true,
                    openTime: prev[tId]?.openTime || "08:00",
                    closeTime: prev[tId]?.closeTime || "21:00",
                    [field]: val,
                  },
                }));
              }}
              onToggleTenantOrderStatus={async (tId, name, next) => {
                const nextManualOverride: "OPEN" | "CLOSED" = next ? "OPEN" : "CLOSED";
                const currentOp = tenantOps[tId] || {
                  tenantId: tId,
                  tenantName: name,
                  openTime: "08:00",
                  closeTime: "21:00",
                };
                const updated = {
                  ...tenantOps,
                  [tId]: {
                    ...currentOp,
                    tenantId: tId,
                    tenantName: name,
                    isOpenOrder: next,
                    isAcceptingOrders: next,
                    manualOverride: nextManualOverride,
                  },
                };
                setTenantOps(updated);
                setTenantStatus(tId, next ? "ACTIVE" : "INACTIVE");
                refreshAllTenantStatuses();

                updateSettings({ tenantOperations: updated });

                try {
                  await fetch("/api/tenant/operations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tenantOperations: updated }),
                  });
                } catch {}

                notify.success(
                  "Status pesanan diubah",
                  `${name}: ${next ? "Buka (override manual)" : "Tutup sementara (override manual)"}.`
                );
              }}
              onSaveTenantOperations={handleSaveTenantOperations}
              isSavingTenantOperations={isSavingTenantOps}
              revenueSplits={revenueSplits}
              revenueSplitErrors={revenueSplitErrors}
              splitSaveFeedback={splitSaveFeedback}
              settlementBasis={settlementBasis}
              onSettlementBasisChange={setSettlementBasis}
              canEditSettlementPolicy={canEditSettlementPolicy}
              onTenantSplitChange={(tId, share) => {
                setRevenueSplits((prev) => ({
                  ...prev,
                  [tId]: {
                    tenantId: tId,
                    tenantName: localTenants.find((t) => t.id === tId)?.name || tId,
                    tenantSharePercent: share,
                    dagoSharePercent: 100 - share,
                    status: "ACTIVE",
                  },
                }));
              }}
              onSaveTenantSplits={handleSaveTenantSplits}
              eventPlatformFee={eventPlatformFee}
              onEventPlatformFeeChange={setEventPlatformFee}
              eventPolicyEffectiveDate={eventPolicyEffectiveDate}
              onEventPolicyEffectiveDateChange={setEventPolicyEffectiveDate}
              eventPolicyNotes={eventPolicyNotes}
              onEventPolicyNotesChange={setEventPolicyNotes}
              eventPolicyFeedback={eventPolicyFeedback}
              isSavingEventPolicy={isSavingEventPolicy}
              onSaveEventRevenuePolicy={handleSaveEventRevenuePolicy}
              eventSimTicketPrice={eventSimTicketPrice}
              onEventSimTicketPriceChange={setEventSimTicketPrice}
              eventSimTicketQty={eventSimTicketQty}
              onEventSimTicketQtyChange={setEventSimTicketQty}
              activeAdminEvents={activeAdminEvents}
              eventOverrides={eventOverrides}
              onEventOverrideDraftChange={(eId, val) => setEventOverrides((prev) => ({ ...prev, [eId]: val }))}
              onSaveEventOverride={handleSaveEventOverride}
              eventPolicyHistory={eventPolicyHistory}
            />
          ) : null}

          {selectedAdminTab === "SPACES_TABLES" ? (
            <SpacesAndTablesTab
              spaces={localSpaces}
              plans={cwPlans}
              tables={allTables}
              onOpenAddSpace={() => {
                setFormSpaceName("");
                setFormSpaceType("HOT_DESK");
                setFormSpaceArea("Ground Floor Main");
                setFormSpaceCap(4);
                setFormSpaceHourly(15000);
                setFormSpaceDaily(65000);
                setFormSpaceStatus("AVAILABLE");
                setIsAddSpaceModalOpen(true);
              }}
              onOpenEditSpace={(sp) => {
                setEditingSpace(sp);
                setFormSpaceName(sp.name);
                setFormSpaceType(sp.type || "HOT_DESK");
                setFormSpaceArea(sp.area || "Ground Floor Main");
                setFormSpaceCap(sp.capacity || 1);
                setFormSpaceHourly(sp.hourlyRate || 15000);
                setFormSpaceDaily(sp.dailyRate || 65000);
                setFormSpaceStatus(sp.status || "AVAILABLE");
                setIsEditSpaceModalOpen(true);
              }}
              onRequestDeleteSpace={(sp) => {
                setDeletingSpace(sp);
                setIsDeleteSpaceOpen(true);
              }}
              isAddSpaceOpen={isAddSpaceModalOpen}
              onAddSpaceOpenChange={setIsAddSpaceModalOpen}
              isEditSpaceOpen={isEditSpaceModalOpen}
              onEditSpaceOpenChange={setIsEditSpaceModalOpen}
              isDeleteSpaceOpen={isDeleteSpaceOpen}
              onDeleteSpaceOpenChange={setIsDeleteSpaceOpen}
              deletingSpace={deletingSpace}
              formSpaceName={formSpaceName}
              onFormSpaceNameChange={setFormSpaceName}
              formSpaceType={formSpaceType}
              onFormSpaceTypeChange={setFormSpaceType}
              formSpaceArea={formSpaceArea}
              onFormSpaceAreaChange={setFormSpaceArea}
              formSpaceCap={formSpaceCap}
              onFormSpaceCapChange={setFormSpaceCap}
              formSpaceHourly={formSpaceHourly}
              onFormSpaceHourlyChange={setFormSpaceHourly}
              formSpaceDaily={formSpaceDaily}
              onFormSpaceDailyChange={setFormSpaceDaily}
              formSpaceStatus={formSpaceStatus}
              onFormSpaceStatusChange={setFormSpaceStatus}
              onSaveNewSpace={handleSaveNewSpace}
              onSaveEditSpace={handleSaveEditSpace}
              onConfirmDeleteSpace={handleConfirmDeleteSpace}
              onOpenAddPlan={() => {
                setFormPlanName("");
                setFormPlanCycle("Bulanan");
                setFormPlanPrice(500000);
                setFormPlanDeskAccess("Akses Hot Desk Bebas Pakai");
                setIsAddPlanModalOpen(true);
              }}
              onOpenEditPlan={(pl) => {
                setEditingPlan(pl);
                setFormPlanName(pl.name);
                setFormPlanCycle(pl.billingCycle || "Bulanan");
                setFormPlanPrice(pl.priceNumber || 500000);
                setFormPlanDeskAccess(pl.deskAccess || "");
                setIsEditPlanModalOpen(true);
              }}
              onRequestDeletePlan={(pl) => {
                setDeletingPlan(pl);
                setIsDeletePlanOpen(true);
              }}
              isAddPlanOpen={isAddPlanModalOpen}
              onAddPlanOpenChange={setIsAddPlanModalOpen}
              isEditPlanOpen={isEditPlanModalOpen}
              onEditPlanOpenChange={setIsEditPlanModalOpen}
              isDeletePlanOpen={isDeletePlanOpen}
              onDeletePlanOpenChange={setIsDeletePlanOpen}
              deletingPlan={deletingPlan}
              formPlanName={formPlanName}
              onFormPlanNameChange={setFormPlanName}
              formPlanCycle={formPlanCycle}
              onFormPlanCycleChange={setFormPlanCycle}
              formPlanPrice={formPlanPrice}
              onFormPlanPriceChange={setFormPlanPrice}
              formPlanDeskAccess={formPlanDeskAccess}
              onFormPlanDeskAccessChange={setFormPlanDeskAccess}
              onSaveNewPlan={handleSaveNewPlan}
              onSaveEditPlan={handleSaveEditPlan}
              onConfirmDeletePlan={handleConfirmDeletePlan}
              onOpenAddTable={() => {
                setFormTableNumber(allTables.length + 1);
                setFormTableArea("Main Hall");
                setFormTableCap(4);
                setFormTableStatus("AVAILABLE");
                setIsAddTableModalOpen(true);
              }}
              onOpenEditTable={(tbl) => {
                setEditingTable(tbl);
                setFormTableNumber(Number(tbl.number) || 1);
                setFormTableArea(tbl.areaName || "Main Hall");
                setFormTableCap(tbl.cap || 4);
                setFormTableStatus(tbl.status || "AVAILABLE");
                setIsEditTableModalOpen(true);
              }}
              onRequestDeleteTable={(tbl) => {
                setDeletingTable(tbl);
                setIsDeleteTableOpen(true);
              }}
              onToggleTableStatus={handleToggleTableStatus}
              isAddTableOpen={isAddTableModalOpen}
              onAddTableOpenChange={setIsAddTableModalOpen}
              isEditTableOpen={isEditTableModalOpen}
              onEditTableOpenChange={setIsEditTableModalOpen}
              isDeleteTableOpen={isDeleteTableOpen}
              onDeleteTableOpenChange={setIsDeleteTableOpen}
              deletingTable={deletingTable}
              formTableNumber={formTableNumber}
              onFormTableNumberChange={setFormTableNumber}
              formTableArea={formTableArea}
              onFormTableAreaChange={setFormTableArea}
              formTableCap={formTableCap}
              onFormTableCapChange={setFormTableCap}
              formTableStatus={formTableStatus}
              onFormTableStatusChange={setFormTableStatus}
              onSaveNewTable={handleSaveNewTable}
              onSaveEditTable={handleSaveEditTable}
              onConfirmDeleteTable={handleConfirmDeleteTable}
            />
          ) : null}

          {selectedAdminTab === "PROMOS" ? (
            <PromosTab
              promos={promos}
              onChangePromos={persistPromos}
              tenants={localTenants}
              categories={categories}
              products={filteredProducts}
              spaces={localSpaces}
              onAddPromo={() => {
                const newCode = `PROMO${Math.floor(10 + Math.random() * 90)}`;
                persistPromos((prev) => [
                  ...prev,
                  {
                    id: `promo-${Date.now()}`,
                    code: newCode,
                    name: "Promo spesial",
                    description: "Diskon transaksi",
                    discountType: "PERCENTAGE",
                    discountValue: 10,
                    targetType: "ALL",
                    scope: "ALL",
                    quota: 50,
                    validFrom: new Date().toISOString().slice(0, 10),
                    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                    isActive: true,
                  },
                ]);
              }}
              isProductModalOpen={isPromoProductModalOpen}
              onProductModalOpenChange={setIsPromoProductModalOpen}
              onOpenPromoProductSelect={(id) => {
                const p = promos.find((item) => item.id === id);
                setActivePromoIdForProductSelect(id);
                setSelectedProductIdsInModal(p?.applicableProductIds || []);
                setIsPromoProductModalOpen(true);
              }}
              selectedProductIdsInModal={selectedProductIdsInModal}
              onToggleModalProduct={(pid) =>
                setSelectedProductIdsInModal((prev) =>
                  prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid],
                )
              }
              onSelectAllModalProducts={(ids) => setSelectedProductIdsInModal(ids)}
              onClearAllModalProducts={() => setSelectedProductIdsInModal([])}
              onSavePromoProducts={() => {
                if (activePromoIdForProductSelect) {
                  persistPromos((prev) =>
                    prev.map((p) =>
                      p.id === activePromoIdForProductSelect
                        ? { ...p, applicableProductIds: selectedProductIdsInModal }
                        : p,
                    ),
                  );
                }
                setIsPromoProductModalOpen(false);
              }}
              onRemoveProductFromPromo={(pId, prodId) =>
                persistPromos((prev) =>
                  prev.map((p) =>
                    p.id === pId
                      ? {
                          ...p,
                          applicableProductIds: (p.applicableProductIds || []).filter((id) => id !== prodId),
                        }
                      : p,
                  ),
                )
              }
              modalSearch={promoProductSearch}
              onModalSearchChange={setPromoProductSearch}
              modalCategoryFilter={promoProductCategoryFilter}
              onModalCategoryFilterChange={setPromoProductCategoryFilter}
              modalTenantFilter={promoProductTenantFilter}
              onModalTenantFilterChange={setPromoProductTenantFilter}
            />
          ) : null}

          {selectedAdminTab === "CONFIG" ? (
            <PlatformConfigTab
              moduleDefinitions={moduleDefinitions}
              activeOrgModules={activeOrgModules}
              onToggleOrgModule={(code) => toggleOrgModule(code as any)}
              language={language}
              onLanguageChange={setLanguage}
              timezone={timezone}
              onTimezoneChange={setTimezone}
              currency={currency}
              onCurrencyChange={setCurrency}
              fnbTaxEnabled={fnbTaxEnabled}
              onFnbTaxEnabledChange={setFnbTaxEnabled}
              fnbTaxRate={fnbTaxRate}
              onFnbTaxRateChange={setFnbTaxRate}
              cwTaxEnabled={cwTaxEnabled}
              onCwTaxEnabledChange={setCwTaxEnabled}
              cwTaxType={cwTaxType}
              onCwTaxTypeChange={setCwTaxType}
              cwTaxRate={cwTaxRate}
              onCwTaxRateChange={setCwTaxRate}
              serviceCharge={serviceCharge}
              onServiceChargeChange={setServiceCharge}
              lowStock={lowStock}
              onLowStockChange={setLowStock}
              silverPts={silverPts}
              onSilverPtsChange={setSilverPts}
              goldPts={goldPts}
              onGoldPtsChange={setGoldPts}
              platPts={platPts}
              onPlatPtsChange={setPlatPts}
              cwOpenTime={cwOpenTime}
              onCwOpenTimeChange={setCwOpenTime}
              cwCloseTime={cwCloseTime}
              onCwCloseTimeChange={setCwCloseTime}
              fnbOpenTime={fnbOpenTime}
              onFnbOpenTimeChange={setFnbOpenTime}
              fnbCloseTime={fnbCloseTime}
              onFnbCloseTimeChange={setFnbCloseTime}
              cwWeekendClosed={cwWeekendClosed}
              onCwWeekendClosedChange={setCwWeekendClosed}
              cwNationalHolidaysClosed={cwNationalHolidaysClosed}
              onCwNationalHolidaysClosedChange={setCwNationalHolidaysClosed}
              cwOverrides={cwOverrides}
              newOverrideDate={newOverrideDate}
              onNewOverrideDateChange={setNewOverrideDate}
              newOverrideType={newOverrideType}
              onNewOverrideTypeChange={setNewOverrideType}
              newOverrideReason={newOverrideReason}
              onNewOverrideReasonChange={setNewOverrideReason}
              onAddHolidayOverride={handleAddHolidayOverride}
              onRemoveHolidayOverride={handleRemoveHolidayOverride}
              onSaveSettings={handleSaveSettings}
            />
          ) : null}

          {selectedAdminTab === "SUBSCRIPTION" ? (
            <SubscriptionTab
              orgSub={orgSub}
              tenantAddons={tenantAddons}
              outletsCount={outlets.length}
              isSuperAdmin={isSuperAdmin}
              onSelectPlanTier={(tier) => {
                setSimulatedOrgPlan(tier);
                setOrgSub(getSimulatedOrgSubscription());
              }}
              onToggleAddon={(code) => {
                setTenantAddons(toggleSimulatedTenantAddon(code, "org-dago-hub"));
              }}
            />
          ) : null}

          {selectedAdminTab === "WIFI" ? (
            <WifiManagementTab
              fnBRules={wifiFnBRules}
              cwRules={wifiCwRules}
              vouchers={wifiVouchers}
              networkConfig={wifiNetworkConfig}
              calcBasis={wifiCalcBasis}
              onChangeCalcBasis={(basis) => {
                setWifiCalcBasis(basis);
                setSimulatedWifiCalcBasis(basis);
                notify.success("Basis diubah", `Basis perhitungan diatur ke ${basis === "GRAND_TOTAL" ? "Grand total" : "Net sales"}.`);
              }}
              onOpenAddRule={() => {
                setEditingWifiRule(null);
                setWifiRuleFormLabel("Paket 1 jam");
                setWifiRuleFormMin(50000);
                setWifiRuleFormMax("");
                setWifiRuleFormDuration(60);
                setWifiRuleFormBandwidthDown(15);
                setWifiRuleFormBandwidthUp(5);
                setWifiRuleFormNotes("");
                setWifiRuleFormError("");
                setIsWifiRuleModalOpen(true);
              }}
              onOpenEditRule={(rule) => {
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
              }}
              onToggleRuleStatus={handleToggleWifiRuleStatus}
              onDeleteRule={handleDeleteWifiRule}
              isRuleModalOpen={isWifiRuleModalOpen}
              onRuleModalOpenChange={setIsWifiRuleModalOpen}
              editingRule={editingWifiRule}
              ruleFormLabel={wifiRuleFormLabel}
              onRuleFormLabelChange={setWifiRuleFormLabel}
              ruleFormMin={wifiRuleFormMin}
              onRuleFormMinChange={setWifiRuleFormMin}
              ruleFormMax={wifiRuleFormMax}
              onRuleFormMaxChange={setWifiRuleFormMax}
              ruleFormDuration={wifiRuleFormDuration}
              onRuleFormDurationChange={setWifiRuleFormDuration}
              ruleFormBandwidthDown={wifiRuleFormBandwidthDown}
              onRuleFormBandwidthDownChange={setWifiRuleFormBandwidthDown}
              ruleFormBandwidthUp={wifiRuleFormBandwidthUp}
              onRuleFormBandwidthUpChange={setWifiRuleFormBandwidthUp}
              ruleFormNotes={wifiRuleFormNotes}
              onRuleFormNotesChange={setWifiRuleFormNotes}
              ruleFormError={wifiRuleFormError}
              onSaveRule={handleSaveWifiRule}
              voucherServiceFilter={wifiServiceFilter}
              onVoucherServiceFilterChange={setWifiServiceFilter}
              voucherStatusFilter={wifiStatusFilter}
              onVoucherStatusFilterChange={setWifiStatusFilter}
              voucherSearchQuery={wifiSearchQuery}
              onVoucherSearchQueryChange={setWifiSearchQuery}
              onRevokeVoucher={handleRevokeVoucher}
            />
          ) : null}

          {selectedAdminTab === "PRINTER" ? <PrinterSettingsTab /> : null}
        </div>
      )}

      {/* Modal-modal CRUD Master Product */}
      <ProductModals
        tenants={localTenants}
        categories={categories}
        isTenantScope={isTenantOwner}
        isAddOpen={isAddProdModalOpen}
        onAddOpenChange={setIsAddProdModalOpen}
        isEditOpen={isEditProdModalOpen}
        onEditOpenChange={setIsEditProdModalOpen}
        editingProduct={editingProd}
        isDeleteOpen={isDeleteProdModalOpen}
        onDeleteOpenChange={setIsDeleteProdModalOpen}
        deletingProduct={deletingProd}
        onRequestDeleteFromEdit={(p) => {
          setDeletingProd(p);
          setIsEditProdModalOpen(false);
          setIsDeleteProdModalOpen(true);
        }}
        isAddCategoryOpen={isAddCatModalOpen}
        onAddCategoryOpenChange={setIsAddCatModalOpen}
        formName={formProdName}
        onFormNameChange={setFormProdName}
        formCategory={formProdCat}
        onFormCategoryChange={setFormProdCat}
        formTenantId={formProdTenantId}
        onFormTenantIdChange={setFormProdTenantId}
        formPrice={formProdPrice}
        onFormPriceChange={setFormProdPrice}
        formCogs={formProdCogs}
        onFormCogsChange={setFormProdCogs}
        formDesc={formProdDesc}
        onFormDescChange={setFormProdDesc}
        formImg={formProdImg}
        onFormImgChange={setFormProdImg}
        formStatus={formProdStatus}
        onFormStatusChange={setFormProdStatus}
        newCategoryName={formNewCatName}
        onNewCategoryNameChange={setFormNewCatName}
        onImageFileUpload={handleImageFileUpload}
        onSaveNewProduct={handleSaveNewProduct}
        onSaveEditProduct={handleSaveEditProduct}
        onConfirmDeleteProduct={handleConfirmDeleteProduct}
        onSaveNewCategory={handleSaveNewCategory}
      />

      {/* Modal-modal Partner & Penyelenggara */}
      <PartnerModals
        isAddTenantOpen={isAddTenantModalOpen}
        onAddTenantOpenChange={setIsAddTenantModalOpen}
        formTenantName={formTenantName}
        onFormTenantNameChange={setFormTenantName}
        formTenantCode={formTenantCode}
        onFormTenantCodeChange={setFormTenantCode}
        formTenantBadge={formTenantBadge}
        onFormTenantBadgeChange={setFormTenantBadge}
        onSaveNewTenant={handleSaveNewTenant}
        isAddOrgOpen={isAddOrganizerModalOpen}
        onAddOrgOpenChange={setIsAddOrganizerModalOpen}
        newOrgName={newOrgName}
        onNewOrgNameChange={setNewOrgName}
        newOrgCategory={newOrgCategory}
        onNewOrgCategoryChange={setNewOrgCategory}
        newOrgPIC={newOrgPIC}
        onNewOrgPICChange={setNewOrgPIC}
        newOrgPhone={newOrgPhone}
        onNewOrgPhoneChange={setNewOrgPhone}
        newOrgEmail={newOrgEmail}
        onNewOrgEmailChange={setNewOrgEmail}
        newOrgNotes={newOrgNotes}
        onNewOrgNotesChange={setNewOrgNotes}
        newOrgStatus={newOrgStatus}
        onNewOrgStatusChange={setNewOrgStatus}
        addOrgError={addOrgError}
        isSubmittingOrg={isSubmittingOrg}
        onCreateOrganizerSubmit={handleCreateOrganizerSubmit}
        activationModalData={activationModalData}
        onCloseActivationModal={() => setActivationModalData(null)}
        copiedLink={copiedLink}
        onCopyActivationLink={handleCopyActivationLink}
        selectedPartner={selectedPartnerDetail}
        onClosePartnerDetail={() => setSelectedPartnerDetail(null)}
        onToggleOrganizerStatus={handleToggleOrganizerStatus}
        onGenerateActivationLink={handleGenerateActivationLink}
        isGeneratingInvite={isGeneratingInvite}
      />
    </div>
  );
}
