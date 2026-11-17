"use client";

import React from "react";
import Image from "next/image";
import { CheckCircle2, MessageSquare, Printer, RotateCcw, UtensilsCrossed } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  calculateTenantReceiptGroups,
  formatReceiptLoyaltyPoints,
  formatReceiptOrderType,
  formatReceiptPaymentStatus,
  formatReceiptServiceChargeLabel,
} from "@/features/pos/pos-receipt";
import type { POSReceiptData } from "@/features/pos/types";
import { usePrinter } from "@/contexts/PrinterContext";
import { MASTER_HQ_OUTLET } from "@/lib/receipt-publisher";
import { isAddonActive } from "@/lib/subscription";
import { DEFAULT_FNB_TENANTS, getAllStoredTenantSettings } from "@/lib/tenant";
import { formatCurrencyIDR } from "@/lib/utils";
import { getOrCreateSimulatedWifiVoucher, getSimulatedWifiCalcBasis } from "@/lib/wifi";

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

  const tenantIdsInItems = Array.from(
    new Set(
      (receiptData.items || [])
        .map((i) => i.tenantId || (i.tenantName ? DEFAULT_FNB_TENANTS.find((t) => t.name.toLowerCase() === i.tenantName?.toLowerCase())?.id : undefined))
        .filter(Boolean)
    )
  );

  const isMultiTenant = tenantIdsInItems.length > 1;

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
    ? "Dago Creative Hub"
    : (
        receiptData.receiptHeader ||
        storedTenantSettings?.receiptHeader ||
        storedTenantSettings?.brandName ||
        receiptData.tenantName ||
        defaultTenantInfo.name
      );

  const tagline = isMultiTenant
    ? "Ringkasan pesanan multi-mitra"
    : (storedTenantSettings?.tagline || defaultTenantInfo.tagline || defaultTenantInfo.badge);

  const contactPhone = isMultiTenant
    ? receiptData.outletPhone || MASTER_HQ_OUTLET.phone || "+62 821-1550-1995"
    : (storedTenantSettings?.contactPhone || receiptData.outletPhone);

  const footerMessage =
    receiptData.receiptFooter ||
    (!isMultiTenant ? storedTenantSettings?.receiptFooter : undefined) ||
    "Terima kasih atas kunjungan Anda";

  const groupedItems = calculateTenantReceiptGroups(receiptData.items);

  const simulatedWifiVoucher = (() => {
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
  })();

  const serviceChargeLabel = formatReceiptServiceChargeLabel(
    (receiptData as { serviceChargePercent?: number }).serviceChargePercent
  );

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

          {/* Scrollable Receipt Preview (Formatted as 80mm Thermal Receipt) */}
          <div className="p-4 sm:p-5 overflow-y-auto overflow-x-hidden flex-1 bg-muted/30 flex justify-center">
            <div
              id="thermal-receipt"
              className="w-full max-w-[340px] bg-card p-5 rounded-lg shadow-xs border border-border font-mono text-card-foreground text-xs space-y-3 mb-2 break-words overflow-hidden print:w-full print:shadow-none print:border-none print:bg-white print:text-black"
            >
              {/* Store Header */}
              <div className="text-center space-y-1 border-b border-dashed border-border pb-3">
                <h2 className="font-semibold text-sm text-foreground">
                  {brandName}
                </h2>
                {tagline && (
                  <p className="text-xs text-muted-foreground">
                    {tagline}
                  </p>
                )}
                <p className="text-xs text-muted-foreground leading-tight">
                  {receiptData.outletAddress || MASTER_HQ_OUTLET.address}
                </p>
                {contactPhone && <p className="text-xs text-muted-foreground">Telp: {contactPhone}</p>}
              </div>

              {/* Meta Order Info */}
              <div className="space-y-1 border-b border-dashed border-border pb-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">No. struk:</span>
                  <span className="font-medium text-foreground">{receiptData.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tanggal:</span>
                  <span className="text-foreground">{receiptData.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kasir:</span>
                  <span className="text-foreground">{receiptData.cashierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Meja / tipe:</span>
                  <span className="font-medium text-foreground">
                    {receiptData.orderType === "DINE_IN"
                      ? `Meja ${receiptData.tableNumber}`
                      : formatReceiptOrderType(receiptData.orderType)}
                  </span>
                </div>
                {receiptData.customerName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pelanggan:</span>
                    <span className="text-foreground">{receiptData.customerName}</span>
                  </div>
                )}
              </div>

              {/* Items List - Grouped by Mitra if Multi-Tenant */}
              <div className="space-y-2 border-b border-dashed border-border pb-3">
                {isMultiTenant ? (
                  groupedItems.map((group) => (
                    <div
                      key={group.tenantId}
                      className="space-y-1.5 pt-2 first:pt-0 border-t first:border-t-0 border-dashed border-border"
                    >
                      <div className="flex items-center justify-between bg-muted/50 px-2 py-1 rounded text-xs font-medium text-foreground border border-border">
                        <span>Mitra: {group.tenantName}</span>
                        <span className="font-mono text-muted-foreground tabular-nums">{group.items.length} item</span>
                      </div>
                      {group.items.map((item, idx) => (
                        <div key={idx} className="space-y-0.5 text-xs pl-1">
                          <div className="flex justify-between font-medium">
                            <span className="text-foreground">
                              {item.name} x{item.quantity}
                            </span>
                            <span className="font-mono tabular-nums text-foreground">{formatCurrencyIDR(item.subtotal)}</span>
                          </div>
                          {item.variantName && (
                            <p className="text-xs text-muted-foreground pl-2">• {item.variantName}</p>
                          )}
                          {item.modifiers && item.modifiers.length > 0 && (
                            <p className="text-xs text-muted-foreground pl-2">
                              • {item.modifiers.join(", ")}
                            </p>
                          )}
                          {item.notes && (
                            <p className="text-xs italic text-muted-foreground pl-2">
                              *Catatan: {item.notes}
                            </p>
                          )}
                        </div>
                      ))}
                      <div className="flex justify-between text-xs font-medium text-foreground pt-1 border-t border-dotted border-border pl-1">
                        <span className="text-muted-foreground">Subtotal ({group.tenantName}):</span>
                        <span className="font-mono tabular-nums">{formatCurrencyIDR(group.subtotal)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  receiptData.items.map((item, idx) => (
                    <div key={idx} className="space-y-0.5 text-xs">
                      <div className="flex justify-between font-medium">
                        <span className="text-foreground">
                          {item.name} x{item.quantity}
                        </span>
                        <span className="font-mono tabular-nums text-foreground">{formatCurrencyIDR(item.subtotal)}</span>
                      </div>
                      {item.variantName && (
                        <p className="text-xs text-muted-foreground pl-2">• {item.variantName}</p>
                      )}
                      {item.modifiers && item.modifiers.length > 0 && (
                        <p className="text-xs text-muted-foreground pl-2">
                          • {item.modifiers.join(", ")}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-xs italic text-muted-foreground pl-2">
                          *Catatan: {item.notes}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Calculations Breakdown */}
              <div className="space-y-1 text-xs border-b border-dashed border-border pb-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-mono tabular-nums text-foreground">{formatCurrencyIDR(receiptData.subtotal)}</span>
                </div>
                {receiptData.loyaltyMember && (
                  <div className="p-1.5 bg-muted/40 rounded border border-border text-xs space-y-0.5 my-1">
                    <div className="flex justify-between font-medium text-foreground">
                      <span>Member: {receiptData.loyaltyMember.name}</span>
                      <span className="text-primary font-medium">Tier {receiptData.loyaltyMember.tier}</span>
                    </div>
                    {receiptData.loyaltyMember.voucherTitle && (
                      <p className="text-primary text-xs">
                        • {receiptData.loyaltyMember.voucherTitle} (-{formatReceiptLoyaltyPoints(receiptData.loyaltyMember.pointsUsed)})
                      </p>
                    )}
                    <p className="text-muted-foreground text-xs">
                      Sisa poin: <span className="font-mono tabular-nums text-foreground">{formatReceiptLoyaltyPoints(receiptData.loyaltyMember.pointsRemaining)}</span>
                    </p>
                  </div>
                )}
                {receiptData.discount > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Diskon {receiptData.promoName ? `(${receiptData.promoName})` : "promo / voucher"}:</span>
                    <span className="font-mono tabular-nums">-{formatCurrencyIDR(receiptData.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pajak restoran (PB1):</span>
                  <span className="font-mono tabular-nums text-foreground">{receiptData.tax > 0 ? formatCurrencyIDR(receiptData.tax) : "Rp 0"}</span>
                </div>
                {receiptData.serviceCharge > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{serviceChargeLabel}:</span>
                    <span className="font-mono tabular-nums text-foreground">{formatCurrencyIDR(receiptData.serviceCharge)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-sm pt-1 border-t border-border text-foreground">
                  <span>Total:</span>
                  <span className="font-mono tabular-nums">{formatCurrencyIDR(receiptData.grandTotal)}</span>
                </div>
              </div>

              {/* Payment & Change Breakdown */}
              <div className="space-y-1 text-xs border-b border-dashed border-border pb-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Metode bayar:</span>
                  <span className="font-medium text-foreground">{receiptData.paymentMethod}</span>
                </div>
                {receiptData.qrisVerification && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {receiptData.qrisVerification.type === "SUPERVISOR_MANUAL"
                        ? "Otorisasi manual QRIS:"
                        : "Ref gateway QRIS:"}
                    </span>
                    <span className="font-mono font-medium text-foreground">{receiptData.qrisVerification.referenceNumber}</span>
                  </div>
                )}
                {receiptData.splitDetails && receiptData.splitDetails.length > 0 && (
                  <div className="p-1.5 bg-muted/40 rounded border border-border text-xs space-y-0.5 my-1">
                    <span className="font-medium text-foreground block">Rincian split payment:</span>
                    {receiptData.splitDetails.map((g, idx) => (
                      <div key={g.id || idx} className="flex justify-between text-muted-foreground">
                        <span>• {g.guestLabel} ({g.paymentMethod}):</span>
                        <span className="font-mono tabular-nums text-foreground">{formatCurrencyIDR(g.assignedAmount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total dibayar:</span>
                  <span className="font-mono tabular-nums text-foreground">{formatCurrencyIDR(receiptData.amountPaid)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">Kembalian:</span>
                  <span className="font-mono tabular-nums text-foreground">{formatCurrencyIDR(receiptData.changeDue)}</span>
                </div>
                <div className="flex justify-between font-medium text-success">
                  <span>Status pembayaran:</span>
                  <span>
                    {formatReceiptPaymentStatus(
                      (receiptData as { paymentStatus?: string }).paymentStatus || "PAID"
                    )}
                  </span>
                </div>
              </div>

              {/* Receipt Footer */}
              <div className="text-center text-xs text-muted-foreground space-y-2 pt-2 border-t border-dashed border-border">
                {simulatedWifiVoucher && (
                  <div className="my-2 p-2 rounded-lg border border-dashed border-border bg-muted/20 text-center space-y-1">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-xs font-medium text-foreground">
                        Kode akses Wi-Fi tamu
                      </span>
                    </div>
                    <p className="font-mono text-xs font-semibold text-primary">
                      {simulatedWifiVoucher.voucherCode}
                    </p>
                    <div className="flex justify-between text-xs text-muted-foreground px-1">
                      <span>Durasi: <strong className="text-foreground">{simulatedWifiVoucher.durationFormatted}</strong></span>
                      <span>SSID: <strong className="text-foreground">DagoEng-Guest</strong></span>
                    </div>
                    <p className="text-xs text-muted-foreground italic">
                      *Kode akses resmi terikat struk #{receiptData.orderNumber}
                    </p>
                  </div>
                )}

                <p className="font-medium text-foreground">{footerMessage}</p>
                <div className="pt-2 border-t border-dashed border-border flex flex-col items-center justify-center space-y-1 text-muted-foreground">
                  <span className="text-xs">DagoEng F&B Management</span>
                  <div className="size-6 relative opacity-75">
                    <Image
                      src="/logo-dago.png"
                      alt="Dago"
                      width={18}
                      height={24}
                      className="object-contain mx-auto"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="p-4 border-t border-border bg-card grid grid-cols-2 gap-2 print:hidden">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handlePrint}
              className="w-full"
            >
              <Printer className="size-4" />
              <span>Cetak thermal</span>
            </Button>

            {onViewKitchenTicket && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={onViewKitchenTicket}
                className="w-full"
                title="Buka pratinjau dan cetak nota pesanan dapur"
              >
                <UtensilsCrossed className="size-4" />
                <span>Nota dapur</span>
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
                className="w-full"
                title="Kirim e-Receipt via WhatsApp"
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
                className={`w-full ${!onViewKitchenTicket !== !isAddonActive("WHATSAPP_AUTO_DISPATCH") ? "col-span-2" : ""}`}
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
                className={`w-full ${!onViewKitchenTicket !== !isAddonActive("WHATSAPP_AUTO_DISPATCH") ? "col-span-2" : ""}`}
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
