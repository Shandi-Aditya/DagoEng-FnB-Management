"use client";

import { useEffect, useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import type { CoworkingMembershipPlan } from "@/types/coworking";
import { MEMBERSHIP_PLANS } from "./coworking-data";
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
  plans?: CoworkingMembershipPlan[];
  onSubmit: (params: {
    name: string;
    contact: string;
    email: string;
    packageName: string;
    planId?: string;
    validityDays?: number;
    creditHours?: number;
    totalSpent: number;
    paymentMethod: string;
  }) => void;
}

export function NewMemberModal({
  isOpen,
  onClose,
  plans,
  onSubmit,
}: NewMemberModalProps) {
  const availablePlans = useMemo(
    () => (plans && plans.length > 0 ? plans : MEMBERSHIP_PLANS),
    [plans]
  );

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState(
    availablePlans[0]?.id || ""
  );
  const [paymentMethod, setPaymentMethod] = useState("QRIS");

  useEffect(() => {
    if (
      availablePlans.length > 0 &&
      !availablePlans.some((p) => p.id === selectedPlanId)
    ) {
      setSelectedPlanId(availablePlans[0].id);
    }
  }, [availablePlans, selectedPlanId]);

  const selectedPlan = useMemo(
    () =>
      availablePlans.find((p) => p.id === selectedPlanId) || availablePlans[0],
    [availablePlans, selectedPlanId]
  );

  const resetForm = () => {
    setName("");
    setPhone("");
    setEmail("");
    setSelectedPlanId(availablePlans[0]?.id || "");
    setPaymentMethod("QRIS");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !selectedPlan) return;

    onSubmit({
      name: name.trim(),
      contact: phone.trim(),
      email: email.trim() || "-",
      packageName: selectedPlan.name,
      planId: selectedPlan.id,
      validityDays: selectedPlan.validityDays,
      creditHours: selectedPlan.creditHours,
      totalSpent: selectedPlan.priceNumber,
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
              value={selectedPlan?.id || ""}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="w-full text-xs"
            >
              {availablePlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} ({plan.priceFormatted} · {plan.billingCycle})
                </option>
              ))}
            </NativeSelect>
            {selectedPlan ? (
              <p className="text-xs text-muted-foreground">
                {selectedPlan.creditHours ? `Kuota ${selectedPlan.creditHours} jam · ` : ""}
                Masa aktif {selectedPlan.validityDays ?? 30} hari · {selectedPlan.fnbPerk}
              </p>
            ) : null}
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
            <Button type="submit" size="lg" disabled={!selectedPlan}>
              Simpan member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
