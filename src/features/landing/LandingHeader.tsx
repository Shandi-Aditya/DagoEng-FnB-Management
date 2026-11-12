"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ModeToggle } from "@/features/layout/ModeToggle";
import { AccountMenu } from "@/features/landing/AccountMenu";
import { LANDING_NAV } from "@/features/landing/landing-content";

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <Image src="/logo-dago.png" alt="" width={28} height={32} priority className="object-contain" />
      <span className="text-sm font-semibold">DagoEng Creative Hub</span>
    </Link>
  );
}

/** Sticky public header: anchor nav on desktop, sheet menu on mobile. */
export function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Brand />

        <nav aria-label="Navigasi halaman" className="hidden items-center gap-1 md:flex">
          {LANDING_NAV.map((item) => (
            <Button key={item.id} variant="ghost" size="sm" render={<a href={`#${item.id}`} />} nativeButton={false}>
              {item.label}
            </Button>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <div className="hidden sm:block">
            <AccountMenu />
          </div>
          <ModeToggle />
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Buka menu" />}>
              <Menu />
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav aria-label="Navigasi halaman" className="flex flex-col gap-1 px-4">
                {LANDING_NAV.map((item) => (
                  <Button
                    key={item.id}
                    variant="ghost"
                    className="justify-start"
                    render={<a href={`#${item.id}`} onClick={() => setMenuOpen(false)} />}
                    nativeButton={false}
                  >
                    {item.label}
                  </Button>
                ))}
              </nav>
              <div className="mt-auto border-t p-4 sm:hidden">
                <AccountMenu />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
