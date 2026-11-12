"use client";

import { useEffect, useMemo, useState } from "react";

import { notify } from "@/components/app/notify";
import { useActivityLog } from "@/contexts/ActivityLogContext";
import { useAuth } from "@/contexts/AuthContext";
import { useOutlet } from "@/contexts/OutletContext";
import {
  buildActivityLogExportRows,
  computeActivityLogStats,
  type DateFilterType,
  emptyActivityLogMessage,
  filterActivityLogs,
  getPeriodLabel,
  getUniqueActors,
  getUniqueRoles,
  type ViewMode,
} from "@/features/activity-log/activity-log-domain";
import { ActivityLogDetailModal } from "@/features/activity-log/ActivityLogDetailModal";
import { ActivityLogFilterBar } from "@/features/activity-log/ActivityLogFilterBar";
import ActivityLogPDFModal from "@/features/activity-log/ActivityLogPDFModal";
import { ActivityLogRestrictedGuard } from "@/features/activity-log/ActivityLogRestrictedGuard";
import { ActivityLogStatsCards } from "@/features/activity-log/ActivityLogStatsCards";
import { ActivityLogTableView } from "@/features/activity-log/ActivityLogTableView";
import { ActivityLogTimelineView } from "@/features/activity-log/ActivityLogTimelineView";
import { ActivityLogToolbar } from "@/features/activity-log/ActivityLogToolbar";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";
import type { ActivityLogEntry } from "@/types/audit";

export default function ActivityLogPage() {
  const { user } = useAuth();
  const { activeOutlet, activeOutletId } = useOutlet();
  const { logs } = useActivityLog();

  const isSuperAdmin = user?.role.slug === "SUPER_ADMIN";
  const isOrgOwner = user?.role.slug === "OWNER" && user?.scopeLevel === "ORGANIZATION";
  const isManager = user?.role.slug === "MANAGER";
  const isTenantOwner = user?.role.slug === "OWNER" && user?.scopeLevel === "TENANT";
  const canAccessAudit = isSuperAdmin || isOrgOwner || isManager || isTenantOwner;

  const [viewMode, setViewMode] = useState<ViewMode>("TABLE");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedModule, setSelectedModule] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [selectedRole, setSelectedRole] = useState<string>("ALL");
  const [selectedActor, setSelectedActor] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<DateFilterType>("ALL");
  const [selectedLog, setSelectedLog] = useState<ActivityLogEntry | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Pagination State
  const [pageSize, setPageSize] = useState<number>(15);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset page whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    selectedModule,
    selectedStatus,
    selectedSeverity,
    selectedRole,
    selectedActor,
    dateFilter,
    pageSize,
    activeOutletId,
  ]);

  const uniqueRoles = useMemo(() => getUniqueRoles(logs), [logs]);
  const uniqueActors = useMemo(() => getUniqueActors(logs), [logs]);

  const scopedLogs = useMemo(
    () =>
      filterActivityLogs(logs, {
        activeOutletId,
        isTenantOwner,
        tenantId: user?.tenant?.id,
        selectedModule,
        selectedStatus,
        selectedSeverity,
        selectedRole,
        selectedActor,
        dateFilter,
        searchTerm,
      }),
    [
      logs,
      activeOutletId,
      isTenantOwner,
      user?.tenant?.id,
      selectedModule,
      selectedStatus,
      selectedSeverity,
      selectedRole,
      selectedActor,
      dateFilter,
      searchTerm,
    ]
  );

  const stats = useMemo(() => computeActivityLogStats(scopedLogs), [scopedLogs]);

  const hasActiveFilters =
    searchTerm.trim() !== "" ||
    selectedModule !== "ALL" ||
    selectedStatus !== "ALL" ||
    selectedSeverity !== "ALL" ||
    selectedRole !== "ALL" ||
    selectedActor !== "ALL" ||
    dateFilter !== "ALL";

  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedModule("ALL");
    setSelectedStatus("ALL");
    setSelectedSeverity("ALL");
    setSelectedRole("ALL");
    setSelectedActor("ALL");
    setDateFilter("ALL");
  };

  const currentRoleStr =
    typeof user?.role === "object" && user.role
      ? user.role.name
      : typeof user?.role === "string"
      ? user.role
      : "Owner";

  if (!canAccessAudit) {
    return <ActivityLogRestrictedGuard roleName={user?.role.name || "Staf"} />;
  }

  const outletScopeName = activeOutlet?.name || "Semua outlet";
  const emptyMessage = emptyActivityLogMessage(hasActiveFilters);

  const handleExportCSV = () => {
    const { headers, rows } = buildActivityLogExportRows(scopedLogs);
    downloadCSV(`Audit_Log_${activeOutlet?.name || "All"}_${Date.now()}`, headers, rows);
    notify.success("Log diekspor ke CSV", `${scopedLogs.length} baris`);
  };

  const handleExportExcel = () => {
    const { headers, rows } = buildActivityLogExportRows(scopedLogs);
    downloadExcel(
      `Audit_Log_${activeOutlet?.name || "All"}_${Date.now()}`,
      "Audit Trail",
      headers,
      rows
    );
    notify.success("Log diekspor ke Excel", `${scopedLogs.length} baris`);
  };

  const handleExportJSON = () => {
    const dataStr =
      "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(scopedLogs, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute(
      "download",
      `Audit_Log_${activeOutlet?.name || "All"}_${Date.now()}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    notify.success("Log diekspor ke JSON", `${scopedLogs.length} entri`);
  };

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-6">
      <ActivityLogToolbar
        outletName={outletScopeName}
        onOpenPDF={() => setIsPdfModalOpen(true)}
        onExportExcel={handleExportExcel}
        onExportCSV={handleExportCSV}
        onExportJSON={handleExportJSON}
      />

      <ActivityLogStatsCards stats={stats} />

      <div className="flex flex-col gap-4">
        <ActivityLogFilterBar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          dateFilter={dateFilter}
          onDateFilterChange={setDateFilter}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          selectedActor={selectedActor}
          onActorChange={setSelectedActor}
          uniqueActors={uniqueActors}
          selectedRole={selectedRole}
          onRoleChange={setSelectedRole}
          uniqueRoles={uniqueRoles}
          selectedModule={selectedModule}
          onModuleChange={setSelectedModule}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={handleResetFilters}
        />

        {viewMode === "TABLE" ? (
          <ActivityLogTableView
            logs={scopedLogs}
            totalLogsCount={scopedLogs.length}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            onSelectLog={setSelectedLog}
            emptyMessage={emptyMessage}
          />
        ) : (
          <ActivityLogTimelineView
            logs={scopedLogs}
            totalLogsCount={scopedLogs.length}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            onSelectLog={setSelectedLog}
            emptyMessage={emptyMessage}
          />
        )}
      </div>

      <ActivityLogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />

      {isPdfModalOpen && (
        <ActivityLogPDFModal
          isOpen={isPdfModalOpen}
          onClose={() => setIsPdfModalOpen(false)}
          logs={scopedLogs}
          outletName={outletScopeName}
          generatedBy={user?.name || "Staf operasional"}
          generatedRole={currentRoleStr}
          periodLabel={getPeriodLabel(dateFilter)}
        />
      )}
    </div>
  );
}
