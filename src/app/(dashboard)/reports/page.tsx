"use client";

import { useEffect, useMemo, useState } from "react";

import { notify } from "@/components/app/notify";
import { useActivityLog } from "@/contexts/ActivityLogContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCoworking } from "@/contexts/CoworkingContext";
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
  projectOrdersForTenant,
  type ReportType,
} from "@/features/reports/reports-domain";
import { analyzeTransactionDiscrepancies } from "@/features/reports/reconciliation-domain";
import StructuredReportPDFModal from "@/features/reports/StructuredReportPDFModal";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";
import { exportTransactionReportExcel } from "@/lib/transaction-export-template";
import { calculateSettlement } from "@/lib/settlement";
import type { EventTicketOrder } from "@/types/event";

export default function ReportsPage() {
  const { formattedRangeLabel, startDate, endDate, isDateInRange } = useDateFilter();
  const { activeOutlet, activeOutletId } = useOutlet();
  const { user } = useAuth();
  const { orders } = useOrders();
  const { bookings: coworkingBookings } = useCoworking();
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

  const isTenantScope = user?.scopeLevel === "TENANT" && Boolean(user?.tenant?.id);
  const tenantId = isTenantScope ? user?.tenant?.id : undefined;

  const canAccessEvents =
    !isTenantScope &&
    (user?.scopeLevel === "ORGANIZATION" || user?.scopeLevel === "PLATFORM");

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
    } else {
      setEventBookings([]);
    }
  }, [canAccessEvents]);

  const filteredOrders = useMemo(() => {
    const outletAndDateOrders = orders.filter(
      (o) =>
        (activeOutletId === "ALL" || o.outletId === activeOutletId || !o.outletId) &&
        isDateInRange(o.createdAt)
    );
    return tenantId
      ? projectOrdersForTenant(outletAndDateOrders, tenantId)
      : outletAndDateOrders;
  }, [orders, activeOutletId, isDateInRange, tenantId]);

  const filteredCoworkingBookings = useMemo(() => {
    if (isTenantScope) return [];
    return coworkingBookings.filter(
      (b) =>
        (activeOutletId === "ALL" || !b.outletId || b.outletId === activeOutletId) &&
        isDateInRange(b.createdAt || b.date)
    );
  }, [coworkingBookings, activeOutletId, isDateInRange, isTenantScope]);

  const filteredProducts = useMemo(
    () =>
      products.filter((p) => {
        const matchOutlet =
          activeOutletId === "ALL" ||
          p.outletId === "ALL" ||
          p.outletId === activeOutletId ||
          !p.outletId;
        const matchTenant = !tenantId || p.tenantId === tenantId;
        return matchOutlet && matchTenant;
      }),
    [products, activeOutletId, tenantId]
  );

  const filteredShifts = useMemo(() => {
    if (isTenantScope) return [];
    return shifts.filter(
      (s) =>
        (activeOutletId === "ALL" || s.outletId === activeOutletId || !s.outletId) &&
        isDateInRange(s.closedAt || s.endTime || s.startTime || "")
    );
  }, [shifts, activeOutletId, isDateInRange, isTenantScope]);

  const filteredMaterials = isTenantScope ? [] : filteredIngredients;

  const filteredFinanceLogs = useMemo(() => {
    if (isTenantScope) return [];
    return logs.filter(
      (l) =>
        (activeOutletId === "ALL" || l.outletId === activeOutletId || !l.outletId) &&
        (l.module === "POS" ||
          l.module === "FINANCE" ||
          l.module === "COMMERCIAL" ||
          l.module === "COWORKING") &&
        isDateInRange(l.timestamp)
    );
  }, [logs, activeOutletId, isDateInRange, isTenantScope]);

  const filteredEventBookings = useMemo(() => {
    if (!canAccessEvents) return [];
    return eventBookings.filter((b) => isDateInRange(b.createdAt));
  }, [eventBookings, canAccessEvents, isDateInRange]);

  const scopeName = isTenantScope
    ? `${user?.tenant?.name || "Mitra"} · ${activeOutlet?.name || "Singaraja"}`
    : activeOutlet?.name || "Semua outlet";

  const reconAnalysis = useMemo(
    () => analyzeTransactionDiscrepancies({ orders: filteredOrders, shifts: filteredShifts }),
    [filteredOrders, filteredShifts]
  );

  const paidOrdersCount = filteredOrders.filter(
    (o) => o.paymentStatus === "PAID" && o.status !== "CANCELLED"
  ).length;
  const paidCoworkingCount = filteredCoworkingBookings.filter(
    (b) => b.paymentStatus === "PAID" && b.checkInStatus !== "CANCELLED"
  ).length;
  const pendingCoworkingQrisCount = filteredCoworkingBookings.filter(
    (b) =>
      b.paymentMethod === "QRIS" &&
      b.paymentStatus === "PENDING" &&
      b.checkInStatus !== "CANCELLED"
  ).length;
  const settlementRowsCount = useMemo(() => {
    const rows = calculateSettlement(filteredOrders);
    return tenantId ? rows.filter((s) => s.tenantId === tenantId).length : rows.length;
  }, [filteredOrders, tenantId]);

  const categories = getReportCategories({
    ordersCount: paidOrdersCount + paidCoworkingCount,
    tenantsCount: settlementRowsCount,
    shiftsCount: filteredShifts.length,
    productsCount: filteredProducts.length,
    materialsCount: filteredMaterials.length,
    logsCount: filteredFinanceLogs.length,
    paidEventsCount: filteredEventBookings.filter((b) => b.paymentStatus === "PAID").length,
    canAccessEvents,
    discrepanciesCount: reconAnalysis.discrepancies.length + pendingCoworkingQrisCount,
    isTenantScope,
  });

  useEffect(() => {
    if (!categories.some((c) => c.id === selectedReportType)) {
      setSelectedReportType("SALES");
      setSearchQuery("");
      setCurrentPage(1);
    }
  }, [categories, selectedReportType]);

  const effectiveReportType: ReportType = categories.some((c) => c.id === selectedReportType)
    ? selectedReportType
    : "SALES";

  const currentReport = buildReportData({
    type: effectiveReportType,
    scopeName,
    orders: filteredOrders,
    products: filteredProducts,
    shifts: filteredShifts,
    ingredients: filteredMaterials,
    logs: filteredFinanceLogs,
    promos: settings.promos,
    eventBookings: filteredEventBookings,
    coworkingBookings: filteredCoworkingBookings,
    tenantId,
    operatorName: user?.name,
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
      `Laporan_${effectiveReportType}_${activeOutlet?.name || "All"}_${Date.now()}`,
      currentReport.tableHeaders,
      currentReport.tableRows
    );
    notify.success("Laporan diekspor ke CSV", currentReport.title);
  };

  const handleExportExcelTemplate = async () => {
    try {
      const paidOrders = filteredOrders.filter(
        (o) => o.paymentStatus === "PAID" && o.status !== "CANCELLED"
      );
      await exportTransactionReportExcel({
        orders: paidOrders,
        products: filteredProducts,
        startDate,
        endDate,
        outletName: scopeName,
      });
      notify.success("Laporan transaksi template diekspor ke Excel (.xlsx)", "3 Sheet: transaction, detail, tenant shares");
    } catch (err) {
      console.error("Gagal mengekspor laporan transaksi Excel", err);
      notify.error("Gagal mengekspor laporan transaksi ke Excel");
    }
  };

  const handleExportExcel = async () => {
    if (effectiveReportType === "SALES") {
      await handleExportExcelTemplate();
      return;
    }

    downloadExcel(
      `Laporan_${effectiveReportType}_${activeOutlet?.name || "All"}_${Date.now()}`,
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
          selectedType={effectiveReportType}
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
          reportType={effectiveReportType}
          outletName={scopeName}
          periodLabel={formattedRangeLabel}
          generatedBy={user?.name || "Staf operasional"}
          data={currentReport}
        />
      )}
    </div>
  );
}
