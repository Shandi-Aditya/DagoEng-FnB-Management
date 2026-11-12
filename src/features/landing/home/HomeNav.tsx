"use client";

import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { canOpenDashboard } from "@/features/landing/landing-logic";
import { ModeToggle } from "@/features/layout/ModeToggle";

import { NAV_LINKS } from "./home-content";

/** Where the account link goes: staff to the dashboard, members to their portal, guests to login. */
function accountLink(roleSlug: string | undefined, signedIn: boolean): { href: string; label: string } {
  if (!signedIn) return { href: "/login", label: "Masuk" };
  if (canOpenDashboard(roleSlug)) return { href: "/dashboard", label: "Buka dashboard" };
  return { href: "/customer", label: "Akun saya" };
}

export function HomeNav() {
  const { user } = useAuth();
  const account = accountLink(user?.role?.slug, Boolean(user));

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-6" aria-label="Utama">
        <Link href="/" className="flex items-center gap-2 font-medium">
          <Image src="/logo-dagoeng.svg" alt="" width={20} height={26} priority />
          Dago Creative Hub
        </Link>
        <ul className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="hover:text-foreground">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-2">
          <ModeToggle />
          <Button variant="ghost" render={<Link href={account.href} />} nativeButton={false}>
            {account.label}
          </Button>
          <Button className="hidden sm:inline-flex" render={<Link href="/customer?tab=COWORKING" />} nativeButton={false}>
            Pesan ruang kerja
          </Button>
        </div>
      </nav>
    </header>
  );
}
