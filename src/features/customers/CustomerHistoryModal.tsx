"use client";

import { Crown, History, Star } from "lucide-react";
import type { LoyaltyMember } from "@/types/loyalty";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/status-badge";
import { getTierTone, isEligibleForTierPromotion } from "./customers-domain";

export interface CustomerHistoryModalProps {
  member: LoyaltyMember | null;
  onClose: () => void;
}

export function CustomerHistoryModal({
  member,
  onClose,
}: CustomerHistoryModalProps) {
  if (!member) return null;

  return (
    <Dialog open={Boolean(member)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base font-medium">
            <History className="size-4 text-primary" />
            <span>Riwayat poin dan tier — {member.name}</span>
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span>Tier sekarang:</span>
            <StatusBadge status={getTierTone(member.tier)}>
              {member.tier}
            </StatusBadge>
            <span className="font-mono font-medium tabular-nums text-foreground">
              ({member.points.toLocaleString("id-ID")} poin)
            </span>
            {isEligibleForTierPromotion(member.tier, member.points) ? (
              <span className="text-xs font-medium text-warning">
                • Poin memenuhi syarat kenaikan tier
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto py-1 pr-1 text-xs">
          {/* Tier History Section */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Crown className="size-3.5 text-primary" />
              <span>Riwayat tier</span>
            </div>

            {member.tierHistory.length === 0 ? (
              <p className="rounded-lg border bg-muted/30 p-3 text-xs italic text-muted-foreground">
                Belum ada perubahan tier. Member masih berada pada tier awal.
              </p>
            ) : (
              <div className="space-y-2">
                {member.tierHistory.map((th) => (
                  <div
                    key={th.id}
                    className="space-y-1 rounded-lg border bg-card p-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground">
                        {th.previousTier} →{" "}
                        <span className="font-semibold text-primary">{th.newTier}</span>
                      </p>
                      <span className="font-mono text-xs text-muted-foreground">
                        {th.timestamp.slice(0, 10)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{th.reason}</p>
                    <p className="text-xs text-muted-foreground">Oleh: {th.actorName}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Point Ledger Section */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Star className="size-3.5 text-primary" />
              <span>Riwayat poin</span>
            </div>

            {member.pointHistory.length === 0 ? (
              <p className="rounded-lg border bg-muted/30 p-3 text-xs italic text-muted-foreground">
                Belum ada riwayat transaksi poin.
              </p>
            ) : (
              <div className="divide-y rounded-lg border bg-card text-xs">
                {member.pointHistory.map((ptx) => (
                  <div
                    key={ptx.id}
                    className="flex items-center justify-between gap-3 p-3"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate font-medium text-foreground">{ptx.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        {ptx.actorName} · {ptx.timestamp.slice(0, 10)}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p
                        className={`font-mono font-medium tabular-nums ${
                          ptx.points >= 0 ? "text-success" : "text-destructive"
                        }`}
                      >
                        {ptx.points >= 0 ? `+${ptx.points}` : ptx.points} poin
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        Saldo: {ptx.balanceAfter}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
