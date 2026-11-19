"use client";

import React, { useState, useEffect } from "react";
import { Tag, Plus, Check, AlertCircle, RefreshCw, Power } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { CommunityEvent, EventPromoCode, PromoDiscountType } from "@/types/event";
import { formatCurrencyIDR } from "@/lib/utils";
import { notify } from "@/components/app/notify";

interface EventPromosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CommunityEvent | null;
  onPromoUpdated?: () => void;
}

export function EventPromosDialog({
  open,
  onOpenChange,
  event,
  onPromoUpdated,
}: EventPromosDialogProps) {
  const [promos, setPromos] = useState<EventPromoCode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New promo form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<PromoDiscountType>("PERCENT");
  const [discountValue, setDiscountValue] = useState<number>(10);
  const [maxDiscountAmount, setMaxDiscountAmount] = useState<string>("");
  const [minOrderAmount, setMinOrderAmount] = useState<string>("");
  const [quota, setQuota] = useState<number>(50);
  const [validFrom, setValidFrom] = useState<string>("");
  const [validUntil, setValidUntil] = useState<string>("");
  const [selectedTierId, setSelectedTierId] = useState<string>("ALL");

  const fetchPromos = async () => {
    if (!event) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${event.id}/promos`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal memuat daftar kode promo.");
      }
      setPromos(data.promoCodes || []);
    } catch (err: any) {
      setError(err.message || "Gagal menghubungi server.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && event) {
      fetchPromos();
      setIsFormOpen(false);
    }
  }, [open, event?.id]);

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;
    setIsCreating(true);
    setError(null);

    try {
      const payload = {
        code: code.trim().toUpperCase(),
        discountType,
        discountValue: Number(discountValue),
        maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : undefined,
        minOrderAmount: minOrderAmount ? Number(minOrderAmount) : undefined,
        quota: Number(quota) || 100,
        validFrom: validFrom ? `${validFrom}:00+08:00` : undefined,
        validUntil: validUntil ? `${validUntil}:00+08:00` : undefined,
        applicableTierIds: selectedTierId !== "ALL" ? [selectedTierId] : undefined,
        isActive: true,
      };

      const res = await fetch(`/api/events/${event.id}/promos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal membuat kode promo.");
      }

      notify.success("Kode promo dibuat", `Kode promo ${payload.code} berhasil disimpan.`);
      setIsFormOpen(false);
      setCode("");
      setDiscountValue(10);
      setMaxDiscountAmount("");
      setMinOrderAmount("");
      setQuota(50);
      setValidFrom("");
      setValidUntil("");
      setSelectedTierId("ALL");

      await fetchPromos();
      onPromoUpdated?.();
    } catch (err: any) {
      setError(err.message || "Gagal membuat kode promo.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleTogglePromoStatus = async (promo: EventPromoCode) => {
    if (!event) return;
    try {
      const res = await fetch(`/api/events/${event.id}/promos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...promo,
          code: promo.code,
          isActive: !promo.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal mengubah status kode promo.");
      }
      notify.success(
        "Status diperbarui",
        `Kode promo ${promo.code} sekarang ${!promo.isActive ? "aktif" : "dinonaktifkan"}.`
      );
      await fetchPromos();
      onPromoUpdated?.();
    } catch (err: any) {
      notify.error("Gagal", err.message || "Gagal memperbarui status.");
    }
  };

  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-6 text-xs">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Tag className="size-5 text-primary" />
            <DialogTitle className="text-base font-semibold">
              Kelola kode promo
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            {event.title}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Header */}
        <div className="flex items-center justify-between border-b pb-3">
          <span className="font-medium text-foreground">
            Daftar kode promo ({promos.length})
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchPromos}
              disabled={isLoading}
            >
              <RefreshCw className={`size-3.5 mr-1 ${isLoading ? "animate-spin" : ""}`} />
              <span>Muat ulang</span>
            </Button>
            {!isFormOpen && (
              <Button
                type="button"
                size="sm"
                onClick={() => setIsFormOpen(true)}
                className="h-8 text-xs"
              >
                <Plus className="size-3.5 mr-1" />
                <span>Tambah promo baru</span>
              </Button>
            )}
          </div>
        </div>

        {/* Create Form */}
        {isFormOpen && (
          <form onSubmit={handleCreatePromo} className="rounded-xl border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="font-semibold text-foreground text-xs">
                Buat kode promo baru
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsFormOpen(false)}
                className="h-7 text-xs"
              >
                Tutup form
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="promo-code" className="text-xs">
                  Kode promo <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="promo-code"
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Contoh: HEMAT20K / EARLYPASS"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="discount-type" className="text-xs">
                  Tipe diskon <span className="text-destructive">*</span>
                </Label>
                <NativeSelect
                  id="discount-type"
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as PromoDiscountType)}
                  className="h-8 text-xs"
                >
                  <NativeSelectOption value="PERCENT">Persentase (%)</NativeSelectOption>
                  <NativeSelectOption value="NOMINAL">Nominal tetap (Rp)</NativeSelectOption>
                </NativeSelect>
              </div>

              <div className="space-y-1">
                <Label htmlFor="discount-value" className="text-xs">
                  Nilai diskon {discountType === "PERCENT" ? "(%)" : "(Rp)"}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="discount-value"
                  type="number"
                  min={1}
                  max={discountType === "PERCENT" ? 100 : undefined}
                  required
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="promo-quota" className="text-xs">
                  Kuota penggunaan <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="promo-quota"
                  type="number"
                  min={1}
                  required
                  value={quota}
                  onChange={(e) => setQuota(Number(e.target.value))}
                  className="h-8 text-xs font-mono"
                />
              </div>

              {discountType === "PERCENT" && (
                <div className="space-y-1">
                  <Label htmlFor="max-discount" className="text-xs text-muted-foreground">
                    Maksimal potongan (Rp)
                  </Label>
                  <Input
                    id="max-discount"
                    type="number"
                    min={0}
                    value={maxDiscountAmount}
                    onChange={(e) => setMaxDiscountAmount(e.target.value)}
                    placeholder="Opsional, misal 50000"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="min-order" className="text-xs text-muted-foreground">
                  Minimal transaksi (Rp)
                </Label>
                <Input
                  id="min-order"
                  type="number"
                  min={0}
                  value={minOrderAmount}
                  onChange={(e) => setMinOrderAmount(e.target.value)}
                  placeholder="Opsional, misal 100000"
                  className="h-8 text-xs font-mono"
                />
              </div>

              {event.ticketTiers && event.ticketTiers.length > 0 && (
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="applicable-tier" className="text-xs text-muted-foreground">
                    Berlaku untuk jenis tiket
                  </Label>
                  <NativeSelect
                    id="applicable-tier"
                    value={selectedTierId}
                    onChange={(e) => setSelectedTierId(e.target.value)}
                    className="h-8 text-xs"
                  >
                    <NativeSelectOption value="ALL">Semua jenis tiket</NativeSelectOption>
                    {event.ticketTiers.map((t) => (
                      <NativeSelectOption key={t.id} value={t.id}>
                        {t.name} ({formatCurrencyIDR(t.price)})
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="valid-from" className="text-xs text-muted-foreground">
                  Berlaku dari (WITA)
                </Label>
                <Input
                  id="valid-from"
                  type="datetime-local"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="valid-until" className="text-xs text-muted-foreground">
                  Berlaku hingga (WITA)
                </Label>
                <Input
                  id="valid-until"
                  type="datetime-local"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsFormOpen(false)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isCreating || !code.trim()}
              >
                {isCreating ? "Menyimpan..." : "Simpan kode promo"}
              </Button>
            </div>
          </form>
        )}

        {/* Promo List */}
        {isLoading && promos.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-primary" />
            <p>Memuat daftar kode promo...</p>
          </div>
        ) : promos.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
            <Tag className="size-6 mx-auto mb-2 opacity-50" />
            <p className="font-medium text-foreground">Belum ada kode promo</p>
            <p className="text-xs mt-1">Buat kode promo pertama untuk memberikan diskon bagi calon peserta.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {promos.map((p) => {
              const discountLabel =
                p.discountType === "PERCENT"
                  ? `${p.discountValue}%${p.maxDiscountAmount ? ` (maks ${formatCurrencyIDR(p.maxDiscountAmount)})` : ""}`
                  : formatCurrencyIDR(p.discountValue);

              return (
                <div
                  key={p.id}
                  className={`rounded-lg border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    p.isActive ? "bg-card" : "bg-muted/40 opacity-70"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-sm text-foreground">
                        {p.code}
                      </span>
                      <Badge variant={p.isActive ? "default" : "outline"} className="text-xs">
                        {p.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        Potongan {discountLabel}
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
                      <span>
                        Digunakan: <strong className="font-mono text-foreground">{p.usedCount || 0}</strong> / {p.quota} kuota
                      </span>
                      {p.minOrderAmount && (
                        <span>Min. beli: {formatCurrencyIDR(p.minOrderAmount)}</span>
                      )}
                      {p.validUntil && (
                        <span>
                          Berlaku s.d.{" "}
                          {new Date(p.validUntil).toLocaleString("id-ID", {
                            timeZone: "Asia/Makassar",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          WITA
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleTogglePromoStatus(p)}
                      className="h-8 text-xs"
                    >
                      <Power className="size-3.5 mr-1" />
                      <span>{p.isActive ? "Nonaktifkan" : "Aktifkan"}</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter className="pt-3 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs"
          >
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

