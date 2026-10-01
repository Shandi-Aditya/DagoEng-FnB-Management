"use client";

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOutlet } from "@/contexts/OutletContext";
import { useCommercial } from "@/contexts/CommercialContext";
import { CommercialLease, LeaseStatus } from "@/types/commercial";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2,
  FileText,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  X,
  CreditCard,
  DollarSign,
  User,
  Calendar,
  Layers,
  MapPin,
  FileCheck,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";
import { CommercialReportPDFModal } from "@/features/commercial/CommercialReportPDFModal";

export default function CommercialPage() {
  const { activeOrgModules, toggleOrgModule } = useAuth();
  const { activeOutlet, activeOutletId } = useOutlet();
  const { filteredLeases, createLease, updateLeaseStatus, recordPayment } = useCommercial();

  const isModuleActive = activeOrgModules.includes("COMMERCIAL");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedLease, setSelectedLease] = useState<CommercialLease | null>(null);
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const getCommercialExportData = () => {
    const headers = [
      "No. Kontrak",
      "Tenant / Brand",
      "Kontak Tenant",
      "Email Tenant",
      "Unit Lot",
      "Luas (m²)",
      "Biaya Sewa Bulanan (Rp)",
      "Nilai Kontrak Tahunan (Rp)",
      "Deposit Jaminan (Rp)",
      "Jadwal Pembayaran",
      "Periode Mulai",
      "Periode Berakhir",
      "Status",
    ];
    const rows = filteredLeases.map((l) => [
      l.leaseNumber,
      l.tenantName,
      l.tenantContact,
      l.tenantEmail || "-",
      l.unitCode,
      l.areaSquareMeters || 0,
      `Rp ${l.monthlyRent.toLocaleString("id-ID")}`,
      `Rp ${(l.monthlyRent * 12).toLocaleString("id-ID")}`,
      `Rp ${(l.depositAmount || 0).toLocaleString("id-ID")}`,
      l.paymentSchedule,
      l.startDate,
      l.endDate,
      l.status,
    ]);
    return { headers, rows };
  };

  const handleExportCSV = () => {
    const { headers, rows } = getCommercialExportData();
    downloadCSV(`Kontrak_Tenant_Commercial_${activeOutlet?.name || "All"}_${Date.now()}`, headers, rows);
    showToast("Data kontrak tenant komersial berhasil diexport ke CSV!");
  };

  const handleExportExcel = () => {
    const { headers, rows } = getCommercialExportData();
    downloadExcel(
      `Kontrak_Tenant_Commercial_${activeOutlet?.name || "All"}_${Date.now()}`,
      "Kontrak Tenant Commercial",
      headers,
      rows
    );
    showToast("Data kontrak tenant komersial berhasil diexport ke Excel (.xls)!");
  };

  // Modal Create Lease
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantContact, setNewTenantContact] = useState("");
  const [newTenantEmail, setNewTenantEmail] = useState("");
  const [newUnitCode, setNewUnitCode] = useState("Lot A-04 (Ground Floor)");
  const [newAreaM2, setNewAreaM2] = useState<number>(30);
  const [newMonthlyRent, setNewMonthlyRent] = useState<number>(5000000);
  const [newDeposit, setNewDeposit] = useState<number>(10000000);
  const [newStartDate, setNewStartDate] = useState("01 Okt 2026");
  const [newEndDate, setNewEndDate] = useState("30 Sep 2027");
  const [newSchedule, setNewSchedule] = useState<"MONTHLY" | "QUARTERLY" | "ANNUALLY">("MONTHLY");
  const [newNotes, setNewNotes] = useState("");

  // Modal Record Payment
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentPeriod, setPaymentPeriod] = useState("Oktober 2026");
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer BCA");
  const [paymentRef, setPaymentRef] = useState("");

  // Modal Change Status
  const [isChangeStatusOpen, setIsChangeStatusOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<LeaseStatus>("ACTIVE");
  const [statusReason, setStatusReason] = useState("");

  if (!isModuleActive) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm max-w-lg mx-auto mt-10 space-y-4">
        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto">
          <Building2 className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-800">Modul Commercial Dinonaktifkan</h3>
          <p className="text-xs text-slate-500 mt-1">
            Modul Commercial (Retail Leases & Tenant Contracts) saat ini berstatus <strong>INACTIVE</strong> pada organisasi Dago Creative Hub.
          </p>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 text-left">
          <p className="font-semibold text-slate-800">Keamanan Server-Side:</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Saat modul non-aktif, seluruh rute, widget, dan transaksi komersial otomatis ditolak.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => toggleOrgModule("COMMERCIAL")}
          className="text-xs bg-purple-600 hover:bg-purple-700 space-x-1"
        >
          <span>Aktifkan Modul Commercial (Demo Mode)</span>
        </Button>
      </div>
    );
  }

  const displayedLeases = filteredLeases.filter((l) => {
    const matchSearch =
      l.tenantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.unitCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.leaseNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === "ALL" || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalMonthlyBilling = filteredLeases
    .filter((l) => l.status === "ACTIVE")
    .reduce((sum, l) => sum + l.monthlyRent, 0);

  const totalDeposits = filteredLeases
    .filter((l) => l.status === "ACTIVE")
    .reduce((sum, l) => sum + l.depositAmount, 0);

  const handleCreateLease = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantName || !newUnitCode) return;

    createLease({
      outletId: activeOutletId,
      outletName: activeOutlet?.name || "Outlet Terpilih",
      tenantName: newTenantName,
      tenantContact: newTenantContact,
      tenantEmail: newTenantEmail,
      unitCode: newUnitCode,
      areaSquareMeters: Number(newAreaM2),
      monthlyRent: Number(newMonthlyRent),
      totalContractValue: Number(newMonthlyRent) * 12,
      depositAmount: Number(newDeposit),
      startDate: newStartDate,
      endDate: newEndDate,
      paymentSchedule: newSchedule,
      status: "ACTIVE",
      notes: newNotes,
    });

    setIsCreateOpen(false);
    setNewTenantName("");
    setNewTenantContact("");
    setNewTenantEmail("");
    setNewNotes("");
  };

  const handleOpenPaymentModal = (lease: CommercialLease) => {
    setSelectedLease(lease);
    setPaymentAmount(lease.monthlyRent);
    setPaymentRef(`TRF-${Date.now().toString().slice(-5)}`);
    setIsPaymentOpen(true);
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLease || paymentAmount <= 0) return;

    recordPayment(selectedLease.id, {
      periodLabel: paymentPeriod,
      amount: paymentAmount,
      dueDate: new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
      paidDate: new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
      paymentMethod,
      status: "PAID",
      referenceNo: paymentRef,
    });

    setIsPaymentOpen(false);
    // Refresh selected lease reference from updated state
    const updated = filteredLeases.find((l) => l.id === selectedLease.id);
    if (updated) setSelectedLease(updated);
  };

  const handleStatusChangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLease) return;

    updateLeaseStatus(selectedLease.id, newStatus, statusReason);
    setIsChangeStatusOpen(false);
    setStatusReason("");
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Building2 className="w-6 h-6 text-purple-600" />
            <span>Commercial Retail Leases & Tenant Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manajemen kontrak tenant retail, unit lot komersial, dan penagihan berkala di <span className="font-semibold text-slate-700">{activeOutlet?.name}</span>
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
            onClick={() => setIsPDFModalOpen(true)}
            className="text-xs space-x-1.5 bg-brand-orange hover:bg-orange-600 text-white font-bold shadow-sm"
          >
            <FileText className="w-3.5 h-3.5 text-white" />
            <span>Cetak PDF Resmi</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => toggleOrgModule("COMMERCIAL")}
            className="text-xs text-red-600 hover:bg-red-50"
          >
            Nonaktifkan
          </Button>
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="text-xs bg-purple-600 hover:bg-purple-700 text-white space-x-1 shadow-sm font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Kontrak</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500">Total Unit Tersewa</p>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {filteredLeases.filter((l) => l.status === "ACTIVE").length} <span className="text-xs font-normal text-slate-500">Tenant Aktif</span>
          </p>
        </Card>

        <Card className="p-4 bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500">Monthly Billing Run-Rate</p>
            <DollarSign className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-purple-700 mt-2">
            Rp {totalMonthlyBilling.toLocaleString("id-ID")}
          </p>
        </Card>

        <Card className="p-4 bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500">Total Security Deposit</p>
            <CreditCard className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">
            Rp {totalDeposits.toLocaleString("id-ID")}
          </p>
        </Card>

        <Card className="p-4 bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500">Scope Outlet Aktif</p>
            <MapPin className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-lg font-bold text-slate-800 mt-2 truncate">
            {activeOutlet?.name || "Semua Outlet"}
          </p>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari tenant, no kontrak, lot..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 font-medium">Filter Status:</span>
          {(["ALL", "ACTIVE", "EXPIRING_SOON", "EXPIRED", "TERMINATED"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                statusFilter === st
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {st === "ALL" ? "Semua" : st}
            </button>
          ))}
        </div>
      </div>

      {/* Leases Table */}
      <Card className="shadow-xs border border-slate-200 overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="text-sm font-bold text-slate-800 flex items-center justify-between">
            <span>Daftar Kontrak Sewa Tenant ({displayedLeases.length})</span>
            <span className="text-xs font-normal text-slate-500">
              Server-side Scope: {activeOutlet?.name}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {displayedLeases.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold">Tidak ada kontrak tenant ditemukan</p>
              <p className="text-xs mt-1">Gunakan tombol 'Tambah Kontrak Tenant' untuk mendaftarkan tenant baru.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Tenant & Kontak</th>
                    <th className="px-4 py-3">Unit / Lot</th>
                    <th className="px-4 py-3">Luas</th>
                    <th className="px-4 py-3">Nilai Sewa</th>
                    <th className="px-4 py-3">Periode Kontrak</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedLeases.map((lease) => (
                    <tr key={lease.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{lease.tenantName}</div>
                        <div className="text-[11px] text-slate-500 flex items-center space-x-1.5 mt-0.5">
                          <span>{lease.tenantContact}</span>
                          <span>•</span>
                          <span className="text-purple-600 font-mono">{lease.leaseNumber}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{lease.unitCode}</td>
                      <td className="px-4 py-3">{lease.areaSquareMeters} m²</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">
                          Rp {lease.monthlyRent.toLocaleString("id-ID")}
                          <span className="text-[10px] font-normal text-slate-500">/bln</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Deposit: Rp {lease.depositAmount.toLocaleString("id-ID")}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-800">{lease.startDate} — {lease.endDate}</div>
                        <div className="text-[10px] text-slate-400">Jadwal: {lease.paymentSchedule}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            lease.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800"
                              : lease.status === "EXPIRING_SOON"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {lease.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedLease(lease)}
                          className="text-[11px] h-7 px-2.5 text-purple-700 hover:bg-purple-50"
                        >
                          Detail
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleOpenPaymentModal(lease)}
                          className="text-[11px] h-7 px-2.5 bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          Bayar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Detail Lease & Payment History */}
      {selectedLease && !isPaymentOpen && !isChangeStatusOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="text-[11px] font-mono text-purple-600 font-bold">{selectedLease.leaseNumber}</span>
                <h3 className="text-base font-bold text-slate-900">{selectedLease.tenantName}</h3>
              </div>
              <button
                onClick={() => setSelectedLease(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lease Overview Details */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl text-xs border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px]">Unit / Lot</span>
                <span className="font-semibold text-slate-800">{selectedLease.unitCode}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Luas Ruang</span>
                <span className="font-semibold text-slate-800">{selectedLease.areaSquareMeters} m²</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Sewa Bulanan</span>
                <span className="font-bold text-purple-700">Rp {selectedLease.monthlyRent.toLocaleString("id-ID")}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Deposit Jaminan</span>
                <span className="font-semibold text-slate-800">Rp {selectedLease.depositAmount.toLocaleString("id-ID")}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Masa Sewa</span>
                <span className="font-semibold text-slate-800">{selectedLease.startDate} - {selectedLease.endDate}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Status Kontrak</span>
                <span className="font-bold text-emerald-700">{selectedLease.status}</span>
              </div>
            </div>

            {/* Payment History Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <CreditCard className="w-4 h-4 text-purple-600" />
                  <span>Riwayat Pembayaran Sewa</span>
                </h4>
                <Button
                  size="sm"
                  onClick={() => handleOpenPaymentModal(selectedLease)}
                  className="text-xs h-6 px-2.5 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  + Catat Pembayaran
                </Button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                {selectedLease.paymentHistory.length === 0 ? (
                  <p className="p-4 text-center text-xs text-slate-400">Belum ada riwayat pembayaran tercatat.</p>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 text-[10px] uppercase font-semibold">
                      <tr>
                        <th className="p-2">Periode</th>
                        <th className="p-2">Nominal</th>
                        <th className="p-2">Tgl Bayar</th>
                        <th className="p-2">Metode / Ref</th>
                        <th className="p-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedLease.paymentHistory.map((pm) => (
                        <tr key={pm.id} className="hover:bg-slate-50">
                          <td className="p-2 font-medium text-slate-900">{pm.periodLabel}</td>
                          <td className="p-2 font-bold text-emerald-700">Rp {pm.amount.toLocaleString("id-ID")}</td>
                          <td className="p-2 text-slate-600">{pm.paidDate}</td>
                          <td className="p-2 text-slate-500 font-mono text-[10px]">{pm.paymentMethod} ({pm.referenceNo || "-"})</td>
                          <td className="p-2 text-right">
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                              {pm.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setNewStatus(selectedLease.status);
                  setIsChangeStatusOpen(true);
                }}
                className="text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
              >
                Ubah Status Kontrak
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedLease(null)}
                className="text-xs"
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Create Lease */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <FileCheck className="w-5 h-5 text-purple-600" />
                <span>Pendaftaran Kontrak Tenant Baru</span>
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLease} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nama Tenant / Brand *</label>
                <input
                  type="text"
                  required
                  placeholder="cth. Kopi Kenangan / Artisan Bakery"
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">No. Kontak WhatsApp *</label>
                  <input
                    type="text"
                    required
                    placeholder="+62 812..."
                    value={newTenantContact}
                    onChange={(e) => setNewTenantContact(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Email Tenant</label>
                  <input
                    type="email"
                    placeholder="tenant@brand.com"
                    value={newTenantEmail}
                    onChange={(e) => setNewTenantEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Kode Unit / Lot Retail *</label>
                  <input
                    type="text"
                    required
                    value={newUnitCode}
                    onChange={(e) => setNewUnitCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Luas Area (m²)</label>
                  <input
                    type="number"
                    value={newAreaM2}
                    onChange={(e) => setNewAreaM2(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Biaya Sewa / Bulan (Rp) *</label>
                  <input
                    type="number"
                    required
                    value={newMonthlyRent}
                    onChange={(e) => setNewMonthlyRent(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Security Deposit (Rp)</label>
                  <input
                    type="number"
                    value={newDeposit}
                    onChange={(e) => setNewDeposit(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tanggal Mulai</label>
                  <input
                    type="text"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tanggal Selesai</label>
                  <input
                    type="text"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Catatan Tambahan</label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Ketentuan khusus tenant..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Simpan Kontrak & Buat Log
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Record Payment */}
      {isPaymentOpen && selectedLease && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Catat Penerimaan Sewa</h3>
              <button
                onClick={() => setIsPaymentOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Mencatat pembayaran untuk tenant <strong>{selectedLease.tenantName}</strong> ({selectedLease.unitCode}).
            </p>

            <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Periode Pembayaran *</label>
                <input
                  type="text"
                  required
                  value={paymentPeriod}
                  onChange={(e) => setPaymentPeriod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nominal Pembayaran (Rp) *</label>
                <input
                  type="number"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-purple-700"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Metode Pembayaran</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Bank Transfer BCA">Bank Transfer BCA</option>
                  <option value="Bank Transfer Mandiri">Bank Transfer Mandiri</option>
                  <option value="QRIS DagoPay">QRIS DagoPay</option>
                  <option value="Tunai / Cash">Tunai / Cash</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">No. Referensi / Bukti Transfer</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPaymentOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Konfirmasi Pembayaran
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Change Status */}
      {isChangeStatusOpen && selectedLease && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Ubah Status Kontrak</h3>
              <button
                onClick={() => setIsChangeStatusOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStatusChangeSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Pilih Status Baru *</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as LeaseStatus)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="ACTIVE">ACTIVE (Aktif)</option>
                  <option value="EXPIRING_SOON">EXPIRING_SOON (Segera Berakhir)</option>
                  <option value="EXPIRED">EXPIRED (Telah Berakhir)</option>
                  <option value="TERMINATED">TERMINATED (Dibatalkan)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Alasan Perubahan Status (Wajib Audit Log) *</label>
                <textarea
                  required
                  rows={3}
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="Contoh: Masa sewa 1 tahun berakhir per tanggal 30 Sep 2026..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsChangeStatusOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  Update Status
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Official Commercial Report Modal */}
      <CommercialReportPDFModal
        isOpen={isPDFModalOpen}
        onClose={() => setIsPDFModalOpen(false)}
        leases={filteredLeases}
        outletName={activeOutlet?.name || "Semua Outlet"}
      />
    </div>
  );
}
