"use client";

import { ChevronDown, Plus } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TablesToolbarProps {
  outletName: string;
  totalTables: number;
  availableCount: number;
  occupiedCount: number;
  reservedCount: number;
  onAddArea: () => void;
  onAddTable: () => void;
  onAddReservation: () => void;
}

export function TablesToolbar({
  outletName,
  totalTables,
  availableCount,
  occupiedCount,
  reservedCount,
  onAddArea,
  onAddTable,
  onAddReservation,
}: TablesToolbarProps) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Meja"
        description={`Denah meja, kapasitas ruangan, dan reservasi tamu di ${outletName}.`}
        actions={
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" />}>
                Kelola denah
                <ChevronDown className="text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onAddTable}>
                  <Plus />
                  Tambah meja
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onAddArea}>
                  <Plus />
                  Tambah area
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button onClick={onAddReservation}>
              <Plus />
              Buat reservasi
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          className="col-span-2 sm:col-span-1"
          label="Tersedia"
          value={String(availableCount)}
          hint={`dari ${totalTables} meja aktif di ${outletName}`}
        />
        <StatCard
          label="Terisi"
          value={String(occupiedCount)}
          hint="meja sedang aktif digunakan"
        />
        <StatCard
          label="Reservasi"
          value={String(reservedCount)}
          hint="tamu terjadwal atau menunggu"
        />
      </div>
    </div>
  );
}
