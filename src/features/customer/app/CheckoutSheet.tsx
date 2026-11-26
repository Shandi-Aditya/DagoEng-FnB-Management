"use client";

import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  formatCustomerCartItemOptions,
  getCustomerCartItemKey,
  getCustomerCartItemUnitPrice,
  type CustomerCartItem,
  type CustomerCartTotals,
} from "@/features/customer/customer-domain";
import { SelfOrderPaymentField } from "@/features/customer/SelfOrderPaymentField";
import { cn, formatCurrencyIDR } from "@/lib/utils";

export type CheckoutOrderType = "DINE_IN" | "TAKEAWAY";
export type CheckoutPayment = "QRIS" | "CASHIER";

export interface CheckoutForm {
  name: string;
  phone: string;
  orderType: CheckoutOrderType;
  tableNumber: string;
  payment: CheckoutPayment;
  notes: string;
}

interface CheckoutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: readonly CustomerCartItem[];
  totals: CustomerCartTotals;
  form: CheckoutForm;
  onFormChange: (patch: Partial<CheckoutForm>) => void;
  /** Table locked by the QR link the guest scanned; when set the table picker is hidden. */
  lockedTable: string | null;
  tables: readonly { number: string; areaName: string }[];
  onAdd: (lineKey: string) => void;
  onRemove: (lineKey: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  /** When true (default), self-order QR only permits QRIS payment and hides cashier option. */
  qrisOnly?: boolean;
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: readonly { id: T; label: string }[]; onChange: (id: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex gap-2">
      {options.map((option) => (
        <Button
          key={option.id}
          type="button"
          size="lg"
          variant={option.id === value ? "default" : "outline"}
          aria-pressed={option.id === value}
          onClick={() => onChange(option.id)}
          className="h-10 flex-1 text-sm"
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between", strong ? "text-base font-medium" : "text-sm text-muted-foreground")}>
      <span>{label}</span>
      <span className="font-mono tabular-nums">{formatCurrencyIDR(value)}</span>
    </div>
  );
}

/** Bottom sheet that turns the cart into an order: items, where to serve, who it is for, how to pay. */
export function CheckoutSheet(props: CheckoutSheetProps) {
  const { form, totals } = props;
  const isQrisOnly = props.qrisOnly ?? true;
  const canSubmit = form.name.trim() !== "" && form.phone.trim() !== "" && (form.orderType === "TAKEAWAY" || form.tableNumber !== "");

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[92svh] max-w-2xl rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-lg font-medium">Pesanan Anda</SheetTitle>
          <SheetDescription>Periksa pesanan, lalu bayar.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-4">
          <ul className="flex flex-col divide-y rounded-xl border">
            {props.cart.map((item) => {
              const lineKey = getCustomerCartItemKey(item);
              const optionsSummary = formatCustomerCartItemOptions(item);
              const lineTotal = getCustomerCartItemUnitPrice(item) * item.quantity;
              return (
                <li key={lineKey} className="flex items-center gap-3 p-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium">{item.product.name}</span>
                    {optionsSummary ? (
                      <span className="text-xs text-muted-foreground">{optionsSummary}</span>
                    ) : null}
                    {item.notes ? (
                      <span className="text-xs text-muted-foreground">Catatan: {item.notes}</span>
                    ) : null}
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">{formatCurrencyIDR(lineTotal)}</span>
                  </div>
                  <Button variant="outline" size="icon" onClick={() => props.onRemove(lineKey)} aria-label={`Kurangi ${item.product.name}`}>
                    <Minus />
                  </Button>
                  <span className="w-5 text-center font-mono text-sm tabular-nums">{item.quantity}</span>
                  <Button variant="outline" size="icon" onClick={() => props.onAdd(lineKey)} aria-label={`Tambah ${item.product.name}`}>
                    <Plus />
                  </Button>
                </li>
              );
            })}
          </ul>

          <FieldGroup>
            <Field>
              <FieldLabel>Disajikan</FieldLabel>
              <Segmented
                label="Cara penyajian"
                value={form.orderType}
                onChange={(orderType) => props.onFormChange({ orderType })}
                options={[
                  { id: "DINE_IN", label: "Makan di sini" },
                  { id: "TAKEAWAY", label: "Bawa pulang" },
                ]}
              />
            </Field>

            {form.orderType === "DINE_IN" && !props.lockedTable ? (
              <Field>
                <FieldLabel htmlFor="checkout-table">Meja</FieldLabel>
                <NativeSelect id="checkout-table" value={form.tableNumber} onChange={(event) => props.onFormChange({ tableNumber: event.target.value })}>
                  <NativeSelectOption value="">Pilih meja</NativeSelectOption>
                  {props.tables.map((table) => (
                    <NativeSelectOption key={table.number} value={table.number}>
                      {table.number}, {table.areaName}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldDescription>Nomor meja ada di stiker QR di meja Anda.</FieldDescription>
              </Field>
            ) : null}

            <Field>
              <FieldLabel htmlFor="checkout-name">Nama</FieldLabel>
              <Input id="checkout-name" value={form.name} onChange={(event) => props.onFormChange({ name: event.target.value })} autoComplete="name" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="checkout-phone">Nomor WhatsApp</FieldLabel>
              <Input
                id="checkout-phone"
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(event) => props.onFormChange({ phone: event.target.value })}
                placeholder="08123456789"
                autoComplete="tel"
                required
              />
              <FieldDescription>Untuk melihat status pesanan di Aktivitas. Tidak perlu akun.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="checkout-notes">Catatan</FieldLabel>
              <Textarea id="checkout-notes" rows={2} value={form.notes} onChange={(event) => props.onFormChange({ notes: event.target.value })} placeholder="Tanpa es, pedas sedang" />
            </Field>
            <Field>
              <FieldLabel>Bayar</FieldLabel>
              <SelfOrderPaymentField
                value={form.payment}
                onChange={(payment) => props.onFormChange({ payment })}
                qrisOnly={isQrisOnly}
              />
            </Field>
          </FieldGroup>

          <div className="flex flex-col gap-1.5 rounded-xl bg-muted/50 p-4">
            <TotalRow label="Subtotal" value={totals.subtotal} />
            {totals.discountAmount > 0 ? <TotalRow label="Diskon" value={-totals.discountAmount} /> : null}
            {totals.serviceChargeAmount > 0 ? <TotalRow label="Biaya layanan" value={totals.serviceChargeAmount} /> : null}
            {totals.taxAmount > 0 ? <TotalRow label="Pajak" value={totals.taxAmount} /> : null}
            <TotalRow label="Total" value={totals.finalTotal} strong />
          </div>
        </div>

        <SheetFooter>
          <Button size="lg" className="w-full" disabled={!canSubmit || props.isSubmitting} onClick={props.onSubmit}>
            {props.isSubmitting ? <Spinner /> : null}
            {isQrisOnly || form.payment === "QRIS" ? "Bayar dengan QRIS" : "Pesan, bayar di kasir"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
