"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/features/layout/ModeToggle";
import { notify } from "@/components/app/notify";

interface TicketPassHeaderProps {
  eventId: string;
}

export function TicketPassHeader({ eventId }: TicketPassHeaderProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleShare = () => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(window.location.href);
    setIsCopied(true);
    notify.success("Tautan disalin", "Tautan e-tiket telah disalin ke papan klip.");
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-md shadow-2xs">
      <div className="mx-auto flex max-w-xl items-center justify-between px-4 sm:px-6 h-14">
        <Button
          variant="ghost"
          size="lg"
          render={<Link href={eventId ? `/events/${eventId}` : "/events"} />}
          nativeButton={false}
        >
          <ArrowLeft />
          <span>Detail event</span>
        </Button>

        <div className="flex items-center gap-2">
          <ModeToggle />
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleShare}
            title="Bagikan tautan tiket"
          >
            {isCopied ? <Check className="text-success" /> : <Share2 />}
            <span>{isCopied ? "Disalin" : "Bagikan"}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
