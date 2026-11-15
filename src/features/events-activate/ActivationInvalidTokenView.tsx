import Link from "next/link";
import { AlertTriangle, LogIn, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/app/status-badge";

interface ActivationInvalidTokenViewProps {
  validationError: string;
}

export function ActivationInvalidTokenView({
  validationError,
}: ActivationInvalidTokenViewProps) {
  return (
    <Card className="max-w-md w-full mx-auto border-border shadow-xs text-center">
      <CardContent className="p-6 sm:p-8 space-y-5">
        <div className="size-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto shadow-2xs">
          <AlertTriangle className="size-8" />
        </div>

        <div className="space-y-2">
          <StatusBadge status="destructive" className="mx-auto">
            Tautan Tidak Berlaku
          </StatusBadge>

          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
            Tidak Dapat Mengaktifkan Akun
          </h2>

          <p className="text-sm text-muted-foreground leading-relaxed">
            {validationError}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link href="/login" className="flex-1">
            <Button variant="outline" size="default" className="w-full gap-2">
              <LogIn className="size-4" />
              <span>Ke Halaman Login</span>
            </Button>
          </Link>
          <Link href="/events" className="flex-1">
            <Button variant="default" size="default" className="w-full gap-2">
              <Calendar className="size-4" />
              <span>Jelajahi Event</span>
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
