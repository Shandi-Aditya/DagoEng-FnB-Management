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
      <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center space-x-2 text-slate-900 dark:text-slate-100">
              <div className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-[#3B7A57] dark:text-[#52B788]">
                <Sparkles className="w-4 h-4" />
              </div>
              <span>DagoEng AI Business Insight</span>
            </CardTitle>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-[#3B7A57] dark:bg-[#52B788] text-white dark:text-slate-950 px-2.5 py-0.5 rounded-full">
              Data-Backed
            </span>
          </div>
          <CardDescription className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-1">
            {insightTitle}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-3.5 space-y-3 text-xs">
          {/* INSIGHT */}
          <div className="flex items-start space-x-2">
            <span className="font-bold min-w-[110px] text-[11px] uppercase tracking-wide text-[#3B7A57] dark:text-[#52B788]">
              [INSIGHT]
            </span>
            <p className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">{insight}</p>
          </div>

          {/* EVIDENCE */}
          <div className="flex items-start space-x-2">
            <span className="font-bold min-w-[110px] text-[11px] uppercase tracking-wide text-sky-600 dark:text-sky-400">
              [EVIDENCE]
            </span>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{evidence}</p>
          </div>

          {/* RECOMMENDATION */}
          <div className="flex items-start space-x-2">
            <span className="font-bold min-w-[110px] text-[11px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              [REKOMENDASI]
            </span>
            <p className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">{recommendation}</p>
          </div>

          {/* ACTION BUTTON */}
          {actionText && (
            <div className="pt-2 flex items-center justify-end">
              <Button
                type="button"
                size="sm"
                onClick={handleActionClick}
                className="text-xs h-8 space-x-1.5 bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold cursor-pointer active:scale-95 transition-all shadow-sm"
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
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-xl w-full max-w-md p-5 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Aksi AI Dijalankan</h4>
              </div>
              <button
                onClick={() => setIsSuccessModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Aksi: <span className="text-[#3B7A57] dark:text-[#52B788]">{actionText}</span>
              </p>
              <p className="bg-slate-50 dark:bg-[#161F31] p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                {recommendation}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-400">
                Draft telah disiapkan dan data rekomendasi disinkronkan ke sistem operasional.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                onClick={() => setIsSuccessModalOpen(false)}
                className="text-xs font-bold bg-[#3B7A57] hover:bg-[#2E6044] text-white"
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
