"use client";

import { useMemo, useState } from "react";
import { Building2 } from "lucide-react";

import { notify } from "@/components/app/notify";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCommercial } from "@/contexts/CommercialContext";
import { useOutlet } from "@/contexts/OutletContext";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";
import { formatCurrencyIDR } from "@/lib/utils";
import type { CommercialLease, LeaseStatus } from "@/types/commercial";

import { ChangeLeaseStatusModal } from "@/features/commercial/ChangeLeaseStatusModal";
import {
  buildCommercialExportData,
  calculateCommercialKPIs,
  filterLeases,
  getLeaseStatusLabel,
} from "@/features/commercial/commercial-domain";
import { CommercialDetailModal } from "@/features/commercial/CommercialDetailModal";
import { CommercialReportPDFModal } from "@/features/commercial/CommercialReportPDFModal";
import { CommercialTable } from "@/features/commercial/CommercialTable";
import { CommercialToolbar } from "@/features/commercial/CommercialToolbar";
import { CreateLeaseModal } from "@/features/commercial/CreateLeaseModal";
import { RecordPaymentModal } from "@/features/commercial/RecordPaymentModal";

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
      <div className="mx-auto mt-10 max-w-lg space-y-4 rounded-2xl border bg-card p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
          <Building2 className="size-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-medium text-foreground">Modul komersial dinonaktifkan</h3>
          <p className="text-xs text-muted-foreground">
            Modul sewa retail dan kontrak tenant saat ini berstatus nonaktif.
          </p>
        </div>
        <div className="space-y-1 rounded-xl border bg-muted/40 p-3 text-left text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Akses dibatasi</p>
          <p className="text-xs leading-relaxed">
            Aktifkan modul kembali melalui tombol di bawah ini atau melalui menu Pengaturan Organisasi.
          </p>
        </div>
        <div className="pt-2">
          <Button onClick={() => toggleOrgModule("COMMERCIAL")}>
            Aktifkan modul komersial
          </Button>
        </div>
      </div>
    );
  }

  const handleExportCSV = () => {
    const { headers, rows } = buildCommercialExportData(displayedLeases);
    downloadCSV(
      `Kontrak_Tenant_Commercial_${activeOutlet?.name || "All"}_${Date.now()}`,
      headers,
      rows
    );
    notify.success("Kontrak diekspor ke CSV");
  };

  const handleExportExcel = () => {
    const { headers, rows } = buildCommercialExportData(displayedLeases);
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatCard
          label="Unit aktif"
          value={String(kpis.activeUnitsCount)}
          hint="tenant bertugas"
        />
        <StatCard
          label="Tagihan bulanan"
          value={formatCurrencyIDR(kpis.totalMonthlyBilling)}
          hint="estimasi per bulan"
        />
        <StatCard
          label="Deposit jaminan"
          value={formatCurrencyIDR(kpis.totalSecurityDeposit)}
          hint="tersimpan di sistem"
        />
        <StatCard
          label="Outlet aktif"
          value={activeOutlet?.name || "Semua Outlet"}
          hint="cakupan filter"
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
        leases={displayedLeases}
        outletName={activeOutlet?.name || "Semua Outlet"}
      />
    </div>
  );
}
