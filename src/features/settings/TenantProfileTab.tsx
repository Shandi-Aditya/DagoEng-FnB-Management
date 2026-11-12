"use client";

import type React from "react";
import { Power, Save, Store } from "lucide-react";

import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export interface TenantProfileTabProps {
  tenantBrandName: string;
  onTenantBrandNameChange: (val: string) => void;
  tenantTagline: string;
  onTenantTaglineChange: (val: string) => void;
  tenantDesc: string;
  onTenantDescChange: (val: string) => void;
  tenantPhone: string;
  onTenantPhoneChange: (val: string) => void;
  tenantReceiptHeader: string;
  onTenantReceiptHeaderChange: (val: string) => void;
  tenantReceiptFooter: string;
  onTenantReceiptFooterChange: (val: string) => void;
  tenantLowStock: number;
  onTenantLowStockChange: (val: number) => void;
  tenantStatus: "ACTIVE" | "INACTIVE";
  onTenantStatusChange: (val: "ACTIVE" | "INACTIVE") => void;
  tenantOpenTime: string;
  onTenantOpenTimeChange: (val: string) => void;
  tenantCloseTime: string;
  onTenantCloseTimeChange: (val: string) => void;
  tenantClosedReason: string;
  onTenantClosedReasonChange: (val: string) => void;
  bankName: string;
  onBankNameChange: (val: string) => void;
  bankAccountNumber: string;
  onBankAccountNumberChange: (val: string) => void;
  bankAccountHolder: string;
  onBankAccountHolderChange: (val: string) => void;
  bankFormError: string;
  onSaveTenantSettings: (e: React.FormEvent) => void;
}

export function TenantProfileTab(props: TenantProfileTabProps) {
  const {
    tenantBrandName,
    onTenantBrandNameChange,
    tenantTagline,
    onTenantTaglineChange,
    tenantDesc,
    onTenantDescChange,
    tenantPhone,
    onTenantPhoneChange,
    tenantReceiptHeader,
    onTenantReceiptHeaderChange,
    tenantReceiptFooter,
    onTenantReceiptFooterChange,
    tenantLowStock,
    onTenantLowStockChange,
    tenantStatus,
    onTenantStatusChange,
    tenantOpenTime,
    onTenantOpenTimeChange,
    tenantCloseTime,
    onTenantCloseTimeChange,
    tenantClosedReason,
    onTenantClosedReasonChange,
    bankName,
    onBankNameChange,
    bankAccountNumber,
    onBankAccountNumberChange,
    bankAccountHolder,
    onBankAccountHolderChange,
    bankFormError,
    onSaveTenantSettings,
  } = props;

  const isActive = tenantStatus === "ACTIVE";

  return (
    <form onSubmit={onSaveTenantSettings} className="flex flex-col gap-6">
      {/* Status Gerai */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Status operasional gerai</CardTitle>
            <CardDescription>
              Jika dinonaktifkan, menu Anda tidak akan dapat dipesan di kasir dan portal tamu.
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            variant={isActive ? "outline" : "default"}
            onClick={() => onTenantStatusChange(isActive ? "INACTIVE" : "ACTIVE")}
          >
            <Power />
            <span>{isActive ? "Tutup gerai" : "Buka gerai"}</span>
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-xs">
          <div className="flex items-center gap-2">
            <StatusBadge status={isActive ? "success" : "destructive"}>
              {isActive ? "Gerai aktif" : "Gerai nonaktif / tutup"}
            </StatusBadge>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Jam buka</Label>
              <Input
                type="time"
                value={tenantOpenTime}
                onChange={(e) => onTenantOpenTimeChange(e.target.value)}
                className="font-mono tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Jam tutup</Label>
              <Input
                type="time"
                value={tenantCloseTime}
                onChange={(e) => onTenantCloseTimeChange(e.target.value)}
                className="font-mono tabular-nums"
              />
            </div>
          </div>

          {!isActive ? (
            <div className="flex flex-col gap-1.5">
              <Label>Alasan penutupan sementara</Label>
              <Input
                type="text"
                placeholder="Contoh: Stok bahan habis untuk hari ini"
                value={tenantClosedReason}
                onChange={(e) => onTenantClosedReasonChange(e.target.value)}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Profil Merek */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="size-4 text-muted-foreground" />
            <span>Profil merek mitra</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Nama brand / gerai</Label>
              <Input
                type="text"
                required
                value={tenantBrandName}
                onChange={(e) => onTenantBrandNameChange(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Tagline</Label>
              <Input
                type="text"
                value={tenantTagline}
                onChange={(e) => onTenantTaglineChange(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Deskripsi gerai</Label>
            <textarea
              rows={2}
              value={tenantDesc}
              onChange={(e) => onTenantDescChange(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Nomor kontak WhatsApp</Label>
            <Input
              type="tel"
              value={tenantPhone}
              onChange={(e) => onTenantPhoneChange(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Rekening Pencairan */}
      <Card>
        <CardHeader>
          <CardTitle>Rekening pencairan dana</CardTitle>
          <CardDescription>
            Rekening tujuan untuk transfer settlement bagi hasil penjualan F&B.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {bankFormError ? <p className="text-xs text-destructive">{bankFormError}</p> : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label>Bank</Label>
              <NativeSelect value={bankName} onChange={(e) => onBankNameChange(e.target.value)}>
                <NativeSelectOption value="BCA">BCA</NativeSelectOption>
                <NativeSelectOption value="Mandiri">Bank Mandiri</NativeSelectOption>
                <NativeSelectOption value="BNI">BNI</NativeSelectOption>
                <NativeSelectOption value="BRI">BRI</NativeSelectOption>
                <NativeSelectOption value="CIMB">CIMB Niaga</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Nomor rekening</Label>
              <Input
                type="text"
                value={bankAccountNumber}
                onChange={(e) => onBankAccountNumberChange(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Atas nama</Label>
              <Input
                type="text"
                value={bankAccountHolder}
                onChange={(e) => onBankAccountHolderChange(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Teks Struk & Ambang Stok */}
      <Card>
        <CardHeader>
          <CardTitle>Kustomisasi struk dan stok</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Header struk</Label>
              <Input
                type="text"
                value={tenantReceiptHeader}
                onChange={(e) => onTenantReceiptHeaderChange(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Footer struk</Label>
              <Input
                type="text"
                value={tenantReceiptFooter}
                onChange={(e) => onTenantReceiptFooterChange(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 sm:max-w-xs">
            <Label>Ambang batas stok menipis (%)</Label>
            <Input
              type="number"
              min={10}
              max={100}
              value={tenantLowStock}
              onChange={(e) => onTenantLowStockChange(Number(e.target.value))}
              className="font-mono tabular-nums"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-2">
        <Button type="submit">
          <Save />
          <span>Simpan pengaturan mitra</span>
        </Button>
      </div>
    </form>
  );
}
