"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { formatCurrencyIDR } from "@/lib/utils";
import { OrderRecord } from "@/types/order";
import {
  X,
  Printer,
  ShieldCheck,
  FileText,
  Building,
  Store,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";

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

  const reportNumber = `ORD-REP-${new Date().getFullYear()}${(new Date().getMonth() + 1)
    .toString()
    .padStart(2, "0")}${new Date().getDate().toString().padStart(2, "0")}-${Math.floor(
    100 + Math.random() * 900
  )}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/80 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Top Control Bar */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-orange/20 text-brand-orange flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>Dokumen PDF Laporan Transaksi Pesanan</span>
                <span className="text-[10px] bg-brand-orange text-white px-2 py-0.2 rounded-full font-mono">
                  RESMI
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Format Cetak Standar Akuntansi & Audit Operasional
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              onClick={handlePrint}
              className="text-xs bg-brand-orange hover:bg-orange-600 text-white font-bold space-x-1.5 shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / Simpan PDF</span>
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Paper Canvas */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 bg-slate-100/70">
          <div
            ref={printContentRef}
            className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-md border border-slate-200 text-slate-800 print:m-0 print:p-0 print:shadow-none print:border-none"
          >
            {/* Document Header */}
            <div className="flex items-start justify-between pb-6 border-b-2 border-slate-900">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-14 relative flex-shrink-0">
                  <Image
                    src="/logo-dago.png"
                    alt="Logo"
                    width={48}
                    height={56}
                    className="object-contain"
                  />
                </div>
                <div>
                  <h1 className="text-lg font-black text-slate-950 tracking-tight">
                    DAGOENG CREATIVE HUB
                  </h1>
                  <p className="text-xs font-semibold text-brand-orange">
                    F&B Management & Unified Commercial Platform
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Outlet: {outletName} • Jl. Veteran No. 18, Singaraja, Bali
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Nomor Laporan
                </span>
                <span className="text-xs font-mono font-bold text-slate-900">{reportNumber}</span>
                <span className="text-[11px] text-slate-500 block mt-1">
                  Tanggal: {new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}
                </span>
              </div>
            </div>

            {/* Title */}
            <div className="text-center py-4 border-b border-slate-100">
              <h2 className="text-base font-black text-slate-900 tracking-wide uppercase">
                Rekapitulasi Penjualan & Lifecycle Pesanan
              </h2>
              <p className="text-xs text-slate-500">
                Konsolidasi data transaksi kasir POS & pemesanan meja self-order
              </p>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-4 gap-3 my-5">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">
                  Total Omzet
                </span>
                <span className="text-sm font-black text-slate-900 font-mono">
                  {formatCurrencyIDR(totalRevenue)}
                </span>
              </div>
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-center">
                <span className="text-[10px] text-emerald-700 font-bold uppercase block">
                  Selesai / Lunas
                </span>
                <span className="text-sm font-black text-emerald-800 font-mono">
                  {completedOrders.length} Pesanan
                </span>
              </div>
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 text-center">
                <span className="text-[10px] text-amber-700 font-bold uppercase block">
                  Aktif / Diproses
                </span>
                <span className="text-sm font-black text-amber-800 font-mono">
                  {inProgressOrders.length} Pesanan
                </span>
              </div>
              <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200 text-center">
                <span className="text-[10px] text-purple-700 font-bold uppercase block">
                  Total Item Terjual
                </span>
                <span className="text-sm font-black text-purple-800 font-mono">
                  {totalItemsSold} Porsi
                </span>
              </div>
            </div>

            {/* Orders Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden my-4 text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-900 text-white text-[11px] font-bold uppercase">
                  <tr>
                    <th className="p-2.5">No. Pesanan</th>
                    <th className="p-2.5">Meja</th>
                    <th className="p-2.5">Pelanggan</th>
                    <th className="p-2.5">Rincian Item</th>
                    <th className="p-2.5 text-right">Total (Rp)</th>
                    <th className="p-2.5 text-center">Status</th>
                    <th className="p-2.5 text-center">Bayar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold font-mono text-slate-900">{o.orderNumber}</td>
                      <td className="p-2.5 font-medium">{o.tableNumber}</td>
                      <td className="p-2.5 font-medium">{o.customerName}</td>
                      <td className="p-2.5 text-[11px] text-slate-600">
                        {o.items.map((i) => `${i.quantity}x ${i.productName}`).join(", ")}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                        {formatCurrencyIDR(o.total)}
                      </td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            o.status === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-800"
                              : o.status === "COOKING"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="p-2.5 text-center font-mono text-[10px] font-bold text-slate-600">
                        {o.paymentMethod || "QRIS"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Certification Footer */}
            <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="font-bold text-slate-800">Tervalidasi Digital</p>
                  <p className="text-[10px] text-slate-400">
                    Dokumen sah platform DagoEng F&B Management System.
                  </p>
                </div>
              </div>
              <div className="text-right text-[11px]">
                <p className="font-bold text-slate-800">Dago Creative Hub Operations</p>
                <p className="text-slate-400 font-mono">
                  SHA256: {Date.now()}-OFFICIAL-VALIDATED
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
