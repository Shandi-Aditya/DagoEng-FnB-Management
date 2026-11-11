import { CalendarPlus, Laptop, LogOut } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CoworkingSpaceItem } from "@/types/coworking";
import { formatCurrencyIDR } from "@/lib/utils";

import {
  emptyCoworkingMessage,
  getSpaceStatusTone,
  spaceTypeLabel,
} from "./coworking-domain";

export interface CoworkingSpacesTabProps {
  spaces: CoworkingSpaceItem[];
  onBookSpace: (spaceId: string) => void;
  onCheckout: (spaceId: string) => void;
}

export function CoworkingSpacesTab({
  spaces,
  onBookSpace,
  onCheckout,
}: CoworkingSpacesTabProps) {
  if (spaces.length === 0) {
    const emptyCopy = emptyCoworkingMessage("SPACES", false);
    return (
      <EmptyState
        icon={<Laptop className="size-8 text-muted-foreground" />}
        title={emptyCopy.title}
        description={emptyCopy.description}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {spaces.map((sp) => {
        const isOccupied = sp.status === "OCCUPIED";
        const tone = getSpaceStatusTone(sp.status);

        return (
          <Card
            key={sp.id}
            className={`flex flex-col justify-between p-4 transition-colors ${
              isOccupied ? "border-info/40 bg-info/5" : ""
            }`}
          >
            <div className="space-y-3">
              {/* Space Photo Cover */}
              {sp.imageUrl ? (
                <div className="relative h-36 w-full overflow-hidden rounded-lg border bg-muted">
                  <img
                    src={sp.imageUrl}
                    alt={sp.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="relative flex h-24 w-full items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                  <Laptop className="size-8 opacity-40" />
                </div>
              )}

              <div className="flex items-start justify-between gap-2 border-b pb-2">
                <div className="min-w-0">
                  <span className="block text-xs font-medium text-muted-foreground">
                    {spaceTypeLabel(sp.type)} · {sp.area}
                  </span>
                  <h3 className="mt-0.5 truncate text-sm font-medium text-foreground">
                    {sp.name}
                  </h3>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {sp.description || "Ruang kerja dengan fasilitas standar."}
                  </p>
                </div>
                <StatusBadge status={tone} className="shrink-0 text-xs">
                  {sp.status === "AVAILABLE" ? "Tersedia" : sp.status === "OCCUPIED" ? "Terisi" : sp.status}
                </StatusBadge>
              </div>

              <div className="space-y-1.5 py-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Tarif per jam</span>
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {formatCurrencyIDR(sp.hourlyRate)} / jam
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tarif harian</span>
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {formatCurrencyIDR(sp.dailyRate)} / hari
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Kapasitas</span>
                  <span>{sp.capacity} orang</span>
                </div>

                {/* Active Occupancy Details */}
                {isOccupied && sp.currentSession && (
                  <div className="mt-2 space-y-1 rounded-lg border bg-card p-2.5">
                    <div className="flex justify-between text-xs font-medium text-foreground">
                      <span>Tamu: {sp.currentSession.guestName}</span>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {sp.currentSession.checkInTime}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {sp.currentSession.company ? `Perusahaan: ${sp.currentSession.company} · ` : ""}
                      Kode {sp.currentSession.bookingCode}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t pt-3">
              <span className="max-w-[150px] truncate text-xs text-muted-foreground">
                {sp.amenities.slice(0, 2).join(" · ")}
              </span>
              {isOccupied ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onCheckout(sp.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <LogOut />
                  <span>Check-out</span>
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onBookSpace(sp.id)}
                >
                  <CalendarPlus />
                  <span>Booking ruang</span>
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
