import { useState, useMemo } from "react";
import {
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { EmployeeProfile } from "@/types/shift";
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
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { NativeSelect } from "@/components/ui/native-select";
import {
  getDepartmentBadgeTone,
  getEmployeeStatusTone,
  ROLE_DEFAULT_PERMISSIONS,
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
  "ALL",
  "Management",
  "Service",
  "Kitchen",
  "Barista",
  "Cashier",
  "Inventory",
];

const STATUSES = ["ALL", "AKTIF", "CUTI", "NON-AKTIF"];

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
  onToggleStatus,
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
              placeholder="Cari nama, role, NIK, atau departemen..."
              className="h-8 pl-8 text-xs"
            />
          </div>

          <NativeSelect
            value={deptFilter}
            onChange={(e) => {
              onDeptFilterChange(e.target.value);
              setCurrentPage(1);
            }}
            className="h-8 text-xs font-medium"
          >
            <option value="ALL">Semua Departemen</option>
            {DEPARTMENTS.filter((d) => d !== "ALL").map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </NativeSelect>

          <NativeSelect
            value={statusFilter}
            onChange={(e) => {
              onStatusFilterChange(e.target.value);
              setCurrentPage(1);
            }}
            className="h-8 text-xs font-medium"
          >
            <option value="ALL">Semua Status</option>
            {STATUSES.filter((s) => s !== "ALL").map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </NativeSelect>

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
            </NativeSelect>
          </div>
        </div>
      </div>

      {/* Employees Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">NIK & Nama Staf</TableHead>
                <TableHead>Jabatan & Departemen</TableHead>
                <TableHead>Kontak & Email</TableHead>
                <TableHead>Shift Ditugaskan</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Hak Akses</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center">
                    <EmptyState
                      icon={<Users className="w-8 h-8 text-muted-foreground" />}
                      title="Tidak ada karyawan ditemukan"
                      description={
                        searchQuery
                          ? `Tidak ditemukan staf yang cocok dengan kata kunci "${searchQuery}".`
                          : "Belum ada karyawan terdaftar di outlet ini."
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                paginatedEmployees.map((emp) => {
                  const deptTone = getDepartmentBadgeTone(emp.department);
                  const statusTone = getEmployeeStatusTone(emp.status);
                  const permCount = (
                    emp.permissions ||
                    ROLE_DEFAULT_PERMISSIONS[emp.role] || ["pos_access"]
                  ).length;

                  return (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">
                        <div className="space-y-0.5">
                          <p className="text-foreground leading-snug">{emp.name}</p>
                          <p className="font-mono text-primary text-[11px]">
                            {emp.employeeNumber}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-foreground">{emp.role}</p>
                          <StatusBadge status={deptTone} className="text-[10px]">
                            {emp.department}
                          </StatusBadge>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-0.5 text-xs text-muted-foreground">
                          <p className="font-mono">{emp.contact}</p>
                          <p className="text-[11px]">{emp.email}</p>
                        </div>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {emp.assignedShift}
                      </TableCell>

                      <TableCell className="text-center">
                        <button
                          type="button"
                          onClick={() => onToggleStatus(emp.id)}
                          title="Klik untuk mengubah status (Aktif/Cuti/Non-Aktif)"
                        >
                          <StatusBadge status={statusTone} className="text-xs cursor-pointer">
                            {emp.status}
                          </StatusBadge>
                        </button>
                      </TableCell>

                      <TableCell className="text-center font-mono text-xs text-muted-foreground">
                        {permCount} Izin
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSelectDetail(emp)}
                            className="h-7 px-2 text-xs font-medium"
                          >
                            Detail
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSelectEdit(emp)}
                            className="h-7 px-2 text-xs font-medium"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSelectDelete(emp)}
                            className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
          <div>
            Menampilkan{" "}
            <span className="font-mono font-medium text-foreground">
              {Math.min((safeCurrentPage - 1) * pageSize + 1, employees.length)}
            </span>{" "}
            sampai{" "}
            <span className="font-mono font-medium text-foreground">
              {Math.min(safeCurrentPage * pageSize, employees.length)}
            </span>{" "}
            dari{" "}
            <span className="font-mono font-medium text-foreground">
              {employees.length}
            </span>{" "}
            karyawan
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
