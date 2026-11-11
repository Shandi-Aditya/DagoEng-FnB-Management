import { AlertTriangle, BellRing, FileText, Plus, RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrencyIDR } from "@/lib/utils";

interface InventoryToolbarProps {
  outletName: string;
  totalStockValue: number;
  safeCount: number;
  lowCount: number;
  criticalCount: number;
  outOfStockCount: number;
  onOpenValuationPDF: () => void;
  onOpenRestockAlert: () => void;
  onOpenBOMSimulator: () => void;
  onOpenCreatePO: () => void;
}

export function InventoryToolbar({
  outletName,
  totalStockValue,
  safeCount,
  lowCount,
  criticalCount,
  outOfStockCount,
  onOpenValuationPDF,
  onOpenRestockAlert,
  onOpenBOMSimulator,
  onOpenCreatePO,
}: InventoryToolbarProps) {
  const needsAttention = criticalCount + outOfStockCount > 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventori"
        description="Stok bahan, resep, pesanan pembelian, dan opname."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenValuationPDF}
              className="gap-1.5 text-xs"
            >
              <FileText className="size-3.5 text-muted-foreground" />
              <span>Laporan nilai stok</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onOpenRestockAlert}
              className="gap-1.5 text-xs"
            >
              <BellRing className="size-3.5 text-muted-foreground" />
              <span>Perlu dibeli</span>
              {needsAttention ? (
                <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                  {criticalCount + outOfStockCount}
                </Badge>
              ) : null}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onOpenBOMSimulator}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="size-3.5 text-muted-foreground" />
              <span>Simulasi resep</span>
            </Button>

            <Button size="sm" onClick={onOpenCreatePO} className="gap-1.5 text-xs">
              <Plus className="size-3.5" />
              <span>Buat PO</span>
            </Button>
          </div>
        }
      />

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Nilai stok"
          value={formatCurrencyIDR(totalStockValue)}
          hint="Dihitung dari HPP per satuan"
        />
        <StatCard
          label="Aman"
          value={String(safeCount)}
          hint="bahan di atas batas minimum"
        />
        <StatCard
          label="Menipis"
          value={String(lowCount)}
          hint="bahan mendekati batas minimum"
        />
        <StatCard
          label="Kritis atau habis"
          value={String(criticalCount + outOfStockCount)}
          hint={
            outOfStockCount > 0
              ? `${outOfStockCount} habis, ${criticalCount} kritis`
              : "bahan perlu dibeli"
          }
        />
      </div>
    </div>
  );
}
