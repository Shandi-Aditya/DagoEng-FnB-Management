"use client";

import type React from "react";
import { Check, Copy, Key, Power } from "lucide-react";

import { notify } from "@/components/app/notify";
import { StatusBadge } from "@/components/app/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

import {
  formatSettingsDateTime,
  organizerActivationLabel,
  organizerActivationTone,
  productStatusLabel,
  productStatusTone,
  type UnifiedPartnerRow,
} from "./settings-domain";
import type { TenantStatus, TenantPartnerType } from "@/lib/domain-sync-types";

export interface PartnerModalsProps {
  // Add Tenant
  isAddTenantOpen: boolean;
  onAddTenantOpenChange: (open: boolean) => void;
  formTenantName: string;
  onFormTenantNameChange: (val: string) => void;
  formTenantCode: string;
  onFormTenantCodeChange: (val: string) => void;
  formTenantBadge: string;
  onFormTenantBadgeChange: (val: string) => void;
  formTenantPartnerType?: TenantPartnerType;
  onFormTenantPartnerTypeChange?: (val: TenantPartnerType) => void;
  formTenantMdrBearer?: "MITRA" | "DAGO" | "SPLIT";
  onFormTenantMdrBearerChange?: (val: "MITRA" | "DAGO" | "SPLIT") => void;
  formTenantPIC?: string;
  onFormTenantPICChange?: (val: string) => void;
  formTenantPhone?: string;
  onFormTenantPhoneChange?: (val: string) => void;
  formTenantEmail?: string;
  onFormTenantEmailChange?: (val: string) => void;
  formTenantNPWP?: string;
  onFormTenantNPWPChange?: (val: string) => void;
  formTenantBankName?: string;
  onFormTenantBankNameChange?: (val: string) => void;
  formTenantBankAccountNumber?: string;
  onFormTenantBankAccountNumberChange?: (val: string) => void;
  formTenantBankAccountHolder?: string;
  onFormTenantBankAccountHolderChange?: (val: string) => void;
  isEditingTenant?: boolean;
  formTenantPksNumber?: string;
  onFormTenantPksNumberChange?: (val: string) => void;
  formTenantContractStart?: string;
  onFormTenantContractStartChange?: (val: string) => void;
  formTenantContractEnd?: string;
  onFormTenantContractEndChange?: (val: string) => void;
  formTenantPksFile?: string;
  onFormTenantPksFileChange?: (val: string) => void;
  onSaveNewTenant: (e: React.FormEvent) => void;
  // Add Organizer
  isAddOrgOpen: boolean;
  onAddOrgOpenChange: (open: boolean) => void;
  newOrgName: string;
  onNewOrgNameChange: (val: string) => void;
  newOrgCategory: string;
  onNewOrgCategoryChange: (val: string) => void;
  newOrgPIC: string;
  onNewOrgPICChange: (val: string) => void;
  newOrgPhone: string;
  onNewOrgPhoneChange: (val: string) => void;
  newOrgEmail: string;
  onNewOrgEmailChange: (val: string) => void;
  newOrgNotes: string;
  onNewOrgNotesChange: (val: string) => void;
  newOrgStatus: "ACTIVE" | "INACTIVE";
  onNewOrgStatusChange: (val: "ACTIVE" | "INACTIVE") => void;
  addOrgError: string;
  isSubmittingOrg: boolean;
  onCreateOrganizerSubmit: (e: React.FormEvent) => void;
  // Activation Modal
  activationModalData: {
    organizerName: string;
    organizerEmail: string;
    activationUrl: string;
    expiresAt: string;
  } | null;
  onCloseActivationModal: () => void;
  copiedLink: boolean;
  onCopyActivationLink: (url: string) => void;
  // Detail Sheet
  selectedPartner: UnifiedPartnerRow | null;
  onClosePartnerDetail: () => void;
  onToggleOrganizerStatus: (orgId: string, status: "ACTIVE" | "INACTIVE") => void;
  onGenerateActivationLink: (orgId: string) => void;
  isGeneratingInvite: boolean;
  onToggleTenantStatus?: (tenantId: string, status: TenantStatus, reason?: string) => void;
  onGenerateTenantActivationLink?: (tenantId: string) => void;
  onEditTenant?: (tenantId: string) => void;
  onRecordTenantDeposit?: (tenantId: string) => void;
}

export function PartnerModals(props: PartnerModalsProps) {
  const {
    isAddTenantOpen,
    onAddTenantOpenChange,
    formTenantName,
    onFormTenantNameChange,
    formTenantCode,
    onFormTenantCodeChange,
    formTenantBadge,
    onFormTenantBadgeChange,
    formTenantPartnerType = "EXTERNAL",
    onFormTenantPartnerTypeChange,
    formTenantMdrBearer = "MITRA",
    onFormTenantMdrBearerChange,
    formTenantPIC = "",
    onFormTenantPICChange,
    formTenantPhone = "",
    onFormTenantPhoneChange,
    formTenantEmail = "",
    onFormTenantEmailChange,
    formTenantNPWP = "",
    onFormTenantNPWPChange,
    formTenantBankName = "BCA",
    onFormTenantBankNameChange,
    formTenantBankAccountNumber = "",
    onFormTenantBankAccountNumberChange,
    formTenantBankAccountHolder = "",
    onFormTenantBankAccountHolderChange,
    isEditingTenant = false,
    formTenantPksNumber = "",
    onFormTenantPksNumberChange,
    formTenantContractStart = "",
    onFormTenantContractStartChange,
    formTenantContractEnd = "",
    onFormTenantContractEndChange,
    formTenantPksFile = "",
    onFormTenantPksFileChange,
    onSaveNewTenant,
    isAddOrgOpen,
    onAddOrgOpenChange,
    newOrgName,
    onNewOrgNameChange,
    newOrgCategory,
    onNewOrgCategoryChange,
    newOrgPIC,
    onNewOrgPICChange,
    newOrgPhone,
    onNewOrgPhoneChange,
    newOrgEmail,
    onNewOrgEmailChange,
    newOrgNotes,
    onNewOrgNotesChange,
    newOrgStatus,
    onNewOrgStatusChange,
    addOrgError,
    isSubmittingOrg,
    onCreateOrganizerSubmit,
    activationModalData,
    onCloseActivationModal,
    copiedLink,
    onCopyActivationLink,
    selectedPartner,
    onClosePartnerDetail,
    onToggleOrganizerStatus,
    onGenerateActivationLink,
    isGeneratingInvite,
    onToggleTenantStatus,
    onGenerateTenantActivationLink,
    onEditTenant,
    onRecordTenantDeposit,
  } = props;

  return (
    <>
      {/* Tambah Mitra F&B */}
      <Dialog open={isAddTenantOpen} onOpenChange={onAddTenantOpenChange}>
        <DialogContent className="max-w-md max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle>{isEditingTenant ? "Edit mitra F&B" : "Tambah mitra F&B"}</DialogTitle>
            <DialogDescription>
              {isEditingTenant
                ? "Perbarui profil kemitraan, rekening settlement, dan detail kontrak PKS."
                : "Mitra baru tersedia untuk pengelompokan menu, transaksi POS, dan skema bagi hasil."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSaveNewTenant} className="flex flex-1 min-h-0 flex-col">
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tenantName">Nama mitra</Label>
              <Input
                id="tenantName"
                type="text"
                required
                value={formTenantName}
                onChange={(e) => onFormTenantNameChange(e.target.value)}
                placeholder="Contoh: Gelato Kita"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tenantCode">Kode mitra</Label>
                <Input
                  id="tenantCode"
                  type="text"
                  value={formTenantCode}
                  onChange={(e) => onFormTenantCodeChange(e.target.value)}
                  placeholder="Contoh: GELATO"
                  className="font-mono"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tenantBadge">Kategori gerai</Label>
                <Input
                  id="tenantBadge"
                  type="text"
                  value={formTenantBadge}
                  onChange={(e) => onFormTenantBadgeChange(e.target.value)}
                  placeholder="Contoh: Dessert"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tenantPartnerType">Tipe mitra</Label>
                <NativeSelect
                  id="tenantPartnerType"
                  value={formTenantPartnerType}
                  onChange={(e) => onFormTenantPartnerTypeChange?.(e.target.value as TenantPartnerType)}
                >
                  <NativeSelectOption value="EXTERNAL">Eksternal (bagi hasil)</NativeSelectOption>
                  <NativeSelectOption value="INTERNAL">Internal (dikelola hub)</NativeSelectOption>
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tenantMdrBearer">Beban MDR QRIS (0.7%)</Label>
                <NativeSelect
                  id="tenantMdrBearer"
                  value={formTenantMdrBearer}
                  onChange={(e) => onFormTenantMdrBearerChange?.(e.target.value as "MITRA" | "DAGO" | "SPLIT")}
                >
                  <NativeSelectOption value="MITRA">Mitra (100% dipotong dari QRIS mitra)</NativeSelectOption>
                  <NativeSelectOption value="DAGO">Dago (100% ditanggung platform Dago)</NativeSelectOption>
                  <NativeSelectOption value="SPLIT">Bagi Proporsional (sesuai rasio bagi hasil)</NativeSelectOption>
                </NativeSelect>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tenantPIC">Penanggung jawab (PIC)</Label>
                <Input
                  id="tenantPIC"
                  type="text"
                  value={formTenantPIC}
                  onChange={(e) => onFormTenantPICChange?.(e.target.value)}
                  placeholder="Nama PIC"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tenantPhone">Nomor telepon / WhatsApp</Label>
                <Input
                  id="tenantPhone"
                  type="tel"
                  value={formTenantPhone}
                  onChange={(e) => onFormTenantPhoneChange?.(e.target.value)}
                  placeholder="+62 8..."
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tenantEmail">Email kontak</Label>
              <Input
                id="tenantEmail"
                type="email"
                value={formTenantEmail}
                onChange={(e) => onFormTenantEmailChange?.(e.target.value)}
                placeholder="mitra@dagocreative.id"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tenantNPWP">NPWP</Label>
                <Input
                  id="tenantNPWP"
                  type="text"
                  value={formTenantNPWP}
                  onChange={(e) => onFormTenantNPWPChange?.(e.target.value)}
                  placeholder="00.000.000.0-000.000"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tenantPksNumber">Nomor PKS</Label>
                <Input
                  id="tenantPksNumber"
                  type="text"
                  value={formTenantPksNumber}
                  onChange={(e) => onFormTenantPksNumberChange?.(e.target.value)}
                  placeholder="PKS/DCH/2024/..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tenantBankName">Bank</Label>
                <Input
                  id="tenantBankName"
                  type="text"
                  value={formTenantBankName}
                  onChange={(e) => onFormTenantBankNameChange?.(e.target.value)}
                  placeholder="BCA / Mandiri / BRI"
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="tenantBankAccountNumber">Nomor rekening</Label>
                <Input
                  id="tenantBankAccountNumber"
                  type="text"
                  value={formTenantBankAccountNumber}
                  onChange={(e) => onFormTenantBankAccountNumberChange?.(e.target.value)}
                  placeholder="Nomor rekening settlement"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tenantBankAccountHolder">Nama pemilik rekening</Label>
              <Input
                id="tenantBankAccountHolder"
                type="text"
                value={formTenantBankAccountHolder}
                onChange={(e) => onFormTenantBankAccountHolderChange?.(e.target.value)}
                placeholder="Atas nama di buku tabungan"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tenantContractStart">Mulai kontrak PKS</Label>
                <Input
                  id="tenantContractStart"
                  type="date"
                  value={formTenantContractStart}
                  onChange={(e) => onFormTenantContractStartChange?.(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tenantContractEnd">Akhir kontrak PKS</Label>
                <Input
                  id="tenantContractEnd"
                  type="date"
                  value={formTenantContractEnd}
                  onChange={(e) => onFormTenantContractEndChange?.(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tenantPksFileUpload">Dokumen PKS (PDF/gambar, maks. 512 KB)</Label>
              <Input
                id="tenantPksFileUpload"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const allowedMimes = new Set([
                    "application/pdf",
                    "image/png",
                    "image/jpeg",
                    "image/jpg",
                  ]);
                  const hasAllowedExt = /\.(pdf|png|jpe?g)$/i.test(file.name);
                  if (!allowedMimes.has(file.type) && !hasAllowedExt) {
                    notify.error(
                      "Format berkas tidak didukung",
                      "Pilih dokumen PKS berformat PDF, PNG, atau JPG."
                    );
                    e.target.value = "";
                    return;
                  }
                  if (file.size > 512 * 1024) {
                    notify.error(
                      "Ukuran berkas terlalu besar",
                      "Ukuran dokumen PKS maksimal 512 KB."
                    );
                    e.target.value = "";
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    if (typeof reader.result === "string") {
                      onFormTenantPksFileChange?.(`${file.name}|${reader.result}`);
                    }
                  };
                  reader.readAsDataURL(file);
                }}
              />
              {formTenantPksFile ? (
                <p className="text-xs text-muted-foreground font-mono truncate">
                  Berkas terpilih: {formTenantPksFile.split("|")[0]}
                </p>
              ) : null}
            </div>
            </div>

            <DialogFooter className="px-6 py-4 border-t shrink-0 gap-2">
              <Button type="button" variant="outline" size="lg" onClick={() => onAddTenantOpenChange(false)}>
                Batal
              </Button>
              <Button type="submit" size="lg">Simpan mitra</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Tambah Penyelenggara Event */}
      <Dialog open={isAddOrgOpen} onOpenChange={onAddOrgOpenChange}>
        <DialogContent className="max-w-md max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle>Tambah penyelenggara event</DialogTitle>
            <DialogDescription>
              Daftarkan komunitas atau penyelenggara agar bisa menerbitkan event.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreateOrganizerSubmit} className="flex flex-1 min-h-0 flex-col">
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 flex flex-col gap-3">
            {addOrgError ? (
              <Alert variant="destructive">
                <AlertDescription>{addOrgError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="orgName">Nama organisasi</Label>
              <Input
                id="orgName"
                type="text"
                required
                value={newOrgName}
                onChange={(e) => onNewOrgNameChange(e.target.value)}
                placeholder="Contoh: Komunitas Kopi Singaraja"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="orgCategory">Kategori</Label>
                <Input
                  id="orgCategory"
                  type="text"
                  value={newOrgCategory}
                  onChange={(e) => onNewOrgCategoryChange(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="orgStatus">Status awal</Label>
                <NativeSelect
                  id="orgStatus"
                  value={newOrgStatus}
                  onChange={(e) => onNewOrgStatusChange(e.target.value as "ACTIVE" | "INACTIVE")}
                >
                  <NativeSelectOption value="ACTIVE">Aktif</NativeSelectOption>
                  <NativeSelectOption value="INACTIVE">Nonaktif</NativeSelectOption>
                </NativeSelect>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="orgPIC">Penanggung jawab</Label>
                <Input
                  id="orgPIC"
                  type="text"
                  required
                  value={newOrgPIC}
                  onChange={(e) => onNewOrgPICChange(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="orgPhone">Nomor telepon / WhatsApp</Label>
                <Input
                  id="orgPhone"
                  type="tel"
                  required
                  value={newOrgPhone}
                  onChange={(e) => onNewOrgPhoneChange(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="orgEmail">Email login</Label>
              <Input
                id="orgEmail"
                type="email"
                required
                value={newOrgEmail}
                onChange={(e) => onNewOrgEmailChange(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="orgNotes">Catatan</Label>
              <Textarea
                id="orgNotes"
                rows={2}
                value={newOrgNotes}
                onChange={(e) => onNewOrgNotesChange(e.target.value)}
              />
            </div>
            </div>

            <DialogFooter className="px-6 py-4 border-t shrink-0 gap-2">
              <Button type="button" variant="outline" size="lg" onClick={() => onAddOrgOpenChange(false)}>
                Batal
              </Button>
              <Button type="submit" size="lg" disabled={isSubmittingOrg}>
                {isSubmittingOrg ? "Menyimpan..." : "Simpan penyelenggara"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Tautan Aktivasi Penyelenggara */}
      <Dialog
        open={Boolean(activationModalData)}
        onOpenChange={(open) => !open && onCloseActivationModal()}
      >
        <DialogContent className="max-w-md max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle>Tautan aktivasi akun</DialogTitle>
            <DialogDescription>
              {activationModalData
                ? `Bagikan tautan ini ke ${activationModalData.organizerName}${activationModalData.organizerEmail ? ` (${activationModalData.organizerEmail})` : ""}.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
            {activationModalData ? (
              <div className="flex flex-col gap-3 text-xs">
                <div className="rounded-lg border bg-muted/40 p-3 font-mono break-all text-foreground">
                  {activationModalData.activationUrl}
                </div>
                <p className="text-muted-foreground">
                  Berlaku sampai{" "}
                  <span className="font-mono text-foreground tabular-nums">
                    {formatSettingsDateTime(activationModalData.expiresAt)}
                  </span>
                </p>
              </div>
            ) : null}
          </div>
          <DialogFooter className="px-6 py-4 border-t shrink-0 gap-2">
            <Button type="button" variant="outline" size="lg" onClick={onCloseActivationModal}>
              Tutup
            </Button>
            {activationModalData ? (
              <Button
                type="button"
                size="lg"
                onClick={() => onCopyActivationLink(activationModalData.activationUrl)}
              >
                {copiedLink ? <Check /> : <Copy />}
                <span>{copiedLink ? "Disalin" : "Salin tautan"}</span>
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheet Detail Mitra */}
      <Sheet open={Boolean(selectedPartner)} onOpenChange={(open) => !open && onClosePartnerDetail()}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0 gap-0 overflow-hidden">
          {selectedPartner ? (
            <>
              <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {selectedPartner.type === "FNB" ? "Mitra F&B" : "Penyelenggara event"}
                  </Badge>
                  {selectedPartner.partnerType ? (
                    <Badge variant={selectedPartner.partnerType === "INTERNAL" ? "secondary" : "outline"}>
                      {selectedPartner.partnerType === "INTERNAL" ? "Internal" : "Eksternal"}
                    </Badge>
                  ) : null}
                  {selectedPartner.type === "EVENT" ? (
                    <StatusBadge status={organizerActivationTone(selectedPartner.activationStatus)}>
                      {organizerActivationLabel(selectedPartner.activationStatus)}
                    </StatusBadge>
                  ) : (
                    <StatusBadge status={productStatusTone(selectedPartner.status)}>
                      {productStatusLabel(selectedPartner.status)}
                    </StatusBadge>
                  )}
                </div>
                <SheetTitle className="text-xl font-medium text-foreground">
                  {selectedPartner.name}
                </SheetTitle>
                <SheetDescription>{selectedPartner.categoryOrBadge}</SheetDescription>
              </SheetHeader>

              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 flex flex-col gap-4 text-xs">
              {selectedPartner.status === "SUSPENDED" ? (
                <Alert className="border-warning/40 bg-warning/10 text-foreground">
                  <AlertDescription>
                    <strong>Mitra ditangguhkan:</strong> {selectedPartner.suspendedReason || "Keterlambatan setoran settlement melebihi 2 minggu (14 hari). Kasir outlet saat ini terkunci."}
                  </AlertDescription>
                </Alert>
              ) : null}
                <div className="rounded-lg border p-3.5 space-y-2">
                  <p className="font-medium text-foreground">Kontak & penanggung jawab</p>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Penanggung jawab</span>
                    <span className="text-foreground">{selectedPartner.contactPerson}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Telepon / WhatsApp</span>
                    <span className="font-mono text-foreground">{selectedPartner.phone}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Email</span>
                    <span className="text-foreground">{selectedPartner.email}</span>
                  </div>
                  {selectedPartner.npwp ? (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">NPWP</span>
                      <span className="font-mono text-foreground">{selectedPartner.npwp}</span>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-lg border p-3.5 space-y-2">
                  <p className="font-medium text-foreground">Informasi kontrak & kemitraan</p>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Tipe kemitraan</span>
                    <span className="font-medium text-foreground">
                      {selectedPartner.partnerType === "INTERNAL"
                        ? "Internal (tanpa settlement bagi hasil)"
                        : "Eksternal (bagi hasil POS)"}
                    </span>
                  </div>
                  {selectedPartner.contractPksNumber ? (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Nomor PKS</span>
                      <span className="font-mono text-foreground">{selectedPartner.contractPksNumber}</span>
                    </div>
                  ) : null}
                  {selectedPartner.contractStartDate || selectedPartner.contractEndDate ? (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Masa berlaku PKS</span>
                      <span className="text-foreground">
                        {selectedPartner.contractStartDate || "—"} s/d {selectedPartner.contractEndDate || "—"}
                      </span>
                    </div>
                  ) : null}
                  {selectedPartner.contractPksFile ? (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Berkas dokumen</span>
                      {(() => {
                        const pipeIdx = selectedPartner.contractPksFile.indexOf("|data:");
                        const fileName =
                          pipeIdx >= 0
                            ? selectedPartner.contractPksFile.slice(0, pipeIdx)
                            : selectedPartner.contractPksFile;
                        const dataUrl =
                          pipeIdx >= 0 ? selectedPartner.contractPksFile.slice(pipeIdx + 1) : "";
                        const isSafeMime =
                          /^data:(application\/pdf|image\/(png|jpeg|jpg));base64,/i.test(dataUrl);
                        return isSafeMime ? (
                          <a
                            href={dataUrl}
                            download={fileName || "dokumen-pks"}
                            className="font-mono text-primary underline underline-offset-2"
                          >
                            {fileName}
                          </a>
                        ) : (
                          <span className="font-mono text-primary">{fileName}</span>
                        );
                      })()}
                    </div>
                  ) : null}
                </div>

                {selectedPartner.bankInfo ? (
                  <div className="rounded-lg border p-3.5 space-y-1.5">
                    <p className="font-medium text-foreground">Rekening pencairan settlement</p>
                    <p className="text-foreground">
                      {selectedPartner.bankInfo.bankName} ·{" "}
                      <span className="font-mono">{selectedPartner.bankInfo.accountNumber}</span>
                    </p>
                    <p className="text-muted-foreground">
                      a.n. {selectedPartner.bankInfo.accountHolder}
                    </p>
                  </div>
                ) : null}

                <div className="rounded-lg border p-3.5 space-y-2">
                  <p className="font-medium text-foreground">Hak akses ({selectedPartner.roleName})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPartner.permissions.map((perm) => (
                      <Badge key={perm} variant="secondary" className="font-mono">
                        {perm}
                      </Badge>
                    ))}
                  </div>
                </div>

                {selectedPartner.notes ? (
                  <p className="text-muted-foreground">{selectedPartner.notes}</p>
                ) : null}
              </div>

              {selectedPartner.type === "EVENT" ? (
                <SheetFooter className="mt-auto border-t px-6 py-4 shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onGenerateActivationLink(selectedPartner.id)}
                    disabled={isGeneratingInvite}
                  >
                    <Key />
                    <span>Tautan aktivasi</span>
                  </Button>
                  <Button
                    type="button"
                    variant={selectedPartner.status === "ACTIVE" ? "outline" : "default"}
                    onClick={() => {
                      onToggleOrganizerStatus(
                        selectedPartner.id,
                        selectedPartner.status === "ACTIVE" ? "ACTIVE" : "INACTIVE"
                      );
                      onClosePartnerDetail();
                    }}
                  >
                    <Power />
                    <span>
                      {selectedPartner.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
                    </span>
                  </Button>
                </SheetFooter>
              ) : (
                <SheetFooter className="mt-auto border-t px-6 py-4 shrink-0 gap-2 flex-wrap">
                  {onEditTenant ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onEditTenant(selectedPartner.id)}
                    >
                      <span>Edit mitra</span>
                    </Button>
                  ) : null}
                  {onRecordTenantDeposit && selectedPartner.partnerType !== "INTERNAL" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onRecordTenantDeposit(selectedPartner.id);
                        onClosePartnerDetail();
                      }}
                    >
                      <span>Catat setoran kas</span>
                    </Button>
                  ) : null}
                  {onGenerateTenantActivationLink ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onGenerateTenantActivationLink(selectedPartner.id)}
                      disabled={isGeneratingInvite}
                    >
                      <Key />
                      <span>Undang pemilik</span>
                    </Button>
                  ) : null}
                  {onToggleTenantStatus ? (
                    <>
                      {selectedPartner.status === "ACTIVE" ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              onToggleTenantStatus(selectedPartner.id, "SUSPENDED", "Ditangguhkan administratif oleh admin.");
                              onClosePartnerDetail();
                            }}
                          >
                            <Power />
                            <span>Tangguhkan</span>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              onToggleTenantStatus(selectedPartner.id, "INACTIVE");
                              onClosePartnerDetail();
                            }}
                          >
                            <Power />
                            <span>Nonaktifkan</span>
                          </Button>
                        </>
                      ) : selectedPartner.status === "SUSPENDED" ? (
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={() => {
                            onToggleTenantStatus(selectedPartner.id, "ACTIVE");
                            onClosePartnerDetail();
                          }}
                        >
                          <Power />
                          <span>Buka kunci (aktifkan)</span>
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={() => {
                            onToggleTenantStatus(selectedPartner.id, "ACTIVE");
                            onClosePartnerDetail();
                          }}
                        >
                          <Power />
                          <span>Aktifkan</span>
                        </Button>
                      )}
                    </>
                  ) : null}
                </SheetFooter>
              )}
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
