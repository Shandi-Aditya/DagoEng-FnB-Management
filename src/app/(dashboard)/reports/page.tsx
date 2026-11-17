"use client";

import { useEffect, useMemo, useState } from "react";

import { notify } from "@/components/app/notify";
import { useActivityLog } from "@/contexts/ActivityLogContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { useEmployeeShift } from "@/contexts/EmployeeShiftContext";
import { useInventory } from "@/contexts/InventoryContext";
import { useOrders } from "@/contexts/OrderContext";
import { useOutlet } from "@/contexts/OutletContext";
import { useProducts } from "@/contexts/ProductContext";
import { useSettings } from "@/contexts/SettingsContext";
import { ReportsCategorySelector } from "@/features/reports/ReportsCategorySelector";
import { ReportsPreviewTable } from "@/features/reports/ReportsPreviewTable";
import { ReportsToolbar } from "@/features/reports/ReportsToolbar";
import {
  buildReportData,
  getReportCategories,
  type ReportType,
} from "@/features/reports/reports-domain";
import { analyzeTransactionDiscrepancies } from "@/features/reports/reconciliation-domain";
import StructuredReportPDFModal from "@/features/reports/StructuredReportPDFModal";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";
import { exportTransactionReportExcel } from "@/lib/transaction-export-template";
import { calculateSettlement } from "@/lib/settlement";
import type { EventTicketOrder } from "@/types/event";

export default function ReportsPage() {
  const { formattedRangeLabel, startDate, endDate } = useDateFilter();
  const { activeOutlet, activeOutletId } = useOutlet();
  const { user } = useAuth();
  const { orders } = useOrders();
  const { products } = useProducts();
  const { filteredIngredients } = useInventory();
  const { shifts } = useEmployeeShift();
  const { logs } = useActivityLog();
  const { settings } = useSettings();

  const [selectedReportType, setSelectedReportType] = useState<ReportType>("SALES");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);
  const [eventBookings, setEventBookings] = useState<EventTicketOrder[]>([]);

  const canAccessEvents =
    user?.scopeLevel === "ORGANIZATION" || user?.scopeLevel === "PLATFORM";

  useEffect(() => {
    if (canAccessEvents) {
      fetch("/api/events/bookings")
        .then((res) => res.json())
        .then((json) => {
          if (json.success && json.data) {
            setEventBookings(json.data);
          }
        })
        .catch(() => {});
    }
  }, [canAccessEvents]);

  // Filter dataset by active outlet
  const filteredOrders = orders.filter(
    (o) => activeOutletId === "ALL" || o.outletId === activeOutletId || !o.outletId
  );
  const filteredProducts = products.filter(
    (p) =>
      activeOutletId === "ALL" ||
      p.outletId === "ALL" ||
      p.outletId === activeOutletId ||
      !p.outletId
  );
  const filteredShifts = shifts.filter(
    (s) => activeOutletId === "ALL" || s.outletId === activeOutletId || !s.outletId
  );
  const filteredMaterials = filteredIngredients;
  const filteredFinanceLogs = logs.filter(
    (l) =>
      (activeOutletId === "ALL" || l.outletId === activeOutletId || !l.outletId) &&
      (l.module === "POS" || l.module === "FINANCE" || l.module === "COMMERCIAL")
  );

  const scopeName = activeOutlet?.name || "Semua outlet";

  const currentReport = buildReportData({
    type: selectedReportType,
    scopeName,
    orders: filteredOrders,
    products: filteredProducts,
    shifts: filteredShifts,
    ingredients: filteredMaterials,
    logs: filteredFinanceLogs,
    promos: settings.promos,
    eventBookings,
    operatorName: user?.name,
  });

  const reconAnalysis = useMemo(
    () => analyzeTransactionDiscrepancies({ orders: filteredOrders, shifts: filteredShifts }),
    [filteredOrders, filteredShifts]
  );

  const categories = getReportCategories({
    ordersCount: filteredOrders.length,
    tenantsCount: calculateSettlement(filteredOrders).length,
    shiftsCount: filteredShifts.length,
    productsCount: filteredProducts.length,
    materialsCount: filteredMaterials.length,
    logsCount: filteredFinanceLogs.length,
    paidEventsCount: eventBookings.filter((b) => b.paymentStatus === "PAID").length,
    canAccessEvents,
    discrepanciesCount: reconAnalysis.discrepancies.length,
  });

  const handleSelectReportType = (nextType: ReportType) => {
    setSelectedReportType(nextType);
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    downloadCSV(
      `Laporan_${selectedReportType}_${activeOutlet?.name || "All"}_${Date.now()}`,
      currentReport.tableHeaders,
      currentReport.tableRows
    );
    notify.success("Laporan diekspor ke CSV", currentReport.title);
  };

  const handleExportExcelTemplate = async () => {
    try {
      await exportTransactionReportExcel({
        orders: filteredOrders,
        products: filteredProducts,
        startDate,
        endDate,
        outletName: activeOutlet?.name,
      });
      notify.success("Laporan transaksi template diekspor ke Excel (.xlsx)", "3 Sheet: transaction, detail, tenant shares");
    } catch (err) {
      console.error("Gagal mengekspor laporan transaksi Excel", err);
      notify.error("Gagal mengekspor laporan transaksi ke Excel");
    }
  };

  const handleExportExcel = async () => {
    if (selectedReportType === "SALES") {
      await handleExportExcelTemplate();
      return;
    }

    downloadExcel(
      `Laporan_${selectedReportType}_${activeOutlet?.name || "All"}_${Date.now()}`,
      currentReport.title.slice(0, 30),
      currentReport.tableHeaders,
      currentReport.tableRows
    );
    notify.success("Laporan diekspor ke Excel", currentReport.title);
  };

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-6">
      <div className="flex flex-col gap-4">
        <ReportsToolbar
          scopeName={scopeName}
          periodLabel={formattedRangeLabel}
          onExportExcel={handleExportExcel}
          onExportCSV={handleExportCSV}
          onOpenPDF={() => setIsPDFModalOpen(true)}
        />

        <ReportsCategorySelector
          categories={categories}
          selectedType={selectedReportType}
          onSelectType={handleSelectReportType}
        />
      </div>

      <ReportsPreviewTable
        report={currentReport}
        scopeName={scopeName}
        periodLabel={formattedRangeLabel}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setCurrentPage(1);
        }}
      />

      {isPDFModalOpen && (
        <StructuredReportPDFModal
          isOpen={isPDFModalOpen}
          onClose={() => setIsPDFModalOpen(false)}
          reportType={selectedReportType}
          outletName={scopeName}
          periodLabel={formattedRangeLabel}
          generatedBy={user?.name || "Staf operasional"}
          data={currentReport}
        />
      )}
    </div>
  );
}
