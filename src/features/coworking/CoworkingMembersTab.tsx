"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";

import { DataPagination } from "@/components/app/data-pagination";
import { DataTableToolbar } from "@/components/app/data-table-toolbar";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
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
import type { CoworkingMember } from "@/types/coworking";

import {
  emptyCoworkingMessage,
  filterCoworkingMembers,
  getMemberStatusTone,
} from "./coworking-domain";

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

  const filteredMembers = useMemo(
    () => filterCoworkingMembers(members, statusFilter, searchQuery),
    [members, statusFilter, searchQuery]
  );

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedMembers = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredMembers.slice(start, start + pageSize);
  }, [filteredMembers, safeCurrentPage, pageSize]);

  const emptyCopy = emptyCoworkingMessage("MEMBERS", isFiltered);

  return (
    <div className="flex flex-col gap-4">
      <DataTableToolbar
        searchValue={searchQuery}
        onSearchChange={(val) => {
          onSearchChange(val);
          setCurrentPage(1);
        }}
        searchPlaceholder="Cari member, kontak, atau paket"
        searchAriaLabel="Cari member"
        hasActiveFilters={isFiltered}
        onResetFilters={() => {
          onSearchChange("");
          onStatusFilterChange("ALL");
          setCurrentPage(1);
        }}
      >
        <NativeSelect
          value={statusFilter}
          onChange={(e) => {
            onStatusFilterChange(e.target.value as "ALL" | "ACTIVE" | "EXPIRED");
            setCurrentPage(1);
          }}
          aria-label="Filter status member"
        >
          <NativeSelectOption value="ALL">Semua status</NativeSelectOption>
          <NativeSelectOption value="ACTIVE">Aktif</NativeSelectOption>
          <NativeSelectOption value="EXPIRED">Kedaluwarsa</NativeSelectOption>
        </NativeSelect>
      </DataTableToolbar>

      {filteredMembers.length === 0 ? (
        <EmptyState
          className="border"
          icon={<Users />}
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
                  <TableHead className="hidden sm:table-cell">Paket</TableHead>
                  <TableHead className="hidden md:table-cell">Masa berlaku</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Total belanja</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedMembers.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-normal">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-xs font-medium text-primary">
                          {m.memberId}
                        </span>
                        <span className="font-medium text-foreground">{m.name}</span>
                        <span className="font-mono text-xs text-muted-foreground tabular-nums">
                          {m.contact}
                          {m.email && m.email !== "-" ? ` · ${m.email}` : ""}
                        </span>
                        <span className="text-xs text-muted-foreground sm:hidden">
                          {m.packageName}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="hidden sm:table-cell whitespace-normal font-medium text-foreground">
                      {m.packageName}
                    </TableCell>

                    <TableCell className="hidden md:table-cell font-mono text-xs tabular-nums text-foreground">
                      {m.startDate} s/d {m.expiryDate}
                    </TableCell>

                    <TableCell className="hidden md:table-cell text-right font-mono font-medium tabular-nums text-foreground">
                      {formatCurrencyIDR(m.totalSpent || 0)}
                    </TableCell>

                    <TableCell>
                      <StatusBadge status={getMemberStatusTone(m.status)}>
                        {m.status === "ACTIVE" ? "Aktif" : "Kedaluwarsa"}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DataPagination
            currentPage={safeCurrentPage}
            totalItems={filteredMembers.length}
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
