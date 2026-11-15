"use client";

import { ChevronDown, Download, FileSpreadsheet, FileText, FlaskConical, Plus } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrencyIDR } from "@/lib/utils";

interface InventoryToolbarProps {
  totalStockValue: number;
  ingredientCount: number;
  lowCount: number;
  reorderCount: number;
  onOpenCreatePO: () => void;
  onOpenBOMSimulator: () => void;
  onOpenValuationPDF: () => void;
  onExportExcel: () => void;
  onExportCSV: () => void;
}

/** Page title, one primary action (Buat PO) and the three numbers that matter. */
export function InventoryToolbar({
  totalStockValue,
  ingredientCount,
  lowCount,
  reorderCount,
  onOpenCreatePO,
  onOpenBOMSimulator,
  onOpenValuationPDF,
  onExportExcel,
  onExportCSV,
}: InventoryToolbarProps) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Inventori"
        description="Stok bahan, resep, pesanan pembelian, dan opname."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="lg" />}>
                Lainnya
                <ChevronDown className="text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-52">
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={onOpenBOMSimulator}>
                    <FlaskConical />
                    Simulasi resep
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onOpenValuationPDF}>
                    <FileText />
                    Laporan nilai stok
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={onExportExcel}>
                    <FileSpreadsheet />
                    Ekspor stok ke Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onExportCSV}>
                    <Download />
                    Ekspor stok ke CSV
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="lg" onClick={onOpenCreatePO}>
              <Plus />
              Buat PO
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          className="col-span-2 sm:col-span-1"
          label="Nilai stok"           value={formatCurrencyIDR(totalStockValue)}
          hint={`${ingredientCount} bahan, dihitung dari HPP`}
        />
        <StatCard label="Menipis" value={String(lowCount)} hint="bahan mendekati batas minimum" />
        <StatCard label="Perlu dibeli" value={String(reorderCount)} hint="bahan kritis atau habis" />
      </div>
    </div>
  );
}
