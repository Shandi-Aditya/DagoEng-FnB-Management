import { Calendar, User, Mail, Clock } from "lucide-react";
import { formatActivationExpiry } from "./organizer-activation-domain";

export interface OrganizerSummaryInfo {
  name: string;
  category?: string;
  contactPerson: string;
  email: string;
}

interface ActivationOrganizerCardProps {
  organizer: OrganizerSummaryInfo;
  expiresAt?: string | null;
}

export function ActivationOrganizerCard({
  organizer,
  expiresAt,
}: ActivationOrganizerCardProps) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground flex items-center gap-1.5">
          <Calendar className="size-3.5 text-primary" />
          <span>Komunitas:</span>
        </span>
        <span className="font-semibold text-foreground truncate max-w-[200px]">
          {organizer.name}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground flex items-center gap-1.5">
          <User className="size-3.5 text-primary" />
          <span>Penanggung Jawab:</span>
        </span>
        <span className="font-medium text-foreground truncate max-w-[200px]">
          {organizer.contactPerson}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground flex items-center gap-1.5">
          <Mail className="size-3.5 text-primary" />
          <span>Email Akun:</span>
        </span>
        <span className="font-mono font-medium text-foreground truncate max-w-[200px]">
          {organizer.email}
        </span>
      </div>

      {expiresAt && (
        <div className="flex items-center justify-between pt-2 border-t border-border text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="size-3 text-warning" />
            <span>Masa Berlaku Tautan:</span>
          </span>
          <span>{formatActivationExpiry(expiresAt)}</span>
        </div>
      )}
    </div>
  );
}
