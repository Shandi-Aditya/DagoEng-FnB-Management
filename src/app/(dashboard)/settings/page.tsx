"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useOutlet } from "@/contexts/OutletContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { PromoConfig, PromoType, TargetType } from "@/lib/promo";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const { user, activeOrgModules, toggleOrgModule } = useAuth();
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

  // Rekening Pencairan Dana & Pembayaran Mitra
  const [bankName, setBankName] = useState<string>("BCA");
  const [bankAccountNumber, setBankAccountNumber] = useState<string>("");
  const [bankAccountHolder, setBankAccountHolder] = useState<string>("");
  const [bankFormError, setBankFormError] = useState<string>("");

  useEffect(() => {
    if (!isTenantOwner) return;
    try {
      /**
       * NOTE: LocalStorage persistence below serves as an isolated prototype/demo persistence layer
       * specifically scoped per tenantId without requiring destructive Prisma database migrations.
       */
      const saved = localStorage.getItem("dagoeng_tenant_settings_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        const currentTenantId = user?.tenant?.id || "tenant-ks";
        // Support both map-by-tenantId and legacy single object
        const tenantData = parsed[currentTenantId] || (parsed.tenantId === currentTenantId ? parsed : null);

        if (tenantData) {
          if (tenantData.brandName) setTenantBrandName(tenantData.brandName);
          if (tenantData.tagline) setTenantTagline(tenantData.tagline);
          if (tenantData.description) setTenantDesc(tenantData.description);
          if (tenantData.contactPhone) setTenantPhone(tenantData.contactPhone);
          if (tenantData.receiptHeader) setTenantReceiptHeader(tenantData.receiptHeader);
          if (tenantData.receiptFooter) setTenantReceiptFooter(tenantData.receiptFooter);
          if (tenantData.lowStockThresholdPercent !== undefined) setTenantLowStock(tenantData.lowStockThresholdPercent);
          if (tenantData.bankName) setBankName(tenantData.bankName);
          if (tenantData.bankAccountNumber) setBankAccountNumber(tenantData.bankAccountNumber);
          if (tenantData.bankAccountHolder) setBankAccountHolder(tenantData.bankAccountHolder);
        }
      }
    } catch (e) {
      console.error("Failed to load tenant settings from localStorage", e);
    }
  }, [user, isTenantOwner]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
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
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem("dagoeng_tenant_settings_v1", JSON.stringify(existingMap));
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
    {
      code: "COMMERCIAL",
      name: "Commercial Retail Leases",
      desc: "Manajemen sewa lot komersial, kontrak tenant retail, dan rekonsiliasi pembayaran sewa ruang.",
      icon: <Briefcase className="w-5 h-5 text-purple-600" />,
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

  // Render Tenant Settings for Owner Mitra
  if (isTenantOwner) {
    return (
      <div className="space-y-6 max-w-5xl">
        {/* Toast Alert */}
        {tenantSavedSuccess && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-bold flex items-center space-x-2 animate-in fade-in shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Pengaturan profil mitra dan konfigurasi operasional {tenantBrandName} berhasil disimpan!</span>
          </div>
        )}

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
              <Coffee className="w-6 h-6 text-brand-orange" />
              <span>Pengaturan Mitra & Profil Bisnis Tenant</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola profil merek, informasi operasional gerai, kontak, dan kustomisasi struk kasir untuk{" "}
              <strong className="text-slate-800">{user?.tenant?.name || "Mitra F&B"}</strong>
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full font-bold">
              Scope: TENANT ({user?.tenant?.code || "KOPI-SENJA"})
            </span>
          </div>
        </div>

        <form onSubmit={handleSaveTenantSettings} className="space-y-6 text-xs">
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
      </div>
    );
  }

  const [selectedMasterTab, setSelectedMasterTab] = useState("Paket Membership");

  const MASTER_DATA_TABS = [
    "User",
    "Tenant",
    "Kategori Produk",
    "Produk",
    "Kategori Ruangan",
    "Ruangan",
    "Paket Membership",
    "Paket Virtual Office",
    "Promo",
    "Event Spaces",
    "Acara",
    "COA",
    "FAQ",
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Toast Alert */}
      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-bold flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Pengaturan platform berhasil disimpan dan disinkronkan ke seluruh modul.</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Settings className="w-6 h-6 text-slate-700" />
            <span>Master Data & Pengaturan Platform DAGO</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manajemen Master Data terpusat, paket layanan, pajak global (10%), dan konfigurasi organisasi.
          </p>
        </div>
      </div>

      {/* Master Data Horizontal Scrolling Navigation Tabs */}
      <Card className="shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-xs text-slate-800 uppercase tracking-wide">Master Data:</span>
            <span className="text-xs bg-brand-orange/10 text-brand-orange font-bold px-2.5 py-0.5 rounded-full border border-brand-orange/20">
              {selectedMasterTab}
            </span>
          </div>

          <Button
            size="sm"
            onClick={() => alert(`Modal Tambah ${selectedMasterTab} Baru dibuka.`)}
            className="bg-brand-orange hover:bg-orange-600 text-white font-bold text-xs space-x-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah {selectedMasterTab} Baru</span>
          </Button>
        </div>

        {/* Scrollable Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto p-3 bg-white scrollbar-thin border-b border-slate-100">
          {MASTER_DATA_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setSelectedMasterTab(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${selectedMasterTab === tab
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Master Data Table Preview */}
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                <th className="pb-2 font-bold">Item / Entitas</th>
                <th className="pb-2 font-bold">Kode / Kategori</th>
                <th className="pb-2 font-bold">Nilai / Kuota / Tarif</th>
                <th className="pb-2 font-bold">Status</th>
                <th className="pb-2 font-bold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="py-2.5 font-bold text-slate-900">
                  {selectedMasterTab === "Paket Membership" ? "Flexi Nomad Pass (50 Jam)" : `${selectedMasterTab} Contoh #01`}
                </td>
                <td className="py-2.5 font-mono text-slate-500">
                  {selectedMasterTab === "Paket Membership" ? "MEMB-50H" : "DAGO-MASTER-01"}
                </td>
                <td className="py-2.5 font-bold text-brand-orange">
                  {selectedMasterTab === "Paket Membership" ? "Rp 500.000 / 30 Hari" : "Aktif"}
                </td>
                <td className="py-2.5">
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    AKTIF
                  </span>
                </td>
                <td className="py-2.5 text-right space-x-1">
                  <button
                    type="button"
                    onClick={() => alert(`Edit ${selectedMasterTab}`)}
                    className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    onClick={() => alert(`Hapus ${selectedMasterTab}`)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
              <tr>
                <td className="py-2.5 font-bold text-slate-900">
                  {selectedMasterTab === "Paket Membership" ? "Resident Dedicated Desk (1 Bulan)" : `${selectedMasterTab} Contoh #02`}
                </td>
                <td className="py-2.5 font-mono text-slate-500">
                  {selectedMasterTab === "Paket Membership" ? "MEMB-DEDICATED" : "DAGO-MASTER-02"}
                </td>
                <td className="py-2.5 font-bold text-brand-orange">
                  {selectedMasterTab === "Paket Membership" ? "Rp 1.500.000 / Bulan" : "Aktif"}
                </td>
                <td className="py-2.5">
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    AKTIF
                  </span>
                </td>
                <td className="py-2.5 text-right space-x-1">
                  <button
                    type="button"
                    onClick={() => alert(`Edit ${selectedMasterTab}`)}
                    className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    onClick={() => alert(`Hapus ${selectedMasterTab}`)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Form Settings Container */}
      <form onSubmit={handleSaveSettings} className="space-y-6">

        {/* Business Module Activation Toggles */}
        <Card className="shadow-xs border border-slate-200">
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
        <Card className="shadow-xs border border-slate-200">
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
        <Card className="shadow-xs border border-slate-200">
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
          <Card className="shadow-xs border border-slate-200">
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
                  Bahan dengan sisa stok di bawah persentase ini otomatis memicu Restock Alert & badge 'Stok Kritis'.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Loyalty Tier Thresholds */}
          <Card className="shadow-xs border border-slate-200">
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
                Member baru otomatis Bronze (0 poin). Kenaikan tier dihitung otomatis sesuai poin transaksi.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Promo Settings */}
        <Card className="shadow-xs border border-slate-200">
          <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                <Tag className="w-4 h-4 text-emerald-600" />
                <span>Manajemen Promo & Diskon</span>
              </CardTitle>
              <CardDescription className="text-xs">Konfigurasi promo yang akan digunakan pada saat checkout.</CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setPromos([
                  ...promos,
                  {
                    id: `promo-${Date.now()}`,
                    name: "Promo Baru",
                    discountType: "PERCENTAGE",
                    discountValue: 10,
                    targetType: "ALL",
                    isActive: false,
                  },
                ]);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs px-3"
            >
              <Plus className="w-4 h-4 mr-1" /> Tambah Promo
            </Button>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {promos.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs italic">Belum ada promo yang ditambahkan.</div>
            ) : (
              promos.map((promo, idx) => (
                <div key={promo.id} className="border border-slate-200 rounded-lg p-3 space-y-3 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={promo.name}
                      onChange={(e) => {
                        const newPromos = [...promos];
                        newPromos[idx].name = e.target.value;
                        setPromos(newPromos);
                      }}
                      placeholder="Nama Promo"
                      className="px-2 py-1 border rounded text-xs font-bold w-1/3"
                    />
                    <div className="flex items-center space-x-2">
                      <label className="text-xs flex items-center space-x-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={promo.isActive}
                          onChange={(e) => {
                            const newPromos = [...promos];
                            newPromos[idx].isActive = e.target.checked;
                            setPromos(newPromos);
                          }}
                        />
                        <span>Aktif</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setPromos(promos.filter((p) => p.id !== promo.id))}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div>
                      <label className="block text-slate-500 mb-1">Tipe Diskon</label>
                      <select
                        value={promo.discountType}
                        onChange={(e) => {
                          const newPromos = [...promos];
                          newPromos[idx].discountType = e.target.value as PromoType;
                          setPromos(newPromos);
                        }}
                        className="w-full px-2 py-1 border rounded bg-white"
                      >
                        <option value="PERCENTAGE">Persentase (%)</option>
                        <option value="FIXED">Nominal Fixed (Rp)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Nilai Diskon</label>
                      <input
                        type="number"
                        value={promo.discountValue}
                        onChange={(e) => {
                          const newPromos = [...promos];
                          newPromos[idx].discountValue = Number(e.target.value);
                          setPromos(newPromos);
                        }}
                        className="w-full px-2 py-1 border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Minimum Transaksi</label>
                      <input
                        type="number"
                        value={promo.minimumAmount || ""}
                        onChange={(e) => {
                          const newPromos = [...promos];
                          newPromos[idx].minimumAmount = e.target.value ? Number(e.target.value) : undefined;
                          setPromos(newPromos);
                        }}
                        placeholder="Tidak ada"
                        className="w-full px-2 py-1 border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Target</label>
                      <select
                        value={promo.targetType}
                        onChange={(e) => {
                          const newPromos = [...promos];
                          newPromos[idx].targetType = e.target.value as TargetType;
                          setPromos(newPromos);
                        }}
                        className="w-full px-2 py-1 border rounded bg-white"
                      >
                        <option value="ALL">Semua</option>
                        <option value="PRODUCT">Produk</option>
                        <option value="CATEGORY">Kategori</option>
                        <option value="TENANT">Tenant</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))
            )}
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
            <span>Simpan Semua Pengaturan</span>
          </Button>
        </div>

      </form>
    </div>
  );
}
