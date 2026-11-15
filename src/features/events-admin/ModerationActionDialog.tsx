"use client";

import { CheckCircle2, MessageSquare, XCircle } from "lucide-react";
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
import type { CommunityEvent } from "@/types/event";

export type ModerationActionType = "APPROVE" | "REVISION" | "REJECT" | "ARCHIVE";

export interface ModerationActionDialogProps {
  event: CommunityEvent | null;
  actionType: ModerationActionType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  onConfirm: () => void;
  isProcessing?: boolean;
}

export function ModerationActionDialog({
  event,
  actionType,
  open,
  onOpenChange,
  notes,
  onNotesChange,
  onConfirm,
  isProcessing,
}: ModerationActionDialogProps) {
  if (!event || !actionType) return null;

  const isApprove = actionType === "APPROVE";
  const isRevision = actionType === "REVISION";
  const isReject = actionType === "REJECT";
  const isArchive = actionType === "ARCHIVE";

  const title = isApprove
    ? "Setujui pengajuan event"
    : isRevision
    ? "Minta revisi pengajuan"
    : isReject
    ? "Tolak pengajuan event"
    : "Arsipkan event";

  const description = isApprove
    ? `Event "${event.title}" akan disetujui dan langsung tampil aktif di katalog publik Dago.`
    : isRevision
    ? `Kirimkan catatan perbaikan kepada penyelenggara (${event.organizerName}) agar pengajuan dapat disesuaikan.`
    : isReject
    ? `Pengajuan event "${event.title}" akan ditolak. Penyelenggara akan menerima alasan penolakan ini.`
    : `Event "${event.title}" akan diarsipkan dari daftar event aktif.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {(isRevision || isReject) && (
          <div className="flex flex-col gap-1.5 py-2">
            <Label htmlFor="moderationNotes">
              {isRevision ? "Catatan revisi untuk penyelenggara" : "Alasan penolakan"}
            </Label>
            <Input
              id="moderationNotes"
              type="text"
              placeholder={
                isRevision
                  ? "Contoh: Mohon lengkapi deskripsi dan poster beresolusi tinggi…"
                  : "Contoh: Jadwal bertabrakan dengan agenda internal hub…"
              }
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              required
            />
          </div>
        )}

        <DialogFooter className="border-t pt-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Batal
          </Button>
          <Button
            type="button"
            size="lg"
            variant={isReject ? "destructive" : isApprove ? "default" : "outline"}
            onClick={onConfirm}
            disabled={((isRevision || isReject) && !notes.trim()) || isProcessing}
          >
            {isProcessing ? (
              "Memproses…"
            ) : isApprove ? (
              <>
                <CheckCircle2 />
                <span>Setujui</span>
              </>
            ) : isRevision ? (
              <>
                <MessageSquare />
                <span>Kirim permintaan revisi</span>
              </>
            ) : isReject ? (
              <>
                <XCircle />
                <span>Tolak pengajuan</span>
              </>
            ) : (
              <span>Arsipkan</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
