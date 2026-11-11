import { Laptop, LogOut, CalendarPlus } from "lucide-react";
import type { CoworkingSpaceItem } from "@/types/coworking";
import { formatCurrencyIDR } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { getSpaceStatusTone } from "./coworking-domain";

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
    return (
      <EmptyState
        icon={<Laptop className="size-8 text-muted-foreground" />}
        title="Belum ada ruang atau meja terdaftar"
        description="Tambahkan atau aktifkan ruang kerja melalui menu Master Data Ruangan di Pengaturan."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {spaces.map((sp) => {
        const isOccupied = sp.status === "OCCUPIED";
        const tone = getSpaceStatusTone(sp.status);

        return (
          <Card
            key={sp.id}
            className={`p-4 flex flex-col justify-between transition-colors ${
              isOccupied ? "border-info/40 bg-info/5" : ""
            }`}
          >
            <div className="space-y-3">
              {/* Space Photo Cover */}
              {sp.imageUrl ? (
                <div className="relative w-full h-36 rounded-lg overflow-hidden bg-muted border">
                  <img
                    src={sp.imageUrl}
                    alt={sp.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="relative w-full h-24 rounded-lg bg-muted border flex items-center justify-center text-muted-foreground">
                  <Laptop className="size-8 opacity-40" />
                </div>
              )}

              <div className="flex items-start justify-between gap-2 pb-2 border-b">
                <div className="min-w-0">
                  <span className="text-[10px] font-medium text-muted-foreground block">
                    {sp.type.replace("_", " ")} · {sp.area}
                  </span>
                  <h3 className="font-medium text-sm text-foreground mt-0.5 truncate">
                    {sp.name}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                    {sp.description || "Ruang kerja kondusif dengan fasilitas lengkap."}
                  </p>
                </div>
                <StatusBadge status={tone} className="shrink-0 text-xs">
                  {sp.status === "AVAILABLE" ? "Tersedia" : sp.status === "OCCUPIED" ? "Terisi" : sp.status}
                </StatusBadge>
              </div>

              <div className="py-1 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Tarif per jam</span>
                  <span className="font-mono font-medium text-foreground">
                    {formatCurrencyIDR(sp.hourlyRate)} / jam
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tarif harian</span>
                  <span className="font-mono font-medium text-foreground">
                    {formatCurrencyIDR(sp.dailyRate)} / hari
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Kapasitas</span>
                  <span>{sp.capacity} orang</span>
                </div>

                {/* Active Occupancy Details */}
                {isOccupied && sp.currentSession && (
                  <div className="mt-2 p-2.5 rounded-lg border bg-card space-y-1">
                    <div className="flex justify-between text-xs font-medium text-foreground">
                      <span>Tamu: {sp.currentSession.guestName}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {sp.currentSession.checkInTime}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {sp.currentSession.company ? `Perusahaan: ${sp.currentSession.company} · ` : ""}
                      Kode {sp.currentSession.bookingCode}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                {sp.amenities.slice(0, 2).join(" · ")}
              </span>
              {isOccupied ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onCheckout(sp.id)}
                  className="text-xs h-7 px-2.5 font-medium gap-1"
                >
                  <LogOut className="size-3.5" />
                  <span>Check-out</span>
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onBookSpace(sp.id)}
                  className="text-xs h-7 px-2.5 font-medium gap-1 text-primary border-primary/30 hover:bg-primary/5"
                >
                  <CalendarPlus className="size-3.5" />
                  <span>Book Ruang</span>
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
