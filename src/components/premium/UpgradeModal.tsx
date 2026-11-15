"use client";

import React from "react";
import { Sparkles, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ProFeatureBadge, ProBadgeVariant } from "./ProFeatureBadge";
import { formatFeatureBenefits, getSamplePlanStatusLabel } from "./premium-domain";

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
  onConfirmInterest?: () => void;
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
  statusText,
  onConfirmInterest,
}: UpgradeModalProps) {
  const formattedBenefits = formatFeatureBenefits(benefits);
  const planStatus = getSamplePlanStatusLabel(statusText);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg space-y-4">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <ProFeatureBadge label={badgeLabel} variant={badgeVariant} size="sm" />
            <span className="text-xs text-muted-foreground">{categoryTag}</span>
          </div>
          <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1">
          {formattedBenefits.length > 0 && (
            <div className="rounded-xl border border-border bg-muted/40 p-3.5 space-y-2.5">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                <span>Keuntungan dan Manfaat Operasional</span>
              </p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {formattedBenefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="size-3.5 text-primary shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Plan Concept Card */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card">
            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground block">Target Skema</span>
              <p className="font-semibold text-foreground text-xs">{samplePlanName}</p>
            </div>
            <span className="px-2.5 py-1 bg-muted rounded-lg text-xs font-medium text-foreground">
              {planStatus}
            </span>
          </div>

          {/* Educational Disclaimer */}
          <div className="flex items-start gap-2.5 p-3.5 bg-muted/30 border border-border rounded-xl text-xs text-muted-foreground">
            <Info className="size-4 text-primary shrink-0 mt-0.5" />
            <p className="leading-snug">
              <span className="font-medium text-foreground">Catatan Konsep SaaS: </span>
              Tampilan ini merupakan pratinjau informasi komersial DagoEng.
              Fungsionalitas sistem saat ini tetap terbuka penuh untuk demo dan tidak ada pemotongan biaya nyata.
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            <span>Tutup</span>
          </Button>
          <Button
            type="button"
            variant="default"
            size="default"
            onClick={() => {
              if (onConfirmInterest) {
                onConfirmInterest();
              } else {
                onClose();
              }
            }}
            className="w-full sm:w-auto"
          >
            <span>Ajukan Minat Fitur</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
