"use client";

import type React from "react";
import { CheckCircle2, Trash2, UploadCloud } from "lucide-react";

import { ConfirmDialog } from "@/components/app/confirm-dialog";
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
import type { MasterProduct } from "@/types/product";

export interface ProductModalsProps {
  tenants: { id: string; name: string }[];
  categories: string[];
  isTenantScope?: boolean;
  isAddOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
  isEditOpen: boolean;
  onEditOpenChange: (open: boolean) => void;
  editingProduct: MasterProduct | null;
  isDeleteOpen: boolean;
  onDeleteOpenChange: (open: boolean) => void;
  deletingProduct: MasterProduct | null;
  onRequestDeleteFromEdit: (product: MasterProduct) => void;
  isAddCategoryOpen: boolean;
  onAddCategoryOpenChange: (open: boolean) => void;
  formName: string;
  onFormNameChange: (val: string) => void;
  formCategory: string;
  onFormCategoryChange: (val: string) => void;
  formTenantId: string;
  onFormTenantIdChange: (val: string) => void;
  formPrice: number;
  onFormPriceChange: (val: number) => void;
  formCogs: number;
  onFormCogsChange: (val: number) => void;
  formDesc: string;
  onFormDescChange: (val: string) => void;
  formImg: string;
  onFormImgChange: (val: string) => void;
  formStatus: "ACTIVE" | "INACTIVE";
  onFormStatusChange: (val: "ACTIVE" | "INACTIVE") => void;
  newCategoryName: string;
  onNewCategoryNameChange: (val: string) => void;
  onImageFileUpload: (e: React.ChangeEvent<HTMLInputElement>, cb: (base64: string) => void) => void;
  onSaveNewProduct: (e: React.FormEvent) => void;
  onSaveEditProduct: (e: React.FormEvent) => void;
  onConfirmDeleteProduct: () => void;
  onSaveNewCategory: (e: React.FormEvent) => void;
}

export function ProductModals(props: ProductModalsProps) {
  const {
    tenants,
    categories,
    isTenantScope = false,
    isAddOpen,
    onAddOpenChange,
    isEditOpen,
    onEditOpenChange,
    editingProduct,
    isDeleteOpen,
    onDeleteOpenChange,
    deletingProduct,
    onRequestDeleteFromEdit,
    isAddCategoryOpen,
    onAddCategoryOpenChange,
    formName,
    onFormNameChange,
    formCategory,
    onFormCategoryChange,
    formTenantId,
    onFormTenantIdChange,
    formPrice,
    onFormPriceChange,
    formCogs,
    onFormCogsChange,
    formDesc,
    onFormDescChange,
    formImg,
    onFormImgChange,
    formStatus,
    onFormStatusChange,
    newCategoryName,
    onNewCategoryNameChange,
    onImageFileUpload,
    onSaveNewProduct,
    onSaveEditProduct,
    onConfirmDeleteProduct,
    onSaveNewCategory,
  } = props;

  const renderFormFields = (isEdit: boolean) => (
    <div className="flex flex-col gap-3 py-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={isEdit ? "editProdName" : "addProdName"}>Nama menu</Label>
        <Input
          id={isEdit ? "editProdName" : "addProdName"}
          type="text"
          required
          value={formName}
          onChange={(e) => onFormNameChange(e.target.value)}
          placeholder="Contoh: Kopi Aren Spesial"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {!isTenantScope ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={isEdit ? "editProdTenant" : "addProdTenant"}>Mitra</Label>
            <NativeSelect
              id={isEdit ? "editProdTenant" : "addProdTenant"}
              value={formTenantId}
              onChange={(e) => onFormTenantIdChange(e.target.value)}
            >
              {tenants.map((t) => (
                <NativeSelectOption key={t.id} value={t.id}>
                  {t.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={isEdit ? "editProdCategory" : "addProdCategory"}>Kategori</Label>
          <NativeSelect
            id={isEdit ? "editProdCategory" : "addProdCategory"}
            value={formCategory}
            onChange={(e) => onFormCategoryChange(e.target.value)}
          >
            {categories.map((c) => (
              <NativeSelectOption key={c} value={c}>
                {c}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={isEdit ? "editProdPrice" : "addProdPrice"}>Harga jual (Rp)</Label>
          <Input
            id={isEdit ? "editProdPrice" : "addProdPrice"}
            type="number"
            required
            min={0}
            step={1000}
            value={formPrice}
            onChange={(e) => onFormPriceChange(Number(e.target.value))}
            className="font-mono tabular-nums"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={isEdit ? "editProdCogs" : "addProdCogs"}>Estimasi HPP (Rp)</Label>
          <Input
            id={isEdit ? "editProdCogs" : "addProdCogs"}
            type="number"
            min={0}
            step={500}
            value={formCogs}
            onChange={(e) => onFormCogsChange(Number(e.target.value))}
            className="font-mono tabular-nums"
          />
        </div>
      </div>

      {isEdit ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="editProdStatus">Status menu</Label>
          <NativeSelect
            id="editProdStatus"
            value={formStatus}
            onChange={(e) => onFormStatusChange(e.target.value as "ACTIVE" | "INACTIVE")}
          >
            <NativeSelectOption value="ACTIVE">Aktif (tampil di kasir)</NativeSelectOption>
            <NativeSelectOption value="INACTIVE">Nonaktif (disembunyikan)</NativeSelectOption>
          </NativeSelect>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={isEdit ? "editProdDesc" : "addProdDesc"}>Deskripsi singkat</Label>
        <textarea
          id={isEdit ? "editProdDesc" : "addProdDesc"}
          rows={2}
          value={formDesc}
          onChange={(e) => onFormDescChange(e.target.value)}
          placeholder="Keterangan singkat komposisi menu"
          className="w-full rounded-md border bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Foto menu</Label>
        {formImg ? (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={formImg}
              alt="Pratinjau foto menu"
              className="size-12 rounded-md border object-cover"
            />
            <div className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-xs font-medium text-success">
                <CheckCircle2 className="size-3.5" />
                <span>Gambar terpasang</span>
              </span>
              <p className="truncate text-xs text-muted-foreground">Siap disimpan</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onFormImgChange("")}
            >
              Hapus
            </Button>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 p-3 text-center transition-colors hover:bg-muted/60">
            <UploadCloud className="mb-1 size-5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">Unggah gambar menu</span>
            <span className="text-xs text-muted-foreground">Format JPG, PNG, atau WebP</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onImageFileUpload(e, onFormImgChange)}
            />
          </label>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Tambah Menu */}
      <Dialog open={isAddOpen} onOpenChange={onAddOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tambah menu</DialogTitle>
            <DialogDescription>Menu baru langsung disinkronkan ke kasir POS.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSaveNewProduct}>
            {renderFormFields(false)}
            <DialogFooter className="gap-2 pt-3">
              <Button type="button" variant="outline" size="lg" onClick={() => onAddOpenChange(false)}>
                Batal
              </Button>
              <Button type="submit" size="lg">Simpan menu</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Menu */}
      <Dialog open={isEditOpen} onOpenChange={onEditOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit menu</DialogTitle>
            <DialogDescription>Ubah harga, kategori, atau status ketersediaan menu.</DialogDescription>
          </DialogHeader>
          {editingProduct ? (
            <form onSubmit={onSaveEditProduct}>
              {renderFormFields(true)}
              <DialogFooter className="flex-wrap justify-between gap-2 pt-3">
                <Button
                  type="button"
                  variant="destructive"
                  size="lg"
                  onClick={() => onRequestDeleteFromEdit(editingProduct)}
                >
                  <Trash2 />
                  <span>Hapus</span>
                </Button>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="lg" onClick={() => onEditOpenChange(false)}>
                    Batal
                  </Button>
                  <Button type="submit" size="lg">Simpan perubahan</Button>
                </div>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Konfirmasi Hapus Menu */}
      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={onDeleteOpenChange}
        title="Hapus menu?"
        description={
          deletingProduct
            ? `Menu "${deletingProduct.name}" akan dihapus permanen dari daftar.`
            : "Menu akan dihapus dari daftar."
        }
        confirmLabel="Hapus"
        destructive
        onConfirm={onConfirmDeleteProduct}
      />

      {/* Tambah Kategori */}
      <Dialog open={isAddCategoryOpen} onOpenChange={onAddCategoryOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tambah kategori</DialogTitle>
            <DialogDescription>Kategori baru tersedia untuk pengelompokan menu.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSaveNewCategory} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newCategoryName">Nama kategori</Label>
              <Input
                id="newCategoryName"
                type="text"
                required
                value={newCategoryName}
                onChange={(e) => onNewCategoryNameChange(e.target.value)}
                placeholder="Contoh: Aneka jus"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" size="lg" onClick={() => onAddCategoryOpenChange(false)}>
                Batal
              </Button>
              <Button type="submit" size="lg">Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
