"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Laptop,
  Store,
  UtensilsCrossed,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { AmbientHeroBackdrop } from "./AmbientCanvas";
import {
  EventsPanel,
  FoodPanel,
  PartnerPanel,
  WorkspacePanel,
} from "./ShowcasePanels";

type ShowcaseId = "work" | "food" | "events" | "partners";

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
    {
      id: "partners",
      label: "Untuk mitra",
      icon: <Store className="text-unit-loyalty" />,
    },
  ];

const STAGE = "aspect-4/5 sm:aspect-16/9";

// Page-load entrance for the hero and a soft fade when a chip swaps the stage; both skip for reduced motion.
const ENTER =
  "animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 ease-out motion-reduce:animate-none";
const SWAP = "animate-in fade-in duration-300 motion-reduce:animate-none";

interface Hero3dBadgeProps {
  src: string;
  alt: string;
  unit: "coworking" | "fnb" | "event";
  tilt: "right" | "left";
}

function Hero3dBadge({ src, alt, unit, tilt }: Hero3dBadgeProps) {
  const isRight = tilt === "right";
  const bgClass =
    unit === "coworking"
      ? "bg-unit-coworking"
      : unit === "fnb"
        ? "bg-unit-fnb"
        : "bg-unit-event";

  const shadow =
    unit === "coworking"
      ? isRight
        ? "drop-shadow(1px 1.5px 0px #008fcc) drop-shadow(2px 3px 0px #006f9e)"
        : "drop-shadow(-1px 1.5px 0px #2A77CE) drop-shadow(-2px 3px 0px #124C91)"
      : unit === "fnb"
        ? isRight
          ? "drop-shadow(1px 1.5px 0px #cc5500) drop-shadow(2px 3px 0px #994000)"
          : "drop-shadow(-1px 1.5px 0px #cc5500) drop-shadow(-2px 3px 0px #994000)"
        : isRight
          ? "drop-shadow(1px 1.5px 0px #00993f) drop-shadow(2px 3px 0px #00662a)"
          : "drop-shadow(-1px 1.5px 0px #00993f) drop-shadow(-2px 3px 0px #00662a)";

  const transform = isRight
    ? "rotateX(12deg) rotateY(-18deg) rotateZ(15deg)"
    : "rotateX(12deg) rotateY(18deg) rotateZ(-15deg)";

  return (
    <span className="inline-block [perspective:500px] shrink-0 align-middle ml-1.5 sm:ml-2.5 mr-0.5 sm:mr-1 -translate-y-0.5 sm:-translate-y-1">
      <span
        className={cn(
          // lint-ui-ignore
          "inline-flex size-9 sm:size-13 lg:size-16 items-center justify-center rounded-[24%] p-1 sm:p-1.5 lg:p-2 overflow-hidden select-none transition-transform duration-300 hover:scale-115 cursor-pointer",
          bgClass,
        )}
        style={{
          transform,
          filter: shadow,
          willChange: "transform",
          transformStyle: "preserve-3d",
          backfaceVisibility: "hidden",
        }}
      >
        <img
          src={src}
          alt={alt}
          width={256}
          height={256}
          className="size-full object-contain pointer-events-none select-none scale-105 [image-rendering:-webkit-optimize-contrast]"
        />
      </span>
    </span>
  );
}

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
        className={`flex max-w-4xl flex-col items-center gap-6 text-center ${ENTER}`}
      >
        <h1 className="text-4xl font-medium tracking-tight text-balance text-center sm:text-6xl leading-[1.2] sm:leading-[1.2]">
          <span className="whitespace-nowrap">
            <span className="text-unit-coworking">Kerja</span>
            <Hero3dBadge
              src="/kerjahero.svg"
              alt="Kerja"
              unit="coworking"
              tilt="right"
            />
          </span>{" "}
          <span className="whitespace-nowrap">
            <span className="text-unit-fnb">makan</span>
            <Hero3dBadge
              src="/makanhero.svg"
              alt="Makan"
              unit="fnb"
              tilt="left"
            />
          </span>{" "}
          <span>dan ikuti </span>
          <span className="whitespace-nowrap">
            <span className="text-unit-event">kegiatan</span>
            <Hero3dBadge
              src="/kegiatanhero.svg"
              alt="Kegiatan"
              unit="event"
              tilt="right"
            />
          </span>{" "}
          <span>di satu tempat</span>
        </h1>
        <p className="max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">
          Ruang kerja per jam, 4 mitra kuliner, dan event komunitas di Singaraja.
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
        <TabsList className="h-auto flex-wrap justify-center gap-2 bg-transparent p-0">
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
          <TabsContent value="partners" className={`relative z-10 w-full m-0 ${SWAP}`}>
            <PartnerPanel withBottomDissolve className={STAGE} />
          </TabsContent>
        </div>
      </Tabs>
    </section>
  );
}
