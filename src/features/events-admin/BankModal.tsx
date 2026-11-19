"use client";

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
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export interface BankFormData {
  label: string;
  bankName: string;
  customBankName?: string;
  accountNumber: string;
  accountHolder: string;
  branch: string;
  badge: string;
  isDefault: boolean;
}

export interface BankModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEdit?: boolean;
  formData: BankFormData;
  onFormChange: (data: BankFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSaving?: boolean;
}

export function BankModal({
  open,
  onOpenChange,
  isEdit,
  formData,
  onFormChange,
  onSubmit,
  isSaving,
}: BankModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Ubah rekening bank" : "Tambah rekening bank"}</DialogTitle>
          <DialogDescription>
            Rekening resmi platform untuk menerima pembayaran transfer tiket dari pemesan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bankName">Nama bank</Label>
            <NativeSelect
              id="bankName"
              value={formData.bankName}
              onChange={(e) => onFormChange({ ...formData, bankName: e.target.value })}
              required
            >
              <NativeSelectOption value="BCA">BCA (Bank Central Asia)</NativeSelectOption>
              <NativeSelectOption value="Mandiri">Bank Mandiri</NativeSelectOption>
              <NativeSelectOption value="BNI">BNI (Bank Negara Indonesia)</NativeSelectOption>
              <NativeSelectOption value="BRI">BRI (Bank Rakyat Indonesia)</NativeSelectOption>
              <NativeSelectOption value="BSI">BSI (Bank Syariah Indonesia)</NativeSelectOption>
              <NativeSelectOption value="CIMB">CIMB Niaga</NativeSelectOption>
              <NativeSelectOption value="Permata">Bank Permata</NativeSelectOption>
              <NativeSelectOption value="Other">Lainnya</NativeSelectOption>
            </NativeSelect>
          </div>

          {formData.bankName === "Other" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customBankName">Nama bank kustom</Label>
              <Input
                id="customBankName"
                type="text"
                placeholder="Masukkan nama bank"
                value={formData.customBankName || ""}
                onChange={(e) => onFormChange({ ...formData, customBankName: e.target.value })}
                required
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="accountNumber">Nomor rekening</Label>
            <Input
              id="accountNumber"
              type="text"
              placeholder="Contoh: 1234567890"
              value={formData.accountNumber}
              onChange={(e) => onFormChange({ ...formData, accountNumber: e.target.value })}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="accountHolder">Atas nama pemilik</Label>
            <Input
              id="accountHolder"
              type="text"
              placeholder="Contoh: PT DAGO KREATIF BERSAMA"
              value={formData.accountHolder}
              onChange={(e) => onFormChange({ ...formData, accountHolder: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="branch">Cabang (opsional)</Label>
              <Input
                id="branch"
                type="text"
                placeholder="Contoh: Singaraja"
                value={formData.branch}
                onChange={(e) => onFormChange({ ...formData, branch: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="label">Label (opsional)</Label>
              <Input
                id="label"
                type="text"
                placeholder="Contoh: Rekening Operasional"
                value={formData.label}
                onChange={(e) => onFormChange({ ...formData, label: e.target.value })}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-xs text-foreground pt-1">
            <input
              type="checkbox"
              checked={formData.isDefault}
              onChange={(e) => onFormChange({ ...formData, isDefault: e.target.checked })}
              className="rounded border"
            />
            <span>Jadikan sebagai rekening pembayaran utama</span>
          </label>

          <DialogFooter className="border-t pt-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Batal
            </Button>
            <Button type="submit" size="lg" disabled={isSaving}>
              {isSaving ? "Menyimpan…" : isEdit ? "Perbarui rekening" : "Simpan rekening"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
