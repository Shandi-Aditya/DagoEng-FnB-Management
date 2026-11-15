"use client";

import React, { useState } from "react";
import { Check, Copy, MessageCircle, Share2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { PublicCommunityEvent } from "@/types/event";
import { buildShareText } from "./event-detail-domain";

interface EventShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: PublicCommunityEvent | null;
}

export function EventShareDialog({
  open,
  onOpenChange,
  event,
}: EventShareDialogProps) {
  const [copied, setCopied] = useState(false);

  if (!event) return null;

  const eventUrl = typeof window !== "undefined" ? `${window.location.origin}/events/${event.id}` : "";
  const shareData = buildShareText(event.title, eventUrl);

  const handleCopy = async () => {
    if (typeof window !== "undefined" && eventUrl) {
      try {
        await navigator.clipboard.writeText(eventUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Fallback
        window.prompt("Salin tautan event ini:", eventUrl);
      }
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: `Ikuti event "${event.title}" di Dago Creative Hub`,
          url: eventUrl,
        });
      } catch {
        // Cancelled or dismissed
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-unit="event" className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">
            Bagikan Acara Ini
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground truncate">
            {event.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-xs">
          {/* Quick Social Buttons */}
          <div className="grid grid-cols-2 gap-2.5">
            <a
              href={shareData.whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 p-3 rounded-lg border bg-muted/20 hover:bg-muted/50 text-foreground transition-colors font-medium"
            >
              <MessageCircle className="size-4 text-success" />
              <span>WhatsApp</span>
            </a>

            <a
              href={shareData.twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 p-3 rounded-lg border bg-muted/20 hover:bg-muted/50 text-foreground transition-colors font-medium"
            >
              <span className="font-semibold text-sm">𝕏</span>
              <span>Twitter / 𝕏</span>
            </a>
          </div>

          {/* Native Web Share */}
          {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
            <Button
              variant="outline"
              size="lg"
              onClick={handleNativeShare}
              className="w-full"
            >
              <Share2 />
              <span>Bagikan lewat aplikasi lain</span>
            </Button>
          )}

          {/* Copy Link Input */}
          <div className="space-y-1.5 pt-2 border-t">
            <label className="text-muted-foreground block text-xs">
              Tautan langsung
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={eventUrl}
                className="flex-1 h-9 rounded-md border bg-muted/20 px-3 text-xs text-muted-foreground font-mono select-all"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                <span>{copied ? "Tersalin" : "Salin"}</span>
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
          >
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
