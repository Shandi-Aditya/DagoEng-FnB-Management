import { useState } from "react";
import { FilePlus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";

export interface CreateLeaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: {
    tenantName: string;
    tenantContact: string;
    tenantEmail: string;
    unitCode: string;
    areaSquareMeters: number;
    monthlyRent: number;
    depositAmount: number;
    startDate: string;
    endDate: string;
    paymentSchedule: "MONTHLY" | "QUARTERLY" | "ANNUALLY";
    notes?: string;
  }) => void;
}

export function CreateLeaseModal({
  isOpen,
  onClose,
  onSubmit,
}: CreateLeaseModalProps) {
  const [tenantName, setTenantName] = useState("");
  const [tenantContact, setTenantContact] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [unitCode, setUnitCode] = useState("Lot A-04 (Ground Floor)");
  const [areaM2, setAreaM2] = useState<number>(30);
  const [monthlyRent, setMonthlyRent] = useState<number>(5000000);
  const [deposit, setDeposit] = useState<number>(10000000);
  const [startDate, setStartDate] = useState("01 Okt 2026");
  const [endDate, setEndDate] = useState("30 Sep 2027");
  const [schedule, setSchedule] = useState<"MONTHLY" | "QUARTERLY" | "ANNUALLY">("MONTHLY");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setTenantName("");
    setTenantContact("");
    setTenantEmail("");
    setNotes("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantName.trim() || !unitCode.trim()) return;

    onSubmit({
      tenantName: tenantName.trim(),
      tenantContact: tenantContact.trim(),
      tenantEmail: tenantEmail.trim(),
      unitCode: unitCode.trim(),
      areaSquareMeters: Number(areaM2) || 0,
      monthlyRent: Number(monthlyRent) || 0,
      depositAmount: Number(deposit) || 0,
      startDate: startDate.trim(),
      endDate: endDate.trim(),
      paymentSchedule: schedule,
      notes: notes.trim() || undefined,
    });

    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FilePlus className="w-5 h-5 text-primary" />
            <span>Tambah kontrak</span>
          </DialogTitle>
          <DialogDescription>
            Masukkan data tenant, unit komersial, dan rincian nilai sewa kontrak.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-3.5 pr-1 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="tenant-name" className="text-xs">
              Nama Tenant / Brand <span className="text-destructive">*</span>
            </Label>
            <Input
              id="tenant-name"
              required
              placeholder="Misalnya Artisan Bakery"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tenant-contact" className="text-xs">
                No. WhatsApp <span className="text-destructive">*</span>
              </Label>
              <Input
                id="tenant-contact"
                required
                placeholder="081234567890"
                value={tenantContact}
                onChange={(e) => setTenantContact(e.target.value)}
                className="text-xs font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tenant-email" className="text-xs">
                Email Tenant
              </Label>
              <Input
                id="tenant-email"
                type="email"
                placeholder="tenant@brand.com"
                value={tenantEmail}
                onChange={(e) => setTenantEmail(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="unit-code" className="text-xs">
                Kode Unit / Lot Retail <span className="text-destructive">*</span>
              </Label>
              <Input
                id="unit-code"
                required
                value={unitCode}
                onChange={(e) => setUnitCode(e.target.value)}
                className="text-xs font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="area-m2" className="text-xs">
                Luas Area (m²)
              </Label>
              <Input
                id="area-m2"
                type="number"
                min={1}
                value={areaM2}
                onChange={(e) => setAreaM2(Number(e.target.value))}
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="monthly-rent" className="text-xs">
                Biaya Sewa / Bulan (Rp) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="monthly-rent"
                type="number"
                required
                min={0}
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(Number(e.target.value))}
                className="text-xs font-mono font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="security-deposit" className="text-xs">
                Security Deposit (Rp)
              </Label>
              <Input
                id="security-deposit"
                type="number"
                min={0}
                value={deposit}
                onChange={(e) => setDeposit(Number(e.target.value))}
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lease-start" className="text-xs">Mulai</Label>
              <Input
                id="lease-start"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lease-end" className="text-xs">Selesai</Label>
              <Input
                id="lease-end"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lease-sched" className="text-xs">Jadwal tagihan</Label>
            <NativeSelect
              id="lease-sched"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value as "MONTHLY" | "QUARTERLY" | "ANNUALLY")}
              className="w-full text-xs font-medium"
            >
              <option value="MONTHLY">Bulanan</option>
              <option value="QUARTERLY">Per 3 bulan</option>
              <option value="ANNUALLY">Tahunan</option>
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lease-notes" className="text-xs">Catatan</Label>
            <Textarea
              id="lease-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ketentuan khusus, kalau ada"
              className="text-xs"
            />
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
              Simpan Kontrak
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
