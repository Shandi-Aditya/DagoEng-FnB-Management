"use client";

import Link from "next/link";
import { CalendarCheck, QrCode, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandRings } from "@/features/landing/home/BrandRings";
import { BrandLink } from "@/features/landing/home/HomeNav";
import { ModeToggle } from "@/features/layout/ModeToggle";

const POINTS = [
  { icon: CalendarCheck, title: "Ajukan dan pantau event", line: "Lihat event mana yang tayang, masih ditinjau, atau perlu diperbaiki." },
  { icon: QrCode, title: "Check-in dengan QR", line: "Pindai tiket peserta di pintu masuk langsung dari ponsel." },
  { icon: Wallet, title: "Cairkan hasil tiket", line: "Bagian Anda dari tiket yang lunas dihitung per event dan bisa diajukan kapan saja." },
] as const;

interface OrganizerSignedOutProps {
  /** Set when someone is signed in but the account has no organizer access. */
  signedInEmail?: string;
}

/** What a visitor sees on the organizer portal before signing in with an organizer account. */
export function OrganizerSignedOut({ signedInEmail }: OrganizerSignedOutProps) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        <BrandLink />
        <div className="ml-auto flex items-center gap-2">
          <ModeToggle />
          <Button variant="ghost" render={<Link href="/events" />} nativeButton={false}>
            Lihat event
          </Button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-4 pt-8 pb-16 sm:px-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-unit-event">Portal penyelenggara</p>
            <h1 className="text-4xl font-medium tracking-tight text-balance sm:text-5xl">
              Kelola event komunitas Anda di Dago Creative Hub
            </h1>
            <p className="max-w-lg text-base text-pretty text-muted-foreground">
              {signedInEmail
                ? `Akun ${signedInEmail} belum terdaftar sebagai penyelenggara. Masuk dengan akun penyelenggara yang terdaftar untuk mengelola event.`
                : "Masuk dengan akun penyelenggara untuk mengelola event, peserta, dan hasil penjualan tiket."}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              variant="default"
              render={<Link href="/login?returnTo=/events/portal" />}
              nativeButton={false}
            >
              {signedInEmail ? "Masuk dengan akun lain" : "Masuk ke portal"}
            </Button>
            <Button
              size="lg"
              variant="outline"
              render={<Link href="/events" />}
              nativeButton={false}
            >
              Lihat event publik
            </Button>
          </div>
        </div>

        <div className="relative isolate overflow-hidden rounded-2xl bg-unit-event/10 p-4 sm:p-8">
          <BrandRings className="absolute -top-16 -left-20 -z-10 h-[85%] opacity-30" />
          <BrandRings className="absolute -right-16 -bottom-24 -z-10 hidden h-[70%] rotate-180 opacity-20 sm:block" />
          <ul className="flex flex-col gap-3">
            {POINTS.map(({ icon: Icon, title, line }) => (
              <li key={title} className="flex gap-3 rounded-xl border bg-card p-4 shadow-sm">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-unit-event/10 text-unit-event">
                  <Icon className="size-4" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{title}</span>
                  <span className="text-sm text-muted-foreground">{line}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
