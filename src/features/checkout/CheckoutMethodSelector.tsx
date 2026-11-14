"use client";

import React from "react";
import { Building, Check, CreditCard, QrCode } from "lucide-react";
import type { CheckoutPaymentMethod } from "./checkout-domain";

interface CheckoutMethodSelectorProps {
  selectedMethod: CheckoutPaymentMethod;
  onSelectMethod: (method: CheckoutPaymentMethod) => void;
}

export function CheckoutMethodSelector({
  selectedMethod,
  onSelectMethod,
}: CheckoutMethodSelectorProps) {
  const methods: { id: CheckoutPaymentMethod; label: string; sublabel: string; icon: React.ReactNode }[] = [
    {
      id: "QRIS",
      label: "QRIS",
      sublabel: "Scan instan",
      icon: <QrCode className="size-4 text-primary" />,
    },
    {
      id: "BCA_VA",
      label: "Virtual account",
      sublabel: "BCA / Mandiri",
      icon: <Building className="size-4 text-primary" />,
    },
    {
      id: "CREDIT_CARD",
      label: "Kartu kredit",
      sublabel: "Visa / Mastercard",
      icon: <CreditCard className="size-4 text-primary" />,
    },
  ];

  return (
    <div className="space-y-3">
      <span className="text-xs font-medium text-foreground block">
        Pilih metode pembayaran (simulasi DOKU)
      </span>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {methods.map((m) => {
          const isSelected = selectedMethod === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelectMethod(m.id)}
              className={`p-3 rounded-lg border text-left flex flex-col justify-between space-y-2 cursor-pointer transition-colors ${
                isSelected
                  ? "bg-primary/5 border-primary ring-1 ring-primary text-foreground"
                  : "bg-card border-border text-muted-foreground hover:border-foreground/30"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                {m.icon}
                {isSelected && <Check className="size-3.5 text-primary" />}
              </div>
              <div>
                <span className="font-semibold text-xs block text-foreground">{m.label}</span>
                <span className="text-xs text-muted-foreground">{m.sublabel}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
