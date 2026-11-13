"use client";

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
  if (!event) return null;

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
                    {cat}
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
              <Label htmlFor="editStartDate">Waktu mulai</Label>
              <Input
                id="editStartDate"
                type="datetime-local"
                value={formData.startDate ? formData.startDate.slice(0, 16) : ""}
                onChange={(e) => onFormDataChange({ ...formData, startDate: e.target.value })}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editEndDate">Waktu selesai</Label>
              <Input
                id="editEndDate"
                type="datetime-local"
                value={formData.endDate ? formData.endDate.slice(0, 16) : ""}
                onChange={(e) => onFormDataChange({ ...formData, endDate: e.target.value })}
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
                value={formData.price ?? 0}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    onFormDataChange({ ...formData, price: 0, isPaid: false });
                    return;
                  }
                  if (raw.includes(".") || raw.includes(",")) return;
                  const val = Number(raw);
                  if (Number.isSafeInteger(val) && val >= 0) {
                    onFormDataChange({ ...formData, price: val, isPaid: val > 0 });
                  }
                }}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editQuota">Kuota peserta (1–1.000)</Label>
              <Input
                id="editQuota"
                type="number"
                min={1}
                max={1000}
                step={1}
                value={formData.maxCapacity ?? 30}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    onFormDataChange({ ...formData, maxCapacity: undefined });
                    return;
                  }
                  if (raw.includes(".") || raw.includes(",")) return;
                  const val = Number(raw);
                  if (Number.isSafeInteger(val) && val >= 1 && val <= 1000) {
                    onFormDataChange({ ...formData, maxCapacity: val });
                  }
                }}
                required
              />
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

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Batal
          </Button>
          <Button type="button" onClick={onSave} disabled={isSaving}>
            {isSaving ? "Menyimpan…" : "Simpan perubahan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
