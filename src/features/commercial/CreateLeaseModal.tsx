"use client";

import { useMemo, useState } from "react";
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
  const todayStr = useMemo(
    () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(new Date()),
    []
  );
  const nextYearStr = useMemo(() => {
    const [y, m, d] = todayStr.split("-").map(Number);
    return new Date(Date.UTC(y + 1, m - 1, d)).toISOString().slice(0, 10);
  }, [todayStr]);

  const [tenantName, setTenantName] = useState("");
  const [tenantContact, setTenantContact] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [unitCode, setUnitCode] = useState("");
  const [areaM2, setAreaM2] = useState<number>(0);
  const [monthlyRent, setMonthlyRent] = useState<number>(0);
  const [deposit, setDeposit] = useState<number>(0);
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(nextYearStr);
  const [schedule, setSchedule] = useState<"MONTHLY" | "QUARTERLY" | "ANNUALLY">("MONTHLY");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setTenantName("");
    setTenantContact("");
    setTenantEmail("");
    setUnitCode("");
    setAreaM2(0);
    setMonthlyRent(0);
    setDeposit(0);
    setStartDate(todayStr);
    setEndDate(nextYearStr);
    setNotes("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantName.trim() || !unitCode.trim()) return;
    const rawStart = startDate.trim();
    const rawEnd = endDate.trim();
    const [normStart, normEnd] =
      rawStart && rawEnd && rawStart > rawEnd ? [rawEnd, rawStart] : [rawStart, rawEnd];

    onSubmit({
      tenantName: tenantName.trim(),
      tenantContact: tenantContact.trim(),
      tenantEmail: tenantEmail.trim() || "-",
      unitCode: unitCode.trim(),
      areaSquareMeters: Number(areaM2) || 0,
      monthlyRent: Number(monthlyRent) || 0,
      depositAmount: Number(deposit) || 0,
      startDate: normStart,
      endDate: normEnd,
      paymentSchedule: schedule,
      notes: notes.trim() || undefined,
    });

    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base font-medium">
            <FilePlus className="size-4 text-primary" />
            <span>Tambah kontrak sewa</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Masukkan data tenant, unit komersial, dan rincian nilai sewa kontrak.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 space-y-3.5 overflow-y-auto py-1 pr-1 text-xs">
          <div className="space-y-1.5">
            <Label htmlFor="tenant-name" className="text-xs font-medium text-foreground">
              Nama tenant <span className="text-destructive">*</span>
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
              <Label htmlFor="tenant-contact" className="text-xs font-medium text-foreground">
                Nomor WhatsApp <span className="text-destructive">*</span>
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
              <Label htmlFor="tenant-email" className="text-xs font-medium text-foreground">
                Email tenant
              </Label>
              <Input
                id="tenant-email"
                type="email"
                placeholder="tenant@brand.com"
                value={tenantEmail}
                onChange={(e) => setTenantEmail(e.target.value)}
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="unit-code" className="text-xs font-medium text-foreground">
                Kode unit <span className="text-destructive">*</span>
              </Label>
              <Input
                id="unit-code"
                required
                placeholder="Contoh: Lot A-04"
                value={unitCode}
                onChange={(e) => setUnitCode(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="area-m2" className="text-xs font-medium text-foreground">
                Luas area (m²)
              </Label>
              <Input
                id="area-m2"
                type="number"
                min={1}
                value={areaM2 || ""}
                onChange={(e) => setAreaM2(Number(e.target.value))}
                placeholder="0"
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="monthly-rent" className="text-xs font-medium text-foreground">
                Sewa bulanan (Rp) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="monthly-rent"
                type="number"
                min={0}
                step={100000}
                required
                value={monthlyRent || ""}
                onChange={(e) => setMonthlyRent(Number(e.target.value))}
                placeholder="0"
                className="text-xs font-mono font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deposit-amount" className="text-xs font-medium text-foreground">
                Deposit jaminan (Rp)
              </Label>
              <Input
                id="deposit-amount"
                type="number"
                min={0}
                step={100000}
                value={deposit || ""}
                onChange={(e) => setDeposit(Number(e.target.value))}
                placeholder="0"
                className="text-xs font-mono font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start-date" className="text-xs font-medium text-foreground">
                Tanggal mulai <span className="text-destructive">*</span>
              </Label>
              <Input
                id="start-date"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end-date" className="text-xs font-medium text-foreground">
                Tanggal berakhir <span className="text-destructive">*</span>
              </Label>
              <Input
                id="end-date"
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment-schedule" className="text-xs font-medium text-foreground">
              Jadwal pembayaran
            </Label>
            <NativeSelect
              id="payment-schedule"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value as "MONTHLY" | "QUARTERLY" | "ANNUALLY")}
              className="w-full text-xs"
            >
              <option value="MONTHLY">Bulanan</option>
              <option value="QUARTERLY">Triwulan</option>
              <option value="ANNUALLY">Tahunan</option>
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lease-notes" className="text-xs font-medium text-foreground">Catatan kontrak</Label>
            <Textarea
              id="lease-notes"
              rows={2}
              placeholder="Ketentuan renovasi, jam operasional tenant, atau garansi..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs"
            />
          </div>

          <DialogFooter className="border-t pt-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleClose}
            >
              Batal
            </Button>
            <Button type="submit" size="lg">
              Simpan kontrak
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
