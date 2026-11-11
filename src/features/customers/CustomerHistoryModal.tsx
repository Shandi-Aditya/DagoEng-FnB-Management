import { History, Crown, Star } from "lucide-react";
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
import { getTierTone } from "./customers-domain";

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
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            <span>Riwayat Poin & Tier — {member.name}</span>
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 pt-1">
            <span>Tier sekarang</span>
            <StatusBadge status={getTierTone(member.tier)} className="text-xs">
              {member.tier}
            </StatusBadge>
            <span className="font-mono tabular-nums font-medium text-foreground">
              ({member.points.toLocaleString("id-ID")} Poin)
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1 py-1">
          {/* Tier History Section */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Crown className="w-4 h-4 text-primary" />
              <span>Riwayat tier</span>
            </div>

            {member.tierHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground italic rounded-lg border bg-muted/30 p-3">
                Belum ada perubahan tier. Member masih berada pada tier awal.
              </p>
            ) : (
              <div className="space-y-2">
                {member.tierHistory.map((th) => (
                  <div
                    key={th.id}
                    className="p-3 rounded-lg border bg-card text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground">
                        {th.previousTier} →{" "}
                        <span className="text-primary font-semibold">{th.newTier}</span>
                      </p>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {th.timestamp.slice(0, 10)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{th.reason}</p>
                    <p className="text-[10px] text-muted-foreground">Oleh: {th.actorName}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Point Ledger Section */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Star className="w-4 h-4 text-primary" />
              <span>Riwayat poin</span>
            </div>

            {member.pointHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground italic rounded-lg border bg-muted/30 p-3">
                Belum ada riwayat transaksi poin.
              </p>
            ) : (
              <div className="divide-y rounded-lg border bg-card text-xs">
                {member.pointHistory.map((ptx) => (
                  <div
                    key={ptx.id}
                    className="p-3 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-medium text-foreground truncate">{ptx.reason}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {ptx.actorName} • {ptx.timestamp.slice(0, 10)}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p
                        className={`font-mono font-medium tabular-nums ${
                          ptx.points >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {ptx.points >= 0 ? `+${ptx.points}` : ptx.points} Pts
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        Saldo: {ptx.balanceAfter}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 pt-3 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs"
          >
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
