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
import { getTierHint } from "./customers-domain";

export interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  canSetInitialPoints?: boolean;
  onSubmit: (data: {
    name: string;
    phone: string;
    email?: string;
    identityNo?: string;
    initialPoints: number;
  }) => void;
}

export function AddCustomerModal({
  isOpen,
  onClose,
  canSetInitialPoints = true,
  onSubmit,
}: AddCustomerModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [identityNo, setIdentityNo] = useState("");
  const [initialPoints, setInitialPoints] = useState(0);

  const resetForm = () => {
    setName("");
    setPhone("");
    setEmail("");
    setIdentityNo("");
    setInitialPoints(0);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    onSubmit({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      identityNo: identityNo.trim() || undefined,
      initialPoints: canSetInitialPoints ? Math.max(0, initialPoints) : 0,
    });

    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-medium">
            <UserPlus className="size-4 text-primary" />
            <span>Tambah member</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Tier member ditentukan otomatis berdasarkan saldo poin awal.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Tier dihitung dari poin</p>
            <p>
              Tier awal dihitung otomatis dari saldo poin. 0 poin menghasilkan tier Bronze.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="customer-name" className="text-xs font-medium text-foreground">
              Nama lengkap <span className="text-destructive">*</span>
            </Label>
            <Input
              id="customer-name"
              required
              placeholder="Misalnya Gusti Ngurah Bagus"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="customer-phone" className="text-xs font-medium text-foreground">
              Nomor WhatsApp <span className="text-destructive">*</span>
            </Label>
            <Input
              id="customer-phone"
              required
              placeholder="Contoh: 081234567890"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="text-xs font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="customer-email" className="text-xs font-medium text-foreground">
                Email (opsional)
              </Label>
              <Input
                id="customer-email"
                type="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-xs font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customer-id" className="text-xs font-medium text-foreground">
                Nomor identitas (opsional)
              </Label>
              <Input
                id="customer-id"
                placeholder="510801xxxxxx"
                value={identityNo}
                onChange={(e) => setIdentityNo(e.target.value)}
                className="text-xs font-mono"
              />
            </div>
          </div>

          {canSetInitialPoints ? (
            <div className="space-y-1.5">
              <Label htmlFor="customer-points" className="text-xs font-medium text-foreground">
                Poin awal
              </Label>
              <Input
                id="customer-points"
                type="number"
                min={0}
                step={50}
                value={initialPoints}
                onChange={(e) => setInitialPoints(Number(e.target.value))}
                className="text-xs font-mono font-medium"
              />
              <p className="text-xs text-muted-foreground">
                {getTierHint(initialPoints)}
              </p>
            </div>
          ) : null}

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
              Simpan member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
