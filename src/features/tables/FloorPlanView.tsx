import { Grid, Users } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AreaItem, TableItem } from "@/contexts/TableContext";

import { tableStatusLabel, tableStatusTone } from "./tables-domain";

interface FloorPlanViewProps {
  areas: AreaItem[];
  outletName: string;
  onTableClick: (areaId: string, table: TableItem) => void;
}

export function FloorPlanView({ areas, outletName, onTableClick }: FloorPlanViewProps) {
  if (areas.length === 0) {
    return (
      <EmptyState
        icon={<Grid className="size-6 text-muted-foreground" />}
        title="Belum ada area meja"
        description={`Tambahkan area baru untuk outlet ${outletName} untuk mulai mengatur denah meja.`}
      />
    );
  }

  return (
    <div className="space-y-6">
      {areas.map((area) => {
        const occupied = area.tables.filter((t) => t.status === "OCCUPIED").length;

        return (
          <Card key={area.id}>
            <CardHeader className="border-b bg-muted/30 py-3">
              <CardTitle className="flex items-center justify-between text-sm font-medium">
                <span>{area.name}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {occupied} / {area.tables.length} Terisi
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {area.tables.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Belum ada meja di area ini.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {area.tables.map((t) => {
                    const isOccupied = t.status === "OCCUPIED";
                    const isReserved = t.status === "RESERVED";

                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onTableClick(area.id, t)}
                        className="flex h-32 flex-col justify-between rounded-lg border bg-card p-3.5 text-left transition-colors hover:border-foreground/30 hover:shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-sm font-medium text-foreground">
                            {t.number || t.id}
                          </span>
                          <StatusBadge status={tableStatusTone(t.status)}>
                            {tableStatusLabel(t.status)}
                          </StatusBadge>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Users className="size-3" />
                          <span>Kapasitas {t.cap} orang</span>
                        </div>

                        {isOccupied ? (
                          <div className="border-t pt-1.5 text-[11px]">
                            <p className="truncate font-medium text-foreground">
                              {t.customer || "Tamu"}
                            </p>
                            <p className="font-mono text-xs tabular-nums text-primary">
                              {t.total || "-"}
                            </p>
                          </div>
                        ) : isReserved ? (
                          <div className="border-t pt-1.5 text-[11px]">
                            <p className="truncate font-medium text-foreground">{t.customer}</p>
                            <p className="font-mono text-xs text-muted-foreground">{t.time}</p>
                          </div>
                        ) : (
                          <div className="border-t pt-1 text-[11px] text-muted-foreground">
                            Klik untuk opsi
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
