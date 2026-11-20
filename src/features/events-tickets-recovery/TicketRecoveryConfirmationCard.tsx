import React from "react";
import { CheckCircle2, MessageCircle, Mail, AlertCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buildSupportWhatsAppUrl, type RecoveryChannel } from "./ticket-recovery-domain";

interface TicketRecoveryConfirmationCardProps {
  channel: RecoveryChannel;
  target?: string;
  configured: boolean;
  message: string;
  csWhatsappNumber: string;
  onReset: () => void;
}

export function TicketRecoveryConfirmationCard({
  channel,
  target,
  configured,
  message,
  csWhatsappNumber,
  onReset,
}: TicketRecoveryConfirmationCardProps) {
  const isWhatsApp = channel === "whatsapp";

  return (
    <div className="space-y-4 pt-1 animate-in fade-in-50 duration-200">
      <div className="p-5 rounded-xl border border-border bg-card/80 space-y-4 shadow-xs">
        {/* Header Status */}
        <div className="flex items-start gap-3">
          <div
            className={`p-2.5 rounded-lg shrink-0 ${
              configured ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            {configured ? (
              <CheckCircle2 className="size-5" />
            ) : (
              <AlertCircle className="size-5" />
            )}
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              {configured
                ? isWhatsApp
                  ? "Tautan e-tiket dikirim via WhatsApp"
                  : "Tautan e-tiket dikirim via email"
                : "Layanan pengiriman belum tersedia"}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        {/* Masked Recipient Pill */}
        {target && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/60 text-xs">
            {isWhatsApp ? (
              <MessageCircle className="size-4 text-primary shrink-0" />
            ) : (
              <Mail className="size-4 text-primary shrink-0" />
            )}
            <span className="text-muted-foreground">Tujuan:</span>
            <span className="font-mono font-medium text-foreground">{target}</span>
          </div>
        )}

        {/* Security Assurance */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-background/50 border border-border/40 text-xs text-muted-foreground leading-relaxed">
          <ShieldCheck className="size-4 text-primary shrink-0 mt-0.5" />
          <span>
            Demi menjaga keamanan barcode tiket Anda dari penyalahgunaan pihak lain,
            e-tiket hanya dapat dibuka melalui tautan privat yang dikirimkan langsung
            ke kontak resmi pemesan.
          </span>
        </div>

        {/* Unconfigured Gateway Escalation CTA */}
        {!configured && (
          <Alert className="border-border bg-muted/30 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="size-4 text-muted-foreground shrink-0 mt-0.5" />
              <AlertDescription className="text-xs text-foreground">
                Layanan pengiriman otomatis {isWhatsApp ? "WhatsApp" : "Email"} saat ini belum aktif.
                Silakan hubungi Customer Service resmi untuk menerima tautan tiket Anda secara manual.
              </AlertDescription>
            </div>
            <div className="pt-2 border-t border-border/40">
              <a
                href={buildSupportWhatsAppUrl(csWhatsappNumber)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                <MessageCircle className="size-3.5" />
                <span>Hubungi CS WhatsApp resmi</span>
              </a>
            </div>
          </Alert>
        )}

        {/* Action Button to reset / query again */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReset}
          className="w-full gap-2"
        >
          <RefreshCw className="size-3.5" />
          <span>Kirim ulang atau cari tiket lain</span>
        </Button>
      </div>
    </div>
  );
}
