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
import type { EmployeeProfile } from "@/types/shift";

import {
  emptyEmployeeMessage,
  getDepartmentBadgeTone,
  getEmployeeStatusLabel,
  getEmployeeStatusTone,
} from "./employees-domain";

export interface EmployeesDirectoryTabProps {
  employees: EmployeeProfile[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  deptFilter: string;
  onDeptFilterChange: (dept: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  onSelectDetail: (emp: EmployeeProfile) => void;
  onSelectEdit: (emp: EmployeeProfile) => void;
  onToggleStatus: (empId: string) => void;
  onSelectDelete: (emp: EmployeeProfile) => void;
}

const DEPARTMENTS = [
  { id: "ALL", label: "Semua divisi" },
  { id: "Management", label: "Management" },
  { id: "Service", label: "Service" },
  { id: "Kitchen", label: "Kitchen" },
  { id: "Barista", label: "Barista" },
  { id: "Cashier", label: "Cashier" },
  { id: "Inventory", label: "Inventory" },
];

const STATUSES = [
  { id: "ALL", label: "Semua status" },
  { id: "AKTIF", label: "Aktif" },
  { id: "CUTI", label: "Cuti" },
  { id: "NON-AKTIF", label: "Nonaktif" },
];

export function EmployeesDirectoryTab({
  employees,
  searchQuery,
  onSearchChange,
  deptFilter,
  onDeptFilterChange,
  statusFilter,
  onStatusFilterChange,
  onSelectDetail,
  onSelectEdit,
  onToggleStatus: _onToggleStatus,
  onSelectDelete,
}: EmployeesDirectoryTabProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const isFiltered =
    searchQuery.trim() !== "" || deptFilter !== "ALL" || statusFilter !== "ALL";

  const handleResetFilters = () => {
    onSearchChange("");
    onDeptFilterChange("ALL");
    onStatusFilterChange("ALL");
    setCurrentPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(employees.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedEmployees = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return employees.slice(start, start + pageSize);
  }, [employees, safeCurrentPage, pageSize]);

  const emptyCopy = emptyEmployeeMessage(isFiltered);

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
              placeholder="Cari nama, WhatsApp, email, atau peran"
              aria-label="Cari staf"
            />
          </InputGroup>

          <NativeSelect
            value={deptFilter}
            onChange={(e) => {
              onDeptFilterChange(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter divisi"
          >
            {DEPARTMENTS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </NativeSelect>

          <NativeSelect
            value={statusFilter}
            onChange={(e) => {
              onStatusFilterChange(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter status kepegawaian"
          >
            {STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </NativeSelect>

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

      {/* Directory Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[220px]">Karyawan & Kontak</TableHead>
                <TableHead>Peran & Divisi</TableHead>
                <TableHead>Shift tugas</TableHead>
                <TableHead className="hidden md:table-cell">Bergabung</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Aksi</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <EmptyState
                      icon={<Users className="size-8 text-muted-foreground" />}
                      title={emptyCopy.title}
                      description={emptyCopy.description}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                paginatedEmployees.map((emp) => {
                  const deptTone = getDepartmentBadgeTone(emp.department);
                  const statusTone = getEmployeeStatusTone(emp.status);

                  return (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">
                        <div className="space-y-0.5">
                          <p className="font-mono text-xs font-semibold text-primary">
                            {emp.employeeNumber}
                          </p>
                          <p className="leading-snug text-foreground">{emp.name}</p>
                          <p className="font-mono text-xs text-muted-foreground">{emp.contact}</p>
                          {emp.email && (
                            <p className="text-xs text-muted-foreground">{emp.email}</p>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{emp.role}</p>
                          <StatusBadge status={deptTone}>
                            {emp.department}
                          </StatusBadge>
                        </div>
                      </TableCell>

                      <TableCell className="text-xs text-foreground">
                        {emp.assignedShift}
                      </TableCell>

                      <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground md:table-cell">
                        {emp.joinedDate || "—"}
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={statusTone}>
                          {getEmployeeStatusLabel(emp.status)}
                        </StatusBadge>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onSelectDetail(emp)}
                          >
                            Detail
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onSelectEdit(emp)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onSelectDelete(emp)}
                            className="text-destructive hover:text-destructive"
                          >
                            Hapus
                          </Button>
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
      {employees.length > 0 && (
        <DataPagination
          currentPage={safeCurrentPage}
          totalItems={employees.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          itemLabel="staf"
        />
      )}
    </div>
  );
}
