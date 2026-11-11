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
  const [contact, setContact] = useState("+62 812-");
  const [email, setEmail] = useState("");
  const [assignedShift, setAssignedShift] = useState("Shift Pagi (08:00 - 16:00)");
  const [permissions, setPermissions] = useState<string[]>(
    ROLE_DEFAULT_PERMISSIONS["Floor Waiter"] || ["pos_access"]
  );

  const resetForm = () => {
    setName("");
    setRole("Floor Waiter");
    setDepartment("Service");
    setContact("+62 812-");
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
    if (!name.trim()) return;

    onSubmit({
      name: name.trim(),
      role,
      department,
      contact: contact.trim(),
      email: email.trim(),
      assignedShift,
      permissions,
    });

    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            <span>Tambah karyawan</span>
          </DialogTitle>
          <DialogDescription>
            Daftarkan staf baru dan sesuaikan penugasan shift serta hak akses.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-3.5 pr-1 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="add-emp-name" className="text-xs">
              Nama Lengkap Karyawan <span className="text-destructive">*</span>
            </Label>
            <Input
              id="add-emp-name"
              required
              placeholder="Misalnya Gusti Bagus"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="add-emp-role" className="text-xs">Jabatan</Label>
              <NativeSelect
                id="add-emp-role"
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
              <Label htmlFor="add-emp-dept" className="text-xs">Departemen</Label>
              <NativeSelect
                id="add-emp-dept"
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
              <Label htmlFor="add-emp-contact" className="text-xs">WhatsApp</Label>
              <Input
                id="add-emp-contact"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="text-xs font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-emp-email" className="text-xs">Email</Label>
              <Input
                id="add-emp-email"
                type="email"
                placeholder="staf@dagoeng.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-emp-shift" className="text-xs">Shift</Label>
            <NativeSelect
              id="add-emp-shift"
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

          {/* Permissions Matrix */}
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Hak akses</Label>
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
              onClick={handleClose}
              className="text-xs"
            >
              Batal
            </Button>
            <Button type="submit" size="sm" className="text-xs font-medium">
              Simpan & Daftarkan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
