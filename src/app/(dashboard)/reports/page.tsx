"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { notify } from "@/components/app/notify";
import { Button } from "@/components/ui/button";
import { useActivityLog } from "@/contexts/ActivityLogContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCoworking } from "@/contexts/CoworkingContext";
import { getTodayWitaDateString, useDateFilter } from "@/contexts/DateFilterContext";
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
  countVoidRefundDiscountEntries,
  extractAvailableReportCompanies,
  filterReportRows,
  getReportCategories,
  getWeeklySettlementPeriod,
  isSettledPaidOrder,
  projectOrdersForTenant,
  recalculateReportSummaryCards,
  type MdrBearerMode,
  type ReportType,
} from "@/features/reports/reports-domain";
import {
  buildSettlementReportDataset,
  calculateConsolidatedWeeklySettlement,
  calculateWeeklyTenantSettlement,
  fetchWeeklySettlementStatuses,
  getSettlementPaymentStatus,
  persistWeeklySettlementStatus,
  shiftWeeklyPeriodDate,
  type SettlementActionDirection,
  type SettlementPaymentStatus,
} from "@/features/reports/settlement-weekly-domain";
import { analyzeTransactionDiscrepancies } from "@/features/reports/reconciliation-domain";
import StructuredReportPDFModal from "@/features/reports/StructuredReportPDFModal";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";
import { exportTransactionReportExcel } from "@/lib/transaction-export-template";
import type { EventTicketOrder } from "@/types/event";

export default function ReportsPage() {
  const { formattedRangeLabel, startDate, endDate, isDateInRange } = useDateFilter();
  const { activeOutlet, activeOutletId, allOutlets } = useOutlet();
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
  const [mdrBearer, setMdrBearer] = useState<MdrBearerMode>("MITRA");
  const [settlementReferenceDate, setSettlementReferenceDate] = useState<string>(() =>
    getTodayWitaDateString()
  );
  const [settlementRefreshTrigger, setSettlementRefreshTrigger] = useState(0);
  const [pendingSettlementAction, setPendingSettlementAction] = useState<{
    tenantId: string;
    tenantName: string;
    nextStatus: SettlementPaymentStatus;
    direction: SettlementActionDirection;
    actionLabel: string;
  } | null>(null);
  const [isUpdatingSettlementStatus, setIsUpdatingSettlementStatus] = useState(false);
  const isUpdatingSettlementRef = useRef(false);

  const isTenantScope = user?.scopeLevel === "TENANT" && Boolean(user?.tenant?.id);
  const tenantId = isTenantScope ? user?.tenant?.id : undefined;

  const canAccessEvents =
    !isTenantScope &&
    (user?.scopeLevel === "ORGANIZATION" || user?.scopeLevel === "PLATFORM");

  const roleSlug = user?.role?.slug || (typeof user?.role === "string" ? user.role : "");
  const canViewUnmaskedEvents =
    roleSlug === "SUPER_ADMIN" || roleSlug === "OWNER" || roleSlug === "MANAGER";
  const canManageWeeklySettlement =
    roleSlug === "SUPER_ADMIN" || (roleSlug === "OWNER" && !isTenantScope);

  const selectedSettlementPeriod = useMemo(
    () => getWeeklySettlementPeriod(settlementReferenceDate),
    [settlementReferenceDate]
  );
  const currentWeekKey = useMemo(
    () => getWeeklySettlementPeriod(getTodayWitaDateString()).periodKey,
    []
  );
  const lastWeekRefDate = useMemo(
    () => shiftWeeklyPeriodDate(getTodayWitaDateString(), -1),
    []
  );
  const lastWeekKey = useMemo(
    () => getWeeklySettlementPeriod(lastWeekRefDate).periodKey,
    [lastWeekRefDate]
  );

  useEffect(() => {
    if (!canAccessEvents) {
      setEventBookings([]);
      return;
    }
    let cancelled = false;
    const endpoint = canViewUnmaskedEvents
      ? "/api/events/bookings?unmasked=true"
      : "/api/events/bookings";
    fetch(endpoint)
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as
          | { success?: boolean; data?: EventTicketOrder[]; error?: string }
          | null;
        if (!res.ok || !json?.success || !Array.isArray(json.data)) {
          throw new Error(json?.error || "Gagal memuat data tiket event.");
        }
        if (!cancelled) {
          setEventBookings(json.data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          notify.error(
            "Gagal memuat data tiket event",
            err instanceof Error ? err.message : "Periksa koneksi lalu muat ulang halaman."
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canAccessEvents, canViewUnmaskedEvents]);

  useEffect(() => {
    let cancelled = false;
    fetchWeeklySettlementStatuses(selectedSettlementPeriod.periodKey)
      .then(() => {
        if (!cancelled) {
          setSettlementRefreshTrigger((prev) => prev + 1);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          notify.error(
            "Gagal memuat status settlement",
            err instanceof Error ? err.message : "Periksa koneksi lalu muat ulang halaman."
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSettlementPeriod.periodKey]);

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

  const settlementScopedOrders = useMemo(() => {
    const outletOrders = orders.filter(
      (o) => activeOutletId === "ALL" || o.outletId === activeOutletId || !o.outletId
    );
    return tenantId ? projectOrdersForTenant(outletOrders, tenantId) : outletOrders;
  }, [orders, activeOutletId, tenantId]);

  const reconciliationOrders = useMemo(() => {
    const outletAndDateOrRefundOrders = orders.filter(
      (o) =>
        (activeOutletId === "ALL" || o.outletId === activeOutletId || !o.outletId) &&
        (isDateInRange(o.createdAt) ||
          (Boolean(o.refundedAt) && isDateInRange(o.refundedAt!)) ||
          (Boolean(o.voidedAt) && isDateInRange(o.voidedAt!)))
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
    (b) =>
      b.paymentStatus === "PAID" &&
      b.checkInStatus !== "CANCELLED" &&
      !b.linkedOrderId &&
      !b.billedViaPosOrder
  ).length;
  const pendingCoworkingQrisCount = filteredCoworkingBookings.filter(
    (b) =>
      b.paymentMethod === "QRIS" &&
      b.paymentStatus === "PENDING" &&
      b.checkInStatus !== "CANCELLED" &&
      !b.linkedOrderId &&
      !b.billedViaPosOrder
  ).length;
  const discountedCoworkingCount = filteredCoworkingBookings.filter(
    (b) =>
      b.paymentStatus === "PAID" &&
      b.checkInStatus !== "CANCELLED" &&
      (b.discount || 0) > 0 &&
      !b.linkedOrderId &&
      !b.billedViaPosOrder
  ).length;
  const settlementRowsCount = useMemo(() => {
    void settlementRefreshTrigger;
    return buildSettlementReportDataset({
      scopeName,
      orders: settlementScopedOrders,
      tenantId,
      mdrBearer,
      referenceDate: settlementReferenceDate,
      outlets: allOutlets,
    }).tableRows.length;
  }, [
    settlementRefreshTrigger,
    scopeName,
    settlementScopedOrders,
    tenantId,
    mdrBearer,
    settlementReferenceDate,
    allOutlets,
  ]);

  const consolidatedSettlementRowsCount = useMemo(() => {
    void settlementRefreshTrigger;
    return calculateConsolidatedWeeklySettlement(settlementScopedOrders, {
      mdrBearer,
      referenceDate: settlementReferenceDate,
      outlets: allOutlets,
      includeInternal: true,
    }).tenants.length;
  }, [
    settlementRefreshTrigger,
    settlementScopedOrders,
    mdrBearer,
    settlementReferenceDate,
    allOutlets,
  ]);

  const voidRefundDiscountCount = useMemo(
    () =>
      countVoidRefundDiscountEntries({
        orders: reconciliationOrders,
        logs,
        tenantId,
        isTimestampInRange: isDateInRange,
      }),
    [reconciliationOrders, logs, tenantId, isDateInRange]
  );

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
    voidRefundDiscountCount,
    isTenantScope,
  }).map((cat) =>
    cat.id === "SETTLEMENT_CONSOLIDATED"
      ? {
          ...cat,
          count: `${consolidatedSettlementRowsCount} Tenant`,
          rawCount: consolidatedSettlementRowsCount,
        }
      : cat
  );

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

  const isWeeklySettlementView =
    effectiveReportType === "SETTLEMENT" || effectiveReportType === "SETTLEMENT_CONSOLIDATED";

  const activePeriodLabel = isWeeklySettlementView
    ? selectedSettlementPeriod.periodLabel
    : formattedRangeLabel;

  const availableCompanies = useMemo(
    () => extractAvailableReportCompanies(orders, coworkingBookings),
    [orders, coworkingBookings]
  );

  const currentReport = useMemo(() => {
    void settlementRefreshTrigger;
    return buildReportData({
      type: effectiveReportType,
      scopeName,
      orders: isWeeklySettlementView
        ? settlementScopedOrders
        : effectiveReportType === "RECONCILIATION" || effectiveReportType === "VOID_REFUND_DISCOUNT"
        ? reconciliationOrders
        : filteredOrders,
      products: filteredProducts,
      shifts: filteredShifts,
      ingredients: filteredMaterials,
      logs: effectiveReportType === "VOID_REFUND_DISCOUNT" ? logs : filteredFinanceLogs,
      promos: settings.promos,
      eventBookings: filteredEventBookings,
      coworkingBookings: filteredCoworkingBookings,
      tenantId,
      operatorName: user?.name,
      isTimestampInRange: isDateInRange,
      companyName: selectedCompany,
      mdrBearer,
      referenceDate: settlementReferenceDate,
      outlets: allOutlets,
    });
  }, [
    settlementRefreshTrigger,
    effectiveReportType,
    scopeName,
    isWeeklySettlementView,
    settlementScopedOrders,
    reconciliationOrders,
    filteredOrders,
    filteredProducts,
    filteredShifts,
    filteredMaterials,
    logs,
    filteredFinanceLogs,
    settings.promos,
    filteredEventBookings,
    filteredCoworkingBookings,
    tenantId,
    user?.name,
    isDateInRange,
    selectedCompany,
    mdrBearer,
    settlementReferenceDate,
    allOutlets,
  ]);

  const handleRequestToggleSettlementStatus = (targetTenantId: string) => {
    if (!canManageWeeklySettlement) return;
    const weekly = calculateWeeklyTenantSettlement(settlementScopedOrders, targetTenantId, {
      referenceDate: settlementReferenceDate,
      mdrBearer,
      outlets: allOutlets,
    });
    const current = getSettlementPaymentStatus(selectedSettlementPeriod.periodKey, targetTenantId);
    const nextStatus: SettlementPaymentStatus = current.status === "PAID" ? "PENDING" : "PAID";
    setPendingSettlementAction({
      tenantId: weekly.tenantId,
      tenantName: weekly.tenantName,
      nextStatus,
      direction: weekly.actionDirection,
      actionLabel: weekly.actionLabel,
    });
  };

  const handleConfirmToggleSettlementStatus = async () => {
    if (!pendingSettlementAction || isUpdatingSettlementRef.current) return;
    const target = pendingSettlementAction;
    isUpdatingSettlementRef.current = true;
    setIsUpdatingSettlementStatus(true);
    try {
      const result = await persistWeeklySettlementStatus({
        periodKey: selectedSettlementPeriod.periodKey,
        tenantId: target.tenantId,
        status: target.nextStatus,
        direction: target.direction,
        notes: `Diperbarui dari halaman laporan (${target.actionLabel})`,
      });

      if (!result.success) {
        notify.error(
          "Gagal menyimpan status settlement",
          result.error || "Periksa izin akses dan coba lagi."
        );
        setPendingSettlementAction(target);
        return;
      }

      setSettlementRefreshTrigger((prev) => prev + 1);
      setPendingSettlementAction(null);
      if (target.nextStatus === "PAID") {
        notify.success(
          "Settlement ditandai lunas",
          `${target.tenantName} · ${selectedSettlementPeriod.periodLabel}`
        );
      } else {
        notify.info(
          "Status settlement dikembalikan",
          `${target.tenantName} · Belum lunas`
        );
      }
    } catch (err) {
      notify.error(
        "Gagal menyimpan status settlement",
        err instanceof Error ? err.message : "Periksa koneksi lalu coba lagi."
      );
      setPendingSettlementAction(target);
    } finally {
      isUpdatingSettlementRef.current = false;
      setIsUpdatingSettlementStatus(false);
    }
  };

  const exportableReportRows = useMemo(
    () => filterReportRows(currentReport.tableRows, searchQuery),
    [currentReport.tableRows, searchQuery]
  );

  const exportableReportData = useMemo(() => {
    if (!searchQuery.trim()) {
      return currentReport;
    }
    return {
      ...currentReport,
      summaryCards: recalculateReportSummaryCards(
        currentReport,
        exportableReportRows,
        effectiveReportType
      ),
      tableRows: exportableReportRows,
    };
  }, [currentReport, exportableReportRows, searchQuery, effectiveReportType]);

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
          periodLabel={activePeriodLabel}
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

        {isWeeklySettlementView && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
            <div className="flex items-center gap-2.5 text-sm">
              <Calendar className="size-4 text-muted-foreground" aria-hidden />
              <div>
                <p className="font-medium text-foreground">
                  Periode minggu: {selectedSettlementPeriod.periodLabel}
                </p>
                <p className="text-xs text-muted-foreground">
                  Batas setor/transfer: {selectedSettlementPeriod.paymentDueLabel}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={selectedSettlementPeriod.periodKey === lastWeekKey ? "secondary" : "outline"}
                onClick={() => {
                  setSettlementReferenceDate(lastWeekRefDate);
                  setCurrentPage(1);
                }}
              >
                Minggu lalu
              </Button>
              <Button
                type="button"
                size="sm"
                variant={selectedSettlementPeriod.periodKey === currentWeekKey ? "secondary" : "outline"}
                onClick={() => {
                  setSettlementReferenceDate(getTodayWitaDateString());
                  setCurrentPage(1);
                }}
              >
                Minggu ini
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                aria-label="Minggu sebelumnya"
                onClick={() => {
                  setSettlementReferenceDate((prev) => shiftWeeklyPeriodDate(prev, -1));
                  setCurrentPage(1);
                }}
              >
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                aria-label="Minggu berikutnya"
                onClick={() => {
                  setSettlementReferenceDate((prev) => shiftWeeklyPeriodDate(prev, 1));
                  setCurrentPage(1);
                }}
              >
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        )}
      </div>

      <ReportsPreviewTable
        report={{ ...currentReport, summaryCards: exportableReportData.summaryCards }}
        reportType={effectiveReportType}
        scopeName={scopeName}
        periodLabel={activePeriodLabel}
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
        mdrBearerFilter={
          isWeeklySettlementView
            ? {
                selected: mdrBearer,
                onChange: (mode) => setMdrBearer(mode),
              }
            : undefined
        }
        onToggleSettlementStatus={
          canManageWeeklySettlement && isWeeklySettlementView
            ? handleRequestToggleSettlementStatus
            : undefined
        }
      />

      {isPDFModalOpen && (
        <StructuredReportPDFModal
          isOpen={isPDFModalOpen}
          onClose={() => setIsPDFModalOpen(false)}
          reportType={effectiveReportType}
          outletName={scopeName}
          periodLabel={activePeriodLabel}
          generatedBy={user?.name || "Staf operasional"}
          data={exportableReportData}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingSettlementAction)}
        onOpenChange={(open) => {
          if (!open && !isUpdatingSettlementRef.current) {
            setPendingSettlementAction(null);
          }
        }}
        title={
          pendingSettlementAction?.nextStatus === "PAID"
            ? "Tandai settlement lunas?"
            : "Kembalikan status ke belum lunas?"
        }
        description={
          pendingSettlementAction?.nextStatus === "PAID"
            ? `Catat pelunasan settlement ${pendingSettlementAction.tenantName} untuk periode ${selectedSettlementPeriod.periodLabel} (${pendingSettlementAction.actionLabel}).`
            : `Kembalikan status settlement ${pendingSettlementAction?.tenantName || "mitra"} periode ${selectedSettlementPeriod.periodLabel} menjadi belum lunas.`
        }
        confirmLabel={
          isUpdatingSettlementStatus
            ? "Menyimpan..."
            : pendingSettlementAction?.nextStatus === "PAID"
            ? "Tandai lunas"
            : "Kembalikan status"
        }
        destructive={pendingSettlementAction?.nextStatus === "PENDING"}
        onConfirm={() => {
          void handleConfirmToggleSettlementStatus();
        }}
      />
    </div>
  );
}
