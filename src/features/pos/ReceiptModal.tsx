"use client";

import React from "react";
import Image from "next/image";
import { POSReceiptData } from "./types";
import { formatCurrencyIDR } from "@/lib/utils";
import { X, Printer, Share2, CheckCircle2, RotateCcw, Store, MessageSquare, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DEFAULT_FNB_TENANTS, getAllStoredTenantSettings, getTenantName } from "@/lib/tenant";
import { MASTER_HQ_OUTLET } from "@/lib/receipt-publisher";
import { getOrCreateSimulatedWifiVoucher, getSimulatedWifiCalcBasis } from "@/lib/wifi";
import { isAddonActive } from "@/lib/subscription";
import { usePrinter } from "@/contexts/PrinterContext";

interface ReceiptModalProps {
  isOpen?: boolean;
  receiptData?: POSReceiptData | null;
  order?: POSReceiptData | null;
  onClose: () => void;
  onNewTransaction?: () => void;
  onViewKitchenTicket?: () => void;
}

export function ReceiptModal({
  isOpen = true,
  receiptData: rawReceiptData,
  order,
  onClose,
  onNewTransaction,
  onViewKitchenTicket,
}: ReceiptModalProps) {
  const receiptData = rawReceiptData || order;
  const { printCustomerReceipt } = usePrinter();
  if (!isOpen || !receiptData) return null;

  const handlePrint = async () => {
    try {
      await printCustomerReceipt(receiptData, { isManualReprint: true });
    } catch {
      window.print();
    }
  };

  // Distinct tenant identification
  const tenantIdsInItems = Array.from(
    new Set(
      (receiptData.items || [])
        .map((i) => i.tenantId || (i.tenantName ? DEFAULT_FNB_TENANTS.find((t) => t.name.toLowerCase() === i.tenantName?.toLowerCase())?.id : undefined))
        .filter(Boolean)
    )
  );

  const isMultiTenant = tenantIdsInItems.length > 1;

  // Resolve tenant for single-mitra branding
  const primaryTenantId =
    receiptData.tenantId ||
    receiptData.items?.find((i) => i.tenantId)?.tenantId ||
    (receiptData.items?.find((i) => i.tenantName)
      ? DEFAULT_FNB_TENANTS.find((t) => t.name.toLowerCase() === receiptData.items[0]?.tenantName?.toLowerCase())?.id
      : undefined) ||
    "tenant-ks";

  const allStoredSettings = typeof window !== "undefined" ? getAllStoredTenantSettings() : {};
  const storedTenantSettings = allStoredSettings[primaryTenantId];
  const defaultTenantInfo = DEFAULT_FNB_TENANTS.find((t) => t.id === primaryTenantId) || DEFAULT_FNB_TENANTS[0];

  const brandName = isMultiTenant
    ? "DAGO CREATIVE HUB"
    : (
        receiptData.receiptHeader ||
        storedTenantSettings?.receiptHeader ||
        storedTenantSettings?.brandName ||
        receiptData.tenantName ||
        defaultTenantInfo.name
      );

  const tagline = isMultiTenant
    ? "Ringkasan Pesanan Multi-Mitra"
    : (storedTenantSettings?.tagline || defaultTenantInfo.tagline || defaultTenantInfo.badge);

  const contactPhone = isMultiTenant
    ? receiptData.outletPhone || "(0362) 23456"
    : (storedTenantSettings?.contactPhone || receiptData.outletPhone);

  const footerMessage =
    receiptData.receiptFooter ||
    (!isMultiTenant ? storedTenantSettings?.receiptFooter : undefined) ||
    "Terima Kasih Atas Kunjungan Anda!";

  // Group items by tenant for clear per-mitra auditing
  const groupedItems = React.useMemo(() => {
    const map = new Map<string, { tenantName: string; items: typeof receiptData.items; subtotal: number }>();
    (receiptData.items || []).forEach((item) => {
      const tId = item.tenantId || "tenant-ks";
      const tName = item.tenantName || getTenantName(tId) || "Mitra Kuliner";
      const existing = map.get(tId) || { tenantName: tName, items: [], subtotal: 0 };
      existing.items.push(item);
      existing.subtotal += item.subtotal;
      map.set(tId, existing);
    });
    return Array.from(map.entries()).map(([tenantId, data]) => ({ tenantId, ...data }));
  }, [receiptData.items]);

  // Ambil atau buat voucher Wi-Fi resmi untuk transaksi ini jika memenuhi batas nominal aturan sistem
  const simulatedWifiVoucher = React.useMemo(() => {
    if (!receiptData.orderNumber) return null;
    const calcBasis = getSimulatedWifiCalcBasis();
    const evaluatedAmount = calcBasis === "NET_SALES" ? (receiptData.subtotal || 0) : (receiptData.grandTotal || 0);

    return getOrCreateSimulatedWifiVoucher(
      receiptData.orderNumber,
      receiptData.customerName,
      evaluatedAmount,
      receiptData.outletName,
      primaryTenantId,
      brandName
    );
  }, [receiptData.orderNumber, receiptData.customerName, receiptData.subtotal, receiptData.grandTotal, receiptData.outletName, primaryTenantId, brandName]);

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          html,
          body {
            background: #ffffff !important;
            height: auto !important;
            overflow: visible !important;
          }
          body * {
            visibility: hidden !important;
          }
          #thermal-receipt,
          #thermal-receipt * {
            visibility: visible !important;
          }
          #thermal-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 auto !important;
            padding: 8px !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md gap-0 p-0 overflow-hidden flex flex-col max-h-[90vh]">
          {/* Modal Top Bar */}
          <DialogHeader className="px-5 py-3 border-b border-border flex flex-row items-center justify-between bg-muted/40 print:hidden">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-primary" />
              <DialogTitle className="text-xs font-medium text-foreground">
                Transaksi berhasil dan tercatat
              </DialogTitle>
              <DialogDescription className="sr-only">
                Struk transaksi kasir POS
              </DialogDescription>
            </div>
          </DialogHeader>

          {/* Scrollable Receipt Preview (Formatted as 58mm/80mm Thermal Receipt) */}
          <div className="p-6 overflow-y-auto flex-1 bg-slate-100/60 dark:bg-slate-950 flex justify-center">
            <div
              id="thermal-receipt"
              className="w-full max-w-[340px] bg-white p-5 rounded-lg shadow-sm border border-slate-200 font-mono text-slate-900 text-xs space-y-4 print:w-full print:shadow-none print:border-none"
            >
              {/* Store Header (Neutral Platform Header for Multi-Mitra vs Tenant Identity for Single-Mitra) */}
              <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-3">
                <h2 className="font-black text-sm tracking-wider uppercase text-slate-900">
                  {brandName}
                </h2>
                {tagline && (
                  <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                    {tagline}
                  </p>
                )}
                <p className="text-[10px] text-slate-500 leading-tight">
                  {receiptData.outletAddress || MASTER_HQ_OUTLET.address}
                </p>
                {contactPhone && <p className="text-[10px] text-slate-500">Telp: {contactPhone}</p>}
              </div>

              {/* Meta Order Info */}
              <div className="text-[11px] space-y-1 border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between">
                  <span>No. Struk:</span>
                  <span className="font-bold">{receiptData.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tanggal:</span>
                  <span>{receiptData.date}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kasir:</span>
                  <span>{receiptData.cashierName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Meja / Tipe:</span>
                  <span className="font-bold">
                    {receiptData.orderType === "DINE_IN"
                      ? `Meja ${receiptData.tableNumber}`
                      : "Takeaway"}
                  </span>
                </div>
                {receiptData.customerName && (
                  <div className="flex justify-between">
                    <span>Pelanggan:</span>
                    <span>{receiptData.customerName}</span>
                  </div>
                )}
              </div>

              {/* Items List - Grouped by Mitra if Multi-Tenant */}
              <div className="space-y-2 border-b border-dashed border-slate-300 pb-3">
                {isMultiTenant ? (
                  groupedItems.map((group) => (
                    <div
                      key={group.tenantId}
                      className="space-y-1.5 pt-2 first:pt-0 border-t first:border-t-0 border-dashed border-slate-200"
                    >
                      <div className="flex items-center justify-between bg-slate-50 px-2 py-1 rounded text-[10px] font-bold text-slate-800 border border-slate-100">
                        <span>Mitra: {group.tenantName}</span>
                        <span className="font-mono text-slate-500">{group.items.length} item</span>
                      </div>
                      {group.items.map((item, idx) => (
                        <div key={idx} className="space-y-0.5 text-xs pl-1">
                          <div className="flex justify-between font-semibold">
                            <span>
                              {item.name} x{item.quantity}
                            </span>
                            <span>{formatCurrencyIDR(item.subtotal)}</span>
                          </div>
                          {item.variantName && (
                            <p className="text-[10px] text-slate-500 pl-2">• {item.variantName}</p>
                          )}
                          {item.modifiers && item.modifiers.length > 0 && (
                            <p className="text-[10px] text-slate-500 pl-2">
                              • {item.modifiers.join(", ")}
                            </p>
                          )}
                          {item.notes && (
                            <p className="text-[10px] italic text-slate-400 pl-2">
                              *Catatan: {item.notes}
                            </p>
                          )}
                        </div>
                      ))}
                      <div className="flex justify-between text-[11px] font-bold text-slate-700 pt-1 border-t border-dotted border-slate-200 pl-1">
                        <span>Subtotal ({group.tenantName}):</span>
                        <span>{formatCurrencyIDR(group.subtotal)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  receiptData.items.map((item, idx) => (
                    <div key={idx} className="space-y-0.5 text-xs">
                      <div className="flex justify-between font-semibold">
                        <span>
                          {item.name} x{item.quantity}
                        </span>
                        <span>{formatCurrencyIDR(item.subtotal)}</span>
                      </div>
                      {item.variantName && (
                        <p className="text-[10px] text-slate-500 pl-2">• {item.variantName}</p>
                      )}
                      {item.modifiers && item.modifiers.length > 0 && (
                        <p className="text-[10px] text-slate-500 pl-2">
                          • {item.modifiers.join(", ")}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-[10px] italic text-slate-400 pl-2">
                          *Catatan: {item.notes}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Calculations Breakdown */}
              <div className="space-y-1 text-xs border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrencyIDR(receiptData.subtotal)}</span>
                </div>
                {receiptData.loyaltyMember && (
                  <div className="p-1.5 bg-primary/10 rounded border border-primary/20 text-[10px] space-y-0.5 my-1">
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>Loyalty Member: {receiptData.loyaltyMember.name}</span>
                      <span className="text-primary font-bold">Tier {receiptData.loyaltyMember.tier}</span>
                    </div>
                    {receiptData.loyaltyMember.voucherTitle && (
                      <p className="text-primary font-medium">
                        • {receiptData.loyaltyMember.voucherTitle} (-{receiptData.loyaltyMember.pointsUsed} Pts)
                      </p>
                    )}
                    <p className="text-slate-500">
                      Sisa Poin: <strong>{receiptData.loyaltyMember.pointsRemaining} Pts</strong>
                    </p>
                  </div>
                )}
                {receiptData.discount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Diskon {receiptData.promoName ? `(${receiptData.promoName})` : "Promo / Voucher"}:</span>
                    <span>-{formatCurrencyIDR(receiptData.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Pajak Restoran:</span>
                  <span>{receiptData.tax > 0 ? formatCurrencyIDR(receiptData.tax) : "Rp 0 (Non-Aktif)"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Service Charge (5%):</span>
                  <span>{formatCurrencyIDR(receiptData.serviceCharge)}</span>
                </div>
                <div className="flex justify-between font-black text-sm pt-1 border-t border-slate-200">
                  <span>TOTAL:</span>
                  <span>{formatCurrencyIDR(receiptData.grandTotal)}</span>
                </div>
              </div>

              {/* Payment & Change Breakdown */}
              <div className="space-y-1 text-xs border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between">
                  <span>Metode Bayar:</span>
                  <span className="font-bold">{receiptData.paymentMethod}</span>
                </div>
                {receiptData.qrisVerification && (
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>
                      {receiptData.qrisVerification.type === "SUPERVISOR_MANUAL"
                        ? "Otorisasi Manual QRIS:"
                        : "Ref Gateway QRIS:"}
                    </span>
                    <span className="font-mono font-semibold">{receiptData.qrisVerification.referenceNumber}</span>
                  </div>
                )}
                {receiptData.splitDetails && receiptData.splitDetails.length > 0 && (
                  <div className="p-1.5 bg-slate-50 rounded border border-slate-200 text-[10px] space-y-0.5 my-1">
                    <span className="font-bold text-slate-700 block">Rincian Split Payment:</span>
                    {receiptData.splitDetails.map((g, idx) => (
                      <div key={g.id || idx} className="flex justify-between text-slate-600">
                        <span>• {g.guestLabel} ({g.paymentMethod}):</span>
                        <span className="font-semibold">{formatCurrencyIDR(g.assignedAmount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Total Dibayar:</span>
                  <span>{formatCurrencyIDR(receiptData.amountPaid)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Kembalian:</span>
                  <span>{formatCurrencyIDR(receiptData.changeDue)}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>Status Pembayaran:</span>
                  <span>LUNAS (PAID)</span>
                </div>
              </div>

              {/* Receipt Footer */}
              <div className="text-center text-[10px] text-slate-500 space-y-2 pt-2 border-t border-dashed border-slate-300">
                {/* Blok Voucher Wi-Fi Tamu (Hanya Tampil Jika Memenuhi Batas Nominal Transaksi) */}
                {simulatedWifiVoucher && (
                  <div className="my-2 p-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 text-center space-y-1">
                    <div className="flex items-center justify-center space-x-1">
                      <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
                        Kode Akses Wi-Fi Tamu
                      </span>
                      <span className="text-[8px] bg-primary/20 text-primary border border-primary/30 px-1 py-0.5 rounded font-bold uppercase">
                        AKTIF
                      </span>
                    </div>
                    <p className="font-mono text-sm font-black text-primary tracking-wider">
                      {simulatedWifiVoucher.voucherCode}
                    </p>
                    <div className="flex justify-between text-[9px] text-slate-600 px-1">
                      <span>Durasi: <strong>{simulatedWifiVoucher.durationFormatted}</strong></span>
                      <span>SSID: <strong>DagoEng-Guest</strong></span>
                    </div>
                    <p className="text-[8px] text-slate-400 italic">
                      *Kode akses resmi terikat struk #{receiptData.orderNumber}
                    </p>
                  </div>
                )}

                <p className="font-bold text-slate-800">{footerMessage}</p>
                <div className="pt-2 border-t border-dashed border-slate-200 flex flex-col items-center justify-center space-y-1 text-slate-400">
                  <span className="text-[10px] font-semibold tracking-wider">Powered by</span>
                  <div className="w-6 h-8 relative opacity-85">
                    <Image
                      src="/logo-dago.png"
                      alt="DAGO"
                      width={18}
                      height={32}
                      className="object-contain mx-auto"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="p-4 border-t border-border bg-card flex flex-wrap items-center justify-between gap-2 print:hidden">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handlePrint}
              className="flex-1 min-w-[130px]"
            >
              <Printer className="size-4" />
              <span>Cetak Thermal</span>
            </Button>

            {onViewKitchenTicket && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={onViewKitchenTicket}
                className="flex-1 min-w-[130px]"
                title="Buka Pratinjau & Cetak Nota Pesanan Dapur"
              >
                <UtensilsCrossed className="size-4" />
                <span>Nota Dapur</span>
              </Button>
            )}

            {isAddonActive("WHATSAPP_AUTO_DISPATCH") && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => {
                  const phone = receiptData.customerPhone ? receiptData.customerPhone.replace(/[^0-9]/g, "") : "";
                  const text = encodeURIComponent(
                    `*STRUK PEMBAYARAN ${brandName.toUpperCase()}*\n` +
                    `No: #${receiptData.orderNumber}\n` +
                    `Pelanggan: ${receiptData.customerName || "Tamu"}\n` +
                    `Total: ${formatCurrencyIDR(receiptData.grandTotal)}\n` +
                    `Metode: ${receiptData.paymentMethod}\n` +
                    (simulatedWifiVoucher ? `Kode Wi-Fi: ${simulatedWifiVoucher.voucherCode} (${simulatedWifiVoucher.durationFormatted})\n` : "") +
                    `\nTerima kasih telah berkunjung!`
                  );
                  window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
                }}
                className="flex-1 min-w-[130px]"
                title="Kirim e-Receipt via WhatsApp (Add-on Aktif)"
              >
                <MessageSquare className="size-4" />
                <span>Kirim WA</span>
              </Button>
            )}

            {onNewTransaction ? (
              <Button
                type="button"
                size="lg"
                onClick={onNewTransaction}
                className="flex-1 min-w-[130px]"
              >
                <RotateCcw className="size-4" />
                <span>Pesanan baru</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={onClose}
                className="flex-1 min-w-[130px]"
              >
                <span>Tutup</span>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
