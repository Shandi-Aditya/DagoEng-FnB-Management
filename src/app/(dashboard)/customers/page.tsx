"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOutlet } from "@/contexts/OutletContext";
import { useLoyalty } from "@/contexts/LoyaltyContext";
import type { LoyaltyMember, LoyaltyTier } from "@/types/loyalty";
import { StatCard } from "@/components/app/stat-card";
import { notify } from "@/components/app/notify";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";
import { Sparkles } from "lucide-react";

import {
  calculateCustomerKPIs,
  filterMembers,
  buildCustomerExportData,
} from "@/features/customers/customers-domain";
import { CustomersToolbar } from "@/features/customers/CustomersToolbar";
import { CustomersTable } from "@/features/customers/CustomersTable";
import { AddCustomerModal } from "@/features/customers/AddCustomerModal";
import { CustomerHistoryModal } from "@/features/customers/CustomerHistoryModal";
import { TierOverrideModal } from "@/features/customers/TierOverrideModal";
import { CustomersReportPDFModal } from "@/features/customers/CustomersReportPDFModal";

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

  const isOwnerOrAdmin =
    user?.role.slug === "OWNER" ||
    user?.role.slug === "SUPER_ADMIN" ||
    user?.role.slug === "MANAGER";

  const kpis = useMemo(() => calculateCustomerKPIs(filteredMembers), [filteredMembers]);

  const displayedMembers = useMemo(
    () => filterMembers(filteredMembers, searchQuery, tierFilter),
    [filteredMembers, searchQuery, tierFilter]
  );

  const handleExportCSV = () => {
    const { headers, rows } = buildCustomerExportData(filteredMembers);
    downloadCSV(
      `Data_Pelanggan_CRM_${activeOutlet?.name || "All"}_${Date.now()}`,
      headers,
      rows
    );
    notify.success("Data member diekspor ke CSV");
  };

  const handleExportExcel = () => {
    const { headers, rows } = buildCustomerExportData(filteredMembers);
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
        onExportExcel={handleExportExcel}
        onExportCSV={handleExportCSV}
        onOpenPDF={() => setIsPDFModalOpen(true)}
        onOpenAddModal={() => setIsAddModalOpen(true)}
      />

      {/* Info Banner */}
      <div className="p-4 rounded-xl border bg-card text-xs space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center font-medium">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="font-medium text-foreground text-sm">
            Cara Kerja CRM & Akumulasi Tier Loyalty
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-muted-foreground">
          <div className="p-3 rounded-lg border bg-muted/30 space-y-1">
            <p className="font-medium text-foreground">1. Pendaftaran Otomatis</p>
            <p className="text-[11px] leading-relaxed">
              Saat pelanggan login di QR Self-Order atau kasir memasukkan No. WhatsApp di POS, akun member langsung dibuat.
            </p>
          </div>

          <div className="p-3 rounded-lg border bg-muted/30 space-y-1">
            <p className="font-medium text-foreground">2. Akumulasi Poin Real-Time</p>
            <p className="text-[11px] leading-relaxed">
              Setiap transaksi selesai menambah 1 Poin per Rp 1.000 belanja. Tier diperbarui otomatis saat mencapai threshold.
            </p>
          </div>

          <div className="p-3 rounded-lg border bg-muted/30 space-y-1">
            <p className="font-medium text-foreground">3. Override Manajerial</p>
            <p className="text-[11px] leading-relaxed">
              Manajer dan Admin dapat menyesuaikan poin dan tier secara manual dengan alasan terverifikasi ke log audit.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total Pelanggan"
          value={`${kpis.totalMembers.toLocaleString("id-ID")}`}
          hint="Terdaftar di outlet aktif"
        />
        <StatCard
          label="Platinum / Gold"
          value={`${kpis.platinumGoldCount.toLocaleString("id-ID")}`}
          hint=">= 1.500 Poin loyalty"
        />
        <StatCard
          label="Silver Member"
          value={`${kpis.silverCount.toLocaleString("id-ID")}`}
          hint="500 - 1.499 Poin loyalty"
        />
        <StatCard
          label="Bronze Member"
          value={`${kpis.bronzeCount.toLocaleString("id-ID")}`}
          hint="0 - 499 Poin loyalty"
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

      <CustomersReportPDFModal
        isOpen={isPDFModalOpen}
        onClose={() => setIsPDFModalOpen(false)}
        members={filteredMembers}
        outletName={activeOutlet?.name || "Semua Outlet"}
      />
    </div>
  );
}
