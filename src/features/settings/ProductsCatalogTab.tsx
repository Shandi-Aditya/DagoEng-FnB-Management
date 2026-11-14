"use client";

import { useState } from "react";
import { Edit2, Plus, Power, Search, Tag, UtensilsCrossed } from "lucide-react";

import { DataPagination } from "@/components/app/data-pagination";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrencyIDR } from "@/lib/utils";
import type { MasterProduct } from "@/types/product";

import {
  productStatusLabel,
  productStatusTone,
  type ProductSortOrder,
} from "./settings-domain";

interface TenantOption {
  id: string;
  name: string;
}

export interface ProductsCatalogTabProps {
  products: MasterProduct[];
  categories: string[];
  tenants?: TenantOption[];
  isTenantScope?: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  tenantFilter?: string;
  onTenantFilterChange?: (val: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (val: string) => void;
  statusFilter: "ALL" | "ACTIVE" | "INACTIVE";
  onStatusFilterChange: (val: "ALL" | "ACTIVE" | "INACTIVE") => void;
  sortOrder: ProductSortOrder;
  onSortOrderChange: (val: ProductSortOrder) => void;
  onToggleStatus: (productId: string) => void;
  onEditProduct: (product: MasterProduct) => void;
  onOpenAddCategory?: () => void;
  resolveTenantName?: (tenantId?: string) => string;
}

export function ProductsCatalogTab({
  products,
  categories,
  tenants = [],
  isTenantScope = false,
  searchQuery,
  onSearchChange,
  tenantFilter = "ALL",
  onTenantFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  statusFilter,
  onStatusFilterChange,
  sortOrder,
  onSortOrderChange,
  onToggleStatus,
  onEditProduct,
  onOpenAddCategory,
  resolveTenantName,
}: ProductsCatalogTabProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const safePage = Math.min(currentPage, Math.max(1, Math.ceil(products.length / pageSize)));
  const pagedProducts = products.slice((safePage - 1) * pageSize, safePage * pageSize);

  const hasFilter =
    searchQuery.trim() !== "" ||
    categoryFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    (!isTenantScope && tenantFilter !== "ALL");

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar pencarian dan filter */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <InputGroup className="w-full sm:max-w-xs">
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
              placeholder="Cari nama menu atau kategori"
              aria-label="Cari menu"
            />
          </InputGroup>

          {!isTenantScope && onTenantFilterChange ? (
            <NativeSelect
              value={tenantFilter}
              onChange={(e) => {
                onTenantFilterChange(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter mitra"
            >
              <NativeSelectOption value="ALL">Semua mitra</NativeSelectOption>
              {tenants.map((t) => (
                <NativeSelectOption key={t.id} value={t.id}>
                  {t.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          ) : null}

          <NativeSelect
            value={categoryFilter}
            onChange={(e) => {
              onCategoryFilterChange(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter kategori"
          >
            <NativeSelectOption value="ALL">Semua kategori</NativeSelectOption>
            {categories.map((c) => (
              <NativeSelectOption key={c} value={c}>
                {c}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          <NativeSelect
            value={statusFilter}
            onChange={(e) => {
              onStatusFilterChange(e.target.value as "ALL" | "ACTIVE" | "INACTIVE");
              setCurrentPage(1);
            }}
            aria-label="Filter status menu"
          >
            <NativeSelectOption value="ALL">Semua status</NativeSelectOption>
            <NativeSelectOption value="ACTIVE">Aktif</NativeSelectOption>
            <NativeSelectOption value="INACTIVE">Nonaktif</NativeSelectOption>
          </NativeSelect>

          <NativeSelect
            value={sortOrder}
            onChange={(e) => onSortOrderChange(e.target.value as ProductSortOrder)}
            aria-label="Urutkan menu"
          >
            <NativeSelectOption value="UPDATED_DESC">Terbaru diubah</NativeSelectOption>
            <NativeSelectOption value="UPDATED_ASC">Terlama diubah</NativeSelectOption>
            <NativeSelectOption value="NAME_ASC">Nama menu (A–Z)</NativeSelectOption>
            <NativeSelectOption value="PRICE_ASC">Harga terendah</NativeSelectOption>
            <NativeSelectOption value="PRICE_DESC">Harga tertinggi</NativeSelectOption>
          </NativeSelect>
        </div>

        <span className="text-xs text-muted-foreground tabular-nums">
          {products.length} menu
        </span>
      </div>

      {/* Tabel menu */}
      {products.length === 0 ? (
        <EmptyState
          className="border"
          icon={<UtensilsCrossed />}
          title={hasFilter ? "Menu tidak ditemukan" : "Belum ada menu"}
          description={
            hasFilter
              ? "Ubah kata kunci atau filter mitra, kategori, dan status."
              : "Tambahkan menu pertama untuk mulai menjual di kasir POS."
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Menu</TableHead>
                  {!isTenantScope ? (
                    <TableHead className="hidden md:table-cell">Mitra</TableHead>
                  ) : null}
                  <TableHead className="hidden sm:table-cell">Kategori</TableHead>
                  <TableHead className="text-right">Harga</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Estimasi HPP</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="w-0 text-right">
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedProducts.map((p) => {
                  const tenantLabel = resolveTenantName ? resolveTenantName(p.tenantId) : p.tenantId || "—";

                  return (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-normal">
                        <div className="flex items-center gap-2.5">
                          {p.imageUrl ? (
                            <div className="relative size-8 shrink-0 overflow-hidden rounded-md border bg-muted flex items-center justify-center">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                  const fb = e.currentTarget.parentElement?.querySelector(
                                    ".settings-fallback-placeholder",
                                  ) as HTMLElement | null;
                                  if (fb) fb.classList.remove("hidden");
                                }}
                                className="size-full object-cover"
                              />
                              {/* lint-ui-ignore: kelas dikunci oleh test pos-d-bagian-d (D2) */}
                              <div className="settings-fallback-placeholder hidden flex w-full h-full items-center justify-center text-slate-400">
                                <UtensilsCrossed className="size-4" />
                              </div>
                            </div>
                          ) : (
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                              <UtensilsCrossed className="size-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{p.name}</p>
                            <p className="text-xs text-muted-foreground sm:hidden">
                              {p.category}
                              {!isTenantScope ? ` · ${tenantLabel}` : ""}
                            </p>
                            {p.description ? (
                              <p className="hidden text-xs text-muted-foreground line-clamp-1 max-w-xs sm:block">
                                {p.description}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>

                      {!isTenantScope ? (
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline">{tenantLabel}</Badge>
                        </TableCell>
                      ) : null}

                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                        {p.category}
                      </TableCell>

                      <TableCell className="text-right font-mono text-xs font-medium tabular-nums">
                        {formatCurrencyIDR(p.basePrice)}
                      </TableCell>

                      <TableCell className="hidden lg:table-cell text-right font-mono text-xs text-muted-foreground tabular-nums">
                        {formatCurrencyIDR(p.cogsEstimate || 0)}
                      </TableCell>

                      <TableCell className="hidden sm:table-cell">
                        <button
                          type="button"
                          onClick={() => onToggleStatus(p.id)}
                          className="cursor-pointer rounded-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                          title={`Ubah status ${p.name}`}
                          aria-label={`Ubah status ${p.name}`}
                        >
                          <StatusBadge status={productStatusTone(p.status)}>
                            <Power className="size-3" />
                            {productStatusLabel(p.status)}
                          </StatusBadge>
                        </button>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onEditProduct(p)}
                            aria-label={`Edit ${p.name}`}
                          >
                            <Edit2 />
                            <span className="hidden sm:inline">Edit</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <DataPagination
            currentPage={safePage}
            totalItems={products.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            itemLabel="menu"
          />
        </div>
      )}

      {/* Ringkasan kategori (khusus admin) */}
      {!isTenantScope ? (
        <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Tag className="size-4 text-muted-foreground" />
              <span>Kategori menu ({categories.length})</span>
            </div>
            {onOpenAddCategory ? (
              <Button type="button" size="lg" variant="outline" onClick={onOpenAddCategory}>
                <Plus />
                <span>Tambah kategori</span>
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <Badge key={cat} variant="secondary">
                {cat}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
