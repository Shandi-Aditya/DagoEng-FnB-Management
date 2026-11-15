import { Ticket } from "lucide-react";

export function TicketRecoveryHero() {
  return (
    <div className="text-center space-y-2">
      <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-2xs">
        <Ticket className="size-6" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
          Pusat Pemulihan Akses Tiket
        </h1>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Kehilangan tautan e-tiket atau lupa menyimpannya? Cari kembali tiket Anda di sini secara aman.
        </p>
      </div>
    </div>
  );
}
