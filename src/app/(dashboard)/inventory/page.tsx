"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Package, Truck, Utensils } from "lucide-react";

import { notify } from "@/components/app/notify";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInventory } from "@/contexts/InventoryContext";
import { useOutlet } from "@/contexts/OutletContext";
import { useProducts } from "@/contexts/ProductContext";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";
import type {
  IngredientItem,
  PurchaseOrder,
  RecipeBOM,
  StockAdjustmentLog,
  StockOpnameReason,
} from "@/types/inventory";

import { BOMRecipeModal } from "@/features/inventory/BOMRecipeModal";
import { BOMSimulatorModal } from "@/features/inventory/BOMSimulatorModal";
import { CreatePOModal } from "@/features/inventory/CreatePOModal";
import {
  buildOpnameExportData,
  buildStockExportData,
  calculateInventoryKPIs,
  calculateOpnameSummary,
  filterStockIngredients,
  filterStockOpnames,
} from "@/features/inventory/inventory-domain";
import { InventoryOpnameTab } from "@/features/inventory/InventoryOpnameTab";
import { InventoryPurchaseOrdersTab } from "@/features/inventory/InventoryPurchaseOrdersTab";
import { InventoryRecipesTab } from "@/features/inventory/InventoryRecipesTab";
import { InventoryReportPDFModal } from "@/features/inventory/InventoryReportPDFModal";
import { InventoryStockTab } from "@/features/inventory/InventoryStockTab";
import { InventoryToolbar } from "@/features/inventory/InventoryToolbar";
import { PODetailModal } from "@/features/inventory/PODetailModal";
import { RestockAlertModal } from "@/features/inventory/RestockAlertModal";
import { StockAdjustmentModal } from "@/features/inventory/StockAdjustmentModal";
import { StockOpnameModal } from "@/features/inventory/StockOpnameModal";
import { StockOpnameReportPDFModal } from "@/features/inventory/StockOpnameReportPDFModal";

export default function InventoryPage() {
  const { activeOutlet } = useOutlet();
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
    createPurchaseOrder,
    receivePurchaseOrder,
  } = useInventory();

  const outletName = activeOutlet?.name || "Singaraja";

  const [activeTab, setActiveTab] = useState<"STOCK" | "BOM" | "PO" | "OPNAME">("STOCK");

  // Stock tab filters & pagination
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Opname tab filters
  const [opnameSearchQuery, setOpnameSearchQuery] = useState("");
  const [opnameReasonFilter, setOpnameReasonFilter] = useState<string>("ALL");
  const [sessionAuditedIds, setSessionAuditedIds] = useState<string[]>([]);

  // Modals state
  const [isStockAdjModalOpen, setIsStockAdjModalOpen] = useState(false);
  const [selectedItemForAdj, setSelectedItemForAdj] = useState<IngredientItem | null>(null);
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [selectedItemForPO, setSelectedItemForPO] = useState<IngredientItem | null>(null);
  const [selectedPOPreview, setSelectedPOPreview] = useState<PurchaseOrder | null>(null);
  const [isBOMSimulatorModalOpen, setIsBOMSimulatorModalOpen] = useState(false);
  const [isRestockAlertModalOpen, setIsRestockAlertModalOpen] = useState(false);
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);
  const [isOpnameModalOpen, setIsOpnameModalOpen] = useState(false);
  const [opnameInitialItemId, setOpnameInitialItemId] = useState<string | undefined>(undefined);
  const [isOpnamePDFModalOpen, setIsOpnamePDFModalOpen] = useState(false);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [selectedRecipeForEdit, setSelectedRecipeForEdit] = useState<RecipeBOM | null>(null);

  // Categories list
  const ingredientCategories = useMemo(() => {
    return Array.from(new Set(filteredIngredients.map((item) => item.category))).filter(Boolean);
  }, [filteredIngredients]);

  // Stock KPIs
  const kpis = useMemo(() => {
    return calculateInventoryKPIs(filteredIngredients);
  }, [filteredIngredients]);

  // Opname summary metrics
  const opnameSummary = useMemo(() => {
    return calculateOpnameSummary(stockOpnames, filteredIngredients);
  }, [stockOpnames, filteredIngredients]);

  // Filtered Stock Ingredients
  const displayedIngredients = useMemo(() => {
    return filterStockIngredients(filteredIngredients, statusFilter, categoryFilter, searchQuery);
  }, [filteredIngredients, statusFilter, categoryFilter, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [displayedIngredients.length, statusFilter, categoryFilter, searchQuery]);

  const paginatedIngredients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return displayedIngredients.slice(start, start + pageSize);
  }, [displayedIngredients, currentPage, pageSize]);

  // Filtered Opnames
  const displayedOpnames = useMemo(() => {
    return filterStockOpnames(stockOpnames, opnameReasonFilter, opnameSearchQuery);
  }, [stockOpnames, opnameReasonFilter, opnameSearchQuery]);

  // Handlers
  const handleStockAdjustment = (
    itemId: string,
    delta: number,
    reason: StockAdjustmentLog["reason"]
  ) => {
    const target = filteredIngredients.find((i) => i.id === itemId);
    adjustStock(itemId, delta, reason);
    notify.success("Stok disesuaikan", `Stok ${target?.name || "bahan"} berhasil diperbarui.`);
  };

  const handleRunBOMSimulation = (menuId: string, qty: number) => {
    const res = simulateBOMDeduction(menuId, qty);
    notify.info("Simulasi selesai", res.message);
  };

  const handleCreatePO = (supplier: string, itemId: string, quantity: number, notes: string) => {
    const item = filteredIngredients.find((i) => i.id === itemId);
    if (!item) return;

    const unitPrice = item.costPerUnit;
    const itemTotal = unitPrice * quantity;
    const subtotal = itemTotal;
    const tax = Math.round(subtotal * 0.11);
    const total = subtotal + tax;

    createPurchaseOrder({
      supplier,
      items: [
        {
          ingredientId: item.id,
          name: item.name,
          quantity,
          unit: item.unit,
          unitPrice,
          totalPrice: itemTotal,
        },
      ],
      subtotal,
      tax,
      total,
      status: "SENT",
      orderDate: new Date().toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      expectedDelivery: "2 Hari ke Depan",
      notes,
    });

    notify.success("PO diterbitkan", `Pesanan berhasil dikirim ke ${supplier}.`);
  };

  const handleReceivePO = (poId: string) => {
    receivePurchaseOrder(poId);
    notify.success("Barang diterima", "Stok bahan baku otomatis bertambah ke gudang.");
  };

  const handleExportStockCSV = () => {
    const { headers, rows } = buildStockExportData(filteredIngredients);
    downloadCSV(`Master_Stok_Bahan_Baku_${Date.now()}`, headers, rows);
    notify.info("Ekspor selesai", "Data stok bahan baku diekspor ke CSV.");
  };

  const handleExportStockExcel = () => {
    const { headers, rows } = buildStockExportData(filteredIngredients);
    downloadExcel(`Master_Stok_Bahan_Baku_${Date.now()}`, "Master Stok", headers, rows);
    notify.info("Ekspor selesai", "Data stok bahan baku diekspor ke Excel.");
  };

  const handleSaveStockOpname = (data: {
    ingredientId: string;
    physicalStock: number;
    reason: StockOpnameReason;
    notes?: string;
    auditor: string;
  }) => {
    const target = filteredIngredients.find((i) => i.id === data.ingredientId);
    if (!target) return;

    const sysStock = target.stockNumber;
    const variance = data.physicalStock - sysStock;

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
      physicalStock: data.physicalStock,
      reason: data.reason,
      reasonNotes: data.notes,
      performedBy: data.auditor,
      tenantId: "outlet-sgr",
      outletId: "outlet-sgr",
    });

    setSessionAuditedIds((prev) => [...prev, target.id]);
    notify.success(
      "Stock Opname disimpan",
      `Audit ${result.opnameNumber} (${target.name}) selesai. Selisih: ${
        variance > 0 ? `+${variance}` : variance
      } ${target.unit}.`
    );
  };

  const handleExportOpnameCSV = () => {
    const { headers, rows } = buildOpnameExportData(stockOpnames);
    downloadCSV(`Laporan_Stock_Opname_${Date.now()}`, headers, rows);
    notify.info("Ekspor selesai", "Laporan Stock Opname diekspor ke CSV.");
  };

  const handleExportOpnameExcel = () => {
    const { headers, rows } = buildOpnameExportData(stockOpnames);
    downloadExcel(`Laporan_Stock_Opname_${Date.now()}`, "Stock Opname", headers, rows);
    notify.info("Ekspor selesai", "Laporan Stock Opname diekspor ke Excel.");
  };

  return (
    <div className="space-y-6">
      <InventoryToolbar
        outletName={outletName}
        totalStockValue={kpis.totalStockValue}
        safeCount={kpis.safeCount}
        lowCount={kpis.lowCount}
        criticalCount={kpis.criticalCount}
        outOfStockCount={kpis.outOfStockCount}
        onOpenValuationPDF={() => setIsPDFModalOpen(true)}
        onOpenRestockAlert={() => setIsRestockAlertModalOpen(true)}
        onOpenBOMSimulator={() => setIsBOMSimulatorModalOpen(true)}
        onOpenCreatePO={() => {
          setSelectedItemForPO(null);
          setIsPOModalOpen(true);
        }}
      />

      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "STOCK" | "BOM" | "PO" | "OPNAME")}
      >
        <TabsList className="h-9">
          <TabsTrigger value="STOCK" className="gap-1.5 text-xs">
            <Package className="size-3.5 text-muted-foreground" />
            <span>Master Stok</span>
          </TabsTrigger>
          <TabsTrigger value="BOM" className="gap-1.5 text-xs">
            <Utensils className="size-3.5 text-muted-foreground" />
            <span>Resep BOM ({recipes.length})</span>
          </TabsTrigger>
          <TabsTrigger value="PO" className="gap-1.5 text-xs">
            <Truck className="size-3.5 text-muted-foreground" />
            <span>Purchase Order ({filteredPurchaseOrders.length})</span>
          </TabsTrigger>
          <TabsTrigger value="OPNAME" className="gap-1.5 text-xs">
            <ClipboardCheck className="size-3.5 text-muted-foreground" />
            <span>Stock Opname ({stockOpnames.length})</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="STOCK" className="m-0 focus-visible:outline-hidden">
            <InventoryStockTab
              ingredients={paginatedIngredients}
              allIngredientsCount={displayedIngredients.length}
              criticalItems={kpis.criticalItems}
              categories={ingredientCategories}
              statusFilter={statusFilter}
              categoryFilter={categoryFilter}
              searchQuery={searchQuery}
              currentPage={currentPage}
              pageSize={pageSize}
              logs={logs}
              onStatusFilterChange={setStatusFilter}
              onCategoryFilterChange={setCategoryFilter}
              onSearchChange={setSearchQuery}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              onResetFilters={() => {
                setStatusFilter("ALL");
                setCategoryFilter("ALL");
                setSearchQuery("");
              }}
              onExportCSV={handleExportStockCSV}
              onExportExcel={handleExportStockExcel}
              onOpenRestockAlert={() => setIsRestockAlertModalOpen(true)}
              onOpenAdjustment={(item) => {
                setSelectedItemForAdj(item);
                setIsStockAdjModalOpen(true);
              }}
            />
          </TabsContent>

          <TabsContent value="BOM" className="m-0 focus-visible:outline-hidden">
            <InventoryRecipesTab
              recipes={recipes}
              onOpenRecipeModal={(r) => {
                setSelectedRecipeForEdit(r);
                setIsRecipeModalOpen(true);
              }}
            />
          </TabsContent>

          <TabsContent value="PO" className="m-0 focus-visible:outline-hidden">
            <InventoryPurchaseOrdersTab
              purchaseOrders={filteredPurchaseOrders}
              onReceivePO={handleReceivePO}
              onPreviewPO={(po) => setSelectedPOPreview(po)}
            />
          </TabsContent>

          <TabsContent value="OPNAME" className="m-0 focus-visible:outline-hidden">
            <InventoryOpnameTab
              opnames={displayedOpnames}
              totalSessions={opnameSummary.totalSessions}
              totalVarianceUnits={opnameSummary.totalVarianceUnits}
              totalVarianceValue={opnameSummary.totalVarianceValue}
              reasonFilter={opnameReasonFilter}
              searchQuery={opnameSearchQuery}
              onReasonFilterChange={setOpnameReasonFilter}
              onSearchChange={setOpnameSearchQuery}
              onExportCSV={handleExportOpnameCSV}
              onExportExcel={handleExportOpnameExcel}
              onOpenOpnameModal={() => {
                setOpnameInitialItemId(undefined);
                setIsOpnameModalOpen(true);
              }}
              onOpenOpnamePDFModal={() => setIsOpnamePDFModalOpen(true)}
            />
          </TabsContent>
        </div>
      </Tabs>

      {/* Restock Alert Modal */}
      <RestockAlertModal
        isOpen={isRestockAlertModalOpen}
        onClose={() => setIsRestockAlertModalOpen(false)}
        criticalItems={kpis.criticalItems}
        onTriggerPO={(item) => {
          setSelectedItemForPO(item);
          setIsPOModalOpen(true);
        }}
      />

      {/* Stock Adjustment Modal */}
      <StockAdjustmentModal
        isOpen={isStockAdjModalOpen}
        onClose={() => {
          setIsStockAdjModalOpen(false);
          setSelectedItemForAdj(null);
        }}
        ingredients={filteredIngredients}
        selectedItem={selectedItemForAdj}
        onAdjust={handleStockAdjustment}
      />

      {/* BOM Simulator Modal */}
      <BOMSimulatorModal
        isOpen={isBOMSimulatorModalOpen}
        onClose={() => setIsBOMSimulatorModalOpen(false)}
        recipes={recipes}
        ingredients={filteredIngredients}
        onSimulate={handleRunBOMSimulation}
      />

      {/* Create PO Modal */}
      <CreatePOModal
        isOpen={isPOModalOpen}
        onClose={() => {
          setIsPOModalOpen(false);
          setSelectedItemForPO(null);
        }}
        ingredients={filteredIngredients}
        initialItem={selectedItemForPO}
        onCreatePO={handleCreatePO}
      />

      {/* PO Detail Preview Modal */}
      <PODetailModal
        po={selectedPOPreview}
        isOpen={Boolean(selectedPOPreview)}
        onClose={() => setSelectedPOPreview(null)}
        onReceivePO={handleReceivePO}
      />

      {/* Stock Opname Modal */}
      <StockOpnameModal
        isOpen={isOpnameModalOpen}
        onClose={() => {
          setIsOpnameModalOpen(false);
          setOpnameInitialItemId(undefined);
        }}
        ingredients={filteredIngredients}
        initialItemId={opnameInitialItemId}
        auditedIds={sessionAuditedIds}
        onSaveOpname={handleSaveStockOpname}
      />

      {/* PDF Inventory Valuation Report Modal */}
      <InventoryReportPDFModal
        isOpen={isPDFModalOpen}
        onClose={() => setIsPDFModalOpen(false)}
        ingredients={filteredIngredients}
        outletName={outletName}
      />

      {/* PDF Official Stock Opname Report Modal */}
      <StockOpnameReportPDFModal
        isOpen={isOpnamePDFModalOpen}
        onClose={() => setIsOpnamePDFModalOpen(false)}
        opnames={stockOpnames}
        outletName={outletName}
      />

      {/* Interactive BOM Recipe Formulation Modal */}
      <BOMRecipeModal
        isOpen={isRecipeModalOpen}
        onClose={() => {
          setIsRecipeModalOpen(false);
          setSelectedRecipeForEdit(null);
        }}
        products={products}
        ingredients={filteredIngredients}
        onSaveRecipe={(recipe) => {
          upsertRecipe(recipe);
          notify.success("Resep disimpan", `Formula resep ${recipe.menuName} berhasil diperbarui.`);
        }}
        initialRecipe={selectedRecipeForEdit}
      />
    </div>
  );
}
