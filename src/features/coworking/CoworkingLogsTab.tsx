import { History } from "lucide-react";
import type { CheckInOutLog } from "@/contexts/CoworkingContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";

export interface CoworkingLogsTabProps {
  logs: CheckInOutLog[];
}

export function CoworkingLogsTab({ logs }: CoworkingLogsTabProps) {
  if (logs.length === 0) {
    return (
      <EmptyState
        icon={<History className="size-8 text-muted-foreground" />}
        title="Belum ada riwayat aktivitas"
        description="Aktivitas check-in dan check-out tamu akan tercatat secara otomatis di sini."
      />
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Tamu & Kode Booking</TableHead>
              <TableHead>Ruang / Meja</TableHead>
              <TableHead>Waktu Check-In & PIC</TableHead>
              <TableHead>Waktu Check-Out & PIC</TableHead>
              <TableHead>Durasi Pemakaian</TableHead>
              <TableHead className="text-center">Status Sesi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => {
              const isActive = log.status === "ACTIVE_IN";

              return (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">
                    <div className="space-y-0.5">
                      <p className="text-foreground">{log.guestName}</p>
                      <p className="font-mono text-primary text-[11px]">{log.bookingCode}</p>
                    </div>
                  </TableCell>

                  <TableCell className="font-medium text-foreground text-xs">
                    {log.spaceName}
                  </TableCell>

                  <TableCell>
                    <div className="space-y-0.5 text-xs">
                      <p className="font-medium text-foreground">
                        {log.checkInDate} · {log.checkInTime}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Oleh {log.checkInBy}</p>
                    </div>
                  </TableCell>

                  <TableCell>
                    {log.checkoutTime ? (
                      <div className="space-y-0.5 text-xs">
                        <p className="font-medium text-foreground">
                          {log.checkoutDate} · {log.checkoutTime}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Oleh {log.checkoutBy}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-primary font-medium italic">
                        Sedang Aktif
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="font-mono text-xs tabular-nums text-foreground">
                    {log.durationFormatted}
                  </TableCell>

                  <TableCell className="text-center">
                    <StatusBadge status={isActive ? "info" : "success"} className="text-xs">
                      {isActive ? "Aktif di Lokasi" : "Selesai"}
                    </StatusBadge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
