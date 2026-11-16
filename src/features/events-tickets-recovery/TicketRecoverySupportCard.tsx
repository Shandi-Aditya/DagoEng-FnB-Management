import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DEFAULT_CS_WHATSAPP_NUMBER,
  buildSupportWhatsAppUrl,
} from "./ticket-recovery-domain";

interface TicketRecoverySupportCardProps {
  csWhatsappNumber?: string;
  email?: string;
}

export function TicketRecoverySupportCard({
  csWhatsappNumber = DEFAULT_CS_WHATSAPP_NUMBER,
  email,
}: TicketRecoverySupportCardProps) {
  const waUrl = buildSupportWhatsAppUrl(csWhatsappNumber, email);

  return (
    <Card className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-border bg-card/60">
      <div className="flex items-start gap-3.5">
        <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <MessageCircle className="size-5" />
        </div>
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">
            Butuh Bantuan Langsung dari Admin Acara?
          </p>
          <p className="text-xs text-muted-foreground">
            Hubungi Customer Service Dago Hub via WhatsApp untuk verifikasi manual tiket Anda.
          </p>
        </div>
      </div>

      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full sm:w-auto shrink-0"
      >
        <Button
          type="button"
          variant="outline"
          size="default"
          className="w-full sm:w-auto gap-2"
        >
          <MessageCircle className="size-4" />
          <span>Chat WhatsApp Hub</span>
        </Button>
      </a>
    </Card>
  );
}
