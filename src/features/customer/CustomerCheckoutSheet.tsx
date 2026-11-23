"use client";

import { useEffect } from "react";
import { Check, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
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
import { useSettings } from "@/contexts/SettingsContext";
import { isQrSelfOrderQrisOnly } from "@/lib/self-order-policy";
import { formatCurrencyIDR } from "@/lib/utils";
import type { PromoConfig } from "@/lib/promo";
import type { MasterProduct } from "@/types/product";

import {
  calculateCartTotals,
  type CustomerCartItem,
} from "./customer-domain";

export interface CustomerCheckoutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: CustomerCartItem[];
  onAddToCart: (product: MasterProduct) => void;
  onRemoveFromCart: (productId: string) => void;
  onClearCart: () => void;
  // Options
  orderType: "DINE_IN" | "TAKEAWAY";
  onOrderTypeChange: (type: "DINE_IN" | "TAKEAWAY") => void;
  selectedTableNumber: string;
  onTableNumberChange: (table: string) => void;
  availableTables: Array<{ id: string; number: string | number; areaName?: string }>;
  paymentMethod: "QRIS" | "CASHIER";
  onPaymentMethodChange: (method: "QRIS" | "CASHIER") => void;
  // Promos & Vouchers
  voucherInput: string;
  onVoucherInputChange: (val: string) => void;
  activePromo: PromoConfig | null;
  onApplyVoucher: (code: string) => void;
  onRemovePromo: () => void;
  voucherMessage: string | null;
  voucherSuccess: boolean;
  taxRatePercent: number;
  serviceChargePercent: number;
  // Submit
  isSubmitting: boolean;
  onSubmitOrder: () => void;
}

export function CustomerCheckoutSheet({
  open,
  onOpenChange,
  cart,
  onAddToCart,
  onRemoveFromCart,
  onClearCart,
  orderType,
  onOrderTypeChange,
  selectedTableNumber,
  onTableNumberChange,
  availableTables,
  paymentMethod,
  onPaymentMethodChange,
  voucherInput,
  onVoucherInputChange,
  activePromo,
  onApplyVoucher,
  onRemovePromo,
  voucherMessage,
  voucherSuccess,
  taxRatePercent,
  serviceChargePercent,
  isSubmitting,
  onSubmitOrder,
}: CustomerCheckoutSheetProps) {
  const { settings } = useSettings();
  const qrisOnly = isQrSelfOrderQrisOnly(settings);

  useEffect(() => {
    if (qrisOnly && paymentMethod !== "QRIS") {
      onPaymentMethodChange("QRIS");
    }
  }, [qrisOnly, paymentMethod, onPaymentMethodChange]);

  const isDineIn = orderType === "DINE_IN";
  const totals = calculateCartTotals(cart, {
    activePromo,
    taxRatePercent,
    serviceChargePercent,
    isDineIn,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-6 overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl font-medium">Keranjang pesanan</SheetTitle>
            {cart.length > 0 ? (
              <Button type="button" size="sm" variant="ghost" onClick={onClearCart}>
                Kosongkan
              </Button>
            ) : null}
          </div>
          <SheetDescription className="text-xs">
            Periksa item pesanan Anda sebelum melanjutkan.
          </SheetDescription>
        </SheetHeader>

        {cart.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
            <ShoppingBag className="size-8 text-muted-foreground/60 mb-2" />
            <p className="font-medium text-foreground">Keranjang Anda masih kosong</p>
            <p className="mt-1">Pilih menu favorit Anda dari katalog untuk mulai memesan.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5 py-4 text-xs">
            {/* 1. Daftar Item Keranjang */}
            <div className="flex flex-col divide-y rounded-lg border bg-card">
              {cart.map((item) => (
                <div key={item.product.id} className="flex items-center justify-between p-3 gap-2">
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-medium text-foreground text-sm truncate">
                      {item.product.name}
                    </span>
                    <span className="text-muted-foreground font-mono tabular-nums">
                      {formatCurrencyIDR(item.product.basePrice)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="outline"
                      onClick={() => onRemoveFromCart(item.product.id)}
                      aria-label="Kurangi jumlah"
                    >
                      <Minus />
                    </Button>
                    <span className="w-6 text-center font-mono font-medium tabular-nums text-foreground">
                      {item.quantity}
                    </span>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="outline"
                      onClick={() => onAddToCart(item.product)}
                      aria-label="Tambah jumlah"
                    >
                      <Plus />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* 2. Opsi Makan: Dine-in vs Takeaway */}
            <div className="flex flex-col gap-2 rounded-lg border p-3">
              <Label className="text-xs">Tipe pesanan</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={isDineIn ? "default" : "outline"}
                  onClick={() => onOrderTypeChange("DINE_IN")}
                >
                  Makan di tempat
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={!isDineIn ? "default" : "outline"}
                  onClick={() => onOrderTypeChange("TAKEAWAY")}
                >
                  Bawa pulang
                </Button>
              </div>

              {isDineIn ? (
                <div className="flex flex-col gap-1.5 pt-2 border-t mt-1">
                  <Label htmlFor="checkoutTable">Nomor meja</Label>
                  <NativeSelect
                    id="checkoutTable"
                    value={selectedTableNumber}
                    onChange={(e) => onTableNumberChange(e.target.value)}
                  >
                    <NativeSelectOption value="">Pilih nomor meja</NativeSelectOption>
                    {availableTables.map((t) => (
                      <NativeSelectOption key={t.id} value={String(t.number)}>
                        Meja {t.number} ({t.areaName || "Area Utama"})
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
              ) : null}
            </div>

            {/* 3. Input Voucher / Promo */}
            <div className="flex flex-col gap-2 rounded-lg border p-3">
              <Label className="text-xs">Kode kupon / voucher</Label>
              {activePromo ? (
                <div className="flex items-center justify-between rounded-md border bg-muted/40 p-2">
                  <div className="flex items-center gap-1.5">
                    <Check className="size-3.5 text-success" />
                    <span className="font-mono font-medium text-foreground">{activePromo.code}</span>
                    <span className="text-muted-foreground">({activePromo.name})</span>
                  </div>
                  <Button type="button" size="icon-xs" variant="ghost" onClick={onRemovePromo} aria-label="Hapus promo">
                    <X />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    placeholder="Contoh: DAGO20"
                    value={voucherInput}
                    onChange={(e) => onVoucherInputChange(e.target.value.toUpperCase())}
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!voucherInput.trim()}
                    onClick={() => onApplyVoucher(voucherInput.trim())}
                  >
                    Gunakan
                  </Button>
                </div>
              )}

              {voucherMessage ? (
                <p className={`text-xs ${voucherSuccess ? "text-success" : "text-destructive"}`}>
                  {voucherMessage}
                </p>
              ) : null}
            </div>

            {/* 4. Pilihan Metode Bayar */}
            <div className="flex flex-col gap-2 rounded-lg border p-3">
              <Label className="text-xs">Metode pembayaran</Label>
              {qrisOnly ? (
                <div className="flex flex-col gap-1 rounded-md border bg-muted/40 p-2.5 text-xs">
                  <span className="font-medium text-foreground">QRIS otomatis</span>
                  <span className="text-muted-foreground">
                    Pembayaran diproses lewat QRIS. Status lunas diperbarui otomatis setelah verifikasi.
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={paymentMethod === "QRIS" ? "default" : "outline"}
                    onClick={() => onPaymentMethodChange("QRIS")}
                  >
                    QRIS otomatis
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={paymentMethod === "CASHIER" ? "default" : "outline"}
                    onClick={() => onPaymentMethodChange("CASHIER")}
                  >
                    Bayar di kasir
                  </Button>
                </div>
              )}
            </div>

            {/* 5. Rincian Biaya */}
            <div className="flex flex-col gap-1.5 rounded-lg border bg-muted/20 p-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono tabular-nums text-foreground">{formatCurrencyIDR(totals.subtotal)}</span>
              </div>

              {totals.discountAmount > 0 ? (
                <div className="flex justify-between text-success">
                  <span>Diskon voucher</span>
                  <span className="font-mono tabular-nums">-{formatCurrencyIDR(totals.discountAmount)}</span>
                </div>
              ) : null}

              {isDineIn && totals.serviceChargeAmount > 0 ? (
                <div className="flex justify-between text-muted-foreground">
                  <span>Biaya layanan ({serviceChargePercent}%)</span>
                  <span className="font-mono tabular-nums">{formatCurrencyIDR(totals.serviceChargeAmount)}</span>
                </div>
              ) : null}

              {totals.taxAmount > 0 ? (
                <div className="flex justify-between text-muted-foreground">
                  <span>Pajak restoran ({taxRatePercent}%)</span>
                  <span className="font-mono tabular-nums">{formatCurrencyIDR(totals.taxAmount)}</span>
                </div>
              ) : null}

              <div className="flex justify-between border-t pt-1.5 font-medium text-sm text-foreground">
                <span>Total tagihan</span>
                <span className="font-mono text-base tabular-nums">{formatCurrencyIDR(totals.finalTotal)}</span>
              </div>
            </div>
          </div>
        )}

        <SheetFooter className="mt-auto border-t pt-4">
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={cart.length === 0 || (isDineIn && !selectedTableNumber) || isSubmitting}
            onClick={onSubmitOrder}
          >
            <span>{isSubmitting ? "Memproses pesanan…" : `Pesan sekarang (${formatCurrencyIDR(totals.finalTotal)})`}</span>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
