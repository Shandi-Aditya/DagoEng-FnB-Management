"use client";

import type React from "react";
import { useState } from "react";
import { Edit2, Plus, Power, Receipt, RotateCcw, Router, Search, Trash2, Wifi } from "lucide-react";

import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataPagination } from "@/components/app/data-pagination";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  WifiCalculationBasis,
  WifiCoworkingRule,
  WifiFnBRule,
  WifiNetworkConfig,
  WifiVoucherRecord,
  WifiVoucherStatus,
} from "@/lib/wifi";
import { formatCurrencyIDR } from "@/lib/utils";

import {
  filterWifiVouchers,
  formatSettingsDateTime,
  wifiVoucherStatusLabel,
  wifiVoucherStatusTone,
} from "./settings-domain";

export interface WifiManagementTabProps {
  fnBRules: WifiFnBRule[];
  cwRules: WifiCoworkingRule[];
  vouchers: WifiVoucherRecord[];
  networkConfig: WifiNetworkConfig;
  calcBasis: WifiCalculationBasis;
  onChangeCalcBasis: (basis: WifiCalculationBasis) => void;
  // Rule actions
  onOpenAddRule: () => void;
  onOpenEditRule: (rule: WifiFnBRule) => void;
  onToggleRuleStatus: (ruleId: string) => void;
  onDeleteRule: (ruleId: string) => void;
  isRuleModalOpen: boolean;
  onRuleModalOpenChange: (open: boolean) => void;
  editingRule: WifiFnBRule | null;
  ruleFormLabel: string;
  onRuleFormLabelChange: (val: string) => void;
  ruleFormMin: number;
  onRuleFormMinChange: (val: number) => void;
  ruleFormMax: string;
  onRuleFormMaxChange: (val: string) => void;
  ruleFormDuration: number;
  onRuleFormDurationChange: (val: number) => void;
  ruleFormBandwidthDown: number;
  onRuleFormBandwidthDownChange: (val: number) => void;
  ruleFormBandwidthUp: number;
  onRuleFormBandwidthUpChange: (val: number) => void;
  ruleFormNotes: string;
  onRuleFormNotesChange: (val: string) => void;
  ruleFormError: string;
  onSaveRule: (e: React.FormEvent) => void;
  // Voucher actions
  voucherServiceFilter: "ALL" | "FNB" | "COWORKING";
  onVoucherServiceFilterChange: (val: "ALL" | "FNB" | "COWORKING") => void;
  voucherStatusFilter: "ALL" | WifiVoucherStatus;
  onVoucherStatusFilterChange: (val: "ALL" | WifiVoucherStatus) => void;
  voucherSearchQuery: string;
  onVoucherSearchQueryChange: (val: string) => void;
  onRevokeVoucher: (voucherId: string) => void;
}

export function WifiManagementTab(props: WifiManagementTabProps) {
  const {
    fnBRules,
    cwRules,
    vouchers,
    networkConfig,
    calcBasis,
    onChangeCalcBasis,
    onOpenAddRule,
    onOpenEditRule,
    onToggleRuleStatus,
    onDeleteRule,
    isRuleModalOpen,
    onRuleModalOpenChange,
    editingRule,
    ruleFormLabel,
    onRuleFormLabelChange,
    ruleFormMin,
    onRuleFormMinChange,
    ruleFormMax,
    onRuleFormMaxChange,
    ruleFormDuration,
    onRuleFormDurationChange,
    ruleFormBandwidthDown,
    onRuleFormBandwidthDownChange,
    ruleFormBandwidthUp,
    onRuleFormBandwidthUpChange,
    ruleFormNotes,
    onRuleFormNotesChange,
    ruleFormError,
    onSaveRule,
    voucherServiceFilter,
    onVoucherServiceFilterChange,
    voucherStatusFilter,
    onVoucherStatusFilterChange,
    voucherSearchQuery,
    onVoucherSearchQueryChange,
    onRevokeVoucher,
  } = props;

  const [wifiSubTab, setWifiSubTab] = useState<"FNB_RULES" | "CW_RULES" | "VOUCHERS" | "GATEWAY">("FNB_RULES");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

  const filteredVouchers = filterWifiVouchers(vouchers, {
    serviceType: voucherServiceFilter,
    status: voucherStatusFilter,
    searchQuery: voucherSearchQuery,
  });

  const safePage = Math.min(currentPage, Math.max(1, Math.ceil(filteredVouchers.length / pageSize)));
  const pagedVouchers = filteredVouchers.slice((safePage - 1) * pageSize, safePage * pageSize);

  const activeVouchersCount = vouchers.filter((v) => v.status === "ACTIVE").length;

  return (
    <div className="flex flex-col gap-6">
      {/* 4 Kartu Metrik Faktual */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-3.5 space-y-1">
          <span className="text-xs text-muted-foreground">Gateway router</span>
          <p className="font-mono text-sm font-medium text-foreground">Simulasi lokal</p>
          <p className="text-xs text-muted-foreground">Belum terhubung hardware</p>
        </div>

        <div className="rounded-lg border bg-card p-3.5 space-y-1">
          <span className="text-xs text-muted-foreground">Voucher terbit</span>
          <p className="font-mono text-base font-medium text-foreground tabular-nums">
            {vouchers.length}
          </p>
          <p className="text-xs text-success">{activeVouchersCount} aktif</p>
        </div>

        <div className="rounded-lg border bg-card p-3.5 space-y-1">
          <span className="text-xs text-muted-foreground">Aturan F&B</span>
          <p className="font-mono text-base font-medium text-foreground tabular-nums">
            {fnBRules.filter((r) => r.isActive).length}
          </p>
          <p className="text-xs text-muted-foreground">Berdasar belanja</p>
        </div>

        <div className="rounded-lg border bg-card p-3.5 space-y-1">
          <span className="text-xs text-muted-foreground">Aturan co-working</span>
          <p className="font-mono text-base font-medium text-foreground tabular-nums">
            {cwRules.filter((r) => r.isActive).length}
          </p>
          <p className="text-xs text-muted-foreground">Berdasar sewa</p>
        </div>
      </div>

      <Tabs value={wifiSubTab} onValueChange={(v) => setWifiSubTab(v as any)}>
        <TabsList className="w-full justify-start overflow-x-auto no-scrollbar">
          <TabsTrigger value="FNB_RULES">Aturan F&B ({fnBRules.length})</TabsTrigger>
          <TabsTrigger value="CW_RULES">Aturan co-working ({cwRules.length})</TabsTrigger>
          <TabsTrigger value="VOUCHERS">Riwayat voucher ({vouchers.length})</TabsTrigger>
          <TabsTrigger value="GATEWAY">Integrasi gateway</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ATURAN FNB */}
      {wifiSubTab === "FNB_RULES" ? (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Basis nominal transaksi F&B</CardTitle>
                <CardDescription>
                  Pilih apakah voucher dihitung dari total akhir atau subtotal produk.
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={calcBasis === "GRAND_TOTAL" ? "default" : "outline"}
                  onClick={() => onChangeCalcBasis("GRAND_TOTAL")}
                >
                  Grand total
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={calcBasis === "NET_SALES" ? "default" : "outline"}
                  onClick={() => onChangeCalcBasis("NET_SALES")}
                >
                  Net sales
                </Button>
              </div>
            </CardHeader>
          </Card>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              Voucher otomatis dicetak pada struk kasir saat belanja mencapai ambang batas.
            </span>
            <Button type="button" size="sm" onClick={onOpenAddRule}>
              <Plus />
              <span>Tambah aturan</span>
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Rentang belanja</TableHead>
                  <TableHead>Durasi</TableHead>
                  <TableHead className="hidden md:table-cell">Kecepatan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-0 text-right">
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fnBRules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <p className="text-sm font-medium text-foreground">{r.label}</p>
                      {r.notes ? <p className="text-xs text-muted-foreground">{r.notes}</p> : null}
                    </TableCell>

                    <TableCell className="font-mono text-xs tabular-nums">
                      {formatCurrencyIDR(r.minTransactionAmount)} –{" "}
                      {r.maxTransactionAmount ? formatCurrencyIDR(r.maxTransactionAmount) : "ke atas"}
                    </TableCell>

                    <TableCell className="text-xs">
                      {r.durationMinutes >= 60 ? `${r.durationMinutes / 60} jam` : `${r.durationMinutes} menit`}
                    </TableCell>

                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {r.bandwidthLimitDownMbps ? `${r.bandwidthLimitDownMbps}M / ${r.bandwidthLimitUpMbps || 5}M` : "Bawaan"}
                    </TableCell>

                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onToggleRuleStatus(r.id)}
                        className="h-auto p-0"
                      >
                        <StatusBadge status={r.isActive ? "success" : "neutral"}>
                          {r.isActive ? "Aktif" : "Nonaktif"}
                        </StatusBadge>
                      </Button>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => onOpenEditRule(r)}
                          aria-label={`Edit ${r.label}`}
                        >
                          <Edit2 />
                        </Button>
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => setDeletingRuleId(r.id)}
                          aria-label={`Hapus ${r.label}`}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      {/* ATURAN COWORKING */}
      {wifiSubTab === "CW_RULES" ? (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-muted-foreground">
            Voucher co-working terbit saat reservasi terkonfirmasi dan durasinya mulai dihitung saat check-in tamu divalidasi.
          </p>

          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paket / Ruang</TableHead>
                  <TableHead>Tipe booking</TableHead>
                  <TableHead className="hidden sm:table-cell">Mode durasi</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Maks. perangkat</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cwRules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm font-medium text-foreground">{r.label}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.bookingType}</TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      {r.durationMode}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right font-mono text-xs tabular-nums">
                      {r.maxConcurrentDevices}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.isActive ? "success" : "neutral"}>
                        {r.isActive ? "Aktif" : "Nonaktif"}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      {/* RIWAYAT VOUCHER */}
      {wifiSubTab === "VOUCHERS" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <InputGroup className="w-full sm:max-w-xs">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  type="search"
                  value={voucherSearchQuery}
                  onChange={(e) => {
                    onVoucherSearchQueryChange(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Cari kode atau nama tamu"
                  aria-label="Cari voucher"
                />
              </InputGroup>

              <NativeSelect
                value={voucherServiceFilter}
                onChange={(e) => {
                  onVoucherServiceFilterChange(e.target.value as any);
                  setCurrentPage(1);
                }}
                aria-label="Filter layanan"
              >
                <NativeSelectOption value="ALL">Semua layanan</NativeSelectOption>
                <NativeSelectOption value="FNB">F&B</NativeSelectOption>
                <NativeSelectOption value="COWORKING">Co-working</NativeSelectOption>
              </NativeSelect>

              <NativeSelect
                value={voucherStatusFilter}
                onChange={(e) => {
                  onVoucherStatusFilterChange(e.target.value as any);
                  setCurrentPage(1);
                }}
                aria-label="Filter status voucher"
              >
                <NativeSelectOption value="ALL">Semua status</NativeSelectOption>
                <NativeSelectOption value="ACTIVE">Aktif</NativeSelectOption>
                <NativeSelectOption value="USED">Terpakai</NativeSelectOption>
                <NativeSelectOption value="EXPIRED">Kedaluwarsa</NativeSelectOption>
                <NativeSelectOption value="CANCELLED">Dibatalkan</NativeSelectOption>
              </NativeSelect>
            </div>

            <span className="text-xs text-muted-foreground tabular-nums">
              {filteredVouchers.length} voucher
            </span>
          </div>

          {filteredVouchers.length === 0 ? (
            <EmptyState
              className="border"
              icon={<Receipt />}
              title="Voucher tidak ditemukan"
              description="Belum ada voucher yang cocok dengan filter."
            />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="overflow-hidden rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kode</TableHead>
                      <TableHead className="hidden md:table-cell">Referensi</TableHead>
                      <TableHead className="hidden sm:table-cell">Pelanggan</TableHead>
                      <TableHead className="hidden lg:table-cell">Durasi</TableHead>
                      <TableHead className="hidden md:table-cell">Berlaku sampai</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-0 text-right">
                        <span className="sr-only">Aksi</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedVouchers.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell>
                          <span className="font-mono text-xs font-medium text-foreground">{v.voucherCode}</span>
                          <span className="text-xs text-muted-foreground block md:hidden">
                            {v.referenceLabel}
                          </span>
                        </TableCell>

                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {v.referenceLabel}
                        </TableCell>

                        <TableCell className="hidden sm:table-cell text-xs text-foreground">
                          {v.customerName}
                        </TableCell>

                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {v.durationFormatted}
                        </TableCell>

                        <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground tabular-nums">
                          {formatSettingsDateTime(v.expiresAt)}
                        </TableCell>

                        <TableCell>
                          <StatusBadge status={wifiVoucherStatusTone(v.status)}>
                            {wifiVoucherStatusLabel(v.status)}
                          </StatusBadge>
                        </TableCell>

                        <TableCell className="text-right">
                          {v.status === "ACTIVE" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => onRevokeVoucher(v.id)}
                            >
                              Cabut
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DataPagination
                currentPage={safePage}
                totalItems={filteredVouchers.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                itemLabel="voucher"
              />
            </div>
          )}
        </div>
      ) : null}

      {/* INFORMASI GATEWAY */}
      {wifiSubTab === "GATEWAY" ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Router className="size-4 text-muted-foreground" />
              <CardTitle>Integrasi gateway router</CardTitle>
            </div>
            <CardDescription>
              Status koneksi captive portal ke perangkat keras jaringan.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-xs">
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
              <span className="font-medium text-foreground">Belum terhubung ke router fisik</span>
              <p className="text-muted-foreground leading-relaxed">
                Kredensial router dan API token captive portal tidak disimpan di browser. Integrasi lapangan dijalankan via backend service terisolasi.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">SSID tamu</span>
                <span className="font-mono font-medium text-foreground">{networkConfig.ssidName}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Adapter</span>
                <span className="font-medium text-foreground">{networkConfig.driver}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Dialog Tambah/Edit Aturan FNB */}
      <Dialog open={isRuleModalOpen} onOpenChange={onRuleModalOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit aturan Wi-Fi F&B" : "Tambah aturan Wi-Fi F&B"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSaveRule} className="flex flex-col gap-3">
            {ruleFormError ? <p className="text-xs text-destructive">{ruleFormError}</p> : null}

            <div className="flex flex-col gap-1.5">
              <Label>Nama label</Label>
              <Input
                type="text"
                required
                value={ruleFormLabel}
                onChange={(e) => onRuleFormLabelChange(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Min. belanja (Rp)</Label>
                <Input
                  type="number"
                  min={0}
                  step={5000}
                  required
                  value={ruleFormMin}
                  onChange={(e) => onRuleFormMinChange(Number(e.target.value))}
                  className="font-mono tabular-nums"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Maks. belanja (Rp)</Label>
                <Input
                  type="number"
                  min={0}
                  step={5000}
                  value={ruleFormMax}
                  onChange={(e) => onRuleFormMaxChange(e.target.value)}
                  placeholder="Tanpa batas"
                  className="font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Durasi (menit)</Label>
                <Input
                  type="number"
                  min={15}
                  value={ruleFormDuration}
                  onChange={(e) => onRuleFormDurationChange(Number(e.target.value))}
                  className="font-mono tabular-nums"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Unduh (Mbps)</Label>
                <Input
                  type="number"
                  min={1}
                  value={ruleFormBandwidthDown}
                  onChange={(e) => onRuleFormBandwidthDownChange(Number(e.target.value))}
                  className="font-mono tabular-nums"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Unggah (Mbps)</Label>
                <Input
                  type="number"
                  min={1}
                  value={ruleFormBandwidthUp}
                  onChange={(e) => onRuleFormBandwidthUpChange(Number(e.target.value))}
                  className="font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Catatan</Label>
              <Input
                type="text"
                value={ruleFormNotes}
                onChange={(e) => onRuleFormNotesChange(e.target.value)}
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onRuleModalOpenChange(false)}>
                Batal
              </Button>
              <Button type="submit">Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deletingRuleId)}
        onOpenChange={(open) => !open && setDeletingRuleId(null)}
        title="Hapus aturan Wi-Fi?"
        description="Aturan ini tidak akan lagi digunakan untuk penerbitan voucher kasir."
        confirmLabel="Hapus"
        destructive
        onConfirm={() => {
          if (deletingRuleId) {
            onDeleteRule(deletingRuleId);
            setDeletingRuleId(null);
          }
        }}
      />
    </div>
  );
}
