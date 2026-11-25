"use client";

import type React from "react";
import { useState } from "react";
import { Eye, EyeOff, KeyRound, Power, Save, Store } from "lucide-react";

import { notify } from "@/components/app/notify";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

import type { TenantStatus } from "@/lib/domain-sync-types";

export interface TenantProfileTabProps {
  ownerEmail?: string;
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
  tenantStatus: TenantStatus;
  onTenantStatusChange: (val: TenantStatus) => void;
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
  tenantNpwp?: string;
  bankFormError: string;
  onSaveTenantSettings: (e: React.FormEvent) => void;
}

export function TenantProfileTab(props: TenantProfileTabProps) {
  const {
    ownerEmail = "",
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
    tenantNpwp = "",
    bankFormError,
    onSaveTenantSettings,
  } = props;

  const isActive = tenantStatus === "ACTIVE";
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerEmail.trim()) {
      notify.error("Email akun tidak ditemukan", "Muat ulang halaman atau masuk kembali.");
      return;
    }
    if (!currentPassword.trim()) {
      notify.error("Isi kata sandi saat ini");
      return;
    }
    if (newPassword.trim().length < 6) {
      notify.error("Kata sandi baru minimal 6 karakter");
      return;
    }
    if (newPassword !== confirmPassword) {
      notify.error("Konfirmasi kata sandi baru tidak cocok");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: ownerEmail.trim(),
          currentPassword,
          newPassword: newPassword.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        notify.error(
          "Gagal mengubah kata sandi",
          data?.error || "Periksa kembali kata sandi Anda."
        );
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      notify.success(
        "Kata sandi diperbarui",
        "Masuk kembali dengan kata sandi baru jika sesi diminta ulang."
      );
    } catch {
      notify.error(
        "Kendala jaringan",
        "Gagal menghubungi server saat mengubah kata sandi."
      );
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
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
              <Label>Slogan</Label>
              <Input
                type="text"
                value={tenantTagline}
                onChange={(e) => onTenantTaglineChange(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Deskripsi gerai</Label>
            <Textarea
              rows={2}
              value={tenantDesc}
              onChange={(e) => onTenantDescChange(e.target.value)}
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
          <CardTitle>Rekening pencairan dana & NPWP</CardTitle>
          <CardDescription>
            Perubahan rekening pencairan dan NPWP memerlukan persetujuan Admin Hub.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {bankFormError ? <p className="text-xs text-destructive">{bankFormError}</p> : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Bank</Label>
              <NativeSelect
                value={bankName}
                disabled
                onChange={(e) => onBankNameChange(e.target.value)}
              >
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
                disabled
                value={bankAccountNumber}
                onChange={(e) => onBankAccountNumberChange(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Atas nama</Label>
              <Input
                type="text"
                disabled
                value={bankAccountHolder}
                onChange={(e) => onBankAccountHolderChange(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>NPWP</Label>
              <Input
                type="text"
                disabled
                value={tenantNpwp || "—"}
                className="font-mono"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Hubungi Admin Hub apabila perlu mengubah data rekening bank atau NPWP gerai.
          </p>
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

      {/* Ubah Kata Sandi */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-muted-foreground" />
            <span>Ubah kata sandi</span>
          </CardTitle>
          <CardDescription>
            Perbarui kata sandi akun pemilik gerai untuk menjaga keamanan akses mitra.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="max-w-md">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="tenantCurrentPassword">Kata sandi saat ini</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="tenantCurrentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      type="button"
                      size="icon-xs"
                      onClick={() => setShowCurrentPassword((v) => !v)}
                      aria-label={showCurrentPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    >
                      {showCurrentPassword ? <EyeOff /> : <Eye />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
              <Field>
                <FieldLabel htmlFor="tenantNewPassword">Kata sandi baru</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="tenantNewPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      type="button"
                      size="icon-xs"
                      onClick={() => setShowNewPassword((v) => !v)}
                      aria-label={showNewPassword ? "Sembunyikan kata sandi baru" : "Tampilkan kata sandi baru"}
                    >
                      {showNewPassword ? <EyeOff /> : <Eye />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
              <Field>
                <FieldLabel htmlFor="tenantConfirmPassword">Konfirmasi kata sandi baru</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="tenantConfirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      type="button"
                      size="icon-xs"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      aria-label={showConfirmPassword ? "Sembunyikan konfirmasi kata sandi" : "Tampilkan konfirmasi kata sandi"}
                    >
                      {showConfirmPassword ? <EyeOff /> : <Eye />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
              <div className="flex justify-end pt-1">
                <Button type="submit" disabled={isUpdatingPassword}>
                  {isUpdatingPassword ? <Spinner /> : <KeyRound />}
                  <span>{isUpdatingPassword ? "Menyimpan" : "Simpan kata sandi"}</span>
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
