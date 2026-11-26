"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { Laptop } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIMIZED_IMAGE_HOSTS = new Set([
  "images.unsplash.com",
  "upload.wikimedia.org",
]);

function isAllowedOptimizedImageSrc(src: string): boolean {
  if (src.startsWith("/") && !src.startsWith("//")) {
    return true;
  }
  try {
    const parsed = new URL(src);
    return (
      parsed.protocol === "https:" &&
      OPTIMIZED_IMAGE_HOSTS.has(parsed.hostname)
    );
  } catch {
    return false;
  }
}

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
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const imageRef = useCallback(
    (node: HTMLImageElement | null) => {
      if (src && node?.complete && node.naturalWidth === 0) {
        setFailedSrc(src);
      }
    },
    [src]
  );

  const hasError = !src || failedSrc === src;

  if (hasError) {
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
        ref={imageRef}
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized={!isAllowedOptimizedImageSrc(src)}
        onError={() => setFailedSrc(src)}
        className="object-cover"
      />
    </div>
  );
}
