"use client";

import React, { useState } from "react";
import { useOutlet } from "@/contexts/OutletContext";
import { useInventory } from "@/contexts/InventoryContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Package,
  AlertTriangle,
  Plus,
  Truck,
  Search,
  X,
  CheckCircle2,
  ArrowUpDown,
  FileText,
  Utensils,
  Sparkles,
  RefreshCw,
  Eye,
  TrendingDown,
  Info,
  Download,
  BellRing,
  Ban,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrencyIDR } from "@/lib/utils";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";
import { PurchaseOrder, StockAdjustmentLog, RecipeBOM } from "@/types/inventory";
import { useProducts } from "@/contexts/ProductContext";
import { InventoryReportPDFModal } from "@/features/inventory/InventoryReportPDFModal";
import { BOMRecipeModal } from "@/features/inventory/BOMRecipeModal";

export default function InventoryPage() {
  const { activeOutlet } = useOutlet();
  const { products } = useProducts();
  const {
    filteredIngredients,
    recipes,
    filteredPurchaseOrders,
    logs,
    adjustStock,
    simulateBOMDeduction,
    upsertRecipe,
    deleteRecipe,
    createPurchaseOrder,
    receivePurchaseOrder,
  } = useInventory();

  const [activeTab, setActiveTab] = useState<"STOCK" | "BOM" | "PO">("STOCK");

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [successToast, setSuccessToast] = useState("");

  // Modals
  const [isStockAdjModalOpen, setIsStockAdjModalOpen] = useState(false);
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [isBOMSimulatorModalOpen, setIsBOMSimulatorModalOpen] = useState(false);
  const [isRestockAlertModalOpen, setIsRestockAlertModalOpen] = useState(false);
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [selectedRecipeForEdit, setSelectedRecipeForEdit] = useState<RecipeBOM | null>(null);
  const [selectedPOPreview, setSelectedPOPreview] = useState<PurchaseOrder | null>(null);

  // Stock Adj Form
  const [adjItemId, setAdjItemId] = useState(filteredIngredients[0]?.id || "ing-1");
  const [adjDelta, setAdjDelta] = useState<number>(5);
  const [adjReason, setAdjReason] = useState<StockAdjustmentLog["reason"]>("PO_MASUK");

  // PO Form
  const [poSupplier, setPOSupplier] = useState("Bali Dairy Fresh");
  const [poItemId, setPOItemId] = useState(filteredIngredients[0]?.id || "ing-1");
  const [poQuantity, setPOQuantity] = useState<number>(20);
  const [poNotes, setPONotes] = useState("Kebutuhan stok operasional mingguan.");

  // BOM Simulator Form
  const [simMenuId, setSimMenuId] = useState(recipes[0]?.menuId || "m-1");
  const [simQty, setSimQty] = useState<number>(5);

  // Filtered Stock
  const displayedIngredients = filteredIngredients.filter((item) => {
    const matchStatus = statusFilter === "ALL" || item.status === statusFilter;
    const matchSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  // KPI Calculations
  const criticalItems = filteredIngredients.filter((i) => i.status === "CRITICAL" || i.stockNumber <= i.min * 0.4);
  const outOfStockItems = filteredIngredients.filter((i) => i.stockNumber <= 0);
  const lowCount = filteredIngredients.filter((i) => i.status === "LOW").length;
  const totalStockValue = filteredIngredients.reduce((sum, i) => sum + i.stockNumber * i.costPerUnit, 0);

  // Handle Stock Adjustment
  const handleStockAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    const target = filteredIngredients.find((i) => i.id === adjItemId);
    if (!target) return;

    adjustStock(adjItemId, adjDelta, adjReason);
    setIsStockAdjModalOpen(false);
    setSuccessToast(`Stok ${target.name} berhasil disesuaikan!`);
    setTimeout(() => setSuccessToast(""), 4000);
  };

  // Handle Recipe Deduction Simulator
  const handleRunBOMSimulation = (e: React.FormEvent) => {
    e.preventDefault();
    const res = simulateBOMDeduction(simMenuId, simQty);
    setIsBOMSimulatorModalOpen(false);
    setSuccessToast(res.message);
    setTimeout(() => setSuccessToast(""), 5000);
  };

  // Handle Create PO
  const handleCreatePO = (e: React.FormEvent) => {
    e.preventDefault();
    const item = filteredIngredients.find((i) => i.id === poItemId);
    if (!item) return;

    const unitPrice = item.costPerUnit;
    const itemTotal = unitPrice * poQuantity;
    const subtotal = itemTotal;
    const tax = Math.round(subtotal * 0.11);
    const total = subtotal + tax;

    createPurchaseOrder({
      supplier: poSupplier,
      items: [
        {
          ingredientId: item.id,
          name: item.name,
          quantity: poQuantity,
          unit: item.unit,
          unitPrice,
          totalPrice: itemTotal,
        },
      ],
      subtotal,
      tax,
      total,
      status: "SENT",
      orderDate: new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
      expectedDelivery: "2 Hari ke Depan",
      notes: poNotes,
    });

    setIsPOModalOpen(false);
    setSuccessToast(`Purchase Order berhasil diterbitkan dan dikirim ke ${poSupplier}!`);
    setTimeout(() => setSuccessToast(""), 4500);
  };

  const handleReceivePO = (poId: string) => {
    receivePurchaseOrder(poId);
    setSuccessToast(`Barang PO berhasil diterima & stok gudang otomatis bertambah!`);
    setTimeout(() => setSuccessToast(""), 4500);
  };

  const getStockExportData = () => {
    const headers = [
      "ID Bahan",
      "Nama Bahan Baku",
      "Kategori",
      "Sisa Stok",
      "Satuan",
      "Stok Minimum",
      "Harga Satuan (Rp)",
      "Nilai Total Aset (Rp)",
      "Status Stok",
      "Supplier Utama",
      "Terakhir Diperbarui",
    ];
    const rows = filteredIngredients.map((item) => [
      item.id,
      item.name,
      item.category,
      item.stockNumber,
      item.unit,
      item.min,
      item.costPerUnit,
      item.stockNumber * item.costPerUnit,
      item.status,
      item.supplier,
      item.lastUpdated,
    ]);
    return { headers, rows };
  };

  const handleExportStockCSV = () => {
    const { headers, rows } = getStockExportData();
    downloadCSV(`Master_Stok_Bahan_Baku_${Date.now()}`, headers, rows);
    setSuccessToast("Data stok bahan baku berhasil diekspor ke format CSV!");
    setTimeout(() => setSuccessToast(""), 4000);
  };

  const handleExportStockExcel = () => {
    const { headers, rows } = getStockExportData();
    downloadExcel(`Master_Stok_Bahan_Baku_${Date.now()}`, "Master Stok", headers, rows);
    setSuccessToast("Data stok bahan baku berhasil diekspor ke format Excel (.xls)!");
    setTimeout(() => setSuccessToast(""), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-bold flex items-center space-x-2 animate-in fade-in shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Critical / Out of Stock Restock Alert Banner */}
      {(criticalItems.length > 0 || outOfStockItems.length > 0) && (
        <div className="p-4 bg-gradient-to-r from-rose-50 via-amber-50 to-rose-50 border border-rose-300 rounded-2xl flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm animate-pulse">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                <span>Peringatan Restock Bahan Baku ({criticalItems.length + outOfStockItems.length} Item Memerlukan Tindakan)</span>
                {outOfStockItems.length > 0 && (
                  <span className="bg-rose-600 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">
                    {outOfStockItems.length} HABIS
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Bahan baku berada di bawah batas minimum safety stock. Produk menu terkait akan otomatis bertanda <strong>Habis</strong> / <strong>Stok Menipis</strong> di POS dan QR Table.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => setIsRestockAlertModalOpen(true)}
            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold space-x-1.5 shadow-sm"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Lihat Rekomendasi Restock</span>
          </Button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Package className="w-5 h-5 text-purple-600" />
            <span>Smart Inventory & Recipe COGS — {activeOutlet?.name || "Singaraja"}</span>
          </h2>
          <p className="text-xs text-slate-500">
            Outlet: <strong>{activeOutlet?.name || "Singaraja"}</strong> • Pemantauan stok real-time, pengurangan otomatis resep BOM, dan PO Supplier.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-bold shadow-2xs"
            onClick={handleExportStockExcel}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            Export Excel
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs border-slate-300 text-slate-700 hover:bg-slate-100 font-bold"
            onClick={handleExportStockCSV}
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
            Export CSV
          </Button>
          <Button
            size="sm"
            className="text-xs bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-xs"
            onClick={() => setIsPDFModalOpen(true)}
          >
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Cetak PDF Valuasi
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs border-purple-200 text-purple-700 hover:bg-purple-50 font-bold rounded-xl"
            onClick={() => setIsBOMSimulatorModalOpen(true)}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
            Kalkulasi Resep Menu
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold rounded-xl"
            onClick={() => setIsStockAdjModalOpen(true)}
          >
            <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
            Penyesuaian Stok
          </Button>
          <Button
            size="sm"
            className="text-xs bg-brand-orange hover:bg-orange-600 text-white font-bold rounded-xl shadow-xs"
            onClick={() => setIsPOModalOpen(true)}
          >
            <Truck className="w-3.5 h-3.5 mr-1.5" />
            + Buat Draft PO
          </Button>
        </div>
      </div>

      {/* Metric Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400">Nilai Aset Stok Bahan</p>
            <Package className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrencyIDR(totalStockValue)}</p>
          <p className="text-[11px] text-slate-500 mt-1">Total {filteredIngredients.length} master bahan baku</p>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400">Peringatan Kritis (Urgent)</p>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-xl font-bold text-rose-600 mt-1">{criticalItems.length} Item</p>
          <p className="text-[11px] text-rose-500 font-medium mt-1">Stok &lt; 40% batas minimum</p>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400">Mendekati Batas Minimum</p>
            <TrendingDown className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-bold text-amber-600 mt-1">{lowCount} Item</p>
          <p className="text-[11px] text-amber-600 font-medium mt-1">Perlu reorder minggu ini</p>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400">PO Berjalan / Terkirim</p>
            <Truck className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl font-bold text-blue-600 mt-1">
            {filteredPurchaseOrders.filter((p) => p.status === "SENT" || p.status === "DRAFT").length} PO
          </p>
          <p className="text-[11px] text-blue-500 font-medium mt-1">Menunggu pengiriman supplier</p>
        </Card>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center space-x-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("STOCK")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === "STOCK"
              ? "border-purple-600 text-purple-600 bg-purple-50/50"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Master Stok Bahan Baku ({filteredIngredients.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("BOM")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === "BOM"
              ? "border-purple-600 text-purple-600 bg-purple-50/50"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>BOM Resep Menu & COGS ({recipes.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("PO")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === "PO"
              ? "border-purple-600 text-purple-600 bg-purple-50/50"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Purchase Order (PO) Supplier ({filteredPurchaseOrders.length})</span>
        </button>
      </div>

      {/* TAB 1: MASTER STOK BAHAN BAKU */}
      {activeTab === "STOCK" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center space-x-2 flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari bahan baku, kategori, atau supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-transparent border-none outline-hidden text-slate-800 placeholder-slate-400"
              />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500 font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 outline-hidden"
              >
                <option value="ALL">Semua Status ({filteredIngredients.length})</option>
                <option value="CRITICAL">Critical / Kritis ({criticalItems.length})</option>
                <option value="LOW">Low Stock ({lowCount})</option>
                <option value="SAFE">Safe / Aman</option>
              </select>
            </div>
          </div>

          {/* Stock Table */}
          <Card className="shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                  <tr>
                    <th className="p-3.5">Nama Bahan Baku</th>
                    <th className="p-3.5">Kategori</th>
                    <th className="p-3.5 text-right">Stok Aktual</th>
                    <th className="p-3.5 text-right">Batas Min (Reorder)</th>
                    <th className="p-3.5 text-right">Biaya Satuan</th>
                    <th className="p-3.5">Supplier Utama</th>
                    <th className="p-3.5 text-center">Status Stok</th>
                    <th className="p-3.5 text-center">Aksi Cepat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {displayedIngredients.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5 font-bold text-slate-900">
                        {item.name}
                        <div className="text-[10px] text-slate-400 font-normal">Update: {item.lastUpdated}</div>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                          {item.category}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-sm">
                        <span
                          className={
                            item.stockNumber <= 0
                              ? "text-rose-700 font-extrabold"
                              : item.status === "CRITICAL"
                              ? "text-rose-600"
                              : item.status === "LOW"
                              ? "text-amber-600"
                              : "text-slate-900"
                          }
                        >
                          {item.stockNumber} {item.unit}
                        </span>
                      </td>
                      <td className="p-3.5 text-right text-slate-500 font-mono">
                        {item.min} {item.unit}
                      </td>
                      <td className="p-3.5 text-right font-mono font-medium text-slate-800">
                        {formatCurrencyIDR(item.costPerUnit)}
                      </td>
                      <td className="p-3.5 text-slate-600 font-medium">{item.supplier}</td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center space-x-1 ${
                            item.stockNumber <= 0
                              ? "bg-rose-600 text-white"
                              : item.status === "CRITICAL"
                              ? "bg-rose-100 text-rose-800 border border-rose-200"
                              : item.status === "LOW"
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          }`}
                        >
                          {item.stockNumber <= 0 ? (
                            <span>HABIS</span>
                          ) : (
                            <>
                              {item.status === "CRITICAL" && <AlertTriangle className="w-3 h-3 text-rose-600 mr-1" />}
                              <span>{item.status}</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => {
                              setAdjItemId(item.id);
                              setAdjDelta(5);
                              setIsStockAdjModalOpen(true);
                            }}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold"
                          >
                            Adjust
                          </button>
                          <button
                            onClick={() => {
                              setPOSupplier(item.supplier);
                              setPOItemId(item.id);
                              setPOQuantity(item.min * 2);
                              setIsPOModalOpen(true);
                            }}
                            className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded text-[10px] font-bold"
                          >
                            + PO
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Real-Time Stock Movement Logs */}
          {logs.length > 0 && (
            <Card className="p-4 bg-slate-50 border border-slate-200">
              <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center space-x-2">
                <RefreshCw className="w-3.5 h-3.5 text-purple-600" />
                <span>Log Perubahan & Audit Trail Stok Real-Time</span>
              </h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 bg-white rounded-lg border border-slate-200 text-[11px] flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2">
                      <span
                        className={`font-mono font-bold ${
                          log.delta < 0 ? "text-rose-600" : "text-emerald-600"
                        }`}
                      >
                        {log.delta > 0 ? `+${log.delta}` : log.delta}
                      </span>
                      <span className="font-semibold text-slate-800">{log.ingredientName}</span>
                      <span className="text-slate-400">({log.reason})</span>
                    </div>
                    <div className="flex items-center space-x-2 text-slate-500">
                      <span>Sebelum: {log.previousStock} ➔ Sesudah: {log.currentStock}</span>
                      <span>•</span>
                      <span>{log.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* TAB 2: BOM RESEP MENU & COGS */}
      {activeTab === "BOM" && (
        <div className="space-y-4">
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Bill of Materials (BOM) & Otomasi Pemotongan Resep</p>
                <p className="text-purple-700 mt-0.5">
                  Setiap item menu memiliki formula resep bahan baku baku. Saat kasir POS atau pelanggan menyelesaikan pesanan, sistem secara presisi memotong stok bahan baku dan menghitung HPP (COGS) aktual.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0">
              <Button
                size="sm"
                onClick={() => {
                  setSelectedRecipeForEdit(null);
                  setIsRecipeModalOpen(true);
                }}
                className="text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold space-x-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Input Resep Baru</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recipes.map((rec) => (
              <Card key={rec.menuId} className="p-4 border border-slate-200 shadow-xs hover:border-purple-300 transition-all">
                <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{rec.menuName}</h3>
                    <span className="text-[10px] text-slate-400 font-medium">{rec.category}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-900">{formatCurrencyIDR(rec.sellingPrice)}</span>
                    <div className="text-[10px] text-emerald-600 font-bold">Margin {rec.grossMarginPercent}%</div>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Komposisi Bahan Baku (BOM):</p>
                    <span className="text-[10px] text-purple-600 font-bold">{rec.ingredients.length} Bahan</span>
                  </div>
                  <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    {rec.ingredients.map((ing, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                          <span className="font-medium text-slate-700">{ing.ingredientName}</span>
                          <span className="text-slate-400">({ing.quantityRequired || 1} {ing.unit})</span>
                        </div>
                        <span className="font-mono text-slate-600">{formatCurrencyIDR(ing.costEstimate)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500 font-medium">Total COGS / Porsi: </span>
                    <span className="font-bold font-mono text-slate-900">
                      {formatCurrencyIDR(
                        rec.totalCOGS ||
                          rec.ingredients.reduce((s, i) => s + (i.costEstimate || 0), 0)
                      )}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedRecipeForEdit(rec);
                      setIsRecipeModalOpen(true);
                    }}
                    className="px-2.5 py-1 text-xs font-bold text-purple-600 hover:bg-purple-50 border border-purple-200 rounded-lg transition-colors"
                  >
                    Edit Formula
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: PURCHASE ORDER (PO) */}
      {activeTab === "PO" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Daftar Purchase Order (PO) Supplier</h3>
              <p className="text-xs text-slate-500">Kelola pemesanan bahan baku, pengiriman dan penerimaan restock gudang.</p>
            </div>
            <Button
              size="sm"
              className="text-xs bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => setIsPOModalOpen(true)}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Buat PO Baru
            </Button>
          </div>

          <Card className="shadow-xs overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                <tr>
                  <th className="p-3.5">No. PO</th>
                  <th className="p-3.5">Supplier</th>
                  <th className="p-3.5">Item Barang</th>
                  <th className="p-3.5 text-right">Total Nilai PO</th>
                  <th className="p-3.5">Tgl Order</th>
                  <th className="p-3.5">Estimasi Tiba</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredPurchaseOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50">
                    <td className="p-3.5 font-mono font-bold text-purple-700">{po.poNumber}</td>
                    <td className="p-3.5 font-semibold text-slate-900">{po.supplier}</td>
                    <td className="p-3.5">
                      {po.items.map((i, idx) => (
                        <div key={idx} className="text-slate-600">
                          {i.name} ({i.quantity} {i.unit})
                        </div>
                      ))}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                      {formatCurrencyIDR(po.total)}
                    </td>
                    <td className="p-3.5 text-slate-500">{po.orderDate}</td>
                    <td className="p-3.5 text-slate-600 font-medium">{po.expectedDelivery}</td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          po.status === "RECEIVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : po.status === "SENT"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {po.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          onClick={() => setSelectedPOPreview(po)}
                          className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                          title="Lihat Dokumen PO"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {po.status === "SENT" && (
                          <button
                            onClick={() => handleReceivePO(po.id)}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold"
                          >
                            Terima Barang
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* MODAL: RESTOCK ALERT POPUP */}
      {isRestockAlertModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Peringatan Restock Bahan Kritis & Habis — {activeOutlet?.name || "Singaraja"}
                </h3>
              </div>
              <button
                onClick={() => setIsRestockAlertModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Berikut rincian bahan baku yang berada di bawah ambang batas minimum dan rekomendasi pengadaan:
              </p>

              <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                {[...outOfStockItems, ...criticalItems.filter((c) => !outOfStockItems.some((o) => o.id === c.id))].map((item) => (
                  <div key={item.id} className="p-3 flex items-center justify-between bg-slate-50/50 hover:bg-slate-50">
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900">{item.name}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                          item.stockNumber <= 0 ? "bg-rose-600 text-white" : "bg-amber-100 text-amber-800"
                        }`}>
                          {item.stockNumber <= 0 ? "HABIS" : "CRITICAL"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Sisa Stok: <strong className="font-mono text-rose-600">{item.stockNumber} {item.unit}</strong> • Batas Min: <strong className="font-mono text-slate-700">{item.min} {item.unit}</strong>
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Supplier: {item.supplier} • Terakhir Update: {item.lastUpdated}
                      </p>
                    </div>

                    <div className="text-right space-y-1">
                      <p className="text-[11px] font-semibold text-purple-700">
                        Rekomendasi: +{item.min * 2} {item.unit}
                      </p>
                      <Button
                        size="sm"
                        onClick={() => {
                          setIsRestockAlertModalOpen(false);
                          setPOSupplier(item.supplier);
                          setPOItemId(item.id);
                          setPOQuantity(item.min * 2);
                          setIsPOModalOpen(true);
                        }}
                        className="text-[10px] h-7 px-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold"
                      >
                        + Terbitkan PO
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsRestockAlertModalOpen(false)}
              >
                Tutup Peringatan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: STOCK ADJUSTMENT */}
      {isStockAdjModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                <ArrowUpDown className="w-4 h-4 text-purple-600" />
                <span>Form Penyesuaian Stok Gudang</span>
              </h3>
              <button
                onClick={() => setIsStockAdjModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStockAdjustment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Pilih Bahan Baku</label>
                <select
                  value={adjItemId}
                  onChange={(e) => setAdjItemId(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold text-slate-800 outline-hidden"
                >
                  {filteredIngredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (Stok Saat Ini: {i.stockNumber} {i.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Perubahan (+ / -)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={adjDelta}
                    onChange={(e) => setAdjDelta(Number(e.target.value))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono font-bold text-slate-800 outline-hidden"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Gunakan tanda minus (-) untuk pengurangan</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Alasan Penyesuaian</label>
                  <select
                    value={adjReason}
                    onChange={(e) => setAdjReason(e.target.value as StockAdjustmentLog["reason"])}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-700 outline-hidden"
                  >
                    <option value="PO_MASUK">Penerimaan PO Supplier</option>
                    <option value="OPNAME_HILANG_RUSAK">Stock Opname / Rusak</option>
                    <option value="MANUAL_ADJUSTMENT">Koreksi Manual</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setIsStockAdjModalOpen(false)}
                >
                  Batal
                </Button>
                <Button type="submit" size="sm" className="text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold">
                  Simpan Perubahan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: BOM SIMULATOR */}
      {isBOMSimulatorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-brand-orange" />
                <span>Simulasi Pengurangan Resep Menu (BOM)</span>
              </h3>
              <button
                onClick={() => setIsBOMSimulatorModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRunBOMSimulation} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Pilih Menu Produk</label>
                <select
                  value={simMenuId}
                  onChange={(e) => setSimMenuId(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold text-slate-800 outline-hidden"
                >
                  {recipes.map((r) => (
                    <option key={r.menuId} value={r.menuId}>
                      {r.menuName} ({formatCurrencyIDR(r.sellingPrice)} - COGS {formatCurrencyIDR(r.totalCOGS)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Jumlah Porsi Pesanan (Qty)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={simQty}
                  onChange={(e) => setSimQty(Number(e.target.value))}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono font-bold text-slate-800 outline-hidden"
                  required
                />
              </div>

              {(() => {
                const rec = recipes.find((r) => r.menuId === simMenuId);
                if (!rec) return null;
                return (
                  <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100 space-y-2">
                    <p className="text-[11px] font-bold text-purple-900">Bahan yang Akan Dipotong Otomatis:</p>
                    {rec.ingredients.map((ing, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs text-purple-950">
                        <span>• {ing.ingredientName}</span>
                        <span className="font-mono font-bold">
                          -{(ing.quantityRequired * simQty).toFixed(3)} {ing.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setIsBOMSimulatorModalOpen(false)}
                >
                  Tutup
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="text-xs bg-brand-orange hover:bg-brand-orange/90 text-white font-bold"
                >
                  Proses Pengurangan Stok
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE PO */}
      {isPOModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                <Truck className="w-4 h-4 text-purple-600" />
                <span>Terbitkan Purchase Order (PO)</span>
              </h3>
              <button
                onClick={() => setIsPOModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePO} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Supplier</label>
                <input
                  type="text"
                  required
                  value={poSupplier}
                  onChange={(e) => setPOSupplier(e.target.value)}
                  className="w-full border rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Pilih Item Bahan</label>
                <select
                  value={poItemId}
                  onChange={(e) => setPOItemId(e.target.value)}
                  className="w-full border rounded-xl p-2.5 bg-white font-bold"
                >
                  {filteredIngredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({formatCurrencyIDR(i.costPerUnit)} / {i.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Jumlah Pemesanan (Qty)</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={poQuantity}
                  onChange={(e) => setPOQuantity(Number(e.target.value))}
                  className="w-full border rounded-xl p-2.5 font-bold font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan PO</label>
                <input
                  type="text"
                  value={poNotes}
                  onChange={(e) => setPONotes(e.target.value)}
                  className="w-full border rounded-xl p-2.5"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPOModalOpen(false)}
                >
                  Batal
                </Button>
                <Button type="submit" size="sm" className="bg-purple-600 text-white font-bold">
                  Kirim PO ke Supplier
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Inventory Valuation Report Modal */}
      <InventoryReportPDFModal
        isOpen={isPDFModalOpen}
        onClose={() => setIsPDFModalOpen(false)}
        ingredients={filteredIngredients}
        outletName={activeOutlet?.name || "Singaraja"}
      />

      {/* Interactive BOM Recipe Formulation & AI Modal */}
      <BOMRecipeModal
        isOpen={isRecipeModalOpen}
        onClose={() => {
          setIsRecipeModalOpen(false);
          setSelectedRecipeForEdit(null);
        }}
        products={products}
        ingredients={filteredIngredients}
        initialRecipe={selectedRecipeForEdit}
        onSaveRecipe={(recipe) => {
          upsertRecipe(recipe);
          setSuccessToast(`Resep BOM untuk "${recipe.menuName}" berhasil disimpan & terintegrasi!`);
          setTimeout(() => setSuccessToast(""), 4000);
        }}
      />
    </div>
  );
}
