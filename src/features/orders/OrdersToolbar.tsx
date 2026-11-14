"use client";

import { ChevronDown, Download, FileSpreadsheet, FileText, Search } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ORDER_QUEUES, type OrderQueueId } from "./orders-queue";

interface OrdersToolbarProps {
  queue: OrderQueueId;
  onQueueChange: (queue: OrderQueueId) => void;
  counts: Record<OrderQueueId, number>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  canExport: boolean;
  onExportExcel: () => void;
  onExportCSV: () => void;
  onOpenPDF: () => void;
}

export function OrdersToolbar({
  queue,
  onQueueChange,
  counts,
  searchQuery,
  onSearchChange,
  canExport,
  onExportExcel,
  onExportCSV,
  onOpenPDF,
}: OrdersToolbarProps) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Pesanan"
        description={
          counts.UNPAID > 0 ? `${counts.UNPAID} pesanan menunggu pembayaran` : "Semua pesanan aktif sudah dibayar"
        }
        actions={
          canExport ? (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="lg" />}>
                <Download />
                Ekspor
                <ChevronDown className="text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onExportExcel}>
                  <FileSpreadsheet />
                  Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onExportCSV}>
                  <Download />
                  CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenPDF}>
                  <FileText />
                  Laporan PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null
        }
      />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="max-w-full overflow-x-auto no-scrollbar">
          <Tabs value={queue} onValueChange={(value) => onQueueChange(value as OrderQueueId)}>
            <TabsList aria-label="Antrean pesanan">
              {ORDER_QUEUES.map((item) => (
                <TabsTrigger key={item.id} value={item.id}>
                  {item.label}
                  <Badge variant="secondary" className="ml-1 tabular-nums">
                    {counts[item.id]}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <InputGroup className="xl:max-w-xs">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari nomor, meja, atau nama"
            aria-label="Cari pesanan"
          />
        </InputGroup>
      </div>
    </div>
  );
}
