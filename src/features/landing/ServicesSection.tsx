import Link from "next/link";
import { ArrowRight, Check, Laptop, UtensilsCrossed } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LandingSection } from "@/features/landing/LandingSection";
import { SERVICES, type ServiceContent } from "@/features/landing/landing-content";

const SERVICE_ICON = { fnb: UtensilsCrossed, coworking: Laptop } as const;

function ServiceCard({ service }: { service: ServiceContent }) {
  const Icon = SERVICE_ICON[service.id];
  return (
    <Card>
      <CardHeader>
        <Icon className="mb-2 size-5 text-muted-foreground" aria-hidden />
        <CardTitle className="text-lg">{service.title}</CardTitle>
        <CardDescription className="text-sm">{service.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ul className="flex flex-col gap-2 text-sm">
          {service.highlights.map((item) => (
            <li key={item} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">{service.priceCaption}</span>
          <dl className="divide-y rounded-lg border text-sm">
            {service.prices.map((line) => (
              <div key={line.name} className="flex items-center justify-between px-3 py-2">
                <dt>{line.name}</dt>
                <dd className="font-medium tabular-nums">{line.price}</dd>
              </div>
            ))}
          </dl>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" render={<Link href={service.cta.href} />} nativeButton={false}>
          {service.cta.label}
          <ArrowRight />
        </Button>
      </CardFooter>
    </Card>
  );
}

export function ServicesSection() {
  return (
    <LandingSection
      id="services"
      title="Dua layanan, satu tempat"
      description="Pesan makanan dari meja atau sewa ruang kerja, semuanya dari ponsel."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {SERVICES.map((service) => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </div>
    </LandingSection>
  );
}
