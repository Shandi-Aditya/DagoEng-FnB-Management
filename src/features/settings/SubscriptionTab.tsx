"use client";

import { Check, Sparkles } from "lucide-react";

import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PLATFORM_PLANS, type OrgSubscriptionState, type PlanTier, type TenantAddonItem } from "@/lib/subscription";

export interface SubscriptionTabProps {
  orgSub: OrgSubscriptionState;
  tenantAddons: TenantAddonItem[];
  outletsCount: number;
  isSuperAdmin?: boolean;
  onSelectPlanTier: (tier: PlanTier) => void;
  onToggleAddon: (code: string) => void;
}

export function SubscriptionTab({
  orgSub,
  tenantAddons,
  outletsCount,
  isSuperAdmin = false,
  onSelectPlanTier,
  onToggleAddon,
}: SubscriptionTabProps) {
  const currentPlan = PLATFORM_PLANS[orgSub.planTier];

  return (
    <div className="flex flex-col gap-6">
      {/* Kartu Status Paket Aktif */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle>{orgSub.planName}</CardTitle>
                <Badge variant="outline">{orgSub.planTier}</Badge>
              </div>
              <CardDescription>{currentPlan.tagline}</CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusBadge status="success">Paket aktif</StatusBadge>
            <span className="text-xs text-muted-foreground">
              {isSuperAdmin ? "Platform Super Admin" : "Organisasi"}
            </span>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 text-xs">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-lg border bg-muted/30 p-3">
            <div>
              <span className="text-muted-foreground">Organisasi</span>
              <p className="font-medium text-foreground">{orgSub.organizationName}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Mulai aktif</span>
              <p className="font-medium text-foreground">{orgSub.activeSince}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Perpanjangan</span>
              <p className="font-medium text-foreground">{orgSub.nextRenewalDate}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Siklus tagihan</span>
              <p className="font-medium text-foreground">{orgSub.billingCycle}</p>
            </div>
          </div>

          {/* Kuota Outlet */}
          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">Pemakaian outlet fisik</span>
              <span className="font-mono text-muted-foreground tabular-nums">
                {outletsCount} /{" "}
                {currentPlan.maxOutlets === "UNLIMITED" ? "Tak terbatas" : `${currentPlan.maxOutlets} cabang`}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary"
                style={{
                  width:
                    currentPlan.maxOutlets === "UNLIMITED"
                      ? "35%"
                      : `${Math.min(100, (outletsCount / (currentPlan.maxOutlets as number)) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Pengalih Simulasi Paket */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t">
            <span className="text-muted-foreground">Simulasi pilihan paket:</span>
            <div className="flex flex-wrap gap-1.5">
              {(["STARTER", "PROFESSIONAL", "ENTERPRISE"] as PlanTier[]).map((tier) => {
                const isSelected = orgSub.planTier === tier;
                return (
                  <Button
                    key={tier}
                    type="button"
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => onSelectPlanTier(tier)}
                  >
                    {tier === "STARTER" ? "Starter" : tier === "PROFESSIONAL" ? "Pro" : "Enterprise"}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Perbandingan 3 Paket */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {(["STARTER", "PROFESSIONAL", "ENTERPRISE"] as PlanTier[]).map((tier) => {
          const plan = PLATFORM_PLANS[tier];
          const isCurrent = orgSub.planTier === tier;

          return (
            <Card key={tier} className={isCurrent ? "border-primary" : undefined}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  {isCurrent ? <Badge>Aktif</Badge> : null}
                </div>
                <CardDescription>{plan.monthlyPriceDisplay}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-xs">
                <p className="text-muted-foreground">{plan.tagline}</p>
                <ul className="flex flex-col gap-1.5 divide-y pt-2">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-center gap-2 pt-1.5 first:pt-0">
                      <Check className="size-3.5 text-success shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add-on Layanan */}
      {tenantAddons.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Add-on gerai</CardTitle>
            <CardDescription>Aktifkan modul tambahan sesuai kebutuhan operasional.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-xs">
            {tenantAddons.map((addon) => {
              const isActive = addon.status === "ACTIVE";
              return (
                <div
                  key={addon.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-foreground">{addon.name}</span>
                    <span className="text-muted-foreground">{addon.description}</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={isActive ? "outline" : "default"}
                    onClick={() => onToggleAddon(addon.code)}
                  >
                    {isActive ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
