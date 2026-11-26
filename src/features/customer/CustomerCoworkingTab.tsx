"use client";

import { useState } from "react";
import { Award, Check, Laptop, Users } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyIDR } from "@/lib/utils";
import type { CoworkingMembershipPlan, CoworkingSpaceItem } from "@/types/coworking";

import { spaceTypeLabel } from "./customer-domain";
import { SpacePhotoThumbnail } from "@/features/coworking/SpacePhotoThumbnail";
import { getSpaceImageUrl, resolveSpaceCapacity } from "@/features/coworking/coworking-domain";

export interface CustomerCoworkingTabProps {
  spaces: CoworkingSpaceItem[];
  membershipPlans: CoworkingMembershipPlan[];
  onOpenBookingModal: (space: CoworkingSpaceItem) => void;
  onOpenMembershipModal?: (plan: CoworkingMembershipPlan) => void;
}

export function CustomerCoworkingTab({
  spaces,
  membershipPlans,
  onOpenBookingModal,
  onOpenMembershipModal,
}: CustomerCoworkingTabProps) {
  const [filterType, setFilterType] = useState<string>("ALL");

  const filteredSpaces = spaces.filter((sp) => {
    if (filterType !== "ALL" && sp.type !== filterType) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header & Filter Tipe Ruang */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-medium text-foreground">Sewa ruang kerja & meja</h2>
          <p className="text-xs text-muted-foreground">
            Akses internet berkecepatan tinggi, stopkontak, dan suasana kolaboratif.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={filterType === "ALL" ? "secondary" : "outline"}
            onClick={() => setFilterType("ALL")}
            className={filterType === "ALL" ? "border-foreground/20 font-medium" : "text-muted-foreground"}
          >
            Semua
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filterType === "OPEN_SPACE" ? "secondary" : "outline"}
            onClick={() => setFilterType("OPEN_SPACE")}
            className={filterType === "OPEN_SPACE" ? "border-foreground/20 font-medium" : "text-muted-foreground"}
          >
            Open space
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filterType === "SPACE_MONITOR" ? "secondary" : "outline"}
            onClick={() => setFilterType("SPACE_MONITOR")}
            className={filterType === "SPACE_MONITOR" ? "border-foreground/20 font-medium" : "text-muted-foreground"}
          >
            Space monitor
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filterType === "SMALL_MEETING_ROOM" ? "secondary" : "outline"}
            onClick={() => setFilterType("SMALL_MEETING_ROOM")}
            className={filterType === "SMALL_MEETING_ROOM" ? "border-foreground/20 font-medium" : "text-muted-foreground"}
          >
            Small meeting
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filterType === "LARGE_MEETING_ROOM" ? "secondary" : "outline"}
            onClick={() => setFilterType("LARGE_MEETING_ROOM")}
            className={filterType === "LARGE_MEETING_ROOM" ? "border-foreground/20 font-medium" : "text-muted-foreground"}
          >
            Large meeting
          </Button>
        </div>
      </div>

      {/* 2. Grid Ruang Kerja */}
      {filteredSpaces.length === 0 ? (
        <EmptyState
          className="border"
          icon={<Laptop />}
          title="Ruang tidak ditemukan"
          description="Tidak ada ruang kerja yang sesuai dengan filter pilihan Anda."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {filteredSpaces.map((space) => {
            const isShared = resolveSpaceCapacity(space) > 1;
            const isAvailable =
              space.status === "AVAILABLE" || (isShared && space.status === "RESERVED");

            return (
              <Card key={space.id} className="flex flex-col justify-between overflow-hidden shadow-xs hover:border-foreground/25 transition-colors">
                <div className="flex flex-col">
                  {/* Foto Ruang */}
                  <div className="relative w-full border-b">
                    <SpacePhotoThumbnail
                      src={getSpaceImageUrl(space)}
                      alt={space.name}
                      aspectRatio="aspect-video"
                      className="rounded-none"
                    />
                    <div className="absolute top-2.5 right-2.5">
                      <Badge variant="secondary" className="backdrop-blur-md bg-background/80 shadow-xs font-normal">
                        {spaceTypeLabel(space.type)}
                      </Badge>
                    </div>
                  </div>

                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-base font-medium">{space.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1.5 text-xs mt-0.5">
                      <Users className="size-3.5 text-muted-foreground" />
                      <span>Kapasitas {space.capacity} orang</span>
                      {space.area ? <span>· {space.area}</span> : null}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-4 pt-1 flex flex-col gap-3 text-xs">
                    {/* Fasilitas */}
                    {space.amenities && space.amenities.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {space.amenities.slice(0, 3).map((item, i) => (
                          <span
                            key={i}
                            className="rounded-md border bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                </div>

                <div className="flex items-center justify-between border-t p-4 pt-3 bg-muted/10">
                  <div className="flex flex-col">
                    {space.tieredRates && space.tieredRates.length > 0 ? (
                      <>
                        <span className="font-mono text-base font-medium text-foreground tabular-nums">
                          {formatCurrencyIDR(space.tieredRates[0].price)}
                          <span className="text-xs font-normal text-muted-foreground">
                            /{space.tieredRates[0].hours} jam
                          </span>
                        </span>
                        <span className="font-mono text-xs text-muted-foreground tabular-nums">
                          Mulai {space.tieredRates.map((t) => `${t.hours}j`).join(" · ")}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-mono text-base font-medium text-foreground tabular-nums">
                          {formatCurrencyIDR(space.hourlyRate)}
                          <span className="text-xs font-normal text-muted-foreground">/jam</span>
                        </span>
                        {space.dailyRate ? (
                          <span className="font-mono text-xs text-muted-foreground tabular-nums">
                            {formatCurrencyIDR(space.dailyRate)}/hari
                          </span>
                        ) : null}
                      </>
                    )}
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    disabled={!isAvailable}
                    onClick={() => onOpenBookingModal(space)}
                  >
                    <span>
                      {isAvailable
                        ? "Pesan ruang"
                        : space.status === "MAINTENANCE"
                        ? "Pemeliharaan"
                        : "Penuh"}
                    </span>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 3. Paket Keanggotaan Co-Working */}
      {membershipPlans && membershipPlans.length > 0 ? (
        <div className="flex flex-col gap-3 pt-4 border-t">
          <div>
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Award className="size-4 text-muted-foreground" />
              <span>Paket membership bulanan</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Akses fleksibel tanpa repot bayar harian.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {membershipPlans.map((plan) => (
              <Card key={plan.id} className="flex flex-col justify-between overflow-hidden">
                <div className="flex flex-col">
                  <SpacePhotoThumbnail
                    src={getSpaceImageUrl(plan)}
                    alt={plan.name}
                    aspectRatio="aspect-video"
                    className="border-b rounded-none"
                  />
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">{plan.name}</CardTitle>
                      <Badge variant="secondary">{plan.billingCycle}</Badge>
                    </div>
                    <span className="font-mono text-base font-medium text-foreground tabular-nums mt-1 block">
                      {plan.priceFormatted}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">{plan.deskAccess}</p>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                      {plan.amenities?.map((item, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <Check className="size-3 text-success shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </div>
                {onOpenMembershipModal ? (
                  <div className="border-t p-4 pt-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => onOpenMembershipModal(plan)}
                    >
                      Pilih paket
                    </Button>
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
