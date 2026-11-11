"use client";

import { useState, useMemo } from "react";
import { Clock, Users } from "lucide-react";
import { useOutlet } from "@/contexts/OutletContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployeeShift } from "@/contexts/EmployeeShiftContext";
import { useOrders } from "@/contexts/OrderContext";
import type { EmployeeProfile, ShiftRecord } from "@/types/shift";
import { notify } from "@/components/app/notify";
import { StatCard } from "@/components/app/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";
import { DailyClosingPDFModal } from "@/features/pos/DailyClosingPDFModal";
import { EmployeesReportPDFModal } from "@/features/employees/EmployeesReportPDFModal";

import {
  calculateEmployeeKPIs,
  filterEmployees,
  filterShifts,
  buildEmployeeExportData,
  buildClosingReportData,
  type EmployeeDepartment,
} from "@/features/employees/employees-domain";
import { EmployeesToolbar } from "@/features/employees/EmployeesToolbar";
import { EmployeesShiftsTab } from "@/features/employees/EmployeesShiftsTab";
import { EmployeesDirectoryTab } from "@/features/employees/EmployeesDirectoryTab";
import { AddEmployeeModal } from "@/features/employees/AddEmployeeModal";
import { EditEmployeeModal } from "@/features/employees/EditEmployeeModal";
import { EmployeeDetailModal } from "@/features/employees/EmployeeDetailModal";
import { OpenShiftModal } from "@/features/employees/OpenShiftModal";
import { CloseShiftModal } from "@/features/employees/CloseShiftModal";
import { DeleteEmployeeDialog } from "@/features/employees/DeleteEmployeeDialog";

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
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
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
    notify.success(
      `Data ${activeTab === "SHIFTS" ? "Shift Kasir" : "Karyawan"} berhasil diekspor ke CSV.`
    );
  };

  const handleExportExcel = () => {
    const { filename, sheet, headers, rows } = buildEmployeeExportData(
      activeTab,
      filteredShifts,
      filteredEmployees,
      activeOutlet?.name || "Singaraja"
    );
    downloadExcel(`${filename}_${Date.now()}`, sheet, headers, rows);
    notify.success(
      `Data ${activeTab === "SHIFTS" ? "Shift Kasir" : "Karyawan"} berhasil diekspor ke Excel (.xls).`
    );
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
    notify.success(`Karyawan baru "${params.name}" berhasil didaftarkan.`);
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
    notify.success(`Data karyawan "${params.name}" berhasil diperbarui.`);
  };

  const handleToggleStatus = (empId: string) => {
    toggleEmployeeStatus(empId);
    notify.success("Status kepegawaian berhasil diubah.");
  };

  const handleDeleteEmployeeConfirm = () => {
    if (!deletingEmp) return;
    deleteEmployee(deletingEmp.id);
    notify.success(`Data karyawan "${deletingEmp.name}" berhasil dihapus.`);
    setIsDeleteModalOpen(false);
    setDeletingEmp(null);
  };

  const handleOpenShiftSubmit = (params: { shiftName: string; openingCash: number }) => {
    openShift(
      params.shiftName,
      params.openingCash,
      user?.name || "Kasir Utama"
    );
    notify.success(`Shift "${params.shiftName}" berhasil dibuka.`);
  };

  const handleCloseShiftSubmit = (params: { actualCash: number; closingNotes?: string }) => {
    if (!activeShift) return;
    closeShift(
      activeShift.id,
      params.actualCash,
      params.closingNotes
    );
    notify.success("Shift berhasil ditutup dan saldo kas direkonsiliasi.");
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total Karyawan"
          value={`${kpis.totalEmployeesCount}`}
          hint="Staf terdaftar"
        />
        <StatCard
          label="Staf Aktif"
          value={`${kpis.activeEmployeesCount}`}
          hint="Status bertugas"
        />
        <StatCard
          label="Shift Berjalan"
          value={`${kpis.activeShiftsCount}`}
          hint={activeShift ? activeShift.shiftName : "Tidak ada shift"}
        />
        <StatCard
          label="Total Riwayat Shift"
          value={`${kpis.totalShiftsCount}`}
          hint="Shift terekam"
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
        <TabsList className="grid grid-cols-2 w-full sm:w-auto h-auto p-1 gap-1">
          <TabsTrigger value="SHIFTS" className="text-xs gap-1.5 py-1.5">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span>Rekonsiliasi Shift ({filteredShifts.length})</span>
          </TabsTrigger>
          <TabsTrigger value="EMPLOYEES" className="text-xs gap-1.5 py-1.5">
            <Users className="w-3.5 h-3.5 text-primary" />
            <span>Direktori Karyawan ({filteredEmployees.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="SHIFTS">
          <EmployeesShiftsTab
            shifts={filteredShifts}
            activeShift={activeShift}
            onOpenCloseShiftModal={() => setIsCloseShiftModalOpen(true)}
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
        shift={activeShift}
        isOpen={isCloseShiftModalOpen}
        onClose={() => setIsCloseShiftModalOpen(false)}
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
