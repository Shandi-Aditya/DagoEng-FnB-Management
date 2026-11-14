"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { AreaItem } from "@/contexts/TableContext";

interface AddTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  areas: AreaItem[];
  onAddTable: (areaId: string, name: string, cap: number) => void;
}

export function AddTableModal({ isOpen, onClose, areas, onAddTable }: AddTableModalProps) {
  const [areaId, setAreaId] = useState(areas[0]?.id || "");
  const [tableName, setTableName] = useState("");
  const [capacity, setCapacity] = useState(4);

  useEffect(() => {
    if (areas[0]?.id && !areaId) {
      setAreaId(areas[0].id);
    }
  }, [areas, areaId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableName.trim() || !areaId) return;
    onAddTable(areaId, tableName.trim(), capacity);
    setTableName("");
    setCapacity(4);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">Tambah meja</DialogTitle>
          <DialogDescription className="text-xs">
            Nomor meja dan jumlah kursinya.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Area</label>
            <NativeSelect
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              className="w-full text-xs"
            >
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Nomor meja</label>
              <Input
                required
                placeholder="Misalnya T-06"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                className="text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Kapasitas (orang)</label>
              <Input
                type="number"
                min={1}
                max={20}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="text-xs font-mono"
              />
            </div>
          </div>

          <DialogFooter className="border-t pt-3">
            <Button type="button" variant="outline" size="lg" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" size="lg">
              Simpan meja
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
