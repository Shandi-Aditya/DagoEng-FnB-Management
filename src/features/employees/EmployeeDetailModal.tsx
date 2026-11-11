import { User, ShieldCheck } from "lucide-react";
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
import { StatusBadge } from "@/components/app/status-badge";
import {
  ALL_PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  getDepartmentBadgeTone,
  getEmployeeStatusTone,
} from "./employees-domain";

export interface EmployeeDetailModalProps {
  employee: EmployeeProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (emp: EmployeeProfile) => void;
}

export function EmployeeDetailModal({
  employee,
  isOpen,
  onClose,
  onEdit,
}: EmployeeDetailModalProps) {
  if (!employee) return null;

  const deptTone = getDepartmentBadgeTone(employee.department);
  const statusTone = getEmployeeStatusTone(employee.status);
  const perms =
    employee.permissions ||
    ROLE_DEFAULT_PERMISSIONS[employee.role] || ["pos_access"];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            <div className="space-y-0.5">
              <span className="font-mono text-xs text-primary font-medium">
                {employee.employeeNumber}
              </span>
              <DialogTitle className="text-base">{employee.name}</DialogTitle>
            </div>
          </div>
          <DialogDescription>
            {employee.role} • Departemen {employee.department}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1 py-1">
          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg border bg-muted/30 text-xs">
            <div>
              <span className="text-muted-foreground block text-[10px]">WhatsApp</span>
              <span className="font-mono font-medium text-foreground">{employee.contact}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Email</span>
              <span className="font-medium text-foreground">{employee.email || "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Shift</span>
              <span className="font-medium text-foreground">{employee.assignedShift}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Bergabung</span>
              <span className="font-medium text-foreground">{employee.joinedDate}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Departemen</span>
              <StatusBadge status={deptTone} className="text-[10px] mt-0.5">
                {employee.department}
              </StatusBadge>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Status</span>
              <StatusBadge status={statusTone} className="text-[10px] mt-0.5">
                {employee.status}
              </StatusBadge>
            </div>
          </div>

          {/* Permissions Matrix Overview */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>Daftar Hak Akses Sistem Terotorisasi ({perms.length})</span>
            </h4>

            <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto p-2 rounded-lg border bg-card">
              {ALL_PERMISSIONS.map((p) => {
                const isGranted = perms.includes(p.id);
                if (!isGranted) return null;

                return (
                  <div
                    key={p.id}
                    className="p-2 rounded-md border bg-muted/20 text-xs space-y-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground text-[11px]">{p.label}</p>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {p.category}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{p.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between pt-3 border-t">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onClose();
              onEdit(employee);
            }}
            className="text-xs"
          >
            Edit Profil
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
            className="text-xs"
          >
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
