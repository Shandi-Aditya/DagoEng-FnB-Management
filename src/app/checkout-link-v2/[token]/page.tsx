"use client";

import React, { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";
import { notify } from "@/components/app/notify";
import {
  type TransactionDetails,
  type CheckoutPaymentMethod,
  buildDokuSimulationPayload,
} from "@/features/checkout/checkout-domain";
import { CheckoutHeader } from "@/features/checkout/CheckoutHeader";
import { CheckoutOrderSummary } from "@/features/checkout/CheckoutOrderSummary";
import { CheckoutMethodSelector } from "@/features/checkout/CheckoutMethodSelector";
import { CheckoutSimulationNotice } from "@/features/checkout/CheckoutSimulationNotice";
import { CheckoutSuccessView } from "@/features/checkout/CheckoutSuccessView";
import { CheckoutCancelledView } from "@/features/checkout/CheckoutCancelledView";

export default function DokuCheckoutSimulatorPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const token = (params?.token as string) || "";
  const invoiceParam = searchParams.get("invoice") || "";

  const [transaction, setTransaction] = useState<TransactionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<CheckoutPaymentMethod>("QRIS");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchTransaction() {
      try {
        setIsLoading(true);
        setError(null);
        const query = new URLSearchParams();
        if (invoiceParam) query.set("invoice", invoiceParam);
        if (token) query.set("token", token);

        const res = await fetch(`/api/webhooks/doku/simulate?${query.toString()}`);
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.error || "Transaksi DOKU tidak ditemukan.");
        }

        if (isMounted) {
          setTransaction(json.data);
          if (json.data.paymentStatus === "PAID") {
            setPaymentSuccess(true);
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          const message = err instanceof Error ? err.message : "Gagal memuat detail tagihan.";
          setError(message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchTransaction();

    return () => {
      isMounted = false;
    };
  }, [token, invoiceParam]);

  const handleSimulatePayment = async (status: "SUCCESS" | "FAILED") => {
    if (!transaction) return;

    try {
      setIsProcessing(true);
      const payload = buildDokuSimulationPayload(
        transaction.dokuInvoiceNumber || `INV-${transaction.ticketCode}`,
        status,
        token
      );

      const res = await fetch("/api/webhooks/doku/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memproses simulasi pembayaran.");
      }

      if (status === "SUCCESS") {
        setPaymentSuccess(true);
        setTransaction((prev) => (prev ? { ...prev, paymentStatus: "PAID" } : null));
        notify.success("Pembayaran terverifikasi", "Tiket acara telah aktif.");
      } else {
        setTransaction((prev) => (prev ? { ...prev, paymentStatus: "CANCELLED" } : null));
        notify.warning("Pembayaran dibatalkan", "Transaksi pembayaran tiket dibatalkan.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal memproses transaksi.";
      notify.error("Simulasi gagal", message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <RefreshCw className="size-6 animate-spin text-primary" />
          <span className="text-xs font-medium">
            Menghubungkan ke simulator checkout DOKU...
          </span>
        </div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <EmptyState
            className="border"
            icon={<AlertCircle className="size-8 text-destructive" />}
            title="Tagihan tidak ditemukan"
            description={error || "Token atau invoice pembayaran tidak valid."}
            action={
              <Button size="lg" render={<Link href="/customer?tab=profile" />}>
                Kembali ke e-tiket saya
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between py-6 px-4 sm:px-6">
      <CheckoutHeader />

      <main className="max-w-xl w-full mx-auto my-6 space-y-4">
        {paymentSuccess ? (
          <CheckoutSuccessView transaction={transaction} />
        ) : transaction.paymentStatus === "CANCELLED" ? (
          <CheckoutCancelledView transaction={transaction} />
        ) : (
          <div className="space-y-4">
            <CheckoutOrderSummary transaction={transaction} />

            <div className="rounded-lg border border-border bg-card p-4 sm:p-5 space-y-4">
              <CheckoutMethodSelector
                selectedMethod={selectedMethod}
                onSelectMethod={setSelectedMethod}
              />

              <CheckoutSimulationNotice />

              <div className="pt-2 space-y-2.5">
                <Button
                  size="lg"
                  disabled={isProcessing}
                  onClick={() => handleSimulatePayment("SUCCESS")}
                  className="w-full"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" />
                      <span>Memproses notifikasi webhook...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4" />
                      <span>Bayar sekarang (simulasi lunas)</span>
                    </>
                  )}
                </Button>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleSimulatePayment("FAILED")}
                    className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                  >
                    Simulasikan pembayaran gagal
                  </button>

                  <Link
                    href={`/events/${transaction.eventId}`}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Batal dan kembali
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-xl w-full mx-auto text-center text-xs text-muted-foreground pt-6 border-t border-border">
        DagoEng Event Marketplace • DOKU Hosted Checkout Simulator (Development & QA)
      </footer>
    </div>
  );
}
