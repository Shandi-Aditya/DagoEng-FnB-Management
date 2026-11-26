"use client";

import { MapPin, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { spaceTypeLabel } from "@/features/pos/pos-coworking";
import { SpacePhotoThumbnail } from "@/features/coworking/SpacePhotoThumbnail";
import { getSpaceImageUrl } from "@/features/coworking/coworking-domain";
import type { CoworkingSpaceItem } from "@/types/coworking";
import { formatCurrencyIDR } from "@/lib/utils";

interface CoworkingPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  space: CoworkingSpaceItem | null;
  onSelectSpace: (spaceId: string) => void;
}

export function CoworkingPhotoModal({
  isOpen,
  onClose,
  space,
  onSelectSpace,
}: CoworkingPhotoModalProps) {
  if (!space) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md gap-4 p-5">
        <DialogHeader>
          <span className="text-xs text-muted-foreground">
            {spaceTypeLabel(space.type)}
          </span>
          <DialogTitle className="text-base font-medium">
            {space.name}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              <span>{space.area}</span>
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" />
              <span>Kapasitas {space.capacity} tamu</span>
            </span>
          </DialogDescription>
        </DialogHeader>

        <SpacePhotoThumbnail
          src={getSpaceImageUrl(space)}
          alt={space.name}
          aspectRatio="aspect-video"
          className="border"
        />

        {space.description && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {space.description}
          </p>
        )}

        {space.amenities && space.amenities.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-foreground">
              Fasilitas
            </span>
            <div className="flex flex-wrap gap-1.5">
              {space.amenities.map((amenity: string, index: number) => (
                <span
                  key={index}
                  className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {amenity}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border pt-3">
          <div>
            <span className="font-mono text-sm font-medium tabular-nums text-foreground">
              {formatCurrencyIDR(space.hourlyRate)}
            </span>
            <span className="text-xs text-muted-foreground"> /jam</span>
          </div>

          <DialogFooter className="gap-2 sm:space-x-0">
            <Button type="button" variant="outline" size="lg" onClick={onClose}>
              Tutup
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={() => {
                onSelectSpace(space.id);
                onClose();
              }}
            >
              Pilih ruang ini
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
