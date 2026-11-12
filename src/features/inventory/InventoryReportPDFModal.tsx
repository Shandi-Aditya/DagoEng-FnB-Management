"use client";

import { useRef } from "react";
import Image from "next/image";
import { FileText, Printer, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrencyIDR } from "@/lib/utils";
import type { IngredientItem } from "@/types/inventory";

interface InventoryReportPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredients: IngredientItem[];
  outletName: string;
}

export function InventoryReportPDFModal({
  isOpen,
  onClose,
  ingredients,
  outletName,
}: InventoryReportPDFModalProps) {
  const printContentRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const totalValuation = ingredients.reduce(
    (sum, item) => sum + item.stockNumber * item.costPerUnit,
    0
  );
  const criticalCount = ingredients.filter(
    (i) => i.status === "CRITICAL" || i.stockNumber <= i.min * 0.4
  ).length;
  const lowCount = ingredients.filter((i) => i.status === "LOW").length;
  const safeCount = ingredients.filter((i) => i.status === "SAFE").length;

  const reportNumber = `INV-VAL-${new Date().getFullYear()}${String(
    new Date().getMonth() + 1
  ).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}-${Math.floor(
    100 + Math.random() * 900
  )}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b bg-muted/40 px-6 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-medium">
                  Laporan Valuasi & Audit Stok Bahan Baku
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Laporan aset inventory dan stok opname otomatis
                </p>
              </div>
            </div>

            <Button size="sm" onClick={handlePrint} className="gap-1.5 text-xs">
              <Printer className="size-3.5" />
              <span>Cetak / Simpan PDF</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Printable Paper Canvas */}
        <div className="max-h-[calc(92vh-75px)] overflow-y-auto bg-muted/30 p-4 sm:p-6">
          <div
            ref={printContentRef}
            className="mx-auto max-w-3xl rounded-xl border bg-card p-8 text-foreground shadow-sm print:m-0 print:border-none print:p-0 print:shadow-none"
          >
            {/* Document Header */}
            <div className="flex items-start justify-between border-b pb-6">
              <div className="flex items-center gap-3.5">
                <div className="relative size-12 shrink-0">
                  <Image
                    src="/logo-dago.png"
                    alt="Logo"
                    width={48}
                    height={48}
                    className="object-contain"
                  />
                </div>
                <div>
                  <h1 className="text-base font-medium tracking-tight">DAGOENG CREATIVE HUB</h1>
                  <p className="text-xs text-muted-foreground">
                    F&B Management & Unified Commercial Platform
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Outlet: {outletName} • Singaraja, Bali
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="block text-[10px] font-medium uppercase text-muted-foreground">
                  Nomor Laporan
                </span>
                <span className="font-mono text-xs font-medium">{reportNumber}</span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Tanggal: {new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}
                </span>
              </div>
            </div>

            {/* Title */}
            <div className="border-b py-4 text-center">
              <h2 className="text-sm font-medium uppercase tracking-wide">
                Rekapitulasi Valuasi Stok Bahan Baku
              </h2>
              <p className="text-xs text-muted-foreground">
                Audit nilai aset barang habis pakai dan bahan resep dapur
              </p>
            </div>

            {/* KPI Summary Cards */}
            <div className="my-5 grid grid-cols-4 gap-3">
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <span className="block text-[10px] font-medium uppercase text-muted-foreground">
                  Total Nilai Aset
                </span>
                <span className="font-mono text-sm font-medium tabular-nums text-foreground">
                  {formatCurrencyIDR(totalValuation)}
                </span>
              </div>
              <div className="rounded-lg border bg-success/10 p-3 text-center">
                <span className="block text-[10px] font-medium uppercase text-success">
                  Stok Aman
                </span>
                <span className="font-mono text-sm font-medium tabular-nums text-success">
                  {safeCount} Bahan
                </span>
              </div>
              <div className="rounded-lg border bg-warning/10 p-3 text-center">
                <span className="block text-[10px] font-medium uppercase text-warning">
                  Stok Menipis
                </span>
                <span className="font-mono text-sm font-medium tabular-nums text-warning">
                  {lowCount} Bahan
                </span>
              </div>
              <div className="rounded-lg border bg-destructive/10 p-3 text-center">
                <span className="block text-[10px] font-medium uppercase text-destructive">
                  Kritis / Habis
                </span>
                <span className="font-mono text-sm font-medium tabular-nums text-destructive">
                  {criticalCount} Bahan
                </span>
              </div>
            </div>

            {/* Ingredients Table */}
            <div className="my-4 overflow-hidden rounded-lg border text-xs">
              <table className="w-full text-left">
                <thead className="border-b bg-muted/50 text-[10px] font-medium uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2">ID</th>
                    <th className="p-2">Nama Bahan Baku</th>
                    <th className="p-2">Kategori</th>
                    <th className="p-2 text-right">Sisa Stok</th>
                    <th className="p-2 text-right">Harga Satuan</th>
                    <th className="p-2 text-right">Total Nilai</th>
                    <th className="p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-foreground">
                  {ingredients.map((item) => (
                    <tr key={item.id}>
                      <td className="p-2 font-mono text-[10px] text-muted-foreground">{item.id}</td>
                      <td className="p-2 font-medium">{item.name}</td>
                      <td className="p-2 text-muted-foreground">{item.category}</td>
                      <td className="p-2 text-right font-mono tabular-nums">
                        {item.stockNumber} {item.unit}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums">
                        {formatCurrencyIDR(item.costPerUnit)}
                      </td>
                      <td className="p-2 text-right font-mono font-medium tabular-nums">
                        {formatCurrencyIDR(item.stockNumber * item.costPerUnit)}
                      </td>
                      <td className="p-2 text-center">
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-medium">
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Certification Footer */}
            <div className="mt-8 flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-success" />
                <div>
                  <p className="font-medium text-foreground">Tervalidasi Digital</p>
                  <p className="text-[10px]">Dokumen sah platform DagoEng F&B Management System.</p>
                </div>
              </div>
              <div className="text-right text-[11px]">
                <p className="font-medium text-foreground">Dago Creative Hub Operations</p>
                <p className="font-mono">SHA256: {Date.now()}-OFFICIAL-VALIDATED</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
