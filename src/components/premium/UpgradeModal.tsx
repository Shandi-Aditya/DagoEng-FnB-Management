"use client";

import React from "react";
import { X, Sparkles, CheckCircle2, ShieldCheck, Zap, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProFeatureBadge, ProBadgeVariant } from "./ProFeatureBadge";

export interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  badgeLabel?: string;
  badgeVariant?: ProBadgeVariant;
  categoryTag?: string;
  description: string;
  benefits?: string[];
  samplePlanName?: string;
  statusText?: string;
}

export function UpgradeModal({
  isOpen,
  onClose,
  title,
  badgeLabel = "ADD-ON",
  badgeVariant = "addon",
  categoryTag = "Kategori: Fitur Premium Tenant",
  description,
  benefits = [],
  samplePlanName = "Konsep Tenant Add-on",
  statusText = "Tersedia untuk Pengujian Demo",
}: UpgradeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200/90 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <ProFeatureBadge label={badgeLabel} variant={badgeVariant} size="sm" />
              <span className="text-[11px] font-semibold text-slate-500">{categoryTag}</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs text-slate-600">
          <p className="text-slate-600 leading-relaxed">{description}</p>

          {benefits.length > 0 && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
              <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>Keuntungan & Manfaat Operasional:</span>
              </p>
              <ul className="space-y-1.5 text-slate-600">
                {benefits.map((b, i) => (
                  <li key={i} className="flex items-start space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Plan Concept Card */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-purple-100 bg-purple-50/40">
            <div>
              <p className="text-[10px] text-purple-700 font-bold uppercase tracking-wider">Target Skema</p>
              <p className="font-bold text-slate-900 text-xs">{samplePlanName}</p>
            </div>
            <span className="px-2.5 py-1 bg-white border border-purple-200 rounded-lg text-[10px] font-semibold text-purple-800 shadow-2xs">
              {statusText}
            </span>
          </div>

          {/* Educational Disclaimer */}
          <div className="flex items-start space-x-2 p-3 bg-amber-50/60 border border-amber-200/70 rounded-xl text-[11px] text-amber-900">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="leading-snug">
              <strong>Catatan Konsep SaaS:</strong> Tampilan ini merupakan pratinjau informasi komersial DagoEng. Fungsionalitas sistem saat ini tetap terbuka penuh untuk demo dan tidak ada pemotongan biaya nyata.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end space-x-2">
          <Button
            type="button"
            onClick={onClose}
            className="text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-5 h-8.5 shadow-xs"
          >
            Oke, Saya Mengerti
          </Button>
        </div>
      </div>
    </div>
  );
}
