import { useState, useEffect } from "react";
import { UserCheck } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  ALL_PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  type EmployeeDepartment,
} from "./employees-domain";

export interface EditEmployeeModalProps {
  employee: EmployeeProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: {
    id: string;
    name: string;
    role: string;
    department: EmployeeDepartment;
    contact: string;
    email: string;
    assignedShift: string;
    status: "AKTIF" | "CUTI" | "NON-AKTIF";
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

export function EditEmployeeModal({
  employee,
  isOpen,
  onClose,
  onSubmit,
}: EditEmployeeModalProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("Floor Waiter");
  const [department, setDepartment] = useState<EmployeeDepartment>("Service");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [assignedShift, setAssignedShift] = useState("");
  const [status, setStatus] = useState<"AKTIF" | "CUTI" | "NON-AKTIF">("AKTIF");
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (employee) {
      setName(employee.name);
      setRole(employee.role);
      setDepartment(employee.department);
      setContact(employee.contact);
      setEmail(employee.email);
      setAssignedShift(employee.assignedShift);
      setStatus(employee.status);
      setPermissions(
        employee.permissions ||
          ROLE_DEFAULT_PERMISSIONS[employee.role] || ["pos_access"]
      );
    }
  }, [employee]);

  if (!employee) return null;

  const togglePermission = (permId: string) => {
    setPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSubmit({
      id: employee.id,
      name: name.trim(),
      role,
      department,
      contact: contact.trim(),
      email: email.trim(),
      assignedShift,
      status,
      permissions,
    });

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            <span>Edit Profil & Hak Akses — {employee.name}</span>
          </DialogTitle>
          <DialogDescription>
            Perbarui data kepegawaian, penugasan shift, dan matriks izin staf.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-3.5 pr-1 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="edit-emp-name" className="text-xs">
              Nama Lengkap <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-emp-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-emp-role" className="text-xs">Jabatan / Role</Label>
              <NativeSelect
                id="edit-emp-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
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
              <Label htmlFor="edit-emp-dept" className="text-xs">Departemen</Label>
              <NativeSelect
                id="edit-emp-dept"
                value={department}
                onChange={(e) => setDepartment(e.target.value as EmployeeDepartment)}
                className="w-full text-xs font-medium"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-emp-contact" className="text-xs">Kontak WhatsApp</Label>
              <Input
                id="edit-emp-contact"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="text-xs font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-emp-email" className="text-xs">Email</Label>
              <Input
                id="edit-emp-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-emp-shift" className="text-xs">Shift Penugasan</Label>
              <NativeSelect
                id="edit-emp-shift"
                value={assignedShift}
                onChange={(e) => setAssignedShift(e.target.value)}
                className="w-full text-xs font-medium"
              >
                {SHIFTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-emp-status" className="text-xs">Status Kepegawaian</Label>
              <NativeSelect
                id="edit-emp-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as "AKTIF" | "CUTI" | "NON-AKTIF")}
                className="w-full text-xs font-medium"
              >
                <option value="AKTIF">AKTIF</option>
                <option value="CUTI">CUTI</option>
                <option value="NON-AKTIF">NON-AKTIF</option>
              </NativeSelect>
            </div>
          </div>

          {/* Permissions Matrix */}
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Hak Izin Akses Sistem</Label>
              <span className="text-[11px] text-muted-foreground font-mono">
                {permissions.length} izin dipilih
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 rounded-lg border bg-muted/20">
              {ALL_PERMISSIONS.map((perm) => {
                const isChecked = permissions.includes(perm.id);
                return (
                  <label
                    key={perm.id}
                    className={`p-2 rounded-md border text-xs cursor-pointer flex items-start gap-2 transition-colors ${
                      isChecked ? "bg-card border-primary/40" : "bg-card/50 border-border opacity-70"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => togglePermission(perm.id)}
                      className="mt-0.5 w-3.5 h-3.5 rounded text-primary"
                    />
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-medium text-foreground leading-tight text-[11px]">
                        {perm.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">
                        {perm.desc}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

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
            <Button type="submit" size="sm" className="text-xs font-medium">
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
