"use client";

import { Check, Eye } from "lucide-react";

import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { spaceTypeLabel } from "@/features/pos/pos-coworking";
import { SpacePhotoThumbnail } from "@/features/coworking/SpacePhotoThumbnail";
import { getSpaceImageUrl } from "@/features/coworking/coworking-domain";
import type { CoworkingSpaceItem } from "@/types/coworking";
import { cn, formatCurrencyIDR } from "@/lib/utils";

interface CoworkingRoomCardProps {
  space: CoworkingSpaceItem;
  isAvailable: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onPreviewPhoto?: () => void;
}

/** Room card tile in the co-working booking grid. Real interactive button. */
export function CoworkingRoomCard({
  space,
  isAvailable,
  isSelected,
  onSelect,
  onPreviewPhoto,
}: CoworkingRoomCardProps) {
  const photoSrc = getSpaceImageUrl(space);

  return (
    <div
      className={cn(
        "group flex flex-col justify-between rounded-xl border p-3 text-left transition-colors touch-manipulation gap-2.5",
        !isAvailable && "cursor-not-allowed border-border bg-muted/40 opacity-60",
        isAvailable && !isSelected && "border-border bg-card hover:border-primary/50 hover:bg-accent/40",
        isSelected && "border-primary bg-primary/5 ring-1 ring-primary"
      )}
    >
      <button
        type="button"
        disabled={!isAvailable}
        onClick={onSelect}
        className={cn(
          "flex flex-col gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg cursor-pointer",
          !isAvailable && "cursor-not-allowed"
        )}
      >
        <div className="relative w-full">
          <SpacePhotoThumbnail
            src={photoSrc}
            alt={space.name}
            aspectRatio="aspect-video"
            className="rounded-lg shadow-sm"
          />
          <div className="absolute top-2 right-2">
            <StatusBadge status={isAvailable ? "success" : "destructive"}>
              {isAvailable ? "Tersedia" : "Terisi"}
            </StatusBadge>
          </div>
        </div>

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="block text-xs text-muted-foreground">
              {spaceTypeLabel(space.type)}
            </span>
            <h4 className="truncate text-sm font-medium text-foreground">
              {space.name}
            </h4>
          </div>
        </div>
      </button>

      <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs">
        <div>
          <span className="font-mono font-medium tabular-nums text-foreground">
            {formatCurrencyIDR(space.hourlyRate)}
          </span>
          <span className="text-muted-foreground"> /jam</span>
        </div>

        <div className="flex items-center gap-1.5">
          {photoSrc && onPreviewPhoto && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onPreviewPhoto}
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
    </div>
  );
}
