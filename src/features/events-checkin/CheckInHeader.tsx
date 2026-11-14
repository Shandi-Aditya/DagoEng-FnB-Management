"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, LogOut, QrCode, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ModeToggle } from "@/features/layout/ModeToggle";
import { cn } from "@/lib/utils";

interface CheckInHeaderProps {
  officerName?: string;
  officerEmail?: string;
  isHubAdmin: boolean;
  isLoading: boolean;
  onRefresh: () => void;
  onLogout: () => void;
}

export function CheckInHeader({
  officerName,
  officerEmail,
  isHubAdmin,
  isLoading,
  onRefresh,
  onLogout,
}: CheckInHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-md shadow-2xs">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 h-14 sm:h-16 gap-3">
        {/* Left: Desk Title & Officer Info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-9 items-center justify-center rounded-lg border bg-primary/10 text-primary shrink-0">
            <QrCode className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-semibold text-foreground leading-none truncate">
                Meja registrasi
              </h1>
              <Badge variant="secondary" className="text-xs shrink-0">
                Check-in
              </Badge>
            </div>
            {officerName && (
              <p className="mt-1 text-xs text-muted-foreground truncate hidden sm:block">
                Petugas: <span className="font-medium text-foreground">{officerName}</span>
                {officerEmail ? ` (${officerEmail})` : ""}
              </p>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {isHubAdmin && (
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/dashboard" />}
              nativeButton={false}
            >
              <ArrowLeft className="size-3.5" />
              <span className="hidden md:inline">Dashboard</span>
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            title="Segarkan data tiket"
          >
            <RefreshCw className={cn("size-3.5", isLoading && "animate-spin")} />
            <span className="hidden md:inline">Segarkan</span>
          </Button>

          <ModeToggle />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="text-destructive hover:text-destructive"
            title="Keluar dari sesi petugas"
          >
            <LogOut className="size-3.5" />
            <span className="hidden md:inline">Keluar</span>
          </Button>
        </div>
      </div>

      {/* Mobile-only officer info bar */}
      {officerName && (
        <div className="sm:hidden border-t bg-muted/30 px-4 py-1.5 text-xs text-muted-foreground flex items-center justify-between">
          <span className="truncate">
            Petugas: <span className="font-medium text-foreground">{officerName}</span>
          </span>
          <span className="font-mono text-xs truncate max-w-[140px]">{officerEmail}</span>
        </div>
      )}
    </header>
  );
}
