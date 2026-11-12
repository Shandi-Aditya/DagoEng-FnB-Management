"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  ALL_PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  type EmployeeDepartment,
} from "./employees-domain";

export interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: {
    name: string;
    role: string;
    department: EmployeeDepartment;
    contact: string;
    email: string;
    assignedShift: string;
    permissions: string[];
  }) => void;
}

const ROLES = [
  "Floor Waiter",
  "Cashier",
  "Head Cashier",
  "Barista",
  "Kitchen",
  "Head Chef",
  "Inventory Specialist",
  "Outlet Supervisor",
  "Store Manager",
];

const DEPARTMENTS: EmployeeDepartment[] = [
  "Service",
  "Cashier",
  "Barista",
  "Kitchen",
  "Inventory",
  "Management",
];

const SHIFTS = [
  "Shift Pagi (08:00 - 16:00)",
  "Shift Siang (12:00 - 20:00)",
  "Shift Sore (16:00 - 24:00)",
  "Full Day General (09:00 - 18:00)",
];

export function AddEmployeeModal({
  isOpen,
  onClose,
  onSubmit,
}: AddEmployeeModalProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("Floor Waiter");
  const [department, setDepartment] = useState<EmployeeDepartment>("Service");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [assignedShift, setAssignedShift] = useState("Shift Pagi (08:00 - 16:00)");
  const [permissions, setPermissions] = useState<string[]>(
    ROLE_DEFAULT_PERMISSIONS["Floor Waiter"] || ["pos_access"]
  );

  const resetForm = () => {
    setName("");
    setRole("Floor Waiter");
    setDepartment("Service");
    setContact("");
    setEmail("");
    setAssignedShift("Shift Pagi (08:00 - 16:00)");
    setPermissions(ROLE_DEFAULT_PERMISSIONS["Floor Waiter"] || ["pos_access"]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    if (ROLE_DEFAULT_PERMISSIONS[newRole]) {
      setPermissions(ROLE_DEFAULT_PERMISSIONS[newRole]);
    }
  };

  const togglePermission = (permId: string) => {
    setPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !contact.trim()) return;

    onSubmit({
      name: name.trim(),
      role,
      department,
      contact: contact.trim(),
      email: email.trim() || "-",
      assignedShift,
      permissions,
    });

    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base font-medium">
            <UserPlus className="size-4 text-primary" />
            <span>Tambah staf</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Daftarkan staf baru, penugasan shift kerja, dan konfigurasikan izin sistem.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto py-1 pr-1 text-xs">
          <div className="space-y-1.5">
            <Label htmlFor="emp-name" className="text-xs font-medium text-foreground">
              Nama lengkap <span className="text-destructive">*</span>
            </Label>
            <Input
              id="emp-name"
              required
              placeholder="Misalnya Wayan Darmawan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="emp-contact" className="text-xs font-medium text-foreground">
                Nomor WhatsApp <span className="text-destructive">*</span>
              </Label>
              <Input
                id="emp-contact"
                required
                placeholder="081234567890"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="emp-email" className="text-xs font-medium text-foreground">
                Email staf
              </Label>
              <Input
                id="emp-email"
                type="email"
                placeholder="staf@dagoeng.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="emp-role" className="text-xs font-medium text-foreground">
                Peran dan jabatan
              </Label>
              <NativeSelect
                id="emp-role"
                value={role}
                onChange={(e) => handleRoleChange(e.target.value)}
                className="w-full text-xs font-medium"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="emp-dept" className="text-xs font-medium text-foreground">
                Divisi
              </Label>
              <NativeSelect
                id="emp-dept"
                value={department}
                onChange={(e) => setDepartment(e.target.value as EmployeeDepartment)}
                className="w-full text-xs"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emp-shift" className="text-xs font-medium text-foreground">
              Penugasan shift
            </Label>
            <NativeSelect
              id="emp-shift"
              value={assignedShift}
              onChange={(e) => setAssignedShift(e.target.value)}
              className="w-full text-xs"
            >
              {SHIFTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </NativeSelect>
          </div>

          {/* Permissions Matrix */}
          <div className="space-y-2 border-t pt-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-foreground">Hak akses sistem</Label>
              <span className="font-mono text-xs text-muted-foreground">
                {permissions.length} izin aktif
              </span>
            </div>

            <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border bg-muted/20 p-2.5">
              {ALL_PERMISSIONS.map((perm) => {
                const checked = permissions.includes(perm.id);

                return (
                  <label
                    key={perm.id}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-md border p-2 text-xs transition-colors ${
                      checked ? "border-primary/40 bg-card" : "border-border/40 hover:bg-muted/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePermission(perm.id)}
                      className="mt-0.5 size-3.5 rounded text-primary"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{perm.label}</p>
                      <p className="text-xs text-muted-foreground">{perm.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <DialogFooter className="gap-2 border-t pt-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
            >
              Batal
            </Button>
            <Button type="submit" size="sm">
              Simpan staf
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
