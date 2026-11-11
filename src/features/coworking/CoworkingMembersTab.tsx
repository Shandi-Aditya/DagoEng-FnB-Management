"use client";

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";

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
import type { CoworkingMember } from "@/types/coworking";
import { formatCurrencyIDR } from "@/lib/utils";

import { emptyCoworkingMessage, getMemberStatusTone } from "./coworking-domain";

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

  const filteredMembers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return members.filter((m) => {
      const matchStatus = statusFilter === "ALL" || m.status === statusFilter;
      const matchQuery =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.contact.includes(q) ||
        m.memberId.toLowerCase().includes(q) ||
        m.packageName.toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  }, [members, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedMembers = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredMembers.slice(start, start + pageSize);
  }, [filteredMembers, safeCurrentPage, pageSize]);

  const emptyCopy = emptyCoworkingMessage("MEMBERS", isFiltered);

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
              onChange={(e) => {
                onSearchChange(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari member, kontak, atau paket"
              aria-label="Cari member"
            />
          </InputGroup>

          <NativeSelect
            value={statusFilter}
            onChange={(e) => {
              onStatusFilterChange(e.target.value as "ALL" | "ACTIVE" | "EXPIRED");
              setCurrentPage(1);
            }}
            aria-label="Filter status member"
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
            >
              Reset filter
            </Button>
          ) : null}
        </div>
      </div>

      {/* Members Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Member & Kontak</TableHead>
                <TableHead>Paket</TableHead>
                <TableHead>Masa berlaku</TableHead>
                <TableHead>Total belanja</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <EmptyState
                      icon={<Users className="size-6 text-muted-foreground" />}
                      title={emptyCopy.title}
                      description={emptyCopy.description}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                paginatedMembers.map((m) => {
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">
                        <div className="space-y-0.5">
                          <p className="font-mono text-xs font-semibold text-primary">
                            {m.memberId}
                          </p>
                          <p className="text-foreground">{m.name}</p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {m.contact} · {m.email}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell className="font-medium text-foreground">
                        {m.packageName}
                      </TableCell>

                      <TableCell className="font-mono text-xs font-medium text-foreground">
                        {m.startDate} s/d {m.expiryDate}
                      </TableCell>

                      <TableCell className="font-mono font-medium tabular-nums text-foreground">
                        {formatCurrencyIDR(m.totalSpent || 0)}
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={getMemberStatusTone(m.status)}>
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
      {filteredMembers.length > 0 && (
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
      )}
    </div>
  );
}
