"use client";

import { Check, Eye } from "lucide-react";

import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import type { CoworkingSpaceItem } from "@/types/coworking";
import { cn, formatCurrencyIDR } from "@/lib/utils";

interface CoworkingRoomCardProps {
  space: CoworkingSpaceItem;
  isAvailable: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onPreviewPhoto?: () => void;
}

function formatSpaceType(type: string): string {
  switch (type) {
    case "HOT_DESK":
      return "Hot desk";
    case "DEDICATED_DESK":
      return "Dedicated desk";
    case "MEETING_ROOM":
      return "Meeting room";
    case "PRIVATE_POD":
      return "Private pod";
    default:
      return type.replace("_", " ").toLowerCase();
  }
}

/** Room card tile in the co-working booking grid. Real interactive button. */
export function CoworkingRoomCard({
  space,
  isAvailable,
  isSelected,
  onSelect,
  onPreviewPhoto,
}: CoworkingRoomCardProps) {
  return (
    <button
      type="button"
      disabled={!isAvailable}
      onClick={onSelect}
      className={cn(
        "group flex min-h-[110px] flex-col justify-between rounded-xl border p-3.5 text-left transition-colors touch-manipulation",
        !isAvailable && "cursor-not-allowed border-border bg-muted/40 opacity-60",
        isAvailable && !isSelected && "border-border bg-card hover:border-primary/50 hover:bg-accent/40",
        isSelected && "border-primary bg-primary/5 ring-1 ring-primary"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="block text-xs text-muted-foreground">
            {formatSpaceType(space.type)}
          </span>
          <h4 className="truncate text-sm font-medium text-foreground">
            {space.name}
          </h4>
        </div>
        <StatusBadge status={isAvailable ? "success" : "destructive"}>
          {isAvailable ? "Tersedia" : "Terisi"}
        </StatusBadge>
      </div>

      <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs">
        <div>
          <span className="font-mono font-medium tabular-nums text-foreground">
            {formatCurrencyIDR(space.hourlyRate)}
          </span>
          <span className="text-muted-foreground"> /jam</span>
        </div>

        <div className="flex items-center gap-1.5">
          {space.imageUrl && onPreviewPhoto && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                onPreviewPhoto();
              }}
              title={`Lihat foto ${space.name}`}
              aria-label={`Lihat foto ${space.name}`}
            >
              <Eye className="size-3.5 text-muted-foreground group-hover:text-foreground" />
            </Button>
          )}

          {isSelected && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              <Check className="size-3.5" />
              <span>Dipilih</span>
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
