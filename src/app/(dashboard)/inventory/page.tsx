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
  ClipboardCheck,
  Scale,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrencyIDR } from "@/lib/utils";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";
import { PurchaseOrder, StockAdjustmentLog, RecipeBOM, StockOpnameRecord, StockOpnameReason } from "@/types/inventory";
import { useProducts } from "@/contexts/ProductContext";
import { InventoryReportPDFModal } from "@/features/inventory/InventoryReportPDFModal";
import { StockOpnameReportPDFModal } from "@/features/inventory/StockOpnameReportPDFModal";
import { BOMRecipeModal } from "@/features/inventory/BOMRecipeModal";
import { ProFeatureBadge } from "@/components/premium";

export default function InventoryPage() {
  const { activeOutlet, activeOutletId } = useOutlet();
  const { products } = useProducts();
  const {
    filteredIngredients,
    recipes,
    filteredPurchaseOrders,
    logs,
    stockOpnames,
    recordStockOpname,
    adjustStock,
    simulateBOMDeduction,
    upsertRecipe,
    deleteRecipe,
    createPurchaseOrder,
    receivePurchaseOrder,
  } = useInventory();

  const [activeTab, setActiveTab] = useState<"STOCK" | "BOM" | "PO" | "OPNAME">("STOCK");

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
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

  // Stock Opname State (Revisi 8)
  const [isOpnameModalOpen, setIsOpnameModalOpen] = useState(false);
  const [opnameItemId, setOpnameItemId] = useState(filteredIngredients[0]?.id || "ing-1");
  const [opnamePhysicalStock, setOpnamePhysicalStock] = useState<number>(0);
  const [opnameReason, setOpnameReason] = useState<StockOpnameReason>("RECORDING_ERROR");
  const [opnameNotes, setOpnameNotes] = useState("");
  const [opnameAuditor, setOpnameAuditor] = useState("Staff Auditor Gudang");
  const [opnameSearchQuery, setOpnameSearchQuery] = useState("");
  const [opnameReasonFilter, setOpnameReasonFilter] = useState<string>("ALL");
  const [isOpnamePDFModalOpen, setIsOpnamePDFModalOpen] = useState(false);
  const [sessionAuditedIds, setSessionAuditedIds] = useState<string[]>([]);

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

  // Categories list
  const ingredientCategories = Array.from(new Set(filteredIngredients.map((item) => item.category))).filter(Boolean);

  // Filtered Stock
  const displayedIngredients = filteredIngredients.filter((item) => {
    const matchStatus =
      statusFilter === "ALL" ||
      (statusFilter === "OUT_OF_STOCK" && item.stockNumber <= 0) ||
      (statusFilter === "CRITICAL" && (item.status === "CRITICAL" || (item.stockNumber <= item.min * 0.4 && item.stockNumber > 0))) ||
      (statusFilter === "LOW" && item.status === "LOW" && item.stockNumber > 0) ||
      (statusFilter === "SAFE" && item.status === "SAFE") ||
      item.status === statusFilter;
    const matchCategory = categoryFilter === "ALL" || item.category === categoryFilter;
    const matchSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchCategory && matchSearch;
  });

  // KPI Calculations
  const criticalItems = filteredIngredients.filter((i) => i.status === "CRITICAL" || i.stockNumber <= i.min * 0.4);
  const outOfStockItems = filteredIngredients.filter((i) => i.stockNumber <= 0);
  const lowCount = filteredIngredients.filter((i) => i.status === "LOW" && i.stockNumber > 0).length;
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

  // Handlers for Stock Opname (Revisi 8)
  const handleOpenOpnameModal = (ingredientId?: string) => {
    const targetId = ingredientId || filteredIngredients[0]?.id || "ing-1";
    const target = filteredIngredients.find((i) => i.id === targetId);
    setOpnameItemId(targetId);
    setOpnamePhysicalStock(target ? target.stockNumber : 0);
    setOpnameReason("RECORDING_ERROR");
    setOpnameNotes("");
    setIsOpnameModalOpen(true);
  };

  const handleSaveStockOpname = (e: React.FormEvent) => {
    e.preventDefault();
    const target = filteredIngredients.find((i) => i.id === opnameItemId);
    if (!target) return;

    const physicalCount = Number(opnamePhysicalStock);
    const sysStock = target.stockNumber;
    const variance = physicalCount - sysStock;

    // Guard: Prevent double adjustment for same item in same opname session
    if (sessionAuditedIds.includes(target.id)) {
      alert(`Bahan "${target.name}" sudah disesuaikan pada sesi opname ini. Penyesuaian ganda dicegah.`);
      return;
    }

    // Guard: Mandatory reason note if variance exists
    if (variance !== 0 && !opnameNotes.trim()) {
      alert("Catatan / alasan penyesuaian wajib diisi jika terdapat selisih antara stok fisik dan sistem!");
      return;
    }

    const result = recordStockOpname({
      date: new Date().toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      ingredientId: target.id,
      ingredientName: target.name,
      category: target.category,
      unit: target.unit,
      systemStock: sysStock,
      physicalStock: physicalCount,
      reason: opnameReason,
      reasonNotes: opnameNotes.trim() || undefined,
      performedBy: opnameAuditor.trim() || "Staff Auditor Gudang",
      tenantId: activeOutletId,
      outletId: activeOutletId,
    });

    setSessionAuditedIds((prev) => [...prev, target.id]);
    setIsOpnameModalOpen(false);
    setSuccessToast(
      `Stock Opname ${result.opnameNumber} (${target.name}) berhasil disimpan! Selisih: ${variance > 0 ? `+${variance}` : variance} ${target.unit}. Stok sistem diselaraskan menjadi ${physicalCount} ${target.unit}.`
    );
    setTimeout(() => setSuccessToast(""), 5000);
  };

  const getOpnameExportData = () => {
    const headers = [
      "No. Opname",
      "Tanggal Audit",
      "Bahan Baku",
      "Kategori",
      "Satuan",
      "Stok Sistem",
      "Stok Fisik",
      "Selisih (Variance)",
      "Status Selisih",
      "Alasan Selisih",
      "Catatan",
      "Auditor / Pelaksana",
    ];
    const rows = stockOpnames.map((o) => [
      o.opnameNumber,
      o.date,
      o.ingredientName,
      o.category,
      o.unit,
      o.systemStock,
      o.physicalStock,
      o.variance,
      o.varianceType,
      o.reason,
      o.reasonNotes || "-",
      o.performedBy,
    ]);
    return { headers, rows };
  };

  const handleExportOpnameCSV = () => {
    const { headers, rows } = getOpnameExportData();
    downloadCSV(`Laporan_Stock_Opname_${Date.now()}`, headers, rows);
    setSuccessToast("Laporan histori Stock Opname berhasil diekspor ke CSV!");
    setTimeout(() => setSuccessToast(""), 4000);
  };

  const handleExportOpnameExcel = () => {
    const { headers, rows } = getOpnameExportData();
    downloadExcel(`Laporan_Stock_Opname_${Date.now()}`, "Stock Opname", headers, rows);
    setSuccessToast("Laporan histori Stock Opname berhasil diekspor ke Excel (.xls)!");
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
        <div className="p-4 sm:p-5 bg-rose-50/70 border border-rose-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
              <BellRing className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900">
                  Peringatan Restock Bahan Baku ({criticalItems.length + outOfStockItems.length} Item Memerlukan Tindakan)
                </h3>
                {outOfStockItems.length > 0 && (
                  <span className="bg-rose-100 text-rose-700 border border-rose-200 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                    {outOfStockItems.length} HABIS
                  </span>
                )}
                {criticalItems.length > 0 && (
                  <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                    {criticalItems.length} KRITIS
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Bahan baku berada di bawah batas minimum safety stock. Produk menu terkait akan otomatis bertanda <strong>Habis</strong> / <strong>Stok Menipis</strong> di POS kasir dan QR Self-Order.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => setIsRestockAlertModalOpen(true)}
            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl px-4 py-2 shrink-0 shadow-xs transition-all flex items-center gap-1.5"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Lihat Rekomendasi Restock</span>
          </Button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div className="flex items-start space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100 mt-0.5">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Smart Inventory & Recipe COGS</span>
              <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-100">
                {activeOutlet?.name || "Singaraja"}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pemantauan stok real-time, kalkulasi pemotongan otomatis resep BOM, dan manajemen PO Supplier.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs border-slate-200 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 font-semibold rounded-xl shadow-2xs"
            onClick={handleExportStockExcel}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            Export Excel
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs border-slate-200 text-slate-700 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 font-semibold rounded-xl shadow-2xs"
            onClick={handleExportStockCSV}
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
            Export CSV
          </Button>
          <Button
            size="sm"
            className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl shadow-xs"
            onClick={() => setIsPDFModalOpen(true)}
          >
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Cetak PDF Valuasi
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs border-purple-200 text-purple-700 hover:bg-purple-50 font-semibold rounded-xl shadow-2xs flex items-center space-x-1.5"
            onClick={() => setIsBOMSimulatorModalOpen(true)}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Kalkulasi Resep Menu</span>
            <ProFeatureBadge label="ADD-ON" variant="addon" size="xs" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold rounded-xl shadow-2xs"
            onClick={() => setIsStockAdjModalOpen(true)}
          >
            <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
            Penyesuaian Stok
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-semibold rounded-xl shadow-2xs"
            onClick={() => handleOpenOpnameModal()}
          >
            <ClipboardCheck className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
            Catat Stock Opname
          </Button>
          <Button
            size="sm"
            className="text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl shadow-xs"
            onClick={() => setIsPOModalOpen(true)}
          >
            <Truck className="w-3.5 h-3.5 mr-1.5" />
            + Buat Draft PO
          </Button>
        </div>
      </div>

      {/* Metric Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500">Nilai Aset Stok Bahan</p>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900 mt-2 tracking-tight">{formatCurrencyIDR(totalStockValue)}</p>
          <p className="text-[11px] text-slate-500 mt-1">Total {filteredIngredients.length} master bahan baku terdaftar</p>
        </Card>

        <Card className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500">Peringatan Kritis (Urgent)</p>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-rose-600 mt-2 tracking-tight">{criticalItems.length} Item</p>
          <p className="text-[11px] text-rose-600 font-medium mt-1">Stok &lt; 40% batas minimum reorder</p>
        </Card>

        <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Mendekati Batas Minimum</p>
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary dark:bg-primary/20 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-2 tracking-tight">{lowCount} Item</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">Perlu reorder dalam minggu operasional ini</p>
        </Card>

        <Card className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500">PO Berjalan / Terkirim</p>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-blue-600 mt-2 tracking-tight">
            {filteredPurchaseOrders.filter((p) => p.status === "SENT" || p.status === "DRAFT").length} PO
          </p>
          <p className="text-[11px] text-blue-600 font-medium mt-1">Menunggu pengiriman supplier resmi</p>
        </Card>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center space-x-2 border-b border-slate-200/80 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab("STOCK")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 shrink-0 ${
            activeTab === "STOCK"
              ? "border-purple-600 text-purple-700 bg-purple-50/50 rounded-t-lg"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Master Stok Bahan Baku</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === "STOCK" ? "bg-purple-100 text-purple-800" : "bg-slate-100 text-slate-600"}`}>
            {filteredIngredients.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("BOM")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 shrink-0 ${
            activeTab === "BOM"
              ? "border-purple-600 text-purple-700 bg-purple-50/50 rounded-t-lg"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>BOM Resep Menu & COGS</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === "BOM" ? "bg-purple-100 text-purple-800" : "bg-slate-100 text-slate-600"}`}>
            {recipes.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("PO")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 shrink-0 ${
            activeTab === "PO"
              ? "border-purple-600 text-purple-700 bg-purple-50/50 rounded-t-lg"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Purchase Order (PO)</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === "PO" ? "bg-purple-100 text-purple-800" : "bg-slate-100 text-slate-600"}`}>
            {filteredPurchaseOrders.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("OPNAME")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 shrink-0 ${
            activeTab === "OPNAME"
              ? "border-indigo-600 text-indigo-700 bg-indigo-50/50 rounded-t-lg"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <ClipboardCheck className="w-4 h-4 text-indigo-600" />
          <span>Stock Opname & Audit Fisik</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === "OPNAME" ? "bg-indigo-100 text-indigo-800" : "bg-slate-100 text-slate-600"}`}>
            {stockOpnames.length}
          </span>
        </button>
      </div>

      {/* TAB 1: MASTER STOK BAHAN BAKU */}
      {activeTab === "STOCK" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-2 flex-1 max-w-lg bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 focus-within:border-purple-400 focus-within:bg-white transition-all">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Cari nama bahan baku, kategori, atau supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-transparent border-none outline-hidden text-slate-800 placeholder-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-slate-400 hover:text-slate-600"
                  title="Hapus pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Category Filter */}
              <div className="flex items-center space-x-1.5">
                <span className="text-xs text-slate-500 font-medium hidden sm:inline">Kategori:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700 outline-hidden hover:bg-slate-100/70 transition-colors"
                >
                  <option value="ALL">Semua Kategori ({ingredientCategories.length})</option>
                  {ingredientCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center space-x-1.5">
                <span className="text-xs text-slate-500 font-medium hidden sm:inline">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700 outline-hidden hover:bg-slate-100/70 transition-colors"
                >
                  <option value="ALL">Semua Status ({filteredIngredients.length})</option>
                  <option value="OUT_OF_STOCK">Stok Habis / 0 ({outOfStockItems.length})</option>
                  <option value="CRITICAL">Critical / Kritis ({criticalItems.length})</option>
                  <option value="LOW">Low Stock / Menipis ({lowCount})</option>
                  <option value="SAFE">Safe / Aman</option>
                </select>
              </div>

              {/* Reset Filters button if any active */}
              {(searchQuery || statusFilter !== "ALL" || categoryFilter !== "ALL") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("ALL");
                    setCategoryFilter("ALL");
                  }}
                  className="text-xs text-purple-600 hover:text-purple-800 font-semibold px-2 py-1.5 rounded-lg hover:bg-purple-50 transition-colors"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>

          {/* Stock Table */}
          <Card className="shadow-xs overflow-hidden rounded-2xl border border-slate-200/80">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Nama Bahan Baku</th>
                    <th className="py-3.5 px-3">Kategori</th>
                    <th className="py-3.5 px-4 text-right">Stok Aktual & Level</th>
                    <th className="py-3.5 px-3 text-right">Batas Min</th>
                    <th className="py-3.5 px-3 text-right">Biaya Satuan</th>
                    <th className="py-3.5 px-4">Supplier Utama</th>
                    <th className="py-3.5 px-3 text-center">Status Stok</th>
                    <th className="py-3.5 px-4 text-center">Aksi Cepat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {displayedIngredients.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 px-4 text-center">
                        <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                            <Package className="w-6 h-6" />
                          </div>
                          <h4 className="text-sm font-bold text-slate-800">Tidak ada bahan baku yang cocok</h4>
                          <p className="text-xs text-slate-500 mt-1 text-center">
                            Tidak ditemukan bahan dengan kata kunci pencarian atau filter status yang dipilih.
                          </p>
                          {(searchQuery || statusFilter !== "ALL" || categoryFilter !== "ALL") && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSearchQuery("");
                                setStatusFilter("ALL");
                                setCategoryFilter("ALL");
                              }}
                              className="mt-3.5 text-xs rounded-xl"
                            >
                              Reset Semua Filter
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    displayedIngredients.map((item) => {
                      const isOutOfStock = item.stockNumber <= 0;
                      const isCritical = !isOutOfStock && (item.status === "CRITICAL" || item.stockNumber <= item.min * 0.4);
                      const isLow = !isOutOfStock && !isCritical && item.status === "LOW";
                      const stockPercentage = Math.min(100, Math.max(0, (item.stockNumber / Math.max(item.min * 2, 1)) * 100));

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                            <span>{item.name}</span>
                            <div className="text-[10px] text-slate-500 dark:text-slate-300 font-normal mt-0.5">
                              Update: {item.lastUpdated}
                            </div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-200/60 whitespace-nowrap">
                              {item.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex flex-col items-end">
                              <span
                                className={`font-mono font-bold text-sm ${
                                  isOutOfStock
                                    ? "text-rose-700"
                                    : isCritical
                                    ? "text-rose-600"
                                    : isLow
                                    ? "text-amber-700"
                                    : "text-slate-900"
                                }`}
                              >
                                {item.stockNumber.toLocaleString("id-ID")}{" "}
                                <span className="text-xs font-normal text-slate-500">{item.unit}</span>
                              </span>
                              {/* Mini stock level bar */}
                              <div className="w-20 bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    isOutOfStock
                                      ? "bg-rose-500 w-full"
                                      : isCritical
                                      ? "bg-rose-500"
                                      : isLow
                                      ? "bg-amber-400"
                                      : "bg-emerald-500"
                                  }`}
                                  style={{ width: `${isOutOfStock ? 100 : stockPercentage}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <span className="text-slate-700 dark:text-slate-200 font-mono text-xs">
                              {item.min.toLocaleString("id-ID")}{" "}
                              <span className="text-[10px] text-slate-500 dark:text-slate-300 font-normal">{item.unit}</span>
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            {formatCurrencyIDR(item.costPerUnit)}
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-200 font-medium whitespace-nowrap">{item.supplier}</td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            {isOutOfStock ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                                <Ban className="w-3 h-3 text-rose-500 shrink-0" />
                                <span>Habis</span>
                              </span>
                            ) : isCritical ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                                <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                                <span>Kritis</span>
                              </span>
                            ) : isLow ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                                <TrendingDown className="w-3 h-3 text-amber-600 shrink-0" />
                                <span>Menipis</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                <span>Aman</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center space-x-1.5 whitespace-nowrap shrink-0">
                              <button
                                onClick={() => {
                                  setAdjItemId(item.id);
                                  setAdjDelta(5);
                                  setIsStockAdjModalOpen(true);
                                }}
                                className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 shadow-2xs"
                                title="Koreksi / Penyesuaian Stok Cepat"
                              >
                                <ArrowUpDown className="w-3 h-3 text-slate-500" />
                                <span>Adjust</span>
                              </button>
                              <button
                                onClick={() => {
                                  setPOSupplier(item.supplier);
                                  setPOItemId(item.id);
                                  setPOQuantity(item.min * 2);
                                  setIsPOModalOpen(true);
                                }}
                                className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 shadow-2xs"
                                title="Buat Draft Purchase Order Baru"
                              >
                                <Plus className="w-3 h-3 text-purple-600" />
                                <span>PO</span>
                              </button>
                              <button
                                onClick={() => handleOpenOpnameModal(item.id)}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 shadow-2xs"
                                title="Audit & Hitung Fisik Bahan Ini"
                              >
                                <ClipboardCheck className="w-3 h-3 text-indigo-600" />
                                <span>Opname</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Real-Time Stock Movement Logs */}
          {logs.length > 0 && (
            <Card className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl shadow-xs">
              <h4 className="text-xs font-bold text-slate-800 mb-2.5 flex items-center space-x-2">
                <RefreshCw className="w-3.5 h-3.5 text-purple-600" />
                <span>Log Perubahan & Audit Trail Stok Real-Time</span>
              </h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 bg-white rounded-xl border border-slate-200 text-[11px] flex items-center justify-between shadow-2xs"
                  >
                    <div className="flex items-center space-x-2">
                      <span
                        className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] ${
                          log.delta < 0 ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {log.delta > 0 ? `+${log.delta}` : log.delta}
                      </span>
                      <span className="font-semibold text-slate-800">{log.ingredientName}</span>
                      <span className="text-slate-400">({log.reason})</span>
                    </div>
                    <div className="flex items-center space-x-2 text-slate-500 font-mono text-[10px]">
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
          <div className="p-4 sm:p-5 bg-purple-50/70 border border-purple-200/80 rounded-2xl text-xs text-purple-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 border border-purple-200 mt-0.5">
                <Utensils className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900">Bill of Materials (BOM) & Otomasi Pemotongan Resep</p>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  Setiap item menu memiliki formula resep bahan baku baku. Saat kasir POS atau pelanggan menyelesaikan pesanan, sistem secara presisi memotong stok bahan baku dan menghitung HPP (COGS) aktual.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <Button
                size="sm"
                onClick={() => {
                  setSelectedRecipeForEdit(null);
                  setIsRecipeModalOpen(true);
                }}
                className="text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl px-4 py-2 space-x-1.5 shadow-xs transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Input Resep Baru</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recipes.map((rec) => (
              <Card key={rec.menuId} className="p-4 sm:p-5 border border-slate-200/80 rounded-2xl shadow-xs hover:border-purple-300 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between pb-3.5 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{rec.menuName}</h3>
                    <span className="text-[10px] text-slate-400 font-medium">{rec.category}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold font-mono text-slate-900">{formatCurrencyIDR(rec.sellingPrice)}</span>
                    <div className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold mt-0.5 inline-block">
                      Margin {rec.grossMarginPercent}%
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Komposisi Bahan Baku (BOM):</p>
                    <span className="text-[10px] text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-full font-bold">
                      {rec.ingredients.length} Bahan
                    </span>
                  </div>
                  <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-xl border border-slate-100 divide-y divide-slate-100">
                    {rec.ingredients.map((ing, idx) => (
                      <div key={idx} className={`flex items-center justify-between text-xs ${idx > 0 ? "pt-1.5" : ""}`}>
                        <div className="flex items-center space-x-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                          <span className="font-medium text-slate-700">{ing.ingredientName}</span>
                          <span className="text-slate-400 font-mono text-[11px]">({ing.quantityRequired || 1} {ing.unit})</span>
                        </div>
                        <span className="font-mono text-slate-600 font-medium">{formatCurrencyIDR(ing.costEstimate)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3.5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500 font-medium">Total COGS / Porsi: </span>
                    <span className="font-bold font-mono text-slate-900 text-sm">
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
                    className="px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-50 border border-purple-200 rounded-xl transition-colors shadow-2xs"
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Daftar Purchase Order (PO) Supplier</h3>
              <p className="text-xs text-slate-500 mt-0.5">Kelola pemesanan bahan baku, pengiriman, dan penerimaan restock gudang.</p>
            </div>
            <Button
              size="sm"
              className="text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl px-3.5 py-2 shadow-xs transition-all"
              onClick={() => setIsPOModalOpen(true)}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Buat PO Baru
            </Button>
          </div>

          <Card className="shadow-xs overflow-hidden rounded-2xl border border-slate-200/80">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">No. PO</th>
                    <th className="py-3.5 px-4">Supplier</th>
                    <th className="py-3.5 px-4">Item Barang</th>
                    <th className="py-3.5 px-4 text-right">Total Nilai PO</th>
                    <th className="py-3.5 px-3">Tgl Order</th>
                    <th className="py-3.5 px-3">Estimasi Tiba</th>
                    <th className="py-3.5 px-3 text-center">Status</th>
                    <th className="py-3.5 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredPurchaseOrders.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-purple-700">{po.poNumber}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">{po.supplier}</td>
                      <td className="py-3.5 px-4">
                        {po.items.map((i, idx) => (
                          <div key={idx} className="text-slate-600">
                            {i.name} <span className="text-slate-400 font-mono">({i.quantity} {i.unit})</span>
                          </div>
                        ))}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrencyIDR(po.total)}
                      </td>
                      <td className="py-3.5 px-3 text-slate-500 font-mono text-[11px]">{po.orderDate}</td>
                      <td className="py-3.5 px-3 text-slate-600 font-medium">{po.expectedDelivery}</td>
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            po.status === "RECEIVED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : po.status === "SENT"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {po.status === "RECEIVED" ? "Diterima" : po.status === "SENT" ? "Terkirim" : "Draft"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => setSelectedPOPreview(po)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors shadow-2xs"
                            title="Lihat Rincian Dokumen PO"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {po.status === "SENT" && (
                            <button
                              onClick={() => handleReceivePO(po.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold transition-colors shadow-2xs"
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
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: STOCK OPNAME & AUDIT FISIK (Revisi 8) */}
      {activeTab === "OPNAME" && (
        <div className="space-y-4">
          {/* Opname Metric Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <Card className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Total Audit Opname</span>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <ClipboardCheck className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl font-bold font-mono text-slate-900 mt-1 tracking-tight">{stockOpnames.length} Catatan</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Histori audit stok fisik gudang</p>
            </Card>

            <Card className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Selisih Surplus (+)</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl font-bold font-mono text-emerald-600 mt-1 tracking-tight">{stockOpnames.filter((o) => o.varianceType === "SURPLUS").length} Item</p>
              <p className="text-[10px] text-emerald-700 font-medium mt-0.5">Stok fisik &gt; stok sistem</p>
            </Card>

            <Card className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Selisih Defisit (-)</span>
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl font-bold font-mono text-rose-600 mt-1 tracking-tight">{stockOpnames.filter((o) => o.varianceType === "DEFICIT").length} Item</p>
              <p className="text-[10px] text-rose-600 font-medium mt-0.5">Waste, hilang, rusak, atau selisih</p>
            </Card>

            <Card className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Sesuai / Balance (0)</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Scale className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl font-bold font-mono text-blue-600 mt-1 tracking-tight">{stockOpnames.filter((o) => o.varianceType === "MATCH").length} Item</p>
              <p className="text-[10px] text-blue-600 font-medium mt-0.5">Stok fisik akurat 100%</p>
            </Card>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-2 flex-1 max-w-md bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 focus-within:border-indigo-400 focus-within:bg-white transition-all">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Cari no. opname, nama bahan, auditor..."
                value={opnameSearchQuery}
                onChange={(e) => setOpnameSearchQuery(e.target.value)}
                className="w-full text-xs bg-transparent border-none outline-hidden text-slate-800 placeholder-slate-400"
              />
              {opnameSearchQuery && (
                <button
                  onClick={() => setOpnameSearchQuery("")}
                  className="text-slate-400 hover:text-slate-600"
                  title="Hapus pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500 font-medium hidden sm:inline">Alasan:</span>
              <select
                value={opnameReasonFilter}
                onChange={(e) => setOpnameReasonFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700 outline-hidden hover:bg-slate-100/70 transition-colors"
              >
                <option value="ALL">Semua Alasan</option>
                <option value="RECORDING_ERROR">Kesalahan Pencatatan / Selisih Hitung</option>
                <option value="WASTE">Waste (Terbuang saat Operasional)</option>
                <option value="LOSS">Loss (Kehilangan)</option>
                <option value="DAMAGED">Kerusakan Kemasan / Fisik</option>
                <option value="EXPIRATION">Kedaluwarsa (Expired)</option>
                <option value="SAMPLE_PROMO">Sample / Pemakaian Promo</option>
                <option value="OTHER">Lainnya</option>
              </select>

              <Button
                size="sm"
                variant="outline"
                onClick={handleExportOpnameCSV}
                className="text-xs border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold rounded-xl shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 mr-1 text-slate-600" />
                Export CSV
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleExportOpnameExcel}
                className="text-xs border-slate-200 text-emerald-700 hover:bg-emerald-50 font-semibold rounded-xl shadow-2xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Export Excel (.xls)
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsOpnamePDFModalOpen(true)}
                className="text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-semibold rounded-xl shadow-2xs"
              >
                <FileText className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                Cetak PDF Resmi
              </Button>

              <Button
                size="sm"
                onClick={() => handleOpenOpnameModal()}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Catat Opname Baru
              </Button>
            </div>
          </div>

          {/* Opname Audit Table */}
          <Card className="shadow-xs overflow-hidden rounded-2xl border border-slate-200/80">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">No. Opname & Tanggal</th>
                    <th className="py-3.5 px-4">Bahan Baku & Kategori</th>
                    <th className="py-3.5 px-3 text-right">Stok Sistem</th>
                    <th className="py-3.5 px-3 text-right">Stok Fisik Riil</th>
                    <th className="py-3.5 px-3 text-center">Selisih (Variance)</th>
                    <th className="py-3.5 px-4">Alasan & Catatan</th>
                    <th className="py-3.5 px-4">Auditor / Pelaksana</th>
                    <th className="py-3.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {stockOpnames
                    .filter((rec) => {
                      const matchReason = opnameReasonFilter === "ALL" || rec.reason === opnameReasonFilter;
                      const matchSearch =
                        rec.opnameNumber.toLowerCase().includes(opnameSearchQuery.toLowerCase()) ||
                        rec.ingredientName.toLowerCase().includes(opnameSearchQuery.toLowerCase()) ||
                        rec.performedBy.toLowerCase().includes(opnameSearchQuery.toLowerCase());
                      return matchReason && matchSearch;
                    })
                    .length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 px-4 text-center">
                        <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-400 mb-3 border border-indigo-100">
                            <ClipboardCheck className="w-6 h-6" />
                          </div>
                          <h4 className="text-sm font-bold text-slate-800">Belum ada riwayat stock opname fisik</h4>
                          <p className="text-xs text-slate-500 mt-1 text-center">
                            Klik tombol &quot;Catat Opname Baru&quot; atau &quot;Opname&quot; pada tabel master bahan untuk memulai audit fisik.
                          </p>
                          <Button
                            size="sm"
                            onClick={() => handleOpenOpnameModal()}
                            className="mt-3.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Mulai Audit Fisik Sekarang
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    stockOpnames
                      .filter((rec) => {
                        const matchReason = opnameReasonFilter === "ALL" || rec.reason === opnameReasonFilter;
                        const matchSearch =
                          rec.opnameNumber.toLowerCase().includes(opnameSearchQuery.toLowerCase()) ||
                          rec.ingredientName.toLowerCase().includes(opnameSearchQuery.toLowerCase()) ||
                          rec.performedBy.toLowerCase().includes(opnameSearchQuery.toLowerCase());
                        return matchReason && matchSearch;
                      })
                      .map((op) => {
                        const isSurplus = op.variance > 0;
                        const isDeficit = op.variance < 0;

                        return (
                          <tr key={op.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3.5 px-4">
                              <span className="font-mono font-bold text-slate-900 block">{op.opnameNumber}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{op.date}</span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-bold text-slate-900 block">{op.ingredientName}</span>
                              <span className="text-[10px] text-slate-400 font-normal">{op.category}</span>
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono font-medium text-slate-600">
                              {op.systemStock} <span className="text-[10px] text-slate-400">{op.unit}</span>
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">
                              {op.physicalStock} <span className="text-[10px] text-slate-500">{op.unit}</span>
                            </td>
                            <td className="py-3.5 px-3 text-center">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-mono text-[11px] font-bold border ${
                                  isSurplus
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : isDeficit
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : "bg-blue-50 text-blue-700 border-blue-200"
                                }`}
                              >
                                {isSurplus ? `+${op.variance}` : op.variance} {op.unit}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-semibold text-slate-800 block text-[11px]">
                                {op.reason === "RECORDING_ERROR" && "Kesalahan Pencatatan"}
                                {op.reason === "WASTE" && "Waste (Terbuang)"}
                                {op.reason === "LOSS" && "Loss (Kehilangan)"}
                                {op.reason === "DAMAGED" && "Kerusakan Fisik"}
                                {op.reason === "EXPIRATION" && "Kedaluwarsa (Expired)"}
                                {op.reason === "SAMPLE_PROMO" && "Sample / Promo"}
                                {op.reason === "OTHER" && "Lainnya"}
                              </span>
                              {op.reasonNotes && (
                                <span className="text-[10px] text-slate-500 italic block mt-0.5 line-clamp-1">
                                  &quot;{op.reasonNotes}&quot;
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-medium text-slate-700">
                              {op.performedBy}
                            </td>
                            <td className="py-3.5 px-3 text-center">
                              <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Selesai
                              </span>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: RESTOCK ALERT POPUP */}
      {isRestockAlertModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center space-x-2.5 text-rose-600">
                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center border border-rose-100">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Peringatan Restock Bahan Kritis & Habis
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Outlet: {activeOutlet?.name || "Singaraja"}</p>
                </div>
              </div>
              <button
                onClick={() => setIsRestockAlertModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Berikut rincian bahan baku yang berada di bawah ambang batas minimum safety stock beserta rekomendasi pemesanan ulang (reorder):
              </p>

              <div className="max-h-72 overflow-y-auto border border-slate-200/80 rounded-xl divide-y divide-slate-100">
                {[...outOfStockItems, ...criticalItems.filter((c) => !outOfStockItems.some((o) => o.id === c.id))].map((item) => (
                  <div key={item.id} className="p-3.5 flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 text-xs">{item.name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          item.stockNumber <= 0 ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-800 border-amber-200"
                        }`}>
                          {item.stockNumber <= 0 ? "HABIS (0)" : "KRITIS"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Sisa Stok: <strong className="font-mono text-rose-600">{item.stockNumber} {item.unit}</strong> • Batas Min: <strong className="font-mono text-slate-700">{item.min} {item.unit}</strong>
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        Supplier: {item.supplier} • Terakhir Diperbarui: {item.lastUpdated}
                      </p>
                    </div>

                    <div className="text-right space-y-1.5 shrink-0 pl-3">
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
                        className="text-[11px] h-7 px-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-2xs"
                      >
                        + Terbitkan PO
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs rounded-xl"
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
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
                  <ArrowUpDown className="w-4 h-4" />
                </div>
                <span>Form Penyesuaian Stok Gudang</span>
              </h3>
              <button
                onClick={() => setIsStockAdjModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStockAdjustment} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Pilih Bahan Baku</label>
                <select
                  value={adjItemId}
                  onChange={(e) => setAdjItemId(e.target.value)}
                  className="w-full text-xs bg-slate-50/80 border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-800 outline-hidden focus:bg-white focus:border-purple-400 transition-all"
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
                  <label className="block font-semibold text-slate-700 mb-1.5">Perubahan (+ / -)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={adjDelta}
                    onChange={(e) => setAdjDelta(Number(e.target.value))}
                    className="w-full text-xs bg-slate-50/80 border border-slate-200 rounded-xl p-2.5 font-mono font-bold text-slate-800 outline-hidden focus:bg-white focus:border-purple-400 transition-all"
                    required
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">Gunakan minus (-) untuk pengurangan</span>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Alasan Penyesuaian</label>
                  <select
                    value={adjReason}
                    onChange={(e) => setAdjReason(e.target.value as StockAdjustmentLog["reason"])}
                    className="w-full text-xs bg-slate-50/80 border border-slate-200 rounded-xl p-2.5 text-slate-700 outline-hidden focus:bg-white focus:border-purple-400 transition-all font-medium"
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
                  className="text-xs rounded-xl"
                  onClick={() => setIsStockAdjModalOpen(false)}
                >
                  Batal
                </Button>
                <Button type="submit" size="sm" className="text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl">
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
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                </div>
                <span>Kalkulasi & Pemotongan Resep Menu (BOM)</span>
              </h3>
              <button
                onClick={() => setIsBOMSimulatorModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRunBOMSimulation} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Pilih Menu Produk</label>
                <select
                  value={simMenuId}
                  onChange={(e) => setSimMenuId(e.target.value)}
                  className="w-full text-xs bg-slate-50/80 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800 outline-hidden focus:bg-white focus:border-purple-400 transition-all"
                >
                  {recipes.map((r) => (
                    <option key={r.menuId} value={r.menuId}>
                      {r.menuName} ({formatCurrencyIDR(r.sellingPrice)} - COGS {formatCurrencyIDR(r.totalCOGS)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Jumlah Porsi Pesanan (Qty)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={simQty}
                  onChange={(e) => setSimQty(Number(e.target.value))}
                  className="w-full text-xs bg-slate-50/80 border border-slate-200 rounded-xl p-2.5 font-mono font-bold text-slate-800 outline-hidden focus:bg-white focus:border-purple-400 transition-all"
                  required
                />
              </div>

              {(() => {
                const rec = recipes.find((r) => r.menuId === simMenuId);
                if (!rec) return null;
                return (
                  <div className="p-3.5 bg-purple-50/70 rounded-xl border border-purple-100 space-y-2">
                    <p className="text-[11px] font-bold text-purple-900">Bahan yang Akan Dipotong Otomatis:</p>
                    <div className="space-y-1.5">
                      {rec.ingredients.map((ing, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs text-purple-950">
                          <span>• {ing.ingredientName}</span>
                          <span className="font-mono font-bold text-purple-800">
                            -{(ing.quantityRequired * simQty).toFixed(3)} {ing.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs rounded-xl"
                  onClick={() => setIsBOMSimulatorModalOpen(false)}
                >
                  Tutup
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl"
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
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
                  <Truck className="w-4 h-4" />
                </div>
                <span>Terbitkan Purchase Order (PO)</span>
              </h3>
              <button
                onClick={() => setIsPOModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePO} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Nama Supplier</label>
                <input
                  type="text"
                  required
                  value={poSupplier}
                  onChange={(e) => setPOSupplier(e.target.value)}
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl p-2.5 outline-hidden focus:bg-white focus:border-purple-400 transition-all font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Pilih Item Bahan</label>
                <select
                  value={poItemId}
                  onChange={(e) => setPOItemId(e.target.value)}
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-800 outline-hidden focus:bg-white focus:border-purple-400 transition-all"
                >
                  {filteredIngredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({formatCurrencyIDR(i.costPerUnit)} / {i.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Jumlah Pemesanan (Qty)</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={poQuantity}
                  onChange={(e) => setPOQuantity(Number(e.target.value))}
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl p-2.5 font-bold font-mono text-slate-800 outline-hidden focus:bg-white focus:border-purple-400 transition-all"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Catatan PO</label>
                <input
                  type="text"
                  value={poNotes}
                  onChange={(e) => setPONotes(e.target.value)}
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl p-2.5 outline-hidden focus:bg-white focus:border-purple-400 transition-all text-slate-700"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs rounded-xl"
                  onClick={() => setIsPOModalOpen(false)}
                >
                  Batal
                </Button>
                <Button type="submit" size="sm" className="bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl text-xs">
                  Kirim PO ke Supplier
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PREVIEW DETAIL PURCHASE ORDER (PO) */}
      {selectedPOPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Dokumen Purchase Order — {selectedPOPreview.poNumber}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Tanggal Order: {selectedPOPreview.orderDate}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedPOPreview(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Supplier / Vendor</span>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedPOPreview.supplier}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Status & Estimasi</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        selectedPOPreview.status === "RECEIVED"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : selectedPOPreview.status === "SENT"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      {selectedPOPreview.status === "RECEIVED" ? "Diterima" : selectedPOPreview.status === "SENT" ? "Terkirim" : "Draft"}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">Tiba: {selectedPOPreview.expectedDelivery}</span>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-700 block mb-1.5">Rincian Barang yang Dipesan:</span>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200 text-[10px] uppercase">
                      <tr>
                        <th className="p-2.5">Bahan</th>
                        <th className="p-2.5 text-right">Jumlah</th>
                        <th className="p-2.5 text-right">Harga Satuan</th>
                        <th className="p-2.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedPOPreview.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-2.5 font-medium text-slate-800">{it.name}</td>
                          <td className="p-2.5 text-right font-mono text-slate-600">{it.quantity} {it.unit}</td>
                          <td className="p-2.5 text-right font-mono text-slate-600">{formatCurrencyIDR(it.unitPrice)}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatCurrencyIDR(it.totalPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal:</span>
                  <span className="font-mono font-medium">{formatCurrencyIDR(selectedPOPreview.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>PPN (11%):</span>
                  <span className="font-mono font-medium">{formatCurrencyIDR(selectedPOPreview.tax)}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold text-sm pt-1.5 border-t border-slate-200">
                  <span>Grand Total PO:</span>
                  <span className="font-mono text-purple-700">{formatCurrencyIDR(selectedPOPreview.total)}</span>
                </div>
              </div>

              {selectedPOPreview.notes && (
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600">
                  <span className="font-semibold block text-slate-700">Catatan Pemesanan:</span>
                  {selectedPOPreview.notes}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs rounded-xl"
                onClick={() => setSelectedPOPreview(null)}
              >
                Tutup
              </Button>
              {selectedPOPreview.status === "SENT" && (
                <Button
                  size="sm"
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl"
                  onClick={() => {
                    handleReceivePO(selectedPOPreview.id);
                    setSelectedPOPreview(null);
                  }}
                >
                  Terima Barang Sekarang
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: STOCK OPNAME (Revisi 8) */}
      {isOpnameModalOpen && (() => {
        const target = filteredIngredients.find((i) => i.id === opnameItemId) || filteredIngredients[0];
        const sysStock = target?.stockNumber ?? 0;
        const physical = Number(opnamePhysicalStock) || 0;
        const variance = physical - sysStock;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                    <ClipboardCheck className="w-4 h-4" />
                  </div>
                  <span>Formulir Stock Opname Fisik (Audit Inventori)</span>
                </h3>
                <button
                  onClick={() => setIsOpnameModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveStockOpname} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Pilih Bahan Baku yang Diaudit</label>
                  <select
                    value={opnameItemId}
                    onChange={(e) => {
                      setOpnameItemId(e.target.value);
                      const chosen = filteredIngredients.find((i) => i.id === e.target.value);
                      if (chosen) setOpnamePhysicalStock(chosen.stockNumber);
                    }}
                    className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50/80 font-semibold text-slate-800 outline-hidden focus:bg-white focus:border-indigo-400 transition-all"
                  >
                    {filteredIngredients.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} (Stok Sistem: {i.stockNumber} {i.unit}) — {i.category}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Stok Sistem Saat Ini</span>
                    <p className="text-base font-mono font-bold text-slate-800 mt-0.5">
                      {sysStock} <span className="text-xs font-normal text-slate-500">{target?.unit}</span>
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Supplier / Vendor</span>
                    <p className="text-xs font-semibold text-slate-700 mt-1 line-clamp-1">
                      {target?.supplier || "-"}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Hasil Hitungan Fisik Riil (Stok Fisik di Gudang) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      required
                      value={opnamePhysicalStock}
                      onChange={(e) => setOpnamePhysicalStock(Number(e.target.value))}
                      className="w-full border border-slate-200 rounded-xl p-2.5 font-bold font-mono text-base pr-16 bg-slate-50/80 outline-hidden focus:bg-white focus:border-indigo-400 transition-all"
                    />
                    <span className="absolute right-3 top-3 text-slate-400 font-bold text-xs">
                      {target?.unit}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Masukkan jumlah fisik aktual yang dihitung di tempat penyimpanan.
                  </p>
                </div>

                {/* Real-time Variance Calculation Display */}
                <div
                  className={`p-3.5 rounded-xl border ${
                    variance > 0
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : variance < 0
                      ? "bg-rose-50 border-rose-200 text-rose-900"
                      : "bg-blue-50 border-blue-200 text-blue-900"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Scale className="w-4 h-4 shrink-0" />
                      <span className="font-bold text-xs">
                        Kalkulasi Selisih Otomatis (Variance):
                      </span>
                    </div>
                    <span
                      className={`font-mono font-bold text-sm px-2.5 py-0.5 rounded-full border ${
                        variance > 0
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                          : variance < 0
                          ? "bg-rose-100 text-rose-800 border-rose-200"
                          : "bg-blue-100 text-blue-800 border-blue-200"
                      }`}
                    >
                      {variance > 0 ? `+${variance}` : variance} {target?.unit}
                    </span>
                  </div>
                  <p className="text-[11px] mt-1.5 opacity-90 leading-relaxed">
                    {variance === 0 && "Stok fisik cocok dengan data sistem (Sesuai / Balance)."}
                    {variance > 0 && `Stok fisik lebih banyak +${variance} ${target?.unit} daripada catatan sistem (Surplus).`}
                    {variance < 0 && `Stok fisik berkurang ${Math.abs(variance)} ${target?.unit} dari catatan sistem (Defisit / Kurang).`}
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Kategori Alasan Selisih *</label>
                  <select
                    value={opnameReason}
                    onChange={(e) => setOpnameReason(e.target.value as StockOpnameReason)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50/80 font-semibold text-slate-800 outline-hidden focus:bg-white focus:border-indigo-400 transition-all"
                  >
                    <option value="RECORDING_ERROR">Kesalahan Pencatatan / Selisih Hitung</option>
                    <option value="WASTE">Waste (Terbuang saat Operasional / Olah)</option>
                    <option value="LOSS">Loss (Kehilangan)</option>
                    <option value="DAMAGED">Kerusakan Kemasan / Fisik Barang</option>
                    <option value="EXPIRATION">Kedaluwarsa (Expired)</option>
                    <option value="SAMPLE_PROMO">Sample / Pemakaian Promo</option>
                    <option value="OTHER">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Catatan Tambahan (Wajib jika ada selisih)</label>
                  <input
                    type="text"
                    value={opnameNotes}
                    onChange={(e) => setOpnameNotes(e.target.value)}
                    placeholder="Contoh: Kaleng penyok saat penerimaan / sisa potongan"
                    className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50/80 outline-hidden focus:bg-white focus:border-indigo-400 transition-all"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Nama Auditor / Pelaksana Opname</label>
                  <input
                    type="text"
                    required
                    value={opnameAuditor}
                    onChange={(e) => setOpnameAuditor(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-800 bg-slate-50/80 outline-hidden focus:bg-white focus:border-indigo-400 transition-all"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs rounded-xl"
                    onClick={() => setIsOpnameModalOpen(false)}
                  >
                    Batal
                  </Button>
                  <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs">
                    Terapkan & Update Stok Sistem
                  </Button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* PDF Inventory Valuation Report Modal */}
      <InventoryReportPDFModal
        isOpen={isPDFModalOpen}
        onClose={() => setIsPDFModalOpen(false)}
        ingredients={filteredIngredients}
        outletName={activeOutlet?.name || "Singaraja"}
      />

      {/* PDF Official Stock Opname Report Modal */}
      <StockOpnameReportPDFModal
        isOpen={isOpnamePDFModalOpen}
        onClose={() => setIsOpnamePDFModalOpen(false)}
        opnames={stockOpnames}
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
