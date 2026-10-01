"use client";

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const { activeOrgModules, toggleOrgModule } = useAuth();
  const { settings, updateSettings } = useSettings();

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Form State
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
            <span>Pengaturan Platform & Konfigurasi Organisasi</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Konfigurasi bahasa, zona waktu, ambang batas stok, tier loyalty, pajak, dan aktivasi modul Dago Creative Hub
          </p>
        </div>
      </div>

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
