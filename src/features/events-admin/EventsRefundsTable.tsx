"use client";

import React, { useState } from "react";
import { RotateCcw, Search, Eye, CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { DataPagination } from "@/components/app/data-pagination";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EventTicketOrder } from "@/types/event";
import { formatCurrencyIDR } from "@/lib/utils";
import { RefundActionDialog } from "./RefundActionDialog";

export interface EventsRefundsTableProps {
  refunds: EventTicketOrder[];
  onRefresh: () => void;
  isProcessing?: boolean;
}

function formatRefundDate(isoDate?: string | null): string {
  if (!isoDate) return "-";
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Makassar",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d) + " WITA";
  } catch {
    return isoDate;
  }
}

export function EventsRefundsTable({
  refunds,
  onRefresh,
  isProcessing = false,
}: EventsRefundsTableProps) {
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedBooking, setSelectedBooking] = useState<EventTicketOrder | null>(null);

  const filteredRefunds = refunds.filter((b) => {
    // 1. Status filter
    if (filterStatus === "REQUESTED" && b.refundStatus !== "REQUESTED") return false;
    if (filterStatus === "APPROVED" && b.refundStatus !== "APPROVED" && b.paymentStatus !== "REFUNDED") return false;
    if (filterStatus === "REJECTED" && b.refundStatus !== "REJECTED") return false;

    // 2. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const code = (b.ticketCode || "").toLowerCase();
      const name = (b.guestName || "").toLowerCase();
      const email = (b.guestEmail || "").toLowerCase();
      const title = (b.eventTitle || "").toLowerCase();
      if (!code.includes(q) && !name.includes(q) && !email.includes(q) && !title.includes(q)) {
        return false;
      }
    }

    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredRefunds.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRefunds = filteredRefunds.slice((safePage - 1) * pageSize, safePage * pageSize);

  const requestedCount = refunds.filter((b) => b.refundStatus === "REQUESTED").length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Tabs
          value={filterStatus}
          onValueChange={(val) => {
            setFilterStatus(val);
            setCurrentPage(1);
          }}
          className="w-full sm:w-auto"
        >
          <TabsList className="w-full justify-start overflow-x-auto no-scrollbar">
            <TabsTrigger value="ALL">Semua ({refunds.length})</TabsTrigger>
            <TabsTrigger value="REQUESTED">
              Menunggu ({requestedCount})
            </TabsTrigger>
            <TabsTrigger value="APPROVED">Disetujui</TabsTrigger>
            <TabsTrigger value="REJECTED">Ditolak</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <InputGroup className="w-full sm:w-64">
            <InputGroupAddon>
              <Search className="size-3.5 text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Cari tiket, nama, acara..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs"
            />
          </InputGroup>
        </div>
      </div>

      {/* Main Table */}
      {filteredRefunds.length === 0 ? (
        <EmptyState
          icon={<RotateCcw className="size-8 text-muted-foreground" />}
          title="Tidak ada pengajuan refund"
          description={
            searchQuery || filterStatus !== "ALL"
              ? "Tidak ada data pengajuan refund yang sesuai dengan filter atau kata kunci pencarian."
              : "Belum ada pengajuan pengembalian dana tiket dari peserta."
          }
          className="border rounded-xl"
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tiket</TableHead>
                <TableHead>Acara & Pemesan</TableHead>
                <TableHead>Rekening Tujuan</TableHead>
                <TableHead className="text-right">Nominal Refund</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRefunds.map((booking) => {
                const refundReq = booking.refundRequest;
                const refundAmount = refundReq?.refundAmount ?? booking.totalPrice;

                return (
                  <TableRow key={booking.id}>
                    {/* Tiket */}
                    <TableCell className="font-mono text-xs">
                      <span className="font-semibold text-foreground block">
                        {booking.ticketCode}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {formatRefundDate(refundReq?.requestedAt || booking.updatedAt)}
                      </span>
                    </TableCell>

                    {/* Acara & Pemesan */}
                    <TableCell className="text-xs">
                      <span className="font-semibold text-foreground block truncate max-w-[200px]" title={booking.eventTitle}>
                        {booking.eventTitle}
                      </span>
                      <span className="text-muted-foreground block">{booking.guestName}</span>
                      <span className="text-muted-foreground block text-xs">{booking.guestEmail}</span>
                    </TableCell>

                    {/* Rekening Tujuan */}
                    <TableCell className="text-xs">
                      {refundReq ? (
                        <>
                          <span className="font-medium text-foreground block">
                            {refundReq.bankName} - {refundReq.accountNumber}
                          </span>
                          <span className="text-muted-foreground block">
                            a.n. {refundReq.accountHolder}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground italic">-</span>
                      )}
                    </TableCell>

                    {/* Nominal */}
                    <TableCell className="text-right text-xs font-mono">
                      <span className="font-semibold text-foreground block tabular-nums">
                        {formatCurrencyIDR(refundAmount)}
                      </span>
                      <span className="text-muted-foreground block text-xs tabular-nums">
                        Bayar: {formatCurrencyIDR(booking.totalPrice)}
                      </span>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="text-center">
                      {booking.refundStatus === "REQUESTED" ? (
                        <StatusBadge status="warning">Menunggu</StatusBadge>
                      ) : booking.refundStatus === "APPROVED" || booking.paymentStatus === "REFUNDED" ? (
                        <StatusBadge status="success">Disetujui</StatusBadge>
                      ) : booking.refundStatus === "REJECTED" ? (
                        <StatusBadge status="destructive">Ditolak</StatusBadge>
                      ) : (
                        <StatusBadge status="neutral">{booking.refundStatus || "NONE"}</StatusBadge>
                      )}
                    </TableCell>

                    {/* Aksi */}
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant={booking.refundStatus === "REQUESTED" ? "default" : "outline"}
                        size="sm"
                        disabled={isProcessing}
                        onClick={() => setSelectedBooking(booking)}
                      >
                        {booking.refundStatus === "REQUESTED" ? (
                          <>
                            <CheckCircle2 className="size-3.5" />
                            <span>Tinjau</span>
                          </>
                        ) : (
                          <>
                            <Eye className="size-3.5" />
                            <span>Detail</span>
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="p-3 border-t">
            <DataPagination
              currentPage={safePage}
              pageSize={pageSize}
              totalItems={filteredRefunds.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </div>
      )}

      {selectedBooking && (
        <RefundActionDialog
          open={Boolean(selectedBooking)}
          onOpenChange={(open) => !open && setSelectedBooking(null)}
          booking={selectedBooking}
          onSuccess={() => {
            setSelectedBooking(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
