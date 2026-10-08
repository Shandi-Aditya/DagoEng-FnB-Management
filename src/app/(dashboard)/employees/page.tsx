"use client";

import React, { useState } from "react";
import { useOutlet } from "@/contexts/OutletContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployeeShift } from "@/contexts/EmployeeShiftContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  UserCheck,
  Plus,
  Search,
  Trash2,
  X,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  ArrowRight,
  Receipt,
  Users,
  Wallet,
  Download,
  FileSpreadsheet,
  FileText,
  Edit2,
  Lock,
  CheckSquare,
  Square,
} from "lucide-react";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";
import { DailyClosingPDFModal } from "@/features/pos/DailyClosingPDFModal";
import { EmployeesReportPDFModal } from "@/features/employees/EmployeesReportPDFModal";
import { EmployeeProfile } from "@/types/shift";

type EmployeeDepartment = "Management" | "Service" | "Kitchen" | "Barista" | "Cashier" | "Inventory";

const ALL_PERMISSIONS = [
  { id: "pos_access", label: "Operasional Kasir (POS)", desc: "Buka kasir, proses pesanan, input bayar, & cetak struk", category: "POS Kasir" },
  { id: "pos_discount", label: "Otoritas Diskon & Promo", desc: "Terapkan kode kupon atau diskon manual transaksi", category: "POS Kasir" },
  { id: "pos_void", label: "Otoritas Void & Batal Order", desc: "Batalkan pesanan / void bill yang sudah diproses", category: "POS Kasir" },
  { id: "pos_shift_close", label: "Buka & Tutup Shift (Rekonsiliasi Kas)", desc: "Input kas awal dan pencocokan uang fisik di laci kas", category: "Kas & Shift" },
  { id: "inventory_access", label: "Manajemen Stok & Bahan Baku", desc: "Mutasi stok, input barang masuk, & opname gudang", category: "Inventori" },
  { id: "menu_master_edit", label: "Manajemen Master Menu & Harga", desc: "Tambah/edit produk menu F&B, harga, dan HPP", category: "Master Data" },
  { id: "financial_reports", label: "Laporan Omzet & Finansial", desc: "Melihat laporan omzet harian, bagi hasil, & export", category: "Keuangan" },
  { id: "coworking_manage", label: "Manajemen Co-Working Space", desc: "Check-in tamu, booking ruangan & event space", category: "Co-Working" },
  { id: "staff_management", label: "Kelola Karyawan & Hak Akses", desc: "Tambah staf baru dan kelola hak izin staf lain", category: "SDM & Akses" },
];

const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  "Store Manager": ["pos_access", "pos_discount", "pos_void", "pos_shift_close", "inventory_access", "menu_master_edit", "financial_reports", "coworking_manage", "staff_management"],
  "Outlet Supervisor": ["pos_access", "pos_discount", "pos_void", "pos_shift_close", "inventory_access", "financial_reports", "coworking_manage"],
  "Head Cashier": ["pos_access", "pos_discount", "pos_shift_close"],
  "Cashier": ["pos_access", "pos_discount", "pos_shift_close"],
  "Head Chef": ["pos_access", "inventory_access"],
  "Kitchen": ["pos_access", "inventory_access"],
  "Barista": ["pos_access", "inventory_access"],
  "Inventory Specialist": ["inventory_access"],
  "Floor Waiter": ["pos_access"],
};

export default function EmployeesPage() {
  const { activeOutlet, activeOutletId } = useOutlet();
  const { user } = useAuth();
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
  const [isHRReportPDFOpen, setIsHRReportPDFOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const getShiftAndEmployeeExportData = () => {
    if (activeTab === "SHIFTS") {
      const headers = [
        "ID Shift",
        "Nama Shift",
        "Kasir Bertugas",
        "Waktu Buka",
        "Waktu Tutup",
        "Kas Awal (Rp)",
        "Penjualan Kas (Rp)",
        "Penjualan Non-Kas (Rp)",
        "Total Penjualan (Rp)",
        "Kas Fisik Aktual (Rp)",
        "Selisih Kas (Rp)",
        "Status",
      ];
      const rows = filteredShifts.map((s) => [
        s.id,
        s.shiftName,
        s.assignedCashierName,
        s.startTime,
        s.closedAt || s.endTime || "Sedang Berjalan",
        `Rp ${s.openingCash.toLocaleString("id-ID")}`,
        `Rp ${s.cashSales.toLocaleString("id-ID")}`,
        `Rp ${s.nonCashSales.toLocaleString("id-ID")}`,
        `Rp ${(s.cashSales + s.nonCashSales).toLocaleString("id-ID")}`,
        s.actualCash ? `Rp ${s.actualCash.toLocaleString("id-ID")}` : "-",
        s.cashVariance !== undefined ? `Rp ${s.cashVariance.toLocaleString("id-ID")}` : "-",
        s.status,
      ]);
      return { filename: `Rekonsiliasi_Shift_${activeOutlet?.name || "All"}`, sheet: "Shift Kasir", headers, rows };
    } else {
      const headers = [
        "NIK / No. Pegawai",
        "Nama Karyawan",
        "Jabatan / Role",
        "Departemen",
        "No. Kontak / WA",
        "Email",
        "Shift Ditugaskan",
        "Status Kepegawaian",
        "Jumlah Hak Akses",
        "Tanggal Bergabung",
      ];
      const rows = filteredEmployees.map((e) => [
        e.employeeNumber,
        e.name,
        e.role,
        e.department,
        e.contact,
        e.email,
        e.assignedShift,
        e.status,
        `${(e.permissions || ROLE_DEFAULT_PERMISSIONS[e.role] || ["pos_access"]).length} Izin`,
        e.joinedDate,
      ]);
      return { filename: `Daftar_Karyawan_${activeOutlet?.name || "All"}`, sheet: "Direktori Staf", headers, rows };
    }
  };

  const handleExportCSV = () => {
    const { filename, headers, rows } = getShiftAndEmployeeExportData();
    downloadCSV(`${filename}_${Date.now()}`, headers, rows);
    showToast(`Data ${activeTab === "SHIFTS" ? "Shift Kasir" : "Karyawan"} berhasil diexport ke CSV!`);
  };

  const handleExportExcel = () => {
    const { filename, sheet, headers, rows } = getShiftAndEmployeeExportData();
    downloadExcel(`${filename}_${Date.now()}`, sheet, headers, rows);
    showToast(`Data ${activeTab === "SHIFTS" ? "Shift Kasir" : "Karyawan"} berhasil diexport ke Excel (.xls)!`);
  };

  // Modal State: Create Employee
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("Floor Waiter");
  const [newDept, setNewDept] = useState<EmployeeDepartment>("Service");
  const [newContact, setNewContact] = useState("+62 812-");
  const [newEmail, setNewEmail] = useState("");
  const [newAssignedShift, setNewAssignedShift] = useState("Shift Pagi (08:00 - 16:00)");
  const [newPermissions, setNewPermissions] = useState<string[]>(ROLE_DEFAULT_PERMISSIONS["Floor Waiter"] || ["pos_access"]);

  // Modal State: Edit Employee & Hak Akses
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<EmployeeProfile | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editDept, setEditDept] = useState<EmployeeDepartment>("Service");
  const [editContact, setEditContact] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAssignedShift, setEditAssignedShift] = useState("");
  const [editStatus, setEditStatus] = useState<"AKTIF" | "CUTI" | "NON-AKTIF">("AKTIF");
  const [editPermissions, setEditPermissions] = useState<string[]>([]);

  // Modal State: Open Shift
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [openShiftName, setOpenShiftName] = useState("Shift Pagi (08:00 - 16:00)");
  const [openingCashInput, setOpeningCashInput] = useState<number>(500000);

  // Modal State: Close Shift
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [actualCashInput, setActualCashInput] = useState<number>(0);
  const [closingNotes, setClosingNotes] = useState("");

  // Modal State: PDF Closing Report
  const [isPDFOpen, setIsPDFOpen] = useState(false);

  const displayedEmployees = filteredEmployees.filter((e) => {
    const q = searchQuery.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      e.role.toLowerCase().includes(q) ||
      e.employeeNumber.toLowerCase().includes(q) ||
      e.department.toLowerCase().includes(q)
    );
  });

  const handleOpenAddModal = () => {
    setNewName("");
    setNewRole("Floor Waiter");
    setNewDept("Service");
    setNewContact("+62 812-");
    setNewEmail("");
    setNewAssignedShift("Shift Pagi (08:00 - 16:00)");
    setNewPermissions(ROLE_DEFAULT_PERMISSIONS["Floor Waiter"] || ["pos_access"]);
    setIsAddModalOpen(true);
  };

  const handleRoleChangeForNew = (role: string) => {
    setNewRole(role);
    if (ROLE_DEFAULT_PERMISSIONS[role]) {
      setNewPermissions(ROLE_DEFAULT_PERMISSIONS[role]);
    }
  };

  const toggleNewPermission = (permId: string) => {
    setNewPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const handleOpenEditModal = (emp: EmployeeProfile) => {
    setEditingEmp(emp);
    setEditName(emp.name);
    setEditRole(emp.role);
    setEditDept(emp.department);
    setEditContact(emp.contact);
    setEditEmail(emp.email);
    setEditAssignedShift(emp.assignedShift);
    setEditStatus(emp.status);
    setEditPermissions(emp.permissions || ROLE_DEFAULT_PERMISSIONS[emp.role] || ["pos_access"]);
    setIsEditModalOpen(true);
  };

  const toggleEditPermission = (permId: string) => {
    setEditPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    createEmployee({
      name: newName.trim(),
      role: newRole,
      department: newDept,
      outletId: activeOutletId,
      outletName: activeOutlet?.name || "Singaraja",
      contact: newContact,
      email: newEmail || `${newName.toLowerCase().replace(/\s+/g, ".")}@dagoeng.com`,
      status: "AKTIF",
      assignedShift: newAssignedShift,
      joinedDate: new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
      permissions: newPermissions,
    });

    setIsAddModalOpen(false);
    showToast(`Karyawan ${newName.trim()} berhasil ditambahkan dengan ${newPermissions.length} hak akses!`);
  };

  const handleSaveEditEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp) return;

    updateEmployee(editingEmp.id, {
      name: editName.trim(),
      role: editRole.trim(),
      department: editDept,
      contact: editContact.trim(),
      email: editEmail.trim(),
      assignedShift: editAssignedShift,
      status: editStatus,
      permissions: editPermissions,
    });

    setIsEditModalOpen(false);
    showToast(`Profil & Hak Akses ${editName.trim()} berhasil diperbarui!`);
  };

  const handleOpenShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    openShift(openShiftName, Number(openingCashInput), user?.name || "Kasir Utama");
    setIsOpenShiftModalOpen(false);
  };

  const handleOpenCloseModal = () => {
    if (!activeShift) return;
    const expected = activeShift.openingCash + activeShift.cashSales - activeShift.refundAmount;
    setActualCashInput(expected);
    setClosingNotes("");
    setIsCloseShiftModalOpen(true);
  };

  const handleCloseShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;
    closeShift(activeShift.id, Number(actualCashInput), closingNotes);
    setIsCloseShiftModalOpen(false);
  };

  const calculateVariance = () => {
    if (!activeShift) return 0;
    const expected = activeShift.openingCash + activeShift.cashSales - activeShift.refundAmount;
    return Number(actualCashInput) - expected;
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-bold flex items-center space-x-2 animate-in fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <UserCheck className="w-6 h-6 text-brand-green" />
            <span>Karyawan, Shift & Rekonsiliasi Kas</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manajemen shift operasional, pencocokan fisik kas drawer, dan roster staf di <span className="font-semibold text-slate-800">{activeOutlet?.name}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportExcel}
            className="text-xs space-x-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-bold shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Excel</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCSV}
            className="text-xs space-x-1.5 border-slate-300 text-slate-700 font-bold hover:bg-slate-50 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export CSV</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsHRReportPDFOpen(true)}
            className="text-xs space-x-1.5 bg-brand-orange hover:bg-orange-600 text-white font-bold shadow-sm"
          >
            <FileText className="w-3.5 h-3.5 text-white" />
            <span>Cetak PDF Laporan</span>
          </Button>

          {activeShift ? (
            <Button
              size="sm"
              onClick={handleOpenCloseModal}
              className="text-xs bg-red-600 hover:bg-red-700 text-white shadow-xs font-semibold"
            >
              <Clock className="w-3.5 h-3.5 mr-1" />
              <span>Tutup & Rekonsiliasi Shift</span>
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setIsOpenShiftModalOpen(true)}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-semibold"
            >
              <Clock className="w-3.5 h-3.5 mr-1" />
              <span>Buka Shift Baru</span>
            </Button>
          )}

          <Button
            size="sm"
            onClick={handleOpenAddModal}
            className="text-xs font-bold space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Karyawan</span>
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab("SHIFTS")}
          className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center space-x-1.5 whitespace-nowrap ${
            activeTab === "SHIFTS"
              ? "border-brand-orange text-brand-orange"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Shift Operasional & Kas Drawer</span>
        </button>
        <button
          onClick={() => setActiveTab("EMPLOYEES")}
          className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center space-x-1.5 whitespace-nowrap ${
            activeTab === "EMPLOYEES"
              ? "border-brand-orange text-brand-orange"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Direktori Staf & Hak Akses ({filteredEmployees.length})</span>
        </button>
      </div>

      {activeTab === "SHIFTS" && (
        <div className="space-y-6">
          {/* Active Shift Card */}
          {activeShift ? (
            <Card className="border-2 border-emerald-500/40 bg-linear-to-r from-emerald-50/60 to-white shadow-xs">
              <CardContent className="p-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 animate-pulse">
                        ● SHIFT AKTIF
                      </span>
                      <span className="text-xs text-slate-500 font-mono">{activeShift.startTime}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">{activeShift.shiftName}</h3>
                    <p className="text-xs text-slate-600">
                      Kasir Bertugas: <strong className="text-slate-800">{activeShift.assignedCashierName}</strong> • Gerai: <strong>{activeShift.outletName}</strong>
                    </p>
                  </div>

                  {/* Cash Flow Summary Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Modal Awal Kas</p>
                      <p className="text-sm font-bold text-slate-800">Rp {activeShift.openingCash.toLocaleString("id-ID")}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Penjualan Tunai</p>
                      <p className="text-sm font-bold text-emerald-700">+ Rp {activeShift.cashSales.toLocaleString("id-ID")}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Non-Tunai (QR/Card)</p>
                      <p className="text-sm font-bold text-blue-700">Rp {activeShift.nonCashSales.toLocaleString("id-ID")}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Target Kas Fisik</p>
                      <p className="text-sm font-bold text-purple-700">
                        Rp {(activeShift.openingCash + activeShift.cashSales - activeShift.refundAmount).toLocaleString("id-ID")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      onClick={() => setIsPDFOpen(true)}
                      variant="outline"
                      className="text-xs border-slate-300 hover:bg-slate-50 space-x-1"
                    >
                      <Receipt className="w-3.5 h-3.5 text-slate-600" />
                      <span>Cetak Closing PDF</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleOpenCloseModal}
                      className="text-xs bg-red-600 hover:bg-red-700 text-white font-bold"
                    >
                      Tutup Shift
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center">
              <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-700">Tidak Ada Shift Aktif Saat Ini</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Silakan buka shift kasir baru untuk memulai pencatatan transaksi POS dan cash drawer di outlet {activeOutlet?.name}.
              </p>
              <Button
                size="sm"
                onClick={() => setIsOpenShiftModalOpen(true)}
                className="mt-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                + Buka Shift Kasir Sekarang
              </Button>
            </Card>
          )}

          {/* Shift History Table */}
          <Card className="shadow-xs border border-slate-200">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center justify-between">
                <span>Riwayat Shift & Rekonsiliasi Kas ({filteredShifts.length})</span>
                <span className="text-xs font-normal text-slate-500">Scope: {activeOutlet?.name}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 min-w-[720px]">
                  <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Nama Shift</th>
                      <th className="px-4 py-3">Kasir</th>
                      <th className="px-4 py-3">Waktu Buka / Tutup</th>
                      <th className="px-4 py-3">Modal Awal</th>
                      <th className="px-4 py-3">Target Kas</th>
                      <th className="px-4 py-3">Kas Fisik</th>
                      <th className="px-4 py-3">Selisih (Variance)</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredShifts.map((shift) => (
                      <tr key={shift.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900">{shift.shiftName}</td>
                        <td className="px-4 py-3">{shift.assignedCashierName}</td>
                        <td className="px-4 py-3">
                          <div className="text-slate-800">{shift.startTime}</div>
                          {shift.endTime && <div className="text-[10px] text-slate-400">s/d {shift.endTime}</div>}
                        </td>
                        <td className="px-4 py-3 font-mono">Rp {shift.openingCash.toLocaleString("id-ID")}</td>
                        <td className="px-4 py-3 font-mono">Rp {shift.expectedCash.toLocaleString("id-ID")}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                          {shift.actualCash !== undefined ? `Rp ${shift.actualCash.toLocaleString("id-ID")}` : "-"}
                        </td>
                        <td className="px-4 py-3">
                          {shift.status === "CLOSED" ? (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded font-mono text-[11px] font-bold ${
                                shift.cashVariance === 0
                                  ? "bg-emerald-100 text-emerald-800"
                                  : shift.cashVariance > 0
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {shift.cashVariance > 0 ? "+" : ""}
                              Rp {shift.cashVariance.toLocaleString("id-ID")}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Sedang Berjalan</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              shift.status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {shift.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "EMPLOYEES" && (
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari staf, role, nomor ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-orange"
              />
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Menampilkan {displayedEmployees.length} dari {filteredEmployees.length} staf di {activeOutlet?.name}
            </p>
          </div>

          {/* Employee Directory Table */}
          <Card className="shadow-xs border border-slate-200 overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 min-w-[760px]">
                  <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Nama & No Pegawai</th>
                      <th className="px-4 py-3">Departemen & Role</th>
                      <th className="px-4 py-3">Jadwal Shift Roster</th>
                      <th className="px-4 py-3">Hak Akses & Izin</th>
                      <th className="px-4 py-3">Kontrak & Kontak</th>
                      <th className="px-4 py-3 text-center">Status Kerja</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedEmployees.map((emp) => {
                      const userPerms = emp.permissions || ROLE_DEFAULT_PERMISSIONS[emp.role] || ["pos_access"];
                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900">{emp.name}</div>
                            <div className="text-[11px] font-mono text-brand-orange">{emp.employeeNumber}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-800">{emp.role}</div>
                            <div className="text-[10px] text-slate-500 uppercase">{emp.department}</div>
                          </td>
                          <td className="px-4 py-3">{emp.assignedShift}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleOpenEditModal(emp)}
                              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-orange-50 hover:border-brand-orange/40 hover:text-brand-orange transition-all text-[11px] font-bold text-slate-700 cursor-pointer"
                              title="Klik untuk lihat & atur hak akses"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{userPerms.length} Izin Aktif</span>
                              <Edit2 className="w-3 h-3 text-slate-400" />
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-slate-800">{emp.contact}</div>
                            <div className="text-[10px] text-slate-400">{emp.email}</div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => toggleEmployeeStatus(emp.id)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                                emp.status === "AKTIF"
                                  ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                  : emp.status === "CUTI"
                                  ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                                  : "bg-red-100 text-red-800 hover:bg-red-200"
                              }`}
                              title="Klik untuk ubah status"
                            >
                              {emp.status}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenEditModal(emp)}
                              className="h-7 w-7 p-0 text-slate-600 hover:text-brand-orange hover:bg-orange-50"
                              title="Edit Profil & Hak Akses"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteEmployee(emp.id)}
                              className="h-7 w-7 p-0 text-red-500 hover:bg-red-50"
                              title="Hapus Staf"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Add Employee */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white shrink-0">
              <div className="flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-brand-orange" />
                <h3 className="text-sm font-bold">Tambah Karyawan & Konfigurasi Hak Akses</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {/* Basic Info */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1">
                  1. Informasi Profil Staf
                </h4>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Nama Lengkap Karyawan *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Wayan Suastika"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-orange/20 font-semibold text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Departemen</label>
                    <select
                      value={newDept}
                      onChange={(e) => setNewDept(e.target.value as EmployeeDepartment)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-medium"
                    >
                      <option value="Service">Service / Floor Waiter</option>
                      <option value="Cashier">Cashier</option>
                      <option value="Kitchen">Kitchen</option>
                      <option value="Barista">Barista</option>
                      <option value="Inventory">Inventory</option>
                      <option value="Management">Management</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Role Jabatan</label>
                    <select
                      value={newRole}
                      onChange={(e) => handleRoleChangeForNew(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold text-slate-800"
                    >
                      <option value="Floor Waiter">Floor Waiter</option>
                      <option value="Head Cashier">Head Cashier</option>
                      <option value="Cashier">Cashier</option>
                      <option value="Head Chef">Head Chef</option>
                      <option value="Barista">Barista</option>
                      <option value="Inventory Specialist">Inventory Specialist</option>
                      <option value="Outlet Supervisor">Outlet Supervisor</option>
                      <option value="Store Manager">Store Manager</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Nomor WhatsApp *</label>
                    <input
                      type="text"
                      required
                      placeholder="+62 812-xxxx-xxxx"
                      value={newContact}
                      onChange={(e) => setNewContact(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Email Karyawan</label>
                    <input
                      type="email"
                      placeholder="nama@dagoeng.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Jadwal Shift Roster</label>
                  <select
                    value={newAssignedShift}
                    onChange={(e) => setNewAssignedShift(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="Shift Pagi (08:00 - 16:00)">Shift Pagi (08:00 - 16:00)</option>
                    <option value="Shift Sore (14:00 - 22:00)">Shift Sore (14:00 - 22:00)</option>
                    <option value="Shift Malam (16:00 - 23:00)">Shift Malam (16:00 - 23:00)</option>
                    <option value="Reguler (09:00 - 17:00)">Reguler (09:00 - 17:00)</option>
                  </select>
                </div>
              </div>

              {/* Permissions Checklist Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>2. Hak Akses & Kemampuan Sistem ({newPermissions.length} Izin Dipilih)</span>
                    </h4>
                    <p className="text-[10px] text-slate-500">Centang fitur yang diizinkan untuk staf ini.</p>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => setNewPermissions(ALL_PERMISSIONS.map((p) => p.id))}
                      className="text-[10px] text-brand-orange hover:underline font-bold"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setNewPermissions([])}
                      className="text-[10px] text-slate-500 hover:underline"
                    >
                      Hapus Semua
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {ALL_PERMISSIONS.map((perm) => {
                    const isChecked = newPermissions.includes(perm.id);
                    return (
                      <label
                        key={perm.id}
                        className={`flex items-start space-x-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                          isChecked
                            ? "bg-orange-50/50 border-brand-orange/40 text-slate-900"
                            : "bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleNewPermission(perm.id)}
                          className="mt-0.5 rounded text-brand-orange focus:ring-brand-orange"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs">{perm.label}</span>
                            <span className="text-[9px] font-mono px-1.5 py-0.2 bg-white border border-slate-200 rounded text-slate-500">
                              {perm.category}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">{perm.desc}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-brand-orange hover:bg-orange-600 text-white font-bold rounded-xl shadow-xs"
                >
                  Simpan & Daftarkan Karyawan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Employee & Hak Akses */}
      {isEditModalOpen && editingEmp && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white shrink-0">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold">Edit Staf & Hak Akses: {editingEmp.name}</h3>
                  <p className="text-[10px] text-slate-400 font-mono">{editingEmp.employeeNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditEmployee} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {/* Basic Info */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1">
                  1. Informasi Profil Staf
                </h4>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Nama Lengkap Karyawan *</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Departemen</label>
                    <select
                      value={editDept}
                      onChange={(e) => setEditDept(e.target.value as EmployeeDepartment)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-medium"
                    >
                      <option value="Service">Service / Floor Waiter</option>
                      <option value="Cashier">Cashier</option>
                      <option value="Kitchen">Kitchen</option>
                      <option value="Barista">Barista</option>
                      <option value="Inventory">Inventory</option>
                      <option value="Management">Management</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Role Jabatan</label>
                    <input
                      type="text"
                      required
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Nomor WhatsApp *</label>
                    <input
                      type="text"
                      required
                      value={editContact}
                      onChange={(e) => setEditContact(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Email</label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Status Kerja</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold"
                    >
                      <option value="AKTIF">AKTIF</option>
                      <option value="CUTI">CUTI</option>
                      <option value="NON-AKTIF">NON-AKTIF</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Jadwal Shift Roster</label>
                  <select
                    value={editAssignedShift}
                    onChange={(e) => setEditAssignedShift(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="Shift Pagi (08:00 - 16:00)">Shift Pagi (08:00 - 16:00)</option>
                    <option value="Shift Sore (14:00 - 22:00)">Shift Sore (14:00 - 22:00)</option>
                    <option value="Shift Malam (16:00 - 23:00)">Shift Malam (16:00 - 23:00)</option>
                    <option value="Reguler (09:00 - 17:00)">Reguler (09:00 - 17:00)</option>
                  </select>
                </div>
              </div>

              {/* Permissions Checklist Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>2. Hak Akses & Kemampuan Sistem ({editPermissions.length} Izin Aktif)</span>
                    </h4>
                    <p className="text-[10px] text-slate-500">Sesuaikan kemampuan spesifik staf di sistem.</p>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => setEditPermissions(ALL_PERMISSIONS.map((p) => p.id))}
                      className="text-[10px] text-brand-orange hover:underline font-bold"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (ROLE_DEFAULT_PERMISSIONS[editRole]) {
                          setEditPermissions(ROLE_DEFAULT_PERMISSIONS[editRole]);
                        }
                      }}
                      className="text-[10px] text-slate-500 hover:underline"
                    >
                      Reset Role
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {ALL_PERMISSIONS.map((perm) => {
                    const isChecked = editPermissions.includes(perm.id);
                    return (
                      <label
                        key={perm.id}
                        className={`flex items-start space-x-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                          isChecked
                            ? "bg-emerald-50/50 border-emerald-500/40 text-slate-900"
                            : "bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleEditPermission(perm.id)}
                          className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs">{perm.label}</span>
                            <span className="text-[9px] font-mono px-1.5 py-0.2 bg-white border border-slate-200 rounded text-slate-500">
                              {perm.category}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">{perm.desc}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-xl"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-brand-orange hover:bg-orange-600 text-white font-bold rounded-xl shadow-xs"
                >
                  Simpan Perubahan Staf
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Open Shift */}
      {isOpenShiftModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Buka Shift Kasir Baru</h3>
              <button
                onClick={() => setIsOpenShiftModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Membuka kas drawer baru untuk outlet <strong>{activeOutlet?.name}</strong>. Pastikan modal awal telah dihitung fisik.
            </p>

            <form onSubmit={handleOpenShiftSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Pilih Shift</label>
                <select
                  value={openShiftName}
                  onChange={(e) => setOpenShiftName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Shift Pagi (08:00 - 16:00)">Shift Pagi (08:00 - 16:00)</option>
                  <option value="Shift Sore (14:00 - 22:00)">Shift Sore (14:00 - 22:00)</option>
                  <option value="Shift Malam (16:00 - 23:00)">Shift Malam (16:00 - 23:00)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Modal Awal Kas Drawer (Rp) *</label>
                <input
                  type="number"
                  required
                  value={openingCashInput}
                  onChange={(e) => setOpeningCashInput(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900"
                />
                <p className="text-[10px] text-slate-400 mt-1">Uang pecahan kecil untuk kembalian pelanggan.</p>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsOpenShiftModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  Buka Kasir Sekarang
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Close Shift & Reconcile */}
      {isCloseShiftModalOpen && activeShift && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Wallet className="w-5 h-5 text-red-600" />
                <span>Tutup & Rekonsiliasi Kas Shift</span>
              </h3>
              <button
                onClick={() => setIsCloseShiftModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Modal Awal:</span>
                <span className="font-semibold text-slate-800">Rp {activeShift.openingCash.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Penjualan Tunai:</span>
                <span className="font-semibold text-emerald-700">+ Rp {activeShift.cashSales.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1 font-bold">
                <span className="text-slate-800">Target Kas Fisik Drawer:</span>
                <span className="text-purple-700">
                  Rp {(activeShift.openingCash + activeShift.cashSales - activeShift.refundAmount).toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            <form onSubmit={handleCloseShiftSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Hitungan Fisik Uang Kas Nyata (Rp) *
                </label>
                <input
                  type="number"
                  required
                  value={actualCashInput}
                  onChange={(e) => setActualCashInput(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-base text-slate-900"
                />
              </div>

              {/* Variance Alert */}
              <div
                className={`p-3 rounded-xl border text-xs flex items-start space-x-2 ${
                  calculateVariance() === 0
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : calculateVariance() > 0
                    ? "bg-blue-50 border-blue-200 text-blue-800"
                    : "bg-red-50 border-red-200 text-red-800"
                }`}
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    Selisih Kas: {calculateVariance() > 0 ? "+" : ""}Rp {calculateVariance().toLocaleString("id-ID")}
                  </p>
                  <p className="text-[11px] mt-0.5">
                    {calculateVariance() === 0
                      ? "Kas fisik cocok sempurna dengan kalkulasi sistem POS."
                      : calculateVariance() > 0
                      ? "Terdapat kelebihan kas fisik di laci kasir."
                      : "Terdapat kekurangan kas fisik di laci kasir (shortage)."}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Catatan Closing Kasir</label>
                <textarea
                  rows={2}
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="Catatan kendala atau rincian selisih jika ada..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCloseShiftModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  Tutup Shift & Simpan Rekonsiliasi
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Closing Modal */}
      {isPDFOpen && (
        <DailyClosingPDFModal
          isOpen={isPDFOpen}
          onClose={() => setIsPDFOpen(false)}
          managerPhone="+62 812-3456-7890"
          reportData={{
            reportNumber: `RPT-CLS-${Date.now().toString().slice(-6)}`,
            outletName: activeOutlet?.name || "Singaraja",
            outletAddress: "Jl. Ngurah Rai No. 45, Singaraja, Bali",
            outletPhone: "+62 812-3344-5566",
            cashierName: activeShift?.assignedCashierName || user?.name || "Kasir",
            closingDateTime: new Date().toLocaleString("id-ID"),
            shiftName: activeShift?.shiftName || "Shift Pagi",
            initialCash: activeShift?.openingCash || 500000,
            totalCashSales: activeShift?.cashSales || 0,
            qrisSales: activeShift?.nonCashSales || 0,
            edcSales: 0,
            totalTransactionsCount: 14,
            totalGrossSales: (activeShift?.cashSales || 0) + (activeShift?.nonCashSales || 0),
            totalDiscounts: 0,
            isTaxEnabled: true,
            taxRatePercent: 10,
            totalTax: Math.round(((activeShift?.cashSales || 0) + (activeShift?.nonCashSales || 0)) * 0.1),
            totalNetSales: Math.round(((activeShift?.cashSales || 0) + (activeShift?.nonCashSales || 0)) * 1.1),
            tenantSharePercent: 80,
            dagoSharePercent: 20,
            tenantTotalShare: Math.round(((activeShift?.cashSales || 0) + (activeShift?.nonCashSales || 0)) * 0.8),
            dagoTotalShare: Math.round(((activeShift?.cashSales || 0) + (activeShift?.nonCashSales || 0)) * 0.2),
            tenantQrisShare: Math.round((activeShift?.nonCashSales || 0) * 0.8),
            dagoQrisShare: Math.round((activeShift?.nonCashSales || 0) * 0.2),
            tenantCashShare: Math.round((activeShift?.cashSales || 0) * 0.8),
            dagoCashShare: Math.round((activeShift?.cashSales || 0) * 0.2),
            actualCashEnding: activeShift?.actualCash || (activeShift?.openingCash || 500000) + (activeShift?.cashSales || 0),
            cashDifference: activeShift?.cashVariance || 0,
            shiftNotes: activeShift?.closingNotes || "Kas fisik cocok sempurna dengan sistem POS.",
            verificationHash: "SHA256-DAGO-VERIFIED-CLOSING-OK",
          }}
        />
      )}

      {/* PDF Official HR & Shift Report Modal */}
      <EmployeesReportPDFModal
        isOpen={isHRReportPDFOpen}
        onClose={() => setIsHRReportPDFOpen(false)}
        employees={filteredEmployees}
        shifts={filteredShifts}
        outletName={activeOutlet?.name || "Semua Outlet"}
      />
    </div>
  );
}
