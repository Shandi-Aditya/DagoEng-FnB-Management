"use client";

import Link from "next/link";
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Plus,
  Settings,
  UserPlus,
} from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Co-working"
        description={`Ruang kerja, booking harian dan per jam, member, dan check-in di ${outletName}.`}
        actions={
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="lg" />}>
                Lainnya
                <ChevronDown className="text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuItem onClick={onExportExcel}>
                  <FileSpreadsheet />
                  Ekspor Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onExportCSV}>
                  <Download />
                  Ekspor CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenPDF}>
                  <FileText />
                  Laporan PDF
                </DropdownMenuItem>
                {canManageSettings ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem render={<Link href="/settings" />}>
                      <Settings />
                      Pengaturan ruang
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="lg" onClick={onOpenNewMemberModal}>
              <UserPlus />
              Tambah member
            </Button>

            <Button size="lg" onClick={onOpenNewBookingModal}>
              <Plus />
              Buat booking
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Tersedia"
          value={String(availableSpaces)}
          hint="ruang dan meja siap pakai"
        />
        <StatCard
          label="Sedang digunakan"
          value={String(occupiedSpaces)}
          hint="sesi kerja aktif"
        />
        <StatCard
          label="Total ruang"
          value={String(totalSpaces)}
          hint={`di ${outletName}`}
        />
        <StatCard
          label="Member aktif"
          value={String(activeMembers)}
          hint="membership berjalan"
        />
      </div>
    </div>
  );
}
