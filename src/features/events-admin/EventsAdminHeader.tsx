"use client";

import Link from "next/link";
import { ChevronDown, Download, ExternalLink, PlusCircle, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface EventsAdminHeaderProps {
  onExportData: () => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function EventsAdminHeader({
  onExportData,
  onRefresh,
  isLoading,
}: EventsAdminHeaderProps) {
  return (
    <PageHeader
      title="Event komunitas"
      description="Kelola pengajuan event, verifikasi pembayaran tiket, dan pencairan saldo mitra."
      actions={
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <span>Lainnya</span>
              <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onExportData}>
                <Download />
                <span>Ekspor data</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onRefresh} disabled={isLoading}>
                <RefreshCw className={isLoading ? "animate-spin" : ""} />
                <span>Segarkan data</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <a
                    href="/events"
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <ExternalLink />
                <span>Katalog publik</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="sm"
            render={<Link href="/events/portal?view=submit" />}
            nativeButton={false}
          >
            <PlusCircle />
            <span>Tambah event</span>
          </Button>
        </div>
      }
    />
  );
}
