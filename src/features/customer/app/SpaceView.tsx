"use client";

import { useMemo, useState } from "react";
import { Laptop, Minus, Plus, Users } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { calculateEndTime, getAvailableTimeSlots, spaceTypeLabel } from "@/features/customer/customer-domain";
import { isRangeFree, slotAvailability } from "@/features/customer/space-slots";
import { COWORKING_MAX_HOURS, isWithinCoworkingHours } from "@/lib/operating-hours";
import { cn, formatCurrencyIDR } from "@/lib/utils";
import type { CoworkingBooking, CoworkingSpaceItem } from "@/types/coworking";

const DAYS_AHEAD = 10;
const WITA = "Asia/Makassar";

export interface SpaceBookingRequest {
  space: CoworkingSpaceItem;
  date: string;
  start: string;
  hours: number;
  name: string;
  phone: string;
  payment: "QRIS" | "CASHIER";
}

interface SpaceViewProps {
  spaces: readonly CoworkingSpaceItem[];
  bookings: readonly CoworkingBooking[];
  isDateOpen: (date: string) => { isOpen: boolean; reason: string };
  defaultName: string;
  defaultPhone: string;
  onBook: (request: SpaceBookingRequest) => void;
  isSubmitting: boolean;
}

function upcomingDays(): { value: string; weekday: string; day: string }[] {
  const today = new Date();
  return Array.from({ length: DAYS_AHEAD }, (_, offset) => {
    const date = new Date(today.getTime() + offset * 86_400_000);
    const value = new Intl.DateTimeFormat("en-CA", { timeZone: WITA }).format(date);
    const weekday = offset === 0 ? "Hari ini" : new Intl.DateTimeFormat("id-ID", { weekday: "short", timeZone: WITA }).format(date);
    const day = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: WITA }).format(date);
    return { value, weekday, day };
  });
}


function currentHourWita(): string {
  const hour = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: WITA,
  }).format(new Date());
  return `${hour}:00`;
}

interface Selection {
  space: CoworkingSpaceItem;
  start: string;
}

/** Pick a day, see each room's free hours, tap one to book it. */
export function SpaceView(props: SpaceViewProps) {
  const days = useMemo(upcomingDays, []);
  const [date, setDate] = useState(
    () => days.find((d) => props.isDateOpen(d.value).isOpen)?.value ?? days[0].value
  );
  const [selection, setSelection] = useState<Selection | null>(null);
  const [hours, setHours] = useState(1);
  const [name, setName] = useState(props.defaultName);
  const [phone, setPhone] = useState(props.defaultPhone);
  const [payment, setPayment] = useState<"QRIS" | "CASHIER">("QRIS");

  const slots = getAvailableTimeSlots();
  const bookable = props.spaces.filter((space) => space.status !== "MAINTENANCE");
  const dayStatus = props.isDateOpen(date);
  const pastCutoff = date === days[0].value ? currentHourWita() : null;

  const open = (space: CoworkingSpaceItem, start: string) => {
    setSelection({ space, start });
    setHours(1);
    setName((current) => current || props.defaultName);
    setPhone((current) => current || props.defaultPhone);
  };

  const canExtend =
    selection !== null &&
    hours < COWORKING_MAX_HOURS &&
    isWithinCoworkingHours(selection.start, hours + 1) &&
    isRangeFree(props.bookings, selection.space.id, date, selection.start, hours + 1);
  const total = selection ? selection.space.hourlyRate * hours : 0;
  const canSubmit = selection !== null && name.trim() !== "" && phone.trim() !== "";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-medium tracking-tight">Pesan ruang kerja</h1>
        <p className="text-sm text-muted-foreground">
          Senin sampai Jumat, pukul 09.00 sampai 18.00 WITA.
        </p>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar" role="group" aria-label="Tanggal">
        {days.map((day) => {
          const isDayOpen = props.isDateOpen(day.value).isOpen;
          return (
            <Button
              key={day.value}
              type="button"
              size="lg"
              variant={day.value === date ? "default" : "outline"}
              aria-pressed={day.value === date}
              onClick={() => setDate(day.value)}
              className={cn(
                "h-auto shrink-0 flex-col gap-0 px-3 py-1.5",
                !isDayOpen && day.value !== date && "opacity-60"
              )}
            >
              <span className="text-xs">{day.weekday}</span>
              <span className="text-sm font-medium">{day.day}</span>
              {!isDayOpen ? <span className="text-xs">Tutup</span> : null}
            </Button>
          );
        })}
      </div>

      {!dayStatus.isOpen ? (
        <EmptyState className="border" icon={<Laptop />} title="Ruang kerja tutup" description={dayStatus.reason || "Pilih hari lain."} />
      ) : bookable.length === 0 ? (
        <EmptyState className="border" icon={<Laptop />} title="Belum ada ruang" description="Ruang kerja belum dibuka untuk dipesan." />
      ) : (
        <ul className="flex flex-col gap-3">
          {bookable.map((space) => (
            <li key={space.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{space.name}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {spaceTypeLabel(space.type)}
                    <Users className="size-3.5" aria-hidden />
                    {space.capacity} orang
                  </span>
                </div>
                <span className="text-right">
                  <span className="font-mono text-sm tabular-nums">{formatCurrencyIDR(space.hourlyRate)}</span>
                  <span className="block text-xs text-muted-foreground">per jam</span>
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {slotAvailability(
                  props.bookings,
                  space.id,
                  date,
                  slots,
                  space.type === "HOT_DESK" ? Math.max(1, space.capacity || 8) : 1
                )
                  .map((slot) => ({ ...slot, isTaken: slot.isTaken || (pastCutoff !== null && slot.time < pastCutoff) }))
                  .map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={slot.isTaken}
                    onClick={() => open(space, slot.time)}
                    aria-label={`${space.name} jam ${slot.time}${slot.isTaken ? ", terisi" : ""}`}
                    className={cn(
                      "h-9 rounded-md border font-mono text-xs tabular-nums transition-colors",
                      slot.isTaken
                        ? "cursor-not-allowed border-transparent bg-muted text-muted-foreground line-through"
                        : "border-unit-coworking/40 bg-unit-coworking/10 hover:bg-unit-coworking/20",
                    )}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={selection !== null} onOpenChange={(isOpen) => !isOpen && setSelection(null)}>
        <SheetContent side="bottom" className="mx-auto max-h-[92svh] max-w-2xl rounded-t-2xl">
          {selection ? (
            <>
              <SheetHeader>
                <SheetTitle className="text-lg font-medium">{selection.space.name}</SheetTitle>
                <SheetDescription>
                  {days.find((day) => day.value === date)?.day}, {selection.start} sampai {calculateEndTime(selection.start, hours)} WITA
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-4">
                <div className="flex items-center justify-between rounded-xl border p-4">
                  <span className="text-sm font-medium">Durasi</span>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" disabled={hours <= 1} onClick={() => setHours((h) => h - 1)} aria-label="Kurangi satu jam">
                      <Minus />
                    </Button>
                    <span className="w-14 text-center text-sm">
                      <span className="font-mono tabular-nums">{hours}</span> jam
                    </span>
                    <Button variant="outline" size="icon" disabled={!canExtend} onClick={() => setHours((h) => h + 1)} aria-label="Tambah satu jam">
                      <Plus />
                    </Button>
                  </div>
                </div>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="space-name">Nama</FieldLabel>
                    <Input id="space-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="space-phone">Nomor WhatsApp</FieldLabel>
                    <Input id="space-phone" type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" required />
                  </Field>
                  <Field>
                    <FieldLabel>Bayar</FieldLabel>
                    <div role="group" aria-label="Metode bayar" className="flex gap-2">
                      {(["QRIS", "CASHIER"] as const).map((method) => (
                        <Button
                          key={method}
                          type="button"
                          size="lg"
                          variant={payment === method ? "default" : "outline"}
                          aria-pressed={payment === method}
                          onClick={() => setPayment(method)}
                          className="h-10 flex-1 text-sm"
                        >
                          {method === "QRIS" ? "QRIS" : "Di kasir"}
                        </Button>
                      ))}
                    </div>
                  </Field>
                </FieldGroup>
                <div className="flex justify-between rounded-xl bg-muted/50 p-4 text-base font-medium">
                  <span>Total</span>
                  <span className="font-mono tabular-nums">{formatCurrencyIDR(total)}</span>
                </div>
              </div>
              <SheetFooter>
                <Button
                  size="lg"
                  className="w-full"
                  disabled={!canSubmit || props.isSubmitting}
                  onClick={() => {
                    props.onBook({ space: selection.space, date, start: selection.start, hours, name, phone, payment });
                    setSelection(null);
                  }}
                >
                  {props.isSubmitting ? <Spinner /> : null}
                  Pesan {hours} jam
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
