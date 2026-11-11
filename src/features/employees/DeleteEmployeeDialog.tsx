import { AlertTriangle } from "lucide-react";
import type { EmployeeProfile } from "@/types/shift";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface DeleteEmployeeDialogProps {
  employee: EmployeeProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteEmployeeDialog({
  employee,
  isOpen,
  onClose,
  onConfirm,
}: DeleteEmployeeDialogProps) {
  if (!employee) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            <span>Hapus karyawan</span>
          </DialogTitle>
          <DialogDescription>
            Apakah Anda yakin ingin menghapus data karyawan{" "}
            <strong className="text-foreground">{employee.name}</strong> ({employee.employeeNumber})?
            Tindakan ini tidak dapat dibatalkan.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs"
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            className="text-xs font-medium"
          >
            Hapus Karyawan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
