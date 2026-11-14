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

export interface NewMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: {
    name: string;
    contact: string;
    email: string;
    packageName: string;
    totalSpent: number;
    paymentMethod: string;
  }) => void;
}

export function NewMemberModal({
  isOpen,
  onClose,
  onSubmit,
}: NewMemberModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [packageName, setPackageName] = useState("Dedicated Nomad Monthly");
  const [amount, setAmount] = useState(1850000);
  const [paymentMethod, setPaymentMethod] = useState("QRIS");

  const resetForm = () => {
    setName("");
    setPhone("");
    setEmail("");
    setPackageName("Dedicated Nomad Monthly");
    setAmount(1850000);
    setPaymentMethod("QRIS");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handlePackageChange = (pkg: string) => {
    setPackageName(pkg);
    if (pkg === "Dedicated Nomad Monthly") {
      setAmount(1850000);
    } else if (pkg === "Flex 10 Days Pass") {
      setAmount(550000);
    } else {
      setAmount(3500000);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    onSubmit({
      name: name.trim(),
      contact: phone.trim(),
      email: email.trim() || "-",
      packageName,
      totalSpent: amount,
      paymentMethod,
    });

    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-medium">
            <UserPlus className="size-4 text-primary" />
            <span>Tambah member co-working</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Pilih paket membership dan metode pembayaran untuk pendaftaran member.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <Label htmlFor="member-name" className="text-xs font-medium text-foreground">
              Nama lengkap member <span className="text-destructive">*</span>
            </Label>
            <Input
              id="member-name"
              required
              placeholder="Misalnya Made Bagus"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="member-phone" className="text-xs font-medium text-foreground">
                Kontak WhatsApp <span className="text-destructive">*</span>
              </Label>
              <Input
                id="member-phone"
                required
                placeholder="081234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="member-email" className="text-xs font-medium text-foreground">
                Email member (opsional)
              </Label>
              <Input
                id="member-email"
                type="email"
                placeholder="email@nomad.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="member-package" className="text-xs font-medium text-foreground">
              Paket membership
            </Label>
            <NativeSelect
              id="member-package"
              value={packageName}
              onChange={(e) => handlePackageChange(e.target.value)}
              className="w-full text-xs"
            >
              <option value="Dedicated Nomad Monthly">
                Dedicated Nomad Monthly (Rp 1.850.000 / bln)
              </option>
              <option value="Flex 10 Days Pass">
                Flex 10 Days Pass (Rp 550.000)
              </option>
              <option value="Executive Team Pass">
                Executive Team Pass (Rp 3.500.000 / bln)
              </option>
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="member-payment" className="text-xs font-medium text-foreground">
              Metode bayar
            </Label>
            <NativeSelect
              id="member-payment"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full text-xs"
            >
              <option value="QRIS">QRIS</option>
              <option value="TRANSFER">Transfer bank</option>
              <option value="CARD">Kartu kredit</option>
              <option value="CASH">Tunai</option>
            </NativeSelect>
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
              Simpan member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
