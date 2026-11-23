"use client";

import type React from "react";
import { Building, Calendar, Globe, Plus, QrCode, Receipt, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { INDONESIAN_NATIONAL_HOLIDAYS_2026, type HolidayOverrideDate } from "@/lib/operating-hours";
import type { CategoryTaxType, OutletReceiptCombineMode } from "@/types/settings";

export interface PlatformConfigTabProps {
  // Business Modules
  moduleDefinitions: Array<{
    code: string;
    name: string;
    desc: string;
    icon: React.ReactNode;
    isRequired?: boolean;
  }>;
  activeOrgModules: string[];
  onToggleOrgModule: (code: string) => void;
  // Localization
  language: "id" | "en";
  onLanguageChange: (val: "id" | "en") => void;
  timezone: string;
  onTimezoneChange: (val: string) => void;
  currency: string;
  onCurrencyChange: (val: string) => void;
  // Tax
  fnbTaxEnabled: boolean;
  onFnbTaxEnabledChange: (val: boolean) => void;
  fnbTaxRate: number;
  onFnbTaxRateChange: (val: number) => void;
  cwTaxEnabled: boolean;
  onCwTaxEnabledChange: (val: boolean) => void;
  cwTaxType: CategoryTaxType;
  onCwTaxTypeChange: (val: CategoryTaxType) => void;
  cwTaxRate: number;
  onCwTaxRateChange: (val: number) => void;
  serviceCharge: number;
  onServiceChargeChange: (val: number) => void;
  // Thresholds & Loyalty
  lowStock: number;
  onLowStockChange: (val: number) => void;
  silverPts: number;
  onSilverPtsChange: (val: number) => void;
  goldPts: number;
  onGoldPtsChange: (val: number) => void;
  platPts: number;
  onPlatPtsChange: (val: number) => void;
  // Operating Hours
  cwOpenTime: string;
  onCwOpenTimeChange: (val: string) => void;
  cwCloseTime: string;
  onCwCloseTimeChange: (val: string) => void;
  fnbOpenTime: string;
  onFnbOpenTimeChange: (val: string) => void;
  fnbCloseTime: string;
  onFnbCloseTimeChange: (val: string) => void;
  qrSelfOrderQrisOnly: boolean;
  onQrSelfOrderQrisOnlyChange: (value: boolean) => void;
  receiptCombineMode: OutletReceiptCombineMode;
  onReceiptCombineModeChange: (value: OutletReceiptCombineMode) => void;
  // Holidays & Overrides
  cwWeekendClosed: boolean;
  onCwWeekendClosedChange: (val: boolean) => void;
  cwNationalHolidaysClosed: boolean;
  onCwNationalHolidaysClosedChange: (val: boolean) => void;
  cwOverrides: HolidayOverrideDate[];
  newOverrideDate: string;
  onNewOverrideDateChange: (val: string) => void;
  newOverrideType: "OPEN" | "CLOSED";
  onNewOverrideTypeChange: (val: "OPEN" | "CLOSED") => void;
  newOverrideReason: string;
  onNewOverrideReasonChange: (val: string) => void;
  onAddHolidayOverride: (e: React.FormEvent) => void;
  onRemoveHolidayOverride: (dateStr: string) => void;
  onSaveSettings: (e: React.FormEvent) => void;
}

export function PlatformConfigTab(props: PlatformConfigTabProps) {
  const {
    moduleDefinitions,
    activeOrgModules,
    onToggleOrgModule,
    language,
    onLanguageChange,
    timezone,
    onTimezoneChange,
    currency,
    onCurrencyChange,
    fnbTaxEnabled,
    onFnbTaxEnabledChange,
    fnbTaxRate,
    onFnbTaxRateChange,
    cwTaxEnabled,
    onCwTaxEnabledChange,
    cwTaxType,
    onCwTaxTypeChange,
    cwTaxRate,
    onCwTaxRateChange,
    serviceCharge,
    onServiceChargeChange,
    lowStock,
    onLowStockChange,
    silverPts,
    onSilverPtsChange,
    goldPts,
    onGoldPtsChange,
    platPts,
    onPlatPtsChange,
    cwOpenTime,
    onCwOpenTimeChange,
    cwCloseTime,
    onCwCloseTimeChange,
    fnbOpenTime,
    onFnbOpenTimeChange,
    fnbCloseTime,
    onFnbCloseTimeChange,
    qrSelfOrderQrisOnly,
    onQrSelfOrderQrisOnlyChange,
    receiptCombineMode,
    onReceiptCombineModeChange,
    cwWeekendClosed,
    onCwWeekendClosedChange,
    cwNationalHolidaysClosed,
    onCwNationalHolidaysClosedChange,
    cwOverrides,
    newOverrideDate,
    onNewOverrideDateChange,
    newOverrideType,
    onNewOverrideTypeChange,
    newOverrideReason,
    onNewOverrideReasonChange,
    onAddHolidayOverride,
    onRemoveHolidayOverride,
    onSaveSettings,
  } = props;

  return (
    <form onSubmit={onSaveSettings} className="flex flex-col gap-6">
      {/* Modul Bisnis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="size-4 text-muted-foreground" />
            <span>Aktivasi modul bisnis</span>
          </CardTitle>
          <CardDescription>
            Modul yang dinonaktifkan akan disembunyikan dari navigasi dan diblokir secara server-side.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {moduleDefinitions.map((mod) => {
            const isActive = activeOrgModules.includes(mod.code);
            return (
              <div
                key={mod.code}
                className="flex items-center justify-between gap-3 rounded-lg border p-3.5"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-md border bg-muted p-2 text-muted-foreground">
                    {mod.icon}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{mod.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{mod.desc}</p>
                  </div>
                </div>

                <div>
                  {mod.isRequired ? (
                    <span className="text-xs text-muted-foreground">Modul inti</span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant={isActive ? "outline" : "default"}
                      onClick={() => onToggleOrgModule(mod.code)}
                    >
                      {isActive ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Lokalisasi */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="size-4 text-muted-foreground" />
            <span>Lokalisasi dan zona waktu</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="appLanguage">Bahasa tampilan</Label>
            <NativeSelect
              id="appLanguage"
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as "id" | "en")}
            >
              <NativeSelectOption value="id">Bahasa Indonesia</NativeSelectOption>
              <NativeSelectOption value="en">English</NativeSelectOption>
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="appTimezone">Zona waktu operasional</Label>
            <NativeSelect
              id="appTimezone"
              value={timezone}
              onChange={(e) => onTimezoneChange(e.target.value)}
            >
              <NativeSelectOption value="Asia/Makassar">WITA (Asia/Makassar)</NativeSelectOption>
              <NativeSelectOption value="Asia/Jakarta">WIB (Asia/Jakarta)</NativeSelectOption>
              <NativeSelectOption value="Asia/Jayapura">WIT (Asia/Jayapura)</NativeSelectOption>
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="appCurrency">Mata uang</Label>
            <NativeSelect
              id="appCurrency"
              value={currency}
              onChange={(e) => onCurrencyChange(e.target.value)}
            >
              <NativeSelectOption value="IDR">IDR (Rupiah)</NativeSelectOption>
              <NativeSelectOption value="USD">USD (Dollar)</NativeSelectOption>
            </NativeSelect>
          </div>
        </CardContent>
      </Card>

      {/* Pajak dan Biaya Layanan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="size-4 text-muted-foreground" />
            <span>Pajak dan biaya layanan</span>
          </CardTitle>
          <CardDescription>
            Pajak F&B (PB1) dan pajak sewa co-working dapat diatur terpisah.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Pajak F&B */}
          <div className="flex flex-col gap-3 rounded-lg border p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Pajak restoran F&B (PB1)</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onFnbTaxEnabledChange(!fnbTaxEnabled)}
              >
                {fnbTaxEnabled ? "Aktif" : "Nonaktif"}
              </Button>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fnbTaxRate">Tarif pajak PB1 (%)</Label>
              <Input
                id="fnbTaxRate"
                type="number"
                min={0}
                max={100}
                disabled={!fnbTaxEnabled}
                value={fnbTaxRate}
                onChange={(e) => onFnbTaxRateChange(Number(e.target.value))}
                className="font-mono tabular-nums"
              />
              <p className="text-xs text-muted-foreground">Dipungut dari pesanan makanan dan minuman di kasir.</p>
            </div>
          </div>

          {/* Pajak Co-working */}
          <div className="flex flex-col gap-3 rounded-lg border p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Pajak sewa co-working</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onCwTaxEnabledChange(!cwTaxEnabled)}
              >
                {cwTaxEnabled ? "Kena pajak" : "Bebas pajak"}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cwTaxType">Jenis</Label>
                <NativeSelect
                  id="cwTaxType"
                  value={cwTaxType}
                  onChange={(e) => onCwTaxTypeChange(e.target.value as CategoryTaxType)}
                  disabled={!cwTaxEnabled}
                >
                  <NativeSelectOption value="NON_TAX">Non-PB1 (0%)</NativeSelectOption>
                  <NativeSelectOption value="PPN">PPN sewa</NativeSelectOption>
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cwTaxRate">Tarif (%)</Label>
                <Input
                  id="cwTaxRate"
                  type="number"
                  min={0}
                  max={100}
                  disabled={!cwTaxEnabled}
                  value={cwTaxRate}
                  onChange={(e) => onCwTaxRateChange(Number(e.target.value))}
                  className="font-mono tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* Service Charge */}
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="serviceCharge">Biaya layanan / Service charge (%)</Label>
            <Input
              id="serviceCharge"
              type="number"
              min={0}
              max={30}
              value={serviceCharge}
              onChange={(e) => onServiceChargeChange(Number(e.target.value))}
              className="max-w-xs font-mono tabular-nums"
            />
            <p className="text-xs text-muted-foreground">Dihitung sebelum pajak pada pesanan makan di tempat.</p>
          </div>
        </CardContent>
      </Card>

      {/* Peringatan Stok & Poin Member */}
      <Card>
        <CardHeader>
          <CardTitle>Batas stok dan tingkatan member</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lowStock">Ambang batas stok menipis (%)</Label>
            <Input
              id="lowStock"
              type="number"
              min={10}
              max={100}
              value={lowStock}
              onChange={(e) => onLowStockChange(Number(e.target.value))}
              className="max-w-xs font-mono tabular-nums"
            />
            <p className="text-xs text-muted-foreground">Bahan diberi status menipis saat stok tersisa mendekati batas ini.</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="silverPts">Poin Silver</Label>
              <Input
                id="silverPts"
                type="number"
                min={0}
                value={silverPts}
                onChange={(e) => onSilverPtsChange(Number(e.target.value))}
                className="font-mono tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goldPts">Poin Gold</Label>
              <Input
                id="goldPts"
                type="number"
                min={0}
                value={goldPts}
                onChange={(e) => onGoldPtsChange(Number(e.target.value))}
                className="font-mono tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="platPts">Poin Platinum</Label>
              <Input
                id="platPts"
                type="number"
                min={0}
                value={platPts}
                onChange={(e) => onPlatPtsChange(Number(e.target.value))}
                className="font-mono tabular-nums"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="size-4 text-muted-foreground" />
            <span>Metode bayar self-order QR</span>
          </CardTitle>
          <CardDescription>
            Atur apakah pelanggan yang memindai QR meja hanya dapat membayar lewat QRIS atau boleh memilih bayar di kasir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4 rounded-lg border p-3.5">
            <div className="flex flex-col gap-1">
              <Label htmlFor="qrSelfOrderQrisOnly" className="text-sm font-medium text-foreground">
                Self-order QR hanya QRIS
              </Label>
              <p className="text-xs text-muted-foreground">
                Sembunyikan opsi bayar di kasir di halaman pelanggan (/customer) dan tolak pesanan tunai dari self-order QR.
              </p>
            </div>
            <Switch
              id="qrSelfOrderQrisOnly"
              checked={qrSelfOrderQrisOnly}
              onCheckedChange={onQrSelfOrderQrisOnlyChange}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="size-4 text-muted-foreground" />
            <span>Mode struk co-working dan F&B (gabung / pisah)</span>
          </CardTitle>
          <CardDescription>
            Pilih apakah transaksi campuran ruang kerja dan F&B dicetak dalam satu struk atau dipisah.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div
            role="group"
            aria-label="Mode struk co-working dan F&B (gabung / pisah)"
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          >
            <Button
              type="button"
              size="lg"
              variant={receiptCombineMode === "COMBINED" ? "default" : "outline"}
              aria-pressed={receiptCombineMode === "COMBINED"}
              onClick={() => onReceiptCombineModeChange("COMBINED")}
              className="w-full justify-start"
            >
              Gabung (1 struk: Dago & mitra)
            </Button>
            <Button
              type="button"
              size="lg"
              variant={receiptCombineMode === "SEPARATE" ? "default" : "outline"}
              aria-pressed={receiptCombineMode === "SEPARATE"}
              onClick={() => onReceiptCombineModeChange("SEPARATE")}
              className="w-full justify-start"
            >
              Pisah (struk co-working & F&B terpisah)
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {receiptCombineMode === "COMBINED"
              ? "Kasir mencetak 1 struk berisi bagian Dago Creative Hub (Co-Working) dan mitra F&B."
              : "Kasir mencetak struk co-working (0% PB1) terpisah dari struk pesanan F&B."}
          </p>
        </CardContent>
      </Card>

      {/* Jam Operasional */}
      <Card>
        <CardHeader>
          <CardTitle>Jam operasional layanan</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <span className="text-sm font-medium text-foreground">Kuliner F&B</span>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={fnbOpenTime}
                onChange={(e) => onFnbOpenTimeChange(e.target.value)}
                aria-label="Jam buka F&B"
                className="font-mono tabular-nums"
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="time"
                value={fnbCloseTime}
                onChange={(e) => onFnbCloseTimeChange(e.target.value)}
                aria-label="Jam tutup F&B"
                className="font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <span className="text-sm font-medium text-foreground">Co-working space</span>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={cwOpenTime}
                onChange={(e) => onCwOpenTimeChange(e.target.value)}
                aria-label="Jam buka co-working"
                className="font-mono tabular-nums"
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="time"
                value={cwCloseTime}
                onChange={(e) => onCwCloseTimeChange(e.target.value)}
                aria-label="Jam tutup co-working"
                className="font-mono tabular-nums"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hari Libur Co-working */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            <span>Hari libur dan pengecualian co-working</span>
          </CardTitle>
          <CardDescription>
            Tentukan apakah co-working tutup saat akhir pekan dan libur nasional.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Tutup akhir pekan</p>
                <p className="text-xs text-muted-foreground">Tutup pada hari Sabtu dan Minggu.</p>
              </div>
              <input
                type="checkbox"
                checked={cwWeekendClosed}
                onChange={(e) => onCwWeekendClosedChange(e.target.checked)}
                className="mt-1 rounded border"
              />
            </label>

            <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Tutup hari libur nasional</p>
                <p className="text-xs text-muted-foreground">Otomatis tutup saat tanggal merah resmi.</p>
              </div>
              <input
                type="checkbox"
                checked={cwNationalHolidaysClosed}
                onChange={(e) => onCwNationalHolidaysClosedChange(e.target.checked)}
                className="mt-1 rounded border"
              />
            </label>
          </div>

          {/* Form Tambah Override */}
          <div className="flex flex-col gap-3 rounded-lg border p-3.5">
            <p className="text-xs font-medium text-foreground">Tambah tanggal khusus (buka/tutup pengecualian)</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Tanggal</Label>
                <Input
                  type="date"
                  value={newOverrideDate}
                  onChange={(e) => onNewOverrideDateChange(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Status</Label>
                <NativeSelect
                  value={newOverrideType}
                  onChange={(e) => onNewOverrideTypeChange(e.target.value as "OPEN" | "CLOSED")}
                >
                  <NativeSelectOption value="OPEN">Buka khusus</NativeSelectOption>
                  <NativeSelectOption value="CLOSED">Tutup khusus</NativeSelectOption>
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <Label className="text-xs">Alasan</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    placeholder="Contoh: Pemeliharaan gedung"
                    value={newOverrideReason}
                    onChange={(e) => onNewOverrideReasonChange(e.target.value)}
                  />
                  <Button type="button" size="sm" onClick={onAddHolidayOverride}>
                    <Plus />
                    <span>Tambah</span>
                  </Button>
                </div>
              </div>
            </div>

            {cwOverrides.length > 0 ? (
              <div className="overflow-hidden rounded-lg border mt-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Alasan</TableHead>
                      <TableHead className="w-0 text-right">
                        <span className="sr-only">Aksi</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cwOverrides.map((ov) => {
                      const isOpen = ov.isOpen ?? ov.type === "OPEN";
                      return (
                        <TableRow key={ov.date}>
                          <TableCell className="font-mono text-xs tabular-nums">{ov.date}</TableCell>
                          <TableCell>
                            <span className="text-xs font-medium text-foreground">
                              {isOpen ? "Buka khusus" : "Tutup khusus"}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{ov.reason || "—"}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="ghost"
                              onClick={() => onRemoveHolidayOverride(ov.date)}
                              aria-label={`Hapus override ${ov.date}`}
                            >
                              <Trash2 />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Tombol Simpan Form Pengaturan */}
      <div className="flex justify-end pt-2">
        <Button type="submit">
          <Save />
          <span>Simpan pengaturan platform</span>
        </Button>
      </div>
    </form>
  );
}
