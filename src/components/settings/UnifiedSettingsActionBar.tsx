"use client";

import React from "react";
import { Check, CheckCircle2, RotateCcw, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface UnifiedSettingsActionBarProps {
  isDirty: boolean;
  isSubmitting: boolean;
  onSave: () => void;
  onCancel: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  dirtyText?: string;
  cleanText?: string;
  className?: string;
  /** Extra placement classes, e.g. bottom-16 on mobile if there is bottom nav */
  positionClassName?: string;
}

export function UnifiedSettingsActionBar({
  isDirty,
  isSubmitting,
  onSave,
  onCancel,
  saveLabel = "Simpan Perubahan",
  cancelLabel = "Batalkan",
  dirtyText = "Ada perubahan yang belum disimpan",
  cleanText = "Semua pengaturan tersimpan",
  className = "",
  positionClassName = "bottom-16 lg:bottom-0",
}: UnifiedSettingsActionBarProps) {
  return (
    <div
      role="region"
      aria-label="Bilah Aksi Simpan Pengaturan"
      className={`sticky ${positionClassName} left-0 right-0 z-30 transition-all duration-200 ${className}`}
    >
      <div className="bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-xl px-4 py-3 sm:px-6 rounded-t-2xl sm:rounded-none">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Status Indicator */}
          <div className="flex items-center space-x-2 text-xs w-full sm:w-auto justify-start">
            {isDirty ? (
              <span className="flex items-center space-x-2 text-amber-700 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-800/80 animate-in fade-in">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <span>{dirtyText}</span>
              </span>
            ) : (
              <span className="flex items-center space-x-2 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{cleanText}</span>
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={!isDirty || isSubmitting}
              className="h-9 px-3.5 rounded-xl text-xs font-semibold border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center space-x-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{cancelLabel}</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={onSave}
              disabled={!isDirty || isSubmitting}
              className="h-9 px-5 rounded-xl text-xs font-bold bg-[#3B7A57] hover:bg-[#2E6044] text-white shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center space-x-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{saveLabel}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

