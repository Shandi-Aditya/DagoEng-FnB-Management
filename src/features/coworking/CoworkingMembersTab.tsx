import { useState, useMemo } from "react";
import { Search, Users, ChevronLeft, ChevronRight } from "lucide-react";
import type { CoworkingMember } from "@/types/coworking";
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
import { getMemberStatusTone } from "./coworking-domain";

export interface CoworkingMembersTabProps {
  members: CoworkingMember[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: "ALL" | "ACTIVE" | "EXPIRED";
  onStatusFilterChange: (status: "ALL" | "ACTIVE" | "EXPIRED") => void;
}

export function CoworkingMembersTab({
  members,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: CoworkingMembersTabProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const isFiltered = searchQuery.trim() !== "" || statusFilter !== "ALL";

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
              onChange={(e) => {
                onSearchChange(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari member, kontak, atau paket"
              className="h-8 pl-8 text-xs"
            />
          </div>

          <NativeSelect
            value={statusFilter}
            onChange={(e) => {
              onStatusFilterChange(e.target.value as "ALL" | "ACTIVE" | "EXPIRED");
              setCurrentPage(1);
            }}
            className="h-8 text-xs"
          >
            <option value="ALL">Semua status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="EXPIRED">Kedaluwarsa</option>
          </NativeSelect>

          {isFiltered ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onSearchChange("");
                onStatusFilterChange("ALL");
                setCurrentPage(1);
              }}
              className="h-8 text-xs"
            >
              Reset filter
            </Button>
          ) : null}
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
            </NativeSelect>
          </div>
        </div>
      </div>

      {/* Members Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Member</TableHead>
                <TableHead>Kontak</TableHead>
                <TableHead>Paket</TableHead>
                <TableHead>Periode aktif</TableHead>
                <TableHead>Transaksi</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <EmptyState
                      icon={<Users className="size-6 text-muted-foreground" />}
                      title={isFiltered ? "Tidak ada member yang cocok" : "Belum ada member co-working"}
                      description={
                        isFiltered
                          ? "Coba ubah kata kunci pencarian atau status member."
                          : "Pendaftaran member baru dapat dilakukan melalui tombol Tambah member di atas."
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                paginatedMembers.map((m) => {
                  const statusTone = getMemberStatusTone(m.status);

                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">
                        <div className="space-y-0.5">
                          <p className="font-mono text-primary font-semibold text-xs">
                            {m.memberId}
                          </p>
                          <p className="font-semibold text-foreground">{m.name}</p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-mono text-foreground text-xs">{m.contact}</p>
                          <p className="text-[11px] text-muted-foreground">{m.email}</p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="font-medium text-foreground text-xs">
                          {m.packageName}
                        </span>
                      </TableCell>

                      <TableCell>
                        <p className="font-mono text-xs text-foreground">
                          {m.startDate} s/d {m.expiryDate}
                        </p>
                      </TableCell>

                      <TableCell>
                        <p className="font-mono font-medium tabular-nums text-foreground">
                          {formatCurrencyIDR(m.totalSpent || 0)}
                        </p>
                      </TableCell>

                      <TableCell className="text-right">
                        <StatusBadge status={statusTone}>
                          {m.status === "ACTIVE" ? "Aktif" : "Kedaluwarsa"}
                        </StatusBadge>
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
            member
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
