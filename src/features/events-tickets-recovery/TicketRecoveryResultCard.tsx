import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/status-badge";
import { getRecoveryStatusMeta } from "./ticket-recovery-domain";

export interface RecoveredBookingItem {
  id: string;
  ticketCode: string;
  eventTitle: string;
  eventDate?: string;
  eventLocation?: string;
  guestName?: string;
  guestEmail?: string;
  ticketCount: number;
  paymentStatus: string;
  guestToken?: string;
}

interface TicketRecoveryResultCardProps {
  booking: RecoveredBookingItem;
  buttonLabel?: string;
}

export function TicketRecoveryResultCard({
  booking,
  buttonLabel = "Buka E-Tiket Saya",
}: TicketRecoveryResultCardProps) {
  const statusMeta = getRecoveryStatusMeta(booking.paymentStatus);

  return (
    <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3 shadow-2xs">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-medium text-foreground line-clamp-1">
            {booking.eventTitle}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono font-medium text-foreground">
              {booking.ticketCode}
            </span>
            <span>•</span>
            <span>{booking.ticketCount} Tiket</span>
          </div>
        </div>

        <StatusBadge status={statusMeta.tone}>
          {statusMeta.label}
        </StatusBadge>
      </div>

      {booking.guestToken ? (
        <Link href={`/events/tickets/${booking.guestToken}`} className="block">
          <Button variant="default" size="default" className="w-full gap-2">
            <span>{buttonLabel}</span>
            <ExternalLink className="size-4" />
          </Button>
        </Link>
      ) : (
        <div className="p-3 rounded-lg border border-border bg-muted/40 text-xs text-muted-foreground">
          <span>Tunjukkan Kode Booking </span>
          <span className="font-mono font-medium text-foreground">{booking.ticketCode}</span>
          <span> saat registrasi di lokasi event.</span>
        </div>
      )}
    </div>
  );
}
