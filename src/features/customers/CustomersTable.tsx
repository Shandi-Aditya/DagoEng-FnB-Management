"use client";

import { useEffect, useMemo, useState } from "react";
import { Crown, History, Search, UserCheck } from "lucide-react";

import { DataPagination } from "@/components/app/data-pagination";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LoyaltyMember } from "@/types/loyalty";
import { formatCurrencyIDR } from "@/lib/utils";

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

  const emptyCopy = emptyCustomerMessage(isFiltered);

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <InputGroup className="max-w-xs flex-1">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Cari nama, WhatsApp, email, atau tier"
              aria-label="Cari member"
            />
          </InputGroup>

          {onTierFilterChange && (
            <NativeSelect
              value={tierFilter}
              onChange={(e) => onTierFilterChange(e.target.value)}
              aria-label="Filter tier loyalty"
            >
              {TIER_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </NativeSelect>
          )}

          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
            >
              Reset filter
            </Button>
          )}
        </div>
      </div>

      {/* Table Card */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[260px]">Member</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Poin</TableHead>
                <TableHead>Belanja dan kunjungan</TableHead>
                <TableHead className="hidden md:table-cell">Bergabung</TableHead>
                <TableHead className="text-center">Riwayat</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Aksi</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center">
                    <EmptyState
                      icon={<UserCheck className="size-8 text-muted-foreground" />}
                      title={emptyCopy.title}
                      description={
                        searchQuery
                          ? `Tidak ada member yang cocok dengan "${searchQuery}".`
                          : emptyCopy.description
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                paginatedMembers.map((c) => {
                  const historyCount = c.pointHistory.length + c.tierHistory.length;
                  const tone = getTierTone(c.tier);

                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <div className="space-y-0.5">
                          <p className="leading-snug text-foreground">{c.name}</p>
                          <p className="font-mono text-xs text-muted-foreground">{c.phone}</p>
                          {c.email && (
                            <p className="text-xs text-muted-foreground">{c.email}</p>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={tone} className="inline-flex items-center gap-1">
                          <Crown className="size-3" />
                          <span>{c.tier}</span>
                        </StatusBadge>
                      </TableCell>

                      <TableCell className="text-right font-mono font-medium tabular-nums text-foreground">
                        {c.points.toLocaleString("id-ID")} Pts
                      </TableCell>

                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-mono text-xs font-medium tabular-nums text-foreground">
                            {formatCurrencyIDR(c.totalSpend)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {c.totalVisits} kunjungan
                          </p>
                        </div>
                      </TableCell>

                      <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground md:table-cell">
                        {c.joinedDate || "—"}
                      </TableCell>

                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onSelectMemberHistory(c)}
                        >
                          <History />
                          <span>Riwayat ({historyCount})</span>
                        </Button>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onAddPointsQuick(c.id, c.name)}
                          >
                            + 20 Pts
                          </Button>

                          {isOwnerOrAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onSelectMemberOverride(c)}
                            >
                              Ubah tier
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination Bar */}
      {members.length > 0 && (
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
      )}
    </div>
  );
}
