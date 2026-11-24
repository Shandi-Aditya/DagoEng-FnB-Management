"use client";

import React from "react";
import Image from "next/image";
import { CheckCircle2, FileText, MessageSquare, Printer, RotateCcw, UtensilsCrossed } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CorporateInvoicePDFModal } from "@/features/pos/CorporateInvoicePDFModal";
import {
  calculateTenantReceiptGroups,
  formatReceiptLoyaltyPoints,
  formatReceiptOrderType,
  formatReceiptPaymentStatus,
  formatReceiptServiceChargeLabel,
  type POSReceiptItem,
} from "@/features/pos/pos-receipt";
import type { POSReceiptData } from "@/features/pos/types";
import type { KitchenTicketData } from "@/types/printer";
import { usePrinter } from "@/contexts/PrinterContext";
import { useSettings } from "@/contexts/SettingsContext";
import { OFFICIAL_CS_DISPLAY_PHONE } from "@/lib/contact-config";
import { splitCustomerReceiptByMode } from "@/lib/printer";
import { MASTER_HQ_OUTLET } from "@/lib/receipt-publisher";
import { isAddonActive } from "@/lib/subscription";
import { isCoworkingOrderItem } from "@/lib/tax-breakdown";
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

function ReceiptItemRow({
  item,
  indented = false,
}: {
  item: POSReceiptItem;
  indented?: boolean;
}) {
  return (
    <div className={indented ? "space-y-0.5 text-xs pl-1" : "space-y-0.5 text-xs"}>
      <div className="flex justify-between font-medium">
        <span className="text-foreground">
          {item.name} x{item.quantity}
        </span>
        <span className="font-mono tabular-nums text-foreground">
          {formatCurrencyIDR(item.subtotal)}
        </span>
      </div>
      {item.coworkingMeta && (
        <p className="text-xs text-muted-foreground pl-2">
          • {item.coworkingMeta.spaceName} ({item.coworkingMeta.durationHours} jam
          {item.coworkingMeta.startTime && item.coworkingMeta.endTime
            ? `, ${item.coworkingMeta.startTime}–${item.coworkingMeta.endTime}`
            : ""}
          )
        </p>
      )}
      {item.variantName && (
        <p className="text-xs text-muted-foreground pl-2">• {item.variantName}</p>
      )}
      {item.modifiers && item.modifiers.length > 0 && (
        <p className="text-xs text-muted-foreground pl-2">• {item.modifiers.join(", ")}</p>
      )}
      {item.notes && (
        <p className="text-xs text-muted-foreground pl-2">*Catatan: {item.notes}</p>
      )}
    </div>
  );
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
  const { printCustomerReceipt, printKitchenOrder, settings: printerSettings } = usePrinter();
  const { settings: platformSettings } = useSettings();
  const [selectedSplitIdx, setSelectedSplitIdx] = React.useState(0);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = React.useState(false);

  const effectiveCombineMode = platformSettings.receiptCombineMode ?? "COMBINED";

  const splitReceipts = React.useMemo(() => {
    if (!receiptData) return [];
    return splitCustomerReceiptByMode(receiptData, {
      receiptCombineMode: effectiveCombineMode,
      splitCustomerReceiptPerTenant: Boolean(printerSettings.splitCustomerReceiptPerTenant),
    });
  }, [receiptData, effectiveCombineMode, printerSettings.splitCustomerReceiptPerTenant]);

  React.useEffect(() => {
    setSelectedSplitIdx(0);
  }, [
    receiptData?.orderNumber,
    isOpen,
    effectiveCombineMode,
    printerSettings.splitCustomerReceiptPerTenant,
  ]);

  if (!isOpen || !receiptData) return null;

  const hasSplitReceipts = splitReceipts.length > 1;
  const activeReceipt = hasSplitReceipts
    ? splitReceipts[Math.min(selectedSplitIdx, splitReceipts.length - 1)] || receiptData
    : receiptData;

  const handlePrint = async () => {
    try {
      await printCustomerReceipt(receiptData, {
        isManualReprint: true,
        receiptCombineMode: effectiveCombineMode,
      });
    } catch {
      window.print();
    }

    const fnbItemsForKitchen = (receiptData.items || []).filter(
      (item) => !isCoworkingOrderItem(item)
    );
    if (printerSettings.autoPrintKitchenOrder && fnbItemsForKitchen.length > 0) {
      try {
        const kitchenTicket: KitchenTicketData = {
          orderId: receiptData.orderNumber,
          orderNumber: receiptData.orderNumber,
          outletId: "outlet-sgr",
          outletName: receiptData.outletName || "Outlet Singaraja",
          tableNumber: receiptData.tableNumber || "-",
          customerName: receiptData.customerName || "Tamu",
          orderType: (receiptData.orderType?.toUpperCase() === "TAKEAWAY" ? "TAKEAWAY" : "DINE_IN") as "DINE_IN" | "TAKEAWAY",
          purpose: "NEW_ORDER",
          items: fnbItemsForKitchen.map((item, idx) => ({
            id: `item-${idx}-${Date.now()}`,
            productName: item.name,
            quantity: item.quantity,
            variantName: item.variantName,
            modifiers: item.modifiers,
            notes: item.notes,
            tenantId: item.tenantId,
            tenantName: item.tenantName,
          })),
          cashierName: receiptData.cashierName || "Kasir Bertugas",
          timestamp: receiptData.date || new Date().toLocaleTimeString("id-ID"),
          isSilent: true,
        };
        await printKitchenOrder(kitchenTicket, "NEW_ORDER", { isSilent: true });
      } catch (err) {
        console.error("Gagal auto-cetak nota dapur saat cetak struk kasir:", err);
      }
    }
  };

  const activeItems = activeReceipt.items || [];
  const groupedItems = calculateTenantReceiptGroups(activeItems);
  const hasCoworkingItems = groupedItems.some((g) => g.isCoworking);
  const allCoworkingItems = groupedItems.length > 0 && groupedItems.every((g) => g.isCoworking);
  const isCoworkingOnlyReceipt = activeReceipt.tenantId === "DAGO_HUB" || allCoworkingItems;
  const isMultiTenant = groupedItems.length > 1;

  const primaryTenantId = isCoworkingOnlyReceipt
    ? "DAGO_HUB"
    : activeReceipt.tenantId || groupedItems[0]?.tenantId || "tenant-ks";

  const allStoredSettings = typeof window !== "undefined" ? getAllStoredTenantSettings() : {};
  const storedTenantSettings = !isCoworkingOnlyReceipt ? allStoredSettings[primaryTenantId] : undefined;
  const defaultTenantInfo =
    DEFAULT_FNB_TENANTS.find((t) => t.id === primaryTenantId) || DEFAULT_FNB_TENANTS[0];

  const brandName = isCoworkingOnlyReceipt
    ? activeReceipt.brandName || activeReceipt.tenantName || "Dago Creative Hub"
    : isMultiTenant
    ? "Dago Creative Hub"
    : activeReceipt.receiptHeader ||
      storedTenantSettings?.receiptHeader ||
      storedTenantSettings?.brandName ||
      activeReceipt.tenantName ||
      defaultTenantInfo.name;

  const tagline = isCoworkingOnlyReceipt
    ? activeReceipt.tagline || "Co-Working & Meeting Spaces"
    : isMultiTenant
    ? hasCoworkingItems
      ? "Ringkasan pesanan co-working & mitra"
      : "Ringkasan pesanan multi-mitra"
    : activeReceipt.tagline ||
      storedTenantSettings?.tagline ||
      defaultTenantInfo.tagline ||
      defaultTenantInfo.badge;

  const contactPhone =
    isCoworkingOnlyReceipt || isMultiTenant
      ? activeReceipt.outletPhone || MASTER_HQ_OUTLET.phone || OFFICIAL_CS_DISPLAY_PHONE
      : storedTenantSettings?.contactPhone || activeReceipt.outletPhone;

  const footerMessage =
    activeReceipt.receiptFooter ||
    (!isMultiTenant && !isCoworkingOnlyReceipt ? storedTenantSettings?.receiptFooter : undefined) ||
    "Terima kasih atas kunjungan Anda";

  const simulatedWifiVoucher = (() => {
    if (!activeReceipt.orderNumber) return null;
    const calcBasis = getSimulatedWifiCalcBasis();
    const evaluatedAmount = calcBasis === "NET_SALES" ? (activeReceipt.subtotal || 0) : (activeReceipt.grandTotal || 0);

    return getOrCreateSimulatedWifiVoucher(
      activeReceipt.orderNumber,
      activeReceipt.customerName,
      evaluatedAmount,
      activeReceipt.outletName,
      primaryTenantId,
      brandName
    );
  })();

  const serviceChargeLabel = formatReceiptServiceChargeLabel(
    (activeReceipt as { serviceChargePercent?: number }).serviceChargePercent
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

          {hasSplitReceipts ? (
            <div className="px-4 py-2 bg-muted/30 border-b border-border print:hidden">
              <Tabs
                value={String(Math.min(selectedSplitIdx, splitReceipts.length - 1))}
                onValueChange={(val) => setSelectedSplitIdx(Number(val))}
              >
                <TabsList aria-label="Pilih struk mitra" className="w-full overflow-x-auto">
                  {splitReceipts.map((sub, idx) => (
                    <TabsTrigger key={sub.orderNumber} value={String(idx)} className="text-xs">
                      {sub.tenantId === "DAGO_HUB"
                        ? "Co-working"
                        : sub.tenantName || `Mitra ${idx + 1}`}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          ) : null}

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
                  {activeReceipt.outletAddress || MASTER_HQ_OUTLET.address}
                </p>
                {contactPhone && <p className="text-xs text-muted-foreground">Telp: {contactPhone}</p>}
              </div>

              {/* Meta Order Info */}
              <div className="space-y-1 border-b border-dashed border-border pb-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">No. struk:</span>
                  <span className="font-medium text-foreground">{activeReceipt.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tanggal:</span>
                  <span className="text-foreground">{activeReceipt.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kasir:</span>
                  <span className="text-foreground">{activeReceipt.cashierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Meja / tipe:</span>
                  <span className="font-medium text-foreground">
                    {activeReceipt.orderType === "DINE_IN"
                      ? `Meja ${activeReceipt.tableNumber}`
                      : formatReceiptOrderType(activeReceipt.orderType)}
                  </span>
                </div>
                {activeReceipt.customerName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pelanggan:</span>
                    <span className="text-foreground">{activeReceipt.customerName}</span>
                  </div>
                )}
              </div>

              {/* Items List - Grouped by Mitra / Co-working if Multi-Tenant */}
              <div className="space-y-2 border-b border-dashed border-border pb-3">
                {isMultiTenant ? (
                  groupedItems.map((group) => (
                    <div
                      key={group.tenantId}
                      className="space-y-1.5 pt-2 first:pt-0 border-t first:border-t-0 border-dashed border-border"
                    >
                      <div className="flex items-center justify-between bg-muted/50 px-2 py-1 rounded text-xs font-medium text-foreground border border-border">
                        <span>
                          {group.tenantId === "DAGO_HUB"
                            ? group.tenantName
                            : `Mitra: ${group.tenantName}`}
                        </span>
                        <span className="font-mono text-muted-foreground tabular-nums">
                          {group.tenantId === "DAGO_HUB"
                            ? `${group.items.length} item · 0% PB1`
                            : `${group.items.length} item`}
                        </span>
                      </div>
                      {group.items.map((item, idx) => (
                        <ReceiptItemRow key={idx} item={item} indented />
                      ))}
                      <div className="flex justify-between text-xs font-medium text-foreground pt-1 border-t border-dotted border-border pl-1">
                        <span className="text-muted-foreground">Subtotal ({group.tenantName}):</span>
                        <span className="font-mono tabular-nums">{formatCurrencyIDR(group.subtotal)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  activeItems.map((item, idx) => <ReceiptItemRow key={idx} item={item} />)
                )}
              </div>

              {/* Calculations Breakdown */}
              <div className="space-y-1 text-xs border-b border-dashed border-border pb-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-mono tabular-nums text-foreground">{formatCurrencyIDR(activeReceipt.subtotal)}</span>
                </div>
                {activeReceipt.loyaltyMember && (
                  <div className="p-1.5 bg-muted/40 rounded border border-border text-xs space-y-0.5 my-1">
                    <div className="flex justify-between font-medium text-foreground">
                      <span>Member: {activeReceipt.loyaltyMember.name}</span>
                      <span className="text-primary font-medium">Tier {activeReceipt.loyaltyMember.tier}</span>
                    </div>
                    {activeReceipt.loyaltyMember.voucherTitle && (
                      <p className="text-primary text-xs">
                        • {activeReceipt.loyaltyMember.voucherTitle} (-{formatReceiptLoyaltyPoints(activeReceipt.loyaltyMember.pointsUsed)})
                      </p>
                    )}
                    <p className="text-muted-foreground text-xs">
                      Sisa poin: <span className="font-mono tabular-nums text-foreground">{formatReceiptLoyaltyPoints(activeReceipt.loyaltyMember.pointsRemaining)}</span>
                    </p>
                  </div>
                )}
                {activeReceipt.discount > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Diskon {activeReceipt.promoName ? `(${activeReceipt.promoName})` : "promo / voucher"}:</span>
                    <span className="font-mono tabular-nums">-{formatCurrencyIDR(activeReceipt.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {isCoworkingOnlyReceipt
                      ? activeReceipt.tax === 0
                        ? "Pajak PB1 (co-working 0%):"
                        : "Pajak sewa co-working:"
                      : "Pajak restoran (PB1):"}
                  </span>
                  <span className="font-mono tabular-nums text-foreground">{activeReceipt.tax > 0 ? formatCurrencyIDR(activeReceipt.tax) : "Rp 0"}</span>
                </div>
                {activeReceipt.serviceCharge > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{serviceChargeLabel}:</span>
                    <span className="font-mono tabular-nums text-foreground">{formatCurrencyIDR(activeReceipt.serviceCharge)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-sm pt-1 border-t border-border text-foreground">
                  <span>Total:</span>
                  <span className="font-mono tabular-nums">{formatCurrencyIDR(activeReceipt.grandTotal)}</span>
                </div>
              </div>

              {/* Payment & Change Breakdown */}
              <div className="space-y-1 text-xs border-b border-dashed border-border pb-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Metode bayar:</span>
                  <span className="font-medium text-foreground">{activeReceipt.paymentMethod}</span>
                </div>
                {activeReceipt.qrisVerification && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {activeReceipt.qrisVerification.type === "SUPERVISOR_MANUAL"
                        ? "Otorisasi manual QRIS:"
                        : "Ref gateway QRIS:"}
                    </span>
                    <span className="font-mono font-medium text-foreground">{activeReceipt.qrisVerification.referenceNumber}</span>
                  </div>
                )}
                {activeReceipt.splitDetails && activeReceipt.splitDetails.length > 0 && (
                  <div className="p-1.5 bg-muted/40 rounded border border-border text-xs space-y-0.5 my-1">
                    <span className="font-medium text-foreground block">Rincian split payment:</span>
                    {activeReceipt.splitDetails.map((g, idx) => (
                      <div key={g.id || idx} className="flex justify-between text-muted-foreground">
                        <span>• {g.guestLabel} ({g.paymentMethod}):</span>
                        <span className="font-mono tabular-nums text-foreground">{formatCurrencyIDR(g.assignedAmount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total dibayar:</span>
                  <span className="font-mono tabular-nums text-foreground">{formatCurrencyIDR(activeReceipt.amountPaid)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">Kembalian:</span>
                  <span className="font-mono tabular-nums text-foreground">{formatCurrencyIDR(activeReceipt.changeDue)}</span>
                </div>
                <div className="flex justify-between font-medium text-success">
                  <span>Status pembayaran:</span>
                  <span>
                    {formatReceiptPaymentStatus(
                      (activeReceipt as { paymentStatus?: string }).paymentStatus || "PAID"
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
                      *Kode akses resmi terikat struk #{activeReceipt.orderNumber}
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
              <span>{hasSplitReceipts ? `Cetak (${splitReceipts.length} struk)` : "Cetak thermal"}</span>
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
                  const phone = activeReceipt.customerPhone ? activeReceipt.customerPhone.replace(/[^0-9]/g, "") : "";
                  const text = encodeURIComponent(
                    `*STRUK PEMBAYARAN ${brandName.toUpperCase()}*\n` +
                    `No: #${activeReceipt.orderNumber}\n` +
                    `Pelanggan: ${activeReceipt.customerName || "Tamu"}\n` +
                    `Total: ${formatCurrencyIDR(activeReceipt.grandTotal)}\n` +
                    `Metode: ${activeReceipt.paymentMethod}\n` +
                    (simulatedWifiVoucher ? `Kode Wi-Fi: ${simulatedWifiVoucher.voucherCode} (${simulatedWifiVoucher.durationFormatted})\n` : "") +
                    `\nTerima kasih telah berkunjung`
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

            {receiptData.corporateInfo && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setIsInvoiceModalOpen(true)}
                className="w-full col-span-2 border-primary/40 text-primary hover:bg-primary/5 font-semibold text-xs gap-1.5"
              >
                <FileText className="size-4" />
                <span>Lihat / Cetak Invoice Perusahaan ({receiptData.corporateInfo.companyName})</span>
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

      <CorporateInvoicePDFModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        order={receiptData}
      />
    </>
  );
}
