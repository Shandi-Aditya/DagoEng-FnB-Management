"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Sparkles, Lightbulb, ArrowRight, CheckCircle2, X } from "lucide-react";
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
      <Card className="border border-brand-orange/30 bg-gradient-to-br from-white via-orange-50/20 to-white shadow-sm">
        <CardHeader className="pb-3 border-b border-orange-100/60">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center space-x-2 text-slate-900">
              <div className="p-1 rounded-md bg-brand-orange/10 text-brand-orange">
                <Sparkles className="w-4 h-4" />
              </div>
              <span>DagoEng AI Business Insight</span>
            </CardTitle>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-brand-orange text-white px-2 py-0.5 rounded-full">
              Data-Backed
            </span>
          </div>
          <CardDescription className="text-xs text-slate-600 font-medium mt-1">
            {insightTitle}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-3.5 space-y-3 text-xs">
          {/* INSIGHT */}
          <div className="flex items-start space-x-2">
            <span className="font-bold text-slate-900 min-w-[110px] text-[11px] uppercase tracking-wide text-brand-orange">
              [INSIGHT]
            </span>
            <p className="text-slate-800 font-medium leading-relaxed">{insight}</p>
          </div>

          {/* EVIDENCE */}
          <div className="flex items-start space-x-2">
            <span className="font-bold text-slate-900 min-w-[110px] text-[11px] uppercase tracking-wide text-brand-cyan">
              [EVIDENCE]
            </span>
            <p className="text-slate-600 leading-relaxed">{evidence}</p>
          </div>

          {/* RECOMMENDATION */}
          <div className="flex items-start space-x-2">
            <span className="font-bold text-slate-900 min-w-[110px] text-[11px] uppercase tracking-wide text-brand-green">
              [REKOMENDASI]
            </span>
            <p className="text-slate-800 font-medium leading-relaxed">{recommendation}</p>
          </div>

          {/* ACTION BUTTON */}
          {actionText && (
            <div className="pt-2 flex items-center justify-end">
              <Button
                type="button"
                size="sm"
                onClick={handleActionClick}
                className="text-xs h-8 space-x-1.5 bg-brand-orange hover:bg-orange-600 text-white font-bold cursor-pointer active:scale-95 transition-all shadow-sm"
              >
                <span>{actionText}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Execution Feedback Modal */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-brand-green" />
                <h4 className="text-sm font-bold text-slate-900">Aksi AI Dijalankan</h4>
              </div>
              <button
                onClick={() => setIsSuccessModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">
                Aksi: <span className="text-brand-orange">{actionText}</span>
              </p>
              <p className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                {recommendation}
              </p>
              <p className="text-[11px] text-slate-400">
                Draft telah disiapkan dan data rekomendasi disinkronkan ke sistem operasional.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                onClick={() => setIsSuccessModalOpen(false)}
                className="text-xs font-bold bg-slate-900 text-white"
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
