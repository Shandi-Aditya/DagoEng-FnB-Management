"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-foreground">
              <div className="size-6 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Sparkles className="size-3.5" />
              </div>
              <span>Insight bisnis</span>
            </CardTitle>
            <span className="text-xs font-medium text-muted-foreground border border-border bg-muted/30 px-2 py-0.5 rounded-md shrink-0">
              Berbasis data
            </span>
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            {insightTitle}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-3.5 space-y-3 text-xs">
          {/* Temuan */}
          <div className="flex items-start gap-2">
            <span className="font-medium min-w-[96px] text-xs text-primary shrink-0">
              Temuan
            </span>
            <p className="text-foreground leading-relaxed">{insight}</p>
          </div>

          {/* Bukti data */}
          <div className="flex items-start gap-2">
            <span className="font-medium min-w-[96px] text-xs text-info shrink-0">
              Bukti data
            </span>
            <p className="text-muted-foreground leading-relaxed">{evidence}</p>
          </div>

          {/* Rekomendasi */}
          <div className="flex items-start gap-2">
            <span className="font-medium min-w-[96px] text-xs text-success shrink-0">
              Rekomendasi
            </span>
            <p className="text-foreground leading-relaxed">{recommendation}</p>
          </div>

          {/* Tombol aksi */}
          {actionText && (
            <div className="pt-2 flex items-center justify-end">
              <Button
                type="button"
                variant="default"
                size="default"
                onClick={handleActionClick}
              >
                <span>{actionText}</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Execution Feedback Dialog */}
      <Dialog open={isSuccessModalOpen} onOpenChange={setIsSuccessModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-success shrink-0" />
              <DialogTitle className="text-base font-medium text-foreground">
                Aksi rekomendasi disiapkan
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Draft tindakan operasional telah dibuat untuk ditindaklanjuti.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs text-muted-foreground py-2">
            <div className="space-y-1">
              <span className="text-muted-foreground block">Aksi terpilih</span>
              <span className="text-foreground font-medium block">
                {actionText}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-border bg-muted/20 text-foreground leading-relaxed">
              {recommendation}
            </div>

            <p className="text-xs text-muted-foreground">
              Draft telah disiapkan dan parameter rekomendasi disinkronkan ke modul terkait.
            </p>
          </div>

          <DialogFooter className="border-t border-border pt-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setIsSuccessModalOpen(false)}
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
