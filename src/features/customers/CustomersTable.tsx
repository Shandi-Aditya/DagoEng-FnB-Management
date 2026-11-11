import { useState, useMemo, useEffect } from "react";
import {
  Search,
  History,
  Crown,
  ChevronLeft,
  ChevronRight,
  UserCheck,
} from "lucide-react";
import type { LoyaltyMember } from "@/types/loyalty";
import { formatCurrencyIDR } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { getTierTone } from "./customers-domain";

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

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Cari nama, telepon, email, atau tier..."
              className="h-8 pl-8 text-xs"
            />
          </div>

          {onTierFilterChange && (
            <NativeSelect
              value={tierFilter}
              onChange={(e) => onTierFilterChange(e.target.value)}
              className="h-8 text-xs font-medium"
            >
              <option value="ALL">Semua Tier</option>
              <option value="Platinum">Platinum</option>
              <option value="Gold">Gold</option>
              <option value="Silver">Silver</option>
              <option value="Bronze">Bronze</option>
            </NativeSelect>
          )}

          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              Reset filter
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Baris</span>
            <NativeSelect
              value={String(pageSize)}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="h-8 w-16 text-xs font-mono"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </NativeSelect>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[260px]">Nama Pelanggan & Kontak</TableHead>
                <TableHead>Loyalty Tier</TableHead>
                <TableHead className="text-right">Saldo Poin</TableHead>
                <TableHead>Total Belanja & Kunjungan</TableHead>
                <TableHead>Tgl Bergabung</TableHead>
                <TableHead className="text-center">Riwayat & Log</TableHead>
                <TableHead className="text-right">Aksi Khusus</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center">
                    <EmptyState
                      icon={<UserCheck className="w-8 h-8 text-muted-foreground" />}
                      title="Tidak ada data pelanggan"
                      description={
                        searchQuery
                          ? `Tidak ditemukan pelanggan yang cocok dengan kata kunci "${searchQuery}".`
                          : "Belum ada pelanggan terdaftar di outlet ini."
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
                          <p className="text-foreground leading-snug">{c.name}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">{c.phone}</p>
                          {c.email && (
                            <p className="text-[11px] text-muted-foreground">{c.email}</p>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={tone} className="gap-1 inline-flex items-center">
                          <Crown className="w-3 h-3" />
                          <span>{c.tier}</span>
                        </StatusBadge>
                      </TableCell>

                      <TableCell className="text-right font-mono font-medium tabular-nums text-foreground">
                        {c.points.toLocaleString("id-ID")} Pts
                      </TableCell>

                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-medium text-foreground tabular-nums">
                            {formatCurrencyIDR(c.totalSpend)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {c.totalVisits} Kunjungan
                          </p>
                        </div>
                      </TableCell>

                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {c.joinedDate || "-"}
                      </TableCell>

                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onSelectMemberHistory(c)}
                          className="h-7 text-xs gap-1.5"
                        >
                          <History className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>Riwayat ({historyCount})</span>
                        </Button>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onAddPointsQuick(c.id, c.name)}
                            className="h-7 px-2 text-xs font-medium"
                          >
                            + 20 Pts
                          </Button>

                          {isOwnerOrAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onSelectMemberOverride(c)}
                              className="h-7 px-2 text-xs font-medium"
                            >
                              Override Tier
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
          <div>
            Menampilkan{" "}
            <span className="font-mono font-medium text-foreground">
              {Math.min((safeCurrentPage - 1) * pageSize + 1, members.length)}
            </span>{" "}
            sampai{" "}
            <span className="font-mono font-medium text-foreground">
              {Math.min(safeCurrentPage * pageSize, members.length)}
            </span>{" "}
            dari{" "}
            <span className="font-mono font-medium text-foreground">
              {members.length}
            </span>{" "}
            pelanggan
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
              className="size-8"
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="px-2 font-mono text-xs">
              {safeCurrentPage} / {totalPages}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="size-8"
              aria-label="Halaman berikutnya"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
