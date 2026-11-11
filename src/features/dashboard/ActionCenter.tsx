import Link from "next/link";
import { ChevronRight, CreditCard, Handshake, Inbox, Wallet } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { PendingActions } from "./use-dashboard-metrics";

interface ActionItem {
  key: keyof PendingActions;
  label: string;
  unit: string;
  href: string;
  icon: ReactNode;
}

const ACTION_ITEMS: ActionItem[] = [
  { key: "moderation", label: "Moderasi event", unit: "event baru", href: "/events-admin?section=MODERATION&tab=PENDING", icon: <Inbox /> },
  { key: "payouts", label: "Pencairan saldo", unit: "permintaan", href: "/events-admin?section=PAYOUTS", icon: <Wallet /> },
  { key: "revenueSplits", label: "Usulan bagi hasil", unit: "proposal", href: "/events-admin?section=MODERATION&tab=REVENUE_SPLIT", icon: <Handshake /> },
  { key: "manualPayments", label: "Verifikasi tiket", unit: "bukti transfer", href: "/events-admin?section=PAYMENTS", icon: <CreditCard /> },
];

/** Items that need an admin decision. Hidden when nothing is pending. */
export function ActionCenter({ actions }: { actions: PendingActions }) {
  const items = ACTION_ITEMS.filter((item) => actions[item.key] > 0);
  const total = items.reduce((sum, item) => sum + actions[item.key], 0);
  if (total === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          Perlu tindakan
          <Badge variant="secondary" className="tabular-nums">
            {total}
          </Badge>
        </CardTitle>
        <CardDescription>Pengajuan yang menunggu verifikasi admin</CardDescription>
        <CardAction>
          <Link href="/events-admin" className="text-xs text-muted-foreground hover:text-foreground">
            Buka event hub
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className="flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors hover:bg-accent [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground"
              >
                {item.icon}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{item.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {actions[item.key]} {item.unit}
                  </span>
                </span>
                <ChevronRight />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
