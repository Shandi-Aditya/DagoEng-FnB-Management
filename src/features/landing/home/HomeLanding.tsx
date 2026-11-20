import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  Clock,
  Laptop,
  Mail,
  MapPin,
  MessageCircle,
  UtensilsCrossed,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  ADDRESS,
  EMAIL,
  EVENT_FEATURES,
  FOOD_FEATURES,
  HOURS,
  INSTAGRAM,
  KITCHENS,
  MAP_URL,
  WHATSAPP_DISPLAY,
  WHATSAPP_URL,
  WORK_FEATURES,
} from "./home-content";
import { AmbientUnitFrame, type UnitTheme } from "./AmbientCanvas";
import { BrandRings } from "./BrandRings";
import { HomeHero } from "./HomeHero";
import { HomeNav } from "./HomeNav";
import { Reveal } from "./Reveal";
import { EventsPanel, FoodPanel, WorkspacePanel } from "./ShowcasePanels";

const SECTION = "mx-auto max-w-6xl px-4 sm:px-6";
const SPLIT_STAGE = "aspect-4/5 sm:aspect-[5/4]";

// Static class names so Tailwind can detect them: each tile takes its business unit's logo colour.
const SUMMARY: readonly {
  href: string;
  icon: React.ReactNode;
  tile: string;
  title: string;
  line: string;
}[] = [
  {
    href: "#kerja",
    icon: <Laptop />,
    tile: "bg-unit-coworking/15 text-unit-coworking",
    title: "Ruang kerja",
    line: "Hot desk, audio pod, dan meeting room yang dipesan per jam.",
  },
  {
    href: "#makan",
    icon: <UtensilsCrossed />,
    tile: "bg-unit-fnb/15 text-unit-fnb",
    title: "Makan dan minum",
    line: "Pesan menu dari 4 mitra yang menggunakan sistem POS kami.",
  },
  {
    href: "#event",
    icon: <CalendarDays />,
    tile: "bg-unit-event/15 text-unit-event",
    title: "Event komunitas",
    line: "Workshop dan meetup dari komunitas sekitar, dengan tiket online.",
  },
];

const KITCHEN_DOT: readonly string[] = [
  "bg-unit-fnb",
  "bg-unit-coworking",
  "bg-unit-event",
  "bg-unit-loyalty",
];

const STAGGER = 130;

const LIFT =
  "transition-[translate,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md";

function Summary() {
  return (
    <section
      className={`${SECTION} grid gap-4 pb-20 md:grid-cols-3`}
      aria-label="Yang ada di Dago Creative Hub"
    >
      {SUMMARY.map((item, index) => (
        <Reveal key={item.href} delay={index * STAGGER} className="h-full">
          <a
            href={item.href}
            className={`flex h-full flex-col gap-3 rounded-xl border bg-card p-6 ${LIFT}`}
          >
            <span
              className={`flex size-10 items-center justify-center rounded-lg [&_svg]:size-5 ${item.tile}`}
            >
              {item.icon}
            </span>
            <span className="font-medium">{item.title}</span>
            <span className="text-sm text-muted-foreground">{item.line}</span>
          </a>
        </Reveal>
      ))}
    </section>
  );
}

function KitchenStrip() {
  return (
    <section
      className="border-y bg-muted/40 py-12"
      aria-labelledby="kitchens-title"
    >
      <div className={`${SECTION} flex flex-col items-center gap-8`}>
        <Reveal>
          <h2
            id="kitchens-title"
            className="text-center text-sm text-muted-foreground"
          >
            Empat mitra aktif menggunakan layanan POS di sistem ini
          </h2>
        </Reveal>
        <ul className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
          {KITCHENS.map((kitchen, index) => (
            <li key={kitchen} className="list-none">
              <Reveal delay={index * 110}>
                <div className="flex items-center gap-3 text-2xl font-medium tracking-tight">
                  <span
                    className={`size-3 rounded-full ${KITCHEN_DOT[index % KITCHEN_DOT.length]}`}
                    aria-hidden
                  />
                  {kitchen}
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

interface FeatureSplitProps {
  id: string;
  unit: UnitTheme;
  title: string;
  line: string;
  features: readonly string[];
  action: { href: string; label: string };
  children: React.ReactNode;
}

function FeatureSplit({
  id,
  unit,
  title,
  line,
  features,
  action,
  children,
}: FeatureSplitProps) {
  return (
    <section
      id={id}
      className={`${SECTION} grid scroll-mt-20 items-center gap-10 py-16 lg:grid-cols-[5fr_7fr] lg:gap-16 lg:py-24 overflow-hidden`}
      aria-labelledby={`${id}-title`}
    >
      <div className="flex flex-col items-start gap-6 min-w-0 w-full">
        <Reveal delay={60} duration={950}>
          <div className="flex flex-col gap-3">
            <h2
              id={`${id}-title`}
              className="text-3xl font-medium tracking-tight text-balance sm:text-5xl"
            >
              {title}
            </h2>
            <p className="text-base text-pretty text-muted-foreground sm:text-lg">
              {line}
            </p>
          </div>
        </Reveal>

        <Reveal delay={160} duration={950}>
          <ul className="flex flex-wrap gap-2" aria-label="Yang termasuk">
            {features.map((feature) => (
              <li key={feature}>
                <Badge variant="outline">{feature}</Badge>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={240} duration={950}>
          <Button
            size="lg"
            render={<Link href={action.href} />}
            nativeButton={false}
          >
            {action.label}
          </Button>
        </Reveal>
      </div>

      <Reveal
        delay={120}
        duration={1050}
        className="relative isolate min-w-0 w-full"
      >
        <AmbientUnitFrame unit={unit}>{children}</AmbientUnitFrame>
      </Reveal>
    </section>
  );
}

function InstagramIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function Visit() {
  const facts: readonly {
    icon: React.ReactNode;
    title: string;
    body: React.ReactNode;
  }[] = [
    {
      icon: <MapPin />,
      title: "Alamat",
      body: (
        <>
          {ADDRESS}.{" "}
          <a
            href={MAP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Buka di peta
          </a>
        </>
      ),
    },
    { icon: <Clock />, title: "Jam buka", body: HOURS },
    {
      icon: <MessageCircle />,
      title: "WhatsApp CS",
      body: (
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground underline underline-offset-4"
        >
          {WHATSAPP_DISPLAY}
        </a>
      ),
    },
    {
      icon: <Mail />,
      title: "Email",
      body: (
        <a
          href={`mailto:${EMAIL}`}
          className="font-medium text-foreground underline underline-offset-4"
        >
          {EMAIL}
        </a>
      ),
    },
    {
      icon: <InstagramIcon />,
      title: "Instagram",
      body: (
        <a
          href={INSTAGRAM.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground underline underline-offset-4"
        >
          {INSTAGRAM.handle}
        </a>
      ),
    },
  ];

  return (
    <section
      id="kunjungi"
      className={`${SECTION} flex scroll-mt-20 flex-col items-center gap-12 border-t py-16 lg:py-24`}
      aria-labelledby="kunjungi-title"
    >
      <Reveal>
        <h2
          id="kunjungi-title"
          className="text-center text-3xl font-medium tracking-tight sm:text-5xl"
        >
          Mampir ke Dago Creative Hub
        </h2>
      </Reveal>
      <div className="grid w-full gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map((fact, index) => (
          <Reveal
            key={fact.title}
            delay={index * STAGGER}
            className="flex flex-col gap-2"
          >
            <span className="flex items-center gap-2 font-medium [&_svg]:size-4 [&_svg]:text-muted-foreground">
              {fact.icon}
              {fact.title}
            </span>
            <p className="text-sm text-muted-foreground">{fact.body}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section
      className="relative isolate overflow-hidden border-t bg-muted/40 py-24"
      aria-labelledby="closing-title"
    >
      <BrandRings className="absolute top-1/2 -left-24 -z-10 hidden h-[140%] -translate-y-1/2 opacity-25 md:block" />
      <BrandRings className="absolute top-1/2 -right-24 -z-10 hidden h-[140%] -translate-y-1/2 rotate-180 opacity-25 md:block" />
      <div
        className={`${SECTION} flex flex-col items-center gap-6 text-center`}
      >
        <Reveal delay={60} duration={950}>
          <h2
            id="closing-title"
            className="text-3xl font-medium tracking-tight text-balance sm:text-5xl"
          >
            Meja Anda sudah menunggu
          </h2>
        </Reveal>
        <Reveal delay={140} duration={950}>
          <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
            Pesan ruang kerja dari ponsel, lalu datang dan mulai bekerja.
          </p>
        </Reveal>
        <Reveal delay={220} duration={950}>
          <Button
            size="lg"
            render={<Link href="/customer?tab=COWORKING" />}
            nativeButton={false}
          >
            Pesan ruang kerja
          </Button>
        </Reveal>
      </div>
    </section>
  );
}

const FOOTER_COLUMNS: readonly {
  title: string;
  links: readonly { href: string; label: string }[];
}[] = [
  {
    title: "Tamu",
    links: [
      { href: "/customer?tab=MENU", label: "Menu" },
      { href: "/customer?tab=COWORKING", label: "Ruang kerja" },
      { href: "/customer?tab=LOYALTY", label: "Program member" },
      { href: "/events/tickets/recovery", label: "Cari tiket" },
    ],
  },
  {
    title: "Mitra",
    links: [
      { href: "/login", label: "Masuk" },
      { href: "/events/portal", label: "Portal penyelenggara" },
    ],
  },
  {
    title: "Event",
    links: [
      { href: "/events", label: "Semua event" },
      { href: "#event", label: "Event berikutnya" },
    ],
  },
];

function Footer() {
  return (
    <footer className="relative overflow-hidden border-t bg-muted/20 text-foreground pt-14 pb-4 sm:pt-20 sm:pb-8">
      {/* 1. Multi-Column Navigation */}
      <Reveal delay={80}>
        <div
          className={`${SECTION} grid gap-10 pb-12 sm:pb-16 md:grid-cols-[2fr_1fr_1fr_1fr]`}
        >
          <div className="flex flex-col gap-4">
            <Link
              href="/"
              className="flex items-center gap-2.5 font-semibold text-lg tracking-tight"
            >
              <Image
                src="/logo-dagoeng.svg"
                alt="DagoEng Logo"
                width={22}
                height={28}
              />
              Dago Creative Hub
            </Link>
            <p className="max-w-xs text-sm text-muted-foreground leading-relaxed">
              {ADDRESS}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="size-3.5 text-unit-coworking" />
              <span>{HOURS}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MessageCircle className="size-3.5 text-primary" />
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                CS: {WHATSAPP_DISPLAY}
              </a>
            </div>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <nav
              key={column.title}
              aria-labelledby={`foot-${column.title}`}
              className="flex flex-col gap-3"
            >
              <h2
                id={`foot-${column.title}`}
                className="text-sm font-semibold text-foreground"
              >
                {column.title}
              </h2>
              <ul className="flex flex-col gap-2.5 text-sm text-muted-foreground">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </Reveal>

      {/* 2. Divider */}
      <div className={`${SECTION}`}>
        <div className="border-t border-border/60" />
      </div>

      {/* 3. Bottom Copyright */}
      <Reveal delay={120}>
        <div
          className={`${SECTION} flex flex-col items-center justify-between gap-3 py-6 text-xs text-muted-foreground sm:flex-row`}
        >
          <p>© 2026 Dago Creative Hub. Seluruh hak cipta dilindungi.</p>
        </div>
      </Reveal>

      {/* 4. Giant Monumental Wordmark Watermark at the Bottom */}
      <Reveal delay={160} duration={1200} withScale={false}>
        <div
          className="relative -mb-6 sm:-mb-10 md:-mb-16 flex select-none justify-center overflow-hidden pointer-events-none"
          aria-hidden="true"
        >
          <span className="text-[17vw] font-semibold tracking-tighter leading-none text-foreground/[0.04] dark:text-foreground/[0.05] whitespace-nowrap">
            DAGOENG
          </span>
        </div>
      </Reveal>
    </footer>
  );
}

/** Public landing page, laid out like a product site: hero with a switchable stage, feature splits, roles, visit. */
export function HomeLanding() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <HomeNav />
      <main>
        <HomeHero />
        <Summary />
        <KitchenStrip />
        <FeatureSplit
          id="kerja"
          unit="work"
          title="Kerja nyaman, bayar per jam"
          line="Pilih ruang, pesan jamnya dari ponsel, lalu datang. Internet fiber dan air minum gratis di semua ruang."
          features={WORK_FEATURES}
          action={{
            href: "/customer?tab=COWORKING",
            label: "Pesan ruang kerja",
          }}
        >
          <WorkspacePanel className={SPLIT_STAGE} compact />
        </FeatureSplit>
        <FeatureSplit
          id="makan"
          unit="food"
          title="Empat dapur mitra di satu meja"
          line="Nikmati beragam pilihan makanan dan minuman. Pesan dengan mudah langsung dari ponsel kamu"
          features={FOOD_FEATURES}
          action={{ href: "/customer?tab=MENU", label: "Lihat menu" }}
        >
          <FoodPanel className={SPLIT_STAGE} compact />
        </FeatureSplit>
        <FeatureSplit
          id="event"
          unit="events"
          title="Ikuti event atau kelola event"
          line="Platform event komunitas di Singaraja. Peserta bisa pesan tiket online, sementara penyelenggara mengelola penjualan tiket, pembayaran, hingga check-in QR."
          features={EVENT_FEATURES}
          action={{ href: "/events", label: "Lihat event" }}
        >
          <EventsPanel className={SPLIT_STAGE} noPhoto />
        </FeatureSplit>
        <Visit />
        <ClosingCta />
      </main>
      <Footer />
    </div>
  );
}
