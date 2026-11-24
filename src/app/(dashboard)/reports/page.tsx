"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2 } from "lucide-react";

import { notify } from "@/components/app/notify";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
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
  extractAvailableReportCompanies,
  filterReportRows,
  getReportCategories,
  isSettledPaidOrder,
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
  const [selectedCompany, setSelectedCompany] = useState<string>("ALL");

  const isTenantScope = user?.scopeLevel === "TENANT" && Boolean(user?.tenant?.id);
  const tenantId = isTenantScope ? user?.tenant?.id : undefined;

  const canAccessEvents =
    !isTenantScope &&
    (user?.scopeLevel === "ORGANIZATION" || user?.scopeLevel === "PLATFORM");

  const roleSlug = user?.role?.slug || (typeof user?.role === "string" ? user.role : "");
  const canViewUnmaskedEvents =
    roleSlug === "SUPER_ADMIN" || roleSlug === "OWNER" || roleSlug === "MANAGER";

  useEffect(() => {
    if (canAccessEvents) {
      const endpoint = canViewUnmaskedEvents
        ? "/api/events/bookings?unmasked=true"
        : "/api/events/bookings";
      fetch(endpoint)
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
  }, [canAccessEvents, canViewUnmaskedEvents]);

  useEffect(() => {
    setCurrentPage(1);
  }, [startDate, endDate, activeOutletId]);

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

  const reconciliationOrders = useMemo(() => {
    const outletAndDateOrRefundOrders = orders.filter(
      (o) =>
        (activeOutletId === "ALL" || o.outletId === activeOutletId || !o.outletId) &&
        (isDateInRange(o.createdAt) || (Boolean(o.refundedAt) && isDateInRange(o.refundedAt!)))
    );
    return tenantId
      ? projectOrdersForTenant(outletAndDateOrRefundOrders, tenantId)
      : outletAndDateOrRefundOrders;
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
        s.status !== "ACTIVE" &&
        s.status !== "OPEN" &&
        (activeOutletId === "ALL" || s.outletId === activeOutletId || !s.outletId) &&
        isDateInRange(s.closedAt || s.endTime || s.startTime || "")
    );
  }, [shifts, activeOutletId, isDateInRange, isTenantScope]);

  const filteredMaterials = isTenantScope ? [] : filteredIngredients;

  const filteredFinanceLogs = useMemo(() => {
    if (isTenantScope) return [];
    return logs.filter(
      (l) =>
        (activeOutletId === "ALL" || l.outletId === "ALL" || l.outletId === activeOutletId || !l.outletId) &&
        (l.module === "POS" ||
          l.module === "FINANCE" ||
          l.module === "COMMERCIAL" ||
          l.module === "COWORKING" ||
          l.module === "EMPLOYEES_SHIFT") &&
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
    () => analyzeTransactionDiscrepancies({ orders: reconciliationOrders, shifts: filteredShifts }),
    [reconciliationOrders, filteredShifts]
  );

  const paidOrdersCount = filteredOrders.filter(isSettledPaidOrder).length;
  const paidCoworkingCount = filteredCoworkingBookings.filter(
    (b) => b.paymentStatus === "PAID" && b.checkInStatus !== "CANCELLED"
  ).length;
  const pendingCoworkingQrisCount = filteredCoworkingBookings.filter(
    (b) =>
      b.paymentMethod === "QRIS" &&
      b.paymentStatus === "PENDING" &&
      b.checkInStatus !== "CANCELLED"
  ).length;
  const discountedCoworkingCount = filteredCoworkingBookings.filter(
    (b) =>
      b.paymentStatus === "PAID" &&
      b.checkInStatus !== "CANCELLED" &&
      (b.discount || 0) > 0
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
    discrepanciesCount:
      reconAnalysis.discrepancies.length + pendingCoworkingQrisCount + discountedCoworkingCount,
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

  const availableCompanies = useMemo(
    () => extractAvailableReportCompanies(orders, coworkingBookings),
    [orders, coworkingBookings]
  );

  const currentReport = buildReportData({
    type: effectiveReportType,
    scopeName,
    orders: effectiveReportType === "RECONCILIATION" ? reconciliationOrders : filteredOrders,
    products: filteredProducts,
    shifts: filteredShifts,
    ingredients: filteredMaterials,
    logs: filteredFinanceLogs,
    promos: settings.promos,
    eventBookings: filteredEventBookings,
    coworkingBookings: filteredCoworkingBookings,
    tenantId,
    operatorName: user?.name,
    companyName: selectedCompany,
  });

  const exportableReportRows = useMemo(
    () => filterReportRows(currentReport.tableRows, searchQuery),
    [currentReport.tableRows, searchQuery]
  );

  const exportableReportData = useMemo(
    () => ({
      ...currentReport,
      tableRows: exportableReportRows,
    }),
    [currentReport, exportableReportRows]
  );

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
      exportableReportRows
    );
    notify.success("Laporan diekspor ke CSV", currentReport.title);
  };

  const handleExportExcelTemplate = async () => {
    try {
      const needle = searchQuery.trim().toLowerCase();
      const paidOrders = filteredOrders.filter((o) => {
        if (!isSettledPaidOrder(o)) return false;
        if (
          selectedCompany !== "ALL" &&
          o.corporateInfo?.companyName?.trim().toLowerCase() !== selectedCompany.trim().toLowerCase()
        ) {
          return false;
        }
        if (!needle) return true;
        const fields = [
          o.orderNumber,
          o.customerName,
          o.tableNumber,
          o.paymentMethod,
          o.orderType,
          ...o.items.map((it) => it.productName),
        ];
        return fields.some((val) => val?.toLowerCase().includes(needle));
      });
      const effectiveCoworking = filteredCoworkingBookings.filter((b) => {
        if (
          selectedCompany !== "ALL" &&
          b.company?.trim().toLowerCase() !== selectedCompany.trim().toLowerCase()
        ) {
          return false;
        }
        return true;
      });
      await exportTransactionReportExcel({
        orders: paidOrders,
        products: filteredProducts,
        startDate,
        endDate,
        outletName: scopeName,
        tenantId,
        coworkingBookings: effectiveCoworking,
      });
      notify.success("Laporan transaksi diekspor ke Excel (.xlsx)", "3 sheet: transaction, detail, tenant shares");
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
      exportableReportRows
    );
    notify.success("Laporan diekspor ke Excel", currentReport.title);
  };

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-6">
      <div className="flex flex-col gap-4">
        <ReportsToolbar
          scopeName={scopeName}
          periodLabel={formattedRangeLabel}
          isTemplateXlsx={effectiveReportType === "SALES"}
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
        companyFilter={
          effectiveReportType === "SALES" ||
          effectiveReportType === "PRODUCTS"
            ? {
                selectedCompany,
                availableCompanies,
                onCompanyChange: (company) => {
                  setSelectedCompany(company);
                  setCurrentPage(1);
                },
              }
            : undefined
        }
      />

      {isPDFModalOpen && (
        <StructuredReportPDFModal
          isOpen={isPDFModalOpen}
          onClose={() => setIsPDFModalOpen(false)}
          reportType={effectiveReportType}
          outletName={scopeName}
          periodLabel={formattedRangeLabel}
          generatedBy={user?.name || "Staf operasional"}
          data={exportableReportData}
        />
      )}
    </div>
  );
}
