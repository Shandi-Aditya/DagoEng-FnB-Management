"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useOutlet } from "@/contexts/OutletContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { PromoConfig, PromoType, TargetType } from "@/lib/promo";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getTenantStatus,
  setTenantStatus,
  DEFAULT_FNB_TENANTS,
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

export default function SettingsPage() {
  const { user, activeOrgModules, toggleOrgModule } = useAuth();
  const { filteredProducts, categories, addProduct, updateProduct, deleteProduct, toggleProductStatus, addCategory } = useProducts();
  const { spaces: cwSpaces } = useCoworking();
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

  // Promos
  const [promos, setPromos] = useState<PromoConfig[]>(settings.promos || []);

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

  // Master Data Tabs & Filters State
  const [selectedMasterTab, setSelectedMasterTab] = useState("Produk & Kategori");
  const [tenantActiveTab, setTenantActiveTab] = useState<"PRODUCTS" | "PROFILE">("PRODUCTS");
  const [masterTenantFilter, setMasterTenantFilter] = useState<string>("ALL");
  const [masterCategoryFilter, setMasterCategoryFilter] = useState<string>("ALL");
  const [masterSearch, setMasterSearch] = useState<string>("");
  const [masterToast, setMasterToast] = useState<string>("");

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

  // Local Coworking Spaces for Master Data
  const [localSpaces, setLocalSpaces] = useState<any[]>(cwSpaces);
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
    const newSpace = {
      id: `sp-${Date.now()}`,
      name: formSpaceName.trim(),
      type: formSpaceType as any,
      area: formSpaceArea,
      capacity: Number(formSpaceCap) || 1,
      hourlyRate: Number(formSpaceHourly) || 15000,
      dailyRate: Number(formSpaceDaily) || 65000,
      status: formSpaceStatus as any,
      imageUrl: formSpaceImg.trim() || undefined,
      amenities: ["WiFi 100Mbps", "Power Hub", "Air Conditioner"],
    };
    setLocalSpaces((prev) => [...prev, newSpace]);
    setIsAddSpaceModalOpen(false);
    showMasterToast(`Ruang "${newSpace.name}" berhasil ditambahkan ke Master Data.`);
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
    setLocalSpaces((prev) =>
      prev.map((s) =>
        s.id === editingSpace.id
          ? {
            ...s,
            name: formSpaceName.trim(),
            type: formSpaceType as any,
            area: formSpaceArea,
            capacity: Number(formSpaceCap) || 1,
            hourlyRate: Number(formSpaceHourly) || 15000,
            dailyRate: Number(formSpaceDaily) || 65000,
            status: formSpaceStatus as any,
            imageUrl: formSpaceImg.trim() || undefined,
          }
          : s
      )
    );
    setIsEditSpaceModalOpen(false);
    setEditingSpace(null);
    showMasterToast(`Perubahan ruang "${formSpaceName}" berhasil disimpan.`);
  };

  const handleConfirmDeleteSpace = () => {
    if (!deletingSpace) return;
    setLocalSpaces((prev) => prev.filter((s) => s.id !== deletingSpace.id));
    setIsDeleteSpaceModalOpen(false);
    setDeletingSpace(null);
    showMasterToast(`Ruang "${deletingSpace.name}" berhasil dihapus.`);
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
  ];

  // Filtered Master Products
  const displayedMasterProducts = filteredProducts.filter((p) => {
    const matchTenant = masterTenantFilter === "ALL" || p.tenantId === masterTenantFilter;
    const matchCategory = masterCategoryFilter === "ALL" || p.category === masterCategoryFilter;
    const matchSearch =
      p.name.toLowerCase().includes(masterSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(masterSearch.toLowerCase()) ||
      (p.tenantId && getTenantName(p.tenantId)?.toLowerCase().includes(masterSearch.toLowerCase()));
    return matchTenant && matchCategory && matchSearch;
  });

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
  }, []);

  useEffect(() => {
    if (!isTenantOwner) return;
    try {
      const currentTenantId = user?.tenant?.id || "tenant-ks";
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
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
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
  const myTenantId = user?.tenant?.id || "tenant-ks";
  const myTenantProducts = filteredProducts.filter((p) => p.tenantId === myTenantId);
  const displayedMyTenantProducts = myTenantProducts.filter((p) => {
    const matchCategory = masterCategoryFilter === "ALL" || p.category === masterCategoryFilter;
    const matchSearch =
      p.name.toLowerCase().includes(masterSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(masterSearch.toLowerCase());
    return matchCategory && matchSearch;
  });

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
          <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setTenantActiveTab("PRODUCTS")}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${tenantActiveTab === "PRODUCTS"
                ? "bg-brand-orange text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span>🏷️ Katalog Menu & Produk Mitra ({myTenantProducts.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setTenantActiveTab("PROFILE")}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${tenantActiveTab === "PROFILE"
                ? "bg-brand-orange text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              <Store className="w-4 h-4" />
              <span>⚙️ Profil Bisnis & Rekening Mitra</span>
            </button>
          </div>

          {tenantActiveTab === "PRODUCTS" ? (
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
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isAct
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : "bg-rose-100 text-rose-800 border-rose-300"
                                  }`}
                              >
                                {isAct ? "AKTIF" : "NON-AKTIF"}
                              </span>
                            </td>
                            <td className="py-3 text-right space-x-1.5">
                              <Button
                                size="sm"
                                type="button"
                                variant="outline"
                                onClick={() => handleOpenEditProduct(p)}
                                className="h-7 text-xs font-bold px-2 border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg"
                                title="Edit data master produk"
                              >
                                <Edit2 className="w-3 h-3 mr-1 text-slate-600" />
                                <span>Edit</span>
                              </Button>

                              <Button
                                size="sm"
                                type="button"
                                variant="outline"
                                onClick={() => toggleProductStatus(p.id)}
                                className={`h-7 text-xs font-bold px-2 rounded-lg ${isAct
                                  ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                                  : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                  }`}
                                title="Ubah status ketersediaan"
                              >
                                <Power className="w-3 h-3 mr-1" />
                                <span>{isAct ? "Matikan" : "Aktifkan"}</span>
                              </Button>

                              <Button
                                size="sm"
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setDeletingProd(p);
                                  setIsDeleteProdModalOpen(true);
                                }}
                                className="h-7 text-xs font-bold px-2 border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg"
                                title="Hapus produk dari master data"
                              >
                                <Trash2 className="w-3 h-3" />
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
          ) : (
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
                          <span className="text-base">🔴</span>
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
                    <p className="font-semibold text-slate-700">⚡ Sinkronisasi Real-time:</p>
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
                    <p className="font-semibold text-slate-700">📌 Catatan Operasional & Keamanan:</p>
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
            <div className="flex items-center space-x-2 overflow-x-auto p-3 bg-white scrollbar-thin border-b border-slate-100">
              {MASTER_DATA_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setSelectedMasterTab(tab)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${selectedMasterTab === tab
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                    }`}
                >
                  {tab}
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
                                <span className="bg-orange-50 text-orange-800 border border-orange-200 px-2 py-0.5 rounded-md text-[11px] font-bold">
                                  {tName}
                                </span>
                              </td>
                              <td className="py-3 font-medium text-slate-600">{p.category}</td>
                              <td className="py-3 font-mono font-bold text-slate-900">{formatCurrencyIDR(p.basePrice)}</td>
                              <td className="py-3 font-mono text-slate-500">{formatCurrencyIDR(p.cogsEstimate || 0)}</td>
                              <td className="py-3">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isAct
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                    : "bg-rose-100 text-rose-800 border-rose-300"
                                    }`}
                                >
                                  {isAct ? "AKTIF" : "NON-AKTIF"}
                                </span>
                              </td>
                              <td className="py-3 text-right space-x-1.5">
                                <Button
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                  onClick={() => handleOpenEditProduct(p)}
                                  className="h-7 text-xs font-bold px-2 border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg"
                                  title="Edit data master produk"
                                >
                                  <Edit2 className="w-3 h-3 mr-1 text-slate-600" />
                                  <span>Edit</span>
                                </Button>

                                <Button
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                  onClick={() => toggleProductStatus(p.id)}
                                  className={`h-7 text-xs font-bold px-2 rounded-lg ${isAct
                                    ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                                    : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                    }`}
                                  title="Ubah status ketersediaan"
                                >
                                  <Power className="w-3 h-3 mr-1" />
                                  <span>{isAct ? "Matikan" : "Aktifkan"}</span>
                                </Button>

                                <Button
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    setDeletingProd(p);
                                    setIsDeleteProdModalOpen(true);
                                  }}
                                  className="h-7 text-xs font-bold px-2 border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg"
                                  title="Hapus produk dari master data"
                                >
                                  <Trash2 className="w-3 h-3" />
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

            {/* TAB 2: MITRA & BAGI HASIL */}
            {selectedMasterTab === "Mitra & Bagi Hasil" && (
              <div className="p-4 space-y-6">
                {/* Mitra Status Table */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wide flex items-center space-x-2">
                      <Store className="w-4 h-4 text-brand-orange" />
                      <span>Daftar Mitra F&B & Status Operasional</span>
                    </h4>
                  </div>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                      <thead className="bg-slate-50">
                        <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                          <th className="p-3 font-bold">Mitra F&B</th>
                          <th className="p-3 font-bold">Kode Merchant</th>
                          <th className="p-3 font-bold">Kategori Layanan</th>
                          <th className="p-3 font-bold">Status Operasional</th>
                          <th className="p-3 font-bold text-right">Aksi Buka / Tutup</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                        {localTenants.map((t) => {
                          const status = allTenantStatuses[t.id] || "ACTIVE";
                          const isAct = status === "ACTIVE";
                          return (
                            <tr key={t.id} className="hover:bg-slate-50/50">
                              <td className="p-3 font-bold text-slate-900 flex items-center space-x-2">
                                <Store className="w-3.5 h-3.5 text-brand-orange" />
                                <span>{t.name}</span>
                                <span className="text-[10px] text-slate-500 font-normal">({t.badge})</span>
                              </td>
                              <td className="p-3 font-mono text-slate-500">{t.code}</td>
                              <td className="p-3 font-medium text-slate-600">Food & Beverage (F&B)</td>
                              <td className="p-3">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isAct
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                    : "bg-red-100 text-red-800 border-red-300"
                                    }`}
                                >
                                  {isAct ? "ACTIVE (BUKA)" : "INACTIVE (TUTUP)"}
                                </span>
                              </td>
                              <td className="p-3 text-right space-x-2">
                                <Button
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    const next = isAct ? "INACTIVE" : "ACTIVE";
                                    setTenantStatus(t.id, next);
                                    refreshAllTenantStatuses();
                                    showMasterToast(`Status ${t.name} diubah menjadi ${next}.`);
                                  }}
                                  className={`h-7 text-xs font-bold px-2.5 rounded-xl ${isAct
                                    ? "border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                                    : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                                    }`}
                                >
                                  <Power className="w-3 h-3 mr-1" />
                                  <span>{isAct ? "Nonaktifkan" : "Aktifkan"}</span>
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Revenue Sharing Configuration */}
                <div className="pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wide flex items-center space-x-2">
                        <Coins className="w-4 h-4 text-amber-600" />
                        <span>Skema Bagi Hasil Mitra (Flexible Revenue Sharing)</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
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
                          className={`p-4 rounded-xl border transition-all ${hasError
                            ? "border-red-300 bg-red-50/40"
                            : "border-slate-200 bg-slate-50/60 hover:bg-slate-50"
                            }`}
                        >
                          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                            <div className="flex items-center space-x-2">
                              <Store className="w-4 h-4 text-brand-orange" />
                              <span className="font-bold text-slate-900">{tenant.name}</span>
                              <span className="text-[10px] text-slate-500 font-mono">({tenant.code})</span>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              STATUS: AKTIF
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <div>
                              <label className="block text-slate-700 font-semibold mb-1">
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
                                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-900 bg-white"
                                />
                                <span className="font-bold text-slate-500">%</span>
                              </div>
                            </div>

                            <div>
                              <label className="block text-slate-700 font-semibold mb-1">
                                Bagian DAGO Hub (%)
                              </label>
                              <div className="flex items-center space-x-1">
                                <input
                                  type="number"
                                  disabled
                                  value={config.dagoSharePercent}
                                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg font-bold text-slate-500 bg-slate-100 cursor-not-allowed"
                                />
                                <span className="font-bold text-slate-500">%</span>
                              </div>
                            </div>
                          </div>

                          {hasError && (
                            <p className="text-[11px] text-red-600 font-semibold mt-2">
                              ⚠️ {revenueSplitErrors[tenant.id]}
                            </p>
                          )}

                          {/* Simulation Preview */}
                          <div className="mt-3 p-2.5 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-600 flex items-center justify-between">
                            <span className="text-slate-400">Simulasi Rp 100k:</span>
                            <span className="font-mono">
                              Mitra: <strong className="text-emerald-700">Rp {simTenant.toLocaleString("id-ID")}</strong> | DAGO: <strong className="text-brand-orange">Rp {simDago.toLocaleString("id-ID")}</strong>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-1">
                    <p className="font-semibold">💡 Ketentuan Settlement Multi-Tenant & Immutability:</p>
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
                      <span>Simpan Skema Bagi Hasil</span>
                    </Button>
                  </div>
                </div>
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
                    <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wide flex items-center space-x-2">
                      <Award className="w-4 h-4 text-amber-500" />
                      <span>Daftar Paket Membership Co-Working</span>
                    </h4>
                  </div>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                      <thead className="bg-slate-50">
                        <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                          <th className="p-3 font-bold">Nama Paket</th>
                          <th className="p-3 font-bold">Siklus / Durasi</th>
                          <th className="p-3 font-bold">Harga</th>
                          <th className="p-3 font-bold">Akses Meja & Fasilitas</th>
                          <th className="p-3 font-bold">Status</th>
                          <th className="p-3 font-bold text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                        {localPlans.map((pl) => (
                          <tr key={pl.id} className="hover:bg-slate-50/50">
                            <td className="p-3 font-bold text-slate-900 flex items-center space-x-2">
                              <Award className="w-3.5 h-3.5 text-amber-500" />
                              <span>{pl.name}</span>
                            </td>
                            <td className="p-3 font-mono text-slate-500">{pl.billingCycle}</td>
                            <td className="p-3 font-mono font-bold text-brand-orange">{pl.priceFormatted}</td>
                            <td className="p-3 font-medium text-slate-600 max-w-xs truncate">{pl.deskAccess}</td>
                            <td className="p-3">
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
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
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200"
                                : tbl.status === "OCCUPIED"
                                  ? "bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200"
                                  : "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200"
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
                  promos.map((promo, idx) => (
                    <div key={promo.id} className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-slate-50 shadow-2xs">
                      {/* Row 1: Code, Name, Active Toggle & Delete */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200/80">
                        <div className="flex items-center space-x-2 flex-1">
                          <div className="w-28">
                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Kode Kupon</label>
                            <input
                              type="text"
                              value={promo.code || ""}
                              onChange={(e) => {
                                const newPromos = [...promos];
                                newPromos[idx].code = e.target.value.toUpperCase();
                                setPromos(newPromos);
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
                                const newPromos = [...promos];
                                newPromos[idx].name = e.target.value;
                                setPromos(newPromos);
                              }}
                              placeholder="Nama Promo"
                              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold w-full bg-white text-slate-800"
                            />
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
                                const newPromos = [...promos];
                                newPromos[idx].isActive = e.target.checked;
                                setPromos(newPromos);
                              }}
                              className="rounded text-emerald-600"
                            />
                            <span className="font-bold text-[11px] text-slate-700">{promo.isActive ? "Aktif" : "Nonaktif"}</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setPromos(promos.filter((p) => p.id !== promo.id))}
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
                            const newPromos = [...promos];
                            newPromos[idx].description = e.target.value;
                            setPromos(newPromos);
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
                              const newPromos = [...promos];
                              newPromos[idx].scope = e.target.value as any;
                              setPromos(newPromos);
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
                              const newPromos = [...promos];
                              newPromos[idx].discountType = e.target.value as PromoType;
                              setPromos(newPromos);
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
                              const newPromos = [...promos];
                              newPromos[idx].discountValue = Number(e.target.value);
                              setPromos(newPromos);
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
                              const newPromos = [...promos];
                              newPromos[idx].maxDiscount = e.target.value ? Number(e.target.value) : undefined;
                              setPromos(newPromos);
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
                              const newPromos = [...promos];
                              newPromos[idx].minimumAmount = e.target.value ? Number(e.target.value) : undefined;
                              setPromos(newPromos);
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
                              const newPromos = [...promos];
                              newPromos[idx].quota = e.target.value ? Number(e.target.value) : undefined;
                              setPromos(newPromos);
                            }}
                            placeholder="Tanpa batas"
                            className="w-full px-2 py-1.5 border rounded-lg bg-white"
                          />
                        </div>
                      </div>

                      {/* Row 4: Target Type & Periode Validitas */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs pt-1">
                        <div>
                          <label className="block text-slate-500 font-medium mb-1">Target Menu/Mitra</label>
                          <select
                            value={promo.targetType || "ALL"}
                            onChange={(e) => {
                              const newPromos = [...promos];
                              newPromos[idx].targetType = e.target.value as any;
                              setPromos(newPromos);
                            }}
                            className="w-full px-2 py-1.5 border rounded-lg bg-white font-bold text-slate-700"
                          >
                            <option value="ALL">Semua Menu & Mitra</option>
                            <option value="TENANT">Khusus Mitra / Tenant</option>
                            <option value="CATEGORY">Khusus Kategori</option>
                            <option value="PRODUCT">Khusus Produk Tertentu</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-500 font-medium mb-1">
                            {promo.targetType === "TENANT" ? "Target Tenant ID" : promo.targetType === "CATEGORY" ? "Target Kategori" : promo.targetType === "PRODUCT" ? "Target Product ID" : "Target Scope ID"}
                          </label>
                          <input
                            type="text"
                            disabled={!promo.targetType || promo.targetType === "ALL"}
                            value={promo.targetId || ""}
                            onChange={(e) => {
                              const newPromos = [...promos];
                              newPromos[idx].targetId = e.target.value;
                              setPromos(newPromos);
                            }}
                            placeholder={promo.targetType === "ALL" || !promo.targetType ? "Berlaku Semua" : "Masukkan ID / Kategori"}
                            className={`w-full px-2.5 py-1.5 border rounded-lg text-xs font-mono ${!promo.targetType || promo.targetType === "ALL" ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-white text-slate-900"
                              }`}
                          />
                        </div>

                        <div>
                          <label className="block text-slate-500 font-medium mb-1">Tanggal Mulai Berlaku</label>
                          <input
                            type="date"
                            value={promo.validFrom ? promo.validFrom.split("T")[0] : ""}
                            onChange={(e) => {
                              const newPromos = [...promos];
                              newPromos[idx].validFrom = e.target.value ? new Date(e.target.value).toISOString() : undefined;
                              setPromos(newPromos);
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
                              const newPromos = [...promos];
                              newPromos[idx].validUntil = e.target.value ? new Date(e.target.value + "T23:59:59.000Z").toISOString() : undefined;
                              setPromos(newPromos);
                            }}
                            className="w-full px-2.5 py-1.5 border rounded-lg bg-white text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))
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
                  <Card className="shadow-2xs border border-slate-200">
                    <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                      <CardTitle className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>Ambang Batas Peringatan Stok Kritis (%)</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 text-xs space-y-2">
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Low Stock Threshold Percent (%)</label>
                        <input
                          type="number"
                          value={lowStock}
                          onChange={(e) => setLowStock(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-amber-700"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
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
          </Card>

          {/* COMMON MASTER DATA MODALS */}

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

                  <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                    <Button type="button" variant="outline" onClick={() => setIsEditProdModalOpen(false)} className="rounded-xl">
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
                    💡 Mitra baru akan otomatis terdaftar dengan skema bagi hasil standar 85% Mitra / 15% DAGO.
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
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Tipe Ruangan</label>
                      <select
                        value={formSpaceType}
                        onChange={(e) => setFormSpaceType(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-semibold"
                      >
                        <option value="HOT_DESK">HOT_DESK</option>
                        <option value="DEDICATED_DESK">DEDICATED_DESK</option>
                        <option value="PRIVATE_OFFICE">PRIVATE_OFFICE</option>
                        <option value="MEETING_ROOM">MEETING_ROOM</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Area / Lantai</label>
                      <input
                        type="text"
                        value={formSpaceArea}
                        onChange={(e) => setFormSpaceArea(e.target.value)}
                        placeholder="Ground Floor Main"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                      />
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
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Tipe Ruangan</label>
                      <select
                        value={formSpaceType}
                        onChange={(e) => setFormSpaceType(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-semibold"
                      >
                        <option value="HOT_DESK">HOT_DESK</option>
                        <option value="DEDICATED_DESK">DEDICATED_DESK</option>
                        <option value="PRIVATE_OFFICE">PRIVATE_OFFICE</option>
                        <option value="MEETING_ROOM">MEETING_ROOM</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Area / Lantai</label>
                      <input
                        type="text"
                        value={formSpaceArea}
                        onChange={(e) => setFormSpaceArea(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                      />
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

        </div>
      )}
    </div>
  );
}
