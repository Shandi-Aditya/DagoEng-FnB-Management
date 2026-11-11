import { CalendarCheck, Plus } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";

interface TablesToolbarProps {
  outletName: string;
  totalTables: number;
  availableCount: number;
  occupiedCount: number;
  reservedCount: number;
  activeTab: "FLOOR_PLAN" | "RESERVATIONS";
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
  activeTab,
  onAddArea,
  onAddTable,
  onAddReservation,
}: TablesToolbarProps) {
  return (
    <PageHeader
      title="Meja"
      description={`${totalTables} meja · ${availableCount} tersedia · ${occupiedCount} terisi · ${reservedCount} reservasi`}
      actions={
        <div className="flex items-center gap-2">
          {activeTab === "FLOOR_PLAN" ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onAddArea}
                className="text-xs"
              >
                + Tambah Area
              </Button>
              <Button
                size="sm"
                onClick={onAddTable}
                className="gap-1.5 text-xs"
              >
                <Plus className="size-3.5" />
                <span>Tambah meja</span>
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={onAddReservation}
              className="gap-1.5 text-xs"
            >
              <CalendarCheck className="size-3.5" />
              <span>Buat reservasi</span>
            </Button>
          )}
        </div>
      }
    />
  );
}
