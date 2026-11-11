"use client";

import { Search } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type CatalogProduct, ProductCard } from "@/features/pos/ProductCard";
import type { TenantOpenState } from "@/features/pos/pos-catalog";

export const ALL_TENANTS = "ALL";
export const ALL_CATEGORIES = "Semua Kategori";

interface ProductCatalogProps {
  products: readonly CatalogProduct[];
  tenants: readonly { id: string; name: string }[];
  selectedTenantId: string;
  onTenantChange: (tenantId: string) => void;
  categories: readonly string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  tenantState: (tenantId: string) => TenantOpenState;
  onSelectProduct: (product: CatalogProduct) => void;
}

const SCROLL_ROW = "max-w-full overflow-x-auto no-scrollbar";

export function ProductCatalog({
  products,
  tenants,
  selectedTenantId,
  onTenantChange,
  categories,
  selectedCategory,
  onCategoryChange,
  searchQuery,
  onSearchChange,
  tenantState,
  onSelectProduct,
}: ProductCatalogProps) {
  return (
    <div className="flex flex-col gap-3">
      <InputGroup>
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Cari menu atau kategori"
          aria-label="Cari menu"
        />
      </InputGroup>

      <div className={SCROLL_ROW}>
        <Tabs value={selectedTenantId} onValueChange={(value) => onTenantChange(String(value))}>
          <TabsList aria-label="Mitra F&B">
            <TabsTrigger value={ALL_TENANTS}>Semua mitra</TabsTrigger>
            {tenants.map((tenant) => (
              <TabsTrigger key={tenant.id} value={tenant.id}>
                {tenant.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {categories.length > 1 ? (
        <div className={SCROLL_ROW}>
          <Tabs value={selectedCategory} onValueChange={(value) => onCategoryChange(String(value))}>
            <TabsList variant="line" aria-label="Kategori">
              {categories.map((category) => (
                <TabsTrigger key={category} value={category}>
                  {category === ALL_CATEGORIES ? "Semua kategori" : category}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      ) : null}

      {products.length === 0 ? (
        <EmptyState
          className="border"
          icon={<Search />}
          title="Menu tidak ditemukan"
          description={searchQuery ? `Tidak ada menu yang cocok dengan "${searchQuery}".` : "Mitra ini belum punya menu aktif."}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              tenant={tenantState(product.tenantId || "tenant-ks")}
              onSelect={() => onSelectProduct(product)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
