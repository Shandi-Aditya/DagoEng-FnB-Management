"use client";

import { ShieldCheck, User } from "lucide-react";
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
  getEmployeeStatusLabel,
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
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-2">
            <User className="size-4 text-primary" />
            <div className="space-y-0.5">
              <span className="font-mono text-xs font-medium text-primary">
                {employee.employeeNumber}
              </span>
              <DialogTitle className="text-base font-medium">{employee.name}</DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs">
            {employee.role} · Divisi {employee.department}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto py-1 pr-1 text-xs">
          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3.5 text-xs">
            <div>
              <span className="block text-xs text-muted-foreground">WhatsApp</span>
              <span className="font-mono font-medium text-foreground">{employee.contact}</span>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground">Email</span>
              <span className="font-medium text-foreground">{employee.email || "-"}</span>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground">Shift tugas</span>
              <span className="font-medium text-foreground">{employee.assignedShift}</span>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground">Bergabung</span>
              <span className="font-medium text-foreground">{employee.joinedDate}</span>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground">Divisi</span>
              <StatusBadge status={deptTone} className="mt-0.5">
                {employee.department}
              </StatusBadge>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground">Status</span>
              <StatusBadge status={statusTone} className="mt-0.5">
                {getEmployeeStatusLabel(employee.status)}
              </StatusBadge>
            </div>
          </div>

          {/* Permissions Matrix Overview */}
          <div className="space-y-2">
            <h4 className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <ShieldCheck className="size-4 text-primary" />
              <span>Daftar hak akses sistem ({perms.length})</span>
            </h4>

            <div className="grid max-h-48 grid-cols-1 gap-1.5 overflow-y-auto rounded-lg border bg-card p-2">
              {ALL_PERMISSIONS.map((p) => {
                const isGranted = perms.includes(p.id);
                if (!isGranted) return null;

                return (
                  <div
                    key={p.id}
                    className="space-y-0.5 rounded-md border bg-muted/20 p-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground">{p.label}</p>
                      <span className="font-mono text-xs text-muted-foreground">
                        {p.category}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{p.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between border-t pt-3 sm:justify-between">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onClose();
              onEdit(employee);
            }}
          >
            Edit profil
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
          >
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
