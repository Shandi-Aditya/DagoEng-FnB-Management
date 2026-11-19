"use client";

import { Building2, Edit, History, Plus, Star, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface EventsSettingsViewProps {
  businessPolicy: any;
  setBusinessPolicy: (policy: any) => void;
  bankAccountsList: any[];
  bankChangeHistory: any[];
  onSavePolicy: (e: React.FormEvent) => void;
  onOpenAddBank: () => void;
  onEditBank: (bank: any) => void;
  onDeleteBank: (id: string) => void;
  onSetDefaultBank: (id: string) => void;
  onToggleBankActive: (id: string, currentActive: boolean) => void;
  isSaving?: boolean;
}

export function EventsSettingsView({
  businessPolicy,
  setBusinessPolicy,
  bankAccountsList,
  bankChangeHistory,
  onSavePolicy,
  onOpenAddBank,
  onEditBank,
  onDeleteBank,
  onSetDefaultBank,
  onToggleBankActive,
  isSaving,
}: EventsSettingsViewProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Kebijakan Bisnis Platform */}
      {businessPolicy ? (
        <Card>
          <CardHeader>
            <CardTitle>Kebijakan bisnis event</CardTitle>
            <CardDescription>
              Atur persentase komisi bagi hasil platform, batas pembelian tiket, dan batas waktu pembayaran.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSavePolicy} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="defaultPlatformFeePercent">Komisi platform (%)</Label>
                <Input
                  id="defaultPlatformFeePercent"
                  type="number"
                  min={0}
                  max={50}
                  step={1}
                  value={businessPolicy.defaultPlatformFeePercent ?? 20}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setBusinessPolicy({
                        ...businessPolicy,
                        defaultPlatformFeePercent: "",
                      });
                      return;
                    }
                    if (raw.includes(".") || raw.includes(",")) return;
                    const parsed = Number(raw);
                    if (Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 50) {
                      setBusinessPolicy({
                        ...businessPolicy,
                        defaultPlatformFeePercent: parsed,
                      });
                    }
                  }}
                  required
                />
                <span className="text-xs text-muted-foreground">
                  Persentase default potongan bagi hasil dari penjualan tiket berbayar (0–50%).
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="maxTicketsPerBooking">Maksimal tiket per pesanan</Label>
                <Input
                  id="maxTicketsPerBooking"
                  type="number"
                  min={1}
                  max={20}
                  value={businessPolicy.maxTicketsPerBooking ?? 5}
                  onChange={(e) =>
                    setBusinessPolicy({
                      ...businessPolicy,
                      maxTicketsPerBooking: Number(e.target.value),
                    })
                  }
                  required
                />
                <span className="text-xs text-muted-foreground">
                  Jumlah tiket terbanyak yang bisa dibeli dalam satu transaksi.
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bookingPaymentExpiryMinutes">Kedaluwarsa pembayaran (menit)</Label>
                <Input
                  id="bookingPaymentExpiryMinutes"
                  type="number"
                  min={5}
                  max={1440}
                  value={businessPolicy.bookingPaymentExpiryMinutes ?? 120}
                  onChange={(e) =>
                    setBusinessPolicy({
                      ...businessPolicy,
                      bookingPaymentExpiryMinutes: Number(e.target.value),
                    })
                  }
                  required
                />
                <span className="text-xs text-muted-foreground">
                  Batas waktu transfer untuk pesanan tiket sebelum otomatis dibatalkan.
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="activePaymentMethod">Metode pembayaran tiket</Label>
                <NativeSelect
                  id="activePaymentMethod"
                  value={
                    businessPolicy.activePaymentMethod === "PAYMENT_GATEWAY"
                      ? "DOKU_CHECKOUT"
                      : businessPolicy.activePaymentMethod ?? "MANUAL_TRANSFER"
                  }
                  onChange={(e) =>
                    setBusinessPolicy({
                      ...businessPolicy,
                      activePaymentMethod: e.target.value,
                    })
                  }
                >
                  <NativeSelectOption value="MANUAL_TRANSFER">Transfer manual (Verifikasi admin)</NativeSelectOption>
                  <NativeSelectOption value="DOKU_CHECKOUT">Payment gateway otomatis (DOKU)</NativeSelectOption>
                </NativeSelect>
                <span className="text-xs text-muted-foreground">
                  Metode pembayaran yang aktif di form checkout tiket publik.
                </span>
              </div>

              <div className="col-span-1 sm:col-span-2 flex justify-end pt-2">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Menyimpan…" : "Simpan kebijakan"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {/* Manajemen Rekening Bank Resmi */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Rekening bank resmi</CardTitle>
            <CardDescription>
              Daftar rekening tujuan transfer manual yang ditampilkan kepada pemesan tiket.
            </CardDescription>
          </div>
          <Button size="sm" onClick={onOpenAddBank}>
            <Plus />
            <span>Tambah rekening</span>
          </Button>
        </CardHeader>
        <CardContent>
          {bankAccountsList.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Belum ada rekening bank yang didaftarkan.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bank & Rekening</TableHead>
                    <TableHead>Atas Nama</TableHead>
                    <TableHead className="hidden sm:table-cell">Cabang</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-0 text-right">
                      <span className="sr-only">Aksi</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bankAccountsList.map((acc) => (
                    <TableRow key={acc.id}>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{acc.bankName}</span>
                            {acc.isDefault ? (
                              <Badge variant="outline" className="text-xs">
                                Utama
                              </Badge>
                            ) : null}
                          </div>
                          <span className="font-mono text-xs text-muted-foreground">
                            {acc.accountNumber}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="text-sm text-foreground">{acc.accountHolder}</span>
                      </TableCell>

                      <TableCell className="hidden sm:table-cell">
                        <span className="text-xs text-muted-foreground">{acc.branch || "—"}</span>
                      </TableCell>

                      <TableCell>
                        <Badge variant={acc.isActive ? "default" : "secondary"}>
                          {acc.isActive ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!acc.isDefault ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onSetDefaultBank(acc.id)}
                              title="Jadikan rekening utama"
                            >
                              <Star />
                              <span className="sr-only">Jadikan utama</span>
                            </Button>
                          ) : null}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditBank(acc)}
                          >
                            <Edit />
                            <span className="sr-only">Edit</span>
                          </Button>

                          {!acc.isDefault ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDeleteBank(acc.id)}
                            >
                              <Trash2 />
                              <span className="sr-only">Hapus</span>
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Riwayat Perubahan Rekening Bank */}
      {bankChangeHistory.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="size-4 text-muted-foreground" />
              <CardTitle>Riwayat perubahan rekening</CardTitle>
            </div>
            <CardDescription>
              Catatan audit perubahan nomor rekening dan data bank platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Waktu</TableHead>
                    <TableHead>Aksi & Bank</TableHead>
                    <TableHead>Petugas</TableHead>
                    <TableHead>Keterangan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bankChangeHistory.slice(0, 10).map((h, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {new Date(h.timestamp || h.createdAt).toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-foreground">
                        {h.action || h.bankName}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {h.actorName || h.userEmail || "Admin"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {h.description || h.reason || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
