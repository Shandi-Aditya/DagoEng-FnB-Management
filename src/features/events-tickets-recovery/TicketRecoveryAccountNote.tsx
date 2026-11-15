import Link from "next/link";
import { ExternalLink } from "lucide-react";

export function TicketRecoveryAccountNote() {
  const loginUrl = `/login?returnTo=${encodeURIComponent("/customer?tab=PROFILE")}&from=events&mode=customer`;

  return (
    <div className="text-center p-4 rounded-xl border border-border bg-muted/30 text-xs text-muted-foreground space-y-1">
      <p>Sudah memiliki akun DagoEng?</p>
      <Link
        href={loginUrl}
        className="font-medium text-primary hover:underline inline-flex items-center gap-1"
      >
        <span>Masuk ke Akun DagoEng (Tiket Otomatis Muncul di Tiket Saya)</span>
        <ExternalLink className="size-3.5" />
      </Link>
    </div>
  );
}
