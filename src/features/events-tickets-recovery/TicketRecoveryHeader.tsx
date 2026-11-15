"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/features/layout/ModeToggle";

export function TicketRecoveryHeader() {
  return (
    <header className="flex items-center justify-between pb-4 border-b border-border">
      <Link href="/events">
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          <span>Kembali ke Daftar Event</span>
        </Button>
      </Link>
      <ModeToggle />
    </header>
  );
}
