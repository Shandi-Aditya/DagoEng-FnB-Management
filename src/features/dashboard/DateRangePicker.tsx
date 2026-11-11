"use client";

import { useState, type FormEvent } from "react";
import { Calendar, Check, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { type DateShortcut, useDateFilter } from "@/contexts/DateFilterContext";
import { cn } from "@/lib/utils";

const SHORTCUTS: { key: Exclude<DateShortcut, "CUSTOM">; label: string }[] = [
  { key: "TODAY", label: "Hari ini" },
  { key: "YESTERDAY", label: "Kemarin" },
  { key: "LAST_7_DAYS", label: "7 hari terakhir" },
  { key: "THIS_MONTH", label: "Bulan ini" },
];

/** Period filter shared by the dashboard and reports. */
export function DateRangePicker() {
  const { startDate, endDate, shortcut, setShortcut, setCustomRange, formattedRangeLabel } = useDateFilter();
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState(startDate);
  const [customEnd, setCustomEnd] = useState(endDate);

  const applyCustom = (event: FormEvent) => {
    event.preventDefault();
    setCustomRange(customStart, customEnd);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" />}>
        <Calendar />
        <span className="tabular-nums">{formattedRangeLabel}</span>
        <ChevronDown className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-3">
        <div className="flex flex-col gap-1">
          {SHORTCUTS.map((item) => {
            const isSelected = shortcut === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setShortcut(item.key);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                  isSelected && "bg-accent font-medium",
                )}
              >
                {item.label}
                {isSelected ? <Check className="size-4" /> : null}
              </button>
            );
          })}
        </div>
        <Separator />
        <form onSubmit={applyCustom} className="flex flex-col gap-3">
          <span className="text-xs text-muted-foreground">Rentang khusus</span>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="range-start">Mulai</Label>
              <Input id="range-start" type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="range-end">Sampai</Label>
              <Input id="range-end" type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} required />
            </div>
          </div>
          <Button type="submit" size="sm" className="self-end">
            Terapkan
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
