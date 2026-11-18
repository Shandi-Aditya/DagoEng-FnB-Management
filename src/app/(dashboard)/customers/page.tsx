"use client";

import { useMemo, useState } from "react";
import { notify } from "@/components/app/notify";
import { StatCard } from "@/components/app/stat-card";
import { useAuth } from "@/contexts/AuthContext";
import { useLoyalty } from "@/contexts/LoyaltyContext";
import { useOutlet } from "@/contexts/OutletContext";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";
import type { LoyaltyMember, LoyaltyTier } from "@/types/loyalty";

import { AddCustomerModal } from "@/features/customers/AddCustomerModal";
import { CustomerHistoryModal } from "@/features/customers/CustomerHistoryModal";
import {
  buildCustomerExportData,
  calculateCustomerKPIs,
  canUserExportCustomers,
  canUserViewFullCustomerContacts,
  filterMembers,
} from "@/features/customers/customers-domain";
import { CustomersReportPDFModal } from "@/features/customers/CustomersReportPDFModal";
import { CustomersTable } from "@/features/customers/CustomersTable";
import { CustomersToolbar } from "@/features/customers/CustomersToolbar";
import { TierOverrideModal } from "@/features/customers/TierOverrideModal";

export default function CustomersPage() {
  const { user } = useAuth();
  const { activeOutlet } = useOutlet();
  const { filteredMembers, createMember, addPoints, manualOverrideTier } = useLoyalty();

  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("ALL");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);
  const [selectedMemberForHistory, setSelectedMemberForHistory] = useState<LoyaltyMember | null>(null);
  const [selectedMemberForOverride, setSelectedMemberForOverride] = useState<LoyaltyMember | null>(null);

  const roleSlug = user?.role?.slug;
  const isOwnerOrAdmin = canUserExportCustomers(roleSlug);
  const canExport = isOwnerOrAdmin;
  const canViewFullContact = canUserViewFullCustomerContacts(roleSlug);

  const kpis = useMemo(() => calculateCustomerKPIs(filteredMembers), [filteredMembers]);

  const displayedMembers = useMemo(
    () => filterMembers(filteredMembers, searchQuery, tierFilter),
    [filteredMembers, searchQuery, tierFilter]
  );

  const handleExportCSV = () => {
    if (!canExport) {
      notify.error("Akses ditolak", "Hanya Owner dan Manager yang dapat mengekspor data pelanggan.");
      return;
    }
    const { headers, rows } = buildCustomerExportData(displayedMembers);
    downloadCSV(
      `Data_Pelanggan_CRM_${activeOutlet?.name || "All"}_${Date.now()}`,
      headers,
      rows
    );
    notify.success("Data member diekspor ke CSV");
  };

  const handleExportExcel = () => {
    if (!canExport) {
      notify.error("Akses ditolak", "Hanya Owner dan Manager yang dapat mengekspor data pelanggan.");
      return;
    }
    const { headers, rows } = buildCustomerExportData(displayedMembers);
    downloadExcel(
      `Data_Pelanggan_CRM_${activeOutlet?.name || "All"}_${Date.now()}`,
      "Database Pelanggan CRM",
      headers,
      rows
    );
    notify.success("Data member diekspor ke Excel");
  };

  const handleAddMember = (data: {
    name: string;
    phone: string;
    email?: string;
    identityNo?: string;
    initialPoints: number;
  }) => {
    const newMem = createMember(data);
    notify.success(`${newMem.name} terdaftar`, `Tier ${newMem.tier}`);
  };

  const handleAddPointsQuick = (id: string, name: string) => {
    addPoints(id, 20, `Penambahan 20 Poin Manual untuk ${name}`);
    notify.success(`${name} +20 poin`);
  };

  const handleManualOverride = (memberId: string, newTier: LoyaltyTier, reason: string) => {
    manualOverrideTier(memberId, newTier, reason);
    notify.success(`Tier diubah ke ${newTier}`);
  };

  return (
    <div className="space-y-6">
      <CustomersToolbar
        outletName={activeOutlet?.name || "Singaraja Hub"}
        totalMembers={filteredMembers.length}
        canExport={canExport}
        onExportExcel={handleExportExcel}
        onExportCSV={handleExportCSV}
        onOpenPDF={() => {
          if (!canExport) return;
          setIsPDFModalOpen(true);
        }}
        onOpenAddModal={() => setIsAddModalOpen(true)}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatCard
          label="Total member"
          value={kpis.totalMembers.toLocaleString("id-ID")}
          hint={`di ${activeOutlet?.name || "outlet aktif"}`}
        />
        <StatCard
          label="Platinum & Gold"
          value={kpis.platinumGoldCount.toLocaleString("id-ID")}
          hint="≥ 1.500 poin loyalty"
        />
        <StatCard
          label="Silver"
          value={kpis.silverCount.toLocaleString("id-ID")}
          hint="500 – 1.499 poin loyalty"
        />
        <StatCard
          label="Bronze"
          value={kpis.bronzeCount.toLocaleString("id-ID")}
          hint="0 – 499 poin loyalty"
        />
      </div>

      {/* Customers Table */}
      <CustomersTable
        members={displayedMembers}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        tierFilter={tierFilter}
        onTierFilterChange={setTierFilter}
        isOwnerOrAdmin={isOwnerOrAdmin}
        canViewFullContact={canViewFullContact}
        onSelectMemberHistory={setSelectedMemberForHistory}
        onSelectMemberOverride={setSelectedMemberForOverride}
        onAddPointsQuick={handleAddPointsQuick}
      />

      {/* Modals */}
      <AddCustomerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddMember}
      />

      <CustomerHistoryModal
        member={selectedMemberForHistory}
        onClose={() => setSelectedMemberForHistory(null)}
      />

      <TierOverrideModal
        member={selectedMemberForOverride}
        onClose={() => setSelectedMemberForOverride(null)}
        onSubmit={handleManualOverride}
      />

      {canExport && (
        <CustomersReportPDFModal
          isOpen={isPDFModalOpen}
          onClose={() => setIsPDFModalOpen(false)}
          members={displayedMembers}
          outletName={activeOutlet?.name || "Semua Outlet"}
        />
      )}
    </div>
  );
}
