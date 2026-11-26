"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Laptop } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpacePhotoThumbnailProps {
  src?: string;
  alt: string;
  className?: string;
  aspectRatio?: "aspect-video" | "aspect-[4/3]" | "aspect-square";
  sizes?: string;
  priority?: boolean;
}

/**
 * Responsive space/room photo thumbnail with aspect ratio control
 * and graceful fallback placeholder on load errors.
 */
export function SpacePhotoThumbnail({
  src,
  alt,
  className,
  aspectRatio = "aspect-video",
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
  priority = false,
}: SpacePhotoThumbnailProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return (
      <div
        className={cn(
          "flex w-full items-center justify-center rounded-lg border border-border/50 bg-muted/40 text-muted-foreground",
          aspectRatio,
          className
        )}
        aria-hidden="true"
      >
        <div className="flex flex-col items-center gap-1 opacity-50">
          <Laptop className="size-6" />
          <span className="text-xs font-medium">Dago Space</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg bg-muted/30",
        aspectRatio,
        className
      )}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        onError={() => setHasError(true)}
        className="object-cover"
      />
    </div>
  );
}
