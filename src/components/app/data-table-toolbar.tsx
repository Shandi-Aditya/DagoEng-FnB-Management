"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

export interface DataTableToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchAriaLabel: string;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
  resetLabel?: string;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Shared search and filter toolbar for operational tables. */
export function DataTableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchAriaLabel,
  hasActiveFilters = false,
  onResetFilters,
  resetLabel = "Hapus filter",
  children,
  actions,
  className,
}: DataTableToolbarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <InputGroup className="w-full sm:max-w-xs">
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchAriaLabel}
        />
      </InputGroup>

      {children}

      {hasActiveFilters && onResetFilters ? (
        <Button type="button" variant="ghost" size="sm" onClick={onResetFilters}>
          {resetLabel}
        </Button>
      ) : null}

      {actions ? <div className="flex items-center gap-2 sm:ml-auto">{actions}</div> : null}
    </div>
  );
}
