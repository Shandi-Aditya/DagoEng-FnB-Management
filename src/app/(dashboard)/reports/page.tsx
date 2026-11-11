"use client";

import React, { useState, useEffect } from "react";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { useOutlet } from "@/contexts/OutletContext";
import { useAuth } from "@/contexts/AuthContext";
import { useOrders } from "@/contexts/OrderContext";
import { useProducts } from "@/contexts/ProductContext";
import { useInventory } from "@/contexts/InventoryContext";
import { useEmployeeShift } from "@/contexts/EmployeeShiftContext";
import { useActivityLog } from "@/contexts/ActivityLogContext";
import { useSettings } from "@/contexts/SettingsContext";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";
import { calculateSettlement } from "@/lib/settlement";
import { notify } from "@/components/app/notify";
import { EventTicketOrder } from "@/types/event";
import {
  buildReportData,
  getReportCategories,
  type ReportType,
} from "@/features/reports/reports-domain";
import { ReportsToolbar } from "@/features/reports/ReportsToolbar";
import { ReportsCategorySelector } from "@/features/reports/ReportsCategorySelector";
import { ReportsPreviewTable } from "@/features/reports/ReportsPreviewTable";
import StructuredReportPDFModal from "@/features/reports/StructuredReportPDFModal";

export default function ReportsPage() {
  const { formattedRangeLabel } = useDateFilter();
  const { activeOutlet, activeOutletId } = useOutlet();
  const { user } = useAuth();
  const { orders } = useOrders();
  const { products } = useProducts();
  const { filteredIngredients } = useInventory();
  const { shifts } = useEmployeeShift();
  const { logs } = useActivityLog();
  const { settings } = useSettings();

  const [selectedReportType, setSelectedReportType] = useState<ReportType>("SALES");
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
    (p) => activeOutletId === "ALL" || p.outletId === activeOutletId || !p.outletId
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

  const scopeName = activeOutlet?.name || "Semua Gerai (Konsolidasi)";

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

  const categories = getReportCategories({
    ordersCount: filteredOrders.length,
    tenantsCount: calculateSettlement(filteredOrders).length,
    shiftsCount: filteredShifts.length,
    productsCount: filteredProducts.length,
    materialsCount: filteredMaterials.length,
    logsCount: filteredFinanceLogs.length,
    paidEventsCount: eventBookings.filter((b) => b.paymentStatus === "PAID").length,
    canAccessEvents,
  });

  const handleExportCSV = () => {
    downloadCSV(
      `Laporan_${selectedReportType}_${activeOutlet?.name || "All"}_${Date.now()}`,
      currentReport.tableHeaders,
      currentReport.tableRows
    );
    notify.success("Ekspor CSV berhasil", `Laporan ${currentReport.title} berhasil diunduh.`);
  };

  const handleExportExcel = () => {
    downloadExcel(
      `Laporan_${selectedReportType}_${activeOutlet?.name || "All"}_${Date.now()}`,
      currentReport.title.slice(0, 30),
      currentReport.tableHeaders,
      currentReport.tableRows
    );
    notify.success("Ekspor Excel berhasil", `Laporan ${currentReport.title} berhasil diunduh.`);
  };

  return (
    <div className="space-y-6">
      <ReportsToolbar
        scopeName={activeOutlet?.name || "Singaraja"}
        periodLabel={formattedRangeLabel}
        onExportExcel={handleExportExcel}
        onExportCSV={handleExportCSV}
        onOpenPDF={() => setIsPDFModalOpen(true)}
      />

      <ReportsCategorySelector
        categories={categories}
        selectedType={selectedReportType}
        onSelectType={setSelectedReportType}
      />

      <ReportsPreviewTable
        report={currentReport}
        scopeName={scopeName}
        periodLabel={formattedRangeLabel}
      />

      {isPDFModalOpen && (
        <StructuredReportPDFModal
          isOpen={isPDFModalOpen}
          onClose={() => setIsPDFModalOpen(false)}
          reportType={selectedReportType}
          outletName={activeOutlet?.name || "Semua Gerai"}
          periodLabel={formattedRangeLabel}
          generatedBy={user?.name || "Staf Operasional"}
          data={currentReport}
        />
      )}
    </div>
  );
}
