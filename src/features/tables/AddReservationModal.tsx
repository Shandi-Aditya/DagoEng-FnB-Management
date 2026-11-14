"use client";

import { useMemo, useState } from "react";

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
  const [downPayment, setDownPayment] = useState(0);
  const [notes, setNotes] = useState("");

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !phone.trim()) return;

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
      phone: phone.trim(),
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
    setDownPayment(0);
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
            Catat tamu yang memesan meja, jadwal kedatangan, dan uang muka.
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
                      {t.number || t.id} ({a.name} · {t.cap} orang)
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
              Jadwal kedatangan tamu
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Tanggal</label>
                <Input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Jam (WITA)</label>
                <Input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-muted-foreground">
              <span>Cepat:</span>
              <Button
                type="button"
                size="sm"
                variant={date === todayStr ? "default" : "outline"}
                onClick={() => setShortcutDate(0)}
              >
                Hari ini
              </Button>
              <Button
                type="button"
                size="sm"
                variant={date === tomorrowStr ? "default" : "outline"}
                onClick={() => setShortcutDate(1)}
              >
                Besok
              </Button>
              <span className="text-muted-foreground/40">|</span>
              {["12:00", "18:30", "19:00", "20:00"].map((t) => (
                <Button
                  key={t}
                  type="button"
                  size="sm"
                  variant={time === t ? "default" : "outline"}
                  onClick={() => setTime(t)}
                  className="font-mono tabular-nums"
                >
                  {t}
                </Button>
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
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" size="sm">
              Simpan reservasi
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
