import { useState } from "react";

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
import { NativeSelect } from "@/components/ui/native-select";
import type { AreaItem } from "@/contexts/TableContext";

import { formatReservationDateTime } from "./tables-domain";

interface AddReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  areas: AreaItem[];
  onAddReservation: (data: {
    customerName: string;
    phone: string;
    tableId: string;
    areaName: string;
    dateTime: string;
    pax: number;
    downPayment: number;
    notes?: string;
  }) => void;
}

export function AddReservationModal({
  isOpen,
  onClose,
  areas,
  onAddReservation,
}: AddReservationModalProps) {
  const defaultTable = areas[0]?.tables[0]?.number || areas[0]?.tables[0]?.id || "T-01";
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [tableId, setTableId] = useState(defaultTable);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState("19:00");
  const [pax, setPax] = useState(4);
  const [downPayment, setDownPayment] = useState(100000);
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) return;

    let assignedArea = areas[0]?.name || "Indoor Hall";
    for (const a of areas) {
      if (a.tables.some((t) => t.id === tableId || t.number === tableId)) {
        assignedArea = a.name;
        break;
      }
    }

    const dateTime = formatReservationDateTime(date, time);

    onAddReservation({
      customerName: customerName.trim(),
      phone: phone.trim() || "+62 812-xxxx-xxxx",
      tableId,
      areaName: assignedArea,
      dateTime,
      pax: Number(pax),
      downPayment: Number(downPayment),
      notes: notes.trim() || undefined,
    });

    setCustomerName("");
    setPhone("");
    setNotes("");
    onClose();
  };

  const setShortcutDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    setDate(d.toISOString().split("T")[0]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">Buat reservasi</DialogTitle>
          <DialogDescription className="text-xs">
            Catat tamu yang memesan meja, jadwal datang, dan uang muka.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Nama tamu</label>
              <Input
                required
                placeholder="Misalnya Ibu Maya"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Nomor WhatsApp</label>
              <Input
                required
                placeholder="08123456789"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Meja</label>
              <NativeSelect
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
                className="w-full text-xs font-mono"
              >
                {areas.flatMap((a) =>
                  a.tables.map((t) => (
                    <option key={t.id} value={t.number || t.id}>
                      {t.number || t.id} ({a.name} · {t.cap}pax)
                    </option>
                  ))
                )}
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Jumlah tamu</label>
              <Input
                type="number"
                min={1}
                max={20}
                required
                value={pax}
                onChange={(e) => setPax(Number(e.target.value))}
                className="text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Uang muka (Rp)</label>
              <Input
                type="number"
                min={0}
                step={10000}
                value={downPayment}
                onChange={(e) => setDownPayment(Number(e.target.value))}
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <span className="block text-xs font-medium text-foreground">
              Jadwal Kedatangan Tamu
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Tanggal</label>
                <Input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Jam (WITA)</label>
                <Input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
              <span>Cepat:</span>
              <button
                type="button"
                onClick={() => setShortcutDate(0)}
                className="rounded border bg-background px-2 py-0.5 hover:bg-muted"
              >
                Hari ini
              </button>
              <button
                type="button"
                onClick={() => setShortcutDate(1)}
                className="rounded border bg-background px-2 py-0.5 hover:bg-muted"
              >
                Besok
              </button>
              <span className="text-muted-foreground/40">|</span>
              {["12:00", "18:30", "19:00", "20:00"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTime(t)}
                  className={`rounded px-1.5 py-0.5 font-mono ${
                    time === t ? "bg-primary text-primary-foreground font-medium" : "border bg-background hover:bg-muted"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Catatan</label>
            <Input
              placeholder="Misalnya meja sudut, siapkan kursi bayi"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs"
            />
          </div>

          <DialogFooter className="border-t pt-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
              Batal
            </Button>
            <Button type="submit" size="sm" className="text-xs">
              Simpan reservasi
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
