"use client";

import type React from "react";
import { Plus, Search, Tag, Trash2, UtensilsCrossed, X } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  getPromoComputedStatus,
  sortPromosByPriority,
  type PromoConfig,
  type PromoScope,
  type PromoType,
} from "@/lib/promo";
import { formatCurrencyIDR } from "@/lib/utils";
import type { MasterProduct } from "@/types/product";

import { promoStatusLabel, promoStatusTone } from "./settings-domain";

export interface PromosTabProps {
  promos: PromoConfig[];
  onChangePromos: React.Dispatch<React.SetStateAction<PromoConfig[]>>;
  isTenantScope?: boolean;
  tenantId?: string;
  tenants: { id: string; name: string; code: string }[];
  categories: string[];
  products: MasterProduct[];
  spaces: { id: string; name: string; type: string }[];
  onAddPromo: () => void;
  // Multi-select product modal props
  isProductModalOpen: boolean;
  onProductModalOpenChange: (open: boolean) => void;
  onOpenPromoProductSelect: (promoId: string) => void;
  selectedProductIdsInModal: string[];
  onToggleModalProduct: (productId: string) => void;
  onSelectAllModalProducts: (ids: string[]) => void;
  onClearAllModalProducts: () => void;
  onSavePromoProducts: () => void;
  onRemoveProductFromPromo: (promoId: string, productId: string) => void;
  modalSearch: string;
  onModalSearchChange: (val: string) => void;
  modalCategoryFilter: string;
  onModalCategoryFilterChange: (val: string) => void;
  modalTenantFilter: string;
  onModalTenantFilterChange: (val: string) => void;
}

export function PromosTab(props: PromosTabProps) {
  const {
    promos,
    onChangePromos,
    isTenantScope = false,
    tenantId,
    tenants,
    categories,
    products,
    spaces,
    onAddPromo,
    isProductModalOpen,
    onProductModalOpenChange,
    onOpenPromoProductSelect,
    selectedProductIdsInModal,
    onToggleModalProduct,
    onSelectAllModalProducts,
    onClearAllModalProducts,
    onSavePromoProducts,
    onRemoveProductFromPromo,
    modalSearch,
    onModalSearchChange,
    modalCategoryFilter,
    onModalCategoryFilterChange,
    modalTenantFilter,
    onModalTenantFilterChange,
  } = props;

  const visiblePromos = sortPromosByPriority(
    isTenantScope
      ? promos.filter((p) => !p.tenantId || p.tenantId === tenantId)
      : promos,
  );

  const updatePromo = (promoId: string, patch: Partial<PromoConfig>) => {
    onChangePromos((prev) => prev.map((p) => (p.id === promoId ? { ...p, ...patch } : p)));
  };

  const modalFilteredProducts = products.filter((p) => {
    if (isTenantScope && tenantId && p.tenantId !== tenantId) return false;
    if (!isTenantScope && modalTenantFilter !== "ALL" && p.tenantId !== modalTenantFilter) return false;
    if (modalCategoryFilter !== "ALL" && p.category !== modalCategoryFilter) return false;
    if (modalSearch.trim()) {
      const q = modalSearch.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {isTenantScope
            ? "Kelola voucher diskon khusus untuk menu mitra Anda."
            : "Atur voucher dan promo untuk kasir F&B, portal pelanggan, dan co-working."}
        </p>
        <Button type="button" size="lg" onClick={onAddPromo}>
          <Plus />
          <span>Tambah promo</span>
        </Button>
      </div>

      {visiblePromos.length === 0 ? (
        <EmptyState
          className="border"
          icon={<Tag />}
          title="Belum ada promo"
          description="Tambahkan kode kupon atau diskon untuk pelanggan."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {visiblePromos.map((promo) => {
            const computedStatus = getPromoComputedStatus(promo);
            const targetProductIds =
              promo.applicableProductIds ||
              (promo.targetId
                ? promo.targetId
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : []);

            return (
              <Card key={promo.id}>
                <CardContent className="flex flex-col gap-4 p-4">
                  {/* Baris 1: Kode, Nama, Status, Toggle, Hapus */}
                  <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
                    <div className="flex flex-1 flex-wrap items-end gap-3">
                      <div className="w-36 flex flex-col gap-1">
                        <Label className="text-xs">Kode kupon</Label>
                        <Input
                          type="text"
                          value={promo.code || ""}
                          onChange={(e) =>
                            updatePromo(promo.id, { code: e.target.value.toUpperCase() })
                          }
                          placeholder="DAGO20"
                          className="font-mono"
                        />
                      </div>
                      <div className="min-w-[180px] flex-1 flex flex-col gap-1">
                        <Label className="text-xs">Nama promo</Label>
                        <Input
                          type="text"
                          value={promo.name}
                          onChange={(e) => updatePromo(promo.id, { name: e.target.value })}
                          placeholder="Nama promo"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <StatusBadge status={promoStatusTone(computedStatus)}>
                        {promoStatusLabel(computedStatus)}
                      </StatusBadge>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => updatePromo(promo.id, { isActive: !promo.isActive })}
                      >
                        {promo.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        onClick={() =>
                          onChangePromos((prev) => prev.filter((p) => p.id !== promo.id))
                        }
                        aria-label={`Hapus promo ${promo.name}`}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>

                  {/* Baris 2: Deskripsi */}
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">Syarat dan deskripsi</Label>
                    <Input
                      type="text"
                      value={promo.description || ""}
                      onChange={(e) => updatePromo(promo.id, { description: e.target.value })}
                      placeholder="Keterangan singkat promo"
                    />
                  </div>

                  {/* Baris 3: Nilai & batas */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Tipe diskon</Label>
                      <NativeSelect
                        value={promo.discountType}
                        onChange={(e) =>
                          updatePromo(promo.id, { discountType: e.target.value as PromoType })
                        }
                      >
                        <NativeSelectOption value="PERCENTAGE">Persentase (%)</NativeSelectOption>
                        <NativeSelectOption value="FIXED">Nominal (Rp)</NativeSelectOption>
                      </NativeSelect>
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">
                        {promo.discountType === "PERCENTAGE" ? "Diskon (%)" : "Potongan (Rp)"}
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={promo.discountValue}
                        onChange={(e) =>
                          updatePromo(promo.id, { discountValue: Number(e.target.value) })
                        }
                        className="font-mono tabular-nums"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Maks. diskon (Rp)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={promo.maxDiscount || ""}
                        onChange={(e) =>
                          updatePromo(promo.id, {
                            maxDiscount: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                        placeholder="Tanpa batas"
                        className="font-mono tabular-nums"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Min. belanja (Rp)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={promo.minimumAmount || ""}
                        onChange={(e) =>
                          updatePromo(promo.id, {
                            minimumAmount: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                        placeholder="0"
                        className="font-mono tabular-nums"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Kuota</Label>
                      <Input
                        type="number"
                        min={1}
                        value={promo.quota || ""}
                        onChange={(e) =>
                          updatePromo(promo.id, {
                            quota: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                        placeholder="Tak terbatas"
                        className="font-mono tabular-nums"
                      />
                    </div>
                  </div>

                  {/* Baris 4: Lingkup & tanggal berlaku */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                    {!isTenantScope ? (
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">Layanan</Label>
                        <NativeSelect
                          value={promo.scope || "ALL"}
                          onChange={(e) =>
                            updatePromo(promo.id, {
                              scope: e.target.value as PromoScope,
                              targetType: "ALL",
                              targetId: undefined,
                              applicableProductIds: [],
                            })
                          }
                        >
                          <NativeSelectOption value="ALL">Semua layanan</NativeSelectOption>
                          <NativeSelectOption value="FNB">F&B</NativeSelectOption>
                          <NativeSelectOption value="COWORKING">Co-working</NativeSelectOption>
                        </NativeSelect>
                      </div>
                    ) : null}

                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Target</Label>
                      {promo.scope === "COWORKING" ? (
                        <NativeSelect
                          value={promo.targetId || "ALL"}
                          onChange={(e) => {
                            const val = e.target.value;
                            updatePromo(promo.id, {
                              targetType: (val === "ALL" ? "ALL" : "SPACE") as PromoConfig["targetType"],
                              targetId: val === "ALL" ? undefined : val,
                            });
                          }}
                        >
                          <NativeSelectOption value="ALL">Semua ruang</NativeSelectOption>
                          {spaces.map((sp) => (
                            <NativeSelectOption key={sp.id} value={sp.id}>
                              {sp.name}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      ) : (
                        <NativeSelect
                          value={promo.targetType || "ALL"}
                          onChange={(e) =>
                            updatePromo(promo.id, {
                              targetType: e.target.value as PromoConfig["targetType"],
                            })
                          }
                        >
                          <NativeSelectOption value="ALL">Semua menu</NativeSelectOption>
                          {!isTenantScope ? (
                            <NativeSelectOption value="TENANT">Mitra tertentu</NativeSelectOption>
                          ) : null}
                          <NativeSelectOption value="CATEGORY">Kategori tertentu</NativeSelectOption>
                          <NativeSelectOption value="PRODUCT">Menu pilihan</NativeSelectOption>
                        </NativeSelect>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Mulai berlaku</Label>
                      <Input
                        type="date"
                        value={promo.validFrom ? promo.validFrom.slice(0, 10) : ""}
                        onChange={(e) => updatePromo(promo.id, { validFrom: e.target.value })}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Berakhir pada</Label>
                      <Input
                        type="date"
                        value={promo.validUntil ? promo.validUntil.slice(0, 10) : ""}
                        onChange={(e) => updatePromo(promo.id, { validUntil: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Pilihan detail target */}
                  {promo.scope !== "COWORKING" && promo.targetType === "TENANT" && !isTenantScope ? (
                    <div className="flex flex-col gap-1 sm:max-w-xs">
                      <Label className="text-xs">Pilih mitra</Label>
                      <NativeSelect
                        value={promo.targetId || ""}
                        onChange={(e) => updatePromo(promo.id, { targetId: e.target.value })}
                      >
                        <NativeSelectOption value="">Pilih mitra</NativeSelectOption>
                        {tenants.map((t) => (
                          <NativeSelectOption key={t.id} value={t.id}>
                            {t.name}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </div>
                  ) : null}

                  {promo.scope !== "COWORKING" && promo.targetType === "CATEGORY" ? (
                    <div className="flex flex-col gap-1 sm:max-w-xs">
                      <Label className="text-xs">Pilih kategori</Label>
                      <NativeSelect
                        value={promo.targetId || ""}
                        onChange={(e) => updatePromo(promo.id, { targetId: e.target.value })}
                      >
                        <NativeSelectOption value="">Pilih kategori</NativeSelectOption>
                        {categories.map((c) => (
                          <NativeSelectOption key={c} value={c}>
                            {c}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </div>
                  ) : null}

                  {promo.scope !== "COWORKING" && promo.targetType === "PRODUCT" ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onOpenPromoProductSelect(promo.id)}
                        >
                          <UtensilsCrossed />
                          <span>Pilih menu ({targetProductIds.length})</span>
                        </Button>
                      </div>
                      {targetProductIds.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {targetProductIds.map((pid) => {
                            const prod = products.find((item) => item.id === pid);
                            return (
                              <Badge key={pid} variant="secondary" className="gap-1">
                                <span>{prod?.name || pid}</span>
                                <button
                                  type="button"
                                  onClick={() => onRemoveProductFromPromo(promo.id, pid)}
                                  aria-label={`Hapus ${prod?.name || pid}`}
                                  className="hover:text-destructive"
                                >
                                  <X className="size-3" />
                                </button>
                              </Badge>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog pilih produk multi-select */}
      <Dialog open={isProductModalOpen} onOpenChange={onProductModalOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Pilih menu untuk promo</DialogTitle>
            <DialogDescription>
              Terpilih {selectedProductIdsInModal.length} menu.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2 py-2">
            <InputGroup className="flex-1 min-w-[180px]">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                value={modalSearch}
                onChange={(e) => onModalSearchChange(e.target.value)}
                placeholder="Cari menu"
                aria-label="Cari menu untuk promo"
              />
            </InputGroup>

            {!isTenantScope ? (
              <NativeSelect
                value={modalTenantFilter}
                onChange={(e) => onModalTenantFilterChange(e.target.value)}
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
              value={modalCategoryFilter}
              onChange={(e) => onModalCategoryFilterChange(e.target.value)}
              aria-label="Filter kategori"
            >
              <NativeSelectOption value="ALL">Semua kategori</NativeSelectOption>
              {categories.map((c) => (
                <NativeSelectOption key={c} value={c}>
                  {c}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className="flex items-center justify-between text-xs pb-2">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onSelectAllModalProducts(modalFilteredProducts.map((p) => p.id))}
              >
                Pilih semua yang tampil
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={onClearAllModalProducts}>
                Kosongkan
              </Button>
            </div>
            <span className="text-muted-foreground tabular-nums">
              {modalFilteredProducts.length} menu
            </span>
          </div>

          <div className="flex-1 overflow-y-auto rounded-lg border divide-y">
            {modalFilteredProducts.map((p) => {
              const checked = selectedProductIdsInModal.includes(p.id);
              return (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-xs hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleModalProduct(p.id)}
                      className="rounded border"
                    />
                    <div>
                      <p className="font-medium text-foreground">{p.name}</p>
                      <p className="text-muted-foreground">{p.category}</p>
                    </div>
                  </div>
                  <span className="font-mono tabular-nums text-foreground">
                    {formatCurrencyIDR(p.basePrice)}
                  </span>
                </label>
              );
            })}
          </div>

          <DialogFooter className="gap-2 pt-3">
            <Button type="button" variant="outline" size="lg" onClick={() => onProductModalOpenChange(false)}>
              Batal
            </Button>
            <Button type="button" size="lg" onClick={onSavePromoProducts}>
              Terapkan pilihan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
