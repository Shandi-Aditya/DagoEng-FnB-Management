"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useOutlet } from "@/contexts/OutletContext";
import { useAuth } from "@/contexts/AuthContext";
import { useActivityLog } from "@/contexts/ActivityLogContext";
import { ActivityLogEntry } from "@/types/audit";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";
import { notify } from "@/components/app/notify";
import {
  ViewMode,
  DateFilterType,
  filterActivityLogs,
  computeActivityLogStats,
  getUniqueRoles,
  getUniqueActors,
  getPeriodLabel,
  buildActivityLogExportRows,
} from "@/features/activity-log/activity-log-domain";
import { ActivityLogRestrictedGuard } from "@/features/activity-log/ActivityLogRestrictedGuard";
import { ActivityLogToolbar } from "@/features/activity-log/ActivityLogToolbar";
import { ActivityLogStatsCards } from "@/features/activity-log/ActivityLogStatsCards";
import { ActivityLogFilterBar } from "@/features/activity-log/ActivityLogFilterBar";
import { ActivityLogTableView } from "@/features/activity-log/ActivityLogTableView";
import { ActivityLogTimelineView } from "@/features/activity-log/ActivityLogTimelineView";
import { ActivityLogDetailModal } from "@/features/activity-log/ActivityLogDetailModal";
import ActivityLogPDFModal from "@/features/activity-log/ActivityLogPDFModal";

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

  const currentRoleStr =
    typeof user?.role === "object" && user.role
      ? user.role.name
      : typeof user?.role === "string"
      ? user.role
      : "Owner";

  if (!canAccessAudit) {
    return <ActivityLogRestrictedGuard roleName={user?.role.name || "Staf / Kasir"} />;
  }

  const handleExportCSV = () => {
    const { headers, rows } = buildActivityLogExportRows(scopedLogs);
    downloadCSV(`Audit_Log_${activeOutlet?.name || "All"}_${Date.now()}`, headers, rows);
    notify.success("Ekspor CSV berhasil", `${scopedLogs.length} baris log berhasil diunduh.`);
  };

  const handleExportExcel = () => {
    const { headers, rows } = buildActivityLogExportRows(scopedLogs);
    downloadExcel(
      `Audit_Log_${activeOutlet?.name || "All"}_${Date.now()}`,
      "Audit Trail",
      headers,
      rows
    );
    notify.success("Ekspor Excel berhasil", `${scopedLogs.length} baris log berhasil diunduh.`);
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
    notify.success("Ekspor JSON berhasil", `${scopedLogs.length} entri audit berhasil diunduh.`);
  };

  return (
    <div className="space-y-6">
      <ActivityLogToolbar
        outletName={activeOutlet?.name || "Semua Gerai"}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onOpenPDF={() => setIsPdfModalOpen(true)}
        onExportExcel={handleExportExcel}
        onExportCSV={handleExportCSV}
        onExportJSON={handleExportJSON}
      />

      <ActivityLogStatsCards stats={stats} />

      <ActivityLogFilterBar
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
        />
      )}

      {selectedLog && (
        <ActivityLogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}

      {isPdfModalOpen && (
        <ActivityLogPDFModal
          isOpen={isPdfModalOpen}
          onClose={() => setIsPdfModalOpen(false)}
          logs={scopedLogs}
          outletName={activeOutlet?.name || "Semua Gerai"}
          generatedBy={user?.name || "Hendra Wijaya"}
          generatedRole={currentRoleStr}
          periodLabel={getPeriodLabel(dateFilter)}
        />
      )}
    </div>
  );
}
