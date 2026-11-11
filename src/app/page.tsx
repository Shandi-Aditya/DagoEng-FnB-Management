import { AboutSection } from "@/features/landing/AboutSection";
import { EventsSection } from "@/features/landing/EventsSection";
import { LandingFooter } from "@/features/landing/LandingFooter";
import { LandingHeader } from "@/features/landing/LandingHeader";
import { LandingHero } from "@/features/landing/LandingHero";
import { ServicesSection } from "@/features/landing/ServicesSection";

export default function PublicLandingPage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <LandingHeader />
      <main>
        <LandingHero />
        <ServicesSection />
        <EventsSection />
        <AboutSection />
      </main>
      <LandingFooter />
    </div>
  );
}
