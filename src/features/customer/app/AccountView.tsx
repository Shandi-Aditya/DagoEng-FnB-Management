"use client";

import Link from "next/link";
import { Award, LogOut, Sparkles } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { LoyaltyMember } from "@/types/loyalty";

interface AccountViewProps {
  member: LoyaltyMember | null;
  isSignedIn: boolean;
  isStaff: boolean;
  nextTier: { nextTier: string; pointsNeeded: number; progress: number };
  onLogout: () => void;
}

const HISTORY_LIMIT = 8;

/** The member card and points ledger; for guests, one clear reason to sign up. */
export function AccountView({ member, isSignedIn, isStaff, nextTier, onLogout }: AccountViewProps) {
  if (isStaff) {
    return (
      <EmptyState
        className="border"
        icon={<Award />}
        title="Anda masuk sebagai staf"
        description="Halaman ini untuk tamu. Buka dashboard untuk bekerja."
        action={
          <Button render={<Link href="/dashboard" />} nativeButton={false}>
            Buka dashboard
          </Button>
        }
      />
    );
  }

  if (!isSignedIn || !member) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-medium tracking-tight">Akun</h1>
        <Card>
          <CardHeader>
            <span className="mb-2 flex size-10 items-center justify-center rounded-lg bg-unit-loyalty/20 text-unit-loyalty">
              <Sparkles className="size-5" />
            </span>
            <CardTitle className="text-base">Kumpulkan poin dari setiap pesanan</CardTitle>
            <CardDescription>Makan dan sewa ruang sama-sama menambah poin. Daftar gratis, langsung dapat 50 poin.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row">
            <Button render={<Link href="/login?mode=register&returnTo=/customer?tab=account" />} nativeButton={false}>
              Daftar member
            </Button>
            <Button variant="outline" render={<Link href="/login?returnTo=/customer?tab=account" />} nativeButton={false}>
              Saya sudah punya akun
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const history = [...member.pointHistory].reverse().slice(0, HISTORY_LIMIT);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-medium tracking-tight">Halo, {member.name.split(" ")[0]}</h1>

      <Card className="relative overflow-hidden">
        <CardHeader>
          <CardDescription>Member {member.tier}</CardDescription>
          <CardTitle className="text-3xl font-medium tracking-tight">
            <span className="font-mono tabular-nums">{member.points.toLocaleString("id-ID")}</span> poin
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Progress value={nextTier.progress} aria-label={`Kemajuan ke ${nextTier.nextTier}`} />
          <p className="text-xs text-muted-foreground">
            {nextTier.pointsNeeded > 0 ? (
              <>
                <span className="font-mono tabular-nums">{nextTier.pointsNeeded.toLocaleString("id-ID")}</span> poin lagi ke {nextTier.nextTier}
              </>
            ) : (
              "Anda sudah di tier tertinggi."
            )}
          </p>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3" aria-labelledby="points-title">
        <h2 id="points-title" className="text-sm font-medium">Riwayat poin</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada poin. Poin bertambah setiap pesanan dibayar.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-xl border bg-card">
            {history.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 p-4">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm">{entry.reason}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Makassar" })}
                  </span>
                </span>
                <span className={`font-mono text-sm tabular-nums ${entry.points >= 0 ? "text-success" : "text-muted-foreground"}`}>
                  {entry.points >= 0 ? `+${entry.points}` : entry.points}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Button variant="outline" onClick={onLogout}>
        <LogOut />
        Keluar
      </Button>
    </div>
  );
}
