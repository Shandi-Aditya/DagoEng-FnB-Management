import { useState, useMemo, useEffect } from "react";
import { Laptop, Calendar, Clock, AlertTriangle, CheckCircle2, MapPin } from "lucide-react";
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
  isCoworkingDateOpen,
  validateCoworkingDateRange,
  checkCoworkingBookingConflict,
  type CoworkingHolidayConfig,
} from "@/lib/operating-hours";
import {
  computeBookingPricing,
  calculateHourlyEndTime,
  calculateDaysCount,
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
  const [bookPaymentMethod, setBookPaymentMethod] = useState("QRIS DagoPay");
  const [bookIsImmediateCheckIn, setBookIsImmediateCheckIn] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (defaultSpaceId) {
      setBookSpaceId(defaultSpaceId);
    } else if (spaces[0]?.id && !bookSpaceId) {
      setBookSpaceId(spaces[0].id);
    }
  }, [defaultSpaceId, spaces]);

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
      setErrorMessage("Mohon lengkapi nama dan nomor WhatsApp tamu.");
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
        `Booking Ditolak: ${firstClosed.reason} (${firstClosed.date}). Co-working tutup kecuali dibuka via Override di Pengaturan.`
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
      setErrorMessage(`Booking Ditolak: ${conflict.message}`);
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
      guestEmail: bookEmail.trim() || "guest@nomad.com",
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Laptop className="w-5 h-5 text-primary" />
            <span>Buat Booking & Check-In Co-working</span>
          </DialogTitle>
          <DialogDescription>
            Pilih paket durasi, slot jam operasional, atau rentang tanggal sewa.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1 py-1">
          {errorMessage && (
            <div className="p-3 rounded-lg border bg-destructive/10 border-destructive/30 text-destructive text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Selected Space Preview */}
          {selectedSpace && (
            <div className="p-3 rounded-lg border bg-muted/40 space-y-1.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">
                    {selectedSpace.type.replace("_", " ")}
                  </span>
                  <h4 className="font-medium text-sm text-foreground mt-0.5">
                    {selectedSpace.name}
                  </h4>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    <span>{selectedSpace.area} • Kapasitas: {selectedSpace.capacity} Orang</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground block">Tarif</span>
                  <p className="font-mono font-medium text-xs text-foreground">
                    {formatCurrencyIDR(selectedSpace.hourlyRate)} / jam
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {formatCurrencyIDR(selectedSpace.dailyRate)} / hari
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Space Selection */}
          <div className="space-y-1.5">
            <Label htmlFor="booking-space" className="text-xs">
              Pilih Ruang / Meja Kerja
            </Label>
            <NativeSelect
              id="booking-space"
              value={bookSpaceId}
              onChange={(e) => setBookSpaceId(e.target.value)}
              className="w-full text-xs font-medium"
            >
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.type.replace("_", " ")} • {s.status === "AVAILABLE" ? "Tersedia" : "Terisi"})
                </option>
              ))}
            </NativeSelect>
          </div>

          {/* Booking Type Switcher */}
          <div className="space-y-1.5">
            <Label className="text-xs">Tipe Sewa & Paket</Label>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg border bg-muted/40">
              <Button
                type="button"
                size="sm"
                variant={bookType === "HOURLY" ? "default" : "ghost"}
                onClick={() => {
                  setBookType("HOURLY");
                  setBookDurationHours(2);
                }}
                className="text-xs h-8"
              >
                Paket Jam
              </Button>
              <Button
                type="button"
                size="sm"
                variant={bookType === "DAILY" ? "default" : "ghost"}
                onClick={() => {
                  setBookType("DAILY");
                  setBookDailyPreset("1_DAY");
                }}
                className="text-xs h-8"
              >
                Harian
              </Button>
              <Button
                type="button"
                size="sm"
                variant={bookType === "MONTHLY" ? "default" : "ghost"}
                onClick={() => setBookType("MONTHLY")}
                className="text-xs h-8"
              >
                Bulanan (30 Hari)
              </Button>
            </div>
          </div>

          {/* Hourly Mode Details */}
          {bookType === "HOURLY" && (
            <div className="p-3 rounded-lg border bg-muted/20 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="hourly-date" className="text-xs flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
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
                    className="text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="hourly-dur" className="text-xs">Durasi Jam</Label>
                    <span className="text-[10px] text-muted-foreground">Min. 2 Jam</span>
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
                  <Label className="text-xs flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span>Jam Mulai (09:00 - 18:00)</span>
                  </Label>
                  <span className="text-[11px] font-mono text-muted-foreground">
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
                      className="text-xs h-7 font-mono"
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
            <div className="p-3 rounded-lg border bg-muted/20 space-y-3 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs">Pilihan Durasi Harian</Label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
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
                      className="text-xs h-7"
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="daily-start" className="text-xs">Tanggal Mulai</Label>
                  <Input
                    id="daily-start"
                    type="date"
                    value={bookStartDate}
                    onChange={(e) => setBookStartDate(e.target.value)}
                    className="text-xs"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="daily-end" className="text-xs">Tanggal Selesai</Label>
                  <Input
                    id="daily-end"
                    type="date"
                    min={bookStartDate}
                    disabled={bookDailyPreset !== "CUSTOM_RANGE"}
                    value={pricing.computedEndDate || bookStartDate}
                    onChange={(e) => setBookEndDate(e.target.value)}
                    className="text-xs"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Monthly Mode Details */}
          {bookType === "MONTHLY" && (
            <div className="p-3 rounded-lg border bg-muted/20 space-y-2 text-xs">
              <Label htmlFor="monthly-start" className="text-xs">Tanggal Mulai (30 Hari Akses)</Label>
              <Input
                id="monthly-start"
                type="date"
                value={bookStartDate}
                onChange={(e) => setBookStartDate(e.target.value)}
                className="text-xs"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Termasuk dedicated desk, loker pribadi, dan kuota ruang rapat.
              </p>
            </div>
          )}

          {/* Customer Details */}
          <div className="space-y-3 pt-2 border-t">
            <div className="space-y-1.5">
              <Label htmlFor="guest-name" className="text-xs">
                Nama Tamu / Penyewa <span className="text-destructive">*</span>
              </Label>
              <Input
                id="guest-name"
                required
                placeholder="Contoh: Sarah Jenkins / PT Nomad Tech"
                value={bookGuestName}
                onChange={(e) => setBookGuestName(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="guest-phone" className="text-xs">
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
                <Label htmlFor="guest-email" className="text-xs">
                  Email (Opsional)
                </Label>
                <Input
                  id="guest-email"
                  type="email"
                  placeholder="nomad@example.com"
                  value={bookEmail}
                  onChange={(e) => setBookEmail(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="guest-company" className="text-xs">
                Perusahaan / Catatan Khusus
              </Label>
              <Input
                id="guest-company"
                placeholder="Contoh: Tim IT Remote, butuh stopkontak tambahan"
                value={bookCompany}
                onChange={(e) => setBookCompany(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {/* Payment & Check-In */}
          <div className="space-y-3 pt-2 border-t">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="booking-payment" className="text-xs">Metode Pembayaran</Label>
                <NativeSelect
                  id="booking-payment"
                  value={bookPaymentMethod}
                  onChange={(e) => setBookPaymentMethod(e.target.value)}
                  className="w-full text-xs"
                >
                  <option value="QRIS DagoPay">QRIS DagoPay (Instant)</option>
                  <option value="CASH">Tunai (Kasir)</option>
                  <option value="EDC / Debit Card">EDC / Kartu Debit</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </NativeSelect>
              </div>

              <div className="flex flex-col justify-end pb-1.5">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={bookIsImmediateCheckIn}
                    onChange={(e) => setBookIsImmediateCheckIn(e.target.checked)}
                    className="w-4 h-4 rounded text-primary"
                  />
                  <span>Langsung Check-In (Walk-In)</span>
                </label>
              </div>
            </div>

            {/* Bill Preview Card */}
            <div className="p-3 rounded-lg border bg-card flex items-center justify-between">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-medium block">
                  Total Tagihan
                </span>
                <span className="text-xs text-muted-foreground">
                  {bookType === "HOURLY"
                    ? `${pricing.computedDuration} Jam (${bookStartTime} – ${pricing.computedEndTime})`
                    : bookType === "DAILY"
                    ? `${pricing.computedDuration} Hari (${bookStartDate})`
                    : "Paket Bulanan 30 Hari"}
                </span>
              </div>
              <span className="text-base font-bold font-mono tabular-nums text-foreground">
                {formatCurrencyIDR(pricing.computedTotal)}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              className="text-xs"
            >
              Batal
            </Button>
            <Button type="submit" size="sm" className="text-xs font-medium">
              {bookIsImmediateCheckIn ? "Simpan & Check-In" : "Simpan Reservasi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
