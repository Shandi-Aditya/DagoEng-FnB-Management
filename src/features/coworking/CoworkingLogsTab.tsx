import { History } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CheckInOutLog } from "@/contexts/CoworkingContext";

import { emptyCoworkingMessage } from "./coworking-domain";

export interface CoworkingLogsTabProps {
  logs: CheckInOutLog[];
}

export function CoworkingLogsTab({ logs }: CoworkingLogsTabProps) {
  if (logs.length === 0) {
    const emptyCopy = emptyCoworkingMessage("LOGS", false);
    return (
      <EmptyState
        icon={<History className="size-8 text-muted-foreground" />}
        title={emptyCopy.title}
        description={emptyCopy.description}
      />
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Tamu</TableHead>
              <TableHead>Ruang</TableHead>
              <TableHead>Check-in</TableHead>
              <TableHead>Check-out</TableHead>
              <TableHead>Durasi</TableHead>
              <TableHead className="text-center">Status</TableHead>
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
                      <p className="font-mono text-xs text-primary">{log.bookingCode}</p>
                    </div>
                  </TableCell>

                  <TableCell className="text-xs font-medium text-foreground">
                    {log.spaceName}
                  </TableCell>

                  <TableCell>
                    <div className="space-y-0.5 text-xs">
                      <p className="font-medium text-foreground">
                        {log.checkInDate} · {log.checkInTime}
                      </p>
                      <p className="text-xs text-muted-foreground">Oleh {log.checkInBy}</p>
                    </div>
                  </TableCell>

                  <TableCell>
                    {log.checkoutTime ? (
                      <div className="space-y-0.5 text-xs">
                        <p className="font-medium text-foreground">
                          {log.checkoutDate} · {log.checkoutTime}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Oleh {log.checkoutBy}
                        </p>
                      </div>
                    ) : (
                      <span className="font-medium text-xs text-primary">
                        Sedang aktif
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="font-mono text-xs tabular-nums text-foreground">
                    {log.durationFormatted}
                  </TableCell>

                  <TableCell className="text-center">
                    <StatusBadge status={isActive ? "info" : "success"} className="text-xs">
                      {isActive ? "Aktif" : "Selesai"}
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
