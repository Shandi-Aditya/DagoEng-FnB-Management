"use client";

import { CheckCircle2, Search, Wallet, XCircle } from "lucide-react";
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
import type { PayoutRecord } from "@/types/event";
import {
  EventDateRangeFilter,
  isTimestampInWitaPeriod,
  type DateRange,
} from "@/components/events/EventDateRangeFilter";
import { formatCurrencyIDR } from "@/lib/utils";
import {
  formatDateSafe,
  payoutStatusLabel,
  payoutStatusTone,
} from "./events-admin-domain";

export interface EnrichedPayoutRecord extends PayoutRecord {
  eventTitle?: string;
  organizerName?: string;
}

export interface EventsPayoutsTableProps {
  payouts: EnrichedPayoutRecord[];
  filterStatus: string;
  onFilterStatusChange: (status: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  dateRange?: DateRange | null;
  onDateRangeChange?: (range: DateRange | null) => void;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onActionClick: (target: {
    id: string;
    eventId?: string;
    status: "PROCESSING" | "PAID" | "REJECTED";
    amount?: number;
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
    organizerName?: string;
    eventTitle?: string;
  }) => void;
  isProcessing?: boolean;
}

export function EventsPayoutsTable({
  payouts,
  filterStatus,
  onFilterStatusChange,
  searchQuery,
  onSearchChange,
  dateRange = null,
  onDateRangeChange,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onActionClick,
  isProcessing,
}: EventsPayoutsTableProps) {
  const needle = searchQuery.trim().toLowerCase();

  const filtered = payouts.filter((p) => {
    if (filterStatus !== "ALL" && p.status !== filterStatus) return false;
    if (dateRange && !isTimestampInWitaPeriod(p.requestedAt, dateRange)) return false;
    if (needle) {
      const matchTitle = p.eventTitle?.toLowerCase().includes(needle);
      const matchOrg = p.organizerName?.toLowerCase().includes(needle);
      const matchBank = p.bankName?.toLowerCase().includes(needle);
      const matchAcc = p.accountNumber?.toLowerCase().includes(needle);
      const matchHolder = p.accountHolder?.toLowerCase().includes(needle);
      const matchRef = p.referenceNo?.toLowerCase().includes(needle);
      if (!matchTitle && !matchOrg && !matchBank && !matchAcc && !matchHolder && !matchRef) {
        return false;
      }
    }
    return true;
  });

  const startIndex = (currentPage - 1) * pageSize;
  const pagedPayouts = filtered.slice(startIndex, startIndex + pageSize);
  const hasFilter = Boolean(needle || dateRange || filterStatus !== "ALL");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={filterStatus} onValueChange={onFilterStatusChange}>
          <TabsList className="overflow-x-auto no-scrollbar">
            <TabsTrigger value="ALL">Semua</TabsTrigger>
            <TabsTrigger value="REQUESTED">Diajukan</TabsTrigger>
            <TabsTrigger value="PROCESSING">Diproses</TabsTrigger>
            <TabsTrigger value="PAID">Selesai</TabsTrigger>
            <TabsTrigger value="REJECTED">Ditolak</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2.5 flex-1 lg:justify-end">
          <div className="min-w-[200px] flex-1 sm:max-w-xs">
            <InputGroup>
              <InputGroupAddon align="inline-start">
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                placeholder="Cari event, mitra, bank…"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                aria-label="Cari pencairan saldo"
              />
            </InputGroup>
          </div>

          {onDateRangeChange ? (
            <EventDateRangeFilter
              initialRange={dateRange}
              onApplyFilter={onDateRangeChange}
              label="Periode pengajuan"
              align="right"
            />
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          className="border"
          icon={<Wallet />}
          title={hasFilter ? "Tidak ada pencairan yang cocok" : "Belum ada permohonan pencairan saldo"}
          description={
            searchQuery
              ? `Tidak ditemukan pencairan saldo dengan kata kunci "${searchQuery}".`
              : dateRange
              ? "Tidak ada pengajuan pencairan saldo pada rentang tanggal yang dipilih."
              : "Mitra penyelenggara yang mengajukan penarikan bagi hasil tiket akan muncul di sini."
          }
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Tanggal & ID</TableHead>
                  <TableHead>Event & Penyelenggara</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                  <TableHead className="hidden md:table-cell">Rekening Tujuan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-0 text-right">
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedPayouts.map((p) => {
                  const formattedDate = formatDateSafe(p.requestedAt);
                  const isPending = p.status === "REQUESTED" || p.status === "PROCESSING";

                  return (
                    <TableRow key={p.id}>
                      {/* Tanggal & ID */}
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-xs font-medium text-foreground">
                            {p.id.slice(0, 8)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formattedDate}
                          </span>
                        </div>
                      </TableCell>

                      {/* Event & Penyelenggara */}
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-foreground line-clamp-1">
                            {p.eventTitle || "—"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {p.organizerName || "—"}
                          </span>
                        </div>
                      </TableCell>

                      {/* Nominal */}
                      <TableCell className="text-right">
                        <span className="font-mono text-xs tabular-nums font-medium text-foreground">
                          {formatCurrencyIDR(p.amount)}
                        </span>
                      </TableCell>

                      {/* Rekening Tujuan */}
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-medium text-foreground">
                            {p.bankName || "Bank"} · {p.accountNumber || "—"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            a.n. {p.accountHolder || "—"}
                          </span>
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <StatusBadge status={payoutStatusTone(p.status)}>
                          {payoutStatusLabel(p.status)}
                        </StatusBadge>
                      </TableCell>

                      {/* Aksi */}
                      <TableCell className="text-right">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              onClick={() =>
                                onActionClick({
                                  id: p.id,
                                  eventId: p.eventId,
                                  status: "PAID",
                                  amount: p.amount,
                                  bankName: p.bankName || undefined,
                                  accountNumber: p.accountNumber || undefined,
                                  accountHolder: p.accountHolder || undefined,
                                  organizerName: p.organizerName,
                                  eventTitle: p.eventTitle,
                                })
                              }
                              disabled={isProcessing}
                            >
                              <CheckCircle2 />
                              <span className="hidden sm:inline">Konfirmasi bayar</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                onActionClick({
                                  id: p.id,
                                  eventId: p.eventId,
                                  status: "REJECTED",
                                  amount: p.amount,
                                  organizerName: p.organizerName,
                                  eventTitle: p.eventTitle,
                                })
                              }
                              disabled={isProcessing}
                            >
                              <XCircle />
                              <span className="hidden sm:inline">Tolak</span>
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <DataPagination
            currentPage={currentPage}
            totalItems={filtered.length}
            pageSize={pageSize}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            itemLabel="pencairan"
          />
        </>
      )}
    </div>
  );
}
