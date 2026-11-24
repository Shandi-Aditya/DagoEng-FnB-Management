"use client";

import React from "react";
import { Plus, Trash2, Tag, Calendar, Users, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { EventTicketTier } from "@/types/event";
import { formatCurrencyIDR } from "@/lib/utils";
import { validateEventPrice, validateEventCapacity } from "@/lib/event-validation";

interface TicketTiersEditorProps {
  tiers: EventTicketTier[];
  onChange: (tiers: EventTicketTier[]) => void;
  maxVenueCapacity?: number;
  disabled?: boolean;
  hasSeatingChart?: boolean;
}

function toDateTimeLocalString(isoOrStr?: string): string {
  if (!isoOrStr) return "";
  const trimmed = isoOrStr.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  try {
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return "";
    // Offset to WITA (UTC+8)
    const utcTime = d.getTime() + d.getTimezoneOffset() * 60000;
    const witaTime = new Date(utcTime + 8 * 3600000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = witaTime.getFullYear();
    const mm = pad(witaTime.getMonth() + 1);
    const dd = pad(witaTime.getDate());
    const hh = pad(witaTime.getHours());
    const min = pad(witaTime.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  } catch {
    return "";
  }
}

function fromDateTimeLocalToWitaIso(dtLocal?: string): string | undefined {
  if (!dtLocal || !dtLocal.trim()) return undefined;
  const trimmed = dtLocal.trim();
  if (trimmed.includes("T")) {
    const withSeconds = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
    return `${withSeconds}+08:00`;
  }
  return undefined;
}

export function TicketTiersEditor({
  tiers,
  onChange,
  maxVenueCapacity,
  disabled = false,
  hasSeatingChart = false,
}: TicketTiersEditorProps) {
  const [rawPrices, setRawPrices] = React.useState<Record<string, string>>({});
  const [rawQuotas, setRawQuotas] = React.useState<Record<string, string>>({});

  const getRawPrice = (key: string, num: number) => {
    return rawPrices[key] !== undefined ? rawPrices[key] : String(num ?? 0);
  };
  const getRawQuota = (key: string, num: number) => {
    return rawQuotas[key] !== undefined ? rawQuotas[key] : String(num ?? 50);
  };

  const handleAddTier = () => {
    const nextPrefix = String.fromCharCode(65 + (tiers.length % 26));
    const newTier: EventTicketTier = {
      id: `tier-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: tiers.length === 0 ? "Reguler" : tiers.length === 1 ? "VIP" : `Tier ${tiers.length + 1}`,
      price: 0,
      quota: 50,
      description: "",
      isActive: true,
      rowPrefix: nextPrefix,
      totalRows: 1,
      seatsPerRow: 10,
    };
    onChange([...tiers, newTier]);
  };

  const handleUpdateTier = (index: number, updates: Partial<EventTicketTier>) => {
    const updated = [...tiers];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const onPriceInput = (index: number, key: string, val: string) => {
    setRawPrices((prev) => ({ ...prev, [key]: val }));
    const parsed = val.trim() === "" ? 0 : Number(val);
    handleUpdateTier(index, { price: isNaN(parsed) ? 0 : parsed });
  };

  const onQuotaInput = (index: number, key: string, val: string) => {
    setRawQuotas((prev) => ({ ...prev, [key]: val }));
    const parsed = val.trim() === "" ? 0 : Number(val);
    handleUpdateTier(index, { quota: isNaN(parsed) ? 0 : parsed });
  };

  const handleRemoveTier = (index: number) => {
    const updated = tiers.filter((_, i) => i !== index);
    onChange(updated);
  };

  const totalQuota = tiers.reduce((sum, t) => sum + (Number(t.quota) || 0), 0);
  const minPrice = tiers.length > 0 ? Math.min(...tiers.map((t) => Number(t.price) || 0)) : 0;
  const maxPrice = tiers.length > 0 ? Math.max(...tiers.map((t) => Number(t.price) || 0)) : 0;

  return (
    <div className="space-y-4">
      {/* Header and Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div>
          <h4 className="text-sm font-medium text-foreground">Jenis tiket dan harga</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tentukan kategori tiket seperti Early Bird, Reguler, atau VIP beserta kuota dan masa penjualannya.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
            <Users className="size-3 mr-1" />
            Total kuota: {totalQuota} kursi
          </Badge>
          <Badge variant="secondary" className="text-xs">
            <DollarSign className="size-3 mr-1" />
            {minPrice === 0 && maxPrice === 0
              ? "Semua gratis"
              : minPrice === maxPrice
              ? formatCurrencyIDR(minPrice)
              : `${formatCurrencyIDR(minPrice)} – ${formatCurrencyIDR(maxPrice)}`}
          </Badge>
          {!disabled && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAddTier}
            >
              <Plus className="size-3.5 mr-1" />
              <span>Tambah jenis tiket</span>
            </Button>
          )}
        </div>
      </div>

      {maxVenueCapacity && totalQuota > maxVenueCapacity && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-xs text-warning">
          Total kuota tiket ({totalQuota}) melebihi estimasi kapasitas venue ({maxVenueCapacity} orang).
        </div>
      )}

      {tiers.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <Tag className="size-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">Belum ada jenis tiket bertingkat</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Klik tombol tambah jenis tiket jika event Anda memiliki variasi harga, kuota khusus, atau tanggal jual terpisah.
          </p>
          {!disabled && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAddTier}
              className="mt-3"
            >
              <Plus className="size-3.5 mr-1" />
              <span>Tambah jenis tiket</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {tiers.map((tier, index) => {
            const startLocal = toDateTimeLocalString(tier.salesStartDate);
            const endLocal = toDateTimeLocalString(tier.salesEndDate);
            const hasDateError =
              tier.salesStartDate &&
              tier.salesEndDate &&
              new Date(tier.salesEndDate).getTime() < new Date(tier.salesStartDate).getTime();

            const tierKey = tier.id || String(index);
            const rawPrice = getRawPrice(tierKey, tier.price);
            const rawQuota = getRawQuota(tierKey, tier.quota);

            const isPriceZero = rawPrice === "0" || rawPrice === "" || Number(rawPrice) === 0;
            const priceValResult = isPriceZero
              ? validateEventPrice(false, rawPrice === "" ? "0" : rawPrice)
              : validateEventPrice(true, rawPrice);
            const quotaValResult = validateEventCapacity(rawQuota, false);

            return (
              <div
                key={tier.id || index}
                className="rounded-lg border bg-card p-4 space-y-3 relative group transition-colors hover:border-primary/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary font-mono text-xs font-semibold">
                      {index + 1}
                    </span>
                    <Badge variant={tier.price > 0 ? "default" : "outline"} className="text-xs">
                      {tier.price > 0 ? "Tiket berbayar" : "Tiket gratis"}
                    </Badge>
                  </div>

                  {!disabled && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleRemoveTier(index)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Hapus jenis tiket ini"
                      aria-label="Hapus jenis tiket"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                  {/* Nama jenis tiket */}
                  <div className="sm:col-span-5 space-y-1.5">
                    <Label htmlFor={`tier-name-${index}`} className="text-xs">
                      Nama jenis tiket <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={`tier-name-${index}`}
                      type="text"
                      disabled={disabled}
                      value={tier.name}
                      onChange={(e) => handleUpdateTier(index, { name: e.target.value })}
                      placeholder="Contoh: Early Bird / VIP / Presale"
                      required
                      className="h-8 text-xs"
                    />
                  </div>

                  {/* Harga */}
                  <div className="sm:col-span-4 space-y-1.5">
                    <Label htmlFor={`tier-price-${index}`} className="text-xs">
                      Harga (Rp) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={`tier-price-${index}`}
                      type="number"
                      min={0}
                      step={1}
                      disabled={disabled}
                      value={rawPrice}
                      onChange={(e) => onPriceInput(index, tierKey, e.target.value)}
                      placeholder="0 untuk gratis"
                      required
                      className="h-8 text-xs font-mono"
                    />
                    {!priceValResult.valid && priceValResult.error && (
                      <p className="text-xs text-destructive leading-tight">{priceValResult.error}</p>
                    )}
                  </div>

                  {/* Kuota */}
                  <div className="sm:col-span-3 space-y-1.5">
                    <Label htmlFor={`tier-quota-${index}`} className="text-xs">
                      Kuota tiket <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={`tier-quota-${index}`}
                      type="number"
                      min={1}
                      max={1000}
                      step={1}
                      disabled={disabled}
                      value={rawQuota}
                      onChange={(e) => onQuotaInput(index, tierKey, e.target.value)}
                      placeholder="50"
                      required
                      className="h-8 text-xs font-mono"
                    />
                    {!quotaValResult.valid && quotaValResult.error && (
                      <p className="text-xs text-destructive leading-tight">{quotaValResult.error}</p>
                    )}
                  </div>
                </div>

                {/* Periode Penjualan WITA */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1.5">
                    <Label htmlFor={`tier-start-${index}`} className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="size-3" />
                      <span>Mulai jual (WITA)</span>
                    </Label>
                    <Input
                      id={`tier-start-${index}`}
                      type="datetime-local"
                      disabled={disabled}
                      value={startLocal}
                      onChange={(e) =>
                        handleUpdateTier(index, {
                          salesStartDate: fromDateTimeLocalToWitaIso(e.target.value),
                        })
                      }
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`tier-end-${index}`} className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="size-3" />
                      <span>Berakhir jual (WITA)</span>
                    </Label>
                    <Input
                      id={`tier-end-${index}`}
                      type="datetime-local"
                      disabled={disabled}
                      value={endLocal}
                      onChange={(e) =>
                        handleUpdateTier(index, {
                          salesEndDate: fromDateTimeLocalToWitaIso(e.target.value),
                        })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {hasDateError && (
                  <p className="text-xs text-destructive">
                    Waktu berakhir jual tidak boleh sebelum waktu mulai jual.
                  </p>
                )}

                {/* Keterangan Singkat */}
                <div className="space-y-1.5 text-xs">
                  <Label htmlFor={`tier-desc-${index}`} className="text-xs text-muted-foreground">
                    Keterangan singkat (opsional)
                  </Label>
                  <Input
                    id={`tier-desc-${index}`}
                    type="text"
                    disabled={disabled}
                    value={tier.description || ""}
                    onChange={(e) => handleUpdateTier(index, { description: e.target.value })}
                    placeholder="Contoh: Termasuk goodie bag dan sertifikat fisik"
                    className="h-8 text-xs"
                  />
                </div>

                {/* Konfigurasi Denah Kursi jika hasSeatingChart aktif */}
                {hasSeatingChart && (
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">Pengaturan nomor kursi</span>
                      <span className="font-mono text-xs text-primary font-medium">
                        {tier.rowPrefix
                          ? `Denah: ${tier.rowPrefix}1–${tier.rowPrefix}${tier.seatsPerRow || 10}`
                          : "Format otomatis"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="space-y-1">
                        <Label htmlFor={`tier-row-prefix-${index}`} className="text-xs text-muted-foreground">
                          Huruf baris (contoh A/VIP)
                        </Label>
                        <Input
                          id={`tier-row-prefix-${index}`}
                          type="text"
                          maxLength={4}
                          disabled={disabled}
                          value={tier.rowPrefix || ""}
                          onChange={(e) => handleUpdateTier(index, { rowPrefix: e.target.value.toUpperCase() })}
                          placeholder={index === 0 ? "A" : index === 1 ? "B" : "C"}
                          className="h-8 text-xs font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor={`tier-total-rows-${index}`} className="text-xs text-muted-foreground">
                          Jumlah baris
                        </Label>
                        <Input
                          id={`tier-total-rows-${index}`}
                          type="number"
                          min={1}
                          max={26}
                          disabled={disabled}
                          value={tier.totalRows ?? 1}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            handleUpdateTier(index, { totalRows: isNaN(val) || val < 1 ? 1 : val });
                          }}
                          className="h-8 text-xs font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor={`tier-seats-per-row-${index}`} className="text-xs text-muted-foreground">
                          Kursi per baris
                        </Label>
                        <Input
                          id={`tier-seats-per-row-${index}`}
                          type="number"
                          min={1}
                          max={100}
                          disabled={disabled}
                          value={tier.seatsPerRow ?? (tier.quota || 10)}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            handleUpdateTier(index, { seatsPerRow: isNaN(val) || val < 1 ? 1 : val });
                          }}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

