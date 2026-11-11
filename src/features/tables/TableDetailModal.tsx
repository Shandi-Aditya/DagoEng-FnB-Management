import { ArrowRight, Utensils } from "lucide-react";

import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TableItem } from "@/contexts/TableContext";

import { tableStatusLabel, tableStatusTone } from "./tables-domain";

interface TableDetailModalProps {
  tableDetails: { areaId: string; table: TableItem } | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (newStatus: TableItem["status"]) => void;
  onOpenPOS: () => void;
}

export function TableDetailModal({
  tableDetails,
  isOpen,
  onClose,
  onUpdateStatus,
  onOpenPOS,
}: TableDetailModalProps) {
  if (!tableDetails) return null;

  const { table } = tableDetails;
  const isOccupied = table.status === "OCCUPIED";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle className="text-base font-medium">
              Meja {table.number || table.id}
            </DialogTitle>
            <StatusBadge status={tableStatusTone(table.status)}>
              {tableStatusLabel(table.status)}
            </StatusBadge>
          </div>
          <DialogDescription className="text-xs">
            Kapasitas {table.cap} orang
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-xs">
          {/* Active Occupancy Details */}
          {isOccupied ? (
            <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
              <span className="text-[11px] font-medium text-muted-foreground">
                Informasi Tagihan Aktif
              </span>
              <div className="flex justify-between font-medium text-sm text-foreground">
                <span>{table.customer || "Tamu Aktif"}</span>
                <span className="font-mono text-primary">{table.total || "-"}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Durasi: {table.time || "Baru saja"} • {table.itemsCount || 2} Menu
              </p>
            </div>
          ) : null}

          {/* Status Switcher Buttons */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">Ubah status meja:</label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                variant={table.status === "AVAILABLE" ? "default" : "outline"}
                onClick={() => onUpdateStatus("AVAILABLE")}
                className="text-xs"
              >
                Tersedia
              </Button>
              <Button
                type="button"
                size="sm"
                variant={table.status === "OCCUPIED" ? "default" : "outline"}
                onClick={() => onUpdateStatus("OCCUPIED")}
                className="text-xs"
              >
                Terisi
              </Button>
              <Button
                type="button"
                size="sm"
                variant={table.status === "RESERVED" ? "default" : "outline"}
                onClick={() => onUpdateStatus("RESERVED")}
                className="text-xs"
              >
                Reservasi
              </Button>
              <Button
                type="button"
                size="sm"
                variant={table.status === "CLEANING" ? "default" : "outline"}
                onClick={() => onUpdateStatus("CLEANING")}
                className="text-xs"
              >
                Pembersihan
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 sm:justify-between">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
            Tutup
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onOpenPOS}
            className="gap-1.5 text-xs"
          >
            <Utensils className="size-3.5" />
            <span>Buka POS Kasir</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
