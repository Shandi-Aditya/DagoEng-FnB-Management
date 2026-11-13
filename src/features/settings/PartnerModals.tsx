"use client";

import type React from "react";
import { Check, Copy, Key, Power } from "lucide-react";

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

import {
  formatSettingsDateTime,
  organizerActivationLabel,
  organizerActivationTone,
  productStatusLabel,
  productStatusTone,
  type UnifiedPartnerRow,
} from "./settings-domain";

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
  } = props;

  return (
    <>
      {/* Tambah Mitra F&B */}
      <Dialog open={isAddTenantOpen} onOpenChange={onAddTenantOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah mitra F&B</DialogTitle>
            <DialogDescription>
              Mitra baru tersedia untuk pengelompokan menu dan bagi hasil POS.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSaveNewTenant} className="flex flex-col gap-3">
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
                <Label htmlFor="tenantBadge">Kategori</Label>
                <Input
                  id="tenantBadge"
                  type="text"
                  value={formTenantBadge}
                  onChange={(e) => onFormTenantBadgeChange(e.target.value)}
                  placeholder="Contoh: Dessert"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onAddTenantOpenChange(false)}>
                Batal
              </Button>
              <Button type="submit">Simpan mitra</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Tambah Penyelenggara Event */}
      <Dialog open={isAddOrgOpen} onOpenChange={onAddOrgOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tambah penyelenggara event</DialogTitle>
            <DialogDescription>
              Daftarkan komunitas atau penyelenggara agar bisa menerbitkan event.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreateOrganizerSubmit} className="flex flex-col gap-3">
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
              <textarea
                id="orgNotes"
                rows={2}
                value={newOrgNotes}
                onChange={(e) => onNewOrgNotesChange(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onAddOrgOpenChange(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isSubmittingOrg}>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tautan aktivasi penyelenggara</DialogTitle>
            <DialogDescription>
              {activationModalData
                ? `Bagikan tautan ini ke ${activationModalData.organizerName} (${activationModalData.organizerEmail}).`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {activationModalData ? (
            <div className="flex flex-col gap-3 py-2 text-xs">
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
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onCloseActivationModal}>
              Tutup
            </Button>
            {activationModalData ? (
              <Button
                type="button"
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
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-6 overflow-y-auto">
          {selectedPartner ? (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {selectedPartner.type === "FNB" ? "Mitra F&B" : "Penyelenggara event"}
                  </Badge>
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

              <div className="flex flex-col gap-4 py-4 text-xs">
                <div className="rounded-lg border p-3.5 space-y-2">
                  <p className="font-medium text-foreground">Kontak & akun</p>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Penanggung jawab</span>
                    <span className="text-foreground">{selectedPartner.contactPerson}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Telepon</span>
                    <span className="font-mono text-foreground">{selectedPartner.phone}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Email</span>
                    <span className="text-foreground">{selectedPartner.email}</span>
                  </div>
                </div>

                {selectedPartner.bankInfo ? (
                  <div className="rounded-lg border p-3.5 space-y-1.5">
                    <p className="font-medium text-foreground">Rekening pencairan</p>
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
                <SheetFooter className="mt-auto border-t pt-4 gap-2">
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
                      onToggleOrganizerStatus(selectedPartner.id, selectedPartner.status);
                      onClosePartnerDetail();
                    }}
                  >
                    <Power />
                    <span>
                      {selectedPartner.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
                    </span>
                  </Button>
                </SheetFooter>
              ) : null}
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
