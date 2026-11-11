"use client";

import { useState, useMemo } from "react";
import { Building2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOutlet } from "@/contexts/OutletContext";
import { useCommercial } from "@/contexts/CommercialContext";
import type { CommercialLease, LeaseStatus } from "@/types/commercial";
import { notify } from "@/components/app/notify";
import { StatCard } from "@/components/app/stat-card";
import { formatCurrencyIDR } from "@/lib/utils";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";

import {
  calculateCommercialKPIs,
  filterLeases,
  buildCommercialExportData,
  getLeaseStatusLabel,
} from "@/features/commercial/commercial-domain";
import { CommercialToolbar } from "@/features/commercial/CommercialToolbar";
import { CommercialTable } from "@/features/commercial/CommercialTable";
import { CommercialDetailModal } from "@/features/commercial/CommercialDetailModal";
import { CreateLeaseModal } from "@/features/commercial/CreateLeaseModal";
import { RecordPaymentModal } from "@/features/commercial/RecordPaymentModal";
import { ChangeLeaseStatusModal } from "@/features/commercial/ChangeLeaseStatusModal";
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
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isChangeStatusOpen, setIsChangeStatusOpen] = useState(false);

  const kpis = useMemo(() => calculateCommercialKPIs(filteredLeases), [filteredLeases]);

  const displayedLeases = useMemo(
    () => filterLeases(filteredLeases, statusFilter, searchTerm),
    [filteredLeases, statusFilter, searchTerm]
  );

  if (!isModuleActive) {
    return (
      <div className="p-8 text-center bg-card rounded-2xl border max-w-lg mx-auto mt-10 space-y-4">
        <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
          <Building2 className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-medium text-foreground">Modul Komersial Dinonaktifkan</h3>
          <p className="text-xs text-muted-foreground">
            Modul Commercial (Retail Leases & Tenant Contracts) saat ini berstatus non-aktif.
          </p>
        </div>
        <div className="p-3 bg-muted/40 rounded-xl border text-xs text-muted-foreground text-left space-y-1">
          <p className="font-medium text-foreground">Akses Dibatasi</p>
          <p className="text-[11px] leading-relaxed">
            Aktifkan modul kembali melalui menu Pengaturan Organisasi atau tombol kelola akses.
          </p>
        </div>
      </div>
    );
  }

  const handleExportCSV = () => {
    const { headers, rows } = buildCommercialExportData(filteredLeases);
    downloadCSV(
      `Kontrak_Tenant_Commercial_${activeOutlet?.name || "All"}_${Date.now()}`,
      headers,
      rows
    );
    notify.success("Kontrak diekspor ke CSV");
  };

  const handleExportExcel = () => {
    const { headers, rows } = buildCommercialExportData(filteredLeases);
    downloadExcel(
      `Kontrak_Tenant_Commercial_${activeOutlet?.name || "All"}_${Date.now()}`,
      "Kontrak Tenant Commercial",
      headers,
      rows
    );
    notify.success("Kontrak diekspor ke Excel");
  };

  const handleCreateLeaseSubmit = (params: {
    tenantName: string;
    tenantContact: string;
    tenantEmail: string;
    unitCode: string;
    areaSquareMeters: number;
    monthlyRent: number;
    depositAmount: number;
    startDate: string;
    endDate: string;
    paymentSchedule: "MONTHLY" | "QUARTERLY" | "ANNUALLY";
    notes?: string;
  }) => {
    createLease({
      outletId: activeOutletId,
      outletName: activeOutlet?.name || "Outlet Terpilih",
      tenantName: params.tenantName,
      tenantContact: params.tenantContact,
      tenantEmail: params.tenantEmail,
      unitCode: params.unitCode,
      areaSquareMeters: params.areaSquareMeters,
      monthlyRent: params.monthlyRent,
      totalContractValue: params.monthlyRent * 12,
      depositAmount: params.depositAmount,
      startDate: params.startDate,
      endDate: params.endDate,
      paymentSchedule: params.paymentSchedule,
      status: "ACTIVE",
      notes: params.notes,
    });
    notify.success(`Kontrak ${params.tenantName} ditambahkan`);
  };

  const handleRecordPaymentSubmit = (params: {
    leaseId: string;
    periodLabel: string;
    amount: number;
    paymentMethod: string;
    referenceNo?: string;
  }) => {
    recordPayment(params.leaseId, {
      periodLabel: params.periodLabel,
      amount: params.amount,
      dueDate: new Date().toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      paidDate: new Date().toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      paymentMethod: params.paymentMethod,
      status: "PAID",
      referenceNo: params.referenceNo,
    });

    notify.success("Pembayaran sewa dicatat", params.periodLabel);

    if (selectedLease && selectedLease.id === params.leaseId) {
      const updated = filteredLeases.find((l) => l.id === params.leaseId);
      if (updated) setSelectedLease(updated);
    }
  };

  const handleStatusChangeSubmit = (params: {
    leaseId: string;
    newStatus: LeaseStatus;
    reason: string;
  }) => {
    updateLeaseStatus(params.leaseId, params.newStatus, params.reason);
    notify.success(`Status kontrak: ${getLeaseStatusLabel(params.newStatus).toLowerCase()}`);

    if (selectedLease && selectedLease.id === params.leaseId) {
      const updated = filteredLeases.find((l) => l.id === params.leaseId);
      if (updated) setSelectedLease(updated);
    }
  };

  const handleOpenPayment = (lease: CommercialLease) => {
    setSelectedLease(lease);
    setIsPaymentOpen(true);
  };

  const handleOpenChangeStatus = (lease: CommercialLease) => {
    setSelectedLease(lease);
    setIsChangeStatusOpen(true);
  };

  return (
    <div className="space-y-6">
      <CommercialToolbar
        outletName={activeOutlet?.name || "Singaraja Hub"}
        onExportExcel={handleExportExcel}
        onExportCSV={handleExportCSV}
        onOpenPDF={() => setIsPDFModalOpen(true)}
        onToggleModule={() => {
          toggleOrgModule("COMMERCIAL");
          notify.info("Modul komersial dinonaktifkan");
        }}
        onOpenCreateModal={() => setIsCreateOpen(true)}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total Unit Tersewa"
          value={`${kpis.activeUnitsCount}`}
          hint="Tenant aktif"
        />
        <StatCard
          label="Monthly Billing Run-Rate"
          value={formatCurrencyIDR(kpis.totalMonthlyBilling)}
          hint="Estimasi pendapatan sewa / bln"
        />
        <StatCard
          label="Total Security Deposit"
          value={formatCurrencyIDR(kpis.totalSecurityDeposit)}
          hint="Deposit jaminan tersimpan"
        />
        <StatCard
          label="Scope Outlet Aktif"
          value={activeOutlet?.name || "Semua Outlet"}
          hint="Filter data saat ini"
        />
      </div>

      {/* Leases Table */}
      <CommercialTable
        leases={displayedLeases}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onSelectLease={setSelectedLease}
        onOpenPaymentModal={handleOpenPayment}
      />

      {/* Modals */}
      <CommercialDetailModal
        lease={selectedLease}
        onClose={() => setSelectedLease(null)}
        onOpenPaymentModal={handleOpenPayment}
        onOpenChangeStatusModal={handleOpenChangeStatus}
      />

      <CreateLeaseModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateLeaseSubmit}
      />

      <RecordPaymentModal
        lease={selectedLease}
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        onSubmit={handleRecordPaymentSubmit}
      />

      <ChangeLeaseStatusModal
        lease={selectedLease}
        isOpen={isChangeStatusOpen}
        onClose={() => setIsChangeStatusOpen(false)}
        onSubmit={handleStatusChangeSubmit}
      />

      <CommercialReportPDFModal
        isOpen={isPDFModalOpen}
        onClose={() => setIsPDFModalOpen(false)}
        leases={filteredLeases}
        outletName={activeOutlet?.name || "Semua Outlet"}
      />
    </div>
  );
}
