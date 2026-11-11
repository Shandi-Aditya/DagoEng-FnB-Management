import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

export interface DataPaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  className?: string;
}

export function DataPagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  itemLabel = "data",
  className = "",
}: DataPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const fromIndex = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const toIndex = Math.min(safeCurrentPage * pageSize, totalItems);

  if (totalItems === 0) return null;

  return (
    <div
      className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground select-none ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span>
          Menampilkan{" "}
          <span className="font-mono font-medium text-foreground">{fromIndex}</span>{" "}
          sampai{" "}
          <span className="font-mono font-medium text-foreground">{toIndex}</span>{" "}
          dari{" "}
          <span className="font-mono font-medium text-foreground">{totalItems}</span>{" "}
          {itemLabel}
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>· Baris:</span>
            <NativeSelect
              value={String(pageSize)}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="h-7 w-16 text-xs font-mono"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(1)}
          disabled={safeCurrentPage <= 1}
          className="size-8"
          aria-label="Halaman pertama"
          title="Halaman pertama"
        >
          <ChevronsLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage <= 1}
          className="size-8"
          aria-label="Halaman sebelumnya"
          title="Halaman sebelumnya"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="px-2 font-mono text-xs">
          {safeCurrentPage} / {totalPages}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage >= totalPages}
          className="size-8"
          aria-label="Halaman berikutnya"
          title="Halaman berikutnya"
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(totalPages)}
          disabled={safeCurrentPage >= totalPages}
          className="size-8"
          aria-label="Halaman terakhir"
          title="Halaman terakhir"
        >
          <ChevronsRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export interface TablePageSizeSelectorProps {
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  options?: number[];
  label?: string;
  className?: string;
}

export function TablePageSizeSelector({
  pageSize,
  onPageSizeChange,
  options = [10, 25, 50, 100],
  label = "Baris",
  className = "",
}: TablePageSizeSelectorProps) {
  return (
    <div className={`flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}>
      <span>{label}</span>
      <NativeSelect
        value={String(pageSize)}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
        className="h-8 w-16 text-xs font-mono"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
