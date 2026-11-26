"use client";

import type React from "react";
import { useState } from "react";
import { Award, Edit2, Grid, Laptop, Plus, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrencyIDR } from "@/lib/utils";

import {
  spaceStatusLabel,
  spaceStatusTone,
  tableStatusLabel,
  tableStatusTone,
} from "./settings-domain";

export interface SpaceRecord {
  id: string;
  name: string;
  type: string;
  area?: string;
  capacity?: number;
  hourlyRate?: number;
  dailyRate?: number;
  status?: string;
  imageUrl?: string;
}

export interface PlanRecord {
  id: string;
  name: string;
  billingCycle?: string;
  priceNumber?: number;
  priceFormatted?: string;
  deskAccess?: string;
}

export interface TableRecord {
  id: string;
  number: string | number;
  areaName?: string;
  cap?: number;
  status?: string;
}

export interface SpacesAndTablesTabProps {
  spaces: SpaceRecord[];
  plans: PlanRecord[];
  tables: TableRecord[];
  // Space actions
  onOpenAddSpace: () => void;
  onOpenEditSpace: (sp: SpaceRecord) => void;
  onRequestDeleteSpace: (sp: SpaceRecord) => void;
  isAddSpaceOpen: boolean;
  onAddSpaceOpenChange: (open: boolean) => void;
  isEditSpaceOpen: boolean;
  onEditSpaceOpenChange: (open: boolean) => void;
  isDeleteSpaceOpen: boolean;
  onDeleteSpaceOpenChange: (open: boolean) => void;
  deletingSpace: SpaceRecord | null;
  formSpaceName: string;
  onFormSpaceNameChange: (val: string) => void;
  formSpaceType: string;
  onFormSpaceTypeChange: (val: string) => void;
  formSpaceArea: string;
  onFormSpaceAreaChange: (val: string) => void;
  formSpaceCap: number;
  onFormSpaceCapChange: (val: number) => void;
  formSpaceHourly: number;
  onFormSpaceHourlyChange: (val: number) => void;
  formSpaceDaily: number;
  onFormSpaceDailyChange: (val: number) => void;
  formSpaceStatus: string;
  onFormSpaceStatusChange: (val: string) => void;
  onSaveNewSpace: (e: React.FormEvent) => void;
  onSaveEditSpace: (e: React.FormEvent) => void;
  onConfirmDeleteSpace: () => void;
  // Plan actions
  onOpenAddPlan: () => void;
  onOpenEditPlan: (pl: PlanRecord) => void;
  onRequestDeletePlan: (pl: PlanRecord) => void;
  isAddPlanOpen: boolean;
  onAddPlanOpenChange: (open: boolean) => void;
  isEditPlanOpen: boolean;
  onEditPlanOpenChange: (open: boolean) => void;
  isDeletePlanOpen: boolean;
  onDeletePlanOpenChange: (open: boolean) => void;
  deletingPlan: PlanRecord | null;
  formPlanName: string;
  onFormPlanNameChange: (val: string) => void;
  formPlanCycle: string;
  onFormPlanCycleChange: (val: string) => void;
  formPlanPrice: number;
  onFormPlanPriceChange: (val: number) => void;
  formPlanDeskAccess: string;
  onFormPlanDeskAccessChange: (val: string) => void;
  onSaveNewPlan: (e: React.FormEvent) => void;
  onSaveEditPlan: (e: React.FormEvent) => void;
  onConfirmDeletePlan: () => void;
  // Table actions
  onOpenAddTable: () => void;
  onOpenEditTable: (tbl: TableRecord) => void;
  onRequestDeleteTable: (tbl: TableRecord) => void;
  onToggleTableStatus: (id: string) => void;
  isAddTableOpen: boolean;
  onAddTableOpenChange: (open: boolean) => void;
  isEditTableOpen: boolean;
  onEditTableOpenChange: (open: boolean) => void;
  isDeleteTableOpen: boolean;
  onDeleteTableOpenChange: (open: boolean) => void;
  deletingTable: TableRecord | null;
  formTableNumber: number;
  onFormTableNumberChange: (val: number) => void;
  formTableArea: string;
  onFormTableAreaChange: (val: string) => void;
  formTableCap: number;
  onFormTableCapChange: (val: number) => void;
  formTableStatus: string;
  onFormTableStatusChange: (val: string) => void;
  onSaveNewTable: (e: React.FormEvent) => void;
  onSaveEditTable: (e: React.FormEvent) => void;
  onConfirmDeleteTable: () => void;
}

export function SpacesAndTablesTab(props: SpacesAndTablesTabProps) {
  const [subTab, setSubTab] = useState<"SPACES" | "PLANS" | "TABLES">("SPACES");
  const {
    spaces,
    plans,
    tables,
    onOpenAddSpace,
    onOpenEditSpace,
    onRequestDeleteSpace,
    isAddSpaceOpen,
    onAddSpaceOpenChange,
    isEditSpaceOpen,
    onEditSpaceOpenChange,
    isDeleteSpaceOpen,
    onDeleteSpaceOpenChange,
    deletingSpace,
    formSpaceName,
    onFormSpaceNameChange,
    formSpaceType,
    onFormSpaceTypeChange,
    formSpaceArea,
    onFormSpaceAreaChange,
    formSpaceCap,
    onFormSpaceCapChange,
    formSpaceHourly,
    onFormSpaceHourlyChange,
    formSpaceDaily,
    onFormSpaceDailyChange,
    formSpaceStatus,
    onFormSpaceStatusChange,
    onSaveNewSpace,
    onSaveEditSpace,
    onConfirmDeleteSpace,
    onOpenAddPlan,
    onOpenEditPlan,
    onRequestDeletePlan,
    isAddPlanOpen,
    onAddPlanOpenChange,
    isEditPlanOpen,
    onEditPlanOpenChange,
    isDeletePlanOpen,
    onDeletePlanOpenChange,
    deletingPlan,
    formPlanName,
    onFormPlanNameChange,
    formPlanCycle,
    onFormPlanCycleChange,
    formPlanPrice,
    onFormPlanPriceChange,
    formPlanDeskAccess,
    onFormPlanDeskAccessChange,
    onSaveNewPlan,
    onSaveEditPlan,
    onConfirmDeletePlan,
    onOpenAddTable,
    onOpenEditTable,
    onRequestDeleteTable,
    onToggleTableStatus,
    isAddTableOpen,
    onAddTableOpenChange,
    isEditTableOpen,
    onEditTableOpenChange,
    isDeleteTableOpen,
    onDeleteTableOpenChange,
    deletingTable,
    formTableNumber,
    onFormTableNumberChange,
    formTableArea,
    onFormTableAreaChange,
    formTableCap,
    onFormTableCapChange,
    formTableStatus,
    onFormTableStatusChange,
    onSaveNewTable,
    onSaveEditTable,
    onConfirmDeleteTable,
  } = props;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={subTab} onValueChange={(v) => setSubTab(v as "SPACES" | "PLANS" | "TABLES")}>
          <TabsList className="w-full justify-start overflow-x-auto no-scrollbar">
            <TabsTrigger value="SPACES">Ruang kerja ({spaces.length})</TabsTrigger>
            <TabsTrigger value="PLANS">Paket member ({plans.length})</TabsTrigger>
            <TabsTrigger value="TABLES">Meja & area ({tables.length})</TabsTrigger>
          </TabsList>
        </Tabs>

        <div>
          {subTab === "SPACES" ? (
            <Button type="button" size="lg" onClick={onOpenAddSpace}>
              <Plus />
              <span>Tambah ruang</span>
            </Button>
          ) : subTab === "PLANS" ? (
            <Button type="button" size="lg" onClick={onOpenAddPlan}>
              <Plus />
              <span>Tambah paket</span>
            </Button>
          ) : (
            <Button type="button" size="lg" onClick={onOpenAddTable}>
              <Plus />
              <span>Tambah meja</span>
            </Button>
          )}
        </div>
      </div>

      {/* RUANG KERJA */}
      {subTab === "SPACES" ? (
        spaces.length === 0 ? (
          <EmptyState
            className="border"
            icon={<Laptop />}
            title="Belum ada ruang kerja"
            description="Tambahkan ruang kerja atau ruang rapat untuk ditampilkan di kasir co-working."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ruang</TableHead>
                  <TableHead className="hidden sm:table-cell">Tipe & area</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Kapasitas</TableHead>
                  <TableHead className="text-right">Tarif</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="w-0 text-right">
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spaces.map((sp) => (
                  <TableRow key={sp.id}>
                    <TableCell className="whitespace-normal">
                      <p className="text-sm font-medium text-foreground">{sp.name}</p>
                      <p className="text-xs text-muted-foreground sm:hidden">
                        {sp.type}
                        {sp.area ? ` · ${sp.area}` : ""}
                      </p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      {sp.type}
                      {sp.area ? ` · ${sp.area}` : ""}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right font-mono text-xs tabular-nums">
                      {sp.capacity ?? "—"} orang
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      <p className="font-medium text-foreground">
                        {sp.hourlyRate !== undefined ? `${formatCurrencyIDR(sp.hourlyRate)}/jam` : "—"}
                      </p>
                      <p className="text-muted-foreground">
                        {sp.dailyRate !== undefined ? `${formatCurrencyIDR(sp.dailyRate)}/hari` : "—"}
                      </p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <StatusBadge status={spaceStatusTone(sp.status)}>
                        {spaceStatusLabel(sp.status)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => onOpenEditSpace(sp)}
                          aria-label={`Edit ${sp.name}`}
                        >
                          <Edit2 />
                        </Button>
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => onRequestDeleteSpace(sp)}
                          aria-label={`Hapus ${sp.name}`}
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
        )
      ) : null}

      {/* PAKET MEMBER */}
      {subTab === "PLANS" ? (
        plans.length === 0 ? (
          <EmptyState
            className="border"
            icon={<Award />}
            title="Belum ada paket member"
            description="Tambahkan paket keanggotaan co-working untuk penjualan langganan."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paket</TableHead>
                  <TableHead className="hidden sm:table-cell">Siklus</TableHead>
                  <TableHead className="text-right">Harga</TableHead>
                  <TableHead className="hidden md:table-cell">Akses meja</TableHead>
                  <TableHead className="w-0 text-right">
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((pl) => (
                  <TableRow key={pl.id}>
                    <TableCell className="whitespace-normal">
                      <p className="text-sm font-medium text-foreground">{pl.name}</p>
                      <p className="text-xs text-muted-foreground sm:hidden">{pl.billingCycle || "—"}</p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      {pl.billingCycle || "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-medium tabular-nums">
                      {pl.priceFormatted || (pl.priceNumber !== undefined ? formatCurrencyIDR(pl.priceNumber) : "—")}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {pl.deskAccess || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => onOpenEditPlan(pl)}
                          aria-label={`Edit ${pl.name}`}
                        >
                          <Edit2 />
                        </Button>
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => onRequestDeletePlan(pl)}
                          aria-label={`Hapus ${pl.name}`}
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
        )
      ) : null}

      {/* MEJA & AREA */}
      {subTab === "TABLES" ? (
        tables.length === 0 ? (
          <EmptyState
            className="border"
            icon={<Grid />}
            title="Belum ada meja"
            description="Tambahkan meja untuk denah F&B."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Meja</TableHead>
                  <TableHead className="hidden sm:table-cell">Area</TableHead>
                  <TableHead className="text-right">Kursi</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-0 text-right">
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tables.map((tbl) => (
                  <TableRow key={tbl.id}>
                    <TableCell>
                      <p className="text-sm font-medium text-foreground">Meja {tbl.number}</p>
                      <p className="text-xs text-muted-foreground sm:hidden">{tbl.areaName || "—"}</p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      {tbl.areaName || "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {tbl.cap ?? "—"}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => onToggleTableStatus(tbl.id)}
                        className="cursor-pointer rounded-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Ubah status meja ${tbl.number}`}
                      >
                        <StatusBadge status={tableStatusTone(tbl.status)}>
                          {tableStatusLabel(tbl.status)}
                        </StatusBadge>
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => onOpenEditTable(tbl)}
                          aria-label={`Edit meja ${tbl.number}`}
                        >
                          <Edit2 />
                        </Button>
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => onRequestDeleteTable(tbl)}
                          aria-label={`Hapus meja ${tbl.number}`}
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
        )
      ) : null}

      {/* DIALOG RUANG */}
      {[
        { open: isAddSpaceOpen, onOpenChange: onAddSpaceOpenChange, onSubmit: onSaveNewSpace, isEdit: false },
        { open: isEditSpaceOpen, onOpenChange: onEditSpaceOpenChange, onSubmit: onSaveEditSpace, isEdit: true },
      ].map((cfg) => (
        <Dialog key={cfg.isEdit ? "edit-sp" : "add-sp"} open={cfg.open} onOpenChange={cfg.onOpenChange}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{cfg.isEdit ? "Edit ruang kerja" : "Tambah ruang kerja"}</DialogTitle>
              <DialogDescription>Atur kapasitas, tarif, dan status ketersediaan ruang.</DialogDescription>
            </DialogHeader>
            <form onSubmit={cfg.onSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Nama ruang</Label>
                <Input
                  type="text"
                  required
                  value={formSpaceName}
                  onChange={(e) => onFormSpaceNameChange(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Tipe</Label>
                  <NativeSelect value={formSpaceType} onChange={(e) => onFormSpaceTypeChange(e.target.value)}>
                    <NativeSelectOption value="OPEN_SPACE">Open space</NativeSelectOption>
                    <NativeSelectOption value="SPACE_MONITOR">Space monitor</NativeSelectOption>
                    <NativeSelectOption value="SMALL_MEETING_ROOM">Small meeting room</NativeSelectOption>
                    <NativeSelectOption value="LARGE_MEETING_ROOM">Large meeting room</NativeSelectOption>
                    <NativeSelectOption value="HOT_DESK">Hot desk</NativeSelectOption>
                    <NativeSelectOption value="DEDICATED_DESK">Dedicated desk</NativeSelectOption>
                    <NativeSelectOption value="MEETING_ROOM">Ruang rapat</NativeSelectOption>
                    <NativeSelectOption value="PRIVATE_POD">Private pod</NativeSelectOption>
                    <NativeSelectOption value="PRIVATE_OFFICE">Kantor privat</NativeSelectOption>
                    <NativeSelectOption value="EVENT_SPACE">Ruang event</NativeSelectOption>
                  </NativeSelect>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Area</Label>
                  <Input type="text" value={formSpaceArea} onChange={(e) => onFormSpaceAreaChange(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Kapasitas</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formSpaceCap}
                    onChange={(e) => onFormSpaceCapChange(Number(e.target.value))}
                    className="font-mono tabular-nums"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Tarif/jam</Label>
                  <Input
                    type="number"
                    min={0}
                    step={5000}
                    value={formSpaceHourly}
                    onChange={(e) => onFormSpaceHourlyChange(Number(e.target.value))}
                    className="font-mono tabular-nums"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Tarif/hari</Label>
                  <Input
                    type="number"
                    min={0}
                    step={5000}
                    value={formSpaceDaily}
                    onChange={(e) => onFormSpaceDailyChange(Number(e.target.value))}
                    className="font-mono tabular-nums"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Status</Label>
                <NativeSelect value={formSpaceStatus} onChange={(e) => onFormSpaceStatusChange(e.target.value)}>
                  <NativeSelectOption value="AVAILABLE">Tersedia</NativeSelectOption>
                  <NativeSelectOption value="MAINTENANCE">Perbaikan</NativeSelectOption>
                </NativeSelect>
              </div>
              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="outline" size="lg" onClick={() => cfg.onOpenChange(false)}>
                  Batal
                </Button>
                <Button type="submit" size="lg">Simpan</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ))}

      <ConfirmDialog
        open={isDeleteSpaceOpen}
        onOpenChange={onDeleteSpaceOpenChange}
        title="Hapus ruang?"
        description={deletingSpace ? `Ruang "${deletingSpace.name}" akan dihapus dari daftar.` : "Hapus ruang?"}
        confirmLabel="Hapus"
        destructive
        onConfirm={onConfirmDeleteSpace}
      />

      {/* DIALOG PAKET */}
      {[
        { open: isAddPlanOpen, onOpenChange: onAddPlanOpenChange, onSubmit: onSaveNewPlan, isEdit: false },
        { open: isEditPlanOpen, onOpenChange: onEditPlanOpenChange, onSubmit: onSaveEditPlan, isEdit: true },
      ].map((cfg) => (
        <Dialog key={cfg.isEdit ? "edit-pl" : "add-pl"} open={cfg.open} onOpenChange={cfg.onOpenChange}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{cfg.isEdit ? "Edit paket member" : "Tambah paket member"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={cfg.onSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Nama paket</Label>
                <Input type="text" required value={formPlanName} onChange={(e) => onFormPlanNameChange(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Siklus</Label>
                  <Input type="text" value={formPlanCycle} onChange={(e) => onFormPlanCycleChange(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Harga (Rp)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={10000}
                    value={formPlanPrice}
                    onChange={(e) => onFormPlanPriceChange(Number(e.target.value))}
                    className="font-mono tabular-nums"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Akses meja</Label>
                <Input
                  type="text"
                  value={formPlanDeskAccess}
                  onChange={(e) => onFormPlanDeskAccessChange(e.target.value)}
                />
              </div>
              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="outline" size="lg" onClick={() => cfg.onOpenChange(false)}>
                  Batal
                </Button>
                <Button type="submit" size="lg">Simpan</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ))}

      <ConfirmDialog
        open={isDeletePlanOpen}
        onOpenChange={onDeletePlanOpenChange}
        title="Hapus paket?"
        description={deletingPlan ? `Paket "${deletingPlan.name}" akan dihapus.` : "Hapus paket?"}
        confirmLabel="Hapus"
        destructive
        onConfirm={onConfirmDeletePlan}
      />

      {/* DIALOG MEJA */}
      {[
        { open: isAddTableOpen, onOpenChange: onAddTableOpenChange, onSubmit: onSaveNewTable, isEdit: false },
        { open: isEditTableOpen, onOpenChange: onEditTableOpenChange, onSubmit: onSaveEditTable, isEdit: true },
      ].map((cfg) => (
        <Dialog key={cfg.isEdit ? "edit-tbl" : "add-tbl"} open={cfg.open} onOpenChange={cfg.onOpenChange}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{cfg.isEdit ? "Edit meja" : "Tambah meja"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={cfg.onSubmit} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Nomor meja</Label>
                  <Input
                    type="number"
                    min={1}
                    required
                    value={formTableNumber}
                    onChange={(e) => onFormTableNumberChange(Number(e.target.value))}
                    className="font-mono tabular-nums"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Kursi</Label>
                  <Input
                    type="number"
                    min={1}
                    required
                    value={formTableCap}
                    onChange={(e) => onFormTableCapChange(Number(e.target.value))}
                    className="font-mono tabular-nums"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Area</Label>
                <Input type="text" required value={formTableArea} onChange={(e) => onFormTableAreaChange(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Status</Label>
                <NativeSelect value={formTableStatus} onChange={(e) => onFormTableStatusChange(e.target.value)}>
                  <NativeSelectOption value="AVAILABLE">Tersedia</NativeSelectOption>
                  <NativeSelectOption value="OCCUPIED">Terisi</NativeSelectOption>
                  <NativeSelectOption value="RESERVED">Dipesan</NativeSelectOption>
                </NativeSelect>
              </div>
              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="outline" size="lg" onClick={() => cfg.onOpenChange(false)}>
                  Batal
                </Button>
                <Button type="submit" size="lg">Simpan</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ))}

      <ConfirmDialog
        open={isDeleteTableOpen}
        onOpenChange={onDeleteTableOpenChange}
        title="Hapus meja?"
        description={deletingTable ? `Meja ${deletingTable.number} akan dihapus.` : "Hapus meja?"}
        confirmLabel="Hapus"
        destructive
        onConfirm={onConfirmDeleteTable}
      />
    </div>
  );
}
