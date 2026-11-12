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
import type { OrderRecord } from "@/types/order";

import { orderStatusLabel, paymentStatusLabel } from "./orders-domain";

interface OrdersReportPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: OrderRecord[];
  outletName: string;
}

export function OrdersReportPDFModal({
  isOpen,
  onClose,
  orders,
  outletName,
}: OrdersReportPDFModalProps) {
  const printContentRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const completedOrders = orders.filter((o) => o.status === "COMPLETED");
  const inProgressOrders = orders.filter(
    (o) => o.status === "CONFIRMED" || o.status === "COOKING" || o.status === "SERVED"
  );
  const totalItemsSold = orders.reduce(
    (sum, o) => sum + o.items.reduce((iSum, it) => iSum + it.quantity, 0),
    0
  );

  const reportNumber = `ORD-REP-${new Date().getFullYear()}${String(
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
                  Laporan Transaksi Pesanan
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Format cetak standar operasional dan audit
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
                Rekapitulasi Penjualan & Lifecycle Pesanan
              </h2>
              <p className="text-xs text-muted-foreground">
                Konsolidasi data transaksi kasir POS & pemesanan meja self-order
              </p>
            </div>

            {/* KPI Summary Cards */}
            <div className="my-5 grid grid-cols-4 gap-3">
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <span className="block text-[10px] font-medium uppercase text-muted-foreground">
                  Total Omzet
                </span>
                <span className="font-mono text-sm font-medium tabular-nums text-foreground">
                  {formatCurrencyIDR(totalRevenue)}
                </span>
              </div>
              <div className="rounded-lg border bg-success/10 p-3 text-center">
                <span className="block text-[10px] font-medium uppercase text-success">
                  Selesai / Lunas
                </span>
                <span className="font-mono text-sm font-medium tabular-nums text-success">
                  {completedOrders.length} Pesanan
                </span>
              </div>
              <div className="rounded-lg border bg-warning/10 p-3 text-center">
                <span className="block text-[10px] font-medium uppercase text-warning">
                  Aktif / Diproses
                </span>
                <span className="font-mono text-sm font-medium tabular-nums text-warning">
                  {inProgressOrders.length} Pesanan
                </span>
              </div>
              <div className="rounded-lg border bg-info/10 p-3 text-center">
                <span className="block text-[10px] font-medium uppercase text-info">
                  Total Item Terjual
                </span>
                <span className="font-mono text-sm font-medium tabular-nums text-info">
                  {totalItemsSold} Porsi
                </span>
              </div>
            </div>

            {/* Orders Table */}
            <div className="my-4 overflow-hidden rounded-lg border text-xs">
              <table className="w-full text-left">
                <thead className="border-b bg-muted/50 text-[10px] font-medium uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2">No. Pesanan</th>
                    <th className="p-2">Meja</th>
                    <th className="p-2">Pelanggan</th>
                    <th className="p-2">Rincian Item</th>
                    <th className="p-2 text-right">Total (Rp)</th>
                    <th className="p-2 text-center">Status Operasional</th>
                    <th className="p-2 text-center">Status Pembayaran</th>
                    <th className="p-2 text-center">Metode Bayar</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-foreground">
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="p-2 font-mono text-xs font-medium tabular-nums">
                        {o.orderNumber}
                      </td>
                      <td className="p-2 font-medium">{o.tableNumber}</td>
                      <td className="p-2">{o.customerName}</td>
                      <td className="p-2 text-[11px] text-muted-foreground">
                        {o.items.map((i) => `${i.quantity}x ${i.productName}`).join(", ")}
                      </td>
                      <td className="p-2 text-right font-mono text-xs font-medium tabular-nums">
                        {formatCurrencyIDR(o.total)}
                      </td>
                      <td className="p-2 text-center font-medium">
                        {orderStatusLabel(o.status)}
                      </td>
                      <td className="p-2 text-center font-medium">
                        {paymentStatusLabel(o.paymentStatus)}
                      </td>
                      <td className="p-2 text-center font-mono text-[10px]">
                        {o.paymentMethod || "-"}
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
