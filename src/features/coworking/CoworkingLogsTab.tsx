"use client";

import { useMemo, useState } from "react";
import { History } from "lucide-react";

import { DataPagination } from "@/components/app/data-pagination";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedLogs = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return logs.slice(start, start + pageSize);
  }, [logs, safeCurrentPage, pageSize]);

  if (logs.length === 0) {
    const emptyCopy = emptyCoworkingMessage("LOGS", false);
    return (
      <EmptyState
        className="border"
        icon={<History />}
        title={emptyCopy.title}
        description={emptyCopy.description}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tamu</TableHead>
              <TableHead className="hidden sm:table-cell">Ruang</TableHead>
              <TableHead className="hidden md:table-cell">Check-in</TableHead>
              <TableHead className="hidden md:table-cell">Check-out</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Durasi</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedLogs.map((log) => {
              const isActive = log.status === "ACTIVE_IN";

              return (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-normal">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-foreground">{log.guestName}</span>
                      <span className="font-mono text-xs text-primary">{log.bookingCode}</span>
                      <span className="text-xs text-muted-foreground sm:hidden">
                        {log.spaceName} · <span className="font-mono tabular-nums">{log.durationFormatted}</span>
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="hidden sm:table-cell whitespace-normal font-medium text-foreground">
                    {log.spaceName}
                  </TableCell>

                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-col">
                      <span className="font-mono text-xs font-medium text-foreground tabular-nums">
                        {log.checkInDate} · {log.checkInTime}
                      </span>
                      <span className="text-xs text-muted-foreground">Oleh {log.checkInBy}</span>
                    </div>
                  </TableCell>

                  <TableCell className="hidden md:table-cell">
                    {log.checkoutTime ? (
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-medium text-foreground tabular-nums">
                          {log.checkoutDate} · {log.checkoutTime}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Oleh {log.checkoutBy}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-primary">
                        Sedang aktif
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="hidden sm:table-cell text-right font-mono text-xs tabular-nums text-foreground">
                    {log.durationFormatted}
                  </TableCell>

                  <TableCell>
                    <StatusBadge status={isActive ? "info" : "success"}>
                      {isActive ? "Aktif" : "Selesai"}
                    </StatusBadge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <DataPagination
        currentPage={safeCurrentPage}
        totalItems={logs.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setCurrentPage(1);
        }}
        itemLabel="aktivitas"
      />
    </div>
  );
}
