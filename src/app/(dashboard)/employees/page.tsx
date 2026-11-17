"use client";

import { useMemo, useState } from "react";
import { Clock, Users } from "lucide-react";

import { notify } from "@/components/app/notify";
import { StatCard } from "@/components/app/stat-card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployeeShift } from "@/contexts/EmployeeShiftContext";
import { useOrders } from "@/contexts/OrderContext";
import { useOutlet } from "@/contexts/OutletContext";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";
import type { EmployeeProfile, ShiftRecord } from "@/types/shift";

import { AddEmployeeModal } from "@/features/employees/AddEmployeeModal";
import { CloseShiftModal } from "@/features/employees/CloseShiftModal";
import { DeleteEmployeeDialog } from "@/features/employees/DeleteEmployeeDialog";
import { EditEmployeeModal } from "@/features/employees/EditEmployeeModal";
import { EmployeeDetailModal } from "@/features/employees/EmployeeDetailModal";
import {
  buildClosingReportData,
  buildEmployeeExportData,
  calculateEmployeeKPIs,
  type EmployeeDepartment,
  filterEmployees,
  filterShifts,
} from "@/features/employees/employees-domain";
import { EmployeesDirectoryTab } from "@/features/employees/EmployeesDirectoryTab";
import { EmployeesReportPDFModal } from "@/features/employees/EmployeesReportPDFModal";
import { EmployeesShiftsTab } from "@/features/employees/EmployeesShiftsTab";
import { EmployeesToolbar } from "@/features/employees/EmployeesToolbar";
import { OpenShiftModal } from "@/features/employees/OpenShiftModal";
import { DailyClosingPDFModal } from "@/features/pos/DailyClosingPDFModal";

export default function EmployeesPage() {
  const { activeOutlet, activeOutletId } = useOutlet();
  const { user } = useAuth();
  const { filteredOrders } = useOrders();
  const {
    filteredEmployees,
    filteredShifts,
    activeShift,
    createEmployee,
    updateEmployee,
    toggleEmployeeStatus,
    deleteEmployee,
    openShift,
    closeShift,
  } = useEmployeeShift();

  const [activeTab, setActiveTab] = useState<"SHIFTS" | "EMPLOYEES">("SHIFTS");
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<EmployeeProfile | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailEmp, setDetailEmp] = useState<EmployeeProfile | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingEmp, setDeletingEmp] = useState<EmployeeProfile | null>(null);

  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [closingShiftTarget, setClosingShiftTarget] = useState<ShiftRecord | null>(null);
  const [isHRReportPDFOpen, setIsHRReportPDFOpen] = useState(false);
  const [selectedShiftForClosingPDF, setSelectedShiftForClosingPDF] = useState<ShiftRecord | null>(null);
  const [isClosingPDFModalOpen, setIsClosingPDFModalOpen] = useState(false);

  const kpis = useMemo(
    () => calculateEmployeeKPIs(filteredShifts, filteredEmployees),
    [filteredShifts, filteredEmployees]
  );

  const displayedEmployees = useMemo(
    () => filterEmployees(filteredEmployees, deptFilter, statusFilter, searchQuery),
    [filteredEmployees, deptFilter, statusFilter, searchQuery]
  );

  const displayedShifts = useMemo(
    () => filterShifts(filteredShifts, searchQuery),
    [filteredShifts, searchQuery]
  );

  const handleExportCSV = () => {
    const { filename, headers, rows } = buildEmployeeExportData(
      activeTab,
      filteredShifts,
      filteredEmployees,
      activeOutlet?.name || "Singaraja"
    );
    downloadCSV(`${filename}_${Date.now()}`, headers, rows);
    notify.success(`Data ${activeTab === "SHIFTS" ? "shift" : "karyawan"} diekspor ke CSV`);
  };

  const handleExportExcel = () => {
    const { filename, sheet, headers, rows } = buildEmployeeExportData(
      activeTab,
      filteredShifts,
      filteredEmployees,
      activeOutlet?.name || "Singaraja"
    );
    downloadExcel(`${filename}_${Date.now()}`, sheet, headers, rows);
    notify.success(`Data ${activeTab === "SHIFTS" ? "shift" : "karyawan"} diekspor ke Excel`);
  };

  const handleCreateEmployeeSubmit = (params: {
    name: string;
    role: string;
    department: EmployeeDepartment;
    contact: string;
    email: string;
    assignedShift: string;
    permissions: string[];
  }) => {
    createEmployee({
      outletId: activeOutletId,
      outletName: activeOutlet?.name || "Outlet Terpilih",
      name: params.name,
      role: params.role,
      department: params.department,
      contact: params.contact,
      email: params.email,
      assignedShift: params.assignedShift,
      status: "AKTIF",
      joinedDate: new Date().toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      permissions: params.permissions,
    });
    notify.success(`${params.name} ditambahkan`);
  };

  const handleUpdateEmployeeSubmit = (params: {
    id: string;
    name: string;
    role: string;
    department: EmployeeDepartment;
    contact: string;
    email: string;
    assignedShift: string;
    status: "AKTIF" | "CUTI" | "NON-AKTIF";
    permissions: string[];
  }) => {
    updateEmployee(params.id, {
      name: params.name,
      role: params.role,
      department: params.department,
      contact: params.contact,
      email: params.email,
      assignedShift: params.assignedShift,
      status: params.status,
      permissions: params.permissions,
    });
    notify.success(`Data ${params.name} disimpan`);
  };

  const handleToggleStatus = (empId: string) => {
    toggleEmployeeStatus(empId);
    notify.success("Status kepegawaian diubah");
  };

  const handleDeleteEmployeeConfirm = () => {
    if (!deletingEmp) return;
    deleteEmployee(deletingEmp.id);
    notify.success(`${deletingEmp.name} dihapus`);
    setIsDeleteModalOpen(false);
    setDeletingEmp(null);
  };

  const handleOpenShiftSubmit = (params: { shiftName: string; openingCash: number }) => {
    openShift(
      params.shiftName,
      params.openingCash,
      user?.name || "Kasir Utama"
    );
    notify.success(`${params.shiftName} dibuka`);
  };

  const handleCloseShiftSubmit = (params: { actualCash: number; closingNotes?: string }) => {
    const target = closingShiftTarget || activeShift;
    if (!target) return;
    closeShift(
      target.id,
      params.actualCash,
      params.closingNotes
    );
    setClosingShiftTarget(null);
    notify.success("Shift ditutup", "Selisih kas sudah tercatat.");
  };

  const handleOpenClosingPDF = (shift: ShiftRecord) => {
    setSelectedShiftForClosingPDF(shift);
    setIsClosingPDFModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <EmployeesToolbar
        outletName={activeOutlet?.name || "Singaraja Hub"}
        totalEmployees={kpis.totalEmployeesCount}
        activeShiftsCount={kpis.activeShiftsCount}
        onExportExcel={handleExportExcel}
        onExportCSV={handleExportCSV}
        onOpenPDF={() => setIsHRReportPDFOpen(true)}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenShiftModal={() => setIsOpenShiftModalOpen(true)}
        hasActiveShift={Boolean(activeShift)}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatCard
          label="Staf aktif"
          value={String(kpis.activeEmployeesCount)}
          hint="status bertugas"
        />
        <StatCard
          label="Shift berjalan"
          value={activeShift ? activeShift.shiftName : "Tidak ada"}
          hint={activeShift ? `Kasir: ${activeShift.assignedCashierName}` : "shift kasir belum dibuka"}
        />
        <StatCard
          label="Total staf"
          value={String(kpis.totalEmployeesCount)}
          hint={`di ${activeOutlet?.name || "outlet aktif"}`}
        />
        <StatCard
          label="Riwayat shift"
          value={String(kpis.totalShiftsCount)}
          hint="shift tercatat"
        />
      </div>

      {/* Tabs Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val as "SHIFTS" | "EMPLOYEES");
          setSearchQuery("");
        }}
        className="space-y-4"
      >
        <TabsList aria-label="Pilihan modul karyawan dan shift">
          <TabsTrigger value="SHIFTS">
            <Clock />
            <span>Rekonsiliasi shift</span>
            <Badge variant="secondary" className="ml-1 tabular-nums">
              {filteredShifts.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="EMPLOYEES">
            <Users />
            <span>Direktori staf</span>
            <Badge variant="secondary" className="ml-1 tabular-nums">
              {filteredEmployees.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="SHIFTS">
          <EmployeesShiftsTab
            shifts={displayedShifts}
            activeShift={activeShift}
            onOpenCloseShiftModal={(shift) => setClosingShiftTarget(shift)}
            onOpenStartShiftModal={() => setIsOpenShiftModalOpen(true)}
            onOpenClosingPDF={handleOpenClosingPDF}
          />
        </TabsContent>

        <TabsContent value="EMPLOYEES">
          <EmployeesDirectoryTab
            employees={displayedEmployees}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            deptFilter={deptFilter}
            onDeptFilterChange={setDeptFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onSelectDetail={(emp) => {
              setDetailEmp(emp);
              setIsDetailModalOpen(true);
            }}
            onSelectEdit={(emp) => {
              setEditingEmp(emp);
              setIsEditModalOpen(true);
            }}
            onToggleStatus={handleToggleStatus}
            onSelectDelete={(emp) => {
              setDeletingEmp(emp);
              setIsDeleteModalOpen(true);
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <AddEmployeeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreateEmployeeSubmit}
      />

      <EditEmployeeModal
        employee={editingEmp}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingEmp(null);
        }}
        onSubmit={handleUpdateEmployeeSubmit}
      />

      <EmployeeDetailModal
        employee={detailEmp}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setDetailEmp(null);
        }}
        onEdit={(emp) => {
          setEditingEmp(emp);
          setIsEditModalOpen(true);
        }}
      />

      <OpenShiftModal
        isOpen={isOpenShiftModalOpen}
        onClose={() => setIsOpenShiftModalOpen(false)}
        onSubmit={handleOpenShiftSubmit}
      />

      <CloseShiftModal
        shift={closingShiftTarget}
        isOpen={Boolean(closingShiftTarget)}
        onClose={() => setClosingShiftTarget(null)}
        onSubmit={handleCloseShiftSubmit}
      />

      <DeleteEmployeeDialog
        employee={deletingEmp}
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingEmp(null);
        }}
        onConfirm={handleDeleteEmployeeConfirm}
      />

      <EmployeesReportPDFModal
        isOpen={isHRReportPDFOpen}
        onClose={() => setIsHRReportPDFOpen(false)}
        employees={filteredEmployees}
        shifts={filteredShifts}
        outletName={activeOutlet?.name || "Semua Outlet"}
      />

      <DailyClosingPDFModal
        isOpen={isClosingPDFModalOpen}
        onClose={() => {
          setIsClosingPDFModalOpen(false);
          setSelectedShiftForClosingPDF(null);
        }}
        shiftId={selectedShiftForClosingPDF?.id}
        managerPhone="+62 812-3456-7890"
        reportData={buildClosingReportData(
          selectedShiftForClosingPDF || activeShift,
          filteredOrders,
          activeOutlet?.name || "Singaraja",
          user?.name || "Kasir"
        )}
      />
    </div>
  );
}
