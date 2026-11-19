"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { CommunityEvent, EventCategory } from "@/types/event";
import { eventCategoryLabel } from "./events-admin-domain";
import { validateEventPrice, validateEventCapacity } from "@/lib/event-validation";

function toWitaDateTimeLocal(value?: string): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return value.slice(0, 16);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(parsed);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function fromWitaDateTimeLocal(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00+08:00`;
  }
  return trimmed;
}

const CATEGORIES: EventCategory[] = [
  "WORKSHOP",
  "MEETUP",
  "CREATIVE",
  "COMMUNITY",
  "TECH",
  "SEMINAR",
  "OTHER",
];

export interface EventEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CommunityEvent | null;
  formData: Partial<CommunityEvent>;
  onFormDataChange: (data: Partial<CommunityEvent>) => void;
  guidelinesText: string;
  onGuidelinesTextChange: (text: string) => void;
  onSave: () => void;
  isSaving?: boolean;
}

export function EventEditModal({
  open,
  onOpenChange,
  event,
  formData,
  onFormDataChange,
  guidelinesText,
  onGuidelinesTextChange,
  onSave,
  isSaving,
}: EventEditModalProps) {
  const [rawPrice, setRawPrice] = useState<string>(
    formData.price !== undefined ? String(formData.price) : "0"
  );
  const [rawQuota, setRawQuota] = useState<string>(
    formData.maxCapacity !== undefined ? String(formData.maxCapacity) : "30"
  );
  const [priceError, setPriceError] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState<string | null>(null);

  useEffect(() => {
    if (open && event) {
      const p = formData.price !== undefined ? String(formData.price) : String(event.price ?? 0);
      const q = formData.maxCapacity !== undefined ? String(formData.maxCapacity) : String(event.maxCapacity ?? 30);
      setRawPrice(p);
      setRawQuota(q);
      setPriceError(null);
      setQuotaError(null);
    }
  }, [open, event?.id]);

  if (!event) return null;

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setRawPrice(raw);
    if (raw === "") {
      setPriceError(null);
      onFormDataChange({ ...formData, price: 0, isPaid: false });
      return;
    }
    const isPaid = raw !== "0";
    const res = validateEventPrice(isPaid, raw);
    if (!res.valid) {
      setPriceError(res.error || "Harga tiket tidak valid.");
    } else {
      setPriceError(null);
      onFormDataChange({ ...formData, price: res.value, isPaid: (res.value ?? 0) > 0 });
    }
  };

  const handleQuotaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setRawQuota(raw);
    if (raw === "") {
      setQuotaError("Kapasitas maksimal venue/tiket wajib diisi.");
      onFormDataChange({ ...formData, maxCapacity: undefined });
      return;
    }
    const res = validateEventCapacity(raw, false);
    if (!res.valid) {
      setQuotaError(res.error || "Kapasitas kuota tidak valid.");
    } else {
      setQuotaError(null);
      onFormDataChange({ ...formData, maxCapacity: res.value });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ubah informasi event</DialogTitle>
          <DialogDescription>
            Perbarui jadwal, lokasi, kuota, atau ketentuan untuk event "{event.title}".
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2 text-xs">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editTitle">Judul event</Label>
            <Input
              id="editTitle"
              type="text"
              value={formData.title || ""}
              onChange={(e) => onFormDataChange({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editCategory">Kategori</Label>
              <NativeSelect
                id="editCategory"
                value={formData.category || "COMMUNITY"}
                onChange={(e) =>
                  onFormDataChange({ ...formData, category: e.target.value as EventCategory })
                }
              >
                {CATEGORIES.map((cat) => (
                  <NativeSelectOption key={cat} value={cat}>
                    {eventCategoryLabel(cat)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editLocation">Lokasi / Venue</Label>
              <Input
                id="editLocation"
                type="text"
                value={formData.location || ""}
                onChange={(e) => onFormDataChange({ ...formData, location: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editStartDate">Waktu mulai (WITA)</Label>
              <Input
                id="editStartDate"
                type="datetime-local"
                value={toWitaDateTimeLocal(formData.startDate)}
                onChange={(e) =>
                  onFormDataChange({
                    ...formData,
                    startDate: fromWitaDateTimeLocal(e.target.value),
                  })
                }
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editEndDate">Waktu selesai (WITA)</Label>
              <Input
                id="editEndDate"
                type="datetime-local"
                value={toWitaDateTimeLocal(formData.endDate)}
                onChange={(e) =>
                  onFormDataChange({
                    ...formData,
                    endDate: fromWitaDateTimeLocal(e.target.value),
                  })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editPrice">Harga tiket (Rp)</Label>
              <Input
                id="editPrice"
                type="number"
                min={0}
                step={1}
                value={rawPrice}
                onChange={handlePriceChange}
                required
              />
              {priceError && <p className="text-xs text-destructive">{priceError}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editQuota">Kuota peserta (1–1.000)</Label>
              <Input
                id="editQuota"
                type="number"
                min={1}
                max={1000}
                step={1}
                value={rawQuota}
                onChange={handleQuotaChange}
                required
              />
              {quotaError && <p className="text-xs text-destructive">{quotaError}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editDescription">Deskripsi</Label>
            <textarea
              id="editDescription"
              rows={3}
              value={formData.description || ""}
              onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
              className="w-full rounded-md border bg-card p-2 text-xs text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editGuidelines">Panduan & ketentuan acara (1 baris per poin)</Label>
            <textarea
              id="editGuidelines"
              rows={3}
              value={guidelinesText}
              onChange={(e) => onGuidelinesTextChange(e.target.value)}
              placeholder="Contoh:&#10;Bawa laptop masing-masing&#10;Dilarang membawa makanan dari luar"
              className="w-full rounded-md border bg-card p-2 text-xs text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <DialogFooter className="border-t pt-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Batal
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={onSave}
            disabled={isSaving || Boolean(priceError) || Boolean(quotaError)}
          >
            {isSaving ? "Menyimpan…" : "Simpan perubahan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
