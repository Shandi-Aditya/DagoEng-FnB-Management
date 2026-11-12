import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LandingSection } from "@/features/landing/LandingSection";
import { ABOUT, LOYALTY } from "@/features/landing/landing-content";

export function AboutSection() {
  return (
    <LandingSection id="about" title={ABOUT.title} description={ABOUT.description}>
      <ol className="grid gap-6 sm:grid-cols-3">
        {ABOUT.points.map((point, index) => (
          <li key={point.title} className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground tabular-nums">0{index + 1}</span>
            <h3 className="font-medium">{point.title}</h3>
            <p className="text-sm text-muted-foreground">{point.description}</p>
          </li>
        ))}
      </ol>

      <Card id="loyalty" className="scroll-mt-16">
        <CardContent className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-1">
            <h3 className="font-medium">{LOYALTY.title}</h3>
            <p className="text-sm text-muted-foreground">{LOYALTY.description}</p>
          </div>
          <Button className="shrink-0" render={<Link href={LOYALTY.cta.href} />} nativeButton={false}>
            {LOYALTY.cta.label}
            <ArrowRight />
          </Button>
        </CardContent>
      </Card>
    </LandingSection>
  );
}
