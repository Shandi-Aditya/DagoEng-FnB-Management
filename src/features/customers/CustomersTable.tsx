"use client";

import { useEffect, useMemo, useState } from "react";
import { Crown, History, MoreHorizontal, ShieldAlert, Star, UserCheck } from "lucide-react";

import { DataPagination } from "@/components/app/data-pagination";
import { DataTableToolbar } from "@/components/app/data-table-toolbar";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrencyIDR } from "@/lib/utils";
import type { LoyaltyMember } from "@/types/loyalty";

import {
  emptyCustomerMessage,
  getTierTone,
  TIER_OPTIONS,
} from "./customers-domain";

export interface CustomersTableProps {
  members: LoyaltyMember[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  tierFilter?: string;
  onTierFilterChange?: (tier: string) => void;
  isOwnerOrAdmin: boolean;
  onSelectMemberHistory: (member: LoyaltyMember) => void;
  onSelectMemberOverride: (member: LoyaltyMember) => void;
  onAddPointsQuick: (id: string, name: string) => void;
}

export function CustomersTable({
  members,
  searchQuery,
  onSearchChange,
  tierFilter = "ALL",
  onTierFilterChange,
  isOwnerOrAdmin,
  onSelectMemberHistory,
  onSelectMemberOverride,
  onAddPointsQuick,
}: CustomersTableProps) {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [members.length, searchQuery, tierFilter]);

  const isFiltered = searchQuery.trim() !== "" || tierFilter !== "ALL";

  const handleResetFilters = () => {
    onSearchChange("");
    if (onTierFilterChange) {
      onTierFilterChange("ALL");
    }
    setCurrentPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(members.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedMembers = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return members.slice(start, start + pageSize);
  }, [members, safeCurrentPage, pageSize]);

  const emptyCopy = emptyCustomerMessage(isFiltered, searchQuery);

  return (
    <div className="flex flex-col gap-4">
      <DataTableToolbar
        searchValue={searchQuery}
        onSearchChange={onSearchChange}
        searchPlaceholder="Cari nama, WhatsApp, email, atau tier"
        searchAriaLabel="Cari member"
        hasActiveFilters={isFiltered}
        onResetFilters={handleResetFilters}
      >
        {onTierFilterChange ? (
          <NativeSelect
            value={tierFilter}
            onChange={(e) => onTierFilterChange(e.target.value)}
            aria-label="Filter tier loyalty"
          >
            {TIER_OPTIONS.map((opt) => (
              <NativeSelectOption key={opt.id} value={opt.id}>
                {opt.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : null}
      </DataTableToolbar>

      {paginatedMembers.length === 0 ? (
        <EmptyState
          className="border"
          icon={<UserCheck />}
          title={emptyCopy.title}
          description={emptyCopy.description}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="hidden sm:table-cell">Tier</TableHead>
                  <TableHead className="text-right">Poin</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Belanja</TableHead>
                  <TableHead className="hidden lg:table-cell">Bergabung</TableHead>
                  <TableHead className="w-0">
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedMembers.map((c) => {
                  const historyCount = c.pointHistory.length + c.tierHistory.length;
                  const tone = getTierTone(c.tier);

                  return (
                    <TableRow key={c.id}>
                      <TableCell className="whitespace-normal">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-foreground">{c.name}</span>
                          <span className="font-mono text-xs text-muted-foreground tabular-nums">
                            {c.phone}
                          </span>
                          {c.email ? (
                            <span className="text-xs text-muted-foreground">{c.email}</span>
                          ) : null}
                          <span className="text-xs text-muted-foreground sm:hidden">
                            {c.tier} · {c.totalVisits} kunjungan
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="hidden sm:table-cell">
                        <StatusBadge status={tone} className="inline-flex items-center gap-1">
                          <Crown className="size-3" />
                          <span>{c.tier}</span>
                        </StatusBadge>
                      </TableCell>

                      <TableCell className="text-right whitespace-nowrap">
                        <span className="font-mono font-medium tabular-nums text-foreground">
                          {c.points.toLocaleString("id-ID")}
                        </span>{" "}
                        <span className="text-xs text-muted-foreground">poin</span>
                      </TableCell>

                      <TableCell className="hidden md:table-cell text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-mono text-xs font-medium tabular-nums text-foreground">
                            {formatCurrencyIDR(c.totalSpend)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {c.totalVisits} kunjungan
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground lg:table-cell">
                        {c.joinedDate || "—"}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onSelectMemberHistory(c)}
                            aria-label={`Riwayat ${c.name}`}
                          >
                            <History />
                            <span className="hidden sm:inline">Riwayat ({historyCount})</span>
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Aksi lain untuk ${c.name}`}
                                />
                              }
                            >
                              <MoreHorizontal />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onAddPointsQuick(c.id, c.name)}>
                                <Star />
                                Tambah 20 poin
                              </DropdownMenuItem>
                              {isOwnerOrAdmin ? (
                                <DropdownMenuItem onClick={() => onSelectMemberOverride(c)}>
                                  <ShieldAlert />
                                  Ubah tier
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <DataPagination
            currentPage={safeCurrentPage}
            totalItems={members.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
            itemLabel="member"
          />
        </div>
      )}
    </div>
  );
}
