"use client";

import { useMemo, useState } from "react";
import { Eye, MoreHorizontal, Pencil, Trash2, Users } from "lucide-react";

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
    <div className="flex flex-col gap-4">
      <DataTableToolbar
        searchValue={searchQuery}
        onSearchChange={(val) => {
          onSearchChange(val);
          setCurrentPage(1);
        }}
        searchPlaceholder="Cari nama, WhatsApp, email, atau peran"
        searchAriaLabel="Cari staf"
        hasActiveFilters={isFiltered}
        onResetFilters={handleResetFilters}
      >
        <NativeSelect
          value={deptFilter}
          onChange={(e) => {
            onDeptFilterChange(e.target.value);
            setCurrentPage(1);
          }}
          aria-label="Filter divisi"
        >
          {DEPARTMENTS.map((d) => (
            <NativeSelectOption key={d.id} value={d.id}>
              {d.label}
            </NativeSelectOption>
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
            <NativeSelectOption key={s.id} value={s.id}>
              {s.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </DataTableToolbar>

      {paginatedEmployees.length === 0 ? (
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
                  <TableHead>Karyawan</TableHead>
                  <TableHead className="hidden sm:table-cell">Peran</TableHead>
                  <TableHead className="hidden md:table-cell">Shift tugas</TableHead>
                  <TableHead className="hidden lg:table-cell">Bergabung</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-0">
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEmployees.map((emp) => {
                  const deptTone = getDepartmentBadgeTone(emp.department);
                  const statusTone = getEmployeeStatusTone(emp.status);

                  return (
                    <TableRow key={emp.id}>
                      <TableCell className="whitespace-normal">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-xs font-medium text-primary">
                            {emp.employeeNumber}
                          </span>
                          <span className="font-medium text-foreground">{emp.name}</span>
                          <span className="font-mono text-xs text-muted-foreground tabular-nums">
                            {emp.contact}
                          </span>
                          {emp.email && emp.email !== "-" ? (
                            <span className="text-xs text-muted-foreground">{emp.email}</span>
                          ) : null}
                          <span className="text-xs text-muted-foreground sm:hidden">
                            {emp.role} · {emp.department}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="hidden sm:table-cell">
                        <div className="flex flex-col items-start gap-1">
                          <span className="font-medium text-foreground">{emp.role}</span>
                          <StatusBadge status={deptTone}>{emp.department}</StatusBadge>
                        </div>
                      </TableCell>

                      <TableCell className="hidden md:table-cell whitespace-normal text-xs text-foreground">
                        {emp.assignedShift}
                      </TableCell>

                      <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground lg:table-cell">
                        {emp.joinedDate || "—"}
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={statusTone}>
                          {getEmployeeStatusLabel(emp.status)}
                        </StatusBadge>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onSelectDetail(emp)}
                            aria-label={`Detail ${emp.name}`}
                          >
                            <Eye />
                            <span className="hidden sm:inline">Detail</span>
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  aria-label={`Aksi lain untuk ${emp.name}`}
                                />
                              }
                            >
                              <MoreHorizontal />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onSelectEdit(emp)}>
                                <Pencil />
                                Edit staf
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => onSelectDelete(emp)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 />
                                Hapus
                              </DropdownMenuItem>
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
            totalItems={employees.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
            itemLabel="staf"
          />
        </div>
      )}
    </div>
  );
}
