"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Laptop,
  UtensilsCrossed,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { AmbientHeroBackdrop } from "./AmbientCanvas";
import {
  EventsPanel,
  FoodPanel,
  WorkspacePanel,
} from "./ShowcasePanels";

type ShowcaseId = "work" | "food" | "events";

// Each chip carries its business unit's logo colour on the icon, so the strip reads like the DagoEng mark.
const SHOWCASE_TABS: readonly {
  id: ShowcaseId;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "work",
    label: "Ruang kerja",
    icon: <Laptop className="text-unit-coworking" />,
  },
  {
    id: "food",
    label: "Makan dan minum",
    icon: <UtensilsCrossed className="text-unit-fnb" />,
  },
  {
    id: "events",
    label: "Event komunitas",
    icon: <CalendarDays className="text-unit-event" />,
  },
];

/** A word in the headline underlined in its unit colour. */
function Marked({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span
      className={`underline decoration-4 underline-offset-[0.18em] ${className}`}
    >
      {children}
    </span>
  );
}

const STAGE = "aspect-4/5 sm:aspect-16/9";

// Page-load entrance for the hero and a soft fade when a chip swaps the stage; both skip for reduced motion.
const ENTER =
  "animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 ease-out motion-reduce:animate-none";
const SWAP = "animate-in fade-in duration-300 motion-reduce:animate-none";

// The chips are the design system's outline button; the selected one takes the neutral secondary surface.
const CHIP = cn(
  buttonVariants({ variant: "outline", size: "lg" }),
  "h-9 flex-none px-3 text-sm text-muted-foreground",
  "data-active:border-foreground/25 data-active:bg-secondary data-active:text-foreground dark:data-active:bg-secondary",
);

/** Centred hero with one action, then a chip strip that switches what the stage below shows. */
export function HomeHero() {
  const [showcase, setShowcase] = useState<ShowcaseId>("work");

  return (
    <section className="mx-auto flex max-w-6xl flex-col items-center gap-10 px-4 pt-12 pb-16 sm:px-6 sm:pt-20">
      <div
        className={`flex max-w-3xl flex-col items-center gap-6 text-center ${ENTER}`}
      >
        <h1 className="text-4xl font-medium tracking-tight text-balance sm:text-6xl">
          <Marked className="decoration-unit-coworking">Kerja</Marked>,{" "}
          <Marked className="decoration-unit-fnb">makan</Marked>, dan ikuti{" "}
          <Marked className="decoration-unit-event">kegiatan</Marked> di satu
          tempat
        </h1>
        <p className="max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">
          Ruang kerja per jam, empat dapur mitra, dan event komunitas di
          Singaraja.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Button
            size="lg"
            render={<Link href="/customer?tab=COWORKING" />}
            nativeButton={false}
          >
            Pesan ruang kerja
          </Button>
          <Button
            size="lg"
            variant="ghost"
            render={<Link href="/customer?tab=MENU" />}
            nativeButton={false}
          >
            Lihat menu
          </Button>
        </div>
      </div>

      <Tabs
        value={showcase}
        onValueChange={(value) => setShowcase(value as ShowcaseId)}
        className={`w-full flex flex-col items-center gap-6 ${ENTER} delay-200`}
      >
        <TabsList className="!h-auto group-data-horizontal/tabs:!h-auto flex-wrap justify-center gap-2 bg-transparent p-0 w-full max-w-full">
          {SHOWCASE_TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className={CHIP}>
              {tab.icon}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Ambient Gradient Canvas Frame with organic aurora shapes & unit-specific palette */}
        <div className="relative w-full rounded-t-2xl sm:rounded-t-3xl rounded-b-none pt-5 px-5 pb-0 sm:pt-10 sm:px-10 sm:pb-0 lg:pt-14 lg:px-14 lg:pb-0 overflow-hidden">
          <AmbientHeroBackdrop showcase={showcase} />

          {/* Bottom dissolve overlay to page background for the ambient gradient sides */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-36 sm:h-52 bg-gradient-to-t from-background from-15% via-background/80 via-55% to-transparent z-10"
            aria-hidden="true"
          />

          <TabsContent value="work" className={`relative z-10 w-full m-0 ${SWAP}`}>
            <WorkspacePanel priority withBottomDissolve className={STAGE} />
          </TabsContent>
          <TabsContent value="food" className={`relative z-10 w-full m-0 ${SWAP}`}>
            <FoodPanel withBottomDissolve className={STAGE} />
          </TabsContent>
          <TabsContent value="events" className={`relative z-10 w-full m-0 ${SWAP}`}>
            <EventsPanel withBottomDissolve noPhoto className={STAGE} />
          </TabsContent>
        </div>
      </Tabs>
    </section>
  );
}
