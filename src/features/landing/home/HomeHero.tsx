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
    <span className="inline-block [perspective:500px] shrink-0 align-middle">
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
        <h1 className="text-4xl font-medium tracking-tight text-balance text-center sm:text-6xl">
          <span className="inline-flex items-center gap-2 align-middle">
            <span className="text-unit-coworking">Kerja</span>
            <Hero3dBadge
              src="/kerjahero.svg"
              alt="Kerja"
              unit="coworking"
              tilt="right"
            />
          </span>{" "}
          <span className="inline-flex items-center gap-2 align-middle">
            <span className="text-unit-fnb">makan</span>
            <Hero3dBadge
              src="/makanhero.svg"
              alt="Makan"
              unit="fnb"
              tilt="left"
            />
          </span>{" "}
          <span>dan ikuti </span>
          <span className="inline-flex items-center gap-2 align-middle">
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
        className={`w-full items-center gap-4 ${ENTER} delay-200`}
      >
        <TabsList className="h-auto flex-wrap justify-center gap-2 bg-transparent p-0">
          {SHOWCASE_TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className={CHIP}>
              {tab.icon}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="work" className={`w-full ${SWAP}`}>
          <WorkspacePanel priority className={STAGE} />
        </TabsContent>
        <TabsContent value="food" className={`w-full ${SWAP}`}>
          <FoodPanel className={STAGE} />
        </TabsContent>
        <TabsContent value="events" className={`w-full ${SWAP}`}>
          <EventsPanel className={STAGE} />
        </TabsContent>
        <TabsContent value="partners" className={`w-full ${SWAP}`}>
          <PartnerPanel className={STAGE} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
