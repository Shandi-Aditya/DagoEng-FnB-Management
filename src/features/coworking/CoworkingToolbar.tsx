import Link from "next/link";
import {
  FileSpreadsheet,
  Download,
  FileText,
  Settings,
  UserPlus,
  Plus,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";

export interface CoworkingToolbarProps {
  outletName: string;
  totalSpaces: number;
  availableSpaces: number;
  occupiedSpaces: number;
  activeMembers: number;
  canManageSettings: boolean;
  onExportExcel: () => void;
  onExportCSV: () => void;
  onOpenPDF: () => void;
  onOpenNewMemberModal: () => void;
  onOpenNewBookingModal: () => void;
}

export function CoworkingToolbar({
  outletName,
  totalSpaces,
  availableSpaces,
  occupiedSpaces,
  activeMembers,
  canManageSettings,
  onExportExcel,
  onExportCSV,
  onOpenPDF,
  onOpenNewMemberModal,
  onOpenNewBookingModal,
}: CoworkingToolbarProps) {
  return (
    <div className="space-y-4">
      <PageHeader
        title={`Co-working · ${outletName}`}
        description="Penyewaan ruang kerja, meja harian, paket membership, dan log sesi check-in."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onExportExcel}
              className="gap-1.5 text-xs"
            >
              <FileSpreadsheet className="size-3.5 text-success" />
              <span>Export Excel</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={onExportCSV}
              className="gap-1.5 text-xs"
            >
              <Download className="size-3.5 text-muted-foreground" />
              <span>Export CSV</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={onOpenPDF}
              className="gap-1.5 text-xs"
            >
              <FileText className="size-3.5 text-muted-foreground" />
              <span>Cetak PDF</span>
            </Button>

            {canManageSettings ? (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                render={<Link href="/settings" />}
                nativeButton={false}
              >
                <Settings className="size-3.5 text-muted-foreground" />
                <span>Master data</span>
              </Button>
            ) : null}

            <Button
              size="sm"
              variant="outline"
              onClick={onOpenNewMemberModal}
              className="gap-1.5 text-xs"
            >
              <UserPlus className="size-3.5" />
              <span>Tambah member</span>
            </Button>

            <Button
              size="sm"
              onClick={onOpenNewBookingModal}
              className="gap-1.5 text-xs"
            >
              <Plus className="size-3.5" />
              <span>Buat booking</span>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total ruang dan meja" value={String(totalSpaces)} />
        <StatCard label="Tersedia" value={String(availableSpaces)} />
        <StatCard label="Sedang digunakan" value={String(occupiedSpaces)} />
        <StatCard label="Member aktif" value={String(activeMembers)} />
      </div>
    </div>
  );
}
