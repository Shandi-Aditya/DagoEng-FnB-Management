"use client";

import React from "react";
import { organizerSharePercent } from "./events-portal-groups";
import {
  Check,
  X,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CommunityEvent } from "@/types/event";
import { formatDateSafe } from "./events-portal-domain";

interface OrganizerRevenueSplitDialogProps {
  event: CommunityEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  splitOrgPercent: number;
  setSplitOrgPercent: (v: number) => void;
  splitPlatPercent: number;
  setSplitPlatPercent: (v: number) => void;
  splitReason: string;
  setSplitReason: (v: string) => void;
  onRespondSplit: (event: CommunityEvent, action: "ACCEPT" | "REJECT") => void;
  onProposeSplit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
}

export function OrganizerRevenueSplitDialog({
  event,
  open,
  onOpenChange,
  splitOrgPercent,
  setSplitOrgPercent,
  splitPlatPercent,
  setSplitPlatPercent,
  splitReason,
  setSplitReason,
  onRespondSplit,
  onProposeSplit,
  isSubmitting,
}: OrganizerRevenueSplitDialogProps) {
  if (!event) return null;

  const currentOrgPercent = organizerSharePercent(event);
  const currentPlatPercent = 100 - currentOrgPercent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">
            Skema & Negosiasi Bagi Hasil Tiket
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {event.title} &bull; Rasio aktif: Komunitas {currentOrgPercent}% / Dago {currentPlatPercent}%
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-xs">
          {/* Active Proposal from Platform */}
          {event.proposedRevenueSplit && (
            <div className="rounded-lg border border-info/40 bg-info/10 p-4 space-y-3">
              <div className="flex items-center gap-1.5 font-medium text-info">
                <TrendingUp className="size-4 shrink-0" />
                <span>Tawaran Penyesuaian Rasio dari Dago Hub:</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">
                  Penyelenggara {event.proposedRevenueSplit.organizerPercent}% : Dago {event.proposedRevenueSplit.platformPercent}%
                </span>
                <span className="text-xs text-muted-foreground">
                  Pengaju: {event.proposedRevenueSplit.proposedBy === "ORGANIZER" ? "Penyelenggara" : "Admin Dago"}
                </span>
              </div>
              <p className="text-muted-foreground leading-relaxed italic">
                Alasan: &ldquo;{event.proposedRevenueSplit.reason || "Penyesuaian bagi hasil operasional."}&rdquo;
              </p>

              {event.proposedRevenueSplit.proposedBy !== "ORGANIZER" ? (
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="default"
                    disabled={isSubmitting}
                    onClick={() => onRespondSplit(event, "ACCEPT")}
                  >
                    <Check />
                    <span>Setujui kesepakatan</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isSubmitting}
                    onClick={() => onRespondSplit(event, "REJECT")}
                    className="text-destructive"
                  >
                    <X />
                    <span>Tolak tawaran</span>
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Usulan Anda sedang ditinjau kurator Dago Hub. Anda akan menerima notifikasi jika disetujui atau diajukan penawaran tandingan.
                </p>
              )}
            </div>
          )}

          {/* Form to Propose New Split */}
          <form onSubmit={onProposeSplit} className="space-y-3.5 pt-2 border-t">
            <span className="font-medium text-foreground block">
              Ajukan Penyesuaian Bagi Hasil Baru
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-medium text-foreground">Hak Komunitas (%) (50–100%)</label>
                <input
                  type="number"
                  min={50}
                  max={100}
                  step={1}
                  required
                  value={splitOrgPercent}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw.includes(".") || raw.includes(",")) return;
                    const num = Number(raw);
                    if (!Number.isSafeInteger(num)) return;
                    const val = Math.min(100, Math.max(50, num));
                    setSplitOrgPercent(val);
                    setSplitPlatPercent(100 - val);
                  }}
                  className="w-full h-9 rounded-md border bg-background px-3 text-xs font-mono font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-foreground">Bagi Hasil Dago Hub (%) (0–50%)</label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  step={1}
                  required
                  value={splitPlatPercent}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw.includes(".") || raw.includes(",")) return;
                    const num = Number(raw);
                    if (!Number.isSafeInteger(num)) return;
                    const val = Math.min(50, Math.max(0, num));
                    setSplitPlatPercent(val);
                    setSplitOrgPercent(100 - val);
                  }}
                  className="w-full h-9 rounded-md border bg-background px-3 text-xs font-mono font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-medium text-foreground">Catatan / Alasan penyesuaian rasio</label>
              <textarea
                rows={2}
                required
                value={splitReason}
                onChange={(e) => setSplitReason(e.target.value)}
                placeholder="Contoh: Pemakaian panggung utama & audio gear khusus, kolaborasi perdana..."
                className="w-full rounded-md border bg-background p-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring resize-y"
              />
            </div>

            <div className="flex justify-end pt-1">
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? <RefreshCw className="size-3.5 animate-spin" /> : null}
                <span>Kirim usulan bagi hasil</span>
              </Button>
            </div>
          </form>

          {/* Revenue Split History */}
          {event.revenueSplitHistory && event.revenueSplitHistory.length > 0 && (
            <div className="space-y-2 pt-3 border-t">
              <span className="font-medium text-foreground block">
                Riwayat Kesepakatan Bagi Hasil
              </span>
              <div className="overflow-hidden rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Rasio (Org / Dago)</TableHead>
                      <TableHead>Pengaju</TableHead>
                      <TableHead>Alasan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {event.revenueSplitHistory.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateSafe(h.effectiveDate)}
                        </TableCell>
                        <TableCell className="text-xs font-mono font-medium">
                          {h.agreedOrganizerPercent ?? h.newOrganizerPercent}% / {h.agreedPlatformPercent ?? h.newPlatformPercent}%
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {h.proposedBy === "ORGANIZER" ? "Penyelenggara" : "Admin Dago"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                          {h.reason || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Tutup
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
