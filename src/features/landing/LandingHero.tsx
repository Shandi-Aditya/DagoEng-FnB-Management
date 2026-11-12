import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HERO } from "@/features/landing/landing-content";

/** One static hero: photo, headline, two entry points. */
export function LandingHero() {
  return (
    <section className="relative isolate overflow-hidden bg-neutral-950 text-white">
      <Image src={HERO.image} alt={HERO.imageAlt} fill priority sizes="100vw" className="-z-10 object-cover opacity-45" />
      <div className="mx-auto flex min-h-[520px] max-w-6xl flex-col justify-end gap-6 px-4 pt-24 pb-14 sm:min-h-[600px] sm:px-6 sm:pb-20">
        <p className="text-sm text-white/80">Singaraja, Bali</p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{HERO.title}</h1>
        <p className="max-w-xl text-base text-white/85 sm:text-lg">{HERO.description}</p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" render={<Link href="/customer?tab=MENU" />} nativeButton={false}>
            Lihat menu
            <ArrowRight />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
            render={<Link href="/customer?tab=COWORKING" />}
            nativeButton={false}
          >
            Pesan ruang kerja
          </Button>
        </div>
      </div>
    </section>
  );
}
