import { useState } from "react";

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

interface AddAreaModalProps {
  isOpen: boolean;
  onClose: () => void;
  outletName: string;
  onAddArea: (name: string) => void;
}

export function AddAreaModal({ isOpen, onClose, outletName, onAddArea }: AddAreaModalProps) {
  const [areaName, setAreaName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!areaName.trim()) return;
    onAddArea(areaName.trim());
    setAreaName("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">
            Tambah area
          </DialogTitle>
          <DialogDescription className="text-xs">
            Area mengelompokkan meja, misalnya per lantai atau ruangan, di {outletName}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Nama area</label>
            <Input
              required
              placeholder="Misalnya Rooftop"
              value={areaName}
              onChange={(e) => setAreaName(e.target.value)}
              className="text-xs"
            />
          </div>

          <DialogFooter className="border-t pt-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
              Batal
            </Button>
            <Button type="submit" size="sm" className="text-xs">
              Simpan Area
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
