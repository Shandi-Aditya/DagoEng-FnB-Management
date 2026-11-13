"use client";

import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { canOpenDashboard } from "@/features/landing/landing-logic";
import { ModeToggle } from "@/features/layout/ModeToggle";

import { NAV_LINKS } from "./home-content";

/** Where the account link goes: staff to the dashboard, members to their portal, guests to login. */
function accountLink(
  roleSlug: string | undefined,
  signedIn: boolean,
): { href: string; label: string } {
  if (!signedIn) return { href: "/login", label: "Masuk" };
  if (canOpenDashboard(roleSlug))
    return { href: "/dashboard", label: "Buka dashboard" };
  return { href: "/customer", label: "Akun saya" };
}

/** The logo and name exactly as the landing header shows them, for any page that needs the brand mark. */
export function BrandLink() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 font-medium whitespace-nowrap"
    >
      <Image src="/logo-dagoeng.svg" alt="" width={20} height={26} priority />
      Dago Creative Hub
    </Link>
  );
}

export interface HomeNavProps {
  /** Extra items shown before the theme toggle, e.g. the table badge on the customer app. */
  extra?: React.ReactNode;
  /** Action items shown after the theme toggle, e.g. "Tiket saya" on events. */
  action?: React.ReactNode;
  /** The call to action button; hidden on pages that are already the booking flow. */
  showCta?: boolean;
  /** Custom call to action; defaults to "Pesan ruang kerja" -> "/customer?tab=COWORKING". */
  cta?: { href: string; label: string };
  /** The section links; only meaningful on the landing page itself. */
  showLinks?: boolean;
}

/** The public site header, shared by the landing page, the customer app and events. */
export function HomeNav({
  extra,
  action,
  showCta = true,
  cta = { href: "/customer?tab=COWORKING", label: "Pesan ruang kerja" },
  showLinks = true,
}: HomeNavProps) {
  const { user } = useAuth();
  const account = accountLink(user?.role?.slug, Boolean(user));

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <nav
        className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-6"
        aria-label="Utama"
      >
        <BrandLink />
        {showLinks ? (
          <ul className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="hover:text-foreground">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {extra}
          <ModeToggle />
          {action}
          <Button
            variant="ghost"
            render={<Link href={account.href} />}
            nativeButton={false}
          >
            {account.label}
          </Button>
          {showCta ? (
            <Button
              className="hidden sm:inline-flex"
              render={<Link href={cta.href} />}
              nativeButton={false}
            >
              {cta.label}
            </Button>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
