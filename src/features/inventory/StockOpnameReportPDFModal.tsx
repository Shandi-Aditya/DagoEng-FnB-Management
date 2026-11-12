"use client";

import { useRef } from "react";
import Image from "next/image";
import { ClipboardCheck, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrencyIDR } from "@/lib/utils";
import type { StockOpnameRecord } from "@/types/inventory";

interface StockOpnameReportPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  opnames: StockOpnameRecord[];
  outletName: string;
}

export function StockOpnameReportPDFModal({
  isOpen,
  onClose,
  opnames,
  outletName,
}: StockOpnameReportPDFModalProps) {
  const printContentRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const surplusCount = opnames.filter((o) => o.varianceType === "SURPLUS").length;
  const deficitCount = opnames.filter((o) => o.varianceType === "DEFICIT").length;

  const totalVarianceValue = opnames.reduce((sum, o) => {
    return sum + (o.varianceValue ? Math.abs(o.varianceValue) : 0);
  }, 0);

  const reportDocNo = `BA-OPNAME-${new Date().getFullYear()}${String(
    new Date().getMonth() + 1
  ).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}-${Math.floor(
    100 + Math.random() * 900
  )}`;

  const handlePrint = () => {
    window.print();
  };

  const getReasonBadgeLabel = (reason: string) => {
    switch (reason) {
      case "RECORDING_ERROR":
        return "Selisih Hitung / Catat";
      case "WASTE":
        return "Waste Operasional";
      case "LOSS":
        return "Kehilangan (Loss)";
      case "DAMAGED":
        return "Kerusakan Fisik";
      case "EXPIRATION":
        return "Kedaluwarsa";
      case "SAMPLE_PROMO":
        return "Sample Promo";
      default:
        return "Lainnya";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b bg-muted/40 px-6 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ClipboardCheck className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-medium">
                  Berita Acara Resmi Stock Opname
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Dokumen fisik siap cetak dan ekspor PDF resmi operasional gudang
                </p>
              </div>
            </div>

            <Button size="sm" onClick={handlePrint} className="gap-1.5 text-xs">
              <Printer className="size-3.5" />
              <span>Cetak / Simpan PDF</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Printable Report Sheet */}
        <div className="max-h-[calc(92vh-75px)] overflow-y-auto bg-muted/30 p-4 sm:p-6">
          <div
            id="printable-stock-opname-report"
            ref={printContentRef}
            className="mx-auto max-w-3xl rounded-xl border bg-card p-8 text-foreground shadow-sm print:m-0 print:border-none print:p-0 print:shadow-none"
          >
            {/* Official Letterhead */}
            <div className="flex items-start justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="relative size-12 shrink-0">
                  <Image
                    src="/logo-dago.png"
                    alt="Dago Creative Hub"
                    width={48}
                    height={48}
                    className="object-contain"
                  />
                </div>
                <div>
                  <h1 className="text-base font-medium tracking-tight text-foreground">
                    DAGOENG CREATIVE HUB
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    Divisi Logistik, Pergudangan & Manajemen Inventori
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Jl. Ngurah Rai No. 45, Singaraja, Bali
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-block rounded border bg-muted/50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider">
                  BERITA ACARA AUDIT FISIK
                </span>
                <p className="mt-1 font-mono text-[11px] font-medium text-foreground">
                  No: {reportDocNo}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Tanggal:{" "}
                  {new Date().toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            {/* Document Metadata */}
            <div className="my-4 grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-xs sm:grid-cols-4">
              <div>
                <span className="block text-[10px] font-medium uppercase text-muted-foreground">
                  Outlet / Lokasi
                </span>
                <span className="font-medium text-foreground">{outletName}</span>
              </div>
              <div>
                <span className="block text-[10px] font-medium uppercase text-muted-foreground">
                  Total Item Diaudit
                </span>
                <span className="font-mono font-medium text-foreground">
                  {opnames.length} Bahan Baku
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-medium uppercase text-muted-foreground">
                  Status Selisih
                </span>
                <span className="font-medium text-foreground">
                  +{surplusCount} Surplus / -{deficitCount} Defisit
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-medium uppercase text-muted-foreground">
                  Nilai Selisih
                </span>
                <span className="font-mono font-medium tabular-nums text-destructive">
                  {formatCurrencyIDR(totalVarianceValue)}
                </span>
              </div>
            </div>

            {/* Detail Audit Table */}
            <div className="my-4 overflow-hidden rounded-lg border text-xs">
              <table className="w-full text-left">
                <thead className="border-b bg-muted/50 text-[10px] font-medium uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2">No. Opname</th>
                    <th className="p-2">Bahan Baku</th>
                    <th className="p-2 text-right">Stok Sistem</th>
                    <th className="p-2 text-right">Stok Fisik</th>
                    <th className="p-2 text-center">Selisih</th>
                    <th className="p-2">Kategori Alasan</th>
                    <th className="p-2">Catatan</th>
                    <th className="p-2 text-center">Auditor</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-foreground">
                  {opnames.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-xs text-muted-foreground">
                        Belum ada data audit stock opname untuk dicetak.
                      </td>
                    </tr>
                  ) : (
                    opnames.map((o) => (
                      <tr key={o.id}>
                        <td className="p-2 font-mono text-xs font-medium">{o.opnameNumber}</td>
                        <td className="p-2 font-medium">
                          <span>{o.ingredientName}</span>
                          <span className="block text-[10px] text-muted-foreground">
                            {o.category}
                          </span>
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums">
                          {o.systemStock} {o.unit}
                        </td>
                        <td className="p-2 text-right font-mono font-medium tabular-nums">
                          {o.physicalStock} {o.unit}
                        </td>
                        <td className="p-2 text-center font-mono text-[11px] tabular-nums font-medium">
                          {o.variance > 0 ? `+${o.variance}` : o.variance} {o.unit}
                        </td>
                        <td className="p-2 text-[11px]">{getReasonBadgeLabel(o.reason)}</td>
                        <td className="p-2 text-[10px] text-muted-foreground">
                          {o.reasonNotes || "-"}
                        </td>
                        <td className="p-2 text-center text-[11px]">{o.performedBy}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Statement of Integrity */}
            <div className="rounded-lg border bg-muted/20 p-3 text-[11px] leading-relaxed text-muted-foreground">
              <p>
                <strong className="text-foreground">Pernyataan Berita Acara:</strong> Seluruh data
                stok fisik di atas telah dihitung, diperiksa, dan diverifikasi langsung di gudang
                penyimpanan. Penyesuaian stok sistem telah disinkronkan sesuai hasil audit aktual.
              </p>
            </div>

            {/* Three-Column Official Signature Section */}
            <div className="grid grid-cols-3 gap-6 pt-6 text-center text-xs">
              <div className="space-y-12">
                <p className="font-medium text-foreground">Petugas Opname / Auditor</p>
                <div>
                  <div className="mx-auto mb-1 w-36 border-b" />
                  <p className="font-medium text-foreground">
                    {opnames[0]?.performedBy || "Staff Logistik"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Inventory Specialist</p>
                </div>
              </div>

              <div className="space-y-12">
                <p className="font-medium text-foreground">Supervisor Operasional</p>
                <div>
                  <div className="mx-auto mb-1 w-36 border-b" />
                  <p className="font-medium text-foreground">( ........................................ )</p>
                  <p className="text-[10px] text-muted-foreground">Operational Supervisor</p>
                </div>
              </div>

              <div className="space-y-12">
                <p className="font-medium text-foreground">Pimpinan Outlet / Owner</p>
                <div>
                  <div className="mx-auto mb-1 w-36 border-b" />
                  <p className="font-medium text-foreground">( ........................................ )</p>
                  <p className="text-[10px] text-muted-foreground">Store Manager</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
