import { useState, useMemo, useEffect } from "react";
import { Laptop, Calendar, Clock, AlertTriangle, MapPin } from "lucide-react";
import type { CoworkingSpaceItem, CoworkingBooking } from "@/types/coworking";
import { formatCurrencyIDR } from "@/lib/utils";
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
import { NativeSelect } from "@/components/ui/native-select";
import {
  validateCoworkingDateRange,
  checkCoworkingBookingConflict,
  type CoworkingHolidayConfig,
} from "@/lib/operating-hours";
import {
  computeBookingPricing,
  calculateHourlyEndTime,
  spaceTypeLabel,
  type DailyPreset,
} from "./coworking-domain";

export interface NewBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaces: CoworkingSpaceItem[];
  bookings: CoworkingBooking[];
  coworkingHolidays?: CoworkingHolidayConfig;
  defaultSpaceId?: string;
  onSubmit: (params: {
    guestName: string;
    guestPhone: string;
    guestEmail: string;
    company?: string;
    space: CoworkingSpaceItem;
    bookingType: "HOURLY" | "DAILY" | "MONTHLY";
    date: string;
    endDate?: string;
    startTime: string;
    endTime?: string;
    duration: number;
    totalAmount: number;
    paymentMethod: string;
    isImmediateCheckIn: boolean;
  }) => void;
}

const OPERATIONAL_TIME_SLOTS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];

export function NewBookingModal({
  isOpen,
  onClose,
  spaces,
  bookings,
  coworkingHolidays,
  defaultSpaceId,
  onSubmit,
}: NewBookingModalProps) {
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const [bookSpaceId, setBookSpaceId] = useState(defaultSpaceId || spaces[0]?.id || "");
  const [bookType, setBookType] = useState<"HOURLY" | "DAILY" | "MONTHLY">("HOURLY");
  const [bookDurationHours, setBookDurationHours] = useState<number>(2);
  const [bookDailyPreset, setBookDailyPreset] = useState<DailyPreset>("1_DAY");
  const [bookStartDate, setBookStartDate] = useState(todayStr);
  const [bookEndDate, setBookEndDate] = useState(todayStr);
  const [bookStartTime, setBookStartTime] = useState("09:00");
  const [bookGuestName, setBookGuestName] = useState("");
  const [bookPhone, setBookPhone] = useState("");
  const [bookEmail, setBookEmail] = useState("");
  const [bookCompany, setBookCompany] = useState("");
  const [bookPaymentMethod, setBookPaymentMethod] = useState("QRIS");
  const [bookIsImmediateCheckIn, setBookIsImmediateCheckIn] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (defaultSpaceId) {
      setBookSpaceId(defaultSpaceId);
    } else if (spaces[0]?.id && !bookSpaceId) {
      setBookSpaceId(spaces[0].id);
    }
  }, [defaultSpaceId, spaces, bookSpaceId]);

  const selectedSpace = useMemo(
    () => spaces.find((s) => s.id === bookSpaceId) || spaces[0],
    [spaces, bookSpaceId]
  );

  const pricing = useMemo(() => {
    if (!selectedSpace) {
      return {
        computedDuration: 1,
        computedTotal: 0,
        computedEndDate: bookStartDate,
        computedEndTime: "18:00 WITA",
      };
    }
    return computeBookingPricing({
      space: selectedSpace,
      bookType,
      durationHours: bookDurationHours,
      dailyPreset: bookDailyPreset,
      startDate: bookStartDate,
      endDate: bookEndDate,
      startTime: bookStartTime,
    });
  }, [
    selectedSpace,
    bookType,
    bookDurationHours,
    bookDailyPreset,
    bookStartDate,
    bookEndDate,
    bookStartTime,
  ]);

  const resetForm = () => {
    setBookGuestName("");
    setBookPhone("");
    setBookEmail("");
    setBookCompany("");
    setErrorMessage("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!bookGuestName.trim() || !bookPhone.trim() || !selectedSpace) {
      setErrorMessage("Isi nama dan nomor WhatsApp tamu.");
      return;
    }

    // 1. Holiday & operating hours validation
    const holidayCheck = validateCoworkingDateRange(
      bookStartDate,
      pricing.computedEndDate,
      coworkingHolidays
    );
    if (!holidayCheck.isValid) {
      const firstClosed = holidayCheck.closedDates[0];
      setErrorMessage(
        `Booking ditolak: ${firstClosed.reason} (${firstClosed.date}). Co-working tutup kecuali dibuka via override di Pengaturan.`
      );
      return;
    }

    // 2. Double-booking conflict validation
    const conflict = checkCoworkingBookingConflict(bookings, {
      spaceId: selectedSpace.id,
      spaceName: selectedSpace.name,
      bookingType: bookType,
      date: bookStartDate,
      endDate: pricing.computedEndDate,
      startTime: bookType === "HOURLY" ? `${bookStartTime} WITA` : "09:00 WITA",
      endTime: pricing.computedEndTime,
    });
    if (conflict.hasConflict) {
      setErrorMessage(`Booking ditolak: ${conflict.message}`);
      return;
    }

    const dateFormatted = new Date(bookStartDate).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const endDateFormatted = pricing.computedEndDate
      ? new Date(pricing.computedEndDate).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : undefined;

    onSubmit({
      guestName: bookGuestName.trim(),
      guestPhone: bookPhone.trim(),
      guestEmail: bookEmail.trim() || "-",
      company: bookCompany.trim() || undefined,
      space: selectedSpace,
      bookingType: bookType,
      date: dateFormatted,
      endDate: endDateFormatted,
      startTime: bookType === "HOURLY" ? `${bookStartTime} WITA` : "09:00 WITA",
      endTime: pricing.computedEndTime,
      duration: pricing.computedDuration,
      totalAmount: pricing.computedTotal,
      paymentMethod: bookPaymentMethod,
      isImmediateCheckIn: bookIsImmediateCheckIn,
    });

    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base font-medium">
            <Laptop className="size-4 text-primary" />
            <span>Buat booking</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Pilih paket durasi, slot jam operasional, atau rentang tanggal sewa.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto py-1 pr-1 text-xs">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs font-medium text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Selected Space Preview */}
          {selectedSpace && (
            <div className="space-y-1.5 rounded-lg border bg-muted/40 p-3 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="block text-xs font-medium text-muted-foreground">
                    {spaceTypeLabel(selectedSpace.type)}
                  </span>
                  <h4 className="mt-0.5 text-sm font-medium text-foreground">
                    {selectedSpace.name}
                  </h4>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3 text-muted-foreground" />
                    <span>{selectedSpace.area} · Kapasitas: {selectedSpace.capacity} orang</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="block text-xs text-muted-foreground">Tarif</span>
                  <p className="font-mono text-xs font-medium tabular-nums text-foreground">
                    {formatCurrencyIDR(selectedSpace.hourlyRate)} / jam
                  </p>
                  <p className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatCurrencyIDR(selectedSpace.dailyRate)} / hari
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Space Selection */}
          <div className="space-y-1.5">
            <Label htmlFor="booking-space" className="text-xs font-medium text-foreground">
              Pilih ruang atau meja
            </Label>
            <NativeSelect
              id="booking-space"
              value={bookSpaceId}
              onChange={(e) => setBookSpaceId(e.target.value)}
              className="w-full text-xs"
            >
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({spaceTypeLabel(s.type)} · {s.status === "AVAILABLE" ? "Tersedia" : "Terisi"})
                </option>
              ))}
            </NativeSelect>
          </div>

          {/* Booking Type Switcher */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">Paket sewa</Label>
            <div className="grid grid-cols-3 gap-1.5 rounded-lg border bg-muted/40 p-1">
              <Button
                type="button"
                size="sm"
                variant={bookType === "HOURLY" ? "default" : "ghost"}
                onClick={() => {
                  setBookType("HOURLY");
                  setBookDurationHours(2);
                }}
              >
                Per jam
              </Button>
              <Button
                type="button"
                size="sm"
                variant={bookType === "DAILY" ? "default" : "ghost"}
                onClick={() => {
                  setBookType("DAILY");
                  setBookDailyPreset("1_DAY");
                }}
              >
                Harian
              </Button>
              <Button
                type="button"
                size="sm"
                variant={bookType === "MONTHLY" ? "default" : "ghost"}
                onClick={() => setBookType("MONTHLY")}
              >
                Bulanan (30 hari)
              </Button>
            </div>
          </div>

          {/* Hourly Mode Details */}
          {bookType === "HOURLY" && (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="hourly-date" className="flex items-center gap-1 text-xs text-foreground">
                    <Calendar className="size-3.5 text-muted-foreground" />
                    <span>Tanggal</span>
                  </Label>
                  <Input
                    id="hourly-date"
                    type="date"
                    value={bookStartDate}
                    onChange={(e) => {
                      setBookStartDate(e.target.value);
                      setBookEndDate(e.target.value);
                    }}
                    className="text-xs font-mono"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="hourly-dur" className="text-xs text-foreground">Durasi (jam)</Label>
                    <span className="text-xs text-muted-foreground">Minimal 2 jam</span>
                  </div>
                  <Input
                    id="hourly-dur"
                    type="number"
                    min={2}
                    max={12}
                    value={bookDurationHours}
                    onChange={(e) => setBookDurationHours(Math.max(2, Number(e.target.value)))}
                    className="text-xs font-mono"
                    required
                  />
                </div>
              </div>

              {/* Time Slots */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1 text-xs text-foreground">
                    <Clock className="size-3.5 text-primary" />
                    <span>Jam mulai (09:00–18:00)</span>
                  </Label>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    Selesai: {calculateHourlyEndTime(bookStartTime, bookDurationHours)} WITA
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {OPERATIONAL_TIME_SLOTS.map((slot) => (
                    <Button
                      key={slot}
                      type="button"
                      size="sm"
                      variant={bookStartTime === slot ? "default" : "outline"}
                      onClick={() => setBookStartTime(slot)}
                      className="font-mono"
                    >
                      {slot}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Daily Mode Details */}
          {bookType === "DAILY" && (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-3 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs text-foreground">Durasi harian</Label>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                  {[
                    { key: "1_DAY", label: "1 Hari" },
                    { key: "3_DAYS", label: "3 Hari" },
                    { key: "7_DAYS", label: "7 Hari" },
                    { key: "14_DAYS", label: "14 Hari" },
                    { key: "CUSTOM_RANGE", label: "Rentang" },
                  ].map((item) => (
                    <Button
                      key={item.key}
                      type="button"
                      size="sm"
                      variant={bookDailyPreset === item.key ? "default" : "outline"}
                      onClick={() => setBookDailyPreset(item.key as DailyPreset)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="daily-start" className="text-xs text-foreground">Mulai</Label>
                  <Input
                    id="daily-start"
                    type="date"
                    value={bookStartDate}
                    onChange={(e) => setBookStartDate(e.target.value)}
                    className="text-xs font-mono"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="daily-end" className="text-xs text-foreground">Selesai</Label>
                  <Input
                    id="daily-end"
                    type="date"
                    min={bookStartDate}
                    disabled={bookDailyPreset !== "CUSTOM_RANGE"}
                    value={pricing.computedEndDate || bookStartDate}
                    onChange={(e) => setBookEndDate(e.target.value)}
                    className="text-xs font-mono"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Monthly Mode Details */}
          {bookType === "MONTHLY" && (
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-xs">
              <Label htmlFor="monthly-start" className="text-xs text-foreground">Mulai (akses 30 hari)</Label>
              <Input
                id="monthly-start"
                type="date"
                value={bookStartDate}
                onChange={(e) => setBookStartDate(e.target.value)}
                className="text-xs font-mono"
                required
              />
              <p className="text-xs text-muted-foreground">
                Termasuk dedicated desk, loker pribadi, dan kuota ruang rapat.
              </p>
            </div>
          )}

          {/* Customer Details */}
          <div className="space-y-3 border-t pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="guest-name" className="text-xs font-medium text-foreground">
                Nama tamu <span className="text-destructive">*</span>
              </Label>
              <Input
                id="guest-name"
                required
                placeholder="Misalnya Sarah Jenkins"
                value={bookGuestName}
                onChange={(e) => setBookGuestName(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="guest-phone" className="text-xs font-medium text-foreground">
                  Nomor WhatsApp <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="guest-phone"
                  required
                  placeholder="081234567890"
                  value={bookPhone}
                  onChange={(e) => setBookPhone(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="guest-email" className="text-xs font-medium text-foreground">
                  Email (opsional)
                </Label>
                <Input
                  id="guest-email"
                  type="email"
                  placeholder="nomad@example.com"
                  value={bookEmail}
                  onChange={(e) => setBookEmail(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="guest-company" className="text-xs font-medium text-foreground">
                Perusahaan atau catatan
              </Label>
              <Input
                id="guest-company"
                placeholder="Misalnya butuh stopkontak tambahan"
                value={bookCompany}
                onChange={(e) => setBookCompany(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {/* Payment & Check-In */}
          <div className="space-y-3 border-t pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="booking-payment" className="text-xs font-medium text-foreground">Metode bayar</Label>
                <NativeSelect
                  id="booking-payment"
                  value={bookPaymentMethod}
                  onChange={(e) => setBookPaymentMethod(e.target.value)}
                  className="w-full text-xs"
                >
                  <option value="QRIS">QRIS</option>
                  <option value="CASH">Tunai</option>
                  <option value="EDC">Kartu (EDC)</option>
                  <option value="TRANSFER">Transfer bank</option>
                </NativeSelect>
              </div>

              <div className="flex flex-col justify-end pb-1.5">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={bookIsImmediateCheckIn}
                    onChange={(e) => setBookIsImmediateCheckIn(e.target.checked)}
                    className="size-4 rounded text-primary"
                  />
                  <span>Langsung check-in</span>
                </label>
              </div>
            </div>

            {/* Bill Preview Card */}
            <div className="flex items-center justify-between rounded-lg border bg-card p-3">
              <div>
                <span className="block text-xs font-medium text-muted-foreground">
                  Total tagihan
                </span>
                <span className="text-xs text-muted-foreground">
                  {bookType === "HOURLY"
                    ? `${pricing.computedDuration} jam (${bookStartTime} – ${pricing.computedEndTime})`
                    : bookType === "DAILY"
                    ? `${pricing.computedDuration} hari (${bookStartDate})`
                    : "Paket bulanan 30 hari"}
                </span>
              </div>
              <span className="font-mono text-base font-semibold tabular-nums text-foreground">
                {formatCurrencyIDR(pricing.computedTotal)}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 border-t pt-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
            >
              Batal
            </Button>
            <Button type="submit" size="sm">
              {bookIsImmediateCheckIn ? "Simpan dan check-in" : "Simpan booking"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
