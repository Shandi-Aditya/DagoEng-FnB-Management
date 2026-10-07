"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useOutlet } from "@/contexts/OutletContext";
import { useProducts } from "@/contexts/ProductContext";
import { useInventory } from "@/contexts/InventoryContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BookOpen, Plus, Search, Trash2, X, UtensilsCrossed, ArrowRight, Sparkles, CheckCircle2, AlertTriangle, Ban, Edit2, Image as ImageIcon, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrencyIDR } from "@/lib/utils";
import { isTenantActive, getTenantStatus, DEFAULT_FNB_TENANTS } from "@/lib/tenant";
import { MasterProduct } from "@/types/product";

export default function MenuPage() {
  const { user } = useAuth();
  const { activeOutlet } = useOutlet();
  const { filteredProducts, categories, addProduct, updateProduct, addCategory, toggleProductStatus, deleteProduct } = useProducts();
  const { checkProductStockStatus } = useInventory();

  const [tenantSettingsVersion, setTenantSettingsVersion] = useState(0);

  React.useEffect(() => {
    const handleUpdate = () => setTenantSettingsVersion((v) => v + 1);
    window.addEventListener("tenant_settings_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("tenant_settings_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const isTenantOwner = user?.scopeLevel === "TENANT" && !!user?.tenant?.id;
  const userTenantId = user?.tenant?.id;
  const canManage = user?.role.slug === "SUPER_ADMIN" || user?.role.slug === "OWNER" || user?.role.slug === "MANAGER";

  const [selectedTenant, setSelectedTenant] = useState<string>(isTenantOwner && userTenantId ? userTenantId : "SEMUA");
  const [selectedCat, setSelectedCat] = useState("Semua");
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  // Modals
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isEditProductModalOpen, setIsEditProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MasterProduct | null>(null);
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);

  // Add Form States
  const [newName, setNewName] = useState("");
  const [newCat, setNewCat] = useState(categories[0] || "Minuman");
  const [newTenantId, setNewTenantId] = useState<string>(userTenantId || "tenant-ks");
  const [newPrice, setNewPrice] = useState<number>(25000);
  const [newCogs, setNewCogs] = useState<number>(9000);
  const [newDesc, setNewDesc] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newCatName, setNewCatName] = useState("");

  // Edit Form States
  const [editName, setEditName] = useState("");
  const [editCat, setEditCat] = useState("");
  const [editTenantId, setEditTenantId] = useState("");
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editCogs, setEditCogs] = useState<number>(0);
  const [editDesc, setEditDesc] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Format file tidak valid. Harap pilih gambar (JPG, PNG, WEBP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("Ukuran foto maksimal 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setter(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleOpenEditModal = (p: MasterProduct) => {
    setEditingProduct(p);
    setEditName(p.name);
    setEditCat(p.category);
    setEditTenantId(p.tenantId || "tenant-ks");
    setEditPrice(p.basePrice);
    setEditCogs(p.cogsEstimate);
    setEditDesc(p.description || "");
    setEditImageUrl(p.imageUrl || "");
    setIsEditProductModalOpen(true);
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    addCategory(newCatName.trim());
    setNewCat(newCatName.trim());
    setIsAddCatModalOpen(false);
    showToast(`Kategori "${newCatName.trim()}" berhasil ditambahkan ke katalog!`);
    setNewCatName("");
  };

  // Customer Guard: If logged in as Customer, show dedicated portal link
  if (user?.role.slug === "CUSTOMER") {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <div className="w-16 h-16 bg-brand-orange/10 text-brand-orange rounded-full flex items-center justify-center mx-auto mb-4 border border-brand-orange/20">
          <UtensilsCrossed className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Halo, {user.name}!
        </h2>
        <p className="text-slate-600 mb-6 text-sm">
          Halaman ini adalah <strong>Katalog Master & Manajemen Resep Internal Staf</strong> (COGS & HPP). Untuk memesan makanan, kustomisasi pesanan, melihat poin loyalty, dan melacak status meja Anda, silakan buka <strong>Portal Self-Order Pelanggan</strong>.
        </p>
        <Link
          href="/customer"
          className="inline-flex items-center space-x-2 px-6 py-3 bg-brand-orange text-white font-bold rounded-xl shadow-lg hover:bg-brand-orange/90 transition-all text-sm"
        >
          <Sparkles className="w-4 h-4" />
          <span>Buka Portal Self-Order Pelanggan</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  const categoryList = ["Semua", ...categories];

  const displayedProducts = filteredProducts.filter((p) => {
    if (isTenantOwner && p.tenantId && p.tenantId !== userTenantId) {
      return false;
    }
    const matchTenant = selectedTenant === "SEMUA" || p.tenantId === selectedTenant;
    const matchCat = selectedCat === "Semua" || p.category === selectedCat;
    const matchSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchTenant && matchCat && matchSearch;
  });

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      showToast("Akses ditolak: Anda tidak memiliki wewenang untuk menambah menu.");
      return;
    }
    if (!newName.trim()) return;

    const targetTenant = isTenantOwner && userTenantId ? userTenantId : newTenantId;

    const newProd = addProduct({
      name: newName.trim(),
      category: newCat,
      basePrice: Number(newPrice),
      cogsEstimate: Number(newCogs),
      status: "ACTIVE",
      outletId: "ALL",
      outletName: "Semua Outlet",
      isAvailable: true,
      description: newDesc.trim() || undefined,
      imageUrl: newImageUrl.trim() || undefined,
      tenantId: targetTenant,
    });

    setIsAddProductModalOpen(false);
    setNewName("");
    setNewDesc("");
    setNewImageUrl("");
    showToast(`Produk "${newProd.name}" berhasil ditambahkan & otomatis aktif di POS dan QR!`);
  };

  const handleUpdateProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      showToast("Akses ditolak: Anda tidak memiliki wewenang untuk mengubah menu.");
      return;
    }
    if (!editingProduct || !editName.trim()) return;

    const targetTenant = isTenantOwner && userTenantId ? userTenantId : editTenantId;

    updateProduct(
      editingProduct.id,
      {
        name: editName.trim(),
        category: editCat,
        basePrice: Number(editPrice),
        cogsEstimate: Number(editCogs),
        tenantId: targetTenant,
        description: editDesc.trim() || undefined,
        imageUrl: editImageUrl.trim() || undefined,
      },
      "Update data menu dari Master Menu"
    );

    setIsEditProductModalOpen(false);
    setEditingProduct(null);
    showToast(`Produk "${editName}" berhasil diperbarui!`);
  };

  const handleToggle = (id: string) => {
    if (!canManage) {
      showToast("Akses ditolak: Hanya Owner/Manager yang dapat mengubah status menu.");
      return;
    }
    toggleProductStatus(id);
    showToast("Status produk berhasil diperbarui!");
  };

  const handleDelete = (id: string) => {
    if (!canManage) {
      showToast("Akses ditolak: Hanya Owner/Manager yang dapat menghapus produk.");
      return;
    }
    deleteProduct(id);
    showToast("Produk berhasil diarsipkan dari katalog.");
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-bold flex items-center space-x-2 animate-in fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-brand-orange" />
            <span>Katalog Master Menu, Resep & COGS</span>
          </h2>
          <p className="text-xs text-slate-500">
            Master {filteredProducts.length} Menu Produk • Foto dan keterangan tersinkronisasi otomatis ke POS Kasir dan Portal Pelanggan
          </p>
        </div>
        {canManage ? (
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAddCatModalOpen(true)}
              className="text-xs font-bold space-x-1.5 border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <Plus className="w-3.5 h-3.5 text-slate-600" />
              <span>+ Tambah Kategori</span>
            </Button>

            <Button
              size="sm"
              onClick={() => setIsAddProductModalOpen(true)}
              className="text-xs font-bold space-x-1.5 bg-brand-orange hover:bg-orange-600 text-white shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Menu Produk</span>
            </Button>
          </div>
        ) : (
          <div className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-600 font-semibold flex items-center gap-1.5">
            <span>Mode Baca (Read-Only)</span>
          </div>
        )}
      </div>

      {/* Filters: Tenant / Mitra Selector, Search Bar & Category Tabs */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Tenant / Mitra Filter (Available for Owner / Admin) */}
          <div className="sm:w-64 flex-shrink-0">
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Filter Mitra / Tenant:</label>
            <select
              value={selectedTenant}
              disabled={isTenantOwner}
              onChange={(e) => setSelectedTenant(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
            >
              {!isTenantOwner && <option value="SEMUA">🍽️ Semua Mitra & Tenant</option>}
              {DEFAULT_FNB_TENANTS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.icon} {m.name} ({m.badge})
                </option>
              ))}
            </select>
          </div>

          {/* Search Bar */}
          <div className="flex-1">
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Pencarian Menu / Resep:</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama menu, resep, atau deskripsi..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
              />
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div>
          <label className="text-[11px] font-bold text-slate-600 block mb-1">Filter Kategori:</label>
          <div className="flex items-center space-x-1.5 overflow-x-auto text-xs no-scrollbar pt-0.5">
            {categoryList.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCat(cat)}
                className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
                  selectedCat === cat
                    ? "bg-brand-orange text-white shadow-sm font-bold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Products Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-100 font-semibold text-slate-600">
                <tr>
                  <th className="p-3">Menu & Foto</th>
                  <th className="p-3">Mitra / Tenant</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3">Harga Jual</th>
                  <th className="p-3">COGS Resep</th>
                  <th className="p-3">Gross Margin</th>
                  <th className="p-3 text-center">Status Stok Bahan</th>
                  <th className="p-3 text-center">Status Menu (Toggle)</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {displayedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      <UtensilsCrossed className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-sm">Tidak ada produk yang sesuai dengan filter.</p>
                      <p className="text-xs text-slate-400 mt-0.5">Coba ubah filter mitra, kategori, atau kata kunci pencarian Anda.</p>
                    </td>
                  </tr>
                ) : (
                  displayedProducts.map((p) => {
                    const stockCheck = checkProductStockStatus(p.name);
                    const isOutOfStock = stockCheck.status === "OUT_OF_STOCK";
                    const isCriticalStock = stockCheck.status === "CRITICAL";
                    const currentMitra = DEFAULT_FNB_TENANTS.find((m) => m.id === p.tenantId) || {
                      id: p.tenantId || "tenant-ks",
                      name: p.tenantId === "tenant-ks" ? "Kopi Senja" : p.tenantId || "Kopi Senja",
                      badge: "Mitra F&B"
                    };

                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold text-slate-900">
                          <div className="flex items-center space-x-3">
                            {p.imageUrl ? (
                              <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200">
                                <img
                                  src={p.imageUrl}
                                  alt={p.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 text-slate-400">
                                <UtensilsCrossed className="w-5 h-5 opacity-40" />
                              </div>
                            )}
                            <div className="min-w-0 max-w-xs">
                              <p className="font-bold text-slate-900 truncate">{p.name}</p>
                              <p className="text-[10px] text-slate-400 font-normal line-clamp-1">
                                {p.description || "Belum ada deskripsi"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col items-start gap-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-brand-orange border border-orange-200">
                              {currentMitra.name}
                            </span>
                            {!isTenantActive(p.tenantId || "tenant-ks") && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-100 text-red-800 border border-red-200">
                                Mitra Nonaktif (Tutup)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-slate-500 font-medium">{p.category}</td>
                        <td className="p-3 font-bold font-mono text-slate-900">
                          {formatCurrencyIDR(p.basePrice)}
                        </td>
                        <td className="p-3 text-slate-500 font-mono">
                          {formatCurrencyIDR(p.cogsEstimate)}
                        </td>
                        <td className="p-3 font-bold text-brand-green font-mono">{p.grossMarginPercent}</td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center space-x-1 ${
                              isOutOfStock
                                ? "bg-rose-100 text-rose-800 border border-rose-200"
                                : isCriticalStock
                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            }`}
                          >
                            {isOutOfStock ? (
                              <span>Habis (Disabled di POS)</span>
                            ) : isCriticalStock ? (
                              <span>Stok Menipis</span>
                            ) : (
                              <span>Tersedia</span>
                            )}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            disabled={!canManage}
                            onClick={() => handleToggle(p.id)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                              !canManage ? "cursor-default opacity-80" : "cursor-pointer"
                            } ${
                              p.status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            }`}
                          >
                            {p.status} {canManage ? "↻" : ""}
                          </button>
                        </td>
                        <td className="p-3 text-right">
                          {canManage ? (
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                onClick={() => handleOpenEditModal(p)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                title="Edit Menu"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(p.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Hapus Produk"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[10px] italic">Terkunci</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Tambah Menu */}
      {isAddProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">Tambah Menu Produk Baru</h3>
              <button
                onClick={() => setIsAddProductModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddProduct} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nama Menu Produk</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Iced Lychee Artisan Tea"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              {/* Mitra / Tenant Assignment */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Mitra / Tenant Pemilik</label>
                {isTenantOwner && user?.tenant ? (
                  <div className="px-3 py-2 bg-slate-50 border rounded-xl text-slate-700 font-semibold flex items-center justify-between">
                    <span>{user.tenant.name}</span>
                    <span className="text-[10px] bg-orange-100 text-brand-orange px-2 py-0.5 rounded-md font-bold">
                      Tenant Anda
                    </span>
                  </div>
                ) : (
                  <select
                    value={newTenantId}
                    onChange={(e) => setNewTenantId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl bg-white font-medium text-slate-800"
                  >
                    {DEFAULT_FNB_TENANTS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.badge})
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-[10px] text-slate-400">
                  Menu ini akan otomatis muncul pada katalog mitra yang dipilih di Customer Portal.
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Kategori Menu</label>
                <select
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-white font-medium"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Harga Jual (Rp)</label>
                  <input
                    type="number"
                    required
                    min={1000}
                    step={500}
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-xl font-mono font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Estimasi COGS Resep (Rp)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={500}
                    value={newCogs}
                    onChange={(e) => setNewCogs(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-xl font-mono text-slate-600"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Deskripsi / Keterangan Menu</label>
                <textarea
                  rows={2}
                  placeholder="Jelaskan komposisi, cita rasa, atau keunikan menu (akan tampil di kartu POS & Portal Pelanggan)..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl resize-none text-xs"
                />
              </div>

              {/* Photo Upload & Preview */}
              <div className="space-y-1.5 pt-1">
                <label className="font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center space-x-1">
                    <ImageIcon className="w-3.5 h-3.5 text-brand-orange" />
                    <span>Foto Menu</span>
                  </span>
                  {newImageUrl && (
                    <button
                      type="button"
                      onClick={() => setNewImageUrl("")}
                      className="text-[10px] text-rose-500 font-bold hover:underline"
                    >
                      Hapus Foto
                    </button>
                  )}
                </label>

                {newImageUrl ? (
                  <div className="relative w-full h-32 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                    <img
                      src={newImageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <label className="w-full h-24 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-brand-orange/60 hover:bg-orange-50/20 transition-all text-slate-500">
                    <Upload className="w-5 h-5 mb-1 text-slate-400" />
                    <span className="text-[11px] font-semibold text-slate-600">Pilih / Upload Foto Menu</span>
                    <span className="text-[9px] text-slate-400">JPG, PNG, atau WEBP (maks 5MB)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, setNewImageUrl)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddProductModalOpen(false)}
                >
                  Batal
                </Button>
                <Button type="submit" size="sm" className="bg-brand-orange text-white font-bold">
                  Simpan & Aktifkan Menu
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Menu */}
      {isEditProductModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                <Edit2 className="w-4 h-4 text-blue-600" />
                <span>Edit Menu: {editingProduct.name}</span>
              </h3>
              <button
                onClick={() => {
                  setIsEditProductModalOpen(false);
                  setEditingProduct(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateProductSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nama Menu Produk</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              {/* Mitra / Tenant Assignment */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Mitra / Tenant Pemilik</label>
                {isTenantOwner && user?.tenant ? (
                  <div className="px-3 py-2 bg-slate-50 border rounded-xl text-slate-700 font-semibold flex items-center justify-between">
                    <span>{user.tenant.name}</span>
                    <span className="text-[10px] bg-orange-100 text-brand-orange px-2 py-0.5 rounded-md font-bold">
                      Tenant Anda
                    </span>
                  </div>
                ) : (
                  <select
                    value={editTenantId}
                    onChange={(e) => setEditTenantId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl bg-white font-medium text-slate-800"
                  >
                    {DEFAULT_FNB_TENANTS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.badge})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Kategori Menu</label>
                <select
                  value={editCat}
                  onChange={(e) => setEditCat(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-white font-medium"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Harga Jual (Rp)</label>
                  <input
                    type="number"
                    required
                    min={1000}
                    step={500}
                    value={editPrice}
                    onChange={(e) => setEditPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-xl font-mono font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Estimasi COGS Resep (Rp)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={500}
                    value={editCogs}
                    onChange={(e) => setEditCogs(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-xl font-mono text-slate-600"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Deskripsi / Keterangan Menu</label>
                <textarea
                  rows={2}
                  placeholder="Jelaskan komposisi, cita rasa, atau keunikan menu..."
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl resize-none text-xs"
                />
              </div>

              {/* Photo Upload, Replace & Preview */}
              <div className="space-y-1.5 pt-1">
                <label className="font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center space-x-1">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                    <span>Foto Menu</span>
                  </span>
                  {editImageUrl && (
                    <button
                      type="button"
                      onClick={() => setEditImageUrl("")}
                      className="text-[10px] text-rose-500 font-bold hover:underline"
                    >
                      Hapus Foto
                    </button>
                  )}
                </label>

                {editImageUrl ? (
                  <div className="space-y-2">
                    <div className="relative w-full h-32 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                      <img
                        src={editImageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <label className="inline-flex items-center space-x-1.5 text-xs font-bold text-blue-600 cursor-pointer hover:underline">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Ganti Foto Menu</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, setEditImageUrl)}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <label className="w-full h-24 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-500/60 hover:bg-blue-50/20 transition-all text-slate-500">
                    <Upload className="w-5 h-5 mb-1 text-slate-400" />
                    <span className="text-[11px] font-semibold text-slate-600">Pilih / Upload Foto Baru</span>
                    <span className="text-[9px] text-slate-400">JPG, PNG, atau WEBP (maks 5MB)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, setEditImageUrl)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditProductModalOpen(false);
                    setEditingProduct(null);
                  }}
                >
                  Batal
                </Button>
                <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                  Simpan Perubahan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Kategori */}
      {isAddCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">Tambah Kategori Menu Baru</h3>
              <button
                onClick={() => setIsAddCatModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCategory} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nama Kategori Baru</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Mocktails & Cold Pressed"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                />
                <p className="text-[10px] text-slate-400">
                  Kategori baru akan langsung muncul di tab filter POS Kasir dan Portal Pelanggan.
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddCatModalOpen(false)}
                >
                  Batal
                </Button>
                <Button type="submit" size="sm" className="bg-brand-orange text-white font-bold">
                  Simpan Kategori
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
