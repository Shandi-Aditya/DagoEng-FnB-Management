import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/app/status-badge";

interface ActivationSuccessViewProps {
  organizerName?: string;
  email?: string;
}

export function ActivationSuccessView({
  organizerName,
  email,
}: ActivationSuccessViewProps) {
  return (
    <Card className="max-w-md w-full mx-auto border-border shadow-xs text-center">
      <CardContent className="p-6 sm:p-8 space-y-5">
        <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-2xs">
          <CheckCircle2 className="size-8" />
        </div>

        <div className="space-y-2">
          <StatusBadge status="success" className="mx-auto">
            Aktivasi Berhasil
          </StatusBadge>

          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
            Selamat Datang di DAGO!
          </h2>

          <p className="text-sm text-muted-foreground leading-relaxed">
            Akun penyelenggara Anda {organizerName ? `(${organizerName}) ` : ""}telah aktif.
            Kredensial telah diamankan dan Anda dapat langsung masuk ke portal.
          </p>
        </div>

        {email && (
          <div className="rounded-xl border border-border bg-muted/30 p-4 text-left space-y-1">
            <span className="text-xs text-muted-foreground block">Email Login Terdaftar:</span>
            <span className="font-mono text-sm font-semibold text-foreground break-all block">
              {email}
            </span>
          </div>
        )}

        <Link href="/login" className="block pt-2">
          <Button size="lg" className="w-full gap-2">
            <span>Masuk ke Halaman Login</span>
            <ArrowRight className="size-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
