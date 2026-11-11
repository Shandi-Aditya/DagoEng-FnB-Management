"use client";

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import type { LoyaltyMember, LoyaltyTier } from "@/types/loyalty";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";

export interface TierOverrideModalProps {
  member: LoyaltyMember | null;
  onClose: () => void;
  onSubmit: (memberId: string, tier: LoyaltyTier, reason: string) => void;
}

export function TierOverrideModal({
  member,
  onClose,
  onSubmit,
}: TierOverrideModalProps) {
  const [tier, setTier] = useState<LoyaltyTier>("Gold");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (member) {
      setTier(member.tier);
      setReason("");
    }
  }, [member]);

  if (!member) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    onSubmit(member.id, tier, reason.trim());
    onClose();
  };

  return (
    <Dialog open={Boolean(member)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-medium">
            <ShieldAlert className="size-4 text-primary" />
            <span>Ubah tier manual</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Tier biasanya dihitung dari poin. Gunakan menu ini hanya untuk pengecualian khusus.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Tercatat di log aktivitas</p>
            <p>
              Nama akun Anda dan alasan pengubahan tier akan tercatat di log audit.
            </p>
          </div>

          <div className="space-y-1 text-xs">
            <p className="text-muted-foreground">Member</p>
            <p className="text-sm font-medium text-foreground">
              {member.name}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (Tier saat ini: {member.tier}, {member.points.toLocaleString("id-ID")} poin)
              </span>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="override-tier" className="text-xs font-medium text-foreground">
              Pilih tier baru
            </Label>
            <NativeSelect
              id="override-tier"
              value={tier}
              onChange={(e) => setTier(e.target.value as LoyaltyTier)}
              className="w-full text-xs"
            >
              <option value="Bronze">Bronze (0–499 poin)</option>
              <option value="Silver">Silver (500–1.499 poin)</option>
              <option value="Gold">Gold (1.500–2.999 poin)</option>
              <option value="Platinum">Platinum (3.000+ poin)</option>
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="override-reason" className="text-xs font-medium text-foreground">
              Alasan pengubahan <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="override-reason"
              required
              rows={3}
              placeholder="Misalnya tamu VIP acara peluncuran"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="text-xs"
            />
          </div>

          <DialogFooter className="gap-2 border-t pt-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              Batal
            </Button>
            <Button type="submit" size="sm">
              Simpan perubahan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
