"use client";

import React, { useState } from "react";
import { Sparkles, ArrowRight, CheckCircle2, X } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AIInsightCardProps {
  insightTitle: string;
  insight: string;
  evidence: string;
  recommendation: string;
  actionText?: string;
  onExecuteAction?: () => void;
}

export function AIInsightCard({
  insightTitle = "Optimasi Margin Kopi Senja Aren",
  insight = "Margin produk Kopi Senja Aren berpotensi meningkat +4.2% dengan substitusi supplier susu lokal terverifikasi.",
  evidence = "Volume penjualan Kopi Senja Aren mencapai 480 cup/minggu (38% dari total revenue). Biaya susu naik 6.5% minggu ini.",
  recommendation = "Gunakan reorder bulk 50L dari supplier 'Bali Dairy Fresh' untuk menekan COGS susu sebesar Rp 1.400/cup.",
  actionText = "Buat Draft Purchase Order",
  onExecuteAction,
}: Partial<AIInsightCardProps>) {
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  const handleActionClick = () => {
    if (onExecuteAction) {
      onExecuteAction();
    } else {
      setIsSuccessModalOpen(true);
    }
  };

  return (
    <>
      <Card className="shadow-xs">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <div className="p-1 rounded-md bg-primary/10 text-primary">
                <Sparkles className="size-4" />
              </div>
              <span>Insight Bisnis AI</span>
            </CardTitle>
            <span className="text-[10px] font-medium bg-primary text-primary-foreground px-2.5 py-0.5 rounded-full">
              Berbasis data
            </span>
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            {insightTitle}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-3.5 space-y-3 text-xs">
          {/* INSIGHT */}
          <div className="flex items-start gap-2">
            <span className="font-semibold min-w-[100px] text-[11px] text-primary">
              Temuan
            </span>
            <p className="text-foreground leading-relaxed">{insight}</p>
          </div>

          {/* EVIDENCE */}
          <div className="flex items-start gap-2">
            <span className="font-semibold min-w-[100px] text-[11px] text-info">
              Bukti data
            </span>
            <p className="text-muted-foreground leading-relaxed">{evidence}</p>
          </div>

          {/* RECOMMENDATION */}
          <div className="flex items-start gap-2">
            <span className="font-semibold min-w-[100px] text-[11px] text-success">
              Rekomendasi
            </span>
            <p className="text-foreground leading-relaxed">{recommendation}</p>
          </div>

          {/* ACTION BUTTON */}
          {actionText && (
            <div className="pt-2 flex items-center justify-end">
              <Button
                type="button"
                size="sm"
                onClick={handleActionClick}
                className="text-xs h-8 gap-1.5 font-medium"
              >
                <span>{actionText}</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Execution Feedback Modal */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-md p-5 border space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-success" />
                <h4 className="text-sm font-semibold text-foreground">Aksi AI dijalankan</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsSuccessModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">
                Aksi: <span className="text-primary">{actionText}</span>
              </p>
              <p className="bg-muted/50 p-3 rounded-xl border">
                {recommendation}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Draft telah disiapkan dan data rekomendasi disinkronkan ke sistem operasional.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                onClick={() => setIsSuccessModalOpen(false)}
                className="text-xs"
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
