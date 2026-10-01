"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useOutlet } from "@/contexts/OutletContext";
import { useProducts } from "@/contexts/ProductContext";
import { useInventory } from "@/contexts/InventoryContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BookOpen, Plus, Search, Trash2, X, UtensilsCrossed, ArrowRight, Sparkles, CheckCircle2, AlertTriangle, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrencyIDR } from "@/lib/utils";

export default function MenuPage() {
  const { user } = useAuth();
  const { activeOutlet } = useOutlet();
  const { filteredProducts, categories, addProduct, addCategory, toggleProductStatus, deleteProduct } = useProducts();
  const { checkProductStockStatus } = useInventory();

  const [selectedCat, setSelectedCat] = useState("Semua");
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  // Modals
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);

  // Form States
  const [newName, setNewName] = useState("");
  const [newCat, setNewCat] = useState(categories[0] || "Signature Coffee");
  const [newPrice, setNewPrice] = useState<number>(25000);
  const [newCogs, setNewCogs] = useState<number>(9000);
  const [newDesc, setNewDesc] = useState("");
  const [newCatName, setNewCatName] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
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
    const matchCat = selectedCat === "Semua" || p.category === selectedCat;
    const matchSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

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
    });

    setIsAddProductModalOpen(false);
    setNewName("");
    setNewDesc("");
    showToast(`Produk "${newProd.name}" berhasil ditambahkan & otomatis aktif di POS dan QR!`);
  };

  const handleToggle = (id: string) => {
    toggleProductStatus(id);
    showToast("Status produk berhasil diperbarui!");
  };

  const handleDelete = (id: string) => {
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
            Master {filteredProducts.length} Menu Produk • Produk aktif otomatis tersedia di POS Kasir dan QR Table Self-Order
          </p>
        </div>
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
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari menu atau resep..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto text-xs no-scrollbar">
          {categoryList.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
                selectedCat === cat
                  ? "bg-brand-orange text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-100 font-semibold text-slate-600">
                <tr>
                  <th className="p-3">Nama Produk</th>
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
                {displayedProducts.map((p) => {
                  const stockCheck = checkProductStockStatus(p.name);
                  const isOutOfStock = stockCheck.status === "OUT_OF_STOCK";
                  const isCriticalStock = stockCheck.status === "CRITICAL";

                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-900">
                        <p>{p.name}</p>
                        {p.description && (
                          <p className="text-[10px] text-slate-400 font-normal line-clamp-1">{p.description}</p>
                        )}
                      </td>
                      <td className="p-3 text-slate-500">{p.category}</td>
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
                          onClick={() => handleToggle(p.id)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                            p.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {p.status} ↻
                        </button>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Hapus Produk"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Tambah Menu */}
      {isAddProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 border border-slate-200 space-y-4">
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
                <label className="font-bold text-slate-700">Deskripsi Detail Menu</label>
                <textarea
                  rows={3}
                  placeholder="Jelaskan komposisi, cita rasa, atau keunikan menu (akan tampil di kartu POS & Portal Pelanggan)..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl resize-none text-xs"
                />
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
