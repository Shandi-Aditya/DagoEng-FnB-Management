"use client";

import { useEffect, useMemo, useState } from "react";

import { notify } from "@/components/app/notify";
import { Badge } from "@/components/ui/badge";
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
import { ReorderPanel } from "@/features/inventory/ReorderPanel";
import { buildReorderList, deliveryDateLabel } from "@/features/inventory/inventory-reorder";
import { StockAdjustmentModal } from "@/features/inventory/StockAdjustmentModal";
import { StockOpnameModal } from "@/features/inventory/StockOpnameModal";
import { StockOpnameReportPDFModal } from "@/features/inventory/StockOpnameReportPDFModal";

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
    createPurchaseOrder,
    receivePurchaseOrder,
  } = useInventory();

  const outletName = activeOutlet?.name ?? "Outlet";

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

  const reorderEntries = useMemo(() => buildReorderList(filteredIngredients), [filteredIngredients]);

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
    notify.success("Stok disesuaikan", target ? `Stok ${target.name} diperbarui.` : undefined);
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
      expectedDelivery: deliveryDateLabel(new Date(), 2),
      notes,
    });

    notify.success("PO dibuat", `${item.name}, ${quantity} ${item.unit} ke ${supplier}.`);
  };

  const handleReceivePO = (poId: string) => {
    receivePurchaseOrder(poId);
    notify.success("Barang diterima", "Stok bahan sudah ditambahkan.");
  };

  const handleExportStockCSV = () => {
    const { headers, rows } = buildStockExportData(filteredIngredients);
    downloadCSV(`Master_Stok_Bahan_Baku_${Date.now()}`, headers, rows);
    notify.success("Stok diekspor ke CSV");
  };

  const handleExportStockExcel = () => {
    const { headers, rows } = buildStockExportData(filteredIngredients);
    downloadExcel(`Master_Stok_Bahan_Baku_${Date.now()}`, "Master Stok", headers, rows);
    notify.success("Stok diekspor ke Excel");
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
    const resolvedOutletId =
      activeOutletId && activeOutletId !== "ALL"
        ? activeOutletId
        : (target as { outletId?: string }).outletId || "outlet-sgr";

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
      tenantId: resolvedOutletId,
      outletId: resolvedOutletId,
    });

    setSessionAuditedIds((prev) => [...prev, target.id]);
    notify.success(
      "Opname disimpan",
      `${result.opnameNumber}, ${target.name}: selisih ${variance > 0 ? `+${variance}` : variance} ${target.unit}.`
    );
  };

  const handleExportOpnameCSV = () => {
    const { headers, rows } = buildOpnameExportData(stockOpnames);
    downloadCSV(`Laporan_Stock_Opname_${Date.now()}`, headers, rows);
    notify.success("Opname diekspor ke CSV");
  };

  const handleExportOpnameExcel = () => {
    const { headers, rows } = buildOpnameExportData(stockOpnames);
    downloadExcel(`Laporan_Stock_Opname_${Date.now()}`, "Stock Opname", headers, rows);
    notify.success("Opname diekspor ke Excel");
  };

  return (
    <div className="space-y-6">
      <InventoryToolbar
        totalStockValue={kpis.totalStockValue}
        ingredientCount={filteredIngredients.length}
        lowCount={kpis.lowCount}
        reorderCount={reorderEntries.length}
        onOpenValuationPDF={() => setIsPDFModalOpen(true)}
        onOpenBOMSimulator={() => setIsBOMSimulatorModalOpen(true)}
        onExportExcel={handleExportStockExcel}
        onExportCSV={handleExportStockCSV}
        onOpenCreatePO={() => {
          setSelectedItemForPO(null);
          setIsPOModalOpen(true);
        }}
      />

      <ReorderPanel
        entries={reorderEntries}
        onCreatePO={(item) => {
          setSelectedItemForPO(item);
          setIsPOModalOpen(true);
        }}
      />

      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "STOCK" | "BOM" | "PO" | "OPNAME")}
      >
        <TabsList>
          <TabsTrigger value="STOCK">Stok</TabsTrigger>
          <TabsTrigger value="BOM">
            Resep
            <Badge variant="secondary">{recipes.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="PO">
            <span className="sm:hidden">PO</span>
            <span className="hidden sm:inline">Pesanan pembelian</span>
            <Badge variant="secondary">{filteredPurchaseOrders.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="OPNAME">
            Opname
            <Badge variant="secondary">{stockOpnames.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="STOCK" className="m-0 focus-visible:outline-hidden">
            <InventoryStockTab
              ingredients={paginatedIngredients}
              allIngredientsCount={displayedIngredients.length}
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
          notify.success("Resep disimpan", recipe.menuName);
        }}
        initialRecipe={selectedRecipeForEdit}
      />
    </div>
  );
}
